/**
 * Optional reusable decorative web for explicitly authored JSX panels.
 * The automatic V9 skin works without importing this component.
 */
import type {CSSProperties} from "react";

type Corner = "tl" | "tr" | "bl" | "br";
type Props = {
  corner?: Corner;
  className?: string;
};
export default function HooSpiderWeb({corner="tl",className=""}:Props){
  const asset:Record<Corner,string>={
    tl:"web-corner-lace.svg",
    tr:"web-corner-ember-tr.svg",
    bl:"web-corner-moon-bl.svg",
    br:"web-corner-lace-br.svg",
  };
  const position:Record<Corner,CSSProperties>={
    tl:{top:0,left:0},tr:{top:0,right:0},
    bl:{bottom:0,left:0},br:{bottom:0,right:0},
  };
  return <span aria-hidden="true" className={className} style={{
    position:"absolute",...position[corner],width:"min(24%, 220px)",aspectRatio:"1 / 1",
    backgroundImage:`url('/hoo-seasonal/halloween/${asset[corner]}')`,
    backgroundRepeat:"no-repeat",backgroundSize:"contain",pointerEvents:"none",
    userSelect:"none",zIndex:1,
  }}/>;
}
