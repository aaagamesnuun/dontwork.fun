import { t as _t, textValue as _text } from "./i18n";
import { JackpotHelp } from "./Onboarding";
import { COIN_UNLOCK_PEAK, money, type Run } from "./game/engine";
import type { Guidance } from "./game/guidance";
export function newsTopic(key: string) {
    if (key === "trial")
        return "trial";
    if (key === "jackpot-paused") return "spin";
    if (key === "jackpot" || key.startsWith("jackpot-") || key === "tip-3")
        return "jackpot";
    if (["first-work", "cash", "recover-cheaper", "fuel", "work-gamble"].includes(key))
        return "work";
    if (key.startsWith("second-bet-") || ["equip", "cheaper", "tip-2", "tip-4"].includes(key))
        return "positions";
    if (["first-upgrade", "tip-1"].includes(key))
        return "upgrades";
    if (key === "goal")
        return "goal";
    return "spin";
}
const content = {
    trial: ["現金＋強化への投資で、30分後の総資産を競う。", "AUTOがONの間は、賭け金不足でも時計が進み、WORKできます。OFFにすると時計・WORK・スピンが止まります。ギャンブル変更と強化購入はいつでもできます。", "通常モードのセーブは別に残ります。"],
    work: ["まずはWORKで資金を作ろう。", "WORKは1回で$1。連打して、セットしたギャンブルの賭け金を貯めます。", "LABでスピン容量をONにしているときは、WORKで容量も補充できます。WORKギャンブルのルールなら、コスト$0で毎スピン$5です。"],
    positions: ["＋でセット、−で外す。", "付け外しは無料。ジャックポット中に変えると、確認後に連鎖が終了します。ギャンブル数の上限に達したら、他のギャンブルを−で外して入れ替えます。同じギャンブルを複数セットすると、賭け金と配当も増えます。", "毎スピン、1〜100から引く数字は1つ。その同じ数字で、すべてのギャンブルの当たり・ハズレを判定します。"],
    upgrades: ["スピン周期を強化しよう。", "下の切り替えボタンで「アップグレード」を開き、スピン周期の価格ボタンを押すと購入できます。ギャンブル数を増やすと、同時にセットできる数が増えます。", "ジャックポットカット量は未強化なら0で、ジャックポット中だけ有効。連鎖が重なるたびにカットする低い出目を増やします。"],
    goal: ["総資産を伸ばして、新しいギャンブルへ。", "解放の基準は到達した最高資産です。その後に資産が減っても、解放したギャンブルは使えます。ギャンブルで編成を試して、$1Bを目指しましょう。"],
    spin: ["AUTOをONにすると、自動でスピン。", "チャージが完了すると黄色い線が動き、最後に止まった数字で結果が決まります。青は利益、赤は損失。棒の高さは金額の大きさです。", "チャートの最新結果は右端。WORKの増加も、次のスピンでチャートに合流します。黄色い丸はアップグレードへの支出です。"],
};
export function NewsHelp({ s, guide }: {
    s: Run;
    guide: Guidance;
}) {
    const topic = newsTopic(guide.key);
    const lines = topic === "upgrades" && s.settings.upgradeMode === "gacha" ? [_t("強化ガチャで、スピンを育てよう。"), _t("「アップグレード」を開いて強化ガチャを引くと、未MAXの強化のどれかが1段階上がります。引くたびに価格が上がります。"), content.upgrades[2]] : topic === "spin" && s.settings.payoffStyle !== "net" ? [content.spin[0], _t("チャージが完了すると黄色い線が動き、最後に止まった数字で結果が決まります。青は配当、赤は支払い。配当が支払いを超えると資産が増えます。"), content.spin[2]] : topic !== "jackpot" ? content[topic] : [];
    return <div className="game-help"><p className="help-news">{_text(guide.text)}</p>{topic === "jackpot" ? <JackpotHelp discovered={s.infinityAt !== null} rule={s.settings.jackpotRule}/> : lines.map((text, i) => i === 0 ? <h3 key={text}>{_text(text)}</h3> : <p key={text}>{_text(text)}</p>)}</div>;
}
export function GameHelp({ s }: {
    s: Run;
}) {
    return <div className="game-help"><h3>{_t("WORK → ギャンブル → AUTO")}</h3><p>{_t("WORKを連打して資金を貯め、ギャンブルの＋でギャンブルをセット。AUTOをONにするとスピンが始まります。")}</p><p>{_t("1つの共通の数字で、セットしたすべてのギャンブルが決着。稼いだお金でスピン周期やギャンブル数を強化し、$1Bを目指そう。")}</p><h3>JACKPOT</h3><JackpotHelp discovered={s.infinityAt !== null} rule={s.settings.jackpotRule}/>{s.settings.coinFlip && <><h3>{_t("コインフリップ")}</h3><p>{_t("最高資産が{0}を超えると解放。一度解放すると、資産が減っても使えます。", money(COIN_UNLOCK_PEAK))}</p><p>{_t("下の切り替えボタンから開き、スイッチをONにするとWORKがFLIPに変わります。1/2で賭け金の2倍を獲得、ハズレは0。スピン中やジャックポット中も投げられます。")}</p><p>{_t("コインの賭け金は10、100、1K…から選択。スピンの賭け金を確保した残りで遊べます。")}</p></>}</div>;
}
