'use strict';
// ===================== 아이템 생성 =====================
function baseProps(base, ilvl) {
  const p = {};
  if (base.slot === 'weapon') {
    p.min = Math.max(1, Math.round((3 + ilvl * 0.75) * base.dmg));
    p.max = Math.max(p.min + 1, Math.round((6 + ilvl * 1.4) * base.dmg));
    p.aps = base.aps;
  } else if (ARMOR_SLOTS.includes(base.slot)) {
    const slotMult = { helm: 1, body: 2.2, gloves: 0.7, boots: 0.7 }[base.slot];
    p.armor = Math.round((8 + ilvl * 2.4) * base.armor * slotMult);
    p.eva = Math.round((8 + ilvl * 2.4) * base.eva * slotMult);
  }
  return p;
}
function makeItem(slot, ilvl, rarity, opts = {}) {
  const bases = BASES[slot];
  const base = opts.base ? BASE_BY_ID[opts.base] : choice(bases);
  const item = { uid: uid(), slot, base: base.id, ilvl: Math.max(1, Math.round(ilvl)), rarity, mods: [], aspect: null, uniqueId: null, name: '' };
  item.props = baseProps(base, item.ilvl);
  if (rarity === 'unique') {
    const pool = UNIQUES.filter(u => BASE_BY_ID[u.base].slot === slot && u.lvl <= item.ilvl + 2);
    if (!pool.length) { item.rarity = 'rare'; rollItemMods(item); }
    else makeUniqueFrom(item, opts.uniqueId ? UNIQUE_BY_ID[opts.uniqueId] : choice(pool));
  } else rollItemMods(item);
  return item;
}
function makeUniqueFrom(item, u) {
  const base = BASE_BY_ID[u.base];
  item.base = base.id; item.slot = base.slot; item.rarity = 'unique'; item.uniqueId = u.id;
  item.props = baseProps(base, item.ilvl);
  item.mods = u.mods.map(m => Object.assign({ fixed: true }, m));
  item.aspect = u.aspect; item.name = u.name;
}
function makeUnique(id, ilvl) {
  const u = UNIQUE_BY_ID[id]; const base = BASE_BY_ID[u.base];
  const item = { uid: uid(), slot: base.slot, base: base.id, ilvl: Math.max(u.lvl, Math.round(ilvl)), rarity: 'unique', mods: [], aspect: null };
  makeUniqueFrom(item, u); return item;
}
function affixCounts(item) {
  let pre = 0, suf = 0;
  for (const m of item.mods) { if (m.fixed) continue; if (AFFIX_BY_ID[m.affix]?.pre) pre++; else suf++; }
  return { pre, suf };
}
function maxAffix(rarity) { return rarity === 'magic' ? 1 : rarity === 'rare' ? 3 : 0; }
function rollTier(affix, ilvl) {
  const elig = affix.tiers.filter(t => t[0] <= ilvl);
  if (!elig.length) return null;
  // 높은 티어일수록 희귀
  const w = elig.map((t, i) => Math.pow(1.7, elig.length - 1 - i));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), idx = 0;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } }
  return { tier: elig[idx], tierIdx: affix.tiers.indexOf(elig[idx]) + 1 };
}
function rollValue(affix, tierInfo) {
  const t = tierInfo.tier;
  const m = { k: affix.k, affix: affix.id, tier: tierInfo.tierIdx };
  if (affix.k.startsWith('add_')) { m.min = randInt(t[1], t[2]); m.max = Math.max(m.min + 1, randInt(t[3], t[4])); }
  else if (Number.isInteger(t[1]) && Number.isInteger(t[2]) && t[2] >= 1) m.v = randInt(t[1], t[2]);
  else m.v = Math.round(rand(t[1], t[2]) * 1000) / 1000;
  return m;
}
function addRandomAffix(item, forcePre) {
  const c = affixCounts(item); const mx = maxAffix(item.rarity);
  let wantPre;
  if (forcePre === true) { if (c.pre >= mx) return false; wantPre = true; }
  else if (forcePre === false) { if (c.suf >= mx) return false; wantPre = false; }
  else {
    const canPre = c.pre < mx, canSuf = c.suf < mx;
    if (!canPre && !canSuf) return false;
    wantPre = canPre && canSuf ? chance(0.5) : canPre;
  }
  const have = new Set(item.mods.map(m => m.affix));
  const slotKey = item.slot;
  const pool = AFFIXES.filter(a => !!a.pre === wantPre && a.slots.includes(slotKey) && !have.has(a.id) && a.tiers[0][0] <= item.ilvl);
  if (!pool.length) return false;
  const affix = weightedChoice(pool, a => a.w);
  const ti = rollTier(affix, item.ilvl); if (!ti) return false;
  item.mods.push(rollValue(affix, ti));
  return true;
}
function rollItemMods(item) {
  item.mods = item.mods.filter(m => m.fixed);
  if (item.rarity === 'magic') {
    const n = chance(0.5) ? 1 : 2;
    for (let i = 0; i < n; i++) addRandomAffix(item);
  } else if (item.rarity === 'rare') {
    const n = randInt(3, 4) + (chance(0.35) ? 1 : 0) + (item.ilvl > 30 && chance(0.35) ? 1 : 0);
    for (let i = 0; i < n; i++) addRandomAffix(item);
  }
  nameItem(item);
}
function nameItem(item) {
  const base = BASE_BY_ID[item.base];
  if (item.rarity === 'unique') return;
  if (item.rarity === 'normal') item.name = base.name;
  else if (item.rarity === 'magic') {
    const pre = item.mods.find(m => AFFIX_BY_ID[m.affix]?.pre), suf = item.mods.find(m => m.affix && !AFFIX_BY_ID[m.affix]?.pre);
    item.name = (suf ? AFFIX_BY_ID[suf.affix].name + ' ' : '') + (pre ? AFFIX_BY_ID[pre.affix].name + ' ' : '') + base.name;
  } else {
    if (!item.rareName) {
      const pool = item.slot === 'weapon' ? RARE_SUFFIX.weapon : ['ring', 'amulet', 'belt'].includes(item.slot) ? RARE_SUFFIX.jewel : RARE_SUFFIX.armor;
      item.rareName = choice(RARE_PREFIX) + ' ' + choice(pool);
    }
    item.name = item.rareName;
  }
}
function itemColor(item) {
  if (item.rarity === 'unique') return RARITY.unique.color;
  if (item.aspect) return LEGENDARY_COLOR;
  return RARITY[item.rarity].color;
}
function itemImplicits(item) { return (BASE_BY_ID[item.base].impl || []).map(m => Object.assign({ implicit: true }, m)); }
function itemAllMods(item) {
  const mods = [...itemImplicits(item), ...item.mods];
  if (item.aspect === 'potion_nova') mods.push({ k: 'potion_charges', v: 1, aspectMod: true });
  return mods;
}
function itemDPS(item) {
  if (item.slot !== 'weapon') return 0;
  return (item.props.min + item.props.max) / 2 * item.props.aps;
}
function itemScore(item) {
  // 간단 점수 (비교용)
  let s = 0;
  if (item.slot === 'weapon') s += itemDPS(item) * 2;
  if (item.props.armor) s += item.props.armor * 0.3;
  if (item.props.eva) s += item.props.eva * 0.3;
  for (const m of itemAllMods(item)) {
    if (m.k.startsWith('add_')) s += (m.min + m.max);
    else if (m.k === 'life') s += m.v * 0.5;
    else if (m.k.startsWith('inc_')) s += m.v * 40;
    else if (m.k.endsWith('_res')) s += m.v * 0.5;
    else s += Math.abs(m.v || 0) * 0.5;
  }
  if (item.aspect) s += 40;
  return s;
}
function slotLabel(slot) { return { weapon: '무기', helm: '투구', body: '갑옷', gloves: '장갑', boots: '신발', belt: '벨트', ring: '반지', amulet: '목걸이' }[slot]; }

