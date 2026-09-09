import { t as _t, textValue as _text } from "./i18n";
import { SweepAudio } from "./SweepAudio";
import { createSweepSignal, SweepMotionDriver } from "./SweepReadout";
import { soundPackSettings } from "./soundPresets";
import { spinTiming } from "./spinTiming";
import { interval } from "./game/engine";
import { playResultVisual, stopVisuals } from "./ResultVisuals";
import { SoundPackPicker } from "./SoundPackPicker";
import { BanknotePicker } from "./BanknotePicker";
import { MusicSettings } from "./MusicSettings";
import { NativeSwitch } from "./NativeSwitch";
import { useEffect, useRef, useState } from "react";
import { configure, type Run, type Settings } from "./game/engine";
import type { Change } from "./App";
import { setAudioEnabled, audioEnabled, uiSound, sound, wakeAudio, stopSounds, type Cue, } from "./audio";
import { impact, stopImpact } from "./impact";
import { useReducedMotion } from "./useReducedMotion";
import { effectSequence } from "./effectSequence";
import { PayoffSweep, type SweepFrame } from "./TradingViews";
const previewValues = Array.from({ length: 100 }, (_, i) => i < 50 ? -10 : 20);
export function EffectsLab({ s, change, preparePreview, }: {
    s: Run;
    change: Change;
    preparePreview?: () => number;
}) {
    const [previewSignal] = useState(createSweepSignal);
    const osReduced = useReducedMotion();
    const reduced = osReduced || s.settings.motion === "reduced";
    const set = (patch: Partial<Settings>) => change((s) => configure(s, patch));
    const visualPreview = useRef<HTMLDivElement>(null);
    const preview = useRef<HTMLDivElement>(null), cancelPreview = useRef<() => void>(() => { }), playingRef = useRef(false), previewAudio = useRef(false), state = useRef(s);
    state.current = s;
    const [playing, setPlaying] = useState(false);
    const [previewFrame, setPreviewFrame] = useState<SweepFrame | null>(null);
    const [cashPreviewAmount, setCashPreviewAmount] = useState(20);
    const stop = () => {
        stopVisuals(visualPreview.current);
        stopImpact(preview.current);
        stopSounds();
        cancelPreview.current();
        playingRef.current = false;
        setPlaying(false);
        setPreviewFrame(null);
    };
    useEffect(() => {
        const visuals = visualPreview.current, surface = preview.current;
        return () => {
            stopVisuals(visuals);
            stopImpact(surface);
            cancelPreview.current();
            if (previewAudio.current)
                stopSounds();
        };
    }, []);
    useEffect(() => {
        stopVisuals(visualPreview.current);
        stopImpact(preview.current);
        if (playingRef.current)
            stop();
    }, [reduced, s.settings.revealDurationMs, s.settings.revealPacing, s.settings.revealRatio, interval(s)]);
    useEffect(() => {
        const hidden = () => {
            if (document.hidden) {
                stopVisuals(visualPreview.current);
                if (playingRef.current)
                    stop();
            }
        };
        document.addEventListener("visibilitychange", hidden);
        return () => document.removeEventListener("visibilitychange", hidden);
    }, []);
    const startPreview = () => {
        cancelPreview.current();
        playingRef.current = true;
        setPlaying(true);
        if (preparePreview)
            return preparePreview();
        change((run) => ({ ...run, running: false }));
        return 950;
    };
    const endPreview = () => {
        playingRef.current = false;
        setPlaying(false);
    };
    const tryCue = (cue: Cue) => {
        previewAudio.current = true;
        const settings = state.current.settings;
        setAudioEnabled(audioEnabled(settings));
        wakeAudio(true);
        sound(cue, settings, 4);
        const rect = visualPreview.current?.getBoundingClientRect();
        const detail = { amount: cue === "bigwin" ? 10000 : cue === "jackpot" ? 100000 : 10, streak: settings.streakEffects ? 12 : 0,
            origin: rect ? { x: rect.left + rect.width * .5, y: rect.top + rect.height * .6, width: rect.width } : undefined };
        impact(preview.current, cue, settings, null, detail);
        playResultVisual(visualPreview.current, cue, settings, detail);
    };
    return (<section className="settings-section effects-lab">
      <h3>{_t("音と衝撃の実験室")}</h3>
      <BanknotePicker value={s.settings.banknoteStyle} onChange={banknoteStyle => { stop(); set({ banknoteStyle }); }}/>
      <label className="setting-row"><span>{_t("お金の舞い方")}</span><select value={s.settings.cashMotion} onChange={e => { stop(); set({ cashMotion: e.target.value as Settings["cashMotion"] }); }}><option value="burst">{_t("Sweepから湧いて消える · 標準")}</option><option value="rain">{_t("上から降る")}</option></select></label>
      <p className="setting-note">{_t("当たりの払い戻し額に合わせて額面と枚数が変わります。湧く演出は約1秒で消えます。")}</p>
      <label className="setting-row"><span>{_t("演出の強さ")}<small>{_t("{0}倍 · 音・揺れ・光・広がり", s.settings.effectIntensity.toFixed(2))}</small></span><input type="range" aria-label={_t("演出の強さ")} min=".25" max="2" step=".25" value={s.settings.effectIntensity} onChange={e => set({ effectIntensity: Number(e.target.value) })}/></label>
      <label className="setting-row"><span>{_t("連勝で盛り上がる")}<small>{_t("純利益がプラスのスピンが続くほど強く。マイナス・±0でリセット。")}</small></span><NativeSwitch label={_t("連勝で盛り上がる")} checked={s.settings.streakEffects} onChange={streakEffects => set({ streakEffects })}/></label>
      <label className="setting-row"><span>{_t("黄色い線の移動音")}<small>{_t("スピン中だけ、位置と動きに連動。")}</small></span><NativeSwitch label={_t("黄色い線の移動音")} checked={s.settings.sweepSound} onChange={sweepSound => set({ sweepSound })}/></label>
      <label className="setting-row"><span>{_t("FLIPの増減をチャートに丸で表示")}</span><NativeSwitch label={_t("FLIPの増減をチャートに丸で表示")} checked={s.settings.coinChartMarkers} onChange={coinChartMarkers => set({ coinChartMarkers })}/></label>
      <button className="secondary" onClick={() => tryCue("cash-low")}>{_t("賭け金不足の警告音を試す")}</button>
      <p className="setting-note">{_t("音色と強弱を組み合わせて比較。試聴は資産や抽選結果を変えません。")}</p>
      <SoundPackPicker value={s.settings.soundPack} onChange={(soundPack) => {
            stop();
            const patch = soundPackSettings(soundPack);
            set(patch);
            uiSound("win", { ...state.current.settings, ...patch });
        }}/>
      <label className="setting-row">
        <span>{_t("低音重視モード")}<small>{_t("結果音に短い低音の衝撃を重ねる")}</small>
        </span>
        <NativeSwitch label={_t("低音重視モード")} checked={s.settings.bassMode} onChange={(bassMode) => {
            stop();
            set({ bassMode });
        }} tactile={s.settings.haptics}/>
      </label>
      <p className="setting-note">{_t("低音の感じ方は機器によって変わります。下の試聴で、聞きやすい音量に調整してください。")}</p>
      <label className="setting-row">
        <span>{_t("スピン音の組み方")}</span>
        <select value={s.settings.spinSound} onChange={(e) => {
            stop();
            set({ spinSound: e.target.value as Settings["spinSound"] });
        }}>
          <option value="rhythm">{_t("リズム · 結果を一拍ずつ刻む（標準）")}</option>
          <option value="original">{_t("PE風 · 開始音と結果のメロディ")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("ゲージが溜まる音")}</span>
        <select value={s.settings.chargeSound} onChange={(e) => set({ chargeSound: e.target.value as Settings["chargeSound"] })}>
          <option value="ticks">{_t("刻む音")}</option>
          <option value="rise">{_t("だんだん高くなる音")}</option>
          <option value="off">{_t("OFF · 標準")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("ゲージ音量")}<small>{Math.round(s.settings.chargeVolume * 100)}%</small>
        </span>
        <input aria-label={_t("ゲージ音量")} type="range" min="0" max="1" step=".05" value={s.settings.chargeVolume} onChange={(e) => set({ chargeVolume: Number(e.target.value) })}/>
      </label>
      <label className="setting-row">
        <span>{_t("Payoff Sweepの表示")}</span>
        <select value={s.settings.payoffStyle} onChange={(e) => set({ payoffStyle: e.target.value as Settings["payoffStyle"] })}>
          <option value="classic">{_t("配当と支払いを上下に配置 · 標準")}</option><option value="net">{_t("PE · 純損益の箱")}</option>
          <option value="chart">{_t("v1.3 · チャート型")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("音量")}<small>{Math.round(s.settings.soundVolume * 100)}%</small>
        </span>
        <input aria-label={_t("音量")} type="range" min="0" max="1" step="0.05" value={s.settings.soundVolume} onChange={(e) => set({ soundVolume: Number(e.target.value) })}/>
      </label>
      <label className="setting-row">
        <span>{_t("ハズレ音の強さ")}{" "}
          <small>{Math.round(s.settings.lossVolume * 100)}%</small>
        </span>
        <input aria-label={_t("ハズレ音の強さ")} type="range" min="0" max="1" step="0.05" value={s.settings.lossVolume} onChange={(e) => set({ lossVolume: Number(e.target.value) })}/>
      </label>
      <label className="setting-row">
        <span>{_t("音を鳴らす頻度")}</span>
        <select value={s.settings.soundDensity} onChange={(e) => set({ soundDensity: e.target.value as Settings["soundDensity"] })}>
          <option value="all">{_t("全スピン · 標準")}</option>
          <option value="balanced">{_t("高速中は控えめ")}</option>
          <option value="highlights">{_t("大きな当たり中心")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("画面の揺れ")}</span>
        <select value={s.settings.shake} onChange={(e) => set({ shake: e.target.value as Settings["shake"] })}>
          <option value="off">{_t("なし")}</option>
          <option value="light">{_t("弱")}</option>
          <option value="strong">{_t("強 · 標準")}</option>
        </select>
      </label>
      {([["winVisual", _t("当たりのビジュアル")], ["jackpotVisual", _t("ジャックポットのビジュアル")]] as const).map(([key, label]) => <label className="setting-row" key={key}><span>{_text(label)}</span><select value={s.settings[key]} onChange={e => set({ [key]: e.target.value })}><option value="festival">{_t("札束シャワー＋紙吹雪 · 標準")}</option><option value="classic">{_t("いつもの演出")}</option><option value="cash">{_t("札束シャワー")}</option><option value="gold">{_t("ゴールドコイン")}</option><option value="neon">{_t("ネオンリング")}</option><option value="confetti">{_t("紙吹雪")}</option><option value="mix">{_t("ランダムミックス")}</option></select></label>)}
      <label className="setting-row"><span>{_t("チャートの動く背景")}</span><select value={s.settings.chartBackdrop} onChange={e => set({ chartBackdrop: e.target.value as Settings["chartBackdrop"] })}><option value="off">{_t("なし")}</option><option value="aurora">{_t("オーロラ · 資産が育つほど濃く")}</option><option value="flow">{_t("フロー · 利益で上昇、損失で逆流")}</option><option value="pulse">{_t("パルス · スピンの決着に反応")}</option></select></label>
      <label className="setting-row">
        <span>{_t("当たりの光")}</span>
        <select value={s.settings.impactFlash} onChange={(e) => set({ impactFlash: e.target.value as Settings["impactFlash"] })}>
          <option value="off">{_t("なし")}</option>
          <option value="soft">{_t("柔らかい")}</option>
          <option value="bright">{_t("明るい · 標準")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("スピン演出の長さ")}</span>
        <select value={s.settings.revealPacing} onChange={e => set({ revealPacing: e.target.value as Settings["revealPacing"] })}>
          <option value="ratio">{_t("スピン間隔 × n · 標準")}</option>
          <option value="adaptive">{_t("指定時間 · 高速時は短縮")}</option>
          <option value="full">{_t("指定時間を最後まで再生")}</option>
        </select>
      </label>
      {s.settings.revealPacing === "ratio" ? <label className="setting-row">
        <span>{_t("演出の倍率 n")}<small>{_t("{0}倍 · 現在 {1}秒", s.settings.revealRatio.toFixed(1), (spinTiming(s, s).revealDelay / 1000).toFixed(2))}</small></span>
        <input aria-label={_t("演出の倍率 n")} type="range" min="0.1" max="2" step="0.1" value={s.settings.revealRatio} onChange={e => set({ revealRatio: Number(e.target.value) })}/>
      </label> : <label className="setting-row">
        <span>{_t("指定する演出時間")}</span>
        <select value={s.settings.revealDurationMs} onChange={e => set({ revealDurationMs: Number(e.target.value) as Settings["revealDurationMs"] })}>
          <option value="120">{_t("120ms · キレよく")}</option><option value="260">{_t("260ms · 短め")}</option><option value="420">{_t("420ms · 余韻")}</option><option value="700">{_t("700ms · じっくり収束")}</option><option value="1200">{_t("1.2秒 · ゆっくり")}</option><option value="2000">{_t("2秒 · ためる")}</option><option value="3500">{_t("3.5秒 · じっくり鑑賞")}</option><option value="5000">{_t("5秒 · 最大のため")}</option>
        </select>
      </label>}
      <label className="setting-row">
        <span>{_t("黄色い線の動き")}</span>
        <select value={s.settings.sweepMotion} onChange={(e) => {
            stop();
            set({ sweepMotion: e.target.value as Settings["sweepMotion"] });
        }}>
          <option value="focus">{_t("絞り込み · 徐々に結果へ寄る（標準）")}</option>
          <option value="recoil">{_t("反動 · 行き過ぎて戻り、収まる")}</option>
          <option value="lock">{_t("段階ロック · 大きく寄せて細かく止まる")}</option>
          <option value="mix">{_t("ミックス · 収束する3種類を順番に")}</option>
          <option value="classic">{_t("PE0.4風 · ランダムに動いて止まる")}</option>
          <option value="slow">{_t("減速 · スピンの最後にもったいぶる")}</option>
          <option value="roam">{_t("疾走 · スピン中に駆け回る")}</option>
        </select>
      </label>
      <p className="setting-note">{_t("チャージ中は止まり、スピンが回った瞬間だけ動きます。長い演出を選ぶと、ジャックポット中も最後まで待ってから次のスピンへ。資産・結果音・黄色い線が一緒に決着します。")}</p>
      <div className="sweep-lab-preview" data-ui-cue="handled">
        <SweepMotionDriver signal={previewSignal} frame={previewFrame} motion={s.settings.sweepMotion} reduced={reduced}/>
        <SweepAudio signal={previewSignal} settings={s.settings}/>
        <p className="setting-note">{_t("当たり・ハズレのリズムを試す。賭け金は使わず、AUTOは停止します。")}</p>
        <PayoffSweep signal={previewSignal} values={previewValues} frame={previewFrame} reduced={reduced} style={s.settings.payoffStyle} motion={s.settings.sweepMotion}/>
        <button className="secondary" onClick={() => {
            if (playing) {
                stop();
                return;
            }
            const delay = startPreview();
            const duration = spinTiming(state.current, state.current, reduced).revealDelay;
            cancelPreview.current = effectSequence([23, 72, 39, 86, 91, 17, 46, 78], duration, Math.max(600, duration + 160), {
                start: (roll, index) => {
                    if (index === 0)
                        stopSounds();
                    setPreviewFrame({
                        id: index + 1,
                        roll,
                        values: previewValues,
                        duration,
                        at: Date.now(),
                    });
                    if (state.current.settings.spinSound === "original")
                        tryCue("spin");
                },
                result: (roll) => tryCue(roll <= 50 ? "loss" : "win"),
                done: endPreview,
                active: () => !document.hidden,
            }, delay);
        }}>
          {playing ? _t("試演を止める") : _t("8スピンを試す ♪")}
        </button>
      </div>
      <div className="effect-preview" ref={preview} data-ui-cue="handled">
        <div ref={visualPreview} className="preview-visuals" aria-hidden="true"/><span>{_t("音 / 揺れ / ビジュアルのプレビュー")}</span>
        <div className="cash-preview-controls">
          <label>{_t("当たり額")}<select aria-label={_t("試す当たり額")} value={cashPreviewAmount} onChange={e => setCashPreviewAmount(Number(e.target.value))}>
            {[1, 20, 250, 10000, 1000000, 1000000000].map(amount => <option key={amount} value={amount}>${amount.toLocaleString("en-US")}</option>)}
          </select></label>
          <button onClick={() => {
            stop();
            const delay = startPreview();
            cancelPreview.current = effectSequence([cashPreviewAmount], 0, 1300, {
                start: () => { },
                result: (amount) => {
                    const rect = visualPreview.current?.getBoundingClientRect();
                    playResultVisual(visualPreview.current, "win", { ...state.current.settings, winVisual: "cash" }, { amount,
                        origin: rect ? { x: rect.left + rect.width * .5, y: rect.top + rect.height * .6, width: rect.width } : undefined });
                }, done: endPreview, active: () => !document.hidden,
            }, delay);
        }}>{_t("お金の演出を試す")}</button>
        </div>
        <div className="cue-buttons">
          {([
            ["spin", _t("スピン開始")],
            ["loss", _t("ハズレ")],
            ["win", _t("小当たり")],
            ["bigwin", _t("大当たり")],
            ["jackpot", "Jackpot"],
            ["chain", _t("連鎖")],
        ] as const).map(([cue, label]) => (<button key={cue} onClick={() => {
                stop();
                const delay = startPreview();
                cancelPreview.current = effectSequence([cue], 0, 500, {
                    start: () => stopSounds(),
                    result: tryCue,
                    done: endPreview,
                    active: () => !document.hidden,
                }, delay);
            }}>
              {_text(label)}
            </button>))}
        </div>
      </div>
      <div className="button-row" data-ui-cue="handled">
        <button className="secondary" onClick={() => {
            if (playing) {
                stop();
                return;
            }
            const delay = startPreview();
            const cues: Cue[] = ["loss", "win", "bigwin", "jackpot", "chain"];
            cancelPreview.current = effectSequence(cues, 0, 1000, {
                start: (_, index) => {
                    if (index === 0)
                        stopSounds();
                },
                result: tryCue,
                done: endPreview,
                active: () => !document.hidden,
            }, delay);
        }}>
          {playing ? _t("試聴を止める") : _t("5種類を順番に試す ♪")}
        </button>
        {!s.settings.sound && (<button className="secondary" onClick={() => {
                setAudioEnabled(true);
                wakeAudio(true);
                set({ sound: true });
            }}>{_t("音をONにする")}</button>)}
      </div>
      {s.settings.motion === "reduced" && (<p className="setting-note">{_t("「動きを抑える」がONのため、揺れと光は停止しています。")}</p>)}
      <label className="setting-row">
        <span>{_t("総資産チャートの横軸")}</span>
        <select value={s.settings.chartAxis} onChange={(e) => set({ chartAxis: e.target.value as Settings["chartAxis"] })}>
          <option value="spins">{_t("スピン数 · 標準")}</option>
          <option value="time">{_t("プレイ時間")}</option>
        </select>
      </label>
      <p className="setting-note">{_t("最新の記録はいつも右端。WORKだけでは点を増やさず、スピンと強化購入で残高を記録します。黄色い丸は強化への支出です。")}</p>
      <MusicSettings s={s} change={change}/>
    </section>);
}
