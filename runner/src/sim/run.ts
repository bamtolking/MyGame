// One run: fixed-step, deterministic (seed + config + input stream → identical result). No DOM.
// Only exact arithmetic here (+ − × ÷, sqrt, floor/round/min/max/abs) — see tests/determinism.test.ts.
import { DT, TILE, GROUND_Y, PX_PER_M, PICK_PAD, GIANT_SCALE, SPEED_TIERS, FOOT_W } from '../data/physics';
import {
  DRAIN_BY_TIER, LATE_DRAIN_START, LATE_DRAIN_PER_S, HIT_DAMAGE, FALL_DAMAGE, HIT_IFRAMES, FALL_IFRAMES,
  RESCUE_BOUNCE_V, RESCUE_BRIDGE_T, LOW_HP_FRAC, POTION_HEAL, BIG_POTION_HEAL, MINI_POTION_HEAL, POWER_DUR, POWER_AFTER_IFRAMES,
  DASH_MUL, MAGNET_R, MAGNET_PULL_V, BONUS_WORD, BONUS_T, SUPER_BONUS_MUL, SUPER_BONUS_HEAL, BONUS_LIFT_T, BONUS_RETURN_IFRAMES,
  FLY_THRUST, FLY_GRAVITY, FLY_MAX_V, SCORE, STREAK_STEP, STREAK_BONUS, STREAK_MAX, COUNTDOWN_T, RUN_CAP_T,
  SCORE_CAP, DYING_T, RELAY_FREEZE_STEPS, RELAY_HP_FRAC, SMASH_HITSTOP,
} from '../data/tuning';
import { CHAR_BY_ID, type CharacterDef } from '../data/characters';
import { COMPANION_BY_ID } from '../data/companions';
import { STAGE_BY_ID } from '../data/stages';
import { BIOME_ORDER } from '../data/biomes';
import { seedRng } from './rng';
import { newBody, stepBody, hurtbox, hazardOverlap } from './body';
import { newLevel, ensureLevel, chunkAt, restartStreamAt, placeChunk, pickSky, PARSED_BY_ID } from './level';
import type { RunState, RunInput, PowerKind, Pickup, Hazard, Mode, SimEvent, AssistOpts } from './types';

export const RUN_VERSION = 3;          // bump on any rule change in run.ts / body.ts / level.ts (ghost validity)
export const NEAR_PAD = 14;          // passing within this many px of a hazard (without touching) = near miss
export const HITSTOP_STEPS = 4;      // 67 ms freeze when damaged
export const TRIAL_T = 60;
export const HONEY_DROP_AHEAD = 560; // px ahead of the runner where 깍순이 drops honey
export type { AssistOpts };

export interface RunConfig {
  mode: Mode;
  seed: number;
  charId: string;
  partnerId?: string | null;         // relay runner (takes over once at 50 % of its own max)
  companionId?: string | null;       // 짝꿍
  stageId?: string | null;
  assist?: AssistOpts;               // any flag on → the record is marked (never punished)
  trial?: boolean;                   // try-out run with a locked character: no rewards, ends after TRIAL_T
  noCountdown?: boolean;             // instant retry / boot-into-run
}

