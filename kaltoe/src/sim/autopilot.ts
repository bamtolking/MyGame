// 자동 조종: 헤드리스 밸런스 봇과 타이틀 화면 데모 플레이가 함께 쓴다.
import { WEAPONS, PASSIVE } from '../content';
import type { World } from './types';

/** 적·탄·위험 지대를 피하고 보석/상자로 향하는 이동 벡터 */
export function autoMove(w: World): [number, number] {
  const p = w.player;
  let ax = 0, ay = 0;
  w.grid.query(p.x, p.y, 170, e => {
    if (e.dead) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = Math.max(60, dx * dx + dy * dy);
    const k = (e.boss ? 4 : e.elite ? 2 : 1) * 900 / d2;
    ax += dx * k / Math.sqrt(d2); ay += dy * k / Math.sqrt(d2);
  });
  for (const b of w.ebullets) {
    const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
    if (d2 < 120 * 120) { ax += dx / Math.max(20, d2) * 60; ay += dy / Math.max(20, d2) * 60; }
  }
  for (const z of w.zones) if (z.hostile) {
    const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy);
    if (d < z.r + 40) { ax += dx / (d || 1) * 3; ay += dy / (d || 1) * 3; }
  }
  for (const b of w.blasts) if (b.hostile) {
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
    if (d < b.r + 30) { ax += dx / (d || 1) * 4; ay += dy / (d || 1) * 4; }
  }
  let best: { x: number; y: number } | null = null, bd = 260 * 260;
  for (const k of w.pickups) {
    if (k.dead) continue;
    const d2 = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
    const w8 = k.kind === 'chest' ? 0.2 : k.kind === 'xp' ? 1 : 0.6;
    if (d2 * w8 < bd) { bd = d2 * w8; best = k; }
  }
  if (best) {
    const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1;
    ax += dx / d * 0.8; ay += dy / d * 0.8;
  }
  ax += Math.cos(w.t * 0.35) * 0.35; ay += Math.sin(w.t * 0.35) * 0.35;
  const L = Math.hypot(ax, ay);
  return L > 0.01 ? [ax / L, ay / L] : [0, 0];
}

/**
 * 레벨업 선택 휴리스틱(“무난한 사람” 기준):
 * 시작 무기와 보유 무기를 우선 키우고, 무기는 4~5개까지, 진화 짝 패시브를 챙긴다.
 */
export function autoChoose(w: World, strategy: 'evolve' | 'greedy' | 'random' = 'evolve'): number {
  const cs = w.choices;
  if (strategy === 'random') return (w.step * 7919) % cs.length;
  let bestI = 0, bestS = -1e9;
  const nW = w.weapons.length;
  cs.forEach((c, i) => {
    let s = 0;
    if (c.kind === 'weapon') {
      s = 70 + (c.id === w.cfg.character.startWeapon ? 8 : 0) - c.level * 0.5;
    } else if (c.kind === 'newWeapon') {
      s = nW < 3 ? 76 : nW < 5 ? 55 : 30;
    } else if (c.kind === 'newPassive' || c.kind === 'passive') {
      const pl = PASSIVE.get(c.id)?.perLevel ?? {};
      const pairs = WEAPONS.some(x => x.evolveWith === c.id && w.weapons.some(o => o.def.id === x.id));
      s = 40;
      if (pairs && strategy === 'evolve') s += 30;
      if (pl.might) s += 18;
      if (pl.cooldown || pl.amount) s += 14;
      if (pl.area) s += 8;
      if (pl.maxHp || pl.armor || pl.recovery) s += 6;
      if (pl.curse) s -= 25;
      if (c.kind === 'passive') s += 4;
    }
    if (s > bestS) { bestS = s; bestI = i; }
  });
  return bestI;
}
