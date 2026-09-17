// 보상 후보 생성. 판의 난수 상태(RngState)를 사용하므로 새로고침 후에도 같은 후보가 유지된다.
import { EQUIPMENT, EQUIP_IDS, type EquipId, type Grade } from '../data/equipment';
import { BALANCE } from '../data/balance';
import { rngNext, rngInt, type RngState } from './rng';
import type { Item } from './bag';

export interface RewardCandidate { id: EquipId; grade: Grade }

export interface CandidateFlags { mergeable: boolean; mergeWith: string[]; hasTarget: boolean; targetNames: string[]; cells: number }

/** 후보가 현재 장비들과 어떤 관계인지 (표시용). */
export function candidateFlags(c: RewardCandidate, items: readonly Item[]): CandidateFlags {
  const def = EQUIPMENT[c.id];
  const mergeWith = items.filter(i => i.id === c.id && i.grade === c.grade && c.grade < 3).map(i => i.uid);
  let hasTarget = false; const targetNames: string[] = [];
  if (def.support) {
    for (const i of items) if (EQUIPMENT[i.id].tags.includes(def.support.appliesTo)) { hasTarget = true; if (!targetNames.includes(EQUIPMENT[i.id].name)) targetNames.push(EQUIPMENT[i.id].name); }
  } else if (def.weapon) {
    for (const i of items) { const sp = EQUIPMENT[i.id].support; if (sp && def.tags.includes(sp.appliesTo)) { hasTarget = true; if (!targetNames.includes(EQUIPMENT[i.id].name)) targetNames.push(EQUIPMENT[i.id].name); } }
  }
  return { mergeable: mergeWith.length > 0, mergeWith, hasTarget, targetNames, cells: def.shape.length };
}

function isUseful(c: RewardCandidate, items: readonly Item[]): boolean {
  const def = EQUIPMENT[c.id];
  if (def.kind !== 'support') return true;
  const f = candidateFlags(c, items);
  return f.hasTarget || f.mergeable;
}

function weightedPick(rng: RngState, exclude: EquipId[]): EquipId {
  const pool = EQUIP_IDS.filter(id => !exclude.includes(id));
  const total = pool.reduce((s, id) => s + (BALANCE.rewardWeights[id] || 1), 0);
  let r = rngNext(rng) * total;
  for (const id of pool) { r -= BALANCE.rewardWeights[id] || 1; if (r <= 0) return id; }
  return pool[pool.length - 1];
}

/**
 * 규칙: 같은 종류 3개 금지, 생존 장비 최대 1개, 지원 장비는 최대 2개,
 * 최소 1개는 현재 구성에서 쓸모가 있어야 함(무기이거나, 합성 가능하거나, 지원 대상이 있음).
 */
export function generateCandidates(rng: RngState, stage: number, items: readonly Item[]): RewardCandidate[] {
  const p2 = BALANCE.grade2Chance(stage);
  for (let attempt = 0; attempt < 40; attempt++) {
    const out: RewardCandidate[] = [];
    const used: EquipId[] = [];
    let survival = 0, support = 0;
    while (out.length < 3) {
      const id = weightedPick(rng, used);
      const kind = EQUIPMENT[id].kind;
      if (kind === 'survival' && survival >= 1) { used.push(id); continue; }
      if (kind === 'support' && support >= 2) { used.push(id); continue; }
      if (kind === 'survival') survival++; if (kind === 'support') support++;
      used.push(id);
      const grade: Grade = rngNext(rng) < p2 ? 2 : 1;
      out.push({ id, grade });
    }
    if (out.some(c => isUseful(c, items))) return out;
  }
  // 극단적인 경우: 무기 하나를 보장
  const ids: EquipId[] = ['mg', 'shotgun', 'battery'];
  return ids.map(id => ({ id, grade: (rngInt(rng, 100) < p2 * 100 ? 2 : 1) as Grade }));
}
