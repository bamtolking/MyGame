// 악사: a cone of expanding sound-wave bands with drifting notes; ult 신명풀이 = four golden sound pulses over a 삼태극 stage.
import { CLASSES, ATK } from '../../shared/data/classes.ts';
import { EMIT, type Painter } from '../render/paint.ts';
import { type Tex, makeTex } from '../render/art/core.ts';
import type { ClassFx, FxCtx } from './types.ts';

const RANGE = CLASSES.musician.range, HALF = ATK.waveHalf, PULSE_R = 240;
const ORANGE = 0xffa640, GOLD = 0xffd070, CREAM = 0xfff4dc, NOTES = [0xffd070, 0xffa640, 0xfff4dc, 0xff9ac0];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const out3 = (k: number) => 1 - (1 - k) ** 3;
/** Visual time of each caster's last ult cast: the first pulse lands on the generic cast flourish, so it is toned down. */
const castAt = new Map<number, number>();

/** Ground "stage": 삼태극 swirl inside a ring of 율명 (黃太仲林南) glyphs; coloured, drawn untinted. */
let stage: Tex | null = null;
function stageTex(): Tex {
  return stage ??= makeTex('fx:musStage', 128, 128, 0.5, 0.5, 2, c => {
    c.translate(64, 64); const R = 24;
    for (const [r, w] of [[61, 2.4], [49, 1.2], [R + 3, 1.4]] as const) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.strokeStyle = '#ffd98a'; c.lineWidth = w; c.stroke(); }
    c.fillStyle = '#ffe8b0'; c.font = 'bold 9px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const g = '黃太仲林南'; for (let i = 0; i < 15; i++) { c.save(); c.rotate((i / 15) * Math.PI * 2); c.fillText(g[i % 5], 0, -55); c.restore(); }
    for (let i = 0; i < 12; i++) { c.save(); c.rotate((i / 12) * Math.PI * 2 + 0.26); c.fillStyle = '#ffd98a'; c.fillRect(-2.5, -44, 5, 5); c.restore(); }
    const cols = ['#ff6a7a', '#ffd46a', '#6a9cff'];
    for (let i = 0; i < 3; i++) {
      const f0 = (i / 3) * Math.PI * 2, f1 = ((i + 1) / 3) * Math.PI * 2;
      c.beginPath(); c.moveTo(Math.cos(f0) * R, Math.sin(f0) * R); c.arc(0, 0, R, f0, f1, false);
      c.arc(Math.cos(f1) * R / 2, Math.sin(f1) * R / 2, R / 2, f1, f1 + Math.PI, true); c.arc(Math.cos(f0) * R / 2, Math.sin(f0) * R / 2, R / 2, f0 + Math.PI, f0 + Math.PI * 2, false);
      c.closePath(); c.globalAlpha = 0.72; c.fillStyle = cols[i]; c.fill(); c.globalAlpha = 1;
    }
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.strokeStyle = '#ffe7a8'; c.lineWidth = 1.6; c.stroke();
  });
}
/** A band across the cone (a single p.arc ramps alpha from a0 to a1, so arcs are layered): `flat` = even along the arc
 *  with short soft tails past the cone edges, otherwise brightest at the centre and fading to the edges (Canvas2D: flat, thin). */
function band(p: Painter, tex: Tex, x: number, y: number, r: number, w: number, ang: number, half: number, col: number, a: number, flat: boolean): void {
  const a0 = ang - half, a1 = ang + half;
  if (p.kind === '2d') { if (flat) { p.arc(EMIT, tex, x, y, r, w * 0.55, a0, a1, col, a * 0.55, 1); p.arc(EMIT, tex, x, y, r, w * 0.55, a1, a0, col, a * 0.55, 1); } return; } // solid strokes there: keep them thin
  if (flat) { const tl = 9 / r; p.arc(EMIT, tex, x, y, r, w, a0, a1, col, a * 0.5, 1); p.arc(EMIT, tex, x, y, r, w, a1, a0, col, a * 0.5, 1); p.arc(EMIT, tex, x, y, r, w, a0 - tl, a0, col, a * 0.5, 1); p.arc(EMIT, tex, x, y, r, w, a1 + tl, a1, col, a * 0.5, 1); }
  p.arc(EMIT, tex, x, y, r, w, a0, ang, col, a * (flat ? 0.6 : 1), 1); p.arc(EMIT, tex, x, y, r, w, a1, ang, col, a * (flat ? 0.6 : 1), 1);
}
function note(c: FxCtx, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number): void {
  c.fx.part({ tex: 'note', x, y, vx, vy, g: -50, drag: 0.965, life, size, col, rot: rnd(-0.3, 0.3), spin: rnd(-2, 2), fadeIn: 0.06 });
}

