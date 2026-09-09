import {advanceBackground} from "./backgroundPlay";
import { activatePositionTutorial } from "./game/positionTutorial";
import { advanceTrial, trialAssets, trialDeadline, pauseTrial, resumeTrial, buyTrialTime, trialActive } from "./game/engine";
import { appendHistory, MONEY_CEILING, finiteMoney, finish, fuelCapacity, coinUnlocked, nextDistribution, playCoinFlip, applyPositionIntent, samePositions, endJackpot, type PositionIntent, type Run } from "./game/engine";

export interface PositionRequest {runId:string;intent:PositionIntent;approved:boolean;confirm:boolean}

export interface Presentation {
  run: Run;
  pending: { before: Run; after: Run; coinTouched?: boolean; visiblePeak?: number; fuelOffset?: number; reserve?: number } | null;
  positionRequest?: PositionRequest;
}
export type PresentationAction =
  | { type: "background"; run: Run }
  | { type:"trial-clock"; now:number }
  | { type:"trial-pause"; now:number }
  | { type:"trial-resume"; now:number }
  | { type:"trial-time"; now:number; forced?:boolean }
  | { type: "change"; update: (run: Run) => Run }
  | { type: "settled-change"; update: (run: Run) => Run }
  | { type: "purchase"; update: (run: Run) => Run }
  | { type: "coin-flip"; wager: number; forced?: boolean }
  | { type:"position-change";intent:PositionIntent }
  | { type:"position-decision";request:PositionRequest;accept:boolean }
  | { type: "reveal"; runId: string; spinId: number };

