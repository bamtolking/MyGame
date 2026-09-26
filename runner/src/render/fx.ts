// Particles and floating text (world space unless noted). Visual-only randomness — never the sim RNG.
// Draw order (GDD §11.4-5): particles are drawn BELOW pickups and hazards; floating text above the runner but
// never more than 60 % opaque where it overlaps a hazard, so effects can never hide what is coming.
export type ParticleKind = 'dot' | 'star' | 'chunk' | 'ring'
  | 'spark' | 'flame' | 'puff' | 'glow' | 'petal' | 'flake' | 'coinlet';        // the last 7: cosmetic trails (TrailFx)
export interface Particle {
  x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; color: string; kind: ParticleKind; rot: number; vr: number;
  a?: number;          // max alpha (trails)
  lk?: number;         // trails: vx keeps following the runner at this fraction of ITS current speed (so a trail never overtakes it)
}
export interface Popup { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number; screen: boolean }
export interface Box { x0: number; x1: number; y0: number; y1: number }

export const MAX_PARTICLES = 180;
export const MAX_POPUPS = 24;
export const FX_ALPHA_OVER_HAZARD = 0.6;

let seed = 1234567;
export function vrand(): number { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

export class Fx {
  parts: Particle[] = [];
  pops: Popup[] = [];
  /** @deprecated shake lives in the renderer (trauma model); kept for older callers */
  shake = 0; shakeX = 0; shakeY = 0;
  quality = 1;           // 0.4 on low-fx
  reduceMotion = false;

  burst(x: number, y: number, n: number, color: string, speed = 260, kind: ParticleKind = 'dot', size = 5, g = 900): void {
    const cnt = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < cnt; i++) {
      if (this.parts.length >= MAX_PARTICLES) this.parts.shift();   // pool: the oldest particle gives way
      const a = vrand() * Math.PI * 2; const v = speed * (0.35 + vrand() * 0.65);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g, life: 0, max: 0.45 + vrand() * 0.4, size: size * (0.6 + vrand() * 0.8), color, kind, rot: vrand() * 6, vr: (vrand() - 0.5) * 16 });
    }
  }
  ring(x: number, y: number, color: string, size = 30): void {
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0, max: 0.35, size, color, kind: 'ring', rot: 0, vr: 0 });
  }
  text(x: number, y: number, text: string, color = '#fff', size = 18, screen = false, life = 0.8): void {
    if (this.pops.length >= MAX_POPUPS) this.pops.shift();
    this.pops.push({ x, y, vy: screen ? -20 : -90, life: 0, max: life, text, color, size, screen });
  }
  kick(_amount: number): void { /* replaced by Renderer.trauma */ }
  clear(): void { this.parts.length = 0; this.pops.length = 0; }

  update(dt: number): void {
    for (const p of this.parts) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    if (this.parts.some(p => p.life >= p.max)) this.parts = this.parts.filter(p => p.life < p.max);
    for (const p of this.pops) { p.life += dt; p.y += p.vy * dt; p.vy *= 0.94; }
    if (this.pops.some(p => p.life >= p.max)) this.pops = this.pops.filter(p => p.life < p.max);
  }

  /** particles (world space) — drawn under pickups and hazards */
  drawParticles(c: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
      c.fillStyle = p.color; c.strokeStyle = p.color;
      if (p.kind === 'ring') { c.lineWidth = 4 * k; c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - k), 0, Math.PI * 2); c.stroke(); continue; }
      if (p.kind === 'star') { star(c, p.x, p.y, p.size * (0.5 + k * 0.5), p.rot); continue; }
      if (p.kind === 'chunk') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); c.restore(); continue; }
      if (p.kind !== 'dot') { drawTrailParticle(c, p, k); continue; }
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  /** floating text (world space); `hazards` are the on-screen hazard boxes — text over them is capped at 60 % */
  drawPopups(c: CanvasRenderingContext2D, hazards: Box[] = []): void {
    for (const p of this.pops) {
      if (p.screen) continue;
      const hw = p.size * p.text.length * 0.35 + 6, hh = p.size * 0.6;
      const over = hazards.some(h => p.x + hw > h.x0 && p.x - hw < h.x1 && p.y + hh > h.y0 && p.y - hh < h.y1);
      popText(c, p, over ? FX_ALPHA_OVER_HAZARD : 1);
    }
  }
  /** @deprecated use drawParticles + drawPopups */
  drawWorld(c: CanvasRenderingContext2D): void { this.drawParticles(c); this.drawPopups(c); }
  drawScreen(c: CanvasRenderingContext2D): void { for (const p of this.pops) if (p.screen) popText(c, p, 1); }
}

