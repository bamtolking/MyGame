import { mirrorPose, solve, lerpPose, type JointName, type Pose, type Skeleton, type V3 } from './rig';

// ─────────────────────────────────────────────
// 애니메이션 사양
// ─────────────────────────────────────────────

export type PropKind = 'floor' | 'mat' | 'wall' | 'chair' | 'roller' | 'ball' | 'band' | 'towel' | 'door';

export interface PropSpec {
  kind: PropKind;
  /** 기준 관절(공·폼롤러 위치, 수건 끝 등) */
  at?: JointName;
  to?: JointName;
  /** 추가 오프셋 (월드) */
  off?: V3;
  /** 벽 위치: 몸 뒤(back)/앞(front)/왼쪽(left)/오른쪽(right) 과 거리 */
  wall?: 'back' | 'front' | 'left' | 'right';
  dist?: number;
}

export interface AnimSpec {
  /** 카메라 방향: 0 정면, 90 오른쪽 측면(사람이 화면 오른쪽을 봄), 30~45 비스듬히 */
  view: number;
  /** 카메라 높이각(내려다보는 각도) */
  elev?: number;
  keys: Pose[];
  /** 각 구간 시간(초). keys.length 개(마지막 → 처음 복귀 포함) */
  durations?: number[];
  /** 키 사이 정지 시간(초) */
  pauses?: number[];
  props?: PropSpec[];
  /** 두 접촉점 높이를 맞추도록 root pitch/roll 을 자동 보정 */
  level?: { a: JointName[]; b: JointName[]; axis?: 'pitch' | 'roll' };
  /** 프레임 사이 고정할 기준점 */
  anchor?: JointName[];
  /** 화면 확대 배율 보정 */
  zoom?: number;
}

// ─────────────────────────────────────────────
// 배치 (바닥 맞추기 · 기준점 고정 · 수평 맞추기)
// ─────────────────────────────────────────────

const RADIUS = new Map<JointName, number>();
/** 바닥에 닿을 수 있는 점과 그 두께(반지름) */
const CONTACTS: [JointName, number][] = [
  ['heelL', 1.2], ['heelR', 1.2], ['toeL', 1.2], ['toeR', 1.2],
  ['knL', 4.2], ['knR', 4.2], ['haL', 1.5], ['haR', 1.5], ['elL', 3], ['elR', 3],
  ['sitL', 1], ['sitR', 1], ['backMid', 1], ['backTop', 1], ['head', 7.2], ['pelvis', 7.5],
  ['hipL', 5], ['hipR', 5], ['shL', 5], ['shR', 5], ['anL', 3], ['anR', 3], ['wrL', 2], ['wrR', 2],
];
for (const [n, r] of CONTACTS) RADIUS.set(n, r);

function yOf(sk: Skeleton, names: JointName[]): number {
  return names.reduce((s, n) => s + sk.p[n][1] - (RADIUS.get(n) ?? 0), 0) / names.length;
}

function withRoot(pose: Pose, axis: 'pitch' | 'roll', delta: number): Pose {
  const root = { ...(pose.root ?? {}) };
  root[axis] = (root[axis] ?? 0) + delta;
  return { ...pose, root };
}

/** a·b 접촉점의 높이가 같아지도록 root 각도를 보정 (0°에 가장 가까운 해) */
export function levelPose(pose: Pose, spec: NonNullable<AnimSpec['level']>): Pose {
  const axis = spec.axis ?? 'pitch';
  const f = (d: number) => {
    const sk = solve(withRoot(pose, axis, d));
    return yOf(sk, spec.a) - yOf(sk, spec.b);
  };
  const f0 = f(0);
  if (Math.abs(f0) < 0.01) return pose;
  let best: number | null = null;
  const STEP = 2.5, LIM = 50;
  for (let k = STEP; k <= LIM && best === null; k += STEP) {
    for (const [lo, hi] of [[k - STEP, k], [-k, -(k - STEP)]] as [number, number][]) {
      let flo = f(lo), fhi = f(hi);
      if (flo === 0) { best = lo; break; }
      if (flo * fhi > 0) continue;
      let a = lo, b = hi;
      for (let i = 0; i < 30; i++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (flo * fm <= 0) { b = m; fhi = fm; } else { a = m; flo = fm; }
      }
      best = (a + b) / 2;
      break;
    }
  }
  return best === null ? pose : withRoot(pose, axis, best);
}

