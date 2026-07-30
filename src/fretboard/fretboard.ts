// Guitarnada fretboard engine — maps a Chord to a per-string fingering (fret + finger 1-4 + mute/open)
// over the chosen tuning. Ships a hand-built library of beginner-friendly open chords augmented by a
// principled barre-shape generator so any chord in any key can be voiced somewhere on the neck.

import { tuningById, openStringMidis, type Tuning, noteToMidi, TUNINGS, DEFAULT_TUNING_ID } from "../audio/guitar";
import { NOTE_CLASSES, semiOf, type NoteClass, type ChordQuality } from "../theory/engine";

export interface Fingering {
  // per-string spec, string index 0 = the lowest string in our string array (low E)
  specs: StringSpec[];
  capoHint?: number;
  baseFret?: number; // explicit starting fret for the diagram window
}
export type StringSpec =
  | { state: "mute" }
  | { state: "open" }
  | { state: "fretted"; fret: number; finger: 1 | 2 | 3 | 4 };

const fingersFor = (frets: number[]): (1 | 2 | 3 | 4)[] => {
  // Assign fingers 1..4 to the lowest 4 distinct fret positions actually pressed.
  const used = Array.from(new Set(frets.filter((f) => f > 0))).sort((a, b) => a - b).slice(0, 4);
  const map = new Map<number, 1 | 2 | 3 | 4>();
  used.forEach((f, i) => map.set(f, (i + 1) as 1 | 2 | 3 | 4));
  return frets.map((f) => (f <= 0 ? 0 : (map.get(f) ?? 4)) as 1 | 2 | 3 | 4);
};

interface ShapeDef { frets: number[]; fingers: number[]; capo?: number; }

