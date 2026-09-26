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
import { Fx, vrand, star } from './fx';
import { drawCharacter, rr, shade, type Pose, type Shape } from './characters';

export const MIN_VIEW_W = 840;          // portrait keeps ≥ 720 px (≥ 1.1 s at top speed) of look-ahead
export interface RenderOpts { reduceMotion: boolean; highContrast: boolean; lowFx: boolean; showHitbox: boolean }
export interface GhostView { x: number; y: number; sliding: boolean; onGround: boolean; charId: string; scale: number }

const LETTER_COLORS = ['#ff5d8f', '#ffb627', '#4cc9f0', '#80ed99', '#b388ff', '#ff8c42', '#f15bb5'];

export class Renderer {
  canvas: HTMLCanvasElement; c: CanvasRenderingContext2D;
  cssW = 1; cssH = 1; dpr = 1; scale = 1; viewW = 960; viewH = VIEW_H; playerX = 220; portrait = false;
  camX = 0;
  fx = new Fx();
  opts: RenderOpts = { reduceMotion: false, highContrast: false, lowFx: false, showHitbox: false };
  time = 0;
  private bgCache = new Map<string, HTMLCanvasElement[]>();
  private skyCache = new Map<string, HTMLCanvasElement>();
  private curBiome = ''; private prevBiome = ''; private biomeFade = 1;
  private landT = 9; private jumpT = 9; private spinT = 9; private lastHpPct = 1; private hpGhost = 1;
  private flash = 0; private flashColor = '255,255,255'; private redPulse = 0;
  private banner: { text: string; sub: string; t: number; color: string } | null = null;
  private runPhase = 0; private lastX = 0;
  private skyMix = 0;          // 0 = land, 1 = bonus sky
  pbDist = 0;                  // personal-best distance (m) → a flag is planted there

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
    this.bgCache.clear(); this.skyCache.clear();
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
    if (this.skyMix < 1) {
      if (this.biomeFade < 1 && this.prevBiome) { this.drawBackdrop(BIOME_BY_ID[this.prevBiome], 1); this.drawBackdrop(biome, this.biomeFade); }
      else this.drawBackdrop(biome, 1);
    }
    if (this.skyMix > 0) this.drawBonusSky(this.skyMix);

    // --- world ---
    c.save();
    c.translate(this.fx.shakeX * this.scale, this.fx.shakeY * this.scale);
    c.translate(-this.camX * this.scale, this.cssH - VIEW_H * this.scale);
    c.scale(this.scale, this.scale);
    const x0 = this.camX - 80, x1 = this.camX + this.viewW + 80;
    const sky = s.bonusStage === 'sky';
    this.drawGround(s, biome, x0, x1, sky);
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

  // ------------------------------------------------------------------ backdrop
  private drawBackdrop(bi: BiomeDef, alpha: number): void {
    const c = this.c; c.globalAlpha = alpha;
    c.drawImage(this.skyCanvas(bi), 0, 0, this.cssW, this.cssH);
    const layers = this.layerCanvases(bi);
    const factors = [0.08, 0.22, 0.5];
    if (!this.opts.lowFx || true) {
      for (let i = 0; i < layers.length; i++) {
        const L = layers[i]; const w = L.width / this.dpr;
        let off = -((this.camX * factors[i] * this.scale) % w); if (off > 0) off -= w;
        for (let x = off; x < this.cssW; x += w) c.drawImage(L, x, 0, w, this.cssH);
      }
    }
    c.globalAlpha = 1;
  }

