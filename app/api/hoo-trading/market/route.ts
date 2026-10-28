import { NextResponse } from 'next/server';
import { admin } from '../../../../lib/hoo-trading/server';
import { BASE_EPOCH, SYMBOLS, TIMESPANS, recentNews, type SymbolCode } from '../../../../lib/hoo-trading/market';
import { chartPage, marketCacheIdentity } from '../../../../lib/hoo-trading/paged-chart';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/**
 * P7: Bounded per-instance cache of completed candles.
 * Does not modify market prices, positions, or Supabase data.
 */
type CachedCandle = Awaited<ReturnType<typeof chartPage>>['bars'][number];
const MAX_LOCAL_BARS = 8192;
const localCandleCache = new Map<string, CachedCandle>();
function publicError(error:unknown):{code:string;error:string}{
 const message=error instanceof Error?error.message:String(error);
 if(message.includes('MARKET_SECRET_REQUIRED')||message.includes('Missing env:'))return {code:'MARKET_CONFIG',error:'시장 서버 설정이 완료되지 않았습니다. HOO_MARKET_SECRET 및 Supabase 서버 환경변수를 확인하세요.'};
 if(message.includes('MARKET_DB_UNAVAILABLE'))return {code:'MARKET_DB_UNAVAILABLE',error:'공통 시세 DB를 읽지 못했습니다. hootrading_prices 테이블과 서버 권한을 확인하세요.'};
 if(message.includes('MARKET_NOT_READY'))return {code:'MARKET_NOT_READY',error:'공통 시장 시계와 세 종목 가격이 준비되지 않았습니다. 시장 초기화·정산 상태를 확인하세요.'};
 return {code:'MARKET_REQUEST_FAILED',error:'공통 차트를 불러오지 못했습니다. Vercel 서버 로그의 hoo-trading market 오류를 확인하세요.'};
}
/** No news-table SELECT and no dedicated browser news polling. The deterministic
 * market's existing event schedule is evaluated against its confirmed tick.
 * An unchanged event revision returns only the revision, never retransmits rows.
 * Historical chart paging intentionally does not trigger news refreshes.
 */
