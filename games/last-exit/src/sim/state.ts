// 출정 상태 생성·구역 구성·직렬화·파생 수치
import type { RunState, WeaponId, Difficulty, LootId, Chest, LootDrop, ZoneRt, AbilityId, SimEvent } from './types';
import { seedRng, rngNext, rngInt, type RngState } from './rng';
import { PLAYER, BAG, WEAPONS, TIER_DMG, ABILITIES, LOOT, EVENTS, TILE, TIER_MILESTONES, ESCAPE, DIFFICULTY } from '../data/balance';
import { ZONES, zoneDef, type LootTable } from '../data/zones';
import { findTiles, tileCenter } from './geom';
import { lootWeight, emptyBag, LOOT_IDS } from '../data/loot';

export const STATE_VERSION = 1;

export function emit(s: RunState, ev: SimEvent): void { s.events.push(ev); }
export function toast(s: RunState, text: string, kind: 'info' | 'warn' | 'good' | 'bad' = 'info'): void { s.events.push({ t: 'toast', text, kind }); }

export interface NewRunOpts { seed: number; weapon: WeaponId; difficulty: Difficulty; bagUpgrades: number; runId: string }

export function newRun(o: NewRunOpts): RunState {
  const rng = seedRng(o.seed);
  const s: RunState = {
    v: STATE_VERSION, runId: o.runId, seed: o.seed, rng, difficulty: o.difficulty,
    status: 'active', phase: 'combat', weapon: o.weapon, tier: 0, abilities: {}, abilityOffer: null,
    zone: 0, time: 0, zoneTime: 0,
    player: { x: 0, y: 0, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, shield: 0, moveX: 0, moveY: 1, aimX: 0, aimY: 1, moving: false, dashT: 0, dashCd: 0, dashDx: 0, dashDy: 1, invulnT: 0, hurtT: 0, hurtDx: 0, hurtDy: 0, fireCd: 0, recoil: 0, shots: 0, targetId: null, walk: 0 },
    bag: { items: emptyBag(), maxWeight: BAG.baseMax + BAG.upgradeStep * Math.min(BAG.upgradeMax, Math.max(0, o.bagUpgrades)) },
    enemies: [], projectiles: [], loots: [], chests: [], spawns: [],
    zoneRt: null as unknown as ZoneRt, escape: null,
    flags: { zoneCleared: [], abilityPicked: [], healZone: [], shieldZone: [], tier: [], bossReward: false, tutorialStep: 0 },
    stats: { damageTaken: [0, 0, 0, 0, 0, 0, 0], lootValue: [0, 0, 0, 0, 0, 0, 0], time: [0, 0, 0, 0, 0, 0, 0], kills: [0, 0, 0, 0, 0, 0, 0], maxWeight: 0, drops: 0, safesOpened: 0, chestsOpened: 0, dashes: 0, hits: 0 },
    nextId: 1, volley: 0, result: null, events: [], bossBar: null,
  };
  enterZone(s, 1);
  return s;
}

export function nid(s: RunState): number { return s.nextId++; }

function rollLoot(rng: RngState, table: LootTable, relicBonus: number): { type: LootId; count: number }[] {
  const n = table.items[0] + rngInt(rng, table.items[1] - table.items[0] + 1);
  const out: Record<LootId, number> = emptyBag();
  for (let i = 0; i < n; i++) {
    const w = { ...table.weights }; w.relic += relicBonus;
    const total = w.scrap + w.parts + w.relic; let r = rngNext(rng) * total;
    let pick: LootId = 'scrap';
    if (r < w.scrap) pick = 'scrap'; else if (r < w.scrap + w.parts) pick = 'parts'; else pick = 'relic';
    out[pick]++;
  }
  return LOOT_IDS.filter(id => out[id] > 0).map(id => ({ type: id, count: out[id] }));
}

