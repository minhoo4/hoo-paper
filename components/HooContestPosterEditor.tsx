"use client";

import type { ContestPosterData, ContestPosterPhase } from "@/lib/hooContestPoster";
import { toContestInstant, toContestKstInput } from "@/lib/hooContestPoster";
import HooContestPoster from "./HooContestPoster";

type Props = {
  value: ContestPosterData;
  onChange: (value: ContestPosterData) => void;
};

const phases: { value: ContestPosterPhase; label: string }[] = [
  {value:"draft",label:"비공개"},{value:"scheduled",label:"예정"},
  {value:"active",label:"진행 중"},{value:"review",label:"검증 중"},
  {value:"official",label:"공식 결과"},{value:"ended",label:"종료"},
];

// UI demo/editor only. Existing admin API must authorize and persist all actual changes.
export default function HooContestPosterEditor({value, onChange}: Props) {
  const set = (patch: Partial<ContestPosterData>) => onChange({...value,...patch});
  const setPrize = (rank: "first"|"second"|"third", raw:string) => {
    // Empty fields become 0 in preview; existing admin save validation is authoritative.
    const n = raw.trim() ? Number(raw) : 0;
    set({prizesHoo:{...value.prizesHoo,[rank]:Number.isFinite(n) && n>=0?n:0}});
  };
  const start = toContestInstant(value.startsAt);
  const end = toContestInstant(value.endsAt);
  const invalidPeriod = !!start && !!end && end <= start;
  return <div style={{display:"grid",gap:20,maxWidth:1100}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
      <label>대회 제목<input style={{width:"100%"}} value={value.title} maxLength={80} onChange={e=>set({title:e.target.value})}/></label>
      <label>시작 (KST)<input style={{width:"100%"}} type="datetime-local" value={toContestKstInput(value.startsAt)} onChange={e=>set({startsAt:e.target.value})}/></label>
      <label>종료 (KST)<input style={{width:"100%"}} type="datetime-local" value={toContestKstInput(value.endsAt)} onChange={e=>set({endsAt:e.target.value})}/></label>
      {(["first","second","third"] as const).map((rank,index)=><label key={rank}>{index+1}등 상금 (HOO)<input style={{width:"100%"}} type="number" min="0" step="1" value={value.prizesHoo[rank]} onChange={e=>setPrize(rank,e.target.value)}/></label>)}
      <label>미리보기 상태<select style={{width:"100%"}} value={value.phase} onChange={e=>set({phase:e.target.value as ContestPosterPhase})}>{phases.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
    </div>
    {invalidPeriod && <p role="alert" style={{color:"#b91c1c"}}>종료 일시는 시작 일시보다 늦어야 해요. 실제 저장을 차단하세요.</p>}
    <HooContestPoster contest={value}/>
    <small style={{color:"#64748b"}}>미리보기 전용입니다. 저장/공개/상태 변경은 기존 관리자 API에서 권한 확인과 유효성 검사를 수행해야 합니다.</small>
  </div>;
}
