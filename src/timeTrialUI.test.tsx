import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {TrialClock,TrialControl,TrialResult,TrialModes} from './TimeTrial';
import {advanceTrial,freshTrial,resumeTrial,TRIAL_MS} from './game/engine';
describe('30 minute controls',()=>{
 it('shows the countdown and explicit start, then pause and resume controls',()=>{
  const run=freshTrial();expect(render(<TrialClock s={run} onToggle={()=>{}} onResult={()=>{}}/>)).toContain('30:00');
  expect(render(<TrialClock s={run} onToggle={()=>{}} onResult={()=>{}}/>)).toContain('開始');
  expect(render(<TrialClock s={resumeTrial(run,1000)} onToggle={()=>{}} onResult={()=>{}}/>)).toContain('残り時間');
  const paused=render(<TrialControl s={run} onToggle={()=>{}} onResult={()=>{}}/>);
  expect(paused).toContain('砂時計：時間を開始・再開');expect(paused).not.toContain('AUTO');
  const playing=render(<TrialControl s={resumeTrial(run,1000)} onToggle={()=>{}} onResult={()=>{}}/>);
  expect(playing).toContain('砂時計：時間を一時停止');expect(playing).toContain('aria-pressed="true"');
 });
 it('explains pauses permit upgrades and positions and separates LAB variants',()=>{
  const html=render(<TrialModes s={freshTrial()} onSwitch={()=>{}} lab/>);expect(html).toContain('ギャンブル変更と強化購入はいつでもできます');expect(html).toContain('LAB · 時間を買える30分');expect(html).toContain('標準ランキング対象外');
 });
 it('renders a final score with chart and an offline retry after naming',()=>{
  let s=advanceTrial({...resumeTrial(freshTrial(),1000),cash:1e100,peak:1e100},TRIAL_MS+1000);s={...s,trial:{...s.trial!,nickname:'NUUN'}};
  const html=render(<TrialResult s={s} onChange={()=>{}} onRanking={()=>{}} onRetry={()=>{}} onNormal={()=>{}}/>);
  expect(html).toContain('FINAL ASSETS');expect(html).toContain('NUUN');expect(html).toContain('ランキングへ再送');expect(html).toContain('<svg');expect(html).not.toContain('NaN');
 });
});
