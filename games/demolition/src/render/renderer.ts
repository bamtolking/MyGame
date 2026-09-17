// Canvas 2D 렌더러. 물리 월드(540×960 설계 좌표)를 화면에 맞춰 그린다. 물리에는 관여하지 않는다.
import Matter from 'matter-js';
import type { LevelSession } from '../sim/session';
import type { BodyEntry } from '../sim/world';
import type { Vec2, Rect, Material } from '../sim/types';
import { WORLD_W, WORLD_H, GROUND_Y, LAUNCH, PROJECTILE } from '../data/physics';
import { Effects } from './effects';

export interface ViewState {
  aiming: boolean;            // 현재 드래그 중
  drag: Vec2 | null;          // 제한된 당김 벡터(월드)
  preview: Vec2[];            // 미리보기 점
  power: number;              // 0..1
  highlight: Set<string>;     // 힌트 강조 id
  hintShot: { angleDeg: number; power: number } | null;
  debug: boolean;
  time: number;               // 초(연출용)
  recoil: number;             // 발사 반동 0..1
  resultFlash: number;
}

const COLORS = {
  sky1: '#8ec5e8', sky2: '#dbeef8', ground: '#8a6a4a', groundTop: '#a98963', dirt: '#6d5238',
  wood: '#c99a5b', woodDark: '#8f6a3a', woodLine: '#a67c45',
  metal: '#9aa6b2', metalDark: '#5f6b78', metalLight: '#d6dde4',
  stone: '#b9b3a6', stoneDark: '#8c877c', stoneLine: '#a09a8d',
  iron: '#4b525c', ironLight: '#8b949f',
  crate: '#e0b25c', crateDark: '#8a6420', crateTrim: '#ffe08a',
  target: '#ffd23f', targetStripe: '#1c1c1c',
  rope: '#c8a46a', ropeDark: '#8d6e3c',
  cutter: '#dfe6ee', cutterDark: '#6c7784', blade: '#ff8a3d',
};

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  scale = 1; ox = 0; oy = 0; cw = 0; ch = 0; dpr = 1;
  readonly effects = new Effects();
  private patterns = new Map<string, CanvasPattern>();

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(1, Math.round(rect.width)); this.ch = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.cw * this.dpr); this.canvas.height = Math.round(this.ch * this.dpr);
    this.scale = Math.min(this.cw / WORLD_W, this.ch / WORLD_H);
    this.ox = (this.cw - WORLD_W * this.scale) / 2;
    this.oy = (this.ch - WORLD_H * this.scale) / 2;
  }

  toWorld(clientX: number, clientY: number): Vec2 {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
  }

  private pattern(name: string, make: (c: CanvasRenderingContext2D, s: number) => void, size = 32): CanvasPattern {
    let p = this.patterns.get(name);
    if (p) return p;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const cx = c.getContext('2d')!; make(cx, size);
    p = this.ctx.createPattern(c, 'repeat')!;
    this.patterns.set(name, p);
    return p;
  }

  draw(session: LevelSession | null, view: ViewState) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    // 배경(전체 캔버스)
    const g = ctx.createLinearGradient(0, 0, 0, this.ch);
    g.addColorStop(0, COLORS.sky1); g.addColorStop(1, COLORS.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.cw, this.ch);
    const sh = this.effects.shakeOffset();
    ctx.translate(this.ox + sh.x * this.scale, this.oy + sh.y * this.scale);
    ctx.scale(this.scale, this.scale);
    this.drawBackdrop(session);
    if (!session) return;
    const lv = session.level;
    // 구역 표시
    for (const goal of lv.goals) if (goal.judge === 'drop' && goal.zone) this.drawDropZone(goal.zone, session.goals.find((g) => g.body === goal.body)?.achieved ?? false);
    for (const p of lv.protects ?? []) this.drawSafeZone(p.safeZone, session.protects.find((q) => q.body === p.body)?.failed ?? false);
    // 힌지 받침(장식)
    for (const h of session.world.hinges.values()) if (h.def.post !== false) this.drawHingePost(h.def.pivot);
    // 물체: 정적 → 동적
    const entries = [...session.world.entries.values()].filter((e) => !e.removed && e.kind !== 'ground');
    for (const e of entries) if (e.isStatic) this.drawEntry(e, session, view);
    for (const e of entries) if (!e.isStatic) this.drawEntry(e, session, view);
    // 힌지 볼트
    for (const h of session.world.hinges.values()) this.drawBolt(h.def.pivot, h.entry.body.angle);
    // 밧줄
    for (const r of session.world.ropes.values()) if (!r.cut) { const { a, b } = session.world.ropeEndpoints(r); this.drawRope(a, b, view.highlight.has(r.id), view.time); }
    this.effects.drawSnaps(ctx);
    // 발사대 + 조준
    this.drawLauncher(session, view);
    this.effects.drawParticles(ctx);
    if (view.debug) this.drawDebug(session);
  }

  private drawBackdrop(session: LevelSession | null) {
    const ctx = this.ctx;
    // 먼 크레인 실루엣
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#2b3a4a';
    ctx.fillRect(60, 250, 8, 400); ctx.fillRect(60, 250, 260, 8); ctx.fillRect(300, 250, 6, 60);
    ctx.fillRect(420, 330, 8, 320); ctx.fillRect(330, 330, 180, 8);
    for (let i = 0; i < 4; i++) { ctx.fillRect(120 + i * 110, 560 + (i % 2) * 40, 70, 90 - (i % 2) * 40); }
    ctx.restore();
    // 바닥
    const segs = session?.level.ground ?? [{ from: -600, to: WORLD_W + 600 }];
    for (const s of segs) {
      ctx.fillStyle = COLORS.ground; ctx.fillRect(s.from, GROUND_Y, s.to - s.from, WORLD_H - GROUND_Y + 200);
      ctx.fillStyle = COLORS.groundTop; ctx.fillRect(s.from, GROUND_Y, s.to - s.from, 10);
      ctx.fillStyle = this.pattern('dirt', (c, sz) => { c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 9; i++) { const x = (i * 37) % sz, y = (i * 53) % sz; c.beginPath(); c.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); c.fill(); } });
      ctx.fillRect(s.from, GROUND_Y + 10, s.to - s.from, WORLD_H - GROUND_Y);
      // 위험 테이프
      ctx.fillStyle = this.pattern('tape', (c, sz) => { c.fillStyle = '#e9c633'; c.fillRect(0, 0, sz, sz); c.fillStyle = '#222'; c.beginPath(); c.moveTo(0, sz); c.lineTo(sz / 2, 0); c.lineTo(sz, 0); c.lineTo(sz / 2, sz); c.closePath(); c.fill(); }, 16);
      ctx.fillRect(s.from, GROUND_Y - 4, s.to - s.from, 4);
    }
    // 구덩이 바닥(어둡게)
    for (let i = 0; i + 1 < segs.length; i++) { ctx.fillStyle = '#2b2118'; ctx.fillRect(segs[i].to, GROUND_Y, segs[i + 1].from - segs[i].to, WORLD_H - GROUND_Y + 200); }
  }

  private drawDropZone(z: Rect, done: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.pattern('hatch', (c, sz) => { c.strokeStyle = 'rgba(126,217,87,0.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-4, sz + 4); c.lineTo(sz + 4, -4); c.moveTo(-4, 4); c.lineTo(4, -4); c.moveTo(sz - 4, sz + 4); c.lineTo(sz + 4, sz - 4); c.stroke(); }, 20);
    ctx.fillRect(z.x, z.y, z.w, Math.min(z.h, WORLD_H - z.y));
    ctx.strokeStyle = done ? '#7ed957' : 'rgba(126,217,87,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
    ctx.strokeRect(z.x, z.y, z.w, Math.min(z.h, WORLD_H - z.y));
    ctx.setLineDash([]);
    ctx.fillStyle = '#2f6b1f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(done ? '낙하 완료 ✓' : '▼ 낙하 구역', z.x + z.w / 2, Math.min(z.y, GROUND_Y) - 8);
    ctx.restore();
  }

  private drawSafeZone(z: Rect, failed: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = failed ? 'rgba(255,92,92,0.18)' : 'rgba(80,200,255,0.14)';
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = failed ? '#ff5c5c' : '#3fb6ff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
    ctx.fillStyle = failed ? '#c62828' : '#1f6f9c'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(failed ? '안전 구역 이탈!' : '보호상자 안전 구역', z.x + z.w / 2, z.y - 6);
    ctx.restore();
  }

  private drawHingePost(p: Vec2) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.metalDark;
    ctx.beginPath(); ctx.moveTo(p.x - 26, GROUND_Y); ctx.lineTo(p.x + 26, GROUND_Y); ctx.lineTo(p.x + 6, p.y + 4); ctx.lineTo(p.x - 6, p.y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.metal; ctx.fillRect(p.x - 3, p.y, 6, GROUND_Y - p.y);
  }
  private drawBolt(p: Vec2, angle: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle);
    ctx.fillStyle = COLORS.metalDark; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.metalLight; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.metalDark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.restore();
  }

  private drawRope(a: Vec2, b: Vec2, highlight: boolean, time: number) {
    const ctx = this.ctx;
    ctx.save();
    if (highlight) { ctx.strokeStyle = `rgba(255,214,0,${0.5 + 0.4 * Math.sin(time * 8)})`; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.strokeStyle = COLORS.ropeDark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = COLORS.rope; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // 꼬임 무늬
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.strokeStyle = COLORS.ropeDark; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let t = 6; t < len; t += 8) { const px = a.x + dx * (t / len), py = a.y + dy * (t / len); ctx.moveTo(px - nx * 2, py - ny * 2); ctx.lineTo(px + dx / len * 3 + nx * 2, py + dy / len * 3 + ny * 2); }
    ctx.stroke();
    // 고리
    for (const p of [a, b]) { ctx.fillStyle = COLORS.metalDark; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.metalLight; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  private drawEntry(e: BodyEntry, session: LevelSession, view: ViewState) {
    const ctx = this.ctx;
    const b = e.body;
    const hl = view.highlight.has(e.id);
    ctx.save();
    if (e.kind === 'ramp' || e.kind === 'poly') {
      this.polyPath(b.vertices);
      ctx.fillStyle = this.materialFill(e.material);
      ctx.fill();
      ctx.strokeStyle = COLORS.stoneDark; ctx.lineWidth = 2; ctx.stroke();
      // 경사 방향 표시(화살표 세 개)
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const vs = b.vertices; const top = vs.reduce((m, v) => (v.y < m.y ? v : m), vs[0]);
      const other = vs.find((v) => v !== top && Math.abs(v.y - top.y) > 5 && Math.abs(v.x - top.x) > 5);
      if (other) { for (let k = 0.25; k < 1; k += 0.25) { const px = top.x + (other.x - top.x) * k, py = top.y + (other.y - top.y) * k; const dir = Math.sign(other.x - top.x); ctx.beginPath(); ctx.moveTo(px - dir * 6, py - 4); ctx.lineTo(px + dir * 4, py + 2); ctx.lineTo(px - dir * 6, py + 8); ctx.closePath(); ctx.fill(); } }
      if (hl) this.highlightPath(b.vertices, view.time);
      ctx.restore();
      return;
    }
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    if (e.kind === 'ball' || e.kind === 'projectile') {
      this.drawCircle(e, view);
    } else {
      this.drawBlock(e, session, view);
    }
    ctx.restore();
    if (hl) { ctx.save(); this.highlightPath(b.vertices, view.time); ctx.restore(); }
    // 잔상
    if (e.kind === 'projectile') {
      const t = this.effects.trails.get(e.id);
      if (t && t.length > 1) { ctx.save(); for (let i = 0; i < t.length - 1; i++) { ctx.globalAlpha = (i / t.length) * 0.35; ctx.fillStyle = COLORS.cutter; ctx.beginPath(); ctx.arc(t[i].x, t[i].y, e.r * (0.4 + 0.5 * i / t.length), 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    }
  }

  private polyPath(vs: Matter.Vector[]) {
    const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(vs[0].x, vs[0].y); for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y); ctx.closePath();
  }
  private highlightPath(vs: Matter.Vector[], time: number) {
    const ctx = this.ctx; this.polyPath(vs); ctx.strokeStyle = `rgba(255,214,0,${0.55 + 0.4 * Math.sin(time * 8)})`; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
  }

  private materialFill(m: Material): string | CanvasPattern {
    switch (m) {
      case 'wood': return this.pattern('wood', (c, sz) => { c.fillStyle = COLORS.wood; c.fillRect(0, 0, sz, sz); c.strokeStyle = COLORS.woodLine; c.lineWidth = 1.5; for (let y = 4; y < sz; y += 8) { c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(sz * 0.3, y - 2, sz * 0.6, y + 2, sz, y); c.stroke(); } });
      case 'metal': return this.pattern('metal', (c, sz) => { const g = c.createLinearGradient(0, 0, 0, sz); g.addColorStop(0, COLORS.metalLight); g.addColorStop(0.5, COLORS.metal); g.addColorStop(1, COLORS.metalDark); c.fillStyle = g; c.fillRect(0, 0, sz, sz); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, sz, 3); });
      case 'stone': return this.pattern('stone', (c, sz) => { c.fillStyle = COLORS.stone; c.fillRect(0, 0, sz, sz); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc((i * 29) % sz, (i * 47) % sz, 1.5 + (i % 3), 0, Math.PI * 2); c.fill(); } });
      case 'crate': return this.pattern('crate', (c, sz) => { c.fillStyle = COLORS.crate; c.fillRect(0, 0, sz, sz); c.strokeStyle = COLORS.crateDark; c.lineWidth = 2; c.strokeRect(1, 1, sz - 2, sz - 2); });
      case 'iron': return COLORS.iron;
      case 'cutter': return COLORS.cutter;
      default: return COLORS.ground;
    }
  }

  private drawBlock(e: BodyEntry, session: LevelSession, view: ViewState) {
    const ctx = this.ctx;
    const w = e.w, h = e.h;
    ctx.fillStyle = this.materialFill(e.material);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // 재질별 마감
    if (e.material === 'wood') {
      ctx.strokeStyle = COLORS.woodDark; ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 3);
      // 판자 이음선(긴 방향)
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      if (h > w) { for (let y = -h / 2 + 30; y < h / 2 - 8; y += 30) { ctx.beginPath(); ctx.moveTo(-w / 2 + 3, y); ctx.lineTo(w / 2 - 3, y); ctx.stroke(); } }
      else { for (let x = -w / 2 + 30; x < w / 2 - 8; x += 30) { ctx.beginPath(); ctx.moveTo(x, -h / 2 + 3); ctx.lineTo(x, h / 2 - 3); ctx.stroke(); } }
    } else if (e.material === 'metal') {
      ctx.strokeStyle = COLORS.metalDark; ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      ctx.fillStyle = COLORS.metalDark;
      const rx = Math.min(w, h) >= 30 ? 6 : 4;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - rx - 2), sy * (h / 2 - rx - 2), 2.5, 0, Math.PI * 2); ctx.fill(); }
    } else if (e.material === 'stone') {
      ctx.strokeStyle = COLORS.stoneDark; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
    } else if (e.material === 'crate') {
      ctx.strokeStyle = COLORS.crateDark; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3);
      ctx.strokeStyle = COLORS.crateTrim; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    }
    // 역할 표시
    if (e.role === 'target') {
      const goal = session.goals.find((g) => g.body === e.id);
      const done = goal?.achieved ?? false;
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = this.pattern('hazard', (c, sz) => { c.fillStyle = done ? '#7ed957' : COLORS.target; c.fillRect(0, 0, sz, sz); c.fillStyle = done ? '#2f6b1f' : COLORS.targetStripe; c.beginPath(); c.moveTo(0, sz); c.lineTo(sz / 2, 0); c.lineTo(sz, 0); c.lineTo(sz / 2, sz); c.closePath(); c.fill(); }, 12);
      ctx.strokeRect(-w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5);
      // 아이콘 태그
      const tagW = Math.min(w - 6, 34), tagH = 16;
      ctx.fillStyle = done ? '#2f6b1f' : '#1c1c1c'; ctx.fillRect(-tagW / 2, -tagH / 2, tagW, tagH);
      ctx.fillStyle = done ? '#b8f39a' : COLORS.target; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(done ? '✓' : (w >= 34 ? '철거' : '✖'), 0, 1);
      ctx.restore();
    } else if (e.role === 'protect') {
      ctx.save();
      ctx.fillStyle = '#7a4a10'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('보호', 0, -4);
      ctx.fillStyle = '#3fb6ff'; ctx.beginPath(); ctx.arc(0, 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } else if (e.role === 'support' && e.label) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.label, 0, 0); ctx.restore();
    } else if (e.role === 'weight') {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('추', 0, 0); ctx.restore();
    } else if (e.role === 'plank') {
      // 시소: 축 위치 눈금
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = -w / 2 + 12; x < w / 2 - 6; x += 24) ctx.fillRect(x, -h / 2 + 2, 2, h - 4);
    }
  }

  private drawCircle(e: BodyEntry, view: ViewState) {
    const ctx = this.ctx;
    const r = e.r;
    if (e.kind === 'projectile') {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, COLORS.cutter); g.addColorStop(1, COLORS.cutterDark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      // 절단 링(회전하는 톱니)
      ctx.strokeStyle = COLORS.blade; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = COLORS.blade;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1)); ctx.lineTo(Math.cos(a + 0.25) * (r + 3), Math.sin(a + 0.25) * (r + 3)); ctx.lineTo(Math.cos(a + 0.5) * (r - 1), Math.sin(a + 0.5) * (r - 1)); ctx.closePath(); ctx.fill(); }
    } else {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.15, 0, 0, r);
      g.addColorStop(0, COLORS.ironLight); g.addColorStop(0.7, COLORS.iron); g.addColorStop(1, '#22262c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      // 회전이 보이도록 볼트 무늬
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
      if (e.role === 'weight') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `bold ${Math.round(r * 0.6)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('추', 0, 1); }
    }
  }

  private drawLauncher(session: LevelSession, view: ViewState) {
    const ctx = this.ctx;
    const L = session.level.launcher;
    const canAim = session.state === 'aiming' && session.shotsLeft > 0;
    ctx.save();
    // 받침대
    ctx.fillStyle = COLORS.metalDark; ctx.fillRect(L.x - 34, GROUND_Y - 8, 68, 8);
    ctx.fillStyle = COLORS.metal; ctx.beginPath(); ctx.moveTo(L.x - 22, GROUND_Y - 8); ctx.lineTo(L.x + 22, GROUND_Y - 8); ctx.lineTo(L.x + 8, L.y + 8); ctx.lineTo(L.x - 8, L.y + 8); ctx.closePath(); ctx.fill();
    // 스프링/팔: 당김에 따라 압축 표현
    const drag = view.aiming && view.drag ? view.drag : null;
    const recoil = view.recoil;
    const armAngle = drag ? Math.atan2(drag.y, drag.x) : Math.atan2(-1, 1);
    const compress = drag ? Math.hypot(drag.x, drag.y) / LAUNCH.maxDrag : recoil * 0.4;
    ctx.translate(L.x, L.y); ctx.rotate(armAngle);
    const armLen = 44 * (1 - compress * 0.5);
    ctx.strokeStyle = COLORS.metalDark; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(armLen, 0); ctx.stroke();
    ctx.strokeStyle = COLORS.metalLight; ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const x = (armLen / 6) * i; ctx.lineTo(x, i % 2 ? 6 : -6); } ctx.stroke();
    ctx.restore();
    // 축 볼트
    ctx.fillStyle = COLORS.metalDark; ctx.beginPath(); ctx.arc(L.x, L.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.metalLight; ctx.beginPath(); ctx.arc(L.x, L.y, 3, 0, Math.PI * 2); ctx.fill();
    // 장전된 커터볼(조준 가능할 때) - 당김 위치에 표시
    if (canAim) {
      const bx = L.x + (drag?.x ?? 0), by = L.y + (drag?.y ?? 0);
      // 터치 영역 안내
      ctx.strokeStyle = view.aiming ? 'rgba(255,255,255,0.15)' : `rgba(255,255,255,${0.18 + 0.1 * Math.sin(view.time * 3)})`; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(L.x, L.y, LAUNCH.touchRadius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (drag) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.save(); ctx.translate(bx, by);
      const fake: BodyEntry = { id: 'loaded', kind: 'projectile', body: null as any, material: 'cutter', role: 'projectile', w: 0, h: 0, r: PROJECTILE.radius, isStatic: false, removed: false, init: { x: 0, y: 0, angle: 0 } };
      ctx.rotate(view.time * 4);
      this.drawCircle(fake, view);
      ctx.restore();
      // 미리보기 점선
      if (drag && view.preview.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        view.preview.forEach((p, i) => { const k = 1 - i / view.preview.length; ctx.globalAlpha = 0.25 + 0.65 * k; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5 - 2 * (1 - k), 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = 1;
        // 세기 표시
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`세기 ${Math.round(view.power * 100)}%`, L.x + 40, L.y - 40);
      }
      // 힌트 방향 화살표
      if (view.hintShot) {
        const a = (view.hintShot.angleDeg * Math.PI) / 180, len = 60 + 80 * view.hintShot.power;
        ctx.save(); ctx.strokeStyle = 'rgba(255,214,0,0.9)'; ctx.lineWidth = 5; ctx.setLineDash([10, 8]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(L.x + Math.cos(a) * len, L.y - Math.sin(a) * len); ctx.stroke(); ctx.setLineDash([]);
        const tx = L.x + Math.cos(a) * len, ty = L.y - Math.sin(a) * len;
        ctx.fillStyle = 'rgba(255,214,0,0.9)'; ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * 14, ty - Math.sin(a) * 14); ctx.lineTo(tx + Math.cos(a + 2.5) * 12, ty - Math.sin(a + 2.5) * 12); ctx.lineTo(tx + Math.cos(a - 2.5) * 12, ty - Math.sin(a - 2.5) * 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a5a00'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`이 방향, 세기 약 ${Math.round(view.hintShot.power * 100)}%`, tx, ty - 18);
        ctx.restore();
      }
    }
  }

  private drawDebug(session: LevelSession) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const e of session.world.entries.values()) {
      if (e.removed) continue;
      const b = e.body;
      this.polyPath(b.vertices);
      ctx.strokeStyle = b.isSleeping ? 'rgba(80,120,255,0.9)' : 'rgba(255,0,255,0.9)'; ctx.stroke();
      ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(e.id, b.position.x, b.position.y - 6);
    }
    for (const r of session.world.ropes.values()) { if (r.cut) continue; const { a, b } = session.world.ropeEndpoints(r); ctx.strokeStyle = '#0f0'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); for (const p of [a, b]) { ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); } }
    for (const h of session.world.hinges.values()) { const c = h.constraint; const p = { x: h.entry.body.position.x + c.pointB.x, y: h.entry.body.position.y + c.pointB.y }; ctx.strokeStyle = '#ff0'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(h.def.pivot.x, h.def.pivot.y, 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
}
