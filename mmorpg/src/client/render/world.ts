// World renderer: camera (smooth follow with look-ahead, trauma shake, zoom punch, roll), terrain, y-sorted sprites with
// hit reactions and dissolving deaths, a colour light map, ambient particles, effects, post-processing, and a 2D overlay
// for names, bars, bubbles and floating numbers.
import { TILE } from '../../shared/constants.ts';
import { MONSTERS } from '../../shared/data/monsters.ts';
import { TALS } from '../../shared/data/talismans.ts';
import { CLASSES } from '../../shared/data/classes.ts';
import { PF, MF } from '../../shared/protocol.ts';
import type { GameMap } from '../../shared/map.ts';
import type { RosterEntry } from '../../shared/types.ts';
import { Art } from './art/index.ts';
import { Terrain, type TileObj } from './terrain.ts';
import { SCENE, LIGHT, EMIT, CanvasPainter, noPost, type Painter, type Cam } from './paint.ts';
import { GLPainter } from './gl.ts';
import { Anim } from './anim.ts';
import { hexCol, type FxSystem } from './fx.ts';
import { CLASS_FX } from '../classfx/index.ts';

export type Quality = 'high' | 'mid' | 'low';
export interface REnt { id: number; kind: 'p' | 'm'; t: number; x: number; y: number; hp: number; f: number; face: number; dieT: number; vx: number; seenT: number; bubble?: { text: string; until: number } }
export interface View {
  myId: number; meX: number; meY: number; players: REnt[]; mons: REnt[]; roster: Map<number, RosterEntry>;
  renderTime: number; serverTime: number; zone: number; bloodMoon: boolean; downed: boolean; hpFrac: number; revive: number; reviveOf: (id: number) => number;
}
type Ctx = CanvasRenderingContext2D;
interface Item { y: number; k: number; o: unknown }

const GLOW = MONSTERS.map(m => (m.glow ? hexCol(m.glow) : 0));
const FLOATY = new Set(['wisp', 'bogwisp', 'foxfire', 'drowned', 'egg', 'boss_reaper']);
/** Night ambient per zone (multiplier on scene colour) and blood-moon override. */
const AMBIENT: [number, number, number][] = [[0.68, 0.72, 0.92], [0.56, 0.66, 0.9], [0.5, 0.62, 0.72], [0.46, 0.48, 0.72], [0.62, 0.54, 0.7], [0.5, 0.44, 0.6]];
const BLOOD: [number, number, number] = [0.78, 0.36, 0.42];
export const DIE_T = 0.5;
const noise = (t: number) => Math.sin(t) * 0.5 + Math.sin(t * 2.31 + 1.3) * 0.3 + Math.sin(t * 4.73 + 2.1) * 0.2;

export class Renderer {
  stage: HTMLElement; cv!: HTMLCanvasElement; over: HTMLCanvasElement; oc: Ctx; p!: Painter;
  art = new Art(); terrain: Terrain; map: GameMap; fx!: FxSystem; anim = new Anim();
  W = 1; H = 1; dpr = 1; zoom = 1; baseZoom = 1; dprCap = 2.5; quality: Quality = 'high'; showNames = true; glFailed = false;
  camX = 0; camY = 0; private rot = 0; private cx = 0; private cy = 0; private camInit = false; private lvx = 0; private lvy = 0; private lastMe = [0, 0];
  private t = 0; private objs: TileObj[] = []; private amb: [number, number, number] = [0.6, 0.66, 0.9]; private post = noPost(); private ambT = 0; private items: Item[] = [];
  private od = 1;

