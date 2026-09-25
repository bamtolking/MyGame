// Headless auto-player used for smoke tests and balance sweeps. Plays like a sensible human:
// spends points, equips upgrades, buys potions, clears rooms, picks up loot and heads down.
import { CLASSES, SKILLS } from '../src/data/classes';
import { LAST_FLOOR, MAX_POTIONS } from '../src/data/zones';
import { DT, Game } from '../src/sim/game';
import { baseOf, canEquipClass } from '../src/sim/items';
import { los, walkable } from '../src/sim/path';
import { rankOf } from '../src/sim/skills';
import { computeStats, sheetDps } from '../src/sim/stats';
import type { ClassId, EquipSlot, Hero, Item, Monster } from '../src/sim/types';

export interface FloorLog { floor: number; level: number; time: number; deaths: number; kills: number; potUsed: number; gold: number; dps: number; hp: number; armor: number }
export interface BotResult { cls: ClassId; seed: number; reached: number; level: number; time: number; deaths: number; floors: FloorLog[]; won: boolean; stuck: number; errors: string[] }

const SKILL_PRIORITY: Record<ClassId, number[]> = {
  warrior: [0, 1, 0, 1, 2, 0, 1, 3, 4, 1, 0, 2, 3, 4],
  rogue: [0, 1, 0, 1, 2, 1, 0, 2, 3, 4, 1, 2, 4, 0],
  sorcerer: [0, 1, 0, 2, 1, 2, 0, 2, 3, 4, 2, 0, 4, 1],
};

function score(h: Hero, diff: number): number {
  const st = computeStats(h, diff);
  const res = (st.res.fire + st.res.cold + st.res.light + st.res.poison) / 4;
  return sheetDps(st) * Math.sqrt(st.maxHp * (1 + st.armor / 150) * (1 + Math.max(0, res) / 80) * (1 + st.block / 100));
}

function tryUpgrades(g: Game): void {
  const h = g.hero;
  for (let i = 0; i < h.inv.length; i++) {
    const it = h.inv[i];
    if (!it || !canEquipClass(it, h.cls) || it.req > h.level || g.canEquip(it)) continue;
    const b = baseOf(it);
    const slots: EquipSlot[] = b.slot === 'ring' ? ['ring1', 'ring2'] : [b.slot as EquipSlot];
    for (const s of slots) {
      const base = score(h, g.diff);
      const old = h.equip[s];
      h.equip[s] = it;
      let off: Item | null = null;
      if (s === 'weapon' && b.twoHanded && h.equip.offhand && baseOf(h.equip.offhand).cat !== 'quiver') { off = h.equip.offhand; h.equip.offhand = null; }
      const sc = score(h, g.diff);
      h.equip[s] = old;
      if (off) h.equip.offhand = off;
      if (sc > base * 1.02) { g.equipFromInv(i, s); break; }
    }
  }
}

function spendPoints(g: Game): void {
  const h = g.hero, c = CLASSES[h.cls];
  const order: (keyof typeof c.autoAttr)[] = [];
  for (const k of ['str', 'dex', 'vit', 'ene'] as const) for (let i = 0; i < c.autoAttr[k]; i++) order.push(k);
  let i = 0;
  while (h.freePts > 0) { g.allocAttr(order[i % order.length]); i++; }
  let guard = 0;
  while (h.skillPts > 0 && guard++ < 50) {
    const pri = SKILL_PRIORITY[h.cls];
    let learned = false;
    for (const s of pri) if (g.learnSkill(s)) { learned = true; break; }
    if (!learned) for (let s = 0; s < 5; s++) if (g.learnSkill(s)) { learned = true; break; }
    if (!learned) break;
  }
}

function townRoutine(g: Game, stats: { potUsed: number }): void {
  const h = g.hero;
  spendPoints(g);
  tryUpgrades(g);
  // sell everything not equipped that isn't an upgrade
  for (let i = 0; i < h.inv.length; i++) if (h.inv[i]) g.sell(i);
  // buy shop upgrades if affordable
  for (let j = g.shop.length - 1; j >= 0; j--) {
    const it = g.shop[j];
    if (!canEquipClass(it, h.cls) || it.req > h.level) continue;
    const b = baseOf(it);
    const s: EquipSlot = b.slot === 'ring' ? 'ring1' : (b.slot as EquipSlot);
    const base = score(h, g.diff);
    const old = h.equip[s]; h.equip[s] = it; const sc = score(h, g.diff); h.equip[s] = old;
    if (sc > base * 1.08 && h.gold > 400) { g.buy(j); tryUpgrades(g); }
  }
  const wantHp = 12, wantMp = h.cls === 'warrior' ? 4 : 8;
  while (h.potHp < wantHp && h.gold >= 40) g.buyPotion('hp');
  while (h.potMp < wantMp && h.gold >= 30) g.buyPotion('mp');
  while (h.scrolls < 2 && h.gold >= 80) g.buyPotion('scroll');
  void stats; void MAX_POTIONS;
}