export const musician: ClassFx = {
  atkDur: 0.3, ultR: PULSE_R,
  atk: (c, _e, ang) => {
    const ox = c.x + Math.cos(ang) * 8, oy = c.y - 22; const beam = c.art.fx('beam'); const col = c.ult ? GOLD : ORANGE; const alt = c.n % 2;
    c.fx.add(1, 0.58, (p, _k, t) => {
      for (let i = 0; i < 3; i++) {
        const k = (t - i * 0.07) / 0.42; if (k <= 0 || k >= 1) continue;
        const r = 16 + (RANGE - 16) * out3(k), w = 20 - 11 * k, a = (1 - k) ** 0.8 * (i === 0 ? 1 : 0.72) * Math.min(1, k * 8);
        band(p, beam, ox, oy, r, w * 1.5, ang, HALF, col, a * 0.75, false); band(p, beam, ox, oy, r, w * 0.9, ang, HALF, col, a * 0.5, true); band(p, beam, ox, oy, r, w * 0.4, ang, HALF, CREAM, a * 0.8, true);
      }
    });
    c.fx.glow(ox, oy, 24, col, 0.25, 0.45);
    for (let i = 0; i < (c.ult ? 5 : 4); i++) { const a = ang + (i / 3 - 0.5 + rnd(-0.12, 0.12)) * HALF * 1.5, s = rnd(250, 420); note(c, ox, oy - 4, Math.cos(a) * s, Math.sin(a) * s, rnd(0.5, 0.7), rnd(8.5, 10), NOTES[(i + alt) % 4]); }
    c.snd.play('strum', c.vol, c.x, c.y);
  },
  ult: (c, e) => {
    const x = e.x, y = e.y;
    if (castAt.size > 64) castAt.clear(); castAt.set(c.id, c.fx.time);
    // festive burst: 색동 confetti and a spiral of notes rising from the gayageum
    c.fx.debris(x, y - 30, c.mine ? 22 : 10, 'petal', [0xe0344d, 0xf2c84b, 0x3fb07a, 0x4a7bd8, 0xfff4dc], 340, 7, 1.5, EMIT);
    for (let i = 0; i < 12; i++) c.fx.later(i * 0.04, () => { const a = (i / 12) * Math.PI * 2; note(c, x + Math.cos(a) * 18, y - 28 + Math.sin(a) * 8, Math.cos(a) * 170, -150 + Math.sin(a) * 60, 1.3, 9, NOTES[i % 4]); });
    const st = stageTex();
    c.fx.add(0, 0.7, (p, k) => { const s = (2 * 92 / st.w) * (0.4 + out3(k) * 0.9); p.draw(EMIT, st, x, y, s, s * 0.62, 0, 0xffffff, 0.45 * (1 - k), 1); });
  },
  uhit: (c) => {
    const x = c.x, y = c.y; const ring = c.art.fx('ring'), soft = c.art.fx('ringSoft'), disc = c.art.fx('disc'); const f = c.fx.time - (castAt.get(c.id) ?? -9) < 0.5 ? 0.65 : 1;
    // the big pulse on the ground (ring texture radii: ring 58/64, ringSoft ~55/64 of the half size)
    c.fx.add(0, 0.95, (p, _k, t) => {
      for (let i = 0; i < 3; i++) {
        const k = (t - i * 0.11) / 0.75; if (k <= 0 || k >= 1) continue;
        const r = 20 + (PULSE_R - 20) * out3(k) * (1 - i * 0.13), a = (1 - k) ** 1.3 * f;
        const s1 = (r * 2) / 128 / (58 / 64), s2 = (r * 2) / 128 / (55 / 64);
        if (i === 0) p.draw(EMIT, soft, x, y, s2, s2 * 0.62, 0, GOLD, a * 0.34, 1);
        p.draw(EMIT, ring, x, y, s1, s1 * 0.62, 0, i ? (i === 1 ? GOLD : ORANGE) : CREAM, a * (i ? 0.4 : 0.6), 1);
        if (i === 0 && k < 0.4) { const sd = (r * 2) / 128; p.draw(EMIT, disc, x, y, sd, sd * 0.62, 0, GOLD, 0.07 * (1 - k / 0.4), 1); }
      }
    });
    if (f === 1) { c.fx.glow(x, y - 28, 56, GOLD, 0.4, 0.16); c.fx.light(x, y, 280, GOLD, 0.28, 0.5); }
    const n = c.mine ? 14 : 8;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(-0.15, 0.15), s = rnd(260, 380); note(c, x + Math.cos(a) * 34, y - 26 + Math.sin(a) * 20, Math.cos(a) * s, Math.sin(a) * s * 0.62 - 30, rnd(0.9, 1.3), rnd(8, 10), NOTES[i % 4]); }
    const ns = c.mine ? 8 : 4; for (let i = 0; i < ns; i++) { const a = (i / ns) * Math.PI * 2 + 0.3; c.fx.part({ tex: 'spark', x: x + Math.cos(a) * 40, y: y - 6 + Math.sin(a) * 25, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560 * 0.62, drag: 0.86, life: 0.28, size: 8, col: ORANGE, a: 0.8, stretch: 0.003, face: true }); }
    if (c.mine) { c.fx.wave(x, y - 16, 280, 16, 0.65); c.fx.shake(0.16); c.fx.zoomPunch(0.02); }
    c.snd.play('strum', c.vol, x, y); c.snd.play('bell', c.vol * 0.5, x, y);
  },
  aura: (p, art, t, x, y) => {
    const st = stageTex(), s = (2 * 92) / st.w * (1 + 0.03 * Math.sin(t * 4.2)); p.draw(EMIT, st, x, y, s, s * 0.62, 0, 0xffffff, 0.26 + 0.06 * Math.sin(t * 4.2), 1);
    const dot = art.fx('dot'); for (let i = 0; i < 6; i++) { const a = t * 1.4 + (i / 6) * Math.PI * 2; p.draw(EMIT, dot, x + Math.cos(a) * 84, y + Math.sin(a) * 84 * 0.62, 0.55, 0.55, 0, i % 2 ? GOLD : CREAM, 0.8, 1); }
    const soft = art.fx('ringSoft');
    for (let i = 0; i < 2; i++) { const k = (t * 0.42 + i * 0.5) % 1, r = 60 + k * 150, sc = (r * 2) / 128 / (55 / 64); p.draw(EMIT, soft, x, y, sc, sc * 0.62, 0, GOLD, 0.3 * (1 - k) * Math.min(1, k * 6), 1); }
    const nt = art.fx('note'), glow = art.fx('soft');
    for (let i = 0; i < 7; i++) {
      const k = (t * 0.5 + i / 7) % 1, a = (i / 7) * Math.PI * 2 + t * 0.9, R = 24 + k * 20;
      const nx = x + Math.cos(a) * R, ny = y - 12 - k * 62 + Math.sin(a) * R * 0.4, al = Math.sin(k * Math.PI) * (Math.sin(a) < 0 ? 0.55 : 0.95);
      p.draw(EMIT, glow, nx, ny, 0.32, 0.32, 0, NOTES[i % 4], al * 0.35, 1); p.draw(EMIT, nt, nx, ny, 0.7, 0.7, Math.sin(t * 3 + i) * 0.3, NOTES[i % 4], al, 1);
    }
  },
};
