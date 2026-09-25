// Main renderer: isometric floor/walls, depth-sorted props & actors, darkness with light sources,
// ground item labels, floating text, hover picking and the automap.
import { CLASSES } from '../data/classes';
import { BASE_BY_ID, RARITY_COLOR } from '../data/items';
import { MONSTERS } from '../data/monsters';
import { SHRINES, ZONES } from '../data/zones';
import type { Game } from '../sim/game';
import { T_DOWN, T_FLOOR, T_LAVA, T_UP, T_WALL, T_WATER, type Drop, type GEvent, type Hero, type Monster, type Npc, type Prop, type Proj, type World } from '../sim/types';
import { drawCreature, monsterLook, npcLook, type Look, type Pose, type WeaponKind } from './actors';
import { Fx } from './fx';
import { Camera, HALF_H, HALF_W, RX, TH, TW, WALL_H, screenDir, shade } from './iso';
import { drawProp, flame, TALL_PROPS } from './props';
import { S, zoneTex } from './textures';
import { itemIcon } from './icons';

export type Hover =
  | { kind: 'monster'; id: number; x: number; y: number }
  | { kind: 'npc'; id: number; x: number; y: number }
  | { kind: 'prop'; id: number; x: number; y: number }
  | { kind: 'drop'; id: number; x: number; y: number }
  | { kind: 'stairs'; id: number; x: number; y: number };

interface Drawable { d: number; f: () => void }

/** Characters are drawn a bit larger than the tile grid for readability (Diablo-like proportions). */
export const ACTOR_SCALE = 1.22;

const INTERACTIVE = new Set(['barrel', 'crate', 'chest', 'bigchest', 'sarco', 'shrine', 'waypoint', 'stash', 'portal', 'well']);

export function heroLook(h: Hero): Look {
  const b = (slot: keyof Hero['equip']) => { const it = h.equip[slot]; return it && it.req <= h.level ? BASE_BY_ID[it.base] : null; };
  const chest = b('chest'), head = b('head'), wpn = b('weapon'), off = b('offhand');
  const ct = chest ? chest.tier : -1;
  const armor = ['#6a4a2a', '#8a8f96', '#b0b4bc', '#4e525e', '#5a1a1a'];
  const wCat: Record<string, WeaponKind> = { sword: 'sword', axe: 'axe', mace: 'mace', sword2h: 'sword2h', axe2h: 'axe2h', bow: 'bow', staff: 'staff', wand: 'wand' };
  const wIt = h.equip.weapon;
  const glow = wIt?.rarity === 'unique' ? '#e0b050' : wIt?.rarity === 'rare' ? '#f0e070' : undefined;
  const common: Partial<Look> = {
    weapon: wpn ? wCat[wpn.cat] : 'none', wTier: wpn?.tier ?? 0, wGlow: glow,
    offhand: off ? (off.cat === 'shield' ? 'shield' : off.cat === 'quiver' ? 'quiver' : 'orb') : null, offTier: off?.tier ?? 0,
    helm: head ? Math.min(4, head.tier) : -1,
    offColor: off?.cat === 'orb' ? ['#80c0ff', '#a0a0ff', '#c080ff', '#ff80c0', '#ff6060'][off.tier] : undefined,
    boots: h.equip.boots ? '#3a2a1e' : undefined,
    trim: ct >= 3 ? '#d8b050' : undefined,
  };
  if (h.cls === 'warrior') return { skin: '#d8a888', hair: '#4a2a1a', body: ct >= 0 ? armor[ct] : '#7a5a3a', body2: '#4a3020', legs: ct >= 2 ? shade(armor[ct], -0.25) : '#4a3a2a', head: 'human', build: 1.18, ...common } as Look;
  if (h.cls === 'rogue') return { skin: '#e0b898', hair: '#a86a30', body: ct >= 0 ? shade(armor[ct], -0.1) : '#5a4a30', body2: '#3a2a1a', legs: '#3a3024', head: common.helm !== undefined && common.helm >= 0 ? 'human' : 'hood', robe: '#2e4a2a', cloak: '#2e4a2a', build: 0.95, ...common, eyes: undefined } as Look;
  const robe = ct >= 0 ? ['#2a3a7a', '#3a3a6a', '#4a4a8a', '#2a2a4a', '#4a1a2a'][ct] : '#2a3a7a';
  return { skin: '#e0b898', hair: '#1e1e2a', body: shade(robe, 0.1), legs: '#2a2a3a', head: 'human', robe, build: 0.95, ...common, trim: '#c8a860' } as Look;
}

export class Renderer {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D;
  cam = new Camera();
  fx = new Fx();
  dpr = 1;
  dark: HTMLCanvasElement; dc: CanvasRenderingContext2D;
  darkScale = 0.5;
  time = 0;
  shakeT = 0; shakeV = 0;
  hitFlash = new Map<number, number>();
  labels: { id: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  mouse = { x: -1, y: -1, inside: false };
  hover: Hover | null = null;
  showAll = false;
  lowFx = false;
  wallMask: { w: World; m: Uint8Array } | null = null;
  moveMarker: { x: number; y: number; t: number } | null = null;
  bossId = 0;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.c = cv.getContext('2d', { alpha: false })!;
    this.dark = document.createElement('canvas');
    this.dc = this.dark.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.cam.w = w; this.cam.h = h;
    this.cam.zoom = Math.max(0.62, Math.min(1.5, Math.max(w, h * 1.25) / 1280));
    this.dark.width = Math.ceil(w * this.darkScale); this.dark.height = Math.ceil(h * this.darkScale);
  }

  // ------------------------------------------------------------ events → visuals
  handle(events: GEvent[], g: Game): void {
    const fx = this.fx;
    for (const e of events) {
      switch (e.t) {
        case 'dmg': fx.dmg(e.x, e.y, e.v, e.kind, e.elem); break;
        case 'hit': {
          this.hitFlash.set(e.id, 0.14);
          const m = g.world.monsters.find((q) => q.id === e.id);
          if (m && !this.lowFx) {
            const t = MONSTERS[m.tpl];
            const col = t.undead ? '#d8d0bc' : t.art === 'fireSpirit' ? '#ffa040' : t.art === 'wraith' ? '#a0d0ff' : '#8a0a0a';
            fx.burst(m.x, m.y, 4, { color: col, kind: t.undead ? 'bone' : 'dot', size: 1.4, speed: 1.8, up: 50, grav: 180, life: 0.45, z: 22 });
          }
          break;
        }
        case 'shake': this.shakeT = 0.3; this.shakeV = Math.max(this.shakeV, e.v); break;
        case 'levelup': break;
        case 'boss': this.bossId = e.id; break;
        case 'itemDrop':
          if (e.rarity === 'unique' || e.rarity === 'rare') fx.effect('beam', e.x, e.y, 2.5, { c: RARITY_COLOR[e.rarity] });
          fx.burst(e.x, e.y, 8, { color: RARITY_COLOR[e.rarity], kind: 'star', life: 0.6, speed: 1.2, up: 60, grav: 90, size: 1.3, add: true });
          break;
        case 'fx': this.spawnFx(e, g); break;
      }
    }
  }

