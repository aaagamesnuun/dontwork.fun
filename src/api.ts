import { servicesEnabled } from "./serviceConfig";
import { t as _t } from "./i18n";
import { soundAssignment, soundExperimentProps } from "./soundExperiment";
import { VERSION, ECONOMY_REVISION, fuelCapacity, rollFloor, status, totalCost, settlePortfolio, stakeOf, isInfinite, interval, UPGRADES, type Run, type Settings, } from "./game/engine";
import { betById } from "./game/catalog";
export const ruleset = (s: Run) => `astra-v${ECONOMY_REVISION}${s.trial ? s.trial.scoring==="assets"?"-30m-assets":"-30m" : ""}:` + s.catalog;
export const apiMoney = (n: number) => Math.max(-1e15, Math.min(1e15, Number.isFinite(n) ? n : 0));
const apiCount = (n: number) => Math.max(0, Math.min(1e8, Math.round(n)));
export async function request<T>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
    if(!servicesEnabled())throw new Error(_t("このビルドではオンライン機能が無効です。進行は端末に保存されます。"));
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
        response = await fetch(path, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
            keepalive: path === "/api/telemetry",
        });
    }
    finally {
        clearTimeout(timer);
    }
    if (!response.ok)
        throw new Error(response.status === 429
            ? _t("少し時間をおいて、もう一度送ってください。") : _t("通信できませんでした。時間をおいて再度お試しください。"));
    try {
        return (await response.json()) as T;
    }
    catch {
        throw new Error(_t("この機能は公開サイトで利用できます。"));
    }
}
export interface Score {
    id: number;
    nickname: string;
    timeMs: number;
    spins: number;
}
export const scorePath = (s: Run) => `/api/leaderboard?mode=${s.catalog === "classic" ? "classic" : "deck"}&rulesetVersion=${encodeURIComponent(ruleset(s))}`;
export function snapshot(s: Run) {
    return {
        gameMode: s.trial ? "30m" : "normal", trialRule: s.trial?.rule ?? "none", trialElapsedMs: s.trial?.elapsedMs ?? 0, trialAddedMs: s.trial?.addedMs ?? 0, trialPaused: s.trial?.paused ?? false,
        backgroundPlay: s.settings.backgroundPlay, backgroundMs: s.backgroundMs, backgroundJackpot:s.backgroundJackpot, bigChangeNotifications:s.settings.bigChangeNotifications, rollDisplay:s.settings.rollDisplay, language:s.settings.language, trialScoring:s.trial?.scoring??"none",
        jackpotNotifications: s.settings.jackpotNotifications, sweepSound: s.settings.sweepSound, coinChartMarkers: s.settings.coinChartMarkers, streakEffects: s.settings.streakEffects, effectIntensity: s.settings.effectIntensity,
        sharedSpin: s.settings.sharedSpin, spinSize: s.settings.spinSize, brandIcon: s.settings.brandIcon, wealthTheme: s.settings.wealthTheme, adaptiveMusic: s.settings.adaptiveMusic,
        workMode: s.settings.workMode, workCosmetics: s.settings.workCosmetics, upgradeTutorial: s.settings.upgradeTutorial, workFxLevel: s.workFxLevel,
        pwaInstalled: typeof navigator !== "undefined" && ((navigator as Navigator & {
            standalone?: boolean;
        }).standalone === true || (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches)),
        browserFamily: typeof navigator !== "undefined" ? (/CriOS/i.test(navigator.userAgent) ? "ios-chrome" : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios-safari" : /Android/i.test(navigator.userAgent) ? "android" : "desktop") : "desktop",
        bankroll: apiMoney(s.cash),
        peakBankroll: apiMoney(s.peak),
        fuel: Math.floor(s.fuel),
        fuelEnabled: s.settings.fuelEnabled,
        newsPosition: s.settings.newsPosition,
        chartWindowSpins: s.settings.chartWindowSpins,
        assistUsed: s.assistUsed,
        jackpotRule: s.settings.jackpotRule,
        showJackpotCounter: s.settings.showJackpotCounter,
        spinsSinceJackpot: s.spinsSinceJackpot,
        jackpotHigh: s.jackpotHigh,
        fuelCapacity: fuelCapacity(s),
        slotCount: s.slots,
        spinSpeedLevel: s.speed,
        fuelCapacityLevel: s.capacity,
        totalSpins: apiCount(s.spins),
        totalDraws: apiCount(s.draws),
        totalWork: apiCount(s.work),
        bankruptcies: 0,
        cleared: s.clearAt !== null,
        status: status(s),
        isRunning: s.running,
        deck: s.portfolio,
        copies: Array.from(new Set(s.owned)).map((id) => ({
            id,
            count: s.owned.filter((x) => x === id).length,
        })),
        runMode: s.catalog,
        catalogId: s.catalog,
        rankedEligible: !s.debug,
        jackpotSpinsRemaining: apiCount(s.rushLeft),
        jackpotFloor: rollFloor(s),
        jackpotPersistentFloor: 1 + s.persistentRemoved,
        jackpotSpinGrant: s.settings.rushBase + s.rush * 5,
        jackpotSpinIntervalMs: s.settings.jackpotSpinIntervalMs,
        trimLevel: s.trim,
        rushLevel: s.rush,
        assist: s.settings.assist,
        assistAfter: s.settings.assistAfter,
        opening: s.settings.opening,
        spinSpeedScale: s.settings.spinSpeedScale,
        rushBase: s.settings.rushBase,
        upgradePrices: s.settings.upgradePrices,
        economyProfile: s.settings.economyProfile,
        positionPriceBase: s.settings.positionPriceBase,
        positionPriceMultiplier: s.settings.positionPriceMultiplier,
        speedPriceBase: s.settings.speedPriceBase,
        speedPriceMultiplier: s.settings.speedPriceMultiplier,
        upgradeMode: s.settings.upgradeMode,
        upgradeDraws: apiCount(s.upgradeDraws),
        reelStyle: s.settings.reelStyle,
        soundMuted: !s.settings.sound,
        soundPack: s.settings.soundPack,
        workspaceMode: s.settings.workspaceMode, sharedChart: s.settings.sharedChart, oddsDisplay: s.settings.oddsDisplay, probabilityUpgrades: s.settings.probabilityUpgrades, baccarat: s.settings.baccarat, baccaratRounds: s.baccaratRounds,
        coinEnabled: s.coinEnabled, coinStake: s.coinStake, coinRounds: s.coinRounds, coinWins: s.coinWins, coinWagered: s.coinWagered, coinPaid: s.coinPaid,
        handToys: s.settings.handToys, dockToy: s.settings.dockToy, bestPayout: s.bestPayout, winStreak: s.winStreak,
        winVisual: s.settings.winVisual, jackpotVisual: s.settings.jackpotVisual, chartBackdrop: s.settings.chartBackdrop,
        chargeSound: s.settings.chargeSound,
        spinSound: s.settings.spinSound,
        chargeVolume: s.settings.chargeVolume,
        payoffStyle: s.settings.payoffStyle,
        sweepMotion: s.settings.sweepMotion,
        spinAssist: s.settings.spinAssist,
        spinAssistSequence: s.settings.spinAssistSequence,
        music: s.settings.music,
        jackpotMusic: s.settings.jackpotMusic,
        bassMode: s.settings.bassMode,
        jackpotAutoTab: s.settings.jackpotAutoTab,
        musicPack: s.settings.musicPack,
        musicVolume: s.settings.musicVolume,
        soundVolume: s.settings.soundVolume,
        lossVolume: s.settings.lossVolume,
        soundDensity: s.settings.soundDensity,
        shake: s.settings.shake,
        impactFlash: s.settings.impactFlash,
        revealDurationMs: s.settings.revealDurationMs,
        revealPacing: s.settings.revealPacing,
        revealRatio: s.settings.revealRatio,
        chartAxis: s.settings.chartAxis,
        haptics: s.settings.haptics,
        motion: s.settings.motion,
        fx: s.settings.fx,
        infinity: s.infinityAt !== null,
        maxChain: apiCount(s.maxChain),
        maxStreak: apiCount(s.maxStreak),
        requiredSpinCost: totalCost(s),
        totalProfit: apiMoney(s.lifetimeProfit),
        upgradeSpend: apiMoney(s.spent),
    };
}
export const localTelemetryHost = (hostname: string, development = false) => development || /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(hostname) || hostname.endsWith(".localhost");
export class Telemetry {
    private installId = "";
    private sessionId = crypto.randomUUID();
    private sequence = 0;
    private queue: Record<string, unknown>[] = [];
    private last: Run | null = null;
    private busy = false;
    private sealed = new Set<unknown>();
    private needsFlush = false;
    private disabled = false;
    private localOnly = localTelemetryHost(location.hostname, import.meta.env.DEV && import.meta.env.MODE !== "test");
    private feedbackRequests = new Set<Promise<unknown>>();
    private view = { tab: "spin", screen: "game", modal: "none" };
    private hidden = false;
    private waiting: {
        id: string;
        reason: string;
        active: number;
        at: number;
        work: number;
        spent: number;
        deck: string;
    } | null = null;
    async sendRating(s: Run, body: Record<string, unknown>) {
        const context = this.feedbackContext(s);
        const sending = request("/api/ratings", { ...body, telemetryEnabled: context !== null, context });
        this.feedbackRequests.add(sending);
        try {
            return await sending;
        }
        finally {
            this.feedbackRequests.delete(sending);
        }
    }
    async sendFeedback(s: Run, body: Record<string, unknown>) {
        const context = this.feedbackContext(s);
        const sending = request("/api/feedback", {
            ...body,
            telemetryEnabled: context !== null,
            context,
        });
        this.feedbackRequests.add(sending);
        try {
            return await sending;
        }
        finally {
            this.feedbackRequests.delete(sending);
        }
    }
    feedbackContext(s: Run) {
        if (!s.telemetry || this.disabled || !this.installId)
            return null;
        return {
            installId: this.installId,
            runId: s.id,
            sessionId: this.sessionId,
            rulesetVersion: ruleset(s),
            activeMs: Math.min(2592e6, Math.round(s.activeMs)),
            snapshot: { ...snapshot(s), ...this.view },
        };
    }
    visibility(s: Run, hidden: boolean) {
        if (this.hidden === hidden)
            return;
        this.hidden = hidden;
        this.event(s, hidden ? "session_end" : "session_start", hidden
            ? {
                reason: "hidden",
                status: status(s),
                ...this.view,
                ...(this.waiting ? { waitId: this.waiting.id } : {}),
            }
            : { entryKind: "resume", ...this.view });
        if (hidden)
            this.checkpoint(s);
    }
    private trackWait(s: Run, forcedResolution?: string) {
        const reason = s.running && ["cash", "fuel"].includes(status(s)) ? status(s) : null;
        const wait = this.waiting;
        if (wait && (wait.reason !== reason || forcedResolution)) {
            this.event(s, "wait_exit", {
                waitId: wait.id,
                reason: wait.reason,
                resolution: forcedResolution ??
                    (!s.running
                        ? this.hidden
                            ? "hidden"
                            : "paused"
                        : s.spent > wait.spent
                            ? "upgrade"
                            : JSON.stringify(s.portfolio) !== wait.deck
                                ? "rebuild"
                                : "work"),
                durationMs: Math.max(0, s.activeMs - wait.active),
                wallTimeMs: Date.now() - wait.at,
                workClicksDuringWait: Math.max(0, s.work - wait.work),
                bankrollEnd: apiMoney(s.cash),
                fuelEnd: s.fuel,
                statusEnd: status(s),
            });
            this.waiting = null;
        }
        if (reason && !this.waiting && !forcedResolution) {
            const id = crypto.randomUUID();
            this.waiting = {
                id,
                reason,
                active: s.activeMs,
                at: Date.now(),
                work: s.work,
                spent: s.spent,
                deck: JSON.stringify(s.portfolio),
            };
            this.event(s, "wait_enter", {
                waitId: id,
                reason,
                bankrollStart: apiMoney(s.cash),
                fuelStart: s.fuel,
                requiredCostStart: totalCost(s),
                statusStart: status(s),
                requested: true,
                deck: s.portfolio,
            });
        }
    }
    constructor() {
        if (this.localOnly) {
            this.disabled = true;
            return;
        }
        try {
            this.installId =
                localStorage.getItem("bebullish-install-id") ?? crypto.randomUUID();
            localStorage.setItem("bebullish-install-id", this.installId);
            const pending = JSON.parse(localStorage.getItem("bebullish-telemetry-pending") ?? "[]");
            if (Array.isArray(pending))
                this.queue = pending
                    .filter((e) => e &&
                    typeof e.eventId === "string" &&
                    typeof e.runId === "string" &&
                    typeof e.sessionId === "string" &&
                    typeof e.rulesetVersion === "string")
                    .slice(-120);
            this.sealed = new Set(this.queue.map((e) => e.eventId));
        }
        catch {
            this.disabled = true;
        }
    }
    private persist() {
        if (this.localOnly)
            return;
        try {
            localStorage.setItem("bebullish-telemetry-pending", JSON.stringify(this.queue));
        }
        catch {
            /* Local telemetry buffering is optional. */
        }
    }
    event(s: Run, eventName: string, props: Record<string, unknown> = {}) {
        if (eventName === "tab_view")
            this.view = {
                tab: String(props.tab ?? this.view.tab),
                screen: String(props.screen ?? this.view.screen),
                modal: String(props.modal ?? this.view.modal),
            };
        if (this.disabled || !s.telemetry)
            return;
        this.queue.push({
            eventId: crypto.randomUUID(),
            runId: s.id,
            sessionId: this.sessionId,
            sequence: this.sequence++,
            activeMs: Math.min(2592e6, Math.round(s.activeMs)),
            engagedMs: Math.min(2592e6, Math.round(Math.max(0, s.activeMs - s.backgroundMs))),
            eventName,
            appVersion: VERSION,
            rulesetVersion: ruleset(s),
            schemaVersion: 2,
            debug: s.debug,
            language: s.settings.language,
            deviceClass: innerWidth < 780 ? "mobile" : "desktop",
            viewportClass: innerWidth < 640 ? "small" : innerWidth < 1100 ? "medium" : "large",
            props: { ...props, ...soundExperimentProps(s.settings) },
        });
        if (this.queue.length > 120) {
            const dropped = this.queue.splice(0, this.queue.length - 120);
            dropped.forEach((e) => this.sealed.delete(e.eventId));
        }
    }
    observe(s: Run) {
        if (!s.telemetry) {
            this.queue = [];
            this.sealed.clear();
            this.persist();
            this.last = s;
            return;
        }
        if (!this.last && soundAssignment())
            this.event(s, "sound_assignment", { ...soundExperimentProps(s.settings) });
        if (!this.last || this.last.id !== s.id) {
            this.event(s, "session_start", {
                entryKind: s.entryKind ?? (s.spins || s.work ? "resume" : "fresh"),
                runMode: s.catalog,
            });
            this.event(s, "snapshot", { ...snapshot(s), ...this.view });
            this.persist();
            void this.flush();
        }
        this.last = s;
    }
    checkpoint(s: Run) {
        const old = this.last;
        this.observe(s);
        if (old && old.id === s.id) {
            const clicks = s.work - old.work;
            if (clicks > 0)
                this.event(s, "work_batch", { clicks, moneyEarned: clicks });
        }
        this.event(s, "snapshot", { ...snapshot(s), ...this.view });
        this.persist();
        void this.flush();
    }
    musicPlayed(s: Run, musicPack: Settings["musicPack"], playing: boolean, requested: boolean, rush: boolean, durationMs: number) {
        if (this.disabled || !s.telemetry || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 1000) return;
        const props = { musicPack, music: playing, requested, phase: rush ? "jackpot" : "normal", source: "foreground", durationMs };
        const batch = [...this.queue].reverse().find(e => {
            const p = e.props as typeof props;
            return e.runId === s.id && e.eventName === "music_play_batch" && !this.sealed.has(e.eventId) && p.musicPack === musicPack && p.music === playing && p.requested === requested && p.phase === props.phase;
        });
        if (batch) {
            const p = batch.props as typeof props;
            p.durationMs = Math.min(30 * 86400000, p.durationMs + durationMs);
            batch.activeMs = Math.round(s.activeMs);
        } else this.event(s, "music_play_batch", props);
    }
    changed(before: Run, after: Run) {
        if (!this.disabled && after.telemetry && before.id === after.id && after.coinRounds > before.coinRounds) {
            const props = { rounds: after.coinRounds - before.coinRounds, wins: after.coinWins - before.coinWins, wager: apiMoney(after.coinWagered - before.coinWagered), payout: apiMoney(after.coinPaid - before.coinPaid), coinRounds: after.coinRounds, coinWins: after.coinWins, coinWagered: after.coinWagered, coinPaid: after.coinPaid };
            const batch = [...this.queue].reverse().find(e => e.runId === after.id && e.eventName === "coin_batch" && !this.sealed.has(e.eventId) && Math.floor(Number(e.activeMs) / 10000) === Math.floor(after.activeMs / 10000));
            if (batch) {
                const old = batch.props as Record<string, number>;
                batch.props = { ...old, ...props, rounds: old.rounds + props.rounds, wins: old.wins + props.wins, wager: apiMoney(old.wager + props.wager), payout: apiMoney(old.payout + props.payout) };
            }
            else
                this.event(after, "coin_batch", props);
        }
        if (before.id === after.id && after.baccaratRounds > before.baccaratRounds && after.baccaratResult)
            this.event(after, "baccarat_round", { ...after.baccaratResult });
        if (before.id === after.id && before.betLevels !== after.betLevels)
            for (const [id, level] of Object.entries(after.betLevels))
                if (level > (before.betLevels[id] ?? 0))
                    this.event(after, "probability_upgrade", { cardId: id, levels: level, price: after.spent - before.spent });
        if (!after.telemetry) {
            this.waiting = null;
            this.observe(after);
            return;
        }
        if (before.id !== after.id) {
            this.trackWait(before, "reset");
            this.checkpoint(before);
            this.observe(after);
            return;
        }
        this.trackWait(after);
        if (before.spins === after.spins &&
            before.clearAt === null &&
            after.clearAt !== null)
            this.event(after, "clear", {
                wallTimeMs: after.startedAt ? after.clearAt - after.startedAt : 0,
            });
        if (before.startedAt === null && after.startedAt !== null)
            this.event(after, "interaction_start", { input: "pointer" });
        for (const [key, name] of [
            ["work", "first_work"],
            ["spent", "first_upgrade"],
        ] as const)
            if (before[key] === 0 && after[key] > 0)
                this.event(after, "milestone", { name });
        if (before.portfolio.length === 0 &&
            after.spins === 0 &&
            after.portfolio.some((r) => /^(?:long-)?edge-50$/.test(r.id)))
            this.event(after, "milestone", { name: "baseline_deployed" });
        if (!before.running && after.running && after.spins === 0)
            this.event(after, "milestone", { name: "first_agents_on" });
        if (before.spins === after.spins && before.rushLeft > 0 && after.rushLeft === 0)
            this.event(after, "jackpot", { phase: "end", floor: rollFloor(before), remaining: 0, reason: "position-change" });
        if (before.portfolio !== after.portfolio)
            this.event(after, "deck_change", { deck: after.portfolio });
        if (before.spent !== after.spent)
            this.event(after, "upgrade_purchase", {
                price: apiMoney(after.spent - before.spent),
                slotCount: after.slots,
                spinSpeedLevel: after.speed,
                trimLevel: after.trim,
                rushLevel: after.rush,
                source: after.upgradeDraws > before.upgradeDraws ? "gacha" : "direct",
                upgradeMode: after.settings.upgradeMode,
                upgradeDraws: apiCount(after.upgradeDraws),
                ...(after.upgradeDraws > before.upgradeDraws && after.lastUpgradeDraw
                    ? { kind: after.lastUpgradeDraw.upgrade, levels: 1 }
                    : {
                        kind: UPGRADES.find((u) => after[u] > before[u]) ?? "unknown",
                        levels: UPGRADES.reduce((n, u) => n + Math.max(0, after[u] - before[u]), 0),
                    }),
            });
        if (before.running !== after.running)
            this.event(after, "agents_toggle", { running: after.running });
        if (before.settings !== after.settings)
            this.event(after, "setting_change", snapshot(after));
        if (before.owned.length !== after.owned.length)
            this.event(after, "draft_choose", {
                chosenId: after.owned.at(-1),
                deck: after.portfolio,
            });
    }
    settled(before: Run, after: Run, background = false) {
        if (this.disabled || !after.telemetry)
            return;
        const source = background ? "background" : "foreground";
        if (!background && before.rushLeft > 0 && after.rushLeft === 0)
            this.event(after, "jackpot", {
                phase: "end",
                floor: rollFloor(before),
                remaining: 0,
            });
        if (!background && after.last?.jackpot &&
            after.last.id !== before.last?.id &&
            !isInfinite(before))
            this.event(after, "jackpot", {
                phase: before.rushLeft > 0 ? "extend" : "start",
                roll: after.last.roll,
                remaining: after.rushLeft,
                floor: rollFloor(after),
                trimApplied: after.last.trimAdded,
            });
        if (before.clearAt === null && after.clearAt !== null)
            this.event(after, "clear", {
                source,
                wallTimeMs: after.startedAt ? after.clearAt - after.startedAt : 0,
            });
        // Per-card economies are batched at the client; no request is made per spin.
        if (after.spins === before.spins)
            return;
        for (const [key, name] of [
            ["spins", "first_spin"],
            ["bestWin", "first_win"],
            ["jackpots", "first_jackpot"],
        ] as const)
            if (before[key] === 0 && after[key] > 0)
                this.event(after, "milestone", { name, source });
        const props: Record<string, unknown> = {
            source,
            engagedDurationMs: background ? 0 : interval(before),
            spins: 1,
            jackpots: Number(after.last?.jackpot ?? false),
            rushSpins: Number(before.rushLeft > 0),
            rushProfit: apiMoney(before.rushLeft > 0 ? (after.last?.profit ?? 0) : 0),
            durationMs: interval(before),
            wins: Number((after.last?.profit ?? 0) > 0),
            losses: Number((after.last?.profit ?? 0) < 0),
            wager: apiMoney(after.last?.wager ?? 0),
            payout: apiMoney(after.last?.payout ?? 0),
            profit: apiMoney(after.last?.profit ?? 0),
            deck: before.portfolio,
        };
        const mapKeys = [
            "spinByCard",
            "copySpinsByCard",
            "hitByCard",
            "wagerByCard",
            "payoutByCard",
            "penaltyByCard",
            "profitByCard",
        ];
        for (const key of mapKeys)
            props[key] = {};
        const settlement = settlePortfolio(before, after.last!.roll);
        for (const row of before.portfolio) {
            const b = betById(row.id), r = settlement.rows.find(item => item.id === row.id)!.result, wager = stakeOf(b, before) * row.count, payout = r.payout * row.count, penalty = r.penalty * row.count;
            const values = [
                1,
                row.count,
                Number(r.payout > 0 && r.penalty === 0),
                wager,
                payout,
                penalty,
                payout - wager - penalty,
            ];
            mapKeys.forEach((key, i) => ((props[key] as Record<string, number>)[row.id] = apiMoney(values[i])));
        }
        const tail = this.queue.at(-1);
        if (tail?.eventName === "spin_batch" &&
            !this.sealed.has(tail.eventId) &&
            tail.runId === after.id &&
            tail.debug === after.debug &&
            (tail.props as Record<string, unknown>).source === source &&
            JSON.stringify((tail.props as Record<string, unknown>).deck) ===
                JSON.stringify(before.portfolio)) {
            const p = tail.props as Record<string, unknown>;
            for (const k of [
                "spins",
                "wins",
                "losses",
                "wager",
                "payout",
                "profit",
                "jackpots",
                "rushSpins",
                "rushProfit",
                "durationMs",
                "engagedDurationMs",
            ])
                p[k] = apiMoney(Number(p[k] ?? 0) + Number(props[k]));
            for (const k of mapKeys) {
                const map = p[k] as Record<string, number>;
                for (const [id, n] of Object.entries(props[k] as Record<string, number>))
                    map[id] = apiMoney((map[id] ?? 0) + n);
            }
            tail.activeMs = Math.round(after.activeMs);
            tail.engagedMs = Math.round(Math.max(0, after.activeMs - after.backgroundMs));
        }
        else
            this.event(after, "spin_batch", props);
    }
    async flush() {
        if (this.busy) {
            this.needsFlush = true;
            return;
        }
        if (this.disabled ||
            !this.queue.length ||
            this.localOnly)
            return;
        this.busy = true;
        const head = this.queue[0];
        const batch = this.queue
            .filter((e) => e.runId === head.runId &&
            e.sessionId === head.sessionId &&
            e.rulesetVersion === head.rulesetVersion)
            .slice(0, 20);
        // Freeze events once attempted: acknowledgements and retries use exactly
        // this content, while new spins accumulate under a new event identity.
        batch.forEach((e) => this.sealed.add(e.eventId));
        this.persist();
        try {
            await request("/api/telemetry", {
                installId: this.installId,
                events: batch,
            });
            const sent = new Set(batch.map((e) => e.eventId));
            this.queue = this.queue.filter((e) => !sent.has(e.eventId));
            sent.forEach((id) => this.sealed.delete(id));
            this.persist();
        }
        catch {
            /* A bounded in-memory queue retries on the next checkpoint. */
        }
        finally {
            this.busy = false;
            if (this.needsFlush) {
                this.needsFlush = false;
                void this.flush();
            }
        }
    }
    async erase() {
        if (this.localOnly)
            return;
        this.disabled = true;
        this.queue = [];
        this.sealed.clear();
        this.persist();
        while (this.busy)
            await new Promise((resolve) => setTimeout(resolve, 50));
        await Promise.allSettled([...this.feedbackRequests]);
        try {
            await request("/api/telemetry", { installId: this.installId }, "DELETE");
        }
        finally {
            this.disabled = false;
        }
    }
}
export type FeedbackContext = ReturnType<Telemetry["feedbackContext"]>;
