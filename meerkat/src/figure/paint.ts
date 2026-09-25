/**
 * 운동 시범 인물 그리기 — 윤곽선 있는 플랫 일러스트 스타일
 *
 * 팔다리는 굵기가 변하는 캡슐(테이퍼 캡슐)을 이어 붙여 근육 곡선을 만들고,
 * 같은 부위는 "윤곽선 먼저 → 채우기" 순서로 칠해 겹친 부분에 선이 생기지 않게 합니다.
 * 단위는 키 100 기준(rig.ts), 화면 배율 S 를 곱해 픽셀로 바꿉니다.
 */
import type { V3 } from './rig';

export interface Tone {
  /** 채우기 */
  f: string;
  /** 윤곽선 */
  l: string;
}

export interface Palette {
  skin: Tone;
  skinFar: Tone;
  shirt: Tone;
  shirtFar: Tone;
  shorts: Tone;
  shortsFar: Tone;
  shoe: Tone;
  shoeFar: Tone;
  sole: string;
  hair: string;
  eye: string;
  mouth: string;
  blush: string;
  floor: string;
  /** 바닥선 아래를 옅게 채우는 색 */
  ground: string;
  shadow: string;
  mat: Tone;
  matSide: string;
  wall: string;
  wallLine: string;
  baseboard: string;
  seat: Tone;
  seatSide: string;
  frame: string;
  band: string;
  roller: Tone;
  ball: Tone;
  /** 윤곽선 두께(몸 단위) */
  line: number;
}

const BODY = {
  skin: { f: '#f7cdab', l: '#cf916c' },
  skinFar: { f: '#e8b690', l: '#bf7f5b' },
  shirt: { f: '#ff6b2c', l: '#d14e18' },
  shirtFar: { f: '#e4561c', l: '#b44211' },
  shorts: { f: '#323e5b', l: '#1c2335' },
  shortsFar: { f: '#27314a', l: '#151a28' },
  shoe: { f: '#f9fafc', l: '#97a0ae' },
  shoeFar: { f: '#e1e5eb', l: '#8a93a1' },
  sole: '#d3d9e1',
  hair: '#33241b',
  eye: '#2a1f18',
  mouth: '#b0654c',
  blush: 'rgba(255, 118, 104, 0.24)',
  band: '#12b76a',
  roller: { f: '#6aa9e8', l: '#3d7cbd' },
  ball: { f: '#12b76a', l: '#0b8a4f' },
  line: 0.8,
};

export const LIGHT: Palette = {
  ...BODY,
  floor: '#dadfe6',
  ground: 'rgba(214, 221, 230, 0.35)',
  shadow: 'rgba(30, 40, 62, 0.17)',
  mat: { f: '#dbeaf8', l: '#b0c9e2' },
  matSide: '#c2d7ec',
  wall: '#eef1f5',
  wallLine: '#d5dbe3',
  baseboard: '#e0e5ec',
  seat: { f: '#dcab6f', l: '#ad7c44' },
  seatSide: '#c38f53',
  frame: '#5d6573',
};

export const DARK: Palette = {
  ...BODY,
  hair: '#4a3629',
  floor: '#3b414b',
  ground: 'rgba(59, 65, 75, 0.3)',
  shadow: 'rgba(0, 0, 0, 0.38)',
  mat: { f: '#2d3b4d', l: '#43586f' },
  matSide: '#243142',
  wall: '#252a32',
  wallLine: '#363d48',
  baseboard: '#2e343d',
  seat: { f: '#a77b4c', l: '#7a5834' },
  seatSide: '#8b653d',
  frame: '#8c95a4',
};

// ─────────────────────────────────────────────
// 2D 도형
// ─────────────────────────────────────────────

export interface P2 {
  x: number;
  y: number;
}
export type Ctx = CanvasRenderingContext2D;
export type Cap = 'round' | 'flat';

export const mix2 = <T extends P2>(a: T, b: T, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

interface Tube {
  a: P2;
  ra: number;
  b: P2;
  rb: number;
  /** 두 접선 방향 각도 (a1: +쪽, a2: −쪽). null 이면 한 원이 다른 원을 품음 */
  t: { a1: number; a2: number } | null;
}

function tube(a: P2, ra: number, b: P2, rb: number): Tube {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(ra - rb) + 1e-3) return { a, ra, b, rb, t: null };
  const th = Math.atan2(dy, dx);
  const ph = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  return { a, ra, b, rb, t: { a1: th + ph, a2: th - ph } };
}

