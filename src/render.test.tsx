import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import App from "./App";
import { CATALOGS } from "./game/catalog";
import { freshRun } from "./game/engine";

afterEach(() => vi.unstubAllGlobals());
describe("game rendering", () => {
  it.each(CATALOGS)("renders the $0 onboarding for $id", (c) => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(freshRun(c.id)),
    });
    const html = renderToString(<App />);
    expect(html).toContain("まずWORK");
    expect(html.slice(html.indexOf('class="sweep-panel'),html.indexOf('class="chart-page'))).not.toContain("共通の出目");
    expect(html).not.toContain("READY");
    expect(html).not.toContain("100でJACKPOT");
    const news = html.slice(
      html.indexOf('class="news-strip'),
      html.indexOf('class="balance-header'),
    );
    expect(news.match(/<button/g)).toHaveLength(1);
    expect(news).toContain('aria-label="このニュースの説明"');
    expect(html).not.toContain('class="main-tabs');
    expect(html.indexOf('class="play-dock')).toBeGreaterThan(html.indexOf("</main>"));
    expect(html.indexOf('class="dock-upgrade')).toBeGreaterThan(html.indexOf('id="work-button"'));
    expect(html).toContain("WORK");
    expect(html).toContain("AUTO");
    expect(html).toContain("クリア目標:1B$");
    expect(html).not.toContain("NaN");
  });
  it("renders saved infinity and very large balances without crashing", () => {
    const s = {
      ...freshRun(),
      cash: 1e200,
      peak: 1e200,
      portfolio: [{ id: "edge-50", count: 1 }],
      removed: 99,
      rushLeft: 100000,
      chain: 4000,
      memory: {
        "streak-1": { streak: 3000, previous: 100, misses: 0, armed: false },
      },
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(s) });
    expect(renderToString(<App />)).toContain("INFINITY JACKPOT");
  });
});
