// 근무지 환경(야근 네온): 바닥 타일 + 절차적 소품(책상·파티션·서버랙·불판·병풍·등불…) + 소품 광원.
// 바닥은 근무지·배율별로 한 번만 그린 반복 타일을 기기 픽셀 1:1로 깐다(패턴 채우기보다 훨씬 싸고 선명).
// 소품은 월드 격자 칸마다 해시로 정해지고(판정 없음), 명도 15~30%로 무대 뒤에 물러나 있으며 화면·등불 같은 광원만 빛난다.
import type { StageDef, StagePalette } from '../content/types';
import { custom, decor as decorSprite, DISPLAY_FONT, roundRect, spriteScale, type Sprite } from './sprites';
import { hexA, mix, shade } from './color';
import type { View } from './fx';

export interface EnvLight { x: number; y: number; r: number; color: string; a: number; flick: number }

export interface EnvStyle {
  floor: 'carpet' | 'server' | 'wood' | 'jangpan';
  rim: string;        // 적 림라이트(근무지 조명색)
  neon: string;       // 주 네온색
  neon2: string;      // 보조 강조색
  ambient: string;    // 어둠 색(조명 레이어)
  dark: number;       // 기본 어둠 정도(0..1)
  lamp: string;       // 플레이어 주변의 따뜻한 빛
  props: string[];    // 소품 종류(중복 = 가중치)
}

const STYLES: Record<string, EnvStyle> = {
  office: { floor: 'carpet', rim: '#8febff', neon: '#3de0ff', neon2: '#ffd84d', ambient: '#050914', dark: 0.3, lamp: '#ffd9a8', props: ['desk', 'desk', 'desk', 'lampdesk', 'partition', 'partition', 'plant', 'plant', 'cooler', 'cabinet', 'cables'] },
  crunch: { floor: 'server', rim: '#86d8ff', neon: '#38bdf8', neon2: '#a3ff5c', ambient: '#01030a', dark: 0.38, lamp: '#ffe6c4', props: ['rack', 'rack', 'rack', 'rackrow', 'rackrow', 'nightdesk', 'nightdesk', 'tray', 'boxes'] },
  dinner: { floor: 'wood', rim: '#ffb27a', neon: '#ff8a3d', neon2: '#ff4d4d', ambient: '#0d0402', dark: 0.28, lamp: '#ffcf9a', props: ['grill', 'grill', 'grill', 'grill', 'crate', 'stools', 'sign'] },
  holiday: { floor: 'jangpan', rim: '#ffdc8f', neon: '#ffcf5a', neon2: '#e03a3a', ambient: '#0a0603', dark: 0.3, lamp: '#ffd592', props: ['soban', 'soban', 'soban', 'lantern', 'lantern', 'lantern', 'folding', 'folding', 'cushions', 'jars'] },
};

export const DEFAULT_ENV: EnvStyle = STYLES.office;

const fallback = new Map<string, EnvStyle>();
/** 근무지 → 환경 스타일(모르는 근무지는 팔레트에서 만든다) */
export function envOf(st: StageDef): EnvStyle {
  const s = STYLES[st.id];
  if (s) return s;
  let f = fallback.get(st.id);
  if (!f) {
    const p = st.palette;
    f = { floor: 'carpet', rim: mix(p.accent, '#ffffff', 0.45), neon: p.accent, neon2: '#ffd84d', ambient: shade(p.fog, 0.5), dark: 0.36, lamp: '#ffd9a8', props: STYLES.office.props };
    fallback.set(st.id, f);
  }
  return f;
}

function rng(seed: number) {
  let s = (seed >>> 0) % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function hash2(x: number, y: number, salt: number) {
  let h = (x * 73856093) ^ (y * 19349663) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x2c1b3c6d);
  return (h ^ (h >>> 15)) >>> 0;
}

// ───────────── 바닥 타일 ─────────────

const TW = 384;                       // 반복 타일 한 변(월드 단위)
const tiles = new Map<string, { c: HTMLCanvasElement; tw: number }>();

/** 타일 모서리를 넘는 둥근 얼룩은 반대편에도 그려 이음새가 안 보이게 */
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  for (const ox of [-TW, 0, TW]) for (const oy of [-TW, 0, TW]) {
    const cx = x + ox, cy = y + oy;
    if (cx + r < 0 || cx - r > TW || cy + r < 0 || cy - r > TW) continue;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
function dots(g: CanvasRenderingContext2D, r: () => number, n: number, light: string, dark: string, sz = 0.9) {
  for (let k = 0; k < n; k++) { g.fillStyle = r() < 0.5 ? light : dark; g.fillRect(r() * TW, r() * TW, sz, sz); }
}

function floorCarpet(g: CanvasRenderingContext2D, p: StagePalette, r: () => number) {
  const tl = 64, n = TW / tl;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const alt = (i + j) & 1, x = i * tl, y = j * tl;
    g.fillStyle = shade(alt ? p.floorAlt : p.floor, 0.93 + r() * 0.12);
    g.fillRect(x, y, tl, tl);
    // 카펫 결: 타일마다 방향이 엇갈리는 가는 줄
    g.fillStyle = alt ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.09)';
    for (let k = 1.4; k < tl; k += 2.6) { if (alt) g.fillRect(x, y + k, tl, 0.9); else g.fillRect(x + k, y, 0.9, tl); }
  }
  dots(g, r, 2600, 'rgba(255,255,255,.05)', 'rgba(0,0,0,.2)');
  for (let k = 0; k < 5; k++) blob(g, r() * TW, r() * TW, 9 + r() * 16, 'rgba(0,0,0,.14)');
  for (let k = 0; k < n; k++) {
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(k * tl, 0, 1.1, TW); g.fillRect(0, k * tl, TW, 1.1);
    g.fillStyle = hexA(p.line, 0.35); g.fillRect(k * tl + 1.1, 0, 0.7, TW); g.fillRect(0, k * tl + 1.1, TW, 0.7);
  }
}

