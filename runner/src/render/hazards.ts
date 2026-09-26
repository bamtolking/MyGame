// Hazard drawing (GDD 11.3 / 11.4). Same silhouette in every biome, only the skin changes:
//   spike ▲ = 석쇠 꼬챙이 / 소라 껍데기 더미 / 폭죽 상자 / 뾰족 기와      (jump)
//   tall  ⇈ = 찜통 탑 / 쌓인 플라스틱 의자 / 불꽃 발사대 / 굴뚝          (double jump)
//   hang  ▼ = 청사초롱 줄 / 천막 끝자락 / 불꽃 현수막 / 빨랫줄          (slide)
// Rules: (1) the drawn body always COVERS the hitbox (decorative tips may stick out past it, never the reverse);
// (2) every hazard has the double outline — outer 3 px OUTLINE_OUT + inner 1.5 px OUTLINE_IN — which is used for
// nothing else, so hazards read by shape + outline on any background; (3) bodies are dark, low-saturation, one hue
// per kind (colour is only a secondary cue); (4) hazards are angular, pickups are round and soft.
// Spikes and towers are pre-rendered sprites (per skin + colour + resolution); the hanging slab has variable size
// and is drawn with a few batched paths.
import type { Hazard } from '../sim/types';
import { BIOMES, BIOME_BY_ID, type BiomeDef } from '../data/biomes';
import { SPIKE_H, SPIKE_W, SPIKE_TIP_W, TALL_H, TALL_W } from '../data/physics';
import { makeCanvas, worldRes, SpriteCache, mix, rgba, lighten, darken } from './backdrops';

export type HazardStyle = BiomeDef['style'];
export const OUTLINE_OUT = '#140c1c';
export const OUTLINE_IN = '#fff6e0';
/** @deprecated kept for older imports: the reserved hazard line colour */
export const HAZARD_RIM = OUTLINE_IN;

const STYLE_BY_COLOR = new Map<string, HazardStyle>();
for (const b of BIOMES) for (const k of ['spike', 'tall', 'hang'] as const) STYLE_BY_COLOR.set(b.hazard[k].toLowerCase(), b.style);
function styleOf(given: HazardStyle | undefined, biome: string | null, col: string): HazardStyle {
  return given ?? (biome ? BIOME_BY_ID[biome]?.style : undefined) ?? STYLE_BY_COLOR.get(col.toLowerCase()) ?? 'market';
}

