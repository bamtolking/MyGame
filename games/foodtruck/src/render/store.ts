// Canvas 2D 가게 렌더러: 천막·바닥·배식구·출입구·가구·손님·직원·대기줄. 시각 난수는 판정에 영향을 주지 않는다.
import { STORE, type Cell } from '../data/store';
import { CUSTOMER_DEFS, type CustomerType } from '../data/customers';
import type { Family } from '../data/foods';
import type { RunState, Furniture, Customer } from '../sim/types';
import { foodIcon } from './icons';

export interface Geometry { ox: number; oy: number; cs: number; w: number; h: number }
export type Weather = 'clear' | 'busy' | 'rain' | 'moon' | 'festival';

export interface DrawOpts {
  time: number;             // 연출용 시간(초)
  weather: Weather;
  level: number;            // 가게 성장 단계(해금 영업일 수) 1..5
  staffSpeedLevel: number;
  paths?: Array<{ path: Cell[]; color?: string }>;
  ghost?: { kind: 'seat' | 'decor'; cell: Cell; ok: boolean } | null;
  selectedId?: number | null;
  showLabels?: boolean;
}

const imgCache = new Map<string, HTMLImageElement>();
export function iconImage(family: Family, tier: number): HTMLImageElement {
  const k = `${family}:${tier}`;
  let img = imgCache.get(k);
  if (!img) {
    img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(foodIcon(family, tier));
    imgCache.set(k, img);
  }
  return img;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; text?: string }

