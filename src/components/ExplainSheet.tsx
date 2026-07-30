import { useStore } from "../store/game";
import { explainProgression, explainChordQuality, type ExplainResponse } from "../theory/engine";
import { useState, useEffect } from "react";
import { CloseIcon } from "../icons";

export function ExplainSheet() {
  const open = useStore((s) => s.explainOpen);
  const target = useStore((s) => s.explainTarget);
  const close = useStore((s) => s.closeExplain);
  const [more, setMore] = useState(false);
  useEffect(() => { if (!open) setMore(false); }, [open]);

  if (!target) return null;
  let resp: ExplainResponse | null = null;
  if (target.kind === "roll" && target.roll) {
    resp = target.reason
      ? { headline: target.reason.split(".")[0] || target.reason, body: target.reason, usedFallback: true }
      : explainProgression(target.roll);
  } else if (target.kind === "chord" && target.chord) {
    resp = explainChordQuality(target.chord);
  }
  // For a transformation we already received a reason string; pass it straightthrough.
  if (target.reason && !resp) {
    resp = { headline: target.reason.split(".")[0] || target.reason, body: target.reason, usedFallback: true };
  }
  if (!resp) return null;

  return (
    <>
      <div className={`scrim ${open ? "scrim--open" : ""}`} onClick={close} aria-hidden />
      <div className={`explain-sheet ${open ? "explain-sheet--open" : ""}`} role="dialog" aria-label="Why does this sound good">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="label">Why this sounds good</div>
          <button className="explain-sheet__more" onClick={close} style={{ marginTop: 0, paddingTop: 0, borderTop: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            Close <CloseIcon width={12} height={12} />
          </button>
        </div>
        <div className="explain-sheet__head" style={{ marginTop: "0.4rem" }}>{resp.headline}</div>
        <div className="explain-sheet__body">{resp.body}</div>
        {resp.miniExplainer && (
          <>
            <button className="explain-sheet__more" onClick={() => setMore((m) => !m)}>{more ? "Less" : "More"}</button>
            {more && <div className="explain-sheet__mini">{resp.miniExplainer}</div>}
          </>
        )}
        {resp.usedFallback && <div className="mono" style={{ marginTop: "1rem", color: "var(--ash)" }}>·offline</div>}
      </div>
    </>
  );
}
