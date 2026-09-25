// 색 유틸: 16진 색 ↔ rgb, 네온(발광용 밝은 색), 섞기, 명도 조절. 결과는 캐시해 프레임마다 문자열을 만들지 않는다.

export type RGB = [number, number, number];

const rgbCache = new Map<string, RGB>();

/** '#rgb' / '#rrggbb' / 'rgb(...)' → [r,g,b] (0..255). 알 수 없는 형식은 회색 */
export function rgbOf(c: string): RGB {
  let v = rgbCache.get(c);
  if (v) return v;
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const m = c.match(/[\d.]+/g);
    v = m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  if (rgbCache.size > 400) rgbCache.clear();
  rgbCache.set(c, v);
  return v;
}

export function rgba(c: RGB, a: number): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.round(a * 1000) / 1000})`;
}

export function hex(c: RGB): string {
  const h = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

export function mix(a: string, b: string, k: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  return hex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

/** 명도 배율(0 = 검정, 1 = 그대로) */
export function shade(c: string, k: number): string {
  const x = rgbOf(c);
  return hex([x[0] * k, x[1] * k, x[2] * k]);
}

const neonCache = new Map<string, string>();
/** 발광용 색: 색상은 유지하고 가장 밝은 채널을 끌어올려 어두운 무기색(남색·갈색)도 빛나게 만든다 */
export function neon(c: string): string {
  let v = neonCache.get(c);
  if (v) return v;
  const [r, g, b] = rgbOf(c);
  const mx = Math.max(r, g, b, 1), mn = Math.min(r, g, b);
  const sat = (mx - mn) / mx;
  const k = 255 / mx;
  // 채도가 낮은 색(회색·흰색)은 살짝 푸른 흰빛으로
  const out: RGB = sat < 0.15 ? [Math.min(255, r * k * 0.92 + 20), Math.min(255, g * k * 0.96 + 20), 255] : [r * k, g * k, b * k];
  // 너무 짙은 원색은 흰빛을 조금 섞어 심이 밝게
  const lift = 0.18;
  v = hex([out[0] + (255 - out[0]) * lift, out[1] + (255 - out[1]) * lift, out[2] + (255 - out[2]) * lift]);
  if (neonCache.size > 200) neonCache.clear();
  neonCache.set(c, v);
  return v;
}

/** 채도 빼고 어둡게(배경 소품용) */
export function mute(c: string, value: number, keepSat = 0.35): string {
  const [r, g, b] = rgbOf(c);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  const k = value * 255 / Math.max(1, l);
  return hex([(l + (r - l) * keepSat) * k, (l + (g - l) * keepSat) * k, (l + (b - l) * keepSat) * k]);
}

export function hexA(c: string, a: number): string {
  if (!c.startsWith('#')) return c;
  return rgba(rgbOf(c), a);
}

/** 'rgba(r,g,b,a)'의 a(없으면 1) */
export function alphaOf(c: string): number {
  if (!c.startsWith('rgba')) return 1;
  const m = c.match(/[\d.]+/g);
  return m && m.length >= 4 ? +m[3] : 1;
}
