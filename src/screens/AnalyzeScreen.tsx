import { useRef, useState } from "react";
import { useAnalyzeStore } from "../store/analyze";
import { useStore, tuningById } from "../store/game";
import { type Chord } from "../theory/engine";
import { makeChordView, fingeringToPlayableMidis, barreFreeChordNames } from "../fretboard/fretboard";
import { ChordDiagram } from "../components/ChordDiagram";
import { guitar } from "../audio/guitar";
import { PlayIcon, HeartIcon } from "../icons";

export function AnalyzeScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, result, simplifyReasons, analyze, reset, analyzeToRoll, simplifyChordAt, simplifyWhole } = useAnalyzeStore();
  const barreEnabled = useStore((s) => s.barreEnabled);
  const tuningId = useStore((s) => s.tuningId);
  const saveRoll = useStore((s) => s.saveRoll);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    analyze(f, f.name);
  };

  const handleSave = () => {
    const roll = analyzeToRoll();
    if (!roll) return;
    const id = saveRoll(roll.moodDescriptor);
    if (id) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1700); navigator.vibrate?.(20); }
  };

  const playSingle = (chord: Chord) => {
    const tuning = tuningById(tuningId);
    const midis = fingeringToPlayableMidis(makeChordView(chord.root, chord.quality, tuningId, barreEnabled).fingering, tuning);
    guitar.resume(); guitar.tune(tuning); guitar.playChord(midis, { strum: "down" });
  };

  const playAll = () => {
    if (!result) return;
    const tuning = tuningById(tuningId);
    guitar.tune(tuning);
    const barMs = (60_000 / result.bpm) * 4;
    result.chords.forEach((c, i) => {
      if (!c.chord) return;
      const midis = fingeringToPlayableMidis(makeChordView(c.chord.root, c.chord.quality, tuningId, barreEnabled).fingering, tuning);
      guitar.playChord(midis, { when: guitar.now() + (i * barMs) / 1000 + 0.05, strum: "down" });
    });
  };

  const openNames = barreFreeChordNames(tuningId);
  const hasBarreFree = openNames.size > 0;

  if (!result) {
    return (
      <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
        <div className="label" style={{ marginBottom: "1.4rem" }}>Analyze</div>
        <div className="display display--md" style={{ marginBottom: "2rem", fontSize: "clamp(1.8rem, 7vw, 3rem)" }}>A song, under the lens.</div>
        <div className="body-copy body-copy--narrow" style={{ marginBottom: "2.6rem" }}>
          Feed it a recording — any mp3, wav, m4a. The analyzer finds the key, BPM, and every chord it can hear. Everything stays on your device unless you turned on the optional backend in Settings.
        </div>

        {error && <div className="mono" style={{ color: "var(--danger)", marginBottom: "1.4rem", fontSize: "0.82rem" }}>{error}</div>}

        {busy ? (
          <div style={{ position: "relative", minHeight: "14rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.4rem", background: "var(--shadow)", padding: "3rem 2rem" }}>
            <div className="display display--md" style={{ fontSize: "clamp(1.6rem, 6vw, 2.4rem)" }}>Listening...</div>
            <div className="loader__bar"><i /></div>
          </div>
        ) : (
          <button className="cta" onClick={() => fileRef.current?.click()}>Choose an audio file</button>
        )}
        <input ref={fileRef} type="file" accept="audio/*" onChange={handleFile} style={{ display: "none" }} />
        <div className="body-copy" style={{ marginTop: "1.4rem", fontSize: "0.8rem", color: "var(--ash)" }}>
          Requires Web Audio — mp3, wav, m4a, ogg, flac, aiff. No file leaves your phone.
        </div>
        <div className="body-copy" style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--ash)", fontStyle: "italic" }}>
          For higher accuracy, configure the FastAPI backend in Settings → Backend URL and toggle Use backend.
        </div>
      </main>
    );
  }

  return (
    <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.8rem", flexWrap: "wrap", gap: "0.6rem" }}>
        <div className="label">Analyze</div>
        <button className="link-underline" onClick={reset} style={{ borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "0.66rem", fontFamily: "var(--sans)" }}>New analysis</button>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <div className="display display--lg" style={{ fontSize: "clamp(2rem, 8vw, 3.4rem)" }}>
          {result.key.tonic} {result.key.type === "maj" ? "major" : "minor"}
        </div>
        <div className="mono" style={{ marginTop: "0.8rem" }}>{result.key.tonic}{result.key.type === "maj" ? "" : "m"} · {result.bpm} BPM · {result.timeSignature} · {result.chords.length} chords</div>
        <div className="mono" style={{ marginTop: "0.3rem", color: "var(--ash)", fontSize: "0.6rem" }}>{result.onDevice ? "·on-device" : "·backend"}</div>
      </div>

      <div className="label" style={{ marginBottom: "0.8rem", color: "var(--ash)" }}>Chord timeline</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: "1.4rem", marginBottom: "2rem" }}>
        {result.chords.map((c, i) => (
          <div key={i}>
            <ChordDiagram
              chordName={c.chordName}
              fingering={c.chord ? makeChordView(c.chord.root, c.chord.quality, tuningId, barreEnabled).fingering : makeChordView("C", "maj", tuningId, barreEnabled).fingering}
              tuningId={tuningId}
              onPlay={() => c.chord && playSingle(c.chord)}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
              <div className="mono" style={{ color: "var(--ash)", fontSize: "0.6rem" }}>{c.roman ?? "\u2014"} · bar {c.bar + 1}</div>
              <button className="link-underline" onClick={() => c.chord && playSingle(c.chord)} style={{ fontSize: "0.56rem", letterSpacing: "0.2em", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.2rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                <PlayIcon width={10} height={10} />
              </button>
              <button className="link-underline" onClick={() => simplifyChordAt(i, hasBarreFree ? openNames : undefined)} style={{ fontSize: "0.56rem", letterSpacing: "0.2em", borderBottom: "1px solid var(--hair-strong)", paddingBottom: "0.2rem", color: "var(--accent)" }}>Simplify</button>
            </div>
          </div>
        ))}
      </div>

      <div className="action-bar" style={{ marginBottom: "0.6rem" }}>
        <button className="cta" onClick={playAll}><span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><PlayIcon width={12} height={12} /> Play all</span></button>
        <button className="cta" onClick={() => simplifyWhole(!barreEnabled, hasBarreFree ? openNames : undefined)}>Simplify whole</button>
        <button className="cta" onClick={handleSave}>{savedFlash ? "Saved to Journal" : <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><HeartIcon width={12} height={12} /> Save to Journal</span>}</button>
      </div>

      {simplifyReasons && (
        <div style={{ marginTop: "0.8rem" }}>
          {simplifyReasons.map((r, i) => (
            <div key={i} className="body-copy" style={{ fontSize: "0.78rem", maxWidth: "58ch", marginBottom: "0.3rem" }}>{r}</div>
          ))}
        </div>
      )}

      {result.sections.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <div className="label" style={{ marginBottom: "0.8rem", color: "var(--ash)" }}>Sections detected</div>
          {result.sections.map((sec, i) => (
            <div key={i} className="cfg-row" style={{ padding: "0.6rem 0", fontFamily: "var(--display)", fontStyle: "italic", fontSize: "1.05rem" }}>
              {sec.name} <span className="mono" style={{ marginLeft: "auto" }}>{sec.start.toFixed(1)}s–{sec.end.toFixed(1)}s</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}