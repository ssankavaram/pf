// The magnifying-glass lens for the home carousel: a curved pane of glass fixed to the screen.
// Content is flat over the focused card and bends (taller, curving, rainbow-edged) toward the sides.
// The scene is drawn into a 2D canvas first; this WebGL pass bends it.

export const LENS = {
  bend: 0.14,     // how much taller things get at the edges (vertical magnify)
  squeeze: 0.04,  // how much they compress sideways at the edges
  flatPad: 0.0,   // extra flat zone beyond the focused card's own edges (× screen width)
  span: 0.34,     // how wide the bending zone is (× screen width)
  corner: 0.25,   // extra bend + blur toward the top/bottom corners
  aberr: 0.95,    // rainbow: how far red and blue split apart at the edges
  blur: 0.004,    // slight softening at the edges (× screen width)
  sheen: 0.13,    // soft rainbow tint over the curved glass
  haze: 0.15,     // glow toward the far edges
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
void main() {
  float e = edge(vUv);
  float ee = e * e;
  float ab = aberr * ee;               // red/blue bend more/less than green: rainbow fringes
  float bw = blur * ee;                // out of focus toward the sides and corners
  vec3 col = vec3(0.0);
  // 12-tap spiral blur (soft, round bokeh-like falloff)
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 12.0);
    float a = fi * 2.39996;
    vec2 o = vec2(cos(a), sin(a) * aspect) * r * bw;
    col.r += samp(warp(vUv + o, 1.0 + ab)).r;
    col.g += samp(warp(vUv + o, 1.0)).g;
    col.b += samp(warp(vUv + o, 1.0 - ab)).b;
  }
  col /= 12.0;
  float onCard = smoothstep(0.0, 0.05, distance(col, bg)); // glow + tint only on cards, never the empty background
  col = mix(col, hazeCol, haze * ee * e * onCard);
  col += rainbow(vUv.y * 1.3 + vUv.x * 0.6) * sheen * ee * onCard; // light rainbow wash over the curve
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
