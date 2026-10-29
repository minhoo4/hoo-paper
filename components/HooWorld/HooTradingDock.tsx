'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { useCandlePan } from './useCandlePan';
import styles from './HooTradingDock.module.css';
import { RequestGate } from '../../lib/hoo-trading/contracts';
import { returnOnInitialCapital, SEASON_INITIAL_HOO } from '../../lib/hoo-trading/performance';

const R4SrDemoChart = dynamic(() => import('./R4SrDemoChart'));
const allowR4SrDemo = process.env.NODE_ENV === 'development';
type SymbolCode='HOO'|'EGG'|'COAL';
type RiskMode='percent'|'absolute';
type RiskKind='stop'|'take';
/** Display input -> absolute TC price. Server-side order/RPC contracts remain unchanged. */
function riskPriceFromInput(raw:string,entry:number,leverage:number,side:1|-1,kind:RiskKind,mode:RiskMode,anchors:number[]=[]){
 const text=raw.trim();
 if(text==='')return {price:null as number|null,error:null as string|null};
 const value=Number(text);
 if(!Number.isFinite(value)||value<0)return {price:null,error:mode==='percent'?'퍼센트는 0 이상의 숫자로 입력해주세요.':'절대가격은 0 이상의 숫자로 입력해주세요.'};
 if(value===0)return {price:null as number|null,error:null as string|null};
 if(!Number.isFinite(entry)||entry<=0||!Number.isFinite(leverage)||leverage<=0)return {price:null,error:'현재 시세를 불러오는 중입니다.'};
 // 100 in percent mode means 100% return on MARGIN, including leverage.
 const sign=(kind==='take'?side:-side);
 const price=mode==='percent'?entry*(1+sign*value/(100*leverage)):value;
 if(!Number.isFinite(price)||price<=0)return {price:null,error:'목표 가격이 0 이하가 됩니다. 유효한 양수 가격을 입력해주세요.'};
 // PostgreSQL stores TC prices to 12 decimal places. Avoid rounding a nonzero stop to zero.
 if(price<0.000000000001)return {price:null,error:'목표 가격은 최소 0.000000000001 TC 이상이어야 합니다.'};
 for(const anchor of anchors){
   if(Number.isFinite(anchor)&&anchor>0 && sign*(price-anchor)<=0){
     const direction=kind==='stop'?'손절':'익절';
     return {price:null,error:`${direction}가는 ${side===1?(kind==='stop'?'현재가보다 낮게':'현재가보다 높게'):(kind==='stop'?'현재가보다 높게':'현재가보다 낮게')} 설정해주세요.`};
   }
 }
 return {price,error:null as string|null};
}
function priceToRiskPercent(raw:number|null,entry:number,leverage:number,side:1|-1,kind:RiskKind){
 if(raw==null||!Number.isFinite(Number(raw))||!Number.isFinite(entry)||entry<=0)return '';
 const sign=kind==='take'?side:-side;
 const pct=(Number(raw)/entry-1)*sign*100*leverage;
 if(!Number.isFinite(pct)||pct<=0)return '';
 return Number(pct.toPrecision(12)).toString();
}
function priceToRiskInput(price:number|null,mode:RiskMode,entry:number,leverage:number,side:1|-1,kind:RiskKind){
 if(price==null||!Number.isFinite(Number(price))||Number(price)<=0)return '';
 return mode==='absolute'?Number(price).toString():priceToRiskPercent(price,entry,leverage,side,kind);
}
function roiAtPrice(price:number|null,entry:number,leverage:number,side:1|-1){
 return price!=null&&Number.isFinite(entry)&&entry>0?side*(price/entry-1)*leverage*100:null;
}

type Bar={t:number;open:number;high:number;low:number;close:number;volume:number};
type Position={id:string;symbol:SymbolCode;side:1|-1;leverage:number;qty:number;entry_price:number;margin_tc:number;
 stop_price:number|null;take_price:number|null;mark:number;unrealized:number;position_equity_tc:number;liquidation_price:number};
type Leader={userId:string;name:string;roi:number;profit:number};
type News={id:string;second:number;symbol:SymbolCode;headline:string;sentiment:'호재'|'악재';effect:number};
type Snapshot={receipt?:{requestId:string;committed:boolean;replayed:boolean;positionId:string|null};statePending?:boolean;market:{now:number;virtualMinute:number;prices:Record<SymbolCode,number>;candles:Record<SymbolCode,Bar[]>;news:News[]},
 walletHoo:number;totalHooEquivalent:number;account:{cash_tc:number;total_deposit_tc:number;total_withdraw_tc:number;realized_tc:number;equity_tc:number},
 positions:Position[];history:{id:number;symbol:string;action:string;side:number;net_pnl_tc:number;fill_price:number;happened_second:number}[];
 ranking:Leader[];clock:{caughtUp:boolean;remaining:number};timeframe:number;authUserId?:string};
type ReadOnlyAssets={readOnly:true;walletHoo:number;openPositions:number;account:null|{
 cash_tc:number;total_deposit_tc:number;realized_tc:number
}};
type ReadOnlyRanking={readOnly:true;ranking:Leader[];eligibleCount:number;asOf:string;authUserId:string};
// No wallet in this response. Quotes remain on the separate, existing market loop.
type MonitorPosition=Pick<Position,'id'|'symbol'|'side'|'leverage'|'qty'|'entry_price'|'margin_tc'|'stop_price'|'take_price'>;
type PositionMonitor={readOnly:true;positionMonitor:true;positions:MonitorPosition[];authUserId:string;
 account:Pick<Snapshot['account'],'cash_tc'|'total_deposit_tc'|'realized_tc'>};
const SYMBOLS:SymbolCode[]=['HOO','EGG','COAL'];
const LABELS:Record<SymbolCode,string>={HOO:'🦉 후코인',EGG:'🥚 계란코인',COAL:'🪨 석탄코인'};
const fmt=(v:number,d=2)=>Number(v||0).toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const signed=(v:number,d=2)=>(v>=0?'+':'')+fmt(v,d);
const percent=(v:number)=>signed(v,2)+'%';
function pformat(v:number){return fmt(v,v<.01?6:v<1?4:2);}
// Never turn an unknown/loading price into a false 0 TC quote.
function displayMarketPrice(value:unknown){
 const number=Number(value);
 return Number.isFinite(number)&&number>0?pformat(number):'—';
}
function getBrowserDb(){ return createClient(); }
async function requestTrading(body?:Record<string,unknown>,frame=30):Promise<Snapshot> {
 const client=getBrowserDb();
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token)throw new Error('후월드 로그인이 필요합니다.');
 const storageKey=`hoo-trading-pending-v1:${session.user.id}`;
 let payload:Record<string,unknown>|undefined;
 if(body){
   const saved=localStorage.getItem(storageKey);
   if(body.__retry){
     if(!saved)throw new Error('재확인할 요청이 없습니다.');
     payload=JSON.parse(saved);
   }else{
     if(saved)throw new Error('결과가 확인되지 않은 이전 요청이 있습니다. 마지막 요청 확인 버튼을 눌러주세요.');
     payload={...body,requestId:crypto.randomUUID(),timeframe:frame};
     // Persist BEFORE network I/O; reloads and lost responses reuse the same id.
     localStorage.setItem(storageKey,JSON.stringify(payload));
   }
 }
 const res=await fetch(`/api/hoo-trading${payload?'':`?timeframe=${frame}`}`,{
   method:payload?'POST':'GET',
   headers:{Authorization:`Bearer ${session.access_token}`,...(payload?{'Content-Type':'application/json'}:{})},
   ...(payload?{body:JSON.stringify(payload)}:{}),cache:'no-store'
 });
 const json=await res.json().catch(()=>{throw new Error('서버 응답이 불완전합니다. 마지막 요청 확인 버튼으로 결과를 확인해주세요.');});
 if(!res.ok){
   // The account RPC may be blocked by economy maintenance. The public chart remains available.
   if(res.status===423&&json.code==='ECONOMY_MAINTENANCE'){
     const maintenanceError=new Error(json.error||'경제 점검 중: 거래와 계좌 조회가 일시 중단되었습니다.');
     maintenanceError.name='EconomyMaintenance';
     throw maintenanceError;
   }
   // Explicit validation/DB rollback failures are terminal. Network and 5xx are uncertain.
   if(payload&&res.status>=400&&res.status<500)localStorage.removeItem(storageKey);
   throw new Error(`${json.error||'거래 요청 실패'}${payload?` (요청 ${payload.requestId})`:''}`);
 }
 if(payload){
   if(!json.receipt?.committed||json.receipt.requestId!==payload.requestId)throw new Error('체결 확인 기록이 없습니다. 마지막 요청 확인 버튼을 눌러주세요.');
   localStorage.removeItem(storageKey);
   // No tokens or balances shared: another tab can re-check its own position state.
   try{localStorage.setItem('hoo:trading:position-invalidation',crypto.randomUUID());}catch{}
 }
 if(!json.statePending&&(!Array.isArray(json.positions)||!json.account||!json.market))throw new Error('계좌 응답 구조가 올바르지 않습니다.');
 return {...json,authUserId:session.user.id} as Snapshot;
}

