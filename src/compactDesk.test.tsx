import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import App, {BetCard} from './App';
import {Baccarat} from './Baccarat';
import {JackpotHelp} from './Onboarding';
import {defaultSettings,freshRun,configure,readSave,setCount,spin,resolve,purchaseProbability,probabilityPrice,probabilityCap,playBaccarat,work,settlePortfolio,rollWeights} from './game/engine';
import {betById,ALL_BETS} from './game/catalog';
import {betOdds,hitFacesText} from './game/odds';
import {sweepSnapshot} from './game/sweep';
import {guidance} from './game/guidance';
import {presentationReducer,presentedRun} from './presentation';
import {initializeSoundExperiment,soundAssignment,SOUND_EXPERIMENT_KEY} from './soundExperiment';
afterEach(()=>vi.unstubAllGlobals());
const bank=()=>({...freshRun('all-test'),cash:1e6,peak:1e6,slots:12});
const storage=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}};
describe('compact production desk',()=>{
 it('defaults to the expected-value equation odds display',()=>{
  expect(defaultSettings.oddsDisplay).toBe('fraction');
  expect(freshRun().settings.oddsDisplay).toBe('fraction');
 });
 it('migrates existing display once and preserves saves, then preserves explicit LAB choices',()=>{
  const old={...freshRun(),cash:789,spins:20,settings:{...defaultSettings,layoutRevision:undefined,sharedSpin:false,chartWindowSpins:300,payoffStyle:'classic'}};
  const s=readSave(JSON.stringify(old))!;
  expect(s).toMatchObject({id:old.id,cash:789,spins:20,debug:false,settings:{workspaceMode:'desk',sharedSpin:true,sharedChart:true,chartWindowSpins:200,payoffStyle:'classic'}});
  expect(readSave(JSON.stringify(configure(s,{workspaceMode:'tabs',sharedSpin:false,sharedChart:false,chartWindowSpins:450,payoffStyle:'classic'})))!.settings).toMatchObject({workspaceMode:'tabs',sharedSpin:false,sharedChart:false,chartWindowSpins:450,payoffStyle:'classic'});
 });
 it('renders one persistent sweep, chart, horizontal positions and middle upgrade entry',()=>{
  const store=storage();store.setItem('bebullish-save-v1',JSON.stringify(freshRun()));vi.stubGlobal('localStorage',store);
  const html=renderToStaticMarkup(<App/>);
  expect(html.match(/class="roll-station /g)).toHaveLength(1);
  expect(html.indexOf('class="shared-spin"')).toBeLessThan(html.indexOf('class="chart-page"'));
  expect(html.indexOf('class="chart-page"')).toBeLessThan(html.indexOf('class="positions-page"'));
  expect(html.indexOf('id="work-button"')).toBeLessThan(html.indexOf('class="dock-upgrade'));
  expect(html).not.toContain('class="auto-control');
  expect(html).toContain('play-dock without-auto');
  expect(html).not.toContain('class="main-tabs');
  expect(html).not.toContain('class="position-tools"');
 });
 it('guides work then the visible plus without AUTO; manual tabs still call the chart a chart',()=>{
  let s=freshRun();expect(guidance(s).target).toBe('work');for(let i=0;i<10;i++)s=work(s);
  expect(guidance(s)).toMatchObject({target:'equip'});s=setCount(s,'edge-50',1);expect(guidance(s).target).toBeNull();
  expect(guidance(configure(s,{workspaceMode:'tabs',autoAlwaysOn:false}),0,'positions').text).toContain('チャート');
  const upgrade=guidance({...s,cash:150,peak:150,spins:1,running:true});expect(upgrade.text).toContain('「アップグレード」');
 });
 it('keeps the last discovery out of help until achieved',()=>{
  expect(renderToStaticMarkup(<JackpotHelp/>)).not.toContain('無限');expect(renderToStaticMarkup(<JackpotHelp discovered/>)).toContain('無限');
 });
});
describe('LAB probability and exact expected value',()=>{
 it('adds deterministic winning faces without changing the shared roll or Jackpot',()=>{
  let s=setCount(configure(bank(),{probabilityUpgrades:true}),'edge-50',1);const price=probabilityPrice(s,'edge-50')!;
  s=purchaseProbability(s,'edge-50');expect(s.cash).toBe(1e6-price);expect(s.spent).toBe(price);expect(s.betLevels['edge-50']).toBe(1);
  expect(betOdds(s,betById('edge-50'))).toMatchObject({hit:51,hitFraction:'51/100',winFraction:'51/100'});
  expect(betOdds(s,betById('edge-50')).multiplier).toBeCloseTo(2.5);
  const won=spin(s,50);expect(won.last).toMatchObject({roll:50,payout:25,jackpot:false});expect(resolve(s,betById('edge-50'),49).payout).toBe(0);
  expect(readSave(JSON.stringify(s))!.betLevels).toEqual(s.betLevels);
 });
 it('keeps prerequisites and matches preview, support and growth to upgraded conditions',()=>{
  let s=configure(bank(),{probabilityUpgrades:true});for(const id of ['flow-1','sequence-boost-1','edge-50'])s=setCount(s,id,1);
  s=purchaseProbability(purchaseProbability(s,'flow-1'),'sequence-boost-1');
  expect(sweepSnapshot(s).growth.find(g=>g.id==='flow-1')!.detail).toContain('81%');
  expect(settlePortfolio(s,90).boost).toBe(1);s={...s,memory:{'sequence-boost-1':{armed:true,streak:0,misses:0,previous:80}}};
  expect(settlePortfolio(s,90).boost).toBe(3);
  const before=JSON.stringify(s);const odds=betOdds(s,betById('edge-50')),weights=rollWeights(s);
  const expected=weights.reduce((n,w,i)=>n+settlePortfolio(s,i+1).rows.find(r=>r.id==='edge-50')!.result.payout*w,0);
  expect(odds.expectedPayout).toBeCloseTo(expected);expect(odds.variable).toBe(true);expect(JSON.stringify(s)).toBe(before);
 });
 it('uses exact raw-face fractions after cuts and roll shifts',()=>{
  let s=setCount({...bank(),spins:4},'roll-shift-1',1);s=setCount(s,'edge-50',1);
  expect(betOdds(s,betById('edge-50')).hitFraction).toBe('3/5');
  expect(betOdds({...s,removed:50,rushLeft:20},betById('edge-50')).hitFraction).toBe('1/1');
 });
 it('uses one consistent payout equation even for low payouts, changing payouts and penalties',()=>{
  const s=bank();
  for(const b of ALL_BETS){
   const odds=betOdds(s,b);
   expect(odds.averagePayout*odds.hit/100-(b.id==='edge-50'?10:b.stake)-odds.expectedPenalty).toBeCloseTo(odds.expectedNet,3);
  }
  const run=configure(freshRun(),{oddsDisplay:'fraction'}),html=renderToStaticMarkup(<BetCard b={betById('edge-50')} s={run} change={()=>{}} onDetails={()=>{}}/>);
  expect(html).toContain('class="expected-equation"');expect(html).toContain('<small>期待値</small>');expect(html).toContain('<small>配当</small>');expect(html).toContain('<small>勝率</small>');expect(html).toContain('<small>賭け金</small>');
  expect(html).not.toContain('class="bet-odds"');expect(html).not.toContain('class="pay-column"');expect(html).not.toContain('class="bet-description"');expect(html).toContain('当たり出目:');expect(html).toContain('51-100');expect(html).toContain('mini-spectrum');expect(html).not.toContain('仕組み');
 });
 it('describes only the currently payable faces, matching the gauge',()=>{
  const s=bank();expect(hitFacesText(betOdds(s,betById('edge-50')).outcomes)).toBe('51-100');
  expect(hitFacesText(betOdds(s,betById('shape-2')).outcomes)).toBe('1-10・91-100');
  expect(hitFacesText(betOdds(s,betById('shape-1')).outcomes)).toBe('奇数 (1-99)');
  expect(hitFacesText(betOdds(s,betById('step-2')).outcomes)).toBe('なし');
  const armed={...s,memory:{'step-2':{armed:true,streak:0,misses:0,previous:60}}};
  expect(hitFacesText(betOdds(armed,betById('step-2')).outcomes)).toBe('91-100');
  expect(hitFacesText(betOdds({...s,removed:80,rushLeft:20},betById('edge-50')).outcomes)).toBe('81-100');
 });
 it('rejects unsupported, locked, capped and unaffordable upgrades, and keeps LAB eligibility sticky',()=>{
  const s=configure(bank(),{probabilityUpgrades:true});
  for(const id of ['invalid','work-income','roll-shift-1'])expect(purchaseProbability(s,id)).toBe(s);
  expect(purchaseProbability({...s,cash:0},'edge-50').spent).toBe(0);
  expect(purchaseProbability(configure(freshRun(),{probabilityUpgrades:true}),'edge-2').betLevels).toEqual({});
  const capped={...s,betLevels:{'edge-50':probabilityCap(betById('edge-50'))}};expect(purchaseProbability(capped,'edge-50')).toBe(capped);
  const upgraded=purchaseProbability(s,'edge-50'),disabled=configure(upgraded,{probabilityUpgrades:false});
  expect(readSave(JSON.stringify({...disabled,debug:false}))!.debug).toBe(true);
  expect(readSave(JSON.stringify({...s,betLevels:{'edge-50':1000}}))).toBeNull();
  expect(ALL_BETS.every(b=>probabilityCap(b)>=0&&probabilityCap(b)<=99)).toBe(true);
 });
});
describe('fair LAB baccarat with reveal-safe transactions',()=>{
 it('has exactly zero expected profit and preserves the main spin state',()=>{
  const s=configure({...freshRun(),cash:1000,peak:1000},{baccarat:true});
  for(const side of ['player','banker'] as const){let profit=0,wins=0,losses=0,ties=0;
   for(let player=0;player<10;player++)for(let banker=0;banker<10;banker++){
    const n=playBaccarat(s,100,side,[player,banker]);profit+=n.cash-s.cash;
    if(n.cash>s.cash)wins++;else if(n.cash<s.cash)losses++;else ties++;
    expect(n.spins).toBe(s.spins);expect(n.last).toBe(s.last);expect(n.memory).toBe(s.memory);expect(n.baccaratRounds).toBe(1);
   }
   expect({profit,wins,losses,ties}).toEqual({profit:0,wins:45,losses:45,ties:10});
  }
 });
 it('rejects malformed wagers and never spends beyond current cash',()=>{
  const s=configure({...freshRun(),cash:10,peak:10},{baccarat:true});
  for(const wager of [0,-10,15,10.1,NaN,Infinity,20])expect(playBaccarat(s,wager,'player')).toBe(s);
  const lost=playBaccarat(s,10,'player',[0,9]);expect(lost.cash).toBe(0);expect(playBaccarat(lost,10,'player')).toBe(lost);
  expect(readSave(JSON.stringify(lost))!.baccaratResult).toEqual(lost.baccaratResult);
  const html=renderToStaticMarkup(<Baccarat s={lost} pending={false} onPlay={()=>{}} onClose={()=>{}}/>);expect(html).toContain('LOSE');
  expect(playBaccarat({...s,rushLeft:20},10,'player').baccaratRounds).toBe(0);
 });
 it.each([25,75])('blocks new economic actions during hidden roll %s, then allows them after reveal',roll=>{
  const s=setCount(configure({...freshRun(),cash:1000,peak:1000},{baccarat:true,probabilityUpgrades:true}),'edge-50',1);
  const pending=presentationReducer({run:s,pending:null},{type:'change',update:r=>spin(r,roll)}),update=vi.fn(r=>playBaccarat(r,10,'player',[9,0]));
  expect(presentationReducer(pending,{type:'settled-change',update})).toBe(pending);expect(update).not.toHaveBeenCalled();
  expect(presentationReducer(pending,{type:'settled-change',update:r=>purchaseProbability(r,'edge-50')})).toBe(pending);
  expect(presentedRun(pending).cash).toBe(s.cash);
  const revealed=presentationReducer(pending,{type:'reveal',runId:s.id,spinId:1});
  expect(presentationReducer(revealed,{type:'settled-change',update}).run.cash).toBe(revealed.run.cash+10);
 });
});
describe('new-player sound cohorts',()=>{
 it.each([0,1])('uses CASH RAIN regardless of old experiment draw %s, preserving explicit changes',bit=>{
  const store=storage(),s=initializeSoundExperiment(freshRun(),true,store,()=>bit);
  const variant='arcade-coinop';expect(s.settings.soundPack).toBe(variant);expect(soundAssignment(store)).toBeNull();
  const chosen=configure(s,{soundPack:'wood'});expect(initializeSoundExperiment(chosen,false,store,()=>1-bit).settings.soundPack).toBe('wood');
  expect(initializeSoundExperiment(freshRun(),true,store,()=>1-bit).settings.soundPack).toBe(variant);
 });
 it('does not enroll existing installations or silently mislabel a failed persistence',()=>{
  const store=storage();store.setItem('bebullish-install-id','existing');const s=freshRun();expect(initializeSoundExperiment(s,true,store,()=>1)).toBe(s);expect(store.getItem(SOUND_EXPERIMENT_KEY)).toBeNull();
  expect(initializeSoundExperiment(s,false,storage(),()=>1)).toBe(s);
  expect(initializeSoundExperiment(s,true,{getItem:()=>null,setItem:()=>{throw Error('quota')}},()=>1)).toBe(s);
 });
});
