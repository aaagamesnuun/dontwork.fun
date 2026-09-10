import {t} from './i18n';
import type {Run} from './game/engine';

// Pausing an existing run is not the same as never having started it.
export function prestartMode(s:Run,unlocked:boolean):'normal'|'trial'|null {
  if(!unlocked || s.running || s.background || s.completion || s.clearAt!==null)return null;
  if(s.trial)return !s.trial.started && s.trial.elapsedMs===0 && s.trial.anchor===null && !s.trial.result ? 'normal' : null;
  return s.startedAt===null && s.work===0 && s.spins===0 ? 'trial' : null;
}
export function ModeSwitchNotice({target,onSwitch,onDismiss}:{target:'normal'|'trial';onSwitch:(mode:'normal'|'trial')=>void;onDismiss:()=>void}) {
  return <div className="toast mode-start-notice">
    <button className="mode-start-choice" onClick={()=>onSwitch(target)}>{t(target==='trial'?'30分モードで遊ぶ':'通常モードで遊ぶ')}<span aria-hidden="true">→</span></button>
    <button className="mode-start-dismiss" onClick={onDismiss} aria-label={t('モード切り替えの案内を閉じる')}>×</button>
  </div>;
}
