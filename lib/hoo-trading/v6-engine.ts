/** SERVER-ONLY CANDIDATE. Never expose state/entropy/pattern labels in a public response.
 * No production activation is performed by this module. State must be durably committed with bars.
 */
import {createHash,createHmac} from 'node:crypto';
import {Random as Entropy,duration,type RandomState as EntropyState} from './v6-random';
import {stepShocks,initialShockState,type ShockState,type MarketInput} from './v6-shocks';
import {resolvePattern} from './v6-patterns';
export const ENGINE_VERSION='hoo-v6-candidate-1';
export const SYMBOLS=['HOO','EGG','COAL'] as const;
export type SymbolCode=typeof SYMBOLS[number];
export const REGIMES=['up','down','range','compression','breakout','volatile','panic','recovery'] as const;
export const PATTERNS=['ascending_triangle','bull_flag','bull_pennant','double_bottom','falling_wedge','inverse_head_shoulders','descending_triangle','bear_flag','bear_pennant','rising_wedge_continuation','rising_wedge_reversal','double_top','head_shoulders'] as const;
export type Regime=typeof REGIMES[number];export type Pattern=typeof PATTERNS[number];
export type Bar={t:number;open:number;high:number;low:number;close:number;volume:number};
export type TickBar=Bar&{path:number[]};
const FIB=[.382,.5,.618,.786];
const CONFIG={HOO:{sigma:.0009,life:6500,volume:1700,jump:.0005,rho:.55},EGG:{sigma:.0015,life:2900,volume:850,jump:.001,rho:.40},COAL:{sigma:.0027,life:1600,volume:240,jump:.0022,rho:.23}};
const SPAN=[120,720,5760];
export const CONFIG_HASH=createHash('sha256').update(JSON.stringify({version:ENGINE_VERSION,CONFIG,SPAN,FIB})).digest('hex');
type RegimeState={name:Regime;remaining:number;direction:number;age:number};
type Pivot={x:number;at:number;confirmed:number;kind:'high'|'low'};
type Episode={family:Pattern;start:number;duration:number;amplitude:number;points:number[][];lastShape:number;resolutionShape:number;resolvedAt:number;resolutionDuration:number;anchor:number;stage:'forming'|'resolved';result:string|null;direction:number;invalid:boolean};
type FibEvent={level:number;kind:string;direction:number;remaining:number;amplitude:number;elapsed:number;at:number;reference:number};
type CoinState={price:number;x:number;previousReturn:number;trendEMA:number;logVol:number;lastShock:number;regime:RegimeState;episodes:Episode[];swing:{direction:number;extreme:number;at:number;pivots:Pivot[]};nodes:{x:number;v:number}[];fib:FibEvent|null;fibCooldown:number;lastBreak:number;entropy:EntropyState};
export type Checkpoint={version:string;buildDigest:string;configHash:string;shock:ShockState;namespace:string;second:number;common:RegimeState;entropy:EntropyState;coins:Record<SymbolCode,CoinState>};
export type Diagnostic={symbol:SymbolCode;second:number;type:string;[key:string]:unknown};
const sign=(x:number)=>x<0?-1:1;
function choose<T>(rng:Entropy,values:T[],weights:number[]):T{let k=rng.u()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<values.length;i++){k-=weights[i];if(k<=0)return values[i];}return values.at(-1)!;}
function regime(r:Entropy,previous:Regime|undefined,life:number):RegimeState{
 const weights=REGIMES.map(n=>n==='up'||n==='down'?2:n==='range'?1.4:n==='panic'?.25:1);
 if(previous==='panic')weights[7]*=4;if(previous==='compression')weights[4]*=3;
 if(previous==='up')weights[0]*=1.8;if(previous==='down')weights[1]*=1.8;
 const name=choose(r,[...REGIMES],weights),factor=name==='up'||name==='down'?1:name==='range'?.55:name==='panic'?.06:.2;
 return {name,remaining:Math.max(20,Math.floor(life*factor*Math.exp(.7*r.n()-.245))),direction:name==='up'?1:name==='down'?-1:r.u()>.5?1:-1,age:0};
}
function envelope(family:Pattern,u:number):[number,number]{
 switch(family){case'ascending_triangle':return[1,-1+1.45*u];case'descending_triangle':return[1-1.45*u,-1];case'bull_pennant':case'bear_pennant':return[1-.72*u,-1+.72*u];case'falling_wedge':return[1-2*u,-1-.55*u];case'rising_wedge_continuation':case'rising_wedge_reversal':return[1+.55*u,-1+2*u];case'bull_flag':case'bear_flag':return[1-.9*u,-1-.9*u];default:return[1,-1];}
}
function makeEpisode(r:Entropy,t:number,x:number,sigma:number,span:number,rg:RegimeState,fib:FibEvent|null):Episode{
 const weights=PATTERNS.map((p,i)=>{const bullish=i<6;let w=rg.direction===(bullish?1:-1)?1.4:.8;if(fib&&fib.direction===(bullish?1:-1))w*=1.5;return w;});
 const family=choose(r,[...PATTERNS],weights),duration=Math.max(24,Math.round(span*Math.exp(.5*r.n()-.125))),amplitude=sigma*Math.sqrt(duration)*(1.2+r.u()),points:number[][]=[];
 let ys:number[];
 if(family==='double_bottom')ys=[.4,-1,.65,-.9,.55];
 else if(family==='double_top')ys=[-.4,1,-.65,.9,-.55];
 else if(family==='inverse_head_shoulders')ys=[.3,-.4,.6,-1.3,.5,-.45,.6];
 else if(family==='head_shoulders')ys=[-.3,.4,-.6,1.3,-.5,.45,-.6];
 else {const count=5+2*Math.floor(r.u()*3);ys=Array.from({length:count},(_,i)=>{const u=i/(count-1),[h,l]=envelope(family,u);return i%2?h:l;});}
 const intervals=ys.map((_,i)=>i===0?0:.65+.7*r.u()),total=intervals.reduce((a,b)=>a+b,0);let at=0;
 for(let i=0;i<ys.length;i++){at+=intervals[i];points.push([at/total,ys[i]+(r.u()-.5)*.15]);}
 const startY=points[0][1];for(const p of points)p[1]-=startY;
 const direction=PATTERNS.indexOf(family)<6?1:-1;
 return {family,start:t,duration,amplitude,points,lastShape:0,resolutionShape:0,resolvedAt:0,resolutionDuration:0,anchor:x,stage:'forming',result:null,direction,invalid:false};
}
function shape(e:Episode,u:number){const pts=e.points;let j=1;while(j<pts.length-1&&pts[j][0]<u)j++;const a=pts[j-1],b=pts[j],f=Math.max(0,Math.min(1,(u-a[0])/(b[0]-a[0])));return a[1]+(b[1]-a[1])*(f*f*(3-2*f));}
function finitePrice(x:number){const p=Math.exp(x);if(!(p>0)||!Number.isFinite(p))throw new Error('V6_NUMERIC_RANGE');return p;}
function validateCheckpoint(c:Checkpoint){
 const walk=(v:unknown)=>{if(typeof v==='number'&&!Number.isFinite(v))throw Error('V6_INVALID_CHECKPOINT_NUMBER');if(v&&typeof v==='object')for(const child of Object.values(v))walk(child);};walk(c);
 if(!Number.isSafeInteger(c.second)||!c.shock||!Array.isArray(c.shock.events)||c.shock.events.length>12||!c.entropy||!c.common||!c.coins)throw Error('V6_INVALID_CHECKPOINT');
 for(const s of SYMBOLS){const a=c.coins[s];if(!a||!(a.price>0)||Math.abs(Math.log(a.price)-a.x)>1e-10||!a.entropy||!a.regime||a.episodes.length!==3||!a.swing||a.nodes.length>16||!(c.shock.depth[s]>0))throw Error('V6_INVALID_CHECKPOINT');}
}
export class V6Engine{
 private poisoned=false;private shockRng:Entropy;private secret:string;private commonRng:Entropy;private rng:Record<SymbolCode,Entropy>;private s:Checkpoint;
 constructor(options:{buildDigest:string;secret:string;startSecond:number;prices:Record<SymbolCode,number>;checkpoint?:Checkpoint}){
  if(!/^[a-f0-9]{64}$/.test(options.buildDigest))throw new Error('V6_VERIFIED_BUILD_REQUIRED');
  if(options.secret.length<24)throw new Error('V6_PRIVATE_SECRET_REQUIRED');if(!Number.isSafeInteger(options.startSecond))throw new Error('V6_INVALID_START');
  this.secret=options.secret;const namespace=createHmac('sha256',options.secret).update(options.buildDigest+':'+CONFIG_HASH+':'+options.startSecond+':'+JSON.stringify(SYMBOLS.map(s=>options.prices[s]))).digest('hex');
  if(options.checkpoint){const c=structuredClone(options.checkpoint);validateCheckpoint(c);if(c.buildDigest!==options.buildDigest||c.version!==ENGINE_VERSION||c.configHash!==CONFIG_HASH||c.namespace!==namespace||c.second<options.startSecond)throw new Error('V6_CHECKPOINT_MISMATCH');this.s=c;}
  else{for(const symbol of SYMBOLS)if(!(options.prices[symbol]>0)||!Number.isFinite(options.prices[symbol]))throw new Error('V6_INVALID_ANCHOR');const commonRng=new Entropy(options.secret,'common');const coins={} as Record<SymbolCode,CoinState>;
   for(const symbol of SYMBOLS){const r=new Entropy(options.secret,symbol),x=Math.log(options.prices[symbol]),rg=regime(r,undefined,CONFIG[symbol].life);coins[symbol]={price:options.prices[symbol],x,previousReturn:0,trendEMA:0,logVol:0,lastShock:0,regime:rg,episodes:SPAN.map(span=>makeEpisode(r,options.startSecond,x,CONFIG[symbol].sigma,span,rg,null)),swing:{direction:0,extreme:x,at:options.startSecond,pivots:[]},nodes:[],fib:null,fibCooldown:0,lastBreak:0,entropy:r.snapshot()};}
   const sr=new Entropy(options.secret,'shock');this.s={buildDigest:options.buildDigest,shock:initialShockState(sr,options.prices),version:ENGINE_VERSION,configHash:CONFIG_HASH,namespace,second:options.startSecond,common:regime(commonRng,undefined,11000),entropy:commonRng.snapshot(),coins};}
  this.shockRng=new Entropy(this.secret,'shock',this.s.shock.rng);
  this.commonRng=new Entropy(this.secret,'common',this.s.entropy);this.rng=Object.fromEntries(SYMBOLS.map(s=>[s,new Entropy(this.secret,s,this.s.coins[s].entropy)])) as Record<SymbolCode,Entropy>;
 }
 get second(){return this.s.second;}get namespace(){return this.s.namespace;}
 checkpoint():Checkpoint{if(this.poisoned)throw new Error('V6_ENGINE_POISONED_RELOAD_COMMIT');this.s.entropy=this.commonRng.snapshot();for(const s of SYMBOLS)this.s.coins[s].entropy=this.rng[s].snapshot();return structuredClone(this.s);}
 next(onEvent?:(event:Diagnostic)=>void):Record<SymbolCode,TickBar>{if(this.poisoned)throw new Error('V6_ENGINE_POISONED_RELOAD_COMMIT');try{return this.advance(onEvent)}catch(e){this.poisoned=true;throw e;}}
 private advance(onEvent?:(event:Diagnostic)=>void):Record<SymbolCode,TickBar>{
  const t=this.s.second+1,out={} as Record<SymbolCode,TickBar>;if(!Number.isSafeInteger(t))throw new Error('V6_TIME_RANGE');
  const market=Object.fromEntries(SYMBOLS.map(symbol=>{const c=this.s.coins[symbol];return[symbol,{x:c.x,ret:c.previousReturn,vol:Math.exp(c.logVol),regime:c.regime.name,regimeAge:c.regime.age}]})) as MarketInput;
  const impacts=stepShocks(this.s.shock,this.shockRng,t,market,e=>onEvent?.(e as Diagnostic));
  if(--this.s.common.remaining<=0)this.s.common=regime(this.commonRng,this.s.common.name,11000);this.s.common.age++;
  const commonNormal=this.commonRng.n(),commonJump=this.commonRng.u()<.00012?this.commonRng.n()*.009:0;
  // The identical common noise sequence is shared by all coins; idiosyncratic ticks are independent streams.
  const commonMicro=Array.from({length:20},()=>this.commonRng.n());
  for(const symbol of SYMBOLS){const c=this.s.coins[symbol],r=this.rng[symbol],cfg=CONFIG[symbol];const emit=(event:Record<string,unknown>)=>onEvent?.({symbol,second:t,...event} as Diagnostic);
   if(--c.regime.remaining<=0||r.u()<Math.min(.003,.00015*impacts[symbol].stress)){const previous=c.regime.name;c.regime=regime(r,previous,cfg.life);emit({type:'regime',previous,name:c.regime.name,duration:c.regime.remaining});}c.regime.age++;
   const rg=c.regime,volatile=rg.name==='volatile'||rg.name==='panic',targetVol=rg.name==='compression'?-.6:rg.name==='panic'?.65:rg.name==='volatile'?.4:0;
   c.logVol=.975*c.logVol+.025*targetVol+.035*r.n()+.018*(Math.abs(c.lastShock)-.8);const sigma=cfg.sigma*Math.exp(c.logVol);const impact=impacts[symbol];
   const trendDirection=rg.name==='up'?1:rg.name==='down'?-1:rg.name==='range'||rg.name==='compression'?0:rg.direction;
   const macroDirection=this.s.common.name==='up'?1:this.s.common.name==='down'?-1:0;
   const trend=cfg.sigma*(.014*trendDirection+.008*macroDirection);let structural=0;
   for(let k=0;k<c.episodes.length;k++){let e=c.episodes[k];const age=t-e.start,u=age/e.duration;
    if(e.stage==='forming'&&(u>=1||Math.abs(c.x-e.anchor)>8*e.amplitude||r.u()<.00007*(volatile?3:1)*(1+.3*impact.stress))){
     e.stage='resolved';e.resolutionShape=e.lastShape;e.resolvedAt=t;e.resolutionDuration=duration(r,Math.max(12,e.duration*(.12+.3*r.u())));e.invalid=u<1;
     const quality=Math.exp(-Math.abs((c.x-e.anchor)-e.lastShape*e.amplitude)/Math.max(sigma*Math.sqrt(Math.max(1,age)),.0001));
     const context={familyIndex:PATTERNS.indexOf(e.family),alignment:e.direction*(trendDirection+Math.tanh(c.trendEMA/sigma)*2),duration:age,amplitude:e.amplitude,vol:Math.exp(c.logVol),stress:impact.stress,depth:impact.depth,quality,recentFailure:c.lastBreak<0};
     const resolved=resolvePattern(r,context,e.invalid);e.result=resolved.result;c.lastBreak=e.result==='breakout'||e.result==='extension'?1:-1;
     emit({type:'pattern',family:e.family,result:e.result,start:e.start,duration:age,plannedDuration:e.duration,amplitude:e.amplitude,layer:k,probabilities:resolved.probabilities,context});
    }
    if(e.stage==='forming'){const y=shape(e,Math.min(1,u));structural+=(y-e.lastShape)*e.amplitude*(k===0?.65:k===1?.32:.15);e.lastShape=y;}
    else {
     // A local structural displacement returns to zero; the underlying price is unbounded.
     // Differences telescope, preventing completed asymmetric shapes from adding permanent bias.
     const f=Math.min(1,Math.max(0,(t-e.resolvedAt)/Math.max(2,e.resolutionDuration))),smooth=f*f*(3-2*f),d=e.direction;
     const response=e.result==='breakout'?d*.65:e.result==='failed_breakout'?-d*.45:e.result==='opposite_breakout'?-d*.9:e.result==='extension'?d*1.1:e.result==='reversal'?d*Math.cos(Math.PI*f)*1.2:e.result==='fakeout'?d*Math.cos(Math.PI*f)*.9:0;
     const y=f>=1?0:e.resolutionShape*(1-smooth)+response*Math.sin(Math.PI*f);
     structural+=(y-e.lastShape)*e.amplitude*(k===0?.65:k===1?.32:.15);e.lastShape=y;
     if(f>=1)c.episodes[k]=makeEpisode(r,t,c.x,sigma,SPAN[k],rg,c.fib);
    }
   }
   let levelPressure=0;const sw=c.swing,piv=sw.pivots;
   const nodes=c.nodes;let nearest=nodes.length?nodes.reduce((a,b)=>Math.abs(a.x-c.x)<Math.abs(b.x-c.x)?a:b):null;const confluence=nearest?Math.exp(-Math.abs(nearest.x-c.x)/(sigma*8)):0;
   if(c.fibCooldown>0)c.fibCooldown--;
   if(!c.fib&&c.fibCooldown===0&&piv.length>=2){const a=piv[piv.length-2],b=piv[piv.length-1],span=b.x-a.x,d=sign(span),ratio=(b.x-c.x)/span;const j=FIB.findIndex(f=>Math.abs(ratio-f)<Math.min(.045,sigma*1.5/Math.max(Math.abs(span),sigma)));
    if(j>=0&&Math.abs(span)>sigma*5){const alignment=trendDirection*d,volfactor=Math.exp(c.logVol),weights=[1.3+.25*alignment+.4*confluence,1.1/(1+volfactor*.2),.8+.2*volfactor,1.1-.2*alignment+.15*volfactor,.8,.7+.4*Math.abs(trendDirection)];const kinds=['bounce','pause','sweep','fail','next','ignore'];const kind=choose(r,kinds,weights.map(w=>Math.max(.15,w)));c.fib={level:FIB[j],kind,direction:d,remaining:8+Math.floor(r.u()*35),amplitude:sigma*(.05+.1*r.u()),elapsed:0,at:t,reference:c.x};c.fibCooldown=60;emit({type:'fib',level:FIB[j],kind,probabilities:weights.map(w=>Math.max(.15,w)/weights.reduce((a,b)=>a+Math.max(.15,b),0)),regime:rg.name,confirmedPivots:[a.confirmed,b.confirmed],swing:[a.x,b.x],x:c.x});}
   }
   if(c.fib){const f=c.fib;f.elapsed++;if(f.kind==='bounce')levelPressure+=f.direction*f.amplitude;else if(f.kind==='sweep')levelPressure+=f.direction*f.amplitude*(f.elapsed<5?-1:1);else if(f.kind==='fail'||f.kind==='next')levelPressure-=f.direction*f.amplitude;if(--f.remaining<=0)c.fib=null;}
   if(nearest&&rg.name==='range')levelPressure+=Math.tanh((nearest.x-c.x)/(sigma*8))*sigma*.018;
   const rho=volatile?Math.min(.78,cfg.rho+.2):cfg.rho;const local=r.n(),normal=rho*commonNormal+Math.sqrt(1-rho*rho)*local;c.lastShock=normal;
   const jump=(r.u()<cfg.jump*(rg.name==='panic'?4:1)?r.n()*sigma*(3+4*r.u()):0)+commonJump*(.5+rho);
   const open=c.price,path=[open];const effectiveSigma=(c.fib?.kind==='pause'?sigma*.65:sigma)*impact.volMultiplier;const impulse=trend+structural+levelPressure+jump+impact.pressure;
   for(let j=0;j<20;j++){const n=rho*commonMicro[j]+Math.sqrt(1-rho*rho)*r.n();c.x+=impulse/20+effectiveSigma*(.35*normal/20+Math.sqrt(1-.35*.35)*n/Math.sqrt(20));path.push(finitePrice(c.x));}
   const close=path[20],ret=Math.log(close/open);const volume=Math.max(1,Math.round(cfg.volume*(.45+r.u())*(.7+Math.abs(ret)/cfg.sigma+Math.abs(jump)/cfg.sigma)*(volatile?1.4:1)*impact.activity));
   c.previousReturn=ret;c.trendEMA=.98*c.trendEMA+.02*ret;c.price=close;out[symbol]={t,open,close,high:Math.max(...path),low:Math.min(...path),volume,path};
   const threshold=Math.max(cfg.sigma*5,sigma*4);if(sw.direction===0){if(Math.abs(c.x-sw.extreme)>threshold){sw.direction=sign(c.x-sw.extreme);sw.extreme=c.x;sw.at=t;}}
   else if(sw.direction*(c.x-sw.extreme)>0){sw.extreme=c.x;sw.at=t;}
   else if(sw.direction*(sw.extreme-c.x)>threshold){piv.push({x:sw.extreme,at:sw.at,confirmed:t,kind:sw.direction>0?'high':'low'});if(piv.length>12)piv.shift();sw.direction*=-1;sw.extreme=c.x;sw.at=t;}
   for(const node of nodes)node.v*=.998;
   nearest=nodes.length?nodes.reduce((a,b)=>Math.abs(a.x-c.x)<Math.abs(b.x-c.x)?a:b):null;
   if(nearest&&Math.abs(nearest.x-c.x)<cfg.sigma*8){nearest.x=(nearest.x*nearest.v+c.x*volume)/(nearest.v+volume);nearest.v+=volume;}
   else{nodes.push({x:c.x,v:volume});if(nodes.length>16){let k=0;for(let j=1;j<nodes.length;j++)if(nodes[j].v<nodes[k].v)k=j;nodes.splice(k,1);}}
  }
  this.s.second=t;return out;
 }
}
export function aggregate(bars:Bar[],span:number,epoch:number):Bar[]{
 if(![1,5,15,60,240,1440].includes(span)||!Number.isSafeInteger(epoch))throw new Error('V6_INVALID_AGGREGATION');const out:Bar[]=[];let prev:number|undefined;
 for(const b of bars){if(prev!==undefined&&b.t!==prev+1)throw new Error('V6_MISSING_MINUTE');prev=b.t;const start=epoch+Math.floor((b.t-epoch-1)/span)*span,last=out.at(-1);if(last&&last.t===start){last.high=Math.max(last.high,b.high);last.low=Math.min(last.low,b.low);last.close=b.close;last.volume+=b.volume;}else out.push({t:start,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume});}return out;
}