// Read only the authenticated user's wallet and account while orders are locked.
async function requestReadOnlyAssets():Promise<ReadOnlyAssets>{
 const client=getBrowserDb();
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token)throw new Error('후월드 로그인이 필요합니다.');
 const res=await fetch('/api/hoo-trading?view=assets',{
  headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'
 });
 const json=await res.json().catch(()=>({error:'잔액 조회 응답 오류'}));
 if(!res.ok)throw new Error(json.error||'잔액을 조회하지 못했습니다.');
 if(json.readOnly!==true||!Number.isSafeInteger(json.openPositions)||json.openPositions<0||
    !Number.isFinite(json.walletHoo)||json.walletHoo<0||
    (json.account!=null&&(!Number.isFinite(json.account.cash_tc)||json.account.cash_tc<0||
     !Number.isFinite(json.account.total_deposit_tc)||!Number.isFinite(json.account.realized_tc))))
  throw new Error('읽기 전용 자산 응답이 올바르지 않습니다.');
 return json as ReadOnlyAssets;
}

async function stillCurrentTradingUser(uid:string|undefined){
 if(!uid)return false;
 const {data:{session},error}=await getBrowserDb().auth.getSession();
 return !error&&session?.user.id===uid;
}

// Read-only position/account changes at most once per second WHILE a server-confirmed
// position is open. It does not fetch hoo_coin_wallets or run market catch-up.
async function requestPositionMonitor():Promise<PositionMonitor>{
 const client=getBrowserDb();
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token)throw new Error('후월드 로그인이 필요합니다.');
 const response=await fetch('/api/hoo-trading?view=position-monitor',{
  headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'
 });
 const json=await response.json().catch(()=>({error:'포지션 응답 오류'}));
 if(!response.ok)throw new Error(json.error||'포지션을 조회하지 못했습니다.');
 if(json.readOnly!==true||json.positionMonitor!==true||!Array.isArray(json.positions)||
    !json.account||!Number.isFinite(json.account.cash_tc)||!Number.isFinite(json.account.realized_tc)||
    json.positions.some((p:MonitorPosition)=>!p||typeof p.id!=='string'||!SYMBOLS.includes(p.symbol)||
     ![1,-1].includes(p.side)||!Number.isFinite(p.qty)||p.qty<=0||
     !Number.isFinite(p.entry_price)||p.entry_price<=0||!Number.isFinite(p.margin_tc)))
  throw new Error('서버 포지션 응답이 올바르지 않습니다.');
 return {...json,authUserId:session.user.id} as PositionMonitor;
}
// Read the leaderboard only when the user explicitly clicks refresh.
async function requestReadOnlyRanking():Promise<ReadOnlyRanking>{
 const client=getBrowserDb();
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token)throw new Error('랭킹 조회에 로그인이 필요합니다.');
 const response=await fetch('/api/hoo-trading?view=ranking',{
  headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'
 });
 const json=await response.json().catch(()=>({error:'랭킹 조회 응답 오류'}));
 if(!response.ok)throw new Error(json.error||'랭킹을 조회하지 못했습니다.');
 if(json.readOnly!==true||!Array.isArray(json.ranking)||!Number.isSafeInteger(json.eligibleCount)||
    json.eligibleCount<json.ranking.length||json.ranking.length>10||typeof json.asOf!=='string'||
    json.ranking.some((p:Leader)=>!p||typeof p.userId!=='string'||typeof p.name!=='string'||
      !Number.isFinite(p.roi)||!Number.isFinite(p.profit)))
  throw new Error('랭킹 응답 형식이 올바르지 않습니다.');
 return {...json,authUserId:session.user.id} as ReadOnlyRanking;
}

// HOO_CHART_STICKY_FALLBACK_V1: UI-only last *verified* OHLCV cache; never synthesize executable prices.
type LastGoodChart={key:string;bars:Bar[];savedAt:number;marketSecond:number};
type PublicMarket={now:number;virtualMinute:number;prices:Record<SymbolCode,number>;
 candles:Partial<Record<SymbolCode,Bar[]>>;news:News[];newsRevision?:string;newsChanged?:boolean;historyBefore?:number|null;cacheMode?:string;delta?:boolean;chartContext?:string;unchanged?:boolean};
