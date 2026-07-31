// Guitarnada theory engine — offline, deterministic, the contract for all music math.
// Source-of-truth: ~/Guitarnada/guitarnada-spec/THEORY_ENGINE.md
// Every comparison is "from the root" — never by letters. This rule is the whole product.

export type NoteClass =
  | "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B"
  | "Db" | "Eb" | "Gb" | "Ab" | "Bb";

export const NOTE_CLASSES: NoteClass[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

const SEMI_TO_NAME_SHARP: Record<number, NoteClass> = {
  0: "C", 1: "C#", 2: "D", 3: "D#", 4: "E", 5: "F",
  6: "F#", 7: "G", 8: "G#", 9: "A", 10: "A#", 11: "B",
};

// Key-with-sharps vs key-with-flats spelling preference (circle of fifths)
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);
const SEMI_TO_NAME_FLAT: Record<number, NoteClass> = {
  0: "C", 1: "Db", 2: "D", 3: "Eb", 4: "E", 5: "F",
  6: "Gb", 7: "G", 8: "Ab", 9: "A", 10: "Bb", 11: "B",
};

// Normalize a note (possibly a flat spelling) back to its sharp-canonical index.
const SHARP_BY_NAME: Record<string, number> = {};
Object.entries(SEMI_TO_NAME_SHARP).forEach(([k, v]) => { SHARP_BY_NAME[v] = Number(k); });
Object.entries(SEMI_TO_NAME_FLAT).forEach(([k, v]) => { if (!(v in SHARP_BY_NAME)) SHARP_BY_NAME[v] = Number(k); });

export type ChordQuality =
  | "maj" | "min" | "dim" | "aug" | "sus2" | "sus4"
  | "maj7" | "m7" | "dom7" | "dim7" | "m7b5" | "add9"
  | "madd9" | "6" | "m6" | "6/9" | "maj9" | "9" | "7sus4" | "other";

export type ScaleType =
  | "ionian" | "aeolian" | "majorPenta" | "minorPenta"
  | "dorian" | "mixolydian" | "harmMinor" | "blues";

export const SCALE_OFFSETS: Record<ScaleType, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  majorPenta: [0, 2, 4, 7, 9],
  minorPenta: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmMinor: [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 3, 5, 6, 7, 10],
};

export type Mood =
  | "cozy" | "dreamy" | "melancholy" | "hopeful"
  | "nostalgic" | "angry" | "dark" | "uplifting";

export const MOOD_LABELS: Record<Mood, string> = {
  cozy: "Cozy", dreamy: "Dreamy", melancholy: "Melancholy", hopeful: "Hopeful",
  nostalgic: "Nostalgic", angry: "Angry", dark: "Dark", uplifting: "Uplifting",
};

export type Genre =
  | "indieFolk" | "pop" | "lofi" | "bedroomPop"
  | "singerSongwriter" | "cinematic" | "rockish";

export const GENRE_LABELS: Record<Genre, string> = {
  indieFolk: "Indie Folk", pop: "Pop", lofi: "Lo-fi", bedroomPop: "Bedroom Pop",
  singerSongwriter: "Singer-songwriter", cinematic: "Cinematic", rockish: "Rock-ish",
};

export type Complexity =
  | "simple" | "rich" | "adventurous"
  | "sparse" | "lush" | "jazzy" | "mixed";

// === Pitch math ===
export const semiOf = (note: NoteClass): number => SHARP_BY_NAME[note];

export const pitchAt = (root: NoteClass, semi: number, preferFlats = false): NoteClass => {
  const r = semiOf(root);
  const target = ((r + semi) % 12 + 12) % 12;
  return preferFlats ? SEMI_TO_NAME_FLAT[target] : SEMI_TO_NAME_SHARP[target];
};

export const buildMajorScale = (root: NoteClass, keyName?: string): NoteClass[] => {
  const preferFlats = keyName ? FLAT_KEYS.has(keyName) : false;
  return SCALE_OFFSETS.ionian.map((o) => pitchAt(root, o, preferFlats));
};

export const buildScale = (
  root: NoteClass,
  type: ScaleType,
  keyName?: string
): NoteClass[] => {
  const preferFlats = keyName ? FLAT_KEYS.has(keyName) : false;
  return SCALE_OFFSETS[type].map((o) => pitchAt(root, o, preferFlats));
};

// === Triad & extension offsets → quality ===
const QUALITY_BY_OFFSETS: Record<string, ChordQuality> = {
  "0,4,7": "maj", "0,3,7": "min", "0,3,6": "dim", "0,4,8": "aug",
  "0,2,7": "sus2", "0,5,7": "sus4",
  "0,4,7,11": "maj7", "0,3,7,10": "m7", "0,4,7,10": "dom7",
  "0,3,6,9": "dim7", "0,3,6,10": "m7b5",
  "0,4,7,14": "add9", "0,3,7,14": "madd9",
  "0,4,7,9": "6", "0,3,7,9": "m6",
  "0,2,4,7": "6/9", "0,4,7,11,14": "maj9", "0,4,7,10,14": "9",
  "0,5,7,10": "7sus4",
};

export interface Chord {
  root: NoteClass;
  quality: ChordQuality;
  notes: NoteClass[];
  offsets: number[];
  displayName: string;
}

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "", min: "m", dim: "dim", aug: "aug",
  sus2: "sus2", sus4: "sus4",
  maj7: "maj7", m7: "m7", dom7: "7", dim7: "dim7", m7b5: "m7b5",
  add9: "add9", madd9: "m(add9)", "6": "6", m6: "m6",
  "6/9": "6/9", maj9: "maj9", "9": "9", "7sus4": "7sus4",
  other: "?",
};

export const makeChord = (root: NoteClass, quality: ChordQuality): Chord => {
  const offsets = OFFSETS_BY_QUALITY[quality] ?? [0, 4, 7];
  const notes = offsets.map((o) => pitchAt(root, o));
  return {
    root,
    quality,
    notes,
    offsets,
    displayName: `${root}${QUALITY_SUFFIX[quality]}`,
  };
};

