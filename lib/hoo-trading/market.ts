/** Server-only deterministic HOO WORLD market. Never import in a client component. */
import { createHmac } from 'node:crypto';

export type SymbolCode = 'HOO' | 'EGG' | 'COAL';
export type MarketBar = { t:number; open:number; high:number; low:number; close:number; volume:number };
export type MarketNews = { id:string; second:number; symbol:SymbolCode; headline:string; sentiment:'호재'|'악재'; effect:number };
export const SYMBOLS: SymbolCode[] = ['HOO','EGG','COAL'];
export const PRICE_START: Record<SymbolCode,number> = { HOO:100, EGG:20, COAL:0.005 }; // 1TC = ₩10,000
export const BASE_EPOCH = Math.floor(Date.parse(process.env.HOO_MARKET_EPOCH_UTC || '2026-10-19T00:00:00.000Z') / 1000);
export const TIMESPANS = [1,5,15,60,240,1440] as const; // simulated minute bars in real seconds
const SECRET = process.env.HOO_MARKET_SECRET;
// Compatibility ONLY for history recorded before the private-seed cutover.
// Existing production quotes were generated with this older public seed.
// Never use it to generate post-activation stochastic market prices.
const LEGACY_HISTORY_SEED = 'hoo-world-shared-2026-v1-constant-market-seed';
const legacyCache = new Map<string,number>();
function legacyUnit(key:string,index:number):number {
 const cacheKey=key+'|'+index;
 const hit=legacyCache.get(cacheKey);if(hit!==undefined)return hit;
 const h=createHmac('sha256',LEGACY_HISTORY_SEED).update(cacheKey).digest();
 const value=h.readUInt32BE(0)/4294967296;
 if(legacyCache.size>30000)legacyCache.clear();
 legacyCache.set(cacheKey,value);
 return value;
}
function validateConfiguration(){
 if(!SECRET || SECRET==='hoo-world-shared-2026-v1-constant-market-seed')throw new Error('MARKET_SECRET_REQUIRED: preserve the existing private secret; do not rotate on an active market');
 if(!Number.isFinite(BASE_EPOCH))throw new Error('INVALID_MARKET_EPOCH');
 if(rawActivation && !Number.isFinite(parsedActivation))throw new Error('INVALID_MARKET_ACTIVATION');
}
const cache = new Map<string,number>();
function unit(key:string, index:number):number {
  const cacheKey = key+'|'+index;
  const hit=cache.get(cacheKey); if(hit!==undefined) return hit;
  validateConfiguration();
  const h=createHmac('sha256',SECRET!).update(cacheKey).digest();
  const n=h.readUInt32BE(0)/4294967296;
  if(cache.size>30000) cache.clear();
  cache.set(cacheKey,n); return n;
}
const ease=(x:number)=>x*x*(3-2*x);
function valueNoise(key:string,t:number,period:number,legacy=false):number {
  const a=Math.floor(t/period), f=ease(t/period-a);
  const sample=legacy?legacyUnit:unit;
  return ((1-f)*sample(key,a)+f*sample(key,a+1))*2-1;
}
function noiseMix(key:string,t:number,legacy=false):number {
  return .29*valueNoise(key+':a',t,15,legacy)+.27*valueNoise(key+':b',t,61,legacy)
    +.25*valueNoise(key+':c',t,247,legacy)+.24*valueNoise(key+':d',t,1463,legacy)
    +.17*valueNoise(key+':e',t,8369,legacy);
}
const newsTemplates: Record<SymbolCode,{good:string[];bad:string[]}> = {
  HOO:{good:['후코인 생태계 이용량 증가','후월드 축제 수요 확대','후코인 시장 신규 참여 증가'],bad:['후코인 대규모 매도 관측','후월드 유동성 감소 우려','후코인 시장 투자 심리 위축']},
  EGG:{good:['계란코인 신규 부화 프로젝트 공개','계란코인 개발 업데이트 호평','계란코인 거래 수요 증가'],bad:['계란코인 네트워크 지연 소식','계란코인 성장 전망 하향','계란코인 거래량 둔화']},
  COAL:{good:['석탄 광산 채굴량 감소 전망','석탄코인 커뮤니티 유행 확산','석탄코인 공급 축소 루머'],bad:['석탄 광산 증산 소식','석탄코인 투기 과열 경고','석탄코인 대형 보유자 매도 루머']}
};
/** Every simulated game day spans 1,440 real-world seconds. */
function dayEvents(day:number,legacy=false):MarketNews[] {
  const sample=legacy?legacyUnit:unit;
  return [0,1,2].map((i)=>{
    const s=SYMBOLS[Math.floor(sample('event-symbol:'+i,day)*3)];
    const good=sample('event-good:'+i,day)>.5;
    const source=good?newsTemplates[s].good:newsTemplates[s].bad;
    const title=source[Math.floor(sample('event-title:'+i,day)*source.length)];
    const at = day*1440+135+i*420+Math.floor(sample('event-offset:'+i,day)*60);
    const sign=good?1:-1;
    return {id:`${day}-${i}`, second:at, symbol:s, headline:title, sentiment:good?'호재':'악재',effect:sign*(.009+sample('event-effect:'+i,day)*.017)};
  });
}
export function recentNews(nowSecond:number, count=6):MarketNews[] {
  const now=Math.max(0,nowSecond-BASE_EPOCH);
  const day=Math.floor(now/1440);
  const eventsAt=(d:number)=>{
    if(V4_ACTIVATION_SECOND===null)return dayEvents(d,true);
    return [...dayEvents(d,true).filter(x=>x.second+BASE_EPOCH<=V4_ACTIVATION_SECOND),
      ...dayEvents(d).filter(x=>x.second+BASE_EPOCH>V4_ACTIVATION_SECOND)];
  };
  const all=[...eventsAt(day-1),...eventsAt(day)]
    .filter(x=>x.second>=0 && x.second<=now)
    .map(x=>({...x,second:x.second+BASE_EPOCH}));
  return all.sort((a,b)=>b.second-a.second).slice(0,count);
}
function eventPressure(symbol:SymbolCode,t:number,legacy=false):number {
  const day=Math.floor(t/1440);
  let pressure=0;
  for (const d of [day-1,day]) for(const e of dayEvents(d,legacy)) {
    const dt=t-e.second;
    if(dt>=0 && dt<780) {
      const shock=e.symbol===symbol?e.effect:e.symbol==='HOO'&&symbol==='EGG'?e.effect*.22:0;
      pressure+=shock*(1-Math.exp(-dt/30))*Math.exp(-dt/390);
    }
  }
  return pressure;
}
function legacyLogLevel(symbol:SymbolCode,t:number):number {
  const volatility={HOO:.05,EGG:.085,COAL:.24}[symbol];
  const common=noiseMix('common',t,true);
  const local=noiseMix('coin:'+symbol,t,true);
  const longTrend=.45*valueNoise('drift:'+symbol,t,17293,true)+.22*valueNoise('macro',t,47339,true);
  const regime=.85+.5*(valueNoise('volregime',t,4500,true)+1)/2;
  return volatility * regime * (1.05*common+1.65*local+longTrend)+eventPressure(symbol,t,true);
}

