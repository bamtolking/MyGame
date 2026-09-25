// Client game session: mirrors the server world (interpolated), predicts the local player, turns events into fx/sound.
import { DT, PLAYER_R, TICK_HZ } from '../shared/constants.ts';
import { mapFromWire, isWalkable, type GameMap } from '../shared/map.ts';
import { stepPlayer } from '../shared/movement.ts';
import { decodeSnap, PF, type S2C, type Ev, type BossInfo, type WorldBossState, type C2S } from '../shared/protocol.ts';
import type { MeState, RosterEntry } from '../shared/types.ts';
import { MONSTERS } from '../shared/data/monsters.ts';
import { TAL_KINDS } from '../shared/data/talismans.ts';
import { CLASSES } from '../shared/data/classes.ts';
import { RARITY_COLORS } from '../shared/data/items.ts';
import { Renderer, type REnt, type View } from './render/renderer.ts';
import { FxSystem } from './render/fx.ts';
import type { Transport } from './net.ts';
import type { Sound } from './audio.ts';
import type { Settings } from './storage.ts';
import { emoteText } from './render/sprites.ts';

interface Snap { tick: number; x: number; y: number; hp: number; f: number; face: number }
interface Ent extends REnt { snaps: Snap[]; lastTick: number }
const INTERP = 2.8; // ticks of interpolation delay (snapshots arrive every 2 ticks)

export interface GameHooks {
  onWelcome(): void; onMe(changed: Set<string>): void; onRoster(): void; onChat(name: string, text: string, sys: boolean, id: number): void;
  onAnn(text: string, kind: string): void; onToast(text: string, color?: string, big?: boolean): void; onBoss(b: BossInfo | null): void; onWb(w: WorldBossState): void;
  onError(msg: string, fatal: boolean): void; onLevel(level: number): void; onHurt(): void;
}

export class Game {
  tr: Transport; snd: Sound; set: Settings; hooks: GameHooks;
  map!: GameMap; r!: Renderer; fx!: FxSystem; ready = false;
  myId = 0; me = {} as MeState; roster = new Map<number, RosterEntry>(); channel = 0; serverName = ''; online = false;
  players = new Map<number, Ent>(); mons = new Map<number, Ent>();
  boss: BossInfo | null = null; wb: WorldBossState = { state: 'idle', t: 0 };
  private tickBase = 0; private timeBase = 0; private synced = false;
  private seq = 0; private pending: { s: number; x: number; y: number }[] = []; predX = 0; predY = 0; private prevX = 0; private prevY = 0; private hasPos = false;
  private corrX = 0; private corrY = 0; private acc = 0; private lastIx = 0; private lastIy = 0;
  private evq: { tick: number; e: Ev }[] = [];
  input = { x: 0, y: 0 }; lastFrame = 0; fps = 60; private fpsAcc = 0; private fpsN = 0; rtt = 0; private pingT = 0;
  canvas: HTMLCanvasElement; private downToastT = 0; private slowSecs = 0; private autoOffT = 0;

  constructor(tr: Transport, canvas: HTMLCanvasElement, snd: Sound, set: Settings, hooks: GameHooks) {
    this.tr = tr; this.canvas = canvas; this.snd = snd; this.set = set; this.hooks = hooks;
    tr.onMessage = (d) => this.onMessage(d);
  }
  send(m: C2S): void { this.tr.send(m); }

  // ---------- time ----------
  estTick(now = performance.now()): number { return this.tickBase + (now - this.timeBase) / (1000 / TICK_HZ); }
  serverTime(): number { return this.estTick() * DT; }
  renderTick(): number { return this.estTick() - INTERP; }

