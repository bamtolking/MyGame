// One run: fixed-step, deterministic (seed + input stream → identical result). No DOM.
import { DT, TILE, GROUND_Y, PX_PER_M, PICK_PAD, GIANT_SCALE, SPEED_TIERS, JUMP_BUFFER_T } from '../data/physics';
import {
  BASE_MAX_HP, DRAIN_BY_TIER, LATE_DRAIN_START, LATE_DRAIN_PER_S, HIT_DAMAGE, FALL_DAMAGE, HIT_IFRAMES, FALL_IFRAMES,
  RESCUE_BOUNCE_V, RESCUE_BRIDGE_T, LOW_HP_FRAC, POTION_HEAL, BIG_POTION_HEAL, POWER_DUR, POWER_AFTER_IFRAMES, DASH_MUL,
  MAGNET_R, MAGNET_PULL_V, BONUS_WORD, BONUS_T, SUPER_BONUS_MUL, SUPER_BONUS_HEAL, BONUS_LIFT_T, BONUS_RETURN_IFRAMES,
  FLY_THRUST, FLY_GRAVITY, FLY_MAX_V, SCORE, STREAK_STEP, STREAK_BONUS, STREAK_MAX, COUNTDOWN_T, RUN_CAP_T,
} from '../data/tuning';
import { CHAR_BY_ID, type CharacterDef } from '../data/characters';
import { STAGES } from '../data/stages';
import { BIOME_ORDER } from '../data/biomes';
import { seedRng } from './rng';
import { newBody, stepBody, hurtbox, boxesOverlap } from './body';
import { newLevel, ensureLevel, chunkAt, restartStreamAt, placeChunk, PARSED_BY_ID } from './level';
import type { RunState, RunInput, PowerKind, Pickup, Hazard, Mode, SimEvent } from './types';

export const RUN_VERSION = 1;
export const NEAR_PAD = 14;          // passing within this many px of a hazard (without touching) = near miss
export const HITSTOP_STEPS = 4;      // 67 ms freeze when damaged

export interface RunConfig {
  mode: Mode;
  seed: number;
  charId: string;
  partnerId?: string | null;         // relay runner (takes over once at 50 % HP)
  stageId?: string | null;
  assist?: boolean;                  // gentler damage/drain; records are flagged
  trial?: boolean;                   // try-out run with a locked character: no rewards, ends after TRIAL_T
}
export const TRIAL_T = 60;

export function newRun(cfg: RunConfig): RunState {
  const ch = CHAR_BY_ID[cfg.charId] ?? CHAR_BY_ID['hotteok'];
  const stage = cfg.stageId ? STAGES.find(s => s.id === cfg.stageId) ?? null : null;
  const seed = (stage ? stage.seed : cfg.seed) >>> 0;
  const s: RunState = {
    version: RUN_VERSION, seed, rng: seedRng(seed), mode: cfg.mode, stageId: stage?.id ?? null, charId: ch.id, mainId: ch.id,
    partnerId: cfg.partnerId && cfg.partnerId !== ch.id && CHAR_BY_ID[cfg.partnerId] ? cfg.partnerId : null, relayUsed: false, assist: !!cfg.assist, trial: !!cfg.trial,
    phase: 'countdown', t: 0, countdown: COUNTDOWN_T, steps: 0,
    body: newBody(TILE * 2, GROUND_Y), speed: SPEED_TIERS[0], baseSpeed: SPEED_TIERS[0], tier: stage ? stage.tiers[0] : 0,
    biome: stage ? stage.biome : BIOME_ORDER[0],
    hp: ch.maxHp, maxHp: ch.maxHp, iframes: 0, hurtT: 99,
    power: { giant: 0, dash: 0, magnet: 0, after: 0 },
    skillT: skillEvery(ch) * 0.5, skillActive: 0, shield: 0, reviveLeft: ch.revive > 0 ? 1 : 0, rescue: 0,
    letters: BONUS_WORD.map(() => false), bonusStage: 'none', bonusT: 0, bonusSuper: false,
    streak: 0, score: 0, dist: 0,
    level: newLevel(stage ? stage.length : cfg.mode === 'tutorial' ? 1 : 0),
    stats: {
      jellies: 0, bigJellies: 0, coins: 0, potions: 0, powers: 0, letters: 0, hits: 0, hitsBy: {}, falls: 0, smashed: 0,
      bonusTimes: 0, bestStreak: 0, skillUses: 0, jumps: 0, airJumps: 0, slides: 0, jelliesSeen: 0, hpFromPotions: 0,
      drained: 0, nearMisses: 0, maxTier: 0, bonusJellies: 0,
    },
    deathCause: null, lastHit: null, events: [], inputJumpHeld: false, prevSlide: false, lowHpWarned: false, hitstop: 0,
    log: [], lastBits: 0, dyingT: 0,
  };
  if (cfg.mode === 'tutorial') s.level.stageLen = 0;
  // opening straight so the first obstacle is never on screen at "GO"
  placeChunk(s, PARSED_BY_ID.get('landing')!, s.tier, s.biome);
  ensureLevel(s);
  return s;
}

