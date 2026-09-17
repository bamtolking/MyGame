// 물리·판정 설정. 화면 크기와 무관한 설계 좌표계(540×960)를 사용한다.

export const WORLD_W = 540;
export const WORLD_H = 960;
export const GROUND_Y = 900;          // 바닥 윗면

export const FIXED_DT = 1 / 60;       // 한 시뮬레이션 스텝(초)
export const SUBSTEPS = 1;            // 스텝당 엔진 갱신 횟수. 실험 결과 서브스텝(4.17ms)은 기대어 있는 접촉을 과도하게 감쇠시켜 도미노 연쇄가 멈추므로 단일 갱신을 쓴다.
export const SUB_DELTA_MS = (1000 / 60) / SUBSTEPS;
export const MAX_STEPS_PER_FRAME = 3; // 긴 프레임 지연 시 한 번에 보충할 최대 스텝 수
export const GRAVITY_Y = 1.6;         // matter 단위(scale 0.001) ≈ 1600 px/s² (미니어처 스케일: 낙하·연쇄가 또렷하게 빠름)

export const ENGINE_OPTS = {
  positionIterations: 8,
  velocityIterations: 6,
  constraintIterations: 6,
};

// 수면(sleeping) 임계값. 느리게 구르는 공이 잠든 블록을 깨울 수 있도록 기본값보다 낮춘다.
export const SLEEP = {
  motionSleepThreshold: 0.03,
  motionWakeThreshold: 0.05,
  propagateWakeSpeed: 0.5,   // 제약 조건으로 연결된 상대가 이 속도 이상이면 잠든 물체를 깨운다
};

export const LAUNCH = {
  maxDrag: 150,          // 최대 당김 거리(월드 px)
  minDrag: 18,           // 이보다 짧으면 발사 취소
  maxSpeed: 1450,        // px/s (power 1.0). 한 스텝 이동 ≤ 24.2px < 최소 블록 두께/2(11) + 반지름(15) = 26 → 관통 불가
  touchRadius: 130,      // 발사대 터치 영역 반지름
  previewSeconds: 0.55,  // 미리보기 최대 시간
  previewPoints: 14,
};

export const PROJECTILE = {
  radius: 15,
  density: 0.006,
  restitution: 0.2,
  friction: 0.35,
  frictionStatic: 0.5,
  frictionAir: 0,
  ropeCutMargin: 2,      // 밧줄 반두께
};

export const JUDGE = {
  toppleAngleDeg: 50,
  toppleMinMoveRatio: 0.1,   // 중심 이동 ≥ 이 비율 × 높이
  toppleFallRatio: 1.5,      // 중심이 이만큼(높이 배수) 아래로 떨어져도 넘어짐으로 인정
  holdSteps: 18,             // 0.3초 조건 유지
  settleSpeed: 0.35,         // px per 1/60s (≈21 px/s)
  settleSpeedHanging: 1.5,   // 밧줄에 매달린 추는 작은 흔들림을 안정으로 본다(≈90 px/s)
  settleAngular: 0.012,      // rad per 1/60s
  settleHoldSteps: 30,       // 0.5초 안정
  creepWindowSteps: 45,      // 이 창(0.75초) 동안의 누적 이동·회전도 검사해 천천히 기울어지는 블록을 안정으로 오판하지 않는다
  creepMaxMove: 2.5,         // px
  creepMaxRotDeg: 1.5,       // 도
  successSettleSteps: 30,    // 목표 달성 후 안정 확인 시간
  successMaxWaitSteps: 300,  // 목표 달성 후 최대 대기(5초) — 초과 시 보호물이 안전하면 성공
  shotMaxObserveSteps: 780,  // 발사 후 최대 관찰(13초) — 초과 시 안정으로 간주하고 판정
  comboWindowSteps: 90,      // 1.5초 안에 다른 목표 달성 시 콤보
  presettleSteps: 90,        // 시작 안정화 스텝(1.5초)
  resultDelaySteps: 45,      // 결과 확정 후 UI 표시까지 여유(연출용)
};

export const BOUNDS = { minX: -250, maxX: WORLD_W + 250, maxY: WORLD_H + 200 };

export const HIT_EVENT_MIN_SPEED = 1.2; // px per 1/60s 상대 속도. 이 이상일 때만 충돌 이벤트
