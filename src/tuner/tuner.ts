// Guitarnada tuner — autocorrelation pitch detector on the mic.
// Deterministic, on-device, real-time. No third-party DSP. Web Audio AnalyserNode for raw PCM.

import { guitar, TUNINGS, tuningById, noteToMidi, openStringMidis, type Tuning, playReferenceTone, midiToNote, midiToFreq } from "../audio/guitar";

const A4 = 440;

export const freqToNearestNote = (f: number): { note: string; midi: number; centsOff: number } => {
  const midi = Math.round(69 + 12 * Math.log2(f / A4));
  const nearest = midiToFreq(midi);
  const centsOff = Math.round(1200 * Math.log2(f / nearest));
  return { note: midiToNote(midi), midi, centsOff };
};

export class TunerEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private raf = 0;
  private buffer: Float32Array | null = null;
  public onPitch: ((state: "silent" | "detecting" | "inTune" | "outOfTune", info: { note: string; centsOff: number; freq: number; midi: number }) => void) | null = null;
  public onError: ((message: string) => void) | null = null;
  public targetMidi: number | null = null;
  public active = false;

  async start(): Promise<void> {
    if (this.mediaStream) { this.active = true; return; }
    const ctx = guitar.ensure(); this.ctx = ctx;
    ctx.resume().catch(() => {});
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e: any) {
      const msg = e?.name === "NotAllowedError"
        ? "Microphone blocked. Allow it in your browser to tune."
        : e?.name === "NotFoundError"
        ? "No microphone found on this device."
        : (e?.message || "Tuner couldn't start.");
      if (this.onError) this.onError(msg);
      throw e;
    }
    this.mediaStream = stream;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    this.analyser = analyser;
    this.buffer = new Float32Array(analyser.fftSize);
    this.active = true;
    this.loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.analyser = null;
    this.buffer = null;
    this.active = false;
  }

  private loop = () => {
    const analyser = this.analyser; const buffer = this.buffer;
    if (!analyser || !buffer || !this.onPitch) { this.raf = requestAnimationFrame(this.loop); return; }
    analyser.getFloatTimeDomainData(buffer as Float32Array<ArrayBuffer>);
    const f = this.detectPitch(buffer);
    if (!f || f < 60 || f > 1400) {
      this.onPitch("silent", { note: "\u2014", centsOff: 0, freq: 0, midi: 0 });
    } else {
      const { note, centsOff, midi } = freqToNearestNote(f);
      if (this.targetMidi) {
        const diff = midi - this.targetMidi;
        if (Math.abs(diff) === 0 && Math.abs(centsOff) <= 6) this.onPitch("inTune", { note, centsOff, freq: f, midi });
        else this.onPitch("outOfTune", { note, centsOff, freq: f, midi });
      } else {
        this.onPitch("detecting", { note, centsOff, freq: f, midi });
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  // YIN-lite autocorrelation (fast, robust for guitar fundamentals).
  private detectPitch(buf: Float32Array): number | null {
    const SIZE = buf.length;
    let rms = 0; for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.008) return null;
    let bestOffset = -1, bestCorr = 0;
    const sampleRate = this.ctx!.sampleRate;
    const minLag = Math.floor(sampleRate / 1400);
    const maxLag = Math.floor(sampleRate / 60);
    const corr: number[] = new Array(maxLag - minLag + 1);
    let ci = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      for (let i = 0; i < SIZE - lag; i++) c += buf[i] * buf[i + lag];
      c = c / (SIZE - lag);
      corr[ci++] = c;
      if (c > bestCorr) { bestCorr = c; bestOffset = lag; }
    }
    if (bestOffset === -1 || bestCorr < 0.05) return null;
    // Quadratic interpolation around the best lag for precision.
    const i = bestOffset - minLag;
    const y0 = corr[Math.max(0, i - 1)] ?? bestCorr;
    const y1 = corr[i];
    const y2 = corr[Math.min(corr.length - 1, i + 1)] ?? bestCorr;
    const denom = (y0 + y2 - 2 * y1);
    const shift = denom === 0 ? 0 : (0.5 * (y0 - y2) / denom);
    return sampleRate / Math.max(1, bestOffset + shift);
  }
}

export const tuner = new TunerEngine();

export { TUNINGS, tuningById, openStringMidis, playReferenceTone, noteToMidi, midiToNote, midiToFreq };
