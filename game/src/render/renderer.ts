// Canvas 2D 렌더러. 시뮬레이션 상태를 읽기만 하며, 이벤트 큐를 소비해 연출을 만듭니다.
import type { GameState, Enemy, Unit, SimEvent, Projectile } from '../sim/types';
import { FIELD_W, FIELD_H, PATH_HALF, SLOT_R, MAPS, mapSlots, pathGeo, posAt, dirAt, type MapId } from '../data/maps';
import { ENEMIES } from '../data/enemies';
import { UNITS, unitStats, type UnitKind, type Grade } from '../data/units';
import { COMBOS } from '../data/combos';
import { unitSprite, enemySprite, GRADE_HEX } from './sprites';
import { Fx, DmgNumbers } from './fx';
import { computeCtx } from '../sim/combat';
import { UNIT_PARAMS } from '../data/units';

export interface ViewState {
  selectedUnit: number | null;      // 선택한 유닛
  selectedOffer: number | null;     // 선택한 소환 후보 인덱스
  mode: 'none' | 'move' | 'merge';  // 유닛 메뉴에서 고른 다음 동작
  mergeTargets: number[];           // 합성 가능한 상대 id
  showRanges: boolean;
  tutorialSlot: number | null;      // 튜토리얼 강조 칸
}

