// Visual effects: particles, attack visuals, telegraphs, enemy projectiles, floating numbers.
import type { Sprites } from './sprites.ts';
type Ctx = CanvasRenderingContext2D;
export interface Pt { x: number; y: number }
export interface FxHost { entPos(kind: 'p' | 'm', id: number): Pt | null; serverTime(): number; me(): Pt | null; solidAt(x: number, y: number): boolean; players(): Pt[] }

interface Fx { t: number; dur: number; layer: 0 | 1; draw(c: Ctx, k: number, t: number): void; step?(dt: number): boolean }
interface Part { x: number; y: number; vx: number; vy: number; g: number; drag: number; life: number; max: number; size: number; color: string; add: boolean; shape: 0 | 1 | 2; tx?: number; ty?: number; home?: boolean; onDone?: () => void }
interface Txt { x: number; y: number; s: string; color: string; size: number; t: number; dur: number; vy: number; crit: boolean }
interface EProj { x: number; y: number; vx: number; vy: number; r: number; t0: number; life: number; s: number; dead: boolean }
interface Tele { sh: 0 | 1; x: number; y: number; r: number; x2: number; y2: number; t0: number; due: number; s: number }

const TELE_COL = ['255,70,70', '255,150,60', '140,255,90', '90,220,255', '190,140,255', '255,40,60'];

export class FxSystem {
  fx: Fx[] = []; parts: Part[] = []; txt: Txt[] = []; eproj: EProj[] = []; tele: Tele[] = [];
  host: FxHost; spr: Sprites; low = false; time = 0; shake = 0;
  constructor(host: FxHost, spr: Sprites) { this.host = host; this.spr = spr; }