export interface Placed {
  sk: Skeleton;
  pose: Pose;
}

/** 바닥(y=0)에 붙이고 기준점을 원점에 고정 */
export function place(pose: Pose, spec: Pick<AnimSpec, 'level' | 'anchor'>): Placed {
  const p = spec.level ? levelPose(pose, spec.level) : pose;
  const sk = solve(p);
  let minY = Infinity;
  for (const [n, r] of CONTACTS) minY = Math.min(minY, sk.p[n][1] - r);
  const anchor = spec.anchor ?? ['heelL', 'heelR', 'toeL', 'toeR'];
  const ax = anchor.reduce((s, n) => s + sk.p[n][0], 0) / anchor.length;
  const az = anchor.reduce((s, n) => s + sk.p[n][2], 0) / anchor.length;
  for (const k of Object.keys(sk.p) as JointName[]) {
    const v = sk.p[k];
    sk.p[k] = [v[0] - ax, v[1] - minY, v[2] - az];
  }
  return { sk, pose: p };
}

// ─────────────────────────────────────────────
// 시간 → 자세
// ─────────────────────────────────────────────

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/** 한 사이클 길이(초) */
export function cycleLength(spec: AnimSpec): number {
  const n = spec.keys.length;
  if (n < 2) return 1;
  let total = 0;
  for (let i = 0; i < n; i++) total += (spec.durations?.[i] ?? 1.2) + (spec.pauses?.[i] ?? 0);
  return total;
}

/** 시각 t(초)의 자세. keys 를 순환(마지막 → 처음) */
export function poseAt(spec: AnimSpec, t: number, mirror = false): Pose {
  const n = spec.keys.length;
  let pose: Pose;
  if (n === 1) pose = spec.keys[0];
  else {
    const len = cycleLength(spec);
    let x = ((t % len) + len) % len;
    pose = spec.keys[0];
    for (let i = 0; i < n; i++) {
      const pause = spec.pauses?.[i] ?? 0;
      if (x < pause) {
        pose = spec.keys[i];
        break;
      }
      x -= pause;
      const d = spec.durations?.[i] ?? 1.2;
      if (x < d) {
        pose = lerpPose(spec.keys[i], spec.keys[(i + 1) % n], ease(x / d));
        break;
      }
      x -= d;
    }
  }
  return mirror ? mirrorPose(pose) : pose;
}

// ─────────────────────────────────────────────
// 투영
// ─────────────────────────────────────────────

export interface Cam {
  yaw: number;
  elev: number;
}

export interface Proj {
  x: number;
  y: number;
  d: number;
}

export function project(v: V3, cam: Cam): Proj {
  const a = (cam.yaw * Math.PI) / 180, e = (cam.elev * Math.PI) / 180;
  const r: V3 = [Math.cos(a), 0, Math.sin(a)];
  const c: V3 = [-Math.sin(a), 0, Math.cos(a)];
  const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const depth = dot(v, c);
  const up = v[1] * Math.cos(e) - depth * Math.sin(e);
  const d = depth * Math.cos(e) + v[1] * Math.sin(e);
  return { x: dot(v, r), y: up, d };
}

// ─────────────────────────────────────────────
// 그리기
// ─────────────────────────────────────────────

export interface Palette {
  skin: string;
  skinFar: string;
  shirt: string;
  shirtFar: string;
  shorts: string;
  shortsFar: string;
  shoe: string;
  hair: string;
  eye: string;
  floor: string;
  mat: string;
  wall: string;
  wallLine: string;
  prop: string;
  propDark: string;
  band: string;
  shadow: string;
}

