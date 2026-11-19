"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, scrollToY } from "@/lib/motion";
import { LENS, makeLens } from "@/lib/lens";
import Fluted from "./Fluted";
import ContactIcons from "./ContactIcons";

export type HomeItem = {
  slug: string;
  short: string; // "Investing education"
  line: string;  // one-liner after the name
  cover?: string; // a finished card image (e.g. exported from Figma) instead of the plain glass
  layers?: { bg: string; fg: string; at: number[] }; // the same card in two layers, so the gradient can move and the image can grow
  tags: string[];
};

/* ---- Tuning knobs ------------------------------------------------------- */
const INTRO_SCROLL = 0.6;     // screen-heights of scrolling to clear the nav + intro and bring the cards to centre
const CAPTION_FADE = 0.12;  // captions fade out over this much of the screen width as their card curves away
const SCROLL_PER_CARD = 0.8;  // screen-heights of scrolling to move one card
const CARD_RATIO = 780 / 437; // design cards (Figma node 64:4687)
const DRIFT_ZOOM = 0.06;      // the focused card's gradient zooms in this much so it has room to drift
const DRIFT_BREATHE = 0.025;  // …and gently breathes in and out by this much
const DRIFT_MOVE = 0.025;     // how far it drifts (× card size)
const HOVER_GROW = 1.06;      // the image inside a card grows to this on hover
const HOVER_EASE = 0.12;      // how quickly it grows/shrinks (per frame, 0–1)
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
type Layers = { bg: HTMLImageElement; fg: HTMLImageElement; at: number[] };
const ready = (i?: HTMLImageElement) => !!i && i.complete && i.naturalWidth > 0;

/**
 * One card, drawn edge to edge. With layers: the gradient background drifts slowly while the card is
 * in focus (`focus` 0–1), and the foreground image grows on hover (`hover` 0–1). The dark background
 * uses 'lighten' so it melts into the page and only the gradients show.
 */