export class StoreRenderer {
  ctx: CanvasRenderingContext2D;
  geom: Geometry = { ox: 0, oy: 0, cs: 40, w: 0, h: 0 };
  particles: Particle[] = [];
  private rain: Array<{ x: number; y: number; s: number }> = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 40; i++) this.rain.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)); const h = Math.max(1, Math.round(r.height));
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) { this.canvas.width = w * dpr; this.canvas.height = h * dpr; }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 격자 6×4 + 위 천막 0.62 + 아래 대기 통로 0.9 + 좌우 여백 0.3
    const cs = Math.min(w / (STORE.cols + 0.6), h / (STORE.rows + 1.52));
    const gw = cs * STORE.cols; const gh = cs * STORE.rows;
    const top = (h - (gh + cs * 0.62 + cs * 0.9)) / 2;
    this.geom = { ox: (w - gw) / 2, oy: top + cs * 0.62, cs, w, h };
  }

  cellCenter(c: Cell): { x: number; y: number } {
    const { ox, oy, cs } = this.geom;
    return { x: ox + (c.x + 0.5) * cs, y: oy + (c.y + 0.5) * cs };
  }

  cellFromPoint(px: number, py: number): Cell | null {
    const { ox, oy, cs } = this.geom;
    const x = Math.floor((px - ox) / cs); const y = Math.floor((py - oy) / cs);
    if (x < 0 || y < 0 || x >= STORE.cols || y >= STORE.rows) return null;
    return { x, y };
  }

  burst(cell: { x: number; y: number }, color: string, n = 8, text?: string): void {
    const p = this.cellCenter(cell);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const sp = 20 + Math.random() * 40;
      this.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.7, max: 0.7, color });
    }
    if (text) this.particles.push({ x: p.x, y: p.y - 10, vx: 0, vy: -28, life: 1.1, max: 1.1, color, text });
  }

  draw(run: RunState | null, layout: Furniture[], o: DrawOpts, dt: number): void {
    const ctx = this.ctx; const { ox, oy, cs, w, h } = this.geom;
    ctx.clearRect(0, 0, w, h);
    // 배경(밤하늘)
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const tint = o.weather === 'rain' ? ['#1b2238', '#232c48'] : o.weather === 'moon' ? ['#1d1638', '#2b2050'] : o.weather === 'festival' ? ['#2a1638', '#3b1f4a'] : ['#171a33', '#242a4d'];
    sky.addColorStop(0, tint[0]); sky.addColorStop(1, tint[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // 별·달
    ctx.save(); ctx.globalAlpha = 0.8;
    for (let i = 0; i < 14; i++) { const sx = ((i * 97) % 100) / 100 * w; const sy = ((i * 53) % 100) / 100 * (oy * 0.8); const tw = 0.5 + 0.5 * Math.sin(o.time * 2 + i); ctx.fillStyle = `rgba(255,240,200,${0.3 + 0.5 * tw})`; ctx.fillRect(sx, sy, 2, 2); }
    if (o.weather === 'moon' || o.weather === 'festival' || o.level >= 4) { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(w - cs * 0.8, oy * 0.45, cs * 0.28, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // 천막 (성장 단계에 따라 장식)
    const tentH = cs * 0.62;
    const tentY = oy - tentH;
    ctx.fillStyle = o.level >= 3 ? '#d9553f' : '#c94f3d';
    ctx.fillRect(ox - cs * 0.2, tentY, cs * STORE.cols + cs * 0.4, tentH);
    // 줄무늬
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < STORE.cols * 2 + 2; i += 2) ctx.fillRect(ox - cs * 0.2 + i * cs * 0.5, tentY, cs * 0.5, tentH);
    // 스캘럽 가장자리
    ctx.fillStyle = o.level >= 3 ? '#d9553f' : '#c94f3d';
    for (let i = 0; i < STORE.cols * 2 + 1; i++) { ctx.beginPath(); ctx.arc(ox - cs * 0.2 + (i + 0.5) * cs * 0.5, oy, cs * 0.25, 0, Math.PI); ctx.fill(); }
    // 간판 (2일차 이상 해금 시)
    if (o.level >= 2) {
      ctx.fillStyle = '#3a2418'; const sw = cs * 2.6; ctx.fillRect(ox + cs * STORE.cols / 2 - sw / 2, tentY - cs * 0.02 - 2, sw, cs * 0.34);
      ctx.fillStyle = '#ffe27a'; ctx.font = `bold ${Math.round(cs * 0.22)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('괴물 포장마차', ox + cs * STORE.cols / 2, tentY + cs * 0.15 - 2);
    }
    // 조명 줄 (3일차 이상)
    if (o.level >= 3) {
      for (let i = 0; i <= STORE.cols * 2; i++) { const lx = ox + i * cs * 0.5; const ly = oy + cs * 0.12 + Math.sin(i * 0.9) * 2; const on = Math.sin(o.time * 3 + i) > -0.3; ctx.fillStyle = on ? (i % 2 ? '#ffd23f' : '#ff8fd8') : '#6b5a3a'; ctx.beginPath(); ctx.arc(lx, ly, cs * 0.05, 0, Math.PI * 2); ctx.fill(); }
    }
    // 바닥
    ctx.fillStyle = '#5a3f2e'; ctx.fillRect(ox, oy, cs * STORE.cols, cs * STORE.rows);
    for (let y = 0; y < STORE.rows; y++) for (let x = 0; x < STORE.cols; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#64493a' : '#5c4232'; ctx.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let x = 0; x <= STORE.cols; x++) { ctx.beginPath(); ctx.moveTo(ox + x * cs, oy); ctx.lineTo(ox + x * cs, oy + cs * STORE.rows); ctx.stroke(); }
    for (let y = 0; y <= STORE.rows; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * cs); ctx.lineTo(ox + cs * STORE.cols, oy + y * cs); ctx.stroke(); }
    // 배식구
    const k = this.cellCenter(STORE.kitchen);
    ctx.fillStyle = '#7a5a45'; ctx.fillRect(k.x - cs * 0.48, k.y - cs * 0.48, cs * 0.96, cs * 0.96);
    ctx.fillStyle = '#3a2418'; ctx.fillRect(k.x - cs * 0.48, k.y - cs * 0.48, cs * 0.96, cs * 0.22);
    ctx.fillStyle = '#f1c34f'; ctx.fillRect(k.x - cs * 0.36, k.y - cs * 0.2, cs * 0.72, cs * 0.22);
    ctx.fillStyle = '#ffe27a'; ctx.font = `bold ${Math.round(cs * 0.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('배식구', k.x, k.y + cs * 0.3);
    // 출입구
    const e = this.cellCenter(STORE.entrance);
    ctx.fillStyle = '#8a3a3a'; ctx.fillRect(e.x - cs * 0.42, e.y - cs * 0.42, cs * 0.84, cs * 0.84);
    ctx.fillStyle = '#b84a4a'; ctx.fillRect(e.x - cs * 0.34, e.y - cs * 0.34, cs * 0.68, cs * 0.68);
    ctx.fillStyle = '#ffe27a'; ctx.font = `bold ${Math.round(cs * 0.2)}px sans-serif`; ctx.fillText('입구', e.x, e.y);
    // 경로 미리보기
    if (o.paths) for (const p of o.paths) this.drawPath(p.path, p.color ?? '#ffe27a');
    // 가구
    const furniture = run ? run.furniture : layout;
    for (const f of furniture) this.drawFurniture(f, o, f.id === o.selectedId);
    if (o.ghost) this.drawGhost(o.ghost);
    // 손님·직원
    if (run) {
      const seated = run.customers.filter((c) => c.state === 'ordering' || c.state === 'accepted' || c.state === 'eating');
      const walking = run.customers.filter((c) => c.state === 'walking' || c.state === 'leaving');
      for (const c of seated) this.drawCustomer(c, o.time, run);
      for (const c of walking) this.drawCustomer(c, o.time, run);
      this.drawStaff(run, o.time, o.staffSpeedLevel);
      // 대기줄
      const laneY = oy + cs * STORE.rows + cs * 0.5;
      run.queue.forEach((id, i) => {
        const c = run.customers.find((x) => x.id === id)!;
        const x = e.x - (i + 0.9) * cs * 0.8; const y = laneY;
        this.drawMonster(c.type, x, y, cs * 0.34, o.time + i, { mood: c.queuePatience / c.queuePatienceMax < 0.35 ? 'worried' : 'neutral' });
        // 대기 인내 막대
        const bw = cs * 0.5; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - bw / 2, y + cs * 0.24, bw, 4);
        ctx.fillStyle = c.queuePatience / c.queuePatienceMax > 0.35 ? '#7ed957' : '#ff6b6b'; ctx.fillRect(x - bw / 2, y + cs * 0.24, bw * Math.max(0, c.queuePatience / c.queuePatienceMax), 4);
      });
      if (run.queue.length) { ctx.fillStyle = '#fff'; ctx.font = `${Math.round(cs * 0.2)}px sans-serif`; ctx.textAlign = 'right'; ctx.fillText(`대기줄 ${run.queue.length}명`, e.x + cs * 0.45, laneY - cs * 0.28); }
    }
    // 비
    if (o.weather === 'rain') {
      ctx.save(); ctx.strokeStyle = 'rgba(180,200,255,0.35)'; ctx.lineWidth = 1;
      for (const r of this.rain) { r.y += dt * r.s * 0.9; if (r.y > 1) { r.y = -0.05; r.x = Math.random(); } const rx = r.x * w; const ry = r.y * h; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + cs * 0.22); ctx.stroke(); }
      ctx.restore();
    }
    // 파티클
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 90 * dt;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.text) { ctx.fillStyle = p.color; ctx.font = `bold ${Math.round(cs * 0.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y); }
      else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawPath(path: Cell[], color: string): void {
    if (!path.length) return;
    const ctx = this.ctx; const { cs } = this.geom;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.setLineDash([cs * 0.18, cs * 0.12]); ctx.lineCap = 'round';
    ctx.beginPath(); const s = this.cellCenter(STORE.kitchen); ctx.moveTo(s.x, s.y);
    for (const c of path) { const p = this.cellCenter(c); ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.restore();
    const end = this.cellCenter(path[path.length - 1]);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(end.x, end.y, cs * 0.09, 0, Math.PI * 2); ctx.fill();
  }

  drawFurniture(f: Furniture, o: DrawOpts, selected: boolean): void {
    const ctx = this.ctx; const { cs } = this.geom; const p = this.cellCenter(f);
    if (selected) { ctx.save(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeRect(p.x - cs * 0.47, p.y - cs * 0.47, cs * 0.94, cs * 0.94); ctx.restore(); }
    if (f.kind === 'seat') {
      // 테이블 + 의자
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + cs * 0.3, cs * 0.36, cs * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a2e1a'; ctx.fillRect(p.x - cs * 0.06, p.y - cs * 0.05, cs * 0.12, cs * 0.3);
      ctx.fillStyle = o.level >= 4 ? '#c98a55' : '#a86f45'; ctx.beginPath(); ctx.ellipse(p.x, p.y - cs * 0.02, cs * 0.38, cs * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a2e1a'; ctx.lineWidth = 2; ctx.stroke();
      if (o.level >= 4) { ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(p.x + cs * 0.2, p.y - cs * 0.06, cs * 0.05, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#6b4a3a'; ctx.beginPath(); ctx.ellipse(p.x, p.y + cs * 0.3, cs * 0.14, cs * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // 등불 장식
      ctx.fillStyle = 'rgba(255,200,90,0.14)'; ctx.beginPath(); ctx.arc(p.x, p.y - cs * 0.1, cs * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a2e1a'; ctx.fillRect(p.x - cs * 0.03, p.y - cs * 0.1, cs * 0.06, cs * 0.45);
      ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); ctx.moveTo(p.x - cs * 0.2, p.y - cs * 0.38); ctx.lineTo(p.x + cs * 0.2, p.y - cs * 0.38); ctx.lineTo(p.x + cs * 0.15, p.y - cs * 0.02); ctx.lineTo(p.x - cs * 0.15, p.y - cs * 0.02); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a83a1a'; ctx.lineWidth = 1.5; ctx.stroke();
      const g = 0.6 + 0.4 * Math.sin(o.time * 4 + f.id);
      ctx.fillStyle = `rgba(255,226,122,${0.5 + 0.4 * g})`; ctx.beginPath(); ctx.ellipse(p.x, p.y - cs * 0.2, cs * 0.07, cs * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawGhost(g: { kind: 'seat' | 'decor'; cell: Cell; ok: boolean }): void {
    const ctx = this.ctx; const { cs } = this.geom; const p = this.cellCenter(g.cell);
    ctx.save(); ctx.globalAlpha = 0.55;
    this.drawFurniture({ id: -1, kind: g.kind, x: g.cell.x, y: g.cell.y }, { time: 0, weather: 'clear', level: 1, staffSpeedLevel: 0 }, false);
    ctx.globalAlpha = 1; ctx.strokeStyle = g.ok ? '#7ed957' : '#ff6b6b'; ctx.lineWidth = 3; ctx.strokeRect(p.x - cs * 0.47, p.y - cs * 0.47, cs * 0.94, cs * 0.94);
    ctx.restore();
  }

  drawCustomer(c: Customer, time: number, run: RunState): void {
    const { cs } = this.geom;
    const p = { x: this.geom.ox + (c.pos.x + 0.5) * cs, y: this.geom.oy + (c.pos.y + 0.5) * cs };
    const sitting = c.state === 'ordering' || c.state === 'accepted' || c.state === 'eating';
    const ratio = c.orderPatienceMax > 0 ? c.orderPatience / c.orderPatienceMax : 1;
    const mood = c.state === 'eating' ? 'eating' : c.state === 'accepted' ? 'happy' : c.state === 'leaving' ? (c.leaveReason === 'served' ? 'happy' : 'sad') : ratio < 0.3 ? 'worried' : 'neutral';
    const y = sitting ? p.y - cs * 0.16 : p.y;
    this.drawMonster(c.type, p.x, y, cs * (sitting ? 0.3 : 0.34), time + c.id * 0.7, { mood, walking: !sitting });
    // 주문 말풍선 (착석·주문 대기 중)
    if (c.state === 'ordering' || c.state === 'accepted') {
      const bw = cs * (0.34 + 0.3 * (c.order.items.length - 1)); const bh = cs * 0.36; const bx = p.x - bw / 2; const by = y - cs * 0.62;
      this.ctx.fillStyle = c.state === 'accepted' ? '#d7ffd9' : '#fff8ee'; this.ctx.strokeStyle = ratio < 0.3 && c.state === 'ordering' ? '#ff6b6b' : '#3a2418'; this.ctx.lineWidth = 1.5;
      this.roundRect(bx, by, bw, bh, 5); this.ctx.fill(); this.ctx.stroke();
      c.order.items.forEach((it, i) => { const img = iconImage(it.family, it.tier); if (img.complete) this.ctx.drawImage(img, bx + 2 + i * cs * 0.3, by + 2, bh - 4, bh - 4); });
      // 인내 막대
      if (c.state === 'ordering') { this.ctx.fillStyle = 'rgba(0,0,0,0.5)'; this.ctx.fillRect(bx, by + bh + 1, bw, 3); this.ctx.fillStyle = ratio > 0.6 ? '#7ed957' : ratio > 0.3 ? '#ffd23f' : '#ff6b6b'; this.ctx.fillRect(bx, by + bh + 1, bw * Math.max(0, ratio), 3); }
    }
    if (c.state === 'eating') { const img = c.order.items[0] ? iconImage(c.order.items[0].family, c.order.items[0].tier) : null; if (img && img.complete) { const s = cs * 0.28; this.ctx.globalAlpha = 0.5 + 0.5 * Math.max(0, c.eatTimer / Math.max(1, CUSTOMER_DEFS[c.type].eatTime)); this.ctx.drawImage(img, p.x - s / 2, p.y + cs * 0.05, s, s); this.ctx.globalAlpha = 1; } }
    void run;
  }

  drawStaff(run: RunState, time: number, speedLevel: number): void {
    const ctx = this.ctx; const { cs } = this.geom; const st = run.staff;
    const p = { x: this.geom.ox + (st.pos.x + 0.5) * cs, y: this.geom.oy + (st.pos.y + 0.5) * cs };
    const moving = st.phase === 'toSeat' || st.phase === 'returning';
    const bob = moving ? Math.abs(Math.sin(time * 12)) * cs * 0.05 : 0;
    const s = cs * 0.34; const y = p.y - bob;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + s * 0.6, s * 0.5, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // 몸
    ctx.fillStyle = speedLevel >= 2 ? '#ff9f43' : speedLevel === 1 ? '#ff7f66' : '#ff6b6b'; this.roundRect(p.x - s * 0.36, y - s * 0.05, s * 0.72, s * 0.65, s * 0.15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(p.x - s * 0.2, y + s * 0.1, s * 0.4, s * 0.45); // 앞치마
    // 머리
    ctx.fillStyle = '#ffe0b8'; ctx.beginPath(); ctx.arc(p.x, y - s * 0.35, s * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(p.x, y - s * 0.62, s * 0.34, s * 0.2, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(p.x - s * 0.34, y - s * 0.62, s * 0.68, s * 0.1);
    ctx.fillStyle = '#1c1430'; ctx.beginPath(); ctx.arc(p.x - s * 0.1, y - s * 0.36, s * 0.05, 0, Math.PI * 2); ctx.arc(p.x + s * 0.1, y - s * 0.36, s * 0.05, 0, Math.PI * 2); ctx.fill();
    // 강화 장비: 1단계 롤러 스케이트, 2단계 반짝이는 쟁반 + 스케이트
    if (speedLevel >= 1) { ctx.fillStyle = '#5cc8f2'; ctx.fillRect(p.x - s * 0.36, y + s * 0.6, s * 0.3, s * 0.12); ctx.fillRect(p.x + s * 0.06, y + s * 0.6, s * 0.3, s * 0.12); }
    // 쟁반 + 음식
    if (st.carrying != null) {
      const c = run.customers.find((x) => x.id === st.carrying);
      ctx.fillStyle = speedLevel >= 2 ? '#ffe27a' : '#cfcfcf'; ctx.beginPath(); ctx.ellipse(p.x + s * 0.45, y - s * 0.02, s * 0.42, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      if (c) c.order.items.forEach((it, i) => { const img = iconImage(it.family, it.tier); if (img.complete) ctx.drawImage(img, p.x + s * 0.15 + i * s * 0.3, y - s * 0.42, s * 0.4, s * 0.4); });
    }
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  /** 손님 6종: 실루엣과 동작으로 구분 */
  drawMonster(type: CustomerType, x: number, y: number, s: number, t: number, o: { mood: 'neutral' | 'worried' | 'happy' | 'eating' | 'sad'; walking?: boolean }): void {
    const ctx = this.ctx; const d = CUSTOMER_DEFS[type];
    ctx.save();
    const eye = (ex: number, ey: number, r: number) => { ctx.fillStyle = '#1c1430'; ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.3, ey - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill(); };
    const mouth = (mx: number, my: number, w: number) => { ctx.strokeStyle = '#1c1430'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineCap = 'round'; ctx.beginPath(); if (o.mood === 'sad' || o.mood === 'worried') { ctx.moveTo(mx - w, my + w * 0.4); ctx.quadraticCurveTo(mx, my - w * 0.4, mx + w, my + w * 0.4); } else if (o.mood === 'eating') { const op = 0.3 + 0.3 * Math.abs(Math.sin(t * 9)); ctx.ellipse(mx, my, w * 0.6, w * op, 0, 0, Math.PI * 2); } else { ctx.moveTo(mx - w, my - w * 0.2); ctx.quadraticCurveTo(mx, my + w * 0.6, mx + w, my - w * 0.2); } ctx.stroke(); };
    switch (type) {
      case 'slime': {
        const sq = 1 + 0.1 * Math.sin(t * (o.walking ? 9 : 4)); // 말랑 바운스
        ctx.translate(x, y + s * 0.4); ctx.scale(1 / sq, sq); ctx.translate(-x, -(y + s * 0.4));
        ctx.fillStyle = d.color; ctx.strokeStyle = d.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.4); ctx.quadraticCurveTo(x - s * 0.55, y - s * 0.5, x, y - s * 0.5); ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.5, x + s * 0.5, y + s * 0.4); ctx.quadraticCurveTo(x, y + s * 0.55, x - s * 0.5, y + s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(x - s * 0.2, y - s * 0.25, s * 0.12, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        eye(x - s * 0.18, y, s * 0.08); eye(x + s * 0.18, y, s * 0.08); mouth(x, y + s * 0.2, s * 0.15);
        break;
      }
      case 'goblin': {
        const hop = o.walking ? Math.abs(Math.sin(t * 10)) * s * 0.15 : Math.abs(Math.sin(t * 5)) * s * 0.06; y -= hop;
        ctx.fillStyle = '#f3d27a'; ctx.strokeStyle = d.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.35); ctx.lineTo(x - s * 0.42, y - s * 0.7); ctx.lineTo(x - s * 0.12, y - s * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.3, y - s * 0.35); ctx.lineTo(x + s * 0.42, y - s * 0.7); ctx.lineTo(x + s * 0.12, y - s * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.color; ctx.strokeStyle = d.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // 신나는 팔
        const arm = Math.sin(t * 8) * s * 0.15; ctx.strokeStyle = d.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - s * 0.4, y + s * 0.1); ctx.lineTo(x - s * 0.62, y - s * 0.1 - arm); ctx.moveTo(x + s * 0.4, y + s * 0.1); ctx.lineTo(x + s * 0.62, y - s * 0.1 + arm); ctx.stroke();
        eye(x - s * 0.17, y - s * 0.05, s * 0.08); eye(x + s * 0.17, y - s * 0.05, s * 0.08); mouth(x, y + s * 0.18, s * 0.16);
        break;
      }
      case 'ghost': {
        y += Math.sin(t * 2.2) * s * 0.12; // 부유
        ctx.globalAlpha = 0.88; ctx.fillStyle = d.color; ctx.strokeStyle = d.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - s * 0.05, s * 0.42, Math.PI, 0); ctx.lineTo(x + s * 0.42, y + s * 0.45);
        for (let i = 0; i < 4; i++) { const wx = x + s * 0.42 - (i + 0.5) * s * 0.21; ctx.lineTo(wx, y + s * 0.45 + (i % 2 ? s * 0.1 : -s * 0.05) + Math.sin(t * 4 + i) * s * 0.03); }
        ctx.lineTo(x - s * 0.42, y + s * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        eye(x - s * 0.15, y - s * 0.05, s * 0.07); eye(x + s * 0.15, y - s * 0.05, s * 0.07); mouth(x, y + s * 0.15, s * 0.1);
        ctx.fillStyle = 'rgba(255,179,198,0.7)'; ctx.beginPath(); ctx.arc(x - s * 0.28, y + s * 0.1, s * 0.07, 0, Math.PI * 2); ctx.arc(x + s * 0.28, y + s * 0.1, s * 0.07, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bat': {
        const flap = Math.sin(t * 16) * 0.5; // 빠른 날갯짓
        ctx.fillStyle = d.accent; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y); ctx.quadraticCurveTo(x - s * 0.7, y - s * 0.3 - flap * s * 0.3, x - s * 0.9, y + s * 0.1 - flap * s * 0.3); ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.15, x - s * 0.3, y + s * 0.2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + s * 0.3, y); ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.3 - flap * s * 0.3, x + s * 0.9, y + s * 0.1 - flap * s * 0.3); ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.15, x + s * 0.3, y + s * 0.2); ctx.fill();
        ctx.fillStyle = d.color; ctx.strokeStyle = d.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - s * 0.25, y - s * 0.3); ctx.lineTo(x - s * 0.35, y - s * 0.65); ctx.lineTo(x - s * 0.05, y - s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.25, y - s * 0.3); ctx.lineTo(x + s * 0.35, y - s * 0.65); ctx.lineTo(x + s * 0.05, y - s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        eye(x - s * 0.15, y - s * 0.05, s * 0.08); eye(x + s * 0.15, y - s * 0.05, s * 0.08); mouth(x, y + s * 0.16, s * 0.1);
        ctx.fillStyle = '#fff'; ctx.fillRect(x - s * 0.1, y + s * 0.14, s * 0.05, s * 0.08); ctx.fillRect(x + s * 0.05, y + s * 0.14, s * 0.05, s * 0.08);
        break;
      }
      case 'golem': {
        const step = o.walking ? (Math.floor(t * 3) % 2 ? s * 0.08 : 0) : 0; y -= step; // 묵직한 걸음
        ctx.fillStyle = d.color; ctx.strokeStyle = d.accent; ctx.lineWidth = 2;
        this.roundRect(x - s * 0.5, y - s * 0.45, s, s * 0.95, s * 0.12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b5ad9c'; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.45); ctx.lineTo(x - s * 0.35, y - s * 0.62); ctx.lineTo(x + s * 0.35, y - s * 0.62); ctx.lineTo(x + s * 0.5, y - s * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = d.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - s * 0.35, y - s * 0.2); ctx.lineTo(x - s * 0.2, y - s * 0.1); ctx.moveTo(x + s * 0.2, y + s * 0.3); ctx.lineTo(x + s * 0.38, y + s * 0.2); ctx.stroke();
        eye(x - s * 0.18, y - s * 0.12, s * 0.07); eye(x + s * 0.18, y - s * 0.12, s * 0.07); mouth(x, y + s * 0.15, s * 0.16);
        ctx.fillStyle = '#7ed957'; ctx.beginPath(); ctx.arc(x + s * 0.35, y - s * 0.35, s * 0.06, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'witch': {
        y += Math.sin(t * 3) * s * 0.05;
        ctx.fillStyle = '#3a2a5a'; ctx.strokeStyle = '#1c1430'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.0); ctx.lineTo(x + s * 0.3, y - s * 0.42); ctx.lineTo(x - s * 0.3, y - s * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
        this.roundRect(x - s * 0.55, y - s * 0.48, s * 1.1, s * 0.14, s * 0.05); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.color; ctx.strokeStyle = d.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        eye(x - s * 0.15, y - s * 0.03, s * 0.08); eye(x + s * 0.15, y - s * 0.03, s * 0.08); mouth(x, y + s * 0.18, s * 0.13);
        // 작은 마법 반짝임
        for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; const rx = x + Math.cos(a) * s * 0.7; const ry = y - s * 0.2 + Math.sin(a * 1.3) * s * 0.4; ctx.fillStyle = i ? '#ffe27a' : '#7fd3ff'; ctx.beginPath(); ctx.arc(rx, ry, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
    }
    if (o.mood === 'worried') { ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); ctx.ellipse(x + s * 0.5, y - s * 0.35, s * 0.06, s * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    if (o.mood === 'happy' && !o.walking) { ctx.fillStyle = '#ff8fd8'; const hy = y - s * 0.7 - Math.abs(Math.sin(t * 3)) * s * 0.1; ctx.beginPath(); ctx.arc(x + s * 0.45, hy, s * 0.06, 0, Math.PI * 2); ctx.arc(x + s * 0.55, hy, s * 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
