"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Fluted from "./Fluted";
import ContactIcons from "./ContactIcons";

/* ---- Tuning knobs ------------------------------------------------------- */
const NODES = 96;     // points across the footer that each glass line follows
const SHIFT = 34;     // how far the lines can sway (px)
const PUSH = 0.05;    // how strongly the cursor pushes the lines it passes
const REACH = 110;    // how wide the cursor's push is (px)
const SPREAD = 0.22;  // how much the sway travels to neighbouring lines (wave)
const SPRING = 0.02;  // pull back to rest
const DAMP = 0.94;    // how quickly the sway settles (closer to 1 = longer)
/* ------------------------------------------------------------------------ */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
// The same fluted glass as the CSS version (strip i shows image x ∈ [0.03i, 0.03i + 0.1]).
// Each pixel reads its sideways offset from a 1-pixel-tall texture (the sway of the lines at that x),
// strongest near the cursor's height so the lines bend rather than slide.
const FRAG = `
precision highp float;
uniform sampler2D tex, sway;
uniform vec2 res;
uniform float stripW, dpr, cursorY;
uniform vec3 bg;
void main() {
  vec2 p = gl_FragCoord.xy / dpr;
  float s = texture2D(sway, vec2(p.x / res.x, 0.5)).r * 2.0 - 1.0;   // -1..1
  float dy = (p.y - cursorY) / res.y;
  float bendW = 0.45 + 0.55 * exp(-dy * dy * 6.0);
  float off = s * bendW * ${SHIFT.toFixed(1)};
  float x = p.x + off;
  float i = floor(x / stripW);
  float local = fract(x / stripW);
  vec2 uv = vec2(0.03 * i + 0.1 * local, 1.0 - p.y / res.y);
  vec4 c = texture2D(tex, clamp(uv, 0.0, 1.0));
  vec3 col = mix(bg, c.rgb, c.a);
  col += abs(s) * bendW * 0.05 * (1.0 - local);   // moving ridges catch a little light
  gl_FragColor = vec4(col, 1.0);
}`;

type Item = { label: string; href: string };

export default function RippleFooter({ nav }: { nav: Item[] }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // static CSS glass instead
    const gl = cv.getContext("webgl", { premultipliedAlpha: false });
    if (!gl) return;

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
    } catch { return; }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { res: u("res"), stripW: u("stripW"), dpr: u("dpr"), cursorY: u("cursorY"), bg: u("bg"), tex: u("tex"), sway: u("sway") };
    gl.uniform3f(U.bg, 0x1a / 255, 0x1a / 255, 0x1a / 255);
    gl.uniform1i(U.tex, 0);
    gl.uniform1i(U.sway, 1);

    const mkTex = (unit: number) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const glassTex = mkTex(0);
    const swayTex = mkTex(1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Sway of the lines across the footer: offset + velocity per node, a simple 1D wave.
    const off = new Float32Array(NODES);
    const vel = new Float32Array(NODES);
    const bytes = new Uint8Array(NODES);
    const uploadSway = () => {
      for (let j = 0; j < NODES; j++) bytes[j] = Math.round((Math.max(-1, Math.min(1, off[j])) * 0.5 + 0.5) * 255);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, swayTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, NODES, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
    };
    uploadSway();

    let ready = false;
    const draw = () => { if (ready) gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, glassTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      ready = true;
      el.classList.add("is-gl"); // hide the CSS fallback strips
      draw();
    };
    img.src = "/home/footer-glass.png";

    let W = 0, H = 0;
    const size = () => {
      W = el.clientWidth;
      H = el.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(U.res, W, H);
      gl.uniform1f(U.dpr, dpr);
      gl.uniform1f(U.stripW, W * (43.2 / 1440)); // strip width as in the Figma frame
      draw();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);

    let raf = 0, lastX: number | null = null, cy = H / 2, cyTarget = H / 2;
    const step = () => {
      let energy = 0;
      for (let j = 0; j < NODES; j++) {
        const l = off[Math.max(0, j - 1)], r = off[Math.min(NODES - 1, j + 1)];
        vel[j] = (vel[j] + SPREAD * (l + r - 2 * off[j]) - SPRING * off[j]) * DAMP;
      }
      for (let j = 0; j < NODES; j++) { off[j] += vel[j]; energy += Math.abs(off[j]) + Math.abs(vel[j]); }
      cy += (cyTarget - cy) * 0.12;
      gl.uniform1f(U.cursorY, cy);
      uploadSway();
      draw();
      raf = energy > 0.002 * NODES ? requestAnimationFrame(step) : 0;
      if (!raf) { off.fill(0); vel.fill(0); uploadSway(); draw(); }
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      cyTarget = r.bottom - e.clientY; // GL coords: y up
      if (lastX !== null) {
        const dx = Math.max(-60, Math.min(60, x - lastX));
        // push the lines near the cursor in the direction it's moving
        for (let j = 0; j < NODES; j++) {
          const d = ((j + 0.5) / NODES) * W - x;
          vel[j] += dx * PUSH * 0.1 * Math.exp(-(d * d) / (REACH * REACH));
        }
      }
      lastX = x;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => { lastX = null; };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <footer ref={root} id="contact" className="rfooter">
      <Fluted src="/home/footer-glass.png" strips={34} className="rfooter-fluted" />
      <canvas ref={canvas} className="rfooter-canvas" aria-hidden />
      <div className="rfooter-content">
        <p className="rfooter-thanks">You&rsquo;ve reached the end! Thanks for visiting.</p>
        <nav className="rfooter-links" aria-label="Footer">
          <Link href="/">Work</Link>
          <span aria-disabled="true" title="Coming soon">Playground</span>
          <Link href="/about">About</Link>
        </nav>
        <ContactIcons nav={nav} />
      </div>
      <a href="#top" className="rfooter-top">Back to top</a>
    </footer>
  );
}
