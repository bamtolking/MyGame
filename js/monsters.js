'use strict';
// ===================== 몬스터 데이터 =====================
const MON_TYPES = {
  ghoul: { name: '구울', hp: 22, dmg: 4, speed: 115, r: 11, xp: 6, ai: 'melee', color: '#7a9a5a', blood: '#4a6a2a', range: 26, cd: 1.0, windup: 0.3 },
  bat: { name: '흡혈 박쥐', hp: 7, dmg: 2, speed: 210, r: 7, xp: 3, ai: 'swarm', color: '#5a3d6b', blood: '#3a1a4a', range: 14, cd: 0.9 },
  skel_archer: { name: '해골 궁수', hp: 18, dmg: 5, speed: 85, r: 10, xp: 7, ai: 'ranged', color: '#d8d0b8', blood: '#8a8070', range: 300, keep: 220, cd: 2.0, projSpeed: 330 },
  werewolf: { name: '늑대인간', minTier: 2, hp: 48, dmg: 10, speed: 150, r: 14, xp: 12, ai: 'charger', color: '#8b8b8b', blood: '#7a0f1f', range: 30, cd: 1.2, windup: 0.25, chargeCd: 4 },
  priest: { name: '타락한 사제', minTier: 2, hp: 32, dmg: 9, speed: 80, r: 11, xp: 10, ai: 'caster', color: '#8a5cf5', blood: '#4a2a8a', keep: 240, cd: 2.4, dmgType: 'fire', aoe: 64 },
  golem: { name: '피의 골렘', minTier: 3, hp: 130, dmg: 18, speed: 62, r: 21, xp: 22, ai: 'melee', color: '#7a1f2b', blood: '#5a0a1a', range: 36, cd: 1.6, windup: 0.5, knockRes: true, res: { phys: 0.2 } },
  witch: { name: '심연의 마녀', minTier: 2, hp: 38, dmg: 7, speed: 90, r: 11, xp: 14, ai: 'summoner', color: '#3d1f5e', blood: '#2a0a3a', keep: 260, cd: 4.5, projSpeed: 300 },
  wraith: { name: '망령', minTier: 2, hp: 26, dmg: 8, speed: 100, r: 11, xp: 9, ai: 'phaser', color: '#9ec5ff', blood: '#3a6aaa', range: 30, cd: 1.1, windup: 0.25, dmgType: 'cold', ailment: 'chill', res: { cold: 0.5 } },
  hound: { name: '지옥 사냥개', minTier: 2, hp: 34, dmg: 7, speed: 170, r: 12, xp: 10, ai: 'melee', color: '#ff7b3a', blood: '#aa3a10', range: 28, cd: 0.9, windup: 0.2, dmgType: 'fire', ailment: 'ignite', res: { fire: 0.6 } },
  cultist: { name: '광신도', hp: 28, dmg: 5, speed: 105, r: 11, xp: 8, ai: 'ranged', color: '#c04060', blood: '#7a0f1f', range: 260, keep: 180, cd: 1.9, projSpeed: 340, dmgType: 'chaos' },
  rival: { name: '적대 추방자', hp: 110, dmg: 12, speed: 165, r: 12, xp: 70, ai: 'rival', color: '#ffffff', blood: '#9b1c31', range: 320, keep: 210, cd: 2.2, projSpeed: 520 },
};
const BOSSES = {
  vampire_lord: { name: '흡혈 군주 드라쿨', hp: 420, dmg: 15, speed: 125, r: 24, xp: 320, color: '#b3001b', blood: '#5a0a1a', ai: 'boss_vampire', range: 40, cd: 1.3, windup: 0.4, dmgType: 'phys', leech: 0.3 },
  archbishop: { name: '타락한 대주교', hp: 480, dmg: 17, speed: 90, r: 24, xp: 360, color: '#f9c74f', blood: '#8a6d3b', ai: 'boss_bishop', keep: 220, cd: 1.0, dmgType: 'fire', res: { fire: 0.4 } },
  lich: { name: '심연의 리치', hp: 450, dmg: 16, speed: 85, r: 24, xp: 360, color: '#4cc9f0', blood: '#1a4a6a', ai: 'boss_lich', keep: 240, cd: 1.0, dmgType: 'cold', ailment: 'chill', res: { cold: 0.6 } },
  rider: { name: '파멸의 기수', hp: 560, dmg: 19, speed: 140, r: 26, xp: 400, color: '#ff5400', blood: '#8a2a0a', ai: 'boss_rider', range: 44, cd: 1.4, windup: 0.4, dmgType: 'fire', res: { fire: 0.6 } },
  traitor: { name: '배신자 아우스터 제피르', hp: 450, dmg: 15, speed: 130, r: 22, xp: 360, color: '#2d6a4f', blood: '#1a4a2a', ai: 'boss_traitor', keep: 200, cd: 1.0, dmgType: 'phys' },
};
const MON_MODS = {
  swift: { name: '신속한', speed: 1.4, aspd: 1.3 },
  sturdy: { name: '강인한', hp: 1.6 },
  volatile: { name: '폭발하는', onDeath: 'explode' },
  fiery: { name: '화염의', dmgType: 'fire', ailment: 'ignite', res: { fire: 0.5 } },
  icy: { name: '냉기의', dmgType: 'cold', ailment: 'chill', res: { cold: 0.5 } },
  shocking: { name: '번개의', dmgType: 'light', res: { light: 0.5 } },
  leeching: { name: '흡혈하는', leech: 0.4 },
  regen: { name: '재생하는', regen: 0.02 },
  shielded: { name: '보호받는', dmgTaken: 0.65 },
  splitting: { name: '분열하는', onDeath: 'split' },
  resistant: { name: '저항하는', resAll: 0.35 },
  bleeder: { name: '유혈의', ailment: 'bleed' },
  blink: { name: '점멸하는', blink: true },
};
const MON_MOD_IDS = Object.keys(MON_MODS);
const RARE_NAME_A = ['핏빛', '검은', '잊혀진', '저주받은', '굶주린', '미친', '늙은', '불멸의', '썩은', '울부짖는'];
const RARE_NAME_B = ['아그나르', '벨라토르', '모르가나', '칼릭스', '제피르', '우르술라', '드라쿨', '네메스', '바알', '리리스', '고르곤', '카인', '이졸데', '볼탄'];
const RIVAL_NAMES = ['라이언', '세라', '카일', '미레유', '단테', '이사벨', '레온', '나디아', '루카스', '헬레나'];

