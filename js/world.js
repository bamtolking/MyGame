'use strict';
// ===================== 지역 테마 / 맵 모드 =====================
const THEMES = {
  forest: { id: 'forest', name: '저주받은 숲', floor: ['#1c2818', '#20301b', '#182316', '#243421'], wall: '#0b120a', wallTop: '#2c3f27', accent: '#3d6b36', decor: 'tree', monsters: ['ghoul', 'bat', 'werewolf', 'cultist'], boss: 'traitor', light: '#9fd49a' },
  cemetery: { id: 'cemetery', name: '피의 묘지', floor: ['#262024', '#2b2428', '#211c1f', '#2f272b'], wall: '#110d0f', wallTop: '#3d3137', accent: '#6b2a3a', decor: 'grave', monsters: ['ghoul', 'skel_archer', 'bat', 'wraith'], boss: 'vampire_lord', light: '#d4a0a0' },
  cathedral: { id: 'cathedral', name: '버려진 성당', floor: ['#2a2337', '#2f283d', '#251f32', '#332b42'], wall: '#130f1c', wallTop: '#4a3d60', accent: '#8a6d3b', decor: 'pillar', monsters: ['priest', 'cultist', 'skel_archer', 'wraith'], boss: 'archbishop', light: '#e8d5a0' },
  abyss: { id: 'abyss', name: '심연', floor: ['#0f1724', '#131f2d', '#0c131e', '#162436'], wall: '#04070e', wallTop: '#1e2f4a', accent: '#2f5a8a', decor: 'crystal', monsters: ['wraith', 'witch', 'bat', 'golem'], boss: 'lich', light: '#8ab8ff' },
  inferno: { id: 'inferno', name: '화염 협곡', floor: ['#2c1911', '#321f18', '#26150f', '#3a2419'], wall: '#140905', wallTop: '#4d2c1d', accent: '#c1440e', decor: 'lava', monsters: ['hound', 'golem', 'cultist', 'priest'], boss: 'rider', light: '#ffb080' },
};
const THEME_IDS = Object.keys(THEMES);
const MAP_MODS = {
  mon_life: { name: '몬스터 생명력 +40%', iiq: 15, monHp: 1.4 },
  mon_dmg: { name: '몬스터 피해 +30%', iiq: 18, monDmg: 1.3 },
  mon_speed: { name: '몬스터 속도 +25%', iiq: 15, monSpeed: 1.25 },
  player_res: { name: '플레이어 원소 저항 -25%', iiq: 18, player: { fire_res: -25, cold_res: -25, light_res: -25 } },
  no_regen: { name: '플레이어 생명력 재생 없음', iiq: 20, noRegen: true },
  more_rares: { name: '희귀 몬스터 팩 +60%', iiq: 20, rareMult: 1.6 },
  more_magic: { name: '마법 몬스터 +80%', iiq: 12, magicMult: 1.8 },
  mon_ele: { name: '몬스터가 추가 원소 피해', iiq: 14, monEle: true },
  volatile: { name: '몬스터 처치 시 폭발', iiq: 22, volatile: true },
  eternal_night: { name: '영원한 밤', iiq: 15, forced: 'night' },
  eternal_day: { name: '영원한 낮', iiq: 15, forced: 'day' },
  blood_moon: { name: '블러드문', iiq: 30, forced: 'bloodmoon' },
  swarm: { name: '몬스터 수 +40%', iiq: 18, packMult: 1.4 },
  player_slow: { name: '플레이어 이동 속도 -15%', iiq: 14, player: { inc_move: -0.15 } },
};
const MAP_MOD_IDS = Object.keys(MAP_MODS);

function makeMapDef(tier, modCount) {
  const mods = []; const pool = shuffle([...MAP_MOD_IDS]);
  const hasTime = m => ['eternal_night', 'eternal_day', 'blood_moon'].includes(m);
  for (const m of pool) { if (mods.length >= modCount) break; if (hasTime(m) && mods.some(hasTime)) continue; mods.push(m); }
  const iiq = mods.reduce((a, m) => a + MAP_MODS[m].iiq, 0) + (tier - 1) * 4;
  const iir = tier * 3 + Math.round(iiq / 2);
  return { tier, theme: choice(THEME_IDS), mods, iiq, iir, level: (tier - 1) * 2 + 1, seed: randInt(1, 1e9) };
}
function makeMapOptions(p) {
  const T = p.maxTier;
  const opts = [];
  opts.push(Object.assign(makeMapDef(Math.max(1, T - 1), T <= 2 ? 0 : 1), { label: '안전한 길', color: '#9fe1a5' }));
  opts.push(Object.assign(makeMapDef(T, T <= 1 ? 1 : 2), { label: '표준', color: '#ffd23f' }));
  opts.push(Object.assign(makeMapDef(T, T <= 1 ? 2 : 4), { label: '위험한 길', color: '#ff5c5c' }));
  return opts;
}

