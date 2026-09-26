// Companions (짝꿍) — procedural, no image assets (GDD 6.2 / 11.1).
//
// drawCompanion(c, id, t, x, y, scale = 1) draws the companion centred on (x, y) in the current transform's
// units — world px in the run, anything else via the ctx transform (portraits, cards). It faces right and
// animates itself from t (seconds): hover, wing flaps, glow pulse, blinks. The caller only moves the anchor
// (e.g. lazily following the runner: behind and above the head).
//  - 'firefly' 반딧불 반짝이: a round glowing bug with tiny wings and a soft glow   (~24 px body, glow r≈30)
//  - 'magpie'  까치 깍순이:   black-and-white magpie, blue sheen, flapping wings   (~50 × 30 px)
//  - 'haetae'  아기 해태 해돌이: tiny golden haetae with a curly mane on a cloud  (~44 × 46 px)
// Static parts are cached per resolution bucket in offscreen canvases; each frame is 1–3 blits + ≤ 8 paths.

export type CompanionId = 'firefly' | 'magpie' | 'haetae';
export const COMPANION_IDS: CompanionId[] = ['firefly', 'magpie', 'haetae'];

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const BASE_SCALE: Record<string, number> = { firefly: 1.3, magpie: 0.95, haetae: 1 };

export function drawCompanion(c: Ctx, id: string, t: number, x: number, y: number, scale = 1): void {
  c.save();
  c.translate(x, y);
  const k = scale * (BASE_SCALE[id] ?? 1);
  if (k !== 1) c.scale(k, k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const res = resFor(c);
  if (id === 'magpie') magpie(c, t, res);
  else if (id === 'haetae') haetae(c, t, res);
  else firefly(c, t, res);
  c.restore();
}

// ------------------------------------------------------------------ cache

const BUCKETS = [1, 1.5, 2, 3, 4, 6, 8];
const cache = new Map<string, HTMLCanvasElement>();
function resFor(c: Ctx): number {
  let s = 2;
  if (typeof c.getTransform === 'function') { const m = c.getTransform(); s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 2; }
  s *= 1.1;
  for (const b of BUCKETS) if (b >= s) return b;
  return BUCKETS[BUCKETS.length - 1];
}
function blit(c: Ctx, key: string, res: number, bx: number, by: number, bw: number, bh: number, draw: (g: Ctx) => void): void {
  const k = key + '@' + res;
  let cv = cache.get(k);
  if (!cv && typeof document !== 'undefined') {
    const n = document.createElement('canvas'); n.width = Math.ceil(bw * res); n.height = Math.ceil(bh * res);
    const g = n.getContext('2d');
    if (g) {
      g.scale(res, res); g.translate(-bx, -by); g.lineCap = 'round'; g.lineJoin = 'round'; draw(g);
      if (cache.size > 40) cache.clear();
      cache.set(k, n); cv = n;
    }
  }
  if (cv) c.drawImage(cv, bx, by, bw, bh);
  else { c.save(); draw(c); c.restore(); }
}

function ellSub(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); c.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function circSub(c: Ctx, x: number, y: number, r: number): void { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
function blinkAt(t: number, period: number, off: number): boolean { return ((t + off) % period) > period - 0.13; }

/** big cute eye: white, pupil looking forward, highlight — or a closed arc when blinking */
function eye(c: Ctx, x: number, y: number, r: number, blink: boolean, line: string): void {
  if (blink) { c.strokeStyle = line; c.lineWidth = Math.max(1, r * 0.55); c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x, y + r * 0.9, x + r, y); c.stroke(); return; }
  c.fillStyle = '#fff'; c.beginPath(); ellSub(c, x, y, r, r * 1.12); c.fill(); c.strokeStyle = line; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = '#21152a'; c.beginPath(); ellSub(c, x + r * 0.25, y + r * 0.12, r * 0.66, r * 0.8); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); circSub(c, x + r * 0.5, y - r * 0.32, r * 0.3); c.fill();
}

// ------------------------------------------------------------------ 반딧불 반짝이

