// 전투 화면 렌더러: 시뮬레이션 상태 + 이벤트 → 캔버스. 파티클·흔들림은 여기서만 (게임 상태에 영향 없음).
import type { BattleSim, FxEvent } from '../combat/sim';
import { EQUIPMENT } from '../data/equipment';
import { ENEMIES } from '../data/enemies';
import { BOSS } from '../data/enemies';
import { drawPlayer, drawEnemy, roundRect } from './sprites';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'ring' | 'spark' | 'text' | 'smoke'; text?: string; grow?: number }
interface Fx { kind: 'slash' | 'laser' | 'chain' | 'shock' | 'blast' | 'crushwarn'; x: number; y: number; x2?: number; y2?: number; dir?: number; arc?: number; range?: number; width?: number; r?: number; t: number; max: number }

const MAX_PARTICLES = 160; const MAX_FX = 40;

export class BattleView {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1; scale = 1; ox = 0; oy = 0;
  particles: Particle[] = []; fx: Fx[] = [];
  shake = 0; shakeOn = true; lowFx = false; time = 0;
  crushWarn = 0; flash = 0; enrageBanner = 0; stallBanner = 0;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d')!; }

  resize(sim: BattleSim): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, Math.floor(r.width)); this.H = Math.max(1, Math.floor(r.height));
    this.canvas.width = Math.floor(this.W * this.dpr); this.canvas.height = Math.floor(this.H * this.dpr);
    this.scale = Math.min(this.W / sim.w, this.H / sim.h);
    this.ox = (this.W - sim.w * this.scale) / 2; this.oy = (this.H - sim.h * this.scale) / 2;
  }
  reset(): void { this.particles = []; this.fx = []; this.shake = 0; this.crushWarn = 0; this.flash = 0; }

  /** 시뮬레이션 이벤트를 연출로 바꾼다. 효과음 이름을 돌려준다. */
  consume(events: FxEvent[], sim: BattleSim): string[] {
    const sfx: string[] = [];
    for (const ev of events) {
      switch (ev.type) {
        case 'muzzle': { this.spark(ev.x + Math.cos(ev.dir) * 14, ev.y + Math.sin(ev.dir) * 14, ev.extra ? '#ffe082' : '#fff', 3, ev.dir); sfx.push(ev.extra ? 'extra' : EQUIPMENT[ev.weapon as 'mg'].sfx); break; }
        case 'slash': this.addFx({ kind: 'slash', x: ev.x, y: ev.y, dir: ev.dir, arc: ev.arc, range: ev.range, t: 0, max: 0.18 }); sfx.push('slash'); break;
        case 'laser': this.addFx({ kind: 'laser', x: ev.x, y: ev.y, dir: ev.dir, range: ev.len, width: ev.width, t: 0, max: 0.2 }); sfx.push('laser'); this.shake += 2; break;
        case 'explosion': this.addFx({ kind: 'blast', x: ev.x, y: ev.y, r: ev.r, t: 0, max: 0.35 }); this.burst(ev.x, ev.y, ev.small ? 6 : 14, ev.extra ? '#ffe082' : '#ff7043'); this.shake += ev.small ? 3 : 7; sfx.push('explode'); break;
        case 'hit': {
          this.spark(ev.x, ev.y, ev.chain ? '#e1bee7' : ev.extra ? '#ffe082' : '#fff', ev.chain ? 4 : 2);
          if (ev.chain || ev.extra || ev.dmg >= 20) this.text(ev.x, ev.y - 10, `${ev.dmg % 1 === 0 ? ev.dmg : ev.dmg.toFixed(1)}`, ev.chain ? '#e1bee7' : ev.extra ? '#ffe082' : '#fff');
          sfx.push('hit'); break;
        }
        case 'die': { const d = ENEMIES[ev.enemy]; this.burst(ev.x, ev.y, ev.enemy === 'boss' ? 40 : ev.enemy === 'swarm' ? 4 : 8, d.color); this.smoke(ev.x, ev.y, ev.enemy === 'boss' ? 10 : 2); if (ev.enemy === 'boss') { this.shake += 18; this.flash = 0.5; sfx.push('boss_die'); } else sfx.push('die'); break; }
        case 'chain': this.addFx({ kind: 'chain', x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, t: 0, max: 0.22 }); sfx.push('chain'); break;
        case 'shockwave': this.addFx({ kind: 'shock', x: ev.x, y: ev.y, r: ev.r, t: 0, max: 0.45 }); this.shake += 10; sfx.push('shockwave'); break;
        case 'crush_warn': this.crushWarn = BOSS.crushTelegraph; sfx.push('warn'); break;
        case 'crush': this.crushWarn = 0; this.shake += ev.blocked ? 6 : 14; this.flash = ev.blocked ? 0.15 : 0.35; this.addFx({ kind: 'blast', x: sim.player.x, y: sim.player.y, r: 70, t: 0, max: 0.4 }); sfx.push('crush'); break;
        case 'bomber_blast': this.addFx({ kind: 'blast', x: ev.x, y: ev.y, r: ev.r, t: 0, max: 0.4 }); this.burst(ev.x, ev.y, 16, '#ffeb3b'); this.shake += 8; sfx.push('explode'); break;
        case 'overheat': sfx.push('overheat'); break;
        case 'cooled': sfx.push('cooled'); break;
        case 'boss_phase': this.flash = 0.25; this.shake += 8; sfx.push('boss_phase'); break;
        case 'boss_spawn': this.shake += 6; sfx.push('boss'); break;
        case 'shield_break': this.burst(sim.player.x, sim.player.y, 14, '#90caf9'); sfx.push('shield_break'); break;
        case 'player_hit': if (ev.protectedHit) { this.spark(sim.player.x, sim.player.y - 10, '#fff176', 3); } else if (ev.shielded && ev.amount === 0) { this.spark(sim.player.x, sim.player.y - 10, '#90caf9', 3); sfx.push('shield_hit'); } else if (ev.amount > 0) { this.flash = Math.max(this.flash, 0.12); this.shake += 3; this.text(sim.player.x, sim.player.y - 26, `-${ev.amount}`, '#ff5252'); sfx.push('player_hit'); } break;
        case 'stall_warn': this.stallBanner = 4; sfx.push('warn'); break;
        case 'enrage': this.enrageBanner = 3; this.flash = 0.2; sfx.push('warn'); break;
        case 'summon': this.burst(ev.x, ev.y, 8, '#ff8f00'); break;
      }
    }
    return sfx;
  }

  private addFx(f: Fx): void { if (this.fx.length >= MAX_FX) this.fx.shift(); this.fx.push(f); }
  private push(p: Particle): void { if (this.particles.length >= MAX_PARTICLES) this.particles.shift(); this.particles.push(p); }
  private spark(x: number, y: number, color: string, n: number, dir?: number): void {
    if (this.lowFx) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = dir !== undefined ? dir + (Math.random() - 0.5) * 0.8 : Math.random() * Math.PI * 2; const sp = 60 + Math.random() * 120; this.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.2, max: 0.2, size: 2, color, kind: 'spark' }); }
  }
  private burst(x: number, y: number, n: number, color: string): void {
    if (this.lowFx) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const sp = 40 + Math.random() * 140; this.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5, max: 0.5, size: 2 + Math.random() * 3, color, kind: 'dot' }); }
  }
  private smoke(x: number, y: number, n: number): void { for (let i = 0; i < n; i++) this.push({ x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20, life: 0.8, max: 0.8, size: 6 + Math.random() * 6, color: 'rgba(150,150,150,0.5)', kind: 'smoke', grow: 12 }); }
  private text(x: number, y: number, text: string, color: string): void { let n = 0; for (const p of this.particles) if (p.kind === 'text') n++; if (n >= 14) return; this.push({ x, y, vx: 0, vy: -30, life: 0.7, max: 0.7, size: 12, color, kind: 'text', text }); }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'dot') p.vy += 160 * dt; p.life -= dt; if (p.grow) p.size += p.grow * dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.fx) f.t += dt; this.fx = this.fx.filter(f => f.t < f.max);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.crushWarn > 0) this.crushWarn = Math.max(0, this.crushWarn - dt);
    if (this.enrageBanner > 0) this.enrageBanner -= dt; if (this.stallBanner > 0) this.stallBanner -= dt;
  }

  draw(sim: BattleSim, o: { paused: boolean; won: boolean; lost: boolean }): void {
    const ctx = this.ctx; const t = this.time;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // 배경
    ctx.fillStyle = '#12151f'; ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    let sx = 0, sy = 0; if (this.shakeOn && this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    ctx.translate(this.ox + sx, this.oy + sy); ctx.scale(this.scale, this.scale);
    // 바닥
    ctx.fillStyle = '#1c2030'; ctx.fillRect(0, 0, sim.w, sim.h);
    ctx.fillStyle = '#222738'; for (let y = 0; y < sim.h; y += 40) for (let x = ((y / 40) % 2) * 20; x < sim.w; x += 40) { ctx.fillRect(x, y, 20, 20); }
    // 고철 잔해 장식 (고정)
    ctx.fillStyle = '#2b3044'; for (let i = 0; i < 12; i++) { const px = ((i * 97) % sim.w), py = ((i * 61 + 30) % sim.h); ctx.fillRect(px, py, 14 + (i % 3) * 6, 6 + (i % 2) * 4); }
    // 안전 반경(플레이어 주변)
    const p = sim.player;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 62, 0, 7); ctx.stroke();
    // 압축 경고
    if (this.crushWarn > 0) { const k = 1 - this.crushWarn / BOSS.crushTelegraph; ctx.strokeStyle = `rgba(255,23,68,${0.5 + 0.4 * Math.sin(t * 25)})`; ctx.lineWidth = 3 + k * 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(p.x, p.y, 70 - k * 20, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,23,68,0.12)'; ctx.fill(); }
    // 자폭 예고 반경
    for (const e of sim.enemies) if (e.type === 'bomber' && e.fuse >= 0) { ctx.strokeStyle = 'rgba(255,235,59,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(e.x, e.y, ENEMIES.bomber.blastRadius!, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    // 폭탄 착탄 예고
    for (const pr of sim.projectiles) if (pr.kind === 'bomb' || pr.kind === 'minibomb' || pr.kind === 'fragment') { ctx.strokeStyle = 'rgba(255,112,67,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pr.tx, pr.ty, pr.radius * Math.min(1, pr.t / pr.flight), 0, 7); ctx.stroke(); }
    // 슬래시/레이저/연쇄/충격파/폭발 FX (아래층)
    for (const f of this.fx) this.drawFx(f);
    // 적 (y 정렬)
    const es = [...sim.enemies].sort((a, b) => a.y - b.y);
    for (const e of es) {
      drawEnemy(ctx, e.type, e.x, e.y, e.radius, t, { hit: e.hitFlash, facing: e.facing, hpRatio: e.hp / e.maxHp, fuse: e.fuse, phase: e.phase, stun: e.stun, telegraph: e.crushTelegraph });
      if (e.type !== 'boss' && e.hp < e.maxHp && e.type !== 'swarm') { const w = e.radius * 2; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w, 3); ctx.fillStyle = '#ff5252'; ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w * Math.max(0, e.hp / e.maxHp), 3); }
    }
    // 드론
    for (const ws of sim.weapons) if (ws.cfg.type === 'drone') for (const d of ws.drones) {
      ctx.save(); ctx.translate(d.x, d.y - 6 + Math.sin(t * 8 + d.angle) * 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 12, 6, 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#00acc1'; roundRect(ctx, -6, -3, 12, 6, 3); ctx.fill(); ctx.fillStyle = '#b2ebf2'; ctx.beginPath(); ctx.arc(0, -3, 4, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(178,235,242,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9 * Math.cos(t * 30), -6); ctx.lineTo(9 * Math.cos(t * 30), -6); ctx.stroke();
      if (d.recoil > 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    // 플레이어
    const facing = sim.weapons.length ? sim.weapons[0].lastDir : -Math.PI / 2;
    drawPlayer(ctx, p.x, p.y, p.r, t, { hit: p.hitFlash, pulse: p.pulse, facing, protect: sim.protectTimer, shield: sim.shield, win: o.won, dead: o.lost });
    // 투사체
    for (const pr of sim.projectiles) {
      ctx.save();
      if (pr.kind === 'bullet') { ctx.strokeStyle = pr.extra ? '#ffe082' : '#ffca28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - pr.vx * 0.018, pr.y - pr.vy * 0.018); ctx.stroke(); }
      else if (pr.kind === 'pellet') { ctx.fillStyle = pr.extra ? '#ffe082' : '#ff8a65'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.2, 0, 7); ctx.fill(); }
      else if (pr.kind === 'bolt') { ctx.fillStyle = '#80deea'; ctx.shadowColor = '#4dd0e1'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, 7); ctx.fill(); }
      else { const k = Math.min(1, pr.t / pr.flight); const arc = Math.sin(k * Math.PI) * (pr.kind === 'bomb' ? 40 : 20); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 5, 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = pr.extra ? '#ffab91' : '#3e2723'; ctx.beginPath(); ctx.arc(pr.x, pr.y - arc, pr.kind === 'bomb' ? 6 : 4, 0, 7); ctx.fill(); ctx.fillStyle = '#ffcc80'; ctx.beginPath(); ctx.arc(pr.x + 2, pr.y - arc - 5, 1.5, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    // 파티클
    for (const pt of this.particles) {
      const a = Math.max(0, pt.life / pt.max); ctx.globalAlpha = a;
      if (pt.kind === 'text') { ctx.fillStyle = pt.color; ctx.font = `bold ${pt.size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(pt.text!, pt.x, pt.y); }
      else if (pt.kind === 'spark') { ctx.strokeStyle = pt.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03); ctx.stroke(); }
      else { ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // 보스 체력바
    if (sim.bossRef && sim.bossRef.alive) {
      const b = sim.bossRef; const w = sim.w - 40;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, 20, 8, w, 14, 5); ctx.fill();
      ctx.fillStyle = b.phase >= 2 ? '#ff1744' : b.phase >= 1 ? '#ff9100' : '#ffb300'; roundRect(ctx, 22, 10, (w - 4) * Math.max(0, b.hp / b.maxHp), 10, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; for (const th of BOSS.phaseThresholds) { const x = 22 + (w - 4) * th; ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, 21); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${ENEMIES.boss.name}  ${Math.max(0, Math.ceil(b.hp))}/${b.maxHp}`, sim.w / 2, 31);
    }
    // 배너
    if (this.stallBanner > 0) this.banner(sim, '경고: 적이 곧 강화됩니다!', '#ffb300');
    if (this.enrageBanner > 0) this.banner(sim, '적 강화!', '#ff1744');
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash)})`; ctx.fillRect(0, 0, this.W, this.H); }
    if (o.paused) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, this.W, this.H); }
  }
  private banner(sim: BattleSim, text: string, color: string): void { const ctx = this.ctx; ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, 40, sim.h / 2 - 60, sim.w - 80, 34, 8); ctx.fill(); ctx.fillStyle = color; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, sim.w / 2, sim.h / 2 - 43); }

  private drawFx(f: Fx): void {
    const ctx = this.ctx; const k = f.t / f.max;
    ctx.save();
    if (f.kind === 'slash') {
      const half = (f.arc! * Math.PI) / 360; ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.range! + 8, f.dir! - half, f.dir! + half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, (f.range! + 8) * (0.6 + 0.4 * k), f.dir! - half, f.dir! + half); ctx.stroke();
    } else if (f.kind === 'laser') {
      const w = (f.width! + 4) * (1 - k * 0.7); ctx.globalAlpha = 1 - k * 0.6;
      ctx.strokeStyle = '#80deea'; ctx.lineWidth = w * 2; ctx.lineCap = 'round'; ctx.shadowColor = '#4dd0e1'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.dir!) * f.range!, f.y + Math.sin(f.dir!) * f.range!); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.7; ctx.stroke();
    } else if (f.kind === 'chain') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#e1bee7'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ce93d8'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); const segs = 4; for (let i = 1; i <= segs; i++) { const u = i / segs; const jx = (Math.random() - 0.5) * 12 * (i < segs ? 1 : 0), jy = (Math.random() - 0.5) * 12 * (i < segs ? 1 : 0); ctx.lineTo(f.x + (f.x2! - f.x) * u + jx, f.y + (f.y2! - f.y) * u + jy); } ctx.stroke();
    } else if (f.kind === 'shock') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff176'; ctx.lineWidth = 6 * (1 - k) + 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r! * k, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,241,118,0.15)'; ctx.fill();
    } else if (f.kind === 'blast') {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = 'rgba(255,152,0,0.35)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r! * Math.min(1, k * 2), 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffcc80'; ctx.lineWidth = 3 * (1 - k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r! * k, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}
