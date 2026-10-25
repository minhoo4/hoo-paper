import { NextResponse } from 'next/server';
import { admin } from '../../../../lib/hoo-trading/server';
import { BASE_EPOCH, SYMBOLS, TIMESPANS, recentNews, type SymbolCode } from '../../../../lib/hoo-trading/market';
import { chartPage } from '../../../../lib/hoo-trading/paged-chart';
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
  const v6Mode=await admin().from('hootrading_v6_stream').select('mode').eq('id',1).maybeSingle();
  if(v6Mode.error)throw new Error('V6_SCHEMA_NOT_READY:'+v6Mode.error.message);
  if(v6Mode.data?.mode==='active'){
   if(rawBefore!==null&&(!Number.isSafeInteger(before)||before! > now))throw new Error('INVALID_CHART_CURSOR');
   const streamed=await admin().rpc('hootrading_v6_chart',{p_symbol:symbol,p_span:timeframe,p_before:before??null,p_limit:78,p_until:now});
   if(streamed.error||!streamed.data)throw new Error('V6_CHART_UNAVAILABLE:'+streamed.error?.message);
   const value=streamed.data as {bars:CachedCandle[];historyBefore:number|null;asOf:number};
   if(Number(value.asOf)!==now)throw new Error('V6_MARKET_CLOCK_CHANGED_RETRY');
   return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,candles:{[symbol]:value.bars},
    historyBefore:value.historyBefore,news:[],cacheMode:'v6-database'},
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
  return NextResponse.json({now,virtualMinute:now-BASE_EPOCH,prices,candles:{[symbol]:page.bars},historyBefore:page.historyBefore,news:recentNews(now,5),cacheMode:'memory'},
   {headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(e){console.error('hoo-trading market',e);return NextResponse.json(publicError(e),{status:503,headers:{'Cache-Control':'no-store'}});}
}
