// 무작위 소환 후보 3개 생성. 서로 다른 종류, 첫 후보엔 공격 유닛 보장. 시드 RNG만 사용(재현 가능).
import type { GameState } from './types';
import { UNIT_KINDS, type UnitKind } from '../data/units';
import { rngInt } from './rng';

const ATTACKERS: UnitKind[] = ['flame', 'frost', 'laser', 'tesla', 'bomber'];

/** 튜토리얼용 고정 후보(첫 세 번): 배치→합성→연계를 45초 안에 체험하도록 설계. */
const TUTORIAL_OFFERS: UnitKind[][] = [
  ['flame', 'oil', 'frost'],
  ['flame', 'tesla', 'bomber'],
  ['oil', 'laser', 'engineer'],
  ['frost', 'flame', 'vortex'],
];

export function rollOffer(s: GameState): UnitKind[] {
  const serial = s.offerSerial++;
  if (s.tutorial && serial < TUTORIAL_OFFERS.length) return [...TUTORIAL_OFFERS[serial]];
  const pool = [...UNIT_KINDS];
  const out: UnitKind[] = [];
  // 첫 소환(유닛 0기)에서는 공격 유닛을 최소 2개 보장
  const needAttack = s.units.length === 0 ? 2 : 1;
  let attackers = 0;
  while (out.length < 3) {
    const remaining = 3 - out.length;
    const mustAttack = attackers < needAttack && remaining <= (needAttack - attackers);
    const cand = mustAttack ? pool.filter(k => ATTACKERS.includes(k)) : pool;
    const k = cand[rngInt(s.rng, cand.length)];
    out.push(k); pool.splice(pool.indexOf(k), 1);
    if (ATTACKERS.includes(k)) attackers++;
  }
  return out;
}
