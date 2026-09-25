// 말랑한 고양이 그리기. 원을 이웃·벽과의 경계선으로 잘라 서로 눌린 모양을 만든다.
// 모든 좌표는 월드 단위(호출하는 쪽에서 화면 변환을 걸어 둔다).
import { CATS, type CatDef } from '../data/cats';

export type Mood = 'idle' | 'happy' | 'squish' | 'scared' | 'sleep' | 'held' | 'grumpy' | 'melt';

/** 점 p가 (p - c)·n <= d 이면 안쪽 (n: 단위 벡터, 월드 방향) */
export interface Clip { nx: number; ny: number; d: number }

export interface CatPose {
  tier: number;
  x: number; y: number;
  /** 보이는 반지름 (월드) */
  r: number;
  a: number;
  /** 세로 찌그러짐 (+ 늘어남, - 납작) */
  squash: number;
  clips: Clip[];
  mood: Mood;
  /** 눈동자 방향 -1..1 */
  lookX: number; lookY: number;
  /** 눈꺼풀 0(뜸)..1(감음) */
  blink: number;
  t: number;
  seed: number;
  /** 외곽선 두께 (월드 단위) */
  line: number;
  held?: boolean;
  melt?: number;
  alpha?: number;
  /** 작은 화면에서 수염 등 생략 */
  detail?: number;
  /** 황금 고양이 */
  gold?: boolean;
  /** 모자/액세서리 id (data/cosmetics.ts) */
  hat?: string;
}

const N_MIN = 28, N_MAX = 64;
const TAU = Math.PI * 2;
const outline: number[] = [];
const cosT: number[][] = [];
const sinT: number[][] = [];

function tables(n: number): [number[], number[]] {
  if (!cosT[n]) {
    cosT[n] = []; sinT[n] = [];
    for (let i = 0; i < n; i++) { cosT[n].push(Math.cos(TAU * i / n)); sinT[n].push(Math.sin(TAU * i / n)); }
  }
  return [cosT[n], sinT[n]];
}

/** 단위 좌표 그라디언트는 모든 고양이가 같으므로 컨텍스트마다 한 번만 만든다 */
const gradCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
function cachedGrad(ctx: CanvasRenderingContext2D, key: string, make: () => CanvasGradient): CanvasGradient {
  let m = gradCache.get(ctx);
  if (!m) { m = new Map(); gradCache.set(ctx, m); }
  let g = m.get(key);
  if (!g) { g = make(); m.set(key, g); }
  return g;
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** 외곽선 반지름 표 (단위 반지름 기준) → outline[] 에 채우고 점 개수 반환 */
function computeOutline(p: CatPose, def: CatDef | null, pxR: number): number {
  const n = Math.max(N_MIN, Math.min(N_MAX, Math.round(pxR * 1.1)));
  const [cs, sn] = tables(n);
  const sy = 1 + p.squash, sx = 1 - p.squash * 0.75;
  const fluff = def ? def.fluff : 0;
  const melt = p.melt ?? 0;
  outline.length = n;
  for (let i = 0; i < n; i++) {
    const c = cs[i], s = sn[i];
    // 타원 (찌그러짐)
    let R = 1 / Math.sqrt((c / sx) * (c / sx) + (s / sy) * (s / sy));
    const th = TAU * i / n;
    if (fluff > 0) R += fluff * (0.6 + 0.4 * Math.sin(th * 3 + p.seed)) * Math.cos((th - p.a) * 17);
    if (melt > 0) R += melt * 0.07 * Math.sin(th * 4 + p.t * 5 + p.seed) + melt * 0.05 * Math.max(0, s);
    for (const cl of p.clips) {
      const cosPhi = c * cl.nx + s * cl.ny;
      if (cosPhi > 0.02) R = smin(R, (cl.d / p.r) / cosPhi, 0.16);
    }
    outline[i] = Math.max(0.3, R);
  }
  return n;
}

/** 월드 방향 각 th 에서의 외곽선 반지름 (보간) */
function radiusAt(th: number, n: number): number {
  let f = (th / TAU) % 1; if (f < 0) f += 1;
  const x = f * n; const i = Math.floor(x) % n; const j = (i + 1) % n; const t = x - Math.floor(x);
  return outline[i] * (1 - t) + outline[j] * t;
}

function outlinePath(ctx: CanvasRenderingContext2D, n: number): void {
  const [cs, sn] = tables(n);
  ctx.beginPath();
  // 중점을 잇는 2차 곡선으로 부드럽게
  const px = (i: number) => cs[i % n] * outline[i % n];
  const py = (i: number) => sn[i % n] * outline[i % n];
  ctx.moveTo((px(0) + px(1)) / 2, (py(0) + py(1)) / 2);
  for (let i = 1; i <= n; i++) {
    const x = px(i), y = py(i), x2 = px(i + 1), y2 = py(i + 1);
    ctx.quadraticCurveTo(x, y, (x + x2) / 2, (y + y2) / 2);
  }
  ctx.closePath();
}

/** 꼬리 (모든 몸통보다 먼저 그린다) */
export function drawTail(ctx: CanvasRenderingContext2D, p: CatPose): void {
  if (p.tier < 0) return;
  const def = CATS[p.tier];
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.a);
  ctx.scale(p.r, p.r);
  const sway = Math.sin(p.t * 2.2 + p.seed) * 0.18 + (p.held ? Math.sin(p.t * 7) * 0.25 : 0);
  const sx = 0.55, sy = 0.62;
  const tipX = 1.28 + sway * 0.3, tipY = -0.2 - sway;
  const width = p.tier === 9 ? 0.34 : p.tier === 8 ? 0.36 : 0.24;
  const lw = p.line / p.r;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(1.35, 0.75, tipX, tipY); };
  path();
  ctx.strokeStyle = p.gold ? '#B87A00' : def.line; ctx.lineWidth = width + lw * 2; ctx.stroke();
  path();
  ctx.strokeStyle = p.gold ? '#F2BC2E' : tailColor(def); ctx.lineWidth = width; ctx.stroke();
  if (p.gold) { ctx.restore(); return; }
  // 꼬리 끝 무늬
  if (def.pattern === 'point' || def.pattern === 'tux' || def.pattern === 'coon' || def.pattern === 'tabby' || def.pattern === 'mackerel') {
    ctx.beginPath();
    ctx.moveTo(1.34 + sway * 0.15, 0.2 - sway * 0.6);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = def.pattern === 'tux' ? def.belly : def.c1;
    ctx.lineWidth = width * 0.9; ctx.stroke();
  }
  ctx.restore();
}

