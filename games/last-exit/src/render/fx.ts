// 파티클·흔들림·떠오르는 글자·전기 빔. 시각 전용 난수(게임 결과와 무관).
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'ring' | 'text' | 'trail' | 'flash' | 'shard'; text?: string; grav?: number }
interface Beam { pts: number[]; life: number; max: number; tier: number; seed: number }
export class Fx {
  ps: P[] = []; beams: Beam[] = [];
  shake = 0; shakeOn = true; quality = 1;
  private rnd = 12345;
  r(): number { this.rnd = (Math.imul(this.rnd, 1664525) + 1013904223) >>> 0; return this.rnd / 4294967296; }
  add(p: P): void { if (this.ps.length < 600 * this.quality) this.ps.push(p); }
  burst(x: number, y: number, n: number, color: string, speed = 120, size = 3, life = 0.4, kind: P['kind'] = 'spark', grav = 0): void {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) { const a = this.r() * Math.PI * 2; const s = speed * (0.3 + this.r() * 0.7); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + this.r() * 0.4), max: life, size, color, kind, grav }); }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.35): void { this.add({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, kind: 'ring' }); }
  flash(x: number, y: number, r: number, color: string, life = 0.08): void { this.add({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, kind: 'flash' }); }
  text(x: number, y: number, text: string, color: string, life = 0.9): void { this.add({ x, y: y - 10, vx: 0, vy: -28, life, max: life, size: 12, color, kind: 'text', text }); }
  trail(x: number, y: number, color: string, size = 12): void { this.add({ x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, size, color, kind: 'trail' }); }
  beam(pts: number[], tier: number): void { this.beams.push({ pts, life: 0.14, max: 0.14, tier, seed: Math.floor(this.r() * 1e6) }); }
  kick(amount: number): void { if (this.shakeOn) this.shake = Math.min(14, this.shake + amount); }
  update(dt: number): void {
    for (let i = this.ps.length - 1; i >= 0; i--) { const p = this.ps[i]; p.life -= dt; if (p.life <= 0) { this.ps.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += p.grav * dt; if (p.kind === 'spark' || p.kind === 'shard') { p.vx *= 0.9; p.vy *= 0.9; } }
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].life -= dt; if (this.beams[i].life <= 0) this.beams.splice(i, 1); }
    this.shake = Math.max(0, this.shake - dt * 30);
  }
  draw(c: CanvasRenderingContext2D): void {
    for (const b of this.beams) {
      const a = b.life / b.max; const col = b.tier >= 2 ? '#ffe680' : '#9ff0ff';
      let seed = b.seed; const rr = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
      c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = 3 + b.tier; c.shadowColor = col; c.shadowBlur = 8; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) { const x0 = b.pts[i - 2], y0 = b.pts[i - 1], x1 = b.pts[i], y1 = b.pts[i + 1]; const segs = 5; for (let k = 1; k <= segs; k++) { const t = k / segs; const jx = k === segs ? 0 : rr() * 14, jy = k === segs ? 0 : rr() * 14; c.lineTo(x0 + (x1 - x0) * t + jx, y0 + (y1 - y0) * t + jy); } }
      c.stroke(); c.lineWidth = 1; c.strokeStyle = '#fff'; c.shadowBlur = 0; c.stroke(); c.restore();
    }
    for (const p of this.ps) {
      const a = Math.max(0, p.life / p.max);
      c.globalAlpha = a;
      if (p.kind === 'spark' || p.kind === 'shard') { c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (p.kind === 'shard' ? 1 : a), 0, Math.PI * 2); c.fill(); }
      else if (p.kind === 'smoke') { c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (1.5 - a), 0, Math.PI * 2); c.fill(); }
      else if (p.kind === 'ring') { c.strokeStyle = p.color; c.lineWidth = 3 * a + 1; c.beginPath(); c.arc(p.x, p.y, p.size * (1 - a * 0.7), 0, Math.PI * 2); c.stroke(); }
      else if (p.kind === 'flash') { c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, Math.PI * 2); c.fill(); }
      else if (p.kind === 'trail') { c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); c.fill(); }
      else if (p.kind === 'text') { c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(p.text!, p.x, p.y); c.fillStyle = p.color; c.fillText(p.text!, p.x, p.y); }
    }
    c.globalAlpha = 1;
  }
  clear(): void { this.ps.length = 0; this.beams.length = 0; this.shake = 0; }
}