const OFFSETS_BY_QUALITY: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  "6": [0, 4, 7, 9], m6: [0, 3, 7, 9],
  "6/9": [0, 2, 4, 7], maj9: [0, 4, 7, 11, 14],
  "9": [0, 4, 7, 10, 14], "7sus4": [0, 5, 7, 10],
  other: [0, 4, 7],
};

// === Name an arbitrary set of notes ===
export interface NameResult {
  quality: ChordQuality;
  displayName: string;
  offsets: number[];
  closest?: ChordQuality[];
}

export const nameChord = (notes: NoteClass[]): NameResult => {
  if (notes.length < 2) return { quality: "other", displayName: "?", offsets: [] };
  // Try each note as the root; pick the one with the best matching template.
  let best: { quality: ChordQuality; offsetsSorted: string; rootIdx: number } | null = null;
  for (let i = 0; i < notes.length; i++) {
    const rootIdx = semiOf(notes[i]);
    const offsets = notes
      .map((n) => (((semiOf(n) - rootIdx) % 12) + 12) % 12)
      .sort((a, b) => a - b);
    const key = offsets.join(",");
    if (QUALITY_BY_OFFSETS[key]) {
      best = { quality: QUALITY_BY_OFFSETS[key], offsetsSorted: key, rootIdx };
      break;
    }
  }
  if (best) {
    const root = NOTE_CLASSES[best.rootIdx];
    const offsets = best.offsetsSorted.split(",").map(Number);
    return {
      quality: best.quality,
      offsets,
      displayName: `${root}${QUALITY_SUFFIX[best.quality]}`,
    };
  }
  // Closest-3 fallback: smallest Hamming-style distance against all templates
  const candidates: { q: ChordQuality; dist: number }[] = [];
  const rootIdx = semiOf(notes[0]);
  const offsetSet = new Set(
    notes.map((n) => (((semiOf(n) - rootIdx) % 12) + 12) % 12)
  );
  for (const [key, q] of Object.entries(QUALITY_BY_OFFSETS)) {
    const tmplSet = new Set(key.split(",").map(Number));
    let dist = 0;
    for (let s = 0; s < 12; s++) {
      const inChord = offsetSet.has(s);
      const inTmpl = tmplSet.has(s);
      if (inChord !== inTmpl) dist += 1;
    }
    candidates.push({ q, dist });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  const root = NOTE_CLASSES[rootIdx];
  return {
    quality: "other",
    offsets: [...offsetSet].sort((a, b) => a - b),
    displayName: `${root}?`,
    closest: candidates.slice(0, 3).map((c) => c.q),
  };
};

// === Parse a chord SYMBOL string ("F", "Am7", "Cadd9", "Bb", "F#m") into a Chord object ===
const SYMBOL_QUALITY_RE: { re: RegExp; quality: ChordQuality }[] = [
  { re: /^maj7$/, quality: "maj7" },
  { re: /^m7b5$/, quality: "m7b5" },
  { re: /^m\(add9\)$/, quality: "madd9" },
  { re: /^m(\d+)?add9$/, quality: "madd9" },
  { re: /^add9$/, quality: "add9" },
  { re: /^aug$/, quality: "aug" },
  { re: /^dim7$/, quality: "dim7" },
  { re: /^dim$/, quality: "dim" },
  { re: /^(sus|sus4)$/, quality: "sus4" },
  { re: /^sus2$/, quality: "sus2" },
  { re: /^maj9$/, quality: "maj9" },
  { re: /^7sus4$/, quality: "7sus4" },
  { re: /^6\/9$/, quality: "6/9" },
  { re: /^m6$/, quality: "m6" },
  { re: /^6$/, quality: "6" },
  { re: /^m7$/, quality: "m7" },
  { re: /^7$/, quality: "dom7" },
  { re: /^9$/, quality: "9" },
  { re: /^m$/, quality: "min" },
];

export const parseChordSymbol = (symbol: string): { chord: Chord | null; matchedName: string } => {
  const s = symbol.trim();
  if (!s) return { chord: null, matchedName: "" };
  // root
  const m = s.match(/^([A-Ga-g])([#b\u266F\u266D]?)(.*)$/u);
  if (!m) return { chord: null, matchedName: s };
  let rootChar = m[1].toUpperCase();
  const accidental = m[2] || "";
  const tail = m[3] || "";
  const rootStr = `${rootChar}${accidental}`;
  const rootSemi = SHARP_BY_NAME[rootStr];
  if (rootSemi == null) {
    // try numeric enharmonic fallback
    const direct: Record<string, number> = { "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11 };
    if (direct[rootStr] == null) return { chord: null, matchedName: s };
  }
  const root = NOTE_CLASSES[(SHARP_BY_NAME[rootStr] + 12) % 12] ?? (rootChar as NoteClass);
  // quality from tail
  let quality: ChordQuality = "maj";
  const cleanedTail = tail.replace(/\s/g, "");
  if (cleanedTail) {
    const found = SYMBOL_QUALITY_RE.find((e) => e.re.test(cleanedTail));
    if (found) quality = found.quality;
    else quality = "other";
  }
  try {
    void rootChar;
    const chord = makeChord(root as NoteClass, quality);
    return { chord, matchedName: chord.displayName };
  } catch (e) {
    return { chord: null, matchedName: s };
  }
};

// === Parse inline lyric-chord notation: "[F] This is a [G] test." ===
export interface ParsedLyricChord { symbol: string; offset: number; }
export interface ParsedLyrics {
  text: string;                            // raw text with chords stripped? we keep BOTH variants
  textWithChords: string;                  // original
  chords: ParsedLyricChord[];              // ordered list of [symbol, charOffset-within-stripped-text]
}
export const parseInlineLyrics = (raw: string): ParsedLyrics => {
  const chords: ParsedLyricChord[] = [];
  let stripped = "";
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "[") {
      const end = raw.indexOf("]", i);
      if (end === -1) { stripped += raw.slice(i); break; }
      const sym = raw.slice(i + 1, end);
      chords.push({ symbol: sym, offset: stripped.length });
      i = end + 1;
    } else {
      stripped += ch;
      i++;
    }
  }
  return { text: stripped, textWithChords: raw, chords };
};

export const collectInlineChordSymbols = (lyrics: string): string[] => {
  const re = /\[([^\]]+)\]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(lyrics))) out.push(m[1].trim());
  // stable, unique, preserve order
  return Array.from(new Set(out));
};