  add(layer: 0 | 1, dur: number, draw: Fx['draw'], step?: Fx['step']): void { this.fx.push({ t: 0, dur, layer, draw, step }); }
  part(p: Partial<Part> & { x: number; y: number }): void {
    if (this.parts.length > (this.low ? 250 : 900)) return;
    this.parts.push({ vx: 0, vy: 0, g: 0, drag: 0.9, life: 0.5, max: 0.5, size: 3, color: '#fff', add: true, shape: 0, ...p } as Part);
  }
  burst(x: number, y: number, n: number, colors: string[], speed = 120, size = 3, life = 0.5, add = true, g = 0): void {
    if (this.low) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7); const l = life * (0.6 + Math.random() * 0.6); this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (g ? speed * 0.4 : 0), g, drag: 0.9, life: l, max: l, size: size * (0.6 + Math.random() * 0.7), color: colors[i % colors.length], add, shape: 0 }); }
  }
  text(x: number, y: number, s: string, color: string, size = 15, crit = false, dur = 0.9): void {
    if (this.txt.length > 60) this.txt.shift();
    this.txt.push({ x: x + (Math.random() - 0.5) * 14, y, s, color, size, t: 0, dur, vy: -46, crit });
  }
  ring(x: number, y: number, r0: number, r1: number, dur: number, color: string, w = 4, layer: 0 | 1 = 1, fill = false): void {
    this.add(layer, dur, (c, k) => { const r = r0 + (r1 - r0) * easeOut(k); c.globalAlpha = 1 - k; c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); if (fill) { c.fillStyle = color; c.globalAlpha = (1 - k) * 0.25; c.fill(); c.globalAlpha = 1 - k; } c.strokeStyle = color; c.lineWidth = w * (1 - k * 0.6); c.stroke(); c.globalAlpha = 1; });
  }
  slash(x: number, y: number, ang: number, range: number, color: string, big = false): void {
    this.add(1, big ? 0.22 : 0.16, (c, k) => {
      const a0 = ang - 1.25 + k * 0.5, a1 = ang - 1.25 + 2.5 * easeOut(Math.min(1, k * 1.6));
      c.globalAlpha = 1 - k; c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(x, y, range * 0.95, a0, a1); c.arc(x, y, range * 0.55, a1, a0, true); c.closePath();
      const g = c.createRadialGradient(x, y, range * 0.5, x, y, range); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, color); g.addColorStop(1, '#ffffff');
      c.fillStyle = g; c.fill(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    });
  }
  /** Projectile that follows an entity (or a fixed point) and fires onArrive. */
  homing(from: Pt, to: { kind: 'p' | 'm'; id: number } | Pt, speed: number, style: 'arrow' | 'paper' | 'wisp' | 'pierce', onArrive?: (p: Pt) => void, curve = 0): void {
    let x = from.x, y = from.y; let last: Pt = 'id' in to ? (this.host.entPos(to.kind, to.id) ?? from) : to; const t0 = this.time;
    const side = curve * (Math.random() < 0.5 ? -1 : 1); let prevX = x, prevY = y;
    this.add(1, 3, (c) => {
      const ang = Math.atan2(y - prevY, x - prevX);
      c.save(); c.translate(x, y); c.rotate(ang);
      if (style === 'arrow') { c.strokeStyle = '#f4ead0'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 0); c.lineTo(4, 0); c.stroke(); c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(8, 0); c.lineTo(2, -3); c.lineTo(2, 3); c.fill(); c.fillStyle = '#e0344d'; c.fillRect(-15, -2, 4, 4); }
      else if (style === 'paper') { c.rotate(this.time * 14); c.fillStyle = '#ffe07a'; c.fillRect(-4, -6, 8, 12); c.fillStyle = '#e0344d'; c.fillRect(-2, -3, 4, 6); }
      else if (style === 'pierce') { c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(-40, 0, 8, 0); g.addColorStop(0, 'rgba(166,255,158,0)'); g.addColorStop(1, '#eaffe6'); c.strokeStyle = g; c.lineWidth = 5; c.beginPath(); c.moveTo(-40, 0); c.lineTo(8, 0); c.stroke(); }
      else { c.globalCompositeOperation = 'lighter'; c.drawImage(this.spr.glow('rgba(111,182,255,0.9)', 16).cv, -16, -16, 32, 32); c.fillStyle = '#eaf6ff'; c.beginPath(); c.arc(0, 0, 4, 0, 6.3); c.fill(); }
      c.restore();
    }, (dt) => {
      if ('id' in to) { const p = this.host.entPos(to.kind, to.id); if (p) last = p; }
      const dx = last.x - x, dy = last.y - y; const d = Math.hypot(dx, dy); const stepL = speed * dt;
      prevX = x; prevY = y;
      if (d <= stepL + 4 || this.time - t0 > 2.5) { onArrive?.(last); return false; }
      const k = Math.min(1, (this.time - t0) * 3); const px = -dy / d * side * (1 - k) * 0.9, py = dx / d * side * (1 - k) * 0.9;
      x += (dx / d + px) * stepL; y += (dy / d + py) * stepL;
      if (style === 'wisp' && !this.low && Math.random() < 0.6) this.part({ x, y, vx: 0, vy: -20, life: 0.3, max: 0.3, size: 3, color: '#6fb6ff' });
      return true;
    });
  }
  bolt(x1: number, y1: number, x2: number, y2: number, color: string, width = 3, dur = 0.22): void {
    const pts: number[] = []; const n = 8; for (let i = 0; i <= n; i++) { const t = i / n; const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 28; pts.push(x1 + (x2 - x1) * t + j, y1 + (y2 - y1) * t + j * 0.3); }
    this.add(1, dur, (c, k) => { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; for (const [w, col] of [[width * 3, color], [width, '#ffffff']] as [number, string][]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; });
  }
  pillar(x: number, y: number, color: string, dur = 1, w = 40, h = 260): void {
    this.add(1, dur, (c, k) => { c.globalCompositeOperation = 'lighter'; const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8; const g = c.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, color); c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - w / 2 * (1 - k * 0.5), y - h, w * (1 - k * 0.5), h); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; });
  }
  telegraph(t: Omit<Tele, 't0'> & { t0?: number }): void { this.tele.push({ t0: this.host.serverTime(), ...t } as Tele); }
  enemyProj(x: number, y: number, vx: number, vy: number, r: number, life: number, s: number, t0: number): void { this.eproj.push({ x, y, vx, vy, r, life, s, t0, dead: false }); }

  update(dt: number): void {
    this.time += dt; this.shake = Math.max(0, this.shake - dt * 30);
    this.fx = this.fx.filter(f => { f.t += dt; if (f.step && !f.step(dt)) return false; return f.t < f.dur; });
    for (const p of this.parts) {
      p.life -= dt;
      if (p.home) { const me = this.host.me(); if (me) { const dx = me.x - p.x, dy = me.y - 12 - p.y; const d = Math.hypot(dx, dy); if (d < 14 && p.life < p.max - 0.25) { p.life = 0; p.onDone?.(); } else { const k = Math.min(1, (p.max - p.life) * 2.2); p.vx = p.vx * (1 - k * 0.2) + (dx / (d || 1)) * 900 * k * dt * 6; p.vy = p.vy * (1 - k * 0.2) + (dy / (d || 1)) * 900 * k * dt * 6; } } }
      p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.txt) { t.t += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.9, dt * 60); }
    this.txt = this.txt.filter(t => t.t < t.dur);
    const now = this.host.serverTime(); const pl = this.host.players();
    for (const p of this.eproj) {
      const el = now - p.t0; if (el > p.life) { p.dead = true; continue; } if (el < 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (this.host.solidAt(p.x, p.y)) p.dead = true;
      for (const q of pl) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < (p.r + 12) ** 2) { p.dead = true; this.burst(p.x, p.y, 6, ['#fff', '#f88'], 80, 2, 0.25); break; }
    }
    this.eproj = this.eproj.filter(p => !p.dead);
    this.tele = this.tele.filter(t => now < t.due + 0.05);
  }

  drawGround(c: Ctx): void {
    const now = this.host.serverTime();
    for (const t of this.tele) {
      const k = Math.max(0, Math.min(1, (now - t.t0) / Math.max(0.05, t.due - t.t0))); const col = TELE_COL[t.s] ?? TELE_COL[0];
      c.globalAlpha = 1;
      if (t.sh === 0) {
        c.beginPath(); c.arc(t.x, t.y, t.r, 0, Math.PI * 2); c.fillStyle = `rgba(${col},0.16)`; c.fill(); c.strokeStyle = `rgba(${col},0.85)`; c.lineWidth = 3; c.stroke();
        c.beginPath(); c.arc(t.x, t.y, t.r * k, 0, Math.PI * 2); c.fillStyle = `rgba(${col},0.32)`; c.fill();
      } else {
        const a = Math.atan2(t.y2 - t.y, t.x2 - t.x), L = Math.hypot(t.x2 - t.x, t.y2 - t.y);
        c.save(); c.translate(t.x, t.y); c.rotate(a); c.fillStyle = `rgba(${col},0.16)`; c.fillRect(0, -t.r / 2, L, t.r); c.strokeStyle = `rgba(${col},0.85)`; c.lineWidth = 3; c.strokeRect(0, -t.r / 2, L, t.r);
        c.fillStyle = `rgba(${col},0.34)`; c.fillRect(0, -t.r / 2, L * k, t.r); c.restore();
      }
    }
    for (const f of this.fx) if (f.layer === 0) f.draw(c, Math.min(1, f.t / f.dur), f.t);
  }
  drawTop(c: Ctx): void {
    for (const f of this.fx) if (f.layer === 1) { c.save(); f.draw(c, Math.min(1, f.t / f.dur), f.t); c.restore(); }
    // enemy projectiles
    const now = this.host.serverTime();
    for (const p of this.eproj) {
      if (now < p.t0) continue; const a = Math.atan2(p.vy, p.vx);
      c.save(); c.translate(p.x, p.y);
      switch (p.s) {
        case 1: c.rotate(a); c.fillStyle = '#1b1426'; c.beginPath(); c.ellipse(0, 0, 11, 4, 0, 0, 6.3); c.fill(); c.strokeStyle = '#8a7aa8'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke(); break;
        case 3: c.fillStyle = '#ffd54a'; c.beginPath(); c.arc(0, 0, 7, 0, 6.3); c.fill(); c.strokeStyle = '#8a5a1a'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#8a5a1a'; c.fillRect(-2, -2, 4, 4); break;
        case 5: c.rotate(a); c.fillStyle = '#b8c0cc'; c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -5); c.lineTo(-8, 5); c.closePath(); c.fill(); c.strokeStyle = '#ff7a2a'; c.lineWidth = 1.5; c.stroke(); break;
        default: {
          const col = p.s === 2 ? 'rgba(255,140,50,0.95)' : p.s === 4 ? 'rgba(180,140,255,0.95)' : 'rgba(90,200,255,0.95)';
          c.globalCompositeOperation = 'lighter'; c.drawImage(this.spr.glow(col, 18).cv, -18, -18, 36, 36); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 4.5, 0, 6.3); c.fill();
        }
      }
      c.restore();
    }
    // particles
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max); c.globalAlpha = Math.min(1, k * 1.5);
      if (p.add) c.globalCompositeOperation = 'lighter';
      c.fillStyle = p.color;
      if (p.shape === 1) { c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); c.fillRect(-p.size * 2, -p.size / 3, p.size * 4, p.size / 1.5); c.restore(); }
      else if (p.shape === 2) { c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.3); c.fill(); }
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
  }
  drawText(c: Ctx): void {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const t of this.txt) {
      const k = t.t / t.dur; const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.7 : k < 0.25 ? 1.3 - (k - 0.12) / 0.13 * 0.3 : 1;
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.font = `900 ${Math.round(t.size * pop)}px system-ui, sans-serif`; c.lineWidth = 4; c.strokeStyle = 'rgba(10,8,20,0.85)'; c.strokeText(t.s, t.x, t.y); c.fillStyle = t.color; c.fillText(t.s, t.x, t.y);
    }
    c.globalAlpha = 1;
  }
}
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
