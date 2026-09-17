// 장식 효과: 파티클(물리 물체 아님), 화면 흔들림, 끊어진 밧줄 끝 반응, 발사체 잔상.
import type { Vec2 } from '../sim/types';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; kind: 'dust' | 'chip' | 'spark' }
interface RopeSnap { a: Vec2; b: Vec2; at: Vec2; t: number }

export const MAX_PARTICLES = 160;

export class Effects {
  particles: Particle[] = [];
  snaps: RopeSnap[] = [];
  trails = new Map<string, Vec2[]>();
  shake = 0;          // 현재 흔들림 세기(px, 월드 단위)
  reduced = false;    // 효과 줄이기 설정
  private seed = 12345; // 시각 효과 전용 난수(물리와 무관)

  private rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

  clear() { this.particles.length = 0; this.snaps.length = 0; this.trails.clear(); this.shake = 0; }

  dust(x: number, y: number, n: number, color = '#c9b79a', speed = 90) {
    if (this.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = this.rnd() * Math.PI * 2, s = speed * (0.3 + this.rnd());
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, maxLife: 0.35 + this.rnd() * 0.35, size: 3 + this.rnd() * 5, color, kind: 'dust' });
    }
  }
  chips(x: number, y: number, n: number, color = '#b98a4e') {
    if (this.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = -Math.PI * (0.2 + this.rnd() * 0.6), s = 120 + this.rnd() * 220;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, maxLife: 0.5 + this.rnd() * 0.4, size: 2 + this.rnd() * 3, color, kind: 'chip' });
    }
  }
  sparks(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = this.rnd() * Math.PI * 2, s = 150 + this.rnd() * 250;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, maxLife: 0.15 + this.rnd() * 0.2, size: 1.5 + this.rnd() * 1.5, color: '#fff3b0', kind: 'spark' });
    }
  }
  ropeSnap(a: Vec2, b: Vec2, at: Vec2) { this.snaps.push({ a, b, at, t: 0 }); this.sparks(at.x, at.y, this.reduced ? 4 : 10); }
  addShake(amount: number) { if (this.reduced) amount *= 0.35; this.shake = Math.min(14, this.shake + amount); }
  trail(id: string, p: Vec2) {
    let t = this.trails.get(id);
    if (!t) { t = []; this.trails.set(id, t); }
    t.push({ x: p.x, y: p.y });
    if (t.length > 9) t.shift();
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.particles.splice(i, 1); continue; }
      p.vy += (p.kind === 'dust' ? 120 : 900) * dt;
      p.vx *= p.kind === 'dust' ? 0.96 : 0.995;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.snaps.length - 1; i >= 0; i--) { this.snaps[i].t += dt; if (this.snaps[i].t > 0.9) this.snaps.splice(i, 1); }
    this.shake = Math.max(0, this.shake - dt * 28);
  }

  shakeOffset(): Vec2 {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: (this.rnd() - 0.5) * 2 * this.shake, y: (this.rnd() - 0.5) * 2 * this.shake };
  }

  drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const k = 1 - p.life / p.maxLife;
      ctx.globalAlpha = p.kind === 'dust' ? k * 0.7 : k;
      ctx.fillStyle = p.color;
      if (p.kind === 'dust') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - k * 0.5), 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /** 끊어진 밧줄 끝이 튕기는 짧은 반응 */
  drawSnaps(ctx: CanvasRenderingContext2D) {
    for (const s of this.snaps) {
      const k = 1 - s.t / 0.9;
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const wob = Math.sin(s.t * 40) * 10 * k;
      for (const [from, to] of [[s.a, s.at], [s.b, s.at]] as [Vec2, Vec2][]) {
        const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
        const cut = 0.35 + 0.25 * (1 - k); // 끝이 짧아지며 사라짐
        const ex = from.x + dx * cut, ey = from.y + dy * cut + s.t * 60 * (from === s.b ? -0.3 : 1);
        ctx.beginPath(); ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(from.x + dx * cut * 0.5 + (-dy / len) * wob, from.y + dy * cut * 0.5 + (dx / len) * wob, ex, ey);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
