'use strict';
// ===================== 스킬 계산 (젬 + 서포트 + 캐릭터 스탯) =====================
function computeSkill(p, slotIdx) {
  const sock = p.sockets[slotIdx]; if (!sock || !sock.main) return null;
  const gem = sock.main, def = GEMS[gem.id], st = p.stats;
  const sups = sock.supports.filter(s => s && supportFits(SUPPORTS[s.id], def));
  const sm = {}; const flags = new Set(); const supAilments = {};
  const lvlMult = gemLevelMult(gem);
  for (const s of sups) {
    const sd = SUPPORTS[s.id]; const sc = supportScale(s);
    for (const k in sd.mods) {
      const v = sd.mods[k];
      if (typeof v === 'number') sm[k] = (sm[k] || 0) + (['proj', 'chain', 'pierce'].includes(k) ? v : v * sc);
      else { sm[k] = sm[k] || { min: 0, max: 0 }; const gl = 1 + 0.12 * (s.level - 1); sm[k].min += v.min * gl; sm[k].max += v.max * gl; }
    }
    if (sd.flag) flags.add(sd.flag);
    if (sd.ailment) Object.assign(supAilments, sd.ailment);
  }
  const tags = def.tags; const isAttack = def.type === 'attack';
  const base = { phys: [0, 0], fire: [0, 0], cold: [0, 0], light: [0, 0], chaos: [0, 0] };
  if (isAttack) {
    const w = p.equipment.weapon; const eff = def.eff * (1 + 0.04 * (gem.level - 1));
    const wmin = w ? w.props.min : 2, wmax = w ? w.props.max : 4;
    base.phys = [wmin * eff, wmax * eff];
    for (const m of st.adds.weapon) { const t = m.k.slice(4); base[t][0] += m.min * eff; base[t][1] += m.max * eff; }
    for (const m of st.adds.other) { const t = m.k.slice(4); base[t][0] += m.min * eff; base[t][1] += m.max * eff; }
  } else {
    for (const t in def.base) base[t] = [def.base[t][0] * lvlMult, def.base[t][1] * lvlMult];
    for (const m of st.adds.other) { const t = m.k.slice(4); base[t][0] += m.min * 0.5; base[t][1] += m.max * 0.5; }
  }
  for (const k in sm) if (k.startsWith('add_')) { const t = k.slice(4); base[t][0] += sm[k].min; base[t][1] += sm[k].max; }
  if (sm.phys_as_fire) { base.fire[0] += base.phys[0] * sm.phys_as_fire; base.fire[1] += base.phys[1] * sm.phys_as_fire; }
  if (st.aspects.has('abyssal')) { base.chaos[0] += base.phys[0] * 0.25; base.chaos[1] += base.phys[1] * 0.25; }
  const inc = st.inc; const g = k => (inc[k] || 0) + (sm[k] || 0);
  const common = g('inc_dmg') + (isAttack ? g('inc_attack') : g('inc_spell'))
    + (tags.includes('projectile') ? g('inc_proj') : 0) + (tags.includes('melee') ? g('inc_melee') : 0)
    + (tags.includes('aoe') ? g('inc_aoe_dmg') : 0) + (tags.includes('dot') ? g('inc_dot') : 0);
  const typeInc = { phys: g('inc_phys'), fire: g('inc_fire') + g('inc_ele'), cold: g('inc_cold') + g('inc_ele'), light: g('inc_light') + g('inc_ele'), chaos: g('inc_chaos') };
  const moreAll = st.more.dmg * (1 + (sm.more_dmg || 0));
  const dmg = {}; let avg = 0;
  for (const t of DMG_TYPES) {
    let m = Math.max(0, 1 + common + typeInc[t]) * moreAll;
    if (t === 'phys') m *= st.more.phys * (1 + (sm.more_phys || 0));
    if (ELE_TYPES.includes(t)) m *= st.more.ele * (1 + (sm.more_ele || 0));
    if (flags.has('noEle') && t !== 'phys') m = 0;
    dmg[t] = { type: t, min: base[t][0] * m, max: base[t][1] * m };
    avg += (dmg[t].min + dmg[t].max) / 2;
  }
  const wAps = p.equipment.weapon ? p.equipment.weapon.props.aps : 1.3;
  let time = isAttack ? def.time / (wAps / 1.3) / Math.max(0.2, 1 + g('inc_aspd')) : def.time / Math.max(0.2, 1 + g('inc_cspd'));
  time = Math.max(0.08, time);
  const critChance = st.flags.has('no_crit') ? 0 : clamp(st.critBase * (1 + st.incCrit + (sm.inc_crit || 0)), 0, 0.95);
  const critMulti = st.flags.has('ele_overload') ? 1 : st.critMulti + (sm.crit_multi || 0);
  const cost = Math.max(0, Math.round(def.cost * (1 + 0.02 * (gem.level - 1)) * (1 - Math.min(0.85, st.reducedCost + (sm.reduced_cost || 0)))));
  const projCount = def.proj ? def.proj.count + st.proj + (sm.proj || 0) : 0;
  const chain = def.proj ? (def.proj.chain || 0) + st.chain + (sm.chain || 0) : 0;
  const pierce = def.proj ? (def.proj.pierce || 0) + st.pierce + (sm.pierce || 0) : 0;
  const aoeMult = Math.sqrt(Math.max(0.2, 1 + st.incAoe + (sm.inc_aoe || 0)));
  const projSpeedMult = 1 + g('inc_proj_speed');
  const leech = st.leech + (sm.leech || 0) + (def.leech || 0);
  let ailments = Object.assign({}, def.ailment || {}, supAilments);
  if (flags.has('noAilment')) ailments = {};
  if (st.flags.has('all_ignite')) ailments.ignite = Math.max(ailments.ignite || 0, 1);
  const dps = avg * (1 + critChance * (critMulti - 1)) / time;
  return { def, gem, slot: slotIdx, dmg, time, cost, cd: def.cd || 0, critChance, critMulti, projCount, chain, pierce, aoeMult, projSpeedMult, leech, ailments, flags, supports: sups, tags, isAttack, knock: def.knock || 0, stun: def.stun || 0, dps, avg, minionInc: g('inc_minion'), gain: def.gain || 0 };
}

