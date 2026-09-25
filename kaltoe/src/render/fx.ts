// 시각 효과: 파티클, 병합 피해 숫자, 폭발 고리, 번개, 화면 흔들림/번쩍임 (렌더 전용, 판정 무관)
import { UI_FONT } from './sprites';

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 0 | 1 | 2; // 0 사각 불꽃, 1 원, 2 종이 조각(회전)
  rot: number; vr: number; grav: number;
}
interface DmgNum { x: number; y: number; v: number; crit: boolean; life: number; uid: number; born: number }
interface Boom { x: number; y: number; r: number; color: string; life: number; max: number; big: boolean }
interface Bolt { pts: number[]; color: string; life: number }
interface Text { x: number; y: number; text: string; color: string; life: number; max: number; size: number }

export class Fx {
  parts: Particle[] = [];
  nums: DmgNum[] = [];
  booms: Boom[] = [];
  bolts: Bolt[] = [];
  texts: Text[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';
  time = 0;
  maxParts = 700;
  showNums = true;
  shakeOn = true;
  private numByUid = new Map<number, DmgNum>();
  private seed = 1;

  private numCache = new Map<string, { c: HTMLCanvasElement; w: number; h: number }>();
  numScale = 2;
  private numSprite(txt: string, crit: boolean) {
    const key = txt + (crit ? '!' : '');
    let s = this.numCache.get(key);
    if (s) return s;
    if (this.numCache.size > 500) this.numCache.clear();
    const size = crit ? 15 : 11;
    const S = this.numScale;
    const c = document.createElement('canvas');
    const w = size * 0.62 * txt.length + 8, h = size + 8;
    c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
    const g = c.getContext('2d')!;
    g.scale(S, S);
    g.font = `900 ${size}px ${UI_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineJoin = 'round';
    g.strokeText(txt, w / 2, h / 2);
    g.fillStyle = crit ? '#ffd43b' : '#ffffff';
    g.fillText(txt, w / 2, h / 2);
    s = { c, w, h };
    this.numCache.set(key, s);
    return s;
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }

  setLow(low: boolean) { this.maxParts = low ? 220 : 700; }

  burst(x: number, y: number, color: string, n: number, speed = 160, size = 3, kind: 0 | 1 | 2 = 0, grav = 0) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.maxParts) this.parts.shift();
      const a = this.rnd() * Math.PI * 2, s = speed * (0.35 + this.rnd() * 0.75);
      const life = 0.25 + this.rnd() * 0.35 + (kind === 2 ? 0.4 : 0);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 2 ? 60 : 0), life, max: life,
        size: size * (0.6 + this.rnd() * 0.8), color, kind, rot: this.rnd() * 6, vr: (this.rnd() - 0.5) * 14, grav,
      });
    }
  }

  dmg(x: number, y: number, v: number, crit: boolean, uid: number) {
    if (!this.showNums) return;
    const ex = this.numByUid.get(uid);
    if (ex && this.time - ex.born < 0.22 && ex.life > 0.3) {
      ex.v += v; ex.crit = ex.crit || crit; ex.life = Math.max(ex.life, 0.55);
      return;
    }
    if (this.nums.length > 90) { const old = this.nums.shift(); if (old) this.numByUid.delete(old.uid); }
    const n: DmgNum = { x: x + (this.rnd() - 0.5) * 10, y, v, crit, life: 0.6, uid, born: this.time };
    this.nums.push(n);
    this.numByUid.set(uid, n);
  }

  boom(x: number, y: number, r: number, color: string, big: boolean) {
    const life = big ? 0.5 : 0.32;
    this.booms.push({ x, y, r, color, life, max: life, big });
    if (this.booms.length > 60) this.booms.shift();
  }

  bolt(pts: number[], color: string) { this.bolts.push({ pts, color, life: 0.16 }); if (this.bolts.length > 40) this.bolts.shift(); }

  text(x: number, y: number, text: string, color = '#fff', size = 14, life = 1.2) {
    this.texts.push({ x, y, text, color, life, max: life, size });
    if (this.texts.length > 20) this.texts.shift();
  }

  addShake(v: number) { if (this.shakeOn) this.shake = Math.min(1, this.shake + v); }
  addFlash(v: number, color = '#ffffff') { this.flash = Math.min(0.85, Math.max(this.flash, v)); this.flashColor = color; }

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.9; p.vy = p.vy * 0.9 + p.grav * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const n of this.nums) { n.life -= dt; n.y -= dt * 38; }
    const alive = this.nums.filter(n => n.life > 0);
    if (alive.length !== this.nums.length) for (const n of this.nums) if (n.life <= 0 && this.numByUid.get(n.uid) === n) this.numByUid.delete(n.uid);
    this.nums = alive;
    for (const b of this.booms) b.life -= dt;
    this.booms = this.booms.filter(b => b.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 22; }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  shakeOffset(): [number, number] {
    if (this.shake <= 0) return [0, 0];
    const m = 14 * this.shake * this.shake;
    return [(this.rnd() * 2 - 1) * m, (this.rnd() * 2 - 1) * m];
  }

  /** 월드 좌표계(카메라 변환 적용된 상태)에서 호출 */
  drawWorld(g: CanvasRenderingContext2D) {
    // 폭발 고리
    for (const b of this.booms) {
      const k = 1 - b.life / b.max;
      const r = b.r * (0.35 + 0.65 * Math.sqrt(k));
      g.globalAlpha = (1 - k) * (b.big ? 0.55 : 0.45);
      g.fillStyle = b.color;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = (1 - k) * 0.9;
      g.strokeStyle = '#ffffff';
      g.lineWidth = (b.big ? 5 : 3) * (1 - k) + 0.5;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    // 번개
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const b of this.bolts) {
      const a = b.life / 0.16;
      for (let pass = 0; pass < 2; pass++) {
        g.globalAlpha = a * (pass ? 1 : 0.45);
        g.strokeStyle = pass ? '#ffffff' : b.color;
        g.lineWidth = pass ? 1.6 : 5;
        g.beginPath();
        for (let i = 0; i + 3 < b.pts.length; i += 2) {
          const x0 = b.pts[i], y0 = b.pts[i + 1], x1 = b.pts[i + 2], y1 = b.pts[i + 3];
          if (i === 0) g.moveTo(x0, y0);
          const segs = 4;
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            const j = s === segs ? 0 : 9;
            g.lineTo(x0 + (x1 - x0) * t + (this.rnd() - 0.5) * j, y0 + (y1 - y0) * t + (this.rnd() - 0.5) * j);
          }
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    // 파티클
    for (const p of this.parts) {
      g.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      g.fillStyle = p.color;
      if (p.kind === 1) { g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); }
      else if (p.kind === 2) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4); g.restore();
      } else g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
    // 피해 숫자(문자열별 스프라이트 캐시)
    for (const n of this.nums) {
      const k = n.life / 0.6;
      const pop = n.life > 0.5 ? 1 + (n.life - 0.5) * 4 : 1;
      g.globalAlpha = Math.min(1, k * 2);
      const txt = n.v >= 10000 ? (n.v / 1000).toFixed(0) + 'k' : n.v >= 1000 ? (n.v / 1000).toFixed(1) + 'k' : String(Math.max(1, Math.round(n.v)));
      const sp = this.numSprite(txt, n.crit);
      const sc = pop * (n.v >= 1000 ? 1.15 : 1);
      g.drawImage(sp.c, n.x - sp.w * sc / 2, n.y - sp.h * sc / 2, sp.w * sc, sp.h * sc);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // 떠오르는 글자
    for (const t of this.texts) {
      g.globalAlpha = Math.min(1, t.life / t.max * 2);
      g.font = `900 ${t.size}px ${UI_FONT}`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)';
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
  }
}
