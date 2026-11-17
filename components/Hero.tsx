"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import IconStack, { type StackIcon } from "./IconStack";
import Scribble from "./Scribble";

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
const TILT = { x: 8, y: 6 }; // max mouse tilt on the centred card, degrees
// Card poses, relative to the screen centre. x/y: × screen width/height, z: px toward (+) or away (−),
// ry/rx: rotation in degrees. The section has CSS perspective, so z and rotation read as real depth.
type Pose = { x: number; y: number; z: number; rx: number; ry: number };
const OFF: Pose = { x: 0.85, y: -0.24, z: -520, rx: 6, ry: -38 };    // waiting offscreen right
const PEEK: Pose = { x: 0.4, y: -0.17, z: -200, rx: 4, ry: -24 };    // "next up", top right, turned toward centre
const ACTIVE: Pose = { x: 0, y: -0.02, z: 0, rx: 0, ry: 0 };          // centre, facing you
const EXIT: Pose = { x: -0.42, y: 0.12, z: -320, rx: -6, ry: 30 };   // leaving bottom left, turning away
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
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
  const activeRef = useRef(-2);
  const [active, setActive] = useState(-1);
  const [size, setSize] = useState({ w: 0, h: 0 }); // active card's size, for the sketch
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
        let pose = OFF;
        let op = 0;
        if (u < -1) { pose = OFF; op = 0; }
        else if (u < 0) { const t = ease(u + 1); pose = mix(OFF, PEEK, t); op = t; }
        else if (u < 1) { pose = mix(PEEK, ACTIVE, ease(u)); op = 1; }
        else if (u < 2) { const t = ease(u - 1); pose = mix(ACTIVE, EXIT, t); op = 1 - t; }
        else { pose = EXIT; op = 0; }
        op *= g;
        card.style.transform =
          `translate(-50%, -50%) translate3d(${pose.x * W}px, ${pose.y * H}px, ${pose.z}px) rotateY(${pose.ry}deg) rotateX(${pose.rx}deg)`;
        card.style.opacity = String(op);
        card.style.zIndex = String(100 - Math.round(Math.abs(u - 1) * 10));
        card.style.visibility = op > 0.01 ? "visible" : "hidden";
        const centred = Math.abs(u - 1) < 0.3;
        card.style.pointerEvents = centred ? "auto" : "none";
        card.classList.toggle("is-active", Math.abs(u - 1) < 0.15);
      });

      const a = p < 0.5 ? -1 : clamp(Math.round(p) - 1, 0, n - 1);
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }

      // Sketch shows only once a project has settled in the centre.
      if (sketch.current) {
        const settle = a >= 0 ? 1 - clamp(Math.abs(p - (a + 1)) / 0.2, 0, 1) : 0;
        sketch.current.style.opacity = String(settle);
        sketch.current.style.transform = `translate(-50%, -50%) translate3d(0, ${ACTIVE.y * H}px, 0)`;
      }
    };

    // Centred card leans toward the mouse (CSS reads --tx / --ty).
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
      const el = root.current;
      if (fine && el) {
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
      }
      return () => {
        el?.removeEventListener("pointermove", onMove);
        el?.removeEventListener("pointerleave", onLeave);
      };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); });
    return () => mm.revert();
  }, [items]);

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

      <div ref={sketch} className="work-sketch" aria-hidden>
        {current && size.w > 0 && <Scribble w={size.w} h={size.h} drawKey={current.slug} />}
      </div>

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