// ===================== 스킬 실행 =====================
const Skills = {
  use(p, slot, tx, ty, opts = {}) {
    const sk = computeSkill(p, slot); if (!sk) return false;
    if (!opts.echo) {
      if (p.castTimer > 0) return false;
      if ((p.cooldowns[slot] || 0) > 0) return false;
      if (p.frozen > 0) return false;
      if (p.ult.active && p.cls === 'vampire') Ult.end(p);
      const cost = sk.cost;
      if (p.stats.flags.has('blood_magic')) { if (p.hp <= cost + 1) { Game.flash('생명력 부족'); return false; } p.hp -= cost; }
      else { if (p.res < cost) { Game.flash(`${CLASSES[p.cls].resource.name} 부족`); return false; } p.res -= cost; }
      p.castTimer = sk.time; p.cooldowns[slot] = sk.cd;
      p.rootTimer = sk.def.kind === 'nova' ? sk.time * 0.4 : 0;
      p.slowTimer = sk.time;
      if (sk.flags.has('repeat') && !sk.def.channel) p.echoQueue.push({ slot, tx, ty, t: Math.min(0.18, sk.time * 0.5) });
    }
    p.facing = angleTo(p.x, p.y, tx, ty);
    p.lastSkillT = 0;
    this.execute(p, sk, tx, ty);
    if (sk.def.sfx) Audio_.play(sk.def.sfx);
    return true;
  },
  execute(p, sk, tx, ty) {
    const d = sk.def;
    switch (d.kind) {
      case 'projectile': this.spawnProjectiles(p, sk, p.x, p.y, tx, ty); break;
      case 'melee': this.melee(p, sk, tx, ty); break;
      case 'aoe': {
        const dd = Math.min(d.aoe.maxRange, dist(p.x, p.y, tx, ty)); const a = angleTo(p.x, p.y, tx, ty);
        const x = p.x + Math.cos(a) * dd, y = p.y + Math.sin(a) * dd;
        World.addZone({ type: 'telegraph', owner: 'player', x, y, r: d.aoe.radius * sk.aoeMult, t: 0, dur: d.aoe.delay, color: d.color, light: d.light,
          onDone: z => { Combat.areaHit(z.x, z.y, z.r, sk, { knock: sk.knock }); World.burst(z.x, z.y, d.color, 26, 220, 0.5); Audio_.play('explode'); Game.shake(5); } });
        break;
      }
      case 'nova': {
        let r = d.nova.radius * sk.aoeMult; let mult = 1;
        if (d.missingLifeBonus) mult += d.missingLifeBonus * (1 - p.hp / p.stats.maxLife);
        Combat.areaHit(p.x, p.y, r, sk, { knock: sk.knock, mult });
        World.addZone({ type: 'ring', x: p.x, y: p.y, r, t: 0, dur: 0.35, color: d.color });
        World.burst(p.x, p.y, d.color, 30, 300, 0.5); Game.shake(4);
        break;
      }
      case 'beam': {
        const a = angleTo(p.x, p.y, tx, ty); const range = d.beam.range * sk.aoeMult;
        const ex = p.x + Math.cos(a) * range, ey = p.y + Math.sin(a) * range;
        World.addZone({ type: 'beam', x: p.x, y: p.y, x2: ex, y2: ey, t: 0, dur: 0.15, color: d.color, w: d.beam.width });
        for (const m of World.monsters) {
          if (!m.alive) continue;
          // 선분-원 거리
          const dx = ex - p.x, dy = ey - p.y; const len2 = dx * dx + dy * dy;
          let t = ((m.x - p.x) * dx + (m.y - p.y) * dy) / len2; t = clamp(t, 0, 1);
          const cx = p.x + dx * t, cy = p.y + dy * t;
          if (dist(cx, cy, m.x, m.y) < m.r + d.beam.width / 2) Combat.hitMonster(m, sk, { srcX: p.x, srcY: p.y });
        }
        break;
      }
      case 'ground': {
        const dd = Math.min(d.ground.maxRange, dist(p.x, p.y, tx, ty)); const a = angleTo(p.x, p.y, tx, ty);
        World.addZone({ type: 'ground', owner: 'player', x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd, r: d.ground.radius * sk.aoeMult, t: 0, dur: d.ground.duration, tick: d.ground.tick, tickT: 0, skill: sk, slow: d.ground.slow || 0, color: d.color });
        break;
      }
      case 'summon': {
        const alive = World.minions.filter(m => m.alive && m.owner === p);
        if (alive.length >= d.summon.max) { const old = alive[0]; old.alive = false; }
        World.minions.push(new Minion(p, sk, d.summon.duration));
        World.burst(p.x, p.y, d.color, 16, 120, 0.6);
        break;
      }
      case 'storm': {
        const dd = Math.min(d.storm.maxRange, dist(p.x, p.y, tx, ty)); const a = angleTo(p.x, p.y, tx, ty);
        World.addZone({ type: 'storm', owner: 'player', x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd, r: d.storm.radius * sk.aoeMult, t: 0, dur: d.storm.duration, strikes: d.storm.strikes, strikeR: d.storm.strikeRadius * sk.aoeMult, next: 0, skill: sk, color: d.color });
        break;
      }
      case 'dash': {
        const a = angleTo(p.x, p.y, tx, ty); const step = 10; let x = p.x, y = p.y; const hit = new Set();
        for (let s = 0; s < d.dash.dist; s += step) {
          const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
          if (World.wallAtCircle(nx, ny, p.r)) break;
          x = nx; y = ny;
          for (const m of World.monsters) if (m.alive && !hit.has(m) && dist(x, y, m.x, m.y) < m.r + 26) { hit.add(m); Combat.hitMonster(m, sk, { srcX: x, srcY: y }); }
          if (s % 30 === 0) World.particles.push(new Particle(x, y, 0, 0, 0.35, d.color, 6));
        }
        p.x = x; p.y = y; p.invuln = Math.max(p.invuln, 0.15);
        break;
      }
    }
  },
  spawnProjectiles(p, sk, sx, sy, tx, ty, ownerOverride) {
    const d = sk.def; const n = Math.max(1, sk.projCount);
    const baseAng = angleTo(sx, sy, tx, ty);
    const spread = d.proj.spread ? d.proj.spread * (n / d.proj.count) : Math.min(1.0, 0.13 * (n - 1));
    for (let i = 0; i < n; i++) {
      const ang = baseAng + (n > 1 ? -spread / 2 + spread * i / (n - 1) : 0);
      const spd = d.proj.speed * sk.projSpeedMult;
      World.projectiles.push(new Projectile({
        x: sx, y: sy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, owner: ownerOverride || 'player', ownerRef: p, skill: sk,
        r: d.proj.size, range: d.proj.range * (d.proj.boomerang ? 1 : (1 + (sk.projSpeedMult - 1) * 0.5)), pierce: sk.pierce, chain: sk.chain,
        explode: d.proj.explode ? d.proj.explode * sk.aoeMult : 0, boomerang: !!d.proj.boomerang, light: !!d.light, color: d.color,
      }));
    }
  },
  melee(p, sk, tx, ty) {
    const d = sk.def; const a = angleTo(p.x, p.y, tx, ty); const range = d.melee.range * (sk.tags.includes('aoe') ? sk.aoeMult : 1) + p.r;
    World.addZone({ type: 'slash', x: p.x, y: p.y, a, arc: d.melee.arc, r: range, t: 0, dur: 0.18, color: d.color });
    let hitAny = false; const hitSet = new Set();
    for (const m of World.monsters) {
      if (!m.alive) continue;
      const dd = dist(p.x, p.y, m.x, m.y);
      if (dd > range + m.r) continue;
      if (d.melee.arc < 6 && Math.abs(angleDiff(a, angleTo(p.x, p.y, m.x, m.y))) > d.melee.arc / 2) continue;
      hitSet.add(m); hitAny = true;
      Combat.hitMonster(m, sk, { srcX: p.x, srcY: p.y, knock: sk.knock, stun: sk.stun, executeMult: d.executeMult });
    }
    if (sk.flags.has('splash')) {
      for (const m of hitSet) for (const o of World.monsters) if (o.alive && !hitSet.has(o) && dist(m.x, m.y, o.x, o.y) < 60 * sk.aoeMult + o.r) { hitSet.add(o); Combat.hitMonster(o, sk, { srcX: p.x, srcY: p.y, mult: 0.7 }); }
    }
    if (hitAny) { p.rootTimer = Math.max(p.rootTimer, sk.time * 0.4); if (sk.gain) p.gainRes(sk.gain); }
  },
};