// === Diatonic chords ===
// Major-key pattern: I ii iii IV V vi vii°
const MAJOR_TRIAD_QUALITIES: ChordQuality[] = [
  "maj", "min", "min", "maj", "maj", "min", "dim",
];
// Natural-minor-key pattern: i ii° III iv v VI VII
const MINOR_TRIAD_QUALITIES: ChordQuality[] = [
  "min", "dim", "maj", "min", "min", "maj", "maj",
];

export interface Key { tonic: NoteClass; type: "maj" | "min"; }

export const diatonicChords = (key: Key): Chord[] => {
  const scale =
    key.type === "maj"
      ? buildMajorScale(key.tonic, `${key.tonic}maj`)
      : buildScale(key.tonic, "aeolian", `${key.tonic}min`);
  const qualities = key.type === "maj" ? MAJOR_TRIAD_QUALITIES : MINOR_TRIAD_QUALITIES;
  return scale.slice(0, 7).map((root, i) => makeChord(root, qualities[i]));
};

// Roman numerals
const ROMAN_MAJ: Record<number, string> = { 0: "I", 1: "ii", 2: "iii", 3: "IV", 4: "V", 5: "vi", 6: "vii°" };
const ROMAN_MIN: Record<number, string> = { 0: "i", 1: "ii°", 2: "III", 3: "iv", 4: "v", 5: "VI", 6: "VII" };

export const romanOf = (chord: Chord, key: Key): string | null => {
  const diatonic = diatonicChords(key);
  const idx = diatonic.findIndex((c) => c.root === chord.root && c.quality === chord.quality);
  if (idx < 0) return null;
  return key.type === "maj" ? ROMAN_MAJ[idx] : ROMAN_MIN[idx];
};

// === Function table for "Why does it sound good" ===
export type ChordFunction = "tonic" | "subdominant" | "dominant" | "predominant" | "tonicSub" | "borrowedIv";
export const chordFunction = (chord: Chord, key: Key): ChordFunction => {
  const r = romanOf(chord, key);
  if (!r) {
    // borrowed iv (parallel minor borrow): in major key, a minor iv chord
    if (key.type === "maj" && chord.root === pitchAt(key.tonic, 5) && chord.quality === "min") {
      return "borrowedIv";
    }
    return "subdominant";
  }
  if (["I", "i"].includes(r)) return "tonic";
  if (["IV", "iv", "ii", "ii°"].includes(r)) return "predominant";
  if (["V", "vii°"].includes(r)) return "dominant";
  if (["vi", "iii", "VI", "III"].includes(r)) return "tonicSub";
  return "subdominant";
};

// === Deterministic seeded RNG (Mulberry32) ===
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashStr = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// === Mood → function weights (Cozy × Indie Folk default bucket) ===
// Per-degreepool weights per bar; normalized when used.
type BarWeights = Record<string, number>;
const DEFAULT_BAR_WEIGHTS: BarWeights[] = [
  { I: 0.55, vi: 0.30, IV: 0.15 },
  { V: 0.20, IV: 0.30, ii: 0.25, vi: 0.25 },
  { vi: 0.50, IV: 0.30, I: 0.20 },
  { IV: 0.50, I: 0.30, V: 0.20 },
];

// Template progressions (one-line descriptions for the explainer)
interface ProgTemplate { degrees: string[]; reason: string; }
const TEMPLATES: Record<string, ProgTemplate> = {
  "I,V,vi,IV": { degrees: ["I", "V", "vi", "IV"], reason: "The pop home shape. vi shifts the mood before opening up to IV." },
  "vi,IV,I,V": { degrees: ["vi", "IV", "I", "V"], reason: "The emotional flip of the pop shape. Starting on vi turns it wistful." },
  "I,vi,IV,V": { degrees: ["I", "vi", "IV", "V"], reason: "Hopeful, classic. The 50s arc." },
  "I,IV,V,IV": { degrees: ["I", "IV", "V", "IV"], reason: "The folk campfire — three big chords with IV cycling around I." },
  "i,VII,III,VII": { degrees: ["i", "VII", "III", "VII"], reason: "Aeolian rock — three big steps in the minor key." },
  "ii,V,I,vi": { degrees: ["ii", "V", "I", "vi"], reason: "A jazz-leaning turnaround pulled to pop." },
};

// Resolve a Roman numeral to a diatonic chord on a key
const ROMAN_TO_DEGREE_IDX: Record<string, number> = {
  I: 0, i: 0, ii: 1, "ii°": 1, iii: 2, III: 2, IV: 3, iv: 3,
  V: 4, v: 4, vi: 5, VI: 5, "vii°": 6, VII: 6,
};

// === Progression generation (deterministic from seed, mood, genre, key, complexity) ===
export interface Progression {
  key: Key;
  chords: Chord[];
  romans: (string | null)[];
  pattern: string;
  reason: string;
  bpm: number;
}

export interface Roll {
  seed: number;
  mood: Mood;
  genre: Genre;
  key: Key;
  complexity: Complexity;
  progression: Progression;
  moodDescriptor: string;
}

const MOOD_BPM: Record<Mood, number> = {
  cozy: 92, dreamy: 76, melancholy: 70, hopeful: 106,
  nostalgic: 96, angry: 138, dark: 84, uplifting: 120,
};

