"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Page sections in order (element ids). The hero's sideways project row is never snapped mid-way.
// `dark` flips the dots to light colours while that section is showing.
// The first section is the pinned work gallery, which snaps between projects on its own.
const SECTIONS = [
  { id: "top", label: "Work", dark: false },
  { id: "collab", label: "Contact", dark: false },
  { id: "contact", label: "Footer", dark: true },
];

/* ---- Tuning knobs ------------------------------------------------------- */
const SNAP_DELAY = 0.05;              // seconds of stillness before snapping kicks in
const SNAP_DURATION = { min: 0.35, max: 0.9 };
const LEAN = 0.18;                    // scroll this fraction of the way into the next section and it carries you there
/* ------------------------------------------------------------------------ */

export default function SectionDots() {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const points = useRef<number[]>([]); // scroll position where each section starts
  const heroEnd = useRef(0);           // where the hero's sideways scroll finishes

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // CSS smooth scrolling fights the snap animation, so turn it off while this is mounted.
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const topOf = (id: string) => {
      const el = document.getElementById(id);
      return el ? el.getBoundingClientRect().top + window.scrollY : 0;
    };

    const measure = () => {
      const max = ScrollTrigger.maxScroll(window);
      // The pinned first section ends where the second one starts, minus its own height.
      const second = topOf(SECTIONS[1].id);
      const first = document.getElementById(SECTIONS[0].id);
      heroEnd.current = Math.max(0, second - (first?.offsetHeight ?? window.innerHeight));
      // The footer is sticky, so "its" position is simply the bottom of the page.
      points.current = [0, ...SECTIONS.slice(1, -1).map((s) => topOf(s.id)), max];
    };

    const updateActive = (y: number) => {
      const half = window.innerHeight * 0.5;
      let a = 0;
      points.current.forEach((p, i) => {
        if (i > 0 && y >= p - half) a = i;
      });
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onRefresh: measure,
      onUpdate: (self) => updateActive(self.scroll()),
      snap: reduced
        ? undefined
        : {
            snapTo: (progress: number) => {
              const max = ScrollTrigger.maxScroll(window);
              const y = progress * max;
              // Inside the hero's sideways row: leave scrolling alone.
              if (y < heroEnd.current - 2 || !max) return progress;
              const targets = [heroEnd.current, ...points.current.slice(1)];
              // Find the section starts either side of where we are.
              let prev = targets[0];
              let next = targets[targets.length - 1];
              for (const t of targets) {
                if (t <= y) prev = t;
                if (t >= y) { next = t; break; }
              }
              if (next === prev) return prev / max;
              // Lean in the direction you're scrolling: a small push is enough to move on.
              const frac = (y - prev) / (next - prev);
              const dir = st.direction; // 1 = scrolling down, -1 = up
              const goNext = dir > 0 ? frac > LEAN : frac > 1 - LEAN;
              return (goNext ? next : prev) / max;
            },
            duration: SNAP_DURATION,
            delay: SNAP_DELAY,
            ease: "power2.inOut",
            directional: false,
          },
    });
    measure();
    updateActive(window.scrollY);

    return () => {
      st.kill();
      html.style.scrollBehavior = prevScrollBehavior;
    };
  }, []);

  const go = (i: number) => {
    window.scrollTo({ top: points.current[i] ?? 0, behavior: "smooth" });
  };

  return (
    <nav className={`dots${SECTIONS[active]?.dark ? " on-dark" : ""}`} aria-label="Page sections">
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          className={`dot${i === active ? " on" : ""}`}
          aria-label={s.label}
          aria-current={i === active ? "true" : undefined}
          onClick={() => go(i)}
        >
          <span className="dot-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