function newsEventPayload(now:number, previous:string|null, historical:boolean){
 if(historical)return {news:[],newsRevision:previous??'',newsChanged:false};
 const news=recentNews(now,5);
 const newsRevision=news.map(item=>item.id).join('|')||'none';
 return {newsRevision,newsChanged:previous!==newsRevision,news:previous===newsRevision?[]:news};
}
/** Read only: never show an unprocessed future mark while account liquidation lags. */
export async function GET(req:Request){
 try{
  const q=new URL(req.url).searchParams,symbol=(q.get('symbol')||'HOO') as SymbolCode,timeframe=Number(q.get('timeframe')||30);
  if(!SYMBOLS.includes(symbol)||!TIMESPANS.includes(timeframe as typeof TIMESPANS[number]))return NextResponse.json({error:'종목 또는 시간봉 오류'},{status:400});
  // Read prices and their clock in one DB query. During a transaction all three advance together.
  const {data,error}=await admin().from('hootrading_prices').select('symbol,price,tick_second');
  if(error||!data||data.length!==3)throw new Error('MARKET_DB_UNAVAILABLE');
  const now=Number(data[0].tick_second);
  if(now<BASE_EPOCH+1||data.some(x=>Number(x.tick_second)!==now))throw new Error('MARKET_NOT_READY');
  const prices=Object.fromEntries(data.map(x=>[x.symbol,Number(x.price)]));
  const rawBefore=q.get('before'),before=rawBefore===null?undefined:Number(rawBefore);
  const previousNewsRevision=q.get('newsRevision');
  if(previousNewsRevision!==null&&previousNewsRevision.length>150)return NextResponse.json({error:'뉴스 커서 오류'},{status:400});
  const newsPayload=newsEventPayload(now,previousNewsRevision,rawBefore!==null);
  // A client-confirmed clock and market context can avoid redundant chart aggregation.
  // Quotes and news revisions are still read on every existing market request.
  const rawKnownNow=q.get('knownNow'),knownNow=rawKnownNow===null?undefined:Number(rawKnownNow);
  const knownContext=q.get('knownContext');
  if((rawKnownNow!==null&&!Number.isSafeInteger(knownNow))||
     (knownContext!==null&&knownContext.length>100))
   return NextResponse.json({error:'차트 확인 커서 오류'},{status:400});
  const rawSince=q.get('since'),since=rawSince===null?undefined:Number(rawSince);
  if(rawSince!==null&&(rawBefore!==null||!Number.isSafeInteger(since)))
   return NextResponse.json({error:'차트 커서 오류'},{status:400});
  const v6Mode=await admin().from('hootrading_v6_stream').select('mode,start_second,build_digest').eq('id',1).maybeSingle();
  if(v6Mode.error)throw new Error('V6_SCHEMA_NOT_READY:'+v6Mode.error.message);
  if(v6Mode.data?.mode==='active'){
   if(rawBefore!==null&&(!Number.isSafeInteger(before)||before! > now))throw new Error('INVALID_CHART_CURSOR');
   const start=Number(v6Mode.data.start_second);
   if(!Number.isSafeInteger(start)||start>=now)throw new Error('V6_INVALID_START_SECOND');
   const buildDigest=String(v6Mode.data.build_digest??'');
   if(!/^[0-9a-f]{64}$/.test(buildDigest))throw new Error('V6_INVALID_BUILD_DIGEST');
   const chartContext=`v6:${start}:${buildDigest.slice(0,16)}`;
   // No chart RPC while the confirmed clock and V6 session stay unchanged.
   // Historical paging is never omitted.
   if(rawBefore===null&&knownNow===now&&knownContext===chartContext){
    return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,
     candles:{[symbol]:[]},historyBefore:null,...newsPayload,cacheMode:'v6-database',
     chartContext,unchanged:true,delta:true},
     {headers:{'Cache-Control':'no-store, max-age=0'}});
   }
   const latestBucket=start+Math.floor((now-start-1)/timeframe)*timeframe;
   // Require matching session: a stale cursor from a reset must not cross histories.
   const alignedSince=knownContext===chartContext&&since!==undefined&&
    since>=start&&since<=latestBucket&&(since-start)%timeframe===0;
   const newBucketCount=alignedSince?Math.floor((latestBucket-since!)/timeframe)+1:78;
   const delta=rawBefore===null&&alignedSince&&newBucketCount<=78;
   const limit=delta?Math.max(1,newBucketCount):78;
   const streamed=await admin().rpc('hootrading_v6_chart',{p_symbol:symbol,p_span:timeframe,p_before:before??null,p_limit:limit,p_until:now});
   if(streamed.error||!streamed.data)throw new Error('V6_CHART_UNAVAILABLE:'+streamed.error?.message);
   const value=streamed.data as {bars:CachedCandle[];historyBefore:number|null;asOf:number};
   if(Number(value.asOf)!==now)throw new Error('V6_MARKET_CLOCK_CHANGED_RETRY');
   return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,candles:{[symbol]:value.bars},
    historyBefore:value.historyBefore,...newsPayload,cacheMode:'v6-database',
    chartContext,unchanged:false,delta},
    {headers:{'Cache-Control':'no-store, max-age=0'}});
  }
  // The deterministic legacy generator uses a stable engine identity. Its history
  // still comes from chartPage; only an identical, confirmed tick skips aggregation.
  const chartContext=`legacy:${marketCacheIdentity().slice(0,24)}`;
  if(rawBefore===null&&knownNow===now&&knownContext===chartContext){
   return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,
    candles:{[symbol]:[]},historyBefore:null,...newsPayload,cacheMode:'memory',
    chartContext,unchanged:true,delta:true},
    {headers:{'Cache-Control':'no-store, max-age=0'}});
  }
  const page = await chartPage({
    read: async (engine, s, span, starts) => {
      const found: CachedCandle[] = [];
      for (const t of starts) {
        const key = `${engine}:${s}:${span}:${t}`;
        const bar = localCandleCache.get(key);
        if (!bar) continue;
        localCandleCache.delete(key);
        localCandleCache.set(key, bar);
        found.push({ ...bar });
      }
      return found;
    },
    write: async (engine, s, span, bars) => {
      for (const bar of bars) {
        const key = `${engine}:${s}:${span}:${bar.t}`;
        localCandleCache.delete(key);
        localCandleCache.set(key, { ...bar });
        while (localCandleCache.size > MAX_LOCAL_BARS) {
          const oldest = localCandleCache.keys().next().value;
          if (oldest === undefined) break;
          localCandleCache.delete(oldest);
        }
      }
    }
  }, symbol, now, timeframe, before);
  const modeAfter=await admin().from('hootrading_v6_stream').select('mode').eq('id',1).maybeSingle();
  if(modeAfter.error||modeAfter.data?.mode==='active')throw new Error('MARKET_MODE_CHANGED_RETRY');
  return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,candles:{[symbol]:page.bars},historyBefore:page.historyBefore,...newsPayload,cacheMode:'memory',chartContext,unchanged:false},
   {headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){console.error('hoo-trading market',e);return NextResponse.json(publicError(e),{status:503,headers:{'Cache-Control':'no-store'}});}
}
