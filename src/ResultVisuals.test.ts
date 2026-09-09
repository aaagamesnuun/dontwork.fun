import { defaultSettings } from "./game/engine";
import { it, expect, vi, afterEach, beforeEach } from "vitest";
import { playResultVisual, launchCoin, stopVisuals, cashRainPlan, setRainBanknote, cashOrigin } from "./ResultVisuals";
import { BANKNOTES } from "./banknotes";
import { cashImage, createCashSprite } from "./cashSprites";
import { cashCents, type CashDenomination } from "./cashPlan";

class Node {
  children:Node[]=[]; parent:Node|null=null; root=false; className="";style:Record<string,unknown>={setProperty:()=>{}};dataset:Record<string,string>={};src="";alt="";textContent="";
  motions:{frames:Keyframe[];options:KeyframeAnimationOptions;cancel:ReturnType<typeof vi.fn>;onfinish:null|(()=>void);oncancel:null|(()=>void)}[]=[];
  getBoundingClientRect(){return {left:30,top:20,width:400,height:700};}
  get isConnected():boolean{return this.root || !!this.parent?.isConnected;}
  append(n:Node){this.children.push(n);n.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
  replaceChildren(){this.children=[];}
  querySelectorAll():Node[]{return this.children.flatMap(n=>[n,...n.querySelectorAll()]) as Node[];}
  getAnimations(options?:{subtree?:boolean}){return [...this.motions,...(options?.subtree?this.querySelectorAll().flatMap(n=>n.motions):[])];}
  animate(frames:Keyframe[],options:KeyframeAnimationOptions){const animation={frames,options,cancel:vi.fn(),onfinish:null,oncancel:null};this.motions.push(animation);return animation;}
}
const rect=(x:number,y:number)=>({left:x,top:y,width:100,height:100}) as DOMRect;
const hosts:Node[]=[];
const host=()=>{const n=new Node();n.root=true;hosts.push(n);return n;};
const element=(n:Node)=>n as unknown as HTMLElement;
beforeEach(()=>{
  vi.useFakeTimers();vi.stubGlobal("document",{hidden:false,createElement:()=>new Node()});
  vi.stubGlobal("matchMedia",()=>({matches:false}));vi.stubGlobal("HTMLImageElement",Node);
});
afterEach(()=>{for(const h of hosts)stopVisuals(element(h));hosts.length=0;vi.useRealTimers();vi.unstubAllGlobals();});
it("randomizes each note across all three artworks while keeping each bundle consistent",()=>{
  const random=vi.spyOn(Math,"random");
  try {
    for(const [index,note] of BANKNOTES.entries()){
      random.mockReturnValue((index+.5)/3);
      const sprite=createCashSprite({denomination:1000,units:20n},"random") as unknown as Node;
      expect(sprite.children).toHaveLength(3);
      expect(sprite.children.every(n=>n.src===cashImage(1000,note.id))).toBe(true);
      expect(sprite.dataset.cents).toBe("20000");
    }
  } finally {random.mockRestore();}
});
it("slows into both final coin faces, reveals the label at landing and leaves time to read it",()=>{
  for(const won of [true,false]){
    const h=host(),onLand=vi.fn();launchCoin(element(h),rect(0,500),rect(0,100),false,won,won?100:-100,1,onLand);
    const coin=h.children[0],rotor=coin.children[0],label=coin.children[1];
    const flight=Number(rotor.motions[0].options.duration),duration=Number(coin.motions[0].options.duration);
    expect(rotor.children.map(n=>n.children[0].src)).toEqual(["/flip-bull-coin.png","/flip-bear-coin.png"]);
    expect(rotor.motions[0].frames.at(-1)?.transform).toBe(`rotateY(${won?1440:1620}deg) rotateZ(0deg)`);
    expect(flight).toBeGreaterThanOrEqual(2500);expect(duration-flight).toBeGreaterThanOrEqual(1200);
    expect(rotor.motions[0].frames.at(-2)?.easing).toContain("cubic-bezier");
    expect(label.textContent).toBe(won?"+$100":"−$100");
    expect(label.motions[0].options.fill).toBe("both");
    expect(label.motions[0].frames[1]).toMatchObject({opacity:0,offset:flight/duration});
    expect(onLand).not.toHaveBeenCalled();rotor.motions[0].onfinish?.();rotor.motions[0].onfinish?.();expect(onLand).toHaveBeenCalledTimes(1);
    coin.motions[0].onfinish?.();
    expect(h.children).toHaveLength(0);expect(rotor.motions[0].cancel).toHaveBeenCalled();expect(label.motions[0].cancel).toHaveBeenCalled();
  }
});
it("cancels child animation and does not announce an interrupted or hidden coin",()=>{
  const h=host(),onLand=vi.fn();launchCoin(element(h),rect(0,500),rect(0,100),false,false,0,1,onLand);
  const rotor=h.children[0].children[0],animations=h.getAnimations({subtree:true});stopVisuals(element(h));rotor.motions[0].onfinish?.();
  expect(onLand).not.toHaveBeenCalled();expect(h.children).toHaveLength(0);expect(animations.every(a=>a.cancel.mock.calls.length>0)).toBe(true);
  launchCoin(element(h),rect(0,500),rect(0,100),false,true,0,1,onLand);
  vi.stubGlobal("document",{hidden:true});h.children[0].children[0].motions[0].onfinish?.();expect(onLand).not.toHaveBeenCalled();
});
it("shows a static reduced-motion coin immediately and bounds rapid launches",()=>{
  const h=host(),onLand=vi.fn();launchCoin(element(h),rect(0,500),rect(0,100),true,false,0,1,onLand);
  expect(h.children[0].children[0].style.transform).toBe("rotateY(180deg)");expect(h.children[0].children[0].motions).toHaveLength(0);expect(onLand).toHaveBeenCalledTimes(1);
  const first=h.children[0];for(let i=0;i<80;i++)launchCoin(element(h),rect(0,500),rect(0,100),false,true);
  expect(h.children).toHaveLength(48);expect(h.children).toContain(first);
  vi.stubGlobal("document",{hidden:true});launchCoin(element(h),rect(0,500),rect(0,100),false,true);expect(h.children).toHaveLength(48);
});
it.each(BANKNOTES)("uses $id for both wins and jackpots, including delayed notes",note=>{
  for(const cue of ["win","jackpot"] as const){
    const h=host();
    playResultVisual(element(h),cue,{...defaultSettings,banknoteStyle:note.id},{amount:1e6});
    const first=h.children.filter(n=>n.className.includes("particle-cash")).length;
    vi.advanceTimersByTime(400);
    const cash=h.children.filter(n=>n.className.includes("particle-cash"));
    expect(cash.length).toBeGreaterThan(first);
    expect(cash.every(n=>n.children.every(image=>image.src===cashImage(Number(n.dataset.denomination) as CashDenomination,note.id)))).toBe(true);
  }
});
it("switches future rain notes without interrupting the existing shower",()=>{
  const h=host();playResultVisual(element(h),"win",{...defaultSettings,banknoteStyle:"terminal"},{amount:20000});
  const first=[...h.children];
  setRainBanknote(element(h),"hologram");vi.advanceTimersByTime(200);
  expect(first.every(n=>h.children.includes(n))).toBe(true);
  expect(first.filter(n=>n.className.includes("particle-cash")).every(n=>n.children[0].src==="/banknotes/terminal-1000.webp")).toBe(true);
  const next=h.children.filter(n=>!first.includes(n)&&n.className.includes("particle-cash"));
  expect(next.length).toBeGreaterThan(0);expect(next.every(n=>n.children[0].src==="/banknotes/hologram-1000.webp")).toBe(true);
});
it("keeps slow notes and confetti visible until they fall past the viewport",()=>{
  const h=host();playResultVisual(element(h),"win",{...defaultSettings,cashMotion:"rain"},{amount:100});
  expect(h.children.some(n=>n.className.includes("particle-cash"))).toBe(true);
  expect(h.children.some(n=>n.className.includes("particle-confetti"))).toBe(true);
  for(const node of h.children){
    const motion=node.motions[0];expect(Number(motion.options.duration)).toBeGreaterThanOrEqual(5000);
    expect(motion.frames.at(-2)).toMatchObject({opacity:1});expect(motion.frames.at(-2)?.offset).toBeGreaterThan(.9);
    expect(motion.frames.at(-1)?.transform).toContain("940px");
  }
});
it("emits exactly the payout, regardless of intensity, streak and Jackpot bonuses",()=>{
  for(const effectIntensity of [.25,1,2])for(const cue of ["win","jackpot"] as const){
    const h=host();playResultVisual(element(h),cue,{...defaultSettings,effectIntensity,streakEffects:true,banknoteStyle:"terminal"},{amount:200,cashAmount:20,streak:30,milestone:true});
    vi.advanceTimersByTime(1000);
    const cash=h.children.filter(n=>n.dataset.cents);
    expect(cash).toHaveLength(2);expect(cash.every(n=>n.children[0].src==="/banknotes/terminal-10.webp")).toBe(true);
    expect(cash.reduce((sum,n)=>sum+BigInt(n.dataset.cents),0n)).toBe(2000n);
  }
  const h=host();playResultVisual(element(h),"jackpot",defaultSettings,{amount:20,cashAmount:0});
  expect(h.children.filter(n=>n.dataset.cents)).toHaveLength(0);
});
it("starts burst money at the Sweep position, including a host offset, and fades it quickly",()=>{
  expect(cashOrigin({left:30,top:20,width:400,height:700},{x:230,y:240,width:300})).toEqual({x:200,y:220,width:300});
  const h=host();playResultVisual(element(h),"win",{...defaultSettings,cashMotion:"burst"},{amount:20,origin:{x:230,y:240,width:300}});
  for(const node of h.children){
    expect(Number.parseFloat(String(node.style.top))).toBeGreaterThanOrEqual(214);
    expect(Number.parseFloat(String(node.style.top))).toBeLessThanOrEqual(226);
    const motion=node.motions[0];expect(Number(motion.options.duration)).toBeGreaterThanOrEqual(900);
    expect(Number(motion.options.duration)).toBeLessThanOrEqual(1300);
    expect(motion.frames.at(-1)?.opacity).toBe(0);
    expect(motion.frames.at(-1)?.transform).toContain("25px");
    motion.onfinish?.();
  }
  expect(h.children).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps the value of fast wins while draining a bounded merged queue",()=>{
  const h=host(),settings={...defaultSettings,cashMotion:"burst" as const};
  const values=[1e9,20,21.03,250,1e6];
  for(const amount of values)playResultVisual(element(h),"win",settings,{amount});
  const seen=new Set<Node>();let cents=0n;
  for(let frame=0;frame<12;frame++){
    for(const node of [...h.children]){
      if(!seen.has(node)&&node.dataset.cents)cents+=BigInt(node.dataset.cents);
      seen.add(node);node.motions[0].onfinish?.();
    }
    vi.advanceTimersByTime(100);
  }
  expect(cents).toBe(values.reduce((sum,amount)=>sum+cashCents(amount),0n));
  expect(vi.getTimerCount()).toBe(0);expect(h.children).toHaveLength(0);
});
it("bounds a huge win, uses visible bundles without multiplier text, and conserves its value",()=>{
  const h=host();playResultVisual(element(h),"jackpot",{...defaultSettings,effectIntensity:2,streakEffects:true},{amount:1e200,streak:30,milestone:true});
  const first=[...h.children];expect(first.some(n=>n.className==="cash-flood-halo")).toBe(true);
  vi.advanceTimersByTime(2000);
  const cash=h.children.filter(n=>n.dataset.cents);
  expect(cash).toHaveLength(cashRainPlan(1e200).notes);
  expect(cash.reduce((sum,n)=>sum+BigInt(n.dataset.cents),0n)).toBe(cashCents(1e200));
  expect(cash.every(n=>n.dataset.bundle==="true"&&n.children.length===3&&n.textContent==="")).toBe(true);
  expect(first.every(n=>h.children.includes(n))).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  stopVisuals(element(h));expect(h.children).toHaveLength(0);
});
it("counts fast wins even when they share a shower and never abruptly removes earlier particles",()=>{
  const h=host();playResultVisual(element(h),"win",defaultSettings,{amount:1e6});const first=[...h.children];
  for(let i=0;i<30;i++)playResultVisual(element(h),"win",defaultSettings,{amount:1e6});
  vi.advanceTimersByTime(1000);expect(first.every(n=>h.children.includes(n))).toBe(true);expect(h.children.length).toBeLessThanOrEqual(328);
});
it("reads the viewport once per emission, not once per banknote or confetti",()=>{
  const h=host(),measure=vi.spyOn(h,"getBoundingClientRect");
  playResultVisual(element(h),"win",{...defaultSettings,cashMotion:"rain"},{amount:1e6});
  expect(h.children.length).toBeGreaterThan(14);
  expect(measure).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(200);expect(measure).toHaveBeenCalledTimes(2);
});
it("bounds phone particles without dropping any win value or shortening their flight",()=>{
  vi.stubGlobal("matchMedia",(query:string)=>({matches:query==="(pointer: coarse)"}));
  const h=host(),amounts=[1e9,1e9,1e8];
  for(const amount of amounts)playResultVisual(element(h),"jackpot",{...defaultSettings,cashMotion:"rain"},{amount});
  let cents=0n;
  for(let step=0;step<160;step++){
    vi.advanceTimersByTime(200);
    expect(h.children.length).toBeLessThanOrEqual(164);
    const notes=h.children.filter(n=>n.dataset.cents);
    expect(notes.length).toBeLessThanOrEqual(96);
    // Leave the first wave in flight until the phone budget is full.
    if(step<40)continue;
    for(const n of [...h.children]){
      if(n.dataset.cents){cents+=BigInt(n.dataset.cents);expect(Number(n.motions[0].options.duration)).toBeGreaterThanOrEqual(5200);}
      n.motions[0]?.onfinish?.();
    }
    if(!vi.getTimerCount()&&!h.children.length)break;
  }
  expect(cents).toBe(amounts.reduce((sum,n)=>sum+cashCents(n),0n));
  expect(vi.getTimerCount()).toBe(0);
});
it.each(["hidden","detached"])("stops replenishing a %s surface",mode=>{
  const h=host();playResultVisual(element(h),"win",defaultSettings,{amount:1e9});
  if(mode==="hidden")vi.stubGlobal("document",{hidden:true});else h.root=false;
  vi.advanceTimersByTime(200);expect(h.children).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
});
it("respects both reduced-motion settings even for a huge jackpot",()=>{
  const h=host();playResultVisual(element(h),"jackpot",{...defaultSettings,motion:"reduced"},{amount:1e9});expect(h.children).toHaveLength(0);
  vi.stubGlobal("matchMedia",()=>({matches:true}));playResultVisual(element(h),"jackpot",defaultSettings,{amount:1e9});expect(h.children).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
});

it("waits for coin results even when the visible coin limit is full, and cancels deferred results",()=>{
  const h=host();for(let i=0;i<48;i++)launchCoin(element(h),rect(0,500),rect(0,100),false,true);
  const onLand=vi.fn();launchCoin(element(h),rect(0,500),rect(0,100),false,false,0,1,onLand);
  expect(onLand).not.toHaveBeenCalled();vi.advanceTimersByTime(2500);expect(onLand).not.toHaveBeenCalled();
  vi.advanceTimersByTime(800);expect(onLand).toHaveBeenCalledTimes(1);
  for(let i=0;i<100;i++)launchCoin(element(h),rect(0,500),rect(0,100),false,false,0,1,onLand);
  expect(h.children).toHaveLength(48);expect(vi.getTimerCount()).toBeLessThanOrEqual(48);
  stopVisuals(element(h));vi.advanceTimersByTime(10000);expect(onLand).toHaveBeenCalledTimes(1);
});
