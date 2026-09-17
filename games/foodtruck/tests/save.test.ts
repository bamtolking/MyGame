import { describe, it, expect } from 'vitest';
import { makeRun, makeBot, advance, runUntilEnded, STEP } from './helpers';
import { serializeState, parseSave } from '../src/sim/save';
import { newMeta } from '../src/sim/meta';
import { actAccept, tick, drainEvents } from '../src/sim/run';
import { computeResult } from '../src/sim/result';
import type { RunState } from '../src/sim/types';

function clone(run: RunState): RunState {
  const p = parseSave(serializeState({ meta: newMeta(), run, screen: 'run' }));
  if (!p.ok) throw new Error(p.error);
  return p.blob.run!;
}

describe('저장과 복원', () => {
  it('직렬화 → 복원 후 같은 진행 결과가 나온다 (합성·접수·서빙 도중)', () => {
    const run = makeRun(2, 17);
    const bot = makeBot();
    advance(run, 40, bot);
    // 접수 직후 상태 만들기
    const c = run.customers.find((x) => x.state === 'ordering');
    if (c) { run.board.fill(null); c.order.items.forEach((it, i) => { run.board[i] = { id: 300 + i, family: it.family, tier: it.tier }; }); actAccept(run, c.id); }
    const copy = clone(run);
    expect(copy.board).toEqual(run.board);
    expect(copy.servingQueue).toEqual(run.servingQueue);
    expect(copy.ledger).toEqual(run.ledger);
    // 두 상태를 같은 방식으로 진행하면 같은 결과
    for (let i = 0; i < 30 * 60; i++) { tick(run, STEP); tick(copy, STEP); drainEvents(run); drainEvents(copy); }
    expect(copy.ledger.sales).toBe(run.ledger.sales);
    expect(copy.stats).toEqual(run.stats);
    expect(copy.customers.map((x) => x.state)).toEqual(run.customers.map((x) => x.state));
  });

  it('복원 후 같은 주문을 다시 결제하지 않는다', () => {
    const run = makeRun(1, 17);
    runUntilEnded(run, makeBot());
    const copy = clone(run);
    runUntilEnded(copy);
    expect(copy.ledger.deliveries.length).toBe(run.ledger.deliveries.length);
    expect(computeResult(copy).income).toBe(computeResult(run).income);
  });

  it('손상된 저장 데이터는 오류로 보고된다', () => {
    expect(parseSave(null).ok).toBe(false);
    expect(parseSave('{{{').ok).toBe(false);
    expect(parseSave('{"v":99}').ok).toBe(false);
    expect(parseSave('{"v":1,"meta":{"coins":"x"}}').ok).toBe(false);
    const good = serializeState({ meta: newMeta(), run: null, screen: 'title' });
    expect(parseSave(good).ok).toBe(true);
    // 장부 불일치
    const run = makeRun(1, 17); runUntilEnded(run, makeBot());
    const text = serializeState({ meta: newMeta(), run, screen: 'result' });
    const tampered = text.replace(`"sales":${run.ledger.sales}`, `"sales":${run.ledger.sales + 1000}`);
    expect(parseSave(tampered).ok).toBe(false);
    // 보드 중복 ID
    const run2 = makeRun(1, 1); run2.board[1] = { ...run2.board[0]! };
    expect(parseSave(serializeState({ meta: newMeta(), run: run2, screen: 'run' })).ok).toBe(false);
  });

  it('메타의 누락 필드는 기본값으로 채워진다', () => {
    const m = newMeta() as any; delete m.prepHintShown;
    const p = parseSave(JSON.stringify({ v: 1, savedAt: 1, screen: 'title', meta: m, run: null }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.blob.meta.prepHintShown).toBe(false);
  });
});
