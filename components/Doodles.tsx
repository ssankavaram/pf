// Hand-drawn style illustrations used in the hero and footer stickers.
// All share a 100 × 100 viewBox so they scale together.

const INK = "#2B1B17";

type P = { className?: string };

export function Flower({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse key={r} cx="50" cy="27" rx="14" ry="21" fill="#F2643A" transform={`rotate(${r} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="11" fill="#FFD23F" />
      <circle cx="50" cy="50" r="4" fill={INK} />
    </svg>
  );
}

export function Yarn({ className }: P) {
  const strand = { fill: "none", stroke: "#D9578F", strokeWidth: 4, strokeLinecap: "round" as const };
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <path d="M72 74 C86 82 80 96 98 93" {...strand} />
      <circle cx="47" cy="47" r="35" fill="#F59BC0" />
      <path d="M19 39 C35 21 62 19 79 33" {...strand} />
      <path d="M13 53 C33 37 66 35 82 51" {...strand} />
      <path d="M19 69 C38 53 64 53 77 67" {...strand} />
      <path d="M35 15 C25 39 29 65 43 81" {...strand} />
      <path d="M59 14 C71 35 69 61 55 81" {...strand} />
      <circle cx="34" cy="30" r="4.5" fill="#fff" opacity="0.55" />
    </svg>
  );
}

export function Bulb({ className }: P) {
  const ray = { stroke: "#FF8A3D", strokeWidth: 5, strokeLinecap: "round" as const };
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 3 L50 11" {...ray} />
      <path d="M21 13 L26 19" {...ray} />
      <path d="M79 13 L74 19" {...ray} />
      <path d="M8 39 L16 40" {...ray} />
      <path d="M92 39 L84 40" {...ray} />
      <path d="M24 44 A26 26 0 1 1 76 44 C76 55 66 61 62 70 L38 70 C34 61 24 55 24 44 Z" fill="#FFD23F" />
      <rect x="37" y="70" width="26" height="17" rx="4" fill="#8E6CFF" />
      <path d="M40 76 H60 M40 81.5 H60" stroke="#6A48E0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="41" cy="42" r="3.2" fill={INK} />
      <circle cx="59" cy="42" r="3.2" fill={INK} />
      <circle cx="35" cy="50" r="4" fill="#FF9BB0" opacity="0.8" />
      <circle cx="65" cy="50" r="4" fill="#FF9BB0" opacity="0.8" />
      <path d="M43 50 Q50 57 57 50" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className, color = "#FFC83D" }: P & { color?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 2 C54 36 64 46 98 50 C64 54 54 64 50 98 C46 64 36 54 2 50 C36 46 46 36 50 2 Z" fill={color} />
    </svg>
  );
}

export function Sprig({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 97 C49 72 53 46 50 22" fill="none" stroke="#2E8C73" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="37" cy="66" rx="13" ry="6.5" fill="#3BAA8C" transform="rotate(-30 37 66)" />
      <ellipse cx="63" cy="54" rx="13" ry="6.5" fill="#2E8C73" transform="rotate(30 63 54)" />
      <ellipse cx="38" cy="41" rx="12" ry="6" fill="#2E8C73" transform="rotate(-30 38 41)" />
      <ellipse cx="62" cy="31" rx="11" ry="5.5" fill="#3BAA8C" transform="rotate(30 62 31)" />
      <circle cx="50" cy="16" r="8" fill="#8E6CFF" />
      <circle cx="50" cy="16" r="3" fill="#FFD23F" />
    </svg>
  );
}
