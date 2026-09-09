import { useSyncExternalStore } from "react";
export type MoneyStyle = "compact" | "full";
const KEY = "dontwork-money-style-v1";
const read = (): MoneyStyle => { try { return localStorage.getItem(KEY) === "full" ? "full" : "compact"; } catch { return "compact"; } };
let style = read();
const listeners = new Set<() => void>();
export const moneyStyle = () => style;
export function setMoneyStyle(next: MoneyStyle) {
  style = next === "full" ? "full" : "compact";
  try { localStorage.setItem(KEY, style); } catch { /* Optional display preference. */ }
  listeners.forEach(fn => fn());
}
export const useMoneyStyle = () => useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, moneyStyle, moneyStyle);
