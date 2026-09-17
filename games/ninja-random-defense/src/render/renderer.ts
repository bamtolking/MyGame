// Canvas 2D 렌더러. 자기 판(GameState)과 남의 판(스냅샷) 모두 BoardView로 그립니다.
import type { GameState, SimEvent } from '../sim/types.ts';
import { FIELD_W, FIELD_H, CELL, COLS, ROWS, SLOT_COUNT, slotPos, slotAt, pathPos, PATH_LEN, MONSTER_CAP } from '../data/board.ts';
import { kindHex, GRADE_HEX, unitStats, type Kind, type Grade } from '../data/units.ts';
import { MONSTER_DEFS, type MonsterType } from '../data/monsters.ts';
import { unitSprite, monsterSprite, clearSpriteCache } from './sprites.ts';
import { Fx } from './fx.ts';
import { atkMul, aliveMonsters } from '../sim/state.ts';
import { snapUnits, snapMonsters, type BoardSnap } from '../sim/snapshot.ts';

export interface ViewUnit { slot: number; kind: Kind; grade: Grade; range?: number; cdFrac?: number }
export interface ViewMonster { x: number; y: number; type: MonsterType; boss: boolean; hpPct: number; stunned: boolean; slowed: boolean; dist: number }
export interface BoardView { units: ViewUnit[]; monsters: ViewMonster[]; selected: number | null; moveFrom: number | null; dragging: { kind: Kind; grade: Grade; x: number; y: number } | null; eliminated: boolean; remote: boolean; label?: string; monsterCount: number }

