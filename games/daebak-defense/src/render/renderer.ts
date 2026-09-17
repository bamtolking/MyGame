import type { GameState, Enemy, Unit, SimEvent } from '../sim/types';
import { FIELD_W, FIELD_H, PATH_POINTS, PATH_HALF, SLOTS, SLOT_R, posAt, PATH_LEN } from '../data/map';
import { ENEMIES } from '../data/enemies';
import { UNITS, MYTHICS } from '../data/units';
import { unitSprite, enemySprite, SPR, GRADE_HEX } from './sprites';
import { Fx, DmgNumbers } from './fx';
import { baseStats } from '../sim/state';

export interface ViewState {
  selectedUnit: number | null;
  hoverSlot: number | null;
  skillMode: 'bomb' | 'freeze' | null;
  skillX: number; skillY: number; skillValid: boolean;
  showRanges: boolean;
}

export class Renderer {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  scale = 1; ox = 0; oy = 0; dpr = 1;
  bg: HTMLCanvasElement | null = null;
  fx = new Fx(); dmg = new DmgNumbers();
  time = 0;
  unitAnim = new Map<number, { shot: number; born: number }>();
  enemyFlash = new Map<number, number>();
  view: ViewState = { selectedUnit: null, hoverSlot: null, skillMode: null, skillX: 0, skillY: 0, skillValid: false, showRanges: true };
  onEvent: ((e: SimEvent) => void) | null = null;
  lowFx = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr); this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
    this.ox = (cssW - FIELD_W * this.scale) / 2; this.oy = (cssH - FIELD_H * this.scale) / 2;
    this.bg = null;
  }
  /** CSS px → logical field coords */
  toField(px: number, py: number): [number, number] { return [(px - this.ox) / this.scale, (py - this.oy) / this.scale]; }
  slotAt(fx: number, fy: number): number | null {
    let best: number | null = null, bd = 30;
    for (const s of SLOTS) { const d = Math.hypot(s.x - fx, s.y - fy); if (d < bd) { bd = d; best = s.id; } }
    return best;
  }

  private buildBg(): HTMLCanvasElement {
    const cv = document.createElement('canvas'); cv.width = this.canvas.width; cv.height = this.canvas.height;
    const c = cv.getContext('2d')!; c.scale(this.dpr, this.dpr);
    c.fillStyle = '#0d1023'; c.fillRect(0, 0, cv.width, cv.height);
    c.translate(this.ox, this.oy); c.scale(this.scale, this.scale);
    // ground
    const g = c.createLinearGradient(0, 0, 0, FIELD_H); g.addColorStop(0, '#1a1f3d'); g.addColorStop(1, '#141633');
    c.fillStyle = g; c.fillRect(-40, -40, FIELD_W + 80, FIELD_H + 80);
    // stars / lanterns glow
    let sd = 7; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`; c.fillRect(r() * FIELD_W, r() * FIELD_H, 1.2, 1.2); }
    // stalls (decoration in empty corners)
    const stall = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = '#3e2723'; c.fillRect(x, y + 6, w, h); c.fillStyle = col; c.beginPath(); c.moveTo(x - 4, y + 8); c.lineTo(x + w / 2, y - 6); c.lineTo(x + w + 4, y + 8); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < w; i += 8) c.fillRect(x + i, y + 8, 4, 3); };
    stall(20, 320, 40, 30, '#c62828'); stall(20, 520, 44, 40, '#6a1b9a'); stall(350, 385, 34, 30, '#ef6c00'); stall(340, 545, 46, 36, '#00838f');
    // path
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#3b2a1a'; c.lineWidth = PATH_HALF * 2 + 8; c.beginPath(); PATH_POINTS.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    c.strokeStyle = '#8b6b45'; c.lineWidth = PATH_HALF * 2; c.stroke();
    c.strokeStyle = 'rgba(255,220,160,0.18)'; c.lineWidth = 4; c.setLineDash([10, 14]); c.stroke(); c.setLineDash([]);
    // direction chevrons
    c.fillStyle = 'rgba(255,240,200,0.35)';
    for (let p = 40; p < PATH_LEN - 20; p += 110) { const [x, y] = posAt(p); const [x2, y2] = posAt(p + 6); const a = Math.atan2(y2 - y, x2 - x); c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(-4, -5); c.lineTo(3, 0); c.lineTo(-4, 5); c.closePath(); c.fill(); c.restore(); }
    // lantern posts along path corners
    c.fillStyle = '#ffb74d';
    for (const [x, y] of PATH_POINTS.slice(1, -1)) { const gl = c.createRadialGradient(x, y, 2, x, y, 40); gl.addColorStop(0, 'rgba(255,183,77,0.22)'); gl.addColorStop(1, 'rgba(255,183,77,0)'); c.fillStyle = gl; c.beginPath(); c.arc(x, y, 40, 0, Math.PI * 2); c.fill(); }
    // entrance gate
    c.fillStyle = '#5d4037'; c.fillRect(-30, 30, 22, 60); c.fillStyle = '#ffcc80'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('입구', -19, 62);
    // vault (exit)
    c.fillStyle = '#4e342e'; c.beginPath(); c.roundRect(160, 575, 80, 40, 8); c.fill(); c.strokeStyle = '#ffd54f'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ffd54f'; c.font = 'bold 11px sans-serif'; c.fillText('보물 창고', 200, 598);
    c.fillStyle = '#2b1d14'; c.beginPath(); c.roundRect(188, 577, 24, 20, 4); c.fill();
    // slot pads
    for (const s of SLOTS) { c.beginPath(); c.arc(s.x, s.y, SLOT_R, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fill(); c.strokeStyle = 'rgba(255,230,180,0.35)'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
    return cv;
  }

  consumeEvents(s: GameState): void {
    const fx = this.fx;
    for (const e of s.events) {
      switch (e.t) {
        case 'shoot': this.unitAnim.set(e.unit, { shot: this.time, born: this.unitAnim.get(e.unit)?.born ?? 0 }); if (e.kind === 'puff') fx.puff(e.x + 10, e.y - 20, '#eceff1', 5, 0.5); if (e.kind === 'pulse') fx.ring(e.tx, e.ty, 50, '#b39ddb', 0.35, 2); if (e.kind === 'suntele') fx.ring(e.tx, e.ty, 75, '#ff9100', 0.8, 2); break;
        case 'hit': this.enemyFlash.set(e.enemy, 0.08); this.dmg.push(e.enemy, e.x, e.y, e.dmg); if (e.kind === 'hit' && !this.lowFx) fx.burst(e.x, e.y, 2, '#fff', 40, 1.5, 0.25); break;
        case 'explode': {
          if (e.kind === 'cracker') { fx.burst(e.x, e.y, 14, '#ff7043', 90, 3, 0.45); fx.ring(e.x, e.y, e.r, '#ffab40', 0.3); fx.shake(2, 0.15); }
          else if (e.kind === 'acidburst') { fx.burst(e.x, e.y, 8, '#aeea00', 70, 2.5, 0.4); fx.ring(e.x, e.y, e.r, '#c6ff00', 0.3); }
          else if (e.kind === 'acid') { fx.burst(e.x, e.y, 5, '#9ccc65', 40, 2, 0.35); }
          else if (e.kind === 'sun') { fx.burst(e.x, e.y, 30, '#ffab00', 140, 4, 0.6); fx.ring(e.x, e.y, e.r, '#fff176', 0.5, 4); fx.zone(e.x, e.y, e.r, '#ff6f00', 2); fx.shake(5, 0.3); fx.flash(0.1); }
          else if (e.kind === 'gravity') { fx.ring(e.x, e.y, e.r, '#ffd600', 0.6, 4); fx.burst(e.x, e.y, 16, '#fff59d', 60, 3, 0.5); fx.shake(3, 0.2); }
          else if (e.kind === 'bomb') { fx.burst(e.x, e.y, 24, '#ff5252', 130, 3.5, 0.5); fx.ring(e.x, e.y, e.r, '#ff8a80', 0.4, 4); fx.shake(4, 0.25); }
          else if (e.kind === 'heal') { fx.ring(e.x, e.y, e.r, '#ce93d8', 0.4, 1.5); }
          break;
        }
        case 'chain': fx.bolt(e.pts, e.conducted ? '#80d8ff' : '#ffee58', e.grade >= 4 ? 0.3 : 0.2, e.grade >= 4 ? 3 : 2); break;
        case 'shock': fx.burst(e.x, e.y, 5, '#80d8ff', 50, 2, 0.3); break;
        case 'die': { const d = ENEMIES[e.type]; fx.burst(e.x, e.y, e.boss ? 40 : 8, d.color, e.boss ? 150 : 70, e.boss ? 4 : 2.5, e.boss ? 0.9 : 0.45); if (e.boss) { fx.shake(6, 0.4); fx.flash(0.15); } break; }
        case 'exit': fx.text(e.x, e.y - 10, `-${e.dmg}`, '#ff5252', 14, 1); fx.shake(3, 0.2); break;
        case 'summon': break;
        case 'merge': fx.burst(e.x, e.y, 18, GRADE_HEX[e.grade], 90, 3, 0.6); fx.ring(e.x, e.y, 30, GRADE_HEX[e.grade], 0.5, 3); break;
        case 'mythic': fx.burst(e.x, e.y, 50, MYTHICS[e.id].color, 160, 4, 1.0); fx.ring(e.x, e.y, 60, '#fff', 0.8, 4); fx.ring(e.x, e.y, 120, MYTHICS[e.id].color, 1.0, 3); fx.shake(5, 0.4); fx.flash(0.2); this.unitAnim.set(e.unit, { shot: 0, born: this.time }); break;
        case 'pull': fx.ring(e.x, e.y, 20, '#b39ddb', 0.3, 2); break;
        case 'gold': fx.gold(e.x, e.y - 8, e.amount); break;
        case 'skill': if (e.kind === 'freeze') { fx.burst(e.x, e.y, 24, '#80deea', 100, 3, 0.6); fx.ring(e.x, e.y, e.r, '#e0f7fa', 0.5, 4); fx.zone(e.x, e.y, e.r, '#4dd0e1', 1.5); } break;
        case 'seal': { const sl = SLOTS[e.slot]; fx.ring(sl.x, sl.y, SLOT_R + 6, e.phase === 'warn' ? '#ffab40' : '#7c4dff', 0.6, 3); break; }
        default: break;
      }
      this.onEvent?.(e);
    }
    s.events.length = 0;
  }

  draw(s: GameState, dt: number): void {
    this.time += dt;
    this.fx.update(dt); this.dmg.flush(dt, this.fx);
    for (const [id, t] of this.enemyFlash) { const n = t - dt; if (n <= 0) this.enemyFlash.delete(id); else this.enemyFlash.set(id, n); }
    if (!this.bg) this.bg = this.buildBg();
    const c = this.ctx; const cw = this.canvas.width, ch = this.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    let shx = 0, shy = 0;
    if (this.fx.shakeT > 0) { shx = (this.fx.rnd() - 0.5) * this.fx.shakeAmt * 2; shy = (this.fx.rnd() - 0.5) * this.fx.shakeAmt * 2; }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(this.ox + shx, this.oy + shy); c.scale(this.scale, this.scale);
    c.lineJoin = 'round'; c.lineCap = 'round';
    this.drawSlotStates(s);
    this.drawUnitsUnder(s);
    this.drawEnemies(s);
    this.drawUnits(s);
    this.drawProjectiles(s);
    this.fx.draw(c);
    this.drawOverlays(s);
    if (this.fx.flashT > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(255,255,255,${Math.min(0.35, this.fx.flashT * 2)})`; c.fillRect(0, 0, cw, ch); }
  }

  private drawSlotStates(s: GameState): void {
    const c = this.ctx; const v = this.view;
    const sel = v.selectedUnit != null ? s.units.find(u => u.id === v.selectedUnit) : null;
    // overheat
    const rt = s.waveRt;
    if (rt && rt.overheatT > 0) {
      const warn = rt.overheatT > 25; const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      for (const i of rt.overheatSlots) { const sl = SLOTS[i]; c.beginPath(); c.arc(sl.x, sl.y, SLOT_R + 4, 0, Math.PI * 2); c.strokeStyle = warn ? `rgba(255,171,64,${0.3 + pulse * 0.5})` : `rgba(255,87,34,${0.5 + pulse * 0.4})`; c.lineWidth = 3; c.stroke(); if (!warn) { c.fillStyle = 'rgba(255,87,34,0.15)'; c.fill(); } c.fillStyle = '#ffab40'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText(warn ? '과열 예고' : '과열 +40%', sl.x, sl.y - SLOT_R - 6); }
    }
    // seals
    for (const z of s.seals) { const sl = SLOTS[z.slot]; const pulse = 0.5 + 0.5 * Math.sin(this.time * 8); c.beginPath(); c.arc(sl.x, sl.y, SLOT_R + 4, 0, Math.PI * 2); if (z.warnT > 0) { c.strokeStyle = `rgba(255,171,64,${0.4 + pulse * 0.5})`; c.lineWidth = 3; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]); c.fillStyle = '#ffab40'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText(`봉인 ${z.warnT.toFixed(1)}`, sl.x, sl.y - SLOT_R - 6); } else { c.fillStyle = 'rgba(124,77,255,0.35)'; c.fill(); c.strokeStyle = '#7c4dff'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#d1c4e9'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText(`봉인 ${z.sealT.toFixed(1)}`, sl.x, sl.y - SLOT_R - 6); } }
    // placement highlight
    if (sel) {
      for (const sl of SLOTS) { const occ = s.slots[sl.id]; if (occ === sel.id) continue; c.beginPath(); c.arc(sl.x, sl.y, SLOT_R, 0, Math.PI * 2); c.fillStyle = occ == null ? 'rgba(129,199,132,0.22)' : 'rgba(255,213,79,0.12)'; c.fill(); c.strokeStyle = occ == null ? '#81c784' : 'rgba(255,213,79,0.6)'; c.lineWidth = 1.5; c.stroke(); }
    }
    if (v.hoverSlot != null) { const sl = SLOTS[v.hoverSlot]; c.beginPath(); c.arc(sl.x, sl.y, SLOT_R + 3, 0, Math.PI * 2); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
  }

  private drawUnitsUnder(s: GameState): void {
    const c = this.ctx; const sel = this.view.selectedUnit;
    for (const u of s.units) {
      if (u.loc.t !== 'f') continue; const sl = SLOTS[u.loc.slot];
      const st = baseStats(s, u);
      if (u.id === sel) {
        c.beginPath(); c.arc(sl.x, sl.y, st.range, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5; c.stroke();
        if (st.aura) { c.beginPath(); c.arc(sl.x, sl.y, st.auraRange, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,241,118,0.6)'; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]); }
        if (u.mythic === 'chrono') { c.beginPath(); c.arc(sl.x, sl.y, 100, 0, Math.PI * 2); c.strokeStyle = 'rgba(0,229,255,0.6)'; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]); }
      }
      if (u.mythic === 'chrono') { const pulse = 0.5 + 0.5 * Math.sin(this.time * 2); c.beginPath(); c.arc(sl.x, sl.y, 100, 0, Math.PI * 2); c.fillStyle = `rgba(0,229,255,${0.05 + pulse * 0.04})`; c.fill(); }
      if (u.tele > 0) { const k = 1 - u.tele / 0.8; c.beginPath(); c.arc(u.teleX, u.teleY, 75, 0, Math.PI * 2); c.strokeStyle = `rgba(255,145,0,${0.4 + k * 0.5})`; c.lineWidth = 2 + k * 3; c.stroke(); c.beginPath(); c.arc(u.teleX, u.teleY, 75 * k, 0, Math.PI * 2); c.fillStyle = 'rgba(255,145,0,0.18)'; c.fill(); }
    }
  }

  private drawUnits(s: GameState): void {
    const c = this.ctx;
    for (const u of s.units) {
      if (u.loc.t !== 'f') continue; const sl = SLOTS[u.loc.slot];
      const an = this.unitAnim.get(u.id); const since = an ? this.time - an.shot : 9; const bornK = an && this.time - an.born < 0.8 ? (this.time - an.born) / 0.8 : 1;
      const bob = Math.sin(this.time * 3 + u.id) * 1.2;
      const recoil = since < 0.15 ? (1 - since / 0.15) : 0;
      const slotId = sl.id; const sealed = s.seals.some(z => z.sealT > 0 && z.slot === slotId);
      c.save(); c.translate(sl.x, sl.y + bob);
      const sc = (u.mythic ? 1.25 : 0.95 + u.grade * 0.05) * (bornK < 1 ? 0.6 + 0.4 * bornK + Math.sin(bornK * Math.PI) * 0.35 : 1);
      c.scale(sc * (1 + recoil * 0.12), sc * (1 - recoil * 0.12));
      if (u.id === this.view.selectedUnit) { c.beginPath(); c.arc(0, 8, 22, 0, Math.PI * 2); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
      const spr = unitSprite(u.kind, u.grade, u.mythic, this.dpr);
      c.drawImage(spr, -SPR / 2, -SPR / 2 - 6, SPR, SPR);
      if (sealed) { c.globalAlpha = 0.6; c.fillStyle = '#7c4dff'; c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
      c.restore();
      // grade pip & lock
      const col = GRADE_HEX[u.grade];
      c.fillStyle = col; c.beginPath(); c.arc(sl.x + 14, sl.y + 12, 4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1; c.stroke();
      if (u.locked) { c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('🔒', sl.x - 14, sl.y + 16); }
      if (u.fav) { c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('⭐', sl.x - 14, sl.y - 12); }
      if (u.moveCd > 0) { c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(sl.x, sl.y, SLOT_R + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (u.moveCd / 1.5)); c.stroke(); }
    }
  }

  private drawEnemies(s: GameState): void {
    const c = this.ctx;
    for (const e of s.enemies) {
      if (!e.alive || e.progress <= 0) continue;
      const d = ENEMIES[e.type]; const spr = enemySprite(e.type, this.dpr); const size = e.isBoss ? 72 : SPR;
      const sc = e.isBoss ? 1 : e.type === 'slimelet' ? 0.7 : 0.8;
      const wob = e.freezeT > 0 ? 0 : Math.sin(this.time * 8 + e.id) * 0.06;
      c.save(); c.translate(e.x, e.y);
      if (e.slowT > 0) { c.beginPath(); c.arc(0, 4, d.r + 4, 0, Math.PI * 2); c.fillStyle = 'rgba(79,195,247,0.35)'; c.fill(); }
      if (e.corro > 0) { c.beginPath(); c.arc(0, 4, d.r + 2, 0, Math.PI * 2); c.strokeStyle = 'rgba(156,204,101,0.8)'; c.lineWidth = 2; c.stroke(); }
      if (e.vulnT > 0) { c.beginPath(); c.arc(0, 4, d.r + 6, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,82,82,0.8)'; c.lineWidth = 2; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
      c.scale(sc * (1 + wob), sc * (1 - wob));
      c.drawImage(spr, -size / 2, -size / 2 - 4, size, size);
      if (this.enemyFlash.has(e.id)) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-size / 2, -size / 2 - 4, size, size); c.globalCompositeOperation = 'source-over'; }
      if (e.freezeT > 0) { c.fillStyle = 'rgba(178,235,242,0.55)'; c.beginPath(); c.roundRect(-d.r - 4, -d.r - 6, d.r * 2 + 8, d.r * 2 + 10, 4); c.fill(); }
      c.restore();
      if (e.shield > 0) { c.beginPath(); c.arc(e.x, e.y + 2, d.r + 5, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.stroke(); }
      if (e.type === 'boss_cart' || (e.type === 'boss_king' && e.bossPhase === 1)) { c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillStyle = e.bossStance === 0 ? '#b0bec5' : '#ff5252'; c.fillText(e.bossStance === 0 ? '🛡 방어' : '💥 취약', e.x, e.y - d.r - 16); }
      if (e.type === 'boss_flag' && e.escortIds.length) { c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffab40'; c.fillText(`호위 ${e.escortIds.length}`, e.x, e.y - d.r - 16); }
      if (e.escortOf >= 0) { c.beginPath(); c.arc(e.x, e.y + 2, d.r + 3, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,171,64,0.8)'; c.lineWidth = 1.5; c.stroke(); }
      // hp bar
      const w = e.isBoss ? 44 : 18, h = e.isBoss ? 5 : 3; const bx = e.x - w / 2, by = e.y - d.r - (e.isBoss ? 10 : 8);
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(bx - 1, by - 1, w + 2, h + 2);
      c.fillStyle = e.isBoss ? '#ff5252' : e.type === 'courier' ? '#ffd54f' : '#66bb6a'; c.fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), h);
      if (e.maxShield > 0 && e.shield > 0) { c.fillStyle = '#e0e0e0'; c.fillRect(bx, by - 2, w * (e.shield / e.maxShield), 1.5); }
    }
  }

  private drawProjectiles(s: GameState): void {
    const c = this.ctx;
    for (const p of s.projectiles) {
      switch (p.kind) {
        case 'arrow': { const a = Math.atan2(p.ty - p.y, p.tx - p.x); c.save(); c.translate(p.x, p.y); c.rotate(a); c.strokeStyle = p.grade >= 2 ? '#ffd54f' : '#e8d5a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, 0); c.lineTo(5, 0); c.stroke(); c.fillStyle = '#eee'; c.beginPath(); c.moveTo(6, 0); c.lineTo(2, -2); c.lineTo(2, 2); c.closePath(); c.fill(); c.restore(); break; }
        case 'shard': c.save(); c.translate(p.x, p.y); c.rotate(this.time * 10); c.fillStyle = '#b3e5fc'; c.beginPath(); c.moveTo(0, -5); c.lineTo(4, 0); c.lineTo(0, 5); c.lineTo(-4, 0); c.closePath(); c.fill(); c.restore(); break;
        case 'cracker': c.fillStyle = '#e53935'; c.beginPath(); c.arc(p.x, p.y, 4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffab00'; c.beginPath(); c.arc(p.x + 3, p.y - 4, 1.5, 0, Math.PI * 2); c.fill(); break;
        case 'glob': c.fillStyle = '#9ccc65'; c.beginPath(); c.arc(p.x, p.y, 4, 0, Math.PI * 2); c.fill(); break;
        case 'skill_bomb': c.fillStyle = '#ff5252'; c.beginPath(); c.arc(p.x, p.y, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(255,82,82,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(p.tx, p.ty, p.radius, 0, Math.PI * 2); c.stroke(); break;
        case 'skill_freeze': c.fillStyle = '#80deea'; c.beginPath(); c.arc(p.x, p.y, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(128,222,234,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(p.tx, p.ty, p.radius, 0, Math.PI * 2); c.stroke(); break;
        default: break;
      }
    }
  }

  private drawOverlays(s: GameState): void {
    const c = this.ctx; const v = this.view;
    if (v.skillMode) {
      const r = v.skillMode === 'bomb' ? 60 : 70; const col = v.skillMode === 'bomb' ? '#ff5252' : '#4dd0e1';
      c.beginPath(); c.arc(v.skillX, v.skillY, r, 0, Math.PI * 2); c.fillStyle = v.skillMode === 'bomb' ? 'rgba(255,82,82,0.18)' : 'rgba(77,208,225,0.18)'; c.fill(); c.strokeStyle = col; c.lineWidth = 2; c.setLineDash([6, 4]); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText(v.skillMode === 'bomb' ? '탭: 긴급 포격' : '탭: 냉각 폭탄', v.skillX, v.skillY - r - 6);
    }
    if (s.phase === 'countdown') {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, FIELD_W, FIELD_H);
      const n = Math.ceil(s.countdownT); const k = 1 - (s.countdownT - Math.floor(s.countdownT));
      c.fillStyle = '#fff'; c.font = `bold ${60 + k * 20}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(Math.max(1, n)), FIELD_W / 2, FIELD_H / 2); c.textBaseline = 'alphabetic';
      c.font = 'bold 14px system-ui'; c.fillText('적이 입구(왼쪽 위)에서 보물 창고(아래)로 옵니다', FIELD_W / 2, FIELD_H / 2 + 50);
    }
  }
}
