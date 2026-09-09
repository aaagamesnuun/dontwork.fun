import { t as _t } from "./i18n";
import { useState } from "react";
import { configure, type Run } from "./game/engine";
import type { Change } from "./App";
import { backgroundSupported } from "./backgroundPlay";
import { notificationsSupported } from "./jackpotNotifications";
import { wakeAudio } from "./audio";
export function BackgroundSettings({ s, change }: {
    s: Run;
    change: Change;
}) {
    const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const enable = async () => {
        wakeAudio(true);
        setBusy(true);
        setMessage("");
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setMessage(permission === "denied" ? _t("通知は許可されていません。端末やブラウザの通知設定から変更できます。") : _t("通知をONにするには許可してください。"));
                return;
            }
            change(run => configure(run, { backgroundPlay: true, jackpotNotifications: true, sound: true, soundVolume: Math.max(.5, run.settings.soundVolume) }));
            setMessage(_t("通知・サウンド・バックグラウンド進行をONにしました。"));
        }
        catch {
            setMessage(_t("ホーム画面に追加したアプリから開き、通知を許可してください。"));
        }
        finally {
            setBusy(false);
        }
    };
    const permitted = notificationsSupported() && Notification.permission === "granted";
    const enabled = s.settings.backgroundPlay && permitted && s.settings.sound && s.settings.soundVolume > 0;
    return <section className="settings-section"><h3>{_t("音を聞きながら、画面を離れる")}</h3>
    <p>{_t("通知とサウンドを有効にして、他のアプリを開いている間もAUTOを続けます。ジャックポットが出たら進行を一時停止。通知からゲームに戻ると再開します。")}</p>
    <button className="primary" disabled={busy || (!s.settings.backgroundPlay && (!backgroundSupported() || !notificationsSupported()))} onClick={() => s.settings.backgroundPlay ? change(run => configure(run, { backgroundPlay: false })) : void enable()}>{busy ? _t("確認中…") : s.settings.backgroundPlay ? _t("バックグラウンド進行をOFFにする") : _t("通知と音をONにして使う")}</button>
    {s.settings.backgroundPlay && !enabled && <p role="status">{_t("音または通知がOFFのため、背景進行は停止中です。")}</p>}
    <p className="setting-note">{_t("LAB機能です。通知の許可と効果音ONが必要です。iPhone・iPadはホーム画面に追加してから開いてください。")}</p>
    <label className="setting-row"><span>{_t("大きな資産変動も通知")}<small>{_t("無音で通知。ジャックポット以外は最大1分に1回。")}</small></span><input type="checkbox" checked={s.settings.bigChangeNotifications} onChange={e => change(run => configure(run, { bigChangeNotifications: e.target.checked }))}/></label>
    <p className="setting-note">{_t("端末がアプリを休止した場合は、戻ったときに進行を反映します。休止中の即時通知・音の継続は保証されません。離席1回につき最大1時間・12,000スピンです。")}</p>
    {(!backgroundSupported() || !notificationsSupported()) && <p className="setting-note">{_t("この環境ではバックグラウンド進行を利用できません。")}</p>}
    {message && <p role="status">{_t(message)}</p>}
  </section>;
}
