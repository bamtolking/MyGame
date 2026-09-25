/**
 * AI 카메라 코칭 엔진: 포즈 프레임 → 동작 지표 → 횟수 세기 / 버티기 시간
 */
import { angleAt, deg, dist, median, mid } from '../analysis/geometry';
import type { CoachMetric, CoachSpec } from '../content/exercise-types';
import { LM, type PoseFrame } from '../pose/landmarks';

const P = (f: PoseFrame, i: number) => f.pts[i];

function nearSide(f: PoseFrame): 'left' | 'right' {
  const v = (ids: number[]) => ids.reduce((s, i) => s + P(f, i).v, 0);
  return v([LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.leftAnkle]) >= v([LM.rightShoulder, LM.rightHip, LM.rightKnee, LM.rightAnkle]) ? 'left' : 'right';
}

function sidePts(f: PoseFrame) {
  const s = nearSide(f);
  const L = s === 'left';
  return {
    sh: P(f, L ? LM.leftShoulder : LM.rightShoulder),
    hip: P(f, L ? LM.leftHip : LM.rightHip),
    knee: P(f, L ? LM.leftKnee : LM.rightKnee),
    ankle: P(f, L ? LM.leftAnkle : LM.rightAnkle),
  };
}

/** 몸 크기 기준(코~발목 수직 거리) */
function stature(f: PoseFrame): number {
  const ank = Math.max(P(f, LM.leftAnkle).y, P(f, LM.rightAnkle).y);
  return Math.max(1, ank - P(f, LM.nose).y);
}

/** 해당 지표에 필요한 관절이 잘 보이는지 */
export function visibleFor(metric: CoachMetric, f: PoseFrame): boolean {
  const need: Record<CoachMetric, number[]> = {
    kneeAngle: [LM.leftHip, LM.leftKnee, LM.leftAnkle, LM.rightHip, LM.rightKnee, LM.rightAnkle],
    hipAngle: [LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.rightShoulder, LM.rightHip, LM.rightKnee],
    armRaise: [LM.leftShoulder, LM.rightShoulder, LM.leftWrist, LM.rightWrist, LM.leftElbow, LM.rightElbow],
    headTilt: [LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder],
    trunkSide: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    footLift: [LM.leftAnkle, LM.rightAnkle, LM.nose],
    chinTuck: [LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder],
    hipAbduction: [LM.leftHip, LM.rightHip, LM.leftAnkle, LM.rightAnkle],
    heelRaise: [LM.leftAnkle, LM.rightAnkle, LM.nose],
  };
  const ids = need[metric];
  // 측면 지표는 한쪽만 보여도 됨
  const good = ids.filter((i) => P(f, i).v > 0.5).length;
  return metric === 'kneeAngle' || metric === 'hipAngle' ? good >= 3 : good >= ids.length - 1;
}

export interface MetricCtx {
  baseline?: number;
}

/** 프레임에서 지표 값 계산 */
export function metricValue(metric: CoachMetric, f: PoseFrame, ctx: MetricCtx = {}): number {
  switch (metric) {
    case 'kneeAngle': {
      const s = sidePts(f);
      return angleAt(s.hip, s.knee, s.ankle);
    }
    case 'hipAngle': {
      const s = sidePts(f);
      return angleAt(s.sh, s.hip, s.knee);
    }
    case 'armRaise': {
      const one = (sh: number, el: number, wr: number) => {
        const len = dist(P(f, sh), P(f, el)) + dist(P(f, el), P(f, wr));
        return (P(f, sh).y - P(f, wr).y) / Math.max(1, len);
      };
      return (one(LM.leftShoulder, LM.leftElbow, LM.leftWrist) + one(LM.rightShoulder, LM.rightElbow, LM.rightWrist)) / 2;
    }
    case 'headTilt': {
      const l = P(f, LM.leftEar), r = P(f, LM.rightEar);
      return Math.abs(deg(Math.atan2(l.y - r.y, Math.abs(l.x - r.x) || 1e-6)));
    }
    case 'trunkSide': {
      const sm = mid(P(f, LM.leftShoulder), P(f, LM.rightShoulder));
      const hm = mid(P(f, LM.leftHip), P(f, LM.rightHip));
      return Math.abs(deg(Math.atan2(sm.x - hm.x, Math.max(1, hm.y - sm.y))));
    }
    case 'footLift':
      return Math.abs(P(f, LM.leftAnkle).y - P(f, LM.rightAnkle).y) / stature(f);
    case 'hipAbduction': {
      const one = (hip: number, ank: number) => Math.abs(deg(Math.atan2(P(f, ank).x - P(f, hip).x, Math.max(1, P(f, ank).y - P(f, hip).y))));
      return Math.max(one(LM.leftHip, LM.leftAnkle), one(LM.rightHip, LM.rightAnkle));
    }
    case 'heelRaise': {
      const y = (P(f, LM.leftAnkle).y + P(f, LM.rightAnkle).y) / 2;
      const base = ctx.baseline ?? y;
      return (base - y) / stature(f);
    }
    case 'chinTuck': {
      const ear = mid(P(f, LM.leftEar), P(f, LM.rightEar));
      const sh = mid(P(f, LM.leftShoulder), P(f, LM.rightShoulder));
      return (ear.x - sh.x) / stature(f);
    }
  }
}

