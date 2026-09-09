import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
export function ChartNotices({anchor,children,reduced=false,plotOnly=false}:{anchor:RefObject<HTMLElement|null>;children:ReactNode;reduced?:boolean;plotOnly?:boolean}) {
  const [box,setBox]=useState({left:12,top:140,width:320,height:400});
  useLayoutEffect(()=>{
    const place=()=>{
      const target=plotOnly ? anchor.current?.querySelector(".wealth-plot > svg")??anchor.current : anchor.current;
      const rect=target?.getBoundingClientRect(),viewport=window.visualViewport;
      const width=viewport?.width??innerWidth,height=viewport?.height??innerHeight,offset=viewport?.offsetTop??0,x=viewport?.offsetLeft??0;
      const left=Math.max(x+8,Math.min(rect?.left??x+12,x+width-120)),top=Math.max(offset+8,Math.min((rect?.top??140)+7,offset+height-120));
      setBox({left,top,width:Math.max(100,Math.min(rect?.width??width-24,x+width-left-8)),height:Math.max(80,offset+height-top-100)});
    };
    place();const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(place):null;
    if(anchor.current)observer?.observe(anchor.current);
    addEventListener("resize",place);addEventListener("scroll",place,true);window.visualViewport?.addEventListener("resize",place);addEventListener("scroll",place,true);window.visualViewport?.addEventListener("scroll",place);
    return()=>{observer?.disconnect();removeEventListener("resize",place);removeEventListener("scroll",place,true);window.visualViewport?.removeEventListener("resize",place);removeEventListener("scroll",place,true);window.visualViewport?.removeEventListener("scroll",place);};
  },[anchor,plotOnly]);
  return createPortal(<div className={`chart-notifications floating-notices ${reduced?"notice-reduced":""}`} style={{left:box.left,top:box.top,width:box.width,maxHeight:box.height}}>{children}</div>,document.body);
}
