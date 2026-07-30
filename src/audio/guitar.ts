// Guitarnada guitar voice — Karplus-Strong plucked-string synthesis with per-string physical modeling.
// One Voice per guitar string; strums/arrpegios walk across strings with delayed triggers; this gives
// authentic "strummed chord" texture because each string is its own physical resonator.
// Falls back to a clean oscillator "pluck" if Web Audio buffer rendering is unavailable.

const A4_MIDI = 69;
export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - A4_MIDI) / 12);
export const noteToMidi = (note: string, octave = 4): number => {
  const SEMI: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  const n = note.replace("\u266F", "#").replace("\u266D", "b");
  const cls = n.match(/^([A-G][#b]?)/)?.[1];
  if (!cls) return 60;
  const local = n.replace(cls, "");
  const oct = local.match(/-?\d+/) ? Number(local.match(/-?\d+/)![0]) : octave;
  return (oct + 1) * 12 + (SEMI[cls] ?? 0);
};
export const midiToNote = (m: number): string => {
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const ix = ((m % 12) + 12) % 12;
  const oct = Math.floor(m / 12) - 1;
  return NAMES[ix] + (oct >= 0 ? String(oct) : `-${Math.abs(oct)}`);
};

// === Tuning library ===
export interface Tuning { id: string; label: string; strings: string[]; }
export const TUNINGS: Tuning[] = [
  { id: "standard",        label: "Standard EADGBE", strings: ["E2","A2","D3","G3","B3","E4"] },
  { id: "dropD",           label: "Drop D",            strings: ["D2","A2","D3","G3","B3","E4"] },
  { id: "dropC",           label: "Drop C",            strings: ["C2","G2","C3","F3","A3","D4"] },
  { id: "dadgad",          label: "DADGAD",            strings: ["D2","A2","D3","G3","A3","D4"] },
  { id: "openG",           label: "Open G (Keith)",     strings: ["D2","G2","D3","G3","B3","D4"] },
  { id: "openD",           label: "Open D",            strings: ["D2","A2","D3","F#3","A3","D4"] },
  { id: "openE",           label: "Open E",            strings: ["E2","B2","E3","G#3","B3","E4"] },
  { id: "openA",           label: "Open A",            strings: ["E2","A2","E3","A3","C#4","E4"] },
  { id: "openC",           label: "Open C",            strings: ["C2","G2","C3","G3","C4","E4"] },
  { id: "halfStepDown",    label: "E\u266D (half-step)",    strings: ["Eb2","Ab2","Db3","Gb3","Bb3","Eb4"] },
  { id: "wholeStepDown",   label: "D (whole-step)",    strings: ["D2","G2","C3","F3","A3","D4"] },
  { id: "cStandard",       label: "C standard",        strings: ["C2","G2","C3","F3","A3","D4"] },
  { id: "baritone",        label: "Baritone B",        strings: ["B1","E2","A2","D3","F#3","B3"] },
  { id: "newStandard",     label: " CGDAEG (Fripp)",   strings: ["C2","G2","D3","A3","E4","G4"] },
  { id: "dModal",          label: "DADGAD-style (D)",  strings: ["D2","A2","D3","G3","A3","D4"] },
];

export const DEFAULT_TUNING_ID = "standard";
export const tuningById = (id: string): Tuning => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
export const openStringMidis = (tuning: Tuning): number[] => tuning.strings.map((s) => noteToMidi(s));

// === Karplus-Strong voice ===
// One string per guitar. The delay line is initialised with bright low-passed noise (a "pick", not a
// "click"), then recirculates through the KS averaging filter which removes one cycle's worth of high
// end per period — so the harmonics decay faster than the fundamental, giving a real plucked-string
// brightness curve instead of a sustained organ/piano tone. The whole note is rendered once (no loop
// ticking), and each pluck RETRIGGERS: the previous note on this string is damped via its envelope gain
// BEFORE the new one is fired, so re-clicking a chord never makes the sound "stack and get louder".

class StringVoice {
  private ctx: AudioContext;
  private out: GainNode;
  private lastEnv: GainNode | null = null;
  private lastSrc: AudioBufferSourceNode | null = null;
  private bodyFilter: BiquadFilterNode;
  constructor(ctx: AudioContext, dest: AudioNode, freq: number) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.34;
    // Tone stack: body resonant peak + a lowpass that takes the brittle top off raw KS so it sounds woody.
    this.bodyFilter = ctx.createBiquadFilter();
    this.bodyFilter.type = "peaking";
    this.bodyFilter.frequency.value = Math.max(140, freq * 1.4);
    this.bodyFilter.Q.value = 0.7;
    this.bodyFilter.gain.value = 2.8;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 65; hp.Q.value = 0.45;
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 5200; tone.Q.value = 0.3;
    this.out.connect(hp).connect(this.bodyFilter).connect(tone).connect(dest);
  }
  // pluck the string with given dynamics; `position` ~ 0.28 typical strum (near sound-hole)
  pluck = (freq: number, when: number, durationMs = 2600, velocity = 0.85, position = 0.28) => {
    const ctx = this.ctx;

    // === (1) Damp the previous note on this string so re-clicking never sums to a crescendo ===
    if (this.lastEnv) {
      try {
        this.lastEnv.gain.cancelScheduledValues(when);
        this.lastEnv.gain.setTargetAtTime(0, when, 0.012); // 12ms exponential mute
      } catch (e) { void e; }
    }
    if (this.lastSrc) { try { this.lastSrc.stop(when + 0.05); } catch (e) { void e; } }

    const sr = ctx.sampleRate;
    const period = Math.max(2, Math.floor(sr / freq));
    // Excitation: bright low-passed noise (a pick, not a click). Higher strings → brighter.
    const excite = new Float32Array(period + 2);
    const cut = Math.min(0.5, 0.16 + (480 / Math.max(1, freq)) * 0.0025);
    let lp = 0;
    for (let i = 0; i < period; i++) {
      const n = Math.random() * 2 - 1;
      lp = lp + cut * (n - lp);
      excite[i] = lp;
    }

    // Render the full note in ONE pass (no loop = no seam click).
    const totalSamples = Math.min(Math.floor((durationMs / 1000) * sr), Math.floor(sr * 2.8));
    const out = new Float32Array(totalSamples);
    // KS damping: damp < 0.5 removes more highs per cycle → plucked brightness curl, NOT sustain.
    // decayCoef��0.996 gives a natural pluck: bright attack fading to fundamental in ~2.5s.
    const damp = 0.493 + position * 0.04;
    const decayCoef = 0.9962;
    let idx = 0;
    for (let n = 0; n < totalSamples; n++) {
      out[n] = excite[idx];
      const a = excite[idx];
      const b = excite[(idx + 1) % excite.length];
      excite[idx] = damp * (a + b) * decayCoef;
      idx = (idx + 1) % excite.length;
    }

    const ab = ctx.createBuffer(1, totalSamples, sr);
    ab.copyToChannel(out, 0);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    src.loop = false;
    const env = ctx.createGain();
    const peak = 0.6 * velocity;
    // Sharp pluck attack (4ms) + exponential decay to ~0 over the note length.
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0002, when + durationMs / 1000);
    src.connect(env).connect(this.out);
    src.start(when);
    src.stop(when + durationMs / 1000 + 0.05);

    // remember so the next pluck can mute THIS one
    this.lastEnv = env;
    this.lastSrc = src;
    // clear refs when this note finishes so we don't try to mute a dead node
    src.onended = () => { if (this.lastSrc === src) { this.lastSrc = null; this.lastEnv = null; } };
  };
}

// === The guitar ===
export class GuitarEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private voices: StringVoice[] = [];
  public tuning: Tuning = TUNINGS[0];
  public volume = 0.5;
  private started = false;
  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx = new Ctx();
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 22; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.005; this.comp.release.value = 0.18;
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    this.master.connect(this.comp).connect(ctx.destination);
    this.tune(this.tuning);
    this.started = true;
    return ctx;
  }
  tune = (t: Tuning) => { this.tuning = t; const ctx = this.ensure(); this.voices = openStringMidis(t).map(() => new StringVoice(ctx, this.master!, 220)); };
  setVolume = (v: number) => { this.volume = v; if (this.master) this.master.gain.value = v; };
  // ALWAYS try to resume — browsers gate audio on user gesture.
  resume = () => {
    const ctx = this.ensure();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  };
  // Public: call from the first user interaction to warm the context up.
  unlock = () => { this.resume(); };

  // strum or fingerpattern a chord.
  // `midis` is given in visual string order (string 6 → string 1, i.e. low E first).
  playChord = (midis: number[], opts?: { when?: number; strum?: "down" | "up" | "finger"; patternMs?: number; velocity?: number }) => {
    this.resume();
    if (!this.ctx) return;
    const when = opts?.when ?? this.ctx.currentTime + 0.005;
    const pat = opts?.strum ?? "down";
    const stepMs = pat === "finger" ? (opts?.patternMs ?? 130) : (opts?.patternMs ?? 42);
    const vel = opts?.velocity ?? 0.85;
    const stringsInChord = midis.slice(0, 6);
    let order: number[] = stringsInChord.map((_, i) => i);
    if (pat === "up") order = order.reverse();
    let t = when;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const midi = stringsInChord[i];
      if (midi == null) continue;
      this.pluckAt(i, midi, t, 2600, vel);
      t += stepMs / 1000;
    }
  };

  pluckString = (stringIdx: number, midi: number, when?: number, durationMs = 2600) => {
    this.resume();
    this.pluckAt(stringIdx, midi, when ?? (this.ctx!.currentTime + 0.005), durationMs, 0.85);
  };

  private pluckAt(stringIdx: number, midi: number, when: number, durationMs: number, velocity: number) {
    if (!this.ctx || !this.master) return;
    let voice = this.voices[stringIdx];
    if (!voice) { voice = new StringVoice(this.ctx, this.master, midiToFreq(midi)); this.voices[stringIdx] = voice; }
    voice.pluck(midiToFreq(midi), when, durationMs, velocity);
  }

  now(): number { return this.ctx ? this.ctx.currentTime : 0; }
  get isStarted() { return this.started; }
}

export const guitar = new GuitarEngine();

// Quick reference tone used by the tuner; sine + slight vibrato so it's distinct from a "pluck".
export const playReferenceTone = (freq: number, durationMs = 1200) => {
  const ctx = guitar.ensure(); guitar.resume();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + durationMs / 1000 + 0.02);
};
