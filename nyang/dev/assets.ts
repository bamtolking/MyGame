// 스토어/앱 아이콘, 피처 그래픽, 캡션 스크린샷을 그린다. scripts/store-assets.mjs 가 열어서 캡처한다.
import '../src/ui/font.css';
import { CATS } from '../src/data/cats';
import { drawCat, drawTail, type CatPose, type Clip } from '../src/render/catdraw';
import { buildClips, VISUAL_SCALE } from '../src/render/squish';
import { World, makeBody } from '../src/sim/physics';
import { makeRng, range, weighted } from '../src/sim/rng';
import { FONT } from '../src/render/fx';

const q = new URLSearchParams(location.search);
const kind = q.get('asset') || 'icon';
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

const pose = (tier: number, x: number, y: number, r: number, extra: Partial<CatPose> = {}): CatPose => ({ tier, x, y, r, a: 0, squash: 0, clips: [], mood: 'idle', lookX: 0, lookY: 0, blink: 0, t: 1.3, seed: tier + 1, line: r * 0.05, detail: 2, ...extra });

function room(w: number, h: number, floorY: number) {
  const g = ctx.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, '#FFE3CC'); g.addColorStop(1, '#FFCBA6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(214,140,110,0.15)';
  const s = Math.max(w, h) / 16;
  for (let y = 0, row = 0; y < floorY; y += s * 0.8, row++) for (let x = (row % 2) * s / 2; x < w + s; x += s) paw(x, y, s * 0.13, (x + y) * 0.01);
  if (floorY < h) {
    const f = ctx.createLinearGradient(0, floorY, 0, h);
    f.addColorStop(0, '#E9BE8F'); f.addColorStop(1, '#D9A774');
    ctx.fillStyle = f; ctx.fillRect(0, floorY, w, h - floorY);
  }
}

function paw(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, s * 0.5, s * 0.9, s * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[-0.95, -0.45], [-0.35, -1.05], [0.35, -1.05], [0.95, -0.45]]) { ctx.beginPath(); ctx.ellipse(dx * s, dy * s, s * 0.33, s * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function outlineText(s: string, x: number, y: number, size: number, fill = '#fff', stroke = '#4A2E23') {
  ctx.font = `${size}px ${FONT}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y + size * 0.06);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}

function boxFront(x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#D69C5E'; ctx.strokeStyle = '#9C6632'; ctx.lineWidth = w * 0.02;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, w * 0.04); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(245,225,170,0.8)'; ctx.fillRect(x + w * 0.42, y, w * 0.16, h);
  ctx.fillStyle = 'rgba(122,46,30,0.22)';
  ctx.font = `${w * 0.1}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(x + w * 0.22, y + h * 0.55); ctx.rotate(-0.1); ctx.fillText('냥', 0, 0); ctx.restore();
  // 날개
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s < 0 ? x : x + w, y);
    ctx.scale(s, 1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.2, -h * 0.28); ctx.lineTo(-w * 0.32, -h * 0.05); ctx.lineTo(-w * 0.06, h * 0.08); ctx.closePath();
    ctx.fillStyle = '#E3AE72'; ctx.fill(); ctx.strokeStyle = '#9C6632'; ctx.lineWidth = w * 0.02; ctx.stroke();
    ctx.restore();
  }
}

function icon(S: number, maskable: boolean, opaque: boolean) {
  cv.width = S; cv.height = S;
  const g = ctx.createRadialGradient(S * 0.5, S * 0.35, S * 0.1, S * 0.5, S * 0.5, S * 0.75);
  g.addColorStop(0, '#FFE9D6'); g.addColorStop(1, '#FFB98F');
  ctx.fillStyle = g;
  if (opaque || maskable) ctx.fillRect(0, 0, S, S);
  else { ctx.beginPath(); ctx.roundRect(0, 0, S, S, S * 0.22); ctx.fill(); }
  ctx.fillStyle = 'rgba(214,120,90,0.14)';
  for (const [x, y, r] of [[0.16, 0.2, 0.05], [0.84, 0.16, 0.04], [0.86, 0.5, 0.035], [0.12, 0.55, 0.035]]) paw(x * S, y * S, r * S, x * 3);
  const k = maskable ? 0.78 : 1;
  ctx.save();
  ctx.translate(S / 2, S / 2); ctx.scale(k, k); ctx.translate(-S / 2, -S / 2);
  const bw = S * 0.74, bx = (S - bw) / 2, by = S * 0.63, bh = S * 0.28;
  const r = S * 0.3;
  // 상자에 꽉 낀 치즈냥 (양옆이 눌려 평평)
  const clips: Clip[] = [{ nx: -1, ny: 0, d: S / 2 - bx - S * 0.02 }, { nx: 1, ny: 0, d: bx + bw - S / 2 - S * 0.02 }];
  const p = pose(1, S / 2, S * 0.46, r, { mood: 'happy', clips, line: S * 0.012, squash: -0.04 });
  drawTail(ctx, { ...p, x: S * 0.56 });
  drawCat(ctx, p);
  boxFront(bx, by, bw, bh);
  ctx.restore();
}

