// 구역 진행: 등장표, 목표 완료, 문, 붕괴, 드론, 능력 선택, 무기 강화 이정표
import type { RunState, ActionResult, AbilityId } from './types';
import { ABILITIES, PLAYER, EVENTS, TILE, ABILITY_ZONES, WAVE_MIN_GAP } from '../data/balance';
import { zoneDef, TOTAL_ZONES } from '../data/zones';
import { emit, toast, enterZone, applyTier, ABILITY_IDS } from './state';
import { scheduleSpawns, spawnEnemy, invalidateFlow } from './enemies';
import { rngShuffle } from './rng';
import { findTiles, setTile, tileAt, nearestWalkable, tileCenter, dist } from './geom';

export function updateWaves(s: RunState): void {
  const z = s.zoneRt;
  if (zoneDef(s.zone).boss) {
    if (!z.bossSpawned && s.zoneTime >= 1.2) { const b = findTiles(z.rows, 'B')[0]; const [x, y] = tileCenter(b[0], b[1]); spawnEnemy(s, 'boss', x, y, true); }
    return;
  }
  while (z.waveIdx < z.waves.length) {
    const w = z.waves[z.waveIdx];
    const timeOk = w.at !== undefined && s.zoneTime >= w.at;
    const killOk = w.atKills !== undefined && z.kills >= w.atKills;
    if (!timeOk && !killOk) break;
    // 처치 조건을 채워도 직전 등장 후 최소 간격은 지킨다 (판 길이 조절)
    if (killOk && !timeOk && s.zoneTime < z.lastWaveT + WAVE_MIN_GAP[s.difficulty]) break;
    scheduleSpawns(s, w.groups, false);
    z.lastWaveT = s.zoneTime;
    z.waveIdx++;
  }
}

export function updateCollapse(s: RunState, dt: number): void {
  const z = s.zoneRt; const c = z.collapse; if (!c || c.state === 'done') return;
  if (c.state === 'idle') { if (z.kills >= c.atKills) { c.state = 'warn'; c.t = EVENTS.collapseWarn; emit(s, { t: 'collapseWarn' }); toast(s, '바닥이 흔들립니다! 표시된 통로에서 벗어나세요', 'warn'); } return; }
  c.t -= dt;
  if (c.t > 0) return;
  c.state = 'done';
  const xs = findTiles(z.rows, 'x'), ys = findTiles(z.rows, 'y');
  for (const [tx, ty] of xs) setTile(z.rows, tx, ty, '#');
  for (const [tx, ty] of ys) setTile(z.rows, tx, ty, '.');
  invalidateFlow(s);
  // 붕괴 타일 위의 대상은 가장 가까운 바닥으로 밀어냄 (즉사 없음)
  const relocate = (o: { x: number; y: number }, r: number) => {
    const [tx, ty] = tileAt(o.x, o.y);
    if (z.rows[ty]?.[tx] !== '#') return;
    const n = nearestWalkable(z.rows, o.x, o.y, true, 6); if (n) { const [cx, cy] = tileCenter(n[0], n[1]); o.x = cx; o.y = cy; }
  };
  relocate(s.player, PLAYER.radius);
  for (const e of s.enemies) relocate(e, e.r);
  for (const l of s.loots) relocate(l, 6);
  emit(s, { t: 'collapse' }); toast(s, '통로가 무너졌습니다. 다른 길이 열렸습니다', 'warn');
}

function scriptedPending(s: RunState): boolean { return s.spawns.some(sp => !sp.noLoot) || s.enemies.some(e => !e.noLoot && e.state !== 'dead' && e.type !== 'boss'); }

