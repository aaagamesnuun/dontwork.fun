import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createSweepSignal, SweepReadout } from "./SweepReadout";
import { PayoffSweep, type SweepFrame } from "./TradingViews";
import { startSweep } from "./sweepMotion";

it("shares a single live route with the readout, without publishing the hidden result",()=>{
  vi.useFakeTimers();vi.setSystemTime(10000);
  const signal=createSweepSignal(),frame:SweepFrame={id:2,roll:100,values:Array(100).fill(1),duration:1000,at:Date.now()};
  const stop=startSweep(frame,"lock",false,signal.update);
  const render=()=>renderToStaticMarkup(<SweepReadout {...signal.read()}/>);
  expect(signal.read().moving).toBe(true);expect(render()).toContain('出目を抽選中');
  vi.advanceTimersByTime(1000);
  expect(signal.read()).toMatchObject({cursor:100,moving:false});expect(render()).toContain('>100<');
  stop();vi.useRealTimers();
});
it("keeps all 99 grid lines and places one numeric readout in each payoff style",()=>{
  for(const style of ["classic","net","chart"] as const){
    const signal=createSweepSignal();signal.update(42,false,false);
    const html=renderToStaticMarkup(<PayoffSweep values={Array(100).fill(1)} frame={null} reduced={false} style={style} signal={signal}/>);
    expect((html.match(/class="sweep-readout/g)??[]).length).toBe(1);
    expect(html).toContain('>42<');expect(html).not.toContain('sweep-die');
    expect(html).not.toContain('class="sweep-roll"');expect(html).not.toContain('<strong aria-hidden="true">');
    expect(html).toContain('JACKPOT');expect(html).toContain('>20<');expect(html).toContain('>70<');
    if(style==="chart")expect((html.match(/class="sweep-vertical-tick/g)??[]).length).toBe(99);
    else expect(html).toContain('class="payoff-grid-lines"');
  }
});
