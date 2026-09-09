import { t as _t } from "./i18n";
import { useEffect, useRef, useState } from 'react';
import { sound, wakeAudio } from './audio';
import { type Settings, defaultSettings } from './game/engine';
export const INTRO_KEY = 'bebullish-intro-seen-v2';
export function GameOverview({ settings = defaultSettings, onDone, fuelEnabled: _fuel, opening: _opening }: {
    settings?: Settings;
    onDone?: () => void;
    fuelEnabled?: boolean;
    opening?: number;
}) {
    const [page, setPage] = useState(0), [previewed, setPreviewed] = useState(false), root = useRef<HTMLDivElement>(null);
    const advance = () => { wakeAudio(true); if (page === 0) {
        setPreviewed(false);
        setPage(1);
    }
    else if (previewed) {
        sound('ui', settings);
        onDone?.();
    } };
    // Only the first page advances from taps on the dialog or its margins.
    // The sound page requires a sample and an explicit confirmation.
    useEffect(() => {
        if (page !== 0)
            return;
        const target = root.current?.closest('dialog') ?? root.current;
        if (!target)
            return;
        const tap = (event: Event) => { if (event.target instanceof Element && event.target.closest('button,a,input'))
            return; advance(); };
        target.addEventListener('click', tap);
        return () => target.removeEventListener('click', tap);
    }, [page, onDone, settings]);
    return <div className={`intro-pages ${page === 0 ? "tap-anywhere" : ""}`} ref={root}>
 <div className="intro-pagination" aria-label={_t("全2ページ中{0}ページ", page + 1)}><i className={page === 0 ? 'current' : ''}/><i className={page === 1 ? 'current' : ''}/></div>
 {page === 0 ? <><img className="intro-cash" src="/intro-cash-front.png" alt={_t("札束の手前を走る、上昇チャート")} width="1536" height="1024"/><h3 className="intro-message">{_t("ギャンブルで")}<br /><em>{_t("1ビリオン")}</em>{_t("稼いだら")}<br /><strong>{_t("クリア！")}</strong></h3><button className="primary intro-start" onClick={advance}>{_t("タップして次へ")}</button></> : <>
 <svg className="intro-volume" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" aria-hidden="true"><path d="M18 40h15l20-18v56L33 60H18Z"/><path d="M66 34q19 16 0 32M76 22q32 28 0 56" strokeLinecap="round"/></svg>
 <h3 className="intro-message">{_t("音量を上げると")}<br />{_t("ドパれます")}</h3>
 <button className={`secondary intro-start ${!previewed ? 'guide-target' : ''}`} onClick={() => { wakeAudio(true); sound('jackpot', { ...settings, sound: true, soundVolume: 1 }); setPreviewed(true); }}>{_t("♫ 音を試す")}</button>
 <button className={`intro-start ${previewed ? 'primary guide-target' : 'secondary'}`} disabled={!previewed} onClick={advance}>{_t("音を確認した · 始める →")}</button>
 <button className="text-button" onClick={() => setPage(0)}>{_t("← 戻る")}</button>
 </>}
 </div>;
}
export function JackpotHelp({ discovered = false, rule = "combined" }: {
    discovered?: boolean;
    rule?: Settings["jackpotRule"];
}) { return <div className="jackpot-help"><p className="large-copy">{rule === "combined" ? _t("100、または91以上を2回連続。") : rule === "double-high" ? _t("91以上を、2回連続。") : _t("100で、世界が変わる。")}</p><ol><li>{_t("{0} 標準では20回のジャックポットスピンが始まる。", rule === "combined" ? _t("100が出るか、91以上を2回連続で引くとジャックポット。90以下で連続判定はリセット。") : rule === "double-high" ? _t("91以上を2回連続で引くとジャックポット。90以下でリセット。91以上が続く間は、2回目以降毎回発動。") : _t("100が出るとジャックポット。"))}</li><li>{_t("ジャックポットが重なると、残り回数を最大値まで補充して連鎖が続く。")}</li><li>{_t("カット量は未強化なら0。強化後は、発動するたびその分だけ低い出目をカット。連鎖が終わるとカットは元に戻る。")}</li><li>{_t("ポジションを変更すると、確認後にジャックポットが終了します。")}</li><li>{_t("次の賭け金を払えなくなった場合も、ジャックポットは終了します。")}</li>{discovered && <li>{_t("1〜99を全てカットすると、ずっと100の無限ジャックポットへ。")}</li>}</ol><p>{_t("初回のジャックポットで、カット量・ジャックポットスピン回数のアップグレードが解放されます。")}</p></div>; }
