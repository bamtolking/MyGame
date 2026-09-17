// 헤드리스 봇: 흐름장으로 목표까지 이동, 예고 공격을 대시로 회피, 경로 전략(A/B/C)에 따라 탈출·전진 결정
import type { RunState, Input, AbilityId, LootId } from '../src/sim/types';
import { step, dispatch, interactable } from '../src/sim/engine';
import { flowField, flowDir, dist, norm, hasLos } from '../src/sim/geom';
import { insidePad, padAvailable } from '../src/sim/escape';
import { bagWeight, freeWeight } from '../src/sim/state';
import { LOOT, BOSS } from '../src/data/balance';
import { zoneDef } from '../src/data/zones';

export type Path = 'A' | 'B' | 'C';
export interface BotOpts { path: Path; abilityPref?: AbilityId[]; log?: (m: string) => void; maxTime?: number; /** false면 예고를 무시하고 대시도 안 씀(초보자 근사) */ dodge?: boolean }

function goalDir(s: RunState, gx: number, gy: number): [number, number] {
  const f = flowField(s.zoneRt.rows, gx, gy, !!s.zoneRt.door?.open);
  const d = flowDir(s.zoneRt.rows, f, s.player.x, s.player.y, !!s.zoneRt.door?.open);
  if (d[0] === 0 && d[1] === 0) return norm(gx - s.player.x, gy - s.player.y);
  return d;
}