function floorServer(g: CanvasRenderingContext2D, p: StagePalette, st: EnvStyle, r: () => number) {
  const tl = 64, n = TW / tl;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * tl, y = j * tl;
    const vent = r() < 0.22;
    g.fillStyle = shade((i + j) & 1 ? p.floorAlt : p.floor, 0.94 + r() * 0.1);
    g.fillRect(x, y, tl, tl);
    // 베벨(윗왼쪽 밝게·아래오른쪽 어둡게)
    g.fillStyle = 'rgba(255,255,255,.055)'; g.fillRect(x + 1.6, y + 1.6, tl - 3.2, 1.1); g.fillRect(x + 1.6, y + 1.6, 1.1, tl - 3.2);
    g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(x + 1.6, y + tl - 2.7, tl - 3.2, 1.1); g.fillRect(x + tl - 2.7, y + 1.6, 1.1, tl - 3.2);
    if (vent) {
      g.fillStyle = hexA(st.neon, 0.05); g.fillRect(x + 7, y + 7, tl - 14, tl - 14);
      g.fillStyle = 'rgba(0,0,0,.55)';
      for (let a = x + 10; a < x + tl - 8; a += 4.4) for (let b = y + 10; b < y + tl - 8; b += 4.4) { g.beginPath(); g.arc(a, b, 0.95, 0, Math.PI * 2); g.fill(); }
    } else {
      for (const [a, b] of [[5, 5], [tl - 5, 5], [5, tl - 5], [tl - 5, tl - 5]]) {
        g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(x + a, y + b, 1.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + a - 0.8, y + b - 0.15, 1.6, 0.3);
      }
      if (r() < 0.12) {   // 케이블 구멍
        g.fillStyle = 'rgba(0,0,0,.55)'; roundRect(g, x + 18, y + 26, 28, 10, 3); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 0.6;
        for (let a = x + 20; a < x + 44; a += 1.6) { g.beginPath(); g.moveTo(a, y + 27); g.lineTo(a + 0.6, y + 35); g.stroke(); }
      }
    }
  }
  dots(g, r, 1300, 'rgba(255,255,255,.035)', 'rgba(0,0,0,.18)');
  for (let k = 0; k < n; k++) {
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(k * tl - 0.4, 0, 1.2, TW); g.fillRect(0, k * tl - 0.4, TW, 1.2);
    g.fillStyle = hexA(st.neon, 0.07); g.fillRect(k * tl + 0.8, 0, 0.5, TW); g.fillRect(0, k * tl + 0.8, TW, 0.5);
  }
}

function floorWood(g: CanvasRenderingContext2D, p: StagePalette, r: () => number) {
  const rows = 18, ph = TW / rows;
  g.fillStyle = shade(p.floor, 0.55); g.fillRect(0, 0, TW, TW);
  for (let j = 0; j < rows; j++) {
    let x = -r() * 120;
    const y = j * ph;
    while (x < TW) {
      const len = 70 + r() * 110;
      const tone = shade(r() < 0.5 ? p.floor : p.floorAlt, 0.84 + r() * 0.3);
      const grain = [0, 1, 2, 3].map(() => [0.5 + r() * 1.3, 0.015 + r() * 0.03, r() * 6]);
      const knot = r() < 0.3 ? [0.15 + r() * 0.7, 2.6 + r() * 1.8] : null;
      for (const ox of [-TW, 0, TW]) {
        const xx = x + ox;
        if (xx + len < 0 || xx > TW) continue;
        g.fillStyle = tone; g.fillRect(xx + 0.6, y + 0.6, len - 1.2, ph - 1.2);
        g.fillStyle = 'rgba(255,230,200,.045)'; g.fillRect(xx + 0.6, y + 0.6, len - 1.2, 1);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(xx + 0.6, y + ph - 2, len - 1.2, 1.4);
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 0.6;
        grain.forEach(([a, f, s], k) => {
          const gy = y + 3 + k * (ph - 6) / 3;
          g.beginPath(); g.moveTo(xx + 1, gy + Math.sin(s) * a);
          for (let t = 8; t < len - 1; t += 8) g.lineTo(xx + t, gy + Math.sin(s + t * f * 6) * a);
          g.stroke();
        });
        if (knot) {
          const kx = xx + knot[0] * len, ky = y + ph * 0.5;
          g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(kx, ky, knot[1], knot[1] * 0.55, 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(kx, ky, knot[1] * 1.8, knot[1] * 0.95, 0, 0, Math.PI * 2); g.stroke();
        }
      }
      x += len;
    }
  }
  dots(g, r, 900, 'rgba(255,220,180,.035)', 'rgba(0,0,0,.2)');
  for (let k = 0; k < 6; k++) blob(g, r() * TW, r() * TW, 10 + r() * 20, 'rgba(0,0,0,.16)');     // 기름·양념 자국
  for (let k = 0; k < 3; k++) blob(g, r() * TW, r() * TW, 16 + r() * 18, 'rgba(255,140,60,.035)');
}

function floorJangpan(g: CanvasRenderingContext2D, p: StagePalette, r: () => number) {
  const tl = 48, n = TW / tl;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * tl, y = j * tl;
    g.fillStyle = shade(mix(p.floor, p.floorAlt, r()), 0.95 + r() * 0.22);
    g.fillRect(x, y, tl, tl);
    // 기름 먹인 장판의 윤기(칸마다 한쪽으로 비끼는 밝은 결)
    const sh = g.createLinearGradient(x, y, x + tl, y + tl);
    sh.addColorStop(0, 'rgba(255,210,140,.06)'); sh.addColorStop(0.5, 'rgba(255,210,140,0)'); sh.addColorStop(1, 'rgba(0,0,0,.08)');
    g.fillStyle = sh; g.fillRect(x, y, tl, tl);
    g.strokeStyle = 'rgba(255,225,170,.04)'; g.lineWidth = 0.5;
    for (let k = 0; k < 36; k++) {        // 한지 섬유
      const a = r() * Math.PI, fx = x + r() * tl, fy = y + r() * tl, l = 2 + r() * 5;
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l); g.stroke();
    }
  }
  for (let k = 0; k < 14; k++) blob(g, r() * TW, r() * TW, 20 + r() * 34, 'rgba(0,0,0,.09)');
  for (let k = 0; k < 6; k++) blob(g, r() * TW, r() * TW, 24 + r() * 30, 'rgba(255,200,120,.035)');
  dots(g, r, 900, 'rgba(255,230,180,.03)', 'rgba(0,0,0,.14)');
  // 겹쳐 바른 장판지 이음새: 밝은 가장자리 + 그 옆 그림자
  for (let k = 0; k < n; k++) {
    g.fillStyle = 'rgba(255,220,160,.14)'; g.fillRect(k * tl, 0, 0.9, TW); g.fillRect(0, k * tl, TW, 0.9);
    g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(k * tl + 0.9, 0, 1.1, TW); g.fillRect(0, k * tl + 0.9, TW, 1.1);
  }
}