export function newRun(cfg: RunConfig): RunState {
  const ch = CHAR_BY_ID[cfg.charId] ?? CHAR_BY_ID['hotteok'];
  const stage = cfg.stageId ? STAGE_BY_ID[cfg.stageId] ?? null : null;
  const seed = (stage ? stage.seed : cfg.seed) >>> 0;
  const assist: AssistOpts = { noHitDamage: !!cfg.assist?.noHitDamage, halfDrain: !!cfg.assist?.halfDrain, autoSlide: !!cfg.assist?.autoSlide };
  const comp = cfg.companionId && COMPANION_BY_ID[cfg.companionId] ? cfg.companionId : null;
  const s: RunState = {
    version: RUN_VERSION, seed, rng: seedRng(seed), mode: cfg.mode, stageId: stage?.id ?? null, charId: ch.id, mainId: ch.id,
    partnerId: cfg.partnerId && cfg.partnerId !== ch.id && CHAR_BY_ID[cfg.partnerId] && cfg.mode !== 'stage' ? cfg.partnerId : null,
    relayUsed: false, companionId: comp, assistOpts: assist, assist: !!(assist.noHitDamage || assist.halfDrain || assist.autoSlide), trial: !!cfg.trial,
    noCountdown: !!cfg.noCountdown,
    phase: cfg.noCountdown ? 'run' : 'countdown', t: 0, countdown: cfg.noCountdown ? 0 : COUNTDOWN_T, steps: 0,
    body: newBody(TILE * 2, GROUND_Y), speed: SPEED_TIERS[0], baseSpeed: SPEED_TIERS[0], tier: stage ? stage.tiers[0] : 0,
    biome: stage ? stage.biome : BIOME_ORDER[0],
    hp: ch.maxHp, maxHp: ch.maxHp, iframes: 0, hurtT: 99,
    power: { giant: 0, dash: 0, magnet: 0, after: 0 },
    skillT: skillEvery(ch), skillActive: 0, shield: ch.skill.kind === 'shield' && ch.skill.startCharged ? 1 : 0,
    reviveLeft: ch.revive > 0 ? 1 : 0, rescue: 0,
    letters: BONUS_WORD.map(() => false), bonusStage: 'none', bonusT: 0, bonusSuper: false,
    streak: 0, score: 0, dist: 0,
    level: newLevel(stage, cfg.mode),
    stats: {
      jellies: 0, bigJellies: 0, coins: 0, potions: 0, powers: 0, letters: 0, hits: 0, hitsBy: {}, falls: 0, smashed: 0,
      bonusTimes: 0, bestStreak: 0, skillUses: 0, jumps: 0, airJumps: 0, slides: 0, jelliesSeen: 0, hpFromPotions: 0,
      drained: 0, nearMisses: 0, maxTier: 0, bonusJellies: 0, lines: 0, moonCakes: 0, pouches: 0, fastFalls: 0, maxFlow: 0,
      superBonus: 0, relayDist: 0, miniPotions: 0, pitsGuarded: 0, shieldsUsed: 0, jellyPct500: -1,
    },
    deathCause: null, lastHit: null, events: [], inputJumpHeld: false, pendingJump: false, prevSlide: false, lowHpWarned: false, hitstop: 0,
    log: [], lastBits: 0, dyingT: 0, freeze: 0, pouchesGot: 0, compT: 0,
    pitGuardLeft: comp && COMPANION_BY_ID[comp].effect.kind === 'pitGuard' ? (COMPANION_BY_ID[comp].effect as { count: number }).count : 0,
    relayStartDist: 0, rewinds: 0,
  };
  // opening straight so the first obstacle is never on screen at "GO"; endless/daily add a hazard-free warm-up
  placeChunk(s, PARSED_BY_ID.get('landing')!, s.tier, s.biome);
  if ((cfg.mode === 'endless' || cfg.mode === 'daily') && PARSED_BY_ID.has('warmup')) placeChunk(s, PARSED_BY_ID.get('warmup')!, s.tier, s.biome);
  ensureLevel(s);
  return s;
}

export function charOf(s: RunState): CharacterDef { return CHAR_BY_ID[s.charId] ?? CHAR_BY_ID['hotteok']; }
function skillEvery(ch: CharacterDef): number { return ch.skill.kind === 'none' ? 0 : ch.skill.every; }
function emit(s: RunState, e: SimEvent): void { if (s.events.length < 400) s.events.push(e); }

export function totalScore(s: RunState): number { return Math.min(SCORE_CAP, s.score + Math.floor(s.dist * SCORE.perMeter)); }
export function flowLevel(s: RunState): number { return Math.min(Math.round(STREAK_MAX / STREAK_BONUS), Math.floor(s.streak / STREAK_STEP)); }
export function streakMul(s: RunState): number { return 1 + Math.min(STREAK_MAX, flowLevel(s) * STREAK_BONUS); }
export function jellyPct(s: RunState): number { return s.stats.jelliesSeen > 0 ? Math.floor(100 * s.stats.jellies / s.stats.jelliesSeen) : 0; }
function pickPad(s: RunState): number {
  const e = s.companionId ? COMPANION_BY_ID[s.companionId]?.effect : null;
  return PICK_PAD + (e && e.kind === 'pickPad' ? e.px : 0);
}

