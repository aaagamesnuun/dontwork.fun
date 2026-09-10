import { defaultTelemetry } from "../serviceConfig";
import { moneyStyle } from "../moneyPreferences";
import { activatePositionTutorial, introductoryBets, type SecondBetTutorial } from "./positionTutorial";
import { defaultLanguage } from "../i18n";
import { CASH_RAIN_SETTINGS, SPIN_REVEAL_DEFAULTS } from "../soundPresets";
import { isBanknoteStyle, type BanknoteStyle } from "../banknotes";
import type { BackgroundClock } from "../backgroundPlay";
import {
  ALL_BETS,
  BASE_BETS,
  CATALOGS,
  LEGACY_BETS,
  betById,
  catalogById,
  type Bet,
  type CatalogId,
} from "./catalog";

export const VERSION = "3.0.0";
export const ECONOMY_REVISION = 13 as const;
export const MAX_CHART_SPINS = 1000;
export const HISTORY_LIMIT = 1800;
export const SAVE_KEY = "bebullish-save-v1";
export const MONEY_CEILING = 1e200;
export const TARGET = 1_000_000_000;
export type Upgrade = "slots" | "speed" | "capacity" | "trim" | "rush";
export const UPGRADES: Upgrade[] = [
  "slots",
  "speed",
  "capacity",
  "trim",
  "rush",
];
export interface UpgradeDraw {
  upgrade: Upgrade;
  level: number;
  price: number;
}
export interface Memory {
  streak: number;
  misses: number;
  previous: number | null;
  armed: boolean;
}
export interface Row {
  id: string;
  count: number;
}
export interface Outcome {
  id: number;
  roll: number;
  baseRoll?: number;
  rollBonus?: number;
  profit: number;
  payout: number;
  wager: number;
  jackpot: boolean;
  assisted: boolean;
  infinity: boolean;
  rushBefore: boolean;
  trimAdded: number;
  hits: string[];
  activated: string[];
  newUnlocks: string[];
  maxStreak: number;
  at: number;
}
export const JACKPOT_INTERVALS = [100, 200, 300, 500, 750, 1000] as const;
export const SWEEP_MOTIONS = [
  "classic",
  "slow",
  "roam",
  "focus",
  "recoil",
  "lock",
  "mix",
] as const;
export interface Settings {
  rollDisplay: "number";
  spectacleRevision: 1;
  handToys: boolean;
  coinFlip: boolean;
  dockToy: "off" | "tap" | "beat" | "charge";
  backgroundPlay: boolean;
  backgroundRevision: 2;
  bigChangeNotifications: boolean;
  jackpotNotifications: boolean;
  sweepSound: boolean;
  coinChartMarkers: boolean;
  streakEffects: boolean;
  effectIntensity: number;
  winVisual: "classic" | "cash" | "gold" | "neon" | "confetti" | "mix" | "festival";
  jackpotVisual: "classic" | "cash" | "gold" | "neon" | "confetti" | "mix" | "festival";
  chartBackdrop: "off" | "aurora" | "flow" | "pulse";
  jackpotRule: "hundred" | "double-high" | "combined";
  showJackpotCounter: boolean;
  layoutRevision: 1;
  workspaceMode: "desk" | "tabs";
  captureMode: boolean;
  sharedChart: boolean;
  balanceChangeInline: boolean;
  oddsDisplay: "percent" | "fraction";
  probabilityUpgrades: boolean;
  baccarat: boolean;
  sharedSpin: boolean;
  sharedSpinRevision: 1;
  spinSize: "compact" | "expanded";
  brandIcon: "arrow" | "bull";
  banknoteStyle: BanknoteStyle;
  cashMotion: "rain" | "burst";
  cashPresentationRevision: 1;
  wealthTheme: "fixed" | "tiers" | "drawdown";
  adaptiveMusic: boolean;
  workMode: "click" | "gamble";
  workCosmetics: boolean;
  upgradeTutorial: "money" | "scripted";
  spinAssist: boolean;
  secondBetAssist: boolean;
  secondBetAssistRevision: 1;
  spinAssistSequence: string;
  presentationRevision: 1;
  spinSound: "rhythm" | "original";
  chartWindowSpins: number;
  fuelEnabled: boolean;
  newsPosition: "top" | "bottom";
  sweepMotion: (typeof SWEEP_MOTIONS)[number];
  music: boolean;
  jackpotMusic: "follow" | "on" | "off";
  bassMode: boolean;
  jackpotAutoTab: boolean;
  musicPack: "pulse" | "night" | "arcade";
  musicVolume: number;
  jackpotSpinIntervalMs: (typeof JACKPOT_INTERVALS)[number];
  chartAxis: "spins" | "time";
  soundPack:
    | "arcade-coinop" | "arcade-pinball" | "arcade-synth" | "arcade-punch"
    | "terminal"
    | "retro-arcade"
    | "soft"
    | "crystal"
    | "arcade"
    | "wood"
    | "impact";
  chargeSound: "off" | "ticks" | "rise";
  chargeVolume: number;
  payoffStyle: "classic" | "chart" | "net";
  soundVolume: number;
  lossVolume: number;
  soundDensity: "all" | "balanced" | "highlights";
  shake: "off" | "light" | "strong";
  impactFlash: "off" | "soft" | "bright";
  revealDurationMs: 120 | 260 | 420 | 700 | 1200 | 2000 | 3500 | 5000;
  revealPacing: "ratio" | "adaptive" | "full";
  revealRatio: number;
  rhythmRevision: 1;
  spinRevealRevision: 1;
  reelStyle: "payoff" | "number";
  sound: boolean;
  haptics: boolean;
  motion: "full" | "reduced";
  fx: "cinematic" | "clean" | "arcade";
  language: "ja" | "en";
  opening: 10 | 20;
  assist: boolean;
  assistAfter: number;
  spinSpeedScale: number;
  rushBase: number;
  upgradePrices: "steep" | "exponential" | "legacy";
  economyProfile: "v24" | "v22" | "v20";
  positionPriceBase: number;
  positionPriceMultiplier: number;
  speedPriceBase: number;
  speedPriceMultiplier: number;
  upgradeMode: "direct" | "gacha";
}
export const TRIAL_MS = 30 * 60 * 1000;
export type TrialRule = "fixed" | "shop" | "lottery";
export interface TrialResult {
  id:string; appVersion:string; rulesetVersion:string; catalog:CatalogId;
  durationMs:number; finalBankroll:number; spins:number; ranked:boolean;
  rule:TrialRule; addedMs:number;
}
export interface TimeTrial {
  scoring?: "cash" | "assets";
  rule:TrialRule; elapsedMs:number; addedMs:number; anchor:number|null;
  started:boolean; paused:boolean; result:TrialResult|null;
  nickname:string; submitted:boolean;
  purchases:number; spent:number; lastPurchase:{cost:number;addedMs:number}|null;
}
export const trialAssets = (s:Run) => finiteMoney(s.cash + (s.trial?.scoring === "cash" ? 0 : s.spent));
export const trialRemaining = (trial:TimeTrial) => Math.max(0,TRIAL_MS+trial.addedMs-trial.elapsedMs);
export const trialActive = (s:Run) => !s.trial || (s.running && s.trial.started && !s.trial.paused && !s.trial.result && trialRemaining(s.trial)>0);
export interface Run {
  trial: TimeTrial | null;
  bestPayout: number;
  winStreak: number;
  background: BackgroundClock | null;
  backgroundMs: number;
  backgroundJackpot: boolean;
  coinEnabled: boolean;
  coinUnlockAnnounced: boolean;
  coinStake: number;
  coinRounds: number;
  coinWins: number;
  coinWagered: number;
  coinPaid: number;
  coinResult: { id: number; won: boolean; wager: number; payout: number; profit: number } | null;
  coinChartHold: Run["history"] | null;
  coinPendingProfit: number;
  coinPendingCount: number;
  jackpotHigh: boolean;
  spinsSinceJackpot: number | null;
  commonRollExplained: boolean;
  secondBetTutorial: SecondBetTutorial;
  betLevels: Record<string, number>;
  baccaratRounds: number;
  baccaratResult: { player: number; banker: number; side: "player" | "banker"; wager: number; profit: number } | null;
  workFxLevel: number;
  completionNickname: string;
  completion: {
    id: string;
    appVersion: string;
    rulesetVersion: string;
    catalog: CatalogId;
    timeMs: number;
    spins: number;
    ranked: boolean;
  } | null;
  entryKind?: "transfer";
  version: 1;
  economyRevision: typeof ECONOMY_REVISION;
  id: string;
  catalog: CatalogId;
  cash: number;
  peak: number;
  fuel: number;
  slots: number;
  speed: number;
  capacity: number;
  trim: number;
  rush: number;
  running: boolean;
  portfolio: Row[];
  owned: string[];
  offers: string[];
  draws: number;
  upgradeDraws: number;
  lastUpgradeDraw: UpgradeDraw | null;
  presets: Row[][];
  memory: Record<string, Memory>;
  rushLeft: number;
  removed: number;
  persistentRemoved: number;
  chain: number;
  spins: number;
  work: number;
  jackpots: number;
  maxChain: number;
  bestWin: number;
  maxStreak: number;
  lifetimeProfit: number;
  spent: number;
  activeMs: number;
  startedAt: number | null;
  clearAt: number | null;
  clearActiveMs: number | null;
  clearSpins: number | null;
  clearSnapshot?: {cash:number;spent:number;maxChain:number;work?:number;coinWagered?:number;coinPaid?:number;history:Run["history"]} | null;
  infinityAt: number | null;
  submitted: boolean;
  debug: boolean;
  assistUsed: boolean;
  history: {
    cash: number;
    at: number;
    kind: string;
    spin?: number;
    spent?: number;
    coinProfit?: number;
    coinCount?: number;
    trialMs?: number;
    assets?: number;
  }[];
  last: Outcome | null;
  settings: Settings;
  telemetry: boolean;
}
export const defaultSettings: Settings = {
  rollDisplay: "number",
  spectacleRevision: 1, handToys: false, coinFlip: false, dockToy: "off",
  backgroundPlay: false,
  backgroundRevision: 2,
  bigChangeNotifications: false,
  jackpotNotifications: false,
  sweepSound: false,
  coinChartMarkers: false,
  streakEffects: false,
  effectIntensity: 1,
  ...CASH_RAIN_SETTINGS,
  jackpotRule: "combined",
  showJackpotCounter: false,
  layoutRevision: 1,
  workspaceMode: "desk",
  captureMode: false,
  sharedChart: true,
  balanceChangeInline: false,
  oddsDisplay: "fraction",
  probabilityUpgrades: false,
  baccarat: false,
  sharedSpin: true,
  sharedSpinRevision: 1,
  spinSize: "compact",
  brandIcon: "arrow",
  banknoteStyle: "random",
  cashMotion: "burst",
  cashPresentationRevision: 1,
  wealthTheme: "fixed",
  adaptiveMusic: false,
  workMode: "click",
  workCosmetics: false,
  upgradeTutorial: "money",
  spinAssist: true,
  secondBetAssist: true,
  secondBetAssistRevision: 1,
  spinAssistSequence: "WWLWW",
  presentationRevision: 1,
  spinSound: "rhythm",
  chartWindowSpins: 200,
  fuelEnabled: false,
  newsPosition: "top",
  music: false,
  jackpotMusic: "follow",
  bassMode: true,
  jackpotAutoTab: true,
  musicPack: "pulse",
  musicVolume: 0.18,
  jackpotSpinIntervalMs: 300,
  chartAxis: "spins",
  chargeSound: "off",
  chargeVolume: 0.35,
  payoffStyle: "classic",
  soundVolume: 1,
  lossVolume: 0.9,
  revealDurationMs: 700,
  rhythmRevision: 1,
  reelStyle: "payoff",
  sound: true,
  haptics: true,
  motion: "full",
  fx: "cinematic",
  language: defaultLanguage(),
  opening: 10,
  assist: true,
  assistAfter: 32,
  spinSpeedScale: 1,
  rushBase: 20,
  upgradePrices: "steep",
  economyProfile: "v24",
  positionPriceBase: 120,
  positionPriceMultiplier: 10,
  speedPriceBase: 25,
  speedPriceMultiplier: 1.2,
  upgradeMode: "direct",
};
export const customRules = (settings: Settings, trial = false) =>
  settings.handToys || settings.jackpotRule !== "combined" || settings.probabilityUpgrades || settings.baccarat ||
  settings.workMode === "gamble" || settings.workCosmetics ||
  (!trial && (!settings.secondBetAssist || !settings.spinAssist || settings.spinAssistSequence !== "WWLWW")) ||
  JSON.stringify([
    settings.opening,
    trial ? true : settings.assist,
    settings.assistAfter,
    settings.spinSpeedScale,
    settings.rushBase,
    settings.upgradePrices,
    settings.economyProfile,
    settings.upgradeMode,
    settings.jackpotSpinIntervalMs,
    settings.fuelEnabled,
    settings.positionPriceBase ?? 120,
    settings.positionPriceMultiplier ?? 10,
    settings.speedPriceBase ?? 25,
    settings.speedPriceMultiplier ?? 1.2,
  ]) !==
  JSON.stringify([
    10,
    true,
    32,
    1,
    20,
    "steep",
    "v24",
    "direct",
    300,
    false,
    120,
    10,
    25,
    1.2,
  ]);
