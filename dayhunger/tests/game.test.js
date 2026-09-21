import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, solidForPlayer } from '../shared/game.js';
import * as C from '../shared/constants.js';
const { T } = C;

const mk = (seed = 7, opts = {}) => new Game({ seed, ...opts });
const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };
// 플레이어 주변을 평지로 만들고 특정 위치로 옮김
const clearAround = (g, cx, cy, r = 6) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (g.inBounds(x, y)) g.setTile(g.idx(x, y), T.GROUND); };
const place = (g, p, x, y) => { clearAround(g, x, y); p.x = x + 0.5; p.y = y + 0.5; };

test('월드 생성: 전장 5종 모두 넓은 맵, 중앙 모닥불, 출현 지점·기지 자원 보장', () => {
  for (const key of Object.keys(C.MAPS)) {
    const g = mk(3, { map: key });
    assert.ok(g.w >= 88 && g.w === C.MAPS[key].size, key + ' 크기');
    assert.equal(g.tileAt(g.center.x, g.center.y), T.CAMPFIRE);
    assert.ok(g.spawnTiles.length > 100, key + ' 출현 지점 ' + g.spawnTiles.length);
    // 출현 지점은 기지에서 spawnRing 거리
    const [r0, r1] = C.MAPS[key].spawnRing;
    for (const i of g.spawnTiles.slice(0, 50)) { const d = Math.max(Math.abs((i % g.w) - g.center.x), Math.abs(((i / g.w) | 0) - g.center.y)); assert.ok(d >= r0 * 0.6 && d <= Math.max(r1, g.w / 2), key + ' 거리 ' + d); }
    let trees = 0, iron = 0, food = 0;
    for (let y = g.center.y - 11; y <= g.center.y + 11; y++) for (let x = g.center.x - 11; x <= g.center.x + 11; x++) {
      const t = g.tileAt(x, y);
      if (t === T.TREE || t === T.PINE || t === T.DEAD_TREE || t === T.CACTUS) trees++;
      if (t === T.IRON_ORE) iron++;
      if (t === T.BUSH || t === T.MUSHROOM) food++;
    }
    assert.ok(trees >= 8 && iron >= 2 && food >= 4, `${key} 기지 자원 나무${trees} 철${iron} 식량${food}`);
  }
});

test('같은 시드·전장은 같은 월드, 다른 전장은 다른 구성', () => {
  assert.deepEqual(Array.from(mk(42, { map: 'SNOW' }).tiles), Array.from(mk(42, { map: 'SNOW' }).tiles));
  const swamp = mk(1, { map: 'SWAMP' }), desert = mk(1, { map: 'DESERT' });
  const cnt = (g, t) => g.tiles.filter((v) => v === t).length;
  assert.ok(cnt(swamp, T.WATER) > cnt(desert, T.WATER) * 3, '늪지는 물이 훨씬 많음');
  assert.ok(cnt(desert, T.CACTUS) > 100 && cnt(swamp, T.CACTUS) === 0);
  assert.ok(cnt(mk(1, { map: 'VOLCANO' }), T.LAVA) > 50);
  assert.ok(cnt(mk(1, { map: 'SNOW' }), T.PINE) > 500);
});

test('채집: 나무 3번 → 나무 4, 그루터기 → 재성장. 벌목꾼은 2번 만에 5개', () => {
  for (const [cls, swings, wood] of [['SURVIVOR', 3, 4], ['LUMBERJACK', 2, 5]]) {
    const g = mk();
    const p = g.addPlayer('나', cls);
    place(g, p, 20, 20);
    g.setTile(g.idx(21, 20), T.TREE);
    p.dx = 1; p.dy = 0;
    const wood0 = p.inv.wood;
    g.setInput(p.id, { mx: 0, my: 0, action: true });
    run(g, C.PLAYER.actionCooldown * swings + 2);
    assert.equal(p.inv.wood, wood0 + wood, cls);
    assert.equal(g.tileAt(21, 20), T.STUMP);
    if (cls === 'SURVIVOR') { run(g, C.REGROW[T.STUMP].ticks + 2); assert.equal(g.tileAt(21, 20), T.TREE); }
  }
});

