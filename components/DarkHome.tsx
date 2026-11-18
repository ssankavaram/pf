"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, STAGGER, scrollToY } from "@/lib/motion";
import { LENS, makeLens } from "@/lib/lens";
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
const INTRO_SCROLL = 0.6;     // screen-heights of scrolling to clear the nav + intro and bring the cards to centre
const SCROLL_PER_CARD = 0.8;  // screen-heights of scrolling to move one card
const CARD_RATIO = 616 / 437; // design card (Figma)
const FRAME = 12;             // frame margin around the glass when focused/hovered (px at design size)
const CARD_Y = 0.78;          // card centre at the start (under the intro, bottom may be cut off), × section height
const CARD_Y_FOCUS = 0.42;    // card centre once the intro has cleared (room for the caption below)
const FOCUS_GROW = 1.04;      // cards grow a little as they take focus…
const IMMERSE_GROW = 1.04;    // …and keep growing gently through the carousel
const GAP = 0.05;             // space between cards, × screen width
const BG = "#2a2929";         // section background (must match --paper)
const GLASS_BG = "#1a1a1a";   // behind the glass strips
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * One card. Fractal glass (Figma recipe: 31 strips, each a 10% slice of the image stepping 3% across,
 * over a frame 141.5% × 140.6% of the glass, centred) fills the card; `frame` (0–1) eases in the
 * #373636 margin, stroke and smaller inner radius used for the focused / hovered card.
 */
function drawCard(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, frame: number) {
  const k = w / 616;
  if (frame > 0.01) {
    ctx.save();
    ctx.globalAlpha = frame;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fillStyle = "#373636";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  const inset = FRAME * k * frame;
  const ix = x + inset, iy = y + inset, iw = w - inset * 2, ih = h - inset * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ix, iy, iw, ih, 12 - 4 * frame);
  ctx.clip();
  ctx.fillStyle = GLASS_BG;
  ctx.fillRect(ix, iy, iw, ih);
  if (img.complete && img.naturalWidth) {
    const F = iw * 1.4152, fx = ix - iw * 0.2076, sw = F / 31, fh = ih * 1.4063;
    const IW = img.naturalWidth, IH = img.naturalHeight;
    for (let i = 0; i < 31; i++) ctx.drawImage(img, 0.03 * i * IW, 0, 0.1 * IW, IH, fx + i * sw, iy, sw + 0.6, fh);
  }
  ctx.restore();
}

type Props = {
  name: string;
  bio: string;
  currently: { text: string; linkLabel: string; href: string };
  nav: { label: string; href: string }[];
  items: HomeItem[];
};

