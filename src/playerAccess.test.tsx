import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { freshRun, freshTrial, finish, readSave, TARGET, TRIAL_MS, resumeTrial, advanceTrial, SAVE_KEY } from './game/engine';
import { trialUnlocked, rememberTrialUnlock } from './trialUnlock';
import { switchTrialMode, NORMAL_SLOT, TRIAL_SLOT } from './trialSaves';
import { MusicSettings } from './MusicSettings';
import { GameHelp } from './GameHelp';
import { guidance } from './game/guidance';
import { ALL_BETS } from './game/catalog';
import { setBetNameStyle } from './betNamePreferences';
import { resultXIntent, resultShareText, RESULT_POST_URL } from './resultShare';
const memory = () => { const values = new Map<string,string>(); return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}; };
afterEach(()=>{vi.unstubAllGlobals();setBetNameStyle('english')});
describe('player access and saved choices',()=>{
 it('unlocks the timed challenge only after a clear or an explicit LAB unlock, and remembers it after restarting',()=>{
  const storage=memory(),run=freshRun();
  expect(trialUnlocked(run,storage)).toBe(false);
  expect(trialUnlocked({...run,cash:TARGET,peak:TARGET},storage)).toBe(false);
  expect(trialUnlocked(finish({...run,cash:TARGET}),storage)).toBe(true);
  rememberTrialUnlock(storage);expect(trialUnlocked(freshRun(),storage)).toBe(true);
 });
 it('preserves existing clear records and timed-mode access and keeps the normal save when starting a challenge',()=>{
  const storage=memory();vi.stubGlobal('localStorage',storage);
  const clear=finish({...freshRun(),cash:TARGET,work:123,completionNickname:'Player'});
  storage.setItem(NORMAL_SLOT,JSON.stringify(clear));
  expect(trialUnlocked(freshRun(),storage)).toBe(true);
  const next=switchTrialMode(clear,'trial');
  expect(next.trial).toMatchObject({started:false,paused:true,elapsedMs:0});
  expect(readSave(storage.getItem(NORMAL_SLOT))).toMatchObject({id:clear.id,completion:clear.completion,work:123});
  expect(readSave(storage.getItem(SAVE_KEY))?.id).toBe(next.id);
  const legacy=memory();legacy.setItem(TRIAL_SLOT,JSON.stringify(freshTrial()));expect(trialUnlocked(freshRun(),legacy)).toBe(true);
 });
 it('removes the four recorded tracks without discarding a selected-track save',()=>{
  const run={...freshRun(),cash:12345,peak:12345,work:42};
  for(const musicPack of ['bit-quest','pixelland','cipher','envision']){
   expect(readSave(JSON.stringify({...run,settings:{...run.settings,musicPack,music:true,jackpotMusic:'on'}}))).toMatchObject({id:run.id,cash:12345,work:42,settings:{music:false,musicPack:'pulse',jackpotMusic:'follow'}});
  }
  const html=renderToStaticMarkup(<MusicSettings s={freshRun()} change={()=>{}}/>);
  for(const word of ['bit-quest','pixelland','cipher','envision','Kevin MacLeod','背景再生'])expect(html).not.toContain(word);
  for(const pack of ['pulse','night','arcade'])expect(html).toContain(`value="${pack}"`);
  expect(freshRun().settings).toMatchObject({music:false,jackpotMusic:'follow'});
 });
 it('does not advertise background play in standard help or rotating tips',()=>{
  const run={...freshRun(),startedAt:1000,cash:1e10,peak:1e10,work:100,spins:100,speed:1,spent:100,portfolio:[{id:'edge-50',count:1}],running:true};
  expect(renderToStaticMarkup(<GameHelp s={run}/>)).not.toMatch(/バックグラウンド|背景進行|背景で遊ぶ/);
  for(let tick=0;tick<30;tick++) expect(guidance(run,tick,'spin').text).not.toMatch(/バックグラウンド|背景で遊ぶ/);
 });
 it('offers a finance-style name for every gamble while leaving English as the default',()=>{
  const original=ALL_BETS.map(b=>b.name);
  setBetNameStyle('katakana');expect(ALL_BETS.every((b,i)=>b.name!==original[i])).toBe(true);
  setBetNameStyle('english');expect(ALL_BETS.map(b=>b.name)).toEqual(original);
 });
 it('prepares the exact release post with encoded result text for normal and timed clears',()=>{
  const runs=[finish({...freshRun(),cash:TARGET}),advanceTrial(resumeTrial(freshTrial(),1000),TRIAL_MS+1000)];
  for(const run of runs){
   const name='投資家 & +# 🚀',url=new URL(resultXIntent(run,name));
   expect(url.origin+url.pathname).toBe('https://x.com/intent/tweet');
   expect(url.searchParams.get('url')).toBe(RESULT_POST_URL);
   expect(url.searchParams.get('text')).toBe(resultShareText(run,name));
   expect([...url.searchParams.keys()].sort()).toEqual(['text','url']);
  }
 });
});