function legacyPriceAt(symbol:SymbolCode,absSecond:number):number {
  const t=Math.max(0,Math.floor(absSecond)-BASE_EPOCH);
  const delta=legacyLogLevel(symbol,t)-legacyLogLevel(symbol,0);
  return PRICE_START[symbol]*Math.exp(Math.max(-6,Math.min(6,delta)));
}

/*
 * HOO MARKET V4 — path-coherent stochastic sandbox (not real order flow).
 * Long-run anchored random walks produce persistent trends rather than a
 * mean-reverting static price range. 60-second knots and 20 interior microticks
 * produce continuous OHLC structure. Regimes drive volatility/volume.
 * All entropy stays server-side under HOO_MARKET_SECRET.
 *
 * MIGRATION: unless HOO_MARKET_V4_ACTIVATION_UTC is explicitly set, the
 * production market continues using the legacy prices. Do not activate with
 * outstanding positions without a planned rollover and liquidation audit.
 */
const rawActivation=process.env.HOO_MARKET_V4_ACTIVATION_UTC;
const parsedActivation=rawActivation ? Date.parse(rawActivation) : NaN;
export const V4_ACTIVATION_SECOND = Number.isFinite(parsedActivation)
  ? Math.max(BASE_EPOCH,Math.floor(parsedActivation/1000)) : null;

