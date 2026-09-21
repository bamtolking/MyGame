import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Profile, ACHIEVEMENTS, xpToNext, dateKey } from '../client/js/profile.js';
import * as C from '../shared/constants.js';

const run = (o = {}) => ({ map: 'MEADOW', difficulty: 'NORMAL', cls: 'SURVIVOR', day: 3, score: 300, kills: 20, won: false, players: 1, daily: false, ticks: 6000, stats: { gathered: { wood: 10, stone: 2, iron: 0, food: 4 }, built: 5, fish: 1, bossKills: 0, eliteKills: 0, recovers: 0, perks: 2 }, ...o });

test('프로필: 판 기록으로 경험치·레벨·포인트·통계가 쌓인다', () => {
  const p = new Profile();
  assert.equal(p.level, 1); assert.equal(p.points, 0);
  const r = p.recordRun(run());
  assert.equal(r.xpGained, 3 * 40 + 20 * 2 + 30);
  assert.ok(r.pointsGained >= 4);
  assert.ok(r.newAchievements.some((a) => a.key === 'first_night'));
  assert.equal(p.data.stats.runs, 1); assert.equal(p.data.stats.kills, 20); assert.equal(p.data.stats.built, 5); assert.equal(p.data.stats.bestDay, 3);
  assert.equal(p.data.runs.length, 1);
  // 레벨업
  const r2 = p.recordRun(run({ day: 10, won: true, kills: 200, score: 3000 }));
  assert.ok(r2.levelUps.length >= 1, '레벨업');
  assert.ok(p.data.xp < xpToNext(p.level));
  assert.ok(r2.newAchievements.some((a) => a.key === 'first_win') && r2.newAchievements.some((a) => a.key === 'win_MEADOW'));
});

test('프로필: 난이도별 경험치 배율, 승리 통계로 해금', () => {
  const p = new Profile();
  const easy = p.recordRun(run({ difficulty: 'EASY' })).xpGained;
  const q = new Profile();
  const night = q.recordRun(run({ difficulty: 'NIGHTMARE' })).xpGained;
  assert.ok(night > easy * 2);
  assert.equal(p.isUnlocked('maps', 'DESERT'), false);
  assert.equal(p.isUnlocked('difficulties', 'HARD'), false);
  const r = p.recordRun(run({ won: true, day: 10 }));
  assert.ok(r.newUnlocks.includes('maps:DESERT') && r.newUnlocks.includes('difficulties:HARD') && r.newUnlocks.includes('maps:SNOW') && r.newUnlocks.includes('classes:COOK'));
  assert.equal(p.isUnlocked('difficulties', 'NIGHTMARE'), false);
  p.recordRun(run({ won: true, day: 12, difficulty: 'HARD' }));
  assert.ok(p.isUnlocked('difficulties', 'NIGHTMARE') && p.isUnlocked('maps', 'VOLCANO'));
});

test('프로필: 영구 강화 구매와 meta 변환, 저장/복원', () => {
  const store = (() => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; })();
  const p = new Profile(store);
  p.data.points = 10; p.save();
  assert.equal(p.canBuy('hp'), true);
  assert.equal(p.buy('hp'), true); assert.equal(p.upgradeLevel('hp'), 1); assert.equal(p.points, 7);
  assert.equal(p.canBuy('second_chance'), false, '15 포인트 필요');
  assert.deepEqual(p.meta.hp, 10);
  const q = new Profile(store);
  assert.equal(q.upgradeLevel('hp'), 1, '저장소에서 복원'); assert.equal(q.points, 7);
  assert.deepEqual(C.clampMeta(q.meta), q.meta);
});

test('프로필: 오늘의 도전은 날짜마다 같은 시드·전장, 완료 보너스는 하루 한 번', () => {
  const p = new Profile();
  const a = p.dailyInfo(new Date('2026-09-21T10:00:00')), b = p.dailyInfo(new Date('2026-09-21T23:00:00')), c = p.dailyInfo(new Date('2026-09-22T01:00:00'));
  assert.equal(a.seed, b.seed); assert.equal(a.map, b.map); assert.notEqual(a.seed, c.seed);
  assert.ok(C.MAPS[a.map] && C.DIFFICULTIES[a.difficulty]);
  const r1 = p.recordRun(run({ daily: true, day: 3 }));
  const r2 = p.recordRun(run({ daily: true, day: 4 }));
  assert.ok(r1.pointsGained - r2.pointsGained >= 5 - 2, '첫 완료에만 +5 (둘째 판은 일수 보너스만 +1)');
  assert.equal(p.dailyInfo().done, true);
  assert.equal(dateKey(new Date('2026-01-05')), '2026-01-05');
});

test('업적 정의가 일관됨 (키 중복 없음, 판정 함수 존재)', () => {
  const keys = new Set();
  for (const a of ACHIEVEMENTS) { assert.ok(!keys.has(a.key), a.key); keys.add(a.key); assert.ok(typeof a.run === 'function' || typeof a.total === 'function'); assert.ok(a.points > 0); }
});
