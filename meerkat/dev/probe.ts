import { detectImage, setPreferredDelegate } from '../src/pose/engine';
import { BODY_CONNECTIONS } from '../src/pose/landmarks';

const q = new URLSearchParams(location.search);
const img = new Image();
img.src = q.get('img') ?? './samples/male_full_height_hands.jpg';
await img.decode();
if (q.get('delegate') === 'CPU') setPreferredDelegate('CPU');
const t0 = performance.now();
const frame = await detectImage(img, { model: (q.get('model') as any) ?? 'full', mask: q.get('mask') !== '0' });
const t1 = performance.now();
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = img.naturalWidth;
c.height = img.naturalHeight;
const g = c.getContext('2d')!;
g.drawImage(img, 0, 0);
if (frame) {
  if (frame.mask) {
    const m = frame.mask;
    const id = g.getImageData(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const mx = Math.floor((x / c.width) * m.w), my = Math.floor((y / c.height) * m.h);
      const a = m.data[my * m.w + mx];
      const i = (y * c.width + x) * 4;
      id.data[i] = id.data[i] * (1 - a * 0.5) + 255 * a * 0.5;
    }
    g.putImageData(id, 0, 0);
  }
  g.lineWidth = 3;
  g.strokeStyle = '#0f0';
  for (const [a, b] of BODY_CONNECTIONS) {
    g.beginPath(); g.moveTo(frame.pts[a].x, frame.pts[a].y); g.lineTo(frame.pts[b].x, frame.pts[b].y); g.stroke();
  }
  frame.pts.forEach((p, i) => { g.fillStyle = p.v > 0.5 ? '#ff0' : '#f00'; g.fillRect(p.x - 3, p.y - 3, 6, 6); g.fillText(String(i), p.x + 4, p.y); });
}
let mmax = 0, msum = 0; if (frame?.mask) { for (const v of frame.mask.data) { mmax = Math.max(mmax, v); msum += v; } }
(window as any).__result = { maskMax: mmax, maskMean: frame?.mask ? msum / frame.mask.data.length : null, ms: t1 - t0, frame: frame ? { w: frame.w, h: frame.h, pts: frame.pts, maskW: frame.mask?.w, maskH: frame.mask?.h } : null };
document.getElementById('out')!.textContent = JSON.stringify((window as any).__result).slice(0, 400);
(window as any).__done = true;