const at = (c: P2, r: number, ang: number): P2 => ({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });

/** 원 경로(시계 방향) 추가 */
export function circle(g: Ctx, c: P2, r: number) {
  g.moveTo(c.x + r, c.y);
  g.arc(c.x, c.y, r, 0, Math.PI * 2);
}

/** 테이퍼 캡슐 경로(닫힌 도형, 시계 방향)를 현재 path에 추가 */
export function hull(g: Ctx, a: P2, ra: number, b: P2, rb: number, capA: Cap = 'round', capB: Cap = 'round') {
  const tb = tube(a, ra, b, rb);
  if (!tb.t) {
    circle(g, ra >= rb ? a : b, Math.max(ra, rb));
    return;
  }
  const { a1, a2 } = tb.t;
  const pa1 = at(a, ra, a1), pa2 = at(a, ra, a2), pb1 = at(b, rb, a1), pb2 = at(b, rb, a2);
  g.moveTo(pa1.x, pa1.y);
  if (capA === 'round') g.arc(a.x, a.y, ra, a1, a2);
  else g.lineTo(pa2.x, pa2.y);
  g.lineTo(pb2.x, pb2.y);
  if (capB === 'round') g.arc(b.x, b.y, rb, a2, a1);
  else g.lineTo(pb1.x, pb1.y);
  g.closePath();
}

/** 캡슐의 일부 테두리만 (윤곽선용 열린 경로). sides=false 면 끝선만 */
function hullEdges(g: Ctx, a: P2, ra: number, b: P2, rb: number, opt: { capA?: Cap | 'none'; capB?: Cap | 'none'; sides?: boolean }) {
  const tb = tube(a, ra, b, rb);
  if (!tb.t) return;
  const sides = opt.sides ?? true;
  const { a1, a2 } = tb.t;
  const pa1 = at(a, ra, a1), pa2 = at(a, ra, a2), pb1 = at(b, rb, a1), pb2 = at(b, rb, a2);
  g.moveTo(pa2.x, pa2.y);
  if (sides) g.lineTo(pb2.x, pb2.y);
  else g.moveTo(pb2.x, pb2.y);
  if (opt.capB === 'round') g.arc(b.x, b.y, rb, a2, a1);
  else if (opt.capB === 'flat') g.lineTo(pb1.x, pb1.y);
  else g.moveTo(pb1.x, pb1.y);
  if (sides) g.lineTo(pa1.x, pa1.y);
  else g.moveTo(pa1.x, pa1.y);
  if (opt.capA === 'round') g.arc(a.x, a.y, ra, a1, a2);
  else if (opt.capA === 'flat') g.lineTo(pa2.x, pa2.y);
}

/** 윤곽선(바깥쪽만 보이게) + 채우기. build 안의 도형들은 합집합으로 칠해짐 */
export function paint(g: Ctx, tone: Tone, lw: number, build: () => void) {
  g.beginPath();
  build();
  if (lw > 0) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = lw * 2;
    g.strokeStyle = tone.l;
    g.stroke();
  }
  g.fillStyle = tone.f;
  g.fill();
}

/** 일부 테두리만 윤곽선(바깥쪽) + 닫힌 도형 채우기 */
function paintPartial(g: Ctx, tone: Tone, lw: number, fillBuild: () => void, strokeBuild: () => void) {
  strokePath(g, tone.l, lw * 2, strokeBuild);
  g.beginPath();
  fillBuild();
  g.fillStyle = tone.f;
  g.fill();
}

function strokePath(g: Ctx, color: string, w: number, build: () => void) {
  g.beginPath();
  build();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = w;
  g.strokeStyle = color;
  g.stroke();
}

// ─────────────────────────────────────────────
// 팔다리
// ─────────────────────────────────────────────

/** 몸 단위 반지름 */
const RAD = {
  hip: 6.1,
  thigh: 5.8,
  knee: 4.0,
  calf: 4.35,
  ankle: 2.35,
  shoulder: 3.85,
  arm: 3.35,
  elbow: 2.6,
  fore: 2.8,
  wrist: 1.85,
};

export interface LimbPts {
  a: P2 & { d: number };
  b: P2 & { d: number };
  c: P2 & { d: number };
}

export interface LegInput {
  hip: P2 & { d: number };
  kn: P2 & { d: number };
  an: P2 & { d: number };
  heel: P2;
  toe: P2;
  far: boolean;
  /** 무릎을 많이 굽힘 → 허벅지·정강이를 따로 칠해 접힌 선을 보여 줌 */
  fold: boolean;
}

