import { useEffect, useState } from "react";
import { tuner, TUNINGS, tuningById, playReferenceTone, noteToMidi } from "../tuner/tuner";
import { useStore } from "../store/game";
import { midiToFreq } from "../audio/guitar";
import { PlayIcon } from "../icons";

type PitchState = "silent" | "detecting" | "inTune" | "outOfTune";
interface PitchInfo { note: string; centsOff: number; freq: number; midi: number; }

export function TunerScreen() {
  const tuningId = useStore((s) => s.tuningId);
  const setTuningId = useStore((s) => s.setTuningId);
  const tuning = tuningById(tuningId);

  const [active, setActive] = useState(false);
  const [state, setState] = useState<PitchState>("silent");
  const [info, setInfo] = useState<PitchInfo>({ note: "\u2014", centsOff: 0, freq: 0, midi: 0 });
  const [targetString, setTargetString] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    tuner.onPitch = (st, inf) => { setState(st); setInfo(inf); };
    tuner.onError = (msg) => { setErr(msg); setActive(false); };
    return () => { tuner.onPitch = null; tuner.onError = null; if (active) tuner.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setErr(null);
    tuner.targetMidi = noteToMidi(tuning.strings[targetString]);
    try {
      await tuner.start();
      setActive(true);
    } catch (e) { void e; }
  };
  const stop = () => { tuner.stop(); setActive(false); setState("silent"); };

  const targetMidi = noteToMidi(tuning.strings[targetString]);
  const targetFreq = midiToFreq(targetMidi);

  const needleAngle = Math.max(-45, Math.min(45, info.centsOff * 0.45));
  const ringColor = state === "inTune" ? "var(--accent)" : state === "outOfTune" ? "var(--bone-72)" : "var(--ash)";

  const setString = (i: number) => {
    setTargetString(i);
    tuner.targetMidi = noteToMidi(tuning.strings[i]);
  };

  return (
    <main className="section section--pad" style={{ paddingTop: "5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <div className="label" style={{ marginBottom: "1.4rem" }}>Tuner</div>
      <div className="display display--md" style={{ marginBottom: "0.6rem", fontSize: "clamp(1.8rem, 7vw, 3rem)" }}>After-dark tuning.</div>
      <div className="body-copy body-copy--narrow" style={{ marginBottom: "2rem" }}>All standard tunings. Pick a string to set the target — play the same string on your guitar. The needle swings; center it.</div>

      {/* Tuning selector */}
      <div className="chip-rail" style={{ marginBottom: "2rem" }}>
        {TUNINGS.map((t) => (
          <button key={t.id} className={`chip ${tuningId === t.id ? "chip--selected" : ""}`} onClick={() => setTuningId(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* active string row */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        {tuning.strings.map((s, i) => {
          const isActive = targetString === i;
          const isInTune = active && state === "inTune" && info.midi === noteToMidi(s);
          return (
            <button
              key={i}
              className={`chip ${isActive ? "chip--selected" : ""}`}
              style={{
                flex: "1 1 80px",
                background: isInTune ? "var(--accent-12)" : undefined,
                borderColor: isInTune ? "var(--accent)" : undefined,
                color: isInTune ? "var(--accent)" : "var(--bone)",
                fontFamily: "var(--display)",
                fontStyle: "italic",
                fontSize: "0.95rem",
              }}
              onClick={() => setString(i)}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                {s}
                <button
                  onClick={(e) => { e.stopPropagation(); playReferenceTone(midiToFreq(noteToMidi(s)), 1500); }}
                  style={{ display: "inline-flex", opacity: 0.7, border: 0, background: "none", padding: 0, marginLeft: "0.2rem", color: "var(--bone)", cursor: "pointer" }}
                  aria-label={`Play reference ${s}`}
                >
                  <PlayIcon width={10} height={10} />
                </button>
              </span>
            </button>
          );
        })}
      </div>

      {/* needle gauge */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.5rem" }}>
        <svg width="220" height="130" viewBox="0 0 220 130">
          <path d="M 20 120 A 100 100 0 0 1 200 120" fill="none" stroke="var(--hair-strong)" strokeWidth="1" />
          {[-45, -10, 0, 10, 45].map((deg) => {
            const r1 = 92; const r2 = deg === 0 ? 78 : 85;
            const a = deg - 90;
            const cx = 110, cy = 120;
            const x1 = cx + r1 * Math.cos(a * Math.PI / 180);
            const y1 = cy + r1 * Math.sin(a * Math.PI / 180);
            const x2 = cx + r2 * Math.cos(a * Math.PI / 180);
            const y2 = cy + r2 * Math.sin(a * Math.PI / 180);
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={deg === 0 ? "var(--accent)" : "var(--smoke)"} strokeWidth={deg === 0 ? 1.5 : 0.8} />;
          })}
          <g className="tuner-needle" style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: "110px 120px" }}>
            <line x1="110" y1="120" x2="110" y2="28" stroke={ringColor} strokeWidth="1.4" />
          </g>
          <circle cx="110" cy="120" r="4" fill={ringColor} />
        </svg>
        <div className="display display--md" style={{ fontSize: "clamp(2rem, 8vw, 3.4rem)", color: state === "inTune" ? "var(--accent)" : "var(--bone)" }}>
          {active ? info.note : "\u2014"}
        </div>
        <div className="mono" style={{ marginTop: "0.4rem" }}>
          {!active ? "tap to start" : state === "silent" ? "play a note\u2026" : `${info.centsOff > 0 ? "+" : ""}${info.centsOff}\u00A2 \u00B7 ${info.freq.toFixed(1)} Hz`}
        </div>
        <div className="mono" style={{ marginTop: "0.3rem", color: "var(--ash)" }}>
          target: {tuning.strings[targetString]} ({targetFreq.toFixed(1)} Hz)
        </div>
      </div>

      {err && <div className="mono" style={{ color: "var(--danger)", marginBottom: "1rem", textAlign: "center", fontSize: "0.78rem" }}>{err}</div>}

      <button className="cta" onClick={active ? stop : start}>
        {active ? "Stop" : "Start listening"}
      </button>
    </main>
  );
}