// === Hand-built beginner library (Standard tuning) ===
// frets[i]: -1 = mute, 0 = open, >0 = fret. fingers[i]: 0 = open/mute, else 1–4.
// String order: [low E, A, D, G, B, high E]
const LIBRARY_SHAPES: Record<string, ShapeDef> = {
  // open majors
  "C":      { frets: [-1, 3, 2, 0, 1, 0],   fingers: [0, 3, 2, 0, 1, 0] },
  "G":      { frets: [3, 2, 0, 0, 0, 3],   fingers: [2, 1, 0, 0, 0, 4] },
  "D":      { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  "A":      { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  "E":      { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  "F":      { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], capo: 1 },
  "B":      { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], capo: 2 },
  // open minors
  "Am":     { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  "Em":     { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  "Dm":     { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  "Bm":     { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], capo: 2 },
  "Fm":     { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], capo: 1 },
  // 7ths / extensions
  "Fmaj7":  { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  "Cadd9":  { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
  "G6":     { frets: [3, 2, 0, 0, 0, 0], fingers: [2, 1, 0, 0, 0, 0] },
  "Gsus2":  { frets: [3, 2, 0, 0, 3, 3], fingers: [1, 1, 0, 0, 3, 4], capo: 3 },
  "Gsus4":  { frets: [3, 2, 0, 0, 1, 3], fingers: [2, 1, 0, 0, 3, 4] },
  "Am7":    { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  "Dm7":    { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  "Dmaj7":  { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
  "Em7":    { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  "Cmaj7":  { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  "A7":     { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  "E7":     { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  "D7":     { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  "B7":     { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 1] },
};

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "", min: "m", dim: "dim", aug: "aug",
  sus2: "sus2", sus4: "sus4",
  maj7: "maj7", m7: "m7", dom7: "7", dim7: "dim7", m7b5: "m7b5",
  add9: "add9", madd9: "m(add9)", "6": "6", m6: "m6",
  "6/9": "6/9", maj9: "maj9", "9": "9", "7sus4": "7sus4",
  other: "",
};

export const chordToName = (root: NoteClass, quality: ChordQuality): string => `${root}${QUALITY_SUFFIX[quality]}`;

// === Chord-tone interval sets ===
const TRIAD_OFFSETS: Record<ChordQuality, Set<number>> = {
  maj: new Set([0, 4, 7]), min: new Set([0, 3, 7]), dim: new Set([0, 3, 6]), aug: new Set([0, 4, 8]),
  sus2: new Set([0, 2, 7]), sus4: new Set([0, 5, 7]),
  maj7: new Set([0, 4, 7, 11]), m7: new Set([0, 3, 7, 10]), dom7: new Set([0, 4, 7, 10]),
  dim7: new Set([0, 3, 6, 9]), m7b5: new Set([0, 3, 6, 10]),
  add9: new Set([0, 4, 7, 14]), madd9: new Set([0, 3, 7, 14]),
  "6": new Set([0, 4, 7, 9]), m6: new Set([0, 3, 7, 9]),
  "6/9": new Set([0, 2, 4, 7, 9]), maj9: new Set([0, 4, 7, 11, 14]),
  "9": new Set([0, 4, 7, 10, 14]), "7sus4": new Set([0, 5, 7, 10]),
  other: new Set([0, 4, 7]),
};

// === Movable barre shapes ===
// E-shape (root on low-E string) and A-shape (root on A string) templates.
// offsets relative to the barre fret on the root-bearing string.
const E_SHAPE: Partial<Record<ChordQuality, number[]>> = {
  maj:  [0, 2, 2, 1, 0, 0],
  min:  [0, 2, 2, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  m7:   [0, 2, 0, 0, 0, 0],
  dom7: [0, 2, 0, 1, 0, 0],
  m7b5:[0, 2, 0, 0, 1, 0],
  sus4:[0, 2, 2, 2, 0, 0],
};
const A_SHAPE: Partial<Record<ChordQuality, number[]>> = {
  maj:  [0, 0, 2, 2, 2, 0],
  min:  [0, 0, 2, 2, 1, 0],
  maj7: [0, 0, 2, 1, 2, 0],
  m7:   [0, 0, 2, 0, 1, 0],
  dom7: [0, 0, 2, 0, 2, 0],
  sus2: [0, 0, 2, 2, 2, 5],
  dim:  [0, 0, 3, 1, 2, 0],
  "6":  [0, 0, 2, 2, 2, 2],
};

// Number of fret windows the diagram renders. Kept in sync with ChordDiagram's default.
const visibleFretsCount = 5;

const generateBarre = (root: NoteClass, quality: ChordQuality, tuning: Tuning): Fingering | null => {
  const openMidis = openStringMidis(tuning);
  const rootSemi = semiOf(root);
  const chordSet = TRIAD_OFFSETS[quality];

  const tryShape = (rootString: number, shape: number[]): Fingering | null => {
    const openRootMidi = openMidis[rootString];
    const openRootClass = ((openRootMidi % 12) + 12) % 12;
    // find a barre fret (>=1) so that rootString open+barre = our root pitch class
    let barre = (rootSemi - openRootClass + 12) % 12;
    if (barre < 1) barre += 12;
    if (barre > 14) return null;
    const frets: (number | null)[] = shape.map((o, s) => {
      if (s < rootString) return null; // mute strings not in the shape
      const f = barre + o;
      if (f < 0) return null;
      return f;
    });
    // barre spans every fretted string at the barre fret; mute top ones below rootString
    const specs: StringSpec[] = frets.map((f, s) => {
      if (f == null) return { state: s < rootString ? "mute" : "open" } as StringSpec;
      if (f === 0) return { state: "open" } as StringSpec;
      return { state: "fretted", fret: f, finger: 0 as 1 | 2 | 3 | 4 } as StringSpec;
    });
    // assign fingers
    const pressed = specs.map((sp) => (sp.state === "fretted" ? sp.fret : 0));
    const fing = fingersFor(pressed);
    specs.forEach((sp, i) => {
      if (sp.state === "fretted") sp.finger = fing[i] as 1 | 2 | 3 | 4;
    });
    // Sanity: every sounded note must be a chord tone.
    const ok = specs.every((sp, s) => {
      if (sp.state !== "fretted" && sp.state !== "open") return true;
      const midi = openMidis[s] + (sp.state === "fretted" ? sp.fret : 0);
      const off = (((midi - rootSemi) % 12) + 12) % 12;
      return chordSet.has(off);
    });
    if (!ok) return null;
    const maxFret = Math.max(...pressed.filter((f) => f > 0), barre);
    // If the highest fret doesn't fit in the 5-fret window from the nut (baseFret 1),
    // shift the diagram's base fret so all pressed notes stay on-screen.
    const needsShift = maxFret > visibleFretsCount;
    return { specs, capoHint: barre >= 4 ? barre : undefined, baseFret: needsShift ? barre : 1 };
  };
  void rootSemi;
  // Prefer E-shape when available, else A-shape.
  if (E_SHAPE[quality]) {
    const r = tryShape(0, E_SHAPE[quality]!);
    if (r) return r;
  }
  if (A_SHAPE[quality]) {
    const r = tryShape(1, A_SHAPE[quality]!);
    if (r) return r;
  }
  return null;
};

// Main resolver: try the library (standard tuning only), then the barre generator, then ad-hoc triad.
export const fingeringForChord = (root: NoteClass, quality: ChordQuality, tuningId = DEFAULT_TUNING_ID): Fingering => {
  const tuning = tuningById(tuningId);
  if (tuning.id === DEFAULT_TUNING_ID) {
    const name = chordToName(root, quality);
    if (LIBRARY_SHAPES[name]) {
      const def = LIBRARY_SHAPES[name];
      const fingers = def.fingers.length === def.frets.length ? def.fingers : fingersFor(def.frets);
      return {
        specs: def.frets.map((f, i) => {
          if (f === -1) return { state: "mute" } as StringSpec;
          if (f === 0) return { state: "open" } as StringSpec;
          return { state: "fretted", fret: f, finger: (fingers[i] || 1) as 1 | 2 | 3 | 4 } as StringSpec;
        }),
        capoHint: def.capo,
        baseFret: 1,
      };
    }
  }
  const barre = generateBarre(root, quality, tuning);
  if (barre) return barre;
  return adHocTriad(root, quality, tuning);
};

const adHocTriad = (root: NoteClass, quality: ChordQuality, tuning: Tuning): Fingering => {
  const openMidis = openStringMidis(tuning);
  const chordSet = TRIAD_OFFSETS[quality] ?? TRIAD_OFFSETS.maj;
  const rootSemi = semiOf(root);
  // Greedy: for each capo 0..7, fill top strings (G,B,e) with chord tones.
  let best: { frets: (number | null)[]; capo: number } | null = null;
  for (let capo = 0; capo <= 4 && !best; capo++) {
    const frets: (number | null)[] = [null, null, null, null, null, null];
    const notesHit = new Set<number>();
    for (let s = 5; s >= 3; s--) {
      for (let f = 0; f <= 4; f++) {
        const midi = openMidis[s] + capo + f;
        const off = (((midi - rootSemi) % 12) + 12) % 12;
        if (chordSet.has(off) && frets[s] === null) { frets[s] = capo + f; notesHit.add(off); break; }
      }
    }
    if (notesHit.has(0) && (notesHit.has(3) || notesHit.has(4))) best = { frets, capo };
  }
  const frets = best?.frets ?? [null, null, null, 0, 0, 0];
  const pressed = frets.map((f) => (f == null ? 0 : f));
  const fing = fingersFor(pressed);
  const specs: StringSpec[] = frets.map((f, i) => {
    if (f == null) return { state: i >= 3 ? "open" : "mute" } as StringSpec;
    if (f === 0) return { state: "open" } as StringSpec;
    return { state: "fretted", fret: f, finger: fing[i] as 1 | 2 | 3 | 4 } as StringSpec;
  });
  return { specs, baseFret: 1 };
};

// === Midis to play for a Fingering (only the sounded strings) ===
export const fingeringToPlayableMidis = (fing: Fingering, tuning: Tuning): number[] => {
  const openMidis = openStringMidis(tuning);
  return fing.specs
    .map((s, i): number | null => {
      if (s.state === "mute") return null;
      if (s.state === "open") return openMidis[i];
      return openMidis[i] + s.fret;
    })
    .filter((m): m is number => m != null);
};

export const noteAtPosition = (stringIdx: number, fret: number, tuning: Tuning): NoteClass => {
  const open = openStringMidis(tuning)[stringIdx];
  const midi = open + fret;
  return NOTE_CLASSES[((midi % 12) + 12) % 12] as NoteClass;
};

export interface ChordView { root: NoteClass; quality: ChordQuality; name: string; fingering: Fingering; }
export const makeChordView = (root: NoteClass, quality: ChordQuality, tuningId = DEFAULT_TUNING_ID): ChordView => {
  return {
    root,
    quality,
    name: chordToName(root, quality),
    fingering: fingeringForChord(root, quality, tuningId),
  };
};

export const findClosestPosition = (midi: number, tuning: Tuning): { stringIdx: number; fret: number } => {
  const openMidis = openStringMidis(tuning);
  let best = { stringIdx: 0, fret: 0, diff: 1e9 };
  for (let s = 0; s < openMidis.length; s++) {
    const fret = midi - openMidis[s];
    if (fret >= 0 && fret <= 24) {
      const diff = Math.abs(fret);
      if (diff < best.diff) best = { stringIdx: s, fret, diff };
    }
  }
  return best;
};

export { TUNINGS, noteToMidi };
