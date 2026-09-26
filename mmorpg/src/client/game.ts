// Client game session: mirrors the server world (interpolated), predicts the local player, turns events into fx/sound.
import { DT, PLAYER_R, TICK_HZ } from '../shared/constants.ts';
import { mapFromWire, isWalkable, type GameMap } from '../shared/map.ts';
import { stepPlayer } from '../shared/movement.ts';
import { decodeSnap, PF, type S2C, type Ev, type BossInfo, type WorldBossState, type C2S } from '../shared/protocol.ts';
import type { ClassId, MeState, RosterEntry } from '../shared/types.ts';
import { MONSTERS } from '../shared/data/monsters.ts';
import { TAL_KINDS } from '../shared/data/talismans.ts';
import { CLASSES } from '../shared/data/classes.ts';
import { RARITY_COLORS } from '../shared/data/items.ts';
import { Renderer, DIE_T, type REnt, type View, type Quality } from './render/world.ts';
import { FxSystem, hexCol } from './render/fx.ts';
/** Perceived brightness of a 0xRRGGBB colour, 0..1. */
const lum = (c: number) => (0.3 * (c >> 16 & 255) + 0.59 * (c >> 8 & 255) + 0.11 * (c & 255)) / 255;
import { EMIT } from './render/paint.ts';
import { ZONE_SONG } from './audio/music.ts';
import type { Transport } from './net.ts';
import type { Sound } from './audio/engine.ts';
import type { Settings } from './storage.ts';
import { emoteText } from './render/art/icons.ts';
import { CLASS_FX, type FxCtx } from './classfx/index.ts';