  private spawnFx(e: Extract<GEvent, { t: 'fx' }>, g: Game): void {
    const fx = this.fx;
    const low = this.lowFx;
    switch (e.kind) {
      case 'blood': fx.burst(e.x, e.y, e.n ?? 12, { color: '#8a0a0a', size: 1.6, speed: 2.5, up: 50, grav: 160, life: 0.7 }); fx.effect('scorch', e.x, e.y, 12, { r: 0.5 }); break;
      case 'bones': fx.burst(e.x, e.y, (e.n ?? 12) * 0.8, { color: '#d8d0bc', kind: 'bone', size: 1.8, speed: 2.8, up: 70, grav: 200, life: 0.9 }); break;
      case 'splinters': fx.burst(e.x, e.y, e.n ?? 12, { color: '#6a4a2a', kind: 'shard', size: 2, speed: 3, up: 80, grav: 220, life: 0.8 }); break;
      case 'explosion':
        fx.effect('explosion', e.x, e.y, 0.45, { r: e.r ?? 1.5 });
        fx.effect('scorch', e.x, e.y, 6, { r: (e.r ?? 1.5) * 0.7 });
        if (!low) fx.burst(e.x, e.y, 22, { color: '#ffb040', kind: 'ember', size: 1.8, speed: (e.r ?? 1.5) * 3, up: 90, grav: 120, life: 0.7, add: true });
        fx.burst(e.x, e.y, 8, { color: '#3a3430', kind: 'smoke', size: 5, speed: 1, up: 30, life: 1.1 });
        break;
      case 'frostburst': fx.effect('frostburst', e.x, e.y, 0.4, { r: e.r ?? 1 }); fx.burst(e.x, e.y, 12, { color: '#c0e8ff', kind: 'shard', size: 1.5, speed: 3, up: 60, grav: 150, life: 0.6 }); break;
      case 'burst': fx.effect('burst', e.x, e.y, 0.35, { r: e.r ?? 1 }); break;
      case 'impact': case 'spark': {
        const col = e.c === 'fireball' || e.c === 'firebolt' || e.c === 'spit' ? '#ffa040' : e.c === 'coldbolt' || e.c === 'frost' ? '#a0e0ff' : e.c === 'bolt' ? '#c0a0ff' : e.c === 'lightning' || e.c === 'spark' ? '#ffff90' : e.c === 'blood' ? '#ff4060' : '#e8e0c8';
        fx.burst(e.x, e.y, low ? 3 : 6, { color: col, kind: 'spark', size: 1.4, speed: 2.5, up: 30, grav: 100, life: 0.35, add: true, z: 16 });
        break;
      }
      case 'cleave': fx.effect('cleave', e.x, e.y, 0.3, { r: e.r ?? 2.3 }); break;
      case 'warcry': fx.effect('warcry', e.x, e.y, 0.6, { r: e.r ?? 4 }); break;
      case 'stomp': fx.effect('stomp', e.x, e.y, 0.5, { r: e.r ?? 2.4 }); fx.burst(e.x, e.y, 14, { color: '#6a5a4a', kind: 'smoke', size: 4, speed: (e.r ?? 2) * 1.6, up: 10, life: 0.9 }); break;
      case 'bash': fx.effect('bash', e.x, e.y, 0.25); break;
      case 'berserk': fx.burst(e.x, e.y, 20, { color: '#ff3020', kind: 'ember', size: 2, speed: 2, up: 80, life: 0.8, add: true, z: 20 }); break;
      case 'frostnova': fx.effect('frostnova', e.x, e.y, 0.6, { r: e.r ?? 4.5 }); if (!low) fx.burst(e.x, e.y, 30, { color: '#d0f0ff', kind: 'shard', size: 1.5, speed: 8, up: 20, life: 0.5, z: 8 }); break;
      case 'lightning': fx.effect('lightning', e.x, e.y, 0.25, { pts: e.pts }); break;
      case 'teleport': fx.effect('teleport', e.x, e.y, 0.35); fx.burst(e.x, e.y, 12, { color: '#a0b0ff', kind: 'spark', size: 1.5, speed: 2, up: 60, life: 0.5, add: true, z: 20 }); break;
      case 'blink': fx.effect('blink', e.x, e.y, 0.35); break;
      case 'shadow': fx.add({ x: e.x, y: e.y, z: 18, color: '#304030', kind: 'smoke', size: 6, life: 0.35 }); break;
      case 'meteorFall': fx.effect('meteorFall', e.x, e.y, 0.9, { r: e.r ?? 2.8 }); break;
      case 'levelup': fx.effect('levelup', e.x, e.y, 1.5, { c: 'rgba(255,220,120,0.9)' }); fx.burst(e.x, e.y, 30, { color: '#ffe080', kind: 'star', size: 1.6, speed: 1.5, up: 120, grav: 20, life: 1.4, add: true }); break;
      case 'shrine': fx.effect('shrine', e.x, e.y, 1.2, { c: e.c ?? '#fff' }); fx.burst(e.x, e.y, 24, { color: e.c ?? '#fff', kind: 'star', size: 1.5, speed: 2, up: 100, grav: 30, life: 1.2, add: true, z: 20 }); break;
      case 'resurrect': fx.effect('resurrect', e.x, e.y, 0.8, { c: 'rgba(180,80,255,0.8)' }); break;
      case 'portalOpen': fx.effect('portalOpen', e.x, e.y, 1, { c: 'rgba(80,140,255,0.9)' }); break;
      case 'healPot': fx.burst(e.x, e.y, 14, { color: '#ff5060', kind: 'star', size: 1.3, speed: 0.8, up: 70, grav: 10, life: 0.9, add: true, z: 10 }); break;
      case 'manaPot': fx.burst(e.x, e.y, 14, { color: '#5080ff', kind: 'star', size: 1.3, speed: 0.8, up: 70, grav: 10, life: 0.9, add: true, z: 10 }); break;
      case 'rainTick': {
        for (let i = 0; i < (low ? 3 : 7); i++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (e.r ?? 2.5);
          fx.add({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, z: 120, vz: -600, color: '#d8d0c0', kind: 'shard', size: 1.2, life: 0.2 });
        }
        break;
      }
    }
    void g;
  }

