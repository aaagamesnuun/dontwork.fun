import { t as _t } from "./i18n";
import { useEffect, useState } from "react";
import { configure, type Run } from "./game/engine";
import type { Change } from "./App";
import { backgroundSupported } from "./backgroundPlay";
import { notificationsSupported } from "./jackpotNotifications";
import { sound, wakeAudio } from "./audio";

function TrialBackgroundNotice() {
    return <section className="settings-section"><h3>{_t("30分チャレンジは画面を開いて遊ぼう")}</h3><p>{_t("画面を離れると時計とスピンが止まります。戻ったら砂時計ボタンで再開してください。バックグラウンド進行は通常モードで利用できます。")}</p></section>;
}

export function NotificationSettings({s,change}:{s:Run;change:Change}) {
    const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
    const [permission,setPermission]=useState(() => notificationsSupported() ? Notification.permission : "default");
    useEffect(() => {
        const refresh=() => setPermission(notificationsSupported() ? Notification.permission : "default");
        window.addEventListener("focus",refresh); document.addEventListener("visibilitychange",refresh);
        return () => {window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
    },[]);
    const enable=async () => {
        if(busy || s.trial || !notificationsSupported())return;
        const runId=s.id;setBusy(true);setMessage("");
        try {
            const allowed=Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
            setPermission(allowed);
            if(allowed !== "granted") {
                setMessage(allowed === "denied" ? _t("通知は許可されていません。端末やブラウザの通知設定から変更できます。") : _t("通知をONにするには許可してください。"));
                return;
            }
            change(run => run.id===runId ? configure(run,{jackpotNotifications:true}) : run);
            setMessage(_t("ジャックポット通知をONにしました。"));
        } catch {setMessage(_t("ホーム画面に追加したアプリから開き、通知を許可してください。"));}
        finally {setBusy(false);}
    };
    if(s.trial)return <TrialBackgroundNotice/>;
    const enabled=s.settings.jackpotNotifications && permission==="granted";
    return <section className="settings-section">
        <h3>{_t("ジャックポットを通知で受け取りますか？")}</h3>
        <p>{_t("画面を離れている間にジャックポットが出たら、進行を止めてお知らせします。ゲームに戻ると再開します。")}</p>
        <p>{_t("通知は任意です。OFFでも、音をONにしていれば通常モードはバックグラウンドで進み、ジャックポットで止まります。")}</p>
        {enabled ? <button className="secondary" onClick={() => change(run=>configure(run,{jackpotNotifications:false}))}>{_t("ジャックポット通知をOFFにする")}</button> : <button className="primary" disabled={busy || !notificationsSupported()} onClick={() => void enable()}>{busy ? _t("確認中…") : _t("ジャックポット通知をONにする")}</button>}
        {!notificationsSupported() && <p className="setting-note">{_t("この環境では通知を利用できません。iPhone・iPadはホーム画面に追加したアプリから開いてください。")}</p>}
        <p className="setting-note">{_t("端末がアプリを休止した場合は、戻ったときに進行を反映します。休止中の即時通知・音の継続は保証されません。離席1回につき最大1時間・12,000スピンです。")}</p>
        {message && <p role="status">{message}</p>}
    </section>;
}

export function BackgroundSettings({s,change,lab=false}:{s:Run;change:Change;lab?:boolean}) {
    const setSound=(on:boolean) => {
        if(on)wakeAudio(true);
        change(run=>configure(run,{sound:on,...(on?{soundVolume:Math.max(.5,run.settings.soundVolume)}:{})}));
    };
    if(s.trial)return <TrialBackgroundNotice/>;
    return <section className="settings-section"><h3>{_t("音を聞きながら、画面を離れる")}</h3>
        <p>{_t("通常モードは音をONにすると、通知を許可しなくてもバックグラウンドで進みます。ジャックポットが出たら進行を止め、ゲームに戻ると再開します。")}</p>
        <label className="setting-row"><span>{_t("効果音をONにする")}<small>{_t("端末本体の音量も上げて、音が聞こえることを確認してください。")}</small></span><input type="checkbox" checked={s.settings.sound && s.settings.soundVolume>0} onChange={e=>setSound(e.target.checked)}/></label>
        <label className="setting-row"><span>{_t("音量")}<small>{Math.round(s.settings.soundVolume*100)}%</small></span><input type="range" min="0" max="1" step=".05" value={s.settings.soundVolume} onChange={e=>change(run=>configure(run,{soundVolume:Number(e.target.value)}))}/></label>
        <button className="secondary" onClick={()=>{wakeAudio(true);setSound(true);sound("win",{...s.settings,sound:true,soundVolume:Math.max(.5,s.settings.soundVolume)});}}>{_t("♫ 音を試す")}</button>
        <button className="secondary" disabled={!s.settings.backgroundPlay && !backgroundSupported()} onClick={()=>change(run=>configure(run,{backgroundPlay:!run.settings.backgroundPlay}))}>{s.settings.backgroundPlay ? _t("バックグラウンド進行をOFFにする") : _t("バックグラウンド進行をONにする")}</button>
        {s.settings.backgroundPlay && (!s.settings.sound || s.settings.soundVolume<=0) && <p role="status">{_t("音がOFFのため、背景進行は停止中です。")}</p>}
        {!backgroundSupported() && <p className="setting-note">{_t("この環境ではバックグラウンド進行を利用できません。")}</p>}
        {lab && <label className="setting-row"><span>{_t("大きな資産変動も通知")}<small>{_t("無音で通知。ジャックポット以外は最大1分に1回。")}</small></span><input type="checkbox" checked={s.settings.bigChangeNotifications} onChange={e=>change(run=>configure(run,{bigChangeNotifications:e.target.checked}))}/></label>}
        <NotificationSettings s={s} change={change}/>
    </section>;
}
