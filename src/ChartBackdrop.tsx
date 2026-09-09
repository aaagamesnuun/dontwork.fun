import type { CSSProperties } from "react";
import type { Run } from "./game/engine";
import { boundedIntensity } from "./effectEnergy";

export function chartPulse(s:Run) {
  const outcome=s.last,amount=Math.abs(outcome?.profit??0),jackpot=!!outcome?.jackpot;
  const magnitude=Math.min(1,Math.log10(amount+1)/9);
  const strength=Math.min(1.5,((amount>0?.08+magnitude:0)+(jackpot?.85:0))*boundedIntensity(s.settings));
  return {amount,jackpot,strength,falling:(outcome?.profit??0)<0,
    opacity:strength===0?0:Math.min(.82,.1+strength*.48),
    scale:.75+strength*1.75,duration:420+Math.round(strength*750),
    waves:jackpot?3:amount>=1e6?3:amount>=1000?2:1};
}
export function ChartBackdrop({s,recordedCash}:{s:Run;recordedCash:number}) {
  const style=s.settings.chartBackdrop;
  if(style==="off")return null;
  if(style!=="pulse")return <div aria-hidden="true" className={`chart-backdrop backdrop-${style} ${s.last && s.last.profit<0?"falling":"rising"}`} style={{"--wealth-energy":Math.min(1,Math.max(.15,Math.log10(Math.max(1,recordedCash))/9*s.settings.effectIntensity))} as CSSProperties}><i/><b/></div>;
  const pulse=chartPulse(s);
  return <div aria-hidden="true" className={`chart-backdrop backdrop-pulse ${pulse.falling?"falling":"rising"} ${pulse.jackpot?"jackpot-pulse":""}`} style={{
    "--pulse-opacity":pulse.opacity,"--pulse-scale":pulse.scale,"--pulse-duration":`${pulse.duration}ms`,"--pulse-spread":`${50+pulse.strength*90}%`,
  } as CSSProperties}>
    {s.last && Array.from({length:pulse.waves},(_,i)=><i key={`${s.id}:${s.last!.id}:${i}`} style={{animationDelay:`${i*150}ms`}}/>)}
  </div>;
}