// A verified pair cache is UI-only: never use OHLCV as an order execution price.
type VerifiedChartMemory={bars:Bar[];historyBefore:number|null|undefined;now:number;context:string;mode:string};
async function requestMarket(symbol:SymbolCode,frame:number,before?:number,since?:number,newsRevision?:string|null,knownNow?:number,knownContext?:string|null):Promise<PublicMarket>{
 const suffix=before!==undefined?`&before=${before}`:since!==undefined?`&since=${since}`:'';
 // News revision travels on the EXISTING quote request, never in an extra poll.
 const newsQuery=before===undefined&&newsRevision!=null?`&newsRevision=${encodeURIComponent(newsRevision)}`:'';
 // The server may avoid chart aggregation when this exact market session clock has not moved.
 const unchangedQuery=before===undefined&&knownNow!==undefined&&Number.isSafeInteger(knownNow)&&knownContext
   ?`&knownNow=${knownNow}&knownContext=${encodeURIComponent(knownContext)}`:'';
 const response=await fetch(`/api/hoo-trading/market?symbol=${symbol}&timeframe=${frame}${suffix}${newsQuery}${unchangedQuery}`,{cache:'no-store'});
 const json=await response.json().catch(()=>({error:'공통 시세 응답 오류'}));
 if(!response.ok)throw new Error(json.error||'공통 시장 접속 실패');
 return json as PublicMarket;
}
const colors={up:'#13b58e',down:'#e26671'};
const MAX_RETAINED_CANDLES=2000;
function CandleChart({bars,symbol,timeframe,onLoadOlder,hasOlder}:{
 bars:Bar[];symbol:SymbolCode;timeframe:number;onLoadOlder:()=>void;hasOlder:boolean;olderLoading:boolean;
}){
 const pan=useCandlePan(bars,78,`${symbol}:${timeframe}`,onLoadOlder,hasOlder);
 const visible=pan.visible;
 const dimension={width:760,height:320};
 const view=useMemo(()=>{
   if(!visible.length)return null;
   const high=Math.max(...visible.map(b=>Number(b.high)))*1.008;
   const low=Math.min(...visible.map(b=>Number(b.low)))*.992;
   const maximumVolume=Math.max(1,...visible.map(b=>Number(b.volume)));
   const length=Math.max(1,visible.length);
   const left=18,chartW=690;
   const y=(price:number)=>18+(high-price)/(high-low||1)*201;
   const bw=Math.min(8,(chartW/length)*.64);
   return {high,low,maximumVolume,length,left,chartW,y,bw};
 },[visible]);
 if(!view)return <div className={styles.chartEmpty}>공통 시장 차트를 불러오는 중…</div>;
 const {length,left,chartW,y,bw}=view;
 const x=(i:number)=>left+(i+.5)*chartW/length;
 return <div>
   <svg className={styles.chartSvg} viewBox={`0 0 ${dimension.width} ${dimension.height}`}
     role="img" tabIndex={0} aria-label={`${symbol} 캔들 차트와 거래량, 좌우로 드래그하거나 방향키로 과거 탐색`}
     {...pan.pointerHandlers}
     onDoubleClick={pan.goLatest}
     style={{cursor:pan.dragging?'grabbing':'grab',touchAction:'pan-y',userSelect:'none'}}>
     {[0,1,2,3,4].map(i=><g key={'g'+i}>
       <line x1="12" x2="710" y1={18+i*51} y2={18+i*51} stroke="#b3c9d7" strokeOpacity=".23"/>
       <text x="722" y={23+i*51} fontSize="12" fill="#a8bdcf">{pformat(view.high-(view.high-view.low)*i/4)}</text>
     </g>)}
     {visible.map((b,i)=>{
       const up=b.close>=b.open,c=up?colors.up:colors.down;
       const bx=x(i),candleH=Math.max(1.3,Math.abs(y(b.close)-y(b.open)));
       return <g key={b.t}>
         <line x1={bx} x2={bx} y1={y(b.high)} y2={y(b.low)} stroke={c} strokeWidth="1.3"/>
         <rect x={bx-bw/2} y={Math.min(y(b.open),y(b.close))} width={bw} height={candleH} fill={c} rx=".6"/>
         <rect x={bx-bw/2} y={286-Math.max(1,Math.min(48,Number(b.volume)/view.maximumVolume*48))}
           width={bw} height={Math.max(1,Math.min(48,Number(b.volume)/view.maximumVolume*48))} fill={c} opacity=".90"/>
       </g>;
     })}
     <line x1="12" x2="710" y1="229" y2="229" stroke="#9bb5c4" strokeOpacity=".5"/>
     <line x1="12" x2="710" y1="286" y2="286" stroke="#9bb5c4" strokeOpacity=".25"/>
     <text x="18" y="239" fontSize="11" fill="#a8bdcf">거래량</text>
     <text x="20" y="308" fontSize="11" fill="#a8bdcf">{new Date(visible[0].t*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</text>
     <text x="580" y="308" fontSize="11" fill="#a8bdcf">{pan.isLatest?'현재':'과거'} {new Date(visible[visible.length-1].t*1000).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'})}</text>
     <text x="722" y="284" fontSize="10" fill="#a8bdcf">{fmt(view.maximumVolume,0)}</text>
   </svg>
 </div>;
}

export type HooTradingDockProps={onActiveChange?:(active:boolean)=>void;buttonBottom?:number;disabled?:boolean;walletHoo?:number;onWalletHooChange?:(balance:number)=>void;onConfirmedPositionCount?:(count:number,userId:string)=>void};
/** Install ONCE in app/hoo-world/page.tsx, do not create a separate game page. */
export default function HooTradingDock({onActiveChange,buttonBottom,disabled=false,walletHoo=0,onWalletHooChange,onConfirmedPositionCount}:HooTradingDockProps){
 const [open,setOpen]=useState(false),[data,setData]=useState<Snapshot|null>(null);
 const [marketData,setMarketData]=useState<PublicMarket|null>(null);
 // The latest event-defined news remains visible between 1s quote packets.
 const [newsCache,setNewsCache]=useState<News[]|null>(null);
 const [marketError,setMarketError]=useState<string|null>(null);
 const [lastGoodChart,setLastGoodChart]=useState<LastGoodChart|null>(null);
 const [economyMaintenance,setEconomyMaintenance]=useState(false);
 const [monitorPositions,setMonitorPositions]=useState(false);
 const [monitorError,setMonitorError]=useState<string|null>(null);
 const [readOnlyAssets,setReadOnlyAssets]=useState<ReadOnlyAssets|null>(null);
 const [readOnlyAssetError,setReadOnlyAssetError]=useState<string|null>(null);
 const [readOnlyRanking,setReadOnlyRanking]=useState<ReadOnlyRanking|null>(null);
 const [rankingError,setRankingError]=useState<string|null>(null);
 const [rankingLoading,setRankingLoading]=useState(false);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [r4Demo,setR4Demo]=useState(false);
 const [symbol,setSymbol]=useState<SymbolCode>('HOO'),[frame,setFrame]=useState(30);
 const [direction,setDirection]=useState<'long'|'short'>('long');
 const [leverage,setLeverage]=useState(3),[margin,setMargin]=useState('100');
 const [stop,setStop]=useState(''),[take,setTake]=useState('');
 const [stopMode,setStopMode]=useState<RiskMode>('percent'),[takeMode,setTakeMode]=useState<RiskMode>('percent');
 const [positionTab,setPositionTab]=useState<'position'|'history'>('position');
 const [rankingExpanded,setRankingExpanded]=useState(false);
 const [working,setWorking]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
 const fetching=useRef(false),marketFetching=useRef(false),isActive=useRef(false);
 const monitorFetching=useRef(false);
 const assetEpoch=useRef(0);
 const snapshotRef=useRef<Snapshot|null>(null);
 const finalClosurePending=useRef(false);
 const activeUserId=useRef<string|null>(null),authRefreshPending=useRef(false);
 const onActiveChangeRef=useRef(onActiveChange),onWalletChangeRef=useRef(onWalletHooChange),onPositionCountRef=useRef(onConfirmedPositionCount);
 const frameRef=useRef(frame);
 onActiveChangeRef.current=onActiveChange;onWalletChangeRef.current=onWalletHooChange;onPositionCountRef.current=onConfirmedPositionCount;frameRef.current=frame;
 // 0010-C: rank reads are bounded to an opening, manual refresh, or a verified full close.
 const rankingFetching=useRef(false),rankingEpoch=useRef(0),rankingManualSeq=useRef(0);
 const rankingQueue=useRef<{key:string;epoch:number}[]>([]);
 const rankingHandled=useRef<Set<string>>(new Set());
 const previouslyOpenPositionIds=useRef<Set<string>|null>(null);
 const rankingAccount=useRef<string|null>(null);
 const lastWalletSeen=useRef<number|null>(null);
 // Last verified public prices survive coin/timeframe switches and in-flight requests.
 const lastMarketPrices=useRef<Partial<Record<SymbolCode,number>>>({});
 const newsRevisionRef=useRef<string|null>(null);
 const barsRef=useRef<Bar[]>([]),historyCursor=useRef<number|null|undefined>(undefined),historyFetching=useRef(false);
 // Reuse already verified, paged history when changing symbol or timeframe.
 const chartMemory=useRef(new Map<string,VerifiedChartMemory>());
 const chartContextRef=useRef<string|null>(null),chartLastNow=useRef<number|undefined>(undefined);
 const [chartRevalidating,setChartRevalidating]=useState(false);
 const chartEngineMode=useRef<string|null>(null),chartEngineEpoch=useRef(0);
 // Ignore stale GET responses that started before a trade was submitted.
 const gate=useRef(new RequestGate());
 const requestContext=useRef('');requestContext.current=`${open}:${symbol}:${frame}`;
 // Only actual server-confirmed positions authorize a repeating asset monitor.
 // Asset epoch blocks old responses after close/reopen; RequestGate blocks order races.
 const refresh=useCallback(async()=>{
   if(fetching.current||!isActive.current)return;
   const token=gate.current.beginRead(),epoch=assetEpoch.current;
   if(token===null)return;
   fetching.current=true;
   try{
     const next=await requestTrading(undefined,frameRef.current);
     if(!gate.current.accepts(token)||epoch!==assetEpoch.current||!isActive.current||
        !await stillCurrentTradingUser(next.authUserId))return;
     finalClosurePending.current=false;activeUserId.current=next.authUserId||null;
     snapshotRef.current=next;setData(next);setReadOnlyAssets(null);setReadOnlyAssetError(null);
     setMonitorError(null);setError(null);setEconomyMaintenance(false);
     // Never infer a flat account from missing/null data or a pending receipt.
     setMonitorPositions(Array.isArray(next.positions)&&next.positions.length>0);
     if(Array.isArray(next.positions)&&next.authUserId)onPositionCountRef.current?.(next.positions.length,next.authUserId);
     if(Number.isFinite(next.walletHoo)&&lastWalletSeen.current!==next.walletHoo){
       lastWalletSeen.current=next.walletHoo;onWalletChangeRef.current?.(next.walletHoo);
     }
   }catch(e){
     if(gate.current.accepts(token)&&epoch===assetEpoch.current&&isActive.current){
       const maintenance=e instanceof Error&&e.name==='EconomyMaintenance';
       setEconomyMaintenance(maintenance);
       // A failed final verification is NOT authorization to resume/retry endlessly.
       if(finalClosurePending.current){
         setMonitorPositions(false);
         setMonitorError('최종 정산 확인 실패. 자산 재확인 버튼으로 다시 검증해주세요.');
       }else setMonitorPositions(!maintenance&&(snapshotRef.current?.positions.length??0)>0);
       setError(maintenance?null:e instanceof Error?e.message:String(e));
       if(maintenance){
         snapshotRef.current=null;setData(null);
         try{
           const assets=await requestReadOnlyAssets();
           if(gate.current.accepts(token)&&epoch===assetEpoch.current&&isActive.current){
             setReadOnlyAssets(assets);setReadOnlyAssetError(null);
             if(lastWalletSeen.current!==assets.walletHoo){
               lastWalletSeen.current=assets.walletHoo;onWalletChangeRef.current?.(assets.walletHoo);
             }
           }
         }catch(assetError){
           if(gate.current.accepts(token)&&epoch===assetEpoch.current&&isActive.current)
             setReadOnlyAssetError(assetError instanceof Error?assetError.message:String(assetError));
         }
       }
     }
   }finally{
     fetching.current=false;
     if(authRefreshPending.current&&isActive.current){
       authRefreshPending.current=false;
       // Avoid a lost re-login refresh while the old account request was in flight.
       window.queueMicrotask(()=>{if(isActive.current)void refresh();});
     }
   }
 },[]);
 const refreshRanking=useCallback(async(reason:'entry'|'manual'|'closed'='manual',positionId?:string)=>{
   if(!isActive.current)return;
   // The refresh button is single-flight. Market ticks, unrealized P&L, and
   // partial closes never call this function.
   if(reason==='manual'&&rankingFetching.current)return;
   if(reason==='closed'&&!positionId)return;
   const key=reason==='closed'?`closed:${positionId}`:
     reason==='entry'?'entry':`manual:${++rankingManualSeq.current}`;
   if(rankingHandled.current.has(key))return;
   rankingHandled.current.add(key);
   rankingQueue.current.push({key,epoch:rankingEpoch.current});
   if(rankingFetching.current)return;
   rankingFetching.current=true;
   setRankingLoading(true);
   try{
     // A confirmed close that arrives during the initial request gets its
     // own subsequent read AFTER server confirmation; each ID is deduplicated.
     while(rankingQueue.current.length&&isActive.current){
       const task=rankingQueue.current.shift()!;
       if(task.epoch!==rankingEpoch.current)continue;
       try{
         const result=await requestReadOnlyRanking();
         if(task.epoch!==rankingEpoch.current||!isActive.current||
            !await stillCurrentTradingUser(result.authUserId))continue;
         setReadOnlyRanking(result);setRankingError(null);
       }catch(e){
         if(task.epoch===rankingEpoch.current&&isActive.current)
           setRankingError(e instanceof Error?e.message:String(e));
       }
     }
   }finally{
     rankingFetching.current=false;
     if(isActive.current)setRankingLoading(false);
   }
 },[]);
 useEffect(()=>{
   isActive.current=open;
   assetEpoch.current++;
   // A dock opening is a fresh trading visit; closing/reopening the TOP 5/10
   // UI within that visit reuses the same read-only ranking cache.
   rankingEpoch.current++;
   rankingQueue.current=[];
   rankingHandled.current.clear();
   previouslyOpenPositionIds.current=null;
   rankingAccount.current=null;
   setReadOnlyRanking(null);setRankingError(null);setRankingLoading(false);
   if(open)void refreshRanking('entry');
   onActiveChangeRef.current?.(open);
   document.documentElement.dataset.hooTrading=open?'on':'off';
   document.dispatchEvent(new CustomEvent('hoo:trading:change',{detail:{active:open}}));
   if(open)void refresh();
   else {setMonitorPositions(false);snapshotRef.current=null;setData(null);finalClosurePending.current=false;authRefreshPending.current=false;activeUserId.current=null;}
   return ()=>{
     if(open){isActive.current=false;document.documentElement.dataset.hooTrading='off';
      document.dispatchEvent(new CustomEvent('hoo:trading:change',{detail:{active:false}}));}
   };
 },[open,refresh,refreshRanking]);
 // A changed login invalidates displayed financial data and all in-flight reads.
 useEffect(()=>{
   if(!open)return;
   const {data:{subscription}}=getBrowserDb().auth.onAuthStateChange((event,session)=>{
     const uid=session?.user.id??null;
     if(event!=='SIGNED_OUT'&&event!=='SIGNED_IN')return;
     if(event==='SIGNED_IN'&&uid===activeUserId.current)return;
     if(event==='SIGNED_OUT')authRefreshPending.current=false;
     // Invalidate in-flight leaderboard responses and previous user's cache.
     const newRankingIdentity=event==='SIGNED_OUT'||
       (rankingAccount.current!==uid&&
        (rankingAccount.current!==null||!rankingHandled.current.has('entry')));
     if(newRankingIdentity){
       rankingEpoch.current++;rankingQueue.current=[];rankingHandled.current.clear();
       previouslyOpenPositionIds.current=null;
       setReadOnlyRanking(null);setRankingError(null);
       if(uid&&isActive.current)window.queueMicrotask(()=>{
         if(isActive.current)void refreshRanking('entry');
       });
     }
     // An initial SIGNED_IN notification must not cause a second entry GET.
     rankingAccount.current=uid;
     assetEpoch.current++;
     finalClosurePending.current=false;activeUserId.current=uid;
     snapshotRef.current=null;lastWalletSeen.current=null;
     setData(null);setReadOnlyAssets(null);setMonitorPositions(false);
     setMonitorError(null);setReadOnlyAssetError(null);
     if(uid&&isActive.current){
       authRefreshPending.current=true;
       // Auth callbacks must not await getSession from inside the callback.
       window.queueMicrotask(()=>{
         if(isActive.current&&!fetching.current&&authRefreshPending.current){
           authRefreshPending.current=false;void refresh();
         }
       });
     }
   });
   return()=>subscription.unsubscribe();
 },[open,refresh,refreshRanking]);
 const refreshPositionMonitor=useCallback(async()=>{
   if(!isActive.current||monitorFetching.current||fetching.current||finalClosurePending.current)return;
   const token=gate.current.beginRead(),epoch=assetEpoch.current;
   if(token===null)return;
   const previous=snapshotRef.current;
   if(!previous||previous.positions.length===0)return;
   monitorFetching.current=true;
   try{
     const next=await requestPositionMonitor();
     if(!gate.current.accepts(token)||epoch!==assetEpoch.current||!isActive.current||
        !await stillCurrentTradingUser(next.authUserId))return;
     // A committed external close or liquidation requires one FINAL full snapshot.
     if(next.authUserId)onPositionCountRef.current?.(next.positions.length,next.authUserId);
     if(next.positions.length===0){
       finalClosurePending.current=true;
       setMonitorPositions(false);
       void refresh();
       return;
     }
     // Positions may close independently. A disappearing ID is a real complete close;
     // the full snapshot also refreshes realized history/settled wallet safely.
     const currentIds=new Set(next.positions.map(p=>p.id));
     if(previous.positions.some(p=>!currentIds.has(p.id))){
       setMonitorPositions(next.positions.length>0);
       void refresh();
       return;
     }
     // Market prices are DISPLAY-ONLY quotes; never authorize trading with them.
     const quotes=lastMarketPrices.current;
     const updated:Position[]=next.positions.map(p=>{
       const old=previous.positions.find(item=>item.id===p.id);
       const market=Number(quotes[p.symbol]??old?.mark);
       const mark=Number.isFinite(market)&&market>0?market:p.entry_price;
       const unrealized=p.side*p.qty*(mark-p.entry_price);
       const position_equity_tc=Math.max(0,p.margin_tc+unrealized);
       const liquidation_price=p.side===1?(p.entry_price-p.margin_tc/p.qty)/.995:
        (p.entry_price+p.margin_tc/p.qty)/1.005;
       return {...p,mark,unrealized,position_equity_tc,liquidation_price};
     });
     const equity=next.account.cash_tc+updated.reduce((sum,p)=>sum+p.position_equity_tc,0);
     const updatedSnapshot:Snapshot={...previous,
       account:{...previous.account,...next.account,equity_tc:equity},positions:updated,
       totalHooEquivalent:previous.walletHoo+equity/1000};
     snapshotRef.current=updatedSnapshot;
     setData(updatedSnapshot);setMonitorError(null);setMonitorPositions(true);
   }catch(e){
     if(epoch===assetEpoch.current&&isActive.current)setMonitorError(e instanceof Error?e.message:String(e));
   }finally{monitorFetching.current=false;}
 },[refresh]);
 useEffect(()=>{
   if(!open||!monitorPositions||economyMaintenance)return;
   // The existing 1s PUBLIC MARKET ticker remains independent and unchanged.
   const poll=window.setInterval(()=>{
     if(document.visibilityState==='visible')void refreshPositionMonitor();
   },1000);
   return()=>window.clearInterval(poll);
 },[open,monitorPositions,economyMaintenance,refreshPositionMonitor]);
 // On resume, a single verified refresh checks whether another device changed positions.
 useEffect(()=>{
   if(!open)return;
   const resume=()=>{if(document.visibilityState==='visible'&&!monitorPositions)void refresh();};
   const fromAnotherTab=(event:StorageEvent)=>{
     if(event.key==='hoo:trading:position-invalidation'&&isActive.current)void refresh();
   };
   document.addEventListener('visibilitychange',resume);
   window.addEventListener('storage',fromAnotherTab);
   return()=>{
     document.removeEventListener('visibilitychange',resume);
     window.removeEventListener('storage',fromAnotherTab);
   };
 },[open,monitorPositions,refresh]);
 // Observe only server-confirmed snapshots. A position vanishing from this
 // ID set is a COMPLETE close; changing quantity alone is a partial close.
 // The 1-second unrealized profit updates preserve IDs and issue ZERO rank GETs.
 useEffect(()=>{
   if(!open||!data?.authUserId||economyMaintenance)return;
   if(rankingAccount.current===null)rankingAccount.current=data.authUserId;
   if(rankingAccount.current!==data.authUserId){
     rankingEpoch.current++;rankingQueue.current=[];rankingHandled.current.clear();
     rankingAccount.current=data.authUserId;previouslyOpenPositionIds.current=null;
     setReadOnlyRanking(null);setRankingError(null);
     void refreshRanking('entry');
   }
   const now=new Set(data.positions.map(p=>p.id));
   const before=previouslyOpenPositionIds.current;
   previouslyOpenPositionIds.current=now;
   if(before)for(const positionId of before){
     if(!now.has(positionId))void refreshRanking('closed',positionId);
   }
 },[open,data,economyMaintenance,refreshRanking]);
 useEffect(()=>{
   if(!open)return;
   const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
   window.addEventListener('keydown',onKey);
   return()=>window.removeEventListener('keydown',onKey);
 },[open]);
 // Cache is chart-only and clearly labelled as stale. Never use it as a live trade price.
 useEffect(()=>{
  if(!open)return;
  const key=`${symbol}:${frame}`;
  try{
   const saved=window.localStorage.getItem('hoo-v6-last-chart:'+key);
   const value=saved?JSON.parse(saved) as LastGoodChart:null;
   const valid=Boolean(value&&value.key===key&&Number.isFinite(value.savedAt)&&
    value.savedAt<=Date.now()&&Date.now()-value.savedAt<7*86400000&&
    Array.isArray(value.bars)&&value.bars.length>0&&value.bars.length<=78&&
    value.bars.every((b:Bar)=>Number.isSafeInteger(b.t)&&
      [b.open,b.high,b.low,b.close,b.volume].every(v=>Number.isFinite(v)&&v>=0)&&
      b.close>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)));
   setLastGoodChart(valid?value:null);
  }catch{setLastGoodChart(null);}
 },[open,symbol,frame]);
 const refreshMarket=useCallback(async()=>{
   // An old interval callback can fire after the next render but before effect cleanup.
   const context=`true:${symbol}:${frame}`;
   if(context!==requestContext.current||marketFetching.current||!isActive.current)return;
   marketFetching.current=true;
   // Reuse the selected chart's latest candle as a cursor. No unselected timeframes
   // are queried or precomputed for this browser.
   const since=barsRef.current.length?barsRef.current[barsRef.current.length-1].t:undefined;
   try{const next=await requestMarket(symbol,frame,undefined,since,newsRevisionRef.current,
     chartLastNow.current,chartContextRef.current);if(context!==requestContext.current)return;
     // Revision differences are the only news update trigger, including zero-news expiry.
     // Older/deployed APIs with no revision keep using the initial account snapshot.
     if(next.newsChanged===true&&typeof next.newsRevision==='string'&&Array.isArray(next.news)){
       newsRevisionRef.current=next.newsRevision;
       setNewsCache(next.news);
     }
     for(const code of SYMBOLS){
       const price=Number(next.prices?.[code]);
       if(Number.isFinite(price)&&price>0)lastMarketPrices.current[code]=price;
     }
     // Historical Legacy/V4 candles and the new V6 session must never share a
     // single plotted price axis. Clear local memory at the committed cutover.
     const nextMode=next.cacheMode||'legacy';
     const clockRewound=chartLastNow.current!==undefined&&next.now<chartLastNow.current;
     if(clockRewound||(chartEngineMode.current!==null&&chartEngineMode.current!==nextMode)||
        (chartContextRef.current!==null&&typeof next.chartContext==='string'&&
         chartContextRef.current!==next.chartContext)){
       // V6 rebase/legacy transition: never splice candles from different sessions.
       barsRef.current=[];historyCursor.current=undefined;chartEngineEpoch.current++;
     }
     chartEngineMode.current=nextMode;
     chartContextRef.current=typeof next.chartContext==='string'?next.chartContext:null;
     chartLastNow.current=next.now;
     // On network lag / session change, the server sends a fresh full page instead
     // of an incomplete delta. Do not splice disjoint historical periods together.
     if(since!==undefined&&nextMode==='v6-database'&&next.delta!==true){
       barsRef.current=[];historyCursor.current=undefined;chartEngineEpoch.current++;
     }
     const myEpoch=chartEngineEpoch.current;
     const merged=new Map(barsRef.current.map(b=>[b.t,b]));for(const b of next.candles[symbol]||[])merged.set(b.t,b);
     barsRef.current=[...merged.values()].sort((a,b)=>a.t-b.t).slice(-MAX_RETAINED_CANDLES);
     if(barsRef.current.length&&chartContextRef.current){
       chartMemory.current.set(`${symbol}:${frame}`,{bars:barsRef.current.slice(),
         historyBefore:historyCursor.current,now:next.now,context:chartContextRef.current,mode:nextMode});
     }
     setMarketData({...next,candles:{[symbol]:barsRef.current}});setMarketError(null);
     setChartRevalidating(false);
     if(nextMode==='v6-database'&&barsRef.current.length){
       const saved:LastGoodChart={key:`${symbol}:${frame}`,bars:barsRef.current.slice(-78),savedAt:Date.now(),marketSecond:next.now};
       setLastGoodChart(saved);
       try{window.localStorage.setItem('hoo-v6-last-chart:'+saved.key,JSON.stringify(saved));}catch{}
     }
     if(historyCursor.current===undefined)historyCursor.current=next.historyBefore;
     const chartMemo=chartMemory.current.get(`${symbol}:${frame}`);
     if(chartMemo)chartMemo.historyBefore=historyCursor.current;
     if(!historyFetching.current&&historyCursor.current!=null&&barsRef.current.length<78){
       historyFetching.current=true;
       void (async()=>{try{
         while(context===requestContext.current&&myEpoch===chartEngineEpoch.current&&historyCursor.current!=null&&barsRef.current.length<78){
           const older=await requestMarket(symbol,frame,historyCursor.current);
           if(context!==requestContext.current||myEpoch!==chartEngineEpoch.current)return;
           const all=new Map((older.candles[symbol]||[]).map(b=>[b.t,b]));for(const b of barsRef.current)all.set(b.t,b);
           barsRef.current=[...all.values()].sort((a,b)=>a.t-b.t).slice(-MAX_RETAINED_CANDLES);historyCursor.current=older.historyBefore;
           const memo=chartMemory.current.get(`${symbol}:${frame}`);
           if(memo){memo.bars=barsRef.current.slice();memo.historyBefore=historyCursor.current;}
           setMarketData(prev=>prev?{...prev,candles:{[symbol]:barsRef.current}}:prev);
         }
       }catch(e){if(context===requestContext.current)setMarketError(e instanceof Error?e.message:String(e));}
       finally{historyFetching.current=false;}})();
     }}
   catch(e){if(context===requestContext.current)setMarketError(e instanceof Error?e.message:String(e));}
   finally{marketFetching.current=false;}
 },[symbol,frame]);
 useEffect(()=>{
   if(!open)return;
   // Restore UI-only history for a previously visited pair. Verify its market
   // session and clock on the next public quote before marking it current.
   const saved=chartMemory.current.get(`${symbol}:${frame}`);
   barsRef.current=saved?.bars.slice()??[];historyCursor.current=saved?.historyBefore;
   chartEngineMode.current=saved?.mode??null;
   chartContextRef.current=saved?.context??null;chartLastNow.current=saved?.now;
   setChartRevalidating(Boolean(saved));
   setMarketData(previous=>previous?{...previous,candles:saved?{[symbol]:barsRef.current}:{}}:null);
   setMarketError(null);setHistoryBusy(false);
   chartEngineEpoch.current++;
   void refreshMarket();
   // Background tabs do not download candles; next visible refresh catches up.
   const ticker=window.setInterval(()=>{if(document.visibilityState==='visible')void refreshMarket();},1000);
   const onVisible=()=>{if(document.visibilityState==='visible')void refreshMarket();};
   document.addEventListener('visibilitychange',onVisible);
   return()=>{window.clearInterval(ticker);document.removeEventListener('visibilitychange',onVisible);};
 },[open,refreshMarket]);
 const loadOlder=useCallback(()=>{
   const context=`true:${symbol}:${frame}`;
   if(context!==requestContext.current||!isActive.current||historyFetching.current||historyCursor.current==null||barsRef.current.length>=MAX_RETAINED_CANDLES)return;
   historyFetching.current=true;setHistoryBusy(true);
   const cursor=historyCursor.current;
   const loadingEpoch=chartEngineEpoch.current;
   void (async()=>{
     try{
       const older=await requestMarket(symbol,frame,cursor);
       if(context!==requestContext.current||loadingEpoch!==chartEngineEpoch.current)return;
       const fresh=older.candles[symbol]||[];
       if(!fresh.length){historyCursor.current=null;return;}
       const merged=new Map(barsRef.current.map(b=>[b.t,b]));
       for(const b of fresh)merged.set(b.t,b);
       const all=[...merged.values()].sort((a,b)=>a.t-b.t);
       // Keep recent market bars and a bounded historical buffer; never alter market prices.
       barsRef.current=all.slice(-MAX_RETAINED_CANDLES);
       historyCursor.current=older.historyBefore===cursor?null:older.historyBefore;
       const memo=chartMemory.current.get(`${symbol}:${frame}`);
       if(memo){memo.bars=barsRef.current.slice();memo.historyBefore=historyCursor.current;}
       setMarketData(prev=>prev?{...prev,candles:{[symbol]:barsRef.current}}:prev);
     }catch(e){if(context===requestContext.current)setMarketError(e instanceof Error?e.message:String(e));}
     finally{historyFetching.current=false;if(context===requestContext.current)setHistoryBusy(false);}
   })();
 },[symbol,frame]);
 const submit=useCallback(async(body:Record<string,unknown>,label:string)=>{
   if(!gate.current.beginMutation())return;
   setWorking(true);setError(null);setMessage(null);
   try{
     // A GET started before this order must never replace its result.
     const next=await requestTrading(body,frame);
     if(next.statePending){setMessage('체결은 확인됐습니다. 계좌 표시를 새로 조회합니다.');return;}
     if(body.action==='open'||next.receipt?.positionId)setPositionTab('position');
     if(!await stillCurrentTradingUser(next.authUserId))return;
     activeUserId.current=next.authUserId||null;
     snapshotRef.current=next;setData(next);
     if(Array.isArray(next.positions)){
       setMonitorPositions(next.positions.length>0);
       if(next.authUserId)onPositionCountRef.current?.(next.positions.length,next.authUserId);
     }
     setMessage(next.receipt?.replayed?'기존 요청의 체결 결과를 확인했습니다.':`${label} 완료`);
     if(Number.isFinite(next.walletHoo)){lastWalletSeen.current=next.walletHoo;onWalletChangeRef.current?.(next.walletHoo);}
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{gate.current.endMutation();setWorking(false);void refresh();}
 },[frame,refresh]);
 const latestMarket=marketData&&(!data||marketData.now>=data.market.now)?marketData:data?.market;
 const market=latestMarket?{
   ...latestMarket,
   prices:{...latestMarket.prices,...lastMarketPrices.current},
   candles:marketData?.candles||data?.market.candles||{}
 }:undefined;
 const liveChartBars=market?.candles[symbol]||[];
 const rememberedBars=lastGoodChart?.key===`${symbol}:${frame}`?lastGoodChart.bars:[];
 const shownChartBars=liveChartBars.length?liveChartBars:rememberedBars;
 // The initial account snapshot's clock.caughtUp can become stale while market quotes update.
 // Only enable the controls with a sufficiently fresh, verified public market quote.
 // The server and DB must still independently validate every order.
 const orderMarketAge=marketData?.now!=null
   ?Math.floor(Date.now()/1000)-Number(marketData.now):Infinity;
 const orderMarketReady=Boolean(data&&marketData&&!marketError&&
   Number.isFinite(orderMarketAge)&&orderMarketAge>=0&&orderMarketAge<=75&&
   SYMBOLS.every(code=>Number.isFinite(Number(marketData.prices?.[code]))&&
     Number(marketData.prices?.[code])>0));
 const ageSeconds=market?.now?Math.max(0,Math.floor(Date.now()/1000)-market.now):null;
 const chartDelayed=chartRevalidating||Boolean(marketError)||(ageSeconds!==null&&ageSeconds>3)||(!liveChartBars.length&&rememberedBars.length>0);
 const livePositions=(data?.positions||[]).map(p=>{const mark=Number(market?.prices[p.symbol]??p.mark);const unrealized=Number(p.side)*Number(p.qty)*(mark-Number(p.entry_price));return {...p,mark,unrealized};});
 const liveWallet=data?.walletHoo??walletHoo;
 const verifiedCash=Number(data?.account.cash_tc||0);
 const availableTC=verifiedCash+Math.max(0,liveWallet)*1000;
 const totalSeed=verifiedCash+livePositions.reduce((sum,p)=>sum+Math.max(0,Number(p.margin_tc)+p.unrealized),0)+Math.max(0,liveWallet)*1000;
 const mark=Number(market?.prices[symbol]||0);
 const selectedPosition=data?.positions.find(p=>p.symbol===symbol);
 const addingSamePosition=Boolean(selectedPosition && selectedPosition.side===(direction==='long'?1:-1) && Number(selectedPosition.leverage)===leverage);
 // Load saved risk targets only when the selected position changes.
 // Do not overwrite inputs while the user types or prices refresh once per second.
 useEffect(()=>{
   if(!selectedPosition)return;
   const entry=Number(selectedPosition.entry_price);
   const heldLev=Number(selectedPosition.leverage);
   const heldSide=selectedPosition.side;
   setDirection(heldSide===1?'long':'short');
   setLeverage(heldLev);
   const load=(price:number|null,mode:RiskMode,kind:RiskKind,setMode:(m:RiskMode)=>void,setValue:(v:string)=>void)=>{
     // A profitable trailing stop can be on the other side of the entry price:
     // its ROI-as-LOSS is not positive. Keep the actual price instead of silently clearing it.
     const effectiveMode=mode==='percent'&&price!=null&&!priceToRiskPercent(price,entry,heldLev,heldSide,kind)?'absolute':mode;
     setMode(effectiveMode);
     setValue(priceToRiskInput(price,effectiveMode,entry,heldLev,heldSide,kind));
   };
   load(selectedPosition.stop_price,stopMode,'stop',setStopMode,setStop);
   load(selectedPosition.take_price,takeMode,'take',setTakeMode,setTake);
   // Deliberately react to position identity only, not every mark-price refresh.
   // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selectedPosition?.id]);
 const totalEq=totalSeed,deposit=Number(data?.account.total_deposit_tc||0);
 const pnl=Number(data?.account.realized_tc||0);
 // READ-ONLY fallback never enables orders. Count=0 is a verified DB query result.
 const shownWallet=data?.walletHoo??readOnlyAssets?.walletHoo;
 const shownFreeTC=data?availableTC:readOnlyAssets
   ?readOnlyAssets.walletHoo*1000+(readOnlyAssets.account?.cash_tc??0):null;
 const shownTotalTC=data?totalEq:readOnlyAssets?.openPositions===0?shownFreeTC:null;
 const shownRealized=data?pnl:readOnlyAssets?.account?.realized_tc;
 const shownDeposits=data?deposit:readOnlyAssets?.account?.total_deposit_tc;
 const shownRoi=shownRealized!=null?returnOnInitialCapital(Number(shownRealized)):null;
 const knownUnrealized=data?livePositions.reduce((sum,p)=>sum+p.unrealized,0)
   :readOnlyAssets?.openPositions===0?0:null;
  // Initial snapshot fallback; thereafter keep the last server-confirmed news revision.
  // Quote responses with no news change never erase the list.
  const newsList=newsCache??data?.market.news??[];
 // A known-empty database result differs from an unavailable ranking.
 // Deliberately ignore the ranking embedded in account snapshots: it must never
 // silently overwrite the user's manually refreshed leaderboard.
 const leaderboard=readOnlyRanking?.ranking??[];
 const rankingIsKnown=readOnlyRanking!==null;
 const riskSide:1|-1=selectedPosition?.side??(direction==='long'?1:-1);
 const riskLeverage=Number(selectedPosition?.leverage??leverage);
 // Entry estimate accounts for the same per-symbol entry slippage used by the server.
 // For existing positions we always use the *actual* entry fill price.
 const entrySlippage=symbol==='COAL'?.0007:symbol==='EGG'?.0003:.00015;
 // When adding to a position, risk % is based on the projected weighted-average entry.
 // Exact average and SL/TP are revalidated by the DB using the actual fill price.
 const marginValue=Number(margin);
 const newFillEstimate=mark*(1+riskSide*entrySlippage);
 const newQuantityEstimate=Number.isFinite(marginValue)&&marginValue>0&&newFillEstimate>0
   ? marginValue*riskLeverage/newFillEstimate : 0;
 const oldQuantity=Number(selectedPosition?.qty||0);
 const riskEntry=selectedPosition && newQuantityEstimate>0
   ? (oldQuantity*Number(selectedPosition.entry_price)+newQuantityEstimate*newFillEstimate)/(oldQuantity+newQuantityEstimate)
   : selectedPosition?Number(selectedPosition.entry_price):newFillEstimate;
 // Orders entering or scaling in must satisfy both average-entry and current-mark constraints.
 const openAnchors=[riskEntry,mark];
 const stopRisk=riskPriceFromInput(stop,riskEntry,riskLeverage,riskSide,'stop',stopMode,openAnchors);
 const takeRisk=riskPriceFromInput(take,riskEntry,riskLeverage,riskSide,'take',takeMode,openAnchors);
 const stopAsNumber=stopRisk.price, takeAsNumber=takeRisk.price;
 const riskError=stopRisk.error||takeRisk.error;
 // An existing position's risk UPDATE must be measured against the REAL average entry,
 // but the stop/take must remain on the allowed side of the CURRENT market price.
 const heldEntry=selectedPosition?Number(selectedPosition.entry_price):riskEntry;
 const stopForEdit=riskPriceFromInput(stop,heldEntry,riskLeverage,riskSide,'stop',stopMode,[mark]);
 const takeForEdit=riskPriceFromInput(take,heldEntry,riskLeverage,riskSide,'take',takeMode,[mark]);
 const editRiskError=stopForEdit.error||takeForEdit.error;
 const toggleRiskMode=(kind:RiskKind,next:RiskMode)=>{
   const mode=kind==='stop'?stopMode:takeMode;
   if(mode===next)return;
   const text=kind==='stop'?stop:take;
   const setValue=kind==='stop'?setStop:setTake;
   const setMode=kind==='stop'?setStopMode:setTakeMode;
   // A toggle must preserve the same target PRICE, never reinterpret 100% as 100 TC.
   if(text.trim()&&Number(text)!==0){
     const target=riskPriceFromInput(text,heldEntry,riskLeverage,riskSide,kind,mode);
     if(target.error||target.price==null){setError(target.error||'목표 가격을 변환할 수 없습니다.');return;}
     const converted=priceToRiskInput(target.price,next,heldEntry,riskLeverage,riskSide,kind);
     // For a trailing stop locking in profit, a positive loss-% does not exist.
     // Do not discard its price or accidentally remove protection.
     if(converted===''){setError('이 목표가는 양수 손절/익절률(%)로 표현할 수 없습니다. 절대가격 모드를 유지해주세요.');return;}
     setValue(converted);
   }
   setError(null);
   setMode(next);
 };
 const gameClock=market?.virtualMinute!=null?`DAY ${Math.floor(market.virtualMinute/1440)+1} · ${String(Math.floor(market.virtualMinute%1440/60)).padStart(2,'0')}:${String(market.virtualMinute%60).padStart(2,'0')}`:'—';
 return <>
   <button type="button" className={styles.entryButton} style={buttonBottom==null?undefined:{bottom:buttonBottom}}
     aria-expanded={open} disabled={disabled} aria-disabled={disabled} onClick={()=>{if(!disabled)setOpen(x=>!x);}} title="후월드 공통 시장에 접속하기">
     <span aria-hidden="true">📈</span> 후레이딩 <span className={styles.entryDot}/>
   </button>
   {open&&<div className={styles.overlay} role="dialog" aria-label="후레이딩 거래 패널" aria-modal="false">
     <div className={styles.scrim} onClick={()=>setOpen(false)} aria-hidden="true"/>
     <div className={styles.header}>
       <span className={styles.heading}>📈 후레이딩 <small>HOO WORLD MARKET</small></span>
       <span className={styles.clock}>◷ 1초 = 시장 1분 · {gameClock} {!orderMarketReady?'· 시장 동기화 중':''}</span>
       <button className={styles.close} type="button" onClick={()=>setOpen(false)} aria-label="후레이딩 닫기">×</button>
     </div>
     <aside className={styles.left} aria-label="자산 뉴스 순위">
       <section className={styles.card}>
         <div className={styles.cardTitle}>🍃 내 자산 <small>TC / HOO</small></div>
         <div className={styles.bigMoney}>{shownTotalTC!=null?fmt(shownTotalTC):'—'} <small>TC</small></div>
         <div className={styles.pair}><span>현재 후코인 지갑</span><b>{shownWallet!=null&&Number.isFinite(shownWallet)?`${fmt(shownWallet,0)} HOO`:'미확인'}</b></div>
         <div className={styles.pair}><span>{economyMaintenance?'보유액 환산 TC (거래 중지)':'거래 가능 TC'}</span><b>{shownFreeTC!=null?fmt(shownFreeTC):'미확인'}</b></div>
         <div className={styles.pair}><span>총 HOO 환산자산</span><b>{shownTotalTC!=null?`${fmt(shownTotalTC/1000,3)} HOO`:'미확인'}</b></div>
         <div className={styles.pair}><span>미실현 손익</span><b>{knownUnrealized!=null?`${signed(knownUnrealized)} TC`:'미확인'}</b></div>
         <div className={styles.statsRow}>
           <div><small>실현 손익</small><strong className={shownRealized!=null&&shownRealized>=0?styles.positive:styles.negative}>{shownRealized!=null?`${signed(shownRealized)} TC`:'미확인'}</strong></div>
           <div><small>실현수익률 (초기 500 HOO 기준)</small><strong className={shownRoi!=null&&shownRoi>=0?styles.positive:styles.negative}>{shownRoi!=null?percent(shownRoi):'미산출'}</strong></div>
         </div>
         {economyMaintenance&&readOnlyAssets&&<div className={styles.miniNote}>실제 DB 지갑 조회 완료 · 읽기 전용 · 주문과 거래는 계속 중지됩니다.{readOnlyAssets.account===null?' 거래 계좌가 아직 생성되지 않았습니다.':''}</div>}
         {readOnlyAssetError&&<div className={styles.miniNote}>자산 조회 실패: {readOnlyAssetError}</div>}
         {monitorError&&<div className={styles.miniNote}>포지션 동기화 실패: {monitorError} <button type="button" onClick={()=>void refresh()}>자산 재확인</button></div>}
         <div className={styles.miniNote}>공용 후코인 지갑 · 체결 후 자동 정산 (1 HOO 미만은 TC 잔액으로 유지) · 수익률은 초기 500 HOO 대비 누적 실현손익 추정치로, 외부 지급·지출을 반영한 전체 자산 수익률과 다를 수 있습니다.</div>
       </section>
       <section className={styles.card}>
         <div className={styles.cardTitle}>📣 오늘의 소식</div>
         {newsList.map(n=><div className={styles.newsRow} key={n.id}>
           <span className={n.sentiment==='호재'?styles.newsGood:styles.newsBad}>{n.sentiment}</span>
           <div><b>{n.symbol}</b> {n.headline}<small>{Math.max(0,Math.floor(((market?.now||0)-n.second)/60))}시간 전 (시장 기준)</small></div>
         </div>)}
         {!newsList.length&&<small>시장 뉴스 준비 중</small>}
       </section>
       <section className={styles.card}>
         <div className={styles.cardTitle}>🏆 후레이딩 랭킹 <button type="button" onClick={()=>setRankingExpanded(x=>!x)}>{rankingExpanded?'TOP 5':'TOP 10'}</button><button type="button" onClick={()=>void refreshRanking()} disabled={rankingLoading} aria-label="랭킹 새로고침">{rankingLoading?'조회 중':'↻ 갱신'}</button></div>
         <div className={styles.rankHeader}><span>순위 · 추종자</span><span>500 HOO 기준 수익률</span><span>누적 실현손익</span></div>
         {(rankingExpanded?leaderboard:leaderboard.slice(0,5)).map((p,i)=><div className={styles.rankRow} key={p.userId}>
           <span>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`} {p.name}</span>
           <b className={p.roi>=0?styles.positive:styles.negative}>{percent(p.roi)}</b>
           <b className={p.profit>=0?styles.positive:styles.negative}>{signed(p.profit)} <small>TC</small></b>
         </div>)}
         {!leaderboard.length&&rankingIsKnown&&<div className={styles.miniNote}>집계 대상 거래 기록이 없습니다. 후코인 보유량만으로는 순위가 생성되지 않습니다.</div>}
         {!leaderboard.length&&!rankingIsKnown&&!rankingError&&<div className={styles.miniNote}>최초 랭킹을 조회하는 중입니다. 조회 실패 시 ↻ 버튼으로 재시도하세요.</div>}
         {rankingError&&<div className={styles.miniNote}>랭킹 최신 조회 실패: {rankingError}{readOnlyRanking?' · 이전 조회 결과를 유지합니다.':''}</div>}
         {readOnlyRanking&&<div className={styles.miniNote}>DB 기록 조회 완료 · 집계 대상 {readOnlyRanking.eligibleCount}명 · 접속·포지션 완전 종료·수동 갱신 시 조회 (읽기 전용)</div>}
         <div className={styles.miniNote}>초기 {SEASON_INITIAL_HOO} HOO 지급 기준 추정치 · 별도 지급/선물/소비 및 미실현손익은 미반영 · 거래 참여자만 표시</div>
       </section>
     </aside>
     <main className={styles.right} aria-label="공통 거래 화면">
       <div className={styles.symbols}>
         {SYMBOLS.map(s=><button type="button" key={s} className={symbol===s?styles.selectedSymbol:''} onClick={()=>{setSymbol(s);setStop('');setTake('');}}>
           <span>{LABELS[s]}</span><strong>{displayMarketPrice(market?.prices[s])} <small>TC</small></strong>
         </button>)}
       </div>
       <div className={styles.priceRow}><span>{symbol}/TC <small>공통 실시간 차트</small></span><strong>{displayMarketPrice(market?.prices[symbol])} <small>TC</small></strong></div>
       <div className={styles.intervals}>{[30,60,240].map(s=><button type="button" key={s} className={frame===s?styles.selectedFrame:''} onClick={()=>setFrame(s)}>
          {{30:'30분',60:'1시간',240:'4시간'}[s as 30|60|240]}
        </button>)}</div>
        {allowR4SrDemo&&<div style={{display:'flex',justifyContent:'flex-end',padding:'6px 0'}}>
          <button type="button" aria-pressed={r4Demo} onClick={()=>setR4Demo(v=>!v)}
            style={{border:'1px solid #648ec0',borderRadius:8,padding:'7px 12px',background:r4Demo?'#215568':'#203447',color:'#f0f5fb',cursor:'pointer'}}>
            {r4Demo?'↩ 기존 실거래 차트로 돌아가기':'🧪 R4-SR 차트 샘플 비교 (개발 전용)'}
          </button>
        </div>}
        {allowR4SrDemo&&r4Demo?<section aria-label="R4-SR 별도 가상 차트" style={{padding:'12px',background:'#102239',color:'#fff',border:'2px solid #ecb75a',borderRadius:12}}>
          <div role="alert" style={{fontWeight:750,color:'#ffcc75',marginBottom:10}}>
            ⚠ 개발용 고정 샘플 가격입니다. HOO WORLD 실제 시세·주문·지갑과 연결되지 않습니다.
            이 화면에서는 거래 조작을 표시하지 않습니다.
          </div>
          <R4SrDemoChart symbol={symbol} timeframe={60}/>
          <p>개발용 샘플은 1시간봉으로만 표시됩니다.</p>
        </section>:<>
        <div className={styles.chartBox}>
      
         {marketError&&!shownChartBars.length
         ?<div className={styles.chartEmpty} role="status">실시간 차트 서버 연결 중단: {marketError}<div style={{marginTop:12,fontSize:13}}>저장된 차트가 없는 첫 접속에서는 서버 연결 복구 후 표시됩니다. 시장 데이터나 거래 기록은 초기화하지 마세요.</div></div>
         :<CandleChart key={`${symbol}:${frame}`} bars={shownChartBars} symbol={symbol} timeframe={frame} onLoadOlder={loadOlder} olderLoading={historyBusy} hasOlder={liveChartBars.length>0&&historyCursor.current!=null&&barsRef.current.length<MAX_RETAINED_CANDLES}/>}</div>
       <div className={styles.tradeForm}>
         <div className={styles.tradeRow}><b>매매 방향</b><div className={styles.segment}>
           <button className={direction==='long'?styles.activeLong:''} onClick={()=>setDirection('long')} type="button" disabled={Boolean(selectedPosition&&selectedPosition.side!==1)}>▲ LONG</button>
           <button className={direction==='short'?styles.activeShort:''} onClick={()=>setDirection('short')} type="button" disabled={Boolean(selectedPosition&&selectedPosition.side!==-1)}>▼ SHORT</button>
         </div></div>
         <div className={styles.tradeRow}><b>레버리지</b><div className={styles.segment}>{[1,2,3,5,10,20].map(n=><button type="button" key={n}
           className={leverage===n?styles.selectedFrame:''} disabled={Boolean(selectedPosition&&selectedPosition.leverage!==n)} onClick={()=>setLeverage(n)}>{n}×</button>)}<input aria-label="직접 입력 레버리지" type="number" min="1" max="20" step="1" value={leverage} disabled={Boolean(selectedPosition)} onChange={e=>setLeverage(Number(e.target.value))} style={{width:64}}/></div></div>
         <div className={styles.tradeRow}><label>증거금 (TC)<input type="number" min=".01" step=".01" value={margin} onChange={e=>setMargin(e.target.value)}/></label>
           <div className={styles.quick}>{[.25,.5,.75,1].map(x=><button key={x} type="button" onClick={()=>setMargin((Math.floor(Math.max(0,availableTC*x-0.01)/(1+leverage*.0006)*10000)/10000).toFixed(4))}>{x*100}%</button>)}</div></div>
         {selectedPosition&&<div className={styles.scaleHint}>
           같은 방향 추가 진입 가능 · 기존 {selectedPosition.leverage}배 유지 · 가중평균 진입가로 변경
           <span>반대 포지션은 기존 포지션을 청산한 뒤 진입할 수 있어요.</span>
         </div>}
         <div className={styles.riskRow}>
           <div style={{minWidth:0}}>
             <div className={styles.riskBasisRow} style={{flexWrap:'wrap'}}>
               <b>손절 (SL)</b>
               <div className={styles.riskBasisSwitch} aria-label="손절 입력 방식">
                 <button type="button" className={stopMode==='percent'?styles.riskBasisSelected:''} aria-pressed={stopMode==='percent'} onClick={()=>toggleRiskMode('stop','percent')}>수익률 %</button>
                 <button type="button" className={stopMode==='absolute'?styles.riskBasisSelected:''} aria-pressed={stopMode==='absolute'} onClick={()=>toggleRiskMode('stop','absolute')}>절대가격</button>
               </div>
             </div>
             <label>손절 {stopMode==='percent'?'손실률 (%)':'시장 가격 (TC)'}
               <input type="number" min="0" step="any" inputMode="decimal" value={stop} onChange={e=>setStop(e.target.value)} placeholder={stopMode==='percent'?'예: 100 → -100%':`예: ${pformat(mark)}`} aria-label={stopMode==='percent'?'손절 손실률 퍼센트':'손절 절대가격 TC'}/>
             </label>
           </div>
           <div style={{minWidth:0}}>
             <div className={styles.riskBasisRow} style={{flexWrap:'wrap'}}>
               <b>익절 (TP)</b>
               <div className={styles.riskBasisSwitch} aria-label="익절 입력 방식">
                 <button type="button" className={takeMode==='percent'?styles.riskBasisSelected:''} aria-pressed={takeMode==='percent'} onClick={()=>toggleRiskMode('take','percent')}>수익률 %</button>
                 <button type="button" className={takeMode==='absolute'?styles.riskBasisSelected:''} aria-pressed={takeMode==='absolute'} onClick={()=>toggleRiskMode('take','absolute')}>절대가격</button>
               </div>
             </div>
             <label>익절 {takeMode==='percent'?'수익률 (%)':'시장 가격 (TC)'}
               <input type="number" min="0" step="any" inputMode="decimal" value={take} onChange={e=>setTake(e.target.value)} placeholder={takeMode==='percent'?'예: 100 → +100%':`예: ${pformat(mark)}`} aria-label={takeMode==='percent'?'익절 수익률 퍼센트':'익절 절대가격 TC'}/>
             </label>
           </div>
         </div>
         <div className={styles.riskPreview} aria-live="polite">
           <span>SL {selectedPosition?'추가 진입 후 ' :''}예상가 <b>{stopAsNumber==null?'미설정':pformat(stopAsNumber)+' TC'}</b>{stopAsNumber!=null&&` · 예상 ROI ${signed(roiAtPrice(stopAsNumber,riskEntry,riskLeverage,riskSide)??0)}%`}</span>
           <span>TP {selectedPosition?'추가 진입 후 ' :''}예상가 <b>{takeAsNumber==null?'미설정':pformat(takeAsNumber)+' TC'}</b>{takeAsNumber!=null&&` · 예상 ROI ${signed(roiAtPrice(takeAsNumber,riskEntry,riskLeverage,riskSide)??0)}%`}</span>
         </div>
         <div className={styles.riskHelp}>SL/TP 독립 설정 · 퍼센트 입력 100 → 증거금 기준 손실 -100% / 수익 +100% (레버리지 반영) · 절대가격은 차트 시세 기준 TC · 0 또는 빈칸은 해제 · 수수료·슬리피지·펀딩비 제외 예상치</div>
         <button type="button" disabled={working} onClick={()=>void submit({__retry:true},'이전 요청 확인')}>마지막 요청 확인 / 재시도</button>
         {riskError&&<div className={styles.riskWarning} role="alert">{riskError}</div>}
         <div className={styles.estimate}>예상 명목가치 {fmt(Number(margin||0)*leverage)} TC · 수수료 및 슬리피지 별도</div>
         <button type="button" className={direction==='long'?styles.submitLong:styles.submitShort}
           disabled={working||!!riskError||!orderMarketReady||!data||(Boolean(selectedPosition)&&!addingSamePosition)}
           onClick={()=>void submit({action:'open',symbol,side:direction,leverage,margin:Number(margin),stop:stopAsNumber,take:takeAsNumber},selectedPosition?'동일 방향 추가 진입':direction==='long'?'LONG 진입':'SHORT 진입')}>
           {working?'처리 중…':selectedPosition?'↗ 같은 포지션 추가 진입':direction==='long'?'↗ LONG 진입':'↘ SHORT 진입'}
         </button>
       </div>
       <div className={`${styles.holdings}${positionTab==='position'&&livePositions.length>0?' '+styles.centerPositions:''}`}>
         <div className={styles.tabs}><button className={positionTab==='position'?styles.currentTab:''} onClick={()=>setPositionTab('position')} type="button">포지션 ({data?.positions.length??readOnlyAssets?.openPositions??'미확인'})</button>
           <button className={positionTab==='history'?styles.currentTab:''} onClick={()=>setPositionTab('history')} type="button">매매 기록</button></div>
         {positionTab==='position'?<div className={styles.positions}>
           {livePositions.map(p=><div className={styles.position} key={p.id}>
             <div className={styles.pair}><strong>{p.symbol} {p.side===1?'LONG':'SHORT'} {p.leverage}×</strong>
               <strong className={p.unrealized>=0?styles.positive:styles.negative}>{signed(p.unrealized)} TC ({percent(Number(p.margin_tc)?p.unrealized/Number(p.margin_tc)*100:0)})</strong></div>
             <div className={styles.pair}><span>진입 {pformat(Number(p.entry_price))} · 현재 {pformat(p.mark)} · 강제청산 예상 {pformat(p.liquidation_price)}</span></div>
             <div className={styles.pair}><span>보유 수량 {fmt(Number(p.qty),8)} · 증거금 {fmt(Number(p.margin_tc))} TC</span><span>SL {p.stop_price?pformat(Number(p.stop_price)):'—'} · TP {p.take_price?pformat(Number(p.take_price)):'—'}</span></div>
             <div className={styles.positionRiskHint}>설정된 기준 ROI: SL {priceToRiskPercent(p.stop_price,Number(p.entry_price),Number(p.leverage),p.side,'stop')||'—'}% · TP {priceToRiskPercent(p.take_price,Number(p.entry_price),Number(p.leverage),p.side,'take')||'—'}%</div>
             <div className={styles.positionActions}>
               {[.25,.5,.75,1].map(fraction=><button key={fraction} type="button" disabled={working||!orderMarketReady}
                 onClick={()=>void submit({action:'close',symbol:p.symbol,fraction},`${fraction===1?'전량':`${Math.round(fraction*100)}%`} 청산`)}>
                 {p.unrealized>0?`${fraction===1?'전량':`${Math.round(fraction*100)}%`} 익절`:`${fraction===1?'전량':`${Math.round(fraction*100)}%`} 청산`}
               </button>)}
               {p.symbol===symbol&&<button type="button" disabled={working||!!editRiskError} onClick={()=>void submit({action:'risk',symbol:p.symbol,stop:stopForEdit.price,take:takeForEdit.price},'손절·익절 수정')}>SL/TP 수정</button>}
             </div>
             <div className={styles.miniNote}>청산 비율은 실행 시점의 <b>남은 수량</b> 기준이에요. 기존 포지션의 수량과 증거금이 같은 비율로 줄어듭니다.</div>
           </div>)}
           {!data&&<span className={styles.miniNote}>{readOnlyAssets?.openPositions===0?'DB에서 열린 포지션 0개 확인 (읽기 전용).':readOnlyAssets?`열린 포지션 ${readOnlyAssets.openPositions}건 확인 · 세부 정보는 점검 해제 후 조회합니다.`:'거래 계좌 조회 대기 중입니다. 미확인을 포지션 0개로 해석하지 마세요.'}</span>}
           {data&&!data.positions.length&&<span className={styles.miniNote}>현재 열린 포지션이 없습니다.</span>}
         </div>:<div className={styles.positions}>
           {(data?.history||[]).slice(0,15).map(x=><div className={styles.pair} key={x.id}><span>{x.symbol} · {x.action} · {pformat(Number(x.fill_price))}</span><b className={Number(x.net_pnl_tc)>=0?styles.positive:styles.negative}>{signed(Number(x.net_pnl_tc))} TC</b></div>)}
         </div>}
       </div>
       {marketError&&Boolean(market?.candles[symbol]?.length)&&<div className={styles.error} role="status">차트 연결: {marketError}</div>}
       {economyMaintenance&&<div className={styles.notice} role="status">
         경제 시스템 점검 중 — 차트와 본인 지갑 잔액은 조회할 수 있습니다. 거래·정산과 상세 계좌 스냅샷은 여전히 중단됩니다.
       </div>}
       {(error||message)&&<div className={error?styles.error:styles.notice} role="status">{error||message}</div>}
       <div className={styles.foot}>후코인 1 = 1,000 TC · 공동 가상시장 · 부분청산 / 동일방향 추가 진입 가능 · 투자 결과는 후코인 게임자산에 반영</div>
       </>}
     </main>
   </div>}
 </>;
}

/** Place this next to the EXISTING player sprite inside its positioned container. */
export function HooTradingStatus(){
 const [active,setActive]=useState(false);
 useEffect(()=>{
   const listener=(e:Event)=>setActive(Boolean((e as CustomEvent<{active:boolean}>).detail?.active));
   document.addEventListener('hoo:trading:change',listener);
   return()=>document.removeEventListener('hoo:trading:change',listener);
 },[]);
 return active?<span className={styles.characterStatus}>돈버는 중</span>:null;
}
