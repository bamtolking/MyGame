// AI companions ("AI" tagged in the roster). They move through the same input path as humans.
import { computeStats, newProfile, makeItem, slotsUnlocked, GEAR_SLOTS } from '../shared/data/items.ts';
import { CLASSES, CLASS_IDS } from '../shared/data/classes.ts';
import { TAL_KINDS } from '../shared/data/talismans.ts';
import { xpNeed } from '../shared/data/xp.ts';
import { zoneAt, isWalkable } from '../shared/map.ts';
import type { ClassId, Profile, Rarity, TalKind } from '../shared/types.ts';
import { Rng } from '../shared/rng.ts';
import type { World } from './world.ts';
import type { Player } from './entities.ts';
import { findPath } from '../shared/path.ts';
import { doAction } from './actions.ts';
import { segDist2 } from '../shared/math.ts';
import { MAIN_QUESTS } from '../shared/data/quests.ts';
import { MONSTERS } from '../shared/data/monsters.ts';
import { enhanceCost, MAX_PLUS } from '../shared/data/items.ts';

export const BOT_NAMES = ['AI 달래', 'AI 무진', 'AI 소이', 'AI 한별', 'AI 도윤', 'AI 서하', 'AI 강우', 'AI 이슬', 'AI 초롱', 'AI 해랑'];
const zoneForLevel = (l: number) => (l <= 8 ? 1 : l <= 14 ? 2 : l <= 20 ? 3 : 4);
const SHRINE_FOR_ZONE = [0, 0, 1, 2, 3, 4];

export function makeBotProfile(name: string, cls: ClassId, level: number, seed: number): Profile {
  const rng = new Rng(seed); const pr = newProfile(name, CLASSES[cls], 0);
  pr.level = Math.max(1, level); pr.xp = Math.floor(xpNeed(pr.level) * rng.next() * 0.5);
  pr.shrines = [0, 1, 2, 3, 4];
  if (level >= 3) {
    for (const s of GEAR_SLOTS) pr.equip[s] = makeItem(rng, pr.nextUid++, s, Math.max(1, level - 1), (level > 12 ? 2 : 1) as Rarity);
  }
  const n = slotsUnlocked(pr.level); const kinds: TalKind[] = [CLASSES[cls].startTal, ...TAL_KINDS.filter(k => k !== CLASSES[cls].startTal).sort(() => rng.next() - 0.5)];
  pr.tals = []; pr.slots = [null, null, null, null];
  for (let i = 0; i < n; i++) { const uid = pr.nextUid++; pr.tals.push({ uid, kind: kinds[i], lv: Math.min(5, 1 + Math.floor(level / 8)) }); pr.slots[i] = uid; }
  pr.quest.main = 99; pr.opts = { autoSell: 1 };
  return pr;
}

export class BotBrain {
  role: 'buddy' | 'roamer' | 'quester'; buddy = 0; seq = 0; gear: 'full' | 'light' = 'full';
  path: [number, number][] = []; goal: [number, number] | null = null; repathT = 0; thinkT = 0; manageT = 3;
  stuckT = 0; lastX = 0; lastY = 0; wander: [number, number] | null = null; bossPlanT = 30; orbit = 1;
  constructor(role: 'buddy' | 'roamer' | 'quester', seed: number) { this.role = role; this.orbit = seed % 2 ? 1 : -1; }

  update(w: World, p: Player): void {
    if (p.down) { w.queueInput(p, ++this.seq, 0, 0); return; }
    this.thinkT -= 0.05; this.manageT -= 0.05; this.repathT -= 0.05; this.bossPlanT -= 0.05;
    if (this.manageT <= 0) { this.manageT = 6; this.manage(w, p); }
    if (p.ult >= 100) this.maybeUlt(w, p);
    let [ix, iy] = this.decide(w, p);
    // dodge telegraphs: step out of any hazard we are standing in
    for (const h of w.hazards) {
      if (h.due - w.time > 1.4) continue;
      if (h.sh === 0) { const dx = p.x - h.x, dy = p.y - h.y; const d = Math.hypot(dx, dy); if (d < h.r + 16) { const k = 127 / (d || 1); ix = dx * k; iy = dy * k; } }
      else if (segDist2(p.x, p.y, h.x, h.y, h.x2, h.y2) < (h.w / 2 + 16) ** 2) {
        const lx = h.x2 - h.x, ly = h.y2 - h.y; const L = Math.hypot(lx, ly) || 1; let nx = -ly / L, ny = lx / L;
        if ((p.x - h.x) * nx + (p.y - h.y) * ny < 0) { nx = -nx; ny = -ny; } ix = nx * 127; iy = ny * 127;
      }
    }
    // stuck detection
    if (ix || iy) { if (Math.hypot(p.x - this.lastX, p.y - this.lastY) < 1) this.stuckT += 0.05; else this.stuckT = 0; }
    this.lastX = p.x; this.lastY = p.y;
    if (this.stuckT > 0.8) { this.stuckT = 0; this.path = []; this.repathT = 0; this.wander = null; const a = w.rng.range(0, Math.PI * 2); ix = Math.cos(a) * 127; iy = Math.sin(a) * 127; }
    w.queueInput(p, ++this.seq, Math.round(ix), Math.round(iy));
  }

