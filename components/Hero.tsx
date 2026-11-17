"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import IconStack, { type StackIcon } from "./IconStack";

export type WorkItem = {
  slug: string;
  title: string;     // full case-study title, shown top-left while active
  cover: string;
  isVideo: boolean;
  aspect: number;    // cover width ÷ height
  tags: string[];    // pills under the active project
};

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL_PER_STEP = 0.9; // screen-heights of scrolling per project
const SCRUB = 0.5;           // smoothing, in seconds
// Card positions, relative to the screen centre (x: × width, y: × height)
const OFF = { x: 0.85, y: -0.24 };    // waiting offscreen right
const PEEK = { x: 0.4, y: -0.17 };    // "next up", top right
const ACTIVE = { x: 0, y: -0.02 };    // centre
const EXIT = { x: -0.42, y: 0.12 };   // leaving, bottom left
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

type Props = {
  name: string;
  tagline: string;
  currently: { text: string; linkLabel: string; href: string };
  tools: StackIcon[];
  items: WorkItem[];
};

function Cover({ p, autoPlay }: { p: WorkItem; autoPlay: boolean }) {
  return p.isVideo ? (
    <video src={`${p.cover}#t=0.001`} autoPlay={autoPlay} muted loop playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.cover} alt="" />
  );
}

export default function Hero({ name, tagline, currently, tools, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeRef = useRef(-2);
  const [active, setActive] = useState(-1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const n = items.length;

    // p runs 0 → n. 0 = the intro statement; p = k + 1 = project k centred.
    const render = (p: number) => {
      const el = root.current;
      if (!el) return;
      const W = el.clientWidth;
      const H = el.clientHeight;

      // Intro fades and lifts away during the first half-step.
      const io = 1 - clamp(p / 0.45, 0, 1);
      if (intro.current) {
        intro.current.style.opacity = String(io);
        intro.current.style.transform = `translateY(${-24 * (1 - io)}px)`;
        intro.current.style.visibility = io > 0.01 ? "visible" : "hidden";
      }

      const g = clamp(p / 0.6, 0, 1); // cards fade in as the intro leaves
      cards.current.forEach((card, j) => {
        if (!card) return;
        const u = p - j;
        let pos = OFF;
        let op = 0;
        if (u < -1) { pos = OFF; op = 0; }
        else if (u < 0) { const t = ease(u + 1); pos = lerp(OFF, PEEK, t); op = t; }
        else if (u < 1) { pos = lerp(PEEK, ACTIVE, ease(u)); op = 1; }
        else if (u < 2) { const t = ease(u - 1); pos = lerp(ACTIVE, EXIT, t); op = 1 - t; }
        else { pos = EXIT; op = 0; }
        op *= g;
        card.style.transform = `translate(-50%, -50%) translate3d(${pos.x * W}px, ${pos.y * H}px, 0)`;
        card.style.opacity = String(op);
        card.style.zIndex = String(100 - Math.round(Math.abs(u - 1) * 10));
        card.style.visibility = op > 0.01 ? "visible" : "hidden";
        card.style.pointerEvents = Math.abs(u - 1) < 0.3 ? "auto" : "none";
      });

      const a = p < 0.5 ? -1 : clamp(Math.round(p) - 1, 0, n - 1);
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }
    };

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      const state = { p: 0 };
      render(0);
      gsap.fromTo(
        state,
        { p: 0 },
        {
          p: n,
          ease: "none",
          onUpdate: () => render(state.p),
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${window.innerHeight * SCROLL_PER_STEP * n}`,
            pin: true,
            scrub: SCRUB,
            snap: { snapTo: 1 / n, duration: { min: 0.3, max: 0.8 }, delay: 0.05, ease: "power2.inOut" },
            onRefresh: () => render(state.p),
          },
        },
      );
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); });
    return () => mm.revert();
  }, [items]);

  const introBlock = (
    <div ref={intro} className="work-intro">
      <h1 className="work-title">
        <span className="work-name">{name}.</span> <span className="work-tagline">{tagline}</span>
      </h1>
      <p className="work-currently">
        {currently.text}{" "}
        <a href={currently.href} target="_blank" rel="noreferrer" className="ulink">{currently.linkLabel}</a>
      </p>
      <IconStack icons={tools} />
    </div>
  );

  // Reduced motion: no pinning or travel; the intro, then each project stacked.
  if (reduced) {
    return (
      <section id="top" className="work work-static">
        {introBlock}
        {items.map((p) => (
          <article key={p.slug} className="work-static-item">
            <Link href={`/${p.slug}`} className="work-project-title">{p.title}</Link>
            <Link href={`/${p.slug}`} className="work-card" style={{ aspectRatio: p.aspect }} aria-label={p.title}>
              <Cover p={p} autoPlay={false} />
            </Link>
            <ul className="work-tags">{p.tags.map((t) => <li key={t}>{t}</li>)}</ul>
          </article>
        ))}
      </section>
    );
  }

  const current = active >= 0 ? items[active] : null;

  return (
    <section ref={root} id="top" className="work" aria-label="Selected work">
      {introBlock}

      {items.map((p, i) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          className="work-card"
          style={{ aspectRatio: p.aspect }}
          aria-label={p.title}
          ref={(el) => { cards.current[i] = el; }}
        >
          <Cover p={p} autoPlay />
        </Link>
      ))}

      <div className="work-info" aria-live="polite">
        {current && (
          <Link key={current.slug} href={`/${current.slug}`} className="work-project-title work-fade">
            {current.title}
          </Link>
        )}
      </div>
      {current && (
        <ul key={`tags-${current.slug}`} className="work-tags work-fade">
          {current.tags.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </section>
  );
}
