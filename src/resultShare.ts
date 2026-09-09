import { t as _t } from "./i18n";
import { catalogById } from './game/catalog';
import { duration, money, type Run } from './game/engine';
import { completionTarget } from './rankingOutbox';
import { effortStats } from "./ResultCard";
import { chartGeometry } from './TradingViews';
export function resultShareText(s: Run, name: string) {
    if(s.trial?.result)return _t("{0} · dontwork.fun 30分チャレンジ\n総資産 {1} / WORK {2}回\n#dontwork",name,money(s.trial.result.finalBankroll),s.work);
    return _t("{0} · dontwork.funで{1}達成！\n{2} / {3}\n#dontwork", name, money(completionTarget(s)), duration(s.completion?.timeMs ?? s.clearActiveMs ?? s.activeMs), catalogById(s.completion?.catalog ?? s.catalog).name);
}
export const RESULT_POST_URL = 'https://x.com/realnuun/status/2096932115355197897';
export function resultXIntent(s: Run, name: string) {
    const url = new URL('https://x.com/intent/tweet');
    url.searchParams.set('text', resultShareText(s, name));
    url.searchParams.set('url', RESULT_POST_URL);
    return url.toString();
}
// The exported card uses the same frozen completion snapshot and chart geometry
// as the screen. No live game values or external screenshot service are needed.
export async function resultImage(s: Run, name: string): Promise<Blob> {
    const trial=s.trial?.result, effort=effortStats(s);
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw Error(_t("画像を作成できませんでした。"));
    ctx.fillStyle = '#10180f';
    ctx.fillRect(0, 0, 900, 1200);
    const glow = ctx.createRadialGradient(720, 90, 0, 720, 90, 850);
    glow.addColorStop(0, '#3a4f27');
    glow.addColorStop(1, '#10180f');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 900, 1200);
    ctx.strokeStyle = '#647b43';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 852, 1152);
    const text = (value: string, x: number, y: number, size: number, color = '#edf6e8', align: CanvasTextAlign = 'left') => { ctx.textAlign = align; ctx.fillStyle = color; ctx.font = `600 ${size}px system-ui, sans-serif`; ctx.fillText(value, x, y, 800); };
    text('dontwork.fun', 54, 94, 32);
    text(trial?'TIME UP':'GOAL CLEARED', 846, 94, 19, '#cfefa0', 'right');
    text(trial?'FINAL ASSETS':'FROM $0 TO', 450, 200, 23, '#aebb9b', 'center');
    text(money(trial?.finalBankroll??completionTarget(s)), 450, 334, 132, '#d3ff93', 'center');
    text(name, 450, 418, 44, '#ffffff', 'center');
    text(duration(trial?.durationMs??s.completion?.timeMs ?? s.clearActiveMs ?? s.activeMs), 450, 514, 59, '#ffffff', 'center');
    text(trial?_t("30分チャレンジ"):_t("クリア時間"), 450, 552, 22, '#b9c8aa', 'center');
    const plot = chartGeometry(s, 'all'), x = (v: number) => 54 + (v - 6) / 988 * 792, y = (v: number) => 606 + (v - 16) / 162 * 270;
    ctx.strokeStyle = '#35462d';
    ctx.lineWidth = 1;
    for (let row = 0; row <= 4; row++) {
        const yy = 606 + row * 67.5;
        ctx.beginPath();
        ctx.moveTo(54, yy);
        ctx.lineTo(846, yy);
        ctx.stroke();
    }
    ctx.strokeStyle = '#8dffc1';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    plot.coords.forEach((p, i) => i ? ctx.lineTo(x(p.x), y(p.y)) : ctx.moveTo(x(p.x), y(p.y)));
    ctx.stroke();
    ctx.fillStyle = '#ffe082';
    for (const p of plot.upgrades) {
        ctx.beginPath();
        ctx.arc(x(p.x), y(p.top), 5, 0, Math.PI * 2);
        ctx.fill();
    }
    if(s.settings.coinChartMarkers)for(const p of plot.coins){ctx.beginPath();ctx.fillStyle="#edbd62";ctx.arc(x(p.x),y(p.y),5,0,Math.PI*2);ctx.fill();}
    text('0', 54, 910, 20, '#adbd9d');
    text(trial?duration(trial.durationMs):`${s.clearSpins ?? s.spins} SPINS`, 846, 910, 20, '#adbd9d', 'right');
    for (const [i, value, label] of [[0, (s.clearSpins ?? s.spins).toLocaleString(), _t("スピン")], [1, s.maxChain.toLocaleString(), _t("最大連鎖")], [2, money(s.spent), _t("強化への投資")], [3, effort.work, _t("WORK回数")], [4, effort.wager, _t("FLIPの賭け金累計")], [5, effort.profit, _t("FLIPの損益")]] as const) {
        const xx = 170 + (i % 3) * 280, yy = i < 3 ? 972 : 1052;
        text(value, xx, yy, 29, '#edf6e8', 'center');
        text(label, xx, yy + 29, 18, '#adbd9d', 'center');
    }
    text(catalogById(s.completion?.catalog ?? s.catalog).name, 54, 1125, 22, '#adbd9d');
    text((trial?.ranked??s.completion?.ranked) ? 'dontwork.fun' : 'LAB RECORD · dontwork.fun', 846, 1125, 20, '#cfefa0', 'right');
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error(_t("画像を作成できませんでした。"))), 'image/png'));
}
export function downloadResult(blob: Blob) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = 'dontwork.fun-clear.png';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
