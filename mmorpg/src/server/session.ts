// One client connection: parses commands, builds per-player snapshots (area of interest) and state diffs.
import { AOI } from '../shared/constants.ts';
import { mapToWire, type WireMap } from '../shared/map.ts';
import { encodeSnap, PF, MF, type C2S, type S2C, type SnapPlayer, type SnapMon, type Ev, type BossInfo } from '../shared/protocol.ts';
import { xpNeed } from '../shared/data/xp.ts';
import { WORLD_BOSS } from '../shared/data/monsters.ts';
import type { MeState } from '../shared/types.ts';
import type { World } from './world.ts';
import type { Player, Monster } from './entities.ts';
import { doAction } from './actions.ts';

export interface Conn { send(data: string | Uint8Array): void; close(): void; buffered?(): number }

export class Session {
  conn: Conn; world: World | null = null; player: Player | null = null;
  private last: Record<string, unknown> = {}; private vers = { inv: -1, tal: -1, quest: -1, stat: -1 };
  private bossKey = ''; private bossT = 0; private msgWindow = 0; private msgCount = 0;
  bytesOut = 0; closed = false; token = '';
  constructor(conn: Conn) { this.conn = conn; }

  send(m: S2C): void { if (this.closed) return; const s = JSON.stringify(m); this.bytesOut += s.length; this.conn.send(s); }
  sendBin(b: Uint8Array): void { if (this.closed) return; this.bytesOut += b.length; this.conn.send(b); }

  /** Returns a parsed command, or null if it was rejected. Rate limits abusive clients. */
  parse(data: string, now: number): C2S | null {
    if (now - this.msgWindow >= 1) { this.msgWindow = now; this.msgCount = 0; }
    if (++this.msgCount > 90) { if (this.msgCount > 400) this.kick('요청이 너무 많습니다'); return null; }
    if (typeof data !== 'string' || data.length > 2000) return null;
    try { const m = JSON.parse(data); return m && typeof m.t === 'string' ? (m as C2S) : null; } catch { return null; }
  }
  kick(msg: string): void { this.send({ t: 'err', msg, fatal: 1 }); this.closed = true; try { this.conn.close(); } catch { /* ignore */ } }

  handle(m: C2S): void {
    const w = this.world, p = this.player; if (!w || !p) return;
    switch (m.t) {
      case 'i': if (!p.auto && Number.isFinite(m.s) && Number.isFinite(m.x) && Number.isFinite(m.y)) w.queueInput(p, m.s | 0, m.x, m.y); return;
      case 'ping': this.send({ t: 'pong', n: Number(m.n) || 0, tick: w.tick }); return;
      case 'hello': return;
      default: { const err = doAction(w, p, m); if (err) this.send({ t: 'err', msg: err }); }
    }
  }

  welcome(w: World, p: Player, server: string): void {
    this.world = w; this.player = p;
    const roster = [...w.players.values()].map(q => w.rosterEntry(q));
    const me = this.meState(p) as MeState;
    this.last = {}; this.vers = { inv: p.invVer, tal: p.talVer, quest: p.questVer, stat: p.statVer };
    for (const k of Object.keys(me)) this.last[k] = JSON.stringify((me as any)[k]);
    this.send({ t: 'welcome', id: p.id, channel: w.opts.channel, tick: w.tick, map: wireMapCache(w), roster, me, online: w.opts.online, server, wb: { state: w.wb.state, t: Math.round(w.wb.t) } });
  }

  private meState(p: Player): Partial<MeState> {
    const pr = p.prof;
    return {
      id: p.id, name: pr.name, cls: pr.cls, level: pr.level, xp: Math.floor(pr.xp), xpNeed: xpNeed(pr.level), gold: pr.gold, shards: pr.shards,
      hp: Math.ceil(p.hp), maxHp: p.stats.maxHp, shield: Math.ceil(p.shield), ult: Math.floor(p.ult), ultT: Math.max(0, Math.round(p.ultT * 10) / 10),
      downed: p.down ? Math.ceil(p.downT) : 0, revive: p.down ? Math.round((p.reviveP / 2) * 100) / 100 : 0,
      stats: p.stats, inv: pr.inv, equip: pr.equip, tals: pr.tals, slots: pr.slots, cds: p.cds.map(c => Math.max(0, Math.round(c * 10) / 10)),
      quest: pr.quest, shrines: pr.shrines, zone: p.zone, lstats: pr.stats, pity: pr.pity, autoSell: pr.opts?.autoSell ?? -1, auto: p.auto,
    };
  }

