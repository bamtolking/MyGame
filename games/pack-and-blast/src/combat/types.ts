// 전투 결과·통계 타입 (순수 데이터, 렌더링 객체 없음).
export interface WeaponStat {
  uid: string; id: string; grade: number;
  damage: number;        // 실제 적중 피해 합
  shots: number;         // 원본 공격 횟수 (발사 트리거 기준, 산탄 1발=1회)
  extraShots: number;    // 탄약상자 추가 탄 횟수
  chains: number;        // 공명 렌즈 연쇄 횟수
  overheatTime: number;  // 과열로 멈춘 실제 시간(초)
  kills: number;
}
export interface BattleStats {
  duration: number;
  damageTaken: number;      // 체력에 실제로 들어간 피해
  shieldStart: number;
  shieldAbsorbed: number;
  shieldLeft: number;
  protectedDamage: number;  // 충격파 보호로 막은 피해
  kills: number;
  spawned: number;
  weapons: Record<string, WeaponStat>;
  shockwaveUsed: boolean;
  shockwavePushed: number;
  enraged: boolean;
  bossPhase: number;
}
export interface BattleResult { won: boolean; hpAfter: number; stats: BattleStats }
