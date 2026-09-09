import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { money, freshRun, configure, TARGET } from "./game/engine";
import { setMoneyStyle } from "./moneyPreferences";
import { WealthChart } from "./TradingViews";
import { GameOverview } from "./Onboarding";
import App from "./App";
afterEach(()=>{setMoneyStyle("compact");vi.unstubAllGlobals();});
it("expands K/M/B into grouped numbers without altering game state or ranking eligibility",()=>{
  const run=freshRun(),before=JSON.stringify(run);expect(money(1e9)).toBe("$1B");
  setMoneyStyle("full");expect(money(1e3)).toBe("$1,000");expect(money(1e6)).toBe("$1,000,000");expect(money(1e9)).toBe("$1,000,000,000");
  expect(money(-1234.56)).toBe("−$1,234.56");expect(money(1e30)).not.toMatch(/[KMBTe+]/);
  expect(JSON.stringify(run)).toBe(before);expect(configure(run,{sound:false}).debug).toBe(false);
});
it("renders full chart amounts and the explicit goal with the logo before the title",()=>{
  const run={...freshRun(),cash:1e6,peak:1e6,spins:10,history:[{cash:1e6,at:1000,spin:10,kind:"win"}]};
  setMoneyStyle("full");expect(renderToStaticMarkup(<WealthChart s={run}/>)).toContain("$1,000,000");
  vi.stubGlobal("localStorage",{getItem:()=>JSON.stringify(run)});
  const html=renderToStaticMarkup(<App/>);expect(html).toContain("クリア目標:1,000,000,000$");
  expect(html.indexOf('class="brand-icon"')).toBeLessThan(html.indexOf('class="brand-name"'));
  setMoneyStyle("compact");expect(renderToStaticMarkup(<App/>)).toContain("クリア目標:1B$");
});
it("makes clearing the game explicit on the first page",()=>{
  const text=renderToStaticMarkup(<GameOverview/>).replace(/<[^>]*>/g,"");
  expect(text).toContain("ギャンブルで1ビリオン稼いだらクリア！");expect(TARGET).toBe(1e9);
});
