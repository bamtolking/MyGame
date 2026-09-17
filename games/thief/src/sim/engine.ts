// Deterministic fixed-step attempt simulation. No DOM, no wall clock.
// Ghosts are *time projections*: their positions come straight from recorded frames,
// their shots become real projectiles in the current world, and nothing can push or kill them.
import { DEFAULT_ATTEMPT_SECONDS, DEVICE, DT, ENEMY, MAX_GHOSTS, PLAYER, TICK_RATE, WEAPONS, type WeaponId } from './constants';
import { circleRectOverlap, lineOfSight, moveCircle, normalize, segmentHitsRect, type Rect, type Vec } from './geom';
import { laserRect, tileCenter } from './maps';
import { Rng } from './rng';
import { damagePlayer, hurtEnemy, noiseAt, stepEnemies } from './ai';
import type { ActorStats, AttemptOptions, AttemptState, Enemy, GameEvent, Ghost, Laser, MapData, Player, PlayerInput, Projectile, Recording } from './types';


export const ghostLabel = (slot: number): string => `${slot + 1}번 분신`;
export const actorKey = (owner: 'player' | 'ghost', ghost: number): string => (owner === 'player' ? 'player' : `ghost${ghost}`);
export const actorLabel = (key: string): string => (key === 'player' ? '나' : ghostLabel(Number(key.slice(5))));

export function createAttempt(map: MapData, opts: AttemptOptions): AttemptState {
  const def = map.def; const seed = opts.seed ?? def.seed; const seconds = opts.seconds ?? def.seconds ?? DEFAULT_ATTEMPT_SECONDS;
  const sp = tileCenter(def.spawn);
  const player: Player = {
    x: sp.x, y: sp.y, facing: -Math.PI / 2, hp: PLAYER.maxHp, alive: true, deathCause: null, hasCore: false,
    invuln: 0, dashTicks: 0, dashCd: 0, dashDx: 0, dashDy: 0, fireCd: 0, focusGenerator: null, targetKind: null, targetId: null,
    moving: false, recoil: 0, hitFlash: 0, weapon: opts.weapon, vx: 0, vy: 0, kx: 0, ky: 0, finishedAt: -1, steps: 0, grab: 0,
  };
  const stats: Record<string, ActorStats> = { player: { kills: 0, generators: 0, damage: 0, plateTicks: 0, label: '나' } };
  const ghosts: Ghost[] = [];
  opts.ghosts.slice(0, MAX_GHOSTS).forEach((rec, slot) => {
    if (!rec) return;
    if (rec.mapId !== def.id || rec.mapVersion !== def.version) return; // never replay a recording from another map/version
    ghosts.push({ slot, rec, x: sp.x, y: sp.y, facing: -Math.PI / 2, present: false, holding: false, shotCursor: 0, dashCursor: 0, spawnFx: 0, lastTick: -1, moving: false, recoil: 0 });
    stats[`ghost${slot}`] = { kills: 0, generators: 0, damage: 0, plateTicks: 0, label: ghostLabel(slot) };
  });
  let nextId = 1;
  const enemies: Enemy[] = def.enemies.map((e) => {
    const c = tileCenter(e.at);
    return { id: nextId++, kind: e.kind, x: c.x, y: c.y, hx: c.x, hy: c.y, facing: e.facing ?? Math.PI / 2, hp: ENEMY[e.kind].hp, maxHp: ENEMY[e.kind].hp, alive: true, state: 'idle', stateTicks: 0, targetX: c.x, targetY: c.y, contactCd: 0, attackCd: 0, hitFlash: 0, kx: 0, ky: 0, lastSeenTicks: 0, deathTick: -1 };
  });
  const generators = def.generators.map((g) => ({ id: g.id, ...tileCenter(g.at), hp: DEVICE.generatorHp, maxHp: DEVICE.generatorHp, alive: true, destroyedBy: null as string | null, lasers: g.lasers, hitFlash: 0 }));
  const lasers: Laser[] = def.lasers.map((l) => {
    const { rect, horizontal } = laserRect(l.from, l.to);
    const gen = def.generators.find((g) => g.lasers.includes(l.id));
    return { id: l.id, rect, horizontal, source: l.source, phase: l.source.kind === 'generator' ? 'on' : 'off', blink: 0, generatorId: gen ? gen.id : null };
  });
  const plates = def.plates.map((p) => ({ id: p.id, ...tileCenter(p.at), label: p.label, pressed: false, pressedBy: [] as string[], wasPressed: false }));
  const vc = tileCenter(def.vault.at);
  const st: AttemptState = {
    map, tick: 0, maxTicks: Math.round(seconds * TICK_RATE), seed, rng: new Rng(seed),
    player, ghosts, enemies, projectiles: [], generators, lasers, plates,
    vault: { x: vc.x, y: vc.y, open: false, openTicks: 0, corePresent: true, plates: def.vault.plates, generators: def.vault.generators },
    exit: tileCenter(def.exit), outcome: null,
    recording: { v: 1, mapId: def.id, mapVersion: def.version, weapon: opts.weapon, endKind: 'timeout', endTick: 0, pos: [], face: [], shots: [], dashes: [], createdAt: 0 },
    events: [], nextId, stats, damageTaken: 0,
  };
  updateLasers(st, true); updateVault(st);
  return st;
}

