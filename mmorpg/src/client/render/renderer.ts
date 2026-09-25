// Main canvas renderer: camera, terrain, y-sorted entities & props, effects, night lighting.
import { TILE } from '../../shared/constants.ts';
import { MONSTERS } from '../../shared/data/monsters.ts';
import { TALS } from '../../shared/data/talismans.ts';
import { CLASSES } from '../../shared/data/classes.ts';
import { PF, MF } from '../../shared/protocol.ts';
import type { GameMap } from '../../shared/map.ts';
import type { RosterEntry } from '../../shared/types.ts';
import { Sprites, type Spr } from './sprites.ts';
import { Terrain, type TileObj } from './terrain.ts';
import type { FxSystem } from './fx.ts';

type Ctx = CanvasRenderingContext2D;
export interface REnt { id: number; kind: 'p' | 'm'; t: number; x: number; y: number; hp: number; f: number; face: number; dieT: number; vx: number; seenT: number; bubble?: { text: string; until: number } }
export interface View {
  myId: number; meX: number; meY: number; players: REnt[]; mons: REnt[]; roster: Map<number, RosterEntry>;
  renderTime: number; serverTime: number; zone: number; bloodMoon: boolean; downed: boolean; revive: number; reviveOf: (id: number) => number;
}
const GLOW = MONSTERS.map(m => m.glow);

export class Renderer {
  cv: HTMLCanvasElement; c: Ctx; spr = new Sprites(); terrain: Terrain; map: GameMap; fx!: FxSystem;
  W = 0; H = 0; dpr = 1; zoom = 1; dprCap = 2; camX = 0; camY = 0; low = false; showNames = true;
  private lightCv = document.createElement('canvas'); private lc: Ctx; private objs: TileObj[] = []; private dark = 0.5; private t = 0;
  constructor(cv: HTMLCanvasElement, map: GameMap) {
    this.cv = cv; this.c = cv.getContext('2d', { alpha: false })!; this.map = map; this.terrain = new Terrain(map); this.lc = this.lightCv.getContext('2d')!;
    this.resize();
  }
  resize(): void {
    const r = this.cv.parentElement!.getBoundingClientRect(); this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.dpr = Math.min(this.low ? 1.25 : this.dprCap, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr); this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.zoom = Math.max(Math.min(this.W, this.H) / 560, Math.max(this.W, this.H) / 1180);
    const s = this.zoom * this.dpr; this.spr.setScale(Math.round(s * 4) / 4); this.terrain.setScale(Math.round(s * 4) / 4);
    this.lightCv.width = Math.ceil(this.W / 4); this.lightCv.height = Math.ceil(this.H / 4);
  }
  /** world → css pixel */
  toScreen(x: number, y: number): [number, number] { return [(x - this.camX) * this.zoom + this.W / 2, (y - this.camY) * this.zoom + this.H / 2]; }
  toWorld(sx: number, sy: number): [number, number] { return [(sx - this.W / 2) / this.zoom + this.camX, (sy - this.H / 2) / this.zoom + this.camY]; }