/** 구역 진입: 지도·상자·전리품·등장표 구성, 플레이어 배치, 진입 효과 1회 적용 */
export function enterZone(s: RunState, n: number): void {
  const def = zoneDef(n);
  const rows = def.map.slice();
  const w = rows[0].length, h = rows.length;
  const diff = DIFFICULTY[s.difficulty];
  s.zone = n; s.zoneTime = 0; s.phase = 'combat'; s.escape = null; s.abilityOffer = null;
  s.enemies = []; s.projectiles = []; s.loots = []; s.chests = []; s.spawns = []; s.bossBar = null;
  const [px, py] = tileCenter(...findTiles(rows, 'P')[0]);
  const p = s.player; p.x = px; p.y = py; p.dashT = 0; p.invulnT = 0; p.hurtT = 0; p.fireCd = 0; p.targetId = null; p.moving = false;
  const doorT = findTiles(rows, 'D')[0];
  const exitT = findTiles(rows, 'E')[0];
  const spawnPoints = findTiles(rows, '1').concat(findTiles(rows, '2'), findTiles(rows, '3'), findTiles(rows, '4'), findTiles(rows, '5'), findTiles(rows, '6')).map(t => { const [x, y] = tileCenter(t[0], t[1]); return { x, y }; });
  const waves = def.waves[s.difficulty];
  const killsRequired = waves.reduce((a, wv) => a + wv.groups.reduce((b, g) => b + g.n, 0), 0);
  // 상자
  for (const t of findTiles(rows, 'c')) {
    const [x, y] = tileCenter(t[0], t[1]);
    s.chests.push({ id: nid(s), x, y, kind: 'chest', opened: false, loot: rollLoot(s.rng, def.chest, diff.lootRelicBonus), alarmCount: 0 });
  }
  for (const t of findTiles(rows, 'A')) {
    const [x, y] = tileCenter(t[0], t[1]);
    const isSafe = def.events.safe === 'always' || (def.events.safe === 'chance' && rngNext(s.rng) < EVENTS.safeChanceZone4);
    if (isSafe) {
      const alarm = EVENTS.safeAlarm[s.difficulty]; const cnt = Object.values(alarm).reduce((a, b) => a + (b || 0), 0);
      const extraRelic = s.difficulty === 'hard' ? 1 : 0;
      s.chests.push({ id: nid(s), x, y, kind: 'safe', opened: false, loot: [{ type: 'relic', count: EVENTS.safeLoot.relic + extraRelic }, { type: 'parts', count: EVENTS.safeLoot.parts }], alarmCount: cnt });
    } else {
      s.chests.push({ id: nid(s), x, y, kind: 'chest', opened: false, loot: rollLoot(s.rng, def.chest, diff.lootRelicBonus), alarmCount: 0 });
    }
  }
  // 바닥 전리품
  findTiles(rows, 'l').forEach((t, i) => {
    const type = def.floorLoot[i % Math.max(1, def.floorLoot.length)] || 'scrap';
    const [x, y] = tileCenter(t[0], t[1]);
    s.loots.push({ id: nid(s), type, count: 1, x, y, attract: false, blocked: false, noPickT: 0 });
  });
  // 드론
  let drone: ZoneRt['drone'] = null;
  const droneT = findTiles(rows, 'M')[0];
  if (droneT && def.events.drone) {
    const roll = rngNext(s.rng);
    if (roll < EVENTS.droneChance) { const [x, y] = tileCenter(droneT[0], droneT[1]); drone = { x, y, used: false, heal: EVENTS.drone.heal, pay: EVENTS.drone.pay.map(p => ({ ...p })) }; }
  }
  const collapse = def.events.collapseAtKills ? { state: 'idle' as const, t: 0, atKills: def.events.collapseAtKills } : null;
  s.zoneRt = {
    index: n, w, h, rows, startX: px, startY: py,
    door: doorT ? { x: (doorT[0] + 0.5) * TILE, y: (doorT[1] + 0.5) * TILE, open: false } : null,
    exitPad: exitT ? { x: (exitT[0] + 0.5) * TILE, y: (exitT[1] + 0.5) * TILE, r: ESCAPE.padRadius, final: def.boss } : null,
    spawnPoints, waves, waveIdx: 0, lastWaveT: -99, killsRequired, kills: 0, collapse, drone,
    bossSpawned: false, bossDead: false, cleared: false, chestsTotal: s.chests.length,
  };
  // 진입 효과 (구역당 1회)
  const sh = s.abilities.shield || 0;
  if (sh > 0 && !s.flags.shieldZone.includes(n)) { s.flags.shieldZone.push(n); const amt = ABILITIES.shield.amount[sh - 1]; p.shield = Math.max(p.shield, amt); emit(s, { t: 'shield', amount: amt }); }
  if (n === 5) applyTier(s, 'z5enter');
  emit(s, { t: 'zoneEnter', zone: n });
}

export function applyTier(s: RunState, key: keyof typeof TIER_MILESTONES): void {
  if (s.flags.tier.includes(key)) return;
  s.flags.tier.push(key);
  const t = TIER_MILESTONES[key];
  if (t > s.tier) { s.tier = t; emit(s, { t: 'tier', tier: t }); toast(s, `무기 강화 ${t}단계: ${WEAPONS[s.weapon].tierDesc[t]}`, 'good'); }
}

