// One channel of the game world: authoritative simulation at TICK_HZ.
import { DT, PLAYER_R, TAL_SLOTS, DOWN_TIME, REVIVE_R, REVIVE_TIME } from '../shared/constants.ts';
import { generateMap, zoneAt, type GameMap } from '../shared/map.ts';
import { stepPlayer, circleHits } from '../shared/movement.ts';
import { segDist2 } from '../shared/math.ts';
import { Rng } from '../shared/rng.ts';
import { MONSTERS, hpMul, dmgMul, isBossType } from '../shared/data/monsters.ts';
import { ZONES, TOWN } from '../shared/data/zones.ts';
import { computeStats } from '../shared/data/items.ts';
import { CLASSES, ATK } from '../shared/data/classes.ts';
import type { Profile, RosterEntry } from '../shared/types.ts';
import type { Ev, S2C } from '../shared/protocol.ts';
import type { Player, Monster, Hazard, EProj, Sched, WorldEvent } from './entities.ts';
import { Spatial } from './spatial.ts';
import { updateMonster, separate } from './ai.ts';
import { playerCombat } from './combat.ts';
import { director } from './director.ts';
import { worldBossTick, newWorldBoss, type WorldBoss } from './worldboss.ts';
import { onVisitZone, questCheckState } from './progress.ts';
import type { BotBrain } from './bots.ts';
import { TALS } from '../shared/data/talismans.ts';

export interface WorldOpts { seed: number; channel: number; name: string; online: boolean; wbInterval: number; wbFirst: number; map?: GameMap }

export class World {
  map: GameMap; rng: Rng; opts: WorldOpts;
  tick = 0; time = 0;
  players = new Map<number, Player>(); mons = new Map<number, Monster>(); spatial = new Spatial();
  hazards: Hazard[] = []; eprojs: EProj[] = []; sched: Sched[] = [];
  events: WorldEvent[] = []; broadcast: S2C[] = [];
  rosterAdd: RosterEntry[] = []; rosterDel: number[] = [];
  brains = new Map<number, BotBrain>();
  /** Standing musicians and guardians this tick (their passive auras). */
  musicians: Player[] = []; guardians: Player[] = [];
  lairs: { mon: number; respawnT: number }[];
  wb: WorldBoss; goldGobT = 150; perf = { tickMs: 0, maxMs: 0 };
  deathLog: { by: string; lv: number; zone: number; bot: boolean; t: number }[] = [];
  private nextPid = 1; private monCursor = 1; nextVolley = 1;

  constructor(opts: WorldOpts) {
    this.opts = opts; this.map = opts.map ?? generateMap(opts.seed); this.rng = new Rng(opts.seed ^ (opts.channel * 7919));
    this.lairs = this.map.lairs.map(() => ({ mon: 0, respawnT: 3 }));
    this.wb = newWorldBoss(opts.wbFirst);
  }

