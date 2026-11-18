"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Fluted from "./Fluted";
import ContactIcons from "./ContactIcons";

/* ---- Tuning knobs ------------------------------------------------------- */
const RIPPLES = 10;    // how many ripples can be alive at once
const SPEED = 380;     // how fast a ripple ring travels (px/s)
const WAVE = 0.055;    // ring wavelength (higher = tighter rings)
const SHIFT = 22;      // how far the glass ridges bend in a ripple (px)
const LIFE = 2.2;      // seconds a ripple lasts
/* ------------------------------------------------------------------------ */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
// The same fluted glass as the CSS version (strip i shows image x ∈ [0.03i, 0.03i + 0.1]),
// but each pixel's position is pushed sideways by expanding rings around where the cursor moved.
const FRAG = `
precision highp float;
uniform sampler2D tex;
uniform vec2 res;
uniform float stripW, time, dpr;
uniform vec4 rip[${RIPPLES}]; // x, y (px, GL coords), start time, strength
uniform vec3 bg;
void main() {
  vec2 p = gl_FragCoord.xy / dpr;
  float disp = 0.0;
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 r = rip[i];
    float age = time - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > ${LIFE.toFixed(1)}) continue;
    float d = distance(p, r.xy);
    float ring = d - age * ${SPEED.toFixed(1)};
    float env = exp(-ring * ring / 5000.0) * exp(-age * 1.8) * r.w;
    disp += sin(ring * ${WAVE}) * env;
  }
  float x = p.x + disp * ${SHIFT.toFixed(1)};
  float i = floor(x / stripW);
  float local = fract(x / stripW);
  vec2 uv = vec2(0.03 * i + 0.1 * local, 1.0 - p.y / res.y);
  vec4 c = texture2D(tex, clamp(uv, 0.0, 1.0));
  vec3 col = mix(bg, c.rgb, c.a);
  col += disp * 0.035;                   // light catches the moving ridges
  gl_FragColor = vec4(col, 1.0);
}`;

type Item = { label: string; href: string };

export default function RippleFooter({ nav }: { nav: Item[] }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = root.current!;
    const cv = canvas.current!;
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
    const U = { res: u("res"), stripW: u("stripW"), time: u("time"), dpr: u("dpr"), rip: u("rip"), bg: u("bg") };
    gl.uniform3f(U.bg, 0x1a / 255, 0x1a / 255, 0x1a / 255);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    let ready = false;
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      ready = true;
      el.classList.add("is-gl"); // hide the CSS fallback strips
      draw();
    };
    img.src = "/home/footer-glass.png";

    let W = 0, H = 0, dpr = 1;
    const size = () => {
      W = el.clientWidth;
      H = el.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(U.res, W, H);
      gl.uniform1f(U.dpr, dpr);
      gl.uniform1f(U.stripW, W * (43.2 / 1440)); // strip width as in the Figma frame
      if (ready) draw();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);

    // Ripples: a ring of ridges bending outward from wherever the cursor moves.
    const rip = new Float32Array(RIPPLES * 4);
    let next = 0, lastX = -1e4, lastY = -1e4, lastT = 0, raf = 0;
    const t0 = performance.now();
    const now = () => (performance.now() - t0) / 1000;
    const draw = () => {
      gl.uniform1f(U.time, now());
      gl.uniform4fv(U.rip, rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = () => {
      draw();
      // keep animating while any ripple is alive
      let alive = false;
      for (let i = 0; i < RIPPLES; i++) if (rip[i * 4 + 3] > 0 && now() - rip[i * 4 + 2] < LIFE) alive = true;
      raf = alive ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!ready) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = r.bottom - e.clientY; // GL coords: y up
      const t = now();
      const dist = Math.hypot(x - lastX, y - lastY);
      if (dist < 28 && t - lastT < 0.12) return; // space ripples out a little
      const strength = Math.min(1, 0.35 + dist / 120);
      rip.set([x, y, t, strength], next * 4);
      next = (next + 1) % RIPPLES;
      lastX = x; lastY = y; lastT = t;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    el.addEventListener("pointermove", onMove);

    return () => {
      el.removeEventListener("pointermove", onMove);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const pages = [
    { label: "Work", href: "/" },
    { label: "About", href: "/about" },
  ];

  return (
    <footer ref={root} id="contact" className="rfooter">
      <Fluted src="/home/footer-glass.png" strips={34} className="rfooter-fluted" />
      <canvas ref={canvas} className="rfooter-canvas" aria-hidden />
      <div className="rfooter-content">
        <p className="rfooter-thanks">You&rsquo;ve reached the end! Thanks for visiting.</p>
        <nav className="rfooter-links" aria-label="Footer">
          <Link href={pages[0].href}>{pages[0].label}</Link>
          <span aria-disabled="true" title="Coming soon">Playground</span>
          <Link href={pages[1].href}>{pages[1].label}</Link>
        </nav>
        <ContactIcons nav={nav} />
      </div>
      <a href="#top" className="rfooter-top">Back to top</a>
    </footer>
  );
}
