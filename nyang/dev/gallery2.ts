// 개발용: 황금 고양이와 모자 확인
import { drawCat, drawTail, type CatPose } from '../src/render/catdraw';
import { HATS } from '../src/data/cosmetics';
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const pose = (tier: number, x: number, y: number, r: number, extra: Partial<CatPose> = {}): CatPose => ({ tier, x, y, r, a: 0, squash: 0, clips: [], mood: 'idle', lookX: 0, lookY: 0, blink: 0, t: 1, seed: tier, line: 2.2, detail: 1, ...extra });
[0, 1, 3, 4, 6, 8].forEach((tier, i) => { const p = pose(tier, 100 + i * 190, 110, 70, { gold: true, t: 0.3 + i * 0.4 }); drawTail(ctx, p); drawCat(ctx, p); });
HATS.forEach((h, i) => { const tier = [1, 2, 3, 4, 5, 6, 7, 10][i]; const p = pose(tier, 80 + i * 148, 380, 60, { hat: h.id, a: i === 3 ? 0.3 : 0 }); drawTail(ctx, p); drawCat(ctx, p); ctx.fillStyle = '#4a2e23'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(h.ko, 80 + i * 148, 480); });
(window as any).__done = true;