const MOOD_DESCRIPTOR: Record<Mood, string> = {
  cozy: "warm / nostalgic",
  dreamy: "low-lit / drifting",
  melancholy: "rain against glass",
  hopeful: "first light / patient",
  nostalgic: "a fire, two chords left",
  angry: "no release / taut",
  dark: "below the floorboards",
  uplifting: "lifted / open windows",
};

const BOTH: (keyof typeof ROMAN_TO_DEGREE_IDX)[] = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];

const pickWeighted = (rng: () => number, weights: BarWeights): string => {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
};

export interface GenerateOpts {
  // When false, the generator retries seeds up to `barreFreeAttempts` times so
  // every chord in the roll has a name present in `barreFreeNames` (an open/non-barre
  // voicing). If no such roll is found, it falls back to the last attempt — and the
  // fretboard resolver independently guarantees no barre is ever drawn.
  barreEnabled?: boolean;
  barreFreeNames?: Set<string>;
  barreFreeAttempts?: number;
}

// Probability that a given bar's diatonic triad gets a 7th/extension color, per complexity.
const COMPLEXITY_COLOR_PROB: Record<Complexity, number> = {
  simple: 0, sparse: 0, rich: 0.45, adventurous: 0.45,
  lush: 0.72, jazzy: 0.9, mixed: 0.55,
};

// Apply the per-complexity extension mutation to a single Roman-degree token.
// Returns the (possibly extended) degree token. Consumes `rng` once per mutation attempted.
const colorDegree = (
  rng: () => number,
  d: string,
  complexity: Complexity
): string => {
  const p = COMPLEXITY_COLOR_PROB[complexity];
  if (p <= 0 || rng() >= p) return d;

  if (complexity === "jazzy") {
    // Jazz: 7ths everywhere; maj9 on I, 9 on V, m7b5 on vii°.
    if (d === "I") return rng() < 0.5 ? "Imaj9" : "I7maj";
    if (d === "IV") return "IV7maj";
    if (d === "V") return rng() < 0.5 ? "V9" : "V7";
    if (d === "ii") return "ii7";
    if (d === "vi") return "vi7";
    if (d === "vii°") return "viiø7"; // half-diminished (m7b5)
    return d;
  }
  if (complexity === "lush") {
    // Lush: 7ths + add9/sus colors. add9 on I, sus4 on V, maj7 on IV.
    if (d === "I") return rng() < 0.5 ? "Iadd9" : "I7maj";
    if (d === "IV") return "IV7maj";
    if (d === "V") return rng() < 0.5 ? "Vsus4" : "V7";
    if (d === "ii") return "ii7";
    if (d === "vi") return rng() < 0.5 ? "vi7" : "vi"; // keep some plain minors
    if (d === "iii") return "iii7";
    return d;
  }
  // rich / adventurous / mixed → classic 7th coloring
  if (d === "I") return "I7maj";
  if (d === "IV") return "IV7maj";
  if (d === "V") return "V7";
  if (d === "ii") return "ii7";
  if (d === "vi") return "vi7";
  return d;
};

// Parse an extended degree token ("Imaj9", "V9", "Vsus4", "viiø7", "I7maj", "V7", "ii7",
// "iv"…) into a base roman + a target quality. Returns null for plain triads handled inline.
const resolveExtQuality = (d: string): { base: string; quality: ChordQuality | null } => {
  if (d === "Imaj9") return { base: "I", quality: "maj9" };
  if (d === "Iadd9") return { base: "I", quality: "add9" };
  if (d === "I7maj") return { base: "I", quality: "maj7" };
  if (d === "IV7maj") return { base: "IV", quality: "maj7" };
  if (d === "V9") return { base: "V", quality: "9" };
  if (d === "V7") return { base: "V", quality: "dom7" };
  if (d === "Vsus4") return { base: "V", quality: "sus4" };
  if (d === "ii7") return { base: "ii", quality: "m7" };
  if (d === "iii7") return { base: "iii", quality: "m7" };
  if (d === "vi7") return { base: "vi", quality: "m7" };
  if (d === "viiø7") return { base: "vii°", quality: "m7b5" };
  return { base: d, quality: null };
};

