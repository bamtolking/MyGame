// Canvas 2D renderer: camera, draw order, runner / ghost / companion, overlays and the in-canvas HUD.
// It draws exactly the sim's geometry (hazard art always covers its hitbox, pickups sit inside their box) and
// never feeds anything back into the sim. Visual randomness uses fxRng / Math.random only.
//
// Layout (GDD §3.2–3.3, §10.2):
//  - the world is a 960×540 logical view scaled by min(w/960, h/540) — the same 740 px look-ahead in every
//    orientation. Landscape letterboxes left/right (the world keeps drawing there, dimmed); portrait puts the
//    16:9 world on top and the HUD in a band below it (`bandH`), with the thumb pads under that (DOM).
//  - landscape HUD: ⏸ (DOM) top-left, 따끈함 bar next to it, 잔치 lanterns + power rings under it, score + 흐름
//    flame ring + progress + stage chips top-centre; the RIGHT 25 % of the play band stays clear.
// Draw order (GDD §11.4-5): parallax → ground → speed lines → particles → pickups → HAZARDS → ghost / companion /
// runner → floating text (≤ 60 % over hazards) → overlays → HUD.
import { VIEW_W, VIEW_H, GROUND_Y, TILE, PLAYER_SCREEN_X } from '../data/physics';
import { LOW_HP_FRAC, BONUS_WORD, POWER_DUR, MAGNET_R, STREAK_STEP, STREAK_BONUS } from '../data/tuning';
import { BIOME_BY_ID, BIOMES, type BiomeDef } from '../data/biomes';
import { CHAR_BY_ID, type CharacterDef } from '../data/characters';
import { PARSED_BY_ID } from '../sim/level';
import { hurtbox } from '../sim/body';
import { totalScore, flowLevel, jellyPct } from '../sim/run';
import type { RunState, SimEvent, Hazard, PowerKind } from '../sim/types';
import { Fx, TrailFx, star, vrand, type Box, type TrailId } from './fx';
import { drawCharacter, rr, type Pose, type Shape, type HatId, type Palette } from './characters';
import { drawCompanion } from './companions';
import { drawSpike, drawTall, drawHang, setHazardOutlineScale } from './hazards';
import { drawPickup, LETTER_COLORS } from './pickups';
import { Backdrop } from './backdrops';
export { POWER_NAME, POWER_DESC, POWER_COLOR, POWER_ICON } from './pickups';

export interface RenderOpts { reduceMotion: boolean; highContrast: boolean; lowFx: boolean; showHitbox: boolean; shake: number; uiScale: number }
export interface GhostView { x: number; y: number; sliding: boolean; onGround: boolean; charId: string; scale: number }
export interface Insets { l: number; r: number; t: number; b: number }
export interface HudInfo {
  pbDist: number;          // m — personal best of this mode (endless / daily), 0 = none yet
  stageGoalPct: number;    // ★2 star-candy target (stage only)
  pouchesBefore: number;   // pouches banked in earlier completed runs of this stage (bitmask)
  pauseW: number;          // css px the DOM pause button needs (landscape: top-left, portrait: band right)
}
export interface HintView { text: string; sub: string; zone: 'jump' | 'slide' | null; t: number }

/** GDD names for the power-ups (screen copy) */
export const POWER_LABEL: Record<PowerKind, string> = { giant: '왕만두', dash: '불꽃 질주', magnet: '엿가락 자석' };
const POWER_SUB: Record<PowerKind, string> = { giant: '크게! 부수면서 달려요', dash: '빠르게, 무적으로!', magnet: '별사탕이 끌려와요' };
const POWER_HUE: Record<PowerKind, string> = { giant: '#ff9f43', dash: '#ff5d5d', magnet: '#c792ff' };
const POWER_GLYPH: Record<PowerKind, string> = { giant: '만', dash: '≫', magnet: '엿' };
const FONT = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const SPRITE_H = 84;                  // drawn runner height (logical px)
const RING_H = 96;                    // skill ring height: clears the tallest tops (어묵이 steam, 꼬치 stick)
const FROST = '190,225,255';