export const priceProfile = (
  economyProfile: Settings["economyProfile"],
): Partial<Settings> => ({
  economyProfile,
  upgradePrices: "steep",
  positionPriceBase: 120,
  positionPriceMultiplier: 10,
  speedPriceBase: 25,
  speedPriceMultiplier: economyProfile === "v20" ? 1.25 : 1.2,
});
export const freshRun = (
  catalog: CatalogId = "classic",
  settings: Settings = { ...defaultSettings },
): Run => ({
  trial: null,
  background: null, backgroundMs: 0, backgroundJackpot: false,
  jackpotHigh: false,
  spinsSinceJackpot: 0,
  commonRollExplained: false,
  secondBetTutorial: "waiting",
  betLevels: {},
  coinEnabled: false, coinUnlockAnnounced: false, coinStake: 10, coinRounds: 0, coinWins: 0, coinWagered: 0, coinPaid: 0, coinResult: null, coinChartHold: null, coinPendingProfit: 0, coinPendingCount: 0,
  baccaratRounds: 0,
  baccaratResult: null,
  workFxLevel: 0,
  completionNickname: "",
  completion: null,
  version: 1,
  economyRevision: ECONOMY_REVISION,
  id: crypto.randomUUID(),
  catalog,
  cash: 0,
  peak: 0,
  fuel: 5,
  slots: 1,
  speed: 0,
  capacity: 0,
  trim: 0,
  rush: 0,
  running: false,
  portfolio: [],
  owned: [],
  offers: [],
  draws: 0,
  upgradeDraws: 0,
  lastUpgradeDraw: null,
  presets: [[], [], []],
  memory: {},
  rushLeft: 0,
  removed: 0,
  persistentRemoved: 0,
  chain: 0,
  spins: 0,
  work: 0,
  jackpots: 0,
  maxChain: 0,
  bestWin: 0,
  bestPayout: 0, winStreak: 0,
  maxStreak: 0,
  lifetimeProfit: 0,
  spent: 0,
  activeMs: 0,
  startedAt: null,
  clearAt: null,
  clearActiveMs: null,
  clearSpins: null,
  infinityAt: null,
  submitted: false,
  debug: catalog === "all-test" || customRules(settings),
  assistUsed: false,
  history: [{ cash: 0, at: 0, spin: 0, kind: "start" }],
  last: null,
  settings: { ...settings },
  telemetry: defaultTelemetry(),
});
export const compactMoney = (n: number, decimals = 2): string => {
  const value = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (value >= MONEY_CEILING) return sign + "$1e200+";
  const units: [
    [number, string],
    [number, string],
    [number, string],
    [number, string],
  ] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  if (value >= 1e15) return sign + "$" + value.toExponential(2);
  for (const [scale, suffix] of units)
    if (value >= scale)
      return (
        sign +
        "$" +
        Number((value / scale).toFixed(value / scale >= 100 ? 0 : decimals)) +
        suffix
      );
  return (
    sign +
    "$" +
    value.toLocaleString("en-US", {
      maximumFractionDigits: value < 100 ? 2 : 0,
    })
  );
};
export const money = (n: number, decimals = 2): string => moneyStyle() === "full"
  ? (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: decimals })
  : compactMoney(n, decimals);
export const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return (
    (Math.floor(s / 3600) > 0 ? Math.floor(s / 3600) + ":" : "") +
    String(Math.floor(s / 60) % 60).padStart(2, "0") +
    ":" +
    String(s % 60).padStart(2, "0")
  );
};
export const finiteMoney = (n: number) =>
  Math.min(MONEY_CEILING, Math.max(0, Number.isNaN(n) ? 0 : n));
export const fuelCapacity = (s: Run) =>
  [5, 12, 30, 80, 200, 500, 1500][s.capacity] ?? 1500;
export const stakeOf = (b: Bet, s: Run) =>
  s.settings.opening === 20 && (b.id === "edge-50" || b.id === "long-edge-50")
    ? 20
    : b.pattern === "loss-ladder"
      ? b.stake *
        Math.pow(
          b.multiplier ?? 2,
          Math.min(b.target ?? 5, s.memory[b.id]?.misses ?? 0),
        )
      : b.stake;
export const payoutOf = (b: Bet, s: Run) =>
  s.settings.opening === 20 && (b.id === "edge-50" || b.id === "long-edge-50")
    ? 50
    : !["classic", "legacy"].includes(s.catalog) &&
        (b.id === "edge-50" || b.id === "long-edge-50")
      ? 25
      : b.payout;
export const totalCost = (s: Run) =>
  s.portfolio.reduce((n, r) => n + stakeOf(betById(r.id), s) * r.count, 0);
export const usedSlots = (s: Run) =>
  s.portfolio.reduce((n, r) => n + r.count, 0);
export const interval = (s: Run) =>
  s.catalog === "curated" ? 1000 : s.rushLeft > 0
    ? s.settings.jackpotSpinIntervalMs
    : Math.round(5000 * Math.pow(0.1, s.speed / 100)) *
      s.settings.spinSpeedScale;
export const rollFloor = (s: Run) => (s.rushLeft > 0 ? 1 + s.removed : 1);
export const jackpotFor = (s: Run, roll: number) => s.settings.jackpotRule === "hundred" ? roll === 100 : (s.settings.jackpotRule === "combined" && roll === 100) || (s.jackpotHigh && roll >= 91);
export const isInfinite = (s: Run) => s.rushLeft > 0 && s.removed === 99;
export const canSpin = (s: Run) =>
  trialActive(s) && s.portfolio.length > 0 &&
  s.cash >= totalCost(s) &&
  (!s.settings.fuelEnabled || s.rushLeft > 0 || s.fuel >= 1);
export const status = (s: Run) =>
  !s.portfolio.length
    ? "empty"
    : s.cash < totalCost(s)
      ? "cash"
      : s.settings.fuelEnabled && s.rushLeft <= 0 && s.fuel < 1
        ? "fuel"
        : s.running
          ? "running"
          : "paused";
export const catalogIds = (s: Run) => [...new Set([...catalogById(s.catalog).ids, ...(s.settings.workMode === "gamble" ? ["work-income"] : [])])];
export const availableBets = (s: Run) => catalogIds(s).map(betById).filter((b) => s.catalog === "all-test" || !b.legacy || s.owned.includes(b.id));
export const unlocked = (s: Run, b: Bet) =>
  s.catalog === "all-test" || (b.id === "work-income" && s.settings.workMode === "gamble") || (b.legacy ? s.owned.includes(b.id) : s.peak >= b.unlock);
export const mem = (s: Run, id: string): Memory =>
  s.memory[id] ?? { streak: 0, misses: 0, previous: null, armed: false };
const inRange = (roll: number, r: [number, number]) =>
  roll >= r[0] && roll <= r[1];