test('자원 다양성: 철광석→철(바위 남음), 낚시, 버섯, 약초(즉시 회복), 선인장', () => {
  const g = mk();
  const p = g.addPlayer('나', 'MINER');
  place(g, p, 20, 20);
  const gather = (tile, x, y, swings) => { g.setTile(g.idx(x, y), tile); p.dx = Math.sign(x - 20) || 0; p.dy = Math.sign(y - 20) || 0; g.setInput(p.id, { mx: 0, my: 0, action: true }); run(g, C.PLAYER.actionCooldown * swings + 2); g.setInput(p.id, { mx: 0, my: 0, action: false }); run(g, 2); };
  gather(T.IRON_ORE, 21, 20, 3); // 광부: 5번 → 3번
  assert.equal(p.inv.iron, 3, '철 2 + 광부 보너스 1'); assert.equal(g.tileAt(21, 20), T.ROCK);
  gather(T.ROCK, 21, 20, 2); assert.equal(p.inv.stone, C.PLAYER.startInv.stone + 4); assert.equal(g.tileAt(21, 20), T.GROUND);
  const food0 = p.inv.food;
  gather(T.WATER, 20, 21, 2); assert.equal(p.inv.food, food0 + 2, '낚시'); assert.equal(g.tileAt(20, 21), T.WATER_EMPTY);
  gather(T.MUSHROOM, 19, 20, 1); assert.equal(p.inv.food, food0 + 4); assert.equal(g.tileAt(19, 20), T.MUSHROOM_EMPTY);
  p.hp = 50; gather(T.HERB, 20, 19, 1); assert.equal(Math.round(p.hp), 75, '약초 즉시 회복'); assert.equal(g.tileAt(20, 19), T.HERB_EMPTY);
  const w0 = p.inv.wood; gather(T.CACTUS, 21, 21, 2); assert.equal(p.inv.wood, w0 + 2); assert.equal(p.inv.food, food0 + 5);
});

test('건설: 캐릭터별 비용(건축가 25% 할인), 범위 밖·막힌 타일·자원 부족 거부, 철 벽·함정·횃불', () => {
  const g = mk();
  const p = g.addPlayer('나', 'BUILDER');
  place(g, p, 20, 20);
  p.inv.iron = 10;
  assert.deepEqual(C.costFor('BUILDER', C.BUILDINGS.STONE_WALL.cost), { stone: 2 });
  const stone0 = p.inv.stone;
  assert.equal(g.build(p.id, 'STONE_WALL', 22, 20).ok, true);
  assert.equal(p.inv.stone, stone0 - 2);
  assert.equal(g.build(p.id, 'IRON_WALL', 24, 20).ok, true, '건축가는 4칸까지');
  assert.equal(g.tileHp[g.idx(24, 20)], C.BUILDINGS.IRON_WALL.hp);
  assert.equal(g.build(p.id, 'WOOD_WALL', 25, 20).ok, false, '5칸은 너무 멀다');
  assert.equal(g.build(p.id, 'WOOD_WALL', 22, 20).ok, false, '이미 건물');
  assert.equal(g.build(p.id, 'WOOD_WALL', 0, 0).ok, false, '가장자리');
  assert.equal(g.build(p.id, 'SPIKES', 20, 22).ok, true);
  assert.equal(g.build(p.id, 'TORCH', 21, 22).ok, true);
  assert.equal(solidForPlayer(T.SPIKES), false, '함정은 밟을 수 있음');
  p.inv.stone = 0; p.inv.iron = 0;
  assert.equal(g.build(p.id, 'HEAVY_TURRET', 20, 18).ok, false, '자원 부족');
  const w1 = p.inv.wood;
  assert.equal(g.dismantle(p.id, 20, 22).ok, true); assert.equal(p.inv.wood, w1 + 1);
});

test('먹기: 요리사는 1.5배, 모닥불 근처면 더 회복', () => {
  const g = mk();
  const p = g.addPlayer('나', 'COOK');
  p.hunger = 10; p.inv.food = 2;
  assert.equal(g.eat(p.id).ok, true);
  assert.equal(p.hunger, 10 + C.PLAYER.campfireFoodValue * 1.5);
  place(g, p, 20, 20); p.hunger = 10; g.eat(p.id);
  assert.equal(p.hunger, 10 + C.PLAYER.foodValue * 1.5);
});

