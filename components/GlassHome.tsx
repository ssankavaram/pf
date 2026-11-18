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
};

/* ---- Tuning knobs ------------------------------------------------------- */
const SCROLL_PER_CARD = 0.8; // screen-heights of scrolling to move one card
const FOCUS_X = 0.445;       // where the focused card's centre sits, × screen width (lines up with the intro)
const CARD_Y = 0.6;          // card centre, × section height
const GAP = 85 / 1440;       // space between cards, × screen width
const CARD_RATIO = 615 / 370;
// The lens: a curved pane of glass fixed to the screen. Cards are flat in the middle and bend as they
// slide under its edges.
const LENS = {
  bend: 1.25,     // how much taller things get at the edges (vertical magnify)
  squeeze: 0.06,  // how much they compress sideways at the edges
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
  col = mix(col, vec3(1.0), haze * e * e * e);
  gl_FragColor = vec4(col, 1.0);
}`;

type Props = {
  name: string;
  bio: string;
  currently: { text: string; linkLabel: string; href: string };
  items: GlassItem[];
};

// ---- Canvas drawing --------------------------------------------------------
type Media = HTMLImageElement | HTMLVideoElement;
const ready = (m: Media) => (m instanceof HTMLVideoElement ? m.readyState >= 2 && m.videoWidth > 0 : m.complete && m.naturalWidth > 0);
const dims = (m: Media) => (m instanceof HTMLVideoElement ? [m.videoWidth, m.videoHeight] : [m.naturalWidth, m.naturalHeight]);

function drawCover(ctx: CanvasRenderingContext2D, m: Media, x: number, y: number, w: number, h: number) {
  const [sw, sh] = dims(m);
  const s = Math.max(w / sw, h / sh); // object-fit: cover
  const cw = w / s;
  const ch = h / s;
  ctx.drawImage(m, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
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

function drawCard(ctx: CanvasRenderingContext2D, item: GlassItem, media: Media | undefined, tint: string, x: number, y: number, w: number, h: number) {
  const k = w / 615; // scale relative to the Figma card
  const r = 16 * k;

  // Glass body + soft shadow
  ctx.save();
  ctx.shadowColor = "rgba(70, 80, 120, 0.18)";
  ctx.shadowBlur = 40 * k;
  ctx.shadowOffsetY = 18 * k;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = "rgba(250, 250, 251, 0.96)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  // Tinted glows inside the glass
  const g1 = ctx.createRadialGradient(x + w * 0.88, y + h * 0.22, 0, x + w * 0.88, y + h * 0.22, w * 0.62);
  g1.addColorStop(0, `${tint}88`);
  g1.addColorStop(1, `${tint}00`);
  ctx.fillStyle = g1;
  ctx.fillRect(x, y, w, h);
  const g2 = ctx.createRadialGradient(x + w * 0.1, y + h, 0, x + w * 0.1, y + h, w * 0.5);
  g2.addColorStop(0, `${tint}30`);
  g2.addColorStop(1, `${tint}00`);
  ctx.fillStyle = g2;
  ctx.fillRect(x, y, w, h);

  // Cover, peeking up from the bottom right
  if (media && ready(media)) {
    const portrait = item.aspect < 1;
    const ch = portrait ? h * 1.18 : (w * 0.58) / item.aspect;
    const cw = portrait ? ch * item.aspect : w * 0.58;
    const cxp = portrait ? x + w - w * 0.065 - cw : x + w * 1.04 - cw;
    const cyp = portrait ? y + h * 0.3 : y + h * 0.24;
    ctx.save();
    ctx.shadowColor = "rgba(40, 40, 70, 0.28)";
    ctx.shadowBlur = 30 * k;
    ctx.shadowOffsetY = 14 * k;
    ctx.beginPath();
    ctx.roundRect(cxp, cyp, cw, ch, (portrait ? 36 : 14) * k);
    ctx.fillStyle = "#e9e9e9";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cxp, cyp, cw, ch, (portrait ? 36 : 14) * k);
    ctx.clip();
    drawCover(ctx, media, cxp, cyp, cw, ch);
    ctx.restore();
  }

  // Title
  ctx.fillStyle = INK;
  const fs = 16 * k;
  ctx.font = `400 ${fs}px "Open Runde", ui-rounded, -apple-system, sans-serif`;
  ctx.textBaseline = "top";
  const lines = wrap(ctx, item.title, w * 0.4);
  const lh = fs * 1.6;
  let ty = y + h / 2 - (lines.length * lh) / 2;
  for (const l of lines) { ctx.fillText(l, x + w * 0.052, ty + (lh - fs) / 2); ty += lh; }
  ctx.restore();

  // Bright glass edge
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
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

      // Load each cover as an image or a muted looping video.
      const media: Media[] = items.map((p) => {
        if (p.isVideo) {
          const v = document.createElement("video");
          Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: "anonymous", preload: "auto" });
          v.src = p.cover;
          v.play().catch(() => {});
          return v;
        }
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.src = p.cover;
        return im;
      });

      let W = 0, H = 0, dpr = 1, cardW = 0, cardH = 0;
      const size = () => {
        W = el.clientWidth;
        H = el.clientHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        out.width = Math.round(W * dpr);
        out.height = Math.round(H * dpr);
        src.width = Math.round(W * (1 + 2 * LENS.overscan) * dpr);
        src.height = Math.round(H * dpr);
        cardW = Math.min(615, 0.427 * W, 0.41 * window.innerHeight * CARD_RATIO);
        if (W < 810) cardW = 0.84 * W;
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
          drawCard(drawCtx, item, media[j], TINTS[j % TINTS.length], x, y, cardW, cardH);
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
        media.forEach((m) => { if (m instanceof HTMLVideoElement) { m.pause(); m.removeAttribute("src"); m.load(); } });
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
