// Canvas 2D world renderer with a following camera. Reads AttemptState, never mutates it.
import { DEVICE, ENEMY, PLAYER, TILE, WEAPONS } from '../sim/constants';
import type { AttemptState, GameEvent } from '../sim/types';
import { Fx } from './fx';
import { GHOST_STYLES, PLAYER_STYLE, drawEnemy, drawExit, drawGenerator, drawGhostBadge, drawLaser, drawPlate, drawThief, drawVault } from './sprites';

export const VIEW_W = 520; // world units visible across the screen width
const TAU = Math.PI * 2;

export interface JoystickView { active: boolean; ox: number; oy: number; dx: number; dy: number }

export class Renderer {
  ctx: CanvasRenderingContext2D; dpr = 1; cssW = 1; cssH = 1; scale = 1; camX = 0; camY = 0;
  fx = new Fx(); time = 0; linkPulse = new Map<string, number>(); private camInit = false; reduceMotion = false;
  private floorPattern: CanvasPattern | null = null;
  constructor(public canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D; }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW); this.cssH = Math.max(1, cssH); this.dpr = Math.min(3, dpr || 1);
    this.canvas.width = Math.round(this.cssW * this.dpr); this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = this.cssW + 'px'; this.canvas.style.height = this.cssH + 'px';
    this.scale = this.cssW / VIEW_W; this.floorPattern = null;
  }
  resetCamera(): void { this.camInit = false; this.fx.parts = []; this.linkPulse.clear(); }
  viewW(): number { return VIEW_W; }
  viewH(): number { return this.cssH / this.scale; }
  worldToScreen(x: number, y: number): { x: number; y: number } { return { x: (x - this.camX) * this.scale, y: (y - this.camY) * this.scale }; }

  /** Translate simulation events into visual effects. */
  handleEvents(evs: GameEvent[], st: AttemptState): void {
    const fx = this.fx;
    for (const e of evs) {
      switch (e.kind) {
        case 'shot': { const c = e.owner === 'enemy' ? '#ff6a6a' : e.owner === 'ghost' ? (GHOST_STYLES[e.ghost]?.tint || '#4fd8ff') : '#ffd27a'; const ox = e.x + Math.cos(e.angle) * 18, oy = e.y + Math.sin(e.angle) * 18; fx.burst(ox, oy, e.weapon === 'shotgun' ? 6 : 2, c, 140, 0.12, 2.5, 'spark'); if (e.owner === 'player') fx.kick(e.weapon === 'shotgun' ? 1.2 : 0.35); break; }
        case 'hit': if (e.target === 'wall') fx.burst(e.x, e.y, 2, '#aab', 60, 0.2, 1.5); else if (e.target === 'enemy') fx.burst(e.x, e.y, 4, '#ffd27a', 120, 0.25, 2, 'spark'); else if (e.target === 'generator') { fx.burst(e.x, e.y, 5, '#ffe28a', 140, 0.3, 2, 'spark'); } else fx.burst(e.x, e.y, 5, '#ff6a6a', 100, 0.3, 2.5); break;
        case 'enemyDied': fx.burst(e.x, e.y, 16, e.enemyKind === 'heavy' ? '#b58cff' : e.enemyKind === 'turret' ? '#c9ccd6' : '#ff8a6a', 180, 0.5, 3.5); fx.ring(e.x, e.y, '#fff', 34, 0.35); fx.smoke(e.x, e.y, 5); fx.kick(1.5); if (e.by !== 'player') fx.text(e.x, e.y - 24, `${labelOf(e.by)} 처치`, GHOST_STYLES[ghostIdx(e.by)]?.tint || '#fff'); break;
        case 'generatorDestroyed': fx.burst(e.x, e.y, 26, '#ffd54a', 220, 0.7, 4); fx.ring(e.x, e.y, '#ffd54a', 60, 0.6); fx.smoke(e.x, e.y, 8, 'rgba(60,60,70,0.6)'); fx.kick(2.2); fx.text(e.x, e.y - 30, `${labelOf(e.by)} 발전기 파괴!`, '#ffd54a', 1.6); for (const l of e.lasers) this.linkPulse.set('laser:' + l, 1.6); break;
        case 'laserChanged': { const l = st.lasers.find((x) => x.id === e.id); if (l && e.phase === 'off' && l.source.kind === 'generator') { const cx = l.rect.x + l.rect.w / 2, cy = l.rect.y + l.rect.h / 2; fx.ring(cx, cy, '#7dffa0', 40, 0.5); fx.text(cx, cy - 16, '레이저 꺼짐', '#7dffa0', 1.4); } break; }
        case 'plateChanged': { const p = st.plates.find((x) => x.id === e.id); if (p) { fx.ring(p.x, p.y, e.pressed ? '#4fd8ff' : '#889', 30, 0.4); if (e.pressed) { fx.text(p.x, p.y - 30, `${e.by.map(labelOf).join('·')} 발판 ${p.label}`, '#9feaff', 1.2); this.linkPulse.set('plate:' + p.id, 1.4); } } break; }
        case 'vaultChanged': fx.ring(st.vault.x, st.vault.y, e.open ? '#7dffa0' : '#ff7b7b', 46, 0.5); fx.text(st.vault.x, st.vault.y - 44, e.open ? '금고 열림!' : '금고 잠김', e.open ? '#7dffa0' : '#ff7b7b', 1.2); break;
        case 'corePicked': fx.burst(st.vault.x, st.vault.y, 22, '#ffcf4d', 160, 0.6, 3); fx.ring(st.vault.x, st.vault.y, '#ffcf4d', 50, 0.5); fx.text(st.player.x, st.player.y - 34, '코어 확보! 출구로', '#ffcf4d', 1.5); break;
        case 'playerHit': fx.ring(e.x, e.y, '#ff5a5a', 26, 0.3); fx.burst(e.x, e.y, 8, '#ff7b7b', 120, 0.3, 2.5); fx.kick(2.5); fx.text(e.x, e.y - 28, e.cause, '#ff9a9a', 1.0); break;
        case 'dash': if (e.owner === 'player') { fx.burst(e.x, e.y, 6, '#cfd6ff', 90, 0.25, 2); } break;
        case 'ghostSpawn': { const c = GHOST_STYLES[e.ghost]?.tint || '#4fd8ff'; fx.ring(e.x, e.y, c, 40, 0.6); fx.ring(e.x, e.y, c, 24, 0.9); fx.text(e.x, e.y - 40, `${e.ghost + 1}번 분신 · 이전 기록`, c, 1.8); break; }
        case 'ghostHold': { const g = st.ghosts.find((x) => x.slot === e.ghost); if (g) fx.text(g.x, g.y - 30, `${e.ghost + 1}번 위치 유지`, GHOST_STYLES[e.ghost]?.tint || '#4fd8ff', 1.2); break; }
        case 'ghostGone': { const g = st.ghosts.find((x) => x.slot === e.ghost); if (g) { fx.burst(g.x, g.y, 10, GHOST_STYLES[e.ghost]?.tint || '#4fd8ff', 60, 0.5, 2); fx.text(g.x, g.y - 24, e.endKind === 'death' ? `${e.ghost + 1}번 기록 끝(사망)` : `${e.ghost + 1}번 기록 끝`, '#9fb', 1.0); } break; }
        case 'escape': fx.burst(st.player.x, st.player.y, 40, '#7dffa0', 220, 0.9, 3.5); fx.ring(st.player.x, st.player.y, '#fff', 60, 0.7); break;
        default: break;
      }
    }
    // dash afterimages every tick while dashing
    if (st.player.dashTicks > 0 && !this.reduceMotion) this.fx.afterimage(st.player.x, st.player.y, st.player.facing, '#9fb4ff');
    for (const g of st.ghosts) if (g.present && g.rec.dashes.some((d) => d <= st.tick && d > st.tick - 9)) this.fx.afterimage(g.x, g.y, g.facing, GHOST_STYLES[g.slot]?.tint || '#4fd8ff');
  }

  update(dt: number): void { this.time += dt; this.fx.update(dt); for (const [k, v] of this.linkPulse) { if (v - dt <= 0) this.linkPulse.delete(k); else this.linkPulse.set(k, v - dt); } }

  render(st: AttemptState, joy: JoystickView | null): void {
    const ctx = this.ctx; const s = this.scale; const dpr = this.dpr; const t = this.time;
    // camera
    const vw = this.viewW(), vh = this.viewH(); const p = st.player;
    const tx = p.x + p.vx * 0.12, ty = p.y + p.vy * 0.12;
    const cx = st.map.width < vw ? (st.map.width - vw) / 2 : Math.max(0, Math.min(st.map.width - vw, tx - vw / 2));
    const cy = st.map.height < vh ? (st.map.height - vh) / 2 : Math.max(0, Math.min(st.map.height - vh, ty - vh / 2));
    if (!this.camInit) { this.camX = cx; this.camY = cy; this.camInit = true; } else { this.camX += (cx - this.camX) * 0.12; this.camY += (cy - this.camY) * 0.12; }
    let shx = 0, shy = 0; if (this.fx.shake > 0 && !this.reduceMotion) { shx = (Math.random() - 0.5) * this.fx.shake; shy = (Math.random() - 0.5) * this.fx.shake; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e1a'; ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, (-this.camX + shx) * s * dpr, (-this.camY + shy) * s * dpr);
    const x0 = this.camX - 20, y0 = this.camY - 20, x1 = this.camX + vw + 20, y1 = this.camY + vh + 20;
    this.drawFloor(ctx, st, x0, y0, x1, y1, t);
    this.drawLinks(ctx, st, t);
    for (const pl of st.plates) drawPlate(ctx, pl, t, plateColor(pl.pressedBy));
    drawExit(ctx, st.exit.x, st.exit.y, p.hasCore, t);
    this.drawWalls(ctx, st, x0, y0, x1, y1);
    for (const l of st.lasers) drawLaser(ctx, l, t);
    drawVault(ctx, st.vault, locksLeft(st), t);
    for (const g of st.generators) drawGenerator(ctx, g, t);
    // dead robots as wrecks
    for (const e of st.enemies) if (!e.alive) { ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = 0.6; ctx.fillStyle = '#2a2d3a'; ctx.beginPath(); ctx.ellipse(0, 4, ENEMY[e.kind].radius, ENEMY[e.kind].radius * 0.55, 0.3, 0, TAU); ctx.fill(); ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke(); ctx.restore(); }
    for (const b of st.projectiles) this.drawProjectile(ctx, b);
    for (const e of st.enemies) if (e.alive) drawEnemy(ctx, e, p.x, p.y, t);
    for (const g of st.ghosts) if (g.present) { const style = GHOST_STYLES[g.slot % GHOST_STYLES.length]; const walk = st.tick * 2.7; if (g.spawnFx > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = style.tint || '#4fd8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, 20 + g.spawnFx * 1.5, 0, TAU); ctx.stroke(); ctx.restore(); } drawThief(ctx, g.x, g.y, g.facing, walk, g.moving, g.recoil / 4, 0, 0, style, g.rec.weapon, false, t); drawGhostBadge(ctx, g.x, g.y, g.slot, g.holding, style); }
    // target indicator
    if (p.alive && p.targetKind) { const tp = p.targetKind === 'enemy' ? st.enemies.find((e) => e.id === p.targetId) : st.generators.find((g) => g.id === p.targetId); if (tp) { ctx.save(); ctx.strokeStyle = p.targetKind === 'generator' ? 'rgba(255,213,74,0.8)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(tp.x, tp.y, (p.targetKind === 'enemy' ? ENEMY[(tp as { kind: keyof typeof ENEMY }).kind].radius : DEVICE.generatorRadius) + 7, 0, TAU); ctx.stroke(); ctx.restore(); } }
    if (p.alive && p.grab > 0) { const k = p.grab / Math.round(PLAYER.coreGrabSec * 60); ctx.save(); ctx.strokeStyle = 'rgba(255,207,77,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.radius + 9, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffcf4d'; ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.radius + 9, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); ctx.fillStyle = '#ffcf4d'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('회수 중…', p.x, p.y - PLAYER.radius - 18); ctx.restore(); }
    if (p.alive) { const dash = p.dashTicks > 0 ? 1 : 0; const invulnBlink = p.invuln > 0 && Math.floor(t * 20) % 2 === 0; if (!invulnBlink || p.hitFlash > 0) drawThief(ctx, p.x, p.y, p.facing, p.steps, p.moving, p.recoil / 5, dash, p.hitFlash > 6 ? 1 : 0, PLAYER_STYLE, p.weapon, p.hasCore, t); if (p.focusGenerator) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('발전기 조준', p.x, p.y - PLAYER.radius - 18); } }
    else { ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ff7b7b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke(); ctx.restore(); }
    this.fx.draw(ctx);
    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOffscreenGhosts(ctx, st);
    if (joy && joy.active) {
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(207,230,255,0.25)'; ctx.fill();
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#eaf4ff'; ctx.beginPath(); ctx.arc(joy.ox + joy.dx * 46, joy.oy + joy.dy * 46, 20, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  private drawFloor(ctx: CanvasRenderingContext2D, st: AttemptState, x0: number, y0: number, x1: number, y1: number, t: number): void {
    ctx.fillStyle = '#171b2e'; ctx.fillRect(Math.max(0, x0), Math.max(0, y0), Math.min(st.map.width, x1) - Math.max(0, x0), Math.min(st.map.height, y1) - Math.max(0, y0));
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1;
    const c0 = Math.max(0, Math.floor(x0 / TILE)), c1 = Math.min(st.map.cols, Math.ceil(x1 / TILE)); const r0 = Math.max(0, Math.floor(y0 / TILE)), r1 = Math.min(st.map.rows, Math.ceil(y1 / TILE));
    ctx.beginPath(); for (let c = c0; c <= c1; c++) { ctx.moveTo(c * TILE, r0 * TILE); ctx.lineTo(c * TILE, r1 * TILE); } for (let r = r0; r <= r1; r++) { ctx.moveTo(c0 * TILE, r * TILE); ctx.lineTo(c1 * TILE, r * TILE); } ctx.stroke();
    // subtle floor plates
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if (!st.map.solidGrid[r][c] && ((r * 7 + c * 13) % 5 === 0)) ctx.fillRect(c * TILE + 6, r * TILE + 6, TILE - 12, TILE - 12);
    // spawn pad
    const sp = st.map.def.spawn; ctx.strokeStyle = 'rgba(150,200,255,0.15)'; ctx.beginPath(); ctx.arc((sp[0] + 0.5) * TILE, (sp[1] + 0.5) * TILE, 26 + Math.sin(t) * 2, 0, TAU); ctx.stroke();
  }
  private drawWalls(ctx: CanvasRenderingContext2D, st: AttemptState, x0: number, y0: number, x1: number, y1: number): void {
    const g = st.map.solidGrid; const c0 = Math.max(0, Math.floor(x0 / TILE)), c1 = Math.min(st.map.cols - 1, Math.ceil(x1 / TILE)); const r0 = Math.max(0, Math.floor(y0 / TILE)), r1 = Math.min(st.map.rows - 1, Math.ceil(y1 / TILE));
    const solid = (c: number, r: number): boolean => r < 0 || c < 0 || r >= st.map.rows || c >= st.map.cols ? true : g[r][c];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!g[r][c]) continue; const x = c * TILE, y = r * TILE;
      ctx.fillStyle = '#2c3352'; ctx.fillRect(x, y, TILE, TILE);
      if (!solid(c, r - 1)) { ctx.fillStyle = '#414a7c'; ctx.fillRect(x, y, TILE, 6); }
      if (!solid(c, r + 1)) { ctx.fillStyle = '#161a30'; ctx.fillRect(x, y + TILE - 7, TILE, 7); }
      if (!solid(c - 1, r)) { ctx.fillStyle = '#353d68'; ctx.fillRect(x, y, 3, TILE); }
      if (!solid(c + 1, r)) { ctx.fillStyle = '#1e2340'; ctx.fillRect(x + TILE - 3, y, 3, TILE); }
      if ((r * 3 + c * 5) % 7 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x + 8, y + 12, TILE - 16, 4); }
    }
  }
  private drawLinks(ctx: CanvasRenderingContext2D, st: AttemptState, t: number): void {
    ctx.save(); ctx.lineWidth = 2;
    for (const g of st.generators) for (const lid of g.lasers) {
      const l = st.lasers.find((x) => x.id === lid); if (!l) continue; const lx = l.rect.x + l.rect.w / 2, ly = l.rect.y + l.rect.h / 2;
      const pulse = this.linkPulse.get('laser:' + lid) || 0;
      ctx.strokeStyle = pulse > 0 ? `rgba(125,255,160,${0.4 + pulse * 0.4})` : g.alive ? 'rgba(255,120,90,0.35)' : 'rgba(120,130,150,0.2)'; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * (pulse > 0 ? 80 : 20);
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(lx, ly); ctx.stroke();
      if (pulse > 0) { ctx.fillStyle = '#7dffa0'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚡ 꺼짐', (g.x + lx) / 2, (g.y + ly) / 2 - 6); }
    }
    for (const pid of st.vault.plates) {
      const p = st.plates.find((x) => x.id === pid); if (!p) continue; const pulse = this.linkPulse.get('plate:' + pid) || 0;
      ctx.strokeStyle = p.pressed ? `rgba(80,220,255,${0.5 + pulse * 0.3})` : 'rgba(120,160,255,0.25)'; ctx.setLineDash([5, 7]); ctx.lineDashOffset = -t * (p.pressed ? 60 : 15);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(st.vault.x, st.vault.y); ctx.stroke();
    }
    for (const gid of st.vault.generators) { const g = st.generators.find((x) => x.id === gid); if (!g) continue; ctx.strokeStyle = g.alive ? 'rgba(255,213,74,0.3)' : 'rgba(125,255,160,0.5)'; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(st.vault.x, st.vault.y); ctx.stroke(); }
    ctx.restore();
  }
  private drawProjectile(ctx: CanvasRenderingContext2D, b: AttemptState['projectiles'][number]): void {
    const dx = b.x - b.px, dy = b.y - b.py;
    if (b.weapon === 'turret') { ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff6a6a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, TAU); ctx.fill(); return; }
    const c = b.owner === 'ghost' ? (GHOST_STYLES[b.ghost]?.tint || '#4fd8ff') : b.weapon === 'shotgun' ? '#ffb057' : '#ffe08a';
    ctx.strokeStyle = c; ctx.lineWidth = b.weapon === 'shotgun' ? 2.5 : 2; ctx.lineCap = 'round'; ctx.globalAlpha = b.owner === 'ghost' ? 0.8 : 1;
    ctx.beginPath(); ctx.moveTo(b.x - dx * 1.4, b.y - dy * 1.4); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.globalAlpha = 1;
  }
  private drawOffscreenGhosts(ctx: CanvasRenderingContext2D, st: AttemptState): void {
    for (const g of st.ghosts) {
      if (!g.present) continue; const sp = this.worldToScreen(g.x, g.y);
      if (sp.x >= 0 && sp.x <= this.cssW && sp.y >= 0 && sp.y <= this.cssH) continue;
      const px = Math.max(18, Math.min(this.cssW - 18, sp.x)), py = Math.max(18, Math.min(this.cssH - 18, sp.y));
      const c = GHOST_STYLES[g.slot]?.tint || '#4fd8ff'; ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b1020'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(g.slot + 1), px, py + 0.5);
      const a = Math.atan2(sp.y - py, sp.x - px); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 14, py + Math.sin(a) * 14); ctx.lineTo(px + Math.cos(a) * 20, py + Math.sin(a) * 20); ctx.stroke(); ctx.restore();
    }
  }
}

const ghostIdx = (actor: string): number => (actor.startsWith('ghost') ? Number(actor.slice(5)) : -1);
const labelOf = (actor: string): string => (actor === 'player' ? '나' : `${ghostIdx(actor) + 1}번 분신`);
const plateColor = (by: string[]): string => { const g = by.find((b) => b.startsWith('ghost')); return g ? (GHOST_STYLES[ghostIdx(g)]?.tint || '#4fd8ff') : '#9feaff'; };
export function locksLeft(st: AttemptState): number {
  let n = 0; for (const id of st.vault.plates) { const p = st.plates.find((x) => x.id === id); if (p && !p.pressed) n++; } for (const id of st.vault.generators) { const g = st.generators.find((x) => x.id === id); if (g && g.alive) n++; } return n;
}
export { WEAPONS };
