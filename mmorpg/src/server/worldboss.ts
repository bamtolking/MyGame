// "핏빛 달" world boss event: announced, fought by everyone, rewards everyone who took part.
import { DT } from '../shared/constants.ts';
import { WORLD_BOSS } from '../shared/data/monsters.ts';
import type { World } from './world.ts';
import type { Player } from './entities.ts';
import { giveItem, giveTal, giveGold, grantXp, questEvent } from './progress.ts';
import { TAL_KINDS } from '../shared/data/talismans.ts';
import { xpNeed } from '../shared/data/xp.ts';

export interface WorldBoss { state: 'idle' | 'warn' | 'fight'; t: number; bossId: number; hpSet: number; sentT: number }
export const newWorldBoss = (first: number): WorldBoss => ({ state: 'idle', t: first, bossId: 0, hpSet: 0, sentT: 0 });
const WARN = 60, FIGHT_MAX = 300, ARENA = 700;

function arenaPlayers(w: World): Player[] { return w.playersNear(w.map.altar.x, w.map.altar.y, ARENA, true); }
export function wbPublic(w: World, p?: Player) {
  const top = w.wb.state === 'fight' ? [...w.players.values()].filter(q => q.wbDmg > 0).sort((a, b) => b.wbDmg - a.wbDmg).slice(0, 5).map(q => ({ name: q.prof.name, dmg: Math.round(q.wbDmg) })) : undefined;
  return { state: w.wb.state, t: Math.max(0, Math.round(w.wb.t)), top, myDmg: p ? Math.round(p.wbDmg) : undefined };
}

export function worldBossTick(w: World): void {
  const wb = w.wb; wb.t -= DT;
  if (wb.state === 'idle') {
    if (wb.t <= 0) {
      wb.state = 'warn'; wb.t = WARN;
      w.announce('🌕 핏빛 달이 떠오릅니다… 1분 뒤 달맞이 제단에 불가사리가 깨어납니다! (지도 → 제단으로 이동)', 'boss');
      for (const p of w.players.values()) p.wbDmg = 0;
      pushState(w);
    }
    return;
  }
  if (wb.state === 'warn') {
    if (w.tick % 20 === 0) pushState(w);
    if (wb.t <= 0) {
      wb.state = 'fight'; wb.t = FIGHT_MAX;
      const m = w.spawnMonster(WORLD_BOSS, w.map.altar.x, w.map.altar.y, 20);
      if (m) { wb.bossId = m.id; setBossHp(w, true); }
      w.announce('불가사리가 깨어났습니다! 모두 제단으로!', 'boss'); pushState(w);
    }
    return;
  }
  // fight
  const m = w.mons.get(wb.bossId);
  if (w.tick % 10 === 0) pushState(w);
  if (wb.t > FIGHT_MAX - 25 && w.tick % 20 === 0) setBossHp(w, false); // late arrivals raise HP during the first 25 s
  for (const p of arenaPlayers(w)) p.wbT += DT;
  if (!m || m.dead) { finish(w, true); return; }
  if (wb.t <= 0) { m.dead = true; w.emit({ k: 'mon', id: m.id, a: 'blink', x: Math.round(m.x), y: Math.round(m.y) }, m.x, m.y); finish(w, false); }
}

function setBossHp(w: World, initial: boolean): void {
  const m = w.mons.get(w.wb.bossId); if (!m) return;
  let pool = 0; for (const p of arenaPlayers(w)) pool += p.stats.atk * (p.bot ? 330 : 380);
  const want = Math.max(6000, Math.round(pool));
  if (initial) { m.maxHp = want; m.hp = want; w.wb.hpSet = want; }
  else if (want > w.wb.hpSet) { const f = want / w.wb.hpSet; m.maxHp = Math.round(m.maxHp * f); m.hp *= f; w.wb.hpSet = want; }
}

function finish(w: World, win: boolean): void {
  const wb = w.wb; wb.state = 'idle'; wb.t = w.opts.wbInterval; wb.bossId = 0;
  const all = [...w.players.values()]; const total = all.reduce((s, p) => s + p.wbDmg, 0) || 1;
  const ranked = all.filter(p => p.wbDmg > 0).sort((a, b) => b.wbDmg - a.wbDmg);
  if (win) {
    w.announce(`불가사리 토벌 성공! 1위 ${ranked[0]?.prof.name ?? '-'} · 참여자 모두에게 보상 상자가 지급됩니다`, 'boss');
    for (const p of all) {
      const share = p.wbDmg / total;
      if (share < 0.01 && p.wbT < 25) continue;
      const rank = ranked.indexOf(p);
      giveItem(w, p, p.prof.level + 1, 3);
      if (w.rng.chance(0.6)) giveTal(w, p, w.rng.pick(TAL_KINDS));
      const shards = 15 + (rank === 0 ? 15 : rank === 1 ? 10 : rank === 2 ? 5 : 0);
      p.prof.shards += shards; giveGold(p, 150 + p.prof.level * 40); grantXp(w, p, Math.round(xpNeed(p.prof.level) * 0.35));
      p.prof.stats.worldBoss++; p.questVer++; p.invVer++;
      questEvent(w, p, 'worldboss', 0);
      w.toast(p, `불가사리 보상 상자! 달빛 조각 +${shards}${rank >= 0 && rank < 3 ? ` (피해 ${rank + 1}위!)` : ''}`, '#ffd54a');
    }
  } else w.announce('불가사리가 어둠 속으로 사라졌습니다… 다음 핏빛 달을 기다리세요', 'boss');
  w.broadcast.push({ t: 'wb', w: { state: 'idle', t: Math.round(wb.t), top: ranked.slice(0, 5).map(p => ({ name: p.prof.name, dmg: Math.round(p.wbDmg) })) } });
  for (const p of all) { p.wbDmg = 0; p.wbT = 0; }
}
function pushState(w: World): void { w.broadcast.push({ t: 'wb', w: wbPublic(w) }); }
