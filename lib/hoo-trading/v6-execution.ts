/** Proposed internal-path event ordering, TEST/REVIEW ONLY.
 * Existing SQL conservative OHLC priority is a different policy: no silent activation.
 * Funding, receipts, precision, wallet updates must remain transactional in existing settlement.
 */
export type Barrier={kind:'liquidation'|'stop'|'take';price:number};
export function firstPathHit(path:readonly number[],side:1|-1,barriers:readonly Barrier[]):{kind:Barrier['kind'];price:number;segment:number}|null{
 if(path.length<2||path.some(p=>!(p>0)||!Number.isFinite(p)))throw Error('V5_INVALID_EXECUTION_PATH');
 if(barriers.some(b=>!(b.price>0)||!Number.isFinite(b.price)))throw Error('V5_INVALID_BARRIER');
 const triggered=(p:number,b:Barrier)=>b.kind==='take'?(side===1?p>=b.price:p<=b.price):(side===1?p<=b.price:p>=b.price);
 // If already across multiple levels at open, preserve conservative priority for the gap.
 const priority={liquidation:0,stop:1,take:2};const opening=barriers.filter(b=>triggered(path[0],b)).sort((a,b)=>priority[a.kind]-priority[b.kind]);
 if(opening.length)return {kind:opening[0].kind,price:path[0],segment:0};
 for(let i=1;i<path.length;i++){
  const a=path[i-1],z=path[i],hits=barriers.filter(b=>triggered(z,b)&&!triggered(a,b));
  hits.sort((x,y)=>Math.abs(x.price-a)-Math.abs(y.price-a)||priority[x.kind]-priority[y.kind]);
  if(hits.length)return {kind:hits[0].kind,price:hits[0].price,segment:i};
 }
 return null;
}
