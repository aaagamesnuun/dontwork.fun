import { t as _t, textValue as _text } from "./i18n";
import { useEffect, useState } from "react";
import { configure, defaultSettings, money, priceProfile, upgradePrice, type Run, type Settings, } from "./game/engine";
import type { Change } from "./App";
const fields = [
    ["positionPriceBase", "ポジション数の初期価格", 1, 1e9, 1],
    ["positionPriceMultiplier", "ポジション数の上昇倍率", 1, 30, 0.1],
    ["speedPriceBase", "スピン周期の初期価格", 1, 1e6, 1],
    ["speedPriceMultiplier", "スピン周期の上昇倍率", 1.01, 2, 0.01],
] as const;
type Key = (typeof fields)[number][0];
const values = (settings: Settings) => Object.fromEntries(fields.map(([k]) => [k, String(settings[k] ?? defaultSettings[k])])) as Record<Key, string>;
export function PriceLab({ s, change }: {
    s: Run;
    change: Change;
}) {
    const [draft, setDraft] = useState(() => values(s.settings)), [mode, setMode] = useState(s.settings.upgradePrices), [error, setError] = useState("");
    useEffect(() => {
        setDraft(values(s.settings));
        setMode(s.settings.upgradePrices);
    }, [
        s.settings.positionPriceBase,
        s.settings.positionPriceMultiplier,
        s.settings.speedPriceBase,
        s.settings.speedPriceMultiplier,
        s.settings.upgradePrices,
        s.settings.economyProfile,
    ]);
    const activeFields = fields.filter(([key]) => key === "positionPriceMultiplier"
        ? mode === "exponential"
        : key === "positionPriceBase"
            ? mode !== "legacy"
            : true);
    const patch = Object.fromEntries(activeFields.map(([k]) => [k, Number(draft[k])])) as Pick<Settings, Key>;
    const valid = activeFields.every(([key, , min, max, step]) => draft[key].trim() !== "" &&
        Number.isFinite(patch[key]) &&
        patch[key] >= min &&
        patch[key] <= max &&
        (step !== 1 || Number.isInteger(patch[key])));
    const preview = {
        ...s,
        settings: { ...s.settings, ...patch, upgradePrices: mode },
    };
    const disabled = s.settings.upgradeMode === "gacha";
    return (<section className="settings-section price-lab">
      <h3>{_t("強化価格の実験室")}</h3>
      <p className="setting-note">{_t("カット量8→9の価格は標準セットで$10M。ジャックポットスピン回数や他の強化価格は据え置きです。")}</p>
      <label className="setting-row">
        <span>{_t("全体の価格設定")}<small>{_t("レベル・購入済み総額はそのまま")}</small>
        </span>
        <select aria-label={_t("全体の価格設定")} value={s.settings.economyProfile} onChange={(e) => {
            const profile = e.target.value as Settings["economyProfile"];
            change((run) => configure(run, priceProfile(profile)));
            setError("");
        }}>
          <option value="v24">{_t("現在 · カット量8→9が$10M（標準）")}</option>
          <option value="v22">{_t("前回 · カット量8→9が$67M")}</option>
          <option value="v20">{_t("v2.0 · 従来の全アップグレード価格")}</option>
        </select>
      </label>
      <p className="setting-note">{_t("全項目と強化ガチャの価格に適用。切替時は下の個別調整も選んだ版の標準値に戻ります。")}</p>
      <form onSubmit={(e) => {
            e.preventDefault();
            if (!valid) {
                setError(_t("入力範囲を確認してください。"));
                return;
            }
            change((run) => configure(run, { ...patch, upgradePrices: mode }));
            setError("");
        }}>
        <label className="setting-row">
          <span>{_t("ポジション数の価格方式")}</span>
          <select value={mode} disabled={disabled} onChange={(e) => setMode(e.target.value as Settings["upgradePrices"])}>
            <option value="steep">{_t("段階式 · 標準")}</option>
            <option value="exponential">{_t("一定倍率 · 調整用")}</option>
            <option value="legacy">{_t("PE旧価格 · ポジションのみ")}</option>
          </select>
        </label>
        {fields.map(([key, label, min, max, step]) => (<label className="setting-row" key={key}>
            <span>
              {_text(label)}
              <small>
                {key === "positionPriceMultiplier"
                ? _t("一定倍率のときに適用") : key === "positionPriceBase" && mode === "steep"
                ? _t("全段階をこの初期価格に比例して調整") : `${min.toLocaleString()}〜${max.toLocaleString()}`}
              </small>
            </span>
            <input aria-label={label} type="number" min={min} max={max} step={step} value={draft[key]} disabled={disabled ||
                (key === "positionPriceMultiplier" && mode !== "exponential") ||
                (key === "positionPriceBase" && mode === "legacy")} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}/>
          </label>))}
        {valid && (<div className="price-preview">
            <p>{_t("ポジション数： {0}", Array.from({ length: 5 }, (_, i) => money(upgradePrice({ ...preview, slots: i + 1 }, "slots")!)).join(" → "))}</p>
            <p>{_t("スピン周期： {0}", s.catalog === "curated" ? _t("1秒固定 · 周期の強化なし") : Array.from({ length: 5 }, (_, i) => money(upgradePrice({ ...preview, speed: i }, "speed")!)).join(" → "))}</p>
          </div>)}
        {s.catalog === "longgame" && (<p className="setting-note">{_t("このセットのポジション価格には80倍の補正がかかります。")}</p>)}
        {disabled && (<p className="setting-note">{_t("ガチャだけの設定中です。この調整は直接購入にのみ適用されます。")}</p>)}
        {error && <p role="status">{_text(error)}</p>}
        <div className="button-row">
          <button className="primary" disabled={disabled || !valid}>{_t("この価格で試す")}</button>
          <button type="button" className="secondary" disabled={disabled} onClick={() => {
            setDraft(values(defaultSettings));
            setMode(defaultSettings.upgradePrices);
            change((run) => configure(run, Object.fromEntries([
                ...[
                    "economyProfile",
                    "upgradePrices",
                    ...fields.map(([key]) => key),
                ].map((key) => [
                    key,
                    defaultSettings[key as keyof Settings],
                ]),
            ]) as Partial<Settings>));
            setError("");
        }}>{_t("価格を標準に戻す")}</button>
        </div>
      </form>
    </section>);
}
