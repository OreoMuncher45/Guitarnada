import { useStore } from "../store/game";
import { useAnalyzeStore } from "../store/analyze";

const ACHIEVEMENTS: { key: string; title: string; description: string }[] = [
  { key: "first-roll", title: "First night", description: "Saved your first Roll." },
  { key: "first-custom-chord", title: "Made your own", description: "Saved a custom chord." },
  { key: "five-songs", title: "Five songs", description: "Saved 5 Songs." },
];

export function SettingsScreen() {
  const achievements = useStore((s) => s.achievements);
  const savedRolls = useStore((s) => s.savedRolls);
  const savedChords = useStore((s) => s.savedChords);

  const { backendUrl, useBackend, setBackendUrl, setUseBackend } = useAnalyzeStore();

  return (
    <main className="section section--pad" style={{ paddingTop: "4.5rem", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
      <div className="label" style={{ marginBottom: "1.4rem" }}>Settings</div>
      <div className="display display--md" style={{ marginBottom: "2.4rem", fontSize: "clamp(1.8rem, 7vw, 3rem)" }}>A studio made after dark.</div>

      <div className="body-copy body-copy--narrow" style={{ marginBottom: "3rem" }}>
        Guitarnada is offline-first. Nothing here leaves your phone unless you ask. No accounts. No streaks. No popups.
      </div>

      <div className="label" style={{ marginBottom: "1rem", color: "var(--ash)" }}>Analyze backend</div>
      <div className="body-copy body-copy--narrow" style={{ marginBottom: "1.4rem", fontSize: "0.84rem" }}>
        The audio analyzer runs on-device by default. If you run the FastAPI backend (see github/backend), paste its URL below and toggle it on for higher accuracy — a librosa + essentia + Chordino pipeline replaces the on-device analyzer for file uploads.
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          className="textfield"
          type="url"
          placeholder="https://your-backend.onrender.com"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
        />
      </div>
      <div className="chip-rail" style={{ marginBottom: "2rem" }}>
        <button className={`chip ${!useBackend ? "chip--selected" : ""}`} onClick={() => setUseBackend(false)}>On-device (default)</button>
        <button className={`chip ${useBackend ? "chip--selected" : ""}`} onClick={() => setUseBackend(true)}>Use backend</button>
      </div>

      <div className="label" style={{ marginBottom: "1rem", color: "var(--ash)" }}>Xp & achievements</div>
      <div style={{ fontSize: "0.92rem", color: "var(--bone-72)", marginBottom: "0.4rem" }}>{savedRolls.length * 25} XP (a quiet counter)</div>
      <div>
        {ACHIEVEMENTS.map((a) => {
          const unlocked = achievements.find((x) => x.key === a.key);
          return (
            <div key={a.key} style={{ padding: "1.2rem 0", borderTop: "1px solid var(--hair)", opacity: unlocked ? 1 : 0.4 }}>
              <div className="display display--sm" style={{ fontSize: "1.4rem" }}>{a.title}</div>
              <div className="label" style={{ marginTop: "0.4rem" }}>{a.description} {unlocked ? "· unlocked" : "· locked"}</div>
            </div>
          );
        })}
      </div>

      <div className="label" style={{ marginTop: "3rem", marginBottom: "1rem", color: "var(--ash)" }}>Storage</div>
      <div className="body-copy" style={{ fontSize: "0.86rem" }}>
        {savedRolls.length} songs · {savedChords.length} chords · all on this device.
      </div>

      <div className="label" style={{ marginTop: "3rem", marginBottom: "1rem", color: "var(--ash)" }}>Credits</div>
      <div className="body-copy body-copy--narrow" style={{ fontSize: "0.84rem", color: "var(--smoke)" }}>
        Visual identity after Noctis. Philosophy after a conversation that took the user from "what is a triad?" to "I want to build the app I never had."
      </div>
    </main>
  );
}