// 클라이언트 쪽 월드 미러. 솔로/협동 모두 서버(또는 로컬 Game)가 보내는 full/delta를 적용해 그립니다.
import * as C from '../../shared/constants.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const SWING_MS = 350;

export class View {
  constructor() { this.reset(); }
  reset() {
    this.w = 0; this.h = 0;
    this.tiles = new Uint8Array(0); this.tileHp = new Uint16Array(0); this.tilesVersion = 0;
    this.players = []; this.enemies = []; this.projs = []; this.ent = new Map();
    this.particles = []; this.shots = []; this.log = []; this.shakes = new Map(); this.swings = new Map();
    this.t = 0; this.day = 1; this.phase = 'day'; this.cycleT = 0;
    this.map = C.DEFAULT_MAP; this.difficulty = C.DEFAULT_DIFFICULTY; this.winDay = 10;
    this.dayTicks = C.MAPS[C.DEFAULT_MAP].dayTicks; this.nightTicks = C.MAPS[C.DEFAULT_MAP].nightTicks;
    this.over = false; this.won = false; this.endless = false; this.score = 0; this.kills = 0; this.pending = 0;
    this.updateAt = 0; this.interval = 100; this.ready = false;
    this.shakeMag = 0; this.shakeUntil = 0; this.hurts = [];
    this.nextWave = null;
    this.onEvent = null; this.onFx = null;
  }
  shake(mag, ms) { const t = now(); this.shakeMag = Math.max(this.shakeMag * (this.shakeUntil > t ? 1 : 0), mag); this.shakeUntil = Math.max(this.shakeUntil, t + ms); }
  shakeNow() { const t = now(); if (t >= this.shakeUntil) return 0; return this.shakeMag * ((this.shakeUntil - t) / 400); }
  get mapDef() { return C.MAPS[this.map] || C.MAPS[C.DEFAULT_MAP]; }
  applyFull(f) {
    this.w = f.w; this.h = f.h;
    this.tiles = Uint8Array.from(f.tiles); this.tileHp = Uint16Array.from(f.tileHp); this.tilesVersion++;
    this.ready = true;
    this.applyDynamic(f, true);
  }
  applyDelta(d) {
    if (!this.ready) return;
    if (d.tiles && d.tiles.length) {
      for (const [i, t, hp] of d.tiles) { this.tiles[i] = t; this.tileHp[i] = hp; }
      this.tilesVersion++;
    }
    this.applyDynamic(d, false);
    const tNow = now();
    if (d.shots) for (const s of d.shots) this.shots.push({ ...s, born: tNow });
    if (d.shots && d.shots.length && this.onFx) this.onFx({ k: 'shot' });
    if (d.fx) for (const f of d.fx) this.spawnFx(f, tNow);
    if (d.events) for (const e of d.events) this.handleEvent(e);
  }
  applyDynamic(d, snap) {
    this.t = d.t; this.day = d.day; this.phase = d.phase; this.cycleT = d.cycleT;
    this.map = d.map || this.map; this.difficulty = d.difficulty || this.difficulty; this.winDay = d.winDay || this.winDay;
    this.dayTicks = d.dayTicks || this.dayTicks; this.nightTicks = d.nightTicks || this.nightTicks;
    this.over = d.over; this.won = d.won; this.endless = d.endless; this.score = d.score; this.kills = d.kills; this.pending = d.pending;
    if (d.nextWave) this.nextWave = d.nextWave;
    const tNow = now();
    // 휘두르기 시작 감지 (swing 값이 커지면 새 동작)
    for (const p of d.players) {
      const prev = this.players.find((q) => q.id === p.id);
      if (p.swing > 0 && (!prev || p.swing > prev.swing)) this.swings.set(p.id, { start: tNow - (7 - p.swing) * (1000 / C.TICK_RATE), kind: p.swingKind });
    }
    this.players = d.players; this.enemies = d.enemies; this.projs = d.projs || [];
    if (this.updateAt) this.interval = clamp(tNow - this.updateAt, 30, 300);
    this.updateAt = tNow;
    const seen = new Set();
    const track = (e) => {
      seen.add(e.id);
      let r = this.ent.get(e.id);
      if (!r || snap) { r = { px: e.x, py: e.y, x: e.x, y: e.y }; this.ent.set(e.id, r); return; }
      if (Math.hypot(e.x - r.x, e.y - r.y) > 3) { r.px = e.x; r.py = e.y; } else { r.px = r.x; r.py = r.y; }
      r.x = e.x; r.y = e.y;
    };
    for (const p of this.players) track(p);
    for (const e of this.enemies) track(e);
    for (const pr of this.projs) track(pr);
    for (const id of this.ent.keys()) if (!seen.has(id)) this.ent.delete(id);
  }
  pos(e) {
    const r = this.ent.get(e.id);
    if (!r) return { x: e.x, y: e.y };
    const a = clamp((now() - this.updateAt) / this.interval, 0, 1);
    return { x: r.px + (r.x - r.px) * a, y: r.py + (r.y - r.py) * a };
  }
  // 휘두르기 진행도 0~1 (없으면 null)
  swingOf(id) {
    const s = this.swings.get(id);
    if (!s) return null;
    const u = (now() - s.start) / SWING_MS;
    if (u >= 1) { this.swings.delete(id); return null; }
    return { u: Math.max(0, u), kind: s.kind };
  }
  shakeOf(i) {
    const t = this.shakes.get(i);
    if (t === undefined) return 0;
    const age = now() - t;
    if (age > 260) { this.shakes.delete(i); return 0; }
    return Math.sin(age / 22) * (1 - age / 260) * 0.08;
  }
  me(id) { return this.players.find((p) => p.id === id) || null; }
  tileAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.tiles[y * this.w + x] : C.T.WATER; }

  spawnFx(f, tNow) {
    const P = this.particles;
    const burst = (n, color, speed, life, size, gravity = 0) => {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
        P.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - gravity * 0.5, born: tNow, life, color, size, g: gravity });
      }
    };
    const text = (t, color, dy = -0.3, life = 900) => P.push({ x: f.x, y: f.y + dy, vx: 0, vy: -0.8, born: tNow, life, text: t, color });
    const CHIP = { tree: '#c9a15a', rock: '#9e9e9e', plant: '#66bb6a', fish: '#90caf9' };
    switch (f.k) {
      case 'hit': if (f.tile !== undefined) this.shakes.set(f.tile, tNow); burst(f.res === 'fish' ? 6 : 4, CHIP[f.res] || '#c9a15a', 2.8, 380, 0.07, f.res === 'fish' ? 0 : 3); break;
      case 'deplete': burst(f.res === 'tree' ? 10 : 6, CHIP[f.res] || '#c9a15a', 3.5, 600, 0.09, 3); break;
      case 'gain': text(`+${f.n} ${C.RES_ICON[f.res] || ''}`, '#fff'); break;
      case 'heal': text(`+${f.n} ❤️`, '#ff8a80', -0.6); break;
      case 'blood': burst(5, '#c62828', 3, 300, 0.09); break;
      case 'crack': if (f.tile !== undefined) this.shakes.set(f.tile, tNow); burst(4, '#9e9e9e', 2, 300, 0.08, 2); break;
      case 'hurt': burst(6, '#ff5252', 3, 350, 0.1); text('!', '#ff5252', -0.5, 600); this.hurts.push({ x: f.x, y: f.y, t: tNow }); if (this.hurts.length > 8) this.hurts.shift(); break;
      case 'spithit': burst(6, '#26a69a', 2.5, 350, 0.1); break;
      case 'eat': text('🍎', '#fff', -0.5, 800); break;
      case 'repair': text('🔧', '#8f8', -0.3, 700); break;
      case 'build': burst(8, '#d7ccc8', 2, 400, 0.08, 2); break;
      case 'death': burst(16, '#ef5350', 4, 700, 0.14); this.shake(0.35, 400); break;
      case 'revive': burst(14, '#fff59d', 3, 700, 0.1); text('부활!', '#fff59d', -0.8, 1200); break;
      case 'perk': burst(12, '#ce93d8', 2.5, 700, 0.09); break;
      case 'die': burst(f.big ? 18 : 8, '#6d4c41', f.big ? 4 : 2.5, 600, f.big ? 0.14 : 0.1, 2); break;
      case 'steal': text(`-${f.n} ${C.RES_ICON[f.res] || ''} 도둑!`, '#ffab40', -0.6, 1200); break;
      case 'explosion': burst(24, '#ff7043', 6, 700, 0.16); burst(12, '#ffd54f', 4, 500, 0.12); P.push({ x: f.x, y: f.y, vx: 0, vy: 0, born: tNow, life: 450, ring: f.r || 1.7, color: '#ffab40' }); this.shake(0.6, 400); break;
      case 'summon': burst(10, '#ab47bc', 3, 500, 0.1); break;
      case 'spitfx': burst(3, '#26a69a', 1.5, 250, 0.07); break;
      case 'poof': burst(3, '#cfd8dc', 1.5, 250, 0.06); break;
      default: break;
    }
    if (this.onFx) this.onFx(f);
  }
  handleEvent(e) {
    let line = null;
    const rn = (k) => `${C.RES_ICON[k] || ''}${C.RES_NAME[k] || k}`;
    switch (e.type) {
      case 'night': line = `🌙 ${e.day}일째 밤 — 적 ${e.count}마리${e.boss ? ' + 괴수 👑' : ''}`; break;
      case 'dawn': line = `🌞 ${e.day}일째 아침 — 보급 🪵${e.bonus.wood} 🪨${e.bonus.stone}${e.bonus.iron ? ` ⛓️${e.bonus.iron}` : ''} 🍎${e.bonus.food}`; break;
      case 'kill': if (e.kind === 'BOSS') line = '👑 괴수를 쓰러뜨렸다!'; else if (e.elite) line = `⭐ 정예 ${C.ENEMIES[e.kind]?.name || ''} 처치${e.by ? ` (${e.by})` : ''}`; break;
      case 'death': line = `💀 ${e.name} 쓰러짐`; break;
      case 'destroyed': line = `💥 ${C.TILE_NAMES[e.tile] || '건물'} 파괴됨`; break;
      case 'join': line = `👋 ${e.name}${e.cls && C.CLASSES[e.cls] ? ` (${C.CLASSES[e.cls].icon}${C.CLASSES[e.cls].name})` : ''} 합류`; break;
      case 'leave': line = `🚪 ${e.name} 나감`; break;
      case 'chat': line = `💬 ${e.name}: ${e.msg}`; break;
      case 'steal': line = `🦝 도둑이 ${e.name}의 ${rn(e.res)} ${e.n}을 훔쳐 달아난다!`; break;
      case 'recover': line = `🎒 ${e.name}이(가) 훔친 ${rn(e.res)} ${e.n}을 되찾음`; break;
      case 'explosion': line = '💣 폭탄병 폭발!'; break;
      case 'perk': line = `✨ ${e.name}: ${(C.PERKS[e.key] || {}).icon || ''} ${(C.PERKS[e.key] || {}).name || e.key}${e.level > 1 ? ` ${e.level}단계` : ''}`; break;
      case 'bossloot': line = `🎁 괴수 전리품! 모두에게 ⛓️${e.loot.iron} 🪨${e.loot.stone} 🍎${e.loot.food}`; break;
      case 'secondchance': line = `💫 ${e.name} 쓰러짐… 5초 뒤 부활`; break;
      case 'revive': line = `💫 ${e.name} 부활!`; break;
      case 'win': line = `🏆 ${this.winDay}일째 아침! 살아남았다!`; break;
      case 'gameover': line = '☠️ 모두 쓰러졌다…'; break;
      default: break;
    }
    if (line) { this.log.push({ text: line, born: now() }); if (this.log.length > 6) this.log.shift(); }
    if (this.onEvent) this.onEvent(e);
  }
  prune(tNow) {
    this.particles = this.particles.filter((p) => tNow - p.born < p.life);
    this.shots = this.shots.filter((s) => tNow - s.born < 120);
    this.log = this.log.filter((l) => tNow - l.born < 7000);
  }
  darkness() {
    const N = 0.7;
    if (this.phase === 'night') {
      const t = this.cycleT / this.nightTicks;
      return t > 0.92 ? N * (1 - (t - 0.92) / 0.08) * 0.5 + N * 0.5 : N;
    }
    const t = this.cycleT / this.dayTicks;
    if (t < 0.08) return this.day > 1 ? N * (1 - t / 0.08) : 0;
    if (t > 0.9) return N * ((t - 0.9) / 0.1);
    return 0;
  }
}
