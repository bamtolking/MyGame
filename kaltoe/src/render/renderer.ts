// 캔버스 렌더러: 월드(바닥·장식·적·무기·픽업) + 효과 + 화면 공간 UI(조이스틱·화살표·비네트)
import type { World, Enemy } from '../sim/types';
import { orbitPositions } from '../sim/weapons';
import { WEAPON } from '../content';
import type { StagePalette } from '../content/types';
import {
  angry, bubble, coin, decor as decorSprite, drawSprite, drawSpriteRot, emoji, gem, gemTier, glow, person, setSpriteScale, shadow, spriteScale,
  whiteOf, worker, type Sprite,
} from './sprites';
import { Fx } from './fx';

export const VIEW_SHORT = 420;   // 화면 짧은 변에 보이는 월드 단위

export interface Joy { active: boolean; bx: number; by: number; kx: number; ky: number }

export class Renderer {
  g: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; zoom = 1;
  camX = 0; camY = 0;
  low = false;
  private pattern: CanvasPattern | null = null;
  private bS = 1; private bx = 0; private by = 0;   // 월드 기본 변환
  dprCap = 2;
  private patternKey = '';
  time = 0;

  constructor(public canvas: HTMLCanvasElement, public fx: Fx) {
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.dpr = Math.min(this.low ? 1 : this.dprCap, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.zoom = Math.min(this.W, this.H) / VIEW_SHORT;
    setSpriteScale(this.zoom * this.dpr);
    this.fx.numScale = Math.max(1, Math.round(this.zoom * this.dpr * 2) / 2);
    this.patternKey = '';
  }

  viewSize(): [number, number] { return [this.W / this.zoom, this.H / this.zoom]; }

  setLow(low: boolean) { this.low = low; this.fx.setLow(low); this.resize(); }

  private floorPattern(pal: StagePalette): CanvasPattern | null {
    const S = spriteScale();
    const key = JSON.stringify(pal) + S;
    if (this.pattern && this.patternKey === key) return this.pattern;
    const T = 64;
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(T * 2 * S);
    const g = c.getContext('2d')!;
    g.scale(S, S);
    g.fillStyle = pal.floor; g.fillRect(0, 0, T * 2, T * 2);
    g.fillStyle = pal.floorAlt; g.fillRect(0, 0, T, T); g.fillRect(T, T, T, T);
    // 카펫 질감
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.globalAlpha = 0.07;
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() > 0.5 ? '#000' : '#fff'; g.fillRect(rnd() * T * 2, rnd() * T * 2, 1.2, 1.2); }
    g.globalAlpha = 1;
    g.strokeStyle = pal.line; g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, T * 2 - 1, T * 2 - 1);
    g.beginPath(); g.moveTo(T, 0); g.lineTo(T, T * 2); g.moveTo(0, T); g.lineTo(T * 2, T); g.stroke();
    const pat = this.g.createPattern(c, 'repeat');
    if (pat && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(1 / S));
    this.pattern = pat; this.patternKey = key;
    return pat;
  }

  render(w: World, dt: number, joy: Joy | null) {
    const g = this.g;
    const fx = this.fx;
    this.time += dt;
    const p = w.player;
    // 카메라: 플레이어를 부드럽게 따라감
    this.camX += (p.x - this.camX) * Math.min(1, dt * 12);
    this.camY += (p.y - this.camY) * Math.min(1, dt * 12);
    if (Math.abs(p.x - this.camX) > 300 || Math.abs(p.y - this.camY) > 300) { this.camX = p.x; this.camY = p.y; }
    const [sx, sy] = fx.shakeOffset();
    const S = this.zoom * this.dpr;
    const cx = this.camX + sx / this.zoom, cy = this.camY + sy / this.zoom;
    const [vw, vh] = this.viewSize();
    const x0 = cx - vw / 2, y0 = cy - vh / 2, x1 = cx + vw / 2, y1 = cy + vh / 2;
    const pal = w.cfg.stage.palette;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = pal.floor;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.bS = S; this.bx = this.canvas.width / 2 - cx * S; this.by = this.canvas.height / 2 - cy * S;
    g.setTransform(S, 0, 0, S, this.bx, this.by);

    // 바닥
    const pat = this.floorPattern(pal);
    if (pat) { g.fillStyle = pat; g.fillRect(x0 - 2, y0 - 2, vw + 4, vh + 4); }
    this.drawDecor(w, x0, y0, x1, y1);

    const vis = (x: number, y: number, m = 60) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;

    // 장판
    for (const z of w.zones) {
      if (!vis(z.x, z.y, z.r)) continue;
      const k = Math.min(1, z.t * 4) * Math.min(1, (z.life - z.t) * 2);
      g.globalAlpha = 0.28 * k;
      g.fillStyle = z.color;
      g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.6 * k;
      g.strokeStyle = z.hostile ? '#ff3b3b' : z.color;
      g.lineWidth = 2;
      g.setLineDash(z.hostile ? [6, 5] : []);
      g.lineDashOffset = -this.time * 20;
      g.beginPath(); g.arc(z.x, z.y, z.r * (0.96 + Math.sin(this.time * 6 + z.x) * 0.04), 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    g.globalAlpha = 1;

    // 오라(바닥에 깔림)
    for (const wi of w.weapons) {
      if (wi.def.archetype !== 'aura') continue;
      const r = wi.st.area * w.d.areaMul;
      const gl = glow(hexA(wi.def.color, 0.55), Math.min(260, r));
      g.globalAlpha = 0.55 + Math.sin(this.time * 5) * 0.08;
      g.drawImage(gl.c, p.x - r, p.y - r, r * 2, r * 2);
      g.globalAlpha = 0.5;
      g.strokeStyle = wi.def.color; g.lineWidth = 2;
      g.setLineDash([10, 8]); g.lineDashOffset = -this.time * 30;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }

    // 폭발 예고/지뢰/투척
    for (const b of w.blasts) {
      if (!vis(b.x, b.y, b.r + 40)) continue;
      const k = Math.min(1, b.t / Math.max(0.01, b.delay));
      if (b.kind === 'slam') {
        g.globalAlpha = 0.18 + 0.2 * k;
        g.fillStyle = '#ff2e2e';
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.9;
        g.strokeStyle = '#ff2e2e'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(b.x, b.y, b.r * k, 0, Math.PI * 2); g.stroke();
      } else if (b.kind === 'strike' || b.kind === 'ult') {
        g.globalAlpha = 0.35 + 0.4 * k;
        g.strokeStyle = b.color; g.lineWidth = 2;
        g.beginPath(); g.arc(b.x, b.y, b.r * (1.3 - 0.3 * k), 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
        if (b.sprite) {
          const s = emoji(b.sprite, 18);
          drawSprite(g, s, b.x, b.y - (1 - k) * 160, 1);
        }
      } else if (b.kind === 'lob') {
        const px = b.sx + (b.x - b.sx) * k, py = b.sy + (b.y - b.sy) * k;
        const h = Math.sin(k * Math.PI) * 70;
        g.globalAlpha = 0.25;
        g.fillStyle = '#000';
        g.beginPath(); g.ellipse(px, py, 7, 3.5, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.4 * k;
        g.strokeStyle = b.color; g.lineWidth = 1.5;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
        drawSpriteRot(g, emoji(b.sprite || '●', 16), px, py - h, k * 8);
      } else if (b.kind === 'mine') {
        const blink = b.armed && Math.floor(this.time * 6 + b.x) % 2 === 0;
        g.globalAlpha = b.armed ? 1 : 0.6;
        drawSprite(g, emoji(b.sprite || '●', 16), b.x, b.y, 1);
        if (blink) { g.globalAlpha = 0.5; g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(b.x, b.y - 8, 2.5, 0, Math.PI * 2); g.fill(); }
      }
    }
    g.globalAlpha = 1;

    // 픽업
    for (const k of w.pickups) {
      if (!vis(k.x, k.y, 20)) continue;
      const bob = Math.sin(this.time * 4 + k.x * 0.05) * 1.5;
      if (k.kind === 'xp') drawSprite(g, gem(gemTier(k.value)), k.x, k.y + bob);
      else if (k.kind === 'coin') {
        const s = coin();
        const sc = Math.abs(Math.sin(this.time * 5 + k.x));
        g.drawImage(s.c, k.x - s.ax * sc, k.y - s.ay + bob, s.w * Math.max(0.15, sc), s.h);
      } else {
        const icon = k.kind === 'chest' ? '📦' : k.kind === 'coffee' ? '☕' : k.kind === 'chicken' ? '🍗' : k.kind === 'magnet' ? '🧲' : k.kind === 'bomb' ? '💣' : '⏰';
        const big = k.kind === 'chest';
        const gl = glow(big ? (k.bossChest ? 'rgba(255,90,220,.9)' : 'rgba(255,215,64,.9)') : 'rgba(255,255,255,.7)', big ? 34 : 18);
        g.globalAlpha = 0.6 + Math.sin(this.time * 6) * 0.2;
        g.drawImage(gl.c, k.x - gl.ax, k.y - gl.ay + bob, gl.w, gl.h);
        g.globalAlpha = 1;
        drawSprite(g, emoji(icon, big ? 26 : 18), k.x, k.y + bob * 2);
      }
    }

    // 그림자
    if (!this.low) {
      for (const e of w.enemies) {
        if (e.dead || !vis(e.x, e.y)) continue;
        const s = shadow(e.r);
        g.drawImage(s.c, e.x - s.ax, e.y + e.r * 0.7 - s.ay, s.w, s.h);
      }
      const ps = shadow(12);
      g.drawImage(ps.c, p.x - ps.ax, p.y + 10 - ps.ay, ps.w, ps.h);
    }

    // 적
    let bossList: Enemy[] | null = null;
    for (const e of w.enemies) {
      if (e.dead || !vis(e.x, e.y, e.r + 30)) continue;
      if (e.boss) { (bossList ??= []).push(e); continue; }
      this.drawEnemy(w, e);
    }

    // 플레이어
    this.drawPlayer(w);

    if (bossList) for (const e of bossList) this.drawEnemy(w, e);

    // 궤도 무기 & 드론
    for (const wi of w.weapons) {
      if (wi.def.archetype === 'orbit' && wi.on > 0) {
        const sz = Math.max(14, wi.st.area * w.d.areaMul * 2.2);
        const s = emoji(wi.def.projectile, Math.round(sz));
        for (const pos of orbitPositions(w, wi)) drawSpriteRot(g, s, pos.x, pos.y, this.time * 6);
      } else if (wi.def.archetype === 'drone') {
        const s = emoji(wi.def.projectile, 18);
        for (const d of wi.drones) drawSprite(g, s, d.x, d.y + Math.sin(this.time * 5 + d.x) * 2);
      }
    }

    // 투사체
    for (const b of w.bullets) {
      if (b.dead || !vis(b.x, b.y, 30)) continue;
      if (b.kind === 'drone') {
        g.fillStyle = WEAPON.get(w.weapons.find(x => x.slot === b.slot)?.def.id ?? '')?.color ?? '#7df9ff';
        g.beginPath(); g.arc(b.x, b.y, Math.max(3, b.r), 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(b.x, b.y, Math.max(1.5, b.r * 0.5), 0, Math.PI * 2); g.fill();
        continue;
      }
      const s = emoji(b.sprite, Math.round(Math.max(13, b.r * 2.4)));
      drawSpriteRot(g, s, b.x, b.y, b.kind === 'boomerang' ? b.rot : b.rot + Math.PI / 4);
    }

    // 광선 & 고리 (가산 합성)
    g.globalCompositeOperation = 'lighter';
    for (const b of w.beams) {
      const k = Math.min(1, b.life / b.maxLife * 3) * Math.min(1, (b.maxLife - b.life) * 12);
      const ex = b.x + Math.cos(b.ang) * b.len, ey = b.y + Math.sin(b.ang) * b.len;
      g.lineCap = 'round';
      g.globalAlpha = 0.35 * k; g.strokeStyle = b.color; g.lineWidth = b.w * 1.8;
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(ex, ey); g.stroke();
      g.globalAlpha = 0.9 * k; g.lineWidth = b.w * 0.8;
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(ex, ey); g.stroke();
      g.globalAlpha = k; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, b.w * 0.25);
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(ex, ey); g.stroke();
    }
    for (const r of w.rings) {
      const k = 1 - r.r / r.maxR;
      g.globalAlpha = 0.8 * k; g.strokeStyle = r.color; g.lineWidth = r.w * 0.8;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.9 * k; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;

    // 적 탄
    for (const b of w.ebullets) {
      if (b.dead || !vis(b.x, b.y, 20)) continue;
      if (b.sprite && b.sprite !== '•') { drawSprite(g, emoji(b.sprite, 14), b.x, b.y); continue; }
      g.fillStyle = '#ff2e63';
      g.beginPath(); g.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); g.fill();
    }

    fx.drawWorld(g);

    // 말풍선(최상단)
    for (const e of w.enemies) {
      if (e.dead || e.shoutT <= 0 || !e.shout || !vis(e.x, e.y, 80)) continue;
      const s = bubble(e.shout, 7, e.boss ? '#ff3b3b' : '#ffae00');
      g.globalAlpha = Math.min(1, e.shoutT * 3);
      drawSprite(g, s, e.x, e.y - e.r * 1.6 - s.h * 0.4);
    }
    g.globalAlpha = 1;

    // ── 화면 공간 ──
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawIndicators(w, cx, cy);
    // 비네트 + 저체력 경고
    const lowHp = p.hp / w.d.maxHp < 0.3;
    const vg = g.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, lowHp ? `rgba(200,0,30,${0.35 + Math.sin(this.time * 6) * 0.15})` : hexA(pal.fog, 0.55));
    g.fillStyle = vg;
    g.fillRect(0, 0, this.W, this.H);
    if (p.clockT > 0) { g.fillStyle = 'rgba(120,200,255,.12)'; g.fillRect(0, 0, this.W, this.H); }
    if (fx.flash > 0) { g.globalAlpha = fx.flash; g.fillStyle = fx.flashColor; g.fillRect(0, 0, this.W, this.H); g.globalAlpha = 1; }
    if (joy && joy.active) {
      g.globalAlpha = 0.28; g.fillStyle = '#fff';
      g.beginPath(); g.arc(joy.bx, joy.by, 52, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.6; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(joy.bx, joy.by, 52, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.85; g.fillStyle = '#fff';
      g.beginPath(); g.arc(joy.kx, joy.ky, 24, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }

  private drawDecor(w: World, x0: number, y0: number, x1: number, y1: number) {
    const decor = w.cfg.stage.decor;
    if (!decor.length) return;
    const C = 220;
    const g = this.g;
    const tint = w.cfg.stage.palette.floor;
    for (let cx = Math.floor(x0 / C) - 1; cx <= Math.floor(x1 / C); cx++) {
      for (let cy = Math.floor(y0 / C) - 1; cy <= Math.floor(y1 / C); cy++) {
        let h = (cx * 73856093) ^ (cy * 19349663) ^ 0x5bd1e995;
        h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
        const n = (h >>> 3) % 3;
        for (let i = 0; i < n; i++) {
          h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
          const px = cx * C + (h % 1000) / 1000 * C;
          const py = cy * C + ((h >>> 10) % 1000) / 1000 * C;
          const ch = decor[(h >>> 20) % decor.length];
          const sz = 22 + ((h >>> 5) % 14);
          drawSprite(g, decorSprite(ch, sz, tint), px, py);
        }
      }
    }
  }

  private enemySprite(w: World, e: Enemy): Sprite {
    const d = e.def;
    if (d.label) return bubble(d.label, e.r, d.tint ?? '#ff5a7a');
    if (d.body) return person(d.sprite, d.body.suit, d.body.tie, e.r, Math.floor(this.time * 6 + e.seed) & 3);
    return angry(d.sprite, Math.round(e.r * 2.1), d.tint ?? (e.elite ? '#ffb000' : '#ff3b5c'));
  }

  private drawEnemy(w: World, e: Enemy) {
    const g = this.g;
    const s = this.enemySprite(w, e);
    let sc = e.spawnT > 0 ? 1 - e.spawnT * 2.4 : 1;
    const wob = Math.sin(this.time * 9 + e.seed) * 0.06;
    let x = e.x, y = e.y + Math.abs(Math.sin(this.time * 7 + e.seed)) * -1.5;
    // 예고 흔들림
    if (e.st === 11 || e.st === 21 || e.st === 1) { x += Math.sin(this.time * 60) * 1.5; sc *= 1 + Math.sin(this.time * 30) * 0.06; }
    if (e.elite || e.boss) {
      const gl = glow(e.boss ? 'rgba(255,60,60,.55)' : 'rgba(255,200,40,.6)', e.r * 1.9);
      g.globalAlpha = 0.6 + Math.sin(this.time * 5) * 0.2;
      g.drawImage(gl.c, e.x - gl.ax, e.y - gl.ay, gl.w, gl.h);
      g.globalAlpha = 1;
    }
    if (e.freezeT > 0) {
      g.fillStyle = 'rgba(150,220,255,.55)';
      g.beginPath(); g.arc(e.x, e.y, e.r * 1.15, 0, Math.PI * 2); g.fill();
    }
    // save/restore 대신 행렬을 직접 계산(적 수백 마리 → 비용 절감)
    const rot = e.def.body || e.def.label ? 0 : wob;
    const sx = (e.face < 0 && e.def.body ? -sc : sc) * this.bS, sy = sc * (1 + wob * 0.5) * this.bS;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    g.setTransform(cs * sx, sn * sx, -sn * sy, cs * sy, this.bx + x * this.bS, this.by + y * this.bS);
    g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    if (e.flash > 0) {
      g.globalAlpha = Math.min(1, e.flash / 0.12);
      const ws = whiteOf(s);
      g.drawImage(ws.c, -ws.ax, -ws.ay, ws.w, ws.h);
      g.globalAlpha = 1;
    }
    g.setTransform(this.bS, 0, 0, this.bS, this.bx, this.by);
    if (e.st === 21) {
      g.globalAlpha = 0.25 + Math.abs(Math.sin(this.time * 18)) * 0.3;
      g.fillStyle = '#ff3b1a';
      g.beginPath(); g.arc(e.x, e.y, Number(e.def.params?.blastRadius ?? 60), 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (e.st === 1 && e.boss) {
      g.globalAlpha = 0.35;
      g.strokeStyle = '#ff2e2e'; g.lineWidth = e.r * 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.dx * 380, e.y + e.dy * 380); g.stroke();
      g.globalAlpha = 1;
    }
    if (e.st === 11) {
      g.globalAlpha = 0.3;
      g.strokeStyle = '#ffae00'; g.lineWidth = e.r; g.lineCap = 'round';
      g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + e.dx * 120, e.y + e.dy * 120); g.stroke();
      g.globalAlpha = 1;
    }
    if (e.burnT > 0 && Math.random() < 0.15) this.fx.burst(e.x, e.y - e.r * 0.5, '#ff7a1a', 1, 40, 2.5, 1, -80);
    if (e.elite && !e.boss) {
      const bw = e.r * 2.2, bh = 3;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(e.x - bw / 2, e.y - e.r - 10, bw, bh);
      g.fillStyle = '#ffcf33'; g.fillRect(e.x - bw / 2, e.y - e.r - 10, bw * Math.max(0, e.hp / e.maxHp), bh);
    }
  }

  private drawPlayer(w: World) {
    const g = this.g;
    const p = w.player;
    const look = w.cfg.character.look;
    const frame = p.moving ? Math.floor(p.walk) & 3 : 0;
    const s = worker(look, frame, w.flags.has('bigHead') ? 40 : 34);
    const flip = p.fx < -0.05;
    if (p.ultActiveT > 0) {
      const gl = glow('rgba(255,120,240,.7)', 40);
      g.globalAlpha = 0.7 + Math.sin(this.time * 10) * 0.2;
      g.drawImage(gl.c, p.x - gl.ax, p.y - gl.ay, gl.w, gl.h);
      g.globalAlpha = 1;
    }
    const blink = p.invulnT > 0 && Math.floor(this.time * 14) % 2 === 0;
    if (blink) g.globalAlpha = 0.45;
    const squash = p.moving ? 1 + Math.sin(p.walk * 2) * 0.03 : 1 + Math.sin(this.time * 3) * 0.02;
    g.save();
    g.translate(p.x, p.y);
    g.scale(flip ? -1 : 1, 1);
    g.scale(1 / squash, squash);
    g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    if (p.hurtT > 0) {
      g.globalAlpha = Math.min(1, p.hurtT * 4);
      const ws = whiteOf(s);
      g.drawImage(ws.c, -ws.ax, -ws.ay, ws.w, ws.h);
    }
    g.restore();
    g.globalAlpha = 1;
    // 체력바
    const bw = 30, bh = 3.5, by = p.y + 17;
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(p.x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
    const hk = Math.max(0, p.hp / w.d.maxHp);
    g.fillStyle = hk > 0.5 ? '#3ddc84' : hk > 0.25 ? '#ffc93c' : '#ff4d4d';
    g.fillRect(p.x - bw / 2, by, bw * hk, bh);
  }

  private drawIndicators(w: World, cx: number, cy: number) {
    const g = this.g;
    const targets: { x: number; y: number; icon: string; color: string }[] = [];
    for (const e of w.enemies) if (!e.dead && (e.boss || e.elite)) targets.push({ x: e.x, y: e.y, icon: e.boss ? '💢' : '⚠️', color: e.boss ? '#ff3b3b' : '#ffcf33' });
    for (const k of w.pickups) if (!k.dead && k.kind === 'chest') targets.push({ x: k.x, y: k.y, icon: '📦', color: '#ffd84d' });
    const [vw, vh] = this.viewSize();
    for (const t of targets) {
      const dx = t.x - cx, dy = t.y - cy;
      if (Math.abs(dx) < vw / 2 - 10 && Math.abs(dy) < vh / 2 - 10) continue;
      const ang = Math.atan2(dy, dx);
      const m = 26;
      const hx = this.W / 2 - m, hy = this.H / 2 - m;
      const k = Math.min(hx / Math.abs(Math.cos(ang) || 1e-6), hy / Math.abs(Math.sin(ang) || 1e-6));
      const sx = this.W / 2 + Math.cos(ang) * k, sy = this.H / 2 + Math.sin(ang) * k;
      g.save();
      g.translate(sx, sy);
      g.rotate(ang);
      g.fillStyle = t.color;
      g.beginPath(); g.moveTo(14, 0); g.lineTo(2, -8); g.lineTo(2, 8); g.closePath(); g.fill();
      g.restore();
      const es = emoji(t.icon, 16);
      g.drawImage(es.c, sx - Math.cos(ang) * 12 - 10, sy - Math.sin(ang) * 12 - 10, 20, 20);
    }
  }
}

export function hexA(hex: string, a: number): string {
  if (!hex.startsWith('#')) return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
