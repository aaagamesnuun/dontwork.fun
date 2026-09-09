import { effectEnergy } from "./effectEnergy";
import { money, type Settings } from "./game/engine";
import type { Cue } from "./audio";
import type { BanknoteStyle } from "./banknotes";
import { cashRainPlan, compactCash, type CashToken } from "./cashPlan";
import { createCashSprite } from "./cashSprites";
export { cashRainPlan } from "./cashPlan";

const active = new WeakMap<HTMLElement, Set<HTMLElement>>();
const last = new WeakMap<HTMLElement, number>();
const lastJackpot = new WeakMap<HTMLElement, number>();
const VISUAL_LIMIT = 328;
export const visualBudget = (mobile: boolean) => mobile
  ? { total: 164, cash: 96, confetti: 36, batch: 8 }
  : { total: VISUAL_LIMIT, cash: 216, confetti: 72, batch: 14 };
const mobileEffects = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
type FlightBox = Pick<DOMRect, "left" | "top" | "width" | "height">;
type CashOrigin = { x: number; y: number; width: number };
type Rain = { budget: ReturnType<typeof visualBudget>; queue: CashToken[]; energy: number; festival: boolean; tier: number; serial: number; accentAt: number; banknoteStyle: BanknoteStyle; motion: Settings["cashMotion"]; origin?: CashOrigin; timer?: ReturnType<typeof setTimeout> };
const rain = new WeakMap<HTMLElement, Rain>();
export function setRainBanknote(host: HTMLElement | null, style: BanknoteStyle) {
  const stream = host && rain.get(host);
  if (stream) stream.banknoteStyle = style;
}
const coinLandings = new WeakMap<HTMLElement, Set<ReturnType<typeof setTimeout>>>();
function waitForCoinLanding(host:HTMLElement,duration:number,onLand?:()=>void) {
  if(!onLand)return;
  const timers=coinLandings.get(host)??new Set<ReturnType<typeof setTimeout>>();coinLandings.set(host,timers);
  // Keep extreme tapping bounded without revealing overflow coins immediately.
  if(timers.size>=48){const oldest=timers.values().next().value!;clearTimeout(oldest);timers.delete(oldest);}
  const timer=setTimeout(()=>{timers.delete(timer);if(host.isConnected && !document.hidden)onLand();},duration);
  timers.add(timer);
}

export function stopVisuals(host: HTMLElement | null) {
  if (!host) return;
  clearTimeout(rain.get(host)?.timer); rain.delete(host);
  for(const timer of coinLandings.get(host)??[])clearTimeout(timer);coinLandings.delete(host);
  for (const node of active.get(host) ?? []) { node.getAnimations?.({subtree:true}).forEach(a=>a.cancel()); node.remove(); }
  active.delete(host); last.delete(host); lastJackpot.delete(host); host.replaceChildren();
}

function animateParticle(host: HTMLElement, node: HTMLElement, frames: Keyframe[], duration: number, easing="linear", delay=0, limit=VISUAL_LIMIT) {
  const nodes=active.get(host)??new Set<HTMLElement>(); active.set(host,nodes);
  // Let each particle finish falling; new wins refill the available space.
  if (nodes.size>=Math.min(limit, rain.get(host)?.budget.total ?? limit)) return null;
  nodes.add(node); host.append(node);
  const remove=()=>{node.querySelectorAll("*").forEach(child=>child.getAnimations?.().forEach(a=>a.cancel())); node.remove(); nodes.delete(node);};
  if (!node.animate) { remove(); return null; }
  const animation=node.animate(frames,{duration,delay,fill:"both",easing});
  animation.onfinish=remove; animation.oncancel=remove;
  return animation;
}

