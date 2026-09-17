// Canvas 2D 렌더러: 타일·건물·플레이어·적·효과·밤 조명·미니맵. 이미지 파일 없이 전부 도형으로 그립니다.
import * as C from '../../shared/constants.js';
const { T } = C;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 구형 브라우저용 roundRect 대체
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
    return this;
  };
}
const MINI_COLORS = {
  [T.GRASS]: '#4f7a3a', [T.TREE]: '#1f4d22', [T.ROCK]: '#7b7f85', [T.BUSH]: '#3f8f3a', [T.WATER]: '#2f6fb0',
  [T.WOOD_WALL]: '#a3703b', [T.STONE_WALL]: '#b7bcc4', [T.DOOR]: '#d9a24d', [T.TURRET]: '#f2c94c', [T.CAMPFIRE]: '#ff7a1a',
  [T.FARM]: '#6b4a2b', [T.FARM_RIPE]: '#b8d652', [T.STUMP]: '#5d4a33', [T.BUSH_EMPTY]: '#5f9a58',
};

export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.mini = minimap; this.mctx = minimap.getContext('2d');
    this.miniLayer = document.createElement('canvas'); this.miniVersion = -1;
    this.dark = document.createElement('canvas');
    this.ts = 40; this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr); this.canvas.height = Math.round(this.H * this.dpr);
    this.dark.width = this.canvas.width; this.dark.height = this.canvas.height;
    this.ts = clamp(Math.floor(Math.min(this.W, this.H) / 12), 30, 64);
  }
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
    // 카메라
    const me = view.me(myId);
    let cx = view.w / 2, cy = view.h / 2;
    if (me) { const p = view.pos(me); cx = p.x; cy = p.y; }
    const halfW = W / 2 / ts, halfH = H / 2 / ts;
    this.cam.x = view.w * ts > W ? clamp(cx, halfW, view.w - halfW) : view.w / 2;
    this.cam.y = view.h * ts > H ? clamp(cy, halfH, view.h - halfH) : view.h / 2;
    ctx.fillStyle = '#0b1a10'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2 - this.cam.x * ts, H / 2 - this.cam.y * ts);
    const x0 = Math.max(0, Math.floor(this.cam.x - halfW) - 1), x1 = Math.min(view.w - 1, Math.ceil(this.cam.x + halfW) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y - halfH) - 1), y1 = Math.min(view.h - 1, Math.ceil(this.cam.y + halfH) + 1);
    // 바닥
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = view.tiles[y * view.w + x];
      const shade = ((x * 7 + y * 13) % 3);
      ctx.fillStyle = t === T.WATER ? '#2f6fb0' : (shade === 0 ? '#4f7a3a' : shade === 1 ? '#53803d' : '#4b7537');
      ctx.fillRect(x * ts, y * ts, ts + 0.5, ts + 0.5);
      if (t === T.WATER) { // 잔물결
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.beginPath();
        const ph = (tNow / 600 + x + y) % 2;
        ctx.moveTo(x * ts + ts * 0.15, y * ts + ts * (0.3 + 0.1 * ph)); ctx.lineTo(x * ts + ts * 0.5, y * ts + ts * (0.3 + 0.1 * ph)); ctx.stroke();
      }
    }
    // 건설 범위 표시
    if (opts.buildKey && me && me.alive) {
      const mx = Math.floor(me.x), my = Math.floor(me.y), r = C.BUILD_RANGE;
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
    // 타일 위 오브젝트
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * view.w + x, t = view.tiles[i];
      if (t === T.GRASS || t === T.WATER) continue;
      this.drawTile(ctx, t, x, y, ts, tNow, view, i);
    }
    // 그림자 + 개체 (y순 정렬로 겹침 처리)
    const drawables = [];
    for (const p of view.players) { const pos = view.pos(p); drawables.push({ y: pos.y, f: () => this.drawPlayer(ctx, p, pos, ts, tNow, p.id === myId) }); }
    for (const e of view.enemies) { const pos = view.pos(e); drawables.push({ y: pos.y, f: () => this.drawEnemy(ctx, e, pos, ts) }); }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.f();
    // 포탑 사격선
    for (const s of view.shots) {
      const a = 1 - (tNow - s.born) / 120;
      ctx.strokeStyle = `rgba(255,235,120,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x1 * ts, s.y1 * ts); ctx.lineTo(s.x2 * ts, s.y2 * ts); ctx.stroke();
    }
    // 파티클
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of view.particles) {
      const age = (tNow - p.born) / 1000, a = 1 - (tNow - p.born) / p.life;
      const px = (p.x + p.vx * age) * ts, py = (p.y + p.vy * age) * ts;
      ctx.globalAlpha = clamp(a, 0, 1);
      if (p.text) { ctx.font = `bold ${Math.round(ts * 0.42)}px sans-serif`; ctx.fillStyle = p.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(p.text, px, py); ctx.fillText(p.text, px, py); }
      else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, p.size * ts, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 밤 조명
    const dark = view.darkness();
    if (dark > 0.01) this.drawDarkness(view, dark, tNow);
    this.drawMinimap(view, myId);
  }

  drawTile(ctx, t, x, y, ts, tNow, view, i) {
    const px = x * ts, py = y * ts, c = ts / 2;
    const cx = px + c, cy = py + c;
    switch (t) {
      case T.TREE: {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx + ts * 0.05, py + ts * 0.9, ts * 0.32, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5d4a33'; ctx.fillRect(cx - ts * 0.08, cy, ts * 0.16, ts * 0.42);
        ctx.fillStyle = '#1f5a28'; ctx.beginPath(); ctx.arc(cx, cy - ts * 0.08, ts * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(cx - ts * 0.1, cy - ts * 0.18, ts * 0.26, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case T.STUMP: ctx.fillStyle = '#5d4a33'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8d6e4a'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.12, 0, Math.PI * 2); ctx.fill(); break;
      case T.ROCK: {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx, py + ts * 0.85, ts * 0.36, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7b7f85'; ctx.beginPath();
        ctx.moveTo(px + ts * 0.15, py + ts * 0.75); ctx.lineTo(px + ts * 0.1, py + ts * 0.45); ctx.lineTo(px + ts * 0.35, py + ts * 0.2); ctx.lineTo(px + ts * 0.7, py + ts * 0.25); ctx.lineTo(px + ts * 0.9, py + ts * 0.55); ctx.lineTo(px + ts * 0.8, py + ts * 0.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a5a9af'; ctx.beginPath(); ctx.moveTo(px + ts * 0.35, py + ts * 0.25); ctx.lineTo(px + ts * 0.65, py + ts * 0.3); ctx.lineTo(px + ts * 0.45, py + ts * 0.5); ctx.closePath(); ctx.fill();
        break;
      }
      case T.BUSH: case T.BUSH_EMPTY: {
        ctx.fillStyle = t === T.BUSH ? '#3f8f3a' : '#5f9a58';
        ctx.beginPath(); ctx.arc(cx - ts * 0.15, cy + ts * 0.05, ts * 0.25, 0, Math.PI * 2); ctx.arc(cx + ts * 0.15, cy + ts * 0.05, ts * 0.25, 0, Math.PI * 2); ctx.arc(cx, cy - ts * 0.15, ts * 0.25, 0, Math.PI * 2); ctx.fill();
        if (t === T.BUSH) { ctx.fillStyle = '#e53935'; for (const [ox, oy] of [[-0.18, 0.05], [0.12, -0.12], [0.2, 0.15]]) { ctx.beginPath(); ctx.arc(cx + ox * ts, cy + oy * ts, ts * 0.06, 0, Math.PI * 2); ctx.fill(); } }
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
      case T.DOOR: {
        ctx.fillStyle = '#5a3b1c'; ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#d9a24d'; ctx.fillRect(px + ts * 0.15, py + ts * 0.1, ts * 0.7, ts * 0.8);
        ctx.fillStyle = '#5a3b1c'; ctx.fillRect(px + ts * 0.25, py + ts * 0.2, ts * 0.5, ts * 0.25); ctx.fillRect(px + ts * 0.25, py + ts * 0.55, ts * 0.5, ts * 0.25);
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(px + ts * 0.72, py + ts * 0.5, ts * 0.05, 0, Math.PI * 2); ctx.fill();
        this.drawHpBar(ctx, view, i, px, py, ts); break;
      }
      case T.TURRET: {
        ctx.fillStyle = '#37474f'; ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        ctx.fillStyle = '#546e7a'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.32, 0, Math.PI * 2); ctx.fill();
        let ang = -Math.PI / 2, best = C.BUILDINGS.TURRET.range;
        for (const e of view.enemies) { const p = view.pos(e); const d = Math.hypot(p.x - x - 0.5, p.y - y - 0.5); if (d < best) { best = d; ang = Math.atan2(p.y - y - 0.5, p.x - x - 0.5); } }
        ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = Math.max(3, ts * 0.12); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * ts * 0.42, cy + Math.sin(ang) * ts * 0.42); ctx.stroke();
        ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.14, 0, Math.PI * 2); ctx.fill();
        this.drawHpBar(ctx, view, i, px, py, ts); break;
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
        else { ctx.fillStyle = '#7cb342'; for (let k = 0; k < 3; k++) { ctx.fillRect(px + ts * 0.45, py + ts * (0.2 + k * 0.25), ts * 0.1, ts * 0.1); } }
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
  drawPlayer(ctx, p, pos, ts, tNow, isMe) {
    const x = pos.x * ts, y = pos.y * ts, r = C.PLAYER.radius * ts;
    if (!p.alive) {
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(x - r * 0.7, y - r * 0.9, r * 1.4, r * 1.6);
      ctx.fillStyle = '#616161'; ctx.fillRect(x - r * 0.5, y - r * 0.6, r, r * 0.15);
      ctx.font = `${Math.round(ts * 0.3)}px sans-serif`; ctx.fillStyle = '#eee'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.name, x, y - r * 1.1);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (isMe) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
    // 도구 휘두르기
    const ang = Math.atan2(p.dy, p.dx) + (p.swing > 0 ? Math.sin((6 - p.swing) / 6 * Math.PI) * 1.2 - 0.6 : 0.5);
    ctx.strokeStyle = '#8d6e4a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r * 0.5, y + Math.sin(ang) * r * 0.5); ctx.lineTo(x + Math.cos(ang) * r * 1.7, y + Math.sin(ang) * r * 1.7); ctx.stroke();
    ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r * 1.7, y + Math.sin(ang) * r * 1.7, r * 0.25, 0, Math.PI * 2); ctx.fill();
    // 몸
    ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 눈
    ctx.fillStyle = '#fff';
    const ex = p.dx * r * 0.35, ey = p.dy * r * 0.35;
    ctx.beginPath(); ctx.arc(x + ex - r * 0.25 * (1 - Math.abs(p.dx)) - p.dy * r * 0.25, y + ey - p.dx * r * -0.25 - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + ex + r * 0.25 * (1 - Math.abs(p.dx)) + p.dy * r * 0.25, y + ey + p.dx * r * -0.25 - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
    // 이름 / 말풍선
    ctx.font = `bold ${Math.round(ts * 0.28)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.name, x, y - r - 3); ctx.fillStyle = p.color; ctx.fillText(p.name, x, y - r - 3);
    if (p.say) {
      ctx.font = `${Math.round(ts * 0.3)}px sans-serif`;
      const w = ctx.measureText(p.say).width + 14, h = ts * 0.44, by = y - r - ts * 0.8 - h;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - w / 2, by, w, h, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x + 5, by + h); ctx.lineTo(x, by + h + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.fillText(p.say, x, by + h / 2);
    }
    if (p.hp < C.PLAYER.hp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - r, y + r + 4, r * 2, 4);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(x - r, y + r + 4, r * 2 * (p.hp / C.PLAYER.hp), 4);
    }
  }
  drawEnemy(ctx, e, pos, ts) {
    const def = C.ENEMIES[e.kind] || C.ENEMIES.ZOMBIE;
    const x = pos.x * ts, y = pos.y * ts, r = def.radius * ts;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.hit ? '#fff' : def.color; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (e.kind === 'BOSS') { ctx.fillStyle = '#ffd54f'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.5 - r * 0.2, y - r * 0.8); ctx.lineTo(x + k * r * 0.5, y - r * 1.3); ctx.lineTo(x + k * r * 0.5 + r * 0.2, y - r * 0.8); ctx.closePath(); ctx.fill(); } }
    ctx.fillStyle = '#b71c1c'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.35); ctx.lineTo(x + r * 0.3, y + r * 0.35); ctx.stroke();
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - r, y - r - 8, r * 2, 4);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(x - r, y - r - 8, r * 2 * Math.max(0, e.hp / e.maxHp), 4);
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
      const g = dctx.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, radius * ts * dpr);
      g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.beginPath(); dctx.arc(sx * dpr, sy * dpr, radius * ts * dpr, 0, Math.PI * 2); dctx.fill();
    };
    for (const p of view.players) if (p.alive) { const pos = view.pos(p); light(pos.x, pos.y, 4.5, 1); }
    const x0 = Math.max(0, Math.floor(this.cam.x - this.W / ts)), x1 = Math.min(view.w - 1, Math.ceil(this.cam.x + this.W / ts));
    const y0 = Math.max(0, Math.floor(this.cam.y - this.H / ts)), y1 = Math.min(view.h - 1, Math.ceil(this.cam.y + this.H / ts));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = view.tiles[y * view.w + x];
      if (t === T.CAMPFIRE) light(x + 0.5, y + 0.5, 5.5 + 0.3 * Math.sin(tNow / 120 + x), 1);
      else if (t === T.TURRET) light(x + 0.5, y + 0.5, 2.5, 0.8);
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(d, 0, 0);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  drawMinimap(view, myId) {
    const m = this.mini, ctx = this.mctx, s = m.width / view.w;
    if (this.miniVersion !== view.tilesVersion) {
      this.miniLayer.width = m.width; this.miniLayer.height = m.height;
      const l = this.miniLayer.getContext('2d');
      for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) { l.fillStyle = MINI_COLORS[view.tiles[y * view.w + x]] || '#000'; l.fillRect(x * s, y * s, s, s); }
      this.miniVersion = view.tilesVersion;
    }
    ctx.drawImage(this.miniLayer, 0, 0);
    if (view.darkness() > 0.3) { ctx.fillStyle = 'rgba(0,0,20,.45)'; ctx.fillRect(0, 0, m.width, m.height); }
    for (const e of view.enemies) { ctx.fillStyle = e.kind === 'BOSS' ? '#ff1744' : '#ff5252'; ctx.fillRect(e.x * s - 1, e.y * s - 1, 3, 3); }
    for (const p of view.players) { if (!p.alive) continue; ctx.fillStyle = p.color; ctx.fillRect(p.x * s - 2, p.y * s - 2, 4, 4); if (p.id === myId) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(p.x * s - 3, p.y * s - 3, 6, 6); } }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    ctx.strokeRect((this.cam.x - this.W / 2 / this.ts) * s, (this.cam.y - this.H / 2 / this.ts) * s, (this.W / this.ts) * s, (this.H / this.ts) * s);
  }
}
