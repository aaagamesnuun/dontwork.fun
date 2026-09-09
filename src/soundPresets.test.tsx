import {it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {SOUND_PACKS,SoundPackPicker} from "./SoundPackPicker";
import {COMMON_SOUND_EFFECTS,SPIN_REVEAL_DEFAULTS,soundPackSettings} from "./soundPresets";
import {configure,freshRun,readSave,coinUnlocked,playCoinFlip,COIN_UNLOCK_PEAK} from "./game/engine";
import {decodeTransfer} from "./transferProtocol";
import {spinTiming} from "./spinTiming";
it("uses one choice for every sound, without shortcuts or compound recipes",()=>{
  const html=renderToStaticMarkup(<SoundPackPicker value="arcade-coinop" onChange={()=>{}}/>);
  expect(html.match(/<select/g)).toHaveLength(1);expect(html.match(/<option/g)).toHaveLength(SOUND_PACKS.length);
  expect(html).not.toContain("<button");expect(html).toContain("CASH RAIN");
});
it("gives every pack the same effects and keeps the user's volume, mute, vibration and motion preference",()=>{
  const old=configure({...freshRun(),cash:12345,peak:12345},{sound:false,soundVolume:.25,lossVolume:.3,haptics:false,motion:"reduced",shake:"off",winVisual:"neon",revealPacing:"full",revealDurationMs:5000});
  for(const [soundPack] of SOUND_PACKS){
    const changed=configure(old,soundPackSettings(soundPack));
    expect(changed.settings).toMatchObject({...COMMON_SOUND_EFFECTS,soundPack,sound:false,soundVolume:.25,lossVolume:.3,haptics:false,motion:"reduced"});
    expect(changed.id).toBe(old.id);expect(changed.cash).toBe(old.cash);
    expect(readSave(JSON.stringify(changed))!.settings).toEqual(changed.settings);
  }
});
it("locks old coin controls below $1M without deleting progress or past coin records",()=>{
  let s={...freshRun(),peak:COIN_UNLOCK_PEAK,cash:1000,coinEnabled:true};s=playCoinFlip(s,100,true);
  const old={...s,peak:999999,settings:{...s.settings,handToys:true,dockToy:"tap"}};
  const restored=readSave(JSON.stringify(old))!;
  expect(restored).toMatchObject({id:old.id,cash:1100,coinRounds:1,coinWins:1,coinEnabled:false,settings:{handToys:true,dockToy:"tap"}});
  expect(coinUnlocked({...restored,peak:COIN_UNLOCK_PEAK,cash:1})).toBe(true);
});
it.each(SOUND_PACKS)("updates an existing %s save to interval × .8 without reselecting its pack",soundPack=>{
  for(const [revealPacing,revealRatio,revealDurationMs] of [["adaptive",1.5,120],["adaptive",1.2,700],["full",.4,3500],["ratio",1.5,5000]] as const){
    const old={...freshRun(),cash:12345,peak:20000,spins:60,speed:7,slots:2,trim:2,rushLeft:17,removed:2,jackpots:2,chain:2,maxChain:2,portfolio:[{id:"edge-50",count:2}],settings:{...freshRun().settings,soundPack,spinRevealRevision:undefined,revealPacing,revealRatio,revealDurationMs,sound:false,soundVolume:.25,haptics:false,banknoteStyle:"hologram",winVisual:"neon"}};
    const raw=JSON.stringify(old),migrated=readSave(raw)!;
    expect(migrated).toMatchObject({id:old.id,cash:12345,peak:20000,spins:60,speed:7,slots:2,trim:2,rushLeft:17,removed:2,jackpots:2,portfolio:old.portfolio});
    expect(migrated.settings).toEqual({...old.settings,...SPIN_REVEAL_DEFAULTS});
    expect(readSave(JSON.stringify(migrated))!.settings).toEqual(migrated.settings);
    expect(decodeTransfer(raw,freshRun(),true,"2.6.0")!.settings).toEqual(migrated.settings);
    const chosen=configure(migrated,{revealPacing:"full",revealRatio:1.2,revealDurationMs:5000});
    expect(readSave(JSON.stringify(chosen))!.settings).toEqual(chosen.settings);
    expect(configure(chosen,soundPackSettings(soundPack)).settings).toMatchObject(SPIN_REVEAL_DEFAULTS);
  }
});
it("uses the migrated ratio for ordinary, Jackpot and curated spins while respecting reduced motion",()=>{
  const old={...freshRun(),settings:{...freshRun().settings,spinRevealRevision:undefined,revealPacing:"full",revealRatio:2,revealDurationMs:3500}};
  const s=readSave(JSON.stringify(old))!;
  expect(spinTiming(s,s).revealDelay).toBe(4000);
  const jp={...s,rushLeft:20};expect(spinTiming(jp,jp).revealDelay).toBe(240);
  const curated={...s,catalog:"curated" as const};expect(spinTiming(curated,curated).revealDelay).toBe(800);
  expect(spinTiming(s,s,true).revealDelay).toBe(0);
  const reduced=configure(s,{motion:"reduced"});expect(spinTiming(reduced,reduced).revealDelay).toBe(0);
});
