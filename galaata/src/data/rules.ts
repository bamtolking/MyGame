// 핵심 규칙 수치. 빙의·안정도·피격 규칙은 여기만 수정.
export const RULES = {
  /** 이 비율 이하 체력이면 빙의 가능 */
  possessHpRatio: 0.35,
  /** 빙의 버튼이 통하는 거리(px) */
  possessRange: 72,
  /** 빙의 직후 다시 빙의할 수 없는 시간(초) */
  possessCooldown: 1.75,
  /** 빙의 시 새 몸 체력을 최소 이 비율까지 회복(코어 이식 회복). 남은 체력이 더 높으면 그대로 */
  possessMinHpRatio: 0.45,
  /** 빙의 직후 무적(초) */
  possessInvuln: 0.7,
  /** 피격 후 다른 사격에 대한 무적(초). 같은 볼리(산탄 등)는 통과 */
  hitInvuln: 0.3,
  /** 한 스텝에 받을 수 있는 최대 피해 비율(겹쳐 맞아 즉사 방지) */
  maxDamagePerStepRatio: 0.4,
  /** 같은 볼리(산탄 한 발, 점사 한 묶음)가 플레이어에게 줄 수 있는 최대 피해 비율 */
  volleyCapRatio: 0.25,
  /** 적 발사 간격 배율(AI는 같은 무기를 더 느리게 씀) */
  enemyFireIntervalMul: 1.5,
  /** 적 사격 산포(rad). 움직이면 피할 수 있게 */
  enemySpread: 0.09,
  /** 안정도 0 이후 초당 최대체력 대비 손실 비율 */
  collapseHpLossPerSec: 0.18,
  /** 안정도 경고 비율 */
  stabilityWarnRatio: 0.25,
  /** 체력 0 → 마지막 기회(빈사) 지속 시간(초). 이 안에 빙의하면 생존 */
  lastChanceDuration: 1.0,
  /** 마지막 기회에 후보를 찾는 거리(px) */
  lastChanceRange: 110,
  /** 마지막 기회 동안 시간 배속 */
  lastChanceTimeScale: 0.35,
  /** 기절 후 빙의 가능 시간 */
  stunDuration: 2.2,
  shockMax: 100,
  shockDecayPerSec: 18,
  /** 구역 체크포인트 복구 시 최소 체력/안정도 비율 */
  checkpointMinHpRatio: 0.5,
  checkpointMinStabRatio: 0.5,
  /** 적이 플레이어에게 주는 피해 배율(같은 무기라도 AI가 쓰면 약함) */
  enemyDamageMul: 0.55,
  /** 적이 시야 밖 이 거리보다 멀리 있는 플레이어를 이 시간 이상 놓치면 추격 포기 */
  leashDistance: 320,
  leashSeconds: 3,
  /** 학습 구역에서 적이 플레이어를 알아채는 거리(px) */
  calmSight: 165,
  /** 상호작용 거리(px) */
  interactRange: 52,
  tile: 32,
  fixedDt: 1 / 60,
};
