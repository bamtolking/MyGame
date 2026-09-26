// Missions × casual bot (GDD §9.3, §13.4 "모든 템플릿·단계를 캐주얼 봇이 10판 안에"), plus the economy check (§9.6–9.7).
//
// Bot sets (10 fixed seeds each, casual = Autopilot jitter 9 / pad 2, 호떡이 + 반짝이 unless noted):
//   E  무한 달리기                     R  무한 달리기 + 이어달리기 파트너 (붕이)     D  오늘의 골목 (10 dates, day's runner/companion)
//   S  early 골목 지도 stages (the first ≤ 3 W1 stages, cycled)
//   intent bots — the same planner with a player's intent (what a person does when a quirky mission asks for it):
//   NP skip 꿀물 (and ? boxes: the 엿가락 자석 would pull honey in), no companion   NA never press jump in the air
//   NJ skip 별사탕 for the first 500 m (runs stop at 520 m)   FF fast-fall after jumps when the landing is clear
//   SB with 4 feast letters, skip honey and the 5th letter until 따끈함 < 20 % (aims for 왕보름달 잔치)
// Every template is checked at EVERY level: run scope = best single run of 10, total scope = sum of 10 runs.
// The `quick`, `stageLevels` and `quickStage` claims the assignment rules rely on are checked here too.
import { describe, it, expect, beforeAll } from 'vitest';
import { newRun, stepRun, charOf, type RunConfig } from '../src/sim/run';
import { Autopilot } from '../src/sim/autopilot';
import { solve, type Decision, type SolveOpts, type Box } from '../src/sim/validate';
import { rngNext, seedRng, type RngState } from '../src/sim/rng';
import { TILE, GROUND_Y, PICK_PAD } from '../src/data/physics';
import { COMPANION_BY_ID } from '../src/data/companions';
import { STAGES } from '../src/data/stages';
import { CHARACTERS } from '../src/data/characters';
import type { RunState, RunInput, PickupType } from '../src/sim/types';
import { MISSIONS, MISSION_BY_ID, applyRunToMissions, runTrace, starsAvailable, type MissionTemplate, type ActiveMission } from '../src/meta/missions';
import { defaultProgress, applyRun, dailySeed, dailyChar, dailyCompanion, featureOpen, nextStage, stageUnlocked, stageStarCount, reroll, totalStars, type Progress } from '../src/meta/progress';
import { shopList, buyCosmetic } from '../src/meta/achievements';
import { buyCharacter, buyCompanion } from '../src/meta/progress';