test('난이도: 웨이브 수·목표 날짜·보스 밤이 달라짐', () => {
  const easy = mk(1, { difficulty: 'EASY' }), nightmare = mk(1, { difficulty: 'NIGHTMARE' });
  for (const g of [easy, nightmare]) { g.addPlayer('a'); g.phase = 'night'; g.day = 3; g.startNight(); }
  assert.ok(nightmare.spawnQueue.length > easy.spawnQueue.length * 2, `${easy.spawnQueue.length} vs ${nightmare.spawnQueue.length}`);
  assert.equal(easy.winDay, 7); assert.equal(nightmare.winDay, 15);
  assert.ok(nightmare.bossNights.has(7) && nightmare.bossNights.has(14));
  const e1 = easy.spawnEnemy('ZOMBIE', 5, 5), e2 = nightmare.spawnEnemy('ZOMBIE', 5, 5);
  assert.ok(e2.maxHp > e1.maxHp * 1.8);
});

test('전장별 적 구성: 설원은 브루트, 사막은 도둑이 많이 나옴', () => {
  const g = mk(1, { map: 'SNOW' }); g.addPlayer('a'); g.day = 6; g.phase = 'night';
  const snowPool = Object.fromEntries(g.wavePool().map(([k, w]) => [k, w]));
  const d = mk(1, { map: 'DESERT' }); d.addPlayer('a'); d.day = 6; d.phase = 'night';
  const desertPool = Object.fromEntries(d.wavePool().map(([k, w]) => [k, w]));
  assert.ok(snowPool.BRUTE > desertPool.BRUTE && desertPool.THIEF > snowPool.THIEF);
  assert.ok(Object.keys(snowPool).length >= 7, '6일이면 대부분 종류 등장');
});

test('낮밤 주기: 전장별 낮 길이, 밤에 적 출현, 아침 보급(철 포함)과 부활', () => {
  const g = mk(2, { map: 'DESERT' });
  const p = g.addPlayer('나');
  assert.equal(g.dayTicks, C.MAPS.DESERT.dayTicks);
  run(g, g.dayTicks);
  assert.equal(g.phase, 'night');
  run(g, C.TICK_RATE * 15);
  assert.ok(g.enemies.length > 0, '적이 나와야 함');
  const keep = () => { p.hp = 100; p.hunger = 100; };
  for (let i = 0; i < g.nightTicks; i++) { keep(); g.tick(); }
  assert.equal(g.day, 2);
  assert.equal(p.inv.iron, C.DAWN_BONUS(2).iron);
  for (let i = 0; i < C.BURN_SECONDS * C.TICK_RATE + 5; i++) { keep(); g.tick(); }
  assert.equal(g.enemies.length, 0, '낮에는 타서 사라짐');
});

test('설원: 모닥불에서 멀면 배가 더 빨리 고픔', () => {
  const near = mk(1, { map: 'SNOW' }), far = mk(1, { map: 'SNOW' });
  const a = near.addPlayer('a'), b = far.addPlayer('b');
  place(far, b, 20, 20);
  run(near, 400); run(far, 400);
  assert.ok(b.hunger < a.hunger, `${b.hunger} < ${a.hunger}`);
});

test('진흙 위에서는 느려진다', () => {
  const g = mk(1, { map: 'SWAMP' });
  const p = g.addPlayer('나');
  place(g, p, 20, 20);
  g.setInput(p.id, { mx: 1, my: 0 }); run(g, 10); const dNormal = p.x - 20.5;
  place(g, p, 30, 30); for (let x = 30; x < 40; x++) g.setTile(g.idx(x, 30), T.MUD);
  g.setInput(p.id, { mx: 1, my: 0 }); run(g, 10); const dMud = p.x - 30.5;
  assert.ok(dMud < dNormal * 0.7, `${dMud} vs ${dNormal}`);
});

