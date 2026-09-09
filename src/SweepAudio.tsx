import { useEffect } from "react";
import type { Settings } from "./game/engine";
import type { SweepSignal } from "./SweepReadout";
import { stopSweepAudio, sweepMotionSound } from "./audio";
export function SweepAudio({signal,settings}:{signal:SweepSignal;settings:Settings}) {
  useEffect(()=>{
    let last=-Infinity,cell=-1;
    const update=()=>{
      const value=signal.read(),now=performance.now();
      if(!value.moving || document.hidden || !settings.sweepSound){stopSweepAudio();return;}
      const next=Math.floor((value.cursor??50)/4);
      if(now-last<95 || cell===next)return;
      last=now;cell=next;sweepMotionSound(value.cursor??50,settings);
    };
    const unsubscribe=signal.subscribe(update);document.addEventListener("visibilitychange",update);update();
    return()=>{unsubscribe();document.removeEventListener("visibilitychange",update);stopSweepAudio();};
  },[signal,settings]);
  return null;
}