// ---------------------------------------------------------------- intent bot
interface Intent { avoid?: (s: RunState) => PickupType[]; singleJump?: boolean; fastFall?: boolean; budget?: number }
class IntentPilot {
  private rng: RngState; private target: number | null = null; private mustAt = -1; private slide = false; private holdLeft = 0;
  constructor(private jitter: number, private pad: number, seed: number, private intent: Intent, private look = 12 * TILE) { this.rng = seedRng((seed ^ 0x1e7) >>> 0); }
  next(s: RunState): RunInput {
    let jump = false;
    if (s.phase !== 'run') { this.target = null; this.mustAt = -1; return { jump: false, slide: false }; }
    if (this.holdLeft <= 0 && this.mustAt < 0) {
      const had = this.target !== null;
      const d = this.plan(s);
      this.slide = d.slide; this.holdLeft = 4;
      if (d.jump) this.mustAt = s.steps + this.late();
      else if (!had && this.target !== null) this.target += this.both();
    }
    if (this.mustAt >= 0 && s.steps >= this.mustAt) { jump = this.airOk(s); this.mustAt = -1; this.holdLeft = 0; this.target = null; }
    else if (this.target !== null && s.steps >= this.target) { if (this.airOk(s)) jump = true; this.holdLeft = 0; this.target = null; }
    this.holdLeft--;
    let slide = this.slide;
    if (this.intent.fastFall && !jump && !s.body.onGround && s.body.vy > -150 && s.bonusStage === 'none' && this.safeDrop(s)) slide = true;
    return { jump, slide, jumpHeld: jump || (s.bonusStage === 'sky' && (Math.floor(s.steps / 25) % 2 === 0 || s.body.y > 360)) };
  }
  private safeDrop(s: RunState): boolean {
    const b = s.body; const x1 = b.x + 5 * TILE;
    if (s.level.hazards.some(h => !h.broken && !h.passed && h.x1 > b.x - 20 && h.x0 < x1)) return false;
    return s.level.solids.some(o => o.ground && o.x0 <= b.x && o.x1 >= x1);
  }
  private airOk(s: RunState): boolean { return !this.intent.singleJump || s.body.onGround || s.body.coyote > 0; }
  private late(): number { return this.jitter <= 0 ? 0 : Math.floor(rngNext(this.rng) * (this.jitter + 1)); }
  private both(): number { return this.jitter <= 0 ? 0 : Math.round((rngNext(this.rng) * 2 - 1) * this.jitter); }
  private world(s: RunState, withAvoid: boolean) {
    const b = s.body; const x0 = b.x - 100, x1 = b.x + this.look + 260;
    const solids = s.level.solids.filter(o => o.x1 > x0 && o.x0 < x1);
    const powered = s.power.giant > 0 || s.power.dash > 0 || s.rescue > 0;
    const hazards: Box[] = s.iframes > 0.25 || powered ? [] : s.level.hazards.filter(h => !h.broken && !h.passed && !h.touched && h.x1 > x0 && h.x0 < x1);
    if (powered) solids.push({ x0, x1, top: GROUND_Y, ground: true });
    const av = withAvoid ? this.intent.avoid?.(s) ?? [] : [];
    if (av.length) {
      const e = s.companionId ? COMPANION_BY_ID[s.companionId]?.effect : null;
      const pp = PICK_PAD + (e && e.kind === 'pickPad' ? e.px : 0) + 6;
      for (const p of s.level.pickups) if (!p.taken && p.x > x0 && p.x < x1 && av.includes(p.type)) hazards.push({ x0: p.x - pp, x1: p.x + pp, y0: p.y - pp, y1: p.y + pp, kind: 'avoid' });
    }
    return { solids, hazards };
  }
  private plan(s: RunState): Decision {
    const b = s.body; const ch = charOf(s);
    if (s.bonusStage !== 'none') return { jump: false, slide: false };
    const base: SolveOpts = { pad: this.pad, caps: { maxJumps: this.intent.singleJump ? 1 : ch.maxJumps, glide: ch.glide }, budget: 40000 };
    const endX = b.x + this.look;
    let r = { ok: false, path: [] as Decision[], explored: 0 };
    for (const withAvoid of [true, false]) {
      const { solids, hazards } = this.world(s, withAvoid);
      const run = (o: SolveOpts) => solve(solids, hazards, b, s.speed, endX, { ...base, ...(withAvoid && this.intent.budget ? { budget: this.intent.budget } : {}), ...o });
      r = run({}); if (!r.ok) r = run({ endGrounded: false }); if (!r.ok) r = run({ endGrounded: false, pad: 0 });
      if (r.ok) break;
    }
    if (!r.ok || !r.path.length) return { jump: false, slide: false };
    const first = r.path[0]; const k = r.path.findIndex(d => d.jump);
    if (k === 0) { this.target = null; return first; }
    if (k > 0 && this.target === null) this.target = s.steps + Math.floor(k * 4 / 2);
    return { jump: false, slide: first.slide };
  }
}
const JITTER = 9;
function play(cfg: RunConfig, seed: number, intent: Intent | null = null, maxDist = Infinity): RunState {
  const s = newRun(cfg);
  const ap: { next(s: RunState): RunInput } = intent ? new IntentPilot(JITTER, 2, seed, intent) : new Autopilot({ jitter: JITTER, pad: 2, seed });
  while (s.phase !== 'over' && s.phase !== 'clear' && s.t < 900 && s.dist < maxDist) { stepRun(s, ap.next(s)); s.events.length = 0; }
  if (s.phase === 'run') s.phase = 'over';   // stopped early (NJ): the player quits here — booked like a finished run
  return s;
}