export function launchCoin(host:HTMLElement|null,from:DOMRect,to:DOMRect,reduced:boolean,won:boolean,profit=0,intensity=1,onLand?:()=>void) {
  if (!host || document.hidden) return;
  const coin=document.createElement("div"); coin.className="flying-coin";
  const rotor=document.createElement("div"); rotor.className="coin-rotor"; coin.append(rotor);
  for (const face of ["bull","bear"]) {
    const side=document.createElement("div"); side.className=`coin-face coin-${face}`;
    const image=document.createElement("img"); image.src=`/flip-${face}-coin.png`; image.alt="";
    side.append(image); rotor.append(side);
  }
  const label=document.createElement("b"); label.className=`coin-landing ${won?"bull":"bear"}`;
  label.textContent=(profit>0?"+":"")+money(profit); coin.append(label);
  const x=from.left+from.width*.5,y=from.top+8,tx=to.left+to.width*(.35+Math.random()*.5),ty=to.top+to.height*(.3+Math.random()*.45);
  const drift=(Math.random()-.5)*90*Math.sqrt(intensity),lift=Math.min(115,Math.max(40,(y-ty)*.3));
  coin.style.left=`${reduced?tx:x}px`; coin.style.top=`${reduced?ty:y}px`;
  coin.dataset.result=won?"win":"loss";
  const flight=2600+Math.random()*600,hold=1400,duration=flight+hold;
  const rotation=360*(3+Math.round(intensity))+(won?0:180),end=`translate(${tx-x}px,${ty-y}px)`;
  let landed=false;
  const land=()=>{if (!landed && coin.isConnected && !document.hidden) { landed=true; onLand?.(); }};
  if (reduced) {
    rotor.style.transform=`rotateY(${won?0:180}deg)`;
    if(animateParticle(host,coin,[{opacity:1},{opacity:1,offset:.8},{opacity:0}],1400,"linear",0,48))land();
    else onLand?.();
    return;
  }
  const flightEnd=flight/duration;
  const travel=animateParticle(host,coin,[
    {transform:"scale(.65)",opacity:1,easing:"cubic-bezier(.2,.6,.35,1)"},
    {transform:`translate(${(tx-x)*.65+drift}px,${ty-y-lift}px) scale(1.2)`,opacity:1,offset:flightEnd*.48,easing:"ease-in-out"},
    {transform:`translate(${tx-x+drift*.15}px,${ty-y-18}px) scale(1.12)`,opacity:1,offset:flightEnd*.85,easing:"ease-out"},
    {transform:`${end} scale(1.08)`,opacity:1,offset:flightEnd},
    {transform:`${end} scale(1.08)`,opacity:1,offset:.94},
    {transform:`${end} scale(1.02)`,opacity:0},
  ],duration,"linear",0,48);
  if(!travel) { waitForCoinLanding(host,flight,onLand); return; }
  const spin=rotor.animate([
    {transform:"rotateY(0deg) rotateZ(-18deg)"},
    {transform:`rotateY(${rotation-360}deg) rotateZ(14deg)`,offset:.55},
    {transform:`rotateY(${rotation-75}deg) rotateZ(-5deg)`,offset:.84,easing:"cubic-bezier(.15,.7,.3,1)"},
    {transform:`rotateY(${rotation}deg) rotateZ(0deg)`},
  ],{duration:flight,easing:"linear",fill:"both"});
  spin.onfinish=land;
  label.animate([{opacity:0},{opacity:0,offset:flightEnd},{opacity:1,offset:flightEnd+.025},{opacity:1}],{duration,fill:"both"});
}

export type WinImpact = {amount?:number;cashAmount?:number;streak?:number;milestone?:boolean;origin?:CashOrigin};
export const payoutMilestone=(before:number,after:number)=>after>=10 && Math.floor(Math.log10(after))>Math.floor(Math.log10(Math.max(1,before)));
export const particleCount=(amount=0,jackpot=false,milestone=false)=>Math.min(48,Math.max(8,8+Math.floor(Math.log10(Math.max(1,amount)))*4+(jackpot?8:0)+(milestone?12:0)));

// Incoming origins use viewport coordinates, including the LAB preview surface.
export function cashOrigin(host: Pick<DOMRect,"left"|"top"|"width"|"height">, source?: CashOrigin): CashOrigin {
  const x = source ? source.x - host.left : host.width * .5;
  const y = source ? source.y - host.top : host.height * .32;
  return {
    x: Math.max(0, Math.min(host.width, Number.isFinite(x) ? x : host.width * .5)),
    y: Math.max(0, Math.min(host.height, Number.isFinite(y) ? y : host.height * .32)),
    width: Math.min(host.width, source?.width && Number.isFinite(source.width) ? source.width : host.width * .6),
  };
}

