'use strict';
// ===================== UI (DOM) =====================
const UI = {
  curSel: null, aspectSel: null, gemSel: null, selCls: 'vampire', openPanel: null,
  tree: { x: 0, y: 0, zoom: 1, drag: false, lx: 0, ly: 0, hover: null }, minimapT: 0, ttEl: null,
  init() {
    this.ttEl = el('tooltip');
    document.addEventListener('mousemove', e => { if (!this.ttEl.classList.contains('hidden')) this.positionTooltip(e.clientX, e.clientY); });
    // 타이틀
    el('btn-new').onclick = () => { Audio_.init(); this.showScreen('create'); this.renderCreate(); };
    el('btn-continue').onclick = () => { Audio_.init(); if (!Game.continueGame()) this.showTitle(); };
    el('btn-start').onclick = () => { const name = el('inp-name').value.trim() || '추방자'; Game.newGame(this.selCls, name, el('chk-hardcore').checked); };
    el('btn-back').onclick = () => this.showTitle();
    el('btn-reroll').onclick = () => { Game.mapOptions = makeMapOptions(Game.player); this.renderMapSelect(); Audio_.play('ui'); };
    el('btn-clear-continue').onclick = () => Game.gotoMapSelect();
    el('btn-dead-continue').onclick = () => { if (Game.player.hardcore) { Game.player = null; this.showTitle(); } else Game.gotoMapSelect(); };
    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => this.togglePanel(b.dataset.open));
    document.querySelectorAll('.panel .close').forEach(b => b.onclick = () => this.closePanels());
    el('btn-resume').onclick = () => this.closePanels();
    el('btn-title').onclick = () => { Save.save(); this.closePanels(); Game.state = 'title'; World.active = false; this.hideHUD(); this.showTitle(); };
    el('btn-sound').onclick = () => { Audio_.enabled = !Audio_.enabled; el('btn-sound').textContent = '사운드: ' + (Audio_.enabled ? '켜짐' : '꺼짐'); };
    el('sel-filter').onchange = e => { Game.player.lootFilter = e.target.value; };
    el('btn-refine').onclick = () => { const p = Game.player; if ((p.currency.essence || 0) >= 5) { p.currency.essence -= 5; p.addCurrency('transmute', 1); Audio_.play('orb'); this.refreshInventory(); } else Game.flash('정수가 부족합니다 (5개 필요)'); };
    // 스킬바
    const sb = el('skillbar'); sb.innerHTML = '';
    const keys = ['좌클릭', '우클릭', '1', '2', '3', '4'];
    for (let i = 0; i < CFG.SKILL_SLOTS; i++) { const d = document.createElement('div'); d.className = 'sk'; d.dataset.slot = i; d.innerHTML = `<div class="ico"></div><div class="cd"></div><div class="key">${keys[i]}</div>`; d.onclick = () => this.togglePanel('gems'); d.onmouseenter = e => this.skillTooltip(i, e); d.onmouseleave = () => this.hideTooltip(); sb.appendChild(d); }
    for (const [id, key, ico] of [['potion', 'R', '🧪'], ['dodge', 'Space', '💨'], ['ult', 'F', '★']]) { const d = document.createElement('div'); d.className = 'sk special'; d.id = 'sk-' + id; d.innerHTML = `<div class="ico">${ico}</div><div class="cd"></div><div class="key">${key}</div><div class="cnt"></div>`; d.onmouseenter = e => this.specialTooltip(id, e); d.onmouseleave = () => this.hideTooltip(); sb.appendChild(d); }
    // 패시브 트리 캔버스
    const tc = el('tree-canvas'); this.treeCanvas = tc; this.treeCtx = tc.getContext('2d');
    tc.addEventListener('mousedown', e => { this.tree.drag = true; this.tree.lx = e.clientX; this.tree.ly = e.clientY; this.tree.moved = 0; });
    window.addEventListener('mouseup', () => { this.tree.drag = false; });
    tc.addEventListener('mousemove', e => { if (this.tree.drag) { const dx = e.clientX - this.tree.lx, dy = e.clientY - this.tree.ly; this.tree.x += dx; this.tree.y += dy; this.tree.lx = e.clientX; this.tree.ly = e.clientY; this.tree.moved += Math.abs(dx) + Math.abs(dy); } this.treeHover(e); this.drawTree(); });
    tc.addEventListener('wheel', e => { e.preventDefault(); const z = clamp(this.tree.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.45, 2.2); this.tree.zoom = z; this.drawTree(); }, { passive: false });
    tc.addEventListener('click', e => { if (this.tree.moved > 6) return; const n = this.tree.hover; if (!n) return; if (Passives.allocate(Game.player, n.id)) { Audio_.play('orb'); Game.player.recalc(); this.drawTree(); this.treeHover(e); } });
    tc.addEventListener('contextmenu', e => { e.preventDefault(); const n = this.tree.hover; const p = Game.player; if (!n) return; if (!p.passives.has(n.id)) return; if ((p.currency.regret || 0) <= 0) { Game.flash('후회의 오브가 필요합니다'); return; } if (Passives.refund(p, n.id)) { p.currency.regret--; p.recalc(); Audio_.play('orb'); this.drawTree(); this.treeHover(e); } else Game.flash('이 노드는 환불할 수 없습니다 (연결 유지 필요)'); });
    el('btn-tree-center').onclick = () => { this.tree.x = 0; this.tree.y = 0; this.tree.zoom = 1; this.drawTree(); };
    // 메뉴 (모바일 항목 포함)
    el('btn-return').onclick = () => { this.closePanels(); Game.leaveMap(); };
    el('btn-fullscreen').onclick = () => TouchCtl.fullscreen();
    el('btn-touchmode').onclick = () => { try { localStorage.setItem('ce_touch', TouchCtl.enabled ? '0' : '1'); } catch (e) { } Save.save(); location.reload(); };
    el('chk-autopickup').onchange = e => { Game.autoPickup = e.target.checked; try { localStorage.setItem('ce_autopickup', Game.autoPickup ? '1' : '0'); } catch (e) { } };
    el('sheet').querySelector('.sheet-close').onclick = () => this.closeSheet();
    el('sheet').addEventListener('click', e => { if (e.target === el('sheet')) this.closeSheet(); });
    // 패시브 트리 터치 (드래그 이동 / 핀치 확대 / 탭 선택)
    let pinch = null, tstart = null;
    tc.addEventListener('touchstart', e => { e.preventDefault(); if (e.touches.length === 2) { pinch = { d: dist(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY), z: this.tree.zoom }; tstart = null; } else { const t = e.touches[0]; tstart = { moved: 0 }; this.tree.lx = t.clientX; this.tree.ly = t.clientY; } }, { passive: false });
    tc.addEventListener('touchmove', e => { e.preventDefault(); if (e.touches.length === 2 && pinch) { const d = dist(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY); this.tree.zoom = clamp(pinch.z * d / pinch.d, 0.45, 2.2); this.drawTree(); return; } if (!tstart) return; const t = e.touches[0]; const dx = t.clientX - this.tree.lx, dy = t.clientY - this.tree.ly; this.tree.x += dx; this.tree.y += dy; this.tree.lx = t.clientX; this.tree.ly = t.clientY; tstart.moved += Math.abs(dx) + Math.abs(dy); this.drawTree(); }, { passive: false });
    tc.addEventListener('touchend', e => { e.preventDefault(); if (e.touches.length < 2) pinch = null; if (tstart && tstart.moved < 8) { const t = e.changedTouches[0]; this.treeHover({ clientX: t.clientX, clientY: t.clientY }); this.hideTooltip(); const n = this.tree.hover; if (n) this.nodeSheet(n); } tstart = null; }, { passive: false });
  },
  // ---------- 터치용 액션 시트 ----------
  sheet(html, actions) {
    const s = el('sheet'); s.querySelector('.sheet-body').innerHTML = html; const a = s.querySelector('.sheet-actions'); a.innerHTML = '';
    for (const act of actions) { const b = document.createElement('button'); b.className = 'btn' + (act.danger ? ' danger' : ''); b.textContent = act.label; b.onclick = () => { this.closeSheet(); act.fn(); }; a.appendChild(b); }
    s.classList.remove('hidden');
  },
  closeSheet() { el('sheet').classList.add('hidden'); },
  itemSheet(it, idx) {
    const p = Game.player; const acts = [];
    if (this.curSel) acts.push({ label: `${CURRENCY[this.curSel].name} 적용`, fn: () => this.applyCur(it) });
    if (this.aspectSel) acts.push({ label: '형상 각인', fn: () => this.imprint(it) });
    acts.push({ label: '장착', fn: () => { p.equip(it); this.refreshInventory(); } });
    if (it.rarity === 'unique') acts.push({ label: '형상 추출 (아이템 파괴)', fn: () => this.extract(it, idx), danger: true });
    acts.push({ label: '분해 (정수)', fn: () => this.salvage(it, idx, true), danger: true });
    const eqItem = it.slot === 'ring' ? p.equipment.ring1 : p.equipment[it.slot];
    let h = itemTooltipHTML(it); if (eqItem && eqItem !== it) h += `<div class="tt-cmp"><div class="tt-sub">장착 중:</div>${itemTooltipHTML(eqItem, { tiers: false })}</div>`;
    this.sheet(h, acts);
  },
  equipSheet(it, slot) {
    const p = Game.player; const acts = [];
    if (this.curSel) acts.push({ label: `${CURRENCY[this.curSel].name} 적용`, fn: () => this.applyCur(it) });
    if (this.aspectSel) acts.push({ label: '형상 각인', fn: () => this.imprint(it) });
    acts.push({ label: '해제', fn: () => { p.unequip(slot); this.refreshInventory(); } });
    this.sheet(itemTooltipHTML(it), acts);
  },
  gemSheet(g, sk, onRemove) { this.sheet(gemTooltipHTML(g, sk), [{ label: '해제', fn: onRemove }, { label: '젬 연마 (프리즘 사용)', fn: () => this.gemcut(g) }]); },
  bagGemSheet(g) { this.sheet(gemTooltipHTML(g), [{ label: '선택 (슬롯을 탭하여 장착)', fn: () => { this.gemSel = g; this.refreshGems(); } }, { label: '젬 연마 (프리즘 사용)', fn: () => this.gemcut(g) }]); },
  nodeSheet(n) {
    const p = Game.player; const acts = [];
    if (Passives.canAllocate(p, n.id)) acts.push({ label: '할당', fn: () => { if (Passives.allocate(p, n.id)) { Audio_.play('orb'); p.recalc(); this.drawTree(); } } });
    if (p.passives.has(n.id) && Passives.canRefund(p, n.id)) acts.push({ label: `환불 (후회의 오브 ${p.currency.regret || 0}개)`, fn: () => { if (!(p.currency.regret > 0)) { Game.flash('후회의 오브가 필요합니다'); return; } if (Passives.refund(p, n.id)) { p.currency.regret--; p.recalc(); Audio_.play('orb'); this.drawTree(); } } });
    this.sheet(Passives.nodeTooltipHTML(n, null) + (acts.length ? '' : `<div class="tt-hint">${p.passives.has(n.id) ? '할당됨 (연결 유지를 위해 환불 불가)' : '연결된 노드가 필요하거나 포인트 부족'}</div>`), acts);
  },
  // ---------- 화면 ----------
  showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); el('screen-' + id).classList.remove('hidden'); },
  hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); },
  showTitle() {
    this.showScreen('title'); this.hideHUD(); this.closePanels();
    const s = Save.peek(); const b = el('btn-continue');
    if (s) { b.classList.remove('hidden'); b.textContent = `이어하기 — ${s.name} (${CLASSES[s.cls].name} Lv.${s.level}${s.hardcore ? ' · 하드코어' : ''})`; } else b.classList.add('hidden');
  },
  renderCreate() {
    const wrap = el('class-cards'); wrap.innerHTML = '';
    for (const id in CLASSES) {
      const c = CLASSES[id]; const d = document.createElement('div'); d.className = 'class-card' + (this.selCls === id ? ' sel' : ''); d.style.setProperty('--c', c.color);
      d.innerHTML = `<h3 style="color:${c.color}">${c.name}</h3><div class="ttl">${c.title}</div><p>${c.desc}</p><p class="lore">${c.lore}</p>
        <div class="tags">${['day', 'night', 'twilight'].map(k => `<span>${{ day: '낮', night: '밤', twilight: '황혼' }[k]} ${signed(c.time[k] * 100)}%</span>`).join('')}</div>
        <div class="tags"><span>자원: ${c.resource.name}</span><span>궁극기: ${c.ult.name}</span></div>
        <div class="gems">시작 젬: ${c.startGems.map(g => `<b style="color:${GEMS[g].color}">${GEMS[g].icon} ${GEMS[g].name}</b>`).join(' ')} + <b style="color:${SUPPORTS[c.startSupports[0]].color}">${SUPPORTS[c.startSupports[0]].name}</b></div>`;
      d.onclick = () => { this.selCls = id; this.renderCreate(); Audio_.play('ui'); };
      wrap.appendChild(d);
    }
  },
  showMapSelect() { this.showScreen('mapselect'); this.renderMapSelect(); },
  renderMapSelect() {
    const p = Game.player; const wrap = el('map-cards'); wrap.innerHTML = '';
    el('ms-char').innerHTML = `<b style="color:${CLASSES[p.cls].color}">${esc(p.name)}</b> · ${CLASSES[p.cls].name} Lv.${p.level}${p.hardcore ? ' · <span style="color:#ff5c5c">하드코어</span>' : ''} · 최고 티어 ${p.maxTier} · 처치 ${fmt(p.kills)} · 지도 클리어 ${p.mapsCleared}<br><span class="dim">패시브 포인트 ${Passives.pointsAvailable(p)} 남음 · 미장착 젬 ${p.gemBag.length}개 · 인벤토리 ${p.invCount()}/${CFG.INV_SLOTS}</span>`;
    Game.mapOptions.forEach(o => {
      const th = THEMES[o.theme]; const d = document.createElement('div'); d.className = 'map-card'; d.style.setProperty('--c', o.color);
      d.innerHTML = `<div class="lbl" style="color:${o.color}">${o.label}</div><h3>${th.name}</h3><div class="tier">티어 ${o.tier} · 몬스터 레벨 ${o.level}~${o.level + 2}</div>
        <div class="boss">보스: ${BOSSES[th.boss].name}</div>
        <ul>${o.mods.length ? o.mods.map(m => `<li>${MAP_MODS[m].name}</li>`).join('') : '<li class="dim">모드 없음</li>'}</ul>
        <div class="iiq">아이템 수량 +${o.iiq}% · 희귀도 +${o.iir}%</div><button class="btn">진입</button>`;
      d.querySelector('button').onclick = () => Game.startMap(o);
      wrap.appendChild(d);
    });
  },
  showMapClear(s) {
    this.showScreen('mapclear');
    el('clear-stats').innerHTML = `<div>${s.theme} · 티어 ${s.tier} 완료</div><div>처치: <b>${s.kills}</b> · 레벨 상승: <b>+${s.levels}</b> · 소요 시간: <b>${timeStr(s.time)}</b></div>`;
  },
  showDeath(cause, msg) { this.showScreen('dead'); el('dead-info').innerHTML = `<div>사망 원인: <b>${esc(cause)}</b></div><div>${esc(msg)}</div>`; el('btn-dead-continue').textContent = Game.player.hardcore ? '타이틀로' : '피난처에서 부활'; },
  showHUD() { el('hud').classList.remove('hidden'); document.body.classList.add('playing'); this.refreshSkillbar(); },
  hideHUD() { el('hud').classList.add('hidden'); document.body.classList.remove('playing'); },
  // ---------- 패널 ----------
  anyPanelOpen() { return !!this.openPanel; },
  togglePanel(id) {
    if (this.openPanel === id) { this.closePanels(); return; }
    if (!Game.player) return;
    this.closePanels(); this.openPanel = id; el('panel-' + id).classList.remove('hidden'); document.body.classList.add('panel-open'); Audio_.play('ui');
    this.refreshPanel(id);
  },
  closePanels() { document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden')); this.openPanel = null; document.body.classList.remove('panel-open'); TouchCtl.held = {}; TouchCtl.released = []; this.curSel = null; this.aspectSel = null; this.gemSel = null; this.hideTooltip(); },
  refreshPanel(id) { if (id === 'inv') this.refreshInventory(); else if (id === 'gems') this.refreshGems(); else if (id === 'tree') { this.resizeTree(); this.drawTree(); } else if (id === 'char') this.refreshChar(); else if (id === 'menu') { el('btn-sound').textContent = '사운드: ' + (Audio_.enabled ? '켜짐' : '꺼짐'); el('sel-filter').value = Game.player.lootFilter; el('chk-autopickup').checked = Game.autoPickup; el('btn-touchmode').textContent = '터치 조작: ' + (TouchCtl.enabled ? '켜짐' : '꺼짐'); el('btn-return').style.display = Game.state === 'play' ? '' : 'none'; } },
  // ---------- 툴팁 ----------
  tooltip(html, x, y) { this.ttEl.innerHTML = html; this.ttEl.classList.remove('hidden'); this.positionTooltip(x, y); },
  positionTooltip(x, y) { const r = this.ttEl.getBoundingClientRect(); let tx = x + 18, ty = y + 12; if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 12; if (ty + r.height > window.innerHeight - 8) ty = window.innerHeight - r.height - 8; this.ttEl.style.left = tx + 'px'; this.ttEl.style.top = Math.max(4, ty) + 'px'; },
  hideTooltip() { this.ttEl.classList.add('hidden'); },
  skillTooltip(i, e) { const p = Game.player; const s = p.sockets[i]; if (!s.main) { this.tooltip('<div class="tt-name">빈 슬롯</div><div class="tt-sub">K 키로 젬 패널을 열어 스킬 젬을 장착하세요</div>', e.clientX, e.clientY); return; } this.tooltip(gemTooltipHTML(s.main, computeSkill(p, i)) + (s.supports.some(x => x) ? `<div class="tt-impl">서포트: ${s.supports.filter(x => x).map(x => `<span style="color:${SUPPORTS[x.id].color}">${SUPPORTS[x.id].name} Lv.${x.level}</span>`).join(', ')}</div>` : ''), e.clientX, e.clientY); },
  specialTooltip(id, e) {
    const p = Game.player; const c = CLASSES[p.cls];
    const h = id === 'potion' ? `<div class="tt-name">포션 (R)</div><div class="tt-mods">최대 생명력의 35% 즉시 회복 + 3초간 재생. 처치 시 확률적으로 충전. 보스 처치 시 전부 충전.</div><div class="tt-sub">충전 ${p.potion.charges}/${p.stats.potionCharges}</div>`
      : id === 'dodge' ? `<div class="tt-name">회피 구르기 (Space)</div><div class="tt-mods">이동 방향으로 구르며 무적. 재사용 ${p.stats.dodgeCd.toFixed(2)}초.</div>`
        : `<div class="tt-name" style="color:${c.color}">${c.ult.name} (F)</div><div class="tt-mods">${c.ult.desc}</div><div class="tt-sub">재사용 ${c.ult.cd}초 · 지속 ${c.ult.dur}초</div>`;
    this.tooltip(h, e.clientX, e.clientY);
  },
  // ---------- HUD ----------
  refreshSkillbar() {
    const p = Game.player; if (!p) return;
    document.querySelectorAll('#skillbar .sk:not(.special)').forEach(d => { const i = +d.dataset.slot; const g = p.sockets[i].main; const ico = d.querySelector('.ico'); if (g) { const def = GEMS[g.id]; ico.textContent = def.icon; ico.style.color = def.color; d.classList.add('has'); } else { ico.textContent = ''; d.classList.remove('has'); } });
  },
  updateHUD(dt) {
    const p = Game.player; if (!p || el('hud').classList.contains('hidden')) return;
    const s = p.stats;
    el('orb-hp').querySelector('.fill').style.height = clamp(p.hp / s.maxLife, 0, 1) * 100 + '%'; el('orb-hp').querySelector('.val').textContent = `${Math.ceil(p.hp)} / ${s.maxLife}`;
    const rc = CLASSES[p.cls].resource; const orb = el('orb-res'); orb.querySelector('.fill').style.height = clamp(p.res / s.maxRes, 0, 1) * 100 + '%'; orb.querySelector('.fill').style.background = `linear-gradient(180deg, ${rc.color}, ${hexA(rc.color, 0.6)})`; orb.querySelector('.val').textContent = `${Math.floor(p.res)} / ${s.maxRes}`; orb.querySelector('.lbl').textContent = rc.name;
    el('xp-fill').style.width = clamp(p.xp / p.xpToNext(p.level), 0, 1) * 100 + '%'; el('xp-text').textContent = `Lv.${p.level} · ${fmt(p.xp)} / ${fmt(p.xpToNext(p.level))}${Passives.pointsAvailable(p) > 0 ? ` · 패시브 포인트 ${Passives.pointsAvailable(p)} (P)` : ''}`;
    document.querySelectorAll('#skillbar .sk:not(.special)').forEach(d => { const i = +d.dataset.slot; const g = p.sockets[i].main; const cd = d.querySelector('.cd'); if (!g) { cd.style.height = '0'; return; } const def = GEMS[g.id]; const rem = p.cooldowns[i] || 0; cd.style.height = (def.cd ? clamp(rem / def.cd, 0, 1) * 100 : 0) + '%'; const sk = computeSkill(p, i); d.classList.toggle('nores', sk && p.res < sk.cost && !s.flags.has('blood_magic')); });
    const pot = el('sk-potion'); pot.querySelector('.cnt').textContent = p.potion.charges; pot.classList.toggle('nores', p.potion.charges <= 0);
    el('sk-dodge').querySelector('.cd').style.height = clamp(p.dodge.cd / s.dodgeCd, 0, 1) * 100 + '%';
    const u = CLASSES[p.cls].ult; el('sk-ult').querySelector('.cd').style.height = clamp(p.ult.cd / u.cd, 0, 1) * 100 + '%'; el('sk-ult').classList.toggle('active', p.ult.active);
    // 시계
    el('clock-icon').textContent = Clock.icon(); el('clock-label').textContent = Clock.label() + (Clock.forced ? ' (고정)' : '');
    const bonus = Combat.timeBonus(p); el('clock-bonus').textContent = `피해 ${signed(bonus * 100)}%`; el('clock-bonus').style.color = bonus > 0 ? '#9fe1a5' : bonus < 0 ? '#ff7b7b' : '#aaa';
    el('clock-hand').style.transform = `rotate(${Clock.t * 360}deg)`;
    // 버프
    const bf = el('buffs'); const list = [...p.buffs.map(b => `<div class="buff" style="border-color:${b.color}"><span>${b.icon || '●'}</span> ${b.name}${b.stacks > 1 ? ` ×${b.stacks}` : ''} <i>${Math.ceil(b.t)}s</i></div>`)];
    if (p.ult.active) list.push(`<div class="buff" style="border-color:${CLASSES[p.cls].color}"><span>★</span> ${u.name} <i>${Math.ceil(p.ult.t)}s</i></div>`);
    if (p.st.ignite > 0) list.push('<div class="buff bad">🔥 점화</div>'); if (p.st.bleed > 0) list.push('<div class="buff bad">🩸 출혈</div>'); if (p.chill > 0) list.push('<div class="buff bad">❄ 둔화</div>');
    bf.innerHTML = list.join('');
    // 보스
    const b = World.boss; const bb = el('bossbar');
    if (b && b.alive && b.aggro) { bb.classList.remove('hidden'); el('boss-name').textContent = b.name; el('boss-fill').style.width = clamp(b.hp / b.maxHp, 0, 1) * 100 + '%'; } else bb.classList.add('hidden');
    // 맵 정보
    el('map-name').textContent = `${World.theme.name} · 티어 ${World.tier}`;
    el('map-mods').textContent = (World.mapDef.mods.map(m => MAP_MODS[m].name).join(' · ') || '모드 없음') + ` · 처치 ${World.killCount}/${World.monsterTotal}`;
    el('fps').textContent = Game.fps + ' fps';
    if (TouchCtl.enabled) TouchCtl.updateHUD(p);
    this.minimapT += dt || 0; if (this.minimapT > 0.2) { this.minimapT = 0; this.drawMinimap(); }
  },
  drawMinimap() {
    const c = el('minimap'); const ctx = c.getContext('2d'); const W = World.w, H = World.h; const sc = c.width / W; const p = Game.player;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#5a5560';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!World.explored[i]) continue; if (World.tiles[i]) continue; ctx.fillRect(x * sc, y * sc, sc, sc); }
    const dot = (x, y, col, r = 3) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x / CFG.TILE * sc, y / CFG.TILE * sc, r, 0, Math.PI * 2); ctx.fill(); };
    for (const m of World.monsters) if (m.alive && World.explored[Math.floor(m.y / CFG.TILE) * W + Math.floor(m.x / CFG.TILE)] && (m.rarity === 'rare' || m.rarity === 'magic')) dot(m.x, m.y, m.rarity === 'rare' ? '#ffd23f' : '#7b9bff', 2);
    if (World.rift && World.rift.state !== 'done') dot(World.rift.x, World.rift.y, '#c77dff', 4);
    for (const s of World.shrines) if (!s.used && World.explored[Math.floor(s.y / CFG.TILE) * W + Math.floor(s.x / CFG.TILE)]) dot(s.x, s.y, '#9fe1a5', 3);
    if (World.boss && World.boss.alive) { dot(World.boss.x, World.boss.y, '#ff3b3b', 5); ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('보스', World.boss.x / CFG.TILE * sc, World.boss.y / CFG.TILE * sc - 7); }
    if (World.portal) dot(World.portal.x, World.portal.y, '#7b9bff', 5);
    dot(p.x, p.y, '#ffffff', 3);
  },
  // ---------- 인벤토리 ----------
  itemCell(item, cls, extra = '') {
    const glyph = { weapon: '⚔', helm: '⛑', body: '🛡', gloves: '🧤', boots: '👢', belt: '➰', ring: '💍', amulet: '📿' }[item.slot];
    return `<div class="${cls} has" style="--c:${itemColor(item)}" ${extra}><span>${glyph}</span>${item.aspect ? '<i class="asp">★</i>' : ''}</div>`;
  },
  refreshInventory() {
    const p = Game.player;
    const eq = el('equip'); eq.innerHTML = '';
    for (const slot of EQUIP_SLOTS) {
      const it = p.equipment[slot]; const d = document.createElement('div'); d.className = 'eq-slot'; d.dataset.slot = slot;
      d.innerHTML = it ? this.itemCell(it, 'cell') : `<div class="cell empty">${SLOT_NAMES[slot]}</div>`;
      if (it) { if (!TouchCtl.enabled) { d.onmouseenter = e => this.tooltip(itemTooltipHTML(it, { hint: '클릭: 해제' }), e.clientX, e.clientY); d.onmouseleave = () => this.hideTooltip(); } d.onclick = () => { if (TouchCtl.enabled) { this.equipSheet(it, slot); return; } if (this.curSel) this.applyCur(it); else if (this.aspectSel) this.imprint(it); else { p.unequip(slot); this.refreshInventory(); this.hideTooltip(); } }; }
      eq.appendChild(d);
    }
    const inv = el('inv-grid'); inv.innerHTML = '';
    p.inventory.forEach((it, i) => {
      const d = document.createElement('div'); d.className = 'inv-cell';
      if (it) {
        d.innerHTML = this.itemCell(it, 'cell');
        const eqItem = it.slot === 'ring' ? p.equipment.ring1 : p.equipment[it.slot];
        d.onmouseenter = e => { if (TouchCtl.enabled) return; let h = itemTooltipHTML(it, { hint: this.curSel ? `클릭: ${CURRENCY[this.curSel].name} 적용` : this.aspectSel ? '클릭: 형상 각인' : '클릭: 장착 · 우클릭: 분해' + (it.rarity === 'unique' ? ' · Ctrl+클릭: 형상 추출' : '') }); if (eqItem && eqItem !== it) h += `<div class="tt-cmp"><div class="tt-sub">장착 중:</div>${itemTooltipHTML(eqItem, { tiers: false })}</div>`; this.tooltip(h, e.clientX, e.clientY); };
        d.onmouseleave = () => this.hideTooltip();
        d.onclick = e => { if (TouchCtl.enabled) { this.itemSheet(it, i); return; } if (this.curSel) this.applyCur(it); else if (this.aspectSel) this.imprint(it); else if (e.ctrlKey && it.rarity === 'unique') this.extract(it, i); else { p.equip(it); this.refreshInventory(); this.hideTooltip(); } };
        d.oncontextmenu = e => { e.preventDefault(); this.salvage(it, i, e.shiftKey); };
      } else d.innerHTML = '<div class="cell empty"></div>';
      inv.appendChild(d);
    });
    el('inv-count').textContent = `${p.invCount()} / ${CFG.INV_SLOTS}`;
    el('inv-hint').textContent = TouchCtl.enabled ? '아이템을 탭하면 장착 · 분해 · 형상 추출 · 오브 적용 메뉴가 열립니다' : '클릭: 장착 · 우클릭: 분해(정수) · Shift+우클릭: 희귀 이상 분해 · Ctrl+클릭: 유니크 형상 추출';
    // 화폐
    const cur = el('currency'); cur.innerHTML = '';
    for (const id of CURRENCY_IDS) {
      const n = p.currency[id] || 0; if (!n && id !== 'essence') continue;
      const c = CURRENCY[id]; const d = document.createElement('div'); d.className = 'cur-row' + (this.curSel === id ? ' sel' : ''); d.style.setProperty('--c', c.color);
      d.innerHTML = `<span class="orb-ico"></span><span class="nm">${c.name}</span><span class="n">×${n}</span>`;
      d.onmouseenter = e => TouchCtl.enabled || this.tooltip(`<div class="tt-name" style="color:${c.color}">${c.name}</div><div class="tt-mods">${c.desc}</div>${c.target === 'item' ? '<div class="tt-hint">클릭 후 아이템을 클릭하여 적용</div>' : ''}`, e.clientX, e.clientY); d.onmouseleave = () => this.hideTooltip();
      d.onclick = () => { if (TouchCtl.enabled) Game.flash(c.desc, c.color); if (c.target !== 'item' || !n) { if (c.target === 'gem') Game.flash('젬 패널(K)에서 젬을 우클릭하여 사용'); if (c.target === 'passive') Game.flash('패시브 트리(P)에서 할당된 노드를 우클릭하여 사용'); return; } this.curSel = this.curSel === id ? null : id; this.aspectSel = null; this.refreshInventory(); Audio_.play('ui'); };
      cur.appendChild(d);
    }
    el('cur-hint').textContent = this.curSel ? `${CURRENCY[this.curSel].name} 적용 대기 중 — 아이템을 클릭하세요 (다시 클릭하면 취소)` : this.aspectSel ? `${ASPECTS[this.aspectSel].name} 각인 대기 중 — 희귀/마법 아이템을 클릭하세요` : '';
    // 형상
    const asp = el('aspects'); asp.innerHTML = p.aspects.length ? '' : '<div class="dim">보유한 형상 없음. 유니크 아이템을 Ctrl+클릭하여 추출하거나 보스에게서 획득.</div>';
    p.aspects.forEach((a, i) => { const A = ASPECTS[a]; const d = document.createElement('div'); d.className = 'asp-row' + (this.aspectSel === a && this.aspectIdx === i ? ' sel' : ''); d.innerHTML = `<b>★ ${A.name}</b><span>${A.desc}</span><i>${A.slots.map(slotLabel).join('/')}</i>`; d.onclick = () => { this.aspectSel = this.aspectSel === a && this.aspectIdx === i ? null : a; this.aspectIdx = i; this.curSel = null; this.refreshInventory(); }; asp.appendChild(d); });
    el('sel-filter-inv').value = p.lootFilter; el('sel-filter-inv').onchange = e => { p.lootFilter = e.target.value; };
  },
  applyCur(item) {
    const p = Game.player; const id = this.curSel; if (!id || !(p.currency[id] > 0)) { this.curSel = null; this.refreshInventory(); return; }
    const r = applyCurrency(id, item);
    if (r.ok) { p.currency[id]--; Audio_.play('orb'); p.recalc(); if (!(p.currency[id] > 0)) this.curSel = null; }
    else Game.flash(r.msg, '#ff7b7b');
    this.refreshInventory();
    const cellHover = document.querySelector('.inv-cell:hover, .eq-slot:hover'); if (cellHover && r.ok) { this.ttEl.innerHTML = itemTooltipHTML(item, { hint: this.curSel ? `클릭: ${CURRENCY[this.curSel].name} 적용` : '' }); }
  },
  imprint(item) {
    const p = Game.player; const a = this.aspectSel; if (!a) return;
    if (item.rarity === 'unique') { Game.flash('유니크에는 각인할 수 없습니다', '#ff7b7b'); return; }
    if (!ASPECTS[a].slots.includes(item.slot)) { Game.flash(`이 형상은 ${ASPECTS[a].slots.map(slotLabel).join('/')}에만 각인 가능`, '#ff7b7b'); return; }
    item.aspect = a; p.aspects.splice(this.aspectIdx, 1); this.aspectSel = null; p.recalc(); Audio_.play('orb'); Game.flash(`${ASPECTS[a].name} 각인 완료`, LEGENDARY_COLOR); this.refreshInventory();
  },
  extract(item, idx) {
    const p = Game.player; if (!item.aspect) return;
    p.aspects.push(item.aspect); p.inventory[idx] = null; Audio_.play('orb'); Game.flash(`형상 추출: ${ASPECTS[item.aspect].name} (아이템 파괴)`, LEGENDARY_COLOR); this.refreshInventory(); this.hideTooltip();
  },
  salvage(item, idx, shift) {
    const p = Game.player;
    if ((item.rarity === 'rare' || item.rarity === 'unique' || item.aspect) && !shift) { Game.flash('희귀 이상 아이템은 Shift+우클릭으로 분해', '#ff7b7b'); return; }
    p.inventory[idx] = null; const n = item.rarity === 'unique' ? 3 : item.rarity === 'rare' ? 2 : 1; p.addCurrency('essence', n);
    Audio_.play('kill'); Game.flash(`분해: 정수 +${n}`); this.refreshInventory(); this.hideTooltip();
  },
  // ---------- 젬 ----------
  refreshGems() {
    const p = Game.player; const wrap = el('sockets'); wrap.innerHTML = '';
    const keys = TouchCtl.enabled ? ['주 공격', '스킬 2', '스킬 3', '스킬 4', '스킬 5', '스킬 6'] : ['좌클릭', '우클릭', '1', '2', '3', '4'];
    p.sockets.forEach((s, i) => {
      const row = document.createElement('div'); row.className = 'sock-row';
      const sk = s.main ? computeSkill(p, i) : null;
      row.innerHTML = `<div class="key">${keys[i]}</div>`;
      const mk = (g, isSup, j) => {
        const d = document.createElement('div'); d.className = 'gem-cell' + (isSup ? ' sup' : '') + (g ? ' has' : '');
        if (g) { const def = gemDef(g); d.style.setProperty('--c', def.color); d.innerHTML = `<span>${def.icon}</span><i>${g.level}</i>`; if (isSup && s.main && !supportFits(def, GEMS[s.main.id])) d.classList.add('nofit'); }
        else d.innerHTML = `<span class="dim">${isSup ? '서포트' : '스킬'}</span>`;
        d.onmouseenter = e => { if (TouchCtl.enabled) return; if (g) this.tooltip(gemTooltipHTML(g, !isSup ? sk : null) + (isSup && s.main && !supportFits(gemDef(g), GEMS[s.main.id]) ? '<div class="tt-hint" style="color:#ff7b7b">이 스킬에는 적용되지 않는 서포트입니다</div>' : '') + `<div class="tt-hint">클릭: 해제 · 우클릭: 젬 연마사의 프리즘 사용</div>`, e.clientX, e.clientY); else if (this.gemSel) this.tooltip('<div class="tt-sub">클릭하여 선택한 젬 장착</div>', e.clientX, e.clientY); };
        d.onmouseleave = () => this.hideTooltip();
        d.onclick = () => {
          if (this.gemSel) {
            const sel = this.gemSel; if (!!sel.support !== isSup) { Game.flash(isSup ? '서포트 젬만 장착 가능' : '스킬 젬만 장착 가능', '#ff7b7b'); return; }
            const bi = p.gemBag.indexOf(sel); p.gemBag.splice(bi, 1);
            if (g) p.gemBag.push(g);
            if (isSup) s.supports[j] = sel; else s.main = sel;
            this.gemSel = null; Audio_.play('orb'); p.recalc(); this.refreshGems(); this.refreshSkillbar(); this.hideTooltip();
          } else if (g) { const remove = () => { if (isSup) s.supports[j] = null; else s.main = null; p.gemBag.push(g); p.recalc(); this.refreshGems(); this.refreshSkillbar(); this.hideTooltip(); }; if (TouchCtl.enabled) this.gemSheet(g, !isSup ? sk : null, remove); else remove(); }
        };
        d.oncontextmenu = e => { e.preventDefault(); if (g) this.gemcut(g); };
        return d;
      };
      row.appendChild(mk(s.main, false)); row.appendChild(mk(s.supports[0], true, 0)); row.appendChild(mk(s.supports[1], true, 1));
      const info = document.createElement('div'); info.className = 'sock-info';
      info.innerHTML = sk ? `<b style="color:${sk.def.color}">${sk.def.name}</b> <span class="dim">Lv.${s.main.level}</span><br>DPS <b>${fmt(sk.dps)}</b> · 비용 ${sk.cost} · ${(1 / sk.time).toFixed(2)}/초${sk.projCount > 1 ? ` · 투사체 ${sk.projCount}` : ''}` : '<span class="dim">빈 슬롯</span>';
      row.appendChild(info); wrap.appendChild(row);
    });
    const bag = el('gem-bag'); bag.innerHTML = p.gemBag.length ? '' : '<div class="dim">보유한 젬 없음 — 몬스터를 처치하여 젬을 획득하세요</div>';
    p.gemBag.forEach(g => { const def = gemDef(g); const d = document.createElement('div'); d.className = 'bag-gem' + (this.gemSel === g ? ' sel' : '') + (g.support ? ' sup' : ''); d.style.setProperty('--c', def.color); d.innerHTML = `<span>${def.icon}</span><b>${def.name}</b><i>Lv.${g.level}</i>${g.support ? '<em>서포트</em>' : ''}`; d.onmouseenter = e => TouchCtl.enabled || this.tooltip(gemTooltipHTML(g) + '<div class="tt-hint">클릭: 선택 후 슬롯 클릭 · 우클릭: 젬 연마</div>', e.clientX, e.clientY); d.onmouseleave = () => this.hideTooltip(); d.onclick = () => { if (TouchCtl.enabled && this.gemSel !== g) { this.bagGemSheet(g); return; } this.gemSel = this.gemSel === g ? null : g; this.refreshGems(); Audio_.play('ui'); }; d.oncontextmenu = e => { e.preventDefault(); this.gemcut(g); }; bag.appendChild(d); });
    el('gem-hint').textContent = this.gemSel ? `${gemDef(this.gemSel).name} 선택됨 — 장착할 슬롯을 클릭하세요` : `젬 연마사의 프리즘 ${p.currency.gemcutter || 0}개 보유`;
  },
  gemcut(g) { const p = Game.player; if (!(p.currency.gemcutter > 0)) { Game.flash('젬 연마사의 프리즘이 없습니다', '#ff7b7b'); return; } if (g.level >= CFG.MAX_GEM_LEVEL) { Game.flash('이미 최대 레벨'); return; } p.currency.gemcutter--; g.level++; Audio_.play('orb'); p.recalc(); this.refreshGems(); this.refreshSkillbar(); },
  // ---------- 캐릭터 ----------
  refreshChar() {
    const p = Game.player; const s = p.stats; const c = CLASSES[p.cls];
    const rows = [
      ['이름 / 종족', `${esc(p.name)} · ${c.name}${p.hardcore ? ' (하드코어)' : ''}`], ['레벨', `${p.level} (경험치 ${fmt(p.xp)} / ${fmt(p.xpToNext(p.level))})`],
      ['힘 / 민첩 / 지능', `${s.str} / ${s.dex} / ${s.int}`], ['최대 생명력', `${s.maxLife} (재생 ${s.lifeRegen.toFixed(1)}/초)`], [`최대 ${c.resource.name}`, `${s.maxRes} (재생 ${s.resRegen.toFixed(1)}/초)`],
      ['방어도 / 회피', `${s.armor} / ${s.evasion}`], ['저항 (화/냉/번/카)', `${s.fire_res}% / ${s.cold_res}% / ${s.light_res}% / ${s.chaos_res}% (최대 ${s.maxResist}%)`],
      ['이동 속도', `${Math.round(s.moveSpeed)} (${signed((s.moveSpeed / CFG.PLAYER_SPEED - 1) * 100)}%)`], ['치명타 확률 / 배율', `${pct(clamp(s.critBase * (1 + s.incCrit), 0, 0.95))} / ×${s.critMulti.toFixed(2)}`],
      ['피해 증가', `전체 ${pct(s.inc.inc_dmg)} · 물리 ${pct(s.inc.inc_phys)} · 원소 ${pct(s.inc.inc_ele)} · 주문 ${pct(s.inc.inc_spell)} · 투사체 ${pct(s.inc.inc_proj)} · 근접 ${pct(s.inc.inc_melee)}`],
      ['피해 증폭', `전체 ×${s.more.dmg.toFixed(2)} · 물리 ×${s.more.phys.toFixed(2)} · 원소 ×${s.more.ele.toFixed(2)}`],
      ['공격 / 시전 속도', `${signed(s.inc.inc_aspd * 100)}% / ${signed(s.inc.inc_cspd * 100)}%`], ['생명력 흡수', pct(s.leech, 1)],
      ['현재 시간 보너스', `${Clock.label()} · 피해 ${signed(Combat.timeBonus(p) * 100)}%`], ['시간대 보너스 (낮/밤/황혼)', `${signed((c.time.day + s.inc.inc_day) * 100)}% / ${signed((c.time.night + s.inc.inc_night) * 100)}% / ${signed((c.time.twilight + s.inc.inc_twilight) * 100)}%`],
      ['투사체 / 연쇄 / 관통', `+${s.proj} / +${s.chain} / +${s.pierce}`], ['광역 효과', signed(s.incAoe * 100) + '%'],
      ['포션 충전 / 회피 재사용', `${s.potionCharges} / ${s.dodgeCd.toFixed(2)}초`],
      ['키스톤', [...s.flags].map(f => KEYSTONES.find(k => k.flag === f)?.name || f).join(', ') || '없음'], ['형상', [...s.aspects].map(a => ASPECTS[a].name).join(', ') || '없음'],
      ['처치 / 보스 처치 / 사망', `${fmt(p.kills)} / ${p.bossKills} / ${p.deaths}`], ['지도 클리어 / 최고 티어', `${p.mapsCleared} / ${p.maxTier}`], ['플레이 시간', timeStr(p.playtime)],
    ];
    el('char-stats').innerHTML = rows.map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  },
  // ---------- 패시브 트리 ----------
  resizeTree() { const c = this.treeCanvas; const r = c.parentElement.getBoundingClientRect(); c.width = Math.max(300, r.width); c.height = Math.max(300, r.height - 0); },
  treeToScreen(n) { const c = this.treeCanvas; return { x: c.width / 2 + this.tree.x + n.x * this.tree.zoom, y: c.height / 2 + this.tree.y + n.y * this.tree.zoom }; },
  treeHover(e) {
    const r = this.treeCanvas.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 18 * this.tree.zoom + 6;
    for (const n of TREE.nodes) { const s = this.treeToScreen(n); const d = dist(mx, my, s.x, s.y); if (d < bd) { bd = d; best = n; } }
    this.tree.hover = best;
    if (best) this.tooltip(Passives.nodeTooltipHTML(best, Game.player), e.clientX, e.clientY); else this.hideTooltip();
  },
  drawTree() {
    const c = this.treeCanvas, ctx = this.treeCtx, p = Game.player; if (!p) return;
    ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, c.width, c.height);
    const z = this.tree.zoom;
    // 배경 링
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; for (const r of [62, 130, 205, 285, 370, 455]) { ctx.beginPath(); ctx.arc(c.width / 2 + this.tree.x, c.height / 2 + this.tree.y, r * z, 0, Math.PI * 2); ctx.stroke(); }
    // 링크
    for (const n of TREE.nodes) for (const l of n.links) { if (l < n.id) continue; const m = TREE.byId[l]; const a = this.treeToScreen(n), b = this.treeToScreen(m); const both = p.passives.has(n.id) && p.passives.has(l); ctx.strokeStyle = both ? '#d9a441' : 'rgba(160,150,180,0.35)'; ctx.lineWidth = both ? 3 * z : 1.5 * z; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    // 노드
    for (const n of TREE.nodes) {
      const s = this.treeToScreen(n); const alloc = p.passives.has(n.id); const can = Passives.canAllocate(p, n.id);
      const r = (n.type === 'keystone' ? 16 : n.type === 'notable' ? 12 : n.type === 'start' ? 14 : 7) * z;
      const themeCol = { str: '#e63946', dex: '#7fd8a8', int: '#7b9bff', any: '#bbbbbb' }[n.theme] || (n.type === 'start' ? CLASSES[n.cls].color : '#bbbbbb');
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = alloc ? (n.type === 'keystone' ? '#ff7eb6' : n.type === 'notable' ? '#ffd23f' : '#d9a441') : can ? '#3a3350' : '#1c1826'; ctx.fill();
      ctx.lineWidth = (this.tree.hover === n ? 3 : 1.5) * z; ctx.strokeStyle = this.tree.hover === n ? '#fff' : alloc ? '#fff3b0' : can ? themeCol : hexA(themeCol, 0.5); ctx.stroke();
      if (n.type === 'start') { ctx.fillStyle = CLASSES[n.cls].color; ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
      if ((n.type === 'notable' || n.type === 'keystone') && z > 0.7) { ctx.fillStyle = alloc ? '#fff' : '#cfcfcf'; ctx.font = `${Math.round(10 * z)}px "Noto Sans KR"`; ctx.textAlign = 'center'; ctx.fillText(n.name, s.x, s.y + r + 12 * z); }
    }
    el('tree-points').textContent = `사용 가능 포인트: ${Passives.pointsAvailable(p)} · 할당 ${p.passives.size - 1} · 후회의 오브 ${p.currency.regret || 0}`;
  },
};
