// 헤드리스 자동 플레이 봇: 판 상태 API만 사용해 정리→전투→보상을 끝까지 돌린다 (밸런스 측정용).
import { createRun, placeItem, startBattle, applyBattleResult, pickReward, heal, chooseUnlock, mergePartners, mergeItems, bagItems, benchItems, lockedCells, loadoutOf, canHeal, type RunState } from '../../src/packblast/core/run';
import { checkPlacement, type Item } from '../../src/packblast/core/bag';
import { computeLoadout } from '../../src/packblast/core/loadout';
import { candidateFlags } from '../../src/packblast/core/rewards';
import { BattleSim } from '../../src/packblast/combat/sim';
import { EQUIPMENT } from '../../src/packblast/data/equipment';
import type { Difficulty } from '../../src/packblast/data/balance';
import type { Rot } from '../../src/packblast/core/shapes';

export interface StageLog { stage: number; kind: string; won: boolean; duration: number; hpBefore: number; hpAfter: number; weapons: string; damage: Record<string, number>; overheat: number; extra: number; chains: number; shockwave: boolean; enraged: boolean }
export interface BotResult { seed: number; difficulty: Difficulty; reachedStage: number; won: boolean; stages: StageLog[]; totalBattleTime: number; finalBag: string[] }

function scorePlacement(s: RunState, it: Item, x: number, y: number, rot: Rot): number {
  const trial = s.items.map(i => (i.uid === it.uid ? { ...i, x, y, rot, loc: 'bag' as const } : i));
  const lo = computeLoadout(trial, s.grid);
  let score = 0;
  for (const w of lo.weapons) for (const l of w.links) if (l.applied && (w.uid === it.uid || l.supportUid === it.uid)) score += 3 * l.grade;
  // 지원끼리 겹치지 않게, 위쪽부터 촘촘히
  score -= (x + y) * 0.01;
  return score;
}

function bestPlacement(s: RunState, it: Item): { x: number; y: number; rot: Rot; score: number } | null {
  let best: { x: number; y: number; rot: Rot; score: number } | null = null;
  for (const rot of [0, 1, 2, 3] as Rot[]) for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    if (!checkPlacement(s.grid, s.items, it.id, rot, x, y, it.uid).ok) continue;
    const sc = scorePlacement(s, it, x, y, rot);
    if (!best || sc > best.score) best = { x, y, rot, score: sc };
  }
  return best;
}

export function botPrep(s: RunState): void {
  // 1) 합성
  let merged = true;
  while (merged) {
    merged = false;
    for (const it of [...s.items]) {
      const ps = mergePartners(s, it.uid); if (!ps.length) continue;
      const keep = it.loc === 'bag' ? it : ps.find(p => p.loc === 'bag') ?? it;
      const consume = keep === it ? ps[0] : it;
      if (mergeItems(s, keep.uid, consume.uid).ok) { merged = true; break; }
    }
  }
  // 2) 배치 (무기 → 지원 → 생존)
  const order = (i: Item) => (EQUIPMENT[i.id].kind === 'weapon' ? 0 : EQUIPMENT[i.id].kind === 'support' ? 1 : 2);
  for (const it of benchItems(s).sort((a, b) => order(a) - order(b) || b.grade - a.grade)) {
    const p = bestPlacement(s, it);
    if (p) placeItem(s, it.uid, p.x, p.y, p.rot);
  }
  // 3) 지원 장비 재배치 시도(더 좋은 자리로)
  for (const it of bagItems(s).filter(i => EQUIPMENT[i.id].kind === 'support')) {
    const cur = scorePlacement(s, it, it.x, it.y, it.rot);
    const p = bestPlacement(s, it);
    if (p && p.score > cur + 0.5) placeItem(s, it.uid, p.x, p.y, p.rot);
  }
  // 4) 회복
  if (s.hp < s.maxHp * 0.55 && canHeal(s).ok) heal(s);
}

