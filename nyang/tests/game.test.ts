import { describe, it, expect } from 'vitest';
import { Game, NIP, radiusOf } from '../src/sim/game';
import { CATS, MAX_TIER, mergePoints, ASCEND_BONUS } from '../src/data/cats';
import { makeBody } from '../src/sim/physics';
import { makeRng } from '../src/sim/rng';
import { chooseX } from '../src/sim/bot';
import { dailyInfo } from '../src/sim/daily';

const DT = 1 / 60;
const run = (g: Game, sec: number) => { const ev: any[] = []; for (let i = 0; i < Math.round(sec / DT); i++) { g.update(DT); ev.push(...g.events); } return ev; };

function place(g: Game, tier: number, x: number, y: number) {
  const b = makeBody(g.nextId++, tier, x, y, radiusOf(tier), g.time);
  g.world.add(b);
  return b;
}

describe('game rules', () => {
  it('two same cats merge into the next tier at their midpoint, with points', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    place(g, 3, 150, 400); place(g, 3, 200, 400);
    const ev = run(g, 1);
    const m = ev.find(e => e.t === 'merge');
    expect(m).toBeTruthy();
    expect(m.tier).toBe(4);
    expect(m.points).toBe(mergePoints(3));
    expect(g.world.bodies.length).toBe(1);
    expect(g.world.bodies[0].tier).toBe(4);
    expect(g.score).toBe(mergePoints(3));
    expect(g.stats.maxTier).toBe(4);
  });

  it('different cats do not merge', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    place(g, 2, 150, 400); place(g, 3, 210, 400);
    run(g, 1);
    expect(g.world.bodies.length).toBe(2);
    expect(g.score).toBe(0);
  });

  it('three touching same cats make exactly one merge (no double use)', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    place(g, 1, 100, 450); place(g, 1, 132, 450); place(g, 1, 164, 450);
    const ev = run(g, 0.05);
    expect(ev.filter(e => e.t === 'merge').length).toBe(1);
    const tiers = g.world.bodies.map(b => b.tier).sort();
    expect(tiers).toEqual([1, 2]);
  });

  it('chain merges build a combo with a score multiplier', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    // 1+1 → 2, 그 2가 옆의 2와 → 3
    place(g, 2, 180, 448); place(g, 1, 163, 392); place(g, 1, 195, 392);
    const ev = run(g, 2);
    const merges = ev.filter(e => e.t === 'merge');
    expect(merges.length).toBe(2);
    expect(merges[1].combo).toBe(2);
    expect(g.score).toBe(mergePoints(1) + Math.round(mergePoints(2) * (1 + g.rules.comboBonus)));
    expect(g.stats.maxCombo).toBe(2);
  });

  it('two cosmic chonks ascend: both vanish with a bonus', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    place(g, MAX_TIER, 95, 380); place(g, MAX_TIER, 262, 380);
    const ev = run(g, 1.5);
    const a = ev.find(e => e.t === 'ascend');
    expect(a).toBeTruthy();
    expect(a.points).toBe(mergePoints(MAX_TIER) + ASCEND_BONUS);
    expect(g.world.bodies.length).toBe(0);
  });

  it('a catnip ball upgrades the first cat it touches', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    const cat = place(g, 5, 180, 430);
    place(g, NIP, 180, 300);
    const ev = run(g, 1);
    expect(ev.some(e => e.t === 'nip' && e.tier === 6)).toBe(true);
    expect(cat.tier).toBe(6);
    expect(g.world.bodies.length).toBe(1);
    run(g, 1);
    expect(cat.r).toBeCloseTo(CATS[6].r, 3);
  });

  it('dropping follows the queue and respects the cooldown', () => {
    const g = new Game({ mode: 'classic', seed: 42 });
    const first = g.current, second = g.nextTier;
    g.aim(100);
    expect(g.drop()).toBe(true);
    expect(g.drop()).toBe(false);
    expect(g.current).toBe(second);
    expect(g.world.bodies[0].tier).toBe(first);
    run(g, g.rules.dropCooldown + 0.05);
    expect(g.drop()).toBe(true);
  });

  it('aim is clamped inside the box for the held cat', () => {
    const g = new Game({ mode: 'classic', seed: 42 });
    g.aim(-500);
    expect(g.holdX).toBe(radiusOf(g.current));
    g.aim(5000);
    expect(g.holdX).toBe(g.rules.boxW - radiusOf(g.current));
  });

  it('spawn order depends only on the seed, not on play', () => {
    const seq = (seed: number, playStyle: number) => {
      const g = new Game({ mode: 'daily', seed });
      const out: number[] = [];
      for (let i = 0; i < 60; i++) {
        out.push(g.current);
        g.aim(playStyle === 0 ? 30 : 330 - (i % 5) * 60);
        g.drop();
        run(g, g.rules.dropCooldown + 0.02);
        if (g.over) g.revive();
      }
      return out;
    };
    expect(seq(99, 0)).toEqual(seq(99, 1));
    expect(seq(99, 0)).not.toEqual(seq(100, 0));
  });

  it('catnip balls appear in the queue on schedule', () => {
    const g = new Game({ mode: 'classic', seed: 5 });
    const seen: number[] = [];
    for (let i = 0; i < 80; i++) { seen.push(g.current); g.drop(); g.cooldown = 0; g.world.bodies.length = 0; }
    const nips = seen.filter(t => t === NIP).length;
    expect(nips).toBeGreaterThanOrEqual(2);
    expect(nips).toBeLessThanOrEqual(4);
    expect(seen.slice(0, 4).every(t => t >= 0 && t <= 2)).toBe(true);
    expect(seen.every(t => t === NIP || (t >= 0 && t <= 4))).toBe(true);
  });

  it('a cat stuck above the rim ends the game after the grace + overflow time', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    // 상자를 큰 고양이로 채운 뒤 위에 하나 더
    const H = g.rules.boxH;
    let y = H;
    for (let row = 0; y > 0; row++) {
      const r = CATS[8].r;
      y = H - r - row * 2 * r;
      place(g, row % 2 ? 7 : 8, 90, y);
      place(g, row % 2 ? 8 : 7, 270, y);
    }
    let ev: any[] = [];
    for (let i = 0; i < 60 * 6 && !g.over; i++) { g.update(DT); ev.push(...g.events); }
    expect(g.over).toBe(true);
    expect(ev.some(e => e.t === 'over')).toBe(true);
    expect(g.time).toBeGreaterThan(g.rules.overflowGrace + g.rules.overflowTime - 0.1);
    // 집사 찬스는 한 번만
    expect(g.revive()).toBe(true);
    expect(g.over).toBe(false);
    expect(g.world.bodies.every(b => b.y - b.r >= H * 0.4 - 1)).toBe(true);
    g.over = true;
    expect(g.revive()).toBe(false);
  });

  it('powers consume charges and do their job', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    const a = place(g, 4, 100, 400);
    place(g, 4, 300, 400);
    run(g, 1);
    expect(g.punch(a.id)).toBe(true);
    expect(g.charges.punch).toBe(0);
    expect(g.world.bodies.length).toBe(1);
    expect(g.punch(g.world.bodies[0].id)).toBe(false);

    const h = new Game({ mode: 'classic', seed: 1 });
    place(h, 4, 90, 430); place(h, 4, 270, 430);
    run(h, 1);
    expect(h.world.bodies.length).toBe(2);
    expect(h.startLiquify()).toBe(true);
    expect(h.startLiquify()).toBe(false);
    run(h, h.rules.liquifyTime + 1);
    // 액체화 인력으로 멀리 떨어진 같은 고양이가 모여 합체
    expect(h.world.bodies.length).toBe(1);
    expect(h.world.bodies[0].tier).toBe(5);
    expect(h.world.p.friction).toBe(h.rules.friction);
    expect(h.world.bodies[0].rt).toBe(CATS[5].r);

    const s = new Game({ mode: 'classic', seed: 1 });
    const c = place(s, 3, 180, 440);
    run(s, 0.5);
    expect(s.startShake()).toBe(true);
    let maxUp = 0;
    for (let i = 0; i < 40; i++) { s.update(DT); maxUp = Math.max(maxUp, 440 - c.y); }
    expect(maxUp).toBeGreaterThan(5);
  });

  it('shaking or liquifying a half-full box never ends the game by itself', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = new Game({ mode: 'classic', seed });
      const rng = makeRng(seed);
      for (let i = 0; i < 18; i++) { g.aim(chooseX(g, rng)); g.cooldown = 0; g.drop(); run(g, 0.4); }
      if (g.over) continue;
      g.charges.shake = 3; g.charges.liquify = 3;
      g.startShake();
      run(g, 3);
      expect(g.over).toBe(false);
      g.startLiquify();
      run(g, g.rules.liquifyTime + 3);
      expect(g.over).toBe(false);
    }
  });

  it('liquify never launches a squeezed cat out of the box (regression)', () => {
    const xs = [60, 300, 180, 110, 250, 40, 320, 150, 210, 90, 270, 180, 130, 230];
    for (let seed = 1; seed <= 80; seed++) {
      const g = new Game({ mode: 'classic', seed: seed * 7919 });
      for (const x of xs) { g.aim(x); g.drop(); run(g, 0.56); }
      g.startLiquify();
      let minTop = Infinity;
      for (let i = 0; i < 60 * 5.5; i++) { g.update(DT); for (const b of g.world.bodies) minTop = Math.min(minTop, b.y - b.r); }
      expect(g.over).toBe(false);
      expect(minTop).toBeGreaterThan(-260);
    }
  });

  it('cats never fly far above the box during normal play', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const g = new Game({ mode: 'classic', seed });
      const rng = makeRng(seed);
      let minTop = Infinity;
      for (let i = 0; i < 120 && !g.over; i++) {
        g.aim(chooseX(g, rng)); g.drop();
        for (let k = 0; k < 40; k++) { g.update(DT); for (const b of g.world.bodies) if (g.time - b.born > 0.8) minTop = Math.min(minTop, b.y - b.r); }
      }
      expect(minTop).toBeGreaterThan(-300);
    }
  });

  it('the churu gauge grants charges', () => {
    const g = new Game({ mode: 'classic', seed: 1 });
    const before = g.charges.punch + g.charges.liquify + g.charges.shake;
    place(g, 8, 90, 380); place(g, 8, 262, 380);
    place(g, 7, 180, 200);
    // 한 번에 큰 점수: 8+8 → 9 (450점) 반복 대신 게이지 직접 확인
    (g as any).addGauge(g.gaugeNeed + 1);
    expect(g.charges.punch + g.charges.liquify + g.charges.shake).toBe(before + 1);
  });

  it('snapshot → restore gives an identical game going forward', () => {
    const g = new Game({ mode: 'classic', seed: 77 });
    const rng = makeRng(1);
    for (let i = 0; i < 25; i++) { g.aim(chooseX(g, rng)); g.drop(); run(g, 0.5); }
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const h = Game.restore(snap);
    const r1 = makeRng(9), r2 = makeRng(9);
    for (let i = 0; i < 15; i++) {
      g.aim(chooseX(g, r1)); g.drop(); run(g, 0.5);
      h.aim(chooseX(h, r2)); h.drop(); run(h, 0.5);
    }
    expect(h.score).toBe(g.score);
    expect(h.world.bodies.map(b => [b.id, b.tier, b.x.toFixed(6), b.y.toFixed(6)])).toEqual(g.world.bodies.map(b => [b.id, b.tier, b.x.toFixed(6), b.y.toFixed(6)]));
  });

  it('restore rejects broken data', () => {
    expect(() => Game.restore({ v: 2 } as any)).toThrow();
    const g = new Game({ mode: 'classic', seed: 1 });
    place(g, 1, 100, 100);
    const s = g.snapshot();
    s.bodies[0][2] = NaN;
    expect(() => Game.restore(s)).toThrow();
  });

  it('daily info is stable per date and picks a modifier', () => {
    const a = dailyInfo(new Date(2026, 8, 25));
    const b = dailyInfo(new Date(2026, 8, 25, 23, 59));
    const c = dailyInfo(new Date(2026, 8, 26));
    expect(a).toEqual(b);
    expect(a.key).toBe('2026-09-25');
    expect(a.seed).not.toBe(c.seed);
    expect(a.no).toBeGreaterThan(0);
    const mods = new Set<string>();
    for (let d = 1; d <= 60; d++) mods.add(dailyInfo(new Date(2026, 9, d)).mod.id);
    expect(mods.size).toBeGreaterThanOrEqual(6);
  });
});
