import { CORE_POINTS, LM, type PoseFrame, type Pt } from '../pose/landmarks';
import { angleAt, clamp, deg, dist, median, mid, piecewise, xAtY, type V2 } from './geometry';
import { ANTHRO, NORMS, type MetricId, type View } from './norms';

export interface MetricResult {
  id: MetricId;
  /** 부호 있는 측정값(단위는 NORMS[id].unit) */
  value: number;
  /** 0 정상 · 1 경미 · 2 중등도 · 3 심함 */
  level: 0 | 1 | 2 | 3;
  /** 0~1.35 연속 나쁨 정도(점수·유형 계산용) */
  badness: number;
  /** 이상 방향: +1 양의 방향, -1 음의 방향, 0 정상 */
  dir: 1 | -1 | 0;
  /** 보조 수치 (cm 환산, 좌/우 개별 값 등) */
  extra?: Record<string, number>;
}

/** 측정값 → 등급/나쁨 정도 */
export function grade(id: MetricId, value: number, extra?: Record<string, number>): MetricResult {
  const n = NORMS[id];
  let th: [number, number, number] | undefined;
  let dir: 1 | -1 = 1;
  if (value >= 0) th = n.pos;
  else {
    th = n.neg;
    dir = -1;
  }
  const a = Math.abs(value);
  if (!th) return { id, value, level: 0, badness: 0, dir: 0, extra };
  const [t1, t2, t3] = th;
  const badness = piecewise(a, [0, t1 * 0.6, t1, t2, t3, t3 * 1.6], [0, 0.05, 0.34, 0.67, 1, 1.35]);
  const level = (a < t1 ? 0 : a < t2 ? 1 : a < t3 ? 2 : 3) as 0 | 1 | 2 | 3;
  return { id, value, level, badness, dir: level === 0 ? 0 : dir, extra };
}

// ─────────────────────────────────────────────
// 촬영 방향 판별 · 구도 확인
// ─────────────────────────────────────────────

export type ViewKind = View | 'oblique' | 'none';

export interface ViewInfo {
  view: ViewKind;
  /** (어깨너비+골반너비)/2 ÷ 몸통 길이 */
  ratio: number;
  /** 핵심 관절 평균 가시도 */
  conf: number;
}

const P = (f: PoseFrame, i: number): Pt => f.pts[i];

export function classifyView(f: PoseFrame): ViewInfo {
  const conf = CORE_POINTS.reduce((s, i) => s + P(f, i).v, 0) / CORE_POINTS.length;
  const ls = P(f, LM.leftShoulder), rs = P(f, LM.rightShoulder);
  const lh = P(f, LM.leftHip), rh = P(f, LM.rightHip);
  const torso = dist(mid(ls, rs), mid(lh, rh));
  if (torso < 1 || conf < 0.3) return { view: 'none', ratio: 0, conf };
  const ratio = (Math.abs(ls.x - rs.x) + Math.abs(lh.x - rh.x)) / 2 / torso;
  let view: ViewKind = 'oblique';
  if (ratio >= 0.4) view = 'front';
  else if (ratio <= 0.22) view = 'side';
  return { view, ratio, conf };
}

export type FrameProblem =
  | 'noPerson'
  | 'lowLight'
  | 'feetCut'
  | 'headCut'
  | 'tooClose'
  | 'tooFar'
  | 'offCenter'
  | 'turnFront'
  | 'turnSide'
  | 'backTurned';

export interface FrameCheck {
  ok: boolean;
  problems: FrameProblem[];
  info: ViewInfo;
  /** 몸 높이 / 화면 높이 */
  fill: number;
}