/** Advance exactly one fixed step (DT). */
export function stepRun(s: RunState, inp: RunInput): void {
  // input log (for ghosts / replays): record bit changes only
  const bits = (inp.jump ? 1 : 0) | (inp.slide ? 2 : 0) | (inp.jumpHeld ? 4 : 0);
  if (bits !== s.lastBits || inp.jump) { s.log.push(s.steps, bits); s.lastBits = bits; }
  s.steps++;

  if (s.phase === 'countdown') {
    s.countdown -= DT;
    if (s.countdown <= 0) { s.phase = 'run'; s.countdown = 0; }
    return;
  }
  if (s.phase === 'dying') { s.dyingT += DT; if (s.dyingT >= DYING_T) s.phase = 'over'; return; }
  if (s.phase !== 'run') return;
  if (s.freeze > 0 || s.hitstop > 0) {  // relay hand-over / damage hitstop: the world holds, presses queue up
    if (s.freeze > 0) s.freeze--; else s.hitstop--;
    if (inp.jump) s.pendingJump = true;
    return;
  }

  const ch = charOf(s);
  s.t += DT;
  s.inputJumpHeld = !!inp.jumpHeld;
  const jump = inp.jump || s.pendingJump;   // a queued press is a fresh press (it may still become the air jump)
  s.pendingJump = false;

  // ---- pace: speed/tier/biome switch at chunk boundaries (x − TILE), matching the validator ----
  if (s.bonusStage === 'none') {
    const pc = chunkAt(s.level, s.body.x);
    if (pc && !pc.sky) {
      if (pc.tier > s.tier) emit(s, { t: 'speedUp', tier: pc.tier });
      if (pc.biome !== s.biome) emit(s, { t: 'biome', id: pc.biome });
      s.tier = pc.tier; s.biome = pc.biome; s.baseSpeed = pc.speed;
      s.stats.maxTier = Math.max(s.stats.maxTier, s.tier);
      warnSpeedUp(s, pc.serial);
    }
  }
  s.speed = s.baseSpeed * (s.power.dash > 0 && s.bonusStage === 'none' ? DASH_MUL : 1);
  const dx = s.speed * DT;

  // ---- movement ----
  if (s.bonusStage === 'lift') {
    s.body.x += dx; s.body.y -= 900 * DT; s.body.onGround = false;
    s.bonusT -= DT;
    if (s.bonusT <= 0) enterSky(s);
  } else if (s.bonusStage === 'sky') {
    flyStep(s, !!inp.jumpHeld || jump, dx);
    s.bonusT -= DT;
    if (s.bonusT <= 0) exitSky(s);
  } else {
    const bridge = s.rescue > 0 || s.power.giant > 0 || s.power.dash > 0;
    const wasSliding = s.body.sliding; const wasAir = !s.body.onGround;
    const slide = inp.slide || (!!s.assistOpts.autoSlide && hangAhead(s));
    const r = stepBody(s.body, { jump, slide }, dx, DT, () => s.level.solids, { maxJumps: ch.maxJumps, glide: ch.glide }, bridge, !!inp.jumpHeld);
    if (r.jumped) { emit(s, { t: 'jump', n: r.jumped }); s.stats.jumps++; if (r.jumped === 2) s.stats.airJumps++; }
    if (r.landed) emit(s, { t: 'land' });
    if (s.body.sliding && !wasSliding) { emit(s, { t: 'slide' }); s.stats.slides++; }
    if (wasAir && !s.body.onGround && slide && !s.prevSlide && s.body.vy > -200) { s.stats.fastFalls++; emit(s, { t: 'fastFall' }); }
    s.prevSlide = slide;
    s.dist += dx / PX_PER_M;   // distance points are added in totalScore()
    if (s.relayUsed) s.stats.relayDist += dx / PX_PER_M;
    if (s.body.y > GROUND_Y + 150) fall(s);
    collideHazards(s);
  }

  collectPickups(s, ch);
  if (s.bonusStage === 'none' && s.letters.every(Boolean) && !pouchAtRisk(s)) startBonus(s);
  if (s.stats.jellyPct500 < 0 && s.dist >= 500) s.stats.jellyPct500 = jellyPct(s);
  checkLines(s);
  tickTimers(s, ch);
  ensureLevel(s);

  // ---- end conditions ----
  if (s.hp <= 0) onZeroHp(s);
  if (s.phase === 'run' && s.level.finishX !== Infinity && s.body.x >= s.level.finishX + 5 * TILE && s.bonusStage === 'none') {
    s.phase = 'clear'; emit(s, { t: 'clear' });
  }
  if (s.phase === 'run' && s.t >= RUN_CAP_T) { s.hp = 0; s.deathCause = 'cap'; onZeroHp(s); }
  if (s.phase === 'run' && s.trial && s.t >= TRIAL_T) { s.phase = 'clear'; emit(s, { t: 'clear' }); }
}

