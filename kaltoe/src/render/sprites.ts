// 스프라이트 캐시: 이모지·말풍선·절차적 직장인 캐릭터·보석·코인을 오프스크린 캔버스로 미리 그린다.
import type { Look } from '../content/types';

export interface Sprite { c: HTMLCanvasElement; w: number; h: number; ax: number; ay: number } // w,h: 월드 단위, ax/ay: 앵커(월드 단위)

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color",sans-serif';
import { BODY_FONT } from '../ui/fonts';
export const UI_FONT = BODY_FONT;
export { DISPLAY_FONT } from '../ui/fonts';

/** 글꼴이 늦게 도착했을 때 글자가 들어간 캐시를 비운다 */
export function clearSpriteCache() { cache.clear(); white.clear(); }

let S = 2;                       // 월드 1u → 픽셀
const cache = new Map<string, Sprite>();
const white = new Map<Sprite, Sprite>();
let emojiOk: boolean | null = null;

export function setSpriteScale(s: number) {
  const q = Math.max(1, Math.round(s * 4) / 4);
  if (q !== S) { S = q; cache.clear(); white.clear(); }
}
export function spriteScale() { return S; }

function canvas(wu: number, hu: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(wu * S));
  c.height = Math.max(1, Math.ceil(hu * S));
  const g = c.getContext('2d')!;
  g.scale(S, S);
  return [c, g];
}

export function emojiSupported(): boolean {
  if (emojiOk !== null) return emojiOk;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.font = `20px ${EMOJI_FONT}`;
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText('😀', 12, 13);
    const d = g.getImageData(0, 0, 24, 24).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (Math.abs(d[i] - d[i + 1]) > 30 || Math.abs(d[i + 1] - d[i + 2]) > 30)) colored++;
    emojiOk = colored > 10;
  } catch { emojiOk = false; }
  return emojiOk;
}

function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 70% 55%)`;
}

/** 이모지 스프라이트. size = 글자 크기(월드 단위) */
export function emoji(ch: string, size: number): Sprite {
  const key = `e|${ch}|${size}`;
  let s = cache.get(key);
  if (s) return s;
  const pad = size * 0.2;
  const W = size + pad * 2;
  const [c, g] = canvas(W, W);
  if (emojiSupported()) {
    g.font = `${size}px ${EMOJI_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, W / 2, W / 2 + size * 0.06);
  } else {
    g.fillStyle = hashColor(ch);
    g.beginPath(); g.arc(W / 2, W / 2, size * 0.45, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = size * 0.06; g.stroke();
  }
  s = { c, w: W, h: W, ax: W / 2, ay: W / 2 };
  cache.set(key, s);
  return s;
}

/** 바닥 장식: 바닥색으로 반쯤 덮어 배경처럼 보이게 */
export function decor(ch: string, size: number, tint: string): Sprite {
  const key = `d|${ch}|${size}|${tint}`;
  let s = cache.get(key);
  if (s) return s;
  const base = emoji(ch, size);
  const c = document.createElement('canvas');
  c.width = base.c.width; c.height = base.c.height;
  const g = c.getContext('2d')!;
  g.globalAlpha = 0.55;
  g.drawImage(base.c, 0, 0);
  g.globalAlpha = 0.5;
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = tint;
  g.fillRect(0, 0, c.width, c.height);
  s = { ...base, c };
  cache.set(key, s);
  return s;
}