const rollOnce = (
  seed: number,
  mood: Mood,
  genre: Genre,
  key: Key,
  complexity: Complexity
): Roll => {
  const rng = mulberry32(hashStr(`${seed}|${mood}|${genre}|${key.tonic}|${key.type}|${complexity}`));
  const diatonic = diatonicChords(key);

  // First try: weighted pick from DEFAULT_BAR_WEIGHTS (Cozy × Indie Folk bucket).
  let degrees = DEFAULT_BAR_WEIGHTS.map((w) => pickWeighted(rng, w));

  // Sparse: prefer fewer chord changes — repeat the first chord into bar 2, and the
  // third into bar 4, with high probability. The harmony stays open and breath-y.
  if (complexity === "sparse") {
    if (rng() < 0.7) degrees[1] = degrees[0];
    if (rng() < 0.6) degrees[3] = degrees[2];
  }

  // Smooth: bias against pathological shapes (no I → vii° with no resolution enforced at start/end).
  if (degrees[0] === "vii°") degrees[0] = "I";
  if (degrees[degrees.length - 1] === "vii°") degrees[degrees.length - 1] = "I";

  // Complexity coloring (per-bar). "mixed" lets each bar roll rich/lush/jazzy flavor.
  degrees = degrees.map((d) => {
    if (complexity === "mixed") {
      const pick = ["rich", "lush", "jazzy", "adventurous"][Math.floor(rng() * 4)] as Complexity;
      return colorDegree(rng, d, pick);
    }
    return colorDegree(rng, d, complexity);
  });

  // Adventurous: borrowed iv + secondary dominant (only on adventurous — not on mixed).
  if (complexity === "adventurous") {
    if (rng() < 0.20) degrees[2] = "iv"; // borrowed iv
    if (rng() < 0.10) degrees[1] = "V/IV"; // secondary dominant placeholder (resolves to IV)
  }

  // Resolve degree tokens → chords
  const chords: Chord[] = degrees.map((d) => {
    const ext = resolveExtQuality(d);
    const idx = ROMAN_TO_DEGREE_IDX[ext.base] ?? 0;
    const base = diatonic[idx];
    if (ext.quality == null) {
      if (ext.base === "iv" && key.type === "maj") return makeChord(pitchAt(key.tonic, 5), "min");
      return base;
    }
    // Map the requested quality onto the diatonic root, preserving major/minor family:
    if (ext.quality === "maj7" && base.quality === "maj") return makeChord(base.root, "maj7");
    if (ext.quality === "maj7" && base.quality === "min") return makeChord(base.root, "m7");
    if (ext.quality === "dom7" && base.quality === "maj") return makeChord(base.root, "dom7");
    if (ext.quality === "dom7" && base.quality === "min") return makeChord(base.root, "m7");
    if (ext.quality === "maj9" && base.quality === "maj") return makeChord(base.root, "maj9");
    if (ext.quality === "maj9" && base.quality === "min") return makeChord(base.root, "m7"); // fall back to m7
    if (ext.quality === "9" && base.quality === "maj") return makeChord(base.root, "9");
    if (ext.quality === "9" && base.quality === "min") return makeChord(base.root, "m7");
    if (ext.quality === "add9" && base.quality === "maj") return makeChord(base.root, "add9");
    if (ext.quality === "add9" && base.quality === "min") return makeChord(base.root, "madd9");
    if (ext.quality === "sus4") return makeChord(base.root, "sus4");
    if (ext.quality === "m7" && base.quality === "min") return makeChord(base.root, "m7");
    if (ext.quality === "m7b5") return makeChord(base.root, "m7b5");
    return base;
  });
  const romans = chords.map((c) => romanOf(c, key));

  // Reason: match against known template by roman pattern
  const pattern = romans.filter(Boolean).join(",");
  let reason = `Built from ${key.tonic} ${key.type === "maj" ? "major" : "minor"}. The harmony pulls toward home.`;
  for (const t of Object.values(TEMPLATES)) {
    if (t.degrees.join(",") === pattern) { reason = t.reason; break; }
  }

  return {
    seed,
    mood,
    genre,
    key,
    complexity,
    moodDescriptor: MOOD_DESCRIPTOR[mood],
    progression: { key, chords, romans, pattern, reason, bpm: MOOD_BPM[mood] },
  };
};

export const generateRoll = (
  seed: number,
  mood: Mood,
  genre: Genre,
  key: Key,
  complexity: Complexity,
  opts: GenerateOpts = {}
): Roll => {
  const { barreEnabled = true, barreFreeNames, barreFreeAttempts = 80 } = opts;
  if (barreEnabled || !barreFreeNames || barreFreeNames.size === 0) {
    return rollOnce(seed, mood, genre, key, complexity);
  }
  // Barre-off mode: retry seeds until every chord lands on a name with a known
  // open (non-barre) voicing in the chosen tuning. This keeps the harmony intact
  // — we never substitute chords, only search for a seed whose diatonic draw is
  // barre-free. If we exhaust the attempts we return the last candidate; the
  // fretboard resolver independently guarantees no barre is ever drawn.
  let last = rollOnce(seed, mood, genre, key, complexity);
  const hasAll = (r: Roll) => r.progression.chords.every((c) => barreFreeNames.has(c.displayName));
  if (hasAll(last)) return last;
  for (let attempt = 1; attempt < barreFreeAttempts; attempt++) {
    const candidate = rollOnce(seed + attempt, mood, genre, key, complexity);
    last = candidate;
    if (hasAll(candidate)) return candidate;
  }
  return last;
};

// === One-tap transformations ===
export interface TransformationResult {
  roll: Roll;
  reason: string;
}

// Pure mutation core — no barre awareness. Mutates `next.progression.chords` in place
// and returns the one-line reason. The "darker" branch may regenerate the progression,
// forwarding `opts` so the regenerated roll also respects the barre filter.
const applyMutation = (
  next: Roll,
  transformation: "sadder" | "cozier" | "darker" | "moreHopeful" | "moreIndie" | "simpler",
  opts: GenerateOpts
): string => {
  const chords = next.progression.chords;
  let reason = "";

  switch (transformation) {
    case "sadder": {
      chords.forEach((c, i) => {
        if (c.quality === "maj" && (i === 2 || i === 3)) {
          chords[i] = makeChord(c.root, "min");
        }
      });
      // Borrowed iv in last bar if any chord there is maj IV
      if (chords[3].quality === "maj" && romanOf(chords[3], next.key) === "IV") {
        chords[3] = makeChord(pitchAt(next.key.tonic, 5), "min");
      }
      reason = "Drops the 3rd on the lift — flips the mood bittersweet.";
      break;
    }
    case "cozier": {
      chords.forEach((c, i) => {
        if (c.quality === "maj" && (i === 0 || i === 3)) chords[i] = makeChord(c.root, "maj7");
        if (c.quality === "min" && i === 2) chords[i] = makeChord(c.root, "m7");
      });
      reason = "Sevenths warm up the harmony.";
      break;
    }
    case "darker": {
      // Force tonic to minor — express the parallel-minor borrow. Regenerate so the
      // new minor-key progression is theory-correct; forward barre opts.
      next.key = { tonic: next.key.tonic, type: "min" };
      next.progression = generateRoll(next.seed + 1, next.mood, next.genre, next.key, next.complexity, opts).progression;
      reason = "Borrows from the dark twin — parallel-minor key.";
      break;
    }
    case "moreHopeful": {
      chords.forEach((c, i) => {
        if (c.quality === "min" && (romanOf(c, next.key) === "vi" || romanOf(c, next.key) === "iii")) {
          chords[i] = makeChord(c.root, "maj");
        }
      });
      reason = "Lifts the relatives vi/iii up to their major forms.";
      break;
    }
    case "moreIndie": {
      chords.forEach((c, i) => {
        if (c.quality === "maj" && i === 0) chords[i] = makeChord(c.root, "add9");
        if (c.quality === "min" && i === 2) chords[i] = makeChord(c.root, "sus2");
      });
      reason = "Open voicings — add9 on I, sus2 on the lift.";
      break;
    }
    case "simpler": {
      chords.forEach((c, i) => {
        if (c.quality === "maj7") chords[i] = makeChord(c.root, "maj");
        if (c.quality === "m7") chords[i] = makeChord(c.root, "min");
        if (c.quality === "dom7") chords[i] = makeChord(c.root, "maj");
        if (c.quality === "add9" || c.quality === "sus2" || c.quality === "sus4") chords[i] = makeChord(c.root, c.quality === "sus2" ? "min" : "maj");
      });
      reason = "Back to the triads.";
      break;
    }
  }

  // Recompute romans & pattern
  next.progression.romans = chords.map((c) => romanOf(c, next.key));
  next.progression.pattern = next.progression.romans.filter(Boolean).join(",");
  return reason;
};

