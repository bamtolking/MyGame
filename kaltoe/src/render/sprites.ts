// 스프라이트 캐시: 이모지 적·말풍선·절차적 직장인·보석·코인·빛 등을 '실제 기기 픽셀 배율'로 오프스크린 캔버스에 미리 그린다.
// 게임 스프라이트는 모두 같은 배율 S(월드 1u → 기기 px)로 그려져 렌더러가 1:1 픽셀 정렬로 찍는다(흐림 없음·빠름).
// 캐시는 개수·픽셀 총량 제한이 있는 LRU. setSpriteScale/clearSpriteCache로 무효화된다.
import type { Look } from '../content/types';
import { BODY_FONT, DISPLAY_FONT } from '../ui/fonts';
import { alphaOf, mix, rgbOf, rgba, shade } from './color';

/** w,h: 월드 단위 크기, ax/ay: 앵커(월드 단위). u: 최근 사용 순번(LRU), t: 색 실루엣 파생본 */
export interface Sprite { c: HTMLCanvasElement; w: number; h: number; ax: number; ay: number; u?: number; t?: Map<string, Sprite> }

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color",sans-serif';
export const UI_FONT = BODY_FONT;
export { DISPLAY_FONT } from '../ui/fonts';

let S = 2;                       // 월드 1u → 기기 픽셀(스프라이트를 굽는 배율)
let want = 2;                    // 화면이 원하는 배율(작은 차이는 S를 그대로 두고 렌더러가 살짝 늘려 찍는다)
const cache = new Map<string, Sprite>();
const MAX_N = 1400;              // 개수 상한 — 넘으면(또는 픽셀 상한을 넘으면) 오래 안 쓴 것부터 70%까지 버린다
/** 픽셀 상한: 같은 월드 넓이라도 배율²만큼 픽셀이 늘어나므로 배율에 맞춘다(휴대폰 @2x 약 24MB · @3x 약 31MB · 태블릿 최대 64MB) */
const pxBudget = (s: number) => Math.min(16e6, Math.max(6e6, s * s * 1e6));
let MAX_PX = pxBudget(S);
let tick = 0, pixels = 0, gen = 0;
let emojiOk: boolean | null = null;
const POSE = [0, 1, 0, 3];       // 걷기 프레임 → 자세(0·2번은 같은 그림이라 한 장만 굽는다)

/** 글꼴이 늦게 도착했을 때(또는 배율이 바뀌었을 때·GPU 문맥을 잃었을 때) 캐시를 비운다. 버린 캔버스 메모리는 바로 돌려준다 */
export function clearSpriteCache() {
  for (const s of cache.values()) release(s);
  cache.clear(); pixels = 0; gen++;
}
/** 캐시를 비운 횟수(렌더러가 미리 굽기를 다시 할지 판단) */
export function spriteGen() { return gen; }

/** 배율은 화면 배율(zoom×dpr) — 렌더러가 스프라이트를 기기 픽셀 1:1로 찍을 수 있게.
 *  12% 안쪽의 작은 변화(주소창·툴바가 접히는 등)는 다시 굽지 않고(전체 재생성 50~140ms 끊김) 렌더러가 살짝 늘려 찍는다.
 *  미뤄 둔 차이는 syncSpriteScale()로 끊김이 안 보이는 때(일시정지·모달) 맞춘다. 다시 구웠으면 true */
export function setSpriteScale(s: number): boolean {
  want = Math.max(0.5, s);
  if (cache.size && Math.abs(want / S - 1) < 0.12) return false;
  return syncSpriteScale();
}
/** 미뤄 둔 배율 차이를 지금 맞춘다. 다시 구웠으면 true */
export function syncSpriteScale(): boolean {
  if (Math.abs(want - S) < 1e-9) return false;
  S = want; MAX_PX = pxBudget(S); clearSpriteCache();
  return true;
}
export function spriteScale() { return S; }

function area(s: Sprite) {
  let n = s.c.width * s.c.height;
  if (s.t) for (const v of s.t.values()) n += v.c.width * v.c.height;
  return n;
}
function release(s: Sprite) {
  free(s.c);
  if (s.t) for (const v of s.t.values()) free(v.c);
}
function hit(key: string): Sprite | undefined {
  const s = cache.get(key);
  if (s) s.u = ++tick;
  return s;
}
function put(key: string, s: Sprite): Sprite {
  s.u = ++tick;
  const old = cache.get(key);
  if (old) pixels -= area(old);
  cache.set(key, s);
  pixels += area(s);
  if (cache.size > MAX_N || pixels > MAX_PX) evict();
  return s;
}
/** 파생본(색 실루엣)을 붙였을 때: 원본을 방금 쓴 것으로 표시하고 픽셀 상한을 확인한다 */
function grow(owner: Sprite, n: number) {
  owner.u = ++tick;
  pixels += n;
  if (pixels > MAX_PX) evict();
}
/** 오래 안 쓴 것부터 픽셀·개수가 상한의 keep배 밑으로 내려갈 때까지 버린다(가득 찼을 때만 정렬하므로 평소 비용 없음).
 *  방금 쓴 것(u = tick)은 호출한 쪽이 아직 그리는 중이라 남긴다. 버린 캔버스는 메모리를 바로 돌려준다(iOS는 늦게 회수) */