// ===================== 월드 =====================
const World = {
  w: 0, h: 0, tiles: null, floorCanvas: null, decalCanvas: null, decalCtx: null, explored: null,
  monsters: [], projectiles: [], zones: [], particles: [], dmgNums: [], drops: [], minions: [],
  grid: new Map(), cell: 96,
  theme: null, tier: 1, level: 1, mapMods: {}, mapDef: null, iiq: 0, iir: 0,
  boss: null, portal: null, rift: null, shrines: [], startX: 0, startY: 0,
  killCount: 0, monsterTotal: 0, time: 0, rivalTimer: 25, exploreT: 0, active: false,

  generate(def) {
    this.mapDef = def; this.tier = def.tier; this.level = def.level; this.theme = THEMES[def.theme];
    this.mapMods = {}; const pm = {};
    for (const id of def.mods) { const m = MAP_MODS[id]; for (const k in m) { if (k === 'player') Object.assign(pm, m.player); else if (k !== 'name' && k !== 'iiq') this.mapMods[k] = m[k]; } }
    const p = Game.player; p.mapMods = pm; if (this.mapMods.noRegen) p.mapMods.no_regen = true; p.recalc();
    Clock.forced = this.mapMods.forced || null; if (Clock.forced === 'bloodmoon') Clock.bloodMoon = true; else if (Clock.forced) Clock.bloodMoon = false;
    this.iiq = def.iiq; this.iir = def.iir;
    this.monsters = []; this.projectiles = []; this.zones = []; this.particles = []; this.dmgNums = []; this.drops = []; this.minions = [];
    this.boss = null; this.portal = null; this.rift = null; this.shrines = []; this.killCount = 0; this.time = 0; this.rivalTimer = 25; this.active = true;
    const W = this.w = CFG.MAP_W, H = this.h = CFG.MAP_H;
    const rng = mulberry32(def.seed);
    let tiles, floorTiles;
    for (let attempt = 0; attempt < 12; attempt++) {
      tiles = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) tiles[i] = rng() < 0.44 ? 1 : 0;
      for (let it = 0; it < 4; it++) {
        const nt = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || tiles[yy * W + xx]) n++; }
          nt[y * W + x] = n >= 5 ? 1 : 0;
        }
        tiles = nt;
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) tiles[y * W + x] = 1;
      // 가장 큰 영역만 유지
      const region = new Int32Array(W * H).fill(-1); let best = -1, bestSize = 0, rid = 0;
      for (let i = 0; i < W * H; i++) {
        if (tiles[i] || region[i] >= 0) continue;
        const stack = [i]; region[i] = rid; let size = 0;
        while (stack.length) { const c = stack.pop(); size++; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (!tiles[ni] && region[ni] < 0) { region[ni] = rid; stack.push(ni); } } }
        if (size > bestSize) { bestSize = size; best = rid; } rid++;
      }
      for (let i = 0; i < W * H; i++) if (!tiles[i] && region[i] !== best) tiles[i] = 1;
      floorTiles = bestSize;
      if (floorTiles > W * H * 0.34) break;
    }
    this.tiles = tiles;
    // 시작점 / 보스 위치 (BFS 최장 거리)
    const floors = []; for (let i = 0; i < W * H; i++) if (!tiles[i]) floors.push(i);
    const startI = floors[Math.floor(rng() * floors.length)];
    const distMap = this.bfs(startI);
    let bossI = startI, bd = 0; for (const i of floors) if (distMap[i] > bd) { bd = distMap[i]; bossI = i; }
    this.clearArea(startI % W, (startI / W) | 0, 4); this.clearArea(bossI % W, (bossI / W) | 0, 7);
    this.startX = (startI % W + 0.5) * CFG.TILE; this.startY = (((startI / W) | 0) + 0.5) * CFG.TILE;
    const bx = (bossI % W + 0.5) * CFG.TILE, by = (((bossI / W) | 0) + 0.5) * CFG.TILE;
    // 균열 / 제단
    const mid = floors.filter(i => distMap[i] > bd * 0.35 && distMap[i] < bd * 0.7);
    if (mid.length) { const ri = mid[Math.floor(rng() * mid.length)]; this.clearArea(ri % W, (ri / W) | 0, 5); this.rift = { x: (ri % W + 0.5) * CFG.TILE, y: (((ri / W) | 0) + 0.5) * CFG.TILE, r: 150, state: 'idle', t: 0, wave: 0, killed: 0, spawned: 0, need: 0 }; }
    const far = floors.filter(i => distMap[i] > 12);
    for (let s = 0; s < 2; s++) { const si = far[Math.floor(rng() * far.length)]; this.shrines.push({ x: (si % W + 0.5) * CFG.TILE, y: (((si / W) | 0) + 0.5) * CFG.TILE, type: choice(['power', 'haste', 'life', 'crit', 'protect']), used: false, t: 0 }); }
    this.explored = new Uint8Array(W * H);
    this.renderFloor(rng);
    this.decalCanvas = document.createElement('canvas'); this.decalCanvas.width = W * CFG.TILE; this.decalCanvas.height = H * CFG.TILE; this.decalCtx = this.decalCanvas.getContext('2d');
    // 스폰
    this.spawnPacks(floors, distMap, rng);
    this.boss = this.spawnMonster(this.theme.boss, bx, by, 'normal', { level: this.level + 2 });
    this.monsterTotal = this.monsters.length;
    p.x = this.startX; p.y = this.startY; p.vx = p.vy = 0;
    this.rebuildGrid();
  },
  bfs(startI) {
    const W = this.w, H = this.h; const d = new Int32Array(W * H).fill(-1); d[startI] = 0; const q = [startI]; let qi = 0;
    while (qi < q.length) { const c = q[qi++]; const cx = c % W, cy = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (!this.tiles[ni] && d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); } } }
    return d;
  },
  clearArea(cx, cy, r) { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { if (x < 2 || y < 2 || x >= this.w - 2 || y >= this.h - 2) continue; if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.tiles[y * this.w + x] = 0; } },
  renderFloor(rng) {
    const T = CFG.TILE, W = this.w, H = this.h, th = this.theme;
    const c = document.createElement('canvas'); c.width = W * T; c.height = H * T; const ctx = c.getContext('2d');
    ctx.fillStyle = th.wall; ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!this.tiles[i]) {
        ctx.fillStyle = th.floor[Math.floor(rng() * th.floor.length)]; ctx.fillRect(x * T, y * T, T, T);
        // 미세 질감
        ctx.fillStyle = 'rgba(0,0,0,' + (rng() * 0.12).toFixed(2) + ')'; ctx.fillRect(x * T + rng() * 20, y * T + rng() * 20, 6 + rng() * 10, 4 + rng() * 8);
        if (rng() < 0.025) this.drawDecor(ctx, x * T + T / 2, y * T + T / 2, rng);
      }
    }
    // 벽 윗면 / 테두리
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!this.tiles[y * W + x]) continue;
      // 벽 내부 질감
      ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + rng() * 0.03).toFixed(3) + ')'; ctx.fillRect(x * T + rng() * 20, y * T + rng() * 20, 4 + rng() * 10, 3 + rng() * 6);
      const below = y + 1 < H && !this.tiles[(y + 1) * W + x];
      const above = y - 1 >= 0 && !this.tiles[(y - 1) * W + x];
      const left = x - 1 >= 0 && !this.tiles[y * W + x - 1];
      const right = x + 1 < W && !this.tiles[y * W + x + 1];
      if (below || above || left || right) {
        ctx.fillStyle = th.wallTop; ctx.fillRect(x * T, y * T, T, T);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 3; k++) ctx.fillRect(x * T + rng() * 24, y * T + rng() * 24, 4 + rng() * 8, 3 + rng() * 6);
        if (below) { ctx.fillStyle = th.wall; ctx.fillRect(x * T, y * T + T - 8, T, 8); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x * T, y * T + T - 3, T, 3); }
        if (above) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x * T, y * T, T, 3); }
      }
    }
    this.floorCanvas = c;
  },
  drawDecor(ctx, x, y, rng) {
    const th = this.theme; ctx.save(); ctx.translate(x, y);
    switch (th.decor) {
      case 'tree': ctx.fillStyle = '#0f1a0d'; ctx.beginPath(); ctx.arc(0, 0, 8 + rng() * 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1f3a1a'; ctx.beginPath(); ctx.arc(-2, -2, 5 + rng() * 4, 0, Math.PI * 2); ctx.fill(); break;
      case 'grave': ctx.fillStyle = '#4a4046'; ctx.fillRect(-5, -8, 10, 14); ctx.fillStyle = '#5c5058'; ctx.beginPath(); ctx.arc(0, -8, 5, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#2a2226'; ctx.fillRect(-1, -6, 2, 8); ctx.fillRect(-3, -3, 6, 2); break;
      case 'pillar': ctx.fillStyle = '#5a4d70'; ctx.fillRect(-6, -12, 12, 20); ctx.fillStyle = '#7a6a92'; ctx.fillRect(-7, -14, 14, 4); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(2, -12, 4, 20); break;
      case 'crystal': ctx.fillStyle = '#3a6aaa'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 2); ctx.lineTo(0, 6); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#8ab8ff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(2, -2); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill(); break;
      case 'lava': ctx.fillStyle = '#c1440e'; ctx.beginPath(); ctx.ellipse(0, 0, 10 + rng() * 6, 6 + rng() * 4, rng() * 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(1, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill(); break;
    }
    ctx.restore();
  },
  spawnPacks(floors, distMap, rng) {
    const mm = this.mapMods;
    const packCount = Math.round(floors.length / 110 * (mm.packMult || 1));
    const cand = floors.filter(i => distMap[i] > 22);
    const pool = this.monsterPool();
    for (let k = 0; k < packCount; k++) {
      const i = cand[Math.floor(rng() * cand.length)];
      const cx = (i % this.w + 0.5) * CFG.TILE, cy = (((i / this.w) | 0) + 0.5) * CFG.TILE;
      const roll = rng();
      const rareP = 0.12 * (mm.rareMult || 1), magicP = 0.22 * (mm.magicMult || 1);
      const kind = roll < rareP ? 'rare' : roll < rareP + magicP ? 'magic' : 'normal';
      const type = pool[Math.floor(rng() * pool.length)];
      const n = kind === 'rare' ? 3 + Math.floor(rng() * 3) : kind === 'magic' ? 3 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 4);
      for (let j = 0; j < n; j++) {
        const a = rng() * Math.PI * 2, rr = 20 + rng() * 60;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const t = rng() < 0.75 ? type : pool[Math.floor(rng() * pool.length)];
        const rar = kind === 'rare' ? (j === 0 ? 'rare' : 'normal') : kind === 'magic' ? 'magic' : 'normal';
        this.spawnMonster(t, x, y, rar, { level: this.level + Math.floor(rng() * 3) });
      }
    }
  },
  monsterPool() { const pool = this.theme.monsters.filter(t => (MON_TYPES[t].minTier || 1) <= this.tier); return pool.length ? pool : ['ghoul', 'bat']; },
  spawnMonster(typeId, x, y, rarity, opts = {}) {
    if (this.wallAtCircle(x, y, 8)) { // 근처 바닥 찾기
      let ok = false;
      for (let k = 0; k < 12; k++) { const a = rand(Math.PI * 2), r = rand(10, 60); const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (!this.wallAtCircle(nx, ny, 8)) { x = nx; y = ny; ok = true; break; } }
      if (!ok) return null;
    }
    const m = new Monster(typeId, x, y, opts.level || this.level, rarity, opts);
    this.monsters.push(m); return m;
  },
  // ---------- 충돌 ----------
  isWall(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true; return this.tiles[ty * this.w + tx] === 1; },
  wallAt(x, y) { return this.isWall(Math.floor(x / CFG.TILE), Math.floor(y / CFG.TILE)); },
  wallAtCircle(x, y, r) {
    const T = CFG.TILE; const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!this.isWall(tx, ty)) continue;
      const cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T);
      if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) return true;
    }
    return false;
  },
  moveEntity(e, dx, dy) {
    if (dx && !this.wallAtCircle(e.x + dx, e.y, e.r)) e.x += dx;
    if (dy && !this.wallAtCircle(e.x, e.y + dy, e.r)) e.y += dy;
  },
  lineClear(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2); const steps = Math.ceil(d / 12);
    for (let i = 1; i < steps; i++) { const t = i / steps; if (this.wallAt(lerp(x1, x2, t), lerp(y1, y2, t))) return false; }
    return true;
  },
  rebuildGrid() {
    this.grid.clear();
    for (const m of this.monsters) { if (!m.alive) continue; const k = ((m.x / this.cell) | 0) * 4096 + ((m.y / this.cell) | 0); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(m); }
  },
  monstersNear(x, y, r) {
    const out = []; const c0x = ((x - r) / this.cell) | 0, c1x = ((x + r) / this.cell) | 0, c0y = ((y - r) / this.cell) | 0, c1y = ((y + r) / this.cell) | 0;
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) { const a = this.grid.get(cx * 4096 + cy); if (a) for (const m of a) out.push(m); }
    return out;
  },
  // ---------- 효과 ----------
  addZone(z) { this.zones.push(z); },
  burst(x, y, color, n, speed, life, opts = {}) {
    for (let i = 0; i < n; i++) { const a = rand(Math.PI * 2), s = rand(speed * 0.3, speed); this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(life * 0.5, life), color, rand(2, 5), opts)); }
  },
  splat(x, y, color, size) {
    if (!this.decalCtx) return; const ctx = this.decalCtx; ctx.fillStyle = hexA(color, 0.55);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + rand(-size, size), y + rand(-size, size), rand(size * 0.3, size * 0.8), 0, Math.PI * 2); ctx.fill(); }
  },
  // ---------- 드롭 ----------
  rollRarity(iir, minOrder = 0) {
    const w = [['normal', 55], ['magic', 32], ['rare', 11 * iir], ['unique', 1.1 * iir]].filter(x => RARITY[x[0]].order >= minOrder);
    return weightedChoice(w, x => x[1])[0];
  },
  spawnDrop(kind, data, x, y) { const d = new Drop(kind, data, x, y); this.drops.push(d); return d; },
  randomGem(level) {
    const support = chance(0.45);
    const id = support ? choice(SUPPORT_IDS) : choice(GEM_IDS);
    return makeGem(id, clamp(1 + Math.floor(level / 6), 1, 10), support);
  },
  dropLoot(mon) {
    if (mon.noLoot) return;
    const bm = Clock.bloodMoon ? 0.3 : 0;
    const iiq = 1 + this.iiq / 100 + bm, iir = 1 + this.iir / 100 + bm;
    let items = 0, cur = 0, gems = 0, minOrder = 0, uniq = 0;
    if (mon.boss) { items = 5; cur = 3; gems = 1; minOrder = 1; uniq = chance(0.45) ? 1 : 0; }
    else if (mon.typeId === 'rival') { items = 2; cur = 2; gems = chance(0.5) ? 1 : 0; minOrder = 2; uniq = chance(0.15) ? 1 : 0; }
    else if (mon.rarity === 'rare') { items = 2 + (chance(0.5) ? 1 : 0) + (chance(iiq - 1) ? 1 : 0); cur = 1 + (chance(0.5 * iiq) ? 1 : 0); gems = chance(0.15 * iiq) ? 1 : 0; minOrder = 1; }
    else if (mon.rarity === 'magic') { items = 1 + (chance(0.35 * iiq) ? 1 : 0); cur = chance(0.3 * iiq) ? 1 : 0; gems = chance(0.04 * iiq) ? 1 : 0; }
    else { items = chance(0.20 * iiq) ? 1 : 0; cur = chance(0.085 * iiq) ? 1 : 0; gems = chance(0.013 * iiq) ? 1 : 0; }
    if (mon.isSplit) { items = 0; cur = chance(0.05) ? 1 : 0; gems = 0; }
    const ilvl = mon.level + (mon.rarity === 'rare' ? 2 : 0) + (mon.boss ? 4 : 0);
    for (let i = 0; i < items; i++) {
      let rar = this.rollRarity(iir, i === 0 ? minOrder : 0);
      if (mon.boss && i < 2) rar = 'rare';
      this.spawnDrop('item', makeItem(choice(ITEM_SLOTS), ilvl, rar), mon.x, mon.y);
    }
    for (let i = 0; i < uniq; i++) this.spawnDrop('item', makeItem(choice(ITEM_SLOTS), ilvl, 'unique'), mon.x, mon.y);
    for (let i = 0; i < cur; i++) { const id = weightedChoice(CURRENCY_IDS.filter(c => CURRENCY[c].w > 0), c => CURRENCY[c].w * (mon.boss && c === 'exalt' ? 4 : 1)); this.spawnDrop('currency', { id, n: 1 }, mon.x, mon.y); }
    for (let i = 0; i < gems; i++) this.spawnDrop('gem', this.randomGem(mon.level), mon.x, mon.y);
    if (mon.boss && chance(0.5)) this.spawnDrop('aspect', choice(Object.keys(ASPECTS)), mon.x, mon.y);
  },
  pickup(drop) {
    const p = Game.player;
    if (drop.kind === 'item') { if (!p.addItem(drop.data)) { Game.flash('인벤토리가 가득 찼습니다'); return false; } Audio_.play('pickup'); }
    else if (drop.kind === 'currency') { p.addCurrency(drop.data.id, drop.data.n); Audio_.play('currency'); Game.flash(`${CURRENCY[drop.data.id].name} 획득`, CURRENCY[drop.data.id].color); }
    else if (drop.kind === 'gem') { p.gemBag.push(drop.data); Audio_.play('currency'); Game.flash(`${gemDef(drop.data).name} 젬 획득`, gemDef(drop.data).color); }
    else if (drop.kind === 'aspect') { p.aspects.push(drop.data); Audio_.play('currency'); Game.flash(`형상 획득: ${ASPECTS[drop.data].name}`, LEGENDARY_COLOR); }
    drop.alive = false; return true;
  },
  // ---------- 업데이트 ----------
  update(dt) {
    if (!this.active) return; this.time += dt;
    const p = Game.player;
    this.rebuildGrid();
    for (const m of this.monsters) m.update(dt);
    this.monsters = this.monsters.filter(m => m.alive || m.deathT > 0);
    for (const pr of this.projectiles) pr.update(dt); this.projectiles = this.projectiles.filter(x => x.alive);
    for (const mn of this.minions) mn.update(dt); this.minions = this.minions.filter(x => x.alive);
    this.updateZones(dt);
    for (const pt of this.particles) pt.update(dt); if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600); this.particles = this.particles.filter(x => x.alive);
    for (const d of this.dmgNums) d.update(dt); this.dmgNums = this.dmgNums.filter(x => x.alive);
    for (const d of this.drops) { d.update(dt); if (d.kind !== 'item' && dist(d.x, d.y, p.x, p.y) < 26) this.pickup(d); }
    this.drops = this.drops.filter(x => x.alive);
    // 탐색
    this.exploreT += dt; if (this.exploreT > 0.15) { this.exploreT = 0; const tx = Math.floor(p.x / CFG.TILE), ty = Math.floor(p.y / CFG.TILE); for (let y = ty - 11; y <= ty + 11; y++) for (let x = tx - 11; x <= tx + 11; x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h && (x - tx) ** 2 + (y - ty) ** 2 <= 121) this.explored[y * this.w + x] = 1; }
    this.updateRift(dt); this.updateShrines(dt); this.updatePortal(dt); this.updateRival(dt);
    if (this.boss && this.boss.alive && this.boss.aggro && !this.bossAnnounced) { this.bossAnnounced = true; Audio_.play('boss'); Game.announce(`⚠ ${this.boss.name}이(가) 나타났다!`, '#ff3b3b', 3); }
  },
  updateZones(dt) {
    const p = Game.player;
    for (const z of this.zones) {
      z.t += dt;
      switch (z.type) {
        case 'telegraph':
          if (z.t >= z.dur) {
            z.dead = true;
            if (z.owner === 'monster') { if (dist(z.x, z.y, p.x, p.y) < z.r + p.r) Combat.damagePlayer(z.dmg, z.dmgType, { attack: false, src: z.src, cause: z.label }); this.burst(z.x, z.y, z.color, 22, 220, 0.5); this.addZone({ type: 'ring', x: z.x, y: z.y, r: z.r, t: 0, dur: 0.3, color: z.color }); Audio_.play('explode'); }
            else if (z.onDone) z.onDone(z);
          }
          break;
        case 'ground':
          z.tickT += dt;
          if (z.tickT >= z.tick) {
            z.tickT = 0;
            if (z.owner === 'player') { for (const m of this.monstersNear(z.x, z.y, z.r + 30)) if (m.alive && dist(z.x, z.y, m.x, m.y) < z.r + m.r) { Combat.hitMonster(m, z.skill, {}); if (z.slow) m.chill = Math.max(m.chill, 0.6); } }
            else if (dist(z.x, z.y, p.x, p.y) < z.r + p.r) { Combat.damagePlayer(z.dmg, z.dmgType, { attack: false, src: z.src, cause: z.label || '지면 효과' }); if (z.slow) p.chill = Math.max(p.chill, 0.6); }
          }
          if (Math.random() < dt * 8) this.particles.push(new Particle(z.x + rand(-z.r, z.r) * 0.8, z.y + rand(-z.r, z.r) * 0.8, 0, -30, 0.6, z.color, 3));
          if (z.t >= z.dur) z.dead = true;
          break;
        case 'storm':
          z.next -= dt;
          if (z.next <= 0 && z.strikes > 0) {
            z.next = z.dur / (z.strikes + 1); z.strikes--;
            const a = rand(Math.PI * 2), rr = rand(0, z.r); const sx = z.x + Math.cos(a) * rr, sy = z.y + Math.sin(a) * rr;
            this.addZone({ type: 'strike', x: sx, y: sy, r: z.strikeR, t: 0, dur: 0.25, color: z.color });
            Combat.areaHit(sx, sy, z.strikeR, z.skill, {}); Audio_.play('crit');
          }
          if (z.t >= z.dur) z.dead = true;
          break;
        case 'tornado': {
          const a = angleTo(z.x, z.y, p.x, p.y) + Math.sin(z.t * 2) * 1.2;
          z.x += Math.cos(a) * 90 * dt; z.y += Math.sin(a) * 90 * dt;
          z.tickT += dt; if (z.tickT >= z.tick) { z.tickT = 0; if (dist(z.x, z.y, p.x, p.y) < z.r + p.r) { Combat.damagePlayer(z.dmg, z.dmgType, { attack: false, src: z.src }); p.chill = Math.max(p.chill, 1); } }
          if (Math.random() < dt * 10) this.particles.push(new Particle(z.x + rand(-z.r, z.r), z.y + rand(-z.r, z.r), rand(-40, 40), -60, 0.5, z.color, 3));
          if (z.t >= z.dur) z.dead = true; break;
        }
        case 'beamwarn':
          if (z.t >= z.dur) {
            z.dead = true;
            const dx = Math.cos(z.a), dy = Math.sin(z.a); const rel = (p.x - z.x) * dx + (p.y - z.y) * dy;
            if (rel > 0 && rel < z.len) { const perp = Math.abs(-(p.x - z.x) * dy + (p.y - z.y) * dx); if (perp < z.w / 2 + p.r) Combat.damagePlayer(z.dmg, z.dmgType, { attack: false, src: z.src }); }
            this.addZone({ type: 'beam', x: z.x, y: z.y, x2: z.x + dx * z.len, y2: z.y + dy * z.len, t: 0, dur: 0.35, color: z.color, w: z.w });
            Audio_.play('explode'); Game.shake(6);
          }
          break;
        default: if (z.t >= z.dur) z.dead = true;
      }
    }
    this.zones = this.zones.filter(z => !z.dead);
  },
  updateRift(dt) {
    const r = this.rift; if (!r || r.state === 'done') return;
    const p = Game.player; const inside = dist(r.x, r.y, p.x, p.y) < r.r;
    if (r.state === 'idle') { if (inside) { r.state = 'active'; r.t = 0; r.wave = 0; r.killed = 0; r.spawned = 0; Game.announce('⚡ 균열 이벤트 시작! 30초간 버텨라', '#c77dff', 3); Audio_.play('boss'); } return; }
    if (r.state === 'active') {
      r.t += dt;
      const waveDue = Math.floor(r.t / 5) + 1;
      while (r.wave < waveDue && r.wave < 6) {
        r.wave++;
        const n = 4 + r.wave;
        for (let i = 0; i < n; i++) { const a = rand(Math.PI * 2); const m = this.spawnMonster(choice(this.monsterPool()), r.x + Math.cos(a) * (r.r + 40), r.y + Math.sin(a) * (r.r + 40), r.wave === 6 ? 'rare' : chance(0.25) ? 'magic' : 'normal', { level: this.level + 1, riftMon: true, aggro: true }); if (m) r.spawned++; }
        this.burst(r.x, r.y, '#c77dff', 20, 200, 0.6);
      }
      if (r.t >= 30) {
        r.state = 'done'; Game.announce('균열 완료! 보상이 떨어진다', '#c77dff', 3); Audio_.play('shrine');
        const ilvl = this.level + 3;
        for (let i = 0; i < 3; i++) this.spawnDrop('item', makeItem(choice(ITEM_SLOTS), ilvl, this.rollRarity(1 + this.iir / 100 + 0.5, 1)), r.x, r.y);
        for (let i = 0; i < 3; i++) this.spawnDrop('currency', { id: weightedChoice(CURRENCY_IDS.filter(c => CURRENCY[c].w > 0), c => CURRENCY[c].w), n: 1 }, r.x, r.y);
        this.spawnDrop('gem', this.randomGem(this.level + 3), r.x, r.y);
        for (const m of this.monsters) if (m.riftMon && m.alive) Combat.killMonster(m, { noProc: true });
      }
    }
  },
  updateShrines(dt) {
    const p = Game.player;
    for (const s of this.shrines) {
      s.t += dt; if (s.used) continue;
      if (dist(s.x, s.y, p.x, p.y) < 30) {
        s.used = true; Audio_.play('shrine');
        const B = { power: { name: '힘의 제단', mods: { inc_dmg: 0.5 }, icon: '⚔', color: '#ff5c5c' }, haste: { name: '신속의 제단', mods: { inc_aspd: 0.3, inc_cspd: 0.3, inc_move: 0.2 }, icon: '≫', color: '#f0d78c' }, life: { name: '생명의 제단', mods: { inc_regen: 3, inc_life: 0.2 }, icon: '♥', color: '#9fe1a5' }, crit: { name: '치명의 제단', mods: { inc_crit: 1.0, crit_multi: 0.3 }, icon: '✦', color: '#ffffff' }, protect: { name: '수호의 제단', mods: { inc_armor: 1, all_res: 20 }, icon: '🛡', color: '#7b9bff', dmgTaken: 0.6 } }[s.type];
        p.addBuff({ id: 'shrine_' + s.type, name: B.name, t: 40, mods: B.mods, icon: B.icon, color: B.color, dmgTaken: B.dmgTaken });
        Game.announce(`${B.name}의 축복 (40초)`, B.color); this.burst(s.x, s.y, B.color, 30, 200, 0.8);
      }
    }
  },
  onBossKilled(mon) {
    const p = Game.player; p.bossKills++;
    Game.announce(`${mon.name} 처치! 포탈이 열렸다`, '#ffd23f', 4); Audio_.play('shrine'); Game.shake(12);
    this.portal = { x: mon.x, y: mon.y, t: 0 };
    if (this.tier >= p.maxTier) { p.maxTier = this.tier + 1; Game.announce(`지도 티어 ${p.maxTier} 해금!`, '#9fe1a5', 4); }
    if (this.tier % 5 === 0 && !p['tierBonus' + this.tier]) { p['tierBonus' + this.tier] = true; p.bonusPoints++; Game.announce('보너스 패시브 포인트 +1', '#ffd23f'); }
    p.potion.charges = p.stats.potionCharges;
  },
  updatePortal(dt) {
    if (!this.portal) return; this.portal.t += dt;
    const p = Game.player;
    if (Math.random() < dt * 20) { const a = rand(Math.PI * 2); this.particles.push(new Particle(this.portal.x + Math.cos(a) * 30, this.portal.y + Math.sin(a) * 30, -Math.cos(a) * 30, -Math.sin(a) * 30 - 20, 0.8, '#7b9bff', 3)); }
    if (this.portal.t > 1 && dist(this.portal.x, this.portal.y, p.x, p.y) < 30) Game.mapCleared();
  },
  updateRival(dt) {
    const p = Game.player;
    if (!Clock.isNight() || this.tier < 2) return;
    if (this.monsters.some(m => m.alive && m.typeId === 'rival')) return;
    this.rivalTimer -= dt; if (this.rivalTimer > 0) return;
    this.rivalTimer = 60;
    for (let k = 0; k < 20; k++) {
      const a = rand(Math.PI * 2), r = rand(420, 560); const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (!this.wallAtCircle(x, y, 14)) {
        const m = this.spawnMonster('rival', x, y, 'rare', { level: this.level + 2, rivalCls: CLASSES[p.cls].rival, aggro: true });
        if (m) { Game.announce(`⚔ ${m.name}이(가) 당신을 사냥하러 왔다!`, m.color, 4); Audio_.play('boss'); }
        break;
      }
    }
  },
};