/** 근무지 바닥 타일(배율별로 한 번). 기기 픽셀 크기는 정수, tw = 그 월드 크기 */
export function floorTile(st: StageDef): { c: HTMLCanvasElement; tw: number } {
  const S = spriteScale();
  const key = `${st.id}|${st.palette.floor}|${st.palette.floorAlt}|${S}`;
  let t = tiles.get(key);
  if (t) return t;
  const N = Math.max(64, Math.round(TW * S));
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.scale(N / TW, N / TW);
  const style = envOf(st);
  const r = rng(st.id.length * 7919 + 17);
  if (style.floor === 'server') floorServer(g, st.palette, style, r);
  else if (style.floor === 'wood') floorWood(g, st.palette, r);
  else if (style.floor === 'jangpan') floorJangpan(g, st.palette, r);
  else floorCarpet(g, st.palette, r);
  if (tiles.size >= 2) tiles.delete(tiles.keys().next().value!);
  t = { c, tw: N / S };
  tiles.set(key, t);
  return t;
}

// ───────────── 소품 ─────────────

type Pt = [number, number];
function ell(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 0) { g.fillStyle = fill; if (r) { roundRect(g, x, y, w, h, r); g.fill(); } else g.fillRect(x, y, w, h); }
function glowDisc(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color: string, a: number) {
  const grd = g.createRadialGradient(x, y, 0, x, y, rad);
  grd.addColorStop(0, hexA(color, a)); grd.addColorStop(0.5, hexA(color, a * 0.35)); grd.addColorStop(1, hexA(color, 0));
  g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function screen(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, v: number) {
  const grd = g.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, mix(color, '#ffffff', 0.25)); grd.addColorStop(1, shade(color, 0.55));
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,.28)';
  for (let k = 0; k < 5; k++) g.fillRect(x + 2, y + 2.2 + k * (h - 3) / 5, (w - 4) * (0.45 + ((v * 7 + k * 3) % 5) / 10), 0.9);
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, w, 1.2);
}
function chair(g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  g.strokeStyle = '#0c0e13'; g.lineWidth = 1.4;
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + 0.3; g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + Math.cos(a) * 8, y + 8 + Math.sin(a) * 3.5); g.stroke(); }
  ell(g, x, y + 3, 9, 5, shade(c, 0.8));
  rect(g, x - 9, y - 9, 18, 11, c, 4);
  rect(g, x - 7, y - 7.5, 14, 1.2, 'rgba(255,255,255,.07)');
}
function paper(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, fill: string) {
  g.save(); g.translate(x, y); g.rotate(rot);
  rect(g, -w / 2, -h / 2, w, h, fill);
  g.fillStyle = 'rgba(0,0,0,.22)';
  for (let k = 0; k < 4; k++) g.fillRect(-w / 2 + 1.5, -h / 2 + 2 + k * 3, w * 0.7, 0.6);
  g.restore();
}
function postit(g: CanvasRenderingContext2D, x: number, y: number, s: number, c: string, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot);
  rect(g, -s / 2, -s / 2, s, s, c);
  rect(g, -s / 2, s / 2 - s * 0.22, s, s * 0.22, 'rgba(0,0,0,.2)');
  g.restore();
}
function shadowEll(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.4) {
  const grd = g.createRadialGradient(x, y, 0, x, y, rx);
  grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(0.7, `rgba(0,0,0,${a * 0.5})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, rx, 0, Math.PI * 2); g.fill();
  g.restore();
}

function rackBody(g: CanvasRenderingContext2D, x: number, y: number, v: number) {
  rect(g, x, y, 36, 8, '#1a2236', 1.5);
  rect(g, x, y + 8, 36, 62, '#0b101b');
  rect(g, x + 1, y + 8, 2.2, 62, '#182033'); rect(g, x + 32.8, y + 8, 2.2, 62, '#182033');
  for (let k = 0; k < 9; k++) {
    const uy = y + 11 + k * 6.3;
    rect(g, x + 4.5, uy, 27, 5, (k + v) % 3 ? '#131a2a' : '#161f33');
    g.fillStyle = '#070a12';
    for (let s = 0; s < 6; s++) g.fillRect(x + 6 + s * 2.4, uy + 1.2, 1.2, 2.6);
    rect(g, x + 26, uy + 1.6, 4, 1.8, '#0a0f1a');
  }
  rect(g, x, y + 8, 36, 1.2, 'rgba(255,255,255,.08)');
  // 앞유리에 비친 냉기(청록)와 윗면 조명 줄
  rect(g, x + 3.5, y + 9.5, 29, 59, 'rgba(56,189,248,.05)');
  rect(g, x + 4, y + 3.2, 28, 1.4, 'rgba(120,220,255,.45)', 0.7);
}
function rackLeds(x: number, y: number, v: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < 9; k++) {
    const uy = y + 11 + k * 6.3 + 2.4;
    out.push([x + 27, uy, (k * 3 + v) % 7]);
    if ((k + v) % 2) out.push([x + 29.6, uy, (k * 5 + v + 2) % 7]);
    if ((k + v) % 3 === 0) out.push([x + 8 + ((k * 7 + v) % 4) * 3, uy, (k + v + 4) % 7]);
  }
  return out;
}

interface PropDef {
  w: number; h: number; ax: number; ay: number; variants: number;
  draw(g: CanvasRenderingContext2D, v: number, st: EnvStyle): void;
  lights(v: number, st: EnvStyle): EnvLight[];
  leds?(v: number): [number, number, number][];          // 깜빡이는 LED(로컬 좌표, 위상)
  smoke?: Pt[];                                           // 연기 나는 곳
}
const L = (x: number, y: number, r: number, color: string, a: number, flick = 0): EnvLight => ({ x, y, r, color, a, flick });
const SCREENS = ['#3de0ff', '#6f9bff', '#cfe0ff'];

const PROPS: Record<string, PropDef> = {
  // ── 사무실 ──
  desk: {
    w: 86, h: 74, ax: 43, ay: 44, variants: 3,
    draw(g, v) {
      shadowEll(g, 43, 50, 46, 12, 0.45);
      rect(g, 5, 14, 76, 30, '#353e4d', 2.5);
      rect(g, 5, 14, 76, 1.4, 'rgba(255,255,255,.08)');
      rect(g, 5, 43, 76, 7, '#212733');
      rect(g, 7, 49, 4, 6, '#161a22'); rect(g, 75, 49, 4, 6, '#161a22');
      // 모니터(시청자 쪽을 향함)
      rect(g, 39, 18, 8, 6, '#0d1017'); rect(g, 34, 22.5, 18, 2.4, '#0d1017', 1);
      rect(g, 26, 1, 34, 21, '#0b0e15', 2);
      screen(g, 28, 3, 30, 16, SCREENS[v % 3], v);
      postit(g, 58.5, 4.5, 5, '#c9ad3e', 0.15); postit(g, 58, 10, 4.6, '#b85f7c', -0.1);
      // 키보드·마우스
      rect(g, 32, 28, 22, 6.5, '#1a1f29', 1.4);
      g.fillStyle = '#2b3240';
      for (let a = 0; a < 9; a++) for (let b = 0; b < 3; b++) g.fillRect(33.3 + a * 2.3, 29.1 + b * 1.8, 1.6, 1.1);
      ell(g, 60, 31, 2.2, 3, '#1a1f29');
      // 서류·머그
      paper(g, 15, 28, 15, 19, -0.12 + v * 0.05, '#474d59');
      paper(g, 17, 26, 15, 19, 0.08, '#51586a');
      ell(g, 70, 24, 4, 4, '#4f3434'); ell(g, 70, 23.6, 2.8, 2.8, '#1e120c');
      chair(g, 43, 62, '#1c212b');
    },
    lights: v => [L(0, -32, 74, SCREENS[v % 3], 0.5, 0.15)],
  },
  lampdesk: {
    w: 86, h: 74, ax: 43, ay: 44, variants: 2,
    draw(g, v) {
      shadowEll(g, 43, 50, 46, 12, 0.45);
      rect(g, 5, 14, 76, 30, '#3a3a42', 2.5);
      glowDisc(g, 22, 28, 30, '#ffc98a', 0.28);
      rect(g, 5, 43, 76, 7, '#24242b');
      rect(g, 7, 49, 4, 6, '#16161b'); rect(g, 75, 49, 4, 6, '#16161b');
      // 노트북
      rect(g, 42, 16, 28, 17, '#0c0e14', 2); screen(g, 44, 18, 24, 13, SCREENS[(v + 1) % 3], v);
      rect(g, 40, 32, 32, 6, '#20242d', 1.5);
      // 스탠드
      ell(g, 15, 36, 5, 2.4, '#1a1a20');
      g.strokeStyle = '#2a2a33'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(15, 36); g.lineTo(11, 22); g.lineTo(20, 14); g.stroke();
      ell(g, 21, 15, 5, 3, '#34343e'); ell(g, 21.5, 17, 3.4, 1.4, '#ffe2b0');
      paper(g, 30, 36, 12, 9, 0.2, '#4b505b');
      postit(g, 76, 20, 5, '#c9ad3e', -0.2);
      chair(g, 50, 62, '#20242e');
    },
    lights: () => [L(-24, -24, 80, '#ffc98a', 0.62, 0.05), L(12, -30, 46, SCREENS[1], 0.3)],
  },
  partition: {
    w: 124, h: 46, ax: 62, ay: 36, variants: 3,
    draw(g, v) {
      shadowEll(g, 62, 40, 62, 7, 0.5);
      rect(g, 4, 10, 116, 28, '#27303e');
      g.fillStyle = 'rgba(255,255,255,.025)';
      for (let x = 6; x < 118; x += 2.2) g.fillRect(x, 11, 0.8, 26);
      rect(g, 4, 36, 116, 2.5, '#1b212c');
      rect(g, 2, 6, 120, 5, '#465062', 1.5); rect(g, 2, 6, 120, 1.2, '#5f6a7e');
      for (const x of [2, 60, 118]) rect(g, x, 6, 4, 32, '#3a4353');
      const cols = ['#c9ad3e', '#b85f7c', '#3fa6b8', '#7bb04a'];
      const r = rng(v * 131 + 7);
      for (let k = 0; k < 5; k++) postit(g, 12 + r() * 100, 16 + r() * 14, 6.5, cols[(k + v) % 4], (r() - 0.5) * 0.4);
      rect(g, 70 + v * 6, 14, 14, 11, '#4a505c'); rect(g, 71 + v * 6, 15, 12, 3, '#6a3a3a');
    },
    lights: () => [],
  },
  plant: {
    w: 46, h: 58, ax: 23, ay: 48, variants: 2,
    draw(g, v) {
      shadowEll(g, 23, 51, 17, 5, 0.5);
      const leaves = ['#1b3627', '#21432f', '#285238', '#1e3d2b'];
      const r = rng(v * 17 + 3);
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k - 4) * 0.34 + (r() - 0.5) * 0.2, len = 15 + r() * 9;
        g.save(); g.translate(23, 36); g.rotate(a + Math.PI / 2);
        ell(g, 0, -len * 0.6, 5.2, len * 0.55, leaves[k % 4]);
        g.strokeStyle = 'rgba(160,220,170,.14)'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -len * 1.05); g.stroke();
        g.restore();
      }
      rect(g, 13, 38, 20, 14, '#523125', 3); rect(g, 11, 36, 24, 4.5, '#65402f', 2);
      rect(g, 13, 44, 20, 1, 'rgba(0,0,0,.25)');
    },
    lights: () => [],
  },
  cooler: {
    w: 34, h: 60, ax: 17, ay: 52, variants: 1,
    draw(g) {
      shadowEll(g, 17, 54, 14, 4.5, 0.5);
      rect(g, 6, 26, 22, 28, '#353d4b', 2); rect(g, 6, 26, 22, 1.2, 'rgba(255,255,255,.08)');
      rect(g, 9, 30, 16, 9, '#232a35', 1.5);
      ell(g, 13, 34, 1.6, 1.6, '#b33a3a'); ell(g, 21, 34, 1.6, 1.6, '#3a6fb3');
      rect(g, 8, 4, 18, 23, '#2c6690', 7);
      rect(g, 10, 12, 14, 13, 'rgba(120,200,255,.25)', 4);
      rect(g, 11, 6, 3, 16, 'rgba(255,255,255,.25)', 1.5);
      rect(g, 12, 1.5, 10, 4, '#23527a', 1.5);
    },
    lights: () => [L(0, -30, 44, '#4db8ff', 0.4, 0.05)],
  },
  cabinet: {
    w: 36, h: 56, ax: 18, ay: 48, variants: 1,
    draw(g) {
      shadowEll(g, 18, 50, 18, 5, 0.5);
      rect(g, 3, 4, 30, 9, '#3b4351', 1.5);
      rect(g, 3, 13, 30, 37, '#2a303b');
      for (let k = 0; k < 3; k++) {
        const y = 15 + k * 11.6;
        rect(g, 5, y, 26, 10, '#313846', 1);
        rect(g, 14, y + 2, 8, 1.8, '#5a6272', 0.8);
        rect(g, 15, y + 5, 6, 2.6, '#454c5a');
      }
    },
    lights: () => [],
  },
  cables: {
    w: 96, h: 40, ax: 48, ay: 20, variants: 2,
    draw(g, v) {
      const r = rng(v * 29 + 11);
      for (let k = 0; k < 3; k++) {
        const y0 = 6 + r() * 26, y1 = 6 + r() * 26;
        g.strokeStyle = '#101319'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, y0); g.bezierCurveTo(30, y0 - 12 + r() * 24, 60, y1 - 12 + r() * 24, 44, 20); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 0.6; g.stroke();
      }
      rect(g, 34, 15, 30, 9, '#2a2f38', 2);
      for (let k = 0; k < 4; k++) rect(g, 38 + k * 5.5, 17.5, 3.4, 4, '#14171d', 1);
      ell(g, 61, 19.5, 1.2, 1.2, '#ff4b4b');
    },
    lights: () => [L(13, 0, 18, '#ff3b3b', 0.45, 0.1)],
  },
  // ── 서버실 ──
  rack: {
    w: 40, h: 80, ax: 20, ay: 72, variants: 3,
    draw(g, v) { shadowEll(g, 20, 74, 24, 6, 0.55); rackBody(g, 2, 2, v); },
    lights: () => [L(0, -34, 64, '#38bdf8', 0.55, 0.1)],
    leds: v => rackLeds(2, 2, v),
  },
  rackrow: {
    w: 118, h: 80, ax: 59, ay: 72, variants: 2,
    draw(g, v) { shadowEll(g, 59, 74, 64, 7, 0.55); for (let k = 0; k < 3; k++) rackBody(g, 2 + k * 38, 2, v + k); },
    lights: () => [L(-38, -34, 62, '#38bdf8', 0.52, 0.1), L(38, -34, 62, '#a3ff5c', 0.42, 0.1)],
    leds: v => [0, 1, 2].flatMap(k => rackLeds(2 + k * 38, 2, v + k)),
  },
  nightdesk: {
    w: 92, h: 74, ax: 46, ay: 44, variants: 2,
    draw(g, v) {
      shadowEll(g, 46, 50, 48, 12, 0.5);
      rect(g, 5, 14, 82, 30, '#232a3a', 2.5);
      rect(g, 5, 43, 82, 7, '#161b27');
      for (const [x, c] of [[16, '#a3ff5c'], [50, '#38bdf8']] as const) {
        rect(g, x + 10, 18, 7, 6, '#090c12');
        rect(g, x, 1, 28, 19, '#080b11', 2);
        g.fillStyle = shade(c, 0.35); g.fillRect(x + 2, 3, 24, 15);
        g.fillStyle = c;
        const r = rng(x + v);
        for (let k = 0; k < 6; k++) g.fillRect(x + 3 + r() * 4, 4.2 + k * 2.3, 6 + r() * 14, 0.9);
      }
      // 피자 상자·에너지 음료
      rect(g, 58, 26, 22, 14, '#5e4428', 1.5); rect(g, 60, 28, 18, 10, '#6e5230', 1);
      g.fillStyle = '#8a6a34'; g.beginPath(); g.moveTo(62, 37); g.lineTo(69, 29); g.lineTo(75, 37); g.closePath(); g.fill();
      ell(g, 14, 32, 3, 3, '#2e6f42'); ell(g, 21, 34, 3, 3, '#6f2a45');
      rect(g, 30, 29, 22, 6, '#141925', 1.4);
      chair(g, 40, 62, '#181d28');
    },
    lights: () => [L(-16, -32, 60, '#a3ff5c', 0.4, 0.2), L(18, -32, 60, '#38bdf8', 0.42, 0.2)],
  },
  tray: {
    w: 110, h: 30, ax: 55, ay: 15, variants: 2,
    draw(g, v) {
      rect(g, 2, 8, 106, 14, '#0c111b', 2);
      const cols = ['#2a4a7a', '#6a6a3a', '#3a4254', '#284a4a', '#4a2a4a'];
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = cols[(k + v) % 5]; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(4, 10.5 + k * 2.3); g.bezierCurveTo(40, 9 + k * 2.6, 70, 13 + k * 2, 106, 10.5 + k * 2.3); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(2, 8.5); g.lineTo(108, 8.5); g.stroke();
    },
    lights: () => [],
  },
  boxes: {
    w: 58, h: 56, ax: 29, ay: 48, variants: 2,
    draw(g, v) {
      shadowEll(g, 29, 50, 28, 6, 0.5);
      const box = (x: number, y: number, w: number, h: number) => {
        rect(g, x, y, w, 7, '#5a4630', 1); rect(g, x, y + 7, w, h, '#46361f');
        rect(g, x + w / 2 - 2, y, 4, h + 7, '#6a5838');
        rect(g, x, y + 7, w, 1, 'rgba(0,0,0,.3)');
      };
      box(4, 26, 30, 20); box(30, 30, 24, 16); box(10 + v * 4, 6, 26, 18);
    },
    lights: () => [],
  },
  // ── 회식 ──
  grill: {
    w: 96, h: 78, ax: 48, ay: 40, variants: 3,
    draw(g, v) {
      shadowEll(g, 48, 50, 46, 16, 0.5);
      for (const [x, y] of [[12, 62], [84, 62], [48, 12]] as Pt[]) { ell(g, x, y + 2, 8, 4, '#1a0c0a'); ell(g, x, y, 8, 5, '#3b1916'); }
      ell(g, 48, 44, 40, 24, '#1f1714');
      ell(g, 48, 40, 40, 24, '#2c231f');
      ell(g, 48, 40, 37.5, 22, '#352a25');
      // 불판 + 숯불
      ell(g, 48, 40, 16, 10.5, '#121010');
      const grd = g.createRadialGradient(48, 40, 0, 48, 40, 13);
      grd.addColorStop(0, '#ffcf7a'); grd.addColorStop(0.35, '#ff8a3d'); grd.addColorStop(0.75, '#8a2a10'); grd.addColorStop(1, '#2a0c06');
      g.save(); g.translate(48, 40); g.scale(1, 0.66); g.translate(-48, -40);
      g.fillStyle = grd; g.beginPath(); g.arc(48, 40, 13, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(20,14,12,.85)'; g.lineWidth = 0.9;
      for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(48 + k * 3, 32); g.lineTo(48 + k * 3, 48); g.stroke(); }
      // 고기(삼겹살)
      for (let k = 0; k < 3; k++) {
        rect(g, 39 + k * 6.4, 35 + (k % 2) * 3, 4.6, 9, '#8a4f45', 1.5);
        rect(g, 39.8 + k * 6.4, 36 + (k % 2) * 3, 1, 7, '#b88a78');
      }
      // 반찬 그릇·소주
      const dishes = ['#6b2a20', '#2e4a2a', '#3a2a1a', '#6b5a2a', '#2e4a2a'];
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * 0.15 + k * Math.PI * 0.34 + v * 0.2;
        const x = 48 + Math.cos(a) * 28, y = 40 + Math.sin(a) * 15;
        ell(g, x, y, 5, 3.4, '#4a4440'); ell(g, x, y - 0.3, 3.8, 2.4, dishes[k]);
      }
      rect(g, 72, 22, 5.4, 13, '#2a5a3a', 2); rect(g, 73, 17, 3.4, 6, '#2a5a3a', 1); rect(g, 72, 27, 5.4, 4, '#b5b09a');
      ell(g, 25, 26, 2.4, 1.8, '#9aa3a8'); ell(g, 31, 24, 2.4, 1.8, '#9aa3a8');
    },
    lights: () => [L(0, 0, 84, '#ff8a3d', 0.66, 0.5)],
    smoke: [[0, -4]],
  },
  crate: {
    w: 44, h: 42, ax: 22, ay: 34, variants: 2,
    draw(g) {
      shadowEll(g, 22, 36, 22, 6, 0.5);
      rect(g, 3, 8, 38, 26, '#5e5220', 2);
      rect(g, 3, 8, 38, 4, '#716428', 2);
      g.fillStyle = '#3e3614';
      for (let x = 6; x < 38; x += 5.4) g.fillRect(x, 16, 3.2, 14);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) { ell(g, 9 + a * 8.7, 7 + b * 4, 3, 2.2, '#1e4a2c'); ell(g, 9 + a * 8.7, 6.4 + b * 4, 1.4, 1, '#3a7a50'); }
    },
    lights: () => [],
  },
  stools: {
    w: 48, h: 40, ax: 24, ay: 30, variants: 2,
    draw(g, v) {
      shadowEll(g, 24, 32, 22, 6, 0.5);
      for (let k = 0; k < 3; k++) {
        const x = 10 + k * 14 + v * 2, y = 26 - (k === 1 ? 6 : 0);
        rect(g, x - 5, y - 2, 10, 8, '#2a1210', 1.5);
        ell(g, x, y - 2, 7.5, 4.2, '#4a1c18'); ell(g, x - 1.5, y - 3, 3, 1.2, 'rgba(255,255,255,.08)');
      }
    },
    lights: () => [],
  },
  sign: {
    w: 42, h: 58, ax: 21, ay: 52, variants: 1,
    draw(g) {
      shadowEll(g, 21, 53, 18, 5, 0.5);
      g.strokeStyle = '#2a1c16'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(7, 54); g.lineTo(12, 6); g.moveTo(35, 54); g.lineTo(30, 6); g.stroke();
      rect(g, 6, 6, 30, 40, '#16100e', 2); rect(g, 6, 6, 30, 40, 'rgba(255,90,70,.06)', 2);
      g.strokeStyle = '#3a2a22'; g.lineWidth = 1.2; roundRect(g, 6, 6, 30, 40, 2); g.stroke();
      glowDisc(g, 21, 24, 20, '#ff4d4d', 0.3);
      g.fillStyle = '#ff6a58'; g.font = `8px ${DISPLAY_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('삼겹살', 21, 17); g.fillText('소주', 21, 28);
      g.fillStyle = '#ffd29a'; g.fillRect(12, 36, 18, 1.2); g.fillRect(12, 39, 12, 1.2);
    },
    lights: () => [L(0, -28, 50, '#ff4d4d', 0.5, 0.3)],
  },
  // ── 명절 한옥 ──
  soban: {
    w: 76, h: 56, ax: 38, ay: 34, variants: 3,
    draw(g, v) {
      shadowEll(g, 38, 42, 38, 11, 0.5);
      g.strokeStyle = '#24160c'; g.lineWidth = 2.2;
      for (const [x0, x1] of [[10, 7], [66, 69]]) { g.beginPath(); g.moveTo(x0, 36); g.quadraticCurveTo(x0 + (x1 - x0) * 3, 42, x1, 46); g.stroke(); }
      rect(g, 4, 34, 68, 6, '#2a1a0e', 2);
      rect(g, 4, 10, 68, 26, '#3a2414', 5);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.6;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(8, 14 + k * 4.5); g.bezierCurveTo(28, 12 + k * 4.5, 48, 17 + k * 4.5, 68, 14 + k * 4.5); g.stroke(); }
      rect(g, 4, 10, 68, 1.3, 'rgba(255,220,170,.1)', 1);
      // 전 접시
      ell(g, 22, 22, 11, 6.5, '#4a4540'); ell(g, 22, 21.6, 9.5, 5.4, '#5a534c');
      for (let k = 0; k < 4; k++) ell(g, 17 + k * 3.4, 21.2 + (k % 2) * 1.6, 3, 2, '#8a6630');
      // 송편
      ell(g, 50, 19, 8, 5, '#4a4540');
      const sp = ['#6a8a6a', '#8a6a7a', '#8a8a6a'];
      for (let k = 0; k < 5; k++) ell(g, 46 + (k % 3) * 3.6, 17.6 + Math.floor(k / 3) * 2.8, 2.2, 1.5, sp[(k + v) % 3]);
      // 과일
      ell(g, 58, 29, 7, 4, '#4a4540');
      ell(g, 55.5, 28, 2.6, 2.4, '#a0602a'); ell(g, 60, 28.5, 2.6, 2.4, '#8a2a2a'); ell(g, 57.8, 26.4, 2.4, 2.2, '#b08030');
      ell(g, 37, 29, 2.4, 1.8, '#6a6660');
    },
    lights: () => [],
  },
  lantern: {
    w: 40, h: 72, ax: 20, ay: 64, variants: 2,
    draw(g, v) {
      shadowEll(g, 20, 65, 13, 4, 0.5);
      glowDisc(g, 20, 28, 20, '#ffcf5a', 0.3);
      rect(g, 13, 62, 14, 4, '#24160c', 1.5);
      rect(g, 19, 8, 2.2, 56, '#2a1a10');
      rect(g, 10, 5, 20, 3, '#3a2414', 1);
      // 청사초롱: 위 붉은 비단·아래 푸른 비단, 속불
      rect(g, 11, 14, 18, 22, v ? '#7a1c1c' : '#8a2020', 4);
      rect(g, 11, 28, 18, 8, v ? '#1e2c62' : '#20306a', 3);
      rect(g, 13, 17, 14, 14, 'rgba(255,210,120,.55)', 4);
      rect(g, 15, 19, 10, 9, 'rgba(255,240,190,.55)', 3);
      rect(g, 10, 12.5, 20, 2.5, '#b08a3a', 1); rect(g, 10, 35.5, 20, 2.5, '#b08a3a', 1);
      g.strokeStyle = '#a02a2a'; g.lineWidth = 1;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(16 + k * 4, 38); g.lineTo(16 + k * 4, 46); g.stroke(); }
    },
    lights: () => [L(0, -40, 88, '#ffcf5a', 0.7, 0.35)],
  },
  folding: {
    w: 116, h: 64, ax: 58, ay: 54, variants: 2,
    draw(g, v) {
      shadowEll(g, 58, 56, 58, 7, 0.5);
      for (let k = 0; k < 4; k++) {
        const x = 4 + k * 27, lift = k % 2 ? 3 : 0;
        rect(g, x, 6 + lift, 27, 48, '#3e1612');
        rect(g, x + 2.5, 9 + lift, 22, 42, k % 2 ? '#2e2618' : '#342b1c');
        // 산수화 붓질
        g.strokeStyle = 'rgba(40,56,40,.8)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x + 3, 40 + lift); g.quadraticCurveTo(x + 10, 24 + lift - (k + v) % 3 * 3, x + 16, 36 + lift); g.quadraticCurveTo(x + 20, 30 + lift, x + 24, 38 + lift); g.stroke();
        if ((k + v) % 3 === 1) ell(g, x + 17, 17 + lift, 3, 3, '#8a7a4a');
        rect(g, x, 6 + lift, 27, 1.4, '#6a2a1e');
      }
    },
    lights: () => [],
  },
  cushions: {
    w: 66, h: 44, ax: 33, ay: 24, variants: 2,
    draw(g, v) {
      const cols = ['#5a1a1a', '#1c2a5a', '#5a4a1a'];
      for (let k = 0; k < 3; k++) {
        const x = 6 + k * 19, y = 10 + (k % 2) * 8;
        shadowEll(g, x + 9, y + 18, 11, 4, 0.45);
        rect(g, x, y, 18, 17, cols[(k + v) % 3], 4);
        g.strokeStyle = 'rgba(200,160,80,.35)'; g.lineWidth = 0.9;
        g.beginPath(); g.arc(x + 9, y + 8.5, 4.4, 0, Math.PI * 2); g.stroke();
        rect(g, x + 1, y + 1, 16, 1.4, 'rgba(255,255,255,.07)', 1);
      }
    },
    lights: () => [],
  },
  jars: {
    w: 56, h: 50, ax: 28, ay: 42, variants: 2,
    draw(g, v) {
      shadowEll(g, 28, 44, 26, 6, 0.5);
      const jar = (x: number, y: number, s: number) => {
        ell(g, x, y, 10 * s, 12 * s, '#2e1c10');
        ell(g, x - 3 * s, y - 4 * s, 3 * s, 5 * s, 'rgba(255,200,140,.08)');
        ell(g, x, y - 11 * s, 6 * s, 2.4 * s, '#3e2816');
        ell(g, x, y - 12 * s, 4.6 * s, 1.6 * s, '#24160c');
      };
      jar(18, 30, 1); jar(38 - v * 2, 32, 0.8); jar(30, 16, 0.6);
    },
    lights: () => [],
  },
};

