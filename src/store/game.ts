import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Roll, Mood, Genre, Key, Complexity, Chord } from "../theory/engine";
import { generateRoll, applyTransformation } from "../theory/engine";
import { guitar, DEFAULT_TUNING_ID, type Tuning, TUNINGS, tuningById, openStringMidis } from "../audio/guitar";
import { makeChordView, fingeringToPlayableMidis } from "../fretboard/fretboard";
import { ALL_PATTERNS, STRUMS, FINGERPICKS, type Pattern } from "../audio/patterns";

const DEFAULT_SEED = (): number => Math.floor(Math.random() * 1e9);
const DEFAULT_KEY: Key = { tonic: "C", type: "maj" };
const KEY_TO_STRING = (k: Key): string => `${k.tonic}${k.type === "maj" ? "maj" : "min"}`;

export type TransformationKind =
  | "sadder" | "cozier" | "darker" | "moreHopeful" | "moreIndie" | "simpler";

export interface LyricLine { type: "lyric" | "section"; text: string; chords: { charOffset: number; chordName: string }[]; }
export interface SavedRoll {
  id: string;
  name: string;
  roll: Roll;
  keyLabel: string;
  feelingTags: string[];
  capo: number;
  bpm: number;
  strumPatternId: string;
  fingerPatternId?: string;
  tuningId: string;
  lyrics: LyricLine[];
  createdAt: number;
}
export interface SavedChord {
  id: string;
  name: string;
  chord: Chord;
  customName?: string;
  feelingTags: string[];
  tuningId: string;
  createdAt: number;
}

interface GameState {
  mood: Mood;
  genre: Genre;
  key: Key;
  complexity: Complexity;
  seed: number;
  currentRoll: Roll | null;
  rollerAnimation: boolean;

  tuningId: string;
  capo: number;
  bpm: number;
  strumPatternId: string;
  fingerPatternId: string;
  volume: number;

  savedRolls: SavedRoll[];
  savedChords: SavedChord[];
  achievements: { key: string; unlockedAt: number; title: string; description: string }[];

  explainOpen: boolean;
  explainTarget: { kind: "roll" | "chord"; roll?: Roll; chord?: Chord; reason?: string } | null;

  installDeferred: any | null;

  setMood: (m: Mood) => void;
  setGenre: (g: Genre) => void;
  setKey: (k: Key) => void;
  setComplexity: (c: Complexity) => void;
  setTuningId: (id: string) => void;
  setCapo: (n: number) => void;
  setBpm: (n: number) => void;
  setStrum: (id: string) => void;
  setFinger: (id: string) => void;
  setVolume: (n: number) => void;

  roll: () => void;
  triggerRollAnimation: () => void;
  rollAgain: () => void;
  transform: (t: TransformationKind) => void;

  saveRoll: (name?: string) => string;
  updateSavedRoll: (id: string, patch: Partial<SavedRoll>) => void;
  removeSavedRoll: (id: string) => void;
  saveChord: (chord: Chord, customName?: string, feelingTags?: string[]) => void;
  removeSavedChord: (id: string) => void;

  openExplain: (target: GameState["explainTarget"]) => void;
  closeExplain: () => void;

  unlockAchievement: (key: string, title: string, description: string) => void;
  setInstallDeferred: (e: any | null) => void;

  playCurrentChord: (chord: Chord, opts?: { strum?: "down" | "up" | "finger"; capo?: number }) => void;
}

