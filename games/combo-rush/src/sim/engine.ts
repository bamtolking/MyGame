// 웨이브 진행·보스·승패·스냅샷·액션 디스패치. 고정 시간 스텝(1/60초).
import type { GameState } from './types';
import { STATE_VERSION, spawnEnemy, pushLog, unitById } from './state';
import { waveDef, hpMul, DIFF } from '../data/waves';
import { ENEMIES } from '../data/enemies';
import { TOTAL_WAVES, PREP_BETWEEN, waveReward } from '../data/economy';
import { computeCtx, updateUnits, updateProjectiles, updateEnemies } from './combat';
import * as roster from './roster';
import { MAPS } from '../data/maps';

export const DT = 1 / 60;
export type Result = roster.Result;

export function startWave(s: GameState, n: number): void {
  const def = waveDef(n, s.difficulty); const diff = DIFF[s.difficulty];
  const mul = hpMul(n);
  const q: { at: number; kind: typeof def.groups[number]['kind']; hpMul: number }[] = [];
  for (const g of def.groups) for (let i = 0; i < g.n; i++) q.push({ at: g.delay + i * g.gap * diff.gapMul, kind: g.kind, hpMul: mul });
  q.sort((a, b) => a.at - b.at);
  s.wave = n; s.phase = 'wave'; s.prepT = 0;
  s.waveRt = { index: n, queue: q, t: 0, spawned: 0, startedAt: s.time };
  s.events.push({ t: 'wave', index: n });
  if (def.boss) pushLog(s, `보스 등장: ${ENEMIES[def.boss].name} — ${ENEMIES[def.boss].hint}`, 'warn');
  else if (def.intro && n > 1) { const d = ENEMIES[def.intro]; pushLog(s, `새로운 적 [${d.trait}] ${d.name}: ${d.hint}`, 'info'); }
}

function endWave(s: GameState): void {
  const n = s.wave; const reward = Math.round(waveReward(n) * DIFF[s.difficulty].rewardMul);
  s.gold += reward; s.stats.goldEarned += reward;
  const base = MAPS[s.mapId].base;
  s.events.push({ t: 'gold', x: base.x, y: base.y - 30, amount: reward });
  pushLog(s, `웨이브 ${n} 완료 +${reward} 골드`, 'good');
  s.waveRt = null; s.projectiles = [];
  if (n >= TOTAL_WAVES) { s.phase = 'won'; s.events.push({ t: 'won' }); return; }
  s.wave = n + 1; s.phase = 'prep'; s.prepT = PREP_BETWEEN; s.prepMax = PREP_BETWEEN;
}

export function earlyStart(s: GameState): Result {
  if (s.phase !== 'prep') return { ok: false, error: '대기 중이 아닙니다' };
  startWave(s, s.wave); return { ok: true };
}

/** 한 스텝 진행. 일시정지는 호출하지 않는 것으로 구현(모든 시간이 함께 멈춤). */
export function step(s: GameState, dt = DT): void {
  if (s.phase === 'won' || s.phase === 'lost') return;
  s.time += dt; s.stats.playTime += dt;
  if (s.phase === 'prep') {
    s.prepT -= dt;
    for (const u of s.units) if (u.moveCd > 0) u.moveCd = Math.max(0, u.moveCd - dt);
    updateProjectiles(s, dt);
    if (s.prepT <= 0) startWave(s, s.wave);
    return;
  }
  const rt = s.waveRt!;
  rt.t += dt;
  while (rt.queue.length && rt.queue[0].at <= rt.t) {
    const it = rt.queue.shift()!;
    spawnEnemy(s, it.kind, it.hpMul); rt.spawned++;
    if (ENEMIES[it.kind].boss) { const e = s.enemies[s.enemies.length - 1]; s.events.push({ t: 'boss', kind: it.kind, x: e.x, y: e.y }); }
  }
  const ctx = computeCtx(s);
  updateUnits(s, dt, ctx);
  updateProjectiles(s, dt);
  updateEnemies(s, dt);
  if ((s.phase as string) === 'lost') return;
  if (rt.queue.length === 0 && s.enemies.length === 0 && s.projectiles.length === 0) endWave(s);
}

// ---------- 액션 ----------
export type Action =
  | { type: 'place'; offer: number; slot: number }
  | { type: 'refresh' }
  | { type: 'move'; id: number; slot: number }
  | { type: 'merge'; a: number; b: number }
  | { type: 'sell'; id: number }
  | { type: 'early' };

export function dispatch(s: GameState, a: Action): Result {
  switch (a.type) {
    case 'place': return roster.place(s, a.offer, a.slot);
    case 'refresh': return roster.refresh(s);
    case 'move': return roster.move(s, a.id, a.slot);
    case 'merge': return roster.merge(s, a.a, a.b);
    case 'sell': return roster.sell(s, a.id);
    case 'early': return earlyStart(s);
  }
}

// ---------- 스냅샷 ----------
export function serialize(s: GameState): string {
  const { events, ...rest } = s; return JSON.stringify({ ...rest, events: [] });
}
export function deserialize(json: string): GameState {
  const o = JSON.parse(json);
  if (!o || typeof o !== 'object') throw new Error('저장 데이터 형식 오류');
  if (o.version !== STATE_VERSION) throw new Error(`저장 버전 불일치 (${o.version} ≠ ${STATE_VERSION})`);
  if (!Array.isArray(o.units) || !Array.isArray(o.slots) || !o.rng || !Array.isArray(o.offer) || typeof o.wave !== 'number' || !o.mapId || !MAPS[o.mapId as 'A']) throw new Error('저장 데이터 손상');
  if (o.offer.length !== 3 || typeof o.gold !== 'number' || typeof o.life !== 'number') throw new Error('저장 데이터 손상(필수 값 누락)');
  for (const u of o.units) if (typeof u.id !== 'number' || typeof u.slot !== 'number' || !u.kind) throw new Error('저장 데이터 손상(유닛)');
  o.events = [];
  return o as GameState;
}
export function stateHash(s: GameState): string {
  const str = serialize(s); let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
export { unitById };
