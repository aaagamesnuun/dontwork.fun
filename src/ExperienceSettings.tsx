import { useState } from 'react';
import { t } from './i18n';
import { LookPicker } from './LookExperience';
import { SoundPackPicker } from './SoundPackPicker';
import { MusicSettings } from './MusicSettings';
import { NativeSwitch } from './NativeSwitch';
import { configure, type Run } from './game/engine';
import { soundPackSettings } from './soundPresets';
import { audioEnabled, setAudioEnabled, uiSound, wakeAudio } from './audio';
import type { Change } from './App';

export function ExperienceIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 3v7m0 4v7M12 3v12m0 4v2M19 3v2m0 4v12"/><path d="M2 10h6v4H2zm7 5h6v4H9zm7-10h6v4h-6z"/></svg>;
}

export function ExperienceSettings({ s, change, onAudioSettings }: { s: Run; change: Change; onAudioSettings: () => void }) {
  const [panel, setPanel] = useState<'look' | 'sound'>('look');
  return <section className="experience-settings">
    <nav className="experience-tabs" aria-label={t('設定の切り替え')}>
      <button type="button" aria-pressed={panel === 'look'} onClick={() => setPanel('look')}>{t('見た目')}</button>
      <button type="button" aria-pressed={panel === 'sound'} onClick={() => setPanel('sound')}>{t('サウンド')}</button>
    </nav>
    {panel === 'look' ? <>
      <label className="random-look-setting"><input type="checkbox" checked={s.settings.randomLookOnOpen} onChange={event => { const checked = event.target.checked; change(run => configure(run, { randomLookOnOpen: checked })); }}/><span>{t('起動するたびに見た目をランダムにする')}<small>{t('次にページやアプリを開き直した時に変更します。プレイ中は変わりません。')}</small></span></label>
      <LookPicker value={s.settings.look} onChange={look => change(run => configure(run, { look }))}/>
    </> : <>
      <label className="setting-row"><span>{t('効果音')}</span><NativeSwitch label={t('効果音')} checked={s.settings.sound} tactile={s.settings.haptics} onChange={sound => {
        change(run => configure(run, { sound })); setAudioEnabled(audioEnabled({ ...s.settings, sound })); if (sound) wakeAudio(true);
      }}/></label>
      <SoundPackPicker value={s.settings.soundPack} onChange={soundPack => {
        const patch = soundPackSettings(soundPack); change(run => configure(run, patch)); uiSound('win', { ...s.settings, ...patch });
      }}/>
      <MusicSettings s={s} change={change}/>
      <button className="secondary" onClick={onAudioSettings}>{t('音量・振動の設定 →')}</button>
    </>}
  </section>;
}
