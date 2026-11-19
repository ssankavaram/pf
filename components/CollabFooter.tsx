"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ContactIcons from "./ContactIcons";

/* ---- Tuning knobs ------------------------------------------------------- */
const MOVE_MIN = 1.6;     // seconds a tag takes to glide to its next spot (min)
const MOVE_MAX = 3.4;     // (max)
const PAUSE_MAX = 1.6;    // longest pause between moves (s)
const FOLLOW_LAG = 0.05;  // how loosely "Engineering" trails your cursor (lower = lazier)
const YOU_OFFSET = { x: 14, y: 16 }; // where your "You" tag sits relative to the pointer (px)
/* ------------------------------------------------------------------------ */

// Glowing name tags from the Figma footer (node 64:4880): a soft coloured glow, a dim streak
// and a light streak under a white label. `streak` is the dim streak's colour.
const TAGS = {
  you: { label: "You", glow: "#5B8FF9", streak: "#5E3076", at: [1026, 132] },
  others: [
    { label: "Srija", glow: "#BA5BF9", streak: "#5E3076", at: [442, 82] },
    { label: "Engineering", glow: "#5BE1F9", streak: "#5E3076", at: [346, 176] },
    { label: "Product", glow: "#5BF9AD", streak: "#305C76", at: [803, 217] },
  ],
};
const FRAME = { w: 1440, h: 265 }; // Figma frame size, for the starting spots

function Tag({ label, glow, streak }: { label: string; glow: string; streak: string }) {
  return (
    <span className="ctag">
      <svg className="ctag-glow" width="141" height="93" viewBox="0 0 141 93" aria-hidden>
        <ellipse cx="70.5" cy="46.5" rx="40.5" ry="16.5" fill={glow} opacity="0.47" style={{ filter: "blur(15px)" }} />
      </svg>
      <svg className="ctag-streak" width="68" height="31" viewBox="0 0 68 31" aria-hidden>
        <path d="M47 18C51.4263 17.1147 64 4 64 4L62.5 25.5L4 27V25.5C4 25.5 19.5 23.5 47 18Z" fill={streak} style={{ filter: "blur(2px)" }} />
      </svg>
      <svg className="ctag-shine" width="80" height="35" viewBox="0 0 80 35" aria-hidden>
        <path d="M62 23C66.4263 22.1147 75 4 75 4L76 29.5L17.5 31L4 27.5C4 27.5 34.5 28.5 62 23Z" fill="#D9D9D9" style={{ filter: "blur(2px)" }} />
      </svg>
      <span className="ctag-label">{label}</span>
    </span>
  );
}

type Bot = { x: number; y: number; fx: number; fy: number; tx: number; ty: number; start: number; dur: number; wait: number; follows: boolean };
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const between = (a: number, b: number) => a + Math.random() * (b - a);

type Item = { label: string; href: string };

export default function CollabFooter({ nav }: { nav: Item[] }) {
  const root = useRef<HTMLElement>(null);
  const me = useRef<HTMLDivElement>(null);
  const bots = useRef<(HTMLDivElement | null)[]>([]);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const isFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFine(isFine);

    let w = el.clientWidth, h = el.clientHeight;
    const ro = new ResizeObserver(() => { w = el.clientWidth; h = el.clientHeight; });
    ro.observe(el);

    // "You" sits right by your pointer, with no lag, like a multiplayer cursor label.
    const pointer = { x: 0.5, y: 0.5, inside: false };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = (e.clientY - r.top) / r.height;
      pointer.inside = true;
      if (me.current) {
        me.current.style.transform = `translate3d(${e.clientX - r.left + YOU_OFFSET.x}px, ${e.clientY - r.top + YOU_OFFSET.y}px, 0)`;
        me.current.style.opacity = "1";
      }
    };
    const onLeave = () => { pointer.inside = false; if (me.current) me.current.style.opacity = "0"; };
    if (isFine) {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    }

    // The others drift between spots, pausing like someone reading. They start where the design has them.
    const now = performance.now();
    const state: Bot[] = TAGS.others.map((t, i) => {
      const x = t.at[0] / FRAME.w, y = t.at[1] / FRAME.h;
      return { x, y, fx: x, fy: y, tx: x, ty: y, start: now, dur: 0, wait: between(400, PAUSE_MAX * 1000), follows: i === 1 && isFine && !reduced };
    });
    const place = (i: number, b: Bot) => {
      const node = bots.current[i];
      if (node) node.style.transform = `translate3d(${b.x * w}px, ${b.y * h}px, 0)`;
    };

    let raf = 0, visible = false;
    const tick = (t: number) => {
      state.forEach((b, i) => {
        if (b.follows && pointer.inside) {
          b.x += (pointer.x - 0.06 - b.x) * FOLLOW_LAG;
          b.y += (pointer.y + 0.18 - b.y) * FOLLOW_LAG;
          b.fx = b.tx = b.x; b.fy = b.ty = b.y; b.start = t; b.dur = 0;
        } else {
          const p = b.dur ? Math.min((t - b.start) / b.dur, 1) : 1;
          const e = easeInOut(p);
          b.x = b.fx + (b.tx - b.fx) * e;
          b.y = b.fy + (b.ty - b.fy) * e;
          if (p >= 1 && t - b.start - b.dur > b.wait) {
            b.fx = b.x; b.fy = b.y;
            b.tx = between(0.12, 0.78); // stays clear of the links on the right
            b.ty = between(0.12, 0.85);
            b.start = t;
            b.dur = between(MOVE_MIN, MOVE_MAX) * 1000;
            b.wait = between(0.2, PAUSE_MAX) * 1000;
          }
        }
        place(i, b);
      });
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    let io: IntersectionObserver | null = null;
    if (reduced) state.forEach((b, i) => place(i, b)); // reduced motion: tags stay put
    else {
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(tick);
      });
      io.observe(el);
    }
    state.forEach((b, i) => place(i, b));

    return () => {
      ro.disconnect();
      io?.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <footer ref={root} id="contact" className="cfooter">
      {TAGS.others.map((t, i) => (
        <div key={t.label} className="ctag-pos" aria-hidden ref={(n) => { bots.current[i] = n; }}>
          <Tag {...t} />
        </div>
      ))}
      {fine && (
        <div ref={me} className="ctag-pos ctag-me" aria-hidden>
          <Tag {...TAGS.you} />
        </div>
      )}

      <div className="cfooter-main">
        <p className="cfooter-title">Let&rsquo;s work together!</p>
        <ContactIcons nav={nav} />
      </div>

      <nav className="cfooter-side" aria-label="Footer">
        <a href="#top" className="cfooter-top">Back to top</a>
        <Link href="/">Work</Link>
        <span aria-disabled="true" title="Coming soon">Playground</span>
        <Link href="/about">About</Link>
      </nav>

      <p className="cfooter-copy">&copy; {new Date().getFullYear()} Srija Sankavaram</p>
    </footer>
  );
}
