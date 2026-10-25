import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BASE_EPOCH, SYMBOLS, marketSecond, recentNews, secondBar } from './market';
import { returnOnInitialCapital } from './performance';
import { catchUpV6 } from './v6-live';

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
  // Fail closed if the V6 status query itself fails; never silently use legacy quotes.
  const v6State=await db.from('hootrading_v6_stream').select('mode').eq('id',1).maybeSingle();
  if(v6State.error)throw new Error(`V6_MODE_UNAVAILABLE:${v6State.error.message}`);
  if(v6State.data?.mode==='active')return catchUpV6(db,budget);
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
/** Reject malformed DB finance rows instead of returning Infinity/NaN as JSON null. */
function finiteMoney(value:unknown,field:string,minimum=Number.NEGATIVE_INFINITY):number {
 if(value===null||value===undefined||typeof value==='boolean'||(typeof value==='string'&&value.trim()===''))
  throw new Error(`INVALID_DB_SNAPSHOT:${field}`);
 const n=Number(value);
 if(!Number.isFinite(n)||n<minimum)throw new Error(`INVALID_DB_SNAPSHOT:${field}`);
 return n;
}
export function presentState(raw:any,timeframe:number){
 if(!raw?.account||!Array.isArray(raw.positions)||!raw.prices)throw new Error('INVALID_DB_SNAPSHOT');
 const now=Number(raw.marketSecond),lastPrices=raw.prices;
 if(!Number.isSafeInteger(now)||SYMBOLS.some(s=>!Number.isFinite(Number(lastPrices[s]))||Number(lastPrices[s])<=0||Number(raw.priceSeconds?.[s])!==now))throw new Error('STALE_DB_QUOTES');
 const cashTc=finiteMoney(raw.account.cash_tc,'cash_tc');
 const walletHoo=finiteMoney(raw.walletHoo,'walletHoo',0);
 const entries=raw.positions.map((p:any,index:number)=>{
  if(!p||!SYMBOLS.includes(p.symbol))throw new Error(`INVALID_DB_SNAPSHOT:position_${index}_symbol`);
  const side=finiteMoney(p.side,`position_${index}_side`);
  if(side!==1&&side!==-1)throw new Error(`INVALID_DB_SNAPSHOT:position_${index}_side`);
  const qty=finiteMoney(p.qty,`position_${index}_qty`,Number.MIN_VALUE);
  const entry=finiteMoney(p.entry_price,`position_${index}_entry_price`,Number.MIN_VALUE);
  const margin=finiteMoney(p.margin_tc,`position_${index}_margin_tc`,0);
  const leverage=finiteMoney(p.leverage,`position_${index}_leverage`,1);
  if(!Number.isInteger(leverage)||leverage>20)throw new Error(`INVALID_DB_SNAPSHOT:position_${index}_leverage`);
  const mark=Number(lastPrices[p.symbol]);
  const unrealized=side*qty*(mark-entry);
  const positionEquity=Math.max(0,margin+unrealized);
  const liquidation=side===1?(entry-margin/qty)/.995:(entry+margin/qty)/1.005;
  if(![unrealized,positionEquity,liquidation].every(Number.isFinite))throw new Error(`INVALID_DB_SNAPSHOT:position_${index}_calculation`);
  return {...p,side,leverage,qty,entry_price:entry,margin_tc:margin,mark,unrealized,
    position_equity_tc:positionEquity,liquidation_price:liquidation};
 });
 const equity=cashTc+entries.reduce((sum:number,p:any)=>sum+p.position_equity_tc,0);
 const totalHooEquivalent=walletHoo+equity/1000;
 if(!Number.isFinite(equity)||!Number.isFinite(totalHooEquivalent))throw new Error('INVALID_DB_SNAPSHOT:equity');
 // Supabase RPC currently computes roi=realized_tc/total_deposit_tc.
 // Correct the UI field to the explicitly labelled season-500-HOO baseline.
 // Sorting by corrected ROI matters for the top-ten ordering; RPC itself may
 // prefilter the top ten, so authoritative ranking is /api/hoo-trading?view=ranking.
 const correctedRanking=Array.isArray(raw.ranking)?raw.ranking.map((r:any)=>({
  ...r,roi:returnOnInitialCapital(finiteMoney(r.profit,'ranking_profit'))
 })).sort((a:any,b:any)=>b.roi-a.roi||b.profit-a.profit):[];
 return {...raw,ranking:correctedRanking,market:{now,virtualMinute:Math.max(0,now-BASE_EPOCH),prices:lastPrices,candles:{},news:recentNews(now,5)},
  walletHoo,totalHooEquivalent,account:{...raw.account,cash_tc:cashTc,equity_tc:equity},positions:entries,
  conversion:{oneHooTC:1000,oneTCWon:10000},timeframe};
}
export async function snapshot(userId:string,userName:string,timeframe:number){
 return presentState(assert(await admin().rpc('hootrading_snapshot',{p_user:userId,p_name:userName}),'snapshot'),timeframe);
}
export async function executeOrder(userId:string,requestId:string,command:Record<string,unknown>){
 return assert(await admin().rpc('hootrading_command',{p_user:userId,p_request:requestId,p_body:command}),'command');
}
