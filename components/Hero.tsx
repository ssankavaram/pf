"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import IconStack, { type StackIcon } from "./IconStack";
import Scribble from "./Scribble";
import { DUR, EASE, SCRUB, STAGGER, scrollToY } from "@/lib/motion";

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
const TILT = { x: 8, y: 6 }; // max mouse tilt on the centred card, degrees
const WARP = 46;             // how strongly side cards ripple (px of displacement); 0 turns it off
const FLASH_MS = 1600;       // how long the sketch stays after clicking a project into focus (unless hovered)
// Card poses, relative to the screen centre. x/y: × screen width/height, z: px toward (+) or away (−),
// ry/rx: rotation in degrees. The section has CSS perspective, so z and rotation read as real depth.
type Pose = { x: number; y: number; z: number; rx: number; ry: number };
const OFF: Pose = { x: 0.85, y: -0.24, z: -520, rx: 6, ry: -38 };    // waiting offscreen right
const PEEK: Pose = { x: 0.4, y: -0.17, z: -200, rx: 4, ry: -24 };    // "next up", top right, turned toward centre
const ACTIVE: Pose = { x: 0, y: -0.02, z: 0, rx: 0, ry: 0 };          // centre, facing you
const EXIT: Pose = { x: -0.42, y: 0.12, z: -320, rx: -6, ry: 30 };   // leaving bottom left, turning away
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const travel = gsap.parseEase(EASE.inOut); // same curve GSAP uses everywhere else
const mix = (a: Pose, b: Pose, t: number): Pose => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
  rx: a.rx + (b.rx - a.rx) * t, ry: a.ry + (b.ry - a.ry) * t,
});

type Props = {
  name: string;
  tagline: string;
  currently: { text: string; linkLabel: string; href: string };
  tools: StackIcon[];
  items: WorkItem[];
};

function Cover({ p, autoPlay }: { p: WorkItem; autoPlay: boolean }) {
  return (
    <div className="work-tilt">
      {p.isVideo ? (
        <video src={`${p.cover}#t=0.001`} autoPlay={autoPlay} muted loop playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.cover} alt="" />
      )}
    </div>
  );
}

