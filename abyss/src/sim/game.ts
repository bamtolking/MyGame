// Game: owns the hero, the current world and all player-facing commands. Advances with fixed steps.
import { CLASSES, MAX_SKILL_RANK, SKILLS } from '../data/classes';
import { BASE_BY_ID } from '../data/items';
import { INV_SIZE, LAST_FLOOR, MAX_POTIONS, MAX_SCROLLS, PRICES, STASH_SIZE, floorMonsterLevel, floorName } from '../data/zones';
import { separate, updateMonster } from './ai';
import { autoPickup, updateAreas, updateProjs, useProp, wake } from './combat';
import { generateFloor, generateTown } from './dungeon';
import { baseOf, buyPrice, canEquipClass, genItem, sellPrice } from './items';
import { astar, circleFree, computeFlow, los, moveCircle, nearestWalkable, walkLine } from './path';
import { Rng } from './rng';
import { tryCast, updateAct } from './skills';
import { computeStats } from './stats';
import {
  EQUIP_SLOTS, type Attrs, type ClassId, type EquipSlot, type GEvent, type Hero, type Intent, type Item, type Prop, type Rarity, type World,
} from './types';

export const SAVE_VERSION = 1;
export const DT = 1 / 60;

export interface SaveData {
  v: number; cls: ClassId; name: string; level: number; xp: number; gold: number;
  attrs: Attrs; freePts: number; skillPts: number; skills: Record<string, number>;
  equip: Record<EquipSlot, Item | null>; inv: (Item | null)[];
  potHp: number; potMp: number; scrolls: number; rmbSkill: number;
  maxFloor: number[]; unlockedDiff: number; diff: number;
  kills: number; deaths: number; playTime: number; nextUid: number; bosses: Record<string, number>;
  seed: number; savedAt: number;
}

function mix(a: number, b: number): number {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

export function newHero(cls: ClassId, name: string): Hero {
  const c = CLASSES[cls];
  const equip = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null])) as Record<EquipSlot, Item | null>;
  const h: Hero = {
    id: 0, x: 0, y: 0, r: 0.3,
    cls, name, level: 1, xp: 0, gold: 40,
    attrs: { ...c.attrs }, freePts: 0, skillPts: 0, skills: { [c.skills[0]]: 1 },
    equip, inv: new Array(INV_SIZE).fill(null),
    potHp: 4, potMp: 3, scrolls: 2, rmbSkill: 0,
    hp: 1, mp: 1, st: null as never, dirty: true,
    facing: Math.PI / 2, anim: 0, moving: false, speedNow: 0,
    act: null, intent: null, path: null, pathGoal: null,
    cds: [0, 0, 0, 0, 0], buffs: [],
    potT: 0, hitT: 0, invulnT: 0, chillT: 0, blockT: 0, dead: false, deadT: 0, regenHp: 0, potHeal: 0,
    kills: 0, deaths: 0, playTime: 0,
  };
  return h;
}

export class Game {
  hero: Hero;
  world!: World;
  town: World | null = null;
  rng: Rng;
  seed: number;
  diff = 0;
  time = 0;
  events: GEvent[] = [];
  portal: { world: World; x: number; y: number; floor: number } | null = null;
  maxFloor = [0, 0, 0];
  unlockedDiff = 0;
  bosses: Record<string, number> = {};
  stash: (Item | null)[] = new Array(STASH_SIZE).fill(null);
  shop: Item[] = [];
  nextUid = 1;
  genCount = 0;
  private flowTimer = 0;
  private exploredTile = -1;
  private pathAge = 0;
  lastMsgT: Record<string, number> = {};

