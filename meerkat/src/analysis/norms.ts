/**
 * 자세 평가 기준값 (전문가 보정용 단일 파일)
 *
 * 모든 임계값은 [경미, 중등도, 심함] 경계입니다. 첫 경계보다 작으면 '정상 범위'.
 * 사진 기반 추정치이므로 임상 측정(각도계·X-ray)과 1:1로 같지 않습니다.
 * 실제 회원/환자 데이터로 보정한 뒤 이 파일의 숫자만 바꾸면 앱 전체에 반영됩니다.
 *
 * 참고한 기준
 * - Kendall 표준 자세 수직선: 귀·견봉·대전자·무릎 약간 앞·외측 복사뼈 약간 앞
 * - 경추 전방 머리 자세(FHP): 머리가 어깨보다 앞으로 나올수록 경추 부하 증가 (Hansraj 2014)
 * - 흉추 후만 지수(Kyphosis Index, Flexicurve) ≥ 13 → 과후만 (Milne & Lauder 1974 외)
 */

export type MetricId =
  | 'headTilt'
  | 'shoulderTilt'
  | 'pelvicTilt'
  | 'headShift'
  | 'trunkShift'
  | 'pelvicShift'
  | 'kneeAlign'
  | 'headForward'
  | 'shoulderForward'
  | 'pelvisForward'
  | 'kneeExtension'
  | 'kyphosis'
  | 'lordosis';

export type View = 'front' | 'side';

export interface MetricNorm {
  view: View;
  unit: 'deg' | 'cm' | '%' | 'idx';
  /** 양의 방향 이상 경계 [경미, 중등도, 심함] */
  pos: [number, number, number];
  /** 음의 방향 이상 경계 (없으면 음수 방향은 평가하지 않음). 절대값으로 입력 */
  neg?: [number, number, number];
  /** 점수 가중치 */
  weight: number;
  /** 실루엣 기반 등 실험적 지표 */
  experimental?: boolean;
}

export const NORMS: Record<MetricId, MetricNorm> = {
  // ── 정면 ─────────────────────────────
  /** 머리 좌우 기울기(°). + = 왼쪽 귀가 더 낮음 */
  headTilt: { view: 'front', unit: 'deg', pos: [3, 5, 8], neg: [3, 5, 8], weight: 0.6 },
  /** 어깨 높이 기울기(°). + = 왼쪽 어깨가 더 낮음 */
  shoulderTilt: { view: 'front', unit: 'deg', pos: [2, 3.5, 5.5], neg: [2, 3.5, 5.5], weight: 1.0 },
  /** 골반 높이 기울기(°). + = 왼쪽 골반이 더 낮음 */
  pelvicTilt: { view: 'front', unit: 'deg', pos: [2, 3.5, 5.5], neg: [2, 3.5, 5.5], weight: 1.0 },
  /** 머리 좌우 치우침(어깨너비 대비 %). + = 왼쪽으로 */
  headShift: { view: 'front', unit: '%', pos: [6, 10, 15], neg: [6, 10, 15], weight: 0.5 },
  /** 몸통(어깨 중심)이 골반 중심에서 벗어난 정도(어깨너비 대비 %). + = 왼쪽으로 */
  trunkShift: { view: 'front', unit: '%', pos: [5, 9, 14], neg: [5, 9, 14], weight: 0.8 },
  /** 골반 중심이 두 발 중심에서 벗어난 정도(어깨너비 대비 %). + = 왼쪽으로 (짝다리 경향) */
  pelvicShift: { view: 'front', unit: '%', pos: [8, 13, 20], neg: [8, 13, 20], weight: 0.5 },
  /** 무릎 정렬(°, 양쪽 평균). + = 안쪽으로 모임(X다리 경향), − = 바깥으로 벌어짐(O다리 경향) */
  kneeAlign: { view: 'front', unit: 'deg', pos: [4, 7, 10], neg: [4, 7, 10], weight: 0.8 },

  // ── 측면 ─────────────────────────────
  /** 머리 전방 각도(°): 어깨→귀 선이 수직에서 앞으로 기운 정도. + = 머리가 앞 */
  headForward: { view: 'side', unit: 'deg', pos: [12, 18, 25], weight: 1.4 },
  /** 어깨 전방 거리(cm): 어깨가 골반(고관절)보다 앞. + = 라운드숄더·굽은 자세, − = 상체가 뒤로 젖혀짐 */
  shoulderForward: { view: 'side', unit: 'cm', pos: [3, 5.5, 8], neg: [4, 6, 9], weight: 1.1 },
  /** 골반 전방 거리(cm): 고관절이 기준 수직선보다 앞. + = 골반이 앞으로 밀림(스웨이백), − = 골반이 뒤 */
  pelvisForward: { view: 'side', unit: 'cm', pos: [3, 5, 8], neg: [3, 5, 8], weight: 0.7 },
  /** 무릎 신전(°). + = 과신전(뒤로 꺾임), − = 굽어 있음 */
  kneeExtension: { view: 'side', unit: 'deg', pos: [5, 8, 12], neg: [6, 10, 15], weight: 0.6 },
  /** 등 굽음 지수(실루엣 기반 Kyphosis Index). 높을수록 등이 둥글게 굽음 */
  kyphosis: { view: 'side', unit: 'idx', pos: [14, 17, 21], weight: 0.8, experimental: true },
  /** 허리 곡선 지수(실루엣 기반). 높을수록 허리가 깊게 휨(골반 전방경사 경향), 너무 낮으면 일자 허리 */
  lordosis: { view: 'side', unit: 'idx', pos: [16, 20, 25], weight: 0.7, experimental: true },
};

/** 일자허리(평평한 허리) 판단용 하한 — 허리 곡선 지수가 이보다 작으면 경미 */
export const FLAT_BACK_BELOW = 5;

/** 점수 = 100 − K × Σ(가중치 × 나쁨정도) */
export const SCORE_K = 16;
export const SCORE_MIN = 25;
export const SCORE_MAX = 99;

/** 자세 나이 = 나이 + (기준점수 − 점수) × 계수 */
export const POSTURE_AGE = {
  pivotScore: 75,
  perPoint: 0.45,
  minDelta: -8,
  maxDelta: 25,
  defaultAge: 30,
};

/** 신체 비율(키 대비 높이) — 사진 속 픽셀 → cm 환산에 사용 */
export const ANTHRO = {
  earHeight: 0.925,
  ankleHeight: 0.039,
  /** Kendall 수직선은 외측 복사뼈보다 약간(키의 1.2%) 앞 */
  plumbAnteriorOfAnkle: 0.012,
  defaultHeightCm: 168,
};
