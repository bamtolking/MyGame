// 개발용: 고양이 11종과 물리 더미를 한 화면에 그려 본다.
import { CATS } from '../src/data/cats';
import { drawCat, drawTail, type CatPose, type Mood } from '../src/render/catdraw';
import { buildClips, VISUAL_SCALE } from '../src/render/squish';
import { World, makeBody } from '../src/sim/physics';
import { makeRng, range, int } from '../src/sim/rng';

const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const pose = (tier: number, x: number, y: number, r: number, mood: Mood = 'idle', extra: Partial<CatPose> = {}): CatPose => ({ tier, x, y, r, a: 0, squash: 0, clips: [], mood, lookX: 0, lookY: 0, blink: 0, t: 1, seed: tier, line: 2.2, detail: 1, ...extra });
// 1) 11종 큰 초상화
CATS.forEach((c, i) => {
  const x = 110 + (i % 6) * 190, y = 110 + Math.floor(i / 6) * 200;
  const p = pose(i, x, y, 70, i === 8 ? 'grumpy' : 'idle');
  drawTail(ctx, p); drawCat(ctx, p);
  ctx.fillStyle = '#4a2e23'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.name, x, y + 95);
});
// 캣닢
{ const p = pose(-1, 110 + 5 * 190, 310, 40); drawCat(ctx, p); }
// 2) 표정
const moods: Mood[] = ['idle', 'happy', 'squish', 'scared', 'sleep', 'held', 'melt'];
moods.forEach((m, i) => { const p = pose(1, 90 + i * 150, 520, 55, m, { held: m === 'held', melt: m === 'melt' ? 1 : 0, blink: 0 }); drawTail(ctx, p); drawCat(ctx, p); });
// 3) 물리 더미 + 말랑 연출
const W = 360, H = 470;
const w = new World({ gravity: 1900, friction: 0.3, restitution: 0.12, boxW: W, boxH: H, substeps: 8, iterations: 2 });
const rng = makeRng(12);
for (let i = 0; i < 38; i++) { const t = int(rng, 8); const r = CATS[t].r; const b = makeBody(i + 1, t, range(rng, r, W - r), -60, r, 0); w.add(b); for (let k = 0; k < 15; k++) w.step(1 / 60); }
for (let k = 0; k < 240; k++) w.step(1 / 60);
ctx.save(); ctx.translate(40, 640); ctx.scale(1.4, 1.4);
ctx.fillStyle = '#B98450'; ctx.fillRect(0, 0, W, H);
const discs = w.bodies.map(b => ({ x: b.x, y: b.y, r: b.r * VISUAL_SCALE }));
const clips: any[] = []; buildClips(discs, W, H, clips);
const poses = w.bodies.map((b, i) => pose(b.tier, b.x, b.y, discs[i].r, b.tier === 8 ? 'grumpy' : (i % 5 === 0 ? 'happy' : 'idle'), { a: b.a, clips: clips[i], seed: b.id, line: 1.6 }));
const order = poses.map((_, i) => i).sort((a, b) => poses[b].y - poses[a].y);
for (const i of order) drawTail(ctx, poses[i]);
for (const i of order) drawCat(ctx, poses[i]);
ctx.restore();
(window as any).__done = true;
