// Particles, timed spell effects and floating combat text. All positions are in world units.
import { Camera, RX } from './iso';

export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'spark' | 'smoke' | 'ember' | 'shard' | 'bone' | 'star' | 'ring'; grav: number; add: boolean }
export interface Effect { kind: string; x: number; y: number; t: number; dur: number; r: number; c: string; pts?: number[]; x2?: number; y2?: number; seed: number }
export interface FloatText { x: number; y: number; text: string; color: string; t: number; dur: number; size: number; vx: number }

const ELEM_COL: Record<string, string> = { phys: '#f0e8d8', fire: '#ff8a3a', cold: '#8ad0ff', light: '#fff27a', poison: '#8aff6a' };

export class Fx {
  parts: Particle[] = [];
  effects: Effect[] = [];
  texts: FloatText[] = [];
  low = false;

  add(p: Partial<Particle> & { x: number; y: number }): void {
    if (this.parts.length > (this.low ? 250 : 700)) return;
    const q: Particle = { z: 0, vx: 0, vy: 0, vz: 0, life: 0.6, max: 0.6, size: 2, color: '#fff', kind: 'dot', grav: 0, add: false, ...p };
    q.max = q.life;
    this.parts.push(q);
  }
  burst(x: number, y: number, n: number, o: Partial<Particle> & { speed?: number; up?: number }): void {
    const sp = o.speed ?? 3;
    for (let i = 0; i < (this.low ? Math.ceil(n / 2) : n); i++) {
      const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7);
      this.add({ ...o, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (o.up ?? 40) * (0.5 + Math.random()), z: o.z ?? 10, life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6) });
    }
  }
  effect(kind: string, x: number, y: number, dur: number, o: Partial<Effect> = {}): void {
    this.effects.push({ kind, x, y, t: 0, dur, r: 1, c: '#fff', seed: Math.random() * 1000, ...o });
  }
  text(x: number, y: number, text: string, color: string, size = 13, dur = 0.9): void {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, text, color, t: 0, dur, size, vx: (Math.random() - 0.5) * 0.6 });
  }
  dmg(x: number, y: number, v: number, kind: string, elem?: string): void {
    switch (kind) {
      case 'crit': this.text(x, y, `${v}!`, '#ffd040', 17, 1.0); break;
      case 'hero': this.text(x, y, `-${v}`, '#ff4a3a', 14); break;
      case 'block': this.text(x, y, '막기', '#c8d0e0', 12); break;
      case 'dodge': this.text(x, y, '회피', '#c0ffc0', 12); break;
      case 'immune': this.text(x, y, '면역', '#a0a0a0', 12); break;
      case 'gold': this.text(x, y, `+${v} 금화`, '#ffd24a', 12, 0.8); break;
      default: if (v > 0) this.text(x, y, `${v}`, ELEM_COL[elem ?? 'phys'] ?? '#fff', 13); break;
    }
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.z += p.vz * dt; p.vz -= p.grav * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      if (p.kind === 'smoke') { p.vx *= 0.97; p.vy *= 0.97; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.dur);
  }

  drawParticles(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const p of this.parts) {
      const sx = cam.sxOf(p.x, p.y), sy = cam.syOf(p.x, p.y) - p.z * z;
      if (sx < -20 || sy < -40 || sx > cam.w + 20 || sy > cam.h + 40) continue;
      const a = Math.max(0, Math.min(1, p.life / p.max));
      c.globalAlpha = p.kind === 'smoke' ? a * 0.45 : a;
      if (p.add) c.globalCompositeOperation = 'lighter';
      c.fillStyle = p.color;
      const s = p.size * z * (p.kind === 'smoke' ? 1 + (1 - a) * 2.5 : 1);
      switch (p.kind) {
        case 'spark': case 'ember': c.fillRect(sx - s / 2, sy - s / 2, s, s); break;
        case 'shard': case 'bone': c.save(); c.translate(sx, sy); c.rotate(p.life * 12); c.fillRect(-s, -s * 0.35, s * 2, s * 0.7); c.restore(); break;
        case 'star': c.beginPath(); c.moveTo(sx, sy - s * 2); c.lineTo(sx + s * 0.5, sy); c.lineTo(sx, sy + s * 2); c.lineTo(sx - s * 0.5, sy); c.closePath(); c.fill(); c.fillRect(sx - s * 1.6, sy - s * 0.25, s * 3.2, s * 0.5); break;
        default: c.beginPath(); c.arc(sx, sy, s, 0, Math.PI * 2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
  }

  /** Ground-level effects (rings, telegraphs) drawn before actors. */
  drawGround(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const e of this.effects) {
      const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y);
      const k = e.t / e.dur;
      const rx = e.r * RX * z;
      switch (e.kind) {
        case 'stomp': case 'cleave': case 'warcry': {
          c.save(); c.globalAlpha = (1 - k) * (e.kind === 'warcry' ? 0.7 : 0.8);
          c.strokeStyle = e.kind === 'warcry' ? '#ffcc60' : e.kind === 'cleave' ? '#e0e0f0' : '#b09070';
          c.lineWidth = (e.kind === 'cleave' ? 5 : 4) * z * (1 - k * 0.6);
          c.beginPath(); c.ellipse(sx, sy, rx * (0.3 + k * 0.8), rx * 0.5 * (0.3 + k * 0.8), 0, 0, Math.PI * 2); c.stroke();
          c.restore(); break;
        }
        case 'frostnova': {
          c.save(); c.globalAlpha = (1 - k) * 0.8; c.globalCompositeOperation = 'lighter';
          const rr = rx * Math.min(1, k * 3);
          const g = c.createRadialGradient(sx, sy, rr * 0.6, sx, sy, rr);
          g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.8, 'rgba(160,220,255,0.6)'); g.addColorStop(1, 'rgba(220,240,255,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, Math.PI * 2); c.fill();
          c.restore(); break;
        }
        case 'telegraph': {
          c.save(); const pulse = 0.5 + 0.5 * Math.sin(e.t * 18);
          c.globalAlpha = 0.25 + 0.25 * pulse;
          c.fillStyle = e.c; c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.8; c.strokeStyle = e.c; c.lineWidth = 2 * z;
          c.beginPath(); c.ellipse(sx, sy, rx * k, rx * 0.5 * k, 0, 0, Math.PI * 2); c.stroke();
          c.restore(); break;
        }
        case 'telegraphLine': {
          c.save(); c.globalAlpha = 0.5 * (1 - k); c.strokeStyle = '#ff3020'; c.lineWidth = 10 * z; c.lineCap = 'round';
          c.beginPath(); c.moveTo(sx, sy); c.lineTo(cam.sxOf(e.x2!, e.y2!), cam.syOf(e.x2!, e.y2!)); c.stroke(); c.restore(); break;
        }
        case 'scorch': {
          c.save(); c.globalAlpha = 0.5 * (1 - k); c.fillStyle = '#100804';
          c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.fill(); c.restore(); break;
        }
        case 'portalOpen': case 'shrine': case 'resurrect': case 'levelup': {
          c.save(); c.globalAlpha = (1 - k) * 0.7; c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(sx, sy, 0, sx, sy, 40 * z);
          g.addColorStop(0, e.c); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, 40 * z, 20 * z, 0, 0, Math.PI * 2); c.fill(); c.restore(); break;
        }
      }
    }
  }

  /** Tall effects drawn after actors. */
  drawAir(c: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const e of this.effects) {
      const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y);
      const k = e.t / e.dur;
      const rx = e.r * RX * z;
      switch (e.kind) {
        case 'explosion': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const rr = rx * (0.4 + k * 0.8);
          const g = c.createRadialGradient(sx, sy - 8 * z, 0, sx, sy - 8 * z, rr);
          g.addColorStop(0, `rgba(255,240,180,${1 - k})`); g.addColorStop(0.35, `rgba(255,140,40,${0.8 * (1 - k)})`); g.addColorStop(1, 'rgba(120,20,0,0)');
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 8 * z, rr, rr * 0.7, 0, 0, Math.PI * 2); c.fill();
          c.restore(); break;
        }
        case 'frostburst': case 'burst': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const rr = rx * (0.3 + k);
          const col = e.kind === 'frostburst' ? '160,220,255' : '200,160,255';
          const g = c.createRadialGradient(sx, sy - 6 * z, 0, sx, sy - 6 * z, rr);
          g.addColorStop(0, `rgba(${col},${0.9 * (1 - k)})`); g.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 6 * z, rr, rr * 0.6, 0, 0, Math.PI * 2); c.fill(); c.restore(); break;
        }
        case 'lightning': {
          if (!e.pts) break;
          c.save(); c.globalCompositeOperation = 'lighter';
          for (const [w, col] of [[6, 'rgba(120,140,255,0.35)'], [2.2, 'rgba(230,240,255,0.95)']] as [number, string][]) {
            c.strokeStyle = col; c.lineWidth = w * z * (1 - k * 0.5); c.lineJoin = 'round';
            c.beginPath();
            let seed = e.seed + Math.floor(e.t * 30);
            const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
            for (let i = 0; i + 3 < e.pts.length; i += 2) {
              const x0 = cam.sxOf(e.pts[i], e.pts[i + 1]), y0 = cam.syOf(e.pts[i], e.pts[i + 1]) - 18 * z;
              const x1 = cam.sxOf(e.pts[i + 2], e.pts[i + 3]), y1 = cam.syOf(e.pts[i + 2], e.pts[i + 3]) - 18 * z;
              if (i === 0) c.moveTo(x0, y0);
              const n = 6;
              for (let s = 1; s <= n; s++) { const tt = s / n; c.lineTo(x0 + (x1 - x0) * tt + (s < n ? rnd() * 16 * z : 0), y0 + (y1 - y0) * tt + (s < n ? rnd() * 16 * z : 0)); }
            }
            c.stroke();
          }
          c.restore(); break;
        }
        case 'meteorFall': {
          if (k > 0.95) break;
          const hgt = (1 - k) * 420 * z;
          c.save(); c.globalCompositeOperation = 'lighter';
          const mx = sx - hgt * 0.35, my = sy - hgt;
          const g = c.createRadialGradient(mx, my, 0, mx, my, 22 * z);
          g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.4, 'rgba(255,140,40,0.9)'); g.addColorStop(1, 'rgba(255,60,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(mx, my, 22 * z, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(255,120,30,0.5)'; c.lineWidth = 10 * z; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx - 60 * z * 0.35, my - 60 * z); c.stroke();
          c.restore();
          c.save(); c.globalAlpha = 0.35 + 0.3 * k; c.strokeStyle = '#ff5020'; c.lineWidth = 2 * z; c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.stroke(); c.restore();
          break;
        }
        case 'teleport': case 'blink': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
          const col = e.kind === 'teleport' ? '140,160,255' : '200,120,255';
          const g = c.createLinearGradient(sx, sy - 60 * z, sx, sy);
          g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},0.9)`);
          c.fillStyle = g; c.fillRect(sx - 10 * z * (1 - k), sy - 60 * z, 20 * z * (1 - k), 60 * z); c.restore(); break;
        }
        case 'levelup': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 1.5);
          const g = c.createLinearGradient(sx, sy - 160 * z, sx, sy);
          g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(1, 'rgba(255,220,120,0.9)');
          c.fillStyle = g; c.fillRect(sx - 16 * z, sy - 160 * z, 32 * z, 160 * z); c.restore(); break;
        }
        case 'resurrect': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
          const g = c.createLinearGradient(sx, sy - 50 * z, sx, sy);
          g.addColorStop(0, 'rgba(180,80,255,0)'); g.addColorStop(1, 'rgba(180,80,255,0.8)');
          c.fillStyle = g; c.fillRect(sx - 8 * z, sy - 50 * z, 16 * z, 50 * z); c.restore(); break;
        }
        case 'bash': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
          c.strokeStyle = '#ffe0a0'; c.lineWidth = 3 * z;
          for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + e.seed; const r0 = 6 * z, r1 = (10 + k * 14) * z; c.beginPath(); c.moveTo(sx + Math.cos(a) * r0, sy - 20 * z + Math.sin(a) * r0); c.lineTo(sx + Math.cos(a) * r1, sy - 20 * z + Math.sin(a) * r1); c.stroke(); }
          c.restore(); break;
        }
      }
    }
  }

  drawTexts(c: CanvasRenderingContext2D, cam: Camera): void {
    c.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.t / t.dur;
      const sx = cam.sxOf(t.x, t.y) + t.vx * k * 30, sy = cam.syOf(t.x, t.y) - (46 + k * 34) * cam.zoom;
      const pop = k < 0.12 ? 1 + (0.12 - k) * 4 : 1;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `bold ${Math.round(t.size * pop * Math.max(0.8, cam.zoom))}px "Nanum Myeongjo", Georgia, serif`;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(t.text, sx, sy);
      c.fillStyle = t.color; c.fillText(t.text, sx, sy);
    }
    c.globalAlpha = 1;
  }
}