/** ~1 s before running into a faster chunk, warn (riser sound + speed lines). */
function warnSpeedUp(s: RunState, curSerial: number): void {
  const lv = s.level; const i = lv.chunks.findIndex(c => c.serial === curSerial);
  const next = i >= 0 ? lv.chunks[i + 1] : undefined;
  if (!next || next.sky || next.tier <= s.tier || lv.warnedSerial === next.serial) return;
  if (s.body.x > next.x - TILE - s.baseSpeed * 1.0) { lv.warnedSerial = next.serial; emit(s, { t: 'speedUpSoon', tier: next.tier }); }
}

/** Assist "자동 슬라이드": slide when a hanging hazard is just ahead (deterministic, part of the run config). */
function hangAhead(s: RunState): boolean {
  const hb = hurtbox(s.body);
  for (const h of s.level.hazards) {
    if (h.x0 > hb.x1 + 90) break;
    if (h.kind === 'hang' && !h.broken && h.x1 > hb.x0 - 4 && h.x0 < hb.x1 + 90) return true;
  }
  return false;
}

function fall(s: RunState): void {
  if (s.mode === 'tutorial') { rewind(s, 'pit'); return; }
  let dmg = s.assistOpts.noHitDamage ? 0 : FALL_DAMAGE;
  if (s.pitGuardLeft > 0) { s.pitGuardLeft--; s.stats.pitsGuarded++; dmg = 0; }
  s.hp -= dmg; s.stats.falls++;
  s.lastHit = { kind: 'pit', biome: s.biome, x: s.body.x }; s.hurtT = 0;
  s.body.vy = -RESCUE_BOUNCE_V; s.body.onGround = false; s.body.jumps = 1; s.body.sliding = false;
  s.rescue = Math.max(RESCUE_BRIDGE_T, bridgeNeed(s)); s.iframes = Math.max(s.iframes, FALL_IFRAMES);
  s.streak = 0;
  emit(s, { t: 'fall', dmg });
}

/** Tutorial only: a mistake costs nothing — the chunk is replayed from its start and the app shows a hint. */
function rewind(s: RunState, kind: string): void {
  const pc = chunkAt(s.level, s.body.x); if (!pc) return;
  const x0 = pc.x - TILE, x1 = pc.x + pc.width;
  for (const h of s.level.hazards) if (h.x0 >= pc.x && h.x1 <= x1) { h.passed = false; h.touched = false; h.near = false; }
  const b = s.body; b.x = x0; b.y = GROUND_Y; b.vy = 0; b.onGround = true; b.jumps = 0; b.sliding = false; b.buffer = 0; b.coyote = 0;
  s.iframes = 0; s.rescue = 0; s.rewinds++; s.streak = 0;
  emit(s, { t: 'rewind', kind });
}

function collideHazards(s: RunState): void {
  const hb = hurtbox(s.body);
  const near = hurtbox(s.body, NEAR_PAD);
  const powered = s.power.giant > 0 || s.power.dash > 0;
  for (const h of s.level.hazards) {
    if (h.x0 > near.x1) break;          // hazards are appended in x order within the live window
    if (h.broken) continue;
    if (!h.passed && h.x1 < hb.x0) {
      h.passed = true;
      if (h.touched) continue;          // brushed through during i-frames: not a clean pass
      const before = flowLevel(s);
      s.streak += h.near ? 2 : 1;       // a near miss counts double for 흐름
      s.stats.bestStreak = Math.max(s.stats.bestStreak, s.streak);
      if (h.near) { s.stats.nearMisses++; s.score += SCORE.nearMiss; emit(s, { t: 'nearMiss', x: (h.x0 + h.x1) / 2, y: h.y0 }); }
      const after = flowLevel(s); s.stats.maxFlow = Math.max(s.stats.maxFlow, after);
      if (after > before) emit(s, { t: 'streak', n: s.streak });
      continue;
    }
    if (h.passed) continue;
    if (!hazardOverlap(near, h)) continue;
    if (!hazardOverlap(hb, h)) { if (s.iframes <= 0) h.near = true; continue; }
    if (powered) {
      h.broken = true; s.stats.smashed++; s.score += SCORE.smash; s.hitstop = Math.max(s.hitstop, SMASH_HITSTOP);
      emit(s, { t: 'smash', kind: h.kind, x: (h.x0 + h.x1) / 2, y: Math.max(h.y0, 0) + 20 });
      continue;
    }
    if (s.iframes > 0 || h.touched) { h.near = false; h.touched = true; continue; } // touched while invulnerable = harmless forever
    if (s.mode === 'tutorial') { rewind(s, h.kind); return; }
    hitBy(s, h);
  }
}

