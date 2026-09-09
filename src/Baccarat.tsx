import { t as _t } from "./i18n";
import { useState } from 'react';
import { money, type Run } from './game/engine';
export function Baccarat({ s, pending, onPlay, onClose }: {
    s: Run;
    pending: boolean;
    onPlay: (wager: number, side: 'player' | 'banker') => void;
    onClose: () => void;
}) {
    const [amount, setAmount] = useState('10');
    const wager = Number(amount), valid = Number.isSafeInteger(wager) && wager >= 10 && wager % 10 === 0 && wager <= s.cash;
    const result = s.baccaratResult;
    return <section className="baccarat-panel" aria-label={_t("LAB バカラ")}>
 <div className="workspace-heading"><h2>{_t("バカラ")}<small>LAB</small></h2><button onClick={onClose}>{_t("ポジションに戻る")}</button></div>
 <p>{_t("大きい数字の側が勝ち。勝ちで2倍、引き分けは返却。")}</p>
 <div className="baccarat-cards" key={s.baccaratRounds}><div><span>PLAYER</span><strong>{result?.player ?? '?'}</strong></div><b>VS</b><div><span>BANKER</span><strong>{result?.banker ?? '?'}</strong></div></div>
 <div className="baccarat-bet"><label>{_t("賭け金 $")}<input type="number" min="10" step="10" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}/></label><button onClick={() => setAmount(String(Math.max(10, (Number.isFinite(wager) ? Math.floor(wager / 10) * 10 : 10) - 10)))}>−10</button><button onClick={() => setAmount(String(Math.min(Number.MAX_SAFE_INTEGER - 20, (Number.isFinite(wager) ? Math.floor(wager / 10) * 10 : 0) + 10)))}>+10</button></div>
 <div className="baccarat-actions">{(['player', 'banker'] as const).map(side => <button key={side} className="primary" disabled={!valid || pending || s.rushLeft > 0} onClick={() => onPlay(wager, side)}>{_t("{0}に賭ける", side.toUpperCase())}</button>)}</div>
 <output aria-live="polite">{pending ? _t("スピンの決着を待っています…") : result ? result.profit === 0 ? _t("TIE · 賭け金を返却") : `${result.profit > 0 ? 'WIN +' : 'LOSE '}${money(result.profit)}` : !valid ? _t("残高以内の、10の倍数を入力してください。") : _t("どちらに賭ける？")}</output>
 {!valid && result && <p className="setting-note">{_t("次の賭け金は、残高以内の10の倍数にしてください。")}</p>}
 <small>{_t("簡易ルール：両側の0〜9は等確率。勝ち9/20・引分1/10・負け9/20。期待倍率1.00倍。")}</small>
 </section>;
}
