// 전리품 획득·버리기·상자
import type { RunState, LootId, Chest, ActionResult } from './types';
import { LOOT, PLAYER, BAG, EVENTS } from '../data/balance';
import { emit, nid, pickupRadius, freeWeight, bagWeight, toast } from './state';
import { hasLos, dist, norm, dropPosition } from './geom';
import { scheduleSpawns } from './enemies';

let bagFullCooldown = new WeakMap<RunState, number>();

export function updateLoot(s: RunState, dt: number): void {
  const p = s.player; const rows = s.zoneRt.rows; const rad = pickupRadius(s);
  const free = freeWeight(s);
  const cdPrev = bagFullCooldown.get(s) || 0; if (cdPrev > 0) bagFullCooldown.set(s, cdPrev - dt);
  for (let i = s.loots.length - 1; i >= 0; i--) {
    const l = s.loots[i]; const w = LOOT[l.type].weight;
    if (l.noPickT > 0) { l.noPickT -= dt; continue; }
    if (l.blocked) { if (free >= w) l.blocked = false; else continue; }
    const d = dist(l.x, l.y, p.x, p.y);
    if (!l.attract) {
      const reach = l.dropped ? 18 : rad;
      if (d <= reach && hasLos(rows, p.x, p.y, l.x, l.y)) l.attract = true; else continue;
    }
    // 끌려오기
    if (d > 12) {
      const [ux, uy] = norm(p.x - l.x, p.y - l.y); const sp = PLAYER.pickupSpeed * Math.min(1, 0.35 + (rad + 40 - d) / rad);
      const step = Math.min(d, sp * dt); l.x += ux * step; l.y += uy * step;
      continue;
    }
    // 획득 판정 (한 번만)
    const fw = freeWeight(s); const n = Math.min(l.count, Math.floor(fw / w));
    if (n >= 1) {
      s.bag.items[l.type] += n; l.count -= n;
      if (!l.dropped) s.stats.lootValue[s.zone] += n * LOOT[l.type].value;
      s.stats.maxWeight = Math.max(s.stats.maxWeight, bagWeight(s));
      emit(s, { t: 'pickup', type: l.type, count: n, x: l.x, y: l.y });
    }
    if (l.count <= 0) s.loots.splice(i, 1);
    else { l.blocked = true; l.attract = false; const [ux, uy] = norm(l.x - p.x, l.y - p.y); l.x = p.x + ux * 22; l.y = p.y + uy * 22; if ((bagFullCooldown.get(s) || 0) <= 0) { emit(s, { t: 'bagFull' }); bagFullCooldown.set(s, 1.5); } }
  }
}

/** 버리기: 현재 구역의 유효한 바닥 위치에 떨어뜨림. 수량·가치 보존 */
export function dropLoot(s: RunState, type: LootId, n: number): ActionResult {
  const have = s.bag.items[type] || 0;
  n = Math.floor(n);
  if (n <= 0 || have <= 0) return { ok: false, msg: '버릴 물건이 없습니다' };
  n = Math.min(n, have);
  s.bag.items[type] -= n; s.stats.drops += n;
  let seed = (s.stats.drops * 7919 + s.zone * 104729 + Math.floor(s.time * 10)) >>> 0;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const [x, y] = dropPosition(s.zoneRt.rows, s.player.x, s.player.y, rng, !!s.zoneRt.door?.open);
  const near = s.loots.find(l => l.type === type && l.dropped && dist(l.x, l.y, x, y) < 18 && !l.attract);
  if (near) { near.count += n; near.noPickT = Math.max(near.noPickT, BAG.dropNoPick); near.blocked = false; near.dropped = true; }
  else s.loots.push({ id: nid(s), type, count: n, x, y, attract: false, blocked: false, noPickT: BAG.dropNoPick, dropped: true });
  emit(s, { t: 'drop', type, count: n });
  return { ok: true };
}

export function spawnChestLoot(s: RunState, c: Chest): void {
  let i = 0;
  for (const it of c.loot) {
    const a = (i * 2.1) + 0.6; const d = 20 + i * 6;
    let x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
    if (!hasLos(s.zoneRt.rows, c.x, c.y, x, y)) { x = c.x; y = c.y + 8; }
    s.loots.push({ id: nid(s), type: it.type, count: it.count, x, y, attract: false, blocked: false, noPickT: 0.25 });
    i++;
  }
}

/** 일반 상자: 접근 시 자동 개방 */
export function updateChests(s: RunState): void {
  const p = s.player;
  for (const c of s.chests) {
    if (c.opened || c.kind !== 'chest') continue;
    if (dist(p.x, p.y, c.x, c.y) <= PLAYER.radius + 22) {
      c.opened = true; s.stats.chestsOpened++; emit(s, { t: 'chest', x: c.x, y: c.y, kind: 'chest' }); spawnChestLoot(s, c);
    }
  }
}

/** 경보 금고: 명시적 확인으로만 개방. 반복 개방 불가 */
export function openSafe(s: RunState, id: number): ActionResult {
  const c = s.chests.find(x => x.id === id);
  if (!c || c.kind !== 'safe') return { ok: false, msg: '금고가 없습니다' };
  if (c.opened) return { ok: false, msg: '이미 열린 금고입니다' };
  if (dist(s.player.x, s.player.y, c.x, c.y) > 64) return { ok: false, msg: '금고에 더 가까이 가세요' };
  c.opened = true; s.stats.safesOpened++;
  emit(s, { t: 'chest', x: c.x, y: c.y, kind: 'safe' }); emit(s, { t: 'alarm' });
  spawnChestLoot(s, c);
  const alarm = EVENTS.safeAlarm[s.difficulty];
  const groups = (Object.keys(alarm) as (keyof typeof alarm)[]).filter(k => (alarm[k] || 0) > 0).map(k => ({ type: k, n: alarm[k]! }));
  scheduleSpawns(s, groups, true);
  toast(s, `경보 발생! 추가 적 ${c.alarmCount} 접근 중`, 'warn');
  return { ok: true };
}

export function nearestSafe(s: RunState): Chest | null {
  let best: Chest | null = null, bd = 64;
  for (const c of s.chests) { if (c.kind !== 'safe' || c.opened) continue; const d = dist(s.player.x, s.player.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
  return best;
}