export const LIGHT: Palette = {
  skin: '#f5c9a6',
  skinFar: '#dfae88',
  shirt: '#ff6b2c',
  shirtFar: '#d9531a',
  shorts: '#2f3b57',
  shortsFar: '#232c42',
  shoe: '#3a3d45',
  hair: '#3b2a20',
  eye: '#2b2118',
  floor: '#d7dbe0',
  mat: '#dfe8f2',
  wall: '#eceff3',
  wallLine: '#d3d8de',
  prop: '#c9a37a',
  propDark: '#9d7a55',
  band: '#12b76a',
  shadow: 'rgba(20,30,50,0.10)',
};

export const DARK: Palette = {
  ...LIGHT,
  floor: '#3a3f48',
  mat: '#2a3340',
  wall: '#23272e',
  wallLine: '#343a43',
  prop: '#8a6a48',
  propDark: '#6b5036',
  shadow: 'rgba(0,0,0,0.35)',
};

interface Frame {
  pts: Record<JointName, Proj>;
  sk: Skeleton;
}

export interface Viewport {
  scale: number;
  ox: number;
  oy: number;
}

/** 여러 프레임의 화면 좌표 범위 */
export function boundsOf(frames: Placed[], cam: Cam, props: PropSpec[] = []): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const addPt = (v: V3, pad = 0) => {
    const p = project(v, cam);
    minX = Math.min(minX, p.x - pad);
    maxX = Math.max(maxX, p.x + pad);
    minY = Math.min(minY, p.y - pad);
    maxY = Math.max(maxY, p.y + pad);
  };
  for (const f of frames) {
    for (const k of Object.keys(f.sk.p) as JointName[]) addPt(f.sk.p[k], k === 'head' ? 8 : 5);
  }
  addPt([0, 0, 0]);
  if (props.some((p) => p.kind === 'chair')) {
    const s = frames[0].sk.p;
    addPt([0, s.sitL[1] + 44, (s.sitL[2] + s.sitR[2]) / 2 - 20]);
  }
  return { minX, maxX, minY, maxY };
}

export function fitViewport(b: ReturnType<typeof boundsOf>, w: number, h: number, pad = 0.08, zoom = 1): Viewport {
  const bw = Math.max(20, b.maxX - b.minX), bh = Math.max(20, b.maxY - b.minY);
  const scale = Math.min((w * (1 - pad * 2)) / bw, (h * (1 - pad * 2)) / bh) * zoom;
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return { scale, ox: w / 2 - cx * scale, oy: h / 2 + cy * scale };
}

type Draw = { d: number; fn: (g: CanvasRenderingContext2D) => void };

