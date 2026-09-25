// WebGL backend. Sprites are packed into atlas pages and batched per layer into offscreen targets, then composited
// with the light map, bloom (quarter + eighth resolution) and screen effects: shockwaves, chromatic pulse, split-tone
// grade, highlight knee, vignette, flash and film grain. Works on WebGL2 and WebGL1 (GLSL ES 1.00 shaders).
import type { Tex } from './art/core.ts';
import { SCENE, LIGHT, EMIT, type Cam, type PostFx, type Painter } from './paint.ts';

type GL = WebGLRenderingContext;
const PAGE = 2048, MAX_PAGES = 4, PAD = 2, SOLO = 4;
const STRIDE = 24, QF = 24; // bytes per vertex; 32-bit slots per quad
const MAXQ = 16000;

interface Entry { page: number; u0: number; v0: number; u1: number; v1: number; gen: number }
interface Shelf { y: number; h: number; x: number }
interface Page { tex: WebGLTexture; shelves: Shelf[]; top: number }
interface Target { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }
interface Batch { solo: WebGLTexture | null; start: number }
class Layer {
  f = new Float32Array(2048 * QF); u = new Uint32Array(this.f.buffer); n = 0; batches: Batch[] = [{ solo: null, start: 0 }];
  reset(): void { this.n = 0; this.batches.length = 1; this.batches[0].solo = null; this.batches[0].start = 0; }
  room(): void { if ((this.n + 1) * QF <= this.f.length) return; const f = new Float32Array(this.f.length * 2); f.set(this.f); this.f = f; this.u = new Uint32Array(f.buffer); }
}

