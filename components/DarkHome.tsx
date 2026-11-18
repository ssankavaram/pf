"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, STAGGER, scrollToY } from "@/lib/motion";
import { LENS, makeLens } from "@/lib/lens";
import Fluted from "./Fluted";
import ContactIcons from "./ContactIcons";

export type HomeItem = {
  slug: string;
  short: string; // "Investing education"
  line: string;  // one-liner after the name
  cover?: string; // a finished card image (e.g. exported from Figma) instead of the plain glass
  tags: string[];
};

/* ---- Tuning knobs ------------------------------------------------------- */
const INTRO_SCROLL = 0.6;     // screen-heights of scrolling to clear the nav + intro and bring the cards to centre
const SNAP_LEAN = 0.2;      // scroll this far toward the next card (0–1) and it snaps there
const SNAP_DUR = 0.6;       // how long the snap glide takes (s)
const SCROLL_PER_CARD = 0.8;  // screen-heights of scrolling to move one card
const CARD_RATIO = 780 / 437; // design cards (Figma node 64:4687)
const FRAME = 12;             // frame margin around the glass on the focused card (px at design size)
const CARD_TOP_GAP = 48;      // space between the intro and the card at the start (px; card bottom may be cut off)
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
 * #373636 margin, stroke and smaller inner radius used for the focused card.
 */
function drawCard(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, frame: number, cover?: HTMLImageElement) {
  const k = w / 780;
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
  if (cover) {
    // A finished card design from Figma (exported at 2×). 'lighten' lets its dark background
    // (darker than the page) melt into the page, so only the gradients and UI show.
    ctx.globalCompositeOperation = "lighten";
    if (cover.complete && cover.naturalWidth) ctx.drawImage(cover, ix, iy, iw, ih);
  } else {
    ctx.fillStyle = GLASS_BG;
    ctx.fillRect(ix, iy, iw, ih);
    // Smooth glass gradient (no reeded strips, so no vertical lines)
    if (img.complete && img.naturalWidth) ctx.drawImage(img, ix - iw * 0.2076, iy, iw * 1.4152, ih * 1.4063);
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
  const info = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const trigger = useRef<ScrollTrigger | null>(null);
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
      const covers: (HTMLImageElement | undefined)[] = items.map((p) => {
        if (!p.cover) return undefined;
        const c = new Image();
        c.src = p.cover;
        return c;
      });

      let W = 0, H = 0, dpr = 1, cardW = 0, cardH = 0, introBottom = 300;
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
        if (intro.current) introBottom = intro.current.offsetTop + intro.current.offsetHeight;
        document.documentElement.style.setProperty("--col", `${Math.round(cardW)}px`);
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
        const startY = (introBottom + CARD_TOP_GAP + chh / 2) / H;
        const cardY = startY + (CARD_Y_FOCUS - startY) * introT;
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
          if (x > W + ox + 40 || x + cw < -ox - 40) return;
          drawCard(drawCtx, img, x, y, cw, chh, 0, covers[j]); // no focus frame: the card fills edge to edge
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

      // Snap: when scrolling stops partway between cards, glide to a card (or back to the intro).
      // Leans toward the way you were scrolling, so a small push still moves on to the next card.
      const stops = [0, ...items.map((_, k) => INTRO_SCROLL + k * SCROLL_PER_CARD)];
      const span = INTRO_SCROLL + SCROLL_PER_CARD * Math.max(1, n - 1);
      let lastY = window.scrollY, dir = 0;
      const onScroll = () => { const y = window.scrollY; if (y !== lastY) dir = Math.sign(y - lastY); lastY = y; };
      window.addEventListener("scroll", onScroll, { passive: true });
      const snap = () => {
        const st = trigger.current;
        if (!st) return;
        const y = window.scrollY;
        if (y <= st.start + 2 || y >= st.end - 2) return; // outside the carousel
        const pos = ((y - st.start) / (st.end - st.start)) * span;
        let i = stops.findIndex((s) => s > pos) - 1; // stop just before
        if (i < 0) i = stops.length - 2;
        const a = stops[i], b = stops[i + 1];
        const t = (pos - a) / (b - a);
        const target = dir > 0 ? (t > SNAP_LEAN ? b : a) : dir < 0 ? (t < 1 - SNAP_LEAN ? a : b) : (t < 0.5 ? a : b);
        const ty = st.start + (target / span) * (st.end - st.start);
        if (Math.abs(ty - y) > 2) scrollToY(ty, undefined, SNAP_DUR);
      };
      ScrollTrigger.addEventListener("scrollEnd", snap);

      // Entrance
      gsap.from(".dhome-intro > *", { y: 16, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });
      gsap.from(out, { opacity: 0, duration: DUR.slow, ease: EASE.out, delay: 0.25 });

      return () => {
        trigger.current = null;
        ScrollTrigger.removeEventListener("scrollEnd", snap);
        window.removeEventListener("scroll", onScroll);
        gsap.ticker.remove(tick);
        ro.disconnect();
        io.disconnect();
        document.documentElement.style.removeProperty("--nav-hide");
        document.documentElement.style.removeProperty("--col");
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
                  {p.cover
                    ? <img src={p.cover} alt="" className="dcard-cover" />
                    : <Fluted src="/home/card-glass.png" strips={31} className="dcard-fluted" />}
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
      {/* Real links laid over the drawn cards: clicks, keyboard focus, screen readers */}
      {items.map((p, i) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          className="dhome-hit"
          aria-label={i === active ? `Open ${p.short}` : `Show ${p.short}`}
          ref={(el) => { links.current[i] = el; }}
          onClick={onCardClick(i)}
          onFocus={() => { if (i !== activeRef.current) goTo(i); }}
        />
      ))}
      <div ref={info} className="dhome-info" aria-live="polite">
        {items[active] && caption(items[active])}
      </div>
    </section>
  );
}
