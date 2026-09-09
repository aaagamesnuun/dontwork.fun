import { afterEach, describe, expect, it, vi } from "vitest";
import { newerShell, safeToApplyUpdate, saveAndReload, watchPwaUpdates, type ShellBuild, type UpdateStatus } from "./pwaUpdates";
import { freshRun, readSave, spin, work } from "./game/engine";
import { presentationReducer } from "./presentation";

const old = { id: "old", createdAt: 100 }, next = { id: "new", createdAt: 200 };
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });
function harness(page = old, registrationFailure = false) {
  const worker = Object.assign(new EventTarget(), { build: old, postMessage: vi.fn() });
  const reg = Object.assign(new EventTarget(), { active: worker, installing: null, update: vi.fn(async () => {}) });
  const workers = Object.assign(new EventTarget(), { controller: worker, register: vi.fn(async () => reg) });
  if (registrationFailure) workers.register.mockRejectedValueOnce(new Error("offline"));
  const doc = Object.assign(new EventTarget(), { hidden: false }), win = new EventTarget();
  const updates: Partial<UpdateStatus>[] = [];
  const readBuild = vi.fn(async (worker: ServiceWorker) => (worker as unknown as {build:ShellBuild}).build);
  cleanups.push(watchPwaUpdates(workers as unknown as ServiceWorkerContainer, page, doc as unknown as Document,
    win as unknown as Window, state => updates.push(state), readBuild));
  return { workers, reg, doc, win, updates, readBuild };
}
describe("installed PWA updates", () => {
  it("checks on launch, foreground and reconnect, including parked windows, without reloading", async () => {
    const h = harness();
    await vi.waitFor(() => expect(h.reg.update).toHaveBeenCalledTimes(1));
    expect(h.workers.register).toHaveBeenCalledWith("/sw.js", {scope:"/",updateViaCache:"none"});
    h.doc.hidden = true; h.doc.dispatchEvent(new Event("visibilitychange"));
    expect(h.reg.update).toHaveBeenCalledTimes(1);
    h.doc.hidden = false; h.doc.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(h.reg.update).toHaveBeenCalledTimes(2));
    h.win.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(h.reg.update).toHaveBeenCalledTimes(3));
    h.workers.controller = Object.assign(new EventTarget(), {build:next,postMessage:vi.fn()});
    h.workers.dispatchEvent(new Event("controllerchange"));
    await vi.waitFor(() => expect(h.updates).toContainEqual({available:next,error:""}));
    cleanups.pop()!();
    h.win.dispatchEvent(new Event("online"));
    expect(h.reg.update).toHaveBeenCalledTimes(3);
  });
  it("leaves the current saved game usable when checking offline", async () => {
    const h = harness();
    h.reg.update.mockRejectedValue(new Error("offline"));
    await vi.waitFor(() => expect(h.updates).toContainEqual({offlineReady:true}));
    expect(h.updates.some(state => state.available || state.error)).toBe(false);
  });
  it("retries a failed first registration on reconnect and reports this window's build for cache cleanup", async () => {
    const h = harness(old,true);
    await vi.waitFor(() => expect(h.updates.some(state=>state.error)).toBe(true));
    h.win.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(h.workers.register).toHaveBeenCalledTimes(2));
    expect(h.updates).toContainEqual({offlineReady:true,error:""});
    const port={postMessage:vi.fn()};
    const event=Object.assign(new Event("message"),{data:{type:"BEBULLISH_PAGE_BUILD"},ports:[port]});
    h.workers.dispatchEvent(event);
    expect(port.postMessage).toHaveBeenCalledWith(old.id);
  });
  it("does not reload on first install or replace fresh HTML with an older controller", async () => {
    const h = harness(next);
    await vi.waitFor(() => expect(h.readBuild).toHaveBeenCalled());
    expect(h.updates.some(state => state.available)).toBe(false);
    expect(newerShell(next,next)).toBe(false);
    expect(newerShell(old,next)).toBe(true);
  });
  it("waits for the reveal, purchases and input forms before a saved update", () => {
    const safe = {visible:true,pending:false,purchasing:false,running:false,modal:null};
    expect(safeToApplyUpdate(safe)).toBe(true);
    for (const patch of [{pending:true},{purchasing:true},{running:true},{visible:false},
      ...["feedback","clear","transfer","draft","bet"].map(modal=>({modal}))])
      expect(safeToApplyUpdate({...safe,...patch})).toBe(false);
  });
  it("keeps the settled spin, intervening WORK, identity and upgrades across a reload", () => {
    const before = {...freshRun(),cash:100,portfolio:[{id:"edge-50",count:1}],running:true};
    let model = presentationReducer({run:before,pending:null}, {type:"change",update:run=>spin(run,100,500)});
    model = presentationReducer(model,{type:"change",update:work});
    expect(model.pending).not.toBeNull();
    model = presentationReducer(model,{type:"reveal",runId:model.run.id,spinId:model.run.last!.id});
    const saved = new Map<string,string>(), reload = vi.fn();
    const result = saveAndReload(next, () => {saved.set("save",JSON.stringify(model.run));return true;},
      ()=>({getItem:key=>saved.get(key)??null,setItem:(key,value)=>{saved.set(key,value);}}), reload);
    expect(result).toBe("reloading");
    expect(readSave(saved.get("save")!)).toMatchObject({id:before.id,cash:model.run.cash,spins:1,work:1,
      rushLeft:model.run.rushLeft,removed:model.run.removed,portfolio:before.portfolio,running:false});
    expect(reload).toHaveBeenCalledOnce();
  });
  it("never reloads after a save failure, and never loops on the same build", () => {
    const data = new Map<string,string>(), storage = {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
    const reload = vi.fn();
    expect(saveAndReload(next,()=>true,()=>{throw new Error("SecurityError")},reload)).toBe("save-failed");
    expect(saveAndReload(next,()=>false,()=>storage,reload)).toBe("save-failed");
    expect(reload).not.toHaveBeenCalled();
    expect(saveAndReload(next,()=>true,()=>storage,reload)).toBe("reloading");
    expect(saveAndReload(next,()=>true,()=>storage,reload)).toBe("already-tried");
    expect(reload).toHaveBeenCalledOnce();
  });
});
