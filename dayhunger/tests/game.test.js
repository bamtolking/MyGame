import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, solidForPlayer } from '../shared/game.js';
import * as C from '../shared/constants.js';
const { T } = C;

const mk = (seed = 7) => new Game({ seed });
const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(); };

test('월드 생성: 테두리는 풀밭, 중앙엔 모닥불, 출현 지점 존재', () => {
  const g = mk();
  for (let x = 0; x < g.w; x++) { assert.equal(g.tileAt(x, 0), T.GRASS); assert.equal(g.tileAt(x, g.h - 1), T.GRASS); }
  for (let y = 0; y < g.h; y++) { assert.equal(g.tileAt(0, y), T.GRASS); assert.equal(g.tileAt(g.w - 1, y), T.GRASS); }
  assert.equal(g.tileAt(g.center.x, g.center.y), T.CAMPFIRE);
  assert.ok(g.spawnTiles.length > 20);
  assert.ok(g.tiles.filter((t) => t === T.TREE).length > 100);
});

test('같은 시드는 같은 월드', () => {
  const a = mk(42), b = mk(42);
  assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
});

test('채집: 나무를 3번 때리면 나무 4 획득, 그루터기가 남음', () => {
  const g = mk();
  const p = g.addPlayer('나');
  // 플레이어 바로 오른쪽에 나무를 심고 바라보게 함
  const tx = Math.floor(p.x) + 1, ty = Math.floor(p.y);
  g.setTile(g.idx(tx, ty), T.TREE);
  p.dx = 1; p.dy = 0;
  const wood0 = p.inv.wood;
  g.setInput(p.id, { mx: 0, my: 0, action: true });
  run(g, C.PLAYER.actionCooldown * 3 + 2);
  assert.equal(p.inv.wood, wood0 + 4);
  assert.equal(g.tileAt(tx, ty), T.STUMP);
  // 재성장
  run(g, C.REGROW[T.STUMP].ticks + 2);
  assert.equal(g.tileAt(tx, ty), T.TREE);
});

test('건설: 비용 차감, 범위 밖·막힌 타일·자원 부족은 거부', () => {
  const g = mk();
  const p = g.addPlayer('나');
  const px = Math.floor(p.x), py = Math.floor(p.y);
  let target = null;
  for (let dy = -2; dy <= 2 && !target; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (g.tileAt(px + dx, py + dy) === T.GRASS && !g.tileOccupied(px + dx, py + dy)) { target = [px + dx, py + dy]; break; }
  }
  assert.ok(target);
  const wood0 = p.inv.wood;
  assert.equal(g.build(p.id, 'WOOD_WALL', ...target).ok, true);
  assert.equal(p.inv.wood, wood0 - C.BUILDINGS.WOOD_WALL.cost.wood);
  assert.equal(g.tileAt(...target), T.WOOD_WALL);
  assert.equal(g.tileHp[g.idx(...target)], C.BUILDINGS.WOOD_WALL.hp);
  assert.equal(g.build(p.id, 'WOOD_WALL', ...target).ok, false);        // 이미 건물
  assert.equal(g.build(p.id, 'WOOD_WALL', px + 10, py).ok, false);      // 너무 멀다
  assert.equal(g.build(p.id, 'WOOD_WALL', 0, 0).ok, false);             // 가장자리
  p.inv.stone = 0;
  assert.equal(g.build(p.id, 'STONE_WALL', target[0], target[1] + 1).ok, false); // 자원 부족
  // 철거 환불
  const w1 = p.inv.wood;
  assert.equal(g.dismantle(p.id, ...target).ok, true);
  assert.equal(p.inv.wood, w1 + 1);
  assert.equal(g.tileAt(...target), T.GRASS);
});

test('먹기: 배고픔 회복, 모닥불 근처면 더 회복', () => {
  const g = mk();
  const p = g.addPlayer('나');
  p.hunger = 10; p.inv.food = 2;
  assert.equal(g.eat(p.id).ok, true);
  assert.equal(p.hunger, 10 + C.PLAYER.campfireFoodValue); // 시작 위치는 모닥불 옆
  p.x = 3.5; p.y = 3.5; p.hunger = 10;
  g.eat(p.id);
  assert.equal(p.hunger, 10 + C.PLAYER.foodValue);
  assert.equal(g.eat(p.id).ok, false); // 식량 없음
});

