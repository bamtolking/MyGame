// Lightweight particle / ring / floating-icon effects (visual only, never touches the simulation).
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'spark' | 'ring' | 'smoke' | 'text' | 'after'; text?: string; rot?: number; alpha?: number }
export class Fx {
  parts: Particle[] = []; intensity = 1; shake = 0;
  private cap = 400;
  add(p: Particle): void { if (this.parts.length < this.cap) this.parts.push(p); }
  burst(x: number, y: number, n: number, color: string, speed = 120, life = 0.4, size = 3, kind: Particle['kind'] = 'dot'): void {
    n = Math.round(n * this.intensity); if (n <= 0) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const s = speed * (0.4 + Math.random() * 0.8); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: size * (0.6 + Math.random() * 0.8), color, kind }); }
  }
  ring(x: number, y: number, color: string, size = 30, life = 0.35): void { this.add({ x, y, vx: 0, vy: 0, life, max: life, size, color, kind: 'ring' }); }
  smoke(x: number, y: number, n: number, color = 'rgba(120,120,130,0.5)'): void { for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 25, life: 0.9, max: 0.9, size: 6 + Math.random() * 6, color, kind: 'smoke' }); }
  text(x: number, y: number, text: string, color = '#fff', life = 1.0): void { this.add({ x, y, vx: 0, vy: -28, life, max: life, size: 13, color, kind: 'text', text }); }
  afterimage(x: number, y: number, rot: number, color: string): void { this.add({ x, y, vx: 0, vy: 0, life: 0.22, max: 0.22, size: 13, color, kind: 'after', rot }); }
  kick(amount: number): void { this.shake = Math.min(6, this.shake + amount * this.intensity); }
  update(dt: number): void {
    const keep: Particle[] = [];
    for (const p of this.parts) { p.life -= dt; if (p.life <= 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'dot' || p.kind === 'spark') { p.vx *= 0.9; p.vy *= 0.9; } keep.push(p); }
    this.parts = keep; this.shake *= 0.85; if (this.shake < 0.1) this.shake = 0;
  }
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const t = p.life / p.max;
      if (p.kind === 'dot') { ctx.globalAlpha = t; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'spark') { ctx.globalAlpha = t; ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); }
      else if (p.kind === 'ring') { ctx.globalAlpha = t * 0.9; ctx.strokeStyle = p.color; ctx.lineWidth = 2 + 2 * t; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - t), 0, Math.PI * 2); ctx.stroke(); }
      else if (p.kind === 'smoke') { ctx.globalAlpha = t * 0.6; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - t * 0.5), 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'text') { ctx.globalAlpha = Math.min(1, t * 2); ctx.fillStyle = p.color; ctx.font = `bold ${p.size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(p.text || '', p.x, p.y); ctx.fillText(p.text || '', p.x, p.y); }
      else if (p.kind === 'after') { ctx.globalAlpha = t * 0.45; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
}
