/**
 * OPTIONAL explicit React frame for later page.tsx integration.
 * Not required: V9 auto-skin already decorates existing rendered panels.
 * Never replaces page JSX or touches wallpaper. OFF leaves panel aesthetics untouched.
 */
import type {CSSProperties,ReactNode} from "react";
import HooSpiderWeb from "./HooSpiderWeb";

type Props={children:ReactNode;className?:string;style?:CSSProperties;mini?:boolean};
export default function HooHalloweenFrame({children,className="",style,mini=false}:Props){
  return <div className={`hoo-h-v9-frame ${className}`} style={style}>
    <HooSpiderWeb corner="tl"/>
    {!mini&&<><HooSpiderWeb corner="tr"/><HooSpiderWeb corner="bl"/><HooSpiderWeb corner="br"/></>}
    <div className="hoo-h-v9-body">{children}</div>
  </div>;
}