export function charOf(s: RunState): CharacterDef { return CHAR_BY_ID[s.charId] ?? CHAR_BY_ID['hotteok']; }
function skillEvery(ch: CharacterDef): number { return ch.skill.kind === 'none' ? 0 : ch.skill.every; }
function emit(s: RunState, e: SimEvent): void { if (s.events.length < 400) s.events.push(e); }

export function totalScore(s: RunState): number { return s.score + Math.floor(s.dist * SCORE.perMeter); }
export function streakMul(s: RunState): number { return 1 + Math.min(STREAK_MAX, Math.floor(s.streak / STREAK_STEP) * STREAK_BONUS); }
export function jellyPct(s: RunState): number { return s.stats.jelliesSeen > 0 ? Math.round(100 * s.stats.jellies / s.stats.jelliesSeen) : 0; }

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
  if (s.phase === 'dying') { s.dyingT += DT; if (s.dyingT >= 1.2) s.phase = 'over'; return; }
  if (s.phase !== 'run') return;
  if (s.hitstop > 0) {                 // brief freeze on damage (sim-level so replays match); presses stay buffered
    s.hitstop--; if (inp.jump) s.body.buffer = JUMP_BUFFER_T;
    return;
  }

  const ch = charOf(s);
  s.t += DT;
  s.inputJumpHeld = !!inp.jumpHeld;

  // ---- pace: speed/tier/biome switch at chunk boundaries (x − TILE), matching the validator ----
  if (s.bonusStage === 'none') {
    const pc = chunkAt(s.level, s.body.x);
    if (pc && !pc.sky) {
      if (pc.tier > s.tier) emit(s, { t: 'speedUp', tier: pc.tier });
      if (pc.biome !== s.biome) emit(s, { t: 'biome', id: pc.biome });
      s.tier = pc.tier; s.biome = pc.biome; s.baseSpeed = pc.speed;
      s.stats.maxTier = Math.max(s.stats.maxTier, s.tier);
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
    flyStep(s, !!inp.jumpHeld || inp.jump, dx);
    s.bonusT -= DT;
    if (s.bonusT <= 0) exitSky(s);
  } else {
    const bridge = s.rescue > 0 || s.power.giant > 0 || s.power.dash > 0;
    const wasSliding = s.body.sliding;
    const r = stepBody(s.body, { jump: inp.jump, slide: inp.slide }, dx, DT, () => s.level.solids, { maxJumps: ch.maxJumps, glide: ch.glide }, bridge, !!inp.jumpHeld);
    if (r.jumped) { emit(s, { t: 'jump', n: r.jumped }); s.stats.jumps++; if (r.jumped === 2) s.stats.airJumps++; }
    if (r.landed) emit(s, { t: 'land' });
    if (s.body.sliding && !wasSliding) { emit(s, { t: 'slide' }); s.stats.slides++; }
    s.dist += dx / PX_PER_M;   // distance points are added in totalScore()
    if (s.body.y > GROUND_Y + 150) fall(s);
    collideHazards(s);
  }

  collectPickups(s, ch);
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

function fall(s: RunState): void {
  const dmg = s.assist ? FALL_DAMAGE / 2 : FALL_DAMAGE;
  s.hp -= dmg; s.stats.falls++;
  s.lastHit = { kind: 'pit', biome: s.biome, x: s.body.x }; s.hurtT = 0;
  s.body.vy = -RESCUE_BOUNCE_V; s.body.onGround = false; s.body.jumps = 1; s.body.sliding = false;
  s.rescue = RESCUE_BRIDGE_T; s.iframes = Math.max(s.iframes, FALL_IFRAMES);
  s.streak = 0;
  emit(s, { t: 'fall', dmg });
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
      s.streak++; s.stats.bestStreak = Math.max(s.stats.bestStreak, s.streak);
      if (h.near) { s.stats.nearMisses++; s.score += SCORE.nearMiss; emit(s, { t: 'nearMiss', x: (h.x0 + h.x1) / 2, y: h.y0 }); }
      if (s.streak % STREAK_STEP === 0 && s.streak / STREAK_STEP * STREAK_BONUS <= STREAK_MAX + 1e-9) emit(s, { t: 'streak', n: s.streak });
      continue;
    }
    if (h.passed) continue;
    if (!boxesOverlap(near, h)) continue;
    if (!boxesOverlap(hb, h)) { if (s.iframes <= 0) h.near = true; continue; }
    if (powered) {
      h.broken = true; s.stats.smashed++; s.score += SCORE.smash;
      emit(s, { t: 'smash', kind: h.kind, x: (h.x0 + h.x1) / 2, y: Math.max(h.y0, 0) + 20 });
      continue;
    }
    if (s.iframes > 0 || h.touched) { h.near = false; h.touched = true; continue; } // touched while invulnerable = harmless forever
    hitBy(s, h);
  }
}