// Keep the simulation and its presentation in one reducer. An unresolved spin
// is hidden in the very first render, before any animation effect can run.
export function presentationReducer(state:Presentation,action:PresentationAction):Presentation {
  let next=reducePresentation(state,action);
  const run=next.run===state.run ? next.run : activatePositionTutorial(next.run);
  if(run!==next.run)next={...next,run};
  if(!run.trial || run===state.run || run.trial.result || run.id!==state.run.id)return next;
  if(run.cash===state.run.cash && run.spent===state.run.spent && run.spins===state.run.spins && Math.floor(run.trial.elapsedMs/1000)===Math.floor((state.run.trial?.elapsedMs??0)/1000))return next;
  const tail=run.history.at(-1)!;
  const point={...tail,cash:run.cash,at:run.activeMs,spin:run.spins,trialMs:run.trial.elapsedMs,assets:trialAssets(run)};
  const history=run.history!==state.run.history?[...run.history.slice(0,-1),point]:appendHistory(run.history,{cash:run.cash,at:run.activeMs,spin:run.spins,trialMs:run.trial.elapsedMs,assets:trialAssets(run),kind:"trial"});
  return {...next,run:{...run,history}};
}
function reducePresentation(
  state: Presentation,
  action: PresentationAction,
): Presentation {
  if (action.type === "background") {
    const incoming=action.run;
    const run=incoming.trial && !incoming.running && !incoming.trial.paused ? pauseTrial({...incoming,background:null},incoming.background?.at??Date.now()):incoming;
    return {run,pending:null};
  }
  const now="now" in action?action.now:Date.now();
  // Background catch-up owns its chronological clock until the batch completes.
  if(state.run.trial && !state.run.background){
    if(now>=trialDeadline(state.run))state=settleAccepted(state);
    const advanced=advanceTrial(state.run,now);if(advanced!==state.run)state={...state,run:advanced};
  }
  if(action.type==="trial-clock")return state;
  if(action.type==="trial-pause"){
    if(state.run.background){const catchup=advanceBackground(state.run,now,true,12000);if(!catchup.done)return {...state,run:catchup.run};state={run:catchup.run,pending:null};}
    state=settleAccepted(state);
    return {...state,run:{...pauseTrial(state.run,now),running:false}};
  }
  if(action.type==="trial-resume")return {...state,run:resumeTrial(state.run,now)};
  if(action.type==="trial-time")return {...state,run:buyTrialTime(state.run,coinBudget(state),action.forced)};
  if(!trialActive(state.run) && action.type==="coin-flip")return state;
  if(state.run.trial?.result && !["change","reveal","position-decision"].includes(action.type))return state;
  if(action.type==="position-change"){
    if(state.positionRequest)return state;
    const visible=presentedRun(state),next=applyPositionIntent(visible,action.intent);
    if(next===visible)return state;
    const confirm=visible.rushLeft>0 && !samePositions(visible.portfolio,next.portfolio);
    return finishPositionRequest({...state,positionRequest:{runId:visible.id,intent:action.intent,approved:false,confirm}});
  }
  if(action.type==="position-decision"){
    if(state.positionRequest!==action.request)return state;
    if(!action.accept)return {...state,positionRequest:undefined};
    return finishPositionRequest({...state,positionRequest:{...action.request,approved:true,confirm:false}});
  }
  if (action.type === "purchase") {
    const visible=presentedRun(state),funded={...visible,cash:coinBudget(state)};
    const bought=action.update(funded);
    if(bought===funded || bought.spent===funded.spent)return state;
    const cost=funded.cash-bought.cash;
    if(cost<0 || !Number.isFinite(cost) || cost>coinBudget(state))return state;
    // Select/unlock against the public state. Copy only purchase effects into
    // the simulation, so a hidden result or gacha pool cannot escape early.
    let run={...state.run,cash:state.run.cash-cost,spent:bought.spent,
      slots:bought.slots,speed:bought.speed,capacity:bought.capacity,trim:bought.trim,rush:bought.rush,
      betLevels:bought.betLevels,workFxLevel:bought.workFxLevel,
      upgradeDraws:bought.upgradeDraws,lastUpgradeDraw:bought.lastUpgradeDraw,
      debug:state.run.debug || bought.debug};
    run={...run,fuel:bought.capacity>funded.capacity?bought.fuel:Math.min(fuelCapacity(run),run.fuel+(bought.fuel-funded.fuel)),
      history:appendHistory(run.history,{cash:run.cash,at:run.activeMs,spin:run.spins,kind:"upgrade",spent:cost})};
    return {...state,run,pending:state.pending?{...state.pending,
      fuelOffset:bought.fuel-(state.pending.before.fuel+run.fuel-state.pending.after.fuel)}:null};
  }
  if (action.type === "coin-flip") {
    if (!coinUnlocked(presentedRun(state)) || action.wager > coinBudget(state)) return state;
    let run = playCoinFlip(state.run, action.wager, action.forced);
    if (run === state.run) return state;
    if (!state.pending) return { ...state, run, pending: null };
    const before = presentedRun(state);
    const visiblePeak = Math.max(state.pending.visiblePeak ?? before.peak, before.cash + run.coinResult!.profit);
    run = {...run,peak:Math.max(run.peak,visiblePeak)};
    const pending={...state.pending,coinTouched:true,visiblePeak};
    // A visible wallet crossing the goal earns a permanent clear, even if the
    // already-reserved main bet later lands below it. Never replace a clear.
    if(run.clearAt===null){
      const visible=finish(presentedRun({run,pending}));
      if(visible.clearAt!==null)run={...run,clearAt:visible.clearAt,clearActiveMs:visible.clearActiveMs,clearSpins:visible.clearSpins,clearSnapshot:visible.clearSnapshot,completion:visible.completion};
    }
    return { ...state, run, pending };
  }
  // LAB wagers and probability purchases cannot spend an unrevealed win.
  if (action.type === "settled-change" && state.pending) return state;
  if (action.type === "reveal") {
    if (!(state.run.id === action.runId &&
      state.run.last?.id === action.spinId && state.pending
    )) return state;
    return revealAccepted(state);
  }
  let next = action.update(state.run);
  if(next.id===state.run.id && next.trial && !next.running && !next.trial.result){
    const settled=settleAccepted(state);
    const changes=Object.fromEntries(Object.entries(next).filter(([key,value])=>value!==state.run[key as keyof Run]));
    state=settled;next=pauseTrial({...settled.run,...changes},now);
  }
  if(state.run.trial?.result && next.id===state.run.id){
    // A finished record is immutable; sound preferences and naming still work.
    next={...state.run,settings:next.settings,telemetry:next.telemetry,debug:state.run.debug||next.debug,
      commonRollExplained:next.commonRollExplained,coinUnlockAnnounced:next.coinUnlockAnnounced,trial:state.run.trial?{...state.run.trial,nickname:next.trial?.nickname??state.run.trial.nickname,submitted:next.trial?.submitted??state.run.trial.submitted}:null};
  }
  if (next === state.run) return state;
  if (next.id !== state.run.id) return { run: next, pending: null };
  const result: Presentation = {
    ...state,
    run: next,
    pending: next.spins !== state.run.spins && next.last
      ? { before: state.pending?.before ?? state.run, after: next,
          reserve: Math.min(state.run.cash, Math.max(0, ...nextDistribution(state.run).map(value=>-(value??0)))) }
      : state.pending,
  };
  if(result.pending && next.spins===state.run.spins){
    const visible=presentedRun(result);
    result.pending={...result.pending,visiblePeak:Math.max(result.pending.visiblePeak??0,visible.peak)};
    result.run={...next,peak:Math.max(next.peak,visible.peak)};
    if(result.run.clearAt===null){
      const finished=finish(visible);
      if(finished.clearAt!==null)result.run={...result.run,clearAt:finished.clearAt,clearActiveMs:finished.clearActiveMs,
        clearSpins:finished.clearSpins,clearSnapshot:finished.clearSnapshot,completion:finished.completion};
    }
  }
  return result;
}