/** fill + double outline + clipped decoration for a closed path */
function outlined(g: CanvasRenderingContext2D, path: () => void, body: string, decorate: () => void): void {
  g.lineJoin = 'miter'; g.miterLimit = 3;
  path(); g.strokeStyle = OUTLINE_OUT; g.lineWidth = 7.5; g.stroke();     // 3 px visible outside the inner line
  g.fillStyle = body; g.fill();
  g.save(); path(); g.clip(); decorate(); g.restore();
  path(); g.strokeStyle = OUTLINE_IN; g.lineWidth = 1.5; g.stroke();
}
function poly(g: CanvasRenderingContext2D, pts: number[]): void { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
function chevronUp(g: CanvasPath, x: number, y: number, w: number, th: number): void {
  g.moveTo(x - w / 2, y + w * 0.45); g.lineTo(x, y); g.lineTo(x + w / 2, y + w * 0.45); g.lineTo(x + w / 2, y + w * 0.45 + th); g.lineTo(x, y + th); g.lineTo(x - w / 2, y + w * 0.45 + th); g.closePath();
}
function chevronDown(g: CanvasPath, x: number, y: number, w: number, th: number): void {
  g.moveTo(x - w / 2, y - w * 0.45); g.lineTo(x, y); g.lineTo(x + w / 2, y - w * 0.45); g.lineTo(x + w / 2, y - w * 0.45 - th); g.lineTo(x, y - th); g.lineTo(x - w / 2, y - w * 0.45 - th); g.closePath();
}

const sprites = new SpriteCache(48);

// ---------------------------------------------------------------- spike ▲ (local origin = bottom centre of the hitbox)
const SP_L = 28, SP_UP = 62, SP_DN = 6;          // sprite extent: ±28 wide, 62 up, 6 down
const HB = SPIKE_W / 2, TIP = SPIKE_TIP_W / 2;   // 15, 6
/** triangular-ish silhouette that covers the compound box (30×18 base + 12×18 tip) */
const SPIKE_PTS = [-HB - 3, 0, -HB - 1.5, -SPIKE_H / 2, -TIP - 1, -SPIKE_H, 0, -SPIKE_H - 12, TIP + 1, -SPIKE_H, HB + 1.5, -SPIKE_H / 2, HB + 3, 0];

function paintSpike(g: CanvasRenderingContext2D, st: HazardStyle, col: string): void {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 1, 24, 4.5, 0, 0, Math.PI * 2); g.fill();
  const hi = lighten(col, 0.22), lo = darken(col, 0.35), cream = rgba(OUTLINE_IN, 0.85);
  outlined(g, () => poly(g, SPIKE_PTS), col, () => {
    const H = SPIKE_H, base = -H / 2;
    if (st === 'market') {
      // 석쇠 꼬챙이: a little charcoal grill with three skewers of grilled bits fanning up to the point
      g.fillStyle = lo; g.fillRect(-24, base, 48, 20);
      g.fillStyle = hi; for (let y = base + 3; y < 0; y += 5) g.fillRect(-24, y, 48, 1.6);
      g.fillStyle = rgba('#ff9a3c', 0.55); for (let x = -12; x <= 12; x += 8) g.fillRect(x - 1.5, -4, 3, 2.5);
      g.strokeStyle = cream; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-9, base); g.lineTo(-2.5, -H - 6); g.moveTo(0, base); g.lineTo(0, -H - 12); g.moveTo(9, base); g.lineTo(2.5, -H - 6); g.stroke();
      g.fillStyle = hi; for (const [x, y] of [[-6.5, -24], [-4.4, -31], [0, -27], [0, -36], [6.5, -24], [4.4, -31]]) { g.save(); g.translate(x, y); g.rotate(0.785); g.fillRect(-2.6, -2.6, 5.2, 5.2); g.restore(); }
    } else if (st === 'riverside') {
      // 소라 껍데기 더미: a heap of conch shells, the top one's spire is the point
      g.fillStyle = hi; g.beginPath(); g.moveTo(-22, 0); g.lineTo(-8, -20); g.lineTo(2, 0); g.closePath(); g.fill();
      g.fillStyle = darken(col, 0.15); g.beginPath(); g.moveTo(-2, 0); g.lineTo(10, -22); g.lineTo(24, 0); g.closePath(); g.fill();
      g.strokeStyle = lo; g.lineWidth = 1.5; g.beginPath();
      for (let k = 0; k < 6; k++) { const y = -8 - k * 6.5; const w = 14 - k * 2.2; g.moveTo(-w, y + 3); g.lineTo(w, y - 2); }
      g.stroke();
      g.fillStyle = rgba(OUTLINE_IN, 0.3); g.beginPath(); g.moveTo(-4, -H - 6); g.lineTo(-10, -18); g.lineTo(-7, -18); g.lineTo(-2, -H - 2); g.closePath(); g.fill();
      g.fillStyle = darken(col, 0.55); g.beginPath(); g.ellipse(-9, -5, 4, 2.5, -0.4, 0, Math.PI * 2); g.ellipse(11, -5, 4, 2.5, 0.4, 0, Math.PI * 2); g.fill();
    } else if (st === 'bridge') {
      // 폭죽 상자: striped firework crate with three rocket cones on top
      for (let x = -24, i = 0; x < 24; x += 6, i++) { g.fillStyle = i % 2 ? hi : col; g.fillRect(x, base, 6, 20); }
      g.fillStyle = cream; g.fillRect(-24, base + 7, 48, 3);
      g.fillStyle = lo; g.fillRect(-24, base - 1, 48, 3);
      g.fillStyle = darken(col, 0.2); g.beginPath(); g.moveTo(-15, base); g.lineTo(-5, -H + 2); g.lineTo(-1, base); g.closePath(); g.moveTo(1, base); g.lineTo(5, -H + 2); g.lineTo(15, base); g.closePath(); g.fill();
      g.fillStyle = hi; g.beginPath(); g.moveTo(-5, base); g.lineTo(0, -H - 12); g.lineTo(5, base); g.closePath(); g.fill();
      g.fillStyle = cream; g.fillRect(-4, base - 7, 8, 2); g.fillRect(-12, base - 5, 6, 2); g.fillRect(6, base - 5, 6, 2);
    } else {
      // 뾰족 기와: roof tiles stacked into a spire, a pointed ridge ornament on top
      g.fillStyle = lo; for (let y = -3, row = 0; y > -H - 4; y -= 7, row++) { const w = 20 - row * 2.6; for (let x = -w + (row % 2) * 3.5; x < w; x += 7) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3.5, y - 4.5); g.lineTo(x + 7, y); g.closePath(); g.fill(); } }
      g.fillStyle = hi; for (let y = -7, row = 0; y > -H; y -= 7, row++) g.fillRect(-22, y, 44, 1.5);
      g.fillStyle = cream; g.beginPath(); g.moveTo(0, -H - 12); g.lineTo(-4, -H - 2); g.lineTo(4, -H - 2); g.closePath(); g.fill();
    }
    // shared: left rim light + dark foot so it sits on the surface
    g.fillStyle = rgba('#ffffff', 0.18); g.beginPath(); g.moveTo(-HB - 1, -2); g.lineTo(-HB + 2, -2); g.lineTo(-TIP + 1, -SPIKE_H); g.lineTo(-TIP - 1, -SPIKE_H); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-24, -4, 48, 4);
  });
}