// ---------------------------------------------------------------- run sets
const SEEDS = [101, 7110, 5143, 3176, 1209, 9242, 7275, 5308, 3341, 1374];
const HONEY: PickupType[] = ['potion', 'bigPotion', 'miniPotion'];
type SetKey = 'E' | 'R' | 'D' | 'S' | 'NP' | 'NA' | 'NJ' | 'FF' | 'SB';
const earlyStages = () => STAGES.filter(s => s.world === 1 && !s.remix).slice(0, 3).map(s => s.id);
// one run of a set (i = 0..9); sets are generated lazily, run by run, and cached
const RUN: Record<SetKey, (sd: number, i: number) => RunState> = {
  E: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', companionId: 'firefly' }, sd),
  R: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', partnerId: 'bungeo', companionId: 'firefly' }, sd),
  D: (sd, i) => { const k = `2026-10-${String(i + 1).padStart(2, '0')}`; return play({ mode: 'daily', seed: dailySeed(k), charId: dailyChar(k), companionId: dailyCompanion(k) }, sd); },
  S: (sd, i) => { const ids = earlyStages(); return play({ mode: 'stage', seed: sd, charId: 'hotteok', companionId: 'firefly', stageId: ids[i % ids.length] }, sd); },
  NP: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', companionId: null }, sd, { avoid: () => [...HONEY, 'power'] }),
  NA: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', companionId: 'firefly' }, sd, { singleJump: true }),
  NJ: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', companionId: null }, sd, { avoid: () => ['jelly', 'big', 'power'], budget: 4000 }, 520),
  FF: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', companionId: 'firefly' }, sd, { fastFall: true }),
  SB: sd => play({ mode: 'endless', seed: sd, charId: 'hotteok', companionId: 'firefly' }, sd, { avoid: s => (s.letters.filter(Boolean).length === s.letters.length - 1 && s.hp >= s.maxHp * 0.2 ? ['letter', ...HONEY] : []) }),
};
const cache = new Map<SetKey, RunState[]>();
const timing: Record<string, number> = {};
function runOf(k: SetKey, i: number): RunState {
  let v = cache.get(k); if (!v) { v = []; cache.set(k, v); }
  while (v.length <= i) { const t0 = Date.now(); v.push(RUN[k](SEEDS[v.length], v.length)); timing[k] = (timing[k] ?? 0) + Date.now() - t0; }
  return v[i];
}
function set(k: SetKey): RunState[] { for (let i = 0; i < SEEDS.length; i++) runOf(k, i); return cache.get(k)!; }
/** Which runs a template × level is judged on (its requirement met, the player playing the way the mission asks). */
function setFor(t: MissionTemplate, level: number): SetKey {
  if (t.levelRequires?.[level] === 'relay' || t.requires === 'relay') return 'R';
  if (t.modes?.includes('daily')) return 'D';
  switch (t.id) {
    case 'no_potion': return 'NP';
    case 'no_air': return 'NA';
    case 'no_jelly': return 'NJ';
    case 'fastfall_run': return 'FF';
    case 'super_bonus': return 'SB';
  }
  return 'E';
}
/** Feed runs one by one into a fresh mission at `level`; returns the run count that completed it (0 = not within the runs). */
function runsToComplete(t: MissionTemplate, level: number, runs: RunState[] | SetKey): number {
  const a: ActiveMission[] = [{ id: t.id, level, progress: 0, target: t.targets[level], runsWithout: 0 }];
  for (let i = 0; i < SEEDS.length; i++) {
    const s = typeof runs === 'string' ? runOf(runs, i) : runs[i]; if (!s) break;
    if (applyRunToMissions(a, s).length) return i + 1;
  }
  lastBest = a[0].progress;
  return 0;
}
let lastBest = 0;
const single = (t: MissionTemplate, level: number, runs: RunState[]) => runs.filter(s => runsToComplete(t, level, [s]) === 1).length;
const STAGE_NATIVE = new Set(['star_tot', 'pouch_tot', 'clear_tot']);

const report: string[] = [];
let t0 = 0;
beforeAll(() => { t0 = Date.now(); });

describe('every mission template × level: a casual bot finishes it within 10 runs', () => {
  for (const t of MISSIONS.filter(t => !STAGE_NATIVE.has(t.id))) {
    it(`${t.id} ${JSON.stringify(t.targets)}`, () => {
      const out: string[] = []; const ns: number[] = [];
      for (let lv = 0; lv < 3; lv++) {
        const k = setFor(t, lv);
        const n = runsToComplete(t, lv, k); ns.push(n);
        out.push(`${t.targets[lv]}:${n || '✗ best ' + Math.floor(lastBest)}${k === 'E' ? '' : '(' + k + ')'}`);
      }
      report.push(`${t.id.padEnd(13)} ${out.join('  ')}`);
      ns.forEach((n, lv) => expect(n, `${t.id} level ${lv} (target ${t.targets[lv]}) on set ${setFor(t, lv)}`).toBeGreaterThan(0));
    });
  }

  it('stage missions (star_tot / clear_tot / pouch_tot): progression through the map, when available', () => {
    for (const t of MISSIONS.filter(t => STAGE_NATIVE.has(t.id))) {
      const out: string[] = [];
      for (let lv = 0; lv < 3; lv++) {
        const p = defaultProgress(); p.totals.runs = 3; p.tutorialDone = true;   // map + missions open
        if (t.available && !t.available(p, t.targets[lv])) { out.push(`${t.targets[lv]}:n/a`); continue; }   // never offered with this content
        p.missions = [{ id: t.id, level: lv, progress: 0, target: t.targets[lv], runsWithout: 0 }];
        const doneBefore = p.missionsDone; let n = 0;
        for (let i = 0; i < 10 && !n; i++) {
          const id = nextStage(p) ?? STAGES.filter(s => stageUnlocked(p, s.id)).sort((a, b) => stageStarCount(p, a.id) - stageStarCount(p, b.id))[0].id;
          const s = play({ mode: 'stage', seed: SEEDS[i], charId: 'hotteok', companionId: 'firefly', stageId: id }, SEEDS[i]);
          p.missions = p.missions.filter(m => m.id === t.id).slice(0, 1);   // keep only the mission under test
          if (!p.missions.length) break;
          applyRun(p, s);
          if (p.missionsDone > doneBefore) n = i + 1;
        }
        out.push(`${t.targets[lv]}:${n || '✗'}`);
        expect(n, `${t.id} level ${lv}`).toBeGreaterThan(0);
      }
      report.push(`${t.id.padEnd(13)} ${out.join('  ')}  (stage map, n/a = not enough stars/pouches in the current content → never offered)`);
    }
  });
});