export function secondsLeft(st: AttemptState): number { return Math.max(0, (st.maxTicks - st.tick) / TICK_RATE); }

/** Advance one tick (1/60 s). `input` is the current player's input for this tick. No-op once the attempt has an outcome. */
export function stepAttempt(st: AttemptState, input: PlayerInput): void {
  if (st.outcome) return;
  st.events = [];
  st.tick++;
  updateLasers(st, false);
  stepGhosts(st);
  stepPlayer(st, input);
  stepAutoAttack(st);
  stepEnemies(st);
  stepProjectiles(st);
  updatePlates(st);
  updateVault(st);
  updateCoreAndExit(st);
  // Record the current player's own state for this tick (never ghost-derived data).
  const p = st.player;
  st.recording.pos.push(Math.round(p.x * 10), Math.round(p.y * 10));
  st.recording.face.push(Math.round((p.facing * 180) / Math.PI));
  // End conditions, in priority order.
  const left = st.maxTicks - st.tick;
  if (p.alive && p.hasCore && Math.hypot(p.x - st.exit.x, p.y - st.exit.y) <= DEVICE.exitRadius) finish(st, 'escape', null);
  else if (!p.alive) finish(st, 'death', p.deathCause);
  else if (input.finish) { p.finishedAt = st.tick; finish(st, 'finish', null); }
  else if (left <= 0) finish(st, 'timeout', null);
  else if (left % TICK_RATE === 0 && left / TICK_RATE <= 5) st.events.push({ kind: 'timeWarning', secondsLeft: left / TICK_RATE });
}

function finish(st: AttemptState, kind: Recording['endKind'], cause: string | null): void {
  st.outcome = { kind, tick: st.tick, cause };
  st.recording.endKind = kind; st.recording.endTick = st.tick; st.recording.createdAt = Date.now();
  st.events.push(kind === 'escape' ? { kind: 'escape' } : kind === 'timeout' ? { kind: 'timeout' } : kind === 'finish' ? { kind: 'finish' } : { kind: 'playerDied', cause: cause || '' });
}

// ---------------- lasers ----------------
function updateLasers(st: AttemptState, initial: boolean): void {
  for (const l of st.lasers) {
    let phase: Laser['phase'];
    if (l.source.kind === 'generator') { const g = st.generators.find((x) => x.id === l.generatorId); phase = g && g.alive ? 'on' : 'off'; }
    else {
      const { onSec, offSec, offsetSec } = l.source; const warn = DEVICE.laserWarnSec; const cycle = onSec + offSec + warn;
      const t = (((st.tick * DT + offsetSec) % cycle) + cycle) % cycle;
      phase = t < offSec ? 'off' : t < offSec + warn ? 'warn' : 'on';
      l.blink = t < offSec + warn ? (t - offSec) / warn : 0;
    }
    if (phase !== l.phase) { l.phase = phase; if (!initial) st.events.push({ kind: 'laserChanged', id: l.id, phase }); }
  }
}
export const activeLaserRects = (st: AttemptState): Rect[] => st.lasers.filter((l) => l.phase === 'on').map((l) => l.rect);