/** 소품 스프라이트(근무지·종류·변형별 캐시) */
function propSprite(kind: string, v: number, st: EnvStyle): Sprite {
  const d = PROPS[kind];
  return custom(`prop|${kind}|${v}|${st.neon}`, d.w, d.h, d.ax, d.ay, g => d.draw(g, v, st));
}

export interface Placed {
  kind: string; v: number; x: number; y: number; seed: number;
  lights: EnvLight[];                 // 월드 좌표
  emoji?: string; size?: number;      // 바닥 잡동사니(스테이지 decor 이모지)
}

const CELL = 240;
const placed = new Map<string, Placed[]>();

/** 격자 칸의 소품·잡동사니(해시로 결정, 칸별 캐시) */
function cellItems(st: StageDef, style: EnvStyle, cx: number, cy: number): Placed[] {
  const key = `${st.id}|${cx}|${cy}`;
  let list = placed.get(key);
  if (list) return list;
  list = [];
  const h = hash2(cx, cy, 0x5bd1e995 ^ st.id.length * 131);
  if (h % 100 < 70) {
    const kind = style.props[(h >>> 7) % style.props.length];
    const d = PROPS[kind];
    const m = 58;
    const x = cx * CELL + m + ((h >>> 12) % 1000) / 1000 * (CELL - m * 2);
    const y = cy * CELL + m + ((h >>> 22) % 1000) / 1000 * (CELL - m * 2);
    const v = (h >>> 3) % d.variants;
    list.push({ kind, v, x, y, seed: h, lights: d.lights(v, style).map(l => ({ ...l, x: l.x + x, y: l.y + y })) });
  }
  const decor = st.decor;
  if (decor.length) {
    const h2 = hash2(cx, cy, 0x2c1b3c6d);
    const n = h2 % 3;
    for (let i = 0; i < n; i++) {
      const hh = hash2(cx * 7 + i, cy * 13 - i, 0x68e31da4);
      list.push({ kind: '', v: 0, x: cx * CELL + (hh % 1000) / 1000 * CELL, y: cy * CELL + ((hh >>> 10) % 1000) / 1000 * CELL, seed: hh, lights: [], emoji: decor[(hh >>> 20) % decor.length], size: 13 + ((hh >>> 5) % 7) });
    }
  }
  if (placed.size > 600) placed.clear();
  placed.set(key, list);
  return list;
}

