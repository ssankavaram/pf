"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ContactIcons from "./ContactIcons";

/* ---- Tuning knobs ------------------------------------------------------- */
const MOVE_MIN = 1.6;     // seconds a tag takes to glide to its next spot (min)
const MOVE_MAX = 3.4;     // (max)
const PAUSE_MAX = 1.6;    // longest pause between moves (s)
const KEEP_CLEAR = 18;    // px of space the drifting tags keep around the text in the middle and the links
const YOU_OFFSET = { x: 0, y: 0 };   // puts the "You" arrow's tip right on your pointer (px)
/* ------------------------------------------------------------------------ */

// Name tags exactly as in Figma (node 67:5106): a small outlined arrow plus a pill. The pill backgrounds
// are Figma's own renders of its "slice shift" shader (that effect needs experimental browser features,
// so it's baked into images); the arrows are the design's SVGs.
const TAGS = {
  you: { label: "You", id: "you", w: 54, at: [1026, 132] },
  others: [
    { label: "Srija", id: "srija", w: 54, at: [442, 82] },
    { label: "Engineering", id: "engineering", w: 76.5, at: [346, 176] },
    { label: "Product", id: "product", w: 65.5, at: [803, 217] },
  ],
};
const FRAME = { w: 1440, h: 265 }; // Figma frame size, for the starting spots

function Tag({ label, id, w }: { label: string; id: string; w: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ctag-arrow" src={`/footer/arrow-${id}.svg`} width={8.34} height={7.94} alt="" />
      <span className="ctag" style={{ width: w, backgroundImage: `url(/footer/pill-${id}.png)` }}>
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
      return [".cfooter-main", ".cfooter-side", ".cfooter-copy", ".cfooter-credit"].flatMap((sel) => {
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
      // the other tags' destinations count as taken, so they don't pile on top of each other
      const taken = state.filter((o) => o !== b).map((o) => {
        const node = bots.current[state.indexOf(o)];
        const ow = node?.offsetWidth ?? 100, oh = node?.offsetHeight ?? 26;
        return { l: o.tx * w - 12, t: o.ty * h - 12, r: o.tx * w + ow + 12, b: o.ty * h + oh + 12 };
      });
      for (let tries = 0; tries < 60; tries++) {
        const tx = between(0.04, 0.8), ty = between(0.06, 0.82);
        if (hits(i, tx * w, ty * h, taken)) continue;
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

    // The header steps out of the way while the footer is on screen.
    const html = document.documentElement;
    // The footer sits underneath the page, so "in view" means uncovered: how far you are from the bottom.
    let shown = false;
    const setFooterIn = (on: boolean) => { if (on) html.dataset.footerIn = ""; else delete html.dataset.footerIn; };
    const onScroll = () => {
      const left = html.scrollHeight - (window.scrollY + window.innerHeight); // px of page still below the screen
      const on = left < el.offsetHeight - 40; // at least 40px of the footer showing
      if (on !== shown) { shown = on; setFooterIn(on); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
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
      setFooterIn(false);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <footer ref={root} id="contact" className={`cfooter${fine ? " is-live" : ""}`}>
      {TAGS.others.map((t, i) => (
        <div key={t.label} className="ctag-pos" style={{ width: t.w + 7 }} aria-hidden ref={(n) => { bots.current[i] = n; }}>
          <Tag {...t} />
        </div>
      ))}
      {fine && (
        <div ref={me} className="ctag-pos ctag-me" style={{ width: TAGS.you.w + 7 }} aria-hidden>
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
      <p className="cfooter-credit">Designed by me. Developed with Claude Code.</p>
    </footer>
  );
}
