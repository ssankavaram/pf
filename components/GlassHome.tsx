"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, STAGGER, scrollToY } from "@/lib/motion";
import VolatilityDemo from "./VolatilityDemo";

export type GlassItem = {
  slug: string;
  title: string;
  cover: string;
  isVideo: boolean;
  aspect: number; // cover width ÷ height
  short: string;    // short name, card title
  category: string; // pill label
  metric?: string;  // big number on the card, e.g. "47%"
  description: string; // first line of the case study intro, shown under the centred card
  tags: string[];
};

/* ---- Tuning knobs ------------------------------------------------------- */
const INTRO_SCROLL = 0.6;    // screen-heights of scrolling to clear the nav + intro and bring the cards to centre
const SCROLL_PER_CARD = 0.8; // screen-heights of scrolling to move one card
const FOCUS_X = 0.5;         // where the focused card's centre sits, × screen width
const CARD_Y = 0.63;         // card centre at the start, × section height (below the intro)
const CARD_Y_FOCUS = 0.42;   // image centre once the intro has cleared (leaves room for the text below)
const FOCUS_GROW = 1.06;     // cards grow a little as they take focus
const IMMERSE_GROW = 1.08;   // …and keep growing gently as you scroll through the carousel
const GAP = 0.05;            // space between cards, × screen width
const CARD_RATIO = 2172 / 1150; // wide image, like the reference card
// The lens: a curved pane of glass fixed to the screen. Cards are flat in the middle and bend as they
// slide under its edges.
const LENS = {
  bend: 0.55,     // how much taller things get at the edges (vertical magnify)
  squeeze: 0.04,  // how much they compress sideways at the edges
  flatPad: 0.02,  // extra flat zone beyond the focused card's own edges (× screen width)
  span: 0.42,     // how wide the bending zone is (× screen width)
  aberr: 0.22,    // rainbow: how far red and blue split apart at the edges
  blur: 0.0045,   // softening at the edges
  haze: 0.35,     // milky glow at the far edges
  overscan: 0.18, // cards are drawn this far past each screen edge (× width) so the lens always has content to bend in
};
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tex;
uniform float cx, cy, r0, span, bend, squeeze, aberr, blur, haze, over;
uniform vec3 bg, hazeCol;
// Where to read from, for a given screen point: farther out sideways, closer to the middle vertically.
vec2 warp(vec2 uv, float k) {
  float dx = uv.x - cx;
  float d = abs(dx);
  float e = smoothstep(r0, r0 + span, d);
  float e2 = e * e;
  float x = cx + sign(dx) * (d + e2 * squeeze * k);
  float y = cy + (uv.y - cy) / (1.0 + bend * k * e2); // bends around the cards' own middle line
  return vec2(x, y);
}
// Screen coords -> source canvas, which is wider than the screen by 'over' on each side.
vec3 samp(vec2 uv) {
  vec2 s = vec2((uv.x + over) / (1.0 + 2.0 * over), uv.y);
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return bg;
  return texture2D(tex, s).rgb;
}
void main() {
  float e = smoothstep(r0, r0 + span, abs(vUv.x - cx));
  float ab = aberr * e * e;          // red/blue bend a bit more/less than green: rainbow fringes
  float bw = blur * e;
  vec3 col = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    vec2 o = vec2(float(i) * bw, 0.0);
    col.r += samp(warp(vUv + o, 1.0 + ab)).r;
    col.g += samp(warp(vUv + o, 1.0)).g;
    col.b += samp(warp(vUv + o, 1.0 - ab)).b;
  }
  col /= 5.0;
  // Milky glow only on the cards, not the empty background (keeps the grey even, no bands).
  float onCard = smoothstep(0.0, 0.05, distance(col, bg));
  col = mix(col, hazeCol, haze * e * e * e * onCard);
  gl_FragColor = vec4(col, 1.0);
}`;

type Props = {
  name: string;
  bio: string;
  currently: { text: string; linkLabel: string; href: string };
  items: GlassItem[];
};

// ---- Canvas drawing --------------------------------------------------------
// Page background per theme (cards are drawn on canvas, so CSS variables can't reach it).
const MODE = { light: { bg: "#f2f2f2" }, dark: { bg: "#0e0f12" } };

// Glass card gradients, one per project (cycled). Each: a base colour, soft colour glows
// (x, y as fractions of the card; r as a fraction of its width), and the colour of the light rim.
type Glow = { x: number; y: number; r: number; c: string; solid?: boolean; sy?: number }; // solid: full-strength colour instead of added light; sy: squash into a wide oval
type Glass = { base: string; glows: Glow[]; rim: string; sheen?: number }; // sheen: light across the top (default 0.14)
export const GLASS: Glass[] = [
  { // "Industry best practices": black top-left, violet-blue from the right, blue band + white fog along the bottom, teal corner
    base: "#05050a", rim: "rgba(200, 210, 255, 0.32)", sheen: 0.02,
    glows: [
      { x: 1.02, y: 0.4, r: 0.42, sy: 0.9, c: "rgba(112, 58, 255, 1)" },
      { x: 0.86, y: 0.58, r: 0.34, sy: 0.8, c: "rgba(64, 80, 255, 0.85)" },
      { x: 0.5, y: 0.86, r: 0.62, sy: 0.42, c: "rgba(40, 78, 245, 1)" },
      { x: 0.5, y: 0.96, r: 0.7, sy: 0.32, c: "rgba(70, 110, 255, 0.95)" },
      { x: 0.6, y: 1.02, r: 0.5, sy: 0.3, c: "rgba(236, 232, 255, 1)" },
      { x: 0.88, y: 0.98, r: 0.26, sy: 0.55, c: "rgba(255, 205, 240, 0.95)" },
      { x: 0.02, y: 0.98, r: 0.24, sy: 0.9, c: "rgba(56, 228, 200, 0.95)" },
      { x: 0.24, y: 1.04, r: 0.26, sy: 0.45, c: "rgba(255, 255, 255, 0.95)" },
    ],
  },
  { // deep electric blue ("Engineering")
    base: "#0b2499", rim: "rgba(180, 205, 255, 0.95)",
    glows: [{ x: 0.42, y: 0.55, r: 0.55, c: "#1f5bff" }, { x: 0.35, y: 0.5, r: 0.28, c: "rgba(90, 170, 255, 0.85)" }],
  },
  { // black with green rising from the bottom
    base: "#050607", rim: "rgba(170, 255, 200, 0.55)",
    glows: [{ x: 0.5, y: 1.05, r: 0.62, c: "#2fe07a" }, { x: 0.5, y: 1.12, r: 0.38, c: "rgba(190, 255, 220, 0.9)" }],
  },
  { // dark, violet-blue wave along the bottom
    base: "#08080f", rim: "rgba(190, 180, 255, 0.5)",
    glows: [{ x: 0.3, y: 1.05, r: 0.55, c: "#5b4bff" }, { x: 0.75, y: 1.05, r: 0.5, c: "#3a7bff" }, { x: 0.5, y: 1.15, r: 0.35, c: "rgba(255, 255, 255, 0.75)" }],
  },
  { // hot pink core on lavender ("Product & Design")
    base: "#9f97e8", rim: "rgba(255, 255, 255, 0.95)",
    glows: [{ x: 0.5, y: 0.38, r: 0.5, c: "rgba(255, 90, 140, 0.85)", solid: true }, { x: 0.5, y: 0.34, r: 0.3, c: "#ff2a4d", solid: true }, { x: 0.5, y: 0.3, r: 0.12, c: "rgba(255, 210, 220, 0.6)" }, { x: 0.5, y: 1.05, r: 0.5, c: "rgba(150, 180, 255, 0.85)" }],
  },
  { // dusk with a violet streak toward the top right ("Lumina")
    base: "#12101a", rim: "rgba(210, 190, 255, 0.45)",
    glows: [{ x: 0.78, y: 0.18, r: 0.42, c: "rgba(167, 120, 255, 0.95)" }, { x: 0.92, y: 0.05, r: 0.2, c: "rgba(255, 255, 255, 0.7)" }, { x: 0.4, y: 0.55, r: 0.4, c: "rgba(80, 60, 160, 0.45)" }],
  },
  { // charcoal with a purple bloom ("Time in bed")
    base: "#16121e", rim: "rgba(220, 190, 255, 0.45)",
    glows: [{ x: 0.42, y: 0.3, r: 0.4, c: "#a855f7" }, { x: 0.55, y: 0.38, r: 0.24, c: "rgba(240, 210, 255, 0.85)" }],
  },
  { // near-black, white-periwinkle fog below, violet at the edge ("Industry best practices")
    base: "#0b0b12", rim: "rgba(220, 225, 255, 0.6)",
    glows: [{ x: 0.5, y: 1.08, r: 0.6, c: "#c7d2fe" }, { x: 1.0, y: 0.45, r: 0.4, c: "rgba(124, 58, 237, 0.85)" }, { x: 0.4, y: 1.15, r: 0.35, c: "rgba(255, 255, 255, 0.9)" }],
  },
  { // navy with a blue glow from below ("Hello Robin")
    base: "#050914", rim: "rgba(150, 190, 255, 0.55)",
    glows: [{ x: 0.5, y: 1.08, r: 0.6, c: "#1d4ed8" }, { x: 0.5, y: 0.35, r: 0.22, c: "rgba(96, 165, 250, 0.55)" }],
  },
  { // lilac-grey dusk ("Sales")
    base: "#1c1b25", rim: "rgba(220, 215, 255, 0.55)",
    glows: [{ x: 0.5, y: -0.1, r: 0.7, c: "rgba(140, 138, 180, 0.9)" }, { x: 0.85, y: 0.2, r: 0.25, c: "rgba(255, 255, 255, 0.35)" }],
  },
];

/**
 * One glass card: dark base, colour glows, a soft light rim inside the edges and a thin bright edge.
 * `glow` (0–1) brightens the rim on hover.
 */
function drawCard(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number, glow: number) {
  const g = GLASS[i % GLASS.length];
  const r = Math.min(w, h) * 0.12;
  const k = w / 720;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();

  ctx.fillStyle = g.base;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "screen"; // glows add light, like light through glass, instead of muddying
  for (const o of g.glows) {
    ctx.globalCompositeOperation = o.solid ? "source-over" : "screen";
    const cx = x + o.x * w, cy = y + o.y * h, rr = o.r * w, sy = o.sy ?? 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, sy); // squash the circle into an oval
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    grad.addColorStop(0, o.c);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - cx, (y - cy) / sy, w, h / sy);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";

  // Light rim: a glow cast inward from just outside the edge (classic inner-shadow trick).
  ctx.beginPath();
  ctx.rect(x - 200, y - 200, w + 400, h + 400);
  ctx.roundRect(x, y, w, h, r);
  ctx.shadowColor = g.rim;
  ctx.shadowBlur = (40 + 24 * glow) * k;
  ctx.fillStyle = "#000";
  ctx.fill("evenodd");
  ctx.fill("evenodd"); // twice: a stronger, lighter edge
  ctx.shadowColor = "transparent";

  // A soft sheen across the top, like light catching glass
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.45);
  sheen.addColorStop(0, `rgba(255, 255, 255, ${(g.sheen ?? 0.14) + 0.08 * glow})`);
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // Thin bright edge
  ctx.beginPath();
  ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + 0.2 * glow})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Same look as CSS, for the reduced-motion fallback. */
export const glassCss = (i: number) => {
  const g = GLASS[i % GLASS.length];
  const glows = g.glows.map((o) => `radial-gradient(circle at ${o.x * 100}% ${o.y * 100}%, ${o.c}, transparent ${o.r * 140}%)`);
  return { background: [...glows, g.base].join(", "), boxShadow: `inset 0 0 40px ${g.rim}, inset 0 0 0 1.5px rgba(255, 255, 255, 0.28)` };
};

// ---- WebGL lens ------------------------------------------------------------
function makeLens(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = { cx: u("cx"), cy: u("cy"), over: u("over"), r0: u("r0"), span: u("span"), bend: u("bend"), squeeze: u("squeeze"), aberr: u("aberr"), blur: u("blur"), haze: u("haze"), bg: u("bg"), hazeCol: u("hazeCol") };
  gl.uniform1f(U.bend, LENS.bend);
  gl.uniform1f(U.squeeze, LENS.squeeze);
  gl.uniform1f(U.span, LENS.span);
  gl.uniform1f(U.aberr, LENS.aberr);
  gl.uniform1f(U.blur, LENS.blur);
  gl.uniform1f(U.haze, LENS.haze);
  gl.uniform1f(U.over, LENS.overscan);

  return {
    setTheme(dark: boolean) {
      const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      gl.uniform3f(U.bg, ...rgb(dark ? MODE.dark.bg : MODE.light.bg));
      gl.uniform3f(U.hazeCol, ...(dark ? rgb("#16171b") : ([1, 1, 1] as [number, number, number]))); // dark: far edges fade into the background
    },
    draw(src: HTMLCanvasElement, cx: number, cy: number, r0: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      gl.uniform1f(U.cx, cx);
      gl.uniform1f(U.cy, cy);
      gl.uniform1f(U.r0, r0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

export default function GlassHome({ name, bio, currently, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const demo = useRef<HTMLDivElement>(null); // product animation over the first card
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const trigger = useRef<ScrollTrigger | null>(null);
  const activeRef = useRef(0);
  const darkRef = useRef(false); // follows <html data-theme>
  const hover = useRef({ t: 0, idx: -1 }); // hover zoom on the centred card
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const n = items.length;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      setReduced(false);
      const el = root.current!;
      const out = canvas.current!;
      const src = document.createElement("canvas"); // cards are drawn here, then bent by the lens
      const ctx2d = src.getContext("2d")!;
      let lens: ReturnType<typeof makeLens> = null;
      try { lens = makeLens(out); } catch { lens = null; }
      // Follow the light/dark toggle (it sets data-theme on <html>).
      const readTheme = () => {
        darkRef.current = document.documentElement.dataset.theme === "dark";
        lens?.setTheme(darkRef.current);
      };
      readTheme();
      const themeWatch = new MutationObserver(readTheme);
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      // No WebGL: draw straight onto the visible canvas, flat.
      const drawCtx = lens ? ctx2d : out.getContext("2d")!;
      const target = lens ? src : out;

      let W = 0, H = 0, dpr = 1, cardW = 0, cardH = 0;
      const size = () => {
        W = el.clientWidth;
        H = el.clientHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        out.width = Math.round(W * dpr);
        out.height = Math.round(H * dpr);
        src.width = Math.round(W * (1 + 2 * LENS.overscan) * dpr);
        src.height = Math.round(H * dpr);
        cardW = Math.min(760, 0.5 * W, 0.42 * H * CARD_RATIO);
        if (W < 810) cardW = 0.86 * W;
        cardH = cardW / CARD_RATIO;
      };

      // q runs 0 → n: 0–1 clears the intro, then 1 → n moves the carousel (p = q − 1).
      const state = { q: 0 };
      let leftPin = false; // nav comes back once you've scrolled past the carousel
      const travel = gsap.parseEase(EASE.inOut);
      const frame = () => {
        if (!W) return;
        const introT = travel(clamp(state.q, 0, 1));
        const p = Math.max(0, state.q - 1);
        const progress = n > 1 ? p / (n - 1) : 0;
        const grow = (1 + (FOCUS_GROW - 1) * introT) * (1 + (IMMERSE_GROW - 1) * progress);
        const cw = cardW * grow;
        const chh = cardH * grow;
        const cardY = CARD_Y + (CARD_Y_FOCUS - CARD_Y) * introT;
        const spacing = cw + GAP * W;

        // Intro lifts away; the nav follows (GlassNav reads --nav-hide).
        if (intro.current) {
          intro.current.style.opacity = String(1 - introT);
          intro.current.style.transform = `translateY(${-60 * introT}px)`;
          intro.current.style.visibility = introT < 0.99 ? "visible" : "hidden";
        }
        const navHide = leftPin ? 0 : introT;
        const html = document.documentElement;
        html.style.setProperty("--nav-hide", navHide.toFixed(3));
        if (navHide > 0.95) html.dataset.navHidden = ""; else delete html.dataset.navHidden;

        const focus = FOCUS_X;
        const ox = lens ? LENS.overscan * W : 0; // shift into the wider source canvas
        drawCtx.setTransform(dpr, 0, 0, dpr, ox * dpr, 0);
        const dark = darkRef.current;
        drawCtx.fillStyle = dark ? MODE.dark.bg : MODE.light.bg;
        drawCtx.fillRect(-ox, 0, W + 2 * ox, H);
        const cy = H * cardY;
        items.forEach((item, j) => {
          const xc = focus * W + (j - p) * spacing;
          const x = xc - cw / 2;
          const y = cy - chh / 2;
          if (j === 0 && demo.current) {
            // Fit the 402 × 619 mockup inside the card, centred; fade it as the card slides off to the side.
            const s = (chh * 0.9) / 619;
            demo.current.style.transform = `translate3d(${x + cw / 2 - 201 * s}px, ${y + chh * 0.05}px, 0) scale(${s})`;
            const near = clamp(1 - Math.abs(p) * 2.5, 0, 1);
            demo.current.style.opacity = near.toFixed(3);
            demo.current.style.visibility = near > 0.01 ? "visible" : "hidden";
          }
          const link = links.current[j];
          if (link) {
            link.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            link.style.width = `${cw}px`;
            link.style.height = `${chh}px`;
          }
          if (x > W + ox + 40 || x + cw < -ox - 40) return;
          drawCard(drawCtx, j, x, y, cw, chh, hover.current.idx === j ? hover.current.t : 0);
        });
        if (lens) lens.draw(target, focus, 1 - cardY, cw / 2 / W + LENS.flatPad); // GL's y runs bottom-up
        const a = clamp(Math.round(p), 0, n - 1);
        if (a !== activeRef.current) { activeRef.current = a; setActive(a); }

        // Name, tags and line under the centred card: there once the intro has cleared and a card has settled.
        if (info.current) {
          const settle = 1 - travel(clamp(Math.abs(p - a) / 0.35, 0, 1));
          const shown = clamp((introT - 0.5) * 2, 0, 1) * settle;
          info.current.style.left = `${focus * W - cw / 2}px`;
          info.current.style.width = `${cw}px`;
          info.current.style.top = `${cy + chh / 2 + 22}px`;
          info.current.style.opacity = shown.toFixed(3);
          info.current.style.visibility = shown > 0.02 ? "visible" : "hidden";
        }
      };

      size();
      const ro = new ResizeObserver(() => { size(); frame(); });
      ro.observe(el);

      // Redraw every frame while the section is on screen (covers are videos).
      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(el);
      const tick = () => { if (visible) frame(); };
      gsap.ticker.add(tick);

      // Scroll: first clear the intro, then move through the cards. Durations = share of the scroll.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${window.innerHeight * (INTRO_SCROLL + SCROLL_PER_CARD * (n - 1))}`,
          pin: true,
          scrub: SCRUB,
          onLeave: () => { leftPin = true; },
          onEnterBack: () => { leftPin = false; },
        },
      });
      tl.to(state, { q: 1, ease: "none", duration: INTRO_SCROLL });
      if (n > 1) tl.to(state, { q: n, ease: "none", duration: SCROLL_PER_CARD * (n - 1) });
      trigger.current = tl.scrollTrigger ?? null;

      // Entrance: intro rises in, the carousel fades up.
      const parts = intro.current ? Array.from(intro.current.children) : [];
      gsap.from(parts, { y: 18, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });
      gsap.from(out, { opacity: 0, duration: DUR.slow, ease: EASE.out, delay: 0.25 });

      return () => {
        trigger.current = null;
        gsap.ticker.remove(tick);
        themeWatch.disconnect();
        document.documentElement.style.removeProperty("--nav-hide");
        delete document.documentElement.dataset.navHidden;
        ro.disconnect();
        io.disconnect();
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

  // When a project centres: its name, tags and line rise in one after another.
  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".ghome-info-name, .ghome-info-tags li, .ghome-info-desc",
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: DUR.base, ease: EASE.out, stagger: STAGGER },
      );
    }, info);
    return () => ctx.revert();
  }, [active, reduced]);

  // Hovering the centred card: its light rim brightens.
  const zoomIn = (i: number) => {
    if (reduced || i !== activeRef.current) return;
    hover.current.idx = i;
    gsap.to(hover.current, { t: 1, duration: DUR.slow, ease: EASE.out, overwrite: true });
  };
  const zoomOut = () => { gsap.to(hover.current, { t: 0, duration: DUR.base, ease: EASE.out, overwrite: true }); };

  // Side card click brings it into focus; the focused card opens the case study.
  const onCardClick = (k: number) => (e: React.MouseEvent) => {
    if (k === active) return;
    e.preventDefault();
    goTo(k);
  };

  const introBlock = (
    <div ref={intro} className="ghome-intro">
      <h1 className="ghome-name">{name}</h1>
      <p className="ghome-bio">{bio}</p>
      <p className="ghome-currently">
        {currently.text}{" "}
        <a href={currently.href} target="_blank" rel="noreferrer" className="ulink">{currently.linkLabel}</a>
      </p>
    </div>
  );

  const details = (p: GlassItem) => (
    <>
      <div className="ghome-info-row">
        <span className="ghome-info-name">{p.short}</span>
        <ul className="ghome-info-tags">{p.tags.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <p className="ghome-info-desc">{p.title}</p>
    </>
  );

  // Reduced motion: a plain, flat row you scroll sideways.
  if (reduced) {
    return (
      <section id="top" className="ghome is-static" aria-label="Selected work">
        {introBlock}
        <div className="ghome-stage">
          {items.map((p, i) => (
            <Link key={p.slug} href={`/${p.slug}`} className="pcard" aria-label={`Open ${p.title}`}>
              <div className="pcard-media" style={glassCss(i)} />
              <div className="ghome-info-inner">{details(p)}</div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  const current = items[active];

  return (
    <section ref={root} id="top" className="ghome" aria-label="Selected work">
      <canvas ref={canvas} className="ghome-canvas" aria-hidden />
      {introBlock}
      {/* Real links laid over the drawn cards: clicks, keyboard focus and screen readers */}
      {items.map((p, i) => (
        <Link
          key={p.slug}
          href={`/${p.slug}`}
          className={`ghome-hit${i === active ? " is-active" : ""}`}
          aria-label={i === active ? `Open ${p.title}` : `Show ${p.title}`}
          ref={(el) => { links.current[i] = el; }}
          onClick={onCardClick(i)}
          onFocus={() => { if (i !== activeRef.current) goTo(i); }}
          onMouseEnter={() => zoomIn(i)}
          onMouseLeave={zoomOut}
        />
      ))}
      <div ref={demo} className="ghome-demo" aria-hidden>
        <VolatilityDemo playing={active === 0} />
      </div>
      <div ref={info} className="ghome-info" aria-live="polite">
        {current && (
          <Link key={current.slug} href={`/${current.slug}`} className="ghome-info-inner">
            {details(current)}
          </Link>
        )}
      </div>
    </section>
  );
}
