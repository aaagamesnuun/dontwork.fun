import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import App from './App';
import {configure, freshRun, readSave, spin} from './game/engine';

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('LAB capture mode',()=>{
  it('migrates old saves without changing balances or display preferences',()=>{
    const original=freshRun();
    const old={...original,cash:432,settings:{...original.settings,captureMode:undefined,workspaceMode:'tabs',sharedChart:false,sharedSpin:false}};
    const restored=readSave(JSON.stringify(old))!;
    expect(restored.cash).toBe(432);
    expect(restored.settings).toMatchObject({captureMode:false,workspaceMode:'tabs',sharedChart:false,sharedSpin:false});
    const filming=configure(restored,{captureMode:true});
    expect(filming.debug).toBe(restored.debug);
    expect(readSave(JSON.stringify(filming))!.settings.captureMode).toBe(true);
    expect(configure(filming,{captureMode:false}).settings).toEqual(restored.settings);
    expect(readSave(JSON.stringify({...filming,settings:{...filming.settings,captureMode:'yes'}}))).toBeNull();
  });
  it('keeps one real spin and chart visible with WORK, AUTO and an entry to the hidden controls',()=>{
    const run=configure(freshRun(),{captureMode:true,workspaceMode:'tabs',sharedSpin:false,sharedChart:false});
    vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='bebullish-save-v1'?JSON.stringify(run):null,setItem:()=>{}});
    const html=renderToStaticMarkup(<App/>);
    expect(html).toContain('capture-mode');
    expect(html.match(/class="shared-spin"/g)).toHaveLength(1);
    expect(html.match(/class="chart-page"/g)).toHaveLength(1);
    expect(html).not.toContain('class="positions-page"');
    expect(html).not.toContain('class="upgrades-page');
    expect(html).toContain('id="work-button"');
    expect(html).toContain('capture-open');
    expect(html).toContain('aria-label="AUTO"');
  });
  it('does not change outcomes, payouts, jackpot progress or eligibility',()=>{
    vi.spyOn(Date,'now').mockReturnValue(1788800000000);
    const normal={...freshRun(),cash:400,peak:400,portfolio:[{id:'edge-50',count:1}],jackpotHigh:true};
    const filming=configure(normal,{captureMode:true});
    for(const roll of [15,60,94,100]) {
      const a=spin(normal,roll), b=spin(filming,roll);
      expect(b.last).toEqual(a.last);
      expect(b.cash).toEqual(a.cash);
      expect(b.rushLeft).toEqual(a.rushLeft);
      expect(b.debug).toEqual(a.debug);
    }
  });
});
