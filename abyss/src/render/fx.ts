// Particles, timed spell/impact effects, persistent floor stains and floating combat text.
// All positions are in world units; heights (z) are in iso pixels at zoom 1.
import { Camera, RX, screenDir } from './iso';
import { EFFECT_ART } from './registry';

export type PKind = 'dot' | 'spark' | 'streak' | 'smoke' | 'ember' | 'shard' | 'bone' | 'star' | 'chunk' | 'drop' | 'ice' | 'ash' | 'glint';
export interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; size: number; color: string; kind: PKind; grav: number; add: boolean;
  rot: number; vr: number; stain?: 'splat' | 'blood' | 'frost'; landed?: boolean; drag: number;
}
export interface Effect { kind: string; x: number; y: number; t: number; dur: number; r: number; c: string; ang: number; pts?: number[]; x2?: number; y2?: number; seed: number; power: number; heavy: boolean; data?: unknown }
export interface FloatText { x: number; y: number; text: string; color: string; t: number; dur: number; size: number; vx: number; vy: number; z: number; crit: boolean }
export interface Stain { x: number; y: number; kind: 'blood' | 'splat' | 'scorch' | 'frost' | 'ash' | 'crack' | 'bonepile' | 'crater' | 'slime'; r: number; rot: number; t: number; seed: number; grow: number }

const ELEM_COL: Record<string, string> = { phys: '#f4ecdc', fire: '#ff9a4a', cold: '#9ad8ff', light: '#fff27a', poison: '#9aff7a' };
export const ELEM_GLOW: Record<string, string> = { phys: '255,236,200', fire: '255,140,40', cold: '140,210,255', light: '255,250,150', poison: '140,255,110' };
const TAU = Math.PI * 2;

export class Fx {
  parts: Particle[] = [];
  effects: Effect[] = [];
  texts: FloatText[] = [];
  stains: Stain[] = [];
  low = false;
  numFont = '"Oswald", "Arial Narrow", Impact, sans-serif';

