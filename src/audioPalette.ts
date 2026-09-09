import { boundedIntensity } from "./effectEnergy";
import type { Settings } from "./game/engine";
import type { Cue } from "./audio";
type Note = [number, number, number, OscillatorType];
export type Tone = {
  frequency: number;
  offset: number;
  duration: number;
  wave: OscillatorType;
  gain: number;
  attack: "exponential" | "linear";
  pitchEnd?: number;
};
// The original pre-Astra useSound.ts recipes. Only the new game cues are mapped.
const classic: Record<Cue, Note[]> = {
  "cash-low": [[110,0,.3,"sawtooth"]],
  ui: [[740, 0, 0.025, "sine"]],
  "toggle-on": [
    [330, 0, 0.045, "triangle"],
    [660, 0.045, 0.07, "sine"],
  ],
  "toggle-off": [
    [440, 0, 0.04, "triangle"],
    [220, 0.04, 0.06, "sine"],
  ],
  work: [[520, 0, 0.035, "sine"]],
  spin: [[130, 0, 0.055, "sawtooth"]],
  loss: [
    [165, 0, 0.08, "sawtooth"],
    [105, 0.055, 0.13, "triangle"],
  ],
  win: [
    [420, 0, 0.06, "triangle"],
    [660, 0.055, 0.09, "sine"],
  ],
  bigwin: [
    [320, 0, 0.08, "square"],
    [520, 0.07, 0.1, "triangle"],
    [820, 0.15, 0.16, "sine"],
  ],
  upgrade: [
    [390, 0, 0.06, "triangle"],
    [560, 0.06, 0.08, "triangle"],
    [780, 0.13, 0.12, "sine"],
  ],
  jackpot: [
    [260, 0, 0.08, "square"],
    [520, 0.07, 0.12, "triangle"],
    [780, 0.16, 0.15, "sine"],
    [1040, 0.28, 0.22, "sine"],
  ],
  equip: [
    [310, 0, 0.06, "triangle"],
    [465, 0.05, 0.08, "triangle"],
    [700, 0.12, 0.14, "sine"],
  ],
  armed: [
    [310, 0, 0.06, "triangle"],
    [465, 0.05, 0.08, "triangle"],
    [700, 0.12, 0.14, "sine"],
  ],
  streak: [
    [420, 0, 0.06, "triangle"],
    [660, 0.055, 0.09, "sine"],
  ],
  chain: [
    [390, 0, 0.06, "triangle"],
    [560, 0.06, 0.08, "triangle"],
    [780, 0.13, 0.12, "sine"],
  ],
  pulse: [[659, 0, 0.055, "sine"]],
  infinity: [
    [260, 0, 0.08, "square"],
    [520, 0.07, 0.12, "triangle"],
    [780, 0.16, 0.15, "sine"],
    [1040, 0.28, 0.22, "sine"],
    [1560, 0.4, 0.3, "sine"],
    [2080, 0.53, 0.36, "sine"],
  ],
};
export const isClassicPack = (pack: Settings["soundPack"]) =>
  ["terminal", "retro-arcade", "soft"].includes(pack);
export const isResultCue = (cue: Cue) =>
  [
    "cash-low",
    "loss",
    "win",
    "bigwin",
    "armed",
    "streak",
    "jackpot",
    "chain",
    "infinity",
    "pulse",
  ].includes(cue);
export type ResultAccent = { cue: "streak" | "armed"; power: number };