function popText(c: CanvasRenderingContext2D, p: Popup, maxA: number): void {
  const k = p.life / p.max;
  const s = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
  c.globalAlpha = Math.min(maxA, k > 0.7 ? (1 - k) / 0.3 : 1);
  c.font = `900 ${Math.round(p.size * s)}px system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(3, p.size * 0.22); c.strokeStyle = 'rgba(30,16,40,0.85)'; c.lineJoin = 'round';
  c.strokeText(p.text, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
  c.globalAlpha = 1;
}

export function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}

// ---------------------------------------------------------------- cosmetic trails (발자취, GDD §9.5)
// A subtle wake behind the runner while it runs / jumps: ≤ 8 particles/s from the shared pool (never evicting
// gameplay particles — trails stop spawning 40 short of the cap), born at the runner's BACK and drifting slower than
// it runs (vx is re-pinned every frame to a fraction of the runner's actual speed, so when the runner stops — pause
// countdown, dying, a tutorial slow-down — its wake stops too and can never drift ahead of it); like every particle
// they draw under pickups and hazards.
// Nothing is star-candy shaped or candy-sized: 별가루 is 2–3 px four-point glints, 엽전 are 3 px flipping chips
// (a pickup coin is 24 px). 무지개 is a short ribbon drawn from the runner's recent path instead of particles.
// reduceMotion → a sparse, motionless version (glints fade where they were born, no ribbon wave); lowFx → half rate.
export type TrailId = 'star' | 'fire' | 'steam' | 'lantern' | 'petal' | 'snow' | 'rainbow' | 'coin';
export const TRAIL_IDS: TrailId[] = ['star', 'fire', 'steam', 'lantern', 'petal', 'snow', 'rainbow', 'coin'];
/** 'trail_star' (a COSMETICS id) or 'star' → 'star'; anything else → null */
export function trailIdOf(id: string | null | undefined): TrailId | null {
  const t = (id ?? '').replace(/^trail_/, '') as TrailId;
  return TRAIL_IDS.includes(t) ? t : null;
}
const TRAIL_CAP = MAX_PARTICLES - 40;
const PETALS = ['#ff9ec2', '#ffc6da', '#ff7aa8'];
const RIBBON = ['#ff6b6b', '#ffc93d', '#5fd38a', '#5aa9ff'];
type Spawn = (x: number, y: number, h: number, v: number) => Omit<Particle, 'life'>;
const r = vrand;
/** per trail: particles per second and how one is born (x, y = the runner's back at its feet, h = its height) */
const TRAILS: Record<Exclude<TrailId, 'rainbow'>, { rate: number; spawn: Spawn }> = {
  star: { rate: 8, spawn: (x, y, h, v) => ({ x: x - r() * 6, y: y - h * (0.2 + r() * 0.65), vx: v * 0.74 + (r() - 0.5) * 30, vy: (r() - 0.5) * 36, g: 0, max: 0.75 + r() * 0.35, size: 2.6 + r() * 1.6, color: r() < 0.5 ? '#fff6c8' : '#ffffff', kind: 'spark', rot: r() * 6, vr: 0, a: 1 }) },
  fire: { rate: 8, spawn: (x, y, h, v) => ({ x: x - r() * 4, y: y - h * (0.15 + r() * 0.4), vx: v * 0.7, vy: -40 - r() * 50, g: -140, max: 0.45 + r() * 0.2, size: 4 + r() * 2, color: '#ff7a3a', kind: 'flame', rot: 0, vr: 0, a: 0.92 }) },
  steam: { rate: 6, spawn: (x, y, h, v) => ({ x: x + 2 - r() * 4, y: y - h * (0.72 + r() * 0.2), vx: v * 0.74, vy: -26 - r() * 18, g: -10, max: 0.85 + r() * 0.3, size: 3.8 + r() * 1.6, color: '#f6f6f6', kind: 'puff', rot: 0, vr: 0, a: 0.5 }) },
  lantern: { rate: 4, spawn: (x, y, h, v) => ({ x: x - 3, y: y - h * (0.3 + r() * 0.45), vx: v * 0.78, vy: -16 - r() * 14, g: 0, max: 1.1 + r() * 0.3, size: 2.8 + r() * 0.8, color: '#ffb347', kind: 'glow', rot: r() * 6, vr: 0, a: 1 }) },
  petal: { rate: 6, spawn: (x, y, h, v) => ({ x: x - r() * 5, y: y - h * (0.3 + r() * 0.55), vx: v * 0.74, vy: 8 + r() * 24, g: 26, max: 1 + r() * 0.3, size: 4 + r() * 1, color: PETALS[(r() * 3) | 0], kind: 'petal', rot: r() * 6, vr: (r() < 0.5 ? -1 : 1) * (4 + r() * 4), a: 1 }) },
  snow: { rate: 6, spawn: (x, y, h, v) => ({ x: x - r() * 6, y: y - h * (0.4 + r() * 0.55), vx: v * 0.74, vy: 14 + r() * 18, g: 8, max: 1 + r() * 0.3, size: 3.2 + r() * 1.2, color: '#eaf7ff', kind: 'flake', rot: r() * 6, vr: (r() - 0.5) * 3, a: 1 }) },
  coin: { rate: 5, spawn: (x, y, h, v) => ({ x: x - 2, y: y - h * (0.35 + r() * 0.3), vx: v * 0.7, vy: -150 - r() * 60, g: 620, max: 0.65 + r() * 0.15, size: 3.2 + r() * 0.5, color: '#f0bf4c', kind: 'coinlet', rot: r() * 6, vr: 12 + r() * 8, a: 1 }) },
};

export interface TrailOpts { reduceMotion: boolean; lowFx: boolean }
export class TrailFx {
  id: TrailId | null = null;
  /** size multiplier (the renderer sets ≈ 1.35 in portrait, where the world is drawn at ×0.46) */
  sizeK = 1;
  private wave = true;
  private acc = 0;
  private mine: Particle[] = [];       // this trail's live particles (their vx follows the runner)
  private pts: number[] = [];          // ribbon: x, y, age triplets (newest last)
  reset(): void { this.acc = 0; this.pts.length = 0; this.mine.length = 0; }
  /** (x, y) = the runner's feet (world px), sc = its scale, v = its ACTUAL speed (px/s, 0 while held); `on` while running */
  update(fx: Fx, dt: number, x: number, y: number, sc: number, sliding: boolean, v: number, on: boolean, o: TrailOpts): void {
    const bx = x - 20 * sc, h = (sliding ? 34 : 78) * sc;
    const pts = this.pts, mine = this.mine;
    let m = 0;
    for (const p of mine) if (p.life < p.max) { p.vx = (p.lk ?? 0) * v; mine[m++] = p; }
    mine.length = Math.min(m, 32);
    for (let i = 2; i < pts.length; i += 3) pts[i] += dt;
    const keep = o.reduceMotion ? 0.1 : o.lowFx ? 0.18 : 0.28;
    let cut = 0; while (cut < pts.length && pts[cut + 2] > keep) cut += 3;
    if (cut) pts.splice(0, cut);
    const id = this.id; this.wave = !o.reduceMotion;
    if (!id || !on || v < 60) { this.acc = 0; if (!id || v < 60) pts.length = 0; return; }
    if (id === 'rainbow') {
      const n = pts.length;
      if (n && Math.abs(pts[n - 3] - bx) > 200) pts.length = 0;       // teleport (rewind / relay)
      pts.push(bx, y - h * 0.5, 0);
      return;
    }
    const t = TRAILS[id];
    this.acc += dt * t.rate * (o.reduceMotion ? 0.3 : 1) * (o.lowFx ? 0.5 : 1);
    while (this.acc >= 1) {
      this.acc -= 1;
      if (fx.parts.length >= TRAIL_CAP) continue;                    // the pool is busy with gameplay FX
      const p = t.spawn(bx, y, h, v) as Particle; p.life = 0; p.size *= this.sizeK;
      if (o.reduceMotion) { p.vx = 0; p.vy = 0; p.g = 0; p.vr = 0; p.max *= 0.6; }
      p.lk = Math.max(0, Math.min(0.85, p.vx / v));
      fx.parts.push(p); mine.push(p);
    }
  }
  /** 무지개: a 4-stripe ribbon along the runner's last ~0.2 s, fading toward the tail (world space, under hazards) */
  drawRibbon(c: CanvasRenderingContext2D): void {
    const pts = this.pts, n = pts.length / 3;
    if (this.id !== 'rainbow' || n < 3) return;
    const half = Math.floor(n / 2);
    const K = this.sizeK;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 3 * K;
    for (let seg = 0; seg < 2; seg++) {
      const i0 = seg ? half : 0, i1 = seg ? n - 1 : half;
      c.globalAlpha = seg ? 0.62 : 0.3;
      for (let k = 0; k < 4; k++) {
        const oy = (k - 1.5) * 2.9 * K;
        c.strokeStyle = RIBBON[k]; c.beginPath();
        for (let i = i0; i <= i1; i++) {
          const age = pts[i * 3 + 2], w = this.wave ? Math.sin(age * 26) * Math.min(1, age * 8) * 2.6 * K : 0;   // a gentle travelling wave
          const X = pts[i * 3], Y = pts[i * 3 + 1] + oy + w; if (i === i0) c.moveTo(X, Y); else c.lineTo(X, Y);
        }
        c.stroke();
      }
    }
    c.globalAlpha = 1; c.lineCap = 'butt';
  }
}

/** one trail particle; k = 1 → just born, 0 → gone. globalAlpha is already set from k. */
function drawTrailParticle(c: CanvasRenderingContext2D, p: Particle, k: number): void {
  const x = p.x, y = p.y, s = p.size;
  if (p.a !== undefined) c.globalAlpha *= p.a;
  switch (p.kind) {
    case 'spark': {            // 4-point glint that swells and shrinks
      const rr = s * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, (1 - k) * 1.4 + 0.15))), q = rr * 0.26;
      c.beginPath(); c.moveTo(x, y - rr); c.quadraticCurveTo(x + q, y - q, x + rr, y); c.quadraticCurveTo(x + q, y + q, x, y + rr);
      c.quadraticCurveTo(x - q, y + q, x - rr, y); c.quadraticCurveTo(x - q, y - q, x, y - rr); c.fill();
      break;
    }
    case 'flame': {            // teardrop licking upward: yellow → orange → red as it cools
      const rr = s * (0.5 + 0.5 * k);
      c.fillStyle = k > 0.66 ? '#ffb13a' : k > 0.33 ? '#ff7a3a' : '#e0452c';
      c.beginPath(); c.moveTo(x, y - rr * 2.3); c.quadraticCurveTo(x + rr * 1.1, y - rr * 0.6, x + rr, y); c.arc(x, y, rr, 0, Math.PI); c.quadraticCurveTo(x - rr * 1.1, y - rr * 0.6, x, y - rr * 2.3); c.fill();
      if (k > 0.45) { c.fillStyle = '#fff1a0'; c.beginPath(); c.arc(x, y - rr * 0.1, rr * 0.45, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'puff':               // soft steam puff that grows as it fades
      c.beginPath(); c.arc(x, y, s * (1 + (1 - k) * 1.4), 0, Math.PI * 2); c.fill();
      break;
    case 'glow': {             // a floating ember of lamplight: flickering halo + bright core
      c.globalAlpha *= 0.8 + 0.2 * Math.sin(p.life * 22 + p.rot);
      const a = c.globalAlpha;
      c.globalAlpha = a * 0.3; c.beginPath(); c.arc(x, y, s * 2.5, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff4d0'; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.2, s * 0.5, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'petal':              // fluttering petal: flips (squashes) as it spins
      c.beginPath(); c.ellipse(x, y, s, s * (0.2 + 0.4 * Math.abs(Math.cos(p.rot))), p.rot * 0.4, 0, Math.PI * 2); c.fill();
      break;
    case 'flake': {            // six-armed snowflake
      c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < 3; i++) { const a = p.rot + i * Math.PI / 3, dx = Math.cos(a) * s, dy = Math.sin(a) * s; c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); }
      c.stroke(); c.lineCap = 'butt';
      break;
    }
    case 'coinlet': {          // a tiny spinning 엽전 chip (edge-on most of the time)
      const cw = Math.abs(Math.cos(p.rot));
      c.beginPath(); c.ellipse(x, y, Math.max(0.6, s * cw), s, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#9a6a0a'; c.lineWidth = 0.8; c.stroke();
      if (cw > 0.6) { c.fillStyle = '#7a520a'; const hs = s * 0.45 * cw; c.fillRect(x - hs, y - s * 0.45, hs * 2, s * 0.9); }
      break;
    }
    default: break;
  }
}

// debug / tooling hook (scripts/preview-chars.mjs draws the trails strip through it)
if (typeof window !== 'undefined') (window as any).__trailFx = { Fx, TrailFx, TRAIL_IDS };
