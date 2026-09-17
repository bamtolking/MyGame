// Canvas 2D 렌더러: 카메라, 타일 사전 렌더, 예고 표시, 개체, 파티클, 미니맵, 조이스틱
import type { RunState, Enemy } from '../sim/types';
import { TILE, BOSS, ENEMIES, PLAYER } from '../data/balance';
import { zoneDef } from '../data/zones';
import { bagWeight, weightSlow } from '../sim/state';
import { drawPlayer, drawEnemy, drawChest, drawLoot, drawDrone, drawExitPad, drawDoor } from './sprites';
import { Fx } from './fx';
import type { JoyState } from '../platform/input';
import { padAvailable } from '../sim/escape';

export class Renderer {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D;
  w = 1; h = 1; dpr = 1; scale = 1;
  cam = { x: 0, y: 0, init: false };
  fx = new Fx();
  t = 0;
  lowFx = false;
  private zoneCv: HTMLCanvasElement | null = null; private zoneKey = '';
  /** 화면 하단 조작 영역 시작 y (CSS px) */
  moveZoneTop = 0;

  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.c = cv.getContext('2d')!; }

  resize(): void {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    this.scale = Math.min(1.35, Math.max(0.95, this.w / 400));
    this.moveZoneTop = this.h * 0.3;
    this.zoneKey = '';
  }

  private buildZone(s: RunState): void {
    const z = s.zoneRt; const def = zoneDef(s.zone);
    const key = `${s.zone}:${z.collapse?.state || ''}:${this.dpr}`;
    if (this.zoneKey === key && this.zoneCv) return;
    this.zoneKey = key;
    const cv = document.createElement('canvas'); cv.width = z.w * TILE * this.dpr; cv.height = z.h * TILE * this.dpr;
    const c = cv.getContext('2d')!; c.scale(this.dpr, this.dpr);
    c.fillStyle = def.floor; c.fillRect(0, 0, z.w * TILE, z.h * TILE);
    // 바닥 무늬
    for (let ty = 0; ty < z.h; ty++) for (let tx = 0; tx < z.w; tx++) {
      const ch = z.rows[ty][tx]; const x = tx * TILE, y = ty * TILE;
      const hsh = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      if (ch === '#' || ch === 'y') continue;
      if ((hsh % 7) === 0) { c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(x + 4, y + 4, TILE - 8, TILE - 8); }
      if ((hsh % 11) === 0) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + (hsh % 20), y + (hsh % 13), 6, 3); }
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (ch === 'x') { c.strokeStyle = 'rgba(255,120,60,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 4, y + 8); c.lineTo(x + 14, y + 16); c.lineTo(x + 10, y + 26); c.moveTo(x + 22, y + 4); c.lineTo(x + 18, y + 18); c.lineTo(x + 28, y + 28); c.stroke(); }
      if (ch === 'o') { // 상자더미
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 4, y + 8, TILE - 4, TILE - 6);
        c.fillStyle = '#7a5a3a'; c.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); c.strokeStyle = '#3a2a18'; c.lineWidth = 1.5; c.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.moveTo(x + 2, y + 16); c.lineTo(x + 30, y + 16); c.moveTo(x + 16, y + 2); c.lineTo(x + 16, y + 30); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 4, y + 4, TILE - 8, 3);
      }
    }
    // 벽: 면 + 윗면 하이라이트
    for (let ty = 0; ty < z.h; ty++) for (let tx = 0; tx < z.w; tx++) {
      const ch = z.rows[ty][tx]; if (ch !== '#' && ch !== 'y') continue;
      const x = tx * TILE, y = ty * TILE;
      c.fillStyle = def.wall; c.fillRect(x, y, TILE, TILE);
      const below = z.rows[ty + 1]?.[tx]; const above = z.rows[ty - 1]?.[tx];
      if (below && below !== '#' && below !== 'y') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + TILE - 6, TILE, 6); }
      if (above && above !== '#' && above !== 'y') { c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x, y, TILE, 4); }
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 3, y + 8, TILE - 6, 2); c.fillRect(x + 3, y + 20, TILE - 6, 2);
      if (ch === 'y') { c.strokeStyle = 'rgba(255,200,80,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6, y + 4); c.lineTo(x + 16, y + 14); c.lineTo(x + 12, y + 28); c.stroke(); }
    }
    this.zoneCv = cv;
  }

  worldToScreen(x: number, y: number): [number, number] { return [(x - this.cam.x) * this.scale + this.w / 2, (y - this.cam.y) * this.scale + this.h / 2]; }

  updateCamera(s: RunState, dt: number): void {
    const p = s.player; const z = s.zoneRt;
    const look = p.moving ? 36 : 0;
    let tx = p.x + p.moveX * look, ty = p.y + p.moveY * look - 20;
    const vw = this.w / this.scale, vh = this.h / this.scale; const mw = z.w * TILE, mh = z.h * TILE;
    tx = mw < vw ? mw / 2 : Math.max(vw / 2, Math.min(mw - vw / 2, tx));
    ty = mh < vh ? mh / 2 : Math.max(vh / 2, Math.min(mh - vh / 2, ty));
    if (!this.cam.init) { this.cam.x = tx; this.cam.y = ty; this.cam.init = true; return; }
    const k = 1 - Math.exp(-dt * 6);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
  }
  resetCamera(): void { this.cam.init = false; }

  draw(s: RunState, joy: JoyState, dt: number, hudTop: number): void {
    this.t += dt; this.fx.update(dt);
    this.buildZone(s);
    const c = this.c; const p = s.player; const z = s.zoneRt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#06080f'; c.fillRect(0, 0, this.w, this.h);
    const sh = this.fx.shake; const sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
    c.save();
    c.translate(this.w / 2 + sx, this.h / 2 + sy); c.scale(this.scale, this.scale); c.translate(-this.cam.x, -this.cam.y);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // 타일
    const vw = this.w / this.scale, vh = this.h / this.scale;
    const x0 = Math.max(0, this.cam.x - vw / 2 - TILE), y0 = Math.max(0, this.cam.y - vh / 2 - TILE);
    const x1 = Math.min(z.w * TILE, this.cam.x + vw / 2 + TILE), y1 = Math.min(z.h * TILE, this.cam.y + vh / 2 + TILE);
    if (x1 > x0 && y1 > y0) c.drawImage(this.zoneCv!, x0 * this.dpr, y0 * this.dpr, (x1 - x0) * this.dpr, (y1 - y0) * this.dpr, x0, y0, x1 - x0, y1 - y0);
    // 붕괴 경고 깜빡임
    if (z.collapse?.state === 'warn') { c.save(); c.globalAlpha = 0.25 + 0.25 * Math.sin(this.t * 14); c.fillStyle = '#ff6b3b'; for (let ty = 0; ty < z.h; ty++) for (let tx = 0; tx < z.w; tx++) if (z.rows[ty][tx] === 'x') c.fillRect(tx * TILE, ty * TILE, TILE, TILE); c.restore(); }
    // 탈출 지점·문·드론
    if (z.exitPad) { c.save(); c.translate(z.exitPad.x, z.exitPad.y); drawExitPad(c, z.exitPad.r, z.exitPad.final, padAvailable(s), this.t); c.restore(); }
    if (z.door) { c.save(); c.translate(z.door.x, z.door.y); drawDoor(c, z.door.open, this.t); c.restore(); }
    if (z.drone) { c.save(); c.translate(z.drone.x, z.drone.y); drawDrone(c, this.t, z.drone.used); c.restore(); }
    for (const ch of s.chests) { c.save(); c.translate(ch.x, ch.y); drawChest(c, ch.kind, ch.opened, this.t); c.restore(); }
    for (const l of s.loots) { c.save(); c.translate(l.x, l.y); if (l.blocked) c.globalAlpha = 0.6; drawLoot(c, l.type, this.t + l.id, l.count); c.restore(); }
    // 생성 예고
    for (const sp of s.spawns) { c.save(); c.globalAlpha = 0.6 + 0.3 * Math.sin(this.t * 20); c.strokeStyle = '#ff5c6c'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.arc(sp.x, sp.y, 14 + (1 - Math.min(1, sp.t)) * 6, 0, Math.PI * 2); c.stroke(); c.restore(); }
    // 적 예고 (스프라이트 아래)
    for (const e of s.enemies) this.drawTelegraph(c, s, e);
    // 적
    for (const e of s.enemies) {
      const faceA = e.type === 'shooter' || e.type === 'armored' || e.state === 'windup' ? Math.atan2(e.dirY, e.dirX) : Math.atan2(p.y - e.y, p.x - e.x);
      c.save(); c.translate(e.x, e.y); if (e.slowT > 0) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#9ff0ff'; c.beginPath(); c.arc(0, 0, e.r + 4, 0, Math.PI * 2); c.fill(); c.restore(); }
      const def = ENEMIES[e.type];
      drawEnemy(c, { type: e.type, state: e.state, stateT: e.stateT, windup: def.windup, faceA, flash: e.hitFlash, hpRatio: e.hp / e.maxHp, slow: e.slowT > 0, t: this.t, phase: e.boss?.phase, pattern: e.boss?.pattern, telegraph: e.boss?.telegraph, patternT: e.boss?.patternT });
      if (e.hp < e.maxHp && e.type !== 'boss') { const w = e.r * 2.2; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(-w / 2, -e.r - 12, w, 4); c.fillStyle = '#ff5c6c'; c.fillRect(-w / 2, -e.r - 12, w * (e.hp / e.maxHp), 4); }
      c.restore();
    }
    // 투사체
    for (const pr of s.projectiles) {
      c.save(); c.translate(pr.x, pr.y);
      if (pr.owner === 'player') {
        const a = Math.atan2(pr.vy, pr.vx); c.rotate(a);
        const col = s.tier >= 2 ? '#ffe680' : s.tier >= 1 ? '#ffd27a' : '#ffb347';
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 6;
        if (pr.kind === 'pellet') { c.beginPath(); c.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2); c.fill(); }
        else { c.fillRect(-9, -1.8, 16, 3.6); c.fillStyle = '#fff'; c.fillRect(2, -1, 5, 2); }
      } else {
        const col = pr.src === 'boss' ? '#ff66c4' : '#c77dff';
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 8; c.beginPath(); c.arc(0, 0, pr.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, pr.r * 0.4, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    // 플레이어
    c.save(); c.translate(p.x, p.y);
    if (p.dashT > 0) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#5ad0e0'; c.beginPath(); c.arc(-p.dashDx * 14, -p.dashDy * 14, 13, 0, Math.PI * 2); c.fill(); c.restore(); }
    drawPlayer(c, { aimA: Math.atan2(p.aimY, p.aimX), walk: p.walk, moving: p.moving, weapon: s.weapon, tier: s.tier, weightRatio: Math.min(1, bagWeight(s) / s.bag.maxWeight), dashing: p.dashT > 0, hurt: p.hurtT, invuln: p.invulnT > 0 || (p.hurtT > 0 && Math.sin(this.t * 40) > 0), recoil: p.recoil, t: this.t, hpRatio: p.hp / p.maxHp });
    if (p.shield > 0) { c.save(); c.globalAlpha = 0.35 + 0.1 * Math.sin(this.t * 6); c.strokeStyle = '#5ad0e0'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -2, 20, 0, Math.PI * 2); c.stroke(); c.restore(); }
    c.restore();
    this.fx.draw(c);
    c.restore();
    // ── 화면 공간 ──
    this.drawIndicators(s, hudTop);
    this.drawMinimap(s, hudTop);
    if (joy.active) {
      c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#9fdde8'; c.lineWidth = 2; c.beginPath(); c.arc(joy.ox, joy.oy, 46, 0, Math.PI * 2); c.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy; const d = Math.hypot(dx, dy); const m = Math.min(46, d); const kx = d > 0 ? joy.ox + dx / d * m : joy.ox, ky = d > 0 ? joy.oy + dy / d * m : joy.oy;
      c.globalAlpha = 0.75; c.fillStyle = '#5ad0e0'; c.beginPath(); c.arc(kx, ky, 20, 0, Math.PI * 2); c.fill(); c.restore();
    }
    // 피격 방향·저체력 비네트
    if (p.hurtT > 0.3) { const a = Math.atan2(p.hurtDy, p.hurtDx); c.save(); c.translate(this.w / 2, this.h / 2); c.rotate(a); c.globalAlpha = (p.hurtT - 0.3) * 2.5; c.fillStyle = '#ff5c6c'; c.beginPath(); c.moveTo(-this.w * 0.6, 0); c.lineTo(-this.w * 0.45, -this.h * 0.35); c.lineTo(-this.w * 0.45, this.h * 0.35); c.closePath(); c.fill(); c.restore(); }
    if (p.hp / p.maxHp < 0.35 && s.status === 'active') { c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 5); const g = c.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.35, this.w / 2, this.h / 2, this.h * 0.75); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, 'rgba(255,0,40,0.8)'); c.fillStyle = g; c.fillRect(0, 0, this.w, this.h); c.restore(); }
  }

  private drawTelegraph(c: CanvasRenderingContext2D, s: RunState, e: Enemy): void {
    const def = ENEMIES[e.type]; const p = s.player;
    if (e.type === 'boss' && e.boss) {
      const b = e.boss; if (b.pattern === 'idle' || b.fired) return;
      const k = Math.min(1, b.patternT / b.telegraph);
      if (b.pattern === 'cone') {
        const dirs = b.phase === 2 ? [b.dirA, b.dirA + Math.PI] : [b.dirA];
        for (const a of dirs) { c.save(); c.translate(e.x, e.y); c.globalAlpha = 0.25 + k * 0.35; c.fillStyle = k > 0.75 ? '#ff5c6c' : '#ff9a3b'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, BOSS.cone.radius, a - BOSS.cone.arc / 2, a + BOSS.cone.arc / 2); c.closePath(); c.fill(); c.globalAlpha = 0.9; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, BOSS.cone.radius * k, a - BOSS.cone.arc / 2, a + BOSS.cone.arc / 2); c.closePath(); c.stroke(); c.restore(); }
      } else if (b.pattern === 'ring') {
        c.save(); c.translate(e.x, e.y); c.globalAlpha = 0.3 + k * 0.4; c.strokeStyle = '#ff66c4'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.arc(0, 0, e.r + 10 + k * 20, 0, Math.PI * 2); c.stroke(); c.restore();
      }
      return;
    }
    if (e.state === 'windup') {
      const k = 1 - e.stateT / def.windup;
      if (e.type === 'shooter') { c.save(); c.globalAlpha = 0.35 + k * 0.4; c.strokeStyle = '#c77dff'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + e.dirX * 260, e.y + e.dirY * 260); c.stroke(); c.restore(); }
      else if (e.type === 'armored') { const ad = def as typeof ENEMIES.armored; c.save(); c.globalAlpha = 0.25 + k * 0.4; c.fillStyle = '#ffb347'; c.beginPath(); const px = -e.dirY, py = e.dirX; c.moveTo(e.x + px * 18, e.y + py * 18); c.lineTo(e.x + e.dirX * (ad.chargeSpeed * ad.chargeTime + 20) + px * 18, e.y + e.dirY * (ad.chargeSpeed * ad.chargeTime + 20) + py * 18); c.lineTo(e.x + e.dirX * (ad.chargeSpeed * ad.chargeTime + 20) - px * 18, e.y + e.dirY * (ad.chargeSpeed * ad.chargeTime + 20) - py * 18); c.lineTo(e.x - px * 18, e.y - py * 18); c.closePath(); c.fill(); c.restore(); }
      else { c.save(); c.translate(e.x, e.y); c.globalAlpha = 0.3 + k * 0.4; c.fillStyle = '#ff9a3b'; const a = Math.atan2(e.dirY, e.dirX); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, def.reach + 8, a - 0.9, a + 0.9); c.closePath(); c.fill(); c.restore(); }
    } else if (e.state === 'fuse') {
      const k = 1 - e.stateT / def.windup; c.save(); c.translate(e.x, e.y); c.globalAlpha = 0.2 + k * 0.4; c.fillStyle = '#ff5c2f'; c.beginPath(); c.arc(0, 0, def.reach, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.9; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, def.reach * k, 0, Math.PI * 2); c.stroke(); c.restore();
    } else if (e.state === 'charge') {
      c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#ffb347'; c.lineWidth = 6; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + e.dirX * 40, e.y + e.dirY * 40); c.stroke(); c.restore();
    }
  }

  /** 화면 밖 목표(출구·탈출 지점·미개봉 상자) 방향 화살표 */
  private drawIndicators(s: RunState, hudTop: number): void {
    const c = this.c; const z = s.zoneRt; const targets: { x: number; y: number; col: string; label: string }[] = [];
    if (z.cleared || s.phase !== 'combat') {
      if (z.door && z.door.open) targets.push({ x: z.door.x, y: z.door.y, col: '#6ee7a0', label: '출구' });
      if (z.exitPad && padAvailable(s)) targets.push({ x: z.exitPad.x, y: z.exitPad.y, col: z.exitPad.final ? '#e9c46a' : '#6ee7a0', label: z.exitPad.final ? '최종 출구' : '탈출' });
    }
    for (const ch of s.chests) if (!ch.opened && ch.kind === 'safe') targets.push({ x: ch.x, y: ch.y, col: '#ff8a5c', label: '금고' });
    for (const tg of targets) {
      const [sx, sy] = this.worldToScreen(tg.x, tg.y);
      const m = 22; const top = hudTop + 40; const bottom = this.h - 40;
      if (sx > m && sx < this.w - m && sy > top && sy < bottom) continue;
      const cx = this.w / 2, cy = this.h / 2; const dx = sx - cx, dy = sy - cy; const a = Math.atan2(dy, dx);
      const ex = Math.max(m, Math.min(this.w - m, sx)), ey = Math.max(top, Math.min(bottom, sy));
      c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = tg.col; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-6, 8); c.closePath(); c.fill(); c.restore();
      c.save(); c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = tg.col; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(tg.label, ex, ey + 22); c.fillText(tg.label, ex, ey + 22); c.restore();
    }
  }

  private drawMinimap(s: RunState, hudTop: number): void {
    const c = this.c; const z = s.zoneRt; const mw = 74, mh = Math.round(mw * z.h / z.w); const sc = mw / (z.w * TILE);
    const ox = this.w - mw - 10, oy = hudTop + 8;
    c.save(); c.globalAlpha = 0.85; c.fillStyle = 'rgba(6,8,15,0.7)'; c.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    c.fillStyle = '#2a3446'; for (let ty = 0; ty < z.h; ty++) for (let tx = 0; tx < z.w; tx++) { const ch = z.rows[ty][tx]; if (ch === '#' || ch === 'y') continue; c.fillRect(ox + tx * TILE * sc, oy + ty * TILE * sc, TILE * sc + 0.5, TILE * sc + 0.5); }
    const dot = (x: number, y: number, col: string, r = 2) => { c.fillStyle = col; c.beginPath(); c.arc(ox + x * sc, oy + y * sc, r, 0, Math.PI * 2); c.fill(); };
    if (z.exitPad) dot(z.exitPad.x, z.exitPad.y, z.exitPad.final ? '#e9c46a' : '#6ee7a0', 3.5);
    if (z.door) dot(z.door.x, z.door.y, z.door.open ? '#6ee7a0' : '#7d8aa4', 2.5);
    for (const ch of s.chests) if (!ch.opened) dot(ch.x, ch.y, ch.kind === 'safe' ? '#ff8a5c' : '#e9c46a', 2);
    if (z.drone && !z.drone.used) dot(z.drone.x, z.drone.y, '#9fdde8', 2);
    for (const e of s.enemies) dot(e.x, e.y, e.type === 'boss' ? '#ff66c4' : '#ff5c6c', e.type === 'boss' ? 3 : 1.5);
    dot(s.player.x, s.player.y, '#fff', 2.5);
    c.restore();
  }
}
