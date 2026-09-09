import { t as _t, textValue as _text } from "./i18n";
import { BANKNOTES, type BanknoteStyle } from "./banknotes";
export function BanknotePicker({ value, onChange }: {
    value: BanknoteStyle;
    onChange: (value: BanknoteStyle) => void;
}) {
    return <fieldset className="banknote-picker">
    <legend>{_t("お札のデザイン")}</legend>
    <p className="setting-note">{_t("当たりで舞う紙幣に反映されます。少額はコイン、大きい当たりは札束になります。")}</p>
    <div className="banknote-options">
      <label className="banknote-option">
        <input type="radio" name="banknote-style" value="random" checked={value === "random"} onChange={() => onChange("random")}/>
        <div className="banknote-mix">{BANKNOTES.map(note => <img key={note.id} src={note.src} alt="" width="256" height="112" loading="lazy"/>)}</div>
        <span>{_t("3種類ランダム")}<small>{_t("標準")}</small></span>
        <small>{_t("1枚ごとにデザインが変わる")}</small>
      </label>
      {BANKNOTES.map(note => <label className="banknote-option" key={note.id}>
        <input type="radio" name="banknote-style" value={note.id} checked={value === note.id} onChange={() => onChange(note.id)}/>
        <img src={note.src} alt="" width="256" height="112" loading="lazy"/>
        <span>{_text(note.label)}</span>
        <small>{_text(note.description)}</small>
      </label>)}
    </div>
  </fieldset>;
}
