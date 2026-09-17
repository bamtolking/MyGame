// 파티클·흔들림·이벤트 연출. 시뮬레이션 이벤트를 받아 시각 효과로 바꾼다.
import { BODIES } from '../data/bodies';
import type { GameEvent } from '../sim/types';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'ring' | 'spark' | 'text' | 'line' | 'beam'; text?: string; x2?: number; y2?: number; gravity?: number }

export class Fx {
  parts: Particle[] = [];
  shake = 0; shakeX = 0; shakeY = 0;
  flash = 0; flashColor = '#fff';
  intensity = 1;
  /** 빙의 이동 연출 */
  transfer: { x0: number; y0: number; x1: number; y1: number; t: number } | null = null;
  private rnd(): number { return Math.random(); }
  add(p: Particle): void { if (this.parts.length < 900) this.parts.push(p); }
  burst(x: number, y: number, n: number, color: string, speed: number, life: number, size = 2.5, gravity = 0): void {
    n = Math.round(n * this.intensity);
    for (let i = 0; i < n; i++) { const a = this.rnd() * Math.PI * 2; const s = speed * (0.4 + this.rnd() * 0.8); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: size * (0.6 + this.rnd() * 0.8), color, kind: 'dot', gravity }); }
  }
  ring(x: number, y: number, color: string, size: number, life = 0.35): void { this.add({ x, y, vx: 0, vy: 0, life, max: life, size, color, kind: 'ring' }); }
  text(x: number, y: number, text: string, color: string, life = 0.8): void { this.add({ x, y: y - 10, vx: (this.rnd() - 0.5) * 20, vy: -40, life, max: life, size: 12, color, kind: 'text', text }); }
  line(x: number, y: number, x2: number, y2: number, color: string, life = 0.12, size = 2): void { this.add({ x, y, x2, y2, vx: 0, vy: 0, life, max: life, size, color, kind: 'line' }); }

  handle(ev: GameEvent, time: number): void {
    const x = ev.x ?? 0, y = ev.y ?? 0;
    switch (ev.type) {
      case 'shot': {
        const c = ev.body ? BODIES[ev.body].weapon.color : '#fff';
        if (ev.text === 'windup') break;
        if (ev.text === 'ring') { this.ring(x, y, '#ff9f5c', 50, 0.4); break; }
        const dir = ev.dir ?? 0;
        this.add({ x: x + Math.cos(dir) * 4, y: y + Math.sin(dir) * 4, vx: 0, vy: 0, life: 0.06, max: 0.06, size: ev.body === 'shield' ? 9 : ev.body === 'sniper' ? 7 : 5, color: c, kind: 'dot' });
        if (ev.body === 'shield' || ev.body === 'sniper' || ev.text === 'aimshot') this.shake = Math.max(this.shake, ev.text === 'aimshot' ? 5 : 2.5);
        break;
      }
      case 'hit':
        if (ev.body === 'node' && ev.amount === 0) { this.burst(x, y, 3, '#c8d0dc', 60, 0.2, 1.5); break; }
        this.burst(x, y, 5, ev.body === 'boss' ? '#ffb3b3' : '#fff2c4', 90, 0.25, 2);
        if (ev.amount && ev.amount > 0) this.text(x, y, `${ev.amount}`, '#fff2c4', 0.6);
        break;
      case 'block': {
        const dir = ev.dir ?? 0;
        this.burst(x, y, 6, ev.text === 'shield' ? '#d9a8ff' : '#9fc9ff', 120, 0.2, 2);
        this.add({ x, y, vx: 0, vy: 0, life: 0.12, max: 0.12, size: 14, color: 'rgba(160,200,255,0.9)', kind: 'spark', x2: dir });
        break;
      }
      case 'explode': {
        const r = ev.amount ?? 60;
        this.ring(x, y, '#ffd23c', r, 0.3); this.ring(x, y, '#ff6a3c', r * 0.6, 0.45);
        this.burst(x, y, 26, '#ffb347', 190, 0.5, 3, 120); this.burst(x, y, 12, '#5a3a20', 80, 0.7, 4, 200);
        this.shake = Math.max(this.shake, r > 80 ? 10 : 6); this.flash = 0.08; this.flashColor = '#ffd9a0';
        break;
      }
      case 'die': {
        const c = ev.body ? BODIES[ev.body].color : '#fff';
        if (ev.text === 'collapse') { this.burst(x, y, 22, c, 110, 0.6, 3, 60); this.burst(x, y, 10, '#37e2ff', 140, 0.4, 2); }
        else { this.burst(x, y, 18, c, 130, 0.55, 3, 100); this.burst(x, y, 8, '#2a2a2a', 60, 0.8, 4, 150); this.ring(x, y, c, 22, 0.3); }
        break;
      }
      case 'possess': {
        this.transfer = { x0: ev.fromX ?? x, y0: ev.fromY ?? y, x1: x, y1: y, t: 0 };
        this.ring(x, y, '#37e2ff', 40, 0.45); this.ring(x, y, '#ffffff', 26, 0.3);
        this.burst(x, y, 30, '#8cf6ff', 200, 0.5, 2.5); this.shake = Math.max(this.shake, 7); this.flash = 0.12; this.flashColor = '#8cf6ff';
        this.text(x, y - 20, `${ev.body ? BODIES[ev.body].name : ''} 탈취!`, '#8cf6ff', 1.2);
        break;
      }
      case 'possessFail': this.burst(x, y, 4, '#ff7a7a', 50, 0.2, 2); break;
      case 'skill': {
        if (ev.text === 'dash') this.burst(x, y, 10, '#8cf6ff', 60, 0.25, 2);
        else if (ev.text === 'sprint') this.burst(x, y, 10, '#e9ff6a', 80, 0.3, 2);
        else if (ev.text === 'guard') this.ring(x, y, '#9fc9ff', 34, 0.4);
        else if (ev.text === 'bigbomb') this.text(x, y - 16, '1.6초 뒤 폭발!', '#ffd23c', 1.4);
        else if (ev.text === 'aimshot') this.ring(x, y, '#ffffff', 20, 0.5);
        else if (ev.text === 'repairpulse') { this.ring(x, y, '#5cf2e0', 100, 0.45); this.burst(x, y, 16, '#bfffff', 120, 0.4, 2); }
        break;
      }
      case 'repair': this.burst(x, y, 10, '#7dffb0', 60, 0.5, 2.5, -60); if (ev.amount) this.text(x, y - 6, `+${ev.amount}`, '#7dffb0', 0.9); break;
      case 'shock': this.line(ev.fromX ?? x, ev.fromY ?? y, x, y, '#bfffff', 0.1, 2); this.burst(x, y, 3, '#bfffff', 80, 0.15, 1.5); break;
      case 'stun': this.ring(x, y, '#ffe66d', 26, 0.4); this.text(x, y - 16, '기절!', '#ffe66d', 1); break;
      case 'collapseWarn': this.text(x, y - 18, '안정도 낮음', '#ff9f5c', 1.2); break;
      case 'collapseStart': this.text(x, y - 18, '붕괴 시작!', '#ff5f5f', 1.4); this.shake = Math.max(this.shake, 4); break;
      case 'wallBreak': this.burst(x, y, 30, '#7d8794', 160, 0.7, 4, 260); this.burst(x, y, 12, '#c9d0d8', 90, 0.5, 2.5, 200); this.shake = Math.max(this.shake, 8); break;
      case 'switch': this.ring(x, y, '#7dffb0', 30, 0.5); this.burst(x, y, 12, '#7dffb0', 80, 0.4, 2); break;
      case 'door': this.burst(x, y, 14, '#9fc9ff', 70, 0.5, 2.5); break;
      case 'turretOff': this.burst(x, y, 10, '#ffe66d', 70, 0.5, 2); this.text(x, y - 16, '정지', '#ffe66d', 1); break;
      case 'bossWarn': if (ev.text === 'charge') { this.shake = Math.max(this.shake, 3); } else { this.flash = 0.2; this.flashColor = '#ff3b3b'; this.shake = Math.max(this.shake, 8); } break;
      case 'bossPhase': this.ring(x, y, '#ff8a8a', 90, 0.6); this.flash = 0.12; this.flashColor = '#ff8a8a'; if (ev.text) this.text(x, y - 60, ev.text, '#ff8a8a', 1.6); break;
      case 'bossDie': this.burst(x, y, 80, '#ff8a8a', 260, 1.2, 4, 80); this.burst(x, y, 40, '#ffd23c', 200, 1.0, 3); this.ring(x, y, '#fff', 160, 0.9); this.shake = 16; this.flash = 0.35; this.flashColor = '#fff'; break;
      case 'laser': if (ev.text === 'fire') { this.shake = Math.max(this.shake, 5); this.flash = 0.06; this.flashColor = '#ff6a6a'; } break;
      case 'lastChance': this.flash = 0.25; this.flashColor = '#ff2a2a'; this.shake = Math.max(this.shake, 6); break;
      case 'wave': if (ev.text === 'spawn') { this.ring(x, y, '#ff8a8a', 26, 0.4); this.burst(x, y, 10, '#ff8a8a', 90, 0.35, 2); } break;
      default: break;
    }
  }
  update(dt: number): void {
    const keep: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt; if (p.life <= 0) continue;
      if (p.kind === 'dot' || p.kind === 'text') { p.x += p.vx * dt; p.y += p.vy * dt; if (p.gravity) p.vy += p.gravity * dt; p.vx *= 0.96; p.vy *= 0.96; }
      keep.push(p);
    }
    this.parts = keep;
    if (this.transfer) { this.transfer.t += dt / 0.22; if (this.transfer.t >= 1) this.transfer = null; }
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 30); const a = Math.random() * Math.PI * 2; this.shakeX = Math.cos(a) * this.shake * this.intensity; this.shakeY = Math.sin(a) * this.shake * this.intensity; } else { this.shakeX = 0; this.shakeY = 0; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = a;
      if (p.kind === 'dot') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - a * 0.8), 0, Math.PI * 2); ctx.stroke(); }
      else if (p.kind === 'spark') { ctx.strokeStyle = p.color; ctx.lineWidth = 3; const d = p.x2 ?? 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, d - 0.9, d + 0.9); ctx.stroke(); }
      else if (p.kind === 'line') { ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); const mx = (p.x + (p.x2 ?? p.x)) / 2 + (Math.random() - 0.5) * 12, my = (p.y + (p.y2 ?? p.y)) / 2 + (Math.random() - 0.5) * 12; ctx.lineTo(mx, my); ctx.lineTo(p.x2 ?? p.x, p.y2 ?? p.y); ctx.stroke(); }
      else if (p.kind === 'text') { ctx.fillStyle = p.color; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3; ctx.strokeText(p.text ?? '', p.x, p.y); ctx.fillText(p.text ?? '', p.x, p.y); }
    }
    ctx.globalAlpha = 1;
    if (this.transfer) {
      const t = this.transfer; const u = t.t; const x = t.x0 + (t.x1 - t.x0) * u, y = t.y0 + (t.y1 - t.y0) * u;
      ctx.strokeStyle = 'rgba(140,246,255,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(t.x0 + (x - t.x0) * 0.4, t.y0 + (y - t.y0) * 0.4); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(55,226,255,0.7)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    }
  }
}