// ---------------- ghosts ----------------
export function ghostFrame(rec: Recording, tick: number): { x: number; y: number; facing: number; present: boolean; holding: boolean } | null {
  const frames = rec.pos.length >> 1; if (frames === 0) return null;
  const idx = tick - 1;
  if (idx < 0) return null;
  if (idx < frames) return { x: rec.pos[idx * 2] / 10, y: rec.pos[idx * 2 + 1] / 10, facing: (rec.face[idx] * Math.PI) / 180, present: true, holding: false };
  if (rec.endKind === 'finish' || rec.endKind === 'escape') { const l = frames - 1; return { x: rec.pos[l * 2] / 10, y: rec.pos[l * 2 + 1] / 10, facing: (rec.face[l] * Math.PI) / 180, present: true, holding: true }; }
  return { x: 0, y: 0, facing: 0, present: false, holding: false };
}

function stepGhosts(st: AttemptState): void {
  for (const g of st.ghosts) {
    const f = ghostFrame(g.rec, st.tick);
    const wasPresent = g.present;
    if (!f || !f.present) {
      if (wasPresent) { g.present = false; st.events.push({ kind: 'ghostGone', ghost: g.slot, endKind: g.rec.endKind }); }
      g.moving = false; continue;
    }
    g.moving = g.present && (Math.abs(f.x - g.x) > 0.01 || Math.abs(f.y - g.y) > 0.01);
    g.x = f.x; g.y = f.y; g.facing = f.facing; g.present = true;
    if (!wasPresent) { g.spawnFx = 30; st.events.push({ kind: 'ghostSpawn', ghost: g.slot, x: g.x, y: g.y }); }
    if (f.holding && !g.holding) { g.holding = true; st.events.push({ kind: 'ghostHold', ghost: g.slot }); }
    if (g.spawnFx > 0) g.spawnFx--;
    if (g.recoil > 0) g.recoil--;
    // Replay recorded dashes (visual only: the trajectory already contains the dash movement).
    while (g.dashCursor < g.rec.dashes.length && g.rec.dashes[g.dashCursor] <= st.tick) { if (g.rec.dashes[g.dashCursor] === st.tick) st.events.push({ kind: 'dash', owner: 'ghost', ghost: g.slot, x: g.x, y: g.y }); g.dashCursor++; }
    // Replay recorded shots as *real* projectiles at the recorded position and angles. No re-targeting, ever.
    while (g.shotCursor < g.rec.shots.length && g.rec.shots[g.shotCursor].t <= st.tick) {
      const s = g.rec.shots[g.shotCursor]; g.shotCursor++;
      if (s.t !== st.tick || f.holding) continue;
      const w = WEAPONS[s.w]; if (!w) continue;
      for (const a of s.a) spawnBullet(st, 'ghost', g.slot, s.x, s.y, a, w.id);
      noiseAt(st, s.x, s.y); g.recoil = 4;
      st.events.push({ kind: 'shot', owner: 'ghost', ghost: g.slot, x: s.x, y: s.y, weapon: s.w, angle: s.a[0] });
    }
  }
}

function spawnBullet(st: AttemptState, owner: 'player' | 'ghost', ghost: number, x: number, y: number, angle: number, weapon: WeaponId): void {
  const w = WEAPONS[weapon];
  const ox = x + Math.cos(angle) * (PLAYER.radius + 2), oy = y + Math.sin(angle) * (PLAYER.radius + 2);
  st.projectiles.push({ id: st.nextId++, owner, ghost, x: ox, y: oy, px: x, py: y, vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed, life: w.lifeTicks, damage: w.damage, radius: w.radius, weapon, knockback: w.knockback });
}