test('낮밤 주기: 밤이 되면 적이 출현하고, 아침에 보급과 승리 판정', () => {
  const g = mk();
  const p = g.addPlayer('나');
  p.x = g.center.x + 0.5; p.y = g.center.y + 1.5;
  run(g, C.DAY_TICKS);
  assert.equal(g.phase, 'night');
  assert.ok(g.spawnQueue.length > 0);
  run(g, C.TICK_RATE * 10);
  assert.ok(g.enemies.length > 0, '적이 나와야 함');
  // 죽지 않도록 무적 처리하고 아침까지 진행
  const hp = p.hp;
  const keepAlive = () => { p.hp = 100; p.hunger = 100; };
  for (let i = 0; i < C.NIGHT_TICKS; i++) { keepAlive(); g.tick(); }
  assert.equal(g.phase, 'day');
  assert.equal(g.day, 2);
  assert.ok(p.inv.wood >= C.PLAYER.startInv.wood + C.DAWN_BONUS(2).wood);
  // 낮에는 남은 적이 타서 사라짐
  for (let i = 0; i < C.BURN_SECONDS * C.TICK_RATE + 5; i++) { keepAlive(); g.tick(); }
  assert.equal(g.enemies.length, 0);
  void hp;
});

test('적은 플레이어에게 다가와 공격하고, 혼자일 때 죽으면 게임 오버', () => {
  const g = mk();
  const p = g.addPlayer('나');
  g.phase = 'night';
  const e = g.spawnEnemy('RUNNER', p.x + 6, p.y);
  run(g, C.TICK_RATE * 6);
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) < 1.5, '적이 도착해야 함');
  assert.ok(p.hp < C.PLAYER.hp, '피해를 입어야 함');
  p.hp = 1;
  run(g, C.TICK_RATE * 3);
  assert.equal(p.alive, false);
  assert.equal(g.over, true);
  assert.equal(g.won, false);
});

test('벽에 둘러싸이면 적은 벽을 공격하고, 벽 체력이 줄어든다', () => {
  const g = mk();
  const p = g.addPlayer('나');
  // 플레이어를 넓은 풀밭으로 옮기고 3x3 벽으로 둘러쌈
  const cx = 10, cy = 10;
  for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) g.setTile(g.idx(x, y), T.GRASS);
  p.x = cx + 0.5; p.y = cy + 0.5;
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x !== cx || y !== cy) g.setTile(g.idx(x, y), T.STONE_WALL);
  g.phase = 'night';
  const e = g.spawnEnemy('ZOMBIE', cx + 3.5, cy + 0.5);
  run(g, C.TICK_RATE * 5);
  assert.equal(p.hp, C.PLAYER.hp, '벽 안의 플레이어는 무사해야 함');
  const wallHps = [];
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x !== cx || y !== cy) wallHps.push(g.tileHp[g.idx(x, y)]);
  assert.ok(wallHps.some((h) => h < C.BUILDINGS.STONE_WALL.hp), '어떤 벽이든 피해를 입어야 함');
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) < 2.5);
  // 수리
  const dmgIdx = [...Array(9).keys()].map((k) => g.idx(cx - 1 + (k % 3), cy - 1 + Math.floor(k / 3))).find((i) => g.tiles[i] === T.STONE_WALL && g.tileHp[i] < C.BUILDINGS.STONE_WALL.hp);
  const before = g.tileHp[dmgIdx];
  assert.equal(g.repair(p.id, dmgIdx % g.w, Math.floor(dmgIdx / g.w)).ok, true);
  assert.ok(g.tileHp[dmgIdx] > before);
});

test('적은 긴 벽을 돌아간다 (경로탐색)', () => {
  const g = mk();
  const p = g.addPlayer('나');
  for (let y = 4; y <= 16; y++) for (let x = 4; x <= 20; x++) g.setTile(g.idx(x, y), T.GRASS);
  p.x = 8.5; p.y = 10.5;
  // 플레이어 오른쪽에 세로로 긴 돌벽 (틈은 위쪽 y=5)
  for (let y = 6; y <= 15; y++) g.setTile(g.idx(11, y), T.STONE_WALL);
  g.phase = 'night';
  const e = g.spawnEnemy('RUNNER', 15.5, 10.5);
  let minY = 99;
  for (let i = 0; i < C.TICK_RATE * 8; i++) { g.tick(); minY = Math.min(minY, e.y); p.hp = 100; }
  assert.ok(minY < 6, '적이 벽 위쪽 틈으로 돌아가야 함 (minY=' + minY + ')');
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) < 1.5, '돌아서 도착해야 함');
});