export function checkCleared(s: RunState): void {
  const z = s.zoneRt; if (z.cleared || s.status !== 'active') return;
  const def = zoneDef(s.zone);
  let done = false;
  if (def.boss) done = z.bossDead;
  else done = z.waveIdx >= z.waves.length && z.kills >= z.killsRequired && !scriptedPending(s);
  if (!done) return;
  z.cleared = true; s.flags.zoneCleared.push(s.zone);
  if (z.door) { z.door.open = true; invalidateFlow(s); }
  // 완료 회복 (구역당 1회, 생존 시에만)
  if (!s.flags.healZone.includes(s.zone) && s.player.hp > 0) {
    s.flags.healZone.push(s.zone);
    const m = s.abilities.mend || 0; let amt = PLAYER.baseClearHeal + (m ? Math.round(s.player.maxHp * ABILITIES.mend.pct[m - 1]) : 0);
    amt = Math.min(amt, s.player.maxHp - s.player.hp);
    if (amt > 0) { s.player.hp += amt; emit(s, { t: 'heal', amount: amt }); }
  }
  if (s.zone === 3) applyTier(s, 'z3clear');
  emit(s, { t: 'cleared', zone: s.zone });
  if (def.ability && ABILITY_ZONES.includes(s.zone) && !s.flags.abilityPicked.includes(s.zone)) { offerAbilities(s); s.phase = 'ability'; }
  else s.phase = 'cleared';
}

export function offerAbilities(s: RunState): void {
  const pool = ABILITY_IDS.filter(id => (s.abilities[id] || 0) < ABILITIES[id].maxStack);
  rngShuffle(s.rng, pool);
  s.abilityOffer = pool.slice(0, 3);
}
export function pickAbility(s: RunState, id: AbilityId): ActionResult {
  if (s.phase !== 'ability' || !s.abilityOffer) return { ok: false, msg: '지금은 능력을 고를 수 없습니다' };
  if (!s.abilityOffer.includes(id)) return { ok: false, msg: '후보에 없는 능력입니다' };
  if (s.flags.abilityPicked.includes(s.zone)) return { ok: false, msg: '이미 선택했습니다' };
  s.abilities[id] = (s.abilities[id] || 0) + 1;
  s.flags.abilityPicked.push(s.zone); s.abilityOffer = null; s.phase = 'cleared';
  toast(s, `${ABILITIES[id].name} ${s.abilities[id]}단계`, 'good');
  return { ok: true };
}

export function nearDoor(s: RunState): boolean { const d = s.zoneRt.door; return !!d && d.open && dist(s.player.x, s.player.y, d.x, d.y) <= TILE * 1.1; }

export function enterDoor(s: RunState): ActionResult {
  if (s.status !== 'active') return { ok: false };
  if (s.phase === 'ability') return { ok: false, msg: '능력을 먼저 고르세요' };
  if (!s.zoneRt.cleared || !s.zoneRt.door?.open) return { ok: false, msg: '아직 출구가 열리지 않았습니다' };
  if (!nearDoor(s)) return { ok: false, msg: '출구에 더 가까이 가세요' };
  if (s.zone >= TOTAL_ZONES) return { ok: false };
  if (s.escape) { s.escape.active = false; }
  s.stats.time[s.zone] = s.zoneTime;
  enterZone(s, s.zone + 1);
  invalidateFlow(s);
  return { ok: true };
}

export function nearDrone(s: RunState): boolean { const d = s.zoneRt.drone; return !!d && !d.used && dist(s.player.x, s.player.y, d.x, d.y) <= 60; }
export function droneOffer(s: RunState): { pay: { type: 'scrap' | 'parts' | 'relic'; count: number } | null; heal: number } {
  const d = s.zoneRt.drone; if (!d) return { pay: null, heal: 0 };
  const pay = d.pay.find(p => (s.bag.items[p.type] || 0) >= p.count) || null;
  return { pay, heal: Math.min(d.heal, s.player.maxHp - s.player.hp) };
}
export function droneTrade(s: RunState): ActionResult {
  const d = s.zoneRt.drone; if (!d || d.used) return { ok: false, msg: '드론이 없습니다' };
  if (!nearDrone(s)) return { ok: false, msg: '드론에 더 가까이 가세요' };
  const o = droneOffer(s); if (!o.pay) return { ok: false, msg: '지불할 전리품이 부족합니다' };
  if (o.heal <= 0) return { ok: false, msg: '체력이 이미 가득합니다' };
  s.bag.items[o.pay.type] -= o.pay.count; s.player.hp += o.heal; d.used = true;
  emit(s, { t: 'heal', amount: o.heal }); toast(s, `정비 드론: 체력 +${o.heal}`, 'good');
  return { ok: true };
}
export function unopenedChests(s: RunState): number { return s.chests.filter(c => !c.opened).length; }
export function floorLootCount(s: RunState): number { return s.loots.reduce((a, l) => a + l.count, 0); }