export default function DarkHome({ name, bio, currently, nav, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const trigger = useRef<ScrollTrigger | null>(null);
  const hover = useRef({ idx: -1, t: 0 });
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const n = items.length;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      const el = root.current;
      const out = canvas.current;
      if (!el || !out) return;
      const src = document.createElement("canvas"); // cards drawn here, then bent by the lens
      let lens: ReturnType<typeof makeLens> = null;
      try { lens = makeLens(out, { bg: BG, haze: "#3a3939" }); } catch { lens = null; }
      const drawCtx = lens ? src.getContext("2d")! : out.getContext("2d")!; // no WebGL: draw flat
      const target = lens ? src : out;

      const img = new Image();
      img.src = "/home/card-glass.png";

      let W = 0, H = 0, dpr = 1, cardW = 0, cardH = 0;
      const size = () => {
        W = el.clientWidth;
        H = el.clientHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        out.width = Math.round(W * dpr);
        out.height = Math.round(H * dpr);
        src.width = Math.round(W * (1 + 2 * LENS.overscan) * dpr);
        src.height = Math.round(H * dpr);
        cardW = Math.min(1040, 0.62 * W, 0.6 * H * CARD_RATIO); // big: the focused card fills most of the screen
        if (W < 810) cardW = 0.86 * W;
        cardH = cardW / CARD_RATIO;
      };

      // q runs 0 → n: 0–1 clears the nav + intro, then 1 → n moves the carousel (p = q − 1).
      const state = { q: 0 };
      let leftPin = false; // nav comes back once you've scrolled past the carousel
      const travel = gsap.parseEase(EASE.inOut);
      const frame = () => {
        if (!W) return;
        const introT = travel(clamp(state.q, 0, 1));
        const p = Math.max(0, state.q - 1);
        const progress = n > 1 ? p / (n - 1) : 0;
        const grow = (1 + (FOCUS_GROW - 1) * introT) * (1 + (IMMERSE_GROW - 1) * progress);
        const cw = cardW * grow, chh = cardH * grow;
        const cardY = CARD_Y + (CARD_Y_FOCUS - CARD_Y) * introT;
        const cy = H * cardY;
        const spacing = cw + GAP * W;
        const focus = 0.5;

        // Nav + intro lift away (the nav bar reads --nav-hide)
        if (intro.current) {
          intro.current.style.opacity = String(1 - introT);
          intro.current.style.transform = `translateY(${-60 * introT}px)`;
          intro.current.style.visibility = introT < 0.99 ? "visible" : "hidden";
        }
        const navHide = leftPin ? 0 : introT;
        const html = document.documentElement;
        html.style.setProperty("--nav-hide", navHide.toFixed(3));
        if (navHide > 0.95) html.dataset.navHidden = ""; else delete html.dataset.navHidden;

        const ox = lens ? LENS.overscan * W : 0;
        drawCtx.setTransform(dpr, 0, 0, dpr, ox * dpr, 0);
        drawCtx.fillStyle = BG;
        drawCtx.fillRect(-ox, 0, W + 2 * ox, H);
        items.forEach((_, j) => {
          const x = focus * W + (j - p) * spacing - cw / 2;
          const y = cy - chh / 2;
          const link = links.current[j];
          if (link) {
            link.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            link.style.width = `${cw}px`;
            link.style.height = `${chh}px`;
          }
          // Frame shows on the focused card (once the intro has cleared) and on hover.
          const focused = (1 - clamp(Math.abs(j - p) / 0.35, 0, 1)) * introT;
          const hov = hover.current.idx === j ? hover.current.t : 0;
          const f = Math.max(focused, hov);
          if (j === 0 && widget.current) {
            // Widget sits on the first card's glass while it's centred; fades as the card slides away.
            const inset = FRAME * (cw / 616) * f;
            const box = widget.current;
            box.style.transform = `translate3d(${x + inset}px, ${y + inset}px, 0)`;
            box.style.width = `${cw - inset * 2}px`;
            box.style.height = `${chh - inset * 2}px`;
            box.style.setProperty("--k", ((cw - inset * 2) / 592).toFixed(4));
            const near = clamp(1 - Math.abs(p) * 2.5, 0, 1);
            box.style.opacity = near.toFixed(3);
            box.style.visibility = near > 0.01 ? "visible" : "hidden";
          }
          if (x > W + ox + 40 || x + cw < -ox - 40) return;
          drawCard(drawCtx, img, x, y, cw, chh, f);
        });
        if (lens) lens.draw(target, focus, 1 - cardY, Math.max(LENS.flat, cw * 0.5 / W)); // flat middle, bends toward the screen edges // GL's y runs bottom-up

        const a = clamp(Math.round(p), 0, n - 1);
        if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
        // Name, line and tags under the centred card; fade between cards.
        if (info.current) {
          const settle = 1 - travel(clamp(Math.abs(p - a) / 0.35, 0, 1));
          info.current.style.left = `${focus * W - cw / 2}px`;
          info.current.style.width = `${cw}px`;
          info.current.style.top = `${cy + chh / 2 + 16}px`;
          info.current.style.opacity = settle.toFixed(3);
          info.current.style.visibility = settle > 0.02 ? "visible" : "hidden";
        }
      };

      size();
      const ro = new ResizeObserver(() => { size(); frame(); });
      ro.observe(el);
      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(el);
      const tick = () => { if (visible) frame(); };
      gsap.ticker.add(tick);

      // Scroll: first clear the intro, then move through the cards.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${window.innerHeight * (INTRO_SCROLL + SCROLL_PER_CARD * Math.max(1, n - 1))}`,
          pin: true,
          scrub: SCRUB,
          onLeave: () => { leftPin = true; },
          onEnterBack: () => { leftPin = false; },
        },
      });
      tl.to(state, { q: 1, ease: "none", duration: INTRO_SCROLL });
      if (n > 1) tl.to(state, { q: n, ease: "none", duration: SCROLL_PER_CARD * (n - 1) });
      trigger.current = tl.scrollTrigger ?? null;

      // Entrance
      gsap.from(".dhome-intro > *", { y: 16, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });
      gsap.from(out, { opacity: 0, duration: DUR.slow, ease: EASE.out, delay: 0.25 });

      return () => {
        trigger.current = null;
        gsap.ticker.remove(tick);
        ro.disconnect();
        io.disconnect();
        document.documentElement.style.removeProperty("--nav-hide");
        delete document.documentElement.dataset.navHidden;
      };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); });
    return () => mm.revert();
  }, [items, n]);

  // When a card centres: its line and tags rise in, one after another.
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
    const total = INTRO_SCROLL + SCROLL_PER_CARD * (n - 1);
    scrollToY(st.start + ((INTRO_SCROLL + k * SCROLL_PER_CARD) / total) * (st.end - st.start));
  };
  // A side card click brings it into focus; the centred card opens the case study.
  const onCardClick = (k: number) => (e: React.MouseEvent) => {
    if (k === active) return;
    e.preventDefault();
    goTo(k);
  };
  // Hover eases the frame in around the glass.
  const hoverIn = (i: number) => { hover.current.idx = i; gsap.to(hover.current, { t: 1, duration: DUR.base, ease: EASE.out, overwrite: true }); };
  const hoverOut = () => { gsap.to(hover.current, { t: 0, duration: DUR.base, ease: EASE.out, overwrite: true }); };

  const introBlock = (
    <div ref={intro} className="dhome-intro">
      <h1 className="dhome-name">{name}</h1>
      <p className="dhome-bio">
        {bio} {currently.text}{" "}
        <a href={currently.href} target="_blank" rel="noreferrer" className="ulink">{currently.linkLabel}</a>
      </p>
      <ContactIcons nav={nav} />
    </div>
  );
  const caption = (p: HomeItem) => (
    <div key={p.slug}>
      <p className="dhome-line"><span>{p.short}.</span> <span className="is-muted">{p.line}</span></p>
      <ul className="dhome-tags">{p.tags.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );

  // Reduced motion: a plain row of framed glass cards you scroll sideways.
  if (reduced) {
    return (
      <section id="top" className="dhome is-static" aria-label="Selected work">
        {introBlock}
        <div className="dhome-row">
          {items.map((p, i) => (
            <Link key={p.slug} href={`/${p.slug}`} className="dcard-static" aria-label={`Open ${p.short}`}>
              <div className="dcard">
                <div className="dcard-inner">
                  <Fluted src="/home/card-glass.png" strips={31} className="dcard-fluted" />
                  {i === 0 && <HomeWidget />}
                </div>
              </div>
              {caption(p)}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={root} id="top" className="dhome" aria-label="Selected work">
      <canvas ref={canvas} className="dhome-canvas" aria-hidden />
      {introBlock}
      <div ref={widget} className="dhome-widget" aria-hidden><HomeWidget /></div>
      {/* Real links laid over the drawn cards: clicks, keyboard focus, screen readers, hover */}
      {items.map((p, i) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          className="dhome-hit"
          aria-label={i === active ? `Open ${p.short}` : `Show ${p.short}`}
          ref={(el) => { links.current[i] = el; }}
          onClick={onCardClick(i)}
          onFocus={() => { if (i !== activeRef.current) goTo(i); }}
          onMouseEnter={() => hoverIn(i)}
          onMouseLeave={hoverOut}
        />
      ))}
      <div ref={info} className="dhome-info" aria-live="polite">
        {items[active] && caption(items[active])}
      </div>
    </section>
  );
}