export function drawScene(g: CanvasRenderingContext2D, placed: Placed, cam: Cam, vp: Viewport, spec: AnimSpec, pal: Palette, chairSk?: Skeleton) {
  const { sk } = placed;
  const P = (v: V3) => {
    const p = project(v, cam);
    return { x: vp.ox + p.x * vp.scale, y: vp.oy - p.y * vp.scale, d: p.d };
  };
  const pts = {} as Record<JointName, Proj>;
  for (const k of Object.keys(sk.p) as JointName[]) pts[k] = P(sk.p[k]);
  const S = vp.scale;
  const props = spec.props ?? [];
  const frame: Frame = { pts, sk };

  // ── 배경 소품 ──
  drawFloor(g, P, S, pal, props, sk);
  for (const pr of props) {
    if (pr.kind === 'wall' || pr.kind === 'door') drawWall(g, P, pal, pr, sk);
    if (pr.kind === 'chair') drawChair(g, P, S, pal, chairSk ?? sk, cam);
  }

  // ── 몸 ──
  const list: Draw[] = [];
  const torsoD = (pts.pelvis.d + pts.chest.d) / 2;
  const far = (d: number) => d < torsoD - 2.5;
  const limb = (a: JointName, b: JointName, w: number, near: string, farC: string) => {
    const d = (pts[a].d + pts[b].d) / 2;
    list.push({
      d,
      fn: (c) => capsule(c, pts[a], pts[b], w * S, far(d) ? farC : near),
    });
  };
  const legSide = (s: 'L' | 'R') => {
    const hip = `hip${s}` as JointName, kn = `kn${s}` as JointName, an = `an${s}` as JointName;
    const heel = `heel${s}` as JointName, toe = `toe${s}` as JointName;
    const d = (pts[hip].d + pts[kn].d + pts[an].d) / 3;
    const isFar = far(d);
    list.push({
      d: d - 0.01,
      fn: (c) => {
        const midThigh = mix(pts[hip], pts[kn], 0.42);
        capsule(c, pts[kn], pts[an], 7.2 * S, isFar ? pal.skinFar : pal.skin);
        capsule(c, midThigh, pts[kn], 8.6 * S, isFar ? pal.skinFar : pal.skin);
        capsule(c, pts[hip], midThigh, 10.2 * S, isFar ? pal.shortsFar : pal.shorts);
        foot(c, pts[heel], pts[toe], pts[an], S, pal.shoe);
      },
    });
  };
  const armSide = (s: 'L' | 'R') => {
    const sh = `sh${s}` as JointName, el = `el${s}` as JointName, wr = `wr${s}` as JointName, ha = `ha${s}` as JointName;
    const d = (pts[sh].d + pts[el].d + pts[wr].d) / 3;
    const isFar = far(d);
    list.push({
      d,
      fn: (c) => {
        const midUpper = mix(pts[sh], pts[el], 0.55);
        capsule(c, pts[el], pts[wr], 5.4 * S, isFar ? pal.skinFar : pal.skin);
        capsule(c, midUpper, pts[el], 5.9 * S, isFar ? pal.skinFar : pal.skin);
        capsule(c, pts[sh], midUpper, 7.2 * S, isFar ? pal.shirtFar : pal.shirt);
        capsule(c, pts[wr], mix(pts[wr], pts[ha], 0.7), 4.6 * S, isFar ? pal.skinFar : pal.skin);
      },
    });
  };
  legSide('L');
  legSide('R');
  armSide('L');
  armSide('R');
  list.push({ d: torsoD, fn: (c) => drawTorso(c, frame, cam, vp, pal) });
  list.push({
    d: pts.head.d + 0.5,
    fn: (c) => drawHead(c, frame, cam, vp, pal),
  });
  // 밴드·수건은 몸 앞쪽에
  for (const pr of props) {
    if ((pr.kind === 'band' || pr.kind === 'towel') && pr.at && pr.to) {
      const a = pts[pr.at], b = pts[pr.to];
      list.push({
        d: Math.max(a.d, b.d) + 0.2,
        fn: (c) => {
          c.strokeStyle = pr.kind === 'band' ? pal.band : pal.prop;
          c.lineWidth = (pr.kind === 'band' ? 1.6 : 2.4) * S;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
          c.stroke();
        },
      });
    }
    if ((pr.kind === 'ball' || pr.kind === 'roller') && pr.at) {
      const base = sk.p[pr.at];
      const o = pr.off ?? [0, 0, 0];
      const center = P([base[0] + o[0], base[1] + o[1], base[2] + o[2]]);
      list.push({
        d: center.d - (pr.kind === 'roller' ? 30 : 0),
        fn: (c) => (pr.kind === 'ball' ? drawBall(c, center, S, pal) : drawRoller(c, P, [base[0] + o[0], base[1] + o[1], base[2] + o[2]], S, pal, cam)),
      });
    }
  }
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.fn(g);
}

function mix(a: Proj, b: Proj, t: number): Proj {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, d: a.d + (b.d - a.d) * t };
}

function capsule(g: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, w: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x + 0.01, b.y + 0.01);
  g.stroke();
}

function foot(g: CanvasRenderingContext2D, heel: Proj, toe: Proj, ankle: Proj, S: number, color: string) {
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 3.4 * S;
  g.beginPath();
  g.moveTo(heel.x, heel.y);
  g.lineTo(toe.x, toe.y);
  g.lineTo(mix(ankle, toe, 0.35).x, mix(ankle, toe, 0.35).y);
  g.lineTo(ankle.x, ankle.y);
  g.closePath();
  g.fill();
  g.stroke();
}