function frontier(g: Game): { x: number; y: number } | null {
  const w = g.world, h = g.hero, W = w.w;
  const seen = new Uint8Array(w.w * w.h);
  const q = [Math.floor(h.y) * W + Math.floor(h.x)]; seen[q[0]] = 1;
  for (let head = 0; head < q.length; head++) {
    const c = q[head]; const x = c % W, y = (c / W) | 0;
    if (!w.explored[c]) return { x: x + 0.5, y: y + 0.5 };
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!walkable(w, nx, ny)) continue;
      const i = ny * W + nx; if (!seen[i]) { seen[i] = 1; q.push(i); }
    }
  }
  return null;
}

function pickSkill(g: Game, m: Monster, crowd: number): number {
  const h = g.hero;
  const c = CLASSES[h.cls];
  const d = Math.hypot(m.x - h.x, m.y - h.y);
  const ok = (s: number) => rankOf(g, s) > 0 && h.cds[s] <= 0 && h.mp >= SKILLS[c.skills[s]].mana(rankOf(g, s)) + 2;
  if (h.cls === 'warrior') {
    if (ok(4) && (crowd >= 3 || m.rank === 'boss' || m.rank === 'unique')) return 4;
    if (ok(2) && crowd >= 2) return 2;
    if (ok(3) && d > 3 && d < 7) return 3;
    if (ok(1) && crowd >= 3 && d < 2.2) return 1;
    if (ok(0) && d < 1.6) return 0;
    return -1;
  }
  if (h.cls === 'rogue') {
    if (ok(4) && crowd >= 4) return 4;
    if (ok(3) && d < 2.2 && h.hp < h.st.maxHp * 0.6) return 3;
    if (ok(2) && crowd >= 4) return 2;
    if (ok(1) && crowd >= 3) return 1;
    if (ok(0) && crowd >= 2) return 0;
    if (ok(1)) return 1;
    return -1;
  }
  if (ok(4) && (crowd >= 4 || m.rank === 'boss')) return 4;
  if (ok(1) && d < 3 && crowd >= 2) return 1;
  if (ok(2) && crowd >= 3) return 2;
  if (ok(3) && d < 2 && h.hp < h.st.maxHp * 0.5) return 3;
  if (ok(0)) return 0;
  return -1;
}

