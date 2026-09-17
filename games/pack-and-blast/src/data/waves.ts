// 12개 전투 구간의 적 등장 계획과 난이도 변형.
import type { EnemyType } from './enemies';
import type { Difficulty } from './balance';

export interface SpawnGroup { t: number; type: EnemyType; count: number; side?: 'top' | 'bottom' | 'left' | 'right' | 'ring' | 'any'; gap?: number }
export interface StageDef {
  stage: number;
  kind: 'normal' | 'elite' | 'boss';
  title: string;
  threats: string[];          // 정리 화면에 보여줄 다음 위협 요약
  groups: SpawnGroup[];
  targetSeconds: number;      // 설계 목표 시간 (안전장치 계산용)
}

const S = (stage: number, kind: StageDef['kind'], title: string, threats: string[], targetSeconds: number, groups: SpawnGroup[]): StageDef => ({ stage, kind, title, threats, groups, targetSeconds });

export const STAGES_NORMAL: StageDef[] = [
  S(1, 'normal', '고철장 입구', ['기본 적 소수'], 22, [
    { t: 0.5, type: 'basic', count: 2, side: 'any' }, { t: 4, type: 'basic', count: 2, side: 'any' }, { t: 8, type: 'basic', count: 3, side: 'ring' }, { t: 12, type: 'basic', count: 2, side: 'any' },
  ]),
  S(2, 'normal', '녹슨 컨베이어', ['빠른 적 등장'], 24, [
    { t: 0.5, type: 'basic', count: 2, side: 'any' }, { t: 3, type: 'rusher', count: 2, side: 'any' }, { t: 7, type: 'basic', count: 3, side: 'ring' }, { t: 10, type: 'rusher', count: 3, side: 'any' },
  ]),
  S(3, 'normal', '나사 창고', ['작은 적이 몰려옴'], 26, [
    { t: 0.5, type: 'swarm', count: 6, side: 'any', gap: 0.15 }, { t: 4, type: 'basic', count: 2, side: 'ring' }, { t: 7, type: 'swarm', count: 7, side: 'any', gap: 0.15 }, { t: 11, type: 'basic', count: 3, side: 'ring' },
  ]),
  S(4, 'elite', '정예: 장갑 순찰대', ['장갑 적 등장', '빠른 적 섞임'], 36, [
    { t: 0.5, type: 'basic', count: 3, side: 'ring' }, { t: 2, type: 'armored', count: 1, side: 'top' }, { t: 6, type: 'rusher', count: 4, side: 'any' }, { t: 10, type: 'armored', count: 1, side: 'bottom' }, { t: 13, type: 'basic', count: 4, side: 'ring' }, { t: 17, type: 'rusher', count: 3, side: 'any' },
  ]),
  S(5, 'normal', '연료 저장고', ['자폭 적 등장'], 26, [
    { t: 0.5, type: 'basic', count: 3, side: 'ring' }, { t: 3, type: 'bomber', count: 1, side: 'any' }, { t: 6, type: 'basic', count: 3, side: 'ring' }, { t: 9, type: 'bomber', count: 2, side: 'any', gap: 0.6 }, { t: 12, type: 'basic', count: 2, side: 'any' },
  ]),
  S(6, 'normal', '질주 활주로', ['빠른 적이 많음', '작은 적 다수'], 28, [
    { t: 0.5, type: 'rusher', count: 3, side: 'any' }, { t: 3, type: 'swarm', count: 6, side: 'any', gap: 0.15 }, { t: 6, type: 'rusher', count: 4, side: 'any' }, { t: 10, type: 'swarm', count: 6, side: 'ring', gap: 0.15 }, { t: 13, type: 'rusher', count: 4, side: 'any' },
  ]),
  S(7, 'normal', '압축기 라인', ['장갑 적 다수', '작은 적 다수'], 30, [
    { t: 0.5, type: 'armored', count: 1, side: 'top' }, { t: 2, type: 'swarm', count: 8, side: 'any', gap: 0.15 }, { t: 7, type: 'armored', count: 2, side: 'ring', gap: 0.8 }, { t: 10, type: 'swarm', count: 8, side: 'ring', gap: 0.15 }, { t: 14, type: 'basic', count: 3, side: 'any' },
  ]),
  S(8, 'elite', '정예: 폭발 호위대', ['장갑 다수', '자폭 적 다수'], 40, [
    { t: 0.5, type: 'basic', count: 3, side: 'ring' }, { t: 2, type: 'armored', count: 2, side: 'ring', gap: 0.8 }, { t: 5, type: 'bomber', count: 2, side: 'any', gap: 0.7 }, { t: 9, type: 'basic', count: 4, side: 'ring' }, { t: 12, type: 'armored', count: 2, side: 'any', gap: 0.8 }, { t: 15, type: 'bomber', count: 3, side: 'any', gap: 0.6 }, { t: 19, type: 'rusher', count: 4, side: 'any' },
  ]),
  S(9, 'normal', '벌레 둥지', ['대규모 군집', '자폭 적 섞임'], 30, [
    { t: 0.5, type: 'swarm', count: 10, side: 'any', gap: 0.12 }, { t: 4, type: 'swarm', count: 8, side: 'ring', gap: 0.12 }, { t: 7, type: 'bomber', count: 2, side: 'any', gap: 0.7 }, { t: 10, type: 'swarm', count: 10, side: 'any', gap: 0.12 }, { t: 14, type: 'bomber', count: 2, side: 'any' },
  ]),
  S(10, 'normal', '고속 레일', ['빠른 적 대량', '장갑 적 섞임'], 30, [
    { t: 0.5, type: 'rusher', count: 4, side: 'any' }, { t: 3, type: 'armored', count: 1, side: 'top' }, { t: 5, type: 'rusher', count: 5, side: 'any' }, { t: 9, type: 'armored', count: 2, side: 'ring', gap: 0.8 }, { t: 12, type: 'rusher', count: 5, side: 'any' },
  ]),
  S(11, 'normal', '수거기 앞마당', ['혼합 대부대', '모든 종류 등장'], 34, [
    { t: 0.5, type: 'basic', count: 4, side: 'ring' }, { t: 3, type: 'swarm', count: 8, side: 'any', gap: 0.12 }, { t: 6, type: 'rusher', count: 4, side: 'any' }, { t: 9, type: 'armored', count: 2, side: 'ring', gap: 0.8 }, { t: 12, type: 'bomber', count: 3, side: 'any', gap: 0.6 }, { t: 15, type: 'basic', count: 4, side: 'ring' }, { t: 18, type: 'rusher', count: 3, side: 'any' }, { t: 20, type: 'armored', count: 1, side: 'bottom' },
  ]),
  S(12, 'boss', '최종: 거대 고철 수거기', ['보스', '부하 소환 · 압축 공격 예고'], 55, [
    { t: 1.0, type: 'boss', count: 1, side: 'top' },
  ]),
];

