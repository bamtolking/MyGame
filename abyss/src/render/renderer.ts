// Main renderer: isometric floor/walls, depth-sorted props & actors (offscreen-shaded with rim light and
// hit tints), combat effects, darkness with light sources, color grading, labels, picking and the automap.
import { CLASSES, skillAnim } from '../data/classes';
import { BASE_BY_ID, RARITY_COLOR } from '../data/items';
import { MONSTERS } from '../data/monsters';
import { SHRINES, ZONES } from '../data/zones';
import type { Game } from '../sim/game';
import { T_DOWN, T_LAVA, T_UP, T_WALL, T_WATER, type Drop, type GEvent, type Hero, type Monster, type Npc, type Prop, type Proj, type World } from '../sim/types';
import { drawCreature, monsterLook, npcLook, type Look, type Pose, type WeaponKind } from './actors';
import { ELEM_GLOW, Fx } from './fx';
import { Camera, RX, TH, TW, WALL_H, screenDir, shade } from './iso';
import { drawProp, flame, TALL_PROPS } from './props';
import { S, setTexScale, zoneTex } from './textures';
import { itemIcon } from './icons';
import { AREA_ART, BUFF_ART, CLASS_LOOK, EFFECT_ART, FX_EVENT, ITEM_KIND, PROJ_ART, type FxHost } from './registry';
import '../classes/art';

export type Hover =
  | { kind: 'monster'; id: number; x: number; y: number }
  | { kind: 'npc'; id: number; x: number; y: number }
  | { kind: 'prop'; id: number; x: number; y: number }
  | { kind: 'drop'; id: number; x: number; y: number }
  | { kind: 'stairs'; id: number; x: number; y: number };

interface Drawable { d: number; f: () => void }

/** Characters are drawn a bit larger than the tile grid for readability (Diablo-like proportions). */
export const ACTOR_SCALE = 1.22;
/** Humanoid art that fits a tighter offscreen box (unless unusually large). */
const BIPED_ARTS = new Set(['biped', 'zombie', 'skeleton', 'skelArcher', 'skelMage', 'fallen', 'shaman', 'ghoul', 'goatman', 'goatArcher', 'knight', 'witch', 'ordes', 'brute', 'troll', 'gromak']);

const INTERACTIVE = new Set(['barrel', 'crate', 'chest', 'bigchest', 'sarco', 'shrine', 'waypoint', 'stash', 'portal', 'well']);
const GRADE: Record<number, [string, number]> = { 0: ['#ffa860', 0.2], 1: ['#5a78c0', 0.22], 2: ['#b07840', 0.2], 3: ['#ff6a20', 0.2], 4: ['#ff2a10', 0.24] };
const TAU = Math.PI * 2;

export function heroLook(h: Hero): Look {
  const b = (slot: keyof Hero['equip']) => { const it = h.equip[slot]; return it && it.req <= h.level ? BASE_BY_ID[it.base] : null; };
  const chest = b('chest'), head = b('head'), wpn = b('weapon'), off = b('offhand');
  const ct = chest ? chest.tier : -1;
  const armor = ['#6a4a2a', '#8a8f96', '#b0b4bc', '#4e525e', '#5a1a1a'];
  const wCat: Record<string, WeaponKind> = { sword: 'sword', axe: 'axe', mace: 'mace', sword2h: 'sword2h', axe2h: 'axe2h', bow: 'bow', staff: 'staff', wand: 'wand', ...ITEM_KIND };
  const wIt = h.equip.weapon;
  const glow = wIt?.rarity === 'unique' ? '#e0b050' : wIt?.rarity === 'rare' ? '#f0e070' : wIt?.rarity === 'magic' ? '#7c8cff' : undefined;
  const common: Partial<Look> = {
    weapon: wpn ? wCat[wpn.cat] : 'none', wTier: wpn?.tier ?? 0, wGlow: glow,
    offhand: off ? (off.cat === 'shield' ? 'shield' : off.cat === 'quiver' ? 'quiver' : off.cat === 'orb' ? 'orb' : ITEM_KIND[off.cat] ?? off.cat) : null, offTier: off?.tier ?? 0,
    helm: head ? Math.min(4, head.tier) : -1,
    offColor: off?.cat === 'orb' ? ['#80c0ff', '#a0a0ff', '#c080ff', '#ff80c0', '#ff6060'][off.tier] : undefined,
    boots: h.equip.boots ? '#3a2a1e' : undefined,
    trim: ct >= 3 ? '#d8b050' : undefined,
    armorTier: ct,
  };
  const custom = CLASS_LOOK[h.cls];
  if (custom) return custom(h, common, ct);
  if (h.cls !== 'warrior' && h.cls !== 'rogue' && h.cls !== 'sorcerer') return { skin: '#d8a888', hair: '#3a2a1a', body: ct >= 0 ? armor[ct] : '#6a5a4a', body2: '#3a2a1a', legs: '#3a3228', head: 'human', build: 1.05, ...common } as Look;
  if (h.cls === 'warrior') return { skin: '#d8a888', hair: '#4a2a1a', body: ct >= 0 ? armor[ct] : '#7a5a3a', body2: '#4a3020', legs: ct >= 2 ? shade(armor[ct], -0.25) : '#4a3a2a', head: 'human', build: 1.18, ...common } as Look;
  if (h.cls === 'rogue') return { skin: '#e0b898', hair: '#a86a30', body: ct >= 0 ? shade(armor[ct], -0.1) : '#5a4a30', body2: '#3a2a1a', legs: '#3a3024', head: common.helm !== undefined && common.helm >= 0 ? 'human' : 'hood', robe: '#2e4a2a', cloak: '#2e4a2a', build: 0.95, ...common, armorTier: Math.min(1, ct), eyes: undefined } as Look;
  const robe = ct >= 0 ? ['#2a3a7a', '#3a3a6a', '#4a4a8a', '#2a2a4a', '#4a1a2a'][ct] : '#2a3a7a';
  return { skin: '#e0b898', hair: '#1e1e2a', body: shade(robe, 0.1), legs: '#2a2a3a', head: 'human', robe, build: 0.95, ...common, armorTier: -1, trim: '#c8a860', glow: '#8ab0ff' } as Look;
}

interface ActorOpts { outline?: string | null; rim?: boolean; tint?: string | null; tintA?: number; light?: { x: number; y: number }; glow?: string | null }

export class Renderer {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D;
  cam = new Camera();
  fx = new Fx();
  dpr = 1;
  dark: HTMLCanvasElement; dc: CanvasRenderingContext2D;
  darkScale = 0.75;
  time = 0;
  shakeT = 0; shakeV = 0;
  hitFlash = new Map<number, number>();
  recoil = new Map<number, { dx: number; dy: number; t: number; p: number }>();
  trails = new Map<number, { pts: number[]; kind: string; side: string; gone: number }>();
  labels: { id: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  mouse = { x: -1, y: -1, inside: false };
  hover: Hover | null = null;
  showAll = false;
  lowFx = false;
  quality = 2;
  wallMask: { w: World; m: Uint8Array } | null = null;
  moveMarker: { x: number; y: number; t: number } | null = null;
  bossId = 0;
  hurtT = 0;
  private world: World | null = null;
  private swingFlip = false;
  private delayed: { t: number; fn: () => void }[] = [];
  private aCv = document.createElement('canvas'); private ac: CanvasRenderingContext2D;
  private sCv = document.createElement('canvas'); private sc: CanvasRenderingContext2D;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this.c = cv.getContext('2d', { alpha: false })!;
    this.dark = document.createElement('canvas');
    this.dc = this.dark.getContext('2d')!;
    this.ac = this.aCv.getContext('2d')!;
    this.sc = this.sCv.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.cam.w = w; this.cam.h = h;
    // camera: about 14.5 tiles across in landscape, 7.8 in portrait
    const across = w >= h ? 14.5 : 7.8;
    this.cam.zoom = Math.max(0.72, Math.min(2.3, Math.min(w / (TW * across), h / (TH * 12.5))));
    setTexScale(Math.max(2, Math.min(4, Math.ceil(this.cam.zoom * this.dpr))));
    this.setQuality(this.quality);
  }

  setQuality(q: number): void {
    this.quality = q;
    this.darkScale = q >= 2 ? 0.75 : 0.5;
    this.dark.width = Math.ceil(this.cam.w * this.darkScale); this.dark.height = Math.ceil(this.cam.h * this.darkScale);
    this.fx.low = this.lowFx || q === 0;
  }

  // ------------------------------------------------------------ events → visuals
  handle(events: GEvent[], g: Game): void {
    const fx = this.fx;
    if (this.world !== g.world) { this.world = g.world; fx.clearWorld(); this.trails.clear(); this.recoil.clear(); this.delayed = []; }
    for (const e of events) {
      switch (e.t) {
        case 'dmg': fx.dmg(e.x, e.y, e.v, e.kind, e.elem); if (e.kind === 'hero' && e.v > 0) this.hurtT = Math.min(0.5, 0.15 + e.v / Math.max(1, g.hero.st.maxHp)); break;
        case 'hit': this.hitFlash.set(e.id, 0.12); break;
        case 'shake': this.shakeT = 0.32; this.shakeV = Math.max(this.shakeV, e.v); break;
        case 'boss': this.bossId = e.id; break;
        case 'impact': this.onImpact(e, g); break;
        case 'kill': this.onKill(e); break;
        case 'swing': {
          this.swingFlip = !this.swingFlip;
          const heavy = e.skill === 'bash' || e.skill === 'cleave';
          fx.effect('slash', e.x, e.y, heavy ? 0.3 : 0.24, { ang: e.ang, r: e.r, c: e.elem === 'phys' ? '255,226,170' : ELEM_GLOW[e.elem], heavy, seed: this.swingFlip ? 1000 : 0, data: e.skill === 'cleave' ? 'full' : undefined });
          if (e.skill === 'cleave') { fx.effect('shock', e.x, e.y, 0.35, { r: e.r, c: '255,230,190' }); fx.effect('dust', e.x, e.y, 0.5, { r: e.r * 0.8 }); }
          break;
        }
        case 'mattack': {
          if (this.quality === 0) break;
          fx.effect('slash', e.x, e.y, e.heavy ? 0.3 : 0.2, { ang: e.ang, r: e.r * 0.9, c: e.heavy ? '255,70,40' : '200,190,180', heavy: e.heavy, seed: Math.random() * 1000 });
          break;
        }
        case 'itemDrop':
          if (e.rarity === 'unique' || e.rarity === 'rare') fx.effect('beam', e.x, e.y, 3, { c: RARITY_COLOR[e.rarity] });
          fx.burst(e.x, e.y, e.rarity === 'unique' ? 18 : 8, { color: RARITY_COLOR[e.rarity], kind: 'star', life: 0.7, speed: 1.3, up: 70, grav: 90, size: 1.3, add: true });
          break;
        case 'fx': this.spawnFx(e); break;
      }
    }
  }