function firefly(c: Ctx, t: number, res: number): void {
  c.translate(Math.sin(t * 1.7) * 5, Math.sin(t * 3.4) * 3.5);        // lazy figure-8 hover
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
  const a0 = c.globalAlpha;
  c.globalAlpha = a0 * (0.55 + 0.45 * pulse);
  blit(c, 'ff-glow', res > 2 ? 2 : res, -39, -31, 68, 68, g => {       // soft glow centred on the lamp (-5, 3)
    const gr = g.createRadialGradient(-5, 3, 0, -5, 3, 34);
    gr.addColorStop(0, 'rgba(255,248,170,0.95)'); gr.addColorStop(0.28, 'rgba(255,236,110,0.45)'); gr.addColorStop(0.6, 'rgba(255,220,90,0.14)'); gr.addColorStop(1, 'rgba(255,220,90,0)');
    g.fillStyle = gr; g.fillRect(-39, -31, 68, 68);
  });
  c.globalAlpha = a0;
  const flap = Math.sin(t * 40) * 0.45;
  ffWing(c, -0.95 + flap, 'rgba(205,225,255,0.55)');
  blit(c, 'ff-body', res, -18, -20, 36, 34, g => {
    const ab = g.createRadialGradient(-6, 3, 0.5, -5, 3, 8.5);
    ab.addColorStop(0, '#ffffff'); ab.addColorStop(0.45, '#fff27a'); ab.addColorStop(1, '#ffc93a');
    g.fillStyle = ab; g.beginPath(); ellSub(g, -5, 3, 8, 6.8, -0.3); g.fill(); g.strokeStyle = '#b8901c'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(190,140,30,0.55)'; g.lineWidth = 1.1; g.beginPath(); g.arc(-1, 1, 6, 1.7, 3.2); g.moveTo(-4.6 + 5.2 * Math.cos(1.9), 2 + 5.2 * Math.sin(1.9)); g.arc(-4.6, 2, 5.2, 1.9, 3.4); g.stroke();
    g.strokeStyle = '#1d1633'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(1, 5); g.lineTo(0, 9); g.moveTo(4, 5); g.lineTo(4, 9); g.stroke();
    g.fillStyle = '#4a3d78'; g.beginPath(); circSub(g, 5, -1, 7); g.fill(); g.strokeStyle = '#1d1633'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); ellSub(g, 3, -5.2, 3.2, 1.6, -0.3); g.fill();
    g.strokeStyle = '#1d1633'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(4, -7.5); g.quadraticCurveTo(2, -12, 3.5, -15.5); g.moveTo(8, -7); g.quadraticCurveTo(10, -11, 13, -13); g.stroke();
    g.fillStyle = '#fff27a'; g.beginPath(); circSub(g, 3.5, -15.5, 1.7); circSub(g, 13, -13, 1.7); g.fill();
    g.fillStyle = 'rgba(255,140,170,0.8)'; g.beginPath(); ellSub(g, 10.6, 2.4, 2, 1.2); g.fill();
  });
  eye(c, 7.4, -1.6, 3.1, blinkAt(t, 3.1, 0.4), '#1d1633');
  // hot core flickers brighter
  c.fillStyle = `rgba(255,255,255,${(0.35 + 0.5 * pulse).toFixed(3)})`; c.beginPath(); ellSub(c, -6, 3.6, 3.4, 2.8, -0.3); c.fill();
  ffWing(c, -0.4 + flap, 'rgba(225,240,255,0.7)');
}
function ffWing(c: Ctx, ang: number, fill: string): void {
  c.save(); c.translate(1, -6); c.rotate(ang);
  c.beginPath(); ellSub(c, 0, -7, 4.2, 8); c.fillStyle = fill; c.fill(); c.strokeStyle = 'rgba(120,140,200,0.85)'; c.lineWidth = 1; c.stroke();
  c.restore();
}

// ------------------------------------------------------------------ 까치 깍순이