// Each upgrade adds one successful face to this card's shared-roll condition.
// It never draws another random number or changes the global Jackpot face.
const expandedFaces = new WeakMap<Run, Map<string, Set<number>>>();
export function expandedMatch(s: Run, b: Bet, roll: number, test: (face: number) => boolean): boolean {
  if (test(roll)) return true;
  const level = s.settings.probabilityUpgrades ? (s.betLevels[b.id] ?? 0) : 0;
  if (!level) return false;
  let cached=expandedFaces.get(s);
  if(!cached){cached=new Map();expandedFaces.set(s,cached)}
  const key=b.id+":"+level+":"+test.toString();
  if(cached.has(key)) return cached.get(key)!.has(roll);
  const wins = Array.from({length:100}, (_,i)=>i+1).filter(test);
  if (!wins.length || wins.length===100) return false;
  const distance = (face:number) => Math.min(...wins.map(win=>Math.abs(face-win)));
  const misses = Array.from({length:100}, (_,i)=>i+1).filter(face=>!test(face));
  misses.sort((a,b)=>distance(a)-distance(b) || b-a);
  const extra=new Set(misses.slice(0,level));cached.set(key,extra);
  return extra.has(roll);
}
export function supportActive(s:Run,b:Bet,roll:number) {
  return mem(s,b.id).armed && !!b.second && expandedMatch(s,b,roll,face=>inRange(face,b.second!));
}
export function resolve(s: Run, b: Bet, roll: number) {
  const m = { ...mem(s, b.id) };
  let payout = 0,
    penalty = 0,
    trim = 0,
    extension = 0,
    fuel = 0;
  const base = payoutOf(b, s);
  const hit = (test:(face:number)=>boolean) => expandedMatch(s,b,roll,test);
  const pay = (value = base) => {
    payout = finiteMoney(value);
  };
  switch (b.pattern) {
    case "work-income": pay(5); break;
    case "roll-shift": break;
    case "support":
      m.armed = Boolean(b.first && hit(face=>inRange(face,b.first!)));
      break;
    case "threshold":
    case "range":
      if (hit(face=>face >= b.start && face < b.start + b.width)) pay();
      break;
    case "odd":
      if (hit(face=>face % 2 === 1)) pay();
      break;
    case "even":
      if (hit(face=>face % 2 === 0)) pay();
      break;
    case "barbell":
      if (hit(face=>face <= b.width / 2 || face > 100 - b.width / 2)) pay();
      break;
    case "rising":
      pay((base * roll) / 100);
      break;
    case "islands":
      if (hit(face=>!!b.ranges?.some(r=>inRange(face,r)))) pay();
      break;
    case "ladder":
      if (hit(face=>face >= b.start)) {
        pay(base * Math.pow(b.multiplier ?? 1.5, Math.min(3000, m.streak)));
        m.streak = Math.min(1e8, m.streak + 1);
      } else m.streak = 0;
      break;
    case "loss-ladder":
      if (hit(face=>face >= b.start)) {
        pay();
        m.misses = 0;
      } else m.misses = Math.min(b.target ?? 5, m.misses + 1);
      break;
    case "step":
      if (m.armed && b.second && hit(face=>inRange(face,b.second!))) pay();
      m.armed = Boolean(b.first && hit(face=>inRange(face,b.first!)));
      break;
    case "drought":
      if (hit(face=>face >= b.start)) {
        pay(base + m.misses * (b.increment ?? 0));
        m.misses = 0;
      } else m.misses = Math.min(1e8, m.misses + 1);
      break;
    case "compare":
      if (m.previous !== null) {
        if (hit(face=>{const d=face-m.previous!;return (b.direction==="down"?-d:b.direction==="absolute"?Math.abs(d):d)>=(b.delta??1)})) pay();
      }
      break;
    case "high-streak":
      m.streak = hit(face=>face >= b.start) ? m.streak + 1 : 0;
      if (m.streak >= (b.target ?? 3)) {
        pay();
        m.streak = 0;
      }
      break;
    case "low-streak-crash":
      pay();
      m.streak = roll <= 10 ? m.streak + 1 : 0;
      if (m.streak >= (b.target ?? 3)) {
        penalty = b.penalty ?? 0;
        m.streak = 0;
      }
      break;
    case "rare-crash":
      if (hit(face=>face >= 2)) pay();
      else penalty = b.penalty ?? 0;
      break;
    case "reversal":
      if (m.previous !== null && m.previous <= 20 && hit(face=>face >= 80)) pay();
      break;
    case "fuel-return":
      if (hit(face=>face % 2 === 0)) {
        pay();
        fuel = s.settings.fuelEnabled ? (b.effect ?? 1) : 0;
      }
      break;
    case "low-fuel":
      if (hit(face=>face >= b.start))
        pay(
          base *
            (s.settings.fuelEnabled && s.fuel <= fuelCapacity(s) * 0.25
              ? 3
              : 1),
        );
      break;
    case "trim":
      if (hit(face=>face >= b.start)) pay();
      if (jackpotFor(s, roll)) trim = b.effect ?? 5;
      break;
    case "rush-extend":
      if (hit(face=>face >= b.start)) pay();
      if (jackpotFor(s, roll)) extension = b.effect ?? 5;
      break;
    case "rush-dividend":
      if (s.rushLeft > 0 && hit(face=>face >= b.start)) pay();
      break;
    case "trim-memory":
      if (hit(face=>face >= b.start)) pay();
      break;
  }
  m.previous = roll;
  return { payout, penalty, trim, extension, fuel, memory: m };
}
export const rollBonus = (s: Run) => s.portfolio.reduce((sum,row)=>{
  const b=betById(row.id);
  return sum + (b.pattern === "roll-shift" && (s.spins+1) % (b.target ?? 5) === 0 ? (b.effect ?? 10)*row.count : 0);
},0);
export const rollWeights = (s: Run) => {
  const weights = Array<number>(100).fill(0), floor=rollFloor(s), bonus=rollBonus(s);
  for(let raw=floor;raw<=100;raw++) weights[Math.min(100,raw+bonus)-1] += 1/(101-floor);
  return weights;
};
export function settlePortfolio(s: Run, roll: number) {
  const rows=s.portfolio.map(row=>({ ...row, bet:betById(row.id), result:resolve(s,betById(row.id),roll) }));
  const boost=1+rows.reduce((n,row)=> n+(row.bet.pattern === "support" && supportActive(s,row.bet,roll) ? ((row.bet.multiplier??1)-1)*row.count : 0),0);
  for(const row of rows) if(!["support","work-income","roll-shift"].includes(row.bet.pattern)) row.result.payout=finiteMoney(row.result.payout*boost);
  return { rows, boost, payout:finiteMoney(rows.reduce((n,row)=>n+row.result.payout*row.count,0)), cost:finiteMoney(rows.reduce((n,row)=>n+(stakeOf(row.bet,s)+row.result.penalty)*row.count,0)) };
}
export const nextDistribution = (s: Run) => {
  const weights=rollWeights(s);
  return weights.map((weight,i)=> {if(!weight) return null; const a=settlePortfolio(s,i+1); return a.payout-a.cost;});
};
const sample = (min: number, max: number) => {
  const span = max - min + 1;
  const limit = Math.floor(4294967296 / span) * span;
  const a = new Uint32Array(1);
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= limit);
  return min + (a[0] % span);
};
function sanitizeCoinPoint(point: Run["history"][number]): Run["history"][number] {
  point={...point};
  if(point.assets!==undefined && (!Number.isFinite(point.assets)||point.assets<0||point.assets>MONEY_CEILING))delete point.assets;
  if(point.trialMs!==undefined && (!Number.isFinite(point.trialMs)||point.trialMs<0||point.trialMs>TRIAL_MS+86400000))delete point.trialMs;
  const {coinCount,coinProfit,...rest}=point;
  return typeof coinCount==="number" && Number.isSafeInteger(coinCount) && coinCount>0 && coinCount<=1e8 && typeof coinProfit==="number" && Number.isFinite(coinProfit) && Math.abs(coinProfit)<=MONEY_CEILING
    ? {...rest,coinCount,coinProfit}:rest;
}
export function compactHistory(points: Run["history"]): Run["history"] {
  if (points.length <= HISTORY_LIMIT) return points;
  const latest = points.at(-1)?.spin;
  const recent =
    latest === undefined
      ? []
      : points
          .flatMap((p, i) =>
            p.spin !== undefined && p.spin >= latest - MAX_CHART_SPINS
              ? [i]
              : [],
          )
          .slice(-1300);
  const upgrades = points
    .flatMap((p, i) => (p.kind === "upgrade" ? [i] : []))
    .slice(-260);
  const keep = new Set([0, points.length - 1, ...upgrades, ...recent]);
  if (recent.length && recent[0] > 0) keep.add(recent[0] - 1);
  const candidates = points.flatMap((_, i) => (keep.has(i) ? [] : [i]));
  const size = Math.max(
    1,
    Math.ceil(
      candidates.length / Math.max(1, Math.floor((1700 - keep.size) / 2)),
    ),
  );
  for (let i = 0; i < candidates.length; i += size) {
    const bucket = candidates.slice(i, i + size);
    let low = bucket[0],
      high = bucket[0];
    for (const index of bucket) {
      if (points[index].cash < points[low].cash) low = index;
      if (points[index].cash > points[high].cash) high = index;
    }
    keep.add(low);
    keep.add(high);
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}
export function appendHistory(
  points: Run["history"],
  point: Run["history"][number],
): Run["history"] {
  return compactHistory([...points, point]);
}
export function finish(s: Run): Run {
  const n = activatePositionTutorial({ ...s, peak: Math.max(s.peak, s.cash) });
  if (!n.trial && n.cash >= TARGET && n.clearAt === null) {
    n.clearAt = Date.now();
    n.clearActiveMs = n.activeMs;
    n.clearSpins = n.spins;
    const points=[...n.history,{spin:n.spins,at:n.activeMs,cash:n.cash,kind:"clear",...(n.coinPendingCount>0?{coinCount:n.coinPendingCount,coinProfit:n.coinPendingProfit}:{})}];
    const keep=new Set([0,points.length-1]);
    const size=Math.max(1,Math.ceil(points.length/70));
    for(let i=0;i<points.length;i+=size){
      let low=i,high=i;
      for(let j=i;j<Math.min(points.length,i+size);j++){
        if(points[j].cash<points[low].cash)low=j;
        if(points[j].cash>points[high].cash)high=j;
      }
      keep.add(low);keep.add(high);
    }
    n.clearSnapshot={cash:n.cash,spent:n.spent,maxChain:n.maxChain,work:n.work,coinWagered:n.coinWagered,coinPaid:n.coinPaid,history:[...keep].sort((a,b)=>a-b).map(i=>({...points[i]}))};
    n.completion = {
      id: n.id,
      appVersion: VERSION,
      rulesetVersion: `astra-v${ECONOMY_REVISION}:${n.catalog}`,
      catalog: n.catalog,
      timeMs: Math.max(1000, Math.round(n.activeMs)),
      spins: n.spins,
      ranked: !n.debug && n.activeMs <= 14 * 86400000 && n.spins <= 1e8,
    };
  }
  return n;
}
export function spin(s: Run, forced?: number, elapsed = interval(s)): Run {
  if (!canSpin(s)) return s;
  s = activatePositionTutorial(s);
  const beforeUnlocked = availableBets(s)
    .filter((b) => unlocked(s, b))
    .map((b) => b.id);
  const baseline = s.portfolio.find(row => row.count > 0 && ["edge-50", "long-edge-50"].includes(row.id));
  const second = introductoryBets(s)?.second;
  const firstSecondSpin = s.secondBetTutorial === "active" && second && s.portfolio.some(row => row.id === second.id && row.count > 0);
  const assistedSecond = forced === undefined && firstSecondSpin && s.settings.secondBetAssist;
  const assistedOpening = !assistedSecond && forced === undefined && !s.trial && s.settings.spinAssist && s.spins < 5 && s.rushLeft === 0 && baseline;
  let openingRoll: number | undefined;
  if (assistedSecond) {
    const eligible = Array.from({length:100},(_,i)=>i+1).filter(face => face >= rollFloor(s) && resolve(s,second!,face).payout > 0);
    const quiet = eligible.filter(face => face <= 90), faces = quiet.length ? quiet : eligible;
    openingRoll = faces[Math.floor(faces.length / 2)];
  } else if (assistedOpening) {
    const bet = betById(baseline.id), hit = s.settings.spinAssistSequence[s.spins] === "W";
    const faces = Array.from({length:90},(_,i)=>i+1).filter(face => (resolve(s,bet,face).payout > 0) === hit);
    openingRoll = faces[Math.floor(faces.length / 2)];
  }
  const assisted = forced === undefined && openingRoll === undefined &&
    !s.trial && s.settings.assist && !s.assistUsed && s.jackpots === 0 &&
    s.spins + 1 >= Math.max(1, s.settings.assistAfter - (s.settings.jackpotRule === "double-high" ? 1 : 0));
  const baseRoll = forced ?? openingRoll ?? (assisted ? 100 : sample(rollFloor(s), 100));
  if(!Number.isInteger(baseRoll) || baseRoll<rollFloor(s) || baseRoll>100) throw new Error("Roll outside current range");
  const bonus = forced === undefined && openingRoll === undefined ? rollBonus(s) : 0;
  const roll = Math.min(100, baseRoll + bonus);
  if (!Number.isInteger(roll) || roll < rollFloor(s) || roll > 100)
    throw new Error("Roll outside current range");
  let payout = 0,
    penalty = 0,
    trimAdded = 0,
    extension = 0,
    fuelGained = 0;
  const memory = { ...s.memory };
  const hits: string[] = [],
    activated: string[] = [];
  for (const row of settlePortfolio(s, roll).rows) {
    const b = row.bet, r = row.result;
    memory[b.id] = r.memory;
    payout = finiteMoney(payout + r.payout * row.count);
    penalty += r.penalty * row.count;
    trimAdded += r.trim * row.count;
    extension += r.extension * row.count;
    fuelGained += r.fuel * row.count;
    if (r.payout > 0) hits.push(b.id);
    if (r.memory.armed && !mem(s, b.id).armed) activated.push(b.id);
  }
  const wager = totalCost(s),
    profit = payout - wager - penalty,
    cash = finiteMoney(s.cash + profit),
    jackpot = jackpotFor(s, roll),
    rushBefore = s.rushLeft > 0;
  let rushLeft = rushBefore ? Math.max(0, s.rushLeft - 1) : 0,
    removed = rushBefore ? s.removed : s.persistentRemoved,
    persistentRemoved = s.persistentRemoved,
    chain = rushBefore ? s.chain : 0;
  if (jackpot) {
    trimAdded += s.trim;
    removed = Math.min(99, removed + trimAdded);
    rushLeft = Math.min(
      1e8,
      Math.max(rushLeft, s.settings.rushBase + s.rush * 5 + extension),
    );
    chain++;
  }
  const unfunded = rushLeft > 0 && cash < totalCost({ ...s, memory });
  if (unfunded) rushLeft = 0;
  if ((rushBefore || jackpot) && rushLeft === 0) {
    const ratio =
      ["legacy","all-test"].includes(s.catalog)
        ? Math.min(
            0.75,
            s.portfolio
              .filter((r) => betById(r.id).pattern === "trim-memory")
              .reduce((n, r) => n + 0.25 * r.count, 0),
          )
        : 0;
    persistentRemoved = Math.max(
      persistentRemoved,
      Math.floor(removed * ratio),
    );
    removed = persistentRemoved;
    chain = 0;
  }
  const maxStreak = Math.max(0, ...Object.values(memory).map((m) => m.streak));
  const infinity = rushLeft > 0 && removed === 99;
  let next: Run = finish({
    ...s,
    cash,
    fuel: s.settings.fuelEnabled
      ? Math.min(
          fuelCapacity(s),
          Math.max(0, s.fuel - (rushBefore ? 0 : 1) + fuelGained),
        )
      : s.fuel,
    memory,
    rushLeft,
    removed,
    persistentRemoved,
    chain,
    spins: s.spins + 1,
    secondBetTutorial: firstSecondSpin ? "done" : s.secondBetTutorial,
    coinChartHold: null,
    coinPendingProfit: 0, coinPendingCount: 0,
    jackpots: s.jackpots + (jackpot ? 1 : 0),
    jackpotHigh: !unfunded && s.settings.jackpotRule !== "hundred" && roll >= 91,
    spinsSinceJackpot: jackpot ? 0 : s.spinsSinceJackpot === null ? null : s.spinsSinceJackpot + 1,
    maxChain: Math.max(s.maxChain, chain),
    bestWin: Math.max(s.bestWin, profit),
    bestPayout: Math.max(s.bestPayout, payout),
    winStreak: profit > 0 ? Math.min(1e8,s.winStreak+1) : 0,
    maxStreak: Math.max(s.maxStreak, maxStreak),
    lifetimeProfit: Math.max(
      -MONEY_CEILING,
      Math.min(MONEY_CEILING, s.lifetimeProfit + profit),
    ),
    activeMs: s.activeMs + elapsed,
    startedAt: s.startedAt ?? Date.now(),
    infinityAt: s.infinityAt ?? (infinity ? Date.now() : null),
    assistUsed: s.assistUsed || (assisted && jackpot),
    debug: s.debug || customRules(s.settings, !!s.trial),
    history: appendHistory(s.history, {
      cash,
      at: s.activeMs + elapsed,
      spin: s.spins + 1,
      kind: jackpot ? "jackpot" : profit > 0 ? "win" : "loss",
      ...(s.trial?{trialMs:s.trial.elapsedMs,assets:finiteMoney(cash+(s.trial.scoring==="cash"?0:s.spent))}:{}),
      ...(s.coinPendingCount>0?{coinProfit:s.coinPendingProfit,coinCount:s.coinPendingCount}:{}),
    }),
  });
  next = {
    ...next,
    last: {
      id: next.spins,
      roll,
      baseRoll,
      rollBonus: bonus,
      profit,
      payout,
      wager,
      jackpot,
      assisted,
      infinity: infinity && !isInfinite(s),
      rushBefore,
      trimAdded,
      hits,
      activated,
      newUnlocks: availableBets(next)
        .filter((b) => unlocked(next, b) && !beforeUnlocked.includes(b.id))
        .map((b) => b.id),
      maxStreak,
      at: Date.now(),
    },
  };
  return next;
}
export function work(s: Run): Run {
  if(!trialActive(s))return s;
  if(s.settings.workMode === "gamble") return s;
  return finish({
    ...s,
    cash: finiteMoney(s.cash + 1),
    fuel: s.settings.fuelEnabled
      ? Math.min(
          fuelCapacity(s),
          s.fuel + Math.max(1, Math.ceil(fuelCapacity(s) * 0.1)),
        )
      : s.fuel,
    work: s.work + 1,
    startedAt: s.startedAt ?? Date.now(),
  });
}
export function setCount(s: Run, id: string, delta: number): Run {
  if(s.trial?.result)return s;
  const b = betById(id);
  if (!catalogIds(s).includes(id) || !unlocked(s, b)) return s;
  const old = s.portfolio.find((r) => r.id === id)?.count ?? 0;
  const max = b.legacy && s.catalog !== "all-test" ? s.owned.filter((x) => x === id).length : s.slots;
  const count = Math.max(
    0,
    Math.min(max, old + delta, s.slots - usedSlots(s) + old),
  );
  if(count===old)return s;
  const portfolio = s.portfolio.filter((r) => r.id !== id);
  if (count > 0) portfolio.push({ id, count });
  const memory = { ...s.memory };
  if (count === 0 && !b.legacy && b.pattern !== "loss-ladder")
    delete memory[id];
  return {
    ...endJackpot(s),
    portfolio,
    memory,
    running: s.trial ? s.running : portfolio.length ? s.running : false,
  };
}
export const samePositions = (a:Row[],b:Row[]) => a.length===b.length && a.every(row=>b.some(other=>other.id===row.id && other.count===row.count));
export function endJackpot(s:Run):Run {
  if(s.rushLeft===0)return s;
  const ratio=["legacy","all-test"].includes(s.catalog)?Math.min(.75,s.portfolio.filter(r=>betById(r.id).pattern==="trim-memory").reduce((n,r)=>n+.25*r.count,0)):0;
  const persistentRemoved=Math.max(s.persistentRemoved,Math.floor(s.removed*ratio));
  return {...s,rushLeft:0,chain:0,removed:persistentRemoved,persistentRemoved,jackpotHigh:false,background:null};
}
export function endUnfundedJackpot(s: Run): Run {
  return s.rushLeft > 0 && s.cash < totalCost(s) ? { ...endJackpot(s), backgroundJackpot: false } : s;
}
export type PositionIntent = {kind:"count";id:string;delta:number}|{kind:"preset";index:number}|{kind:"work-mode";mode:Settings["workMode"];dockToy?:Settings["dockToy"]};
export function applyPositionIntent(s:Run,intent:PositionIntent):Run {
  if(s.trial?.result)return s;
  if(intent.kind==="count")return setCount(s,intent.id,intent.delta);
  if(intent.kind==="preset")return loadPreset(s,intent.index);
  const next=configure(s,{workMode:intent.mode,...(intent.dockToy===undefined?{}:{dockToy:intent.dockToy})});
  return intent.dockToy===undefined?next:{...next,coinEnabled:false};
}
const nice = (v: number) =>
  v < 100
    ? Math.ceil(v)
    : Math.ceil(v / 10 ** (Math.floor(Math.log10(v)) - 1)) *
      10 ** (Math.floor(Math.log10(v)) - 1);
function originalUpgradePrice(s: Run, u: Upgrade): number | null {
  if (u === "slots") {
    if (s.slots >= 12) return null;
    if (s.settings.upgradePrices === "legacy")
      return (
        [30, 150, 1000, 8000, 60000, 400000, 2e6, 8e6, 25e6, 55e6, 90e6][
          s.slots - 1
        ] ?? null
      );
    const base = s.settings.positionPriceBase ?? 120;
    return s.settings.upgradePrices === "exponential"
      ? nice(base * (s.settings.positionPriceMultiplier ?? 10) ** (s.slots - 1))
      : nice(
          (base *
            [150, 2500, 50000, 1e6, 20e6, 75e6, 200e6, 500e6, 1e9, 2e9, 5e9][
              s.slots - 1
            ]) /
            150,
        );
  }
  if (u === "speed")
    return s.speed >= 100
      ? null
      : nice(
          (s.settings.speedPriceBase ?? 25) *
            (s.settings.speedPriceMultiplier ??
              (s.settings.economyProfile === "v20" ? 1.25 : 1.2)) **
              s.speed,
        );
  if (u === "capacity")
    return [50, 500, 5000, 50000, 500000, 5e6][s.capacity] ?? null;
  if (u === "trim") {
    const level = s.trim;
    return s.trim >= 99
      ? null
      : ([500, 5000, 50000, 500000, 5e6, 15e6, 35e6, 75e6][level] ??
          nice(150e6 * 3 ** (level - 8)));
  }
  return s.rush >= 30
    ? null
    : ([1000, 10000, 100000, 1e6, 10e6, 25e6, 50e6, 100e6][s.rush] ??
        nice(250e6 * 3 ** (s.rush - 8)));
}
function baseUpgradePrice(s: Run, u: Upgrade): number | null {
  const price = originalUpgradePrice(s, u);
  if (
    price === null ||
    s.settings.economyProfile === "v20" ||
    u === "speed" ||
    (u === "slots" && s.settings.upgradePrices !== "steep")
  )
    return price;
  // Keep each opening price and historical profiles. The current heat curve
  // makes the ninth cut purchase (8 -> 9) $10M; purchase prices are unchanged.
  const first =
    u === "slots"
      ? s.settings.positionPriceBase
      : u === "trim"
        ? 500
        : u === "rush"
          ? 1000
          : 50;
  const exponent = u === "trim" && s.settings.economyProfile === "v24" ? 0.785 : u === "trim" || u === "rush" ? 0.936 : 0.97;
  return Math.min(price, nice(first * (price / first) ** exponent));
}
export const upgradeUnlocked = (s: Run, u: Upgrade) =>
  (s.catalog !== "curated" || u !== "speed") &&
  (u !== "capacity" || s.settings.fuelEnabled) &&
  ((u !== "trim" && u !== "rush") || s.jackpots > 0);
export function upgradePrice(s: Run, u: Upgrade): number | null {
  if (s.catalog === "curated" && u === "speed") return null;
  if (u === "capacity" && !s.settings.fuelEnabled) return null;
  const p = baseUpgradePrice(s, u);
  return p === null
    ? null
    : p *
        (s.catalog === "longgame" && ["slots", "trim", "rush"].includes(u)
          ? 80
          : 1);
}
function applyUpgrade(s: Run, u: Upgrade, price: number): Run {
  const n = {
    ...s,
    cash: s.cash - price,
    spent: finiteMoney(s.spent + price),
    [u]: s[u] + 1,
    history: appendHistory(s.history, {
      cash: s.cash - price,
      at: s.activeMs,
      spin: s.spins,
      kind: "upgrade",
      spent: price,
    }),
  };
  if (u === "capacity") n.fuel = fuelCapacity(n);
  return n;
}
export function purchase(s: Run, u: Upgrade): Run {
  if(s.trial?.result)return s;
  if (s.settings.upgradeMode !== "direct" || !upgradeUnlocked(s, u)) return s;
  const price = upgradePrice(s, u);
  if (price === null || s.cash < price) return s;
  return applyUpgrade(s, u, price);
}
export const upgradeDrawPool = (s: Run): Upgrade[] =>
  UPGRADES.filter(
    (u) => upgradeUnlocked(s, u) && baseUpgradePrice(s, u) !== null,
  );
export const upgradeDrawPrice = (s: Run): number | null => {
  if (!upgradeDrawPool(s).length) return null;
  const price = nice(
    25 * (s.settings.economyProfile === "v20" ? 1.18 : 1.17) ** s.upgradeDraws,
  );
  return Number.isFinite(price) && price <= MONEY_CEILING ? price : null;
};
export function drawUpgrade(s: Run, rng?: () => number): Run {
  if(s.trial?.result)return s;
  if (s.settings.upgradeMode !== "gacha") return s;
  const price = upgradeDrawPrice(s);
  if (price === null || s.cash < price) return s;
  const pool = upgradeDrawPool(s);
  const index = rng
    ? Math.floor(rng() * pool.length)
    : sample(0, pool.length - 1);
  if (!Number.isInteger(index) || index < 0 || index >= pool.length) return s;
  const upgrade = pool[index],
    n = applyUpgrade(s, upgrade, price);
  return {
    ...n,
    upgradeDraws: s.upgradeDraws + 1,
    lastUpgradeDraw: { upgrade, level: n[upgrade], price },
    debug: true,
  };
}
export function purchaseMax(s: Run, u: Upgrade): Run {
  let n = s;
  for (let i = 0; i < 100; i++) {
    const next = purchase(n, u);
    if (next === n) break;
    n = next;
  }
  return n;
}
export const workCosmeticPrice = (s: Run) => s.workFxLevel >= 4 ? null : [100,1000,10000,100000][s.workFxLevel];
export function purchaseWorkCosmetic(s: Run):Run {
  if(s.trial?.result)return s;
 const price=workCosmeticPrice(s); if(!s.settings.workCosmetics || price===null || s.cash<price) return s;
 return {...s, workFxLevel:s.workFxLevel+1, cash:s.cash-price, spent:finiteMoney(s.spent+price),debug:true, history:appendHistory(s.history,{cash:s.cash-price,at:s.activeMs,spin:s.spins,kind:"upgrade",spent:price})};
}
export function probabilityCap(b: Bet): number {
  if (["work-income","roll-shift","rising","low-streak-crash"].includes(b.pattern)) return 0;
  if (["odd","even","fuel-return"].includes(b.pattern)) return 50;
  if (b.pattern==="rare-crash") return 1;
  if (b.pattern==="compare") return 99;
  if (b.pattern==="reversal") return 79;
  if (b.pattern==="step" || b.pattern==="support") return b.second ? 100-(b.second[1]-b.second[0]+1) : 0;
  if (b.pattern==="islands") return 100-Array.from({length:100},(_,i)=>i+1).filter(face=>b.ranges?.some(r=>inRange(face,r))).length;
  if (["threshold","range","barbell"].includes(b.pattern)) return 100-b.width;
  return b.start-1;
}
export function probabilityPrice(s: Run, id: string): number | null {
  if (!catalogIds(s).includes(id)) return null;
  const b=betById(id),level=s.betLevels[id]??0;
  if (!unlocked(s,b) || level>=probabilityCap(b)) return null;
  const price=nice(Math.max(25,b.stake*4)*1.25**level);
  return Number.isFinite(price) && price<=MONEY_CEILING ? price : null;
}
export function purchaseProbability(s: Run, id: string): Run {
  if(s.trial?.result)return s;
  if (!s.settings.probabilityUpgrades) return s;
  const price=probabilityPrice(s,id);
  if(price===null || s.cash<price) return s;
  const cash=s.cash-price;
  return {...s,cash,spent:finiteMoney(s.spent+price),betLevels:{...s.betLevels,[id]:(s.betLevels[id]??0)+1},debug:true,
    history:appendHistory(s.history,{cash,at:s.activeMs,spin:s.spins,kind:"upgrade",spent:price})};
}
export const COIN_STAKES = Array.from({length:14},(_,i)=>10**(i+1));
export const COIN_UNLOCK_PEAK = 10_000;
export const coinUnlocked = (s: Run) => s.settings.coinFlip && s.peak > COIN_UNLOCK_PEAK;
export const needsCoinUnlockNotice = (s: Run) => coinUnlocked(s) && !s.coinUnlockAnnounced;
export const acknowledgeCoinUnlock = (s: Run): Run => needsCoinUnlockNotice(s) ? {...s,coinUnlockAnnounced:true} : s;
export function playCoinFlip(s: Run, wager: number, forced?: boolean, deferFinish=false): Run {
  if(!trialActive(s))return s;
  if(!coinUnlocked(s) || !s.coinEnabled || !COIN_STAKES.includes(wager) || wager>s.cash || s.coinRounds>=1e8 || (forced!==undefined && typeof forced!=="boolean")) return s;
  const won=forced??sample(0,1)===1, payout=won?wager*2:0, profit=payout-wager;
  const next={...s,cash:finiteMoney(s.cash+profit),coinRounds:s.coinRounds+1,coinWins:s.coinWins+Number(won),
    coinWagered:finiteMoney(s.coinWagered+wager),coinPaid:finiteMoney(s.coinPaid+payout),
    coinResult:{id:s.coinRounds+1,won,wager,payout,profit},coinChartHold:s.coinChartHold??s.history,
    coinPendingProfit:Math.max(-MONEY_CEILING,Math.min(MONEY_CEILING,s.coinPendingProfit+(finiteMoney(s.cash+profit)-s.cash))),coinPendingCount:s.coinPendingCount+1,
    startedAt:s.startedAt??Date.now()};
  return deferFinish?next:finish(next);
}
export function playBaccarat(s: Run, wager: number, side: "player" | "banker", totals?: [number,number]): Run {
  if(!trialActive(s))return s;
  if (!s.settings.baccarat || s.rushLeft>0 || !Number.isSafeInteger(wager) || wager<10 || wager%10!==0 || wager>s.cash || !["player","banker"].includes(side)) return s;
  const [player,banker]=totals??[sample(0,9),sample(0,9)];
  if(![player,banker].every(v=>Number.isInteger(v)&&v>=0&&v<=9)) return s;
  const profit=player===banker?0:((side==="player"?player>banker:banker>player)?wager:-wager),cash=finiteMoney(s.cash+profit);
  return finish({...s,cash,debug:true,baccaratRounds:s.baccaratRounds+1,baccaratResult:{player,banker,side,wager,profit},startedAt:s.startedAt??Date.now(),
    history:appendHistory(s.history,{cash,at:s.activeMs,spin:s.spins,kind:"baccarat"})});
}
export function configure(s: Run, patch: Partial<Settings>): Run {
  if (patch.spinAssistSequence !== undefined && !/^[WL]{5}$/.test(patch.spinAssistSequence)) return s;
  if (s.trial && patch.secondBetAssist !== undefined) patch = {...patch,secondBetAssist:false};
  if (s.trial && patch.spinAssist !== undefined) patch = {...patch,spinAssist:false};
  if(s.trial && patch.assist!==undefined)patch={...patch,assist:false};
  if(patch.workMode === "gamble" || (s.settings.workMode === "gamble" && patch.fuelEnabled)) patch={...patch,fuelEnabled:false};
  if (patch.assistAfter !== undefined)
    patch = {
      ...patch,
      assistAfter: Math.max(
        1,
        Math.min(10000, Math.round(patch.assistAfter) || 1),
      ),
    };
  if(patch.workMode === "click" && s.settings.workMode === "gamble" && s.catalog !== "all-test") {
    const portfolio=s.portfolio.filter(r=>r.id!=="work-income"),memory={...s.memory};delete memory["work-income"];
    s={...(samePositions(s.portfolio,portfolio)?s:endJackpot(s)),portfolio,memory,presets:s.presets.map(rows=>rows.filter(r=>r.id!=="work-income")),running:s.trial?s.running:portfolio.length?s.running:false};
  }
  if(patch.workMode === "gamble" || patch.handToys === false)patch={...patch,dockToy:"off"};
  const keys = Object.keys(patch);
  const rules = keys.some(
    (k) =>
      [
        "jackpotRule",
        "handToys",
        "baccarat",
        "probabilityUpgrades",
        "workMode",
        "workCosmetics",
        "spinAssist",
        "secondBetAssist",
        "spinAssistSequence",
        "fuelEnabled",
        "opening",
        "assist",
        "assistAfter",
        "spinSpeedScale",
        "jackpotSpinIntervalMs",
        "rushBase",
        "upgradePrices",
        "economyProfile",
        "upgradeMode",
        "positionPriceBase",
        "positionPriceMultiplier",
        "speedPriceBase",
        "speedPriceMultiplier",
      ].includes(k) &&
      s.settings[k as keyof Settings] !== patch[k as keyof Settings],
  );
  return {
    ...s,
    settings: { ...s.settings, ...patch },
    background: patch.backgroundPlay === false ? null : s.background,
    coinEnabled: patch.coinFlip === false ? false : s.coinEnabled,
    jackpotHigh: patch.jackpotRule !== undefined && patch.jackpotRule !== s.settings.jackpotRule ? false : s.jackpotHigh,
    debug: s.debug || rules,
  };
}
export function switchCatalog(
  s: Run,
  catalog: CatalogId,
  restart = false,
): Run {
  if(s.trial)return s;
  const fresh = freshRun(catalog, s.settings);
  if (restart) return { ...fresh, telemetry: s.telemetry, debug: true };
  const ids = catalogIds(fresh),
    portfolio = s.portfolio.filter(
      (r) =>
        ids.includes(r.id) && (catalog === "all-test" || !betById(r.id).legacy || s.owned.includes(r.id)),
    );
  return {
    ...s,
    id: fresh.id,
    background: null,
    jackpotHigh: false,
    catalog,
    portfolio,
    running: false,
    offers: [],
    rushLeft: 0,
    removed: 0,
    persistentRemoved: 0,
    chain: 0,
    memory: {},
    debug: true,
    submitted: false,
    last: null,
  };
}
export const draftPrice = (s: Run) => nice(25 * 1.6 ** s.draws);
export function buyDraft(s: Run, rng = Math.random): Run {
  if (s.catalog !== "legacy" || s.offers.length || s.cash < draftPrice(s))
    return s;
  const pool = [...LEGACY_BETS],
    offers: string[] = [];
  const weights: Record<string, number> = {
    common: 60,
    rare: 28,
    epic: 10,
    legendary: 2,
  };
  for (let i = 0; i < 3; i++) {
    let cursor =
        rng() *
        pool.reduce((n, b) => n + (weights[b.rarity ?? "common"] ?? 1), 0),
      idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      cursor -= weights[pool[j].rarity ?? "common"] ?? 1;
      if (cursor <= 0) {
        idx = j;
        break;
      }
    }
    offers.push(pool.splice(idx, 1)[0].id);
  }
  return { ...s, cash: s.cash - draftPrice(s), draws: s.draws + 1, offers };
}
export function chooseDraft(s: Run, id: string): Run {
  return s.offers.includes(id)
    ? { ...s, owned: [...s.owned, id], offers: [] }
    : s;
}
export function savePreset(s: Run, index: number): Run {
  return {
    ...s,
    presets: s.presets.map((p, i) =>
      i === index ? s.portfolio.map((r) => ({ ...r })) : p,
    ),
  };
}
export function loadPreset(s: Run, index: number): Run {
  const rows = s.presets[index] ?? [];
  if (rows.reduce((n, r) => n + r.count, 0) > s.slots) return s;
  if (
    rows.some(
      (r) =>
        !catalogIds(s).includes(r.id) ||
        !unlocked(s, betById(r.id)) ||
        (s.catalog !== "all-test" && betById(r.id).legacy &&
          r.count > s.owned.filter((id) => id === r.id).length),
    )
  )
    return s;
  if(samePositions(s.portfolio,rows))return s;
  const memory = { ...s.memory };
  for (const id of Object.keys(memory))
    if (
      !rows.some((r) => r.id === id) &&
      !betById(id).legacy &&
      betById(id).pattern !== "loss-ladder"
    )
      delete memory[id];
  return {
    ...endJackpot(s),
    portfolio: rows.map((r) => ({ ...r })),
    memory,
    running: s.trial ? s.running : rows.length ? s.running : false,
  };
}
export function readSave(raw: string | null): Run | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (
      !v ||
      v.version !== 1 ||
      typeof v.id !== "string" ||
      !CATALOGS.some((c) => c.id === v.catalog) ||
      !Array.isArray(v.portfolio)
    )
      return null;
    const n = {
      ...freshRun(v.catalog),
      ...v,
      settings: {
        ...defaultSettings,
        ...((v.economyRevision ?? 0) < 5
          ? {
              fuelEnabled: true,
              assist: false,
              assistAfter: 80,
              jackpotSpinIntervalMs: 100,
            }
          : {}),
        ...v.settings,
      },
      economyRevision: ECONOMY_REVISION,
      running: false,
      last: null,
    } as Run;
    if (n.settings.secondBetAssistRevision !== 1 || typeof n.settings.secondBetAssist !== "boolean" || typeof n.settings.spinAssist !== "boolean" || typeof n.settings.spinAssistSequence !== "string" || !/^[WL]{5}$/.test(n.settings.spinAssistSequence)) return null;
    // Adopt the new standard once for ordinary saves; retain LAB choices and
    // never rewind whether this bet's first spin has already been consumed.
    if (v.settings?.secondBetAssistRevision === undefined && !n.debug && !n.trial)
      n.settings.secondBetAssist = true;
    if (v.secondBetTutorial === undefined) {
      const second = introductoryBets(n)?.second;
      n.secondBetTutorial = !second || n.peak >= second.unlock ? "done" : "waiting";
    }
    if (!["waiting", "active", "done"].includes(n.secondBetTutorial)) return null;
    n.secondBetTutorial = activatePositionTutorial(n).secondBetTutorial;
    if (["bit-quest", "pixelland", "cipher", "envision"].includes(n.settings.musicPack)) {
      n.settings.musicPack = "pulse";
      n.settings.music = false;
      n.settings.jackpotMusic = "follow";
    }
    if((v.economyRevision??0)<13){
      if(Number.isInteger(n.trim) && n.trim>=1)n.trim-=1;
      if(n.lastUpgradeDraw?.upgrade==="trim")n.lastUpgradeDraw={...n.lastUpgradeDraw,level:Math.max(0,n.lastUpgradeDraw.level-1)};
    }
    if (v.settings?.cashPresentationRevision !== 1) {
      n.settings.cashPresentationRevision = 1;
      n.settings.cashMotion = "burst";
      if (v.settings?.banknoteStyle === "terminal") n.settings.banknoteStyle = "random";
    }
    if (!isBanknoteStyle(n.settings.banknoteStyle)) n.settings.banknoteStyle = "random";
    if (!["rain", "burst"].includes(n.settings.cashMotion)) n.settings.cashMotion = "burst";
    if(typeof n.settings.coinFlip!=="boolean" || typeof n.settings.handToys!=="boolean" || !["off","tap","beat","charge"].includes(n.settings.dockToy))return null;
    if(!n.settings.handToys || n.settings.workMode==="gamble")n.settings.dockToy="off";
    if(v.settings?.backgroundRevision!==2){n.settings.backgroundRevision=2;n.settings.backgroundPlay=false;n.background=null;}
    if(typeof n.backgroundJackpot!=="boolean")n.backgroundJackpot=false;
    if(typeof n.settings.bigChangeNotifications!=="boolean")n.settings.bigChangeNotifications=false;
    if([n.settings.jackpotNotifications,n.settings.sweepSound,n.settings.coinChartMarkers,n.settings.streakEffects].some(v=>typeof v!=="boolean") || !Number.isFinite(n.settings.effectIntensity) || n.settings.effectIntensity<.25 || n.settings.effectIntensity>2)return null;
    if(n.settings.handToys)n.debug=true;
    if(typeof n.settings.backgroundPlay!=="boolean" || !Number.isFinite(n.backgroundMs) || n.backgroundMs<0 || n.backgroundMs>n.activeMs) return null;
    const bg=n.background;
    if(bg!==null && (!bg || !Number.isFinite(bg.at) || bg.at<0 || !Number.isFinite(bg.until) || bg.until<bg.at || bg.until-bg.at>3600000 || !Number.isFinite(bg.remainingMs) || bg.remainingMs<=0 || bg.remainingMs>100000 || !Number.isInteger(bg.spinsLeft) || bg.spinsLeft<0 || bg.spinsLeft>12000)) return null;
    if(!n.settings.backgroundPlay) n.background=null;
    if(v.bestPayout===undefined)n.bestPayout=Math.max(0,n.bestWin);
    if(v.winStreak===undefined)n.winStreak=0;
    if(!Number.isInteger(n.winStreak) || n.winStreak<0 || n.winStreak>n.spins)return null;
    if(v.settings?.spectacleRevision===undefined){
      n.settings.spectacleRevision=1;
      if(!v.settings?.winVisual || v.settings.winVisual==="classic")n.settings.winVisual="festival";
      if(!v.settings?.jackpotVisual || v.settings.jackpotVisual==="classic")n.settings.jackpotVisual="festival";
      if(!v.settings?.chartBackdrop || v.settings.chartBackdrop==="off")n.settings.chartBackdrop="pulse";
      if(!v.settings?.jackpotRule || v.settings.jackpotRule==="hundred")n.settings.jackpotRule="combined";
      if([undefined,"terminal","retro-arcade"].includes(v.settings?.soundPack))n.settings.soundPack="arcade-coinop";
    }
    if(!coinUnlocked(n))n.coinEnabled=false;
    n.coinUnlockAnnounced = v.coinUnlockAnnounced === true;
    // Old compressed history cannot reliably reconstruct the latest Jackpot.
    if (v.spinsSinceJackpot === undefined) n.spinsSinceJackpot = n.jackpots === 0 ? n.spins : null;
    // Production's compact desk is a one-time visual migration, without resetting progress.
    if (v.settings?.layoutRevision === undefined) {
      n.settings.layoutRevision=1;
      n.settings.workspaceMode="desk";
      n.settings.sharedSpin=true;
      n.settings.sharedChart=true;
      if(v.settings?.chartWindowSpins===undefined || v.settings.chartWindowSpins===300) n.settings.chartWindowSpins=200;
    }
    // Adopt the common spin surface once. Subsequent explicit LAB choices persist.
    if (v.settings?.sharedSpinRevision === undefined) n.settings.sharedSpin = true;
    if ((v.economyRevision ?? 0) < 8 && v.settings?.economyProfile === "v21")
      n.settings.economyProfile = "v22";
    if ((v.economyRevision ?? 0) < 10 && n.settings.economyProfile === "v22") n.settings.economyProfile = "v24";
    if (
      (v.economyRevision ?? 0) < 7 &&
      v.settings?.economyProfile === undefined
    ) {
      // Adopt the lighter baseline once; retain explicit custom speed curves.
      if (
        v.settings?.speedPriceMultiplier === 1.25 ||
        v.settings?.speedPriceMultiplier === undefined
      )
        n.settings.speedPriceMultiplier = 1.2;
    }
    // v1.9 kept the inherited charge setting, so old saves could still tick.
    // Apply the new baseline once; future explicit LAB choices survive reloads.
    if (v.settings?.presentationRevision === undefined) {
      n.settings.presentationRevision = 1;
      n.settings.chargeSound = "off";
      if (v.settings?.lossVolume === 0.3) n.settings.lossVolume = 0.9;
      if (v.settings?.shake === "light") n.settings.shake = "strong";
      if (v.settings?.impactFlash === "soft") n.settings.impactFlash = "bright";
    }
    // Adopt the previous baseline once; later LAB comparisons remain explicit.
    if(v.settings?.rhythmRevision===undefined){
      n.settings.rhythmRevision=1;
      if(v.settings?.payoffStyle===undefined || v.settings.payoffStyle==="net")n.settings.payoffStyle="classic";
      if(v.settings?.newsPosition===undefined || v.settings.newsPosition==="bottom")n.settings.newsPosition="top";
      if((v.settings?.revealPacing===undefined || v.settings.revealPacing==="adaptive") && (v.settings?.revealDurationMs===undefined || v.settings.revealDurationMs===700))n.settings.revealPacing="ratio";
    }
    // Older saves kept fixed duration or another ratio even after the common
    // sound-pack baseline changed. Apply it once, including imported saves;
    // subsequent explicit LAB choices remain intact.
    if(v.settings?.spinRevealRevision===undefined)Object.assign(n.settings,SPIN_REVEAL_DEFAULTS);
    if (n.completion !== null) {
      const c = n.completion;
      if (
        !c ||
        typeof c.id !== "string" ||
        c.id.length > 100 ||
        typeof c.appVersion !== "string" ||
        !/^\d+\.\d+\.\d+$/.test(c.appVersion) ||
        typeof c.rulesetVersion !== "string" ||
        !/^astra-v\d+:/.test(c.rulesetVersion) ||
        !CATALOGS.some((catalog) => catalog.id === c.catalog) ||
        !Number.isSafeInteger(c.timeMs) ||
        c.timeMs < 1000 ||
        !Number.isInteger(c.spins) ||
        c.spins < 0 ||
        typeof c.ranked !== "boolean"
      )
        n.completion = null;
      else if (c.timeMs > 14 * 86400000 || c.spins > 1e8)
        n.completion = { ...c, ranked: false };
    }
    if (
      v.settings?.music === undefined &&
      (v.settings?.sound === false || v.settings?.soundVolume === 0)
    )
      n.settings.music = false;
    if (
      v.economyRevision !== ECONOMY_REVISION &&
      (n.spins > 0 || n.work > 0 || n.startedAt !== null)
    ) {
      n.debug = true;
      n.id = crypto.randomUUID();
    }
    for (const k of [
      "cash",
      "peak",
      "fuel",
      "activeMs",
      "spins",
      "work",
      "jackpots",
      "maxChain",
      "bestWin",
      "bestPayout",
      "winStreak",
      "maxStreak",
      "spent",
      "draws",
      "upgradeDraws",
      "rushLeft",
      "removed",
      "persistentRemoved",
      "chain",
      "slots",
      "speed",
      "capacity",
      "trim",
      "rush",
    ] as const)
      if (!Number.isFinite(n[k]) || n[k] < 0) return null;
    for (const k of [
      "spins",
      "work",
      "jackpots",
      "maxChain",
      "maxStreak",
      "draws",
      "upgradeDraws",
      "rushLeft",
      "removed",
      "persistentRemoved",
      "chain",
      "slots",
      "speed",
      "capacity",
      "trim",
      "rush",
    ] as const)
      if (!Number.isInteger(n[k])) return null;
    if (
      n.removed > 99 ||
      n.persistentRemoved > 99 ||
      n.speed > 100 ||
      n.slots < 1 ||
      n.slots > 12 ||
      n.capacity > 6 ||
      n.trim > 99 ||
      n.rush > 30 ||
      n.cash > MONEY_CEILING ||
      n.peak > MONEY_CEILING ||
      !Number.isFinite(n.lifetimeProfit)
    )
      return null;
    if (
      ![10, 20].includes(n.settings.opening) ||
      ![0.1, 0.5, 1, 2].includes(n.settings.spinSpeedScale) ||
      typeof n.settings.captureMode !== "boolean" ||
      typeof n.settings.fuelEnabled !== "boolean" ||
      !["top", "bottom"].includes(n.settings.newsPosition) ||
      !JACKPOT_INTERVALS.includes(n.settings.jackpotSpinIntervalMs) ||
      !["spins", "time"].includes(n.settings.chartAxis) ||
      !SWEEP_MOTIONS.includes(n.settings.sweepMotion) ||
      n.settings.presentationRevision !== 1 ||
      !["rhythm", "original"].includes(n.settings.spinSound) ||
      typeof n.settings.music !== "boolean" ||
      !["follow", "on", "off"].includes(n.settings.jackpotMusic) ||
      typeof n.settings.bassMode !== "boolean" ||
      typeof n.settings.jackpotAutoTab !== "boolean" ||
      !["pulse", "night", "arcade"].includes(n.settings.musicPack) ||
      !Number.isFinite(n.settings.musicVolume) ||
      n.settings.musicVolume < 0 ||
      n.settings.musicVolume > 1 ||
      ![
        "terminal",
        "retro-arcade",
        "soft",
        "crystal",
        "arcade",
        "wood",
        "impact",
        "arcade-coinop", "arcade-pinball", "arcade-synth", "arcade-punch",
      ].includes(n.settings.soundPack) ||
      !Number.isInteger(n.settings.chartWindowSpins) ||
      n.settings.chartWindowSpins < 1 ||
      n.settings.chartWindowSpins > MAX_CHART_SPINS ||
      !["off", "ticks", "rise"].includes(n.settings.chargeSound) ||
      !["classic", "chart", "net"].includes(n.settings.payoffStyle) ||
      !Number.isFinite(n.settings.chargeVolume) ||
      n.settings.chargeVolume < 0 ||
      n.settings.chargeVolume > 1 ||
      !["all", "balanced", "highlights"].includes(n.settings.soundDensity) ||
      !["off", "light", "strong"].includes(n.settings.shake) ||
      !["off", "soft", "bright"].includes(n.settings.impactFlash) ||
      ![120, 260, 420, 700, 1200, 2000, 3500, 5000].includes(n.settings.revealDurationMs) ||
      !["ratio", "adaptive", "full"].includes(n.settings.revealPacing) ||
      n.settings.rhythmRevision !== 1 || n.settings.spinRevealRevision !== 1 || !Number.isFinite(n.settings.revealRatio) || n.settings.revealRatio<0.1 || n.settings.revealRatio>2 ||
      !Number.isFinite(n.settings.soundVolume) ||
      n.settings.soundVolume < 0 ||
      n.settings.soundVolume > 1 ||
      !Number.isFinite(n.settings.lossVolume) ||
      n.settings.lossVolume < 0 ||
      n.settings.lossVolume > 1 ||
      !["payoff", "number"].includes(n.settings.reelStyle) ||
      ![20, 25, 50, 75, 100].includes(n.settings.rushBase) ||
      !["steep", "exponential", "legacy"].includes(n.settings.upgradePrices) ||
      !["v24", "v22", "v20"].includes(n.settings.economyProfile) ||
      !Number.isInteger(n.settings.positionPriceBase) ||
      n.settings.positionPriceBase < 1 ||
      n.settings.positionPriceBase > 1e9 ||
      !Number.isFinite(n.settings.positionPriceMultiplier) ||
      n.settings.positionPriceMultiplier < 1 ||
      n.settings.positionPriceMultiplier > 30 ||
      !Number.isInteger(n.settings.speedPriceBase) ||
      n.settings.speedPriceBase < 1 ||
      n.settings.speedPriceBase > 1e6 ||
      !Number.isFinite(n.settings.speedPriceMultiplier) ||
      n.settings.speedPriceMultiplier < 1.01 ||
      n.settings.speedPriceMultiplier > 2 ||
      !["direct", "gacha"].includes(n.settings.upgradeMode) ||
      !["cinematic", "clean", "arcade"].includes(n.settings.fx) ||
      !["full", "reduced"].includes(n.settings.motion) ||
      !["ja", "en"].includes(n.settings.language) ||
      !Number.isInteger(n.settings.assistAfter) ||
      n.settings.assistAfter < 1 ||
      n.settings.assistAfter > 10000
    )
      return null;
    if(!["click","gamble"].includes(n.settings.workMode) || !["fixed","tiers","drawdown"].includes(n.settings.wealthTheme) || !["money","scripted"].includes(n.settings.upgradeTutorial) || ![n.settings.sharedSpin,n.settings.adaptiveMusic,n.settings.workCosmetics].every(x=>typeof x==="boolean") || !Number.isInteger(n.workFxLevel) || n.workFxLevel<0 || n.workFxLevel>4) return null;
    if(!["hundred","double-high","combined"].includes(n.settings.jackpotRule) || typeof n.settings.showJackpotCounter!=="boolean" || typeof n.jackpotHigh!=="boolean" || (n.spinsSinceJackpot!==null && (!Number.isSafeInteger(n.spinsSinceJackpot) || n.spinsSinceJackpot<0 || n.spinsSinceJackpot>n.spins))) return null;
    if(n.settings.jackpotRule!=="combined") n.debug=true;
    if(n.settings.layoutRevision!==1 || !["desk","tabs"].includes(n.settings.workspaceMode) || !["percent","fraction"].includes(n.settings.oddsDisplay) || ![n.settings.balanceChangeInline,n.settings.sharedChart,n.settings.probabilityUpgrades,n.settings.baccarat,n.commonRollExplained].every(v=>typeof v==="boolean")) return null;
    if(!["classic","cash","gold","neon","confetti","mix","festival"].includes(n.settings.winVisual) || !["classic","cash","gold","neon","confetti","mix","festival"].includes(n.settings.jackpotVisual) || !["off","aurora","flow","pulse"].includes(n.settings.chartBackdrop)) return null;
    if(typeof n.coinEnabled!=="boolean" || !COIN_STAKES.includes(n.coinStake) || ![n.coinRounds,n.coinWins].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1e8) || n.coinWins>n.coinRounds || ![n.coinWagered,n.coinPaid].every(x=>Number.isFinite(x)&&x>=0&&x<=MONEY_CEILING)) return null;
    if(!Number.isSafeInteger(n.coinPendingCount) || n.coinPendingCount<0 || n.coinPendingCount>n.coinRounds || !Number.isFinite(n.coinPendingProfit) || Math.abs(n.coinPendingProfit)>MONEY_CEILING || (n.coinPendingCount===0 && n.coinPendingProfit!==0)) return null;
    if(n.coinResult !== null && (n.coinResult.id!==n.coinRounds || typeof n.coinResult.won!=="boolean" || !COIN_STAKES.includes(n.coinResult.wager) || n.coinResult.payout!==(n.coinResult.won?n.coinResult.wager*2:0) || n.coinResult.profit!==n.coinResult.payout-n.coinResult.wager)) return null;
    if(n.coinChartHold !== null && (!Array.isArray(n.coinChartHold) || n.coinChartHold.length>12000 || n.coinChartHold.some(p=>!p || ![p.cash,p.at,p.spin??0,p.spent??0].every(x=>typeof x==="number"&&Number.isFinite(x)&&x>=0)))) return null;
    if(!n.betLevels || typeof n.betLevels!=="object" || Array.isArray(n.betLevels) || Object.entries(n.betLevels).some(([id,level])=>!ALL_BETS.some(b=>b.id===id) || !Number.isInteger(level) || typeof level!=="number" || level<0 || level>probabilityCap(betById(id)))) return null;
    if(!Number.isSafeInteger(n.baccaratRounds) || n.baccaratRounds<0 || n.baccaratRounds>1e8) return null;
    const br=n.baccaratResult;
    if(br && (![br.player,br.banker].every(v=>Number.isInteger(v)&&v>=0&&v<=9) || !["player","banker"].includes(br.side) || !Number.isSafeInteger(br.wager) || br.wager<10 || br.wager%10!==0 || ![0,br.wager,-br.wager].includes(br.profit))) return null;
    if(n.baccaratRounds>0 || Object.values(n.betLevels).some(v=>v>0) || n.settings.baccarat || n.settings.probabilityUpgrades) n.debug=true;
    if(n.settings.sharedSpinRevision !== 1 || !["compact","expanded"].includes(n.settings.spinSize) || !["arrow","bull"].includes(n.settings.brandIcon)) return null;
    n.completionNickname = typeof n.completionNickname === "string" ? n.completionNickname.replace(/[\x00-\x1f\x7f]/g,"").trim().slice(0,16) : "";
    n.settings.rollDisplay="number";
    const record=n.clearSnapshot;
    if(record) for(const key of ["work","coinWagered","coinPaid"] as const) if(record[key]!==undefined && (!Number.isFinite(record[key]) || record[key]!<0)) delete record[key];
    if(record && (![record.cash,record.spent,record.maxChain].every(x=>typeof x==="number"&&Number.isFinite(x)&&x>=0) || !Array.isArray(record.history) || record.history.length<1 || record.history.length>150 || record.history.some(p=>!p || ![p.cash,p.at,p.spin??0,p.spent??0].every(x=>typeof x==="number"&&Number.isFinite(x)&&x>=0) || typeof p.kind!=="string"))) n.clearSnapshot=null;
    if(n.settings.workMode === "gamble") n.settings.fuelEnabled=false;
    if(n.catalog === "all-test") n.debug=true;
    const draw = n.lastUpgradeDraw;
    if (
      draw &&
      (!UPGRADES.includes(draw.upgrade) ||
        !Number.isInteger(draw.level) ||
        draw.level < 1 ||
        !Number.isFinite(draw.price) ||
        draw.price < 0)
    )
      n.lastUpgradeDraw = null;
    if (
      !n.memory ||
      typeof n.memory !== "object" ||
      !Array.isArray(n.owned) ||
      !Array.isArray(n.offers) ||
      !Array.isArray(n.presets) ||
      !Array.isArray(n.history)
    )
      return null;
    n.owned = n.owned
      .filter((id) => LEGACY_BETS.some((b) => b.id === id))
      .slice(0, 10000);
    n.offers = n.offers
      .filter((id) => LEGACY_BETS.some((b) => b.id === id))
      .slice(0, 3);
    // Preserve older progress when a comparison roster changes; retire only absent cards.
    if (v.economyRevision !== ECONOMY_REVISION) {
      const ids = new Set(catalogIds(n));
      n.portfolio = n.portfolio.filter((r) => ids.has(r?.id));
      n.presets = n.presets.map((rows) =>
        Array.isArray(rows) ? rows.filter((r) => ids.has(r?.id)) : [],
      );
    }
    const validRow = (r: Row) =>
      r &&
      catalogIds(n).includes(r.id) &&
      Number.isInteger(r.count) &&
      r.count > 0 &&
      r.count <= 12;
    if (
      n.portfolio.some((r) => !validRow(r)) ||
      new Set(n.portfolio.map((r) => r.id)).size !== n.portfolio.length ||
      usedSlots(n) > n.slots
    )
      return null;
    if (
      n.portfolio.some(
        (r) =>
          !unlocked(n, betById(r.id)) ||
          (n.catalog !== "all-test" && betById(r.id).legacy &&
            r.count > n.owned.filter((id) => id === r.id).length),
      )
    )
      return null;
    n.presets = Array.from({ length: 3 }, (_, i) =>
      Array.isArray(n.presets[i]) ? n.presets[i].filter(validRow) : [],
    );
    n.memory = Object.fromEntries(
      Object.entries(n.memory)
        .filter(
          ([id, m]) =>
            ALL_BETS.some((b) => b.id === id) &&
            m &&
            Number.isInteger(m.streak) &&
            m.streak >= 0 &&
            m.streak <= 1e8 &&
            Number.isInteger(m.misses) &&
            m.misses >= 0 &&
            m.misses <= 1e8 &&
            (m.previous === null ||
              (Number.isInteger(m.previous) &&
                m.previous >= 1 &&
                m.previous <= 100)),
        )
        .map(([id, m]) => [id, { ...m, armed: Boolean(m.armed) }]),
    );
    n.history = n.history.filter(
      (p) =>
        p &&
        Number.isFinite(p.cash) &&
        p.cash >= 0 &&
        Number.isFinite(p.at) &&
        p.at >= 0,
    );
    // Preserve old time-based history; only known spin coordinates belong on
    // the spin axis. A resume anchor starts that segment without guessing.
    n.history = n.history.map((p) => {
      const { spin: index, spent, ...base } = p;
      const point = {
        ...base,
        ...(p.kind === "upgrade" &&
        typeof spent === "number" &&
        Number.isFinite(spent) &&
        spent > 0 &&
        spent <= MONEY_CEILING
          ? { spent }
          : {}),
      };
      return Number.isInteger(index) && index! >= 0 && index! <= n.spins
        ? { ...point, spin: index }
        : point;
    });
    if (!n.history.some((p) => p.spin !== undefined))
      n.history = appendHistory(n.history, {
        cash: n.cash,
        at: n.activeMs,
        spin: n.spins,
        kind: "resume",
      });
    n.history = compactHistory(n.history).map(sanitizeCoinPoint);
    if(n.coinChartHold)n.coinChartHold=n.coinChartHold.map(sanitizeCoinPoint);
    if(n.clearSnapshot)n.clearSnapshot={...n.clearSnapshot,history:n.clearSnapshot.history.map(sanitizeCoinPoint)};
    if (n.entryKind !== "transfer") delete n.entryKind;
    n.fuel = Math.min(fuelCapacity(n), n.fuel);
    n.peak = Math.max(n.peak, n.cash);
    n.debug = Boolean(n.debug) || customRules(n.settings, !!n.trial);
    n.telemetry = Boolean(n.telemetry);
    for (const k of [
      "startedAt",
      "clearAt",
      "clearActiveMs",
      "clearSpins",
      "infinityAt",
    ] as const)
      if (n[k] !== null && (!Number.isFinite(n[k]) || n[k]! < 0)) return null;
    if(n.trial){
      const t=n.trial;
      if(t.scoring===undefined){t.scoring=t.result?"cash":"assets";if(!t.result && t.started)n.debug=true;}
      if(!["cash","assets"].includes(t.scoring))return null;
      if(!["fixed","shop","lottery"].includes(t.rule) || typeof t.started!=="boolean" || typeof t.paused!=="boolean" || typeof t.submitted!=="boolean" || typeof t.nickname!=="string" || Array.from(t.nickname).length>16 ||
        !Number.isFinite(t.elapsedMs) || t.elapsedMs<0 || !Number.isFinite(t.addedMs) || t.addedMs<0 || t.addedMs>86400000 || t.elapsedMs>TRIAL_MS+t.addedMs ||
        (t.anchor!==null && (!Number.isFinite(t.anchor)||t.anchor<0)) || (t.paused && t.anchor!==null) || (!t.paused && t.anchor===null) || (!t.started && !t.paused) || (!t.started && (t.elapsedMs!==0 || t.anchor!==null)) ||
        !Number.isSafeInteger(t.purchases)||t.purchases<0 || !Number.isFinite(t.spent)||t.spent<0 || t.spent>MONEY_CEILING || (t.rule==="fixed" && (t.addedMs!==0 || t.purchases!==0)))return null;
      n.settings.assist=false;
      n.settings.spinAssist=false;
      n.settings.secondBetAssist=false;
      if(t.rule!=="fixed")n.debug=true;
      if(t.result){
        const r=t.result;
        if(r.id!==n.id || !Number.isFinite(r.finalBankroll)||r.finalBankroll<0||r.finalBankroll>MONEY_CEILING || r.finalBankroll!==(r.rulesetVersion.includes("-assets:")?finiteMoney(n.cash+n.spent):n.cash) ||
          r.durationMs!==TRIAL_MS+t.addedMs || r.addedMs!==t.addedMs || r.rule!==t.rule || r.spins!==n.spins || r.catalog!==n.catalog ||
          typeof r.appVersion!=="string" || typeof r.rulesetVersion!=="string" || typeof r.ranked!=="boolean" || t.anchor!==null || !t.paused || t.elapsedMs!==r.durationMs)return null;
        n.running=false;n.background=null;
      }
      if(!n.background && !t.result){n.running=false;t.paused=true;t.anchor=null;}
      n.clearAt=null;n.completion=null;n.clearSnapshot=null;
    }
    return n;
  } catch {
    return null;
  }
}
export function migrateLegacy(raw: string | null): Run | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (
      !o ||
      ![6, 7].includes(o.version) ||
      typeof o.bankroll !== "number" ||
      !Number.isFinite(o.bankroll)
    )
      return null;
    const s = freshRun("legacy", {
        ...defaultSettings,
        fuelEnabled: true,
        assist: false,
        assistAfter: 80,
        jackpotSpinIntervalMs: 100,
      }),
      stats = o.statistics ?? {},
      memory: Run["memory"] = {};
    for (const [id, m] of Object.entries(o.contractMemory ?? {})) {
      const v = m as { streak?: number; previousRoll?: number | null };
      memory[id] = {
        streak: v.streak ?? 0,
        misses: 0,
        previous: v.previousRoll ?? null,
        armed: false,
      };
    }
    const n = {
      ...s,
      cash: Math.max(0, o.bankroll),
      peak: Math.max(o.peakBankroll ?? 0, o.bankroll),
      fuel: o.fuel ?? 5,
      slots: Math.min(12, o.slotCount ?? 1),
      speed: Math.min(100, o.spinSpeedLevel ?? 0),
      capacity: Math.min(6, o.fuelCapacityLevel ?? 0),
      portfolio: (o.portfolio ?? [])
        .filter((r: { betId: string }) =>
          ALL_BETS.some((b) => b.id === r.betId),
        )
        .map((r: { betId: string; count: number }) => ({
          id: r.betId,
          count: r.count,
        })),
      owned: o.ownedSpecialBets ?? [],
      offers: o.draftOptions ?? [],
      draws: o.drawCount ?? 0,
      memory,
      presets: (o.deckPresets ?? [[], [], []]).map(
        (p: { betId: string; count: number }[] | null) =>
          (p ?? []).map((r) => ({ id: r.betId, count: r.count })),
      ),
      spins: stats.totalSpins ?? 0,
      work: stats.moneyClicks ?? 0,
      bestWin: stats.biggestWin ?? 0,
      lifetimeProfit: stats.totalProfit ?? 0,
      spent: stats.upgradeSpend ?? 0,
      jackpots: stats.hundredRolls ?? 0,
      debug: true,
    };
    return readSave(JSON.stringify(n));
  } catch {
    return null;
  }
}
export const firstBet = (s: Run) =>
  s.settings.workMode === "gamble" ? "work-income" :
  s.catalog === "longgame" ? "long-edge-50" : BASE_BETS[0].id;

