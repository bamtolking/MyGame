// Canvas 2D renderer. Draws exactly the sim's geometry (hazard art is never smaller than its hitbox; pickups are
// drawn inside their pickup box), plus parallax, FX and the in-canvas HUD. Visual randomness never touches the sim.
import { VIEW_H, GROUND_Y, TILE, PLATFORM_THICK, STAND_H, SLIDE_H } from '../data/physics';
import { LOW_HP_FRAC, BONUS_WORD, POWER_DUR, MAGNET_R } from '../data/tuning';
import { BIOME_BY_ID, BIOMES, type BiomeDef } from '../data/biomes';
import { CHAR_BY_ID, type CharacterDef } from '../data/characters';
import { PARSED_BY_ID } from '../sim/level';
import { hurtbox } from '../sim/body';
import { totalScore, streakMul } from '../sim/run';
import type { RunState, SimEvent, Pickup, Hazard, PowerKind } from '../sim/types';
import { Fx, star } from './fx';
import { drawCharacter, rr, shade, type Pose, type Shape } from './characters';
import { drawSpike, drawTall, drawHang } from './hazards';
import { drawPickup, heart, LETTER_COLORS, POWER_NAME, POWER_DESC, POWER_COLOR, POWER_ICON } from './pickups';
import { Backdrop } from './backdrops';
export { POWER_NAME, POWER_DESC, POWER_COLOR, POWER_ICON } from './pickups';

export const MIN_VIEW_W = 840;          // portrait keeps ≥ 720 px (≥ 1.1 s at top speed) of look-ahead
export interface RenderOpts { reduceMotion: boolean; highContrast: boolean; lowFx: boolean; showHitbox: boolean }
export interface GhostView { x: number; y: number; sliding: boolean; onGround: boolean; charId: string; scale: number }