// ───────── 파생 수치 ─────────
export interface WeaponStats { interval: number; dmg: number; pellets: number; chains: number; pierce: number; range: number; speed: number; knock: number; spread: number; projR: number; shockEvery: number; shockDmg: number; chainRange: number; chainFalloff: number }
export function weaponStats(s: RunState): WeaponStats {
  const w = WEAPONS[s.weapon]; const t = s.tier;
  const rapid = s.abilities.rapid || 0; const pierce = s.abilities.pierce || 0; const shock = s.abilities.shock || 0;
  let interval = w.interval / (1 + (rapid ? ABILITIES.rapid.perStack[rapid - 1] : 0));
  if (s.weapon === 'rifle' && t >= 2) interval /= 1.15;
  let pellets = w.pellets; if (s.weapon === 'shotgun') pellets += t;
  let chains = w.chains; if (s.weapon === 'staff') chains += t + pierce;
  let knock = w.knock; if (s.weapon === 'shotgun' && t >= 2) knock *= 1.4;
  const chainFalloff = s.weapon === 'staff' ? (t >= 2 ? 0.85 : WEAPONS.staff.chainFalloff) : 1;
  return {
    interval, dmg: w.dmg * TIER_DMG[t], pellets, chains, pierce: s.weapon === 'staff' ? 0 : pierce, range: w.range, speed: w.speed, knock, spread: w.spread, projR: w.projR,
    shockEvery: shock ? ABILITIES.shock.every[shock - 1] : 0, shockDmg: shock ? ABILITIES.shock.dmg[shock - 1] : 0,
    chainRange: WEAPONS.staff.chainRange, chainFalloff,
  };
}
export function bagWeight(s: RunState): number { return lootWeight(s.bag.items); }
export function bagValue(s: RunState): number { return LOOT_IDS.reduce((a, id) => a + s.bag.items[id] * LOOT[id].value, 0); }
/** 무게 감속: 적재율 60% 이하 0, 100%에서 최대 12%. 경량 프레임은 감속만 줄인다 */
export function weightSlow(s: RunState): number {
  const ratio = bagWeight(s) / s.bag.maxWeight;
  if (ratio <= BAG.slowStart) return 0;
  let slow = BAG.maxSlow * Math.min(1, (ratio - BAG.slowStart) / (1 - BAG.slowStart));
  const l = s.abilities.light || 0; if (l) slow *= 1 - ABILITIES.light.slowReduce[l - 1];
  return slow;
}
export function moveSpeed(s: RunState): number { return PLAYER.speed * (1 - weightSlow(s)); }
export function pickupRadius(s: RunState): number { const m = s.abilities.magnet || 0; return PLAYER.pickupRadius + (m ? ABILITIES.magnet.radius[m - 1] : 0); }
export function dashCooldown(s: RunState): number { const l = s.abilities.light || 0; return PLAYER.dashCooldown - (l ? ABILITIES.light.dashCd[l - 1] : 0); }
export function freeWeight(s: RunState): number { return s.bag.maxWeight - bagWeight(s); }

// ───────── 직렬화 ─────────
export function serialize(s: RunState): string {
  const copy = { ...s, events: [] };
  return JSON.stringify(copy);
}
export function deserialize(raw: string): RunState {
  const o = JSON.parse(raw) as RunState;
  if (!o || typeof o !== 'object') throw new Error('저장 데이터가 객체가 아님');
  if (o.v !== STATE_VERSION) throw new Error(`출정 저장 버전 불일치 (${o.v} → ${STATE_VERSION})`);
  for (const k of ['runId', 'rng', 'player', 'bag', 'zoneRt', 'flags', 'stats', 'enemies', 'loots', 'chests'] as const) if (!(k in o)) throw new Error(`저장 데이터 필드 누락: ${k}`);
  if (!o.zoneRt.rows || !Array.isArray(o.zoneRt.rows)) throw new Error('구역 지도 누락');
  if (typeof o.player.hp !== 'number' || typeof o.bag.maxWeight !== 'number') throw new Error('플레이어·가방 상태 손상');
  o.events = [];
  return o;
}

/** 동일 시드·입력 재현 확인용 해시 */
export function stateHash(s: RunState): number {
  const str = JSON.stringify({ p: [Math.round(s.player.x), Math.round(s.player.y), s.player.hp], e: s.enemies.map(e => [e.id, Math.round(e.x), Math.round(e.y), Math.round(e.hp)]), l: s.loots.map(l => [l.type, l.count]), b: s.bag.items, k: s.zoneRt.kills, t: Math.round(s.time * 100) });
  let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const ABILITY_IDS: AbilityId[] = ['rapid', 'pierce', 'shock', 'frost', 'magnet', 'light', 'shield', 'mend'];
export { ZONES };