  // ---------- players ----------
  addPlayer(token: string, prof: Profile, bot: boolean): Player {
    let id = this.nextPid; while (this.players.has(id)) id = (id % 65535) + 1; this.nextPid = (id % 65535) + 1;
    const stats = computeStats(prof);
    let x = prof.x ?? this.map.spawn.x, y = prof.y ?? this.map.spawn.y;
    const z = zoneAt(this.map, x, y); if (z === 5 || (prof.x == null)) { x = this.map.spawn.x; y = this.map.spawn.y; }
    const sp = this.safeSpot(x, y); x = sp[0]; y = sp[1];
    const p: Player = {
      id, token, prof, stats, bot, x, y, face: Math.PI / 2, moving: false, ix: 0, iy: 0,
      hp: stats.maxHp, shield: 0, shieldT: 0, down: false, downT: 0, reviveP: 0, safeT: 3,
      inputs: [], lastSeq: 0, inBudget: 4, atkT: 0.5, cds: new Array(TAL_SLOTS).fill(0.5), bladeHits: new Map(), auraT: 0, lastAtkT: -99,
      ult: 0, ultT: 0, ultTick: 0, buffT: 0, buffAspd: 0, clsT: -99, lastHurtT: -99, hurtFlagT: 0, zone: zoneAt(this.map, x, y), wbDmg: 0, wbT: 0,
      invVer: 1, talVer: 1, questVer: 1, statVer: 1, priv: [], dmgAcc: new Map(),
      chatT: -99, actT: 0, actBudget: 20, tpT: 0, surgeT: 60 + this.rng.range(0, 40), saveT: 60, joinedT: this.time, online: true, lastHitBy: '', auto: false, volleys: new Map(),
    };
    this.players.set(id, p); this.rosterAdd.push(this.rosterEntry(p));
    questCheckState(this, p);
    return p;
  }
  removePlayer(p: Player): void {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id); this.brains.delete(p.id); this.rosterDel.push(p.id); p.online = false;
    p.prof.x = Math.round(p.x); p.prof.y = Math.round(p.y);
    for (const m of this.mons.values()) if (m.tgt === p.id) m.tgt = 0;
  }
  rosterEntry(p: Player): RosterEntry {
    const tals: [any, number][] = [];
    for (const uid of p.prof.slots) { const t = uid == null ? null : p.prof.tals.find(x => x.uid === uid); if (t) tals.push([t.kind, t.lv]); }
    return { id: p.id, name: p.prof.name, cls: p.prof.cls, level: p.prof.level, bot: p.bot, tals, power: p.stats.power };
  }
  rosterChanged(p: Player): void { if (this.players.has(p.id)) this.rosterAdd.push(this.rosterEntry(p)); }
  recompute(p: Player): void {
    const old = p.stats.maxHp; p.stats = computeStats(p.prof);
    if (p.stats.maxHp !== old && !p.down) p.hp = Math.max(1, Math.min(p.stats.maxHp, Math.round(p.hp * p.stats.maxHp / old)));
    p.statVer++; this.rosterChanged(p);
  }
  queueInput(p: Player, s: number, x: number, y: number): void {
    if (p.inputs.length >= 12) p.inputs.shift();
    p.inputs.push({ s, x: Math.max(-127, Math.min(127, x | 0)), y: Math.max(-127, Math.min(127, y | 0)) });
  }
  safeSpot(x: number, y: number): [number, number] {
    const m = this.map;
    for (let r = 0; r < 200; r += 8) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!circleBlocked(m, px, py)) return [Math.round(px * 8) / 8, Math.round(py * 8) / 8];
      if (r === 0) break;
    }
    return [m.spawn.x, m.spawn.y];
  }

  // ---------- monsters ----------
  spawnMonster(t: number, x: number, y: number, lv: number, o: { elite?: boolean; summon?: boolean; lair?: number; hpScale?: number } = {}): Monster | null {
    if (this.mons.size >= 3000) return null;
    let id = this.monCursor; let guard = 0; while (this.mons.has(id) && guard++ < 70000) id = (id % 65535) + 1; this.monCursor = (id % 65535) + 1;
    const def = MONSTERS[t]; const elite = !!o.elite;
    const lvl = def.level ?? lv;
    const maxHp = Math.round(def.hp * hpMul(lvl) * (elite ? 5 : 1) * (o.hpScale ?? 1));
    const m: Monster = {
      id, t, def, x, y, vx: 0, vy: 0, hp: maxHp, maxHp, lv: lvl, elite, r: def.r * (elite ? 1.35 : 1), dmg: def.dmg * dmgMul(lvl) * (elite ? 1.5 : 1),
      st: 'idle', stT: 0, tgt: 0, retT: this.rng.range(0, 0.5), atkT: this.rng.range(0.3, 1), slowT: 0, slowMul: 1, stunT: 0, hitT: 0,
      hx: x, hy: y, farT: 0, left: false, lifeT: 0, contrib: new Map(), boss: null, summon: !!o.summon, dead: false, dvx: 0, dvy: 0, lairIdx: o.lair ?? -1,
    };
    if (isBossType(t)) m.boss = { patT: 2.5, seq: 0, enraged: false, castT: 0, cast: '', scale: 1, summons: 0, hideT: 0, dashT: 0, dvx: 0, dvy: 0, engagedT: 0 };
    this.mons.set(id, m); return m;
  }

  // ---------- events ----------
  emit(ev: Ev, x: number, y: number): void { this.events.push({ ev, x, y }); }
  emitAll(ev: Ev): void { this.events.push({ ev, x: 0, y: 0, all: true }); }
  emitTo(p: Player, ev: Ev): void { if (!p.bot) p.priv.push(ev); }
  announce(text: string, kind: 'info' | 'boss' | 'legend' | 'event' = 'info'): void { this.broadcast.push({ t: 'ann', text, kind }); }
  toast(p: Player, text: string, c?: string): void { this.emitTo(p, { k: 'toast', text, c }); }
  after(sec: number, fn: () => void): void { this.sched.push({ due: this.time + sec, fn }); }

  // ---------- health ----------
  hurtPlayer(p: Player, raw: number, pctOfMax = 0, src = ''): void {
    if (p.down || p.safeT > 0 || !this.players.has(p.id)) return;
    if (src) p.lastHitBy = src;
    let dmg = raw * (1 - p.stats.dr) + pctOfMax * p.stats.maxHp * (1 - p.stats.dr * 0.5);
    const ud = CLASSES[p.prof.cls].ultDr; if (p.ultT > 0 && ud) dmg *= ud;
    if (this.guardians.length && this.guardians.some(g => g !== p && (g.x - p.x) ** 2 + (g.y - p.y) ** 2 < ATK.guardianAura ** 2)) dmg *= 1 - ATK.guardianDr;
    dmg = Math.max(1, Math.round(dmg));
    if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; }
    p.lastHurtT = this.time; p.hurtFlagT = 0.25;
    if (dmg <= 0) return;
    p.hp -= dmg; this.emitTo(p, { k: 'hurt', v: dmg });
    if (p.hp <= 0) this.downPlayer(p);
  }
  healPlayer(p: Player, amount: number, show = true): void {
    if (p.down || amount <= 0) return; const before = p.hp; p.hp = Math.min(p.stats.maxHp, p.hp + amount);
    const got = Math.round(p.hp - before); if (show && got >= 1) this.emit({ k: 'heal', p: p.id, v: got }, p.x, p.y);
  }
  downPlayer(p: Player): void {
    p.hp = 0; p.down = true; p.downT = DOWN_TIME; p.reviveP = 0; p.shield = 0; p.ultT = 0; p.buffT = 0; p.inputs.length = 0;
    p.prof.stats.deaths++; p.questVer++;
    if (this.deathLog.length < 5000) this.deathLog.push({ by: p.lastHitBy, lv: p.prof.level, zone: p.zone, bot: p.bot, t: this.time });
    this.emit({ k: 'down', p: p.id }, p.x, p.y);
    for (const m of this.mons.values()) if (m.tgt === p.id) m.tgt = 0;
  }
  revivePlayer(p: Player, by: Player | null, frac: number): void {
    if (!p.down) return; p.down = false; p.hp = Math.max(1, Math.round(p.stats.maxHp * frac)); p.safeT = 2; p.reviveP = 0;
    this.emit({ k: 'rev', p: p.id, by: by ? by.id : 0 }, p.x, p.y);
    if (by && by !== p) { by.prof.stats.revives++; by.questVer++; this.toast(p, `${by.prof.name}님이 당신을 일으켰습니다!`, '#7dffb0'); this.toast(by, `${p.prof.name}님을 일으켰습니다! 👍`, '#7dffb0'); }
  }
  respawn(p: Player): void {
    let best = this.map.shrines[0], bd = Infinity;
    for (const s of this.map.shrines) { if (!p.prof.shrines.includes(s.id)) continue; const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2; if (d < bd) { bd = d; best = s; } }
    const [x, y] = this.safeSpot(best.x, best.y + 40); p.x = x; p.y = y; p.inputs.length = 0;
    p.down = false; p.hp = p.stats.maxHp; p.safeT = 3; p.shield = 0; p.reviveP = 0;
    this.emit({ k: 'rev', p: p.id, by: -1 }, p.x, p.y);
  }
  teleport(p: Player, x: number, y: number): void { const [sx, sy] = this.safeSpot(x, y); p.x = sx; p.y = sy; p.inputs.length = 0; p.safeT = Math.max(p.safeT, 1.5); this.emit({ k: 'rev', p: p.id, by: -2 }, p.x, p.y); }

  // ---------- tick ----------
  step(): void {
    const t0 = performance.now();
    this.tick++; this.time = this.tick * DT;
    for (const [id, b] of this.brains) { const p = this.players.get(id); if (p) b.update(this, p); else this.brains.delete(id); }
    for (const p of this.players.values()) this.movePlayer(p);
    this.musicians.length = 0; this.guardians.length = 0;
    for (const p of this.players.values()) if (!p.down) { if (p.prof.cls === 'musician') this.musicians.push(p); else if (p.prof.cls === 'guardian') this.guardians.push(p); }
    this.spatial.rebuild(this.mons.values());
    for (const p of this.players.values()) this.updatePlayer(p);
    for (const p of this.players.values()) if (!p.down) playerCombat(this, p);
    this.runSched();
    for (const m of this.mons.values()) if (!m.dead) updateMonster(this, m);
    separate(this);
    this.updateProjectiles(); this.resolveHazards();
    if (this.tick % 5 === 0) director(this);
    worldBossTick(this);
    for (const [id, m] of this.mons) if (m.dead) this.mons.delete(id);
    const ms = performance.now() - t0; this.perf.tickMs = this.perf.tickMs * 0.95 + ms * 0.05; this.perf.maxMs = Math.max(this.perf.maxMs * 0.999, ms);
  }
  private movePlayer(p: Player): void {
    // token bucket: at most ~1 input per tick on average (anti speed-hack), bursts up to 4 to catch up after jitter
    p.inBudget = Math.min(4, p.inBudget + 1);
    let n = 0; let moved = false;
    while (p.inputs.length && p.inBudget >= 1 && n < 3) {
      const inp = p.inputs.shift()!; p.inBudget--; n++; p.lastSeq = inp.s;
      if (p.down) continue;
      p.ix = inp.x; p.iy = inp.y;
      const speed = p.stats.move * (p.ultT > 0 ? CLASSES[p.prof.cls].ultMove ?? 1 : 1);
      const [nx, ny] = stepPlayer(this.map, p.x, p.y, inp.x, inp.y, speed, PLAYER_R);
      if (nx !== p.x || ny !== p.y) moved = true;
      p.x = nx; p.y = ny;
      if (inp.x !== 0 || inp.y !== 0) { if (this.time - p.lastAtkT > 0.4) p.face = Math.atan2(inp.y, inp.x); }
    }
    p.moving = moved;
  }
  private updatePlayer(p: Player): void {
    p.safeT = Math.max(0, p.safeT - DT); p.hurtFlagT = Math.max(0, p.hurtFlagT - DT); p.tpT = Math.max(0, p.tpT - DT);
    p.prof.stats.playSec += DT; p.saveT -= DT;
    if (p.shieldT > 0) { p.shieldT -= DT; if (p.shieldT <= 0) p.shield = 0; }
    const z = zoneAt(this.map, p.x, p.y);
    if (z !== p.zone) { p.zone = z; onVisitZone(this, p, z); }
    for (const s of this.map.shrines) if (!p.prof.shrines.includes(s.id) && (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < 150 * 150) { p.prof.shrines.push(s.id); p.questVer++; this.toast(p, `신당 발견: ${s.name} — 지도에서 순간이동할 수 있습니다`, '#9fd7ff'); }
    if (p.down) {
      p.downT -= DT;
      let reviver: Player | null = null;
      for (const q of this.players.values()) if (q !== p && !q.down && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < REVIVE_R * REVIVE_R) { reviver = q; break; }
      if (reviver) { p.reviveP += DT; if (p.reviveP >= REVIVE_TIME) this.revivePlayer(p, reviver, 0.4); }
      else p.reviveP = Math.max(0, p.reviveP - DT * 0.5);
      if (p.down && p.downT <= 0) this.respawn(p);
      return;
    }
    // regeneration: fast in town, slow out of combat
    const idle = this.time - p.lastHurtT;
    if (z === TOWN) this.healPlayer(p, p.stats.maxHp * 0.15 * DT, false);
    else if (idle > 5) this.healPlayer(p, p.stats.maxHp * 0.02 * DT, false);
    if (p.ultT > 0) p.ultT -= DT;
    if (p.buffT > 0) p.buffT -= DT;
  }
  /** Attack-speed multiplier from auras and buffs (musician passive/ult, assassin ult). */
  aspdMul(p: Player): number {
    let k = 1;
    if (this.musicians.some(q => q !== p && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < ATK.musicianAura ** 2)) k += ATK.musicianAspd;
    if (p.buffT > 0) k += p.buffAspd;
    if (p.ultT > 0 && p.prof.cls === 'assassin') k += 0.5;
    return k;
  }
  private runSched(): void {
    if (!this.sched.length) return;
    const due: Sched[] = []; const keep: Sched[] = [];
    for (const s of this.sched) (s.due <= this.time ? due : keep).push(s);
    this.sched = keep; for (const s of due) s.fn();
  }
  private updateProjectiles(): void {
    const out: EProj[] = [];
    for (const pr of this.eprojs) {
      pr.x += pr.vx * DT; pr.y += pr.vy * DT; pr.life -= DT;
      if (pr.life <= 0 || circleBlocked(this.map, pr.x, pr.y, 2)) continue;
      let hit = false;
      for (const p of this.players.values()) {
        if (p.down) continue; const rr = pr.r + PLAYER_R;
        if ((p.x - pr.x) ** 2 + (p.y - pr.y) ** 2 < rr * rr) {
          hit = true; if (pr.vid) { if (p.volleys.has(pr.vid)) break; p.volleys.set(pr.vid, this.time); if (p.volleys.size > 32) for (const [k, t] of p.volleys) if (t < this.time - 5) p.volleys.delete(k); }
          this.hurtPlayer(p, pr.dmg, pr.pct, pr.tag); break;
        }
      }
      if (!hit) out.push(pr);
    }
    this.eprojs = out;
  }
  /** `vid` groups projectiles of one volley: a player is hit at most once per volley (fans/rings can't stack on melee). */
  fireProj(x: number, y: number, ang: number, speed: number, dmg: number, style: number, pct = 0, r = 9, range = 700, tag = '', vid = 0): void {
    const vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed; const life = range / speed;
    this.eprojs.push({ x, y, vx, vy, r, life, dmg, pct, tag, vid });
    this.emit({ k: 'proj', x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy), r, life: Math.round(life * 100) / 100, s: style }, x, y);
  }
  hazard(h: Omit<Hazard, 'due'> & { delay: number; style?: number }): void {
    const { delay, style, ...rest } = h; this.hazards.push({ ...rest, due: this.time + delay });
    const ev: Ev = h.sh === 0 ? { k: 'tele', sh: 0, x: Math.round(h.x), y: Math.round(h.y), r: Math.round(h.r), d: delay, s: style ?? 0 }
      : { k: 'tele', sh: 1, x: Math.round(h.x), y: Math.round(h.y), r: Math.round(h.w), x2: Math.round(h.x2), y2: Math.round(h.y2), d: delay, s: style ?? 0 };
    this.emit(ev, h.x, h.y);
  }
  private resolveHazards(): void {
    if (!this.hazards.length) return; const keep: Hazard[] = [];
    for (const h of this.hazards) {
      if (h.due > this.time) { keep.push(h); continue; }
      const src = this.mons.get(h.src); if (h.src && (!src || src.dead)) continue; // cancelled when the caster dies
      for (const p of this.players.values()) {
        if (p.down) continue; let inside: boolean;
        if (h.sh === 0) inside = (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < (h.r + PLAYER_R * 0.5) ** 2;
        else { const d2 = segDist2(p.x, p.y, h.x, h.y, h.x2, h.y2); inside = d2 < (h.w / 2 + PLAYER_R * 0.5) ** 2; }
        if (inside) { if (h.hit) h.hit(p); else this.hurtPlayer(p, h.dmg, h.pct, h.tag ?? (src ? src.def.key : '')); }
      }
      this.emit({ k: 'boom', x: Math.round(h.x), y: Math.round(h.y), r: Math.round(h.sh === 0 ? h.r : h.w), s: h.sh }, h.x, h.y);
    }
    this.hazards = keep;
  }
  nearestPlayer(x: number, y: number, r: number, filter?: (p: Player) => boolean): Player | null {
    let best: Player | null = null, bd = r * r;
    for (const p of this.players.values()) { if (p.down || p.safeT > 2.5) continue; if (filter && !filter(p)) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  playersNear(x: number, y: number, r: number, includeDown = false): Player[] {
    const out: Player[] = []; for (const p of this.players.values()) { if (!includeDown && p.down) continue; if ((p.x - x) ** 2 + (p.y - y) ** 2 < r * r) out.push(p); } return out;
  }
  humans(): number { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }
  talSlotsOf(p: Player): ({ kind: keyof typeof TALS; lv: number } | null)[] {
    return p.prof.slots.map(uid => { if (uid == null) return null; const t = p.prof.tals.find(x => x.uid === uid); return t ? { kind: t.kind, lv: t.lv } : null; });
  }
  zoneName(z: number): string { return ZONES[z]?.name ?? ''; }
}

export const circleBlocked = (m: GameMap, x: number, y: number, r = PLAYER_R): boolean => circleHits(m, x, y, r);
