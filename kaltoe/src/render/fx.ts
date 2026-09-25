// 시각 효과(타격감): 적중 불꽃·처치 팝·폭발·번개·피해 숫자·화면 연출 (렌더 전용, 판정 무관)
//
// ── 렌더러와의 계약(레이어 훅) ──
// 모든 훅은 변환이 이미 설정된 컨텍스트와 '그 컨텍스트의' View를 받는다(저해상도 블룸·조명 버퍼는 S/bx/by가 그 버퍼 기준).
// 진입 시 globalAlpha = 1. 나갈 때 globalAlpha = 1, 받은 합성 모드, 월드 변환 setTransform(v.S,0,0,v.S,v.bx,v.by)을 그대로 둔다.
//   바닥·소품 → fx.drawGround(g, v)  [월드, 적 아래: 잉크 자국·그을음·바닥 먼지 고리]
//   그림자·픽업·적·플레이어·투사체 → fx.drawWorld(g, v)  [월드, 적 위: 파티클·불꽃·번개·폭발]
//   조명 레이어(가산) → fx.drawLights(g, v)  [폭발·번개·레벨업·궁극기 같은 동적 광원]
//   블룸 버퍼(저해상도, 가산) → fx.drawGlow(g, v)  [빛나야 할 심만]
//   조명·블룸 뒤, 월드 UI 앞 → fx.drawLabels(g, v)  [월드: 피해 숫자·떠오르는 글자 — 어둠에 묻히지 않게 조명 다음. 모든 품질에서 부른다]
//   화면 공간 → fx.drawScreen(g, v)  [CSS px: 번쩍임·충격파·집중선·레터박스·피격 테두리]
// 품질 'low'에서는 drawGlow/drawLights가 불리지 않는다 → drawWorld만으로도 완성된 모습이어야 한다.
// 카메라: 렌더러가 fx.shakeOffset()(CSS px)과 fx.zoomPunch()(배율, 1 = 없음)를 적용한다.
// 월드 효과 메서드(hit/kill/explode…)는 카메라·화면을 건드리지 않는다. 흔들림·번쩍임·킥·줌은 juice.ts가 따로 부른다(데모 화면은 조용히).
//
// ── 성능 ──
// 그라디언트는 색마다 한 번만 작은 '시트' 캔버스에 구워 두고(개수 제한 캐시) 매 프레임엔 drawImage로 크기·뒤집기만 바꾼다.
// 회전 그리기는 소프트웨어 래스터(저사양 기기·헤드리스)에서 몇 배 비싸서, 불꽃 줄은 미리 돌려 둔 셀 + 뒤집기, 색종이는 가로·세로 폭 흔들기로 대신한다.
// 모든 풀은 상한이 있고 매 프레임 제자리 압축(filter 할당 없음), 죽은 파티클·숫자·팝은 재사용한다.
// 적중은 초당 수백 번이라 프레임당 불꽃·고리 예산을 두고, 최근 초당 처치·적중·폭발 수(부하)가 높으면 사건 하나하나의 연출을 줄인다.
import { DISPLAY_FONT } from '../ui/fonts';

export type Quality = 'high' | 'medium' | 'low';

/** 레이어 훅에 넘기는 화면 정보. 월드 변환 = setTransform(S,0,0,S,bx,by). x0..y1은 보이는 월드 범위. */
export interface View {
  x0: number; y0: number; x1: number; y1: number;
  S: number; bx: number; by: number;
  W: number; H: number;   // CSS px 화면 크기
  dpr: number;
  time: number;
  quality: Quality;
}

type RGB = [number, number, number];
type Img = HTMLCanvasElement;
const TAU = Math.PI * 2;
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];

// ───────────── 색 ─────────────

function rgbOf(c: string): RGB {
  if (c.charCodeAt(0) === 35) {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16);
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [255, 255, 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const luma = (c: RGB) => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
/** 발광용 색: 명도를 끝까지 끌어올리고 살짝 하얗게(어두운 무기색도 가산 합성에서 보이게) */
function neon(c: string): RGB {
  const [r, g, b] = rgbOf(c);
  const mx = Math.max(r, g, b, 1), mn = Math.min(r, g, b);
  const k = 255 / mx, sat = (mx - mn) / mx;
  return mix([r * k, g * k, b * k], WHITE, 0.12 + (1 - sat) * 0.25);
}
const neonCss = new Map<string, string>();
function neonOf(c: string) { let s = neonCss.get(c); if (!s) { if (neonCss.size > 64) neonCss.clear(); s = css(neon(c)); neonCss.set(c, s); } return s; }

// ───────────── 스프라이트 시트(색마다 한 번만 굽는다) ─────────────

function canvas(w: number, h: number): [Img, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function seeded(seed: number) { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hashStr(t: string) { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; }

/** 크기 제한 캐시(가장 먼저 넣은 것부터 버림). 버려진 시트를 쥔 파티클은 끝까지 그대로 그린다. */
class Sheets {
  private m = new Map<string, Img>();
  constructor(private cap: number, private build: (c: string) => Img) {}
  clear() { this.m.clear(); }
  get(k: string): Img {
    let s = this.m.get(k);
    if (!s) {
      if (this.m.size >= this.cap) { const f = this.m.keys().next().value; if (f !== undefined) this.m.delete(f); }
      s = this.build(k); this.m.set(k, s);
    }
    return s;
  }
}

// 발광 시트(색별 384×96): 윗줄 x 0 부드러운 빛 · 64 흰 심 빛 · 128 별 · 192 고리 · 256 십자(256,24,32×32) / 빛줄기(304,16,16×48) · 320 불덩이
//   아랫줄(y 64) 미리 돌려 둔 불꽃 줄 32×32 ×5 (0°, 22.5°, 45°, 67.5°, 90°) — 회전 그리기는 소프트웨어 래스터에서 몇 배 비싸서 축 정렬로만 그린다
const G_SOFT = 0, G_CORE = 64, G_STAR = 128, G_RING = 192, G_FIRE = 320;
function buildGlow(color: string): Img {
  const n = neon(color), nl = mix(n, WHITE, 0.55);
  const [c, g] = canvas(384, 96);
  const rad = (x: number, stops: [number, string][], r = 32) => {
    const gr = g.createRadialGradient(x + 32, 32, 0, x + 32, 32, r);
    for (const [o, s] of stops) gr.addColorStop(o, s);
    g.fillStyle = gr; g.fillRect(x, 0, 64, 64);
  };
  rad(G_SOFT, [[0, css(n, 1)], [0.22, css(n, 0.62)], [0.55, css(n, 0.18)], [1, css(n, 0)]]);
  rad(G_CORE, [[0, '#ffffff'], [0.13, 'rgba(255,255,255,.96)'], [0.3, css(n, 0.82)], [0.62, css(n, 0.2)], [1, css(n, 0)]]);
  // 별(4갈래 + 대각 짧은 갈래)
  rad(G_STAR, [[0, css(nl, 0.85)], [0.3, css(n, 0.28)], [1, css(n, 0)]], 22);
  g.save(); g.translate(G_STAR + 32, 32);
  const dia = (L: number, W: number) => {
    g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, -W); g.lineTo(L, 0); g.lineTo(0, W); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, -L); g.lineTo(W, 0); g.lineTo(0, L); g.lineTo(-W, 0); g.closePath(); g.fill();
  };
  g.fillStyle = css(n, 0.95); dia(31, 3.8);
  g.fillStyle = '#ffffff'; dia(23, 1.9);
  g.rotate(Math.PI / 4); g.fillStyle = css(n, 0.75); dia(13, 1.7);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
  g.restore();
  // 고리(색 테 + 흰 심선)
  g.lineWidth = 6; g.strokeStyle = css(n, 0.9); g.beginPath(); g.arc(G_RING + 32, 32, 27, 0, TAU); g.stroke();
  g.lineWidth = 2.2; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(G_RING + 32, 32, 27, 0, TAU); g.stroke();
  // 십자(회복)
  g.fillStyle = css(n, 0.95); g.fillRect(268, 27, 8, 26); g.fillRect(259, 36, 26, 8);
  g.fillStyle = '#ffffff'; g.fillRect(270.5, 30, 3, 20); g.fillRect(262, 38.5, 20, 3);
  // 빛줄기(아래 뿌리가 좁고 위로 넓어지며 사라짐)
  const vg = g.createLinearGradient(0, 64, 0, 16);
  vg.addColorStop(0, css(nl, 0.95)); vg.addColorStop(0.45, css(n, 0.4)); vg.addColorStop(1, css(n, 0));
  g.fillStyle = vg; g.beginPath(); g.moveTo(310.5, 64); g.lineTo(304, 16); g.lineTo(320, 16); g.lineTo(313.5, 64); g.closePath(); g.fill();
  // 미리 돌린 불꽃 줄: 투명한 꼬리 → 색 → 흰 머리. 셀 가운데를 지나는 길이 28px, 머리 끝은 +12.5px 쪽
  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI) / 8, cx = k * 32 + 16, cy = 80;
    g.save(); g.translate(cx, cy); g.rotate(a);
    const sg = g.createLinearGradient(-15, 0, 14, 0);
    sg.addColorStop(0, css(n, 0)); sg.addColorStop(0.3, css(n, 0.55)); sg.addColorStop(0.65, css(n, 0.95)); sg.addColorStop(0.85, css(nl, 1)); sg.addColorStop(1, '#ffffff');
    g.fillStyle = sg; g.beginPath(); g.ellipse(-1, 0, 14.5, 2.9, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(8.5, 0, 5, 1.4, 0, 0, TAU); g.fill();
    g.restore();
  }
  // 불덩이(폭발 몸통, 일반 합성): 흰 심 → 노랑 → 색 → 검붉은 가장자리
  rad(G_FIRE, [[0, '#fffbe6'], [0.2, css(mix(n, [255, 232, 150], 0.6), 1)], [0.46, css(n, 0.95)], [0.74, css(mix(n, BLACK, 0.55), 0.55)], [1, css(mix(n, BLACK, 0.7), 0)]]);
  return c;
}

// 잉크 시트(색별 288×64): 0~3 잉크 자국(64×64) · 색종이(256,0,16×10) · 동전(256,16,16×16) · 파편(272,0,14×14)
/** 잉크 시트 → 색종이 단색(면·반짝 면). 색종이는 이미지 대신 단색 사각형으로 그린다(작은 조각은 이쪽이 훨씬 싸다) */
const inkFace = new WeakMap<Img, [string, string]>();
function buildInk(color: string): Img {
  const base = mix(rgbOf(color), neon(color), 0.25), lite = mix(base, WHITE, 0.45), dark = mix(base, BLACK, 0.5);
  const [c, g] = canvas(288, 64);
  inkFace.set(c, [css(base), css(mix(base, WHITE, 0.6))]);
  const r = seeded(hashStr(color));
  const dot = (x: number, y: number, rr: number) => { g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); };
  for (let v = 0; v < 4; v++) {
    const cx = v * 64 + 32, cy = 32;
    g.fillStyle = css(base);
    dot(cx, cy, 11 + r() * 2);
    for (let i = 0; i < 6; i++) { const a = r() * TAU, d = 5 + r() * 5; dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + r() * 4.5); }
    for (let i = 0; i < 3; i++) {   // 튄 줄기
      const a = r() * TAU, L = 19 + r() * 7, w = 2 + r() * 1.6;
      g.beginPath();
      g.moveTo(cx + Math.cos(a + 1.57) * w, cy + Math.sin(a + 1.57) * w);
      g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      g.lineTo(cx + Math.cos(a - 1.57) * w, cy + Math.sin(a - 1.57) * w);
      g.fill();
      dot(cx + Math.cos(a) * L, cy + Math.sin(a) * L, 1.6 + r() * 1.3);
    }
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = 17 + r() * 10; dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r() * 2.1); }
    g.fillStyle = css(lite, 0.3); dot(cx - 3, cy - 3, 5);
  }
  // 색종이 조각(윗면 밝게, 아랫면 어둡게)
  g.fillStyle = css(base); g.fillRect(257, 1, 14, 8);
  g.fillStyle = css(lite); g.fillRect(257, 1, 14, 2.5);
  g.fillStyle = css(dark, 0.8); g.fillRect(257, 7, 14, 2);
  // 동전(테두리 + 면 + 광택)
  g.fillStyle = css(dark); dot(264, 24, 7.5);
  g.fillStyle = css(base); dot(264, 24, 6.2);
  g.fillStyle = css(lite); dot(264, 24, 4);
  g.fillStyle = 'rgba(255,255,255,.85)'; dot(262, 22, 1.6);
  // 파편(각진 조각)
  const poly = (ox: number, oy: number, R: number) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + r() * 0.5, d = R * (0.6 + r() * 0.4); if (i) g.lineTo(ox + Math.cos(a) * d, oy + Math.sin(a) * d); else g.moveTo(ox + Math.cos(a) * d, oy + Math.sin(a) * d); }
    g.closePath(); g.fill();
  };
  g.fillStyle = css(dark); poly(279, 7, 6.5);
  g.fillStyle = css(base, 0.9); poly(278, 6, 3.6);
  return c;
}

