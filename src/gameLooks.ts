/** Visual preferences never change the simulation or ranking eligibility. */
export const GAME_LOOKS = [
  { id: "classic", number: "00", name: "オリジナル", en: "Original", description: "いつものトレーディングデスク。", tagline: "THE TRADING DESK" },
  { id: "receipt", number: "01", name: "感熱紙の億万長者", en: "Thermal billionaire", description: "資産もスピンも、一本の長いレシートに。", tagline: "RECEIPT OF A FORTUNE" },
  { id: "instrument", number: "02", name: "不労所得の計測器", en: "Idle income instrument", description: "走査する針、蛍光の波形、押し込むキー。", tagline: "INCOME MEASUREMENT SYSTEM" },
  { id: "typography", number: "03", name: "数字が建築になる", en: "Money, monumental", description: "巨大な金額と、鋭い罫線で遊ぶ。", tagline: "MONEY TAKES UP SPACE" },
  { id: "desktop", number: "04", name: "退職するデスクトップ", en: "Retirement OS", description: "仕事を辞めるための、小さな金融OS。", tagline: "RETIREMENT OPERATING SYSTEM" },
  { id: "broadcast", number: "05", name: "自分の資産だけを放送する金融番組", en: "Your money, on air", description: "あなたの損益だけが、今日のトップニュース。", tagline: "YOUR MONEY. THE ENTIRE BULLETIN." },
  { id: "collage", number: "06", name: "切り貼りされた金融商品", en: "Cut & paste finance", description: "切符、値札、明細を組み合わせた市場。", tagline: "CUT. PASTE. COMPOUND." },
  { id: "futures", number: "07", name: "100通りの未来を折り畳む", en: "One hundred futures", description: "100個の面から、ひとつの結果が開く。", tagline: "100 POSSIBILITIES. ONE PRESENT." },
] as const;
export type GameLook = typeof GAME_LOOKS[number]["id"];
export function normalizeLook(value: unknown): GameLook {
  return GAME_LOOKS.some(look => look.id === value) ? value as GameLook : "classic";
}
export function lookEnergy(profit: number, wager: number): number {
  if (!Number.isFinite(profit) || profit <= 0) return 0;
  return Math.min(1, Math.log10(1 + profit / Math.max(1, wager)) / 3);
}
