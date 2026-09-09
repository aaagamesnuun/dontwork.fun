import { useLanguage, setLanguage } from "./i18n";
import { t as _t, textValue as _text } from "./i18n";
import { BackgroundSettings } from "./BackgroundSettings";
import { TrialClock, TrialModes, TrialTimeShop, TrialResult, TrialLeaderboard } from "./TimeTrial";
import { switchTrialMode } from "./trialSaves";
import { saveTrialName, flushTrialScores } from "./trialScores";
import { pauseTrial, trialAssets, trialActive, freshTrial, type TrialRule } from "./game/engine";
import { settleAccepted } from "./presentation";
import { SweepAudio } from "./SweepAudio";
import { ChartNotices } from "./ChartNotices";
import { notificationTransition, notifyJackpot, notifyBigChange } from "./jackpotNotifications";
import { fundsBecameLow } from "./fundsAlert";
import { HandToyButton } from "./HandToy";
import { payoutMilestone, type WinImpact } from "./ResultVisuals";
import { coinUnlocked, needsCoinUnlockNotice, acknowledgeCoinUnlock } from "./game/engine";
import { soundPackSettings } from "./soundPresets";
import { backgroundAccess, holdBackgroundJackpot, resumeBackgroundJackpot, advanceBackground, backgroundSave, startBackground } from "./backgroundPlay";
import { resultSound } from "./resultSound";
import { createSweepSignal, SweepMotionDriver } from "./SweepReadout";
import { SoundPackPicker } from "./SoundPackPicker";
import { Rating, shouldAskClearRating, markClearRating } from "./Rating";
import { CoinFlip, nextDockPanel, dockLabel, type DockPanel } from "./CoinFlip";
import { launchCoin, playResultVisual, stopVisuals, setRainBanknote } from "./ResultVisuals";
import { GameHelp, NewsHelp } from "./GameHelp";
import { flushSync } from "react-dom";
import { useWorkBurst } from "./WorkBurst";
import { preloadCashImages } from "./cashSprites";
import { initializeSoundExperiment } from "./soundExperiment";
import { useReleaseCheck, ReleaseNotice, VersionLinks } from "./ReleaseNotice";
import { CAPTURE_SAVE_KEY, captureSpin, recordingRun, type CaptureSession } from './captureScenario';
import { flushRankings, saveCompletionName, completionTarget } from "./rankingOutbox";
import { wealthStage, musicForWealth } from "./ReleaseLab";
import { InstallWelcome, PwaHelp, usePwa, needsPwa, isMobileDevice } from "./Pwa";
import { safeToApplyUpdate, saveAndReload, updateDialogSafe } from "./pwaUpdates";
import { SaveTransfer } from "./SaveTransfer";
import { UpgradeSpend } from "./UpgradeSpend";
import { guidance, unlockedSince, type Guidance } from "./game/guidance";
import { GameOverview, JackpotHelp, INTRO_KEY } from "./Onboarding";
import { framePending, sweepSnapshot } from "./game/sweep";
import { autoCycle, shouldFollowJackpot, spinTiming } from "./spinTiming";
import { presentationReducer, presentedRun, coinBudget } from "./presentation";
import { betOdds, hitFacesText, percent } from "./game/odds";
import { useReducedMotion } from "./useReducedMotion";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { betById, catalogById, type Bet } from "./game/catalog";
import { purchaseProbability, probabilityPrice, probabilityCap, SAVE_KEY, TARGET, availableBets, rollWeights, workCosmeticPrice, purchaseWorkCosmetic, canSpin, configure, duration, firstBet, freshRun, fuelCapacity, interval, isInfinite, mem, money, nextDistribution, payoutOf, purchase, drawUpgrade, upgradeDrawPool, upgradeDrawPrice, readSave, resolve, rollFloor, setCount, spin, stakeOf, totalCost, unlocked, upgradePrice, upgradeUnlocked, VERSION, usedSlots, work, type Run, type PositionIntent, type Upgrade, } from "./game/engine";
import { Draft, Feedback, Lab, Leaderboard, Presets, SettingsPanel, Stats, } from "./Panels";
import { sound, uiSound, wakeAudio, installAudioRecovery, setAudioEnabled, setBackgroundAudio, spinCharge, stopSpinCharge, stopSounds, drainAudioHealth, musicPulse, audioEnabled, } from "./audio";
import { installUISounds } from "./uiSounds";
import { haptic, stopHaptics } from "./feedback";
import { impact, stopImpact } from "./impact";
import { registerGameTools } from "./webmcp";
import { NativeSwitch } from "./NativeSwitch";
import { GrowthStrip, PayoffSweep, WealthChart, type SweepFrame, } from "./TradingViews";
import { Telemetry, request } from "./api";
export type Change = (fn: (s: Run) => Run) => void;
const UPGRADE_INFO: Record<Upgrade, [
    string,
    string,
    string
]> = {
    speed: ["CLOCK SPEED", "スピン周期", "抽選の間隔を短くする。"],
    slots: ["POSITIONS", "ポジション数", "同じギャンブルも、重ねて装備できる。"],
    capacity: [
        "COMPUTE",
        "スピン容量",
        "まとめて回せる回数を増やす。購入で全回復。",
    ],
    trim: [
        "出目カット",
        "ジャックポットカット量",
        "ジャックポット中だけ有効。ジャックポットが重なるたび低い出目をカット。連鎖が終わると元に戻る。",
    ],
    rush: [
        "RUSH EXTENSION",
        "ジャックポットスピン回数",
        "ジャックポット時に補充する最大回数を5回増やす。",
    ],
};
export function Modal({ title, children, onClose, wide = false, dismissible = true, className = "", }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
    dismissible?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        ref.current?.showModal();
        return () => ref.current?.close();
    }, []);
    return (<dialog ref={ref} className={`modal ${wide ? "wide" : ""} ${className}`} onCancel={(e) => {
            e.preventDefault();
            document.dispatchEvent(new Event("bebullish-ui-close"));
            if (dismissible)
                onClose();
        }} onClick={(e) => {
            if (dismissible && e.target === e.currentTarget) {
                document.dispatchEvent(new Event("bebullish-ui-close"));
                onClose();
            }
        }}>
      <header className="modal-header">
        <h2>{_text(title)}</h2>
        {dismissible && <button className="icon-button" onClick={onClose} aria-label={_t("閉じる")}>
          ×
        </button>}
      </header>
      <div className="modal-body">{children}</div>
    </dialog>);
}
function condition(b: Bet) {
    if (b.pattern === "step" || b.pattern === "support")
        return `${b.first?.join("–")} → ${b.second?.join("–")}`;
    if (b.pattern === "odd")
        return "ODD";
    if (b.pattern === "even")
        return "EVEN";
    if (b.pattern === "barbell")
        return `1–${b.width / 2} / ${101 - b.width / 2}–100`;
    if (b.pattern === "compare")
        return `${b.direction === "up" ? "↑" : b.direction === "down" ? "↓" : "↕"} ${b.delta}`;
    if (b.pattern === "islands")
        return "THREE ISLANDS";
    if (b.pattern === "rising")
        return "NUMBER × PAYOUT";
    return b.width === 1
        ? String(b.start)
        : `${b.start}–${Math.min(100, b.start + b.width - 1)}`;
}
export function BetCard({ b, s, change, onDetails, guided = false, highlightRemove = false, onBlocked, pending = false, onPosition, onProbability, }: {
    b: Bet;
    s: Run;
    change: Change;
    onDetails?: () => void;
    pending?: boolean;
    onPosition?: (intent: PositionIntent) => void;
    onProbability?: (id: string) => void;
    guided?: boolean;
    highlightRemove?: boolean;
    onBlocked?: (id: string, reason: string) => void;
}) {
    const odds = useMemo(() => betOdds(s, b), [b, s.portfolio,s.memory,s.betLevels,s.removed,s.rushLeft,s.fuel,s.spins,s.last,s.settings]);
    const formula = s.settings.oddsDisplay === "fraction";
    const concise = !!onDetails;
    const count = s.portfolio.find((r) => r.id === b.id)?.count ?? 0, open = unlocked(s, b), m = mem(s, b.id), next = b.pattern === "ladder"
        ? resolve(s, b, Math.max(rollFloor(s), b.start)).payout
        : b.pattern === "drought"
            ? payoutOf(b, s) + m.misses * (b.increment ?? 0)
            : payoutOf(b, s);
    return (<article className={`bet-card ${formula ? "formula-card" : ""} ${count ? "equipped" : ""} ${open ? "" : "locked"} ${m.armed ? "armed" : ""}`}>
      {!concise && <div className="bet-heading">
        <span className="bet-code">
          {b.pattern === "ladder"
                ? "↗"
                : b.pattern === "step"
                    ? "↳"
                    : b.pattern === "drought"
                        ? "◒"
                        : "∿"}{" "}
          {s.settings.probabilityUpgrades && (s.betLevels[b.id] ?? 0) > 0 ? _t("基本 {0} ＋{1}出目", condition(b), s.betLevels[b.id]) : condition(b)}
        </span>
        {count > 0 ? (<span className="position-tag">
            {count} POSITION{count > 1 ? "S" : ""}
          </span>) : !open ? (<span className="muted">{_t("{0}で解放", money(b.unlock))}</span>) : (<span className="muted">{b.legacy ? "SPECIAL" : "AVAILABLE"}</span>)}
      </div>}
      <div className="card-title">
        <h3>{b.name}</h3>
        {onDetails && (<button className="card-details" aria-label={_t("{0}の説明", b.name)} onClick={onDetails}>
            ?
          </button>)}
      </div>
      {!concise && <p className="bet-description">{_text(s.settings.jackpotRule !== "hundred" && ["trim", "rush-extend"].includes(b.pattern) ? b.description.replace(/100/g, _t("ジャックポット")) : b.description)}</p>}
      {formula ? <div className="expected-equation" aria-label={_t("1ポジション、次の1スピンの期待純利益")}>
        <span className="equation-term expected-term"><small>{["support", "roll-shift"].includes(b.pattern) ? _t("自己期待値") : _t("期待値")}</small><strong className={odds.expectedNet < 0 ? "negative" : "positive"}>{money(odds.expectedNet)}</strong></span>
        <span className="equation-sign">=</span>
        <span className="equation-term"><small>{odds.variable ? _t("平均配当") : _t("配当")}</small><strong>{money(odds.averagePayout)}</strong></span>
        <span className="equation-sign">×</span>
        <span className="equation-term" title={_t("配当が出る確率。配当が賭け金以下の当たりも含みます。")}><small>{b.pattern === "support" ? _t("発動率") : _t("勝率")}</small><strong>{percent(odds.hit)}</strong></span>
        <span className="equation-sign">−</span>
        <span className="equation-term wager-term"><small>{odds.expectedPenalty > 0 ? _t("賭け金＋損失") : _t("賭け金")}</small><strong>{money(stakeOf(b, s) + odds.expectedPenalty)}</strong></span>
      </div> : <div className="bet-odds">
        <span className="odds-primary" title={_t("次の1スピンで収支がプラスになる確率。現在の連勝・出目カットを反映。")}><small>{b.pattern === "support" ? _t("発動率") : _t("勝率")}</small><strong>{percent(odds.win)}</strong></span>
        {odds.win !== odds.hit && <span>{_t("当たり {0} · 配当が賭け金以下の場合も含む", percent(odds.hit))}</span>}
      </div>}
      {formula && !onDetails && <p className="equation-note">{_t("期待値は、次の1スピンの平均純利益です。勝率は配当が出る確率で、賭け金以下の当たりも含みます。変動する配当や追加損失は平均額で計算します。")}</p>}
      <p className="hit-faces">{_t("当たり出目:")}<strong>{hitFacesText(odds.outcomes)}</strong></p>
      {formula && b.pattern === "support" && <p className="bet-effect">{_t("成立時、他の当たり配当 ×{0}", b.multiplier)}</p>}
      {formula && b.pattern === "roll-shift" && <p className="bet-effect">{_t("{0}スピンごとに共通の出目 +{1}", b.target, b.effect)}</p>}
      {s.settings.probabilityUpgrades && <button className="probability-upgrade" data-ui-cue="upgrade" disabled={!onProbability || probabilityPrice(s, b.id) === null || s.cash < (probabilityPrice(s, b.id) ?? 0)} onClick={() => onProbability?.(b.id)}>
        {probabilityCap(b) === 0 ? _t("確率強化の対象外") : _t("当たり強化 Lv {0} · {1}", s.betLevels[b.id] ?? 0, probabilityPrice(s, b.id) === null ? "MAX" : money(probabilityPrice(s, b.id)!))}
        <small>{_t("当たりの出目を1つ追加{0}", ["step", "support", "compare", "high-streak", "reversal"].includes(b.pattern) ? _t(" · 前提条件は必要") : "")}</small>
      </button>}
      <div className="mini-spectrum" aria-hidden="true">
        {Array.from({ length: 100 }, (_, i) => (<i key={i} className={odds.outcomes[i] === null
                ? "trimmed"
                : odds.outcomes[i]?.hit
                    ? "positive"
                    : ""}/>))}
      </div>
      {!concise && (b.pattern === "ladder" ||
            b.pattern === "drought" ||
            b.pattern === "loss-ladder" ||
            b.pattern === "step") && (<div className={`memory-line ${m.armed ? "gold" : ""}`}>
          {b.pattern === "ladder"
                ? _t("{0}連勝 · 勝つたび配当 ×{1}", m.streak, b.multiplier) : b.pattern === "loss-ladder"
                ? _t("{0}連敗 · 次の賭け金 {1} · 当たりで戻る", m.misses, money(stakeOf(b, s))) : b.pattern === "drought"
                ? _t("{0}回のハズレが配当に積み上がる", m.misses) : m.armed
                ? s.settings.probabilityUpgrades && (s.betLevels[b.id] ?? 0) > 0 ? _t("NEXT SPIN → 強化後の当たり範囲で配当") : _t("NEXT SPIN → {0} で確定", b.second?.join("–"))
                : _t("{0} で次の抽選にチャンス", b.first?.join("–"))}
        </div>)}
      <div className="bet-bottom">
        {!formula && <><div className="wager-term">
          <span className="micro">{_t("賭け金")}</span>
          <strong>{money(stakeOf(b, s))}</strong>
        </div>
        <span className="bet-arrow">→</span>
        <div className="pay-column">
          <span className="micro">
            {b.pattern === "rising" ? "MAX PAYOUT" : "PAYOUT"}
          </span>
          <strong>{b.pattern === "support" ? _t("他の当たり ×{0}", b.multiplier) : b.pattern === "roll-shift" ? _t("出目 +{0}", b.effect) : money(next)}</strong>
        </div>
        </>}
        <div className="counter" data-ui-cue="equip">
          <button className={highlightRemove && count ? "guide-target" : ""} onClick={() => onPosition ? onPosition({ kind: "count", id: b.id, delta: -1 }) : change((s) => setCount(s, b.id, -1))} disabled={pending || !count} aria-label={_t("{0}を1つ外す", b.name)}>
            −
          </button>
          <span>{count}</span>
          <button className={guided ? "guide-target" : ""} onClick={() => {
            if (usedSlots(s) >= s.slots) {
                onBlocked?.(b.id, "positions-full");
                return;
            }
            if (b.legacy && s.catalog !== "all-test" && count >= s.owned.filter(id => id === b.id).length) {
                onBlocked?.(b.id, "no-copy");
                return;
            }
            if (onPosition)
                onPosition({ kind: "count", id: b.id, delta: 1 });
            else
                change(run => setCount(run, b.id, 1));
        }} disabled={pending || !open} aria-disabled={usedSlots(s) >= s.slots || (b.legacy && s.catalog !== "all-test" && count >= s.owned.filter(id => id === b.id).length)} aria-label={_t("{0}を1つ装備", b.name)}>
            +
          </button>
        </div>
      </div>
    </article>);
}
export default function App({ onOpenDesk, studio }: {
    onOpenDesk?: () => void;
    studio?: CaptureSession;
} = {}) {
    const releaseCheck = useReleaseCheck(VERSION, !studio);
    const saveKey = studio ? CAPTURE_SAVE_KEY : SAVE_KEY;
    const osReduced = useReducedMotion();
    const uiLanguage=useLanguage();
    const pwa = usePwa();
    const [updating, setUpdating] = useState(false), [updateError, setUpdateError] = useState("");
    const autoUpdateAllowed = useRef(true), reloadStarted = useRef(false);
    const [model, dispatch] = useReducer(presentationReducer, undefined, () => {
        if (studio)
            return { run: recordingRun(structuredClone(studio.initialRun)), pending: null };
        let run: Run;
        try {
            const raw = localStorage.getItem(saveKey);
            run = initializeSoundExperiment(readSave(raw) ?? freshRun(), !raw);
            if (!backgroundAccess(run))
                run = pauseTrial({ ...run, running:false, background: null },run.background?.at??Date.now());
        }
        catch {
            run = freshRun();
        }
        return { run, pending: null };
    });
    const [sweepSignal] = useState(createSweepSignal);
    const s = model.run;
    const shown = useMemo(() => presentedRun(model), [model]);
    useEffect(()=>{if(s.settings.language!==uiLanguage)dispatch({type:"change",update:run=>({...run,settings:{...run.settings,language:uiLanguage}})});},[uiLanguage,s.settings.language]);
    useEffect(() => { studio?.onState?.(shown); }, [shown, studio]);
    const [landedCoin, setLandedCoin] = useState({ runId: shown.id, result: shown.coinResult });
    const [walletChange, setWalletChange] = useState({ amount: 0, serial: 0 });
    const previousWallet = useRef({ id: shown.id, cash: shown.cash });
    useEffect(() => {
        const old = previousWallet.current;
        previousWallet.current = { id: shown.id, cash: shown.cash };
        if (old.id !== shown.id) {
            setWalletChange({ amount: 0, serial: 0 });
            return;
        }
        if (old.cash !== shown.cash)
            setWalletChange(value => ({ amount: shown.cash - old.cash, serial: value.serial + 1 }));
    }, [shown.id, shown.cash]);
    const setS = useCallback((update: (run: Run) => Run) => dispatch({ type: "change", update: studio ? run => recordingRun(update(run)) : update }), [studio]);
    useEffect(() => { if (studio?.controlsOpen)
        setS(run => ({ ...run, running: false })); }, [studio?.controlsOpen, setS]);
    const [progress, setProgress] = useState(0), [tab, setTab] = useState<DockPanel>("spin"), [frame, setFrame] = useState<SweepFrame | null>(null), [detailBet, setDetailBet] = useState<string | null>(null), [modal, setModal] = useState<"background" | "trial-mode" | "trial-result" | "trial-ranking" | "common-roll" | "versions" | "jackpot-help" | "news-help" | "intro" | "install" | "transfer" | "pwa" | "help" | "lab" | "sound" | "settings" | "feedback" | "rating" | "stats" | "leaderboard" | "clear" | "restart" | "presets" | "draft" | "menu" | "bet" | null>(() => {
        if (studio)
            return null;
        if (needsPwa())
            return "install";
        try {
            return localStorage.getItem(INTRO_KEY) !== "1" &&
                s.startedAt === null &&
                s.work === 0 &&
                s.spins === 0
                ? "intro"
                : null;
        }
        catch {
            return "intro";
        }
    }), [toast, setToast] = useState("");
    const trialEndSeen = useRef<string | null>(null);
    const ratingAfterRanking = useRef<string | null>(null);
    const [restartFrom, setRestartFrom] = useState<"menu" | "clear">("menu");
    const openClearRating = (id: string | null | undefined) => { if (id && shouldAskClearRating(id)) {
        markClearRating(id);
        setModal("rating");
    }
    else
        setModal(null); };
    const closeResult = () => { const id = modal === "clear" ? shown.completion?.id : ratingAfterRanking.current; ratingAfterRanking.current = null; openClearRating(id); };
    const sendRating = (body: Record<string, unknown>) => telemetry.current?.sendRating(state.current, body) ?? request("/api/ratings", { ...body, telemetryEnabled: false });
    const [newsDetail, setNewsDetail] = useState<Guidance | null>(null);
    const coinLayer = useRef<HTMLDivElement>(null), visualLayer = useRef<HTMLDivElement>(null), chartTarget = useRef<HTMLElement>(null);
    const liveModel = useRef(model);
    liveModel.current = model;
    const requestPosition = (intent: PositionIntent) => { wakeAudio(true); dispatch({ type: "position-change", intent }); };
    useEffect(() => {
        const coins = coinLayer.current, visuals = visualLayer.current;
        const clear = () => { stopVisuals(coins); stopVisuals(visuals); };
        const syncCoin = () => { const run = liveModel.current.run; setLandedCoin({ runId: run.id, result: run.coinResult }); };
        const hidden = () => { if (document.hidden) {
            clear();
            syncCoin();
        } };
        clear();
        syncCoin();
        document.addEventListener("visibilitychange", hidden);
        return () => { clear(); document.removeEventListener("visibilitychange", hidden); };
    }, [s.id, osReduced, s.settings.motion, s.settings.winVisual, s.settings.jackpotVisual, s.settings.effectIntensity]);
    const workBurst = useWorkBurst(osReduced || shown.settings.motion === "reduced", shown.settings.effectIntensity);
    useEffect(() => {
        preloadCashImages(shown.settings.banknoteStyle);
        setRainBanknote(visualLayer.current, shown.settings.banknoteStyle);
    }, [shown.settings.banknoteStyle]);
    useEffect(() => { stopVisuals(visualLayer.current); }, [shown.settings.cashMotion]);
    const [removeHint, setRemoveHint] = useState<string | null>(null);
    const readyToPlay = useRef(false);
    readyToPlay.current = !updating && releaseCheck.checked && !releaseCheck.latest && !studio?.controlsOpen && (!!studio || !needsPwa()) && modal !== "intro" && modal !== "install" && modal !== "common-roll";
    const [celebration, setCelebration] = useState<{
        kind: string;
        title: string;
        sub: string;
    } | null>(null);
    const [goalCelebration, setGoalCelebration] = useState<{
        kind: string;
        title: string;
        sub: string;
    } | null>(null);
    const goalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [tipTick, setTipTick] = useState(0);
    const [unlockQueue, setUnlockQueue] = useState<string[]>([]);
    const [unlockVisible, setUnlockVisible] = useState(false);
    const [pageVisible, setPageVisible] = useState(true);
    const coinUnlockPending = needsCoinUnlockNotice(shown);
    const betUnlockBatch = coinUnlockPending ? null : unlockQueue;
    const unlockBlocked = !pageVisible ||
        toast !== "" ||
        goalCelebration !== null ||
        modal !== null ||
        celebration?.kind === "jackpot" ||
        celebration?.kind === "infinity";
    useEffect(() => {
        const sync = () => setPageVisible(!document.hidden);
        sync();
        document.addEventListener("visibilitychange", sync);
        return () => document.removeEventListener("visibilitychange", sync);
    }, []);
    useEffect(() => {
        setUnlockVisible(false);
        if ((!betUnlockBatch?.length && !coinUnlockPending) || unlockBlocked)
            return;
        let dismiss: ReturnType<typeof setTimeout> | undefined;
        const show = setTimeout(() => {
            setUnlockVisible(true);
            sound("upgrade", state.current.settings);
            dismiss = setTimeout(() => {
                setUnlockVisible(false);
                if (coinUnlockPending)
                    setS(run => run.id === shown.id ? acknowledgeCoinUnlock(run) : run);
                else
                    setUnlockQueue((queue) => queue.filter((id) => !betUnlockBatch?.includes(id)));
            }, coinUnlockPending ? 6500 : 2300);
        }, Math.max(0, resultDueAt.current - performance.now()) + 150);
        return () => {
            clearTimeout(show);
            if (dismiss)
                clearTimeout(dismiss);
        };
    }, [betUnlockBatch, unlockBlocked, coinUnlockPending, shown.id, setS]);
    useEffect(() => {
        const timer = setInterval(() => {
            if (!document.hidden)
                setTipTick((t) => t + 1);
        }, 5000);
        return () => clearInterval(timer);
    }, []);
    const dismissIntro = () => {
        try {
            localStorage.setItem(INTRO_KEY, "1");
        }
        catch {
            /* First-run guidance still works without storage. */
        }
        setModal(null);
        wakeAudio(true);
        setTimeout(() => document.getElementById("work-button")?.focus({ preventScroll: true }), 0);
    };
    const continueFromInstall = () => {
        if (needsPwa())
            return;
        wakeAudio(true);
        try {
            setModal(localStorage.getItem(INTRO_KEY) !== "1" &&
                s.startedAt === null &&
                s.work === 0 &&
                s.spins === 0
                ? "intro"
                : null);
        }
        catch {
            setModal(s.startedAt === null ? "intro" : null);
        }
    };
    useEffect(() => {
        if (pwa.standalone && modal === "install")
            continueFromInstall();
    }, [pwa.standalone, modal]);
    const state = useRef(s), clock = useRef(0), resultDueAt = useRef(0), previousState = useRef(s), musicRush = useRef(s.rushLeft > 0), lastJackpotFx = useRef(0), surface = useRef<HTMLElement | null>(null), pointers = useRef(new Set<number>()), touches = useRef(0), pendingJackpotTab = useRef<string | null>(null), tabTimer = useRef<ReturnType<typeof setTimeout> | null>(null), flash = useRef<HTMLDivElement | null>(null), resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null), fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null), telemetry = useRef<Telemetry | null>(null);
    const heardState = useRef(shown);
    heardState.current = shown;
    state.current = s;
    const saveCurrentRun = useCallback(() => {
        // The install guide does not own or overwrite a playable save.
        if (!studio && needsPwa())
            return true;
        try {
            const current = liveModel.current;
            const settled = current.pending && current.run.last ? presentationReducer(current, { type: "reveal", runId: current.run.id, spinId: current.run.last.id }).run : state.current;
            const saved = backgroundAccess(settled) ? backgroundSave(settled, Date.now(), clock.current, Math.max(0, resultDueAt.current - performance.now())) : { ...settled, background: null };
            localStorage.setItem(saveKey, JSON.stringify(studio ? recordingRun(saved) : saved));
            return true;
        }
        catch {
            setToast(_t("保存できません。設定からセーブを書き出してください。"));
            return false;
        }
    }, [saveKey, studio]);
    useEffect(() => {
        if (!studio)
            return;
        const timer = setInterval(saveCurrentRun, 1000);
        return () => { clearInterval(timer); saveCurrentRun(); };
    }, [studio, saveCurrentRun]);
    const toggleTrial = () => {
        wakeAudio(true);
        const paused = state.current.trial?.paused;
        flushSync(() => dispatch({ type: paused ? "trial-resume" : "trial-pause", now: Date.now() }));
        if (!paused) {
            stopSounds();
            stopVisuals(coinLayer.current);
            stopVisuals(visualLayer.current);
            stopSpinCharge();
            stopHaptics();
            if (resultTimer.current)
                clearTimeout(resultTimer.current);
            resultDueAt.current = 0;
            setFrame(f => f ? { ...f, settled: true } : f);
        }
        saveCurrentRun();
        telemetry.current?.event(state.current, paused ? "trial_resume" : "trial_pause", { reason: state.current.trial?.rule ?? "fixed" });
    };
    const switchMode = (mode: "normal" | "trial", rule?: TrialRule) => {
        if (studio)
            return;
        try {
            const current = settleAccepted(liveModel.current).run;
            const next = switchTrialMode(current, mode, rule);
            if (resultTimer.current)
                clearTimeout(resultTimer.current);
            if (fxTimer.current)
                clearTimeout(fxTimer.current);
            stopSounds();
            stopVisuals(coinLayer.current);
            stopVisuals(visualLayer.current);
            stopSpinCharge();
            clock.current = 0;
            resultDueAt.current = 0;
            dispatch({ type: "background", run: next });
            setTab("spin");
            setFrame(null);
            setProgress(0);
            setCelebration(null);
            setModal(null);
        }
        catch {
            setToast(_t("保存できませんでした。現在の進行はそのままです。"));
        }
    };
    useEffect(() => {
        if (!s.trial?.result || trialEndSeen.current === s.id)
            return;
        trialEndSeen.current = s.id;
        if (resultTimer.current)
            clearTimeout(resultTimer.current);
        resultDueAt.current = 0;
        clock.current = 0;
        stopSpinCharge();
        stopSounds();
        stopVisuals(coinLayer.current);
        stopVisuals(visualLayer.current);
        stopHaptics();
        setFrame(f => f ? { ...f, settled: true } : f);
        setProgress(0);
        setTab("spin");
        setModal("trial-result");
        sound("bigwin", s.settings);
        saveCurrentRun();
        telemetry.current?.event(s, "trial_end", { finalBankroll: s.trial.result.finalBankroll, durationMs: s.trial.result.durationMs, reason: s.trial.rule });
    }, [s.id, s.trial?.result]);
    const backgroundTickAt = useRef(0);
    const publishBackground = (run: Run) => {
        // Batch settlement is already revealed. Suppress the foreground effect
        // that would otherwise animate just its final spin and count it twice.
        previousState.current = run;
        state.current = run;
        liveModel.current = { run, pending: null };
        dispatch({ type: "background", run });
        musicRush.current = run.rushLeft > 0;
    };
    const enterBackground = () => {
        if (studio)
            return false;
        if (state.current.background) {
            saveCurrentRun();
            return true;
        }
        if (!readyToPlay.current || !backgroundAccess(state.current) || !state.current.settings.backgroundPlay || !state.current.running)
            return false;
        const current = liveModel.current;
        const settled = current.pending && current.run.last ? presentationReducer(current, { type: "reveal", runId: current.run.id, spinId: current.run.last.id }).run : state.current;
        const next = current.pending && settled.last?.jackpot ? holdBackgroundJackpot(settled, Date.now()) : startBackground(settled, Date.now(), clock.current, Math.max(0, resultDueAt.current - performance.now()));
        if (resultTimer.current)
            clearTimeout(resultTimer.current);
        if (fxTimer.current)
            clearTimeout(fxTimer.current);
        resultDueAt.current = 0;
        clock.current = 0;
        setCelebration(null);
        setProgress(0);
        if (next.last)
            setFrame({ id: next.last.id, roll: next.last.roll, values: nextDistribution(next), snapshot: sweepSnapshot(next), duration: 0, at: Date.now(), settled: true });
        if (current.run.rushLeft > 0 && settled.rushLeft === 0 && current.run.spins === settled.spins)
            telemetry.current?.changed(current.run, settled);
        publishBackground(next);
        if (!saveCurrentRun())
            publishBackground({ ...next, running: false, background: null });
        else if (current.pending) {
            const notification = notificationTransition([{ before: current.pending.before, after: settled }], Date.now(), Date.now(), false);
            if (notification)
                void notifyJackpot(notification);
        }
        return true;
    };
    const processBackground = () => {
        if (studio)
            return false;
        const current = state.current;
        if (current.backgroundJackpot) {
            if (!document.hidden && readyToPlay.current) {
                setTab("spin");
                sound("jackpot", current.settings);
                publishBackground(resumeBackgroundJackpot(current, Date.now()));
                saveCurrentRun();
            }
            else
                musicPulse(current.settings, false, false);
            return true;
        }
        if (!current.background)
            return false;
        if (!readyToPlay.current)
            return true;
        if (!backgroundAccess(current)) {
            publishBackground(pauseTrial({ ...current, running: false, background: null }, current.background.at));
            return true;
        }
        const now = Date.now(), returning = !document.hidden;
        if (!returning && now - backgroundTickAt.current < 100)
            return true;
        backgroundTickAt.current = now;
        const result = advanceBackground(current, now, returning, 100, undefined, osReduced);
        // Persist a chunk before publishing its outcomes or telemetry. The clock
        // and wallet are one atomic localStorage value, so reload cannot re-credit it.
        try {
            localStorage.setItem(saveKey, JSON.stringify(result.run));
        }
        catch {
            publishBackground({ ...current, running: false, background: null });
            setToast(_t("保存できないため、バックグラウンド進行を停止しました。"));
            return true;
        }
        publishBackground(result.run);
        for (const step of result.transitions)
            telemetry.current?.settled(step.before, step.after, true);
        const notification = notificationTransition(result.transitions, now, current.background.at, returning);
        if (notification)
            void notifyJackpot(notification);
        if (!returning && now - current.background.at < 2000 && !notification) {
            const step = result.transitions.at(-1);
            if (step)
                void notifyBigChange(step.before, step.after);
        }
        const final = result.transitions.at(-1);
        if (final) {
            const o = final.after.last!;
            setFrame({ id: o.id, roll: o.roll, values: nextDistribution(final.before), snapshot: sweepSnapshot(final.before), duration: 0, at: now, settled: true });
            // Only current, audible results. Never replay a burst of old outcomes.
            if (!returning && now - current.background.at < 2000) {
                const voice = resultSound(final.after);
                sound(fundsBecameLow(final.before, final.after) ? "cash-low" : voice.cue, final.after.settings, final.after.settings.streakEffects ? final.after.winStreak : voice.power, voice.accent);
            }
        }
        if (returning && result.done) {
            clock.current = result.run.running ? interval(result.run) - (result.remainingMs ?? interval(result.run)) : 0;
            setProgress(0);
            setToast(result.capped ? _t("離席中の上限まで進みました。AUTOで再開できます。") : _t("離れていた間の進行を反映しました。"));
            telemetry.current?.checkpoint(result.run);
        }
        return true;
    };
    const backgroundControls = useRef({ enterBackground, processBackground });
    backgroundControls.current = { enterBackground, processBackground };
    useEffect(() => {
        const input = () => { autoUpdateAllowed.current = false; };
        const returning = () => { if (!document.hidden)
            autoUpdateAllowed.current = true; };
        document.addEventListener("visibilitychange", returning);
        addEventListener("pageshow", returning);
        addEventListener("pointerdown", input, true);
        addEventListener("keydown", input, true);
        return () => {
            document.removeEventListener("visibilitychange", returning);
            removeEventListener("pageshow", returning);
            removeEventListener("pointerdown", input, true);
            removeEventListener("keydown", input, true);
        };
    }, []);
    const updateSafe = safeToApplyUpdate({
        visible: pageVisible && (typeof document === "undefined" || !document.hidden), pending: !!model.pending || !!s.background,
        purchasing: false, running: s.running, modal,
    });
    useEffect(() => {
        if (!studio && pwa.update && autoUpdateAllowed.current && updateSafe && !updating && !updateError && !goalCelebration && !celebration) {
            setUpdating(true);
            setS(run => ({ ...run, running: false }));
        }
    }, [pwa.update, updateSafe, updating, updateError, goalCelebration, celebration, setS]);
    useEffect(() => {
        if (updating && !updateDialogSafe(modal)) {
            autoUpdateAllowed.current = false;
            setUpdating(false);
        }
    }, [updating, modal]);
    useEffect(() => {
        if (studio || !updating || !pwa.update || !updateSafe || reloadStarted.current)
            return;
        reloadStarted.current = true;
        const result = saveAndReload(pwa.update, () => {
            if (!saveCurrentRun())
                return false;
            telemetry.current?.checkpoint(state.current);
            return true;
        }, () => sessionStorage, () => location.reload());
        if (result !== "reloading") {
            reloadStarted.current = false;
            autoUpdateAllowed.current = false;
            setUpdating(false);
            setUpdateError(result === "save-failed" ? _t("保存できなかったため、更新を中止しました。") : _t("更新を反映できませんでした。PWAを一度終了して開き直してください。セーブは残っています。"));
        }
    }, [updating, pwa.update, updateSafe, saveCurrentRun]);
    const followJackpot = () => {
        if (pendingJackpotTab.current === state.current.id &&
            state.current.settings.jackpotAutoTab && state.current.rushLeft > 0 && !document.hidden)
            setTab("spin");
        pendingJackpotTab.current = null;
    };
    useEffect(() => {
        const afterClick = () => {
            if (tabTimer.current)
                clearTimeout(tabTimer.current);
            // A touch release is followed by click. Let purchases finish before
            // unmounting their tab, then recheck the current gesture and run.
            tabTimer.current = setTimeout(() => {
                if (!pointers.current.size && !touches.current)
                    followJackpot();
            }, 100);
        };
        const end = (event: PointerEvent) => {
            pointers.current.delete(event.pointerId);
            if (!pointers.current.size && !touches.current)
                afterClick();
        };
        const touchEnd = (event: TouchEvent) => {
            touches.current = event.touches.length;
            if (!touches.current && !pointers.current.size)
                afterClick();
        };
        const reset = () => {
            touches.current = 0;
            pointers.current.clear();
            pendingJackpotTab.current = null;
            if (tabTimer.current)
                clearTimeout(tabTimer.current);
        };
        const hidden = () => { if (document.hidden)
            reset(); };
        addEventListener("pointerup", end);
        addEventListener("pointercancel", end);
        addEventListener("touchend", touchEnd, { passive: true });
        addEventListener("touchcancel", touchEnd, { passive: true });
        addEventListener("blur", reset);
        document.addEventListener("visibilitychange", hidden);
        return () => {
            if (tabTimer.current)
                clearTimeout(tabTimer.current);
            removeEventListener("pointerup", end);
            removeEventListener("pointercancel", end);
            removeEventListener("touchend", touchEnd);
            removeEventListener("touchcancel", touchEnd);
            removeEventListener("blur", reset);
            document.removeEventListener("visibilitychange", hidden);
        };
    }, []);
    const fundsBefore = useRef(shown);
    useEffect(() => {
        const before = fundsBefore.current;
        fundsBefore.current = shown;
        if (!document.hidden && !before.background && !shown.background && fundsBecameLow(before, shown))
            sound("cash-low", shown.settings);
    }, [shown]);
    useEffect(() => {
        if (!navigator.serviceWorker)
            return;
        const open = ({ data, ports }: MessageEvent) => { if (data?.type === "BEBULLISH_GAME_OWNER")
            ports[0]?.postMessage(true); if (data?.type === "BEBULLISH_OPEN_JACKPOT") {
            setTab("spin");
            setModal(null);
        } };
        navigator.serviceWorker.addEventListener("message", open);
        return () => navigator.serviceWorker.removeEventListener("message", open);
    }, []);
    const resultImpact = (cue: Parameters<typeof impact>[1], settings: Run["settings"], detail: WinImpact = {}) => impact(surface.current, cue, !pointers.current.size && !touches.current
        ? settings : { ...settings, shake: "off" }, flash.current, detail);
    const change: Change = (fn) => {
        if (!studio && needsPwa())
            return;
        wakeAudio(true);
        setS((old) => fn(old));
    };
    const flipCoin = (button: HTMLButtonElement) => {
        if ((!studio && needsPwa()) || !readyToPlay.current || !trialActive(state.current))
            return;
        const before = liveModel.current.run;
        wakeAudio(true);
        flushSync(() => dispatch({ type: "coin-flip", wager: before.coinStake }));
        const after = liveModel.current.run;
        if (after.coinRounds === before.coinRounds) {
            setToast(_t("賭け金が足りません。コインフリップで金額を下げるか、OFFにしてWORKへ。"));
            return;
        }
        const result = after.coinResult!;
        uiSound("ui", after.settings);
        launchCoin(coinLayer.current, button.getBoundingClientRect(), (chartTarget.current ?? surface.current ?? button).getBoundingClientRect(), osReduced || after.settings.motion === "reduced", result.won, after.cash - before.cash, after.settings.effectIntensity, () => {
            if (state.current.id !== after.id || document.hidden || !trialActive(state.current))
                return;
            const settings = state.current.settings;
            uiSound(result.won ? "win" : "loss", settings);
            haptic(result.won ? "win" : "work", settings);
            setLandedCoin(old => old.runId === after.id && (old.result?.id ?? 0) > result.id ? old : { runId: after.id, result });
        });
    };
    const upgradeProbability = (id: string) => purchaseChange(run => purchaseProbability(run, id));
    const purchaseChange: Change = update => { if (studio || !needsPwa()) {
        wakeAudio(true);
        flushSync(() => dispatch({ type: "purchase", update }));
    } };
    const requestUpgrade = (kind: Upgrade | "gacha") => purchaseChange(current => kind === "gacha" ? drawUpgrade(current) : purchase(current, kind));
    useEffect(() => installAudioRecovery(() => state.current.settings), []);
    useEffect(() => {
        setBackgroundAudio(s.settings.backgroundPlay && backgroundAccess(s) && !s.backgroundJackpot);
        const media = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
        if (!media || !s.settings.backgroundPlay)
            return;
        if (typeof MediaMetadata !== "undefined")
            media.metadata = new MediaMetadata({ title: "dontwork.fun", artist: _t("AUTO · スピンの音"), artwork: [{ src: new URL("/icons/icon-512-dw.png", location.href).href, sizes: "512x512", type: "image/png" }] });
        const pause = () => { if (state.current.trial && !state.current.trial.paused) {
            toggleTrial();
            return;
        } stopSounds(); musicPulse(state.current.settings, false, false); flushSync(() => setS(run => ({ ...run, running: false, background: null }))); saveCurrentRun(); };
        try {
            media.setActionHandler("pause", pause);
            media.setActionHandler("stop", pause);
        }
        catch { /* Optional media controls. */ }
        return () => { setBackgroundAudio(false); try {
            media.setActionHandler("pause", null);
            media.setActionHandler("stop", null);
            media.metadata = null;
            media.playbackState = "none";
        }
        catch { /* Browser may not implement handlers. */ } };
    }, [s.settings.backgroundPlay, s.settings.sound, s.settings.soundVolume, s.settings.jackpotNotifications, s.backgroundJackpot]);
    useEffect(() => { if (s.settings.backgroundPlay && navigator.mediaSession)
        try {
            navigator.mediaSession.playbackState = s.running ? "playing" : "paused";
        }
        catch { /* Optional. */ } }, [s.settings.backgroundPlay, s.running]);
    useEffect(() => installUISounds(() => state.current.settings), []);
    useEffect(() => registerGameTools(() => state.current), []);
    useEffect(() => {
        setAudioEnabled(audioEnabled(s.settings));
        if (!s.settings.haptics)
            stopHaptics();
        musicPulse(musicForWealth(shown), musicRush.current, s.startedAt !== null && (!document.hidden || s.running));
    }, [
        s.settings.sound,
        s.settings.soundVolume,
        s.settings.music,
        s.settings.jackpotMusic,
        s.settings.musicVolume,
        s.settings.musicPack,
        s.settings.haptics,
    ]);
    useEffect(() => {
        stopImpact(surface.current);
        stopImpact(flash.current);
    }, [s.settings.motion, s.settings.impactFlash, s.settings.shake, osReduced]);
    useEffect(() => {
        telemetry.current?.event(state.current, "tab_view", {
            tab,
            name: tab,
            screen: "game",
            modal: modal ?? "none",
        });
    }, [tab, modal]);
    useEffect(() => {
        if (studio)
            return;
        telemetry.current ??= new Telemetry();
        telemetry.current.observe(state.current);
        if (needsPwa())
            telemetry.current.event(state.current, "pwa_gate", { reason: "install-required", action: "view" });
        const save = () => {
            saveCurrentRun();
        };
        const saver = setInterval(save, 1000), report = setInterval(() => {
            const health = drainAudioHealth();
            if (health.requests ||
                health.resumeFailures ||
                health.interruptedStates)
                telemetry.current?.event(state.current, "audio_health_batch", health);
            telemetry.current?.checkpoint(state.current);
        }, 15000);
        const leaving = () => {
            save();
            telemetry.current?.visibility(state.current, true);
            telemetry.current?.checkpoint(state.current);
        };
        addEventListener("pagehide", leaving);
        return () => {
            save();
            clearInterval(saver);
            clearInterval(report);
            removeEventListener("pagehide", leaving);
        };
    }, []);
    useEffect(() => {
        let previous = performance.now(), active = 0, trialTick = 0, lastInput = Date.now();
        const input = () => {
            lastInput = Date.now();
        };
        const timer = setInterval(() => {
            const now = performance.now(), delta = Math.min(200, now - previous);
            previous = now;
            let current = state.current;
            if (backgroundControls.current.processBackground()) {
                musicPulse(musicForWealth(state.current), musicRush.current, state.current.running);
                return;
            }
            if (readyToPlay.current && current.trial) {
                if (Date.now() - trialTick >= 200) {
                    trialTick = Date.now();
                    flushSync(() => dispatch({ type: "trial-clock", now: trialTick }));
                }
                current = state.current;
                if (!trialActive(current)) {
                    musicPulse(current.settings, false, false);
                    stopSpinCharge();
                    return;
                }
            }
            musicPulse(musicForWealth(heardState.current), musicRush.current, current.startedAt !== null && (!document.hidden || current.running));
            if (readyToPlay.current &&
                !document.hidden &&
                current.startedAt &&
                ((current.running && canSpin(current)) ||
                    Date.now() - lastInput < 120000)) {
                active += delta;
                if (active >= 1000) {
                    const add = active;
                    active = 0;
                    setS((old) => ({ ...old, activeMs: old.activeMs + add }));
                }
            }
            if (!readyToPlay.current ||
                document.hidden ||
                !current.running ||
                !!liveModel.current.positionRequest?.confirm ||
                (!liveModel.current.pending && !canSpin(current))) {
                clock.current = 0;
                stopSpinCharge();
                setProgress(0);
                return;
            }
            clock.current += delta;
            const cycle = autoCycle(current, presentedRun(liveModel.current), clock.current, !!liveModel.current.pending, Math.max(0, resultDueAt.current - now));
            if (liveModel.current.pending) {
                const visible = presentedRun(liveModel.current), delay = interval(visible);
                const progress = cycle.progress;
                if (progress < 1)
                    spinCharge(progress, delay, visible.settings);
                else
                    stopSpinCharge();
                setProgress(progress);
                return;
            }
            const delay = interval(current);
            if (cycle.ready) {
                stopSpinCharge();
                clock.current = 0;
                setS((old) => studio ? captureSpin(old, studio) : spin(old, undefined, 0));
                setProgress(0);
            }
            else {
                spinCharge(cycle.progress, delay, current.settings);
                setProgress(cycle.progress);
            }
        }, 50);
        const visibility = () => {
            if (document.hidden && backgroundControls.current.enterBackground()) {
                stopSpinCharge();
                stopHaptics();
                telemetry.current?.visibility(state.current, true);
                return;
            }
            clock.current = 0;
            stopSpinCharge();
            telemetry.current?.visibility(state.current, document.hidden);
            if (document.hidden) {
                stopHaptics();
                flushSync(() => dispatch({type:"trial-pause",now:Date.now()}));
                if(resultTimer.current)clearTimeout(resultTimer.current);
                resultDueAt.current=0;
                setFrame(f=>f?{...f,settled:true}:f);
                saveCurrentRun();
            }
        };
        const pagehide = () => { if (!state.current.background)
            backgroundControls.current.enterBackground(); };
        document.addEventListener("visibilitychange", visibility);
        addEventListener("pagehide", pagehide);
        addEventListener("pointerdown", input);
        addEventListener("keydown", input);
        return () => {
            clearInterval(timer);
            stopSpinCharge();
            document.removeEventListener("visibilitychange", visibility);
            removeEventListener("pagehide", pagehide);
            removeEventListener("pointerdown", input);
            removeEventListener("keydown", input);
        };
    }, []);
    useEffect(() => {
        const before = previousState.current;
        previousState.current = s;
        if (before === s)
            return;
        telemetry.current?.changed(before, s);
        if (before.spins === s.spins && before.rushLeft > 0 && s.rushLeft === 0) {
            musicRush.current = false;
            pendingJackpotTab.current = null;
            setCelebration(null);
            musicPulse(musicForWealth(s), false, s.startedAt !== null && !document.hidden);
        }
        if (before.id !== s.id) {
            musicRush.current = s.rushLeft > 0;
            clock.current = 0;
            stopSpinCharge();
            resultDueAt.current = 0;
            setCelebration(null);
            setUnlockQueue([]);
            setFrame(null);
            pendingJackpotTab.current = null;
            if (resultTimer.current)
                clearTimeout(resultTimer.current);
            return;
        }
        if (before.settings.jackpotSpinIntervalMs !==
            s.settings.jackpotSpinIntervalMs ||
            before.settings.spinSpeedScale !== s.settings.spinSpeedScale ||
            before.settings.sweepMotion !== s.settings.sweepMotion ||
            before.settings.fuelEnabled !== s.settings.fuelEnabled ||
            before.portfolio !== s.portfolio ||
            before.speed !== s.speed) {
            stopSpinCharge();
            setProgress(0);
        }
        const reveal = (kind: string, title: string, sub: string, ms: number) => {
            if (fxTimer.current)
                clearTimeout(fxTimer.current);
            setCelebration({ kind, title, sub });
            fxTimer.current = setTimeout(() => setCelebration(null), ms);
        };
        if (before.catalog !== s.catalog)
            setUnlockQueue([]);
        const newly = unlockedSince(before, s);
        if (newly.length)
            setUnlockQueue((queue) => [
                ...new Set([...queue, ...newly.map((b) => b.id)]),
            ]);
        if (before.spins !== s.spins && s.last) {
            const o = s.last;
            const { revealDelay } = spinTiming(before, s, osReduced);
            resultDueAt.current = performance.now() + revealDelay;
            if (interval(before) > 250 && s.settings.spinSound === "original")
                sound("spin", s.settings);
            setFrame({
                id: o.id,
                roll: o.roll,
                values: nextDistribution(before),
                snapshot: sweepSnapshot(before),
                duration: revealDelay,
                at: Date.now(),
            });
            // The AUTO clock keeps charging during reveal; resultDueAt gates settlement.
            telemetry.current?.settled(before, s);
            if (resultTimer.current)
                clearTimeout(resultTimer.current);
            const showResult = () => {
                if (state.current.id !== s.id || state.current.last?.id !== o.id || !trialActive(state.current))
                    return;
                resultDueAt.current = 0;
                const action = { type: "reveal", runId: s.id, spinId: o.id } as const;
                const landed = presentationReducer(liveModel.current, action).run;
                dispatch(action);
                setFrame((current) => current?.id === o.id ? { ...current, settled: true } : current);
                musicRush.current = landed.rushLeft > 0;
                if (document.hidden)
                    return;
                const feedbackSettings = landed.settings;
                musicPulse(musicForWealth(landed), musicRush.current, s.startedAt !== null);
                if (shouldFollowJackpot(before, s, landed)) {
                    if (pointers.current.size || touches.current)
                        pendingJackpotTab.current = s.id;
                    else
                        setTab("spin");
                }
                haptic(o.infinity
                    ? "infinity"
                    : o.jackpot
                        ? "jackpot"
                        : o.activated.length
                            ? "armed"
                            : o.profit >= Math.max(100, o.wager * 5)
                                ? "bigwin"
                                : "win", o.profit > 0 || o.jackpot || o.activated.length
                    ? feedbackSettings
                    : { haptics: false });
                const big = o.profit >= Math.max(100, o.wager * 5);
                const { cue, accent } = resultSound(s);
                sound(cue, feedbackSettings, feedbackSettings.streakEffects ? s.winStreak : o.maxStreak, accent);
                const milestone = payoutMilestone(before.bestPayout, o.payout);
                const source = (surface.current?.querySelector<HTMLElement>(".sweep-panel") ?? surface.current?.querySelector<HTMLElement>(".roll-station"))?.getBoundingClientRect();
                const detail = { amount: Math.abs(o.profit), cashAmount: Math.max(0, o.payout), streak: feedbackSettings.streakEffects ? s.winStreak : 0, milestone,
                    origin: source && source.width > 0 && source.height > 0 ? { x: source.left + source.width * .5, y: source.top + source.height * .6, width: source.width } : undefined };
                resultImpact(cue, feedbackSettings, detail);
                playResultVisual(visualLayer.current, cue, feedbackSettings, detail);
                if (o.infinity && landed.rushLeft > 0) {
                    reveal("infinity", "INFINITY", _t("世界は、100だけになった。"), 2700);
                }
                else if (o.jackpot && landed.rushLeft > 0 &&
                    !isInfinite(s) &&
                    Date.now() - lastJackpotFx.current > 4000) {
                    lastJackpotFx.current = Date.now();
                    reveal("jackpot", o.rushBefore ? `${s.chain} CHAIN` : "JACKPOT", _t("残り{0}回{1}", landed.rushLeft, o.trimAdded ? _t(" / 出目カット +{0}", o.trimAdded) : ""), o.rushBefore ? 850 : 1600);
                }
                else if (milestone) {
                    reveal("milestone", "+" + money(o.payout), _t("{0}の桁に初到達！", money(10 ** Math.floor(Math.log10(o.payout)))), 1600);
                    sound("bigwin", feedbackSettings, s.winStreak);
                }
                else if (o.activated.length)
                    setToast(_t("{0} · 次の1回がチャンス", betById(o.activated[0]).name));
                else if (big && !s.rushLeft)
                    reveal("win", "+" + money(o.profit), "THE BIG MOVE", 850);
            };
            if (revealDelay)
                resultTimer.current = setTimeout(showResult, revealDelay);
            else
                showResult();
        }
        else if (s.spent > before.spent &&
            s.upgradeDraws === before.upgradeDraws) {
            haptic("upgrade", s.settings);
            resultImpact("upgrade", s.settings);
        }
        else if (s.work > before.work) {
            haptic("work", s.settings);
        }
        else if (s.portfolio !== before.portfolio) {
            if (!model.pending)
                setFrame(null);
            haptic("equip", s.settings);
        }
        if (s.upgradeDraws > before.upgradeDraws && s.lastUpgradeDraw) {
            const draw = s.lastUpgradeDraw;
            haptic("upgrade", s.settings);
            resultImpact("upgrade", s.settings);
            reveal("upgrade", _t(UPGRADE_INFO[draw.upgrade][1]), `+1 → LV ${draw.level}`, 1100);
            setToast(_t("{0}が当たった！ Lv {1}", _t(UPGRADE_INFO[draw.upgrade][1]), draw.level));
        }
    }, [s]);
    useEffect(() => () => {
        if (fxTimer.current)
            clearTimeout(fxTimer.current);
        if (resultTimer.current)
            clearTimeout(resultTimer.current);
    }, []);
    useEffect(() => {
        if (!toast)
            return;
        const timer = setTimeout(() => setToast(""), Math.min(12000, Math.max(4500, toast.length * 100)));
        return () => clearTimeout(timer);
    }, [toast]);
    const previousClear = useRef({ id: shown.id, at: shown.clearAt });
    useEffect(() => {
        const before = previousClear.current;
        previousClear.current = { id: shown.id, at: shown.clearAt };
        if (before.id !== shown.id) {
            setGoalCelebration(null);
            if (goalTimer.current)
                clearTimeout(goalTimer.current);
        }
        if (before.id === shown.id && before.at === null && shown.clearAt !== null && !document.hidden && !s.background) {
            setGoalCelebration({ kind: "goal", title: money(completionTarget(shown)) + " CLEARED", sub: _t("おめでとう！ 記録は保存済み。好きなタイミングで記念カードへ。") });
            sound("infinity", shown.settings);
            resultImpact("infinity", shown.settings);
            haptic("infinity", shown.settings);
            if (goalTimer.current)
                clearTimeout(goalTimer.current);
            goalTimer.current = setTimeout(() => setGoalCelebration(null), 4000);
        }
    }, [shown.id, shown.clearAt]);
    useEffect(() => () => { if (goalTimer.current)
        clearTimeout(goalTimer.current); }, []);
    // WORK changes cash, not the distribution. Keep the 100-face calculations
    // off the tap/scroll path until one of their actual inputs changes.
    const sweepInputs = [shown.portfolio, shown.memory, shown.betLevels, shown.removed, shown.rushLeft, shown.fuel, shown.spins, shown.last, shown.settings];
    const distribution = useMemo(() => nextDistribution(shown), sweepInputs);
    const sweep = useMemo(() => sweepSnapshot(shown), [...sweepInputs,uiLanguage]);
    // Every result-bearing view reads the same published state.
    const shownSweep = sweep;
    const weights = rollWeights(shown), ev = distribution.reduce<number>((n, v, i) => n + (v ?? 0) * weights[i], 0), chance = distribution.reduce<number>((n, v, i) => n + ((v ?? 0) > 0 ? weights[i] : 0), 0) * 100;
    const bets = availableBets(shown).sort((a, b) => a.unlock - b.unlock || a.stake - b.stake), equipped = bets.filter((b) => shown.portfolio.some((r) => r.id === b.id));
    const gacha = shown.settings.upgradeMode === "gacha", upgradePool = upgradeDrawPool(shown), drawPrice = upgradeDrawPrice(shown);
    const last = shown.last, rush = shown.rushLeft > 0;
    const playableBets = bets.filter((b) => unlocked(shown, b));
    const positionBets = playableBets;
    const visibleUpgrades = (Object.keys(UPGRADE_INFO) as Upgrade[]).filter((u) => upgradeUnlocked(shown, u));
    const captureMode = shown.settings.captureMode;
    const desk = captureMode || shown.settings.workspaceMode === "desk";
    useEffect(() => { setTab("spin"); }, [captureMode]);
    useEffect(() => {
        if (!captureMode)
            return;
        const closeControls = (event: KeyboardEvent) => { if (event.key === "Escape" && !modal)
            setTab("spin"); };
        window.addEventListener("keydown", closeControls);
        return () => window.removeEventListener("keydown", closeControls);
    }, [captureMode, modal]);
    const canOpenCoin = coinUnlocked(shown);
    const nextPanel = nextDockPanel(tab, canOpenCoin);
    useEffect(() => { if (tab === "coin" && !canOpenCoin)
        setTab("positions"); }, [tab, canOpenCoin]);
    const guideTab = tab === "coin" ? "spin" : desk && tab !== "upgrades" ? "positions" : tab;
    const guide = guidance(shown, tipTick, guideTab);
    const chartVisible = desk || tab === "spin" || tab === "coin" || shown.settings.sharedChart;
    useEffect(() => {
        if (shown.rushLeft > 0 && modal === "draft")
            setModal(null);
    }, [shown.rushLeft]);
    useEffect(() => {
        if (!shown.commonRollExplained && shown.portfolio.length >= 2 && !model.pending && !rush && !modal) {
            setModal("common-roll");
            telemetry.current?.event(state.current, "guidance_shown", { tutorialStep: "common-roll", action: "second-distinct-position" });
        }
    }, [shown.commonRollExplained, shown.portfolio, model.pending, rush, modal]);
    const spinVisible = desk || shown.settings.sharedSpin || tab === "spin";
    useEffect(() => {
        const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (icon) {
            icon.href = "/icons/dontwork.svg";
            icon.type = "image/svg+xml";
        }
    }, [shown.settings.brandIcon]);
    const announcement = goalCelebration ?? (unlockVisible && !unlockBlocked && (coinUnlockPending || unlockQueue.length)
        ? coinUnlockPending ? {
            kind: "unlock",
            title: _t("コインフリップ解放！"),
            sub: _t("「コインフリップ」を開き、WORKをFLIPに切り替えて遊べます。"),
        } : {
            kind: "unlock",
            title: unlockQueue.length === 1
                ? betById(unlockQueue[0]).name
                : _t("{0}種のギャンブルを解放", unlockQueue.length),
            sub: _t("新しく解放！ ポジションの＋でセットできます。"),
        }
        : celebration);
    const chartNotices = !modal && (announcement || toast) && <ChartNotices anchor={chartTarget} plotOnly={captureMode} reduced={osReduced || shown.settings.motion === "reduced"}>
      {announcement && !toast && (<div className={`celebration ${announcement.kind}`} aria-live="polite" key={announcement.title}>
          <span>{announcement.kind === "infinity" ? "∞" : "↗"}</span>
          <strong>{announcement.title}</strong>
          <small>{announcement.sub}</small>
          <div className="burst-lines" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (<i key={i} style={{ "--i": i } as React.CSSProperties}/>))}
          </div>
        </div>)}
      {toast && (<div className="toast" role="status">
          {_text(toast)}
        </div>)}
  </ChartNotices>;
    const guideStarted = useRef<{
        key: string;
        step: string;
        at: number;
        runId: string;
    } | null>(null);
    useEffect(() => {
        const before = guideStarted.current, now = Date.now();
        if (before?.key === `${guide.key}:${guide.target}:${guideTab}` && before.runId === s.id)
            return;
        if (before && before.runId === s.id)
            telemetry.current?.event(state.current, "guidance_resolved", { tutorialStep: before.step, durationMs: now - before.at, tab });
        guideStarted.current = guide.urgent ? { key: `${guide.key}:${guide.target}:${guideTab}`, step: guide.key, at: now, runId: s.id } : null;
        if (guide.urgent)
            telemetry.current?.event(state.current, "guidance_shown", { tutorialStep: guide.key, tab, status: guide.target ?? "none" });
    }, [guide.key, guide.target, guideTab, guide.urgent, s.id]);
    const blockedPosition = (id: string, reason: string) => {
        setRemoveHint(id);
        setToast(reason === "positions-full" ? _t("ポジション上限です。光る−で外して、入れ替えよう。") : _t("このギャンブルは持っている数までセットできます。"));
        telemetry.current?.event(state.current, "blocked_action", { action: "equip", reason, cardId: id, slotCount: shown.slots, tab });
        if (reason === "positions-full")
            document.querySelector<HTMLElement>('.bet-card.equipped .counter button')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    useEffect(() => { if (removeHint === null)
        return; const timer = setTimeout(() => setRemoveHint(null), 7000); return () => clearTimeout(timer); }, [removeHint]);
    useEffect(() => { setRemoveHint(null); }, [s.portfolio]);
    useEffect(() => {
        if (studio)
            return;
        const retry = () => {
            const run = state.current;
            if (run.completionNickname && run.completion && !run.submitted)
                try {
                    saveCompletionName(run, run.completionNickname);
                }
                catch { /* Keep pending name in memory and show the regular autosave error. */ }
            if (run.trial?.nickname && run.trial.result && !run.trial.submitted)
                try {
                    saveTrialName(run, run.trial.nickname);
                }
                catch { /* Retry on the next connection. */ }
            void flushTrialScores().then(ids => setS(run => run.trial && ids.includes(run.id) ? { ...run, trial: { ...run.trial, submitted: true } } : run));
            return void flushRankings().then(ids => setS(run => run.completion && ids.includes(run.completion.id) ? { ...run, submitted: true } : run));
        };
        retry();
        const retryTimer = setInterval(retry, 30000);
        addEventListener('online', retry);
        return () => { clearInterval(retryTimer); removeEventListener('online', retry); };
    }, [s.id, s.completionNickname, s.trial?.nickname]);
    const spinSurface = (<section className={`roll-station ${shown.settings.reelStyle === "number" ? "number-mode" : ""}`}>
              {shown.settings.reelStyle === "payoff" ? (<PayoffSweep signal={sweepSignal} values={distribution} snapshot={shownSweep} style={shown.settings.payoffStyle} frame={frame} reduced={osReduced || shown.settings.motion === "reduced"} motion={shown.settings.sweepMotion} jackpotRule={shown.settings.jackpotRule} jackpotHigh={shown.jackpotHigh}/>) : (<div className="number-mode-content">
                  <GrowthStrip growth={framePending(frame, osReduced || shown.settings.motion === "reduced")
                ? (frame?.snapshot?.growth ?? shownSweep.growth)
                : shownSweep.growth}/>
                  <div className="roll-display">
                    <div className="roll-side">
                      <span className="micro">{_t("利益の確率")}</span>
                      <b>
                        {chance.toFixed(0)}
                        <small>%</small>
                      </b>
                    </div>
                    <div className={`roll-number ${last?.jackpot ? "jackpot-number" : ""}`} key={last?.id}>
                      {last ? String(last.roll).padStart(2, "0") : "—"}
                      <span>
                        {last?.jackpot
                ? "JACKPOT"
                : last?.profit && last.profit > 0
                    ? "BULLISH"
                    : "NEXT TICK"}
                      </span>
                    </div>
                    <div className="roll-side right">
                      <span className="micro">JACKPOTS</span>
                      <b>{shown.jackpots}</b>
                    </div>
                  </div>
                </div>)}
              <div className="spin-result">
                <span>
                  <small>{_t("期待値")}</small>
                  <b className={ev >= 0 ? "positive" : "negative"}>
                    {ev >= 0 ? "+" : ""}
                    {money(ev)}
                  </b>
                </span>
                <span>
                  <small>{_t("最大配当")}</small><b>{money(Math.max(0, ...shownSweep.bars.map(b => b?.payout ?? 0)))}</b>
                </span>
                <span>
                  <small>{_t("賭け金")}</small><b>{money(last?.wager ?? totalCost(shown))}</b>
                </span>
                <span>
                  <small>{_t("スピン周期")}</small><b>{_t("{0}秒", (interval(shown) / 1000).toFixed(2))}</b>
                </span>
              </div>
              <div className="next-spin-track">
                <i style={{ width: `${progress * 100}%` }}/>
              </div>
            </section>);
    const news = (<div className={`news-strip ${rush ? "jackpot-news" : ""} ${guide.urgent ? "needs-action" : ""}`} role="status" aria-live={guide.urgent ? "polite" : "off"}>
      <span className="news-label">{_text(rush ? isInfinite(shown) ? "INFINITY JACKPOT" : "JACKPOT" : guide.label)}</span>
      {rush ? <p className="rush-remaining"><strong>{isInfinite(shown) ? "∞" : shown.rushLeft.toLocaleString()}</strong><span>{_t("スピン残り")}</span><small><span>{_t("{0}連鎖{1}", shown.chain, shown.running ? "" : _t(" · AUTOで再開"))}</span><span>{rollFloor(shown) > 1 ? _t("1〜{0}をカット", rollFloor(shown) - 1) : _t("カットなし")}</span></small></p> : <p key={guide.key}>{_text(guide.text)}</p>}
      {shown.settings.showJackpotCounter && <small className="jackpot-counter">{shown.spinsSinceJackpot === null ? _t("次のJPから計測") : _t("{0} {1}回", shown.jackpots ? _t("前回JPから") : _t("開始から"), shown.spinsSinceJackpot)}</small>}
      {!rush && <button aria-label={_t("このニュースの説明")} onClick={() => { setNewsDetail({ ...guide }); setModal("news-help"); }}>?</button>}
    </div>);
    if (!releaseCheck.checked || releaseCheck.latest)
        return <ReleaseNotice check={releaseCheck}/>;
    return (<div inert={updating && updateDialogSafe(modal)} data-capture-spin={captureMode ? shown.spins : undefined} data-capture-roll={captureMode ? shown.last?.roll : undefined} data-capture-jackpot={captureMode ? !!shown.last?.jackpot : undefined} data-capture-rush={captureMode ? rush : undefined} data-capture-assisted={captureMode ? !!shown.last?.assisted : undefined} data-capture-scripted={studio ? true : undefined} data-capture-cursor={studio ? shown.spins - studio.initialRun.spins : undefined} className={`app ${s.trial ? "trial-mode" : ""} ${s.trial && !trialActive(s) ? "trial-frozen" : ""} ${captureMode ? "capture-mode" : ""} ${desk ? "desk-layout" : "tab-layout"} wealth-${wealthStage(shown)} ${shown.settings.newsPosition === "bottom" ? "news-bottom" : ""} ${shown.settings.fuelEnabled ? "" : "no-fuel"} fx-${shown.settings.fx} ${rush ? "rush-mode" : ""} ${isInfinite(shown) ? "infinity-mode" : ""} ${shown.settings.motion === "reduced" ? "reduced-motion" : ""}`}>
      {pwa.update && modal === null && <aside className="pwa-update-notice" role="status">
        <span>{updateError || (updating ? _t("続きを保存して更新しています…") : _t("最新版の準備ができました"))}</span>
        {!updating && !updateError && <button className="primary" onClick={() => { setUpdating(true); setS(run => ({ ...run, running: false })); }}>{_t("保存して更新")}</button>}
      </aside>}
      <header className="topbar">
        <a className="wordmark" href="#" onClick={(e) => {
            e.preventDefault();
            setTab("spin");
        }}>
          <span className="brand-name">dontwork<em>.fun</em></span>
          <img className="brand-icon" src={"/icons/dontwork.svg"} alt="" width="32" height="32"/>
        </a>
        <div className="header-center">
          <span className="live-dot"/>
          {catalogById(shown.catalog).en}
          <span>v{VERSION}</span>
        </div>
        <nav>
          <button className="contact-button" aria-label={_t("問い合わせ")} title={_t("問い合わせ")} onClick={() => setModal("feedback")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>
          </button>
          <button className="contact-button trophy-button" aria-label={_t("ランキング")} title={_t("ランキング")} onClick={() => setModal("leaderboard")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 14v5m-4 2h8m-6-2h4"/></svg>
          </button>
          <button className="contact-button sound-button" aria-label={_t("サウンドパック")} title={_t("サウンドパック")} onClick={() => setModal("sound")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/></svg>
          </button>
          <button className={`contact-button background-button ${shown.settings.backgroundPlay ? "enabled" : ""}`} aria-label={_t("バックグラウンド・通知")} title={_t("バックグラウンド・通知")} onClick={() => setModal("background")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></button>
          <button className="contact-button menu-button" onClick={() => setModal("menu")} aria-label={_t("メニューと設定")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </nav>

      </header>
      {shown.settings.newsPosition === "top" && news}
      <div className={`balance-header ${shown.completion && shown.clearAt !== null ? "has-clear-notice" : ""}`}>
        {shown.completion && shown.clearAt !== null && <button className="clear-notice" onClick={() => { setGoalCelebration(null); setModal("clear"); }} aria-label={_t("クリア記録を開く")}><span>{_t("🏆 {0}達成！", money(completionTarget(shown)))}</span><strong>{shown.completionNickname ? _t("記念カードを見る") : _t("名前を登録して記念カードへ")} →</strong></button>}
        <div className="balance-wallet">
          <div className="eyebrow">{_t("総資産")}{" "}
            <span>
              {shown.trial ? "30 MIN CHALLENGE" : shown.clearAt !== null ? "GOAL CLEARED" : "TARGET " + money(TARGET)}
            </span>
          </div>
          <div className="balance-money-line"><h1>{money(shown.trial ? trialAssets(shown) : shown.cash)}</h1>        <div className="balance-result">
        <div className={`pnl ${walletChange.amount < 0 ? "negative" : "positive"}`} key={walletChange.serial}>
          {(walletChange.amount > 0 ? "+" : "") + money(walletChange.amount)}

        </div>
        </div>
    </div>
        </div>
        <div className="balance-meta">
          <span>{duration(shown.activeMs)}</span>
          <span>{shown.spins.toLocaleString()} SPINS</span>
        </div>
      </div>
      <SweepAudio signal={sweepSignal} settings={shown.settings}/>
      <SweepMotionDriver signal={sweepSignal} frame={frame} motion={shown.settings.sweepMotion} reduced={osReduced || shown.settings.motion === "reduced"}/>
      <main ref={surface} className={`game-workspace ${desk ? "compact-workspace" : ""} ${shown.settings.oddsDisplay === "fraction" || shown.settings.probabilityUpgrades ? "lab-card-expanded" : ""} ${chartVisible ? "has-chart" : ""} ${spinVisible ? "shared-spin-workspace" : ""} spin-size-${shown.settings.spinSize}`} onTouchStartCapture={(event) => {
            touches.current = event.touches.length;
            stopImpact(surface.current);
        }} onPointerDownCapture={(event) => {
            pointers.current.add(event.pointerId);
            stopImpact(surface.current);
        }}>
        {!chartVisible && <div className="chart-notification-fallback">{chartNotices}</div>}
        {spinVisible && <aside className="shared-spin" key="common-spin" aria-label={_t("スピン")}>{spinSurface}</aside>}
        {chartVisible && (<section ref={chartTarget} className="chart-page">
            <WealthChart s={shown}/>
            {chartNotices}
          </section>)}
        <div className={captureMode ? `capture-controls ${tab === "spin" ? "is-closed" : ""}` : "workspace-panels"}>
        {captureMode && tab !== "spin" && <div className="capture-panel-header">
          <nav aria-label={_t("撮影中の操作")}>
            <button aria-pressed={tab === "positions"} onClick={() => setTab("positions")}>{_t("ギャンブル")}</button>
            <button aria-pressed={tab === "upgrades"} onClick={() => setTab("upgrades")}>{_t("強化")}</button>
            {canOpenCoin && <button aria-pressed={tab === "coin"} onClick={() => setTab("coin")}>{_t("コイン")}</button>}
          </nav>
          <button className="capture-panel-close" onClick={() => setTab("spin")} aria-label={_t("操作パネルを閉じる")}>{_t("完了 ×")}</button>
        </div>}
        {(tab === "positions" || (desk && !captureMode && tab === "spin")) && (<section className="positions-page">
            <div className="workspace-heading">
              <div>
                <h2>{_t("ポジション")}<small>{usedSlots(shown)}/{shown.slots}</small></h2>
                <p>{_t("装備は無料。同じ数字で、すべてが動く。")}</p>
              </div>
            </div>
            <div className="positions-grid">
              {positionBets.map((b) => (<BetCard key={b.id} b={b} s={shown} change={change} pending={!!model.positionRequest} onPosition={requestPosition} onProbability={upgradeProbability} onBlocked={blockedPosition} highlightRemove={(removeHint !== null && (b.id !== removeHint || equipped.length === 1)) || (desk && guide.target === "positions")} guided={guide.target === "equip" &&
                    shown.portfolio.length === 0 &&
                    b.id === firstBet(shown)} onDetails={() => {
                    setDetailBet(b.id);
                    setModal("bet");
                }}/>))}
            </div>
          </section>)}
        {tab === "coin" && canOpenCoin && <CoinFlip s={shown} result={landedCoin.runId === shown.id ? landedCoin.result : null} budget={coinBudget(model)} onChange={patch => change(run => ({ ...configure(run, "coinEnabled" in patch ? { dockToy: "off" } : {}), ...patch }))}/>}
        {tab === "upgrades" && (<section className={`upgrades-page ${gacha ? "gacha-mode" : ""}`}>
            <div className="workspace-heading">
              <div>
                <h2>{_t("アップグレード")}</h2>
                <p>
                  {gacha
                ? _t("引くたび価格が上昇。1回で必ず1つ強化。") : _t("強化はずっと残る。次のスピンを育てよう。")}
                </p>
              </div>
              <UpgradeSpend spent={shown.spent}/>
            </div>
            {shown.catalog === "curated" && <p className="setting-note">{_t("この相場はジャックポット中も1秒固定。周期の強化は不要です。")}</p>}
            {shown.settings.workCosmetics && <article className="work-cosmetic upgrade-card"><div><h3>WORK STYLE · Lv {shown.workFxLevel}</h3><p>{_t("クリック音を変えるコスメ強化。収入は+$1のまま。全4段階。")}</p></div><button className="primary" disabled={workCosmeticPrice(shown) === null || coinBudget(model) < (workCosmeticPrice(shown) ?? 0)} onClick={() => purchaseChange(purchaseWorkCosmetic)}>{workCosmeticPrice(shown) === null ? _t("全スタイル解放") : money(workCosmeticPrice(shown) ?? 0)}</button></article>}
            {gacha && (<section className="upgrade-draw">
                <div className="draw-heading">
                  <span className="eyebrow">UPGRADE DRAW</span>
                  <span>{shown.upgradeDraws} DRAWS</span>
                </div>
                <h3>{_t("次は、どこが伸びる？")}</h3>
                <p>{_t("1回で1つ、必ず強化。未MAXの{0} 系統から等確率で抽選します。", upgradePool.length)}</p>
                {shown.lastUpgradeDraw && (<div className="upgrade-draw-result" key={shown.upgradeDraws} role="status">
                    <span>LAST DRAW</span>
                    <strong>
                      {_text(UPGRADE_INFO[shown.lastUpgradeDraw.upgrade][1])} <b>+1</b>
                    </strong>
                    <small>LV {shown.lastUpgradeDraw.level}</small>
                  </div>)}
                <button className={`primary upgrade-draw-button ${guide.target === "purchase" && guide.upgrade === "gacha" ? "guide-target" : ""}`} data-ui-cue="upgrade" disabled={drawPrice === null || coinBudget(model) < drawPrice} onClick={() => requestUpgrade("gacha")}>
                  <span>
                    {drawPrice === null ? _t("ガチャ終了") : _t("強化ガチャを引く ↗")}
                  </span>
                  <b>{drawPrice === null ? "—" : money(drawPrice)}</b>
                </button>
                <div className="draw-next">
                  <span>
                    {!upgradePool.length
                    ? _t("解放済みの強化がすべてMAXになりました。") : drawPrice === null
                    ? _t("金額の表示上限に達しました。") : _t("次回 {0} · 価格は引くたび上昇", money(upgradeDrawPrice({ ...shown, upgradeDraws: shown.upgradeDraws + 1 }) ?? 0))}
                  </span>
                </div>
                {drawPrice !== null && coinBudget(model) < drawPrice && (<small className="draw-shortfall">{_t("あと{0}で引ける。", money(drawPrice - shown.cash))}</small>)}
              </section>)}

            <div className="upgrades-grid">
              {" "}
              {visibleUpgrades.map((u) => {
                const info = UPGRADE_INFO[u], price = upgradePrice(shown, u);
                return (<article className={`upgrade-card ${guide.target === "purchase" && guide.upgrade === u ? "guide-target" : ""}`} key={u}>
                    <div>
                      <span className="micro">
                        {_t(info[0])} <b>LV {shown[u]}</b>
                      </span>
                      <h3>{_t(info[1])}</h3>
                      <p>{_t(info[2])}</p>
                      <strong>
                        {price === null
                        ? "MAX LEVEL"
                        : u === "slots"
                            ? _t("{0} → {1}ポジション", shown.slots, Math.min(12, shown.slots + 1)) : u === "speed"
                            ? `${(interval({ ...shown, rushLeft: 0 }) / 1000).toFixed(2)}s → ${(interval({ ...shown, rushLeft: 0, speed: shown.speed + 1 }) / 1000).toFixed(2)}s`
                            : u === "capacity"
                                ? `${fuelCapacity(shown)} → ${fuelCapacity({ ...shown, capacity: shown.capacity + 1 })}`
                                : u === "trim"
                                    ? _t("発動ごと +{0} → +{1}", shown.trim, shown.trim + 1) : _t("補充 {0} → {1}回", shown.settings.rushBase + shown.rush * 5, shown.settings.rushBase + (shown.rush + 1) * 5)}
                      </strong>
                    </div>
                    {gacha ? (<div className="upgrade-odds">
                        <strong>
                          {upgradePool.includes(u)
                            ? `${(100 / upgradePool.length).toFixed(1)}%`
                            : "MAX"}
                        </strong>
                        <small>
                          {upgradePool.includes(u)
                            ? "DRAW CHANCE"
                            : _t("抽選から除外")}
                        </small>
                      </div>) : (<div className="upgrade-actions" data-ui-cue="upgrade">
                        <button data-ui-cue="upgrade" onClick={() => requestUpgrade(u)} disabled={price === null || coinBudget(model) < price}>
                          {price === null ? "MAX" : money(price)}
                          <small>UPGRADE ↗</small>
                        </button>
                      </div>)}
                  </article>);
            })}
            </div>
          </section>)}
        </div>
      </main>
      {!desk && <nav className="main-tabs" aria-label={_t("ゲーム画面")}>
        {([
                ["spin", _t("チャート")],
                ["positions", _t("ポジション")],
                ["upgrades", _t("アップグレード")],
                ["coin", _t("コインフリップ")],
            ] as const).filter(([id]) => id !== "coin" || canOpenCoin).map(([id, label]) => (<button key={id} aria-current={tab === id ? "page" : undefined} className={`${tab === id ? "selected" : ""} ${guide.target === id ? "guide-target" : ""}`} onClick={() => setTab(id)}>
            {_text(label)}
            {id === "positions" && (<span>
                {usedSlots(shown)}/{shown.slots}
              </span>)}
            {id === "upgrades" && shown.jackpots > 0 && <i className="live-dot"/>}
          </button>))}
      </nav>}
      {shown.settings.newsPosition === "bottom" && news}
      <div className="play-dock">
        <TrialTimeShop s={shown} budget={coinBudget(model)} onBuy={() => { flushSync(() => dispatch({ type: "trial-time", now: Date.now() })); telemetry.current?.event(state.current, "trial_time", { amount: state.current.trial?.lastPurchase?.cost ?? 0, durationMs: state.current.trial?.lastPurchase?.addedMs ?? 0 }); }}/>
        {shown.settings.handToys && shown.settings.dockToy !== "off" ? <HandToyButton key={shown.id + shown.settings.dockToy} runId={shown.id} mode={shown.settings.dockToy} settings={shown.settings} onEarn={() => { if (!trialActive(state.current))
            return; change(work); impact(surface.current, "work", shown.settings, flash.current); }}/> : coinUnlocked(shown) && shown.coinEnabled ? <button id="work-button" className="work-button flip-button" disabled={!trialActive(shown)} data-ui-cue="handled" onClick={event => flipCoin(event.currentTarget)} aria-label={_t("コインを投げる 賭け金{0}", money(shown.coinStake))}><span>FLIP <img src="/flip-bull-coin.png" alt=""/></span><small>{_t("{0} / 1枚", money(shown.coinStake))}</small></button> : shown.settings.workMode === "gamble" ? <button className="work-button" disabled={rush} onClick={() => setTab("positions")}>{_t("WORKポジション")}<small>{_t("毎スピン +$5 · 賭け金$0")}</small></button> : <button id="work-button" className={`work-button ${guide.target === "work" ? "guide-target" : ""}`} disabled={!trialActive(shown)} data-ui-cue="work" onClick={(event) => { if (!trialActive(state.current))
            return; change(work); workBurst.burst(event); if (shown.settings.workCosmetics && shown.workFxLevel > 0) {
            sound(shown.workFxLevel === 4 ? "streak" : "work", { ...shown.settings, soundPack: (["terminal", "crystal", "retro-arcade", "impact", "arcade"] as const)[shown.workFxLevel] }, shown.workFxLevel);
        } }}>
          <span>
            WORK <i>↗</i>
          </span>
          <small>
            {shown.settings.fuelEnabled ? _t("+$1 ＆ 容量を補充") : _t("+$1 稼ぐ")}
          </small>
        </button>}
        {shown.settings.fuelEnabled && (<div className="compute">
            <div>
              <span>{_t("スピン容量")}</span>
              <b>
                {Math.floor(shown.fuel)}
                <span> / {fuelCapacity(shown)}</span>
              </b>
            </div>
            <div className="fuel-track">
              <i style={{ width: `${(shown.fuel / fuelCapacity(shown)) * 100}%` }}/>
            </div>
            <small>{rush ? _t("JACKPOT中は消費ゼロ") : _t("1スピンで1消費")}</small>
          </div>)}
        {captureMode && <button className="dock-upgrade capture-open" aria-expanded={tab !== "spin"} onClick={() => setTab(tab === "spin" ? "positions" : "spin")}><span>{tab === "spin" ? _t("操作") : _t("閉じる")}</span><small>{_t("ギャンブル / 強化")}</small></button>}
        {desk && !captureMode && <button className={`dock-upgrade dock-cycle ${guide.target === "upgrades" || (tab === "upgrades" && guide.target === "positions") ? "guide-target" : ""}`} onClick={() => setTab(nextPanel)} aria-label={_t("{0}を開く", dockLabel(nextPanel))}>
          <span key={nextPanel}>{dockLabel(nextPanel)}</span><small>{_t("↻ 切り替え")}</small>
        </button>}
        <label className={`auto-control ${shown.running ? "on" : ""} ${guide.target === "auto" ? "guide-target" : ""}`} data-ui-cue="auto">
          <span>
            AUTO{" "}
            <NativeSwitch label="AUTO" checked={shown.running} disabled={shown.trial ? !!shown.trial.result : !shown.portfolio.length || (!desk && shown.spins === 0 && !shown.running && tab !== "spin")} tactile={shown.settings.haptics} onChange={(running) => shown.trial ? toggleTrial() : change((shown) => ({
            ...shown,
            running,
            startedAt: shown.startedAt ?? Date.now(),
        }))}/>
          </span>
          {shown.trial && <TrialClock s={shown} onResult={() => setModal("trial-result")}/>}
        </label>
      </div>
      {model.positionRequest?.confirm && <Modal title={_t("ジャックポットを終了しますか？")} onClose={() => dispatch({ type: "position-decision", request: model.positionRequest!, accept: false })}><p>{_t("ポジションを変更すると、このジャックポットと出目カットが終了します。")}</p><div className="button-row"><button className="secondary" onClick={() => dispatch({ type: "position-decision", request: model.positionRequest!, accept: false })}>{_t("変更せず続ける")}</button><button className="primary" onClick={() => dispatch({ type: "position-decision", request: model.positionRequest!, accept: true })}>{_t("終了して変更する")}</button></div></Modal>}
      {s.background && pageVisible && <Modal title={_t("離れていた間の進行を反映中")} dismissible={false} onClose={() => { }}><p role="status">{_t("スピンとセーブを更新しています…")}</p></Modal>}
      {modal === "common-roll" && <Modal title={_t("1つの数字で、全部が動く。")} dismissible={false} onClose={() => { }}>
        <div className="common-roll-help"><div className="common-roll-number">72</div><p>{_t("毎スピン、引く数字は")}<strong>{_t("1つだけ。")}</strong><br />{_t("その同じ数字で、セットしたすべてのギャンブルの当たり・ハズレが決まります。")}</p><p>{_t("当たる範囲が重なれば、同時に当たります。")}</p><button className="primary" onClick={() => { change(run => ({ ...run, commonRollExplained: true })); setModal(null); telemetry.current?.event(state.current, "guidance_resolved", { tutorialStep: "common-roll" }); }}>{_t("わかった →")}</button></div>
      </Modal>}
      {!studio && modal === "trial-mode" && <Modal title={_t("モードを選ぶ")} onClose={() => setModal(null)}><TrialModes s={shown} onSwitch={switchMode}/></Modal>}
      {!studio && modal === "trial-ranking" && <Modal title="LEADERBOARD" onClose={() => setModal(null)}><div className="button-row"><button className="secondary" onClick={() => setModal("leaderboard")}>{_t("クリア時間")}</button><button className="primary">{_t("30分・総資産")}</button></div><TrialLeaderboard /></Modal>}
      {!studio && modal === "trial-result" && shown.trial?.result && <Modal title="TIME UP" className="clear-modal" dismissible={!!shown.trial.nickname} onClose={() => setModal(null)}>
        <TrialResult s={shown} onChange={change} onRanking={() => setModal("trial-ranking")} onRetry={() => switchMode("trial", shown.trial!.rule)} onNormal={() => switchMode("normal")}/>
      </Modal>}
      {modal === "background" && <Modal title={_t("バックグラウンド · LAB")} onClose={() => setModal(null)}><BackgroundSettings s={shown} change={change}/></Modal>}
      {modal === "menu" && (<Modal title="dontwork.fun" onClose={() => setModal(null)}>
          <div className="menu-grid">
            <div className="language-switch" role="group" aria-label="Language"><button aria-pressed={uiLanguage==="ja"} onClick={()=>setLanguage("ja")}>JP · 日本語</button><button aria-pressed={uiLanguage==="en"} onClick={()=>setLanguage("en")}>EN · English</button></div>
            {studio && <button className="primary" onClick={() => { setModal(null); studio.onSettings(); }}>{_t("撮影スタジオの設定")}</button>}
            {shown.catalog === "legacy" && <button className="secondary" disabled={rush} onClick={() => setModal("draft")}>{_t("特殊ガチャ →")}</button>}
            {!isMobileDevice() && onOpenDesk && <button className="secondary" disabled={!!model.pending} onClick={onOpenDesk}>{_t("縦長ウィンドウで遊ぶ ↗")}</button>}
            {([
                ["trial-mode", _t("モードを選ぶ · 30分チャレンジ")],
                ["versions", _t("別のバージョン")],
                ["help", _t("遊び方")],
                ["lab", _t("LAB · 体験を比較")],
                ["transfer", _t("セーブ・合言葉")],
                ["stats", _t("プレイ記録")],
                ["restart", _t("初めからやり直す")],
            ] as const).filter(([id]) => !studio || id === 'help').map(([id, label]) => (<button className="secondary" key={id} onClick={() => { if (id === "restart")
                setRestartFrom("menu"); setModal(id); }}>
                {_text(label)} →
              </button>))}
          </div>
          <p className="setting-note">v{VERSION}</p>
        </Modal>)}
      {!studio && modal === "restart" && <Modal title={_t("初めからやり直す")} onClose={() => setModal(restartFrom)}>
        <p>{_t("今の進行をリセットして、$0から始めます。音や表示の設定は引き継ぎます。")}</p>
        <p className="setting-note">{_t("今の続きを残す場合は、先に「セーブ・合言葉」で保存してください。")}</p>
        <div className="button-row"><button className="secondary" onClick={() => setModal("transfer")}>{_t("セーブ・合言葉")}</button><button className="secondary" onClick={() => setModal(restartFrom)}>{_t("戻る")}</button><button className="primary" onClick={() => {
                change(run => ({ ...run.trial ? freshTrial(run.settings, run.trial.rule) : freshRun(run.catalog, run.settings), telemetry: run.telemetry }));
                setTab("spin");
                setModal(null);
                setToast(_t("新しい相場を始めました。"));
            }}>{_t("初めから始める")}</button></div>
      </Modal>}
      {modal === "versions" && <Modal title={_t("バージョンを選ぶ")} onClose={() => setModal(null)}><VersionLinks /></Modal>}
      {modal === "jackpot-help" && <Modal title="JACKPOT" onClose={() => setModal(null)}><JackpotHelp discovered={shown.infinityAt !== null} rule={shown.settings.jackpotRule}/></Modal>}
      {modal === "pwa" && (<Modal title={_t("ホーム画面に追加")} onClose={() => setModal(null)}>
          <PwaHelp pwa={pwa} onSave={() => setModal("transfer")}/>
        </Modal>)}
      {!studio && modal === "transfer" && (<Modal title={_t("セーブ・合言葉")} onClose={() => setModal(needsPwa() ? "install" : null)}>
          <SaveTransfer current={s} onApply={(run) => {
                setS(() => run);
                try {
                    localStorage.setItem(INTRO_KEY, "1");
                }
                catch {
                    /* Save already persisted. */
                }
                setModal(null);
                setModal(needsPwa() ? "install" : null);
                setToast(_t("続きを保存しました。ホーム画面版には合言葉で引き継げます。"));
            }}/>
        </Modal>)}
      {modal === "presets" && (<Modal title={_t("編成プリセット")} onClose={() => setModal(null)}>
          <Presets s={shown} change={change} notify={setToast} onLoad={index => requestPosition({ kind: "preset", index })} pending={!!model.positionRequest}/>
        </Modal>)}
      {modal === "draft" && (<Modal title={_t("特殊ギャンブルのガチャ")} onClose={() => setModal(null)}>
          <Draft s={shown} change={change}/>
        </Modal>)}
      {modal === "bet" && detailBet && (<Modal title={betById(detailBet).name} onClose={() => setModal(null)}>
          <BetCard b={betById(detailBet)} s={shown} change={change} pending={!!model.positionRequest} onPosition={requestPosition} onProbability={upgradeProbability} onBlocked={(id, reason) => { setModal(null); setTab("positions"); blockedPosition(id, reason); }}/>
        </Modal>)}
      {modal === "install" && (<Modal key="startup-install" title={_t("ホーム画面に追加")} onClose={continueFromInstall} dismissible={!needsPwa()}>
          <InstallWelcome pwa={pwa} onSave={() => setModal("transfer")}/>
        </Modal>)}
      {modal === "intro" && (<Modal title="dontwork.fun" dismissible={false} onClose={dismissIntro}>
          <GameOverview settings={shown.settings} onDone={dismissIntro}/>
        </Modal>)}
      {modal === "help" && <Modal title={_t("遊び方")} onClose={() => setModal(null)}><GameHelp s={shown}/></Modal>}
      {modal === "news-help" && newsDetail && <Modal title={newsDetail.label} onClose={() => setModal(null)}><NewsHelp s={shown} guide={newsDetail}/>{newsDetail.key==="tip-5"&&<BackgroundSettings s={shown} change={change}/>}</Modal>}
      {!studio && modal === "lab" && (<Modal title="THE LAB" wide onClose={() => setModal(null)}>
          <TrialModes s={shown} onSwitch={switchMode} lab/>
          <Lab onWorkMode={(mode, dockToy) => requestPosition({ kind: "work-mode", mode, dockToy })} s={shown} change={change} notify={setToast} preparePreview={() => {
                change((run) => ({ ...run, running: false }));
                clock.current = 0;
                stopSpinCharge();
                return Math.max(0, resultDueAt.current - performance.now()) + 220;
            }}/>
        </Modal>)}
      {modal === "sound" && <Modal title={_t("サウンドパック")} onClose={() => setModal(null)}>
        <label className="setting-row"><span>{_t("効果音")}</span><NativeSwitch label={_t("効果音")} checked={shown.settings.sound} tactile={shown.settings.haptics} onChange={sound => { change(run => configure(run, { sound })); setAudioEnabled(audioEnabled({ ...shown.settings, sound })); if (sound)
            wakeAudio(true); }}/></label>
        <SoundPackPicker value={shown.settings.soundPack} onChange={soundPack => {
                const patch = soundPackSettings(soundPack);
                change(run => configure(run, patch));
                uiSound("win", { ...shown.settings, ...patch });
            }}/>
        <button className="secondary" onClick={() => setModal("settings")}>{_t("音量・振動の設定 →")}</button>
      </Modal>}
      {!studio && modal === "settings" && (<Modal title="SETTINGS" onClose={() => setModal(null)}>
          <SettingsPanel s={s} change={change} notify={setToast} erase={() => telemetry.current?.erase() ?? Promise.resolve()}/>
        </Modal>)}
      {!studio && modal === "feedback" && (<Modal title="TELL US WHAT YOU FELT" onClose={() => setModal(null)}>
          <Feedback s={shown} sendRating={sendRating} send={(body) => telemetry.current?.sendFeedback(state.current, body) ??
                request("/api/feedback", { ...body, telemetryEnabled: false })}/>
        </Modal>)}
      {!studio && modal === "rating" && <Modal title="YOUR RATING" onClose={() => setModal(null)}><Rating source="clear" onSend={sendRating} onDone={() => setModal(null)}/></Modal>}
      {modal === "stats" && (<Modal title="YOUR TRACK RECORD" onClose={() => setModal(null)}>
          <Stats s={shown}/>
        </Modal>)}
      {!studio && (modal === "leaderboard" || modal === "clear") && (<Modal title={modal === "clear" ? "GOAL CLEARED" : "LEADERBOARD"} className={modal === "clear" ? "clear-modal" : ""} dismissible={modal !== "clear" || !!shown.completionNickname} onClose={closeResult}>
          {modal === "leaderboard" && <div className="button-row"><button className="primary">{_t("クリア時間")}</button><button className="secondary" onClick={() => setModal("trial-ranking")}>{_t("30分・総資産")}</button></div>}
          <Leaderboard key={modal} s={shown} change={change} clear={modal === "clear"} saveName={(name) => saveCompletionName(state.current, name)} notify={setToast} onRanking={() => { ratingAfterRanking.current = shown.completion?.id ?? null; setModal("leaderboard"); }}/>
          {modal === "clear" && <>
            <button className="primary continue-button" disabled={!shown.completionNickname} onClick={closeResult}>{_t("このまま続ける →")}</button>
            <button className="secondary continue-button" disabled={!shown.completionNickname} onClick={() => { setRestartFrom("clear"); setModal("restart"); }}>{_t("初めからやり直す")}</button>
          </>}
        </Modal>)}
      <div ref={workBurst.layer} className="work-burst-layer" aria-hidden="true"/>
      <div ref={coinLayer} className="coin-flight-layer" aria-hidden="true"/>
      <div ref={visualLayer} className="result-visual-layer" aria-hidden="true"/>
      <div ref={flash} className="screen-flash" aria-hidden="true"/>

    </div>);
}
