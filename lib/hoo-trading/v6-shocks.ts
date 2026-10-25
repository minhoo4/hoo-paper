/** SERVER INTERNAL. Synthetic cohorts never contain player positions, orders, balances or PnL. */
import {Random,weighted,duration,type RandomState} from './v6-random';
export const COINS=['HOO','EGG','COAL'] as const;export type Coin=typeof COINS[number];
export const SHOCK_KINDS=['news','flow','liquidity','cascade'] as const;
export type ShockKind=typeof SHOCK_KINDS[number];
export type ShockPhase='delay'|'onset'|'spread'|'aftermath';
export type ShockEvent={id:number;kind:ShockKind;scope:Coin|'common';born:number;phase:ShockPhase;remaining:number;age:number;phaseAge:number;direction:number;valence:number;severity:number;confidence:number;uncertainty:number;outcome:string|null;generation:number;exposure:Record<Coin,number>};
export type MarketInput=Record<Coin,{x:number;ret:number;vol:number;regime:string;regimeAge:number}>;
export type Impact={pressure:number;volMultiplier:number;depth:number;activity:number;stress:number};
export type ShockState={events:ShockEvent[];serial:number;excitation:number;depth:Record<Coin,number>;cohorts:Record<Coin,{longTrigger:number;shortTrigger:number;longMass:number;shortMass:number}>;rng:RandomState;dropped:number};
export type ShockDiagnostic={type:string;second:number;[key:string]:unknown};
const SIGMA={HOO:.0009,EGG:.0015,COAL:.0027};
export function initialShockState(r:Random,prices:Record<Coin,number>):ShockState{
 return {events:[],serial:0,excitation:0,depth:{HOO:1,EGG:1,COAL:1},cohorts:Object.fromEntries(COINS.map(s=>[s,{longTrigger:Math.log(prices[s])-.025,shortTrigger:Math.log(prices[s])+.025,longMass:1,shortMass:1}])) as ShockState['cohorts'],rng:r.snapshot(),dropped:0};
}
function spawn(state:ShockState,r:Random,t:number,kind:ShockKind,scope:Coin|'common',market:MarketInput,forcedDirection?:number){
 if(kind==='cascade'&&state.events.some(e=>e.kind==='cascade'&&e.scope===scope))return null;
 if(state.events.length>=12){state.dropped++;return null;}
 const valence=r.u()<.15?0:r.u()<.5?-1:1,direction=forcedDirection??(r.u()<.5?-1:1),severity=Math.exp(.8*r.n()-.32)*(r.u()<.12?3.5:.7);
 const exposure={}as Record<Coin,number>;
 for(const s of COINS){if(scope==='common')exposure[s]=({HOO:.8,EGG:1,COAL:1.25}[s])*(.65+.7*r.u())*(r.u()<.10?-1:1);else exposure[s]=s===scope?1:r.u()<({HOO:.55,EGG:.4,COAL:.25}[scope])?(.1+.5*r.u())*(r.u()<.2?-1:1):0;}
 const e:ShockEvent={id:++state.serial,kind,scope,born:t,phase:'delay',remaining:duration(r,kind==='cascade'?2:12),age:0,phaseAge:0,direction,valence,severity,confidence:.25+.7*r.u(),uncertainty:r.u(),outcome:null,generation:0,exposure};state.events.push(e);return e;
}
export function stepShocks(state:ShockState,r:Random,t:number,m:MarketInput,emit?:(e:ShockDiagnostic)=>void):Record<Coin,Impact>{
 state.excitation*=.994;const avgVol=COINS.reduce((a,s)=>a+m[s].vol,0)/3,avgDepth=COINS.reduce((a,s)=>a+state.depth[s],0)/3;
 const context=(s:Coin)=>({compression:.55,range:.7,volatile:1.5,panic:1.9}[m[s].regime]??1)*(1+.2*Math.log1p(m[s].regimeAge/1000))*(.65+.35*m[s].vol)/Math.sqrt(state.depth[s]);
 const births:{kind:ShockKind;scope:Coin|'common';direction?:number}[]=[];
 if(r.u()<.00015*(.7+.3*avgVol)*(1+state.excitation)/Math.sqrt(avgDepth))births.push({kind:weighted(r,SHOCK_KINDS,[3,2,2,1]),scope:'common'});
 for(const s of COINS){if(r.u()<({HOO:.00011,EGG:.00018,COAL:.00028}[s])*context(s)*(1+state.excitation*.7))births.push({kind:weighted(r,SHOCK_KINDS,[3,3,2,1]),scope:s});
  // Causal synthetic cohort barriers move only after observed previous prices cross them.
  const c=state.cohorts[s];c.longMass+=.002*(1-c.longMass);c.shortMass+=.002*(1-c.shortMass);const down=m[s].x<c.longTrigger,up=m[s].x>c.shortTrigger;
  if(down||up){const mass=down?c.longMass:c.shortMass;if(r.u()<Math.min(.25,.035*mass/Math.sqrt(state.depth[s])))births.push({kind:'cascade',scope:s,direction:down?-1:1});c.longTrigger=m[s].x-(.012+.04*r.u());c.shortTrigger=m[s].x+(.012+.04*r.u());if(down)c.longMass*=.2;else c.shortMass*=.2;}
 }
 for(const b of births){const e=spawn(state,r,t,b.kind,b.scope,m,b.direction);if(e){state.excitation+=.06;emit?.({type:'shock_birth',second:t,id:e.id,kind:e.kind,scope:e.scope,severity:e.severity,valence:e.valence});}}
 const output=Object.fromEntries(COINS.map(s=>[s,{pressure:0,volMultiplier:1,depth:state.depth[s],activity:1,stress:0}])) as Record<Coin,Impact>;
 for(const e of state.events){e.age++;e.phaseAge++;
  if(--e.remaining<=0){const previous=e.phase;
   if(e.phase==='delay'){
    e.phase='onset';e.remaining=duration(r,12+18*e.severity);
    if(e.kind==='news'){const sameTrend=e.scope==='common'?0:Math.sign(m[e.scope].ret)*e.valence;const alignedProb=.55+.18*e.confidence-.13*e.uncertainty-.08*sameTrend;e.direction=e.valence?(r.u()<alignedProb?e.valence:-e.valence):(r.u()<.5?-1:1);}
   }else if(e.phase==='onset'){
    if(r.u()<.12){e.outcome='early_dissipation';e.phase='aftermath';e.remaining=duration(r,10);}
    else{e.phase='spread';e.remaining=duration(r,60+35*e.severity);if(r.u()<.16)e.direction*=-1;}
   }else if(e.phase==='spread'){
    e.phase='aftermath';e.outcome=weighted(r,['v_recovery','slow_recovery','range','failed_recovery','aftershock','trend_reversal','volatile_only'],[1.2*avgDepth,1.4,1.1,1.2/avgDepth,1+state.excitation,1,1.1*avgVol]);e.remaining=duration(r,e.outcome==='v_recovery'?20:e.outcome==='slow_recovery'?220:90);
   }else{emit?.({type:'shock_end',second:t,id:e.id,kind:e.kind,scope:e.scope,outcome:e.outcome,duration:e.age,generation:e.generation});e.remaining=-1;continue;}
   e.phaseAge=0;emit?.({type:'shock_phase',second:t,id:e.id,kind:e.kind,scope:e.scope,from:previous,phase:e.phase,outcome:e.outcome,direction:e.direction,valence:e.valence,severity:e.severity,exposure:e.exposure});
  }
  if(e.phase==='delay')continue;
  let flow=e.direction,pressureScale=e.phase==='onset'?.12:e.phase==='spread'?.055:.04,stress=e.severity*Math.exp(-e.phaseAge/(40+20*Math.sqrt(e.severity)));
  if(e.phase==='aftermath'){
   if(e.outcome==='v_recovery'){flow*=-1;pressureScale=.14;}else if(e.outcome==='slow_recovery'){flow*=-1;pressureScale=.025;}else if(e.outcome==='trend_reversal')flow*=-1;
   else if(e.outcome==='failed_recovery')flow*=e.phaseAge<10?-1:1;
   else if(e.outcome==='aftershock'){pressureScale=.09;stress*=1.3;}
   else{flow=0;stress*=e.outcome==='volatile_only'?.9:.25;}
   // Dissipation depends on elapsed phase, not on return to any pre-shock price.
   stress*=Math.exp(-e.phaseAge/160);
  }
  if(e.kind==='cascade'&&e.phase==='spread'&&e.generation<4){const s=e.scope==='common'?'HOO':e.scope;if(e.direction*m[s].ret>SIGMA[s]&&r.u()<.025/Math.sqrt(state.depth[s])){e.generation++;e.severity*=.9+.45*r.u();e.remaining+=duration(r,8);emit?.({type:'cascade_secondary',second:t,id:e.id,scope:e.scope,generation:e.generation});}else if(r.u()<.003){e.remaining=1;if(r.u()<.4)e.direction*=-1;}}
  for(const s of COINS){let exposure=e.exposure[s];if(e.scope!==s&&e.scope!=='common'&&e.phase==='onset'&&e.phaseAge<5)exposure=0;if(!exposure)continue;const o=output[s],impact=stress*Math.abs(exposure);
   o.stress+=impact;o.activity+=impact*(e.kind==='flow'?1.4:1);
   const liquidityLoss=e.kind==='liquidity'?.22:e.kind==='cascade'?.08:.025;
   o.depth*=Math.exp(-liquidityLoss*impact/12);
   // Virtual depth influences synthetic order impact. Live slippage policy is unchanged.
   o.pressure+=flow*exposure*SIGMA[s]*stress*pressureScale/Math.sqrt(Math.max(.08,state.depth[s]));
  }
 }
 state.events=state.events.filter(e=>e.remaining>=0);
 for(const s of COINS){const o=output[s];state.depth[s]=Math.max(.08,Math.min(3,o.depth+.03*(1-o.depth)));o.depth=state.depth[s];o.volMultiplier=Math.sqrt(1+o.stress*.35)/Math.sqrt(Math.max(.25,o.depth));o.activity=Math.max(.1,o.activity);}
 state.rng=r.snapshot();return output;
}
export function publicShockNotice(e:ShockDiagnostic){
 if(e.type!=='shock_phase'||e.phase!=='onset')return null;
 return {id:e.id,second:e.second,simulated:true as const,category:e.kind,scope:e.scope,headline:e.kind==='news'?'가상 정보 이벤트':e.kind==='flow'?'가상 주문 압력 변화':e.kind==='liquidity'?'가상 유동성 변화':'가상 레버리지 집단 압력'};
}
