// 테스트 공용: 메타 생성, 실행 진행, 간단한 봇.
import { TIME } from '../src/data/balance';
import type { Family } from '../src/data/foods';
import { FAMILIES } from '../src/data/foods';
import { newMeta } from '../src/sim/meta';
import { createRun, tick, actAccept, actMerge, actSpawn, orderReady, drainEvents } from '../src/sim/run';
import type { MetaState, RunState, Furniture, Customer } from '../src/sim/types';
import { countByKey } from '../src/sim/board';

export function metaWith(opts: { layout?: Furniture[]; speed?: number; coins?: number } = {}): MetaState {
  const m = newMeta();
  if (opts.layout) { m.layout = opts.layout.map((f) => ({ ...f })); m.nextFurnitureId = Math.max(0, ...opts.layout.map((f) => f.id)) + 1; }
  if (opts.speed != null) m.staffSpeedLevel = opts.speed;
  if (opts.coins != null) m.coins = opts.coins;
  return m;
}

export const STEP = TIME.step;

export function advance(run: RunState, seconds: number, onStep?: (run: RunState) => void): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) { tick(run, STEP); onStep?.(run); drainEvents(run); }
}

export function runUntilEnded(run: RunState, onStep?: (run: RunState) => void, maxSeconds = 400): void {
  let t = 0;
  while (run.phase !== 'ended' && t < maxSeconds) { tick(run, STEP); onStep?.(run); drainEvents(run); t += STEP; }
}

export interface BotOptions {
  /** 조작 간격(초). 사람의 탭 속도를 흉내낸다 */
  actionInterval?: number;
  /** 무조건 최고 단계로 합치는 성향 */
  greedyMerge?: boolean;
  /** 주문이 없을 때 미리 만들어 둘 1단계 재고 (계열별) */
  stock?: number;
  /** 새 주문을 읽고 반응하기까지 걸리는 시간(초) */
  reactionDelay?: number;
}

/** 주문을 보고 필요한 음식을 만들어 서빙하는 단순 봇. 한 스텝에 최대 한 조작. */
export function makeBot(opts: BotOptions = {}) {
  const interval = opts.actionInterval ?? 0.4;
  const stock = opts.stock ?? 2;
  const delay = opts.reactionDelay ?? 0;
  let acc = 0;
  return (run: RunState): void => {
    acc += STEP;
    if (acc < interval || run.phase !== 'open') return;
    acc = 0;
    const ordering = run.customers.filter((c) => c.state === 'ordering' && (c.seatedAt ?? 0) + delay <= run.t).sort((a, b) => a.orderPatience - b.orderPatience);
    // 1) 준비된 주문 접수 (급한 순)
    for (const c of ordering) if (orderReady(run, c)) { actAccept(run, c.id); return; }
    // 2) 가장 급한 주문에 필요한 음식 만들기
    for (const c of ordering) {
      if (buildToward(run, c)) return;
    }
    // 3) 대기 중인 주문이 없으면 재고 준비
    const counts = countByKey(run.board);
    for (const fam of FAMILIES) {
      if ((counts[`${fam}:1`] || 0) < stock) { if (actSpawn(run, fam).result.ok) return; }
    }
    if (opts.greedyMerge) {
      for (const fam of FAMILIES) for (let t = 1; t < run.maxTier; t++) {
        const pair = twoOf(run, fam, t);
        if (pair) { actMerge(run, pair[0], pair[1]); return; }
      }
    }
  };
}

function twoOf(run: RunState, fam: Family, tier: number): [number, number] | null {
  const ids = run.board.filter((c) => c && c.family === fam && c.tier === tier).map((c) => c!.id);
  return ids.length >= 2 ? [ids[0], ids[1]] : null;
}

/** 주문 c에 필요한 음식 중 부족한 것을 향해 한 조작 수행. 조작했으면 true */
function buildToward(run: RunState, c: Customer): boolean {
  const have = countByKey(run.board);
  const need: Record<string, number> = {};
  for (const it of c.order.items) { const k = `${it.family}:${it.tier}`; need[k] = (need[k] || 0) + 1; }
  for (const [k, n] of Object.entries(need)) {
    const [fam, tierS] = k.split(':') as [Family, string];
    const tier = Number(tierS);
    if ((have[k] || 0) >= n) continue;
    // 부족: 아래 단계부터 재귀적으로 만든다
    return buildTier(run, fam, tier, have, n - (have[k] || 0));
  }
  return false;
}

function buildTier(run: RunState, fam: Family, tier: number, have: Record<string, number>, needCount: number): boolean {
  if (tier === 1) return actSpawn(run, fam).result.ok;
  const lowerKey = `${fam}:${tier - 1}`;
  const lower = have[lowerKey] || 0;
  // 아래 단계가 2개 이상이면 합치기 (단, 다른 주문이 그 단계를 기다리면 여분만)
  const reservedLower = run.customers.filter((x) => x.state === 'ordering').reduce((s, x) => s + x.order.items.filter((it) => it.family === fam && it.tier === tier - 1).length, 0);
  if (lower - reservedLower >= 2) {
    const pair = twoOf(run, fam, tier - 1);
    if (pair) return actMerge(run, pair[0], pair[1]).result.ok;
  }
  return buildTier(run, fam, tier - 1, have, needCount * 2);
}

export function makeRun(dayId: number, seed: number, meta = metaWith(), practice = false): RunState {
  return createRun({ dayId, seed, meta, practice, runId: `test-${dayId}-${seed}` });
}
