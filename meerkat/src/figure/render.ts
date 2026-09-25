import { DIM, mirrorPose, solve, lerpPose, type JointName, type Pose, type Skeleton, type V3 } from './rig';
import { drawArm, drawHead, drawLeg, drawNeck, drawTorso, type Palette, type TorsoShape } from './paint';

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

export { LIGHT, DARK, type Palette } from './paint';

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
    for (const k of Object.keys(f.sk.p) as JointName[]) addPt(f.sk.p[k], k === 'head' ? 9 : 5.5);
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

/** 카메라 쪽을 향하는 월드 방향 */
function toCamera(cam: Cam): V3 {
  const a = (cam.yaw * Math.PI) / 180, e = (cam.elev * Math.PI) / 180;
  return [-Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}

export function drawScene(g: CanvasRenderingContext2D, placed: Placed, cam: Cam, vp: Viewport, spec: AnimSpec, pal: Palette, chairSk?: Skeleton) {
  const { sk, pose } = placed;
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
  drawFloor(g, P, S, pal, props, sk, cam);
  for (const pr of props) {
    if (pr.kind === 'wall' || pr.kind === 'door') drawWall(g, P, S, pal, pr, sk, cam);
    if (pr.kind === 'chair') drawChair(g, P, S, pal, chairSk ?? sk, cam);
  }

  // ── 몸 ──
  const list: Draw[] = [];
  const torsoD = (pts.pelvis.d + pts.chest.d) / 2;
  // 먼 쪽 팔다리(어둡게) 판정은 카메라 높이각을 뺀 수평 깊이로
  const yaw = (cam.yaw * Math.PI) / 180;
  const hdep = (n: JointName) => -Math.sin(yaw) * sk.p[n][0] + Math.cos(yaw) * sk.p[n][2];
  const torsoH = (hdep('pelvis') + hdep('chest')) / 2;
  const far = (names: JointName[]) => names.reduce((a, n) => a + hdep(n), 0) / names.length < torsoH - 2.5;
  const legSide = (s: 'L' | 'R') => {
    const hip = pts[`hip${s}`], kn = pts[`kn${s}`], an = pts[`an${s}`];
    const d = (hip.d + kn.d + an.d) / 3;
    const bend = (s === 'L' ? pose.knL : pose.knR) ?? 0;
    const isFar = far([`hip${s}`, `kn${s}`, `an${s}`]);
    list.push({
      d: d - 0.6,
      fn: (c) => drawLeg(c, { hip, kn, an, heel: pts[`heel${s}`], toe: pts[`toe${s}`], far: isFar, fold: bend > 62 }, S, pal),
    });
  };
  const T = torsoShape(frame, cam, vp);
  const armSide = (s: 'L' | 'R') => {
    const sh = pts[`sh${s}`], el = pts[`el${s}`], wr = pts[`wr${s}`], ha = pts[`ha${s}`];
    const d = (sh.d + el.d + wr.d) / 3;
    const bend = (s === 'L' ? pose.elL : pose.elR) ?? 0;
    const isFar = far([`sh${s}`, `el${s}`, `wr${s}`]);
    // 어깨가 몸통 옆선에 있을 때(정면 등)는 소매와 몸통 사이 이음선을 숨김
    const beside = !isFar && Math.abs(hdep(`sh${s}`) - hdep('chest')) < 4 && hdep(`wr${s}`) > hdep('chest') - 3;
    list.push({
      d: beside ? Math.max(d, torsoD + 0.05) : d,
      fn: (c) => drawArm(c, { sh, el, wr, ha, far: isFar, fold: bend > 62, torso: beside ? T : undefined }, S, pal),
    });
  };
  legSide('L');
  legSide('R');
  armSide('L');
  armSide('R');
  list.push({
    d: torsoD,
    fn: (c) => {
      drawNeck(c, pts.chest, pts.neckTop, S, pal);
      drawTorso(c, T, S, pal);
    },
  });
  list.push({
    d: pts.head.d + 0.5,
    fn: (c) => drawHead(c, { c: sk.p.head, M: sk.axes.head, P, toCam: toCamera(cam), R: DIM.headR }, S, pal),
  });
  // 밴드·수건은 몸 앞쪽에
  for (const pr of props) {
    if ((pr.kind === 'band' || pr.kind === 'towel') && pr.at && pr.to) {
      const a = pts[pr.at], b = pts[pr.to];
      list.push({
        d: Math.max(a.d, b.d) + 0.2,
        fn: (c) => {
          const col = pr.kind === 'band' ? pal.band : pal.seat.f;
          c.lineCap = 'round';
          c.strokeStyle = 'rgba(0,0,0,0.18)';
          c.lineWidth = (pr.kind === 'band' ? 2.2 : 3.2) * S;
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
          c.stroke();
          c.strokeStyle = col;
          c.lineWidth = (pr.kind === 'band' ? 1.5 : 2.5) * S;
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

/** 척추 단면을 이어 몸통 윤곽 만들기 */
function torsoShape(f: Frame, cam: Cam, vp: Viewport): TorsoShape {
  const { sk } = f;
  const S = vp.scale;
  const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const proj = (v: V3) => {
    const p = project(v, cam);
    return { x: vp.ox + p.x * S, y: vp.oy - p.y * S };
  };
  // 척추 단면: [위치, 좌우 반폭, 앞뒤 반두께, 축 행렬]
  const sec: [V3, number, number, number[]][] = [
    [lerp3(sk.p.pelvis, sk.p.waist, -0.38), 9.5, 6.9, sk.axes.pelvis],
    [lerp3(sk.p.pelvis, sk.p.waist, 0.1), 9.3, 6.6, sk.axes.pelvis],
    [lerp3(sk.p.pelvis, sk.p.waist, 0.48), 8.9, 6.3, sk.axes.pelvis],
    [sk.p.waist, 8.5, 6.2, sk.axes.waist],
    [lerp3(sk.p.waist, sk.p.chest, 0.5), 9.9, 7.5, sk.axes.chest],
    [lerp3(sk.p.waist, sk.p.chest, 0.82), 10.8, 6.9, sk.axes.chest],
    [lerp3(sk.p.waist, sk.p.chest, 0.95), 10.3, 5.8, sk.axes.chest],
    [lerp3(sk.p.waist, sk.p.chest, 1.04), 6.6, 4.4, sk.axes.chest],
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
  return { left, right, centers, hem: 2 };
}

type ToScreen = (v: V3) => { x: number; y: number; d: number };

function polyPath(g: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
}

function drawFloor(g: CanvasRenderingContext2D, P: ToScreen, S: number, pal: Palette, props: PropSpec[], sk: Skeleton, cam: Cam) {
  const xs = Object.values(sk.p).map((v) => v[0]);
  const zs = Object.values(sk.p).map((v) => v[2]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const s0 = P([cx, 0, cz]);
  // 바닥면(바닥선 아래)
  const H = g.canvas.height;
  if (s0.y < H) {
    g.fillStyle = pal.ground;
    g.fillRect(-10000, s0.y, 20000, H - s0.y + 10);
  }
  // 바닥선
  g.strokeStyle = pal.floor;
  g.lineWidth = 1.3 * S;
  g.beginPath();
  g.moveTo(-10000, s0.y);
  g.lineTo(10000, s0.y);
  g.stroke();
  // 매트 (두께 있는 판) — 실제 요가 매트 비율, 몸의 긴 축 방향으로
  if (props.some((p) => p.kind === 'mat')) {
    const pts2 = Object.values(sk.p).map((v) => [v[0], v[2]] as [number, number]);
    const mx = pts2.reduce((a, p) => a + p[0], 0) / pts2.length, mz = pts2.reduce((a, p) => a + p[1], 0) / pts2.length;
    let sxx = 0, szz = 0, sxz = 0;
    for (const [x, z] of pts2) {
      sxx += (x - mx) ** 2;
      szz += (z - mz) ** 2;
      sxz += (x - mx) * (z - mz);
    }
    // 긴 축을 x/z 중 하나로 맞춤. 뚜렷한 긴 축이 없으면(앉은 자세 등) 화면에서 넓게 보이는 축으로
    const tr = sxx + szz, det = sxx * szz - sxz * sxz;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
    let ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    ang = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
    if (l1 / l2 < 1.8) ang = Math.abs(Math.sin((cam.yaw * Math.PI) / 180)) > 0.5 ? Math.PI / 2 : 0;
    const u: [number, number] = [Math.cos(ang), Math.sin(ang)], v: [number, number] = [-u[1], u[0]];
    const along = pts2.map(([x, z]) => x * u[0] + z * u[1]), across = pts2.map(([x, z]) => x * v[0] + z * v[1]);
    const a0 = Math.min(...along), a1 = Math.max(...along), b0 = Math.min(...across), b1 = Math.max(...across);
    const L = Math.min(122, Math.max(70, a1 - a0 + 26)), Wd = Math.max(36, b1 - b0 + 12);
    const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
    const corner = (sa: number, sb: number, y = 0): V3 => {
      const A = ca + (sa * L) / 2, B = cb + (sb * Wd) / 2;
      return [A * u[0] + B * v[0], y, A * u[1] + B * v[1]];
    };
    const T = 1.5;
    const toCam = toCamera(cam);
    const edges: [number, number, number, number, [number, number]][] = [
      [1, -1, 1, 1, u],
      [-1, 1, -1, -1, [-u[0], -u[1]]],
      [1, 1, -1, 1, v],
      [-1, -1, 1, -1, [-v[0], -v[1]]],
    ];
    g.lineJoin = 'round';
    g.lineWidth = 1.4 * S;
    g.strokeStyle = pal.mat.l;
    for (const [sa1, sb1, sa2, sb2, n] of edges) {
      if (n[0] * toCam[0] + n[1] * toCam[2] <= 0.02) continue;
      const quad = [P(corner(sa1, sb1)), P(corner(sa2, sb2)), P(corner(sa2, sb2, -T)), P(corner(sa1, sb1, -T))];
      g.beginPath();
      polyPath(g, quad);
      g.fillStyle = pal.matSide;
      g.stroke();
      g.fill();
    }
    g.beginPath();
    polyPath(g, [P(corner(-1, -1)), P(corner(1, -1)), P(corner(1, 1)), P(corner(-1, 1))]);
    g.stroke();
    g.fillStyle = pal.mat.f;
    g.fill();
  }
  // 부드러운 그림자
  const spanX = Math.abs(P([Math.max(...xs), 0, cz]).x - P([Math.min(...xs), 0, cz]).x);
  const spanZ = Math.abs(P([cx, 0, Math.max(...zs)]).x - P([cx, 0, Math.min(...zs)]).x);
  const rx = Math.max(spanX, spanZ) * 0.55 + 7 * S, ry = 3.4 * S;
  g.save();
  g.translate(s0.x, s0.y);
  g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, pal.shadow);
  grad.addColorStop(0.65, pal.shadow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawWall(g: CanvasRenderingContext2D, P: ToScreen, S: number, pal: Palette, pr: PropSpec, sk: Skeleton, cam: Cam) {
  const dist = pr.dist ?? 0;
  const zs = Object.values(sk.p).map((v) => v[2]);
  const xs = Object.values(sk.p).map((v) => v[0]);
  const H = 130, BB = 5, TH = 3;
  // 벽면(두께 TH)을 상자로: [바닥 네 점] → 옆에서 보면 얇은 기둥처럼 보임
  let box: V3[];
  switch (pr.wall ?? 'back') {
    case 'front': {
      const z = Math.max(...zs) + dist;
      box = [[-80, 0, z], [80, 0, z], [80, 0, z + TH], [-80, 0, z + TH]];
      break;
    }
    case 'left': {
      const x = Math.max(...xs) + dist;
      box = [[x, 0, -80], [x, 0, 80], [x + TH, 0, 80], [x + TH, 0, -80]];
      break;
    }
    case 'right': {
      const x = Math.min(...xs) - dist;
      box = [[x, 0, -80], [x, 0, 80], [x - TH, 0, 80], [x - TH, 0, -80]];
      break;
    }
    default: {
      const z = Math.min(...zs) - 2 - dist;
      box = [[-80, 0, z], [80, 0, z], [80, 0, z - TH], [-80, 0, z - TH]];
    }
  }
  // 앞면(몸 쪽 면)과 모서리 면을 모두 칠해 옆에서도 두께가 보이게
  const up = (v: V3, h: number): V3 => [v[0], h, v[2]];
  const faces: V3[][] = [
    [box[0], box[1], up(box[1], H), up(box[0], H)],
    [box[1], box[2], up(box[2], H), up(box[1], H)],
    [box[3], box[0], up(box[0], H), up(box[3], H)],
  ];
  g.lineJoin = 'round';
  for (const f of faces) {
    const c = f.map(P);
    g.beginPath();
    polyPath(g, c);
    g.fillStyle = pal.wall;
    g.strokeStyle = pal.wallLine;
    g.lineWidth = 1.2 * S;
    g.fill();
    g.stroke();
  }
  // 걸레받이
  const bb = [P(box[0]), P(box[1]), P(up(box[1], BB)), P(up(box[0], BB))];
  if (Math.abs(bb[0].x - bb[1].x) > 4 * S) {
    g.beginPath();
    polyPath(g, bb);
    g.fillStyle = pal.baseboard;
    g.fill();
    g.stroke();
  }
}

/** 축 정렬 상자: 카메라를 향한 면만 칠함 (윗면은 밝게, 옆면은 어둡게) */
function drawBox(g: CanvasRenderingContext2D, P: ToScreen, cam: Cam, c: V3, h: V3, top: string, side: string, line: string, lw: number) {
  const toCam = toCamera(cam);
  const v = (sx: number, sy: number, sz: number): V3 => [c[0] + sx * h[0], c[1] + sy * h[1], c[2] + sz * h[2]];
  const faces: { n: V3; q: V3[]; fill: string }[] = [
    { n: [0, 1, 0], q: [v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)], fill: top },
    { n: [0, 0, 1], q: [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill: side },
    { n: [0, 0, -1], q: [v(-1, -1, -1), v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1)], fill: side },
    { n: [1, 0, 0], q: [v(1, -1, -1), v(1, -1, 1), v(1, 1, 1), v(1, 1, -1)], fill: side },
    { n: [-1, 0, 0], q: [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill: side },
  ];
  g.lineJoin = 'round';
  // 윤곽선 먼저(바깥만 보이게) → 면 채우기
  const vis = faces.filter((f) => f.n[0] * toCam[0] + f.n[1] * toCam[1] + f.n[2] * toCam[2] > 0.02);
  g.beginPath();
  for (const f of vis) polyPath(g, f.q.map(P));
  g.lineWidth = lw * 2;
  g.strokeStyle = line;
  g.stroke();
  for (const f of vis) {
    g.beginPath();
    polyPath(g, f.q.map(P));
    g.fillStyle = f.fill;
    g.fill();
    g.lineWidth = lw * 0.9;
    g.stroke();
  }
}

function drawChair(g: CanvasRenderingContext2D, P: ToScreen, S: number, pal: Palette, sk: Skeleton, cam: Cam) {
  const seatY = (sk.p.sitL[1] + sk.p.sitR[1]) / 2 - 1;
  const cz = (sk.p.sitL[2] + sk.p.sitR[2]) / 2 + 3;
  const cx = (sk.p.sitL[0] + sk.p.sitR[0]) / 2;
  const hw = 19, front = cz + 14, back = cz - 22, TH = 3.2;
  const lw = pal.line * S;
  const toCam = toCamera(cam);
  const leg = (x: number, z: number, y0: number, y1: number, zTop = z) => {
    const a = P([x, y1, zTop]), b = P([x, y0, z]);
    g.lineCap = 'round';
    g.strokeStyle = pal.frame;
    g.lineWidth = 2.3 * S;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  };
  // 카메라에서 먼 다리부터
  const legs: [number, number][] = [
    [cx - hw + 2.5, back + 2.5],
    [cx + hw - 2.5, back + 2.5],
    [cx - hw + 2.5, front - 2.5],
    [cx + hw - 2.5, front - 2.5],
  ];
  const depth = (l: [number, number]) => l[0] * toCam[0] + l[1] * toCam[2];
  legs.sort((a, b) => depth(a) - depth(b));
  const backTop = seatY + 40;
  const backFirst = toCam[2] > 0; // 카메라가 의자 앞쪽 → 등받이가 뒤에
  const drawBack = () => {
    for (const x of [cx - hw + 3, cx + hw - 3]) leg(x, back + 0.5, seatY, backTop - 6, back - 1.5);
    drawBox(g, P, cam, [cx, backTop - 7, back - 1.6], [hw, 7, 1.3], pal.seat.f, pal.seatSide, pal.seat.l, lw);
  };
  leg(...legs[0], 0, seatY - TH);
  leg(...legs[1], 0, seatY - TH);
  if (backFirst) drawBack();
  drawBox(g, P, cam, [cx, seatY - TH / 2, (front + back) / 2], [hw, TH / 2, (front - back) / 2], pal.seat.f, pal.seatSide, pal.seat.l, lw);
  leg(...legs[2], 0, seatY - TH);
  leg(...legs[3], 0, seatY - TH);
  if (!backFirst) drawBack();
}

function drawBall(g: CanvasRenderingContext2D, c: { x: number; y: number }, S: number, pal: Palette) {
  g.beginPath();
  g.arc(c.x, c.y, 3.4 * S, 0, Math.PI * 2);
  g.lineWidth = pal.line * 2 * S;
  g.strokeStyle = pal.ball.l;
  g.stroke();
  g.fillStyle = pal.ball.f;
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.beginPath();
  g.arc(c.x - 1.1 * S, c.y - 1.1 * S, 1.1 * S, 0, Math.PI * 2);
  g.fill();
}

function drawRoller(g: CanvasRenderingContext2D, P: ToScreen, c: V3, S: number, pal: Palette, cam: Cam) {
  const r = 7;
  const a = P([c[0] - 22, c[1], c[2]]), b = P([c[0] + 22, c[1], c[2]]);
  const sideView = Math.abs(Math.sin((cam.yaw * Math.PI) / 180)) > 0.8;
  g.lineWidth = pal.line * 2 * S;
  g.strokeStyle = pal.roller.l;
  if (sideView) {
    const m = P(c);
    g.beginPath();
    g.arc(m.x, m.y, r * S, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = pal.roller.f;
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(m.x, m.y, r * 0.45 * S, 0, Math.PI * 2);
    g.fill();
  } else {
    g.lineCap = 'round';
    g.lineWidth = (r * 2 + pal.line * 2) * S;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
    g.strokeStyle = pal.roller.f;
    g.lineWidth = r * 2 * S;
    g.stroke();
  }
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
