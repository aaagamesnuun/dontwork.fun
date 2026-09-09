import { language } from "../i18n";
import japaneseNames from "../locales/bet-names-ja.json";
import { t as _t } from "../i18n";
import legacy from "./legacy.json";
export type Pattern = "support" | "work-income" | "roll-shift" | "threshold" | "odd" | "even" | "range" | "barbell" | "rising" | "ladder" | "loss-ladder" | "step" | "drought" | "compare" | "islands" | "high-streak" | "low-streak-crash" | "rare-crash" | "reversal" | "fuel-return" | "low-fuel" | "trim" | "rush-extend" | "rush-dividend" | "trim-memory";
export interface Bet {
    id: string;
    name: string;
    ja: string;
    description: string;
    stake: number;
    payout: number;
    pattern: Pattern;
    start: number;
    width: number;
    unlock: number;
    tier: number;
    multiplier?: number;
    increment?: number;
    first?: [
        number,
        number
    ];
    second?: [
        number,
        number
    ];
    direction?: "up" | "down" | "absolute";
    delta?: number;
    ranges?: [
        number,
        number
    ][];
    target?: number;
    penalty?: number;
    effect?: number;
    rarity?: string;
    legacy?: boolean;
}
export type CatalogId = "all-test" | "billion" | "classic" | "curated" | "streaks" | "streak80" | "crashes" | "reversals" | "dryspell" | "spectrum" | "rush" | "longgame" | "legacy";
export interface Catalog {
    id: CatalogId;
    name: string;
    en: string;
    description: string;
    color: string;
    ids: string[];
}
export const BASE_BETS: Bet[] = [
    [50, 10, 30, 0, "BASELINE", "五分五分"],
    [25, 100, 650, 200, "QUARTER EDGE", "四分の一"],
    [10, 1000, 18000, 2000, "DECILE BET", "十分の一"],
    [5, 10000, 400000, 20000, "FIVE PERCENT RULE", "五パーセント"],
    [4, 100000, 5500000, 200000, "FOUR SIGMA FUND", "四シグマ"],
    [3, 1000000, 80000000, 2000000, "THREE PERCENT CLUB", "三パーセント"],
    [2, 10000000, 1400000000, 20000000, "TWO PERCENT SOLUTION", "二パーセント"],
].map((r, i) => ({
    id: "edge-" + r[0],
    name: String(r[4]),
    ja: String(r[5]),
    description: "高い数字で当たる、基本のギャンブル。",
    stake: Number(r[1]),
    payout: Number(r[2]),
    unlock: Number(r[3]),
    pattern: "threshold",
    start: 101 - Number(r[0]),
    width: Number(r[0]),
    tier: i + 1,
}));
function bet(id: string, name: string, ja: string, stake: number, payout: number, unlock: number, pattern: Pattern, extra: Partial<Bet> = {}): Bet {
    return {
        id,
        name,
        ja,
        stake,
        payout,
        unlock,
        pattern,
        start: 51,
        width: 50,
        tier: Math.max(1, Math.floor(Math.log10(stake))),
        description: "",
        ...extra,
    };
}
export const NEW_BETS: Bet[] = [
    ...[10, 100, 1000, 100000].map((stake, i) => bet("streak-" + (i + 1), ["HOT HAND", "BULL RUN", "COMPOUND FEVER", "MELT UP"][i], "50%の連勝", stake, stake * 0.5, [40, 1000, 20000, 1000000][i], "ladder", {
        multiplier: 1.8,
        description: "継続率50%。当たるたび次の配当×1.8。短い連勝は赤字、長い連勝で一撃。外れると倍率リセット。",
    })),
    ...[20, 200, 2000, 100000].map((stake, i) => bet("flow-" + (i + 1), ["EIGHTY CLUB", "TAILWIND", "LONG RIDE", "REDLINE"][i], "80%の連勝", stake, stake * 0.3, [80, 2000, 40000, 1000000][i], "ladder", {
        start: 21,
        width: 80,
        multiplier: 1.2,
        description: "継続率80%。当たるたび次の配当×1.2。8連勝目から1回の収支がプラスに。外れると倍率リセット。",
    })),
    ...[100, 10000].map((stake, i) => bet("risk-" + (i + 1), ["THIN ICE", "FAULT LINE"][i], "連敗で傷が深まる", stake, stake * 2, [2000, 200000][i], "loss-ladder", {
        start: 21,
        width: 80,
        multiplier: 2,
        target: 5,
        description: "80%で固定配当。外すと次の賭け金×2、最大32倍。当たると元に戻る。外しても連敗は持ち越す。",
    })),
    bet("step-1", "DIP & RIP", "押し目反発", 20, 850, 100, "step", {
        first: [1, 20],
        second: [81, 100],
        description: "20以下の次に81以上。予告から、反発の一撃。",
    }),
    bet("step-2", "BREAKOUT", "高値更新", 200, 7200, 2000, "step", {
        first: [51, 100],
        second: [91, 100],
        description: "51以上の次に91以上。高値の、その先へ。",
    }),
    bet("step-3", "WHIPLASH", "往復相場", 2000, 350000, 20000, "step", {
        first: [91, 100],
        second: [1, 10],
        description: "91以上の次に10以下。急落こそが当たり。",
    }),
    bet("step-4", "MOONSHOT", "十から一", 50000, 100000000, 2000000, "step", {
        first: [91, 100],
        second: [100, 100],
        description: "91以上の次に100で$100M。通常時は約0.1%。",
    }),
    bet("drought-1", "RAIN CHECK", "ため息配当", 10, 30, 80, "drought", {
        start: 76,
        width: 25,
        increment: 10,
        description: "外れるたび次の配当+$10。76以上で受け取る。",
    }),
    bet("drought-2", "PRESSURE FUND", "損して育つ", 100, 800, 600, "drought", {
        start: 91,
        width: 10,
        increment: 100,
        description: "外れるたび次の配当+$100。91以上で解放。",
    }),
    bet("drought-3", "VOLCANO", "噴火待ち", 1000, 10000, 10000, "drought", {
        start: 96,
        width: 5,
        increment: 1500,
        description: "外れるほど圧力が上がる。96以上で噴き出す。",
    }),
    bet("drought-4", "LONG GAME", "最後に笑う", 100000, 2000000, 1000000, "drought", {
        start: 100,
        width: 1,
        increment: 200000,
        description: "外れるたび配当+$200K。100で全部受け取る。",
    }),
    bet("shape-1", "PINSTRIPE", "縞模様", 10, 31, 60, "odd", {
        description: "奇数で当たり。高い数字だけが正解ではない。",
    }),
    bet("shape-2", "BARBELL", "両端狙い", 100, 850, 1200, "barbell", {
        width: 20,
        description: "1〜10、91〜100。真ん中を捨てる。",
    }),
    bet("shape-3", "MIDDLE MONEY", "真ん中取り", 1000, 8500, 12000, "range", {
        start: 40,
        width: 21,
        description: "40〜60が当たり。出目カットが進むと形も変わる。",
    }),
    bet("shape-4", "ARCHIPELAGO", "三つの島", 10000, 65000, 150000, "islands", {
        ranges: [
            [11, 20],
            [46, 55],
            [91, 100],
        ],
        description: "11〜20、46〜55、91〜100の三つの当たり。",
    }),
    bet("momentum-1", "UP TICK", "前より上", 10, 32, 120, "compare", {
        direction: "up",
        delta: 1,
        description: "前回の数字より大きければ当たり。",
    }),
    bet("momentum-2", "HIGHER HIGH", "一段飛ばし", 100, 620, 800, "compare", {
        direction: "up",
        delta: 25,
        description: "前回より25以上、大きな数字を引く。",
    }),
    bet("momentum-3", "FALLING KNIFE", "落ちるナイフ", 1000, 10000, 15000, "compare", {
        direction: "down",
        delta: 40,
        description: "前回より40以上、小さければ当たり。",
    }),
    bet("momentum-4", "VOLATILITY", "大荒れ歓迎", 10000, 80000, 250000, "compare", {
        direction: "absolute",
        delta: 50,
        description: "前回から50以上動けば、上下どちらでも当たり。",
    }),
    bet("rush-1", "AFTER HOURS", "残業ボーナス", 1000, 4500, 50000, "rush-dividend", { description: "Rush中の51以上だけ配当。連鎖を待つ。" }),
    bet("rush-2", "PEAK PARTY", "宴の頂点", 100000, 2400000, 2000000, "rush-dividend", { start: 91, width: 10, description: "Rush中の91以上で大きな配当。" }),
    bet("linear-1", "SLOW CLIMB", "じわ上がり", 10, 26, 200, "rising", {
        description: "数字が大きいほど配当も増える。",
    }),
    bet("linear-2", "WHOLE MARKET", "市場まるごと", 10000, 31000, 100000, "rising", { description: "すべての数字に配当。収支プラスは高い数字から。" }),
];
export const LEGACY_BETS: Bet[] = legacy.map((b) => ({
    id: b.id,
    name: b.name,
    ja: b.name,
    description: b.description,
    stake: b.baseCost,
    payout: b.basePayout,
    pattern: b.pattern as Pattern,
    start: b.start,
    width: b.width,
    unlock: 0,
    tier: b.tier,
    target: "streakTarget" in b ? Number(b.streakTarget) : undefined,
    penalty: "missPenalty" in b ? Number(b.missPenalty) : undefined,
    effect: "effectValue" in b ? Number(b.effectValue) : undefined,
    rarity: b.rarity,
    legacy: true,
}));
const slowPayouts = [30, 450, 11250, 220000, 2750000, 36666667, 550000000];
export const LONG_BETS = BASE_BETS.map((b, i) => ({
    ...b,
    id: "long-" + b.id,
    payout: slowPayouts[i],
    description: "長時間調整用。基本と同じ当たり範囲で、配当を抑えた比較版。",
}));
export const EXPERIMENT_BETS: Bet[] = [
    ...[10, 1000, 100000, 2000000].map((stake, i) => bet(`ninety-${i + 1}`, ["NINETY CLUB", "LONG TAIL", "SUPER CYCLE", "ESCAPE VELOCITY"][i], "90%の連勝", stake, stake * 0.14, [40, 20000, 2000000, 50000000][i], "ladder", { start: 11, width: 90, multiplier: 1.1, description: "90%で継続。初回は小さな配当、当たるたび×1.1。22連勝目から1回の収支がプラス。外れると最初から。" })),
    bet("sequence-boost-1", "RELAY", "当たりをつなぐ", 20, 0, 1000, "support", { first: [76, 100], second: [91, 100], multiplier: 3, description: "76以上の次に91以上で、他のギャンブルの当たり配当×3。WORKは対象外。重ねると倍率の増加分を加算。" }),
    bet("sequence-boost-2", "AMPLIFIER", "一撃を増幅", 2000, 0, 100000, "support", { first: [91, 100], second: [96, 100], multiplier: 5, description: "91以上の次に96以上で、他の当たり配当×5。条件成立したスピンだけ有効。WORKは対象外。" }),
    bet("skyline", "SKYLINE", "雲を抜ける", 250000, 40000000, 10000000, "step", { first: [81, 100], second: [96, 100], description: "81以上の次に96以上で$40M。予告の次の一手に賭ける。" }),
    bet("break-the-sky", "BREAK THE SKY", "空の向こう", 1000000, 300000000, 50000000, "step", { first: [91, 100], second: [96, 100], description: "91以上の次に96以上で$300M。条件付きの一撃でビリオンを目指す。" }),
    bet("afterburner", "AFTERBURNER", "最後の点火", 5000000, 800000000, 150000000, "threshold", { start: 100, width: 1, description: "100で$800M。ジャックポットとともに、目標へ加速する。" }),
    bet("work-income", "WORK", "働くポジション", 0, 5, 0, "work-income", { start: 1, width: 100, description: "賭け金$0。毎スピン必ず$5を稼ぐ。連打なしでも、ここから何度でも再開できる。" }),
    bet("roll-shift-1", "UPDRAFT", "5回ごとの追い風", 10, 0, 0, "roll-shift", { target: 5, effect: 10, description: "全体の5の倍数スピンで、共通の出目を+10（上限100）。補正後の数字で全て決着。100ならJackpot。" }),
];
export const ALL_BETS = [
    ...BASE_BETS,
    ...EXPERIMENT_BETS,
    ...NEW_BETS,
    ...LEGACY_BETS,
    ...LONG_BETS,
].map(b=>({...b,get name(){return language()==="ja"?(japaneseNames as Record<string,string>)[b.id]??b.ja:b.name;},get description(){return _t(b.description);}}));
export const betById = (id: string): Bet => ALL_BETS.find((b) => b.id === id) ?? BASE_BETS[0];
const basic = BASE_BETS.map((b) => b.id);
const group = (prefix: string) => NEW_BETS.filter((b) => b.id.startsWith(prefix)).map((b) => b.id);
export const CATALOGS: Catalog[] = [
    {
        id: "classic",
        name: "基本7種",
        en: "ORIGINAL SEVEN",
        color: "#b5ed70",
        description: "既存の基本7種だけ。賭け金・当たり・配当・解放額をそのまま再現。",
        ids: basic,
    },
    {
        id: "curated",
        name: "おすすめ相場",
        en: "HOUSE MIX",
        color: "#b5ed70",
        description: "ジャックポット中も1秒固定。50%・80%・90%の連勝と、条件付き増幅を組み合わせる。",
        ids: [
            ...basic,
            "streak-1",
            "flow-1",
            "ninety-1",
            "ninety-2",
            "ninety-3",
            "ninety-4",
            "sequence-boost-1",
            "sequence-boost-2",
            "skyline",
            "break-the-sky",
            "afterburner",
            "shape-3",
            "streak-3",
            "flow-3",
            "rush-2",
            "step-4",
        ],
    },
    {
        id: "streaks",
        name: "連勝天国",
        en: "HOT HANDS",
        color: "#b79aff",
        description: "50%は速く跳ね、80%は長く伸びる。2つの連勝を比べる。",
        ids: [...basic, ...group("streak"), ...group("flow"), "rush-1"],
    },
    {
        id: "streak80",
        name: "80%で育てる",
        en: "EIGHTY CLUB",
        color: "#ff8978",
        description: "基本7種＋80%連勝。小さな配当から、長い連勝で大きく伸ばす。",
        ids: [...basic, ...group("flow")],
    },
    {
        id: "crashes",
        name: "連敗の代償",
        en: "THIN ICE",
        color: "#80cafa",
        description: "基本7種＋連敗型。普段の勝ちと、連敗で膨らむ賭け金を比べる。",
        ids: [...basic, ...group("risk")],
    },
    {
        id: "reversals",
        name: "次の一手",
        en: "NEXT TICK",
        color: "#80cafa",
        description: "ひとつ前の数字が次の意味を変える。予告と決着の相場。",
        ids: [...basic, ...group("step"), "sequence-boost-1", "sequence-boost-2", "skyline", "break-the-sky", ...group("momentum")],
    },
    {
        id: "dryspell",
        name: "大逆転待ち",
        en: "PRESSURE COOKER",
        color: "#ffb45e",
        description: "外れるほど次の配当が育つ。赤いチャートの先に噴火を待つ。",
        ids: [...basic, ...group("drought"), "step-1", "shape-2"],
    },
    {
        id: "spectrum",
        name: "変形相場",
        en: "STRANGE SHAPES",
        color: "#68ded0",
        description: "奇数、両端、真ん中、三つの島。当たりの形から組み合わせる。",
        ids: [...basic, ...group("shape"), ...group("linear"), "momentum-4"],
    },
    {
        id: "rush",
        name: "連鎖研究所",
        en: "CHAIN REACTION",
        color: "#e6cf76",
        description: "出目カットで世界が変わる。連勝とRushの相乗効果を楽しむ。",
        ids: [
            ...basic,
            "streak-2",
            "streak-4",
            "flow-4",
            "step-4",
            "rush-1",
            "rush-2",
        ],
    },
    {
        id: "longgame",
        name: "長時間調整版",
        en: "LONG GAME",
        color: "#a9bace",
        description: "基本と同じ当たり範囲で配当を抑え、枠・出目カット・Rush価格を80倍に。5〜6時間に向けた比較用。",
        ids: LONG_BETS.map((b) => b.id),
    },
    { id: "billion", name: "ビリオンへの道", en: "BILLION CLUB", color: "#70b8ff", description: "基本の6段階から連勝・増幅・$40Mと$300Mの条件付き配当へ。単発$1.4Bを外した比較セット。", ids: [...basic.filter(id => id !== "edge-2"), "streak-3", "flow-3", "ninety-3", "ninety-4", "sequence-boost-1", "sequence-boost-2", "skyline", "break-the-sky", "afterburner"] },
    { id: "all-test", name: "全ギャンブル実験室", en: "EVERYTHING", color: "#ab9aff", description: "全種類を最初から解放。WORKと出目+10も試せる、ランキング対象外のテストセット。", ids: ALL_BETS.map(b => b.id) },
    {
        id: "legacy",
        name: "旧特殊市場",
        en: "LEGACY MARKET",
        color: "#daafef",
        description: "基本7種＋旧特殊30種の3択ガチャ。MEMORY LEAKの持ち越しも再現。",
        ids: [...basic, ...LEGACY_BETS.map((b) => b.id)],
    },
].map(c=>({...c,id:c.id as CatalogId,get name(){return language()==="en"?c.en:c.name;},get description(){return _t(c.description);}}));

export const catalogById = (id: CatalogId) => CATALOGS.find((c) => c.id === id) ?? CATALOGS.find(c => c.id === "classic")!;
