'use strict';
// ===================== 플레이어 =====================
class Player {
  constructor(cls, name, hardcore) {
    this.cls = cls; this.name = name || '추방자'; this.hardcore = !!hardcore;
    this.x = 0; this.y = 0; this.r = CFG.PLAYER_RADIUS; this.facing = 0; this.vx = 0; this.vy = 0;
    this.level = 1; this.xp = 0; this.bonusPoints = 0;
    this.passives = new Set([Passives.startNode(cls)]);
    this.equipment = {}; this.inventory = new Array(CFG.INV_SLOTS).fill(null);
    this.sockets = Array.from({ length: CFG.SKILL_SLOTS }, () => ({ main: null, supports: [null, null] }));
    this.gemBag = []; this.currency = {}; this.aspects = [];
    this.buffs = []; this.cooldowns = {}; this.castTimer = 0; this.rootTimer = 0; this.slowTimer = 0; this.invuln = 0;
    this.frozen = 0; this.chill = 0; this.stun = 0; this.hitFlash = 0; this.lastSkillT = 9;
    this.dodge = { t: 0, cd: 0, dx: 0, dy: 0, trailT: 0 };
    this.ult = { active: false, t: 0, cd: 0, tick: 0 };
    this.potion = { charges: CFG.POTION_CHARGES, cd: 0 };
    this.echoQueue = [];
    this.kills = 0; this.playtime = 0; this.deaths = 0; this.mapsCleared = 0; this.tier = 1; this.maxTier = 1; this.bossKills = 0;
    this.mapMods = null; this.lootFilter = 'all';
    this.st = { ignite: 0, igniteDps: 0, bleed: 0, bleedDps: 0, shock: 0 };
    this.berserk = { stacks: 0, t: 0 };
    this.regenTick = 0; this.recalcT = 0; this.moving = false; this.animT = 0;
    this.stats = null; this.hp = 1; this.res = 0;
    this.giveStarterKit();
    this.recalc(); this.hp = this.stats.maxLife; this.res = this.stats.maxRes * 0.6;
  }
  giveStarterKit() {
    const c = CLASSES[this.cls];
    const w = makeItem('weapon', 1, 'normal', { base: c.weapon }); this.equipment.weapon = w;
    const b = makeItem('body', 1, 'normal', { base: this.cls === 'ouster' ? 'robe' : this.cls === 'vampire' ? 'leather' : 'leather' }); this.equipment.body = b;
    c.startGems.forEach((g, i) => { this.sockets[i].main = makeGem(g, 1); });
    c.startSupports.forEach((g, i) => { this.sockets[0].supports[i] = makeGem(g, 1, true); });
    this.currency = { transmute: 3, alteration: 3, augment: 1, alchemy: 1, essence: 0 };
  }
  recalc() {
    this.stats = computeStats(this);
    this.hp = Math.min(this.hp, this.stats.maxLife); this.res = Math.min(this.res, this.stats.maxRes);
    this.potion.charges = Math.min(this.potion.charges, this.stats.potionCharges);
  }
  gainRes(n) { this.res = clamp(this.res + n, 0, this.stats.maxRes); }
  heal(n) { if (n <= 0) return; this.hp = Math.min(this.stats.maxLife, this.hp + n); }
  xpToNext(l) { return Math.round(80 * Math.pow(l, 1.85)); }
  addXP(n) {
    if (this.level >= CFG.MAX_LEVEL) return;
    this.xp += n;
    while (this.xp >= this.xpToNext(this.level) && this.level < CFG.MAX_LEVEL) {
      this.xp -= this.xpToNext(this.level); this.level++;
      this.recalc(); this.hp = this.stats.maxLife; this.res = this.stats.maxRes;
      Audio_.play('levelup'); Game.announce(`레벨 ${this.level} 달성! 패시브 포인트 +1`, '#ffd23f');
      World.burst(this.x, this.y, '#ffd23f', 40, 220, 1.0);
    }
    // 젬 경험치
    for (const s of this.sockets) { if (s.main) this.gemXP(s.main, n * 0.6); for (const g of s.supports) if (g) this.gemXP(g, n * 0.4); }
  }
  gemXP(g, n) {
    if (g.level >= CFG.MAX_GEM_LEVEL) return;
    g.xp += n;
    while (g.xp >= gemXPNeeded(g.level) && g.level < CFG.MAX_GEM_LEVEL) { g.xp -= gemXPNeeded(g.level); g.level++; Game.flash(`${gemDef(g).name} 젬 레벨 ${g.level}`); }
  }
  addItem(item) { const i = this.inventory.indexOf(null); if (i < 0) return false; this.inventory[i] = item; return true; }
  invCount() { return this.inventory.filter(x => x).length; }
  equipSlotFor(item) {
    if (item.slot === 'ring') return !this.equipment.ring1 ? 'ring1' : !this.equipment.ring2 ? 'ring2' : 'ring1';
    return item.slot;
  }
  equip(item) {
    const idx = this.inventory.indexOf(item);
    const slot = this.equipSlotFor(item);
    const prev = this.equipment[slot];
    this.equipment[slot] = item;
    if (idx >= 0) this.inventory[idx] = prev || null; else if (prev) this.addItem(prev);
    this.recalc(); Audio_.play('ui'); return true;
  }
  unequip(slot) {
    const it = this.equipment[slot]; if (!it) return false;
    if (!this.addItem(it)) { Game.flash('인벤토리가 가득 찼습니다'); return false; }
    delete this.equipment[slot]; this.recalc(); return true;
  }
  addCurrency(id, n = 1) { this.currency[id] = (this.currency[id] || 0) + n; }
  addBuff(b) {
    const ex = this.buffs.find(x => x.id === b.id);
    if (ex) { ex.t = b.t; if (b.stackMax) ex.stacks = Math.min(b.stackMax, (ex.stacks || 1) + 1); }
    else this.buffs.push(Object.assign({ stacks: 1 }, b));
    this.recalc();
  }
  usePotion() {
    if (this.potion.charges <= 0 || this.potion.cd > 0) { if (this.potion.charges <= 0) Game.flash('포션 충전이 없습니다'); return false; }
    this.potion.charges--; this.potion.cd = 0.8;
    this.heal(this.stats.maxLife * CFG.POTION_HEAL_PCT);
    this.addBuff({ id: 'potion', name: '포션 회복', t: 3, mods: { life_regen: this.stats.maxLife * 0.05 }, icon: '🧪', color: '#e63946' });
    Audio_.play('potion'); World.burst(this.x, this.y, '#e63946', 14, 100, 0.6);
    if (this.stats.aspects.has('potion_nova')) {
      const dmg = this.stats.maxLife * 2;
      Combat.areaHitRaw(this.x, this.y, 160, { phys: dmg * 0.5, fire: dmg * 0.5 }, { knock: 200, tags: ['aoe'] });
      World.addZone({ type: 'ring', x: this.x, y: this.y, r: 160, t: 0, dur: 0.35, color: '#e63946' }); Game.shake(5);
    }
    return true;
  }
  tryDodge(dirX, dirY) {
    if (this.dodge.cd > 0 || this.dodge.t > 0 || this.frozen > 0 || this.stun > 0) return false;
    let dx = dirX, dy = dirY;
    if (!dx && !dy) { dx = Math.cos(this.facing); dy = Math.sin(this.facing); }
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    this.dodge.t = CFG.DODGE_TIME; this.dodge.cd = this.stats.dodgeCd; this.dodge.dx = dx; this.dodge.dy = dy; this.dodge.trailT = 0;
    this.castTimer = 0; this.rootTimer = 0;
    Audio_.play('dodge');
    return true;
  }
  update(dt) {
    this.playtime += dt; this.animT += dt; this.lastSkillT += dt;
    for (const k of ['castTimer', 'rootTimer', 'slowTimer', 'invuln', 'frozen', 'chill', 'stun', 'hitFlash']) if (this[k] > 0) this[k] -= dt;
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k] -= dt;
    if (this.dodge.cd > 0) this.dodge.cd -= dt;
    if (this.potion.cd > 0) this.potion.cd -= dt;
    // 반복 시전 큐
    for (let i = this.echoQueue.length - 1; i >= 0; i--) { const e = this.echoQueue[i]; e.t -= dt; if (e.t <= 0) { this.echoQueue.splice(i, 1); Skills.use(this, e.slot, e.tx, e.ty, { echo: true }); } }
    // 버프
    let changed = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) { this.buffs[i].t -= dt; if (this.buffs[i].t <= 0) { this.buffs.splice(i, 1); changed = true; } }
    if (this.berserk.stacks > 0) { this.berserk.t -= dt; if (this.berserk.t <= 0) { this.berserk.stacks = 0; this.buffs = this.buffs.filter(b => b.id !== 'berserk'); changed = true; } }
    this.recalcT += dt; if (changed || this.recalcT > 0.5) { this.recalcT = 0; this.recalc(); }
    // 재생
    const noRegen = this.mapMods && this.mapMods.no_regen;
    if (!noRegen) this.heal(this.stats.lifeRegen * dt);
    this.res = clamp(this.res + this.stats.resRegen * dt, 0, this.stats.maxRes);
    // 상태이상
    if (this.st.ignite > 0) { this.st.ignite -= dt; this.hp -= this.st.igniteDps * dt; if (Math.random() < dt * 6) World.particles.push(new Particle(this.x + rand(-8, 8), this.y + rand(-8, 8), rand(-10, 10), -40, 0.4, '#ff6b35', 4)); }
    if (this.st.bleed > 0) { this.st.bleed -= dt; this.hp -= this.st.bleedDps * dt * (this.moving ? 1.5 : 1); }
    if (this.st.shock > 0) this.st.shock -= dt;
    if (this.hp <= 0) Game.playerDied('상태이상');
    Ult.update(this, dt);
  }
  speedMult() {
    let m = 1;
    if (this.slowTimer > 0 && !this.dodge.t) m *= 0.6;
    if (this.chill > 0 && !this.stats.flags.has('no_evasion')) m *= 0.7;
    return m;
  }
  draw(ctx) {
    const c = CLASSES[this.cls]; ctx.save(); ctx.translate(this.x, this.y);
    const bat = this.ult.active && this.cls === 'vampire';
    if (this.invuln > 0 || this.dodge.t > 0) ctx.globalAlpha = 0.6;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 10, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (bat) {
      const flap = Math.sin(this.animT * 25) * 0.6;
      ctx.fillStyle = '#3b0a14'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, -8 + flap * 8); ctx.lineTo(-22, 4 + flap * 6); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, -8 + flap * 8); ctx.lineTo(22, 4 + flap * 6); ctx.lineTo(6, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    const bob = this.moving ? Math.sin(this.animT * 12) * 1.5 : 0;
    // 망토
    ctx.fillStyle = this.cls === 'vampire' ? '#3a0a12' : this.cls === 'slayer' ? '#2b2b3a' : '#14352a';
    ctx.beginPath(); ctx.moveTo(-10, -6 + bob); ctx.quadraticCurveTo(-14, 8, -9, 12 + bob); ctx.lineTo(9, 12 + bob); ctx.quadraticCurveTo(14, 8, 10, -6 + bob); ctx.closePath(); ctx.fill();
    // 몸
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(0, bob, 9, 0, Math.PI * 2); ctx.fill();
    // 머리
    ctx.fillStyle = this.cls === 'vampire' ? '#f2e6e6' : this.cls === 'ouster' ? '#d8f3dc' : '#f1d3b3'; ctx.beginPath(); ctx.arc(0, -9 + bob, 6, 0, Math.PI * 2); ctx.fill();
    // 무기
    const wp = this.equipment.weapon; const base = wp ? BASE_BY_ID[wp.base].id : c.weapon;
    ctx.save(); ctx.rotate(this.facing);
    const swing = this.lastSkillT < 0.2 ? Math.sin(this.lastSkillT / 0.2 * Math.PI) * 0.9 : 0;
    ctx.rotate(-swing);
    ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    if (base === 'gun' || base === 'rifle') { ctx.fillStyle = '#444'; ctx.fillRect(4, -2, base === 'rifle' ? 24 : 16, 4); ctx.fillStyle = '#8a6d3b'; ctx.fillRect(4, 0, 6, 5); }
    else if (base === 'staff' || base === 'wand') { ctx.strokeStyle = '#8a6d3b'; ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(base === 'staff' ? 24 : 16, -4); ctx.stroke(); ctx.fillStyle = c.accent; ctx.shadowColor = c.accent; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(base === 'staff' ? 24 : 16, -4, 4, 0, Math.PI * 2); ctx.fill(); }
    else if (base === 'scythe') { ctx.strokeStyle = '#5a3d2b'; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(18, -6); ctx.stroke(); ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(14, -14, 12, 0.3, 1.9); ctx.stroke(); }
    else if (base === 'axe') { ctx.strokeStyle = '#5a3d2b'; ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(18, -4); ctx.stroke(); ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(24, -4); ctx.lineTo(16, 2); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(base === 'dagger' ? 16 : 24, -4); ctx.stroke(); }
    ctx.restore();
    if (this.ult.active) { ctx.strokeStyle = hexA(c.color, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(this.animT * 8) * 2, 0, Math.PI * 2); ctx.stroke(); }
    if (this.frozen > 0) { ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  serialize() {
    return {
      v: 1, cls: this.cls, name: this.name, hardcore: this.hardcore, level: this.level, xp: this.xp, bonusPoints: this.bonusPoints,
      passives: [...this.passives], equipment: this.equipment, inventory: this.inventory, sockets: this.sockets, gemBag: this.gemBag,
      currency: this.currency, aspects: this.aspects, kills: this.kills, playtime: this.playtime, deaths: this.deaths, mapsCleared: this.mapsCleared,
      tier: this.tier, maxTier: this.maxTier, bossKills: this.bossKills, lootFilter: this.lootFilter, clock: Clock.t, potion: this.potion.charges,
    };
  }
  static deserialize(d) {
    const p = new Player(d.cls, d.name, d.hardcore);
    p.level = d.level; p.xp = d.xp; p.bonusPoints = d.bonusPoints || 0;
    p.passives = new Set(d.passives); p.equipment = d.equipment || {}; p.inventory = d.inventory || new Array(CFG.INV_SLOTS).fill(null);
    while (p.inventory.length < CFG.INV_SLOTS) p.inventory.push(null);
    p.sockets = d.sockets; p.gemBag = d.gemBag || []; p.currency = d.currency || {}; p.aspects = d.aspects || [];
    p.kills = d.kills || 0; p.playtime = d.playtime || 0; p.deaths = d.deaths || 0; p.mapsCleared = d.mapsCleared || 0;
    p.tier = d.tier || 1; p.maxTier = d.maxTier || 1; p.bossKills = d.bossKills || 0; p.lootFilter = d.lootFilter || 'all';
    if (typeof d.clock === 'number') Clock.t = d.clock;
    p.recalc(); p.hp = p.stats.maxLife; p.res = p.stats.maxRes * 0.6; p.potion.charges = p.stats.potionCharges;
    return p;
  }
}