/** 결정적인 더미 한 무더기 */
function pileWorld(W: number, H: number, n: number, seed: number, maxTier: number) {
  const w = new World({ gravity: 1900, friction: 0.3, restitution: 0.1, boxW: W, boxH: H, substeps: 8, iterations: 2 });
  const rng = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const t = Math.min(maxTier, weighted(rng, [10, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2]));
    const r = CATS[t].r;
    w.add(makeBody(i + 1, t, range(rng, r, W - r), -r - 20, r, 0));
    for (let k = 0; k < 20; k++) w.step(1 / 60);
  }
  for (let k = 0; k < 200; k++) w.step(1 / 60);
  for (const b of w.bodies) b.a = 0;
  return w;
}

function drawPile(w: World, W: number, H: number, line: number) {
  const discs = w.bodies.map(b => ({ x: b.x, y: b.y, r: b.r * VISUAL_SCALE }));
  const clips: Clip[][] = [];
  buildClips(discs, W, H, clips);
  const moods = ['idle', 'happy', 'idle', 'idle', 'happy', 'sleep'] as const;
  const poses = w.bodies.map((b, i) => pose(b.tier, b.x, b.y, discs[i].r, { clips: clips[i], line, mood: b.tier === 8 ? 'grumpy' : moods[b.id % moods.length], lookY: -0.5 }));
  const order = poses.map((_, i) => i).sort((a, b) => poses[b].y - poses[a].y);
  for (const i of order) drawTail(ctx, poses[i]);
  for (const i of order) drawCat(ctx, poses[i]);
}

function feature() {
  const Wd = 1024, Hd = 500;
  cv.width = Wd; cv.height = Hd;
  room(Wd, Hd, Hd * 0.86);
  // 상자
  const W = 360, H = 300;
  const w = pileWorld(W, H, 15, 7, 9);
  ctx.save();
  ctx.translate(585, 96); ctx.scale(1.1, 1.1);
  ctx.fillStyle = '#B98450'; ctx.fillRect(0, 0, W, H);
  drawPile(w, W, H, 2);
  ctx.fillStyle = '#D69C5E'; ctx.strokeStyle = '#9C6632'; ctx.lineWidth = 3;
  ctx.fillRect(-16, 0, 16, H + 16); ctx.strokeRect(-16, 0, 16, H + 16);
  ctx.fillRect(W, 0, 16, H + 16); ctx.strokeRect(W, 0, 16, H + 16);
  ctx.fillRect(-16, H, W + 32, 16); ctx.strokeRect(-16, H, W + 32, 16);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  outlineText('냥체역학', 60, 210, 108);
  ctx.fillStyle = '#4A2E23';
  ctx.beginPath(); ctx.roundRect(64, 250, 262, 52, 26); ctx.fill();
  ctx.fillStyle = '#FFF8F0'; ctx.font = `30px ${FONT}`; ctx.fillText('고양이는 액체다', 86, 287);
  ctx.fillStyle = '#6B4436'; ctx.font = `26px ${FONT}`;
  ctx.fillText('말랑말랑 고양이 합체 물리 퍼즐', 66, 360);
}

async function compose(src: string, W: number, Hh: number, cap: string, sub: string) {
  cv.width = W; cv.height = Hh;
  room(W, Hh, Hh);
  const img = new Image();
  img.src = src;
  await img.decode();
  const top = Hh * 0.17;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  outlineText(cap, W / 2, top * 0.62, W * 0.085);
  ctx.fillStyle = '#6B4436'; ctx.font = `${W * 0.04}px ${FONT}`;
  ctx.fillText(sub, W / 2, top * 0.62 + W * 0.075);
  // 휴대폰 틀
  const pw = W * 0.8, ph = pw * img.height / img.width;
  const maxH = Hh - top - Hh * 0.03;
  const s = Math.min(1, maxH / ph);
  const fw = pw * s, fh = ph * s;
  const fx = (W - fw) / 2, fy = top + Hh * 0.01;
  ctx.fillStyle = '#4A2E23';
  ctx.beginPath(); ctx.roundRect(fx - W * 0.018, fy - W * 0.018, fw + W * 0.036, fh + W * 0.036, W * 0.07); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, W * 0.055); ctx.clip();
  ctx.drawImage(img, fx, fy, fw, fh);
  ctx.restore();
}

(async () => {
  await document.fonts.load(`40px ${FONT}`);
  if (kind === 'icon') icon(Number(q.get('size') || 512), q.get('maskable') === '1', q.get('opaque') === '1');
  else if (kind === 'feature') feature();
  (window as any).__compose = compose;
  (window as any).__ready = true;
})();