  add(p: Partial<Particle> & { x: number; y: number }): void {
    if (this.parts.length > (this.low ? 300 : 1100)) return;
    const q: Particle = { z: 0, vx: 0, vy: 0, vz: 0, life: 0.6, max: 0.6, size: 2, color: '#fff', kind: 'dot', grav: 0, add: false, rot: Math.random() * TAU, vr: 0, drag: 0, ...p };
    q.max = q.life;
    this.parts.push(q);
  }
  /** Radial (or directional, if dir given) burst. */
  burst(x: number, y: number, n: number, o: Partial<Particle> & { speed?: number; up?: number; dir?: { x: number; y: number }; spread?: number }): void {
    const sp = o.speed ?? 3;
    const count = this.low ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      let a = Math.random() * TAU;
      if (o.dir) a = Math.atan2(o.dir.y, o.dir.x) + (Math.random() - 0.5) * (o.spread ?? 1.2);
      const s = sp * (0.3 + Math.random() * 0.7);
      this.add({ ...o, x: x + (Math.random() - 0.5) * 0.15, y: y + (Math.random() - 0.5) * 0.15, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (o.up ?? 40) * (0.5 + Math.random()), z: o.z ?? 10, life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6), vr: (Math.random() - 0.5) * 18 });
    }
  }
  effect(kind: string, x: number, y: number, dur: number, o: Partial<Effect> = {}): Effect {
    const e: Effect = { kind, x, y, t: 0, dur, r: 1, c: '#fff', ang: 0, seed: Math.random() * 1000, power: 1, heavy: false, ...o };
    this.effects.push(e);
    return e;
  }
  stain(x: number, y: number, kind: Stain['kind'], r: number, grow = 0): void {
    if (this.low && (kind === 'splat')) return;
    this.stains.push({ x, y, kind, r, rot: Math.random() * TAU, t: 0, seed: Math.floor(Math.random() * 1e6), grow });
    if (this.stains.length > 260) this.stains.splice(0, this.stains.length - 260);
  }
  clearWorld(): void { this.stains = []; this.parts = []; this.effects = []; }

  text(x: number, y: number, text: string, color: string, size = 13, dur = 0.9, crit = false, vy = 70): void {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, text, color, t: 0, dur, size, vx: (Math.random() - 0.5) * 50, vy, z: 44, crit });
  }
  dmg(x: number, y: number, v: number, kind: string, elem?: string): void {
    switch (kind) {
      case 'crit': this.text(x, y, `${v}`, '#ffcc33', 25, 1.1, true, 95); break;
      case 'hero': this.text(x, y, `-${v}`, '#ff4a3a', 16, 0.9, false, 55); break;
      case 'block': this.text(x, y, '막기', '#d8e0f0', 13); break;
      case 'dodge': this.text(x, y, '회피', '#c0ffc0', 13); break;
      case 'immune': this.text(x, y, '면역', '#a0a0a0', 12); break;
      case 'gold': this.text(x, y, `+${v}`, '#ffd24a', 13, 0.8, false, 45); break;
      default: if (v > 0) this.text(x, y, `${v}`, ELEM_COL[elem ?? 'phys'] ?? '#fff', 15); break;
    }
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.z += p.vz * dt; p.vz -= p.grav * dt;
      p.rot += p.vr * dt;
      if (p.z < 0) {
        p.z = 0;
        if (!p.landed && p.stain) { p.landed = true; this.stain(p.x, p.y, p.stain, p.stain === 'blood' ? 0.22 + Math.random() * 0.15 : 0.08 + Math.random() * 0.08); }
        p.vz *= -0.28; p.vx *= 0.5; p.vy *= 0.5; p.vr *= 0.5;
        if (p.kind === 'drop') p.life = 0;
      }
      if (p.kind === 'smoke') { p.vx *= 0.97; p.vy *= 0.97; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);
    for (const t of this.texts) { t.t += dt; t.z += t.vy * dt; t.vy -= 170 * dt; if (t.z < 8) { t.z = 8; t.vy = Math.abs(t.vy) * 0.2; } }
    this.texts = this.texts.filter((t) => t.t < t.dur);
    for (const s of this.stains) { s.t += dt; }
  }

  // ------------------------------------------------------------ floor stains (drawn in the floor pass)
  drawStains(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const s of this.stains) {
      const sx = cam.sxOf(s.x, s.y), sy = cam.syOf(s.x, s.y);
      if (sx < -80 || sy < -60 || sx > cam.w + 80 || sy > cam.h + 60) continue;
      const age = s.t;
      const fade = s.kind === 'frost' ? Math.max(0, 1 - age / 14) : s.kind === 'scorch' || s.kind === 'crack' || s.kind === 'crater' ? Math.max(0, 1 - age / 40) : Math.max(0.35, 1 - age / 90);
      if (fade <= 0) continue;
      const grow = s.grow ? Math.min(1, age / s.grow) : 1;
      const rx = s.r * RX * z * (0.35 + 0.65 * grow), ry = rx * 0.5;
      let seed = s.seed;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      c.save();
      c.globalAlpha = fade;
      switch (s.kind) {
        case 'blood': case 'splat': case 'slime': {
          const base = s.kind === 'slime' ? '40,90,30' : '92,6,6';
          c.fillStyle = `rgba(${base},0.78)`;
          const n = s.kind === 'splat' ? 2 : 6;
          c.beginPath();
          for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = rnd() * 0.6; c.ellipse(sx + Math.cos(a) * rx * d, sy + Math.sin(a) * ry * d, rx * (0.35 + rnd() * 0.5), ry * (0.35 + rnd() * 0.5), 0, 0, TAU); }
          c.fill();
          if (s.kind === 'blood') { c.fillStyle = `rgba(${s.kind === 'blood' ? '140,20,16' : base},0.35)`; c.beginPath(); c.ellipse(sx - rx * 0.15, sy - ry * 0.2, rx * 0.35, ry * 0.25, 0, 0, TAU); c.fill(); }
          if (s.kind === 'blood' && !this.low) for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = 1 + rnd() * 0.8; c.fillStyle = `rgba(${base},0.7)`; c.beginPath(); c.ellipse(sx + Math.cos(a) * rx * d, sy + Math.sin(a) * ry * d, 1.4 * z, 0.8 * z, 0, 0, TAU); c.fill(); }
          break;
        }
        case 'scorch': case 'crater': {
          const g = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
          g.addColorStop(0, 'rgba(8,4,2,0.85)'); g.addColorStop(0.6, 'rgba(20,10,4,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.restore(); c.fill();
          if (age < 6) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - age / 6) * 0.6; c.strokeStyle = '#ff7a20'; c.lineWidth = 1.2 * z; for (let i = 0; i < 5; i++) { const a = rnd() * TAU; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * rx * 0.8, sy + Math.sin(a) * ry * 0.8); c.stroke(); } }
          break;
        }
        case 'frost': {
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
          g.addColorStop(0, 'rgba(150,210,255,0.35)'); g.addColorStop(1, 'rgba(150,210,255,0)');
          c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.restore(); c.fill();
          c.strokeStyle = 'rgba(210,240,255,0.55)'; c.lineWidth = 0.8 * z;
          for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = 0.3 + rnd() * 0.7; const x2 = sx + Math.cos(a) * rx * d, y2 = sy + Math.sin(a) * ry * d; c.beginPath(); c.moveTo(x2 - 3 * z, y2); c.lineTo(x2 + 3 * z, y2); c.moveTo(x2, y2 - 1.8 * z); c.lineTo(x2, y2 + 1.8 * z); c.stroke(); }
          break;
        }
        case 'ash': {
          c.fillStyle = 'rgba(20,18,16,0.8)';
          c.beginPath(); for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = rnd() * 0.5; c.ellipse(sx + Math.cos(a) * rx * d, sy + Math.sin(a) * ry * d, rx * (0.3 + rnd() * 0.4), ry * (0.3 + rnd() * 0.4), 0, 0, TAU); } c.fill();
          break;
        }
        case 'crack': {
          c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1.6 * z; c.lineJoin = 'round';
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU + rnd() * 0.6;
            let x = sx, y = sy; c.beginPath(); c.moveTo(x, y);
            for (let k = 1; k <= 4; k++) { x = sx + Math.cos(a + (rnd() - 0.5) * 0.5) * rx * (k / 4); y = sy + Math.sin(a + (rnd() - 0.5) * 0.5) * ry * (k / 4); c.lineTo(x, y); }
            c.stroke();
          }
          break;
        }
        case 'bonepile': {
          c.strokeStyle = 'rgba(214,204,184,0.9)'; c.lineWidth = 1.8 * z; c.lineCap = 'round';
          for (let i = 0; i < 7; i++) { const a = rnd() * TAU, d = rnd() * 0.6, l = (3 + rnd() * 4) * z; const x = sx + Math.cos(a) * rx * d, y = sy + Math.sin(a) * ry * d; const r2 = rnd() * TAU; c.beginPath(); c.moveTo(x - Math.cos(r2) * l, y - Math.sin(r2) * l * 0.5); c.lineTo(x + Math.cos(r2) * l, y + Math.sin(r2) * l * 0.5); c.stroke(); }
          c.fillStyle = 'rgba(220,210,190,0.95)'; c.beginPath(); c.arc(sx + rx * 0.2, sy - 2 * z, 2.8 * z, 0, TAU); c.fill();
          c.fillStyle = '#140c08'; c.fillRect(sx + rx * 0.2 - 1.4 * z, sy - 2.6 * z, 0.9 * z, 0.9 * z); c.fillRect(sx + rx * 0.2 + 0.4 * z, sy - 2.6 * z, 0.9 * z, 0.9 * z);
          break;
        }
      }
      c.restore();
    }
  }

  drawParticles(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const p of this.parts) {
      const sx = cam.sxOf(p.x, p.y), sy = cam.syOf(p.x, p.y) - p.z * z;
      if (sx < -30 || sy < -60 || sx > cam.w + 30 || sy > cam.h + 60) continue;
      const a = Math.max(0, Math.min(1, p.life / p.max));
      c.globalAlpha = p.kind === 'smoke' ? a * 0.42 : p.kind === 'ash' ? a * 0.8 : a;
      if (p.add) c.globalCompositeOperation = 'lighter';
      c.fillStyle = p.color;
      const s = p.size * z * (p.kind === 'smoke' ? 1 + (1 - a) * 2.6 : 1);
      switch (p.kind) {
        case 'spark': case 'ember': c.fillRect(sx - s / 2, sy - s / 2, s, s); break;
        case 'streak': case 'drop': {
          const vx = cam.sxOf(p.x + p.vx, p.y + p.vy) - cam.sxOf(p.x, p.y), vy = cam.syOf(p.x + p.vx, p.y + p.vy) - cam.syOf(p.x, p.y) - p.vz * z;
          const k = p.kind === 'drop' ? 0.03 : 0.045;
          c.strokeStyle = p.color; c.lineWidth = s; c.lineCap = 'round';
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - vx * k, sy - vy * k); c.stroke();
          break;
        }
        case 'shard': case 'bone': case 'ice': case 'chunk': case 'ash': {
          c.save(); c.translate(sx, sy); c.rotate(p.rot);
          if (p.kind === 'chunk') { c.beginPath(); c.moveTo(-s, -s * 0.6); c.lineTo(s * 0.8, -s * 0.8); c.lineTo(s, s * 0.5); c.lineTo(-s * 0.4, s * 0.8); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,120,110,0.35)'; c.fillRect(-s * 0.4, -s * 0.5, s * 0.6, s * 0.3); }
          else if (p.kind === 'ice') { c.beginPath(); c.moveTo(0, -s * 1.6); c.lineTo(s * 0.6, 0); c.lineTo(0, s * 1.6); c.lineTo(-s * 0.6, 0); c.closePath(); c.fill(); }
          else if (p.kind === 'ash') c.fillRect(-s * 0.6, -s * 0.3, s * 1.2, s * 0.6);
          else c.fillRect(-s, -s * 0.35, s * 2, s * 0.7);
          c.restore(); break;
        }
        case 'star': c.beginPath(); c.moveTo(sx, sy - s * 2); c.lineTo(sx + s * 0.5, sy); c.lineTo(sx, sy + s * 2); c.lineTo(sx - s * 0.5, sy); c.closePath(); c.fill(); c.fillRect(sx - s * 1.6, sy - s * 0.25, s * 3.2, s * 0.5); break;
        case 'glint': { c.fillRect(sx - s * 2, sy - s * 0.2, s * 4, s * 0.4); c.fillRect(sx - s * 0.2, sy - s * 2, s * 0.4, s * 4); break; }
        default: c.beginPath(); c.arc(sx, sy, s, 0, TAU); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
  }

  /** Ground-level effects (rings, telegraphs, shockwaves) drawn before actors. */
  drawGround(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const e of this.effects) {
      const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y);
      const k = e.t / e.dur;
      const rx = e.r * RX * z;
      switch (e.kind) {
        case 'shock': {
          const ek = 1 - Math.pow(1 - k, 3);
          c.save(); c.globalCompositeOperation = 'lighter';
          c.globalAlpha = (1 - k) * 0.9;
          const g = c.createRadialGradient(sx, sy, rx * ek * 0.6, sx, sy, rx * ek);
          g.addColorStop(0, `rgba(${e.c},0)`); g.addColorStop(0.75, `rgba(${e.c},0.55)`); g.addColorStop(1, `rgba(${e.c},0)`);
          c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, Math.max(1, rx * ek), 0, TAU); c.restore(); c.fill();
          c.restore(); break;
        }
        case 'dust': {
          c.save(); c.globalAlpha = (1 - k) * 0.55;
          c.strokeStyle = '#8a7a64'; c.lineWidth = 6 * z * (1 - k);
          c.beginPath(); c.ellipse(sx, sy, rx * (0.3 + k * 0.9), rx * 0.5 * (0.3 + k * 0.9), 0, 0, TAU); c.stroke(); c.restore(); break;
        }
        case 'frostnova': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 1.4);
          const rr = rx * Math.min(1, k * 3);
          const g = c.createRadialGradient(sx, sy, rr * 0.55, sx, sy, rr);
          g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.85, 'rgba(170,225,255,0.7)'); g.addColorStop(1, 'rgba(220,245,255,0)');
          c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, Math.max(1, rr), 0, TAU); c.restore(); c.fill();
          c.restore();
          // ice spikes erupting along the ring
          const n = this.low ? 10 : 22;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + e.seed;
            const grow = Math.min(1, k * 3), hgt = (10 + ((i * 37) % 9)) * z * grow * (k > 0.75 ? (1 - k) / 0.25 : 1);
            const px = sx + Math.cos(a) * rx * grow, py = sy + Math.sin(a) * rx * 0.5 * grow;
            const g2 = c.createLinearGradient(px, py - hgt, px, py);
            g2.addColorStop(0, 'rgba(240,250,255,0.95)'); g2.addColorStop(1, 'rgba(90,160,230,0.7)');
            c.fillStyle = g2; c.beginPath(); c.moveTo(px - 2.2 * z, py); c.lineTo(px + (i % 2 ? 1 : -1) * z, py - hgt); c.lineTo(px + 2.2 * z, py); c.closePath(); c.fill();
          }
          break;
        }
        case 'telegraph': {
          c.save(); const pulse = 0.5 + 0.5 * Math.sin(e.t * 18);
          c.globalAlpha = 0.25 + 0.25 * pulse;
          c.fillStyle = e.c; c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, TAU); c.fill();
          c.globalAlpha = 0.8; c.strokeStyle = e.c; c.lineWidth = 2 * z;
          c.beginPath(); c.ellipse(sx, sy, rx * k, rx * 0.5 * k, 0, 0, TAU); c.stroke();
          c.restore(); break;
        }
        case 'telegraphLine': {
          c.save(); c.globalAlpha = 0.5 * (1 - k); c.strokeStyle = '#ff3020'; c.lineWidth = 12 * z; c.lineCap = 'round';
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(cam.sxOf(e.x2!, e.y2!), cam.syOf(e.x2!, e.y2!)); c.stroke(); c.restore(); break;
        }
        case 'portalOpen': case 'shrine': case 'resurrect': case 'levelup': {
          c.save(); c.globalAlpha = (1 - k) * 0.7; c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(sx, sy, 0, sx, sy, 46 * z);
          g.addColorStop(0, e.c); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, 46 * z, 23 * z, 0, 0, TAU); c.fill(); c.restore(); break;
        }
        case 'fireground': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 2) * 0.6;
          const g = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
          g.addColorStop(0, 'rgba(255,160,50,0.8)'); g.addColorStop(0.5, 'rgba(255,80,10,0.4)'); g.addColorStop(1, 'rgba(255,40,0,0)');
          c.fillStyle = g; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.restore(); c.fill(); c.restore(); break;
        }
        default: { const art = EFFECT_ART[e.kind]; if (art?.ground) { c.save(); art.ground(e, { c, cam, z, time: e.t, fx: this, sx, sy, k, rx }); c.restore(); } }
      }
    }
  }

  /** Tall effects drawn after actors (slashes, explosions, lightning, beams). */
  drawAir(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const e of this.effects) {
      const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y);
      const k = e.t / e.dur;
      const rx = e.r * RX * z;
      switch (e.kind) {
        case 'slash': this.drawSlash(c, cam, e); break;
        case 'hitflash': {
          const s = (e.heavy ? 34 : 20) * z * e.power * (0.6 + k * 0.8);
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, 1 - k);
          const cy = sy - 22 * z;
          const g = c.createRadialGradient(sx, cy, 0, sx, cy, s);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, `rgba(${e.c},0.9)`); g.addColorStop(1, `rgba(${e.c},0)`);
          c.fillStyle = g; c.beginPath(); c.arc(sx, cy, s, 0, TAU); c.fill();
          // star rays oriented along the hit direction
          c.translate(sx, cy); c.rotate(e.ang);
          c.fillStyle = '#ffffff';
          const L = s * (e.heavy ? 2.4 : 1.8);
          c.beginPath(); c.moveTo(-L, 0); c.lineTo(0, -s * 0.12); c.lineTo(L * 1.2, 0); c.lineTo(0, s * 0.12); c.closePath(); c.fill();
          c.rotate(Math.PI / 2);
          c.beginPath(); c.moveTo(-L * 0.55, 0); c.lineTo(0, -s * 0.09); c.lineTo(L * 0.55, 0); c.lineTo(0, s * 0.09); c.closePath(); c.fill();
          c.restore(); break;
        }
        case 'explosion': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const ek = 1 - Math.pow(1 - k, 2.2);
          const rr = rx * (0.35 + ek * 0.9);
          const cy = sy - 10 * z - ek * 14 * z;
          if (k < 0.2) { const f = 1 - k / 0.2; c.fillStyle = `rgba(255,250,230,${0.9 * f})`; c.beginPath(); c.ellipse(sx, cy, rr * 0.7, rr * 0.55, 0, 0, TAU); c.fill(); }
          const g = c.createRadialGradient(sx, cy, 0, sx, cy, rr);
          g.addColorStop(0, `rgba(255,245,200,${1 - k})`); g.addColorStop(0.3, `rgba(255,160,50,${0.9 * (1 - k)})`); g.addColorStop(0.7, `rgba(200,50,10,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(80,10,0,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, cy, rr, rr * 0.75, 0, 0, TAU); c.fill();
          // licking flame tongues
          c.fillStyle = `rgba(255,120,30,${0.6 * (1 - k)})`;
          for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + e.seed; const r0 = rr * 0.4, r1 = rr * (0.9 + 0.3 * Math.sin(e.seed + i)); c.beginPath(); c.moveTo(sx + Math.cos(a - 0.2) * r0, cy + Math.sin(a - 0.2) * r0 * 0.7); c.lineTo(sx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7 - 6 * z); c.lineTo(sx + Math.cos(a + 0.2) * r0, cy + Math.sin(a + 0.2) * r0 * 0.7); c.fill(); }
          c.restore(); break;
        }
        case 'frostburst': case 'burst': case 'zapburst': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const rr = rx * (0.3 + k);
          const col = e.kind === 'frostburst' ? '160,220,255' : e.kind === 'zapburst' ? '255,250,160' : '200,160,255';
          const g = c.createRadialGradient(sx, sy - 8 * z, 0, sx, sy - 8 * z, rr);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`); g.addColorStop(0.3, `rgba(${col},${0.8 * (1 - k)})`); g.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 8 * z, rr, rr * 0.7, 0, 0, TAU); c.fill(); c.restore(); break;
        }
        case 'lightning': case 'zap': this.drawLightning(c, cam, e); break;
        case 'meteorFall': {
          if (k > 0.97) break;
          const hgt = (1 - k) * 460 * z;
          c.save(); c.globalCompositeOperation = 'lighter';
          const mx = sx - hgt * 0.35, my = sy - hgt;
          const tail = c.createLinearGradient(mx, my, mx - 90 * z * 0.35, my - 90 * z);
          tail.addColorStop(0, 'rgba(255,160,40,0.9)'); tail.addColorStop(1, 'rgba(255,60,0,0)');
          c.strokeStyle = tail; c.lineWidth = 16 * z; c.lineCap = 'round'; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx - 90 * z * 0.35, my - 90 * z); c.stroke();
          const g = c.createRadialGradient(mx, my, 0, mx, my, 28 * z);
          g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.35, 'rgba(255,150,40,0.95)'); g.addColorStop(1, 'rgba(255,50,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(mx, my, 28 * z, 0, TAU); c.fill();
          c.restore();
          c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(mx, my, 8 * z, 0, TAU); c.fill();
          c.save(); c.globalAlpha = 0.35 + 0.35 * k; c.strokeStyle = '#ff5020'; c.lineWidth = 2 * z; c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, TAU); c.stroke();
          c.globalAlpha = 0.18 + 0.2 * k; c.fillStyle = '#ff3010'; c.beginPath(); c.ellipse(sx, sy, rx * k, rx * 0.5 * k, 0, 0, TAU); c.fill(); c.restore();
          break;
        }
        case 'teleport': case 'blink': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
          const col = e.kind === 'teleport' ? '140,170,255' : '200,120,255';
          const w = 16 * z * (1 - k * 0.7);
          const g = c.createLinearGradient(sx, sy - 90 * z, sx, sy);
          g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.7, `rgba(${col},0.8)`); g.addColorStop(1, 'rgba(255,255,255,0.95)');
          c.fillStyle = g; c.fillRect(sx - w / 2, sy - 90 * z, w, 90 * z);
          c.strokeStyle = `rgba(${col},0.9)`; c.lineWidth = 2 * z; c.beginPath(); c.ellipse(sx, sy, 20 * z * (0.5 + k), 10 * z * (0.5 + k), 0, 0, TAU); c.stroke();
          c.restore(); break;
        }
        case 'levelup': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 1.5);
          const g = c.createLinearGradient(sx, sy - 220 * z, sx, sy);
          g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(1, 'rgba(255,220,120,0.9)');
          c.fillStyle = g; c.fillRect(sx - 20 * z, sy - 220 * z, 40 * z, 220 * z);
          c.strokeStyle = 'rgba(255,230,140,0.8)'; c.lineWidth = 2 * z;
          for (let i = 0; i < 3; i++) { const kk = (k * 2 + i / 3) % 1; c.globalAlpha = (1 - kk) * (1 - k); c.beginPath(); c.ellipse(sx, sy - kk * 120 * z, 28 * z, 12 * z, 0, 0, TAU); c.stroke(); }
          c.restore(); break;
        }
        case 'resurrect': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
          const g = c.createLinearGradient(sx, sy - 60 * z, sx, sy);
          g.addColorStop(0, 'rgba(180,80,255,0)'); g.addColorStop(1, 'rgba(180,80,255,0.8)');
          c.fillStyle = g; c.fillRect(sx - 10 * z, sy - 60 * z, 20 * z, 60 * z); c.restore(); break;
        }
        case 'warcry': {
          c.save(); c.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            const kk = Math.min(1, k * 1.4 - i * 0.18); if (kk <= 0) continue;
            c.globalAlpha = (1 - kk) * 0.8; c.strokeStyle = '#ffcc60'; c.lineWidth = (6 - i * 1.5) * z;
            c.beginPath(); c.ellipse(sx, sy - 18 * z, rx * kk, rx * 0.55 * kk, 0, 0, TAU); c.stroke();
          }
          c.restore(); break;
        }
        case 'afterimage': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.5;
          const g = c.createLinearGradient(sx, sy - 55 * z, sx, sy);
          g.addColorStop(0, 'rgba(90,200,255,0)'); g.addColorStop(0.5, 'rgba(90,200,255,0.6)'); g.addColorStop(1, 'rgba(90,200,255,0.1)');
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 26 * z, 9 * z, 28 * z, 0, 0, TAU); c.fill(); c.restore(); break;
        }
        case 'bossDeath': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 2);
          const g = c.createLinearGradient(sx, sy - 400 * z, sx, sy);
          g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, 'rgba(255,200,120,0.9)');
          const w = (30 + k * 60) * z;
          c.fillStyle = g; c.fillRect(sx - w / 2, sy - 400 * z, w, 400 * z); c.restore(); break;
        }
        default: { const art = EFFECT_ART[e.kind]; if (art?.air) { c.save(); art.air(e, { c, cam, z, time: e.t, fx: this, sx, sy, k, rx }); c.restore(); } }
      }
    }
  }

  private drawSlash(c: CanvasRenderingContext2D, cam: Camera, e: Effect): void {
    const z = cam.zoom;
    const k = e.t / e.dur;
    const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y) - (e.heavy ? 20 : 24) * z;
    const R = e.r * RX * z * 0.95;
    const full = e.data === 'full';
    const d = screenDir(e.ang);
    const base = Math.atan2(d.dy / 0.55, d.dx);
    const span = full ? Math.PI * 2 : e.heavy ? 2.4 : 2.0;
    const sweep = Math.min(1, k / 0.45);
    const fade = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
    const flip = e.seed > 500 ? 1 : -1;
    const a0 = base - flip * span / 2, a1 = a0 + flip * span * sweep;
    const n = 24;
    c.save();
    c.translate(sx, sy); c.scale(1, 0.55);
    c.globalCompositeOperation = 'lighter';
    // crescent: outer arc forward, inner arc back (thick in the middle of the swept part)
    const thick = (e.heavy ? 0.34 : 0.24) * R;
    c.beginPath();
    for (let i = 0; i <= n; i++) { const t = i / n; const a = a0 + (a1 - a0) * t; c.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    for (let i = n; i >= 0; i--) { const t = i / n; const a = a0 + (a1 - a0) * t; const w = thick * Math.pow(t, 0.8); c.lineTo(Math.cos(a) * (R - w), Math.sin(a) * (R - w)); }
    c.closePath();
    const g = c.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
    g.addColorStop(0, `rgba(${e.c},0)`); g.addColorStop(0.75, `rgba(${e.c},${0.55 * fade})`); g.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`);
    c.fillStyle = g; c.fill();
    // bright leading edge
    c.strokeStyle = `rgba(255,255,255,${0.9 * fade})`; c.lineWidth = (e.heavy ? 3 : 2) * z; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, R, Math.min(a0, a1) + (flip > 0 ? Math.abs(a1 - a0) * 0.6 : 0), Math.min(a0, a1) + Math.abs(a1 - a0) * (flip > 0 ? 1 : 0.4)); c.stroke();
    c.restore();
  }

  private drawLightning(c: CanvasRenderingContext2D, cam: Camera, e: Effect): void {
    if (!e.pts || e.pts.length < 4) return;
    const z = cam.zoom, k = e.t / e.dur;
    let seed = e.seed + Math.floor(e.t * 40) * 13;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    const lift = 20 * z;
    const segs: [number, number][][] = [];
    for (let i = 0; i + 3 < e.pts.length; i += 2) {
      const x0 = cam.sxOf(e.pts[i], e.pts[i + 1]), y0 = cam.syOf(e.pts[i], e.pts[i + 1]) - lift;
      const x1 = cam.sxOf(e.pts[i + 2], e.pts[i + 3]), y1 = cam.syOf(e.pts[i + 2], e.pts[i + 3]) - lift;
      const pts: [number, number][] = [[x0, y0]];
      const n = 8; const L = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 1; s < n; s++) { const t = s / n; pts.push([x0 + (x1 - x0) * t + rnd() * L * 0.18, y0 + (y1 - y0) * t + rnd() * L * 0.18]); }
      pts.push([x1, y1]);
      segs.push(pts);
      // branches
      if (!this.low) for (let b = 0; b < 2; b++) {
        const from = pts[1 + Math.floor(Math.abs(rnd()) * (n - 2))];
        const br: [number, number][] = [from];
        let bx = from[0], by = from[1];
        for (let s = 0; s < 3; s++) { bx += rnd() * 30 * z + (x1 - x0) * 0.08; by += rnd() * 30 * z + (y1 - y0) * 0.08; br.push([bx, by]); }
        segs.push(br);
      }
    }
    const a = Math.max(0, 1 - k);
    for (const [w, col] of [[14, `rgba(90,110,255,${0.25 * a})`], [6, `rgba(150,170,255,${0.5 * a})`], [2.4, `rgba(255,255,255,${0.95 * a})`]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = w * z;
      for (const pts of segs) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    }
    c.restore();
  }

  drawTexts(c: CanvasRenderingContext2D, cam: Camera): void {
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const t of this.texts) {
      const k = t.t / t.dur;
      const sx = cam.sxOf(t.x, t.y) + t.vx * t.t, sy = cam.syOf(t.x, t.y) - t.z * cam.zoom;
      const pop = k < 0.1 ? 1 + (0.1 - k) * (t.crit ? 9 : 5) : 1;
      const size = Math.round(t.size * pop * Math.max(0.85, Math.min(1.4, cam.zoom)));
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `${t.crit ? 700 : 600} ${size}px ${this.numFont}`;
      if (t.crit) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.7;
        const g = c.createRadialGradient(sx, sy - size * 0.35, 0, sx, sy - size * 0.35, size * 1.3);
        g.addColorStop(0, 'rgba(255,170,40,0.7)'); g.addColorStop(1, 'rgba(255,80,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(sx, sy - size * 0.35, size * 1.3, 0, TAU); c.fill(); c.restore();
      }
      c.lineWidth = t.crit ? 5 : 3.5; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineJoin = 'round';
      c.strokeText(t.text, sx, sy);
      if (t.crit) {
        const g = c.createLinearGradient(0, sy - size, 0, sy);
        g.addColorStop(0, '#fff6c0'); g.addColorStop(0.5, '#ffcc33'); g.addColorStop(1, '#ff7a10');
        c.fillStyle = g;
      } else c.fillStyle = t.color;
      c.fillText(t.text, sx, sy);
    }
    c.globalAlpha = 1;
  }
}
