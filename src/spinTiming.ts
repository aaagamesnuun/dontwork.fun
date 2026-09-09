import { canSpin, interval, isInfinite, type Run } from "./game/engine";
export function shouldFollowJackpot(
  before: Run,
  revealed: Run,
  current: Run,
  hidden = false,
) {
  return (
    !hidden &&
    current.settings.jackpotAutoTab &&
    current.rushLeft > 0 &&
    before.id === revealed.id &&
    current.id === revealed.id &&
    current.last?.id === revealed.last?.id &&
    !!revealed.last?.jackpot &&
    !isInfinite(before)
  );
}
export function spinTiming(before: Run, after: Run, osReduced = false) {
  const revealDelay =
    after.settings.motion === "reduced" || osReduced
      ? 0
      : after.settings.revealPacing === "ratio"
        ? interval(before) * after.settings.revealRatio
        : after.settings.revealPacing === "full"
        ? after.settings.revealDurationMs
        : interval(before) <= 250 ? 0 : Math.min(
          after.settings.revealDurationMs,
          Math.max(0, interval(before) - 50),
        );
  return {
    revealDelay,
    holdForResult:
      revealDelay > 0 &&
      ((before.rushLeft === 0 && after.rushLeft > 0) ||
        interval(after) <= revealDelay),
  };
}

export function remainingSpinMs(run:Run,chargedMs=0,revealMs=0){return Math.max(0,interval(run)-chargedMs,revealMs);}
export function autoCycle(current:Run,visible:Run,chargedMs:number,pending:boolean,revealMs=0){
  return {progress:Math.max(0,Math.min(1,chargedMs/interval(pending?visible:current))),ready:!pending && canSpin(current) && remainingSpinMs(current,chargedMs,revealMs)===0};
}
