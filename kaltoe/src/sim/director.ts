// 소환 감독: 타임라인 구간 소환 + 이벤트(무리/포위/엘리트/보스/토스트) + 야근
import { BALANCE, ENEMY } from '../content';
import type { SpawnEntry, SpawnSegment, StageEvent } from '../content/types';
import { rand, randRange } from '../core/rng';
import { TAU } from '../core/math';
import type { World } from './types';
import { aliveCount, edgePoint, hpScale, MAX_ENEMIES, segmentHpMul, spawnEnemy } from './enemies';

const DT = 1 / 60;

export function currentSegment(w: World): SpawnSegment {
  const tl = w.cfg.stage.timeline;
  const t = Math.min(w.t, BALANCE.runSeconds - 0.001);
  for (const g of tl) if (t >= g.from && t < g.to) return g;
  return tl[tl.length - 1];
}

function pickFrom(w: World, pool: SpawnEntry[]): string | undefined {
  let total = 0;
  for (const p of pool) total += p.weight;
  let r = rand(w.rng) * total;
  for (const p of pool) { r -= p.weight; if (r < 0) return p.enemy; }
  return pool[pool.length - 1]?.enemy;
}

function spawnFromPool(w: World, pool: SpawnEntry[], segMul?: number) {
  const id = pickFrom(w, pool);
  const def = id ? ENEMY.get(id) : undefined;
  if (!def) return;
  const q = edgePoint(w, 30 + def.radius);
  spawnEnemy(w, def, q.x, q.y, hpScale(w, !!def.boss, segMul));
}

function runEvent(w: World, ev: StageEvent) {
  const p = w.player;
  const def = ev.enemy ? ENEMY.get(ev.enemy) : undefined;
  const segMul = ev.hpMul;
  switch (ev.kind) {
    case 'message':
      if (ev.text) w.events.push({ t: 'toast', text: ev.text, kind: 'info' });
      return;
    case 'swarm': {
      if (!def) return;
      const n = ev.count ?? 20;
      const ang = rand(w.rng) * TAU;
      const R = Math.max(w.viewW, w.viewH) / 2 + 60;
      const cx = p.x + Math.cos(ang) * R, cy = p.y + Math.sin(ang) * R;
      const dir = Math.atan2(p.y - cy, p.x - cx);
      for (let i = 0; i < n && aliveCount(w) < MAX_ENEMIES; i++) {
        const ox = randRange(w.rng, -70, 70), oy = randRange(w.rng, -70, 70);
        const e = spawnEnemy(w, def, cx + ox, cy + oy, hpScale(w, false, segMul));
        e.straight = true;
        const d = dir + randRange(w.rng, -0.08, 0.08);
        e.dx = Math.cos(d); e.dy = Math.sin(d);
        e.speed *= 1.25;
      }
      if (ev.text) w.events.push({ t: 'toast', text: ev.text, kind: 'warn' });
      return;
    }
    case 'ring': {
      if (!def) return;
      const n = ev.count ?? 24, r = ev.radius ?? 260;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        spawnEnemy(w, def, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, hpScale(w, false, segMul));
      }
      w.events.push({ t: 'toast', text: ev.text ?? '포위당했다!', kind: 'warn' });
      return;
    }
    case 'burst': {
      if (!def) return;
      const n = ev.count ?? 15;
      for (let i = 0; i < n && aliveCount(w) < MAX_ENEMIES; i++) {
        const q = edgePoint(w, 30 + def.radius);
        spawnEnemy(w, def, q.x, q.y, hpScale(w, false, segMul));
      }
      if (ev.text) w.events.push({ t: 'toast', text: ev.text, kind: 'warn' });
      return;
    }
    case 'elite': {
      if (!def) return;
      const n = w.flags.has('eliteRush') ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const q = edgePoint(w, 40 + def.radius);
        spawnEnemy(w, def, q.x, q.y, hpScale(w, false, segMul));
      }
      if (ev.text) w.events.push({ t: 'toast', text: ev.text, kind: 'warn' });
      return;
    }
    case 'boss': {
      if (!def) return;
      if (def.id === w.cfg.stage.finalBoss && w.finalBossSpawned) return;
      const q = edgePoint(w, 40 + def.radius);
      spawnEnemy(w, def, q.x, q.y, hpScale(w, true));
      if (ev.text) w.events.push({ t: 'toast', text: ev.text, kind: 'boss' });
      return;
    }
  }
}

