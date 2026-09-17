// 데이헝거 핵심 시뮬레이션. DOM/네트워크 의존 없음.
// 솔로 모드에서는 브라우저가, 협동 모드에서는 서버가 같은 코드를 돌립니다.
import * as C from './constants.js';
const { T } = C;

// ---------- 난수 ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 최소 힙 (다익스트라용) ----------
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v;
    const topK = k[0], topV = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return [topK, topV];
  }
}

// ---------- 타일 분류 ----------
const NATURAL_SOLID = new Set([T.TREE, T.ROCK, T.WATER, T.BUSH]);
const BUILDING_SOLID = new Set([T.WOOD_WALL, T.STONE_WALL, T.DOOR, T.TURRET, T.CAMPFIRE]);
const BUILDINGS_ALL = new Set([...BUILDING_SOLID, T.FARM, T.FARM_RIPE]);
const RESOURCE_TILES = new Set([T.TREE, T.ROCK, T.BUSH, T.FARM_RIPE]);
const BUILDABLE_BASE = new Set([T.GRASS, T.STUMP, T.BUSH_EMPTY]);

export const isBuilding = (t) => BUILDINGS_ALL.has(t);
export const isResource = (t) => RESOURCE_TILES.has(t);
export const solidForPlayer = (t) => NATURAL_SOLID.has(t) || (BUILDING_SOLID.has(t) && t !== T.DOOR);
export const solidForEnemy = (t) => NATURAL_SOLID.has(t) || BUILDING_SOLID.has(t);

const round2 = (n) => Math.round(n * 100) / 100;

