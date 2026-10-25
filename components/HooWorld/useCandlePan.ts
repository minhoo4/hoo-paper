'use client';
import {useEffect, useRef, useState} from 'react';
import type {PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent} from 'react';

/**
 * Display-only candle navigation. Drag right = older, drag left = newer.
 * Uses candle timestamps as anchors, so newly arrived market data and
 * lazily prepended older pages cannot shift a historical viewport.
 * No trading, wallet, or server writes.
 */
export function useCandlePan<T extends {t:number}>(
  bars:T[], windowSize:number, resetKey:string,
  loadOlder?:()=>void, hasOlder=false,
){
  const [anchorTime,setAnchorTime]=useState<number|null>(null);
  const [dragging,setDragging]=useState(false);
  const drag=useRef<{id:number;x:number;endTime:number;step:number}|null>(null);
  useEffect(()=>{
    setAnchorTime(null);
    setDragging(false);
    drag.current=null;
  },[resetKey]);
  const findIndex=(t:number)=>{
    const found=bars.findIndex(b=>b.t>=t);
    return found===-1?bars.length-1:found;
  };
  const minEnd=Math.min(bars.length-1,Math.max(1,windowSize)-1);
  const activeIdx=anchorTime===null?bars.length-1:findIndex(anchorTime);
  const endIdx=Math.max(minEnd,Math.min(bars.length-1,activeIdx));
  const visible=bars.slice(Math.max(0,endIdx-windowSize+1),endIdx+1);
  const isLatest=bars.length===0||endIdx===bars.length-1;
  const shift=(count:number)=>{
    if(!bars.length)return;
    const next=Math.max(minEnd,Math.min(bars.length-1,endIdx-count));
    setAnchorTime(next===bars.length-1?null:bars[next].t);
    if(count>0&&hasOlder&&next<=minEnd+20)loadOlder?.();
  };
  const onPointerDown=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(!bars.length||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();
    const rect=event.currentTarget.getBoundingClientRect();
    drag.current={id:event.pointerId,x:event.clientX,endTime:bars[endIdx].t,
      step:Math.max(2,rect.width/Math.max(1,windowSize))};
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove=(event:ReactPointerEvent<SVGSVGElement>)=>{
    const d=drag.current;
    if(!d||d.id!==event.pointerId||!bars.length)return;
    const count=Math.round((event.clientX-d.x)/d.step);
    if(count===0)return;
    const origin=findIndex(d.endTime);
    const desired=origin-count;
    const next=Math.max(minEnd,Math.min(bars.length-1,desired));
    setAnchorTime(next===bars.length-1?null:bars[next].t);
    if(count>0&&hasOlder&&next<=minEnd+20)loadOlder?.();
  };
  const release=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(drag.current?.id!==event.pointerId)return;
    drag.current=null;
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };
  const onKeyDown=(event:ReactKeyboardEvent<SVGSVGElement>)=>{
    if(event.key==='ArrowLeft'){event.preventDefault();shift(10);}
    else if(event.key==='ArrowRight'){event.preventDefault();shift(-10);}
    else if(event.key==='Home'){event.preventDefault();shift(bars.length);}
    else if(event.key==='End'){event.preventDefault();setAnchorTime(null);}
  };
  return {
    visible, dragging, isLatest,
    goOlder:()=>shift(20), goNewer:()=>shift(-20), goLatest:()=>setAnchorTime(null),
    pointerHandlers:{onPointerDown,onPointerMove,onPointerUp:release,onPointerCancel:release,onKeyDown},
  };
}
