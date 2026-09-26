// Class benchmark: every class at the same level and gear, in three fixed scenarios.  node scripts/classbench.ts [seconds=60]
//   pack   — 12 monsters keep coming (killed ones respawn), monsters deal no damage: area clear speed (includes one ultimate)
//   single — one indestructible dummy: single-target damage per second (includes one ultimate)
//   tank   — 10 monsters that do hit back, no regeneration outside town: seconds until the character goes down (cap = run length)
import { writeFileSync } from 'node:fs';
import { World } from '../src/server/world.ts';
import { makeBotProfile } from '../src/server/bots.ts';
import { CLASSES, CLASS_IDS } from '../src/shared/data/classes.ts';
import { MON_IDX } from '../src/shared/data/monsters.ts';
import { generateMap, SOLID } from '../src/shared/map.ts';
import { doAction } from '../src/server/actions.ts';
import type { ClassId } from '../src/shared/types.ts';
import type { Monster } from '../src/server/entities.ts';

const SECS = Number(process.argv[2] ?? 60); const map = generateMap(20260925);
// melee chasers only: the bench character stands still, so kiting monsters would only measure range
const LEVELS: [number, number, keyof typeof MON_IDX][] = [[8, 1, 'imp'], [16, 2, 'toad'], [24, 4, 'foxfire']];

/** The centre of the largest open square in `zone` (the fight needs room to move). */
function arena(zone: number): [number, number] {
  for (let R = 7; R >= 3; R--) for (let ty = 8; ty < map.h - 8; ty++) for (let tx = 8; tx < map.w - 8; tx++) {
    let ok = true; for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R && ok; dx++) { const i = (ty + dy) * map.w + tx + dx; if (map.zones[i] !== zone || SOLID[map.tiles[i]]) ok = false; }
    if (ok) return [tx * 32 + 16, ty * 32 + 16];
  }
  throw new Error('no arena in zone ' + zone);
}
function run(cls: ClassId, lv: number, zone: number, mon: number, mode: 'pack' | 'single' | 'tank'): number {
  const w = new World({ seed: 7, channel: 1, name: 'bench', online: false, wbInterval: 1e9, wbFirst: 1e9, map });
  const at = arena(zone); w.lairs.forEach(l => { l.mon = 1; l.respawnT = 1e9; });
  const prof = makeBotProfile('bench', cls, lv, 11); prof.tals = []; prof.slots = [null, null, null, null]; // talismans are free picks for every class: measure the class kit alone
  const p = w.addPlayer('bench', prof, true); p.x = at[0]; p.y = at[1]; p.zone = zone; p.safeT = 0; w.recompute(p); p.hp = p.stats.maxHp;
  const spawn = (a: number, r: number): Monster => { const m = w.spawnMonster(mon, at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, lv)!; m.lairIdx = -2; return m; };
  let mons: Monster[] = []; let dealt = 0;
  if (mode === 'single') { const m = spawn(0, 60); m.maxHp = m.hp = 1e9; m.dmg = 0; mons = [m]; }
  else for (let i = 0; i < (mode === 'pack' ? 12 : 10); i++) { const m = spawn((i / 12) * 6.283, 90 + (i % 3) * 40); if (mode === 'pack') m.dmg = 0; mons.push(m); }
  p.ult = 100; let usedUlt = false;
  for (let t = 0; t < SECS * 20; t++) {
    for (const m of w.mons.values()) { if (m.lairIdx !== -2) { w.mons.delete(m.id); continue; } m.farT = 0; } // only the bench's own monsters
    if (mode === 'single') { mons[0].x = at[0] + 50; mons[0].y = at[1]; }
    p.surgeT = 1e9;
    const before = mons.reduce((s, m) => s + Math.max(0, m.hp), 0);
    w.step();
    if (!usedUlt && t > 20 && p.ult >= 100 && doAction(w, p, { t: 'ult' }) == null) usedUlt = true;
    if (mode === 'tank' && p.down) return t / 20;
    dealt += before - mons.reduce((s, m) => s + Math.max(0, m.hp), 0);
    if (mode !== 'single') mons = mons.map((m, i) => { if (!m.dead && w.mons.has(m.id)) return m; const n = spawn((i / 12) * 6.283 + t, 200); if (mode === 'pack') n.dmg = 0; return n; });
  }
  return mode === 'tank' ? SECS : dealt / SECS;
}
const rows: string[] = []; const t0 = Date.now();
for (const [lv, zone, key] of LEVELS) {
  const res = CLASS_IDS.map(c => ({ c, pack: run(c, lv, zone, MON_IDX[key], 'pack'), single: run(c, lv, zone, MON_IDX[key], 'single'), tank: run(c, lv, zone, MON_IDX[key], 'tank') }));
  const avgP = res.reduce((s, r) => s + r.pack, 0) / res.length, avgS = res.reduce((s, r) => s + r.single, 0) / res.length;
  for (const r of res) {
    rows.push(`| ${lv} | ${CLASSES[r.c].name} | ${Math.round(r.pack)} (${Math.round((r.pack / avgP) * 100)}%) | ${Math.round(r.single)} (${Math.round((r.single / avgS) * 100)}%) | ${r.tank >= SECS ? `${SECS}+` : r.tank.toFixed(1)} |`);
    console.log(lv, r.c.padEnd(9), 'pack', Math.round(r.pack), 'single', Math.round(r.single), 'tank', r.tank);
  }
}
const md = `# 직업 벤치마크\n\n생성: ${new Date().toISOString().slice(0, 16)} · \`node scripts/classbench.ts ${SECS}\` · ${Math.round((Date.now() - t0) / 1000)}초\n\n` +
  `같은 레벨·같은 장비(AI 동료와 같은 규칙으로 생성)로 세 가지 고정 상황을 ${SECS}초씩 돌린 결과입니다. 괄호는 같은 레벨 10개 직업 평균 대비 비율입니다. 필살기 1회 포함, **부적 없음**(부적은 모든 직업이 자유롭게 고르므로 직업 고유 성능만 비교).\n\n` +
  `- **무리 사냥**: 몬스터 12마리가 계속 다시 나타남(반격 없음) → 초당 피해\n- **단일 대상**: 죽지 않는 허수아비 1마리 → 초당 피해\n- **버티기**: 반격하는 몬스터 10마리에 둘러싸였을 때 쓰러지기까지 걸린 시간\n\n` +
  `| 레벨 | 직업 | 무리 사냥 DPS | 단일 대상 DPS | 버티기(초) |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
writeFileSync('docs/class-bench.md', md); console.log('docs/class-bench.md written');