function evict(keep = 0.7) {
  const arr = [...cache.entries()].sort((a, b) => (a[1].u ?? 0) - (b[1].u ?? 0));
  const tpx = MAX_PX * keep, tn = MAX_N * keep;
  for (const [key, s] of arr) {
    if (pixels <= tpx && cache.size <= tn) break;
    if (s.u === tick) continue;
    cache.delete(key); pixels -= area(s); release(s);
  }
  if (pixels < 0) pixels = 0;
}

/** 2D 문맥. 캔버스 메모리 한도(iOS Safari)에 걸려 null이면 캐시를 비워 메모리를 돌려받고 한 번 더 시도한다 */
function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  let g = c.getContext('2d');
  if (!g) { evict(0); g = c.getContext('2d'); }
  if (!g) throw new Error('sprite canvas: 2d context unavailable');
  return g;
}
function canvas(wu: number, hu: number, k = S): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(wu * k));
  c.height = Math.max(1, Math.ceil(hu * k));
  const g = ctx2d(c);
  g.scale(k, k);
  return [c, g];
}
function blank(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, ctx2d(c)];
}

export function emojiSupported(): boolean {
  if (emojiOk !== null) return emojiOk;
  try {
    const c2 = document.createElement('canvas'); c2.width = c2.height = 24;
    const gg = c2.getContext('2d', { willReadFrequently: true })!;
    gg.font = `20px ${EMOJI_FONT}`;
    gg.textBaseline = 'middle'; gg.textAlign = 'center';
    gg.fillText('😀', 12, 13);
    const d = gg.getImageData(0, 0, 24, 24).data;
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

/** 현재 변환(월드 단위)에서 (x,y) 중심에 이모지를 그린다 */
function drawEmoji(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) {
  if (emojiSupported()) {
    g.font = `${size}px ${EMOJI_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, x, y + size * 0.06);
  } else {
    g.fillStyle = hashColor(ch);
    g.beginPath(); g.arc(x, y, size * 0.45, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = size * 0.06; g.stroke();
  }
}

// ───────────── 실루엣 가공(외곽선·림라이트·음영) ─────────────

/** src의 모양대로 color로 채운 새 캔버스 */
function tintCanvas(src: HTMLCanvasElement, color: string, alpha = 1): HTMLCanvasElement {
  const [c, g] = blank(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** 다 쓴 임시 캔버스의 메모리를 바로 돌려준다(iOS Safari는 캔버스 메모리를 늦게 회수한다) */
function free(c: HTMLCanvasElement) { c.width = c.height = 0; }

/** 모양 가장자리의 초승달(dir 1 = 왼쪽 위, -1 = 오른쪽 아래)을 op로 얹는다 */
function crescent(g: CanvasRenderingContext2D, src: HTMLCanvasElement, color: string, wpx: number, dir: number, alpha: number, op: GlobalCompositeOperation) {
  const c = tintCanvas(src, color);
  const cg = c.getContext('2d')!;
  cg.globalCompositeOperation = 'destination-out';
  cg.drawImage(src, wpx * dir, wpx * dir);
  g.globalCompositeOperation = op; g.globalAlpha = alpha;
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  free(c);
}

export interface Dress {
  ow: number; outline: string;           // 외곽선 두께(월드 단위)·색
  outer?: string;                        // 바깥 테두리(금색 외곽선 밖의 짙은 선 등)
  rim?: string; rimA?: number; rimW?: number;     // 림라이트(왼쪽 위 가장자리, 가산)
  shadeC?: string; shadeA?: number; shadeW?: number; // 반대편 음영(오른쪽 아래)
}

/** 외곽선 + 림라이트 + 음영을 입힌 새 캔버스(원본은 가장자리 여백이 있어야 한다). k = px/월드 단위 */
export function dressCanvas(src: HTMLCanvasElement, d: Dress, k = S): HTMLCanvasElement {
  const [out, g] = blank(src.width, src.height);
  const ring = (color: string, r: number) => {
    const sil = tintCanvas(src, color);
    const n = r > 2.5 ? 16 : 12;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r); }
    if (r > 1.4) for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * Math.PI * 2; g.drawImage(sil, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); }
    free(sil);
  };
  const ow = Math.max(1, d.ow * k);
  if (d.outer) ring(d.outer, ow + Math.max(1, k * 0.7));
  ring(d.outline, ow);
  g.drawImage(src, 0, 0);
  if (d.shadeA) crescent(g, src, d.shadeC ?? '#000000', (d.shadeW ?? 1.3) * k, -1, d.shadeA, 'source-atop');
  if (d.rim) crescent(g, src, d.rim, (d.rimW ?? 1.1) * k, 1, d.rimA ?? 0.8, 'source-atop');
  return out;
}

/** 색 실루엣(흰 번쩍임·얼음 등). 원본 스프라이트에 붙여 두고 함께 버린다 */
export function tinted(s: Sprite, color: string): Sprite {
  let o = s.t?.get(color);
  if (o) return o;
  const c = tintCanvas(s.c, color);
  o = { c, w: s.w, h: s.h, ax: s.ax, ay: s.ay };
  (s.t ??= new Map()).set(color, o);
  grow(s, c.width * c.height);
  return o;
}
/** 큰 스프라이트(보스)용 색 실루엣: 반 해상도로 구워 메모리를 1/4로(단색 모양이라 늘려도 티가 안 난다).
 *  그릴 때 원본 캔버스 크기(s.c.width × s.c.height)로 늘려 찍는다 */
export function silhouette(s: Sprite, color: string): Sprite {
  const key = `${color}/2`;
  let o = s.t?.get(key);
  if (o) return o;
  const [c, g] = blank(Math.max(1, Math.ceil(s.c.width / 2)), Math.max(1, Math.ceil(s.c.height / 2)));
  g.drawImage(s.c, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  o = { c, w: s.w, h: s.h, ax: s.ax, ay: s.ay };
  (s.t ??= new Map()).set(key, o);
  grow(s, c.width * c.height);
  return o;
}
/** 하얗게 번쩍이는 실루엣 */
export function whiteOf(s: Sprite): Sprite { return tinted(s, '#ffffff'); }

/** 임의 그림 스프라이트(소품 등). draw는 월드 단위 좌표로 그린다 */
export function custom(key: string, wu: number, hu: number, ax: number, ay: number, draw: (g: CanvasRenderingContext2D) => void, d?: Dress): Sprite {
  const k = `c|${key}`;
  const s = hit(k);
  if (s) return s;
  const [c0, g] = canvas(wu, hu);
  draw(g);
  const c = d ? dressCanvas(c0, d) : c0;
  if (c !== c0) free(c0);
  return put(k, { c, w: wu, h: hu, ax, ay });
}

// ───────────── 이모지 ─────────────

/** 이모지 스프라이트. size = 글자 크기(월드 단위) */
export function emoji(ch: string, size: number): Sprite {
  const key = `e|${ch}|${size}`;
  const s = hit(key);
  if (s) return s;
  const pad = size * 0.2;
  const W = size + pad * 2;
  const [c, g] = canvas(W, W);
  drawEmoji(g, ch, W / 2, W / 2, size);
  return put(key, { c, w: W, h: W, ax: W / 2, ay: W / 2 });
}

/** 바닥 잡동사니: 채도·명도를 낮추고 바닥색에 물들여 배경으로 물러나게(명도 약 25%) */
export function decor(ch: string, size: number, tint: string): Sprite {
  const key = `d|${ch}|${size}|${tint}`;
  const s = hit(key);
  if (s) return s;
  const base = emoji(ch, size);
  const [c, g] = blank(base.c.width, base.c.height);
  g.drawImage(base.c, 0, 0);
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = '#808080'; g.globalAlpha = 0.75;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.55; g.fillStyle = tint;
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 0.35; g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  // 채도 합성은 투명한 곳까지 칠하므로 원래 모양으로 다시 오려 낸 뒤 살짝 투명하게
  g.globalCompositeOperation = 'destination-in';
  g.globalAlpha = 1; g.drawImage(base.c, 0, 0);
  g.globalAlpha = 0.8; g.fillRect(0, 0, c.width, c.height);
  return put(key, { c, w: base.w, h: base.h, ax: base.ax, ay: base.ay });
}

/** 이모지 적: 화난 눈 + 짙은 외곽선 + 근무지 조명색 림라이트 + 적 색 음영. 엘리트는 금색 외곽선 */
export function angry(ch: string, size: number, tint: string, rim = '#9fe6ff', elite = false): Sprite {
  const key = `a|${ch}|${size}|${tint}|${rim}|${elite ? 1 : 0}`;
  const s = hit(key);
  if (s) return s;
  const base = emoji(ch, size);
  const [c, g] = blank(base.c.width, base.c.height);
  g.drawImage(base.c, 0, 0);
  // 눈
  g.scale(S, S);
  const cx = base.w / 2, cy = base.h / 2 - size * 0.02;
  const ex = size * 0.17, er = size * 0.13;
  for (const sgn of [-1, 1]) {
    const x = cx + sgn * ex;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(x, cy, er, er * 1.1, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = size * 0.035; g.strokeStyle = '#141422'; g.stroke();
    g.fillStyle = '#141422';
    g.beginPath(); g.arc(x + size * 0.03, cy + er * 0.25, er * 0.54, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x + size * 0.03 - er * 0.2, cy + er * 0.05, er * 0.16, 0, Math.PI * 2); g.fill();
    // 눈썹(화남)
    g.strokeStyle = '#141422';
    g.lineWidth = size * 0.065; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - sgn * er * 1.15, cy - er * 1.6); g.lineTo(x + sgn * er * 0.9, cy - er * 0.95); g.stroke();
  }
  const ow = Math.max(1.1, Math.min(2, size * 0.05));
  const out = dressCanvas(c, elite
    ? { ow: ow * 1.15, outline: '#ffcf33', outer: '#1a1000', rim: '#ffe79a', rimA: 0.5, rimW: size * 0.06, shadeC: shade(tint, 0.3), shadeA: 0.3, shadeW: size * 0.08 }
    : { ow, outline: '#0a0c16', rim, rimA: 0.62, rimW: size * 0.06, shadeC: shade(tint, 0.28), shadeA: 0.32, shadeW: size * 0.08 });
  free(c);
  return put(key, { c: out, w: base.w, h: base.h, ax: base.ax, ay: base.ay });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export { roundRect };

/** 잔소리 말풍선 적 */
export function bubble(text: string, radius: number, tint = '#ff5a7a'): Sprite {
  const key = `b|${text}|${radius}|${tint}`;
  const s = hit(key);
  if (s) return s;
  const fs = Math.max(9, radius * 0.95);
  const mc = document.createElement('canvas').getContext('2d')!;
  mc.font = `900 ${fs}px ${UI_FONT}`;
  const tw = mc.measureText(text).width;
  const bw = Math.max(radius * 2.2, tw + fs * 1.1), bh = fs * 1.9;
  const W = bw + 8, H = bh + fs * 0.7 + 8;
  const [c, g] = canvas(W, H);
  g.translate(4, 4);
  const lw = Math.max(1.5, fs * 0.16);
  // 짙은 바깥 테두리(어두운 바닥에서도 또렷하게)
  g.lineJoin = 'round';
  g.strokeStyle = '#0a0c16'; g.lineWidth = lw + 2.4;
  roundRect(g, 0, 0, bw, bh, bh * 0.45); g.stroke();
  g.beginPath(); g.moveTo(bw * 0.3, bh - 1); g.lineTo(bw * 0.24, bh + fs * 0.6); g.lineTo(bw * 0.45, bh - 1); g.stroke();
  g.fillStyle = '#ffffff';
  g.strokeStyle = tint; g.lineWidth = lw;
  roundRect(g, 0, 0, bw, bh, bh * 0.45); g.fill(); g.stroke();
  // 꼬리
  g.beginPath();
  g.moveTo(bw * 0.3, bh - 1); g.lineTo(bw * 0.24, bh + fs * 0.6); g.lineTo(bw * 0.45, bh - 1);
  g.closePath(); g.fillStyle = '#fff'; g.fill();
  g.beginPath(); g.moveTo(bw * 0.3, bh); g.lineTo(bw * 0.24, bh + fs * 0.6); g.lineTo(bw * 0.45, bh); g.stroke();
  // 윗면 광택
  g.fillStyle = 'rgba(0,0,0,.07)';
  roundRect(g, lw, bh * 0.55, bw - lw * 2, bh * 0.45 - lw, bh * 0.3); g.fill();
  g.fillStyle = '#22223a';
  g.font = `900 ${fs}px ${UI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, bw / 2, bh / 2 + fs * 0.05);
  return put(key, { c, w: W, h: H, ax: W / 2, ay: H * 0.45 });
}

// ───────────── 절차적 직장인(플레이어) ─────────────

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }

function drawHairBack(g: CanvasRenderingContext2D, look: Look, hx: number, hy: number, hr: number) {
  if (look.hairStyle !== 'long' && look.hairStyle !== 'bob') return;
  g.fillStyle = shade(look.hair, 0.8);
  const down = look.hairStyle === 'long' ? 1.55 : 0.62;
  g.beginPath();
  g.arc(hx, hy, hr * 1.13, Math.PI * 0.92, Math.PI * 2.08);
  g.lineTo(hx + hr * 1.12, hy + hr * down);
  g.quadraticCurveTo(hx, hy + hr * (down + 0.25), hx - hr * 1.16, hy + hr * down);
  g.closePath(); g.fill();
}

function drawHairFront(g: CanvasRenderingContext2D, look: Look, hx: number, hy: number, hr: number) {
  g.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 'bald':
      g.beginPath(); g.ellipse(hx - hr * 0.78, hy + hr * 0.05, hr * 0.28, hr * 0.42, 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.ellipse(hx - hr * 0.25, hy - hr * 0.6, hr * 0.32, hr * 0.14, -0.4, 0, Math.PI * 2); g.fill();
      return;
    case 'short':
      g.beginPath(); g.arc(hx, hy - hr * 0.06, hr * 1.05, Math.PI * 1.0, Math.PI * 2.0); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(hx - hr * 0.05, hy - hr * 0.5, hr * 0.95, hr * 0.46, -0.12, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(hx - hr * 0.82, hy - hr * 0.05, hr * 0.3, hr * 0.5, 0.15, 0, Math.PI * 2); g.fill();
      break;
    case 'spiky':
      g.beginPath();
      g.moveTo(hx - hr * 1.06, hy - hr * 0.02);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * 1.02 + (i / 8) * Math.PI * 0.98;
        const r = i % 2 ? hr * 1.4 : hr * 1.02;
        g.lineTo(hx + Math.cos(a) * r, hy - hr * 0.12 + Math.sin(a) * r);
      }
      g.lineTo(hx + hr * 1.02, hy - hr * 0.1);
      g.closePath(); g.fill();
      break;
    case 'bob':
    case 'long':
      g.beginPath(); g.arc(hx, hy - hr * 0.04, hr * 1.08, Math.PI * 1.0, Math.PI * 2.0); g.closePath(); g.fill();
      // 옆으로 넘긴 앞머리
      g.beginPath();
      g.moveTo(hx - hr * 1.05, hy - hr * 0.1);
      g.quadraticCurveTo(hx - hr * 0.2, hy - hr * 0.9, hx + hr * 0.95, hy - hr * 0.25);
      g.quadraticCurveTo(hx + hr * 0.1, hy - hr * 0.55, hx - hr * 0.6, hy + hr * 0.25);
      g.closePath(); g.fill();
      g.beginPath(); g.ellipse(hx - hr * 0.86, hy + hr * 0.2, hr * 0.3, hr * 0.62, 0.1, 0, Math.PI * 2); g.fill();
      break;
    case 'bun':
      g.beginPath(); g.arc(hx - hr * 0.15, hy - hr * 1.12, hr * 0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(hx, hy - hr * 0.06, hr * 1.05, Math.PI * 1.0, Math.PI * 2.0); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(hx - hr * 0.1, hy - hr * 0.48, hr * 0.92, hr * 0.4, -0.1, 0, Math.PI * 2); g.fill();
      break;
  }
  // 머리카락 윤기
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = hr * 0.13; g.lineCap = 'round';
  g.beginPath(); g.arc(hx - hr * 0.1, hy - hr * 0.05, hr * 0.78, Math.PI * 1.18, Math.PI * 1.42); g.stroke();
}

function limb(g: CanvasRenderingContext2D, x: number, y: number, ang: number, sleeve: string, skin: string, cuff: string): [number, number] {
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.fillStyle = sleeve; roundRect(g, -2.15, -0.8, 4.3, 8.6, 2.1); g.fill();
  g.fillStyle = cuff; g.fillRect(-2.15, 6.3, 4.3, 1.1);
  g.fillStyle = skin; circle(g, 0, 8.9, 2.15); g.fill();
  g.restore();
  return [x - Math.sin(ang) * 8.9, y + Math.cos(ang) * 8.9];
}

/** frame 0..3 = 걷기 프레임. 오른쪽을 바라보는 그림(왼쪽은 좌우 반전). res = 픽셀 배율(기본: 게임 배율) */
export function worker(look: Look, frame: number, size = 34, res = S): Sprite {
  const f = POSE[frame & 3];
  const key = `w|${look.skin}|${look.hair}|${look.hairStyle}|${look.suit}|${look.tie}|${look.accessory ?? ''}|${look.glasses ? 1 : 0}|${f}|${size}|${res}`;
  const s = hit(key);
  if (s) return s;
  const DW = 40, DH = 43;          // 설계 격자(크기 34 기준)
  const k = size / 34;
  const W = DW * k, H = DH * k;
  const [c0, g] = canvas(W, H, res);
  g.scale(k, k);
  const cx = 20;
  const sw = [0, 1, 0, -1][f];
  const bob = f & 1 ? -0.8 : 0;
  const suitD = shade(look.suit, 0.6);
  const skinD = shade(look.skin, 0.8);
  // 뒷팔
  g.translate(0, bob);
  limb(g, cx - 6.9, 23.6, 0.3 + sw * 0.42, suitD, skinD, shade(look.suit, 0.45));
  g.translate(0, -bob);
  // 다리·구두
  const legY = 32.6;
  for (const [lx, ph] of [[cx - 4.5, sw], [cx + 0.7, -sw]] as const) {
    const ox = ph * 1.6;
    g.fillStyle = '#20233a'; roundRect(g, lx + ox, legY, 3.9, 5.4, 1.3); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(lx + ox + 2.6, legY + 0.4, 1.2, 4.6);
    g.fillStyle = '#101119'; roundRect(g, lx + ox - 0.3, legY + 4.5, 5.4, 2.5, 1.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(lx + ox + 0.8, legY + 4.9, 2.6, 0.5);
  }
  g.translate(0, bob);
  // 몸통(재킷) + 음영
  roundRect(g, cx - 8.2, 22.2, 16.4, 11.8, 4.8);
  g.fillStyle = look.suit; g.fill();
  g.save(); g.clip();
  g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(cx + 3.4, 21, 6, 14);
  g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(cx - 9, 31.4, 18, 3);
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(cx - 7.4, 23.4, 1.3, 7.6);
  g.restore();
  // 셔츠·칼라·라펠
  g.fillStyle = '#f3f5fb';
  g.beginPath(); g.moveTo(cx - 3.7, 22.3); g.lineTo(cx + 3.7, 22.3); g.lineTo(cx, 27.9); g.closePath(); g.fill();
  g.strokeStyle = suitD; g.lineWidth = 0.75;
  g.beginPath(); g.moveTo(cx - 3.8, 22.5); g.lineTo(cx - 1.1, 28.6); g.moveTo(cx + 3.8, 22.5); g.lineTo(cx + 1.1, 28.6); g.stroke();
  // 넥타이
  g.fillStyle = look.tie;
  g.beginPath(); g.moveTo(cx - 1.35, 22.6); g.lineTo(cx + 1.35, 22.6); g.lineTo(cx + 0.9, 24.3); g.lineTo(cx - 0.9, 24.3); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - 0.95, 24.1); g.lineTo(cx + 0.95, 24.1); g.lineTo(cx + 1.8, 29.8); g.lineTo(cx, 31.5); g.lineTo(cx - 1.8, 29.8); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.beginPath(); g.moveTo(cx, 24.1); g.lineTo(cx + 0.95, 24.1); g.lineTo(cx + 1.8, 29.8); g.lineTo(cx, 31.5); g.closePath(); g.fill();
  g.fillStyle = suitD; circle(g, cx + 2.8, 29.6, 0.45); g.fill(); circle(g, cx + 2.8, 31.7, 0.45); g.fill();
  // 앞팔(+소품 든 손)
  const [hx0, hy0] = limb(g, cx + 7, 23.5, -0.3 - sw * 0.42, look.suit, look.skin, suitD);
  // 머리
  const hx = cx + 0.8, hy = 15, hr = 9.3;
  drawHairBack(g, look, hx, hy, hr);
  g.fillStyle = skinD; circle(g, hx - 7.3, hy + 1.7, 2.2); g.fill();
  g.fillStyle = look.skin; circle(g, hx, hy, hr); g.fill();
  // 얼굴 음영(오른쪽 아래 초승달)
  g.fillStyle = 'rgba(120,50,30,.13)';
  g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.arc(hx - 1.6, hy - 2.1, hr, 0, Math.PI * 2, true); g.fill('evenodd');
  drawHairFront(g, look, hx, hy, hr);
  // 눈(오른쪽 바라봄)
  const ey = hy + 1.9;
  for (const ex of [hx + 1.9, hx + 6.3]) {
    g.fillStyle = '#1b1830';
    g.beginPath(); g.ellipse(ex, ey, 1.28, 1.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    circle(g, ex - 0.35, ey - 0.65, 0.55); g.fill();
    circle(g, ex + 0.4, ey + 0.6, 0.25); g.fill();
    g.strokeStyle = shade(look.hair === '#e0b84a' ? '#8a6a20' : look.hair, 0.9); g.lineWidth = 0.8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ex - 1.2, ey - 3.1); g.lineTo(ex + 1.1, ey - 3.35); g.stroke();
  }
  g.fillStyle = 'rgba(255,100,120,.45)';
  g.beginPath(); g.ellipse(hx + 0.2, hy + 5, 1.9, 1.05, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(hx + 7.7, hy + 4.8, 1.1, 0.9, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#5a2626'; g.lineWidth = 0.8;
  g.beginPath(); g.arc(hx + 4.2, hy + 5, 1.25, 0.25, Math.PI - 0.25); g.stroke();
  if (look.glasses) {
    g.fillStyle = 'rgba(170,220,255,.18)';
    circle(g, hx + 1.9, ey, 2.35); g.fill(); circle(g, hx + 6.4, ey, 2.2); g.fill();
    g.strokeStyle = '#14141e'; g.lineWidth = 0.75;
    circle(g, hx + 1.9, ey, 2.35); g.stroke(); circle(g, hx + 6.4, ey, 2.2); g.stroke();
    g.beginPath(); g.moveTo(hx + 4.25, ey - 0.2); g.lineTo(hx + 4.2, ey - 0.2); g.moveTo(hx - 0.45, ey - 0.3); g.lineTo(hx - 3.2, ey - 0.8); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(hx + 0.9, ey - 1.2); g.lineTo(hx + 1.6, ey - 1.8); g.stroke();
  }
  if (look.accessory) drawEmoji(g, look.accessory, hx0 + 1.2, hy0 - 0.2, 9.5);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // 짙은 외곽선 바깥에 따뜻한 빛 테두리를 한 겹 더 둘러 어두운 바닥에서도 실루엣이 또렷하게
  const c = dressCanvas(c0, { ow: 1.2 * k, outline: '#0a0d1a', outer: '#b8a488', rim: '#fff0cc', rimA: 0.42, rimW: 0.95 * k, shadeA: 0.16, shadeW: 1.4 * k }, res);
  free(c0);
  return put(key, { c, w: W, h: H, ax: W / 2, ay: H * 0.64 });
}

/** 사람형 적(상사·친척): 이모지 얼굴 + 정장 몸통 + 외곽선·림라이트. 오른쪽을 보는 그림만 굽는다(왼쪽은 렌더러가 찍을 때 좌우 반전) */
export function person(face: string, suit: string, tie: string, radius: number, frame: number, rim = '#ff6a5a'): Sprite {
  const f = POSE[frame & 3];
  const key = `p|${face}|${suit}|${tie}|${radius}|${f}|${rim}`;
  const s = hit(key);
  if (s) return s;
  const size = radius * 2.4;
  const W = size * 1.1, H = size * 1.38;
  const [c0, g] = canvas(W, H);
  const k = size / 34;
  const cx = W / 2;
  g.save();
  g.scale(k, k);
  const x = cx / k;
  const step = [0, 2, 0, -2][f];
  const suitD = shade(suit, 0.6);
  // 다리·구두
  for (const [lx, ph] of [[x - 6.2, step], [x + 1.2, -step]] as const) {
    g.fillStyle = '#1f2233'; roundRect(g, lx + ph * 0.5, 34, 5, 9.5, 1.4); g.fill();
    g.fillStyle = '#0f1018'; roundRect(g, lx - 0.7 + ph * 0.5, 42, 7, 2.9, 1.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(lx + 0.6 + ph * 0.5, 42.5, 3.4, 0.6);
  }
  // 팔
  for (const sgn of [-1, 1]) {
    g.fillStyle = sgn < 0 ? suitD : suit;
    roundRect(g, x + sgn * 12.2 - 2.6, 21.5 + (sgn * step) * 0.3, 5.2, 12, 2.5); g.fill();
    g.fillStyle = '#e8c3a0'; circle(g, x + sgn * 12.2, 34 + (sgn * step) * 0.3, 2.5); g.fill();
  }
  // 몸통
  roundRect(g, x - 12, 20, 24, 16.5, 5.5);
  g.fillStyle = suit; g.fill();
  g.save(); g.clip();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 5, 19, 8, 19);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x - 11, 21.5, 1.6, 12);
  g.restore();
  g.fillStyle = '#f3f5fb';
  g.beginPath(); g.moveTo(x - 4.8, 20); g.lineTo(x + 4.8, 20); g.lineTo(x, 26.5); g.closePath(); g.fill();
  g.strokeStyle = suitD; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(x - 4.9, 20.2); g.lineTo(x - 1.4, 27.6); g.moveTo(x + 4.9, 20.2); g.lineTo(x + 1.4, 27.6); g.stroke();
  g.fillStyle = tie;
  g.beginPath(); g.moveTo(x - 1.7, 21.4); g.lineTo(x + 1.7, 21.4); g.lineTo(x + 2.5, 31); g.lineTo(x, 33.6); g.lineTo(x - 2.5, 31); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.beginPath(); g.moveTo(x, 21.4); g.lineTo(x + 1.7, 21.4); g.lineTo(x + 2.5, 31); g.lineTo(x, 33.6); g.closePath(); g.fill();
  g.restore();
  // 얼굴
  drawEmoji(g, face, cx, 13 * k + 2, radius * 1.45);
  const c = dressCanvas(c0, { ow: Math.max(1.3, radius * 0.07), outline: '#08090f', rim, rimA: 0.7, rimW: radius * 0.08, shadeA: 0.22, shadeW: radius * 0.1 });
  free(c0);
  return put(key, { c, w: W, h: H, ax: W / 2, ay: H * 0.55 });
}

// ───────────── 픽업 ─────────────

const GEM_TIERS: [number, string, string][] = [
  [1, '#5ad1ff', '#1b6fd1'],
  [5, '#7dff8a', '#169c35'],
  [20, '#ffd84d', '#c07c00'],
  [80, '#ff6bd6', '#a8208a'],
  [Infinity, '#ff5a5a', '#9e1a1a'],
];

export function gemTier(v: number) { for (let i = 0; i < GEM_TIERS.length; i++) if (v <= GEM_TIERS[i][0] * 1.0001) return i; return GEM_TIERS.length - 1; }
export function gemColor(tier: number) { return GEM_TIERS[Math.max(0, Math.min(GEM_TIERS.length - 1, tier))][1]; }

/** 경험치 보석: 깎인 면 + 외곽선 + 은은한 후광(블룸 없는 저품질에서도 반짝이게) */
export function gem(tier: number): Sprite {
  const key = `g|${tier}`;
  const s = hit(key);
  if (s) return s;
  const size = 6 + tier * 1.5;
  const W = size * 3.3;
  const [c0, g] = canvas(W, W);
  const [, light, dark] = GEM_TIERS[tier];
  const cx = W / 2, cy = W / 2;
  const T: [number, number] = [cx, cy - size], R: [number, number] = [cx + size * 0.66, cy - size * 0.12];
  const B: [number, number] = [cx, cy + size], L: [number, number] = [cx - size * 0.66, cy - size * 0.12];
  const M: [number, number] = [cx - size * 0.05, cy - size * 0.02];
  const tri = (a: [number, number], b: [number, number], c: [number, number], col: string) => { g.fillStyle = col; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill(); };
  tri(T, R, M, light);
  tri(T, L, M, mix(light, '#ffffff', 0.45));
  tri(L, B, M, mix(light, dark, 0.45));
  tri(R, B, M, dark);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath(); g.moveTo(cx - size * 0.12, cy - size * 0.74); g.lineTo(cx - size * 0.4, cy - size * 0.18); g.lineTo(cx - size * 0.2, cy - size * 0.2); g.closePath(); g.fill();
  circle(g, cx + size * 0.2, cy + size * 0.3, size * 0.08); g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const c = dressCanvas(c0, { ow: 0.75, outline: '#070914' });
  free(c0);
  const gg = c.getContext('2d')!;
  gg.globalCompositeOperation = 'destination-over';
  const R0 = size * 1.6 * S, [r, gr, b] = rgbOf(light);
  const grd = gg.createRadialGradient(cx * S, cy * S, 0, cx * S, cy * S, R0);
  grd.addColorStop(0, rgba([r, gr, b], 0.42)); grd.addColorStop(0.45, rgba([r, gr, b], 0.14)); grd.addColorStop(1, rgba([r, gr, b], 0));
  gg.fillStyle = grd; gg.fillRect(0, 0, c.width, c.height);
  return put(key, { c, w: W, h: W, ax: W / 2, ay: W / 2 });
}

export function coin(): Sprite {
  const key = 'coin';
  const s = hit(key);
  if (s) return s;
  const W = 17;
  const [c0, g] = canvas(W, W);
  const x = W / 2, y = W / 2;
  g.fillStyle = '#8a5200'; circle(g, x, y + 0.7, 6.5); g.fill();
  g.fillStyle = '#ffc233'; circle(g, x, y, 6.3); g.fill();
  g.fillStyle = '#ffdc6e'; circle(g, x - 0.3, y - 0.3, 4.9); g.fill();
  g.strokeStyle = '#d99a12'; g.lineWidth = 0.9; circle(g, x, y, 4.9); g.stroke();
  g.fillStyle = '#8a5600';
  g.font = `900 7.4px ${UI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('₩', x, y + 0.4);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.1; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y, 5.4, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const c = dressCanvas(c0, { ow: 0.7, outline: '#1a0e00' });
  free(c0);
  return put(key, { c, w: W, h: W, ax: W / 2, ay: W / 2 });
}

/** 접지 그림자(발밑 타원) */
export function shadow(radius: number): Sprite {
  const r = Math.round(radius);
  const key = `sh|${r}`;
  const s = hit(key);
  if (s) return s;
  const W = r * 2.6, H = r * 1.05;
  const [c, g] = canvas(W, H);
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0, 'rgba(0,0,0,.6)');
  grd.addColorStop(0.55, 'rgba(0,0,0,.34)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.save(); g.translate(W / 2, H / 2); g.scale(1, H / W); g.beginPath(); g.arc(0, 0, W / 2, 0, Math.PI * 2); g.restore(); g.fill();
  return put(key, { c, w: W, h: H, ax: W / 2, ay: H / 2 });
}

/** 부드러운 원형 빛(가우스형 감쇠). 내부 해상도는 고정이고 그릴 때 원하는 크기로 늘린다 → 캐시가 커지지 않는다. */
export function glow(color: string, radius: number): Sprite {
  const key = `gl|${color}`;
  let base = hit(key);
  if (!base) {
    const P = 96, R = P / 2;
    const [c, g] = blank(P, P);
    const rgb = rgbOf(color), a = alphaOf(color);
    const grd = g.createRadialGradient(R, R, 0, R, R, R);
    grd.addColorStop(0, rgba(rgb, a));
    grd.addColorStop(0.2, rgba(rgb, a * 0.74));
    grd.addColorStop(0.42, rgba(rgb, a * 0.38));
    grd.addColorStop(0.68, rgba(rgb, a * 0.12));
    grd.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, P, P);
    base = put(key, { c, w: P, h: P, ax: R, ay: R });
  }
  return { c: base.c, w: radius * 2, h: radius * 2, ax: radius, ay: radius };
}

/** 적 탄: 짙은 테두리 + 형광 분홍 몸통 + 흰 심 + 후광 — 어두운 바닥에서 한눈에 '위험' */
export function ebullet(r: number): Sprite {
  const rr = Math.max(2, Math.round(r * 2) / 2);
  const key = `eb|${rr}`;
  const s = hit(key);
  if (s) return s;
  const W = rr * 5.6 + 2;
  const [c, g] = canvas(W, W);
  const x = W / 2;
  const grd = g.createRadialGradient(x, x, rr * 0.5, x, x, rr * 2.8);
  grd.addColorStop(0, 'rgba(255,46,138,.55)'); grd.addColorStop(0.5, 'rgba(255,46,138,.18)'); grd.addColorStop(1, 'rgba(255,46,138,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, W);
  g.fillStyle = 'rgba(24,0,14,.92)'; circle(g, x, x, rr + 1.6); g.fill();
  g.fillStyle = '#ff2e8a'; circle(g, x, x, rr + 0.7); g.fill();
  g.fillStyle = '#ff9fd2'; circle(g, x, x, rr * 0.72); g.fill();
  g.fillStyle = '#ffffff'; circle(g, x - rr * 0.1, x - rr * 0.1, rr * 0.4); g.fill();
  return put(key, { c, w: W, h: W, ax: W / 2, ay: W / 2 });
}

/** 이모지 적 탄: 분홍 외곽선으로 위험 표시 */
export function danger(ch: string, size: number): Sprite {
  const key = `dg|${ch}|${size}`;
  const s = hit(key);
  if (s) return s;
  const base = emoji(ch, size);
  const c = dressCanvas(base.c, { ow: 1.1, outline: '#ff2e8a', outer: '#1a0010', rim: '#ffd0e6', rimA: 0.5 });
  return put(key, { c, w: base.w, h: base.h, ax: base.ax, ay: base.ay });
}

/** 네 갈래 반짝임(가산 합성용) */
export function spark(): Sprite {
  const key = 'spark';
  const s = hit(key);
  if (s) return s;
  const W = 20, x = 10;
  const [c, g] = canvas(W, W);
  const grd = g.createRadialGradient(x, x, 0, x, x, 6);
  grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, W);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(x, 0); g.lineTo(x + 1, x - 1); g.lineTo(W, x); g.lineTo(x + 1, x + 1);
  g.lineTo(x, W); g.lineTo(x - 1, x + 1); g.lineTo(0, x); g.lineTo(x - 1, x - 1); g.closePath(); g.fill();
  return put(key, { c, w: W, h: W, ax: x, ay: x });
}

/** 위로 뻗는 빛기둥(상자 등). 바닥 중앙이 앵커 */
export function lightBeam(color: string): Sprite {
  const key = `lb|${color}`;
  const s = hit(key);
  if (s) return s;
  const W = 36, H = 150;
  const [c, g] = canvas(W, H, Math.min(S, 2));
  const rgb = rgbOf(color);
  const hg = g.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, rgba(rgb, 0)); hg.addColorStop(0.35, rgba(rgb, 0.5)); hg.addColorStop(0.5, rgba(rgbOf(mix(color, '#ffffff', 0.6)), 0.95));
  hg.addColorStop(0.65, rgba(rgb, 0.5)); hg.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = hg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.7, 'rgba(0,0,0,.55)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return put(key, { c, w: W, h: H, ax: W / 2, ay: H - 4 });
}

/** 보스 명판 */
export function nameplate(text: string, color: string): Sprite {
  const key = `np|${text}|${color}`;
  const s = hit(key);
  if (s) return s;
  const fs = 9;
  const mc = document.createElement('canvas').getContext('2d')!;
  mc.font = `${fs}px ${DISPLAY_FONT}`;
  const tw = mc.measureText(text).width;
  const bw = tw + 22, bh = 14;
  const W = bw + 4, H = bh + 4;
  const [c, g] = canvas(W, H);
  g.translate(2, 2);
  g.fillStyle = 'rgba(10,8,18,.88)';
  roundRect(g, 0, 0, bw, bh, 4); g.fill();
  g.strokeStyle = color; g.lineWidth = 1.2;
  roundRect(g, 0.6, 0.6, bw - 1.2, bh - 1.2, 3.5); g.stroke();
  g.fillStyle = color;
  g.beginPath(); g.moveTo(5, bh / 2); g.lineTo(8, bh / 2 - 3); g.lineTo(11, bh / 2); g.lineTo(8, bh / 2 + 3); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(2, 1.5, bw - 4, 4);
  g.fillStyle = '#ffffff';
  g.font = `${fs}px ${DISPLAY_FONT}`;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(text, 14, bh / 2 + 0.6);
  return put(key, { c, w: W, h: H, ax: W / 2, ay: H / 2 });
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
