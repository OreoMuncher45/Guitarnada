import { useEffect, useMemo, useRef, useState } from "react";
import { CreatorScreen } from "./screens/CreatorScreen";
import { PlaygroundScreen } from "./screens/PlaygroundScreen";
import { JournalScreen } from "./screens/JournalScreen";
import { TunerScreen } from "./screens/TunerScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { Overlay } from "./components/Overlay";
import { Loader } from "./components/Loader";
import { ExplainSheet } from "./components/ExplainSheet";
import { AchievementToast } from "./components/AchievementToast";
import { useInstallPrompt } from "./lib/install";
import { useStore } from "./store/game";
import { guitar } from "./audio/guitar";
import { CreateIcon, PlaygroundIcon, JournalIcon, TunerIcon, SettingsIcon } from "./icons";

type Tab = "create" | "playground" | "tuner" | "journal" | "settings";

interface TabDef { id: Tab; label: string; Icon: any; }
const TABS: TabDef[] = [
  { id: "create",     label: "Create",     Icon: CreateIcon },
  { id: "playground", label: "Playground", Icon: PlaygroundIcon },
  { id: "tuner",      label: "Tuner",      Icon: TunerIcon },
  { id: "journal",    label: "Journal",    Icon: JournalIcon },
  { id: "settings",   label: "Settings",   Icon: SettingsIcon },
];

const CHAPTERS: Record<Tab, string> = {
  create: "Chapter one \u00B7 the start",
  playground: "Chapter two \u00B7 the maker",
  tuner: "Chapter three \u00B7 the readiness",
  journal: "Chapter four \u00B7 the ledger",
  settings: "Studio",
};

export function App() {
  const [tab, setTab] = useState<Tab>("create");
  const [loading, setLoading] = useState(true);
  const [pageKey, setPageKey] = useState(0);
  const [pageEnter, setPageEnter] = useState(false);
  const explainOpen = useStore((s) => s.explainOpen);
  const openExplain = useStore((s) => s.openExplain);
  const achievements = useStore((s) => s.achievements);
  const installDeferred = useStore((s) => s.installDeferred);
  const { install } = useInstallPrompt();
  const rollOnce = useRef(false);

  // Page transition: when tab changes, fire a quick exit→enter.
  useEffect(() => {
    setPageEnter(false);
    setPageKey((k) => k + 1);
    const t = requestAnimationFrame(() => setPageEnter(true));
    return () => cancelAnimationFrame(t);
  }, [tab]);

  // First-run auto-roll: only when first arriving on Create, only once.
  const currentRoll = useStore((s) => s.currentRoll);
  const roll = useStore((s) => s.roll);
  useEffect(() => {
    if (loading) return;
    if (rollOnce.current) return;
    rollOnce.current = true;
    if (!currentRoll && tab === "create") roll();
  }, [loading, tab, currentRoll, roll]);

  // Unlock audio on the first user interaction anywhere in the app.
  useEffect(() => {
    const unlock = () => { guitar.unlock(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  // Latest achievement surfaces in the toast — highest unlockedAt.
  const latestAchievement = useMemo(() => {
    if (!achievements.length) return null;
    return achievements.reduce((a, b) => (b.unlockedAt > a.unlockedAt ? b : a));
  }, [achievements]);

  const handleTab = (t: Tab) => { setTab(t); };

  if (loading) return <Loader onDone={() => setLoading(false)} />;

  // The ? explain button lives at top, absolute, to the LEFT of the install app button so it never sits on the navbar.
  const handleExplain = () => {
    const s = useStore.getState();
    if (tab === "playground" && s.savedChords.length > 0) openExplain({ kind: "chord", chord: s.savedChords[0].chord });
    else if (s.currentRoll) openExplain({ kind: "roll", roll: s.currentRoll });
    else openExplain({ kind: "roll", roll: undefined as any, reason: "Roll something first. Then I'll explain why it sings." });
  };

  return (
    <>
      <Overlay />

      {/* === Top bar === */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9000,
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        padding: `1.05rem var(--pad-x)`, mixBlendMode: "difference", color: "var(--bone)",
      }}>
        <div className="serif" style={{ fontSize: "1rem", letterSpacing: "0.42em", paddingLeft: "0.42em", fontWeight: 400 }}>GUITARNADA</div>
        <div className="mono" style={{ opacity: 0.6, textAlign: "right", fontSize: "0.56rem", letterSpacing: "0.3em" }}>
          {CHAPTERS[tab]}
        </div>
      </header>

      {/* Persistent explain button — top-right, below the chapter line, never overlapping the navbar. */}
      {!explainOpen && (
        <button
          className="explain-button"
          onClick={handleExplain}
          aria-label="Explain this"
          style={{ top: "calc(1.05rem + 36px)", right: "var(--pad-x)", left: "auto", bottom: "auto" }}
        >
          ?
        </button>
      )}

      {/* === Animated page === */}
      <div
        key={pageKey}
        className={pageEnter ? "page-enter page-enter-active" : "page-enter"}
        style={{ minHeight: "100vh" }}
      >
        {tab === "create" && <CreatorScreen />}
        {tab === "playground" && <PlaygroundScreen />}
        {tab === "tuner" && <TunerScreen />}
        {tab === "journal" && <JournalScreen />}
        {tab === "settings" && <SettingsScreen />}
      </div>

      <ExplainSheet />
      <AchievementToast achievement={latestAchievement} />

      {/* === Install app (offline) === */}
      {installDeferred && (
        <button
          onClick={install}
          className="cta"
          style={{
            position: "fixed", bottom: "calc(4.6rem + env(safe-area-inset-bottom))", left: "var(--pad-x)",
            padding: "0.55rem 1rem", fontSize: "0.56rem", letterSpacing: "0.3em",
            color: "var(--bone)",
            border: "1px solid var(--accent)", borderColor: "var(--accent)",
            background: "transparent", zIndex: 9700, cursor: "pointer",
          }}
          aria-label="Install Guitarnada for offline use"
        >
          Install app
        </button>
      )}

      {/* === Bottom navbar (icon-based) === */}

      <nav className="tabbar" style={{
        background: "linear-gradient(180deg, transparent, var(--void) 70%)",
        borderTop: "1px solid var(--hair)",
        paddingTop: "0.45rem",
      }}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              className={`tabbar__item ${active ? "tabbar__item--active" : ""}`}
              onClick={() => handleTab(t.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "0.32rem",
                color: active ? "var(--bone)" : "var(--ash)",
                transform: active ? "translateY(-2px)" : "translateY(0)",
                transition: "transform 0.4s var(--ease-soft), color 0.4s var(--ease)",
              }}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
            >
              <t.Icon width={20} height={20} />
              <span style={{ fontSize: "0.5rem" }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
