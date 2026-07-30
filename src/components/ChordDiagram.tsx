import { fingeringToPlayableMidis, type Fingering } from "../fretboard/fretboard";
import { guitar, tuningById, noteToMidi, midiToNote, openStringMidis } from "../audio/guitar";

interface Props {
  fingering: Fingering;
  tuningId?: string;
  chordName?: string;
  onPlay?: () => void;
  compact?: boolean;
}

// Diagram renders 5 visible fret windows. Strings: leftmost = low E (deep), rightmost = high E.
// Finger numbers 1-4 sit on the pressed frets; fret numbers are shown at the left edge
// (1..5 or, when the chord is high on the neck, the actual starting fret).
export function ChordDiagram({ fingering, tuningId = "standard", chordName, onPlay, compact = false }: Props) {
  const tuning = tuningById(tuningId);
  const specs = fingering.specs;
  const visibleFrets = compact ? 4 : 5;
  const stringNames = ["E", "A", "D", "G", "B", "e"];

  // Decide base fret. Prefer the engine's explicit baseFret; otherwise shift if any fret escapes the window.
  const frettedFrets = specs.filter((s) => s.state === "fretted").map((s) => (s as any).fret as number);
  const lowestFretted = frettedFrets.length ? Math.min(...frettedFrets) : Infinity;
  const highestFretted = frettedFrets.length ? Math.max(...frettedFrets) : -Infinity;
  let baseFret = 1;
  if (fingering.baseFret && fingering.baseFret > 1) {
    baseFret = fingering.baseFret;
  } else if (Number.isFinite(highestFretted) && highestFretted > visibleFrets) {
    baseFret = Number.isFinite(lowestFretted) ? lowestFretted : 1;
  }
  if (baseFret < 1) baseFret = 1;

  // layout constants
  const W = 168, H = 188;
  const left = 26, right = 158;
  const span = right - left;
  const topY = 30;
  const fretGap = (H - topY - 26) / visibleFrets;
  const stringX = (s: number) => left + (s * span) / 5;

  const playChord = () => {
    if (onPlay) return onPlay();
    const midis = fingeringToPlayableMidis(fingering, tuning);
    guitar.resume();
    guitar.playChord(midis, { strum: "down" });
  };

  const showNut = baseFret === 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: compact ? 116 : 168 }}>
      <div
        onClick={playChord}
        style={{
          cursor: "pointer", fontFamily: "var(--display)", fontWeight: 300, fontSize: compact ? "1.4rem" : "1.9rem",
          letterSpacing: "-0.02em", color: "var(--bone)", lineHeight: 0.9,
        }}
        role="button"
        aria-label={`Play ${chordName ?? "chord"}`}
      >
        {chordName ?? ""}
      </div>

      <svg
        width={compact ? 124 : 168}
        height={compact ? 168 : 188}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", color: "var(--bone)" }}
      >
        {/* base fret label (left edge) */}
        <text x={6} y={topY + fretGap * visibleFrets / 2} fontSize="9" fontFamily="var(--sans)" fill="var(--smoke)" textAnchor="middle" transform={`rotate(-90 6 ${topY + fretGap * visibleFrets / 2})`}>
          {showNut ? "0" : `${baseFret}fr`}
        </text>

        {/* nut or capo marker */}
        {showNut ? (
          <rect x={left} y={topY - 3} width={span} height={3} fill="var(--bone)" opacity={0.9} />
        ) : (
          <rect x={left} y={topY - 2} width={span} height={2} fill="var(--hair-strong)" />
        )}

        {/* fret lines */}
        {Array.from({ length: visibleFrets + 1 }).map((_, i) => (
          <line key={`f${i}`} x1={left} y1={topY + i * fretGap} x2={right} y2={topY + i * fretGap} stroke="var(--hair)" strokeWidth="1" />
        ))}

        {/* fret numbers (left side, small) */}
        {Array.from({ length: visibleFrets }).map((_, i) => (
          <text key={`fn${i}`} x={left - 8} y={topY + (i + 0.5) * fretGap + 3} fontSize="8" fontFamily="var(--sans)" fill="var(--smoke)" textAnchor="end">
            {baseFret + i}
          </text>
        ))}

        {/* strings */}
        {Array.from({ length: 6 }).map((_, s) => {
          const x = stringX(s);
          const thick = s < 2;
          return <line key={`s${s}`} x1={x} y1={topY} x2={x} y2={topY + visibleFrets * fretGap} stroke="var(--hair-strong)" strokeWidth={thick ? 1.5 : 1} />;
        })}

        {/* string name above (tiny) */}
        {Array.from({ length: 6 }).map((_, s) => (
          <text key={`sn${s}`} x={stringX(s)} y={topY - 8} fontSize="8" fontFamily="var(--sans)" fill="var(--ash)" textAnchor="middle">
            {stringNames[s]}
          </text>
        ))}

        {/* per-string spec */}
        {specs.map((spec, s) => {
          const x = stringX(s);
          const yAbove = topY - 1;
          if (spec.state === "mute") {
            return (
              <g key={`m${s}`}>
                <line x1={x - 5} y1={yAbove - 9} x2={x + 5} y2={yAbove + 1} stroke="var(--ash)" strokeWidth="1.2" />
                <line x1={x - 5} y1={yAbove + 1} x2={x + 5} y2={yAbove - 9} stroke="var(--ash)" strokeWidth="1.2" />
              </g>
            );
          }
          if (spec.state === "open") {
            return <circle key={`o${s}`} cx={x} cy={yAbove - 4} r="4.5" fill="none" stroke="var(--accent)" strokeWidth="1.4" />;
          }
          // fretted
          const frettedFret = spec.fret;
          const relFret = Math.max(1, Math.min(visibleFrets, frettedFret - baseFret + 1));
          const cy = topY + (relFret - 0.5) * fretGap;
          // barre detection: finger 1 spans ≥ 2 consecutive strings at same fret
          const sameFret = specs.map((sp) => (sp.state === "fretted" && sp.finger === 1 && sp.fret === frettedFret ? 1 : 0));
          const isBarre = spec.finger === 1 && sameFret.reduce<number>((a, b) => a + b, 0) >= 2;
          if (isBarre) {
            const barreStrings = sameFret.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
            const firstStr = Math.min(...barreStrings);
            const lastStr = Math.max(...barreStrings);
            const x1 = stringX(firstStr);
            const x2 = stringX(lastStr);
            return (
              <g key={`b${s}`}>
                <rect x={x1 - 8} y={cy - fretGap / 2 + 3} width={x2 - x1 + 16} height={fretGap - 6} rx={(fretGap - 6) / 2} fill="var(--bone)" opacity={0.96} />
                <text x={(x1 + x2) / 2} y={cy + 4} fontSize="11" fontFamily="var(--sans)" fontWeight="600" textAnchor="middle" fill="var(--ink)">{spec.finger}</text>
              </g>
            );
          }
          return (
            <g key={`p${s}`}>
              <circle cx={x} cy={cy} r="8.5" fill="var(--bone)" />
              <text x={x} y={cy + 4} fontSize="11" fontFamily="var(--sans)" fontWeight="600" textAnchor="middle" fill="var(--ink)">{spec.finger}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Per-string strum demo: tap each string, shows the note + fret it's sounding.
interface StrumstringsProps { strings: number[]; tuningId?: string; }
export function StrumStrings({ strings, tuningId = "standard" }: StrumstringsProps) {
  const tuning = tuningById(tuningId);
  const openMidis = openStringMidis(tuning);
  const midiForString = (stringIdx: number, fret: number) => openMidis[stringIdx] + fret;
  return (
    <div style={{ display: "flex", gap: "0.3rem" }}>
      {Array.from({ length: 6 }).map((_, s) => {
        const fret = strings[s] ?? 0;
        const midi = fret > 0 ? midiForString(s, fret) : openMidis[s];
        return (
          <button
            key={s}
            onClick={() => { guitar.resume(); guitar.pluckString(s, midi); }}
            className="note-pill"
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem" }}
            aria-label={`Play string ${6 - s}`}
          >
            <span style={{ fontSize: "0.78rem" }}>{midiToNote(midi)}</span>
            <span style={{ fontSize: "0.56rem", letterSpacing: "0.2em", color: "var(--smoke)" }}>
              {fret > 0 ? `fr ${fret}` : "open"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

void noteToMidi;