// ===================== 종족 궁극기 =====================
const Ult = {
  use(p) {
    if (p.ult.cd > 0 || p.ult.active) return false;
    const u = CLASSES[p.cls].ult;
    p.ult.active = true; p.ult.t = u.dur; p.ult.cd = u.cd; p.ult.tick = 0;
    p.recalc();
    Audio_.play('ult');
    Game.announce(u.name + '!', CLASSES[p.cls].color);
    World.burst(p.x, p.y, CLASSES[p.cls].color, 40, 260, 0.8);
    return true;
  },
  update(p, dt) {
    if (p.ult.cd > 0) p.ult.cd -= dt;
    if (!p.ult.active) return;
    p.ult.t -= dt; p.ult.tick += dt;
    if (p.cls === 'vampire') {
      p.invuln = Math.max(p.invuln, 0.1);
      if (p.ult.tick > 0.1) { p.ult.tick = 0; World.particles.push(new Particle(p.x + rand(-10, 10), p.y + rand(-10, 10), rand(-20, 20), rand(-40, -10), 0.5, '#e63946', 4)); }
      for (const m of World.monsters) if (m.alive && dist(p.x, p.y, m.x, m.y) < m.r + p.r + 10 && !m.bleed) Combat.applyAilmentRaw(m, 'bleed', p.stats.maxLife * 0.1, 4);
    } else if (p.cls === 'ouster') {
      if (p.ult.tick > 0.25) {
        p.ult.tick = 0;
        const dmgBase = 8 + p.level * 2.5;
        for (const m of World.monsters) if (m.alive && dist(p.x, p.y, m.x, m.y) < 150 + m.r) {
          const packet = { cold: dmgBase * (1 + p.stats.inc.inc_dmg + p.stats.inc.inc_spell + p.stats.inc.inc_ele) * p.stats.more.dmg * p.stats.more.ele, light: dmgBase * 0.7 * (1 + p.stats.inc.inc_dmg + p.stats.inc.inc_spell + p.stats.inc.inc_ele) * p.stats.more.dmg * p.stats.more.ele, crit: false };
          Combat.damageMonster(m, packet, { src: p, tags: ['spell', 'aoe'], ailments: { chill: 1, shock: 1 }, knockAngle: angleTo(p.x, p.y, m.x, m.y) + Math.PI / 2, knock: 80 });
        }
        for (let i = 0; i < 6; i++) { const a = rand(Math.PI * 2), r = rand(60, 150); World.particles.push(new Particle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, Math.cos(a + 1.6) * 120, Math.sin(a + 1.6) * 120, 0.5, choice(['#a2d2ff', '#ffe94d', '#ffffff']), 4)); }
      }
    }
    if (p.ult.t <= 0) this.end(p);
  },
  end(p) { if (!p.ult.active) return; p.ult.active = false; p.recalc(); },
};