/** 위협 벡터: 예고 중인 적·투사체·보스 부채꼴 */
function threat(s: RunState): { dx: number; dy: number; urgent: boolean } {
  const p = s.player; let dx = 0, dy = 0, urgent = false;
  for (const e of s.enemies) {
    const d = dist(p.x, p.y, e.x, e.y);
    if (e.type === 'boss' && e.boss) {
      const b = e.boss;
      if (b.pattern === 'cone' && !b.fired) { const a = Math.atan2(p.y - e.y, p.x - e.x); const diff = Math.abs(((a - b.dirA + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < BOSS.cone.radius + 30 && diff < 1.1) { const px = -Math.sin(b.dirA), py = Math.cos(b.dirA); const side = ((p.x - e.x) * px + (p.y - e.y) * py) >= 0 ? 1 : -1; dx += px * side * 2; dy += py * side * 2; if (b.patternT > b.telegraph - 0.35) urgent = true; } }
      if (d < 70) { const [ux, uy] = norm(p.x - e.x, p.y - e.y); dx += ux; dy += uy; }
      continue;
    }
    if ((e.state === 'windup' || e.state === 'fuse' || e.state === 'charge') && d < 150) {
      const [ux, uy] = norm(p.x - e.x, p.y - e.y); dx += ux * 1.5; dy += uy * 1.5;
      if (e.stateT < 0.25 && d < 90) urgent = true;
    }
    if (e.type === 'bomber' && d < 110) { const [ux, uy] = norm(p.x - e.x, p.y - e.y); dx += ux; dy += uy; }
    if (d < 45) { const [ux, uy] = norm(p.x - e.x, p.y - e.y); dx += ux * 0.8; dy += uy * 0.8; }
  }
  for (const pr of s.projectiles) {
    if (pr.owner !== 'enemy') continue;
    const rx = p.x - pr.x, ry = p.y - pr.y; const d = Math.hypot(rx, ry); if (d > 140) continue;
    const [vx, vy] = norm(pr.vx, pr.vy); const along = rx * vx + ry * vy; if (along < 0) continue;
    const perp = Math.abs(rx * -vy + ry * vx); if (perp > 30) continue;
    const side = (rx * -vy + ry * vx) >= 0 ? 1 : -1; dx += -vy * side * 1.5; dy += vx * side * 1.5;
    if (d < 60) urgent = true;
  }
  return { dx, dy, urgent };
}

export interface BotResult { status: string; zone: number; value: number; time: number; hp: number; dmg: number[]; lootByZone: number[]; maxWeight: number; drops: number; cause: string; abilities: Partial<Record<AbilityId, number>>; timeByZone: number[]; bossKilled: boolean }

export function runBot(s: RunState, o: BotOpts): BotResult {
  const maxTime = o.maxTime ?? 900; const log = o.log || (() => {});
  let lastZone = 0; let stall = 0; let lastPos = [s.player.x, s.player.y]; let wanderA = 0;
  const wantsEscape = () => (o.path === 'A' && s.zone >= 2) || (o.path === 'B' && s.zone >= 4) || (o.path === 'C' && s.zone >= 6);
  let guard = 0;
  while (s.status === 'active' && s.time < maxTime && guard++ < maxTime * 60 + 1000) {
    if (s.zone !== lastZone) { lastZone = s.zone; log(`t=${s.time.toFixed(1)} 구역 ${s.zone} 진입 hp=${s.player.hp} 무게=${bagWeight(s)}`); }
    if (s.phase === 'ability' && s.abilityOffer) {
      const pref = o.abilityPref || ['rapid', 'pierce', 'frost', 'shock', 'mend', 'light', 'shield', 'magnet'];
      const pick = pref.find(a => s.abilityOffer!.includes(a)) || s.abilityOffer[0];
      dispatch(s, { type: 'pickAbility', id: pick }); log(`t=${s.time.toFixed(1)} 능력 선택: ${pick}`);
      continue;
    }
    const p = s.player; const input: Input = { mx: 0, my: 0, dash: false };
    const th = o.dodge === false ? { dx: 0, dy: 0, urgent: false } : threat(s);
    // 가방이 꽉 찼고 더 좋은 물건이 바닥에 있으면 고철부터 버림
    if (freeWeight(s) < 2) {
      const better = s.loots.some(l => !l.dropped && (l.type === 'relic' || l.type === 'parts') && dist(l.x, l.y, p.x, p.y) < 160);
      if (better && s.bag.items.scrap > 0) { dispatch(s, { type: 'drop', loot: 'scrap', n: 1 }); log(`t=${s.time.toFixed(1)} 고철 1개 버림`); }
      else if (better && s.bag.items.parts > 0 && s.loots.some(l => !l.dropped && l.type === 'relic' && dist(l.x, l.y, p.x, p.y) < 160)) { dispatch(s, { type: 'drop', loot: 'parts', n: 1 }); log(`t=${s.time.toFixed(1)} 전자부품 1개 버림`); }
    }
    let gx = p.x, gy = p.y; let hasGoal = false;
    const alive = s.enemies.filter(e => e.state !== 'dead');
    const inter = interactable(s);
    if (s.escape?.active) {
      const pad = s.zoneRt.exitPad!; gx = pad.x; gy = pad.y; hasGoal = dist(p.x, p.y, pad.x, pad.y) > pad.r * 0.5;
    } else if (s.phase === 'combat' || alive.length > 0) {
      // 전투: 가장 가까운 적 쪽으로, 너무 가까우면 거리 유지
      let ne = null as null | typeof alive[0]; let nd = Infinity;
      for (const e of alive) { const d = dist(p.x, p.y, e.x, e.y); if (d < nd) { nd = d; ne = e; } }
      if (ne) {
        const keep = ne.type === 'boss' ? 195 : o.dodge === false ? 40 : s.weapon === 'shotgun' ? 70 : s.weapon === 'staff' ? 120 : 150;
        const los = hasLos(s.zoneRt.rows, p.x, p.y, ne.x, ne.y);
        if (nd > keep || !los) { gx = ne.x; gy = ne.y; hasGoal = true; }
        else if (nd < keep - 40) { const [ux, uy] = norm(p.x - ne.x, p.y - ne.y); gx = p.x + ux * 80; gy = p.y + uy * 80; hasGoal = true; }
        else { // 옆으로 움직이며 전리품 주움
          const l = s.loots.find(l => !l.blocked && !l.dropped && dist(l.x, l.y, p.x, p.y) < 120 && freeWeight(s) >= LOOT[l.type].weight);
          if (l) { gx = l.x; gy = l.y; hasGoal = true; } else { wanderA += 0.05; gx = p.x + Math.cos(wanderA) * 60; gy = p.y + Math.sin(wanderA) * 60; hasGoal = true; }
        }
      } else if (s.spawns.length === 0 && s.zoneRt.waveIdx >= s.zoneRt.waves.length && !zoneDef(s.zone).boss) {
        // 대기 (목표 완료 전) — 상자 쪽으로
        const c = s.chests.find(c => !c.opened && c.kind === 'chest'); if (c) { gx = c.x; gy = c.y; hasGoal = true; }
      } else { const c = s.chests.find(c => !c.opened && c.kind === 'chest'); if (c) { gx = c.x; gy = c.y; hasGoal = true; } }
    } else {
      // 정리됨: 상자 → 전리품 → 금고(여유·체력 있을 때) → 드론(체력 낮을 때) → 탈출/문
      const chest = s.chests.find(c => !c.opened && c.kind === 'chest');
      const loot = s.loots.find(l => !l.blocked && !l.dropped && freeWeight(s) >= LOOT[l.type].weight && (l.type !== 'scrap' || freeWeight(s) > 8));
      const safe = s.chests.find(c => !c.opened && c.kind === 'safe');
      const drone = s.zoneRt.drone && !s.zoneRt.drone.used && p.hp < p.maxHp - 30 ? s.zoneRt.drone : null;
      if (inter?.kind === 'safe' && p.hp > 45) { dispatch(s, { type: 'openSafe', id: (inter.action as any).id }); log(`t=${s.time.toFixed(1)} 경보 금고 개방`); continue; }
      if (inter?.kind === 'drone') { const r = dispatch(s, { type: 'droneTrade' }); log(`t=${s.time.toFixed(1)} 드론 거래 ${r.ok ? '성공' : r.msg}`); if (!r.ok) s.zoneRt.drone!.used = true; continue; }
      if (chest) { gx = chest.x; gy = chest.y; hasGoal = true; }
      else if (loot) { gx = loot.x; gy = loot.y; hasGoal = true; }
      else if (safe && p.hp > 45) { gx = safe.x; gy = safe.y; hasGoal = true; }
      else if (drone) { gx = drone.x; gy = drone.y; hasGoal = true; }
      else if (wantsEscape() && s.zoneRt.exitPad && padAvailable(s)) {
        const pad = s.zoneRt.exitPad; gx = pad.x; gy = pad.y; hasGoal = true;
        if (insidePad(s)) { const r = dispatch(s, { type: 'requestEscape' }); if (r.ok) log(`t=${s.time.toFixed(1)} 탈출 요청 (가치 ${s.result?.value ?? ''})`); }
      } else if (s.zoneRt.door) {
        const d = s.zoneRt.door; gx = d.x; gy = d.y; hasGoal = true;
        if (inter?.kind === 'door') { dispatch(s, { type: 'enterDoor' }); continue; }
      }
    }
    let mx = 0, my = 0;
    if (hasGoal) { const [dx, dy] = goalDir(s, gx, gy); mx = dx; my = dy; }
    mx += th.dx * 1.2; my += th.dy * 1.2;
    const [ux, uy] = norm(mx, my); input.mx = ux; input.my = uy;
    if (th.urgent && p.dashCd <= 0) { input.dash = true; }
    // 탈출 중에는 패드 밖으로 나가지 않도록 위협 회피를 제한
    if (s.escape?.active) { const pad = s.zoneRt.exitPad!; const nx = p.x + ux * 20, ny = p.y + uy * 20; if (dist(nx, ny, pad.x, pad.y) > pad.r - 10) { const [cx, cy] = norm(pad.x - p.x, pad.y - p.y); input.mx = cx; input.my = cy; } }
    step(s, input);
    // 정체 감지
    if (dist(p.x, p.y, lastPos[0], lastPos[1]) < 0.5 && hasGoal) stall += 1 / 60; else stall = 0; lastPos = [p.x, p.y];
    if (stall > 6) { log(`t=${s.time.toFixed(1)} 정체: zone=${s.zone} phase=${s.phase} goal=(${gx.toFixed(0)},${gy.toFixed(0)}) pos=(${p.x.toFixed(0)},${p.y.toFixed(0)}) enemies=${alive.length} spawns=${s.spawns.length} kills=${s.zoneRt.kills}/${s.zoneRt.killsRequired} wave=${s.zoneRt.waveIdx}`); stall = 0; wanderA += 1.7; }
  }
  const r = s.result;
  return { status: s.status, zone: s.zone, value: r?.kind === 'escaped' ? r.value : 0, time: s.time, hp: s.player.hp, dmg: s.stats.damageTaken.slice(), lootByZone: s.stats.lootValue.slice(), maxWeight: s.stats.maxWeight, drops: s.stats.drops, cause: r?.cause || '', abilities: { ...s.abilities }, timeByZone: s.stats.time.slice(), bossKilled: s.zoneRt.bossDead };
}