// ---------------- player ----------------
function stepPlayer(st: AttemptState, input: PlayerInput): void {
  const p = st.player; if (!p.alive) return;
  if (p.invuln > 0) p.invuln--; if (p.dashCd > 0) p.dashCd--; if (p.fireCd > 0) p.fireCd--; if (p.recoil > 0) p.recoil--; if (p.hitFlash > 0) p.hitFlash--;
  let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const wantMove = ml > 0.08;
  if (input.dash && p.dashCd <= 0 && p.dashTicks <= 0) {
    const dir = wantMove ? normalize(mx, my) : { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    p.dashTicks = Math.round(PLAYER.dashDurationSec * TICK_RATE); p.dashCd = Math.round(PLAYER.dashCooldownSec * TICK_RATE); p.dashDx = dir.x; p.dashDy = dir.y;
    st.recording.dashes.push(st.tick); st.events.push({ kind: 'dash', owner: 'player', ghost: -1, x: p.x, y: p.y });
  }
  let vx: number, vy: number;
  if (p.dashTicks > 0) { p.dashTicks--; vx = p.dashDx * PLAYER.dashSpeed; vy = p.dashDy * PLAYER.dashSpeed; }
  else if (wantMove) { vx = mx * PLAYER.speed; vy = my * PLAYER.speed; }
  else { vx = 0; vy = 0; }
  p.vx = vx; p.vy = vy; p.moving = vx !== 0 || vy !== 0;
  const dx = (vx + p.kx) * DT, dy = (vy + p.ky) * DT; p.kx *= 0.8; p.ky *= 0.8;
  if (Math.abs(p.kx) < 1) p.kx = 0; if (Math.abs(p.ky) < 1) p.ky = 0;
  const solids = st.map.solids.concat(activeLaserRects(st)); // active lasers block the *current player* only
  const np = moveCircle(p, PLAYER.radius, dx, dy, solids, st.map.bounds);
  p.x = np.x; p.y = np.y;
  // Heavy guards are solid to the current player: you go around them (or through them once they are down).
  for (const e of st.enemies) {
    if (!e.alive || e.kind !== 'heavy') continue; const R = ENEMY.heavy.radius + PLAYER.radius; const ex = p.x - e.x, ey = p.y - e.y; const d = Math.hypot(ex, ey);
    if (d < R && d > 1e-6) { const push = moveCircle(p, PLAYER.radius, (ex / d) * (R - d), (ey / d) * (R - d), solids, st.map.bounds); p.x = push.x; p.y = push.y; if (p.dashTicks > 0) p.dashTicks = 0; }
  }
  if (p.moving && p.dashTicks <= 0) { p.steps += Math.hypot(dx, dy); p.facing = Math.atan2(vy, vx); }
  // Laser contact: touching an active beam hurts and pushes you off it.
  for (const l of st.lasers) {
    if (l.phase !== 'on') continue;
    if (circleRectOverlap(p.x, p.y, PLAYER.radius + 2.5, l.rect)) {
      const cx = l.rect.x + l.rect.w / 2, cy = l.rect.y + l.rect.h / 2;
      const fromX = l.horizontal ? p.x : cx, fromY = l.horizontal ? cy : p.y;
      if (p.invuln <= 0 && p.dashTicks <= 0) damagePlayer(st, DEVICE.laserDamage, '레이저', fromX, fromY, 260);
      else if (p.dashTicks > 0) { p.dashTicks = 0; }
    }
  }
  // Interact: toggle generator focus when near one; the vault/core is picked up by touch.
  if (input.interact) {
    const g = nearestGenerator(st, PLAYER.interactRange);
    if (g) p.focusGenerator = p.focusGenerator === g.id ? null : g.id;
  }
  if (p.focusGenerator) {
    const g = st.generators.find((x) => x.id === p.focusGenerator);
    if (!g || !g.alive || Math.hypot(g.x - p.x, g.y - p.y) > PLAYER.interactRange * 1.7) p.focusGenerator = null;
  }
}
export function nearestGenerator(st: AttemptState, range: number): AttemptState['generators'][number] | null {
  let best = null as AttemptState['generators'][number] | null; let bd = range;
  for (const g of st.generators) { if (!g.alive) continue; const d = Math.hypot(g.x - st.player.x, g.y - st.player.y); if (d < bd) { bd = d; best = g; } }
  return best;
}

/** Pick the auto-attack target: nearest visible enemy in range, generators as fallback, or the focused generator first. */
export function pickTarget(st: AttemptState): { kind: 'enemy' | 'generator'; x: number; y: number; id: number | string } | null {
  const p = st.player; const w = WEAPONS[p.weapon]; const solids = st.map.solids;
  let bestE: Enemy | null = null, bdE = Infinity;
  for (const e of st.enemies) {
    if (!e.alive) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - ENEMY[e.kind].radius;
    if (d > w.range) continue;
    // Threat order: turrets are always worth shooting first; a post-guard heavy far from you is not a threat yet.
    let score = d; if (e.kind === 'turret') score -= 80; if (e.kind === 'heavy' && d > ENEMY.heavy.swingRange + 30) score += 400;
    if (score < bdE && lineOfSight(p, e, solids)) { bdE = score; bestE = e; }
  }
  let bestG: AttemptState['generators'][number] | null = null, bdG = Infinity;
  for (const g of st.generators) {
    if (!g.alive) continue; const d = Math.hypot(g.x - p.x, g.y - p.y) - DEVICE.generatorRadius;
    if (d <= w.range && d < bdG && lineOfSight(p, g, solids)) { bdG = d; bestG = g; }
  }
  if (p.focusGenerator) { const g = st.generators.find((x) => x.id === p.focusGenerator); if (g && g.alive && Math.hypot(g.x - p.x, g.y - p.y) - DEVICE.generatorRadius <= w.range && lineOfSight(p, g, solids)) return { kind: 'generator', x: g.x, y: g.y, id: g.id }; }
  if (bestE) return { kind: 'enemy', x: bestE.x, y: bestE.y, id: bestE.id };
  if (bestG) return { kind: 'generator', x: bestG.x, y: bestG.y, id: bestG.id };
  return null;
}

function stepAutoAttack(st: AttemptState): void {
  const p = st.player; if (!p.alive || p.dashTicks > 0) { p.targetKind = null; p.targetId = null; return; }
  const t = pickTarget(st);
  p.targetKind = t ? t.kind : null; p.targetId = t ? t.id : null;
  if (!t) return;
  const angle = Math.atan2(t.y - p.y, t.x - p.x);
  if (!p.moving) p.facing = angle;
  if (p.fireCd > 0) return;
  const w = WEAPONS[p.weapon]; p.fireCd = w.intervalTicks; p.recoil = 5; p.facing = angle;
  const angles: number[] = [];
  for (let i = 0; i < w.pellets; i++) angles.push(angle + (w.pellets === 1 ? st.rng.range(-w.spreadRad, w.spreadRad) : ((i / (w.pellets - 1)) - 0.5) * 2 * w.spreadRad + st.rng.range(-0.05, 0.05)));
  for (const a of angles) spawnBullet(st, 'player', -1, p.x, p.y, a, w.id);
  noiseAt(st, p.x, p.y);
  st.recording.shots.push({ t: st.tick, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, w: w.id, a: angles.map((a) => Math.round(a * 1000) / 1000) });
  st.events.push({ kind: 'shot', owner: 'player', ghost: -1, x: p.x, y: p.y, weapon: w.id, angle });
}

// ---------------- projectiles ----------------
function segCircleDist(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t - cx, ay + dy * t - cy);
}
function stepProjectiles(st: AttemptState): void {
  const solids = st.map.solids; const keep: Projectile[] = [];
  for (const b of st.projectiles) {
    b.px = b.x; b.py = b.y; b.x += b.vx * DT; b.y += b.vy * DT; b.life--;
    let dead = false;
    for (const s of solids) if (segmentHitsRect(b.px, b.py, b.x, b.y, s)) { dead = true; st.events.push({ kind: 'hit', x: b.px, y: b.py, target: 'wall', owner: b.owner, ghost: b.ghost }); break; }
    if (!dead && b.x < 0 || b.x > st.map.width || b.y < 0 || b.y > st.map.height) dead = true;
    if (!dead && (b.owner === 'player' || b.owner === 'ghost')) {
      const actor = actorKey(b.owner, b.ghost);
      let bestD = Infinity; let hitE: Enemy | null = null;
      for (const e of st.enemies) { if (!e.alive) continue; const d = segCircleDist(b.px, b.py, b.x, b.y, e.x, e.y); if (d <= ENEMY[e.kind].radius + b.radius && d < bestD) { bestD = d; hitE = e; } }
      let hitG: AttemptState['generators'][number] | null = null;
      for (const g of st.generators) { if (!g.alive) continue; const d = segCircleDist(b.px, b.py, b.x, b.y, g.x, g.y); if (d <= DEVICE.generatorRadius + b.radius && d < bestD) { bestD = d; hitG = g; hitE = null; } }
      if (hitE) {
        const ev = hurtEnemy(st, hitE, b.damage, b.vx, b.vy, b.knockback, b.px, b.py, actor);
        st.events.push({ kind: 'hit', x: b.x, y: b.y, target: 'enemy', owner: b.owner, ghost: b.ghost }); if (ev) st.events.push(ev); dead = true;
      } else if (hitG) {
        hitG.hp -= b.damage; hitG.hitFlash = 6; st.stats[actor].damage += b.damage; dead = true;
        st.events.push({ kind: 'hit', x: b.x, y: b.y, target: 'generator', owner: b.owner, ghost: b.ghost });
        if (hitG.hp <= 0) { hitG.hp = 0; hitG.alive = false; hitG.destroyedBy = actor; st.stats[actor].generators++; st.events.push({ kind: 'generatorDestroyed', id: hitG.id, x: hitG.x, y: hitG.y, by: actor, lasers: hitG.lasers }); updateLasers(st, false); }
      }
    } else if (!dead && b.owner === 'enemy') {
      const p = st.player;
      if (p.alive && segCircleDist(b.px, b.py, b.x, b.y, p.x, p.y) <= PLAYER.radius + b.radius) {
        if (p.dashTicks > 0 || p.invuln > 0) { /* passes through while invulnerable; still consumed to read clearly */ dead = true; }
        else { damagePlayer(st, b.damage, '포탑 탄환', b.px, b.py, b.knockback); st.events.push({ kind: 'hit', x: b.x, y: b.y, target: 'player', owner: 'enemy', ghost: -1 }); dead = true; }
      }
    }
    if (!dead && b.life > 0) keep.push(b);
  }
  st.projectiles = keep;
}

