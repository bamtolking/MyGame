/**
 * 운동 시범용 3D 인체 리그 (정운동학 FK)
 *
 * 몸 좌표계: x = 사람의 왼쪽, y = 위, z = 앞(몸 앞쪽). 키 = 100 단위.
 * 모든 각도는 도(°). 기본자세(0)는 차렷 자세로 선 모습.
 *
 * 관절 규칙
 * - 척추·목·머리 flex(+) = 앞으로 숙임, side(+) = 사람의 왼쪽으로 기울임, twist(+) = 왼쪽으로 돌림
 * - 어깨·고관절 flex(+) = 팔/다리를 앞으로 들어 올림, abd(+) = 옆으로 벌림, rot(+) = 바깥돌림,
 *   hab(+) = 수평 벌림(앞으로 든 팔을 옆으로 휘두름)
 * - 손목 wr(+) = 손이 팔꿈치 굽힘 방향으로 꺾임
 * - 팔꿈치 flex(+) = 굽힘, 무릎 flex(+) = 굽힘(정강이가 뒤로), 발목 flex(+) = 발등 굽힘(발끝이 위로)
 * - 견갑골 elev(+) = 으쓱, prot(+) = 앞으로 내밈(−는 뒤로 모음)
 * - root pitch(+) = 몸 전체가 앞으로 기울어짐(90 = 엎드림, −90 = 바로 누움),
 *   roll(+) = 왼쪽으로 기울어짐(90 = 왼쪽으로 누움), yaw(+) = 왼쪽으로 돌아섬
 */

export interface J3 {
  flex?: number;
  side?: number;
  twist?: number;
}
export interface Ball {
  flex?: number;
  abd?: number;
  rot?: number;
  /** 수평 벌림: 몸통 세로축 기준으로 팔/다리를 바깥으로 휘두름(+) */
  hab?: number;
}
export interface Scap {
  elev?: number;
  prot?: number;
}

export interface Pose {
  root?: { pitch?: number; roll?: number; yaw?: number };
  lumbar?: J3;
  thorax?: J3;
  neck?: J3;
  head?: J3;
  scapL?: Scap;
  scapR?: Scap;
  shL?: Ball;
  shR?: Ball;
  elL?: number;
  elR?: number;
  wrL?: number;
  wrR?: number;
  hipL?: Ball;
  hipR?: Ball;
  knL?: number;
  knR?: number;
  anL?: number;
  anR?: number;
}

export type V3 = [number, number, number];
type M3 = number[]; // 3x3 row-major

