import type { FrontAnalysis, MetricResult, SideAnalysis } from './analyze';
import { FLAT_BACK_BELOW, NORMS, POSTURE_AGE, SCORE_K, SCORE_MAX, SCORE_MIN, type MetricId } from './norms';
import { clamp } from './geometry';

/** 체형 동물 유형 */
export type AnimalId = 'turtle' | 'shrimp' | 'duck' | 'flamingo' | 'meerkat';

/**
 * 교정 운동이 겨냥하는 문제(이슈). 운동 데이터의 targets 와 같은 이름을 씁니다.
 * 스캔 결과·통증 부위·목표에서 가중치가 매겨집니다.
 */
export type IssueId =
  | 'fhp'
  | 'roundShoulder'
  | 'kyphosis'
  | 'lordosis'
  | 'flatBack'
  | 'swayback'
  | 'kneeHyperext'
  | 'kneeFlexed'
  | 'headTilt'
  | 'shoulderTilt'
  | 'pelvicTilt'
  | 'lateralShift'
  | 'kneeValgus'
  | 'kneeVarus'
  | 'neckPain'
  | 'shoulderPain'
  | 'upperBackPain'
  | 'lowBackPain'
  | 'hipPain'
  | 'kneePain'
  | 'wristPain'
  | 'headache'
  | 'stiffness'
  | 'stress';

export interface TypeResult {
  primary: AnimalId;
  secondary?: AnimalId;
  domains: Record<Exclude<AnimalId, 'meerkat'>, number>;
}

export interface PostureReport {
  views: ('front' | 'side')[];
  metrics: Partial<Record<MetricId, MetricResult>>;
  score: number;
  /** 입력된 나이가 없으면 null */
  postureAge: number | null;
  ageDelta: number | null;
  type: TypeResult;
  issues: Partial<Record<IssueId, number>>;
  /** 좌우 비대칭 교정 시 더 신경 쓸 쪽 */
  emphasis: { upperTrap?: 'left' | 'right'; sideBend?: 'left' | 'right' };
}

const b = (m: Partial<Record<MetricId, MetricResult>>, id: MetricId, dir?: 1 | -1) => {
  const r = m[id];
  if (!r) return 0;
  if (dir && Math.sign(r.value) !== dir) return 0;
  return r.badness;
};

