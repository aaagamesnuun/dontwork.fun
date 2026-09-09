import { boundedIntensity, effectEnergy } from "./effectEnergy";
import type { Settings } from "./game/engine";
import type { WinImpact } from "./ResultVisuals";
import type { Cue } from "./audio";
const active = new WeakMap<HTMLElement, Animation>();
const illumination = new WeakMap<HTMLElement, Animation>();
const lastImpact = new WeakMap<HTMLElement, number>();
const lastFlash = new WeakMap<HTMLElement, {at:number;tier:number;strength:number}>();
export function stopImpact(surface: HTMLElement | null) {
  if (surface) {
    active.get(surface)?.cancel(); active.delete(surface);
    illumination.get(surface)?.cancel(); illumination.delete(surface);
  }
}

export function flashProfile(cue:Cue,settings:Settings,detail:WinImpact={}) {
  if(settings.impactFlash==="off")return null;
  const jackpot=["jackpot","chain","infinity"].includes(cue);
  const hit=jackpot || ["win","bigwin","streak","pulse","armed"].includes(cue);
  const bright=settings.impactFlash==="bright";
  if(!hit){
    if(cue!=="upgrade")return null;
    const intensity=Math.min(1.5,boundedIntensity(settings));
    return {opacity:(bright?.3:.18)*.685*intensity,brightness:(bright?.35:.13)*.55*intensity,duration:280};
  }
  const magnitude=Math.min(1,Math.log10(Math.max(1,Math.abs(detail.amount??0)))/9);
  const energy=effectEnergy(settings,detail),soft=bright?1:.5;
  return {
    opacity:Math.min(.85,((jackpot?.46:.22)+magnitude*.5)*energy)*soft,
    brightness:Math.min(1.1,((jackpot?.3:.12)+magnitude*.7)*energy)*soft,
    duration:Math.round((jackpot?750:500)+magnitude*650),
  };
}

export function impact(
  surface: HTMLElement | null,
  cue: Cue,
  settings: Settings,
  flash: HTMLElement | null = null,
  detail: WinImpact = {},
) {
  if (
    !surface ||
    (typeof document !== "undefined" && document.hidden) ||
    settings.motion === "reduced" ||
    (typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) return;
  const jackpot=["jackpot","chain","infinity"].includes(cue);
  const weight =
    cue === "jackpot" || cue === "infinity" ? 1.4
      : cue === "bigwin" || cue === "upgrade" ? 0.55
        : cue === "chain" ? 1.1
          : ["win", "streak", "pulse", "armed"].includes(cue) ? 0.3
            : cue === "work" ? 0.22 : 0;
  const light=flashProfile(cue,settings,detail);
  const flashClock=flash??surface;
  const previous=lastFlash.get(flashClock),tier=jackpot?2:cue==="upgrade"?0:1;
  // A small pulse must not swallow the next Jackpot or a much larger win.
  if(light && (!previous || Date.now()-previous.at>=500 || tier>previous.tier || light.opacity+light.brightness>previous.strength*1.25)){
    lastFlash.set(flashClock,{at:Date.now(),tier,strength:light.opacity+light.brightness});
    if(flash && typeof flash.animate==="function"){
      const opacity=illumination.has(flash) && typeof getComputedStyle==="function"?getComputedStyle(flash).opacity:0;
      illumination.get(flash)?.cancel();
      const glow=flash.animate([{opacity},{opacity:light.opacity,offset:.12},{opacity:0}],{duration:light.duration,easing:"ease-out"});
      illumination.set(flash,glow);
      glow.onfinish=()=>{if(illumination.get(flash)===glow)illumination.delete(flash);};
    }
    if(typeof surface.animate==="function"){
      // Brightness is independent of shaking: repeated WORK cannot cut a win's light short.
      const filter=illumination.has(surface) && typeof getComputedStyle==="function"?getComputedStyle(surface).filter:"brightness(1)";
      illumination.get(surface)?.cancel();
      const glow=surface.animate([{filter},{filter:`brightness(${1+light.brightness})`,offset:.12},{filter:"brightness(1)"}],{duration:light.duration,easing:"ease-out"});
      illumination.set(surface,glow);
      glow.onfinish=()=>{if(illumination.get(surface)===glow)illumination.delete(surface);};
    }
  }
  if (
    !weight ||
    Date.now()-(lastImpact.get(surface)??-Infinity)<(cue==="work"?0:detail.amount?120:350) ||
    typeof surface.animate!=="function"
  ) return;
  const amplitude=Math.min(70,
    (settings.shake==="strong"?20:settings.shake==="light"?7:0)*
    weight*boundedIntensity(settings)*impactScale({...detail,streak:settings.streakEffects?detail.streak:0}));
  if(!amplitude)return;
  lastImpact.set(surface,Date.now());
  active.get(surface)?.cancel();
  const frames=[[0,0],[-1,.35],[.8,-.25],[-.5,.2],[.25,-.1],[0,0]].map(([x,y])=>({transform:`translate(${x*amplitude}px, ${y*amplitude}px)`}));
  const animation=surface.animate(frames,{duration:jackpot?560:220,easing:"ease-out"});
  active.set(surface,animation);
  animation.onfinish=()=>{if(active.get(surface)===animation)active.delete(surface);};
}

export function impactScale({amount=0,streak=0,milestone=false}:WinImpact) {
  return Math.min(3.5,1+Math.log10(Math.max(1,amount))*.14+Math.min(30,streak)*.06+(milestone?.5:0));
}