  private onImpact(e: Extract<GEvent, { t: 'impact' }>, g: Game): void {
    const fx = this.fx;
    const m = g.world.monsters.find((q) => q.id === e.id);
    const t = m ? MONSTERS[m.tpl] : null;
    const heavy = e.crit || e.power > 0.3;
    this.recoil.set(e.id, { dx: e.dx, dy: e.dy, t: 0.16, p: (e.via === 'melee' ? 1 : 0.6) * (heavy ? 1.6 : 1) });
    const hx = e.x - e.dx * 0.25, hy = e.y - e.dy * 0.25;
    const col = e.elem === 'phys' ? '255,230,180' : ELEM_GLOW[e.elem];
    const sc = t?.scale ?? 1;
    if (e.via === 'melee' || e.crit || e.via === 'proj') {
      fx.effect('hitflash', hx, hy, heavy ? 0.16 : 0.1, { c: col, power: (heavy ? 1.3 : 0.9) * Math.min(1.6, sc), heavy, ang: Math.atan2(e.dy * 0.5, e.dx - e.dy) });
    }
    const dir = { x: e.dx, y: e.dy };
    const n = e.via === 'melee' ? (heavy ? 12 : 7) : 4;
    fx.burst(hx, hy, n, { dir, spread: 1.4, color: e.crit ? '#fff2b0' : `rgb(${col})`, kind: 'streak', size: 1.3, speed: heavy ? 9 : 6, up: 80, grav: 200, life: 0.3, add: true, z: 24 * sc, drag: 3 });
    if (e.elem === 'fire') fx.burst(hx, hy, 6, { color: '#ffa040', kind: 'ember', size: 1.8, speed: 2, up: 90, grav: -20, life: 0.6, add: true, z: 20 * sc });
    if (e.elem === 'cold') fx.burst(hx, hy, 6, { dir, color: '#d8f0ff', kind: 'ice', size: 1.6, speed: 4, up: 70, grav: 220, life: 0.6, add: true, z: 22 * sc });
    if (e.elem === 'light') fx.burst(hx, hy, 6, { color: '#fffaa0', kind: 'glint', size: 1.2, speed: 3, up: 60, life: 0.25, add: true, z: 24 * sc });
    if (e.elem === 'poison') fx.burst(hx, hy, 5, { color: '#7aff5a', kind: 'dot', size: 2, speed: 1, up: 30, life: 0.8, z: 18 * sc });
    if (t && !t.undead && t.art !== 'fireSpirit' && t.art !== 'wraith' && t.art !== 'eye' && e.elem !== 'fire') {
      const blood = t.art === 'spider' || t.art === 'lizard' ? '#4a7a20' : '#8a0808';
      fx.burst(e.x, e.y, heavy ? 8 : 4, { dir, spread: 1.1, color: blood, kind: 'drop', size: 1.6, speed: heavy ? 5 : 3.5, up: 90, grav: 320, life: 0.8, z: 22 * sc, stain: 'splat' });
    } else if (t?.undead && t.art.startsWith('skel')) {
      fx.burst(e.x, e.y, heavy ? 6 : 3, { dir, color: '#e0d8c4', kind: 'bone', size: 1.5, speed: 3.5, up: 90, grav: 260, life: 0.7, z: 24 * sc });
    }
    if (e.crit) { fx.effect('shock', e.x, e.y, 0.28, { r: 1.4 * sc, c: col }); this.shakeT = Math.max(this.shakeT, 0.12); this.shakeV = Math.max(this.shakeV, 0.25); }
  }

  private onKill(e: Extract<GEvent, { t: 'kill' }>): void {
    const fx = this.fx, sc = e.scale;
    const dir = { x: e.dx, y: e.dy };
    const low = this.quality === 0;
    const flesh = !['skeleton', 'skelArcher', 'skelMage', 'ordes', 'wraith', 'fireSpirit'].includes(e.art);
    const green = e.art === 'spider' || e.art === 'lizard' || e.art === 'eye';
    const blood = green ? '#3a6a18' : '#7a0606';
    const stainKind = green ? 'slime' : 'blood';
    switch (e.style) {
      case 'gib':
        fx.burst(e.x, e.y, low ? 6 : 12, { dir, spread: 2.4, color: green ? '#2e5a14' : '#6a0a08', kind: 'chunk', size: 2.6 * sc, speed: 5, up: 160, grav: 300, life: 1.6, z: 22 * sc, stain: 'blood' });
        fx.burst(e.x, e.y, low ? 10 : 26, { dir, spread: 1.8, color: blood, kind: 'drop', size: 1.8, speed: 7, up: 120, grav: 340, life: 1, z: 24 * sc, stain: 'splat' });
        fx.stain(e.x, e.y, stainKind, 0.7 * sc, 0.5);
        fx.effect('hitflash', e.x, e.y, 0.18, { c: '255,60,40', power: 1.5 * sc, heavy: true, ang: Math.atan2(e.dy, e.dx) });
        break;
      case 'burn':
        fx.burst(e.x, e.y, low ? 10 : 24, { color: '#ffa040', kind: 'ember', size: 2, speed: 1.5, up: 110, grav: -30, life: 1.4, add: true, z: 18 * sc });
        fx.burst(e.x, e.y, 8, { color: '#2a2622', kind: 'smoke', size: 5, speed: 0.6, up: 50, life: 1.8, z: 26 * sc });
        fx.effect('fireground', e.x, e.y, 1.6, { r: 0.8 * sc });
        fx.stain(e.x, e.y, 'ash', 0.45 * sc);
        break;
      case 'shatter':
        fx.burst(e.x, e.y, low ? 12 : 30, { dir, spread: 3, color: Math.random() < 0.5 ? '#e0f4ff' : '#8ac8ff', kind: 'ice', size: 2.2, speed: 6, up: 150, grav: 300, life: 1.1, add: true, z: 24 * sc });
        fx.burst(e.x, e.y, 10, { color: '#ffffff', kind: 'glint', size: 1.4, speed: 2, up: 60, life: 0.5, add: true, z: 26 * sc });
        fx.effect('frostburst', e.x, e.y, 0.35, { r: 1.2 * sc });
        fx.stain(e.x, e.y, 'frost', 0.9 * sc);
        break;
      case 'zap': {
        const pts: number[] = [];
        for (let i = 0; i < 4; i++) pts.push(e.x + (Math.random() - 0.5) * 1.2 * sc, e.y + (Math.random() - 0.5) * 1.2 * sc);
        fx.effect('zap', e.x, e.y, 0.3, { pts });
        fx.effect('zapburst', e.x, e.y, 0.3, { r: 1.2 * sc });
        fx.burst(e.x, e.y, low ? 10 : 22, { color: '#fffaa0', kind: 'streak', size: 1.2, speed: 7, up: 100, grav: 150, life: 0.4, add: true, z: 24 * sc });
        fx.stain(e.x, e.y, 'ash', 0.4 * sc);
        break;
      }
      case 'bones':
        fx.burst(e.x, e.y, low ? 6 : 14, { dir, spread: 2.5, color: '#ddd4be', kind: 'bone', size: 2, speed: 3.5, up: 110, grav: 280, life: 1.1, z: 24 * sc });
        fx.stain(e.x, e.y, 'bonepile', 0.55 * sc);
        break;
      case 'boss': {
        fx.effect('bossDeath', e.x, e.y, 3.2);
        for (let i = 0; i < 7; i++) {
          this.delayed.push({ t: i * 0.28, fn: () => {
            const ox = e.x + (Math.random() - 0.5) * 2.5, oy = e.y + (Math.random() - 0.5) * 2.5;
            this.spawnFx({ t: 'fx', kind: 'explosion', x: ox, y: oy, r: 1.6 });
            this.shakeT = 0.3; this.shakeV = Math.max(this.shakeV, 0.7);
          } });
        }
        this.delayed.push({ t: 2.1, fn: () => { fx.burst(e.x, e.y, 30, { color: '#5a0808', kind: 'chunk', size: 3.5, speed: 6, up: 200, grav: 300, life: 2, z: 40, stain: 'blood' }); fx.stain(e.x, e.y, 'blood', 1.8, 1); } });
        break;
      }
      default:
        if (flesh) { fx.burst(e.x, e.y, 10, { dir, spread: 1.6, color: blood, kind: 'drop', size: 1.7, speed: 4.5, up: 100, grav: 320, life: 0.9, z: 22 * sc, stain: 'splat' }); fx.stain(e.x, e.y, stainKind, 0.5 * sc, 2.2); }
        if (e.art === 'wraith') fx.burst(e.x, e.y, 16, { color: '#a0d0ff', kind: 'smoke', size: 4, speed: 1, up: 60, life: 1.4, add: true, z: 24 });
        if (e.art === 'fireSpirit') { fx.burst(e.x, e.y, 18, { color: '#ffa040', kind: 'ember', size: 2, speed: 3, up: 90, life: 0.9, add: true, z: 18 }); fx.stain(e.x, e.y, 'scorch', 0.5); }
    }
  }

