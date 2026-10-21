import { NextResponse } from 'next/server';
import { admin } from '../../../../lib/hoo-trading/server';
import { BASE_EPOCH, SYMBOLS, TIMESPANS, recentNews, type SymbolCode } from '../../../../lib/hoo-trading/market';
import { chartPage } from '../../../../lib/hoo-trading/paged-chart';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** A missing OPTIONAL derived-candle cache must not prevent the shared chart from loading.
 * Only missing-RPC errors get the slower on-demand calculation fallback.
 * All actual quotes still come from the authoritative, settled database clock.
 */
function missingCacheFunction(e:{code?:string;message?:string}):boolean{
 return e.code==='PGRST202'||e.code==='42883'||/could not find the function public\.hootrading_cache_(read|write)/i.test(e.message||'');
}
function publicError(error:unknown):{code:string;error:string}{
 const message=error instanceof Error?error.message:String(error);
 if(message.includes('MARKET_SECRET_REQUIRED')||message.includes('Missing env:'))return {code:'MARKET_CONFIG',error:'시장 서버 설정이 완료되지 않았습니다. HOO_MARKET_SECRET 및 Supabase 서버 환경변수를 확인하세요.'};
 if(message.includes('MARKET_DB_UNAVAILABLE'))return {code:'MARKET_DB_UNAVAILABLE',error:'공통 시세 DB를 읽지 못했습니다. hootrading_prices 테이블과 서버 권한을 확인하세요.'};
 if(message.includes('MARKET_NOT_READY'))return {code:'MARKET_NOT_READY',error:'공통 시장 시계와 세 종목 가격이 준비되지 않았습니다. 시장 초기화·정산 상태를 확인하세요.'};
 return {code:'MARKET_REQUEST_FAILED',error:'공통 차트를 불러오지 못했습니다. Vercel 서버 로그의 hoo-trading market 오류를 확인하세요.'};
}
/** Read only: never show an unprocessed future mark while account liquidation lags. */
export async function GET(req:Request){
 try{
  const q=new URL(req.url).searchParams,symbol=(q.get('symbol')||'HOO') as SymbolCode,timeframe=Number(q.get('timeframe')||15);
  if(!SYMBOLS.includes(symbol)||!TIMESPANS.includes(timeframe as typeof TIMESPANS[number]))return NextResponse.json({error:'종목 또는 시간봉 오류'},{status:400});
  // Read prices and their clock in one DB query. During a transaction all three advance together.
  const {data,error}=await admin().from('hootrading_prices').select('symbol,price,tick_second');
  if(error||!data||data.length!==3)throw new Error('MARKET_DB_UNAVAILABLE');
  const now=Number(data[0].tick_second);
  if(now<BASE_EPOCH+1||data.some(x=>Number(x.tick_second)!==now))throw new Error('MARKET_NOT_READY');
  const prices=Object.fromEntries(data.map(x=>[x.symbol,Number(x.price)]));
  const rawBefore=q.get('before'),before=rawBefore===null?undefined:Number(rawBefore);
  let cacheUnavailable=false;
  const page=await chartPage({
   read:async(engine,s,span,starts)=>{
    if(cacheUnavailable)return [];
    const r=await admin().rpc('hootrading_cache_read',{p_engine:engine,p_symbol:s,p_span:span,p_starts:starts});
    if(r.error){
     if(missingCacheFunction(r.error)){cacheUnavailable=true;return [];}
     throw r.error;
    }
    return r.data;
   },
   write:async(engine,s,span,bars)=>{
    if(cacheUnavailable)return;
    const r=await admin().rpc('hootrading_cache_write',{p_engine:engine,p_symbol:s,p_span:span,p_bars:bars});
    if(r.error){if(missingCacheFunction(r.error)){cacheUnavailable=true;return;}throw r.error;}
   }
  },symbol,now,timeframe,before);
  if(cacheUnavailable)console.warn('hoo-trading market: candle cache SQL not installed; using on-demand bars (slower)');
  return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,candles:{[symbol]:page.bars},historyBefore:page.historyBefore,news:recentNews(now,5),cacheMode:cacheUnavailable?'on-demand':'persistent'},
   {headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){console.error('hoo-trading market',e);return NextResponse.json(publicError(e),{status:503,headers:{'Cache-Control':'no-store'}});}
}