// ---------------- devices ----------------
function updatePlates(st: AttemptState): void {
  const p = st.player;
  for (const pl of st.plates) {
    const by: string[] = [];
    if (p.alive && Math.hypot(p.x - pl.x, p.y - pl.y) <= DEVICE.plateRadius) { by.push('player'); st.stats.player.plateTicks++; }
    for (const g of st.ghosts) if (g.present && Math.hypot(g.x - pl.x, g.y - pl.y) <= DEVICE.plateRadius) { by.push(`ghost${g.slot}`); st.stats[`ghost${g.slot}`].plateTicks++; }
    const pressed = by.length > 0;
    if (pressed !== pl.pressed || by.join() !== pl.pressedBy.join()) { if (pressed !== pl.pressed) st.events.push({ kind: 'plateChanged', id: pl.id, pressed, by }); pl.pressed = pressed; pl.pressedBy = by; }
  }
}
export function vaultConditionsMet(st: AttemptState): boolean {
  for (const id of st.vault.plates) { const pl = st.plates.find((x) => x.id === id); if (!pl || !pl.pressed) return false; }
  for (const id of st.vault.generators) { const g = st.generators.find((x) => x.id === id); if (!g || g.alive) return false; }
  return true;
}
function updateVault(st: AttemptState): void {
  const v = st.vault; const met = vaultConditionsMet(st);
  if (met) v.openTicks = Math.round(DEVICE.vaultCloseDelaySec * TICK_RATE); else if (v.openTicks > 0) v.openTicks--;
  const open = met || v.openTicks > 0;
  if (open !== v.open) { v.open = open; st.events.push({ kind: 'vaultChanged', open }); }
}
function updateCoreAndExit(st: AttemptState): void {
  const p = st.player; const v = st.vault;
  const near = p.alive && v.open && v.corePresent && Math.hypot(p.x - v.x, p.y - v.y) <= DEVICE.vaultRadius + PLAYER.coreRange;
  if (near) { p.grab++; if (p.grab >= Math.round(PLAYER.coreGrabSec * TICK_RATE)) { v.corePresent = false; p.hasCore = true; p.grab = 0; st.events.push({ kind: 'corePicked' }); } }
  else p.grab = 0;
}

/** Convenience for tests/tools: run the attempt to completion with an input provider. */
export function runAttempt(st: AttemptState, inputAt: (tick: number, st: AttemptState) => PlayerInput, collect?: (ev: GameEvent[], tick: number) => void): AttemptState {
  while (!st.outcome) { stepAttempt(st, inputAt(st.tick + 1, st)); if (collect) collect(st.events, st.tick); }
  return st;
}

export const playerPos = (st: AttemptState): Vec => ({ x: st.player.x, y: st.player.y });
