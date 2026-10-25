'use client';
import {useEffect,useMemo,useState} from 'react';
import {useCandlePan} from '@/components/HooWorld/useCandlePan';

type Bar={t:number;open:number;high:number;low:number;close:number;volume:number};
type Sym='HOO'|'EGG'|'COAL';
type Preview={mode:string;engine:string;symbol:Sym;timeframe:number;simulated:boolean;livePrice:boolean;canTrade:boolean;walletConnected:boolean;bars:Bar[]};
const symbols:Sym[]=['HOO','EGG','COAL'];
const frames=[1,5,15,60];
const controlStyle:React.CSSProperties={background:'#152533',color:'#f0f5fb',border:'1px solid #3c596c',padding:'8px 12px',borderRadius:8,cursor:'pointer'};
const f=(x:number)=>Number(x).toLocaleString('ko-KR',{maximumFractionDigits:6});
export default function R4PreviewClient(){
  const [symbol,setSymbol]=useState<Sym>('HOO');
  const [frame,setFrame]=useState(15);
  const [data,setData]=useState<Preview|null>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    setData(null);setError(null);
    fetch(`/api/hoo-trading/r4-sr-preview?symbol=${symbol}&timeframe=${frame}`,{cache:'no-store',signal:controller.signal})
      .then(async r=>{
        if(!r.ok)throw new Error(`HTTP ${r.status}`);
        const result:Preview=await r.json();
        if(result.mode!=='LOCAL_OFFLINE_PREVIEW_ONLY'||result.canTrade||result.walletConnected||result.livePrice||!result.simulated||!Array.isArray(result.bars))throw new Error('UNSAFE_PREVIEW_RESPONSE');
        return result;
      })
      .then(setData).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'불러오기 실패');});
    return()=>controller.abort();
  },[symbol,frame]);
  const pan=useCandlePan(data?.bars||[],frame===60?18:frame===15?55:70,`${symbol}:${frame}`);
  const chart=useMemo(()=>{
    const bars=pan.visible;
    if(!bars.length)return null;
    const hi=Math.max(...bars.map(x=>x.high)),lo=Math.min(...bars.map(x=>x.low));
    const vmax=Math.max(1,...bars.map(x=>x.volume));
    const px=(i:number)=>36+i*940/Math.max(1,bars.length-1);
    const py=(v:number)=>20+(hi-v)/Math.max(1e-15,hi-lo)*270;
    return {bars,hi,lo,vmax,px,py};
  },[pan.visible]);
  return <main style={{minHeight:'100vh',background:'#0b1420',color:'#eff5fb',padding:'24px 18px',fontFamily:'system-ui,sans-serif'}}>
    <section style={{maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{marginBottom:6,fontSize:27}}>HOO TRADING — R4-SR 차트 독립 검증</h1>
      <p style={{color:'#ffcc75',lineHeight:1.6,fontWeight:650}}>개발용 가상 시세 · 실거래 불가 · HOO WORLD 후코인 지갑과 무관 · 기존 후레이딩 시장에 미연결</p>
      <p style={{color:'#aabccc',fontSize:14}}>동일한 고정 데모 시드로 생성한 R4-SR 시장 1,800분을 보여줍니다. 실제 서버 시세·체결·주문은 변경되지 않습니다.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'20px 0'}}>
        {symbols.map(s=><button type="button" style={{...controlStyle,borderColor:s===symbol?'#68dfac':'#3c596c'}} onClick={()=>setSymbol(s)} key={s}>{s}</button>)}
        <span style={{alignSelf:'center',marginLeft:15}}>봉:</span>
        {frames.map(n=><button type="button" style={{...controlStyle,borderColor:n===frame?'#68dfac':'#3c596c'}} onClick={()=>setFrame(n)} key={n}>{n}분</button>)}
      </div>
      <div style={{border:'1px solid #2d4055',borderRadius:12,padding:10,overflowX:'auto',background:'#0e1e2c'}}>
        {error&&<p role="alert" style={{color:'#ff8282'}}>차트 오류: {error}</p>}
        {!error&&!chart&&<p role="status">R4-SR 엔진에서 캔들 생성 중…</p>}
        {chart&&<svg viewBox="0 0 1024 402" style={{width:'100%',minWidth:570,cursor:pan.dragging?'grabbing':'grab',touchAction:'pan-y',userSelect:'none'}} role="img" tabIndex={0} aria-label={`${symbol} R4-SR 가상 캔들 및 거래량 차트, 좌우 드래그로 과거 탐색, 더블클릭으로 최신 복귀`} {...pan.pointerHandlers} onDoubleClick={pan.goLatest}>
          {[0,1,2,3,4].map(i=><g key={i}>
            <line x1="30" x2="990" y1={20+i*68} y2={20+i*68} stroke="#344d62" strokeWidth="0.7"/>
            <text x="993" y={24+i*68} fill="#b6c6d7" fontSize="11">{f(chart.hi-(chart.hi-chart.lo)*i/4)}</text>
          </g>)}
          {chart.bars.map((b,i)=>{
            const x=chart.px(i),color=b.close>=b.open?'#21bc91':'#f07581',y1=chart.py(b.open),y2=chart.py(b.close);
            const height=Math.max(1,Math.abs(y1-y2)),vh=Math.max(1,b.volume/chart.vmax*62);
            return <g key={b.t}>
              <line x1={x} x2={x} y1={chart.py(b.high)} y2={chart.py(b.low)} stroke={color} strokeWidth="1.3"/>
              <rect x={x-3.2} y={Math.min(y1,y2)} width="6.4" height={height} fill={color}/>
              <rect x={x-3.2} y={387-vh} width="6.4" height={vh} fill={color} opacity="0.65"/>
            </g>;
          })}
          <line x1="30" x2="990" y1="305" y2="305" stroke="#638098"/>
          <text x="35" y="319" fill="#aabccc" fontSize="12">거래량 (가상)</text>
          <text x="35" y="399" fill="#aabccc" fontSize="11">샘플 시작</text>
          <text x="920" y="399" fill="#aabccc" fontSize="11">샘플 종료</text>
        </svg>}
      </div>
      {data&&<p style={{color:'#aabccc',fontSize:13}}>엔진: {data.engine} · {data.bars.length}개 봉 · 최신 샘플 종가: {f(data.bars.at(-1)?.close||0)} TC (실거래 가격 아님)</p>}
      <p style={{marginTop:26,color:'#aabccc'}}>이 페이지는 로컬 개발 서버의 명시적 허용 설정에서만 열립니다. 운영 서버에서는 항상 404입니다.</p>
    </section>
  </main>;
}
