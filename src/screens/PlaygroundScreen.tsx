import { useState, useRef, useEffect } from "react";
import { useStore, TUNINGS, tuningById } from "../store/game";
import { NOTE_CLASSES, type NoteClass, type Chord, makeChord, nameChord } from "../theory/engine";
import { ChordDiagram } from "../components/ChordDiagram";
import { PlayIcon, HeartIcon, SparkIcon } from "../icons";
import { guitar, noteToMidi, openStringMidis, midiToFreq } from "../audio/guitar";
import { chordDetector, type DetectedChord } from "../audio/chordDetector";

const COMMON_NAMES = ["C", "G", "D", "A", "E", "Am", "Em", "Dm", "Fmaj7", "Cadd9", "Am7", "Em7", "G6", "Bm", "Dmaj7", "A7", "E7", "D7", "B7", "F", "B"];
const COMMON_QUALITY: Record<string, [NoteClass, any]> = {
  "C": ["C", "maj"], "G": ["G", "maj"], "D": ["D", "maj"], "A": ["A", "maj"], "E": ["E", "maj"],
  "Am": ["A", "min"], "Em": ["E", "min"], "Dm": ["D", "min"], "Bm": ["B", "min"], "F": ["F", "maj"], "B": ["B", "maj"],
  "Fmaj7": ["F", "maj7"], "Cadd9": ["C", "add9"], "Am7": ["A", "m7"], "Em7": ["E", "m7"],
  "G6": ["G", "6"], "Dmaj7": ["D", "maj7"],
  "A7": ["A", "dom7"], "E7": ["E", "dom7"], "D7": ["D", "dom7"], "B7": ["B", "dom7"],
};