function hitBy(s: RunState, h: Hazard): void {
  h.touched = true; h.near = false;   // stays visible (so you can see what hit you) but can never hit again
  const cx = (h.x0 + h.x1) / 2, cy = Math.max(h.y0, 0) + 20;
  if (s.shield > 0) {
    s.shield--; s.stats.shieldsUsed++; s.iframes = HIT_IFRAMES * 0.6; s.streak = 0;
    emit(s, { t: 'hit', kind: h.kind, x: cx, y: cy, dmg: 0, shielded: true });
    return;
  }
  const dmg = s.assistOpts.noHitDamage ? 0 : HIT_DAMAGE;
  s.hp -= dmg; s.iframes = HIT_IFRAMES; s.hurtT = 0; s.streak = 0; s.hitstop = HITSTOP_STEPS;
  s.stats.hits++; s.stats.hitsBy[h.kind] = (s.stats.hitsBy[h.kind] || 0) + 1;
  s.lastHit = { kind: h.kind, biome: h.biome, x: cx };
  emit(s, { t: 'hit', kind: h.kind, x: cx, y: cy, dmg, shielded: false });
}

function collectPickups(s: RunState, ch: CharacterDef): void {
  const pb = hurtbox(s.body, pickPad(s));
  const magR = s.power.magnet > 0 ? MAGNET_R : ch.magnetR;
  const bx = s.body.x, by = s.body.y - 35 * s.body.scale;
  const mul = streakMul(s);
  for (const p of s.level.pickups) {
    if (p.taken) continue;
    if (p.x > pb.x1 + Math.max(magR, 0) + 40) break;   // pickups are appended in x order
    if (!p.seen && p.x < pb.x0 - 80) { p.seen = true; if (p.type === 'jelly' || p.type === 'big') s.stats.jelliesSeen++; continue; }
    if (magR > 0 && p.type !== 'letter' && p.type !== 'power' && p.type !== 'pouch' && !p.pulled) {
      const ddx = p.x - bx, ddy = p.y - by; if (ddx * ddx + ddy * ddy < magR * magR) p.pulled = true;
    }
    if (p.pulled) {
      const ddx = bx - p.x, ddy = by - p.y; const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;   // sqrt is exact; hypot is not
      const v = Math.min(d, (MAGNET_PULL_V + s.speed) * DT);
      p.x += ddx / d * v; p.y += ddy / d * v;
    }
    if (p.x < pb.x0 || p.x > pb.x1 || p.y < pb.y0 || p.y > pb.y1) continue;
    take(s, p, mul);
  }
}

function take(s: RunState, p: Pickup, mul: number): void {
  p.taken = true;
  let value = 0;
  const countJelly = () => {
    s.stats.jellies++; if (!p.seen) { p.seen = true; s.stats.jelliesSeen++; }
    if (p.chunk !== undefined) { const pc = s.level.chunks.find(c => c.serial === p.chunk); if (pc) pc.jellyGot++; }
  };
  switch (p.type) {
    case 'jelly': value = Math.round(SCORE.jelly * mul); countJelly(); break;
    case 'big': value = Math.round(SCORE.big * mul); s.stats.bigJellies++; countJelly(); break;
    case 'bonusJelly': value = Math.round(SCORE.bonusJelly * mul); s.stats.bonusJellies++; break;
    case 'coin': value = SCORE.coin; s.stats.coins++; break;
    case 'moonCake': value = SCORE.moonCake; s.stats.moonCakes++; break;
    case 'pouch': value = SCORE.pouch; s.stats.pouches++; s.pouchesGot |= 1 << (p.pouch ?? 0); break;
    case 'potion': case 'bigPotion': case 'miniPotion': {
      const heal = p.type === 'bigPotion' ? BIG_POTION_HEAL : p.type === 'miniPotion' ? MINI_POTION_HEAL : POTION_HEAL;
      const before = s.hp; s.hp = Math.min(s.maxHp, s.hp + heal); s.stats.hpFromPotions += s.hp - before;
      if (p.type === 'miniPotion') s.stats.miniPotions++; else s.stats.potions++;
      if (s.hp > s.maxHp * LOW_HP_FRAC) s.lowHpWarned = false;
      break;
    }
    case 'power': startPower(s, p.power!); s.stats.powers++; break;
    case 'letter': {
      value = SCORE.letter; s.letters[p.letter!] = true; s.stats.letters++;
      s.score += value;
      emit(s, { t: 'pickup', type: p.type, x: p.x, y: p.y, value, letter: p.letter });
      // the word is complete: the feast starts right after this step's pickups (see stepRun); 왕보름달 is decided now
      if (s.letters.every(Boolean) && s.bonusStage === 'none') s.bonusSuper = s.hp < s.maxHp * LOW_HP_FRAC;
      return;
    }
  }
  s.score += value;
  emit(s, { t: 'pickup', type: p.type, x: p.x, y: p.y, value, power: p.power, pouch: p.pouch });
}