  private skyCanvas(bi: BiomeDef): HTMLCanvasElement {
    let cv = this.skyCache.get(bi.id); if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = 4; cv.height = Math.max(2, Math.round(this.cssH));
    const g = cv.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, cv.height);
    gr.addColorStop(0, bi.sky[0]); gr.addColorStop(0.75, bi.sky[1]); gr.addColorStop(1, bi.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, 4, cv.height);
    this.skyCache.set(bi.id, cv); return cv;
  }

  /** three tiled parallax silhouettes per biome, rendered once per size */
  private layerCanvases(bi: BiomeDef): HTMLCanvasElement[] {
    const hit = this.bgCache.get(bi.id); if (hit) return hit;
    const out: HTMLCanvasElement[] = [];
    const W = Math.round(1200 * this.scale), H = Math.round(this.cssH);
    const cols = [bi.far, bi.mid, bi.near];
    for (let li = 0; li < 3; li++) {
      const cv = document.createElement('canvas'); cv.width = Math.round(W * this.dpr); cv.height = Math.round(H * this.dpr);
      const g = cv.getContext('2d')!; g.scale(this.dpr, this.dpr);
      const ground = this.sy(GROUND_Y);
      paintLayer(g, bi, li, W, ground, this.scale, cols[li]);
      out.push(cv);
    }
    this.bgCache.set(bi.id, out); return out;
  }

  private drawBonusSky(alpha: number): void {
    const c = this.c; c.globalAlpha = alpha;
    const g = c.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, '#5b4bff'); g.addColorStop(0.6, '#ff8fd8'); g.addColorStop(1, '#ffd6a5');
    c.fillStyle = g; c.fillRect(0, 0, this.cssW, this.cssH);
    // drifting clouds + stars
    for (let i = 0; i < 14; i++) {
      const w = 1400; const x = ((i * 173 - this.camX * 0.3 * (0.4 + (i % 3) * 0.2)) % w + w) % w * this.scale;
      const y = (40 + (i * 67) % 380) * this.scale + (this.cssH - VIEW_H * this.scale);
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(x, y, 60 * this.scale, 18 * this.scale, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 30; i++) { const x = ((i * 97 - this.camX * 0.05) % 1000 + 1000) % 1000 * this.scale; const y = ((i * 53) % 300) * this.scale; star(c, x, y, 2 + (i % 3), this.time + i); }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ world
  private drawGround(s: RunState, bi: BiomeDef, x0: number, x1: number, sky: boolean): void {
    const c = this.c; const bottom = VIEW_H + 20;
    const gFill = sky ? '#ffffff' : bi.ground; const gTop = sky ? '#ffe3f1' : bi.groundTop;
    for (const so of s.level.solids) {
      if (so.x1 < x0 || so.x0 > x1) continue;
      if (so.ground) {
        c.fillStyle = gFill; c.fillRect(so.x0, so.top, so.x1 - so.x0, bottom - so.top);
        // texture: offset rows of rounded bricks / cloud puffs
        c.fillStyle = sky ? 'rgba(255,200,230,0.35)' : shade(bi.ground, -0.12);
        const startX = Math.floor(so.x0 / TILE) * TILE;
        for (let x = startX; x < so.x1; x += TILE) {
          if (x + TILE < x0 || x > x1) continue;
          for (let r = 0; r < 3; r++) { const ox = (r % 2) * 20; const bx = x + ox + 4; if (bx + 30 > so.x1 || bx < so.x0) continue; rr(c, bx, so.top + 22 + r * 26, 30, 16, 6); c.fill(); }
        }
        c.fillStyle = gTop; rr(c, so.x0, so.top - 4, so.x1 - so.x0, 16, 6); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(so.x0 + 6, so.top - 1, so.x1 - so.x0 - 12, 3);
        // pit edges get a dark lip so gaps read instantly
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(so.x0, so.top + 10, 5, bottom - so.top); c.fillRect(so.x1 - 5, so.top + 10, 5, bottom - so.top);
      } else {
        const w = so.x1 - so.x0;
        c.fillStyle = 'rgba(0,0,0,0.18)'; rr(c, so.x0 + 4, so.top + 8, w, PLATFORM_THICK, 8); c.fill();
        c.fillStyle = sky ? '#ffffff' : bi.platform; rr(c, so.x0, so.top, w, PLATFORM_THICK, 8); c.fill();
        c.fillStyle = sky ? '#ffe3f1' : shade(bi.platform, 0.3); rr(c, so.x0 + 3, so.top + 2, w - 6, 5, 3); c.fill();
        c.strokeStyle = shade(sky ? '#ffd0e8' : bi.platform, -0.35); c.lineWidth = 2; rr(c, so.x0, so.top, w, PLATFORM_THICK, 8); c.stroke();
      }
    }
    // finish flag
    if (s.level.finishX !== Infinity && s.level.finishX > x0 - 200 && s.level.finishX < x1 + 200) {
      const fx = s.level.finishX + 5 * TILE;
      c.fillStyle = '#5b3a29'; c.fillRect(fx - 3, GROUND_Y - 150, 6, 150);
      const wave = Math.sin(this.time * 6) * 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#222'; c.fillRect(fx + 3 + i * 14, GROUND_Y - 148 + j * 12 + (i * wave) / 4, 14, 12); }
      c.font = '900 20px system-ui, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 4;
      c.strokeText('도착', fx + 30, GROUND_Y - 165); c.fillText('도착', fx + 30, GROUND_Y - 165);
    }
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
export const POWER_NAME: Record<PowerKind, string> = { giant: '거대화!', dash: '질주!', magnet: '자석!' };
export const POWER_DESC: Record<PowerKind, string> = { giant: '장애물을 부수며 달려요', dash: '빠르게, 무적으로', magnet: '젤리가 끌려와요' };
export const POWER_COLOR: Record<PowerKind, string> = { giant: '#ff8c42', dash: '#4cc9f0', magnet: '#b388ff' };
export const POWER_ICON: Record<PowerKind, string> = { giant: '巨', dash: '≫', magnet: 'U' };

export function shapeOf(ch: CharacterDef): Shape { return ((ch as any).shape as Shape) ?? SHAPE_BY_ID[ch.id] ?? 'disc'; }
const SHAPE_BY_ID: Record<string, Shape> = { hotteok: 'disc', bungeo: 'fish', injeolmi: 'square', kkochi: 'skewer', dalgona: 'star', kkultteok: 'ball', gyeranppang: 'oval' };

function bigText(c: CanvasRenderingContext2D, x: number, y: number, t: string, color: string, size: number, align: CanvasTextAlign = 'center'): void {
  c.font = `900 ${Math.round(size)}px system-ui, "Noto Sans KR", sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.18); c.strokeStyle = 'rgba(20,10,35,0.85)';
  c.strokeText(t, x, y); c.fillStyle = color; c.fillText(t, x, y);
}
function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath(); c.moveTo(x, y + s * 0.45);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.1, x - s * 0.45, y - s * 0.75, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.9, y - s * 0.1, x, y + s * 0.45); c.fill();
}
function ring(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, col: string): void {
  c.fillStyle = 'rgba(20,14,40,0.6)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 3.5; c.beginPath(); c.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, k))); c.stroke();
}

// Hazard art rules: (1) the drawn body always COVERS the hitbox (never "hit by nothing"); decorative tips may
// stick out past it (forgiving, never punishing); (2) every hazard has a dark outline + a reserved hot-pink rim
// (HAZARD_RIM is used for nothing else), so hazards read by shape + rim, not by hue alone.
export const HAZARD_RIM = '#ff2e63';
const OUTLINE = '#1c0f24';
function rim(c: CanvasRenderingContext2D, hc: boolean): void {
  c.lineJoin = 'round';
  c.strokeStyle = OUTLINE; c.lineWidth = hc ? 7 : 6; c.stroke();
  c.strokeStyle = hc ? '#ffffff' : HAZARD_RIM; c.lineWidth = hc ? 3.5 : 2.5; c.stroke();
}
function drawSpike(c: CanvasRenderingContext2D, h: Hazard, col: string, hc: boolean): void {
  const x0 = h.x0 - 2, x1 = h.x1 + 2, top = h.y0, bot = h.y1; const w = x1 - x0; const mid = (x0 + x1) / 2;
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(mid, bot + 1, w / 2 + 6, 4, 0, 0, Math.PI * 2); c.fill();
  // body: rounded block covering the whole hitbox, crowned by three spikes above it
  c.beginPath();
  c.moveTo(x0, bot); c.lineTo(x0, top + 8);
  c.lineTo(x0 + w * 0.17, top - 10); c.lineTo(x0 + w * 0.33, top + 4);
  c.lineTo(mid, top - 16); c.lineTo(x1 - w * 0.33, top + 4);
  c.lineTo(x1 - w * 0.17, top - 10); c.lineTo(x1, top + 8); c.lineTo(x1, bot); c.closePath();
  c.fillStyle = col; c.fill(); rim(c, hc);
  c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, x0 + 5, top + 10, 5, bot - top - 16, 2.5); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x0 + 2, bot - 8, w - 4, 6);
}
function drawTall(c: CanvasRenderingContext2D, h: Hazard, col: string, hc: boolean, t: number): void {
  const x0 = h.x0 - 2, x1 = h.x1 + 2, top = h.y0, bot = h.y1; const w = x1 - x0; const mid = (x0 + x1) / 2;
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(mid, bot + 1, w / 2 + 8, 4, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(x0, bot); c.lineTo(x0, top + 6);
  for (let i = 0; i <= 4; i++) c.lineTo(x0 + (w * i) / 4, i % 2 ? top - 2 : top - 14 + Math.sin(t * 3 + i) * 1.5);
  c.lineTo(x1, top + 6); c.lineTo(x1, bot); c.closePath();
  c.fillStyle = col; c.fill(); rim(c, hc);
  c.save(); c.beginPath(); c.rect(x0 + 2, top + 8, w - 4, bot - top - 10); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.22)'; for (let y = top; y < bot; y += 28) { c.beginPath(); c.moveTo(x0, y + 16); c.lineTo(x1, y); c.lineTo(x1, y + 10); c.lineTo(x0, y + 26); c.closePath(); c.fill(); }
  c.restore();
  // "taller than you" cue: a double-chevron badge near the top
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mid - 7, top + 26); c.lineTo(mid, top + 18); c.lineTo(mid + 7, top + 26); c.lineTo(mid + 7, top + 31); c.lineTo(mid, top + 23); c.lineTo(mid - 7, top + 31); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(mid - 7, top + 38); c.lineTo(mid, top + 30); c.lineTo(mid + 7, top + 38); c.lineTo(mid + 7, top + 43); c.lineTo(mid, top + 35); c.lineTo(mid - 7, top + 43); c.closePath(); c.fill();
}
function drawHang(c: CanvasRenderingContext2D, x0: number, x1: number, bot: number, col: string, hc: boolean, t: number): void {
  // one solid slab hanging from above the screen: every px of the hitbox is visibly solid
  const w = x1 - x0; const topY = -420;
  c.beginPath(); c.moveTo(x0, topY); c.lineTo(x0, bot - 8);
  const teeth = Math.max(2, Math.round(w / 14)); for (let i = 0; i < teeth; i++) { const a = x0 + (w * i) / teeth, b = x0 + (w * (i + 1)) / teeth; c.lineTo((a + b) / 2, bot + 7); c.lineTo(b, bot - 8); }
  c.lineTo(x1, topY); c.closePath();
  c.fillStyle = col; c.fill(); rim(c, hc);
  // painted band + stitched seams so it reads as one hanging banner/board
  c.save(); c.beginPath(); c.rect(x0 + 3, topY, w - 6, bot - 10 - topY); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(x0, bot - 58, w, 22);
  c.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = bot - 96; y > topY; y -= 46) c.fillRect(x0, y, w, 5);
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x0 + 5, topY, 4, bot - 16 - topY);
  c.restore();
  const n = Math.max(1, Math.round(w / 40));
  for (let i = 0; i < n; i++) {
    const glow = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7 + x0 * 0.02);
    c.fillStyle = `rgba(255,230,120,${0.55 + 0.35 * glow})`; c.beginPath(); c.arc(x0 + (w * (i + 0.5)) / n, bot - 47, 5, 0, Math.PI * 2); c.fill();
  }
}

function drawPickup(c: CanvasRenderingContext2D, p: Pickup, x: number, y: number, t: number): void {
  switch (p.type) {
    case 'jelly': case 'bonusJelly': {
      const col = p.type === 'bonusJelly' ? '#ff9ad5' : '#ffd23f';
      c.fillStyle = col; c.beginPath(); c.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(x - 3, y - 4, 2.5, 3.5, -0.4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'big': {
      // a round "bear" jelly with ears
      c.fillStyle = '#ff5d8f';
      c.beginPath(); c.arc(x - 9, y - 11, 6, 0, Math.PI * 2); c.arc(x + 9, y - 11, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x, y, 15, 14, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b3244f'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 5, y - 2, 2, 0, Math.PI * 2); c.arc(x + 5, y - 2, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(x - 7, y - 7, 3, 4, -0.5, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'coin': {
      const w = Math.abs(Math.cos(t * 4 + x * 0.02)) * 12 + 2;
      c.fillStyle = '#ffc300'; c.beginPath(); c.ellipse(x, y, w, 13, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#b07d00'; c.lineWidth = 2; c.stroke();
      if (w > 7) { c.fillStyle = '#fff3b0'; c.font = '900 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₩', x, y + 1); }
      break;
    }
    case 'potion': case 'bigPotion': {
      const s = p.type === 'bigPotion' ? 1.35 : 1;
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = 'rgba(128,237,153,0.35)'; c.beginPath(); c.arc(0, 2, 20 + Math.sin(t * 5) * 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8fff0'; rr(c, -5, -18, 10, 8, 2); c.fill();
      c.fillStyle = '#2ec4b6'; c.beginPath(); c.arc(0, 2, 13, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#137a70'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ff4d6d'; heart(c, 0, 3, 13);
      c.restore();
      break;
    }
    case 'power': {
      const col = POWER_COLOR[p.power!];
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 18 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#fff'; c.font = '900 18px system-ui, "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(POWER_ICON[p.power!], x, y + 1);
      break;
    }
    case 'letter': {
      const col = LETTER_COLORS[p.letter ?? 0];
      c.fillStyle = col; rr(c, x - 18, y - 18, 36, 36, 10); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; rr(c, x - 18, y - 18, 36, 36, 10); c.stroke();
      c.fillStyle = '#fff'; c.font = '900 22px system-ui, "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(BONUS_WORD[p.letter ?? 0], x, y + 1);
      break;
    }
  }
}

/** Parallax silhouettes. li 0 = far, 1 = mid, 2 = near. Drawn in css px on a tile W wide. */
function paintLayer(g: CanvasRenderingContext2D, bi: BiomeDef, li: number, W: number, groundY: number, sc: number, col: string): void {
  let sd = 1000 + li * 77 + bi.id.length * 13; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  const base = groundY - (li === 0 ? 150 : li === 1 ? 70 : 10) * sc;
  g.fillStyle = col;
  const style = (bi as any).style ?? 'hills';
  if (li === 0) {
    // far: soft hills / mountains / skyline
    g.beginPath(); g.moveTo(0, groundY);
    const peaks = 6; for (let i = 0; i <= peaks; i++) { const x = (W * i) / peaks; const h = (style === 'snow' ? 190 : 110) * sc * (0.6 + r() * 0.5); g.lineTo(x - W / peaks / 2, base - h * 0.3); g.lineTo(x, base - h); }
    g.lineTo(W, groundY); g.closePath(); g.fill();
    if (style === 'snow') { g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i <= peaks; i++) { const x = (W * i) / peaks; g.beginPath(); g.arc(x, base - 150 * sc, 16 * sc, 0, Math.PI * 2); g.fill(); } }
    return;
  }
  // mid / near: buildings, stalls, trees depending on style
  g.fillRect(0, base, W, groundY - base + 400);
  let x = 0;
  while (x < W) {
    const w = (li === 1 ? 70 : 50) * sc * (0.7 + r() * 0.8); const h = (li === 1 ? 120 : 70) * sc * (0.5 + r() * 0.8);
    if (style === 'market' || style === 'hills') {
      g.fillStyle = col; g.fillRect(x, base - h, w, h + 2);
      if (li === 2) { g.fillStyle = shade(col, 0.25); g.beginPath(); g.moveTo(x - 6 * sc, base - h + 2); g.lineTo(x + w / 2, base - h - 18 * sc); g.lineTo(x + w + 6 * sc, base - h + 2); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,214,120,0.55)'; for (let k = 0; k < 3; k++) if (r() > 0.4) g.fillRect(x + w * 0.2 + k * w * 0.25, base - h * 0.7, 5 * sc, 7 * sc);
      if (li === 1 && r() > 0.5) { g.fillStyle = 'rgba(255,120,90,0.8)'; g.beginPath(); g.arc(x + w / 2, base - h - 10 * sc, 6 * sc, 0, Math.PI * 2); g.fill(); }
    } else if (style === 'hanok') {
      g.fillStyle = col; g.fillRect(x + 6 * sc, base - h * 0.6, w - 12 * sc, h * 0.6 + 2);
      g.beginPath(); g.moveTo(x - 8 * sc, base - h * 0.6); g.quadraticCurveTo(x + w / 2, base - h * 0.95, x + w + 8 * sc, base - h * 0.6); g.lineTo(x + w + 14 * sc, base - h * 0.66); g.lineTo(x - 14 * sc, base - h * 0.66); g.closePath(); g.fill();
    } else if (style === 'city') {
      g.fillStyle = col; g.fillRect(x, base - h * 1.4, w * 0.9, h * 1.4 + 2);
      g.fillStyle = 'rgba(255,240,180,0.5)'; for (let yy = base - h * 1.3; yy < base - 8; yy += 14 * sc) for (let xx = x + 6 * sc; xx < x + w * 0.8; xx += 12 * sc) if (r() > 0.5) g.fillRect(xx, yy, 4 * sc, 6 * sc);
    } else if (style === 'snow') {
      g.fillStyle = col; g.beginPath(); g.moveTo(x, base + 2); g.lineTo(x + w / 2, base - h * 1.2); g.lineTo(x + w, base + 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x + w * 0.35, base - h * 0.8); g.lineTo(x + w / 2, base - h * 1.2); g.lineTo(x + w * 0.65, base - h * 0.8); g.closePath(); g.fill();
    }
    x += w + (li === 1 ? 20 : 30) * sc * r();
  }
  if (li === 2 && style === 'market') { // string lights
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath();
    for (let xx = 0; xx <= W; xx += 20) g.lineTo(xx, base - 95 * sc + Math.sin(xx / W * Math.PI * 4) * 12 * sc); g.stroke();
    for (let xx = 10; xx < W; xx += 40) { g.fillStyle = ['#ffd166', '#ff5d8f', '#4cc9f0'][(xx / 40 | 0) % 3]; g.beginPath(); g.arc(xx, base - 95 * sc + Math.sin(xx / W * Math.PI * 4) * 12 * sc + 4, 3.5 * sc, 0, Math.PI * 2); g.fill(); }
  }
  void vrand; void STAND_H; void SLIDE_H;
}
