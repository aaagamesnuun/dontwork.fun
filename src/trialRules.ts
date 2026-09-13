// Retired scoring cohorts must never be resubmitted or shown as current ranks.
export const TRIAL_RANKING_RULESET = 'astra-v13-30m-assets:classic';
export function eligibleTrialRecord(record:{ranked:boolean;rulesetVersion:string}|null|undefined):boolean {
  return !!record?.ranked && record.rulesetVersion===TRIAL_RANKING_RULESET;
}