export class Renderer {
  canvas: HTMLCanvasElement; c: CanvasRenderingContext2D;
  cssW = 1; cssH = 1; dpr = 1; scale = 1; viewW = 960; viewH = VIEW_H; playerX = 220; portrait = false;
  camX = 0;
  fx = new Fx();
  opts: RenderOpts = { reduceMotion: false, highContrast: false, lowFx: false, showHitbox: false };
  time = 0;
  backdrop = new Backdrop();
  private curBiome = ''; private prevBiome = ''; private biomeFade = 1;
  private landT = 9; private jumpT = 9; private spinT = 9; private lastHpPct = 1; private hpGhost = 1;
  private flash = 0; private flashColor = '255,255,255'; private redPulse = 0;
  private banner: { text: string; sub: string; t: number; color: string } | null = null;
  private runPhase = 0; private lastX = 0;
  private skyMix = 0;          // 0 = land, 1 = bonus sky
  pbDist = 0;                  // personal-best distance (m) → a flag is planted there
  resumeCount = 0;             // s left of the post-pause countdown (drawn, sim is held by the app)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false })!;
  }

  resize(cssW: number, cssH: number): void {
    this.cssW = Math.max(1, cssW); this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.cssW * this.dpr); this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = this.cssW + 'px'; this.canvas.style.height = this.cssH + 'px';
    this.scale = Math.min(this.cssW / MIN_VIEW_W, this.cssH / VIEW_H);
    this.viewW = this.cssW / this.scale; this.viewH = this.cssH / this.scale;
    this.portrait = this.viewW < 960;
    this.playerX = this.portrait ? 120 : 220;
    this.backdrop.resize(this.cssW, this.cssH, this.dpr, this.scale);
  }

  /** world → css px */
  sx(x: number): number { return (x - this.camX) * this.scale; }
  sy(y: number): number { return this.cssH - (VIEW_H - y) * this.scale; }

  // ------------------------------------------------------------------ events → FX
  consume(events: SimEvent[], s: RunState): void {
    const f = this.fx; const b = s.body;
    for (const e of events) {
      switch (e.t) {
        case 'jump': this.jumpT = 0; if (e.n === 2) { this.spinT = 0; f.burst(b.x - 6, b.y - 4, 6, 'rgba(255,255,255,0.9)', 120, 'dot', 4, 200); } else f.burst(b.x - 10, b.y, 5, 'rgba(230,210,180,0.9)', 90, 'dot', 4, 300); break;
        case 'land': this.landT = 0; f.burst(b.x - 8, b.y, 4, 'rgba(230,210,180,0.8)', 80, 'dot', 3, 300); break;
        case 'pickup': this.onPickup(e, s); break;
        case 'hit':
          if (e.shielded) { f.ring(b.x, b.y - 40, '#9be7ff', 46); f.text(b.x, b.y - 100, '보호막!', '#9be7ff', 20); }
          else { f.burst(e.x, e.y, 14, '#ff4d6d', 320, 'chunk', 7); f.kick(9); this.flash = 0.35; this.flashColor = '255,40,70'; f.text(b.x, b.y - 100, `-${Math.round(e.dmg)}`, '#ff6b81', 24); }
          break;
        case 'smash': f.burst(e.x, e.y, 16, BIOME_BY_ID[s.biome]?.hazard.spike ?? '#fff', 420, 'chunk', 8, 1200); f.kick(5); f.text(e.x, e.y - 30, '쾅!', '#ffd166', 22); break;
        case 'fall': f.kick(8); this.flash = 0.3; this.flashColor = '255,40,70'; f.text(b.x, GROUND_Y - 120, `-${Math.round(e.dmg)} 풍선 구조!`, '#ff9fb2', 20, false, 1.2); break;
        case 'power': this.banner = { text: POWER_NAME[e.kind], sub: POWER_DESC[e.kind], t: 0, color: POWER_COLOR[e.kind] }; f.ring(b.x, b.y - 40, POWER_COLOR[e.kind], 60); break;
        case 'bonusStart': this.flash = 0.9; this.flashColor = '255,255,255'; this.banner = { text: '보너스 타임!', sub: s.bonusSuper ? '위기 탈출 슈퍼 보너스 — 더 길게!' : '점프를 누르고 있으면 날아올라요', t: 0, color: '#ffd166' }; break;
        case 'bonusEnd': this.flash = 0.8; this.flashColor = '255,255,255'; break;
        case 'speedUp': this.banner = { text: '속도 UP!', sub: `단계 ${e.tier + 1}`, t: 0, color: '#4cc9f0' }; break;
        case 'biome': { const bi = BIOME_BY_ID[e.id]; if (bi) { this.banner = { text: bi.name, sub: '새로운 구역', t: 0, color: '#fff' }; } break; }
        case 'skill': { const ch = CHAR_BY_ID[s.charId]; f.ring(b.x, b.y - 40, '#ffe066', 70); f.text(b.x, b.y - 110, ch ? ch.skillName + '!' : '스킬!', '#ffe066', 20); break; }
        case 'lowHp': this.redPulse = 1; break;
        case 'revive': this.flash = 0.8; this.flashColor = '255,230,120'; f.text(b.x, b.y - 110, '부활!', '#ffe066', 26); break;
        case 'relay': { const ch = CHAR_BY_ID[e.id]; this.flash = 0.7; this.flashColor = '255,255,255'; this.banner = { text: '이어달리기!', sub: ch ? `${ch.name} 출발!` : '', t: 0, color: '#80ed99' }; break; }
        case 'nearMiss': f.text(b.x + 10, b.y - 96, '아슬!', '#b8f2e6', 16, false, 0.6); break;
        case 'streak': f.text(this.viewW / 2, 0, '', '#fff'); this.banner = { text: `연속 ${e.n}회 무피격`, sub: `젤리 점수 ×${streakMul(s).toFixed(1)}`, t: 0, color: '#80ed99' }; break;
        case 'death': this.flash = 0.5; this.flashColor = '0,0,0'; break;
        case 'clear': this.banner = { text: '도착!', sub: '', t: 0, color: '#ffd166' }; break;
      }
    }
  }

  private onPickup(e: Extract<SimEvent, { t: 'pickup' }>, s: RunState): void {
    const f = this.fx;
    switch (e.type) {
      case 'jelly': case 'bonusJelly': if (!this.opts.lowFx) f.burst(e.x, e.y, 2, '#fff3b0', 90, 'dot', 3, 0); break;
      case 'big': f.burst(e.x, e.y, 7, '#ff8fab', 160, 'star', 6, 200); f.text(e.x, e.y - 20, `+${e.value}`, '#ffd6e0', 15, false, 0.6); break;
      case 'coin': f.burst(e.x, e.y, 4, '#ffd166', 120, 'star', 5, 200); break;
      case 'potion': case 'bigPotion': f.burst(e.x, e.y, 10, '#80ed99', 180, 'dot', 5, -200); f.text(s.body.x, s.body.y - 105, '체력 회복', '#80ed99', 18); break;
      case 'letter': f.burst(e.x, e.y, 12, LETTER_COLORS[e.letter ?? 0], 220, 'star', 7, 100); f.text(e.x, e.y - 30, BONUS_WORD[e.letter ?? 0], LETTER_COLORS[e.letter ?? 0], 30, false, 1); break;
      case 'power': break;
    }
  }

  // ------------------------------------------------------------------ frame
  draw(s: RunState, bodyX: number, bodyY: number, dt: number, ghost: GhostView | null = null): void {
    const c = this.c; this.time += dt;
    this.fx.reduceMotion = this.opts.reduceMotion; this.fx.quality = this.opts.lowFx ? 0.4 : 1;
    this.fx.update(dt);
    this.landT += dt; this.jumpT += dt; this.spinT += dt;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.8) this.banner = null; }
    if (Math.abs(bodyX - this.lastX) < 400) this.runPhase = (this.runPhase + Math.max(0, bodyX - this.lastX) / 64) % 1;
    this.lastX = bodyX;
    const skyTarget = s.bonusStage === 'sky' ? 1 : 0;
    this.skyMix += (skyTarget - this.skyMix) * Math.min(1, dt * 6);
    if (s.bonusStage === 'sky') this.skyMix = 1;

    const biome = BIOME_BY_ID[s.biome] ?? BIOMES[0];
    if (biome.id !== this.curBiome) { this.prevBiome = this.curBiome; this.curBiome = biome.id; this.biomeFade = this.prevBiome ? 0 : 1; }
    this.biomeFade = Math.min(1, this.biomeFade + dt / 1.5);

    this.camX = bodyX - this.playerX;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = true;

    // --- background ---
    const bd = this.backdrop; bd.lowFx = this.opts.lowFx; bd.reduceMotion = this.opts.reduceMotion;
    if (this.skyMix < 1) {
      if (this.biomeFade < 1 && this.prevBiome) { bd.drawBiome(c, BIOME_BY_ID[this.prevBiome], 1, this.camX, this.time); bd.drawBiome(c, biome, this.biomeFade, this.camX, this.time); }
      else bd.drawBiome(c, biome, 1, this.camX, this.time);
    }
    if (this.skyMix > 0) bd.drawBonusSky(c, this.skyMix, this.camX, this.time);

    // --- world ---
    c.save();
    c.translate(this.fx.shakeX * this.scale, this.fx.shakeY * this.scale);
    c.translate(-this.camX * this.scale, this.cssH - VIEW_H * this.scale);
    c.scale(this.scale, this.scale);
    const x0 = this.camX - 80, x1 = this.camX + this.viewW + 80;
    const sky = s.bonusStage === 'sky';
    this.backdrop.drawGround(c, s, biome, x0, x1, sky, this.time);
    this.drawSigns(s, x0, x1);
    if (this.pbDist > 50 && s.bonusStage === 'none') this.drawPbFlag(s, bodyX, x0, x1);
    this.drawHazards(s, biome, x0, x1);
    this.drawPickups(s, x0, x1);
    if (ghost) this.drawGhost(ghost);
    this.drawPlayer(s, bodyX, bodyY);
    this.fx.drawWorld(c);
    if (this.opts.showHitbox) this.drawHitboxes(s, x0, x1);
    c.restore();

    // --- screen overlays ---
    this.drawOverlays(s);
    this.drawHud(s);
    this.fx.drawScreen(c);
  }

  private drawPbFlag(s: RunState, bodyX: number, x0: number, x1: number): void {
    const fx = bodyX + (this.pbDist - s.dist) * TILE;
    if (fx < x0 || fx > x1) return;
    const c = this.c;
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(fx - 2, GROUND_Y - 170, 4, 170);
    c.fillStyle = '#ff5d8f'; c.beginPath(); c.moveTo(fx + 2, GROUND_Y - 168); c.lineTo(fx + 58, GROUND_Y - 152); c.lineTo(fx + 2, GROUND_Y - 136); c.closePath(); c.fill();
    c.font = '900 16px system-ui, "Noto Sans KR", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.lineWidth = 4; c.strokeStyle = 'rgba(20,10,35,0.8)'; c.strokeText(`최고 ${Math.floor(this.pbDist)}m`, fx + 8, GROUND_Y - 186); c.fillStyle = '#fff'; c.fillText(`최고 ${Math.floor(this.pbDist)}m`, fx + 8, GROUND_Y - 186);
  }

  private drawSigns(s: RunState, x0: number, x1: number): void {
    const c = this.c;
    for (const ch of s.level.chunks) {
      if (ch.x > x1 || ch.x + ch.width < x0) continue;
      const def = PARSED_BY_ID.get(ch.id)?.def; if (!def?.signs) continue;
      for (const sg of def.signs) {
        const x = ch.x + sg.col * TILE; const y = 150;
        c.font = '800 22px system-ui, "Noto Sans KR", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
        const w = c.measureText(sg.text).width + 28;
        c.fillStyle = 'rgba(20,14,40,0.78)'; rr(c, x, y - 22, w, 44, 12); c.fill();
        c.strokeStyle = '#ffd166'; c.lineWidth = 3; rr(c, x, y - 22, w, 44, 12); c.stroke();
        c.fillStyle = '#fff'; c.fillText(sg.text, x + 14, y + 1);
        c.fillStyle = 'rgba(20,14,40,0.6)'; c.fillRect(x + 16, y + 22, 5, GROUND_Y - y - 22);
      }
    }
  }

  private drawHazards(s: RunState, bi: BiomeDef, x0: number, x1: number): void {
    const c = this.c; const hc = this.opts.highContrast;
    const hz = s.level.hazards;
    for (let i = 0; i < hz.length; i++) {
      const h = hz[i];
      if (h.x1 < x0) continue; if (h.x0 > x1) break;
      if (h.broken) continue;                     // smashed by giant/dash (debris is FX)
      const col = hc ? '#ff1744' : bi.hazard[h.kind];
      if (h.kind === 'spike') drawSpike(c, h, col, hc);
      else if (h.kind === 'tall') drawTall(c, h, col, hc, this.time);
      else {
        // merge a run of touching hanging hazards (same bottom) into one wide slab
        let j = i; let right = h.x1;
        while (j + 1 < hz.length) { const n = hz[j + 1]; if (n.kind === 'hang' && !n.broken && Math.abs(n.x0 - right) < 1 && Math.abs(n.y1 - h.y1) < 1) { right = n.x1; j++; } else break; }
        drawHang(c, h.x0, right, h.y1, col, hc, this.time);
        i = j;
      }
    }
  }

  private drawPickups(s: RunState, x0: number, x1: number): void {
    const c = this.c; const t = this.time;
    for (const p of s.level.pickups) {
      if (p.taken || p.x < x0) continue; if (p.x > x1) break;
      const bob = this.opts.reduceMotion ? 0 : Math.sin(t * 4 + p.x * 0.05) * 2;
      drawPickup(c, p, p.x, p.y + bob, t);
    }
  }

  private drawGhost(g: GhostView): void {
    const c = this.c; const ch = CHAR_BY_ID[g.charId]; if (!ch) return;
    c.save(); c.translate(g.x, g.y); c.scale(g.scale, g.scale); c.globalAlpha = 0.32;
    drawCharacter(c, shapeOf(ch), { body: '#dfe7ff', shade: '#b8c4ff', accent: '#8d9bff', cheek: '#ffffff' }, { state: g.sliding ? 'slide' : g.onGround ? 'run' : 'jump', t: this.time, runPhase: this.runPhase, spin: 0, squash: 1, hurt: false, alpha: 1 });
    c.restore(); c.globalAlpha = 1;
  }

  private drawPlayer(s: RunState, x: number, y: number): void {
    const c = this.c; const b = s.body; const ch = CHAR_BY_ID[s.charId]; if (!ch) return;
    if (s.phase === 'dying' || s.phase === 'over') { this.drawDown(ch, x, y, s); return; }
    // shadow on the ground under the player (only when above solid ground)
    const shadowY = GROUND_Y;
    if (b.y <= GROUND_Y + 1) {
      const hgt = Math.max(0, GROUND_Y - b.y); const k = Math.max(0.25, 1 - hgt / 300);
      c.fillStyle = `rgba(0,0,0,${0.22 * k})`; c.beginPath(); c.ellipse(x, shadowY + 2, 24 * k * b.scale, 6 * k, 0, 0, Math.PI * 2); c.fill();
    }
    // dash trail / speed lines
    if (s.power.dash > 0 && !this.opts.reduceMotion) {
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const yy = y - 10 - i * 12 * b.scale; const len = 60 + ((i * 37 + this.time * 900) % 80); c.beginPath(); c.moveTo(x - 40 - len, yy); c.lineTo(x - 30, yy); c.stroke(); }
    }
    if (s.power.magnet > 0 || CHAR_BY_ID[s.charId]?.magnetR) {
      const r = s.power.magnet > 0 ? MAGNET_R : ch.magnetR;
      c.strokeStyle = `rgba(120,220,255,${s.power.magnet > 0 ? 0.35 + 0.15 * Math.sin(this.time * 8) : 0.12})`; c.lineWidth = 3; c.setLineDash([10, 10]);
      c.beginPath(); c.arc(x, y - 35 * b.scale, r, this.time, this.time + Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    const inv = s.iframes > 0 && s.bonusStage === 'none' && s.power.giant <= 0 && s.power.dash <= 0;
    const blinkOff = inv && Math.floor(this.time * 16) % 2 === 0;
    let state: Pose['state'] = 'run';
    if (s.bonusStage === 'sky') state = b.onGround ? 'run' : 'fly';
    else if (s.bonusStage === 'lift') state = 'fly';
    else if (b.sliding) state = 'slide';
    else if (!b.onGround) state = this.spinT < 0.32 ? 'air2' : b.vy < 0 ? 'jump' : 'fall';
    const squash = this.opts.reduceMotion ? 1 : this.landT < 0.12 ? 1 + 0.18 * (1 - this.landT / 0.12) : this.jumpT < 0.1 ? 1 - 0.12 * (1 - this.jumpT / 0.1) : 1;
    const pose: Pose = { state, t: this.time, runPhase: this.runPhase, spin: state === 'air2' && !this.opts.reduceMotion ? -this.spinT / 0.32 * Math.PI * 2 : 0, squash, hurt: s.hurtT < 0.4 && Math.floor(this.time * 20) % 2 === 0, alpha: blinkOff ? 0.35 : 1 };
    c.save(); c.translate(x, y); c.scale(b.scale, b.scale);
    if (s.power.giant > 0 && s.power.giant < 1 && Math.floor(this.time * 10) % 2 === 0) c.globalAlpha = 0.6;
    drawCharacter(c, shapeOf(ch), ch.palette, pose);
    c.restore();
    if (s.shield > 0) {
      c.strokeStyle = 'rgba(155,231,255,0.9)'; c.fillStyle = 'rgba(155,231,255,0.18)'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y - 38 * b.scale, 46 * b.scale, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    if (s.rescue > 0 && s.bonusStage === 'none') { // pit-rescue balloon
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 80); c.lineTo(x + 6, y - 130); c.stroke();
      c.fillStyle = '#ff5d8f'; c.beginPath(); c.ellipse(x + 6, y - 150, 18, 22, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(x, y - 158, 5, 7, -0.4, 0, Math.PI * 2); c.fill();
    }
  }

  private drawDown(ch: CharacterDef, x: number, y: number, s: RunState): void {
    const c = this.c; c.save(); c.translate(x, Math.min(y, GROUND_Y)); c.rotate(-Math.min(1, s.dyingT * 3) * 1.3);
    drawCharacter(c, shapeOf(ch), ch.palette, { state: 'dead', t: this.time, runPhase: 0, spin: 0, squash: 1, hurt: true, alpha: 1 }); c.restore();
  }

  private drawHitboxes(s: RunState, x0: number, x1: number): void {
    const c = this.c; c.lineWidth = 2;
    c.strokeStyle = '#00ff88'; const hb = hurtbox(s.body); c.strokeRect(hb.x0, hb.y0, hb.x1 - hb.x0, hb.y1 - hb.y0);
    c.strokeStyle = '#ff00aa'; for (const h of s.level.hazards) { if (h.x1 < x0 || h.x0 > x1 || h.broken) continue; c.strokeRect(h.x0, Math.max(h.y0, -200), h.x1 - h.x0, h.y1 - Math.max(h.y0, -200)); }
  }

  // ------------------------------------------------------------------ overlays & HUD (css px)
  private drawOverlays(s: RunState): void {
    const c = this.c; const W = this.cssW, H = this.cssH;
    const low = s.hp < s.maxHp * LOW_HP_FRAC && s.phase === 'run' && s.bonusStage === 'none';
    if (low) {
      const a = this.opts.reduceMotion ? 0.35 : 0.25 + 0.2 * Math.sin(this.time * 7);
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (this.flash > 0 && !(this.opts.reduceMotion && this.flashColor === '255,255,255')) { c.fillStyle = `rgba(${this.flashColor},${Math.min(0.7, this.flash)})`; c.fillRect(0, 0, W, H); }
    if (s.phase === 'countdown') {
      const n = Math.ceil(s.countdown / 0.5);
      bigText(c, W / 2, H * 0.42, n > 0 ? String(n) : '출발!', '#fff', Math.min(W, H) * 0.22);
    } else if (this.resumeCount > 0) {
      c.fillStyle = 'rgba(10,6,30,0.35)'; c.fillRect(0, 0, W, H);
      bigText(c, W / 2, H * 0.42, String(Math.ceil(this.resumeCount / 0.34)), '#fff', Math.min(W, H) * 0.2);
    }
    if (this.banner) {
      const b = this.banner; const k = b.t < 0.2 ? b.t / 0.2 : b.t > 1.5 ? (1.8 - b.t) / 0.3 : 1;
      c.globalAlpha = Math.max(0, k);
      const yy = H * 0.3;
      bigText(c, W / 2, yy, b.text, b.color, Math.min(44, Math.max(26, W * 0.055)));
      if (b.sub) bigText(c, W / 2, yy + Math.min(40, W * 0.045), b.sub, '#fff', Math.min(20, Math.max(13, W * 0.028)));
      c.globalAlpha = 1;
    }
  }

  private drawHud(s: RunState): void {
    const c = this.c; const W = this.cssW; const pad = 10; const u = Math.max(0.8, Math.min(1.25, W / 800));
    // HP bar (top-left): current, a trailing "damage ghost", tick marks every 20 HP
    const bw = Math.min(260, W * 0.36) * (this.portrait ? 1.25 : 1), bh = 16 * u, bx = pad + 34 * u, by = pad + 6;
    const pct = Math.max(0, s.hp / s.maxHp);
    this.hpGhost = pct > this.hpGhost ? pct : this.hpGhost + (pct - this.hpGhost) * 0.04;
    this.lastHpPct = pct;
    c.fillStyle = 'rgba(20,14,40,0.7)'; rr(c, bx - 3, by - 3, bw + 6, bh + 6, (bh + 6) / 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, bx, by, bw * this.hpGhost, bh, bh / 2); c.fill();
    const low = pct < LOW_HP_FRAC;
    const hg = c.createLinearGradient(bx, 0, bx + bw, 0);
    if (low) { hg.addColorStop(0, '#ff3355'); hg.addColorStop(1, '#ff7a8a'); } else { hg.addColorStop(0, '#ff8a3d'); hg.addColorStop(1, '#ffd166'); }
    c.fillStyle = hg; if (pct > 0) { rr(c, bx, by, Math.max(bh, bw * pct), bh, bh / 2); c.fill(); }
    c.fillStyle = 'rgba(20,14,40,0.35)'; for (let i = 1; i < 5; i++) c.fillRect(bx + bw * i / 5 - 1, by + 2, 2, bh - 4);
    // heart icon
    c.fillStyle = low && Math.floor(this.time * 4) % 2 ? '#ff8fa3' : '#ff4d6d';
    heart(c, pad + 14 * u, by + bh / 2, 13 * u);
    c.font = `800 ${Math.round(11 * u)}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    c.fillText(`${Math.ceil(Math.max(0, s.hp))}`, bx + 8, by + bh / 2 + 1);

    // letters (below HP)
    const ly = by + bh + 18 * u; const ls = 22 * u;
    for (let i = 0; i < BONUS_WORD.length; i++) {
      const lx = bx + i * (ls + 4);
      c.fillStyle = s.letters[i] ? LETTER_COLORS[i] : 'rgba(20,14,40,0.55)'; rr(c, lx, ly - ls / 2, ls, ls, 6); c.fill();
      c.font = `900 ${Math.round(13 * u)}px system-ui, "Noto Sans KR", sans-serif`; c.textAlign = 'center';
      c.fillStyle = s.letters[i] ? '#fff' : 'rgba(255,255,255,0.35)'; c.fillText(BONUS_WORD[i], lx + ls / 2, ly + 1);
    }
    // power / skill timers
    let px = bx + BONUS_WORD.length * (ls + 4) + 10;
    for (const k of ['giant', 'dash', 'magnet'] as PowerKind[]) {
      const v = s.power[k]; if (v <= 0) continue;
      ring(c, px + ls / 2, ly, ls / 2, v / POWER_DUR[k], POWER_COLOR[k]);
      c.font = `900 ${Math.round(12 * u)}px system-ui, sans-serif`; c.fillStyle = '#fff'; c.fillText(POWER_ICON[k], px + ls / 2, ly + 1);
      px += ls + 6;
    }
    const ch = CHAR_BY_ID[s.charId];
    if (ch && ch.skill.kind !== 'none') {
      const k = 1 - Math.max(0, s.skillT) / ch.skill.every;
      ring(c, px + ls / 2, ly, ls / 2, k, '#ffe066');
      c.font = `900 ${Math.round(11 * u)}px system-ui, sans-serif`; c.fillStyle = '#fff'; c.fillText('★', px + ls / 2, ly + 1);
      px += ls + 6;
    }
    if (s.shield > 0) { c.fillStyle = '#9be7ff'; c.font = `900 ${Math.round(14 * u)}px system-ui`; c.fillText('◎', px + ls / 2, ly + 1); }

    // score + distance (top-right, left of the pause button area)
    const rx = W - pad - 58;
    c.textAlign = 'right';
    bigText(c, rx, by + 8 * u, totalScore(s).toLocaleString('ko-KR'), '#fff', 22 * u, 'right');
    c.font = `700 ${Math.round(12 * u)}px system-ui, sans-serif`; c.fillStyle = 'rgba(255,255,255,0.9)';
    const mul = streakMul(s);
    c.fillText(`${Math.floor(s.dist)}m${mul > 1 ? ` · 연속 ×${mul.toFixed(1)}` : ''}`, rx, by + 30 * u);
    if (s.mode === 'stage' && s.level.stageLen > 0) {
      const f = Math.min(1, s.dist / s.level.stageLen); const w = Math.min(160, W * 0.22);
      c.fillStyle = 'rgba(20,14,40,0.55)'; rr(c, rx - w, by + 42 * u, w, 7, 3.5); c.fill();
      c.fillStyle = '#80ed99'; rr(c, rx - w, by + 42 * u, Math.max(7, w * f), 7, 3.5); c.fill();
    }
  }
}

// ---------------------------------------------------------------- helpers
export function shapeOf(ch: CharacterDef): Shape { return ch.shape; }

function bigText(c: CanvasRenderingContext2D, x: number, y: number, t: string, color: string, size: number, align: CanvasTextAlign = 'center'): void {
  c.font = `900 ${Math.round(size)}px system-ui, "Noto Sans KR", sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.18); c.strokeStyle = 'rgba(20,10,35,0.85)';
  c.strokeText(t, x, y); c.fillStyle = color; c.fillText(t, x, y);
}
function ring(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, col: string): void {
  c.fillStyle = 'rgba(20,14,40,0.6)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 3.5; c.beginPath(); c.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, k))); c.stroke();
}

