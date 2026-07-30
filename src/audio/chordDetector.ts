// Guitarnada chord detector — listens to the mic, detects pitches in a short window,
// clusters them into a chord hypothesis, and reports a confidence by matching against the
// known templates in nameChord. Uses the same autocorrelation from the tuner.
import { guitar } from "../audio/guitar";
import { tuner, freqToNearestNote } from "../tuner/tuner";
import { NOTE_CLASSES, semiOf, nameChord, type NoteClass, type ChordQuality } from "../theory/engine";

export interface DetectedChord {
  notes: NoteClass[];
  displayName: string;
  quality: ChordQuality;
  confidence: number;     // 0..1 — how close the cluster is to a known template
  detectedFreqs: number[];
}
export interface ChordDetectorResult {
  state: "silent" | "listening" | "searching" | "found";
  chord: DetectedChord | null;
  micErr?: string;
}

class ChordDetectorEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private raf = 0;
  private buffer: Float32Array | null = null;
  private hits = new Map<string, { count: number; lastFreq: number }>(); // note → freq
  private windowStart = 0;
  public onResult: ((r: ChordDetectorResult) => void) | null = null;
  public active = false;

  async start(): Promise<void> {
    if (this.mediaStream) { this.active = true; this.windowStart = performance.now(); this.hits.clear(); return; }
    const ctx = guitar.ensure(); this.ctx = ctx;
    ctx.resume().catch(() => {});
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.mediaStream = stream;
      const src = ctx.createMediaStreamSource(stream);
      const a = ctx.createAnalyser();
      a.fftSize = 8192;
      a.smoothingTimeConstant = 0;
      src.connect(a);
      this.analyser = a;
      this.buffer = new Float32Array(a.fftSize);
      this.active = true;
      this.windowStart = performance.now();
      this.hits.clear();
      this.loop();
    } catch (e: any) {
      const msg = e?.name === "NotAllowedError" ? "Mic blocked. Allow it to detect chords." : e?.message ?? "Detector couldn't start.";
      this.onResult?.({ state: "silent", chord: null, micErr: msg });
      throw e;
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null; this.analyser = null; this.buffer = null; this.active = false;
  }

  reset() { this.hits.clear(); this.windowStart = performance.now(); }

  private loop = () => {
    const a = this.analyser; const b = this.buffer;
    if (!a || !b || !this.onResult) { this.raf = requestAnimationFrame(this.loop); return; }
    a.getFloatTimeDomainData(b as Float32Array<ArrayBuffer>);
    const f = detectPitch(b, this.ctx!.sampleRate);
    if (f && f >= 60 && f <= 1400) {
      const { note, midi } = freqToNearestNote(f);
      const cur = this.hits.get(note);
      if (cur) cur.count++; else this.hits.set(note, { count: 1, lastFreq: f });
      if (cur) cur.lastFreq = f;
    }
    const now = performance.now();
    const elapsed = now - this.windowStart;
    if (elapsed >= 900) {
      const chord = this.assess();
      if (chord) this.onResult({ state: "found", chord });
      else this.onResult({ state: "searching", chord: null });
      this.hits.clear();
      this.windowStart = now;
    } else {
      this.onResult({ state: "listening", chord: null });
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  // Cluster notes; the strongest-set of pitch classes (≥ 3 distinct) → run nameChord.
  private assess(): DetectedChord | null {
    const arr = Array.from(this.hits.entries());
    if (arr.length < 3) return null;
    // sort by count (most-sustained yields the root hint), drop noise outliers
    arr.sort((a, b) => b[1].count - a[1].count);
    const topNotes: NoteClass[] = arr.slice(0, 6).map(([note]) => note as NoteClass);
    // dedupe pitch classes (E2/E3 should converge as one class via freqToNearestNote note label already)
    const seen = new Set<string>();
    const uniq: NoteClass[] = [];
    topNotes.forEach((n) => { if (!seen.has(n)) { seen.add(n); uniq.push(n); } });
    if (uniq.length < 3) return null;
    const res = nameChord(uniq);
    if (!res || res.quality === "other") {
      return { notes: uniq, displayName: "Searching\u2026", quality: res?.quality ?? "other", confidence: 0.18, detectedFreqs: arr.map(([, v]) => v.lastFreq) };
    }
    // confidence: number of distinct chord-tone pitch classes present vs template size.
    const templateOffsets = nameChordOffsets(res);
    const matched = uniq.filter((n) => templateOffsets.has(((semiOf(n) - semiOf(uniq[0])) % 12 + 12) % 12)).length;
    const confidence = Math.max(0.25, Math.min(1, matched / Math.max(3, templateOffsets.size) + uniq.length / 10));
    return { notes: uniq, displayName: res.displayName, quality: res.quality, confidence, detectedFreqs: arr.map(([, v]) => v.lastFreq) };
  }
}

const nameChordOffsets = (_r: { quality: ChordQuality }): Set<number> => {
  const TABLE: Record<string, number[]> = {
    maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
    sus2: [0, 2, 7], sus4: [0, 5, 7],
    maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
    dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
    add9: [0, 4, 7, 14], "6": [0, 4, 7, 9],
    other: [0, 4, 7],
  };
  return new Set(TABLE[_r.quality] ?? [0, 4, 7]);
};

function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const SIZE = buf.length;
  let rms = 0; for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;
  let bestOffset = -1, bestCorr = 0;
  const minLag = Math.floor(sampleRate / 1400);
  const maxLag = Math.floor(sampleRate / 60);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < SIZE - lag; i++) c += buf[i] * buf[i + lag];
    c /= (SIZE - lag);
    if (c > bestCorr) { bestCorr = c; bestOffset = lag; }
  }
  if (bestOffset === -1 || bestCorr < 0.06) return null;
  return sampleRate / bestOffset;
}

export const chordDetector = new ChordDetectorEngine();
export { tuner };
