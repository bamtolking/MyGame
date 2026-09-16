/** Stress test: N units per side already on the field, measure ms per simulation tick. */
import { Match } from '../src/core/sim/match.ts';
import { unitDef, FACTIONS } from '../src/core/data/units.ts';
import { MAP } from '../src/core/data/balance.ts';

function stress(total: number, seconds = 20) {
  const m = Match.create({ mode: '3v3', seed: 42, setupSeconds: 0, players: Array.from({ length: 6 }, (_, i) => ({ faction: (i % 2 ? 'gale' : 'iron') as 'iron' | 'gale', isHuman: false, ai: 'script' as const })) });
  m.s.phase = 'battle';
  const per = total / 2;
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < per; i++) {
      const p = m.s.players[team * 3 + (i % 3)];
      const units = FACTIONS[p.faction].units;
      const def = unitDef(units[i % units.length]);
      const x = team === 0 ? 700 + (i % 20) * 22 : MAP.W - 700 - (i % 20) * 22;
      const y = 120 + Math.floor(i / 20) * 40 + (i % 3) * 10;
      m.spawnUnit(p, def, x, y, 0);
    }
  }
  for (const p of m.s.players) p.interval = 9999;
  const ticks = seconds * 20;
  let worst = 0, sum = 0, peakUnits = 0;
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    m.step();
    const dt = performance.now() - t0;
    sum += dt; if (dt > worst) worst = dt; if (m.s.units.length > peakUnits) peakUnits = m.s.units.length;
  }
  console.log(`units=${total} (peak ${peakUnits}) ticks=${ticks} avg=${(sum / ticks).toFixed(3)}ms worst=${worst.toFixed(2)}ms alive=${m.s.units.length} projectiles=${m.s.projectiles.length}`);
}
stress(300); stress(600); stress(900);
