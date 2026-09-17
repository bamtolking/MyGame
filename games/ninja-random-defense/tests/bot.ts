// 헤드리스 봇: 밸런스 스윕과 스모크 테스트용 (플레이어 UI 아님)
import { newGame } from '../src/sim/state.ts';
import { step, dispatch, DT } from '../src/sim/engine.ts';
import type { GameState, Grade } from '../src/sim/types.ts';
import { MYTHIC_IDS, ELEMENTS } from '../src/data/units.ts';
import { SUMMON_COST, SUMMON_LV_COST, atkUpgradeCost, MAX_SUMMON_LV, MAX_ATK_LV } from '../src/data/economy.ts';
import { recipeStatus, canMerge } from '../src/sim/roster.ts';

export type Policy = 'greedy' | 'balanced' | 'upgrade' | 'idle';
export interface BotResult { seed: number; policy: Policy; round: number; won: boolean; time: number; summons: number; merges: number; crafts: number; peak: number; kills: number; gold: number; units: number; reason: string; firstHero: number; firstLegend: number; firstMythic: number }

export function runBot(seed: number, policy: Policy, opts: { maxTime?: number } = {}): BotResult {
  const s = newGame(seed, 'solo');
  const maxTime = opts.maxTime ?? 60 * 60;
  let lastThink = -1; let firstHero = 0, firstLegend = 0, firstMythic = 0;
  while (s.phase !== 'won' && s.phase !== 'eliminated' && s.time < maxTime) {
    if (policy !== 'idle' && Math.floor(s.time * 2) !== lastThink) {
      lastThink = Math.floor(s.time * 2); think(s, policy);
      if (!firstHero && s.units.some(u => u.grade >= 2)) firstHero = s.round;
      if (!firstLegend && s.units.some(u => u.grade >= 3)) firstLegend = s.round;
      if (!firstMythic && s.stats.mythics.length) firstMythic = s.round;
    } else if (policy === 'idle' && s.units.length < 5 && s.gold >= SUMMON_COST) dispatch(s, { type: 'summon' });
    step(s, DT); s.events.length = 0;
  }
  return { seed, policy, round: s.phase === 'won' ? 41 : s.round, won: s.phase === 'won', time: s.time, summons: s.stats.summons, merges: s.stats.merges, crafts: s.stats.crafts, peak: s.stats.peakGrade, kills: s.stats.kills, gold: Math.floor(s.gold), units: s.units.length, reason: s.eliminatedReason, firstHero, firstLegend, firstMythic };
}

export function think(s: GameState, policy: Policy): void {
  // 1. 신화 조합
  for (const id of MYTHIC_IDS) if (recipeStatus(s, id).canCraft) dispatch(s, { type: 'craft', id });
  // 2. 확정 합성
  dispatch(s, { type: 'automerge' });
  // 3. 강화 (정책별)
  const free = s.slots.filter(x => x == null).length;
  const reserve = policy === 'greedy' ? 0 : policy === 'balanced' ? 40 : 0;
  if (policy !== 'greedy') {
    const lvCost = s.summonLv < MAX_SUMMON_LV ? SUMMON_LV_COST[s.summonLv - 1] : Infinity;
    const wantLv = policy === 'upgrade' ? s.round >= 3 : s.round >= 6 + s.summonLv * 4;
    if (wantLv && s.gold >= lvCost + reserve) dispatch(s, { type: 'upgradeSummon' });
    const atkCost = s.atkLv < MAX_ATK_LV ? atkUpgradeCost(s.atkLv) : Infinity;
    if (s.gold >= atkCost + SUMMON_COST * 3 + reserve && (free <= 3 || s.round >= 8)) dispatch(s, { type: 'upgradeAtk' });
  }
  // 4. 소환 (자리 있으면)
  let guard = 0;
  while (guard++ < 30 && s.gold >= SUMMON_COST + reserve && s.slots.some(x => x == null)) { const r = dispatch(s, { type: 'summon' }); if (!r.ok) break; dispatch(s, { type: 'automerge' }); }
  // 5. 자리가 꽉 찼고 소환할 골드가 있으면: 무작위 합성 → 없으면 가장 약한 일반 유닛 판매
  if (!s.slots.some(x => x == null) && s.gold >= SUMMON_COST) {
    const low = [...s.units].filter(u => u.grade <= 1).sort((a, b) => a.grade - b.grade || a.id - b.id);
    const cand = low.find(u => canMerge(s, u).random);
    if (cand && s.round >= 2) dispatch(s, { type: 'merge', id: cand.id, random: true });
    else if (low.length && s.round >= 3) dispatch(s, { type: 'sell', id: low[0].id });
  }
}