function finishPositionRequest(state:Presentation):Presentation {
  const request=state.positionRequest;
  if(!request)return state;
  if(request.runId!==state.run.id)return {...state,positionRequest:undefined};
  if(request.confirm)return state;
  let next=applyPositionIntent(state.run,request.intent);
  if(state.pending && state.pending.before.rushLeft===0 && !request.approved)next={...state.run,portfolio:next.portfolio,memory:next.memory,settings:next.settings,coinEnabled:next.coinEnabled};
  if(next===state.run)return {...state,positionRequest:undefined};
  if(presentedRun(state).rushLeft>0 && !samePositions(state.run.portfolio,next.portfolio) && !request.approved)
    return {...state,positionRequest:{...request,confirm:true}};
  // The accepted spin already owns its outcome. Edits affect the next spin,
  // while the pending outcome and reserved money remain immutable.
  const pending=state.pending && request.approved ? {...state.pending,before:endJackpot(state.pending.before),after:endJackpot(state.pending.after)} : state.pending;
  return {...state,run:next,pending,positionRequest:undefined};
}

// This limit is identical for every hidden main result. Funds reserved for the
// pending spin cannot be gambled again, including any possible penalty.
export function coinBudget(state: Presentation) {
  if (!state.pending) return state.run.cash;
  const {before,after,reserve}=state.pending;
  return Math.max(0,finiteMoney(before.cash-(reserve??Math.min(before.cash,Math.max(0,...nextDistribution(before).map(v=>-(v??0)))))+(state.run.cash-after.cash)));
}

export function presentedRun({ run, pending }: Presentation): Run {
  if (!pending) return run;
  const { before, after } = pending;
  // WORK and purchases stay responsive during a long reveal. Apply only their
  // changes to the visible balance; the spin's delta is published on landing.
  const cash = Math.max(0, finiteMoney(before.cash + (run.cash - after.cash)));
  return {
    ...run,
    cash,
    peak: Math.max(before.peak, pending.visiblePeak ?? 0, cash),
    fuel: Math.min(fuelCapacity(run),Math.max(0, before.fuel + (run.fuel - after.fuel)+(pending.fuelOffset??0))),
    spins: before.spins,
    last: before.last,
    history: before.history,
    coinChartHold: before.coinChartHold,
    coinPendingCount: before.coinPendingCount + run.coinPendingCount,
    coinPendingProfit: Math.max(-MONEY_CEILING,Math.min(MONEY_CEILING,before.coinPendingProfit + run.coinPendingProfit)),
    memory: before.memory,
    rushLeft: before.rushLeft,
    removed: before.removed,
    persistentRemoved: before.persistentRemoved,
    chain: before.chain,
    jackpots: before.jackpots,
    jackpotHigh: before.jackpotHigh,
    spinsSinceJackpot: before.spinsSinceJackpot,
    maxChain: before.maxChain,
    maxStreak: before.maxStreak,
    bestWin: before.bestWin,
    bestPayout: before.bestPayout,
    winStreak: before.winStreak,
    lifetimeProfit: before.lifetimeProfit,
    assistUsed: before.assistUsed,
    secondBetTutorial: before.secondBetTutorial,
    infinityAt: before.infinityAt,
    clearAt: before.clearAt,
    clearActiveMs: before.clearActiveMs,
    clearSpins: before.clearSpins,
    clearSnapshot: before.clearSnapshot,
    completion: before.completion,
  };
}

function revealAccepted(state:Presentation):Presentation {
    let run = state.run;
    if(!state.pending)return state;
    if (state.pending.coinTouched) {
      const landing=state.pending.after.history[state.pending.after.history.length-1];
      const coinProfit=Math.max(-MONEY_CEILING,Math.min(MONEY_CEILING,(landing.coinProfit??0)+run.coinPendingProfit));
      const coinCount=(landing.coinCount??0)+run.coinPendingCount;
      run = { ...run, peak:Math.max(run.peak,state.pending.before.peak,state.pending.visiblePeak??0),coinChartHold:null,coinPendingProfit:0,coinPendingCount:0,
        history:appendHistory(run.history.filter(point=>!(point.kind===landing.kind && point.spin===landing.spin && point.at===landing.at)),{cash:run.cash,at:run.activeMs,spin:run.spins,kind:"spin",coinProfit,coinCount,...(run.trial?{trialMs:run.trial.elapsedMs,assets:trialAssets(run)}:{})}) };
      run = finish(run);
    }
    return finishPositionRequest({ ...state, run, pending:null });
}

export function settleAccepted(state:Presentation):Presentation {
  return revealAccepted({...state,positionRequest:undefined});
}
