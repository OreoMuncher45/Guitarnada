// Hairline SVG icons — one thin-stroke set, no fills, matches the Noctis bone discipline.
import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.1, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, ...props,
});

export function DiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CreateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 9h8M8 13h5" />
      <path d="M15 20v-5h5" />
    </svg>
  );
}

export function PlaygroundIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <line x1="5" y1="6" x2="5" y2="18" />
      <line x1="9" y1="6" x2="9" y2="18" />
      <line x1="13" y1="6" x2="13" y2="18" />
      <line x1="17" y1="6" x2="17" y2="18" />
      <line x1="21" y1="6" x2="21" y2="18" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function TunerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v9" />
      <path d="M8 21a4 4 0 0 1 8 0" />
      <circle cx="12" cy="9" r="6" />
    </svg>
  );
}

export function JournalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  );
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M7 5l10 7-10 7V5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HeartIcon(props: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return (
    <svg {...base(rest)}>
      <path d="M12 20C7 16 4 13 4 9.5 4 7 6 5 8.5 5c1.5 0 2.6.7 3.5 1.7C13 5.7 14 5 15.5 5 18 5 20 7 20 9.5c0 3.5-3 6.5-8 10.5Z" fill={filled ? "var(--accent)" : "none"} />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <path d="M14 6l6 6-6 6" />
    </svg>
  );
}

export function CapoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="3" y1="9" x2="6" y2="9" />
      <line x1="18" y1="9" x2="21" y2="9" />
    </svg>
  );
}

export function MetronomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8 21l4-17 4 17" />
      <line x1="6" y1="21" x2="18" y2="21" />
      <line x1="12" y1="10" x2="16" y2="16" />
      <path d="M9 4l-1 3h8l-1-3" />
    </svg>
  );
}

export function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l2.5 6L20 11l-5.5 2L12 19l-2-6L4 11l7-2 1-6Z" fill="currentColor" stroke="none" opacity={0.85} />
    </svg>
  );
}