/** 보이는 범위의 소품을 out에 모은다(배열 재사용) */
export function visibleProps(st: StageDef, x0: number, y0: number, x1: number, y1: number, out: Placed[]): Placed[] {
  out.length = 0;
  const style = envOf(st);
  const m = 100;
  for (let cy = Math.floor((y0 - m) / CELL); cy <= Math.floor((y1 + m) / CELL); cy++)
    for (let cx = Math.floor((x0 - m) / CELL); cx <= Math.floor((x1 + m) / CELL); cx++)
      for (const p of cellItems(st, style, cx, cy)) out.push(p);
  // 잡동사니 먼저, 소품은 위(y) 순서로
  out.sort((a, b) => (a.emoji ? 0 : 1) - (b.emoji ? 0 : 1) || a.y - b.y);
  return out;
}

/** 바닥 타일을 화면 전체에 깐다(식별 변환 상태에서 호출). exact면 1:1 픽셀 */
export function drawFloor(g: CanvasRenderingContext2D, st: StageDef, v: View, exact: boolean) {
  const { c, tw } = floorTile(st);
  const step = tw * v.S;
  const i0 = Math.floor(v.x0 / tw), j0 = Math.floor(v.y0 / tw);
  for (let j = j0; j * tw < v.y1; j++) for (let i = i0; i * tw < v.x1; i++) {
    const dx = v.bx + i * step, dy = v.by + j * step;
    if (exact) g.drawImage(c, Math.round(dx), Math.round(dy));
    else g.drawImage(c, dx, dy, step + 1, step + 1);
  }
}