function magpie(c: Ctx, t: number, res: number): void {
  const w = t * 11;
  c.translate(0, Math.sin(t * 2) * 2 - Math.sin(w) * 1.2);
  const flap = Math.sin(w) * 0.6 + 0.2;
  mpWing(c, flap + 0.15, true);
  blit(c, 'mp-body', res, -34, -20, 60, 38, g => {
    const ink = '#0c0a14', black = '#1b2030';
    // tail with blue-green sheen
    g.beginPath(); g.moveTo(-6, -2); g.lineTo(-29, 2.5); g.quadraticCurveTo(-34, 5.5, -30, 8.5); g.lineTo(-6, 5); g.closePath();
    g.fillStyle = black; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = '#3f7be0'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-10, 1.3); g.lineTo(-28, 4.6); g.stroke();
    g.strokeStyle = 'rgba(60,200,170,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12, 3.4); g.lineTo(-27, 6.6); g.stroke();
    // body: black back, white belly
    g.beginPath(); ellSub(g, 0, 1, 12.5, 10); g.fillStyle = black; g.fill();
    g.save(); g.beginPath(); ellSub(g, 0, 1, 12.5, 10); g.clip(); g.fillStyle = '#f6f7fb'; g.beginPath(); ellSub(g, 3.5, 6, 9, 6.5, -0.25); g.fill(); g.restore();
    g.beginPath(); ellSub(g, 0, 1, 12.5, 10); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = '#3a3a44'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, 10.5); g.lineTo(-1, 14); g.moveTo(4, 10); g.lineTo(4, 13.6); g.stroke();
    // head, beak, blush, sheen
    g.beginPath(); circSub(g, 10, -7, 7.4); g.fillStyle = black; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = 'rgba(95,145,255,0.75)'; g.lineWidth = 1.5; g.beginPath(); g.arc(10, -7, 5.2, 3.6, 4.9); g.stroke();
    g.beginPath(); g.moveTo(16.2, -9); g.lineTo(23, -6.6); g.lineTo(16.2, -4.4); g.closePath(); g.fillStyle = '#3b3b46'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = 'rgba(255,130,160,0.85)'; g.beginPath(); ellSub(g, 13.6, -3, 2.2, 1.3); g.fill();
  });
  eye(c, 11.8, -8.2, 2.9, blinkAt(t, 3.7, 1.3), '#0c0a14');
  mpWing(c, flap, false);
}
function mpWing(c: Ctx, ang: number, back: boolean): void {
  c.save(); c.translate(-1, -3); c.rotate(ang);
  c.beginPath(); c.moveTo(3, 0); c.bezierCurveTo(-3, -9, -15, -11, -22, -5); c.bezierCurveTo(-15, -1, -7, 4, 3, 0); c.closePath();
  c.fillStyle = back ? '#10131e' : '#1b2030'; c.fill(); c.strokeStyle = '#0c0a14'; c.lineWidth = 1.3; c.stroke();
  if (!back) {
    c.fillStyle = '#f6f7fb'; c.beginPath(); ellSub(c, -6.5, -2.6, 5.4, 2.2, -0.12); c.fill();
    c.strokeStyle = '#4a86ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -4.4); c.quadraticCurveTo(-11, -8.6, -19, -6.2); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ 아기 해태 해돌이

function haetae(c: Ctx, t: number, res: number): void {
  c.translate(0, Math.sin(t * 2.2) * 2.5);
  blit(c, 'ht-body', res, -32, -32, 58, 56, g => {
    const ink = '#7a4412';
    // cloud (union of puffs: outline stroke under the fill)
    g.beginPath(); circSub(g, -13, 13, 7); circSub(g, -4, 14.5, 8); circSub(g, 6, 13.5, 7.5); circSub(g, 15, 15, 5.5);
    g.rect(-17, 14, 34, 6.5);
    g.strokeStyle = '#8f84c4'; g.lineWidth = 2.6; g.stroke(); g.fillStyle = '#fbf8ff'; g.fill();
    g.fillStyle = 'rgba(170,160,225,0.35)'; g.beginPath(); ellSub(g, 0, 18.5, 17, 2.8); g.fill();
    g.strokeStyle = '#8fb0ff'; g.lineWidth = 1.4; g.beginPath();
    for (let i = 0; i <= 12; i++) { const a = i * 0.6, r = 0.4 + i * 0.36; const px = -13 + Math.cos(a) * r, py = 13 + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
    g.strokeStyle = '#b9b0e6'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-19, 17); g.quadraticCurveTo(-24, 17, -25, 13.5); g.moveTo(-18, 11); g.quadraticCurveTo(-22, 9, -21, 6); g.stroke();
    // curly flame tail
    g.beginPath(); circSub(g, -11, -1, 4.2); circSub(g, -14.5, -6.5, 3.5); circSub(g, -12.5, -11.5, 2.8);
    g.strokeStyle = ink; g.lineWidth = 2.2; g.stroke(); g.fillStyle = '#e8892b'; g.fill();
    g.strokeStyle = '#b85f1a'; g.lineWidth = 1; g.beginPath(); g.arc(-11, -1, 2, 0.5, 4); g.moveTo(-14.5 + 1.6 * Math.cos(0.5), -6.5 + 1.6 * Math.sin(0.5)); g.arc(-14.5, -6.5, 1.6, 0.5, 4); g.stroke();
    // body + paws
    const bg = g.createLinearGradient(0, -3, 0, 13); bg.addColorStop(0, '#ffd96e'); bg.addColorStop(1, '#eeae38');
    g.beginPath(); ellSub(g, 0, 5, 11, 8); g.fillStyle = bg; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
    g.beginPath(); ellSub(g, 8, 11, 3.6, 2.7); ellSub(g, 1.5, 12, 3.4, 2.5); g.fillStyle = '#ffe596'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(8, 10); g.lineTo(8, 12.5); g.moveTo(1.5, 11); g.lineTo(1.5, 13.4); g.lineWidth = 0.8; g.stroke();
    // curly mane around the back and top of the head
    g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = 0.72 * Math.PI + i * (1.5 * Math.PI / 8); circSub(g, 4 + Math.cos(a) * 10.4, -9 + Math.sin(a) * 10.4, 4); }
    g.strokeStyle = ink; g.lineWidth = 2.2; g.stroke(); g.fillStyle = '#e8892b'; g.fill();
    g.strokeStyle = '#b85f1a'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = 0.72 * Math.PI + i * (1.5 * Math.PI / 8), x = 4 + Math.cos(a) * 11, y = -9 + Math.sin(a) * 11; g.moveTo(x + 1.8 * Math.cos(a + 1), y + 1.8 * Math.sin(a + 1)); g.arc(x, y, 1.8, a + 1, a + 4); }
    g.stroke();
    // single horn (over the mane, under the head)
    g.beginPath(); g.moveTo(2.6, -16); g.quadraticCurveTo(5.2, -29, 9.4, -16); g.closePath(); g.fillStyle = '#fff1bd'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(200,150,60,0.8)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(4, -20); g.lineTo(7.4, -20.6); g.moveTo(4.6, -23.2); g.lineTo(6.8, -23.6); g.stroke();
    // head
    const hg = g.createRadialGradient(2, -13, 1, 5, -9, 10.5); hg.addColorStop(0, '#fff0a6'); hg.addColorStop(1, '#f3b73c');
    g.beginPath(); circSub(g, 5, -9, 9.8); g.fillStyle = hg; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
    // brows, muzzle, nose, mouth, blush
    g.strokeStyle = '#b85f1a'; g.lineWidth = 1.2; g.beginPath(); g.arc(1.8, -14.5, 2.2, 3.6, 5.6); g.moveTo(9.4 + 2.2 * Math.cos(3.8), -14.6 + 2.2 * Math.sin(3.8)); g.arc(9.4, -14.6, 2.2, 3.8, 5.8); g.stroke();
    g.fillStyle = '#fff3cc'; g.beginPath(); ellSub(g, 7.5, -3.6, 5.4, 3.5); g.fill();
    g.fillStyle = 'rgba(255,130,120,0.75)'; g.beginPath(); ellSub(g, -0.8, -4.6, 2.3, 1.4); ellSub(g, 13.4, -4.8, 2, 1.3); g.fill();
    g.fillStyle = '#5a2e10'; g.beginPath(); ellSub(g, 8.6, -5.4, 2.1, 1.4); g.fill();
    g.strokeStyle = '#5a2e10'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(5.4, -2.6); g.quadraticCurveTo(7, -0.8, 8.6, -2.8); g.quadraticCurveTo(10.2, -0.8, 11.8, -2.6); g.stroke();
    // red collar with a golden bell
    g.strokeStyle = '#d62839'; g.lineWidth = 2.6; g.beginPath(); g.arc(4, -9, 10.6, 1.05, 2.1); g.stroke();
    g.beginPath(); circSub(g, 5.2, 2.6, 2.6); g.fillStyle = '#ffd23f'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.moveTo(5.2, 3.2); g.lineTo(5.2, 5); g.stroke();
  });
  const bl = blinkAt(t, 4.1, 2.2);
  eye(c, 1.6, -9.6, 2.7, bl, '#5a2e10');
  eye(c, 9.4, -9.8, 2.9, bl, '#5a2e10');
}

// debug / tooling hook (scripts/preview-chars.mjs)
if (typeof window !== 'undefined') (window as any).__drawCompanion = drawCompanion;
