// Particles, floating text, screen shake. World-space unless noted. Visual-only randomness (never the sim RNG).
export interface Particle { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'star' | 'chunk' | 'ring'; rot: number; vr: number }
export interface Popup { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number; screen: boolean }

let seed = 1234567;
export function vrand(): number { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

export class Fx {
  parts: Particle[] = [];
  pops: Popup[] = [];
  shake = 0; shakeX = 0; shakeY = 0;
  quality = 1;           // 0.4 on low-fx
  reduceMotion = false;

  burst(x: number, y: number, n: number, color: string, speed = 260, kind: Particle['kind'] = 'dot', size = 5, g = 900): void {
    const cnt = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < cnt && this.parts.length < 500; i++) {
      const a = vrand() * Math.PI * 2; const v = speed * (0.35 + vrand() * 0.65);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g, life: 0, max: 0.45 + vrand() * 0.4, size: size * (0.6 + vrand() * 0.8), color, kind, rot: vrand() * 6, vr: (vrand() - 0.5) * 16 });
    }
  }
  ring(x: number, y: number, color: string, size = 30): void {
    if (this.parts.length < 500) this.parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0, max: 0.35, size, color, kind: 'ring', rot: 0, vr: 0 });
  }
  text(x: number, y: number, text: string, color = '#fff', size = 18, screen = false, life = 0.8): void {
    if (this.pops.length > 40) this.pops.shift();
    this.pops.push({ x, y, vy: screen ? -20 : -90, life: 0, max: life, text, color, size, screen });
  }
  kick(amount: number): void { if (!this.reduceMotion) this.shake = Math.max(this.shake, amount); }

  update(dt: number): void {
    for (const p of this.parts) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const p of this.pops) { p.life += dt; p.y += p.vy * dt; p.vy *= 0.94; }
    this.pops = this.pops.filter(p => p.life < p.max);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 30);
      this.shakeX = (vrand() - 0.5) * this.shake * 2; this.shakeY = (vrand() - 0.5) * this.shake * 2;
    } else { this.shakeX = 0; this.shakeY = 0; }
  }

  drawWorld(c: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
      c.fillStyle = p.color; c.strokeStyle = p.color;
      if (p.kind === 'ring') { c.lineWidth = 4 * k; c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - k), 0, Math.PI * 2); c.stroke(); continue; }
      if (p.kind === 'star') { star(c, p.x, p.y, p.size * (0.5 + k * 0.5), p.rot); continue; }
      if (p.kind === 'chunk') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); c.restore(); continue; }
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    for (const p of this.pops) if (!p.screen) popText(c, p);
  }
  drawScreen(c: CanvasRenderingContext2D): void { for (const p of this.pops) if (p.screen) popText(c, p); }
}

function popText(c: CanvasRenderingContext2D, p: Popup): void {
  const k = p.life / p.max;
  const s = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
  c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
  c.font = `900 ${Math.round(p.size * s)}px system-ui, "Noto Sans KR", sans-serif`;
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