function monHpMult(level) { return Math.pow(1 + 0.3 * level, 1.45); }
function monDmgMult(level) { return 1 + 0.14 * level; }

// ===================== 몬스터 =====================
class Monster {
  constructor(typeId, x, y, level, rarity = 'normal', opts = {}) {
    const def = MON_TYPES[typeId] || BOSSES[typeId];
    this.def = def; this.typeId = typeId; this.boss = !!BOSSES[typeId]; this.x = x; this.y = y; this.level = level; this.rarity = rarity;
    this.alive = true; this.deathT = 0; this.hitFlash = 0; this.aggro = !!opts.aggro; this.t = rand(10);
    this.isSplit = !!opts.isSplit; this.riftMon = !!opts.riftMon; this.noLoot = !!opts.noLoot;
    const mm = World.mapMods || {};
    const rarHp = rarity === 'magic' ? 2.0 : rarity === 'rare' ? 4.5 : 1;
    const rarDmg = rarity === 'magic' ? 1.2 : rarity === 'rare' ? 1.5 : this.boss ? 1.5 : 1;
    this.r = def.r * (opts.scale || 1) * (rarity === 'rare' ? 1.15 : 1);
    this.speed = def.speed * (mm.monSpeed || 1) * (rarity === 'rare' ? 1.05 : 1);
    this.aspd = 1; this.dmgType = def.dmgType || 'phys'; this.ailment = def.ailment || null;
    this.res = Object.assign({}, def.res || {}); this.resAll = 0; this.dmgTaken = 1; this.knockRes = !!def.knockRes || this.boss; this.leechPct = def.leech || 0; this.regen = 0; this.onDeath = null; this.blink = false;
    this.mods = [];
    if (rarity === 'magic' || rarity === 'rare') {
      const n = rarity === 'magic' ? 1 : randInt(2, 3);
      const pool = shuffle([...MON_MOD_IDS]);
      for (let i = 0; i < n; i++) this.applyMod(pool[i]);
    }
    if (mm.monEle && chance(0.5) && this.dmgType === 'phys') this.dmgType = choice(['fire', 'cold', 'light']);
    let hp = def.hp * monHpMult(level) * rarHp * (mm.monHp || 1) * (opts.hpMult || 1) * this.hpMod;
    this.maxHp = Math.round(hp); this.hp = this.maxHp;
    this.dmg = def.dmg * monDmgMult(level) * rarDmg * (mm.monDmg || 1);
    this.color = opts.color || def.color; this.bloodColor = def.blood;
    this.name = def.name;
    if (rarity === 'magic') this.name = MON_MODS[this.mods[0]].name + ' ' + def.name;
    if (rarity === 'rare') this.name = choice(RARE_NAME_A) + ' ' + choice(RARE_NAME_B);
    if (typeId === 'rival') { this.rivalCls = opts.rivalCls || 'slayer'; this.name = `적대 ${CLASSES[this.rivalCls].name} ${choice(RIVAL_NAMES)}`; this.color = CLASSES[this.rivalCls].color; this.rarity = 'rare'; this.dmgTaken = 1; this.maxHp = Math.round(def.hp * monHpMult(level) * 4); this.hp = this.maxHp; this.potionUsed = false; }
    // 상태
    this.ignite = 0; this.igniteDps = 0; this.bleed = 0; this.bleedDps = 0; this.chill = 0; this.frozen = 0; this.shock = 0; this.stun = 0; this.dotTick = 0;
    this.kx = 0; this.ky = 0;
    this.ai = { cd: rand(0.3, 1.2), windup: 0, charging: false, chargeT: 0, chargeDir: 0, chargeCd: 2, blinkCd: 3, summonCd: 2, hitDone: false, steer: chance(0.5) ? 1 : -1, steerT: 0, jitter: rand(Math.PI * 2), phase: 0, t1: 3, t2: 6, t3: 9, burst: 0, burstT: 0, dodgeCd: 3 };
  }
  get hpMod() { let m = 1; for (const id of this.mods) if (MON_MODS[id].hp) m *= MON_MODS[id].hp; return m; }
  applyMod(id) {
    const m = MON_MODS[id]; this.mods.push(id);
    if (m.speed) this.speed *= m.speed; if (m.aspd) this.aspd *= m.aspd;
    if (m.dmgType) { this.dmgType = m.dmgType; } if (m.ailment) this.ailment = m.ailment;
    if (m.res) for (const k in m.res) this.res[k] = Math.max(this.res[k] || 0, m.res[k]);
    if (m.resAll) this.resAll += m.resAll; if (m.dmgTaken) this.dmgTaken *= m.dmgTaken;
    if (m.leech) this.leechPct = m.leech; if (m.regen) this.regen = m.regen; if (m.onDeath) this.onDeath = m.onDeath; if (m.blink) this.blink = true;
  }
  resOf(t) { return clamp((this.res[t] || 0) + this.resAll, -1, 0.9); }
  xpValue() {
    const rar = this.rarity === 'magic' ? 2.2 : this.rarity === 'rare' ? 6 : 1;
    return this.def.xp * Math.pow(1 + 0.3 * this.level, 1.4) * rar * (this.isSplit ? 0.3 : 1) * (this.noLoot ? 0.4 : 1);
  }
  moveToward(tx, ty, spd, dt, away = false) {
    let a = angleTo(this.x, this.y, tx, ty); if (away) a += Math.PI;
    const dx = Math.cos(a) * spd * dt, dy = Math.sin(a) * spd * dt;
    const ox = this.x, oy = this.y;
    World.moveEntity(this, dx, dy);
    const moved = dist(ox, oy, this.x, this.y);
    if (moved < spd * dt * 0.5) {
      // 벽에 막힘: 옆으로 비켜가기
      this.ai.steerT += dt; if (this.ai.steerT > 1.2) { this.ai.steer *= -1; this.ai.steerT = 0; }
      const sa = a + this.ai.steer * Math.PI / 2;
      World.moveEntity(this, Math.cos(sa) * spd * dt, Math.sin(sa) * spd * dt);
    }
  }
  shoot(p, opts = {}) {
    const def = this.def; const spd = opts.speed || def.projSpeed || 350;
    const lead = opts.lead === false ? 0 : 0.25;
    const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
    const a = angleTo(this.x, this.y, tx, ty) + (opts.angleOffset || 0);
    World.projectiles.push(new Projectile({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, owner: 'monster', srcMon: this, r: opts.r || 6, range: opts.range || 560, dmg: this.dmg * (opts.mult || 1), dmgType: opts.type || this.dmgType, ailment: this.ailment, color: opts.color || DMG[opts.type || this.dmgType].color }));
  }
  telegraph(x, y, r, delay, mult = 1.3, type, label) {
    World.addZone({ type: 'telegraph', owner: 'monster', x, y, r, t: 0, dur: delay, color: DMG[type || this.dmgType].color, dmg: this.dmg * mult, dmgType: type || this.dmgType, src: this, label });
  }
  update(dt) {
    if (!this.alive) { this.deathT -= dt; return; }
    const p = Game.player; this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stun > 0) this.stun -= dt; if (this.frozen > 0) this.frozen -= dt; if (this.chill > 0) this.chill -= dt; if (this.shock > 0) this.shock -= dt;
    // 지속 피해
    this.dotTick += dt;
    if (this.dotTick >= 0.25) {
      const tk = this.dotTick; this.dotTick = 0;
      if (this.ignite > 0) { this.ignite -= tk; Combat.dotDamage(this, this.igniteDps * tk, 'fire'); if (!this.alive) return; if (this.ignite <= 0) this.igniteDps = 0; }
      if (this.bleed > 0) { this.bleed -= tk; Combat.dotDamage(this, this.bleedDps * tk, 'phys'); if (!this.alive) return; if (this.bleed <= 0) this.bleedDps = 0; }
      if (this.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * tk);
    }
    // 넉백
    if (Math.abs(this.kx) + Math.abs(this.ky) > 5) { World.moveEntity(this, this.kx * dt, this.ky * dt); this.kx *= Math.pow(0.02, dt); this.ky *= Math.pow(0.02, dt); }
    const d = dist(this.x, this.y, p.x, p.y);
    if (!this.aggro) { if (d < 150 || (d < 340 && World.lineClear(this.x, this.y, p.x, p.y))) this.aggro = true; else return; }
    if (d > CFG.ACTIVATION_RANGE && !this.boss) return;
    if (this.frozen > 0 || this.stun > 0) return;
    if (this.ai.cd > 0) this.ai.cd -= dt * this.aspd;
    const spd = this.speed * (this.chill > 0 ? 0.7 : 1);
    const ai = this.ai; const def = this.def;
    switch (def.ai) {
      case 'melee': this.aiMelee(p, d, spd, dt); break;
      case 'swarm': {
        ai.jitter += dt * 7; const a = angleTo(this.x, this.y, p.x, p.y) + Math.sin(ai.jitter) * 0.9;
        if (d > def.range + p.r) World.moveEntity(this, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt);
        if (d < def.range + p.r + 6 && ai.cd <= 0) { ai.cd = def.cd; Combat.monsterHitPlayer(this); }
        break;
      }
      case 'ranged': {
        if (d > def.range) this.moveToward(p.x, p.y, spd, dt);
        else if (d < def.keep * 0.6) this.moveToward(p.x, p.y, spd * 0.8, dt, true);
        else if (!World.lineClear(this.x, this.y, p.x, p.y)) this.moveToward(p.x, p.y, spd, dt);
        if (ai.cd <= 0 && d <= def.range && World.lineClear(this.x, this.y, p.x, p.y)) { ai.cd = def.cd; ai.windup = 0.2; this.shoot(p); }
        break;
      }
      case 'charger': {
        if (ai.charging) {
          ai.chargeT -= dt; const ox = this.x, oy = this.y;
          World.moveEntity(this, Math.cos(ai.chargeDir) * spd * 3.2 * dt, Math.sin(ai.chargeDir) * spd * 3.2 * dt);
          if (dist(ox, oy, this.x, this.y) < 1) ai.charging = false;
          if (!ai.hitDone && d < this.r + p.r + 6) { ai.hitDone = true; Combat.monsterHitPlayer(this, 1.6); }
          if (ai.chargeT <= 0) ai.charging = false;
          for (let i = 0; i < 2; i++) World.particles.push(new Particle(this.x, this.y, rand(-30, 30), rand(-30, 30), 0.3, '#aaa', 3));
          break;
        }
        ai.chargeCd -= dt;
        if (ai.windup > 0) { ai.windup -= dt; if (ai.windup <= 0) { if (ai.pendingCharge) { ai.pendingCharge = false; ai.charging = true; ai.chargeT = Math.min(0.55, d / (spd * 3.2) + 0.15); ai.chargeDir = angleTo(this.x, this.y, p.x, p.y); ai.hitDone = false; } else if (d < def.range + p.r + 10) Combat.monsterHitPlayer(this); } break; }
        if (ai.chargeCd <= 0 && d < 300 && d > 70 && World.lineClear(this.x, this.y, p.x, p.y)) { ai.chargeCd = def.chargeCd; ai.windup = 0.45; ai.pendingCharge = true; break; }
        this.aiMelee(p, d, spd, dt);
        break;
      }
      case 'caster': {
        if (d > def.keep * 1.3) this.moveToward(p.x, p.y, spd, dt);
        else if (d < def.keep * 0.6) this.moveToward(p.x, p.y, spd * 0.8, dt, true);
        if (ai.cd <= 0 && d < 420) { ai.cd = def.cd; ai.windup = 0.3; this.telegraph(p.x + p.vx * 0.3, p.y + p.vy * 0.3, def.aoe, 0.9, 1.4, def.dmgType, '성화'); }
        break;
      }
      case 'summoner': {
        if (d > def.keep * 1.3) this.moveToward(p.x, p.y, spd, dt);
        else if (d < def.keep * 0.7) this.moveToward(p.x, p.y, spd * 0.9, dt, true);
        ai.summonCd -= dt;
        if (ai.summonCd <= 0 && d < 500) {
          ai.summonCd = def.cd;
          const alive = World.monsters.filter(m => m.alive && m.summoner === this).length;
          if (alive < 5) for (let i = 0; i < 2; i++) { const m = World.spawnMonster('bat', this.x + rand(-25, 25), this.y + rand(-25, 25), 'normal', { level: this.level, noLoot: true, aggro: true }); if (m) m.summoner = this; }
          World.burst(this.x, this.y, '#8a5cf5', 12, 100, 0.5);
        }
        if (ai.cd <= 0 && d < 320 && World.lineClear(this.x, this.y, p.x, p.y)) { ai.cd = 1.8; this.shoot(p, { type: 'chaos', mult: 0.8 }); }
        break;
      }
      case 'phaser': {
        ai.blinkCd -= dt;
        if (ai.blinkCd <= 0 && d > 110) {
          ai.blinkCd = 3.5;
          for (let i = 0; i < 6; i++) { const a = rand(Math.PI * 2); const nx = p.x + Math.cos(a) * 85, ny = p.y + Math.sin(a) * 85; if (!World.wallAtCircle(nx, ny, this.r)) { World.burst(this.x, this.y, this.color, 8, 80, 0.4); this.x = nx; this.y = ny; World.burst(this.x, this.y, this.color, 8, 80, 0.4); break; } }
        }
        this.aiMelee(p, dist(this.x, this.y, p.x, p.y), spd, dt);
        break;
      }
      case 'rival': this.aiRival(p, d, spd, dt); break;
      case 'boss_vampire': this.bossVampire(p, d, spd, dt); break;
      case 'boss_bishop': this.bossBishop(p, d, spd, dt); break;
      case 'boss_lich': this.bossLich(p, d, spd, dt); break;
      case 'boss_rider': this.bossRider(p, d, spd, dt); break;
      case 'boss_traitor': this.bossTraitor(p, d, spd, dt); break;
    }
    if (this.blink) { ai.blinkCd -= dt; if (ai.blinkCd <= 0 && d > 140) { ai.blinkCd = 4; const a = rand(Math.PI * 2); const nx = p.x + Math.cos(a) * 70, ny = p.y + Math.sin(a) * 70; if (!World.wallAtCircle(nx, ny, this.r)) { World.burst(this.x, this.y, '#c77dff', 8, 80, 0.4); this.x = nx; this.y = ny; } } }
    // 분리
    for (const o of World.monstersNear(this.x, this.y, this.r + 24)) {
      if (o === this || !o.alive) continue;
      const dd = dist(this.x, this.y, o.x, o.y); const min = this.r + o.r;
      if (dd < min && dd > 0.01) { const push = (min - dd) * 0.5; const a = angleTo(o.x, o.y, this.x, this.y); World.moveEntity(this, Math.cos(a) * push, Math.sin(a) * push); }
    }
  }
  aiMelee(p, d, spd, dt) {
    const def = this.def, ai = this.ai;
    if (ai.windup > 0) { ai.windup -= dt; if (ai.windup <= 0 && d < def.range + p.r + 12) Combat.monsterHitPlayer(this); return; }
    if (d > def.range + p.r) this.moveToward(p.x, p.y, spd, dt);
    else if (ai.cd <= 0) { ai.cd = def.cd; ai.windup = (def.windup || 0.25); }
  }
  aiRival(p, d, spd, dt) {
    const def = this.def, ai = this.ai;
    ai.dodgeCd -= dt;
    if (ai.dashT > 0) { ai.dashT -= dt; World.moveEntity(this, Math.cos(ai.chargeDir) * spd * 3 * dt, Math.sin(ai.chargeDir) * spd * 3 * dt); return; }
    if (!this.potionUsed && this.hp < this.maxHp * 0.3) { this.potionUsed = true; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.35); World.dmgNums.push(new DmgNum(this.x, this.y - 30, '포션!', '#e63946', { size: 14, bold: true })); World.burst(this.x, this.y, '#e63946', 12, 100, 0.6); }
    if (ai.dodgeCd <= 0 && d < 260) { ai.dodgeCd = 3.5; ai.dashT = 0.22; ai.chargeDir = angleTo(p.x, p.y, this.x, this.y) + rand(-1.2, 1.2); return; }
    if (d > def.range) this.moveToward(p.x, p.y, spd, dt);
    else if (d < def.keep * 0.5) this.moveToward(p.x, p.y, spd * 0.9, dt, true);
    else if (!World.lineClear(this.x, this.y, p.x, p.y)) this.moveToward(p.x, p.y, spd, dt);
    else { const a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2 * ai.steer; World.moveEntity(this, Math.cos(a) * spd * 0.5 * dt, Math.sin(a) * spd * 0.5 * dt); ai.steerT += dt; if (ai.steerT > 2) { ai.steerT = 0; ai.steer *= -1; } }
    if (ai.burst > 0) { ai.burstT -= dt; if (ai.burstT <= 0) { ai.burstT = 0.13; ai.burst--; this.shoot(p, { speed: def.projSpeed, color: this.color, type: this.rivalCls === 'slayer' ? 'phys' : this.rivalCls === 'vampire' ? 'chaos' : 'cold', mult: 0.7 }); } }
    else if (ai.cd <= 0 && d < def.range && World.lineClear(this.x, this.y, p.x, p.y)) { ai.cd = def.cd; ai.burst = 3; ai.burstT = 0; }
    if (d < 50 && ai.windup <= 0 && ai.cd < def.cd - 0.8) { Combat.monsterHitPlayer(this, 1.2); ai.cd = def.cd; }
  }
  // ---------- 보스 ----------
  bossVampire(p, d, spd, dt) {
    const ai = this.ai; ai.t1 -= dt; ai.t2 -= dt; ai.t3 -= dt;
    const enraged = this.hp < this.maxHp * 0.5;
    if (ai.charging) { ai.chargeT -= dt; World.moveEntity(this, Math.cos(ai.chargeDir) * spd * 3 * dt, Math.sin(ai.chargeDir) * spd * 3 * dt); if (!ai.hitDone && d < this.r + p.r + 6) { ai.hitDone = true; Combat.monsterHitPlayer(this, 1.8); } if (ai.chargeT <= 0) ai.charging = false; return; }
    if (ai.t1 <= 0) { ai.t1 = enraged ? 4 : 6; this.telegraph(this.x, this.y, 150, 1.0, 2.0, 'phys', '피의 폭발'); World.addZone({ type: 'ring', x: this.x, y: this.y, r: 30, t: 0, dur: 0.5, color: '#b3001b' }); return; }
    if (ai.t2 <= 0) { ai.t2 = 9; for (let i = 0; i < (enraged ? 5 : 3); i++) { const m = World.spawnMonster('bat', this.x + rand(-30, 30), this.y + rand(-30, 30), 'normal', { level: this.level, noLoot: true, aggro: true }); } Game.announce('드라쿨이 박쥐 떼를 부른다!', '#b3001b'); }
    if (enraged && ai.t3 <= 0 && d > 80) { ai.t3 = 4; ai.charging = true; ai.chargeT = Math.min(0.6, d / (spd * 3) + 0.1); ai.chargeDir = angleTo(this.x, this.y, p.x, p.y); ai.hitDone = false; return; }
    this.aiMelee(p, d, spd * (enraged ? 1.25 : 1), dt);
  }
  bossBishop(p, d, spd, dt) {
    const ai = this.ai, def = this.def; ai.t1 -= dt; ai.t2 -= dt;
    const enraged = this.hp < this.maxHp * 0.5;
    if (d > def.keep * 1.3) this.moveToward(p.x, p.y, spd, dt); else if (d < def.keep * 0.6) this.moveToward(p.x, p.y, spd, dt, true);
    if (ai.t1 <= 0) { ai.t1 = enraged ? 2.2 : 3.2; const n = enraged ? 5 : 3; for (let i = 0; i < n; i++) { const off = i === 0 ? 0 : rand(60, 140), a = rand(Math.PI * 2); this.telegraph(p.x + Math.cos(a) * off, p.y + Math.sin(a) * off, 70, 0.9 + i * 0.12, 1.5, 'fire', '성화'); } }
    if (ai.t2 <= 0) { ai.t2 = 7; ai.beamA = angleTo(this.x, this.y, p.x, p.y); World.addZone({ type: 'beamwarn', owner: 'monster', x: this.x, y: this.y, a: ai.beamA, len: 520, w: 46, t: 0, dur: 1.2, color: '#f9c74f', dmg: this.dmg * 2.2, dmgType: 'fire', src: this }); }
    if (ai.cd <= 0 && World.lineClear(this.x, this.y, p.x, p.y)) { ai.cd = 1.6; this.shoot(p, { type: 'fire', mult: 0.9, speed: 360, r: 8 }); }
  }
  bossLich(p, d, spd, dt) {
    const ai = this.ai, def = this.def; ai.t1 -= dt; ai.t2 -= dt; ai.t3 -= dt;
    const enraged = this.hp < this.maxHp * 0.4;
    if (d > def.keep * 1.3) this.moveToward(p.x, p.y, spd, dt); else if (d < def.keep * 0.6) this.moveToward(p.x, p.y, spd, dt, true);
    if (ai.cd <= 0 && World.lineClear(this.x, this.y, p.x, p.y)) { ai.cd = 2.6; for (let i = -2; i <= 2; i++) this.shoot(p, { type: 'cold', mult: 0.75, speed: 400, angleOffset: i * 0.18, lead: false }); }
    if (ai.t1 <= 0) { ai.t1 = 8; for (let i = 0; i < 3; i++) World.spawnMonster('skel_archer', this.x + rand(-60, 60), this.y + rand(-60, 60), 'normal', { level: this.level, noLoot: true, aggro: true }); Game.announce('리치가 해골을 일으킨다!', '#4cc9f0'); }
    if (ai.t2 <= 0 && d < 160) { ai.t2 = 6; for (let i = 0; i < 8; i++) { const a = rand(Math.PI * 2); const nx = p.x + Math.cos(a) * 260, ny = p.y + Math.sin(a) * 260; if (!World.wallAtCircle(nx, ny, this.r)) { World.burst(this.x, this.y, this.color, 12, 100, 0.5); this.x = nx; this.y = ny; break; } } }
    if (enraged && ai.t3 <= 0) { ai.t3 = 5; this.telegraph(this.x, this.y, 170, 1.1, 2.0, 'cold', '서리 폭발'); }
  }
  bossRider(p, d, spd, dt) {
    const ai = this.ai; ai.t1 -= dt;
    const enraged = this.hp < this.maxHp * 0.5;
    if (ai.charging) {
      ai.chargeT -= dt; const ox = this.x, oy = this.y;
      World.moveEntity(this, Math.cos(ai.chargeDir) * spd * 3.2 * dt, Math.sin(ai.chargeDir) * spd * 3.2 * dt);
      ai.trailT -= dt; if (ai.trailT <= 0) { ai.trailT = 0.06; World.addZone({ type: 'ground', owner: 'monster', x: this.x, y: this.y, r: 26, t: 0, dur: 3, tick: 0.4, tickT: 0, dmg: this.dmg * 0.35, dmgType: 'fire', color: '#ff5400', src: this, label: '불꽃 궤적' }); }
      if (!ai.hitDone && d < this.r + p.r + 8) { ai.hitDone = true; Combat.monsterHitPlayer(this, 1.7); }
      if (ai.chargeT <= 0 || dist(ox, oy, this.x, this.y) < 1) { ai.charging = false; if (ai.chain > 0) { ai.chain--; ai.windup = 0.35; ai.pendingCharge = true; } }
      return;
    }
    if (ai.windup > 0) { ai.windup -= dt; if (ai.windup <= 0) { if (ai.pendingCharge) { ai.pendingCharge = false; ai.charging = true; ai.chargeT = Math.min(0.8, d / (spd * 3.2) + 0.25); ai.chargeDir = angleTo(this.x, this.y, p.x, p.y); ai.hitDone = false; ai.trailT = 0; } else if (d < this.def.range + p.r + 12) Combat.monsterHitPlayer(this); } return; }
    if (ai.t1 <= 0 && d > 60) { ai.t1 = enraged ? 3.5 : 4.5; ai.windup = 0.5; ai.pendingCharge = true; ai.chain = enraged ? 1 : 0; return; }
    this.aiMelee(p, d, spd, dt);
  }
  bossTraitor(p, d, spd, dt) {
    const ai = this.ai, def = this.def; ai.t1 -= dt; ai.t2 -= dt; ai.t3 -= dt;
    const enraged = this.hp < this.maxHp * 0.5;
    if (d > def.keep * 1.3) this.moveToward(p.x, p.y, spd, dt); else if (d < def.keep * 0.6) this.moveToward(p.x, p.y, spd, dt, true);
    else { const a = angleTo(this.x, this.y, p.x, p.y) + Math.PI / 2 * ai.steer; World.moveEntity(this, Math.cos(a) * spd * 0.6 * dt, Math.sin(a) * spd * 0.6 * dt); ai.steerT += dt; if (ai.steerT > 2.5) { ai.steerT = 0; ai.steer *= -1; } }
    if (ai.cd <= 0 && World.lineClear(this.x, this.y, p.x, p.y)) { ai.cd = 2.0; for (let i = -1; i <= 1; i++) this.shoot(p, { type: 'phys', mult: 0.8, speed: 480, angleOffset: i * 0.22, color: '#b7e4c7', r: 7 }); }
    if (ai.t1 <= 0) { ai.t1 = enraged ? 5 : 7; for (let i = 0; i < (enraged ? 3 : 2); i++) World.addZone({ type: 'tornado', owner: 'monster', x: this.x + rand(-40, 40), y: this.y + rand(-40, 40), r: 40, t: 0, dur: 7, tick: 0.35, tickT: 0, vx: 0, vy: 0, dmg: this.dmg * 0.45, dmgType: 'cold', color: '#a2d2ff', src: this }); Game.announce('제피르가 폭풍을 부른다!', '#2d6a4f'); }
    if (ai.t2 <= 0) { ai.t2 = 6; World.addZone({ type: 'ground', owner: 'monster', x: p.x, y: p.y, r: 95, t: 0, dur: 4, tick: 0.5, tickT: 0, dmg: this.dmg * 0.4, dmgType: 'chaos', slow: 0.4, color: '#52b788' }); }
  }
  // ---------- 렌더 ----------
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    if (!this.alive) { ctx.globalAlpha = Math.max(0, this.deathT / 0.5); ctx.scale(1 + (0.5 - this.deathT), 0.6 + this.deathT * 0.8); }
    const r = this.r; const t = this.t;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, r * 0.8, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    // 희귀도 오라
    if (this.rarity === 'rare' || this.boss) { ctx.strokeStyle = this.boss ? 'rgba(255,60,60,0.6)' : 'rgba(255,210,63,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 6 + Math.sin(t * 5) * 2, 0, Math.PI * 2); ctx.stroke(); }
    else if (this.rarity === 'magic') { ctx.strokeStyle = 'rgba(123,155,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke(); }
    // 예고 (준비 동작)
    if (this.ai.windup > 0) { ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.fill(); }
    let col = this.color;
    if (this.hitFlash > 0) col = '#ffffff';
    ctx.fillStyle = col;
    const type = this.typeId;
    const bob = Math.sin(t * 8) * 1.5;
    if (type === 'bat') {
      const flap = Math.sin(t * 22) * 0.7;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -5 + flap * 7); ctx.lineTo(-14, 4 + flap * 5); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, -5 + flap * 7); ctx.lineTo(14, 4 + flap * 5); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2);
    } else if (type === 'skel_archer') {
      ctx.beginPath(); ctx.arc(0, bob, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(-4, -3 + bob, 3, 3); ctx.fillRect(1, -3 + bob, 3, 3);
      ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r * 0.9, bob, r * 0.9, -1.2, 1.2); ctx.stroke();
    } else if (type === 'werewolf') {
      ctx.beginPath(); ctx.arc(0, bob, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.6 + bob); ctx.lineTo(-r * 0.4, -r * 1.5 + bob); ctx.lineTo(-r * 0.1, -r * 0.7 + bob); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.6 + bob); ctx.lineTo(r * 0.4, -r * 1.5 + bob); ctx.lineTo(r * 0.1, -r * 0.7 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffdd55'; ctx.fillRect(-5, -3 + bob, 3, 3); ctx.fillRect(2, -3 + bob, 3, 3);
    } else if (type === 'priest' || type === 'archbishop' || type === 'cultist') {
      ctx.beginPath(); ctx.moveTo(0, -r * 1.3 + bob); ctx.lineTo(r, r * 0.9 + bob); ctx.lineTo(-r, r * 0.9 + bob); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = type === 'cultist' ? '#ff4d6d' : '#ffe9a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -r * 1.3 + bob, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    } else if (type === 'golem') {
      ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const rr = r * (0.85 + ((i * 7) % 3) * 0.1); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(-6, -4, 3, 0, Math.PI * 2); ctx.arc(6, -4, 3, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'witch' || type === 'lich') {
      ctx.beginPath(); ctx.arc(0, bob, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r, -r * 0.6 + bob); ctx.lineTo(r, -r * 0.6 + bob); ctx.lineTo(0, -r * 2.1 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = type === 'lich' ? '#4cc9f0' : '#c77dff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, bob, 3, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'wraith') {
      ctx.globalAlpha *= 0.75; ctx.beginPath(); ctx.arc(0, bob - 3, r * 0.8, Math.PI, 0); ctx.lineTo(r * 0.8, r * 0.6 + bob); ctx.lineTo(r * 0.3, r * 0.2 + bob); ctx.lineTo(0, r * 0.7 + bob); ctx.lineTo(-r * 0.3, r * 0.2 + bob); ctx.lineTo(-r * 0.8, r * 0.6 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-4, -5 + bob, 2, 3); ctx.fillRect(2, -5 + bob, 2, 3);
    } else if (type === 'hound') {
      ctx.beginPath(); ctx.ellipse(0, bob, r * 1.2, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = '#ff7b3a'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(r * 0.6, -2 + bob, 3, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'rival') {
      ctx.fillStyle = '#2b2b3a'; ctx.beginPath(); ctx.moveTo(-10, -6 + bob); ctx.quadraticCurveTo(-14, 8, -9, 12 + bob); ctx.lineTo(9, 12 + bob); ctx.quadraticCurveTo(14, 8, 10, -6 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f1d3b3'; ctx.beginPath(); ctx.arc(0, -9 + bob, 6, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'vampire_lord') {
      ctx.fillStyle = '#1a0308'; ctx.beginPath(); ctx.moveTo(-r, -r * 0.5); ctx.quadraticCurveTo(-r * 1.4, r, -r, r); ctx.lineTo(r, r); ctx.quadraticCurveTo(r * 1.4, r, r, -r * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, bob, r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2e6e6'; ctx.beginPath(); ctx.arc(0, -r * 0.7 + bob, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2a2a'; ctx.fillRect(-5, -r * 0.8 + bob, 3, 3); ctx.fillRect(2, -r * 0.8 + bob, 3, 3);
    } else if (type === 'rider') {
      ctx.beginPath(); ctx.ellipse(0, bob, r * 1.3, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0a05'; ctx.beginPath(); ctx.arc(0, -r * 0.7 + bob, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = '#ff5400'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(r * 0.9, -2 + bob, 4, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'traitor') {
      ctx.fillStyle = '#14352a'; ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.4 + bob); ctx.quadraticCurveTo(-r * 1.2, r, -r * 0.7, r + bob); ctx.lineTo(r * 0.7, r + bob); ctx.quadraticCurveTo(r * 1.2, r, r * 0.8, -r * 0.4 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, bob, r * 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8f3dc'; ctx.beginPath(); ctx.arc(0, -r * 0.7 + bob, r * 0.4, 0, Math.PI * 2); ctx.fill();
    } else { // ghoul 기본
      ctx.beginPath(); ctx.arc(0, bob, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r, 2 + bob); ctx.lineTo(-r * 1.5, r + Math.sin(t * 9) * 3); ctx.moveTo(r, 2 + bob); ctx.lineTo(r * 1.5, r + Math.cos(t * 9) * 3); ctx.stroke();
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-5, -4 + bob, 3, 3); ctx.fillRect(2, -4 + bob, 3, 3);
    }
    // 상태 표시
    ctx.shadowBlur = 0;
    if (this.frozen > 0) { ctx.fillStyle = 'rgba(160,220,255,0.55)'; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.fill(); }
    else if (this.chill > 0) { ctx.fillStyle = 'rgba(127,216,255,0.25)'; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fill(); }
    if (this.ignite > 0) { ctx.fillStyle = 'rgba(255,107,53,0.6)'; ctx.beginPath(); ctx.arc(rand(-r, r) * 0.6, -r + rand(-6, 2), 3, 0, Math.PI * 2); ctx.fill(); }
    if (this.shock > 0) { ctx.strokeStyle = 'rgba(255,233,77,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(-r * 0.3, -r * 0.2); ctx.lineTo(-r * 0.6, r * 0.3); ctx.stroke(); }
    if (this.stun > 0) { ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 0, -r - 6); }
    ctx.restore();
    // 체력 바 / 이름
    if (this.alive && this.hp < this.maxHp && !this.boss) {
      const w = Math.max(24, this.r * 2.4);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w, 4);
      ctx.fillStyle = this.rarity === 'rare' ? '#ffd23f' : '#d62828'; ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w * clamp(this.hp / this.maxHp, 0, 1), 4);
    }
    if (this.alive && (this.rarity === 'rare' || this.rarity === 'magic') && !this.boss) {
      ctx.font = `${this.rarity === 'rare' ? 'bold ' : ''}11px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = this.rarity === 'rare' ? '#ffd23f' : '#9bb3ff'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      const label = this.name + (this.rarity === 'rare' ? ` [${this.mods.map(m => MON_MODS[m].name).join('·')}]` : '');
      ctx.strokeText(label, this.x, this.y - this.r - 16); ctx.fillText(label, this.x, this.y - this.r - 16);
    }
  }
}