function drawCard(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number,
  cover: HTMLImageElement | undefined, layers: Layers | undefined, focus: number, hover: number, t: number) {
  const k = w / 780;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.clip();
  if (layers && ready(layers.bg) && ready(layers.fg)) {
    // Gradient: a slow, gentle drift and breathe (two out-of-step waves so it never looks looped)
    const s = 1 + (DRIFT_ZOOM + DRIFT_BREATHE * Math.sin(t * 0.5)) * focus;
    const dx = Math.sin(t * 0.37) * DRIFT_MOVE * w * focus;
    const dy = Math.cos(t * 0.29) * DRIFT_MOVE * h * focus;
    ctx.globalCompositeOperation = "lighten";
    ctx.drawImage(layers.bg, x + w / 2 - (w * s) / 2 + dx, y + h / 2 - (h * s) / 2 + dy, w * s, h * s);
    ctx.globalCompositeOperation = "source-over";
    // Foreground: grows from its own centre on hover
    const [fx, fy, fw, fh] = layers.at;
    const g = 1 + (HOVER_GROW - 1) * hover;
    const cx = x + (fx + fw / 2) * k, cy = y + (fy + fh / 2) * k;
    ctx.drawImage(layers.fg, cx - (fw * k * g) / 2, cy - (fh * k * g) / 2, fw * k * g, fh * k * g);
  } else if (ready(cover)) {
    ctx.globalCompositeOperation = "lighten";
    ctx.drawImage(cover!, x, y, w, h);
  } else {
    ctx.fillStyle = GLASS_BG;
    ctx.fillRect(x, y, w, h);
    if (ready(img)) ctx.drawImage(img, x - w * 0.2076, y, w * 1.4152, h * 1.4063); // smooth glass
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
  const caps = useRef<(HTMLDivElement | null)[]>([]);
  const hovered = useRef(-1); // card under the pointer
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
      const layers: (Layers | undefined)[] = items.map((p) => {
        if (!p.layers) return undefined;
        const bg = new Image(), fg = new Image();
        bg.src = p.layers.bg;
        fg.src = p.layers.fg;
        return { bg, fg, at: p.layers.at };
      });
      const hoverT = items.map(() => 0); // eased 0–1 per card

      let W = 0, H = 0, dpr = 1, cardW = 0, cardH = 0, introBottom = 300;
      const size = () => {
        W = el.clientWidth;
        H = el.clientHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        out.width = Math.round(W * dpr);
        out.height = Math.round(H * dpr);
        src.width = Math.round(W * (1 + 2 * LENS.overscan) * dpr);
        src.height = Math.round(H * dpr);
        cardW = Math.min(920, 0.55 * W, 0.53 * H * CARD_RATIO); // the focused card, with breathing room around it
        if (W < 810) cardW = 0.82 * W;
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
        const now = performance.now() / 1000;
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
          const f = 1 - clamp(Math.abs(j - p) / 0.6, 0, 1);
          hoverT[j] += ((hovered.current === j ? 1 : 0) - hoverT[j]) * HOVER_EASE;
          drawCard(drawCtx, img, x, y, cw, chh, covers[j], layers[j], f, hoverT[j], now);
        });
        if (lens) lens.draw(target, focus, 1 - cardY, Math.max(LENS.flat, cw * 0.5 / W)); // flat middle, bends toward the screen edges // GL's y runs bottom-up

        const a = clamp(Math.round(p), 0, n - 1);
        if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
        // Every card carries its own caption underneath; it slides with the card and fades out
        // as the card moves into the curved edges of the glass.
        const r0 = Math.max(LENS.flat, cw * 0.5 / W) * W; // half-width of the flat middle (px)
        const fadeZone = W * CAPTION_FADE;
        items.forEach((_, j) => {
          const c = caps.current[j];
          if (!c) return;
          const x = focus * W + (j - p) * spacing - cw / 2;
          const inFlat = Math.min(x - (focus * W - r0), focus * W + r0 - (x + cw)); // how far inside the flat middle
          const o = clamp(1 + inFlat / fadeZone, 0, 1) * introT;
          c.style.transform = `translate3d(${x}px, ${cy + chh / 2 + 16}px, 0)`;
          c.style.width = `${cw}px`;
          c.style.opacity = o.toFixed(3);
          c.style.visibility = o > 0.01 ? "visible" : "hidden";
        });
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
        document.documentElement.style.removeProperty("--col");
        delete document.documentElement.dataset.navHidden;
      };
    });
    mm.add("(prefers-reduced-motion: reduce)", () => { setReduced(true); });
    return () => mm.revert();
  }, [items, n]);

  const goTo = (k: number) => {
    const st = trigger.current;
    if (!st || n < 2) return;
    const total = INTRO_SCROLL + SCROLL_PER_CARD * (n - 1);
    scrollToY(st.start + ((INTRO_SCROLL + k * SCROLL_PER_CARD) / total) * (st.end - st.start));
  };
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  // Left / right arrow keys step through the cards while the carousel is on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const st = trigger.current;
      if (!st || window.scrollY > st.end + 4) return; // past the carousel: leave the keys alone
      const total = INTRO_SCROLL + SCROLL_PER_CARD * Math.max(1, n - 1);
      const introEnd = st.start + (INTRO_SCROLL / total) * (st.end - st.start);
      const before = window.scrollY < introEnd - 4; // still on the intro: → brings the first card in
      const k = before ? (e.key === "ArrowRight" ? 0 : -1) : activeRef.current + (e.key === "ArrowRight" ? 1 : -1);
      if (k < 0 || k > n - 1) return;
      e.preventDefault();
      goToRef.current(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);
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
          onPointerEnter={() => { hovered.current = i; }}
          onPointerLeave={() => { if (hovered.current === i) hovered.current = -1; }}
        />
      ))}
      {items.map((p, i) => (
        <div key={p.slug} ref={(el) => { caps.current[i] = el; }} className="dhome-info" aria-hidden={i !== active}>
          {caption(p)}
        </div>
      ))}
    </section>
  );
}
