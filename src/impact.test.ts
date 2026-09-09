import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./game/engine";
import { impact, stopImpact, flashProfile } from "./impact";
const target=()=>({animate:vi.fn((_frames:Keyframe[],_options:KeyframeAnimationOptions)=>({cancel:vi.fn(),onfinish:null}))});
const element=(node:ReturnType<typeof target>)=>node as unknown as HTMLElement;
beforeEach(()=>{vi.stubGlobal("document",{hidden:false});vi.stubGlobal("matchMedia",()=>({matches:false}));});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("impact effects",()=>{
  it("keeps a strong phone flash and shake without filtering the whole game",()=>{
    vi.stubGlobal("matchMedia",(query:string)=>({matches:query==="(pointer: coarse)"}));
    const surface=target(),flash=target();
    impact(element(surface),"jackpot",defaultSettings,element(flash),{amount:1e9});
    expect(flash.animate).toHaveBeenCalledOnce();
    expect(Number(flash.animate.mock.calls[0][0][1].opacity)).toBeGreaterThan(.7);
    expect(surface.animate).toHaveBeenCalledOnce();
    for(const frame of surface.animate.mock.calls[0][0])expect(frame).not.toHaveProperty("filter");
  });
  it("keeps WORK's motion without starting either full-screen light or brightness",()=>{
    const surface=target(),flash=target();
    for(let i=0;i<10;i++)impact(element(surface),"work",defaultSettings,element(flash));
    expect(surface.animate).toHaveBeenCalledTimes(10);expect(flash.animate).not.toHaveBeenCalled();
    for(const [frames] of surface.animate.mock.calls)for(const frame of frames)expect(frame).not.toHaveProperty("filter");
    expect(flashProfile("work",defaultSettings,{amount:1e9,streak:30,milestone:true})).toBeNull();
    expect(flashProfile("loss",defaultSettings,{amount:1e9})).toBeNull();
  });
  it("lights a settled win even with shaking off, with a stronger and longer pulse for larger gains",()=>{
    const settings={...defaultSettings,shake:"off" as const};
    const samples=[10,1e4,1e9].map(amount=>{
      const surface=target(),flash=target();impact(element(surface),"win",settings,element(flash),{amount});
      expect(surface.animate).toHaveBeenCalledOnce();expect(flash.animate).toHaveBeenCalledOnce();
      const [frames,options]=flash.animate.mock.calls[0];
      return {opacity:Number(frames[1].opacity),brightness:Number(String(surface.animate.mock.calls[0][0][1].filter).match(/[\d.]+/)![0]),duration:Number(options.duration)};
    });
    for(const key of ["opacity","brightness","duration"] as const){expect(samples[1][key]).toBeGreaterThan(samples[0][key]);expect(samples[2][key]).toBeGreaterThan(samples[1][key]);}
  });
  it("lets win illumination finish through repeated WORK while cancelling both layers on stop",()=>{
    const surface=target(),flash=target();impact(element(surface),"win",defaultSettings,element(flash),{amount:1e6});
    const brightness=surface.animate.mock.results[0].value,overlay=flash.animate.mock.results[0].value;
    for(let i=0;i<10;i++)impact(element(surface),"work",defaultSettings,element(flash));
    expect(brightness.cancel).not.toHaveBeenCalled();expect(overlay.cancel).not.toHaveBeenCalled();expect(flash.animate).toHaveBeenCalledOnce();
    stopImpact(element(surface));stopImpact(element(flash));expect(brightness.cancel).toHaveBeenCalledOnce();expect(overlay.cancel).toHaveBeenCalledOnce();
  });
  it("does not retrigger rapid duplicate flashes and honors hidden/reduced/disabled choices",()=>{
    const surface=target(),flash=target();
    impact(element(surface),"win",defaultSettings,element(flash));impact(element(surface),"win",defaultSettings,element(flash));expect(flash.animate).toHaveBeenCalledOnce();
    for(const settings of [{...defaultSettings,motion:"reduced" as const},{...defaultSettings,shake:"off" as const,impactFlash:"off" as const}]){
      const s=target(),f=target();impact(element(s),"jackpot",settings,element(f),{amount:1e9});expect(s.animate).not.toHaveBeenCalled();expect(f.animate).not.toHaveBeenCalled();
    }
    for(const mode of ["hidden","os-reduced"]){
      vi.stubGlobal("document",{hidden:mode==="hidden"});vi.stubGlobal("matchMedia",()=>({matches:mode==="os-reduced"}));
      const s=target(),f=target();impact(element(s),"jackpot",defaultSettings,element(f),{amount:1e9});expect(s.animate).not.toHaveBeenCalled();expect(f.animate).not.toHaveBeenCalled();
    }
  });
  it("intensifies a recent small pulse for a Jackpot or much larger win, without dipping to darkness",()=>{
    const clock=vi.spyOn(Date,"now").mockReturnValue(1000);
    vi.stubGlobal("getComputedStyle",()=>({opacity:"0.2",filter:"brightness(1.1)"}));
    for(const first of ["upgrade","win"] as const){
      const surface=target(),flash=target();
      clock.mockReturnValue(1000);impact(element(surface),first,defaultSettings,element(flash),{amount:10});
      const old=flash.animate.mock.results[0].value;
      clock.mockReturnValue(1100);impact(element(surface),first==="upgrade"?"jackpot":"win",defaultSettings,element(flash),{amount:1e9});
      expect(flash.animate).toHaveBeenCalledTimes(2);expect(old.cancel).toHaveBeenCalledOnce();
      expect(flash.animate.mock.calls[1][0][0].opacity).toBe("0.2");
      impact(element(surface),"win",defaultSettings,element(flash),{amount:10});
      expect(flash.animate).toHaveBeenCalledTimes(2);
    }
  });
  it("keeps intense Jackpot light bounded and respects soft mode and quantitative intensity",()=>{
    const base=flashProfile("win",defaultSettings,{amount:1000})!;
    const soft=flashProfile("win",{...defaultSettings,impactFlash:"soft"},{amount:1000})!;
    const stronger=flashProfile("win",{...defaultSettings,effectIntensity:2},{amount:1000})!;
    expect(soft.opacity).toBeLessThan(base.opacity);expect(soft.brightness).toBeLessThan(base.brightness);expect(stronger.opacity).toBeGreaterThan(base.opacity);
    const jp=flashProfile("jackpot",{...defaultSettings,effectIntensity:2,streakEffects:true},{amount:1e200,streak:30,milestone:true})!;
    expect(jp.opacity).toBeLessThanOrEqual(.85);expect(jp.brightness).toBeLessThanOrEqual(1.1);expect(jp.duration).toBeLessThanOrEqual(1400);expect(jp.opacity).toBeGreaterThan(base.opacity);
  });
});