export function drawSpike(c: CanvasRenderingContext2D, h: Hazard, col: string, hc: boolean, style?: HazardStyle): void {
  const st = styleOf(style, h.biome, col); const res = worldRes(c);
  const spr = sprites.get(`s|${st}|${col}|${hc ? 1 : 0}|${res}`, () => { const [cv, g] = makeCanvas(SP_L * 2, SP_UP + SP_DN, res); g.translate(SP_L, SP_UP); paintSpike(g, st, col); return cv; });
  const cx = (h.x0 + h.x1) / 2;
  c.drawImage(spr, cx - SP_L, h.y1 - SP_UP, spr.width / res, spr.height / res);
  if (st === 'bridge') {
    // lit fuse spark on the middle rocket (decorative, above the hitbox)
    const t = performance.now() / 1000; const k = 0.6 + 0.4 * Math.sin(t * 22 + cx);
    c.fillStyle = `rgba(255,214,110,${0.75 * k})`; c.fillRect(cx - 1.5, h.y0 - 21, 3, 3);
    c.fillStyle = `rgba(255,255,220,${k})`; c.fillRect(cx - 1, h.y0 - 23 - k * 2, 2, 2);
  }
}

// ---------------------------------------------------------------- tall ⇈ (local origin = bottom centre)
const TL_L = 28, TL_UP = TALL_H + 30, TL_DN = 6;
const TW2 = TALL_W / 2 + 2;                     // 19: 2 px wider than the hitbox on each side
const TALL_PTS = [-TW2, 0, -TW2, -TALL_H, -13, -TALL_H - 11, -6.5, -TALL_H - 3, 0, -TALL_H - 13, 6.5, -TALL_H - 3, 13, -TALL_H - 11, TW2, -TALL_H, TW2, 0];