/** 이모지 적: 화난 눈을 얹어 '적'으로 읽히게 한다 */
export function angry(ch: string, size: number, tint: string): Sprite {
  const key = `a|${ch}|${size}|${tint}`;
  let s = cache.get(key);
  if (s) return s;
  const base = emoji(ch, size);
  const c = document.createElement('canvas');
  c.width = base.c.width; c.height = base.c.height;
  const g = c.getContext('2d')!;
  // 적 색 외곽선(살짝 번진 테두리)
  const o = Math.max(1, Math.round(S * size * 0.045));
  g.globalAlpha = 0.9;
  for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o]]) g.drawImage(base.c, dx, dy);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = tint;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.drawImage(base.c, 0, 0);
  // 눈
  g.scale(S, S);
  const cx = base.w / 2, cy = base.h / 2 - size * 0.02;
  const ex = size * 0.17, er = size * 0.13;
  for (const sgn of [-1, 1]) {
    const x = cx + sgn * ex;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(x, cy, er, er * 1.1, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = size * 0.035; g.strokeStyle = '#1b1b2a'; g.stroke();
    g.fillStyle = '#1b1b2a';
    g.beginPath(); g.arc(x + size * 0.03, cy + er * 0.25, er * 0.52, 0, Math.PI * 2); g.fill();
    // 눈썹(화남)
    g.lineWidth = size * 0.06; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - sgn * er * 1.1, cy - er * 1.55); g.lineTo(x + sgn * er * 0.9, cy - er * 0.95); g.stroke();
  }
  s = { ...base, c };
  cache.set(key, s);
  return s;
}

