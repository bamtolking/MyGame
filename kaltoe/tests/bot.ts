// 헤드리스 봇: 시뮬레이션을 사람 없이 끝까지 돌려 밸런스/안정성을 확인한다.
import { CHARACTER, STAGE, WEAPONS, PASSIVES, LUNCHES, WEAPON } from '../src/content';
import type { ModifierDef, StatBlock } from '../src/content/types';
import { createWorld } from '../src/sim/state';
import { stepWorld, continueOvertime, endRun } from '../src/sim/step';
import { applyChoice, applyLunch, closeChest } from '../src/sim/levelup';
import { activateUlt, ultReady } from '../src/sim/ultimate';
import { autoChoose, autoMove } from '../src/sim/autopilot';
import type { RunConfig, World } from '../src/sim/types';

export interface BotOpts {
  stage?: string; char?: string; seed?: number; heat?: number; meta?: StatBlock; modifiers?: ModifierDef[];
  maxSeconds?: number; overtime?: boolean; strategy?: 'greedy' | 'evolve' | 'random'; allUnlocked?: boolean;
  idle?: boolean;  // 이동하지 않음(난이도 하한 확인)
  human?: boolean; // 사람 흉내: 반응 0.2초, 좁은 시야, 탄 회피 안 함, 흔들림
}

export interface BotResult {
  cleared: boolean; t: number; level: number; kills: number; coins: number; hp: number; maxHp: number;
  levelAt: Record<number, number>; killsAt: Record<number, number>; weapons: string[]; passives: string[];
  evolves: string[]; bossKills: string[]; killedBy: string | null; maxEnemies: number; chests: number;
  ultUses: number; dmgTaken: number; stepsMsAvg: number; firstEvolveAt: number | null;
}

export function makeConfig(o: BotOpts): RunConfig {
  const all = o.allUnlocked ?? true;
  return {
    stage: STAGE.get(o.stage ?? 'office')!,
    character: CHARACTER.get(o.char ?? 'kim')!,
    seed: o.seed ?? 1,
    heat: o.heat ?? 0,
    modifiers: o.modifiers ?? [],
    meta: o.meta ?? {},
    unlockedWeapons: new Set(WEAPONS.filter(w => all || !w.unlockedBy).map(w => w.id)),
    unlockedPassives: new Set(PASSIVES.filter(p => all || !p.unlockedBy).map(p => p.id)),
    unlockedLunches: new Set(LUNCHES.filter(l => all || !l.unlockedBy).map(l => l.id)),
    daily: false,
    overtimeAllowed: !!o.overtime,
  };
}

export function runBot(o: BotOpts = {}): BotResult {
  const w = createWorld(makeConfig(o));
  const max = o.maxSeconds ?? 900;
  const strategy = o.strategy ?? 'evolve';
  let maxEnemies = 0;
  let firstEvolveAt: number | null = null;
  let steps = 0;
  const t0 = performance.now();
  while (w.t < max) {
    if (w.phase === 'play') {
      if (!o.idle && !o.human && w.step % 3 === 0) { const [mx, my] = autoMove(w); w.player.mx = mx; w.player.my = my; }
      if (o.human && w.step % 12 === 0) {
        const [mx, my] = autoMove(w, { radius: 115, bullets: false });
        // 판단 흔들림: 사람 손가락은 정확하지 않다
        const j = Math.sin(w.step * 0.7919 + (o.seed ?? 1)) * 0.6;
        const c = Math.cos(j), s = Math.sin(j);
        w.player.mx = mx * c - my * s; w.player.my = mx * s + my * c;
      }
      if (o.idle) { w.player.mx = 0; w.player.my = 0; }
      if (ultReady(w)) activateUlt(w);
      stepWorld(w);
      steps++;
      if (w.enemies.length > maxEnemies) maxEnemies = w.enemies.length;
      if (firstEvolveAt === null && w.stats_.evolves.length) firstEvolveAt = w.t;
      w.events.length = 0;
    } else if (w.phase === 'levelup') applyChoice(w, autoChoose(w, strategy));
    else if (w.phase === 'chest') closeChest(w);
    else if (w.phase === 'lunch') applyLunch(w, w.lunchChoices[0].id);
    else if (w.phase === 'victory') { if (o.overtime) continueOvertime(w); else break; }
    else break;
  }
  const ms = performance.now() - t0;
  endRun(w);
  return {
    cleared: w.stats_.cleared, t: w.t, level: w.player.level, kills: w.stats_.kills, coins: Math.floor(w.stats_.coins),
    hp: Math.round(w.player.hp), maxHp: w.d.maxHp, levelAt: w.stats_.levelAt, killsAt: w.stats_.killsAt,
    weapons: w.weapons.map(x => `${x.def.id}:${x.level}`), passives: w.passives.map(x => `${x.def.id}:${x.level}`),
    evolves: w.stats_.evolves, bossKills: w.stats_.bossKills, killedBy: w.stats_.killedBy, maxEnemies,
    chests: w.stats_.chests, ultUses: w.stats_.ultUses, dmgTaken: Math.round(w.stats_.damageTaken),
    stepsMsAvg: steps ? ms / steps : 0, firstEvolveAt,
  };
}

export { WEAPON };
