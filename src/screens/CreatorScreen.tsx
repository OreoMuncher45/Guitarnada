import { useState } from "react";
import { useStore, type TransformationKind, KEY_TO_STRING, TUNINGS, tuningById, patternById, ALL_PATTERNS } from "../store/game";
import { MOOD_LABELS, GENRE_LABELS, type Mood, type Genre, type Key, type Complexity, NOTE_CLASSES } from "../theory/engine";
import { ChordDiagram } from "../components/ChordDiagram";
import { DiceIcon, PlayIcon, CapoIcon, MetronomeIcon, ArrowIcon } from "../icons";
import { guitar, midiToNote, openStringMidis } from "../audio/guitar";
import { makeChordView, fingeringToPlayableMidis } from "../fretboard/fretboard";

const MOODS = Object.keys(MOOD_LABELS) as Mood[];
const GENRES = Object.keys(GENRE_LABELS) as Genre[];
const KEYS: Key[] = NOTE_CLASSES.flatMap((n) => [
  { tonic: n, type: "maj" as const },
  { tonic: n, type: "min" as const },
]);
const keyLabel = (k: Key) => `${k.tonic} ${k.type === "maj" ? "Maj" : "min"}`;

const COMPLEXITIES: { id: Complexity; label: string }[] = [
  { id: "simple", label: "Simple" },
  { id: "sparse", label: "Sparse" },
  { id: "rich", label: "Rich" },
  { id: "lush", label: "Lush" },
  { id: "adventurous", label: "Adventurous" },
  { id: "jazzy", label: "Jazzy" },
  { id: "mixed", label: "Mixed" },
];

const TRANSFORMATIONS: { kind: TransformationKind; label: string }[] = [
  { kind: "sadder", label: "Sadder" },
  { kind: "cozier", label: "Cozier" },
  { kind: "darker", label: "Darker" },
  { kind: "moreHopeful", label: "More hopeful" },
  { kind: "moreIndie", label: "More indie" },
  { kind: "simpler", label: "Simpler" },
];

