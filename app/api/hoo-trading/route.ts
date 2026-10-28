import { NextResponse } from 'next/server';
import { admin, catchUp, executeOrder, snapshot, presentState, verifyUser } from '../../../lib/hoo-trading/server';
import { TIMESPANS } from '../../../lib/hoo-trading/market';
import { validateCommand } from '../../../lib/hoo-trading/contracts';
import { returnOnInitialCapital } from '../../../lib/hoo-trading/performance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
// Authenticated READ-ONLY balance endpoint. No RPC, market synchronization,
// row creation, write, or maintenance-gate mutation is performed here.
async function readOnlyAssets(userId:string){
 const db=admin();
 const [wallet,account,positions]=await Promise.all([
  db.from('hoo_coin_wallets').select('balance').eq('user_id',userId).maybeSingle(),
  db.from('hootrading_accounts').select('cash_tc,total_deposit_tc,realized_tc').eq('user_id',userId).maybeSingle(),
  db.from('hootrading_positions').select('id',{head:true,count:'exact'}).eq('user_id',userId)
 ]);
 if(wallet.error||!wallet.data)throw new Error(`READ_ONLY_WALLET_ERROR: ${wallet.error?.message||'wallet_missing'}`);
 if(account.error)throw new Error(`READ_ONLY_ACCOUNT_ERROR: ${account.error.message}`);
 if(positions.error||positions.count===null)throw new Error(`READ_ONLY_POSITIONS_ERROR: ${positions.error?.message||'count_unavailable'}`);
 const amount=(value:unknown,field:string,min=-Number.MAX_SAFE_INTEGER)=>{
  if(value===null||value===undefined||typeof value==='boolean'||(typeof value==='string'&&value.trim()===''))
   throw new Error(`INVALID_READ_ONLY_ASSETS:${field}`);
  const n=Number(value);
  if(!Number.isFinite(n)||!Number.isSafeInteger(Math.trunc(n))||n<min)throw new Error(`INVALID_READ_ONLY_ASSETS:${field}`);
  return n;
 };
 const walletHoo=amount(wallet.data.balance,'walletHoo',0);
 const tradingAccount=account.data?{
  cash_tc:amount(account.data.cash_tc,'cash_tc',0),
  total_deposit_tc:amount(account.data.total_deposit_tc,'total_deposit_tc'),
  realized_tc:amount(account.data.realized_tc,'realized_tc')
 }:null;
 const openPositions=positions.count;
 if(!Number.isSafeInteger(openPositions)||openPositions<0)throw new Error('INVALID_READ_ONLY_ASSETS:openPositions');
 return {readOnly:true,walletHoo,account:tradingAccount,openPositions};
}
// HOO_CHANGE_0010_A_V1: position/account monitor only. This endpoint MUST NOT
// read the HOO wallet, advance the market, settle trades or change any DB row.
async function readOnlyPositionMonitor(userId:string){
 const db=admin();
 const [positions,account]=await Promise.all([
  db.from('hootrading_positions')
   .select('id,symbol,side,leverage,qty,entry_price,margin_tc,stop_price,take_price')
   .eq('user_id',userId),
  db.from('hootrading_accounts')
   .select('cash_tc,total_deposit_tc,realized_tc')
   .eq('user_id',userId).maybeSingle()
 ]);
 if(positions.error||!Array.isArray(positions.data))throw new Error('POSITION_MONITOR_READ_FAILED');
 if(account.error||!account.data)throw new Error('ACCOUNT_MONITOR_READ_FAILED');
 if(positions.data.length>100)throw new Error('POSITION_MONITOR_LIMIT');
 const finite=(v:unknown,field:string,min:number)=>{
  if(v===null||v===undefined||typeof v==='boolean'||(typeof v==='string'&&v.trim()===''))
   throw new Error(`POSITION_MONITOR_INVALID:${field}`);
  const n=Number(v);
  if(!Number.isFinite(n)||n<min)throw new Error(`POSITION_MONITOR_INVALID:${field}`);
  return n;
 };
 const rows=positions.data.map((p,index)=>{
  if(typeof p.id!=='string'||!['HOO','EGG','COAL'].includes(String(p.symbol)))
   throw new Error(`POSITION_MONITOR_INVALID:row_${index}`);
  const side=finite(p.side,'side',-1),leverage=finite(p.leverage,'leverage',1);
  if((side!==1&&side!==-1)||!Number.isInteger(leverage)||leverage>20)
   throw new Error('POSITION_MONITOR_INVALID:direction_or_leverage');
  const risk=(v:unknown,key:string)=>v===null?null:finite(v,key,0);
  return {id:p.id,symbol:p.symbol,side,leverage,
   qty:finite(p.qty,'qty',Number.MIN_VALUE),
   entry_price:finite(p.entry_price,'entry_price',Number.MIN_VALUE),
   margin_tc:finite(p.margin_tc,'margin_tc',0),
   stop_price:risk(p.stop_price,'stop_price'),take_price:risk(p.take_price,'take_price')};
 });
 const a=account.data;
 return {readOnly:true,positionMonitor:true,positions:rows,
  account:{cash_tc:finite(a.cash_tc,'cash_tc',0),
   total_deposit_tc:finite(a.total_deposit_tc,'total_deposit_tc',0),
   realized_tc:finite(a.realized_tc,'realized_tc',-Number.MAX_VALUE)}};
}
// Pure SELECT of existing, realized trading-account statistics. This intentionally
// does not call snapshot/catchUp, recalculate settlements, or touch economy gates.
async function readOnlyRanking(){
 const {data, count, error}=await admin().from('hootrading_accounts')
  .select('user_id,display_name,total_deposit_tc,realized_tc',{count:'exact'})
  .gte('total_deposit_tc',1000)
  .order('user_id',{ascending:true})
  .range(0,999);
 if(error)throw new Error(`READ_ONLY_RANKING_ERROR: ${error.message}`);
 if(count===null||count===undefined||count>1000||!Array.isArray(data)||data.length!==count)
  throw new Error('READ_ONLY_RANKING_INCOMPLETE');
 const finite=(value:unknown,field:string)=>{
  if(value===null||value===undefined||typeof value==='boolean'||(typeof value==='string'&&value.trim()===''))
   throw new Error(`INVALID_READ_ONLY_RANKING:${field}`);
  const n=Number(value);
  // Never round an enormous bigint/numeric into a misleading ranking value.
  if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)throw new Error(`INVALID_READ_ONLY_RANKING:${field}`);
  return n;
 };
 const ranked=data.map(record=>{
  const deposited=finite(record.total_deposit_tc,'total_deposit_tc');
  const profit=finite(record.realized_tc,'realized_tc');
  if(deposited<1000)throw new Error('INVALID_READ_ONLY_RANKING:deposit_threshold');
  const roi=returnOnInitialCapital(profit);
  if(!Number.isFinite(roi))throw new Error('INVALID_READ_ONLY_RANKING:roi');
  const userId=String(record.user_id??'');
  if(!/^[0-9a-f-]{36}$/i.test(userId))throw new Error('INVALID_READ_ONLY_RANKING:user_id');
  const display=typeof record.display_name==='string'?record.display_name.trim():'';
  return {userId,name:(display||`추종자-${userId.slice(0,6)}`).slice(0,24),roi,profit};
 });
 ranked.sort((a,b)=>b.roi-a.roi||b.profit-a.profit||a.userId.localeCompare(b.userId));
 return {readOnly:true,ranking:ranked.slice(0,10),eligibleCount:count,asOf:new Date().toISOString()};
}
// Compare replay payloads independent of JSONB key ordering; never run a different command with an old request ID.
function canonical(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 const record=value as Record<string,unknown>;
 return `{${Object.keys(record).filter(k=>record[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}
function fail(e:unknown,requestId?:string){
 const detail=e instanceof Error?e.message:String(e);
 const auth=detail==='UNAUTHORIZED';
 const maintenance=detail.includes('HOO_ECONOMY_MAINTENANCE_PAUSED');
 // Expected maintenance is NOT a server failure. Keep the underlying guard enabled.
 if(maintenance)console.info('hoo-trading',requestId||'read','economy maintenance: market chart remains public');
 else console.error('hoo-trading',requestId||'read',detail);
 const known=['insufficient_hoo','insufficient_tc','hoo_wallet_missing','invalid_risk_prices_after_scale_in','invalid_risk_prices','additional_entry_requires_same_leverage','opposite_side_close_first','position_not_found','market_not_caught_up','partial_close_below_precision','idempotency_key_reused_with_different_payload'];
 const code=known.find(x=>detail.includes(x));
 const message=auth?'로그인이 필요합니다.':maintenance?'경제 시스템 점검 중입니다. 차트는 이용 가능하지만 거래와 계좌 조회는 일시 중단됩니다.':code||(/^INVALID_|^MISSING_/.test(detail)?detail:'거래 서버 오류입니다. 요청 ID로 서버 로그를 확인해주세요.');
 return NextResponse.json({error:message,...(maintenance?{code:'ECONOMY_MAINTENANCE'}:{}),requestId},{status:auth?401:maintenance?423:code||/^INVALID_|^MISSING_/.test(detail)?400:500,headers});
}
export async function GET(req:Request){
 try{
  const user=await verifyUser(req);
  const url=new URL(req.url);
  if(url.searchParams.get('view')==='assets'){
   // This endpoint remains available during maintenance without opening trading.
   return NextResponse.json(await readOnlyAssets(user.id),{headers});
  }
  if(url.searchParams.get('view')==='position-monitor'){
   // Authenticated account and open positions only; never query HOO wallet.
   return NextResponse.json(await readOnlyPositionMonitor(user.id),{headers});
  }
  if(url.searchParams.get('view')==='ranking'){
   // Existing rankings only; no market catch-up, transaction or maintenance unlock.
   return NextResponse.json(await readOnlyRanking(),{headers});
  }
  const timeframe=Number(url.searchParams.get('timeframe')||30);
  if(!TIMESPANS.includes(timeframe as typeof TIMESPANS[number]))throw new Error('INVALID_TIMEFRAME');
  const {data: clockData,error: clockError}=await admin()
  .from('hootrading_market_state')
  .select('last_second')
  .eq('id',1)
  .single();

if(clockError||!clockData)
  throw new Error('MARKET_CLOCK_READ_FAILED');

const lastSecond=Number(clockData.last_second);
if(!Number.isSafeInteger(lastSecond))
  throw new Error('INVALID_MARKET_CLOCK');

const remaining=Math.max(
  0,
  Math.floor(Date.now()/1000)-lastSecond
);

const clock={
  caughtUp:remaining<=1,
  remaining,
  lastSecond
};
  const data=await snapshot(user.id,user.name,timeframe);
  return NextResponse.json({...data,clock},{headers});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 let requestId:string|undefined;
 let committed:any=null;
 try{
  const user=await verifyUser(req);
  const text=await req.text();if(text.length>8192)throw new Error('INVALID_BODY_SIZE');
  let body:unknown;try{body=JSON.parse(text);}catch{throw new Error('INVALID_JSON');}
  const input=validateCommand(body);requestId=input.requestId;
  // CRITICAL: A confirmed receipt must be readable even when market catch-up is delayed.
  // This is a read-only check, and does not execute, re-price, or settle the order again.
  const previous=await admin().from('hootrading_requests')
   .select('payload,receipt').eq('user_id',user.id).eq('request_id',requestId).maybeSingle();
  if(previous.error)throw new Error(`request receipt lookup: ${previous.error.message}`);
  if(previous.data){
   if(canonical(previous.data.payload)!==canonical(input.command))
    throw new Error('idempotency_key_reused_with_different_payload');
   const receipt=previous.data.receipt;
   if(receipt?.committed!==true||String(receipt.requestId).toLowerCase()!==requestId.toLowerCase())
    throw new Error('INVALID_SAVED_RECEIPT');
   return NextResponse.json({ok:true,receipt:{...receipt,replayed:true},statePending:true,requestId},{headers});
  }
  // One safe retry can replay several bounded batches instead of only 120 ticks.
  // Never execute a new order until the global market and all pending stops
  // have been replayed, even if that requires more than one request.
  const clock=await catchUp(960);
  if(!clock.caughtUp)return NextResponse.json({error:`시장 동기화 중: 남은 ${clock.remaining.toLocaleString('ko-KR')}틱. 동일 요청으로 다시 확인해주세요.`,requestId,clock},{status:503,headers:{...headers,'Retry-After':'1'}});
  committed=await executeOrder(user.id,requestId,input.command);
  // Receipt and raw state already committed together; no post-commit DB read.
  return NextResponse.json({ok:true,...presentState(committed.state,input.timeframe),receipt:committed.receipt,clock},{headers});
 }catch(e){
  if(committed?.receipt)return NextResponse.json({ok:true,receipt:committed.receipt,statePending:true,requestId},{status:202,headers});
  return fail(e,requestId);
 }
}