export const applyTransformation = (
  roll: Roll,
  transformation: "sadder" | "cozier" | "darker" | "moreHopeful" | "moreIndie" | "simpler",
  opts: GenerateOpts = {}
): TransformationResult => {
  const { barreEnabled = true, barreFreeNames, barreFreeAttempts = 80 } = opts;
  const noBarre = barreEnabled === false && !!barreFreeNames && barreFreeNames.size > 0;

  // First attempt on the actual source roll.
  const first: Roll = JSON.parse(JSON.stringify(roll));
  const reason = applyMutation(first, transformation, opts);
  if (!noBarre) return { roll: first, reason };

  const hasAll = (r: Roll) => r.progression.chords.every((c) => barreFreeNames!.has(c.displayName));
  if (hasAll(first)) return { roll: first, reason };

  // Barre-off: the in-place mutation produced a barre-only chord (rare — e.g. a
  // relative lifted to a root with no open shape). Re-roll the SOURCE seed and re-apply
  // the same transformation deterministically until the result is barre-free (capped).
  // We never substitute chords by hand — we only search seed-space, so the harmony
  // stays whatever the engine + the transformation legitimately produce.
  for (let attempt = 1; attempt < barreFreeAttempts; attempt++) {
    const source = generateRoll(roll.seed + attempt, roll.mood, roll.genre, roll.key, roll.complexity, opts);
    const candidate: Roll = JSON.parse(JSON.stringify(source));
    const candReason = applyMutation(candidate, transformation, opts);
    if (hasAll(candidate)) return { roll: candidate, reason: candReason };
  }
  // Last resort — keep the first result; the fretboard resolver guarantees no barre is drawn.
  return { roll: first, reason };
};

// === Offline explain engine ===
export interface ExplainResponse {
  headline: string;
  body: string;
  miniExplainer?: string;
  usedFallback: boolean;
}

export const explainProgression = (roll: Roll): ExplainResponse => {
  const head = roll.progression.reason;
  // Pull one function sentence from the key
  const firstRoman = roll.progression.romans[0];
  const transitions: string[] = [];
  for (let i = 0; i < roll.progression.chords.length - 1; i++) {
    const a = roll.progression.chords[i];
    const b = roll.progression.chords[i + 1];
    const fa = chordFunction(a, roll.key);
    const fb = chordFunction(b, roll.key);
    if (fa === "dominant" && fb === "tonic") transitions.push("V pulls home");
    if (fa === "tonic" && fb === "tonicSub") transitions.push("tonic→vi is wistful");
    if (fa === "tonic" && fb === "subdominant") transitions.push("IV opens things up");
    if (fa === "tonicSub" && fb === "subdominant") transitions.push("vi → IV shifts the mood");
  }
  const body = transitions.length
    ? `${transitions.slice(0, 2).join("; ")}.`
    : `In ${roll.key.tonic} ${roll.key.type === "maj" ? "major" : "minor"}, the harmony circles home.`;
  return {
    headline: head.split(".")[0] || head,
    body,
    usedFallback: true,
  };
};

export const explainChordQuality = (chord: Chord): ExplainResponse => {
  if (chord.quality === "maj") {
    return {
      headline: "It's the 3rd.",
      body: `From ${chord.root}, ${chord.notes[1]} is a major 3rd (4 semitones); ${chord.notes.join("-")} makes it major.`,
      miniExplainer: `From ${chord.root}, the 3rd is ${chord.notes[1]}.\nThat's 4 semitones — a major 3rd.\n${chord.notes.join("-")} → major.\nMove the 3rd down one fret and it flips to minor.`,
      usedFallback: true,
    };
  }
  if (chord.quality === "min") {
    return {
      headline: "It's the 3rd.",
      body: `From ${chord.root}, ${chord.notes[1]} is a minor 3rd (3 semitones); ${chord.notes.join("-")} makes it minor.`,
      miniExplainer: `From ${chord.root}, the 3rd is ${chord.notes[1]}.\nThat's 3 semitones — a minor 3rd.\n${chord.notes.join("-")} → minor.\nRaise the 3rd a semitone and it flips to major.`,
      usedFallback: true,
    };
  }
  if (chord.quality === "dim") {
    return {
      headline: "The unstable one.",
      body: "Stack two minor 3rds — it wants to resolve.",
      usedFallback: true,
    };
  }
  if (chord.quality === "sus4" || chord.quality === "sus2") {
    return {
      headline: "The open one.",
      body: "The 3rd is replaced — so it's neither major nor minor yet.",
      usedFallback: true,
    };
  }
  return {
    headline: `${chord.displayName}.`,
    body: `Offset form ${chord.offsets.join("-")}, built from ${chord.root}.`,
    usedFallback: true,
  };
};