  flush(): void {
    const w = this.world, p = this.player; if (!w || !p || this.closed) return;
    if (this.conn.buffered && this.conn.buffered() > 512 * 1024) return; // slow client: skip a frame rather than queue forever
    // ---- snapshot ----
    const players: SnapPlayer[] = [];
    for (const q of w.players.values()) {
      if (Math.abs(q.x - p.x) > AOI || Math.abs(q.y - p.y) > AOI) continue;
      let f = 0; if (q.down) f |= PF.DOWN; if (q.shield > 0) f |= PF.SHIELD; if (q.ultT > 0) f |= PF.WHIRL; if (q.moving) f |= PF.MOVING;
      if (q.safeT > 0) f |= PF.SAFE; if (q.bot) f |= PF.BOT; if (q.down && q.reviveP > 0) f |= PF.REVIVING; if (q.hurtFlagT > 0) f |= PF.HURT;
      players.push({ id: q.id, x: q.x, y: q.y, hp: q.down ? 0 : Math.max(1, Math.round((q.hp / q.stats.maxHp) * 255)), f, face: faceByte(q.face) });
    }
    const near: Monster[] = []; w.spatial.rect(p.x, p.y, AOI, AOI, near);
    if (near.length > 350) near.sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2)).length = 350;
    const mons: SnapMon[] = near.map(m => {
      let f = 0; if (m.elite) f |= MF.ELITE; if (m.slowT > 0) f |= MF.SLOW; if (m.st === 'wind' || (m.boss && m.boss.castT > 0 && m.boss.dashT <= 0)) f |= MF.WIND;
      if (m.st === 'dash' || (m.boss && m.boss.dashT > 0)) f |= MF.DASH; if (m.left) f |= MF.LEFT; if (m.hitT > 0) f |= MF.HIT; if (m.boss && m.boss.hideT > 0) f |= MF.HIDE;
      return { id: m.id, t: m.t, x: m.x, y: m.y, hp: Math.max(1, Math.round((m.hp / m.maxHp) * 255)), f };
    });
    this.sendBin(encodeSnap(w.tick, p.lastSeq, players, mons));
    // ---- events ----
    const evs: Ev[] = [];
    for (const e of w.events) if (e.all || (Math.abs(e.x - p.x) < AOI + 150 && Math.abs(e.y - p.y) < AOI + 150)) evs.push(e.ev);
    for (const [id, [v, cr]] of p.dmgAcc) evs.push(cr ? { k: 'dmg', id, v, cr: 1 } : { k: 'dmg', id, v });
    p.dmgAcc.clear();
    if (p.priv.length) { evs.push(...p.priv); p.priv.length = 0; }
    if (evs.length) this.send({ t: 'ev', tick: w.tick, e: evs });
    // ---- private state diff ----
    const me = this.meState(p); const d: Partial<MeState> = {};
    const skip = new Set<string>();
    if (p.invVer === this.vers.inv) { skip.add('inv'); skip.add('equip'); }
    if (p.talVer === this.vers.tal) { skip.add('tals'); skip.add('slots'); }
    if (p.questVer === this.vers.quest) { skip.add('quest'); skip.add('shrines'); skip.add('lstats'); }
    if (p.statVer === this.vers.stat) skip.add('stats');
    this.vers = { inv: p.invVer, tal: p.talVer, quest: p.questVer, stat: p.statVer };
    let any = false;
    for (const k of Object.keys(me)) {
      if (skip.has(k)) continue; const s = JSON.stringify((me as any)[k]);
      if (this.last[k] !== s) { this.last[k] = s; (d as any)[k] = (me as any)[k]; any = true; }
    }
    if (any) this.send({ t: 'me', d });
    // ---- boss bar ----
    this.bossT--;
    let boss: Monster | null = null, bd = 1100 * 1100;
    for (const m of near) if (m.boss && !m.dead) { const dd = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (dd < bd || m.t === WORLD_BOSS) { bd = dd; boss = m; } }
    const b: BossInfo | null = boss ? { id: boss.id, type: boss.t, hp: Math.ceil(boss.hp), maxHp: boss.maxHp, enr: boss.boss!.enraged ? 1 : undefined } : null;
    const key = b ? `${b.id}:${b.hp}:${b.maxHp}:${b.enr ?? 0}` : '';
    if (key !== this.bossKey && (this.bossT <= 0 || !b || !this.bossKey)) { this.bossKey = key; this.bossT = 2; this.send({ t: 'boss', b }); }
  }
}
const faceByte = (a: number) => Math.round((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 255) & 255;

const wireCache = new WeakMap<object, WireMap>();
function wireMapCache(w: World): WireMap { let c = wireCache.get(w.map); if (!c) { c = mapToWire(w.map); wireCache.set(w.map, c); } return c; }
