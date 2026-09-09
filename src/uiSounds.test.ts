import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./game/engine";
const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("./audio", () => ({ uiSound: play }));
import { actionCue, installUISounds } from "./uiSounds";
afterEach(() => {
  vi.unstubAllGlobals();
  play.mockClear();
});
describe("UI action delegation", () => {
  it("maps navigation, Work, equip, upgrade and both Auto states", () => {
    expect(actionCue(undefined)).toBe("ui");
    expect(actionCue("auto", true)).toBe("toggle-on");
    expect(actionCue("auto", false)).toBe("toggle-off");
    for (const cue of ["work", "equip", "upgrade"] as const)
      expect(actionCue(cue)).toBe(cue);
    expect(actionCue("handled")).toBeNull();
  });
  it("sounds a successful action that becomes disabled, using the updated settings", async () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("document", {
      addEventListener: (
        name: string,
        handler: EventListener,
        capture = false,
      ) => listeners.set(`${name}:${capture}`, handler),
      removeEventListener: vi.fn(),
    });
    class Button {
      disabled = false;
      dataset = { uiCue: "equip" };
      closest() {
        return this;
      }
      matches() {
        return this.disabled;
      }
    }
    vi.stubGlobal("Element", Button);
    let settings = defaultSettings;
    const cleanup = installUISounds(() => settings),
      button = new Button(),
      event = { type: "click", target: button } as unknown as Event;
    listeners.get("click:true")!(event);
    button.disabled = true;
    settings = { ...defaultSettings, soundVolume: 0.2 };
    listeners.get("click:false")!(event);
    await Promise.resolve();
    expect(play).toHaveBeenCalledExactlyOnceWith("equip", settings);
    const disabledEvent = { type: "click", target: button } as unknown as Event;
    listeners.get("click:true")!(disabledEvent);
    listeners.get("click:false")!(disabledEvent);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