  spawnFx(e: Extract<GEvent, { t: 'fx' }>): void {
    const fx = this.fx;
    const low = this.quality === 0;
    this.fxHost.fx = fx; this.fxHost.low = low || this.lowFx;
    switch (e.kind) {
      case 'splinters':
        fx.burst(e.x, e.y, e.n ?? 14, { color: '#6a4a2a', kind: 'shard', size: 2.2, speed: 3.5, up: 90, grav: 240, life: 1, z: 10 });
        fx.burst(e.x, e.y, 5, { color: '#5a4a3a', kind: 'smoke', size: 4, speed: 0.8, up: 20, life: 0.8, z: 6 });
        break;
      case 'explosion': {
        const r = e.r ?? 1.5;
        fx.effect('explosion', e.x, e.y, 0.6, { r, seed: Math.random() * 10 });
        fx.effect('shock', e.x, e.y, 0.45, { r: r * 1.3, c: '255,150,60' });
        fx.stain(e.x, e.y, 'scorch', r * 0.8, 0.2);
        fx.burst(e.x, e.y, low ? 12 : 30, { color: '#ffb040', kind: 'streak', size: 1.6, speed: r * 5, up: 140, grav: 200, life: 0.7, add: true, z: 10 });
        fx.burst(e.x, e.y, low ? 4 : 10, { color: '#3a3430', kind: 'smoke', size: 7, speed: 1.2, up: 50, life: 1.6, z: 16 });
        if (!low) fx.burst(e.x, e.y, 8, { color: '#2a2018', kind: 'shard', size: 2, speed: r * 3, up: 160, grav: 320, life: 1.1, z: 8 });
        break;
      }
      case 'frostburst': fx.effect('frostburst', e.x, e.y, 0.4, { r: e.r ?? 1 }); fx.burst(e.x, e.y, 14, { color: '#d8f0ff', kind: 'ice', size: 1.6, speed: 3.5, up: 70, grav: 180, life: 0.7, add: true }); break;
      case 'burst': fx.effect('burst', e.x, e.y, 0.35, { r: e.r ?? 1 }); break;
      case 'impact': case 'spark': {
        const col = e.c === 'fireball' || e.c === 'firebolt' || e.c === 'spit' ? '#ffa040' : e.c === 'coldbolt' || e.c === 'frost' ? '#a0e0ff' : e.c === 'bolt' ? '#c0a0ff' : e.c === 'lightning' || e.c === 'spark' ? '#ffff90' : e.c === 'blood' ? '#ff4060' : '#e8e0c8';
        fx.burst(e.x, e.y, low ? 3 : 7, { color: col, kind: 'streak', size: 1.3, speed: 4, up: 40, grav: 120, life: 0.3, add: true, z: 18 });
        break;
      }
      case 'warcry': fx.effect('warcry', e.x, e.y, 0.75, { r: e.r ?? 4 }); fx.effect('shock', e.x, e.y, 0.5, { r: e.r ?? 4, c: '255,200,90' }); fx.effect('dust', e.x, e.y, 0.7, { r: (e.r ?? 4) * 0.7 }); break;
      case 'stomp': {
        const r = e.r ?? 2.4;
        fx.effect('shock', e.x, e.y, 0.45, { r: r * 1.2, c: '220,190,150' });
        fx.effect('dust', e.x, e.y, 0.7, { r });
        fx.stain(e.x, e.y, 'crack', r * 0.7);
        fx.burst(e.x, e.y, low ? 8 : 18, { color: '#6a5a4a', kind: 'smoke', size: 5, speed: r * 2, up: 20, life: 1, z: 4 });
        fx.burst(e.x, e.y, low ? 5 : 12, { color: '#4a4036', kind: 'shard', size: 2, speed: r * 2.5, up: 150, grav: 320, life: 0.9, z: 4 });
        break;
      }
      case 'berserk': fx.burst(e.x, e.y, 26, { color: '#ff3020', kind: 'ember', size: 2.2, speed: 2, up: 90, life: 0.9, add: true, z: 20 }); fx.effect('shock', e.x, e.y, 0.4, { r: 2.5, c: '255,50,30' }); break;
      case 'frostnova': fx.effect('frostnova', e.x, e.y, 0.8, { r: e.r ?? 4.5, seed: Math.random() * 6 }); fx.stain(e.x, e.y, 'frost', (e.r ?? 4.5) * 0.9); if (!low) fx.burst(e.x, e.y, 36, { color: '#e0f6ff', kind: 'ice', size: 1.7, speed: 9, up: 30, life: 0.55, add: true, z: 8 }); break;
      case 'lightning': {
        fx.effect('lightning', e.x, e.y, 0.32, { pts: e.pts });
        const p = e.pts ?? [];
        for (let i = 2; i + 1 < p.length; i += 2) { fx.effect('zapburst', p[i], p[i + 1], 0.25, { r: 0.9 }); fx.burst(p[i], p[i + 1], low ? 3 : 7, { color: '#fffaa0', kind: 'streak', size: 1.2, speed: 5, up: 60, grav: 120, life: 0.3, add: true, z: 22 }); }
        break;
      }
      case 'teleport': fx.effect('teleport', e.x, e.y, 0.4); fx.burst(e.x, e.y, 16, { color: '#a0b8ff', kind: 'streak', size: 1.3, speed: 3, up: 90, life: 0.5, add: true, z: 26 }); break;
      case 'blink': fx.effect('blink', e.x, e.y, 0.35); break;
      case 'shadow': fx.effect('afterimage', e.x, e.y, 0.35); break;
      case 'meteorFall': fx.effect('meteorFall', e.x, e.y, 0.9, { r: e.r ?? 2.8 }); break;
      case 'levelup': fx.effect('levelup', e.x, e.y, 1.8, { c: 'rgba(255,220,120,0.9)' }); fx.burst(e.x, e.y, 40, { color: '#ffe080', kind: 'star', size: 1.6, speed: 1.5, up: 140, grav: 20, life: 1.6, add: true }); fx.effect('shock', e.x, e.y, 0.6, { r: 3, c: '255,220,120' }); break;
      case 'shrine': fx.effect('shrine', e.x, e.y, 1.2, { c: e.c ?? '#fff' }); fx.burst(e.x, e.y, 24, { color: e.c ?? '#fff', kind: 'star', size: 1.5, speed: 2, up: 100, grav: 30, life: 1.2, add: true, z: 20 }); break;
      case 'resurrect': fx.effect('resurrect', e.x, e.y, 0.8, { c: 'rgba(180,80,255,0.8)' }); break;
      case 'portalOpen': fx.effect('portalOpen', e.x, e.y, 1, { c: 'rgba(80,140,255,0.9)' }); break;
      case 'healPot': fx.burst(e.x, e.y, 16, { color: '#ff5060', kind: 'star', size: 1.3, speed: 0.8, up: 80, grav: 10, life: 1, add: true, z: 10 }); break;
      case 'manaPot': fx.burst(e.x, e.y, 16, { color: '#5080ff', kind: 'star', size: 1.3, speed: 0.8, up: 80, grav: 10, life: 1, add: true, z: 10 }); break;
      case 'rainTick': {
        for (let i = 0; i < (low ? 3 : 8); i++) {
          const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (e.r ?? 2.5);
          const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
          fx.add({ x, y, z: 150, vz: -900, color: '#e8e0cc', kind: 'streak', size: 1.2, life: 0.17 });
          fx.add({ x, y, z: 2, vz: 20, color: '#6a5a4a', kind: 'smoke', size: 2.5, life: 0.4 });
        }
        break;
      }
      default: FX_EVENT[e.kind]?.(e, this.fxHost);
    }
  }

  /** What class FX handlers may touch. */
  private readonly fxHost: FxHost = {
    fx: null as never, low: false,
    shake: (v: number) => { this.shakeT = 0.32; this.shakeV = Math.max(this.shakeV, v); },
    delay: (t: number, fn: () => void) => { this.delayed.push({ t, fn }); },
  };

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

  private ensure(cv: HTMLCanvasElement, w: number, h: number): void {
    if (cv.width < w) cv.width = Math.ceil(w * 1.2);
    if (cv.height < h) cv.height = Math.ceil(h * 1.2);
  }