function drawTorso(g: CanvasRenderingContext2D, f: Frame, cam: Cam, vp: Viewport, pal: Palette) {
  const { sk, pts } = f;
  const S = vp.scale;
  const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const proj = (v: V3) => {
    const p = project(v, cam);
    return { x: vp.ox + p.x * S, y: vp.oy - p.y * S };
  };
  // 척추 단면: [위치, 좌우 반폭, 앞뒤 반두께, 축 행렬]
  const sec: [V3, number, number, number[]][] = [
    [lerp3(sk.p.pelvis, sk.p.waist, -0.35), 9.6, 6.8, sk.axes.pelvis],
    [lerp3(sk.p.pelvis, sk.p.waist, 0.4), 9.0, 6.4, sk.axes.pelvis],
    [sk.p.waist, 8.6, 6.3, sk.axes.waist],
    [lerp3(sk.p.waist, sk.p.chest, 0.55), 10.4, 7.8, sk.axes.chest],
    [lerp3(sk.p.waist, sk.p.chest, 0.94), 11.4, 5.8, sk.axes.chest],
  ];
  const a = (cam.yaw * Math.PI) / 180, e = (cam.elev * Math.PI) / 180;
  const r: V3 = [Math.cos(a), 0, Math.sin(a)];
  const c: V3 = [-Math.sin(a), 0, Math.cos(a)];
  const toScreenDir = (v: V3) => {
    const dep = v[0] * c[0] + v[2] * c[2];
    return { x: v[0] * r[0] + v[2] * r[2], y: -(v[1] * Math.cos(e) - dep * Math.sin(e)) };
  };
  const centers = sec.map(([p]) => proj(p));
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < sec.length; i++) {
    const [, X, Z, M] = sec[i];
    const prev = centers[Math.max(0, i - 1)], next = centers[Math.min(sec.length - 1, i + 1)];
    let sx = next.x - prev.x, sy = next.y - prev.y;
    const l = Math.hypot(sx, sy) || 1;
    sx /= l;
    sy /= l;
    const nx = -sy, ny = sx;
    const ax = toScreenDir([M[0], M[3], M[6]]);
    const az = toScreenDir([M[2], M[5], M[8]]);
    const w = Math.sqrt((X * (ax.x * nx + ax.y * ny)) ** 2 + (Z * (az.x * nx + az.y * ny)) ** 2) * S;
    left.push({ x: centers[i].x + nx * w, y: centers[i].y + ny * w });
    right.push({ x: centers[i].x - nx * w, y: centers[i].y - ny * w });
  }
  const pathOf = (from: number, to: number) => {
    g.beginPath();
    g.moveTo(left[from].x, left[from].y);
    for (let i = from + 1; i <= to; i++) {
      const pm = { x: (left[i - 1].x + left[i].x) / 2, y: (left[i - 1].y + left[i].y) / 2 };
      g.quadraticCurveTo(left[i - 1].x, left[i - 1].y, pm.x, pm.y);
    }
    g.lineTo(left[to].x, left[to].y);
    const topC = centers[to];
    g.quadraticCurveTo(topC.x + (topC.x - centers[to - 1].x) * 0.35, topC.y + (topC.y - centers[to - 1].y) * 0.35, right[to].x, right[to].y);
    for (let i = to - 1; i >= from; i--) {
      const pm = { x: (right[i + 1].x + right[i].x) / 2, y: (right[i + 1].y + right[i].y) / 2 };
      g.quadraticCurveTo(right[i + 1].x, right[i + 1].y, pm.x, pm.y);
    }
    g.lineTo(right[from].x, right[from].y);
    const botC = centers[from];
    g.quadraticCurveTo(botC.x - (centers[from + 1].x - botC.x) * 0.45, botC.y - (centers[from + 1].y - botC.y) * 0.45, left[from].x, left[from].y);
    g.closePath();
  };
  // 목
  capsule(g, pts.chest, pts.neckTop, 5.4 * S, pal.skin);
  // 하의 → 상의 순서(상의가 허리선을 덮음)
  g.fillStyle = pal.shorts;
  pathOf(0, 1);
  g.fill();
  g.fillStyle = pal.shirt;
  pathOf(1, 4);
  g.fill();
  // 어깨 둥글게
  for (const s of ['shL', 'shR'] as const) {
    g.beginPath();
    g.arc(pts[s].x, pts[s].y, 3.9 * S, 0, Math.PI * 2);
    g.fillStyle = pts[s].d < pts.chest.d - 2.5 ? pal.shirtFar : pal.shirt;
    g.fill();
  }
}

