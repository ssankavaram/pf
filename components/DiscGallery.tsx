"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type DiscItem = {
  slug: string;
  title: string;
  meta: string;
  cover: string;
  isVideo: boolean;
};

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL_PER_DISC = 0.9; // screen-heights of scrolling per disc
const PEEK = 0.25;           // how much of the next disc peeks in from the right (0–1 of its width)
const STACK_GAP = 0.42;      // how far each settled disc slides left (× disc width)
const STACK_SHRINK = 0.14;   // how much each settled disc shrinks as it recedes
const ARC = 0.08;            // how high a disc lifts while rolling in (× disc width)
const SCRUB = 0.5;           // seconds the animation "catches up" to the scrollbar (smoothness)
/* ------------------------------------------------------------------------ */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad = (n: number) => String(n).padStart(2, "0");

function DiscFace({ item }: { item: DiscItem }) {
  return (
    <>
      <div className="disc-spin">
        {item.isVideo ? (
          <video src={`${item.cover}#t=0.001`} autoPlay muted loop playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt="" />
        )}
      </div>
      <div className="disc-sheen" aria-hidden />
    </>
  );
}

export default function DiscGallery({ items }: { items: DiscItem[] }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const discs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeRef = useRef(-2);
  const [active, setActive] = useState(-1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // CSS smooth scrolling fights ScrollTrigger's snapping, so pause it while the gallery is mounted.
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    const n = items.length;
    let W = 0; // stage width
    let D = 0; // disc diameter

    const measure = () => {
      W = stage.current?.clientWidth ?? 0;
      D = discs.current[0]?.offsetWidth ?? 0;
    };

    // p runs 0 → n. Disc j rolls in from the right while p goes j → j+1, then recedes left as later discs arrive.
    const render = (p: number) => {
      const peekX = W / 2 + D * (0.5 - PEEK);
      discs.current.forEach((el, j) => {
        if (!el) return;
        const u = p - j;
        let x: number;
        let y = 0;
        let scale = 1;
        let opacity = 1;

        if (u < 0) {
          // waiting offscreen; the next one fades in at the peek position
          x = peekX - u * D;
          opacity = clamp(1 + u, 0, 1);
        } else if (u < 1) {
          // rolling in to centre
          const e = easeInOut(u);
          x = peekX * (1 - e);
          y = -Math.sin(Math.PI * e) * D * ARC;
        } else {
          // settled, receding into the stack on the left
          const s = u - 1;
          x = -s * D * STACK_GAP;
          y = -s * D * 0.03;
          scale = 1 - STACK_SHRINK * Math.min(s, 3);
          opacity = clamp(3 - s, 0, 1);
        }

        // Rolling: rotation matches distance travelled, so it reads upright when centred.
        const rotation = D ? (x / (Math.PI * D)) * 360 : 0;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.zIndex = String(j + 1);
        el.style.visibility = opacity > 0 ? "visible" : "hidden";
        const spin = el.firstElementChild as HTMLElement | null;
        if (spin) spin.style.transform = `rotate(${rotation}deg)`;
      });

      const a = clamp(Math.round(p) - 1, -1, n - 1);
      if (a !== activeRef.current) {
        activeRef.current = a;
        setActive(a);
      }
    };

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      const state = { p: 0 };
      measure();
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
            end: () => `+=${window.innerHeight * SCROLL_PER_DISC * n}`,
            pin: true,
            scrub: SCRUB,
            snap: { snapTo: 1 / n, duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: "power2.inOut" },
            onRefresh: () => {
              measure();
              render(state.p);
            },
          },
        },
      );
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      setReduced(true);
    });

    return () => {
      mm.revert();
      html.style.scrollBehavior = prevScrollBehavior;
    };
  }, [items]);

  // Reduced motion: a plain grid of discs, no pinning or scroll animation.
  if (reduced) {
    return (
      <section className="wrap discs-static" aria-label="Projects">
        {items.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} className="disc-static">
            <div className="disc">
              <DiscFace item={p} />
            </div>
            <p className="card-title"><span className="ulink">{p.title}</span></p>
            <p className="small">{p.meta}</p>
          </Link>
        ))}
      </section>
    );
  }

  const current = active >= 0 ? items[active] : null;

  return (
    <section ref={root} id="projects" className="discs" aria-label="Projects">
      <div ref={stage} className="discs-stage">
        {items.map((p, i) => (
          <Link
            key={p.slug}
            href={`/${p.slug}`}
            className="disc"
            aria-label={p.title}
            ref={(el) => {
              discs.current[i] = el;
            }}
          >
            <DiscFace item={p} />
          </Link>
        ))}
      </div>

      <p className="discs-count small" aria-hidden>
        {pad(Math.max(active + 1, 0))} / {pad(items.length)}
      </p>

      <div className="discs-caption" aria-live="polite">
        {current ? (
          <div key={current.slug} className="discs-caption-inner">
            <Link href={`/${current.slug}`} className="card-title">
              <span className="ulink">{current.title}</span>
            </Link>
            <p className="small">{current.meta}</p>
          </div>
        ) : (
          <div key="intro" className="discs-caption-inner">
            <p className="card-title">Selected work</p>
            <p className="small">Scroll to roll through</p>
          </div>
        )}
      </div>
    </section>
  );
}
