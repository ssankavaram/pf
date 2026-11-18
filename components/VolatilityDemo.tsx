"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

/**
 * "Big picture → Volatility explained" product moment, rebuilt from the Figma motion timeline
 * (Education NGI, frame 91:389). Transparent background; 402 × 619 design box — scale it from outside.
 * Every keyframe below is the Figma value: times are fractions of the 3.2s loop.
 */

const D = 3.2; // loop length, seconds

type Props = { playing: boolean };

export default function VolatilityDemo({ playing }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    gsap.registerPlugin(CustomEase);
    const ease = CustomEase.create("figmaOut", "0.22,1,0.36,1"); // Figma's easing on every segment
    const q = (s: string) => root.current!.querySelector(s);
    const el = {
      widget: q(".vd-widget"), chat: q(".vd-chat"), content: q(".vd-content"), head: q(".vd-head"),
      text: q(".vd-text"), divider: q(".vd-divider"), s1: q(".vd-stat-1"), s2: q(".vd-stat-2"), s3: q(".vd-stat-3"),
      chart: q(".vd-chart"), ripple: q(".vd-ripple"), cursor: q(".vd-cursor"),
    };

    const t = gsap.timeline({ repeat: -1, paused: true });
    // One keyframe segment: `prop` goes from a → b between loop fractions t0 and t1.
    const seg = (target: Element | null, vars: gsap.TweenVars, t0: number, t1: number) =>
      t.to(target, { ...vars, duration: (t1 - t0) * D, ease, immediateRender: false }, t0 * D);

    // Starting state at the top of every loop
    t.set(el.widget, { opacity: 1, scale: 1, transformOrigin: "50% 50%" }, 0)
      .set(el.chat, { height: 122, opacity: 0, scaleX: 0.880597, y: 37, transformOrigin: "50% 0%" }, 0)
      .set([el.content, el.head, el.text], { opacity: 0, y: 8 }, 0)
      .set(el.divider, { opacity: 0 }, 0)
      .set([el.s1, el.s2, el.s3], { opacity: 0, y: 10 }, 0)
      .set(el.chart, { opacity: 0, y: 14 }, 0)
      .set(el.ripple, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, 0)
      .set(el.cursor, { opacity: 0, scale: 1, x: 165, y: 170, transformOrigin: "5% 3.33%" }, 0);

    // Cursor glides in, presses, then drifts off
    seg(el.cursor, { opacity: 1 }, 0.0688, 0.125);
    seg(el.cursor, { x: 0, y: 0 }, 0.0781, 0.3);
    seg(el.cursor, { scale: 0.85 }, 0.3188, 0.3469);
    seg(el.cursor, { scale: 1 }, 0.3469, 0.3875);
    seg(el.cursor, { x: 22, y: 30 }, 0.4219, 0.5781);
    seg(el.cursor, { opacity: 0 }, 0.5313, 0.6375);
    // Click ripple
    seg(el.ripple, { opacity: 0.7 }, 0.3313, 0.35);
    seg(el.ripple, { opacity: 0 }, 0.35, 0.4625);
    seg(el.ripple, { scale: 1.7 }, 0.3313, 0.4625);
    // Widget presses in, then fades
    seg(el.widget, { scale: 0.982 }, 0.3188, 0.3469);
    seg(el.widget, { scale: 1 }, 0.3469, 0.3969);
    seg(el.widget, { opacity: 0 }, 0.3625, 0.4469);
    // Chat panel grows out of it
    seg(el.chat, { opacity: 1 }, 0.375, 0.4594);
    seg(el.chat, { height: 619, scaleX: 1, y: 0 }, 0.375, 0.6);
    // Content rises in, one piece after another
    seg(el.content, { opacity: 1 }, 0.4313, 0.5563);
    seg(el.content, { y: 0 }, 0.4313, 0.5875);
    seg(el.head, { opacity: 1, y: 0 }, 0.3906, 0.4797);
    seg(el.text, { opacity: 1, y: 0 }, 0.4188, 0.5172);
    seg(el.divider, { opacity: 1 }, 0.4469, 0.5289);
    seg(el.s1, { opacity: 1, y: 0 }, 0.4516, 0.55);
    seg(el.s2, { opacity: 1, y: 0 }, 0.4656, 0.5641);
    seg(el.s3, { opacity: 1, y: 0 }, 0.4797, 0.5781);
    seg(el.chart, { opacity: 1, y: 0 }, 0.4984, 0.6391);
    t.set({}, {}, D); // hold the end until the loop length

    tl.current = t;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) t.progress(0.75).pause(); // calm: show the answer
    return () => { t.kill(); tl.current = null; };
  }, []);

  useEffect(() => {
    const t = tl.current;
    if (!t || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (playing) t.play(); else t.pause();
  }, [playing]);

  return (
    <div ref={root} className="vd" aria-hidden>
      {/* Widget: "Big picture" card + suggestion chips */}
      <div className="vd-widget">
        <div className="vd-card">
          <div className="vd-row">
            <div className="vd-label">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/sparkle-sm.svg" alt="" width={18} height={18.5} />
              <span>Big picture</span>
            </div>
            <span className="vd-close">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/close-a.svg" alt="" width={11.67} height={11.67} />
            </span>
          </div>
          <p className="vd-q">Does a one-year drop matter for a 20-year goal?</p>
        </div>
        <div className="vd-chips">
          <span className="vd-chip is-primary">Save for my advisor</span>
          <span className="vd-chip">What&rsquo;s time horizon?</span>
          <span className="vd-chip">Past recoveries</span>
          <span className="vd-chip is-faint">Lorem ipsum</span>
        </div>
      </div>

      {/* Chat panel: "Volatility explained" */}
      <div className="vd-chat">
        <div className="vd-content">
          <div className="vd-head">
            <div className="vd-label is-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/sparkle.svg" alt="" width={21} height={21.6} />
              <span>Volatility explained</span>
            </div>
            <p className="vd-title">Was this drop NVDA, or the whole market?</p>
          </div>
          <p className="vd-text">
            Mostly NVDA. It fell 22% while the market fell 7%. Beta measures how much a stock moves with the market, and
            NVDA&rsquo;s 1.8 means it moves 80% more. That predicts a 13% drop. The extra 9% was NVDA&rsquo;s own story.
          </p>
          <div className="vd-divider" />
          <div className="vd-stats">
            <div className="vd-stat vd-stat-1"><span>Return</span><b>-22%</b></div>
            <div className="vd-stat vd-stat-2"><span>Volatility</span><b>34%</b></div>
            <div className="vd-stat vd-stat-3"><span>Beta</span><b>1.8</b></div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vd-chart" src="/demo/chart.png" alt="" width={306.65} height={301.4} />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vd-ripple" src="/demo/ripple.svg" alt="" width={28} height={28} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vd-cursor" src="/demo/cursor.svg" alt="" width={21.5} height={31.5} />
    </div>
  );
}
