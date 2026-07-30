import { useState } from "react";
import { useStore, KEY_TO_STRING, patternById, TUNINGS, type SavedRoll, type LyricLine } from "../store/game";
import { ALL_PATTERNS } from "../audio/patterns";
import { ChordDiagram } from "../components/ChordDiagram";
import { makeChordView, fingeringToPlayableMidis } from "../fretboard/fretboard";
import { tuningById } from "../audio/guitar";
import { guitar } from "../audio/guitar";
import { PlayIcon, CloseIcon, ArrowIcon } from "../icons";

export function JournalScreen() {
  const rolls = useStore((s) => s.savedRolls);
  const chords = useStore((s) => s.savedChords);
  const removeSavedChord = useStore((s) => s.removeSavedChord);
  const [openedId, setOpenedId] = useState<string | null>(null);

  const playSavedChord = (c: typeof chords[number]) => {
    const t = tuningById(c.tuningId);
    const midis = fingeringToPlayableMidis(makeChordView(c.chord.root, c.chord.quality, c.tuningId).fingering, t);
    guitar.resume(); guitar.tune(t); guitar.playChord(midis, { strum: "down" });
  };

  const opened = rolls.find((r) => r.id === openedId) ?? null;

  if (opened) return <SongEditor roll={opened} onBack={() => setOpenedId(null)} />;

  return (
    <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <div className="label" style={{ marginBottom: "1.4rem" }}>Journal</div>
      <div className="display display--md" style={{ marginBottom: "2rem", fontSize: "clamp(1.8rem, 7vw, 3rem)" }}>
        {rolls.length + chords.length === 0 ? "Nothing yet." : `${rolls.length} ${rolls.length === 1 ? "song" : "songs"} · ${chords.length} ${chords.length === 1 ? "chord" : "chords"}`}
      </div>

      {rolls.length === 0 && chords.length === 0 && (
        <div className="body-copy body-copy--narrow" style={{ color: "var(--smoke)" }}>
          Roll your first song, or invent a chord in the Playground. Anything you save lives here, openable, with chords and lyrics you can shape.
        </div>
      )}

      {chords.length > 0 && (
        <div style={{ marginBottom: "3rem" }}>
          <div className="label" style={{ marginBottom: "1rem", color: "var(--ash)" }}>Chords — tap to play</div>
          {chords.map((c) => (
            <div key={c.id} style={{ padding: "1.4rem 0", borderTop: "1px solid var(--hair)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div onClick={() => playSavedChord(c)} style={{ cursor: "pointer" }}>
                <ChordDiagram compact chordName={c.name} fingering={makeChordView(c.chord.root, c.chord.quality, c.tuningId).fingering} tuningId={c.tuningId} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="label" style={{ color: "var(--smoke)" }}>{c.feelingTags.join(" \u00B7 ")}</div>
                <div className="mono" style={{ marginTop: "0.3rem", color: "var(--ash)", fontSize: "0.68rem" }}>{tuningById(c.tuningId).label}</div>
              </div>
              <button
                className="link-underline"
                onClick={() => removeSavedChord(c.id)}
                aria-label={`Delete ${c.name}`}
                style={{ display: "inline-flex", alignItems: "center", padding: "0.4rem", border: 0, background: "none", color: "var(--ash)", cursor: "pointer" }}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {rolls.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: "1rem", color: "var(--ash)" }}>Songs — tap to open</div>
          {rolls.map((s) => (
            <button key={s.id} onClick={() => setOpenedId(s.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "1.4rem 0", borderTop: "1px solid var(--hair)", background: "none", border: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, cursor: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <div className="display display--sm" style={{ fontSize: "clamp(1.3rem, 4vw, 1.7rem)" }}>{s.name}</div>
                <ArrowIcon width={16} height={16} style={{ color: "var(--smoke)" }} />
              </div>
              <div className="mono" style={{ marginTop: "0.5rem" }}>{KEY_TO_STRING(s.roll.key)} · {s.bpm} BPM · capo {s.capo} · {s.feelingTags.join(" · ")}</div>
              <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {s.roll.progression.chords.map((c, i) => (
                  <span key={i} className="chord-token">{c.displayName}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

// =========================================================
// Song Editor — the openable card with the lyrics+arrangement builder
// =========================================================
interface EditorProps { roll: SavedRoll; onBack: () => void; }

const COMMON_CHORDS = ["C", "Cadd9", "Cmaj7", "G", "Gsus2", "G6", "D", "Dmaj7", "A", "A7", "Am", "Am7", "Em", "Em7", "Dm", "Dm7", "Fmaj7", "F", "E7", "B7", "Bm"];

function SongEditor({ roll, onBack }: EditorProps) {
  const updateSavedRoll = useStore((s) => s.updateSavedRoll);
  const removeSavedRoll = useStore((s) => s.removeSavedRoll);

  const [name, setName] = useState(roll.name);
  const [capo, setCapo] = useState(roll.capo);
  const [bpm, setBpm] = useState(roll.bpm);
  const [strumPatternId, setStrumPatternId] = useState(roll.strumPatternId);
  const [fingerPatternId, setFingerPatternId] = useState(roll.fingerPatternId ?? "folk-thumb");
  const [tuningId, setTuningId] = useState(roll.tuningId);
  const [lyrics, setLyrics] = useState<LyricLine[]>(roll.lyrics);

  const ensureLyrics = (): LyricLine[] => lyrics.length ? lyrics : [{ type: "lyric" as const, text: "", chords: [] }];
  const pattern = patternById(strumPatternId)!;
  const tuning = tuningById(tuningId);

  const persist = (patch: Partial<SavedRoll>) => updateSavedRoll(roll.id, { ...patch });

  const nameToChord = (name: string) => {
    // Match the roll's chord if same display name; else C-form guessed.
    const found = roll.roll.progression.chords.find((c) => c.displayName === name);
    return found ?? roll.roll.progression.chords[0];
  };

  const previewWholeProgression = () => {
    guitar.tune(tuning);
    const barMs = (60_000 / bpm) * 4;
    roll.roll.progression.chords.forEach((c, i) => {
      const midis = fingeringToPlayableMidis(makeChordView(c.root, c.quality, tuningId).fingering, tuning).map((m) => m + capo);
      guitar.playChord(midis, { when: guitar.now() + (i * barMs) / 1000 + 0.05, strum: "down" });
    });
  };

  const previewPatternWithFirstChord = () => {
    guitar.tune(tuning);
    const c0 = roll.roll.progression.chords[0];
    const midis = fingeringToPlayableMidis(makeChordView(c0.root, c0.quality, tuningId).fingering, tuning).map((m) => m + capo);
    const stepMs = (60_000 / bpm) / (pattern.beats / 4);
    pattern.strokes.forEach((s, i) => {
      if (s === ".") return;
      guitar.playChord(midis, { when: guitar.now() + (i * stepMs) / 1000 + 0.05, strum: s === "U" ? "up" : "down", velocity: s === "D" ? 0.85 : 0.55 });
    });
  };

  const onLyricTextChange = (i: number, text: string) => {
    const next = [...ensureLyrics()];
    next[i] = { ...next[i], text };
    setLyrics(next);
    persist({ lyrics: next });
  };

  const addChordToLine = (i: number, charOffsetHint: number, chordName: string) => {
    const next = [...ensureLyrics()];
    const chords = [...(next[i].chords || [])];
    chords.push({ charOffset: charOffsetHint, chordName });
    next[i] = { ...next[i], chords };
    setLyrics(next);
    persist({ lyrics: next });
  };

  const addLine = (type: "lyric" | "section") => {
    const next = [...ensureLyrics(), { type, text: "", chords: [] }];
    setLyrics(next);
    persist({ lyrics: next });
  };

  return (
    <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <button className="link-underline" onClick={onBack} style={{ borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "1.5rem", transform: "scaleX(-1)" }}>
        <ArrowIcon width={12} height={12} />
      </button>

      {/* === Name + metrics === */}
      <input
        className="textfield"
        value={name}
        onChange={(e) => { setName(e.target.value); persist({ name: e.target.value }); }}
        placeholder="Name this song…"
        style={{ marginBottom: "1.2rem" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1.4rem" }}>
        <Metric label="Capo" value={`fret ${capo}`} onDec={() => { const n = Math.max(0, capo - 1); setCapo(n); persist({ capo: n }); }} onInc={() => { const n = Math.min(12, capo + 1); setCapo(n); persist({ capo: n }); }} />
        <Metric label="Tempo" value={`${bpm} BPM`} onDec={() => { const n = Math.max(40, bpm - 4); setBpm(n); persist({ bpm: n }); }} onInc={() => { const n = Math.min(220, bpm + 4); setBpm(n); persist({ bpm: n }); }} />
      </div>

      {/* === Pattern selector === */}
      <div className="label" style={{ marginBottom: "0.7rem", color: "var(--ash)" }}>Strum / fingerpicking</div>
      <div className="chip-rail" style={{ marginBottom: "0.8rem" }}>
        {ALL_PATTERNS.map((p) => (
          <button
            key={p.id}
            className={`chip ${strumPatternId === p.id ? "chip--selected" : ""}`}
            onClick={() => { setStrumPatternId(p.id); persist({ strumPatternId: p.id }); }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Tuning */}
      <div className="label" style={{ marginBottom: "0.7rem", color: "var(--ash)" }}>Tuning</div>
      <div className="chip-rail" style={{ marginBottom: "1.4rem" }}>
        {TUNINGS.map((t) => (
          <button key={t.id} className={`chip ${tuningId === t.id ? "chip--selected" : ""}`} onClick={() => { setTuningId(t.id); persist({ tuningId: t.id }); }}>{t.label}</button>
        ))}
      </div>

      {/* === Chord diagram strip === */}
      <div className="label" style={{ marginBottom: "0.8rem", color: "var(--ash)" }}>Chords used</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {roll.roll.progression.chords.map((c, i) => (
          <div key={i}>
            <ChordDiagram compact chordName={c.displayName} fingering={makeChordView(c.root, c.quality, tuningId).fingering} tuningId={tuningId} />
          </div>
        ))}
      </div>

      <div className="action-bar" style={{ marginBottom: "1.6rem" }}>
        <button className="cta" onClick={previewWholeProgression}><span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><PlayIcon width={12} height={12} /> Play progression</span></button>
        <button className="cta" onClick={previewPatternWithFirstChord}><span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><PlayIcon width={12} height={12} /> Preview pattern</span></button>
      </div>

      <span className="rule" />

      {/* === Arrangement / lyrics builder === */}
      <div className="label" style={{ marginTop: "2rem", marginBottom: "0.6rem", color: "var(--ash)" }}>Arrangement · Lyrics with chords</div>

      {/* Chord palette */}
      <div className="chip-rail" style={{ marginBottom: "1rem" }}>
        {COMMON_CHORDS.map((n) => (
          <button
            key={n}
            className="chord-token"
            type="button"
            style={{ display: "inline-flex", cursor: "pointer" }}
            onClick={() => {
              const lines = ensureLyrics();
              const last = lines.length - 1;
              const text = lines[last]?.text ?? "";
              addChordToLine(last, text.length, n);
            }}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="body-copy body-copy--narrow" style={{ marginBottom: "1.4rem", fontStyle: "italic", color: "var(--smoke)" }}>
        Type your lyrics. Tap a chord from above to drop it after the last word of the current line.
      </div>

      <div className="lyrics-sheet">
        {ensureLyrics().map((line, i) => (
          <div key={i} className="lyric-row" style={{ borderBottom: "1px solid var(--hair)", paddingBottom: "1.2rem", position: "relative" }}>
            {line.chords.map((ch, ci) => {
              const left = `${Math.min(ch.charOffset, (line.text.length || 1) - 0) * 0.62}em`;
              return <span key={ci} className="lyric-row__chord" style={{ left }}>{ch.chordName}</span>;
            })}
            <input
              className="textfield"
              value={line.text}
              placeholder={line.type === "section" ? "[Section — verse / chorus / bridge]" : "Type a line…"}
              onChange={(e) => onLyricTextChange(i, e.target.value)}
              style={{ fontStyle: line.type === "section" ? "normal" : "italic", color: line.type === "section" ? "var(--accent)" : "var(--bone)", fontSize: line.type === "section" ? "0.74rem" : "1.05rem", letterSpacing: line.type === "section" ? "0.3em" : "0" }}
            />
          </div>
        ))}
      </div>

      <div className="action-bar" style={{ marginTop: "1.2rem" }}>
        <button className="chip" onClick={() => addLine("lyric")}>+ Lyric line</button>
        <button className="chip" onClick={() => addLine("section")}>+ Section marker</button>
      </div>

      {/* Danger: delete */}
      <div className="action-bar" style={{ marginTop: "2.5rem" }}>
        <button className="link-underline" onClick={() => { removeSavedRoll(roll.id); onBack(); }} style={{ color: "var(--danger)", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
          <CloseIcon width={12} height={12} /> Delete song
        </button>
      </div>
    </main>
  );
}

function Metric({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="cfg-row" style={{ padding: "0.8rem 0" }}>
      <span className="cfg-row__label">{label}</span>
      <span className="cfg-row__value" style={{ fontSize: "1.05rem" }}>{value}</span>
      <div className="cfg-row__ctrl">
        <button className="chip" onClick={onDec}>−</button>
        <button className="chip" onClick={onInc}>+</button>
      </div>
    </div>
  );
}
