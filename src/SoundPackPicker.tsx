import { t as _t, textValue as _text } from "./i18n";
import type { Settings } from "./game/engine";
export const SOUND_PACKS = [
    ["terminal", "Terminal"],
    ["retro-arcade", "Arcade · 旧版"],
    ["soft", "Soft · 旧版"],
    ["crystal", "Crystal"],
    ["arcade", "Arcade · v1.3"],
    ["wood", "Wood"],
    ["impact", "Impact"],
    ["arcade-coinop", "CASH RAIN · 8bit（標準）"],
    ["arcade-pinball", "Arcade · Pinball / きらめき"],
    ["arcade-synth", "Arcade · Synth / 和音"],
    ["arcade-punch", "Arcade · Punch / 低音"],
] as const;
export function SoundPackPicker({ value, onChange, }: {
    value: Settings["soundPack"];
    onChange: (pack: Settings["soundPack"]) => void;
}) {
    return (<div className="sound-pack-picker" data-ui-cue="handled">
      <label className="setting-row">
        <span>{_t("サウンドパック")}</span>
        <select value={value} onChange={(e) => onChange(e.target.value as Settings["soundPack"])}>
          {SOUND_PACKS.map(([pack, label]) => (<option key={pack} value={pack}>
              {_text(label)}
            </option>))}
        </select>
      </label>
    </div>);
}