describe('assignment metadata is bot-backed', () => {
  it('quick: levels < quick are finished by ONE typical casual endless run (≥ half of the seeds)', () => {
    for (const t of MISSIONS) for (let lv = 0; lv < t.quick; lv++) {
      const runs = set(setFor(t, lv));
      expect(single(t, lv, runs), `${t.id} level ${lv} quick`).toBeGreaterThanOrEqual(runs.length / 2);
    }
  });
  it('stage phase: stageLevels are doable within 10 early stage runs, quickStage in one', () => {
    const S = set('S');
    for (const t of MISSIONS.filter(t => !STAGE_NATIVE.has(t.id))) {
      if (t.stageLevels > 0) expect(runsToComplete(t, t.stageLevels - 1, S), `${t.id} stageLevels`).toBeGreaterThan(0);
      if (t.quickStage > 0) expect(single(t, t.quickStage - 1, S), `${t.id} quickStage`).toBeGreaterThanOrEqual(S.length / 2);
      if (t.requires === 'long') expect(t.stageLevels, `${t.id}: long-only`).toBe(0);
    }
  });
  it('stretch measures come from an exact replay of the run', () => {
    for (const k of ['E', 'NP', 'NA'] as SetKey[]) for (const s of set(k)) expect(runTrace(s).exact).toBe(true);
  });
});