  frame(v: View, dt: number): void {
    this.t += dt; const c = this.c; const s = this.zoom * this.dpr;
    const shake = this.fx.shake; const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    this.camX = v.meX + sx; this.camY = v.meY - 10 + sy;
    const hw = this.W / 2 / this.zoom, hh = this.H / 2 / this.zoom;
    const x0 = this.camX - hw, y0 = this.camY - hh, x1 = this.camX + hw, y1 = this.camY + hh;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0a0c16'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(s, 0, 0, s, (-this.camX) * s + this.cv.width / 2, (-this.camY) * s + this.cv.height / 2);
    this.terrain.draw(c, x0, y0, x1, y1, this.low ? 1 : 2);
    this.drawFlatProps(c, x0, y0, x1, y1, v);
    this.fx.drawGround(c);
    // ---- y-sorted pass ----
    const items: { y: number; d: () => void }[] = [];
    this.objs.length = 0; this.terrain.objects(x0 - 40, y0 - 20, x1 + 40, y1 + 90, this.objs);
    for (const o of this.objs) { const spr = this.spr.prop(o.kind, o.v % 3); items.push({ y: o.y, d: () => { this.shadow(c, o.x, o.y - 2, o.kind === 'rock' || o.kind === 'grave' ? 18 : 16); this.blit(c, spr, o.x, o.y); } }); }
    for (const p of this.map.props) {
      const px = p.x * TILE, py = p.y * TILE; if (px + p.w * TILE < x0 - 120 || px > x1 + 120 || py < y0 - 60 || py > y1 + 240) continue;
      if (p.k === 'house') { const spr = this.spr.house(p.w, p.h, p.v ?? 0); items.push({ y: py + p.h * TILE, d: () => c.drawImage(spr.cv, px - 8, py - 34, spr.w, spr.h) }); }
      else if (p.k === 'moontree') { const spr = this.spr.prop('moontree'); items.push({ y: py + 2 * TILE, d: () => this.blit(c, spr, px + TILE, py + 2 * TILE + 8) }); }
      else if (p.k === 'shrine') { const spr = this.spr.prop('shrine'); items.push({ y: py + TILE, d: () => this.blit(c, spr, px + TILE / 2, py + TILE) }); }
      else if (p.k === 'altar') { const spr = this.spr.prop('altar'); items.push({ y: py + TILE, d: () => this.blit(c, spr, px + TILE / 2, py + TILE) }); }
    }
    for (const n of this.map.npcs) { if (n.x < x0 - 60 || n.x > x1 + 60 || n.y < y0 - 60 || n.y > y1 + 80) continue; const spr = n.kind === 'board' ? this.spr.prop('board') : this.spr.npc(n.kind); items.push({ y: n.y, d: () => { this.shadow(c, n.x, n.y - 2, 14); this.blit(c, spr, n.x, n.y + (n.kind === 'board' ? 0 : Math.sin(this.t * 2 + n.x) * 0.8)); } }); }
    for (const m of v.mons) if (m.x > x0 - 100 && m.x < x1 + 100 && m.y > y0 - 60 && m.y < y1 + 160) items.push({ y: m.y, d: () => this.drawMon(c, m) });
    for (const p of v.players) items.push({ y: p.y, d: () => this.drawPlayer(c, p, v) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.d();
    this.fx.drawTop(c);
    // ---- labels ----
    this.drawLabels(c, v);
    this.fx.drawText(c);
    // ---- lighting ----
    if (!this.low) this.drawLighting(v, x0, y0);
    else { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(6,8,26,${(this.darkness(v) * 0.6).toFixed(3)})`; c.fillRect(0, 0, this.cv.width, this.cv.height); }
    // vignette + blood moon tint
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (v.bloodMoon) { c.fillStyle = 'rgba(120,0,20,0.12)'; c.fillRect(0, 0, this.cv.width, this.cv.height); }
    if (v.downed) { c.fillStyle = 'rgba(40,40,60,0.45)'; c.fillRect(0, 0, this.cv.width, this.cv.height); }
  }
  private blit(c: Ctx, s: Spr, x: number, y: number, flip = false, sc = 1): void {
    if (flip || sc !== 1) { c.save(); c.translate(x, y); c.scale(flip ? -sc : sc, sc); c.drawImage(s.cv, -s.ox, -s.oy, s.w, s.h); c.restore(); }
    else c.drawImage(s.cv, x - s.ox, y - s.oy, s.w, s.h);
  }
  private shadow(c: Ctx, x: number, y: number, r: number): void { c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2); c.fill(); }

  private drawFlatProps(c: Ctx, x0: number, y0: number, x1: number, y1: number, v: View): void {
    for (const p of this.map.props) {
      const px = p.x * TILE + TILE / 2, py = p.y * TILE + TILE / 2; if (px < x0 - 500 || px > x1 + 500 || py < y0 - 500 || py > y1 + 500) continue;
      if (p.k === 'altar') {
        c.save(); c.translate(px, py); c.strokeStyle = v.bloodMoon ? 'rgba(255,60,60,0.55)' : 'rgba(255,120,100,0.3)'; c.lineWidth = 4;
        for (const r of [120, 250, 370]) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
        c.rotate(this.t * 0.05); for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(130, 0); c.lineTo(240, 0); c.stroke(); }
        c.restore();
      } else if (p.k === 'lair') {
        c.save(); c.translate(px, py); c.strokeStyle = 'rgba(200,60,80,0.35)'; c.lineWidth = 3; c.setLineDash([12, 10]); c.beginPath(); c.arc(0, 0, 200, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore();
      } else if (p.k === 'shrine') {
        const g = c.createRadialGradient(px, py, 10, px, py, 90); g.addColorStop(0, 'rgba(160,210,255,0.25)'); g.addColorStop(1, 'rgba(160,210,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(px, py, 90, 0, Math.PI * 2); c.fill();
      }
    }
  }

  private drawPlayer(c: Ctx, p: REnt, v: View): void {
    const r = v.roster.get(p.id); const cls = r?.cls ?? 'sword'; const me = p.id === v.myId;
    const down = (p.f & PF.DOWN) !== 0; const moving = (p.f & PF.MOVING) !== 0;
    const time = me ? v.serverTime : v.renderTime;
    // talisman auras under the player
    if (r && !down) for (const [k, lv] of r.tals) {
      if (k === 'aura') { const R = TALS.aura.radius[lv - 1]; const g = c.createRadialGradient(p.x, p.y, R * 0.3, p.x, p.y, R); g.addColorStop(0, 'rgba(255,160,80,0)'); g.addColorStop(0.85, 'rgba(255,160,80,0.16)'); g.addColorStop(1, 'rgba(255,200,120,0.45)'); c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, R, R * 0.92, 0, 0, Math.PI * 2); c.fill(); }
    }
    this.shadow(c, p.x, p.y, 15);
    const spr = this.spr.player(cls); const flip = Math.cos(p.face / 255 * Math.PI * 2) < 0;
    if (down) {
      c.save(); c.globalAlpha = 0.75; c.translate(p.x, p.y - 8); c.rotate(Math.PI / 2 * (flip ? -1 : 1)); c.drawImage(spr.cv, -spr.ox, -spr.oy + 20, spr.w, spr.h); c.restore();
      const prog = v.reviveOf(p.id); if (prog > 0) { c.strokeStyle = '#7dffb0'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y - 20, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); c.stroke(); }
      c.fillStyle = 'rgba(220,230,255,0.8)'; c.font = '700 16px system-ui'; c.textAlign = 'center'; c.fillText('💫', p.x, p.y - 40 + Math.sin(this.t * 3) * 3);
      return;
    }
    const bob = moving ? Math.abs(Math.sin(this.t * 11 + p.id)) * 2.6 : Math.sin(this.t * 2.5 + p.id) * 0.6;
    const safe = (p.f & PF.SAFE) !== 0; if (safe) c.globalAlpha = 0.55 + Math.sin(this.t * 20) * 0.25;
    const hurt = (p.f & PF.HURT) !== 0 && Math.floor(this.t * 20) % 2 === 0;
    const sp = hurt ? this.spr.flash(spr, 'pl:' + cls) : spr;
    this.blit(c, sp, p.x, p.y - bob, flip, 1);
    c.globalAlpha = 1;
    if (p.f & PF.SHIELD) { c.strokeStyle = 'rgba(224,195,255,0.8)'; c.lineWidth = 2.5; c.fillStyle = 'rgba(224,195,255,0.12)'; c.beginPath(); c.arc(p.x, p.y - 22, 28, 0, Math.PI * 2); c.fill(); c.stroke(); }
    // orbiting talisman blades
    if (r) for (const [k, lv] of r.tals) {
      if (k !== 'blades') continue; const n = TALS.blades.count[lv - 1], R = TALS.blades.radius[lv - 1];
      for (let i = 0; i < n; i++) {
        const a = time * 3.4 + (i / n) * Math.PI * 2; const bx = p.x + Math.cos(a) * R, by = p.y - 12 + Math.sin(a) * R * 0.9;
        c.save(); c.translate(bx, by); c.rotate(a + Math.PI / 2); c.globalCompositeOperation = 'lighter';
        c.drawImage(this.spr.glow('rgba(159,215,255,0.8)', 14).cv, -14, -14, 28, 28);
        c.fillStyle = '#eaf6ff'; c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(6, 0, 0, 11); c.quadraticCurveTo(2, 0, 0, -11); c.fill(); c.restore();
      }
    }
    if (p.f & PF.WHIRL) {
      c.save(); c.translate(p.x, p.y - 14); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { c.rotate(this.t * 14 + i * 2.1); c.strokeStyle = `rgba(150,200,255,${0.5 - i * 0.12})`; c.lineWidth = 10 - i * 2; c.beginPath(); c.arc(0, 0, 150 - i * 30, 0, 1.6); c.stroke(); }
      c.restore();
    }
  }

  private drawMon(c: Ctx, m: REnt): void {
    const def = MONSTERS[m.t]; if (!def) return;
    const hide = (m.f & MF.HIDE) !== 0; const elite = (m.f & MF.ELITE) !== 0; const boss = def.beh === 'boss';
    let alpha = 1; if (m.dieT > 0) alpha = Math.max(0, 1 - m.dieT / 0.3); if (hide) alpha = 0.15;
    if (alpha <= 0) return;
    const sc = elite ? 1.35 : 1; const floaty = def.key.includes('wisp') || def.key === 'foxfire' || def.key === 'drowned' || def.key === 'egg' || def.key === 'boss_reaper';
    const wind = (m.f & MF.WIND) !== 0; const dash = (m.f & MF.DASH) !== 0;
    const bob = floaty ? Math.sin(this.t * 4 + m.id) * 3 + 4 : Math.abs(Math.sin(this.t * 9 + m.id * 1.3)) * 2;
    const jitter = wind ? (Math.random() - 0.5) * 3 : 0;
    c.globalAlpha = alpha;
    this.shadow(c, m.x, m.y, def.r * sc * (floaty ? 0.8 : 1));
    if (elite) { c.strokeStyle = 'rgba(255,210,80,0.7)'; c.lineWidth = 3; c.beginPath(); c.ellipse(m.x, m.y, def.r * sc + 6, (def.r * sc + 6) * 0.4, 0, 0, Math.PI * 2); c.stroke(); }
    const g = GLOW[m.t]; if (g && !this.low) { c.globalCompositeOperation = 'lighter'; const gr = this.spr.glow(g + '66', 36); const R = def.r * sc * 2.4; c.drawImage(gr.cv, m.x - R, m.y - bob - def.r * sc - R, R * 2, R * 2); c.globalCompositeOperation = 'source-over'; }
    const base = this.spr.monster(def.key); const flash = (m.f & MF.HIT) !== 0 && m.dieT <= 0;
    const s = flash ? this.spr.flash(base, 'mon:' + def.key) : base;
    const squash = dash ? 1.12 : wind ? 0.92 : 1;
    c.save(); c.translate(m.x + jitter, m.y - bob); c.scale(((m.f & MF.LEFT) ? -1 : 1) * sc * squash, sc / squash);
    c.drawImage(s.cv, -s.ox, -s.oy, s.w, s.h);
    if (m.f & MF.SLOW) { c.globalCompositeOperation = 'source-atop'; }
    c.restore();
    if (m.f & MF.SLOW) { c.fillStyle = 'rgba(160,220,255,0.9)'; for (let i = 0; i < 3; i++) { const a = this.t * 2 + i * 2.1; c.fillRect(m.x + Math.cos(a) * def.r - 1.5, m.y - def.r - bob + Math.sin(a) * 6 - 1.5, 3, 3); } }
    if (wind && !boss) { c.fillStyle = '#ff4a4a'; c.font = '900 18px system-ui'; c.textAlign = 'center'; c.fillText('!', m.x, m.y - s.oy * sc - 6); }
    // small HP bar when damaged
    if (!boss && m.hp < 255 && m.dieT <= 0) { const w = Math.max(24, def.r * 2 * sc), y = m.y - s.oy * sc - bob - 4; c.fillStyle = 'rgba(10,8,20,0.75)'; c.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 5); c.fillStyle = elite ? '#ffc53d' : '#ff5a5a'; c.fillRect(m.x - w / 2, y, w * (m.hp / 255), 3); }
    c.globalAlpha = 1;
  }

  private drawLabels(c: Ctx, v: View): void {
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    for (const n of this.map.npcs) {
      if (Math.abs(n.x - this.camX) > 700 || Math.abs(n.y - this.camY) > 500) continue;
      c.font = '700 11px system-ui'; c.lineWidth = 3; c.strokeStyle = 'rgba(10,8,20,0.8)'; c.strokeText(n.title, n.x, n.y - 62); c.fillStyle = '#ffe08a'; c.fillText(n.title, n.x, n.y - 62);
    }
    for (const p of v.players) {
      const r = v.roster.get(p.id); if (!r) continue; const me = p.id === v.myId; const y = p.y - 60;
      if (this.showNames || me || r.bot === false) {
        const label = `Lv${r.level} ${r.name}`; c.font = `${me ? 800 : 700} 12px system-ui`; c.lineWidth = 3.5; c.strokeStyle = 'rgba(10,8,20,0.85)'; c.strokeText(label, p.x, y);
        c.fillStyle = me ? '#ffffff' : r.bot ? '#bfe6ff' : CLASSES[r.cls].color; c.fillText(label, p.x, y);
        if (r.bot) { const w = c.measureText(label).width; c.fillStyle = '#4a6ab8'; c.beginPath(); c.roundRect(p.x + w / 2 + 3, y - 10, 18, 12, 3); c.fill(); c.fillStyle = '#fff'; c.font = '800 9px system-ui'; c.fillText('AI', p.x + w / 2 + 12, y - 1); }
      }
      if (!(p.f & PF.DOWN)) { const w = 34; c.fillStyle = 'rgba(10,8,20,0.75)'; c.fillRect(p.x - w / 2 - 1, y + 4, w + 2, 5); c.fillStyle = me ? '#6dff8a' : '#5ad2ff'; c.fillRect(p.x - w / 2, y + 5, w * (p.hp / 255), 3); }
      if (p.bubble && p.bubble.until > performance.now()) {
        const txt = p.bubble.text; c.font = '700 13px system-ui'; const w = Math.min(180, c.measureText(txt).width + 16);
        c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.roundRect(p.x - w / 2, y - 34, w, 24, 10); c.fill(); c.beginPath(); c.moveTo(p.x - 5, y - 10); c.lineTo(p.x, y - 4); c.lineTo(p.x + 5, y - 10); c.fill();
        c.fillStyle = '#1b1426'; c.fillText(txt.length > 22 ? txt.slice(0, 21) + '…' : txt, p.x, y - 17);
      }
    }
  }

  private darkness(v: View): number { const z = [0.32, 0.5, 0.56, 0.62, 0.48, 0.55][v.zone] ?? 0.5; this.dark += (z - this.dark) * 0.02; return this.dark; }
  private drawLighting(v: View, x0: number, y0: number): void {
    const lc = this.lc, L = this.lightCv; const k = 0.25 * this.zoom; // world → light canvas
    lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, L.width, L.height);
    const d = this.darkness(v); lc.fillStyle = v.bloodMoon ? `rgba(30,4,16,${d})` : `rgba(6,8,30,${d})`; lc.fillRect(0, 0, L.width, L.height);
    lc.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a = 1) => { const lx = (x - x0) * k, ly = (y - y0) * k, lr = r * k; if (lx < -lr || ly < -lr || lx > L.width + lr || ly > L.height + lr) return; const g = lc.createRadialGradient(lx, ly, 0, lx, ly, lr); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lc.fillStyle = g; lc.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); };
    for (const p of v.players) hole(p.x, p.y - 16, p.id === v.myId ? 300 : 190, p.id === v.myId ? 0.95 : 0.7);
    for (const m of v.mons) if (GLOW[m.t]) hole(m.x, m.y - 10, MONSTERS[m.t].beh === 'boss' ? 220 : 70, 0.6);
    for (const o of this.objs) if (o.light) hole(o.x, o.y - 30, 150, 0.8);
    for (const p of this.map.props) { if (p.k === 'moontree') hole(p.x * TILE + TILE, p.y * TILE, 460, 1); else if (p.k === 'shrine') hole(p.x * TILE + 16, p.y * TILE, 160, 0.85); else if (p.k === 'house') hole(p.x * TILE + p.w * 16, p.y * TILE + p.h * 32, 110, 0.5); else if (p.k === 'altar') hole(p.x * TILE, p.y * TILE, 260, 0.6); }
    for (const n of this.map.npcs) hole(n.x, n.y - 20, 120, 0.7);
    for (const f of this.fx.parts) if (f.add && f.size > 3) hole(f.x, f.y, f.size * 8, 0.35);
    const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true;
    c.drawImage(L, 0, 0, L.width, L.height, 0, 0, L.width * 4 * this.dpr, L.height * 4 * this.dpr);
  }
}
