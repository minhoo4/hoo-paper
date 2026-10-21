import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BASE_EPOCH, SYMBOLS, marketSecond, recentNews, secondBar } from './market';

function env(key:string):string {const value=process.env[key]; if(!value)throw new Error(`Missing env: ${key}`); return value; }
let adminClient:SupabaseClient | null=null;
export function admin():SupabaseClient {
  if(!adminClient) adminClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'),{
    auth:{autoRefreshToken:false,persistSession:false}
  });
  return adminClient;
}
export async function verifyUser(request:Request):Promise<{id:string;name:string}> {
  const header=request.headers.get('authorization')||'';
  const token=header.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)throw new Error('UNAUTHORIZED');
  const {data,error}=await admin().auth.getUser(token);
  if(error||!data.user)throw new Error('UNAUTHORIZED');
  const raw=data.user.user_metadata?.display_name||data.user.user_metadata?.nickname||null;
  const name=typeof raw==='string'?raw:'추종자-'+data.user.id.slice(0,6);
  return {id:data.user.id,name};
}
function assert(result:{data:any;error:any},where:string) {
  if(result.error) throw new Error(`${where}: ${result.error.message}`);
  return result.data;
}
/**
 * Advance the global clock without skipping ANY tick while any position is open.
 * The DB function hootrading_fast_forward_flat atomically permits a jump only if
 * the entire market is flat. Otherwise, replay the missed ticks in contiguous
 * batches of at most 240 (the database RPC limit).
 *
 * A bounded number of batches and a wall-clock deadline prevent long requests;
 * if there is more history to replay, callers get caughtUp:false, not a trade.
 * This method is safe to call concurrently: the DB locks/contiguity checks are
 * the authority, and returned last_second is used instead of assuming progress.
 */
export async function catchUp(maxTicks = 75): Promise<{caughtUp:boolean;remaining:number;lastSecond:number}> {
  const db = admin();
  // The route chooses a higher replay budget for order retries. Never allow
  // arbitrary callers to exceed a bounded amount of work per request.
  const budget = Number.isFinite(maxTicks)
    ? Math.max(1, Math.min(960, Math.trunc(maxTicks)))
    : 75;
  const initial = assert(
    await db.from('hootrading_market_state').select('last_second').eq('id', 1).single(),
    'market clock'
  );
  let last = Number(initial.last_second);
  if (!Number.isSafeInteger(last) || last < 0) throw new Error('INVALID_MARKET_CLOCK');
  let target = marketSecond();

  if (target - last > 300) {
    // DB returns the unchanged clock when ANY trader still has a position.
    // Never bypass that protection; backfill every intervening tick instead.
    const flatQuotes = Object.fromEntries(
      SYMBOLS.map(symbol => [symbol, secondBar(symbol, target)])
    );
    const flat = await db.rpc('hootrading_fast_forward_flat', {
      p_second: target, p_quotes: flatQuotes
    });
    if (flat.error) throw new Error(`idle market sync: ${flat.error.message}`);
    const observed = Number(flat.data);
    if (!Number.isSafeInteger(observed) || observed < last || observed > target)
      throw new Error('INVALID_FAST_FORWARD_RESULT');
    last = observed;
  }

  let replayed = 0;
  const deadline = Date.now() + 5000;
  // Keep the target fresh: a batch can take time and the market keeps ticking.
  while (replayed < budget && Date.now() < deadline) {
    target = marketSecond();
    if (last >= target) break;
    const count = Math.min(240, budget - replayed, target - last);
    const batch = [];
    for (let second = last + 1; second <= last + count; second++) {
      const quotes = Object.fromEntries(
        SYMBOLS.map(symbol => [symbol, secondBar(symbol, second)])
      );
      batch.push({second, quotes});
    }
    const advanced = await db.rpc('hootrading_advance_batch', {p_batch: batch});
    if (advanced.error) throw new Error(`advance batch: ${advanced.error.message}`);
    const observed = Number(advanced.data);
    if (!Number.isSafeInteger(observed) || observed < last || observed > marketSecond() + 2)
      throw new Error('INVALID_ADVANCE_RESULT');
    if (observed === last) break; // No progress: don't loop forever.
    last = observed;
    replayed += count;
  }
  const liveTarget = marketSecond();
  // The DB rejects orders more than 3 seconds behind. Require at most one
  // second of latency at this boundary to leave room for order-RPC overhead.
  return {
    caughtUp: last >= liveTarget - 1,
    remaining: Math.max(0, liveTarget - last),
    lastSecond: last
  };
}
/** All account fields are captured in one DB statement, not six REST queries. */
export function presentState(raw:any,timeframe:number){
 if(!raw?.account||!Array.isArray(raw.positions)||!raw.prices)throw new Error('INVALID_DB_SNAPSHOT');
 const now=Number(raw.marketSecond),lastPrices=raw.prices;
 if(!Number.isSafeInteger(now)||SYMBOLS.some(s=>!Number.isFinite(Number(lastPrices[s]))||Number(lastPrices[s])<=0||Number(raw.priceSeconds?.[s])!==now))throw new Error('STALE_DB_QUOTES');
 const entries=raw.positions.map((p:any)=>{
  const mark=Number(lastPrices[p.symbol]),qty=Number(p.qty),entry=Number(p.entry_price),margin=Number(p.margin_tc),side=Number(p.side);
  const unrealized=side*qty*(mark-entry);
  return {...p,side,leverage:Number(p.leverage),qty,entry_price:entry,margin_tc:margin,mark,unrealized,
   position_equity_tc:Math.max(0,margin+unrealized),
   liquidation_price:side===1?(entry-margin/qty)/.995:(entry+margin/qty)/1.005};
 });
 const equity=Number(raw.account.cash_tc)+entries.reduce((sum:number,p:any)=>sum+p.position_equity_tc,0);
 return {...raw,market:{now,virtualMinute:Math.max(0,now-BASE_EPOCH),prices:lastPrices,candles:{},news:recentNews(now,5)},
  totalHooEquivalent:Number(raw.walletHoo)+equity/1000,account:{...raw.account,equity_tc:equity},positions:entries,
  conversion:{oneHooTC:1000,oneTCWon:10000},timeframe};
}
export async function snapshot(userId:string,userName:string,timeframe:number){
 return presentState(assert(await admin().rpc('hootrading_snapshot',{p_user:userId,p_name:userName}),'snapshot'),timeframe);
}
export async function executeOrder(userId:string,requestId:string,command:Record<string,unknown>){
 return assert(await admin().rpc('hootrading_command',{p_user:userId,p_request:requestId,p_body:command}),'command');
}