export function CreatorScreen() {
  const mood = useStore((s) => s.mood);
  const genre = useStore((s) => s.genre);
  const key = useStore((s) => s.key);
  const complexity = useStore((s) => s.complexity);
  const barreEnabled = useStore((s) => s.barreEnabled);
  const roll = useStore((s) => s.currentRoll);
  const rollerAnimation = useStore((s) => s.rollerAnimation);
  const tuningId = useStore((s) => s.tuningId);
  const capo = useStore((s) => s.capo);
  const bpm = useStore((s) => s.bpm);
  const strumPatternId = useStore((s) => s.strumPatternId);
  const setMood = useStore((s) => s.setMood);
  const setGenre = useStore((s) => s.setGenre);
  const setKey = useStore((s) => s.setKey);
  const setComplexity = useStore((s) => s.setComplexity);
  const setBarre = useStore((s) => s.setBarre);
  const setTuningId = useStore((s) => s.setTuningId);
  const setCapo = useStore((s) => s.setCapo);
  const setBpm = useStore((s) => s.setBpm);
  const setStrum = useStore((s) => s.setStrum);
  const triggerRollAnimation = useStore((s) => s.triggerRollAnimation);
  const rollAction = useStore((s) => s.roll);
  const rollAgain = useStore((s) => s.rollAgain);
  const transform = useStore((s) => s.transform);
  const playCurrentChord = useStore((s) => s.playCurrentChord);
  const saveRoll = useStore((s) => s.saveRoll);
  const openExplain = useStore((s) => s.openExplain);
  const strumPattern = patternById(strumPatternId)!;

  const [savedFlash, setSavedFlash] = useState(false);

  const handleRoll = () => {
    try { navigator.vibrate?.(28); } catch (e) { void e; }
    if (roll) rollAgain(); else { triggerRollAnimation(); setTimeout(rollAction, 380); }
  };

  const previewPattern = () => {
    if (!roll) return;
    const tuning = tuningById(tuningId);
    guitar.tune(tuning);
    const midis = makeChordView(roll.progression.chords[0].root, roll.progression.chords[0].quality, tuningId, barreEnabled).fingering;
    const playable = fingeringToPlayableMidis(midis, tuning).map((m) => m + capo);
    // walk one bar of the strum pattern through the guitar engine using time-shifted plucks
    const stepMs = (60_000 / bpm) / (strumPattern.beats / 4);
    strumPattern.strokes.forEach((stroke, i) => {
      if (stroke === ".") return;
      const when = guitar.now() + (i * stepMs) / 1000 + 0.05;
      guitar.playChord(playable, { when, strum: stroke === "U" ? "up" : "down", velocity: stroke === "D" ? 0.85 : 0.55 });
    });
  };

  const previewWholeProgression = () => {
    if (!roll) return;
    const tuning = tuningById(tuningId);
    guitar.tune(tuning);
    const barMs = (60_000 / bpm) * 4;
    roll.progression.chords.forEach((c, i) => {
      const midis = fingeringToPlayableMidis(makeChordView(c.root, c.quality, tuningId, barreEnabled).fingering, tuning).map((m) => m + capo);
      guitar.playChord(midis, { when: guitar.now() + (i * barMs) / 1000 + 0.05, strum: "down" });
    });
  };

  return (
    <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>

      {/* === Config rows === */}
      <div className="label" style={{ marginBottom: "1.4rem" }}>Step one · Choose</div>

      <ConfigBlock label="Mood">
        <div className="chip-rail">
          {MOODS.map((m) => (
            <button key={m} className={`chip ${mood === m ? "chip--selected" : ""}`} onClick={() => setMood(m)}>{MOOD_LABELS[m]}</button>
          ))}
        </div>
      </ConfigBlock>

      <ConfigBlock label="Genre">
        <div className="chip-rail">
          {GENRES.map((g) => (
            <button key={g} className={`chip ${genre === g ? "chip--selected" : ""}`} onClick={() => setGenre(g)}>{GENRE_LABELS[g]}</button>
          ))}
        </div>
      </ConfigBlock>

      <ConfigBlock label="Key">
        <div className="chip-rail">
          {KEYS.map((k, i) => (
            <button key={i} className={`chip ${key.tonic === k.tonic && key.type === k.type ? "chip--selected" : ""}`} onClick={() => setKey(k)}>{keyLabel(k)}</button>
          ))}
        </div>
      </ConfigBlock>

      <ConfigBlock label="Tuning">
        <div className="chip-rail">
          {TUNINGS.map((t) => (
            <button key={t.id} className={`chip ${tuningId === t.id ? "chip--selected" : ""}`} onClick={() => setTuningId(t.id)}>{t.label}</button>
          ))}
        </div>
      </ConfigBlock>

      <ConfigBlock label="Complexity">
        <div className="chip-rail">
          {COMPLEXITIES.map((c) => (
            <button key={c.id} className={`chip ${complexity === c.id ? "chip--selected" : ""}`} onClick={() => setComplexity(c.id)}>{c.label}</button>
          ))}
        </div>
      </ConfigBlock>

      <ConfigBlock label="Barre chords">
        <div className="chip-rail">
          <button className={`chip ${barreEnabled ? "chip--selected" : ""}`} onClick={() => setBarre(true)}>On</button>
          <button className={`chip ${!barreEnabled ? "chip--selected" : ""}`} onClick={() => setBarre(false)}>Off</button>
        </div>
        <div className="body-copy body-copy--narrow" style={{ marginTop: "0.7rem", fontSize: "0.84rem" }}>
          {barreEnabled
            ? "Rolls may include barre shapes. Any chord without an open voicing falls back to a movable barre."
            : "Rolls avoid barre chords — the engine searches for seeds whose chords have open-voicing shapes, and any chord diagram that can't be voiced open renders as a compact open-position shape instead. No barre is ever drawn."}
        </div>
      </ConfigBlock>

      {/* === The Roll button (single, with dice animation) === */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "3rem 0 2rem", gap: "1rem" }}>
        <button
          className={`dice-button ${rollerAnimation ? "dice-rolling" : ""}`}
          onClick={handleRoll}
          aria-label={roll ? "Roll again" : "Roll a song"}
          style={{ width: 110, height: 110, borderColor: rollerAnimation ? "var(--accent)" : "var(--hair-strong)" }}
        >
          <DiceIcon width={42} height={42} />
        </button>
        <div className="display display--md" style={{ fontSize: "clamp(1.5rem, 6vw, 2.4rem)" }}>{roll ? "Roll again?" : "Roll"}</div>
        <div className="body-copy body-copy--narrow" style={{ textAlign: "center" }}>{roll ? "Different chords, same mood." : "Tap the dice to write your song."}</div>
      </div>

      {/* === Roll result === */}
      {roll && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem", flexWrap: "wrap", gap: "0.6rem" }}>
            <div>
              <div className="label" style={{ color: "var(--accent)" }}>{roll.moodDescriptor}</div>
              <div className="mono" style={{ marginTop: "0.4rem" }}>{KEY_TO_STRING(roll.key)} · seed {roll.seed.toString(36).toUpperCase()}</div>
            </div>
            <button className="link-underline" onClick={previewWholeProgression} style={{ borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
              <PlayIcon width={12} height={12} /> Preview song
            </button>
          </div>

          {/* Chord cards with diagrams */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: "1.4rem", marginBottom: "2rem" }}>
            {roll.progression.chords.map((c, i) => (
              <div key={i}>
                <ChordDiagram
                  chordName={c.displayName}
                  fingering={makeChordView(c.root, c.quality, tuningId, barreEnabled).fingering}
                  tuningId={tuningId}
                />
                <div className="mono" style={{ marginTop: "0.3rem", color: "var(--ash)" }}>{roll.progression.romans[i] ?? "—"}</div>
              </div>
            ))}
          </div>

          {/* === Why does this sound good === */}
          <button className="link-underline" onClick={() => openExplain({ kind: "roll", roll })} style={{ color: "var(--bone)", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)" }}>
            Why does this sound good?
          </button>

          {/* === Instrument controls === */}
          <div className="cfg-row">
            <CapoIcon width={18} height={18} />
            <span className="cfg-row__label">Capo</span>
            <span className="cfg-row__value">fret {capo}</span>
            <div className="cfg-row__ctrl">
              <button className="chip" onClick={() => setCapo(capo - 1)}>−</button>
              <button className="chip" onClick={() => setCapo(capo + 1)}>+</button>
            </div>
          </div>
          <div className="cfg-row">
            <MetronomeIcon width={18} height={18} />
            <span className="cfg-row__label">Tempo</span>
            <span className="cfg-row__value">{bpm} BPM</span>
            <div className="cfg-row__ctrl">
              <button className="chip" onClick={() => setBpm(bpm - 4)}>−</button>
              <button className="chip" onClick={() => setBpm(bpm + 4)}>+</button>
            </div>
          </div>

          {/* Strum pattern selector + preview */}
          <div style={{ marginTop: "1.5rem" }}>
            <div className="label" style={{ marginBottom: "0.7rem", color: "var(--ash)" }}>Strum / fingerpicking</div>
            <div className="chip-rail" style={{ marginBottom: "0.9rem" }}>
              {ALL_PATTERNS.map((p) => (
                <button key={p.id} className={`chip ${strumPatternId === p.id ? "chip--selected" : ""}`} onClick={() => setStrum(p.id)}>{p.label}</button>
              ))}
            </div>
            <div className="tab-strip">
              {strumPattern.strokes.map((s, i) => (
                <div key={i} className={`tab-beat ${s === "." ? "tab-beat--rest" : "tab-beat--accent"}`}>{s === "." ? "·" : s}</div>
              ))}
            </div>
            <button onClick={previewPattern} className="link-underline" style={{ marginTop: "0.8rem", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
              <PlayIcon width={12} height={12} /> Preview pattern
            </button>
          </div>

          {/* Transform */}
          <div style={{ marginTop: "1.5rem" }}>
            <div className="label" style={{ marginBottom: "0.7rem", color: "var(--ash)" }}>Transform</div>
            <div className="chip-rail">
              {TRANSFORMATIONS.map((t) => (
                <button key={t.kind} className="chip" onClick={() => transform(t.kind)}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Save + next */}
          <div className="action-bar" style={{ marginTop: "2rem" }}>
            <button className="cta" onClick={() => { const id = saveRoll(); if (id) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1400); try { navigator.vibrate?.(20); } catch (e) { void e; } } }}>
              {savedFlash ? "Saved" : "Save song"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function ConfigBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.8rem" }}>
      <div className="label" style={{ marginBottom: "0.7rem", color: "var(--ash)" }}>{label}</div>
      {children}
    </div>
  );
}

void midiToNote; void openStringMidis; void ArrowIcon; // suppress unused-import strict check on tree-shaken symbols
