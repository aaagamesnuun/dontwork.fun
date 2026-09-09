import { afterEach, describe, expect, it, vi } from "vitest";
import { haptic } from "./feedback";
afterEach(() => vi.unstubAllGlobals());
describe("haptic fallback", () => {
  it("does not attempt arbitrary synthetic switch clicks on devices without vibration", () => {
    vi.stubGlobal("document", { hidden: false });
    vi.stubGlobal("navigator", {});
    expect(haptic("jackpot", { haptics: true })).toBe(false);
  });
  it("suppresses all vibration when disabled or hidden", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("document", { hidden: true });
    expect(haptic("jackpot", { haptics: true })).toBe(false);
    vi.stubGlobal("document", { hidden: false });
    expect(haptic("jackpot", { haptics: false })).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
