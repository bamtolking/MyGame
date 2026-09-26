// Dev preview of one class's attack / ultimate effects in a staged forest scene (npm run dev → /dev/fx.html?cls=spear).
// The attack fires every 0.7 s at a dummy monster; the ultimate fires at 2 s with its sub-hits timed like the server does.
// Query: cls=<class id>, ult=<seconds until ult> (default 2), q=high|mid|low. window.__t = seconds elapsed.
import { generateMap, isWalkable } from '../src/shared/map.ts';
import { MON_IDX } from '../src/shared/data/monsters.ts';
import { CLASSES, isClassId, ATK } from '../src/shared/data/classes.ts';
import { PF } from '../src/shared/protocol.ts';
import type { ClassId, RosterEntry } from '../src/shared/types.ts';
import { Renderer, type REnt, type View } from '../src/client/render/world.ts';
import { FxSystem, hexCol } from '../src/client/render/fx.ts';
import { CLASS_FX, type FxCtx } from '../src/client/classfx/index.ts';
import { Sound } from '../src/client/audio/engine.ts';

const q = new URLSearchParams(location.search);
const cls: ClassId = isClassId(q.get('cls')) ? q.get('cls') as ClassId : 'sword';
const ultAt = Number(q.get('ult') ?? 2); const quality = (q.get('q') ?? 'high') as 'high' | 'mid' | 'low';
const map = generateMap(20260925); const L = map.lairs[0]; const px = L.x - 420, py = L.y + 60;
const stage = document.getElementById('stage')!;
const r = new Renderer(stage, map, quality);
const me: REnt = { id: 1, kind: 'p', t: 0, x: px, y: py, hp: 255, f: 0, face: 0, dieT: 0, vx: 0, seenT: 0 };
const mons: REnt[] = []; let nextId = 100;
const types = [MON_IDX.imp, MON_IDX.wisp, MON_IDX.clubber, MON_IDX.imp];
function spawn(i: number): REnt { const a = (i / 9) * Math.PI * 2 + 0.3, d = 110 + (i % 3) * 70; return { id: nextId++, kind: 'm', t: types[i % types.length], x: px + Math.cos(a) * d, y: py + Math.sin(a) * d * 0.8, hp: 255, f: 0, face: 0, dieT: 0, vx: 0, seenT: -1e9 }; }
for (let i = 0; i < 9; i++) mons.push(spawn(i));
let time = 0;
const fx = new FxSystem({ entPos: (k, id) => { const e = k === 'p' ? (id === 1 ? me : null) : mons.find(m => m.id === id); return e ? { x: e.x, y: e.y - (k === 'm' ? 14 : 18) } : null; }, serverTime: () => time, me: () => ({ x: me.x, y: me.y }), solidAt: (x, y) => !isWalkable(map, x, y), players: () => [{ x: me.x, y: me.y - 14 }] }, r.art);
r.fx = fx; r.setQuality(quality);
const roster = new Map<number, RosterEntry>([[1, { id: 1, name: CLASSES[cls].name, cls, level: 30, bot: false, tals: [], power: 999 }]]);
const snd = new Sound(); let n = 0; let ultT = 0;
const ctx = (x = me.x, y = me.y): FxCtx => ({ fx, snd, art: r.art, id: 1, mine: true, vol: 1, x, y, col: hexCol(CLASSES[cls].color), ult: ultT > 0, n, near: () => true, entPos: (k, id) => fx.host.entPos(k, id) });
const CF = CLASS_FX[cls];
function nearest(): REnt { let b = mons[0], bd = 1e9; for (const m of mons) { const d = (m.x - me.x) ** 2 + (m.y - me.y) ** 2; if (d < bd && m.dieT <= 0) { bd = d; b = m; } } return b; }
function hitReact(m: REnt) { r.anim.hit('m', m.id, m.x - me.x, m.y - me.y, 300, 1); }
function attack(): void {
  const t = nearest(); const ang = Math.atan2(t.y - me.y, t.x - me.x); me.face = ((ang / (Math.PI * 2) * 255) + 256) % 256;
  const others = mons.filter(m => m !== t).sort((a, b) => ((a.x - t.x) ** 2 + (a.y - t.y) ** 2) - ((b.x - t.x) ** 2 + (b.y - t.y) ** 2)).slice(0, cls === 'assassin' ? 3 : 2);
  const pts = (cls === 'taoist' || (cls === 'assassin' && ultT > 0)) ? others.flatMap(m => [Math.round(m.x), Math.round(m.y)]) : undefined;
  r.anim.attack(1, CF.atkDur); CF.atk(ctx(), { tx: t.x, ty: t.y, tid: t.id, pts }, ang); n++;
  setTimeout(() => hitReact(t), 120);
}
/** Ultimate sub-hit timelines, mirroring the server. */
function ult(): void {
  const t = nearest();
  CF.ult(ctx(), { x: me.x, y: me.y, tx: t.x, ty: t.y });
  ultT = CLASSES[cls].ultDur;
  const later = (s: number, f: () => void) => setTimeout(f, s * 1000);
  const H = (e: { x: number; y: number; x2?: number; y2?: number }) => CF.uhit?.(ctx(), e);
  if (cls === 'spear') for (let k = 0; k < 15; k++) later(k * 0.2, () => { const m = nearest(); const a = Math.atan2(m.y - me.y, m.x - me.x); H({ x: me.x, y: me.y, x2: me.x + Math.cos(a) * ATK.ultThrustLen, y2: me.y + Math.sin(a) * ATK.ultThrustLen }); });
  if (cls === 'taoist') for (let k = 0; k < 12; k++) later(0.15 + k * 0.2, () => { const m = mons[k % mons.length]; H({ x: m.x, y: m.y }); hitReact(m); });
  if (cls === 'gunner') for (let k = 0; k < 16; k++) later(k * 0.1, () => { const m = mons[k % mons.length]; H({ x: me.x, y: me.y, x2: m.x + (Math.random() - 0.5) * 40, y2: m.y + (Math.random() - 0.5) * 40 }); });
  if (cls === 'musician') for (const s of [0.2, 1.7, 3.2, 4.7]) later(s, () => H({ x: me.x, y: me.y }));
  if (cls === 'painter') for (let k = 0; k < 3; k++) later(0.3 + k * 0.6, () => { const a = k * 2.1 + 0.4; H({ x: me.x - Math.cos(a) * 210, y: me.y - Math.sin(a) * 160, x2: me.x + Math.cos(a) * 210, y2: me.y + Math.sin(a) * 160 }); });
}
let last = performance.now(), atkT = 0.5, ultDone = false;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt; (window as any).__t = time;
  const vdt = fx.hitstop > 0 ? dt * 0.06 : dt;
  if ((atkT -= dt) <= 0) { atkT = 0.7; attack(); }
  if (!ultDone && time >= ultAt) { ultDone = true; ult(); }
  ultT = Math.max(0, ultT - dt); me.f = ultT > 0 ? PF.WHIRL : 0;
  for (const m of mons) if (m.dieT > 0 && (m.dieT += dt) > 0.6) { Object.assign(m, spawn(Math.floor(Math.random() * 9))); }
  fx.update(vdt, dt);
  const view: View = { myId: 1, meX: me.x, meY: me.y, players: [me], mons, roster, renderTime: time, serverTime: time, zone: 1, bloodMoon: false, downed: false, hpFrac: 1, revive: 0, reviveOf: () => 0 };
  r.frame(view, dt, vdt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as any).__done = true;
