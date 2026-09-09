import { useSyncExternalStore } from 'react';
export type BetNameStyle = 'english' | 'katakana';
const KEY = 'dontwork-bet-name-style-v1';
const read = (): BetNameStyle => { try { return localStorage.getItem(KEY) === 'katakana' ? 'katakana' : 'english'; } catch { return 'english'; } };
let style: BetNameStyle = read();
const listeners = new Set<() => void>();
export const betNameStyle = () => style;
export function setBetNameStyle(value: BetNameStyle) {
    style = value;
    try { localStorage.setItem(KEY, value); } catch { /* Optional display preference. */ }
    listeners.forEach(listener => listener());
}
export const useBetNameStyle = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, betNameStyle, betNameStyle);