const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const SPRITE_VS = `attribute vec2 a_pos; attribute vec2 a_uv; attribute vec4 a_col; attribute vec4 a_p;
uniform vec4 u_m; uniform vec2 u_cam; varying vec2 v_uv; varying vec4 v_col; varying vec4 v_p;
void main() { vec2 p = a_pos - u_cam; gl_Position = vec4(u_m.x * p.x + u_m.y * p.y, u_m.z * p.x + u_m.w * p.y, 0.0, 1.0); v_uv = a_uv; v_col = a_col; v_p = a_p; }`;
const SPRITE_FS = HEAD + `uniform sampler2D u_p0; uniform sampler2D u_p1; uniform sampler2D u_p2; uniform sampler2D u_p3; uniform sampler2D u_solo; uniform sampler2D u_noise;
varying vec2 v_uv; varying vec4 v_col; varying vec4 v_p;
void main() {
  float pg = floor(v_p.z * 255.0 + 0.5); vec4 t;
  if (pg < 0.5) t = texture2D(u_p0, v_uv); else if (pg < 1.5) t = texture2D(u_p1, v_uv); else if (pg < 2.5) t = texture2D(u_p2, v_uv); else if (pg < 3.5) t = texture2D(u_p3, v_uv); else t = texture2D(u_solo, v_uv);
  t.rgb = mix(t.rgb, vec3(t.a), v_p.x);
  if (v_p.y > 0.0) {
    float n = texture2D(u_noise, v_uv * 40.0).r * 0.62 + texture2D(u_noise, v_uv * 117.0).r * 0.38;
    float d = v_p.y * 1.2 - 0.1; float keep = smoothstep(d - 0.015, d + 0.015, n); float edge = (1.0 - smoothstep(d, d + 0.1, n)) * keep;
    if (v_p.w > 0.5) { gl_FragColor = vec4(v_col.rgb * edge * t.a * 1.8, 0.0); return; }
    t *= keep;
  }
  gl_FragColor = t * v_col;
}`;
const FS_VS = `attribute vec2 a_pos; varying vec2 v_uv; void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;
const COMP = `uniform sampler2D u_s; uniform sampler2D u_l; uniform sampler2D u_e;
vec3 comp(vec2 uv) { vec3 s = texture2D(u_s, uv).rgb; vec3 l = texture2D(u_l, uv).rgb * 2.0; vec4 e = texture2D(u_e, uv); return s * l * (1.0 - e.a) + e.rgb; }
`;
const BRIGHT_FS = HEAD + COMP + `uniform vec2 u_px; uniform float u_th; varying vec2 v_uv;
void main() {
  vec2 a = v_uv - u_px, b = v_uv + u_px;
  vec3 c = (comp(a) + comp(vec2(b.x, a.y)) + comp(vec2(a.x, b.y)) + comp(b)) * 0.25;
  vec3 e = (texture2D(u_e, a).rgb + texture2D(u_e, b).rgb) * 0.5;
  float br = max(max(c.r, c.g), c.b);
  gl_FragColor = vec4(c * smoothstep(u_th, u_th + 0.35, br) + e * 0.1, 1.0);
}`;
const BLUR_FS = HEAD + `uniform sampler2D u_t; uniform vec2 u_dir; varying vec2 v_uv;
void main() {
  vec3 c = texture2D(u_t, v_uv).rgb * 0.227027;
  c += (texture2D(u_t, v_uv + u_dir * 1.384615).rgb + texture2D(u_t, v_uv - u_dir * 1.384615).rgb) * 0.316216;
  c += (texture2D(u_t, v_uv + u_dir * 3.230769).rgb + texture2D(u_t, v_uv - u_dir * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;
const POST_FS = HEAD + COMP + `uniform sampler2D u_b1; uniform sampler2D u_b2;
uniform vec4 u_w0; uniform vec4 u_w1; uniform vec4 u_w2; uniform vec4 u_w3; uniform vec2 u_asp; uniform vec2 u_res;
uniform float u_ca; uniform float u_vig; uniform float u_desat; uniform float u_grain; uniform float u_time; uniform float u_bloom; uniform float u_b2on;
uniform vec4 u_flash; uniform vec3 u_tint; varying vec2 v_uv;
vec2 wave(vec2 uv, vec4 w) { if (w.w == 0.0) return vec2(0.0); vec2 d = (uv - w.xy) * u_asp; float r = length(d); float x = (r - w.z) * 14.0; return d / max(r, 0.0001) / u_asp * exp(-x * x) * w.w; }
void main() {
  vec2 uv = v_uv - wave(v_uv, u_w0) - wave(v_uv, u_w1) - wave(v_uv, u_w2) - wave(v_uv, u_w3);
  vec3 c;
  if (u_ca > 0.0) { vec2 o = (uv - 0.5) * u_ca; c = vec3(comp(uv + o).r, comp(uv).g, comp(uv - o).b); } else c = comp(uv);
  vec3 b = texture2D(u_b1, uv).rgb; if (u_b2on > 0.5) b += texture2D(u_b2, uv).rgb * 1.25;
  c += b * u_bloom;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(lum), u_desat);
  c *= mix(vec3(0.9, 0.96, 1.12), vec3(1.06, 1.0, 0.93), smoothstep(0.05, 0.7, lum));
  c *= u_tint;
  vec3 hi = max(c - 0.86, 0.0); c = min(c, 0.86) + hi / (1.0 + hi * 1.8);
  float r = length(v_uv - 0.5) * 1.414; c *= 1.0 - u_vig * smoothstep(0.42, 1.05, r) * 0.8;
  c = mix(c, u_flash.rgb, u_flash.a);
  float n = fract(sin(dot(floor(v_uv * u_res) + fract(u_time) * 131.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * u_grain;
  gl_FragColor = vec4(c, 1.0);
}`;

function shader(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('shader: ' + gl.getShaderInfoLog(s));
  return s;
}
interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; a: Record<string, number> }
function program(gl: GL, vs: string, fs: string, attrs: string[]): Prog {
  const p = gl.createProgram()!; gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
  attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u: Prog['u'] = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i)!; u[info.name] = gl.getUniformLocation(p, info.name); }
  const a: Prog['a'] = {}; attrs.forEach((x, i) => { a[x] = i; }); return { p, u, a };
}
const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
function pack(col: number, a: number, add: number, k = 1): number {
  a = clamp01(a); const m = a * k;
  return ((((add ? 0 : a * 255) | 0) << 24) | (((col & 255) * m | 0) << 16) | ((((col >> 8) & 255) * m | 0) << 8) | (((col >> 16) & 255) * m | 0)) >>> 0;
}
const params = (flash: number, dis: number, page: number, mode: number) => (((mode * 255) << 24) | (page << 16) | ((clamp01(dis) * 255 | 0) << 8) | (clamp01(flash) * 255 | 0)) >>> 0;

