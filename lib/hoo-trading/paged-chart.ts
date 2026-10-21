import { createHmac } from 'node:crypto';
import { BASE_EPOCH, V4_ACTIVATION_SECOND, chart, type MarketBar, type SymbolCode } from './market';
// Cache namespace changes if the price-generating configuration changes. Never expose the secret.
export function marketCacheIdentity():string {
 const secret=process.env.HOO_MARKET_SECRET;
 if(!secret||secret==='hoo-world-shared-2026-v1-constant-market-seed')throw new Error('MARKET_SECRET_REQUIRED');
 return createHmac('sha256',secret).update(`hoo-path-v4-1:${BASE_EPOCH}:${V4_ACTIVATION_SECOND}`).digest('hex');
}
export type CandleCache={read:(engine:string,symbol:SymbolCode,span:number,starts:number[])=>Promise<MarketBar[]>;write:(engine:string,symbol:SymbolCode,span:number,bars:MarketBar[])=>Promise<void>};
/** At most 1,440 minute samples on a miss. Older pages load independently of live prices. */
export async function chartPage(cache:CandleCache,symbol:SymbolCode,now:number,span:number,before?:number){
 const end=before===undefined?now:before;
 if(!Number.isSafeInteger(end)||end>now||end<=BASE_EPOCH)throw new Error('INVALID_CHART_CURSOR');
 if(before!==undefined&&(before-BASE_EPOCH)%span!==0)throw new Error('INVALID_CHART_CURSOR');
 const limit=Math.min(78,Math.max(1,Math.floor(1440/span)));
 const last=BASE_EPOCH+Math.floor((end-BASE_EPOCH-1)/span)*span;
 const starts:number[]=[];for(let t=Math.max(BASE_EPOCH,last-(limit-1)*span);t<=last;t+=span)starts.push(t);
 const engine=marketCacheIdentity(),stored=await cache.read(engine,symbol,span,starts);
 const cached=new Map(stored.map(b=>[b.t,b])),bars:MarketBar[]=[],persist:MarketBar[]=[];
 for(const t of starts){
  const complete=t+span<=end;
  let bar=complete?cached.get(t):undefined;
  if(!bar){bar=chart(symbol,Math.min(t+span,end),span,1)[0];if(complete)persist.push(bar);}
  bars.push(bar);
 }
 if(persist.length)await cache.write(engine,symbol,span,persist);
 return {bars,historyBefore:starts[0]>BASE_EPOCH?starts[0]:null,complete:starts[0]===BASE_EPOCH};
}
