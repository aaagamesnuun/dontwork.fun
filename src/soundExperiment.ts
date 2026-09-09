import type { Run, Settings } from './game/engine';
export const SOUND_EXPERIMENT_KEY='bebullish-sound-default-v1';
export type SoundAssignment={experiment:'sound-default-v1';variant:'terminal'|'retro-arcade';assignedAt:number};
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
export function soundAssignment(storage?:StorageLike):SoundAssignment|null {
 try{const value=JSON.parse((storage??localStorage).getItem(SOUND_EXPERIMENT_KEY)??'null');
  return value?.experiment==='sound-default-v1' && ['terminal','retro-arcade'].includes(value.variant) && Number.isSafeInteger(value.assignedAt) && value.assignedAt>0?value:null;
 }catch{return null}
}
export function initializeSoundExperiment(run:Run,_fresh:boolean,_storage?:StorageLike,_draw?:()=>number):Run {
 return run;
}
export function soundExperimentProps(settings:Settings) {
 const assigned=soundAssignment();
 return assigned?{soundExperiment:assigned.experiment,soundVariant:assigned.variant,soundAssignedAt:assigned.assignedAt,soundPack:settings.soundPack}:{};
}
