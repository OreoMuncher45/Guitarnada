import { useEffect, useRef, useState } from "react";

interface ToastAchievement { key: string; title: string; description: string; }

export function AchievementToast({ achievement }: { achievement: ToastAchievement | null }) {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState<ToastAchievement | null>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!achievement || lastKey.current === achievement.key) { setShow(false); return; }
    setCurrent(achievement);
    lastKey.current = achievement.key;
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(t);
  }, [achievement, achievement?.key]);

  if (!current) return null;
  return (
    <div
      style={{
        position: "fixed", bottom: `calc(5.5rem + env(safe-area-inset-bottom))`, left: "50%",
        transform: `translateX(-50%) translateY(${show ? "0" : "1.6rem"})`,
        background: "var(--shadow)", border: "1px solid var(--hair-strong)",
        padding: "1rem 1.6rem", maxWidth: "82vw", textAlign: "center",
        opacity: show ? 1 : 0,
        transition: "opacity 0.5s var(--ease), transform 0.5s var(--ease-soft)",
        zIndex: 9950, pointerEvents: "none",
      }}
      aria-live="polite"
    >
      <div className="label" style={{ color: "var(--smoke)" }}>Achievement unlocked</div>
      <div className="display display--sm" style={{ marginTop: "0.4rem", marginBottom: "0.3rem", fontSize: "1.4rem" }}>{current.title}</div>
      <div className="label" style={{ color: "var(--ash)" }}>{current.description}</div>
    </div>
  );
}
