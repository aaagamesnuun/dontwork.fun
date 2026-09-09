import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BANKNOTES } from "./banknotes";
import { BanknotePicker } from "./BanknotePicker";
import { configure, freshRun, readSave } from "./game/engine";

describe("banknote preferences", () => {
  it("migrates the old default once, then keeps deliberate fixed artwork and rain selections", () => {
    const base=freshRun();
    const old={...base,settings:{...base.settings,cashPresentationRevision:undefined,banknoteStyle:"terminal",cashMotion:undefined}};
    const loaded=readSave(JSON.stringify(old))!;
    expect(loaded.settings).toMatchObject({banknoteStyle:"random",cashMotion:"burst",cashPresentationRevision:1});
    expect(loaded.cash).toBe(base.cash);expect(loaded.debug).toBe(false);
    const explicit=configure(loaded,{banknoteStyle:"terminal",cashMotion:"rain"});
    expect(readSave(JSON.stringify(explicit))!.settings).toMatchObject({banknoteStyle:"terminal",cashMotion:"rain"});
    expect(readSave(JSON.stringify({...old,settings:{...old.settings,banknoteStyle:"hologram"}}))!.settings.banknoteStyle).toBe("hologram");
  });
  it("uses burst by default and preserves an explicit rain choice without changing rules", () => {
    for (const cashMotion of [undefined, null, "invalid"]) {
      const run=freshRun();
      expect(readSave(JSON.stringify({...run,settings:{...run.settings,cashMotion}}))?.settings.cashMotion).toBe("burst");
    }
    const run=configure(freshRun(),{cashMotion:"rain"});
    expect(run.debug).toBe(false);
    expect(readSave(JSON.stringify(run))?.settings.cashMotion).toBe("rain");
  });
  it("adopts random for new and existing saves, and recovers unknown cosmetic values", () => {
    expect(freshRun().settings.banknoteStyle).toBe("random");
    const old = { ...freshRun(), cash: 54321, peak: 54321 };
    for (const banknoteStyle of [undefined, null, "unknown"]) {
      const loaded = readSave(JSON.stringify({ ...old, settings: { ...old.settings, banknoteStyle } }));
      expect(loaded?.settings.banknoteStyle).toBe("random");
      expect(loaded?.cash).toBe(54321);
    }
  });
  it.each(BANKNOTES)("persists $id without changing progress or ranked eligibility", note => {
    const run = { ...freshRun(), cash: 12345, peak: 12345, spins: 7 };
    const changed = configure(run, { banknoteStyle: note.id });
    expect(changed).toEqual({ ...run, settings: { ...run.settings, banknoteStyle: note.id } });
    expect(readSave(JSON.stringify(changed))).toMatchObject({ cash: run.cash, spins: run.spins, debug: false, settings: { banknoteStyle: note.id } });
    const html = renderToStaticMarkup(<BanknotePicker value={note.id} onChange={() => {}} />);
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain(`checked="" value="${note.id}"`);
    for (const option of BANKNOTES) expect(html).toContain(option.src);
  });
});
