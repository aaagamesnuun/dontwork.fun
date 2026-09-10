// Visit identity is independent of the event transport session and the saved run.
// A reload keeps the visit, while each page contributes its own duration maximum.
export const JOURNEY_KEY = "dontwork-journey-v1";
export const VISIT_GAP = 30 * 60 * 1000;
type Context = { origin: "new" | "saved"; language: "ja" | "en"; device: "mobile" | "desktop"; version: string; mode: "normal" | "30m" };
type Visit = Context & { id: string; start: number; active: number };
export class Journey {
    private visit: Visit | null = null;
    private foreground = 0;
    private playAt = 0;
    private savedAt = 0;
    constructor(private context: Context, private storage: Pick<Storage, "getItem" | "setItem">, private now = Date.now) {}
    private read(): Visit | null {
        try {
            const v = JSON.parse(this.storage.getItem(JOURNEY_KEY) ?? "null");
            return v && /^[a-f0-9-]{36}$/i.test(v.id) && Number.isFinite(v.start) && Number.isFinite(v.active) && v.active >= v.start ? v : null;
        } catch { return null; }
    }
    activate() {
        const now = this.now(), stored = this.read();
        const previous = stored && stored.active <= now && now - stored.active < VISIT_GAP ? stored : null;
        const next = previous ?? { ...this.context, id: crypto.randomUUID(), start: now, active: now };
        if (next.id !== this.visit?.id) { this.foreground = 0; this.playAt = 0; }
        this.visit = next;
        this.save();
    }
    private save() {
        try {
            const stored = this.read();
            if (stored && this.visit && stored.id !== this.visit.id && stored.active > this.visit.active) return;
            if (stored?.id === this.visit?.id && this.visit) this.visit.active = Math.max(stored!.active, this.visit.active);
            this.storage.setItem(JOURNEY_KEY, JSON.stringify(this.visit)); this.savedAt = this.now();
        } catch { /* Optional telemetry. */ }
    }
    played(ms = 0, action = true) {
        if (!action && !this.playAt) return;
        const now = this.now();
        if (!this.visit || now - this.visit.active >= VISIT_GAP) this.activate();
        const v = this.visit!;
        v.active = now;
        if (action) this.playAt ||= now;
        this.foreground += Math.max(0, Math.min(1000, ms));
        if (now - this.savedAt >= 1000) this.save();
    }
    props() {
        if (!this.visit) this.activate();
        const v = this.visit!;
        return { journey: { id: v.id, start: v.start, active: v.active, at: this.now(), play: this.playAt,
            foreground: Math.round(this.foreground), origin: v.origin, language: v.language, device: v.device, version: v.version, mode: v.mode } };
    }
    clear() { this.visit = null; this.foreground = 0; this.playAt = 0; try { this.storage.setItem(JOURNEY_KEY, "null"); } catch { /* Optional telemetry. */ } }
}