  private decide(w: World, p: Player): [number, number] {
    // 1) revive downed allies nearby (humans first)
    let down: Player | null = null, dd = 800 * 800;
    for (const q of w.players.values()) if (q.down && q !== p) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 * (q.bot ? 1.5 : 1); if (d < dd) { dd = d; down = q; } }
    if (down) return this.goTo(w, p, down.x, down.y, 10);
    // 2) low health → back off from the horde
    if (p.hp < p.stats.maxHp * 0.3) { const c = centroid(w, p, 320); if (c) return dirAway(p, c[0], c[1]); }
    // 3) world boss
    const wb = w.wb;
    if ((wb.state === 'warn' || wb.state === 'fight') && p.prof.level >= 2) {
      const ax = w.map.altar.x, ay = w.map.altar.y; const far = Math.hypot(ax - p.x, ay - p.y);
      if (far > 1300) { this.tryTp(w, p, 4); return this.goTo(w, p, ax, ay, 200); }
      const boss = wb.bossId ? w.mons.get(wb.bossId) : undefined;
      if (boss && !boss.dead) return this.fightAround(w, p, boss.x, boss.y, meleeReach(p, boss.r, 260));
      return this.goTo(w, p, ax + this.orbit * 60, ay + 80, 60);
    }
    // 4) story-following (auto-hunt and the balance sweep's stand-in human)
    if (this.role === 'quester') { const g = this.questGoal(w, p); if (g) return g; }
    // 5) buddies stick with their human
    const bud = this.buddy ? w.players.get(this.buddy) : undefined;
    if (this.role === 'buddy' && bud && !bud.bot) {
      const d = Math.hypot(bud.x - p.x, bud.y - p.y);
      if (d > 1400 && bud.zone !== 0) { this.tryTp(w, p, nearestShrine(w, bud.x, bud.y)); }
      if (d > 260 || bud.zone === 0) return this.goTo(w, p, bud.x + this.orbit * 50, bud.y + 40, 80);
      return this.fightLocal(w, p) ?? [0, 0];
    }
    // 6) hunt in the right zone
    const want = zoneForLevel(p.prof.level);
    if (p.zone !== want && !(p.zone === 1 && want === 1)) {
      const s = w.map.shrines[SHRINE_FOR_ZONE[want]];
      if (Math.hypot(s.x - p.x, s.y - p.y) > 1500) this.tryTp(w, p, s.id);
      if (want === 1) { const [lx, ly] = [w.map.lairs[0].x, w.map.lairs[0].y]; return this.goTo(w, p, lx, ly - 300, 200); }
      return this.goTo(w, p, s.x, s.y + 120, 100);
    }
    // field boss attempt now and then
    if (this.bossPlanT <= 0) {
      this.bossPlanT = 45; const lair = w.map.lairs.find(l => l.zone === p.zone);
      const li = lair ? w.map.lairs.indexOf(lair) : -1;
      if (lair && li >= 0 && w.lairs[li].mon && p.prof.level >= (w.mons.get(w.lairs[li].mon)?.lv ?? 99) - 1 && w.rng.chance(0.5)) this.wander = [lair.x, lair.y];
    }
    const f = this.fightLocal(w, p); if (f) return f;
    // wander within the zone
    if (!this.wander || Math.hypot(this.wander[0] - p.x, this.wander[1] - p.y) < 60) this.wander = this.randomPoint(w, p, p.zone);
    return this.goTo(w, p, this.wander[0], this.wander[1], 40);
  }

  private questGoal(w: World, p: Player): [number, number] | null {
    const q = MAIN_QUESTS[p.prof.quest.main]; if (!q) return null;
    if (q.kind === 'boss') {
      const li = w.map.lairs.findIndex(l => l.boss === q.target); if (li < 0) return null; const lair = w.map.lairs[li];
      if (p.prof.level < (MONSTERS[q.target].level ?? 1) - 1) return null; // not ready yet: keep levelling
      const boss = w.lairs[li].mon ? w.mons.get(w.lairs[li].mon) : undefined; const d = Math.hypot(lair.x - p.x, lair.y - p.y);
      if (d > 1500) this.tryTp(w, p, SHRINE_FOR_ZONE[lair.zone]);
      if (boss && !boss.dead && Math.hypot(boss.x - p.x, boss.y - p.y) < 650) return this.fightAround(w, p, boss.x, boss.y, meleeReach(p, boss.r, 230));
      return this.fightLocal(w, p) ?? this.goTo(w, p, lair.x, lair.y + 140, 120);
    }
    if ((q.kind === 'visit' || q.kind === 'killZone' || q.kind === 'kill') && p.zone !== q.zone && q.zone >= 1 && q.zone <= 4) {
      const s = w.map.shrines[SHRINE_FOR_ZONE[q.zone]];
      if (Math.hypot(s.x - p.x, s.y - p.y) > 1500) this.tryTp(w, p, s.id);
      if (q.zone === 1) { const l = w.map.lairs[0]; return this.goTo(w, p, l.x, l.y - 300, 200); }
      return this.goTo(w, p, s.x, s.y + 140, 100);
    }
    if (q.kind === 'enhance') {
      const it = (['weapon', 'armor', 'charm'] as const).map(k => p.prof.equip[k]).filter(Boolean).sort((a, b) => a!.plus - b!.plus)[0];
      if (it && p.prof.gold >= enhanceCost(it)) {
        if (p.zone !== 0) { this.tryTp(w, p, 0); return this.goTo(w, p, w.map.spawn.x, w.map.spawn.y, 60); }
        doAction(w, p, { t: 'enhance', uid: it.uid }); return [0, 0];
      }
    }
    return null;
  }
  private fightLocal(w: World, p: Player): [number, number] | null {
    const near = w.spatial.nearest(p.x, p.y, 380); if (!near) return null;
    return this.fightAround(w, p, near.x, near.y, meleeReach(p, 0, 200));
  }
  private fightAround(w: World, p: Player, tx: number, ty: number, want: number): [number, number] {
    const dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; const ux = dx / d, uy = dy / d;
    const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
    const ox = -uy * this.orbit, oy = ux * this.orbit;
    let vx = ux * radial + ox * 0.8, vy = uy * radial + oy * 0.8;
    if (w.rng.chance(0.01)) this.orbit *= -1;
    const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
    if (!isWalkable(w.map, p.x + vx * 30, p.y + vy * 30)) { this.orbit *= -1; vx = ux * radial - ox; vy = uy * radial - oy; }
    return [vx * 127, vy * 127];
  }
  private goTo(w: World, p: Player, x: number, y: number, near: number): [number, number] {
    const d = Math.hypot(x - p.x, y - p.y); if (d < near) return [0, 0];
    if (!this.goal || Math.hypot(this.goal[0] - x, this.goal[1] - y) > 120 || this.repathT <= 0 || !this.path.length) {
      this.goal = [x, y]; this.repathT = 2.5;
      this.path = (d > 90 ? findPath(w.map, p.x, p.y, x, y) : null) ?? [[x, y]];
    }
    while (this.path.length > 1 && Math.hypot(this.path[0][0] - p.x, this.path[0][1] - p.y) < 18) this.path.shift();
    const [wx, wy] = this.path[0]; const dx = wx - p.x, dy = wy - p.y; const l = Math.hypot(dx, dy) || 1;
    return [(dx / l) * 127, (dy / l) * 127];
  }
  private tryTp(w: World, p: Player, shrine: number): void {
    if (p.tpT > 0 || w.time - p.lastHurtT < 3) return; if (doAction(w, p, { t: 'tp', shrine }) == null) { this.path = []; this.wander = null; }
  }
  private randomPoint(w: World, p: Player, zone: number): [number, number] {
    for (let i = 0; i < 30; i++) {
      const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(250, 700); const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (isWalkable(w.map, x, y) && zoneAt(w.map, x, y) === zone) return [x, y];
    }
    return [p.x + w.rng.range(-200, 200), p.y + w.rng.range(-200, 200)];
  }
  private maybeUlt(w: World, p: Player): void {
    const crowd = w.spatial.count(p.x, p.y, 260);
    let boss = false; w.spatial.each(p.x, p.y, 420, m => { if (m.boss) boss = true; });
    let downNear = false; if (p.prof.cls === 'shaman') for (const q of w.playersNear(p.x, p.y, 320, true)) if (q.down) downNear = true;
    if (crowd >= 9 || boss || downNear) doAction(w, p, { t: 'ult' });
  }
  /** Gear/talisman housekeeping, through the same validated actions as a human. */
  private manage(w: World, p: Player): void {
    const pr = p.prof;
    for (const it of [...pr.inv]) {
      const cur = computeStats(pr).power; const trial = { ...pr, equip: { ...pr.equip, [it.slot]: it } };
      if (computeStats(trial).power > cur) doAction(w, p, { t: 'equip', uid: it.uid });
    }
    if (this.gear === 'light') {
      const open = slotsUnlocked(pr.level);
      for (let i = 0; i < open; i++) if (pr.slots[i] == null) { const t = pr.tals.find(x => !pr.slots.includes(x.uid) && !pr.slots.some(u => pr.tals.find(y => y.uid === u)?.kind === x.kind)); if (t) doAction(w, p, { t: 'talslot', slot: i, uid: t.uid }); }
      return;
    }
    if (pr.inv.length > 6) doAction(w, p, { t: 'sell', uids: pr.inv.map(x => x.uid) });
    if (p.zone === 0) for (let g = 0; g < 5; g++) { const it = (['weapon', 'armor', 'charm'] as const).map(k => pr.equip[k]).filter(x => x && x.plus < MAX_PLUS).sort((a, b) => a!.plus - b!.plus)[0]; if (!it || pr.gold < enhanceCost(it) * 1.3) break; doAction(w, p, { t: 'enhance', uid: it.uid }); }
    for (let guard = 0; guard < 6; guard++) {
      const groups = new Map<string, number[]>(); for (const t of pr.tals) { const k = t.kind + t.lv; groups.set(k, [...(groups.get(k) ?? []), t.uid]); }
      const g3 = [...groups.values()].find(v => v.length >= 3); if (!g3) break; doAction(w, p, { t: 'merge', uid: g3[0] });
    }
    const open = slotsUnlocked(pr.level); const best = [...pr.tals].sort((a, b) => b.lv - a.lv); const used = new Set<string>();
    const pick: number[] = []; for (const t of best) { if (used.has(t.kind)) continue; used.add(t.kind); pick.push(t.uid); if (pick.length >= open) break; }
    pick.forEach((uid, i) => { if (pr.slots[i] !== uid) doAction(w, p, { t: 'talslot', slot: i, uid }); });
  }
}

