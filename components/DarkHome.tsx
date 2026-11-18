"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, STAGGER, scrollToY } from "@/lib/motion";
import Fluted from "./Fluted";
import ContactIcons from "./ContactIcons";
import HomeWidget from "./HomeWidget";

export type HomeItem = {
  slug: string;
  short: string; // "Investing education"
  line: string;  // one-liner after the name
  tags: string[];
};

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL_PER_CARD = 0.8; // screen-heights of scrolling to move one card
const CARD_W = 616;          // design card size (Figma)
const CARD_H = 437;
const GAP = 96;              // design gap between cards
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Props = {
  name: string;
  bio: string;
  currently: { text: string; linkLabel: string; href: string };
  nav: { label: string; href: string }[];
  items: HomeItem[];
};

export default function DarkHome({ name, bio, currently, nav, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const n = items.length;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const el = root.current!;
    let W = 0, cw = CARD_W, gap = GAP;

    // Card size follows the screen (never taller than fits under the intro).
    const size = () => {
      W = el.clientWidth;
      cw = Math.min(CARD_W, 0.43 * W, 0.4 * window.innerHeight * (CARD_W / CARD_H));
      if (W < 810) cw = 0.84 * W;
      gap = GAP * (cw / CARD_W);
      el.style.setProperty("--cw", `${cw}px`);
      el.style.setProperty("--k", (cw / CARD_W).toFixed(4));
    };

    // p: which card is centred (fractional while moving).
    const render = (p: number) => {
      if (track.current) track.current.style.transform = `translate3d(${W / 2 - cw / 2 - p * (cw + gap)}px, 0, 0)`;
      const a = clamp(Math.round(p), 0, n - 1);
      if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
      if (info.current) {
        const settle = 1 - clamp(Math.abs(p - a) / 0.35, 0, 1);
        info.current.style.opacity = (0.15 + 0.85 * settle).toFixed(3);
      }
    };

    size();
    const ro = new ResizeObserver(() => { size(); render(state.p); });
    ro.observe(el);
    const state = { p: 0 };

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      render(0);
      const tween = gsap.fromTo(state, { p: 0 }, {
        p: Math.max(0, n - 1),
        ease: "none",
        onUpdate: () => render(state.p),
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${window.innerHeight * SCROLL_PER_CARD * Math.max(1, n - 1)}`,
          pin: true,
          scrub: SCRUB,
          onRefresh: () => { size(); render(state.p); },
        },
      });
      trigger.current = tween.scrollTrigger ?? null;
      // Entrance: intro rises in, then the cards.
      gsap.from(".dhome-intro > *", { y: 16, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });
      gsap.from(".dhome-stage, .dhome-info", { y: 28, opacity: 0, duration: DUR.slow, ease: EASE.out, delay: 0.3 });
      return () => { trigger.current = null; };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); render(0); });
    return () => { mm.revert(); ro.disconnect(); };
  }, [n]);

  // When a card centres: its name line and tags rise in, one after another.
  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".dhome-line, .dhome-tags li", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.out, stagger: STAGGER });
    }, info);
    return () => ctx.revert();
  }, [active, reduced]);

  const goTo = (k: number) => {
    const st = trigger.current;
    if (!st || n < 2) return;
    scrollToY(st.start + (k / (n - 1)) * (st.end - st.start));
  };
  // A side card click brings it into focus; the centred card opens the case study.
  const onCardClick = (k: number) => (e: React.MouseEvent) => {
    if (k === active || reduced) return;
    e.preventDefault();
    goTo(k);
  };

  const current = items[active];

  return (
    <section ref={root} id="top" className={`dhome${reduced ? " is-static" : ""}`} aria-label="Selected work">
      <div className="dhome-intro">
        <h1 className="dhome-name">{name}</h1>
        <p className="dhome-bio">
          {bio} {currently.text}{" "}
          <a href={currently.href} target="_blank" rel="noreferrer" className="ulink">{currently.linkLabel}</a>
        </p>
        <ContactIcons nav={nav} />
      </div>

      <div className="dhome-stage">
        <div ref={track} className="dhome-track">
          {items.map((p, i) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className={`dcard${i === active ? " is-active" : ""}`}
              aria-label={i === active || reduced ? `Open ${p.short}` : `Show ${p.short}`}
              onClick={onCardClick(i)}
              onFocus={() => { if (!reduced && i !== activeRef.current) goTo(i); }}
            >
              <div className="dcard-inner">
                <Fluted src="/home/card-glass.png" strips={31} className="dcard-fluted" />
                {i === 0 && <HomeWidget />}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div ref={info} className="dhome-info" aria-live="polite">
        {current && (
          <div key={current.slug}>
            <p className="dhome-line"><span>{current.short}.</span> <span className="is-muted">{current.line}</span></p>
            <ul className="dhome-tags">{current.tags.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