  constructor(cls: ClassId, name: string, seed: number, save?: SaveData) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed ^ 0x5eed);
    this.hero = newHero(cls, name);
    if (save) this.applySave(save);
    else {
      for (const id of CLASSES[cls].startGear) {
        const it = genItem(this.rng, this.nextUid++, 1, { base: id, rarity: 'normal' });
        const b = BASE_BY_ID[id];
        this.hero.equip[b.slot === 'ring' ? 'ring1' : (b.slot as EquipSlot)] = it;
      }
    }
    this.refreshStats();
    this.hero.hp = this.hero.st.maxHp; this.hero.mp = this.hero.st.maxMp;
    this.enterTown('spawn');
  }

  emit(e: GEvent): void { this.events.push(e); }
  drain(): GEvent[] { const e = this.events; this.events = []; return e; }
  msg(text: string, color = '#e8d8b0', key = text): void {
    const now = this.time;
    if (this.lastMsgT[key] !== undefined && now - this.lastMsgT[key] < 1.2) return;
    this.lastMsgT[key] = now;
    this.emit({ t: 'msg', text, color });
  }

  refreshStats(): void {
    const h = this.hero;
    h.st = computeStats(h, this.diff);
    h.hp = Math.min(h.hp, h.st.maxHp); h.mp = Math.min(h.mp, h.st.maxMp);
    h.dirty = false;
  }

  // ------------------------------------------------------------ save
  toSave(): SaveData {
    const h = this.hero;
    return {
      v: SAVE_VERSION, cls: h.cls, name: h.name, level: h.level, xp: h.xp, gold: h.gold,
      attrs: { ...h.attrs }, freePts: h.freePts, skillPts: h.skillPts, skills: { ...h.skills },
      equip: JSON.parse(JSON.stringify(h.equip)), inv: JSON.parse(JSON.stringify(h.inv)),
      potHp: h.potHp, potMp: h.potMp, scrolls: h.scrolls, rmbSkill: h.rmbSkill,
      maxFloor: [...this.maxFloor], unlockedDiff: this.unlockedDiff, diff: this.diff,
      kills: h.kills, deaths: h.deaths, playTime: h.playTime, nextUid: this.nextUid, bosses: { ...this.bosses },
      seed: this.seed, savedAt: Date.now(),
    };
  }
  private applySave(s: SaveData): void {
    const h = this.hero;
    h.name = s.name; h.level = s.level; h.xp = s.xp; h.gold = s.gold;
    h.attrs = { ...s.attrs }; h.freePts = s.freePts; h.skillPts = s.skillPts; h.skills = { ...s.skills };
    for (const k of EQUIP_SLOTS) h.equip[k] = s.equip?.[k] ?? null;
    h.inv = new Array(INV_SIZE).fill(null);
    (s.inv ?? []).slice(0, INV_SIZE).forEach((it, i) => { h.inv[i] = it; });
    h.potHp = s.potHp; h.potMp = s.potMp; h.scrolls = s.scrolls; h.rmbSkill = s.rmbSkill ?? 0;
    h.kills = s.kills ?? 0; h.deaths = s.deaths ?? 0; h.playTime = s.playTime ?? 0;
    this.maxFloor = [...(s.maxFloor ?? [0, 0, 0])];
    this.unlockedDiff = s.unlockedDiff ?? 0; this.diff = Math.min(s.diff ?? 0, this.unlockedDiff);
    this.nextUid = s.nextUid ?? 1; this.bosses = { ...(s.bosses ?? {}) };
    // guard uid collisions
    let maxUid = 0;
    for (const it of [...Object.values(h.equip), ...h.inv]) if (it) maxUid = Math.max(maxUid, it.uid);
    this.nextUid = Math.max(this.nextUid, maxUid + 1);
  }

  // ------------------------------------------------------------ worlds
  private newSeed(floor: number): number { return mix(mix(this.seed, floor * 7919 + this.diff * 104729), this.genCount++ + Math.floor(this.hero.playTime * 1000)); }

  private placeHero(x: number, y: number): void {
    const h = this.hero;
    const p = circleFree(this.world, x, y, h.r) ? { x, y } : nearestWalkable(this.world, x, y, 5) ?? this.world.start;
    h.x = p.x; h.y = p.y;
    h.intent = null; h.path = null; h.act = null; h.moving = false;
    this.world.flowTile = -1; this.exploredTile = -1; this.flowTimer = 0;
    this.world.projs = [];
  }

  enterTown(at: 'stairs' | 'waypoint' | 'portal' | 'spawn'): void {
    const fromDungeon = !this.world || this.world.floor !== 0;
    if (!this.town) this.town = generateTown(mix(this.seed, 99));
    this.world = this.town;
    const pos = at === 'stairs' ? { x: 23.5, y: 6.9 } : at === 'waypoint' ? { x: 26.5, y: 20.9 } : at === 'portal' ? { x: 21.5, y: 20.6 } : this.town.start;
    this.placeHero(pos.x, pos.y);
    if (fromDungeon || !this.shop.length) this.restock();
    this.emit({ t: 'zone', floor: 0, name: floorName(0) });
    this.emit({ t: 'save' });
  }

  enterFloor(floor: number, at: 'start' | 'down'): void {
    const w = generateFloor(floor, this.diff, this.newSeed(floor));
    this.world = w;
    if (at === 'down' && w.down) this.placeHero(w.down.x + 0.2, w.down.y + 1.1); else this.placeHero(w.start.x, w.start.y);
    if (floor > this.maxFloor[this.diff]) this.maxFloor[this.diff] = floor;
    this.emit({ t: 'zone', floor, name: w.name });
    this.emit({ t: 'sfx', id: 'stairs' });
    this.emit({ t: 'save' });
  }

  takeStairs(dir: 1 | -1): void {
    const w = this.world;
    if (dir > 0) {
      if (w.floor === 0) { this.enterFloor(1, 'start'); return; }
      if (w.downSealed) { this.msg('강력한 힘이 계단을 봉인하고 있다. 이 층의 주인을 쓰러뜨려야 한다.', '#ff9070'); return; }
      if (w.floor >= LAST_FLOOR) { this.msg('더 내려갈 곳이 없다.'); return; }
      this.enterFloor(w.floor + 1, 'start');
    } else {
      if (w.floor <= 1) this.enterTown('stairs');
      else this.enterFloor(w.floor - 1, 'down');
    }
  }

  /** Waypoint travel from town. */
  travel(floor: number, diff = this.diff): boolean {
    if (diff > this.unlockedDiff) return false;
    if (diff !== this.diff) { this.diff = diff; this.hero.dirty = true; this.portal = null; }
    if (floor === 0) { this.enterTown('waypoint'); return true; }
    if (floor > Math.max(1, this.maxFloor[diff])) return false;
    this.emit({ t: 'sfx', id: 'waypoint' });
    this.enterFloor(floor, 'start');
    return true;
  }

  useScroll(): void {
    const h = this.hero;
    if (h.dead) return;
    if (this.world.floor === 0) { this.msg('마을에서는 사용할 수 없다.'); return; }
    if (h.scrolls <= 0) { this.msg('귀환 두루마리가 없다.', '#ff8080'); this.emit({ t: 'sfx', id: 'error' }); return; }
    h.scrolls--;
    this.closePortal();
    const ax = h.x + Math.cos(h.facing) * 1.3, ay = h.y + Math.sin(h.facing) * 1.3;
    const p = circleFree(this.world, ax, ay, 0.4) && walkLine(this.world, h.x, h.y, ax, ay, 0.1) ? { x: ax, y: ay } : nearestWalkable(this.world, h.x + 1, h.y, 3) ?? { x: h.x, y: h.y };
    this.addPortalProp(this.world, p.x, p.y, 0);
    this.portal = { world: this.world, x: p.x, y: p.y, floor: this.world.floor };
    if (this.town) this.addPortalProp(this.town, 21.5, 19.5, this.world.floor);
    this.emit({ t: 'sfx', id: 'portal' });
    this.emit({ t: 'fx', kind: 'portalOpen', x: p.x, y: p.y });
  }
  private addPortalProp(w: World, x: number, y: number, dest: number): void {
    w.props.push({ id: w.nextId++, kind: 'portal', x, y, blocks: false, used: false, hp: 1, light: 4, face: 0, variant: 0, data: { dest } });
  }
  closePortal(): void {
    if (!this.portal) return;
    this.portal.world.props = this.portal.world.props.filter((p) => p.kind !== 'portal');
    if (this.town) this.town.props = this.town.props.filter((p) => p.kind !== 'portal');
    this.portal = null;
  }
  private enterPortal(p: Prop): void {
    if (p.data.dest === 0) { this.enterTown('portal'); this.emit({ t: 'sfx', id: 'portal' }); return; }
    if (!this.portal) return;
    const pr = this.portal;
    this.world = pr.world;
    this.placeHero(pr.x + 0.8, pr.y + 0.8);
    this.closePortal();
    this.emit({ t: 'zone', floor: this.world.floor, name: this.world.name });
    this.emit({ t: 'sfx', id: 'portal' });
  }

  respawn(): void {
    const h = this.hero;
    if (!h.dead) return;
    const lost = Math.floor(h.gold * 0.1);
    h.gold -= lost;
    h.dead = false; h.deadT = 0; h.buffs = []; h.dirty = true;
    this.refreshStats();
    h.hp = h.st.maxHp; h.mp = h.st.maxMp;
    this.closePortal();
    this.enterTown('spawn');
    if (lost > 0) this.msg(`쓰러지면서 금화 ${lost}개를 잃었다.`, '#ff9070');
  }

  // ------------------------------------------------------------ shop
  restock(): void {
    const lvl = Math.max(1, Math.min(this.hero.level + 1, floorMonsterLevel(Math.max(1, this.maxFloor[this.diff]), this.diff) + 2));
    const items: Item[] = [];
    for (let i = 0; i < 14; i++) {
      const rarity: Rarity = this.rng.chance(0.1) ? 'rare' : this.rng.chance(0.6) ? 'magic' : 'normal';
      items.push(genItem(this.rng, this.nextUid++, lvl, { rarity, cls: this.hero.cls }));
    }
    const order = ['weapon', 'offhand', 'head', 'chest', 'gloves', 'boots', 'belt', 'ring', 'amulet'];
    items.sort((a, b) => order.indexOf(baseOf(a).slot) - order.indexOf(baseOf(b).slot));
    this.shop = items;
  }
  gamblePrice(): number { return 120 + this.hero.level * 45; }

  // ------------------------------------------------------------ inventory
  invAdd(it: Item): number {
    const i = this.hero.inv.indexOf(null);
    if (i < 0) return -1;
    this.hero.inv[i] = it;
    return i;
  }
  private pickup(dropId: number): void {
    const w = this.world, h = this.hero;
    const d = w.drops.find((x) => x.id === dropId);
    if (!d) return;
    if (d.item) {
      if (this.invAdd(d.item) < 0) { this.msg('가방이 가득 찼다.', '#ff8080'); this.emit({ t: 'sfx', id: 'error' }); return; }
      this.emit({ t: 'pickup', item: d.item });
      this.emit({ t: 'sfx', id: 'pickup' });
    } else if (d.gold) h.gold += d.gold;
    else if (d.pot === 'hp') { if (h.potHp >= MAX_POTIONS) return; h.potHp++; }
    else if (d.pot === 'mp') { if (h.potMp >= MAX_POTIONS) return; h.potMp++; }
    else if (d.pot === 'scroll') { if (h.scrolls >= MAX_SCROLLS) return; h.scrolls++; }
    w.drops = w.drops.filter((x) => x !== d);
  }

  equipSlotFor(it: Item): EquipSlot {
    const b = baseOf(it);
    if (b.slot === 'ring') return !this.hero.equip.ring1 ? 'ring1' : !this.hero.equip.ring2 ? 'ring2' : 'ring1';
    return b.slot as EquipSlot;
  }
  canEquip(it: Item): string | null {
    const h = this.hero;
    if (!canEquipClass(it, h.cls)) return `${CLASSES[h.cls].name}은(는) 사용할 수 없는 물건이다.`;
    if (it.req > h.level) return `레벨 ${it.req} 이상이어야 사용할 수 있다.`;
    const b = baseOf(it);
    if (b.slot === 'offhand' && b.cat !== 'quiver' && h.equip.weapon && baseOf(h.equip.weapon).twoHanded) return '양손 무기를 들고 있어 함께 쓸 수 없다.';
    return null;
  }
  equipFromInv(i: number, slotOverride?: EquipSlot): boolean {
    const h = this.hero;
    const it = h.inv[i];
    if (!it) return false;
    const err = this.canEquip(it);
    if (err) { this.msg(err, '#ff8080'); this.emit({ t: 'sfx', id: 'error' }); return false; }
    const b = baseOf(it);
    const slot = slotOverride && (b.slot === 'ring') && (slotOverride === 'ring1' || slotOverride === 'ring2') ? slotOverride : this.equipSlotFor(it);
    if (slot === 'weapon' && b.twoHanded && h.equip.offhand && baseOf(h.equip.offhand).cat !== 'quiver') {
      const free = h.inv.findIndex((x, j) => x === null && j !== i);
      if (free < 0 && h.equip.weapon) { this.msg('방패를 넣을 가방 공간이 없다.', '#ff8080'); return false; }
      const off = h.equip.offhand; h.equip.offhand = null;
      if (free >= 0) h.inv[free] = off; else h.inv[i] = off;
      if (free < 0) { h.equip.weapon = it; this.afterGear(); return true; }
    }
    h.inv[i] = h.equip[slot];
    h.equip[slot] = it;
    this.afterGear();
    return true;
  }
  unequip(slot: EquipSlot): boolean {
    const h = this.hero;
    const it = h.equip[slot];
    if (!it) return false;
    const i = h.inv.indexOf(null);
    if (i < 0) { this.msg('가방이 가득 찼다.', '#ff8080'); return false; }
    h.inv[i] = it; h.equip[slot] = null;
    this.afterGear();
    return true;
  }
  private afterGear(): void { this.hero.dirty = true; this.refreshStats(); this.emit({ t: 'sfx', id: 'equip' }); }

  dropFromInv(i: number): void {
    const h = this.hero;
    const it = h.inv[i];
    if (!it) return;
    h.inv[i] = null;
    const p = nearestWalkable(this.world, h.x + 0.6, h.y + 0.6, 3) ?? { x: h.x, y: h.y };
    this.world.drops.push({ id: this.world.nextId++, x: p.x, y: p.y, item: it, t: 0 });
    this.emit({ t: 'sfx', id: 'drop' });
  }
  sell(i: number): void {
    const h = this.hero;
    const it = h.inv[i];
    if (!it || this.world.floor !== 0) return;
    h.gold += sellPrice(it);
    h.inv[i] = null;
    this.emit({ t: 'sfx', id: 'gold' });
  }
  buy(j: number): void {
    const h = this.hero;
    const it = this.shop[j];
    if (!it) return;
    const price = buyPrice(it);
    if (h.gold < price) { this.msg('금화가 부족하다.', '#ff8080'); this.emit({ t: 'sfx', id: 'error' }); return; }
    if (this.invAdd(it) < 0) { this.msg('가방이 가득 찼다.', '#ff8080'); return; }
    h.gold -= price;
    this.shop.splice(j, 1);
    this.emit({ t: 'sfx', id: 'gold' });
  }
  buyPotion(kind: 'hp' | 'mp' | 'scroll', n = 1): void {
    const h = this.hero;
    for (let k = 0; k < n; k++) {
      const price = kind === 'hp' ? PRICES.potHp : kind === 'mp' ? PRICES.potMp : PRICES.scroll;
      if (h.gold < price) { this.msg('금화가 부족하다.', '#ff8080'); this.emit({ t: 'sfx', id: 'error' }); return; }
      if (kind === 'hp' && h.potHp >= MAX_POTIONS) { this.msg('더 들 수 없다.'); return; }
      if (kind === 'mp' && h.potMp >= MAX_POTIONS) { this.msg('더 들 수 없다.'); return; }
      if (kind === 'scroll' && h.scrolls >= MAX_SCROLLS) { this.msg('더 들 수 없다.'); return; }
      h.gold -= price;
      if (kind === 'hp') h.potHp++; else if (kind === 'mp') h.potMp++; else h.scrolls++;
    }
    this.emit({ t: 'sfx', id: 'gold' });
  }
  gamble(slot: 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'boots' | 'belt' | 'ring' | 'amulet'): Item | null {
    const h = this.hero;
    const price = this.gamblePrice();
    if (h.gold < price) { this.msg('금화가 부족하다.', '#ff8080'); this.emit({ t: 'sfx', id: 'error' }); return null; }
    if (h.inv.indexOf(null) < 0) { this.msg('가방이 가득 찼다.', '#ff8080'); return null; }
    h.gold -= price;
    const r = this.rng.next();
    const rarity: Rarity = r < 0.035 ? 'unique' : r < 0.2 ? 'rare' : 'magic';
    const it = genItem(this.rng, this.nextUid++, h.level + this.rng.irange(0, 4), { rarity, cls: h.cls, slot });
    this.invAdd(it);
    this.emit({ t: 'sfx', id: rarity === 'unique' ? 'uniqueDrop' : 'gold' });
    return it;
  }
  stashPut(i: number): void {
    const h = this.hero;
    const it = h.inv[i];
    if (!it) return;
    const j = this.stash.indexOf(null);
    if (j < 0) { this.msg('보관함이 가득 찼다.', '#ff8080'); return; }
    this.stash[j] = it; h.inv[i] = null;
    this.emit({ t: 'sfx', id: 'drop' });
  }
  stashTake(j: number): void {
    const it = this.stash[j];
    if (!it) return;
    const i = this.hero.inv.indexOf(null);
    if (i < 0) { this.msg('가방이 가득 찼다.', '#ff8080'); return; }
    it.uid = this.nextUid++;
    this.hero.inv[i] = it; this.stash[j] = null;
    this.emit({ t: 'sfx', id: 'pickup' });
  }
  sortInv(): void {
    const h = this.hero;
    const order = ['weapon', 'offhand', 'head', 'chest', 'gloves', 'boots', 'belt', 'ring', 'amulet'];
    const rr: Record<string, number> = { unique: 0, rare: 1, magic: 2, normal: 3 };
    const items = h.inv.filter((x): x is Item => !!x);
    items.sort((a, b) => order.indexOf(baseOf(a).slot) - order.indexOf(baseOf(b).slot) || rr[a.rarity] - rr[b.rarity] || b.ilvl - a.ilvl);
    h.inv = [...items, ...new Array(INV_SIZE - items.length).fill(null)];
  }

  // ------------------------------------------------------------ progression
  allocAttr(k: keyof Attrs, n = 1): void {
    const h = this.hero;
    const m = Math.min(n, h.freePts);
    if (m <= 0) return;
    h.attrs[k] += m; h.freePts -= m;
    const hpBefore = h.st.maxHp, mpBefore = h.st.maxMp;
    this.refreshStats();
    h.hp += Math.max(0, h.st.maxHp - hpBefore); h.mp += Math.max(0, h.st.maxMp - mpBefore);
  }
  learnSkill(slot: number): boolean {
    const h = this.hero;
    const id = CLASSES[h.cls].skills[slot];
    const def = SKILLS[id];
    const r = h.skills[id] ?? 0;
    if (h.skillPts <= 0 || h.level < def.req || r >= MAX_SKILL_RANK) return false;
    h.skills[id] = r + 1; h.skillPts--;
    this.emit({ t: 'sfx', id: 'learn' });
    return true;
  }

  // ------------------------------------------------------------ commands
  setIntent(it: Intent | null): void {
    const h = this.hero;
    if (h.dead) return;
    h.intent = it;
    if (!it || it.type !== 'move') this.pathAge = 99;
  }
  cast(slot: number, x: number, y: number, targetId = 0): void {
    const h = this.hero;
    if (h.dead) return;
    const r = tryCast(this, slot, x, y, targetId);
    if (r === 'approach') { h.intent = { type: 'skill', slot, x, y, id: targetId || this.nearestMonsterId(x, y) }; return; }
    if (r === 'nomana') { this.msg('마나가 부족하다.', '#80a0ff', 'nomana'); this.emit({ t: 'sfx', id: 'nomana' }); }
    else if (r === 'unlearned') this.msg('아직 배우지 않은 기술이다.', '#c0c0c0', 'unlearned');
    else if (r === 'ok' && h.intent && h.intent.type !== 'dir') h.intent = null;
  }
  private nearestMonsterId(x: number, y: number): number {
    let best = 0, bd = 2;
    for (const m of this.world.monsters) { if (m.dead) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m.id; } }
    return best;
  }
  usePotion(kind: 'hp' | 'mp'): void {
    const h = this.hero;
    if (h.dead || h.potT > 0) return;
    if (kind === 'hp') {
      if (h.potHp <= 0) { this.msg('생명 물약이 없다.', '#ff8080', 'nopot'); this.emit({ t: 'sfx', id: 'error' }); return; }
      if (h.hp >= h.st.maxHp) return;
      h.potHp--; h.potHeal = h.st.maxHp * 0.25;
      h.hp = Math.min(h.st.maxHp, h.hp + h.st.maxHp * 0.3);
    } else {
      if (h.potMp <= 0) { this.msg('마나 물약이 없다.', '#8080ff', 'nopot'); this.emit({ t: 'sfx', id: 'error' }); return; }
      if (h.mp >= h.st.maxMp) return;
      h.potMp--;
      h.mp = Math.min(h.st.maxMp, h.mp + h.st.maxMp * 0.6);
    }
    h.potT = 0.4;
    this.emit({ t: 'sfx', id: 'potion' });
    this.emit({ t: 'fx', kind: kind === 'hp' ? 'healPot' : 'manaPot', x: h.x, y: h.y });
  }

  private doInteract(it: Extract<Intent, { type: 'interact' }>): void {
    const h = this.hero, w = this.world;
    switch (it.kind) {
      case 'drop': this.pickup(it.id); break;
      case 'stairs': this.takeStairs(it.id > 0 ? 1 : -1); break;
      case 'npc': {
        const n = w.npcs.find((x) => x.id === it.id);
        if (!n) return;
        n.facing = Math.atan2(h.y - n.y, h.x - n.x);
        if (n.kind === 'healer') {
          if (h.hp < h.st.maxHp || h.mp < h.st.maxMp) this.emit({ t: 'fx', kind: 'healPot', x: h.x, y: h.y });
          h.hp = h.st.maxHp; h.mp = h.st.maxMp;
        }
        this.emit({ t: 'open', ui: n.kind === 'smith' ? 'shop' : n.kind });
        this.emit({ t: 'npc', kind: n.kind });
        break;
      }
      case 'prop': {
        const p = w.props.find((x) => x.id === it.id);
        if (!p || (p.used && p.kind !== 'waypoint' && p.kind !== 'stash' && p.kind !== 'portal' && p.kind !== 'well')) return;
        if (p.kind === 'waypoint') { this.emit({ t: 'open', ui: 'waypoint' }); this.emit({ t: 'sfx', id: 'waypoint' }); return; }
        if (p.kind === 'stash') { this.emit({ t: 'open', ui: 'stash' }); this.emit({ t: 'sfx', id: 'chest' }); return; }
        if (p.kind === 'portal') { this.enterPortal(p); return; }
        if (p.kind === 'well') { h.hp = h.st.maxHp; h.mp = h.st.maxMp; this.msg('시원한 우물물이 기운을 되살린다.', '#a0d0ff'); this.emit({ t: 'fx', kind: 'healPot', x: h.x, y: h.y }); return; }
        if (p.kind === 'barrel' || p.kind === 'crate') {
          if (w.floor === 0) return;
          h.facing = Math.atan2(p.y - h.y, p.x - h.x);
          h.act = { kind: 'attack', skill: 'kick', t: 0, dur: 0.32, hitAt: 0.16, fired: false, tx: p.x, ty: p.y, targetId: p.id, fx: h.x, fy: h.y };
          return;
        }
        useProp(this, p);
        break;
      }
    }
  }
  /** Is (x,y) connected to the hero by walkable tiles (via flow field)? */
  reachable(x: number, y: number): boolean {
    const w = this.world;
    const i = Math.floor(y) * w.w + Math.floor(x);
    return w.flow[i] !== 65535;
  }

  // ------------------------------------------------------------ update
  heroSpeed(): number {
    const h = this.hero;
    return h.st.moveSpeed * (h.chillT > 0 ? 0.65 : 1);
  }

  private walkTo(x: number, y: number, dt: number, stop: number): boolean {
    const h = this.hero, w = this.world;
    const d = Math.hypot(x - h.x, y - h.y);
    if (d <= stop) { h.moving = false; return true; }
    let tx = x, ty = y;
    this.pathAge += dt;
    if (!walkLine(w, h.x, h.y, x, y, h.r)) {
      const gx = Math.floor(x), gy = Math.floor(y);
      if (!h.path || !h.pathGoal || Math.floor(h.pathGoal.x) !== gx || Math.floor(h.pathGoal.y) !== gy || this.pathAge > 1.2) {
        let goal = { x, y };
        let p = astar(w, h.x, h.y, gx, gy);
        if (!p) { const nw = nearestWalkable(w, x, y, 3); if (nw) { goal = nw; p = astar(w, h.x, h.y, nw.x, nw.y); } }
        h.path = p; h.pathGoal = { x: gx + 0.5, y: gy + 0.5 }; this.pathAge = 0;
        void goal;
      }
      if (h.path && h.path.length) {
        if (h.path.length > 1 && walkLine(w, h.x, h.y, h.path[1].x, h.path[1].y, h.r)) h.path.shift();
        tx = h.path[0].x; ty = h.path[0].y;
        if (Math.hypot(tx - h.x, ty - h.y) < 0.15) { h.path.shift(); if (h.path.length) { tx = h.path[0].x; ty = h.path[0].y; } else { tx = x; ty = y; } }
      }
    } else h.path = null;
    const dd = Math.hypot(tx - h.x, ty - h.y);
    if (dd < 1e-4) { h.moving = false; return false; }
    const sp = this.heroSpeed();
    const step = Math.min(sp * dt, dd);
    h.facing = Math.atan2(ty - h.y, tx - h.x);
    h.moving = moveCircle(w, h, h.r, ((tx - h.x) / dd) * step, ((ty - h.y) / dd) * step);
    if (h.moving) h.anim += step;
    return false;
  }

  private updateHero(dt: number): void {
    const h = this.hero, st = h.st, w = this.world;
    if (h.dead) { h.deadT += dt; return; }
    h.hp = Math.min(st.maxHp, h.hp + st.hpRegen * dt);
    h.mp = Math.min(st.maxMp, h.mp + st.mpRegen * dt);
    if (h.potHeal > 0) { const k = Math.min(h.potHeal, st.maxHp * 0.25 * dt / 1.5); h.hp = Math.min(st.maxHp, h.hp + k); h.potHeal -= k; }
    if (h.potT > 0) h.potT -= dt;
    if (h.hitT > 0) h.hitT -= dt;
    if (h.invulnT > 0) h.invulnT -= dt;
    if (h.chillT > 0) h.chillT -= dt;
    if (h.blockT > 0) h.blockT -= dt;
    for (let i = 0; i < h.cds.length; i++) if (h.cds[i] > 0) h.cds[i] = Math.max(0, h.cds[i] - dt);
    if (h.buffs.length) {
      let changed = false;
      for (const b of h.buffs) b.t -= dt;
      const keep = h.buffs.filter((b) => b.t > 0);
      if (keep.length !== h.buffs.length) changed = true;
      h.buffs = keep;
      if (changed) h.dirty = true;
    }
    if (h.dirty) this.refreshStats();
    if (h.act) { updateAct(this, dt); h.moving = false; return; }
    const it = h.intent;
    if (!it) { h.moving = false; return; }
    switch (it.type) {
      case 'dir': {
        const l = Math.hypot(it.dx, it.dy);
        if (l < 0.1) { h.moving = false; break; }
        const sp = this.heroSpeed();
        h.facing = Math.atan2(it.dy, it.dx);
        h.moving = moveCircle(w, h, h.r, (it.dx / l) * sp * dt, (it.dy / l) * sp * dt);
        if (h.moving) h.anim += sp * dt;
        break;
      }
      case 'move':
        if (this.walkTo(it.x, it.y, dt, 0.12)) h.intent = null;
        break;
      case 'attack': {
        const m = w.monsters.find((x) => x.id === it.id && !x.dead);
        if (!m) { h.intent = null; h.moving = false; break; }
        const basic = SKILLS[CLASSES[h.cls].basic];
        const d = Math.hypot(m.x - h.x, m.y - h.y);
        if (basic.kind === 'melee') {
          const reach = st.reach + h.r + m.r;
          if (d <= reach) { const r = tryCast(this, -1, m.x, m.y, m.id); if (r === 'ok' && !it.hold) h.intent = null; h.moving = false; }
          else this.walkTo(m.x, m.y, dt, reach * 0.85);
        } else if (d <= basic.range && los(w, h.x, h.y, m.x, m.y)) {
          const r = tryCast(this, -1, m.x, m.y, m.id); if (r === 'ok' && !it.hold) h.intent = null; h.moving = false;
        } else this.walkTo(m.x, m.y, dt, 1);
        break;
      }
      case 'attackPoint': {
        const r = tryCast(this, -1, it.x, it.y, 0);
        if (r !== 'busy') h.intent = null;
        h.moving = false;
        break;
      }
      case 'skill': {
        const m = w.monsters.find((x) => x.id === it.id && !x.dead);
        if (!m) { h.intent = null; break; }
        const r = tryCast(this, it.slot, m.x, m.y, m.id);
        if (r === 'approach') this.walkTo(m.x, m.y, dt, st.reach + h.r + m.r - 0.1);
        else h.intent = null;
        break;
      }
      case 'interact': {
        const range = it.kind === 'npc' ? 1.9 : it.kind === 'drop' ? 0.9 : it.kind === 'stairs' ? 0.75 : 1.45;
        if (Math.hypot(it.x - h.x, it.y - h.y) <= range) { h.intent = null; h.moving = false; this.doInteract(it); }
        else if (this.walkTo(it.x, it.y, dt, range * 0.8)) { h.intent = null; this.doInteract(it); }
        break;
      }
    }
  }

  private updateNpcs(dt: number): void {
    for (const n of this.world.npcs) {
      n.anim += dt;
      n.wanderT -= dt;
      if (n.wanderT <= 0) {
        n.wanderT = this.rng.range(3, 7);
        const near = Math.hypot(this.hero.x - n.x, this.hero.y - n.y) < 3;
        n.tx = near ? n.x : n.hx + this.rng.range(-1.2, 1.2); n.ty = near ? n.y : n.hy + this.rng.range(-1.2, 1.2);
      }
      const d = Math.hypot(n.tx - n.x, n.ty - n.y);
      if (d > 0.1) { const sp = 0.8 * dt; n.facing = Math.atan2(n.ty - n.y, n.tx - n.x); moveCircle(this.world, n, n.r, ((n.tx - n.x) / d) * Math.min(sp, d), ((n.ty - n.y) / d) * Math.min(sp, d)); }
    }
  }

  update(dt: number): void {
    this.time += dt;
    const h = this.hero, w = this.world;
    if (!h.dead) h.playTime += dt;
    this.updateHero(dt);
    const ht = Math.floor(h.y) * w.w + Math.floor(h.x);
    this.flowTimer -= dt;
    if ((ht !== w.flowTile && this.flowTimer <= 0) || this.flowTimer < -1.5) {
      computeFlow(w, Math.floor(h.x), Math.floor(h.y));
      w.flowTile = ht; this.flowTimer = 0.12;
    }
    if (w.bossRoom && !w.bossTriggered && !h.dead) {
      const r = w.bossRoom;
      if (h.x > r.x - 0.5 && h.x < r.x + r.w + 0.5 && h.y > r.y - 0.5 && h.y < r.y + r.h + 0.5) {
        const b = w.monsters.find((m) => m.id === w.bossId);
        if (b && !b.dead) wake(this, b);
      }
    }
    const ms = w.monsters;
    for (let i = 0; i < ms.length; i++) updateMonster(this, ms[i], dt);
    separate(this);
    updateProjs(this, dt);
    updateAreas(this, dt);
    for (const d of w.drops) d.t += dt;
    if (!h.dead) autoPickup(this);
    if (ht !== this.exploredTile) {
      this.exploredTile = ht;
      const R = 8, cx = Math.floor(h.x), cy = Math.floor(h.y);
      for (let y = Math.max(0, cy - R); y <= Math.min(w.h - 1, cy + R); y++)
        for (let x = Math.max(0, cx - R); x <= Math.min(w.w - 1, cx + R); x++)
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= R * R) w.explored[y * w.w + x] = 1;
    }
    if (w.floor === 0) this.updateNpcs(dt);
    if (ms.length > 160) w.monsters = ms.filter((m) => !m.dead || m.deadT < 15);
  }
}