/** 한 줄 완성: leaving a chunk with ≥ 12 star candies after collecting every one of them. */
function checkLines(s: RunState): void {
  for (const pc of s.level.chunks) {
    if (pc.line !== 1 || s.body.x < pc.x + pc.width) continue;
    pc.line = 2;
    if (pc.jellyGot >= pc.jellyTotal && pc.jellyTotal > 0) {
      const v = Math.round(SCORE.line * streakMul(s)); s.score += v; s.stats.lines++;
      emit(s, { t: 'line', x: s.body.x, y: s.body.y - 90, value: v });
    }
  }
}

function startPower(s: RunState, k: PowerKind): void {
  // a repeat pickup refreshes to the full duration (never stacks)
  s.power[k] = POWER_DUR[k];
  if (k === 'giant') s.body.scale = GIANT_SCALE;
  emit(s, { t: 'power', kind: k });
}

function endPower(s: RunState, k: PowerKind): void {
  if (k === 'giant') s.body.scale = 1;
  if (k !== 'magnet') s.iframes = Math.max(s.iframes, POWER_AFTER_IFRAMES);
  // the power's pit bridge never vanishes under the feet: the rescue bridge takes over until real ground
  if (k !== 'magnet' && s.power.giant <= 0 && s.power.dash <= 0) s.rescue = Math.max(s.rescue, bridgeNeed(s));
  emit(s, { t: 'powerEnd', kind: k });
}

/** Seconds of pit bridge that carry the feet from here onto real ground at the current pace (0 = over ground). */
function bridgeNeed(s: RunState): number {
  const f0 = s.body.x - FOOT_W / 2, f1 = s.body.x + FOOT_W / 2;
  let next = Infinity;
  for (const o of s.level.solids) {
    if (!o.ground || o.x1 <= f0) continue;
    if (o.x0 < f1) return 0;
    next = Math.min(next, o.x0);
  }
  return next === Infinity ? RESCUE_BRIDGE_T : (next + FOOT_W / 2 - s.body.x) / s.baseSpeed + 0.15;
}

function tickTimers(s: RunState, ch: CharacterDef): void {
  const inBonus = s.bonusStage !== 'none';
  s.iframes = Math.max(0, s.iframes - DT);
  s.hurtT += DT;
  s.rescue = Math.max(0, s.rescue - DT);
  // power timers pause during bonus time so rewards never cancel each other
  if (!inBonus) {
    for (const k of ['giant', 'dash', 'magnet'] as PowerKind[]) {
      if (s.power[k] > 0) { s.power[k] -= DT; if (s.power[k] <= 0) { s.power[k] = 0; endPower(s, k); } }
    }
  }
  // warmth drain (never during bonus)
  if (!inBonus) {
    let drain = DRAIN_BY_TIER[s.tier] * ch.drainMul;
    if (s.t > LATE_DRAIN_START) drain += (s.t - LATE_DRAIN_START) * LATE_DRAIN_PER_S;
    if (s.assistOpts.halfDrain) drain *= 0.5;
    if (s.mode === 'tutorial') drain *= 0.3;
    s.hp -= drain * DT; s.stats.drained += drain * DT;
  }
  if (s.mode === 'tutorial' && s.hp < 30) s.hp = 30;
  if (!s.lowHpWarned && s.hp > 0 && s.hp < s.maxHp * LOW_HP_FRAC) { s.lowHpWarned = true; emit(s, { t: 'lowHp' }); }
  // character skill (charges from 0 s; pauses during bonus)
  if (ch.skill.kind !== 'none' && !inBonus) {
    if (s.skillActive > 0) s.skillActive = Math.max(0, s.skillActive - DT);
    s.skillT -= DT;
    if (s.skillT <= 0) { s.skillT = ch.skill.every; fireSkill(s, ch); }
  }
  // companion 깍순이: a honey drop on a safe running-line cell ahead
  const eff = s.companionId ? COMPANION_BY_ID[s.companionId]?.effect : null;
  if (eff && eff.kind === 'honeyDrop' && !inBonus && s.mode !== 'tutorial') {
    s.compT += DT;
    if (s.compT >= eff.every && dropHoney(s)) s.compT = 0;   // no safe cell yet → try again next step
  }
}

