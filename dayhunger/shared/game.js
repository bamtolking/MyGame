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
const NATURAL_SOLID = new Set([T.TREE, T.PINE, T.DEAD_TREE, T.CACTUS, T.ROCK, T.IRON_ORE, T.BUSH, T.MUSHROOM, T.HERB, T.WATER, T.WATER_EMPTY, T.LAVA]);
const BUILDING_SOLID = new Set([T.WOOD_WALL, T.STONE_WALL, T.IRON_WALL, T.DOOR, T.TURRET, T.HEAVY_TURRET, T.CAMPFIRE, T.TORCH]);
const BUILDINGS_ALL = new Set([...BUILDING_SOLID, T.FARM, T.FARM_RIPE, T.SPIKES]);
const RESOURCE_TILES = new Set(Object.keys(C.RESOURCES).map(Number));
const BUILDABLE_BASE = new Set([T.GROUND, T.MUD, T.STUMP, T.BUSH_EMPTY, T.MUSHROOM_EMPTY, T.HERB_EMPTY]);
const TURRET_TILES = new Set([T.TURRET, T.HEAVY_TURRET]);
const TIMER_TILES = new Set([T.TURRET, T.HEAVY_TURRET, T.CAMPFIRE, T.TORCH, T.FARM, ...Object.keys(C.REGROW).map(Number)]);

export const isBuilding = (t) => BUILDINGS_ALL.has(t);
export const isResource = (t) => RESOURCE_TILES.has(t);
export const isNaturalSolid = (t) => NATURAL_SOLID.has(t);
export const solidForPlayer = (t) => NATURAL_SOLID.has(t) || (BUILDING_SOLID.has(t) && t !== T.DOOR);
export const solidForEnemy = (t) => NATURAL_SOLID.has(t) || BUILDING_SOLID.has(t);