/** 난이도별 구간 정의를 만든다. 어려움은 적 체력만 올리지 않고 조합·밀집·간격·정예·보스 압박을 바꾼다. */
export function getStages(diff: Difficulty): StageDef[] {
  if (diff === 'normal') return STAGES_NORMAL;
  return STAGES_NORMAL.map(s => {
    const groups: SpawnGroup[] = s.groups.map(g => ({ ...g, t: g.t * 0.85, count: g.type === 'boss' ? 1 : Math.ceil(g.count * 1.2), gap: g.gap ? g.gap * 0.85 : g.gap }));
    // 조합 변화: 3구간부터 자폭 적 1기 추가, 정예에 장갑 1기 추가, 6구간 이후 빠른 적 추가, 보스전은 개막 호위
    if (s.stage >= 3 && s.kind === 'normal') groups.push({ t: 6, type: 'bomber', count: 1, side: 'any' });
    if (s.kind === 'elite') groups.push({ t: 8, type: 'armored', count: 1, side: 'any' });
    if (s.stage >= 6 && s.kind === 'normal') groups.push({ t: 4, type: 'rusher', count: 2, side: 'any' });
    if (s.kind === 'boss') groups.push({ t: 0.5, type: 'rusher', count: 3, side: 'any' }, { t: 0.5, type: 'armored', count: 1, side: 'bottom' });
    return { ...s, groups, threats: [...s.threats, '어려움: 밀집 증가'], targetSeconds: s.targetSeconds + 4 };
  });
}

export const HARD_MODS = { hpMul: 1.1, dmgMul: 1.1, bossSummonMul: 0.75, bossCrushInterval: 9 };