function moneyFlight(host:HTMLElement,node:HTMLElement,energy:number,motion:Settings["cashMotion"]="rain",source?:CashOrigin, box?:FlightBox) {
  const rect=box ?? host.getBoundingClientRect();
  const angle=(Math.random()-.5)*100,turn=(Math.random()-.5)*170;
  if(motion==="burst") {
    const origin=cashOrigin(rect,source),spread=Math.min(rect.width*.42,180)*Math.min(1.25,Math.sqrt(energy));
    const drift=(Math.random()-.5)*spread*2,lift=55+Math.random()*85;
    const start=origin.x+(Math.random()-.5)*Math.min(120,origin.width*.35);
    node.style.left=`${Math.max(0,Math.min(rect.width,start))}px`;
    node.style.top=`${origin.y+(Math.random()-.5)*12}px`;
    return animateParticle(host,node,[
      {opacity:0,transform:`translate(-50%,-50%) rotate(${angle}deg) scale(.45)`},
      {opacity:1,offset:.13,transform:`translate(calc(-50% + ${drift*.2}px),calc(-50% - ${lift*.55}px)) rotate(${angle+turn*.2}deg) scale(1)`},
      {opacity:1,offset:.48,transform:`translate(calc(-50% + ${drift*.65}px),calc(-50% - ${lift}px)) rotate(${angle+turn*.6}deg) scale(1.05)`},
      {opacity:0,transform:`translate(calc(-50% + ${drift}px),calc(-50% + 25px)) rotate(${angle+turn}deg) scale(.7)`},
    ],900+Math.random()*400,"ease-out");
  }
  const x=Math.random()*rect.width,drift=(Math.random()-.5)*Math.min(180,rect.width*.45),sway=(Math.random()>.5?1:-1)*(25+Math.random()*40);
  const distance=rect.height+240;
  node.style.left=`${x}px`;node.style.top="-130px";
  return animateParticle(host,node,[
    {opacity:0,transform:`translate(-50%,0) rotate(${angle}deg)`},
    {opacity:1,offset:.06},
    {transform:`translate(calc(-50% + ${drift*.3+sway}px),${distance*.3}px) rotate(${angle+turn*.35}deg)`,offset:.3},
    {transform:`translate(calc(-50% + ${drift*.65-sway*.5}px),${distance*.65}px) rotate(${angle+turn*.65}deg)`,offset:.65},
    {opacity:1,offset:.92},
    {opacity:0,transform:`translate(calc(-50% + ${drift}px),${distance}px) rotate(${angle+turn}deg)`},
  ],5200+Math.random()*1800);
}

function fallingParticle(host:HTMLElement,style:string,energy:number,index:number,stream?:Rain,box?:FlightBox) {
  const node=document.createElement("i");
  node.className=`result-particle particle-${style}`;
  node.style.setProperty("--particle-color",["#ffe066","#7beaff","#ff88cc","#b5ff8a"][index%4]);
  node.style.setProperty("--particle-scale",String(Math.min(1.6,.8+energy*.2)));
  return moneyFlight(host,node,energy,stream?.motion,stream?.origin,box);
}

function shockwaves(host:HTMLElement,energy:number) {
  const count=[...(active.get(host)??[])].filter(n=>n.className==="jackpot-shockwave").length;
  for(let wave=0;wave<Math.min(3,6-count);wave++){
    const ring=document.createElement("div");ring.className="jackpot-shockwave";
    animateParticle(host,ring,[{opacity:0,transform:"translate(-50%,-50%) scale(.1)"},{opacity:.85-wave*.12,offset:.18},{opacity:0,transform:`translate(-50%,-50%) scale(${2+energy+wave*.5})`}],1800+wave*250,"ease-out",wave*240);
  }
}

function rainAccent(host:HTMLElement,stream:Rain,box:FlightBox) {
  if(!stream.tier || performance.now()-stream.accentAt<4800)return;
  stream.accentAt=performance.now();
  shockwaves(host,stream.energy);
  if(stream.tier===2 && ![...(active.get(host)??[])].some(n=>n.className==="cash-flood-halo")){
    const halo=document.createElement("div");halo.className="cash-flood-halo";
    animateParticle(host,halo,[{opacity:0,transform:"scale(.8) rotate(-12deg)"},{opacity:.8,offset:.3},{opacity:.6,offset:.75},{opacity:0,transform:"scale(1.3) rotate(12deg)"}],stream.motion==="burst"?1200:6500);
  }
  for(let i=0;i<8;i++)fallingParticle(host,"neon",stream.energy,i,stream,box);
}