export class Renderer {
  canvas: HTMLCanvasElement; c: CanvasRenderingContext2D;
  cssW = 1; cssH = 1; dpr = 1; scale = 1; viewW = VIEW_W; viewH = VIEW_H; portrait = false;
  bandH = 0; worldH = 1;               // portrait HUD band (css px) · world area height (css px)
  offL = 0;                            // logical px of letterbox on each side
  playerX = PLAYER_SCREEN_X;
  camX = 0; camY = 0; private camV = 0;
  insets: Insets = { l: 0, r: 0, t: 0, b: 0 };
  fx = new Fx();
  opts: RenderOpts = { reduceMotion: false, highContrast: false, lowFx: false, showHitbox: false, shake: 1, uiScale: 1 };
  hud: HudInfo = { pbDist: 0, stageGoalPct: 0, pouchesBefore: 0, pauseW: 52 };
  /** cosmetics per character id (the app fills these from equippedFor at run start; relay partner included) */
  hats: Record<string, HatId | null> = {};
  palettes: Record<string, Palette | null> = {};
  trails: Record<string, TrailId | null> = {};
  private trail = new TrailFx();
  time = 0;
  backdrop = new Backdrop();
  resumeCount = 0;                     // s left of the post-pause 3-2-1 (the app holds the sim)
  hint: HintView | null = null;        // tutorial verb hint after a rewind
  /** @deprecated set hud.pbDist */
  pbDist = 0;
  private curBiome = ''; private prevBiome = ''; private biomeFade = 1;
  private landT = 9; private jumpT = 9; private spinT = 9; private landSq = 1; private airVy = 0; private slideT = 9; private dustT = 0;
  private hpGhost = 1;
  private trauma = 0;
  private flash = 0; private flashColor = '255,255,255'; private flashTimes: number[] = [];
  private hitV = 0; private frostK = 0; private dim = 0; private goT = 0; private lastPhase = '';
  private speedWarn = 0;
  private banner: { text: string; sub: string; t: number; color: string } | null = null;
  private runPhase = 0; private lastX = 0; private bodyV = 0;
  private skyMix = 0;
  private comp = { x: 0, y: 0, init: false };
  private hazBoxes: Box[] = [];
  private dt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false })!;
  }

  /** cssW×cssH canvas; `bandH` css px at the bottom are the portrait HUD band (0 in landscape). */
  resize(cssW: number, cssH: number, o: { dprCap?: number; bandH?: number; insets?: Insets } = {}): void {
    this.cssW = Math.max(1, cssW); this.cssH = Math.max(1, cssH);
    this.bandH = Math.max(0, Math.min(this.cssH - 40, o.bandH ?? 0));
    this.worldH = this.cssH - this.bandH;
    if (o.insets) this.insets = o.insets;
    this.dpr = Math.max(1, Math.min(o.dprCap ?? 2, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(this.cssW * this.dpr); this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = this.cssW + 'px'; this.canvas.style.height = this.cssH + 'px';
    this.scale = Math.min(this.cssW / VIEW_W, this.worldH / VIEW_H);
    this.viewW = this.cssW / this.scale; this.viewH = this.worldH / this.scale;
    this.offL = (this.viewW - VIEW_W) / 2;
    this.portrait = this.bandH > 0;
    this.playerX = PLAYER_SCREEN_X + this.offL;
    this.backdrop.resize(this.cssW, this.worldH, this.dpr, this.scale);
    setHazardOutlineScale(this.portrait ? 1.5 : 1);     // portrait render assist: hazard outline ×1.5
    const bi = BIOME_BY_ID[this.curBiome]; if (bi) this.backdrop.prepare(bi);
  }

  /** world → css px */
  sx(x: number): number { return (x - this.camX) * this.scale; }
  sy(y: number): number { return this.worldH - (VIEW_H - y) * this.scale + this.camY * this.scale; }
  /** css px of the play band's right-25 % line (HUD must stay left of it) */
  get clearLine(): number { return (this.offL + VIEW_W * 0.75) * this.scale; }

  private addTrauma(k: number): void { this.trauma = Math.min(1, this.trauma + k); }
  private doFlash(alpha: number, color: string): void {
    if (this.opts.reduceMotion) return;
    this.flashTimes = this.flashTimes.filter(t => this.time - t < 1);
    if (this.flashTimes.length >= 3) return;          // full-screen flashes ≤ 3 per second
    this.flashTimes.push(this.time);
    this.flash = Math.min(0.5, alpha); this.flashColor = color;
  }

  // ------------------------------------------------------------------ events → FX
  consume(events: SimEvent[], s: RunState): void {
    const f = this.fx; const b = s.body;
    for (const e of events) {
      switch (e.t) {
        case 'jump':
          if (e.n === 2) { this.spinT = 0; this.jumpT = 0; f.burst(b.x - 6, b.y - 4, 6, 'rgba(255,255,255,0.9)', 120, 'dot', 4, 200); }
          else { this.jumpT = 0; f.burst(b.x - 10, b.y, 5, 'rgba(230,210,180,0.9)', 90, 'dot', 4, 300); }
          break;
        case 'land':
          this.landT = 0; this.landSq = 1 / (1 - 0.2 * Math.min(1, Math.max(0, this.airVy) / 1800));
          if (shapeOf(CHAR_BY_ID[s.charId]) === 'disc') this.landSq = Math.min(this.landSq, 1.08);   // keep 호떡이's art over its hurtbox
          f.burst(b.x - 8, b.y, 4, 'rgba(230,210,180,0.8)', 80, 'dot', 3, 300); break;
        case 'slide': this.slideT = 0; break;
        case 'fastFall': f.burst(b.x, b.y - 60, 4, 'rgba(255,255,255,0.7)', 90, 'dot', 3, -300); break;
        case 'pickup': this.onPickup(e, s); break;
        case 'line': f.text(e.x, e.y, `한 줄 완성! +${e.value}`, '#fff3a3', 20, false, 1.1); f.ring(e.x, e.y + 30, '#fff3a3', 50); break;
        case 'drop': f.burst(e.x, e.y, 8, '#ffcf5a', 120, 'star', 5, 300); break;
        case 'hit':
          if (e.shielded) { f.ring(b.x, b.y - 40, '#9be7ff', 46); f.text(b.x, b.y - 100, '방울막!', '#9be7ff', 20); }
          else { f.burst(e.x, e.y, 14, '#cfe6ff', 320, 'chunk', 7); this.addTrauma(0.6); this.hitV = 0.15; f.text(b.x, b.y - 100, e.dmg ? `쿵! -${Math.round(e.dmg)}` : '쿵!', '#bfe3ff', 22); }
          break;
        case 'smash': f.burst(e.x, e.y, 16, BIOME_BY_ID[s.biome]?.hazard.spike ?? '#fff', 420, 'chunk', 8, 1200); this.addTrauma(0.25); f.text(e.x, e.y - 30, '뚝딱!', '#ffd166', 22); break;
        case 'fall': this.addTrauma(0.8); this.hitV = 0.15; f.text(b.x, GROUND_Y - 120, e.dmg ? `통통 구출! -${Math.round(e.dmg)}` : '통통 구출!', '#ffd6a0', 20, false, 1.2); break;
        case 'power': this.banner = { text: POWER_LABEL[e.kind] + '!', sub: POWER_SUB[e.kind], t: 0, color: POWER_HUE[e.kind] }; f.ring(b.x, b.y - 40, POWER_HUE[e.kind], 60); break;
        case 'bonusStart': this.doFlash(0.45, '255,250,230'); this.banner = { text: e.super ? '왕보름달 잔치!' : '보름달 잔치!', sub: e.super ? '더 길게, 끝나면 따끈함도 채워요' : '점프를 누르고 있으면 날아올라요', t: 0, color: '#ffd166' }; break;
        case 'bonusEnd': this.doFlash(0.35, '255,250,230'); break;
        case 'speedUpSoon': this.speedWarn = 1.2; break;
        case 'speedUp': this.banner = { text: '빨라져요!', sub: `속도 ${e.tier + 1}단계`, t: 0, color: '#8fd8ff' }; break;
        case 'biome': { const bi = BIOME_BY_ID[e.id]; if (bi) this.banner = { text: bi.name, sub: '새 풍경', t: 0, color: '#fff' }; break; }
        case 'skill': { const ch = CHAR_BY_ID[s.charId]; f.ring(b.x, b.y - 40, '#ffe066', 70); f.text(b.x, b.y - 110, ch ? ch.skillName + '!' : '스킬!', '#ffe066', 20); break; }
        case 'revive': this.doFlash(0.4, '255,230,150'); f.text(b.x, b.y - 110, '한 번 더!', '#ffe066', 26); break;
        case 'relay': { const ch = CHAR_BY_ID[e.id]; this.doFlash(0.4, '255,255,255'); this.banner = { text: '이어달리기!', sub: ch ? `${ch.name} 출발!` : '', t: 0, color: '#80ed99' }; break; }
        case 'nearMiss': f.text(b.x + 10, b.y - 96, '아슬아슬!', '#b8f2e6', 16, false, 0.6); break;
        case 'streak': { const lv = flowLevel(s); this.banner = { text: `흐름 ${lv}단계`, sub: `별사탕 점수 +${Math.round(lv * STREAK_BONUS * 100)}%`, t: 0, color: '#ffb347' }; break; }
        case 'rewind': this.fx.clear(); this.trail.reset(); this.trauma = 0; break;
        case 'death': break;
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
      case 'potion': case 'bigPotion': case 'miniPotion': f.burst(e.x, e.y, 10, '#ffc46b', 180, 'dot', 5, -200); f.text(s.body.x, s.body.y - 105, e.type === 'miniPotion' ? '꿀물 한 방울' : '따끈따끈!', '#ffd08a', 18); break;
      case 'moonCake': f.burst(e.x, e.y, 18, '#fff1b8', 260, 'star', 8, 100); f.text(e.x, e.y - 30, `보름달 떡! +${e.value}`, '#fff1b8', 24, false, 1.2); break;
      case 'pouch': f.burst(e.x, e.y, 16, '#ffd700', 240, 'star', 7, 150); f.text(e.x, e.y - 30, '황금 복주머니!', '#ffe27a', 22, false, 1.2); break;
      case 'letter': f.burst(e.x, e.y, 12, LETTER_COLORS[e.letter ?? 0], 220, 'star', 7, 100); f.text(e.x, e.y - 30, BONUS_WORD[e.letter ?? 0], LETTER_COLORS[e.letter ?? 0], 30, false, 1); break;
      case 'power': break;
    }
  }

  // ------------------------------------------------------------------ frame
  draw(s: RunState, bodyX: number, bodyY: number, dt: number, ghost: GhostView | null = null): void {
    const c = this.c; dt = Math.max(0, Math.min(0.1, dt)); this.time += dt; this.dt = dt;
    if (this.pbDist && !this.hud.pbDist) this.hud.pbDist = this.pbDist;
    this.fx.reduceMotion = this.opts.reduceMotion; this.fx.quality = this.opts.lowFx ? 0.4 : 1;
    this.fx.update(dt);
    this.landT += dt; this.jumpT += dt; this.spinT += dt; this.slideT += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.hitV = Math.max(0, this.hitV - dt);
    this.goT = Math.max(0, this.goT - dt);
    this.speedWarn = Math.max(0, this.speedWarn - dt);
    if (this.lastPhase === 'countdown' && s.phase === 'run') this.goT = 0.5;
    this.lastPhase = s.phase;
    this.dim = s.phase === 'dying' || s.phase === 'over' ? Math.min(0.28, this.dim + dt * 0.5) : 0;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.8) this.banner = null; }
    if (this.hint) this.hint.t += dt;
    if (!s.body.onGround) this.airVy = s.body.vy;
    const vNow = dt > 0 && Math.abs(bodyX - this.lastX) < 400 ? Math.max(0, bodyX - this.lastX) / dt : 0;
    this.bodyV += (Math.min(vNow, s.speed * 1.5 + 50) - this.bodyV) * Math.min(1, dt * 14);   // actual run speed (0 while the app holds the sim)
    if (Math.abs(bodyX - this.lastX) < 400) this.runPhase = (this.runPhase + Math.max(0, bodyX - this.lastX) / 64) % 1;
    this.lastX = bodyX;
    this.trail.id = this.trails[s.charId] ?? null; this.trail.sizeK = this.portrait ? 1.35 : 1;
    this.trail.update(this.fx, dt, bodyX, bodyY, s.body.scale, s.body.sliding, this.bodyV, s.phase === 'run' && this.resumeCount <= 0, this.opts);
    if (s.body.sliding && s.body.onGround && s.phase === 'run' && !this.opts.lowFx) { this.dustT -= dt; if (this.dustT <= 0) { this.dustT = 0.05; this.fx.burst(bodyX - 22, bodyY - 2, 1, 'rgba(230,210,180,0.7)', 60, 'dot', 3, -60); } }
    const skyTarget = s.bonusStage === 'sky' ? 1 : 0;
    this.skyMix += (skyTarget - this.skyMix) * Math.min(1, dt * 6);
    if (s.bonusStage === 'sky') this.skyMix = 1;

    const biome = BIOME_BY_ID[s.biome] ?? BIOMES[0];
    if (biome.id !== this.curBiome) { this.prevBiome = this.curBiome; this.curBiome = biome.id; this.biomeFade = this.prevBiome ? 0 : 1; this.backdrop.prepare(biome); }   // all 4 layers at once: no pop-in
    this.biomeFade = Math.min(1, this.biomeFade + dt / 1.0);

    // ---- camera: fixed x anchor; upward-only vertical follow (critically damped, ω = 9, ≤ 160 px)
    this.camX = bodyX - this.playerX;
    const spriteTop = bodyY - (s.body.sliding ? 40 : SPRITE_H) * s.body.scale;
    const naturalTop = VIEW_H - this.viewH;
    const target = s.phase === 'dying' || s.phase === 'over' ? this.camY : Math.max(0, Math.min(160, naturalTop + 40 - spriteTop));
    if (this.opts.reduceMotion) { this.camY += (target - this.camY) * Math.min(1, dt * 6); this.camV = 0; }
    else { const w = 9; for (let k = 0; k < 2; k++) { const h = dt / 2; this.camV += (w * w * (target - this.camY) - 2 * w * this.camV) * h; this.camY += this.camV * h; } }
    if (this.camY < 0) { this.camY = 0; this.camV = 0; }

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = true;
    c.fillStyle = this.skyMix >= 1 ? '#1d1650' : biome.sky[0]; c.fillRect(0, 0, this.cssW, this.cssH);
    c.save();
    if (this.portrait) { c.beginPath(); c.rect(0, 0, this.cssW, this.worldH); c.clip(); }

    // ---- background (follows the vertical camera so the parallax base never parts from the ground)
    const bd = this.backdrop; bd.lowFx = this.opts.lowFx; bd.reduceMotion = this.opts.reduceMotion;
    c.save(); c.translate(0, this.camY * this.scale);
    if (this.skyMix < 1) {
      if (this.biomeFade < 1 && this.prevBiome && BIOME_BY_ID[this.prevBiome]) { bd.drawBiome(c, BIOME_BY_ID[this.prevBiome], 1, this.camX, this.time); bd.drawBiome(c, biome, this.biomeFade, this.camX, this.time); }
      else bd.drawBiome(c, biome, 1, this.camX, this.time);
    }
    if (this.skyMix > 0) bd.drawBonusSky(c, this.skyMix, this.camX, this.time);
    c.restore();

    // ---- world
    const sh = this.shakeOffset();
    c.save();
    c.translate(sh[0], sh[1]);
    c.translate(-this.camX * this.scale, this.worldH - VIEW_H * this.scale + this.camY * this.scale);
    c.scale(this.scale, this.scale);
    const x0 = this.camX - 80, x1 = this.camX + this.viewW + 80;
    const sky = s.bonusStage === 'sky';
    bd.drawGround(c, s, biome, x0, x1, sky, this.time);
    this.drawSigns(s, x0, x1);
    if (this.hud.pbDist > 50 && s.bonusStage === 'none' && s.mode !== 'stage') this.drawPbFlag(s, bodyX, x0, x1);
    this.drawSpeedLines(s);
    this.trail.drawRibbon(c);
    this.fx.drawParticles(c);
    this.drawPickups(s, x0, x1);
    this.drawHazards(s, biome, x0, x1);
    if (ghost) this.drawGhost(ghost);
    this.drawCompanionFollow(s, bodyX, bodyY, dt);
    this.drawPlayer(s, bodyX, bodyY);
    this.fx.drawPopups(c, this.hazBoxes);
    if (this.opts.showHitbox) this.drawHitboxes(s, x0, x1);
    c.restore();

    // ---- world-area overlays
    this.drawOverlays(s);
    c.restore();   // portrait clip
    this.drawHud(s);
    this.fx.drawScreen(c);
  }

  private shakeOffset(): [number, number] {
    const k = this.trauma * this.trauma * 10 * Math.max(0, Math.min(1, this.opts.shake)) * (this.opts.reduceMotion ? 0 : 1) * Math.min(1, this.scale / 0.72);
    if (k < 0.05) return [0, 0];
    return [(vrand() * 2 - 1) * k, (vrand() * 2 - 1) * k];
  }

  private drawPbFlag(s: RunState, bodyX: number, x0: number, x1: number): void {
    const fx = bodyX + (this.hud.pbDist - s.dist) * TILE;
    if (fx < x0 || fx > x1) return;
    const c = this.c;
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(fx - 2, GROUND_Y - 170, 4, 170);
    c.fillStyle = '#ff5d8f'; c.beginPath(); c.moveTo(fx + 2, GROUND_Y - 168); c.lineTo(fx + 58, GROUND_Y - 152); c.lineTo(fx + 2, GROUND_Y - 136); c.closePath(); c.fill();
    const t = `최고 ${Math.floor(this.hud.pbDist).toLocaleString('ko-KR')}m`;
    c.font = `900 16px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.lineWidth = 4; c.strokeStyle = 'rgba(20,10,35,0.8)'; c.strokeText(t, fx + 8, GROUND_Y - 186); c.fillStyle = '#fff'; c.fillText(t, fx + 8, GROUND_Y - 186);
  }

  private drawSigns(s: RunState, x0: number, x1: number): void {
    const c = this.c;
    for (const ch of s.level.chunks) {
      if (ch.x > x1 || ch.x + ch.width < x0) continue;
      const def = PARSED_BY_ID.get(ch.id)?.def; if (!def?.signs) continue;
      for (const sg of def.signs) {
        const x = ch.x + sg.col * TILE; const y = 150;
        c.font = `800 22px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
        const w = c.measureText(sg.text).width + 28;
        c.fillStyle = 'rgba(20,14,40,0.78)'; rr(c, x, y - 22, w, 44, 12); c.fill();
        c.strokeStyle = '#ffd166'; c.lineWidth = 3; rr(c, x, y - 22, w, 44, 12); c.stroke();
        c.fillStyle = '#fff'; c.fillText(sg.text, x + 14, y + 1);
        c.fillStyle = 'rgba(20,14,40,0.6)'; c.fillRect(x + 16, y + 22, 5, GROUND_Y - y - 22);
      }
    }
  }

  /** speed lines: only at tier ≥ 4, during 불꽃 질주, or for ~1 s before a speed-up (warning) */
  private drawSpeedLines(s: RunState): void {
    if (this.opts.reduceMotion || s.bonusStage !== 'none' || s.phase !== 'run') return;
    const dash = s.power.dash > 0;
    const k = dash ? 1 : this.speedWarn > 0 ? Math.min(1, this.speedWarn) : s.tier >= 4 ? 0.45 : 0;
    if (k <= 0) return;
    const c = this.c; const n = this.opts.lowFx ? 5 : dash ? 12 : 8; const span = this.viewW + 600;
    c.strokeStyle = `rgba(255,255,255,${0.22 * k})`; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const y = 70 + ((i * 131) % 300);
      const len = 90 + ((i * 53) % 140);
      const x = this.camX + span - ((i * 377 + this.time * (dash ? 2600 : 1700)) % span) - 200;
      c.moveTo(x, y); c.lineTo(x + len, y);
    }
    c.stroke(); c.lineCap = 'butt';
  }

  private drawHazards(s: RunState, bi: BiomeDef, x0: number, x1: number): void {
    const c = this.c; const hc = this.opts.highContrast;
    const hz = s.level.hazards; const boxes = this.hazBoxes; boxes.length = 0;
    const draw = (h: Hazard, right: number) => {
      const hb = BIOME_BY_ID[h.biome] ?? bi;      // a hazard keeps its own biome's skin AND colour across a crossfade
      const col = hc ? '#ff1744' : hb.hazard[h.kind];
      const st = hb.style;
      if (h.kind === 'spike') drawSpike(c, h, col, hc, st);
      else if (h.kind === 'tall') drawTall(c, h, col, hc, this.time, st);
      else drawHang(c, h.x0, right, h.y1, col, hc, this.time, st);
    };
    for (let i = 0; i < hz.length; i++) {
      const h = hz[i];
      if (h.x1 < x0) continue; if (h.x0 > x1) break;
      if (h.broken) continue;                     // smashed by 왕만두 / 불꽃 질주 (debris is FX)
      let right = h.x1; let j = i;
      if (h.kind === 'hang') {                    // merge touching hanging hazards (same bottom) into one slab
        while (j + 1 < hz.length) { const n = hz[j + 1]; if (n.kind === 'hang' && !n.broken && Math.abs(n.x0 - right) < 1 && Math.abs(n.y1 - h.y1) < 1) { right = n.x1; j++; } else break; }
      }
      boxes.push({ x0: h.x0 - 4, x1: right + 4, y0: Math.max(h.y0, -400) - 16, y1: h.y1 + 8 });
      draw(h, right);
      i = j;
    }
  }

  private drawPickups(s: RunState, x0: number, x1: number): void {
    const c = this.c; const t = this.time; const big = this.portrait ? 1.15 : 1;
    for (const p of s.level.pickups) {
      if (p.taken || p.x < x0) continue; if (p.x > x1) break;
      const bob = this.opts.reduceMotion ? 0 : Math.sin(t * 4 + p.x * 0.05) * 2;
      if (big !== 1 && (p.type === 'jelly' || p.type === 'big' || p.type === 'bonusJelly')) {
        c.save(); c.translate(p.x, p.y + bob); c.scale(big, big); drawPickup(c, p, 0, 0, t); c.restore();
      } else drawPickup(c, p, p.x, p.y + bob, t);
    }
  }

  private drawGhost(g: GhostView): void {
    const c = this.c; const ch = CHAR_BY_ID[g.charId]; if (!ch) return;
    c.save(); c.translate(g.x, g.y); c.scale(g.scale, g.scale); c.globalAlpha = 0.35;
    drawCharacter(c, shapeOf(ch), { body: '#dfe7ff', shade: '#b8c4ff', accent: '#8d9bff', cheek: '#ffffff' }, { state: g.sliding ? 'slide' : g.onGround ? 'run' : 'jump', t: this.time, runPhase: this.runPhase, spin: 0, squash: 1, hurt: false, alpha: 1 });
    c.restore(); c.globalAlpha = 1;
  }

  /** 짝꿍 floats behind and above the runner, lazily following (lerp) */
  private drawCompanionFollow(s: RunState, x: number, y: number, dt: number): void {
    if (!s.companionId || s.phase === 'over') return;
    const tx = x - 46, ty = y - SPRITE_H * s.body.scale - 22 + (s.body.sliding ? 40 : 0);
    const cp = this.comp;
    if (!cp.init || Math.abs(cp.x - tx) > 400) { cp.x = tx; cp.y = ty; cp.init = true; }
    const k = 1 - Math.exp(-dt * 7);
    cp.x += (tx - cp.x) * k; cp.y += (ty - cp.y) * k;
    try { drawCompanion(this.c, s.companionId, this.time, cp.x, cp.y); } catch { /* art not ready */ }   // the art hovers by itself
  }

  private drawPlayer(s: RunState, x: number, y: number): void {
    const c = this.c; const b = s.body; const ch = CHAR_BY_ID[s.charId]; if (!ch) return;
    if (s.phase === 'dying' || s.phase === 'over') { this.drawDown(ch, x, y, s); return; }
    if (b.y <= GROUND_Y + 1) {
      const hgt = Math.max(0, GROUND_Y - b.y); const k = Math.max(0.25, 1 - hgt / 300);
      c.fillStyle = `rgba(0,0,0,${0.22 * k})`; c.beginPath(); c.ellipse(x, GROUND_Y + 2, 24 * k * b.scale, 6 * k, 0, 0, Math.PI * 2); c.fill();
    }
    if (s.power.dash > 0 && !this.opts.reduceMotion) {
      c.strokeStyle = 'rgba(255,190,120,0.7)'; c.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const yy = y - 10 - i * 12 * b.scale; const len = 60 + ((i * 37 + this.time * 900) % 80); c.beginPath(); c.moveTo(x - 40 - len, yy); c.lineTo(x - 30, yy); c.stroke(); }
    }
    if (s.power.magnet > 0 || ch.magnetR) {
      const r = s.power.magnet > 0 ? MAGNET_R : ch.magnetR;
      c.strokeStyle = `rgba(199,146,255,${s.power.magnet > 0 ? 0.35 + (this.opts.reduceMotion ? 0 : 0.15 * Math.sin(this.time * 8)) : 0.12})`; c.lineWidth = 3; c.setLineDash([10, 10]);
      c.beginPath(); c.arc(x, y - 35 * b.scale, r, this.time, this.time + Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    const inv = s.iframes > 0 && s.bonusStage === 'none' && s.power.giant <= 0 && s.power.dash <= 0;
    const blinkOff = inv && Math.floor(this.time * 20) % 2 === 0;      // 10 Hz blink, render only
    let state: Pose['state'] = 'run';
    if (s.bonusStage === 'sky') state = b.onGround ? 'run' : 'fly';
    else if (s.bonusStage === 'lift') state = 'fly';
    else if (b.sliding) state = 'slide';
    else if (!b.onGround) state = this.spinT < 0.25 ? 'air2' : b.vy < 0 ? 'jump' : 'fall';
    let squash = 1;
    if (!this.opts.reduceMotion) {
      if (this.landT < 0.1) squash = 1 + (this.landSq - 1) * (1 - this.landT / 0.1);
      else if (this.spinT < 0.25) squash = 0.9 + 0.1 * (this.spinT / 0.25);
      else if (this.jumpT < 0.12) squash = 0.85 + 0.15 * (this.jumpT / 0.12);
    }
    const pose: Pose = { state, t: this.time, runPhase: this.runPhase, spin: state === 'air2' && !this.opts.reduceMotion ? -this.spinT / 0.25 * Math.PI * 2 : 0, squash, hurt: s.hurtT < 0.4 && Math.floor(this.time * 20) % 2 === 0, alpha: blinkOff ? 0.35 : 1 };
    c.save(); c.translate(x, y); c.scale(b.scale, b.scale);
    if (s.power.giant > 0 && s.power.giant < 1 && Math.floor(this.time * 10) % 2 === 0) c.globalAlpha = 0.6;
    drawCharacter(c, shapeOf(ch), this.palettes[ch.id] ?? ch.palette, pose, this.hats[ch.id] ?? null);
    c.restore(); c.globalAlpha = 1;
    if (s.shield > 0) {
      c.strokeStyle = 'rgba(155,231,255,0.9)'; c.fillStyle = 'rgba(155,231,255,0.18)'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y - 38 * b.scale, 46 * b.scale, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    if (s.rescue > 0 && s.bonusStage === 'none') {   // pit-rescue: a little steam cloud lifts you
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x - 16 + i * 16, y + 6 + (i % 2) * 3, 11, 0, Math.PI * 2); c.fill(); }
    }
    this.drawSkillRing(s, ch, x, y);
  }

  /** skill cooldown ring above the runner's head */
  private drawSkillRing(s: RunState, ch: CharacterDef, x: number, y: number): void {
    if (ch.skill.kind === 'none' || s.bonusStage !== 'none') return;
    const c = this.c; const b = s.body;
    const every = ch.skill.every || 1;
    const k = s.skillActive > 0 || (ch.skill.kind === 'shield' && s.shield > 0) ? 1 : Math.max(0, Math.min(1, 1 - s.skillT / every));
    const cx = x, cy = y - (b.sliding ? 44 : RING_H) * b.scale - 16, r = 9;
    c.lineWidth = 4; c.strokeStyle = 'rgba(20,12,36,0.55)'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = k >= 1 ? '#fff3a3' : '#ffd166'; c.lineWidth = 3.2;
    c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke();
    if (k >= 1) { c.fillStyle = '#fff3a3'; star(c, cx, cy, 5, 0); }
  }

  private drawDown(ch: CharacterDef, x: number, y: number, s: RunState): void {
    const c = this.c; c.save(); c.translate(x, Math.min(y, GROUND_Y)); c.rotate(-Math.min(1, s.dyingT * 3) * 1.3);
    drawCharacter(c, shapeOf(ch), this.palettes[ch.id] ?? ch.palette, { state: 'dead', t: this.time, runPhase: 0, spin: 0, squash: 1, hurt: false, alpha: 1 }, this.hats[ch.id] ?? null); c.restore();
  }

  private drawHitboxes(s: RunState, x0: number, x1: number): void {
    const c = this.c; c.lineWidth = 2;
    c.strokeStyle = '#00ff88'; const hb = hurtbox(s.body); c.strokeRect(hb.x0, hb.y0, hb.x1 - hb.x0, hb.y1 - hb.y0);
    c.strokeStyle = '#ff00aa'; for (const h of s.level.hazards) { if (h.x1 < x0 || h.x0 > x1 || h.broken) continue; c.strokeRect(h.x0, Math.max(h.y0, -200), h.x1 - h.x0, h.y1 - Math.max(h.y0, -200)); }
  }

  // ------------------------------------------------------------------ overlays (css px, world area)
  private drawOverlays(s: RunState): void {
    const c = this.c; const W = this.cssW, H = this.worldH;
    // letterbox: the world keeps drawing there, dimmed, so the 960-wide view reads as the stage
    const lb = this.offL * this.scale;
    if (lb > 6) {
      c.fillStyle = 'rgba(12,8,28,0.42)'; c.fillRect(0, 0, lb, H); c.fillRect(W - lb, 0, lb, H);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(lb - 1, 0, 1, H); c.fillRect(W - lb, 0, 1, H);
    }
    // low warmth: frost creeps in from the edges (≤ 0.35 alpha, slow pulse — never red, never flashing)
    const low = s.hp < s.maxHp * LOW_HP_FRAC && s.phase === 'run' && s.bonusStage === 'none';
    this.frostK += ((low ? 1 : 0) - this.frostK) * Math.min(1, this.dt * 1.5);
    if (this.frostK > 0.02) {
      const pulse = this.opts.reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(this.time * Math.PI);   // 0.5 Hz
      const a = Math.min(0.35, 0.35 * this.frostK * pulse);
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      g.addColorStop(0, `rgba(${FROST},0)`); g.addColorStop(1, `rgba(${FROST},${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    // hit: a short cold vignette (150 ms, ≤ 0.35)
    if (this.hitV > 0) {
      const a = 0.35 * (this.hitV / 0.15);
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      g.addColorStop(0, 'rgba(150,190,255,0)'); g.addColorStop(1, `rgba(150,190,255,${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(${this.flashColor},${Math.min(0.5, this.flash)})`; c.fillRect(0, 0, W, H); }
    if (this.dim > 0) { c.fillStyle = `rgba(10,6,30,${this.dim})`; c.fillRect(0, 0, W, H); }
    const big = Math.min(W * 0.18, H * 0.34);
    if (s.phase === 'countdown') {
      const n = Math.ceil(s.countdown / 0.5);
      bigText(c, W / 2, H * 0.42, String(Math.max(1, n)), '#fff', big);
    } else if (this.resumeCount > 0) {
      c.fillStyle = 'rgba(10,6,30,0.35)'; c.fillRect(0, 0, W, H);
      bigText(c, W / 2, H * 0.42, String(Math.max(1, Math.ceil(this.resumeCount / 0.5))), '#fff', big);
      bigText(c, W / 2, H * 0.42 + big * 0.62, '준비하세요', '#fff', Math.max(13, big * 0.18));
    } else if (this.goT > 0) {
      c.globalAlpha = Math.min(1, this.goT / 0.2); bigText(c, W / 2, H * 0.42, '출발!', '#ffd166', big * 0.7); c.globalAlpha = 1;
    }
    if (this.hint) this.drawHint(this.hint);
    else if (this.banner) {
      const b = this.banner; const k = b.t < 0.2 ? b.t / 0.2 : b.t > 1.5 ? (1.8 - b.t) / 0.3 : 1;
      c.globalAlpha = Math.max(0, k);
      const yy = H * 0.26; const fs = Math.min(40, Math.max(20, W * 0.045));
      bigText(c, Math.min(W / 2, this.clearLine - W * 0.2), yy, b.text, b.color, fs);
      if (b.sub) bigText(c, Math.min(W / 2, this.clearLine - W * 0.2), yy + fs * 0.95, b.sub, '#fff', Math.max(12, fs * 0.45));
      c.globalAlpha = 1;
    }
  }

  private drawHint(h: HintView): void {
    const c = this.c; const W = this.cssW, H = this.worldH;
    const k = Math.min(1, h.t / 0.2); const pulse = this.opts.reduceMotion ? 1 : 1 + 0.06 * Math.sin(h.t * 8);
    c.globalAlpha = k;
    const fs = Math.min(40, Math.max(20, W * 0.05)) * pulse;
    const cx = W / 2, cy = H * 0.5;           // below the chunk signs (y 150), above the ground band
    c.font = `900 ${Math.round(fs)}px ${FONT}`; const tw = c.measureText(h.text).width;
    const pw = Math.min(W - 16, tw + 40), ph = fs * (h.sub ? 2.05 : 1.35);
    c.fillStyle = 'rgba(20,12,40,0.55)'; rr(c, cx - pw / 2, cy - fs * 0.72, pw, ph, 14); c.fill();
    bigText(c, cx, cy, h.text, '#ffe27a', fs);
    if (h.sub) bigText(c, cx, cy + fs * 0.88, h.sub, '#fff', Math.max(12, fs * 0.42));
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ HUD
  private drawHud(s: RunState): void {
    if (this.portrait) this.hudPortrait(s); else this.hudLandscape(s);
  }

  private hudLandscape(s: RunState): void {
    const c = this.c; const W = this.cssW, H = this.cssH;
    const u = Math.max(0.78, Math.min(1.2, Math.min(W / 860, H / 420))) * this.opts.uiScale;
    const L = this.insets.l + this.hud.pauseW + 8, T = this.insets.t + 10;
    const barW = Math.min(250 * u, Math.max(120, this.clearLine * 0.36 - L));
    const bh = 15 * u;
    this.warmthBar(s, L + 18 * u, T + 6 * u, barW, bh, u);
    const ls = 21 * u; const ly = T + 6 * u + bh + 8 * u;
    this.lanterns(s, L + 4 * u, ly, ls);
    let px = L + 4 * u + BONUS_WORD.length * (ls + 4 * u) + 8 * u;
    px = this.powerRings(s, px, ly + ls * 0.55, ls * 0.55, u);
    if (s.shield > 0) { c.fillStyle = '#9be7ff'; c.font = `900 ${Math.round(14 * u)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('◎', px + ls / 2, ly + ls * 0.55); }
    // centre: flame ring + score, then progress + stage chips
    const cx = Math.min(W / 2, this.clearLine - 130 * u);
    this.scoreBlock(s, cx, T + 14 * u, u);
    const pw = Math.min(220 * u, W * 0.24);
    this.progressBar(s, cx - pw / 2, T + 36 * u, pw, 6 * u, u);
    if (s.mode === 'stage') this.stageChips(s, cx, T + 54 * u, u, 'center');
  }

  private hudPortrait(s: RunState): void {
    const c = this.c; const W = this.cssW; const top = this.worldH; const bh = this.bandH;
    const u = Math.max(0.85, Math.min(1.15, W / 390)) * this.opts.uiScale;
    const g = c.createLinearGradient(0, top, 0, top + bh); g.addColorStop(0, '#231a4e'); g.addColorStop(1, '#1b1440');
    c.fillStyle = g; c.fillRect(0, top, W, bh);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, top, W, 1);
    const L = this.insets.l + 12, R = W - this.insets.r - this.hud.pauseW - 8;
    // row 1: 따끈함 (full width) · row 2: lanterns + score/흐름 · row 3: progress + stage chips — rows scale with the band
    const barH = bh * 0.19; const y1 = top + bh * 0.09;
    this.warmthBar(s, L + 18 * u, y1, Math.max(60, R - L - 18 * u), barH, u);
    const ls = Math.min(19 * u, bh * 0.27); const cy2 = top + bh * 0.52;
    this.lanterns(s, L, cy2 - ls * 0.52, ls);
    const lw = BONUS_WORD.length * ls * 1.2;
    this.scoreBlock(s, L + lw + (R - L - lw) * 0.5, cy2, Math.min(u * 0.95, bh / 70), false, R);
    const cy3 = top + bh * 0.85; const k = Math.min(u * 0.85, bh / 76);
    let pr = R;
    if (s.mode === 'stage') pr = R - this.stageChips(s, R, cy3, k, 'right') - 8;
    this.progressBar(s, L, cy3 - 2 * u, Math.max(40, pr - L), 4 * u, k, true, s.mode !== 'stage' ? R : 0);
    // power rings float in the world area's top-left corner (small, away from the runner's column)
    this.powerRings(s, 10 + this.insets.l, 16 * u, 10 * u, u);
  }

  private warmthBar(s: RunState, bx: number, by: number, bw: number, bh: number, u: number): void {
    const c = this.c;
    const pct = Math.max(0, Math.min(1, s.hp / s.maxHp));
    this.hpGhost = pct > this.hpGhost ? pct : this.hpGhost + (pct - this.hpGhost) * 0.04;
    const low = pct < LOW_HP_FRAC;
    const pulse = low && s.phase === 'run' && !this.opts.reduceMotion ? 0.5 + 0.5 * Math.sin(this.time * Math.PI * 1.6) : 0;   // 0.8 Hz
    c.fillStyle = 'rgba(20,14,40,0.72)'; rr(c, bx - 3, by - 3, bw + 6, bh + 6, (bh + 6) / 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.28)'; if (this.hpGhost > 0.01) { rr(c, bx, by, Math.max(bh, bw * this.hpGhost), bh, bh / 2); c.fill(); }
    const hg = c.createLinearGradient(bx, 0, bx + bw, 0);
    if (low) { hg.addColorStop(0, '#9fd3ff'); hg.addColorStop(1, '#e8f6ff'); } else { hg.addColorStop(0, '#ff8a3d'); hg.addColorStop(1, '#ffd166'); }
    c.fillStyle = hg; if (pct > 0) { rr(c, bx, by, Math.max(bh, bw * pct), bh, bh / 2); c.fill(); }
    if (low && pulse > 0) { c.strokeStyle = `rgba(${FROST},${0.35 + 0.4 * pulse})`; c.lineWidth = 2; rr(c, bx - 2, by - 2, bw + 4, bh + 4, (bh + 4) / 2); c.stroke(); }
    c.fillStyle = 'rgba(20,14,40,0.3)'; for (let i = 1; i < 5; i++) c.fillRect(bx + bw * i / 5 - 1, by + 2, 2, bh - 4);
    c.font = `800 ${Math.round(10.5 * u)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const lab = `따끈함 ${Math.ceil(Math.max(0, s.hp))}`;
    c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,36,0.85)'; c.strokeText(lab, bx + 7 * u, by + bh / 2 + 0.5);
    c.fillStyle = '#fff'; c.fillText(lab, bx + 7 * u, by + bh / 2 + 0.5);
    // icon: steam when warm, a frost crystal when cold (slow 0.8 Hz pulse)
    const ix = bx - 11 * u, iy = by + bh / 2, ir = 9 * u * (1 + 0.12 * pulse);
    c.fillStyle = low ? '#dff2ff' : '#ffb35c'; c.beginPath(); c.arc(ix, iy, ir, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(20,14,40,0.8)'; c.lineWidth = 2; c.stroke();
    if (low) snowflake(c, ix, iy, ir * 0.7, '#3d7fb8'); else steam(c, ix, iy, ir * 0.7, this.opts.reduceMotion ? 0 : this.time);
  }

  private lanterns(s: RunState, x: number, y: number, ls: number): void {
    const c = this.c;
    for (let i = 0; i < BONUS_WORD.length; i++) {
      const lx = x + i * (ls + ls * 0.2); const lit = s.letters[i];
      const col = LETTER_COLORS[i];
      c.fillStyle = lit ? col : 'rgba(20,14,40,0.62)';
      c.strokeStyle = lit ? '#fff6e0' : 'rgba(255,255,255,0.28)'; c.lineWidth = 1.5;
      rr(c, lx, y, ls, ls * 1.05, ls * 0.34); c.fill(); c.stroke();
      c.fillStyle = lit ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
      c.fillRect(lx + ls * 0.3, y - ls * 0.12, ls * 0.4, ls * 0.12); c.fillRect(lx + ls * 0.3, y + ls * 1.05, ls * 0.4, ls * 0.1);
      c.font = `900 ${Math.round(ls * 0.58)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.4)'; c.fillText(BONUS_WORD[i], lx + ls / 2, y + ls * 0.55);
    }
  }

  private powerRings(s: RunState, px: number, cy: number, r: number, u: number): number {
    const c = this.c;
    for (const k of ['giant', 'dash', 'magnet'] as PowerKind[]) {
      const v = s.power[k]; if (v <= 0) continue;
      ring(c, px + r, cy, r, v / POWER_DUR[k], POWER_HUE[k]);
      c.font = `900 ${Math.round(r * 1.05)}px ${FONT}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(POWER_GLYPH[k], px + r, cy + 1);
      px += r * 2 + 6 * u;
    }
    return px;
  }

  private scoreBlock(s: RunState, cx: number, cy: number, u: number, flowBelow = false, maxX = Infinity): void {
    const c = this.c; const sc = totalScore(s).toLocaleString('ko-KR');
    const fs = 22 * u; c.font = `900 ${Math.round(fs)}px ${FONT}`;
    const tw = c.measureText(sc).width;
    const fr = 12 * u; const fx = cx - tw / 2 - fr - 6 * u;
    this.flameRing(s, fx, cy, fr);
    bigText(c, cx, cy, sc, '#fff', fs);
    const lv = flowLevel(s);
    if (lv > 0) {
      const t = `흐름 +${Math.round(lv * STREAK_BONUS * 100)}%`;
      c.font = `800 ${Math.round(10 * u)}px ${FONT}`; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,36,0.85)'; c.fillStyle = '#ffcf8a';
      if (flowBelow) { c.textAlign = 'center'; c.strokeText(t, fx, cy + fr + 8 * u); c.fillText(t, fx, cy + fr + 8 * u); }
      else if (cx + tw / 2 + 6 * u + c.measureText(t).width <= maxX) { c.textAlign = 'left'; c.strokeText(t, cx + tw / 2 + 6 * u, cy + 1); c.fillText(t, cx + tw / 2 + 6 * u, cy + 1); }
    }
  }

  /** 흐름: a ring filling toward the next level around a flame that grows per level */
  private flameRing(s: RunState, x: number, y: number, r: number): void {
    const c = this.c; const lv = flowLevel(s); const max = 5;
    const k = lv >= max ? 1 : (s.streak % STREAK_STEP) / STREAK_STEP;
    c.fillStyle = 'rgba(20,14,40,0.7)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = lv >= max ? '#ffe27a' : '#ff9f43'; c.lineWidth = Math.max(2.5, r * 0.22);
    c.beginPath(); c.arc(x, y, r - c.lineWidth / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke();
    const f = 0.35 + 0.13 * lv; const flick = this.opts.reduceMotion ? 0 : Math.sin(this.time * 14) * 0.05;
    const fh = r * f * 1.5 * (1 + flick), fw = r * f * 0.9;
    c.fillStyle = lv > 0 ? '#ff7b2e' : 'rgba(255,255,255,0.35)';
    c.beginPath(); c.moveTo(x, y - fh); c.quadraticCurveTo(x + fw * 1.3, y - fh * 0.1, x + fw * 0.6, y + fh * 0.55); c.quadraticCurveTo(x, y + fh * 0.8, x - fw * 0.6, y + fh * 0.55); c.quadraticCurveTo(x - fw * 1.3, y - fh * 0.1, x, y - fh); c.fill();
    if (lv > 0) { c.fillStyle = '#ffe27a'; c.beginPath(); c.ellipse(x, y + fh * 0.25, fw * 0.45, fh * 0.4, 0, 0, Math.PI * 2); c.fill(); }
  }

  /** stage: distance to the finish · endless/daily: distance vs personal best (with a PB tick) */
  private progressBar(s: RunState, x: number, y: number, w: number, h: number, u: number, thin = false, labelRight = 0): void {
    const c = this.c;
    let f = 0; let label = ''; let mark = -1;
    if (s.mode === 'stage' && s.level.stageLen > 0) { f = Math.min(1, s.dist / s.level.stageLen); label = `${Math.floor(f * 100)}%`; }
    else if (this.hud.pbDist > 0 && !s.trial) { const span = Math.max(this.hud.pbDist * 1.15, s.dist + 1); f = s.dist / span; mark = this.hud.pbDist / span; label = s.dist >= this.hud.pbDist ? '최고 기록 넘었어요!' : `최고까지 ${Math.ceil(this.hud.pbDist - s.dist).toLocaleString('ko-KR')}m`; }
    else if (s.mode === 'tutorial' || s.trial) return;
    else { label = `${Math.floor(s.dist).toLocaleString('ko-KR')}m`; f = 0; }
    if (thin && label && labelRight) {
      c.font = `700 ${Math.round(10 * u)}px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillText(label, labelRight, y + h / 2); w = Math.max(30, labelRight - c.measureText(label).width - 8 * u - x); label = '';
    }
    c.fillStyle = 'rgba(20,14,40,0.6)'; rr(c, x, y, w, h, h / 2); c.fill();
    if (f > 0) { c.fillStyle = s.mode === 'stage' ? '#80ed99' : '#8fd8ff'; rr(c, x, y, Math.max(h, w * f), h, h / 2); c.fill(); }
    if (mark >= 0) { c.fillStyle = '#ff5d8f'; c.fillRect(x + w * mark - 1.5, y - 3, 3, h + 6); }
    if (s.mode === 'stage') { c.fillStyle = '#fff'; c.fillRect(x + w - 2, y - 3, 2, h + 6); }
    if (!thin && label) { c.font = `700 ${Math.round(10 * u)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,255,255,0.88)'; c.fillText(label, x + w + 6 * u, y + h / 2); }

  }

  /** stage chips: 「별사탕 72% / 80%」 and the 3 golden pouches */
  private stageChips(s: RunState, x: number, y: number, u: number, align: 'center' | 'right'): number {
    const c = this.c; const goal = this.hud.stageGoalPct;
    const pct = jellyPct(s); const ok = goal > 0 && pct >= goal;
    const txt = goal > 0 ? `별사탕 ${pct}% / ${goal}%` : `별사탕 ${pct}%`;
    c.font = `800 ${Math.round(10.5 * u)}px ${FONT}`;
    const tw = c.measureText(txt).width; const ps = 9 * u; const pw = 3 * (ps * 2 + 3 * u);
    const total = tw + 14 * u + 8 * u + pw;
    let x0 = align === 'center' ? x - total / 2 : x - total;
    const h = 17 * u;
    c.fillStyle = ok ? 'rgba(46,160,90,0.85)' : 'rgba(20,14,40,0.66)'; rr(c, x0, y - h / 2, tw + 14 * u, h, h / 2); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, x0 + 7 * u, y + 0.5);
    x0 += tw + 14 * u + 8 * u + ps;
    for (let i = 0; i < 3; i++) {
      const got = (s.pouchesGot >> i) & 1, before = (this.hud.pouchesBefore >> i) & 1;
      pouch(c, x0 + i * (ps * 2 + 3 * u), y, ps, got ? 2 : before ? 1 : 0);
    }
    return total;
  }
}

// ---------------------------------------------------------------- helpers
export function shapeOf(ch: CharacterDef): Shape { return ch.shape; }

/** A hazard (or pit / "cooled down") icon for the results card, drawn with the in-game art. */
export function drawHazardIcon(c: CanvasRenderingContext2D, kind: string, biomeId: string, w: number, h: number, low = false): void {
  const bi = BIOME_BY_ID[biomeId] ?? BIOMES[0];
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.18)'; rr(c, 0, 0, w, h, 10); c.fill();
  if (kind === 'drain' || kind === 'cap') {
    c.fillStyle = '#dff2ff'; c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) * 0.34, 0, Math.PI * 2); c.fill();
    snowflake(c, w / 2, h / 2, Math.min(w, h) * 0.26, '#3d7fb8');
    c.restore(); return;
  }
  // world units → icon: ground line near the bottom
  const k = kind === 'tall' ? h / 230 : kind === 'hang' ? h / 150 : h / 120;
  c.beginPath(); c.rect(0, 0, w, h); c.clip();
  c.translate(w / 2, h - 10); c.scale(k, k); c.translate(0, -GROUND_Y);
  const gw = w / k;
  c.fillStyle = bi.groundTop; c.fillRect(-gw, GROUND_Y, gw * 2, 8); c.fillStyle = bi.ground; c.fillRect(-gw, GROUND_Y + 8, gw * 2, 60);
  const fake = (x0: number, x1: number, y0: number, y1: number): Hazard => ({ id: 0, kind: kind as Hazard['kind'], x0, x1, y0, y1, biome: bi.id, broken: false, passed: false });
  try {
    if (kind === 'spike') drawSpike(c, fake(-15, 15, GROUND_Y - 36, GROUND_Y), bi.hazard.spike, false, bi.style);
    else if (kind === 'tall') drawTall(c, fake(-17, 17, GROUND_Y - 176, GROUND_Y), bi.hazard.tall, false, 0, bi.style);
    else if (kind === 'hang') drawHang(c, -40, 40, low ? GROUND_Y - 86 : GROUND_Y - 46, bi.hazard.hang, false, 0, bi.style);
    else if (kind === 'pit') { c.fillStyle = bi.pit ?? '#150b17'; c.fillRect(-50, GROUND_Y, 100, 80); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-50, GROUND_Y, 3, 80); c.fillRect(47, GROUND_Y, 3, 80); }
  } catch { /* art not ready */ }
  c.restore();
}

function bigText(c: CanvasRenderingContext2D, x: number, y: number, t: string, color: string, size: number, align: CanvasTextAlign = 'center'): void {
  c.font = `900 ${Math.round(size)}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.18); c.strokeStyle = 'rgba(20,10,35,0.85)';
  c.strokeText(t, x, y); c.fillStyle = color; c.fillText(t, x, y);
}
function ring(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, col: string): void {
  c.fillStyle = 'rgba(20,14,40,0.66)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = Math.max(2.5, r * 0.24); c.beginPath(); c.arc(x, y, r - 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, k))); c.stroke();
}
function snowflake(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  c.strokeStyle = col; c.lineWidth = Math.max(1.4, r * 0.22); c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3; const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy);
    for (const sgn of [-1, 1]) { const bx = x + dx * 0.55 * sgn, by = y + dy * 0.55 * sgn; const pa = a + Math.PI / 2; const q = r * 0.28; c.moveTo(bx, by); c.lineTo(bx + Math.cos(pa) * q + dx * 0.25 * sgn, by + Math.sin(pa) * q + dy * 0.25 * sgn); c.moveTo(bx, by); c.lineTo(bx - Math.cos(pa) * q + dx * 0.25 * sgn, by - Math.sin(pa) * q + dy * 0.25 * sgn); }
  }
  c.stroke(); c.lineCap = 'butt';
}
function steam(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  c.strokeStyle = '#5a2a00'; c.lineWidth = Math.max(1.4, r * 0.24); c.lineCap = 'round'; c.beginPath();
  for (let i = -1; i <= 1; i++) {
    const bx = x + i * r * 0.55; const ph = t * 4 + i;
    c.moveTo(bx, y + r * 0.8);
    c.bezierCurveTo(bx + r * 0.35 * Math.sin(ph), y + r * 0.3, bx - r * 0.35 * Math.sin(ph), y - r * 0.2, bx, y - r * 0.8);
  }
  c.stroke(); c.lineCap = 'butt';
}
/** 황금 복주머니 icon: 0 empty · 1 banked earlier · 2 got this run */
function pouch(c: CanvasRenderingContext2D, x: number, y: number, s: number, st: 0 | 1 | 2): void {
  c.beginPath();
  c.moveTo(x - s * 0.45, y - s * 0.55); c.lineTo(x + s * 0.45, y - s * 0.55);
  c.quadraticCurveTo(x + s * 1.05, y + s * 0.1, x + s * 0.7, y + s * 0.8);
  c.lineTo(x - s * 0.7, y + s * 0.8); c.quadraticCurveTo(x - s * 1.05, y + s * 0.1, x - s * 0.45, y - s * 0.55); c.closePath();
  c.fillStyle = st === 2 ? '#ffd23f' : st === 1 ? 'rgba(255,210,63,0.45)' : 'rgba(20,14,40,0.55)'; c.fill();
  c.strokeStyle = st ? '#8a5a00' : 'rgba(255,255,255,0.4)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = st ? '#c0392b' : 'rgba(255,255,255,0.35)'; c.fillRect(x - s * 0.55, y - s * 0.45, s * 1.1, s * 0.22);
}
