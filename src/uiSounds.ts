import { uiSound, type Cue } from "./audio";
import type { Settings } from "./game/engine";
export function actionCue(
  annotation: string | undefined,
  checked?: boolean,
): Cue | null {
  if (annotation === "handled") return null;
  if (annotation === "auto") return checked ? "toggle-on" : "toggle-off";
  return annotation === "work" ||
    annotation === "equip" ||
    annotation === "upgrade"
    ? annotation
    : "ui";
}
export function installUISounds(getSettings: () => Settings) {
  let lastRange = -Infinity;
  const queued = new WeakMap<Event, Cue>();
  const capture = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    let element: Element | null = event.target;
    if (event.type === "click") element = element.closest("button, a, summary");
    else if (element.matches("input[type=range]")) {
      if (performance.now() - lastRange < 80) return;
      lastRange = performance.now();
    } else if (
      event.type !== "change" ||
      !element.matches(
        "select, input[type=checkbox], input[type=radio], input[type=file]",
      )
    )
      return;
    if (!element || element.matches(":disabled, [aria-disabled='true']"))
      return;
    const cue = actionCue(
      element.closest<HTMLElement>("[data-ui-cue]")?.dataset.uiCue,
      (element as HTMLInputElement).checked,
    );
    if (cue) queued.set(event, cue);
  };
  const play = (event: Event) => {
    const cue = queued.get(event);
    // React can disable/remove a successful button before this bubble phase.
    // Capture its intention first, but read the resulting mute settings later.
    if (cue) queueMicrotask(() => uiSound(cue, getSettings()));
  };
  const close = () => uiSound("ui", getSettings());
  for (const event of ["click", "change", "input"]) {
    document.addEventListener(event, capture, true);
    document.addEventListener(event, play);
  }
  document.addEventListener("bebullish-ui-close", close);
  return () => {
    for (const event of ["click", "change", "input"]) {
      document.removeEventListener(event, capture, true);
      document.removeEventListener(event, play);
    }
    document.removeEventListener("bebullish-ui-close", close);
  };
}