export function drawLeg(g: Ctx, L: LegInput, S: number, pal: Palette) {
  const lw = pal.line * S;
  const skin = L.far ? pal.skinFar : pal.skin;
  const shorts = L.far ? pal.shortsFar : pal.shorts;
  const shoeT = L.far ? pal.shoeFar : pal.shoe;
  const tm = mix2(L.hip, L.kn, 0.36);
  const cm = mix2(L.kn, L.an, 0.3);
  const thigh = () => {
    hull(g, L.hip, RAD.hip * S, tm, RAD.thigh * S);
    hull(g, tm, RAD.thigh * S, L.kn, RAD.knee * S);
  };
  const shank = () => {
    hull(g, L.kn, RAD.knee * S, cm, RAD.calf * S);
    hull(g, cm, RAD.calf * S, L.an, RAD.ankle * S);
  };
  const shortsLeg = () => {
    const top = mix2(L.hip, L.kn, 0.02);
    const hem = mix2(L.hip, L.kn, 0.46);
    const r1 = (RAD.hip + 0.35) * S, r2 = (RAD.thigh + 0.55) * S;
    paintPartial(
      g,
      shorts,
      lw,
      () => hull(g, top, r1, hem, r2, 'round', 'flat'),
      () => hullEdges(g, top, r1, hem, r2, { capB: 'flat' }),
    );
  };
  const shoe = () => drawShoe(g, L.heel, L.toe, L.an, S, shoeT, pal.sole, lw);
  if (!L.fold) {
    paint(g, skin, lw, () => {
      thigh();
      shank();
    });
    shoe();
    shortsLeg();
    return;
  }
  // 접힌 다리: 앞(카메라 쪽)에 있는 마디를 나중에
  const thighD = (L.hip.d + L.kn.d) / 2, shankD = (L.kn.d + L.an.d) / 2;
  const shankOnTop = shankD > thighD + 1.5;
  const drawThigh = () => {
    paint(g, skin, lw, thigh);
    shortsLeg();
  };
  const drawShank = () => {
    paint(g, skin, lw, shank);
    shoe();
  };
  if (shankOnTop) {
    drawThigh();
    drawShank();
  } else {
    drawShank();
    drawThigh();
  }
}

function drawShoe(g: Ctx, heel: P2, toe: P2, an: P2, S: number, tone: Tone, sole: string, lw: number) {
  const inst = mix2(an, toe, 0.5);
  paint(g, tone, lw, () => {
    hull(g, heel, 2.25 * S, toe, 1.75 * S);
    hull(g, an, 2.55 * S, inst, 2.15 * S);
    hull(g, heel, 2.25 * S, an, 2.45 * S);
  });
  // 밑창 띠
  const vx = toe.x - heel.x, vy = toe.y - heel.y;
  const vl = Math.hypot(vx, vy);
  if (vl < 2.5 * S) return;
  let nx = -vy / vl, ny = vx / vl;
  if (nx * (an.x - heel.x) + ny * (an.y - heel.y) > 0) {
    nx = -nx;
    ny = -ny;
  }
  const off1 = 1.35 * S, off2 = 1.0 * S;
  strokePath(g, sole, 1.05 * S, () => {
    g.moveTo(heel.x + nx * off1 + (vx / vl) * 0.4 * S, heel.y + ny * off1 + (vy / vl) * 0.4 * S);
    g.lineTo(toe.x + nx * off2 - (vx / vl) * 0.3 * S, toe.y + ny * off2 - (vy / vl) * 0.3 * S);
  });
}

export interface ArmInput {
  sh: P2 & { d: number };
  el: P2 & { d: number };
  wr: P2 & { d: number };
  ha: P2 & { d: number };
  far: boolean;
  fold: boolean;
  /** 팔이 몸통 옆면에 붙어 있으면 몸통 경로 — 소매 윤곽선을 몸통 밖에만 그려 이음선을 없앰 */
  torso?: TorsoShape;
}