/** The drop turns a running-line (row 10) star candy ahead into honey: every glyph pickup is proven collectible
 *  hit-free by the chunk validator, so the drop is too. Also no hazard within 2 columns and no pit under it. */
function dropHoney(s: RunState): boolean {
  const lv = s.level; const x0 = s.body.x + HONEY_DROP_AHEAD, x1 = x0 + 12 * TILE;
  for (const p of lv.pickups) {
    if (p.x >= x1) break;
    if (p.x < x0 || p.taken || p.pulled || p.type !== 'jelly' || p.y !== GROUND_Y - TILE / 2) continue;
    const onGround = lv.solids.some(o => o.ground && o.x0 <= p.x - 20 && o.x1 >= p.x + 20);
    const clear = !lv.hazards.some(h => h.x1 > p.x - 2 * TILE && h.x0 < p.x + 2 * TILE);
    if (!onGround || !clear) continue;
    p.type = 'miniPotion';
    const pc = lv.chunks.find(c => c.serial === p.chunk); if (pc) pc.jellyTotal--;   // 한 줄 완성 still counts the rest
    emit(s, { t: 'drop', x: p.x, y: p.y });
    return true;
  }
  return false;
}
function insertPickup(s: RunState, p: Pickup): void {
  const arr = s.level.pickups; let i = arr.length;
  while (i > 0 && arr[i - 1].x > p.x) i--;
  arr.splice(i, 0, p);
}

function fireSkill(s: RunState, ch: CharacterDef): void {
  const sk = ch.skill;
  const onScreen = (p: Pickup) => !p.taken && p.x > s.body.x - 60 && p.x < s.body.x + 760;
  switch (sk.kind) {
    case 'jellyBurst': s.skillActive = sk.dur; for (const p of s.level.pickups) if (onScreen(p) && p.type === 'jelly') p.type = 'big'; break;
    case 'coinRain': s.skillActive = sk.dur; for (const p of s.level.pickups) if (onScreen(p) && p.type === 'jelly') p.type = 'coin'; break;
    case 'shield': if (s.shield >= 1) return; s.shield = 1; break;
    case 'heal': s.hp = Math.min(s.maxHp, s.hp + sk.amount); break;
    case 'magnet': s.power.magnet = Math.max(s.power.magnet, sk.dur); s.skillActive = sk.dur; break;
    case 'giant': s.power.giant = Math.max(s.power.giant, sk.dur); s.body.scale = GIANT_SCALE; s.skillActive = sk.dur; break;
    case 'none': return;
  }
  s.stats.skillUses++;
  emit(s, { t: 'skill', kind: sk.kind });
}

// ---- bonus time (보름달 잔치) ----
function startBonus(s: RunState): void {
  if (s.bonusSuper) s.stats.superBonus++;
  s.bonusStage = 'lift'; s.bonusT = BONUS_LIFT_T; s.stats.bonusTimes++; s.level.skyPlaced = 0;
  s.iframes = Math.max(s.iframes, BONUS_LIFT_T + 0.2);
  emit(s, { t: 'bonusStart', super: s.bonusSuper });
}

function enterSky(s: RunState): void {
  const x = s.body.x + 6000;
  restartStreamAt(s, x - 3 * TILE);
  s.bonusStage = 'sky'; s.bonusT = BONUS_T * (s.bonusSuper ? SUPER_BONUS_MUL : 1);
  s.body.x = x; s.body.y = 200; s.body.vy = 0; s.body.onGround = false; s.body.sliding = false; s.body.jumps = 2;
  ensureLevel(s);
  // the jackpot: one 보름달 떡 on the middle line near the end of the feast. The sky is generated past it first,
  // so pickups stay in x order (collectPickups stops at the first one out of reach).
  const mx = x + s.baseSpeed * (s.bonusT - 0.9);
  while (s.level.genX <= mx + 200) placeChunk(s, pickSky(s), s.tier, s.biome, { sky: true });
  insertPickup(s, { id: s.level.nextId++, type: 'moonCake', x: mx, y: 270, taken: false, pulled: false });
}

/** Stage: a golden pouch still ahead in the stretch a feast would abandon — the chunks enterSky keeps (they start
 *  before where the lift ends) are never re-placed. The feast waits until the pouch is taken or passed, so a
 *  letter never costs a pouch; pouches in chunks that are dropped come again after the landing. */
