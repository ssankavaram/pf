"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { InertiaPlugin } from "gsap/InertiaPlugin";

// Adapted from Made With GSAP free effect 001: icons get flicked in the direction
// your mouse is moving, tilt, then spring back into place.

/* ---- Tuning knobs ------------------------------------------------------- */
const FLING = 30;  // how hard a swipe knocks an icon (higher = further)
const TILT = 30;   // max tilt in degrees (random between -TILT/2 and TILT/2)
const SPEED = 1.2; // playback speed of the whole bounce
/* ------------------------------------------------------------------------ */

const ICONS = Array.from({ length: 12 }, (_, i) => `/about/${String(i + 1).padStart(2, "0")}.png`);

type Props = {
  title: string;
  bio: string;
};

export default function About({ title, bio }: Props) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(InertiaPlugin);

    // Track how far the mouse moved since the last event.
    let oldX = 0;
    let oldY = 0;
    let dx = 0;
    let dy = 0;
    const onMove = (e: MouseEvent) => {
      dx = e.clientX - oldX;
      dy = e.clientY - oldY;
      oldX = e.clientX;
      oldY = e.clientY;
    };
    el.addEventListener("mousemove", onMove);

    const cells = Array.from(el.querySelectorAll<HTMLElement>(".about-icon"));
    const onEnter = (cell: HTMLElement) => () => {
      const img = cell.querySelector("img");
      if (!img) return;
      const tl = gsap.timeline({ onComplete: () => { tl.kill(); } });
      tl.timeScale(SPEED);
      tl.to(img, {
        inertia: {
          x: { velocity: dx * FLING, end: 0 },
          y: { velocity: dy * FLING, end: 0 },
        },
      });
      tl.fromTo(
        img,
        { rotate: 0 },
        { duration: 0.4, rotate: (Math.random() - 0.5) * TILT, yoyo: true, repeat: 1, ease: "power1.inOut" },
        "<",
      );
    };
    const handlers = cells.map((cell) => {
      const h = onEnter(cell);
      cell.addEventListener("mouseenter", h);
      return () => cell.removeEventListener("mouseenter", h);
    });

    return () => {
      el.removeEventListener("mousemove", onMove);
      handlers.forEach((off) => off());
      gsap.killTweensOf(el.querySelectorAll(".about-icon img"));
    };
  }, []);

  return (
    <section ref={root} id="about" className="about">
      <div className="about-panel">
        <h2 className="about-title">{title}</h2>
        <div className="about-body">
          <div className="about-grid">
            {ICONS.map((src) => (
              <div key={src} className="about-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </div>
            ))}
          </div>
          <p className="about-bio">{bio}</p>
        </div>
      </div>
    </section>
  );
}