/** 기준값(서 있을 때 값)이 필요한 지표 */
export const NEEDS_BASELINE: CoachMetric[] = ['heelRaise'];

// ─────────────────────────────────────────────
// 횟수 세기 · 버티기
// ─────────────────────────────────────────────

export type CoachPhase = 'lost' | 'rest' | 'moving' | 'peak';
export type Cue = 'more' | 'good' | null;

export interface CoachState {
  value: number | null;
  reps: number;
  holdSec: number;
  phase: CoachPhase;
  inPose: boolean;
  cue: Cue;
  /** 0~1: 휴식값 → 목표값 진행도 (게이지) */
  progress: number;
  /** 방금 1회가 끝났으면 true */
  repJustCounted: boolean;
}

export class Coach {
  private ema: number | null = null;
  private state: CoachPhase = 'rest';
  private reps = 0;
  private hold = 0;
  private lastT: number | null = null;
  private lastRepAt = -1e9;
  private movingSince: number | null = null;
  private peakReached = false;
  private baseSamples: number[] = [];
  private baseline: number | undefined;
  private inPose = false;
  private lostSince: number | null = null;

  constructor(private spec: CoachSpec) {}

  reset() {
    this.reps = 0;
    this.hold = 0;
    this.state = 'rest';
    this.peakReached = false;
    this.movingSince = null;
  }

  /** 숫자 값으로 직접 갱신 (테스트·다른 입력원용) */
  updateValue(raw: number | null, t: number): CoachState {
    const s = this.spec;
    const dt = this.lastT === null ? 0 : Math.min(0.5, t - this.lastT);
    this.lastT = t;
    let repJustCounted = false;
    if (raw === null || Number.isNaN(raw)) {
      if (this.lostSince === null) this.lostSince = t;
      const lostLong = t - this.lostSince > 0.6;
      return { value: this.ema, reps: this.reps, holdSec: this.hold, phase: lostLong ? 'lost' : this.state, inPose: false, cue: null, progress: 0, repJustCounted };
    }
    this.lostSince = null;
    this.ema = this.ema === null ? raw : this.ema + (raw - this.ema) * 0.4;
    const v = this.ema;
    const dir = s.dir;
    const beyond = (x: number, th: number) => (dir === 1 ? x >= th : x <= th);
    let cue: Cue = null;
    let progress = 0;
    if (s.mode === 'reps') {
      const rest = s.rest!, peak = s.peak!;
      progress = Math.max(0, Math.min(1, (v - rest) / (peak - rest)));
      if (this.state === 'rest' || this.state === 'lost') {
        // 휴식 구간을 벗어나면 동작 시작
        if (dir === 1 ? v > rest : v < rest) {
          this.state = 'moving';
          this.movingSince = t;
          this.peakReached = false;
        }
      }
      if (this.state === 'moving' || this.state === 'peak') {
        if (beyond(v, peak)) {
          this.state = 'peak';
          this.peakReached = true;
          cue = 'good';
        } else if (dir === 1 ? v <= rest : v >= rest) {
          if (this.peakReached && t - this.lastRepAt > 0.6) {
            this.reps += 1;
            this.lastRepAt = t;
            repJustCounted = true;
          }
          this.state = 'rest';
          this.movingSince = null;
        } else if (!this.peakReached && this.movingSince !== null && t - this.movingSince > 2.2) {
          cue = 'more';
        }
      }
    } else {
      const target = s.target!;
      const enter = target, exit = dir === 1 ? target * 0.85 : target * 1.15;
      if (!this.inPose && beyond(v, enter)) this.inPose = true;
      else if (this.inPose && !beyond(v, exit)) this.inPose = false;
      if (this.inPose) this.hold += dt;
      progress = Math.max(0, Math.min(1, dir === 1 ? v / target : target / Math.max(1e-6, v)));
      cue = this.inPose ? 'good' : 'more';
      this.state = this.inPose ? 'peak' : 'moving';
    }
    return { value: v, reps: this.reps, holdSec: this.hold, phase: this.state, inPose: this.inPose, cue, progress, repJustCounted };
  }

  update(f: PoseFrame | null, t: number): CoachState {
    const m = this.spec.metric;
    if (!f || !visibleFor(m, f)) return this.updateValue(null, t);
    if (NEEDS_BASELINE.includes(m) && this.baseline === undefined) {
      this.baseSamples.push((f.pts[LM.leftAnkle].y + f.pts[LM.rightAnkle].y) / 2);
      if (this.baseSamples.length >= 12) this.baseline = median(this.baseSamples);
      return this.updateValue(0, t);
    }
    return this.updateValue(metricValue(m, f, { baseline: this.baseline }), t);
  }
}