function addRain(host:HTMLElement,tokens:CashToken[],energy:number,festival:boolean,tier:number,settings:Settings,origin?:CashOrigin) {
  if(!host.animate)return;
  const current=rain.get(host);
  if(current){current.queue=compactCash([...current.queue,...tokens]);current.energy=Math.max(current.energy,energy);current.festival ||= festival;current.tier=Math.max(current.tier,tier);current.banknoteStyle=settings.banknoteStyle;current.motion=settings.cashMotion;current.origin=origin;return;}
  const stream:Rain={budget:visualBudget(mobileEffects()),queue:tokens,energy,festival,tier,banknoteStyle:settings.banknoteStyle,motion:settings.cashMotion,origin,serial:0,accentAt:-Infinity};rain.set(host,stream);
  const emit=()=>{
    if(rain.get(host)!==stream)return;
    if(document.hidden || !host.isConnected){stopVisuals(host);return;}
    const nodes=[...(active.get(host)??[])],cash=nodes.filter(n=>n.className==="result-particle particle-cash").length;
    let confetti=nodes.filter(n=>n.className==="result-particle particle-confetti").length;
    // Read geometry once, before appending any of this emission's particles.
    const box=host.getBoundingClientRect();
    rainAccent(host,stream,box);
    const batch=Math.min(stream.queue.length,stream.budget.cash-cash,stream.budget.batch);
    for(let i=0;i<batch;i++){
      const token=stream.queue[0],node=createCashSprite(token,stream.banknoteStyle);
      const width=token.denomination<=100?42:stream.tier?170:130;
      node.style.width=`${width}px`;node.style.height=`${width*(token.denomination<=100?1:.44)}px`;
      if(!moneyFlight(host,node,stream.energy,stream.motion,stream.origin,box))break;
      stream.queue.shift();stream.serial++;
      if(stream.festival && confetti<stream.budget.confetti && fallingParticle(host,"confetti",stream.energy,stream.serial,stream,box)){confetti++;}
    }
    if(stream.queue.length>0)stream.timer=setTimeout(emit,stream.motion==="burst"?90:200);
    else rain.delete(host);
  };
  emit();
}

export function playResultVisual(host:HTMLElement|null,cue:Cue,settings:Settings,detail:WinImpact={}) {
  if(!host || document.hidden || settings.motion==="reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const jackpot=["jackpot","chain","infinity"].includes(cue),win=["win","bigwin","streak","armed","pulse"].includes(cue);
  if(!jackpot && !win)return;
  let style=jackpot?settings.jackpotVisual:settings.winVisual;
  if(style==="classic")return;
  if(style==="mix")style=(["cash","gold","neon","confetti"] as const)[Math.floor(Math.random()*4)];
  const energy=effectEnergy(settings,detail)*(jackpot?1.8:1),cash=style==="cash"||style==="festival"||style==="gold";
  // Count every settled win, including fast spins that share one shower.
  if(cash){const plan=cashRainPlan(detail.cashAmount??detail.amount,style==="gold");if(plan.tokens.length)addRain(host,plan.tokens,energy,style==="festival",plan.tier,settings,detail.origin);}
  const clock=jackpot?lastJackpot:last;
  if(performance.now()-(clock.get(host)??-Infinity)<(jackpot?450:250))return;
  clock.set(host,performance.now());
  if(jackpot)shockwaves(host,energy);
  if(cash)return;
  const count=Math.min(72,Math.max(jackpot?32:4,Math.round(particleCount(detail.amount,jackpot,detail.milestone)*energy)));
  const box=host.getBoundingClientRect(),limit=visualBudget(mobileEffects()).total;
  for(let i=0;i<count;i++){
    if((active.get(host)?.size??0)>=Math.min(288,limit))break;
    fallingParticle(host,style,energy,i,undefined,box);
  }
}
