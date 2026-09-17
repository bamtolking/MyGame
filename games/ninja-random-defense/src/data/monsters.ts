// 몬스터·라운드 구성. 체력 곡선과 라운드별 종류는 여기서.
export type MonsterType = 'grunt' | 'runner' | 'brute' | 'boss';

export interface MonsterDef { type: MonsterType; name: string; hpMul: number; speed: number; count: number; hex: string; size: number }
export const MONSTER_DEFS: Record<MonsterType, MonsterDef> = {
  grunt:  { type: 'grunt',  name: '들개 닌자', hpMul: 1.0, speed: 50, count: 20, hex: '#c94f4f', size: 10 },
  runner: { type: 'runner', name: '질주 닌자', hpMul: 0.6, speed: 82, count: 20, hex: '#e08a3c', size: 9 },
  brute:  { type: 'brute',  name: '거한 닌자', hpMul: 2.0, speed: 40, count: 12, hex: '#7a4fc9', size: 12 },
  boss:   { type: 'boss',   name: '보스',      hpMul: 12,  speed: 30, count: 1,  hex: '#ff2e63', size: 18 },
};
export const BOSS_NAMES: Record<number, string> = { 10: '철갑 거미왕', 20: '독안개 두꺼비', 30: '그림자 마수', 40: '천년 요호' };

/** 라운드 r의 일반 몬스터 기본 체력 */
export function baseHp(r: number): number { return Math.round(18 * r * Math.pow(1.085, r) + 10); }

export function isBossRound(r: number): boolean { return r % 10 === 0; }
export function roundType(r: number): MonsterType {
  if (isBossRound(r)) return 'boss';
  const k = r % 10;
  if (k === 4 || k === 7) return 'runner';
  if (k === 2 || k === 5 || k === 8) return 'brute';
  return 'grunt';
}

export interface SpawnPlan { type: MonsterType; hp: number; speed: number; at: number; boss: boolean }
/** 라운드 r의 생성 계획 (라운드 시작 후 at초에 생성) */
export function roundPlan(r: number): SpawnPlan[] {
  const list: SpawnPlan[] = [];
  const hp = baseHp(r);
  if (isBossRound(r)) {
    const b = MONSTER_DEFS.boss;
    list.push({ type: 'boss', hp: Math.round(hp * b.hpMul), speed: b.speed, at: 0.5, boss: true });
    const g = MONSTER_DEFS.grunt;
    for (let i = 0; i < 8; i++) list.push({ type: 'grunt', hp: Math.round(hp * g.hpMul), speed: g.speed, at: 1.5 + i * 0.6, boss: false });
    return list;
  }
  const d = MONSTER_DEFS[roundType(r)];
  for (let i = 0; i < d.count; i++) list.push({ type: d.type, hp: Math.round(hp * d.hpMul), speed: d.speed, at: 0.5 + i * 0.45, boss: false });
  return list;
}
