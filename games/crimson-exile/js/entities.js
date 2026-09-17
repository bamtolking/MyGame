'use strict';
// ===================== 투사체 =====================
class Projectile {
  constructor(o) {
    this.t = 0; this.traveled = 0; this.hits = new Set(); this.alive = true; this.returning = false;
    this.pierce = 0; this.chain = 0; this.explode = 0; this.boomerang = false; this.light = false; this.mult = 1;
    Object.assign(this, o);
    this.startX = this.x; this.startY = this.y;
    this.trail = [];
  }
  update(dt) {
    if (!this.alive) return;
    this.t += dt;
    if (this.boomerang && this.returning) {
      const p = this.ownerRef; const a = angleTo(this.x, this.y, p.x, p.y);
      const spd = Math.hypot(this.vx, this.vy); this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
      if (dist(this.x, this.y, p.x, p.y) < 22) { this.alive = false; return; }
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const step = Math.hypot(nx - this.x, ny - this.y);
    this.traveled += step;
    if (this.t % 0.03 < dt) { this.trail.push({ x: this.x, y: this.y }); if (this.trail.length > 6) this.trail.shift(); }
    if (World.wallAt(nx, ny)) {
      if (this.boomerang && !this.returning) { this.returning = true; this.hits.clear(); return; }
      this.die(); return;
    }
    this.x = nx; this.y = ny;
    if (this.owner === 'player' || this.owner === 'minion') {
      const near = World.monstersNear(this.x, this.y, this.r + 40);
      for (const m of near) {
        if (!m.alive || this.hits.has(m)) continue;
        if (dist(this.x, this.y, m.x, m.y) > this.r + m.r) continue;
        this.hits.add(m);
        const sk = this.skill;
        Combat.hitMonster(m, sk, { srcX: this.x - this.vx * 0.01, srcY: this.y - this.vy * 0.01, knock: sk.knock, mult: this.mult, minion: this.owner === 'minion' });
        if (this.explode) { this.die(); return; }
        if (this.chain > 0) {
          let best = null, bd = 260;
          for (const o of World.monstersNear(this.x, this.y, 260)) { if (!o.alive || this.hits.has(o)) continue; const d = dist(this.x, this.y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
          if (best) {
            const a = angleTo(this.x, this.y, best.x, best.y); const spd = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd; this.chain--; this.range += bd + 20;
            World.addZone({ type: 'beam', x: this.x, y: this.y, x2: best.x, y2: best.y, t: 0, dur: 0.1, color: this.color, w: 4 });
            continue;
          }
        }
        if (this.pierce > 0) { this.pierce--; continue; }
        this.die(); return;
      }
    } else if (this.owner === 'monster') {
      const p = Game.player;
      if (dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
        Combat.damagePlayer(this.dmg, this.dmgType || 'phys', { attack: false, src: this.srcMon, ailment: this.ailment });
        this.die(); return;
      }
    }
    if (this.traveled >= this.range) {
      if (this.boomerang && !this.returning) { this.returning = true; this.hits.clear(); this.traveled = 0; this.range = 2000; }
      else this.die();
    }
  }
  die() {
    if (!this.alive) return; this.alive = false;
    if (this.explode && this.skill) {
      Combat.areaHit(this.x, this.y, this.explode, this.skill, { exclude: this.hits, mult: this.mult });
      World.burst(this.x, this.y, this.color, 18, 200, 0.45);
      World.addZone({ type: 'ring', x: this.x, y: this.y, r: this.explode, t: 0, dur: 0.25, color: this.color });
      Audio_.play('explode');
    } else World.burst(this.x, this.y, this.color, 4, 80, 0.25);
  }
  draw(ctx) {
    ctx.save();
    if (this.trail.length > 1) {
      ctx.strokeStyle = hexA(this.color, 0.35); ctx.lineWidth = this.r * 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.trail[0].x, this.trail[0].y); for (const t of this.trail) ctx.lineTo(t.x, t.y); ctx.lineTo(this.x, this.y); ctx.stroke();
    }
    ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ===================== 소환수 =====================
class Minion {
  constructor(owner, sk, dur) {
    this.owner = owner; this.skill = sk; this.dur = dur; this.t = 0; this.alive = true;
    const a = rand(Math.PI * 2); this.x = owner.x + Math.cos(a) * 30; this.y = owner.y + Math.sin(a) * 30;
    this.r = 9; this.cd = 0.5; this.phase = rand(Math.PI * 2); this.target = null;
  }
  update(dt) {
    this.t += dt; if (this.t > this.dur) { this.alive = false; return; }
    const o = this.owner;
    // 주인 주위 배회
    const tx = o.x + Math.cos(this.phase + this.t * 0.8) * 55, ty = o.y + Math.sin(this.phase + this.t * 0.8) * 55;
    this.x += (tx - this.x) * Math.min(1, dt * 4); this.y += (ty - this.y) * Math.min(1, dt * 4);
    this.cd -= dt;
    if (this.cd <= 0) {
      let best = null, bd = 340;
      for (const m of World.monstersNear(this.x, this.y, 340)) { if (!m.alive) continue; const d = dist(this.x, this.y, m.x, m.y); if (d < bd && World.lineClear(this.x, this.y, m.x, m.y)) { bd = d; best = m; } }
      if (best) {
        this.cd = 0.75;
        const sk = Object.assign({}, this.skill, { projCount: 1, chain: 0, pierce: 0, projSpeedMult: 1, def: Object.assign({}, this.skill.def, { proj: { count: 1, speed: 520, range: 420, size: 6 }, color: '#90e0ef' }) });
        const p = new Projectile({ x: this.x, y: this.y, vx: 0, vy: 0, owner: 'minion', ownerRef: o, skill: sk, r: 6, range: 420, color: '#90e0ef', mult: 1 + this.skill.minionInc });
        const a = angleTo(this.x, this.y, best.x, best.y); p.vx = Math.cos(a) * 520; p.vy = Math.sin(a) * 520;
        World.projectiles.push(p);
      } else this.cd = 0.2;
    }
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(this.t * 6) * 0.12;
    ctx.fillStyle = 'rgba(144,224,239,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 14 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#caf0f8'; ctx.shadowColor = '#90e0ef'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ===================== 파티클 / 피해 숫자 =====================
class Particle {
  constructor(x, y, vx, vy, life, color, size, opts = {}) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life; this.max = life; this.color = color; this.size = size; this.grav = opts.grav || 0; this.alive = true; this.shape = opts.shape || 'circle'; }
  update(dt) { this.life -= dt; if (this.life <= 0) { this.alive = false; return; } this.x += this.vx * dt; this.y += this.vy * dt; this.vy += this.grav * dt; this.vx *= 0.96; this.vy *= 0.96; }
  draw(ctx) {
    const a = clamp(this.life / this.max, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = this.color;
    const s = this.size * (0.5 + a * 0.5);
    if (this.shape === 'square') ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
    else { ctx.beginPath(); ctx.arc(this.x, this.y, s, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}
class DmgNum {
  constructor(x, y, text, color, opts = {}) { this.x = x + rand(-8, 8); this.y = y - 10; this.text = text; this.color = color; this.life = opts.life || 0.9; this.max = this.life; this.vy = -60; this.size = opts.size || 14; this.bold = !!opts.bold; this.alive = true; }
  update(dt) { this.life -= dt; if (this.life <= 0) this.alive = false; this.y += this.vy * dt; this.vy *= 0.92; }
  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.max * 1.5, 0, 1);
    ctx.font = `${this.bold ? 'bold ' : ''}${this.size}px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color; ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1;
  }
}

// ===================== 드롭 =====================
class Drop {
  constructor(kind, data, x, y) {
    this.kind = kind; this.data = data; this.x = x; this.y = y; this.t = 0; this.alive = true;
    const a = rand(Math.PI * 2), s = rand(40, 120); this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s; this.bounce = 1;
    this.label = this.makeLabel(); this.rect = null;
  }
  makeLabel() {
    if (this.kind === 'item') return { text: this.data.name, color: itemColor(this.data), bg: this.data.rarity === 'unique' ? 'rgba(60,30,0,0.9)' : this.data.aspect ? 'rgba(70,35,0,0.9)' : this.data.rarity === 'rare' ? 'rgba(50,45,0,0.9)' : this.data.rarity === 'magic' ? 'rgba(10,20,60,0.9)' : 'rgba(0,0,0,0.75)' };
    if (this.kind === 'currency') return { text: CURRENCY[this.data.id].name + (this.data.n > 1 ? ` ×${this.data.n}` : ''), color: CURRENCY[this.data.id].color, bg: 'rgba(30,10,40,0.9)' };
    if (this.kind === 'gem') { const d = gemDef(this.data); return { text: `${d.icon} ${d.name} (Lv.${this.data.level})`, color: d.color, bg: 'rgba(0,30,30,0.9)' }; }
    if (this.kind === 'aspect') return { text: '형상: ' + ASPECTS[this.data].name, color: LEGENDARY_COLOR, bg: 'rgba(60,30,0,0.9)' };
    return { text: '?', color: '#fff', bg: '#000' };
  }
  update(dt) {
    this.t += dt;
    if (this.bounce > 0.05) { const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt; if (!World.wallAt(nx, ny)) { this.x = nx; this.y = ny; } this.vx *= 0.9; this.vy *= 0.9; this.bounce *= 0.9; }
  }
  visible(filter) {
    if (this.kind !== 'item') return true;
    if (filter === 'all') return true;
    if (filter === 'magic') return this.data.rarity !== 'normal';
    if (filter === 'rare') return this.data.rarity === 'rare' || this.data.rarity === 'unique' || !!this.data.aspect;
    return true;
  }
  draw(ctx) {
    const bob = Math.sin(this.t * 4) * 2;
    ctx.save(); ctx.translate(this.x, this.y + bob);
    const c = this.label.color;
    ctx.shadowColor = c; ctx.shadowBlur = 10;
    if (this.kind === 'item') {
      ctx.fillStyle = c; ctx.beginPath();
      if (this.data.slot === 'weapon') { ctx.moveTo(-3, 8); ctx.lineTo(3, 8); ctx.lineTo(1, -9); ctx.lineTo(-1, -9); }
      else if (['ring', 'amulet'].includes(this.data.slot)) { ctx.arc(0, 0, 5, 0, Math.PI * 2); }
      else { ctx.rect(-6, -6, 12, 12); }
      ctx.closePath(); ctx.fill();
    } else if (this.kind === 'currency') {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (this.kind === 'gem') {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 8); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
    } else { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -9); for (let i = 1; i < 10; i++) { const r = i % 2 ? 4 : 9; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}