/** 실시간 촬영 가이드: 원하는 방향으로, 머리부터 발끝까지, 적당한 거리에 서 있는지 확인 */
export function checkFrame(f: PoseFrame | null, want: View): FrameCheck {
  if (!f) return { ok: false, problems: ['noPerson'], info: { view: 'none', ratio: 0, conf: 0 }, fill: 0 };
  const info = classifyView(f);
  const problems: FrameProblem[] = [];
  if (info.view === 'none') return { ok: false, problems: ['noPerson'], info, fill: 0 };
  if (info.conf < 0.55) problems.push('lowLight');
  const nose = P(f, LM.nose);
  const feet = [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex, LM.leftAnkle, LM.rightAnkle].map((i) => P(f, i));
  const lowest = Math.max(...feet.map((p) => p.y));
  const topY = Math.min(nose.y, P(f, LM.leftEar).y, P(f, LM.rightEar).y);
  const bodyH = lowest - topY;
  const fill = bodyH / f.h;
  const feetVisible = feet.filter((p) => p.v > 0.35).length >= 3;
  if (lowest > f.h * 0.995 || !feetVisible) problems.push('feetCut');
  if (topY < f.h * 0.04) problems.push('headCut');
  if (!problems.includes('feetCut') && !problems.includes('headCut')) {
    if (fill > 0.9) problems.push('tooClose');
    else if (fill < 0.42) problems.push('tooFar');
  }
  const cx = (P(f, LM.leftHip).x + P(f, LM.rightHip).x) / 2;
  if (cx < f.w * 0.2 || cx > f.w * 0.8) problems.push('offCenter');
  if (want === 'front') {
    if (info.view !== 'front') problems.push('turnFront');
    else if (nose.v < 0.5) problems.push('backTurned');
  } else if (info.view !== 'side') problems.push('turnSide');
  return { ok: problems.length === 0, problems, info, fill };
}

/** 여러 프레임의 랜드마크를 관절별 중앙값으로 합쳐 떨림을 줄입니다. */
export function medianFrame(frames: PoseFrame[]): PoseFrame | null {
  if (!frames.length) return null;
  const last = frames[frames.length - 1];
  const pts: Pt[] = last.pts.map((_, i) => ({
    x: median(frames.map((f) => f.pts[i].x)),
    y: median(frames.map((f) => f.pts[i].y)),
    z: median(frames.map((f) => f.pts[i].z)),
    v: median(frames.map((f) => f.pts[i].v)),
  }));
  return { w: last.w, h: last.h, pts, mask: last.mask };
}

/** 프레임 간 움직임(키 대비 %) — 가만히 서 있는지 판단 */
export function motionBetween(a: PoseFrame, b: PoseFrame): number {
  const idx = [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee];
  const scale = Math.max(1, Math.abs(P(a, LM.leftAnkle).y - P(a, LM.nose).y));
  let s = 0;
  for (const i of idx) s += dist(a.pts[i], b.pts[i]);
  return (s / idx.length / scale) * 100;
}

// ─────────────────────────────────────────────
// 정면 분석
// ─────────────────────────────────────────────

export interface FrontGeometry {
  earL: V2; earR: V2; eyeMid: V2; headMid: V2;
  shL: V2; shR: V2; hipL: V2; hipR: V2;
  kneeL: V2; kneeR: V2; ankleL: V2; ankleR: V2;
  centerX: number;
  cmPerPx: number;
}

export interface FrontAnalysis {
  view: 'front';
  metrics: MetricResult[];
  geo: FrontGeometry;
}

/** 사람의 왼쪽이 이미지 +x 방향이면 1 (정면 촬영, 비반전) */
function leftDirSign(f: PoseFrame): 1 | -1 {
  return P(f, LM.leftShoulder).x >= P(f, LM.rightShoulder).x ? 1 : -1;
}

/** 좌우 쌍의 기울기(°): + = 사람의 왼쪽이 더 낮음 */
function pairTilt(left: V2, right: V2): number {
  return deg(Math.atan2(left.y - right.y, Math.abs(left.x - right.x) || 1e-6));
}