test('적은 플레이어에게 다가와 공격하고, 기사는 피해를 20% 덜 받음. 혼자 죽으면 게임 오버', () => {
  const g = mk(); const p = g.addPlayer('나', 'KNIGHT'); place(g, p, 20, 20);
  g.phase = 'night';
  const e = g.spawnEnemy('RUNNER', 26.5, 20.5);
  run(g, C.TICK_RATE * 6);
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) < 1.5, '적이 도착해야 함');
  assert.ok(p.hp < p.maxHp);
  const before = p.hp; e.cd = 0; g.tick();
  assert.ok(Math.abs((before - p.hp) - C.ENEMIES.RUNNER.damage * 0.8) < 0.2, '방어 20%');
  p.hp = 1; run(g, C.TICK_RATE * 3);
  assert.equal(p.alive, false); assert.equal(g.over, true);
});

test('벽에 둘러싸이면 적은 벽을 공격하고, 파괴자는 4배로 부순다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  for (let y = 19; y <= 21; y++) for (let x = 19; x <= 21; x++) if (x !== 20 || y !== 20) g.setTile(g.idx(x, y), T.STONE_WALL);
  g.phase = 'night';
  g.spawnEnemy('ZOMBIE', 23.5, 20.5);
  run(g, C.TICK_RATE * 5);
  assert.equal(p.hp, p.maxHp, '벽 안의 플레이어는 무사');
  const hps = () => [...Array(9).keys()].map((k) => g.idx(19 + (k % 3), 19 + Math.floor(k / 3))).filter((i) => g.tiles[i] === T.STONE_WALL).map((i) => g.tileHp[i]);
  assert.ok(hps().some((h) => h < C.BUILDINGS.STONE_WALL.hp), '벽이 피해를 입어야 함');
  // 파괴자: 완전히 포위된 기지의 벽을 4배로 부순다 (벽 한 칸이면 돌아가는 게 정상)
  const g2 = mk(); const q = g2.addPlayer('나'); place(g2, q, 20, 20, 8);
  for (let y = 19; y <= 21; y++) for (let x = 19; x <= 21; x++) if (x !== 20 || y !== 20) g2.setTile(g2.idx(x, y), T.STONE_WALL);
  g2.phase = 'night';
  const br = g2.spawnEnemy('BREAKER', 22.5, 20.5);
  br.cd = 0; run(g2, 3);
  const dmg = [...Array(9).keys()].map((k) => g2.idx(19 + (k % 3), 19 + Math.floor(k / 3))).filter((i) => g2.tiles[i] === T.STONE_WALL).map((i) => C.BUILDINGS.STONE_WALL.hp - g2.tileHp[i]).filter((d) => d > 0);
  assert.deepEqual(dmg, [C.ENEMIES.BREAKER.damage * 4]);
});

test('적은 긴 벽을 돌아간다 (경로탐색)', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 10);
  for (let y = 16; y <= 25; y++) g.setTile(g.idx(23, y), T.STONE_WALL);
  g.phase = 'night';
  const e = g.spawnEnemy('RUNNER', 27.5, 20.5);
  let minY = 99;
  for (let i = 0; i < C.TICK_RATE * 8; i++) { g.tick(); minY = Math.min(minY, e.y); p.hp = 100; }
  assert.ok(minY < 16, '벽 위쪽 틈으로 돌아가야 함 (minY=' + minY + ')');
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) < 1.5, '돌아서 도착해야 함');
});

test('박쥐는 벽을 무시하고 날아와 공격한다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  for (let y = 18; y <= 22; y++) for (let x = 18; x <= 22; x++) if (x !== 20 || y !== 20) g.setTile(g.idx(x, y), T.IRON_WALL);
  g.phase = 'night';
  const bat = g.spawnEnemy('BAT', 26.5, 20.5);
  run(g, C.TICK_RATE * 4);
  assert.ok(Math.hypot(bat.x - p.x, bat.y - p.y) < 1.2, '벽 너머로 도착');
  assert.ok(p.hp < p.maxHp, '피해');
});

