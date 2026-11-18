"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, scrollToY } from "@/lib/motion";

export type GlassItem = {
  slug: string;
  title: string;
  cover: string;
  isVideo: boolean;
  aspect: number; // cover width ÷ height
};

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL_PER_CARD = 0.8; // screen-heights of scrolling to move one card
const FOCUS_X = 0.445;       // where the focused card's centre sits, × screen width (lines up with the intro)
const GAP = 0.06;            // space between cards, × screen width
const ANGLE = 34;            // how far side cards turn (deg); outer edges come toward you, like the inside of a cylinder
const DEPTH = 140;           // how far side cards sit back (px)
const SIDE_SCALE = 0.91;     // size of the neighbours relative to the focused card
// Soft glow colour per card (cycled), and the background blobs
const TINTS = ["#5183f5", "#f58bd0", "#7fd9a8", "#a78bfa", "#ffb86b"];
const BLOBS = [
  { c: "#f7a8d8", x: 0.12, y: 0.62, r: 0.32 },
  { c: "#a9c1ff", x: 0.72, y: 0.3, r: 0.36 },
  { c: "#b9f0d4", x: 0.88, y: 0.78, r: 0.26 },
  { c: "#d7c2ff", x: 0.42, y: 0.92, r: 0.3 },
];
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Props = {
  name: string;
  bio: string;
  currently: { text: string; linkLabel: string; href: string };
  items: GlassItem[];
};

function Card({ p, i, autoPlay }: { p: GlassItem; i: number; autoPlay: boolean }) {
  const portrait = p.aspect < 1;
  return (
    <div className="gcard-glass" style={{ "--tint": TINTS[i % TINTS.length] } as React.CSSProperties}>
      <p className="gcard-title">{p.title}</p>
      <div className={`gcard-cover ${portrait ? "is-portrait" : "is-landscape"}`} style={{ aspectRatio: p.aspect }}>
        {p.isVideo ? (
          <video src={`${p.cover}#t=0.001`} autoPlay={autoPlay} muted loop playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt="" />
        )}
      </div>
      <span className="gcard-sheen" aria-hidden />
    </div>
  );
}

export default function GlassHome({ name, bio, currently, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const blobs = useRef<(HTMLDivElement | null)[]>([]);
  const intro = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const n = items.length;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    let cardW = 0;
    const measure = () => { cardW = cards.current[0]?.offsetWidth ?? 0; };

    // p runs 0 → n − 1: which card is in focus (fractional while moving).
    const render = (p: number) => {
      const W = stage.current?.clientWidth ?? 0;
      const spacing = cardW + GAP * W;
      cards.current.forEach((card, j) => {
        if (!card) return;
        const d = j - p; // 0 = focused, + to the right, − to the left
        const ad = Math.abs(d);
        const x = FOCUS_X * W + d * spacing - cardW / 2;
        const ang = -clamp(d, -1.6, 1.6) * ANGLE;
        const z = -Math.min(ad, 2) * DEPTH;
        const s = 1 - Math.min(ad, 1) * (1 - SIDE_SCALE);
        const op = 1 - clamp(ad - 1.6, 0, 1);
        card.style.transform = `translate3d(${x}px, -50%, ${z}px) rotateY(${ang}deg) scale(${s})`;
        card.style.opacity = String(op);
        card.style.zIndex = String(100 - Math.round(ad * 10));
        card.style.visibility = op > 0.01 ? "visible" : "hidden";
        card.style.setProperty("--sheen", `${(50 - clamp(d, -1.5, 1.5) * 45).toFixed(1)}%`); // light sweeps as it turns
        card.classList.toggle("is-active", ad < 0.5);
      });
      // Background glows drift the other way, a little: depth.
      blobs.current.forEach((b, k) => {
        if (b) b.style.transform = `translate3d(${(-p * (18 + k * 10)).toFixed(1)}px, 0, 0)`;
      });
      const a = clamp(Math.round(p), 0, n - 1);
      if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
    };

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      const state = { p: 0 };
      measure();
      render(0);
      const tween = gsap.fromTo(state, { p: 0 }, {
        p: n - 1,
        ease: "none",
        onUpdate: () => render(state.p),
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${window.innerHeight * SCROLL_PER_CARD * (n - 1)}`,
          pin: true,
          scrub: SCRUB,
          onRefresh: () => { measure(); render(state.p); },
        },
      });
      trigger.current = tween.scrollTrigger ?? null;

      // Entrance: intro rises in, cards follow.
      const parts = intro.current ? Array.from(intro.current.children) : [];
      gsap.from(parts, { y: 18, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });
      gsap.from(stage.current, { y: 40, opacity: 0, duration: DUR.slow, ease: EASE.out, delay: 0.3 });

      // Glows float slowly on their own.
      const drift = blobs.current.map((b, k) => b && gsap.to(b.firstElementChild, {
        x: gsap.utils.random(-60, 60), y: gsap.utils.random(-40, 40), scale: gsap.utils.random(0.9, 1.15),
        duration: gsap.utils.random(7, 11), ease: EASE.drift, repeat: -1, yoyo: true, delay: k * 0.6,
      }));
      return () => { trigger.current = null; drift.forEach((t) => t?.kill()); };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); });
    return () => mm.revert();
  }, [n]);

  const goTo = (k: number) => {
    const st = trigger.current;
    if (!st || n < 2) return;
    scrollToY(st.start + (k / (n - 1)) * (st.end - st.start));
  };
  // Side card click brings it into focus; the focused card opens the case study.
  const onCardClick = (k: number) => (e: React.MouseEvent) => {
    if (k === active || reduced) return;
    e.preventDefault();
    goTo(k);
  };

  return (
    <section ref={root} id="top" className={`ghome${reduced ? " is-static" : ""}`} aria-label="Selected work">
      <div className="ghome-blobs" aria-hidden>
        {BLOBS.map((b, k) => (
          <div key={k} ref={(el) => { blobs.current[k] = el; }} className="ghome-blob-wrap">
            <div
              className="ghome-blob"
              style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.r * 100}vw`, height: `${b.r * 100}vw`, background: b.c }}
            />
          </div>
        ))}
      </div>

      <div ref={intro} className="ghome-intro">
        <h1 className="ghome-name">{name}</h1>
        <p className="ghome-bio">{bio}</p>
        <p className="ghome-currently">
          {currently.text}{" "}
          <a href={currently.href} target="_blank" rel="noreferrer" className="ulink">{currently.linkLabel}</a>
        </p>
      </div>

      <div ref={stage} className="ghome-stage">
        {items.map((p, i) => (
          <Link
            key={p.slug}
            href={`/${p.slug}`}
            className="gcard"
            aria-label={i === active || reduced ? `Open ${p.title}` : `Show ${p.title}`}
            ref={(el) => { cards.current[i] = el; }}
            onClick={onCardClick(i)}
            onFocus={() => { if (!reduced && i !== activeRef.current) goTo(i); }}
          >
            <Card p={p} i={i} autoPlay={!reduced} />
          </Link>
        ))}
      </div>
    </section>
  );
}
