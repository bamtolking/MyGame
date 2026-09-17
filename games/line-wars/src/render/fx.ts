/** Transient visual effects driven by sim events. Object-pooled particles. */
import type { SimEvent } from '../core/sim/state.ts';
import type { Team } from '../core/types.ts';
import { TEAM_COLORS } from './sprites.ts';

interface Particle {
  alive: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; kind: 'dot' | 'ring' | 'line' | 'text' | 'spark' | 'hex' | 'debris' | 'smoke';
  tx: number; ty: number; text: string; grav: number;
}

export class Fx {
  pool: Particle[] = [];
  count = 0;
  shake = 0;
  flash = 0;
  quality = 1;
  constructor(capacity = 1500) {
    for (let i = 0; i < capacity; i++) this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff', kind: 'dot', tx: 0, ty: 0, text: '', grav: 0 });
  }
  private get(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.alive) { p.alive = true; p.grav = 0; p.text = ''; this.count++; return p; }
    }
    return null;
  }
  spawn(kind: Particle['kind'], x: number, y: number, life: number, size: number, color: string, vx = 0, vy = 0, tx = 0, ty = 0) {
    const p = this.get();
    if (!p) return null;
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.maxLife = life; p.size = size; p.color = color; p.tx = tx; p.ty = ty;
    return p;
  }
  burst(x: number, y: number, n: number, speed: number, life: number, size: number, color: string, kind: Particle['kind'] = 'dot', grav = 0) {
    n = Math.round(n * (this.quality > 0 ? 1 : 0.4));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      const p = this.spawn(kind, x, y, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, Math.cos(a) * s, Math.sin(a) * s);
      if (p) p.grav = grav;
    }
  }
  handle(e: SimEvent, viewerTeam: Team, settings: { shake: boolean; flash: boolean }) {
    switch (e.kind) {
      case 'shot': {
        const col = e.team === viewerTeam ? '#dbeafe' : '#fecaca';
        if (e.unitType === 'rifles' || e.unitType === 'glider' || e.unitType === 'infiltrator' || e.unitType === 'raiders' || e.unitType === 'shieldwalker') {
          if (e.unitType === 'raiders' || e.unitType === 'shieldwalker' || e.unitType === 'infiltrator') {
            this.spawn('spark', e.tx, e.ty, 0.12, 4, '#fff7cc');
          } else {
            this.spawn('line', e.x, e.y, 0.08, 1.2, col, 0, 0, e.tx, e.ty);
          }
          this.spawn('dot', e.x, e.y, 0.06, 3, '#fff2b0');
        } else if (e.unitType === 'sprayer') {
          const ang = Math.atan2(e.ty - e.y, e.tx - e.x);
          for (let i = 0; i < 8 * (this.quality ? 1 : 0.5); i++) {
            const a = ang + (Math.random() - 0.5) * 1.1;
            const s = 140 + Math.random() * 120;
            this.spawn('dot', e.x, e.y, 0.35, 3 + Math.random() * 3, `rgba(255,${150 + Math.random() * 80 | 0},60,0.8)`, Math.cos(a) * s, Math.sin(a) * s);
          }
        } else if (e.unitType === 'core' || e.unitType === 'outpost') {
          this.spawn('line', e.x, e.y, 0.1, 2, '#fde68a', 0, 0, e.tx, e.ty);
        } else {
          this.spawn('dot', e.x, e.y, 0.08, 4, '#ffd9a0');
        }
        break;
      }
      case 'hit':
        if (e.shield) this.spawn('hex', e.x, e.y, 0.25, 16, 'rgba(100,220,255,0.9)');
        else if (e.amount > 25) this.spawn('spark', e.x, e.y, 0.15, 5, '#fff');
        break;
      case 'explosion': {
        const big = e.power >= 1;
        this.spawn('ring', e.x, e.y, big ? 0.45 : 0.3, e.r, big ? 'rgba(255,190,90,0.9)' : 'rgba(255,220,150,0.8)');
        this.burst(e.x, e.y, big ? 16 : 8, big ? 160 : 100, 0.5, big ? 4 : 3, '#ffb347', 'dot');
        if (this.quality > 0) this.burst(e.x, e.y, big ? 6 : 3, 30, 1.2, big ? 10 : 6, 'rgba(90,90,100,0.5)', 'smoke');
        if (big && settings.flash) this.flash = Math.max(this.flash, 0.15);
        break;
      }
      case 'death': {
        const col = TEAM_COLORS[e.team].main;
        this.burst(e.x, e.y, 8, 110, 0.6, 3, col, 'debris', e.layer === 'air' ? 60 : 0);
        this.burst(e.x, e.y, 4, 40, 0.9, 8, 'rgba(80,80,90,0.5)', 'smoke');
        if (e.unitType === 'gunship' || e.unitType === 'railgun' || e.unitType === 'bomber' || e.unitType === 'howitzer') {
          this.spawn('ring', e.x, e.y, 0.5, 40, 'rgba(255,200,100,0.9)');
          if (settings.shake) this.shake = Math.max(this.shake, 4);
        }
        break;
      }
      case 'beam':
        this.spawn('line', e.x, e.y, 0.18, 3, e.team === viewerTeam ? '#7dd3fc' : '#fda4af', 0, 0, e.tx, e.ty);
        this.spawn('line', e.x, e.y, 0.1, 6, 'rgba(255,255,255,0.6)', 0, 0, e.tx, e.ty);
        break;
      case 'buildingDestroyed':
        this.spawn('ring', e.x, e.y, 0.9, 140, 'rgba(255,170,60,0.95)');
        this.burst(e.x, e.y, 40, 260, 1.2, 6, '#ffb347', 'debris', 80);
        this.burst(e.x, e.y, 14, 60, 2.2, 24, 'rgba(60,60,70,0.6)', 'smoke');
        if (settings.shake) this.shake = Math.max(this.shake, 18);
        if (settings.flash) this.flash = Math.max(this.flash, 0.5);
        break;
      case 'cannonWarn':
        this.spawn('ring', e.x, e.y, 1.5, 120, 'rgba(255,80,80,0.9)');
        break;
      case 'cannonFire':
        this.spawn('ring', e.x, e.y, 0.7, 130, 'rgba(255,240,200,1)');
        this.spawn('ring', e.x, e.y, 1.0, 60, 'rgba(255,120,60,0.9)');
        this.burst(e.x, e.y, 50, 300, 1.0, 5, '#ffd580', 'dot');
        if (settings.shake) this.shake = Math.max(this.shake, 14);
        if (settings.flash) this.flash = Math.max(this.flash, 0.4);
        break;
      case 'repair':
        this.spawn('dot', e.x, e.y, 0.5, 2.5, '#4ade80', (e.tx - e.x) * 2, (e.ty - e.y) * 2);
        break;
      case 'shieldOn':
        this.spawn('hex', e.x, e.y, 0.5, 18, 'rgba(100,220,255,0.7)');
        break;
      case 'spawn':
        if (this.quality > 0) this.spawn('ring', e.x, e.y, 0.35, 14, 'rgba(180,220,255,0.7)');
        break;
      case 'dispatch': {
        break;
      }
      default:
        break;
    }
  }
  update(dt: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; this.count--; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += p.grav * dt;
      if (p.kind === 'dot' || p.kind === 'debris') { p.vx *= 0.92; p.vy *= 0.92; }
      if (p.kind === 'smoke') { p.size += 12 * dt; }
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }
  draw(ctx: CanvasRenderingContext2D, zoom: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      switch (p.kind) {
        case 'dot': case 'debris':
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
          break;
        case 'smoke':
          ctx.fillStyle = p.color; ctx.globalAlpha = k * 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case 'spark':
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2); ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1 / zoom, 3 * k); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.7), 0, Math.PI * 2); ctx.stroke();
          break;
        case 'line':
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
          break;
        case 'hex': {
          ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; const x = p.x + Math.cos(a) * p.size, y = p.y + Math.sin(a) * p.size; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.closePath(); ctx.stroke();
          break;
        }
        case 'text':
          ctx.fillStyle = p.color; ctx.font = `bold ${p.size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
  clear() {
    for (const p of this.pool) p.alive = false;
    this.count = 0; this.shake = 0; this.flash = 0;
  }
}
