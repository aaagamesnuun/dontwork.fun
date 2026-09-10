import { t as _t } from "./i18n";
import { defaultSettings, freshRun, work, setCount, purchase, spin, canSpin, rollFloor, type Run } from './game/engine';
export const CAPTURE_SAVE_KEY = 'dontwork-capture-studio-v1';
export const CAPTURE_CONFIG_KEY = 'dontwork-capture-config-v1';
export type CaptureSceneId = 'work' | 'select' | 'early' | 'upgrade' | 'choose' | 'growth' | 'finale';
export type CaptureScene = {
    id: CaptureSceneId;
    name: string;
    description: string;
    initialRun: Run;
    rolls: number[];
};
export type CaptureSession = {
    initialRun: Run;
    rolls: readonly number[];
    controlsOpen?: boolean;
    onSettings: () => void;
    onState?: (run: Run) => void;
};
export function recordingRun(run: Run): Run {
    return { ...run, debug: true, telemetry: false, trial: null, background: null,
        settings: { ...run.settings, captureMode: true, backgroundPlay: false, jackpotNotifications: false } };
}
// All checkpoints are paid for and settled through the normal game engine.
// A studio controls rolls, while payouts, purchases and history stay native.
export function captureScenes(): Record<CaptureSceneId, CaptureScene> {
    let run = recordingRun(freshRun('classic', { ...defaultSettings, captureMode: true, backgroundPlay: false,
        assist: false, chartWindowSpins: 12, impactFlash: 'off', shake: 'light', winVisual: 'cash', jackpotVisual: 'cash',
        sound: true, music: false, chartAxis: 'spins' }));
    run = { ...run, commonRollExplained: true };
    const scenes = {} as Record<CaptureSceneId, CaptureScene>;
    const checkpoint = (id: CaptureSceneId, name: string, description: string, rolls: number[]) => {
        scenes[id] = { id, name, description, initialRun: { ...structuredClone(run), running: false, last: null }, rolls };
    };
    checkpoint('work', _t("WORKから"), _t("20回のWORKで、最初の資金を貯めます。"), []);
    for (let i = 0; i < 20; i++)
        run = work(run);
    checkpoint('select', _t("最初のギャンブル"), _t("BASELINEを装備する場面。"), []);
    run = setCount(run, 'edge-50', 1);
    const early = [75, 25, 75, 35, 25, 75, 65, 85, 45, 75, 65, 35, 85, 75, 65, 25, 75, 85, 65, 35, 75, 65, 85, 25, 75, 65, 85, 45, 75, 85];
    for (let i = 0; i < early.length; i++) {
        if (i === 4)
            checkpoint('early', _t("当たりと外れ"), _t("資産が減る場面と、増える場面を続けて撮れます。"), [...early.slice(i)]);
        run = spin(run, early[i]);
    }
    checkpoint('upgrade', _t("アップグレード"), _t("ギャンブル数を1から2へ。購入すると資産もチャートも下がります。"), []);
    run = purchase(run, 'slots');
    checkpoint('choose', _t("ギャンブルを追加"), _t("空いた枠にQUARTER EDGEを追加します。"), []);
    run = setCount(run, 'edge-25', 1);
    checkpoint('growth', _t("資産が伸びる場面"), _t("少ない元手に、2回の大きな当たりが積み重なります。"), [83, 88]);
    run = spin(spin(run, 83), 88);
    run = purchase(run, 'speed');
    checkpoint('finale', _t("通常スピンから2連鎖"), _t("通常の勝敗、95→97でJP、約5秒後に92→96で2連鎖。"), [24, 83, 43, 88, 66, 95, 97, 37, 28, 42, 19, 83, 64, 89, 53, 82, 31, 78, 44, 68, 87, 92, 96]);
    return scenes;
}
export function parseCaptureRolls(text: string): number[] {
    if (!text.trim())
        return [];
    const parts = text.trim().split(/[\s,、]+/);
    if (parts.length > 300 || parts.some(p => !/^\d+$/.test(p)))
        throw Error(_t("出目は1〜100の整数を、カンマで区切って入力してください（300回まで）。"));
    const rolls = parts.map(Number);
    if (rolls.some(n => n < 1 || n > 100))
        throw Error(_t("出目は1〜100で指定してください。"));
    return rolls;
}
export function validateCaptureRolls(initialRun: Run, rolls: readonly number[]) {
    let run = recordingRun(initialRun);
    for (let i = 0; i < rolls.length; i++) {
        if (!canSpin(run))
            break; // Bankruptcy is an allowed end to a filming scene.
        if (rolls[i] < rollFloor(run))
            throw Error(_t("{0}回目はカット範囲内です。{1}以上を指定してください。", i + 1, rollFloor(run)));
        run = spin(run, rolls[i]);
    }
    return run;
}
export function captureSpin(run: Run, session: Pick<CaptureSession, 'initialRun' | 'rolls'>): Run {
    const index = run.spins - session.initialRun.spins;
    if (index < 0 || index >= session.rolls.length || !canSpin(run))
        return { ...recordingRun(run), running: false };
    const value = session.rolls[index];
    if (!Number.isInteger(value) || value < rollFloor(run) || value > 100)
        return { ...recordingRun(run), running: false };
    const next = spin(recordingRun(run), value, 0);
    return { ...next, running: next.running && index + 1 < session.rolls.length };
}
