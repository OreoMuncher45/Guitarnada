// Analyze store — audio file/mic → key/BPM/chords → Journal + simplification.
// Hybrid: on-device by default; an optional backend URL (per spec ARCHITECTURE.md §3)
// gives higher accuracy when configured + reachable. Offline fallback is automatic
// and silent (the spec's repository rule: the UI never branches on isOnline; the
// repo falls back).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chord, Key, Roll, Progression } from "../theory/engine";
import { simplifyChord, simplifyProgression } from "../theory/engine";
import { analyzeAudioFileOnDevice, type AnalyzeResult, type AnalyzedChord } from "../audio/analyzer";
import { barreFreeChordNames } from "../fretboard/fretboard";

const EMPTY_PROGRESSION: Progression = {
  key: { tonic: "C", type: "maj" },
  chords: [],
  romans: [],
  pattern: "",
  reason: "",
  bpm: 92,
};

export interface AnalyzeState {
  busy: boolean;
  error: string | null;
  result: AnalyzeResult | null;
  // Per-chord simplify reasons surfaced inline alongside simplifyProgression.
  simplifyReasons: string[] | null;
  // Settings — backend URL empty = on-device only. `useBackend` toggle gates it.
  backendUrl: string;
  useBackend: boolean;

  analyze: (file: Blob, name?: string) => Promise<void>;
  reset: () => void;
  setBackendUrl: (url: string) => void;
  setUseBackend: (on: boolean) => void;

  // Build a Roll-shaped object from the detected progression so it can be saved to
  // the Journal exactly like a Creator roll. Returns null if no chords detected.
  analyzeToRoll: () => Roll | null;

  // Per-chord + whole-progression simplification.
  simplifyChordAt: (index: number, barreFreeNames?: Set<string>) => void;
  simplifyWhole: (preferBarreFree: boolean, barreFreeNames?: Set<string>) => void;
}

const analyzeOnBackend = async (file: Blob, backendUrl: string, name?: string): Promise<AnalyzeResult> => {
  const fd = new FormData();
  fd.append("file", file, name ?? "audio");
  const res = await fetch(`${backendUrl.replace(/\/$/, "")}/analyze/audio`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  const data = await res.json();
  return { ...data, onDevice: false } as AnalyzeResult;
};

export const useAnalyzeStore = create<AnalyzeState>()(
  persist(
    (set, get) => ({
      busy: false,
      error: null,
      result: null,
      simplifyReasons: null,
      backendUrl: "",
      useBackend: false,

      reset: () => set({ busy: false, error: null, result: null, simplifyReasons: null }),

      setBackendUrl: (url) => set({ backendUrl: url.trim() }),
      setUseBackend: (on) => set({ useBackend: on }),

      analyze: async (file, name) => {
        set({ busy: true, error: null, result: null, simplifyReasons: null });
        try {
          let result: AnalyzeResult | null = null;
          const s = get();
          if (s.useBackend && s.backendUrl) {
            try { result = await analyzeOnBackend(file, s.backendUrl, name); }
            catch (e) {
              // silent fallback — the spec rule: never let the UI surface a backend
              // error; fall back to on-device and carry on.
              void e;
              result = await analyzeAudioFileOnDevice(file);
            }
          } else {
            result = await analyzeAudioFileOnDevice(file);
          }
          set({ busy: false, result });
        } catch (e: any) {
          set({ busy: false, error: e?.message ?? "Couldn't analyze that audio." });
        }
      },

      analyzeToRoll: () => {
        const r = get().result;
        if (!r || !r.chords.length) return null;
        const chords: Chord[] = r.chords
          .map((c) => c.chord)
          .filter((c): c is Chord => !!c);
        if (!chords.length) return null;
        const key = r.keyObj;
        const romans = chords.map((c) => {
          // romanOf imported lazily via dynamic require is awkward; re-import instead.
          return romanOfLocal(c, key);
        });
        const progression: Progression = {
          key,
          chords,
          romans,
          pattern: romans.filter(Boolean).join(","),
          reason: `Detected in ${key.tonic} ${key.type === "maj" ? "major" : "minor"} from your audio.`,
          bpm: r.bpm,
        };
        const roll: Roll = {
          seed: 0,
          mood: "cozy",
          genre: "indieFolk",
          key,
          complexity: "simple",
          progression,
          moodDescriptor: "from your recording",
        };
        return roll;
      },

      simplifyChordAt: (index, barreFreeNames) => {
        const r = get().result;
        if (!r) return;
        const target = r.chords[index];
        if (!target || !target.chord) return;
        let { chord: simpler, changed, reason } = simplifyChord(target.chord);
        // If the simpler triad is still a barre-only chord and we have the barreFreeNames,
        // fall back to the nearest diatonic relative that has an open shape.
        if (changed && barreFreeNames && barreFreeNames.size > 0 && !barreFreeNames.has(simpler.displayName)) {
          const sub = nearestOpenRelative(simpler, r.keyObj, barreFreeNames);
          if (sub) { simpler = sub; reason = `${target.chordName} → ${simpler.displayName} (closest open shape, same key).`; }
        }
        if (!changed && (!barreFreeNames || barreFreeNames.has(simpler.displayName))) {
          // nothing to do
          return;
        }
        const nextChords = r.chords.slice();
        nextChords[index] = {
          ...target,
          chordName: simpler.displayName,
          chord: simpler,
          roman: romanOfLocal(simpler, r.keyObj),
        };
        set({ result: { ...r, chords: nextChords } });
      },

      simplifyWhole: (preferBarreFree, barreFreeNames) => {
        const r = get().result;
        if (!r) return;
        const original = r.chords.map((c) => c.chord).filter((c): c is Chord => !!c);
        if (!original.length) return;
        const { chords, reasons } = simplifyProgression(original, r.keyObj, preferBarreFree, barreFreeNames);
        const nextChords: AnalyzedChord[] = chords.map((c, i) => ({
          time: r.chords[i]?.time ?? 0,
          bar: r.chords[i]?.bar ?? i,
          chordName: c.displayName,
          chord: c,
          roman: romanOfLocal(c, r.keyObj),
        }));
        set({ result: { ...r, chords: nextChords }, simplifyReasons: reasons });
      },
    }),
    {
      name: "guitarnada-analyze",
      partialize: (s) => ({ backendUrl: s.backendUrl, useBackend: s.useBackend }) as any,
    }
  )
);

// Local romanOf import to avoid a circular dependency surprise — engine exports it.
import { romanOf } from "../theory/engine";
const romanOfLocal = (c: Chord, k: Key) => romanOf(c, k);

const nearestOpenRelative = (chord: Chord, key: Key, barreFreeNames: Set<string>): Chord | null => {
  // Diatonic chords of the key, prefer same quality, then any with an open shape.
  const diatonic = diatonicChordsLocal(key);
  const sameFam = diatonic.find((d) => d.quality === chord.quality && barreFreeNames.has(d.displayName));
  if (sameFam) return sameFam;
  const any = diatonic.find((d) => barreFreeNames.has(d.displayName));
  return any ?? null;
};
import { diatonicChords } from "../theory/engine";
const diatonicChordsLocal = (k: Key): Chord[] => diatonicChords(k);
