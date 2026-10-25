"use client";
import {useEffect,useMemo,useState} from 'react';
import {useCandlePan} from './useCandlePan';
type Sym = 'HOO'|'EGG'|'COAL';
type Bar={t:number;open:number;high:number;low:number;close:number;volume:number};
type Payload={mode:string;engine:string;simulated:boolean;canTrade:boolean;walletConnected:boolean;livePrice:boolean;bars:Bar[];symbol:string;timeframe:number};
const fmt=(n:number)=>n.toLocaleString('ko-KR',{maximumFractionDigits:6});
export default function R4SrDemoChart({symbol,timeframe}:{symbol:Sym;timeframe:number}){
  const [data,setData]=useState<Payload|null>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError(null);
    void (async()=>{
      try{
        const r=await fetch(`/api/hoo-trading/r4-sr-preview?symbol=${symbol}&timeframe=${timeframe}`,{signal:controller.signal,cache:'no-store'});
        if(!r.ok)throw new Error(`샘플 시세 API HTTP ${r.status}. 개발 서버의 HOO_R4_SR_PREVIEW_ENABLED 설정을 확인하세요.`);
        const v:Payload=await r.json();
        if(v.mode!=='LOCAL_OFFLINE_PREVIEW_ONLY'||v.canTrade||v.walletConnected||v.livePrice||v.simulated!==true||!Array.isArray(v.bars)||v.symbol!==symbol||v.timeframe!==timeframe)throw new Error('UNSAFE_PREVIEW_RESPONSE');
        if(!controller.signal.aborted)setData(v);
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'샘플 차트 오류');}
    })();
    return ()=>controller.abort();
  },[symbol,timeframe]);
  const pan=useCandlePan(data?.bars||[],timeframe===60?18:timeframe===15?55:70,`${symbol}:${timeframe}`);
  const c=useMemo(()=>{
    const bars=pan.visible;if(!bars.length)return null;
    const hi=Math.max(...bars.map(x=>x.high)),lo=Math.min(...bars.map(x=>x.low));
    const vmax=Math.max(1,...bars.map(x=>x.volume));
    const x=(i:number)=>30+(i+.5)*940/bars.length;
    const y=(v:number)=>18+(hi-v)/Math.max(1e-12,hi-lo)*275;
    return {bars,hi,lo,vmax,x,y};
  },[pan.visible]);
  return <div>
    {error&&<p role="alert" style={{color:'#ff8989'}}>샘플 차트 오류: {error}</p>}
    {!error&&!c&&<p role="status">R4-SR 가상 캔들 생성 중…</p>}
    {c&&<svg viewBox="0 0 1024 400" role="img" tabIndex={0} aria-label={`${symbol} R4-SR 샘플 차트, 드래그로 과거 탐색, 더블클릭으로 최신 복귀`} {...pan.pointerHandlers} onDoubleClick={pan.goLatest} style={{width:'100%',height:'auto',minWidth:0,background:'#0d1e30',cursor:pan.dragging?'grabbing':'grab',touchAction:'pan-y',userSelect:'none'}}>
      {[0,1,2,3,4].map(i=><g key={i}>
        <line x1="25" x2="986" y1={18+i*68.75} y2={18+i*68.75} stroke="#35516b" strokeWidth="0.8"/>
        <text x="989" y={22+i*68.75} fontSize="11" fill="#b1c7dd">{fmt(c.hi-(c.hi-c.lo)*i/4)}</text>
      </g>)}
      {c.bars.map((b,i)=>{
        const x=c.x(i),isUp=b.close>=b.open,clr=isUp?'#19b89a':'#ed7185';
        return <g key={`${b.t}-${i}`}>
          <line x1={x} x2={x} y1={c.y(b.high)} y2={c.y(b.low)} stroke={clr} strokeWidth="1.4"/>
          <rect x={x-3} y={Math.min(c.y(b.open),c.y(b.close))} width="6" height={Math.max(1,Math.abs(c.y(b.open)-c.y(b.close)))} fill={clr}/>
          <rect x={x-3} y={383-b.volume/c.vmax*62} width="6" height={Math.max(1,b.volume/c.vmax*62)} fill={clr} opacity="0.72"/>
        </g>;
      })}
      <line x1="25" x2="986" y1="310" y2="310" stroke="#63839b"/>
      <text x="32" y="326" fontSize="11" fill="#c4cfda">가상 거래량</text>
    </svg>}
    {data&&<p style={{fontSize:12,color:'#a9bacd'}}>엔진 {data.engine} · {data.bars.length}개 캔들 · 샘플 종가 {fmt(data.bars.at(-1)?.close||0)} TC (거래 체결에 사용 불가)</p>}
  </div>;
}