test('포탑은 사거리 안의 적을 쏜다', () => {
  const g = mk();
  const p = g.addPlayer('나');
  for (let y = 4; y <= 16; y++) for (let x = 4; x <= 16; x++) g.setTile(g.idx(x, y), T.GRASS);
  p.x = 6.5; p.y = 6.5;
  g.setTile(g.idx(10, 10), T.TURRET);
  g.phase = 'night';
  const e = g.spawnEnemy('ZOMBIE', 12.5, 10.5);
  const hp0 = e.hp;
  run(g, 5);
  assert.ok(e.hp < hp0);
  const d = g.delta();
  assert.ok(d.shots.length > 0);
});

test('협동: 죽은 플레이어는 아침에 부활', () => {
  const g = mk();
  const a = g.addPlayer('A'), b = g.addPlayer('B');
  a.hp = 0; g.tick();
  assert.equal(a.alive, false);
  assert.equal(g.over, false, '동료가 살아있으면 계속');
  g.phase = 'night'; g.cycleT = C.NIGHT_TICKS - 1;
  g.tick();
  assert.equal(a.alive, true);
  assert.ok(a.hp >= C.PLAYER.respawnHp && a.hp < C.PLAYER.respawnHp + 1);
  void b;
});

test('직렬화: 전체 상태와 델타가 JSON으로 왕복된다', () => {
  const g = mk();
  const p = g.addPlayer('나');
  const full = JSON.parse(JSON.stringify(g.fullState()));
  assert.equal(full.tiles.length, g.w * g.h);
  assert.equal(full.players[0].name, '나');
  g.build(p.id, 'WOOD_WALL', Math.floor(p.x) + 2, Math.floor(p.y) + 2);
  const d = JSON.parse(JSON.stringify(g.delta()));
  assert.ok(d.tiles.length >= 1);
  assert.ok(d.events.some((e) => e.type === 'build'));
  assert.equal(g.delta().tiles.length, 0, '델타는 비워져야 함');
});

test('플레이어는 나무·벽을 통과하지 못하지만 문은 통과한다', () => {
  const g = mk();
  const p = g.addPlayer('나');
  for (let y = 4; y <= 16; y++) for (let x = 4; x <= 16; x++) g.setTile(g.idx(x, y), T.GRASS);
  p.x = 8.5; p.y = 8.5;
  g.setTile(g.idx(9, 8), T.WOOD_WALL);
  g.setInput(p.id, { mx: 1, my: 0 });
  run(g, 20);
  assert.ok(p.x < 9, '벽에 막혀야 함');
  g.setTile(g.idx(9, 8), T.DOOR);
  run(g, 20);
  assert.ok(p.x > 9.5, '문은 지나가야 함');
  assert.equal(solidForPlayer(T.DOOR), false);
});

test('안정성: 2인이 10일을 완주하면 승리 (보스·브루트·부활 포함, 예외 없음)', () => {
  const g = mk(3);
  const a = g.addPlayer('A'), b = g.addPlayer('B');
  let bossSeen = false, bruteSeen = false, maxEnemies = 0;
  let guard = 0;
  while (!g.over && guard++ < (C.DAY_TICKS + C.NIGHT_TICKS) * C.WIN_DAY + 100) {
    // 간단한 봇: 밤엔 모닥불 옆에서 계속 휘두르고, 낮엔 아무거나 캔다. 체력은 넉넉히 유지
    for (const p of [a, b]) { if (p.hp < 30) p.hp = 100; if (p.hunger < 20) p.hunger = 100; g.setInput(p.id, { mx: 0, my: 0, action: true }); }
    g.tick();
    if (g.t % 200 === 0) g.delta(); // 직렬화도 주기적으로 실행
    for (const e of g.enemies) { if (e.kind === 'BOSS') bossSeen = true; if (e.kind === 'BRUTE') bruteSeen = true; }
    maxEnemies = Math.max(maxEnemies, g.enemies.length);
  }
  assert.equal(g.won, true, '10일째 아침에 승리해야 함 (day=' + g.day + ')');
  assert.equal(g.day, C.WIN_DAY);
  assert.ok(bossSeen, '보스가 등장해야 함');
  assert.ok(bruteSeen, '브루트가 등장해야 함');
  assert.ok(maxEnemies > 10, '적이 충분히 몰려와야 함 (' + maxEnemies + ')');
  g.continueEndless();
  assert.equal(g.over, false);
  run(g, 50);
  assert.equal(g.endless, true);
});
