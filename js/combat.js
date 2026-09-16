'use strict';
// ===================== 전투 판정 =====================
const Combat = {
  rollPacket(sk, mult = 1) {
    const packet = {}; let crit = false;
    if (sk.critChance > 0 && chance(sk.critChance)) crit = true;
    const cm = crit ? sk.critMulti : 1;
    const p = Game.player;
    const timeMult = 1 + this.timeBonus(p);
    const martyr = p.stats.aspects.has('martyr') ? 1 + 0.4 * (p.res / p.stats.maxRes) : 1;
    for (const t of DMG_TYPES) { const d = sk.dmg[t]; if (!d || d.max <= 0) continue; packet[t] = rand(d.min, d.max) * cm * mult * timeMult * martyr; }
    packet.crit = crit; return packet;
  },
  timeBonus(p) {
    let b = Clock.classBonus(p.cls, p.stats.inc);
    if (p.stats.aspects.has('dawn_verdict') && Clock.isDay()) b *= 2;
    return b;
  },
  hitMonster(mon, sk, opts = {}) {
    if (!mon.alive) return;
    const packet = this.rollPacket(sk, opts.mult || 1);
    let knockAngle = 0;
    if (opts.srcX !== undefined) knockAngle = angleTo(opts.srcX, opts.srcY, mon.x, mon.y);
    this.damageMonster(mon, packet, { src: Game.player, skill: sk, tags: sk.tags, ailments: sk.ailments, knock: opts.knock || 0, knockAngle, stun: opts.stun || 0, executeMult: opts.executeMult, leech: sk.leech, minion: opts.minion, isAttack: sk.isAttack });
  },
  areaHit(x, y, r, sk, opts = {}) {
    for (const m of World.monstersNear(x, y, r + 30)) {
      if (!m.alive) continue; if (opts.exclude && opts.exclude.has(m)) continue;
      if (dist(x, y, m.x, m.y) > r + m.r) continue;
      this.hitMonster(m, sk, { srcX: x, srcY: y, knock: opts.knock || 0, mult: opts.mult || 1 });
    }
  },
  areaHitRaw(x, y, r, packet, opts = {}) {
    for (const m of World.monstersNear(x, y, r + 30)) {
      if (!m.alive || m === opts.exclude) continue;
      if (dist(x, y, m.x, m.y) > r + m.r) continue;
      this.damageMonster(m, Object.assign({ crit: false }, packet), { src: Game.player, tags: opts.tags || [], knock: opts.knock || 0, knockAngle: angleTo(x, y, m.x, m.y), noProc: true, ailments: opts.ailments });
    }
  },
  damageMonster(mon, packet, opts = {}) {
    if (!mon.alive) return 0;
    const p = Game.player;
    let total = 0; let mainType = 'phys', mainVal = 0;
    for (const t of DMG_TYPES) {
      if (!packet[t]) continue;
      let v = packet[t] * (1 - mon.resOf(t));
      total += v; if (v > mainVal) { mainVal = v; mainType = t; }
    }
    if (mon.dmgTaken) total *= mon.dmgTaken;
    if (mon.shock > 0) total *= 1.2;
    if (opts.executeMult && mon.hp / mon.maxHp < 0.3) total *= opts.executeMult;
    if (opts.minion) total *= 0.8;
    if (total <= 0) return 0;
    const wasAlive = mon.hp > 0;
    mon.hp -= total; mon.hitFlash = 0.12; mon.aggro = true;
    // 숫자 표시
    const col = packet.crit ? '#ffd23f' : DMG[mainType].color;
    World.dmgNums.push(new DmgNum(mon.x, mon.y - mon.r, (packet.crit ? '' : '') + fmt(total), col, { size: packet.crit ? 20 : 13, bold: packet.crit }));
    if (packet.crit) { Audio_.play('crit'); Game.shake(2); } else Audio_.play('hit');
    World.splat(mon.x, mon.y, mon.bloodColor || '#7a0f1f', rand(4, 9));
    World.burst(mon.x, mon.y, col, packet.crit ? 8 : 3, 120, 0.3);
    // 넉백 / 기절
    if (opts.knock && !mon.knockRes && !mon.boss) { mon.kx += Math.cos(opts.knockAngle) * opts.knock; mon.ky += Math.sin(opts.knockAngle) * opts.knock; }
    if (opts.stun && !mon.boss) mon.stun = Math.max(mon.stun, opts.stun);
    // 상태이상
    const st = p.stats;
    if (opts.ailments) {
      const a = opts.ailments;
      if (a.ignite && packet.fire) this.applyAilmentRaw(mon, 'ignite', packet.fire * 0.25 * a.ignite * (1 + st.inc.inc_dot), 4);
      if (a.ignite && st.flags.has('all_ignite')) this.applyAilmentRaw(mon, 'ignite', total * 0.2 * (1 + st.inc.inc_dot), 4);
      if (a.bleed && packet.phys) this.applyAilmentRaw(mon, 'bleed', packet.phys * 0.3 * a.bleed * (1 + st.inc.inc_dot), 5);
      if (a.chill && packet.cold) { mon.chill = Math.max(mon.chill, 2.5); }
      if (a.freeze && packet.cold && chance(a.freeze)) mon.frozen = Math.max(mon.frozen, mon.boss ? 0.3 : 1.0);
      if (a.shock && packet.light) mon.shock = Math.max(mon.shock, 4);
    }
    if (!opts.noProc && opts.src === p) {
      if (st.aspects.has('bleed_fang') && packet.phys) this.applyAilmentRaw(mon, 'bleed', packet.phys * 0.3 * (1 + st.inc.inc_dot), 5);
      if (st.aspects.has('crit_freeze') && packet.crit) { mon.frozen = Math.max(mon.frozen, mon.boss ? 0.3 : 1.0); Audio_.play('freeze'); }
      if (st.aspects.has('storm_hands') && chance(0.25)) {
        const ldmg = total * 1.5;
        World.addZone({ type: 'strike', x: mon.x, y: mon.y, r: 50, t: 0, dur: 0.25, color: '#ffe94d' });
        this.areaHitRaw(mon.x, mon.y, 50, { light: ldmg }, { tags: ['aoe'], ailments: { shock: 1 } });
        Audio_.play('crit');
      }
      // 흡수 / 자원
      if (opts.leech) p.heal(total * opts.leech);
      if (opts.isAttack || opts.tags?.includes('spell')) {
        const c = CLASSES[p.cls]; if (c.resource.onHit) p.gainRes(c.resource.onHit);
      }
      if (st.flags.has('execute_30') && !mon.boss && mon.rarity !== 'rare' && mon.hp > 0 && mon.hp / mon.maxHp < 0.3) { mon.hp = 0; World.dmgNums.push(new DmgNum(mon.x, mon.y - mon.r - 14, '처형!', '#ff5c5c', { size: 16, bold: true })); }
    }
    if (mon.hp <= 0 && wasAlive) this.killMonster(mon, opts);
    return total;
  },
  applyAilmentRaw(mon, type, dps, dur) {
    if (!mon.alive || dps <= 0) return;
    if (type === 'ignite') { if (dps >= mon.igniteDps * 0.8) { mon.igniteDps = Math.max(mon.igniteDps, dps); mon.ignite = dur; } }
    else if (type === 'bleed') { if (dps >= mon.bleedDps * 0.8) { mon.bleedDps = Math.max(mon.bleedDps, dps); mon.bleed = dur; } }
  },
  dotDamage(mon, amount, type) {
    if (!mon.alive) return;
    mon.hp -= amount * (1 - mon.resOf(type));
    if (mon.hp <= 0) { this.killMonster(mon, { src: Game.player, dot: true }); }
  },
  killMonster(mon, opts = {}) {
    if (!mon.alive) return;
    mon.alive = false; mon.deathT = 0.5; mon.hp = 0;
    const p = Game.player;
    Audio_.play('kill');
    World.burst(mon.x, mon.y, mon.bloodColor || '#7a0f1f', 14, 160, 0.6, { grav: 200 });
    World.splat(mon.x, mon.y, mon.bloodColor || '#7a0f1f', mon.r * 1.6);
    // 경험치
    p.kills++; World.killCount++;
    let xp = mon.xpValue();
    const diff = p.level - mon.level;
    if (diff > CFG.XP_LEVEL_DIFF_PENALTY) xp *= Math.max(0.1, 1 - (diff - CFG.XP_LEVEL_DIFF_PENALTY) * 0.12);
    p.addXP(xp);
    p.heal(p.stats.lifeOnKill); p.gainRes(p.stats.resOnKill);
    if (p.stats.aspects.has('bleed_fang')) p.gainRes(15);
    if (chance(CFG.POTION_REFILL_CHANCE * (mon.rarity === 'rare' ? 3 : mon.boss ? 20 : 1)) && p.potion.charges < p.stats.potionCharges) { p.potion.charges++; World.dmgNums.push(new DmgNum(p.x, p.y - 20, '+포션', '#e63946', { size: 12 })); }
    if (p.stats.flags.has('berserk')) { p.berserk.stacks = Math.min(10, p.berserk.stacks + 1); p.berserk.t = 6; p.addBuff({ id: 'berserk', name: '폭주', t: 6, mods: { inc_aspd: 0.04, inc_cspd: 0.04 }, stackMax: 10, icon: '🔥', color: '#ff5c5c' }); }
    // 사망 효과
    if (mon.onDeath === 'explode' || World.mapMods.volatile) {
      World.addZone({ type: 'telegraph', owner: 'monster', x: mon.x, y: mon.y, r: 75, t: 0, dur: 0.7, color: '#ff6b35', dmg: mon.dmg * 2.5, dmgType: 'fire', label: '폭발', src: mon });
    }
    if (mon.onDeath === 'split' && !mon.isSplit) {
      for (let i = 0; i < 2; i++) { const m = World.spawnMonster(mon.typeId, mon.x + rand(-20, 20), mon.y + rand(-20, 20), 'normal', { level: mon.level, isSplit: true, scale: 0.75, hpMult: 0.4 }); if (m) m.aggro = true; }
    }
    if (p.stats.aspects.has('reaper') && !opts.noProc) {
      World.addZone({ type: 'ring', x: mon.x, y: mon.y, r: 85, t: 0, dur: 0.3, color: '#e6e6e6' });
      this.areaHitRaw(mon.x, mon.y, 85, { phys: mon.maxHp * 0.3 }, { exclude: mon, tags: ['aoe'], knock: 120 });
    }
    World.dropLoot(mon);
    if (mon.boss) World.onBossKilled(mon);
    if (mon.riftMon) World.rift.killed++;
  },
  // ---------- 플레이어 피격 ----------
  damagePlayer(amount, type, opts = {}) {
    const p = Game.player;
    if (Game.state !== 'play') return;
    if (p.invuln > 0 || p.dodge.t > 0) { return; }
    const st = p.stats;
    const mlvl = opts.src ? opts.src.level : World.level;
    if (opts.attack && st.evasion > 0) {
      const ev = Math.min(0.75, st.evasion / (st.evasion + 120 + 30 * mlvl));
      if (chance(ev)) { World.dmgNums.push(new DmgNum(p.x, p.y - 22, '회피', '#b7e4c7', { size: 12 })); return; }
    }
    if (type === 'phys') { amount *= (1 - st.armor / (st.armor + 6 * amount)) * (1 - st.physRed); }
    else amount *= (1 - st[type + '_res'] / 100);
    if (p.ult.active && p.cls === 'slayer') amount *= 0.7;
    for (const b of p.buffs) if (b.dmgTaken) amount *= b.dmgTaken;
    if (st.flags.has('mom')) { const toRes = Math.min(p.res, amount * 0.3); p.res -= toRes; amount -= toRes; }
    amount = Math.max(1, amount);
    p.hp -= amount; p.hitFlash = 0.15;
    World.dmgNums.push(new DmgNum(p.x, p.y - 22, '-' + fmt(amount), '#ff4d4d', { size: 15, bold: true }));
    Audio_.play('hurt'); Game.shake(Math.min(10, 2 + amount / st.maxLife * 30)); Game.hurtFlash = 0.25;
    World.splat(p.x, p.y, '#9b1c31', rand(4, 8));
    if (opts.ailment && opts.src) {
      if (opts.ailment === 'chill') p.chill = Math.max(p.chill, 2);
      if (opts.ailment === 'bleed') { p.st.bleed = 4; p.st.bleedDps = Math.max(p.st.bleedDps, amount * 0.2); }
      if (opts.ailment === 'ignite') { p.st.ignite = 3; p.st.igniteDps = Math.max(p.st.igniteDps, amount * 0.25); }
    }
    if (opts.src && opts.src.alive && st.thorns > 0 && opts.attack) this.damageMonster(opts.src, { phys: st.thorns, crit: false }, { src: p, noProc: true, tags: [] });
    if (st.aspects.has('tyrant')) {
      this.areaHitRaw(p.x, p.y, 110, { fire: amount * 3 }, { tags: ['aoe'], ailments: { ignite: 1 } });
      World.addZone({ type: 'ring', x: p.x, y: p.y, r: 110, t: 0, dur: 0.3, color: '#ff6b35' });
    }
    if (p.hp <= 0) Game.playerDied(opts.src ? opts.src.name + (opts.cause ? ` (${opts.cause})` : '') : (opts.cause || '알 수 없는 원인'));
  },
  monsterHitPlayer(mon, mult = 1, typeOverride) {
    const type = typeOverride || mon.dmgType || 'phys';
    this.damagePlayer(mon.dmg * mult, type, { attack: true, src: mon, ailment: mon.ailment });
    if (mon.leechPct) mon.hp = Math.min(mon.maxHp, mon.hp + mon.dmg * mult * mon.leechPct);
  },
};