/** 소품·잡동사니(식별 변환 상태에서 호출) */
export function drawProps(g: CanvasRenderingContext2D, st: StageDef, list: Placed[], v: View, exact: boolean) {
  const style = envOf(st);
  const SS = spriteScale(), k = v.S / SS;
  for (const p of list) {
    const s = p.emoji ? decorSprite(p.emoji, p.size!, st.palette.floor) : propSprite(p.kind, p.v, style);
    const dx = v.bx + p.x * v.S - s.ax * SS * k, dy = v.by + p.y * v.S - s.ay * SS * k;
    if (exact) g.drawImage(s.c, Math.round(dx), Math.round(dy));
    else g.drawImage(s.c, dx, dy, s.c.width * k, s.c.height * k);
  }
}

/** 소품의 움직이는 부분: 서버 LED 깜빡임, 불판 연기(월드 변환 상태에서 호출) */
export function drawPropAnims(g: CanvasRenderingContext2D, list: Placed[], time: number, smokeSprite: Sprite | null) {
  const ledCols = ['#a3ff5c', '#38bdf8', '#a3ff5c', '#ffb020', '#a3ff5c', '#38bdf8', '#ff4d4d'];
  for (const p of list) {
    if (p.emoji) continue;
    const d = PROPS[p.kind];
    if (d.leds) {
      const ox = p.x - d.ax, oy = p.y - d.ay;
      for (const [lx, ly, ph] of d.leds(p.v)) {
        const on = Math.sin(time * (2 + ph * 0.9) + ph * 1.7 + p.seed % 7) > -0.2;
        if (!on) continue;
        g.fillStyle = ledCols[ph];
        g.fillRect(ox + lx - 1, oy + ly - 0.8, 2.2, 1.6);
      }
    }
    if (d.smoke && smokeSprite) {
      for (const [sx, sy] of d.smoke) {
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.32 + i / 3 + (p.seed % 97) / 97) % 1;
          const r = 9 + t * 22;
          g.globalAlpha = 0.16 * Math.sin(t * Math.PI);
          g.drawImage(smokeSprite.c, p.x + sx - r + Math.sin(t * 5 + i) * 6, p.y + sy - t * 56 - r, r * 2, r * 2);
        }
      }
      g.globalAlpha = 1;
    }
  }
}