function tailColor(def: CatDef): string {
  if (def.pattern === 'calico') return def.c2;
  if (def.pattern === 'cosmic') return def.c1;
  return def.body;
}

export function drawCat(ctx: CanvasRenderingContext2D, p: CatPose): void {
  if (p.tier < 0) { drawNip(ctx, p); return; }
  const def = CATS[p.tier];
  const pxR = p.r * (p.detail ?? 1);
  const n = computeOutline(p, def, pxR);
  const lw = p.line / p.r;
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(p.x, p.y);
  ctx.scale(p.r, p.r);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (p.gold) {
    const pulse = 0.75 + 0.25 * Math.sin(p.t * 4 + p.seed);
    ctx.fillStyle = cachedGrad(ctx, 'goldglow', () => {
      const g = ctx.createRadialGradient(0, 0, 0.7, 0, 0, 1.45);
      g.addColorStop(0, 'rgba(255,214,70,0.75)'); g.addColorStop(1, 'rgba(255,214,70,0)');
      return g;
    });
    ctx.globalAlpha = (p.alpha ?? 1) * pulse;
    ctx.beginPath(); ctx.arc(0, 0, 1.45, 0, TAU); ctx.fill();
    ctx.globalAlpha = p.alpha ?? 1;
  }
  drawEars(ctx, p, def, n, lw);

  outlinePath(ctx, n);
  ctx.fillStyle = bodyFill(ctx, def);
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.rotate(p.a);
  drawCoat(ctx, p, def);
  ctx.rotate(-p.a);
  // 입체감: 왼쪽 위 빛, 아래 그늘 (월드 기준)
  ctx.fillStyle = cachedGrad(ctx, 'hl', () => {
    const hl = ctx.createRadialGradient(-0.35, -0.5, 0.05, -0.2, -0.3, 1.25);
    hl.addColorStop(0, 'rgba(255,255,255,0.32)');
    hl.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    hl.addColorStop(1, 'rgba(60,30,20,0.16)');
    return hl;
  });
  ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
  if (p.gold) drawGold(ctx, p);
  ctx.rotate(p.a);
  drawFace(ctx, p, def, pxR);
  ctx.restore();

  outlinePath(ctx, n);
  ctx.strokeStyle = p.gold ? '#B87A00' : def.line;
  ctx.lineWidth = lw * (p.gold ? 2.6 : 2);
  ctx.stroke();

  if (p.held) drawPaws(ctx, p, def, lw);
  const hat = p.hat ?? 'none';
  if (def.pattern === 'cosmic' && (hat === 'none' || hat === 'shades' || hat === 'phones')) drawCrown(ctx, p, n, lw);
  if (hat !== 'none') drawHat(ctx, p, hat, n, lw, def);
  ctx.restore();
}