export function PlaygroundScreen() {
  const tuningId = useStore((s) => s.tuningId);
  const setTuningId = useStore((s) => s.setTuningId);
  const saveChord = useStore((s) => s.saveChord);
  const openExplain = useStore((s) => s.openExplain);
  const barreEnabled = useStore((s) => s.barreEnabled);
  const tuning = tuningById(tuningId);

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [built, setBuilt] = useState<(number | null)[]>([-1, -1, -1, -1, -1, -1]);

  // derive the built chord live (re-render updates the name as frets get selected)
  const builtNotes: NoteClass[] = [];
  built.forEach((fret, s) => {
    if (fret == null || fret < 0) return;
    const open = noteToMidi(tuning.strings[s]);
    const midi = open + fret;
    builtNotes.push(NOTE_CLASSES[((midi % 12) + 12) % 12] as NoteClass);
  });
  const builtResult = builtNotes.length >= 2 ? nameChord(builtNotes) : null;
  const builtChord: Chord | null = builtResult && builtNotes.length >= 3
    ? { root: builtNotes[0], quality: builtResult.quality, notes: builtNotes, offsets: builtResult.offsets, displayName: builtResult.displayName }
    : null;
  const builtIsReal = !!builtChord && builtChord.quality !== "other";

  // selected-named chord chord object
  const selectedChord: Chord | null = selectedName && COMMON_QUALITY[selectedName] ? makeChord(COMMON_QUALITY[selectedName][0], COMMON_QUALITY[selectedName][1]) : null;

  const playSelected = () => {
    if (!selectedChord) return;
    guitar.resume();
    const cv = makeChordViewImpl(selectedChord.root, selectedChord.quality, tuningId, barreEnabled);
    const midis = fingeringToPlayableMidisImpl(cv.fingering, tuning);
    guitar.playChord(midis, { strum: "down" });
  };

  const playBuilt = () => {
    if (!builtIsReal) return;
    const midis = built.map((fret, s) => (fret == null || fret < 0 ? null : openStringMidis(tuning)[s] + fret)).filter((m): m is number => m != null);
    if (midis.length >= 2) { guitar.resume(); guitar.playChord(midis, { strum: "down" }); }
  };

  const setStringFret = (s: number, fret: number) => {
    setBuilt((prev) => { const next = [...prev]; next[s] = next[s] === fret ? -1 : fret; return next; });
  };

  return (
    <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <div className="label" style={{ marginBottom: "1.4rem" }}>Playground</div>
      <div className="display display--md" style={{ marginBottom: "0.6rem", fontSize: "clamp(1.8rem, 7vw, 3rem)" }}>Make a chord, hear it.</div>
      <div className="body-copy body-copy--narrow" style={{ marginBottom: "2rem" }}>
        Three ways in. Tap a known chord to see hand placements. Build one yourself by tapping frets. Or let the <em>chord detector</em> listen to your guitar and name what you just played.
      </div>

      {/* Tuning */}
      <div className="label" style={{ marginBottom: "0.7rem", color: "var(--ash)" }}>Tuning</div>
      <div className="chip-rail" style={{ marginBottom: "2rem" }}>
        {TUNINGS.map((t) => (
          <button key={t.id} className={`chip ${tuningId === t.id ? "chip--selected" : ""}`} onClick={() => setTuningId(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* === Chord Detector (mic) === */}
      <ChordDetectorCard />

      {/* Mode A: Quick chord picker */}
      <div className="label" style={{ marginTop: "3rem", marginBottom: "0.7rem", color: "var(--ash)" }}>Pick a chord</div>
      <div className="chip-rail" style={{ marginBottom: "1.8rem" }}>
        {COMMON_NAMES.map((n) => (
          <button
            key={n}
            className={`chip ${selectedName === n ? "chip--selected" : ""}`}
            onClick={() => { setSelectedName(n); setTimeout(playSelected, 40); }}
          >
            {n}
          </button>
        ))}
      </div>

      {selectedChord && (
        <div style={{ marginTop: "-1rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <ChordDiagram chordName={selectedName ?? ""} fingering={makeChordViewImpl(selectedChord.root, selectedChord.quality, tuningId, barreEnabled).fingering} tuningId={tuningId} />
          <div>
            <button className="cta" onClick={playSelected} style={{ marginTop: 0 }}><span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}><PlayIcon width={12} height={12} /> Play</span></button>
            <br />
            <button className="link-underline" onClick={() => saveChord(selectedChord, selectedName ?? undefined)} style={{ marginTop: "1rem", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
              <HeartIcon width={12} height={12} /> Save
            </button>
            <br />
            <button className="link-underline" onClick={() => openExplain({ kind: "chord", chord: selectedChord })} style={{ marginTop: "1rem", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)" }}>Why is this {selectedName}?</button>
          </div>
        </div>
      )}

      {/* Mode B: Fret-by-fret builder */}
      <div className="label" style={{ marginTop: "3rem", marginBottom: "0.7rem", color: "var(--ash)" }}>Or build it yourself</div>
      <div className="body-copy body-copy--narrow" style={{ marginBottom: "1rem" }}>Tap a fret on each string. Open is fret 0. Tap again to clear that string.</div>

      <MiniFretboard built={built} onTap={setStringFret} />

      <div className="label" style={{ color: builtIsReal ? "var(--accent)" : "var(--smoke)", marginTop: "1rem" }}>
        {builtChord ? builtChord.displayName : (builtNotes.length > 0 ? `${builtNotes.length} notes \u2014 keep going` : "\u2014")}
      </div>
      <div className="mono" style={{ marginTop: "0.6rem", color: "var(--ash)" }}>{builtChord ? `notes: ${builtNotes.join(" \u00B7 ")} | offsets: [${builtChord.offsets.join("-")}]` : "[\u2014]"}</div>

      <div className="action-bar" style={{ marginTop: "1.6rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
        <button className="cta" onClick={playBuilt} disabled={!builtIsReal} style={{ opacity: builtIsReal ? 1 : 0.3 }}><span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}><PlayIcon width={12} height={12} /> Play</span></button>
        <button className="link-underline" onClick={() => builtIsReal && builtChord && saveChord(builtChord, builtChord.displayName)} style={{ borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center", opacity: builtIsReal ? 1 : 0.3 }}>
          <HeartIcon width={12} height={12} /> Save
        </button>
        {builtIsReal && builtChord && (
          <button className="link-underline" onClick={() => openExplain({ kind: "chord", chord: builtChord })} style={{ borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
            <SparkIcon width={12} height={12} /> Why is this {builtChord.displayName}?
          </button>
        )}
        <button className="link-underline" onClick={() => setBuilt([-1, -1, -1, -1, -1, -1])} style={{ borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)" }}>Clear</button>
      </div>
    </main>
  );
}

import { makeChordView as makeChordViewImpl, fingeringToPlayableMidis as fingeringToPlayableMidisImpl } from "../fretboard/fretboard";

function MiniFretboard({ built, onTap }: { built: (number | null)[]; onTap: (s: number, fret: number) => void }) {
  const frets = 5;
  const stringNames = ["E", "A", "D", "G", "B", "e"];
  const W = 340, H = 200;
  const left = 42, right = 322, span = right - left;
  const topY = 24, gap = (H - topY - 30) / frets;
  const xFor = (s: number) => left + (s * span) / 5;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 460 }}>
      <rect x={left} y={topY - 3} width={span} height={3} fill="var(--bone)" opacity={0.85} />
      {Array.from({ length: frets + 1 }).map((_, i) => (
        <line key={`fl${i}`} x1={left} y1={topY + i * gap} x2={right} y2={topY + i * gap} stroke="var(--hair)" strokeWidth="1" />
      ))}
      {Array.from({ length: frets }).map((_, i) => (
        <text key={`fn${i}`} x={left - 10} y={topY + (i + 0.5) * gap + 3} fontSize="9" fontFamily="var(--sans)" fill="var(--smoke)" textAnchor="end">{i + 1}</text>
      ))}
      {Array.from({ length: 6 }).map((_, s) => (
        <line key={`sl${s}`} x1={xFor(s)} y1={topY} x2={xFor(s)} y2={topY + frets * gap} stroke="var(--hair-strong)" strokeWidth={s < 2 ? 1.5 : 1} />
      ))}
      {Array.from({ length: 6 }).map((_, s) => (
        <text key={`sl${s}-n`} x={xFor(s)} y={topY - 8} fontSize="8" fontFamily="var(--sans)" fill="var(--ash)" textAnchor="middle">{stringNames[s]}</text>
      ))}
      {Array.from({ length: 6 }).map((_, s) =>
        Array.from({ length: frets }).map((_, f) => {
          const fret = f + 1;
          const isActive = built[s] === fret;
          const cx = xFor(s);
          const cy = topY + (f + 0.5) * gap;
          return (
            <g
              key={`c-${s}-${f}`}
              style={{ cursor: "pointer" }}
              onClick={() => onTap(s, fret)}
            >
              <rect x={cx - gap / 2 + 6} y={cy - gap / 2} width={span - 12} height={gap} fill="transparent" />
              <circle cx={cx} cy={cy} r="9" fill={isActive ? "var(--accent)" : "transparent"} stroke={isActive ? "transparent" : "var(--hair)"} strokeWidth="1" />
              {isActive && <text x={cx} y={cy + 4} fontSize="11" fontFamily="var(--sans)" fontWeight="600" textAnchor="middle" fill="var(--void)">{fret}</text>}
            </g>
          );
        })
      )}
    </svg>
  );
}

function ChordDetectorCard() {
  const [active, setActive] = useState(false);
  const [result, setResult] = useState<{ state: string; chord: DetectedChord | null; micErr?: string }>({ state: "silent", chord: null });
  const rafClear = useRef<() => void>(() => {});

  useEffect(() => {
    chordDetector.onResult = (r) => setResult(r);
    return () => { chordDetector.onResult = null; };
  }, []);

  const start = async () => {
    try {
      await chordDetector.start();
      setActive(true);
      setResult({ state: "listening", chord: null });
    } catch (e) { void e; }
  };
  const stop = () => { chordDetector.stop(); setActive(false); setResult({ state: "silent", chord: null }); };

  const found = result.state === "found" && result.chord;
  const confidencePct = found ? Math.round(result.chord!.confidence * 100) : 0;
  void openStringMidis; void midiToFreq;

  return (
    <div style={{ border: "1px solid var(--hair-strong)", padding: "1.4rem 1.2rem", borderRadius: "var(--radius)" }}>
      <div className="label" style={{ marginBottom: "0.6rem", color: "var(--ash)" }}>Chord detector</div>
      <div className="body-copy body-copy--narrow" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
        Strum a chord near your microphone. The detector listens to the pitches and names it.
      </div>

      {active && (
        <div style={{ marginBottom: "1.2rem", minHeight: "4.4rem" }}>
          <div className="display display--md" style={{ fontSize: "clamp(1.8rem, 8vw, 2.8rem)", color: found ? "var(--accent)" : "var(--bone)" }}>
            {found ? result.chord!.displayName : result.state === "listening" ? "Listening\u2026" : "Searching\u2026"}
          </div>
          {found && (
            <>
              <div className="mono" style={{ marginTop: "0.5rem", color: "var(--smoke)" }}>
                notes: {result.chord!.notes.join(" \u00B7 ")} &nbsp;·&nbsp; confidence {confidencePct}%
              </div>
              <div style={{ marginTop: "0.6rem", height: "4px", width: "100%", background: "var(--hair)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${confidencePct}%`, background: "var(--accent)", transition: "width 0.3s var(--ease)" }} />
              </div>
            </>
          )}
        </div>
      )}

      {result.micErr && <div className="mono" style={{ color: "var(--danger)", marginBottom: "0.9rem", fontSize: "0.74rem" }}>{result.micErr}</div>}

      <button className="cta" onClick={active ? stop : start}>
        {active ? "Stop listening" : "Listen to my guitar"}
      </button>
    </div>
  );
}
