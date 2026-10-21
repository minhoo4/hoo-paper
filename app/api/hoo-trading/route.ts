import { NextResponse } from 'next/server';
import { admin, catchUp, executeOrder, snapshot, presentState, verifyUser } from '../../../lib/hoo-trading/server';
import { TIMESPANS } from '../../../lib/hoo-trading/market';
import { validateCommand } from '../../../lib/hoo-trading/contracts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
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
 // Detailed database/configuration errors stay in server logs, correlated by requestId.
 console.error('hoo-trading',requestId||'read',detail);
 const known=['insufficient_hoo','insufficient_tc','hoo_wallet_missing','invalid_risk_prices_after_scale_in','invalid_risk_prices','additional_entry_requires_same_leverage','opposite_side_close_first','position_not_found','market_not_caught_up','partial_close_below_precision','idempotency_key_reused_with_different_payload'];
 const code=known.find(x=>detail.includes(x));
 const message=auth?'로그인이 필요합니다.':code||(/^INVALID_|^MISSING_/.test(detail)?detail:'거래 서버 오류입니다. 요청 ID로 서버 로그를 확인해주세요.');
 return NextResponse.json({error:message,requestId},{status:auth?401:code||/^INVALID_|^MISSING_/.test(detail)?400:500,headers});
}
export async function GET(req:Request){
 try{
  const user=await verifyUser(req);
  const timeframe=Number(new URL(req.url).searchParams.get('timeframe')||15);
  if(!TIMESPANS.includes(timeframe as typeof TIMESPANS[number]))throw new Error('INVALID_TIMEFRAME');
  const clock=await catchUp(90);
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
