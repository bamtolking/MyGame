// Reusable menu pieces: inline-SVG icons (no emoji — they differ per device), runner / companion portraits,
// star · pouch · medal chips, progress bars, number/date formatting and the coin-income estimate used by the 도감.
import type { CharacterDef } from '../data/characters';
import type { CompanionDef } from '../data/companions';
import type { RunState } from '../sim/types';
import { BONUS_WORD, HIT_DAMAGE, FALL_DAMAGE } from '../data/tuning';
import type { Progress, RunReward } from '../meta/progress';
import { RANK_REWARD, MISSION_REWARD } from '../meta/missions';
import { drawCharacter } from '../render/characters';
import { shapeOf } from '../render/renderer';
import { h } from './dom';

// ---------------------------------------------------------------- formatting
export function fmtNum(n: number): string { return Math.round(n).toLocaleString('ko-KR'); }
export function fmtDist(m: number): string { return `${fmtNum(Math.floor(m))}m`; }
/** '1분 32초' · '1시간 5분' · '12초' (GDD §10.7) */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  if (hh) return `${hh}시간${mm ? ` ${mm}분` : ''}`;
  if (mm) return `${mm}분${ss ? ` ${ss}초` : ''}`;
  return `${ss}초`;
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 'YYYY-MM-DD' → '9월 26일 (토)' */
export function fmtDateKey(key: string, weekday = true): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일${weekday ? ` (${WEEK[wd]})` : ''}`;
}
/** epoch ms → '9월 26일' (this year) or '2025년 9월 26일' */
export function fmtDateMs(ms: number): string {
  if (!ms) return '';
  const t = new Date(ms); const now = new Date();
  return `${t.getFullYear() !== now.getFullYear() ? `${t.getFullYear()}년 ` : ''}${t.getMonth() + 1}월 ${t.getDate()}일`;
}

// ---------------------------------------------------------------- icons
const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="10" fill="#f6c453" stroke="#8a5a10" stroke-width="1.6"/><circle cx="12" cy="12" r="7" fill="none" stroke="#c98a1c" stroke-width="1.2"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx=".6" fill="#6b420a"/>',
  star: '<path fill="currentColor" d="M12 2.4l2.95 6.1 6.65.85-4.9 4.6 1.25 6.6L12 17.35 6.05 20.55 7.3 13.95 2.4 9.35l6.65-.85z"/>',
  starO: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 3.6l2.6 5.4 5.9.75-4.35 4.1 1.1 5.85L12 16.85 6.75 19.7l1.1-5.85L3.5 9.75l5.9-.75z"/>',
  lock: '<path fill="currentColor" d="M7 10V7.5a5 5 0 0110 0V10h1a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0118 21H6a1.5 1.5 0 01-1.5-1.5v-8A1.5 1.5 0 016 10zm2.2 0h5.6V7.5a2.8 2.8 0 00-5.6 0z"/>',
  pouch: '<path fill="currentColor" d="M8.4 3.2h7.2l-1.8 3.3c3.6 1.4 6.2 4.9 6.2 8.6 0 3.9-3.4 5.9-8 5.9s-8-2-8-5.9c0-3.7 2.6-7.2 6.2-8.6z"/><path d="M9.2 7.4h5.6" stroke="#7a2a12" stroke-width="1.6" stroke-linecap="round"/><path d="M12 11.2l.9 1.9 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" fill="#fff3c4" opacity=".9"/>',
  pouchO: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-dasharray="2.4 2" d="M8.8 3.8h6.4l-1.7 3.1c3.4 1.3 5.9 4.6 5.9 8.2 0 3.6-3.2 5.4-7.4 5.4S4.6 18.7 4.6 15.1c0-3.6 2.5-6.9 5.9-8.2z"/>',
  medal: '<path d="M8 2h3l1.5 5-3 1zM16 2h-3l-1.5 5 3 1z" fill="#d94f5c"/><circle cx="12" cy="15" r="6.6" fill="currentColor" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/><path d="M12 11.6l1 2.1 2.3.3-1.65 1.6.4 2.25L12 16.8l-2.05 1.05.4-2.25L8.7 14l2.3-.3z" fill="rgba(255,255,255,.75)"/>',
  assist: '<path fill="currentColor" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/><path d="M12 10.5v5M9.5 13h5" stroke="#2a1850" stroke-width="1.8" stroke-linecap="round"/>',
  relay: `<path ${STROKE} d="M3.5 12h11M10.5 7l5 5-5 5M19.5 5.5v13"/>`,
  book: `<path ${STROKE} d="M4.5 5.5A2.5 2.5 0 017 3h12.5v15H7a2.5 2.5 0 00-2.5 2.5zM4.5 20.5A2.5 2.5 0 007 23h12.5v-5M9 8h6M9 11.5h4"/>`,
  mission: `<rect ${STROKE} x="4.5" y="3" width="15" height="18" rx="2.5"/><path ${STROKE} d="M8 8.5l1.6 1.6L12.5 7M8 14.5l1.6 1.6 2.9-3.1M14.5 9h2M14.5 15h2"/>`,
  trophy: `<path ${STROKE} d="M7.5 3.5h9V9a4.5 4.5 0 01-9 0zM7.5 5.5H4.5a3.2 3.2 0 003.5 4.4M16.5 5.5h3a3.2 3.2 0 01-3.5 4.4M12 13.5v3.5M8 21h8M9.5 17h5v4h-5z"/>`,
  gear: `<circle ${STROKE} cx="12" cy="12" r="3"/><path ${STROKE} d="M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 01-2.1 1.2L14.7 21h-4l-.3-2.2a7.6 7.6 0 01-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 010-2.4L4.4 9.9l2-3.4 1.9.7a7.6 7.6 0 012.1-1.2L10.7 3h4l.3 2.2a7.6 7.6 0 012.1 1.2l1.9-.7 2 3.4-1.6 1.2a7.7 7.7 0 010 2.4z"/>`,
  map: `<path ${STROKE} d="M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3zM9 3.5v14M15 6.5v14"/>`,
  back: `<path ${STROKE} stroke-width="2.6" d="M15 5l-7 7 7 7"/>`,
  next: `<path ${STROKE} stroke-width="2.4" d="M9 5l7 7-7 7"/>`,
  close: `<path ${STROKE} stroke-width="2.4" d="M6 6l12 12M18 6L6 18"/>`,
  share: `<path ${STROKE} d="M12 3.5v11M7.5 8L12 3.5 16.5 8M5 12.5v6A2.5 2.5 0 007.5 21h9a2.5 2.5 0 002.5-2.5v-6"/>`,
  download: `<path ${STROKE} d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 19.5h15"/>`,
  copy: `<rect ${STROKE} x="8" y="8" width="12" height="13" rx="2"/><path ${STROKE} d="M16 8V5.5A2 2 0 0014 3.5H6A2 2 0 004 5.5v9A2 2 0 006 16.5h2"/>`,
  swap: `<path ${STROKE} d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/>`,
  check: `<path ${STROKE} stroke-width="2.8" d="M5 12.5l4.5 4.5L19 7.5"/>`,
  calendar: `<rect ${STROKE} x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path ${STROKE} d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.8" fill="currentColor"/>`,
  infinity: `<path ${STROKE} stroke-width="2.4" d="M7.2 8.5a3.5 3.5 0 100 7c3.4 0 6.2-7 9.6-7a3.5 3.5 0 110 7c-3.4 0-6.2-7-9.6-7z"/>`,
  ghost: '<path fill="currentColor" d="M5.5 20.5V11a6.5 6.5 0 0113 0v9.5l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6z"/><circle cx="9.7" cy="11" r="1.4" fill="#2a1850"/><circle cx="14.3" cy="11" r="1.4" fill="#2a1850"/>',
  flame: '<path fill="currentColor" d="M12 2.5c.8 3.4 5.5 5.7 5.5 11a5.5 5.5 0 01-11 0c0-2.6 1.3-4.2 2.6-5.4.2 1.7 1 2.8 2 3.3-.5-3.6.2-6.4.9-8.9z"/>',
  moon: '<circle cx="12" cy="12" r="9" fill="currentColor"/>',
  play: '<path fill="currentColor" d="M8 4.8v14.4a1 1 0 001.5.86l11.3-7.2a1 1 0 000-1.72L9.5 3.94A1 1 0 008 4.8z"/>',
  sound: `<path fill="currentColor" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path ${STROKE} d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>`,
  hand: `<path ${STROKE} d="M8 13V5.5a1.5 1.5 0 013 0V11m0-1.5V4a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V13m0-4a1.5 1.5 0 013 0v5.5a7 7 0 01-7 7h-1a7 7 0 01-6-3.5l-2.4-4.3a1.6 1.6 0 012.6-1.8L8 13"/>`,
  eye: `<path ${STROKE} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle ${STROKE} cx="12" cy="12" r="3"/>`,
  data: `<ellipse ${STROKE} cx="12" cy="6" rx="7.5" ry="3"/><path ${STROKE} d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>`,
  code: `<path ${STROKE} d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>`,
  runner: `<circle cx="14.5" cy="4.5" r="2.2" fill="currentColor"/><path ${STROKE} stroke-width="2.3" d="M6 11.5l3.5-3 4 .5 2.5 3.5 3 .5M9.5 21l2.5-5.5 3 2.5V21M12 15.5l1.5-6.5M5 16.5h4"/>`,
  sparkle: '<path fill="currentColor" d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  hat: '<path fill="currentColor" d="M7 14.5c0-4.6 2.2-8 5-8s5 3.4 5 8z"/><ellipse cx="12" cy="15.5" rx="10" ry="2.8" fill="currentColor" opacity=".8"/>',
  palette: `<path ${STROKE} d="M12 3a9 9 0 100 18c1.3 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7h2.2A4.2 4.2 0 0021 10.6C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.5" fill="currentColor"/><circle cx="10" cy="7" r="1.5" fill="currentColor"/><circle cx="15" cy="7" r="1.5" fill="currentColor"/>`,
  note: '<path fill="currentColor" d="M9 17.5V5.5l11-2v12.2"/><circle cx="6.5" cy="17.8" r="2.8" fill="currentColor"/><circle cx="17.5" cy="15.8" r="2.8" fill="currentColor"/><path d="M9 5.5l11-2v3l-11 2z" fill="currentColor"/>',
  trail: '<circle cx="5" cy="17" r="2" fill="currentColor" opacity=".45"/><circle cx="10" cy="13.5" r="2.5" fill="currentColor" opacity=".7"/><path fill="currentColor" d="M17 4l1.4 4.2L22.6 9.6l-4.2 1.4L17 15.2l-1.4-4.2-4.2-1.4 4.2-1.4z"/>',
  title: `<path ${STROKE} d="M5 4.5h14v15l-7-3.5-7 3.5z"/>`,
};
/** An inline SVG icon (currentColor unless the icon has its own colours). */
export function icon(name: string, cls = ''): HTMLElement {
  return h('span', { class: `ico ico-${name}${cls ? ' ' + cls : ''}`, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" focusable="false">${ICONS[name] ?? ''}</svg>` });
}

// ---------------------------------------------------------------- small game chips
/** ★★☆ as icons (filled = earned). */
export function starRow(n: number, max = 3, cls = ''): HTMLElement {
  const el = h('span', { class: `stars${cls ? ' ' + cls : ''}`, 'aria-label': `별 ${n}/${max}` });
  for (let i = 0; i < max; i++) el.append(icon(i < n ? 'star' : 'starO', i < n ? 'on' : 'off'));
  return el;
}
/** The 3 golden-pouch slots of a stage (bitmask). */
export function pouchRow(mask: number, cls = ''): HTMLElement {
  const n = [0, 1, 2].filter(i => (mask >> i) & 1).length;
  const el = h('span', { class: `pouches${cls ? ' ' + cls : ''}`, 'aria-label': `황금 복주머니 ${n}/3` });
  for (let i = 0; i < 3; i++) el.append(icon((mask >> i) & 1 ? 'pouch' : 'pouchO', (mask >> i) & 1 ? 'on' : 'off'));
  return el;
}
export const MEDAL_NAMES = ['', '동', '은', '금'];
export const MEDAL_CLASS = ['none', 'bronze', 'silver', 'gold'];
export function medalBadge(m: number, withText = true): HTMLElement {
  return h('span', { class: `medal ${MEDAL_CLASS[m] ?? 'none'}`, title: m ? `${MEDAL_NAMES[m]}메달` : '메달 없음' }, icon('medal'), withText ? h('b', {}, m ? `${MEDAL_NAMES[m]}` : '—') : null);
}
/** A progress bar; frac is clamped to 0..1. */
export function bar(frac: number, cls = ''): HTMLElement {
  const f = Math.max(0, Math.min(1, isFinite(frac) ? frac : 0));
  return h('div', { class: `mbar${cls ? ' ' + cls : ''}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(f * 100)) }, h('i', { style: `width:${(f * 100).toFixed(1)}%` }));
}
export function coinAmount(n: number, cls = ''): HTMLElement { return h('span', { class: `coins${cls ? ' ' + cls : ''}` }, icon('coin'), h('b', {}, fmtNum(n))); }
/** The single 'new' dot for a newly opened feature (GDD §9.8). */
export function newDot(): HTMLElement { return h('i', { class: 'newdot', 'aria-label': '새로 열림' }); }

// ---------------------------------------------------------------- economy estimate (「지금 속도면 약 6판」)
/** Average coins a run has earned so far (pickups + distance + missions + rank rewards), or null before any run. */
export function coinsPerRun(p: Progress): number | null {
  const runs = p.totals.runs; if (runs < 1) return null;
  let rank = 0; for (let r = 0; r < p.rank; r++) rank += RANK_REWARD(r);
  const mission = p.missionsDone * MISSION_REWARD[1].coins;
  const earned = p.totals.coins + Math.floor(p.totals.dist / 100) + mission + rank;
  return earned > 0 ? earned / runs : null;
}
/** 「지금 속도면 약 N판」 for a coin price, or '' when there is no data yet. */
export function paceText(p: Progress, cost: number): string {
  const left = cost - p.coins;
  if (left <= 0) return '지금 데려올 수 있어요';
  const avg = coinsPerRun(p); if (!avg) return '';
  return `지금 속도면 약 ${fmtNum(Math.max(1, Math.ceil(left / avg)))}판`;
}

// ---------------------------------------------------------------- portraits
function makeCanvas(size: number, cls: string): { cv: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); cv.style.width = size + 'px'; cv.style.height = size + 'px'; cv.className = cls;
  const g = cv.getContext('2d')!; g.scale(dpr, dpr);
  return { cv, g };
}

/** A small canvas with the character in an idle/run pose. */
export function charPortrait(c: CharacterDef, size = 96, running = false): HTMLCanvasElement {
  const { cv, g } = makeCanvas(size, 'portrait');
  const k = size / 110; g.translate(size / 2, size * 0.9); g.scale(k, k);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); g.fill();
  try { drawCharacter(g, shapeOf(c), c.palette, { state: running ? 'run' : 'idle', t: 0.5, runPhase: 0.25, spin: 0, squash: 1, hurt: false, alpha: 1 }); } catch { /* art in flux */ }
  return cv;
}

/** A companion (짝꿍) drawn procedurally: firefly glow, black-and-white magpie, little golden haetae. */
export function companionPortrait(c: CompanionDef, size = 64): HTMLCanvasElement {
  const { cv, g } = makeCanvas(size, 'portrait comp');
  const k = size / 100; g.scale(k, k); g.translate(50, 52);
  const eye = (x: number, y: number, r = 4.2) => {
    g.fillStyle = '#1b1030'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + r * 0.35, y - r * 0.4, r * 0.38, 0, Math.PI * 2); g.fill();
  };
  const cheek = (x: number, y: number) => { g.fillStyle = 'rgba(255,120,120,0.55)'; g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2); g.fill(); };
  const kind = c.effect.kind;
  if (kind === 'pickPad') {            // 반딧불 반짝이: a glowing dot with little wings
    const glow = g.createRadialGradient(0, 4, 2, 0, 4, 46);
    glow.addColorStop(0, 'rgba(255,245,150,0.95)'); glow.addColorStop(0.35, 'rgba(255,230,90,0.45)'); glow.addColorStop(1, 'rgba(255,220,80,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 4, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(210,235,255,0.75)'; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 15, -14, 13, 8, s * -0.6, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#3a2b4a'; g.beginPath(); g.ellipse(0, -6, 13, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.color; g.beginPath(); g.ellipse(0, 12, 15, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-5, 7, 5, 4, -0.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2b4a'; g.lineWidth = 2; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, -17); g.quadraticCurveTo(s * 9, -30, s * 13, -30); g.stroke(); }
    eye(-5, -7, 3.4); eye(5, -7, 3.4);
  } else if (kind === 'honeyDrop') {   // 까치 깍순이: round magpie, white belly, blue wing
    g.fillStyle = '#1e1b2e'; g.beginPath(); g.moveTo(22, 6); g.lineTo(44, 20); g.lineTo(40, 26); g.lineTo(18, 16); g.fill();   // tail
    g.fillStyle = '#23203a'; g.beginPath(); g.ellipse(0, 6, 28, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f2ff'; g.beginPath(); g.ellipse(-4, 14, 18, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d6fd6'; g.beginPath(); g.ellipse(12, 4, 13, 9, 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f2ff'; g.beginPath(); g.ellipse(10, 0, 5, 3, 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#23203a'; g.beginPath(); g.arc(-10, -14, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2b544'; g.beginPath(); g.moveTo(-25, -14); g.lineTo(-36, -10); g.lineTo(-25, -8); g.fill();
    eye(-15, -16, 3.6); cheek(-8, -8);
    g.fillStyle = '#f2b544'; g.fillRect(-8, 28, 3, 7); g.fillRect(2, 28, 3, 7);
    g.fillStyle = '#ffb627'; g.beginPath(); g.arc(-38, -2, 5, 0, Math.PI * 2); g.fill();   // the honey drop it carries
  } else {                              // 아기 해태 해돌이: golden lion-dog pup, curly mane, little horn
    g.fillStyle = '#e07a2c';
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 26, -6 + Math.sin(a) * 24, 10, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = c.color; g.beginPath(); g.ellipse(0, 20, 24, 16, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, -6, 23, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5ab0a0'; g.beginPath(); g.moveTo(-4, -28); g.lineTo(0, -40); g.lineTo(4, -28); g.fill();
    g.fillStyle = '#fff1c8'; g.beginPath(); g.ellipse(0, 4, 12, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6b3a16'; g.beginPath(); g.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2); g.fill();
    eye(-9, -9, 4); eye(9, -9, 4); cheek(-15, 2); cheek(15, 2);
    g.strokeStyle = '#6b3a16'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(-3, 5, 3, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(3, 5, 3, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#e07a2c'; g.beginPath(); g.arc(26, 16, 7, 0, Math.PI * 2); g.fill();
  }
  return cv;
}

// ---------------------------------------------------------------- results-screen helpers (legacy: moving to results.ts)
export function hitName(kind: string): string {
  return kind === 'spike' ? '바닥 가시 (점프!)' : kind === 'tall' ? '높은 기둥 (2단 점프!)' : kind === 'hang' ? '매달린 장애물 (슬라이드!)' : kind === 'pit' ? '구덩이 (점프!)' : kind;
}

/** Legacy compact character card (kept for older imports; the 도감 builds its own richer cards). */
export interface CardOpts {
  unlocked: boolean; reason: string; main: boolean; partner: boolean; coins: number; best: number;
  onMain: () => void; onPartner: () => void; onBuy: () => void; onTrial: () => void;
}
export function charCard(c: CharacterDef, o: CardOpts): HTMLElement {
  return h('div', { class: 'mcard' + (o.unlocked ? '' : ' locked') },
    h('div', { class: 'pic' }, charPortrait(c, 72)),
    h('div', { class: 'info' }, h('b', {}, c.name), h('small', {}, c.title), o.unlocked ? null : h('small', {}, o.reason)));
}

/** Why did the run end? Always concrete, never "for no reason". */
export function deathExplain(s: RunState): { title: string; detail: string } {
  const hitsDmg = s.stats.hits * (s.assist ? HIT_DAMAGE / 2 : HIT_DAMAGE);
  const fallDmg = s.stats.falls * (s.assist ? FALL_DAMAGE / 2 : FALL_DAMAGE);
  const parts: string[] = [];
  if (s.stats.hits) parts.push(`충돌 ${s.stats.hits}회 (-${Math.round(hitsDmg)})`);
  if (s.stats.falls) parts.push(`낙하 ${s.stats.falls}회 (-${Math.round(fallDmg)})`);
  parts.push(`시간에 따른 체력 감소 (-${Math.round(s.stats.drained)})`);
  if (s.stats.hpFromPotions) parts.push(`물약 회복 (+${Math.round(s.stats.hpFromPotions)})`);
  const cause = s.deathCause ?? 'drain';
  let title = '체력이 다 닳았어요';
  if (cause.startsWith('hit:')) title = `마지막 한 방: ${hitName(cause.slice(4))}`;
  else if (cause === 'pit') title = '마지막 한 방: 구덩이';
  else if (cause === 'cap') title = '긴 달리기 끝! (10분 제한)';
  const worst = Object.entries(s.stats.hitsBy).sort((a, b) => b[1] - a[1])[0];
  let tip = '';
  if (worst && worst[1] >= 2) tip = ` · 가장 많이 부딪힌 것: ${hitName(worst[0])} ×${worst[1]}`;
  else if (cause === 'drain' && s.stats.hits <= 1) tip = ' · 거의 안 부딪혔어요! 물약(초록 하트)을 더 챙기면 더 멀리 가요';
  return { title, detail: parts.join(' · ') + tip };
}

/** "So close!" lines — what you almost got. */
export function nearMissHints(s: RunState, rw: RunReward): string[] {
  const out: string[] = [];
  const got = s.letters.filter(Boolean).length;
  if (got >= BONUS_WORD.length - 2 && got < BONUS_WORD.length && s.mode !== 'tutorial') out.push(`보너스 타임까지 글자 ${BONUS_WORD.length - got}개 남았었어요!`);
  if (!rw.newBest && rw.prevBest > 0 && rw.score >= rw.prevBest * 0.85) out.push(`최고 기록까지 ${fmtNum(rw.prevBest - rw.score)}점!`);
  return out.slice(0, 2);
}