  constructor(stage: HTMLElement, map: GameMap, quality: Quality) {
    this.stage = stage; this.map = map; this.terrain = new Terrain(map);
    this.over = document.createElement('canvas'); this.over.className = 'overlay'; stage.append(this.over); this.oc = this.over.getContext('2d')!;
    this.setQuality(quality);
  }
  get low(): boolean { return this.quality === 'low'; }
  get kind(): string { return this.p.kind; }
  setQuality(q: Quality): void {
    const changed = !this.p || q !== this.quality || (this.p.kind === 'gl') !== (q !== 'low' && !this.glFailed);
    this.quality = q; this.dprCap = q === 'high' ? 2.5 : q === 'mid' ? 1.75 : 1.25;
    if (changed) this.makePainter();
    if (this.fx) { this.fx.low = q === 'low'; this.fx.cap = q === 'high' ? 1400 : q === 'mid' ? 900 : 380; }
    this.resize();
  }
  private makePainter(): void {
    this.p?.destroy(); this.cv?.remove();
    const mk = () => { const cv = document.createElement('canvas'); cv.className = 'world'; this.stage.prepend(cv); return cv; };
    this.cv = mk();
    if (this.quality !== 'low' && !this.glFailed) {
      try { this.p = new GLPainter(this.cv); (this.p as GLPainter).bloomQ = this.quality === 'high' ? 2 : 1; return; }
      catch (e) { console.warn('WebGL unavailable, using Canvas2D', e); this.glFailed = true; this.cv.remove(); this.cv = mk(); }
    }
    this.p = new CanvasPainter(this.cv);
  }
  resize(): void {
    // layout size, not getBoundingClientRect(): the UI may be CSS-rotated into landscape (ui/orient.ts)
    this.W = Math.max(1, this.stage.clientWidth); this.H = Math.max(1, this.stage.clientHeight);
    this.dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    this.baseZoom = Math.max(Math.min(this.W, this.H) / 560, Math.max(this.W, this.H) / 1180);
    this.p.resize(this.W, this.H, this.dpr);
    this.od = Math.min(2, window.devicePixelRatio || 1); this.over.width = Math.round(this.W * this.od); this.over.height = Math.round(this.H * this.od);
    const s = this.baseZoom * this.dpr; if (this.art.setScale(s)) this.p.resetAtlas();
    this.terrain.setScale(Math.round(s * 4) / 4 * (this.quality === 'high' ? 1 : 0.8));
  }
  /** Replace a lost WebGL context with a fresh painter. */
  private recover(): void { this.makePainter(); this.resize(); }

  toScreen(x: number, y: number): [number, number] {
    const X = (x - this.camX) * this.zoom, Y = (y - this.camY) * this.zoom, c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [c * X - s * Y + this.W / 2, s * X + c * Y + this.H / 2];
  }
  toWorld(sx: number, sy: number): [number, number] {
    const X = sx - this.W / 2, Y = sy - this.H / 2, c = Math.cos(-this.rot), s = Math.sin(-this.rot);
    return [(c * X - s * Y) / this.zoom + this.camX, (s * X + c * Y) / this.zoom + this.camY];
  }
  private light(x: number, y: number, r: number, col: number, a: number): void { const s = r / 32; this.p.draw(LIGHT, this.art.fx('light'), x, y, s, s * 0.8, 0, col, a, 1); }
  private shadow(x: number, y: number, r: number, a = 0.42): void { const s = r / 32; this.p.draw(SCENE, this.art.fx('soft'), x, y, s * 1.15, s * 0.42, 0, 0x06040c, a, 0); }

