// 간단한 자동 플레이어: 타이틀 화면 데모와 밸런스 테스트에 쓴다.
import { Game, NIP, radiusOf } from './game';
import { next, type Rng } from './rng';

/** 지금 들고 있는 고양이를 어디에 떨어뜨릴지 고른다 */
export function chooseX(g: Game, rng: Rng, skill = 1): number {
  const tier = g.current;
  const r = radiusOf(tier) * (g.liquify > 0 ? g.rules.liquifyShrink : 1);
  const W = g.rules.boxW, H = g.rules.boxH;
  const N = 29;
  let bestX = W / 2, best = -Infinity;
  for (let i = 0; i < N; i++) {
    const x = r + (W - 2 * r) * (i / (N - 1));
    // 떨어지면서 처음 닿는 고양이
    let hitY = H - r;
    let hit: (typeof g.world.bodies)[number] | null = null;
    for (const b of g.world.bodies) {
      const dx = Math.abs(b.x - x), rr = r + b.r;
      if (dx >= rr) continue;
      const y = b.y - Math.sqrt(rr * rr - dx * dx);
      if (y < hitY) { hitY = y; hit = b; }
    }
    let s = hitY * 0.6;
    if (hit) {
      if (tier === NIP) s += hit.tier <= 6 ? 180 + hit.tier * 70 : -100;
      else if (hit.tier === tier) s += 900 + hit.y * 0.4;
      else if (hit.tier >= 0 && hit.tier < tier) s -= (tier - hit.tier) * 45;
      else if (hit.tier === tier + 1) s += 60;
    }
    // 착지점 근처의 같은 고양이
    for (const b of g.world.bodies) {
      if (b.tier !== tier || b === hit) continue;
      const d = Math.hypot(b.x - x, b.y - hitY);
      if (d < (r + b.r) * 1.6) s += 160;
    }
    // 큰 고양이는 벽 쪽으로
    if (tier >= 4) s += Math.abs(x - W / 2) * 0.25;
    s += (next(rng) - 0.5) * 120 / Math.max(0.2, skill);
    if (s > best) { best = s; bestX = x; }
  }
  return bestX;
}

/** 봇이 필요하면 능력을 쓴다 (true = 사용함) */
export function maybeUsePower(g: Game): boolean {
  if (g.danger > 0.45) {
    if (g.canUse('liquify')) return g.startLiquify();
    if (g.canUse('shake')) return g.startShake();
    if (g.canUse('punch')) {
      let worst = g.world.bodies[0];
      for (const b of g.world.bodies) if (b.over > worst.over || (b.over === worst.over && b.y - b.r < worst.y - worst.r)) worst = b;
      if (worst) return g.punch(worst.id);
    }
  }
  return false;
}

/** 후보 위치마다 1초씩 실제로 굴려 보고 가장 좋은 곳을 고른다 (테스트용 강한 봇) */
export function chooseXSim(g: Game, rng: Rng, candidates = 13, horizon = 1.0): number {
  const tier = g.current;
  const r = radiusOf(tier);
  const W = g.rules.boxW;
  const snap = g.snapshot();
  let bestX = W / 2, best = -Infinity;
  for (let i = 0; i < candidates; i++) {
    const x = r + (W - 2 * r) * ((i + (next(rng) - 0.5) * 0.6) / (candidates - 1));
    const h = Game.restore(snap);
    h.cooldown = 0;
    h.aim(x);
    h.drop();
    const steps = Math.round(horizon * 60);
    for (let k = 0; k < steps && !h.over; k++) h.update(1 / 60);
    let s = (h.score - g.score) * 1.5;
    if (h.over) s -= 1e6;
    s -= h.danger * 4000;
    // 높이 쌓일수록 감점, 큰 고양이가 아래에 있을수록 가점
    s += h.topY * 6;
    for (const b of h.world.bodies) {
      if (b.tier < 0) continue;
      s += (b.y / h.rules.boxH) * b.tier * 12;
      for (const c of h.world.bodies) {
        if (c.id <= b.id || c.tier !== b.tier) continue;
        if (Math.hypot(c.x - b.x, c.y - b.y) < (b.r + c.r) * 1.25) s += 25 + b.tier * 10;
      }
    }
    s -= h.world.bodies.length * 8;
    if (s > best) { best = s; bestX = x; }
  }
  return bestX;
}
