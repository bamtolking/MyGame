// 게임 규칙 수치. 밸런스 조정은 이 파일과 cats.ts만 고친다.

export interface Rules {
  /** 상자 안쪽 폭/높이 (월드 단위). 위쪽 테두리 y = 0, 바닥 y = boxH */
  boxW: number;
  boxH: number;
  gravity: number;
  friction: number;
  restitution: number;
  /** 떨어뜨리기 전 고양이 중심 높이 */
  dropY: number;
  /** 떨어뜨린 뒤 다음 고양이가 준비될 때까지 (초) */
  dropCooldown: number;
  /** 소환 확률 가중치 (0단계부터) */
  spawnWeights: number[];
  /** 캣닢 공이 나오는 간격 (떨어뜨린 횟수, [최소, 최대]) */
  catnipEvery: [number, number];
  /** 테두리 밖에 이만큼 머물면 끝 (초) */
  overflowTime: number;
  /** 떨어뜨린/태어난 직후 넘침 판정 유예 (초) */
  overflowGrace: number;
  /** 합체로 태어난 고양이가 이 시간 안에 또 합체하면 연쇄 콤보 (초) */
  comboWindow: number;
  /** 콤보 1단계당 점수 배율 증가 */
  comboBonus: number;
  comboMaxMul: number;
  /** 츄르 게이지: 첫 충전까지 점수, 이후 배수 */
  gaugeFirst: number;
  gaugeGrowth: number;
  maxCharges: number;
  startCharges: number;
  liquifyTime: number;
  liquifyShrink: number;
  shakeTime: number;
}

export const BASE_RULES: Rules = {
  boxW: 360,
  boxH: 430,
  gravity: 1900,
  friction: 0.3,
  restitution: 0.12,
  dropY: -62,
  dropCooldown: 0.45,
  spawnWeights: [30, 27, 21, 14, 8],
  catnipEvery: [22, 32],
  overflowTime: 2.2,
  overflowGrace: 1.1,
  comboWindow: 1.0,
  comboBonus: 0.5,
  comboMaxMul: 4,
  gaugeFirst: 2500,
  gaugeGrowth: 1.6,
  maxCharges: 3,
  startCharges: 1,
  liquifyTime: 3.5,
  liquifyShrink: 0.86,
  shakeTime: 1.1,
};

export type ModeId = 'classic' | 'daily';

export interface Modifier {
  id: string;
  name: string;
  desc: string;
  /** 체감 난이도 1..3 (봇 스윕 기준) */
  level: number;
  apply: (r: Rules) => void;
}

/** 오늘의 상자 규칙. 날짜 시드로 하나가 정해진다. */
export const MODIFIERS: Modifier[] = [
  { id: 'plain', name: '평범한 상자', desc: '특별한 규칙이 없는 날. 순수 실력 승부!', level: 2, apply: () => {} },
  { id: 'moon', name: '달나라 상자', desc: '중력이 약하다. 고양이가 둥실둥실 떨어진다.', level: 2, apply: r => { r.gravity *= 0.6; } },
  { id: 'butter', name: '버터 바른 상자', desc: '바닥도 고양이도 미끌미끌. 쉽게 굴러간다.', level: 2, apply: r => { r.friction = 0.02; } },
  { id: 'narrow', name: '좁은 상자', desc: '상자 폭이 좁아졌다. 쌓기 계획이 중요!', level: 3, apply: r => { r.boxW = 320; r.boxH = 460; } },
  { id: 'catnip', name: '캣닢 축제', desc: '캣닢 공이 훨씬 자주 나온다. 콤보 파티!', level: 1, apply: r => { r.catnipEvery = [7, 11]; } },
  { id: 'bouncy', name: '통통 상자', desc: '고양이들이 탱탱볼처럼 튄다.', level: 2, apply: r => { r.restitution = 0.5; } },
  { id: 'chonk', name: '뚱냥 주의보', desc: '처음부터 큰 고양이가 자주 나온다.', level: 3, apply: r => { r.spawnWeights = [14, 20, 26, 22, 18]; } },
  { id: 'rush', name: '급한 집사', desc: '다음 고양이가 두 배 빨리 준비된다. 쉴 틈이 없다!', level: 3, apply: r => { r.dropCooldown = 0.2; } },
];

export function makeRules(mods: string[] = []): Rules {
  const r: Rules = { ...BASE_RULES, spawnWeights: [...BASE_RULES.spawnWeights], catnipEvery: [...BASE_RULES.catnipEvery] as [number, number] };
  for (const id of mods) MODIFIERS.find(m => m.id === id)?.apply(r);
  return r;
}