/** 소품이 켜 둔 빛(깜빡임 포함 세기) */
export function lightPower(l: EnvLight, time: number, seed: number): number {
  if (!l.flick) return l.a;
  const f = Math.sin(time * 7.3 + seed) * 0.5 + Math.sin(time * 13.1 + seed * 1.7) * 0.3;
  return l.a * (1 - l.flick * 0.18 + f * l.flick * 0.18);
}

// ───────────── 떠다니는 분위기 입자(먼지·데이터 불티·숯불 불씨·반딧불) ─────────────

interface Mote { color: string; size: number; rise: number; wander: number; alpha: number; pulse: number }
const MOTES: Record<EnvStyle['floor'], Mote[]> = {
  carpet: [{ color: '#ffe9c4', size: 1.2, rise: 4, wander: 10, alpha: 0.22, pulse: 0.5 }],
  server: [{ color: '#7fe3ff', size: 1, rise: 16, wander: 4, alpha: 0.5, pulse: 1.5 }, { color: '#a3ff5c', size: 0.9, rise: 12, wander: 3, alpha: 0.45, pulse: 2 }],
  wood: [{ color: '#ffb060', size: 1.2, rise: 34, wander: 8, alpha: 0.6, pulse: 3 }, { color: '#ff7a30', size: 0.9, rise: 26, wander: 6, alpha: 0.5, pulse: 4 }],
  jangpan: [{ color: '#ffd98a', size: 1.5, rise: 3, wander: 16, alpha: 0.55, pulse: 1.2 }],
};
const MC = 150;

