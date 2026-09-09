import { useBetNameStyle, setBetNameStyle, type BetNameStyle } from "./betNamePreferences";
import { t as _t, textValue as _text } from "./i18n";
import { soundPackSettings } from "./soundPresets";
import { BackgroundSettings } from "./BackgroundSettings";
import { Rating } from "./Rating";
import { completionTarget } from "./rankingOutbox";
import { ReleaseLab } from "./ReleaseLab";
import { SoundPackPicker } from "./SoundPackPicker";
import { EffectsLab } from "./EffectsLab";
import { PriceLab } from "./PriceLab";
import { MusicSettings } from "./MusicSettings";
import { NativeSwitch } from "./NativeSwitch";
import { sound, uiSound, setAudioEnabled, audioEnabled, wakeAudio, } from "./audio";
import { haptic } from "./feedback";
import { useState, type CSSProperties } from "react";
import { CATALOGS, LEGACY_BETS, betById, catalogById, type CatalogId, } from "./game/catalog";
import { VERSION, JACKPOT_INTERVALS, SAVE_KEY, buyDraft, chooseDraft, configure, defaultSettings, draftPrice, duration, finiteMoney, freshRun, fuelCapacity, loadPreset, migrateLegacy, money, payoutOf, firstBet, readSave, savePreset, spin, switchCatalog, type Run, type Settings, } from "./game/engine";
export { Leaderboard } from "./Leaderboard";
import type { Change } from "./App";
export function Lab({ s, change, notify, preparePreview, onWorkMode, }: {
    s: Run;
    change: Change;
    notify: (m: string) => void;
    preparePreview?: () => number;
    onWorkMode?: (mode: Settings["workMode"], dockToy?: Settings["dockToy"]) => void;
}) {
    const nameStyle = useBetNameStyle();
    const [selected, setSelected] = useState<CatalogId>(s.catalog), [reset, setReset] = useState(false), [forced, setForced] = useState(100);
    const settings = (patch: Partial<Settings>) => change((s) => configure(s, patch));
    return (<>
      <label className="setting-row"><span>{_t("ギャンブル名")}</span><select value={nameStyle} onChange={e => setBetNameStyle(e.target.value as BetNameStyle)}><option value="english">{_t("英語 · 標準")}</option><option value="katakana">{_t("日本語 · 金融用語風")}</option></select></label>
      <section className="settings-section"><h3>{_t("スピン補助機能")}</h3>
        <label className="setting-row"><span>{_t("スピン補助機能")}</span><input type="checkbox" disabled={!!s.trial} checked={s.settings.spinAssist} onChange={e => settings({spinAssist:e.target.checked})}/></label>
        <p className="setting-note">{_t("通常モードの最初の5スピン。BASELINEをセットしているときに適用します。")}</p>
        <div className="spin-assist-order">{[...s.settings.spinAssistSequence].map((outcome,index)=><label key={index}><span>{_t("{0}回目",index+1)}</span><select disabled={!!s.trial || !s.settings.spinAssist} aria-label={_t("{0}回目",index+1)} value={outcome} onChange={e=>settings({spinAssistSequence:s.settings.spinAssistSequence.slice(0,index)+e.target.value+s.settings.spinAssistSequence.slice(index+1)})}><option value="W">{_t("当たり")}</option><option value="L">{_t("ハズレ")}</option></select></label>)}</div>
      </section>
      <BackgroundSettings s={s} change={change}/>
      <ReleaseLab s={s} change={change} onWorkMode={onWorkMode}/>
      <EffectsLab s={s} change={change} preparePreview={preparePreview}/>
      <section className="settings-section">
        <h3>{_t("プレイ体験の比較")}</h3>
        <label className="setting-row">
          <span>{_t("スピン容量を使う")}<small>{_t("OFFなら回数制限なし。ONで容量とその強化を復活。")}</small>
          </span>
          <input type="checkbox" checked={s.settings.fuelEnabled} onChange={(e) => settings({ fuelEnabled: e.target.checked })}/>
        </label>
        <label className="setting-row">
          <span>{_t("チャートの表示スピン数")}<small>{_t("直近1〜1,000スピン。標準は200。")}</small>
          </span>
          <input type="number" min="1" max="1000" step="1" value={s.settings.chartWindowSpins} onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= 1000)
                settings({ chartWindowSpins: n });
        }}/>
        </label>
        <label className="setting-row">
          <span>{_t("ニュース欄の位置")}<small>{_t("案内は同じ内容。位置だけを比較できます。")}</small>
          </span>
          <select value={s.settings.newsPosition} onChange={(e) => settings({
            newsPosition: e.target.value as Settings["newsPosition"],
        })}>
            <option value="top">{_t("ヘッダーの下 · 標準")}</option>
            <option value="bottom">{_t("WORK・AUTOの上")}</option>
          </select>
        </label>
      </section>
      <div className="lab-intro">
        <span className="eyebrow">WAYS TO BE BULLISH</span>
        <h3>{_t("どの相場が、いちばん面白い？")}</h3>
        <p>{_t("セットを変えると、市場に登場するギャンブルと解放の順番が変わります。")}</p>
      </div>
      <div className="catalog-grid" role="radiogroup" aria-label={_t("ギャンブルセット")}>
        {CATALOGS.map((c) => (<button role="radio" aria-checked={selected === c.id} className={`catalog-card ${selected === c.id ? "selected" : ""}`} style={{ "--catalog-color": c.color } as CSSProperties} key={c.id} onClick={() => {
                setSelected(c.id);
                setReset(false);
            }}>
            <div>
              <span>{c.en}</span>
              <i>{selected === c.id ? "●" : "○"}</i>
            </div>
            <h3>{c.name}</h3>
            <p>{_text(c.description)}</p>
            <small>
              {c.id === "legacy"
                ? "7 BASIC + 30 SPECIAL"
                : `${c.ids.length} GAMBLES`}
              {s.catalog === c.id ? " · PLAYING" : ""}
            </small>
          </button>))}
      </div>
      <div className="catalog-actions">
        <div>
          <strong>{catalogById(selected).name}</strong>
          <small>{_t("切り替え時は一時停止。連鎖・条件の記憶はリセット。")}</small>
        </div>
        <button className="secondary" disabled={selected === s.catalog} onClick={() => {
            change((s) => switchCatalog(s, selected));
            notify(_t("資産と強化を引き継いで、セットを切り替えました。"));
        }}>{_t("進行を引き継いで切替")}</button>
        <button className="primary" onClick={() => setReset(true)}>{_t("このセットで最初から")}</button>
      </div>
      {reset && (<div className="confirm-box">
          <p>{_t("このブラウザの進行を置き換え、{0} を$0から始めます。必要なら先に設定からセーブを書き出してください。", catalogById(selected).name)}</p>
          <div className="button-row">
            <button className="secondary" onClick={() => setReset(false)}>{_t("戻る")}</button>
            <button className="primary" onClick={() => {
                change((s) => ({
                    ...freshRun(selected, s.settings),
                    telemetry: s.telemetry,
                }));
                setReset(false);
                notify(_t("新しい相場を始めました。"));
            }}>{_t("進行をリセットして開始")}</button>
          </div>
        </div>)}
      <PriceLab s={s} change={change}/>
      <div className="settings-columns">
        <section className="settings-section">
          <h3>{_t("抽選の比較")}</h3>
          <button className="secondary" onClick={() => settings({
            fuelEnabled: defaultSettings.fuelEnabled,
            opening: defaultSettings.opening,
            assist: defaultSettings.assist,
            assistAfter: defaultSettings.assistAfter,
            spinSpeedScale: defaultSettings.spinSpeedScale,
            jackpotSpinIntervalMs: defaultSettings.jackpotSpinIntervalMs,
            rushBase: defaultSettings.rushBase,
            jackpotRule: defaultSettings.jackpotRule,
            upgradePrices: defaultSettings.upgradePrices,
            economyProfile: defaultSettings.economyProfile,
            positionPriceBase: defaultSettings.positionPriceBase,
            positionPriceMultiplier: defaultSettings.positionPriceMultiplier,
            speedPriceBase: defaultSettings.speedPriceBase,
            speedPriceMultiplier: defaultSettings.speedPriceMultiplier,
            upgradeMode: defaultSettings.upgradeMode,
        })}>{_t("抽選設定を標準に戻す")}</button>
          <label className="setting-row">
            <span>{_t("アップグレード方式")}<small>{_t("{0}のギャンブルセットすべてに組み合わせ可能", CATALOGS.length)}</small>
            </span>
            <select value={s.settings.upgradeMode} onChange={(e) => settings({
            upgradeMode: e.target.value as Settings["upgradeMode"],
        })}>
              <option value="direct">{_t("直接購入")}</option>
              <option value="gacha">{_t("ガチャだけ")}</option>
            </select>
          </label>
          {s.settings.upgradeMode === "gacha" && (<p className="setting-note">{_t("「アップグレード」から強化ガチャを引けます。初回$25、価格は毎回約1.18倍（端数切り上げ）。解放済み・未MAXの強化から等確率で1段階。方式を切り替えても、引いた回数は残ります。")}</p>)}
          <label className="setting-row">
            <span>{_t("最初の賭け金")}<small>
                $10 →{" "}
                {money(payoutOf(betById(firstBet(s)), {
            ...s,
            settings: { ...s.settings, opening: 10 },
        }))}{" "}
                / $20 → $50
              </small>
            </span>
            <select value={s.settings.opening} onChange={(e) => settings({ opening: Number(e.target.value) as 10 | 20 })}>
              <option value={10}>$10</option>
              <option value={20}>$20</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{_t("通常抽選の速さ")}</span>
            <select value={s.settings.spinSpeedScale} onChange={(e) => settings({ spinSpeedScale: Number(e.target.value) })}>
              <option value={2}>{_t("0.5倍速")}</option>
              <option value={1}>{_t("1倍速")}</option>
              <option value={0.5}>{_t("2倍速")}</option>
              <option value={0.1}>{_t("10倍速")}</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{_t("Jackpot中の間隔")}<small>{_t("1スピンごとの待ち時間")}</small>
            </span>
            <select value={s.settings.jackpotSpinIntervalMs} onChange={(e) => settings({
            jackpotSpinIntervalMs: Number(e.target.value) as Settings["jackpotSpinIntervalMs"],
        })}>
              {JACKPOT_INTERVALS.map((ms) => (<option key={ms} value={ms}>{_t("{0}秒 {1}", ms / 1000, ms === 100
            ? _t(" · 従来") : ms === 300
            ? _t(" · 標準") : ms === 500
            ? _t(" · じっくり") : "")}</option>))}
            </select>
          </label>
          <p className="setting-note">{_t("Jackpot中でも変更できます。速度を変えたプレイは比較用ランとして記録します。")}</p>
          <label className="setting-row">
            <span>{_t("基礎ジャックポットスピン回数")}<small>{_t("購入による追加分は別に加算")}</small>
            </span>
            <select value={s.settings.rushBase} onChange={(e) => settings({ rushBase: Number(e.target.value) })}>
              {[20, 25, 50, 75, 100].map((n) => (<option key={n}>{n}</option>))}
            </select>
          </label>
          <p className="setting-note">{_t("ジャックポット中はチャート画面に固定。連鎖が終わると、強化やコインフリップを開けます。")}</p>
        </section>
        <section className="settings-section">
          <h3>{_t("初回Jackpot")}</h3>
          <label className="setting-row">
            <span>{_t("初回Jackpotの設定を使う")}</span>
            <input type="checkbox" checked={s.settings.assist} onChange={(e) => settings({ assist: e.target.checked })}/>
          </label>
          <label className="setting-row">
            <span>{_t("スピン数")}</span>
            <input type="number" min={1} max={10000} value={s.settings.assistAfter} onChange={(e) => settings({
            assistAfter: Math.max(1, Math.min(10000, Math.round(Number(e.target.value)) || 1)),
        })}/>
          </label>
          <p className="setting-note">{_t("ルール変更・資産追加・出目指定を行ったランはランキング対象外。見た目と音の変更は対象のままです。")}</p>
        </section>
      </div>
      <section className="settings-section">
        <h3>{_t("進行・演出の試験")}</h3>
        <div className="button-row">
          {[100, 10000, 1e6, 1e8].map((n) => (<button className="secondary" key={n} onClick={() => change((s) => ({
                ...s,
                cash: finiteMoney(s.cash + n),
                peak: Math.max(s.peak, s.cash + n),
                debug: true,
            }))}>
              +{money(n)}
            </button>))}
          <button className="secondary" onClick={() => change((s) => ({ ...s, fuel: fuelCapacity(s), debug: true }))}>{_t("Compute全回復")}</button>
          <button className="secondary" onClick={() => change((s) => ({
            ...s,
            peak: Math.max(s.peak, 1e9),
            owned: s.catalog === "legacy"
                ? LEGACY_BETS.map((b) => b.id)
                : s.owned,
            debug: true,
        }))}>{_t("全ギャンブル解放")}</button>
          <button className="secondary" onClick={() => change((s) => ({
            ...s,
            trim: 33,
            cash: Math.max(s.cash, 1000),
            peak: Math.max(s.peak, 1000),
            debug: true,
        }))}>{_t("出目カット +33で連鎖試験")}</button>
        </div>
        <div className="setting-row">
          <span>{_t("次の出目を指定して1回抽選")}<small>{_t("賭け金とComputeは必要です")}</small>
          </span>
          <div className="button-row">
            <input aria-label={_t("指定する出目")} type="number" value={forced} min={s.rushLeft ? s.removed + 1 : 1} max={100} onChange={(e) => setForced(Math.max(s.rushLeft ? s.removed + 1 : 1, Math.min(100, Math.round(Number(e.target.value)) || 1)))}/>
            <button className="secondary" onClick={() => change((s) => spin({ ...s, debug: true }, Math.max(s.rushLeft ? s.removed + 1 : 1, forced), 0))}>
              ROLL
            </button>
          </div>
        </div>
      </section>
    </>);
}
export function Draft({ s, change }: {
    s: Run;
    change: Change;
}) {
    return (<div className="draft-box">
      <div className="eyebrow">LEGACY MARKET / {s.draws} DRAWS</div>
      <h3>{_t("特殊市場から、1つ選ぶ。")}</h3>
      <p>{_t("30種類から異なる3候補。重複を取ると同時に装備できる数が増えます。")}</p>
      {!s.offers.length ? (<button className="primary" disabled={s.cash < draftPrice(s)} data-ui-cue="equip" onClick={() => change(buyDraft)}>{_t("3択を引く · {0}", money(draftPrice(s)))}</button>) : (<div className="draft-choices">
          {s.offers.map((id) => {
                const b = betById(id);
                return (<button className="draft-choice" key={id} data-ui-cue="equip" onClick={() => change((s) => chooseDraft(s, id))}>
                <span className="micro">{b.rarity}</span>
                <strong>{b.name}</strong>
                <p>{_text(b.description)}</p>
                <small>
                  {money(b.stake)} → {money(b.payout)}
                </small>
                <span className="positive">{_t("これを選ぶ ↗")}</span>
              </button>);
            })}
        </div>)}
    </div>);
}
export function Presets({ onLoad, pending = false, s, change, notify, }: {
    s: Run;
    change: Change;
    notify: (m: string) => void;
    onLoad?: (index: number) => void;
    pending?: boolean;
}) {
    return (<div className="presets">
      {[0, 1, 2].map((i) => (<div key={i}>
          <span>BUILD 0{i + 1}</span>
          <button disabled={pending || !s.presets[i]?.length} onClick={() => {
                if (onLoad) {
                    onLoad(i);
                    return;
                }
                const n = loadPreset(s, i);
                change((current) => loadPreset(current, i));
                notify(n === s
                    ? _t("枠や解放条件が足りないため読み込めません。") : _t("編成を読み込みました。"));
            }}>
            LOAD
          </button>
          <button disabled={!s.portfolio.length} onClick={() => {
                change((s) => savePreset(s, i));
                notify(_t("BUILD 0{0}に保存しました。", i + 1));
            }}>
            SAVE
          </button>
        </div>))}
    </div>);
}
export function SettingsPanel({ s, change, notify, erase, }: {
    s: Run;
    change: Change;
    notify: (m: string) => void;
    erase: () => Promise<void>;
}) {
    const [importText, setImportText] = useState(""), [confirmErase, setConfirmErase] = useState(false);
    const exportSave = () => {
        const blob = new Blob([JSON.stringify({ ...s, background: null, running: false }, null, 2)], {
            type: "application/json",
        }), url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url;
        a.download = `bebullish-${s.catalog}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return (<>
      <section className="settings-section">
        <h3>{_t("音と動き")}</h3>
        <label className="setting-row">
          <span>{_t("スピンの表示")}</span>
          <select value={s.settings.reelStyle} onChange={(e) => change((s) => configure(s, {
            reelStyle: e.target.value as Settings["reelStyle"],
        }))}>
            <option value="payoff">{_t("Payoff Sweep · 標準")}</option>
            <option value="number">{_t("大きな数字")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{_t("効果音")}</span>
          <NativeSwitch label={_t("サウンド")} checked={s.settings.sound} tactile={s.settings.haptics} onChange={(checked) => {
            setAudioEnabled(audioEnabled({ ...s.settings, sound: checked }));
            if (checked)
                wakeAudio(true);
            change((s) => configure(s, { sound: checked }));
        }}/>
        </label>
        <SoundPackPicker value={s.settings.soundPack} onChange={(soundPack) => {
            const patch = soundPackSettings(soundPack);
            uiSound("win", { ...s.settings, ...patch });
            change((s) => configure(s, patch));
        }}/>
        <label className="setting-row">
          <span>{_t("演出スタイル")}</span>
          <select value={s.settings.fx} onChange={(e) => change((s) => configure(s, { fx: e.target.value as Settings["fx"] }))}>
            <option value="cinematic">{_t("Cinematic · 光と余韻")}</option>
            <option value="arcade">{_t("Arcade · 鮮やかで軽快")}</option>
            <option value="clean">{_t("Clean · 静かに集中")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{_t("振動")}<small>{_t("対応する端末のみ")}</small>
          </span>
          <NativeSwitch label={_t("振動")} checked={s.settings.haptics} onChange={(checked) => {
            change((s) => configure(s, { haptics: checked }));
            if (checked)
                haptic("upgrade", { haptics: true });
        }}/>
        </label>
        <label className="setting-row">
          <span>{_t("動きを抑える")}</span>
          <input type="checkbox" checked={s.settings.motion === "reduced"} onChange={(e) => change((s) => configure(s, { motion: e.target.checked ? "reduced" : "full" }))}/>
        </label>
        <div className="audio-tests" data-ui-cue="handled">
          <button className="secondary" onClick={() => {
            const settings = { ...s.settings, sound: true };
            setAudioEnabled(true);
            wakeAudio(true);
            sound("jackpot", settings);
            change((s) => configure(s, { sound: true }));
        }}>{_t("音を試す ♪")}</button>
          <button className="secondary" onClick={() => {
            const accepted = haptic("jackpot", { haptics: true });
            notify(accepted
                ? _t("振動をリクエストしました。") : _t("この端末では、上の振動スイッチを直接タップして試してください。"));
        }}>{_t("振動を試す")}</button>
        </div>
        <p className="setting-note">{_t("iPhoneでは、振動やAUTOのスイッチを直接タップしたときの触覚に対応。自動スピン中の振動は対応端末で動きます。")}</p>
      </section>
      <section className="settings-section">
        <MusicSettings s={s} change={change}/>
        <h3>{_t("このブラウザの進行")}</h3>
        <p className="setting-note">{_t("自動保存。閉じている間は進みません。Rushと連勝・チャンスの状態は残り、再開は手動です。別のブラウザへ移す場合はセーブを書き出してください。")}</p>
        <button className="secondary" onClick={exportSave}>{_t("セーブを書き出す ↓")}</button>
        <details className="save-import">
          <summary>{_t("セーブを読み込む / 旧版から引き継ぐ")}</summary>
          <p className="setting-note">{_t("現在の進行を置き換えます。読み込んだランは比較用としてランキング対象外になります。")}</p>
          <textarea aria-label={_t("セーブJSON")} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={_t("書き出したJSONを貼り付ける")} rows={4}/>
          <div className="button-row">
            <button className="secondary" disabled={!importText} onClick={() => {
            const n = readSave(importText) ?? migrateLegacy(importText);
            if (!n) {
                notify(_t("セーブの形式を確認してください。"));
                return;
            }
            change(() => ({
                ...n,
                background: null,
                id: crypto.randomUUID(),
                completion: n.completion
                    ? { ...n.completion, ranked: false }
                    : null,
                submitted: false,
                debug: true,
            }));
            setImportText("");
            notify(_t("セーブを読み込みました。"));
        }}>{_t("読み込んで置き換える")}</button>
            <button className="secondary" onClick={() => {
            let n: Run | null = null;
            for (const key of [
                "dont-be-bullish-save-v7",
                "dont-be-bullish-save-v6",
            ]) {
                n = migrateLegacy(localStorage.getItem(key));
                if (n)
                    break;
            }
            if (!n) {
                notify(_t("このブラウザに対応する旧セーブがありません。"));
                return;
            }
            change(() => n!);
            notify(_t("旧版の資産と装備を引き継ぎました。"));
        }}>{_t("このブラウザの旧セーブを探す")}</button>
          </div>
        </details>
      </section>
      <section className="settings-section">
        <h3>{_t("プレイデータ")}</h3>
        <label className="setting-row">
          <span>{_t("匿名のプレイ計測")}<small>{_t("進行、編成、強化、離脱位置を改善に使います")}</small>
          </span>
          <input type="checkbox" checked={s.telemetry} onChange={(e) => change((s) => ({ ...s, telemetry: e.target.checked }))}/>
        </label>
        <p className="setting-note">{_t("ランダムな端末IDを使用します。イベントは30日、ラン集計は180日を目安に整理します。問い合わせとランキングは、送信した内容を別に保存します。")}</p>
        {!confirmErase ? (<button className="secondary" onClick={() => setConfirmErase(true)}>{_t("この端末の計測データを削除…")}</button>) : (<div className="confirm-box">
            <p>{_t("この端末の計測データをサーバーから削除し、計測をOFFにします。ゲームのセーブは残ります。")}</p>
            <div className="button-row">
              <button className="secondary" onClick={() => setConfirmErase(false)}>{_t("戻る")}</button>
              <button className="secondary" onClick={() => {
                change((s) => ({ ...s, telemetry: false }));
                void erase()
                    .then(() => {
                    notify(_t("計測データを削除しました。"));
                    setConfirmErase(false);
                })
                    .catch((e) => notify(e.message));
            }}>{_t("削除する")}</button>
            </div>
          </div>)}
      </section>
      <p className="setting-note">
        dontwork.fun {VERSION} · {SAVE_KEY} ·{" "}
        {s.debug ? _t("比較用ラン") : _t("標準ルールのラン")}
      </p>
    </>);
}
export function Feedback({ s, send, sendRating, }: {
    s: Run;
    send: (body: Record<string, unknown>) => Promise<unknown>;
    sendRating: (body: Record<string, unknown>) => Promise<unknown>;
}) {
    const [name, setName] = useState(""), [contact, setContact] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState(""), [sent, setSent] = useState(false), [feedbackId, setFeedbackId] = useState<string | undefined>();
    if (sent)
        return <Rating source="feedback" feedbackId={feedbackId} onSend={sendRating}/>;
    return (<form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setResult("");
            try {
                const response = await send({
                    displayName: name,
                    replyContact: name.trim() ? contact || undefined : undefined,
                    message,
                    appVersion: VERSION,
                    language: s.settings.language,
                    page: "spin",
                    website: "",
                });
                setFeedbackId((response as {
                    id?: string;
                })?.id);
                setSent(true);
                setResult(_t("届きました。遊んでくれてありがとう。"));
            }
            catch (e) {
                setResult(e instanceof Error ? e.message : _t("送信できませんでした。"));
            }
            finally {
                setBusy(false);
            }
        }}>
      {sent ? (<p className="large-copy">{result}</p>) : (<>
          <p className="form-intro">{_t("面白かった瞬間、退屈だったところ、不具合。")}<br />{_t("あなたの遊んだ感触を教えてください。")}</p>
          <label className="field">{_t("名前（任意）")}<input maxLength={32} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname"/>
          </label>
          {name.trim() && (<label className="field">{_t("返信先（任意）")}<input maxLength={160} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={_t("メールアドレスなど")}/>
            </label>)}
          <label className="field">{_t("内容")}<textarea required minLength={3} maxLength={2000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)}/>
          </label>
          <p className="setting-note">{_t("{0} 内容は公開されません。", s.telemetry
            ? _t("改善用の統計と紐づけ、送信時の資産・スピン数・編成・演出設定を添えます。") : _t("プレイ統計はOFFのため添付しません。"))}</p>
          {result && (<p role="alert" className="negative">
              {result}
            </p>)}
          <button className="primary" disabled={busy}>
            {busy ? _t("送信中…") : _t("送信する ↗")}
          </button>
        </>)}
    </form>);
}
export function Stats({ s }: {
    s: Run;
}) {
    return (<>
      <p className="form-intro">{_t("{0}でのプレイ記録", catalogById(s.catalog).name)}</p>
      <div className="stats-grid">
        {[
            [_t("最高資産"), money(s.peak)],
            [_t("最大の純利益"), money(s.bestWin)],
            [_t("累積純利益"), money(s.lifetimeProfit)],
            [_t("アップグレード購入"), money(s.spent)],
            [_t("強化ガチャ"), s.upgradeDraws.toLocaleString()],
            [_t("スピン"), s.spins.toLocaleString()],
            ["Work", s.work.toLocaleString()],
            ["Jackpot", s.jackpots.toLocaleString()],
            [_t("最大連鎖"), s.maxChain],
            [_t("最高連勝"), s.maxStreak],
            [_t("アクティブ時間"), duration(s.activeMs)],
            [
                money(completionTarget(s)) + _t("到達"),
                s.clearActiveMs === null ? "—" : duration(s.clearActiveMs),
            ],
            ...(s.infinityAt ? [[_t("無限Jackpot"), _t("達成")]] : []),
        ].map(([label, value]) => (<div key={label}>
            <span className="micro">{_text(label)}</span>
            <strong>{value}</strong>
          </div>))}
      </div>
      <p className="setting-note">{_t("アクティブ時間は、表示中に操作・運転している時間です。Labで進行を引き継ぐと、それまでの統計も引き継がれます。")}</p>
    </>);
}