export class Renderer {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  scale = 1; ox = 0; oy = 0; dpr = 1; cssW = 0; cssH = 0;
  bg: HTMLCanvasElement | null = null;
  fx = new Fx();
  time = 0; shake = 0;
  showRanges = true;
  anim = new Map<number, number>(); // slot → 마지막 공격 시각(반동 연출)

  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false })!; }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1); this.cssW = cssW; this.cssH = cssH;
    this.canvas.width = Math.round(cssW * this.dpr); this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
    this.ox = (cssW - FIELD_W * this.scale) / 2; this.oy = (cssH - FIELD_H * this.scale) / 2;
    this.bg = null; clearSpriteCache();
  }
  toField(px: number, py: number): [number, number] { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  slotAtPx(px: number, py: number): number { const [x, y] = this.toField(px, py); return slotAt(x, y); }

  /** 자기 판 → 뷰 */
  static viewOf(s: GameState, selected: number | null, moveFrom: number | null, dragging: BoardView['dragging'], label?: string): BoardView {
    const am = atkMul(s);
    return {
      units: s.units.map(u => ({ slot: u.slot, kind: u.kind, grade: u.grade, range: unitStats(u.kind, u.grade, am).range, cdFrac: 0 })),
      monsters: s.monsters.filter(m => m.alive).map(m => ({ x: m.x, y: m.y, type: m.type, boss: m.boss, hpPct: m.hp / m.maxHp, stunned: m.stunT > 0, slowed: m.slowT > 0 || m.auraSlow > 0, dist: m.dist })),
      selected, moveFrom, dragging, eliminated: s.phase === 'eliminated', remote: false, label, monsterCount: aliveMonsters(s),
    };
  }
  /** 남의 판(스냅샷) → 뷰. elapsed = 스냅샷 수신 후 경과 초(위치 보간) */
  static viewOfSnap(b: BoardSnap, elapsed: number, label: string): BoardView {
    return { units: snapUnits(b), monsters: snapMonsters(b, elapsed, pathPos, PATH_LEN), selected: null, moveFrom: null, dragging: null, eliminated: b.ph === 'eliminated', remote: true, label, monsterCount: b.n };
  }

  pushEvents(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case 'shot': {
          const color = kindHex(e.kind); this.anim.set(e.from, this.time);
          this.fx.shot(e.x1, e.y1, e.x2, e.y2, e.kind, color, e.targets);
          if (e.kind === 'fire' || e.kind === 'titan') this.fx.burst(e.x2, e.y2, e.kind === 'titan' ? 14 : 5 + e.grade * 2, color, 50, 2.2, 0.35);
          else if (e.kind === 'ice' || e.kind === 'queen') this.fx.ring(e.x2, e.y2, 3, 12 + e.grade * 3, color, 0.35, 1.5);
          else if (e.kind === 'earth') this.fx.ring(e.x2, e.y2, 2, 10, '#c89a63', 0.3, 2);
          else if (e.kind === 'bolt' || e.kind === 'dragon') this.fx.burst(e.x2, e.y2, 3, color, 40, 1.5, 0.25);
          break;
        }
        case 'die': this.fx.burst(e.x, e.y, e.boss ? 40 : 7, e.boss ? '#ff6b9a' : '#ff8a8a', e.boss ? 120 : 55, e.boss ? 4 : 2.5, e.boss ? 1.2 : 0.5, 40); if (e.gold >= 3 || e.boss) this.fx.float(e.x, e.y - 8, `+${e.gold}`, '#ffd76a', e.boss ? 16 : 10); if (e.boss) this.shake = 0.6; break;
        case 'summon': { const p = slotPos(e.slot); this.fx.ring(p.x, p.y, 4, 26, GRADE_HEX[e.grade], 0.5, 2.5); if (e.grade >= 2) { this.fx.burst(p.x, p.y, 16 + e.grade * 6, GRADE_HEX[e.grade], 70, 2.5, 0.8); } break; }
        case 'merge': { const p = slotPos(e.slot); this.fx.ring(p.x, p.y, 30, 6, GRADE_HEX[e.grade], 0.45, 3); this.fx.burst(p.x, p.y, 14 + e.grade * 6, GRADE_HEX[e.grade], 80, 2.5, 0.7); this.fx.float(p.x, p.y - 26, e.confirmed ? '합성!' : '무작위 합성!', GRADE_HEX[e.grade], 12, 1.1); break; }
        case 'mythic': { const p = slotPos(e.slot); this.fx.ring(p.x, p.y, 10, 60, kindHex(e.kind), 0.9, 4); this.fx.burst(p.x, p.y, 50, kindHex(e.kind), 110, 3, 1.2); this.shake = 0.5; break; }
        case 'gold': this.fx.float(e.x, e.y, `+${e.amount} 골드`, '#ffd76a', 13, 1.3); break;
        case 'eliminated': this.shake = 1; this.fx.burst(FIELD_W / 2, FIELD_H / 2, 60, '#ff5560', 150, 3, 1.5); break;
        case 'won': this.fx.burst(FIELD_W / 2, FIELD_H / 2, 80, '#ffd76a', 160, 3.5, 2); break;
        case 'round': if (e.boss) this.shake = 0.4; break;
      }
    }
  }

  private buildBg(): HTMLCanvasElement {
    const c = document.createElement('canvas'); c.width = this.canvas.width; c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0e1120'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.translate(this.ox, this.oy); ctx.scale(this.scale, this.scale);
    // 바닥(안뜰)
    ctx.fillStyle = '#1b2236'; ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    // 길(고리)
    ctx.fillStyle = '#3b3a4e';
    ctx.fillRect(0, 0, FIELD_W, CELL); ctx.fillRect(0, FIELD_H - CELL, FIELD_W, CELL); ctx.fillRect(0, 0, CELL, FIELD_H); ctx.fillRect(FIELD_W - CELL, 0, CELL, FIELD_H);
    // 길 바닥 돌 무늬
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) { if (i > 0 && i < COLS - 1 && j > 0 && j < ROWS - 1) continue; if ((i + j) % 2 === 0) ctx.fillRect(i * CELL + 2, j * CELL + 2, CELL - 4, CELL - 4); }
    // 길 중앙 점선(방향)
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 2;
    ctx.strokeRect(CELL / 2, CELL / 2, FIELD_W - CELL, FIELD_H - CELL); ctx.setLineDash([]);
    // 안뜰 테두리(담장)
    ctx.strokeStyle = '#4a5578'; ctx.lineWidth = 3; ctx.strokeRect(CELL, CELL, FIELD_W - 2 * CELL, FIELD_H - 2 * CELL);
    // 자리
    for (let i = 0; i < SLOT_COUNT; i++) { const p = slotPos(i); ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.beginPath(); ctx.roundRect(p.x - 21, p.y - 21, 42, 42, 8); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke(); }
    // 출발 지점 표시
    const sp = pathPos(0); ctx.fillStyle = 'rgba(255,90,90,0.25)'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('출현', sp.x, sp.y);
    // 방향 화살표
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const arrow = (x: number, y: number, a: number) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore(); };
    arrow(FIELD_W / 2, CELL / 2, 0); arrow(FIELD_W - CELL / 2, FIELD_H / 2, Math.PI / 2); arrow(FIELD_W / 2, FIELD_H - CELL / 2, Math.PI); arrow(CELL / 2, FIELD_H / 2, -Math.PI / 2);
    return c;
  }

  draw(v: BoardView, dt: number): void {
    this.time += dt; this.fx.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);
    const ctx = this.ctx;
    if (!this.bg) this.bg = this.buildBg();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 6 : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 6 : 0;
    ctx.translate(this.ox + sx, this.oy + sy); ctx.scale(this.scale, this.scale);
    ctx.save(); ctx.beginPath(); ctx.rect(-4, -4, FIELD_W + 8, FIELD_H + 8); ctx.clip();

    // 사거리 표시 (선택 유닛)
    if (v.selected != null && this.showRanges) {
      const u = v.units.find(x => x.slot === v.selected);
      if (u && u.range) { const p = slotPos(u.slot); ctx.fillStyle = kindHex(u.kind) + '18'; ctx.strokeStyle = kindHex(u.kind) + '88'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, u.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    // 이동 대상 자리 강조
    if (v.moveFrom != null || v.dragging) {
      for (let i = 0; i < SLOT_COUNT; i++) { const p = slotPos(i); const occ = v.units.some(u => u.slot === i); ctx.strokeStyle = occ ? 'rgba(255,200,80,0.5)' : 'rgba(120,255,160,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.roundRect(p.x - 21, p.y - 21, 42, 42, 8); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // 유닛
    const upx = Math.round(this.scale * this.dpr * 56);
    for (const u of v.units) {
      const p = slotPos(u.slot); const spr = unitSprite(u.kind, u.grade, upx);
      const last = this.anim.get(u.slot) ?? -9; const k = Math.max(0, 1 - (this.time - last) / 0.18);
      const bob = v.remote ? 0 : Math.sin(this.time * 3 + u.slot) * 0.8;
      const sel = v.selected === u.slot;
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(p.x - 22, p.y - 22, 44, 44, 9); ctx.stroke(); }
      if (v.dragging && v.moveFrom === u.slot) ctx.globalAlpha = 0.35;
      const sz = 56 * (1 + k * 0.12);
      ctx.drawImage(spr, p.x - sz / 2, p.y - sz / 2 + bob - 3, sz, sz);
      ctx.globalAlpha = 1;
    }
    // 몬스터
    const mpx = Math.round(this.scale * this.dpr * 44);
    const sorted = v.monsters.slice().sort((a, b) => a.y - b.y);
    for (const m of sorted) {
      const d = MONSTER_DEFS[m.type]; const spr = monsterSprite(m.type, mpx);
      const sz = d.size * 2.2;
      const wob = Math.sin(this.time * 10 + m.dist * 0.1) * (m.stunned ? 0 : 1.5);
      ctx.drawImage(spr, m.x - sz / 2, m.y - sz / 2 + wob - 2, sz, sz);
      if (m.slowed) { ctx.fillStyle = 'rgba(120,200,255,0.35)'; ctx.beginPath(); ctx.arc(m.x, m.y, sz * 0.4, 0, Math.PI * 2); ctx.fill(); }
      if (m.stunned) { ctx.fillStyle = '#ffe97a'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', m.x + Math.sin(this.time * 12) * 5, m.y - sz * 0.55); }
      // 체력바
      const w = m.boss ? 34 : 16, h = m.boss ? 4 : 2.5; const bx = m.x - w / 2, by = m.y - sz / 2 - 5;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 0.5, by - 0.5, w + 1, h + 1);
      ctx.fillStyle = m.hpPct > 0.5 ? '#6cff8a' : m.hpPct > 0.25 ? '#ffd24a' : '#ff5a5a'; ctx.fillRect(bx, by, w * Math.max(0, m.hpPct), h);
    }
    // 드래그 중인 유닛
    if (v.dragging) { const spr = unitSprite(v.dragging.kind, v.dragging.grade, upx); ctx.globalAlpha = 0.9; ctx.drawImage(spr, v.dragging.x - 30, v.dragging.y - 34, 60, 60); ctx.globalAlpha = 1; }
    // 효과
    if (!v.remote) this.fx.draw(ctx);
    // 몬스터 수 게이지 (위쪽 길 위)
    const frac = Math.min(1, v.monsterCount / MONSTER_CAP);
    if (frac > 0.5) { ctx.fillStyle = frac > 0.85 ? `rgba(255,60,60,${0.15 + 0.15 * Math.sin(this.time * 8)})` : 'rgba(255,120,60,0.10)'; ctx.fillRect(0, 0, FIELD_W, FIELD_H); }
    // 탈락 / 원격 라벨
    if (v.eliminated) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, FIELD_W, FIELD_H); ctx.fillStyle = '#ff6b7a'; ctx.font = 'bold 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('탈락', FIELD_W / 2, FIELD_H / 2); }
    if (v.label) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = 'bold 11px system-ui, sans-serif'; const tw = ctx.measureText(v.label).width + 12; ctx.beginPath(); ctx.roundRect(FIELD_W / 2 - tw / 2, 4, tw, 16, 6); ctx.fill(); ctx.fillStyle = v.remote ? '#9fd0ff' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v.label, FIELD_W / 2, 12); }
    ctx.restore();
  }
}