export function buildReport(front: FrontAnalysis | null, side: SideAnalysis | null, opts: { age?: number | null } = {}): PostureReport {
  const metrics: Partial<Record<MetricId, MetricResult>> = {};
  for (const r of [...(front?.metrics ?? []), ...(side?.metrics ?? [])]) metrics[r.id] = r;
  const views: ('front' | 'side')[] = [];
  if (front) views.push('front');
  if (side) views.push('side');

  // ── 점수 ──
  let penalty = 0;
  let wAvail = 0;
  for (const r of Object.values(metrics)) {
    if (!r) continue;
    const w = NORMS[r.id].weight;
    // 일자 허리(음의 방향)는 lordosis 지표 양의 방향과 별도로 약하게 반영
    penalty += w * r.badness;
    wAvail += w;
  }
  if (metrics.lordosis && metrics.lordosis.value < FLAT_BACK_BELOW) penalty += 0.34 * NORMS.lordosis.weight;
  // 한쪽 방향만 촬영했다면 측정하지 못한 항목은 비슷한 수준이라고 가정해 보정
  const wTotal = (Object.keys(NORMS) as MetricId[])
    .filter((id) => !NORMS[id].experimental || metrics[id])
    .reduce((s, id) => s + NORMS[id].weight, 0);
  const scale = wAvail > 0 ? wTotal / wAvail : 1;
  const score = Math.round(clamp(100 - SCORE_K * penalty * scale, SCORE_MIN, SCORE_MAX));

  // ── 자세 나이 ──
  let postureAge: number | null = null;
  let ageDelta: number | null = null;
  if (opts.age && opts.age > 0) {
    ageDelta = Math.round(clamp((POSTURE_AGE.pivotScore - score) * POSTURE_AGE.perPoint, POSTURE_AGE.minDelta, POSTURE_AGE.maxDelta));
    postureAge = clamp(opts.age + ageDelta, 12, 95);
    ageDelta = postureAge - opts.age;
  }

  // ── 이슈 가중치 (루틴 처방용) ──
  const issues: Partial<Record<IssueId, number>> = {};
  const set = (id: IssueId, v: number) => {
    if (v > 0.2) issues[id] = Math.max(issues[id] ?? 0, v);
  };
  set('fhp', b(metrics, 'headForward', 1));
  set('roundShoulder', b(metrics, 'shoulderForward', 1));
  set('kyphosis', b(metrics, 'kyphosis', 1));
  set('lordosis', b(metrics, 'lordosis', 1));
  if (metrics.lordosis && metrics.lordosis.value < FLAT_BACK_BELOW) set('flatBack', 0.4);
  set('swayback', Math.max(b(metrics, 'pelvisForward', 1), b(metrics, 'shoulderForward', -1)));
  set('kneeHyperext', b(metrics, 'kneeExtension', 1));
  set('kneeFlexed', b(metrics, 'kneeExtension', -1));
  set('headTilt', b(metrics, 'headTilt'));
  set('shoulderTilt', b(metrics, 'shoulderTilt'));
  set('pelvicTilt', b(metrics, 'pelvicTilt'));
  set('lateralShift', Math.max(b(metrics, 'trunkShift'), b(metrics, 'pelvicShift') * 0.8));
  set('kneeValgus', b(metrics, 'kneeAlign', 1));
  set('kneeVarus', b(metrics, 'kneeAlign', -1));

  // ── 동물 유형 ──
  const domains = {
    turtle: b(metrics, 'headForward', 1),
    shrimp: Math.max(b(metrics, 'shoulderForward', 1), b(metrics, 'kyphosis', 1)),
    duck: Math.max(
      b(metrics, 'lordosis', 1),
      b(metrics, 'pelvisForward', 1),
      b(metrics, 'kneeExtension', 1) * 0.9,
      b(metrics, 'kneeAlign') * 0.8,
      b(metrics, 'shoulderForward', -1) * 0.8,
    ),
    flamingo: Math.max(
      b(metrics, 'shoulderTilt'),
      b(metrics, 'pelvicTilt'),
      b(metrics, 'headTilt') * 0.8,
      b(metrics, 'trunkShift'),
      b(metrics, 'pelvicShift') * 0.8,
      b(metrics, 'headShift') * 0.7,
    ),
  };
  // 비슷한 수준이면 더 흔하고 체감이 큰 순서(거북목 > 굽은 등 > 좌우 > 골반)로 우선
  const priority = { turtle: 0.04, shrimp: 0.02, flamingo: 0.01, duck: 0 };
  const ranked = (Object.entries(domains) as [Exclude<AnimalId, 'meerkat'>, number][]).sort(
    (a, c) => c[1] + priority[c[0]] - (a[1] + priority[a[0]]),
  );
  let type: TypeResult = { primary: 'meerkat', domains };
  if (ranked[0][1] >= 0.34) {
    type = { primary: ranked[0][0], domains };
    if (ranked[1][1] >= 0.5) type.secondary = ranked[1][0];
  }

  // ── 좌우 강조 ──
  const emphasis: PostureReport['emphasis'] = {};
  const sh = metrics.shoulderTilt;
  // + = 왼쪽 어깨가 낮음 → 오른쪽 어깨가 올라감 → 오른쪽 상부승모근을 더 늘림
  if (sh && sh.level > 0) emphasis.upperTrap = sh.value > 0 ? 'right' : 'left';
  const pv = metrics.pelvicTilt;
  // + = 왼쪽 골반이 낮음 → 오른쪽 골반이 올라감 → 오른쪽 옆구리(요방형근)를 더 늘림
  if (pv && pv.level > 0) emphasis.sideBend = pv.value > 0 ? 'right' : 'left';

  return { views, metrics, score, postureAge, ageDelta, type, issues, emphasis };
}
