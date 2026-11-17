"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ---- Tuning knobs ------------------------------------------------------- */
const LINES = 16;      // number of lines
const POINTS = 9;      // bends per line (more = more tangled)
const SCROLL = 1.4;    // screen-heights of scrolling to fully straighten
const STAGGER = 0.35;  // how spread out in time the lines straighten (0 = all at once)
const WOBBLE = 14;     // how much the tangle drifts while idle
const SCRUB = 0.6;     // smoothing, in seconds
/* ------------------------------------------------------------------------ */

type Pt = [number, number];
type Line = { from: Pt[]; to: Pt[]; delay: number; phase: number[] };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Small seeded random generator, so the tangle looks the same on every visit.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Coordinates are in a 1000 × 1000 box stretched over the screen.
function makeLines(): Line[] {
  const rand = seeded(7);
  const half = LINES / 2;
  return Array.from({ length: LINES }, (_, l) => {
    // Straight lanes: half above the headline, half below, leaving a clear band in the middle.
    const top = l < half;
    const k = top ? l : l - half;
    const laneY = top ? 80 + (k * 220) / (half - 1) : 700 + (k * 220) / (half - 1);
    const to: Pt[] = Array.from({ length: POINTS }, (_, i) => [-50 + (i * 1100) / (POINTS - 1), laneY]);
    // Tangled: ends anchored off the left/right edges, everything in between scattered so curves loop and cross.
    const from: Pt[] = to.map((_, i) =>
      i === 0 ? [-50, 100 + rand() * 800]
      : i === POINTS - 1 ? [1050, 100 + rand() * 800]
      : [120 + rand() * 760, 120 + rand() * 760],
    );
    return { from, to, delay: rand() * STAGGER, phase: to.map(() => rand() * Math.PI * 2) };
  });
}

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

export default function Landing() {
  const root = useRef<HTMLElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const clarity = useRef<HTMLSpanElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    const lines = makeLines();
    const state = { t: 0 };

    // t: 0 = tangled, 1 = straight. time drives the idle drift.
    const render = (t: number, time: number) => {
      lines.forEach((line, l) => {
        const el = paths.current[l];
        if (!el) return;
        const e = easeInOut(clamp((t - line.delay) / (1 - STAGGER), 0, 1));
        const drift = (1 - e) * WOBBLE;
        const pts = line.from.map(([fx, fy], i): Pt => {
          const [tx, ty] = line.to[i];
          const ph = line.phase[i];
          return [
            fx + (tx - fx) * e + Math.cos(time * 0.0007 + ph) * drift,
            fy + (ty - fy) * e + Math.sin(time * 0.0009 + ph) * drift,
          ];
        });
        el.setAttribute("d", toPath(pts));
        el.style.strokeOpacity = String(0.3 + 0.3 * e);
      });
      if (clarity.current) {
        clarity.current.style.filter = `blur(${((1 - t) * 6).toFixed(2)}px)`;
        clarity.current.style.opacity = String(0.35 + 0.65 * t);
      }
      if (hint.current) hint.current.style.opacity = String(clamp(1 - t * 4, 0, 1));
    };

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        state,
        { t: 0 },
        {
          t: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${window.innerHeight * SCROLL}`,
            pin: true,
            scrub: SCRUB,
          },
        },
      );

      // Animate only while the landing section is on screen.
      let raf = 0;
      let visible = true;
      const loop = (time: number) => {
        render(state.t, time);
        raf = visible ? requestAnimationFrame(loop) : 0;
      };
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(loop);
      });
      if (root.current) io.observe(root.current);
      raf = requestAnimationFrame(loop);

      return () => {
        io.disconnect();
        cancelAnimationFrame(raf);
      };
    });

    // Reduced motion: show the resolved, straight state with no animation.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      render(1, 0);
    });

    return () => {
      mm.revert();
      html.style.scrollBehavior = prevScrollBehavior;
    };
  }, []);

  return (
    <section ref={root} className="landing">
      <svg className="landing-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: LINES }, (_, i) => (
          <path
            key={i}
            vectorEffect="non-scaling-stroke"
            ref={(el) => {
              paths.current[i] = el;
            }}
          />
        ))}
      </svg>
      <h2 className="landing-title">
        I transform confusion
        <br />
        into{" "}
        <span ref={clarity} className="landing-clarity">
          clarity
        </span>
      </h2>
      <p ref={hint} className="landing-hint small" aria-hidden>
        Scroll
      </p>
    </section>
  );
}