export class Game {
  constructor({ seed = (Math.random() * 2 ** 31) | 0, w = C.MAP_W, h = C.MAP_H } = {}) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.tileHp = new Uint16Array(w * h);
    this.tileTimers = new Map();   // 타일 인덱스 -> 남은 틱 (타입별 의미: 재성장/성장/포탑 재장전)
    this.players = new Map();
    this.enemies = [];
    this.shots = [];      // 이번 델타에 포함될 포탑 사격선
    this.fx = [];         // 이번 델타에 포함될 효과
    this.events = [];     // 이번 델타에 포함될 이벤트
    this.dirty = new Set();
    this.t = 0;
    this.day = 1;
    this.phase = 'day';
    this.cycleT = 0;
    this.over = false;
    this.won = false;
    this.endless = false;
    this.score = 0;
    this.kills = 0;
    this.nextId = 1;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0;
    this.flow = new Float32Array(w * h).fill(Infinity);
    this.flowAge = 999;
    this.spawnTiles = [];
    this.center = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    this.generate();
  }

  // ---------- 좌표 유틸 ----------
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : T.WATER; }
  maxHpOf(tile) { const b = C.BUILDING_BY_TILE[tile]; return b ? b.hp : 0; }

  setTile(i, tile, hp) {
    this.tiles[i] = tile;
    if (hp === undefined) {
      if (C.RESOURCES[tile]) hp = C.RESOURCES[tile].hits;
      else if (C.BUILDING_BY_TILE[tile]) hp = C.BUILDING_BY_TILE[tile].hp;
      else hp = 0;
    }
    this.tileHp[i] = hp;
    this.tileTimers.delete(i);
    if (C.REGROW[tile]) this.tileTimers.set(i, C.REGROW[tile].ticks);
    else if (tile === T.FARM) this.tileTimers.set(i, C.FARM_GROW_TICKS);
    else if (tile === T.TURRET || tile === T.CAMPFIRE) this.tileTimers.set(i, 0);
    this.dirty.add(i);
    this.flowAge = 999; // 지형이 바뀌면 경로 다시 계산
  }
  markDirty(i) { this.dirty.add(i); }

  // ---------- 월드 생성 ----------
  generate() {
    const { w, h, rng } = this;
    const cx = this.center.x, cy = this.center.y;
    const distC = (x, y) => Math.hypot(x - cx, y - cy);
    const inner = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1; // 바깥 테두리 한 줄은 항상 풀밭(적 출현 지역)
    this.tiles.fill(T.GRASS);
    const put = (x, y, tile) => {
      if (!inner(x, y) || distC(x, y) < 4.5) return;
      if (this.tiles[this.idx(x, y)] !== T.GRASS) return;
      this.setTile(this.idx(x, y), tile);
    };
    // 연못
    for (let n = 0; n < 6; n++) {
      const px = 3 + Math.floor(rng() * (w - 6)), py = 3 + Math.floor(rng() * (h - 6));
      if (distC(px, py) < 9) continue;
      const r = 1.5 + rng() * 2;
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) <= r) put(px + x, py + y, T.WATER);
    }
    // 나무 군락
    for (let n = 0; n < 70; n++) {
      const px = 2 + Math.floor(rng() * (w - 4)), py = 2 + Math.floor(rng() * (h - 4));
      const cnt = 3 + Math.floor(rng() * 7);
      for (let k = 0; k < cnt; k++) {
        const a = rng() * Math.PI * 2, d = rng() * 3;
        put(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d), T.TREE);
      }
    }
    // 바위 군락
    for (let n = 0; n < 30; n++) {
      const px = 2 + Math.floor(rng() * (w - 4)), py = 2 + Math.floor(rng() * (h - 4));
      const cnt = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < cnt; k++) {
        const a = rng() * Math.PI * 2, d = rng() * 2;
        put(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d), T.ROCK);
      }
    }
    // 덤불
    for (let n = 0; n < 50; n++) put(2 + Math.floor(rng() * (w - 4)), 2 + Math.floor(rng() * (h - 4)), T.BUSH);
    // 기지 근처 보장 자원: 나무 8, 덤불 4, 바위 3 (반지름 5.5~8)
    const ring = (tile, cnt, r0, r1) => {
      let placed = 0, tries = 0;
      while (placed < cnt && tries++ < 200) {
        const a = rng() * Math.PI * 2, d = r0 + rng() * (r1 - r0);
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (this.tiles[this.idx(x, y)] === T.GRASS) { this.setTile(this.idx(x, y), tile); placed++; }
      }
    };
    ring(T.TREE, 8, 5.5, 8); ring(T.BUSH, 4, 5.5, 8); ring(T.ROCK, 3, 5.5, 8);
    // 기지 중앙 모닥불
    this.setTile(this.idx(cx, cy), T.CAMPFIRE);
    // 연결성: 중앙에서 적이 지나갈 수 있는 타일로 BFS → 도달 가능한 테두리 타일이 출현 지점
    this.computeSpawnTiles();
    if (this.spawnTiles.length < 8) {
      // 자연 지형이 기지를 완전히 감싼 드문 경우: 오른쪽으로 길을 뚫음
      for (let x = cx; x < w; x++) { const i = this.idx(x, cy); if (NATURAL_SOLID.has(this.tiles[i])) this.setTile(i, T.GRASS); }
      this.computeSpawnTiles();
    }
    this.dirty.clear();
  }

  computeSpawnTiles() {
    const { w, h } = this;
    const seen = new Uint8Array(w * h);
    const q = [this.idx(this.center.x, this.center.y)];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop();
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (seen[ni] || NATURAL_SOLID.has(this.tiles[ni])) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    this.spawnTiles = [];
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && seen[i] && this.tiles[i] === T.GRASS) this.spawnTiles.push(i);
    }
  }

  // ---------- 플레이어 ----------
  addPlayer(name = '생존자') {
    const id = this.nextId++;
    const color = C.PLAYER_COLORS[(this.players.size) % C.PLAYER_COLORS.length];
    const spot = this.findSpawnSpot();
    const p = {
      id, name: String(name).slice(0, 10) || '생존자', color,
      x: spot.x, y: spot.y, dx: 0, dy: 1,
      hp: C.PLAYER.hp, hunger: C.PLAYER.hunger, alive: true,
      inv: { ...C.PLAYER.startInv }, kills: 0,
      input: { mx: 0, my: 0, action: false },
      actionCd: 0, hungerT: 0, say: '', sayT: 0, swing: 0, deaths: 0,
    };
    this.players.set(id, p);
    this.events.push({ type: 'join', name: p.name });
    return p;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.events.push({ type: 'leave', name: p.name });
  }
  findSpawnSpot() {
    const { x: cx, y: cy } = this.center;
    for (let r = 1; r < 6; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(ang) * r), y = Math.round(cy + Math.sin(ang) * r);
        if (!this.inBounds(x, y) || solidForPlayer(this.tiles[this.idx(x, y)])) continue;
        const px = x + 0.5, py = y + 0.5;
        let blocked = false;
        for (const q of this.players.values()) if (q.alive && Math.hypot(q.x - px, q.y - py) < 0.8) { blocked = true; break; }
        if (!blocked) return { x: px, y: py };
      }
    }
    return { x: cx + 0.5, y: cy + 1.5 };
  }
  setInput(id, input) {
    const p = this.players.get(id);
    if (!p) return;
    let mx = +input.mx || 0, my = +input.my || 0;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    p.input.mx = mx; p.input.my = my; p.input.action = !!input.action;
  }

  // ---------- 플레이어 행동 ----------
  canReach(p, tx, ty) {
    const px = Math.floor(p.x), py = Math.floor(p.y);
    return Math.max(Math.abs(px - tx), Math.abs(py - ty)) <= C.BUILD_RANGE;
  }
  hasCost(p, cost) { return Object.entries(cost).every(([k, v]) => (p.inv[k] || 0) >= v); }
  payCost(p, cost) { for (const [k, v] of Object.entries(cost)) p.inv[k] -= v; }
  tileOccupied(tx, ty) {
    const cx = tx + 0.5, cy = ty + 0.5;
    for (const q of this.players.values()) if (q.alive && Math.abs(q.x - cx) < 0.5 + C.PLAYER.radius && Math.abs(q.y - cy) < 0.5 + C.PLAYER.radius) return true;
    for (const e of this.enemies) if (Math.abs(e.x - cx) < 0.5 + e.radius && Math.abs(e.y - cy) < 0.5 + e.radius) return true;
    return false;
  }
  isBorder(tx, ty) { return tx === 0 || ty === 0 || tx === this.w - 1 || ty === this.h - 1; }

  build(id, key, tx, ty) {
    const p = this.players.get(id); const b = C.BUILDINGS[key];
    if (!p || !p.alive || !b || this.over) return { ok: false, reason: '불가' };
    tx |= 0; ty |= 0;
    if (!this.inBounds(tx, ty) || this.isBorder(tx, ty)) return { ok: false, reason: '가장자리에는 지을 수 없어요' };
    if (!this.canReach(p, tx, ty)) return { ok: false, reason: '너무 멀어요' };
    const i = this.idx(tx, ty);
    if (!BUILDABLE_BASE.has(this.tiles[i])) return { ok: false, reason: '여기엔 지을 수 없어요' };
    if (this.tileOccupied(tx, ty)) return { ok: false, reason: '누군가 서 있어요' };
    if (!this.hasCost(p, b.cost)) return { ok: false, reason: '자원이 부족해요' };
    this.payCost(p, b.cost);
    this.setTile(i, b.tile);
    this.events.push({ type: 'build', key, x: tx, y: ty, by: p.name });
    return { ok: true };
  }
  repair(id, tx, ty) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.over) return { ok: false, reason: '불가' };
    tx |= 0; ty |= 0;
    if (!this.inBounds(tx, ty) || !this.canReach(p, tx, ty)) return { ok: false, reason: '너무 멀어요' };
    const i = this.idx(tx, ty); const tile = this.tiles[i];
    if (!isBuilding(tile)) return { ok: false, reason: '건물이 아니에요' };
    const max = this.maxHpOf(tile);
    if (this.tileHp[i] >= max) return { ok: false, reason: '이미 멀쩡해요' };
    if (!this.hasCost(p, C.REPAIR_COST)) return { ok: false, reason: '나무가 부족해요' };
    this.payCost(p, C.REPAIR_COST);
    this.tileHp[i] = Math.min(max, this.tileHp[i] + C.REPAIR_AMOUNT);
    this.markDirty(i); this.flowAge = 999;
    this.fx.push({ x: tx + 0.5, y: ty + 0.5, k: 'repair' });
    return { ok: true };
  }
  dismantle(id, tx, ty) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.over) return { ok: false, reason: '불가' };
    tx |= 0; ty |= 0;
    if (!this.inBounds(tx, ty) || !this.canReach(p, tx, ty)) return { ok: false, reason: '너무 멀어요' };
    const i = this.idx(tx, ty); const tile = this.tiles[i];
    const b = C.BUILDING_BY_TILE[tile];
    if (!b) return { ok: false, reason: '건물이 아니에요' };
    for (const [k, v] of Object.entries(b.cost)) p.inv[k] = Math.min(C.PLAYER.maxInv, p.inv[k] + Math.floor(v * C.DISMANTLE_REFUND));
    this.setTile(i, T.GRASS);
    return { ok: true };
  }
  eat(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.over) return { ok: false, reason: '불가' };
    if (p.inv.food <= 0) return { ok: false, reason: '식량이 없어요' };
    if (p.hunger >= C.PLAYER.hunger) return { ok: false, reason: '배가 불러요' };
    p.inv.food--;
    const near = this.nearCampfire(p.x, p.y);
    p.hunger = Math.min(C.PLAYER.hunger, p.hunger + (near ? C.PLAYER.campfireFoodValue : C.PLAYER.foodValue));
    this.fx.push({ x: p.x, y: p.y, k: 'eat' });
    return { ok: true };
  }
  say(id, index) {
    const p = this.players.get(id);
    if (!p) return;
    const msg = C.QUICK_CHAT[index | 0];
    if (!msg) return;
    p.say = msg; p.sayT = C.CHAT_TICKS;
    this.events.push({ type: 'chat', name: p.name, msg });
  }
  continueEndless() { if (this.over && this.won) { this.over = false; this.endless = true; } }

  nearCampfire(x, y) {
    const r = C.BUILDINGS.CAMPFIRE.radius;
    for (const [i] of this.tileTimers) {
      if (this.tiles[i] !== T.CAMPFIRE) continue;
      const cx = (i % this.w) + 0.5, cy = ((i / this.w) | 0) + 0.5;
      if (Math.hypot(cx - x, cy - y) <= r) return true;
    }
    return false;
  }

  // ---------- 충돌 ----------
  moveEntity(e, radius, vx, vy, solidFn) {
    // 이미 겹쳐 있는 고체 타일(예: 서 있는 자리에 덤불이 다시 자란 경우)은 빠져나갈 수 있도록 무시
    const overlaps = (nx, ny) => {
      const out = [];
      const x0 = Math.floor(nx - radius), x1 = Math.floor(nx + radius - 1e-6);
      const y0 = Math.floor(ny - radius), y1 = Math.floor(ny + radius - 1e-6);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!this.inBounds(x, y) || solidFn(this.tiles[this.idx(x, y)])) out.push(this.inBounds(x, y) ? this.idx(x, y) : -1);
      }
      return out;
    };
    const stuck = overlaps(e.x, e.y);
    const tryAxis = (nx, ny) => overlaps(nx, ny).every((i) => stuck.includes(i));
    if (vx !== 0) {
      const nx = Math.min(this.w - radius, Math.max(radius, e.x + vx));
      if (tryAxis(nx, e.y)) e.x = nx;
    }
    if (vy !== 0) {
      const ny = Math.min(this.h - radius, Math.max(radius, e.y + vy));
      if (tryAxis(e.x, ny)) e.y = ny;
    }
  }

  // ---------- 틱 ----------
  tick() {
    if (this.over) return;
    this.t++;
    this.tickClock();
    for (const p of this.players.values()) this.tickPlayer(p);
    this.tickSpawns();
    if (this.enemies.length) {
      if (this.flowAge >= 10) this.computeFlow();
      this.flowAge++;
      for (const e of this.enemies) this.tickEnemy(e);
      this.separateEnemies();
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    }
    this.tickTiles();
    this.checkEnd();
  }

  tickClock() {
    this.cycleT++;
    if (this.phase === 'day' && this.cycleT >= C.DAY_TICKS) {
      this.phase = 'night'; this.cycleT = 0; this.startNight();
    } else if (this.phase === 'night' && this.cycleT >= C.NIGHT_TICKS) {
      this.phase = 'day'; this.cycleT = 0; this.day++; this.startDay();
    }
  }
  startNight() {
    const alive = [...this.players.values()].filter((p) => p.alive).length || 1;
    const count = C.WAVE_COUNT(this.day, alive);
    const pool = Object.entries(C.ENEMIES).filter(([, e]) => e.minDay <= this.day && e.weight > 0);
    const totalW = pool.reduce((s, [, e]) => s + e.weight, 0);
    this.spawnQueue = [];
    for (let n = 0; n < count; n++) {
      let r = this.rng() * totalW;
      for (const [key, e] of pool) { r -= e.weight; if (r <= 0) { this.spawnQueue.push(key); break; } }
    }
    if (C.BOSS_NIGHTS.has(this.day)) this.spawnQueue.splice(Math.floor(count / 2), 0, 'BOSS');
    this.spawnInterval = Math.max(4, Math.floor((C.NIGHT_TICKS * 0.6) / Math.max(1, this.spawnQueue.length)));
    this.spawnTimer = C.TICK_RATE * 2;
    this.events.push({ type: 'night', day: this.day, count: this.spawnQueue.length });
  }
  startDay() {
    const bonus = C.DAWN_BONUS(this.day);
    for (const p of this.players.values()) {
      if (!p.alive) {
        p.alive = true; p.hp = C.PLAYER.respawnHp; p.hunger = Math.max(p.hunger, 50);
        const s = this.findSpawnSpot(); p.x = s.x; p.y = s.y;
      }
      for (const [k, v] of Object.entries(bonus)) p.inv[k] = Math.min(C.PLAYER.maxInv, p.inv[k] + v);
    }
    this.score += 100;
    this.events.push({ type: 'dawn', day: this.day, bonus });
    if (!this.endless && this.day >= C.WIN_DAY) { this.over = true; this.won = true; this.events.push({ type: 'win' }); }
  }

  tickPlayer(p) {
    if (p.sayT > 0 && --p.sayT === 0) p.say = '';
    if (p.swing > 0) p.swing--;
    if (!p.alive) return;
    if (p.hp <= 0) { this.killPlayer(p); return; }
    // 배고픔
    p.hungerT += this.phase === 'night' ? C.PLAYER.nightHungerMul : 1;
    if (p.hungerT >= C.PLAYER.hungerDrainTicks) { p.hungerT -= C.PLAYER.hungerDrainTicks; p.hunger = Math.max(0, p.hunger - 1); }
    if (p.hunger <= 0) p.hp -= C.PLAYER.starveDamagePerSec / C.TICK_RATE;
    else if (p.hunger > 60 && p.hp < C.PLAYER.hp) p.hp = Math.min(C.PLAYER.hp, p.hp + 0.5 / C.TICK_RATE);
    if (this.nearCampfire(p.x, p.y) && p.hp < C.PLAYER.hp) p.hp = Math.min(C.PLAYER.hp, p.hp + C.PLAYER.campfireRegenPerSec / C.TICK_RATE);
    // 이동
    const { mx, my } = p.input;
    if (mx !== 0 || my !== 0) {
      const sp = C.PLAYER.speed / C.TICK_RATE;
      this.moveEntity(p, C.PLAYER.radius, mx * sp, my * sp, solidForPlayer);
      const len = Math.hypot(mx, my); p.dx = mx / len; p.dy = my / len;
    }
    // 행동
    if (p.actionCd > 0) p.actionCd--;
    if (p.input.action && p.actionCd <= 0) this.doAction(p);
    if (p.hp <= 0) this.killPlayer(p);
  }
  killPlayer(p) {
    p.alive = false; p.hp = 0; p.deaths++;
    p.input.mx = p.input.my = 0; p.input.action = false;
    this.fx.push({ x: p.x, y: p.y, k: 'death' });
    this.events.push({ type: 'death', name: p.name });
  }

  doAction(p) {
    p.actionCd = C.PLAYER.actionCooldown; p.swing = 6;
    // 1) 근처 적 공격
    let best = null, bestD = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
      if (d <= C.PLAYER.attackRange && d < bestD) { best = e; bestD = d; }
    }
    if (best) { this.damageEnemy(best, C.PLAYER.damage, p); return; }
    // 2) 자원 채집: 주변 9칸 중 바라보는 방향 우선
    const px = Math.floor(p.x), py = Math.floor(p.y);
    let bi = -1, bs = -Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = px + dx, y = py + dy;
      if (!this.inBounds(x, y)) continue;
      const i = this.idx(x, y);
      if (!isResource(this.tiles[i])) continue;
      const vx = x + 0.5 - p.x, vy = y + 0.5 - p.y;
      const d = Math.hypot(vx, vy);
      if (d > 1.6) continue;
      const score = (d > 0 ? (vx * p.dx + vy * p.dy) / d : 1) * 2 - d;
      if (score > bs) { bs = score; bi = i; }
    }
    if (bi < 0) return;
    this.hitResource(bi, p);
  }
  hitResource(i, p) {
    const tile = this.tiles[i];
    const r = C.RESOURCES[tile];
    if (!r) return;
    const x = (i % this.w) + 0.5, y = ((i / this.w) | 0) + 0.5;
    this.fx.push({ x, y, k: 'hit' });
    if (--this.tileHp[i] > 0) { this.markDirty(i); return; }
    for (const [k, v] of Object.entries(r.gives)) p.inv[k] = Math.min(C.PLAYER.maxInv, p.inv[k] + v);
    this.setTile(i, r.leaves);
    this.fx.push({ x, y, k: 'gain', res: Object.keys(r.gives)[0], n: Object.values(r.gives)[0] });
  }

  damageEnemy(e, dmg, by) {
    e.hp -= dmg;
    e.hitT = 4;
    this.fx.push({ x: e.x, y: e.y, k: 'blood' });
    if (e.hp <= 0) {
      const def = C.ENEMIES[e.kind];
      this.kills++; this.score += def.score;
      if (by) by.kills++;
      this.events.push({ type: 'kill', kind: e.kind, by: by ? by.name : null });
    }
  }
  damageTile(i, dmg) {
    if (!isBuilding(this.tiles[i])) return;
    const x = (i % this.w) + 0.5, y = ((i / this.w) | 0) + 0.5;
    this.fx.push({ x, y, k: 'crack' });
    if (this.tileHp[i] > dmg) { this.tileHp[i] -= dmg; this.markDirty(i); this.flowAge = 999; return; }
    const tile = this.tiles[i];
    this.setTile(i, T.GRASS);
    this.events.push({ type: 'destroyed', tile, x: x - 0.5, y: y - 0.5 });
  }

  // ---------- 적 ----------
  tickSpawns() {
    if (!this.spawnQueue.length || !this.spawnTiles.length) return;
    if (--this.spawnTimer > 0) return;
    this.spawnTimer = this.spawnInterval;
    const kind = this.spawnQueue.shift();
    let i = this.spawnTiles[Math.floor(this.rng() * this.spawnTiles.length)];
    // 플레이어와 너무 가까운 지점은 두 번까지 다시 뽑기
    for (let k = 0; k < 2; k++) {
      const x = (i % this.w) + 0.5, y = ((i / this.w) | 0) + 0.5;
      let close = false;
      for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - x, p.y - y) < 7) { close = true; break; }
      if (!close) break;
      i = this.spawnTiles[Math.floor(this.rng() * this.spawnTiles.length)];
    }
    this.spawnEnemy(kind, (i % this.w) + 0.5, ((i / this.w) | 0) + 0.5);
  }
  spawnEnemy(kind, x, y) {
    const def = C.ENEMIES[kind];
    const scale = kind === 'BOSS' ? 1 : C.ENEMY_HP_SCALE(this.day);
    const e = { id: this.nextId++, kind, x, y, hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale), radius: def.radius, cd: 0, hitT: 0, wander: 0 };
    this.enemies.push(e);
    return e;
  }

  computeFlow() {
    const { w, h, tiles, tileHp, flow } = this;
    flow.fill(Infinity);
    const heap = new MinHeap();
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const i = this.idx(Math.floor(p.x), Math.floor(p.y));
      if (flow[i] > 0) { flow[i] = 0; heap.push(0, i); }
    }
    const cost = (i) => {
      const t = tiles[i];
      if (NATURAL_SOLID.has(t)) return Infinity;
      if (BUILDING_SOLID.has(t)) return 1 + tileHp[i] / 12;
      return 1;
    };
    while (heap.size) {
      const [d, i] = heap.pop();
      if (d > flow[i]) continue;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) relax(i - 1, d); if (x < w - 1) relax(i + 1, d);
      if (y > 0) relax(i - w, d); if (y < h - 1) relax(i + w, d);
    }
    function relax(j, d) {
      const c = cost(j);
      if (c === Infinity) return;
      const nd = d + c;
      if (nd < flow[j]) { flow[j] = nd; heap.push(nd, j); }
    }
    this.flowAge = 0;
  }

  tickEnemy(e) {
    const def = C.ENEMIES[e.kind];
    if (e.cd > 0) e.cd--;
    if (e.hitT > 0) e.hitT--;
    if (this.phase === 'day') e.hp -= e.maxHp / (C.BURN_SECONDS * C.TICK_RATE); // 햇빛에 타서 사라짐
    if (e.hp <= 0) return;
    // 사거리 안의 플레이어 공격
    let target = null, td = Infinity;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < td) { td = d; target = p; }
    }
    if (target && td <= e.radius + C.PLAYER.radius + 0.35) {
      if (e.cd <= 0) { e.cd = def.cooldown; target.hp -= def.damage; this.fx.push({ x: target.x, y: target.y, k: 'hurt' }); }
      return;
    }
    // 흐름장을 따라 이동
    const { w, tiles, flow } = this;
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    const ti = this.idx(tx, ty);
    let best = -1, bestD = flow[ti];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy;
      if (!this.inBounds(nx, ny)) continue;
      const ni = this.idx(nx, ny);
      if (dx && dy) { // 대각선은 양옆이 모두 뚫려 있을 때만
        if (solidForEnemy(tiles[this.idx(tx + dx, ty)]) || solidForEnemy(tiles[this.idx(tx, ty + dy)])) continue;
      }
      if (flow[ni] < bestD) { bestD = flow[ni]; best = ni; }
    }
    const sp = def.speed / C.TICK_RATE;
    if (best < 0) {
      // 갈 곳이 없으면 잠시 배회
      if (--e.wander <= 0) { e.wander = 20 + Math.floor(this.rng() * 20); e.wx = this.rng() * 2 - 1; e.wy = this.rng() * 2 - 1; }
      this.moveEntity(e, e.radius, (e.wx || 0) * sp * 0.5, (e.wy || 0) * sp * 0.5, solidForEnemy);
      return;
    }
    const cx = (best % w) + 0.5, cy = ((best / w) | 0) + 0.5;
    const vx = cx - e.x, vy = cy - e.y;
    const dist = Math.hypot(vx, vy) || 1;
    if (BUILDING_SOLID.has(tiles[best])) {
      // 길을 막는 건물: 붙을 때까지 다가가서 공격
      if (dist <= 0.5 + e.radius + 0.15) {
        if (e.cd <= 0) { e.cd = def.cooldown; this.damageTile(best, def.damage); }
        return;
      }
    }
    this.moveEntity(e, e.radius, (vx / dist) * sp, (vy / dist) * sp, solidForEnemy);
  }
  separateEnemies() {
    const es = this.enemies;
    for (let a = 0; a < es.length; a++) for (let b = a + 1; b < es.length; b++) {
      const A = es[a], B = es[b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy), min = A.radius + B.radius;
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2, ux = dx / d, uy = dy / d;
      this.moveEntity(A, A.radius, -ux * push, -uy * push, solidForEnemy);
      this.moveEntity(B, B.radius, ux * push, uy * push, solidForEnemy);
    }
  }

  // ---------- 타일(포탑·밭·재성장) ----------
  tickTiles() {
    const { w, tiles } = this;
    for (const [i, t] of this.tileTimers) {
      const tile = tiles[i];
      if (tile === T.TURRET) {
        if (t > 0) { this.tileTimers.set(i, t - 1); continue; }
        const b = C.BUILDINGS.TURRET;
        const cx = (i % w) + 0.5, cy = ((i / w) | 0) + 0.5;
        let best = null, bd = b.range;
        for (const e of this.enemies) { const d = Math.hypot(e.x - cx, e.y - cy); if (d <= bd) { bd = d; best = e; } }
        if (best) { this.shots.push({ x1: cx, y1: cy, x2: best.x, y2: best.y }); this.damageEnemy(best, b.damage, null); this.tileTimers.set(i, b.cooldown); }
      } else if (tile === T.FARM) {
        if (t > 1) { this.tileTimers.set(i, t - 1); continue; }
        this.setTile(i, T.FARM_RIPE);
      } else if (C.REGROW[tile]) {
        if (t > 1) { this.tileTimers.set(i, t - 1); continue; }
        const x = i % w, y = (i / w) | 0;
        if (this.tileOccupied(x, y)) { this.tileTimers.set(i, C.TICK_RATE); continue; }
        this.setTile(i, C.REGROW[tile].to);
      } else if (tile !== T.CAMPFIRE) {
        this.tileTimers.delete(i);
      }
    }
  }

  checkEnd() {
    if (this.over || this.players.size === 0) return;
    let alive = 0;
    for (const p of this.players.values()) if (p.alive) alive++;
    if (alive === 0) { this.over = true; this.won = false; this.events.push({ type: 'gameover' }); }
  }

  // ---------- 직렬화 ----------
  serializePlayer(p) {
    return {
      id: p.id, name: p.name, color: p.color, x: round2(p.x), y: round2(p.y), dx: round2(p.dx), dy: round2(p.dy),
      hp: Math.round(p.hp), hunger: Math.round(p.hunger), alive: p.alive, inv: { ...p.inv }, kills: p.kills, say: p.say, swing: p.swing,
    };
  }
  dynamicState() {
    return {
      t: this.t, day: this.day, phase: this.phase, cycleT: this.cycleT, over: this.over, won: this.won, endless: this.endless,
      score: this.score, kills: this.kills, pending: this.spawnQueue.length,
      players: [...this.players.values()].map((p) => this.serializePlayer(p)),
      enemies: this.enemies.map((e) => ({ id: e.id, kind: e.kind, x: round2(e.x), y: round2(e.y), hp: e.hp, maxHp: e.maxHp, hit: e.hitT > 0 })),
    };
  }
  fullState() {
    return { type: 'full', w: this.w, h: this.h, seed: this.seed, tiles: Array.from(this.tiles), tileHp: Array.from(this.tileHp), ...this.dynamicState() };
  }
  delta() {
    const tiles = [];
    for (const i of this.dirty) tiles.push([i, this.tiles[i], this.tileHp[i]]);
    const d = { type: 'delta', ...this.dynamicState(), tiles, shots: this.shots, fx: this.fx, events: this.events };
    this.dirty.clear(); this.shots = []; this.fx = []; this.events = [];
    return d;
  }
}
