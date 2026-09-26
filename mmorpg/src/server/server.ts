// Transport-agnostic game server: channels (worlds), sessions, persistence. Driven by tick() at 20 Hz.
import { SNAP_EVERY, PROTOCOL_VERSION, CHANNEL_CAP } from '../shared/constants.ts';
import { CLASSES, STARTER_CLASSES, isClassId } from '../shared/data/classes.ts';
import { newProfile, computeStats } from '../shared/data/items.ts';
import type { ClassId, Profile } from '../shared/types.ts';
import { generateMap } from '../shared/map.ts';
import { World } from './world.ts';
import { Session, type Conn } from './session.ts';
import { cleanName } from './actions.ts';
import { addBots } from './bots.ts';
import { wbPublic } from './worldboss.ts';

export interface ProfileStore { load(token: string): Profile | null; save(token: string, p: Profile): void }
export interface ServerOpts { seed: number; channels: number; name: string; online: boolean; bots: number; wbInterval: number; wbFirst: number; store: ProfileStore; now?: () => number }

export class GameServer {
  worlds: World[] = []; sessions = new Set<Session>(); opts: ServerOpts; botsAdded = new Set<World>();
  constructor(opts: ServerOpts) {
    this.opts = opts; const map = generateMap(opts.seed);
    for (let c = 0; c < opts.channels; c++) this.worlds.push(new World({ seed: opts.seed, channel: c + 1, name: opts.name, online: opts.online, wbInterval: opts.wbInterval, wbFirst: opts.wbFirst + c * 45, map }));
  }
  now(): number { return (this.opts.now ?? (() => Date.now() / 1000))(); }
  connect(conn: Conn): Session { const s = new Session(conn); this.sessions.add(s); return s; }

  message(s: Session, data: string): void {
    const m = s.parse(data, this.now()); if (!m) return;
    if (m.t === 'hello') { if (!s.player) this.hello(s, m); return; }
    s.handle(m);
  }
  close(s: Session): void {
    this.sessions.delete(s); s.closed = true;
    if (s.world && s.player) { this.save(s.player.token, s.player.prof, s.player); s.world.removePlayer(s.player); }
    s.world = null; s.player = null;
  }
  private hello(s: Session, m: { v: number; token: string; name: string; cls: ClassId }): void {
    if (m.v !== PROTOCOL_VERSION) { s.kick('게임 버전이 다릅니다. 새로고침 해주세요.'); return; }
    if (typeof m.token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(m.token)) { s.kick('잘못된 접속 정보입니다'); return; }
    for (const o of this.sessions) if (o !== s && o.token === m.token && o.player) { o.kick('다른 곳에서 같은 캐릭터로 접속했습니다'); this.close(o); }
    s.token = m.token;
    let prof = this.opts.store.load(m.token);
    if (prof && !validProfile(prof)) prof = null;
    if (!prof) {
      let name = cleanName(m.name); if (!name || /^ai\b/i.test(name)) name = '퇴마사' + Math.floor(1000 + Math.random() * 9000);
      const cls: ClassId = STARTER_CLASSES.includes(m.cls) ? m.cls : 'sword';
      prof = newProfile(name, CLASSES[cls], Math.floor(Date.now() / 1000));
    }
    const w = this.pickChannel(); if (!w) { s.kick('모든 채널이 가득 찼습니다. 잠시 후 다시 시도해주세요.'); return; }
    const p = w.addPlayer(m.token, prof, false);
    if (this.opts.bots > 0 && !this.botsAdded.has(w)) { this.botsAdded.add(w); addBots(w, this.opts.bots, prof.level, p.id, (this.opts.seed ^ Math.floor(this.now())) >>> 0); }
    else if (this.opts.bots > 0) for (const b of w.brains.values()) if (b.role === 'buddy' && !w.players.get(b.buddy)) b.buddy = p.id;
    s.welcome(w, p, this.opts.name);
    s.send({ t: 'wb', w: wbPublic(w, p) });
    w.announce(`${prof.name}님이 접속했습니다`, 'info');
  }
  private pickChannel(): World | null {
    let best: World | null = null;
    for (const w of this.worlds) { const n = w.humans(); if (n >= CHANNEL_CAP) continue; if (!best || n > best.humans()) best = w; }
    return best;
  }
  save(token: string, prof: Profile, p?: { x: number; y: number }): void {
    if (p) { prof.x = Math.round(p.x); prof.y = Math.round(p.y); }
    try { this.opts.store.save(token, prof); } catch (e) { console.error('save failed', e); }
  }

  tick(): void {
    for (const w of this.worlds) {
      w.step();
      for (const p of w.players.values()) if (!p.bot && p.saveT <= 0) { p.saveT = 60; this.save(p.token, p.prof, p); }
      if (w.tick % SNAP_EVERY !== 0) continue;
      const roster = w.rosterAdd.length || w.rosterDel.length ? { t: 'roster' as const, add: dedupe(w.rosterAdd), del: w.rosterDel.length ? w.rosterDel : undefined } : null;
      for (const s of this.sessions) {
        if (s.world !== w) continue;
        if (roster) s.send(roster);
        for (const b of w.broadcast) s.send(b);
        s.flush();
      }
      w.events.length = 0; w.broadcast.length = 0; w.rosterAdd = []; w.rosterDel = [];
      for (const p of w.players.values()) { p.priv.length = 0; p.dmgAcc.clear(); }
    }
  }
  saveAll(): void { for (const w of this.worlds) for (const p of w.players.values()) if (!p.bot) this.save(p.token, p.prof, p); }
  info() { return { name: this.opts.name, channels: this.worlds.map(w => ({ ch: w.opts.channel, humans: w.humans(), players: w.players.size, mons: w.mons.size, tickMs: +w.perf.tickMs.toFixed(2), maxMs: +w.perf.maxMs.toFixed(2) })) }; }
}
function dedupe<T extends { id: number }>(a: T[]): T[] { const m = new Map<number, T>(); for (const x of a) m.set(x.id, x); return [...m.values()]; }
function validProfile(p: Profile): boolean {
  try { return p.v === 1 && typeof p.name === 'string' && isClassId(p.cls) && p.level >= 1 && Array.isArray(p.inv) && Array.isArray(p.tals) && !!computeStats(p); } catch { return false; }
}
