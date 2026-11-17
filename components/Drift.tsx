"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL = 2.2;      // screen-heights of scrolling while the section is pinned
const TRAVEL = 2.0;      // how far tiles travel left, in panel widths
const AVOID = 0.13;      // how far tiles bend away from the centre text (fraction of height)
const AVOID_WIDTH = 0.2; // how wide the "bend around" zone is (fraction of width)
const SCRUB = 0.6;
/* ------------------------------------------------------------------------ */

// x: start position in panel widths (tiles beyond 1 wait offscreen right)
// y: vertical position (0 top – 1 bottom), w: width relative to screen, d: depth (speed), r: tilt
const LAYOUT = [
  { x: 0.08, y: 0.24, w: 0.13, d: 1.0, r: -4, shape: "tall" },
  { x: 0.3, y: 0.75, w: 0.16, d: 1.25, r: 3, shape: "wide" },
  { x: 0.52, y: 0.16, w: 0.11, d: 0.8, r: 6, shape: "round" },
  { x: 0.73, y: 0.72, w: 0.13, d: 1.1, r: -3, shape: "tall" },
  { x: 0.93, y: 0.28, w: 0.16, d: 0.9, r: 2, shape: "wide" },
  { x: 1.12, y: 0.8, w: 0.1, d: 1.3, r: -6, shape: "round" },
  { x: 1.3, y: 0.2, w: 0.15, d: 1.15, r: -2, shape: "wide" },
  { x: 1.52, y: 0.68, w: 0.12, d: 0.85, r: 5, shape: "tall" },
  { x: 1.72, y: 0.25, w: 0.11, d: 1.2, r: -5, shape: "round" },
  { x: 1.92, y: 0.76, w: 0.16, d: 1.0, r: 2, shape: "wide" },
  { x: 2.12, y: 0.2, w: 0.13, d: 0.9, r: 4, shape: "tall" },
  { x: 2.34, y: 0.7, w: 0.15, d: 1.25, r: -3, shape: "wide" },
] as const;

export default function Drift({ images, line1, line2 }: { images: string[]; line1: string; line2: string }) {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    let W = 0;
    let H = 0;
    let sizes: { w: number; h: number }[] = [];

    const measure = () => {
      W = panel.current?.clientWidth ?? 0;
      H = panel.current?.clientHeight ?? 0;
      sizes = tiles.current.map((t) => ({ w: t?.offsetWidth ?? 0, h: t?.offsetHeight ?? 0 }));
    };

    const render = (p: number) => {
      LAYOUT.forEach((t, i) => {
        const el = tiles.current[i];
        if (!el) return;
        const cx = t.x - p * TRAVEL * t.d; // centre, in panel widths
        // Bend away from the centre text as the tile passes it.
        const dx = (cx - 0.5) / AVOID_WIDTH;
        const push = Math.exp(-dx * dx) * AVOID * (t.y < 0.5 ? -1 : 1);
        const cy = t.y + push;
        const { w, h } = sizes[i] ?? { w: 0, h: 0 };
        el.style.transform = `translate3d(${cx * W - w / 2}px, ${cy * H - h / 2}px, 0) rotate(${t.r + p * 8 * (t.d - 1)}deg)`;
        el.style.visibility = cx * W + w < -50 || cx * W - w > W + 50 ? "hidden" : "visible";
      });
    };

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const state = { p: 0 };
      measure();
      render(0);
      gsap.fromTo(
        state,
        { p: 0 },
        {
          p: 1,
          ease: "none",
          onUpdate: () => render(state.p),
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${window.innerHeight * SCROLL}`,
            pin: true,
            scrub: SCRUB,
            onRefresh: () => {
              measure();
              render(state.p);
            },
          },
        },
      );
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      measure();
      render(0.2);
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} className="drift" aria-label={`${line1} ${line2}`}>
      <div ref={panel} className="drift-panel">
        {LAYOUT.map((t, i) => (
          <div
            key={i}
            className={`drift-tile drift-${t.shape}`}
            style={{ "--w": t.w, "--float": `${5 + (i % 4)}s`, "--delay": `${-i * 0.7}s` } as React.CSSProperties}
            ref={(el) => {
              tiles.current[i] = el;
            }}
          >
            <div className="drift-inner">
              <Image src={images[i % images.length]} alt="" fill sizes="(max-width: 700px) 40vw, 18vw" />
            </div>
          </div>
        ))}
        <p className="drift-text">
          <span>{line1}</span>
          <span>{line2}</span>
        </p>
      </div>
    </section>
  );
}