test('스피터는 벽 너머에서 침을 뱉어 맞힌다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  for (let y = 18; y <= 22; y++) g.setTile(g.idx(22, y), T.IRON_WALL);
  g.phase = 'night';
  const sp = g.spawnEnemy('SPITTER', 24.5, 20.5);
  run(g, C.TICK_RATE * 3);
  assert.ok(g.projs.length > 0 || p.hp < p.maxHp, '침 발사');
  run(g, C.TICK_RATE * 3);
  assert.ok(p.hp < p.maxHp, '벽 너머 피해');
  assert.ok(sp.x > 22, '스피터는 벽 밖에 머묾');
});

test('사냥꾼은 화살로 멀리서 적을 잡는다', () => {
  const g = mk(); const p = g.addPlayer('나', 'HUNTER'); place(g, p, 20, 20, 8);
  g.phase = 'night';
  const z = g.spawnEnemy('ZOMBIE', 23.5, 20.5); z.hp = z.maxHp = 9;
  p.dx = 1; p.dy = 0;
  g.setInput(p.id, { mx: 0, my: 0, action: true });
  g.tick();
  assert.equal(g.projs.length, 1, '화살 생성');
  assert.equal(g.projs[0].k, 'arrow');
  run(g, 15);
  assert.ok(z.hp <= 0, '화살에 맞아 죽음');
  assert.equal(p.kills, 1);
});

test('도둑은 자원을 훔쳐 도망가고, 잡으면 되찾는다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  g.phase = 'night'; p.inv.wood = 20;
  const th = g.spawnEnemy('THIEF', 21.2, 20.5); th.cd = 0;
  g.tick();
  assert.equal(p.inv.wood, 17, '나무 3 도난');
  assert.ok(th.flee > 0 && th.loot && th.loot.n === 3);
  run(g, 20);
  assert.ok(Math.hypot(th.x - p.x, th.y - p.y) > 2, '도망침');
  g.damageEnemy(th, 999, p);
  assert.equal(p.inv.wood, 20, '되찾음');
});

test('폭탄병은 벽에 닿으면 폭발해 주변 건물에 큰 피해', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  for (let y = 19; y <= 21; y++) for (let x = 19; x <= 21; x++) if (x !== 20 || y !== 20) g.setTile(g.idx(x, y), x === 21 ? T.WOOD_WALL : T.STONE_WALL);
  g.phase = 'night';
  g.spawnEnemy('BOMBER', 22.5, 20.5);
  run(g, 10);
  assert.equal(g.enemies.length, 0, '폭탄병은 폭발해 사라짐');
  const walls = [[21, 19], [21, 20], [21, 21]].map(([x, y]) => g.tileAt(x, y));
  assert.ok(walls.some((t) => t === T.GROUND), '나무 벽이 폭발로 파괴됨 ' + walls);
  assert.ok(p.hp < p.maxHp, '근처 플레이어도 피해');
});

test('가시 함정은 밟은 적에게 피해를 주고 닳는다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  g.setTile(g.idx(22, 20), T.SPIKES);
  g.phase = 'night';
  const z = g.spawnEnemy('ZOMBIE', 22.5, 20.5); const hp0 = z.hp;
  // 플레이어 쪽으로 못 가게 붙잡아둠: 흐름장 없이도 함정 판정은 위치 기준
  for (let i = 0; i < C.BUILDINGS.SPIKES.every + 1; i++) { z.x = 22.5; z.y = 20.5; g.tick(); }
  assert.ok(z.hp <= hp0 - C.BUILDINGS.SPIKES.damage);
  assert.ok(g.tileHp[g.idx(22, 20)] < C.BUILDINGS.SPIKES.hp);
});

test('포탑과 중포탑은 사거리 안의 적을 쏜다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 10);
  g.setTile(g.idx(24, 24), T.TURRET); g.setTile(g.idx(16, 16), T.HEAVY_TURRET);
  g.phase = 'night';
  const a = g.spawnEnemy('ZOMBIE', 26.5, 24.5), b = g.spawnEnemy('BRUTE', 11.5, 16.5);
  run(g, 3);
  assert.ok(a.hp < a.maxHp && b.hp === b.maxHp - C.BUILDINGS.HEAVY_TURRET.damage);
  const d = g.delta(); assert.ok(d.shots.some((s) => s.heavy) && d.shots.some((s) => !s.heavy));
});

