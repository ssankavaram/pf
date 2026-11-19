"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ContactIcons from "./ContactIcons";

/* ---- Tuning knobs ------------------------------------------------------- */
const MOVE_MIN = 1.6;     // seconds a tag takes to glide to its next spot (min)
const MOVE_MAX = 3.4;     // (max)
const PAUSE_MAX = 1.6;    // longest pause between moves (s)
const KEEP_CLEAR = 18;    // px of space the drifting tags keep around the text in the middle and the links
const YOU_OFFSET = { x: -2, y: -2 }; // puts the "You" arrow's tip right on your pointer (px)
/* ------------------------------------------------------------------------ */

// Name tags, styled like multiplayer cursors: an arrow plus a pill whose background is a crop of one of
// the carousel cards' gradients (bg = card background image, pos = which part of it shows).
const TAGS = {
  you: { label: "You", color: "#8FA8FF", bg: "/home/bg2.jpg", pos: "4% 47%", at: [1026, 132] },
  others: [
    { label: "Srija", color: "#8B7BF0", bg: "/home/bg4.jpg", pos: "28% 34%", at: [442, 82] },
    { label: "Engineering", color: "#D88A45", bg: "/home/bg3.jpg", pos: "88% 94%", at: [346, 176] },
    { label: "Product", color: "#93A882", bg: "/home/bg1.jpg", pos: "8% 86%", at: [803, 217] },
  ],
};
const FRAME = { w: 1440, h: 265 }; // Figma frame size, for the starting spots

function Tag({ label, color, bg, pos }: { label: string; color: string; bg: string; pos: string }) {
  return (
    <>
      <svg className="ctag-arrow" width="16" height="20" viewBox="0 0 18 22" aria-hidden>
        <path d="M1.5 1.5 L1.5 17.5 L6 13.3 L9.2 20.2 L12 19 L8.9 12.2 L15 12.2 Z" fill={color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="ctag" style={{ backgroundImage: `url(${bg})`, backgroundPosition: pos }}>
        <span className="ctag-label">{label}</span>
      </span>
    </>
  );
}

type Bot = { x: number; y: number; fx: number; fy: number; tx: number; ty: number; start: number; dur: number; wait: number };
type Box = { l: number; t: number; r: number; b: number };
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
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (me.current) {
        me.current.style.transform = `translate3d(${e.clientX - r.left + YOU_OFFSET.x}px, ${e.clientY - r.top + YOU_OFFSET.y}px, 0)`;
        me.current.style.opacity = "1";
      }
    };
    const onLeave = () => { if (me.current) me.current.style.opacity = "0"; };
    if (isFine) {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    }

    // The others drift between spots on their own, pausing like someone reading. They start where the
    // design has them, and never pick a spot or a path that would cross the text in the middle or the links.
    const now = performance.now();
    const state: Bot[] = TAGS.others.map((t) => {
      const x = t.at[0] / FRAME.w, y = t.at[1] / FRAME.h;
      return { x, y, fx: x, fy: y, tx: x, ty: y, start: now, dur: 0, wait: between(400, PAUSE_MAX * 1000) };
    });
    const blockers = (): Box[] => {
      const r = el.getBoundingClientRect();
      return [".cfooter-main", ".cfooter-side", ".cfooter-copy"].flatMap((sel) => {
        const n = el.querySelector(sel);
        if (!n) return [];
        const b = n.getBoundingClientRect();
        return [{ l: b.left - r.left - KEEP_CLEAR, t: b.top - r.top - KEEP_CLEAR, r: b.right - r.left + KEEP_CLEAR, b: b.bottom - r.top + KEEP_CLEAR }];
      });
    };
    // Would the tag (arrow + pill, its top-left at x,y px) overlap any blocker?
    const hits = (i: number, x: number, y: number, boxes: Box[]) => {
      const node = bots.current[i];
      const tw = node?.offsetWidth ?? 100, th = node?.offsetHeight ?? 42;
      return boxes.some((k) => x < k.r && x + tw > k.l && y < k.b && y + th > k.t);
    };
    const clearPath = (i: number, b: Bot, tx: number, ty: number, boxes: Box[]) => {
      for (let s = 0; s <= 24; s++) {
        const e = s / 24;
        if (hits(i, (b.x + (tx - b.x) * e) * w, (b.y + (ty - b.y) * e) * h, boxes)) return false;
      }
      return true;
    };
    const pickSpot = (i: number, b: Bot) => {
      const boxes = blockers();
      for (let tries = 0; tries < 40; tries++) {
        const tx = between(0.04, 0.8), ty = between(0.06, 0.82);
        if (clearPath(i, b, tx, ty, boxes)) return [tx, ty];
      }
      return [b.x, b.y]; // nowhere clear right now: stay put and try again after the pause
    };
    const place = (i: number, b: Bot) => {
      const node = bots.current[i];
      if (node) node.style.transform = `translate3d(${b.x * w}px, ${b.y * h}px, 0)`;
    };

    let raf = 0, visible = false;
    const tick = (t: number) => {
      state.forEach((b, i) => {
        {
          const p = b.dur ? Math.min((t - b.start) / b.dur, 1) : 1;
          const e = easeInOut(p);
          b.x = b.fx + (b.tx - b.fx) * e;
          b.y = b.fy + (b.ty - b.fy) * e;
          if (p >= 1 && t - b.start - b.dur > b.wait) {
            b.fx = b.x; b.fy = b.y;
            [b.tx, b.ty] = pickSpot(i, b);
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
    <footer ref={root} id="contact" className={`cfooter${fine ? " is-live" : ""}`}>
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