const round2 = (n) => Math.round(n * 100) / 100;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export class Game {
  constructor({ seed = (Math.random() * 2 ** 31) | 0, map = C.DEFAULT_MAP, difficulty = C.DEFAULT_DIFFICULTY } = {}) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.mapKey = C.MAPS[map] ? map : C.DEFAULT_MAP;
    this.mapDef = C.MAPS[this.mapKey];
    this.diffKey = C.DIFFICULTIES[difficulty] ? difficulty : C.DEFAULT_DIFFICULTY;
    this.diff = C.DIFFICULTIES[this.diffKey];
    const size = this.mapDef.size;
    this.w = size; this.h = size;
    this.dayTicks = this.mapDef.dayTicks; this.nightTicks = this.mapDef.nightTicks;
    this.winDay = this.diff.winDay; this.bossNights = C.bossNights(this.winDay);
    this.tiles = new Uint8Array(size * size);
    this.tileHp = new Uint16Array(size * size);
    this.tileTimers = new Map();   // 타일 인덱스 -> 남은 틱 (타입별 의미: 재성장/성장/포탑 재장전)
    this.players = new Map();
    this.enemies = [];
    this.projs = [];      // 투사체(화살·침)
    this.shots = [];      // 이번 델타에 포함될 포탑 사격선
    this.fx = [];         // 이번 델타에 포함될 효과
    this.events = [];     // 이번 델타에 포함될 이벤트
    this.dirty = new Set();
    this.t = 0; this.day = 1; this.phase = 'day'; this.cycleT = 0;
    this.over = false; this.won = false; this.endless = false;
    this.score = 0; this.kills = 0; this.nextId = 1;
    this.spawnQueue = []; this.spawnTimer = 0; this.spawnInterval = 0;
    this.flow = new Float32Array(size * size).fill(Infinity);
    this.flowAge = 999;
    this.spawnTiles = [];
    this.center = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
    this.generate();
  }

  // ---------- 좌표 유틸 ----------
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : T.WATER; }
  maxHpOf(tile) { const b = C.BUILDING_BY_TILE[tile]; return b ? b.hp : 0; }
  tileCenter(i) { return { x: (i % this.w) + 0.5, y: ((i / this.w) | 0) + 0.5 }; }

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
    else if (TIMER_TILES.has(tile)) this.tileTimers.set(i, 0);
    this.dirty.add(i);
    this.flowAge = 999;
  }
  markDirty(i) { this.dirty.add(i); }

  // ---------- 월드 생성 ----------
  generate() {
    const { w, h, rng } = this;
    const g = this.mapDef.gen;
    const per = (w * h) / 1000;
    const cx = this.center.x, cy = this.center.y;
    const distC = (x, y) => Math.hypot(x - cx, y - cy);
    const inner = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
    this.tiles.fill(T.GROUND);
    const put = (x, y, tile, force = false) => {
      if (!inner(x, y) || distC(x, y) < 5.5) return false;
      const i = this.idx(x, y), cur = this.tiles[i];
      if (!force && cur !== T.GROUND && cur !== T.MUD) return false;
      this.setTile(i, tile);
      return true;
    };
    const rndPos = () => [2 + Math.floor(rng() * (w - 4)), 2 + Math.floor(rng() * (h - 4))];
    const blob = (px, py, r, tile, minDist) => {
      if (distC(px, py) < minDist) return;
      const R = Math.ceil(r);
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (Math.hypot(x, y) <= r) put(px + x, py + y, tile, tile === T.MUD ? false : true);
    };
    const pick = (weights) => {
      const entries = Object.entries(weights); const tot = entries.reduce((s, [, v]) => s + v, 0);
      let r = rng() * tot;
      for (const [k, v] of entries) { r -= v; if (r <= 0) return T[k]; }
      return T[entries[0][0]];
    };
    // 진흙
    for (let n = 0; n < Math.round(g.mud * per); n++) { const [x, y] = rndPos(); blob(x, y, 2 + rng() * 2.5, T.MUD, 8); }
    // 연못 (+ 오아시스)
    for (let n = 0; n < Math.round(g.ponds * per); n++) {
      const [x, y] = rndPos(); const r = g.pondR[0] + rng() * (g.pondR[1] - g.pondR[0]);
      if (distC(x, y) < 10) continue;
      blob(x, y, r, T.WATER, 10);
      if (g.oases) {
        for (let k = 0; k < 6; k++) { const a = rng() * Math.PI * 2, d = r + 1 + rng() * 1.5; put(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), k < 4 ? T.BUSH : T.TREE); }
      }
    }
    // 용암
    for (let n = 0; n < Math.round(g.lava * per); n++) { const [x, y] = rndPos(); blob(x, y, 1.5 + rng() * 2.5, T.LAVA, 13); }
    // 나무 군락
    for (let n = 0; n < Math.round(g.trees * per); n++) {
      const [px, py] = rndPos(); const kind = pick(g.treeKinds); const cnt = 3 + Math.floor(rng() * 7);
      for (let k = 0; k < cnt; k++) { const a = rng() * Math.PI * 2, d = rng() * 3; put(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d), kind); }
    }
    // 선인장
    for (let n = 0; n < Math.round(g.cacti * per); n++) { const [x, y] = rndPos(); put(x, y, T.CACTUS); }
    // 바위·철
    for (let n = 0; n < Math.round(g.rocks * per); n++) {
      const [px, py] = rndPos(); const cnt = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < cnt; k++) { const a = rng() * Math.PI * 2, d = rng() * 2; put(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d), T.ROCK); }
    }
    for (let n = 0; n < Math.round(g.iron * per); n++) {
      const [px, py] = rndPos(); const cnt = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < cnt; k++) { const a = rng() * Math.PI * 2, d = rng() * 1.5; put(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d), T.IRON_ORE); }
    }
    // 덤불·버섯·약초
    for (let n = 0; n < Math.round(g.bushes * per); n++) { const [x, y] = rndPos(); put(x, y, T.BUSH); }
    for (let n = 0; n < Math.round(g.mushrooms * per); n++) { const [x, y] = rndPos(); put(x, y, T.MUSHROOM); }
    for (let n = 0; n < Math.round(g.herbs * per); n++) { const [x, y] = rndPos(); put(x, y, T.HERB); }
    // 기지 근처 보장 자원 (반지름 6~10)
    const ring = (tileFn, cnt, r0, r1) => {
      let placed = 0, tries = 0;
      while (placed < cnt && tries++ < 300) {
        const a = rng() * Math.PI * 2, d = r0 + rng() * (r1 - r0);
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (this.tiles[this.idx(x, y)] === T.GROUND) { this.setTile(this.idx(x, y), tileFn()); placed++; }
      }
    };
    ring(() => pick(g.treeKinds), 8, 6, 10);
    if (g.cacti > 0) ring(() => T.CACTUS, 4, 6, 10);
    ring(() => (g.bushes >= g.mushrooms ? T.BUSH : T.MUSHROOM), 4, 6, 10);
    ring(() => T.ROCK, 3, 6, 10);
    ring(() => T.IRON_ORE, 2, 7, 11);
    ring(() => T.HERB, 1, 6, 10);
    // 기지 중앙 모닥불
    this.setTile(this.idx(cx, cy), T.CAMPFIRE);
    // 출현 지점: 기지에서 닿을 수 있는 고리 지역
    this.computeSpawnTiles();
    if (this.spawnTiles.length < 8) {
      for (let x = cx; x < w; x++) { const i = this.idx(x, cy); if (NATURAL_SOLID.has(this.tiles[i])) this.setTile(i, T.GROUND); }
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
    this.reachable = seen;
    const [r0, r1] = this.mapDef.spawnRing;
    const pickRing = (a, b) => {
      const out = [];
      for (let i = 0; i < w * h; i++) {
        if (!seen[i]) continue;
        const t = this.tiles[i]; if (t !== T.GROUND && t !== T.MUD) continue;
        const d = cheb(i % w, (i / w) | 0, this.center.x, this.center.y);
        if (d >= a && d <= b) out.push(i);
      }
      return out;
    };
    this.spawnTiles = pickRing(r0, r1);
    if (this.spawnTiles.length < 8) this.spawnTiles = pickRing(Math.floor(r0 * 0.6), Math.floor(w / 2) - 1);
  }

  // ---------- 플레이어 ----------
  addPlayer(name = '생존자', cls = C.DEFAULT_CLASS) {
    const id = this.nextId++;
    if (!C.CLASSES[cls]) cls = C.DEFAULT_CLASS;
    const cd = C.CLASSES[cls];
    const color = C.PLAYER_COLORS[(this.players.size) % C.PLAYER_COLORS.length];
    const spot = this.findSpawnSpot();
    const p = {
      id, name: String(name).slice(0, 10) || '생존자', color, cls,
      x: spot.x, y: spot.y, dx: 0, dy: 1,
      hp: cd.hp, maxHp: cd.hp, hunger: C.PLAYER.maxHunger, alive: true,
      inv: { ...C.PLAYER.startInv }, kills: 0,
      input: { mx: 0, my: 0, action: false },
      actionCd: 0, hungerT: 0, say: '', sayT: 0, swing: 0, swingKind: '', deaths: 0, target: -1, moving: false,
    };
    this.players.set(id, p);
    this.events.push({ type: 'join', name: p.name, cls });
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
  classOf(p) { return C.CLASSES[p.cls] || C.CLASSES[C.DEFAULT_CLASS]; }

  // ---------- 플레이어 행동 ----------
  canReach(p, tx, ty) {
    const range = this.classOf(p).buildRange || C.BUILD_RANGE;
    return cheb(Math.floor(p.x), Math.floor(p.y), tx, ty) <= range;
  }
  hasCost(p, cost) { return Object.entries(cost).every(([k, v]) => (p.inv[k] || 0) >= v); }
  payCost(p, cost) { for (const [k, v] of Object.entries(cost)) p.inv[k] -= v; }
  give(p, k, n) { p.inv[k] = Math.min(C.PLAYER.maxInv, (p.inv[k] || 0) + n); }
  tileOccupied(tx, ty) {
    const cx = tx + 0.5, cy = ty + 0.5;
    for (const q of this.players.values()) if (q.alive && Math.abs(q.x - cx) < 0.5 + C.PLAYER.radius && Math.abs(q.y - cy) < 0.5 + C.PLAYER.radius) return true;
    for (const e of this.enemies) if (!C.ENEMIES[e.kind].flying && Math.abs(e.x - cx) < 0.5 + e.radius && Math.abs(e.y - cy) < 0.5 + e.radius) return true;
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
    const cost = C.costFor(p.cls, b.cost);
    if (!this.hasCost(p, cost)) return { ok: false, reason: '자원이 부족해요' };
    this.payCost(p, cost);
    this.setTile(i, b.tile);
    this.events.push({ type: 'build', key, x: tx, y: ty, by: p.name });
    this.fx.push({ x: tx + 0.5, y: ty + 0.5, k: 'build' });
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
    this.tileHp[i] = Math.min(max, this.tileHp[i] + C.REPAIR_AMOUNT + (this.classOf(p).repairBonus || 0));
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
    for (const [k, v] of Object.entries(b.cost)) this.give(p, k, Math.floor(v * C.DISMANTLE_REFUND));
    this.setTile(i, T.GROUND);
    return { ok: true };
  }
  eat(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.over) return { ok: false, reason: '불가' };
    if (p.inv.food <= 0) return { ok: false, reason: '식량이 없어요' };
    if (p.hunger >= C.PLAYER.maxHunger) return { ok: false, reason: '배가 불러요' };
    p.inv.food--;
    const near = this.nearWarm(p.x, p.y, true);
    const val = (near ? C.PLAYER.campfireFoodValue : C.PLAYER.foodValue) * (this.classOf(p).foodMul || 1);
    p.hunger = Math.min(C.PLAYER.maxHunger, p.hunger + val);
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

  // 모닥불(또는 횃불) 근처인가. campfireOnly=true면 모닥불만.
  nearWarm(x, y, campfireOnly = false) {
    for (const [i] of this.tileTimers) {
      const t = this.tiles[i];
      const r = t === T.CAMPFIRE ? C.BUILDINGS.CAMPFIRE.radius : (!campfireOnly && t === T.TORCH ? 2 : 0);
      if (!r) continue;
      const c = this.tileCenter(i);
      if (Math.hypot(c.x - x, c.y - y) <= r) return true;
    }
    return false;
  }

  // ---------- 충돌 ----------
  moveEntity(e, radius, vx, vy, solidFn) {
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
  groundMul(x, y) { return this.tileAt(Math.floor(x), Math.floor(y)) === T.MUD ? C.MUD_SPEED : 1; }

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
    }
    this.tickProjectiles();
    this.tickTiles();
    if (this.enemies.length) this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.checkEnd();
  }

  tickClock() {
    this.cycleT++;
    if (this.phase === 'day' && this.cycleT >= this.dayTicks) {
      this.phase = 'night'; this.cycleT = 0; this.startNight();
    } else if (this.phase === 'night' && this.cycleT >= this.nightTicks) {
      this.phase = 'day'; this.cycleT = 0; this.day++; this.startDay();
    }
  }
  wavePool() {
    const mul = this.mapDef.enemyMul || {};
    return Object.entries(C.ENEMIES)
      .map(([key, e]) => [key, e.weight * (mul[key] === undefined ? 1 : mul[key]), e])
      .filter(([, w, e]) => e.minDay <= this.day && w > 0);
  }
  startNight() {
    const alive = [...this.players.values()].filter((p) => p.alive).length || 1;
    const count = Math.max(1, Math.round(C.WAVE_COUNT(this.day, alive) * this.diff.waveMul));
    const pool = this.wavePool();
    const totalW = pool.reduce((s, [, w]) => s + w, 0);
    this.spawnQueue = [];
    for (let n = 0; n < count; n++) {
      let r = this.rng() * totalW;
      for (const [key, w] of pool) { r -= w; if (r <= 0) { this.spawnQueue.push(key); break; } }
    }
    if (this.bossNights.has(this.day)) this.spawnQueue.splice(Math.floor(count / 2), 0, 'BOSS');
    this.spawnInterval = Math.max(3, Math.floor((this.nightTicks * 0.6) / Math.max(1, this.spawnQueue.length)));
    this.spawnTimer = C.TICK_RATE * 2;
    this.events.push({ type: 'night', day: this.day, count: this.spawnQueue.length, boss: this.bossNights.has(this.day) });
  }
  startDay() {
    const bonus = C.DAWN_BONUS(this.day, this.diff.bonusMul);
    for (const p of this.players.values()) {
      if (!p.alive) {
        p.alive = true; p.hp = Math.min(p.maxHp, C.PLAYER.respawnHp); p.hunger = Math.max(p.hunger, 50);
        const s = this.findSpawnSpot(); p.x = s.x; p.y = s.y;
      }
      for (const [k, v] of Object.entries(bonus)) this.give(p, k, v);
    }
    this.score += 100;
    this.events.push({ type: 'dawn', day: this.day, bonus });
    if (!this.endless && this.day >= this.winDay) { this.over = true; this.won = true; this.events.push({ type: 'win' }); }
  }

  hurtPlayer(p, dmg, kind = 'hurt') {
    if (!p.alive) return;
    const armor = this.classOf(p).armor || 0;
    p.hp -= dmg * (1 - armor);
    this.fx.push({ x: p.x, y: p.y, k: kind });
    if (p.hp <= 0) this.killPlayer(p);
  }
  tickPlayer(p) {
    if (p.sayT > 0 && --p.sayT === 0) p.say = '';
    if (p.swing > 0) p.swing--;
    if (!p.alive) return;
    if (p.hp <= 0) { this.killPlayer(p); return; }
    const cd = this.classOf(p);
    // 배고픔 (추운 전장은 모닥불·횃불 근처가 아니면 빨리 고픔)
    let mul = (this.phase === 'night' ? C.PLAYER.nightHungerMul : 1) * (cd.hungerMul || 1);
    if (this.mapDef.hungerMul !== 1 && !this.nearWarm(p.x, p.y)) mul *= this.mapDef.hungerMul;
    p.hungerT += mul;
    if (p.hungerT >= C.PLAYER.hungerDrainTicks) { p.hungerT -= C.PLAYER.hungerDrainTicks; p.hunger = Math.max(0, p.hunger - 1); }
    if (p.hunger <= 0) p.hp -= C.PLAYER.starveDamagePerSec / C.TICK_RATE;
    else if (p.hunger > 60 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 0.5 / C.TICK_RATE);
    if (p.hp < p.maxHp && this.nearWarm(p.x, p.y, true)) p.hp = Math.min(p.maxHp, p.hp + C.PLAYER.campfireRegenPerSec / C.TICK_RATE);
    // 이동
    const { mx, my } = p.input;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      const sp = (cd.speed * this.groundMul(p.x, p.y)) / C.TICK_RATE;
      this.moveEntity(p, C.PLAYER.radius, mx * sp, my * sp, solidForPlayer);
      const len = Math.hypot(mx, my); p.dx = mx / len; p.dy = my / len;
    }
    // 행동
    if (p.actionCd > 0) p.actionCd--;
    if (p.input.action && p.actionCd <= 0) this.doAction(p);
    else if (!p.input.action) p.target = -1;
    if (p.hp <= 0) this.killPlayer(p);
  }
  killPlayer(p) {
    p.alive = false; p.hp = 0; p.deaths++;
    p.input.mx = p.input.my = 0; p.input.action = false;
    this.fx.push({ x: p.x, y: p.y, k: 'death' });
    this.events.push({ type: 'death', name: p.name });
  }
  face(p, x, y) { const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy) || 1; p.dx = dx / l; p.dy = dy / l; }

  doAction(p) {
    const cd = this.classOf(p);
    p.actionCd = C.PLAYER.actionCooldown;
    // 1) 적: 원거리 클래스는 사거리 안이면 쏘고, 아니면 근접
    let best = null, bestD = Infinity;
    const range = cd.ranged ? cd.ranged.range : C.PLAYER.attackRange;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
      if (d <= range && d < bestD) { best = e; bestD = d; }
    }
    if (best) {
      this.face(p, best.x, best.y);
      p.swing = 7; p.swingKind = cd.ranged ? 'shoot' : 'attack'; p.target = -1;
      if (cd.ranged) {
        const dx = best.x - p.x, dy = best.y - p.y, l = Math.hypot(dx, dy) || 1, sp = cd.ranged.speed / C.TICK_RATE;
        this.projs.push({ id: this.nextId++, x: p.x, y: p.y, vx: (dx / l) * sp, vy: (dy / l) * sp, dmg: cd.damage, by: p.id, team: 'p', k: 'arrow', ttl: Math.ceil((cd.ranged.range + 1) / cd.ranged.speed * C.TICK_RATE) });
      } else this.damageEnemy(best, cd.damage, p);
      return;
    }
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
      const score = (d > 0 ? (vx * p.dx + vy * p.dy) / d : 1) * 2 - d + (i === p.target ? 1.5 : 0);
      if (score > bs) { bs = score; bi = i; }
    }
    if (bi < 0) { p.swing = 7; p.swingKind = 'miss'; return; }
    p.target = bi;
    const c = this.tileCenter(bi); this.face(p, c.x, c.y);
    this.hitResource(bi, p);
  }
  hitResource(i, p) {
    const tile = this.tiles[i];
    const r = C.RESOURCES[tile];
    if (!r) return;
    const cd = this.classOf(p);
    const c = this.tileCenter(i);
    p.swing = 7; p.swingKind = r.kind;
    this.fx.push({ x: c.x, y: c.y, k: 'hit', res: r.kind, tile: i });
    const power = (cd.gather && cd.gather[r.kind]) || 1;
    if (this.tileHp[i] > power) { this.tileHp[i] -= power; this.markDirty(i); return; }
    for (const [k, v] of Object.entries(r.gives)) {
      const n = v + ((cd.bonus && cd.bonus[k]) || 0);
      this.give(p, k, n);
      this.fx.push({ x: c.x, y: c.y, k: 'gain', res: k, n });
    }
    if (r.heal) { p.hp = Math.min(p.maxHp, p.hp + r.heal); this.fx.push({ x: p.x, y: p.y, k: 'heal', n: r.heal }); }
    this.setTile(i, r.leaves);
    this.fx.push({ x: c.x, y: c.y, k: 'deplete', res: r.kind });
  }

  damageEnemy(e, dmg, by) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hitT = 4;
    this.fx.push({ x: e.x, y: e.y, k: 'blood' });
    if (e.hp <= 0) {
      const def = C.ENEMIES[e.kind];
      this.kills++; this.score += def.score * (e.elite ? 3 : 1);
      if (by) by.kills++;
      if (e.loot && by) { this.give(by, e.loot.k, e.loot.n); this.events.push({ type: 'recover', name: by.name, res: e.loot.k, n: e.loot.n }); }
      this.events.push({ type: 'kill', kind: e.kind, by: by ? by.name : null, elite: !!e.elite });
      this.fx.push({ x: e.x, y: e.y, k: 'die', big: e.kind === 'BOSS' || e.kind === 'BRUTE' });
    }
  }
  damageTile(i, dmg) {
    if (!isBuilding(this.tiles[i])) return;
    const c = this.tileCenter(i);
    this.fx.push({ x: c.x, y: c.y, k: 'crack', tile: i });
    if (this.tileHp[i] > dmg) { this.tileHp[i] -= dmg; this.markDirty(i); this.flowAge = 999; return; }
    const tile = this.tiles[i];
    this.setTile(i, T.GROUND);
    this.events.push({ type: 'destroyed', tile, x: c.x - 0.5, y: c.y - 0.5 });
  }

  // ---------- 적 ----------
  tickSpawns() {
    if (!this.spawnQueue.length || !this.spawnTiles.length) return;
    if (--this.spawnTimer > 0) return;
    this.spawnTimer = this.spawnInterval;
    const kind = this.spawnQueue.shift();
    let i = this.spawnTiles[Math.floor(this.rng() * this.spawnTiles.length)];
    for (let k = 0; k < 2; k++) {
      const c = this.tileCenter(i);
      let close = false;
      for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - c.x, p.y - c.y) < 8) { close = true; break; }
      if (!close) break;
      i = this.spawnTiles[Math.floor(this.rng() * this.spawnTiles.length)];
    }
    const c = this.tileCenter(i);
    this.spawnEnemy(kind, c.x, c.y, { elite: kind !== 'BOSS' && this.rng() < C.ELITE_CHANCE });
  }
  spawnEnemy(kind, x, y, { elite = false } = {}) {
    const def = C.ENEMIES[kind];
    let scale = this.diff.hpMul * (this.mapDef.hpMul || 1);
    if (kind !== 'BOSS') scale *= C.ENEMY_HP_SCALE(this.day);
    if (elite) scale *= 2;
    const hp = Math.round(def.hp * scale);
    const e = { id: this.nextId++, kind, x, y, hp, maxHp: hp, radius: def.radius * (elite ? 1.25 : 1), cd: 0, hitT: 0, wander: 0, elite, flee: 0, loot: null, spikeT: 0, summonT: 0 };
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
      if (t === T.SPIKES) return 3;
      if (t === T.MUD) return 1.6;
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

  nearestPlayer(x, y) {
    let target = null, td = Infinity;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < td) { td = d; target = p; }
    }
    return { target, td };
  }
  explode(e) {
    const def = C.ENEMIES[e.kind]; const b = def.bomb;
    this.fx.push({ x: e.x, y: e.y, k: 'explosion', r: b.radius });
    const x0 = Math.max(0, Math.floor(e.x - b.radius)), x1 = Math.min(this.w - 1, Math.ceil(e.x + b.radius));
    const y0 = Math.max(0, Math.floor(e.y - b.radius)), y1 = Math.min(this.h - 1, Math.ceil(e.y + b.radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = this.idx(x, y);
      if (isBuilding(this.tiles[i]) && Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) <= b.radius) this.damageTile(i, b.building);
    }
    for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - e.x, p.y - e.y) <= b.radius + C.PLAYER.radius) this.hurtPlayer(p, b.player * this.diff.dmgMul);
    for (const o of this.enemies) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= b.radius) this.damageEnemy(o, b.player, null);
    e.hp = 0;
    this.events.push({ type: 'explosion' });
  }
  steal(e, p) {
    const th = C.ENEMIES[e.kind].thief;
    let bestK = null;
    for (const k of C.RES_KEYS) if ((p.inv[k] || 0) > 0 && (bestK === null || p.inv[k] > p.inv[bestK])) bestK = k;
    if (!bestK) return;
    const n = Math.min(th.amount, p.inv[bestK]);
    p.inv[bestK] -= n;
    e.loot = e.loot && e.loot.k === bestK ? { k: bestK, n: e.loot.n + n } : { k: bestK, n };
    e.flee = th.flee;
    this.fx.push({ x: p.x, y: p.y, k: 'steal', res: bestK, n });
    this.events.push({ type: 'steal', name: p.name, res: bestK, n });
  }

  tickEnemy(e) {
    const def = C.ENEMIES[e.kind];
    if (e.cd > 0) e.cd--;
    if (e.hitT > 0) e.hitT--;
    if (this.phase === 'day') e.hp -= e.maxHp / (C.BURN_SECONDS * C.TICK_RATE); // 햇빛에 타서 사라짐
    if (e.hp <= 0) return;
    const dmgMul = this.diff.dmgMul;
    const onMud = !def.flying && this.groundMul(e.x, e.y) !== 1;
    const sp = (def.speed * (onMud ? C.MUD_SPEED : 1)) / C.TICK_RATE;
    // 가시 함정
    if (!def.flying) {
      const ti = this.idx(Math.floor(e.x), Math.floor(e.y));
      if (this.tiles[ti] === T.SPIKES) {
        if (++e.spikeT >= C.BUILDINGS.SPIKES.every) {
          e.spikeT = 0; this.damageEnemy(e, C.BUILDINGS.SPIKES.damage, null);
          if (this.tileHp[ti] > 1) { this.tileHp[ti]--; this.markDirty(ti); } else { this.setTile(ti, T.GROUND); this.events.push({ type: 'destroyed', tile: T.SPIKES }); }
          if (e.hp <= 0) return;
        }
      } else e.spikeT = 0;
    }
    // 보스 소환
    if (def.summon && ++e.summonT >= def.summon.every) {
      e.summonT = 0;
      for (let k = 0; k < def.summon.n; k++) this.spawnEnemy(def.summon.kind, e.x + (this.rng() - 0.5) * 2, e.y + (this.rng() - 0.5) * 2);
      this.fx.push({ x: e.x, y: e.y, k: 'summon' });
    }
    // 도망 (도둑)
    if (e.flee > 0) {
      e.flee--;
      const { target, td } = this.nearestPlayer(e.x, e.y);
      if (target && td > 0.01) this.moveEntity(e, e.radius, ((e.x - target.x) / td) * sp, ((e.y - target.y) / td) * sp, solidForEnemy);
      return;
    }
    const { target, td } = this.nearestPlayer(e.x, e.y);
    const contact = e.radius + C.PLAYER.radius + 0.35;
    // 비행: 벽 무시하고 직진
    if (def.flying) {
      if (!target) return;
      if (td <= contact) { if (e.cd <= 0) { e.cd = def.cooldown; this.hurtPlayer(target, def.damage * dmgMul); } return; }
      e.x = Math.min(this.w - 0.3, Math.max(0.3, e.x + ((target.x - e.x) / td) * sp));
      e.y = Math.min(this.h - 0.3, Math.max(0.3, e.y + ((target.y - e.y) / td) * sp));
      return;
    }
    // 원거리: 사거리 안이면 침 뱉기, 너무 가까우면 제자리
    if (def.ranged && target && td <= def.ranged.range) {
      if (e.cd <= 0) {
        e.cd = def.cooldown;
        const l = td || 1, ps = def.ranged.speed / C.TICK_RATE;
        this.projs.push({ id: this.nextId++, x: e.x, y: e.y, vx: ((target.x - e.x) / l) * ps, vy: ((target.y - e.y) / l) * ps, dmg: def.damage * dmgMul, team: 'e', k: 'spit', ttl: Math.ceil((def.ranged.range + 1) / def.ranged.speed * C.TICK_RATE) });
        this.fx.push({ x: e.x, y: e.y, k: 'spitfx' });
      }
      if (td > def.ranged.range * 0.5) return;
    }
    // 폭탄병: 플레이어에 닿으면 자폭
    if (def.bomb && target && td <= contact + 0.3) { this.explode(e); return; }
    // 근접 공격
    if (target && td <= contact) {
      if (e.cd <= 0) {
        e.cd = def.cooldown;
        this.hurtPlayer(target, def.damage * dmgMul);
        if (def.thief) this.steal(e, target);
      }
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
      if (dx && dy) {
        if (solidForEnemy(tiles[this.idx(tx + dx, ty)]) || solidForEnemy(tiles[this.idx(tx, ty + dy)])) continue;
      }
      if (flow[ni] < bestD) { bestD = flow[ni]; best = ni; }
    }
    if (best < 0) {
      if (--e.wander <= 0) { e.wander = 20 + Math.floor(this.rng() * 20); e.wx = this.rng() * 2 - 1; e.wy = this.rng() * 2 - 1; }
      this.moveEntity(e, e.radius, (e.wx || 0) * sp * 0.5, (e.wy || 0) * sp * 0.5, solidForEnemy);
      return;
    }
    const c = this.tileCenter(best);
    const vx = c.x - e.x, vy = c.y - e.y;
    const dist = Math.hypot(vx, vy) || 1;
    if (BUILDING_SOLID.has(tiles[best])) {
      if (dist <= 0.5 + e.radius + 0.15) {
        if (def.bomb) { this.explode(e); return; }
        if (e.cd <= 0) { e.cd = def.cooldown; this.damageTile(best, Math.max(1, Math.round(def.damage * dmgMul * (def.buildingMul || 1)))); this.fx.push({ x: e.x, y: e.y, k: 'swing' }); }
        return;
      }
    }
    this.moveEntity(e, e.radius, (vx / dist) * sp, (vy / dist) * sp, solidForEnemy);
  }
  separateEnemies() {
    const es = this.enemies;
    for (let a = 0; a < es.length; a++) {
      const A = es[a]; if (C.ENEMIES[A.kind].flying) continue;
      for (let b = a + 1; b < es.length; b++) {
        const B = es[b]; if (C.ENEMIES[B.kind].flying) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy), min = A.radius + B.radius;
        if (d >= min || d === 0) continue;
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        this.moveEntity(A, A.radius, -ux * push, -uy * push, solidForEnemy);
        this.moveEntity(B, B.radius, ux * push, uy * push, solidForEnemy);
      }
    }
  }

  // ---------- 투사체 ----------
  tickProjectiles() {
    if (!this.projs.length) return;
    const keep = [];
    for (const pr of this.projs) {
      pr.x += pr.vx; pr.y += pr.vy; pr.ttl--;
      let hit = false;
      if (pr.team === 'p') {
        for (const e of this.enemies) {
          if (e.hp > 0 && Math.hypot(e.x - pr.x, e.y - pr.y) <= e.radius + 0.15) { this.damageEnemy(e, pr.dmg, this.players.get(pr.by) || null); hit = true; break; }
        }
      } else {
        for (const p of this.players.values()) {
          if (p.alive && Math.hypot(p.x - pr.x, p.y - pr.y) <= C.PLAYER.radius + 0.2) { this.hurtPlayer(p, pr.dmg, 'spithit'); hit = true; break; }
        }
      }
      if (hit || pr.ttl <= 0 || pr.x < 0 || pr.y < 0 || pr.x >= this.w || pr.y >= this.h) { if (!hit) this.fx.push({ x: pr.x, y: pr.y, k: 'poof' }); continue; }
      keep.push(pr);
    }
    this.projs = keep;
  }

  // ---------- 타일(포탑·밭·재성장) ----------
  tickTiles() {
    const { tiles } = this;
    for (const [i, t] of this.tileTimers) {
      const tile = tiles[i];
      if (TURRET_TILES.has(tile)) {
        if (t > 0) { this.tileTimers.set(i, t - 1); continue; }
        const b = C.BUILDING_BY_TILE[tile];
        const c = this.tileCenter(i);
        let best = null, bd = b.range;
        for (const e of this.enemies) { if (e.hp <= 0) continue; const d = Math.hypot(e.x - c.x, e.y - c.y); if (d <= bd) { bd = d; best = e; } }
        if (best) { this.shots.push({ x1: c.x, y1: c.y, x2: best.x, y2: best.y, heavy: tile === T.HEAVY_TURRET }); this.damageEnemy(best, b.damage, null); this.tileTimers.set(i, b.cooldown); }
      } else if (tile === T.FARM) {
        if (t > 1) { this.tileTimers.set(i, t - 1); continue; }
        this.setTile(i, T.FARM_RIPE);
      } else if (C.REGROW[tile]) {
        if (t > 1) { this.tileTimers.set(i, t - 1); continue; }
        const x = i % this.w, y = (i / this.w) | 0;
        if (this.tileOccupied(x, y)) { this.tileTimers.set(i, C.TICK_RATE); continue; }
        this.setTile(i, C.REGROW[tile].to);
      } else if (tile !== T.CAMPFIRE && tile !== T.TORCH) {
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
      id: p.id, name: p.name, color: p.color, cls: p.cls, x: round2(p.x), y: round2(p.y), dx: round2(p.dx), dy: round2(p.dy),
      hp: Math.round(p.hp), maxHp: p.maxHp, hunger: Math.round(p.hunger), alive: p.alive, inv: { ...p.inv }, kills: p.kills,
      say: p.say, swing: p.swing, swingKind: p.swingKind, target: p.target, moving: p.moving,
    };
  }
  dynamicState() {
    return {
      t: this.t, day: this.day, phase: this.phase, cycleT: this.cycleT, over: this.over, won: this.won, endless: this.endless,
      map: this.mapKey, difficulty: this.diffKey, winDay: this.winDay, dayTicks: this.dayTicks, nightTicks: this.nightTicks,
      score: this.score, kills: this.kills, pending: this.spawnQueue.length,
      players: [...this.players.values()].map((p) => this.serializePlayer(p)),
      enemies: this.enemies.map((e) => ({ id: e.id, kind: e.kind, x: round2(e.x), y: round2(e.y), hp: e.hp, maxHp: e.maxHp, hit: e.hitT > 0, elite: e.elite, flee: e.flee > 0 })),
      projs: this.projs.map((pr) => ({ id: pr.id, x: round2(pr.x), y: round2(pr.y), k: pr.k, a: round2(Math.atan2(pr.vy, pr.vx)) })),
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