/** 하얗게 번쩍이는 실루엣 */
export function whiteOf(s: Sprite): Sprite {
  let o = white.get(s);
  if (o) return o;
  const c = document.createElement('canvas');
  c.width = s.c.width; c.height = s.c.height;
  const g = c.getContext('2d')!;
  g.drawImage(s.c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  o = { ...s, c };
  white.set(s, o);
  return o;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 잔소리 말풍선 적 */
export function bubble(text: string, radius: number, tint = '#ff5a7a'): Sprite {
  const key = `b|${text}|${radius}|${tint}`;
  let s = cache.get(key);
  if (s) return s;
  const fs = Math.max(9, radius * 0.95);
  const mc = document.createElement('canvas').getContext('2d')!;
  mc.font = `900 ${fs}px ${UI_FONT}`;
  const tw = mc.measureText(text).width;
  const bw = Math.max(radius * 2.2, tw + fs * 1.1), bh = fs * 1.9;
  const W = bw + 6, H = bh + fs * 0.7 + 6;
  const [c, g] = canvas(W, H);
  g.translate(3, 3);
  g.fillStyle = 'rgba(0,0,0,.25)';
  roundRect(g, 1.5, 2.5, bw, bh, bh * 0.45); g.fill();
  g.fillStyle = '#ffffff';
  g.strokeStyle = tint; g.lineWidth = Math.max(1.5, fs * 0.16);
  roundRect(g, 0, 0, bw, bh, bh * 0.45); g.fill(); g.stroke();
  // 꼬리
  g.beginPath();
  g.moveTo(bw * 0.3, bh - 1); g.lineTo(bw * 0.24, bh + fs * 0.6); g.lineTo(bw * 0.45, bh - 1);
  g.closePath(); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.moveTo(bw * 0.3, bh); g.lineTo(bw * 0.24, bh + fs * 0.6); g.lineTo(bw * 0.45, bh); g.stroke();
  g.fillStyle = '#22223a';
  g.font = `900 ${fs}px ${UI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, bw / 2, bh / 2 + fs * 0.05);
  s = { c, w: W, h: H, ax: W / 2, ay: H * 0.45 };
  cache.set(key, s);
  return s;
}

// ───────────── 절차적 직장인 ─────────────

function drawHair(g: CanvasRenderingContext2D, look: Look, hx: number, hy: number, hr: number) {
  g.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 'bald':
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath(); g.ellipse(hx - hr * 0.3, hy - hr * 0.55, hr * 0.28, hr * 0.14, -0.4, 0, Math.PI * 2); g.fill();
      return;
    case 'short':
      g.beginPath(); g.arc(hx, hy - hr * 0.1, hr * 1.03, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(hx - hr * 0.2, hy - hr * 0.55, hr * 0.8, hr * 0.42, -0.2, 0, Math.PI * 2); g.fill();
      return;
    case 'spiky':
      g.beginPath();
      g.moveTo(hx - hr * 1.05, hy - hr * 0.1);
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const r = i % 2 ? hr * 1.55 : hr * 1.02;
        g.lineTo(hx + Math.cos(a) * r, hy - hr * 0.1 + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
      return;
    case 'bob':
      g.beginPath(); g.arc(hx, hy, hr * 1.12, Math.PI * 0.92, Math.PI * 2.08); g.lineTo(hx + hr * 1.1, hy + hr * 0.5); g.lineTo(hx - hr * 1.1, hy + hr * 0.5); g.closePath(); g.fill();
      return;
    case 'long':
      g.beginPath(); g.arc(hx, hy, hr * 1.1, Math.PI * 0.95, Math.PI * 2.05); g.lineTo(hx + hr * 1.15, hy + hr * 1.5); g.lineTo(hx - hr * 1.15, hy + hr * 1.5); g.closePath(); g.fill();
      return;
    case 'bun':
      g.beginPath(); g.arc(hx, hy - hr * 0.1, hr * 1.04, Math.PI * 1.0, Math.PI * 2.0); g.closePath(); g.fill();
      g.beginPath(); g.arc(hx - hr * 0.1, hy - hr * 1.15, hr * 0.48, 0, Math.PI * 2); g.fill();
      return;
  }
}

/** frame 0..3 = 걷기 프레임. 오른쪽을 바라보는 그림(왼쪽은 좌우 반전). */
export function worker(look: Look, frame: number, size = 34): Sprite {
  const key = `w|${JSON.stringify(look)}|${frame}|${size}`;
  let s = cache.get(key);
  if (s) return s;
  const W = size * 1.1, H = size * 1.2;
  const [c, g] = canvas(W, H);
  const k = size / 34;
  g.scale(k, k);
  const cx = W / 2 / k;
  const legY = 31;
  const step = [0, 2.2, 0, -2.2][frame & 3];
  // 다리
  g.fillStyle = '#2b2d42';
  g.fillRect(cx - 5 + step * 0.6, legY - 4, 4, 8);
  g.fillRect(cx + 1 - step * 0.6, legY - 4, 4, 8);
  g.fillStyle = '#111';
  g.fillRect(cx - 6 + step * 0.6, legY + 3, 6, 2.2);
  g.fillRect(cx + 1 - step * 0.6, legY + 3, 6, 2.2);
  // 몸
  const bob = frame & 1 ? -0.8 : 0;
  g.translate(0, bob);
  g.fillStyle = look.suit;
  roundRect(g, cx - 9, 17, 18, 13, 4); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(cx - 3.5, 17); g.lineTo(cx + 3.5, 17); g.lineTo(cx, 22); g.closePath(); g.fill();
  g.fillStyle = look.tie;
  g.beginPath(); g.moveTo(cx - 1.4, 18.5); g.lineTo(cx + 1.4, 18.5); g.lineTo(cx + 2, 26); g.lineTo(cx, 28); g.lineTo(cx - 2, 26); g.closePath(); g.fill();
  // 팔
  g.fillStyle = look.suit;
  g.save(); g.translate(cx - 9, 19); g.rotate(0.25 + step * 0.08); roundRect(g, -2.5, 0, 4, 9, 2); g.fill(); g.restore();
  g.save(); g.translate(cx + 9, 19); g.rotate(-0.25 - step * 0.08); roundRect(g, -1.5, 0, 4, 9, 2); g.fill(); g.restore();
  g.fillStyle = look.skin;
  g.beginPath(); g.arc(cx - 10 - step * 0.3, 28, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 10 + step * 0.3, 28, 2, 0, Math.PI * 2); g.fill();
  // 머리
  const hx = cx + 0.5, hy = 10, hr = 8.5;
  if (look.hairStyle === 'long' || look.hairStyle === 'bob') drawHair(g, look, hx, hy, hr);
  g.fillStyle = look.skin;
  g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.fill();
  if (look.hairStyle !== 'long' && look.hairStyle !== 'bob') drawHair(g, look, hx, hy, hr);
  else { g.fillStyle = look.hair; g.beginPath(); g.arc(hx, hy - 1, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill(); }
  // 얼굴(오른쪽 바라봄)
  g.fillStyle = '#1b1b2a';
  g.beginPath(); g.arc(hx + 2.2, hy + 1, 1.25, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(hx + 6, hy + 1, 1.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,120,120,.5)';
  g.beginPath(); g.ellipse(hx + 1, hy + 4, 1.8, 1, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1b1b2a'; g.lineWidth = 0.9;
  g.beginPath(); g.arc(hx + 4.2, hy + 4.2, 1.5, 0.2, Math.PI - 0.2); g.stroke();
  if (look.glasses) {
    g.strokeStyle = '#222'; g.lineWidth = 0.9;
    g.beginPath(); g.arc(hx + 2.2, hy + 1, 2.4, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(hx + 6.4, hy + 1, 2.2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(hx + 4.6, hy + 1); g.lineTo(hx + 4.2, hy + 1); g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (look.accessory) {
    const e = emoji(look.accessory, 9);
    g.drawImage(e.c, (cx * k + 9 * k) * S - e.c.width / 2, (26 * k) * S - e.c.height / 2);
  }
  s = { c, w: W, h: H, ax: W / 2, ay: H * 0.62 };
  cache.set(key, s);
  return s;
}

/** 사람형 적(상사·친척): 이모지 얼굴 + 정장 몸통 */
export function person(face: string, suit: string, tie: string, radius: number, frame: number): Sprite {
  const key = `p|${face}|${suit}|${tie}|${radius}|${frame}`;
  let s = cache.get(key);
  if (s) return s;
  const size = radius * 2.4;
  const W = size * 1.05, H = size * 1.35;
  const [c, g] = canvas(W, H);
  const k = size / 34;
  const cx = W / 2;
  g.save();
  g.scale(k, k);
  const x = cx / k;
  const step = [0, 2, 0, -2][frame & 3];
  g.fillStyle = '#2b2d42';
  g.fillRect(x - 6 + step * 0.5, 34, 5, 9);
  g.fillRect(x + 1 - step * 0.5, 34, 5, 9);
  g.fillStyle = '#111';
  g.fillRect(x - 7 + step * 0.5, 42, 7, 2.5);
  g.fillRect(x + 1 - step * 0.5, 42, 7, 2.5);
  g.fillStyle = suit;
  roundRect(g, x - 12, 20, 24, 16, 5); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(x - 4.5, 20); g.lineTo(x + 4.5, 20); g.lineTo(x, 26); g.closePath(); g.fill();
  g.fillStyle = tie;
  g.beginPath(); g.moveTo(x - 1.6, 21.5); g.lineTo(x + 1.6, 21.5); g.lineTo(x + 2.4, 31); g.lineTo(x, 33.5); g.lineTo(x - 2.4, 31); g.closePath(); g.fill();
  g.restore();
  const fe = emoji(face, radius * 1.45);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(fe.c, cx * S - fe.c.width / 2, (13 * k) * S - fe.c.height / 2 + 2 * S);
  s = { c, w: W, h: H, ax: W / 2, ay: H * 0.55 };
  cache.set(key, s);
  return s;
}

// ───────────── 픽업 ─────────────

const GEM_TIERS: [number, string, string][] = [
  [1, '#5ad1ff', '#1b7fd1'],
  [5, '#7dff8a', '#1faa3b'],
  [20, '#ffd84d', '#c98a00'],
  [80, '#ff6bd6', '#b0258f'],
  [Infinity, '#ff5a5a', '#a51d1d'],
];

export function gemTier(v: number) { for (let i = 0; i < GEM_TIERS.length; i++) if (v <= GEM_TIERS[i][0] * 1.0001) return i; return GEM_TIERS.length - 1; }

export function gem(tier: number): Sprite {
  const key = `g|${tier}`;
  let s = cache.get(key);
  if (s) return s;
  const size = 7 + tier * 1.6;
  const W = size * 2.2;
  const [c, g] = canvas(W, W);
  const [, light, dark] = GEM_TIERS[tier];
  const cx = W / 2, cy = W / 2;
  g.fillStyle = dark;
  g.beginPath(); g.moveTo(cx, cy - size); g.lineTo(cx + size * 0.7, cy); g.lineTo(cx, cy + size); g.lineTo(cx - size * 0.7, cy); g.closePath(); g.fill();
  g.fillStyle = light;
  g.beginPath(); g.moveTo(cx, cy - size * 0.8); g.lineTo(cx + size * 0.45, cy); g.lineTo(cx, cy + size * 0.2); g.lineTo(cx - size * 0.45, cy); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.beginPath(); g.arc(cx - size * 0.15, cy - size * 0.35, size * 0.12, 0, Math.PI * 2); g.fill();
  s = { c, w: W, h: W, ax: W / 2, ay: W / 2 };
  cache.set(key, s);
  return s;
}

export function coin(): Sprite {
  const key = 'coin';
  let s = cache.get(key);
  if (s) return s;
  const W = 16;
  const [c, g] = canvas(W, W);
  g.fillStyle = '#c98a00';
  g.beginPath(); g.arc(8, 8.6, 6.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd84d';
  g.beginPath(); g.arc(8, 8, 6.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e0a800'; g.lineWidth = 1;
  g.beginPath(); g.arc(8, 8, 4.4, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#9a6400';
  g.font = `900 7px ${UI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('₩', 8, 8.4);
  s = { c, w: W, h: W, ax: W / 2, ay: W / 2 };
  cache.set(key, s);
  return s;
}

export function shadow(radius: number): Sprite {
  const r = Math.round(radius);
  const key = `sh|${r}`;
  let s = cache.get(key);
  if (s) return s;
  const W = r * 2.4, H = r * 1.0;
  const [c, g] = canvas(W, H);
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0, 'rgba(0,0,0,.38)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.save(); g.translate(W / 2, H / 2); g.scale(1, H / W); g.beginPath(); g.arc(0, 0, W / 2, 0, Math.PI * 2); g.restore(); g.fill();
  s = { c, w: W, h: H, ax: W / 2, ay: H / 2 };
  cache.set(key, s);
  return s;
}

/** 부드러운 원형 빛. 내부 해상도는 고정(반지름 40u)이고 그릴 때 원하는 크기로 늘린다 → 캐시가 커지지 않는다. */
export function glow(color: string, radius: number): Sprite {
  const R = 40;
  const key = `gl|${color}`;
  let base = cache.get(key);
  if (!base) {
    const W = R * 2;
    const [c, g] = canvas(W, W);
    const grd = g.createRadialGradient(R, R, 0, R, R, R);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, W);
    base = { c, w: W, h: W, ax: R, ay: R };
    cache.set(key, base);
  }
  return { c: base.c, w: radius * 2, h: radius * 2, ax: radius, ay: radius };
}

/** (사용 안 함) 반지름별 원형 빛 */
function glowSized(color: string, radius: number): Sprite {
  const r = Math.round(radius);
  const key = `gls|${color}|${r}`;
  let s = cache.get(key);
  if (s) return s;
  const W = r * 2;
  const [c, g] = canvas(W, W);
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
  s = { c, w: W, h: W, ax: r, ay: r };
  cache.set(key, s);
  return s;
}

export function drawSprite(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1, flip = false) {
  if (flip) {
    g.save();
    g.translate(x, y);
    g.scale(-1, 1);
    g.drawImage(s.c, -s.ax * scale, -s.ay * scale, s.w * scale, s.h * scale);
    g.restore();
  } else {
    g.drawImage(s.c, x - s.ax * scale, y - s.ay * scale, s.w * scale, s.h * scale);
  }
}

export function drawSpriteRot(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, rot: number, scale = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.drawImage(s.c, -s.ax * scale, -s.ay * scale, s.w * scale, s.h * scale);
  g.restore();
}

void glowSized;