function pouchAtRisk(s: RunState): boolean {
  if (s.mode !== 'stage') return false;
  const lv = s.level; const pb = hurtbox(s.body, pickPad(s));
  const cut = s.body.x + s.baseSpeed * (BONUS_LIFT_T + 2 * DT) - 50;   // ≥ restartStreamAt's keep line at enterSky
  let end = -Infinity;
  for (const c of lv.chunks) if (c.x < cut) end = Math.max(end, c.x + c.width);
  return lv.pickups.some(p => p.type === 'pouch' && !p.taken && p.x >= pb.x0 && p.x < end);
}

function exitSky(s: RunState): void {
  s.letters = s.letters.map(() => false);
  s.bonusStage = 'none';
  if (s.bonusSuper) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * SUPER_BONUS_HEAL);
  s.bonusSuper = false;
  const x = s.body.x + 6000;
  restartStreamAt(s, x - 2 * TILE);
  placeChunk(s, PARSED_BY_ID.get('landing')!, s.tier, s.biome);
  s.body.x = x; s.body.y = GROUND_Y - 260; s.body.vy = 0; s.body.onGround = false; s.body.jumps = 2; s.body.sliding = false;
  s.iframes = Math.max(s.iframes, BONUS_RETURN_IFRAMES);
  ensureLevel(s);
  emit(s, { t: 'bonusEnd' });
}

function flyStep(s: RunState, held: boolean, dx: number): void {
  const b = s.body;
  b.x += dx; b.sliding = false;
  b.vy += (held ? FLY_GRAVITY - FLY_THRUST : FLY_GRAVITY) * DT;
  b.vy = Math.max(-FLY_MAX_V, Math.min(FLY_MAX_V, b.vy));
  b.y += b.vy * DT;
  if (b.y < 110) { b.y = 110; b.vy = Math.max(0, b.vy); }
  if (b.y >= GROUND_Y) { b.y = GROUND_Y; b.vy = 0; b.onGround = true; } else b.onGround = false;
}

// ---- second chances: character revive → relay partner → down ----
function onZeroHp(s: RunState): void {
  if (s.phase !== 'run') return;
  if (s.deathCause !== 'cap') {
    if (s.reviveLeft > 0) {
      s.reviveLeft--; s.hp = s.maxHp * charOf(s).revive; s.iframes = 2; s.lowHpWarned = false;
      emit(s, { t: 'revive' }); return;
    }
    if (s.partnerId && !s.relayUsed && CHAR_BY_ID[s.partnerId]) {
      const p = CHAR_BY_ID[s.partnerId];
      s.relayUsed = true; s.charId = p.id; s.maxHp = p.maxHp; s.hp = p.maxHp * RELAY_HP_FRAC; s.iframes = 2;
      s.skillT = skillEvery(p); s.skillActive = 0; s.lowHpWarned = false;
      s.shield = p.skill.kind === 'shield' && p.skill.startCharged ? 1 : 0;
      s.reviveLeft = p.revive > 0 ? 1 : 0;
      for (const k of ['giant', 'dash', 'magnet'] as PowerKind[]) if (s.power[k] > 0) { s.power[k] = 0; endPower(s, k); }
      s.iframes = 2; s.freeze = RELAY_FREEZE_STEPS; s.relayStartDist = s.dist;
      if (s.body.y > GROUND_Y) { s.body.y = GROUND_Y - 200; s.body.vy = 0; s.rescue = Math.max(s.rescue, RESCUE_BRIDGE_T); }
      s.rescue = Math.max(s.rescue, bridgeNeed(s));   // the partner never drops into a pit it took over above
      emit(s, { t: 'relay', id: p.id }); return;
    }
  }
  s.hp = 0; s.phase = 'dying'; s.dyingT = 0;
  if (!s.deathCause) {
    const recent = s.lastHit && s.hurtT < 2.5;
    s.deathCause = recent ? (s.lastHit!.kind === 'pit' ? 'pit' : 'hit:' + s.lastHit!.kind) : 'drain';
  }
  emit(s, { t: 'death', cause: s.deathCause });
}

// ---- helpers for UI/tests ----
export function stateHash(s: RunState): string {
  const b = s.body;
  return [s.steps, s.phase, b.x.toFixed(3), b.y.toFixed(3), b.vy.toFixed(3), s.hp.toFixed(4), s.score, s.dist.toFixed(3), s.stats.jellies, s.stats.hits, s.level.genX, s.level.gen.mainIndex].join('|');
}
/** Ids of the main-course chunks placed so far, in order (course identity check). */
export function courseSoFar(s: RunState): string[] { return s.level.chunks.filter(c => c.main).map(c => `${c.index}:${c.id}`); }