  // ---------- messages ----------
  onMessage(d: string | Uint8Array): void {
    if (typeof d !== 'string') { this.onSnap(d); return; }
    let m: S2C; try { m = JSON.parse(d); } catch { return; }
    switch (m.t) {
      case 'welcome': {
        this.map = mapFromWire(m.map); this.myId = m.id; this.me = m.me; this.channel = m.channel; this.serverName = m.server; this.online = m.online;
        this.roster.clear(); for (const r of m.roster) this.roster.set(r.id, r);
        this.tickBase = m.tick; this.timeBase = performance.now(); this.synced = true;
        this.r = new Renderer(this.canvas, this.map); this.r.low = this.set.low; this.r.showNames = this.set.names; this.r.resize();
        this.fx = new FxSystem({ entPos: (k, id) => this.entPos(k, id), serverTime: () => this.serverTime(), me: () => this.hasPos ? { x: this.predX + this.corrX, y: this.predY + this.corrY } : null, solidAt: (x, y) => !isWalkable(this.map, x, y), players: () => this.visiblePlayers() }, this.r.spr);
        this.fx.low = this.set.low; this.r.fx = this.fx;
        this.players.clear(); this.mons.clear(); this.pending = []; this.hasPos = false; this.evq = [];
        this.wb = m.wb; this.ready = true; this.hooks.onWelcome(); this.hooks.onWb(this.wb); break;
      }
      case 'me': {
        const ch = new Set(Object.keys(m.d)); const prevLv = this.me.level;
        Object.assign(this.me, m.d); if (ch.has('level') && this.me.level > prevLv) this.hooks.onLevel(this.me.level);
        this.hooks.onMe(ch); break;
      }
      case 'ev': for (const e of m.e) this.queueEv(m.tick, e); break;
      case 'roster': { for (const r of m.add ?? []) this.roster.set(r.id, r); for (const id of m.del ?? []) { this.roster.delete(id); this.players.delete(id); } this.hooks.onRoster(); break; }
      case 'chat': { this.hooks.onChat(m.name, m.text, !!m.sys, m.id); const p = this.players.get(m.id); if (p) p.bubble = { text: m.text, until: performance.now() + 4500 }; break; }
      case 'ann': this.hooks.onAnn(m.text, m.kind); if (m.kind === 'legend') this.snd.play('legend'); else if (m.kind === 'boss' && m.text.includes('핏빛')) this.snd.play('horn'); break;
      case 'boss': this.boss = m.b; this.hooks.onBoss(m.b); break;
      case 'wb': { const was = this.wb.state; this.wb = m.w; this.hooks.onWb(m.w); if (was !== m.w.state && m.w.state === 'fight') this.snd.mood = 'boss'; break; }
      case 'pong': this.rtt = performance.now() - m.n; break;
      case 'err': this.hooks.onError(m.msg, !!m.fatal); break;
    }
  }
  private onSnap(d: Uint8Array): void {
    if (!this.ready) return; const s = decodeSnap(d); const now = performance.now();
    const est = this.estTick(now);
    if (!this.synced || Math.abs(est - s.tick) > 10) { this.tickBase = s.tick; this.timeBase = now; this.synced = true; }
    else this.tickBase += (s.tick - est) * 0.06;
    const seenP = new Set<number>(), seenM = new Set<number>();
    for (const p of s.players) { seenP.add(p.id); this.push(this.players, p.id, 'p', 0, { tick: s.tick, x: p.x, y: p.y, hp: p.hp, f: p.f, face: p.face }); if (p.id === this.myId) this.reconcile(p.x, p.y, s.ack, p.f); }
    for (const m of s.mons) { seenM.add(m.id); this.push(this.mons, m.id, 'm', m.t, { tick: s.tick, x: m.x, y: m.y, hp: m.hp, f: m.f, face: 0 }); }
    for (const [id, e] of this.players) if (!seenP.has(id) && e.lastTick < s.tick - 30) this.players.delete(id);
    for (const [id, e] of this.mons) if (!seenM.has(id) && e.lastTick < s.tick - 30 && e.dieT <= 0) this.mons.delete(id);
  }
  private push(map: Map<number, Ent>, id: number, kind: 'p' | 'm', t: number, sn: Snap): void {
    let e = map.get(id);
    if (e && kind === 'm' && (e.t !== t || Math.hypot(e.snaps[e.snaps.length - 1].x - sn.x, e.snaps[e.snaps.length - 1].y - sn.y) > 300)) { map.delete(id); e = undefined; }
    if (!e) { e = { id, kind, t, x: sn.x, y: sn.y, hp: sn.hp, f: sn.f, face: sn.face, dieT: 0, vx: 0, seenT: performance.now(), snaps: [], lastTick: sn.tick }; map.set(id, e); }
    e.snaps.push(sn); if (e.snaps.length > 8) e.snaps.shift(); e.lastTick = sn.tick;
  }
  private reconcile(sx: number, sy: number, ack16: number, f: number): void {
    if ((f & PF.DOWN) || !this.hasPos || this.me.auto) { this.predX = this.prevX = sx; this.predY = this.prevY = sy; this.hasPos = true; this.pending = []; this.corrX = this.corrY = 0; return; }
    const ack = this.seq - ((this.seq - ack16) & 0xffff);
    while (this.pending.length && this.pending[0].s <= ack) this.pending.shift();
    let x = sx, y = sy; const sp = this.speed();
    for (const p of this.pending) [x, y] = stepPlayer(this.map, x, y, p.x, p.y, sp, PLAYER_R);
    const dx = this.predX - x, dy = this.predY - y;
    if (dx * dx + dy * dy > 0.01) {
      if (dx * dx + dy * dy < 150 * 150) { this.corrX += dx; this.corrY += dy; }
      else { this.corrX = 0; this.corrY = 0; this.snd.play('tp'); }
      this.predX = x; this.predY = y; this.prevX = x; this.prevY = y;
    }
  }
  private speed(): number { const st = this.me.stats; return (st?.move ?? 150) * ((this.me.ultT ?? 0) > 0 && this.me.cls === 'sword' ? 1.3 : 1); }