export class GLPainter implements Painter {
  readonly kind = 'gl' as const; readonly canvas: HTMLCanvasElement; lost = false; gl2: boolean;
  W = 1; H = 1; dpr = 1; stats = { draws: 0, quads: 0, uploads: 0 };
  /** Colour of the glowing edge on dissolving sprites. */
  edgeCol = 0xffd98a; bloomQ = 2;
  private gl: GL; private sprite: Prog; private bright: Prog; private blur: Prog; private post: Prog;
  private vbo: WebGLBuffer; private ibo: WebGLBuffer; private tri: WebGLBuffer; private noise: WebGLTexture; private blank: WebGLTexture;
  private layers = [new Layer(), new Layer(), new Layer()];
  private pages: Page[] = []; private entries = new Map<number, Entry>(); private gen = 1; private needReset = false;
  private solo = new Map<HTMLCanvasElement, { tex: WebGLTexture; used: number }>(); private frameNo = 0;
  private S: Target | null = null; private L: Target | null = null; private E: Target | null = null; private B: Target[] = [];
  private cam: Cam = { x: 0, y: 0, zoom: 1, rot: 0 }; private ambient: [number, number, number] = [1, 1, 1]; private bg = 0;
  private maxTex: number;

  constructor(cv: HTMLCanvasElement) {
    this.canvas = cv;
    const opts: WebGLContextAttributes = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let gl = cv.getContext('webgl2', opts) as GL | null; this.gl2 = !!gl;
    if (!gl) gl = (cv.getContext('webgl', opts) ?? cv.getContext('experimental-webgl', opts)) as GL | null;
    if (!gl) throw new Error('no webgl');
    this.gl = gl; this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (this.maxTex < PAGE || (gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number) < 8) throw new Error('webgl limits');
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    this.sprite = program(gl, SPRITE_VS, SPRITE_FS, ['a_pos', 'a_uv', 'a_col', 'a_p']);
    this.bright = program(gl, FS_VS, BRIGHT_FS, ['a_pos']); this.blur = program(gl, FS_VS, BLUR_FS, ['a_pos']); this.post = program(gl, FS_VS, POST_FS, ['a_pos']);
    this.vbo = gl.createBuffer()!;
    const idx = new Uint16Array(MAXQ * 6); for (let i = 0, v = 0; i < idx.length; i += 6, v += 4) { idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3; }
    this.ibo = gl.createBuffer()!; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.tri = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const nz = new Uint8Array(64 * 64 * 4); let s = 1234567; for (let i = 0; i < nz.length; i++) { s = (s * 1103515245 + 12345) >>> 0; nz[i] = (s >>> 16) & 255; }
    this.noise = this.texture(64, 64, nz, true); this.blank = this.texture(1, 1, new Uint8Array(4), false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.useProgram(this.sprite.p); const u = this.sprite.u;
    gl.uniform1i(u.u_p0, 0); gl.uniform1i(u.u_p1, 1); gl.uniform1i(u.u_p2, 2); gl.uniform1i(u.u_p3, 3); gl.uniform1i(u.u_solo, 4); gl.uniform1i(u.u_noise, 5);
  }
  private texture(w: number, h: number, data: Uint8Array | null, repeat: boolean): WebGLTexture {
    const gl = this.gl, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }
  private target(w: number, h: number): Target {
    const gl = this.gl; w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); const tex = this.texture(w, h, null, false);
    const fb = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }
  private free(t: Target | null): void { if (!t) return; this.gl.deleteFramebuffer(t.fb); this.gl.deleteTexture(t.tex); }
  resize(W: number, H: number, dpr: number): void {
    this.W = W; this.H = H; this.dpr = dpr;
    const w = Math.round(W * dpr), h = Math.round(H * dpr); this.canvas.width = w; this.canvas.height = h;
    for (const t of [this.S, this.L, this.E, ...this.B]) this.free(t);
    this.S = this.target(w, h); this.E = this.target(w, h); this.L = this.target(w / 2, h / 2);
    this.B = [this.target(w / 4, h / 4), this.target(w / 4, h / 4), this.target(w / 8, h / 8), this.target(w / 8, h / 8)];
    const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, this.S.fb);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) throw new Error('framebuffer incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------- atlas ----------
  resetAtlas(): void {
    for (const p of this.pages) this.gl.deleteTexture(p.tex);
    this.pages = []; this.entries.clear(); this.gen++; this.needReset = false;
  }
  private alloc(w: number, h: number): { page: number; x: number; y: number } | null {
    if (w > PAGE || h > PAGE) return null;
    for (let pi = 0; pi <= this.pages.length && pi < MAX_PAGES; pi++) {
      if (pi === this.pages.length) this.pages.push({ tex: this.texture(PAGE, PAGE, null, false), shelves: [], top: 0 });
      const pg = this.pages[pi];
      for (const s of pg.shelves) if (h <= s.h && h >= s.h * 0.7 && s.x + w <= PAGE) { const x = s.x; s.x += w; return { page: pi, x, y: s.y }; }
      if (pg.top + h <= PAGE) { const s = { y: pg.top, h, x: w }; pg.shelves.push(s); pg.top += h; return { page: pi, x: 0, y: s.y }; }
      for (const s of pg.shelves) if (h <= s.h && s.x + w <= PAGE) { const x = s.x; s.x += w; return { page: pi, x, y: s.y }; }
    }
    return null;
  }
  private entry(t: Tex): Entry | null {
    const e = this.entries.get(t.id); if (e && e.gen === this.gen) return e;
    const w = t.cv.width, h = t.cv.height; const slot = this.alloc(w + PAD * 2, h + PAD * 2);
    if (!slot) { this.needReset = true; return null; }
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.pages[slot.page].tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, slot.x + PAD, slot.y + PAD, gl.RGBA, gl.UNSIGNED_BYTE, t.cv);
    const n: Entry = { page: slot.page, u0: (slot.x + PAD) / PAGE, v0: (slot.y + PAD) / PAGE, u1: (slot.x + PAD + w) / PAGE, v1: (slot.y + PAD + h) / PAGE, gen: this.gen };
    this.entries.set(t.id, n); this.stats.uploads++; return n;
  }

  // ---------- recording ----------
  begin(cam: Cam, ambient: [number, number, number], bg: number): void {
    if (this.needReset) this.resetAtlas();
    this.frameNo++; this.cam = cam; this.ambient = ambient; this.bg = bg; this.stats.draws = this.stats.quads = 0;
    for (const l of this.layers) l.reset();
  }
  private quad(L: Layer, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, u0: number, v0: number, u1: number, v1: number, ca: number, cb: number, p: number): void {
    L.room(); const f = L.f, u = L.u; const o = L.n * QF;
    f[o] = x0; f[o + 1] = y0; f[o + 2] = u0; f[o + 3] = v0; u[o + 4] = ca; u[o + 5] = p;
    f[o + 6] = x1; f[o + 7] = y1; f[o + 8] = u1; f[o + 9] = v0; u[o + 10] = cb; u[o + 11] = p;
    f[o + 12] = x2; f[o + 13] = y2; f[o + 14] = u1; f[o + 15] = v1; u[o + 16] = cb; u[o + 17] = p;
    f[o + 18] = x3; f[o + 19] = y3; f[o + 20] = u0; f[o + 21] = v1; u[o + 22] = ca; u[o + 23] = p;
    L.n++;
  }
  draw(layer: number, t: Tex, x: number, y: number, sx: number, sy: number, rot: number, col: number, a: number, add: number, flash = 0, dis = 0): void {
    if (a <= 0.002 || dis >= 1) return; const e = this.entry(t); if (!e) return;
    const w = t.w * sx, h = t.h * sy, ox = -t.ax * w, oy = -t.ay * h;
    const cs = rot ? Math.cos(rot) : 1, sn = rot ? Math.sin(rot) : 0;
    const x0 = ox * cs - oy * sn + x, y0 = ox * sn + oy * cs + y, wx = w * cs, wy = w * sn, hx = -h * sn, hy = h * cs;
    const c = pack(col, a, add, layer === LIGHT ? 0.5 : 1);
    this.quad(this.layers[layer], x0, y0, x0 + wx, y0 + wy, x0 + wx + hx, y0 + wy + hy, x0 + hx, y0 + hy, e.u0, e.v0, e.u1, e.v1, c, c, params(flash, dis, e.page, 0));
    if (dis > 0 && layer === SCENE) { const g = pack(this.edgeCol, a, 1); this.quad(this.layers[EMIT], x0, y0, x0 + wx, y0 + wy, x0 + wx + hx, y0 + wy + hy, x0 + hx, y0 + hy, e.u0, e.v0, e.u1, e.v1, g, g, params(0, dis, e.page, 1)); }
  }
  beam(layer: number, t: Tex, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a: number, add: number): void {
    if (a <= 0.002) return; const e = this.entry(t); if (!e) return;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 0.01) return;
    const nx = -dy / L * w / 2, ny = dx / L * w / 2; const c = pack(col, a, add, layer === LIGHT ? 0.5 : 1);
    this.quad(this.layers[layer], x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny, e.u0, e.v0, e.u1, e.v1, c, c, params(0, 0, e.page, 0));
  }
  arc(layer: number, t: Tex, x: number, y: number, r: number, w: number, a0: number, a1: number, col: number, a: number, add: number): void {
    if (a <= 0.002) return; const e = this.entry(t); if (!e) return;
    const n = Math.max(4, Math.min(48, Math.ceil(Math.abs(a1 - a0) * r / 10))); const ro = r + w / 2, ri = Math.max(0, r - w / 2); const p = params(0, 0, e.page, 0); const L = this.layers[layer];
    const k = layer === LIGHT ? 0.5 : 1;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, b0 = a0 + (a1 - a0) * t0, b1 = a0 + (a1 - a0) * t1; const c0 = Math.cos(b0), s0 = Math.sin(b0), c1 = Math.cos(b1), s1 = Math.sin(b1);
      const ua = e.u0 + (e.u1 - e.u0) * t0, ub = e.u0 + (e.u1 - e.u0) * t1;
      this.quad(L, x + c0 * ro, y + s0 * ro, x + c1 * ro, y + s1 * ro, x + c1 * ri, y + s1 * ri, x + c0 * ri, y + s0 * ri, ua, e.v0, ub, e.v1, pack(col, a * t0 * t0, add, k), pack(col, a * t1 * t1, add, k), p);
    }
  }
  image(cv: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    let s = this.solo.get(cv);
    if (!s) { const gl = this.gl; const tex = this.texture(1, 1, null, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); s = { tex, used: 0 }; this.solo.set(cv, s); this.stats.uploads++; }
    s.used = this.frameNo;
    const L = this.layers[SCENE]; const b = L.batches[L.batches.length - 1];
    if (b.solo !== s.tex) { if (b.start === L.n) b.solo = s.tex; else L.batches.push({ solo: s.tex, start: L.n }); }
    const W = cv.width, H = cv.height; const c = 0xffffffff;
    this.quad(L, dx, dy, dx + dw, dy, dx + dw, dy + dh, dx, dy + dh, sx / W, sy / H, (sx + sw) / W, (sy + sh) / H, c, c, params(0, 0, SOLO, 0));
  }

  // ---------- output ----------
  private flush(L: Layer): void {
    const gl = this.gl; if (!L.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, L.f.subarray(0, L.n * QF), gl.STREAM_DRAW);
    for (let bi = 0; bi < L.batches.length; bi++) {
      const b = L.batches[bi], end = bi + 1 < L.batches.length ? L.batches[bi + 1].start : L.n; if (end <= b.start) continue;
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, b.solo ?? this.blank);
      for (let q = b.start; q < end; q += MAXQ) {
        const n = Math.min(MAXQ, end - q), off = q * 4 * STRIDE;
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, off); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, off + 8);
        gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE, off + 16); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, STRIDE, off + 20);
        gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, 0); this.stats.draws++;
      }
    }
    this.stats.quads += L.n;
  }
  private pass(prog: Prog, out: Target | null): void {
    const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, out ? out.w : this.canvas.width, out ? out.h : this.canvas.height); gl.useProgram(prog.p);
  }
  private tex(unit: number, t: WebGLTexture, prog: Prog, name: string): void { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u[name], unit); }
  private fullscreen(): void { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.tri); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); this.stats.draws++; }
  end(post: PostFx): void {
    const gl = this.gl; if (this.lost || gl.isContextLost() || !this.S || !this.L || !this.E) return;
    const cam = this.cam, W = this.W, H = this.H;
    // sprite layers
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.sprite.p); const u = this.sprite.u;
    const cs = Math.cos(cam.rot) * cam.zoom, sn = Math.sin(cam.rot) * cam.zoom;
    gl.uniform4f(u.u_m, 2 * cs / W, -2 * sn / W, -2 * sn / H, -2 * cs / H); gl.uniform2f(u.u_cam, cam.x, cam.y);
    for (let i = 0; i < 4; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.pages[i]?.tex ?? this.blank); }
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
    const bg = this.bg, amb = this.ambient;
    const target = (t: Target, r: number, g: number, b: number, a: number) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT); };
    target(this.S, ((bg >> 16) & 255) / 255, ((bg >> 8) & 255) / 255, (bg & 255) / 255, 1); this.flush(this.layers[SCENE]);
    target(this.L, clamp01(amb[0] / 2), clamp01(amb[1] / 2), clamp01(amb[2] / 2), 1); this.flush(this.layers[LIGHT]);
    target(this.E, 0, 0, 0, 0); this.flush(this.layers[EMIT]);
    for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
    gl.disable(gl.BLEND);
    // bloom
    const [b1, b2, b3, b4] = this.B; const bloom = post.bloom > 0 && this.bloomQ > 0;
    if (bloom) {
      this.pass(this.bright, b1); this.tex(0, this.S.tex, this.bright, 'u_s'); this.tex(1, this.L.tex, this.bright, 'u_l'); this.tex(2, this.E.tex, this.bright, 'u_e');
      gl.uniform2f(this.bright.u.u_px, 1 / this.S.w, 1 / this.S.h); gl.uniform1f(this.bright.u.u_th, 0.76); this.fullscreen();
      const blur = (src: Target, dst: Target, dx: number, dy: number) => { this.pass(this.blur, dst); this.tex(0, src.tex, this.blur, 'u_t'); gl.uniform2f(this.blur.u.u_dir, dx / src.w, dy / src.h); this.fullscreen(); };
      blur(b1, b2, 1, 0); blur(b2, b1, 0, 1);
      if (this.bloomQ > 1) { blur(b1, b3, 0, 0); blur(b3, b4, 1, 0); blur(b4, b3, 0, 1); }
    }
    // final composite
    const P = this.post; this.pass(P, null);
    this.tex(0, this.S.tex, P, 'u_s'); this.tex(1, this.L.tex, P, 'u_l'); this.tex(2, this.E.tex, P, 'u_e'); this.tex(3, bloom ? b1.tex : this.blank, P, 'u_b1'); this.tex(4, bloom && this.bloomQ > 1 ? b3.tex : this.blank, P, 'u_b2');
    const asp = W / H; gl.uniform2f(P.u.u_asp, asp, 1); gl.uniform2f(P.u.u_res, this.canvas.width, this.canvas.height);
    for (let i = 0; i < 4; i++) {
      const o = i * 4; let v = [0, 0, 0, 0];
      if (o + 3 < post.waves.length) {
        const X = post.waves[o] - cam.x, Y = post.waves[o + 1] - cam.y; const sx = cs * X - sn * Y, sy = sn * X + cs * Y;
        v = [0.5 + sx / W, 0.5 - sy / H, post.waves[o + 2] * cam.zoom / H, post.waves[o + 3] * cam.zoom / H];
      }
      gl.uniform4f(P.u['u_w' + i], v[0], v[1], v[2], v[3]);
    }
    gl.uniform1f(P.u.u_ca, post.ca); gl.uniform1f(P.u.u_vig, post.vignette); gl.uniform1f(P.u.u_desat, post.desat); gl.uniform1f(P.u.u_grain, post.grain);
    gl.uniform1f(P.u.u_time, post.time); gl.uniform1f(P.u.u_bloom, bloom ? post.bloom : 0); gl.uniform1f(P.u.u_b2on, bloom && this.bloomQ > 1 ? 1 : 0);
    const fc = post.flashCol; gl.uniform4f(P.u.u_flash, ((fc >> 16) & 255) / 255, ((fc >> 8) & 255) / 255, (fc & 255) / 255, clamp01(post.flash));
    const tc = post.tint; gl.uniform3f(P.u.u_tint, ((tc >> 16) & 255) / 255, ((tc >> 8) & 255) / 255, (tc & 255) / 255);
    this.fullscreen();
    // drop solo textures (terrain chunks) not drawn for a while
    if (this.frameNo % 60 === 0) for (const [cv, s] of this.solo) if (s.used < this.frameNo - 120) { gl.deleteTexture(s.tex); this.solo.delete(cv); }
  }
  destroy(): void {
    const gl = this.gl; for (const t of [this.S, this.L, this.E, ...this.B]) this.free(t);
    this.resetAtlas(); for (const s of this.solo.values()) gl.deleteTexture(s.tex); this.solo.clear();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
