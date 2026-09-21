// Canvas 2D 렌더러: 전장별 바닥, 타일·건물, 캐릭터(직업별 모자·도구·채집 모션), 적 종류별 생김새, 투사체, 밤 조명, 미니맵.
import * as C from '../../shared/constants.js';
const { T } = C;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
    return this;
  };
}
const MINI = {
  [T.TREE]: '#1f4d22', [T.PINE]: '#1b3f2a', [T.DEAD_TREE]: '#5b4636', [T.CACTUS]: '#4c8c3c', [T.ROCK]: '#7b7f85', [T.IRON_ORE]: '#a8743a',
  [T.BUSH]: '#3f8f3a', [T.MUSHROOM]: '#c62828', [T.HERB]: '#8bc34a', [T.LAVA]: '#ff5722',
  [T.WOOD_WALL]: '#a3703b', [T.STONE_WALL]: '#b7bcc4', [T.IRON_WALL]: '#78909c', [T.DOOR]: '#d9a24d', [T.TURRET]: '#f2c94c', [T.HEAVY_TURRET]: '#ffb300',
  [T.CAMPFIRE]: '#ff7a1a', [T.TORCH]: '#ffcc80', [T.SPIKES]: '#9e9e9e', [T.FARM]: '#6b4a2b', [T.FARM_RIPE]: '#b8d652',
  [T.STUMP]: '#5d4a33', [T.BUSH_EMPTY]: '#5f9a58', [T.MUSHROOM_EMPTY]: '#7a6a5a', [T.HERB_EMPTY]: '#6a8a4a',
};
const HATS = { SURVIVOR: 'band', LUMBERJACK: 'beanie', MINER: 'helmet', HUNTER: 'hood', COOK: 'chef', KNIGHT: 'knight', BUILDER: 'hardhat' };

