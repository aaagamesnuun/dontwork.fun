import { t as _t } from "./i18n";
import { wakeAudio, setAudioEnabled, audioEnabled } from "./audio";
import { NativeSwitch } from "./NativeSwitch";
import { configure, type Run, type Settings } from "./game/engine";
import type { Change } from "./App";
export function MusicSettings({ s, change }: {
    s: Run;
    change: Change;
}) {
    const set = (patch: Partial<Settings>) => { setAudioEnabled(audioEnabled({...s.settings,...patch})); wakeAudio(true); change((s) => configure(s, patch)); };
    return (<section className="settings-section music-settings">
      <h3>{_t("背景の音楽")}</h3>
      <label className="setting-row">
        <span>{_t("通常時のBGM")}<small>{_t("効果音とは別にON/OFF")}</small>
        </span>
        <NativeSwitch label="BGM" checked={s.settings.music} onChange={(music) => { set({ music, ...(music ? {} : { jackpotMusic: "follow" as const }) }); }} tactile={s.settings.haptics}/>
      </label>
      <label className="setting-row">
        <span>{_t("ジャックポット中の音楽")}</span>
        <select aria-label={_t("ジャックポット中の音楽")} value={s.settings.jackpotMusic} onChange={(e) => set({ jackpotMusic: e.target.value as Settings["jackpotMusic"] })}>
          <option value="follow">{_t("通常時と同じ")}</option>
          <option value="on">{_t("流す · 通常時がOFFでも再生")}</option>
          <option value="off">{_t("流さない")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("曲の雰囲気")}</span>
        <select value={s.settings.musicPack} onChange={(e) => (() => { const musicPack = e.target.value as Settings["musicPack"]; set({ musicPack, music: true, adaptiveMusic: false }); })()}>
          <option value="pulse">{_t("Pulse · 弾むシンセ")}</option>
          <option value="night">{_t("Night · 静かな夜")}</option>
          <option value="arcade">{_t("Arcade · ゲームセンター")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{_t("BGM音量")}<small>{Math.round(s.settings.musicVolume * 100)}%</small>
        </span>
        <input aria-label={_t("BGM音量")} type="range" min="0" max="1" step=".05" value={s.settings.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })}/>
      </label>
      <p className="setting-note">{_t("通常時をOFF、ジャックポット中を「流す」にすると、当選した瞬間から音楽が始まります。")}</p>
    </section>);
}
