// 시각 효과: 투사체, 파티클, 떠오르는 숫자/문구, 링 플래시. 논리 좌표(400×300) 기준.
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; gravity: number }
export interface Shot { x1: number; y1: number; x2: number; y2: number; t: number; dur: number; kind: string; color: string; chain?: { x: number; y: number }[] }
export interface Float { x: number; y: number; text: string; t: number; dur: number; color: string; size: number }
export interface Ring { x: number; y: number; r0: number; r1: number; t: number; dur: number; color: string; width: number }

export class Fx {
  particles: Particle[] = []; shots: Shot[] = []; floats: Float[] = []; rings: Ring[] = [];
  low = false;
  clear(): void { this.particles = []; this.shots = []; this.floats = []; this.rings = []; }
  burst(x: number, y: number, n: number, color: string, speed = 60, size = 2.5, life = 0.5, gravity = 0): void {
    if (this.low) n = Math.ceil(n / 2);
    if (this.particles.length > 600) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8); this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: size * (0.6 + Math.random() * 0.8), color, gravity }); }
  }
  shot(x1: number, y1: number, x2: number, y2: number, kind: string, color: string, chain?: { x: number; y: number }[]): void {
    if (this.shots.length > 120) this.shots.shift();
    const dur = kind === 'bolt' || kind === 'dragon' ? 0.16 : kind === 'wind' || kind === 'shadow' ? 0.09 : 0.14;
    this.shots.push({ x1, y1, x2, y2, t: 0, dur, kind, color, chain });
  }
  float(x: number, y: number, text: string, color = '#ffd76a', size = 11, dur = 0.9): void { if (this.floats.length > 40) this.floats.shift(); this.floats.push({ x, y, text, t: 0, dur, color, size }); }
  ring(x: number, y: number, r0: number, r1: number, color: string, dur = 0.5, width = 2): void { this.rings.push({ x, y, r0, r1, t: 0, dur, color, width }); }
  update(dt: number): void {
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.vx *= 0.96; p.vy *= 0.96; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const s of this.shots) s.t += dt; this.shots = this.shots.filter(s => s.t < s.dur + 0.08);
    for (const f of this.floats) f.t += dt; this.floats = this.floats.filter(f => f.t < f.dur);
    for (const r of this.rings) r.t += dt; this.rings = this.rings.filter(r => r.t < r.dur);
  }
  draw(ctx: CanvasRenderingContext2D): void {
    for (const s of this.shots) {
      const k = Math.min(1, s.t / s.dur);
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 2;
      if (s.kind === 'bolt' || s.kind === 'dragon') {
        ctx.globalAlpha = 1 - k * 0.8; ctx.lineWidth = s.kind === 'dragon' ? 3 : 2;
        this.zig(ctx, s.x1, s.y1, s.x2, s.y2);
        if (s.chain) { let px = s.x2, py = s.y2; for (const c of s.chain) { this.zig(ctx, px, py, c.x, c.y); px = c.x; py = c.y; } }
        ctx.globalAlpha = 1;
      } else {
        const x = s.x1 + (s.x2 - s.x1) * k, y = s.y1 + (s.y2 - s.y1) * k;
        if (s.kind === 'wind' || s.kind === 'shadow') { // 수리검
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.t * 40); ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a + Math.PI / 4) * 1.5, Math.sin(a + Math.PI / 4) * 1.5); } ctx.closePath(); ctx.fill(); ctx.restore();
        } else if (s.kind === 'fire' || s.kind === 'titan') {
          ctx.beginPath(); ctx.arc(x, y, s.kind === 'titan' ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x - (s.x2 - s.x1) * 0.04, y - (s.y2 - s.y1) * 0.04, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        } else if (s.kind === 'ice' || s.kind === 'queen') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(s.y2 - s.y1, s.x2 - s.x1)); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -2.5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 2.5); ctx.closePath(); ctx.fill(); ctx.restore();
        } else { // earth: 바위 포물선
          const h = Math.sin(k * Math.PI) * 18; ctx.beginPath(); ctx.arc(x, y - h, 4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    for (const r of this.rings) { const k = r.t / r.dur; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = r.width; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const p of this.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.floats) { const k = f.t / f.dur; ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; ctx.font = `bold ${f.size}px system-ui, sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(f.text, f.x, f.y - k * 22); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - k * 22); }
    ctx.globalAlpha = 1;
  }
  private zig(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1; const nx = -dy / len, ny = dx / len; const n = Math.max(2, Math.round(len / 14));
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let i = 1; i < n; i++) { const t = i / n; const off = ((i % 2) ? 1 : -1) * (3 + Math.random() * 3); ctx.lineTo(x1 + dx * t + nx * off, y1 + dy * t + ny * off); }
    ctx.lineTo(x2, y2); ctx.stroke();
  }
}