export function drawArm(g: Ctx, A: ArmInput, S: number, pal: Palette) {
  const lw = pal.line * S;
  const skin = A.far ? pal.skinFar : pal.skin;
  const shirt = A.far ? pal.shirtFar : pal.shirt;
  const um = mix2(A.sh, A.el, 0.4);
  const fm = mix2(A.el, A.wr, 0.3);
  const upper = () => {
    hull(g, A.sh, RAD.shoulder * S, um, RAD.arm * S);
    hull(g, um, RAD.arm * S, A.el, RAD.elbow * S);
  };
  const fore = () => {
    hull(g, A.el, RAD.elbow * S, fm, RAD.fore * S);
    hull(g, fm, RAD.fore * S, A.wr, RAD.wrist * S);
    const h1 = mix2(A.wr, A.ha, 0.5), h2 = mix2(A.wr, A.ha, 0.86);
    hull(g, A.wr, RAD.wrist * S, h1, 2.25 * S);
    hull(g, h1, 2.25 * S, h2, 1.75 * S);
  };
  const sleeve = () => {
    const top = mix2(A.sh, A.el, 0.04);
    const hem = mix2(A.sh, A.el, 0.5);
    const r1 = (RAD.shoulder + 0.45) * S, r2 = (RAD.arm + 0.5) * S;
    if (!A.torso) {
      paint(g, shirt, lw, () => hull(g, top, r1, hem, r2, 'round', 'flat'));
      return;
    }
    const T = A.torso;
    g.save();
    g.beginPath();
    g.rect(-1e5, -1e5, 2e5, 2e5);
    torsoPath(g, T, 0, T.left.length - 1, true, true);
    g.clip('evenodd');
    strokePath(g, shirt.l, lw * 2, () => hull(g, top, r1, hem, r2, 'round', 'flat'));
    g.restore();
    // 밑단 선은 몸통 위에서도 보이게
    strokePath(g, shirt.l, lw * 2, () => hullEdges(g, top, r1, hem, r2, { capA: 'none', capB: 'flat', sides: false }));
    g.beginPath();
    hull(g, top, r1, hem, r2, 'round', 'flat');
    g.fillStyle = shirt.f;
    g.fill();
  };
  if (!A.fold) {
    paint(g, skin, lw, () => {
      upper();
      fore();
    });
    sleeve();
    return;
  }
  const upperD = (A.sh.d + A.el.d) / 2, foreD = (A.el.d + A.wr.d) / 2;
  const upperOnTop = upperD > foreD + 1.5;
  const drawUpper = () => {
    paint(g, skin, lw, upper);
    sleeve();
  };
  const drawFore = () => paint(g, skin, lw, fore);
  if (upperOnTop) {
    drawFore();
    drawUpper();
  } else {
    drawUpper();
    drawFore();
  }
}

// ─────────────────────────────────────────────
// 몸통
// ─────────────────────────────────────────────

export interface TorsoShape {
  /** 아래(골반)→위(가슴) 단면의 좌·우 가장자리와 중심 */
  left: P2[];
  right: P2[];
  centers: P2[];
  /** 반바지가 끝나고 상의가 시작되는 단면 번호 */
  hem: number;
}