function paintTall(g: CanvasRenderingContext2D, st: HazardStyle, col: string): void {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 1, 26, 5, 0, 0, Math.PI * 2); g.fill();
  const hi = lighten(col, 0.2), lo = darken(col, 0.35), H = TALL_H;
  outlined(g, () => poly(g, TALL_PTS), col, () => {
    if (st === 'market') {
      // 찜통 탑: stacked bamboo steamer baskets
      for (let y = 0; y > -H - 14; y -= 34) {
        g.fillStyle = darken(col, 0.12); g.fillRect(-TW2, y - 34, TW2 * 2, 34);
        g.fillStyle = hi; g.fillRect(-TW2, y - 6, TW2 * 2, 5); g.fillRect(-TW2, y - 34, TW2 * 2, 4);
        g.fillStyle = lo; g.fillRect(-TW2, y - 1.5, TW2 * 2, 1.5);
        g.strokeStyle = rgba(hi, 0.55); g.lineWidth = 1; g.beginPath(); for (let x = -TW2 + 3; x < TW2; x += 5) { g.moveTo(x, y - 28); g.lineTo(x + 3, y - 9); } g.stroke();
      }
    } else if (st === 'riverside') {
      // 쌓인 플라스틱 의자: a leaning stack of plastic stools (rims + leg slots)
      for (let y = 0; y > -H - 14; y -= 22) {
        g.fillStyle = hi; g.fillRect(-TW2, y - 22, TW2 * 2, 5);
        g.fillStyle = lo; g.fillRect(-9, y - 15, 4, 13); g.fillRect(5, y - 15, 4, 13);
        g.fillStyle = darken(col, 0.15); g.beginPath(); g.moveTo(-TW2, y - 17); g.lineTo(-TW2 + 6, y); g.lineTo(-TW2, y); g.closePath(); g.moveTo(TW2, y - 17); g.lineTo(TW2 - 6, y); g.lineTo(TW2, y); g.closePath(); g.fill();
      }
    } else if (st === 'bridge') {
      // 불꽃 발사대: three launch tubes bound with riveted steel bands
      g.fillStyle = hi; g.fillRect(-12, -H - 14, 6, H + 14); g.fillRect(-2, -H - 14, 6, H + 14); g.fillRect(8, -H - 14, 5, H + 14);
      g.fillStyle = lo; g.fillRect(-14, -H - 14, 2, H + 14); g.fillRect(-4, -H - 14, 2, H + 14); g.fillRect(6, -H - 14, 2, H + 14);
      for (let y = -12; y > -H; y -= 42) { g.fillStyle = darken(col, 0.45); g.fillRect(-TW2, y - 8, TW2 * 2, 8); g.fillStyle = rgba(OUTLINE_IN, 0.6); for (let x = -15; x < 16; x += 6) g.fillRect(x, y - 5, 1.6, 1.6); }
      g.fillStyle = darken(col, 0.6); g.fillRect(-TW2, -H - 14, TW2 * 2, 9);
    } else {
      // 굴뚝: brick chimney with a cap slab
      for (let y = 0, row = 0; y > -H; y -= 10, row++) {
        g.fillStyle = lo; g.fillRect(-TW2, y - 1.5, TW2 * 2, 1.5);
        for (let x = -TW2 + (row % 2 ? 0 : 7); x < TW2; x += 14) g.fillRect(x, y - 10, 1.5, 10);
        if (row % 3 === 1) { g.fillStyle = hi; g.fillRect(-TW2 + (row % 2 ? 1.5 : 8.5), y - 8.5, 12, 7); }
      }
      g.fillStyle = hi; g.fillRect(-TW2, -H - 14, TW2 * 2, 14); g.fillStyle = lo; g.fillRect(-TW2, -H, TW2 * 2, 3);
    }
    // ⇈ "taller than you" double chevrons (near the top and at mid height)
    g.fillStyle = OUTLINE_OUT; g.beginPath(); for (const y of [-H + 22, -H + 36, -H * 0.48, -H * 0.48 + 14]) chevronUp(g, 0, y - 1.5, 25, 8); g.fill();
    g.fillStyle = OUTLINE_IN; g.beginPath(); for (const y of [-H + 22, -H + 36, -H * 0.48, -H * 0.48 + 14]) chevronUp(g, 0, y, 20, 5); g.fill();
    g.fillStyle = rgba('#ffffff', 0.14); g.fillRect(-TW2 + 2, -H, 3, H);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(-TW2, -5, TW2 * 2, 5);
  });
}

export function drawTall(c: CanvasRenderingContext2D, h: Hazard, col: string, hc: boolean, t: number, style?: HazardStyle): void {
  const st = styleOf(style, h.biome, col); const res = worldRes(c);
  const spr = sprites.get(`t|${st}|${col}|${hc ? 1 : 0}|${res}`, () => { const [cv, g] = makeCanvas(TL_L * 2, TL_UP + TL_DN, res); g.translate(TL_L, TL_UP); paintTall(g, st, col); return cv; });
  const cx = (h.x0 + h.x1) / 2; const top = h.y1 - TALL_H - 12;
  // decorative wisps above the top (soft, translucent, never inside the play box of the hazard)
  if (st === 'market' || st === 'dawn') {
    const colW = st === 'market' ? '255,255,255' : '190,180,205';
    for (let i = 0; i < 3; i++) { const k = ((t * 0.6 + i / 3) % 1); c.fillStyle = `rgba(${colW},${0.28 * (1 - k)})`; c.beginPath(); c.arc(cx + Math.sin(t * 2 + i * 2) * 5 + (st === 'dawn' ? k * 14 : 0), top - 6 - k * 34, 5 + k * 8, 0, Math.PI * 2); c.fill(); }
  } else if (st === 'bridge') {
    for (let i = 0; i < 4; i++) { const k = ((t * 1.7 + i / 4) % 1); c.fillStyle = `rgba(255,${200 + i * 12},120,${1 - k})`; c.fillRect(cx - 9 + i * 6 + Math.sin(i * 7) * k * 10, top - 2 - k * 26, 2.5, 2.5); }
  }
  c.drawImage(spr, cx - TL_L, h.y1 - TL_UP, spr.width / res, spr.height / res);
}