function itemTooltipHTML(item, opts = {}) {
  const base = BASE_BY_ID[item.base];
  const color = itemColor(item);
  let h = `<div class="tt-name" style="color:${color}">${esc(item.name)}</div>`;
  if (item.rarity !== 'normal' && item.name !== base.name) h += `<div class="tt-base" style="color:${color}">${esc(base.name)}</div>`;
  h += `<div class="tt-sub">${RARITY[item.rarity].name}${item.aspect && item.rarity !== 'unique' ? ' (전설)' : ''} · ${slotLabel(item.slot)} · 아이템 레벨 ${item.ilvl}</div>`;
  if (item.slot === 'weapon') h += `<div class="tt-props">물리 피해 <b>${item.props.min}–${item.props.max}</b> · 초당 공격 <b>${item.props.aps.toFixed(2)}</b> · DPS <b>${itemDPS(item).toFixed(1)}</b></div>`;
  else if (item.props.armor || item.props.eva) h += `<div class="tt-props">${item.props.armor ? `방어도 <b>${item.props.armor}</b>` : ''} ${item.props.eva ? `회피 <b>${item.props.eva}</b>` : ''}</div>`;
  const impl = itemImplicits(item);
  if (impl.length) h += `<div class="tt-impl">${impl.map(m => esc(modText(m))).join('<br>')}</div>`;
  if (item.mods.length) h += `<div class="tt-mods">${item.mods.map(m => `<span class="${m.fixed ? 'uniq' : ''}">${esc(modText(m))}${m.tier && opts.tiers !== false ? `<i class="tier">T${m.tier}</i>` : ''}</span>`).join('<br>')}</div>`;
  if (item.aspect) { const a = ASPECTS[item.aspect]; h += `<div class="tt-aspect">★ ${esc(a.name)}<br><span>${esc(a.desc)}</span></div>`; }
  if (item.uniqueId) h += `<div class="tt-flavor">${esc(UNIQUE_BY_ID[item.uniqueId].flavor)}</div>`;
  if (opts.hint) h += `<div class="tt-hint">${opts.hint}</div>`;
  return h;
}

