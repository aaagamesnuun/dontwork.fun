import { useEffect, useRef, useState } from 'react';
import type { AiSnapshot } from './aiApi';
import { AiResultSoundCursor, AiSoundCursor, spectatorSoundSettings, type AiLandingResult } from './aiSpectatorAudio';
import { installAudioRecovery, setAudioEnabled, setBackgroundAudio, sound, stopSounds, uiSound, wakeAudio, type Cue } from './audio';
import { defaultSettings, type Settings } from './game/engine';
import { SOUND_PACKS } from './SoundPackPicker';
import { t } from './i18n';

const PACK_KEY = 'dontwork-ai-sound-pack-v1';
function savedPack(): Settings['soundPack'] {
  try { const value = localStorage.getItem(PACK_KEY); return SOUND_PACKS.find(([id]) => id === value)?.[0] ?? defaultSettings.soundPack; }
  catch { return defaultSettings.soundPack; }
}

/** Viewer-only sound: never changes the AI's Run, connection or human save. */
export function useAiSpectatorSound(rawLatest: AiSnapshot | null, watching: boolean, result: AiLandingResult | null) {
  const [enabled, setEnabled] = useState(false), [pack, setPack] = useState(savedPack);
  const [played, setPlayed] = useState<{ cue: Cue; key: string } | null>(null);
  const [cursor] = useState(() => new AiSoundCursor());
  const [resultCursor] = useState(() => new AiResultSoundCursor());
  const resultRef = useRef(result);
  resultRef.current = result;
  const settings = useRef(spectatorSoundSettings(false, pack));
  settings.current = spectatorSoundSettings(enabled && watching, pack);
  useEffect(() => {
    setBackgroundAudio(false);
    setAudioEnabled(false);
    const cleanup = installAudioRecovery(() => settings.current);
    const visibility = () => { cursor.reset(); resultCursor.sync(resultRef.current); stopSounds(); setPlayed(null); };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); cleanup(); setAudioEnabled(false); };
  }, [cursor, resultCursor]);
  useEffect(() => {
    const audible = enabled && watching && !document.hidden;
    setAudioEnabled(audible);
    if (!rawLatest) { cursor.reset(); return; }
    const next = cursor.next(rawLatest, audible);
    // A received spin is deliberately silent until the yellow line lands.
    if (!next || next.kind !== 'action') return;
    uiSound(next.cue, settings.current);
    setPlayed({ cue: next.cue, key: `action:${rawLatest.id}:${rawLatest.version}` });
  }, [rawLatest, enabled, watching, cursor]);
  useEffect(() => {
    const next = resultCursor.next(result, enabled && watching && !document.hidden);
    if (!next || !result) return;
    sound(next.cue, settings.current, next.power, next.accent);
    setPlayed({ cue: next.cue, key: `result:${result.key}` });
  }, [result, enabled, watching, resultCursor]);
  const toggle = () => {
    const next = !enabled;
    cursor.sync(rawLatest);
    resultCursor.sync(result);
    // Update before the window-level gesture recovery sees this same click.
    settings.current = spectatorSoundSettings(next && watching, pack);
    setEnabled(next); setPlayed(null); setAudioEnabled(next && watching);
    if (next && watching) { wakeAudio(true); uiSound('toggle-on', settings.current); }
    else stopSounds();
  };
  const changePack = (next: Settings['soundPack']) => {
    settings.current = spectatorSoundSettings(enabled && watching, next);
    setPack(next);
    try { localStorage.setItem(PACK_KEY, next); } catch { /* Still usable without storage. */ }
    if (enabled && watching) { wakeAudio(true); uiSound('win', settings.current); }
  };
  return { enabled, pack, played, toggle, changePack };
}

export function AiSpectatorSound({ audio }: { audio: ReturnType<typeof useAiSpectatorSound> }) {
  return <section className="ai-sound-panel" aria-label={t('AI観戦のサウンド')} data-last-cue={audio.enabled ? audio.played?.cue : undefined}>
    <div className="ai-sound-controls">
      <button type="button" className="ai-sound-toggle" aria-pressed={audio.enabled} aria-label={t(audio.enabled ? '観戦の音をOFFにする' : '観戦の音をONにする')} onClick={audio.toggle}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5Z"/>{audio.enabled ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></> : <path d="m16 9 6 6m0-6-6 6"/>}</svg>
        {t(audio.enabled ? '音 ON' : '音をONにする')}
        {audio.enabled && <span key={audio.played?.key ?? 'ready'} className={`ai-audio-led ${audio.played ? 'is-playing' : ''}`} aria-hidden="true"/>}
      </button>
      {audio.enabled && <label>{t('サウンドパック')}<select value={audio.pack} onChange={event => audio.changePack(event.target.value as Settings['soundPack'])}>{SOUND_PACKS.map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}</select></label>}
    </div>
    {!audio.enabled && <p>{t('音をONにすると、AIのWORKやスピンの結果が聞こえます。')}</p>}
  </section>;
}
