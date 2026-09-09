export const BANKNOTES = [
  { id: "terminal", label: "ターミナル紙幣", description: "黒緑とライムの回路模様", src: "/banknotes/terminal.webp" },
  { id: "hologram", label: "ホログラム紙幣", description: "光を反射する透明フィルム", src: "/banknotes/hologram.webp" },
  { id: "engraved", label: "フューチャー紙幣", description: "精密な彫刻と電子回路", src: "/banknotes/engraved.webp" },
] as const;

export type BanknoteArtwork = (typeof BANKNOTES)[number]["id"];
export type BanknoteStyle = BanknoteArtwork | "random";
export const banknoteImage = (style: BanknoteArtwork = "terminal") =>
  (BANKNOTES.find(note => note.id === style) ?? BANKNOTES[0]).src;

export const isBanknoteStyle = (value: unknown): value is BanknoteStyle =>
  value === "random" || BANKNOTES.some(note => note.id === value);

export const chooseBanknoteArtwork = (style: BanknoteStyle): BanknoteArtwork =>
  style === "random" ? BANKNOTES[Math.floor(Math.random() * BANKNOTES.length)].id : style;