// ===================== 오브 적용 (PoE 제작) =====================
function applyCurrency(cur, item) {
  const fail = msg => ({ ok: false, msg });
  if (item.rarity === 'unique' && cur !== 'divine') return fail('유니크 아이템에는 사용할 수 없습니다');
  switch (cur) {
    case 'transmute':
      if (item.rarity !== 'normal') return fail('일반 아이템에만 사용 가능');
      item.rarity = 'magic'; rollItemMods(item); return { ok: true };
    case 'alteration':
      if (item.rarity !== 'magic') return fail('마법 아이템에만 사용 가능');
      rollItemMods(item); return { ok: true };
    case 'augment': {
      if (item.rarity !== 'magic') return fail('마법 아이템에만 사용 가능');
      if (item.mods.filter(m => !m.fixed).length >= 2) return fail('이미 속성이 가득 찼습니다');
      if (!addRandomAffix(item)) return fail('추가할 수 있는 속성이 없습니다');
      nameItem(item); return { ok: true };
    }
    case 'regal':
      if (item.rarity !== 'magic') return fail('마법 아이템에만 사용 가능');
      item.rarity = 'rare'; addRandomAffix(item); item.rareName = null; nameItem(item); return { ok: true };
    case 'alchemy':
      if (item.rarity !== 'normal') return fail('일반 아이템에만 사용 가능');
      item.rarity = 'rare'; rollItemMods(item); return { ok: true };
    case 'chaos':
      if (item.rarity !== 'rare') return fail('희귀 아이템에만 사용 가능');
      item.rareName = null; rollItemMods(item); return { ok: true };
    case 'exalt': {
      if (item.rarity !== 'rare') return fail('희귀 아이템에만 사용 가능');
      if (item.mods.filter(m => !m.fixed).length >= 6) return fail('이미 속성이 가득 찼습니다');
      if (!addRandomAffix(item)) return fail('추가할 수 있는 속성이 없습니다');
      return { ok: true };
    }
    case 'annul': {
      const cand = item.mods.filter(m => !m.fixed);
      if (!cand.length) return fail('제거할 속성이 없습니다');
      const m = choice(cand); item.mods.splice(item.mods.indexOf(m), 1);
      if (item.rarity === 'magic') nameItem(item);
      return { ok: true };
    }
    case 'scour':
      if (item.rarity === 'normal') return fail('이미 일반 아이템입니다');
      item.rarity = 'normal'; item.mods = item.mods.filter(m => m.fixed); item.rareName = null; nameItem(item); return { ok: true };
    case 'divine': {
      if (!item.mods.length) return fail('다시 굴릴 속성이 없습니다');
      for (const m of item.mods) {
        if (m.fixed) { // 유니크: 고정 범위 ±15%
          if (m.k.startsWith('add_')) { m.min = Math.max(1, Math.round(m.min * rand(0.85, 1.15))); m.max = Math.max(m.min + 1, Math.round(m.max * rand(0.85, 1.15))); }
          continue;
        }
        const a = AFFIX_BY_ID[m.affix]; if (!a) continue;
        const t = a.tiers[m.tier - 1]; if (!t) continue;
        const nv = rollValue(a, { tier: t, tierIdx: m.tier });
        if (m.k.startsWith('add_')) { m.min = nv.min; m.max = nv.max; } else m.v = nv.v;
      }
      return { ok: true };
    }
  }
  return fail('사용할 수 없습니다');
}