// ── 행렬 도우미 ───────────────────────────
const D = Math.PI / 180;
const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul(a: M3, b: M3): M3 {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function apply(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function Rx(d: number): M3 {
  const c = Math.cos(d * D), s = Math.sin(d * D);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function Ry(d: number): M3 {
  const c = Math.cos(d * D), s = Math.sin(d * D);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function Rz(d: number): M3 {
  const c = Math.cos(d * D), s = Math.sin(d * D);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** 척추류 관절: 비틀기 → 옆 기울기 → 굽힘 */
function spineRot(j: J3 | undefined): M3 {
  if (!j) return I;
  return mul(mul(Ry(j.twist ?? 0), Rz(-(j.side ?? 0))), Rx(j.flex ?? 0));
}
/** 팔(아래 방향 기본) — side: +1 왼쪽, −1 오른쪽 */
function armRot(b: Ball | undefined, side: 1 | -1): M3 {
  if (!b) return I;
  return mul(mul(mul(Ry(side * (b.hab ?? 0)), Rz(side * (b.abd ?? 0))), Rx(-(b.flex ?? 0))), Ry(side * (b.rot ?? 0)));
}
const legRot = armRot;

// ── 신체 치수 (키 100 기준) ─────────────────
export const DIM = {
  pelvisY: 53,
  hipOff: [5.6, -1.2, 0.4] as V3,
  lumbar: 11,
  thorax: 19,
  shoulderOff: [11, -3.9, -1] as V3,
  neck: 7,
  headR: 7.2,
  headCenter: 5.2,
  upperArm: 17,
  forearm: 14.5,
  hand: 7,
  thigh: 24,
  shank: 24,
  ankleH: 4,
  heelBack: 3.2,
  toeFront: 11,
};

export type JointName =
  | 'pelvis' | 'waist' | 'chest' | 'neckTop' | 'head' | 'headTop' | 'nose'
  | 'shL' | 'elL' | 'wrL' | 'haL' | 'shR' | 'elR' | 'wrR' | 'haR'
  | 'hipL' | 'knL' | 'anL' | 'heelL' | 'toeL'
  | 'hipR' | 'knR' | 'anR' | 'heelR' | 'toeR'
  | 'sitL' | 'sitR' | 'backMid' | 'backTop';

export interface Skeleton {
  p: Record<JointName, V3>;
  /** 각 몸통 구간의 좌우축(x)·앞축(z) 방향 — 몸통 폭 그리기용 */
  axes: { pelvis: M3; waist: M3; chest: M3; head: M3 };
  /** 팔다리 마디의 회전(앞쪽 = z축) — 근육 강조 위치용 */
  limbs: Record<'thighL' | 'thighR' | 'shankL' | 'shankR' | 'upperL' | 'upperR' | 'foreL' | 'foreR', M3>;
}

/** 자세 → 관절 위치 (root는 원점 기준, 이후 grounding 으로 바닥에 맞춤) */
export function solve(pose: Pose): Skeleton {
  const r = pose.root ?? {};
  const Rroot = mul(mul(Ry(r.yaw ?? 0), Rz(-(r.roll ?? 0))), Rx(r.pitch ?? 0));
  const pelvis: V3 = [0, 0, 0];

  // 척추
  const Rl = mul(Rroot, spineRot(pose.lumbar));
  const waist = add(pelvis, apply(Rl, [0, DIM.lumbar, 0]));
  const Rt = mul(Rl, spineRot(pose.thorax));
  const chest = add(waist, apply(Rt, [0, DIM.thorax, 0]));
  const Rn = mul(Rt, spineRot(pose.neck));
  const neckTop = add(chest, apply(Rn, [0, DIM.neck, 0]));
  const Rh = mul(Rn, spineRot(pose.head));
  const head = add(neckTop, apply(Rh, [0, DIM.headCenter, 0]));
  const headTop = add(head, apply(Rh, [0, DIM.headR, 0]));
  const nose = add(head, apply(Rh, [0, -0.5, DIM.headR]));

  // 팔
  const arm = (s: 1 | -1) => {
    const sc = s === 1 ? pose.scapL : pose.scapR;
    const off: V3 = [DIM.shoulderOff[0] * s, DIM.shoulderOff[1] + (sc?.elev ?? 0), DIM.shoulderOff[2] + (sc?.prot ?? 0)];
    const sh = add(chest, apply(Rt, off));
    const Ra = mul(Rt, armRot(s === 1 ? pose.shL : pose.shR, s));
    const el = add(sh, apply(Ra, [0, -DIM.upperArm, 0]));
    const Rf = mul(Ra, Rx(-((s === 1 ? pose.elL : pose.elR) ?? 0)));
    const wr = add(el, apply(Rf, [0, -DIM.forearm, 0]));
    const Rw = mul(Rf, Rx(-((s === 1 ? pose.wrL : pose.wrR) ?? 0)));
    const ha = add(wr, apply(Rw, [0, -DIM.hand, 0]));
    return { sh, el, wr, ha, Ra, Rf };
  };
  const L = arm(1), R = arm(-1);

  // 다리
  const leg = (s: 1 | -1) => {
    const hip = add(pelvis, apply(Rroot, [DIM.hipOff[0] * s, DIM.hipOff[1], DIM.hipOff[2]]));
    const Rhip = mul(Rroot, legRot(s === 1 ? pose.hipL : pose.hipR, s));
    const kn = add(hip, apply(Rhip, [0, -DIM.thigh, 0]));
    const Rk = mul(Rhip, Rx((s === 1 ? pose.knL : pose.knR) ?? 0));
    const an = add(kn, apply(Rk, [0, -DIM.shank, 0]));
    const Ra = mul(Rk, Rx(-((s === 1 ? pose.anL : pose.anR) ?? 0)));
    const heel = add(an, apply(Ra, [0, -DIM.ankleH, -DIM.heelBack]));
    const toe = add(an, apply(Ra, [0, -DIM.ankleH, DIM.toeFront]));
    // 좌골(앉을 때 닿는 점)
    const sit = add(pelvis, apply(Rroot, [DIM.hipOff[0] * s * 0.8, -6, -4]));
    return { hip, kn, an, heel, toe, sit, Rhip, Rk };
  };
  const LL = leg(1), RL = leg(-1);

  const backMid = add(waist, apply(Rt, [0, 6, -7]));
  const backTop = add(chest, apply(Rt, [0, -3, -6.5]));

  return {
    p: {
      pelvis, waist, chest, neckTop, head, headTop, nose,
      shL: L.sh, elL: L.el, wrL: L.wr, haL: L.ha,
      shR: R.sh, elR: R.el, wrR: R.wr, haR: R.ha,
      hipL: LL.hip, knL: LL.kn, anL: LL.an, heelL: LL.heel, toeL: LL.toe,
      hipR: RL.hip, knR: RL.kn, anR: RL.an, heelR: RL.heel, toeR: RL.toe,
      sitL: LL.sit, sitR: RL.sit, backMid, backTop,
    },
    axes: { pelvis: Rroot, waist: Rl, chest: Rt, head: Rh },
    limbs: { thighL: LL.Rhip, thighR: RL.Rhip, shankL: LL.Rk, shankR: RL.Rk, upperL: L.Ra, upperR: R.Ra, foreL: L.Rf, foreR: R.Rf },
  };
}

// ── 자세 보간 · 좌우 반전 ─────────────────────

type Num = number | undefined;
const lerpN = (a: Num, b: Num, t: number) => (a ?? 0) + ((b ?? 0) - (a ?? 0)) * t;

function lerpObj<T extends object>(a: T | undefined, b: T | undefined, t: number): T | undefined {
  if (!a && !b) return undefined;
  const out: any = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) out[k] = lerpN((a as any)?.[k], (b as any)?.[k], t);
  return out;
}

const OBJ_KEYS = ['root', 'lumbar', 'thorax', 'neck', 'head', 'scapL', 'scapR', 'shL', 'shR', 'hipL', 'hipR'] as const;
const NUM_KEYS = ['elL', 'elR', 'wrL', 'wrR', 'knL', 'knR', 'anL', 'anR'] as const;

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: any = {};
  for (const k of OBJ_KEYS) {
    const v = lerpObj(a[k] as object | undefined, b[k] as object | undefined, t);
    if (v) out[k] = v;
  }
  for (const k of NUM_KEYS) {
    if (a[k] !== undefined || b[k] !== undefined) out[k] = lerpN(a[k], b[k], t);
  }
  return out;
}

/** 좌우 반전 (한쪽씩 하는 운동의 반대쪽 시범) */
export function mirrorPose(p: Pose): Pose {
  const neg = (j?: J3): J3 | undefined => (j ? { flex: j.flex, side: j.side !== undefined ? -j.side : undefined, twist: j.twist !== undefined ? -j.twist : undefined } : undefined);
  const out: Pose = {
    root: p.root ? { pitch: p.root.pitch, roll: p.root.roll !== undefined ? -p.root.roll : undefined, yaw: p.root.yaw !== undefined ? -p.root.yaw : undefined } : undefined,
    lumbar: neg(p.lumbar),
    thorax: neg(p.thorax),
    neck: neg(p.neck),
    head: neg(p.head),
    scapL: p.scapR, scapR: p.scapL,
    shL: p.shR, shR: p.shL,
    elL: p.elR, elR: p.elL,
    wrL: p.wrR, wrR: p.wrL,
    hipL: p.hipR, hipR: p.hipL,
    knL: p.knR, knR: p.knL,
    anL: p.anR, anR: p.anL,
  };
  return out;
}

/** 대칭 자세 도우미: 양팔/양다리에 같은 값 */
export function both(p: { sh?: Ball; el?: number; wr?: number; hip?: Ball; kn?: number; an?: number; scap?: Scap }): Pose {
  const o: Pose = {};
  if (p.sh) o.shL = o.shR = p.sh;
  if (p.el !== undefined) o.elL = o.elR = p.el;
  if (p.wr !== undefined) o.wrL = o.wrR = p.wr;
  if (p.hip) o.hipL = o.hipR = p.hip;
  if (p.kn !== undefined) o.knL = o.knR = p.kn;
  if (p.an !== undefined) o.anL = o.anR = p.an;
  if (p.scap) o.scapL = o.scapR = p.scap;
  return o;
}
