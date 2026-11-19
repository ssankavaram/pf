// The magnifying-glass lens for the home carousel: a curved pane of glass fixed to the screen.
// Content is flat over the focused card and bends (taller, curving, rainbow-edged) toward the sides.
// The scene is drawn into a 2D canvas first; this WebGL pass bends it.

export const LENS = {
  flat: 0.27,     // half-width of the flat middle of the screen (× width) — the lens is fixed to the screen
  span: 0.25,     // the bend ramps up from there to the screen edge
  bend: 0.3,      // how much taller cards get at the screen edge (vertical flare)
  squeeze: 0.03,  // how much they compress sideways at the edges
  corner: 0.15,   // a little extra flare toward the top/bottom corners
  aberr: 0.22,    // rainbow: how far the spectrum spreads along the flared edges
  blur: 0.006,    // slight sideways smear at the edges
  sheen: 0.1,     // faint rainbow wash over the curve
  haze: 0.1,      // glow toward the far edges
  overscan: 0.22, // the scene is drawn this far past each screen edge (× width) so the lens always has content to bend in
};

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tex;
uniform float cx, cy, r0, span, bend, squeeze, corner, aberr, blur, sheen, haze, over, aspect;
uniform vec3 bg, hazeCol;
// How curved the glass is here: 0 over the focused card, rising toward the sides, more in the corners.
float edge(vec2 uv) {
  float e = smoothstep(r0, r0 + span, abs(uv.x - cx));
  return min(e * (1.0 + corner * abs(uv.y - cy)), 1.35);
}
// Where to read from, for a given screen point: farther out sideways, closer to the middle vertically.
vec2 warp(vec2 uv, float k) {
  float dx = uv.x - cx;
  float e = edge(uv);
  float e2 = e * e;
  float x = cx + sign(dx) * (abs(dx) + e2 * squeeze * k);
  float y = cy + (uv.y - cy) / (1.0 + bend * k * min(e2, 1.0)); // bends around the cards' own middle line
  return vec2(x, y);
}
// Screen coords -> source canvas, which is wider than the screen by 'over' on each side.
vec3 samp(vec2 uv) {
  vec2 s = vec2((uv.x + over) / (1.0 + 2.0 * over), uv.y);
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return bg;
  return texture2D(tex, s).rgb;
}
vec3 rainbow(float t) { return 0.5 + 0.5 * cos(6.2832 * (t + vec3(0.0, 0.33, 0.67))); }
// Smooth spectrum weight for t in 0..1 (red → violet), so colours fan out continuously instead of 3 ghost copies.
vec3 spectrum(float t) {
  vec3 c;
  c.r = clamp(1.0 - abs(t * 4.0 - 0.5) * 0.9, 0.0, 1.0) + clamp(t * 4.0 - 3.2, 0.0, 1.0) * 0.6; // red at the start, a touch of violet at the end
  c.g = clamp(1.0 - abs(t * 4.0 - 1.8) * 0.8, 0.0, 1.0);
  c.b = clamp(1.0 - abs(t * 4.0 - 3.0) * 0.8, 0.0, 1.0);
  return c;
}
void main() {
  float e = edge(vUv);
  float ee = e * e;
  float bw = blur * ee;
  vec3 col = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    float t = (float(i) + 0.5) / 14.0;
    vec3 w = spectrum(t);
    float k = 1.0 + aberr * ee * (t - 0.5) * 2.0;   // each colour flares a slightly different amount
    vec2 o = vec2((t - 0.5) * bw, 0.0);
    col += samp(warp(vUv + o, k)) * w;
    wsum += w;
  }
  col /= wsum;
  float onCard = smoothstep(0.0, 0.05, distance(col, bg)); // glow + tint only on cards, never the empty background
  col = mix(col, hazeCol, haze * ee * e * onCard);
  col += rainbow((vUv.y - cy) * 1.8 + abs(vUv.x - cx) * 0.8) * sheen * ee * onCard; // rainbow runs up the flared edges
  gl_FragColor = vec4(col, 1.0);
}`;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

/** Set up the lens on a canvas. Returns null without WebGL (the caller then draws flat). */
export function makeLens(canvas: HTMLCanvasElement, colors: { bg: string; haze: string }) {
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
  const U = { cx: u("cx"), cy: u("cy"), over: u("over"), r0: u("r0"), span: u("span"), bend: u("bend"), squeeze: u("squeeze"),
    corner: u("corner"), aberr: u("aberr"), blur: u("blur"), sheen: u("sheen"), haze: u("haze"), aspect: u("aspect"), bg: u("bg"), hazeCol: u("hazeCol") };
  gl.uniform1f(U.bend, LENS.bend);
  gl.uniform1f(U.squeeze, LENS.squeeze);
  gl.uniform1f(U.span, LENS.span);
  gl.uniform1f(U.aberr, LENS.aberr);
  gl.uniform1f(U.blur, LENS.blur);
  gl.uniform1f(U.corner, LENS.corner);
  gl.uniform1f(U.sheen, LENS.sheen);
  gl.uniform1f(U.haze, LENS.haze);
  gl.uniform1f(U.over, LENS.overscan);
  gl.uniform3f(U.bg, ...rgb(colors.bg));
  gl.uniform3f(U.hazeCol, ...rgb(colors.haze));

  return {
    /** cx, cy: lens centre (0–1, GL y up); r0: half-width of the flat zone (0–1 of width). */
    draw(src: HTMLCanvasElement, cx: number, cy: number, r0: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(U.aspect, canvas.width / Math.max(1, canvas.height)); // keeps the blur round
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      gl.uniform1f(U.cx, cx);
      gl.uniform1f(U.cy, cy);
      gl.uniform1f(U.r0, r0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
