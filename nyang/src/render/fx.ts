// 파티클·떠오르는 글자·유령(합체 직전 두 마리) 연출. 시각 전용 난수 사용.
import { CATS } from '../data/cats';
import { drawCat, drawTail, type CatPose } from './catdraw';

type Kind = 'heart' | 'dot' | 'star' | 'ring' | 'text' | 'leaf' | 'bubble' | 'ghost' | 'fly' | 'beam' | 'cloud' | 'coin';

export interface Particle {
  kind: Kind;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  size: number; color: string;
  rot: number; vr: number;
  g: number;
  text?: string;
  tier?: number;
  tx?: number; ty?: number; r0?: number;
  big?: boolean;
}

export const FONT = "'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  list: Particle[] = [];
  lite = false;
  /** 화면 흔들림 세기 (월드 단위) */
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';

  private add(p: Partial<Particle> & { kind: Kind; x: number; y: number }): void {
    if (this.list.length > 600) this.list.shift();
    this.list.push({ vx: 0, vy: 0, life: 1, max: 1, size: 6, color: '#fff', rot: 0, vr: 0, g: 0, ...p } as Particle);
  }

  merge(tier: number, x: number, y: number, ax: number, ay: number, bx: number, by: number, ar: number, br: number): void {
    const def = CATS[tier];
    const prev = CATS[tier - 1];
    // 합쳐지는 두 마리 유령
    this.add({ kind: 'ghost', x: ax, y: ay, tx: x, ty: y, r0: ar, tier: tier - 1, life: 0.14, max: 0.14 });
    this.add({ kind: 'ghost', x: bx, y: by, tx: x, ty: y, r0: br, tier: tier - 1, life: 0.14, max: 0.14 });
    this.add({ kind: 'ring', x, y, size: def.r * 0.8, color: def.body, life: 0.45, max: 0.45 });
    const n = this.lite ? 5 : 8 + Math.min(10, tier * 1.5);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(120, 260 + tier * 25);
      this.add({ kind: 'dot', x: x + Math.cos(a) * def.r * 0.5, y: y + Math.sin(a) * def.r * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, g: 900, size: rnd(2.5, 5 + tier * 0.4), color: i % 2 ? def.body : prev.c1, life: rnd(0.35, 0.7), max: 0.7 });
    }
    const hearts = this.lite ? 1 : 2 + Math.floor(tier / 3);
    for (let i = 0; i < hearts; i++) this.add({ kind: 'heart', x: x + rnd(-10, 10), y: y - def.r * 0.4, vx: rnd(-60, 60), vy: rnd(-220, -140), g: 120, size: rnd(7, 11) + tier * 0.6, color: i % 2 ? '#ff6f86' : '#ff9fb4', rot: rnd(-0.4, 0.4), life: rnd(0.8, 1.2), max: 1.2 });
    if (tier >= 5 && !this.lite) for (let i = 0; i < 6 + tier; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(200, 420);
      this.add({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 200, size: rnd(5, 9), color: i % 3 ? '#FFE46B' : '#ffffff', rot: rnd(0, 3), vr: rnd(-6, 6), life: rnd(0.5, 0.9), max: 0.9 });
    }
    if (tier >= 7) { this.shake = Math.max(this.shake, 3 + (tier - 7) * 2.5); }
    if (tier >= 9) { this.flash = 0.35; this.flashColor = '#fff6d8'; }
  }

  text(x: number, y: number, text: string, color: string, size = 18, big = false): void {
    this.add({ kind: 'text', x, y, vy: big ? -40 : -70, text, color, size, life: big ? 1.1 : 0.9, max: big ? 1.1 : 0.9, big });
  }

  private lastCombo: Particle | null = null;

  /** 콤보 글자는 하나만: 새 콤보가 뜨면 이전 것은 지운다 */
  combo(x: number, y: number, text: string, color: string, size: number): void {
    if (this.lastCombo && this.lastCombo.life > 0) this.lastCombo.life = 0;
    this.text(x, y, text, color, size, true);
    this.lastCombo = this.list[this.list.length - 1];
  }

  ascend(x: number, y: number): void {
    this.add({ kind: 'beam', x, y, size: 120, life: 1.4, max: 1.4, color: '#fff' });
    this.add({ kind: 'fly', x, y, vx: 0, vy: -520, tier: 10, r0: CATS[10].r, rot: 0, vr: 0.8, life: 1.6, max: 1.6 });
    for (let i = 0; i < (this.lite ? 12 : 40); i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(150, 600);
      const cols = ['#FF7AC8', '#6CE4FF', '#FFE46B', '#9CFF8A', '#B08CFF', '#ffffff'];
      this.add({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 100, g: 250, size: rnd(6, 12), color: cols[i % cols.length], rot: rnd(0, 3), vr: rnd(-8, 8), life: rnd(0.8, 1.5), max: 1.5 });
    }
    this.shake = 10; this.flash = 0.6; this.flashColor = '#ffffff';
  }

  nip(x: number, y: number, r: number): void {
    this.add({ kind: 'ring', x, y, size: r, color: '#9CFF8A', life: 0.5, max: 0.5 });
    for (let i = 0; i < (this.lite ? 5 : 14); i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(80, 260);
      this.add({ kind: i % 2 ? 'leaf' : 'star', x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 100, g: 300, size: rnd(5, 9), color: i % 2 ? '#7CCB5E' : '#D8FFB0', rot: rnd(0, 6), vr: rnd(-6, 6), life: rnd(0.6, 1), max: 1 });
    }
  }

  /** 냥펀치: 고양이가 상자 밖으로 날아간다 */
  punch(tier: number, x: number, y: number, r: number): void {
    this.add({ kind: 'fly', x, y, vx: rnd(-160, 160), vy: -900, g: 1400, tier, r0: r, rot: 0, vr: rnd(-10, 10), life: 1.4, max: 1.4 });
    this.add({ kind: 'ring', x, y, size: r, color: '#ffffff', life: 0.35, max: 0.35 });
    for (let i = 0; i < 8; i++) this.add({ kind: 'cloud', x: x + rnd(-r, r) * 0.6, y: y + rnd(-r, r) * 0.6, vx: rnd(-80, 80), vy: rnd(-80, 30), size: rnd(8, 14) + r * 0.2, color: '#ffffff', life: rnd(0.4, 0.7), max: 0.7 });
    this.shake = Math.max(this.shake, 4);
  }

  /** 황금 고양이 합체: 금화가 튄다 */
  goldBurst(x: number, y: number, r: number): void {
    const n = this.lite ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(180, 420);
      this.add({ kind: 'coin', x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 260, g: 1100, size: rnd(5, 8), color: '#FFD34D', rot: rnd(0, 6), vr: rnd(8, 16), life: rnd(0.7, 1.1), max: 1.1 });
    }
    this.add({ kind: 'ring', x, y, size: r, color: '#FFE27A', life: 0.5, max: 0.5 });
    this.flash = Math.max(this.flash, 0.18); this.flashColor = '#FFF1C2';
  }

  /** 냥냥 피버 시작 */
  feverStart(W: number, H: number): void {
    const cols = ['#FF7AC8', '#6CE4FF', '#FFE46B', '#9CFF8A', '#B08CFF'];
    for (let i = 0; i < (this.lite ? 14 : 44); i++) {
      this.add({ kind: 'star', x: rnd(0, W), y: H + rnd(0, 30), vx: rnd(-60, 60), vy: rnd(-900, -500), g: 700, size: rnd(6, 11), color: cols[i % cols.length], rot: rnd(0, 3), vr: rnd(-8, 8), life: rnd(0.9, 1.4), max: 1.4 });
    }
    this.flash = 0.45; this.flashColor = '#FFE2F2';
    this.shake = Math.max(this.shake, 5);
  }

  /** 피버 중 반짝이 비 */
  feverSparkle(W: number, H: number): void {
    const cols = ['#FF7AC8', '#6CE4FF', '#FFE46B', '#9CFF8A', '#ffffff'];
    this.add({ kind: 'star', x: rnd(0, W), y: rnd(-40, H * 0.3), vx: rnd(-20, 20), vy: rnd(40, 120), g: 30, size: rnd(3, 6), color: cols[Math.floor(rnd(0, cols.length))], rot: rnd(0, 3), vr: rnd(-4, 4), life: rnd(0.8, 1.4), max: 1.4 });
  }

  poof(x: number, y: number, r: number): void {
    for (let i = 0; i < 6; i++) this.add({ kind: 'cloud', x: x + rnd(-r, r) * 0.5, y: y + rnd(-r, r) * 0.5, vx: rnd(-60, 60), vy: rnd(-90, -20), size: rnd(8, 12) + r * 0.25, color: '#ffffff', life: rnd(0.5, 0.8), max: 0.8 });
  }

  bubbles(W: number, H: number): void {
    if (this.lite && Math.random() < 0.6) return;
    this.add({ kind: 'bubble', x: rnd(8, W - 8), y: H - rnd(0, 40), vy: rnd(-160, -70), vx: rnd(-10, 10), size: rnd(3, 8), color: '#bff0ff', life: rnd(1.2, 2.2), max: 2.2 });
  }

  landDust(x: number, y: number, speed: number): void {
    if (this.lite) return;
    const n = Math.min(6, Math.floor(speed / 250));
    for (let i = 0; i < n; i++) this.add({ kind: 'cloud', x: x + rnd(-8, 8), y, vx: rnd(-90, 90), vy: rnd(-50, -10), size: rnd(4, 7), color: 'rgba(255,255,255,0.8)', life: rnd(0.25, 0.45), max: 0.45 });
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === 'cloud' || p.kind === 'text') { p.vx *= 0.9; p.vy *= p.kind === 'text' ? 0.94 : 0.9; }
      if (p.kind === 'bubble') p.vx += Math.sin(p.life * 9 + p.y * 0.05) * 20 * dt;
    }
    this.list = this.list.filter(p => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }

  draw(ctx: CanvasRenderingContext2D, t: number, line: number): void {
    for (const p of this.list) {
      const k = Math.max(0, p.life / p.max);
      ctx.save();
      switch (p.kind) {
        case 'dot':
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2); ctx.fill();
          break;
        case 'cloud':
          ctx.globalAlpha = Math.min(1, k * 1.4) * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - 0.5 * k), 0, Math.PI * 2); ctx.fill();
          break;
        case 'heart':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(t * 6 + p.x) * 0.15);
          heart(ctx, p.size, p.color);
          break;
        case 'star':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          star(ctx, p.size * (0.5 + 0.5 * k), p.color);
          break;
        case 'coin': {
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.translate(p.x, p.y);
          const sx = Math.abs(Math.cos(p.rot));
          ctx.fillStyle = '#E3A21A';
          ctx.beginPath(); ctx.ellipse(0, 0, p.size * Math.max(0.15, sx), p.size, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size * Math.max(0.1, sx) * 0.75, p.size * 0.75, 0, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'leaf':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 'ring': {
          const e = 1 - k;
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, 6 * k);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + e * 1.2), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'bubble':
          ctx.globalAlpha = Math.min(1, k * 2) * 0.8;
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, Math.PI * 2); ctx.fill();
          break;
        case 'text': {
          const e = 1 - k;
          const pop = p.big ? 1 + 0.35 * Math.max(0, 1 - e * 5) : 1 + 0.25 * Math.max(0, 1 - e * 6);
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.translate(p.x, p.y);
          ctx.scale(pop, pop);
          ctx.font = `${p.size}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = p.size * 0.28; ctx.strokeStyle = '#4A2E23';
          ctx.strokeText(p.text!, 0, 0);
          ctx.fillStyle = p.color; ctx.fillText(p.text!, 0, 0);
          break;
        }
        case 'ghost': {
          const e = 1 - k;
          const x = p.x + (p.tx! - p.x) * e, y = p.y + (p.ty! - p.y) * e;
          const pose: CatPose = { tier: p.tier!, x, y, r: p.r0! * (1 - e * 0.35), a: 0, squash: 0, clips: [], mood: 'happy', lookX: 0, lookY: 0, blink: 0, t, seed: 1, line, alpha: k * 0.9 };
          drawCat(ctx, pose);
          break;
        }
        case 'fly': {
          const pose: CatPose = { tier: p.tier!, x: p.x, y: p.y, r: p.r0!, a: p.rot, squash: 0.08, clips: [], mood: p.tier === 10 ? 'happy' : 'squish', lookX: 0, lookY: 0, blink: 0, t, seed: 2, line, alpha: Math.min(1, k * 3) };
          drawTail(ctx, pose); drawCat(ctx, pose);
          break;
        }
        case 'beam': {
          ctx.globalAlpha = Math.min(1, k * 1.5) * 0.6;
          const g = ctx.createLinearGradient(p.x - p.size, 0, p.x + p.size, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.size, -2000, p.size * 2, p.y + 2000);
          break;
        }
      }
      ctx.restore();
    }
  }
}

export function heart(ctx: CanvasRenderingContext2D, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
  ctx.fill();
}

export function star(ctx: CanvasRenderingContext2D, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? s * 0.38 : s;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
}