export default function Hero({ name, tagline, currently, tools, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const sketch = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const below = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const warps = useRef<(SVGFEDisplacementMapElement | null)[]>([]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(-2);
  const [active, setActive] = useState(-1);
  const [hovered, setHovered] = useState(-1); // card under the mouse
  const [flash, setFlash] = useState(-1);     // card just clicked into focus
  const [size, setSize] = useState({ w: 0, h: 0 }); // active card's size, for the sketch
  const [reduced, setReduced] = useState(false);
  const n = items.length;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // p runs 0 → n. 0 = the intro statement; p = k + 1 = project k centred.
    const render = (p: number) => {
      const el = root.current;
      if (!el) return;
      const W = el.clientWidth;
      const H = el.clientHeight;

      // Intro fades and lifts away during the first half-step.
      const io = 1 - travel(clamp(p / 0.5, 0, 1));
      if (intro.current) {
        intro.current.style.opacity = String(io);
        intro.current.style.transform = `translateY(${-32 * (1 - io)}px)`;
        intro.current.style.visibility = io > 0.01 ? "visible" : "hidden";
      }

      const g = clamp(p / 0.6, 0, 1); // cards fade in as the intro leaves
      cards.current.forEach((card, j) => {
        if (!card) return;
        const u = p - j;
        let pose = OFF;
        let op = 0;
        if (u < -1) { pose = OFF; op = 0; }
        else if (u < 0) { const t = travel(u + 1); pose = mix(OFF, PEEK, t); op = t; }
        else if (u < 1) { pose = mix(PEEK, ACTIVE, travel(u)); op = 1; }
        else if (u < 2) { const t = travel(u - 1); pose = mix(ACTIVE, EXIT, t); op = 1 - t; }
        else { pose = EXIT; op = 0; }
        op *= g;
        card.style.transform =
          `translate(-50%, -50%) translate3d(${pose.x * W}px, ${pose.y * H}px, ${pose.z}px) rotateY(${pose.ry}deg) rotateX(${pose.rx}deg)`;
        card.style.opacity = String(op);
        card.style.zIndex = String(100 - Math.round(Math.abs(u - 1) * 10));
        card.style.visibility = op > 0.01 ? "visible" : "hidden";
        card.style.pointerEvents = op > 0.3 ? "auto" : "none"; // neighbours are clickable too
        card.classList.toggle("is-active", Math.abs(u - 1) < 0.15);

        // Warp grows with distance from the centre; switched off entirely when centred (cheaper, crisp).
        const w = WARP * travel(clamp(Math.abs(u - 1), 0, 1));
        warps.current[j]?.setAttribute("scale", w.toFixed(1));
        const tilt = card.firstElementChild as HTMLElement | null;
        if (tilt) tilt.style.filter = w > 0.5 ? `url(#warp-${j})` : "none";
      });

      const a = p < 0.5 ? -1 : clamp(Math.round(p) - 1, 0, n - 1);
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }

      // Sketch, title and tags are fully there when a project sits in the centre, and ease out between.
      const settle = a >= 0 ? 1 - travel(clamp(Math.abs(p - (a + 1)) / 0.35, 0, 1)) : 0;
      if (sketch.current) {
        sketch.current.style.opacity = String(settle);
        sketch.current.style.transform = `translate(-50%, -50%) translate3d(0, ${ACTIVE.y * H}px, 0)`;
      }
      const shown = a >= 0 ? 0.35 + 0.65 * settle : 0;
      if (info.current) info.current.style.opacity = String(shown);
      if (below.current) below.current.style.opacity = String(a >= 0 ? 1 : 0);
    };

    // Centred card leans toward the mouse (CSS reads --tx / --ty and eases the change).
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tx", `${(nx * 2 * TILT.x).toFixed(2)}deg`);
      el.style.setProperty("--ty", `${(-ny * 2 * TILT.y).toFixed(2)}deg`);
    };
    const onLeave = () => {
      root.current?.style.setProperty("--tx", "0deg");
      root.current?.style.setProperty("--ty", "0deg");
    };

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      const state = { p: 0 };
      render(0);
      const tween = gsap.fromTo(
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
            onRefresh: () => render(state.p),
          },
        },
      );
      trigger.current = tween.scrollTrigger ?? null;

      // Entrance: intro lines rise in one after another.
      const parts = intro.current ? Array.from(intro.current.children) : [];
      gsap.from(parts, { y: 18, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });

      const el = root.current;
      if (fine && el) {
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
      }
      return () => {
        trigger.current = null;
        el?.removeEventListener("pointermove", onMove);
        el?.removeEventListener("pointerleave", onLeave);
      };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); });
    return () => mm.revert();
  }, [items, n]);

  // When the centred project changes: title and tags rise in, tags one after another.
  useEffect(() => {
    if (active < 0 || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".work-project-title", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.out });
      gsap.fromTo(".work-tags li", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.out, stagger: STAGGER });
    }, root);
    return () => ctx.revert();
  }, [active, reduced]);

  // Measure the active card so the sketch fits around it (and again on resize).
  useEffect(() => {
    const measure = () => {
      const tilt = cards.current[active]?.firstElementChild as HTMLElement | null | undefined;
      if (tilt) setSize({ w: tilt.offsetWidth, h: tilt.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  // Glide to the scroll position where project k sits in the centre.
  const goTo = (k: number, onArrive?: () => void) => {
    const st = trigger.current;
    if (!st) return;
    scrollToY(st.start + ((k + 1) / n) * (st.end - st.start), onArrive);
  };

  // Sketch shows briefly after a project is clicked into focus (stays while hovered).
  const flashSketch = (k: number) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(k);
    flashTimer.current = setTimeout(() => setFlash(-1), FLASH_MS);
  };
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // Clicking a neighbour brings it into focus; clicking the centred card opens the case study.
  const onCardClick = (k: number) => (e: React.MouseEvent) => {
    if (k === active) { flashSketch(k); return; }
    e.preventDefault();
    goTo(k, () => flashSketch(k));
  };
  const sketchOn = active >= 0 && (hovered === active || flash === active);

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
      {/* One ripple filter per card; render() sets each one's strength */}
      <svg className="work-filters" width="0" height="0" aria-hidden>
        <defs>
          {items.map((p, i) => (
            <filter key={p.slug} id={`warp-${i}`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.014" numOctaves={2} seed={i + 3} result="noise" />
              <feDisplacementMap
                ref={(el) => { warps.current[i] = el; }}
                in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"
              />
            </filter>
          ))}
        </defs>
      </svg>

      {introBlock}

      {items.map((p, i) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          className="work-card"
          style={{ aspectRatio: p.aspect }}
          aria-label={i === active ? `Open ${p.title}` : `Show ${p.title}`}
          ref={(el) => { cards.current[i] = el; }}
          onClick={onCardClick(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => { setHovered(-1); setFlash(-1); }}
        >
          <Cover p={p} autoPlay />
        </Link>
      ))}

      <div ref={sketch} className="work-sketch" aria-hidden>
        {current && size.w > 0 && <Scribble key={current.slug} w={size.w} h={size.h} show={sketchOn} />}
      </div>

      <div ref={info} className="work-info" aria-live="polite">
        {current && (
          <Link key={current.slug} href={`/${current.slug}`} className="work-project-title">
            {current.title}
          </Link>
        )}
      </div>

      <div ref={below} className="work-below">
        {current && (
          <ul key={`tags-${current.slug}`} className="work-tags">
            {current.tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
        <div className="work-dots" role="group" aria-label="Projects">
          {items.map((p, k) => (
            <button
              key={p.slug}
              className={`work-dot${k === active ? " on" : ""}`}
              aria-label={`Show ${p.title}`}
              aria-current={k === active ? "true" : undefined}
              onClick={() => goTo(k)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
