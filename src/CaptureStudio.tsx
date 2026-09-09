import { t as _t, textValue as _text } from "./i18n";
import { useCallback, useEffect, useMemo, useState } from 'react';
import App from './App';
import { money, type Run } from './game/engine';
import { CAPTURE_CONFIG_KEY, captureScenes, parseCaptureRolls, validateCaptureRolls, type CaptureSceneId, type CaptureSession } from './captureScenario';
import './captureStudio.css';
export function CaptureStudio() {
    const [scenes] = useState(captureScenes);
    const [initial] = useState(() => {
        const id = new URLSearchParams(location.search).get('scene');
        let scene: CaptureSceneId = id && Object.hasOwn(scenes, id) ? id as CaptureSceneId : 'work';
        let rolls = scenes[scene].rolls;
        try {
            const saved = JSON.parse(localStorage.getItem(CAPTURE_CONFIG_KEY) || 'null');
            if (saved && Object.hasOwn(scenes, saved.scene) && (!id || saved.scene === id) && Array.isArray(saved.rolls)) {
                const parsed = parseCaptureRolls(saved.rolls.join(','));
                validateCaptureRolls(scenes[saved.scene as CaptureSceneId].initialRun, parsed);
                scene = saved.scene;
                rolls = parsed;
            }
        }
        catch { /* Invalid preferences fall back to the built-in scene. */ }
        return { scene, rolls };
    });
    const [scene, setScene] = useState(initial.scene);
    const [text, setText] = useState(() => initial.rolls.join(', '));
    const [take, setTake] = useState(() => ({ serial: 0, scene, rolls: initial.rolls }));
    const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('clean') !== '1');
    const [live, setLive] = useState<Run>(scenes[scene].initialRun);
    const [error, setError] = useState('');
    const showSettings = useCallback(() => setOpen(true), []);
    const onState = useCallback((run: Run) => setLive(run), []);
    const session = useMemo<CaptureSession>(() => ({ initialRun: scenes[take.scene].initialRun, rolls: take.rolls, controlsOpen: open, onSettings: showSettings, onState }), [scenes, take, showSettings, onState, open]);
    useEffect(() => {
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') {
            setOpen(value => !value);
            e.stopPropagation();
        } };
        addEventListener('keydown', key, true);
        return () => removeEventListener('keydown', key, true);
    }, []);
    const start = (hide: boolean) => {
        try {
            const rolls = parseCaptureRolls(text);
            validateCaptureRolls(scenes[scene].initialRun, rolls);
            setTake(old => ({ serial: old.serial + 1, scene, rolls }));
            setError('');
            setOpen(!hide);
            const url = new URL(location.href);
            url.searchParams.set('studio', '1');
            url.searchParams.set('scene', scene);
            if (hide)
                url.searchParams.set('clean', '1');
            else
                url.searchParams.delete('clean');
            history.replaceState(null, '', url.pathname + url.search);
            try {
                localStorage.setItem(CAPTURE_CONFIG_KEY, JSON.stringify({ scene, rolls }));
            }
            catch { /* The current take remains usable. */ }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : _t("出目を確認してください。"));
        }
    };
    const select = (id: CaptureSceneId) => { setScene(id); setText(scenes[id].rolls.join(', ')); setError(''); };
    return <div className="capture-studio">
    <div className="studio-stage" inert={open}><App key={take.serial} studio={session}/></div>
    {open && <div className="studio-backdrop"><section className="studio-panel" role="dialog" aria-modal="true" aria-label={_t("撮影スタジオ")}>
      <div className="studio-heading"><h1>{_t("撮影スタジオ")}</h1><button className="secondary" autoFocus onClick={() => setOpen(false)}>{_t("閉じる")}</button></div>
      <p>{_t("出目を指定して、同じ場面を何度でも撮り直せます。")}</p>
      <label>{_t("場面")}<select value={scene} onChange={e => select(e.target.value as CaptureSceneId)}>{Object.values(scenes).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p className="setting-note">{_text(scenes[scene].description)}</p>
      <label>{_t("出目の順番")}<textarea value={text} rows={4} placeholder="25, 75, 40, 83, 95, 97" onChange={e => setText(e.target.value)} spellCheck={false}/></label>
      <p className="setting-note">{_t("1〜100をカンマ区切り。AUTOで順番に回り、最後で止まります。空欄ならWORKや装備・購入だけを撮影できます。")}</p>
      <div className="studio-preview"><span>{_t("開始時の資産")}<strong>{money(scenes[scene].initialRun.cash)}</strong></span><span>{_t("開始スピン")}<strong>{scenes[scene].initialRun.spins}</strong></span><span>{_t("現在の資産")}<strong>{money(live.cash)}</strong></span></div>
      {error && <p role="alert" className="studio-error">{_text(error)}</p>}
      <div className="button-row"><button className="secondary" onClick={() => start(false)}>{_t("この設定で最初から")}</button><button className="primary" onClick={() => start(true)}>{_t("設定を隠して撮影")}</button></div>
      <p className="setting-note">{_t("Escキー、またはゲームのメニューからこの設定に戻れます。撮影用のセーブ・指定出目を使用し、ランキングには送信しません。")}</p>
      <a className="studio-exit" href="/">{_t("通常プレイへ戻る →")}</a>
    </section></div>}
  </div>;
}