// Audio — synth chord tone playback via Web Audio API
let audioCtx: AudioContext | null = null;
const getCtx = (): AudioContext => {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
};

const noteToFreq = (note: NoteClass, octave = 4): number => {
  const semi = semiOf(note);
  const a4 = 69;
  const midi = 12 * (octave - 4) + 12 + semi;
  return 440 * Math.pow(2, (midi - a4) / 12);
};

export const playChord = (chord: Chord, durationMs = 1100): void => {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const dur = durationMs / 1000;
    chord.notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = noteToFreq(n, i === 0 ? 4 : 4);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    });
  } catch (e) {
    // silent — audio is best-effort, never blocks
  }
};

export const playNote = (note: NoteClass, durationMs = 500): void => {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const dur = durationMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = noteToFreq(note);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch (e) {
    // silent
  }
};

// ============================================================
// "Chords that go well with X" engine
// Given a chord, returns candidate companion chords with weight + a plain-language reason.
// Strategy: infer a likely key from the chord (major root → I of the major key, minor root → i or vi),
// then rank diatonic chords by harmonic function proximity + classic pair tables.
// ============================================================

export interface CompanionSuggestion {
  chord: Chord;
  weight: number;       // 0..1, higher = more idiomatic
  reason: string;       // one-sentence plain-English note
}

// Classic songwriting pair scores (regardless of key) keyed by roman role pairs.
// Used to bias the diatonic reordering.
const PAIR_BONUS: Record<string, number> = {
  "I->V": 0.30, "V->I": 0.35, "I->IV": 0.28, "IV->I": 0.26,
  "vi->IV": 0.24, "IV->V": 0.22, "V->vi": 0.20, "ii->V": 0.28,
  "IV->vi": 0.18, "I->vi": 0.18, "vi->V": 0.15, "V->IV": 0.12,
};

// Infer one or two likely keys for a chord.
const inferLikelyKeys = (chord: Chord): Key[] => {
  const keys: Key[] = [];
  if (chord.quality === "maj" || chord.quality === "maj7" || chord.quality === "add9" || chord.quality === "sus2" || chord.quality === "sus4" || chord.quality === "dom7" || chord.quality === "6") {
    keys.push({ tonic: chord.root, type: "maj" });
    // also possibly IV-of (so chord = V): add the key a fifth below
    keys.push({ tonic: pitchAt(chord.root, -7), type: "maj" });
    // or it's the relative major of a minor key (vi): key a third below
    keys.push({ tonic: pitchAt(chord.root, -3), type: "min" });
  } else if (chord.quality === "min" || chord.quality === "m7" || chord.quality === "m6" || chord.quality === "madd9") {
    keys.push({ tonic: chord.root, type: "min" });
    // could be vi of a major key (relative minor): key a minor third above
    keys.push({ tonic: pitchAt(chord.root, 3), type: "maj" });
  } else {
    keys.push({ tonic: chord.root, type: "maj" });
  }
  return keys;
};

export const companionsFor = (chord: Chord, limit = 8): CompanionSuggestion[] => {
  const keys = inferLikelyKeys(chord);
  const tally = new Map<string, { chord: Chord; weight: number; reason: string }>();
  for (const k of keys) {
    const diatonic = diatonicChords(k);
    const idx = diatonic.findIndex((c) => c.root === chord.root && (c.quality === chord.quality || isSameFamily(c.quality, chord.quality)));
    const homeRoman = idx >= 0 ? (k.type === "maj" ? ROMAN_MAJ[idx] : ROMAN_MIN[idx]) : "?";
    diatonic.forEach((c, i) => {
      if (c.root === chord.root && c.quality === chord.quality) return; // skip self
      const roman = k.type === "maj" ? ROMAN_MAJ[i] : ROMAN_MIN[i];
      const pair = `${homeRoman}->${roman}`;
      const bonus = PAIR_BONUS[pair] ?? 0.05;
      // function-based base weight: tonic-submediant хороош; dominant strong
      const fn = chordFunction(c, k);
      let base = 0.5;
      if (fn === "tonic") base = 0.7;
      if (fn === "dominant") base = 0.66;
      if (fn === "predominant") base = 0.6;
      if (fn === "subdominant") base = 0.55;
      if (fn === "tonicSub") base = 0.58;
      const weight = Math.min(1, base + bonus);
      const reason = functionReason(fn, roman, k);
      const dup = tally.get(c.displayName);
      if (!dup || dup.weight < weight) tally.set(c.displayName, { chord: c, weight, reason });
    });
  }
  return Array.from(tally.values()).sort((a, b) => b.weight - a.weight).slice(0, limit);
};

const isSameFamily = (a: ChordQuality, b: ChordQuality): boolean => {
  const majFamily = new Set(["maj", "maj7", "add9", "6", "sus2", "sus4"]);
  const minFamily = new Set(["min", "m7", "m6", "madd9"]);
  if (majFamily.has(a) && majFamily.has(b)) return true;
  if (minFamily.has(a) && minFamily.has(b)) return true;
  return a === b;
};

const functionReason = (fn: ChordFunction, roman: string, key: Key): string => {
  switch (fn) {
    case "tonic": return `${roman} is home — lands the phrase.`;
    case "dominant": return `${roman} pulls back home, adds tension.`;
    case "predominant": return `${roman} opens the door before the push.`;
    case "subdominant": return `${roman} lifts away from the root.`;
    case "tonicSub": return `${roman} is the wistful relative — softens the mood.`;
    case "borrowedIv": return `${roman} is a borrowed minor iv — bittersweet lift.`;
    default: return `${roman} in ${key.tonic} ${key.type === "maj" ? "major" : "minor"}.`;
  }
};

