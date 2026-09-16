/**
 * Canvas battlefield renderer: camera, interpolation between sim ticks,
 * sprites, projectiles, effects. Reads sim state, never mutates it.
 */
import { MAP, DT } from '../core/data/balance.ts';
import { unitDef } from '../core/data/units.ts';
import type { Match } from '../core/sim/match.ts';
import type { Unit, Projectile } from '../core/sim/state.ts';
import type { Team } from '../core/types.ts';
import { drawUnitSprite, drawBuilding, TEAM_COLORS } from './sprites.ts';
import { Fx } from './fx.ts';

const SPRITE_SCALE = 1.25; // visual size boost; collision radii unchanged

interface RenderUnitState { facing: number; turret: number; recoil: number; }

export interface RenderSettings { quality: 'auto' | 'high' | 'low'; hpBars: 'damaged' | 'all' | 'none'; shake: boolean; flash: boolean; }

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  fx = new Fx();
  cam = { x: MAP.W / 2, y: MAP.H / 2, zoom: 0.5 };
  follow: 'front' | 'free' = 'front';
  viewerTeam: Team = 0;
  selectedUnit = 0;
  cannonMode = false;
  cannonPreview: { x: number; y: number } | null = null;
  settings: RenderSettings = { quality: 'auto', hpBars: 'damaged', shake: true, flash: true };
  dpr = 1;
  cw = 0;
  ch = 0;
  quality = 1;
  fps = 60;
  private frameTimes: number[] = [];
  private rs = new Map<number, RenderUnitState>();
  private time = 0;
  private lastFrame = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(this.quality > 0 ? 2 : 1.25, window.devicePixelRatio || 1);
    this.cw = Math.max(1, Math.round(r.width));
    this.ch = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
    this.clampCamera();
  }

  minZoom(): number {
    return Math.min(this.cw / MAP.W, this.ch / MAP.H) * 0.98;
  }

  clampCamera() {
    const mz = this.minZoom();
    this.cam.zoom = Math.max(mz, Math.min(2.4, this.cam.zoom));
    const hw = this.cw / 2 / this.cam.zoom, hh = this.ch / 2 / this.cam.zoom;
    if (hw * 2 >= MAP.W) this.cam.x = MAP.W / 2; else this.cam.x = Math.max(hw, Math.min(MAP.W - hw, this.cam.x));
    if (hh * 2 >= MAP.H) this.cam.y = MAP.H / 2; else this.cam.y = Math.max(hh, Math.min(MAP.H - hh, this.cam.y));
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.cw / 2) / this.cam.zoom + this.cam.x, y: (sy - this.ch / 2) / this.cam.zoom + this.cam.y };
  }

  pan(dx: number, dy: number) {
    this.cam.x -= dx / this.cam.zoom; this.cam.y -= dy / this.cam.zoom;
    this.follow = 'free';
    this.clampCamera();
  }
  zoomAt(factor: number, sx: number, sy: number) {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.max(this.minZoom(), Math.min(2.4, this.cam.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.clampCamera();
  }
  jumpTo(x: number, y: number, zoom?: number) {
    this.cam.x = x; this.cam.y = y;
    if (zoom) this.cam.zoom = zoom;
    this.follow = 'free';
    this.clampCamera();
  }
  followFront() { this.follow = 'front'; }

  /** Point of interest: centre of engaged units, else midpoint of the two fronts. */
  private frontPoint(m: Match): { x: number; y: number } {
    let sx = 0, sy = 0, n = 0;
    for (const u of m.s.units) {
      if (u.move === 'engage' && u.targetId > 0) { sx += u.x; sy += u.y; n++; }
    }
    if (n >= 2) return { x: sx / n, y: sy / n };
    let maxL = -Infinity, minR = Infinity, ly = MAP.H / 2, ry = MAP.H / 2;
    for (const u of m.s.units) {
      if (u.team === 0 && u.x > maxL) { maxL = u.x; ly = u.y; }
      if (u.team === 1 && u.x < minR) { minR = u.x; ry = u.y; }
    }
    if (maxL === -Infinity && minR === Infinity) return { x: MAP.W / 2, y: MAP.H / 2 };
    if (maxL === -Infinity) return { x: minR, y: ry };
    if (minR === Infinity) return { x: maxL, y: ly };
    return { x: (maxL + minR) / 2, y: (ly + ry) / 2 };
  }

  pickUnit(m: Match, wx: number, wy: number): Unit | null {
    let best: Unit | null = null, bd = 18 / this.cam.zoom + 10;
    for (const u of m.s.units) {
      const d = Math.hypot(u.x - wx, u.y - wy) - unitDef(u.type).radius;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  render(m: Match, alpha: number, now: number) {
    const ctx = this.ctx;
    const s = m.s;
    const frameDt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    this.time += frameDt;
    // fps + adaptive quality
    this.frameTimes.push(frameDt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = 1 / Math.max(1e-3, avg);
    const wantQ = this.settings.quality === 'low' ? 0 : this.settings.quality === 'high' ? 1 : (this.fps < 40 && this.frameTimes.length >= 60 ? 0 : this.quality);
    if (wantQ !== this.quality) { this.quality = wantQ; this.fx.quality = wantQ; this.resize(); }

    // camera follow
    if (this.follow === 'front' && s.phase === 'battle') {
      const p = this.frontPoint(m);
      this.cam.x += (p.x - this.cam.x) * Math.min(1, frameDt * 2.2);
      this.cam.y += (p.y - this.cam.y) * Math.min(1, frameDt * 2.2);
      this.clampCamera();
    }
    this.fx.update(frameDt);
    const z = this.cam.zoom * this.dpr;
    let shx = 0, shy = 0;
    if (this.fx.shake > 0 && this.settings.shake) { shx = (Math.random() - 0.5) * this.fx.shake; shy = (Math.random() - 0.5) * this.fx.shake; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1526';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z, 0, 0, z, (this.cw / 2 - this.cam.x * this.cam.zoom + shx) * this.dpr, (this.ch / 2 - this.cam.y * this.cam.zoom + shy) * this.dpr);

    const viewL = this.cam.x - this.cw / 2 / this.cam.zoom - 60, viewR = this.cam.x + this.cw / 2 / this.cam.zoom + 60;
    const viewT = this.cam.y - this.ch / 2 / this.cam.zoom - 60, viewB = this.cam.y + this.ch / 2 / this.cam.zoom + 60;

    this.drawTerrain(ctx, viewL, viewR, viewT, viewB);
    this.drawRelay(ctx, m);
    // cannon zone
    if (this.cannonMode) {
      const team = this.viewerTeam;
      ctx.fillStyle = 'rgba(255,80,80,0.12)';
      const x0 = team === 0 ? 0 : MAP.W - MAP.cannonZoneX;
      ctx.fillRect(x0, 0, MAP.cannonZoneX, MAP.H);
      ctx.strokeStyle = 'rgba(255,120,120,0.7)'; ctx.lineWidth = 2 / this.cam.zoom; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(team === 0 ? MAP.cannonZoneX : MAP.W - MAP.cannonZoneX, 0); ctx.lineTo(team === 0 ? MAP.cannonZoneX : MAP.W - MAP.cannonZoneX, MAP.H); ctx.stroke(); ctx.setLineDash([]);
      if (this.cannonPreview) {
        ctx.strokeStyle = 'rgba(255,200,80,0.9)'; ctx.lineWidth = 3 / this.cam.zoom;
        ctx.beginPath(); ctx.arc(this.cannonPreview.x, this.cannonPreview.y, 120, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const c of s.cannon) {
      if (c.pending) {
        const k = 1 - Math.max(0, c.pending.at - s.t) / 1.5;
        ctx.strokeStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(this.time * 20)})`; ctx.lineWidth = 3 / this.cam.zoom;
        ctx.beginPath(); ctx.arc(c.pending.x, c.pending.y, 120, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,60,0.15)'; ctx.beginPath(); ctx.arc(c.pending.x, c.pending.y, 120 * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    // buildings
    for (const b of s.buildings) {
      ctx.save(); ctx.translate(b.x, b.y);
      drawBuilding(ctx, b.kind, b.team, b.r, b.hp / b.maxHp, b.alive, b.facing, this.time, b.team === this.viewerTeam, m.buildingAttackable(b));
      ctx.restore();
      if (b.kind === 'core' && b.alive && !m.buildingAttackable(b) && this.cam.zoom > 0.45) {
        ctx.fillStyle = 'rgba(160,210,255,0.9)'; ctx.font = `${12 / this.cam.zoom}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText('보호됨 (전방 거점 파괴 필요)', b.x, b.y + b.r + 22 / this.cam.zoom);
      }
    }
    // spawn zones (subtle)
    this.drawSpawnGrid(ctx);

    // units: ground then air
    const units = s.units;
    const zoom = this.cam.zoom;
    const showBars = this.settings.hpBars;
    for (let pass = 0; pass < 2; pass++) {
      for (const u of units) {
        const air = u.layer === 'air';
        if ((pass === 0) === air) continue;
        const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
        if (x < viewL || x > viewR || y < viewT || y > viewB) continue;
        this.drawUnit(ctx, u, x, y, air, frameDt, showBars, zoom);
      }
    }
    // projectiles
    for (const p of s.projectiles) if (!p.dead) this.drawProjectile(ctx, p, alpha);
    this.fx.draw(ctx, zoom);
    // selection ring + range
    if (this.selectedUnit) {
      const u = m.unit(this.selectedUnit);
      if (u) {
        const def = unitDef(u.type);
        const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
        ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2 / zoom; ctx.beginPath(); ctx.arc(x, y, def.radius + 6, 0, Math.PI * 2); ctx.stroke();
        if (def.weapon) { ctx.strokeStyle = 'rgba(255,207,74,0.35)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, def.weapon.range + def.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (def.ability) { ctx.strokeStyle = 'rgba(74,222,128,0.4)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(x, y, def.ability.range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      } else this.selectedUnit = 0;
    }
    // flash overlay
    if (this.fx.flash > 0 && this.settings.flash) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,240,200,${Math.min(0.6, this.fx.flash)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // gc render states occasionally
    if (this.rs.size > units.length + 200) {
      const ids = new Set(units.map((u) => u.id));
      for (const k of this.rs.keys()) if (!ids.has(k)) this.rs.delete(k);
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, air: boolean, dt: number, showBars: RenderSettings['hpBars'], zoom: number) {
    const def = unitDef(u.type);
    let st = this.rs.get(u.id);
    if (!st) { st = { facing: u.facing, turret: u.facing, recoil: 0 }; this.rs.set(u.id, st); }
    // smooth body facing; turret snaps faster
    const lerpAng = (a: number, b: number, k: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
    const moving = Math.abs(u.vx) + Math.abs(u.vy) > 2;
    const hasTurret = ['piercer', 'howitzer', 'flak', 'sprayer', 'railgun', 'thrower'].includes(u.type);
    const bodyTarget = moving && hasTurret ? Math.atan2(u.vy, u.vx) : u.facing;
    st.facing = lerpAng(st.facing, bodyTarget, Math.min(1, dt * (air ? 4 : 8)));
    st.turret = lerpAng(st.turret, u.facing, Math.min(1, dt * 10));
    const windup = u.phase === 'windup' && def.weapon ? 1 - Math.max(0, u.phaseT) / Math.max(0.01, def.weapon.windup) : 0;
    if (u.phase === 'recover' && def.weapon && u.phaseT > def.weapon.recover - 0.05) st.recoil = 1;
    st.recoil = Math.max(0, st.recoil - dt * 5);
    const ally = u.team === this.viewerTeam;
    // shadow / height for air
    if (air) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x + 10, y + 22, def.radius * 1.1, def.radius * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // team ring under the unit
      ctx.strokeStyle = ally ? 'rgba(160,200,255,0.55)' : 'rgba(255,90,90,0.55)'; ctx.lineWidth = 1.2 / zoom;
      if (!ally) ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.ellipse(x, y + 2, def.radius + 2, (def.radius + 2) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    const bob = air ? Math.sin(this.time * 3 + u.id) * 2 : 0;
    ctx.translate(x, y - (air ? 14 : 0) + bob);
    ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
    if (air && moving) {
      // bank: tilt with lateral velocity
      const bank = Math.max(-0.35, Math.min(0.35, u.vy / 300));
      ctx.transform(1, 0, 0, 1 - Math.abs(bank) * 0.3, 0, 0);
    }
    if (u.hp < u.maxHp * 0.35 && this.quality > 0 && Math.random() < 0.15) this.fx.spawn('smoke', x, y, 0.8, 4, 'rgba(60,60,70,0.5)', 0, -20);
    drawUnitSprite(ctx, u.type, {
      team: u.team, faction: def.faction, facing: st.facing, turret: st.turret, anim: u.anim, t: this.time + u.id * 0.37,
      windup, recoil: st.recoil, moving, ally, flash: u.flash > 0 ? 1 : 0, air, quality: this.quality,
    });
    ctx.restore();
    // shield ring
    if (u.shield > 0) {
      ctx.strokeStyle = 'rgba(100,220,255,0.8)'; ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i + this.time; const px = x + Math.cos(a) * (def.radius + 6), py = y + Math.sin(a) * (def.radius + 6); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath(); ctx.stroke();
    }
    // hp bar
    const frac = u.hp / u.maxHp;
    const wantBar = showBars === 'all' || (showBars === 'damaged' && frac < 0.999) || u.id === this.selectedUnit;
    if (wantBar && zoom > 0.3) {
      const w = def.radius * 2 + 6, h = 3 / zoom;
      const by = y - def.radius - 8 - (air ? 14 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, by, w, h);
      ctx.fillStyle = frac > 0.5 ? (ally ? '#4ade80' : '#f87171') : frac > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(x - w / 2, by, w * frac, h);
      if (u.shield > 0) { ctx.fillStyle = 'rgba(100,220,255,0.9)'; ctx.fillRect(x - w / 2, by - h - 1 / zoom, w * Math.min(1, u.shield / u.maxHp), h * 0.8); }
    }
    // support pool indicator
    if (def.ability && zoom > 0.6) {
      const w = def.radius * 2 + 6, h = 2.5 / zoom;
      const frac2 = u.pool / (def.ability.pool * u.supMult);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y + def.radius + 4, w, h);
      ctx.fillStyle = def.ability.kind === 'repair' ? '#4ade80' : '#67e8f9'; ctx.fillRect(x - w / 2, y + def.radius + 4, w * Math.max(0, frac2), h);
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, alpha: number) {
    const col = TEAM_COLORS[p.team];
    if (p.kind === 'arc' || p.kind === 'bomb') {
      const k = Math.min(1, (p.t + DT * alpha) / p.dur);
      const x = p.sx + (p.tx - p.sx) * k, y = p.sy + (p.ty - p.sy) * k;
      const h = p.kind === 'bomb' ? (1 - k) * 40 : Math.sin(k * Math.PI) * Math.min(160, Math.hypot(p.tx - p.sx, p.ty - p.sy) * 0.35);
      // shadow on the ground
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      // shell in the air
      ctx.fillStyle = p.unitType === 'thrower' ? '#374151' : '#1f2430';
      ctx.beginPath(); ctx.arc(x, y - h, p.unitType === 'howitzer' ? 4.5 : 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col.light; ctx.lineWidth = 1; ctx.stroke();
      // target marker
      ctx.strokeStyle = 'rgba(255,200,100,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.tx, p.ty, p.aoe * 0.9, 0, Math.PI * 2); ctx.stroke();
    } else if (p.kind === 'flak') {
      const dx = p.tx - p.x, dy = p.ty - p.y; const d = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (dx / d) * 14, p.y - (dy / d) * 14); ctx.stroke();
    } else {
      const dx = p.tx - p.x, dy = p.ty - p.y; const d = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = '#ffedd5'; ctx.beginPath(); ctx.arc(p.x, p.y, p.unitType === 'piercer' ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,120,0.6)'; ctx.lineWidth = p.unitType === 'piercer' ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (dx / d) * 18, p.y - (dy / d) * 18); ctx.stroke();
    }
  }

  private drawTerrain(ctx: CanvasRenderingContext2D, l: number, r: number, t: number, b: number) {
    ctx.fillStyle = '#16203a';
    ctx.fillRect(0, 0, MAP.W, MAP.H);
    // subtle ground patches (deterministic)
    if (this.quality > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let i = 0; i < 40; i++) {
        const px = ((i * 977) % MAP.W), py = ((i * 613) % MAP.H), pr = 40 + (i * 37) % 90;
        if (px < l - pr || px > r + pr || py < t - pr || py > b + pr) continue;
        ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 0.6, i, 0, Math.PI * 2); ctx.fill();
      }
    }
    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1 / this.cam.zoom;
    ctx.beginPath();
    for (let x = Math.max(0, Math.floor(l / 200) * 200); x <= Math.min(MAP.W, r); x += 200) { ctx.moveTo(x, 0); ctx.lineTo(x, MAP.H); }
    for (let y = Math.max(0, Math.floor(t / 200) * 200); y <= Math.min(MAP.H, b); y += 200) { ctx.moveTo(0, y); ctx.lineTo(MAP.W, y); }
    ctx.stroke();
    // team halves tint
    ctx.fillStyle = 'rgba(79,140,255,0.05)'; ctx.fillRect(0, 0, MAP.W / 2, MAP.H);
    ctx.fillStyle = 'rgba(255,93,93,0.05)'; ctx.fillRect(MAP.W / 2, 0, MAP.W / 2, MAP.H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(MAP.W / 2, 0); ctx.lineTo(MAP.W / 2, MAP.H); ctx.stroke(); ctx.setLineDash([]);
    // map border
    ctx.strokeStyle = '#2b3655'; ctx.lineWidth = 4 / this.cam.zoom; ctx.strokeRect(0, 0, MAP.W, MAP.H);
  }

  private drawSpawnGrid(ctx: CanvasRenderingContext2D) {
    if (this.cam.zoom < 0.35) return;
    for (const team of [0, 1] as Team[]) {
      const tc = TEAM_COLORS[team];
      ctx.strokeStyle = tc.main; ctx.globalAlpha = 0.18; ctx.lineWidth = 1 / this.cam.zoom;
      const x0 = MAP.spawnX0 - 15, x1 = MAP.spawnX0 + 7 * MAP.spawnColGap + 15;
      const y0 = MAP.spawnY0 - 40, y1 = MAP.spawnY0 + 5 * MAP.spawnRowGap + 40;
      const fx = (x: number) => (team === 0 ? x : MAP.W - x);
      ctx.strokeRect(Math.min(fx(x0), fx(x1)), y0, Math.abs(fx(x1) - fx(x0)), y1 - y0);
      for (let r = 0; r < 6; r++) { const y = MAP.spawnY0 + r * MAP.spawnRowGap; ctx.beginPath(); ctx.moveTo(fx(x0), y); ctx.lineTo(fx(x1), y); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }

  private drawRelay(ctx: CanvasRenderingContext2D, m: Match) {
    const r = m.s.relay;
    const col = r.owner === 0 ? TEAM_COLORS[0].main : r.owner === 1 ? TEAM_COLORS[1].main : '#8b93a7';
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.arc(MAP.relayX, MAP.relayY, MAP.relayR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3 / this.cam.zoom; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(MAP.relayX, MAP.relayY, MAP.relayR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // tower
    ctx.fillStyle = '#3a4150'; ctx.beginPath(); ctx.arc(MAP.relayX, MAP.relayY, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(MAP.relayX, MAP.relayY); ctx.lineTo(MAP.relayX, MAP.relayY - 26); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(MAP.relayX, MAP.relayY - 28, 5 + Math.sin(this.time * 4) * 1.5, 0, Math.PI * 2); ctx.fill();
    // capture progress arc
    const prog = Math.abs(r.progress);
    if (prog > 0.001 && r.owner === -1 || r.contested) {
      const pc = r.progress > 0 ? TEAM_COLORS[0].main : TEAM_COLORS[1].main;
      ctx.strokeStyle = r.contested ? '#ffcf4a' : pc; ctx.lineWidth = 6 / this.cam.zoom;
      ctx.beginPath(); ctx.arc(MAP.relayX, MAP.relayY, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
    }
    if (this.cam.zoom > 0.4) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `${12 / this.cam.zoom}px sans-serif`; ctx.textAlign = 'center';
      const label = r.contested ? '중계소: 경합 중' : r.owner === -1 ? (prog > 0.01 ? `중계소 점령 중 ${Math.round(prog * 100)}%` : '중계소 (중립)') : r.owner === this.viewerTeam ? '중계소: 아군 점령 (+8% 수입)' : '중계소: 적 점령';
      ctx.fillText(label, MAP.relayX, MAP.relayY + MAP.relayR + 18 / this.cam.zoom);
    }
  }

  /** Small live minimap into another canvas. */
  drawMini(m: Match, mini: HTMLCanvasElement) {
    const c = mini.getContext('2d')!;
    const r = mini.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (mini.width !== Math.round(r.width * dpr)) { mini.width = Math.round(r.width * dpr); mini.height = Math.round(r.height * dpr); }
    const sx = mini.width / MAP.W, sy = mini.height / MAP.H;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#16203a'; c.fillRect(0, 0, mini.width, mini.height);
    c.fillStyle = 'rgba(79,140,255,0.08)'; c.fillRect(0, 0, mini.width / 2, mini.height);
    c.fillStyle = 'rgba(255,93,93,0.08)'; c.fillRect(mini.width / 2, 0, mini.width / 2, mini.height);
    for (const b of m.s.buildings) { c.fillStyle = b.alive ? TEAM_COLORS[b.team].main : '#444'; c.beginPath(); c.arc(b.x * sx, b.y * sy, (b.kind === 'core' ? 5 : 3.5) * dpr, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#8b93a7'; c.beginPath(); c.arc(MAP.relayX * sx, MAP.relayY * sy, 2.5 * dpr, 0, Math.PI * 2); c.fill();
    for (const u of m.s.units) { c.fillStyle = u.team === 0 ? '#7eb0ff' : '#ff8a8a'; c.fillRect(u.x * sx - dpr, u.y * sy - dpr, 2 * dpr, 2 * dpr); }
    // camera rect
    const hw = this.cw / 2 / this.cam.zoom, hh = this.ch / 2 / this.cam.zoom;
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = dpr; c.strokeRect((this.cam.x - hw) * sx, (this.cam.y - hh) * sy, hw * 2 * sx, hh * 2 * sy);
  }
}