// 공용 시트(256×128): 연기 2종(0,0)(64,0) 64×64 · 그을음(128,0) 128×128
let shared: Img | null = null;
function sharedSheet(): Img {
  if (shared) return shared;
  const [c, g] = canvas(256, 128);
  const r = seeded(4242);
  for (let v = 0; v < 2; v++) {
    const ox = v * 64 + 32, oy = 32;
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU, d = i ? 6 + r() * 8 : 0, rr = i ? 9 + r() * 7 : 15;
      const x = ox + Math.cos(a) * d, y = oy + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(74,68,86,.55)'); gr.addColorStop(0.6, 'rgba(54,50,64,.34)'); gr.addColorStop(1, 'rgba(40,38,48,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }
    const hg = g.createRadialGradient(ox - 5, oy - 6, 0, ox - 5, oy - 6, 13);
    hg.addColorStop(0, 'rgba(160,154,172,.2)'); hg.addColorStop(1, 'rgba(160,154,172,0)');
    g.fillStyle = hg; g.fillRect(v * 64, 0, 64, 64);
  }
  const sx = 192, sy = 64;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 60);
  sg.addColorStop(0, 'rgba(8,5,4,.85)'); sg.addColorStop(0.45, 'rgba(14,9,6,.6)'); sg.addColorStop(0.8, 'rgba(20,12,8,.2)'); sg.addColorStop(1, 'rgba(20,12,8,0)');
  g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 60, 0, TAU); g.fill();
  g.fillStyle = 'rgba(10,6,4,.42)';
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, L = 36 + r() * 25, w = 2 + r() * 3;
    g.beginPath();
    g.moveTo(sx + Math.cos(a + 1.57) * w, sy + Math.sin(a + 1.57) * w);
    g.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L);
    g.lineTo(sx + Math.cos(a - 1.57) * w, sy + Math.sin(a - 1.57) * w);
    g.fill();
  }
  for (let i = 0; i < 10; i++) { const a = r() * TAU, d = 40 + r() * 18; g.beginPath(); g.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 1 + r() * 2.4, 0, TAU); g.fill(); }
  shared = c;
  return c;
}

const glowSheets = new Sheets(40, buildGlow);
const inkSheets = new Sheets(40, buildInk);
const glow = (c: string) => glowSheets.get(c);
const ink = (c: string) => inkSheets.get(c);

/** 화면 테두리 비네트(색별 128×128, 그릴 때 화면 크기로 늘림 → 해상도·화면 크기와 무관) */
const borders = new Map<string, Img>();
function border(color: RGB, key: string): Img {
  let b = borders.get(key);
  if (b) return b;
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 74);
  gr.addColorStop(0, css(color, 0)); gr.addColorStop(0.7, css(color, 0)); gr.addColorStop(0.88, css(color, 0.3)); gr.addColorStop(1, css(color, 0.85));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  borders.set(key, c);
  return c;
}
const B_RED: RGB = [255, 26, 56], B_CYAN: RGB = [40, 230, 255], B_GOLD: RGB = [255, 196, 40];

// ───────────── 개체 ─────────────

// 파티클 종류
const K_SPARK = 0, K_EMBER = 1, K_SHARD = 2, K_SMOKE = 3, K_CHUNK = 4, K_COIN = 5, K_STAR = 6, K_PLUS = 7, K_FLAME = 8;
// 감속 단계(초당 유지율, 60fps 기준 프레임당 값): 0 빠름 · 1 보통 · 2 느림 · 3 거의 없음
const DRAG = [0.8, 0.9, 0.955, 0.99];

export interface Particle {
  k: number; img: Img;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; size: number; len: number;
  rot: number; vr: number; grav: number; drag: number; a: number;
}
/** 피해 숫자. 글자가 바뀔 때만 자기 작은 캔버스(c)에 글리프를 이어 붙여 두고, 매 프레임엔 그 한 장만 그린다 */
interface DmgNum { x: number; y: number; vx: number; v: number; crit: boolean; age: number; max: number; pt: number; amp: number; uid: number; txt: string; base: number; tilt: number; c: Img | null; cg: CanvasRenderingContext2D | null; uw: number; uh: number; rs: number; aid: number; dirty: boolean }
interface Boom { x: number; y: number; r: number; life: number; max: number; img: Img; fire: boolean }
interface Pop { x: number; y: number; r0: number; r1: number; life: number; max: number; img: Img; cell: number; rot: number; a: number }
interface Wave { x: number; y: number; r0: number; r1: number; life: number; max: number; w: number; col: string; a: number; d: number; ground: boolean }
interface Bolt { pts: number[]; path: Path2D; life: number; max: number; col: string; img: Img; rj: boolean }
interface Light { x: number; y: number; r: number; life: number; max: number; a: number; img: Img }
interface Mark { x: number; y: number; size: number; fx: number; fy: number; life: number; max: number; a: number; img: Img; sx: number; sy: number; sw: number; sh: number }
interface Rays { x: number; y: number; life: number; max: number; n: number; len: number; img: Img; rot: number }
interface TextSpr { c: Img; w: number; h: number }
interface FText { x: number; y: number; spr: TextSpr; life: number; max: number; age: number; rise: number; fancy: boolean; img: Img | null }
interface Pend { t: number; x: number; y: number; r: number; color: string }

const GLYPHS = '0123456789.k!';
const NUM_FS = 26;   // 숫자 아틀라스 글자 크기(월드 단위): 가장 큰 숫자 기준으로 그려 두고 줄여 쓴다
interface Atlas { c: Img; x: Float32Array; adv: Float32Array; idx: Int8Array; w: number; h: number; scale: number; id: number }

/** 미리 돌린 불꽃 줄 셀에서 머리(흰 점)의 위치(셀 크기 1 기준, 가운데 원점) */
const HEAD_X = [0, 1, 2, 3, 4].map(k => (Math.cos((k * Math.PI) / 8) * 12.5) / 32), HEAD_Y = [0, 1, 2, 3, 4].map(k => (Math.sin((k * Math.PI) / 8) * 12.5) / 32);
const CONFETTI = ['#ffd84d', '#5ee0ff', '#ff6fa8', '#fff6e0', '#8dff7a'];
const fmtDmg = (v: number, crit: boolean) => (v >= 10000 ? (v / 1000).toFixed(0) + 'k' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.max(1, Math.round(v)))) + (crit ? '!' : '');
const numBase = (v: number, crit: boolean) => ((crit ? 17 : 12) * (v >= 10000 ? 1.4 : v >= 1000 ? 1.22 : 1)) / NUM_FS;
/** 조명 세기 배율: 곱하기 조명맵에서는 충분히 밝고, 임시로 화면에 바로 더해져도 하얗게 날아가지 않을 정도 */
const LIGHT_K = 0.38;
const easeOut3 = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

let measureCtx: CanvasRenderingContext2D | null = null;

export class Fx {
  parts: Particle[] = [];
  nums: DmgNum[] = [];
  booms: Boom[] = [];
  bolts: Bolt[] = [];
  texts: FText[] = [];
  pops: Pop[] = [];
  waves: Wave[] = [];
  lights: Light[] = [];
  marks: Mark[] = [];
  rays: Rays[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';
  time = 0;
  maxParts = 420;
  maxMarks = 20;
  maxNums = 70;
  showNums = true;
  shakeOn = true;
  quality: Quality = 'high';
  numScale = 2;
  private qMul = 1;
  private numByUid = new Map<number, DmgNum>();
  private freeP: Particle[] = [];
  private freeN: DmgNum[] = [];
  private freePop: Pop[] = [];
  private pend: Pend[] = [];
  private seed = 1;
  private drag = new Float32Array(4);
  private sparkBudget = 0;
  private ringBudget = 0;
  // 최근 초당 처치·적중·폭발 수(지수 평균). 붐빌수록 사건 하나하나의 연출을 줄여 전체 인상은 유지하면서 비용을 묶는다.
  private kr = 0; private hr = 0; private er = 0;
  private kN = 0; private hN = 0; private eN = 0;
  private camX = 0; private camY = 0;   // 마지막으로 그린 화면 중심(킥 방향 계산용)
  // 화면 연출 타이머
  private hurtT = 0; private chromaT = 0; private boxT = 0;
  private hurtFl = 0;   // 피격 붉은 번쩍임(흰·금색 섬광과 따로 겹쳐 그린다)
  private pulseT = 0; private pulseMax = 1; private pulseKey: 'red' | 'gold' | 'cyan' = 'red';
  private swT = -1; private swX = 0; private swY = 0; private swCol = '#ffffff'; private swDur = 0.55;
  private linesT = 0;
  private glintT = 0;
  // 줌 펀치 / 킥(스프링)
  private zp = 0; private zpFrom = 0; private zpT = 1; private zpDur = 0.5;
  private kx = 0; private ky = 0; private kvx = 0; private kvy = 0;
  private so: [number, number] = [0, 0];
  // 글자 캐시
  private atlas: Atlas | null = null;
  private atlasId = 0;
  private textCache = new Map<string, TextSpr>();
  private textScale = 0;
  private labelsHooked = false;   // 렌더러가 drawLabels를 부르면 drawWorld는 숫자·글자를 건너뛴다

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  private rr(a: number, b: number) { return a + (b - a) * this.rnd(); }
  /** 부하 단계: rate가 calm 이하면 1, busy에 가까울수록 0.25까지 */
  private lod(rate: number, calm: number, busy: number) { return rate <= calm ? 1 : Math.max(0.25, 1 - (0.75 * (rate - calm)) / (busy - calm)); }
  /** 품질·부하에 맞춘 개수(소수는 확률로 반올림) */
  private cnt(n: number) {
    const load = this.parts.length / this.maxParts;
    const f = n * this.qMul * (load > 0.55 ? Math.max(0.2, 1 - (load - 0.55) * 1.9) : 1);
    const i = Math.floor(f);
    return i + (this.rnd() < f - i ? 1 : 0);
  }

  /** 새 판 시작 시 이전(데모 포함) 효과를 모두 지운다 */
  reset() {
    for (const p of this.parts) this.freeP.push(p);
    for (const n of this.nums) this.freeN.push(n);
    for (const q of this.pops) this.freePop.push(q);
    this.parts.length = 0; this.nums.length = 0; this.booms.length = 0; this.bolts.length = 0; this.texts.length = 0;
    this.pops.length = 0; this.waves.length = 0; this.lights.length = 0; this.marks.length = 0; this.rays.length = 0; this.pend.length = 0;
    this.numByUid.clear(); this.shake = 0; this.flash = 0;
    this.hurtT = 0; this.hurtFl = 0; this.chromaT = 0; this.boxT = 0; this.pulseT = 0; this.swT = -1; this.linesT = 0;
    this.zp = 0; this.zpFrom = 0; this.kx = this.ky = this.kvx = this.kvy = 0;
  }

  /** GPU 문맥을 잃었다 되찾았을 때(렌더러가 부름): 모듈 캐시 캔버스를 버리고 새 캔버스로 다시 굽게 한다 — 예전 캔버스는 메인보다 늦게 복구돼 제자리에 다시 그리면 버려질 수 있다 */
  resetCanvases() {
    glowSheets.clear(); inkSheets.clear(); shared = null; borders.clear();
    for (const n of this.nums) { n.c = null; n.cg = null; n.dirty = true; }
    for (const n of this.freeN) { n.c = null; n.cg = null; }
    this.invalidateText();
  }

  /** 글꼴이 바뀌면 글자 캐시(숫자 아틀라스·글자 스프라이트)를 다시 만든다 */
  invalidateText() { this.atlas = null; this.textCache.clear(); }

  /** 파티클 예산(품질 단계에 맞춤). 렌더러가 quality를 먼저 넣고 부른다. */
  setLow(low: boolean) {
    const q: Quality = low ? 'low' : this.quality;
    this.qMul = q === 'low' ? 0.3 : q === 'medium' ? 0.6 : 1;
    this.maxParts = q === 'low' ? 160 : q === 'medium' ? 300 : 420;
    this.maxMarks = q === 'low' ? 8 : q === 'medium' ? 14 : 20;
    this.maxNums = q === 'low' ? 40 : q === 'medium' ? 55 : 70;
  }

  // ───────────── 풀 ─────────────

  private part(k: number, img: Img, x: number, y: number, vx: number, vy: number, life: number, size: number): Particle | null {
    if (this.parts.length >= this.maxParts) return null;
    let p = this.freeP.pop();
    if (p) {
      p.k = k; p.img = img; p.x = x; p.y = y; p.z = 0; p.vx = vx; p.vy = vy; p.vz = 0; p.life = life; p.max = life;
      p.size = size; p.len = 1; p.rot = 0; p.vr = 0; p.grav = 0; p.drag = 1; p.a = 1;
    } else p = { k, img, x, y, z: 0, vx, vy, vz: 0, life, max: life, size, len: 1, rot: 0, vr: 0, grav: 0, drag: 1, a: 1 };
    this.parts.push(p);
    return p;
  }
  private pop(x: number, y: number, r0: number, r1: number, life: number, img: Img, cell: number, a = 1, rot = 0) {
    if (this.pops.length >= 96) return;
    // 적중마다 생기므로 객체를 재사용한다
    const q = this.freePop.pop();
    if (q) { q.x = x; q.y = y; q.r0 = r0; q.r1 = r1; q.life = life; q.max = life; q.img = img; q.cell = cell; q.rot = rot; q.a = a; this.pops.push(q); }
    else this.pops.push({ x, y, r0, r1, life, max: life, img, cell, rot, a });
  }
  private wave(x: number, y: number, r0: number, r1: number, life: number, w: number, col: string, a = 1, d = 0, ground = false) {
    if (this.waves.length >= 40) return;
    this.waves.push({ x, y, r0, r1, life, max: life, w, col, a, d, ground });
  }
  private light(x: number, y: number, r: number, life: number, img: Img, a = 1) {
    if (this.lights.length >= 40) { if (r < 120) return; this.lights.shift(); }
    this.lights.push({ x, y, r, life, max: life, a, img });
  }
  private mark(x: number, y: number, size: number, img: Img, sx: number, sy: number, sw: number, sh: number, life: number, a: number) {
    const m = this.marks.length >= this.maxMarks ? this.marks.shift()! : ({} as Mark);
    m.x = x; m.y = y; m.size = size; m.fx = this.rnd() < 0.5 ? -1 : 1; m.fy = this.rnd() < 0.5 ? -1 : 1; m.life = life; m.max = life; m.a = a; m.img = img; m.sx = sx; m.sy = sy; m.sw = sw; m.sh = sh;
    this.marks.push(m);
  }
  private ray(x: number, y: number, n: number, len: number, life: number, color: string) {
    if (this.rays.length >= 6) this.rays.shift();
    this.rays.push({ x, y, life, max: life, n, len, img: glow(color), rot: this.rnd() * TAU });
  }

  // ───────────── 기본 생성기(예전 API 유지) ─────────────

  /** kind 0 = 불꽃 줄, 1 = 빛나는 불씨(grav로 오르내림), 2 = 색종이(가짜 높이 + 중력) */
  burst(x: number, y: number, color: string, n: number, speed = 160, size = 3, kind: 0 | 1 | 2 = 0, grav = 0) {
    const img = kind === 2 ? ink(color) : glow(color);
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, s = speed * (0.35 + this.rnd() * 0.75);
      if (kind === 2) {
        const p = this.part(K_SHARD, img, x, y, Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.45, 0.9 + this.rnd() * 0.4, size * (0.8 + this.rnd() * 0.6));
        if (!p) return;
        p.z = 6; p.vz = 120 + this.rnd() * 180; p.grav = 800; p.rot = this.rnd() * TAU; p.vr = (this.rnd() - 0.5) * 30; p.drag = 2;
      } else if (kind === 1) {
        const p = this.part(K_EMBER, img, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + this.rnd() * 0.4, size * (0.6 + this.rnd() * 0.8));
        if (!p) return;
        p.grav = grav; p.drag = 2;
      } else {
        const p = this.part(K_SPARK, img, x, y, Math.cos(a) * s * 1.6, Math.sin(a) * s * 1.6, 0.18 + this.rnd() * 0.18, size * 0.7);
        if (!p) return;
        p.len = 6 + size * 2; p.drag = 1;
      }
    }
  }