/** 황금 고양이: 털빛을 금색으로 물들이고 반짝이는 띠를 흘린다 */
function drawGold(ctx: CanvasRenderingContext2D, p: CatPose): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= 0.85;
  ctx.fillStyle = '#FFCB45';
  ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = (p.alpha ?? 1) * 0.55;
  ctx.fillStyle = '#7A5200';
  ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
  ctx.globalCompositeOperation = 'source-over';
  const x = ((p.t * 0.9 + p.seed) % 2.6) - 1.3;
  ctx.globalAlpha = (p.alpha ?? 1) * 0.55;
  ctx.fillStyle = '#FFFBE0';
  ctx.beginPath();
  ctx.moveTo(x - 0.18, -1.3); ctx.lineTo(x + 0.02, -1.3); ctx.lineTo(x + 0.62, 1.3); ctx.lineTo(x + 0.42, 1.3);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** 모자/액세서리 (몸 좌표, 머리 꼭대기 기준) */
function drawHat(ctx: CanvasRenderingContext2D, p: CatPose, hat: string, n: number, lw: number, def: CatDef): void {
  const topR = radiusAt(p.a - Math.PI / 2, n);
  ctx.save();
  ctx.rotate(p.a);
  ctx.lineWidth = lw * 2;
  ctx.lineJoin = 'round';
  const kitten = def.pattern === 'kitten';
  switch (hat) {
    case 'bow': {
      ctx.translate(0.42, -topR * 0.86);
      ctx.rotate(0.35);
      ctx.fillStyle = '#FF6F9A'; ctx.strokeStyle = '#B83562';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 0.34, -0.26, s * 0.36, 0);
        ctx.quadraticCurveTo(s * 0.34, 0.26, 0, 0);
        ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    }
    case 'party': {
      ctx.translate(0.12, -topR * 0.9);
      ctx.rotate(0.28);
      ctx.beginPath(); ctx.moveTo(-0.26, 0.04); ctx.lineTo(0, -0.66); ctx.lineTo(0.26, 0.04); ctx.closePath();
      ctx.fillStyle = '#7FD3FF'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = '#FF6F9A'; ctx.lineWidth = 0.08;
      for (let y = -0.55; y < 0.1; y += 0.2) { ctx.beginPath(); ctx.moveTo(-0.4, y + 0.12); ctx.lineTo(0.4, y - 0.06); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#2F6F99'; ctx.lineWidth = lw * 2;
      ctx.beginPath(); ctx.moveTo(-0.26, 0.04); ctx.lineTo(0, -0.66); ctx.lineTo(0.26, 0.04); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#FFE46B'; ctx.beginPath(); ctx.arc(0, -0.68, 0.09, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    }
    case 'flower': {
      ctx.translate(-0.46, -topR * 0.82);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#E58BA6';
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + p.seed;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.11, 0.08, a, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#FFCF3A'; ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, TAU); ctx.fill();
      break;
    }
    case 'shades': {
      const ey = def.pattern === 'persian' ? 0.02 : -0.06;
      const ex = kitten ? 0.36 : 0.34;
      ctx.fillStyle = '#1D1B2A'; ctx.strokeStyle = '#1D1B2A';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(s * ex, ey, 0.21, 0.15, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(s * ex - 0.07, ey - 0.05, 0.06, 0.03, -0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1D1B2A';
      }
      ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.moveTo(-ex + 0.2, ey - 0.03); ctx.quadraticCurveTo(0, ey - 0.1, ex - 0.2, ey - 0.03); ctx.stroke();
      break;
    }
    case 'phones': {
      ctx.strokeStyle = '#4E5270'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.arc(0, 0.05, Math.min(1.02, topR * 1.02), Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.9, 0.05);
        ctx.fillStyle = '#FF6F7D'; ctx.strokeStyle = '#B83E4E'; ctx.lineWidth = lw * 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.14, 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFD0D6'; ctx.beginPath(); ctx.ellipse(0, 0, 0.06, 0.14, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'frog': {
      const R = topR * 1.04;
      ctx.fillStyle = '#7DC95E'; ctx.strokeStyle = '#3B7A2A';
      ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 1.18, Math.PI * 1.82); ctx.quadraticCurveTo(0, -R * 0.45, Math.cos(Math.PI * 1.18) * R, Math.sin(Math.PI * 1.18) * R); ctx.fill(); ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#7DC95E';
        ctx.beginPath(); ctx.arc(s * 0.3, -R * 0.93, 0.17, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(s * 0.3, -R * 0.93, 0.11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1B1116'; ctx.beginPath(); ctx.arc(s * 0.3, -R * 0.91, 0.06, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'halo': {
      const y = -topR * 1.18;
      const glow = 0.5 + 0.5 * Math.sin(p.t * 3 + p.seed);
      ctx.strokeStyle = `rgba(255,236,140,${0.35 + glow * 0.3})`; ctx.lineWidth = 0.16;
      ctx.beginPath(); ctx.ellipse(0, y, 0.42, 0.11, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#FFD34D'; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.ellipse(0, y, 0.42, 0.11, 0, 0, TAU); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function bodyFill(ctx: CanvasRenderingContext2D, def: CatDef): string | CanvasGradient {
  if (def.pattern !== 'cosmic') return def.body;
  return cachedGrad(ctx, 'cosmic', () => {
    const g = ctx.createRadialGradient(-0.2, -0.25, 0.1, 0, 0, 1.2);
    g.addColorStop(0, def.belly);
    g.addColorStop(0.55, def.body);
    g.addColorStop(1, def.line);
    return g;
  });
}

function drawEars(ctx: CanvasRenderingContext2D, p: CatPose, def: CatDef, n: number, lw: number): void {
  const pat = def.pattern;
  const big = pat === 'coon' ? 1.2 : pat === 'persian' ? 0.62 : pat === 'kitten' ? 1.05 : 1;
  for (const side of [-1, 1]) {
    const bodyAng = -Math.PI / 2 + side * 0.66;
    const th = bodyAng + p.a;
    const R = radiusAt(th, n);
    // 눌린 쪽 귀는 작아진다
    const e = Math.max(0.2, Math.min(1, (R - 0.6) / 0.32)) * big;
    if (e < 0.22) continue;
    ctx.save();
    ctx.rotate(th + Math.PI / 2);
    ctx.translate(0, -R * 0.84);
    ctx.rotate(side * 0.2 + (p.mood === 'scared' ? side * 0.35 : 0) + (p.mood === 'sleep' ? side * 0.2 : 0));
    const w = 0.36 * e, h = 0.5 * e;
    const tipX = side * 0.05 * e;
    ctx.beginPath();
    ctx.moveTo(-w, 0.06);
    ctx.quadraticCurveTo(-w * 0.55, -h * 0.55, tipX - w * 0.12, -h + 0.02);
    ctx.quadraticCurveTo(tipX, -h - 0.04, tipX + w * 0.12, -h + 0.02);
    ctx.quadraticCurveTo(w * 0.55, -h * 0.55, w, 0.06);
    ctx.closePath();
    ctx.fillStyle = p.gold ? '#F2BC2E' : pat === 'point' ? def.c1 : pat === 'cosmic' ? def.belly : pat === 'calico' ? (side < 0 ? def.c1 : def.c2) : def.body;
    ctx.fill();
    ctx.strokeStyle = def.line; ctx.lineWidth = lw * 2; ctx.stroke();
    // 귀 안쪽
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0.02);
    ctx.quadraticCurveTo(tipX, -h * 0.95, w * 0.5, 0.02);
    ctx.closePath();
    ctx.fillStyle = def.ear;
    ctx.fill();
    if (pat === 'coon') {
      // 스라소니 귀 깃털
      ctx.beginPath();
      ctx.moveTo(tipX, -h);
      ctx.lineTo(tipX + side * 0.04, -h - 0.2 * e);
      ctx.strokeStyle = def.line; ctx.lineWidth = lw * 2.4; ctx.stroke();
    }
    ctx.restore();
  }
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function stripe(ctx: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number): void {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

/** 털 무늬 (몸 좌표, 단위 반지름) */
function drawCoat(ctx: CanvasRenderingContext2D, p: CatPose, def: CatDef): void {
  ctx.lineCap = 'round';
  switch (def.pattern) {
    case 'kitten':
      ctx.fillStyle = def.c2; blob(ctx, 0, 0.62, 0.7, 0.42);
      ctx.fillStyle = def.c1; blob(ctx, -0.12, -0.92, 0.3, 0.2, -0.3); blob(ctx, 0.14, -0.95, 0.22, 0.16, 0.3);
      break;
    case 'tabby':
    case 'mackerel': {
      ctx.strokeStyle = def.c1;
      const w = def.pattern === 'tabby' ? 0.13 : 0.11;
      // 이마 줄무늬
      stripe(ctx, -0.22, -1.0, -0.2, -0.8, -0.16, -0.6, w);
      stripe(ctx, 0, -1.02, 0, -0.82, 0, -0.62, w);
      stripe(ctx, 0.22, -1.0, 0.2, -0.8, 0.16, -0.6, w);
      // 옆구리 줄무늬
      for (const s of [-1, 1]) {
        stripe(ctx, s * 1.02, -0.35, s * 0.8, -0.3, s * 0.72, -0.12, w);
        stripe(ctx, s * 1.02, 0.05, s * 0.78, 0.1, s * 0.74, 0.28, w);
        stripe(ctx, s * 0.95, 0.48, s * 0.72, 0.5, s * 0.66, 0.66, w);
      }
      ctx.fillStyle = def.belly; blob(ctx, 0, 0.32, 0.5, 0.36); blob(ctx, 0, 0.92, 0.55, 0.3);
      break;
    }
    case 'tux':
      ctx.fillStyle = def.belly;
      blob(ctx, 0, 0.36, 0.5, 0.38);
      blob(ctx, 0, 0.95, 0.62, 0.42);
      ctx.beginPath(); ctx.moveTo(-0.07, 0.05); ctx.lineTo(0, -0.42); ctx.lineTo(0.07, 0.05); ctx.fill();
      break;
    case 'calico':
      ctx.fillStyle = def.c1; blob(ctx, -0.62, -0.6, 0.62, 0.55, 0.4); blob(ctx, 0.72, 0.72, 0.38, 0.3);
      ctx.fillStyle = def.c2; blob(ctx, 0.66, -0.5, 0.5, 0.44, -0.5); blob(ctx, -0.8, 0.55, 0.26, 0.22);
      ctx.fillStyle = def.belly; blob(ctx, 0, 0.32, 0.46, 0.32);
      break;
    case 'point': {
      // 샴: 얼굴 가면 + 부드러운 가장자리
      ctx.fillStyle = cachedGrad(ctx, 'point', () => {
        const g = ctx.createRadialGradient(0, 0.1, 0.3, 0, 0.1, 0.66);
        g.addColorStop(0, def.c1 + 'e6'); g.addColorStop(0.6, def.c1 + '8c'); g.addColorStop(1, def.c1 + '00');
        return g;
      });
      blob(ctx, 0, 0.1, 0.68, 0.58);
      ctx.fillStyle = def.c1 + 'd9';
      ctx.beginPath();
      ctx.moveTo(-0.52, -0.1);
      ctx.quadraticCurveTo(-0.5, -0.32, -0.2, -0.3);
      ctx.quadraticCurveTo(0, -0.42, 0.2, -0.3);
      ctx.quadraticCurveTo(0.5, -0.32, 0.52, -0.1);
      ctx.quadraticCurveTo(0.5, 0.4, 0, 0.5);
      ctx.quadraticCurveTo(-0.5, 0.4, -0.52, -0.1);
      ctx.fill();
      ctx.fillStyle = def.c2; blob(ctx, 0, 1.0, 0.7, 0.3);
      break;
    }
    case 'blue':
      ctx.fillStyle = def.c1; blob(ctx, 0, -0.95, 0.9, 0.35);
      ctx.fillStyle = def.c2; blob(ctx, 0, 0.62, 0.55, 0.38);
      ctx.globalAlpha *= 0.35; ctx.strokeStyle = '#ffffff';
      stripe(ctx, -0.7, -0.55, -0.55, -0.75, -0.3, -0.82, 0.05);
      ctx.globalAlpha /= 0.35;
      break;
    case 'spots': {
      ctx.fillStyle = def.belly; blob(ctx, 0, 0.36, 0.5, 0.36); blob(ctx, 0, 0.95, 0.6, 0.3);
      const spots = [[-0.6, -0.55, 0.16], [-0.25, -0.85, 0.12], [0.3, -0.82, 0.14], [0.65, -0.5, 0.15], [-0.85, -0.1, 0.13], [0.86, -0.05, 0.14], [-0.72, 0.4, 0.15], [0.74, 0.42, 0.13], [-0.4, 0.8, 0.12], [0.42, 0.78, 0.13], [0, -0.55, 0.1]];
      for (const [x, y, r] of spots) {
        ctx.fillStyle = def.c2; blob(ctx, x, y, r, r * 0.85);
        ctx.strokeStyle = def.c1; ctx.lineWidth = r * 0.45;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.85, 0, 0.3, TAU - 0.6); ctx.stroke();
      }
      break;
    }
    case 'persian':
      ctx.fillStyle = def.c1; blob(ctx, -0.55, 0.25, 0.4, 0.36); blob(ctx, 0.55, 0.25, 0.4, 0.36);
      ctx.fillStyle = def.c2; blob(ctx, 0, 0.35, 0.36, 0.3); blob(ctx, 0, 1.0, 0.8, 0.35);
      break;
    case 'coon': {
      ctx.strokeStyle = def.c1;
      stripe(ctx, -0.2, -1.0, -0.2, -0.78, -0.14, -0.58, 0.12);
      stripe(ctx, 0.02, -1.02, 0, -0.8, 0.02, -0.6, 0.12);
      stripe(ctx, 0.24, -1.0, 0.22, -0.78, 0.18, -0.58, 0.12);
      for (const s of [-1, 1]) {
        stripe(ctx, s * 1.0, -0.4, s * 0.78, -0.32, s * 0.68, -0.14, 0.14);
        stripe(ctx, s * 1.0, 0.08, s * 0.8, 0.12, s * 0.7, 0.3, 0.14);
      }
      // 사자 갈기 같은 목털
      ctx.fillStyle = def.belly;
      ctx.beginPath();
      ctx.moveTo(-0.72, 0.45);
      for (let i = 0; i <= 8; i++) {
        const x = -0.72 + i * 0.18;
        ctx.quadraticCurveTo(x + 0.09, 0.72 + (i % 2) * 0.08, x + 0.18, 0.45 + Math.abs(4 - i) * 0.02);
      }
      ctx.lineTo(0.8, 1.2); ctx.lineTo(-0.8, 1.2); ctx.closePath(); ctx.fill();
      blob(ctx, 0, 0.3, 0.46, 0.3);
      break;
    }
    case 'cosmic': {
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = def.c1; blob(ctx, -0.45, -0.3, 0.55, 0.4, 0.6);
      ctx.fillStyle = def.c2; blob(ctx, 0.5, 0.35, 0.5, 0.32, -0.4);
      ctx.globalAlpha /= 0.55;
      ctx.fillStyle = '#ffffff';
      const stars = [[-0.7, -0.45], [-0.35, -0.8], [0.2, -0.7], [0.62, -0.42], [0.8, 0.1], [-0.82, 0.2], [-0.5, 0.62], [0.1, 0.85], [0.55, 0.7], [-0.15, -0.35], [0.35, -0.2]];
      stars.forEach(([x, y], i) => {
        const tw = 0.5 + 0.5 * Math.sin(p.t * 3 + i * 1.7);
        const s = 0.025 + 0.03 * tw;
        blob(ctx, x, y, s, s);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; blob(ctx, 0, 0.35, 0.45, 0.3);
      break;
    }
  }
}

function drawFace(ctx: CanvasRenderingContext2D, p: CatPose, def: CatDef, pxR: number): void {
  const pat = def.pattern;
  const mood = p.mood;
  const dark = pat === 'tux' || pat === 'cosmic';
  const darkFace = dark || pat === 'point';
  const lineCol = darkFace ? '#1a1320' : def.line;
  const kitten = pat === 'kitten';
  const ey = pat === 'persian' ? 0.02 : -0.06;
  const ex = kitten ? 0.36 : 0.34;
  const er = kitten ? 0.19 : pat === 'persian' ? 0.15 : 0.165;
  const lw = p.line / p.r;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 볼터치
  ctx.fillStyle = 'rgba(255,120,150,0.33)';
  blob(ctx, -0.55, 0.2, 0.15, 0.09); blob(ctx, 0.55, 0.2, 0.15, 0.09);

  for (const s of [-1, 1]) {
    const x = s * ex, y = ey;
    ctx.save();
    ctx.translate(x, y);
    if (mood === 'happy') {
      ctx.strokeStyle = lineCol; ctx.lineWidth = Math.max(lw * 2.2, 0.07);
      ctx.beginPath(); ctx.arc(0, er * 0.35, er * 0.85, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (mood === 'squish') {
      ctx.strokeStyle = lineCol; ctx.lineWidth = Math.max(lw * 2.2, 0.07);
      ctx.beginPath(); ctx.moveTo(-s * er * 0.8, -er * 0.7); ctx.lineTo(s * er * 0.6, 0); ctx.lineTo(-s * er * 0.8, er * 0.7); ctx.stroke();
    } else if (mood === 'sleep') {
      ctx.strokeStyle = lineCol; ctx.lineWidth = Math.max(lw * 2.2, 0.07);
      ctx.beginPath(); ctx.arc(0, -er * 0.2, er * 0.8, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    } else {
      const scared = mood === 'scared';
      const rr = scared ? er * 1.25 : mood === 'held' ? er * 1.12 : er;
      // 흰자 (어두운 털이거나 놀랐을 때)
      if (dark || scared) { ctx.fillStyle = scared ? '#ffffff' : def.eye; blob(ctx, 0, 0, rr, rr * 1.08); }
      else { ctx.fillStyle = def.eye; blob(ctx, 0, 0, rr, rr * 1.08); }
      const lx = p.lookX * rr * 0.35, ly = p.lookY * rr * 0.3;
      const pr = scared ? rr * 0.38 : dark ? rr * 0.55 : rr * 0.78;
      ctx.fillStyle = '#1b1116';
      if (!dark && !scared && pat !== 'point' && pat !== 'blue' && pat !== 'spots' && pat !== 'persian' && pat !== 'coon') blob(ctx, lx * 0.6, ly * 0.6, pr, pr * 1.06);
      else blob(ctx, lx, ly, pr * (pat === 'point' || pat === 'blue' || pat === 'spots' || pat === 'coon' || pat === 'persian' ? 0.62 : 1), pr * 1.12);
      // 반짝이
      ctx.fillStyle = '#ffffff';
      blob(ctx, lx - rr * 0.32, ly - rr * 0.36, rr * 0.3, rr * 0.3);
      if (pxR > 16) blob(ctx, lx + rr * 0.3, ly + rr * 0.3, rr * 0.13, rr * 0.13);
      // 눈꺼풀 (깜빡임 / 페르시안의 심드렁함)
      let lid = p.blink;
      if (mood === 'grumpy') lid = Math.max(lid, 0.45);
      if (lid > 0.02) {
        ctx.fillStyle = pat === 'point' ? def.c1 : def.body;
        ctx.beginPath(); ctx.rect(-rr * 1.3, -rr * 1.3, rr * 2.6, rr * 2.6 * lid * 0.5 + rr * 0.1 * lid); ctx.fill();
        ctx.strokeStyle = lineCol; ctx.lineWidth = Math.max(lw * 1.8, 0.05);
        const ly2 = -rr * 1.3 + rr * 2.6 * lid * 0.5 + rr * 0.1 * lid;
        ctx.beginPath(); ctx.moveTo(-rr * 1.05, ly2); ctx.lineTo(rr * 1.05, ly2); ctx.stroke();
      }
      if (scared && s === 1) {
        // 식은땀
        ctx.fillStyle = '#8fd3ff';
        ctx.beginPath();
        ctx.moveTo(rr * 1.6, -rr * 1.9);
        ctx.quadraticCurveTo(rr * 2.3, -rr * 0.8, rr * 1.6, -rr * 0.6);
        ctx.quadraticCurveTo(rr * 0.9, -rr * 0.8, rr * 1.6, -rr * 1.9);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 코
  const ny = pat === 'persian' ? 0.2 : 0.13;
  ctx.fillStyle = darkFace ? '#ff9fb4' : '#ff8aa0';
  ctx.beginPath();
  ctx.moveTo(-0.075, ny - 0.035); ctx.quadraticCurveTo(0, ny - 0.06, 0.075, ny - 0.035);
  ctx.quadraticCurveTo(0.02, ny + 0.05, 0, ny + 0.05); ctx.quadraticCurveTo(-0.02, ny + 0.05, -0.075, ny - 0.035);
  ctx.fill();

  // 입
  ctx.strokeStyle = lineCol;
  ctx.lineWidth = Math.max(lw * 1.8, 0.05);
  const my = ny + 0.06;
  if (mood === 'happy' || mood === 'held') {
    ctx.fillStyle = '#ff6f86';
    ctx.beginPath(); ctx.moveTo(-0.1, my); ctx.quadraticCurveTo(0, my + 0.2, 0.1, my); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (mood === 'scared') {
    ctx.beginPath(); ctx.moveTo(-0.14, my + 0.08);
    ctx.quadraticCurveTo(-0.07, my + 0.02, 0, my + 0.08); ctx.quadraticCurveTo(0.07, my + 0.14, 0.14, my + 0.08); ctx.stroke();
  } else if (mood === 'squish') {
    ctx.fillStyle = '#ff6f86'; blob(ctx, 0, my + 0.06, 0.06, 0.07); ctx.stroke();
  } else if (mood === 'grumpy') {
    ctx.beginPath(); ctx.moveTo(-0.12, my + 0.07); ctx.quadraticCurveTo(0, my - 0.01, 0.12, my + 0.07); ctx.stroke();
  } else if (mood === 'melt') {
    ctx.beginPath(); ctx.moveTo(-0.12, my + 0.03); ctx.quadraticCurveTo(-0.06, my + 0.1, 0, my + 0.03); ctx.quadraticCurveTo(0.06, my + 0.1, 0.12, my + 0.03); ctx.stroke();
    ctx.fillStyle = '#9fe3ff'; blob(ctx, 0.1, my + 0.14, 0.03, 0.05);
  } else {
    // ω
    ctx.beginPath();
    ctx.moveTo(-0.13, my - 0.01);
    ctx.quadraticCurveTo(-0.065, my + 0.09, 0, my);
    ctx.quadraticCurveTo(0.065, my + 0.09, 0.13, my - 0.01);
    ctx.stroke();
  }

  // 수염
  if (pxR >= 18) {
    ctx.strokeStyle = darkFace ? 'rgba(255,255,255,0.6)' : 'rgba(80,50,40,0.4)';
    ctx.lineWidth = Math.max(lw * 1.2, 0.025);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y0 = ny + 0.04 + k * 0.05;
        ctx.beginPath();
        ctx.moveTo(s * 0.26, y0);
        ctx.quadraticCurveTo(s * 0.5, y0 - 0.04 + k * 0.02, s * 0.74, y0 - 0.06 + k * 0.07);
        ctx.stroke();
      }
    }
  }
}

function drawPaws(ctx: CanvasRenderingContext2D, p: CatPose, def: CatDef, lw: number): void {
  ctx.save();
  ctx.rotate(p.a);
  const kick = Math.sin(p.t * 9) * 0.05;
  for (const s of [-1, 1]) {
    ctx.fillStyle = def.pattern === 'tux' || def.pattern === 'point' ? (def.pattern === 'tux' ? def.belly : def.c1) : def.belly;
    ctx.beginPath(); ctx.ellipse(s * 0.3, 0.93 + (s > 0 ? kick : -kick), 0.17, 0.13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = def.line; ctx.lineWidth = lw * 2; ctx.stroke();
    ctx.fillStyle = '#ff9fb4';
    ctx.beginPath(); ctx.ellipse(s * 0.3, 0.95 + (s > 0 ? kick : -kick), 0.06, 0.045, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawCrown(ctx: CanvasRenderingContext2D, p: CatPose, n: number, lw: number): void {
  const th = -Math.PI / 2 + p.a;
  const R = radiusAt(th, n);
  if (R < 0.8) return;
  ctx.save();
  ctx.rotate(th + Math.PI / 2);
  ctx.translate(0, -R * 0.98);
  ctx.beginPath();
  ctx.moveTo(-0.26, 0.02);
  ctx.lineTo(-0.3, -0.24); ctx.lineTo(-0.14, -0.12); ctx.lineTo(0, -0.3); ctx.lineTo(0.14, -0.12); ctx.lineTo(0.3, -0.24); ctx.lineTo(0.26, 0.02);
  ctx.closePath();
  ctx.fillStyle = '#FFD34D'; ctx.fill();
  ctx.strokeStyle = '#9A6A00'; ctx.lineWidth = lw * 2; ctx.stroke();
  ctx.fillStyle = '#FF5E8A'; blob(ctx, 0, -0.08, 0.05, 0.05);
  ctx.fillStyle = '#6CE4FF'; blob(ctx, -0.16, -0.05, 0.035, 0.035); blob(ctx, 0.16, -0.05, 0.035, 0.035);
  ctx.restore();
}

/** 캣닢 공: 닿은 고양이를 한 단계 올려 준다 */
function drawNip(ctx: CanvasRenderingContext2D, p: CatPose): void {
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(p.x, p.y);
  ctx.scale(p.r, p.r);
  const lw = p.line / p.r;
  const glow = 0.5 + 0.5 * Math.sin(p.t * 4);
  ctx.fillStyle = `rgba(170,255,140,${0.18 + glow * 0.2})`;
  blob(ctx, 0, 0, 1.45, 1.45);
  ctx.rotate(p.a);
  ctx.fillStyle = '#7CCB5E';
  blob(ctx, 0, 0, 1, 1);
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#4E9A3A'; ctx.lineWidth = 0.12;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-1.2, i * 0.4 - 0.3); ctx.quadraticCurveTo(0, i * 0.4 + 0.3, 1.2, i * 0.4 - 0.2); ctx.stroke(); }
  ctx.fillStyle = '#B6F08F';
  ctx.beginPath(); ctx.ellipse(-0.3, -0.35, 0.32, 0.16, -0.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.35, 0.3, 0.3, 0.14, 0.7, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU);
  ctx.strokeStyle = '#2F6B25'; ctx.lineWidth = lw * 2; ctx.stroke();
  // 반짝
  ctx.rotate(-p.a);
  ctx.fillStyle = '#ffffff';
  const s = 0.18 + glow * 0.12;
  ctx.beginPath();
  ctx.moveTo(0.55, -0.95 - s); ctx.lineTo(0.6, -0.95); ctx.lineTo(0.55 + s, -0.9); ctx.lineTo(0.6, -0.85); ctx.lineTo(0.55, -0.85 + s * 0.8); ctx.lineTo(0.5, -0.85); ctx.lineTo(0.55 - s, -0.9); ctx.lineTo(0.5, -0.95);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** 도감/미리보기용: 캔버스 한 장에 한 마리 */
export function drawPortrait(canvas: HTMLCanvasElement, tier: number, opts: { mood?: Mood; t?: number; silhouette?: boolean; pad?: number; gold?: boolean; hat?: string } = {}): void {
  const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const cssW = canvas.clientWidth || canvas.width, cssH = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cssW * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = Math.min(canvas.width, canvas.height);
  const pad = opts.pad ?? 0.2;
  const r = size * (0.5 - pad) * (tier < 0 ? 0.8 : 1);
  const pose: CatPose = {
    tier, x: canvas.width / 2, y: canvas.height / 2 + r * 0.1, r, a: 0, squash: 0, clips: [], mood: opts.mood ?? (tier === 8 ? 'grumpy' : 'idle'),
    lookX: 0, lookY: 0.2, blink: 0, t: opts.t ?? 0, seed: tier * 1.7, line: Math.max(1.5 * dpr, r * 0.05), detail: 1, gold: opts.gold, hat: opts.hat,
  };
  if (opts.silhouette) {
    ctx.globalAlpha = 1;
    drawTail(ctx, pose);
    drawCat(ctx, pose);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#b9a28f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    return;
  }
  drawTail(ctx, pose);
  drawCat(ctx, pose);
}