// One settlement is one packet, including its quiet growth/arming accent.
// A short midrange attack carries the beat on small speakers; the existing
// descending/ascending PE notes keep losses and wins easy to distinguish.
export function resultTones(
  cue: Cue,
  settings: Settings,
  power = 1,
  accent?: ResultAccent,
): Tone[] {
  let tones = cueTones(cue, settings, power);
  if(cue==="cash-low")return tones;
  if (settings.spinSound === "rhythm" && isResultCue(cue)) {
    const first = tones[0];
    const major = ["bigwin", "jackpot", "chain", "infinity"].includes(cue);
    tones = tones.map((tone) => ({
      ...tone,
      offset: (tone.offset - first.offset) * (major ? 1 : 0.65),
      duration: major ? tone.duration : Math.min(tone.duration, 0.095),
    }));
    tones.unshift({
      frequency: cue === "loss" ? 440 : major ? 660 : 880,
      offset: 0,
      duration: 0.032,
      wave: settings.soundPack === "soft" ? "sine" : "triangle",
      gain: first.gain * 0.55,
      attack: "linear",
      pitchEnd: cue === "loss" ? 0.72 : undefined,
    });
  }
  if (accent && accent.cue !== cue) {
    const note = cueTones(accent.cue, settings, accent.power).at(-1)!;
    tones.push({
      ...note,
      offset: 0.07,
      duration: 0.055,
      gain: note.gain * 0.18 * (cue === "loss" ? settings.lossVolume : 1),
    });
  }
  if (settings.bassMode && isResultCue(cue)) {
    const gain =
      0.085 * Math.sqrt(boundedIntensity(settings)) * settings.soundVolume * (cue === "loss" ? settings.lossVolume : 1);
    tones = tones.map((tone) => ({ ...tone, gain: tone.gain * 0.8 }));
    // Short bass and its audible harmonic use the same bounded result packet.
    tones.unshift(
      {
        frequency: 95,
        pitchEnd: 62 / 95,
        offset: 0,
        duration: 0.13,
        wave: "sine",
        gain,
        attack: "linear",
      },
      {
        frequency: 190,
        pitchEnd: 0.8,
        offset: 0,
        duration: 0.075,
        wave: "triangle",
        gain: gain * 0.3,
        attack: "linear",
      },
    );
  }
  if(["jackpot","chain","infinity"].includes(cue) && settings.jackpotVisual==="festival"){
    for(const [frequency,offset,duration] of [[65.4,0,.42],[130.8,.04,.32],[523.25,.12,.32],[659.25,.16,.3],[783.99,.2,.3],[1046.5,.3,.4]])
      tones.push({frequency,offset,duration,wave:frequency<150?"sine":"triangle",gain:settings.soundVolume*.085*Math.sqrt(boundedIntensity(settings)),attack:"linear"});
  }
  if(settings.streakEffects && power>1 && ["win","bigwin","streak","armed","pulse"].includes(cue)){
    const count=Math.min(4,Math.floor(power/3));
    for(let i=0;i<count;i++)tones.push({frequency:660*2**((i*4+Math.min(24,power))/12),offset:.03+i*.035,duration:.1,wave:"triangle",gain:settings.soundVolume*.025*Math.sqrt(boundedIntensity(settings)),attack:"linear"});
  }
  return tones;
}
export function cueTones(cue: Cue, settings: Settings, power = 1): Tone[] {
  const energy=boundedIntensity(settings),streak=settings.streakEffects && ["win","bigwin","streak","armed","pulse"].includes(cue)?Math.min(30,power):0;
  return baseCueTones(cue,settings,power).map(tone=>({...tone,gain:tone.gain*Math.sqrt(energy),frequency:tone.frequency*(1+streak*.012)}));
}
function baseCueTones(cue: Cue, settings: Settings, power = 1): Tone[] {
  if(cue==="cash-low")return [0,.36].flatMap(offset=>[
    {frequency:110,offset,duration:.28,wave:"sawtooth" as const,gain:.105*settings.soundVolume,attack:"linear" as const,pitchEnd:.5},
    {frequency:220,offset:offset+.02,duration:.23,wave:"square" as const,gain:.06*settings.soundVolume,attack:"linear" as const,pitchEnd:.65},
    {frequency:65,offset,duration:.32,wave:"sine" as const,gain:.12*settings.soundVolume,attack:"linear" as const,pitchEnd:.6},
  ]);
  const pack = settings.soundPack;
  if (isClassicPack(pack)) {
    const pitch = pack === "retro-arcade" ? 1.25 : pack === "soft" ? 0.82 : 1;
    const volume =
      pack === "retro-arcade" ? 0.075 : pack === "soft" ? 0.03 : 0.055;
    return classic[cue].map(([frequency, offset, duration, wave]) => ({
      frequency:
        frequency *
        pitch *
        (cue === "streak" ? Math.pow(1.05946, Math.min(12, power)) : 1),
      offset: offset + 0.01,
      duration,
      wave: pack === "soft" ? "sine" : wave,
      gain:
        volume *
        settings.soundVolume *
        (cue === "loss"
          ? settings.lossVolume
          : cue === "pulse"
            ? 0.4
            : cue === "work"
              ? 0.8
              : cue === "equip"
                ? 0.6
                : cue === "ui"
                  ? 0.22
                  : 1),
      attack: "exponential",
    }));
  }
  if (pack.startsWith("arcade-")) {
    const kind=pack.slice(7),major=["jackpot","chain","infinity"].includes(cue);
    const short=["ui","work","spin","pulse"].includes(cue);
    const down=cue==="loss" || cue==="toggle-off";
    const base=cue==="work"?330:cue==="ui"?660:cue==="spin"?130:down?196:261.63*Math.pow(2,Math.min(12,Math.max(0,power-1))/24);
    const recipe: Record<string,number[]>= {
      coinop: major?[0,7,12,16,19,24,19,24]:down?[0,-5,-12]:short?[0,12]:[0,7,12,19],
      pinball: major?[12,24,19,24,16,24,19,31,24,36]:down?[12,5,0]:short?[12,19]:[12,24,19,24,31],
      synth: major?[0,4,7,12,16,19,24,28,31]:down?[0,3,7]:short?[0,7]:[0,4,7,12,16,19],
      punch: major?[-24,-12,0,7,12,0,12,19]:down?[-12,-24,0]:short?[-12,0]:[-12,0,7,12],
    };
    return (recipe[kind]??recipe.coinop).map((semitone,i)=>({
      frequency:base*2**(semitone/12),
      offset:kind==="synth"?Math.floor(i/3)*(major?.12:.065):i*(short?.022:kind==="pinball"?.038:major?.065:.043),
      duration:short?.05:kind==="synth"?.22:kind==="punch"?.12:.09,
      wave:kind==="coinop"?i%2?"triangle":"square":kind==="pinball"?"sine":kind==="punch"?i===0?"sine":"sawtooth":"triangle",
      gain:settings.soundVolume*(short?.045:major?.07:.065)*(cue==="loss"?settings.lossVolume:1)*(kind==="synth"?.6:1),
      attack:"exponential",
      ...(kind==="punch" && i===0?{pitchEnd:.5}:{}),
    }));
  }
  const notes: Record<Cue, number[]> = {
    "cash-low": [110],
    ui: [740],
    "toggle-on": [330, 660],
    "toggle-off": [440, 220],
    work: [220, 330],
    spin: [130],
    equip: [330, 495],
    upgrade: [261.63, 329.63, 392, 523.25],
    win: [440, 660],
    bigwin: [392, 494, 587, 784],
    loss: [180],
    chain: [392, 587, 784],
    pulse: [659],
    armed: [440, 466, 622],
    streak: [
      440 * Math.pow(1.05946, Math.min(12, power)),
      660 * Math.pow(1.05946, Math.min(12, power)),
    ],
    jackpot: [130.81, 196, 261.63, 329.63, 392, 523.25, 783.99],
    infinity: [
      130.81, 196, 261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5,
    ],
  };
  const dramatic = cue === "jackpot" || cue === "infinity",
    spacing = dramatic ? 0.09 : cue === "upgrade" ? 0.065 : 0.045;
  const pitch =
    pack === "wood"
      ? 0.7
      : pack === "impact"
        ? 0.5
        : pack === "crystal"
          ? 1.3
          : 1;
  return notes[cue].map((frequency, i) => ({
    frequency: frequency * pitch,
    offset: i * spacing,
    wave:
      pack === "arcade"
        ? i % 2
          ? "square"
          : "triangle"
        : pack === "wood"
          ? "triangle"
          : pack === "impact" && i > 0
            ? "triangle"
            : "sine",
    duration:
      cue === "loss" ||
      cue === "spin" ||
      cue === "work" ||
      cue === "ui" ||
      cue.startsWith("toggle-")
        ? 0.055
        : cue === "pulse"
          ? 0.07
          : dramatic
            ? pack === "wood"
              ? 0.3
              : 0.6
            : pack === "wood"
              ? 0.08
              : cue === "chain"
                ? 0.13
                : 0.16,
    gain:
      (settings.soundVolume *
        (cue === "loss"
          ? settings.lossVolume
          : dramatic
            ? 1.45
            : cue === "bigwin"
              ? 1.2
              : cue === "pulse"
                ? 0.4
                : cue === "work"
                  ? 0.8
                  : cue === "equip"
                    ? 0.6
                    : cue === "ui"
                      ? 0.22
                      : 1) *
        (pack === "arcade" ? 0.032 : 0.047)) /
      (1 + i * 0.15),
    attack: "linear",
    pitchEnd:
      cue === "loss"
        ? 0.65
        : pack === "impact"
          ? 0.55
          : cue === "work"
            ? 0.8
            : undefined,
  }));
}