/** 월드에 고정된 칸마다 몇 개씩, 시간 함수로만 움직인다(상태 없음). 월드 변환 상태에서 호출 */
export function drawAmbient(g: CanvasRenderingContext2D, st: StageDef, v: View, time: number, k: number) {
  const kinds = MOTES[envOf(st).floor];
  const op = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  for (let cy = Math.floor(v.y0 / MC) - 1; cy <= Math.floor(v.y1 / MC); cy++)
    for (let cx = Math.floor(v.x0 / MC); cx <= Math.floor(v.x1 / MC); cx++) {
      const h = hash2(cx, cy, 0x1b873593);
      for (let i = 0; i < 2; i++) {
        const m = kinds[(h >>> (i * 3)) % kinds.length];
        const hx = ((h >>> (4 + i * 9)) % 1000) / 1000, hy = ((h >>> (8 + i * 7)) % 1000) / 1000, ph = (h % 628) / 100 + i * 2.1;
        const x = cx * MC + hx * MC + Math.sin(time * 0.4 + ph) * m.wander;
        const y = cy * MC + ((hy * MC - time * m.rise) % MC + MC) % MC + Math.cos(time * 0.3 + ph) * m.wander * 0.5;
        const a = m.alpha * k * (0.55 + 0.45 * Math.sin(time * m.pulse + ph * 3));
        if (a <= 0.02) continue;
        const r = m.size * 2.6;
        g.globalAlpha = a;
        g.drawImage(moteSprite(m.color), x - r, y - r, r * 2, r * 2);
      }
    }
  g.globalAlpha = 1;
  g.globalCompositeOperation = op;
}

const moteTex = new Map<string, HTMLCanvasElement>();
/** 작은 빛 알갱이(흰 심 + 색 번짐) */
function moteSprite(color: string): HTMLCanvasElement {
  let c = moteTex.get(color);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, hexA(color, 0.9)); grd.addColorStop(1, hexA(color, 0));
    g.fillStyle = grd; g.fillRect(0, 0, 16, 16);
    if (moteTex.size > 16) moteTex.clear();
    moteTex.set(color, c);
  }
  return c;
}