export function analyzeFront(f: PoseFrame, opts: { heightCm?: number } = {}): FrontAnalysis {
  const s = leftDirSign(f);
  const earL = P(f, LM.leftEar), earR = P(f, LM.rightEar);
  const eyeL = P(f, LM.leftEye), eyeR = P(f, LM.rightEye);
  const shL = P(f, LM.leftShoulder), shR = P(f, LM.rightShoulder);
  const hipL = P(f, LM.leftHip), hipR = P(f, LM.rightHip);
  const kneeL = P(f, LM.leftKnee), kneeR = P(f, LM.rightKnee);
  const ankleL = P(f, LM.leftAnkle), ankleR = P(f, LM.rightAnkle);
  const earsOk = earL.v > 0.5 && earR.v > 0.5;
  const eyeMid = mid(eyeL, eyeR);
  const headMid = earsOk ? mid(earL, earR) : eyeMid;
  const ankleMid = mid(ankleL, ankleR);
  const shMid = mid(shL, shR);
  const hipMid = mid(hipL, hipR);
  const shW = Math.max(1, Math.abs(shL.x - shR.x));

  // 키 환산: 귀(또는 눈) ~ 발목 수직 거리
  const topH = earsOk ? ANTHRO.earHeight : 0.936;
  const statPx = Math.max(1, (ankleMid.y - headMid.y) / (topH - ANTHRO.ankleHeight));
  const heightCm = opts.heightCm ?? ANTHRO.defaultHeightCm;
  const cmPerPx = heightCm / statPx;

  const headTilt = earsOk ? pairTilt(earL, earR) : pairTilt(eyeL, eyeR);
  const shoulderTilt = pairTilt(shL, shR);
  const pelvicTilt = pairTilt(hipL, hipR);
  const headShift = ((headMid.x - shMid.x) / shW) * 100 * s;
  const trunkShift = ((shMid.x - hipMid.x) / shW) * 100 * s;
  const pelvicShift = ((hipMid.x - ankleMid.x) / shW) * 100 * s;

  // 무릎: 고관절-발목 선에서 무릎이 안쪽(몸 중심 쪽)으로 들어가면 + (X다리 경향)
  const kneeDev = (hip: V2, knee: V2, ankle: V2, medialSign: number) => {
    const off = knee.x - xAtY(hip, ankle, knee.y);
    const bend = 180 - angleAt(hip, knee, ankle);
    return Math.sign(off * medialSign) * bend;
  };
  // 왼다리의 안쪽은 사람 기준 오른쪽(= -s 방향), 오른다리의 안쪽은 +s 방향
  const kL = kneeDev(hipL, kneeL, ankleL, -s);
  const kR = kneeDev(hipR, kneeR, ankleR, s);
  const kneeAlign = (kL + kR) / 2;

  const metrics: MetricResult[] = [
    grade('headTilt', headTilt),
    grade('shoulderTilt', shoulderTilt, { cm: Math.abs(shL.y - shR.y) * cmPerPx }),
    grade('pelvicTilt', pelvicTilt, { cm: Math.abs(hipL.y - hipR.y) * cmPerPx }),
    grade('headShift', headShift, { cm: Math.abs(headMid.x - shMid.x) * cmPerPx }),
    grade('trunkShift', trunkShift, { cm: Math.abs(shMid.x - hipMid.x) * cmPerPx }),
    grade('pelvicShift', pelvicShift, { cm: Math.abs(hipMid.x - ankleMid.x) * cmPerPx }),
    grade('kneeAlign', kneeAlign, { left: kL, right: kR }),
  ];
  return {
    view: 'front',
    metrics,
    geo: { earL, earR, eyeMid, headMid, shL, shR, hipL, hipR, kneeL, kneeR, ankleL, ankleR, centerX: ankleMid.x, cmPerPx },
  };
}

// ─────────────────────────────────────────────
// 측면 분석
// ─────────────────────────────────────────────

export interface BackCurve {
  /** 등 뒤쪽 윤곽선 (이미지 좌표) */
  contour: V2[];
  c7: V2;
  l1: V2;
  s2: V2;
  /** 등 굽음 최고점 */
  tApex: V2;
  /** 허리 가장 깊은 점 */
  lApex: V2;
  kyphosis: number;
  lordosis: number;
}

export interface SideGeometry {
  facing: 1 | -1;
  side: 'left' | 'right';
  ear: V2; shoulder: V2; hip: V2; knee: V2; ankle: V2;
  plumbX: number;
  cmPerPx: number;
  statPx: number;
  back?: BackCurve;
}

export interface SideAnalysis {
  view: 'side';
  metrics: MetricResult[];
  geo: SideGeometry;
  /** 기준 수직선과 각 부위의 앞뒤 거리(cm, + = 앞) */
  plumbCm: { ear: number; shoulder: number; hip: number; knee: number };
}

function pick(f: PoseFrame, a: number, b: number, prefer: 'left' | 'right'): Pt {
  const [first, second] = prefer === 'left' ? [a, b] : [b, a];
  const p = P(f, first);
  return p.v >= 0.4 || P(f, second).v < p.v ? p : P(f, second);
}

