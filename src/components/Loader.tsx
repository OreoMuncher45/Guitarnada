import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
}

export function Loader({ onDone }: Props) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setGone(true);
      setTimeout(onDone, 320);
    }, 1100);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="loader" style={gone ? { opacity: 0, transition: "opacity 0.3s var(--ease)" } : undefined}>
      <div className="loader__word">GUITARNADA</div>
      <div className="loader__bar"><i /></div>
    </div>
  );
}