function drawHead(g: CanvasRenderingContext2D, f: Frame, cam: Cam, vp: Viewport, pal: Palette) {
  const { sk, pts } = f;
  const S = vp.scale;
  const R = 7.2 * S;
  const h = pts.head;
  // 머리카락(뒤통수) + 얼굴
  const M = sk.axes.head;
  const fwd: V3 = [M[2], M[5], M[8]];
  const upv: V3 = [M[1], M[4], M[7]];
  const fp = project(fwd, cam);
  const up = project(upv, cam);
  g.fillStyle = pal.hair;
  g.beginPath();
  g.arc(h.x, h.y, R, 0, Math.PI * 2);
  g.fill();
  const facing = fp.d; // 카메라 쪽을 보면 +
  const faceShift = 0.32 * R;
  const fx = h.x + fp.x * faceShift - up.x * 0.1 * R;
  const fy = h.y - fp.y * faceShift + up.y * 0.1 * R;
  g.save();
  g.beginPath();
  g.arc(h.x, h.y, R, 0, Math.PI * 2);
  g.clip();
  if (facing > -0.55) {
    g.fillStyle = pal.skin;
    g.beginPath();
    g.ellipse(fx, fy + up.y * 0.12 * R, R * (0.78 + 0.1 * Math.max(0, facing)), R * 0.84, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 머리 윗부분 머리카락 띠
  g.fillStyle = pal.hair;
  g.beginPath();
  const tx = h.x + up.x * R * 0.95, ty = h.y - up.y * R * 0.95;
  g.ellipse(tx, ty, R * 1.05, R * 0.42, Math.atan2(-up.x, -up.y) * -1, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // 눈 (3D 위치를 투영, 앞쪽 반구만)
  const eyes: V3[] = [
    [2.5, 0.6, 6.3],
    [-2.5, 0.6, 6.3],
  ];
  for (const e of eyes) {
    const w: V3 = [
      sk.p.head[0] + M[0] * e[0] + M[1] * e[1] + M[2] * e[2],
      sk.p.head[1] + M[3] * e[0] + M[4] * e[1] + M[5] * e[2],
      sk.p.head[2] + M[6] * e[0] + M[7] * e[1] + M[8] * e[2],
    ];
    const p = project(w, cam);
    const hp = project(sk.p.head, cam);
    if (p.d > hp.d + 1.2) {
      g.fillStyle = pal.eye;
      g.beginPath();
      g.arc(vp.ox + p.x * S, vp.oy - p.y * S, 0.95 * S, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawFloor(g: CanvasRenderingContext2D, P: (v: V3) => { x: number; y: number; d: number }, S: number, pal: Palette, props: PropSpec[], sk: Skeleton) {
  const xs = Object.values(sk.p).map((v) => v[0]);
  const zs = Object.values(sk.p).map((v) => v[2]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const hasMat = props.some((p) => p.kind === 'mat');
  if (hasMat) {
    const hw = Math.max(18, (Math.max(...xs) - Math.min(...xs)) / 2 + 12);
    const hd = Math.max(18, (Math.max(...zs) - Math.min(...zs)) / 2 + 12);
    const c = [P([cx - hw, 0, cz - hd]), P([cx + hw, 0, cz - hd]), P([cx + hw, 0, cz + hd]), P([cx - hw, 0, cz + hd])];
    g.fillStyle = pal.mat;
    g.beginPath();
    g.moveTo(c[0].x, c[0].y);
    for (const p of c.slice(1)) g.lineTo(p.x, p.y);
    g.closePath();
    g.fill();
    g.strokeStyle = pal.floor;
    g.lineWidth = 1.2 * S;
    g.stroke();
  }
  // 그림자
  const s0 = P([cx, 0, cz]);
  const spanX = Math.abs(P([Math.max(...xs), 0, cz]).x - P([Math.min(...xs), 0, cz]).x);
  const spanZ = Math.abs(P([cx, 0, Math.max(...zs)]).x - P([cx, 0, Math.min(...zs)]).x);
  g.fillStyle = pal.shadow;
  g.beginPath();
  g.ellipse(s0.x, s0.y, Math.max(spanX, spanZ) * 0.55 + 6 * S, 3.2 * S, 0, 0, Math.PI * 2);
  g.fill();
  // 바닥선
  g.strokeStyle = pal.floor;
  g.lineWidth = 1.4 * S;
  g.beginPath();
  g.moveTo(-10000, s0.y);
  g.lineTo(10000, s0.y);
  g.stroke();
}

function drawWall(g: CanvasRenderingContext2D, P: (v: V3) => { x: number; y: number; d: number }, pal: Palette, pr: PropSpec, sk: Skeleton) {
  const dist = pr.dist ?? 0;
  const zs = Object.values(sk.p).map((v) => v[2]);
  const xs = Object.values(sk.p).map((v) => v[0]);
  let quad: V3[];
  const H = 130;
  switch (pr.wall ?? 'back') {
    case 'front': {
      const z = Math.max(...zs) + dist;
      quad = [[-80, 0, z], [80, 0, z], [80, H, z], [-80, H, z]];
      break;
    }
    case 'left': {
      const x = Math.max(...xs) + dist;
      quad = [[x, 0, -80], [x, 0, 80], [x, H, 80], [x, H, -80]];
      break;
    }
    case 'right': {
      const x = Math.min(...xs) - dist;
      quad = [[x, 0, -80], [x, 0, 80], [x, H, 80], [x, H, -80]];
      break;
    }
    default: {
      const z = Math.min(...zs) - 2 - dist;
      quad = [[-80, 0, z], [80, 0, z], [80, H, z], [-80, H, z]];
    }
  }
  const c = quad.map(P);
  // 옆에서 보면 선으로 보이므로 최소 두께 보장
  g.fillStyle = pal.wall;
  g.strokeStyle = pal.wallLine;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(c[0].x, c[0].y);
  for (const p of c.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.fill();
  g.stroke();
}

function drawChair(g: CanvasRenderingContext2D, P: (v: V3) => { x: number; y: number; d: number }, S: number, pal: Palette, sk: Skeleton, cam: Cam) {
  const seatY = (sk.p.sitL[1] + sk.p.sitR[1]) / 2 - 1;
  const cz = (sk.p.sitL[2] + sk.p.sitR[2]) / 2 + 3;
  const cx = (sk.p.sitL[0] + sk.p.sitR[0]) / 2;
  const hw = 19, front = cz + 14, back = cz - 22;
  const poly = (pts: V3[], fill: string) => {
    const c = pts.map(P);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(c[0].x, c[0].y);
    for (const p of c.slice(1)) g.lineTo(p.x, p.y);
    g.closePath();
    g.fill();
  };
  const leg = (x: number, z: number) => {
    const a = P([x, seatY, z]), b = P([x, 0, z]);
    capsule(g, a, b, 2.6 * S, pal.propDark);
  };
  leg(cx - hw + 2, back + 2);
  leg(cx + hw - 2, back + 2);
  leg(cx - hw + 2, front - 2);
  leg(cx + hw - 2, front - 2);
  // 등받이
  poly([[cx - hw, seatY, back], [cx + hw, seatY, back], [cx + hw, seatY + 40, back - 3], [cx - hw, seatY + 40, back - 3]], pal.propDark);
  const bt = P([cx - hw, seatY + 40, back - 3]), bt2 = P([cx + hw, seatY + 40, back - 3]);
  if (Math.abs(bt.x - bt2.x) < 3 * S) capsule(g, P([cx, seatY, back]), P([cx, seatY + 40, back - 3]), 3.2 * S, pal.propDark);
  // 좌판 (윗면 + 앞면 두께)
  poly([[cx - hw, seatY, back], [cx + hw, seatY, back], [cx + hw, seatY, front], [cx - hw, seatY, front]], pal.prop);
  const fr = [P([cx - hw, seatY, front]), P([cx + hw, seatY, front]), P([cx + hw, seatY - 3.5, front]), P([cx - hw, seatY - 3.5, front])];
  const sideView = Math.abs(Math.sin((cam.yaw * Math.PI) / 180)) > 0.7;
  if (sideView) capsule(g, P([cx, seatY - 1.6, back]), P([cx, seatY - 1.6, front]), 3.6 * S, pal.prop);
  else {
    g.fillStyle = pal.propDark;
    g.beginPath();
    g.moveTo(fr[0].x, fr[0].y);
    for (const p of fr.slice(1)) g.lineTo(p.x, p.y);
    g.closePath();
    g.fill();
  }
}

function drawBall(g: CanvasRenderingContext2D, c: { x: number; y: number }, S: number, pal: Palette) {
  g.fillStyle = pal.band;
  g.beginPath();
  g.arc(c.x, c.y, 3.4 * S, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.arc(c.x - 1.1 * S, c.y - 1.1 * S, 1.1 * S, 0, Math.PI * 2);
  g.fill();
}

function drawRoller(g: CanvasRenderingContext2D, P: (v: V3) => { x: number; y: number; d: number }, c: V3, S: number, pal: Palette, cam: Cam) {
  const r = 7;
  const a = P([c[0] - 22, c[1], c[2]]), b = P([c[0] + 22, c[1], c[2]]);
  const sideView = Math.abs(Math.sin((cam.yaw * Math.PI) / 180)) > 0.8;
  if (sideView) {
    const m = P(c);
    g.fillStyle = '#6aa9e8';
    g.beginPath();
    g.arc(m.x, m.y, r * S, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9cc8f2';
    g.beginPath();
    g.arc(m.x, m.y, r * 0.45 * S, 0, Math.PI * 2);
    g.fill();
  } else capsule(g, a, b, r * 2 * S, '#6aa9e8');
}

// ─────────────────────────────────────────────
// 편의: 한 장면 준비 (전체 프레임 범위 → 뷰포트)
// ─────────────────────────────────────────────

export interface Prepared {
  spec: AnimSpec;
  cam: Cam;
  vp: Viewport;
  mirror: boolean;
  /** 의자는 첫 자세 기준으로 고정 (앉았다 일어서기 등) */
  chairSk?: Skeleton;
}

export function prepare(spec: AnimSpec, w: number, h: number, mirror = false): Prepared {
  const cam = { yaw: spec.view, elev: spec.elev ?? 8 };
  const len = cycleLength(spec);
  const frames: Placed[] = [];
  const N = Math.max(8, spec.keys.length * 6);
  for (let i = 0; i < N; i++) frames.push(place(poseAt(spec, (i / N) * len, mirror), spec));
  const b = boundsOf(frames, cam, spec.props);
  const vp = fitViewport(b, w, h, 0.08, spec.zoom ?? 1);
  const chairSk = spec.props?.some((p) => p.kind === 'chair') ? frames[0].sk : undefined;
  return { spec, cam, vp, mirror, chairSk };
}

export function renderAt(g: CanvasRenderingContext2D, prep: Prepared, t: number, pal: Palette) {
  const placed = place(poseAt(prep.spec, t, prep.mirror), prep.spec);
  drawScene(g, placed, prep.cam, prep.vp, prep.spec, pal, prep.chairSk);
}
