// 무기 DPS 회귀 테스트: 멈춘 표적(반지름 50, 110u 거리 — 근접형은 40u)에 한 무기만 40초 쏴서 단일 대상 DPS를 잰다.
// 기준(GDD §16.2): 시작 무기 Lv1 18~30, 단일형 Lv8 100~200, 진화는 Lv8보다 강해야 한다.
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { WEAPONS, WEAPON, ENEMY } from '../src/content';
import { createWorld } from '../src/sim/state';
import { spawnEnemy } from '../src/sim/enemies';
import { updateWeapons, updateBullets, updateBlasts, updateZones, updateBeams, updateRings, compact } from '../src/sim/weapons';
import { weaponStatsAt, maxLevelOf } from '../src/sim/stats';
import type { WeaponDef } from '../src/content/types';
import { makeConfig } from './bot';

function probe(def: WeaponDef, level: number, seconds = 40): number {
  // 근접형(오라·궤도·지뢰·고리)은 표적을 몸에 붙인다
  const near = ['aura', 'orbit', 'mine', 'nova'].includes(def.archetype);
  const X = near ? 40 : 110;
  const w = createWorld(makeConfig({ seed: 9 }));
  w.weapons.length = 0;
  w.weapons.push({ def, slot: 0, level, st: weaponStatsAt(def, level), cd: 0.1, burst: 0, burstT: 0, on: 0, angle: 0, drones: [], dmg: 0, kills: 0 });
  w.d.crit = 0;   // 치명타 제외(비교용)
  const base = ENEMY.get('bujang')!;
  const dummy = spawnEnemy(w, { ...base, id: 'dummy', abilities: [], speed: 0, armor: 0, shield: 0, radius: 50 }, X, 0, 1)!;
  dummy.hp = dummy.maxHp = 1e12;
  const steps = seconds * 60;
  for (let i = 0; i < steps; i++) {
    w.t += 1 / 60; w.step++;
    dummy.x = X; dummy.y = 0; dummy.vx = 0; dummy.vy = 0;
    for (let k = 0; k < 8; k++) if (dummy.hitCd[k] > 0) dummy.hitCd[k] -= 1 / 60;
    w.grid.clear(); w.grid.insert(dummy);
    updateWeapons(w); updateBullets(w); updateBlasts(w); updateZones(w); updateBeams(w); updateRings(w); compact(w);
    w.events.length = 0;
  }
  return (1e12 - dummy.hp) / seconds;
}

describe('무기 DPS', () => {
  it('단일 대상 DPS 표', () => {
    const rows: string[] = ['| 무기 | Lv1 | Lv8 | 진화 | 진화/Lv8 |', '|---|---|---|---|---|'];
    const res: Record<string, { l1: number; l8: number; evo: number }> = {};
    for (const d of WEAPONS.filter(x => !x.evolved)) {
      const l1 = probe(d, 1), l8 = probe(d, maxLevelOf(d));
      const e = d.evolvesTo ? WEAPON.get(d.evolvesTo)! : null;
      const evo = e ? probe(e, 1) : 0;
      res[d.id] = { l1, l8, evo };
      rows.push(`| ${d.icon} ${d.name} | ${l1.toFixed(0)} | ${l8.toFixed(0)} | ${e ? `${e.icon} ${evo.toFixed(0)}` : '-'} | ${e ? (evo / l8).toFixed(2) : '-'} |`);
    }
    writeFileSync(new URL('../docs/dps-results.md', import.meta.url), '# 무기 단일 대상 DPS (멈춘 표적, 치명타·스탯 보정 없음)\n\n`npx vitest run tests/dps.test.ts`로 재생성.\n\n' + rows.join('\n') + '\n');
    for (const [id, r] of Object.entries(res)) {
      expect(r.l1, `${id} Lv1`).toBeGreaterThan(5);
      expect(r.l8, `${id} Lv8 > Lv1`).toBeGreaterThan(r.l1);
      if (r.evo) expect(r.evo, `${id} 진화 > Lv8`).toBeGreaterThan(r.l8);
    }
  });
});