export function analyzeSide(f: PoseFrame, opts: { heightCm?: number } = {}): SideAnalysis {
  // 카메라에 가까운 쪽(가시도 높은 쪽) 선택
  const vis = (ids: number[]) => ids.reduce((s, i) => s + P(f, i).v, 0);
  const leftVis = vis([LM.leftElbow, LM.leftWrist, LM.leftKnee, LM.leftAnkle, LM.leftHeel, LM.leftFootIndex]);
  const rightVis = vis([LM.rightElbow, LM.rightWrist, LM.rightKnee, LM.rightAnkle, LM.rightHeel, LM.rightFootIndex]);
  const side: 'left' | 'right' = leftVis >= rightVis ? 'left' : 'right';

  const ear = pick(f, LM.leftEar, LM.rightEar, side);
  const shoulder = pick(f, LM.leftShoulder, LM.rightShoulder, side);
  const hip = pick(f, LM.leftHip, LM.rightHip, side);
  const knee = pick(f, LM.leftKnee, LM.rightKnee, side);
  const ankle = pick(f, LM.leftAnkle, LM.rightAnkle, side);
  const heel = pick(f, LM.leftHeel, LM.rightHeel, side);
  const toe = pick(f, LM.leftFootIndex, LM.rightFootIndex, side);
  const nose = P(f, LM.nose);

  // 바라보는 방향: 코가 귀보다 앞. 애매하면 발끝 방향.
  let facing: 1 | -1 = nose.x >= ear.x ? 1 : -1;
  const statGuess = Math.max(1, ankle.y - ear.y);
  if (Math.abs(nose.x - ear.x) < statGuess * 0.01) facing = toe.x >= heel.x ? 1 : -1;

  const statPx = Math.max(1, (ankle.y - ear.y) / (ANTHRO.earHeight - ANTHRO.ankleHeight));
  const heightCm = opts.heightCm ?? ANTHRO.defaultHeightCm;
  const cmPerPx = heightCm / statPx;
  const plumbX = ankle.x + facing * ANTHRO.plumbAnteriorOfAnkle * statPx;
  const fwd = (p: V2) => facing * (p.x - plumbX) * cmPerPx;

  const headForward = deg(Math.atan2(facing * (ear.x - shoulder.x), Math.max(1, shoulder.y - ear.y)));
  const headForwardCm = facing * (ear.x - shoulder.x) * cmPerPx;
  const shoulderForward = facing * (shoulder.x - hip.x) * cmPerPx;
  const pelvisForward = fwd(hip);

  const kneeOff = facing * (knee.x - xAtY(hip, ankle, knee.y));
  const kneeBend = 180 - angleAt(hip, knee, ankle);
  // 무릎이 고관절-발목 선보다 뒤 → 과신전(+)
  const kneeExtension = kneeOff < 0 ? kneeBend : -kneeBend;

  const metrics: MetricResult[] = [
    grade('headForward', headForward, { cm: headForwardCm }),
    grade('shoulderForward', shoulderForward, {
      deg: deg(Math.atan2(facing * (shoulder.x - hip.x), Math.max(1, hip.y - shoulder.y))),
    }),
    grade('pelvisForward', pelvisForward),
    grade('kneeExtension', kneeExtension),
  ];

  let back: BackCurve | undefined;
  if (f.mask) {
    back = backCurve(f, { facing, statPx, shoulder, hip, side }) ?? undefined;
    if (back) {
      metrics.push(grade('kyphosis', back.kyphosis));
      metrics.push(grade('lordosis', back.lordosis));
    }
  }

  return {
    view: 'side',
    metrics,
    geo: { facing, side, ear, shoulder, hip, knee, ankle, plumbX, cmPerPx, statPx, back },
    plumbCm: { ear: fwd(ear), shoulder: fwd(shoulder), hip: fwd(hip), knee: fwd(knee) },
  };
}

// ─────────────────────────────────────────────
// 실루엣(분할 마스크) 기반 등·허리 곡선 — '가상 플렉시커브'
// ─────────────────────────────────────────────

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 윤곽선 점들 중 현(chord) a→b 에서 뒤쪽(posterior)으로 가장 멀리 튀어나온 거리(+)와 그 점 */
function chordDeviation(pts: V2[], a: V2, b: V2, posteriorX: number): { d: number; p: V2 } {
  let best = { d: -Infinity, p: a };
  for (const p of pts) {
    if (p.y < Math.min(a.y, b.y) || p.y > Math.max(a.y, b.y)) continue;
    const lineX = xAtY(a, b, p.y);
    const d = (p.x - lineX) * posteriorX;
    if (d > best.d) best = { d, p };
  }
  return best;
}