// ---------------------------------------------------------------- hang ▼ (one merged slab x0..x1, from off-screen to `bot`)
// Hazards never move in world space, so each slab's paths are built once (Path2D, batched per colour) and cached;
// a frame costs ~8 fill/stroke calls and no allocations. All decoration stays inside [x0-2, x1+2] × [.., bot], so no
// clip is needed; the teeth below `bot` are decorative (the hitbox ends at `bot`, the art covers all of it).
const HANG_TOP = -1400;                          // far above any view (portrait shows well above y = 0)
const HANG_DECO = 1150;                          // decorated height above `bot` (plain body beyond)
interface HangArt { outline: Path2D; fills: [string, Path2D][]; strokes: [string, number, Path2D, number[] | null][] }
const hangCache = new SpriteCache<HangArt>(24);

function buildHang(st: HazardStyle, x0: number, x1: number, bot: number, col: string): HangArt {
  const L = x0 - 2, R = x1 + 2, w = R - L; const units = Math.max(1, Math.round((x1 - x0) / 40)); const uw = (x1 - x0) / units;
  const teeth = units * 2; const tw = w / teeth; const TOOTH = 8;
  const outline = new Path2D(); outline.moveTo(L, HANG_TOP); outline.lineTo(L, bot);
  for (let i = 0; i < teeth; i++) { outline.lineTo(L + tw * (i + 0.5), bot + TOOTH); outline.lineTo(L + tw * (i + 1), bot); }
  outline.lineTo(R, HANG_TOP); outline.closePath();
  const fills: [string, Path2D][] = []; const strokes: HangArt['strokes'] = [];
  const F = (fs: string) => { const p = new Path2D(); fills.push([fs, p]); return p; };
  const hi = lighten(col, 0.2), lo = darken(col, 0.35), cream = OUTLINE_IN; const top = bot - HANG_DECO;
  if (st === 'market') {
    // 청사초롱 줄: a curtain of blue-and-red silk lanterns on strings
    F(darken(col, 0.3)).rect(L, top, w, HANG_DECO);
    const strings = F(lo), blue = F(hi), red = F(mix('#c0504a', col, 0.4)), shine = F(rgba('#ffe7b0', 0.45)), caps = F(darken(col, 0.55));
    for (let i = 0; i < units; i++) {
      strings.rect(x0 + uw * (i + 0.5) - 1, top, 2, HANG_DECO - 40);
      for (let y = bot - 66, k = 0; y > top; y -= 50, k++) {
        const cx = x0 + uw * (i + 0.5) + (k % 2 ? 2 : -2);
        blue.moveTo(cx - 8, y - 17); blue.lineTo(cx + 8, y - 17); blue.lineTo(cx + 14, y - 8); blue.lineTo(cx + 14, y + 2); blue.lineTo(cx - 14, y + 2); blue.lineTo(cx - 14, y - 8); blue.closePath();
        red.moveTo(cx - 14, y + 2); red.lineTo(cx + 14, y + 2); red.lineTo(cx + 14, y + 8); red.lineTo(cx + 8, y + 16); red.lineTo(cx - 8, y + 16); red.lineTo(cx - 14, y + 8); red.closePath();
        caps.rect(cx - 9, y - 21, 18, 4); caps.rect(cx - 9, y + 15, 18, 4); shine.rect(cx - 2, y - 15, 4, 29);
      }
    }
    F(lo).rect(L, bot - 42, w, 36);
  } else if (st === 'riverside') {
    // 천막 끝자락: the edge of a blue tarp awning — stripes, folds, grommets, a hem
    const stripes = F(hi); for (let x = L + 12; x < R; x += 24) stripes.rect(x, top, Math.min(12, R - x), HANG_DECO - 16);
    const folds = F(rgba(darken(col, 0.5), 0.5)); for (let y = bot - 70; y > top; y -= 64) folds.rect(L, y, w, 3);
    F(lo).rect(L, bot - 16, w, 10);
    const holes = F(cream); for (let x = L + 10; x < R - 4; x += 24) { holes.moveTo(x + 2.2, bot - 11); holes.arc(x, bot - 11, 2.2, 0, Math.PI * 2); }
  } else if (st === 'bridge') {
    // 불꽃 현수막: a festival banner with firework motifs and a stitched border
    const edge = F(lo); edge.rect(L, top, 6, HANG_DECO); edge.rect(R - 6, top, 6, HANG_DECO); edge.rect(L, bot - 14, w, 14);
    const bursts = F(hi);
    for (let i = 0; i < units; i++) for (let y = bot - 58, k = 0; y > top; y -= 58, k++) {
      const cx = x0 + uw * (i + 0.5) + (k % 2 ? 6 : -6);
      for (let a = 0; a < 8; a++) { const an = (a / 8) * Math.PI * 2; bursts.moveTo(cx, y); bursts.lineTo(cx + Math.cos(an - 0.12) * 12, y + Math.sin(an - 0.12) * 12); bursts.lineTo(cx + Math.cos(an + 0.12) * 12, y + Math.sin(an + 0.12) * 12); bursts.closePath(); }
    }
    const stitch = new Path2D(); stitch.moveTo(L + 8, top); stitch.lineTo(L + 8, bot - 16); stitch.lineTo(R - 8, bot - 16); stitch.lineTo(R - 8, top);
    strokes.push([rgba(cream, 0.7), 1.2, stitch, [4, 3]]);
  } else {
    // 빨랫줄: rows of hanging laundry (indigo-dyed cloths) pinned on lines
    const tones = [F(hi), F(col), F(darken(col, 0.15))]; const lines = F(rgba(cream, 0.22)), rope = F(rgba(cream, 0.75)), pins = F(mix('#c98a4b', col, 0.3));
    for (let y = bot, row = 0; y > top; y -= 60, row++) {
      for (let i = 0; i < units; i++) {
        const x = x0 + uw * i; tones[(i + row) % 3].rect(x - (i ? 0 : 2), y - 60, uw + (i ? 0 : 2) + (i === units - 1 ? 2 : 0), 60);
        if ((i + row) % 2) { lines.rect(x + 6, y - 50, uw - 12, 3); lines.rect(x + 6, y - 40, uw - 12, 3); }
      }
      rope.rect(L, y - 60, w, 1.5);
      for (let i = 0; i <= units; i++) pins.rect(Math.min(R - 4, Math.max(L, x0 + uw * i - 2)), y - 63, 4, 8);
    }
  }
  // ▼ "duck under" marks just above the hem
  const chevO = F(OUTLINE_OUT), chevI = F(cream);
  for (let i = 0; i < units; i++) { chevronDown(chevO, x0 + uw * (i + 0.5), bot - 21.5, 22, 7); chevronDown(chevI, x0 + uw * (i + 0.5), bot - 23, 17, 4.5); }
  F('rgba(0,0,0,0.3)').rect(L, bot - 3, w, 3);
  return { outline, fills, strokes };
}

export function drawHang(c: CanvasRenderingContext2D, x0: number, x1: number, bot: number, col: string, hc: boolean, t: number, style?: HazardStyle): void {
  const st = styleOf(style, null, col); void hc; void t;
  const art = hangCache.get(`${st}|${col}|${x0}|${x1}|${bot}`, () => buildHang(st, x0, x1, bot, col));
  c.lineJoin = 'miter'; c.miterLimit = 3;
  c.strokeStyle = OUTLINE_OUT; c.lineWidth = 7.5; c.stroke(art.outline);
  c.fillStyle = col; c.fill(art.outline);
  for (const [fs, p] of art.fills) { c.fillStyle = fs; c.fill(p); }
  for (const [ss, lw, p, dash] of art.strokes) { c.strokeStyle = ss; c.lineWidth = lw; if (dash) c.setLineDash(dash); c.stroke(p); if (dash) c.setLineDash([]); }
  c.strokeStyle = OUTLINE_IN; c.lineWidth = 1.5; c.stroke(art.outline);
}

if (typeof window !== 'undefined') { const w = window as unknown as { __world?: Record<string, unknown> }; Object.assign((w.__world ??= {}), { drawSpike, drawTall, drawHang }); }
