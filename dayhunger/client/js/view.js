// 클라이언트 쪽 월드 미러. 솔로/협동 모두 서버(또는 로컬 Game)가 보내는 full/delta를 적용해 그립니다.
import * as C from '../../shared/constants.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

export class View {
  constructor() { this.reset(); }
  reset() {
    this.w = 0; this.h = 0;
    this.tiles = new Uint8Array(0); this.tileHp = new Uint16Array(0); this.tilesVersion = 0;
    this.players = []; this.enemies = []; this.ent = new Map();
    this.particles = []; this.shots = []; this.log = [];
    this.t = 0; this.day = 1; this.phase = 'day'; this.cycleT = 0;
    this.over = false; this.won = false; this.endless = false; this.score = 0; this.kills = 0; this.pending = 0;
    this.updateAt = 0; this.interval = 100; this.ready = false;
    this.onEvent = null;
  }
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
    if (d.fx) for (const f of d.fx) this.spawnFx(f, tNow);
    if (d.events) for (const e of d.events) this.handleEvent(e);
  }
  applyDynamic(d, snap) {
    this.t = d.t; this.day = d.day; this.phase = d.phase; this.cycleT = d.cycleT;
    this.over = d.over; this.won = d.won; this.endless = d.endless; this.score = d.score; this.kills = d.kills; this.pending = d.pending;
    this.players = d.players; this.enemies = d.enemies;
    const tNow = now();
    if (this.updateAt) this.interval = clamp(tNow - this.updateAt, 30, 300);
    this.updateAt = tNow;
    const seen = new Set();
    const track = (e) => {
      seen.add(e.id);
      let r = this.ent.get(e.id);
      if (!r || snap) { r = { px: e.x, py: e.y, x: e.x, y: e.y }; this.ent.set(e.id, r); return; }
      // 순간이동(부활 등)이면 보간하지 않음
      if (Math.hypot(e.x - r.x, e.y - r.y) > 3) { r.px = e.x; r.py = e.y; } else { r.px = r.x; r.py = r.y; }
      r.x = e.x; r.y = e.y;
    };
    for (const p of this.players) track(p);
    for (const e of this.enemies) track(e);
    for (const id of this.ent.keys()) if (!seen.has(id)) this.ent.delete(id);
  }
  // 보간된 위치
  pos(e) {
    const r = this.ent.get(e.id);
    if (!r) return { x: e.x, y: e.y };
    const a = clamp((now() - this.updateAt) / this.interval, 0, 1);
    return { x: r.px + (r.x - r.px) * a, y: r.py + (r.y - r.py) * a };
  }
  me(id) { return this.players.find((p) => p.id === id) || null; }
  tileAt(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.tiles[y * this.w + x] : C.T.WATER; }

  spawnFx(f, tNow) {
    const P = this.particles;
    const burst = (n, color, speed, life, size) => {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
        P.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, born: tNow, life, color, size });
      }
    };
    switch (f.k) {
      case 'hit': burst(4, '#c9a15a', 2.5, 350, 0.08); break;
      case 'gain': P.push({ x: f.x, y: f.y - 0.3, vx: 0, vy: -0.8, born: tNow, life: 900, text: `+${f.n} ${C.RES_ICON[f.res] || ''}`, color: '#fff' }); break;
      case 'blood': burst(5, '#c62828', 3, 300, 0.09); break;
      case 'crack': burst(4, '#9e9e9e', 2, 300, 0.08); break;
      case 'hurt': burst(6, '#ff5252', 3, 350, 0.1); P.push({ x: f.x, y: f.y - 0.5, vx: 0, vy: -0.8, born: tNow, life: 600, text: '!', color: '#ff5252' }); break;
      case 'eat': P.push({ x: f.x, y: f.y - 0.5, vx: 0, vy: -0.7, born: tNow, life: 800, text: '🍎', color: '#fff' }); break;
      case 'repair': P.push({ x: f.x, y: f.y - 0.3, vx: 0, vy: -0.7, born: tNow, life: 700, text: '🔧', color: '#8f8' }); break;
      case 'death': burst(16, '#ef5350', 4, 700, 0.14); break;
      default: break;
    }
  }
  handleEvent(e) {
    let line = null;
    switch (e.type) {
      case 'night': line = `🌙 ${e.day}일째 밤 — 적 ${e.count}마리가 몰려옵니다!`; break;
      case 'dawn': line = `🌞 ${e.day}일째 아침 — 보급 🪵${e.bonus.wood} 🪨${e.bonus.stone} 🍎${e.bonus.food}`; break;
      case 'kill': if (e.kind === 'BOSS') line = '👑 괴수를 쓰러뜨렸다!'; break;
      case 'death': line = `💀 ${e.name} 쓰러짐`; break;
      case 'destroyed': line = `💥 ${C.TILE_NAMES[e.tile] || '건물'} 파괴됨`; break;
      case 'join': line = `👋 ${e.name} 합류`; break;
      case 'leave': line = `🚪 ${e.name} 나감`; break;
      case 'chat': line = `💬 ${e.name}: ${e.msg}`; break;
      case 'win': line = '🏆 10일째 아침! 살아남았다!'; break;
      case 'gameover': line = '☠️ 모두 쓰러졌다…'; break;
      default: break;
    }
    if (line) { this.log.push({ text: line, born: now() }); if (this.log.length > 6) this.log.shift(); }
    if (this.onEvent) this.onEvent(e);
  }
  // 오래된 효과 정리 (렌더러가 프레임마다 호출)
  prune(tNow) {
    this.particles = this.particles.filter((p) => tNow - p.born < p.life);
    this.shots = this.shots.filter((s) => tNow - s.born < 120);
    this.log = this.log.filter((l) => tNow - l.born < 6000);
  }
  darkness() {
    // 0(낮) ~ 0.7(밤). 낮의 처음/끝 10%에서 서서히 바뀜
    const N = 0.7;
    if (this.phase === 'night') {
      const t = this.cycleT / C.NIGHT_TICKS;
      return t > 0.92 ? N * (1 - (t - 0.92) / 0.08) * 0.5 + N * 0.5 : N;
    }
    const t = this.cycleT / C.DAY_TICKS;
    if (t < 0.08) return this.day > 1 ? N * (1 - t / 0.08) : 0; // 첫날 아침은 바로 밝게
    if (t > 0.9) return N * ((t - 0.9) / 0.1);
    return 0;
  }
}
