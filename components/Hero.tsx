"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Bulb, Flower, Sprig, Yarn } from "./Doodles";

export type HeroItem = {
  slug: string;
  title: string;    // short name, shown left
  client: string;   // shown right, muted
  cover: string;
  isVideo: boolean;
};

const SCRUB = 0.6; // smoothing, in seconds

// --d staggers each doodle's pop-in on load.
const d = (n: number) => ({ "--d": `${0.25 + n * 0.12}s` }) as React.CSSProperties;

export default function Hero({ items }: { items: HeroItem[] }) {
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // How far the row has to slide so the last card's right edge lines up with the screen edge.
    const travel = () => Math.max(0, (track.current?.scrollWidth ?? 0) - (viewport.current?.clientWidth ?? 0));

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(track.current, {
        x: () => -travel(),
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: () => `+=${travel()}`, // one pixel of scrolling down = one pixel sideways
          pin: true,
          scrub: SCRUB,
          invalidateOnRefresh: true,
        },
      });
    });
    // Reduced motion: no pinning; the row scrolls sideways natively instead (see CSS).
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="top" className="hs">
      <h1 className="hs-title">
        I <span className="doodle inline" style={d(0)}><Flower /></span> transform confusion{" "}
        <span className="doodle inline" style={d(1)}><Yarn /></span> into{" "}
        <span className="doodle inline" style={d(2)}><Sprig /></span> clarity{" "}
        <span className="doodle inline" style={d(3)}><Bulb /></span>
      </h1>

      <div ref={viewport} id="projects" className="hs-viewport">
        <div ref={track} className="hs-track">
          {items.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="hs-card">
              <div className="hs-media">
                {p.isVideo ? (
                  <video src={`${p.cover}#t=0.001`} autoPlay muted loop playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" />
                )}
              </div>
              <p className="hs-caption">
                <span className="ulink">{p.title}</span>
                <span className="hs-client">{p.client}</span>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
