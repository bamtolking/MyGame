import { describe, it, expect } from 'vitest';
import { makeRun, makeBot, runUntilEnded, metaWith } from './helpers';
import { computeResult } from '../src/sim/result';
import { settleRun, newMeta } from '../src/sim/meta';
import { serializeState, parseSave } from '../src/sim/save';
import { dayDef } from '../src/data/days';

describe('경제와 정산', () => {
  it('정산은 영업 실행 ID 기준 한 번만 반영된다', () => {
    const meta = newMeta();
    const run = makeRun(1, 11, meta);
    runUntilEnded(run, makeBot());
    const res = computeResult(run);
    expect(res.income).toBeGreaterThan(0);
    const a = settleRun(meta, run, res);
    expect(a.applied).toBe(true);
    expect(meta.coins).toBe(res.income);
    const b = settleRun(meta, run, res);
    expect(b.applied).toBe(false);
    expect(meta.coins).toBe(res.income);
    // 저장·복원 뒤 같은 결과 화면을 다시 열어도 중복 입금되지 않는다
    const text = serializeState({ meta, run, screen: 'result' });
    const parsed = parseSave(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const c = settleRun(parsed.blob.meta, parsed.blob.run!, computeResult(parsed.blob.run!));
      expect(c.applied).toBe(false);
      expect(parsed.blob.meta.coins).toBe(res.income);
    }
  });

  it('재도전에서 새로 발생한 수입은 받을 수 있다', () => {
    const meta = newMeta();
    const r1 = makeRun(1, 11, meta); runUntilEnded(r1, makeBot()); settleRun(meta, r1, computeResult(r1));
    const c1 = meta.coins;
    const r2 = makeRun(1, 12, meta); r2.runId = 'test-1-12-b'; runUntilEnded(r2, makeBot()); settleRun(meta, r2, computeResult(r2));
    expect(meta.coins).toBe(c1 + computeResult(r2).income);
  });

  it('연습 영업은 코인을 주지 않는다', () => {
    const meta = newMeta();
    const run = makeRun(0, 1, meta, true);
    expect(run.board.filter(Boolean).length).toBe(0); // 연습은 시작 음식 없음
    runUntilEnded(run, makeBot());
    const res = computeResult(run);
    settleRun(meta, run, res);
    expect(meta.coins).toBe(0);
    expect(meta.unlockedDay).toBe(1);
  });

  it('최고 기록은 낮은 기록으로 덮어써지지 않고 별은 무한 증가하지 않는다', () => {
    const meta = newMeta();
    const good = makeRun(1, 11, meta); runUntilEnded(good, makeBot()); const gr = computeResult(good); settleRun(meta, good, gr);
    const best1 = { ...meta.best['1'] };
    const bad = makeRun(1, 13, meta); bad.runId = 'bad'; runUntilEnded(bad); const br = computeResult(bad); // 아무것도 안 함
    expect(br.served).toBe(0);
    settleRun(meta, bad, br);
    expect(meta.best['1'].stars).toBe(best1.stars);
    expect(meta.best['1'].income).toBe(best1.income);
    const again = makeRun(1, 11, meta); again.runId = 'again'; runUntilEnded(again, makeBot()); settleRun(meta, again, computeResult(again));
    expect(meta.best['1'].stars).toBe(Math.max(best1.stars, computeResult(again).stars));
    expect(meta.best['1'].stars).toBeLessThanOrEqual(3);
  });

  it('목표 달성 시 다음 영업일이 해금되고, 미달이면 해금되지 않는다', () => {
    const meta = newMeta();
    const fail = makeRun(1, 11, meta); runUntilEnded(fail); settleRun(meta, fail, computeResult(fail));
    expect(meta.unlockedDay).toBe(1);
    const ok = makeRun(1, 11, meta); ok.runId = 'ok'; runUntilEnded(ok, makeBot());
    const res = computeResult(ok);
    expect(res.served).toBeGreaterThanOrEqual(dayDef(1).targetServed);
    settleRun(meta, ok, res);
    expect(meta.unlockedDay).toBe(2);
  });

  it('별 기준은 실제 집계값으로 판정된다', () => {
    const run = makeRun(1, 11); runUntilEnded(run, makeBot());
    const r = computeResult(run);
    const d = dayDef(1);
    expect(r.star1).toBe(r.served >= d.targetServed);
    expect(r.star3).toBe(r.income >= d.incomeGoal);
    expect(r.stars).toBeLessThanOrEqual(3);
    if (!r.star1) expect(r.stars).toBe(0);
  });
});