  // ------------------------------------------------------------ helpers
  private wallVisible(w: World): Uint8Array {
    if (this.wallMask && this.wallMask.w === w) return this.wallMask.m;
    const m = new Uint8Array(w.w * w.h);
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      if (w.tiles[y * w.w + x] !== T_WALL) continue;
      let vis = false;
      for (let dy = -1; dy <= 1 && !vis; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h) continue;
        const t = w.tiles[ny * w.w + nx];
        if (t !== T_WALL && t !== 0) { vis = true; break; }
      }
      m[y * w.w + x] = vis || w.zone === 0 ? 1 : 0;
    }
    this.wallMask = { w, m };
    return m;
  }

  private pose(o: { anim: number; moving: boolean; facing: number }, extra: Partial<Pose>): Pose {
    const sd = screenDir(o.facing);
    return { t: this.time, walk: o.anim, moving: o.moving, atk: -1, cast: -1, hit: 0, dead: -1, flip: sd.dx < 0, back: sd.dy < -0.55, alpha: 1, frozen: false, chill: false, ...extra };
  }

  private drawActorAt(sx: number, sy: number, k: number, art: string, L: Look, p: Pose, lift = 0): void {
    const c = this.c;
    c.save();
    c.translate(sx, sy);
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.38)';
    c.beginPath(); c.ellipse(0, 0, 11 * k, 5 * k, 0, 0, Math.PI * 2); c.fill();
    c.translate(0, -lift * k);
    if (p.dead >= 0) {
      const fall = Math.min(1, p.dead / 0.35);
      c.rotate((p.flip ? 1 : -1) * fall * Math.PI / 2 * 0.95);
      c.globalAlpha = p.dead > 20 ? Math.max(0, 1 - (p.dead - 20) / 5) : 1;
    }
    c.scale(p.flip ? -k : k, k);
    if (p.alpha < 1) c.globalAlpha *= p.alpha;
    drawCreature(c, art, L, p);
    c.restore();
    if (p.hit > 0 || p.frozen || p.chill) {
      // cheap overlay glow at the actor position
      c.save(); c.globalCompositeOperation = 'lighter';
      const col = p.frozen ? 'rgba(120,200,255,0.55)' : p.chill ? 'rgba(90,160,255,0.3)' : `rgba(255,255,255,${Math.min(0.6, p.hit * 4)})`;
      const g = c.createRadialGradient(sx, sy - 22 * k, 0, sx, sy - 22 * k, 22 * k);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 22 * k, 16 * k, 26 * k, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  // ------------------------------------------------------------ frame
  render(g: Game, dt: number): void {
    this.time += dt;
    const c = this.c, cam = this.cam, w = g.world, h = g.hero, z = cam.zoom;
    const zone = ZONES[w.zone];
    const tex = zoneTex(w.zone);
    this.fx.low = this.lowFx;
    this.fx.update(dt);
    for (const [id, t] of this.hitFlash) { if (t - dt <= 0) this.hitFlash.delete(id); else this.hitFlash.set(id, t - dt); }
    if (this.moveMarker) { this.moveMarker.t -= dt; if (this.moveMarker.t <= 0) this.moveMarker = null; }
    // camera
    const k = Math.min(1, dt * 12);
    if (Math.hypot(cam.x - h.x, cam.y - h.y) > 8) { cam.x = h.x; cam.y = h.y; }
    cam.x += (h.x - cam.x) * k; cam.y += (h.y - cam.y) * k;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeV * 7 * (this.shakeT / 0.3);
      cam.sx = (Math.random() - 0.5) * s; cam.sy = (Math.random() - 0.5) * s;
      if (this.shakeT <= 0) { this.shakeV = 0; cam.sx = 0; cam.sy = 0; }
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = zone.fog; c.fillRect(0, 0, cam.w, cam.h);
    const b = cam.bounds(2);
    const x0 = Math.max(0, b.x0), y0 = Math.max(0, b.y0), x1 = Math.min(w.w - 1, b.x1), y1 = Math.min(w.h - 1, b.y1);
    const tw = TW * z, th = TH * z;
    const onScreen = (sx: number, sy: number, m = 80) => sx > -m && sy > -m * 2 && sx < cam.w + m && sy < cam.h + m;
    // ---------------- floor
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w.w + x, t = w.tiles[i];
        if (t === 0 || t === T_WALL) continue;
        const sx = cam.sxOf(x, y), sy = cam.syOf(x, y);
        if (!onScreen(sx, sy)) continue;
        let img: HTMLCanvasElement;
        const v = w.vari[i];
        if (t === T_UP) img = tex.up;
        else if (t === T_DOWN) img = tex.down;
        else if (t === T_LAVA || t === T_WATER) img = tex.lava[v % 3];
        else if (w.zone === 0) img = v >= 200 ? tex.extra.dirt[v % 4] : v >= 180 ? tex.extra.flag[v % 4] : tex.floors[v % tex.floors.length];
        else img = tex.floors[v % tex.floors.length];
        c.drawImage(img, sx - tw / 2, sy, tw, th);
        if (t === T_LAVA) {
          const pulse = 0.18 + 0.14 * Math.sin(this.time * 2 + x * 0.7 + y * 0.9);
          c.globalAlpha = pulse; c.globalCompositeOperation = 'lighter';
          c.drawImage(img, sx - tw / 2, sy, tw, th);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        }
        if (t === T_DOWN && w.downSealed) {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 3);
          c.strokeStyle = '#ff3020'; c.lineWidth = 2 * z;
          c.beginPath(); c.ellipse(sx, sy + th / 2, tw * 0.35, th * 0.35, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        }
      }
    }
    // ---------------- decals
    this.drawDecals(g, x0, y0, x1, y1);
    // ---------------- ground areas + effects
    this.drawAreas(g);
    this.fx.drawGround(c, cam);
    if (this.moveMarker) {
      const m = this.moveMarker; const sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y);
      c.save(); c.globalAlpha = m.t / 0.5; c.strokeStyle = '#e0c070'; c.lineWidth = 1.5 * z;
      const r = (1 - m.t / 0.5) * 10 + 6;
      c.beginPath(); c.ellipse(sx, sy, r * z, r * 0.5 * z, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    // ---------------- corpses (flat, before standing actors)
    for (const m of w.monsters) {
      if (!m.dead || m.deadT > 25) continue;
      if (m.x < x0 - 2 || m.x > x1 + 2 || m.y < y0 - 2 || m.y > y1 + 2) continue;
      this.drawMonster(g, m);
    }
    // ---------------- drops (flat)
    for (const d of w.drops) this.drawDrop(d);
    // ---------------- depth-sorted pass
    const list: Drawable[] = [];
    const wm = this.wallVisible(w);
    const hx = h.x, hy = h.y;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w.w + x;
        if (w.tiles[i] !== T_WALL || !wm[i]) continue;
        const sx = cam.sxOf(x, y), sy = cam.syOf(x, y);
        if (!onScreen(sx, sy, 140)) continue;
        const v = w.vari[i];
        let img: HTMLCanvasElement;
        if (w.zone === 0) img = v >= 200 ? tex.extra.palisade[v % 2] : v >= 100 ? tex.extra.stone[v % 3] : tex.extra.house[v % 3];
        else img = tex.walls[v % tex.walls.length];
        const depth = x + y + 1;
        // fade walls standing between the camera and the hero
        const dd = depth - (hx + hy);
        const lat = (x + 0.5 - (y + 0.5)) - (hx - hy);
        const fade = dd > 0.2 && dd < 4.2 && Math.abs(lat) < 3.2 && x + 1 > hx - 0.3 && y + 1 > hy - 0.3;
        list.push({ d: depth, f: () => {
          const ih = img.height / S;
          if (fade) c.globalAlpha = 0.28;
          c.drawImage(img, sx - tw / 2, sy - (ih - TH) * z, tw, ih * z);
          c.globalAlpha = 1;
        } });
      }
    }
    for (const p of w.props) {
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      let px = p.x, py = p.y, depth = p.x + p.y;
      if (p.kind === 'torch') {
        const tx = Math.floor(p.x), ty = Math.floor(p.y);
        if (p.face === 0) { px = tx + 0.5; py = ty + 1.02; } else { px = tx + 1.02; py = ty + 0.5; }
        depth = tx + ty + 1.25;
      }
      const sx = cam.sxOf(px, py), sy = cam.syOf(px, py) - (p.kind === 'torch' ? WALL_H * 0.55 * z : 0);
      if (!onScreen(sx, sy, 120)) continue;
      const tall = TALL_PROPS.has(p.kind);
      const fade = tall && depth > hx + hy + 0.3 && depth < hx + hy + 3.5 && Math.abs((p.x - p.y) - (hx - hy)) < 2;
      const hov = this.hover?.kind === 'prop' && this.hover.id === p.id;
      list.push({ d: depth, f: () => {
        c.save(); c.translate(sx, sy); c.scale(z, z);
        if (fade) c.globalAlpha = 0.35;
        drawProp(c, p, this.time, w.zone);
        if (hov && !p.used) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; drawProp(c, p, this.time, w.zone); }
        c.restore();
      } });
    }
    for (const n of w.npcs) list.push({ d: n.x + n.y, f: () => this.drawNpc(n) });
    for (const m of w.monsters) {
      if (m.dead) continue;
      if (m.x < x0 - 2 || m.x > x1 + 2 || m.y < y0 - 2 || m.y > y1 + 2) continue;
      list.push({ d: m.x + m.y, f: () => this.drawMonster(g, m) });
    }
    list.push({ d: h.x + h.y, f: () => this.drawHero(g) });
    for (const p of w.projs) list.push({ d: p.x + p.y + 0.01, f: () => this.drawProj(p) });
    list.sort((a, b2) => a.d - b2.d);
    for (const it of list) it.f();
    // ---------------- air effects & particles
    this.fx.drawAir(c, cam);
    this.fx.drawParticles(c, cam);
    this.spawnAmbient(g, x0, y0, x1, y1);
    // ---------------- darkness
    this.drawDarkness(g, x0, y0, x1, y1);
    // ---------------- hero silhouette through darkness/walls (hero always readable)
    // ---------------- labels, texts, bars
    this.drawLabels(g);
    this.drawOverheadBars(g);
    this.fx.drawTexts(c, cam);
    this.updateHover(g);
  }

  private drawDecals(g: Game, x0: number, y0: number, x1: number, y1: number): void {
    const c = this.c, cam = this.cam, z = cam.zoom, w = g.world;
    for (const d of w.decals) {
      if (d.x < x0 - 3 || d.x > x1 + 3 || d.y < y0 - 3 || d.y > y1 + 3) continue;
      const sx = cam.sxOf(d.x, d.y), sy = cam.syOf(d.x, d.y);
      switch (d.kind) {
        case 'rug': {
          const ww = d.w ?? 1, hh = d.h ?? 1;
          const p = (u: number, v: number): [number, number] => [cam.sxOf(d.x + u, d.y + v), cam.syOf(d.x + u, d.y + v)];
          c.fillStyle = ['#5a1414', '#3a1440', '#14304a'][d.v % 3];
          c.beginPath(); c.moveTo(...p(0, 0)); c.lineTo(...p(ww, 0)); c.lineTo(...p(ww, hh)); c.lineTo(...p(0, hh)); c.closePath(); c.fill();
          c.strokeStyle = '#b08a3a'; c.lineWidth = 1.5 * z;
          c.beginPath(); c.moveTo(...p(0.15, 0.15)); c.lineTo(...p(ww - 0.15, 0.15)); c.lineTo(...p(ww - 0.15, hh - 0.15)); c.lineTo(...p(0.15, hh - 0.15)); c.closePath(); c.stroke();
          break;
        }
        case 'pentagram': {
          const r = (d.w ?? 3) / 2;
          const cx = d.x + r, cy = d.y + r;
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(255,50,20,${0.45 + 0.2 * Math.sin(this.time * 1.5)})`; c.lineWidth = 2 * z;
          const pt = (a: number): [number, number] => [cam.sxOf(cx + Math.cos(a) * r, cy + Math.sin(a) * r), cam.syOf(cx + Math.cos(a) * r, cy + Math.sin(a) * r)];
          c.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5; const q = pt(a); if (i === 0) c.moveTo(...q); else c.lineTo(...q); } c.stroke();
          c.beginPath(); c.ellipse(cam.sxOf(cx, cy), cam.syOf(cx, cy), r * RX * z, r * RX * z * 0.5, 0, 0, Math.PI * 2); c.stroke();
          c.restore();
          break;
        }
        case 'blood': c.fillStyle = 'rgba(90,6,6,0.55)'; c.beginPath(); c.ellipse(sx, sy, (6 + d.v * 3) * z, (3 + d.v * 1.5) * z, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(sx + 7 * z, sy + 2 * z, 2.5 * z, 1.3 * z, 0, 0, Math.PI * 2); c.fill(); break;
        case 'bones': c.strokeStyle = 'rgba(210,200,180,0.7)'; c.lineWidth = 1.6 * z; c.beginPath(); c.moveTo(sx - 6 * z, sy); c.lineTo(sx + 5 * z, sy - 2 * z); c.moveTo(sx - 2 * z, sy - 3 * z); c.lineTo(sx + 2 * z, sy + 3 * z); c.stroke(); break;
        case 'skull': c.fillStyle = 'rgba(210,200,180,0.8)'; c.beginPath(); c.arc(sx, sy - 2 * z, 2.8 * z, 0, Math.PI * 2); c.fill(); c.fillStyle = '#100a08'; c.fillRect(sx - 1.4 * z, sy - 2.5 * z, 1 * z, 1 * z); c.fillRect(sx + 0.5 * z, sy - 2.5 * z, 1 * z, 1 * z); break;
        case 'crack': c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1 * z; c.beginPath(); c.moveTo(sx - 8 * z, sy); c.lineTo(sx - 2 * z, sy + 2 * z); c.lineTo(sx + 3 * z, sy - 1 * z); c.lineTo(sx + 9 * z, sy + 1 * z); c.stroke(); break;
        case 'rubble': c.fillStyle = 'rgba(90,84,76,0.9)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(sx + (i - 1.5) * 4 * z, sy + ((i * 7) % 3 - 1) * z, 2 * z, 1.2 * z, 0, 0, Math.PI * 2); c.fill(); } break;
        case 'moss': c.fillStyle = 'rgba(60,80,40,0.45)'; c.beginPath(); c.ellipse(sx, sy, 10 * z, 5 * z, 0, 0, Math.PI * 2); c.fill(); break;
        case 'web': c.strokeStyle = 'rgba(220,220,220,0.35)'; c.lineWidth = 0.6 * z; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 14 * z, sy + Math.sin(a) * 7 * z); c.stroke(); } for (const r of [5, 10]) { c.beginPath(); c.ellipse(sx, sy, r * z, r * 0.5 * z, 0, 0, Math.PI * 2); c.stroke(); } break;
        case 'grass': c.strokeStyle = ['#4a6030', '#3a5028', '#5a7038', '#2e4020'][d.v]; c.lineWidth = 1 * z; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(sx + (i - 2) * 2 * z, sy); c.lineTo(sx + (i - 2) * 2.6 * z, sy - (4 + (i % 3) * 2) * z); c.stroke(); } break;
        case 'flowers': c.fillStyle = ['#d0d060', '#c060a0', '#e0e0e0', '#6090e0'][d.v]; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx + (i - 1) * 4 * z, sy - (i % 2) * 2 * z, 1.3 * z, 0, Math.PI * 2); c.fill(); } break;
      }
    }
  }

  private drawAreas(g: Game): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    for (const a of g.world.areas) {
      const sx = cam.sxOf(a.x, a.y), sy = cam.syOf(a.x, a.y);
      const rx = a.r * RX * z;
      switch (a.kind) {
        case 'telegraph': case 'meteor': case 'stomp': {
          if (a.kind !== 'telegraph' && a.delay <= 0) break;
          if (a.kind === 'meteor' && a.side === 'hero') break;
          const k = a.kind === 'telegraph' ? Math.min(1, a.t / a.dur) : 0.5;
          const pulse = 0.5 + 0.5 * Math.sin(this.time * 16);
          c.save();
          c.globalAlpha = 0.18 + 0.15 * pulse;
          c.fillStyle = a.data.fire ? '#ff5020' : '#ff2010';
          c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.9; c.strokeStyle = '#ff6030'; c.lineWidth = 1.6 * z;
          c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.ellipse(sx, sy, rx * k, rx * 0.5 * k, 0, 0, Math.PI * 2); c.stroke();
          c.restore();
          break;
        }
        case 'burn': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const g2 = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
          g2.addColorStop(0, `rgba(255,120,30,${0.35 * (1 - a.t / a.dur)})`); g2.addColorStop(1, 'rgba(255,40,0,0)');
          c.fillStyle = g2; c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.fill(); c.restore();
          if (Math.random() < 0.5) this.fx.add({ x: a.x + (Math.random() - 0.5) * a.r * 1.4, y: a.y + (Math.random() - 0.5) * a.r * 1.4, z: 2, vz: 40, color: '#ffa040', kind: 'ember', size: 1.6, life: 0.6, add: true });
          break;
        }
        case 'rain': {
          c.save(); c.globalAlpha = 0.25; c.strokeStyle = '#e0d8c0'; c.lineWidth = 1 * z;
          c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, Math.PI * 2); c.stroke(); c.restore();
          break;
        }
        case 'nova': case 'bossNova': case 'lightningRing': case 'firewave': {
          const k = Math.min(1, a.t / a.dur);
          const rr = rx * k;
          const col = a.kind === 'lightningRing' ? '255,255,140' : a.kind === 'firewave' ? '255,120,30' : a.data.cold ? '150,210,255' : '255,160,80';
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(${col},${0.9 * (1 - k * 0.5)})`; c.lineWidth = (a.kind === 'nova' ? 8 : 12) * z;
          c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, Math.PI * 2); c.stroke();
          c.lineWidth = 3 * z; c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; c.stroke();
          c.restore();
          if (a.kind === 'firewave' && Math.random() < 0.8) { const ang = Math.random() * Math.PI * 2; this.fx.add({ x: a.x + Math.cos(ang) * a.r * k, y: a.y + Math.sin(ang) * a.r * k, z: 4, vz: 60, color: '#ffb040', kind: 'ember', size: 2, life: 0.5, add: true }); }
          break;
        }
      }
    }
  }

  private drawDrop(d: Drop): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(d.x, d.y), sy = cam.syOf(d.x, d.y);
    if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40) return;
    const pop = Math.min(1, d.t / 0.35);
    const jump = Math.sin(pop * Math.PI) * 22 * z;
    if (d.gold) {
      c.fillStyle = '#b08a20';
      const n = Math.min(6, 1 + Math.floor(Math.log2(d.gold + 1) / 1.5));
      for (let i = 0; i < n; i++) { c.beginPath(); c.ellipse(sx + ((i * 5) % 9 - 4) * z, sy - jump + ((i * 3) % 4 - 2) * z, 2.6 * z, 1.4 * z, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#ffe070'; c.beginPath(); c.ellipse(sx - 1 * z, sy - jump - 1 * z, 1.4 * z, 0.7 * z, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    if (d.pot) {
      const col = d.pot === 'hp' ? '#d02020' : d.pot === 'mp' ? '#2040d0' : '#e0d0a0';
      c.save(); c.translate(sx, sy - jump); c.scale(z, z);
      if (d.pot === 'scroll') { c.fillStyle = col; c.fillRect(-5, -4, 10, 5); c.fillStyle = '#a08050'; c.fillRect(-6, -5, 2, 7); c.fillRect(4, -5, 2, 7); }
      else { c.fillStyle = col; c.beginPath(); c.arc(0, -3, 3.8, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d0c8b0'; c.fillRect(-1.2, -9, 2.4, 3); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-2, -5, 1.2, 1.5); }
      c.restore();
      return;
    }
    if (d.item) {
      const icon = itemIcon(d.item);
      const s = 18 * z;
      c.save();
      c.translate(sx, sy - jump);
      c.rotate(-0.5);
      c.drawImage(icon, -s / 2, -s / 2 - 2 * z, s, s);
      c.restore();
    }
  }

  private drawHero(g: Game): void {
    const h = g.hero, cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(h.x, h.y), sy = cam.syOf(h.x, h.y);
    const a = h.act;
    const L = heroLook(h);
    const basic = CLASSES[h.cls].basic;
    let atk = -1, cast = -1;
    if (a) {
      const p = a.t / a.dur;
      const spell = h.cls === 'sorcerer' && a.skill !== basic;
      if (a.kind === 'leap') atk = -1;
      else if (spell || a.skill === 'warcry' || a.skill === 'berserk') cast = p;
      else atk = p;
    }
    const p = this.pose(h, { atk, cast, hit: h.hitT > 0 ? h.hitT : 0, dead: h.dead ? h.deadT : -1, block: h.blockT > 0 ? 1 : 0, chill: h.chillT > 0, alpha: h.invulnT > 0 && a?.kind === 'dash' ? 0.35 : 1 });
    if (a?.kind === 'channel') { p.atk = (a.t * 7) % 1; }
    let lift = 0;
    if (a?.kind === 'leap') lift = Math.sin((a.t / a.dur) * Math.PI) * 40;
    // selection ring for the hero
    const c = this.c;
    if (h.buffs.some((b) => b.id === 'berserk')) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,40,20,0.6)'; c.lineWidth = 2 * z; c.beginPath(); c.ellipse(sx, sy, 16 * z, 8 * z, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    if (h.buffs.some((b) => b.id === 'warcry')) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,200,80,0.45)'; c.lineWidth = 1.5 * z; c.beginPath(); c.ellipse(sx, sy, 19 * z, 9.5 * z, 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
    this.drawActorAt(sx, sy, z * ACTOR_SCALE, 'biped', L, p, lift);
  }

  private drawNpc(n: Npc): void {
    const cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(n.x, n.y), sy = cam.syOf(n.x, n.y);
    if (sx < -60 || sy < -80 || sx > cam.w + 60 || sy > cam.h + 60) return;
    const p = this.pose({ anim: n.anim, moving: false, facing: n.facing }, {});
    const hov = this.hover?.kind === 'npc' && this.hover.id === n.id;
    this.drawActorAt(sx, sy, z * ACTOR_SCALE, 'biped', npcLook(n.kind), p);
    const c = this.c;
    c.font = `bold ${Math.round(12 * Math.max(0.85, z))}px "Nanum Myeongjo", Georgia, serif`; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(n.name, sx, sy - 74 * z);
    c.fillStyle = hov ? '#ffffff' : '#e8d8a0'; c.fillText(n.name, sx, sy - 74 * z);
  }

  private drawMonster(g: Game, m: Monster): void {
    const cam = this.cam, z = cam.zoom;
    const t = MONSTERS[m.tpl];
    const sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y);
    if (sx < -80 || sy < -120 || sx > cam.w + 80 || sy > cam.h + 80) return;
    const L = monsterLook(t.art, t.color, t.color2);
    if (m.rank === 'champion') L.glow = L.glow ?? '#6080ff';
    const a = m.act;
    let atk = -1, cast = -1;
    if (a) { const p = Math.min(1, a.t / a.dur); if (a.kind === 'cast' || a.kind === 'shoot' && (L.weapon === 'staff' || L.weapon === 'none')) cast = p; else atk = p; }
    const p = this.pose(m, { atk, cast, hit: this.hitFlash.get(m.id) ?? 0, dead: m.dead ? m.deadT : -1, frozen: m.freezeT > 0, chill: m.chillT > 0, alpha: m.alpha });
    if (m.freezeT > 0) p.moving = false;
    const scale = t.scale * ACTOR_SCALE * (m.rank === 'champion' || m.rank === 'unique' ? 1.12 : 1);
    const lift = t.flying && !m.dead ? 6 : 0;
    const c = this.c;
    // elite aura
    if (!m.dead && (m.rank === 'unique' || m.rank === 'champion' || m.rank === 'boss')) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const col = m.rank === 'unique' ? '255,200,80' : m.rank === 'boss' ? '255,60,30' : '90,130,255';
      const g2 = c.createRadialGradient(sx, sy, 0, sx, sy, 22 * z * scale);
      g2.addColorStop(0, `rgba(${col},0.35)`); g2.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g2; c.beginPath(); c.ellipse(sx, sy, 22 * z * scale, 11 * z * scale, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (!m.dead && this.hover?.kind === 'monster' && this.hover.id === m.id) {
      c.save(); c.strokeStyle = 'rgba(255,60,40,0.8)'; c.lineWidth = 1.5 * z; c.beginPath(); c.ellipse(sx, sy, 14 * z * scale, 7 * z * scale, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    if (m.poison && !m.dead) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#50c030'; c.beginPath(); c.ellipse(sx, sy - 16 * z * scale, 12 * z * scale, 18 * z * scale, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    this.drawActorAt(sx, sy, z * scale, t.art, L, p, lift);
    if (m.stunT > 0 && !m.dead) {
      c.save(); c.fillStyle = '#ffe060';
      for (let i = 0; i < 3; i++) { const a2 = this.time * 5 + (i * Math.PI * 2) / 3; c.beginPath(); c.arc(sx + Math.cos(a2) * 8 * z, sy - (48 * scale + 4) * z + Math.sin(a2) * 3 * z, 1.8 * z, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    void g;
  }

  private drawProj(p: Proj): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(p.x, p.y), sy = cam.syOf(p.x, p.y) - 18 * z;
    const vx = cam.sxOf(p.x + p.vx, p.y + p.vy) - cam.sxOf(p.x, p.y), vy = cam.syOf(p.x + p.vx, p.y + p.vy) - cam.syOf(p.x, p.y);
    const ang = Math.atan2(vy, vx);
    c.save();
    c.translate(sx, sy);
    switch (p.kind) {
      case 'arrow': case 'explode': {
        c.rotate(ang); c.scale(z, z);
        c.strokeStyle = '#8a6a40'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-12, 0); c.lineTo(6, 0); c.stroke();
        c.fillStyle = p.kind === 'explode' ? '#ff8030' : '#c8c8c8'; c.beginPath(); c.moveTo(6, -2); c.lineTo(10, 0); c.lineTo(6, 2); c.fill();
        c.fillStyle = '#e0e0d0'; c.beginPath(); c.moveTo(-12, 0); c.lineTo(-15, -2.5); c.lineTo(-10, 0); c.lineTo(-15, 2.5); c.fill();
        if (p.kind === 'explode') { flame(c, 8, 1, 0.5, this.time, p.id); }
        break;
      }
      case 'bolt': case 'orb': {
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 10 * z);
        g.addColorStop(0, 'rgba(240,220,255,1)'); g.addColorStop(0.4, 'rgba(170,120,255,0.8)'); g.addColorStop(1, 'rgba(90,40,200,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 10 * z, 0, Math.PI * 2); c.fill();
        if (Math.random() < 0.6) this.fx.add({ x: p.x, y: p.y, z: 18, color: '#b090ff', kind: 'spark', size: 1.4, life: 0.25, add: true });
        break;
      }
      case 'fireball': case 'firebolt': case 'meteor': {
        const r = (p.kind === 'fireball' ? 12 : 7) * z;
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.35, 'rgba(255,160,50,0.95)'); g.addColorStop(1, 'rgba(200,40,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
        if (Math.random() < 0.9) this.fx.add({ x: p.x, y: p.y, z: 18, vz: 20, color: Math.random() < 0.5 ? '#ff9030' : '#ffd060', kind: 'ember', size: p.kind === 'fireball' ? 2.4 : 1.6, life: 0.35, add: true });
        break;
      }
      case 'coldbolt': case 'frost': {
        c.rotate(ang); c.scale(z, z);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(140,210,255,0.9)'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-4, -3); c.lineTo(-10, 0); c.lineTo(-4, 3); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.moveTo(6, 0); c.lineTo(-3, -1.2); c.lineTo(-3, 1.2); c.fill();
        break;
      }
      case 'bone': case 'skull': {
        c.rotate(this.time * 14); c.scale(z, z);
        c.fillStyle = '#e8e0cc'; c.fillRect(-6, -1.2, 12, 2.4); c.beginPath(); c.arc(-6, -1.5, 1.8, 0, 7); c.arc(-6, 1.5, 1.8, 0, 7); c.arc(6, -1.5, 1.8, 0, 7); c.arc(6, 1.5, 1.8, 0, 7); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(160,80,255,0.3)'; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill();
        break;
      }
      case 'spit': case 'poison': {
        c.scale(z, z);
        c.fillStyle = p.kind === 'poison' ? '#70d030' : '#ff8020';
        c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,200,80,0.4)'; c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fill();
        break;
      }
      case 'blood': case 'shadow': {
        c.rotate(this.time * 8); c.scale(z, z);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255,40,80,0.9)';
        c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 8; const a = (i / 10) * Math.PI * 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
        break;
      }
      case 'lightning': case 'spark': {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(255,255,160,0.95)'; c.lineWidth = 2 * z;
        c.beginPath(); c.moveTo(-8 * z, 0); for (let i = -2; i <= 2; i++) c.lineTo(i * 4 * z, (Math.random() - 0.5) * 8 * z); c.stroke();
        c.fillStyle = 'rgba(255,255,200,0.5)'; c.beginPath(); c.arc(0, 0, 6 * z, 0, 7); c.fill();
        break;
      }
    }
    c.restore();
  }

  private spawnAmbient(g: Game, x0: number, y0: number, x1: number, y1: number): void {
    const w = g.world;
    if (this.lowFx) return;
    for (const p of w.props) {
      if (p.used || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if ((p.kind === 'torch' || p.kind === 'brazier') && Math.random() < 0.06) this.fx.add({ x: p.x + (p.kind === 'torch' ? (p.face === 0 ? 0 : 0.5) : 0), y: p.y + (p.kind === 'torch' ? (p.face === 0 ? 0.5 : 0) : 0), z: p.kind === 'torch' ? 45 : 22, vz: 30, vx: (Math.random() - 0.5) * 0.3, color: '#ffb040', kind: 'ember', size: 1.2, life: 0.9, add: true });
      if (p.kind === 'lavavent' && Math.random() < 0.08) this.fx.add({ x: p.x, y: p.y, z: 2, vz: 25, color: '#403028', kind: 'smoke', size: 5, life: 1.6 });
      if (p.kind === 'portal' && Math.random() < 0.3) this.fx.add({ x: p.x + (Math.random() - 0.5) * 0.4, y: p.y + (Math.random() - 0.5) * 0.4, z: 10 + Math.random() * 30, vz: 20, color: '#90c0ff', kind: 'spark', size: 1.3, life: 0.6, add: true });
      if (p.kind === 'shrine' && Math.random() < 0.08) this.fx.add({ x: p.x, y: p.y, z: 30, vz: 15, vx: (Math.random() - 0.5) * 0.4, color: SHRINES[p.variant % SHRINES.length].color, kind: 'star', size: 1, life: 1, add: true });
    }
    if (w.zone >= 3) {
      // lava embers
      for (let k = 0; k < 2; k++) {
        const x = Math.floor(x0 + Math.random() * (x1 - x0)), y = Math.floor(y0 + Math.random() * (y1 - y0));
        if (w.tiles[y * w.w + x] === T_LAVA) this.fx.add({ x: x + Math.random(), y: y + Math.random(), z: 0, vz: 30 + Math.random() * 30, color: '#ff9030', kind: 'ember', size: 1.4, life: 1, add: true });
      }
    }
  }

  // ------------------------------------------------------------ lighting
  private drawDarkness(g: Game, x0: number, y0: number, x1: number, y1: number): void {
    const w = g.world, cam = this.cam, dc = this.dc, s = this.darkScale, z = cam.zoom;
    const zone = ZONES[w.zone];
    const W = this.dark.width, H = this.dark.height;
    dc.setTransform(1, 0, 0, 1, 0, 0);
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, W, H);
    dc.fillStyle = zone.fog; dc.globalAlpha = zone.darkness; dc.fillRect(0, 0, W, H);
    dc.globalAlpha = 1;
    dc.globalCompositeOperation = 'destination-out';
    const warm: { x: number; y: number; r: number; col: string; a: number }[] = [];
    const light = (wx: number, wy: number, r: number, strength = 1, lift = 0) => {
      const sx = cam.sxOf(wx, wy) * s, sy = (cam.syOf(wx, wy) - lift * z) * s;
      const rx = r * RX * z * s;
      if (sx < -rx || sy < -rx || sx > W + rx || sy > H + rx) return;
      dc.save(); dc.translate(sx, sy); dc.scale(1, 0.55);
      const gr = dc.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`); gr.addColorStop(0.55, `rgba(0,0,0,${strength * 0.75})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gr; dc.beginPath(); dc.arc(0, 0, rx, 0, Math.PI * 2); dc.fill();
      dc.restore();
    };
    const h = g.hero;
    light(h.x, h.y, h.st.light * (h.dead ? 0.5 : 1), 1);
    light(h.x, h.y, 2.2, 1);
    for (const p of w.props) {
      if (p.light <= 0 || p.x < x0 - 6 || p.x > x1 + 6 || p.y < y0 - 6 || p.y > y1 + 6) continue;
      if (p.used && p.kind === 'shrine') continue;
      const fl = p.kind === 'torch' || p.kind === 'brazier' || p.kind === 'candle' ? 1 + Math.sin(this.time * 9 + p.id) * 0.05 + Math.sin(this.time * 23 + p.id * 3) * 0.03 : 1;
      let px = p.x, py = p.y;
      if (p.kind === 'torch') { const tx = Math.floor(p.x), ty = Math.floor(p.y); if (p.face === 0) { px = tx + 0.5; py = ty + 1.6; } else { px = tx + 1.6; py = ty + 0.5; } }
      light(px, py, p.light * fl, 0.95);
      if (p.kind === 'torch' || p.kind === 'brazier' || p.kind === 'candle' || p.kind === 'lamp' || p.kind === 'lavavent') warm.push({ x: px, y: py, r: p.light * fl * 0.8, col: '255,140,50', a: 0.16 });
      if (p.kind === 'crystal') warm.push({ x: px, y: py, r: p.light, col: ['90,150,255', '170,100,255', '255,80,110'][p.variant % 3], a: 0.2 });
      if (p.kind === 'portal' || p.kind === 'waypoint') warm.push({ x: px, y: py, r: p.light, col: '80,140,255', a: 0.18 });
    }
    // lava glow
    let lavaN = 0;
    for (let y = y0; y <= y1 && lavaN < 70; y += 2) for (let x = x0; x <= x1 && lavaN < 70; x += 2) {
      if (w.tiles[y * w.w + x] === T_LAVA) { light(x + 0.5, y + 0.5, 2.6, 0.7); lavaN++; if (lavaN % 3 === 0) warm.push({ x: x + 0.5, y: y + 0.5, r: 2.5, col: '255,90,20', a: 0.12 }); }
    }
    for (const p of w.projs) {
      const r = p.kind === 'fireball' ? 3 : p.kind === 'arrow' ? 0 : 1.8;
      if (r > 0) { light(p.x, p.y, r, 0.8, 18); warm.push({ x: p.x, y: p.y, r: r * 0.7, col: p.kind === 'fireball' || p.kind === 'firebolt' ? '255,140,40' : p.kind === 'coldbolt' ? '120,190,255' : p.kind === 'bolt' ? '170,120,255' : '255,255,160', a: 0.2 }); }
    }
    for (const e of this.fx.effects) {
      const k = e.t / e.dur;
      if (e.kind === 'explosion') { light(e.x, e.y, e.r * 2.5 * (1 - k), 1); warm.push({ x: e.x, y: e.y, r: e.r * 2 * (1 - k), col: '255,150,50', a: 0.35 }); }
      if (e.kind === 'lightning' && e.pts) for (let i = 0; i + 1 < e.pts.length; i += 2) light(e.pts[i], e.pts[i + 1], 3 * (1 - k), 1, 18);
      if (e.kind === 'frostnova') light(e.x, e.y, e.r * (1 - k), 0.6);
      if (e.kind === 'beam') light(e.x, e.y, 1.5, 0.6);
      if (e.kind === 'levelup') light(e.x, e.y, 5 * (1 - k), 1);
    }
    for (const a of w.areas) {
      if (a.kind === 'burn' || a.kind === 'firewave' || a.kind === 'lightningRing') light(a.x, a.y, a.kind === 'burn' ? a.r * 1.3 : a.r * Math.min(1, a.t / a.dur), 0.6);
      if ((a.kind === 'telegraph' || a.kind === 'meteor') && a.side === 'mon') light(a.x, a.y, a.r * 1.2, 0.55);
    }
    for (const m of w.monsters) {
      if (m.dead) continue;
      const t = MONSTERS[m.tpl];
      if (t.art === 'fireSpirit' || t.art === 'ignira' || t.art === 'malegath' || t.art === 'hound') { light(m.x, m.y, t.art === 'hound' ? 1.6 : 3, 0.8); warm.push({ x: m.x, y: m.y, r: 2, col: '255,120,30', a: 0.18 }); }
    }
    dc.globalCompositeOperation = 'source-over';
    const c = this.c;
    c.drawImage(this.dark, 0, 0, cam.w, cam.h);
    // warm additive glows
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const l of warm) {
      const sx = cam.sxOf(l.x, l.y), sy = cam.syOf(l.x, l.y);
      const rx = l.r * RX * z;
      if (sx < -rx || sy < -rx || sx > cam.w + rx || sy > cam.h + rx) continue;
      c.save(); c.translate(sx, sy); c.scale(1, 0.55);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(${l.col},${l.a})`); gr.addColorStop(1, `rgba(${l.col},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.restore();
    // vignette
    const vg = c.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.35, cam.w / 2, cam.h / 2, Math.max(cam.w, cam.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg; c.fillRect(0, 0, cam.w, cam.h);
    // unique item beams drawn above darkness so they can be seen from afar
    for (const e of this.fx.effects) {
      if (e.kind !== 'beam') continue;
      const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y);
      const k = e.t / e.dur;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 2) * 0.8;
      const gr = c.createLinearGradient(sx, sy - 200 * z, sx, sy);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, e.c);
      c.fillStyle = gr; c.fillRect(sx - 5 * z, sy - 200 * z, 10 * z, 200 * z); c.restore();
    }
    void HALF_H; void HALF_W; void T_FLOOR;
  }

  // ------------------------------------------------------------ labels & bars
  private drawLabels(g: Game): void {
    const c = this.c, cam = this.cam, z = cam.zoom, h = g.hero;
    this.labels = [];
    const fs = Math.round(11.5 * Math.max(0.9, Math.min(1.2, z)));
    c.font = `${fs}px "Nanum Myeongjo", Georgia, serif`;
    c.textAlign = 'center';
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const drops = g.world.drops.filter((d) => d.item && Math.hypot(d.x - h.x, d.y - h.y) < 16).sort((a, b) => (a.y + a.x) - (b.y + b.x));
    for (const d of drops) {
      const it = d.item!;
      if (!this.showAll && it.rarity === 'normal' && Math.hypot(d.x - h.x, d.y - h.y) > 5 && !(this.hover?.kind === 'drop' && this.hover.id === d.id)) continue;
      const sx = cam.sxOf(d.x, d.y);
      let sy = cam.syOf(d.x, d.y) - 20 * z;
      const tw = c.measureText(it.name).width + 10;
      const lh = fs + 6;
      let box = { x0: sx - tw / 2, y0: sy - lh, x1: sx + tw / 2, y1: sy };
      for (let guard = 0; guard < 12 && placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0); guard++) {
        sy -= lh + 1; box = { x0: sx - tw / 2, y0: sy - lh, x1: sx + tw / 2, y1: sy };
      }
      placed.push(box);
      const hov = this.hover?.kind === 'drop' && this.hover.id === d.id;
      c.fillStyle = hov ? 'rgba(40,36,60,0.92)' : 'rgba(0,0,0,0.72)';
      c.fillRect(box.x0, box.y0, tw, lh);
      if (hov) { c.strokeStyle = RARITY_COLOR[it.rarity]; c.lineWidth = 1; c.strokeRect(box.x0 + 0.5, box.y0 + 0.5, tw - 1, lh - 1); }
      c.fillStyle = RARITY_COLOR[it.rarity];
      c.fillText(it.name, sx, box.y1 - 5);
      this.labels.push({ id: d.id, ...box });
    }
  }

  private drawOverheadBars(g: Game): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    for (const m of g.world.monsters) {
      if (m.dead || m.hp >= m.maxHp || m.rank === 'boss') continue;
      const t = MONSTERS[m.tpl];
      const sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y) - (54 * t.scale * ACTOR_SCALE + (t.flying ? 10 : 0)) * z;
      if (sx < 0 || sy < 0 || sx > cam.w || sy > cam.h) continue;
      const w2 = 26 * z;
      c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(sx - w2 / 2 - 1, sy - 1, w2 + 2, 4);
      c.fillStyle = m.rank === 'unique' ? '#e0a030' : m.rank === 'champion' ? '#5070ff' : '#c02020';
      c.fillRect(sx - w2 / 2, sy, w2 * Math.max(0, m.hp / m.maxHp), 2.2);
    }
  }

  // ------------------------------------------------------------ picking
  private updateHover(g: Game): void {
    this.hover = null;
    if (!this.mouse.inside) return;
    this.hover = this.pick(g, this.mouse.x, this.mouse.y);
  }

  pick(g: Game, mx: number, my: number): Hover | null {
    const cam = this.cam, z = cam.zoom, w = g.world;
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      if (mx >= l.x0 && mx <= l.x1 && my >= l.y0 && my <= l.y1) { const d = w.drops.find((q) => q.id === l.id); if (d) return { kind: 'drop', id: d.id, x: d.x, y: d.y }; }
    }
    let best: Hover | null = null, bd = 1e9;
    for (const m of w.monsters) {
      if (m.dead) continue;
      const t = MONSTERS[m.tpl];
      const sc = t.scale * ACTOR_SCALE * (m.rank === 'champion' || m.rank === 'unique' ? 1.12 : 1);
      const sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y) - (22 * sc + (t.flying ? 10 : 0)) * z;
      const dx = (mx - sx) / (14 * sc * z + 6), dy = (my - sy) / (26 * sc * z + 6);
      const d = dx * dx + dy * dy;
      if (d < 1 && d < bd) { bd = d; best = { kind: 'monster', id: m.id, x: m.x, y: m.y }; }
    }
    if (best) return best;
    for (const n of w.npcs) {
      const sx = cam.sxOf(n.x, n.y), sy = cam.syOf(n.x, n.y) - 32 * z;
      if (Math.abs(mx - sx) < 18 * z + 4 && Math.abs(my - sy) < 36 * z + 4) return { kind: 'npc', id: n.id, x: n.x, y: n.y };
    }
    const wp = cam.toWorld(mx, my);
    for (const d of w.drops) {
      if (!d.item) continue;
      if (Math.hypot(d.x - wp.x, d.y - wp.y) < 0.45) return { kind: 'drop', id: d.id, x: d.x, y: d.y };
    }
    let bp: Prop | null = null; bd = 0.9;
    for (const p of w.props) {
      if (!INTERACTIVE.has(p.kind) || (p.used && p.kind !== 'waypoint' && p.kind !== 'stash' && p.kind !== 'portal' && p.kind !== 'well')) continue;
      if ((p.kind === 'barrel' || p.kind === 'crate') && w.floor === 0) continue;
      const sx = cam.sxOf(p.x, p.y), sy = cam.syOf(p.x, p.y) - (p.kind === 'portal' ? 26 : p.kind === 'waypoint' ? 0 : 10) * z;
      const d = Math.hypot((mx - sx) / (18 * z), (my - sy) / ((p.kind === 'portal' ? 30 : 16) * z));
      if (d < bd) { bd = d; bp = p; }
    }
    if (bp) return { kind: 'prop', id: bp.id, x: bp.x, y: bp.y };
    const tx = Math.floor(wp.x), ty = Math.floor(wp.y);
    if (tx >= 0 && ty >= 0 && tx < w.w && ty < w.h) {
      const t = w.tiles[ty * w.w + tx];
      if (t === T_DOWN) return { kind: 'stairs', id: 1, x: tx + 0.5, y: ty + 0.5 };
      if (t === T_UP) return { kind: 'stairs', id: -1, x: tx + 0.5, y: ty + 0.5 };
    }
    return null;
  }

  // ------------------------------------------------------------ automap
  drawMap(ctx: CanvasRenderingContext2D, g: Game, cw: number, ch: number, scale: number, full: boolean): void {
    const w = g.world, h = g.hero;
    ctx.clearRect(0, 0, cw, ch);
    if (!full) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, cw, ch); }
    const ox = cw / 2, oy = ch / 2;
    const P = (x: number, y: number): [number, number] => [ox + (x - y - (h.x - h.y)) * scale, oy + (x + y - (h.x + h.y)) * scale * 0.5];
    const R = full ? 200 : Math.ceil(Math.max(cw, ch) / scale) + 2;
    const x0 = Math.max(0, Math.floor(h.x - R)), x1 = Math.min(w.w - 1, Math.ceil(h.x + R));
    const y0 = Math.max(0, Math.floor(h.y - R)), y1 = Math.min(w.h - 1, Math.ceil(h.y + R));
    ctx.lineWidth = full ? 1.3 : 1;
    ctx.strokeStyle = full ? 'rgba(200,180,140,0.75)' : 'rgba(200,180,140,0.9)';
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w.w + x;
      if (!w.explored[i] || w.tiles[i] !== T_WALL) continue;
      // draw wall edges facing floor
      const isFloor = (xx: number, yy: number) => { const t = w.tiles[yy * w.w + xx]; return t !== T_WALL && t !== 0; };
      if (y + 1 < w.h && isFloor(x, y + 1)) { const a = P(x, y + 1), b = P(x + 1, y + 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (y - 1 >= 0 && isFloor(x, y - 1)) { const a = P(x, y), b = P(x + 1, y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (x + 1 < w.w && isFloor(x + 1, y)) { const a = P(x + 1, y), b = P(x + 1, y + 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      if (x - 1 >= 0 && isFloor(x - 1, y)) { const a = P(x, y), b = P(x, y + 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    }
    ctx.stroke();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w.w + x;
      if (!w.explored[i]) continue;
      const t = w.tiles[i];
      if (t === T_UP || t === T_DOWN) { const [px, py] = P(x + 0.5, y + 0.5); ctx.fillStyle = t === T_DOWN ? (w.downSealed ? '#ff4030' : '#60ff60') : '#60c0ff'; ctx.fillRect(px - 3, py - 3, 6, 6); }
      if (t === T_LAVA && full) { const [px, py] = P(x + 0.5, y + 0.5); ctx.fillStyle = 'rgba(255,90,20,0.5)'; ctx.fillRect(px - 1.5, py - 1, 3, 2); }
    }
    for (const p of w.props) {
      if (!w.explored[Math.floor(p.y) * w.w + Math.floor(p.x)]) continue;
      if (p.kind === 'waypoint' || p.kind === 'portal' || (p.kind === 'shrine' && !p.used) || p.kind === 'stash') {
        const [px, py] = P(p.x, p.y); ctx.fillStyle = p.kind === 'shrine' ? '#ffe060' : '#60a0ff'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const n of w.npcs) { const [px, py] = P(n.x, n.y); ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill(); }
    for (const m of w.monsters) {
      if (m.dead || !w.explored[Math.floor(m.y) * w.w + Math.floor(m.x)]) continue;
      if (Math.hypot(m.x - h.x, m.y - h.y) > h.st.light + 1 && m.rank !== 'boss') continue;
      const [px, py] = P(m.x, m.y); ctx.fillStyle = m.rank === 'boss' ? '#ff2020' : m.rank === 'unique' ? '#ffb030' : m.rank === 'champion' ? '#6080ff' : '#d04040'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    const [hx, hy] = P(h.x, h.y);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
}
