"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DUR, EASE, SCRUB, scrollToY } from "@/lib/motion";

export type GlassItem = {
  slug: string;
  title: string;
  cover: string;
  isVideo: boolean;
  aspect: number; // cover width ÷ height
  short: string;    // short name, card title
  category: string; // pill label
  metric?: string;  // big number on the card, e.g. "47%"
};

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL_PER_CARD = 0.8; // screen-heights of scrolling to move one card
const FOCUS_X = 0.5;         // where the focused card's centre sits, × screen width
const CARD_Y = 0.63;         // card centre, × section height
const GAP = 0.09;            // space between cards, × screen width
const CARD_RATIO = 310 / 392; // portrait, like the reference cards
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
const TINTS = ["#5183f5", "#f58bd0", "#7fd9a8", "#a78bfa", "#ffb86b"];
const BG = "#f2f2f2";
const INK = "#241a16";
/* ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tex;
uniform float cx, cy, r0, span, bend, squeeze, aberr, blur, haze, over;
uniform vec3 bg;
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
  col = mix(col, vec3(1.0), haze * e * e * e * onCard);
  gl_FragColor = vec4(col, 1.0);
}`;

type Props = {
  name: string;
  bio: string;
  currently: { text: string; linkLabel: string; href: string };
  items: GlassItem[];
};

// ---- Canvas drawing --------------------------------------------------------
// Card looks, cycled per project: soft mesh gradients like the reference video.
type Stop = [number, string];
type Layer = { kind: "radial"; x: number; y: number; r: number; stops: Stop[] } | { kind: "linear"; x0: number; y0: number; x1: number; y1: number; stops: Stop[] };
type Theme = { base: string; layers: Layer[]; ink: string; number: string; chart: boolean };
const THEMES: Theme[] = [
  { // teal core, green, peach edges
    base: "#f5d3c4", ink: "#2b2b30", number: "#ffffff", chart: true,
    layers: [{ kind: "radial", x: 0.5, y: 0.5, r: 0.75, stops: [[0, "#12b3a6"], [0.32, "#6fd0a4"], [0.62, "#c6e3a6"], [0.85, "#f4cdb8"], [1, "#f5d3c4"]] }],
  },
  { // magenta top fading to white
    base: "#f6f4f8", ink: "#2b2b30", number: "#ffffff", chart: true,
    layers: [
      { kind: "linear", x0: 0.5, y0: 0, x1: 0.5, y1: 0.75, stops: [[0, "#b46af5"], [0.35, "#ec86dc"], [0.7, "#f6eef7"], [1, "#f6f4f8"]] },
      { kind: "radial", x: 0.5, y: 0.22, r: 0.45, stops: [[0, "rgba(120, 90, 255, 0.55)"], [1, "rgba(120, 90, 255, 0)"]] },
    ],
  },
  { // white with a pink-and-blue blob
    base: "#f6f6f8", ink: "#2b2b30", number: "#ffffff", chart: false,
    layers: [{ kind: "radial", x: 0.5, y: 0.42, r: 0.36, stops: [[0, "#2f63f4"], [0.38, "#6f8ff8"], [0.62, "#f39ac4"], [0.82, "rgba(247, 186, 214, 0.35)"], [1, "rgba(246, 246, 248, 0)"]] }],
  },
  { // violet-blue core
    base: "#efe8fb", ink: "#2b2b30", number: "#ffffff", chart: true,
    layers: [{ kind: "radial", x: 0.5, y: 0.48, r: 0.72, stops: [[0, "#2f45f2"], [0.38, "#6b5cf5"], [0.68, "#d48bef"], [1, "#efe8fb"]] }],
  },
  { // sky: violet to blue to mist
    base: "#e4ebfa", ink: "#2b2b30", number: "#ffffff", chart: true,
    layers: [
      { kind: "linear", x0: 0.1, y0: 0, x1: 0.9, y1: 1, stops: [[0, "#8b7cf6"], [0.4, "#5a8ef7"], [1, "#d8e3fb"]] },
      { kind: "radial", x: 0.85, y: 0.15, r: 0.5, stops: [[0, "rgba(255, 255, 255, 0.55)"], [1, "rgba(255, 255, 255, 0)"]] },
    ],
  },
];

function fillLayer(ctx: CanvasRenderingContext2D, L: Layer, x: number, y: number, w: number, h: number) {
  const g = L.kind === "radial"
    ? ctx.createRadialGradient(x + L.x * w, y + L.y * h, 0, x + L.x * w, y + L.y * h, L.r * Math.max(w, h))
    : ctx.createLinearGradient(x + L.x0 * w, y + L.y0 * h, x + L.x1 * w, y + L.y1 * h);
  for (const [o, c] of L.stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const font = (size: number, weight = 400) => `${weight} ${size}px "Open Runde", ui-rounded, -apple-system, sans-serif`;

function drawCard(ctx: CanvasRenderingContext2D, item: GlassItem, i: number, x: number, y: number, w: number, h: number) {
  const t = THEMES[i % THEMES.length];
  const k = w / 310; // scale relative to the reference card
  const r = 14 * k;

  // Card body + soft shadow
  ctx.save();
  ctx.shadowColor = "rgba(60, 70, 110, 0.14)";
  ctx.shadowBlur = 36 * k;
  ctx.shadowOffsetY = 16 * k;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = t.base;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  for (const L of t.layers) fillLayer(ctx, L, x, y, w, h);

  // Title, top left
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = t.ink;
  ctx.font = font(13 * k);
  ctx.textAlign = "left";
  ctx.fillText(item.short, x + 16 * k, y + 26 * k);

  // Pill, top right ("Category ⌄")
  ctx.font = font(10.5 * k);
  const label = item.category;
  const pw = ctx.measureText(label).width + 30 * k;
  const ph = 22 * k;
  const px = x + w - 14 * k - pw;
  const py = y + 12 * k;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, ph / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.fill();
  ctx.fillStyle = t.ink;
  ctx.fillText(label, px + 10 * k, py + 14.5 * k);
  ctx.beginPath(); // chevron
  ctx.moveTo(px + pw - 16 * k, py + 9.5 * k);
  ctx.lineTo(px + pw - 13 * k, py + 12.5 * k);
  ctx.lineTo(px + pw - 10 * k, py + 9.5 * k);
  ctx.strokeStyle = t.ink;
  ctx.lineWidth = 1.1 * k;
  ctx.stroke();

  // Big number (or the project name) + small label
  const big = item.metric ?? item.short;
  ctx.textAlign = "center";
  ctx.fillStyle = t.number;
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
  ctx.shadowBlur = 12 * k;
  const bigSize = (item.metric ? 40 : 26) * k;
  ctx.font = font(bigSize);
  const cx = x + w / 2 + (t.chart ? 12 * k : 0);
  const ny = y + h * (t.chart ? 0.3 : 0.42);
  ctx.fillText(big, cx, ny);
  ctx.shadowBlur = 0;
  ctx.font = font(10 * k);
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(item.metric ? "in testing" : item.category.toLowerCase(), cx, ny + 16 * k);

  // Little line chart with a marker
  if (t.chart) {
    const pts = [0, 0.02, 0.0, -0.05, -0.02, 0.18, 0.32, 0.36, 0.5, 0.48, 0.42, 0.3, 0.26];
    const cy0 = y + h * 0.58;
    ctx.beginPath();
    pts.forEach((v, j) => {
      const px2 = x + (j / (pts.length - 1)) * w;
      const py2 = cy0 - v * h * 0.32;
      if (j === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
    });
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.6 * k;
    ctx.lineJoin = "round";
    ctx.stroke();
    const mx = x + (8 / (pts.length - 1)) * w;
    const my = cy0 - pts[8] * h * 0.32;
    ctx.beginPath();
    ctx.arc(mx, my, 4.5 * k, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx, y + h * 0.78);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1 * k;
    ctx.stroke();
  }

  // Frosted panel with the project title
  const bx = x + 14 * k;
  const bw = w - 28 * k;
  const bh = h * 0.2;
  const by = y + h - bh - 28 * k;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 12 * k);
  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = t.ink;
  ctx.font = font(10.5 * k);
  const all = wrap(ctx, item.title, bw - 32 * k);
  const lines = all.slice(0, 2);
  if (all.length > 2) { // end the second line with an ellipsis that fits
    let l = lines[1];
    while (l && ctx.measureText(`${l}…`).width > bw - 32 * k) l = l.slice(0, -1);
    lines[1] = `${l.trimEnd()}…`;
  }
  const lh = 14 * k;
  let ty = by + bh / 2 - ((lines.length - 1) * lh) / 2 + 3.5 * k;
  for (const l of lines) { ctx.fillText(l, x + w / 2, ty); ty += lh; }

  // Page indicator
  const dotsY = y + h - 12 * k;
  for (let d = 0; d < 5; d++) {
    const on = d === 3;
    ctx.fillStyle = on ? "rgba(30, 30, 35, 0.75)" : "rgba(30, 30, 35, 0.16)";
    ctx.fillRect(x + w / 2 - 40 * k + d * 17 * k, dotsY, (on ? 16 : 12) * k, 1.6 * k);
  }
  ctx.restore();

  // Bright glass edge
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

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
  const U = { cx: u("cx"), cy: u("cy"), over: u("over"), r0: u("r0"), span: u("span"), bend: u("bend"), squeeze: u("squeeze"), aberr: u("aberr"), blur: u("blur"), haze: u("haze"), bg: u("bg") };
  gl.uniform1f(U.bend, LENS.bend);
  gl.uniform1f(U.squeeze, LENS.squeeze);
  gl.uniform1f(U.span, LENS.span);
  gl.uniform1f(U.aberr, LENS.aberr);
  gl.uniform1f(U.blur, LENS.blur);
  gl.uniform1f(U.haze, LENS.haze);
  gl.uniform1f(U.over, LENS.overscan);
  gl.uniform3f(U.bg, 0xf2 / 255, 0xf2 / 255, 0xf2 / 255);

  return {
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

function StaticCard({ p, i }: { p: GlassItem; i: number }) {
  const portrait = p.aspect < 1;
  return (
    <div className="gcard-glass" style={{ "--tint": TINTS[i % TINTS.length] } as React.CSSProperties}>
      <p className="gcard-title">{p.title}</p>
      <div className={`gcard-cover ${portrait ? "is-portrait" : "is-landscape"}`} style={{ aspectRatio: p.aspect }}>
        {p.isVideo ? <video src={`${p.cover}#t=0.001`} muted playsInline preload="metadata" /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover} alt="" />
        )}
      </div>
    </div>
  );
}

export default function GlassHome({ name, bio, currently, items }: Props) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const intro = useRef<HTMLDivElement>(null);
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
      const el = root.current!;
      const out = canvas.current!;
      const src = document.createElement("canvas"); // cards are drawn here, then bent by the lens
      const ctx2d = src.getContext("2d")!;
      let lens: ReturnType<typeof makeLens> = null;
      try { lens = makeLens(out); } catch { lens = null; }
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
        cardW = Math.min(390, 0.27 * W, 0.49 * H * CARD_RATIO);
        if (W < 810) cardW = Math.min(0.68 * W, 0.5 * H * CARD_RATIO);
        cardH = cardW / CARD_RATIO;
      };

      const state = { p: 0 };
      const frame = () => {
        if (!W) return;
        const p = state.p;
        const spacing = cardW + GAP * W;
        const focus = W < 810 ? 0.5 : FOCUS_X;
        const ox = lens ? LENS.overscan * W : 0; // shift into the wider source canvas
        drawCtx.setTransform(dpr, 0, 0, dpr, ox * dpr, 0);
        drawCtx.fillStyle = BG;
        drawCtx.fillRect(-ox, 0, W + 2 * ox, H);
        const cy = H * CARD_Y;
        items.forEach((item, j) => {
          const xc = focus * W + (j - p) * spacing;
          const x = xc - cardW / 2;
          const y = cy - cardH / 2;
          const link = links.current[j];
          if (link) {
            link.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            link.style.width = `${cardW}px`;
            link.style.height = `${cardH}px`;
          }
          if (x > W + ox + 40 || x + cardW < -ox - 40) return;
          drawCard(drawCtx, item, j, x, y, cardW, cardH);
        });
        if (lens) lens.draw(target, focus, 1 - CARD_Y, cardW / 2 / W + LENS.flatPad); // GL's y runs bottom-up
        const a = clamp(Math.round(p), 0, n - 1);
        if (a !== activeRef.current) { activeRef.current = a; setActive(a); }
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

      const tween = gsap.fromTo(state, { p: 0 }, {
        p: n - 1,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => `+=${window.innerHeight * SCROLL_PER_CARD * (n - 1)}`,
          pin: true,
          scrub: SCRUB,
        },
      });
      trigger.current = tween.scrollTrigger ?? null;

      // Entrance: intro rises in, the carousel fades up.
      const parts = intro.current ? Array.from(intro.current.children) : [];
      gsap.from(parts, { y: 18, opacity: 0, duration: DUR.slow, ease: EASE.out, stagger: 0.08, delay: 0.1 });
      gsap.from(out, { opacity: 0, duration: DUR.slow, ease: EASE.out, delay: 0.25 });

      return () => {
        trigger.current = null;
        gsap.ticker.remove(tick);
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
    scrollToY(st.start + (k / (n - 1)) * (st.end - st.start));
  };
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

  // Reduced motion: a plain, flat row you scroll sideways.
  if (reduced) {
    return (
      <section id="top" className="ghome is-static" aria-label="Selected work">
        {introBlock}
        <div className="ghome-stage">
          {items.map((p, i) => (
            <Link key={p.slug} href={`/${p.slug}`} className="gcard" aria-label={`Open ${p.title}`}>
              <StaticCard p={p} i={i} />
            </Link>
          ))}
        </div>
      </section>
    );
  }

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
        />
      ))}
    </section>
  );
}