// A separate wall clock; activeMs remains the ordinary play-statistics clock.
export function freshTrial(settings:Settings=defaultSettings,rule:TrialRule="fixed"):Run {
  const normalized={...settings};
  for(const key of ["jackpotRule","handToys","coinFlip","baccarat","probabilityUpgrades","workMode","workCosmetics","upgradeTutorial","spinAssist","secondBetAssist","spinAssistSequence","fuelEnabled","opening","assist","assistAfter","spinSpeedScale","jackpotSpinIntervalMs","rushBase","upgradePrices","economyProfile","upgradeMode","positionPriceBase","positionPriceMultiplier","speedPriceBase","speedPriceMultiplier"] as const)
    Object.assign(normalized,{[key]:defaultSettings[key]});
  const run=freshRun("classic",normalized);
  return {...run,debug:rule!=="fixed",settings:{...normalized,assist:false,spinAssist:false,secondBetAssist:false,dockToy:"off"},trial:{scoring:"assets",rule,elapsedMs:0,addedMs:0,anchor:null,started:false,paused:true,result:null,nickname:"",submitted:false,purchases:0,spent:0,lastPurchase:null}};
}
export function trialDeadline(s:Run):number {
  const t=s.trial;return t && t.anchor!==null && !t.paused && !t.result?t.anchor+trialRemaining(t):Infinity;
}
export function advanceTrial(s:Run,now:number):Run {
  const t=s.trial;
  if(!t || t.result || t.paused || t.anchor===null || now<=t.anchor)return s;
  const elapsedMs=Math.min(TRIAL_MS+t.addedMs,t.elapsedMs+now-t.anchor);
  let next={...s,trial:{...t,elapsedMs,anchor:now}};
  if(elapsedMs<TRIAL_MS+t.addedMs)return next;
  const result:TrialResult={id:s.id,appVersion:VERSION,rulesetVersion:`astra-v${ECONOMY_REVISION}-30m${t.scoring==="assets"?"-assets":""}:${s.catalog}`,catalog:s.catalog,
    durationMs:TRIAL_MS+t.addedMs,finalBankroll:trialAssets(s),spins:s.spins,ranked:!s.debug && t.rule==="fixed" && t.addedMs===0 && t.purchases===0 && !s.assistUsed,
    rule:t.rule,addedMs:t.addedMs};
  return {...next,running:false,background:null,coinChartHold:null,coinPendingCount:0,coinPendingProfit:0,
    history:appendHistory(s.history,{cash:s.cash,spin:s.spins,at:s.activeMs,kind:"time-up",trialMs:elapsedMs,assets:trialAssets(s),coinProfit:s.coinPendingProfit,coinCount:s.coinPendingCount}),
    trial:{...next.trial,anchor:null,paused:true,result}};
}
export function pauseTrial(s:Run,now:number):Run {
  if(s.background)return s;
  const run=advanceTrial(s,now),t=run.trial;if(!t || t.result || t.paused)return run;
  return {...run,running:false,background:null,trial:{...t,paused:true,anchor:null}};
}
export function resumeTrial(s:Run,now:number):Run {
  const t=s.trial;if(!t || t.result || !t.paused)return s;
  return {...s,running:true,startedAt:s.startedAt??now,trial:{...t,started:true,paused:false,anchor:now}};
}
export const trialTimePrice=(cash:number)=>Math.max(100,Math.ceil(cash*.1));
export function buyTrialTime(s:Run,budget=s.cash,forced?:boolean):Run {
  const t=s.trial;if(!t || t.result || t.rule==="fixed" || t.addedMs>=86400000-120000)return s;
  const cost=trialTimePrice(budget);if(budget<cost || s.cash<cost)return s;
  const addedMs=t.rule==="shop"?60000:(forced??sample(0,1)===1)?120000:0;
  const cash=s.cash-cost;
  return {...s,cash,debug:true,trial:{...t,addedMs:t.addedMs+addedMs,purchases:t.purchases+1,spent:finiteMoney(t.spent+cost),lastPurchase:{cost,addedMs}},
    history:appendHistory(s.history,{cash,at:s.activeMs,spin:s.spins,kind:"time-purchase",spent:cost})};
}