export function backCurve(
  f: PoseFrame,
  o: { facing: 1 | -1; statPx: number; shoulder: V2; hip: V2; side: 'left' | 'right' },
): BackCurve | null {
  const m = f.mask!;
  const sx = m.w / f.w, sy = m.h / f.h;
  const at = (x: number, y: number) => {
    const mx = Math.floor(x * sx), my = Math.floor(y * sy);
    if (mx < 0 || my < 0 || mx >= m.w || my >= m.h) return 0;
    return m.data[my * m.w + mx];
  };
  const H = o.statPx;
  const post = -o.facing; // 뒤쪽 방향의 x 부호

  // 팔 영역 제외(팔이 등 뒤로 겹치면 윤곽이 오염되므로)
  const arm = o.side === 'left'
    ? [LM.leftShoulder, LM.leftElbow, LM.leftWrist, LM.leftIndex]
    : [LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightIndex];
  const farArm = o.side === 'left'
    ? [LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightIndex]
    : [LM.leftShoulder, LM.leftElbow, LM.leftWrist, LM.leftIndex];
  const armSegs: [V2, V2, number][] = [];
  for (const chain of [arm, farArm]) {
    for (let i = 1; i < chain.length; i++) {
      const a = P(f, chain[i - 1]), b = P(f, chain[i]);
      if (a.v < 0.2 && b.v < 0.2) continue;
      // 어깨 관절 부위는 몸통과 겹치므로 팔꿈치 쪽부터만 제외
      const start = i === 1 ? { x: a.x + (b.x - a.x) * 0.35, y: a.y + (b.y - a.y) * 0.35 } : a;
      armSegs.push([start, b, H * (i === 1 ? 0.034 : 0.03)]);
    }
  }
  const inArm = (x: number, y: number) => armSegs.some(([a, b, r]) => segDist({ x, y }, a, b) < r);

  const y0 = o.shoulder.y - H * 0.045;
  const y1 = o.hip.y + H * 0.02;
  const step = Math.max(1, Math.round(H / 260));
  const xFar = post > 0 ? f.w - 1 : 0; // 뒤쪽 끝에서부터 몸 쪽으로 탐색
  const xNear = (o.shoulder.x + o.hip.x) / 2;
  const raw: V2[] = [];
  for (let y = y0; y <= y1; y += step) {
    let prevArm = false;
    let found: number | null = null;
    for (let x = xFar; post > 0 ? x >= xNear : x <= xNear; x -= post) {
      if (at(x, y) < 0.5) {
        prevArm = false;
        continue;
      }
      if (inArm(x, y)) {
        prevArm = true;
        continue;
      }
      if (!prevArm) found = x;
      break;
    }
    if (found !== null) raw.push({ x: found, y });
  }
  if (raw.length < 20) return null;

  // 중앙값 필터로 옷 주름·노이즈 완화
  const contour: V2[] = raw.map((p, i) => {
    const win = raw.slice(Math.max(0, i - 3), i + 4).map((q) => q.x);
    return { x: median(win), y: p.y };
  });
  const xAt = (y: number): number | null => {
    let best: V2 | null = null;
    for (const p of contour) if (!best || Math.abs(p.y - y) < Math.abs(best.y - y)) best = p;
    return best && Math.abs(best.y - y) <= step * 4 ? best.x : null;
  };

  const c7y = o.shoulder.y - H * 0.03;
  const s2y = o.hip.y - H * 0.03;
  const l1y = c7y + (s2y - c7y) * 0.6;
  const c7x = xAt(c7y), l1x = xAt(l1y), s2x = xAt(s2y);
  if (c7x === null || l1x === null || s2x === null) return null;
  const c7 = { x: c7x, y: c7y }, l1 = { x: l1x, y: l1y }, s2 = { x: s2x, y: s2y };

  const thoracic = contour.filter((p) => p.y >= c7y && p.y <= l1y);
  const lumbar = contour.filter((p) => p.y >= l1y && p.y <= s2y);
  if (thoracic.length < 6 || lumbar.length < 4) return null;
  const kyph = chordDeviation(thoracic, c7, l1, post);
  const lord = chordDeviation(lumbar, l1, s2, -post); // 허리는 앞쪽으로 오목
  const tl = dist(c7, l1), ll = dist(l1, s2);
  if (tl < 5 || ll < 5) return null;
  return {
    contour,
    c7, l1, s2,
    tApex: kyph.p,
    lApex: lord.p,
    kyphosis: Math.max(0, (kyph.d / tl) * 100),
    lordosis: Math.max(0, (lord.d / ll) * 100),
  };
}
