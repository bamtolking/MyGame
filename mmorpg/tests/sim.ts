// Headless play-through used by the balance sweep: one "human" (driven by the companion AI) + the offline AI party.
import { GameServer } from '../src/server/server.ts';
import { BotBrain } from '../src/server/bots.ts';
import { MAIN_QUESTS } from '../src/shared/data/quests.ts';
import { MemStore, FakeConn } from './helpers.ts';
import { newProfile } from '../src/shared/data/items.ts';
import { CLASSES } from '../src/shared/data/classes.ts';
import type { ClassId } from '../src/shared/types.ts';
import type { World } from '../src/server/world.ts';

export interface SimResult {
  cls: ClassId; seed: number; minutes: number; levelAt: Record<number, number>; finalLevel: number; kills: number; deaths: number;
  deathsBy: [string, number][]; questAt: Record<number, number>; firstBossMin: number | null; wbTries: number; wbWins: number; gold: number; power: number;
  items: number; legend: number; tickMs: number; bytesPerSec: number; botDeaths: number;
}
export function simulate(cls: ClassId, seed: number, minutes: number): SimResult {
  let W: World | null = null; const store = new MemStore();
  const gs = new GameServer({ seed: 20260925, channels: 1, name: 'sim', online: false, bots: 6, wbInterval: 420, wbFirst: 210, store, now: () => (W ? W.time : 0) + 1000 });
  W = gs.worlds[0]; const w = W; w.rng.s = seed >>> 0;
  const conn = new FakeConn(); let bytes = 0; conn.send = (d: string | Uint8Array) => { bytes += d.length; if (typeof d === 'string' && d.includes('"t":"wb"')) { const m = JSON.parse(d); if (m.w.state === 'fight' && !fighting) { fighting = true; wbTries++; } if (m.w.state === 'idle' && fighting) { fighting = false; } } if (typeof d === 'string' && d.includes('토벌 성공')) wbWins++; };
  let fighting = false, wbTries = 0, wbWins = 0;
  // pre-made profile: new characters may only pick a starter class, but the sweep plays every class from level 1
  const token = 'tok_balance_' + seed + 'aaaaaaaa'; store.save(token, newProfile('밸런스', CLASSES[cls], 0));
  const s = gs.connect(conn); gs.message(s, JSON.stringify({ t: 'hello', v: 1, token, name: '밸런스', cls }));
  const p = s.player!; w.brains.set(p.id, new BotBrain('quester', seed)); p.prof.opts = { autoSell: 0 };
  const levelAt: Record<number, number> = {}, questAt: Record<number, number> = {}; let firstBossMin: number | null = null;
  const bossQuest = MAIN_QUESTS.findIndex(q => q.kind === 'boss');
  for (let t = 1; t <= minutes * 60 * 20; t++) {
    gs.tick();
    if (t % 1200 === 0) { const min = t / 1200; if (min % 5 === 0) { levelAt[min] = p.prof.level; questAt[min] = p.prof.quest.main; } }
    if (firstBossMin == null && p.prof.quest.main > bossQuest) firstBossMin = Math.round(t / 1200 * 10) / 10;
  }
  const by = new Map<string, number>(); for (const d of w.deathLog) if (!d.bot) by.set(d.by || '?', (by.get(d.by || '?') ?? 0) + 1);
  return {
    cls, seed, minutes, levelAt, finalLevel: p.prof.level, kills: p.prof.stats.kills, deaths: p.prof.stats.deaths, deathsBy: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    questAt, firstBossMin, wbTries, wbWins, gold: p.prof.stats.goldEarned, power: p.stats.power, items: Object.values(p.prof.equip).filter(Boolean).length,
    legend: p.prof.stats.legendaries, tickMs: +w.perf.tickMs.toFixed(3), bytesPerSec: Math.round(bytes / (minutes * 60)), botDeaths: w.deathLog.filter(d => d.bot).length,
  };
}