export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.mini = minimap; this.mctx = minimap.getContext('2d');
    this.miniLayer = document.createElement('canvas'); this.miniVersion = -1;
    this.dark = document.createElement('canvas');
    this.zoom = 1;
    try { const z = parseFloat(localStorage.getItem('dh_zoom')); if (z > 0.5 && z < 2) this.zoom = z; } catch {}
    this.ts = 24; this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.dark.width = this.canvas.width; this.dark.height = this.canvas.height;
    this.baseTs = clamp(Math.floor(Math.min(this.W, this.H) / 16), 18, 40);
    this.ts = clamp(Math.round(this.baseTs * this.zoom), 12, 64);
  }
  setZoom(z) { this.zoom = clamp(z, 0.6, 1.8); this.ts = clamp(Math.round(this.baseTs * this.zoom), 12, 64); try { localStorage.setItem('dh_zoom', String(this.zoom)); } catch {} }
  screenToTile(sx, sy) {
    const ts = this.ts;
    return { tx: Math.floor((sx - this.W / 2) / ts + this.cam.x), ty: Math.floor((sy - this.H / 2) / ts + this.cam.y) };
  }
  worldToScreen(x, y) { return { sx: (x - this.cam.x) * this.ts + this.W / 2, sy: (y - this.cam.y) * this.ts + this.H / 2 }; }

  draw(view, myId, opts = {}) {
    const ctx = this.ctx, ts = this.ts, W = this.W, H = this.H;
    const tNow = performance.now();
    view.prune(tNow);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!view.ready) { ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, W, H); return; }
    const pal = view.mapDef;
    const me = view.me(myId);
    let cx = view.w / 2, cy = view.h / 2;
    if (me) { const p = view.pos(me); cx = p.x; cy = p.y; }
    const halfW = W / 2 / ts, halfH = H / 2 / ts;
    this.cam.x = view.w * ts > W ? clamp(cx, halfW, view.w - halfW) : view.w / 2;
    this.cam.y = view.h * ts > H ? clamp(cy, halfH, view.h - halfH) : view.h / 2;
    ctx.fillStyle = '#0b1a10'; ctx.fillRect(0, 0, W, H);
    // 화면 흔들림 (폭발·사망·내 근처 피격)
    let shake = view.shakeNow();
    if (me) for (const h of view.hurts) if (tNow - h.t < 300 && Math.hypot(h.x - cx, h.y - cy) < 3) shake = Math.max(shake, 0.2 * (1 - (tNow - h.t) / 300));
    const shx = shake ? (Math.random() - 0.5) * shake * ts : 0, shy = shake ? (Math.random() - 0.5) * shake * ts : 0;
    ctx.save();
    ctx.translate(W / 2 - this.cam.x * ts + shx, H / 2 - this.cam.y * ts + shy);
    const x0 = Math.max(0, Math.floor(this.cam.x - halfW) - 1), x1 = Math.min(view.w - 1, Math.ceil(this.cam.x + halfW) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y - halfH) - 1), y1 = Math.min(view.h - 1, Math.ceil(this.cam.y + halfH) + 1);
    // 바닥
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = view.tiles[y * view.w + x];
      const shade = (x * 7 + y * 13) % 3;
      if (t === T.WATER || t === T.WATER_EMPTY) ctx.fillStyle = pal.water;
      else if (t === T.LAVA) ctx.fillStyle = '#ff6d00';
      else if (t === T.MUD) ctx.fillStyle = pal.mud;
      else ctx.fillStyle = pal.ground[shade];
      ctx.fillRect(x * ts, y * ts, ts + 0.5, ts + 0.5);
      if (t === T.WATER || t === T.WATER_EMPTY) {
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.beginPath();
        const ph = (tNow / 600 + x + y) % 2;
        ctx.moveTo(x * ts + ts * 0.15, y * ts + ts * (0.3 + 0.1 * ph)); ctx.lineTo(x * ts + ts * 0.5, y * ts + ts * (0.3 + 0.1 * ph)); ctx.stroke();
        if (t === T.WATER && ((x * 31 + y * 17) % 5 === 0)) { // 물고기 그림자
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x * ts + ts * (0.5 + 0.2 * Math.sin(tNow / 700 + x)), y * ts + ts * 0.65, ts * 0.12, ts * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (t === T.LAVA) {
        ctx.fillStyle = `rgba(255,235,59,${0.25 + 0.2 * Math.sin(tNow / 300 + x * 2 + y)})`;
        ctx.beginPath(); ctx.arc(x * ts + ts * 0.5, y * ts + ts * 0.5, ts * 0.28, 0, Math.PI * 2); ctx.fill();
      } else if (t === T.MUD) {
        ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x * ts + ts * 0.5, y * ts + ts * 0.55, ts * 0.3, ts * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 건설 범위 표시
    if (opts.buildKey && me && me.alive) {
      const mx = Math.floor(me.x), my = Math.floor(me.y), r = (C.CLASSES[me.cls] && C.CLASSES[me.cls].buildRange) || C.BUILD_RANGE;
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect((mx - r) * ts, (my - r) * ts, (2 * r + 1) * ts, (2 * r + 1) * ts);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      for (let y = my - r; y <= my + r + 1; y++) { ctx.beginPath(); ctx.moveTo((mx - r) * ts, y * ts); ctx.lineTo((mx + r + 1) * ts, y * ts); ctx.stroke(); }
      for (let x = mx - r; x <= mx + r + 1; x++) { ctx.beginPath(); ctx.moveTo(x * ts, (my - r) * ts); ctx.lineTo(x * ts, (my + r + 1) * ts); ctx.stroke(); }
      if (opts.hoverTile) {
        const { tx, ty } = opts.hoverTile;
        const ok = Math.max(Math.abs(tx - mx), Math.abs(ty - my)) <= r;
        ctx.fillStyle = ok ? 'rgba(102,187,106,.45)' : 'rgba(239,83,80,.45)';
        ctx.fillRect(tx * ts, ty * ts, ts, ts);
      }
    }
    // 타일 위 오브젝트 (흔들림 적용)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * view.w + x, t = view.tiles[i];
      if (t === T.GROUND || t === T.WATER || t === T.WATER_EMPTY || t === T.LAVA || t === T.MUD) continue;
      const sh = view.shakeOf(i);
      if (sh) { ctx.save(); ctx.translate(sh * ts, 0); }
      this.drawTile(ctx, t, x, y, ts, tNow, view, i);
      if (sh) ctx.restore();
    }
    // 채집 대상 진행 표시
    if (me && me.alive && me.target >= 0 && C.RESOURCES[view.tiles[me.target]]) {
      const r = C.RESOURCES[view.tiles[me.target]]; const left = view.tileHp[me.target];
      const tx = me.target % view.w, ty = (me.target / view.w) | 0;
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx * ts + ts / 2, ty * ts + ts * 0.1, ts * 0.22, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx * ts + ts / 2, ty * ts + ts * 0.1, ts * 0.22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / r.hits)); ctx.stroke();
    }
    // 개체 (y순)
    const drawables = [];
    for (const p of view.players) { const pos = view.pos(p); drawables.push({ y: pos.y, f: () => this.drawPlayer(ctx, p, pos, ts, tNow, p.id === myId, view) }); }
    for (const e of view.enemies) { const pos = view.pos(e); drawables.push({ y: pos.y + (C.ENEMIES[e.kind].flying ? 5 : 0), f: () => this.drawEnemy(ctx, e, pos, ts, tNow) }); }
    for (const pr of view.projs) { const pos = view.pos(pr); drawables.push({ y: pos.y + 10, f: () => this.drawProj(ctx, pr, pos, ts) }); }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.f();
    // 포탑 사격선
    for (const s of view.shots) {
      const a = 1 - (tNow - s.born) / 120;
      ctx.strokeStyle = s.heavy ? `rgba(255,171,64,${a})` : `rgba(255,235,120,${a})`; ctx.lineWidth = s.heavy ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(s.x1 * ts, s.y1 * ts); ctx.lineTo(s.x2 * ts, s.y2 * ts); ctx.stroke();
    }
    // 파티클
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of view.particles) {
      const age = (tNow - p.born) / 1000, a = 1 - (tNow - p.born) / p.life;
      ctx.globalAlpha = clamp(a, 0, 1);
      if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x * ts, p.y * ts, p.ring * ts * (1 - a), 0, Math.PI * 2); ctx.stroke(); continue; }
      const px = (p.x + p.vx * age) * ts, py = (p.y + p.vy * age + (p.g || 0) * age * age) * ts;
      if (p.text) { ctx.font = `bold ${Math.round(Math.max(11, ts * 0.5))}px sans-serif`; ctx.fillStyle = p.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(p.text, px, py); ctx.fillText(p.text, px, py); }
      else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, p.size * ts), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    const dark = view.darkness();
    if (dark > 0.01) this.drawDarkness(view, dark, tNow);
    // 밤 10초 전 경고: 화면 가장자리 붉은 맥동
    if (view.phase === 'day' && view.dayTicks - view.cycleT <= 10 * C.TICK_RATE && !view.over) {
      const a = 0.25 + 0.2 * Math.sin(tNow / 150);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    this.drawBaseArrow(view, ts);
    this.drawMinimap(view, myId);
  }

  drawTile(ctx, t, x, y, ts, tNow, view, i) {
    const px = x * ts, py = y * ts, c = ts / 2;
    const cx = px + c, cy = py + c;
    const shadow = (rx, ry) => { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx + ts * 0.05, py + ts * 0.9, ts * rx, ts * ry, 0, 0, Math.PI * 2); ctx.fill(); };
    switch (t) {
      case T.TREE: {
        shadow(0.32, 0.12);
        ctx.fillStyle = '#5d4a33'; ctx.fillRect(cx - ts * 0.08, cy, ts * 0.16, ts * 0.42);
        ctx.fillStyle = '#1f5a28'; ctx.beginPath(); ctx.arc(cx, cy - ts * 0.08, ts * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(cx - ts * 0.1, cy - ts * 0.18, ts * 0.26, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case T.PINE: {
        shadow(0.3, 0.1);
        ctx.fillStyle = '#5d4a33'; ctx.fillRect(cx - ts * 0.07, cy + ts * 0.1, ts * 0.14, ts * 0.32);
        for (let k = 0; k < 3; k++) {
          const w = ts * (0.46 - k * 0.1), top = py + ts * (0.05 + k * 0.2);
          ctx.fillStyle = k % 2 ? '#1b5e20' : '#2e7d32';
          ctx.beginPath(); ctx.moveTo(cx - w, top + ts * 0.32); ctx.lineTo(cx, top); ctx.lineTo(cx + w, top + ts * 0.32); ctx.closePath(); ctx.fill();
        }
        if (view.mapDef.name === '설원') { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(cx - ts * 0.2, py + ts * 0.3); ctx.lineTo(cx, py + ts * 0.12); ctx.lineTo(cx + ts * 0.2, py + ts * 0.3); ctx.closePath(); ctx.fill(); }
        break;
      }
      case T.DEAD_TREE: {
        shadow(0.22, 0.08);
        ctx.strokeStyle = '#4e342e'; ctx.lineWidth = Math.max(2, ts * 0.12); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, py + ts * 0.9); ctx.lineTo(cx, cy - ts * 0.1); ctx.lineTo(cx - ts * 0.25, cy - ts * 0.4); ctx.moveTo(cx, cy); ctx.lineTo(cx + ts * 0.28, cy - ts * 0.3); ctx.moveTo(cx, cy - ts * 0.1); ctx.lineTo(cx + ts * 0.05, py + ts * 0.05); ctx.stroke();
        break;
      }
      case T.CACTUS: {
        shadow(0.2, 0.08);
        ctx.fillStyle = '#4c8c3c'; ctx.beginPath(); ctx.roundRect(cx - ts * 0.13, py + ts * 0.15, ts * 0.26, ts * 0.75, ts * 0.12); ctx.fill();
        ctx.beginPath(); ctx.roundRect(cx - ts * 0.38, py + ts * 0.3, ts * 0.14, ts * 0.32, ts * 0.07); ctx.fill(); ctx.fillRect(cx - ts * 0.38, py + ts * 0.5, ts * 0.28, ts * 0.12);
        ctx.beginPath(); ctx.roundRect(cx + ts * 0.24, py + ts * 0.22, ts * 0.14, ts * 0.32, ts * 0.07); ctx.fill(); ctx.fillRect(cx + ts * 0.1, py + ts * 0.42, ts * 0.28, ts * 0.12);
        ctx.fillStyle = '#ffab91'; ctx.beginPath(); ctx.arc(cx, py + ts * 0.15, ts * 0.06, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case T.STUMP: ctx.fillStyle = '#5d4a33'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8d6e4a'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.12, 0, Math.PI * 2); ctx.fill(); break;
      case T.ROCK: case T.IRON_ORE: {
        shadow(0.36, 0.12);
        ctx.fillStyle = t === T.IRON_ORE ? '#6d6a66' : '#7b7f85'; ctx.beginPath();
        ctx.moveTo(px + ts * 0.15, py + ts * 0.75); ctx.lineTo(px + ts * 0.1, py + ts * 0.45); ctx.lineTo(px + ts * 0.35, py + ts * 0.2); ctx.lineTo(px + ts * 0.7, py + ts * 0.25); ctx.lineTo(px + ts * 0.9, py + ts * 0.55); ctx.lineTo(px + ts * 0.8, py + ts * 0.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = t === T.IRON_ORE ? '#8d8a85' : '#a5a9af'; ctx.beginPath(); ctx.moveTo(px + ts * 0.35, py + ts * 0.25); ctx.lineTo(px + ts * 0.65, py + ts * 0.3); ctx.lineTo(px + ts * 0.45, py + ts * 0.5); ctx.closePath(); ctx.fill();
        if (t === T.IRON_ORE) { ctx.fillStyle = '#e08a3a'; for (const [ox, oy] of [[0.3, 0.55], [0.55, 0.45], [0.65, 0.65], [0.4, 0.68]]) { ctx.beginPath(); ctx.arc(px + ts * ox, py + ts * oy, ts * 0.06, 0, Math.PI * 2); ctx.fill(); } }
        break;
      }
      case T.BUSH: case T.BUSH_EMPTY: {
        ctx.fillStyle = t === T.BUSH ? '#3f8f3a' : '#5f9a58';
        ctx.beginPath(); ctx.arc(cx - ts * 0.15, cy + ts * 0.05, ts * 0.25, 0, Math.PI * 2); ctx.arc(cx + ts * 0.15, cy + ts * 0.05, ts * 0.25, 0, Math.PI * 2); ctx.arc(cx, cy - ts * 0.15, ts * 0.25, 0, Math.PI * 2); ctx.fill();
        if (t === T.BUSH) { ctx.fillStyle = '#e53935'; for (const [ox, oy] of [[-0.18, 0.05], [0.12, -0.12], [0.2, 0.15]]) { ctx.beginPath(); ctx.arc(cx + ox * ts, cy + oy * ts, ts * 0.06, 0, Math.PI * 2); ctx.fill(); } }
        break;
      }
      case T.MUSHROOM: case T.MUSHROOM_EMPTY: {
        const caps = t === T.MUSHROOM ? [[-0.2, 0.1, 0.16], [0.15, 0.0, 0.2], [0.05, 0.25, 0.12]] : [[-0.2, 0.15, 0.06], [0.15, 0.1, 0.07]];
        for (const [ox, oy, r] of caps) {
          ctx.fillStyle = '#efebe9'; ctx.fillRect(cx + ox * ts - ts * 0.04, cy + oy * ts, ts * 0.08, ts * 0.18);
          if (t === T.MUSHROOM) { ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(cx + ox * ts, cy + oy * ts, r * ts, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + ox * ts - r * ts * 0.4, cy + oy * ts - r * ts * 0.4, r * ts * 0.22, 0, Math.PI * 2); ctx.fill(); }
        }
        break;
      }
      case T.HERB: case T.HERB_EMPTY: {
        ctx.strokeStyle = '#7cb342'; ctx.lineWidth = Math.max(1.5, ts * 0.06); ctx.lineCap = 'round';
        const n = t === T.HERB ? 5 : 2;
        for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.45; ctx.beginPath(); ctx.moveTo(cx, cy + ts * 0.3); ctx.lineTo(cx + Math.cos(a) * ts * 0.35, cy + ts * 0.3 + Math.sin(a) * ts * 0.45); ctx.stroke(); }
        if (t === T.HERB) { ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.arc(cx, cy - ts * 0.15, ts * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(cx, cy - ts * 0.15, ts * 0.04, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case T.WOOD_WALL: {
        ctx.fillStyle = '#7a4f28'; ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#a3703b'; ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + 2, py + (ts * k) / 4); ctx.lineTo(px + ts - 2, py + (ts * k) / 4); ctx.stroke(); }
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.STONE_WALL: {
        ctx.fillStyle = '#6d7278'; ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#b7bcc4'; ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#7d838a'; ctx.lineWidth = 2;
        for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px + 2, py + (ts * k) / 3); ctx.lineTo(px + ts - 2, py + (ts * k) / 3); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(px + ts / 2, py + 2); ctx.lineTo(px + ts / 2, py + ts / 3); ctx.moveTo(px + ts / 4, py + ts / 3); ctx.lineTo(px + ts / 4, py + (2 * ts) / 3); ctx.moveTo(px + (3 * ts) / 4, py + ts / 3); ctx.lineTo(px + (3 * ts) / 4, py + (2 * ts) / 3); ctx.moveTo(px + ts / 2, py + (2 * ts) / 3); ctx.lineTo(px + ts / 2, py + ts - 2); ctx.stroke();
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.IRON_WALL: {
        ctx.fillStyle = '#37474f'; ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#607d8b'; ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2; ctx.strokeRect(px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.6);
        ctx.fillStyle = '#90a4ae'; for (const [ox, oy] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) { ctx.beginPath(); ctx.arc(px + ts * ox, py + ts * oy, ts * 0.06, 0, Math.PI * 2); ctx.fill(); }
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.DOOR: {
        ctx.fillStyle = '#5a3b1c'; ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#d9a24d'; ctx.fillRect(px + ts * 0.15, py + ts * 0.1, ts * 0.7, ts * 0.8);
        ctx.fillStyle = '#5a3b1c'; ctx.fillRect(px + ts * 0.25, py + ts * 0.2, ts * 0.5, ts * 0.25); ctx.fillRect(px + ts * 0.25, py + ts * 0.55, ts * 0.5, ts * 0.25);
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(px + ts * 0.72, py + ts * 0.5, ts * 0.05, 0, Math.PI * 2); ctx.fill();
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.TURRET: case T.HEAVY_TURRET: {
        const heavy = t === T.HEAVY_TURRET;
        ctx.fillStyle = heavy ? '#263238' : '#37474f'; ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.fillStyle = heavy ? '#455a64' : '#546e7a'; ctx.beginPath(); ctx.arc(cx, cy, ts * (heavy ? 0.36 : 0.32), 0, Math.PI * 2); ctx.fill();
        let ang = -Math.PI / 2, best = C.BUILDING_BY_TILE[t].range;
        for (const e of view.enemies) { const p = view.pos(e); const d = Math.hypot(p.x - x - 0.5, p.y - y - 0.5); if (d < best) { best = d; ang = Math.atan2(p.y - y - 0.5, p.x - x - 0.5); } }
        ctx.strokeStyle = heavy ? '#ffb300' : '#f2c94c'; ctx.lineWidth = Math.max(3, ts * (heavy ? 0.16 : 0.12)); ctx.lineCap = 'round';
        const off = heavy ? 0.08 : 0;
        for (const s of heavy ? [-1, 1] : [0]) { ctx.beginPath(); ctx.moveTo(cx - Math.sin(ang) * s * off * ts, cy + Math.cos(ang) * s * off * ts); ctx.lineTo(cx + Math.cos(ang) * ts * 0.44 - Math.sin(ang) * s * off * ts, cy + Math.sin(ang) * ts * 0.44 + Math.cos(ang) * s * off * ts); ctx.stroke(); }
        ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.14, 0, Math.PI * 2); ctx.fill();
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.SPIKES: {
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.fillStyle = '#b0bec5';
        for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { const sx = px + ts * (0.2 + k * 0.3), sy = py + ts * (0.2 + j * 0.3); ctx.beginPath(); ctx.moveTo(sx - ts * 0.08, sy + ts * 0.08); ctx.lineTo(sx, sy - ts * 0.1); ctx.lineTo(sx + ts * 0.08, sy + ts * 0.08); ctx.closePath(); ctx.fill(); }
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.TORCH: {
        ctx.fillStyle = '#5d4a33'; ctx.fillRect(cx - ts * 0.05, cy - ts * 0.1, ts * 0.1, ts * 0.5);
        const fl = 0.8 + 0.2 * Math.sin(tNow / 70 + x * 3);
        ctx.fillStyle = '#ff9800'; ctx.beginPath(); ctx.moveTo(cx - ts * 0.13, cy - ts * 0.05); ctx.quadraticCurveTo(cx, cy - ts * 0.5 * fl, cx + ts * 0.13, cy - ts * 0.05); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.moveTo(cx - ts * 0.06, cy - ts * 0.05); ctx.quadraticCurveTo(cx, cy - ts * 0.28 * fl, cx + ts * 0.06, cy - ts * 0.05); ctx.closePath(); ctx.fill();
        break;
      }
      case T.CAMPFIRE: {
        ctx.fillStyle = '#5d4a33';
        ctx.save(); ctx.translate(cx, cy + ts * 0.2); ctx.rotate(0.5); ctx.fillRect(-ts * 0.3, -ts * 0.05, ts * 0.6, ts * 0.1); ctx.rotate(-1); ctx.fillRect(-ts * 0.3, -ts * 0.05, ts * 0.6, ts * 0.1); ctx.restore();
        const fl = 0.85 + 0.15 * Math.sin(tNow / 90 + x);
        ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(cx - ts * 0.22, cy + ts * 0.2); ctx.quadraticCurveTo(cx, cy - ts * 0.55 * fl, cx + ts * 0.22, cy + ts * 0.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.moveTo(cx - ts * 0.1, cy + ts * 0.2); ctx.quadraticCurveTo(cx, cy - ts * 0.25 * fl, cx + ts * 0.1, cy + ts * 0.2); ctx.closePath(); ctx.fill();
        break;
      }
      case T.FARM: case T.FARM_RIPE: {
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
        ctx.strokeStyle = '#52371f'; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px + 4, py + ts * (0.25 + k * 0.25)); ctx.lineTo(px + ts - 4, py + ts * (0.25 + k * 0.25)); ctx.stroke(); }
        if (t === T.FARM_RIPE) { ctx.fillStyle = '#b8d652'; for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(px + ts * (0.3 + j * 0.4), py + ts * (0.25 + k * 0.25), ts * 0.08, 0, Math.PI * 2); ctx.fill(); } }
        else { ctx.fillStyle = '#7cb342'; for (let k = 0; k < 3; k++) ctx.fillRect(px + ts * 0.45, py + ts * (0.2 + k * 0.25), ts * 0.1, ts * 0.1); }
        break;
      }
      default: break;
    }
  }
  drawHpBar(ctx, view, i, px, py, ts) {
    const t = view.tiles[i], max = (C.BUILDING_BY_TILE[t] || {}).hp || 0, hp = view.tileHp[i];
    if (!max || hp >= max) return;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 3, py + ts - 6, ts - 6, 4);
    ctx.fillStyle = hp / max > 0.5 ? '#66bb6a' : hp / max > 0.25 ? '#ffb74d' : '#ef5350'; ctx.fillRect(px + 3, py + ts - 6, (ts - 6) * (hp / max), 4);
  }

  // ---------- 캐릭터 ----------
  drawTool(ctx, tool, r, u, kind) {
    // 손 위치 원점, x축이 도구가 뻗는 방향. u: 휘두르기 진행(0~1) 또는 null
    const L = r * 1.5;
    ctx.lineCap = 'round';
    switch (tool) {
      case 'axe': ctx.strokeStyle = '#8d6e4a'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.moveTo(L * 0.75, -r * 0.05); ctx.lineTo(L * 1.05, -r * 0.5); ctx.lineTo(L * 1.25, -r * 0.1); ctx.lineTo(L * 1.05, r * 0.35); ctx.closePath(); ctx.fill(); break;
      case 'pickaxe': ctx.strokeStyle = '#8d6e4a'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.beginPath(); ctx.moveTo(L * 0.85, -r * 0.6); ctx.quadraticCurveTo(L * 1.2, 0, L * 0.85, r * 0.6); ctx.stroke(); break;
      case 'hammer': ctx.strokeStyle = '#8d6e4a'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.fillStyle = '#78909c'; ctx.fillRect(L * 0.85, -r * 0.42, r * 0.5, r * 0.84); break;
      case 'sword': ctx.strokeStyle = '#eceff1'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(L * 1.3, 0); ctx.stroke();
        ctx.strokeStyle = '#ffb300'; ctx.lineWidth = Math.max(2, r * 0.18); ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.3); ctx.lineTo(r * 0.3, r * 0.3); ctx.stroke(); break;
      case 'knife': ctx.strokeStyle = '#eceff1'; ctx.lineWidth = Math.max(2, r * 0.18); ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(L * 0.8, 0); ctx.stroke();
        ctx.strokeStyle = '#5d4037'; ctx.beginPath(); ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.2, 0); ctx.stroke(); break;
      case 'bow': {
        const pull = kind === 'shoot' && u !== null ? (u < 0.4 ? u / 0.4 : Math.max(0, 1 - (u - 0.4) / 0.15)) : 0;
        ctx.strokeStyle = '#8d6e4a'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.beginPath(); ctx.arc(L * 0.4, 0, r * 0.95, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L * 0.4, -r * 0.95); ctx.lineTo(L * 0.4 - pull * r * 0.9, 0); ctx.lineTo(L * 0.4, r * 0.95); ctx.stroke();
        if (pull > 0.05) { ctx.strokeStyle = '#a1887f'; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.beginPath(); ctx.moveTo(L * 0.4 - pull * r * 0.9, 0); ctx.lineTo(L * 0.4 + r * 0.9, 0); ctx.stroke(); }
        break;
      }
      default: break;
    }
  }
  drawHat(ctx, hat, x, y, r, color) {
    switch (hat) {
      case 'band': ctx.strokeStyle = '#ef5350'; ctx.lineWidth = Math.max(2, r * 0.18); ctx.beginPath(); ctx.arc(x, y, r * 0.92, -Math.PI * 0.95, -Math.PI * 0.05); ctx.stroke(); break;
      case 'beanie': ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.85, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#ef9a9a'; ctx.fillRect(x - r * 0.85, y - r * 0.25, r * 1.7, r * 0.2); break;
      case 'helmet': ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.9, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - r * 0.55, r * 0.18, 0, Math.PI * 2); ctx.fill(); break;
      case 'hood': ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.95, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 0.8); ctx.lineTo(x + r * 1.2, y - r * 1.3); ctx.lineTo(x + r * 0.8, y - r * 0.6); ctx.closePath(); ctx.fill(); break;
      case 'chef': ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.6, y - r * 1.0, r * 1.2, r * 0.5); ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 1.05, r * 0.35, 0, Math.PI * 2); ctx.arc(x + r * 0.35, y - r * 1.05, r * 0.35, 0, Math.PI * 2); ctx.arc(x, y - r * 1.2, r * 0.4, 0, Math.PI * 2); ctx.fill(); break;
      case 'knight': ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.95, Math.PI, 0); ctx.fill(); ctx.fillRect(x - r * 0.95, y - r * 0.1, r * 1.9, r * 0.3); ctx.fillStyle = '#263238'; ctx.fillRect(x - r * 0.7, y - r * 0.05, r * 1.4, r * 0.14); ctx.fillStyle = '#ef5350'; ctx.fillRect(x - r * 0.08, y - r * 1.3, r * 0.16, r * 0.5); break;
      case 'hardhat': ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.85, Math.PI, 0); ctx.fill(); ctx.fillRect(x - r * 1.0, y - r * 0.2, r * 2.0, r * 0.18); break;
      default: void color; break;
    }
  }
  drawPlayer(ctx, p, pos, ts, tNow, isMe, view) {
    const cd = C.CLASSES[p.cls] || C.CLASSES.SURVIVOR;
    const r = C.PLAYER.radius * ts;
    let x = pos.x * ts, y = pos.y * ts;
    if (!p.alive) {
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(x - r * 0.7, y - r * 0.9, r * 1.4, r * 1.6);
      ctx.fillStyle = '#616161'; ctx.fillRect(x - r * 0.5, y - r * 0.6, r, r * 0.15);
      ctx.font = `${Math.round(Math.max(10, ts * 0.42))}px sans-serif`; ctx.fillStyle = '#eee'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.name, x, y - r * 1.1);
      if (p.reviveT > 0) { ctx.fillStyle = '#fff59d'; ctx.font = `bold ${Math.round(Math.max(10, ts * 0.42))}px sans-serif`; ctx.fillText(`💫 ${Math.ceil(p.reviveT / C.TICK_RATE)}초`, x, y - r * 2.2); }
      return;
    }
    const sw = view.swingOf(p.id);
    const u = sw ? sw.u : null;
    // 몸 기울이기(찍을 때 앞으로), 걷기 흔들림
    let lean = 0;
    if (u !== null) lean = (u < 0.35 ? -0.25 * (u / 0.35) : u < 0.55 ? -0.25 + 0.75 * ((u - 0.35) / 0.2) : 0.5 * (1 - (u - 0.55) / 0.45)) * r * 0.5;
    const bob = p.moving ? Math.sin(tNow / 70) * r * 0.12 : 0;
    x += p.dx * lean; y += p.dy * lean + bob;
    // 그림자·다리
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(pos.x * ts, pos.y * ts + r * 0.95, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (p.moving) {
      const st = Math.sin(tNow / 70);
      ctx.fillStyle = '#3e2723';
      ctx.beginPath(); ctx.ellipse(x - r * 0.35 - p.dy * st * r * 0.3, y + r * 0.8 + p.dx * st * r * 0.3, r * 0.22, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.35 + p.dy * st * r * 0.3, y + r * 0.8 - p.dx * st * r * 0.3, r * 0.22, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (isMe) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
    // 도구 각도: 대기 0.5rad → 뒤로 크게 들었다가(−1.7) → 빠르게 내려침(+0.9) → 복귀
    const facing = Math.atan2(p.dy, p.dx);
    let rel = 0.5;
    if (u !== null) {
      if (sw.kind === 'shoot') rel = 0;
      else if (u < 0.35) rel = 0.5 - 2.2 * easeOut(u / 0.35);
      else if (u < 0.55) rel = -1.7 + 2.6 * easeIn((u - 0.35) / 0.2);
      else rel = 0.9 - 0.4 * ((u - 0.55) / 0.45);
    }
    const side = p.dx >= 0 ? 1 : -1; // 오른손잡이: 도구는 몸 오른쪽에서 시작
    const ang = facing + rel * side;
    const hx = x + Math.cos(facing) * r * 0.55 - Math.sin(facing) * side * r * 0.35, hy = y + Math.sin(facing) * r * 0.55 + Math.cos(facing) * side * r * 0.35;
    const toolBehind = Math.sin(ang) < -0.2; // 위쪽으로 든 도구는 몸 뒤에 그리기
    const drawToolNow = () => { ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); this.drawTool(ctx, cd.tool, r, u, sw && sw.kind); ctx.restore(); ctx.fillStyle = '#ffcc80'; ctx.beginPath(); ctx.arc(hx, hy, r * 0.22, 0, Math.PI * 2); ctx.fill(); };
    if (toolBehind) drawToolNow();
    // 몸
    ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 뒷손
    ctx.fillStyle = '#ffcc80'; ctx.beginPath(); ctx.arc(x - Math.cos(facing) * r * 0.2 + Math.sin(facing) * side * r * 0.9, y - Math.sin(facing) * r * 0.2 - Math.cos(facing) * side * r * 0.9, r * 0.2, 0, Math.PI * 2); ctx.fill();
    // 눈
    ctx.fillStyle = '#fff';
    const ex = p.dx * r * 0.35, ey = p.dy * r * 0.35;
    ctx.beginPath(); ctx.arc(x + ex - p.dy * r * 0.28, y + ey + p.dx * r * 0.28 - r * 0.1, r * 0.15, 0, Math.PI * 2); ctx.arc(x + ex + p.dy * r * 0.28, y + ey - p.dx * r * 0.28 - r * 0.1, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(x + ex * 1.15 - p.dy * r * 0.28, y + ey * 1.15 + p.dx * r * 0.28 - r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.arc(x + ex * 1.15 + p.dy * r * 0.28, y + ey * 1.15 - p.dx * r * 0.28 - r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.fill();
    this.drawHat(ctx, HATS[p.cls] || 'band', x, y - r * 0.35, r, p.color);
    if (!toolBehind) drawToolNow();
    // 근접 공격 궤적
    if (u !== null && sw.kind === 'attack' && u > 0.35 && u < 0.7) { ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - (u - 0.35) / 0.35)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 2.1, facing - 1.1 * side, facing + 0.5 * side, side < 0); ctx.stroke(); }
    // 이름 / 말풍선
    ctx.font = `bold ${Math.round(Math.max(10, ts * 0.42))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.name, x, y - r * 1.6); ctx.fillStyle = p.color; ctx.fillText(p.name, x, y - r * 1.6);
    if (p.say) {
      ctx.font = `${Math.round(Math.max(10, ts * 0.45))}px sans-serif`;
      const w = ctx.measureText(p.say).width + 14, h = ts * 0.66, by = y - r * 2.2 - h - 6;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - w / 2, by, w, h, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x + 5, by + h); ctx.lineTo(x, by + h + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.fillText(p.say, x, by + h / 2);
    }
    if (p.hp < p.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - r, y + r + 4, r * 2, 3);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(x - r, y + r + 4, r * 2 * (p.hp / p.maxHp), 3);
    }
  }
  // ---------- 적 ----------
  drawEnemy(ctx, e, pos, ts, tNow) {
    const def = C.ENEMIES[e.kind] || C.ENEMIES.ZOMBIE;
    const r = def.radius * (e.elite ? 1.25 : 1) * ts;
    let x = pos.x * ts, y = pos.y * ts;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (def.flying) { y -= r * 1.2 + Math.sin(tNow / 120) * r * 0.3; const fl = Math.sin(tNow / 60) * 0.6; ctx.fillStyle = '#3949ab'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * r * 1.6, y - r * (1 + fl), x + s * r * 2.2, y + r * 0.3); ctx.quadraticCurveTo(x + s * r * 1.2, y + r * 0.2, x, y + r * 0.4); ctx.fill(); } }
    if (e.elite) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = e.hit ? '#fff' : def.color; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
    if (e.kind === 'BREAKER') { ctx.beginPath(); ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#bf360c'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.5, y - r * 0.9); ctx.lineTo(x + s * r * 0.9, y - r * 1.5); ctx.lineTo(x + s * r * 0.95, y - r * 0.7); ctx.closePath(); ctx.fill(); } }
    else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    switch (e.kind) {
      case 'ZOMBIE': ctx.fillStyle = '#388e3c'; ctx.fillRect(x + r * 0.5, y - r * 0.15, r * 0.9, r * 0.25); ctx.fillRect(x - r * 1.4, y - r * 0.15, r * 0.9, r * 0.25); break; // 앞으로 뻗은 팔
      case 'SPITTER': ctx.fillStyle = '#004d40'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 0.4, r * 0.25 + (e.hit ? 0 : r * 0.1 * Math.abs(Math.sin(tNow / 200))), 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'THIEF': ctx.fillStyle = '#212121'; ctx.fillRect(x - r * 0.9, y - r * 0.35, r * 1.8, r * 0.45); if (e.flee) { ctx.fillStyle = '#d7ccc8'; ctx.beginPath(); ctx.arc(x - r * 1.1, y - r * 0.6, r * 0.55, 0, Math.PI * 2); ctx.fill(); } break;
      case 'BOMBER': { const sp = tNow / 100; ctx.strokeStyle = '#212121'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * 0.5, y - r * 1.5, x + r * 0.3, y - r * 1.8); ctx.stroke(); ctx.fillStyle = Math.floor(sp) % 2 ? '#ffeb3b' : '#ff9800'; ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 1.8, r * 0.22, 0, Math.PI * 2); ctx.fill(); break; }
      case 'BRUTE': ctx.fillStyle = '#4e342e'; ctx.beginPath(); ctx.arc(x - r * 1.05, y + r * 0.2, r * 0.35, 0, Math.PI * 2); ctx.arc(x + r * 1.05, y + r * 0.2, r * 0.35, 0, Math.PI * 2); ctx.fill(); break;
      case 'BOSS': ctx.fillStyle = '#ffd54f'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.5 - r * 0.2, y - r * 0.8); ctx.lineTo(x + k * r * 0.5, y - r * 1.3); ctx.lineTo(x + k * r * 0.5 + r * 0.2, y - r * 0.8); ctx.closePath(); ctx.fill(); } break;
      default: break;
    }
    ctx.fillStyle = e.kind === 'BAT' ? '#ff1744' : '#b71c1c'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
    if (e.kind !== 'SPITTER') { ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.35); ctx.lineTo(x + r * 0.3, y + r * 0.35); ctx.stroke(); }
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - r, y - r - 8, r * 2, 3);
      ctx.fillStyle = e.elite ? '#ffd54f' : '#ef5350'; ctx.fillRect(x - r, y - r - 8, r * 2 * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
  drawProj(ctx, pr, pos, ts) {
    const x = pos.x * ts, y = pos.y * ts;
    if (pr.k === 'arrow') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(pr.a);
      ctx.strokeStyle = '#a1887f'; ctx.lineWidth = Math.max(1.5, ts * 0.08); ctx.beginPath(); ctx.moveTo(-ts * 0.3, 0); ctx.lineTo(ts * 0.25, 0); ctx.stroke();
      ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.moveTo(ts * 0.38, 0); ctx.lineTo(ts * 0.2, -ts * 0.08); ctx.lineTo(ts * 0.2, ts * 0.08); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ef5350'; ctx.fillRect(-ts * 0.32, -ts * 0.06, ts * 0.12, ts * 0.12);
      ctx.restore();
    } else {
      ctx.fillStyle = '#26a69a'; ctx.beginPath(); ctx.arc(x, y, ts * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#80cbc4'; ctx.beginPath(); ctx.arc(x - ts * 0.04, y - ts * 0.04, ts * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawDarkness(view, dark, tNow) {
    const d = this.dark, dctx = d.getContext('2d'), ts = this.ts, dpr = this.dpr;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = `rgba(6,10,30,${dark})`; dctx.fillRect(0, 0, d.width, d.height);
    dctx.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, radius, strength) => {
      const { sx, sy } = this.worldToScreen(wx, wy);
      if (sx < -radius * ts || sy < -radius * ts || sx > this.W + radius * ts || sy > this.H + radius * ts) return;
      const g = dctx.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, radius * ts * dpr);
      g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.beginPath(); dctx.arc(sx * dpr, sy * dpr, radius * ts * dpr, 0, Math.PI * 2); dctx.fill();
    };
    for (const p of view.players) if (p.alive) { const pos = view.pos(p); light(pos.x, pos.y, 4.5 + 2 * ((p.perks && p.perks.night_eyes) || 0), 1); }
    const x0 = Math.max(0, Math.floor(this.cam.x - this.W / ts)), x1 = Math.min(view.w - 1, Math.ceil(this.cam.x + this.W / ts));
    const y0 = Math.max(0, Math.floor(this.cam.y - this.H / ts)), y1 = Math.min(view.h - 1, Math.ceil(this.cam.y + this.H / ts));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = view.tiles[y * view.w + x];
      if (t === T.CAMPFIRE) light(x + 0.5, y + 0.5, 5.5 + 0.3 * Math.sin(tNow / 120 + x), 1);
      else if (t === T.TORCH) light(x + 0.5, y + 0.5, 3.5 + 0.2 * Math.sin(tNow / 90 + x), 0.95);
      else if (t === T.TURRET || t === T.HEAVY_TURRET) light(x + 0.5, y + 0.5, 2.5, 0.8);
      else if (t === T.LAVA) light(x + 0.5, y + 0.5, 2.2, 0.7);
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(d, 0, 0);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  // 기지(모닥불)가 화면 밖이면 가장자리에 화살표
  drawBaseArrow(view, ts) {
    const bx = Math.floor(view.w / 2) + 0.5, by = Math.floor(view.h / 2) + 0.5;
    const { sx, sy } = this.worldToScreen(bx, by);
    if (sx > 0 && sy > 0 && sx < this.W && sy < this.H) return;
    const ctx = this.ctx, cx = this.W / 2, cy = this.H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const m = 44, ex = clamp(sx, m, this.W - m), ey = clamp(sy, m + 60, this.H - m - 150);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,152,0,.9)'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-4, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔥', ex - Math.cos(ang) * 22, ey - Math.sin(ang) * 22);
    const dist = Math.round(Math.hypot(bx - this.cam.x, by - this.cam.y));
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(`${dist}칸`, ex - Math.cos(ang) * 22, ey - Math.sin(ang) * 22 + 16); ctx.fillText(`${dist}칸`, ex - Math.cos(ang) * 22, ey - Math.sin(ang) * 22 + 16);
    void ts;
  }
  drawMinimap(view, myId) {
    const m = this.mini, ctx = this.mctx, s = m.width / view.w;
    if (this.miniVersion !== view.tilesVersion) {
      this.miniLayer.width = m.width; this.miniLayer.height = m.height;
      const l = this.miniLayer.getContext('2d');
      const pal = view.mapDef;
      for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) {
        const t = view.tiles[y * view.w + x];
        l.fillStyle = t === T.GROUND ? pal.ground[0] : t === T.WATER || t === T.WATER_EMPTY ? pal.water : t === T.MUD ? pal.mud : (MINI[t] || pal.ground[1]);
        l.fillRect(x * s, y * s, s + 0.2, s + 0.2);
      }
      this.miniVersion = view.tilesVersion;
    }
    ctx.drawImage(this.miniLayer, 0, 0);
    if (view.darkness() > 0.3) { ctx.fillStyle = 'rgba(0,0,20,.45)'; ctx.fillRect(0, 0, m.width, m.height); }
    for (const e of view.enemies) { ctx.fillStyle = e.kind === 'BOSS' ? '#ff1744' : e.elite ? '#ffd54f' : '#ff5252'; const sz = e.kind === 'BOSS' ? 5 : 3; ctx.fillRect(e.x * s - sz / 2, e.y * s - sz / 2, sz, sz); }
    for (const p of view.players) { if (!p.alive) continue; ctx.fillStyle = p.color; ctx.fillRect(p.x * s - 2, p.y * s - 2, 4, 4); if (p.id === myId) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(p.x * s - 3, p.y * s - 3, 6, 6); } }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    ctx.strokeRect((this.cam.x - this.W / 2 / this.ts) * s, (this.cam.y - this.H / 2 / this.ts) * s, (this.W / this.ts) * s, (this.H / this.ts) * s);
  }
}
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