  /** dt: real frame time; vdt: visual time (0 during hit-stop). */
  frame(v: View, dt: number, vdt: number): void {
    if (this.p.lost) this.recover();
    this.t += vdt; this.anim.update(vdt); this.art.frame(); const p = this.p, fx = this.fx, A = this.art;
    // ---- camera ----
    const mvx = dt > 0 ? (v.meX - this.lastMe[0]) / dt : 0, mvy = dt > 0 ? (v.meY - this.lastMe[1]) / dt : 0; this.lastMe = [v.meX, v.meY];
    const kv = 1 - Math.exp(-dt * 4); if (Math.hypot(mvx, mvy) < 800) { this.lvx += (mvx - this.lvx) * kv; this.lvy += (mvy - this.lvy) * kv; }
    const tx = v.meX + Math.max(-70, Math.min(70, this.lvx * 0.2)), ty = v.meY - 14 + Math.max(-50, Math.min(50, this.lvy * 0.16));
    if (!this.camInit || Math.hypot(tx - this.cx, ty - this.cy) > 500) { this.cx = tx; this.cy = ty; this.camInit = true; }
    else { const k = 1 - Math.exp(-dt * 7); this.cx += (tx - this.cx) * k; this.cy += (ty - this.cy) * k; }
    const tr = fx.trauma * fx.trauma, rt = performance.now() / 1000;
    this.camX = this.cx + noise(rt * 31) * tr * 18; this.camY = this.cy + noise(rt * 27 + 4) * tr * 18; this.rot = noise(rt * 19 + 9) * tr * 0.05;
    this.zoom = this.baseZoom * (1 + fx.punch);
    const cam: Cam = { x: this.camX, y: this.camY, zoom: this.zoom, rot: this.rot };
    // ---- ambient ----
    const target = v.bloodMoon ? BLOOD : AMBIENT[v.zone] ?? AMBIENT[1]; const ka = 1 - Math.exp(-dt * 1.5);
    for (let i = 0; i < 3; i++) this.amb[i] += (target[i] - this.amb[i]) * ka;
    p.begin(cam, this.amb, 0x0a0c16);
    const m = 1 / Math.cos(Math.min(0.3, Math.abs(this.rot))); const hw = this.W / 2 / this.zoom * m + 20, hh = this.H / 2 / this.zoom * m + 20;
    const x0 = this.camX - hw, y0 = this.camY - hh, x1 = this.camX + hw, y1 = this.camY + hh;
    // ---- ground ----
    this.terrain.draw(p, x0, y0, x1, y1, this.low ? 1 : 2);
    this.drawFlatProps(v, x0, y0, x1, y1);
    fx.drawGround(p);
    // ---- shadows & ground auras, then y-sorted sprites ----
    const items = this.items; items.length = 0;
    this.objs.length = 0; this.terrain.objects(x0 - 50, y0 - 20, x1 + 50, y1 + 110, this.objs);
    for (const o of this.objs) { this.shadow(o.x, o.y - 2, o.kind === 'rock' || o.kind === 'grave' ? 22 : o.kind === 'lantern' ? 14 : 24, 0.36); items.push({ y: o.y, k: 0, o }); }
    for (const pr of this.map.props) {
      const px = pr.x * TILE, py = pr.y * TILE; if (px + pr.w * TILE < x0 - 140 || px > x1 + 140 || py < y0 - 80 || py > y1 + 260) continue;
      if (pr.k === 'house') items.push({ y: py + pr.h * TILE, k: 1, o: pr });
      else if (pr.k === 'moontree') { this.shadow(px + TILE, py + 2 * TILE, 90, 0.4); items.push({ y: py + 2 * TILE, k: 1, o: pr }); }
      else if (pr.k === 'shrine' || pr.k === 'altar') { this.shadow(px + TILE / 2, py + TILE, 36, 0.35); items.push({ y: py + TILE, k: 1, o: pr }); }
    }
    for (const n of this.map.npcs) { if (n.x < x0 - 60 || n.x > x1 + 60 || n.y < y0 - 60 || n.y > y1 + 90) continue; this.shadow(n.x, n.y - 2, 17); items.push({ y: n.y, k: 2, o: n }); }
    for (const mo of v.mons) if (mo.x > x0 - 120 && mo.x < x1 + 120 && mo.y > y0 - 60 && mo.y < y1 + 200) { this.monGround(mo); items.push({ y: mo.y, k: 3, o: mo }); }
    for (const pl of v.players) { this.playerGround(pl, v); items.push({ y: pl.y, k: 4, o: pl }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      switch (it.k) {
        case 0: this.drawObj(it.o as TileObj, v); break;
        case 1: this.drawProp(it.o as GameMap['props'][number], v); break;
        case 2: { const n = it.o as GameMap['npcs'][number]; const f = n.kind === 'board' ? 0 : (this.t + n.x * 0.01) % 4 < 0.14 ? 2 : Math.floor(this.t * 1.4 + n.x) % 2; p.draw(SCENE, A.npc(n.kind, f), n.x, n.y, 1, 1, 0, 0xffffff, 1, 0); break; }
        case 3: this.drawMon(it.o as REnt); break;
        case 4: this.drawPlayer(it.o as REnt, v); break;
      }
    }
    this.ambientParts(v, x0, y0, x1, y1, dt);
    fx.drawTop(p);
    // ---- lights ----
    this.drawLights(v);
    fx.drawLights(p);
    // ---- post ----
    const post = this.post; post.time = this.t; post.bloom = this.quality === 'high' ? 0.62 : 0.5; post.grain = this.quality === 'high' ? 0.028 : 0.018;
    post.ca = fx.ca + (v.downed ? 0.003 : 0); post.vignette = 0.62 + (v.hpFrac < 0.3 && !v.downed ? (0.3 - v.hpFrac) * (1.3 + Math.sin(rt * 6) * 0.5) : 0);
    post.desat = v.downed ? 0.75 : 0; post.flash = fx.flashA; post.flashCol = fx.flashCol; post.tint = v.bloodMoon ? 0xffd6da : 0xffffff; fx.waveList(post.waves);
    p.end(post);
    this.drawOverlay(v);
  }

  // ---------- props ----------
  private drawFlatProps(v: View, x0: number, y0: number, x1: number, y1: number): void {
    const p = this.p, A = this.art;
    for (const pr of this.map.props) {
      const px = pr.x * TILE + TILE / 2, py = pr.y * TILE + TILE / 2; if (px < x0 - 520 || px > x1 + 520 || py < y0 - 520 || py > y1 + 520) continue;
      if (pr.k === 'altar') {
        const col = v.bloodMoon ? 0xff2a3a : 0xff7a60; const a = v.bloodMoon ? 0.75 : 0.35;
        p.draw(EMIT, A.fx('sigil'), px, py, 760 / 256, 760 / 256 * 0.62, this.t * 0.06, col, a, 1);
        p.draw(EMIT, A.fx('runes'), px, py, 520 / 128, 520 / 128 * 0.62, -this.t * 0.12, col, a * 0.8, 1);
      } else if (pr.k === 'lair') p.draw(EMIT, A.fx('runes'), px, py, 400 / 128, 400 / 128 * 0.62, this.t * 0.1, 0xc83c50, 0.18, 1);
      else if (pr.k === 'shrine') p.draw(EMIT, A.fx('soft'), px, py + 10, 2.6, 1.3, 0, 0x8fc8ff, 0.1 + Math.sin(this.t * 2) * 0.03, 1);
    }
  }
  private fade(x: number, top: number, bot: number, half: number, v: View): number {
    return v.meY < bot - 4 && v.meY > top + 6 && Math.abs(v.meX - x) < half ? 0.42 : 1;
  }
  private drawObj(o: TileObj, v: View): void {
    const p = this.p, t = this.art.prop(o.kind, o.v % 3); const tall = o.kind === 'tree' || o.kind === 'pine' || o.kind === 'maple' || o.kind === 'deadtree';
    const a = tall || o.kind === 'jangseung' ? this.fade(o.x, o.y - t.h * t.ay, o.y, t.w * 0.38, v) : 1;
    const sway = tall ? Math.sin(this.t * 1.1 + o.x * 0.013 + o.y * 0.007) * 0.018 : 0;
    p.draw(SCENE, t, o.x, o.y, 1, 1, sway, 0xffffff, a, 0);
    if (o.kind === 'lantern') { const fl = 0.85 + noise(this.t * 7 + o.x) * 0.15; p.draw(EMIT, this.art.fx('soft'), o.x, o.y - 42, 0.75, 0.75, 0, 0xffb050, 0.42 * fl, 1); }
  }
  private drawProp(pr: GameMap['props'][number], v: View): void {
    const p = this.p, A = this.art, px = pr.x * TILE, py = pr.y * TILE;
    if (pr.k === 'house') { const t = A.house(pr.w, pr.h, pr.v ?? 0); p.draw(SCENE, t, px, py, 1, 1, 0, 0xffffff, this.fade(px + pr.w * 16, py - 40, py + pr.h * TILE, pr.w * 16 + 6, v), 0); }
    else if (pr.k === 'moontree') {
      const t = A.prop('moontree', 0); const x = px + TILE, y = py + 2 * TILE + 8; p.draw(SCENE, t, x, y, 1, 1, 0, 0xaab6d6, this.fade(x, y - 190, y, 80, v), 0);
      p.draw(EMIT, A.fx('soft'), x, y - 120, 4.2, 3, 0, 0x9fc8ff, 0.09 + Math.sin(this.t * 1.3) * 0.025, 1);
    } else if (pr.k === 'shrine') { const x = px + TILE / 2, y = py + TILE; p.draw(SCENE, A.prop('shrine', 0), x, y, 1, 1, 0, 0xffffff, 1, 0); p.draw(EMIT, A.fx('soft'), x, y - 36, 0.7, 0.7, 0, 0xbfe0ff, 0.42 + Math.sin(this.t * 3) * 0.1, 1); }
    else if (pr.k === 'altar') { const x = px + TILE / 2, y = py + TILE; p.draw(SCENE, A.prop('altar', 0), x, y, 1, 1, 0, 0xffffff, 1, 0); p.draw(EMIT, A.fx('soft'), x, y - 34, 0.8, 0.8, 0, v.bloodMoon ? 0xff3040 : 0xff7050, 0.5, 1); }
  }

  // ---------- players ----------
  private playerGround(pl: REnt, v: View): void {
    const r = v.roster.get(pl.id); const p = this.p, A = this.art; const down = (pl.f & PF.DOWN) !== 0;
    this.shadow(pl.x, pl.y - 1, down ? 26 : 17);
    if (!r || down) return;
    for (const [k, lv] of r.tals) if (k === 'aura') {
      const R = TALS.aura.radius[lv - 1]; const s = (R * 2) / 128;
      p.draw(EMIT, A.fx('ringSoft'), pl.x, pl.y, s, s * 0.62, 0, 0xffa050, 0.55, 1);
      p.draw(EMIT, A.fx('runes'), pl.x, pl.y, s * 0.92, s * 0.92 * 0.62, this.t * 0.9, 0xffb36b, 0.5, 1);
    }
    if (pl.id === v.myId) p.draw(EMIT, A.fx('ringSoft'), pl.x, pl.y, 0.36, 0.36 * 0.62, 0, CLASSES[r.cls].color ? hexCol(CLASSES[r.cls].color) : 0xffffff, 0.35, 1);
  }
  private drawPlayer(pl: REnt, v: View): void {
    const r = v.roster.get(pl.id); const cls = r?.cls ?? 'sword'; const p = this.p, A = this.art; const me = pl.id === v.myId;
    const down = (pl.f & PF.DOWN) !== 0; const moving = (pl.f & PF.MOVING) !== 0; const re = this.anim.get('p', pl.id);
    const flip = Math.cos(pl.face / 255 * Math.PI * 2) < 0 ? -1 : 1;
    if (down) {
      p.draw(SCENE, A.player(cls, 'hurt'), pl.x, pl.y - 6, 1, 1, Math.PI / 2 * -flip, 0xb8b8d0, 0.8, 0);
      const prog = v.reviveOf(pl.id); if (prog > 0) p.arc(EMIT, A.fx('beam'), pl.x, pl.y - 22, 26, 7, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, 0x7dffb0, 1, 1);
      return;
    }
    const atk = Anim.atkFrame(re);
    const frame = atk ?? (re.hurtT < 0.2 ? 'hurt' : moving ? 'walk' + (Math.floor(this.t * 10 + pl.id) % 4) : (this.t + pl.id * 0.7) % 3.3 < 0.13 ? 'blink' : Math.floor(this.t * 1.5 + pl.id) % 2 ? 'idle1' : 'idle0');
    const safe = (pl.f & PF.SAFE) !== 0; const a = safe ? 0.55 + Math.sin(this.t * 20) * 0.25 : 1;
    const hurtFlash = (pl.f & PF.HURT) !== 0 && Math.floor(this.t * 20) % 2 === 0 ? 0.6 : 0;
    const sq = re.squash; const sx = flip * (1 + sq * 0.1), sy = 1 - sq * 0.08;
    const x = pl.x + re.ox, y = pl.y + re.oy * 0.4;
    p.draw(SCENE, A.player(cls, frame), x, y, sx, sy, 0, 0xffffff, a, 0, Math.max(re.flash * 0.9, hurtFlash));
    if (pl.f & PF.SHIELD) { p.draw(EMIT, A.fx('ringSoft'), x, y - 24, 0.52, 0.56, 0, 0xe0c3ff, 0.8, 1); p.draw(EMIT, A.fx('hex'), x, y - 24, 0.62, 0.66, this.t * 0.4, 0xe0c3ff, 0.18, 1); }
    if (r) for (const [k, lv] of r.tals) {
      if (k !== 'blades') continue; const n = TALS.blades.count[lv - 1], R = TALS.blades.radius[lv - 1]; const time = me ? v.serverTime : v.renderTime;
      for (let i = 0; i < n; i++) {
        const an = time * 3.4 + (i / n) * Math.PI * 2; const bx = pl.x + Math.cos(an) * R, by = pl.y - 12 + Math.sin(an) * R * 0.9;
        p.draw(EMIT, A.fx('soft'), bx, by, 0.5, 0.5, 0, 0x9fd7ff, 0.6, 1); p.draw(EMIT, A.fx('spark'), bx, by, 1.2, 1.6, an + Math.PI / 2, 0xeaf6ff, 1, 1);
      }
    }
    if (pl.f & PF.WHIRL) CLASS_FX[cls]?.aura?.(p, A, this.t, pl.x, pl.y);
  }

  // ---------- monsters ----------
  private monGround(mo: REnt): void {
    const def = MONSTERS[mo.t]; if (!def) return; const elite = (mo.f & MF.ELITE) !== 0; const sc = elite ? 1.3 : 1;
    const a = mo.dieT > 0 ? Math.max(0, 1 - mo.dieT / DIE_T) : (mo.f & MF.HIDE) ? 0.2 : 1;
    this.shadow(mo.x, mo.y, def.r * sc * (FLOATY.has(def.key) ? 0.85 : 1.05), 0.42 * a);
    if (elite && mo.dieT <= 0) { const s = (def.r * sc + 14) * 2 / 128; this.p.draw(EMIT, this.art.fx('ringSoft'), mo.x, mo.y, s, s * 0.5, 0, 0xffc53d, 0.8, 1); }
  }
  private drawMon(mo: REnt): void {
    const def = MONSTERS[mo.t]; if (!def) return; const p = this.p, A = this.art;
    const hide = (mo.f & MF.HIDE) !== 0, elite = (mo.f & MF.ELITE) !== 0, boss = def.beh === 'boss', wind = (mo.f & MF.WIND) !== 0, dash = (mo.f & MF.DASH) !== 0;
    const dying = mo.dieT > 0; const dis = dying ? Math.min(1, mo.dieT / DIE_T) : 0; if (dis >= 1) return;
    let a = hide ? 0.16 : 1; const age = (performance.now() - mo.seenT) / 260; if (age < 1) a *= Math.max(0, age);
    const sc = elite ? 1.3 : 1; const floaty = FLOATY.has(def.key); const flame = A.isFlame(def.key);
    const fr = Math.floor(this.t * (flame ? 9 : 5) + mo.id * 0.37) % A.monFrames(def.key);
    const tex = A.mon(def.key, fr, wind ? 'w' : dash ? 'd' : 'm');
    const bob = floaty ? Math.sin(this.t * 4 + mo.id) * 3 + 4 : dying ? 0 : Math.abs(Math.sin(this.t * 8 + mo.id * 1.3)) * 1.6;
    const re = this.anim.peek('m', mo.id); const ox = re?.ox ?? 0, oy = re?.oy ?? 0, sq = re?.squash ?? 0;
    const jit = wind && !dying ? (Math.random() - 0.5) * 3.2 : 0; const left = (mo.f & MF.LEFT) ? -1 : 1;
    const st = dash ? 1.14 : 1; const sx = left * sc * st * (1 + sq * 0.2), sy = sc / st * (1 - sq * 0.16) * (dying ? 1 + dis * 0.12 : 1);
    const flash = Math.max(re?.flash ?? 0, (mo.f & MF.HIT) && !dying ? 0.55 : 0, dying ? Math.max(0, 1 - dis * 4) : 0);
    const tint = (mo.f & MF.SLOW) ? 0xa8dcff : 0xffffff; const x = mo.x + ox + jit, y = mo.y - bob + oy * 0.5;
    if (GLOW[mo.t] && !dying) p.draw(EMIT, A.fx('soft'), x, y - tex.h * tex.ay * sc * 0.45, sc * (boss ? 3 : 1.2), sc * (boss ? 3 : 1.2), 0, GLOW[mo.t], (flame ? 0.3 : 0.15) * a, 1);
    p.draw(SCENE, tex, x, y, sx, sy, 0, tint, a, 0, flash, dis);
    if (flame && !dying) p.draw(EMIT, tex, x, y, sx, sy, 0, 0xffffff, 0.2 * a, 1);
    if (wind && !boss && !dying) { const pulse = 0.7 + Math.sin(this.t * 22) * 0.3; p.draw(EMIT, A.fx('danger'), mo.x, y - tex.h * tex.ay * sc - 14, 0.9, 0.9, 0, 0xff3a3a, pulse, 1); }
    if ((mo.f & MF.SLOW) && !dying) for (let i = 0; i < 3; i++) { const an = this.t * 2 + i * 2.1; p.draw(EMIT, A.fx('shard'), mo.x + Math.cos(an) * def.r * sc, y - def.r * sc + Math.sin(an) * 7, 0.8, 0.8, an, 0xcff4ff, 0.9, 1); }
  }

  // ---------- lights & ambience ----------
  private drawLights(v: View): void {
    const L = (x: number, y: number, r: number, col: number, a: number) => this.light(x, y, r, col, a);
    L(v.meX, v.meY - 20, 320, 0xffe0c0, 0.36);
    for (const pl of v.players) if (pl.id !== v.myId && !(pl.f & PF.DOWN)) L(pl.x, pl.y - 20, 190, 0xd8e4ff, 0.15);
    for (const mo of v.mons) { const g = GLOW[mo.t]; if (g && mo.dieT <= 0) L(mo.x, mo.y - 14, MONSTERS[mo.t].beh === 'boss' ? 260 : 90, g, MONSTERS[mo.t].beh === 'boss' ? 0.6 : 0.42); }
    for (const o of this.objs) if (o.light) L(o.x, o.y - 40, 190, 0xffb860, 0.5 + noise(this.t * 7 + o.x) * 0.06);
    for (const pr of this.map.props) {
      const px = pr.x * TILE, py = pr.y * TILE; if (Math.abs(px - this.camX) > 1000 || Math.abs(py - this.camY) > 900) continue;
      if (pr.k === 'moontree') L(px + TILE, py + 2 * TILE, 460, 0xa8ccff, 0.3);
      else if (pr.k === 'shrine') L(px + 16, py, 200, 0x8fc8ff, 0.4);
      else if (pr.k === 'house') L(px + pr.w * 16, py + pr.h * 20, 150, 0xffb060, 0.32);
      else if (pr.k === 'altar') L(px, py, 330, v.bloodMoon ? 0xff3030 : 0xff7050, 0.5);
    }
    for (const n of this.map.npcs) if (Math.abs(n.x - this.camX) < 900 && Math.abs(n.y - this.camY) < 800) L(n.x, n.y - 20, 130, 0xffe0b0, 0.2);
  }
  /** Fireflies, falling leaves, marsh mist, drifting petals — spawned around the camera. */
  private ambientParts(v: View, x0: number, y0: number, x1: number, y1: number, dt: number): void {
    if (this.low || dt <= 0) return; this.ambT += dt; if (this.ambT < 0.12) return; this.ambT = 0; const fx = this.fx;
    const rx = () => x0 + Math.random() * (x1 - x0), ry = () => y0 + Math.random() * (y1 - y0);
    switch (v.bloodMoon ? -1 : v.zone) {
      case 0: if (Math.random() < 0.5) fx.part({ tex: 'petal', layer: SCENE, x: rx(), y: y0 - 10, vx: 20 + Math.random() * 20, vy: 30 + Math.random() * 20, drag: 1, life: 8, size: 6, col: Math.random() < 0.5 ? 0xffc8dc : 0xfff0f4, spin: 2, fadeIn: 0.5 }); break;
      case 1: fx.part({ tex: 'dot', x: rx(), y: ry(), vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 20 - 6, drag: 1, life: 4, size: 5, col: Math.random() < 0.7 ? 0xd8ff7a : 0x9fe0ff, fadeIn: 1.2, a: 0.9 }); break;
      case 2: fx.part({ tex: 'smoke', layer: SCENE, x: rx(), y: ry(), vx: 12 + Math.random() * 8, vy: -2, drag: 1, life: 6, size: 70, grow: 12, col: 0xbfe0d8, a: 0.13, fadeIn: 2, spin: 0.1 }); break;
      case 3: if (Math.random() < 0.6) fx.part({ tex: 'dot', x: rx(), y: ry(), vx: (Math.random() - 0.5) * 16, vy: -14 - Math.random() * 10, drag: 1, life: 4, size: 4, col: 0xb8a8ff, fadeIn: 1, a: 0.8 }); break;
      case 4: fx.part({ tex: 'leaf', layer: SCENE, x: rx(), y: y0 - 10, vx: 30 + Math.random() * 30, vy: 40 + Math.random() * 20, drag: 1, life: 7, size: 7, col: [0xe0683a, 0xf08a34, 0xd84a4a][Math.floor(Math.random() * 3)], spin: 3, fadeIn: 0.4 }); break;
      case -1: fx.part({ tex: 'dot', x: rx(), y: y1 + 10, vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 30, drag: 1, life: 5, size: 4, col: 0xff4a3a, fadeIn: 0.6, a: 0.9 }); break;
    }
  }

  // ---------- overlay ----------
  private drawOverlay(v: View): void {
    const c = this.oc, S = (x: number, y: number) => this.toScreen(x, y);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.over.width, this.over.height); c.setTransform(this.od, 0, 0, this.od, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    const z = this.zoom, now = performance.now();
    for (const n of this.map.npcs) {
      if (Math.abs(n.x - this.camX) > 800 || Math.abs(n.y - this.camY) > 600) continue; const [sx, sy] = S(n.x, n.y - 66);
      c.font = '800 12px "Nanum Myeongjo", serif'; c.lineWidth = 3.5; c.strokeStyle = 'rgba(10,8,20,0.85)'; c.strokeText(n.title, sx, sy); c.fillStyle = '#ffe08a'; c.fillText(n.title, sx, sy);
    }
    for (const mo of v.mons) {
      const def = MONSTERS[mo.t]; if (!def || def.beh === 'boss' || mo.hp >= 255 || mo.dieT > 0) continue; const elite = (mo.f & MF.ELITE) !== 0; const sc = elite ? 1.3 : 1;
      const top = mo.y - (def.r * 2.2 + 12) * sc; const [sx, sy] = S(mo.x, top); const w = Math.max(24, def.r * 2 * sc) * z;
      c.fillStyle = 'rgba(10,8,20,0.8)'; c.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 5); c.fillStyle = elite ? '#ffc53d' : '#ff4d5a'; c.fillRect(sx - w / 2, sy, w * (mo.hp / 255), 3);
    }
    // player labels, nudged upwards where they would overlap
    const labels: { pl: REnt; r: RosterEntry; me: boolean; sx: number; sy: number; w: number; text: string }[] = [];
    for (const pl of v.players) {
      const r = v.roster.get(pl.id); if (!r) continue; const me = pl.id === v.myId; const [sx, sy] = S(pl.x, pl.y - 66);
      const text = this.showNames || me || r.bot === false ? `Lv${r.level} ${r.name}` : '';
      c.font = `${me ? 800 : 700} 12px system-ui, sans-serif`; labels.push({ pl, r, me, sx, sy, w: Math.max(38, text ? c.measureText(text).width + (r.bot ? 24 : 0) : 0), text });
    }
    labels.sort((a, b) => (b.me ? 1e6 : b.sy) - (a.me ? 1e6 : a.sy));
    const placed: number[] = [];
    for (const L of labels) {
      const { pl, r, me, sx } = L; let sy = L.sy;
      for (let k = 0; k < 4; k++) { let hit = false; for (let i = 0; i < placed.length; i += 4) if (Math.abs(placed[i] - sx) * 2 < placed[i + 2] + L.w && Math.abs(placed[i + 1] - sy) < 20) { hit = true; break; } if (!hit) break; sy -= 17; }
      placed.push(sx, sy, L.w, 0);
      if (pl.f & PF.DOWN) { c.font = '16px system-ui'; c.fillText('💫', sx, sy + 12 + Math.sin(this.t * 3) * 3); }
      if (L.text) {
        c.font = `${me ? 800 : 700} 12px system-ui, sans-serif`; c.lineWidth = 3.5; c.strokeStyle = 'rgba(10,8,20,0.85)'; const tw = c.measureText(L.text).width; const tx = sx - (r.bot ? 11 : 0);
        c.strokeText(L.text, tx, sy); c.fillStyle = me ? '#ffffff' : r.bot ? '#bfe6ff' : CLASSES[r.cls].color; c.fillText(L.text, tx, sy);
        if (r.bot) { c.fillStyle = '#4a6ab8'; c.beginPath(); c.roundRect(tx + tw / 2 + 3, sy - 10, 18, 12, 3); c.fill(); c.fillStyle = '#fff'; c.font = '800 9px system-ui'; c.fillText('AI', tx + tw / 2 + 12, sy - 1); }
      }
      if (!(pl.f & PF.DOWN)) { const w = 36; c.fillStyle = 'rgba(10,8,20,0.8)'; c.fillRect(sx - w / 2 - 1, sy + 4, w + 2, 5); c.fillStyle = me ? '#6dff8a' : '#5ad2ff'; c.fillRect(sx - w / 2, sy + 5, w * (pl.hp / 255), 3); }
      if (pl.bubble && pl.bubble.until > now) {
        const txt = pl.bubble.text.length > 22 ? pl.bubble.text.slice(0, 21) + '…' : pl.bubble.text; c.font = '700 13px system-ui'; const w = Math.min(190, c.measureText(txt).width + 18);
        c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.roundRect(sx - w / 2, sy - 36, w, 25, 11); c.fill(); c.beginPath(); c.moveTo(sx - 5, sy - 11); c.lineTo(sx, sy - 5); c.lineTo(sx + 5, sy - 11); c.fill();
        c.fillStyle = '#1b1426'; c.fillText(txt, sx, sy - 18.5);
      }
    }
    this.fx.drawText(c, S, Math.max(0.85, Math.min(1.25, z)));
  }
  /** Debug/e2e info. */
  info(): { painter: string; quality: Quality; dpr: number; art: number; draws: number; quads: number; uploads: number } {
    return { painter: this.p.kind, quality: this.quality, dpr: this.dpr, art: this.art.px, ...this.p.stats };
  }
}