  // ---------- per-frame ----------
  frame(now: number): void {
    if (!this.ready) return;
    const dt = Math.min(0.1, this.lastFrame ? (now - this.lastFrame) / 1000 : 0.016); this.lastFrame = now;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0;
      // adaptive resolution: sustained low FPS lowers the render scale (never below 1.0x)
      if (this.fps < 42 && !document.hidden) { if (++this.slowSecs >= 3 && this.r.dprCap > 1) { this.r.dprCap = Math.max(1, this.r.dprCap - 0.25); this.r.resize(); this.slowSecs = 0; } } else this.slowSecs = 0;
    }
    // fixed 20 Hz input/prediction
    this.acc += dt; let steps = 0;
    while (this.acc >= DT && steps < 4) { this.acc -= DT; steps++; this.inputStep(); }
    if (this.acc > DT * 4) this.acc = 0;
    const decay = Math.pow(0.0005, dt); this.corrX *= decay; this.corrY *= decay;
    this.pingT -= dt; if (this.pingT <= 0 && this.online) { this.pingT = 5; this.send({ t: 'ping', n: performance.now() }); }
    // interpolate everyone
    const rt = this.renderTick();
    for (const e of this.players.values()) this.interp(e, rt);
    for (const [id, e] of this.mons) { this.interp(e, rt); if (e.dieT > 0) { e.dieT += dt; if (e.dieT > 0.35) this.mons.delete(id); } }
    // events whose time has come
    if (this.evq.length) { const keep: typeof this.evq = []; for (const q of this.evq) { if (q.tick <= rt + 0.5) this.playEv(q.e, false); else keep.push(q); } this.evq = keep; }
    const alpha = this.acc / DT; const mx = this.prevX + (this.predX - this.prevX) * alpha + this.corrX, my = this.prevY + (this.predY - this.prevY) * alpha + this.corrY;
    const mine = this.players.get(this.myId);
    if (mine && this.hasPos && !(mine.f & PF.DOWN) && !this.me.auto) { mine.x = mx; mine.y = my; if (this.input.x || this.input.y) mine.face = ((Math.atan2(this.input.y, this.input.x) / (Math.PI * 2) * 255) + 256) % 256; }
    this.fx.update(dt);
    const view: View = {
      myId: this.myId, meX: mine?.x ?? this.predX, meY: mine?.y ?? this.predY, players: [...this.players.values()], mons: [...this.mons.values()], roster: this.roster,
      renderTime: rt * DT, serverTime: this.serverTime(), zone: this.me.zone ?? 0, bloodMoon: this.wb.state !== 'idle', downed: (this.me.downed ?? 0) > 0,
      revive: this.me.revive ?? 0, reviveOf: (id) => (id === this.myId ? this.me.revive ?? 0 : ((this.players.get(id)?.f ?? 0) & PF.REVIVING ? 0.5 : 0)),
    };
    this.r.frame(view, dt);
    this.snd.tick();
  }
  private interp(e: Ent, rt: number): void {
    const s = e.snaps; if (!s.length) return;
    let a = s[0], b = s[s.length - 1];
    if (rt <= a.tick) b = a; else if (rt >= b.tick) a = b;
    else for (let i = 0; i < s.length - 1; i++) if (s[i].tick <= rt && s[i + 1].tick >= rt) { a = s[i]; b = s[i + 1]; break; }
    const k = b.tick === a.tick ? 0 : (rt - a.tick) / (b.tick - a.tick);
    const nx = a.x + (b.x - a.x) * k, ny = a.y + (b.y - a.y) * k; e.vx = nx - e.x; e.x = nx; e.y = ny;
    const cur = k < 0.5 ? a : b; e.hp = b.hp; e.f = cur.f; e.face = b.face;
  }
  private inputStep(): void {
    let ix = Math.round(this.input.x * 127), iy = Math.round(this.input.y * 127);
    const me = this.me; const down = (me.downed ?? 0) > 0;
    if (!this.hasPos || down) { ix = 0; iy = 0; }
    this.prevX = this.predX; this.prevY = this.predY;
    if (me.auto) { if ((ix || iy) && performance.now() - this.autoOffT > 800) { this.autoOffT = performance.now(); this.send({ t: 'auto', on: false }); } this.lastIx = 0; this.lastIy = 0; return; }
    if (ix === 0 && iy === 0 && this.lastIx === 0 && this.lastIy === 0) return;
    this.lastIx = ix; this.lastIy = iy;
    const s = ++this.seq; this.send({ t: 'i', s, x: ix, y: iy });
    if (!this.hasPos || down) return;
    this.pending.push({ s, x: ix, y: iy }); if (this.pending.length > 60) this.pending.shift();
    [this.predX, this.predY] = stepPlayer(this.map, this.predX, this.predY, ix, iy, this.speed(), PLAYER_R);
  }

  // ---------- helpers ----------
  entPos(kind: 'p' | 'm', id: number): { x: number; y: number } | null {
    const e = kind === 'p' ? this.players.get(id) : this.mons.get(id); return e ? { x: e.x, y: kind === 'm' ? e.y - MONSTERS[e.t].r * 0.9 : e.y - 18 } : null;
  }
  private visiblePlayers(): { x: number; y: number }[] { const out: { x: number; y: number }[] = []; for (const p of this.players.values()) if (!(p.f & PF.DOWN)) out.push({ x: p.x, y: p.y - 14 }); return out; }
  myPos(): { x: number; y: number } { const p = this.players.get(this.myId); return p ? { x: p.x, y: p.y } : { x: this.predX, y: this.predY }; }

  private queueEv(tick: number, e: Ev): void {
    // private / time-critical events play now; world visuals wait for the interpolation clock
    switch (e.k) {
      case 'tele': this.fx.telegraph({ sh: e.sh, x: e.x, y: e.y, r: e.r, x2: e.x2 ?? 0, y2: e.y2 ?? 0, due: tick * DT + e.d, s: e.s ?? 0 }); if (this.near(e.x, e.y, 500)) this.snd.play('tele'); return;
      case 'proj': this.fx.enemyProj(e.x, e.y, e.vx, e.vy, e.r, e.life, e.s, tick * DT); return;
      case 'dmg': case 'hurt': case 'loot': case 'toast': case 'quest': this.playEv(e, true); return;
    }
    if ('p' in e && e.p === this.myId && (e.k === 'atk' || e.k === 'tal' || e.k === 'ult')) { this.playEv(e, true); return; }
    this.evq.push({ tick, e });
  }
  private near(x: number, y: number, r: number): boolean { const m = this.myPos(); return (m.x - x) ** 2 + (m.y - y) ** 2 < r * r; }

  private playEv(e: Ev, _immediate: boolean): void {
    const fx = this.fx, snd = this.snd;
    switch (e.k) {
      case 'atk': {
        const p = this.players.get(e.p); const r = this.roster.get(e.p); if (!p || !r) return; const mine = e.p === this.myId; const vol = mine ? 1 : 0.35;
        const ang = Math.atan2(e.ty - p.y, e.tx - p.x); p.face = ((ang / (Math.PI * 2) * 255) + 256) % 256;
        if (r.cls === 'sword') { fx.slash(p.x, p.y - 14, ang, 96, 'rgba(160,200,255,0.9)'); snd.play('slash', vol); }
        else if (r.cls === 'archer') { fx.homing({ x: p.x, y: p.y - 22 }, e.tid ? { kind: 'm', id: e.tid } : { x: e.tx, y: e.ty }, 950, 'arrow', q => { fx.burst(q.x, q.y, 3, ['#fff'], 60, 2, 0.2); }); snd.play('arrow', vol); }
        else { fx.homing({ x: p.x + 10, y: p.y - 28 }, e.tid ? { kind: 'm', id: e.tid } : { x: e.tx, y: e.ty }, 620, 'paper', q => { fx.ring(q.x, q.y, 8, 58, 0.25, '#ff7ab8', 5); fx.burst(q.x, q.y, 8, ['#ff7ab8', '#ffe07a'], 140, 3, 0.35); snd.play('boom', vol * 0.6); }); snd.play('bolt', vol); }
        return;
      }
      case 'tal': {
        const kind = TAL_KINDS[e.tk]; const p = this.players.get(e.p); const ox = p ? p.x : e.x, oy = p ? p.y : e.y; const mine = e.p === this.myId; const vol = mine ? 1 : 0.3;
        switch (kind) {
          case 'wisp': for (const id of e.pts ?? []) fx.homing({ x: ox, y: oy - 30 }, { kind: 'm', id }, 430, 'wisp', q => { fx.ring(q.x, q.y, 6, e.r ?? 52, 0.3, '#6fb6ff', 5); fx.burst(q.x, q.y, 10, ['#6fb6ff', '#eaf6ff'], 150, 3, 0.4); snd.play('boom', vol * 0.5); }, 1.4); snd.play('wisp', vol); break;
          case 'thunder': { const pts = e.pts ?? []; for (let i = 0; i < pts.length; i += 4) { const x = pts[i], y = pts[i + 1]; fx.bolt(x + (Math.random() - 0.5) * 40, y - 320, x, y - 10, '#ffe066', 3); fx.ring(x, y, 4, 40, 0.25, '#fff3a0', 4, 0); fx.burst(x, y - 8, 8, ['#fff3a0', '#ffffff'], 160, 2.5, 0.3); if (pts[i + 2] >= 0) fx.bolt(x, y - 10, pts[i + 2], pts[i + 3] - 10, '#ffe066', 2, 0.18); } if (mine) fx.shake = Math.max(fx.shake, 3); snd.play('thunder', vol); break; }
          case 'frost': fx.ring(ox, oy - 10, 10, e.r ?? 140, 0.4, '#bff3ff', 8); fx.ring(ox, oy - 10, 10, (e.r ?? 140) * 0.8, 0.5, '#ffffff', 3); fx.burst(ox, oy - 10, 24, ['#bff3ff', '#ffffff', '#7fd8ff'], (e.r ?? 140) * 2.2, 3, 0.45); snd.play('frost', vol); break;
          case 'pierce': fx.homing({ x: ox, y: oy - 20 }, { x: e.tx ?? ox, y: (e.ty ?? oy) - 20 }, 1100, 'pierce'); snd.play('arrow', vol * 0.8); break;
          case 'bell': fx.ring(ox, oy - 10, 10, e.r ?? 260, 0.6, '#fff1a8', 5, 0, true); for (let i = 0; i < 6; i++) fx.part({ x: ox + (Math.random() - 0.5) * 60, y: oy - 30, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 40, life: 1, max: 1, size: 4, color: '#fff1a8', shape: 2 }); snd.play('bell', vol); break;
          case 'guard': fx.ring(ox, oy - 10, 10, e.r ?? 220, 0.5, '#e0c3ff', 5, 0, true); snd.play('guard', vol); break;
        }
        return;
      }
      case 'ult': {
        const r = this.roster.get(e.p); const mine = e.p === this.myId; if (mine) { fx.shake = 10; snd.play('ult'); } else snd.play('ult', 0.4);
        const cls = r?.cls ?? 'sword'; const col = CLASSES[cls].color;
        fx.pillar(e.x, e.y, col, 0.8, 70, 320); fx.ring(e.x, e.y - 10, 20, cls === 'shaman' ? 330 : 180, 0.6, col, 8, 0, true);
        if (cls === 'archer' && e.tx != null && e.ty != null) {
          const tx = e.tx, ty = e.ty; fx.ring(tx, ty, 150, 160, 2.3, '#a6ff9e', 3, 0, true);
          for (let v = 0; v < 8; v++) setTimeout(() => { for (let k = 0; k < 7; k++) { const x = tx + (Math.random() - 0.5) * 300, y = ty + (Math.random() - 0.5) * 300; fx.homing({ x: x - 60, y: y - 380 }, { x, y }, 1400, 'arrow', q => fx.burst(q.x, q.y, 4, ['#eaffe6', '#a6ff9e'], 90, 2, 0.25)); } if (mine) snd.play('arrow'); }, 300 + v * 250);
        }
        if (cls === 'shaman') setTimeout(() => { fx.ring(e.x, e.y - 10, 30, 330, 0.5, '#ffe07a', 12); fx.burst(e.x, e.y - 20, 60, ['#ffe07a', '#ff7ab8', '#ffffff'], 420, 4, 0.7); if (mine) fx.shake = 14; snd.play('boom'); }, 350);
        return;
      }
      case 'dmg': {
        if (!this.set.dmgNums) return; const m = this.mons.get(e.id); if (!m) return; const def = MONSTERS[m.t];
        fx.text(m.x, m.y - def.r * 2 - 6, e.cr ? `${e.v}!` : String(e.v), e.cr ? '#ffb02e' : '#ffffff', e.cr ? 20 : 14, !!e.cr);
        if (e.cr) fx.burst(m.x, m.y - def.r, 4, ['#ffe07a'], 120, 2, 0.25);
        snd.play('hit', 0.6); return;
      }
      case 'hurt': { const p = this.myPos(); fx.text(p.x, p.y - 50, `-${e.v}`, '#ff5a5a', 15); snd.play('hurt'); this.hooks.onHurt(); fx.shake = Math.max(fx.shake, 2.5); return; }
      case 'die': {
        const m = this.mons.get(e.id); if (m) m.dieT = 0.001; const def = MONSTERS[e.t]; const near = this.near(e.x, e.y, 600);
        const col = def.glow || '#c8b8ff';
        fx.burst(e.x, e.y - def.r, def.beh === 'boss' ? 80 : e.el ? 30 : 12, [col, '#ffffff', '#8a7aa8'], def.beh === 'boss' ? 380 : 150, def.beh === 'boss' ? 5 : 3, 0.5);
        if (!this.set.low) fx.part({ x: e.x, y: e.y - def.r, vx: 0, vy: -50, life: 0.7, max: 0.7, size: 6, color: 'rgba(220,230,255,0.8)' });
        if (e.el || def.beh === 'boss') { fx.pillar(e.x, e.y, '#ffd54a', 1.2, def.beh === 'boss' ? 120 : 50, 400); if (near) fx.shake = Math.max(fx.shake, def.beh === 'boss' ? 16 : 5); }
        if (near) snd.play(def.beh === 'boss' ? 'roar' : 'kill', 0.7);
        return;
      }
      case 'boom': { fx.burst(e.x, e.y, e.s === 0 ? 20 : 14, ['#ff8a5a', '#ffd0a0', '#ffffff'], 200, 3, 0.4); if (this.near(e.x, e.y, 350)) { fx.shake = Math.max(fx.shake, 6); snd.play('boom', 0.8); } return; }
      case 'loot': {
        const n = Math.min(6, 1 + Math.floor(Math.log2(1 + e.g / 5)));
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; fx.part({ x: e.x, y: e.y - 10, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 80, g: 0, drag: 0.86, life: 1.4, max: 1.4, size: 4, color: '#ffd54a', home: true, add: false, shape: 0, onDone: i === 0 ? () => snd.play('coin', 0.5) : undefined }); }
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; fx.part({ x: e.x, y: e.y - 10, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, drag: 0.86, life: 1.4, max: 1.4, size: 3, color: '#7fd8ff', home: true, shape: 0 }); }
        if (e.it != null) { const col = RARITY_COLORS[e.it]; fx.pillar(e.x, e.y, col, 1.4, 26, e.it >= 3 ? 420 : 200); fx.part({ x: e.x, y: e.y - 20, vx: 0, vy: -200, drag: 0.9, life: 1.6, max: 1.6, size: 7, color: col, home: true, shape: 2 }); snd.play(e.it >= 4 ? 'legend' : e.it >= 3 ? 'epic' : 'item'); }
        if (e.tl) { fx.pillar(e.x, e.y, '#ffe07a', 1.2, 22, 220); fx.part({ x: e.x, y: e.y - 20, vx: 0, vy: -160, drag: 0.9, life: 1.5, max: 1.5, size: 7, color: '#ffe07a', home: true, shape: 2 }); snd.play('item'); }
        return;
      }
      case 'lvl': {
        const p = this.players.get(e.p); const x = p?.x ?? 0, y = p?.y ?? 0; fx.pillar(x, y, '#ffd54a', 1.4, 60, 500); fx.ring(x, y - 10, 10, 160, 0.8, '#ffd54a', 8, 0, true);
        fx.burst(x, y - 30, 40, ['#ffd54a', '#fff6c8', '#ffffff'], 260, 4, 0.9); fx.text(x, y - 80, 'LEVEL UP!', '#ffd54a', 22, true, 1.6);
        if (e.p === this.myId) snd.play('level'); return;
      }
      case 'heal': { const p = this.players.get(e.p); if (p && (e.p === this.myId || this.near(p.x, p.y, 400))) fx.text(p.x, p.y - 56, `+${e.v}`, '#7dffb0', e.p === this.myId ? 15 : 12); return; }
      case 'shield': { const p = this.players.get(e.p); if (p) fx.ring(p.x, p.y - 20, 30, 34, 0.4, '#e0c3ff', 4); return; }
      case 'down': { const p = this.players.get(e.p); if (p) fx.burst(p.x, p.y - 20, 20, ['#8a8aa0', '#ffffff'], 120, 3, 0.6); if (e.p === this.myId) snd.play('down');
        else if (p && this.near(p.x, p.y, 600) && performance.now() - this.downToastT > 15000) { this.downToastT = performance.now(); this.hooks.onToast(`${this.roster.get(e.p)?.name ?? '동료'}님이 쓰러졌습니다! 곁에 서면 일으킬 수 있어요`, '#ff9a9a'); }
        return; }
      case 'rev': {
        const p = this.players.get(e.p); const x = p?.x ?? 0, y = p?.y ?? 0;
        if (e.by === -2 || e.by === -1) { fx.pillar(x, y, '#9fd7ff', 0.9, 50, 300); fx.burst(x, y - 20, 24, ['#9fd7ff', '#ffffff'], 200, 3, 0.6); if (e.p === this.myId) snd.play('tp'); }
        else { fx.pillar(x, y, '#7dffb0', 1.2, 50, 300); fx.burst(x, y - 20, 30, ['#7dffb0', '#ffffff'], 220, 3, 0.7); fx.text(x, y - 70, '부활!', '#7dffb0', 18, true, 1.2); if (e.p === this.myId || e.by === this.myId) snd.play('revive'); }
        return;
      }
      case 'mon': {
        const m = this.mons.get(e.id); const x = e.x ?? m?.x ?? 0, y = e.y ?? m?.y ?? 0;
        if (e.a === 'roar') { fx.ring(x, y - 30, 20, 260, 0.7, '#ff5a5a', 6); if (this.near(x, y, 700)) { snd.play('roar'); fx.shake = Math.max(fx.shake, 8); } }
        else if (e.a === 'blink') { fx.burst(x, y - 30, 30, ['#b8a6ff', '#1b1426', '#ffffff'], 220, 4, 0.6, false); }
        else if (e.a === 'summon') { fx.ring(x, y - 10, 20, 150, 0.6, '#b8a6ff', 6, 0, true); }
        else if (e.a === 'dash') { fx.burst(x, y, 16, ['#a89880', '#6a5a4a'], 140, 4, 0.5, false); }
        return;
      }
      case 'emote': { const p = this.players.get(e.p); if (p) { p.bubble = { text: emoteText(e.e), until: performance.now() + 2600 }; if (this.near(p.x, p.y, 500)) snd.play('emote'); } return; }
      case 'quest': this.hooks.onToast(e.title, '#ffe066', true); snd.play('quest'); return;
      case 'toast': this.hooks.onToast(e.text, e.c); return;
    }
  }
  resize(): void { this.r?.resize(); }
  applySettings(): void { if (!this.r) return; this.r.low = this.set.low; this.fx.low = this.set.low; this.r.showNames = this.set.names; this.r.resize(); }
}
