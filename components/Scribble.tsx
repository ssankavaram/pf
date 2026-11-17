"use client";

import { useEffect, useRef, useState } from "react";

/* ---- Tuning knobs ------------------------------------------------------- */
const LOOPS = 1.85;   // how many times the pen goes around (a little under 2 = an open, hand-drawn end)
const POINTS = 26;    // points per loop (fewer = wobblier)
const JITTER = 0.035; // how much each point wanders (fraction of the radius)
const FPS = 10;       // "boil" rate: how often the line redraws itself
const PAD_X = 0.18;   // space between the card and the loop, as a fraction of card size
const PAD_Y = 0.1;
const STROKE = 2.5;
const DRAW_MS = 700;  // time to draw the loop in
/* ------------------------------------------------------------------------ */

type Pt = [number, number];

// Smooth curve through the points (Catmull-Rom → cubic Bézier).
function toPath(pts: Pt[]) {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

// A loose oval drawn ~2 times around, each lap slightly smaller, every point nudged a little.
function scribble(W: number, H: number, start: number) {
  const cx = W / 2;
  const cy = H / 2;
  const rx = W / 2 - STROKE * 2;
  const ry = H / 2 - STROKE * 2;
  const n = Math.round(POINTS * LOOPS);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = start + t * LOOPS * Math.PI * 2;
    const shrink = 1 - 0.05 * t;
    const wobble = 1 + (Math.random() - 0.5) * 2 * JITTER;
    pts.push([cx + Math.cos(a) * rx * shrink * wobble, cy + Math.sin(a) * ry * shrink * wobble]);
  }
  return toPath(pts);
}

/** Hand-drawn loop around a w × h box. Draws itself in whenever `drawKey` changes. */
export default function Scribble({ w, h, drawKey, color = "var(--orange)" }: { w: number; h: number; drawKey: string | number; color?: string }) {
  const W = w * (1 + PAD_X * 2);
  const H = h * (1 + PAD_Y * 2);
  const start = useRef(-2.3);
  const [d, setD] = useState(() => scribble(W, H, start.current));
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    start.current = -2.3 + (Math.random() - 0.5) * 0.8; // each new loop starts in a slightly different spot
    setD(scribble(W, H, start.current));
    if (reduced) return;

    pathRef.current?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: DRAW_MS,
      easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      fill: "both",
    });
    const id = setInterval(() => setD(scribble(W, H, start.current)), 1000 / FPS);
    return () => clearInterval(id);
  }, [W, H, drawKey]);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }} aria-hidden>
      <path
        ref={pathRef}
        d={d}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 1"
      />
    </svg>
  );
}