export class Renderer {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  scale = 1; ox = 0; oy = 0; dpr = 1; cssW = 0; cssH = 0;
  bg: HTMLCanvasElement | null = null; bgMap: MapId | null = null;
  fx = new Fx(); dmg = new DmgNumbers();
  time = 0;
  unitAnim = new Map<number, { shot: number; born: number; ang: number }>();
  enemyFlash = new Map<number, number>();
  bossWarn: { kind: string; t: number; enemy: number } | null = null;
  view: ViewState = { selectedUnit: null, selectedOffer: null, mode: 'none', mergeTargets: [], showRanges: true, tutorialSlot: null };
  onEvent: ((e: SimEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false })!; }

  resize(cssW: number, cssH: number): void {
    this.cssW = cssW; this.cssH = cssH;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr); this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
    this.ox = (cssW - FIELD_W * this.scale) / 2; this.oy = (cssH - FIELD_H * this.scale) / 2;
    this.bg = null;
  }
  toField(px: number, py: number): [number, number] { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  toScreen(fx: number, fy: number): [number, number] { return [this.ox + fx * this.scale, this.oy + fy * this.scale]; }
  slotAt(mapId: MapId, fx: number, fy: number): number | null {
    let best: number | null = null, bd = SLOT_R + 12; // 손가락 여유
    for (const s of mapSlots(mapId)) { const d = Math.hypot(s.x - fx, s.y - fy); if (d < bd) { bd = d; best = s.id; } }
    return best;
  }

  private buildBg(mapId: MapId): HTMLCanvasElement {
    const m = MAPS[mapId]; const th = m.theme; const g = pathGeo(mapId);
    const cv = document.createElement('canvas'); cv.width = this.canvas.width; cv.height = this.canvas.height;
    const c = cv.getContext('2d')!; c.scale(this.dpr, this.dpr);
    c.fillStyle = th.bg2; c.fillRect(0, 0, this.cssW, this.cssH);
    c.translate(this.ox, this.oy); c.scale(this.scale, this.scale);
    const grad = c.createLinearGradient(0, 0, 0, FIELD_H); grad.addColorStop(0, th.bg1); grad.addColorStop(1, th.bg2);
    c.fillStyle = grad; c.fillRect(-60, -60, FIELD_W + 120, FIELD_H + 120);
    let sd = 11; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
    if (th.deco === 'workshop') {
      // 잔디 점, 작업대, 상자, 톱니 장식
      for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(139,195,74,${0.08 + r() * 0.12})`; const x = r() * FIELD_W, y = r() * FIELD_H; c.fillRect(x, y, 2 + r() * 3, 1.5); }
      const crate = (x: number, y: number, s: number) => { c.fillStyle = '#6d4c41'; c.fillRect(x, y, s, s); c.strokeStyle = '#3e2723'; c.lineWidth = 1.5; c.strokeRect(x, y, s, s); c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s); c.moveTo(x + s, y); c.lineTo(x, y + s); c.stroke(); };
      crate(14, 14, 18); crate(36, 20, 14); crate(360, 480, 20); crate(20, 440, 16); crate(370, 20, 16);
      const gear = (x: number, y: number, R: number, col: string) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; const rr = i % 2 ? R : R * 0.8; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.fillStyle = th.bg2; c.beginPath(); c.arc(x, y, R * 0.35, 0, Math.PI * 2); c.fill(); };
      gear(380, 340, 16, 'rgba(120,144,156,0.35)'); gear(30, 560, 22, 'rgba(120,144,156,0.3)'); gear(60, 60, 12, 'rgba(120,144,156,0.3)');
    } else {
      // 협곡: 암벽 줄무늬, 고철 더미, 녹슨 배관
      for (let i = 0; i < 26; i++) { const y = i * 24 + r() * 10; c.strokeStyle = `rgba(0,0,0,${0.06 + r() * 0.08})`; c.lineWidth = 3 + r() * 5; c.beginPath(); c.moveTo(-10, y); c.bezierCurveTo(100, y + r() * 30 - 15, 300, y - r() * 30 + 15, FIELD_W + 10, y + r() * 20 - 10); c.stroke(); }
      const scrap = (x: number, y: number) => { for (let i = 0; i < 5; i++) { c.fillStyle = ['#8d6e63', '#a1887f', '#6d4c41', '#78909c'][i % 4]; c.beginPath(); c.roundRect(x + r() * 20 - 10, y + r() * 14 - 7, 8 + r() * 10, 5 + r() * 6, 2); c.fill(); } };
      scrap(30, 30); scrap(370, 30); scrap(30, 560); scrap(380, 470); scrap(230, 540);
      c.strokeStyle = 'rgba(255,143,0,0.25)'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 590); c.lineTo(80, 560); c.lineTo(90, 545); c.stroke();
    }
    // 길
    c.lineCap = 'round'; c.lineJoin = 'round';
    const drawPath = (col: string, w: number) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); m.points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
    drawPath(th.pathEdge, PATH_HALF * 2 + 8); drawPath(th.path, PATH_HALF * 2);
    c.setLineDash([8, 12]); drawPath('rgba(255,255,255,0.12)', 3); c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let p = 30; p < g.len - 30; p += 90) { const [x, y] = posAt(g, p); const [dx, dy] = dirAt(g, p); const a = Math.atan2(dy, dx); c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(-4, -5); c.lineTo(3, 0); c.lineTo(-4, 5); c.closePath(); c.fill(); c.restore(); }
    // 입구 표시
    const [sx, sy] = posAt(g, 0); const [sdx, sdy] = dirAt(g, 0);
    c.save(); c.translate(Math.max(28, Math.min(FIELD_W - 28, sx + sdx * 44)), Math.max(14, Math.min(FIELD_H - 14, sy + sdy * 44))); c.fillStyle = 'rgba(10,14,32,0.7)'; c.beginPath(); c.roundRect(-20, -9, 40, 16, 5); c.fill(); c.fillStyle = '#ff8a80'; c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('적 입구', 0, 3); c.restore();
    // 기지
    const b = m.base;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(b.x, b.y + 16, 34, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#546e7a'; c.beginPath(); c.roundRect(b.x - 30, b.y - 14, 60, 30, 6); c.fill(); c.strokeStyle = '#263238'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#78909c'; c.beginPath(); c.roundRect(b.x - 22, b.y - 26, 44, 16, 4); c.fill(); c.stroke();
    c.fillStyle = th.accent; c.beginPath(); c.arc(b.x, b.y - 18, 5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#263238'; c.beginPath(); c.roundRect(b.x - 8, b.y - 6, 16, 18, 3); c.fill();
    c.fillStyle = '#eceff1'; c.font = 'bold 9px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('기지', b.x, b.y + 26);
    // 배치 칸
    for (const s of mapSlots(mapId)) { c.beginPath(); c.arc(s.x, s.y, SLOT_R, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.4; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(s.x, s.y, 2, 0, Math.PI * 2); c.fill(); }
    return cv;
  }

  consumeEvents(s: GameState): void {
    const fx = this.fx;
    for (const e of s.events) {
      switch (e.t) {
        case 'shoot': { const a = this.unitAnim.get(e.unit) || { shot: 0, born: 0, ang: 0 }; a.shot = this.time; a.ang = Math.atan2(e.ty - e.y, e.tx - e.x); this.unitAnim.set(e.unit, a); break; }
        case 'beam': fx.beam(e.x, e.y, e.x2, e.y2, e.width, e.over ? '#b2ff59' : '#ff5252', '#fff', e.over ? 0.3 : 0.18); if (e.over) { fx.ring(e.x, e.y, 16, '#b2ff59', 0.3, 3); } break;
        case 'cone': fx.cone(e.x, e.y, e.angle, e.spread, e.range, '#ff7043'); fx.burst(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20, 6, '#ffab40', 90, 2.5, 0.4, false); break;
        case 'chain': fx.bolt(e.pts, e.frost ? '#40c4ff' : '#ffee58', e.grade >= 3 ? 0.3 : 0.2, e.grade >= 3 ? 3 : 2); break;
        case 'hit': this.enemyFlash.set(e.enemy, 0.08); this.dmg.push(e.enemy, e.x, e.y, e.dmg); if (this.fx.level === 2 && e.kind !== 'burn') fx.burst(e.x, e.y, 2, '#fff', 40, 1.5, 0.22); break;
        case 'explode': {
          if (e.kind === 'bomb') { fx.burst(e.x, e.y, 14, '#ff7043', 90, 3, 0.45); fx.shock(e.x, e.y, e.r, '#ffab40', 0.35); fx.shake(2, 0.15); }
          else if (e.kind === 'focus') { fx.burst(e.x, e.y, 22, '#ce93d8', 120, 3.5, 0.55); fx.burst(e.x, e.y, 12, '#ff7043', 90, 3, 0.45); fx.shock(e.x, e.y, e.r, '#e1bee7', 0.45); fx.shake(4, 0.25); fx.flash(0.06, '#e1bee7'); }
          else if (e.kind === 'frag') { fx.burst(e.x, e.y, 6, '#ff5252', 70, 2.2, 0.35); fx.ring(e.x, e.y, e.r, '#ff8a80', 0.25, 2); }
          else if (e.kind === 'ignite') { fx.burst(e.x, e.y, 18, '#ff6d00', 110, 3, 0.5); fx.burst(e.x, e.y, 8, '#212121', 50, 3, 0.7, false); fx.shock(e.x, e.y, e.r, '#ffab40', 0.4); fx.shake(3, 0.2); }
          else if (e.kind === 'shards') { fx.burst(e.x, e.y, 10, '#e0f7fa', 100, 2.5, 0.4); fx.ring(e.x, e.y, e.r, '#80deea', 0.35, 2.5); }
          else if (e.kind === 'frostsplash') { fx.ring(e.x, e.y, e.r, '#b3e5fc', 0.4, 3); fx.zone(e.x, e.y, e.r, '#4fc3f7', 0.6); fx.burst(e.x, e.y, 8, '#e1f5fe', 60, 2.5, 0.4, false); }
          break;
        }
        case 'vortex': { const sl = mapSlots(s.mapId); const u = s.units.find(u => u.id === e.unit); const a = u ? sl[u.slot] : null; const g = pathGeo(s.mapId); const [ax, ay] = a ? posAt(g, a.anchorDist) : [e.x, e.y]; fx.swirl(ax, ay, e.r * 0.8, '#b39ddb', e.fire ? 2.0 : 0.9, e.fire); if (e.fire) { fx.burst(ax, ay, 14, '#ff6d00', 70, 3, 0.7, false); } break; }
        case 'status': {
          if (e.kind === 'oil') fx.burst(e.x, e.y, 5, '#3e2723', 40, 2.5, 0.5);
          else if (e.kind === 'chill') fx.burst(e.x, e.y, 4, '#b3e5fc', 40, 2, 0.4, false);
          else if (e.kind === 'freeze') fx.ring(e.x, e.y, 14, '#e1f5fe', 0.4, 2.5);
          else if (e.kind === 'shield') fx.ring(e.x, e.y, 14, '#4dd0e1', 0.4, 2);
          break;
        }
        case 'die': { const d = ENEMIES[e.kind]; fx.burst(e.x, e.y, e.boss ? 40 : 7, d.color, e.boss ? 150 : 70, e.boss ? 4 : 2.5, e.boss ? 0.9 : 0.45); fx.burst(e.x, e.y, e.boss ? 20 : 3, '#cfd8dc', e.boss ? 90 : 50, 2, 0.5); if (e.boss) { fx.shake(6, 0.4); fx.flash(0.15); fx.shock(e.x, e.y, 90, '#fff', 0.7); } break; }
        case 'leak': fx.text(e.x, e.y - 10, `-${e.dmg}`, '#ff5252', 14, 1); fx.shake(3, 0.2); fx.flash(0.08, '#ff5252'); break;
        case 'place': fx.ring(e.x, e.y, SLOT_R, '#fff', 0.35, 2); fx.burst(e.x, e.y, 6, '#fff', 50, 2, 0.35); this.unitAnim.set(e.unit, { shot: 0, born: this.time, ang: -Math.PI / 2 }); break;
        case 'merge': { fx.burst(e.fromX, e.fromY, 10, GRADE_HEX[e.grade], 60, 2.5, 0.5); for (let i = 0; i < 6; i++) { const k = i / 6; fx.add({ kind: 'spark', x: e.fromX + (e.x - e.fromX) * k, y: e.fromY + (e.y - e.fromY) * k, vx: (e.x - e.fromX) * 1.5, vy: (e.y - e.fromY) * 1.5, life: 0.35, max: 0.35, size: 3, color: GRADE_HEX[e.grade], a: 0 }); } fx.burst(e.x, e.y, 18, GRADE_HEX[e.grade], 90, 3, 0.6); fx.ring(e.x, e.y, 30, GRADE_HEX[e.grade], 0.5, 3); if (e.grade === 3) { fx.ring(e.x, e.y, 50, '#fff', 0.7, 3); fx.shake(3, 0.25); } this.unitAnim.set(e.unit, { shot: 0, born: this.time, ang: -Math.PI / 2 }); break; }
        case 'sell': fx.gold(e.x, e.y - 8, e.gold); break;
        case 'combo': fx.label(e.x, e.y - 26, (e.first ? '★ ' : '') + COMBOS[e.id].name, COMBOS[e.id].color, e.first ? 1.6 : 1.0); break;
        case 'boss': fx.shake(4, 0.4); fx.flash(0.1, '#7e57c2'); break;
        case 'bosspattern': { const names = { shield: '보호막', haste: '가속', minion: '부하 소환', enrage: '장갑 강화' } as const; if (e.phase === 'warn') { this.bossWarn = { kind: names[e.kind], t: 2.0, enemy: -1 }; fx.ring(e.x, e.y, 40, '#ff4081', 0.6, 3); } else { this.bossWarn = null; fx.label(e.x, e.y - 34, names[e.kind] + '!', '#ff4081', 1.2); fx.shock(e.x, e.y, 50, e.kind === 'shield' ? '#4dd0e1' : '#ff4081', 0.5); } break; }
        case 'gold': fx.gold(e.x, e.y, e.amount); break;
        case 'overcharge': fx.ring(e.x, e.y, 22, '#b2ff59', 0.5, 3); fx.burst(e.x, e.y, 8, '#b2ff59', 60, 2, 0.5, false); break;
        case 'engpulse': fx.ring(e.x, e.y, e.r, '#b2ff59', 0.6, 2.5); break;
        default: break;
      }
      this.onEvent?.(e);
    }
    s.events.length = 0;
  }

  draw(s: GameState, dt: number, paused: boolean): void {
    this.time += dt;
    if (!paused) { this.fx.update(dt); this.dmg.flush(dt, this.fx); if (this.bossWarn) { this.bossWarn.t -= dt; if (this.bossWarn.t <= 0) this.bossWarn = null; } for (const [k, v] of this.enemyFlash) { if (v - dt <= 0) this.enemyFlash.delete(k); else this.enemyFlash.set(k, v - dt); } }
    if (!this.bg || this.bgMap !== s.mapId) { this.bg = this.buildBg(s.mapId); this.bgMap = s.mapId; }
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let shx = 0, shy = 0; if (this.fx.shakeT > 0) { shx = (this.fx.rnd() - 0.5) * this.fx.shakeAmt * 2; shy = (this.fx.rnd() - 0.5) * this.fx.shakeAmt * 2; }
    c.translate(this.ox + shx, this.oy + shy); c.scale(this.scale, this.scale);
    const v = this.view; const slots = mapSlots(s.mapId); const g = pathGeo(s.mapId);
    // 배치 칸 강조
    const placing = v.selectedOffer != null && s.offer[v.selectedOffer];
    for (const sl of slots) {
      const occ = s.slots[sl.id] != null;
      if (placing && !occ) { c.beginPath(); c.arc(sl.x, sl.y, SLOT_R, 0, Math.PI * 2); c.fillStyle = `rgba(139,195,74,${0.18 + 0.12 * Math.sin(this.time * 5)})`; c.fill(); c.strokeStyle = '#aed581'; c.lineWidth = 2; c.stroke(); }
      if (v.mode === 'move' && !occ) { c.beginPath(); c.arc(sl.x, sl.y, SLOT_R, 0, Math.PI * 2); c.strokeStyle = '#4fc3f7'; c.lineWidth = 2; c.stroke(); }
      if (v.tutorialSlot === sl.id) { c.beginPath(); c.arc(sl.x, sl.y, SLOT_R + 5 + Math.sin(this.time * 6) * 2, 0, Math.PI * 2); c.strokeStyle = '#ffd54f'; c.lineWidth = 3; c.stroke(); }
    }
    // 사거리·지원 범위
    const sel = v.selectedUnit != null ? s.units.find(u => u.id === v.selectedUnit) : null;
    if (v.showRanges) {
      for (const u of s.units) if (u.kind === 'engineer') { const sl = slots[u.slot]; const r = unitStats('engineer', u.grade).range; c.beginPath(); c.arc(sl.x, sl.y, r, 0, Math.PI * 2); c.fillStyle = 'rgba(102,187,106,0.07)'; c.fill(); c.strokeStyle = 'rgba(178,255,89,0.35)'; c.lineWidth = 1; c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]); }
    }
    if (sel) { const sl = slots[sel.slot]; const st = unitStats(sel.kind, sel.grade); c.beginPath(); c.arc(sl.x, sl.y, st.range, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); c.strokeStyle = sel.kind === 'engineer' ? '#b2ff59' : '#fff'; c.lineWidth = 1.5; c.stroke(); if (sel.kind === 'laser') { const len = UNIT_PARAMS.laser.length[sel.grade]; c.strokeStyle = 'rgba(255,82,82,0.5)'; c.lineWidth = UNIT_PARAMS.laser.width[sel.grade]; c.beginPath(); c.moveTo(sl.x, sl.y); c.lineTo(sl.x + Math.cos(sel.facing) * len, sl.y + Math.sin(sel.facing) * len); c.stroke(); } }
    // 적
    for (const e of s.enemies) this.drawEnemy(c, e, s);
    // 유닛
    for (const u of s.units) this.drawUnit(c, u, s, sel?.id === u.id, v.mergeTargets.includes(u.id));
    // 투사체
    for (const p of s.projectiles) this.drawProjectile(c, p);
    // 회오리 지속 표시(끌기 중)
    for (const u of s.units) if (u.kind === 'vortex' && (u.pullT > 0 || u.fireVortexT > 0)) { const sl = slots[u.slot]; const [ax, ay] = posAt(g, sl.anchorDist); c.strokeStyle = u.fireVortexT > 0 ? 'rgba(255,109,0,0.5)' : 'rgba(179,157,219,0.45)'; c.lineWidth = 1.5; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(sl.x, sl.y); c.lineTo(ax, ay); c.stroke(); c.setLineDash([]); }
    // 이펙트
    this.fx.draw(c, this.time);
    // 보스 예고
    if (this.bossWarn) { const b = s.enemies.find(e => e.boss); if (b) { const k = this.bossWarn.t; c.save(); c.translate(b.x, b.y - 40); c.fillStyle = 'rgba(20,10,30,0.85)'; c.beginPath(); c.roundRect(-38, -11, 76, 20, 6); c.fill(); c.strokeStyle = '#ff4081'; c.lineWidth = 1.5 + Math.sin(this.time * 12) * 0.8; c.stroke(); c.fillStyle = '#ff80ab'; c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`⚠ ${this.bossWarn.kind} ${k.toFixed(1)}s`, 0, 3); c.restore(); } }
    // 화면 플래시
    if (this.fx.flashT > 0) { c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = Math.min(0.35, this.fx.flashT * 2.5); c.fillStyle = this.fx.flashColor; c.fillRect(0, 0, this.cssW, this.cssH); c.globalAlpha = 1; }
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: Enemy, s: GameState): void {
    const d = ENEMIES[e.kind]; const g = pathGeo(s.mapId); const [dx, dy] = dirAt(g, e.dist); const ang = Math.atan2(dy, dx);
    const flash = this.enemyFlash.get(e.id) || 0; const bob = e.kind === 'repairdrone' ? Math.sin(this.time * 6 + e.id) * 2 : 0;
    const spr = enemySprite(e.kind, this.scale * this.dpr); const size = 64;
    c.save(); c.translate(e.x, e.y + bob);
    // 그림자
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, d.radius * 0.6 + 2 - bob, d.radius * 1.1, d.radius * 0.45, 0, 0, Math.PI * 2); c.fill();
    if (e.st.mark > 0) { c.strokeStyle = 'rgba(206,147,216,0.9)'; c.lineWidth = 1.5; c.setLineDash([2, 3]); c.beginPath(); c.arc(0, 0, d.radius + 5, this.time * 3, this.time * 3 + Math.PI * 1.5); c.stroke(); c.setLineDash([]); }
    c.rotate(ang);
    const sq = flash > 0 ? 1.12 : 1; c.scale(sq, 1 / sq);
    if (e.st.frozen > 0) c.filter = 'brightness(1.4) saturate(0.4)'; else if (e.st.chill > 0) c.filter = 'hue-rotate(160deg) brightness(1.1)';
    c.drawImage(spr, -size / 2, -size / 2, size, size);
    c.filter = 'none';
    if (flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.drawImage(spr, -size / 2, -size / 2, size, size); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    c.rotate(-ang); c.scale(1 / sq, sq);
    // 상태 표시
    if (e.st.oil > 0) { c.fillStyle = 'rgba(33,20,12,0.7)'; for (let i = 0; i < 3; i++) { const a = i * 2.1 + e.id; c.beginPath(); c.ellipse(Math.cos(a) * d.radius * 0.6, Math.sin(a) * d.radius * 0.6 + 2, 3, 2, a, 0, Math.PI * 2); c.fill(); } c.strokeStyle = 'rgba(93,64,55,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, d.radius + 2, 0, Math.PI * 2); c.stroke(); }
    if (e.st.burn > 0) { for (let i = 0; i < 3; i++) { const ph = this.time * 10 + i * 2 + e.id; const h = 5 + Math.sin(ph) * 2; const x = Math.cos(i * 2.1) * d.radius * 0.5; c.fillStyle = i % 2 ? '#ff6d00' : '#ffab40'; c.beginPath(); c.moveTo(x - 3, -d.radius * 0.3); c.quadraticCurveTo(x, -d.radius * 0.3 - h * 2, x + 3, -d.radius * 0.3); c.closePath(); c.fill(); } }
    if (e.st.frozen > 0) { c.fillStyle = 'rgba(178,235,242,0.45)'; c.strokeStyle = '#e0f7fa'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-d.radius - 3, -d.radius - 3, d.radius * 2 + 6, d.radius * 2 + 6, 4); c.fill(); c.stroke(); }
    if (e.st.shield > 0) { c.strokeStyle = 'rgba(77,208,225,0.9)'; c.fillStyle = 'rgba(77,208,225,0.18)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, d.radius + 6, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (e.boss && e.boss.hasteT > 0) { c.strokeStyle = '#ff4081'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-d.radius - 6 - i * 5, -6 + i * 6); c.lineTo(-d.radius - 12 - i * 5, -6 + i * 6); c.stroke(); } }
    if (e.boss && e.boss.enraged) { c.strokeStyle = '#ff7043'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, d.radius + 4, 0, Math.PI * 2); c.stroke(); }
    // 체력바
    if (e.hp < e.maxHp || d.boss) { const w = d.boss ? 60 : d.radius * 2.4, h = d.boss ? 6 : 3.5, y = -d.radius - 9; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(-w / 2, y, w, h); const k = Math.max(0, e.hp / e.maxHp); c.fillStyle = k > 0.5 ? '#66bb6a' : k > 0.25 ? '#ffb300' : '#ff5252'; c.fillRect(-w / 2, y, w * k, h); if (e.st.shield > 0) { c.fillStyle = '#4dd0e1'; c.fillRect(-w / 2, y - 2.5, w * Math.min(1, e.st.shield / (d.boss ? 320 : 14)), 2); } }
    if (d.boss) { c.fillStyle = '#fff'; c.font = 'bold 9px system-ui, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(d.name, 0, -d.radius - 13); c.fillText(d.name, 0, -d.radius - 13); }
    c.restore();
  }

  private drawUnit(c: CanvasRenderingContext2D, u: Unit, s: GameState, selected: boolean, mergeable: boolean): void {
    const sl = mapSlots(s.mapId)[u.slot]; const a = this.unitAnim.get(u.id); const st = unitStats(u.kind, u.grade);
    const spr = unitSprite(u.kind, u.grade, this.scale * this.dpr); const size = 64;
    const bob = Math.sin(this.time * 2.2 + u.id * 1.7) * 1.2;
    let recoil = 0, pop = 1;
    if (a) { const dt = this.time - a.shot; if (a.shot > 0 && dt < 0.16) recoil = (1 - dt / 0.16) * 3; const bt = this.time - a.born; if (a.born > 0 && bt < 0.4) pop = 1 + Math.sin(bt / 0.4 * Math.PI) * 0.25; }
    c.save(); c.translate(sl.x, sl.y);
    if (selected) { c.beginPath(); c.arc(0, 0, SLOT_R + 2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
    if (mergeable) { c.beginPath(); c.arc(0, 0, SLOT_R + 4 + Math.sin(this.time * 6) * 1.5, 0, Math.PI * 2); c.strokeStyle = '#ffd54f'; c.lineWidth = 3; c.stroke(); }
    // 반동: 조준 방향 반대로 살짝
    const ang = a?.ang ?? u.facing; c.translate(-Math.cos(ang) * recoil, -Math.sin(ang) * recoil + bob); c.scale(pop, pop);
    if (u.grade === 3) { c.globalAlpha = 0.35 + Math.sin(this.time * 3) * 0.1; c.fillStyle = GRADE_HEX[3]; c.beginPath(); c.arc(0, 2, SLOT_R + 1, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
    c.drawImage(spr, -size / 2, -size / 2 + 2, size, size);
    // 등급 배지
    c.fillStyle = GRADE_HEX[u.grade]; c.beginPath(); c.arc(14, 12, 6.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#1a1230'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = u.grade === 1 ? '#1a1230' : '#fff'; c.font = 'bold 9px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(String(u.grade), 14, 15.2);
    // 과충전 충전 링(레이저)
    if (u.kind === 'laser') { const ctx = computeCtx(s).get(u.id); if (ctx && ctx.engGrade > 0) { const iv = UNIT_PARAMS.engineer.overchargeInterval[ctx.engGrade as Grade]; const k = u.overcharged ? 1 : Math.min(1, u.charge / iv); c.strokeStyle = u.overcharged ? '#b2ff59' : 'rgba(178,255,89,0.6)'; c.lineWidth = u.overcharged ? 3 : 2; c.beginPath(); c.arc(0, 0, SLOT_R - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke(); if (u.overcharged) { c.fillStyle = '#b2ff59'; c.font = 'bold 8px system-ui, sans-serif'; c.fillText('과충전', 0, -SLOT_R - 4); } } }
    if (u.boost > 1) { c.strokeStyle = '#fdd835'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, SLOT_R - 3, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }

  private drawProjectile(c: CanvasRenderingContext2D, p: Projectile): void {
    const k = Math.min(1, p.t / p.dur);
    switch (p.kind) {
      case 'flame': { const r = 3 + p.grade; c.fillStyle = '#ff7043'; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffe082'; c.beginPath(); c.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2); c.fill(); if (this.fx.level > 0) this.fx.puff(p.x, p.y, 'rgba(255,112,67,0.5)', 3, 0.25); break; }
      case 'frost': { c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.ty - p.sy, p.tx - p.sx)); c.fillStyle = '#e1f5fe'; c.strokeStyle = '#4fc3f7'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, 0); c.lineTo(-3, -3); c.lineTo(-5, 0); c.lineTo(-3, 3); c.closePath(); c.fill(); c.stroke(); c.restore(); break; }
      case 'oil': case 'bomb': case 'frag': {
        const hmax = p.kind === 'bomb' ? 46 : p.kind === 'oil' ? 26 : 14; const h = Math.sin(k * Math.PI) * hmax;
        c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2); c.fill();
        if (k > 0.75 && p.kind !== 'frag') { c.strokeStyle = p.kind === 'bomb' ? 'rgba(255,82,82,0.6)' : 'rgba(141,110,99,0.6)'; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.arc(p.tx, p.ty, p.radius, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
        const y = p.y - h;
        if (p.kind === 'bomb') { c.fillStyle = '#37474f'; c.strokeStyle = '#1a1230'; c.lineWidth = 1.2; c.beginPath(); c.arc(p.x, y, 5 + p.grade * 0.5, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = '#ff5252'; c.beginPath(); c.moveTo(p.x, y - 5); c.lineTo(p.x + 3, y - 9); c.stroke(); c.fillStyle = '#ffab40'; c.beginPath(); c.arc(p.x + 3, y - 9, 1.5 + Math.sin(this.time * 30) * 0.5, 0, Math.PI * 2); c.fill(); }
        else if (p.kind === 'oil') { c.fillStyle = '#4e342e'; c.strokeStyle = '#1a1230'; c.lineWidth = 1; c.beginPath(); c.ellipse(p.x, y, 5, 4, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(p.x - 1.5, y - 1.5, 1.4, 0, Math.PI * 2); c.fill(); }
        else { c.fillStyle = '#ff5252'; c.beginPath(); c.arc(p.x, y, 2.5, 0, Math.PI * 2); c.fill(); }
        break;
      }
    }
  }
}
