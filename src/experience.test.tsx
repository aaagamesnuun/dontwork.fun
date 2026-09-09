import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { configure, freshRun, readSave, work, type Run } from "./game/engine";
import { clearCardRun, ResultCard } from "./ResultCard";
import { WealthChart } from "./TradingViews";
import { deskFeatures, holdGameLock } from "./DesktopHost";
import { Leaderboard } from "./Leaderboard";
import App from "./App";

afterEach(()=>vi.unstubAllGlobals());
describe("common spin and result experience",()=>{
  it("adopts the common surface for old saves once, retaining future LAB choices and progress",()=>{
    const old={...freshRun(),cash:54321,speed:8,settings:{...freshRun().settings,sharedSpin:false,sharedSpinRevision:undefined}};
    const adopted=readSave(JSON.stringify(old))!;
    expect(adopted).toMatchObject({cash:54321,speed:8,debug:false,settings:{sharedSpin:true,spinSize:"compact"}});
    const custom=configure(adopted,{sharedSpin:false,spinSize:"expanded",brandIcon:"bull"});
    expect(readSave(JSON.stringify(custom))).toMatchObject({cash:54321,speed:8,debug:false,settings:{sharedSpin:false,spinSize:"expanded",brandIcon:"bull"}});
    expect(readSave(JSON.stringify({...custom,settings:{...custom.settings,spinSize:"giant"}}))).toBeNull();
  });
  it("renders a single sweep before the chart and a trophy beside contact",()=>{
    const s=configure(freshRun(),{brandIcon:"bull"});
    vi.stubGlobal("localStorage",{getItem:()=>JSON.stringify(s)});
    const html=renderToStaticMarkup(<App/>);
    expect(html.match(/class="roll-station /g)).toHaveLength(1);
    expect(html.indexOf('class="shared-spin"')).toBeLessThan(html.indexOf('class="chart-page"'));
    expect(html).not.toContain('class="main-tabs');expect(html).toContain('class="positions-page"');expect(html).toContain('dock-upgrade');
    expect(html.indexOf('aria-label="問い合わせ"')).toBeLessThan(html.indexOf('aria-label="ランキング"'));
    expect(html).toContain('/icons/dontwork.svg');
    expect(html).toContain('dontwork');expect(html).toContain('.fun');
  });
  it("freezes only the history through the clear and shows the whole run in the record",()=>{
    const s={...freshRun(),cash:2e9,spins:900,activeMs:4000000,clearSpins:700,clearActiveMs:3000000,clearAt:1,
      history:[{spin:0,at:0,cash:0,kind:"start"},{spin:400,at:2000000,cash:1e7,kind:"spin"},{spin:700,at:3000000,cash:1e9,kind:"spin"},{spin:900,at:4000000,cash:2e9,kind:"spin"}]} as Run;
    const frozen=clearCardRun(s);
    expect(frozen.history).toHaveLength(3);expect(frozen.cash).toBe(1e9);expect(frozen.spins).toBe(700);
    s.history[2].cash=9e9;expect(frozen.history[2].cash).toBe(1e9);
    const markup=renderToStaticMarkup(<><WealthChart s={s}/><ResultCard s={frozen} name="PLAYER"/></>);
    const ids=[...markup.matchAll(/<linearGradient id="([^"]+)"/g)].map(m=>m[1]);
    expect(new Set(ids).size).toBe(2);
    const card=markup.slice(markup.indexOf('class="result-card"'));
    expect(card).toContain('PLAYER');expect(card).toContain('$1B');expect(card).not.toContain('chart-range-control');
    expect(card).not.toContain('>0</span>');
    expect(card).toContain('>350</span>');expect(card).toContain('>700</span>');
  });
  it("keeps the result screen focused on the card and required name, without the ranking table",()=>{
    const s={...freshRun(),clearAt:1,clearSpins:4,clearActiveMs:1000,cash:1e9,completion:{id:"result",appVersion:"2.3.0",rulesetVersion:"astra-v9:classic",catalog:"classic",timeMs:1000,spins:4,ranked:true}} as Run;
    const html=renderToStaticMarkup(<Leaderboard s={s} change={()=>{}} clear notify={()=>{}} saveName={()=>s}/>);
    expect(html).not.toContain('クリア記念カード');expect(html).toContain('required=""');
    expect(html).not.toContain('ランキングを見る');expect(html).not.toContain('ranking-controls');
    expect(html).not.toContain('ランキングを読み込んでいます');
  });
  it("keeps the narrow window inside a small screen work area",()=>{
    expect(deskFeatures({availWidth:1366,availHeight:768,availTop:24})).toContain('width=420,height=768,left=946,top=24');
    expect(deskFeatures({availWidth:360,availHeight:640})).toContain('width=360,height=640,left=0,top=0');
  });
  it("keeps the earned card unchanged after continued play and save import",()=>{
    const cleared=work({...freshRun(),cash:1e9-1,activeMs:2000,spent:4000,maxChain:12});
    const continued={...cleared,cash:8e9,spent:500000,maxChain:100,spins:4000,history:[]};
    const restored=readSave(JSON.stringify(continued))!;
    const card=clearCardRun(restored);
    expect(card).toMatchObject({cash:1e9,spent:4000,maxChain:12});
    expect(card.history.at(-1)).toMatchObject({cash:1e9,kind:"clear"});
    expect(restored.clearSnapshot!.history.length).toBeLessThanOrEqual(150);
  });
  it("holds ownership until cleanup and never starts a canceled waiting game",async()=>{
    let acquire:(()=>Promise<void>)|undefined;
    const enter=vi.fn(),failed=vi.fn();
    const locks={request:vi.fn((_name:string,_options:object,callback:()=>Promise<void>)=>{acquire=callback;return Promise.resolve();})} as unknown as LockManager;
    const leave=holdGameLock(locks,enter,failed);
    const released=vi.fn();
    const held=acquire!().then(released);
    await Promise.resolve();expect(enter).toHaveBeenCalledOnce();expect(released).not.toHaveBeenCalled();
    leave();await held;expect(released).toHaveBeenCalledOnce();
    const canceled=holdGameLock(locks,enter,failed);canceled();await acquire!();
    expect(enter).toHaveBeenCalledOnce();expect(failed).not.toHaveBeenCalled();
  });
});