/** How far a bot keeps from its target: melee classes stay within reach, ranged ones keep a gap. */
function meleeReach(p: Player, r: number, ranged: number): number {
  const c = CLASSES[p.prof.cls]; return c.melee ? r + Math.max(28, c.range * 0.42) : Math.min(ranged, c.range * 0.75);
}
function centroid(w: World, p: Player, r: number): [number, number] | null {
  let sx = 0, sy = 0, n = 0; w.spatial.each(p.x, p.y, r, m => { sx += m.x; sy += m.y; n++; }); return n ? [sx / n, sy / n] : null;
}
function dirAway(p: Player, x: number, y: number): [number, number] { const dx = p.x - x, dy = p.y - y; const l = Math.hypot(dx, dy) || 1; return [(dx / l) * 127, (dy / l) * 127]; }
function nearestShrine(w: World, x: number, y: number): number { let b = 0, bd = Infinity; for (const s of w.map.shrines) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; b = s.id; } } return b; }

/** Adds AI companions to a world. Buddies start near `level` and follow `buddyOf`. */
export function addBots(w: World, count: number, level: number, buddyOf: number, seed: number): Player[] {
  const out: Player[] = []; const rng = new Rng(seed);
  const roamLv = [9, 15, 22, 12, 18, 26];
  // companions aren't bound by unlocks (they show players what's ahead); the party always has a healer
  const healer: ClassId = rng.chance(0.5) ? 'shaman' : 'musician';
  const deck = CLASS_IDS.filter(c => c !== healer).sort(() => rng.next() - 0.5);
  for (let i = 0; i < count; i++) {
    const role: 'buddy' | 'roamer' = i < Math.ceil(count / 2) ? 'buddy' : 'roamer';
    const lv = role === 'buddy' ? Math.max(1, level + rng.int(-1, 1)) : roamLv[(i - Math.ceil(count / 2)) % roamLv.length];
    const cls = i === 0 ? healer : deck[(i - 1) % deck.length];
    const name = BOT_NAMES[(i + (seed % BOT_NAMES.length)) % BOT_NAMES.length];
    const prof = makeBotProfile(name, cls, lv, seed + i * 17);
    const p = w.addPlayer('bot:' + name, prof, true);
    if (role === 'roamer') { const z = zoneForLevel(lv); const s = w.map.shrines[SHRINE_FOR_ZONE[z]]; const [x, y] = w.safeSpot(s.x + rng.range(-80, 80), s.y + 120); p.x = x; p.y = y; }
    else { const [x, y] = w.safeSpot(w.map.spawn.x + rng.range(-120, 120), w.map.spawn.y + rng.range(20, 90)); p.x = x; p.y = y; }
    const b = new BotBrain(role, seed + i); b.buddy = role === 'buddy' ? buddyOf : 0; w.brains.set(p.id, b); out.push(p);
  }
  return out;
}
