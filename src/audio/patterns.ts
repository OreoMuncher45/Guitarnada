// Strum & fingerpicking patterns — animated tab + audible preview through the Karplus-Strong engine.
// Each pattern: a sequence of strokes ("D" down / "U" up / "T" thumb / "i"-"m"-"a" pick / "." rest) plus a default tempo, grouped into bars.

export type Stroke = "D" | "U" | "T" | "i" | "m" | "a" | "p" | ".";
export interface Pattern {
  id: string;
  label: string;
  kind: "strum" | "finger";
  beats: number;             // length of one bar in strokes (usually 8 for 4/4)
  strokes: Stroke[];         // length === beats
  complexity: "beginner" | "intermediate";
}

export const STRUMS: Pattern[] = [
  {
    id: "campfire-ddu",
    label: "Campfire — D D U U D U",
    kind: "strum", beats: 8, complexity: "beginner",
    strokes: ["D", ".", "D", "U", "U", "D", "U", "."],
  },
  {
    id: "indie-eighths",
    label: "Indie eighths — D D U D U D U D",
    kind: "strum", beats: 8, complexity: "beginner",
    strokes: ["D", "U", "D", "U", "D", "U", "D", "U"],
  },
  {
    id: "calypso",
    label: "Calypso — D D U U D U",
    kind: "strum", beats: 8, complexity: "intermediate",
    strokes: ["D", ".", "D", "U", ".", "U", "D", "U"],
  },
  {
    id: "heartbeat",
    label: "Heartbeat — D . D . . U . U",
    kind: "strum", beats: 8, complexity: "intermediate",
    strokes: ["D", ".", "D", ".", ".", "U", ".", "U"],
  },
  {
    id: "wonderwall",
    label: "Wonderwall — D . D U . U D .",
    kind: "strum", beats: 8, complexity: "intermediate",
    strokes: ["D", ".", "D", "U", ".", "U", "D", "."],
  },
  {
    id: "rock-fifths",
    label: "Power eighths — D D D D D D D D",
    kind: "strum", beats: 8, complexity: "beginner",
    strokes: ["D", "D", "D", "D", "D", "D", "D", "D"],
  },
];

export const FINGERPICKS: Pattern[] = [
  {
    id: "folk-thumb",
    label: "Folk — T i m i a i m i",
    kind: "finger", beats: 8, complexity: "beginner",
    strokes: ["T", "i", "m", "i", "a", "i", "m", "i"],
  },
  {
    id: "travis-2",
    label: "Travis — T i T m T i T m",
    kind: "finger", beats: 8, complexity: "intermediate",
    strokes: ["T", "i", "T", "m", "T", "i", "T", "m"],
  },
  {
    id: "cascade",
    label: "Cascade — p i m a p i m a",
    kind: "finger", beats: 8, complexity: "intermediate",
    strokes: ["p", "i", "m", "a", "p", "i", "m", "a"],
  },
  {
    id: "rain-soft",
    label: "Soft rain — p p a m i m a m",
    kind: "finger", beats: 8, complexity: "intermediate",
    strokes: ["p", "p", "a", "m", "i", "m", "a", "m"],
  },
];

export const ALL_PATTERNS = [...STRUMS, ...FINGERPICKS];

// string order for strums: D → strings from low→high visualized, U → high→low. Finger-picking assigns to fixed strings.
// fingerpick assignment (per index): T/thumb→bass strings, i→G, m→B, a→high E (one-string-per-finger convention).
const FINGER_TO_STRING_IDX: Record<string, number | "bass"> = {
  T: "bass", p: "bass", i: 3, m: 4, a: 5,
};

export interface PreviewOptions { bpm: number; chordStrings: number[]; tuningStrings: number[]; }

// emit a schedule of string plucks over `bars` for a pattern; receiver uses guitar.pluckString.
export const patternToEvents = (pattern: Pattern, bars = 1, bpm = 92): { stringIdx: number; midi: number; time: number; velocity: number }[] => {
  const stepMs = (60_000 / bpm) / (pattern.beats / 4);   // per-stroke ms = beatMs if beats=8 → eighth
  // map strum 'D'/'U' to velocities (down louder); pattern beats index → stroke direction.
  const events: { stringIdx: number; midi: number; time: number; velocity: number }[] = [];
  // We assume the caller passes the placeholder: we return *relative* time in ms and a stringIdx of -1 for "all strings"
  // for strum strokes (in strum mode the receiver hits all string-voicing strings).
  // For finger mode we set the precise string idx (>0) using FINGER_TO_STRING_IDX.
  for (let bar = 0; bar < bars; bar++) {
    for (let s = 0; s < pattern.strokes.length; s++) {
      const stroke = pattern.strokes[s];
      if (stroke === ".") continue;
      const time = s * stepMs + bar * pattern.beats * stepMs;
      if (pattern.kind === "finger") {
        const which = FINGER_TO_STRING_IDX[stroke] ?? "bass";
        const stringIdx = which === "bass" ? 0 : which;          // T/p generally to bass string — caller resolves a 6-voice chord, choosing midis[0..5]
        events.push({ stringIdx: stringIdx, midi: 0, time, velocity: 0.78 });
      } else {
        events.push({ stringIdx: -1, midi: 0, time, velocity: stroke === "D" ? 0.9 : 0.55 });
      }
    }
  }
  return events;
};

// helper: turn a piano-ish chord view into 6-string playable midis (strum mode hits all voiced)
export const chordToSixMidis = (chordMidis: number[], tuningStrings: number[]): number[] => {
  // chordMidis are arbitrary length. Pad the 6-string vector by mirroring into the lowest open strings when
  // the chord < 6 strings (rare). Use closest voicing strings by greedy nearest pitch in the chord.
  // For the typical 4-or-5-string beginner shape we keep `muted` strings out; caller passes only the pluckable.
  return tuningStrings.map((open) => {
    const closest = chordMidis
      .map((m) => ({ m, diff: Math.abs(m - open) }))
      .sort((a, b) => a.diff - b.diff)[0];
    return closest ? closest.m : open;
  });
};