function hitBy(s: RunState, h: Hazard): void {
  h.broken = true; h.near = false;
  const cx = (h.x0 + h.x1) / 2, cy = Math.max(h.y0, 0) + 20;
  if (s.shield > 0) {
    s.shield--; s.iframes = HIT_IFRAMES * 0.6;
    emit(s, { t: 'hit', kind: h.kind, x: cx, y: cy, dmg: 0, shielded: true });
    return;
  }
  const dmg = s.assist ? HIT_DAMAGE / 2 : HIT_DAMAGE;
  s.hp -= dmg; s.iframes = HIT_IFRAMES; s.hurtT = 0; s.streak = 0; s.hitstop = HITSTOP_STEPS;
  s.stats.hits++; s.stats.hitsBy[h.kind] = (s.stats.hitsBy[h.kind] || 0) + 1;
  s.lastHit = { kind: h.kind, biome: h.biome, x: cx };
  emit(s, { t: 'hit', kind: h.kind, x: cx, y: cy, dmg, shielded: false });
}

function collectPickups(s: RunState, ch: CharacterDef): void {
  const inSky = s.bonusStage === 'sky';
  const pb = hurtbox(s.body, PICK_PAD);
  const magR = s.power.magnet > 0 ? MAGNET_R : ch.magnetR;
  const bx = s.body.x, by = s.body.y - 35 * s.body.scale;
  const mul = streakMul(s);
  for (const p of s.level.pickups) {
    if (p.taken) continue;
    if (p.x > pb.x1 + Math.max(magR, 0) + 40) break;   // pickups are appended in x order
    if (!p.seen && p.x < pb.x0 - 80) { p.seen = true; if (p.type === 'jelly' || p.type === 'big') s.stats.jelliesSeen++; continue; }
    if (magR > 0 && p.type !== 'letter' && p.type !== 'power' && !p.pulled) {
      const ddx = p.x - bx, ddy = p.y - by; if (ddx * ddx + ddy * ddy < magR * magR) p.pulled = true;
    }
    if (p.pulled) {
      const ddx = bx - p.x, ddy = by - p.y; const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;   // sqrt is exact; hypot is not
      const v = Math.min(d, (MAGNET_PULL_V + s.speed) * DT);
      p.x += ddx / d * v; p.y += ddy / d * v;
    }
    if (p.x < pb.x0 || p.x > pb.x1 || p.y < pb.y0 || p.y > pb.y1) continue;
    take(s, p, mul, inSky);
  }
}

function take(s: RunState, p: Pickup, mul: number, inSky: boolean): void {
  p.taken = true;
  let value = 0;
  switch (p.type) {
    case 'jelly': value = Math.round(SCORE.jelly * mul); s.stats.jellies++; if (!p.seen) { p.seen = true; s.stats.jelliesSeen++; } break;
    case 'big': value = Math.round(SCORE.big * mul); s.stats.bigJellies++; s.stats.jellies++; if (!p.seen) { p.seen = true; s.stats.jelliesSeen++; } break;
    case 'bonusJelly': value = SCORE.bonusJelly; s.stats.bonusJellies++; break;
    case 'coin': value = SCORE.coin; s.stats.coins++; break;
    case 'potion': case 'bigPotion': {
      const heal = p.type === 'bigPotion' ? BIG_POTION_HEAL : POTION_HEAL;
      const before = s.hp; s.hp = Math.min(s.maxHp, s.hp + heal); s.stats.hpFromPotions += s.hp - before; s.stats.potions++;
      if (s.hp > s.maxHp * LOW_HP_FRAC) s.lowHpWarned = false;
      break;
    }
    case 'power': startPower(s, p.power!); s.stats.powers++; break;
    case 'letter': {
      value = SCORE.letter; s.letters[p.letter!] = true; s.stats.letters++;
      emit(s, { t: 'pickup', type: p.type, x: p.x, y: p.y, value, letter: p.letter });
      if (s.letters.every(Boolean) && s.bonusStage === 'none') startBonus(s);
      s.score += value;
      return;
    }
  }
  s.score += value;
  emit(s, { t: 'pickup', type: p.type, x: p.x, y: p.y, value, power: p.power });
  void inSky;
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
  emit(s, { t: 'powerEnd', kind: k });
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
  // HP drain (never during bonus)
  if (!inBonus) {
    let drain = DRAIN_BY_TIER[s.tier] * ch.drainMul;
    if (s.t > LATE_DRAIN_START) drain += (s.t - LATE_DRAIN_START) * LATE_DRAIN_PER_S;
    if (s.assist) drain *= 0.8;
    if (s.mode === 'tutorial') drain *= 0.3;
    s.hp -= drain * DT; s.stats.drained += drain * DT;
  }
  if (s.mode === 'tutorial' && s.hp < 30) s.hp = 30;
  if (!s.lowHpWarned && s.hp > 0 && s.hp < s.maxHp * LOW_HP_FRAC) { s.lowHpWarned = true; emit(s, { t: 'lowHp' }); }
  // character skill
  if (ch.skill.kind !== 'none' && !inBonus) {
    if (s.skillActive > 0) s.skillActive = Math.max(0, s.skillActive - DT);
    s.skillT -= DT;
    if (s.skillT <= 0) { s.skillT = ch.skill.every; fireSkill(s, ch); }
  }
}

