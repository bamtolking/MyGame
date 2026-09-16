'use strict';
// ===================== 캐릭터 스탯 계산 =====================
function addMod(acc, k, v) { acc[k] = (acc[k] || 0) + v; }
function collectItemMods(item, acc, adds, isWeapon) {
  for (const m of itemAllMods(item)) {
    if (m.k.startsWith('add_')) { (isWeapon ? adds.weapon : adds.other).push(m); continue; }
    if (m.k === 'all_attr') { addMod(acc, 'str', m.v); addMod(acc, 'dex', m.v); addMod(acc, 'int', m.v); continue; }
    if (m.k === 'all_res') { addMod(acc, 'fire_res', m.v); addMod(acc, 'cold_res', m.v); addMod(acc, 'light_res', m.v); continue; }
    addMod(acc, m.k, m.v);
  }
}
function computeStats(p) {
  const cls = CLASSES[p.cls];
  const acc = {}; const adds = { weapon: [], other: [] }; const flags = new Set(); const aspects = new Set();
  // 장비
  for (const slot of EQUIP_SLOTS) {
    const it = p.equipment[slot]; if (!it) continue;
    collectItemMods(it, acc, adds, slot === 'weapon');
    if (it.aspect) aspects.add(it.aspect);
    if (it.props.armor) addMod(acc, 'armor', it.props.armor);
    if (it.props.eva) addMod(acc, 'evasion', it.props.eva);
  }
  // 패시브
  const pm = Passives.mods(p);
  for (const k in pm.mods) { if (k === 'all_attr') { addMod(acc, 'str', pm.mods[k]); addMod(acc, 'dex', pm.mods[k]); addMod(acc, 'int', pm.mods[k]); } else if (k === 'all_res') { addMod(acc, 'fire_res', pm.mods[k]); addMod(acc, 'cold_res', pm.mods[k]); addMod(acc, 'light_res', pm.mods[k]); } else addMod(acc, k, pm.mods[k]); }
  for (const f of pm.flags) flags.add(f);
  // 버프
  for (const b of p.buffs) for (const k in b.mods) addMod(acc, k, b.mods[k] * (b.stacks || 1));
  // 맵 모드
  if (p.mapMods) for (const k in p.mapMods) addMod(acc, k, p.mapMods[k]);
  // 종족 궁극기
  if (p.ult.active) {
    if (p.cls === 'slayer') { addMod(acc, 'more_dmg', 0.8); addMod(acc, 'proj', 1); }
    if (p.cls === 'ouster') addMod(acc, 'inc_move', 0.3);
    if (p.cls === 'vampire') addMod(acc, 'inc_move', 0.8);
  }
  // 시간대 형상
  if (aspects.has('night_crown') && Clock.isNight()) { addMod(acc, 'inc_move', 0.25); addMod(acc, 'chain', 1); }
  if (aspects.has('twilight_focus') && Clock.isTwilight()) { addMod(acc, 'inc_aspd', 0.4); addMod(acc, 'inc_cspd', 0.4); }

  const s = {};
  s.str = cls.base.str + (acc.str || 0) + Math.floor(p.level / 2);
  s.dex = cls.base.dex + (acc.dex || 0) + Math.floor(p.level / 2);
  s.int = cls.base.int + (acc.int || 0) + Math.floor(p.level / 2);
  const g = k => acc[k] || 0;
  const moreLife = 1 + g('more_life');
  s.maxLife = Math.max(1, Math.round((90 + 14 * (p.level - 1) + s.str * 0.5 + g('life')) * (1 + g('inc_life')) * moreLife));
  s.maxRes = Math.round((cls.resource.max + s.int * 0.5 + g('res')) * (1 + g('inc_res')));
  s.armor = Math.round(g('armor') * (1 + g('inc_armor')));
  s.evasion = Math.round((g('evasion') + s.dex * 2) * (1 + g('inc_eva')));
  if (flags.has('iron_reflexes')) { s.armor += s.evasion; s.evasion = 0; }
  if (flags.has('no_evasion')) s.evasion = 0;
  s.physRed = Math.min(0.4, g('phys_red'));
  s.maxResist = CFG.MAX_RES + g('max_res_all');
  for (const t of ['fire', 'cold', 'light', 'chaos']) s[t + '_res'] = Math.min(s.maxResist, g(t + '_res'));
  s.moveSpeed = CFG.PLAYER_SPEED * clamp(1 + g('inc_move'), 0.4, 2.5);
  s.lifeRegen = flags.has('vaal_pact') ? 0 : (s.maxLife * 0.006 + g('life_regen')) * Math.max(0, 1 + g('inc_regen'));
  s.resRegen = (cls.resource.regen + g('res_regen') + s.int * 0.02) * (1 + g('inc_res_regen'));
  s.leech = g('leech') * (flags.has('vaal_pact') ? 2 : 1);
  s.lifeOnKill = g('life_on_kill'); s.resOnKill = g('res_on_kill') + cls.resource.onKill;
  s.critBase = 0.05; s.incCrit = g('inc_crit') + s.dex * 0.004; s.critMulti = 1.5 + g('crit_multi');
  if (flags.has('ele_overload')) s.critMulti = 1.0;
  if (flags.has('no_crit')) s.incCrit = -999;
  s.potionCharges = CFG.POTION_CHARGES + g('potion_charges');
  s.dodgeCd = CFG.DODGE_CD * (1 - Math.min(0.6, g('dodge_cd')));
  s.thorns = g('thorns');
  s.reducedCost = Math.min(0.8, g('reduced_cost'));
  s.proj = g('proj'); s.chain = g('chain'); s.pierce = g('pierce');
  s.incAoe = g('inc_aoe');
  s.strPhys = s.str * 0.002; s.intSpell = s.int * 0.002;
  // 피해 증가/증폭 (스킬 계산에서 사용)
  s.inc = {};
  for (const k of ['inc_dmg', 'inc_phys', 'inc_fire', 'inc_cold', 'inc_light', 'inc_chaos', 'inc_ele', 'inc_spell', 'inc_attack', 'inc_melee', 'inc_proj', 'inc_aoe_dmg', 'inc_dot', 'inc_minion', 'inc_aspd', 'inc_cspd', 'inc_proj_speed', 'inc_day', 'inc_night', 'inc_twilight']) s.inc[k] = g(k);
  s.inc.inc_phys += s.strPhys; s.inc.inc_spell += s.intSpell;
  s.more = { dmg: 1 + g('more_dmg'), phys: 1 + g('more_phys'), ele: 1 + g('more_ele') };
  s.adds = adds; s.flags = flags; s.aspects = aspects;
  s.acc = acc;
  return s;
}
