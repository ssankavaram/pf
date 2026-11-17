"use client";

import { useEffect, useRef, useState } from "react";

// Brand palette (same as the doodles). The first one is yours.
const COLORS = [
  { bg: "#F2643A", fg: "#fff" },    // orange (you)
  { bg: "#8E6CFF", fg: "#fff" },    // violet
  { bg: "#2E8C73", fg: "#fff" },    // leaf
  { bg: "#E2558F", fg: "#fff" },    // pink
  { bg: "#FFD23F", fg: "#241A16" }, // sun
  { bg: "#241A16", fg: "#F4EFE6" }, // ink
];

/* ---- Tuning knobs ------------------------------------------------------- */
const MOVE_MIN = 1.4;   // seconds a cursor takes to glide to its next spot (min)
const MOVE_MAX = 3.2;   // (max)
const PAUSE_MAX = 1.6;  // longest pause between moves, in seconds
const FOLLOW_LAG = 0.05; // how loosely the "Engineering" cursor trails you (lower = lazier)
/* ------------------------------------------------------------------------ */

type Bot = {
  x: number; y: number;          // current, 0–1 of the section
  fx: number; fy: number;        // where the current move started
  tx: number; ty: number;        // where it's heading
  start: number; dur: number;    // move timing, ms
  wait: number;                  // pause after arriving, ms
  follows: boolean;
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const between = (a: number, b: number) => a + Math.random() * (b - a);

function Pointer({ color: { bg: color, fg }, label }: { color: { bg: string; fg: string }; label: string }) {
  return (
    <>
      <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden>
        <path
          d="M1.5 1.5 L1.5 17.5 L6 13.3 L9.2 20.2 L12 19 L8.9 12.2 L15 12.2 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className="mp-tag" style={{ background: color, color: fg }}>
        {label}
      </span>
    </>
  );
}

export default function Collab({
  quote,
  by,
  you,
  names,
}: {
  quote: string;
  by: string;
  you: string;
  names: string[];
}) {
  const root = useRef<HTMLElement>(null);
  const me = useRef<HTMLDivElement>(null);
  const bots = useRef<(HTMLDivElement | null)[]>([]);
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFinePointer(fine);

    let w = el.clientWidth;
    let h = el.clientHeight;
    const ro = new ResizeObserver(() => {
      w = el.clientWidth;
      h = el.clientHeight;
    });
    ro.observe(el);

    // Your cursor: positioned instantly, no lag, so it feels like the real pointer.
    const pointer = { x: 0.5, y: 0.5, inside: false };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = (e.clientY - r.top) / r.height;
      pointer.inside = true;
      if (me.current) {
        me.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`;
        me.current.style.opacity = "1";
      }
    };
    const onLeave = () => {
      pointer.inside = false;
      if (me.current) me.current.style.opacity = "0";
    };
    if (fine) {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    }

    // Other cursors wander between random spots, pausing like someone reading.
    const now = performance.now();
    const state: Bot[] = names.map((_, i) => {
      const x = between(0.1, 0.9);
      const y = between(0.15, 0.85);
      return {
        x, y, fx: x, fy: y, tx: x, ty: y,
        start: now, dur: 0, wait: between(0, PAUSE_MAX * 1000),
        follows: i === 1 && fine && !reduced,
      };
    });

    const place = (i: number, b: Bot) => {
      const node = bots.current[i];
      if (node) node.style.transform = `translate3d(${b.x * w}px, ${b.y * h}px, 0)`;
    };

    const tick = (t: number) => {
      state.forEach((b, i) => {
        if (b.follows && pointer.inside) {
          // Trails just behind and below your cursor.
          b.x += (pointer.x - 0.04 - b.x) * FOLLOW_LAG;
          b.y += (pointer.y + 0.08 - b.y) * FOLLOW_LAG;
          b.fx = b.tx = b.x;
          b.fy = b.ty = b.y;
          b.start = t;
          b.dur = 0;
        } else {
          const p = b.dur ? Math.min((t - b.start) / b.dur, 1) : 1;
          const e = easeInOut(p);
          b.x = b.fx + (b.tx - b.fx) * e;
          b.y = b.fy + (b.ty - b.fy) * e;
          if (p >= 1 && t - b.start - b.dur > b.wait) {
            b.fx = b.x;
            b.fy = b.y;
            b.tx = between(0.08, 0.92);
            b.ty = between(0.12, 0.88);
            b.start = t;
            b.dur = between(MOVE_MIN, MOVE_MAX) * 1000;
            b.wait = between(0.2, PAUSE_MAX) * 1000;
          }
        }
        place(i, b);
      });
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    // Reduced motion: other cursors stay put.
    let raf = 0;
    let visible = false;
    let io: IntersectionObserver | null = null;
    if (reduced) {
      state.forEach((b, i) => place(i, b));
    } else {
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(tick);
      });
      io.observe(el);
    }

    return () => {
      ro.disconnect();
      io?.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [names]);

  return (
    <section ref={root} id="collab" className={`collab${finePointer ? " collab-live" : ""}`}>
      <blockquote className="collab-quote">
        <p>“{quote}”</p>
        <footer className="small">{by}</footer>
      </blockquote>

      {names.map((name, i) => (
        <div
          key={name}
          className="mp-cursor"
          aria-hidden
          ref={(node) => {
            bots.current[i] = node;
          }}
        >
          <Pointer color={COLORS[(i + 1) % COLORS.length]} label={name} />
        </div>
      ))}

      {finePointer && (
        <div ref={me} className="mp-cursor mp-me" aria-hidden>
          <Pointer color={COLORS[0]} label={you} />
        </div>
      )}
    </section>
  );
}
