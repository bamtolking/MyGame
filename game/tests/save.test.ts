import { describe, it, expect, beforeEach } from 'vitest';
import { useStorage, loadMeta, saveMeta, loadCheckpoint, saveCheckpoint, clearCheckpoint, defaultMeta, storageInfo, META_KEY, RUN_KEY, type StorageLike } from '../src/platform/storage';
import { newGame, createUnit } from '../src/sim/state';
import { serialize, deserialize, step, dispatch, stateHash } from '../src/sim/engine';

class FakeStorage implements StorageLike { m = new Map<string, string>(); fail = false; getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { if (this.fail) throw new Error('QuotaExceeded'); this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
let fs: FakeStorage;
beforeEach(() => { fs = new FakeStorage(); useStorage(fs); });

describe('메타 저장', () => {
  it('기본값 → 저장 → 읽기', () => {
    const { meta } = loadMeta(); expect(meta).toEqual(defaultMeta());
    meta.tutorialDone = true; meta.codex.push('ignite'); meta.unlocked.mapB = true; expect(saveMeta(meta).ok).toBe(true);
    const back = loadMeta(); expect(back.error).toBeNull(); expect(back.meta.tutorialDone).toBe(true); expect(back.meta.codex).toEqual(['ignite']); expect(back.meta.unlocked.mapB).toBe(true);
  });
  it('손상된 JSON 은 안내와 함께 기본값으로 복구되고 이후 정상 저장된다', () => {
    fs.m.set(META_KEY, '{not json'); const r = loadMeta(); expect(r.error).toMatch(/손상/); expect(r.meta).toEqual(defaultMeta());
    expect(fs.m.has(META_KEY)).toBe(false); expect(saveMeta(r.meta).ok).toBe(true);
  });
  it('버전이 다르면 초기화 안내', () => { fs.m.set(META_KEY, JSON.stringify({ version: 99 })); const r = loadMeta(); expect(r.error).toMatch(/버전/); expect(r.meta.version).toBe(defaultMeta().version); });
  it('일부 필드가 빠져도 기본값으로 채운다', () => { fs.m.set(META_KEY, JSON.stringify({ version: 1, settings: { sfx: 0.2 }, codex: ['x', 3] })); const r = loadMeta(); expect(r.error).toBeNull(); expect(r.meta.settings.sfx).toBe(0.2); expect(r.meta.settings.fxLevel).toBe(2); expect(r.meta.codex).toEqual(['x']); });
  it('저장소 쓰기 실패 시 오류를 반환하지만 예외는 던지지 않는다', () => { fs.fail = true; useStorage(fs); expect(storageInfo.available).toBe(false); const r = saveMeta(defaultMeta()); expect(r.ok).toBe(false); expect(r.error).toBeTruthy(); expect(loadMeta().meta).toEqual(defaultMeta()); });
});

describe('체크포인트(웨이브 시작 시점 저장)', () => {
  it('저장 → 새로고침 가정 → 복원하면 같은 상태에서 이어진다', () => {
    const s = newGame({ mapId: 'B', difficulty: 'hard', seed: 5, now: 1 });
    s.offer[0] = 'laser'; dispatch(s, { type: 'place', offer: 0, slot: 3 }); dispatch(s, { type: 'refresh' }); createUnit(s, 'tesla', 3, 6); createUnit(s, 'bomber', 3, 7);
    for (let i = 0; i < 60 * 60; i++) { if (s.phase === 'prep' && s.wave > 1) break; step(s); } // 웨이브 2 시작 시점
    expect(s.wave).toBeGreaterThanOrEqual(2);
    const cp = { version: 1, runId: s.runId, mapId: s.mapId, difficulty: s.difficulty, wave: s.wave, savedAt: 1, state: serialize(s) };
    expect(saveCheckpoint(cp).ok).toBe(true);
    const back = loadCheckpoint(); expect(back.error).toBeNull(); expect(back.cp!.runId).toBe(s.runId);
    const t = deserialize(back.cp!.state);
    expect(t.mapId).toBe('B'); expect(t.difficulty).toBe('hard'); expect(t.wave).toBe(s.wave); expect(t.gold).toBe(s.gold); expect(t.life).toBe(s.life);
    expect(t.units.map(u => [u.kind, u.grade, u.slot])).toEqual(s.units.map(u => [u.kind, u.grade, u.slot]));
    expect(t.offer).toEqual(s.offer); expect(t.refreshFree).toBe(s.refreshFree); expect(t.rng).toEqual(s.rng); expect(t.seed).toBe(s.seed);
    expect(t.enemies.length).toBe(s.enemies.length); // 적 상태도 동일(웨이브 시작 시점엔 0)
    for (let i = 0; i < 600; i++) { step(s); step(t); } expect(stateHash(t)).toBe(stateHash(s));
  });
  it('손상된 체크포인트는 삭제되고 안내된다', () => { fs.m.set(RUN_KEY, '{"runId":1}'); const r = loadCheckpoint(); expect(r.cp).toBeNull(); expect(r.error).toMatch(/손상/); expect(fs.m.has(RUN_KEY)).toBe(false); });
  it('상태 문자열이 손상되면 deserialize 가 예외를 던진다(앱은 삭제 후 안내)', () => { const s = newGame({ mapId: 'A', difficulty: 'normal', seed: 1, now: 1 }); const json = serialize(s).replace('"units":[]', '"units":"x"'); expect(() => deserialize(json)).toThrow(); });
  it('clearCheckpoint 후에는 이어하기가 없다', () => { saveCheckpoint({ version: 1, runId: 'r', mapId: 'A', difficulty: 'normal', wave: 3, savedAt: 1, state: '{}' }); clearCheckpoint(); expect(loadCheckpoint().cp).toBeNull(); });
});

describe('일시정지·배속 일관성', () => {
  it('일시정지는 step 을 호출하지 않는 것이므로 모든 시간이 함께 멈춘다(상태 해시 불변)', () => {
    const s = newGame({ mapId: 'A', difficulty: 'normal', seed: 3, now: 1 }); s.offer[0] = 'flame'; dispatch(s, { type: 'place', offer: 0, slot: 1 });
    for (let i = 0; i < 60 * 15; i++) step(s); const h = stateHash(s); const t = s.time; const e = s.enemies.map(e => e.dist);
    // "일시정지" 동안 아무 것도 하지 않음 → 변화 없음
    expect(stateHash(s)).toBe(h); expect(s.time).toBe(t); expect(s.enemies.map(e => e.dist)).toEqual(e);
  });
  it('2배속은 같은 스텝을 두 번 더 진행하는 것뿐이므로 1배속과 결과가 같다', () => {
    const a = newGame({ mapId: 'A', difficulty: 'normal', seed: 4, now: 1 }), b = newGame({ mapId: 'A', difficulty: 'normal', seed: 4, now: 1 });
    for (const s of [a, b]) { s.offer[0] = 'tesla'; dispatch(s, { type: 'place', offer: 0, slot: 1 }); s.offer[0] = 'frost'; dispatch(s, { type: 'place', offer: 0, slot: 2 }); }
    for (let i = 0; i < 60 * 30; i++) step(a);
    for (let f = 0; f < 60 * 15; f++) { step(b); step(b); } // 프레임당 2스텝 = 2배속
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