function smoothSide(g: Ctx, pts: P2[], from: number, to: number, move: boolean) {
  const step = to >= from ? 1 : -1;
  if (move) g.moveTo(pts[from].x, pts[from].y);
  else g.lineTo(pts[from].x, pts[from].y);
  for (let i = from + step; step > 0 ? i <= to : i >= to; i += step) {
    const p = pts[i - step];
    const m = { x: (p.x + pts[i].x) / 2, y: (p.y + pts[i].y) / 2 };
    g.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  g.lineTo(pts[to].x, pts[to].y);
}

/** from~to 구간 몸통 윤곽. cap: 위/아래 끝을 둥글게 닫을지 */
function torsoPath(g: Ctx, T: TorsoShape, from: number, to: number, roundTop: boolean, roundBottom: boolean) {
  const { left, right, centers } = T;
  smoothSide(g, left, from, to, true);
  const topC = centers[to], prevC = centers[to - 1];
  if (roundTop) g.quadraticCurveTo(topC.x + (topC.x - prevC.x) * 0.45, topC.y + (topC.y - prevC.y) * 0.45, right[to].x, right[to].y);
  else g.lineTo(right[to].x, right[to].y);
  smoothSide(g, right, to, from, false);
  const botC = centers[from], nextC = centers[from + 1];
  if (roundBottom) g.quadraticCurveTo(botC.x - (nextC.x - botC.x) * 0.5, botC.y - (nextC.y - botC.y) * 0.5, left[from].x, left[from].y);
  g.closePath();
}

export function drawTorso(g: Ctx, T: TorsoShape, S: number, pal: Palette) {
  const lw = pal.line * S;
  const last = T.left.length - 1;
  // 반바지(골반): 옆선만 윤곽
  paintPartial(
    g,
    pal.shorts,
    lw,
    () => torsoPath(g, T, 0, T.hem, false, true),
    () => {
      smoothSide(g, T.left, 0, T.hem, true);
      smoothSide(g, T.right, 0, T.hem, true);
    },
  );
  // 상의
  paint(g, pal.shirt, lw, () => torsoPath(g, T, T.hem, last, true, false));
}

// ─────────────────────────────────────────────
// 머리
// ─────────────────────────────────────────────

export interface HeadInput {
  /** 머리 중심(월드) */
  c: V3;
  /** 머리 회전 행렬 (row-major 3x3) */
  M: number[];
  /** 월드 → 화면 */
  P: (v: V3) => P2;
  /** 카메라를 향하는 월드 방향 */
  toCam: V3;
  R: number;
}

const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function drawHead(g: Ctx, H: HeadInput, S: number, pal: Palette) {
  const { c, M, P, toCam, R } = H;
  const lw = pal.line * S;
  const dir = (v: V3): V3 => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
  const W = (v: V3): V3 => {
    const w = dir(v);
    return [c[0] + w[0], c[1] + w[1], c[2] + w[2]];
  };
  const faces = (v: V3) => dot3(norm3(dir(v)), toCam);
  const center = P(c);
  const jaw = P(W([0, -2.75, 1.55]));
  const rJaw = 5.35;

  // 귀 (옆을 향할 때는 머리 뒤에)
  const ears: { p: P2; face: number; side: number }[] = [1, -1].map((s) => ({ p: P(W([s * (R - 0.35), -0.6, -0.35])), face: faces([s, 0, 0]), side: s }));
  const upAxis = dir([0, 1, 0]);
  const upS = P([c[0] + upAxis[0], c[1] + upAxis[1], c[2] + upAxis[2]]);
  const earRot = Math.atan2(upS.y - center.y, upS.x - center.x) + Math.PI / 2;
  const drawEar = (e: { p: P2; face: number }) => {
    const squash = 0.45 + 0.55 * Math.abs(e.face);
    paint(g, pal.skin, lw, () => {
      g.moveTo(e.p.x, e.p.y);
      g.ellipse(e.p.x, e.p.y, 1.55 * S * squash, 2.25 * S, earRot, 0, Math.PI * 2);
    });
    if (e.face > 0.45) {
      strokePath(g, pal.skin.l, 0.55 * S, () => g.ellipse(e.p.x, e.p.y + 0.1 * S, 0.7 * S * squash, 1.2 * S, earRot, -0.4, Math.PI * 1.2));
    }
  };
  for (const e of ears) if (e.face <= 0.35 && e.face > -0.6) drawEar(e);

  // 얼굴·두상 (두상 원 + 턱 원의 합집합)
  paint(g, pal.skin, lw, () => {
    circle(g, center, R * S);
    circle(g, jaw, rJaw * S);
  });
  for (const e of ears) if (e.face > 0.35) drawEar(e);

  // 볼
  for (const s of [1, -1]) {
    const v: V3 = [s * 3.9, -1.7, 5.6];
    const f = faces(v);
    if (f > 0.25) {
      const p = P(W(v));
      g.fillStyle = pal.blush;
      g.beginPath();
      circle(g, p, 1.35 * S);
      g.fill();
    }
  }

  // 머리카락: 뒤로 기운 구 모자(cap)를 3D 메쉬로 → 카메라를 향한 조각만
  drawHair(g, H, S, pal, dir);

  // 눈·눈썹
  for (const s of [1, -1]) {
    const ev: V3 = [s * 2.55, 0.25, 6.5];
    if (faces(ev) > 0.12) {
      const p = P(W(ev));
      g.fillStyle = pal.eye;
      g.beginPath();
      g.ellipse(p.x, p.y, 0.78 * S, 0.98 * S, earRot, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      circle(g, { x: p.x + 0.25 * S, y: p.y - 0.32 * S }, 0.26 * S);
      g.fill();
    }
    const b1: V3 = [s * 1.55, 2.45, 6.55], b2: V3 = [s * 3.55, 2.3, 5.95];
    if (faces(b1) > 0.2 && faces(b2) > 0.05) {
      const p1 = P(W(b1)), p2 = P(W(b2));
      strokePath(g, pal.hair, 0.62 * S, () => {
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
      });
    }
  }
  // 코: 옆모습은 옆선으로 살짝 튀어나오고, 앞모습은 작은 곡선
  const noseFace = faces([0, -0.1, 1]);
  if (noseFace > 0.5) {
    const n1 = P(W([-0.75, -1.45, 7.0])), n2 = P(W([0, -1.85, 7.25])), n3 = P(W([0.75, -1.45, 7.0]));
    strokePath(g, pal.skin.l, 0.55 * S, () => {
      g.moveTo(n1.x, n1.y);
      g.quadraticCurveTo(2 * n2.x - (n1.x + n3.x) / 2, 2 * n2.y - (n1.y + n3.y) / 2, n3.x, n3.y);
    });
  } else if (noseFace > -0.35) {
    const p = P(W([0, -1.1, 7.15]));
    paint(g, pal.skin, lw * 0.8, () => circle(g, p, 1.0 * S));
  }
  // 입
  if (faces([0, -0.45, 0.9]) > 0.3) {
    const m1 = P(W([-1.35, -3.35, 6.05])), m2 = P(W([0, -3.95, 6.3])), m3 = P(W([1.35, -3.35, 6.05]));
    strokePath(g, pal.mouth, 0.58 * S, () => {
      g.moveTo(m1.x, m1.y);
      g.quadraticCurveTo(2 * m2.x - (m1.x + m3.x) / 2, 2 * m2.y - (m1.y + m3.y) / 2, m3.x, m3.y);
    });
  }
}

/** 머리선 높이(도) — 방위각 |φ| (0 = 이마, 90 = 귀, 180 = 뒤통수) */
const HAIRLINE: [number, number][] = [
  [0, 40],
  [30, 37],
  [55, 29],
  [74, 17],
  [86, 17],
  [98, 12],
  [112, -14],
  [140, -30],
  [180, -36],
];

function hairline(phiDeg: number): number {
  const x = Math.abs(((phiDeg + 540) % 360) - 180); // 0..180
  for (let i = 1; i < HAIRLINE.length; i++) {
    const [x0, y0] = HAIRLINE[i - 1], [x1, y1] = HAIRLINE[i];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
  }
  return HAIRLINE[HAIRLINE.length - 1][1];
}

function drawHair(g: Ctx, H: HeadInput, S: number, pal: Palette, dir: (v: V3) => V3) {
  const { c, P, toCam, R } = H;
  const Rh = R * 1.07;
  const off = dir([0, 0.35, -0.3]);
  const D = Math.PI / 180;
  const RINGS = 6, SEG = 28;
  const grid: { s: P2; f: number }[][] = [];
  for (let i = 0; i <= RINGS; i++) {
    const row: { s: P2; f: number }[] = [];
    for (let j = 0; j < SEG; j++) {
      const phi = (360 * j) / SEG;
      const el0 = hairline(phi);
      const el = (el0 + ((90 - el0) * i) / RINGS) * D;
      const local: V3 = [Math.cos(el) * Math.sin(phi * D), Math.sin(el), Math.cos(el) * Math.cos(phi * D)];
      const n = dir(local);
      const w: V3 = [c[0] + off[0] + n[0] * Rh, c[1] + off[1] + n[1] * Rh, c[2] + off[2] + n[2] * Rh];
      row.push({ s: P(w), f: dot3(n, toCam) });
    }
    grid.push(row);
  }
  g.beginPath();
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEG; j++) {
      const q = [grid[i][j], grid[i][(j + 1) % SEG], grid[i + 1][(j + 1) % SEG], grid[i + 1][j]];
      if ((q[0].f + q[1].f + q[2].f + q[3].f) / 4 < -0.12) continue;
      // 방향을 맞춰(시계 방향) 겹친 조각이 합집합으로 칠해지게
      let area = 0;
      for (let k = 0; k < 4; k++) {
        const a = q[k].s, b = q[(k + 1) % 4].s;
        area += a.x * b.y - b.x * a.y;
      }
      const order = area >= 0 ? q : [...q].reverse();
      g.moveTo(order[0].s.x, order[0].s.y);
      for (let k = 1; k < 4; k++) g.lineTo(order[k].s.x, order[k].s.y);
      g.closePath();
    }
  }
  g.fillStyle = pal.hair;
  g.fill();
  g.lineWidth = 0.6;
  g.strokeStyle = pal.hair;
  g.stroke();
}

// ─────────────────────────────────────────────
// 목
// ─────────────────────────────────────────────

export function drawNeck(g: Ctx, base: P2, top: P2, S: number, pal: Palette) {
  paint(g, pal.skin, pal.line * S, () => hull(g, base, 2.95 * S, top, 2.75 * S));
}
