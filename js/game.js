'use strict';
// ===================== 게임 루프 / 렌더 =====================
const Game = {
  canvas: null, ctx: null, W: 0, H: 0, state: 'title', player: null,
  cam: { x: 0, y: 0 }, shakeT: 0, shakeAmt: 0, hurtFlash: 0, announces: [], flashes: [], time: 0, last: 0,
  lightCanvas: null, lightCtx: null, mapOptions: [], labelsOn: true, paused: false, hoverDrop: null, labelRects: [], clearStats: null, fps: 0, frames: 0, fpsT: 0,
  init() {
    this.canvas = el('game'); this.ctx = this.canvas.getContext('2d');
    this.lightCanvas = document.createElement('canvas'); this.lightCtx = this.lightCanvas.getContext('2d');
    window.addEventListener('resize', () => this.resize()); this.resize();
    Input.init(this.canvas); UI.init();
    this.canvas.addEventListener('mousedown', e => { if (e.button === 0) this.onClick(e); });
    UI.showTitle();
    requestAnimationFrame(t => this.loop(t));
  },
  resize() {
    this.W = this.canvas.width = window.innerWidth; this.H = this.canvas.height = window.innerHeight;
    this.lightCanvas.width = this.W; this.lightCanvas.height = this.H;
  },
  // ---------- 상태 전환 ----------
  newGame(cls, name, hardcore) {
    this.player = new Player(cls, name, hardcore); Clock.t = 0.14; Clock.forced = null; Clock.bloodMoon = false;
    Save.save(); this.gotoMapSelect();
  },
  continueGame() { const p = Save.load(); if (!p) return false; this.player = p; this.gotoMapSelect(); return true; },
  gotoMapSelect() {
    this.state = 'mapselect'; World.active = false; Clock.forced = null; Clock.bloodMoon = false;
    const p = this.player; p.mapMods = null; p.recalc(); p.hp = p.stats.maxLife; p.res = p.stats.maxRes; p.potion.charges = p.stats.potionCharges; p.buffs = []; p.st = { ignite: 0, igniteDps: 0, bleed: 0, bleedDps: 0, shock: 0 }; p.ult.active = false;
    this.mapOptions = makeMapOptions(p);
    UI.hideHUD(); UI.closePanels(); UI.showMapSelect(); Save.save();
  },
  startMap(def) {
    World.bossAnnounced = false; World.generate(def); this.player.tier = def.tier;
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.state = 'play'; UI.hideScreens(); UI.showHUD();
    this.announce(`${THEMES[def.theme].name} · 티어 ${def.tier}`, '#ffffff', 3);
    if (this.player.mapsCleared === 0 && this.player.deaths === 0) { this.announce('WASD 이동 · 좌클릭 공격 · Space 회피 · R 포션 · F 궁극기', '#9fe1a5', 7); this.announce('보스를 찾아 처치하면 포탈이 열린다 (미니맵의 붉은 점)', '#ffd23f', 7); }
    this.mapStart = { kills: this.player.kills, xp: this.player.xp, level: this.player.level, t: this.player.playtime };
    Audio_.play('portal');
  },
  mapCleared() {
    if (this.state !== 'play') return;
    const p = this.player; p.mapsCleared++;
    this.clearStats = { kills: p.kills - this.mapStart.kills, levels: p.level - this.mapStart.level, time: p.playtime - this.mapStart.t, tier: World.tier, theme: World.theme.name };
    this.state = 'mapclear'; World.active = false; UI.hideHUD(); UI.closePanels(); UI.showMapClear(this.clearStats); Save.save();
  },
  leaveMap() { if (this.state !== 'play') return; this.flash('피난처로 귀환'); this.gotoMapSelect(); },
  playerDied(cause) {
    if (this.state !== 'play') return;
    const p = this.player; p.deaths++; p.hp = 0;
    Audio_.play('death'); this.state = 'dead'; World.active = false;
    let msg;
    if (p.hardcore) { Save.clear(); msg = '하드코어 캐릭터는 영원히 잠들었습니다.'; }
    else { const loss = Math.round(p.xp * 0.1); p.xp -= loss; msg = `경험치 ${fmt(loss)}을(를) 잃었습니다.`; Save.save(); }
    UI.hideHUD(); UI.closePanels(); UI.showDeath(cause, msg);
  },
  announce(text, color = '#fff', dur = 2.5) { this.announces.push({ text, color, t: dur, max: dur }); if (this.announces.length > 3) this.announces.shift(); },
  flash(text, color = '#ddd') { this.flashes.push({ text, color, t: 2 }); if (this.flashes.length > 4) this.flashes.shift(); },
  shake(n) { this.shakeAmt = Math.max(this.shakeAmt, n); this.shakeT = 0.25; },
  // ---------- 입력 ----------
  onKey(k, e) {
    if (this.state === 'play') {
      if (k === 'escape') { if (UI.anyPanelOpen()) UI.closePanels(); else UI.togglePanel('menu'); return; }
      if (k === 'i') UI.togglePanel('inv'); else if (k === 'k') UI.togglePanel('gems'); else if (k === 'p') UI.togglePanel('tree'); else if (k === 'c') UI.togglePanel('char');
      else if (k === 'z') { this.labelsOn = !this.labelsOn; this.flash(this.labelsOn ? '아이템 라벨 표시' : '아이템 라벨 숨김'); }
      else if (k === 't' && !UI.anyPanelOpen()) this.leaveMap();
      else if (k === 'm') { Audio_.enabled = !Audio_.enabled; this.flash(Audio_.enabled ? '사운드 켜짐' : '사운드 꺼짐'); }
    } else if (k === 'escape') { UI.closePanels(); }
  },
  screenToWorld(sx, sy) { return { x: sx - this.W / 2 + this.cam.x, y: sy - this.H / 2 + this.cam.y }; },
  onClick(e) {
    if (this.state !== 'play' || this.paused) return;
    if (this.hoverDrop) { const d = this.hoverDrop; const p = this.player; if (dist(d.x, d.y, p.x, p.y) < 70) World.pickup(d); else p.autoTarget = d; this.clickConsumed = true; }
  },
  handleInput(dt) {
    const p = this.player; const m = Input.mouse;
    let dx = 0, dy = 0;
    if (Input.down('w') || Input.down('arrowup')) dy -= 1; if (Input.down('s') || Input.down('arrowdown')) dy += 1;
    if (Input.down('a') || Input.down('arrowleft')) dx -= 1; if (Input.down('d') || Input.down('arrowright')) dx += 1;
    if (dx || dy) p.autoTarget = null;
    if (p.autoTarget) { const t = p.autoTarget; if (!t.alive) p.autoTarget = null; else if (dist(t.x, t.y, p.x, p.y) < 40) { World.pickup(t); p.autoTarget = null; } else { const a = angleTo(p.x, p.y, t.x, t.y); dx = Math.cos(a); dy = Math.sin(a); } }
    const wm = this.screenToWorld(m.x, m.y);
    if (!(p.castTimer > 0 && p.rootTimer > 0)) p.facing = angleTo(p.x, p.y, wm.x, wm.y);
    // 회피
    if (Input.wasPressed(' ')) p.tryDodge(dx, dy);
    if (p.dodge.t > 0) {
      p.dodge.t -= dt; const spd = CFG.DODGE_DIST / CFG.DODGE_TIME;
      World.moveEntity(p, p.dodge.dx * spd * dt, p.dodge.dy * spd * dt);
      p.dodge.trailT -= dt; if (p.dodge.trailT <= 0) { p.dodge.trailT = 0.04; World.particles.push(new Particle(p.x, p.y, 0, 0, 0.3, hexA(CLASSES[p.cls].color, 0.6), 8)); if (p.stats.aspects.has('fire_trail')) World.addZone({ type: 'ground', owner: 'player', x: p.x, y: p.y, r: 30, t: 0, dur: 2.5, tick: 0.4, tickT: 0.2, skill: this.fireTrailSkill(p), color: '#ff6b35' }); }
      p.moving = true; p.vx = p.dodge.dx * spd; p.vy = p.dodge.dy * spd;
    } else {
      const len = Math.hypot(dx, dy);
      if (len > 0 && p.rootTimer <= 0 && p.frozen <= 0 && p.stun <= 0) {
        dx /= len; dy /= len; const spd = p.stats.moveSpeed * p.speedMult();
        World.moveEntity(p, dx * spd * dt, dy * spd * dt); p.moving = true; p.vx = dx * spd; p.vy = dy * spd;
      } else { p.moving = false; p.vx = p.vy = 0; }
    }
    // 스킬
    if (this.clickConsumed) { if (!m.l) this.clickConsumed = false; }
    else if (m.l && !this.hoverDrop) Skills.use(p, 0, wm.x, wm.y);
    if (m.r) Skills.use(p, 1, wm.x, wm.y);
    for (let i = 0; i < 4; i++) if (Input.down(String(i + 1))) Skills.use(p, i + 2, wm.x, wm.y);
    if (Input.wasPressed('r')) p.usePotion();
    if (Input.wasPressed('f')) Ult.use(p);
  },
  fireTrailSkill(p) {
    if (!this._fireTrail || this._fireTrailLvl !== p.level) {
      const base = 4 + p.level * 1.5; const inc = 1 + p.stats.inc.inc_dmg + p.stats.inc.inc_fire + p.stats.inc.inc_ele;
      this._fireTrail = { def: { kind: 'ground', color: '#ff6b35', tags: ['fire', 'dot'] }, dmg: { phys: { min: 0, max: 0 }, fire: { min: base * inc, max: base * 1.5 * inc }, cold: { min: 0, max: 0 }, light: { min: 0, max: 0 }, chaos: { min: 0, max: 0 } }, critChance: 0, critMulti: 1, tags: ['fire', 'dot', 'aoe'], ailments: { ignite: 1 }, leech: 0, isAttack: false, knock: 0 };
      this._fireTrailLvl = p.level;
    }
    return this._fireTrail;
  },
  // ---------- 루프 ----------
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016); this.last = ts; this.time += dt;
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames; this.frames = 0; this.fpsT = 0; }
    try { this.update(dt); this.render(); } catch (err) { console.error(err); }
    Input.endFrame();
    requestAnimationFrame(t => this.loop(t));
  },
  update(dt) {
    for (const a of this.announces) a.t -= dt; this.announces = this.announces.filter(a => a.t > 0);
    for (const f of this.flashes) f.t -= dt; this.flashes = this.flashes.filter(f => f.t > 0);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.state !== 'play') return;
    this.paused = UI.anyPanelOpen();
    if (this.paused) { UI.updateHUD(dt); return; }
    const p = this.player;
    this.updateHover();
    this.handleInput(dt);
    p.update(dt);
    if (this.state !== 'play') return;
    World.update(dt);
    Clock.update(dt);
    this.cam.x = lerp(this.cam.x, p.x, Math.min(1, dt * 9)); this.cam.y = lerp(this.cam.y, p.y, Math.min(1, dt * 9));
    UI.updateHUD(dt);
    this.autosaveT = (this.autosaveT || 0) + dt; if (this.autosaveT > 30) { this.autosaveT = 0; Save.save(); }
  },
  updateHover() {
    const m = Input.mouse; this.hoverDrop = null;
    for (let i = this.labelRects.length - 1; i >= 0; i--) { const r = this.labelRects[i]; if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) { this.hoverDrop = r.drop; break; } }
    if (!this.hoverDrop) { const wm = this.screenToWorld(m.x, m.y); let bd = 18; for (const d of World.drops) { if (!d.visible(this.player.lootFilter)) continue; const dd = dist(wm.x, wm.y, d.x, d.y); if (dd < bd) { bd = dd; this.hoverDrop = d; } } }
    this.canvas.style.cursor = this.hoverDrop ? 'pointer' : 'crosshair';
  },
  // ---------- 렌더 ----------
  render() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, W, H);
    if (!World.floorCanvas || (this.state !== 'play' && this.state !== 'dead' && this.state !== 'mapclear')) { this.renderBackdrop(ctx); return; }
    const p = this.player;
    const sx = this.shakeAmt ? rand(-this.shakeAmt, this.shakeAmt) : 0, sy = this.shakeAmt ? rand(-this.shakeAmt, this.shakeAmt) : 0;
    const ox = Math.round(-this.cam.x + W / 2 + sx), oy = Math.round(-this.cam.y + H / 2 + sy);
    ctx.save(); ctx.translate(ox, oy);
    // 바닥
    const vx0 = clamp(this.cam.x - W / 2 - 32, 0, World.floorCanvas.width), vy0 = clamp(this.cam.y - H / 2 - 32, 0, World.floorCanvas.height);
    const vw = Math.min(World.floorCanvas.width - vx0, W + 64), vh = Math.min(World.floorCanvas.height - vy0, H + 64);
    if (vw > 0 && vh > 0) { ctx.drawImage(World.floorCanvas, vx0, vy0, vw, vh, vx0, vy0, vw, vh); ctx.drawImage(World.decalCanvas, vx0, vy0, vw, vh, vx0, vy0, vw, vh); }
    const inView = (x, y, r = 60) => x > this.cam.x - W / 2 - r && x < this.cam.x + W / 2 + r && y > this.cam.y - H / 2 - r && y < this.cam.y + H / 2 + r;
    // 바닥 존
    this.renderRift(ctx); this.renderShrines(ctx); this.renderPortal(ctx);
    for (const z of World.zones) if (inView(z.x, z.y, 300)) this.renderZone(ctx, z, true);
    for (const d of World.drops) if (inView(d.x, d.y) && d.visible(p.lootFilter)) d.draw(ctx);
    // 엔티티
    const ents = World.monsters.filter(m => inView(m.x, m.y, 80));
    ents.sort((a, b) => a.y - b.y);
    for (const m of ents) m.draw(ctx);
    for (const mn of World.minions) mn.draw(ctx);
    if (this.state !== 'dead') p.draw(ctx);
    for (const pr of World.projectiles) if (inView(pr.x, pr.y)) pr.draw(ctx);
    for (const z of World.zones) if (inView(z.x, z.y, 300)) this.renderZone(ctx, z, false);
    for (const pt of World.particles) if (inView(pt.x, pt.y)) pt.draw(ctx);
    for (const d of World.dmgNums) d.draw(ctx);
    ctx.restore();
    // 조명
    this.renderLighting(ctx, ox, oy);
    // 라벨
    this.renderLabels(ctx, ox, oy);
    // 피격 비네트
    if (this.hurtFlash > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${this.hurtFlash * 1.6})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (p.hp < p.stats.maxLife * 0.25 && this.state === 'play') { const a = 0.15 + Math.sin(this.time * 6) * 0.1; const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(120,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // 공지
    this.renderAnnounces(ctx);
  },
  renderBackdrop(ctx) {
    const W = this.W, H = this.H; const t = this.time;
    const g = ctx.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.4, H); g.addColorStop(0, '#2a0a14'); g.addColorStop(1, '#05030a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 달
    ctx.fillStyle = '#c9142a'; ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 60; ctx.beginPath(); ctx.arc(W / 2, H * 0.32, 90, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(W / 2 + 40, H * 0.30, 80, 0, Math.PI * 2); ctx.fill();
    // 안개
    for (let i = 0; i < 8; i++) { const x = (i * 197 + t * 15 * (1 + i % 3)) % (W + 300) - 150; ctx.fillStyle = `rgba(120,20,40,${0.04 + (i % 3) * 0.02})`; ctx.beginPath(); ctx.ellipse(x, H * 0.75 + (i % 4) * 30, 220, 50, 0, 0, Math.PI * 2); ctx.fill(); }
  },
  renderZone(ctx, z, ground) {
    const prog = clamp(z.t / z.dur, 0, 1);
    if (ground) {
      if (z.type === 'telegraph') {
        ctx.strokeStyle = z.owner === 'monster' ? 'rgba(255,60,60,0.8)' : hexA(z.color, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = z.owner === 'monster' ? `rgba(255,40,40,${0.15 + prog * 0.25})` : hexA(z.color, 0.15 + prog * 0.2); ctx.beginPath(); ctx.arc(z.x, z.y, z.r * prog, 0, Math.PI * 2); ctx.fill();
        if (z.label) { ctx.fillStyle = '#fff'; ctx.font = '11px "Noto Sans KR"'; ctx.textAlign = 'center'; ctx.fillText(z.label, z.x, z.y - z.r - 4); }
      } else if (z.type === 'ground' || z.type === 'tornado') {
        const a = z.type === 'tornado' ? 0.35 : 0.25 * (1 - prog * 0.5);
        ctx.fillStyle = hexA(z.color, a); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA(z.color, 0.6); ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -z.t * 40; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (z.type === 'tornado') { ctx.strokeStyle = hexA(z.color, 0.8); ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.3 + i * 0.3), z.t * 6 + i, z.t * 6 + i + 2); ctx.stroke(); } }
      } else if (z.type === 'storm') {
        ctx.strokeStyle = hexA(z.color, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      } else if (z.type === 'beamwarn') {
        ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.a); ctx.fillStyle = `rgba(255,60,60,${0.15 + prog * 0.3})`; ctx.fillRect(0, -z.w / 2, z.len, z.w); ctx.strokeStyle = 'rgba(255,80,80,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(0, -z.w / 2, z.len * prog, z.w); ctx.restore();
      }
    } else {
      if (z.type === 'ring') { ctx.strokeStyle = hexA(z.color, 1 - prog); ctx.lineWidth = 4 * (1 - prog) + 1; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.3 + prog * 0.7), 0, Math.PI * 2); ctx.stroke(); }
      else if (z.type === 'slash') { ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.a); ctx.fillStyle = hexA(z.color, 0.45 * (1 - prog)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, z.r, -z.arc / 2, z.arc / 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = hexA('#ffffff', 0.7 * (1 - prog)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, z.r * (0.6 + prog * 0.4), -z.arc / 2, z.arc / 2); ctx.stroke(); ctx.restore(); }
      else if (z.type === 'beam') { ctx.strokeStyle = hexA(z.color, 0.9 * (1 - prog)); ctx.lineWidth = (z.w || 10) * (1 - prog * 0.5); ctx.lineCap = 'round'; ctx.shadowColor = z.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x2, z.y2); ctx.stroke(); ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - prog)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x2, z.y2); ctx.stroke(); }
      else if (z.type === 'strike') { ctx.strokeStyle = hexA(z.color, 1 - prog); ctx.lineWidth = 3; ctx.shadowColor = z.color; ctx.shadowBlur = 15; ctx.beginPath(); let x = z.x + rand(-6, 6), y = z.y - 400; ctx.moveTo(x, y); for (let i = 0; i < 6; i++) { y += 400 / 6; x += rand(-14, 14); ctx.lineTo(x, y); } ctx.lineTo(z.x, z.y); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = hexA(z.color, 0.4 * (1 - prog)); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  renderRift(ctx) {
    const r = World.rift; if (!r || r.state === 'done') return;
    const t = World.time;
    ctx.strokeStyle = r.state === 'active' ? 'rgba(199,125,255,0.9)' : 'rgba(199,125,255,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,60,200,0.12)'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c77dff'; ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(r.x, r.y - 20); ctx.lineTo(r.x + 12, r.y); ctx.lineTo(r.x, r.y + 20); ctx.lineTo(r.x - 12, r.y); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Noto Sans KR"'; ctx.textAlign = 'center';
    ctx.fillText(r.state === 'active' ? `균열 ${Math.ceil(30 - r.t)}초` : '균열 (진입하여 시작)', r.x, r.y - 34);
  },
  renderShrines(ctx) {
    for (const s of World.shrines) {
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.fillStyle = s.used ? '#333' : '#5a4d70'; ctx.fillRect(-10, -14, 20, 22); ctx.fillStyle = s.used ? '#444' : '#8a7aa8'; ctx.fillRect(-12, -18, 24, 5);
      if (!s.used) { const c = { power: '#ff5c5c', haste: '#f0d78c', life: '#9fe1a5', crit: '#ffffff', protect: '#7b9bff' }[s.type]; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 16 + Math.sin(s.t * 4) * 6; ctx.beginPath(); ctx.arc(0, -24, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = '11px "Noto Sans KR"'; ctx.textAlign = 'center'; ctx.fillText({ power: '힘의 제단', haste: '신속의 제단', life: '생명의 제단', crit: '치명의 제단', protect: '수호의 제단' }[s.type], 0, -36); }
      ctx.restore();
    }
  },
  renderPortal(ctx) {
    const pt = World.portal; if (!pt) return;
    ctx.save(); ctx.translate(pt.x, pt.y);
    const s = Math.min(1, pt.t);
    ctx.fillStyle = 'rgba(80,110,255,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 34 * s, 46 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7b9bff'; ctx.lineWidth = 3; ctx.shadowColor = '#7b9bff'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.ellipse(0, 0, 30 * s, 42 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 30 * s, pt.t, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Noto Sans KR"'; ctx.textAlign = 'center'; ctx.fillText('귀환 포탈 (진입하여 완료)', 0, -56);
    ctx.restore();
  },
  renderLighting(ctx, ox, oy) {
    const dark = Clock.darkness(); if (dark < 0.06 && !Clock.bloodMoon) return;
    const lc = this.lightCtx, W = this.W, H = this.H; const p = this.player;
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = Clock.bloodMoon ? `rgba(28,0,8,${dark})` : `rgba(5,3,14,${dark})`; lc.clearRect(0, 0, W, H); lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, a = 1) => { const g = lc.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lc.fillStyle = g; lc.beginPath(); lc.arc(x + ox, y + oy, r, 0, Math.PI * 2); lc.fill(); };
    light(p.x, p.y, 340 + (p.cls === 'vampire' ? 80 : 0), 0.95);
    for (const pr of World.projectiles) if (pr.light || pr.owner === 'player') light(pr.x, pr.y, 60, 0.6);
    for (const z of World.zones) if (z.type === 'ground' || z.type === 'telegraph' || z.type === 'strike' || z.type === 'beam') light(z.x, z.y, (z.r || 40) + 40, 0.5);
    for (const s of World.shrines) if (!s.used) light(s.x, s.y, 110, 0.7);
    if (World.portal) light(World.portal.x, World.portal.y, 160, 0.9);
    if (World.rift && World.rift.state !== 'done') light(World.rift.x, World.rift.y, 200, 0.5);
    for (const m of World.monsters) if (m.alive && (m.typeId === 'hound' || m.boss || m.rarity === 'rare')) light(m.x, m.y, 70, 0.5);
    ctx.drawImage(this.lightCanvas, 0, 0);
    if (Clock.bloodMoon) { ctx.fillStyle = 'rgba(200,0,30,0.07)'; ctx.fillRect(0, 0, W, H); }
  },
  renderLabels(ctx, ox, oy) {
    this.labelRects = [];
    const p = this.player; const show = this.labelsOn;
    ctx.font = '12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const rows = [];
    for (const d of World.drops) {
      if (!d.visible(p.lootFilter)) continue;
      const sx = d.x + ox, sy = d.y + oy; if (sx < -100 || sx > this.W + 100 || sy < -50 || sy > this.H + 50) continue;
      if (!show && this.hoverDrop !== d && d.kind === 'item' && d.data.rarity === 'normal') continue;
      const w = ctx.measureText(d.label.text).width + 12; rows.push({ drop: d, x: sx - w / 2, y: sy - 28, w, h: 18 });
    }
    rows.sort((a, b) => a.y - b.y);
    // 겹침 방지
    for (let i = 0; i < rows.length; i++) for (let j = 0; j < i; j++) { const a = rows[i], b = rows[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && Math.abs(a.y - b.y) < 19) a.y = b.y - 19; }
    for (const r of rows) {
      const hov = this.hoverDrop === r.drop;
      ctx.fillStyle = hov ? '#ffffff' : r.drop.label.bg; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = hov ? '#000' : r.drop.label.color; ctx.fillText(r.drop.label.text, r.x + 6, r.y + r.h / 2);
      this.labelRects.push(r);
    }
    ctx.textBaseline = 'alphabetic';
  },
  renderAnnounces(ctx) {
    const W = this.W; let y = 120;
    for (const a of this.announces) {
      const alpha = Math.min(1, a.t / 0.5, (a.max - a.t) / 0.3 + 0.2);
      ctx.globalAlpha = clamp(alpha, 0, 1); ctx.font = 'bold 24px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(a.text, W / 2, y); ctx.fillStyle = a.color; ctx.fillText(a.text, W / 2, y); y += 34;
    }
    ctx.globalAlpha = 1;
    let fy = this.H - 150;
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; ctx.globalAlpha = clamp(f.t, 0, 1); ctx.font = '13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.text, W / 2, fy); ctx.fillStyle = f.color; ctx.fillText(f.text, W / 2, fy); fy -= 18; }
    ctx.globalAlpha = 1;
  },
};
