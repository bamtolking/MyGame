// Visual-only effects. Uses its own RNG (never touches game RNG).
export interface Particle { kind: 'spark' | 'ring' | 'text' | 'bolt' | 'puff' | 'flash' | 'gold' | 'zone'; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; text?: string; pts?: number[]; r?: number; grow?: number }

export class Fx {
  parts: Particle[] = [];
  private seed = 12345;
  maxParts = 350;
  quality = 1; // 0..1 (particle multiplier)
  reduceMotion = false;
  shakeT = 0; shakeAmt = 0; flashT = 0;

  rnd(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  add(p: Particle): void { if (this.parts.length >= this.maxParts) this.parts.shift(); this.parts.push(p); }

  burst(x: number, y: number, n: number, color: string, speed = 60, size = 2.5, life = 0.5): void {
    n = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < n; i++) { const a = this.rnd() * Math.PI * 2; const v = speed * (0.4 + this.rnd()); this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: size * (0.6 + this.rnd() * 0.8), color }); }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.35, width = 3): void { this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life, max: life, size: width, color, r }); }
  zone(x: number, y: number, r: number, color: string, life: number): void { this.add({ kind: 'zone', x, y, vx: 0, vy: 0, life, max: life, size: 0, color, r }); }
  text(x: number, y: number, text: string, color: string, size = 11, life = 0.7): void { this.add({ kind: 'text', x, y, vx: 0, vy: -28, life, max: life, size, color, text }); }
  bolt(pts: number[], color: string, life = 0.22, width = 2): void { this.add({ kind: 'bolt', x: 0, y: 0, vx: 0, vy: 0, life, max: life, size: width, color, pts }); }
  puff(x: number, y: number, color: string, size = 8, life = 0.5): void { this.add({ kind: 'puff', x, y, vx: (this.rnd() - 0.5) * 10, vy: -12, life, max: life, size, color }); }
  gold(x: number, y: number, amount: number): void { this.add({ kind: 'gold', x, y, vx: 0, vy: -30, life: 0.9, max: 0.9, size: 11, color: '#ffd54f', text: `+${amount}` }); }
  shake(amt: number, t = 0.25): void { if (this.reduceMotion) return; this.shakeAmt = Math.max(this.shakeAmt, amt); this.shakeT = Math.max(this.shakeT, t); }
  flash(t = 0.12): void { if (this.reduceMotion) return; this.flashT = Math.max(this.flashT, t); }

  update(dt: number): void {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    if (this.flashT > 0) this.flashT -= dt;
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt; if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') { p.vx *= 0.92; p.vy = p.vy * 0.92 + 40 * dt; }
      if (p.kind === 'puff') { p.size += 14 * dt; }
      keep.push(p);
    }
    this.parts = keep;
  }

  draw(c: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'spark': c.globalAlpha = k; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill(); break;
        case 'ring': { const r = (p.r ?? 20) * (1 - k * 0.6 + 0.4); c.globalAlpha = k; c.strokeStyle = p.color; c.lineWidth = p.size; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.stroke(); break; }
        case 'zone': c.globalAlpha = Math.min(0.35, k * 0.5); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.r ?? 20, 0, Math.PI * 2); c.fill(); break;
        case 'text': case 'gold': c.globalAlpha = Math.min(1, k * 1.5); c.font = `bold ${p.size}px system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y); break;
        case 'bolt': { const pts = p.pts!; c.globalAlpha = k; c.strokeStyle = p.color; c.lineWidth = p.size; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); c.globalAlpha = k * 0.5; c.lineWidth = p.size * 3; c.stroke(); break; }
        case 'puff': c.globalAlpha = k * 0.6; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill(); break;
        case 'flash': break;
      }
    }
    c.globalAlpha = 1;
  }
}

/** Merged damage numbers: accumulate per enemy for a short window. */
export class DmgNumbers {
  private acc = new Map<number, { x: number; y: number; dmg: number; t: number }>();
  enabled = true;
  push(enemy: number, x: number, y: number, dmg: number): void {
    if (!this.enabled || dmg < 0.5) return;
    const a = this.acc.get(enemy);
    if (a) { a.dmg += dmg; a.x = x; a.y = y; } else this.acc.set(enemy, { x, y, dmg, t: 0.25 });
  }
  flush(dt: number, fx: Fx): void {
    for (const [id, a] of this.acc) { a.t -= dt; if (a.t <= 0) { const v = Math.round(a.dmg); fx.text(a.x + (fx.rnd() - 0.5) * 10, a.y - 12, String(v), v >= 200 ? '#ffab40' : '#fff', v >= 200 ? 13 : 10, 0.6); this.acc.delete(id); } }
  }
}