export function updateDirector(w: World) {
  const stage = w.cfg.stage;
  const t = w.t;
  let pool: SpawnEntry[];
  let rate: number;
  let minAlive: number;
  if (w.t >= BALANCE.runSeconds) {
    // 야근 확정/야근 모드: 마지막 구간 + 분당 증가
    const last = stage.timeline[stage.timeline.length - 1];
    const min = (w.t - BALANCE.runSeconds) / 60;
    const grow = 1 + BALANCE.overtimeSpawnGrowth * min;
    pool = w.overtime ? stage.overtimePool : last.pool;
    rate = (last.rateEnd ?? last.rate) * grow;
    minAlive = last.minAlive * Math.min(2, grow);
  } else {
    const g = currentSegment(w);
    const k = (t - g.from) / Math.max(1e-6, g.to - g.from);
    pool = g.pool;
    rate = g.rate + ((g.rateEnd ?? g.rate) - g.rate) * k;
    minAlive = g.minAlive;
  }
  const curse = 1 + w.d.curse;
  rate *= w.spawnMul * curse;
  minAlive *= Math.min(2, w.spawnMul * curse);
  // 보스와 싸우는 중에는 잡몹 소환을 조금 줄인다(패턴 가독성)
  if (w.bossAlive && !w.bossAlive.dead) rate *= 0.7;

  let alive = aliveCount(w);
  w.spawnAcc += rate * DT;
  let guard = 0;
  while (w.spawnAcc >= 1 && guard++ < 20) {
    w.spawnAcc -= 1;
    if (alive >= MAX_ENEMIES) { w.spawnAcc = 0; break; }
    spawnFromPool(w, pool);
    alive++;
  }
  // 최소 생존 수 보충: 화면을 싹 쓸어도 적이 비지 않게 하되, 초당 보충량은 기본 소환의 2배(최소 8)로 제한
  if (alive < minAlive) {
    w.refillAcc = Math.min(6, w.refillAcc + Math.max(8, rate * 2) * DT);
    while (w.refillAcc >= 1 && alive < minAlive && alive < MAX_ENEMIES) { w.refillAcc -= 1; spawnFromPool(w, pool); alive++; }
  } else w.refillAcc = 0;

  // 이벤트
  const evs = stage.events;
  while (w.eventIdx < evs.length && evs[w.eventIdx].at <= t) {
    runEvent(w, evs[w.eventIdx]);
    w.eventIdx++;
  }
  // 최종 보스 보장
  if (!w.finalBossSpawned && t >= BALANCE.finalBossAt) {
    const fb = ENEMY.get(stage.finalBoss);
    if (fb) {
      const q = edgePoint(w, 40 + fb.radius);
      spawnEnemy(w, fb, q.x, q.y, hpScale(w, true));
    }
  }
  // 야근 모드: 주기적 엘리트
  if (w.overtime) {
    const prev = Math.floor((w.t - DT - BALANCE.runSeconds) / 45);
    const cur = Math.floor((w.t - BALANCE.runSeconds) / 45);
    if (cur > prev && cur > 0) {
      const elites = [...new Set(stage.events.filter(e => e.kind === 'elite' && e.enemy).map(e => e.enemy!))];
      const id = elites.length ? elites[Math.floor(rand(w.rng) * elites.length)] : undefined;
      const def = id ? ENEMY.get(id) : undefined;
      if (def) { const q = edgePoint(w, 50); spawnEnemy(w, def, q.x, q.y, hpScale(w, false)); }
    }
  }
  void segmentHpMul;
}

/** 표시용 게임 속 시각(분 단위, 09:00 = 540) */
export function clockMinutes(w: World): number {
  if (w.yageun && !w.cleared) return 17 * 60 + 59;
  const perSec = (9 * 60) / BALANCE.runSeconds;
  return 9 * 60 + Math.floor(w.t * perSec);
}

export function clockText(w: World): string {
  const m = clockMinutes(w);
  const hh = Math.floor(m / 60), mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