// ---------------------------------------------------------------- economy (GDD §9.6 / §9.7)
// A casual player from a fresh save: stages in order while there is a next one, a daily once per "day" (every 12 runs),
// otherwise endless (with a relay partner once the slot is open); missions stuck for 3 runs are swapped (free).
// Buys the cheapest shop item as soon as it is affordable. Time per run = sim time + 8 s of menus/results.
describe('economy', () => {
  it('엽전 per run and unlock pacing (casual bot)', () => {
    const p: Progress = defaultProgress();
    let minutes = 0; let day = 1; let dayRuns = 0; let playedDaily = false;
    const rows: { mode: string; t: number; pick: number; dist: number; mis: number; rank: number; nm: number; xp: number }[] = [];
    const PICKUP_SCALE = Number(process.env.ECON_PICKUPS ?? 1);   // e.g. ECON_PICKUPS=0.6 to preview a lower chunk coin density
    const unlocks: string[] = [];
    let firstUnlock = -1; let firstCharUnlock = -1;
    const TARGET_MIN = Number(process.env.ECON_MIN ?? 60);   // ECON_MIN=240 npx vitest run tests/missions.test.ts for the long report
    p.tutorialDone = true; minutes += 0.5;   // first run (tutorial) ≈ 25 s + intro
    for (let i = 0; minutes < TARGET_MIN && i < 400; i++) {
      const key = `2026-10-${String(day).padStart(2, '0')}`;
      let cfg: RunConfig; const seed = 9000 + i * 13;
      const stage = nextStage(p);
      const others = p.unlocked.filter(c => c !== 'hotteok');
      if (stage) cfg = { mode: 'stage', seed, charId: 'hotteok', companionId: p.loadout.companion, stageId: stage };
      else if (featureOpen(p, 'daily') && !playedDaily) { cfg = { mode: 'daily', seed: dailySeed(key), charId: dailyChar(key), companionId: dailyCompanion(key) }; playedDaily = true; }
      else if (featureOpen(p, 'endless')) cfg = { mode: 'endless', seed, charId: 'hotteok', companionId: p.loadout.companion, partnerId: featureOpen(p, 'relay') && others.length ? others[0] : null };
      else if (featureOpen(p, 'daily')) cfg = { mode: 'daily', seed: dailySeed(key), charId: dailyChar(key), companionId: dailyCompanion(key) };
      else { const st = STAGES.filter(s => stageUnlocked(p, s.id)).sort((a, b) => stageStarCount(p, a.id) - stageStarCount(p, b.id))[0]; cfg = { mode: 'stage', seed, charId: 'hotteok', companionId: p.loadout.companion, stageId: st.id }; }
      const s = play(cfg, seed);
      if (PICKUP_SCALE !== 1) s.stats.coins = Math.round(s.stats.coins * PICKUP_SCALE);   // projection of a chunk coin-density change
      const r = applyRun(p, s, key);
      minutes += (s.t + 8) / 60;
      rows.push({ mode: cfg.mode, t: s.t, pick: r.coinsFromPickups, dist: r.coinsFromDist, mis: r.coinsFromMissions, rank: r.coinsFromRank, nm: r.missionsDone.length, xp: r.missionsDone.reduce((a, m) => a + m.xp, 0) });
      for (const u of r.unlocked) { unlocks.push(`${minutes.toFixed(0)}분 ${u}`); if (firstCharUnlock < 0 && CHARACTERS.some(c => c.id === u)) firstCharUnlock = minutes; if (firstUnlock < 0) firstUnlock = minutes; }
      // swap missions that made no progress for 3 runs (a player would)
      p.missions.forEach((m, j) => { if (m.runsWithout >= 3) reroll(p, j); });
      // shop: cheapest affordable thing first
      const buy = shopList(p).filter(x => !x.owned && x.affordable).sort((a, b) => a.price - b.price)[0];
      if (buy) {
        const ok = buy.kind === 'char' ? buyCharacter(p, buy.id).ok : buy.kind === 'companion' ? buyCompanion(p, buy.id).ok : buyCosmetic(p, buy.id).ok;
        if (ok) { unlocks.push(`${minutes.toFixed(0)}분 ${buy.name}(${buy.price})`); if (firstUnlock < 0) firstUnlock = minutes; }
      }
      if (++dayRuns >= 12) { day++; dayRuns = 0; playedDaily = false; }
    }
    const avg = (f: (r: typeof rows[number]) => number, rs = rows) => rs.reduce((a, r) => a + f(r), 0) / Math.max(1, rs.length);
    const total = (r: typeof rows[number]) => r.pick + r.dist + r.mis + r.rank;
    const byMode = (m: string) => rows.filter(r => r.mode === m);
    const lines = [
      `economy${PICKUP_SCALE !== 1 ? ` (pickups ×${PICKUP_SCALE})` : ''}: ${rows.length} runs in ${minutes.toFixed(0)} min (stage ${byMode('stage').length} · daily ${byMode('daily').length} · endless ${byMode('endless').length})`,
      `  per run (all):  total ${avg(total).toFixed(0)} = pickups ${avg(r => r.pick).toFixed(0)} + distance ${avg(r => r.dist).toFixed(0)} + missions ${avg(r => r.mis).toFixed(0)} + rank ${avg(r => r.rank).toFixed(0)}  · missions ${avg(r => r.nm).toFixed(2)}/run · XP ${avg(r => r.xp).toFixed(2)}/run`,
      ...['stage', 'daily', 'endless'].map(m => `  ${m.padEnd(8)} total ${avg(total, byMode(m)).toFixed(0)} (pickups ${avg(r => r.pick, byMode(m)).toFixed(0)}, ${avg(r => r.t, byMode(m)).toFixed(0)} s/run)`),
      `  rank ${p.rank} · missions done ${p.missionsDone} · stars ${totalStars(p)} · coins left ${p.coins} · earned ${p.totals.coinsEarned}`,
      `  first unlock ${firstUnlock.toFixed(1)} min · first character ${firstCharUnlock < 0 ? '—' : firstCharUnlock.toFixed(1) + ' min'}`,
      `  unlocks: ${unlocks.join(' · ')}`,
    ];
    report.push(...lines);
    // sanity only (the numbers are reported for tuning; GDD target 120–180 per run, first unlock 15–25 min)
    expect(avg(total)).toBeGreaterThan(60); expect(avg(total)).toBeLessThan(400);
    expect(firstUnlock).toBeGreaterThan(0);
  });
});

describe('report', () => {
  it('prints the table', () => {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    // eslint-disable-next-line no-console
    console.log(['', '미션 × 캐주얼 봇 (target:runs-to-complete, set)', ...report, `bot sets (ms): ${JSON.stringify(timing)} · total ${secs} s`, ''].join('\n'));
    expect(MISSIONS.length).toBe(40);
    void MISSION_BY_ID; void starsAvailable;
  });
});
