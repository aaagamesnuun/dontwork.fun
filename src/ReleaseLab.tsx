import { t as _t, textValue as _text } from "./i18n";
import { configure, type Run, type Settings } from './game/engine';
import { HAND_TOYS } from './HandToy';
import type { Change } from './App';
export function ReleaseLab({ s, change, onWorkMode }: {
    s: Run;
    change: Change;
    onWorkMode?: (mode: Settings["workMode"], dockToy?: Settings["dockToy"]) => void;
}) {
    const set = (patch: Partial<Settings>) => change(run => configure(run, patch));
    return <section className="settings-section release-lab"><h3>{_t("画面・遊び方の比較")}</h3>
 <label className="setting-row"><span>{_t("ジャックポット条件")}<small>{_t("連続モードは91以上が続く間、2回目以降毎回発動。")}</small></span><select value={s.settings.jackpotRule} onChange={e => set({ jackpotRule: e.target.value as Settings['jackpotRule'] })}><option value="combined">{_t("100 または 91以上を2回連続 · 標準")}</option><option value="hundred">{_t("100だけで発動")}</option><option value="double-high">{_t("91以上を2回連続")}</option></select></label>
 <label className="setting-row"><span>{_t("前回Jackpotからのスピン数")}</span><input type="checkbox" checked={s.settings.showJackpotCounter} onChange={e => set({ showJackpotCounter: e.target.checked })}/></label>
 <label className="setting-row"><span>{_t("撮影モード")}<small>{_t("資産・スピン・チャートを大きく表示。ギャンブルと強化は「操作」から開けます。")}</small></span><input type="checkbox" checked={s.settings.captureMode} onChange={e => set({ captureMode: e.target.checked })}/></label>
 <p className="setting-note">{_t("出目を指定して撮るなら、")}<a href="/?studio=1" target="_blank" rel="noopener">{_t("撮影スタジオを開く ↗")}</a></p>
 <label className="setting-row"><span>{_t("画面の構成")}</span><select value={s.settings.workspaceMode} onChange={e => set({ workspaceMode: e.target.value as Settings['workspaceMode'] })}><option value="desk">{_t("1画面 · 標準")}</option><option value="tabs">{_t("旧タブ式 · チャート／ポジション／強化")}</option></select></label>
 <label className="setting-row"><span>{_t("チャートも常時表示")}<small>{_t("強化やコインフリップを開いても資産の動きが見える。")}</small></span><input type="checkbox" checked={s.settings.sharedChart} onChange={e => set({ sharedChart: e.target.checked })}/></label>
 <label className="setting-row"><span>{_t("ギャンブルの確率表示")}</span><select value={s.settings.oddsDisplay} onChange={e => set({ oddsDisplay: e.target.value as Settings['oddsDisplay'] })}><option value="percent">{_t("パーセント")}</option><option value="fraction">{_t("期待値 = 配当 × 勝率 − 賭け金")}</option></select></label>
 <label className="setting-row"><span>{_t("ギャンブル別の確率強化")}<small>{_t("各ギャンブルの当たり出目を購入で増やす。")}</small></span><input type="checkbox" checked={s.settings.probabilityUpgrades} onChange={e => set({ probabilityUpgrades: e.target.checked })}/></label>
 <label className="setting-row"><span>{_t("全タブにスピンを表示")}<small>{_t("旧タブ式でも決着が見える。1画面では常に表示。")}</small></span><input type="checkbox" checked={s.settings.sharedSpin} onChange={e => set({ sharedSpin: e.target.checked })}/></label>
 <label className="setting-row"><span>{_t("スピン表示のサイズ")}<small>{_t("すべてのタブで同じ表示にします。")}</small></span><select value={s.settings.spinSize} onChange={e => set({ spinSize: e.target.value as Settings['spinSize'] })}><option value="compact">{_t("コンパクト · 標準")}</option><option value="expanded">{_t("ゆったり · 旧チャート画面のサイズ")}</option></select></label>
 <label className="setting-row"><span>{_t("Payoff Sweepの形")}</span><select value={s.settings.payoffStyle} onChange={e => set({ payoffStyle: e.target.value as Settings['payoffStyle'] })}><option value="classic">{_t("配当と支払いを上下に配置 · 標準")}</option><option value="net">{_t("PE · 純損益の箱")}</option><option value="chart">{_t("配当と支払のチャート")}</option></select></label>
 <label className="setting-row"><span>{_t("資産に合わせたデザイン")}</span><select value={s.settings.wealthTheme} onChange={e => set({ wealthTheme: e.target.value as Settings['wealthTheme'] })}><option value="fixed">{_t("固定 · 標準")}</option><option value="tiers">{_t("資産が増えると色が変わる")}</option><option value="drawdown">{_t("資産の成長＋大幅下落")}</option></select></label>
 <label className="setting-row"><span>{_t("相場で音楽を変える")}<small>{_t("音楽ON時に成長段階で曲を変更。最高資産から50%以上減ると静かな曲へ。")}</small></span><input type="checkbox" checked={s.settings.adaptiveMusic} onChange={e => set({ adaptiveMusic: e.target.checked })}/></label>
 <label className="setting-row"><span>{_t("手遊びを試す")}<small>{_t("WORKボタンをTAP・BEAT・CHARGEに変更します。")}</small></span><input type="checkbox" checked={s.settings.handToys} onChange={e => set({ handToys: e.target.checked, dockToy: "off" })}/></label>
 {s.settings.handToys && <div className="hand-toy-options" role="group" aria-label={_t("手遊びを選ぶ")}>{([["off", "WORK", _t("連打で稼ぐ")], ...HAND_TOYS] as const).map(([dockToy, label, description]) => <button key={dockToy} aria-pressed={s.settings.dockToy === dockToy && !s.coinEnabled} onClick={() => onWorkMode ? onWorkMode("click", dockToy) : change(run => ({ ...configure(run, { dockToy, workMode: "click" }), coinEnabled: false }))}>{_text(label)}<small>{_text(description)}</small></button>)}</div>}
 <label className="setting-row"><span>{_t("WORKの方式")}<small>{_t("ギャンブル方式は毎回コスト$0・配当$5。容量制限はOFFになります。")}</small></span><select value={s.settings.workMode} onChange={e => onWorkMode ? onWorkMode(e.target.value as Settings["workMode"]) : set({ workMode: e.target.value as Settings["workMode"] })}><option value="click">{_t("連打で+$1")}</option><option value="gamble">{_t("連打なし · WORKギャンブル")}</option></select></label>
 <label className="setting-row"><span>{_t("WORKのコスメ強化")}<small>{_t("強化画面でクリック音を解放。稼げる額は変わらない。")}</small></span><input type="checkbox" checked={s.settings.workCosmetics} onChange={e => set({ workCosmetics: e.target.checked })}/></label>
 <label className="setting-row"><span>{_t("アップグレードの案内")}</span><select value={s.settings.upgradeTutorial} onChange={e => set({ upgradeTutorial: e.target.value as Settings['upgradeTutorial'] })}><option value="money">{_t("$100に到達")}</option><option value="scripted">{_t("5スピン後")}</option></select></label>
 </section>;
}
export const wealthStage = (s: Run) => s.settings.wealthTheme === 'fixed' ? 'fixed' : s.settings.wealthTheme === 'drawdown' && s.peak >= 1000 && s.cash <= s.peak * 0.5 ? 'drawdown' : s.cash >= 1e8 ? 'billion' : s.cash >= 1e6 ? 'million' : s.cash >= 1e4 ? 'rising' : 'starting';
export const musicForWealth = (s: Run) => !s.settings.adaptiveMusic ? s.settings : { ...s.settings, musicPack: (s.peak >= 1000 && s.cash <= s.peak * 0.5 ? 'night' : s.cash >= 1e6 ? 'arcade' : 'pulse') as Settings['musicPack'] };