interface Snap { tick: number; x: number; y: number; hp: number; f: number; face: number }
interface Ent extends REnt { snaps: Snap[]; lastTick: number }
const INTERP = 2.8; // ticks of interpolation delay (snapshots arrive every 2 ticks)
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export interface GameHooks {
  onWelcome(): void; onMe(changed: Set<string>): void; onRoster(): void; onChat(name: string, text: string, sys: boolean, id: number): void;
  onAnn(text: string, kind: string): void; onToast(text: string, color?: string, big?: boolean): void; onBoss(b: BossInfo | null): void; onWb(w: WorldBossState): void;
  onError(msg: string, fatal: boolean): void; onLevel(level: number): void; onHurt(): void; onUlt(cls: ClassId): void;
  /** A new class became available to this character. */
  onUnlock?(cls: ClassId): void;
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
  stage: HTMLElement; private downToastT = 0; private slowSecs = 0; private autoOffT = 0;
  private visLag = 0; private lastHit = new Map<number, number>(); private swing = new Map<number, number>(); private hurtT = -99; private musicT = 0;
  combo = 0; private comboT = 0;

  constructor(tr: Transport, stage: HTMLElement, snd: Sound, set: Settings, hooks: GameHooks) {
    this.tr = tr; this.stage = stage; this.snd = snd; this.set = set; this.hooks = hooks;
    tr.onMessage = (d) => this.onMessage(d);
  }
  send(m: C2S): void { this.tr.send(m); }

  // ---------- time ----------
  estTick(now = performance.now()): number { return this.tickBase + (now - this.timeBase) / (1000 / TICK_HZ); }
  serverTime(): number { return this.estTick() * DT; }
  /** Interpolation clock; lags a little extra after a hit-stop and catches up smoothly. */
  renderTick(): number { return this.estTick() - INTERP - this.visLag; }

  // ---------- messages ----------
  onMessage(d: string | Uint8Array): void {
    if (typeof d !== 'string') { this.onSnap(d); return; }
    let m: S2C; try { m = JSON.parse(d); } catch { return; }
    switch (m.t) {
      case 'welcome': {
        this.map = mapFromWire(m.map); this.myId = m.id; this.me = m.me; this.channel = m.channel; this.serverName = m.server; this.online = m.online;
        this.roster.clear(); for (const r of m.roster) this.roster.set(r.id, r);
        this.tickBase = m.tick; this.timeBase = performance.now(); this.synced = true;
        this.r?.p.destroy(); this.stage.replaceChildren();
        this.r = new Renderer(this.stage, this.map, this.set.quality); this.r.showNames = this.set.names;
        this.fx = new FxSystem({ entPos: (k, id) => this.entPos(k, id), serverTime: () => this.serverTime(), me: () => this.hasPos ? { x: this.predX + this.corrX, y: this.predY + this.corrY } : null, solidAt: (x, y) => !isWalkable(this.map, x, y), players: () => this.visiblePlayers() }, this.r.art);
        this.r.fx = this.fx; this.fx.shakeOn = this.set.shake; this.r.setQuality(this.set.quality);
        this.r.art.prewarm([m.me.cls], MONSTERS.filter(d => d.zone === (m.me.zone || 1)).map(d => d.key));
        this.players.clear(); this.mons.clear(); this.pending = []; this.hasPos = false; this.evq = []; this.visLag = 0;
        this.wb = m.wb; this.ready = true; this.hooks.onWelcome(); this.hooks.onWb(this.wb); break;
      }
      case 'me': {
        const ch = new Set(Object.keys(m.d)); const prevLv = this.me.level; const prevZone = this.me.zone;
        Object.assign(this.me, m.d); if (ch.has('level') && this.me.level > prevLv) this.hooks.onLevel(this.me.level);
        if (ch.has('zone') && this.me.zone !== prevZone && this.r) this.r.art.prewarm([], MONSTERS.filter(d => d.zone === this.me.zone).map(d => d.key));
        this.hooks.onMe(ch); break;
      }
      case 'ev': for (const e of m.e) this.queueEv(m.tick, e); break;
      case 'roster': { for (const r of m.add ?? []) this.roster.set(r.id, r); for (const id of m.del ?? []) { this.roster.delete(id); this.players.delete(id); } this.hooks.onRoster(); break; }
      case 'chat': { this.hooks.onChat(m.name, m.text, !!m.sys, m.id); const p = this.players.get(m.id); if (p) p.bubble = { text: m.text, until: performance.now() + 4500 }; break; }
      case 'ann': this.hooks.onAnn(m.text, m.kind); if (m.kind === 'legend') this.snd.play('legend'); else if (m.kind === 'boss' && m.text.includes('핏빛')) { this.snd.play('horn'); this.snd.duck(0.5, 2); } break;
      case 'boss': this.boss = m.b; this.hooks.onBoss(m.b); break;
      case 'wb': { this.wb = m.w; this.hooks.onWb(m.w); break; }
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
  private speed(): number { const st = this.me.stats; return (st?.move ?? 150) * ((this.me.ultT ?? 0) > 0 ? CLASSES[this.me.cls]?.ultMove ?? 1 : 1); }

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
    // hit-stop: visuals run at a crawl, the interpolation clock falls behind and then catches up
    const stop = this.fx.hitstop > 0; const vdt = stop ? dt * 0.06 : dt;
    this.visLag = stop ? Math.min(4, this.visLag + (dt - vdt) * TICK_HZ) : Math.max(0, this.visLag - dt * TICK_HZ * 0.45);
    // fixed 20 Hz input/prediction
    this.acc += dt; let steps = 0;
    while (this.acc >= DT && steps < 4) { this.acc -= DT; steps++; this.inputStep(); }
    if (this.acc > DT * 4) this.acc = 0;
    const decay = Math.pow(0.0005, dt); this.corrX *= decay; this.corrY *= decay;
    this.pingT -= dt; if (this.pingT <= 0 && this.online) { this.pingT = 5; this.send({ t: 'ping', n: performance.now() }); }
    // interpolate everyone
    const rt = this.renderTick();
    for (const e of this.players.values()) this.interp(e, rt);
    for (const [id, e] of this.mons) { this.interp(e, rt); if (e.dieT > 0) { e.dieT += vdt; if (e.dieT > DIE_T) this.mons.delete(id); } }
    // events whose time has come
    if (this.evq.length) { const keep: typeof this.evq = []; for (const q of this.evq) { if (q.tick <= rt + 0.5) this.playEv(q.e); else keep.push(q); } this.evq = keep; }
    const alpha = this.acc / DT; const mx = this.prevX + (this.predX - this.prevX) * alpha + this.corrX, my = this.prevY + (this.predY - this.prevY) * alpha + this.corrY;
    const mine = this.players.get(this.myId);
    if (mine && this.hasPos && !(mine.f & PF.DOWN) && !this.me.auto) { mine.x = mx; mine.y = my; if (this.input.x || this.input.y) mine.face = ((Math.atan2(this.input.y, this.input.x) / (Math.PI * 2) * 255) + 256) % 256; }
    if (this.combo > 0 && (this.comboT -= dt) <= 0) this.combo = 0;
    this.fx.update(vdt, dt);
    const meX = mine?.x ?? this.predX, meY = mine?.y ?? this.predY;
    const view: View = {
      myId: this.myId, meX, meY, players: [...this.players.values()], mons: [...this.mons.values()], roster: this.roster,
      renderTime: rt * DT, serverTime: this.serverTime(), zone: this.me.zone ?? 0, bloodMoon: this.wb.state !== 'idle', downed: (this.me.downed ?? 0) > 0,
      hpFrac: (this.me.hp ?? 1) / Math.max(1, this.me.maxHp ?? 1),
      revive: this.me.revive ?? 0, reviveOf: (id) => (id === this.myId ? this.me.revive ?? 0 : ((this.players.get(id)?.f ?? 0) & PF.REVIVING ? 0.5 : 0)),
    };
    this.r.frame(view, dt, vdt);
    this.snd.listen(meX, meY);
    if ((this.musicT -= dt) <= 0) { this.musicT = 0.5; this.updateMusic(meX, meY, view); }
  }
  /** Adaptive music: town is calm, a crowd or recent damage raises the intensity, bosses switch to the boss song. */
  private updateMusic(x: number, y: number, v: View): void {
    const zone = this.me.zone ?? 0; let song = ZONE_SONG[zone] ?? 'forest', lv = zone === 0 ? 0 : 1;
    const bossNear = v.mons.some(m => MONSTERS[m.t]?.beh === 'boss' && m.dieT <= 0 && (m.x - x) ** 2 + (m.y - y) ** 2 < 700 * 700);
    if (bossNear || (this.wb.state === 'fight' && zone === 5)) { song = 'boss'; lv = 3; }
    else if (zone !== 0) {
      let n = 0; for (const m of v.mons) if (m.dieT <= 0 && (m.x - x) ** 2 + (m.y - y) ** 2 < 450 * 450) n++;
      if (n >= 12 || performance.now() - this.hurtT < 4000 || this.wb.state !== 'idle') lv = 2;
    }
    if (v.downed) lv = Math.min(lv, 1);
    this.snd.setScene(song, lv);
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
      case 'tele': this.fx.telegraph({ sh: e.sh, x: e.x, y: e.y, r: e.r, x2: e.x2 ?? 0, y2: e.y2 ?? 0, due: tick * DT + e.d, s: e.s ?? 0 }); if (this.near(e.x, e.y, 520)) this.snd.play('tele', 0.8, e.x, e.y); return;
      case 'proj': this.fx.enemyProj(e.x, e.y, e.vx, e.vy, e.r, e.life, e.s, tick * DT); if (this.near(e.x, e.y, 480)) this.snd.play('enemy_shot', 0.4, e.x, e.y); return;
      case 'dmg': case 'hurt': case 'loot': case 'toast': case 'quest': case 'unlock': this.playEv(e); return;
    }
    if ('p' in e && e.p === this.myId && (e.k === 'atk' || e.k === 'tal' || e.k === 'ult' || e.k === 'uhit')) { this.playEv(e); return; }
    this.evq.push({ tick, e });
  }
  private near(x: number, y: number, r: number): boolean { const m = this.myPos(); return (m.x - x) ** 2 + (m.y - y) ** 2 < r * r; }
  /** Context handed to the per-class effect modules. `count` advances the caster's attack counter. */
  private fxCtx(id: number, cls: ClassId, x: number, y: number, count: boolean): FxCtx {
    const mine = id === this.myId; const n = this.swing.get(id) ?? 0; if (count) this.swing.set(id, n + 1);
    const ult = mine ? (this.me.ultT ?? 0) > 0 : ((this.players.get(id)?.f ?? 0) & PF.WHIRL) !== 0;
    return { fx: this.fx, snd: this.snd, art: this.r.art, id, mine, vol: mine ? 1 : 0.35, x, y, col: hexCol(CLASSES[cls].color), ult, n, near: (a, b, r) => this.near(a, b, r), entPos: (k, i) => this.entPos(k, i) };
  }

  private playEv(e: Ev): void {
    const fx = this.fx, snd = this.snd, A = this.r.art;
    switch (e.k) {
      case 'atk': {
        const p = this.players.get(e.p); const r = this.roster.get(e.p); if (!p || !r) return;
        const ang = Math.atan2(e.ty - p.y, e.tx - p.x); p.face = ((ang / (Math.PI * 2) * 255) + 256) % 256;
        const cf = CLASS_FX[r.cls] ?? CLASS_FX.sword; this.r.anim.attack(e.p, cf.atkDur);
        cf.atk(this.fxCtx(e.p, r.cls, p.x, p.y, true), e, ang);
        return;
      }
      case 'tal': {
        const kind = TAL_KINDS[e.tk]; const p = this.players.get(e.p); const ox = p ? p.x : e.x, oy = p ? p.y : e.y; const mine = e.p === this.myId; const vol = mine ? 1 : 0.3;
        switch (kind) {
          case 'wisp': for (const id of e.pts ?? []) fx.homing({ x: ox, y: oy - 34 }, { kind: 'm', id }, 450, 'wisp', q => {
            const R = e.r ?? 52; fx.ring(q.x, q.y, 6, R, 0.3, 0x6fb6ff, true); fx.glow(q.x, q.y, R * 1.1, 0x4f9cff, 0.3); fx.sparks(q.x, q.y, 6, 0x8fc8ff, 300);
            fx.light(q.x, q.y, 150, 0x4f9cff, 0.9, 0.3); snd.play('wisp_boom', vol * 0.6, q.x, q.y);
          }, 1.4); snd.play('wisp_cast', vol, ox, oy); break;
          case 'thunder': {
            const pts = e.pts ?? [];
            for (let i = 0; i < pts.length; i += 4) {
              const x = pts[i], y = pts[i + 1]; fx.bolt(x + rnd(-50, 50), y - 360, x, y - 8, 0xffe066, 9, 0.26, 46);
              fx.glow(x, y - 8, 70, 0xfff3a0, 0.2); fx.ring(x, y, 6, 50, 0.28, 0xfff3a0, false, 0); fx.sparks(x, y - 8, 8, 0xfff3a0, 400);
              fx.decal(x, y, 'scorch', 64, 0x1a1208, 1.6, 0.5); fx.light(x, y, 230, 0xfff0a0, 1.2, 0.22);
              if (pts[i + 2] >= 0) fx.bolt(x, y - 10, pts[i + 2], pts[i + 3] - 10, 0xffe066, 5, 0.2, 26);
            }
            if (mine) { fx.shake(0.12); fx.flash(0xfff6d0, 0.07); } snd.play('thunder', vol, ox, oy); break;
          }
          case 'frost': {
            const R = e.r ?? 140; fx.ring(ox, oy - 6, 10, R, 0.45, 0xbff3ff, false, 0); fx.ring(ox, oy - 6, 10, R * 0.85, 0.55, 0xffffff, true, 0); fx.glow(ox, oy - 10, R * 0.7, 0x9fe8ff, 0.3);
            const hex = A.fx('hex'); fx.add(1, 0.45, (pp, k) => { const s = R * 2 / 96 * (0.55 + k * 0.5); pp.draw(EMIT, hex, ox, oy - 10, s, s * 0.62, 0, 0xcff4ff, (1 - k) * 0.55, 1); });
            for (let i = 0; i < (this.r.low ? 6 : 16); i++) { const a = (i / 16) * Math.PI * 2 + rnd(-0.1, 0.1); fx.part({ tex: 'shard', x: ox, y: oy - 10, vx: Math.cos(a) * R * 3, vy: Math.sin(a) * R * 2, drag: 0.85, life: rnd(0.35, 0.55), size: 9, col: 0xdff8ff, face: true }); }
            fx.decal(ox, oy, 'disc', R * 1.8, 0xcff4ff, 1.4, 0.2); fx.light(ox, oy, R * 1.6, 0x9fe8ff, 0.9, 0.4); if (mine) fx.wave(ox, oy - 10, R, 8, 0.45);
            snd.play('frost', vol, ox, oy); break;
          }
          case 'pierce': fx.homing({ x: ox, y: oy - 22 }, { x: e.tx ?? ox, y: (e.ty ?? oy) - 22 }, 1300, 'pierce'); snd.play('pierce', vol, ox, oy); break;
          case 'bell': {
            const R = e.r ?? 260; fx.ring(ox, oy, 10, R, 0.7, 0xfff1a8, true, 0); fx.glow(ox, oy - 24, 80, 0xfff1a8, 0.5); fx.light(ox, oy, 240, 0xfff1a8, 0.8, 0.6);
            for (let i = 0; i < 5; i++) fx.part({ tex: 'note', x: ox + rnd(-40, 40), y: oy - 34, vx: rnd(-30, 30), vy: -70 - rnd(0, 40), drag: 0.97, life: 1.2, size: 9, col: 0xfff1a8, spin: rnd(-1, 1), fadeIn: 0.1 });
            snd.play('bell', vol, ox, oy); break;
          }
          case 'guard': {
            const R = e.r ?? 220; fx.ring(ox, oy, 10, R, 0.5, 0xe0c3ff, true, 0); const hex = A.fx('hex');
            fx.add(1, 0.5, (pp, k) => { const s = 1.1 + k * 0.5; pp.draw(EMIT, hex, ox, oy - 24, s, s, 0, 0xe0c3ff, (1 - k) * 0.8, 1); });
            snd.play('guard', vol, ox, oy); break;
          }
        }
        return;
      }
      case 'ult': {
        const r = this.roster.get(e.p); const cls = r?.cls ?? 'sword'; const mine = e.p === this.myId; const col = hexCol(CLASSES[cls].color); const cf = CLASS_FX[cls] ?? CLASS_FX.sword;
        snd.play('ult_' + cls, mine ? 1 : 0.45, e.x, e.y);
        if (mine) { snd.duck(0.5, 1.2); fx.flash(0xffffff, 0.35); fx.shake(0.5); fx.stop(0.09, true); fx.zoomPunch(0.07); fx.chroma(0.014); fx.wave(e.x, e.y - 20, 380, 20, 0.8); this.hooks.onUlt(cls); }
        const R = cf.ultR ?? 170; const pale = lum(col) > 0.75 ? 0.65 : 1; // near-white class colours (painter) bloom much harder
        fx.pillar(e.x, e.y, col, 0.75 * pale, 80, 380); fx.sigil(e.x, e.y, R, col, 1.4, 'sigil', 1.2, (mine ? 0.8 : 0.4) * pale); fx.ring(e.x, e.y, 20, R + 30, 0.7, col, true, 0); fx.light(e.x, e.y, 420, col, 0.9 * pale, 0.8);
        cf.ult(this.fxCtx(e.p, cls, e.x, e.y, false), e);
        return;
      }
      case 'uhit': {
        const r = this.roster.get(e.p); const cls = r?.cls ?? 'sword'; const p = this.players.get(e.p);
        CLASS_FX[cls]?.uhit?.(this.fxCtx(e.p, cls, p?.x ?? e.x, p?.y ?? e.y, false), e);
        return;
      }
      case 'cls': {
        const p = this.players.get(e.p); const x = p?.x ?? 0, y = p?.y ?? 0; const col = hexCol(CLASSES[e.c].color);
        fx.pillar(x, y, col, 1.3, 64, 420); fx.sigil(x, y, 120, col, 1.6, 'sigil', 1.8, 0.7); fx.ring(x, y, 10, 150, 0.8, col, true, 0);
        fx.burst(x, y - 30, 26, [col, 0xffffff], 260, 8, 0.9, 'star'); fx.light(x, y, 300, col, 1.2, 1);
        if (e.p === this.myId) { snd.play('cls_change'); snd.duck(0.4, 1.2); fx.flash(col, 0.18); fx.wave(x, y, 240, 12, 0.7); this.r.art.prewarm([e.c], []); }
        return;
      }
      case 'dmg': {
        const m = this.mons.get(e.id); if (!m) return; const def = MONSTERS[m.t]; const me = this.myPos(); const crit = !!e.cr;
        const dx = m.x - me.x, dy = m.y - me.y; const hy = m.y - def.r * 1.1; this.lastHit.set(e.id, performance.now());
        this.r.anim.hit('m', e.id, dx, dy, (crit ? 420 : 260) * (def.beh === 'boss' ? 0.25 : 1), 1);
        fx.sparks(m.x, hy, crit ? 10 : 5, crit ? 0xffd27a : 0xffffff, crit ? 520 : 380, Math.atan2(dy, dx), 1.7, crit ? 12 : 9);
        if (crit) { fx.glow(m.x, hy, 40, 0xffc060, 0.14); fx.part({ tex: 'star', x: m.x, y: hy, life: 0.22, size: 26, grow: -60, col: 0xfff0b0 }); fx.stop(0.035); fx.shake(0.1); fx.zoomPunch(0.008); snd.play('hit_crit', 0.7, m.x, m.y); }
        else snd.play('hit', 0.55, m.x, m.y);
        if (this.set.dmgNums) fx.text(m.x, m.y - def.r * 2 - 8, crit ? `${e.v}!` : String(e.v), crit ? '#ffb02e' : '#ffffff', crit ? 23 : 14, crit);
        this.combo++; this.comboT = 2.4;
        return;
      }
      case 'hurt': {
        const p = this.myPos(); fx.text(p.x, p.y - 58, `-${e.v}`, '#ff4a5a', 18); snd.play('hurt'); this.hooks.onHurt(); this.hurtT = performance.now();
        fx.shake(0.22); fx.flash(0xff2030, 0.1); fx.chroma(0.004); this.r.anim.hurt(this.myId); return;
      }
      case 'die': {
        const m = this.mons.get(e.id); if (m) m.dieT = 0.001; const def = MONSTERS[e.t]; const near = this.near(e.x, e.y, 650); const boss = def.beh === 'boss';
        const mine = performance.now() - (this.lastHit.get(e.id) ?? -1e9) < 900; this.lastHit.delete(e.id);
        const col = def.glow ? hexCol(def.glow) : 0xc8b8ff; const cy = e.y - def.r;
        fx.sparks(e.x, cy, boss ? 40 : e.el ? 18 : 8, col, boss ? 700 : 420, undefined, Math.PI, boss ? 16 : 11);
        fx.burst(e.x, cy, boss ? 50 : e.el ? 20 : 7, [col, 0xffffff], boss ? 320 : 140, 7, 0.6, 'dot', -60);
        fx.glow(e.x, cy, boss ? 180 : e.el ? 80 : 46, col, 0.25); fx.light(e.x, cy, 130, col, 0.8, 0.3);
        fx.decal(e.x, e.y, 'ink' + Math.floor(Math.random() * 3), def.r * 3.4, 0x1c1030, 2.6, 0.5);
        if (mine && near && !boss && !this.r.low) fx.part({ tex: 'dot', x: e.x, y: cy, vx: rnd(-80, 80), vy: -140, home: true, life: 1.5, size: 8, col: 0xbfe6ff, onDone: () => snd.play('soul', 0.22) });
        if (e.el || boss) {
          fx.pillar(e.x, e.y, 0xffd54a, 1.3, boss ? 130 : 56, boss ? 520 : 380); fx.ring(e.x, e.y, 20, boss ? 360 : 180, 0.6, 0xffd54a, true, 0);
          if (near) { fx.wave(e.x, cy, boss ? 420 : 200, boss ? 22 : 12, boss ? 0.9 : 0.6); fx.shake(boss ? 0.8 : 0.35); fx.stop(boss ? 0.16 : 0.07, true); fx.flash(0xffffff, boss ? 0.45 : 0.15); fx.chroma(boss ? 0.012 : 0.006); fx.zoomPunch(boss ? 0.06 : 0.03); }
        } else if (mine) { fx.stop(0.028); fx.shake(0.05); }
        if (near) snd.play(boss || e.el ? 'kill_big' : 'kill', boss ? 1 : 0.7, e.x, e.y);
        return;
      }
      case 'boom': {
        const near = this.near(e.x, e.y, 420); const R = e.r || 80;
        fx.glow(e.x, e.y - 10, R * 1.2, 0xff8a4a, 0.35); fx.ring(e.x, e.y, 10, R, 0.4, 0xffb070, false, 0); fx.sparks(e.x, e.y - 10, 12, 0xffb070, 480);
        fx.smoke(e.x, e.y - 8, 6, 0x4a3a3a, 90, 30, 1.0, 0.5); fx.decal(e.x, e.y, 'scorch', R * 1.6, 0x140a06, 3, 0.6); fx.decal(e.x, e.y, 'crack', R * 1.3, 0x2a1a10, 3, 0.5); fx.light(e.x, e.y, R * 2.5, 0xff8a4a, 1.2, 0.35);
        if (near) { fx.shake(0.3); fx.wave(e.x, e.y, R * 1.6, 12, 0.5); fx.chroma(0.006); snd.play(R > 150 ? 'slam' : 'boom', 0.8, e.x, e.y); }
        return;
      }
      case 'loot': {
        const n = Math.min(7, 1 + Math.floor(Math.log2(1 + e.g / 5)));
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; fx.part({ tex: 'coin', layer: EMIT, add: 0, x: e.x, y: e.y - 10, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 - 90, drag: 0.86, life: 1.4, size: 7, spin: 8, home: true, onDone: i === 0 ? () => snd.play('coin', 0.45) : undefined }); }
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; fx.part({ tex: 'dot', x: e.x, y: e.y - 10, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, drag: 0.86, life: 1.4, size: 6, col: 0x7fd8ff, home: true }); }
        if (e.it != null) {
          const col = hexCol(RARITY_COLORS[e.it]); fx.pillar(e.x, e.y, col, 1.5, 28, e.it >= 3 ? 460 : 220); fx.ring(e.x, e.y, 6, 70, 0.6, col, true, 0);
          fx.part({ tex: 'star', x: e.x, y: e.y - 20, vx: 0, vy: -200, drag: 0.9, life: 1.6, size: 16, col, home: true, spin: 3 });
          if (e.it >= 3) { fx.light(e.x, e.y, 200, col, 1, 1.2); fx.burst(e.x, e.y - 20, 16, [col, 0xffffff], 220, 6, 0.8, 'star'); }
          snd.play(e.it >= 4 ? 'legend' : e.it >= 3 ? 'item_epic' : 'item');
        }
        if (e.tl) { fx.pillar(e.x, e.y, 0xffe07a, 1.2, 22, 240); fx.part({ tex: 'paper', layer: EMIT, add: 0, x: e.x, y: e.y - 20, vx: 0, vy: -160, drag: 0.9, life: 1.5, size: 9, home: true, spin: 6 }); snd.play('item'); }
        return;
      }
      case 'lvl': {
        const p = this.players.get(e.p); const x = p?.x ?? 0, y = p?.y ?? 0; const mine = e.p === this.myId;
        fx.pillar(x, y, 0xffd54a, 1.6, 70, 560); fx.sigil(x, y, 150, 0xffd54a, 1.8, 'sigil', 1.5, mine ? 0.7 : 0.35); fx.ring(x, y, 10, 180, 0.9, 0xffd54a, true, 0);
        fx.burst(x, y - 30, mine ? 24 : 10, [0xffd54a, 0xfff6c8, 0xffffff], 300, 9, 1.0, 'star'); fx.light(x, y, 360, 0xffd54a, 1.2, 1.2);
        if (mine) {
          snd.play('level'); snd.duck(0.5, 1.5); fx.flash(0xfff4c0, 0.25); fx.wave(x, y, 300, 14, 0.8); }
        return;
      }
      case 'heal': { const p = this.players.get(e.p); if (p && (e.p === this.myId || this.near(p.x, p.y, 420))) { fx.text(p.x, p.y - 60, `+${e.v}`, '#7dffb0', e.p === this.myId ? 16 : 12); fx.burst(p.x, p.y - 24, 4, [0x7dffb0], 60, 5, 0.6, 'dot', -40); } return; }
      case 'shield': { const p = this.players.get(e.p); if (p) fx.ring(p.x, p.y - 22, 28, 38, 0.4, 0xe0c3ff, true); return; }
      case 'down': {
        const p = this.players.get(e.p); if (p) { fx.burst(p.x, p.y - 20, 16, [0x8a8aa0, 0xffffff], 120, 6, 0.6); fx.smoke(p.x, p.y - 10, 5, 0x3a3448, 60, 26, 0.9, 0.5); }
        if (e.p === this.myId) { snd.play('down'); fx.shake(0.4); }
        else if (p && this.near(p.x, p.y, 600) && performance.now() - this.downToastT > 15000) { this.downToastT = performance.now(); this.hooks.onToast(`${this.roster.get(e.p)?.name ?? '동료'}님이 쓰러졌습니다! 곁에 서면 일으킬 수 있어요`, '#ff9a9a'); }
        return;
      }
      case 'rev': {
        const p = this.players.get(e.p); const x = p?.x ?? 0, y = p?.y ?? 0;
        if (e.by === -2 || e.by === -1) { fx.pillar(x, y, 0x9fd7ff, 0.9, 50, 300); fx.burst(x, y - 20, 24, [0x9fd7ff, 0xffffff], 200, 6, 0.6); if (e.p === this.myId) snd.play('tp'); }
        else {
          fx.pillar(x, y, 0x7dffb0, 1.2, 56, 320); fx.ring(x, y, 10, 120, 0.6, 0x7dffb0, true, 0); fx.debris(x, y - 30, 14, 'petal', [0xbfffd8, 0xffffff, 0xffc8dc], 220, 7, 1.2);
          fx.text(x, y - 72, '부활!', '#7dffb0', 20, true, 1.2); fx.light(x, y, 240, 0x7dffb0, 1, 0.8); if (e.p === this.myId || e.by === this.myId) snd.play('revive');
        }
        return;
      }
      case 'mon': {
        const m = this.mons.get(e.id); const x = e.x ?? m?.x ?? 0, y = e.y ?? m?.y ?? 0;
        if (e.a === 'roar') { fx.ring(x, y - 30, 20, 280, 0.7, 0xff5a5a, false, 1); if (this.near(x, y, 720)) { snd.play('roar', 1, x, y); fx.shake(0.45); fx.wave(x, y - 30, 320, 16, 0.8); fx.chroma(0.008); } }
        else if (e.a === 'blink') { fx.smoke(x, y - 20, 10, 0x2a1838, 120, 30, 0.8, 0.8); fx.burst(x, y - 30, 20, [0xb8a6ff, 0xffffff], 240, 6, 0.6); if (this.near(x, y, 600)) snd.play('blink', 0.6, x, y); }
        else if (e.a === 'summon') { fx.sigil(x, y, 150, 0xb8a6ff, 1.2, 'sigil', -1.5); fx.ring(x, y - 10, 20, 150, 0.6, 0xb8a6ff, true, 0); if (this.near(x, y, 700)) snd.play('summon', 0.7, x, y); }
        else if (e.a === 'dash') { fx.smoke(x, y, 8, 0x8a7a6a, 140, 26, 0.7, 0.55); if (this.near(x, y, 600)) snd.play('dash', 0.6, x, y); }
        return;
      }
      case 'emote': { const p = this.players.get(e.p); if (p) { p.bubble = { text: emoteText(e.e), until: performance.now() + 2600 }; if (this.near(p.x, p.y, 500)) snd.play('emote'); } return; }
      case 'quest': this.hooks.onToast(e.title, '#ffe066', true); snd.play('quest'); return;
      case 'toast': this.hooks.onToast(e.text, e.c); return;
      case 'unlock': snd.play('cls_change', 0.8); this.hooks.onUnlock?.(e.c); return;
    }
  }
  resize(): void { this.r?.resize(); }
  applySettings(): void { if (!this.r) return; this.r.setQuality(this.set.quality as Quality); this.fx.shakeOn = this.set.shake; this.r.showNames = this.set.names; }
}