const gaussianMemo=new Map<string,number>();
function gaussian(key:string):number {
  const hit=gaussianMemo.get(key); if(hit!==undefined)return hit;
  const u=Math.max(1e-10,unit('gaussian-a:'+key,0));
  const v=unit('gaussian-b:'+key,0);
  const x=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  if(gaussianMemo.size>65000)gaussianMemo.clear();
  gaussianMemo.set(key,x);
  return x;
}
// Interval-conditioned Brownian walk: random-access O(log time), no path reset.
const SUPER_BITS=24;
const SUPER_LENGTH=2**SUPER_BITS;
const walkMemo=new Map<string,number>();
function walkInside(key:string,block:number,index:number):number {
  if(index<=0)return 0;
  const memoKey=key+'|'+block+'|'+index;
  const cached=walkMemo.get(memoKey);
  if(cached!==undefined)return cached;
  const prefix=key+':block:'+block;
  let left=0,right=SUPER_LENGTH,first=0;
  let last=gaussian(prefix+':end')*Math.sqrt(SUPER_LENGTH);
  while(right-left>1){
    const mid=(left+right)/2;
    const midVal=(first+last)*.5+Math.sqrt((right-left)/4)*gaussian(prefix+':mid:'+left+':'+right);
    if(index<=mid){right=mid;last=midVal;}
    else{left=mid;first=midVal;}
  }
  const value=index===right?last:first;
  if(walkMemo.size>100000)walkMemo.clear();
  walkMemo.set(memoKey,value);
  return value;
}
const offsetMemo=new Map<string,{block:number;sum:number}>();
function randomWalk(key:string,t:number):number {
  if(t<=0)return 0;
  const index=Math.floor(t);
  const block=Math.floor(index/SUPER_LENGTH),inside=index-block*SUPER_LENGTH;
  // Practical epochs require very few 32-year superblocks at hour knots.
  const last=offsetMemo.get(key)||{block:0,sum:0};
  let offset=last.sum;
  if(last.block>block){offset=0;for(let i=0;i<block;i++)offset+=gaussian(key+':block:'+i+':end')*Math.sqrt(SUPER_LENGTH);}
  else for(let i=last.block;i<block;i++)offset+=gaussian(key+':block:'+i+':end')*Math.sqrt(SUPER_LENGTH);
  offsetMemo.set(key,{block,sum:offset});
  return offset+walkInside(key,block,inside);
}
function lerpWalk(key:string,t:number,period:number):number {
  const u=Math.max(0,t/period),index=Math.floor(u),f=u-index;
  const a=randomWalk(key,index),b=randomWalk(key,index+1);
  return a+(b-a)*f;
}
function smallBrownian(key:string,segment:number,index:number):number {
  if(index<=0)return 0;
  const name=key+':seg:'+segment;
  let l=0,r=64,a=0,b=8*gaussian(name+':end');
  while(r-l>1){
    const m=(l+r)/2,mid=(a+b)/2+Math.sqrt((r-l)/4)*gaussian(name+':'+l+':'+r);
    if(index<=m){r=m;b=mid;}else{l=m;a=mid;}
  }
  return b;
}
function regimeLevel(key:string,t:number):number {
  const a=valueNoise('regime:'+key,t,175);
  const b=valueNoise('regime2:'+key,t,1380);
  return Math.min(2.65,Math.max(.55,1.05+.82*Math.max(0,a)+.42*b));
}
function liquidityWave(symbol:SymbolCode,t:number):{volumeBoost:number;logImpact:number}{
  const block=Math.floor(t/300),phase=t-block*300;
  let boost=0,impact=0;
  for(const b of [block-1,block,block+1]){
    if(b<0||unit('liquidity-event:'+symbol,b)>.21)continue;
    const center=b*300+55+190*unit('liquidity-center:'+symbol,b);
    const width=8+13*unit('liquidity-duration:'+symbol,b);
    const d=(t-center)/width;
    if(Math.abs(d)>4)continue;
    const envelope=Math.exp(-d*d);
    boost+=(3.4+5.8*unit('liquidity-size:'+symbol,b))*envelope;
    const direction=unit('liquidity-direction:'+symbol,b)>.5?1:-1;
    const scale={HOO:.006,EGG:.011,COAL:.029}[symbol];
    // A transient order-flow shock is shared by everyone, never user-targeted.
    impact+=direction*scale*envelope*(.5+unit('liquidity-strength:'+symbol,b));
  }
  return {volumeBoost:boost,logImpact:impact};
}
const VOL={
  HOO:{macro:.0185,hour:.0066,micro:.00095,baseVol:1650},
  EGG:{macro:.028,hour:.011,micro:.00155,baseVol:810},
  COAL:{macro:.058,hour:.024,micro:.0031,baseVol:240}
} as const;
function v4LogLevel(symbol:SymbolCode,t:number):number {
  if(t<=0)return 0;
  const config=VOL[symbol];
  // Persistent 9-hour and 1-hour market waves: price is no longer bounded
  // to a static band as in the previous noiseMix() model.
  const macro=config.macro*(.77*lerpWalk('macro:common',t,540)+.68*lerpWalk('macro:'+symbol,t,540));
  const hourly=config.hour*(.73*lerpWalk('hour:common',t,60)+.71*lerpWalk('hour:'+symbol,t,60));
  const seg=Math.floor(t/60),phase=t-seg*60;
  const p=Math.floor(phase);
  const bridge=(key:string)=>{
    const at=smallBrownian(key,seg,p)-(p/60)*smallBrownian(key,seg,60);
    return at;
  };
  const micro=config.micro*regimeLevel(symbol,t)*(.70*bridge('micro:common')+.74*bridge('micro:'+symbol));
  return macro+hourly+micro+eventPressure(symbol,t)+liquidityWave(symbol,t).logImpact;
}
function v4Relative(symbol:SymbolCode,relativeSecond:number):number {
  return v4LogLevel(symbol,relativeSecond)-v4LogLevel(symbol,0);
}
export function priceAt(symbol:SymbolCode,absSecond:number):number {
  const s=Math.max(BASE_EPOCH,Math.floor(absSecond));
  const activation=V4_ACTIVATION_SECOND;
  if(activation!==null && !process.env.HOO_MARKET_SECRET)throw new Error('HOO_MARKET_SECRET must be set before V4 activation');
  if(activation===null||s<=activation)return legacyPriceAt(symbol,s);
  // Continuous handover: the first V4 quote equals the preceding V1 quote.
  const baseline=legacyPriceAt(symbol,activation);
  const delta=v4Relative(symbol,s-BASE_EPOCH)-v4Relative(symbol,activation-BASE_EPOCH);
  return baseline*Math.exp(Math.max(-13,Math.min(13,delta)));
}
function volumeAt(symbol:SymbolCode,s:number,ret:number):number {
  const c=VOL[symbol],t=Math.max(0,s-BASE_EPOCH);
  const regime=regimeLevel(symbol,t);
  const motion=Math.min(4,Math.abs(ret)/(c.micro*.65));
  const noisy=.66+1.02*unit('liquidity:'+symbol,s);
  const activity=Math.max(.25,.68+.42*motion+.62*(regime-1));
  // Clustered liquidity pulses: isolated volume bursts remain visible after
  // aggregating 1/15/60-minute candlesticks.
  const burst=liquidityWave(symbol,t).volumeBoost;
  let eventExtra=0;
  for(const e of recentNews(s,4))if(e.symbol===symbol && s-e.second<95)eventExtra+=2.5*Math.exp(-(s-e.second)/65);
  return Math.max(5,Math.round(c.baseVol*noisy*(activity+burst+eventExtra)));
}
function v4SecondBar(symbol:SymbolCode,absSecond:number):MarketBar {
  const s=Math.max(BASE_EPOCH+1,Math.floor(absSecond));
  const open=priceAt(symbol,s-1),close=priceAt(symbol,s);
  const logOpen=Math.log(open), logClose=Math.log(close);
  const length=20;
  const sigma=VOL[symbol].micro*regimeLevel(symbol,s-BASE_EPOCH)*.74;
  let cumulative=0;
  const increments:number[]=[];
  for(let i=0;i<length;i++){
    const g=gaussian('subtick:'+symbol+':'+s+':'+i);
    const step=g*Math.min(.006,sigma)/Math.sqrt(length);
    increments.push(step);
    cumulative+=step;
  }
  const finalDrift=cumulative;
  let path=0,high=Math.max(open,close),low=Math.min(open,close);
  for(let i=0;i<length;i++){
    path+=increments[i];
    const f=(i+1)/length;
    const sub=Math.exp(logOpen+(logClose-logOpen)*f+path-finalDrift*f);
    high=Math.max(high,sub);low=Math.min(low,sub);
  }
  return {t:s,open,close,high,low,volume:volumeAt(symbol,s,logClose-logOpen)};
}
export function secondBar(symbol:SymbolCode,absSecond:number):MarketBar {
  if(V4_ACTIVATION_SECOND===null||Math.floor(absSecond)<=V4_ACTIVATION_SECOND){
    return legacySecondBar(symbol,absSecond);
  }
  return v4SecondBar(symbol,absSecond);
}
function legacySecondBar(symbol:SymbolCode,absSecond:number):MarketBar {
  const s=Math.max(BASE_EPOCH+1,Math.floor(absSecond));
  const open=legacyPriceAt(symbol,s-1),close=legacyPriceAt(symbol,s);
  const volatility={HOO:.00032,EGG:.00053,COAL:.00125}[symbol];
  const up=legacyUnit('wick-up:'+symbol,s)*volatility,down=legacyUnit('wick-down:'+symbol,s)*volatility;
  const volumeBase={HOO:200,EGG:120,COAL:90}[symbol],magnitude=Math.abs(close/open-1);
  const elapsed=s-BASE_EPOCH,burstId=Math.floor(elapsed/50);
  const active=legacyUnit('volume-burst:'+symbol,burstId)>.88;
  const distance=((elapsed%50)-25)/6.5;
  const burst=active?(7+legacyUnit('volume-burst-size:'+symbol,burstId)*7)*Math.exp(-distance*distance):0;
  const activity=.09+.33*legacyUnit('volume:'+symbol,s)+Math.min(1.4,magnitude*32);
  return {t:s,open,close,high:Math.max(open,close)*(1+up),low:Math.max(.00000001,Math.min(open,close)*(1-down)),volume:Math.max(1,Math.round(volumeBase*(activity+burst)))};
}
/** Exact hierarchy: no subsampling, no volume extrapolation. Cache only closed buckets. */
const aggregateCache=new Map<string,MarketBar>();
const CHILD:Record<number,number>={5:1,15:5,60:15,240:60,1440:240};
function mergeBars(bars:MarketBar[],t:number):MarketBar {
 return {t,open:bars[0].open,close:bars[bars.length-1].close,
  high:Math.max(...bars.map(b=>b.high)),low:Math.min(...bars.map(b=>b.low)),
  volume:bars.reduce((sum,b)=>sum+b.volume,0)};
}
function aggregate(symbol:SymbolCode,start:number,span:number,end:number):MarketBar {
 const stop=Math.min(start+span,end),key=`${symbol}:${start}:${span}`;
 const full=stop===start+span;
 const hit=full?aggregateCache.get(key):undefined;
 if(hit)return hit;
 let result:MarketBar;
 if(span===1)result={...secondBar(symbol,start+1),t:start};
 else {
  const child=CHILD[span],bars:MarketBar[]=[];
  for(let t=start;t<stop;t+=child)bars.push(aggregate(symbol,t,child,stop));
  result=mergeBars(bars,start);
 }
 if(full && span>=15){
  if(aggregateCache.size>=50000)aggregateCache.delete(aggregateCache.keys().next().value!);
  aggregateCache.set(key,result);
 }
 return result;
}
export function chart(symbol:SymbolCode,now:number,span:number,limit=78):MarketBar[] {
 validateConfiguration();
 if(!SYMBOLS.includes(symbol)||!TIMESPANS.includes(span as typeof TIMESPANS[number]))throw new Error('unsupported chart');
 if(!Number.isFinite(now)||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('invalid chart range');
 const current=Math.max(BASE_EPOCH+1,Math.floor(now));
 const lastStart=BASE_EPOCH+Math.floor((current-BASE_EPOCH-1)/span)*span;
 const out:MarketBar[]=[];
 for(let b=Math.max(BASE_EPOCH,lastStart-(limit-1)*span);b<=lastStart;b+=span)out.push(aggregate(symbol,b,span,current));
 return out;
}
export function marketSecond():number { validateConfiguration(); return Math.max(BASE_EPOCH+1,Math.floor(Date.now()/1000)); }