  /** Draws one character. High quality renders offscreen to add volume shading, rim light, tints and outlines. */
  private drawActorAt(sx: number, sy: number, k: number, art: string, L: Look, p: Pose, lift = 0, o: ActorOpts = {}): void {
    const c = this.c;
    if (p.dead < 0.5) {
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, 14 * k);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, 14 * k, 6.5 * k, 0, 0, TAU); c.fill();
    }
    // settled corpses skip the offscreen pass (cheap), except while they are being charred or electrocuted
    const settled = p.dead >= 0.6 && !(o.tint && (o.tintA ?? 0) > 0);
    if (this.quality === 0 || this.lowFx || settled) {
      c.save(); c.translate(sx, sy - lift * k);
      if (p.dead >= 0) { const fall = Math.min(1, p.dead / 0.35); c.rotate((p.flip ? 1 : -1) * fall * Math.PI / 2 * 0.95); }
      c.scale(p.flip ? -k : k, k);
      c.globalAlpha = p.alpha;
      drawCreature(c, art, L, p);
      c.restore();
      if (o.tint && (o.tintA ?? 0) > 0 && o.tint !== '#000000') {
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(sx, sy - 22 * k, 0, sx, sy - 22 * k, 22 * k);
        g.addColorStop(0, o.tint === '#ffffff' ? `rgba(255,255,255,${o.tintA})` : `rgba(120,200,255,${o.tintA! * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 22 * k, 16 * k, 26 * k, 0, 0, TAU); c.fill(); c.restore();
      }
      return;
    }
    const dpr = this.dpr;
    // offscreen box: generous for winged / huge / non-humanoid art, tighter for ordinary bipeds
    const big = !!L.wings || (L.build ?? 1) > 1.25 || (L.height ?? 1) > 1.1 || !BIPED_ARTS.has(art);
    const ext = (big ? 72 : 58) * k, top = (big ? 128 : 106) * k, bot = 14 * k;
    const W = Math.ceil(2 * ext * dpr), H = Math.ceil((top + bot) * dpr);
    this.ensure(this.aCv, W, H);
    const ac = this.ac;
    ac.setTransform(1, 0, 0, 1, 0, 0);
    ac.globalCompositeOperation = 'source-over'; ac.globalAlpha = 1;
    ac.clearRect(0, 0, W + 2, H + 2);
    ac.setTransform(dpr, 0, 0, dpr, ext * dpr, top * dpr);
    ac.translate(0, -lift * k);
    if (p.dead >= 0) { const fall = Math.min(1, p.dead / 0.35); ac.rotate((p.flip ? 1 : -1) * fall * Math.PI / 2 * 0.95); }
    ac.scale(p.flip ? -k : k, k);
    drawCreature(ac, art, L, p);
    // volume shading on the actor's own pixels
    ac.setTransform(1, 0, 0, 1, 0, 0);
    ac.globalCompositeOperation = 'source-atop';
    const lx = o.light?.x ?? -0.6, ly = o.light?.y ?? -0.8;
    // one diagonal gradient: warm light on the side facing the light source, shadow toward the feet and far side
    const vg = ac.createLinearGradient(W / 2 + lx * W * 0.3, H * 0.1, W / 2 - lx * W * 0.3, H * 0.95);
    vg.addColorStop(0, 'rgba(255,226,190,0.17)'); vg.addColorStop(0.42, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.36)');
    ac.fillStyle = vg; ac.fillRect(0, 0, W, H);
    if (o.tint && (o.tintA ?? 0) > 0) { ac.globalAlpha = o.tintA!; ac.fillStyle = o.tint; ac.fillRect(0, 0, W, H); ac.globalAlpha = 1; }
    ac.globalCompositeOperation = 'source-over';
    const dx = sx - ext, dy = sy - top;
    let alpha = p.alpha;
    if (p.dead > 20) alpha *= Math.max(0, 1 - (p.dead - 20) / 5);
    // silhouettes: rim light on the lit edge and a colored outline for elites / hover
    if (this.quality >= 2 && (o.rim || o.outline)) {
      this.ensure(this.sCv, W, H);
      const sc = this.sc;
      const sil = (col: string) => {
        sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = 'source-over';
        sc.clearRect(0, 0, W + 2, H + 2);
        sc.drawImage(this.aCv, 0, 0, W, H, 0, 0, W, H);
        sc.globalCompositeOperation = 'source-in'; sc.fillStyle = col; sc.fillRect(0, 0, W, H);
        sc.globalCompositeOperation = 'source-over';
      };
      if (o.outline) {
        sil(o.outline);
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha;
        const off = 1.6;
        for (const [ox, oy] of [[off, 0], [-off, 0], [0, off], [0, -off]]) c.drawImage(this.sCv, 0, 0, W, H, dx + ox, dy + oy, W / dpr, H / dpr);
        c.restore();
      }
      if (o.rim) {
        sil('rgba(255,222,180,0.85)');
        c.save(); c.globalAlpha = 0.75 * alpha;
        c.drawImage(this.sCv, 0, 0, W, H, dx + lx * 1.4, dy + ly * 1.4, W / dpr, H / dpr);
        c.restore();
      }
    }
    c.save(); c.globalAlpha = alpha;
    c.drawImage(this.aCv, 0, 0, W, H, dx, dy, W / dpr, H / dpr);
    c.restore();
    if (o.glow) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(sx, sy - 24 * k, 0, sx, sy - 24 * k, 30 * k);
      g.addColorStop(0, o.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy - 24 * k, 22 * k, 32 * k, 0, 0, TAU); c.fill(); c.restore();
    }
  }

  // ------------------------------------------------------------ frame
  /** `dt` is scaled game time (hit-stop / slow motion); `real` is wall-clock time for camera shake and screen feedback. */
  render(g: Game, dt: number, real = dt): void {
    this.time += dt;
    const c = this.c, cam = this.cam, w = g.world, h = g.hero, z = cam.zoom;
    const zone = ZONES[w.zone];
    const tex = zoneTex(w.zone);
    if (this.world !== w) { this.world = w; this.fx.clearWorld(); this.trails.clear(); this.recoil.clear(); this.delayed = []; }
    this.fx.update(dt);
    for (const d of this.delayed) d.t -= dt;
    const due = this.delayed.filter((d) => d.t <= 0);
    this.delayed = this.delayed.filter((d) => d.t > 0);
    for (const d of due) d.fn();
    for (const [id, t] of this.hitFlash) { if (t - dt <= 0) this.hitFlash.delete(id); else this.hitFlash.set(id, t - dt); }
    for (const [id, r] of this.recoil) { r.t -= dt; if (r.t <= 0) this.recoil.delete(id); }
    if (this.moveMarker) { this.moveMarker.t -= dt; if (this.moveMarker.t <= 0) this.moveMarker = null; }
    if (this.hurtT > 0) this.hurtT -= real;
    // camera
    const k = Math.min(1, real * 10);
    if (Math.hypot(cam.x - h.x, cam.y - h.y) > 8) { cam.x = h.x; cam.y = h.y; }
    cam.x += (h.x - cam.x) * k; cam.y += (h.y - cam.y) * k;
    cam.sx = 0; cam.sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= real;
      const s = this.shakeV * 9 * Math.max(0, this.shakeT / 0.32);
      cam.sx = (Math.random() - 0.5) * s; cam.sy = (Math.random() - 0.5) * s;
      if (this.shakeT <= 0) this.shakeV = 0;
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
        c.drawImage(img, sx - tw / 2 - 0.25, sy - 0.25, tw + 0.5, th + 0.5);
        if (t === T_LAVA) {
          const pulse = 0.2 + 0.16 * Math.sin(this.time * 2 + x * 0.7 + y * 0.9);
          c.globalAlpha = pulse; c.globalCompositeOperation = 'lighter';
          c.drawImage(img, sx - tw / 2, sy, tw, th);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        }
        if (t === T_DOWN && w.downSealed) {
          c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 3);
          c.strokeStyle = '#ff3020'; c.lineWidth = 2 * z;
          c.beginPath(); c.ellipse(sx, sy + th / 2, tw * 0.35, th * 0.35, 0, 0, TAU); c.stroke(); c.restore();
        }
      }
    }
    this.drawContactShadows(w, x0, y0, x1, y1);
    // ---------------- decals & stains
    this.drawDecals(g, x0, y0, x1, y1);
    this.fx.drawStains(c, cam);
    // ---------------- ground areas + effects
    this.drawAreas(g);
    this.fx.drawGround(c, cam);
    if (this.moveMarker) {
      const m = this.moveMarker; const sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y);
      c.save(); c.globalAlpha = m.t / 0.5; c.strokeStyle = '#e0c070'; c.lineWidth = 1.5 * z;
      const r = (1 - m.t / 0.5) * 10 + 6;
      c.beginPath(); c.ellipse(sx, sy, r * z, r * 0.5 * z, 0, 0, TAU); c.stroke(); c.restore();
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
        if (!onScreen(sx, sy, 160)) continue;
        const v = w.vari[i];
        let img: HTMLCanvasElement;
        if (w.zone === 0) img = v >= 200 ? tex.extra.palisade[v % 2] : v >= 100 ? tex.extra.stone[v % 3] : tex.extra.house[v % 3];
        else img = tex.walls[v % tex.walls.length];
        const depth = x + y + 1;
        const dd = depth - (hx + hy);
        const lat = (x + 0.5 - (y + 0.5)) - (hx - hy);
        const fade = dd > 0.2 && dd < 4.2 && Math.abs(lat) < 3.2 && x + 1 > hx - 0.3 && y + 1 > hy - 0.3;
        list.push({ d: depth, f: () => {
          const ih = img.height / S;
          if (fade) c.globalAlpha = 0.28;
          c.drawImage(img, sx - tw / 2 - 0.3, sy - (ih - TH) * z - 0.3, tw + 0.6, ih * z + 0.6);
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
        if (hov && !p.used) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3; drawProp(c, p, this.time, w.zone); }
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
    this.updateTrails(w);
    for (const p of w.projs) list.push({ d: p.x + p.y + 0.01, f: () => this.drawProj(p) });
    list.sort((a, b2) => a.d - b2.d);
    for (const it of list) it.f();
    this.drawTrails();
    // ---------------- air effects & particles
    this.drawAreasAir(g);
    this.fx.drawAir(c, cam);
    this.fx.drawParticles(c, cam);
    this.spawnAmbient(g, x0, y0, x1, y1, dt);
    // ---------------- darkness, grading
    this.drawDarkness(g, x0, y0, x1, y1);
    // ---------------- labels, texts, bars
    this.drawLabels(g);
    this.drawOverheadBars(g);
    this.fx.drawTexts(c, cam);
    this.drawScreenFx(g);
    this.updateHover(g);
  }

  /** Soft contact shadows where floor meets the walls behind it. */
  private drawContactShadows(w: World, x0: number, y0: number, x1: number, y1: number): void {
    const c = this.c, cam = this.cam;
    const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= w.w || y >= w.h || w.tiles[y * w.w + x] === T_WALL;
    const quad = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) => {
      const p = [cam.sxOf(ax, ay), cam.syOf(ax, ay), cam.sxOf(bx, by), cam.syOf(bx, by), cam.sxOf(cx, cy), cam.syOf(cx, cy), cam.sxOf(dx, dy), cam.syOf(dx, dy)];
      const g = c.createLinearGradient((p[0] + p[2]) / 2, (p[1] + p[3]) / 2, (p[4] + p[6]) / 2, (p[5] + p[7]) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.lineTo(p[4], p[5]); c.lineTo(p[6], p[7]); c.closePath(); c.fill();
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = w.tiles[y * w.w + x];
      if (t === 0 || t === T_WALL || t === T_LAVA) continue;
      if (isWall(x, y - 1)) quad(x, y, x + 1, y, x + 1, y + 0.42, x, y + 0.42);
      if (isWall(x - 1, y)) quad(x, y + 1, x, y, x + 0.42, y, x + 0.42, y + 1);
    }
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
          c.strokeStyle = 'rgba(176,138,58,0.35)'; c.lineWidth = 1 * z;
          c.beginPath(); c.moveTo(...p(0.3, 0.3)); c.lineTo(...p(ww - 0.3, 0.3)); c.lineTo(...p(ww - 0.3, hh - 0.3)); c.lineTo(...p(0.3, hh - 0.3)); c.closePath(); c.stroke();
          break;
        }
        case 'pentagram': {
          const r = (d.w ?? 3) / 2;
          const cx = d.x + r, cy = d.y + r;
          c.save(); c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(255,50,20,${0.45 + 0.2 * Math.sin(this.time * 1.5)})`; c.lineWidth = 2 * z;
          const pt = (a: number): [number, number] => [cam.sxOf(cx + Math.cos(a) * r, cy + Math.sin(a) * r), cam.syOf(cx + Math.cos(a) * r, cy + Math.sin(a) * r)];
          c.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5; const q = pt(a); if (i === 0) c.moveTo(...q); else c.lineTo(...q); } c.stroke();
          c.beginPath(); c.ellipse(cam.sxOf(cx, cy), cam.syOf(cx, cy), r * RX * z, r * RX * z * 0.5, 0, 0, TAU); c.stroke();
          c.restore();
          break;
        }
        case 'blood': c.fillStyle = 'rgba(90,6,6,0.55)'; c.beginPath(); c.ellipse(sx, sy, (6 + d.v * 3) * z, (3 + d.v * 1.5) * z, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(sx + 7 * z, sy + 2 * z, 2.5 * z, 1.3 * z, 0, 0, TAU); c.fill(); break;
        case 'bones': c.strokeStyle = 'rgba(210,200,180,0.7)'; c.lineWidth = 1.6 * z; c.beginPath(); c.moveTo(sx - 6 * z, sy); c.lineTo(sx + 5 * z, sy - 2 * z); c.moveTo(sx - 2 * z, sy - 3 * z); c.lineTo(sx + 2 * z, sy + 3 * z); c.stroke(); break;
        case 'skull': c.fillStyle = 'rgba(210,200,180,0.8)'; c.beginPath(); c.arc(sx, sy - 2 * z, 2.8 * z, 0, TAU); c.fill(); c.fillStyle = '#100a08'; c.fillRect(sx - 1.4 * z, sy - 2.5 * z, 1 * z, 1 * z); c.fillRect(sx + 0.5 * z, sy - 2.5 * z, 1 * z, 1 * z); break;
        case 'crack': c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1 * z; c.beginPath(); c.moveTo(sx - 8 * z, sy); c.lineTo(sx - 2 * z, sy + 2 * z); c.lineTo(sx + 3 * z, sy - 1 * z); c.lineTo(sx + 9 * z, sy + 1 * z); c.stroke(); break;
        case 'rubble': c.fillStyle = 'rgba(90,84,76,0.9)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(sx + (i - 1.5) * 4 * z, sy + ((i * 7) % 3 - 1) * z, 2 * z, 1.2 * z, 0, 0, TAU); c.fill(); } break;
        case 'moss': c.fillStyle = 'rgba(60,80,40,0.45)'; c.beginPath(); c.ellipse(sx, sy, 10 * z, 5 * z, 0, 0, TAU); c.fill(); break;
        case 'web': c.strokeStyle = 'rgba(220,220,220,0.35)'; c.lineWidth = 0.6 * z; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * 14 * z, sy + Math.sin(a) * 7 * z); c.stroke(); } for (const r of [5, 10]) { c.beginPath(); c.ellipse(sx, sy, r * z, r * 0.5 * z, 0, 0, TAU); c.stroke(); } break;
        case 'grass': c.strokeStyle = ['#4a6030', '#3a5028', '#5a7038', '#2e4020'][d.v]; c.lineWidth = 1 * z; for (let i = 0; i < 5; i++) { const sway = Math.sin(this.time * 1.5 + d.x) * 0.8; c.beginPath(); c.moveTo(sx + (i - 2) * 2 * z, sy); c.lineTo(sx + ((i - 2) * 2.6 + sway) * z, sy - (4 + (i % 3) * 2) * z); c.stroke(); } break;
        case 'flowers': c.fillStyle = ['#d0d060', '#c060a0', '#e0e0e0', '#6090e0'][d.v]; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sx + (i - 1) * 4 * z, sy - (i % 2) * 2 * z, 1.3 * z, 0, TAU); c.fill(); } break;
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
          c.globalAlpha = 0.2 + 0.16 * pulse;
          const rg = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
          rg.addColorStop(0, 'rgba(255,40,10,0.15)'); rg.addColorStop(0.85, a.data.fire ? 'rgba(255,90,30,0.7)' : 'rgba(255,30,10,0.7)'); rg.addColorStop(1, 'rgba(255,30,10,0)');
          c.fillStyle = rg; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.restore(); c.fill();
          c.globalAlpha = 0.95; c.strokeStyle = '#ff6030'; c.lineWidth = 1.8 * z;
          c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, TAU); c.stroke();
          c.fillStyle = 'rgba(255,80,30,0.3)'; c.beginPath(); c.ellipse(sx, sy, rx * k, rx * 0.5 * k, 0, 0, TAU); c.fill();
          c.restore();
          break;
        }
        case 'burn': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const g2 = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
          g2.addColorStop(0, `rgba(255,140,40,${0.45 * (1 - a.t / a.dur)})`); g2.addColorStop(1, 'rgba(255,40,0,0)');
          c.fillStyle = g2; c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, TAU); c.fill(); c.restore();
          if (Math.random() < 0.8) {
            const ax = a.x + (Math.random() - 0.5) * a.r * 1.4, ay = a.y + (Math.random() - 0.5) * a.r * 1.4;
            this.fx.add({ x: ax, y: ay, z: 2, vz: 50, color: Math.random() < 0.5 ? '#ffa040' : '#ff5a10', kind: 'ember', size: 2, life: 0.7, add: true });
          }
          for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * TAU + a.id, rr = a.r * (0.3 + ((i * 37) % 7) / 10);
            const fx2 = cam.sxOf(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr), fy2 = cam.syOf(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr);
            c.save(); c.translate(fx2, fy2); c.scale(z, z); flame(c, 0, 0, 1.1 * (1 - (a.t / a.dur) * 0.6), this.time, a.id + i); c.restore();
          }
          break;
        }
        case 'rain': {
          c.save(); c.globalAlpha = 0.3; c.strokeStyle = '#e0d8c0'; c.lineWidth = 1 * z; c.setLineDash([4 * z, 4 * z]);
          c.beginPath(); c.ellipse(sx, sy, rx, rx * 0.5, 0, 0, TAU); c.stroke(); c.restore();
          break;
        }
        case 'nova': case 'bossNova': case 'lightningRing': case 'firewave': {
          const k = Math.min(1, a.t / a.dur);
          const rr = rx * k;
          const col = a.kind === 'lightningRing' ? '255,255,140' : a.kind === 'firewave' ? '255,120,30' : a.data.cold ? '150,210,255' : '255,160,80';
          c.save(); c.globalCompositeOperation = 'lighter';
          const rg = c.createRadialGradient(sx, sy, Math.max(0, rr - 18 * z), sx, sy, rr + 6 * z);
          rg.addColorStop(0, `rgba(${col},0)`); rg.addColorStop(0.7, `rgba(${col},${0.8 * (1 - k * 0.5)})`); rg.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = rg; c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.beginPath(); c.arc(0, 0, rr + 6 * z, 0, TAU); c.restore(); c.fill();
          c.lineWidth = 2.5 * z; c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; c.beginPath(); c.ellipse(sx, sy, rr, rr * 0.5, 0, 0, TAU); c.stroke();
          c.restore();
          if (a.kind === 'firewave' && Math.random() < 0.9) { for (let i = 0; i < 2; i++) { const ang = Math.random() * TAU; this.fx.add({ x: a.x + Math.cos(ang) * a.r * k, y: a.y + Math.sin(ang) * a.r * k, z: 4, vz: 70, color: '#ffb040', kind: 'ember', size: 2.2, life: 0.5, add: true }); } }
          if (a.kind === 'lightningRing' && Math.random() < 0.5) { const ang = Math.random() * TAU; this.fx.add({ x: a.x + Math.cos(ang) * a.r * k, y: a.y + Math.sin(ang) * a.r * k, z: 10, vz: 40, color: '#ffffa0', kind: 'glint', size: 1.4, life: 0.25, add: true }); }
          break;
        }
        default: {
          const art = AREA_ART[a.kind];
          if (art) { c.save(); art.draw(a, { c, cam, z, time: this.time, fx: this.fx, sx, sy, rx }); c.restore(); }
        }
      }
    }
  }

  /** Over-actor layer of class areas (clouds, pillars). */
  private drawAreasAir(g: Game): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    for (const a of g.world.areas) {
      const art = AREA_ART[a.kind];
      if (!art?.air) continue;
      c.save(); art.air(a, { c, cam, z, time: this.time, fx: this.fx, sx: cam.sxOf(a.x, a.y), sy: cam.syOf(a.x, a.y), rx: a.r * RX * z }); c.restore();
    }
  }

  private drawDrop(d: Drop): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(d.x, d.y), sy = cam.syOf(d.x, d.y);
    if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40) return;
    const pop = Math.min(1, d.t / 0.35);
    const jump = Math.sin(pop * Math.PI) * 26 * z;
    if (d.gold) {
      const n = Math.min(7, 1 + Math.floor(Math.log2(d.gold + 1) / 1.4));
      for (let i = 0; i < n; i++) {
        const gx = sx + ((i * 5) % 9 - 4) * z, gy = sy - jump + ((i * 3) % 4 - 2) * z;
        c.fillStyle = '#7a5a10'; c.beginPath(); c.ellipse(gx, gy + 0.6 * z, 2.8 * z, 1.5 * z, 0, 0, TAU); c.fill();
        c.fillStyle = '#d8a830'; c.beginPath(); c.ellipse(gx, gy, 2.6 * z, 1.35 * z, 0, 0, TAU); c.fill();
      }
      if (Math.sin(this.time * 4 + d.id) > 0.92) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#fff4c0'; c.fillRect(sx - 3 * z, sy - jump - 0.3 * z, 6 * z, 0.6 * z); c.fillRect(sx - 0.3 * z, sy - jump - 3 * z, 0.6 * z, 6 * z); c.restore(); }
      return;
    }
    if (d.pot) {
      const col = d.pot === 'hp' ? '#d02020' : d.pot === 'mp' ? '#2040d0' : '#e0d0a0';
      c.save(); c.translate(sx, sy - jump); c.scale(z, z);
      if (d.pot === 'scroll') { c.fillStyle = col; c.fillRect(-5, -4, 10, 5); c.fillStyle = '#a08050'; c.fillRect(-6, -5, 2, 7); c.fillRect(4, -5, 2, 7); }
      else {
        const g = c.createRadialGradient(-1.2, -4.5, 0.4, 0, -3, 4.2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, shade(col, -0.5));
        c.fillStyle = g; c.beginPath(); c.arc(0, -3, 4, 0, TAU); c.fill(); c.fillStyle = '#d0c8b0'; c.fillRect(-1.2, -9, 2.4, 3);
      }
      c.restore();
      return;
    }
    if (d.item) {
      const icon = itemIcon(d.item);
      const s = 20 * z;
      if (d.item.rarity !== 'normal') {
        c.save(); c.globalCompositeOperation = 'lighter';
        const col = d.item.rarity === 'unique' ? '200,160,80' : d.item.rarity === 'rare' ? '240,220,90' : '120,140,255';
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, s);
        g.addColorStop(0, `rgba(${col},${0.35 + 0.15 * Math.sin(this.time * 3 + d.id)})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.beginPath(); c.ellipse(sx, sy, s, s * 0.5, 0, 0, TAU); c.fill(); c.restore();
      }
      c.save(); c.translate(sx, sy - jump); c.rotate(-0.5 + (1 - pop) * 6);
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
      const spell = skillAnim(h.cls, a.skill) === 'cast';
      void basic;
      if (a.kind === 'leap') atk = -1;
      else if (spell || a.skill === 'warcry' || a.skill === 'berserk') cast = p;
      else atk = p;
      if (a.kind === 'dash' && Math.random() < 0.9) this.fx.effect('afterimage', h.x, h.y, 0.3);
    }
    const p = this.pose(h, { atk, cast, hit: h.hitT > 0 ? h.hitT : 0, dead: h.dead ? h.deadT : -1, block: h.blockT > 0 ? 1 : 0, chill: h.chillT > 0, alpha: h.invulnT > 0 && a?.kind === 'dash' ? 0.35 : 1 });
    if (a?.kind === 'channel') { p.atk = (a.t * 7) % 1; }
    let lift = 0;
    if (a?.kind === 'leap') lift = Math.sin((a.t / a.dur) * Math.PI) * 44;
    const c = this.c;
    if (h.buffs.some((b) => b.id === 'berserk')) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + 0.3 * Math.sin(this.time * 9);
      const gg = c.createRadialGradient(sx, sy - 26 * z, 0, sx, sy - 26 * z, 40 * z);
      gg.addColorStop(0, `rgba(255,40,20,${0.35 * pulse})`); gg.addColorStop(1, 'rgba(255,0,0,0)');
      c.fillStyle = gg; c.beginPath(); c.ellipse(sx, sy - 26 * z, 30 * z, 44 * z, 0, 0, TAU); c.fill(); c.restore();
      if (Math.random() < 0.5) this.fx.add({ x: h.x + (Math.random() - 0.5) * 0.5, y: h.y + (Math.random() - 0.5) * 0.5, z: 10 + Math.random() * 40, vz: 50, color: '#ff4020', kind: 'ember', size: 1.8, life: 0.6, add: true });
    }
    if (h.buffs.some((b) => b.id === 'warcry')) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,200,80,0.5)'; c.lineWidth = 1.5 * z; c.beginPath(); c.ellipse(sx, sy, 22 * z, 11 * z, 0, 0, TAU); c.stroke(); c.restore(); }
    for (const b of h.buffs) BUFF_ART[b.id]?.(c, sx, sy, z, this.time, b, this.fx, h);
    if (h.buffs.some((b) => b.id === 'evade')) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(90,200,255,0.4)'; c.lineWidth = 1.2 * z; c.beginPath(); c.ellipse(sx, sy - 24 * z, 16 * z, 32 * z, 0, 0, TAU); c.stroke(); c.restore(); }
    const tintA = h.hitT > 0 ? Math.min(0.5, h.hitT * 2.4) : h.chillT > 0 ? 0.25 : 0;
    this.drawActorAt(sx, sy, z * ACTOR_SCALE, 'biped', L, p, lift, { rim: true, tint: h.hitT > 0 ? '#ff3020' : '#6ab0ff', tintA, light: { x: -0.6, y: -0.8 } });
  }

  private drawNpc(n: Npc): void {
    const cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(n.x, n.y), sy = cam.syOf(n.x, n.y);
    if (sx < -60 || sy < -80 || sx > cam.w + 60 || sy > cam.h + 60) return;
    const p = this.pose({ anim: n.anim, moving: false, facing: n.facing }, {});
    const hov = this.hover?.kind === 'npc' && this.hover.id === n.id;
    this.drawActorAt(sx, sy, z * ACTOR_SCALE, 'biped', npcLook(n.kind), p, 0, { rim: true, outline: hov ? 'rgba(255,220,140,0.9)' : null });
    const c = this.c;
    c.font = `700 ${Math.round(12.5 * Math.max(0.85, Math.min(1.3, z)))}px "Nanum Myeongjo", Georgia, serif`; c.textAlign = 'center';
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(n.name, sx, sy - 76 * z);
    c.fillStyle = hov ? '#ffffff' : '#e8d8a0'; c.fillText(n.name, sx, sy - 76 * z);
  }

  private drawMonster(g: Game, m: Monster): void {
    const cam = this.cam, z = cam.zoom;
    const t = MONSTERS[m.tpl];
    let sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y);
    if (sx < -100 || sy < -140 || sx > cam.w + 100 || sy > cam.h + 100) return;
    if (m.dead) {
      if (m.deathStyle === 'gib' || m.deathStyle === 'shatter' || m.deathStyle === 'bones') return;
      if (m.deathStyle === 'zap' && m.deadT > 0.25) return;
      if (m.deathStyle === 'burn' && m.deadT > 2.2) return;
    }
    const rc = this.recoil.get(m.id);
    let squash = 1;
    if (rc && !m.dead) {
      const kk = rc.t / 0.16;
      const px = (rc.dx - rc.dy) * 0.707, py = (rc.dx + rc.dy) * 0.354;
      const l = Math.hypot(px, py) || 1;
      sx += (px / l) * 5 * rc.p * kk * z; sy += (py / l) * 3 * rc.p * kk * z;
      squash = 1 - 0.06 * rc.p * kk;
    }
    const L = monsterLook(t.art, t.color, t.color2);
    if (t.art === 'knight') L.armorTier = 3;
    const a = m.act;
    let atk = -1, cast = -1;
    if (a) { const p = Math.min(1, a.t / a.dur); if (a.kind === 'cast' || a.kind === 'shoot' && (L.weapon === 'staff' || L.weapon === 'none')) cast = p; else atk = p; }
    const hf = this.hitFlash.get(m.id) ?? 0;
    const p = this.pose(m, { atk, cast, hit: hf, dead: m.dead ? m.deadT : -1, frozen: m.freezeT > 0, chill: m.chillT > 0, alpha: m.alpha });
    if (m.freezeT > 0) p.moving = false;
    if (m.dead && m.deathStyle === 'burn') p.alpha = Math.max(0, 1 - Math.max(0, m.deadT - 0.6) / 1.6);
    const scale = t.scale * ACTOR_SCALE * (m.rank === 'champion' || m.rank === 'unique' ? 1.12 : 1);
    const lift = t.flying && !m.dead ? 6 : 0;
    const c = this.c;
    const hovered = !m.dead && this.hover?.kind === 'monster' && this.hover.id === m.id;
    if (!m.dead && (m.rank === 'unique' || m.rank === 'champion' || m.rank === 'boss')) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const col = m.rank === 'unique' ? '255,190,70' : m.rank === 'boss' ? '255,60,30' : '90,130,255';
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 3 + m.id);
      const g2 = c.createRadialGradient(sx, sy, 0, sx, sy, 26 * z * scale);
      g2.addColorStop(0, `rgba(${col},${0.4 * pulse})`); g2.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g2; c.beginPath(); c.ellipse(sx, sy, 26 * z * scale, 13 * z * scale, 0, 0, TAU); c.fill(); c.restore();
    }
    let tint: string | null = null, tintA = 0;
    if (hf > 0) { tint = '#ffffff'; tintA = Math.min(0.85, hf * 7); }
    else if (m.freezeT > 0) { tint = '#8ad0ff'; tintA = 0.5; }
    else if (m.chillT > 0) { tint = '#6aa8ff'; tintA = 0.22; }
    else if (m.poison) { tint = '#50c030'; tintA = 0.2; }
    if (m.dead && m.deathStyle === 'burn') { tint = '#000000'; tintA = Math.min(0.85, m.deadT * 1.5); }
    if (m.dead && m.deathStyle === 'zap') { tint = '#ffffc0'; tintA = 0.8; }
    const outline = hovered ? 'rgba(255,50,30,0.95)' : m.rank === 'champion' && !m.dead ? 'rgba(80,120,255,0.7)' : m.rank === 'unique' && !m.dead ? 'rgba(255,180,60,0.75)' : m.rank === 'boss' && !m.dead ? 'rgba(255,70,20,0.6)' : null;
    const hero = g.hero;
    const lx = cam.sxOf(hero.x, hero.y) - sx, ly = cam.syOf(hero.x, hero.y) - sy;
    const ll = Math.hypot(lx, ly) || 1;
    const near = ll < (hero.st.light + 1) * RX * z;
    this.drawActorAt(sx, sy, z * scale * squash, t.art, L, p, lift, { rim: !m.dead && near && m.rank !== 'normal' && m.rank !== 'minion', outline: near || hovered ? outline : null, tint, tintA, light: { x: lx / ll, y: ly / ll } });
    if (m.freezeT > 0 && !m.dead) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const a2 = i * 1.3 + m.id; const px = sx + Math.cos(a2) * 9 * z * scale, py = sy - (8 + i * 7) * z * scale; c.fillStyle = 'rgba(210,240,255,0.7)'; c.beginPath(); c.moveTo(px, py - 4 * z); c.lineTo(px + 1.6 * z, py); c.lineTo(px, py + 4 * z); c.lineTo(px - 1.6 * z, py); c.fill(); }
      c.restore();
    }
    if (m.dead && m.deathStyle === 'burn' && m.deadT < 2 && Math.random() < 0.6) this.fx.add({ x: m.x + (Math.random() - 0.5) * 0.6, y: m.y + (Math.random() - 0.5) * 0.6, z: Math.random() * 12, vz: 40, color: '#ff8030', kind: 'ember', size: 1.6, life: 0.7, add: true });
    if (m.stunT > 0 && !m.dead) {
      c.save(); c.fillStyle = '#ffe060';
      for (let i = 0; i < 3; i++) { const a2 = this.time * 5 + (i * TAU) / 3; c.beginPath(); c.arc(sx + Math.cos(a2) * 9 * z, sy - (58 * t.scale + 4) * z + Math.sin(a2) * 3 * z, 2 * z, 0, TAU); c.fill(); }
      c.restore();
    }
  }

  // ------------------------------------------------------------ projectiles
  private updateTrails(w: World): void {
    const seen = new Set<number>();
    for (const p of w.projs) {
      seen.add(p.id);
      let t = this.trails.get(p.id);
      if (!t) { t = { pts: [], kind: p.kind, side: p.side, gone: 0 }; this.trails.set(p.id, t); }
      t.pts.push(p.x, p.y);
      const max = p.kind === 'fireball' || p.kind === 'bolt' ? 18 : 12;
      if (t.pts.length > max) t.pts.splice(0, t.pts.length - max);
    }
    for (const [id, t] of this.trails) {
      if (seen.has(id)) continue;
      t.gone += 1;
      if (t.pts.length >= 4) t.pts.splice(0, 2); else t.pts = [];
      if (!t.pts.length || t.gone > 20) this.trails.delete(id);
    }
  }

  private drawTrails(): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    const cols: Record<string, [string, number]> = {
      arrow: ['235,230,210', 1.4], explode: ['255,150,50', 2.6], bolt: ['180,130,255', 4], orb: ['180,130,255', 4], fireball: ['255,140,40', 7], firebolt: ['255,130,40', 4], meteor: ['255,140,40', 7],
      coldbolt: ['140,210,255', 3.2], frost: ['140,210,255', 3.2], bone: ['220,210,255', 2.4], skull: ['200,120,255', 3], spit: ['255,150,40', 3], poison: ['120,255,80', 3], blood: ['255,50,90', 3.4], shadow: ['140,40,200', 3], lightning: ['255,255,160', 2.6], spark: ['255,255,160', 1.8],
    };
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const t of this.trails.values()) {
      if (t.pts.length < 4) continue;
      const [col, wd] = cols[t.kind] ?? PROJ_ART[t.kind]?.trail ?? ['255,255,255', 2];
      const n = t.pts.length / 2;
      for (let i = 1; i < n; i++) {
        const a = i / n;
        c.strokeStyle = `rgba(${col},${0.55 * a * (t.gone ? Math.max(0, 1 - t.gone / 10) : 1)})`;
        c.lineWidth = wd * z * (0.35 + a * 0.65);
        c.beginPath();
        c.moveTo(cam.sxOf(t.pts[(i - 1) * 2], t.pts[(i - 1) * 2 + 1]), cam.syOf(t.pts[(i - 1) * 2], t.pts[(i - 1) * 2 + 1]) - 18 * z);
        c.lineTo(cam.sxOf(t.pts[i * 2], t.pts[i * 2 + 1]), cam.syOf(t.pts[i * 2], t.pts[i * 2 + 1]) - 18 * z);
        c.stroke();
      }
    }
    c.restore();
  }

  private drawProj(p: Proj): void {
    const c = this.c, cam = this.cam, z = cam.zoom;
    const sx = cam.sxOf(p.x, p.y), sy = cam.syOf(p.x, p.y) - 18 * z;
    const vx = cam.sxOf(p.x + p.vx, p.y + p.vy) - cam.sxOf(p.x, p.y), vy = cam.syOf(p.x + p.vx, p.y + p.vy) - cam.syOf(p.x, p.y);
    const ang = Math.atan2(vy, vx);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(sx, sy + 18 * z, 5 * z, 2.2 * z, 0, 0, TAU); c.fill();
    const art = PROJ_ART[p.kind];
    if (art) { art.draw(p, { c, cam, z, time: this.time, fx: this.fx, sx, sy, ang }); return; }
    c.save();
    c.translate(sx, sy);
    switch (p.kind) {
      case 'arrow': case 'explode': {
        c.rotate(ang); c.scale(z, z);
        c.strokeStyle = '#8a6a40'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-13, 0); c.lineTo(7, 0); c.stroke();
        c.fillStyle = p.kind === 'explode' ? '#ff8030' : '#d8d8d8'; c.beginPath(); c.moveTo(6, -2.2); c.lineTo(11, 0); c.lineTo(6, 2.2); c.fill();
        c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(-13, 0); c.lineTo(-16, -2.8); c.lineTo(-10, 0); c.lineTo(-16, 2.8); c.fill();
        if (p.kind === 'explode') { flame(c, 8, 1, 0.6, this.time, p.id); if (Math.random() < 0.7) this.fx.add({ x: p.x, y: p.y, z: 18, vz: 20, color: '#ffa040', kind: 'ember', size: 1.6, life: 0.35, add: true }); }
        break;
      }
      case 'bolt': case 'orb': {
        c.globalCompositeOperation = 'lighter';
        const r = 12 * z * (1 + 0.12 * Math.sin(this.time * 30 + p.id));
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,245,255,1)'); g.addColorStop(0.3, 'rgba(190,140,255,0.9)'); g.addColorStop(1, 'rgba(90,40,200,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(230,210,255,0.8)'; c.lineWidth = 1 * z;
        for (let i = 0; i < 3; i++) { const a0 = this.time * 12 + i * 2.1; c.beginPath(); c.arc(0, 0, r * 0.55, a0, a0 + 1.1); c.stroke(); }
        if (Math.random() < 0.7) this.fx.add({ x: p.x, y: p.y, z: 18, color: '#c0a0ff', kind: 'spark', size: 1.4, life: 0.3, add: true, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5) });
        break;
      }
      case 'fireball': case 'firebolt': case 'meteor': {
        const big = p.kind === 'fireball';
        const r = (big ? 14 : 8) * z;
        c.globalCompositeOperation = 'lighter';
        c.save(); c.rotate(ang);
        const tg = c.createLinearGradient(-r * 3, 0, r, 0);
        tg.addColorStop(0, 'rgba(255,60,0,0)'); tg.addColorStop(0.6, 'rgba(255,120,30,0.75)'); tg.addColorStop(1, 'rgba(255,220,120,0.95)');
        c.fillStyle = tg; c.beginPath(); c.moveTo(r * 0.8, -r * 0.7); c.quadraticCurveTo(-r * 1.5, -r * 0.6 + Math.sin(this.time * 40) * r * 0.2, -r * 3.2, 0); c.quadraticCurveTo(-r * 1.5, r * 0.6 + Math.cos(this.time * 37) * r * 0.2, r * 0.8, r * 0.7); c.closePath(); c.fill();
        c.restore();
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.35, 'rgba(255,170,60,0.95)'); g.addColorStop(1, 'rgba(200,40,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        if (Math.random() < 0.95) this.fx.add({ x: p.x, y: p.y, z: 18, vz: 30, vx: -p.vx * 0.05 + (Math.random() - 0.5), vy: -p.vy * 0.05 + (Math.random() - 0.5), color: Math.random() < 0.5 ? '#ff9030' : '#ffd060', kind: 'ember', size: big ? 2.6 : 1.7, life: 0.4, add: true });
        if (big && Math.random() < 0.35) this.fx.add({ x: p.x, y: p.y, z: 22, vz: 20, color: '#302824', kind: 'smoke', size: 4, life: 0.8 });
        break;
      }
      case 'coldbolt': case 'frost': {
        c.rotate(ang); c.scale(z, z);
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 10); g.addColorStop(0, 'rgba(200,240,255,0.6)'); g.addColorStop(1, 'rgba(100,180,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
        c.fillStyle = 'rgba(160,220,255,0.95)'; c.beginPath(); c.moveTo(9, 0); c.lineTo(-4, -3.4); c.lineTo(-11, 0); c.lineTo(-4, 3.4); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.moveTo(7, 0); c.lineTo(-3, -1.3); c.lineTo(-3, 1.3); c.fill();
        if (Math.random() < 0.5) this.fx.add({ x: p.x, y: p.y, z: 18, color: '#d8f4ff', kind: 'ice', size: 1, life: 0.4, add: true, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5) });
        break;
      }
      case 'bone': case 'skull': {
        c.rotate(this.time * 14); c.scale(z, z);
        c.fillStyle = '#e8e0cc'; c.fillRect(-6, -1.2, 12, 2.4); c.beginPath(); c.arc(-6, -1.5, 1.8, 0, 7); c.arc(-6, 1.5, 1.8, 0, 7); c.arc(6, -1.5, 1.8, 0, 7); c.arc(6, 1.5, 1.8, 0, 7); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(160,80,255,0.35)'; c.beginPath(); c.arc(0, 0, 10, 0, 7); c.fill();
        break;
      }
      case 'spit': case 'poison': {
        c.scale(z, z);
        c.fillStyle = p.kind === 'poison' ? '#70d030' : '#ff8020';
        c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = p.kind === 'poison' ? 'rgba(120,255,80,0.4)' : 'rgba(255,200,80,0.45)'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill();
        break;
      }
      case 'blood': case 'shadow': {
        c.rotate(this.time * 8); c.scale(z, z);
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, 'rgba(255,60,100,0.6)'); g.addColorStop(1, 'rgba(255,0,60,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,40,80,0.95)';
        c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 8; const a = (i / 10) * TAU; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
        break;
      }
      case 'lightning': case 'spark': {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(255,255,170,0.95)'; c.lineWidth = 2.2 * z;
        c.beginPath(); c.moveTo(-9 * z, 0); for (let i = -2; i <= 2; i++) c.lineTo(i * 4.5 * z, (Math.random() - 0.5) * 9 * z); c.stroke();
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 9 * z); g.addColorStop(0, 'rgba(255,255,220,0.7)'); g.addColorStop(1, 'rgba(255,255,120,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 9 * z, 0, 7); c.fill();
        break;
      }
    }
    c.restore();
  }

  private spawnAmbient(g: Game, x0: number, y0: number, x1: number, y1: number, dt: number): void {
    const w = g.world, h = g.hero;
    if (this.quality === 0 || this.lowFx || dt <= 0) return;
    for (const p of w.props) {
      if (p.used || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if ((p.kind === 'torch' || p.kind === 'brazier') && Math.random() < 0.08) this.fx.add({ x: p.x + (p.kind === 'torch' ? (p.face === 0 ? 0 : 0.5) : 0), y: p.y + (p.kind === 'torch' ? (p.face === 0 ? 0.5 : 0) : 0), z: p.kind === 'torch' ? 45 : 22, vz: 34, vx: (Math.random() - 0.5) * 0.3, color: '#ffb040', kind: 'ember', size: 1.3, life: 1, add: true });
      if (p.kind === 'lavavent' && Math.random() < 0.08) this.fx.add({ x: p.x, y: p.y, z: 2, vz: 25, color: '#403028', kind: 'smoke', size: 5, life: 1.6 });
      if (p.kind === 'portal' && Math.random() < 0.35) this.fx.add({ x: p.x + (Math.random() - 0.5) * 0.4, y: p.y + (Math.random() - 0.5) * 0.4, z: 10 + Math.random() * 30, vz: 20, color: '#90c0ff', kind: 'spark', size: 1.3, life: 0.6, add: true });
      if (p.kind === 'shrine' && Math.random() < 0.08) this.fx.add({ x: p.x, y: p.y, z: 30, vz: 15, vx: (Math.random() - 0.5) * 0.4, color: SHRINES[p.variant % SHRINES.length].color, kind: 'star', size: 1, life: 1, add: true });
    }
    if (w.zone >= 3) {
      for (let k = 0; k < 3; k++) {
        const x = Math.floor(x0 + Math.random() * (x1 - x0)), y = Math.floor(y0 + Math.random() * (y1 - y0));
        if (w.tiles[y * w.w + x] === T_LAVA) this.fx.add({ x: x + Math.random(), y: y + Math.random(), z: 0, vz: 30 + Math.random() * 40, color: '#ff9030', kind: 'ember', size: 1.5, life: 1.2, add: true });
      }
    }
    // dust motes floating in the hero's light / fireflies in town
    if (Math.random() < (w.zone === 0 ? 0.25 : 0.35)) {
      const a = Math.random() * TAU, r = Math.random() * h.st.light * 0.8;
      if (w.zone === 0) this.fx.add({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, z: 10 + Math.random() * 30, vz: (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, color: '#d8ff80', kind: 'dot', size: 1, life: 2.5, add: true });
      else this.fx.add({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, z: 5 + Math.random() * 50, vz: 3, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, color: 'rgba(255,230,200,0.6)', kind: 'dot', size: 0.7, life: 3.5, add: true });
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
    const warm: { x: number; y: number; r: number; col: string; a: number; lift?: number }[] = [];
    const light = (wx: number, wy: number, r: number, strength = 1, lift = 0) => {
      const sx = cam.sxOf(wx, wy) * s, sy = (cam.syOf(wx, wy) - lift * z) * s;
      const rx = r * RX * z * s;
      if (rx <= 0 || sx < -rx || sy < -rx || sx > W + rx || sy > H + rx) return;
      dc.save(); dc.translate(sx, sy); dc.scale(1, 0.56);
      const gr = dc.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`); gr.addColorStop(0.45, `rgba(0,0,0,${strength * 0.85})`); gr.addColorStop(0.78, `rgba(0,0,0,${strength * 0.35})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = gr; dc.beginPath(); dc.arc(0, 0, rx, 0, TAU); dc.fill();
      dc.restore();
    };
    const h = g.hero;
    const flick = 1 + Math.sin(this.time * 7) * 0.012;
    light(h.x, h.y, h.st.light * (h.dead ? 0.5 : 1) * flick, 1);
    light(h.x, h.y, 2.4, 1);
    for (const p of w.props) {
      if (p.light <= 0 || p.x < x0 - 6 || p.x > x1 + 6 || p.y < y0 - 6 || p.y > y1 + 6) continue;
      if (p.used && p.kind === 'shrine') continue;
      const fl = p.kind === 'torch' || p.kind === 'brazier' || p.kind === 'candle' ? 1 + Math.sin(this.time * 9 + p.id) * 0.05 + Math.sin(this.time * 23 + p.id * 3) * 0.03 : 1;
      let px = p.x, py = p.y;
      if (p.kind === 'torch') { const tx = Math.floor(p.x), ty = Math.floor(p.y); if (p.face === 0) { px = tx + 0.5; py = ty + 1.6; } else { px = tx + 1.6; py = ty + 0.5; } }
      light(px, py, p.light * fl, 0.95);
      if (p.kind === 'torch' || p.kind === 'brazier' || p.kind === 'candle' || p.kind === 'lamp' || p.kind === 'lavavent') warm.push({ x: px, y: py, r: p.light * fl * 0.85, col: '255,140,50', a: 0.2 });
      if (p.kind === 'crystal') warm.push({ x: px, y: py, r: p.light, col: ['90,150,255', '170,100,255', '255,80,110'][p.variant % 3], a: 0.24 });
      if (p.kind === 'portal' || p.kind === 'waypoint') warm.push({ x: px, y: py, r: p.light, col: '80,140,255', a: 0.22 });
    }
    let lavaN = 0;
    for (let y = y0; y <= y1 && lavaN < 70; y += 2) for (let x = x0; x <= x1 && lavaN < 70; x += 2) {
      if (w.tiles[y * w.w + x] === T_LAVA) { light(x + 0.5, y + 0.5, 2.6, 0.7); lavaN++; if (lavaN % 3 === 0) warm.push({ x: x + 0.5, y: y + 0.5, r: 2.5, col: '255,90,20', a: 0.14 }); }
    }
    for (const p of w.projs) {
      const pl = PROJ_ART[p.kind]?.light;
      if (pl) { if (pl[0] > 0) { light(p.x, p.y, pl[0], 0.85, 18); warm.push({ x: p.x, y: p.y, r: pl[0] * 0.75, col: pl[1], a: 0.26, lift: 18 }); } continue; }
      const r = p.kind === 'fireball' ? 3.4 : p.kind === 'arrow' ? 0 : 2;
      if (r > 0) { light(p.x, p.y, r, 0.85, 18); warm.push({ x: p.x, y: p.y, r: r * 0.75, col: p.kind === 'fireball' || p.kind === 'firebolt' || p.kind === 'explode' ? '255,140,40' : p.kind === 'coldbolt' ? '120,190,255' : p.kind === 'bolt' ? '170,120,255' : '255,255,160', a: 0.26, lift: 18 }); }
    }
    for (const e of this.fx.effects) {
      const k = e.t / e.dur;
      if (e.kind === 'explosion') { light(e.x, e.y, e.r * 3 * (1 - k), 1); warm.push({ x: e.x, y: e.y, r: e.r * 2.4 * (1 - k), col: '255,150,50', a: 0.45 }); }
      if ((e.kind === 'lightning' || e.kind === 'zap') && e.pts) for (let i = 0; i + 1 < e.pts.length; i += 2) { light(e.pts[i], e.pts[i + 1], 3.2 * (1 - k), 1, 18); warm.push({ x: e.pts[i], y: e.pts[i + 1], r: 2.2 * (1 - k), col: '180,190,255', a: 0.3 }); }
      if (e.kind === 'frostnova') { light(e.x, e.y, e.r * (1 - k), 0.6); warm.push({ x: e.x, y: e.y, r: e.r * (1 - k), col: '120,200,255', a: 0.18 }); }
      if (e.kind === 'beam') light(e.x, e.y, 1.6, 0.6);
      if (e.kind === 'levelup' || e.kind === 'bossDeath') light(e.x, e.y, 6 * (1 - k), 1);
      if (e.kind === 'hitflash' && e.heavy) warm.push({ x: e.x, y: e.y, r: 1.4 * (1 - k), col: e.c, a: 0.35 });
      if (e.kind === 'fireground') { light(e.x, e.y, e.r * 2, 0.6 * (1 - k)); warm.push({ x: e.x, y: e.y, r: e.r * 1.6, col: '255,120,30', a: 0.2 * (1 - k) }); }
      const el = EFFECT_ART[e.kind]?.light?.(e, k);
      if (el && el[0] > 0) { light(e.x, e.y, el[0], 0.9); warm.push({ x: e.x, y: e.y, r: el[0] * 0.8, col: el[1], a: 0.3 }); }
    }
    for (const a of w.areas) {
      const al = AREA_ART[a.kind]?.light?.(a);
      if (al && al[0] > 0) { light(a.x, a.y, al[0], 0.75); warm.push({ x: a.x, y: a.y, r: al[0] * 0.8, col: al[1], a: 0.24 }); }
      if (a.kind === 'burn' || a.kind === 'firewave' || a.kind === 'lightningRing') { light(a.x, a.y, a.kind === 'burn' ? a.r * 1.4 : a.r * Math.min(1, a.t / a.dur), 0.65); if (a.kind === 'burn') warm.push({ x: a.x, y: a.y, r: a.r * 1.3, col: '255,110,30', a: 0.22 }); }
      if ((a.kind === 'telegraph' || a.kind === 'meteor') && a.side === 'mon') light(a.x, a.y, a.r * 1.2, 0.55);
    }
    for (const m of w.monsters) {
      if (m.dead) continue;
      const t = MONSTERS[m.tpl];
      if (t.art === 'fireSpirit' || t.art === 'ignira' || t.art === 'malegath' || t.art === 'hound') { light(m.x, m.y, t.art === 'hound' ? 1.6 : 3, 0.8); warm.push({ x: m.x, y: m.y, r: 2, col: '255,120,30', a: 0.2 }); }
    }
    dc.globalCompositeOperation = 'source-over';
    const c = this.c;
    c.drawImage(this.dark, 0, 0, cam.w, cam.h);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const l of warm) {
      const sx = cam.sxOf(l.x, l.y), sy = cam.syOf(l.x, l.y) - (l.lift ?? 0) * z;
      const rx = l.r * RX * z;
      if (rx <= 0 || sx < -rx || sy < -rx || sx > cam.w + rx || sy > cam.h + rx) continue;
      c.save(); c.translate(sx, sy); c.scale(1, 0.56);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(${l.col},${l.a})`); gr.addColorStop(1, `rgba(${l.col},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
      c.restore();
    }
    c.restore();
    const [gc, ga] = GRADE[w.zone] ?? ['#808080', 0];
    if (ga > 0 && this.quality >= 1) { c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = ga; c.fillStyle = gc; c.fillRect(0, 0, cam.w, cam.h); c.restore(); }
    const vg = c.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.32, cam.w / 2, cam.h / 2, Math.max(cam.w, cam.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = vg; c.fillRect(0, 0, cam.w, cam.h);
    for (const e of this.fx.effects) {
      if (e.kind !== 'beam') continue;
      const sx = cam.sxOf(e.x, e.y), sy = cam.syOf(e.x, e.y);
      const k = e.t / e.dur;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, (1 - k) * 2) * 0.85;
      const gr = c.createLinearGradient(sx, sy - 240 * z, sx, sy);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, e.c);
      c.fillStyle = gr; c.fillRect(sx - 6 * z, sy - 240 * z, 12 * z, 240 * z);
      c.fillRect(sx - 2 * z, sy - 240 * z, 4 * z, 240 * z); c.restore();
    }
  }

  /** Full-screen feedback: low-health pulse and hurt flash. */
  private drawScreenFx(g: Game): void {
    const c = this.c, cam = this.cam, h = g.hero;
    const low = !h.dead && h.hp < h.st.maxHp * 0.3 ? 1 - h.hp / (h.st.maxHp * 0.3) : 0;
    const a = Math.max(this.hurtT > 0 ? this.hurtT * 1.1 : 0, low * (0.35 + 0.25 * Math.sin(this.time * 6)));
    if (a <= 0.01) return;
    const vg = c.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.3, cam.w / 2, cam.h / 2, Math.max(cam.w, cam.h) * 0.72);
    vg.addColorStop(0, 'rgba(160,0,0,0)'); vg.addColorStop(1, `rgba(160,0,0,${Math.min(0.65, a)})`);
    c.fillStyle = vg; c.fillRect(0, 0, cam.w, cam.h);
  }

  // ------------------------------------------------------------ labels & bars
  private drawLabels(g: Game): void {
    const c = this.c, cam = this.cam, z = cam.zoom, h = g.hero;
    this.labels = [];
    const fs = Math.round(12 * Math.max(0.9, Math.min(1.25, z)));
    c.font = `700 ${fs}px "Nanum Myeongjo", Georgia, serif`;
    c.textAlign = 'center';
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const drops = g.world.drops.filter((d) => d.item && Math.hypot(d.x - h.x, d.y - h.y) < 16).sort((a, b) => (a.y + a.x) - (b.y + b.x));
    for (const d of drops) {
      const it = d.item!;
      if (!this.showAll && it.rarity === 'normal' && Math.hypot(d.x - h.x, d.y - h.y) > 5 && !(this.hover?.kind === 'drop' && this.hover.id === d.id)) continue;
      const sx = cam.sxOf(d.x, d.y);
      let sy = cam.syOf(d.x, d.y) - 22 * z;
      const tw = c.measureText(it.name).width + 12;
      const lh = fs + 7;
      let box = { x0: sx - tw / 2, y0: sy - lh, x1: sx + tw / 2, y1: sy };
      for (let guard = 0; guard < 12 && placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0); guard++) {
        sy -= lh + 1; box = { x0: sx - tw / 2, y0: sy - lh, x1: sx + tw / 2, y1: sy };
      }
      placed.push(box);
      const hov = this.hover?.kind === 'drop' && this.hover.id === d.id;
      c.fillStyle = hov ? 'rgba(40,36,60,0.94)' : 'rgba(0,0,0,0.76)';
      c.fillRect(box.x0, box.y0, tw, lh);
      c.strokeStyle = hov ? RARITY_COLOR[it.rarity] : 'rgba(120,100,70,0.5)'; c.lineWidth = 1; c.strokeRect(box.x0 + 0.5, box.y0 + 0.5, tw - 1, lh - 1);
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
      const sx = cam.sxOf(m.x, m.y), sy = cam.syOf(m.x, m.y) - (56 * t.scale * ACTOR_SCALE + (t.flying ? 10 : 0)) * z;
      if (sx < 0 || sy < 0 || sx > cam.w || sy > cam.h) continue;
      const w2 = 28 * z;
      c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(sx - w2 / 2 - 1, sy - 1, w2 + 2, 4.5);
      const col = m.rank === 'unique' ? '#e0a030' : m.rank === 'champion' ? '#5070ff' : '#c02020';
      const gr = c.createLinearGradient(0, sy, 0, sy + 2.5); gr.addColorStop(0, shade(col, 0.3)); gr.addColorStop(1, col);
      c.fillStyle = gr; c.fillRect(sx - w2 / 2, sy, w2 * Math.max(0, m.hp / m.maxHp), 2.5);
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
        const [px, py] = P(p.x, p.y); ctx.fillStyle = p.kind === 'shrine' ? '#ffe060' : '#60a0ff'; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
      }
    }
    for (const n of w.npcs) { const [px, py] = P(n.x, n.y); ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill(); }
    for (const m of w.monsters) {
      if (m.dead || !w.explored[Math.floor(m.y) * w.w + Math.floor(m.x)]) continue;
      if (Math.hypot(m.x - h.x, m.y - h.y) > h.st.light + 1 && m.rank !== 'boss') continue;
      const [px, py] = P(m.x, m.y); ctx.fillStyle = m.rank === 'boss' ? '#ff2020' : m.rank === 'unique' ? '#ffb030' : m.rank === 'champion' ? '#6080ff' : '#d04040'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    const [hx, hy] = P(h.x, h.y);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
}