// === Feeling direction suggestions ===
// Given the chords you've already used, suggest a *direction* + a chord to add next.
export interface FeelingSuggestion {
  direction: string;       // one-line feeling note
  addChord: Chord;         // concrete suggestion
}

export const suggestNextFeeling = (used: Chord[]): FeelingSuggestion | null => {
  if (!used.length) return null;
  const baseKey = inferLikelyKeys(used[0])[0];
  const diatonic = diatonicChords(baseKey);
  // count missing diatonic chords
  const usedNames = new Set(used.map((c) => c.displayName));
  const missing = diatonic.filter((c) => !usedNames.has(c.displayName));
  // Heuristic: if no minor vi used yet → suggest it (wistful). If no IV → suggest (open). If no V → dominant push.
  const minor = missing.find((c) => c.quality === "min") ?? diatonic.find((c) => c.quality === "min");
  const subdom = missing.find((c) => romanOf(c, baseKey) === (baseKey.type === "maj" ? "IV" : "iv")) ?? diatonic.find((c) => romanOf(c, baseKey) && romanOf(c, baseKey)!.startsWith("I"));
  const dom = missing.find((c) => romanOf(c, baseKey) === (baseKey.type === "maj" ? "V" : "v")) ?? diatonic[4];
  let pick: Chord | null = null;
  let direction = "";
  const majors = used.filter((c) => c.quality === "maj" || c.quality === "maj7");
  const minors = used.filter((c) => c.quality === "min" || c.quality === "m7");
  if (majors.length >= 2 && minors.length === 0 && minor) {
    pick = minor;
    direction = "You've got big open majors. A minor here would soften it — wistful turn.";
  } else if (minors.length >= 1 && subdom) {
    pick = subdom;
    direction = "You've already gone minor. A IV would open the lift up.";
  } else if (dom) {
    pick = dom;
    direction = "Add a V to give the next line somewhere to resolve.";
  } else if (missing[0]) {
    pick = missing[0];
    direction = `Try ${missing[0].displayName} — it's in the key and you haven't used it yet.`;
  }
  if (!pick) return null;
  return { direction, addChord: pick };
};

// ============================================================
// Chord simplification — "simplified chords that sound similar."
// Two layers:
//   1. simplifyChord(chord)     — strip a single chord to its closest simpler form.
//   2. simplifyProgression(...)  — reduce a whole progression to triads, with an
//      optional barre-free revoice that swaps barre-only chords for the nearest
//      diatonic relative that has an open shape (preserves harmonic function).
// ============================================================

// Quality rank: lower = simpler/more common. Used to pick "the closest simpler chord".
const QUALITY_RANK: Record<ChordQuality, number> = {
  maj: 0, min: 0, sus2: 4, sus4: 4,
  dom7: 1, maj7: 2, m7: 2, "6": 2, m6: 3,
  add9: 3, madd9: 4, "6/9": 6, maj9: 7, "9": 6, dim7: 8, m7b5: 8,
  dim: 5, aug: 5, "7sus4": 9, other: 99,
};

export interface SimplifyResult {
  chord: Chord;          // the resulting, simpler chord
  changed: boolean;       // whether any reduction was applied
  reason: string;         // one-line plain-English note
}

// Reduce a single chord's color down toward a plain triad, keeping the root + family.
export const simplifyChord = (chord: Chord): SimplifyResult => {
  const q = chord.quality;
  if (q === "maj" || q === "min" || q === "dim" || q === "aug") return { chord, changed: false, reason: "Already a plain triad." };

  // Everything else: strip to the same-family triad.
  let baseQuality: ChordQuality;
  let reason: string;
  if (q === "maj7" || q === "dom7" || q === "add9" || q === "maj9" || q === "6" || q === "6/9" || q === "7sus4") {
    baseQuality = "maj";
    reason = "Strips the color — back to a major triad.";
  } else if (q === "m7" || q === "madd9" || q === "m6") {
    baseQuality = "min";
    reason = "Strips the color — back to a minor triad.";
  } else if (q === "dim7" || q === "m7b5") {
    baseQuality = "dim";
    reason = "Strips the 7th — back to a diminished triad.";
  } else if (q === "sus2" || q === "sus4") {
    baseQuality = "maj";
    reason = "Resolves the suspension to a major triad.";
  } else {
    baseQuality = "maj";
    reason = "Back to a triad.";
  }

  const next = makeChord(chord.root, baseQuality);
  return { chord: next, changed: true, reason };
};

// Whole-progression simplification: strip every chord to its family triad, then
// (when `preferBarreFree` is true) swap any chord whose simplest triad would still be
// a barre-only chord for its nearest diatonic relative that has an open shape.
// Returns a new progression writes nothing — the caller assigns.
export const simplifyProgression = (
  chords: Chord[],
  key: Key,
  preferBarreFree = false,
  barreFreeNames?: Set<string>
): { chords: Chord[]; reasons: string[] } => {
  const reasons: string[] = [];
  let simplified = chords.map((c) => {
    const r = simplifyChord(c);
    reasons.push(r.reason);
    return r.chord;
  });

  if (preferBarreFree && barreFreeNames && barreFreeNames.size > 0) {
    const diatonic = diatonicChords(key);
    simplified = simplified.map((c, i) => {
      if (barreFreeNames.has(c.displayName)) return c;
      // Find the nearest diatonic chord (by roman proximity) that has an open shape and
      // is in the same broad family (maj→maj, min→min) when possible.
      const famMatch = diatonic.find((d) =>
        d.quality === c.quality && barreFreeNames.has(d.displayName)
      );
      const famAny = diatonic.find((d) => barreFreeNames.has(d.displayName));
      const sub = famMatch ?? famAny;
      if (sub) {
        reasons[i] = `${c.displayName} is a barre on standard tuning → swapped for ${sub.displayName} (same key, sounds similar).`;
        return sub;
      }
      return c;
    });
  }

  return { chords: simplified, reasons };
};
