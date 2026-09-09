import { BANKNOTES, banknoteImage, chooseBanknoteArtwork, type BanknoteArtwork, type BanknoteStyle } from "./banknotes";
import { CASH_DENOMINATIONS, tokenCents, type CashDenomination, type CashToken } from "./cashPlan";

export function cashImage(denomination: CashDenomination, style: BanknoteArtwork = "terminal") {
  if (denomination === 1) return "/banknotes/coin-cent.webp";
  if (denomination === 100) return "/banknotes/coin-1.webp";
  if (denomination === 10_000) return banknoteImage(style);
  return `/banknotes/${style}-${denomination / 100}.webp`;
}

export function preloadCashImages(style: BanknoteStyle) {
  const styles = style === "random" ? BANKNOTES.map(note => note.id) : [style];
  const sources = new Set(styles.flatMap(artwork => CASH_DENOMINATIONS.map(denomination => cashImage(denomination, artwork))));
  for (const src of sources) {
    const image = new Image();
    image.src = src;
  }
}

export function createCashSprite(token: CashToken, style: BanknoteStyle) {
  const artwork = token.denomination > 100 ? chooseBanknoteArtwork(style) : "terminal";
  const node = document.createElement("div");
  node.className = "result-particle particle-cash";
  node.dataset.kind = token.denomination <= 100 ? "coin" : "note";
  node.dataset.cents = tokenCents(token).toString();
  node.dataset.denomination = String(token.denomination);
  node.dataset.bundle = String(token.units > 1n);
  // Reuse the actual artwork for the visible layers; no multiplier labels.
  const layers = token.units === 1n ? 1 : token.units < 10n ? 2 : 3;
  for (let i = layers - 1; i >= 0; i--) {
    const image = document.createElement("img");
    image.src = cashImage(token.denomination, artwork); image.alt = "";
    image.style.setProperty("--cash-layer", String(i));
    node.append(image);
  }
  return node;
}