test('괴수는 좀비를 소환한다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 10);
  g.phase = 'night';
  g.spawnEnemy('BOSS', 28.5, 20.5);
  const n0 = g.enemies.length;
  for (let i = 0; i < C.ENEMIES.BOSS.summon.every + 2; i++) { p.hp = 100; g.tick(); }
  assert.ok(g.enemies.length >= n0 + C.ENEMIES.BOSS.summon.n);
});

test('협동: 죽은 플레이어는 아침에 부활', () => {
  const g = mk(); const a = g.addPlayer('A'), b = g.addPlayer('B', 'COOK');
  a.hp = 0; g.tick();
  assert.equal(a.alive, false); assert.equal(g.over, false);
  g.phase = 'night'; g.cycleT = g.nightTicks - 1; g.tick();
  assert.equal(a.alive, true); assert.ok(a.hp >= C.PLAYER.respawnHp && a.hp < C.PLAYER.respawnHp + 1);
  void b;
});

test('직렬화: 전체 상태와 델타가 JSON으로 왕복되고 전장·캐릭터 정보를 담는다', () => {
  const g = mk(1, { map: 'VOLCANO', difficulty: 'HARD' });
  const p = g.addPlayer('나', 'HUNTER');
  const full = JSON.parse(JSON.stringify(g.fullState()));
  assert.equal(full.tiles.length, g.w * g.h);
  assert.equal(full.map, 'VOLCANO'); assert.equal(full.difficulty, 'HARD'); assert.equal(full.winDay, 12);
  assert.equal(full.players[0].cls, 'HUNTER');
  place(g, p, 20, 20);
  g.build(p.id, 'WOOD_WALL', 22, 22);
  const d = JSON.parse(JSON.stringify(g.delta()));
  assert.ok(d.tiles.length >= 1 && d.events.some((e) => e.type === 'build'));
  assert.equal(g.delta().tiles.length, 0);
});

test('플레이어는 나무·벽·용암을 통과하지 못하지만 문은 통과한다', () => {
  const g = mk(); const p = g.addPlayer('나'); place(g, p, 20, 20, 8);
  g.setTile(g.idx(21, 20), T.WOOD_WALL);
  g.setInput(p.id, { mx: 1, my: 0 }); run(g, 20);
  assert.ok(p.x < 21, '벽에 막혀야 함');
  g.setTile(g.idx(21, 20), T.DOOR); run(g, 20);
  assert.ok(p.x > 21.5, '문은 지나가야 함');
  assert.ok(solidForPlayer(T.LAVA) && solidForPlayer(T.WATER_EMPTY) && !solidForPlayer(T.MUD));
});

test('안정성: 전장 5종 × 2인이 목표 날짜까지 완주하면 승리 (예외 없음)', () => {
  for (const [map, difficulty] of [['MEADOW', 'NORMAL'], ['SNOW', 'EASY'], ['DESERT', 'HARD'], ['SWAMP', 'NORMAL'], ['VOLCANO', 'NIGHTMARE']]) {
    const g = mk(3, { map, difficulty });
    const a = g.addPlayer('A', 'KNIGHT'), b = g.addPlayer('B', 'HUNTER');
    const seen = new Set(); let maxEnemies = 0, guard = 0;
    while (!g.over && guard++ < (g.dayTicks + g.nightTicks) * g.winDay + 100) {
      for (const p of [a, b]) { p.hp = p.maxHp; p.hunger = 100; p.inv.wood = Math.max(p.inv.wood, 5); g.setInput(p.id, { mx: 0, my: 0, action: true }); }
      g.tick();
      if (g.t % 200 === 0) JSON.stringify(g.delta());
      for (const e of g.enemies) seen.add(e.kind);
      maxEnemies = Math.max(maxEnemies, g.enemies.length);
    }
    assert.equal(g.won, true, `${map}/${difficulty} 승리 (day=${g.day})`);
    assert.ok(seen.has('BOSS'), map + ' 보스');
    assert.ok(seen.size >= 6, `${map} 적 종류 ${[...seen].join(',')}`);
    assert.ok(maxEnemies > 10, map + ' 적 수 ' + maxEnemies);
  }
});