  // ───────────── 타격감 효과(월드) ─────────────

  /** 적중: 맞은 방향(dx,dy = 플레이어→적)으로 튀는 불꽃(흰 머리 + 무기색 꼬리) + 작은 충격 고리. 치명타는 별 섬광. */
  hit(x: number, y: number, dx: number, dy: number, color: string, crit: boolean) {
    this.hN++;
    const img = glow(color), gw = glow('#ffffff'), lh = this.lod(this.hr, 60, 420);
    if (this.ringBudget > 0 || crit) {
      this.ringBudget--;
      this.pop(x, y, 3, crit ? 17 : 11, crit ? 0.18 : 0.12, img, G_RING, 0.95);
      if (crit || lh > 0.7) this.pop(x, y, 2, crit ? 12 : 6, 0.07, gw, G_CORE, 0.85);
    }
    let n = this.cnt((crit ? 6 : 3 + this.rnd() * 3) * (0.4 + 0.6 * lh));
    if (n > this.sparkBudget) n = Math.max(0, this.sparkBudget);
    this.sparkBudget -= n;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = base + (this.rnd() - 0.5) * 1.3, s = this.rr(200, 460) * (crit ? 1.3 : 1);
      const p = this.part(K_SPARK, i === 0 ? gw : img, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.11, 0.21), this.rr(1.8, 2.6) * (crit ? 1.2 : 1));
      if (!p) break;
      p.len = this.rr(10, 16); p.drag = 1;
    }
    if (crit) {
      const gy = glow('#ffcf40');
      this.pop(x, y, 7, 27, 0.2, gy, G_STAR, 1, this.rnd() * 0.8);
      if (lh > 0.6) this.light(x, y, 60, 0.16, gy, 0.6);
    }
  }

  /** 일반 처치: 흰 팝 + 적 색 색종이(회전·중력) + 바닥 잉크 자국 + 작은 빛 */
  kill(x: number, y: number, tint: string, r: number) {
    this.kN++;
    const gw = glow('#ffffff'), gt = glow(tint), it = ink(tint), lk = this.lod(this.kr, 6, 40);
    this.pop(x, y, r * 0.4, r * 1.25, 0.12, gw, G_CORE, 1);
    if (this.rnd() < lk + 0.2) this.pop(x, y, r * 0.5, r * 1.9, 0.22, gt, G_RING, 0.9);
    const n = Math.max(1, this.cnt(this.rr(6, 10) * lk * lk));
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, s = this.rr(50, 170), q = this.rnd();
      const img = q < 0.62 ? it : q < 0.85 ? ink('#fff6e0') : ink(CONFETTI[(this.rnd() * 3) | 0]);
      const p = this.part(K_SHARD, img, x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * s, Math.sin(a) * s * 0.7, this.rr(0.75, 1.05), this.rr(3, 4.4));
      if (!p) break;
      p.z = r * 0.5; p.vz = this.rr(140, 300); p.grav = 900; p.rot = this.rnd() * TAU; p.vr = this.rr(-18, 18); p.drag = 2;
    }
    const ns = this.cnt(3 * lk);
    for (let i = 0; i < ns; i++) {
      const a = this.rnd() * TAU, s = this.rr(160, 300);
      const p = this.part(K_SPARK, gw, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.12, 0.2), 1.6);
      if (!p) break;
      p.len = 9; p.drag = 0;
    }
    // 바닥 잉크 자국: 붐빌 때는 일부만(자국 풀이 금방 갈리지 않게)
    if (this.rnd() < lk * lk * 1.3) this.mark(x, y + r * 0.25, r * 1.2, it, ((this.rnd() * 4) | 0) * 64, 0, 64, 64, 5, 0.55);
    if (lk > 0.8 && this.lights.length < 12) this.light(x, y, r * 3.4, 0.22, gt, 0.6);
  }

  /** 엘리트 처치: 중형 금빛 폭발 + 동전 튐 + 별 섬광 */
  eliteKill(x: number, y: number, tint: string, r: number) {
    this.kill(x, y, tint, r);
    this.explode(x, y, 62, '#ffc940', true);
    const gi = ink('#ffcf33'), n = Math.max(5, this.cnt(14));
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, s = this.rr(60, 210);
      const p = this.part(K_COIN, gi, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.7, this.rr(1.1, 1.6), this.rr(3.2, 4.2));
      if (!p) break;
      p.z = 10; p.vz = this.rr(220, 400); p.grav = 1000; p.rot = this.rnd() * TAU; p.vr = this.rr(8, 22); p.drag = 2;
    }
    this.pop(x, y, 12, 64, 0.32, glow('#ffd84d'), G_STAR, 1, this.rnd());
    this.light(x, y, 240, 0.5, glow('#ffc940'), 1);
  }

  /** 보스 처치: 연쇄 다중 폭발 + 색종이 폭우 + 동전 + 큰 빛 */
  bossKill(x: number, y: number, tint: string, r: number) {
    this.kill(x, y, tint, r);
    this.explode(x, y, 120, '#ffb347', true);
    const cols = ['#ffcf40', '#ff8c33', tint, '#ff5a7a', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      if (this.pend.length >= 24) break;
      const a = this.rnd() * TAU, d = this.rr(0.4, 1.7) * r;
      this.pend.push({ t: 0.1 + i * 0.1, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: this.rr(42, 78), color: cols[i % cols.length] });
    }
    this.pend.push({ t: 0.72, x, y, r: 260, color: '#fff2c0' });
    const n = Math.max(14, this.cnt(56));
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, s = this.rr(80, 320), q = this.rnd();
      const img = q < 0.35 ? ink(tint) : ink(CONFETTI[(this.rnd() * CONFETTI.length) | 0]);
      const p = this.part(K_SHARD, img, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.7, this.rr(1.4, 2.2), this.rr(2.8, 4.2));
      if (!p) break;
      p.z = r * 0.6; p.vz = this.rr(260, 520); p.grav = 900; p.rot = this.rnd() * TAU; p.vr = this.rr(-20, 20); p.drag = 2;
    }
    const gi = ink('#ffcf33'), nc = Math.max(6, this.cnt(20));
    for (let i = 0; i < nc; i++) {
      const a = this.rnd() * TAU, s = this.rr(80, 260);
      const p = this.part(K_COIN, gi, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.7, this.rr(1.3, 1.9), this.rr(3.5, 4.5));
      if (!p) break;
      p.z = 14; p.vz = this.rr(300, 520); p.grav = 1000; p.rot = this.rnd() * TAU; p.vr = this.rr(8, 22); p.drag = 2;
    }
    this.ray(x, y, 14, 220, 1.2, '#ffd84d');
    this.light(x, y, 420, 1.1, glow('#ffcf40'), 1);
  }

  /** 폭발(토너·알람·지뢰·폭탄…). 색·반경으로 모양을 고른다: 불(주황·노랑), 잉크(어두운 색), 파동(적 지원 능력), 대폭발(화면급). */
  explode(x: number, y: number, r: number, color: string, big: boolean) {
    const c = rgbOf(color), ncss = neonOf(color);
    const gs = glow(color), gw = glow('#ffffff');
    // 적의 회복·버프 파동: 폭발이 아니라 퍼지는 고리
    if (!big && (color === '#5dff9a' || color === '#ffd84d')) {
      this.wave(x, y, r * 0.15, r, 0.45, 3.5, ncss, 0.9);
      this.wave(x, y, r * 0.1, r * 0.7, 0.55, 2, ncss, 0.5, 0.08);
      const n = this.cnt(6), heal = color === '#5dff9a';
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * TAU, d = this.rr(0.2, 0.8) * r;
        const p = this.part(heal ? K_PLUS : K_STAR, gs, x + Math.cos(a) * d, y + Math.sin(a) * d, 0, -this.rr(30, 60), this.rr(0.5, 0.8), this.rr(3, 4.5));
        if (!p) break;
        p.drag = 2;
      }
      this.light(x, y, r * 1.6, 0.4, gs, 0.5);
      return;
    }
    this.eN++;
    const nova = r >= 240 || color === '#ffffff' || color === '#8fe3ff';
    const inky = !nova && luma(c) < 0.3, le = nova ? 1 : this.lod(this.er, 1.2, 6);
    const R = Math.min(r, 140);   // 몸통·연기 크기 상한(화면급 폭발은 고리로 표현)
    // ① 섬광 원 + 불덩이 몸통
    if (this.booms.length >= 32) this.booms.shift();
    const life = nova ? 0.5 : big ? 0.46 : 0.34;
    this.booms.push({ x, y, r: nova ? Math.min(r * 0.45, 160) : R, life, max: life, img: gs, fire: !nova });
    // ② 두꺼운 충격파 고리
    this.wave(x, y, r * 0.18, r * 1.08, nova ? 0.55 : big ? 0.42 : 0.3, nova ? 22 : Math.max(3, R * 0.24), ncss, 1);
    if (nova) this.wave(x, y, r * 0.1, r * 0.78, 0.7, 8, ncss, 0.6, 0.06);
    else if (big && le > 0.6) this.wave(x, y, r * 0.1, r * 0.7, 0.36, Math.max(1.5, R * 0.05), '#ffffff', 0.5, 0.05);
    // ③ 불꽃 입자
    const sp = Math.sqrt(R / 60);
    const ns = this.cnt(nova ? 34 : Math.max(8, Math.min(26, R / 4.5)) * (0.45 + 0.55 * le));
    const gy = glow(inky ? color : '#ffd35a');
    for (let i = 0; i < ns; i++) {
      const a = this.rnd() * TAU, s = this.rr(180, 460) * (nova ? 1.9 : sp), q = this.rnd();
      const p = this.part(K_SPARK, q < 0.2 ? gw : q < 0.6 ? gs : gy, x + Math.cos(a) * R * 0.15, y + Math.sin(a) * R * 0.15, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.25, 0.5), this.rr(1.8, 3));
      if (!p) break;
      p.len = nova ? this.rr(20, 32) : this.rr(10, 18); p.drag = 1;
    }
    const ne = this.cnt(nova ? 14 : Math.max(3, Math.min(8, R / 12)) * le);
    for (let i = 0; i < ne; i++) {
      const a = this.rnd() * TAU, d = this.rnd() * (nova ? r * 0.8 : R * 0.6), s = this.rr(20, 90);
      const p = this.part(nova ? K_STAR : K_EMBER, nova ? gs : gy, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * s, Math.sin(a) * s - 20, this.rr(0.5, 0.95), nova ? this.rr(4, 7) : this.rr(2.2, 3.4));
      if (!p) break;
      p.grav = -60; p.drag = 2;
    }
    // ⑦ 빛 펄스
    this.light(x, y, Math.min(r * (nova ? 1 : 1.15), nova ? 320 : 130), nova ? 0.55 : big ? 0.38 : 0.26, gs, 0.95);
    if (nova) return;
    // 불길: 몸통 둘레로 부풀어 나가는 불덩이(실루엣이 동그란 원이 되지 않게)
    const nf = le > 0.45 ? Math.max(2, this.cnt(Math.max(3, Math.min(5, R / 18)) * le)) : 0;
    for (let i = 0; i < nf; i++) {
      const a = (i / nf) * TAU + this.rnd() * 0.8, s = R * this.rr(1.6, 2.6);
      const p = this.part(K_FLAME, gs, x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.24, 0.36), R * this.rr(0.26, 0.34));
      if (!p) break;
      p.len = R * 0.5; p.drag = 0;
    }
    // ④ 연기(어둡고 느리게)
    const nm = Math.max(1, this.cnt(Math.max(2, Math.min(4, R / 22)) * (inky ? 1.4 : 1) * le));
    const sh = sharedSheet();
    for (let i = 0; i < nm; i++) {
      const a = this.rnd() * TAU, d = this.rnd() * R * 0.4;
      const p = this.part(K_SMOKE, sh, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * this.rr(8, 30), Math.sin(a) * this.rr(8, 30) - this.rr(12, 26), this.rr(0.8, 1.2), R * this.rr(0.2, 0.27));
      if (!p) break;
      p.len = R * this.rr(0.18, 0.3); p.drag = 2; p.rot = this.rnd() < 0.5 ? 0 : 64; p.a = inky ? 0.75 : 0.55;
    }
    // ⑤ 파편
    const nd = this.cnt(Math.max(3, Math.min(7, R / 13)) * (0.4 + 0.6 * le));
    const di = ink(inky ? color : '#4a4250');
    for (let i = 0; i < nd; i++) {
      const a = this.rnd() * TAU, s = this.rr(90, 260) * sp;
      const p = this.part(inky ? K_SHARD : K_CHUNK, di, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.75, this.rr(0.8, 1.3), this.rr(2.2, 3.4));
      if (!p) break;
      p.z = 4; p.vz = this.rr(160, 330); p.grav = 1000; p.rot = this.rnd() * TAU; p.vr = this.rr(-14, 14); p.drag = 2;
    }
    // ⑥ 그을음(잉크 폭발은 잉크 자국) + 바닥 먼지 고리
    if (this.rnd() < le * le + 0.2) {
      if (inky) this.mark(x, y, R * 0.6, ink(color), ((this.rnd() * 4) | 0) * 64, 0, 64, 64, 6, 0.6);
      else this.mark(x, y, R * 0.5, sh, 128, 0, 128, 128, 6, 0.7);
    }
    if (big && le > 0.7) this.wave(x, y, R * 0.3, R * 1.1, 0.45, R * 0.16, 'rgb(14,10,18)', 0.2, 0, true);
  }

  /** 예전 API: 폭발(카메라 연출 없음) */
  boom(x: number, y: number, r: number, color: string, big: boolean) { this.explode(x, y, r, color, big); }

  /** 폭발의 카메라 연출: 반경 비례 킥(폭발 반대쪽으로) + 흔들림, 아주 큰 폭발은 줌 펀치 */
  impact(x: number, y: number, r: number, big: boolean) {
    const dx = this.camX - x, dy = this.camY - y, d = Math.hypot(dx, dy);
    const fall = Math.max(0.15, 1 - d / 700), R = Math.min(r, 260), k = (big ? 1 : 0.45) * fall;
    this.addShake(Math.min(0.32, R / 520) * k, big ? 0.7 : 0.3);
    const m = (2 + R / 18) * k;
    if (d > 1) this.kick((dx / d) * m, (dy / d) * m); else this.kickRand(m);
    if (r >= 120) this.punch(Math.min(0.035, 0.01 + r / 12000), 0.4);
  }

  /** 연쇄 번개: 발광 심 + 곁가지, 마디마다 불꽃·섬광·빛 */
  bolt(pts: number[], color: string) {
    if (pts.length < 4) return;
    if (this.bolts.length >= 24) this.bolts.shift();
    const gs = glow(color), gw = glow('#ffffff');
    const b: Bolt = { pts, path: new Path2D(), life: 0.24, max: 0.24, col: neonOf(color), img: gs, rj: false };
    this.jag(b);
    this.bolts.push(b);
    this.pop(pts[0], pts[1], 3, 12, 0.12, gs, G_CORE, 0.9);
    const last = pts.length - 2;
    for (let i = 2; i + 1 < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      this.pop(x, y, 4, 18, 0.16, gs, G_CORE, 1);
      if (i === last) this.pop(x, y, 3, 16, 0.2, gs, G_STAR, 0.9, this.rnd());
      const n = this.cnt(3);
      for (let j = 0; j < n; j++) {
        const a = this.rnd() * TAU, s = this.rr(140, 320);
        const p = this.part(K_SPARK, j ? gs : gw, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.12, 0.24), 1.6);
        if (!p) break;
        p.len = 9; p.drag = 0;
      }
    }
    const m = (((pts.length >> 1) >> 1) << 1);
    this.light(pts[m], pts[m + 1], 110, 0.22, gs, 0.9);
  }
  /** 번개 경로를 지그재그로(곁가지 포함) 만든다. 수명 중간에 한 번 다시 만들어 번쩍이며 모양이 바뀐다. */
  private jag(b: Bolt) {
    const pts = b.pts, path = new Path2D(), br: number[] = [];
    path.moveTo(pts[0], pts[1]);
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], dx = pts[i + 2] - x0, dy = pts[i + 3] - y0;
      const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const segs = Math.max(3, Math.min(10, Math.round(L / 16))), amp = Math.min(14, L * 0.14);
      for (let s = 1; s <= segs; s++) {
        const t = s / segs, j = s === segs ? 0 : (this.rnd() - 0.5) * 2 * amp * Math.sin(t * Math.PI);
        const px = x0 + dx * t - uy * j, py = y0 + dy * t + ux * j;
        path.lineTo(px, py);
        if (s < segs && this.rnd() < 0.32) {
          const side = this.rnd() < 0.5 ? -1 : 1, bl = 8 + this.rnd() * 18;
          const ax = ux * 0.6 - uy * side * 0.8, ay = uy * 0.6 + ux * side * 0.8;
          br.push(px, py, px + ax * bl * 0.5 + (this.rnd() - 0.5) * 6, py + ay * bl * 0.5 + (this.rnd() - 0.5) * 6, px + ax * bl, py + ay * bl);
        }
      }
    }
    for (let i = 0; i + 5 < br.length; i += 6) { path.moveTo(br[i], br[i + 1]); path.lineTo(br[i + 2], br[i + 3]); path.lineTo(br[i + 4], br[i + 5]); }
    b.path = path;
  }

  /** 피격(월드): 플레이어 둘레 붉은 고리 + 불꽃 */
  hurt(x: number, y: number) {
    const gr = glow('#ff2e4d');
    this.pop(x, y, 8, 36, 0.26, gr, G_RING, 1);
    this.pop(x, y, 4, 22, 0.12, glow('#ffffff'), G_CORE, 0.7);
    const n = Math.max(3, this.cnt(8));
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, s = this.rr(160, 320);
      const p = this.part(K_SPARK, gr, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.14, 0.26), 2);
      if (!p) break;
      p.len = 11; p.drag = 0;
    }
    this.light(x, y, 150, 0.3, gr, 0.8);
  }

  /** 레벨업: 방사형 빛줄기 + 떠오르는 반짝이 고리 + 바닥 고리 */
  levelUp(x: number, y: number) {
    const gc = glow('#7dffb3'), gy = glow('#fff27a'), gw = glow('#ffffff');
    this.ray(x, y, 12, 120, 1.1, '#7dffb3');
    this.pop(x, y, 8, 44, 0.3, gw, G_CORE, 0.75);
    this.wave(x, y, 12, 118, 0.55, 5, neonOf('#7dffb3'), 1);
    this.wave(x, y, 8, 84, 0.7, 3, '#d8fff0', 0.8, 0.1);
    const n = Math.max(10, this.cnt(22));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const p = this.part(K_STAR, i % 3 === 0 ? gy : i % 3 === 1 ? gc : gw, x + Math.cos(a) * 26, y + 6 + Math.sin(a) * 12, Math.cos(a) * 22, -this.rr(40, 100), this.rr(0.8, 1.3), this.rr(4.5, 7.5));
      if (!p) break;
      p.grav = -50; p.drag = 2;
    }
    this.light(x, y, 300, 1.0, gc, 0.9);
  }

  /** 궁극기(월드): 흰 섬광 + 이중 충격파 + 빛줄기 + 긴 불꽃 */
  ult(x: number, y: number, color: string) {
    const gc = glow(color), gw = glow('#ffffff');
    this.pop(x, y, 20, 170, 0.42, gw, G_CORE, 1);
    this.wave(x, y, 10, 280, 0.55, 18, neonOf(color), 1);
    this.wave(x, y, 6, 200, 0.7, 6, '#ffffff', 0.9, 0.08);
    this.ray(x, y, 16, 210, 0.9, color);
    const n = this.cnt(30);
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, s = this.rr(500, 900);
      const p = this.part(K_SPARK, i & 1 ? gw : gc, x, y, Math.cos(a) * s, Math.sin(a) * s, this.rr(0.3, 0.5), this.rr(2.2, 3.2));
      if (!p) break;
      p.len = this.rr(22, 34); p.drag = 1;
    }
    this.light(x, y, 420, 0.9, gc, 1);
  }

  /** 무기 진화: 보라·금빛 빛줄기 + 별 폭발 */
  evolve(x: number, y: number) {
    this.ray(x, y, 14, 170, 1.3, '#c98bff');
    this.pop(x, y, 12, 90, 0.45, glow('#ffffff'), G_CORE, 1);
    this.wave(x, y, 10, 150, 0.6, 8, neonOf('#c98bff'), 1);
    this.wave(x, y, 8, 110, 0.75, 4, neonOf('#ffd84d'), 0.9, 0.12);
    this.sparkle(x, y, '#e4b8ff', 16, 70);
    this.sparkle(x, y, '#ffd84d', 12, 50);
    this.light(x, y, 380, 1.2, glow('#c98bff'), 1);
  }

  /** 부활: 금빛 빛줄기 + 회복 십자 + 별 */
  revive(x: number, y: number) {
    this.ray(x, y, 16, 190, 1.4, '#ffe9a0');
    this.pop(x, y, 14, 110, 0.5, glow('#ffffff'), G_CORE, 1);
    this.wave(x, y, 10, 180, 0.7, 10, neonOf('#ffe9a0'), 1);
    this.heal(x, y, true);
    this.sparkle(x, y, '#ffffff', 14, 60);
    this.light(x, y, 420, 1.3, glow('#ffe9a0'), 1);
  }

  /** 회복(커피·치킨): 떠오르는 초록 십자 */
  heal(x: number, y: number, big: boolean) {
    const gg = glow('#7dff9a'), n = Math.max(4, this.cnt(big ? 14 : 7));
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * TAU, d = this.rr(6, 26);
      const p = this.part(K_PLUS, gg, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, Math.cos(a) * 10, -this.rr(40, 80), this.rr(0.7, 1.1), this.rr(3.2, 5));
      if (!p) break;
      p.grav = -40; p.drag = 2;
    }
    this.wave(x, y, 8, big ? 70 : 46, 0.45, 3, neonOf('#7dff9a'), 0.8);
    this.light(x, y, big ? 200 : 120, 0.5, gg, 0.7);
    if (big) this.sparkle(x, y, '#ffd84d', 8, 40);
  }

  /** 반짝이 폭발(별) */
  sparkle(x: number, y: number, color: string, n: number, spread: number) {
    const gs = glow(color), k = Math.max(3, this.cnt(n));
    for (let i = 0; i < k; i++) {
      const a = this.rnd() * TAU, s = this.rr(0.3, 1) * spread * 2.2;
      const p = this.part(K_STAR, gs, x, y, Math.cos(a) * s, Math.sin(a) * s - 20, this.rr(0.55, 1), this.rr(3.5, 6.5));
      if (!p) break;
      p.grav = -30; p.drag = 2;
    }
  }

  /** 자석: 화면 바깥에서 플레이어로 빨려드는 고리 */
  magnet(x: number, y: number) {
    this.wave(x, y, 260, 14, 0.45, 5, neonOf('#ff5a7a'), 0.9);
    this.wave(x, y, 220, 14, 0.5, 4, neonOf('#5ab4ff'), 0.9, 0.12);
    this.light(x, y, 180, 0.5, glow('#9fb8ff'), 0.6);
  }

  /** 시계(시간 정지): 느리게 퍼지는 청록 고리 + 별 */
  clock(x: number, y: number) {
    this.wave(x, y, 14, 330, 0.8, 7, neonOf('#7fe8ff'), 1);
    this.wave(x, y, 10, 240, 1.0, 3, '#e8fbff', 0.8, 0.15);
    this.sparkle(x, y, '#9fe8ff', 16, 90);
    this.light(x, y, 360, 0.9, glow('#7fe8ff'), 0.8);
  }

  /** 보석·동전 획득 반짝(연속 획득은 간격 제한) */
  glint(x: number, y: number, color: string) {
    if (this.time - this.glintT < 0.07) return;
    this.glintT = this.time;
    this.pop(x + this.rr(-9, 9), y + this.rr(-12, 4), 2, 10, 0.18, glow(color), G_STAR, 0.8, this.rnd());
  }

  /** 칼퇴(클리어): 하늘에서 쏟아지는 색종이 */
  celebrate(x: number, y: number) {
    const n = Math.max(20, this.cnt(80));
    for (let i = 0; i < n; i++) {
      const p = this.part(K_SHARD, ink(CONFETTI[i % CONFETTI.length]), x + this.rr(-200, 200), y + this.rr(-220, 220), this.rr(-30, 30), this.rr(-20, 20), this.rr(1.6, 2.6), this.rr(2.8, 4));
      if (!p) break;
      p.z = this.rr(120, 360); p.vz = this.rr(-60, 40); p.grav = 380; p.rot = this.rnd() * TAU; p.vr = this.rr(-10, 10); p.drag = 3;
    }
    this.wave(x, y, 10, 220, 0.8, 8, neonOf('#ffd84d'), 1);
    this.light(x, y, 400, 1.2, glow('#ffd84d'), 1);
  }

  /** 떠오르는 글자(스프라이트로 한 번만 그림) */
  text(x: number, y: number, text: string, color = '#fff', size = 14, life = 1.2) {
    if (this.texts.length >= 20) this.texts.shift();
    this.texts.push({ x, y, spr: this.textSprite(text, color, size, false), life, max: life, age: 0, rise: 22, fancy: false, img: null });
  }
  /** 강조 글자(디스플레이 서체 + 그라디언트 + 발광): LEVEL UP!, 격파! 등 */
  title(x: number, y: number, text: string, color: string, size = 22, life = 1.2) {
    if (this.texts.length >= 20) this.texts.shift();
    this.texts.push({ x, y, spr: this.textSprite(text, color, size, true), life, max: life, age: 0, rise: 26, fancy: true, img: glow(color) });
  }

  // ───────────── 피해 숫자 ─────────────

  dmg(x: number, y: number, v: number, crit: boolean, uid: number) {
    if (!this.showNums) return;
    const ex = this.numByUid.get(uid);
    // 같은 적의 연속 타격은 한 숫자로 합치고 다시 튀긴다
    if (ex && ex.age < 0.4 && ex.max - ex.age > 0.2) { this.bump(ex, v, crit); return; }
    if (!crit) {
      // 붙어 있는 다른 적들의 작은 타격(오라·궤도·장판 틱)도 지금 겹쳐 보일 막 생긴 숫자 하나로 합친다
      // — 플레이어를 둘러싼 무리 위에 '10'이 수십 개 쌓여 캐릭터를 가리지 않게. 치명타는 따로 튄다.
      for (const o of this.nums) {
        if (o.crit || o.age >= 0.3 || o.max - o.age <= 0.2) continue;
        const u = o.age / o.max, dx = o.x + o.vx * u - x, dy = o.y - easeOut3(u) * 22 - y;
        if (dx < 20 && dx > -20 && dy < 13 && dy > -13) { this.bump(o, v, false); return; }
      }
    }
    let n: DmgNum;
    if (this.nums.length >= this.maxNums) {
      if (!crit && v < 1000) return;   // 화면이 숫자로 뒤덮이지 않게: 붐빌 땐 치명타·큰 숫자만
      let oi = 0;
      for (let i = 1; i < this.nums.length; i++) if (this.nums[i].age > this.nums[oi].age) oi = i;
      n = this.nums[oi];
      if (this.numByUid.get(n.uid) === n) this.numByUid.delete(n.uid);
    } else {
      n = this.freeN.pop() ?? { x: 0, y: 0, vx: 0, v: 0, crit: false, age: 0, max: 1, pt: 0, amp: 0, uid: 0, txt: '', base: 1, tilt: 0, c: null, cg: null, uw: 0, uh: 0, rs: 1, aid: 0, dirty: true };
      this.nums.push(n);
    }
    n.x = x + (this.rnd() - 0.5) * 8; n.y = y; n.vx = (this.rnd() - 0.5) * 14; n.v = v; n.crit = crit;
    n.age = 0; n.max = crit ? 0.95 : 0.72; n.pt = 0; n.amp = 0.8; n.uid = uid;
    n.txt = fmtDmg(v, crit); n.base = numBase(v, crit); n.tilt = crit ? (this.rnd() - 0.5) * 0.4 : 0; n.dirty = true;
    this.numByUid.set(uid, n);
  }

  /** 살아 있는 숫자에 피해를 더하고 다시 튀긴다 */
  private bump(n: DmgNum, v: number, crit: boolean) {
    n.v += v;
    if (crit && !n.crit) { n.crit = true; n.tilt = (this.rnd() - 0.5) * 0.4; }
    n.txt = fmtDmg(n.v, n.crit); n.base = numBase(n.v, n.crit); n.dirty = true;
    n.pt = 0; n.amp = 0.45; n.max = Math.max(n.max, n.age + 0.6);
  }

  /** 숫자 글리프 아틀라스(디스플레이 서체): 0행 흰색, 1행 치명타 노랑→주황 */
  private getAtlas(): Atlas {
    if (this.atlas && this.atlas.scale === this.numScale) return this.atlas;
    const S = this.numScale, fs = NUM_FS, h = Math.ceil(fs * 1.12 + 4);
    const pitch = Math.ceil((fs * 0.8 + 8) * S) / S;
    const [c, g] = canvas(Math.ceil(pitch * GLYPHS.length * S), Math.ceil(h * 2 * S));
    g.scale(S, S);
    g.font = `900 ${fs}px ${DISPLAY_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const x = new Float32Array(GLYPHS.length), adv = new Float32Array(GLYPHS.length), idx = new Int8Array(128).fill(-1);
    for (let i = 0; i < GLYPHS.length; i++) {
      adv[i] = Math.min(pitch - 4, g.measureText(GLYPHS[i]).width * 0.98);
      x[i] = pitch * i; idx[GLYPHS.charCodeAt(i)] = i;
    }
    for (let row = 0; row < 2; row++) {
      const cy = h * row + h / 2 + 1;
      const gr = g.createLinearGradient(0, cy - fs * 0.45, 0, cy + fs * 0.45);
      if (row) { gr.addColorStop(0, '#fffbd0'); gr.addColorStop(0.32, '#ffe14a'); gr.addColorStop(0.72, '#ff9a1f'); gr.addColorStop(1, '#ff5418'); }
      else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#ffffff'); gr.addColorStop(1, '#c9d6f0'); }
      for (let i = 0; i < GLYPHS.length; i++) {
        const cx = pitch * i + pitch / 2;
        g.strokeStyle = row ? 'rgba(74,14,0,.95)' : 'rgba(14,10,28,.92)';
        g.lineWidth = fs * 0.22;
        g.strokeText(GLYPHS[i], cx, cy + fs * 0.08);   // 아래로 두꺼운 그림자
        g.strokeText(GLYPHS[i], cx, cy);
        g.fillStyle = gr; g.fillText(GLYPHS[i], cx, cy);
      }
    }
    this.atlas = { c, x, adv, idx, w: pitch, h, scale: S, id: ++this.atlasId };
    return this.atlas;
  }

  /** 숫자 한 개를 자기 캔버스에 굽는다(글자·아틀라스가 바뀐 때만). 크기는 기본 크기의 1.35배 해상도(튀어나올 때 여유) */
  private bakeNum(n: DmgNum, A: Atlas) {
    let tw = 0;
    for (let i = 0; i < n.txt.length; i++) { const cc = n.txt.charCodeAt(i), gi = cc < 128 ? A.idx[cc] : -1; if (gi >= 0) tw += A.adv[gi]; }
    const uw = tw + A.w * 0.7, uh = A.h, rs = A.scale * n.base * 1.35;
    const pw = Math.ceil(uw * rs) + 2, ph = Math.ceil(uh * rs) + 2;
    if (!n.c || !n.cg) { n.c = document.createElement('canvas'); n.c.width = 0; n.c.height = 0; n.cg = n.c.getContext('2d')!; }
    if (n.c.width < pw || n.c.height < ph) { n.c.width = Math.max(n.c.width, pw + 16); n.c.height = Math.max(n.c.height, ph); }
    const g = n.cg;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pw + 2, ph + 2);
    g.setTransform(rs, 0, 0, rs, 1, 1);
    this.drawGlyphs(g, A, n.txt, n.crit ? 1 : 0, uw / 2, uh / 2, 1);
    n.uw = uw; n.uh = uh; n.rs = rs; n.aid = A.id; n.dirty = false;
  }

  /** 글리프를 (ox,oy) 중심, 배율 sc로 이어 그린다(현재 변환 기준) */
  private drawGlyphs(g: CanvasRenderingContext2D, A: Atlas, txt: string, row: number, ox: number, oy: number, sc: number) {
    const k = A.scale;
    let tw = 0;
    for (let i = 0; i < txt.length; i++) { const cc = txt.charCodeAt(i), gi = cc < 128 ? A.idx[cc] : -1; if (gi >= 0) tw += A.adv[gi]; }
    let x = ox - (tw * sc) / 2;
    const sy = row * A.h * k, sw = A.w * k, sh = A.h * k, w = A.w * sc, h = A.h * sc, y = oy - h / 2;
    for (let i = 0; i < txt.length; i++) {
      const cc = txt.charCodeAt(i), gi = cc < 128 ? A.idx[cc] : -1;
      if (gi < 0) continue;
      const aw = A.adv[gi] * sc;
      g.drawImage(A.c, A.x[gi] * k, sy, sw, sh, x + aw / 2 - w / 2, y, w, h);
      x += aw;
    }
  }

  private textSprite(text: string, color: string, size: number, fancy: boolean): TextSpr {
    if (this.textScale !== this.numScale) { this.textCache.clear(); this.textScale = this.numScale; }
    const key = `${fancy ? 1 : 0}|${color}|${size}|${text}`;
    let s = this.textCache.get(key);
    if (s) return s;
    if (this.textCache.size >= 40) { const f = this.textCache.keys().next().value; if (f !== undefined) this.textCache.delete(f); }
    const S = this.numScale * 1.25;   // 튀어나올 때 확대돼도 흐려지지 않게 여유 해상도
    const font = `900 ${size}px ${DISPLAY_FONT}`;
    measureCtx ??= canvas(4, 4)[1];
    measureCtx.font = font;
    const tw = measureCtx.measureText(text).width, pad = size * 0.55;
    const w = tw + pad * 2, h = size * 1.4 + pad;
    const [c, g] = canvas(Math.ceil(w * S), Math.ceil(h * S));
    g.scale(S, S);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const cx = w / 2, cy = h / 2, base = rgbOf(color);
    const gr = g.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5);
    if (fancy) {
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, css(mix(base, WHITE, 0.35))); gr.addColorStop(1, css(mix(neon(color), BLACK, 0.12)));
      g.shadowColor = css(neon(color), 0.9); g.shadowBlur = size * 0.5 * S;
      g.strokeStyle = css(mix(base, BLACK, 0.8), 0.95); g.lineWidth = size * 0.26;
      g.strokeText(text, cx, cy);
      g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';
      g.strokeText(text, cx, cy + size * 0.07);
    } else {
      gr.addColorStop(0, css(mix(base, WHITE, 0.25))); gr.addColorStop(0.55, color); gr.addColorStop(1, css(mix(base, BLACK, 0.22)));
      g.strokeStyle = 'rgba(12,8,24,.88)'; g.lineWidth = size * 0.26;
      g.strokeText(text, cx, cy + size * 0.08);
      g.strokeText(text, cx, cy);
    }
    g.fillStyle = gr; g.fillText(text, cx, cy);
    s = { c, w, h };
    this.textCache.set(key, s);
    return s;
  }

  // ───────────── 카메라·화면 ─────────────

  /** 흔들림(트라우마 0~1). cap: 이 값 이상으로는 올리지 않음(잦은 작은 폭발이 화면을 계속 흔들지 않게) */
  addShake(v: number, cap = 1) { if (this.shakeOn && this.shake < cap) this.shake = Math.min(cap, this.shake + v); }
  /** 화면 번쩍임. 지금 것보다 약한 번쩍임은 무시한다(색까지 덮어써 흰 섬광이 다른 색으로 바뀌지 않게) */
  addFlash(v: number, color = '#ffffff') {
    const nv = Math.min(0.85, v);
    if (nv >= this.flash) { this.flash = nv; this.flashColor = color; }
  }
  /** 카메라 킥(CSS px 방향 충격 → 스프링으로 튕기며 복귀) */
  kick(dx: number, dy: number) {
    if (!this.shakeOn) return;
    this.kvx = Math.max(-700, Math.min(700, this.kvx + dx * 24));
    this.kvy = Math.max(-700, Math.min(700, this.kvy + dy * 24));
  }
  kickRand(m: number) { const a = this.rnd() * TAU; this.kick(Math.cos(a) * m, Math.sin(a) * m); }
  /** 줌 펀치(amount = 확대량, 0.08 = 8%) */
  punch(amount: number, dur = 0.5) {
    const cur = this.zoomAmt();
    if (amount < cur) return;
    this.zpFrom = cur; this.zp = amount; this.zpT = 0; this.zpDur = dur;
  }
  private zoomAmt() {
    if (this.zp <= 0) return 0;
    const t = this.zpT;
    if (t < 0.06) { const u = t / 0.06; return this.zpFrom + (this.zp - this.zpFrom) * (1 - (1 - u) * (1 - u)); }
    const u = Math.min(1, (t - 0.06) / this.zpDur);
    return this.zp * (1 - u) * (1 - u);
  }
  /** 화면 확대 펀치(1 = 없음). 궁극기·보스 처치 등에서 잠깐 확대 */
  zoomPunch(): number { const a = this.zoomAmt(); return a > 0 ? 1 + a * (this.shakeOn ? 1 : 0.5) : 1; }

  shakeOffset(): [number, number] {
    let sx = this.kx, sy = this.ky;
    if (this.shake > 0 && this.shakeOn) {
      const t = this.time, m = 15 * this.shake * this.shake;
      sx += m * (Math.sin(t * 71.3) * 0.62 + Math.sin(t * 37.1 + 1.3) * 0.38);
      sy += m * (Math.sin(t * 63.7 + 2.1) * 0.62 + Math.sin(t * 43.9 + 0.4) * 0.38);
    }
    this.so[0] = sx; this.so[1] = sy;
    return this.so;
  }

  /** 화면을 가로지르는 충격파(월드 위치에서 시작) */
  shockScreen(x: number, y: number, color: string, dur = 0.55) { this.swT = 0; this.swX = x; this.swY = y; this.swCol = neonOf(color); this.swDur = dur; }
  /** 피격: 붉은 테두리 펄스 + 색수차 번쩍임 + 킥 */
  hurtScreen() { this.hurtT = 1; this.chromaT = 0.18; this.hurtFl = Math.max(this.hurtFl, 0.14); this.addShake(0.26); this.kickRand(9); }
  /** 궁극기: 흰 섬광 → 화면 충격파 → 집중선 → 줌 펀치 1.08 */
  ultScreen(x: number, y: number, color: string) {
    this.addFlash(0.75, '#ffffff'); this.shockScreen(x, y, color); this.linesT = 0.8;
    this.punch(0.08, 0.7); this.addShake(0.6); this.kickRand(10);
  }
  /** 보스 등장: 레터박스 + 붉은 맥동 */
  bossIntro() { this.boxT = 1.6; this.pulse('red', 1.5); this.addShake(0.3); }
  /** 화면 테두리 맥동 */
  pulse(key: 'red' | 'gold' | 'cyan', dur: number) { this.pulseT = dur; this.pulseMax = dur; this.pulseKey = key; }
  /** 사망 */
  death() { this.flash = Math.max(this.flash, 0.6); this.flashColor = '#000000'; this.hurtT = 1.6; this.chromaT = 0.28; this.punch(0.05, 1.1); this.kickRand(14); this.addShake(0.5); }

  // ───────────── 갱신 ─────────────

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 1.9);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.hurtFl = Math.max(0, this.hurtFl - dt * 2.6);
    this.hurtT = Math.max(0, this.hurtT - dt * 2.2);
    this.chromaT = Math.max(0, this.chromaT - dt);
    this.boxT = Math.max(0, this.boxT - dt);
    this.pulseT = Math.max(0, this.pulseT - dt);
    this.linesT = Math.max(0, this.linesT - dt);
    if (this.swT >= 0) { this.swT += dt; if (this.swT > this.swDur) this.swT = -1; }
    if (this.zp > 0) { this.zpT += dt; if (this.zpT > 0.06 + this.zpDur) this.zp = 0; }
    // 킥 스프링(튕겼다 돌아옴, 한 번 살짝 넘어감)
    let rem = Math.min(dt, 0.1);
    while (rem > 1e-6) {
      const h = Math.min(rem, 1 / 120);
      this.kvx += (-420 * this.kx - 24 * this.kvx) * h; this.kvy += (-420 * this.ky - 24 * this.kvy) * h;
      this.kx += this.kvx * h; this.ky += this.kvy * h;
      rem -= h;
    }
    // 부하(초당 처치·적중·폭발) 지수 평균
    const ka = 1 - Math.exp(-dt / 0.6), inv = 1 / Math.max(dt, 1e-3);
    this.kr += (this.kN * inv - this.kr) * ka; this.hr += (this.hN * inv - this.hr) * ka; this.er += (this.eN * inv - this.er) * ka;
    this.kN = this.hN = this.eN = 0;
    // 프레임 예산(붐빌수록 적게)
    const lh = this.lod(this.hr, 60, 420);
    this.sparkBudget = Math.round((4 + 32 * lh * lh) * this.qMul) + 2;
    this.ringBudget = Math.round((2 + 8 * lh * lh) * this.qMul) + 1;
    const f = dt * 60, D = this.drag;
    for (let i = 0; i < 4; i++) D[i] = Math.pow(DRAG[i], f);
    // 예약 폭발(보스 처치 연쇄)
    if (this.pend.length) {
      let j = 0;
      for (let i = 0; i < this.pend.length; i++) {
        const q = this.pend[i];
        q.t -= dt;
        if (q.t <= 0) { this.explode(q.x, q.y, q.r, q.color, true); if (q.r >= 200) this.addFlash(0.3, '#fff2c0'); else this.addShake(0.12, 0.8); }
        else this.pend[j++] = q;
      }
      this.pend.length = j;
    }
    // 파티클(제자리 압축)
    const P = this.parts;
    let j = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { this.freeP.push(p); continue; }
      const d = D[p.drag];
      p.vx *= d; p.vy *= d;
      const k = p.k;
      if (k === K_SHARD || k === K_CHUNK || k === K_COIN) {
        // 가짜 높이(z): 떠올랐다 떨어져 바닥에서 한 번 튕기고 멈춘다
        if (p.z > 0 || p.vz > 0) {
          p.vz -= p.grav * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
          if (p.z <= 0) {
            p.z = 0;
            if (p.vz < -110) { p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; p.vr *= 0.5; }
            else { p.vz = 0; p.vx *= 0.2; p.vy *= 0.2; p.vr = 0; }
          }
        } else { p.vx *= d; p.vy *= d; }
      } else {
        p.vy += p.grav * dt;
        if (k === K_SMOKE || k === K_FLAME) p.size += p.len * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      P[j++] = p;
    }
    P.length = j;
    // 피해 숫자
    const N = this.nums;
    j = 0;
    for (let i = 0; i < N.length; i++) {
      const n = N[i];
      n.age += dt; n.pt += dt;
      if (n.age >= n.max) { if (this.numByUid.get(n.uid) === n) this.numByUid.delete(n.uid); this.freeN.push(n); continue; }
      N[j++] = n;
    }
    N.length = j;
    compact(this.booms, dt);
    const Q = this.pops;
    j = 0;
    for (let i = 0; i < Q.length; i++) { const q = Q[i]; q.life -= dt; if (q.life > 0) Q[j++] = q; else this.freePop.push(q); }
    Q.length = j;
    compact(this.lights, dt);
    compact(this.marks, dt);
    compact(this.rays, dt);
    const Wv = this.waves;
    j = 0;
    for (let i = 0; i < Wv.length; i++) {
      const w = Wv[i];
      if (w.d > 0) w.d -= dt; else w.life -= dt;
      if (w.life > 0) Wv[j++] = w;
    }
    Wv.length = j;
    const B = this.bolts;
    j = 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      b.life -= dt;
      if (b.life <= 0) continue;
      if (!b.rj && b.life < b.max * 0.55) { b.rj = true; this.jag(b); }
      B[j++] = b;
    }
    B.length = j;
    const T = this.texts;
    j = 0;
    for (let i = 0; i < T.length; i++) { const t = T[i]; t.life -= dt; t.age += dt; if (t.life > 0) T[j++] = t; }
    T.length = j;
  }

  // ───────────── 그리기 ─────────────

  /** 바닥 레이어(적 아래): 잉크 자국·그을음·먼지 고리 */
  drawGround(g: CanvasRenderingContext2D, v: View) {
    const S = v.S, bx = v.bx, by = v.by;
    const x0 = v.x0 - 60, x1 = v.x1 + 60, y0 = v.y0 - 60, y1 = v.y1 + 60;
    if (this.marks.length) {
      for (const m of this.marks) {
        if (m.x < x0 - m.size || m.x > x1 + m.size || m.y < y0 - m.size || m.y > y1 + m.size) continue;
        const a = m.a * Math.min(1, m.life / 1.6) * Math.min(1, (m.max - m.life) / 0.06);
        if (a < 0.01) continue;
        g.globalAlpha = a;
        g.setTransform(m.fx * m.size * S, 0, 0, m.fy * m.size * S, bx + m.x * S, by + m.y * S);
        g.drawImage(m.img, m.sx, m.sy, m.sw, m.sh, -1, -1, 2, 2);
      }
      g.setTransform(S, 0, 0, S, bx, by);
    }
    for (const w of this.waves) {
      if (!w.ground || w.d > 0) continue;
      const t = 1 - w.life / w.max, r = w.r0 + (w.r1 - w.r0) * easeOut3(t);
      g.globalAlpha = w.a * (1 - t);
      g.strokeStyle = w.col; g.lineWidth = Math.max(0.5, w.w * (1 - t * 0.7));
      g.beginPath(); g.arc(w.x, w.y, r, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** 월드 레이어(적 위): 연기 → 불길·불덩이 → 색종이·파편 → 충격파·빛줄기·고리·불꽃·번개 → (가산) 섬광·번개 빛. 숫자·글자는 drawLabels */
  drawWorld(g: CanvasRenderingContext2D, v: View) {
    const S = v.S, bx = v.bx, by = v.by, op = g.globalCompositeOperation;
    this.camX = (v.x0 + v.x1) / 2; this.camY = (v.y0 + v.y1) / 2;
    const x0 = v.x0 - 40, x1 = v.x1 + 40, y0 = v.y0 - 40, y1 = v.y1 + 40;
    const P = this.parts;
    let add = false, bits = false, flame = false;
    // 연기
    for (const p of P) {
      const k = p.k;
      if (k === K_FLAME) { flame = true; continue; }
      if (k !== K_SMOKE) { if (k === K_SHARD || k === K_CHUNK || k === K_COIN) bits = true; else add = true; continue; }
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const t = p.life / p.max;
      g.globalAlpha = p.a * Math.min(1, (p.max - p.life) / 0.12) * t;
      const s = p.size;
      g.drawImage(p.img, p.rot, 0, 64, 64, p.x - s, p.y - s, s * 2, s * 2);
    }
    // 불길
    if (flame) {
      for (const p of P) {
        if (p.k !== K_FLAME || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        const t = p.life / p.max, s = p.size;
        g.globalAlpha = Math.pow(t, 1.3);
        g.drawImage(p.img, G_FIRE, 0, 64, 64, p.x - s, p.y - s, s * 2, s * 2);
      }
    }
    // 폭발 몸통(불덩이)
    for (const b of this.booms) {
      if (!b.fire) continue;
      const t = 1 - b.life / b.max;
      if (t > 0.62) continue;
      const u = t / 0.62, r = b.r * (0.4 + 0.42 * (1 - (1 - u) * (1 - u)));
      g.globalAlpha = Math.pow(1 - u, 1.3);
      g.drawImage(b.img, G_FIRE, 0, 64, 64, b.x - r, b.y - r, r * 2, r * 2);
    }
    // 색종이·파편·동전: 회전 대신 가로·세로 폭을 따로 흔들어 공중에서 뒤집히는 느낌(축 정렬 그리기)
    if (bits) {
      for (const p of P) {
        const k = p.k;
        if ((k !== K_SHARD && k !== K_CHUNK && k !== K_COIN) || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        g.globalAlpha = p.life < 0.35 ? p.life / 0.35 : 1;
        const y = p.y - p.z, r = p.rot;
        if (k === K_COIN) {
          const w = p.size * (0.2 + 0.8 * Math.abs(Math.cos(r)));
          g.drawImage(p.img, 256, 16, 16, 16, p.x - w, y - p.size, w * 2, p.size * 2);
        } else if (k === K_SHARD) {
          const fh = Math.abs(Math.sin(r * 1.3 + 0.7)), w = p.size * (0.3 + 0.7 * Math.abs(Math.cos(r))), h = p.size * 0.62 * (0.35 + 0.65 * fh);
          const face = inkFace.get(p.img);
          if (face) { g.fillStyle = fh > 0.85 ? face[1] : face[0]; g.fillRect(p.x - w, y - h, w * 2, h * 2); }
          else g.drawImage(p.img, 256, 0, 16, 10, p.x - w, y - h, w * 2, h * 2);
        } else {
          const w = p.size * (0.75 + 0.25 * Math.cos(r)), h = p.size * (0.75 + 0.25 * Math.sin(r));
          g.drawImage(p.img, 272, 0, 14, 14, p.x - w, y - h, w * 2, h * 2);
        }
      }
    }
    // 충격파 고리
    if (this.waves.length) {
      for (const w of this.waves) {
        if (w.ground || w.d > 0) continue;
        const t = 1 - w.life / w.max, r = w.r0 + (w.r1 - w.r0) * easeOut3(t);
        if (w.x + r < x0 || w.x - r > x1 || w.y + r < y0 || w.y - r > y1) continue;
        const a = (1 - t) * (1 - t * 0.6) * w.a;
        g.strokeStyle = w.col; g.globalAlpha = a * 0.6; g.lineWidth = Math.max(0.6, w.w * (1 - t * 0.75));
        g.beginPath(); g.arc(w.x, w.y, r, 0, TAU); g.stroke();
        g.strokeStyle = '#ffffff'; g.globalAlpha = a * 0.85; g.lineWidth = Math.max(0.5, w.w * 0.28 * (1 - t));
        g.beginPath(); g.arc(w.x, w.y, r, 0, TAU); g.stroke();
      }
    }
    // 빛줄기(레벨업·진화·궁극기)
    if (this.rays.length) {
      for (const r of this.rays) {
        const t = 1 - r.life / r.max, env = Math.min(1, t / 0.08) * Math.pow(1 - t, 1.4);
        g.globalAlpha = env * 0.4;
        const R = r.len * 0.5;
        g.drawImage(r.img, G_SOFT, 0, 64, 64, r.x - R, r.y - R, R * 2, R * 2);
        g.globalAlpha = env * 0.6;
        for (let i = 0; i < r.n; i++) {
          const ang = r.rot + (i / r.n) * TAU + this.time * 0.5, dx = Math.cos(ang), dy = Math.sin(ang);
          const L = r.len * (0.65 + 0.35 * Math.sin(i * 2.3 + this.time * 4)) * (0.55 + 0.45 * env), W = r.len * 0.2;
          g.setTransform(-dy * W * S, dx * W * S, -dx * L * S, -dy * L * S, bx + r.x * S, by + r.y * S);
          g.drawImage(r.img, 304, 16, 16, 48, -0.5, -1, 1, 1);
        }
        g.setTransform(S, 0, 0, S, bx, by);
      }
    }
    // 팝(충격 고리·별)
    for (const q of this.pops) {
      if (q.cell === G_CORE || q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) continue;
      const t = 1 - q.life / q.max, r = q.r0 + (q.r1 - q.r0) * (1 - (1 - t) * (1 - t));
      g.globalAlpha = q.a * (q.cell === G_RING ? 1 - t : (1 - t) * (1 - t));
      if (q.cell === G_STAR) {
        const rx = r * (1 + 0.25 * Math.sin(q.rot * 7)), ry = r * (1 - 0.25 * Math.sin(q.rot * 7));
        g.drawImage(q.img, G_STAR, 0, 64, 64, q.x - rx, q.y - ry, rx * 2, ry * 2);
      } else g.drawImage(q.img, q.cell, 0, 64, 64, q.x - r, q.y - r, r * 2, r * 2);
    }
    // 불꽃 줄: 진행 방향에 가장 가까운 미리 돌린 셀을 골라 좌우·상하 뒤집기만(회전 없이) 그린다
    if (add) {
      let flipped = false;   // 지금 변환이 뒤집힌 불꽃 줄용인지(월드 좌표로 그리기 전에 되돌린다)
      for (const p of P) {
        if (p.k !== K_SPARK || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        const t = p.life / p.max, vx = p.vx, vy = p.vy, ax = vx < 0 ? -vx : vx, ay = vy < 0 ? -vy : vy;
        const sp = Math.sqrt(ax * ax + ay * ay);
        // 0~90° 각도 칸(tan 22.5°·67.5° 경계로 atan 없이 고름)
        const k = ay < ax * 0.1989 ? 0 : ay < ax * 0.6682 ? 1 : ay < ax * 1.4966 ? 2 : ay < ax * 5.0273 ? 3 : 4;
        const L = p.len * (0.6 + Math.min(1.3, sp / 260)) * (0.5 + 0.5 * t) * 1.5;
        const hx = HEAD_X[k], hy = HEAD_Y[k];
        g.globalAlpha = t < 0.5 ? t / 0.5 : 1;
        if (vx < 0 || vy < 0) {
          g.setTransform(vx < 0 ? -L * S : L * S, 0, 0, vy < 0 ? -L * S : L * S, bx + p.x * S, by + p.y * S);
          g.drawImage(p.img, k * 32, 64, 32, 32, -0.5 - hx, -0.5 - hy, 1, 1);
          flipped = true;
        } else {
          if (flipped) { g.setTransform(S, 0, 0, S, bx, by); flipped = false; }
          g.drawImage(p.img, k * 32, 64, 32, 32, p.x - (0.5 + hx) * L, p.y - (0.5 + hy) * L, L, L);
        }
      }
      if (flipped) g.setTransform(S, 0, 0, S, bx, by);
      // 불씨·별·십자(월드 좌표 그대로)
      for (const p of P) {
        const k = p.k;
        if ((k !== K_EMBER && k !== K_STAR && k !== K_PLUS) || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        const t = p.life / p.max;
        if (k === K_EMBER) {
          const s = p.size * (0.35 + 0.65 * t) * 2;
          g.globalAlpha = Math.min(1, t * 2);
          g.drawImage(p.img, G_CORE, 0, 64, 64, p.x - s, p.y - s, s * 2, s * 2);
        } else if (k === K_STAR) {
          const tw = 0.6 + 0.4 * Math.sin(this.time * 26 + p.x * 0.7);
          const s = p.size * (0.5 + 0.5 * t) * (0.75 + 0.25 * tw);
          g.globalAlpha = Math.min(1, t * 2.2) * tw;
          g.drawImage(p.img, G_STAR, 0, 64, 64, p.x - s, p.y - s, s * 2, s * 2);
        } else {
          const s = p.size * (0.7 + 0.3 * t);
          g.globalAlpha = Math.min(1, t * 2.5);
          g.drawImage(p.img, 256, 24, 32, 32, p.x - s, p.y - s, s * 2, s * 2);
        }
      }
    }
    // 번개
    if (this.bolts.length) {
      g.lineCap = 'round'; g.lineJoin = 'bevel';
      for (const b of this.bolts) {
        const a = b.life / b.max, fl = 0.7 + 0.3 * this.rnd();
        g.strokeStyle = b.col;
        g.globalAlpha = 0.75 * a * fl; g.lineWidth = 3.4; g.stroke(b.path);
        g.strokeStyle = '#ffffff';
        g.globalAlpha = a; g.lineWidth = 1.2; g.stroke(b.path);
      }
    }
    // ── 가산 합성: 뜨거운 심(폭발 섬광·처치 섬광·번개 빛)만. 나머지는 밝은 바닥에서도 보이게 일반 합성 ──
    g.globalCompositeOperation = 'lighter';
    // 번개 빛: 굵은 선 긋기 대신 경로를 따라 부드러운 빛 조각을 찍는다(축 정렬 사각형이라 싸다)
    let glowLeft = 30;   // 프레임당 번개 빛 조각 상한
    for (let bi = this.bolts.length - 1; bi >= 0 && glowLeft > 0; bi--) {
      const b = this.bolts[bi], pts = b.pts, a = (b.life / b.max) * (0.7 + 0.3 * this.rnd());
      g.globalAlpha = 0.45 * a;
      for (let i = 0; i + 3 < pts.length && glowLeft > 0; i += 2) {
        const ax = pts[i], ay = pts[i + 1], dx = pts[i + 2] - ax, dy = pts[i + 3] - ay;
        const n = Math.max(2, Math.min(7, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 32)));
        for (let k = 0; k <= n; k++) { const t = k / n; g.drawImage(b.img, G_SOFT, 0, 64, 64, ax + dx * t - 15, ay + dy * t - 15, 30, 30); }
        glowLeft -= n + 1;
      }
    }
    // 폭발 섬광 원
    for (const b of this.booms) {
      const t = 1 - b.life / b.max;
      if (t > 0.26) continue;
      const u = t / 0.26, r = b.r * (0.26 + 0.5 * u);
      g.globalAlpha = (1 - u) * (1 - u);
      g.drawImage(b.img, G_CORE, 0, 64, 64, b.x - r, b.y - r, r * 2, r * 2);
    }
    for (const q of this.pops) {
      if (q.cell !== G_CORE || q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) continue;
      const t = 1 - q.life / q.max, r = q.r0 + (q.r1 - q.r0) * (1 - (1 - t) * (1 - t));
      g.globalAlpha = q.a * (1 - t) * (1 - t);
      g.drawImage(q.img, G_CORE, 0, 64, 64, q.x - r, q.y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = op;
    // 숫자·글자는 조명 뒤 drawLabels에서 그린다(그 훅을 부르지 않는 렌더러면 여기서 그대로 그린다)
    if (!this.labelsHooked) this.labels(g, v);
    g.globalAlpha = 1;
  }

  /** 글자 레이어(월드, 조명·블룸 뒤 · 월드 UI 앞): 피해 숫자·떠오르는 글자.
   *  어둠 오버레이·비네트 아래에 깔리면 플레이어 등불 밖의 숫자가 회색으로 죽어서, 조명과 무관하게 또렷한 흰색·노랑으로 얹는다. */
  drawLabels(g: CanvasRenderingContext2D, v: View) {
    this.labelsHooked = true;
    this.labels(g, v);
    g.globalAlpha = 1;
  }

  private labels(g: CanvasRenderingContext2D, v: View) {
    const S = v.S, bx = v.bx, by = v.by;
    const x0 = v.x0 - 40, x1 = v.x1 + 40, y0 = v.y0 - 40, y1 = v.y1 + 40;
    // 피해 숫자
    if (this.nums.length) {
      const A = this.getAtlas();
      for (const n of this.nums) {
        if (n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1) continue;
        const tl = n.max - n.age, u = Math.min(1, n.age / n.max);
        const pop = 1 + n.amp * Math.exp(-n.pt * 13) * Math.cos(n.pt * 24);
        const fade = tl < 0.26 ? tl / 0.26 : 1;
        const sc = n.base * pop * (0.72 + 0.28 * fade);
        const rise = easeOut3(u) * (n.crit ? 30 : 22);
        g.globalAlpha = fade;
        const nx = n.x + n.vx * u, ny = n.y - rise;
        if (n.dirty || n.aid !== A.id) this.bakeNum(n, A);
        const c = n.c!, pw = Math.ceil(n.uw * n.rs), ph = Math.ceil(n.uh * n.rs), w = n.uw * sc, h = n.uh * sc;
        if (n.tilt) {
          // 치명타만 기울임(회전 행렬 한 번), 나머지는 월드 변환 그대로 사각형 하나
          const cs = Math.cos(n.tilt) * S, sn = Math.sin(n.tilt) * S;
          g.setTransform(cs, sn, -sn, cs, bx + nx * S, by + ny * S);
          g.drawImage(c, 1, 1, pw, ph, -w / 2, -h / 2, w, h);
          g.setTransform(S, 0, 0, S, bx, by);
        } else g.drawImage(c, 1, 1, pw, ph, nx - w / 2, ny - h / 2, w, h);
      }
    }
    // 떠오르는 글자
    for (const t of this.texts) {
      const u = t.age / t.max;
      const pop = 1 + (t.fancy ? 0.7 : 0.4) * Math.exp(-t.age * 11) * Math.cos(t.age * 20);
      g.globalAlpha = t.life < t.max * 0.3 ? t.life / (t.max * 0.3) : 1;
      const w = t.spr.w * pop, h = t.spr.h * pop, y = t.y - easeOut3(Math.min(1, u * 1.3)) * t.rise;
      g.drawImage(t.spr.c, t.x - w / 2, y - h / 2, w, h);
    }
  }

  /** 블룸 버퍼용: 빛나는 심만(가산 합성, 저해상도 버퍼) */
  drawGlow(g: CanvasRenderingContext2D, v: View) {
    if (v.quality === 'low') return;   // 계약상 low에서는 불리지 않는다(임시 렌더러 대비)
    const op = g.globalCompositeOperation;
    const x0 = v.x0 - 40, x1 = v.x1 + 40, y0 = v.y0 - 40, y1 = v.y1 + 40;
    g.globalCompositeOperation = 'lighter';
    for (const b of this.booms) {
      const t = 1 - b.life / b.max, r = b.r * (0.45 + 0.3 * t);
      g.globalAlpha = 0.5 * (1 - t) * (1 - t);
      g.drawImage(b.img, G_SOFT, 0, 64, 64, b.x - r, b.y - r, r * 2, r * 2);
    }
    // 작은 적중 섬광·고리는 빼고 큰 섬광만(수가 많아 블룸 버퍼만 채운다)
    for (const q of this.pops) {
      if (q.r1 < 22) continue;
      const t = 1 - q.life / q.max, r = (q.r0 + (q.r1 - q.r0) * t) * 1.2;
      g.globalAlpha = q.a * 0.4 * (1 - t);
      g.drawImage(q.img, G_SOFT, 0, 64, 64, q.x - r, q.y - r, r * 2, r * 2);
    }
    for (const p of this.parts) {
      const k = p.k;
      // 불꽃 줄은 제외(수가 많고 가늘어 블룸 효과가 작다) — 불씨·별·십자·불길만
      if (k === K_SHARD || k === K_CHUNK || k === K_COIN || k === K_SMOKE || k === K_SPARK) continue;
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const t = p.life / p.max, s = (k === K_FLAME ? p.size * 1.1 : p.size * 2.4) * (0.5 + 0.5 * t);
      g.globalAlpha = 0.4 * t;
      g.drawImage(p.img, G_SOFT, 0, 64, 64, p.x - s, p.y - s, s * 2, s * 2);
    }
    for (const b of this.bolts) {
      const a = 0.55 * (b.life / b.max), pts = b.pts, img = b.img;
      g.globalAlpha = a;
      for (let i = 2; i + 1 < pts.length; i += 2) g.drawImage(img, G_SOFT, 0, 64, 64, pts[i] - 18, pts[i + 1] - 18, 36, 36);
    }
    for (const r of this.rays) {
      const t = 1 - r.life / r.max, R = r.len * 0.7;
      g.globalAlpha = 0.35 * Math.min(1, t / 0.08) * (1 - t);
      g.drawImage(r.img, G_SOFT, 0, 64, 64, r.x - R, r.y - R, R * 2, R * 2);
    }
    if (this.nums.length) {
      const gy = glow('#ffb020');
      for (const n of this.nums) {
        if (!n.crit && n.v < 1000) continue;
        const s = n.base * NUM_FS * 0.9, f = Math.min(1, (n.max - n.age) / 0.26), u = Math.min(1, n.age / n.max);
        g.globalAlpha = 0.3 * f;
        g.drawImage(gy, G_SOFT, 0, 64, 64, n.x + n.vx * u - s * 1.4, n.y - easeOut3(u) * (n.crit ? 30 : 22) - s, s * 2.8, s * 2);
      }
    }
    for (const t of this.texts) {
      if (!t.img) continue;
      const w = t.spr.w * 0.8, h = t.spr.h * 0.9, y = t.y - easeOut3(Math.min(1, (t.age / t.max) * 1.3)) * t.rise;
      g.globalAlpha = 0.35 * Math.min(1, t.life / (t.max * 0.3));
      g.drawImage(t.img, G_SOFT, 0, 64, 64, t.x - w / 2, y - h / 2, w, h);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = op;
  }

  /** 조명 레이어: 동적 광원(가산) */
  drawLights(g: CanvasRenderingContext2D, v: View) {
    if (!this.lights.length || v.quality === 'low') return;
    const op = g.globalCompositeOperation;
    const x0 = v.x0, x1 = v.x1, y0 = v.y0, y1 = v.y1;
    g.globalCompositeOperation = 'lighter';
    // 빛 면적 예산(월드 단위², 화면 약 1.2장): 큰 빛이 여러 개 겹치는 순간에도 채우기 비용이 폭주하지 않게
    let area = (x1 - x0) * (y1 - y0) * 1.2, drawn = false;
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.x + l.r < x0 || l.x - l.r > x1 || l.y + l.r < y0 || l.y - l.r > y1) continue;
      const need = 4 * l.r * l.r;
      if (drawn && need > area) continue;   // 가장 최근 빛은 항상, 나머지는 예산 안에서만
      area -= need; drawn = true;
      const t = l.life / l.max;
      g.globalAlpha = Math.min(1, l.a * LIGHT_K * t * (0.45 + 0.55 * t));
      g.drawImage(l.img, G_SOFT, 0, 64, 64, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = op;
  }

  /** 화면 공간 오버레이(CSS px 좌표계, dpr 변환 적용 상태) */
  drawScreen(g: CanvasRenderingContext2D, v: View) {
    const W = v.W, H = v.H, op = g.globalCompositeOperation;
    // 집중선(궁극기)
    if (this.linesT > 0) {
      const k = this.linesT / 0.8, env = Math.min(1, (0.8 - this.linesT) / 0.08) * k;
      const cx = W / 2, cy = H / 2, D = Math.hypot(W, H) * 0.6;
      g.fillStyle = '#ffffff'; g.globalAlpha = 0.55 * env;
      g.beginPath();
      for (let i = 0; i < 44; i++) {
        const a = this.rnd() * TAU, r0 = D * (0.42 + this.rnd() * 0.3), w = 0.006 + this.rnd() * 0.012;
        g.moveTo(cx + Math.cos(a - w) * D * 1.3, cy + Math.sin(a - w) * D * 1.3);
        g.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a + w) * D * 1.3, cy + Math.sin(a + w) * D * 1.3);
        g.closePath();
      }
      g.fill();
    }
    // 화면을 가로지르는 충격파
    if (this.swT >= 0) {
      const t = this.swT / this.swDur, e = easeOut3(t);
      const sx = (this.swX * v.S + v.bx) / v.dpr, sy = (this.swY * v.S + v.by) / v.dpr;
      const R = 12 + e * Math.hypot(W, H) * 1.05;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = this.swCol; g.globalAlpha = (1 - t) * 0.55; g.lineWidth = 46 * (1 - t) + 6;
      g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.stroke();
      g.strokeStyle = '#ffffff'; g.globalAlpha = (1 - t) * 0.9; g.lineWidth = 10 * (1 - t) + 2;
      g.beginPath(); g.arc(sx, sy, R * 0.985, 0, TAU); g.stroke();
      g.globalCompositeOperation = op;
    }
    // 피격·보스 등장 붉은 테두리(맥동)
    let red = this.hurtT > 0 ? Math.pow(this.hurtT, 1.4) * 0.8 : 0;
    let gold = 0, cyan = 0;
    if (this.pulseT > 0) {
      const ph = (this.pulseMax - this.pulseT) * 2.1, a = Math.pow(Math.sin(Math.PI * (ph % 1)), 2) * 0.75 * Math.sqrt(this.pulseT / this.pulseMax);
      if (this.pulseKey === 'red') red = Math.max(red, a); else if (this.pulseKey === 'gold') gold = a; else cyan = a;
    }
    if (red > 0.01) { g.globalAlpha = Math.min(1, red); g.drawImage(border(B_RED, 'red'), 0, 0, W, H); }
    if (gold > 0.01) { g.globalAlpha = Math.min(1, gold); g.drawImage(border(B_GOLD, 'gold'), 0, 0, W, H); }
    if (cyan > 0.01) { g.globalAlpha = Math.min(1, cyan); g.drawImage(border(B_CYAN, 'cyan'), 0, 0, W, H); }
    // 색수차 느낌: 붉은 테두리 옆으로 어긋난 청록 테두리를 살짝 가산(가장자리에 색 번짐)
    if (this.chromaT > 0) {
      const k = Math.min(1, this.chromaT / 0.18), o = 9 * k;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3 * k;
      g.drawImage(border(B_CYAN, 'cyan'), o, -o * 0.5, W, H);
      g.globalCompositeOperation = op;
      g.globalAlpha = 0.35 * k;
      g.drawImage(border(B_RED, 'red'), -o, o * 0.5, W, H);
    }
    // 레터박스(보스 등장)
    if (this.boxT > 0) {
      const t = this.boxT, e = t > 1.25 ? (1.6 - t) / 0.35 : t < 0.4 ? t / 0.4 : 1, k = e * e * (3 - 2 * e);
      const bh = H * 0.085 * k;
      g.globalAlpha = 0.94; g.fillStyle = '#05030a';
      g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
      g.globalAlpha = k * (0.65 + 0.35 * Math.sin(this.time * 12)); g.fillStyle = '#ff2e4d';
      g.fillRect(0, bh - 2, W, 2); g.fillRect(0, H - bh, W, 2);
    }
    // 번쩍임
    if (this.flash > 0) { g.globalAlpha = this.flash; g.fillStyle = this.flashColor; g.fillRect(0, 0, W, H); }
    if (this.hurtFl > 0) { g.globalAlpha = this.hurtFl; g.fillStyle = '#ff2244'; g.fillRect(0, 0, W, H); }
    g.globalAlpha = 1;
  }
}

/** 수명(life)만 줄여 제자리 압축 */
function compact<T extends { life: number }>(arr: T[], dt: number) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) { const o = arr[i]; o.life -= dt; if (o.life > 0) arr[j++] = o; }
  arr.length = j;
}