export function runBot(cls: ClassId, seed: number, opts: { maxFloor?: number; maxTime?: number; diff?: number } = {}): BotResult {
  const g = new Game(cls, 'bot', seed);
  const maxFloor = opts.maxFloor ?? LAST_FLOOR;
  const maxTime = opts.maxTime ?? 60 * 90;
  const h = g.hero;
  const res: BotResult = { cls, seed, reached: 0, level: 1, time: 0, deaths: 0, floors: [], won: false, stuck: 0, errors: [] };
  let decideT = 0, floorT = 0, lastFloor = -1, stuckT = 0, lastX = 0, lastY = 0, returnFloor = 0;
  const stats = { potUsed: 0 };
  let floorDeaths = 0, floorKills = 0, potAtStart = 0;
  let exploreGoal: { x: number; y: number } | null = null;
  let victory = false;
  const tries = new Map<number, number>();
  let t = 0;
  while (t < maxTime) {
    for (const e of g.drain()) {
      if (e.t === 'victory') victory = true;
    }
    if (victory) { res.won = true; break; }
    t += DT;
    g.update(DT);
    decideT -= DT;
    if (g.world.floor !== lastFloor) {
      if (g.world.floor > 0 && g.world.floor > res.reached) {
        res.reached = g.world.floor;
        res.floors.push({ floor: g.world.floor, level: h.level, time: Math.round(t), deaths: 0, kills: 0, potUsed: 0, gold: h.gold, dps: Math.round(sheetDps(h.st)), hp: h.st.maxHp, armor: h.st.armor });
        floorDeaths = 0; floorKills = h.kills; potAtStart = h.potHp + h.potMp;
      }
      lastFloor = g.world.floor; floorT = 0; exploreGoal = null;
    }
    floorT += DT;
    if (decideT > 0) continue;
    decideT = 0.1;
    const cur = res.floors[res.floors.length - 1];
    if (cur) { cur.deaths = floorDeaths; cur.kills = h.kills - floorKills; cur.potUsed = Math.max(0, potAtStart - (h.potHp + h.potMp)); }
    if (h.dead) {
      if (h.deadT > 1) { res.deaths++; floorDeaths++; returnFloor = Math.max(returnFloor, g.world.floor); g.respawn(); }
      continue;
    }
    spendPoints(g);
    if (g.world.floor === 0) {
      townRoutine(g, stats);
      const target = returnFloor > 0 ? returnFloor : Math.min(maxFloor, Math.max(1, g.maxFloor[g.diff]));
      if (g.portal) { const p = g.world.props.find((q) => q.kind === 'portal'); if (p) { g.setIntent({ type: 'interact', kind: 'prop', id: p.id, x: p.x, y: p.y }); continue; } }
      returnFloor = 0;
      g.travel(target);
      continue;
    }
    if (g.world.floor > maxFloor) break;
    // survival
    if (h.hp < h.st.maxHp * 0.4) g.usePotion('hp');
    if (h.mp < h.st.maxMp * 0.2 && h.potMp > 0) g.usePotion('mp');
    const invFull = h.inv.indexOf(null) < 0;
    if ((h.potHp === 0 && h.hp < h.st.maxHp * 0.35 && h.scrolls > 0) || (invFull && h.scrolls > 0)) {
      g.useScroll(); returnFloor = g.world.floor;
      const p = g.world.props.find((q) => q.kind === 'portal');
      if (p) g.setIntent({ type: 'interact', kind: 'prop', id: p.id, x: p.x, y: p.y });
      continue;
    }
    if (h.act) continue;
    // targets
    const w = g.world;
    let best: Monster | null = null, bd = 1e9;
    for (const m of w.monsters) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - h.x, m.y - h.y);
      if (d > 14) continue;
      const fd = w.flow[Math.floor(m.y) * w.w + Math.floor(m.x)];
      const eff = d + (m.awake ? 0 : 2) + (fd === 65535 ? 50 : 0) + (los(w, h.x, h.y, m.x, m.y) ? 0 : 4);
      if (eff < bd) { bd = eff; best = m; }
    }
    if (best && bd < 40) {
      const crowd = w.monsters.filter((m) => !m.dead && Math.hypot(m.x - best!.x, m.y - best!.y) < 3.5).length;
      const seen = los(w, h.x, h.y, best.x, best.y);
      const s = seen && Math.hypot(best.x - h.x, best.y - h.y) < 10 ? pickSkill(g, best, crowd) : -1;
      const target = s === 3 && (h.cls === 'rogue' || h.cls === 'sorcerer') ? { x: h.x - (best.x - h.x), y: h.y - (best.y - h.y) } : best;
      if (s >= 0) g.cast(s, target.x, target.y, s === 3 && h.cls !== 'warrior' ? 0 : best.id);
      if (!h.act) g.setIntent({ type: 'attack', id: best.id, hold: true });
      exploreGoal = null;
      continue;
    }
    // loot
    const drop = w.drops.find((d) => d.item && !invFull && (tries.get(d.id) ?? 0) < 60 && Math.hypot(d.x - h.x, d.y - h.y) < 9 && (d.item.rarity !== 'normal' || d.item.ilvl >= h.level));
    if (drop) { tries.set(drop.id, (tries.get(drop.id) ?? 0) + 1); g.setIntent({ type: 'interact', kind: 'drop', id: drop.id, x: drop.x, y: drop.y }); continue; }
    // stuck check
    if (Math.hypot(h.x - lastX, h.y - lastY) < 0.05) stuckT += 0.1; else stuckT = 0;
    lastX = h.x; lastY = h.y;
    if (stuckT > 4) { res.stuck++; stuckT = 0; exploreGoal = { x: h.x + (Math.random() - 0.5) * 8, y: h.y + (Math.random() - 0.5) * 8 }; }
    // explore or descend
    const aliveNear = w.monsters.filter((m) => !m.dead).length;
    const wantDown = w.down && !w.downSealed && (floorT > 240 || aliveNear < 12 || !frontier(g));
    if (wantDown && w.down) {
      if (w.floor >= maxFloor) break;
      g.setIntent({ type: 'interact', kind: 'stairs', id: 1, x: w.down.x, y: w.down.y });
      continue;
    }
    if (w.downSealed && w.bossId) {
      const b = w.monsters.find((m) => m.id === w.bossId);
      if (b && !b.dead && floorT > 150) { g.setIntent({ type: 'move', x: b.x, y: b.y }); continue; }
    }
    if (!exploreGoal || w.explored[Math.floor(exploreGoal.y) * w.w + Math.floor(exploreGoal.x)] || Math.hypot(exploreGoal.x - h.x, exploreGoal.y - h.y) < 1) exploreGoal = frontier(g);
    if (exploreGoal) g.setIntent({ type: 'move', x: exploreGoal.x, y: exploreGoal.y });
  }
  res.level = h.level; res.time = Math.round(t);
  return res;
}
