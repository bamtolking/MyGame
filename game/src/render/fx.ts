// 시각 효과 전용(게임 RNG 와 분리). 파티클 상한과 강도 설정 지원.
export interface Particle { kind: 'spark' | 'ring' | 'text' | 'bolt' | 'puff' | 'gold' | 'zone' | 'beam' | 'cone' | 'swirl' | 'label' | 'shock'; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; text?: string; pts?: number[]; r?: number; a?: number; b?: number; color2?: string }

export class Fx {
  parts: Particle[] = [];
  private seed = 12345;
  maxParts = 320;
  level = 2; // 0 최소, 1 보통, 2 전체
  shakeT = 0; shakeAmt = 0; flashT = 0; flashColor = '#fff';

  rnd(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private get q(): number { return this.level === 2 ? 1 : this.level === 1 ? 0.55 : 0.25; }
  add(p: Particle): void { if (this.parts.length >= this.maxParts) { const i = this.parts.findIndex(x => x.kind === 'spark' || x.kind === 'puff'); if (i >= 0) this.parts.splice(i, 1); else this.parts.shift(); } this.parts.push(p); }

  burst(x: number, y: number, n: number, color: string, speed = 60, size = 2.5, life = 0.5, gravity = true): void {
    n = Math.max(1, Math.round(n * this.q));
    for (let i = 0; i < n; i++) { const a = this.rnd() * Math.PI * 2; const v = speed * (0.4 + this.rnd()); this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: size * (0.6 + this.rnd() * 0.8), color, a: gravity ? 1 : 0 }); }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.35, width = 3): void { this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life, max: life, size: width, color, r }); }
  shock(x: number, y: number, r: number, color: string, life = 0.4): void { this.add({ kind: 'shock', x, y, vx: 0, vy: 0, life, max: life, size: 0, color, r }); }
  zone(x: number, y: number, r: number, color: string, life: number): void { this.add({ kind: 'zone', x, y, vx: 0, vy: 0, life, max: life, size: 0, color, r }); }
  text(x: number, y: number, text: string, color: string, size = 11, life = 0.7): void { this.add({ kind: 'text', x, y, vx: 0, vy: -26, life, max: life, size, color, text }); }
  label(x: number, y: number, text: string, color: string, life = 1.1): void { this.add({ kind: 'label', x, y, vx: 0, vy: -14, life, max: life, size: 11, color, text }); }
  bolt(pts: number[], color: string, life = 0.22, width = 2): void { this.add({ kind: 'bolt', x: 0, y: 0, vx: 0, vy: 0, life, max: life, size: width, color, pts }); }
  beam(x: number, y: number, x2: number, y2: number, width: number, color: string, color2: string, life = 0.18): void { this.add({ kind: 'beam', x, y, vx: 0, vy: 0, life, max: life, size: width, color, color2, pts: [x2, y2] }); }
  cone(x: number, y: number, angle: number, spread: number, range: number, color: string, life = 0.35): void { this.add({ kind: 'cone', x, y, vx: 0, vy: 0, life, max: life, size: 0, color, a: angle, b: spread, r: range }); }
  swirl(x: number, y: number, r: number, color: string, life: number, fire = false): void { this.add({ kind: 'swirl', x, y, vx: 0, vy: 0, life, max: life, size: fire ? 1 : 0, color, r }); }
  puff(x: number, y: number, color: string, size = 8, life = 0.5): void { if (this.level === 0) return; this.add({ kind: 'puff', x, y, vx: (this.rnd() - 0.5) * 10, vy: -12, life, max: life, size, color }); }
  gold(x: number, y: number, amount: number): void { this.add({ kind: 'gold', x, y, vx: 0, vy: -30, life: 0.9, max: 0.9, size: 11, color: '#ffd54f', text: `+${amount}` }); }
  shake(amt: number, t = 0.25): void { if (this.level === 0) return; if (this.level === 1) amt *= 0.5; this.shakeAmt = Math.max(this.shakeAmt, amt); this.shakeT = Math.max(this.shakeT, t); }
  flash(t = 0.12, color = '#fff'): void { if (this.level < 2) return; this.flashT = Math.max(this.flashT, t); this.flashColor = color; }

  update(dt: number): void {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    if (this.flashT > 0) this.flashT -= dt;
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt; if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') { p.vx *= 0.92; p.vy = p.vy * 0.92 + (p.a ? 40 * dt : 0); }
      if (p.kind === 'puff') p.size += 14 * dt;
      keep.push(p);
    }
    this.parts = keep;
  }

  draw(c: CanvasRenderingContext2D, time: number): void {
    for (const p of this.parts) {
      const k = p.life / p.max;
      switch (p.kind) {
        case 'spark': c.globalAlpha = k; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill(); break;
        case 'ring': { const r = (p.r ?? 20) * (1 - k * 0.6 + 0.4); c.globalAlpha = k; c.strokeStyle = p.color; c.lineWidth = p.size; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.stroke(); break; }
        case 'shock': { const r = (p.r ?? 20) * (1.15 - k); c.globalAlpha = k * 0.8; c.strokeStyle = p.color; c.lineWidth = 6 * k + 1; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.stroke(); c.globalAlpha = k * 0.25; c.fillStyle = p.color; c.fill(); break; }
        case 'zone': c.globalAlpha = Math.min(0.35, k * 0.5); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.r ?? 20, 0, Math.PI * 2); c.fill(); break;
        case 'text': case 'gold': c.globalAlpha = Math.min(1, k * 1.5); c.font = `bold ${p.size}px system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y); break;
        case 'label': { c.globalAlpha = Math.min(1, k * 2); c.font = `bold ${p.size}px system-ui, sans-serif`; c.textAlign = 'center'; const w = c.measureText(p.text!).width + 12; c.fillStyle = 'rgba(10,8,25,0.78)'; c.beginPath(); c.roundRect(p.x - w / 2, p.y - 10, w, 15, 6); c.fill(); c.strokeStyle = p.color; c.lineWidth = 1.2; c.stroke(); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y + 1.5); break; }
        case 'bolt': { const pts = p.pts!; c.globalAlpha = k; c.strokeStyle = p.color; c.lineWidth = p.size; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) { const mx = (pts[i - 2] + pts[i]) / 2 + (this.rnd() - 0.5) * 8, my = (pts[i - 1] + pts[i + 1]) / 2 + (this.rnd() - 0.5) * 8; c.lineTo(mx, my); c.lineTo(pts[i], pts[i + 1]); } c.stroke(); c.globalAlpha = k * 0.4; c.lineWidth = p.size * 3; c.stroke(); break; }
        case 'beam': { const [x2, y2] = p.pts!; c.globalAlpha = k; c.lineCap = 'round'; c.strokeStyle = p.color; c.lineWidth = p.size; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = p.color2 || '#fff'; c.lineWidth = Math.max(1.5, p.size * 0.35); c.stroke(); c.globalAlpha = k * 0.3; c.strokeStyle = p.color; c.lineWidth = p.size * 2; c.stroke(); break; }
        case 'cone': { c.globalAlpha = k * 0.7; const a = p.a!, sp = p.b!, r = (p.r ?? 60) * Math.min(1, (1 - k) * 4 + 0.3); const g = c.createRadialGradient(p.x, p.y, 4, p.x, p.y, r); g.addColorStop(0, '#fff59d'); g.addColorStop(0.5, p.color); g.addColorStop(1, 'rgba(255,87,34,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(p.x, p.y); c.arc(p.x, p.y, r, a - sp / 2, a + sp / 2); c.closePath(); c.fill(); break; }
        case 'swirl': { const fire = p.size === 1; const r = p.r ?? 40; c.globalAlpha = Math.min(1, k * 2) * 0.85; c.lineWidth = fire ? 3 : 2.2; for (let i = 0; i < 3; i++) { c.strokeStyle = fire ? (i % 2 ? '#ff6d00' : '#ffab40') : (i % 2 ? p.color : '#e1bee7'); c.beginPath(); const rot = time * (fire ? 9 : 6) + i * 2.1; for (let t = 0; t <= 1; t += 0.05) { const rr = r * (0.15 + t * 0.85), aa = rot + t * 4.5; const x = p.x + Math.cos(aa) * rr, y = p.y + Math.sin(aa) * rr * 0.75; if (t === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); } if (fire) { c.globalAlpha = k * 0.3; c.fillStyle = '#ff3d00'; c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.75, 0, 0, Math.PI * 2); c.fill(); } break; }
        case 'puff': c.globalAlpha = k * 0.6; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill(); break;
      }
    }
    c.globalAlpha = 1;
  }
}

/** 병합 피해 숫자: 적별로 짧은 시간 동안 합산해 한 번에 표시. */
export class DmgNumbers {
  private acc = new Map<number, { x: number; y: number; dmg: number; t: number }>();
  enabled = true;
  push(enemy: number, x: number, y: number, dmg: number): void {
    if (!this.enabled || dmg < 0.5) return;
    const a = this.acc.get(enemy);
    if (a) { a.dmg += dmg; a.x = x; a.y = y; } else this.acc.set(enemy, { x, y, dmg, t: 0.3 });
  }
  flush(dt: number, fx: Fx): void {
    for (const [id, a] of this.acc) { a.t -= dt; if (a.t <= 0) { const v = Math.round(a.dmg); fx.text(a.x + (fx.rnd() - 0.5) * 10, a.y - 14, String(v), v >= 100 ? '#ffab40' : '#fff', v >= 100 ? 13 : 10, 0.6); this.acc.delete(id); } }
  }
  clear(): void { this.acc.clear(); }
}