export const useStore = create<GameState>()(
  persist(
    (set, get) => ({
      mood: "cozy",
      genre: "indieFolk",
      key: DEFAULT_KEY,
      complexity: "simple",
      seed: DEFAULT_SEED(),
      currentRoll: null,
      rollerAnimation: false,

      tuningId: DEFAULT_TUNING_ID,
      capo: 0,
      bpm: 92,
      strumPatternId: "campfire-ddu",
      fingerPatternId: "folk-thumb",
      volume: 0.5,

      savedRolls: [],
      savedChords: [],
      achievements: [],

      explainOpen: false,
      explainTarget: null,
      installDeferred: null,

      setMood: (m) => set({ mood: m }),
      setGenre: (g) => set({ genre: g }),
      setKey: (k) => set({ key: k }),
      setComplexity: (c) => set({ complexity: c }),
      setTuningId: (id) => { const t = tuningById(id); guitar.ensure(); guitar.tune(t); set({ tuningId: id }); },
      setCapo: (n) => set({ capo: Math.max(0, Math.min(12, n)) }),
      setBpm: (n) => set({ bpm: Math.max(40, Math.min(220, n)) }),
      setStrum: (id) => set({ strumPatternId: id }),
      setFinger: (id) => set({ fingerPatternId: id }),
      setVolume: (n) => { guitar.setVolume(n); set({ volume: n }); },

      roll: () => {
        const s = get();
        const seed = DEFAULT_SEED();
        const roll = generateRoll(seed, s.mood, s.genre, s.key, s.complexity);
        set({ seed, currentRoll: roll, bpm: roll.progression.bpm });
      },

      triggerRollAnimation: () => {
        set({ rollerAnimation: true });
        setTimeout(() => set({ rollerAnimation: false }), 720);
      },

      rollAgain: () => { get().triggerRollAnimation(); setTimeout(() => get().roll(), 380); },

      transform: (t) => {
        const s = get();
        if (!s.currentRoll) return;
        const { roll: next } = applyTransformation(s.currentRoll, t);
        set({ currentRoll: next, key: next.key, explainTarget: { kind: "roll", roll: next } });
      },

      playCurrentChord: (chord, opts) => {
        const s = get();
        try {
          const cv = makeChordView(chord.root, chord.quality, s.tuningId);
          const tuning = tuningById(s.tuningId);
          const midis = fingeringToPlayableMidis(cv.fingering, tuning);
          const capo = opts?.capo ?? s.capo;
          const shifted = midis.map((m) => m + capo);
          guitar.tune(tuning); guitar.resume();
          guitar.playChord(shifted, { strum: opts?.strum ?? "down" });
        } catch (e) { /* best-effort audio */ void e; }
      },

      saveRoll: (name) => {
        const s = get();
        if (!s.currentRoll) return "";
        const id = (crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const now = Date.now();
        const roll = s.currentRoll;
        const tag = roll.moodDescriptor.split(" / ")[0];
        const newSaved: SavedRoll = {
          id,
          name: name ?? `Untitled \u00B7 ${KEY_TO_STRING(roll.key)} \u00B7 ${new Date().toLocaleDateString()}`,
          roll,
          keyLabel: KEY_TO_STRING(roll.key),
          feelingTags: [tag.toLowerCase(), roll.mood.toLowerCase()],
          capo: s.capo, bpm: s.bpm,
          strumPatternId: s.strumPatternId, fingerPatternId: s.fingerPatternId,
          tuningId: s.tuningId, lyrics: [],
          createdAt: now,
        };
        const prevCount = s.savedRolls.length;
        set({ savedRolls: [newSaved, ...s.savedRolls] });
        if (prevCount === 0) get().unlockAchievement("first-roll", "First night", "Saved your first Roll.");
        if (prevCount === 4) get().unlockAchievement("five-songs", "Five songs", "Saved 5 songs.");
        return id;
      },

      updateSavedRoll: (id, patch) => {
        const s = get();
        set({ savedRolls: s.savedRolls.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
      },

      removeSavedRoll: (id) => {
        const s = get();
        set({ savedRolls: s.savedRolls.filter((r) => r.id !== id) });
      },

      saveChord: (chord, customName, feelingTags = []) => {
        const s = get();
        const id = (crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const prevCount = s.savedChords.length;
        set({
          savedChords: [
            { id, name: customName ?? chord.displayName, chord, customName, feelingTags, tuningId: s.tuningId, createdAt: Date.now() },
            ...s.savedChords,
          ],
        });
        if (prevCount === 0) get().unlockAchievement("first-custom-chord", "Made your own", "Saved a custom chord.");
      },

      removeSavedChord: (id) => {
        const s = get();
        set({ savedChords: s.savedChords.filter((c) => c.id !== id) });
      },

      openExplain: (target) => set({ explainOpen: true, explainTarget: target }),
      closeExplain: () => set({ explainOpen: false, explainTarget: null }),

      unlockAchievement: (key, title, description) => {
        const s = get();
        if (s.achievements.find((a) => a.key === key)) return;
        set({ achievements: [...s.achievements, { key, unlockedAt: Date.now(), title, description }] });
      },

      setInstallDeferred: (e) => set({ installDeferred: e }),
    }),
    {
      name: "guitarnada-v2",
      partialize: (s) => ({
        mood: s.mood, genre: s.genre, key: s.key, complexity: s.complexity,
        tuningId: s.tuningId, capo: s.capo, bpm: s.bpm,
        strumPatternId: s.strumPatternId, fingerPatternId: s.fingerPatternId,
        volume: s.volume,
        savedRolls: s.savedRolls, savedChords: s.savedChords, achievements: s.achievements,
      }) as any,
    }
  )
);

export const patternById = (id: string): Pattern | undefined => ALL_PATTERNS.find((p) => p.id === id);
export { KEY_TO_STRING, TUNINGS, tuningById, openStringMidis, type Tuning };
export { ALL_PATTERNS, STRUMS, FINGERPICKS };
export { fingeringToPlayableMidis };
