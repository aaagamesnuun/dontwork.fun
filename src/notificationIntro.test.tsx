import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import type {ReactElement,ReactNode} from 'react';
const hooks=vi.hoisted(()=>({values:[] as unknown[],cursor:0}));
vi.mock('react',async()=>{
 const actual=await vi.importActual<typeof import('react')>('react');
 return {...actual,useEffect:()=>{},useRef:(value:unknown)=>({current:value}),useState:(initial:unknown)=>{
  const index=hooks.cursor++;
  if(!(index in hooks.values))hooks.values[index]=typeof initial==='function'?initial():initial;
  return [hooks.values[index],(next:unknown)=>{hooks.values[index]=typeof next==='function'?next(hooks.values[index]):next}];
 }};
});
vi.mock('./audio',()=>({wakeAudio:vi.fn(),sound:vi.fn()}));
import {GameOverview} from './Onboarding';
import {NotificationSettings} from './BackgroundSettings';
import {freshRun,type Run} from './game/engine';
import {setLanguage} from './i18n';
import {sound} from './audio';
type Element=ReactElement<{children?:ReactNode;onClick?:()=>void;disabled?:boolean;className?:string}>;
function elements(node:ReactNode):Element[]{
 if(Array.isArray(node))return node.flatMap(elements);
 if(!node||typeof node!=='object'||!('props' in node))return [];
 const el=node as Element;return [el,...elements(el.props.children)];
}
function text(node:ReactNode):string{
 if(Array.isArray(node))return node.map(text).join('');
 if(typeof node==='string'||typeof node==='number')return String(node);
 return node&&typeof node==='object'&&'props' in node?text((node as Element).props.children):'';
}
const button=(node:ReactNode,label:string)=>{const result=elements(node).find(el=>el.type==='button'&&text(el).includes(label));if(!result)throw Error('Missing button '+label);return result};
const render=(fn:()=>ReactNode)=>{hooks.cursor=0;return fn()};
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
beforeEach(()=>{hooks.values=[];hooks.cursor=0;vi.clearAllMocks();setLanguage('ja')});
afterEach(()=>{vi.unstubAllGlobals();setLanguage('ja')});
it('requires a sound audition and confirmation before the notification page, then waits for the final choice',()=>{
 const done=vi.fn(),step=<section>NOTIFICATION STEP</section>,view=()=>render(()=>GameOverview({onDone:done,notificationStep:step}));
 let page=view();expect(text(page)).not.toContain('NOTIFICATION STEP');button(page,'タップして次へ').props.onClick!();
 page=view();expect(button(page,'音を確認した').props.disabled).toBe(true);
 button(page,'音を確認した').props.onClick!();expect(text(view())).not.toContain('NOTIFICATION STEP');expect(done).not.toHaveBeenCalled();
 button(view(),'音を試す').props.onClick!();expect(sound).toHaveBeenCalledWith('jackpot',expect.objectContaining({sound:true,soundVolume:1}));
 page=view();expect(button(page,'音を確認した').props.disabled).toBe(false);button(page,'音を確認した').props.onClick!();
 expect(text(view())).toContain('NOTIFICATION STEP');expect(done).not.toHaveBeenCalled();
});
it('keeps the two-page flow for a mode without background notifications',()=>{
 const done=vi.fn(),view=()=>render(()=>GameOverview({onDone:done}));
 button(view(),'タップして次へ').props.onClick!();button(view(),'音を試す').props.onClick!();button(view(),'音を確認した').props.onClick!();expect(done).toHaveBeenCalledOnce();
});
it('requests permission only on an explicit click and preserves gameplay settings when enabling',async()=>{
 const requestPermission=vi.fn().mockResolvedValue('granted');vi.stubGlobal('navigator',{serviceWorker:{}});vi.stubGlobal('Notification',{permission:'default',requestPermission});
 let run=freshRun();const before=run,done=vi.fn(),change=(update:(s:Run)=>Run)=>{run=update(run)};
 const view=()=>render(()=>NotificationSettings({s:run,change,intro:true,onDone:done}));
 const page=view();expect(text(page)).toContain('うるさくはしません');expect(requestPermission).not.toHaveBeenCalled();
 button(page,'通知をオンにする').props.onClick!();await flush();
 expect(requestPermission).toHaveBeenCalledOnce();expect(run.settings).toEqual({...before.settings,jackpotNotifications:true});expect(run.debug).toBe(before.debug);expect(done).not.toHaveBeenCalled();
 const start=button(view(),'始める →');expect(start.props.className).toContain('guide-target');start.props.onClick!();expect(done).toHaveBeenCalledOnce();
});
it.each(['denied','default'])('lets the player continue without notification permission: %s',async result=>{
 const requestPermission=vi.fn().mockResolvedValue(result);vi.stubGlobal('navigator',{serviceWorker:{}});vi.stubGlobal('Notification',{permission:'default',requestPermission});
 const change=vi.fn(),done=vi.fn(),view=()=>render(()=>NotificationSettings({s:freshRun(),change,intro:true,onDone:done}));
 button(view(),'通知をオンにする').props.onClick!();await flush();
 expect(change).not.toHaveBeenCalled();const skip=button(view(),'スキップ');expect(skip.props.disabled).toBe(false);skip.props.onClick!();expect(done).toHaveBeenCalledOnce();
});
it('supports skipping without prompting and unsupported browsers never trap the user',()=>{
 vi.stubGlobal('Notification',undefined);vi.stubGlobal('navigator',{});
 const done=vi.fn(),page=render(()=>NotificationSettings({s:freshRun(),change:vi.fn(),intro:true,onDone:done}));
 expect(button(page,'通知をオンにする').props.disabled).toBe(true);button(page,'スキップ').props.onClick!();expect(done).toHaveBeenCalledOnce();
});
it('uses the existing permission without reprompting and localizes the introduction',async()=>{
 setLanguage('en');const requestPermission=vi.fn();vi.stubGlobal('Notification',{permission:'granted',requestPermission});vi.stubGlobal('navigator',{serviceWorker:{}});
 const change=vi.fn(),view=()=>render(()=>NotificationSettings({s:freshRun(),change,intro:true,onDone:vi.fn()}));
 expect(text(view())).toContain('playing in the background');button(view(),'Enable notifications').props.onClick!();await flush();expect(requestPermission).not.toHaveBeenCalled();expect(change).toHaveBeenCalledOnce();
});