function fireSkill(s: RunState, ch: CharacterDef): void {
  const sk = ch.skill; s.stats.skillUses++;
  const onScreen = (p: Pickup) => !p.taken && p.x > s.body.x - 60 && p.x < s.body.x + 760;
  switch (sk.kind) {
    case 'jellyBurst': s.skillActive = sk.dur; for (const p of s.level.pickups) if (onScreen(p) && p.type === 'jelly') p.type = 'big'; break;
    case 'coinRain': s.skillActive = sk.dur; for (const p of s.level.pickups) if (onScreen(p) && p.type === 'jelly') p.type = 'coin'; break;
    case 'shield': s.shield = 1; break;
    case 'heal': s.hp = Math.min(s.maxHp, s.hp + sk.amount); break;
    case 'magnet': s.power.magnet = Math.max(s.power.magnet, sk.dur); s.skillActive = sk.dur; break;
    case 'giant': s.power.giant = Math.max(s.power.giant, sk.dur); s.body.scale = GIANT_SCALE; s.skillActive = sk.dur; break;
    case 'none': return;
  }
  emit(s, { t: 'skill', kind: sk.kind });
}

// ---- bonus time ----
function startBonus(s: RunState): void {
  s.bonusSuper = s.hp < s.maxHp * LOW_HP_FRAC;
  s.bonusStage = 'lift'; s.bonusT = BONUS_LIFT_T; s.stats.bonusTimes++;
  s.iframes = Math.max(s.iframes, BONUS_LIFT_T + 0.2);
  emit(s, { t: 'bonusStart' });
}

function enterSky(s: RunState): void {
  const x = s.body.x + 6000;
  restartStreamAt(s, x - 3 * TILE);
  s.bonusStage = 'sky'; s.bonusT = BONUS_T * (s.bonusSuper ? SUPER_BONUS_MUL : 1);
  s.body.x = x; s.body.y = 200; s.body.vy = 0; s.body.onGround = false; s.body.sliding = false; s.body.jumps = 2;
  ensureLevel(s);
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

// ---- death / relay / revive ----
function onZeroHp(s: RunState): void {
  if (s.phase !== 'run') return;
  if (s.deathCause !== 'cap') {
    if (s.reviveLeft > 0) {
      s.reviveLeft--; s.hp = s.maxHp * charOf(s).revive; s.iframes = 2;
      emit(s, { t: 'revive' }); return;
    }
    if (s.partnerId && !s.relayUsed && CHAR_BY_ID[s.partnerId]) {
      const p = CHAR_BY_ID[s.partnerId];
      s.relayUsed = true; s.charId = p.id; s.maxHp = p.maxHp; s.hp = p.maxHp * 0.5; s.iframes = 2;
      s.skillT = skillEvery(p) * 0.5; s.skillActive = 0; s.shield = 0; s.reviveLeft = p.revive > 0 ? 1 : 0; s.lowHpWarned = false;
      if (s.body.y > GROUND_Y) { s.body.y = GROUND_Y - 200; s.body.vy = 0; s.rescue = RESCUE_BRIDGE_T; }
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
  return [s.steps, s.phase, b.x.toFixed(3), b.y.toFixed(3), b.vy.toFixed(3), s.hp.toFixed(4), s.score, s.dist.toFixed(3), s.stats.jellies, s.stats.hits, s.level.genX, s.rng.a, s.rng.b].join('|');
}
