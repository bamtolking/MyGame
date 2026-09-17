// 연계 6종 판정. 연계로 생성된 피해는 combo=true 로 표시되어 다시 연계를 일으키지 않습니다.
import type { GameState, Enemy, Unit } from './types';
import type { ComboId } from '../data/combos';
import { COMBO_NUM } from '../data/combos';
import { UNIT_PARAMS, STATUS, unitStats } from '../data/units';
import { enemiesNear, hitEnemy, applyBurn } from './combat';

export function noteCombo(s: GameState, id: ComboId, x: number, y: number): void {
  const first = !s.combosSeen.includes(id);
  if (first) s.combosSeen.push(id);
  s.stats.combos[id] = (s.stats.combos[id] || 0) + 1;
  s.events.push({ t: 'combo', id, x, y, first });
}

/** ① 점화 폭발: 기름 묻은 적이 화염 직격을 받으면. 기름 소모, 적별 재발동 대기 1.5초. */
export function tryIgnite(s: GameState, e: Enemy, u: Unit, flameDmg: number): boolean {
  if (!e.alive || e.st.oil <= 0 || e.st.igniteCd > 0) return false;
  e.st.oil = 0; e.st.igniteCd = STATUS.igniteCd;
  const dmg = COMBO_NUM.igniteBase + flameDmg * COMBO_NUM.igniteDmgMul;
  const burn = UNIT_PARAMS.flame.burnDps[u.grade] * COMBO_NUM.igniteBurnMul;
  const x = e.x, y = e.y;
  for (const o of enemiesNear(s, x, y, COMBO_NUM.igniteRadius)) {
    hitEnemy(s, o, dmg, { unit: u, kind: 'flame', combo: true, dtype: 'explosion' });
    if (o.alive) applyBurn(s, o, burn, UNIT_PARAMS.flame.burnDur);
  }
  s.events.push({ t: 'explode', x, y, r: COMBO_NUM.igniteRadius, kind: 'ignite' });
  noteCombo(s, 'ignite', x, y);
  return true;
}

/** ② 집속 폭격: 폭발 반경 안에 회오리 표식 적이 있으면 강화 폭발. 호출자가 반환된 배율을 적용. */
export function focusBonus(s: GameState, x: number, y: number, r: number): { dmgMul: number; rMul: number } | null {
  const marked = enemiesNear(s, x, y, r).some(e => e.st.mark > 0);
  if (!marked) return null;
  noteCombo(s, 'focus', x, y);
  return { dmgMul: COMBO_NUM.focusDmgMul, rMul: COMBO_NUM.focusRadiusMul };
}

/** ③ 빙결 관통: 냉각·빙결 적을 레이저가 맞히면 피해 ×1.5 + 얼음 파편. 적별 1초 대기. 반환: 피해 배율 */
export function shardsOnLaser(s: GameState, e: Enemy, u: Unit): number {
  if (!(e.st.chill > 0 || e.st.frozen > 0)) return 1;
  if (e.st.shardCd > 0) return COMBO_NUM.shardsDmgMul; // 배율은 유지, 파편은 대기
  e.st.shardCd = STATUS.shardCd;
  const g = unitStats('laser', u.grade);
  const sd = COMBO_NUM.shardsDmg * (g.dmg / 8);
  const x = e.x, y = e.y;
  for (const o of enemiesNear(s, x, y, COMBO_NUM.shardsRadius)) if (o.id !== e.id) hitEnemy(s, o, sd, { unit: u, kind: 'laser', combo: true, dtype: 'explosion' });
  s.events.push({ t: 'explode', x, y, r: COMBO_NUM.shardsRadius, kind: 'shards' });
  noteCombo(s, 'shards', x, y);
  return COMBO_NUM.shardsDmgMul;
}

/** ⑤ 화염 회오리: 회오리 발동 시 범위 안에 불타는 적이 있으면 2초간 범위 화상. 회오리별 5초 대기. */
export function tryFireVortex(s: GameState, u: Unit, x: number, y: number, inRange: Enemy[]): boolean {
  if (u.fireVortexCd > 0) return false;
  if (!inRange.some(e => e.st.burn > 0)) return false;
  u.fireVortexT = STATUS.fireVortexDur; u.fireVortexCd = STATUS.fireVortexCd;
  noteCombo(s, 'firevortex', x, y);
  return true;
}
