// Canvas 2D 렌더러: 카메라, 타일 캐시, 개체, 투사체, 장치, 오버레이(빙의 후보·예고선·착탄 표시).
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import { isPossessable } from '../sim/possession';
import { T } from '../sim/tilemap';
import type { Entity, Projectile } from '../sim/types';
import { World } from '../sim/world';
import { Fx } from './fx';
import { drawBody, entityOpts } from './sprites';

const S = RULES.tile;

export class Renderer {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  fx = new Fx();
  width = 0; height = 0; dpr = 1; scale = 1;
  camX = 0; camY = 0;
  /** 플레이어를 화면 세로 어디에 둘지(0.5 = 중앙). 하단 조작 영역을 피해 위쪽에 */
  focusY = 0.44;
  private tileCanvas: HTMLCanvasElement | null = null; private tileVersion = -1; private tileZone = -1;
  time = 0;
  lowFx = false;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d')!; }
  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1); this.width = w; this.height = h;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    // 화면 폭에 약 11.5타일이 보이도록. 큰 화면은 조금 더 크게
    this.scale = Math.max(0.85, Math.min(1.45, w / (11.5 * S)));
  }
  worldToScreen(x: number, y: number): { x: number; y: number } { return { x: (x - this.camX) * this.scale + this.width / 2, y: (y - this.camY) * this.scale + this.height * this.focusY }; }
  private buildTiles(w: World): void {
    const m = w.map; const cv = document.createElement('canvas'); cv.width = m.w * S; cv.height = m.h * S;
    const c = cv.getContext('2d')!;
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const t = m.get(tx, ty); const x = tx * S, y = ty * S;
      if (t === T.WALL) {
        // 바깥(사방이 벽)은 어둡게, 안쪽 벽은 패널 느낌
        const inner = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => m.get(tx + ox, ty + oy) !== T.WALL);
        c.fillStyle = inner ? '#1d2438' : '#0b0f1c'; c.fillRect(x, y, S, S);
        if (inner) { c.fillStyle = '#2b3552'; c.fillRect(x + 2, y + 2, S - 4, S - 4); c.fillStyle = '#1a2036'; c.fillRect(x + 6, y + 6, S - 12, S - 12); c.fillStyle = '#354266'; c.fillRect(x + 4, y + 4, 4, 4); }
      } else if (t === T.PIT) {
        c.fillStyle = '#05070f'; c.fillRect(x, y, S, S); c.strokeStyle = '#1b2440'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
        c.fillStyle = '#111830'; c.fillRect(x + 10, y + 10, 4, 4); c.fillRect(x + 20, y + 22, 3, 3);
      } else if (t === T.CRACK) {
        c.fillStyle = '#3a3f4c'; c.fillRect(x, y, S, S); c.fillStyle = '#4b5162'; c.fillRect(x + 2, y + 2, S - 4, S - 4);
        c.strokeStyle = '#ffb347'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6, y + 4); c.lineTo(x + 14, y + 14); c.lineTo(x + 10, y + 20); c.lineTo(x + 20, y + 28); c.moveTo(x + 14, y + 14); c.lineTo(x + 24, y + 8); c.stroke();
        c.fillStyle = '#ffb347'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('균열', x + S / 2, y + S - 3);
      } else if (t === T.DOOR) {
        c.fillStyle = '#2a3348'; c.fillRect(x, y, S, S); c.fillStyle = '#6a7ba8'; c.fillRect(x + 3, y + 3, S - 6, S - 6); c.fillStyle = '#2a3348'; c.fillRect(x + S / 2 - 1, y + 3, 2, S - 6);
        c.fillStyle = '#ffd23c'; c.fillRect(x + S / 2 - 5, y + S / 2 - 5, 10, 10);
      } else if (t === T.EXIT) {
        c.fillStyle = '#0f2b1e'; c.fillRect(x, y, S, S); c.fillStyle = '#1e5c3a'; c.fillRect(x + 2, y + 2, S - 4, S - 4);
        c.fillStyle = '#7dffb0'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('출구', x + S / 2, y + S / 2 + 4);
      } else if (t === T.VENT) {
        c.fillStyle = '#141a2c'; c.fillRect(x, y, S, S); c.fillStyle = '#3a1f2a'; c.fillRect(x + 4, y + 4, S - 8, S - 8);
        c.fillStyle = '#141a2c'; for (let i = 0; i < 3; i++) c.fillRect(x + 6, y + 8 + i * 7, S - 12, 3);
      } else {
        const alt = t === T.FLOOR_ALT; c.fillStyle = ((tx + ty) & 1) ? '#171c2e' : '#151a2b'; c.fillRect(x, y, S, S);
        c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(x + 1, y + 1, S - 2, 1);
        if (alt) { c.fillStyle = '#1f2740'; c.fillRect(x + 8, y + 8, S - 16, S - 16); c.fillStyle = '#2a3455'; c.fillRect(x + 12, y + 12, 3, 3); }
      }
    }
    this.tileCanvas = cv; this.tileVersion = m.version; this.tileZone = w.zoneIndex;
  }
  render(w: World, dtReal: number): void {
    const ctx = this.ctx; this.time += dtReal;
    const p = w.player;
    // 카메라: 플레이어 따라가되 맵 밖은 덜 보이게
    const viewW = this.width / this.scale, viewH = this.height / this.scale;
    const tx = p.x, ty = p.y;
    this.camX += (tx - this.camX) * Math.min(1, dtReal * 9); this.camY += (ty - this.camY) * Math.min(1, dtReal * 9);
    // 가로는 맵 안에 머물게, 세로는 플레이어를 항상 초점 위치에(하단 조작 영역과 겹치지 않게)
    const minX = viewW / 2 - S * 1.5, maxX = w.map.w * S - viewW / 2 + S * 1.5;
    if (maxX > minX) this.camX = Math.max(minX, Math.min(maxX, this.camX)); else this.camX = w.map.w * S / 2;
    void viewH;
    if (!this.tileCanvas || this.tileVersion !== w.map.version || this.tileZone !== w.zoneIndex) this.buildTiles(w);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#070b16'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    const ox = this.width / 2 - this.camX * this.scale + this.fx.shakeX, oy = this.height * this.focusY - this.camY * this.scale + this.fx.shakeY;
    ctx.translate(ox, oy); ctx.scale(this.scale, this.scale);
    // 타일
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.tileCanvas!, 0, 0);
    ctx.imageSmoothingEnabled = true;
    this.drawDevices(w);
    this.drawGroundOverlays(w, p);
    // 개체(y순)
    const ents = w.entities.filter((e) => e.alive).sort((a, b) => a.y - b.y);
    for (const e of ents) this.drawEntity(w, e, p);
    for (const pr of w.projectiles) this.drawProjectile(pr);
    this.drawAirOverlays(w, p);
    this.fx.draw(ctx);
    ctx.restore();
    // 화면 효과
    if (this.fx.flash > 0) { ctx.fillStyle = this.fx.flashColor; ctx.globalAlpha = Math.min(0.5, this.fx.flash * 2.5); ctx.fillRect(0, 0, this.width, this.height); ctx.globalAlpha = 1; }
    if (w.lastChance) { const g = ctx.createRadialGradient(this.width / 2, this.height * this.focusY, this.height * 0.2, this.width / 2, this.height * this.focusY, this.height * 0.8); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${0.35 + Math.sin(this.time * 20) * 0.1})`); ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height); }
    else if (p.collapsing || (p.stability != null && p.stabilityMax != null && p.stability < p.stabilityMax * RULES.stabilityWarnRatio)) { const a = p.collapsing ? 0.22 + Math.sin(this.time * 10) * 0.08 : 0.1; const g = ctx.createRadialGradient(this.width / 2, this.height * 0.45, this.height * 0.3, this.width / 2, this.height * 0.45, this.height * 0.85); g.addColorStop(0, 'rgba(255,90,40,0)'); g.addColorStop(1, `rgba(255,90,40,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height); }
    if (w.savedFlash > 0) { ctx.fillStyle = `rgba(140,246,255,${Math.min(0.35, w.savedFlash * 0.3)})`; ctx.fillRect(0, 0, this.width, this.height); }
  }
  private drawDevices(w: World): void {
    const ctx = this.ctx; const t = this.time;
    for (const d of w.devices) {
      if (d.kind === 'switch') {
        ctx.fillStyle = '#20263a'; ctx.beginPath(); ctx.arc(d.x, d.y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = d.on ? '#7dffb0' : '#ff6a3c'; ctx.beginPath(); ctx.arc(d.x, d.y, 9 + (d.on ? 0 : Math.sin(t * 5) * 1.5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.on ? '작동' : '스위치', d.x, d.y - 19);
        if (!d.on) { ctx.strokeStyle = 'rgba(255,106,60,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, 20 + (t * 20) % 12, 0, Math.PI * 2); ctx.stroke(); }
      } else if (d.kind === 'panel') {
        ctx.fillStyle = d.used ? '#1f3a2a' : '#3a3520'; ctx.fillRect(d.x - 12, d.y - 12, 24, 24); ctx.fillStyle = d.used ? '#7dffb0' : '#ffd23c'; ctx.fillRect(d.x - 7, d.y - 7, 14, 14);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.used ? '개방됨' : '패널', d.x, d.y - 16);
      } else if (d.kind === 'repair') {
        ctx.fillStyle = '#1a3a3a'; ctx.fillRect(d.x - 13, d.y - 13, 26, 26); ctx.fillStyle = d.uses > 0 ? '#5cf2e0' : '#2a4a4a'; ctx.fillRect(d.x - 3, d.y - 9, 6, 18); ctx.fillRect(d.x - 9, d.y - 3, 18, 6);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.uses > 0 ? '수리 단자' : '사용됨', d.x, d.y - 17);
      } else if (d.kind === 'overload') {
        ctx.fillStyle = '#3a2a10'; ctx.fillRect(d.x - 13, d.y - 13, 26, 26); ctx.strokeStyle = d.used ? '#555' : '#ffe66d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x + 3, d.y - 10); ctx.lineTo(d.x - 4, d.y + 1); ctx.lineTo(d.x + 2, d.y + 1); ctx.lineTo(d.x - 3, d.y + 10); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.used ? '과부하됨' : '과부하 단자(정비병)', d.x, d.y - 17);
      } else if (d.kind === 'crackedWall' && !d.broken && d.hp < d.hpMax) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(d.x - 14, d.y + 10, 28, 4); ctx.fillStyle = '#ffb347'; ctx.fillRect(d.x - 14, d.y + 10, 28 * (d.hp / d.hpMax), 4);
      } else if (d.kind === 'spawner') {
        const q = w.spawnQueue.find((s) => Math.abs(s.x - d.x) < 1 && Math.abs(s.y - d.y) < 1);
        if (q) { ctx.strokeStyle = 'rgba(255,90,90,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(d.x, d.y, 10 + (1 - Math.max(0, q.t)) * 14, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
  }
  private drawGroundOverlays(w: World, p: Entity): void {
    const ctx = this.ctx; const t = this.time;
    // 플레이어 발밑 링
    ctx.strokeStyle = w.lastChance ? '#ff4d4d' : 'rgba(55,226,255,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2); ctx.stroke();
    // 빙의 사거리(후보가 있을 때만)
    if (w.candidates.length) { ctx.strokeStyle = 'rgba(55,226,255,0.25)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, w.lastChance ? RULES.lastChanceRange : RULES.possessRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // 폭탄 착탄 예정 표시
    for (const pr of w.projectiles) if (pr.kind === 'bomb') {
      const r = pr.splash; const x = pr.fuse > 0 ? pr.x : pr.tx, y = pr.fuse > 0 ? pr.y : pr.ty;
      const u = pr.fuse > 0 ? 1 - pr.fuse / 1.6 : pr.t / pr.flight;
      ctx.strokeStyle = pr.team === 'enemy' ? 'rgba(255,90,60,0.85)' : 'rgba(255,210,60,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pr.team === 'enemy' ? 'rgba(255,90,60,0.18)' : 'rgba(255,210,60,0.15)'; ctx.beginPath(); ctx.arc(x, y, r * Math.min(1, u), 0, Math.PI * 2); ctx.fill();
    }
    // 저격 예고선(적 + 플레이어)
    for (const e of w.entities) if (e.alive && e.windup > 0 && e.windupTarget && BODIES[e.body].weapon.kind === 'pierce') {
      const a = Math.atan2(e.windupTarget.y - e.y, e.windupTarget.x - e.x); const len = 540;
      ctx.strokeStyle = e.team === 'enemy' ? `rgba(255,60,60,${0.35 + (0.8 - e.windup) * 0.6})` : 'rgba(213,139,255,0.6)'; ctx.lineWidth = e.aimshotPending ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * len, e.y + Math.sin(a) * len); ctx.stroke();
    }
    // 보스 레이저·돌진 예고
    const boss = w.entities.find((e) => e.alive && e.body === 'boss');
    if (boss) {
      const ai = boss.ai;
      if (ai.laserAge >= 0 && ai.laserTarget) {
        const a = Math.atan2(ai.laserTarget.y - boss.y, ai.laserTarget.x - boss.x);
        const firing = ai.laserAge >= 1.0;
        ctx.strokeStyle = firing ? 'rgba(255,80,80,0.95)' : `rgba(255,60,60,${0.25 + ai.laserAge * 0.5})`; ctx.lineWidth = firing ? 18 : 2 + ai.laserAge * 3;
        ctx.beginPath(); ctx.moveTo(boss.x, boss.y); ctx.lineTo(boss.x + Math.cos(a) * 800, boss.y + Math.sin(a) * 800); ctx.stroke();
        if (firing) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 6; ctx.stroke(); }
      }
      if (ai.chargeTele > 0 && ai.chargeDir) {
        ctx.strokeStyle = `rgba(255,120,60,${0.4 + (0.8 - ai.chargeTele) * 0.6})`; ctx.lineWidth = 70; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(boss.x, boss.y); ctx.lineTo(boss.x + ai.chargeDir.x * 300, boss.y + ai.chargeDir.y * 300); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    // 채널 진행
    if (w.channel) { const d = w.device(w.channel.deviceId); if (d) { ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(d.x, d.y, 20, -Math.PI / 2, -Math.PI / 2 + (w.channel.t / w.channel.need) * Math.PI * 2); ctx.stroke(); } }
    // 조준 대상 표시(약하게)
    if (w.aimTargetId > 0) { const tgt = w.entity(w.aimTargetId); if (tgt && tgt.alive) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(tgt.x, tgt.y, tgt.radius + 5, t * 3, t * 3 + 1.2); ctx.moveTo(tgt.x + Math.cos(t * 3 + Math.PI) * (tgt.radius + 5), tgt.y + Math.sin(t * 3 + Math.PI) * (tgt.radius + 5)); ctx.arc(tgt.x, tgt.y, tgt.radius + 5, t * 3 + Math.PI, t * 3 + Math.PI + 1.2); ctx.stroke(); } }
  }
  private drawEntity(w: World, e: Entity, p: Entity): void {
    const ctx = this.ctx; const o = entityOpts(e, this.time); const d = BODIES[e.body];
    const cand = isPossessable(w, e);
    const inRange = cand && w.possessTarget === e;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.radius * 0.7, e.radius * 0.9, e.radius * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    // 빙의 후보 윤곽
    if (cand) {
      const pulse = 0.6 + Math.sin(this.time * 8) * 0.4;
      ctx.strokeStyle = inRange ? `rgba(140,246,255,${0.7 + pulse * 0.3})` : `rgba(255,255,255,${0.35 + pulse * 0.35})`; ctx.lineWidth = inRange ? 4 : 2.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 7 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      if (inRange) { ctx.strokeStyle = 'rgba(140,246,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.save(); ctx.translate(e.x, e.y);
    if (o.stunned) ctx.rotate(e.facing + Math.sin(this.time * 14) * 0.25); else ctx.rotate(e.facing);
    if (e.collapsing) { ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3); ctx.globalAlpha = 0.75 + Math.sin(this.time * 25) * 0.25; }
    drawBody(ctx, e.body, o);
    ctx.restore();
    // 방패 차단 호(플레이어 방패병만 은근히)
    if (e.controlled && d.blockArc) { const arc = o.guarding ? d.guardArc : d.blockArc; ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 12, e.facing - arc, e.facing + arc); ctx.stroke(); }
    // 머리 위 표시: 적 체력바 + 빙의 아이콘 / 기절
    if (!e.controlled && e.body !== 'node') {
      const bw = e.body === 'boss' ? 90 : 30; const by = e.y - e.radius - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - bw / 2, by, bw, 5);
      const ratio = e.hp / e.hpMax;
      ctx.fillStyle = cand ? '#8cf6ff' : ratio <= RULES.possessHpRatio + 0.1 ? '#ffd23c' : '#ff5a5a'; ctx.fillRect(e.x - bw / 2, by, bw * ratio, 5);
      if (d.possessable) { const tx = e.x - bw / 2 + bw * RULES.possessHpRatio; ctx.fillStyle = '#fff'; ctx.fillRect(tx - 0.5, by - 2, 1, 9); }
      if (cand) {
        // 빙의 가능 아이콘: 다이아몬드 + 코어
        const iy = by - 12 + Math.sin(this.time * 6) * 2;
        ctx.fillStyle = inRange ? '#8cf6ff' : '#ffffff'; ctx.beginPath(); ctx.moveTo(e.x, iy - 8); ctx.lineTo(e.x + 7, iy); ctx.lineTo(e.x, iy + 8); ctx.lineTo(e.x - 7, iy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a2a33'; ctx.beginPath(); ctx.arc(e.x, iy, 3, 0, Math.PI * 2); ctx.fill();
        if (inRange) { ctx.fillStyle = '#8cf6ff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3; ctx.strokeText('빙의 가능', e.x, iy - 12); ctx.fillText('빙의 가능', e.x, iy - 12); }
      } else if (e.body === 'boss') {
        ctx.fillStyle = '#ffb3b3'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
        const label = e.ai.shielded ? '보호막 · 노드를 부숴라' : e.ai.exposedUntil > this.time + w.time - this.time ? '코어 잠금' : '코어 잠금 · 빙의 불가';
        ctx.strokeText(label, e.x, by - 8); ctx.fillText(label, e.x, by - 8);
        // 자물쇠
        ctx.fillStyle = '#ffd23c'; ctx.fillRect(e.x - 5, by - 28, 10, 8); ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, by - 28, 3.5, Math.PI, 0); ctx.stroke();
      } else if (e.body === 'turret' && !e.disabled) {
        ctx.fillStyle = '#c8d0dc'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('기계·빙의 불가', e.x, by - 4);
      }
      if (o.stunned) { for (let i = 0; i < 3; i++) { const a = this.time * 5 + (i * Math.PI * 2) / 3; ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 12, by - 6 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2); ctx.fill(); } }
      if (e.shock > 0 && !o.stunned && e.body !== 'boss') { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 15, by + 6, 30, 3); ctx.fillStyle = '#bfffff'; ctx.fillRect(e.x - 15, by + 6, 30 * (e.shock / RULES.shockMax), 3); }
    }
  }
  private drawProjectile(pr: Projectile): void {
    const ctx = this.ctx;
    if (pr.kind === 'bomb') {
      const u = pr.fuse > 0 ? 0 : Math.min(1, pr.t / pr.flight); const h = pr.fuse > 0 ? 0 : 4 * 45 * u * (1 - u);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(pr.x, pr.y - h, pr.fuse > 0 ? 10 : 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Math.sin(this.time * 25) > 0 ? '#ffd23c' : '#ff6a3c'; ctx.beginPath(); ctx.arc(pr.x + 4, pr.y - h - 6, 2.5, 0, Math.PI * 2); ctx.fill();
      if (pr.fuse > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(pr.fuse.toFixed(1), pr.x, pr.y - 16); }
      return;
    }
    const a = Math.atan2(pr.vy, pr.vx);
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
    if (pr.kind === 'pierce') { ctx.fillStyle = pr.color; ctx.fillRect(-26, -2, 30, 4); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -1.5, 8, 3); }
    else if (pr.kind === 'pellet') { ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
    else if (pr.kind === 'turret' || pr.kind === 'boss') { ctx.fillStyle = pr.color; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 0, 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = pr.color; ctx.fillRect(-9, -2, 12, 4); ctx.fillStyle = '#fff'; ctx.fillRect(0, -1.2, 4, 2.4); }
    ctx.restore();
  }
  private drawAirOverlays(w: World, p: Entity): void {
    const ctx = this.ctx;
    // 마지막 기회 표시
    if (w.lastChance) { ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4; const s = `마지막 기회 ${w.lastChance.remaining.toFixed(1)}`; ctx.strokeText(s, p.x, p.y - 30); ctx.fillText(s, p.x, p.y - 30); }
    // 상호작용 안내
    if (w.interactTarget && !w.channel) { const d = w.interactTarget; ctx.fillStyle = '#7dffb0'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3; const s = `상호작용: ${w.interactLabel}`; ctx.strokeText(s, d.x, d.y + 28); ctx.fillText(s, d.x, d.y + 28); }
  }
}