export function botPickReward(s: RunState): number {
  if (!s.reward) return 0;
  let best = 0, bestScore = -Infinity;
  s.reward.candidates.forEach((c, i) => {
    const f = candidateFlags(c, s.items);
    const def = EQUIPMENT[c.id];
    let sc = c.grade;
    if (f.mergeable) sc += 3;
    if (def.kind === 'support') sc += f.hasTarget ? 2.5 : -2;
    if (def.kind === 'weapon') sc += 1.5 + (f.hasTarget ? 1 : 0);
    if (def.kind === 'survival') sc += s.hp < s.maxHp * 0.6 ? 2 : 0.5;
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  return best;
}

export function botBattle(s: RunState, lo = loadoutOf(s)): { sim: BattleSim } {
  const sim = new BattleSim({ loadout: lo, stage: s.battle!.stage, difficulty: s.difficulty, seed: s.battle!.seed, hp: s.hp });
  let crushWarn = false;
  while (!sim.over && sim.time < 400) {
    sim.step();
    for (const ev of sim.drainEvents()) if (ev.type === 'crush_warn') crushWarn = true;
    if (!sim.shockwaveUsed) {
      const near = sim.enemies.filter(e => Math.hypot(e.x - sim.player.x, e.y - sim.player.y) < 60);
      const bomber = near.some(e => e.type === 'bomber' && e.fuse >= 0);
      if (crushWarn || bomber || (near.length >= 3 && sim.hp < 60) || sim.hp < 25) sim.useShockwave();
    }
  }
  return { sim };
}

export function playRun(seed: number, difficulty: Difficulty): BotResult {
  const s = createRun(seed, difficulty, false);
  const stages: StageLog[] = [];
  let guard = 0;
  while (s.phase !== 'result' && guard++ < 100) {
    if (s.phase === 'prep') {
      botPrep(s);
      const r = startBattle(s, true);
      if (!r.ok) { // 무기를 못 놓는 경우: 아무 무기나 빈 자리에
        const w = benchItems(s).find(i => EQUIPMENT[i.id].weapon); if (w) { const p = bestPlacement(s, w); if (p) placeItem(s, w.uid, p.x, p.y, p.rot); }
        const r2 = startBattle(s, true); if (!r2.ok) break;
      }
      const hpBefore = s.hp;
      const lo = loadoutOf(s);
      const { sim } = botBattle(s, lo);
      const res = sim.result();
      applyBattleResult(s, res);
      const dmg: Record<string, number> = {};
      for (const w of Object.values(res.stats.weapons)) dmg[`${w.id}${w.grade}`] = Math.round(w.damage);
      stages.push({ stage: sim.stageNo, kind: sim.stage.kind, won: res.won, duration: Math.round(res.stats.duration * 10) / 10, hpBefore, hpAfter: s.hp, weapons: lo.weapons.map(w => `${w.id}${w.grade}${w.links.filter(l => l.applied).length ? '+' + w.links.filter(l => l.applied).map(l => l.supportId[0]).join('') : ''}`).join(' '), damage: dmg, overheat: Math.round(Object.values(res.stats.weapons).reduce((a, w) => a + w.overheatTime, 0) * 10) / 10, extra: Object.values(res.stats.weapons).reduce((a, w) => a + w.extraShots, 0), chains: Object.values(res.stats.weapons).reduce((a, w) => a + w.chains, 0), shockwave: res.stats.shockwaveUsed, enraged: res.stats.enraged });
      s.summarySeen = true;
    } else if (s.phase === 'unlock') {
      chooseUnlock(s, lockedCells(s).slice(0, s.pendingUnlock));
    } else if (s.phase === 'reward') {
      pickReward(s, botPickReward(s));
    } else break;
  }
  return { seed, difficulty, reachedStage: stages.length ? stages[stages.length - 1].stage : 0, won: !!s.result?.won, stages, totalBattleTime: Math.round(stages.reduce((a, x) => a + x.duration, 0)), finalBag: bagItems(s).map(i => `${i.id}${i.grade}`) };
}
