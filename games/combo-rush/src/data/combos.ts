// 연계 6종 정의: 이름·조건·수치. 실제 판정은 sim/combos.ts.
import type { UnitKind } from './units';
export type ComboId = 'ignite' | 'focus' | 'shards' | 'chainfrost' | 'firevortex' | 'overcharge';
export interface ComboDef { id: ComboId; name: string; units: [UnitKind, UnitKind]; cond: string; effect: string; color: string }
export const COMBOS: Record<ComboId, ComboDef> = {
  ignite:     { id: 'ignite', name: '점화 폭발', units: ['oil', 'flame'], cond: '기름이 묻은 적이 화염 공격을 받으면', effect: '기름을 소모하며 폭발, 주변 적에게 강한 화상. 같은 적은 1.5초마다.', color: '#ff6d00' },
  focus:      { id: 'focus', name: '집속 폭격', units: ['vortex', 'bomber'], cond: '회오리 표식이 남은 적 근처에 폭탄이 떨어지면', effect: '폭발 피해 ×1.6, 범위 ×1.3의 강화 폭발.', color: '#ce93d8' },
  shards:     { id: 'shards', name: '빙결 관통', units: ['frost', 'laser'], cond: '냉각·빙결된 적을 레이저가 관통하면', effect: '피해 ×1.5, 얼음 파편이 튀어 주변 적에게 추가 피해. 같은 적은 1초마다.', color: '#80deea' },
  chainfrost: { id: 'chainfrost', name: '냉각 연쇄', units: ['frost', 'tesla'], cond: '냉각된 적에게 번개가 닿으면', effect: '연결 대상 +2, 연결 거리 증가, 냉각 대상 피해 ×1.25. 같은 적은 한 번만.', color: '#40c4ff' },
  firevortex: { id: 'firevortex', name: '화염 회오리', units: ['vortex', 'flame'], cond: '회오리 범위 안에 불타는 적이 있으면', effect: '회오리가 불을 머금고 2초간 범위 화상 피해. 회오리마다 5초 대기.', color: '#ff3d00' },
  overcharge: { id: 'overcharge', name: '과충전 광선', units: ['engineer', 'laser'], cond: '동력공병 지원 범위 안의 레이저병이', effect: '일정 간격으로 충전되어 피해 ×2.2, 더 굵고 긴 광선을 발사(보호막 관통).', color: '#b2ff59' },
};
export const COMBO_IDS: readonly ComboId[] = ['ignite', 'focus', 'shards', 'chainfrost', 'firevortex', 'overcharge'];
export const COMBO_NUM = {
  igniteBase: 16, igniteDmgMul: 0.6, igniteRadius: 34, igniteBurnMul: 1.5,
  focusDmgMul: 1.6, focusRadiusMul: 1.3,
  shardsDmgMul: 1.5, shardsDmg: 5, shardsRadius: 30,
  chainExtra: 2, chainMax: 8, chainJumpBonus: 15, chainFrostDmgMul: 1.25,
  overchargeDmgMul: 2.2, overchargeWidthMul: 1.8, overchargeLenBonus: 40,
};
