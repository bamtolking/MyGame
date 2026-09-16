'use strict';
// ===================== 스킬 젬 (PoE 스타일) =====================
// type: 'attack' (무기 피해 × eff) | 'spell' (base 피해)
const GEMS = {
  // ---- 공격 ----
  rapid_fire: { name: '연사', type: 'attack', tags: ['attack', 'projectile'], icon: '➶', color: '#f0d78c', cost: 3, time: 0.30, eff: 0.75, cls: 'slayer',
    kind: 'projectile', proj: { count: 1, speed: 640, range: 560, size: 5 }, sfx: 'shoot',
    desc: '빠르게 탄환을 발사한다. 기본 공격으로 적합.' },
  scatter: { name: '산탄', type: 'attack', tags: ['attack', 'projectile'], icon: '⁂', color: '#ffb27a', cost: 6, time: 0.5, eff: 0.45,
    kind: 'projectile', proj: { count: 5, spread: 0.6, speed: 540, range: 300, size: 5 }, knock: 140, sfx: 'shoot',
    desc: '부채꼴로 5발을 발사한다. 근거리에서 치명적.' },
  blood_claw: { name: '혈족의 손톱', type: 'attack', tags: ['attack', 'melee'], icon: '⟁', color: '#e63946', cost: 0, gain: 6, time: 0.38, eff: 1.25, cls: 'vampire',
    kind: 'melee', melee: { arc: 2.0, range: 78 }, ailment: { bleed: 0.5 }, sfx: 'melee',
    desc: '앞의 적을 손톱으로 찢어 출혈을 일으킨다. 타격 시 혈액을 얻는다.' },
  heavy_strike: { name: '강타', type: 'attack', tags: ['attack', 'melee'], icon: '⚒', color: '#c8c8c8', cost: 5, time: 0.62, eff: 2.3,
    kind: 'melee', melee: { arc: 1.3, range: 88 }, knock: 280, stun: 0.5, sfx: 'melee',
    desc: '강력한 일격. 적을 밀쳐내고 잠시 기절시킨다.' },
  whirl: { name: '회전 베기', type: 'attack', tags: ['attack', 'melee', 'aoe'], icon: '🌀', color: '#d0d0ff', cost: 4, time: 0.28, eff: 0.62,
    kind: 'melee', melee: { arc: 6.4, range: 98 }, channel: true, sfx: 'melee',
    desc: '주위를 회전하며 베어낸다. 누르고 있으면 계속된다.' },
  execute: { name: '처형', type: 'attack', tags: ['attack', 'melee'], icon: '☠', color: '#ff5c5c', cost: 8, time: 0.45, eff: 1.6, cd: 4,
    kind: 'melee', melee: { arc: 1.0, range: 82 }, executeMult: 3, sfx: 'melee',
    desc: '생명력 30% 이하의 적에게 3배 피해를 준다.' },
  shadow_dash: { name: '그림자 질주', type: 'attack', tags: ['attack', 'melee', 'movement'], icon: '➤', color: '#9b5de5', cost: 6, time: 0.3, cd: 3, eff: 1.4,
    kind: 'dash', dash: { dist: 230 }, ailment: { bleed: 0.5 }, sfx: 'dodge',
    desc: '적을 관통하며 돌진, 경로의 모든 적을 벤다.' },
  // ---- 주문 ----
  fireball: { name: '화염구', type: 'spell', tags: ['spell', 'projectile', 'fire', 'aoe'], icon: '🔥', color: '#ff6b35', cost: 7, time: 0.55,
    base: { fire: [9, 15] }, kind: 'projectile', proj: { count: 1, speed: 430, range: 600, size: 9, explode: 72 }, ailment: { ignite: 1 }, light: true, sfx: 'cast',
    desc: '폭발하는 화염구. 적을 점화시킨다.' },
  frost_bolt: { name: '서리 화살', type: 'spell', tags: ['spell', 'projectile', 'cold'], icon: '❄', color: '#7fd8ff', cost: 5, time: 0.4,
    base: { cold: [7, 11] }, kind: 'projectile', proj: { count: 1, speed: 540, range: 560, size: 7, pierce: 2 }, ailment: { chill: 1 }, sfx: 'cast',
    desc: '관통하는 얼음 화살. 적을 둔화시킨다.' },
  chain_lightning: { name: '연쇄 번개', type: 'spell', tags: ['spell', 'projectile', 'lightning'], icon: '⚡', color: '#ffe94d', cost: 8, time: 0.5,
    base: { light: [3, 24] }, kind: 'projectile', proj: { count: 1, speed: 950, range: 420, size: 6, chain: 3 }, ailment: { shock: 1 }, sfx: 'cast',
    desc: '적 사이를 튀어 다니는 번개. 감전을 유발한다.' },
  holy_grenade: { name: '성수 수류탄', type: 'spell', tags: ['spell', 'aoe', 'fire'], icon: '✚', color: '#ffe9a8', cost: 12, time: 0.6, cd: 1.5, cls: 'slayer',
    base: { fire: [18, 30], phys: [10, 16] }, kind: 'aoe', aoe: { radius: 95, delay: 0.55, maxRange: 420 }, ailment: { ignite: 0.5 }, sfx: 'cast',
    desc: '지정 지점에 성수 폭탄을 던진다. 잠시 후 폭발한다.' },
  blood_nova: { name: '피의 폭발', type: 'spell', tags: ['spell', 'aoe', 'physical', 'chaos'], icon: '🩸', color: '#c1121f', cost: 25, time: 0.5, cd: 2.5, cls: 'vampire',
    base: { phys: [20, 30], chaos: [12, 20] }, kind: 'nova', nova: { radius: 150 }, knock: 160, missingLifeBonus: 1.0, sfx: 'explode',
    desc: '혈액을 폭발시켜 주위의 모든 적을 강타한다. 잃은 생명력에 비례해 강해진다.' },
  drain: { name: '흡혈', type: 'spell', tags: ['spell', 'chaos', 'channel'], icon: '⌇', color: '#b34dff', cost: 3, time: 0.2, cls: 'vampire',
    base: { chaos: [4, 6] }, kind: 'beam', beam: { range: 240, width: 28 }, channel: true, leech: 0.12, sfx: null,
    desc: '적의 피를 뽑아내는 광선. 피해의 12%를 생명력으로 되돌린다.' },
  wind_blade: { name: '바람의 칼날', type: 'spell', tags: ['spell', 'projectile', 'physical'], icon: '〰', color: '#b7e4c7', cost: 5, time: 0.42, cls: 'ouster',
    base: { phys: [8, 13] }, kind: 'projectile', proj: { count: 1, speed: 560, range: 400, size: 8, pierce: 99, boomerang: true }, knock: 70, sfx: 'cast',
    desc: '모든 적을 관통하고 되돌아오는 바람의 칼날.' },
  thorn_vines: { name: '가시 덩굴', type: 'spell', tags: ['spell', 'aoe', 'chaos', 'dot'], icon: '❈', color: '#52b788', cost: 10, time: 0.5, cd: 1.2, cls: 'ouster',
    base: { chaos: [5, 8] }, kind: 'ground', ground: { radius: 85, duration: 5, tick: 0.5, maxRange: 400, slow: 0.35 }, sfx: 'cast',
    desc: '지면에 가시 덩굴을 소환한다. 지속 카오스 피해와 둔화.' },
  summon_spirit: { name: '정령 소환', type: 'spell', tags: ['spell', 'minion'], icon: '✧', color: '#90e0ef', cost: 20, time: 0.7, cd: 1, cls: 'ouster',
    base: { cold: [6, 10] }, kind: 'summon', summon: { max: 2, duration: 45 }, sfx: 'cast',
    desc: '따라다니며 냉기 화살을 쏘는 정령을 소환한다 (최대 2).' },
  meteor: { name: '유성', type: 'spell', tags: ['spell', 'aoe', 'fire'], icon: '☄', color: '#ff8c1a', cost: 22, time: 0.8, cd: 4,
    base: { fire: [60, 95] }, kind: 'aoe', aoe: { radius: 130, delay: 1.1, maxRange: 450 }, ailment: { ignite: 1 }, light: true, sfx: 'cast',
    desc: '하늘에서 유성을 떨어뜨린다. 느리지만 압도적이다.' },
  poison_cloud: { name: '독 구름', type: 'spell', tags: ['spell', 'aoe', 'chaos', 'dot'], icon: '☁', color: '#9ef01a', cost: 9, time: 0.45, cd: 1,
    base: { chaos: [7, 10] }, kind: 'ground', ground: { radius: 100, duration: 4, tick: 0.4, maxRange: 380 }, sfx: 'cast',
    desc: '지속 카오스 피해를 주는 독 구름을 만든다.' },
  storm_call: { name: '폭풍의 부름', type: 'spell', tags: ['spell', 'aoe', 'lightning'], icon: '☈', color: '#fff3b0', cost: 14, time: 0.55, cd: 2.5,
    base: { light: [6, 52] }, kind: 'storm', storm: { radius: 140, strikes: 8, duration: 2.5, strikeRadius: 48, maxRange: 450 }, ailment: { shock: 1 }, sfx: 'cast',
    desc: '지정 영역에 번개가 연달아 내리친다.' },
  frost_nova: { name: '서리 폭발', type: 'spell', tags: ['spell', 'aoe', 'cold'], icon: '✱', color: '#a2d2ff', cost: 14, time: 0.45, cd: 2,
    base: { cold: [16, 26] }, kind: 'nova', nova: { radius: 130 }, ailment: { chill: 1, freeze: 0.3 }, sfx: 'freeze',
    desc: '주위에 냉기 폭발. 적을 둔화시키고 30% 확률로 동결.' },
};
const GEM_IDS = Object.keys(GEMS);

// ===================== 서포트 젬 =====================
const SUPPORTS = {
  gmp: { name: '다중 투사체', icon: '⋔', color: '#9ad0ff', req: 'projectile', mods: { proj: 2, more_dmg: -0.26 }, desc: '투사체 +2, 피해 26% 감폭' },
  chain: { name: '연쇄', icon: '⛓', color: '#ffe94d', req: 'projectile', mods: { chain: 2, more_dmg: -0.20 }, desc: '투사체 연쇄 +2, 피해 20% 감폭' },
  pierce: { name: '관통', icon: '➵', color: '#b7e4c7', req: 'projectile', mods: { pierce: 2, inc_proj: 0.20 }, desc: '투사체 관통 +2, 투사체 피해 20% 증가' },
  faster: { name: '신속', icon: '≫', color: '#f0d78c', mods: { inc_aspd: 0.30, inc_cspd: 0.30 }, desc: '공격/시전 속도 30% 증가' },
  added_fire: { name: '화염 부여', icon: '🔥', color: '#ff6b35', mods: { phys_as_fire: 0.35 }, desc: '물리 피해의 35%를 추가 화염 피해로 얻는다' },
  added_cold: { name: '냉기 부여', icon: '❄', color: '#7fd8ff', mods: { add_cold: { min: 4, max: 7 } }, ailment: { chill: 1 }, desc: '냉기 피해 추가 (젬 레벨에 비례), 둔화 부여' },
  added_light: { name: '번개 부여', icon: '⚡', color: '#ffe94d', mods: { add_light: { min: 1, max: 13 } }, ailment: { shock: 1 }, desc: '번개 피해 추가 (젬 레벨에 비례), 감전 부여' },
  inc_aoe: { name: '광역 확장', icon: '◎', color: '#52b788', req: 'aoe', mods: { inc_aoe: 0.45 }, desc: '광역 효과 범위 45% 증가' },
  conc: { name: '집중 효과', icon: '◉', color: '#ff8c1a', req: 'aoe', mods: { inc_aoe: -0.30, more_dmg: 0.40 }, desc: '광역 범위 30% 감소, 피해 40% 증폭' },
  life_leech: { name: '생명력 흡수', icon: '♥', color: '#e63946', mods: { leech: 0.04 }, desc: '피해의 4%를 생명력으로 흡수' },
  crit: { name: '치명타 강화', icon: '✦', color: '#ffffff', mods: { inc_crit: 0.9, crit_multi: 0.3 }, desc: '치명타 확률 90% 증가, 치명타 배율 +30%' },
  brutality: { name: '잔혹함', icon: '⚔', color: '#e6e6e6', mods: { more_phys: 0.45 }, flag: 'noEle', desc: '물리 피해 45% 증폭. 원소/카오스 피해를 줄 수 없음' },
  ele_focus: { name: '원소 집중', icon: '✹', color: '#ffb3c6', mods: { more_ele: 0.40 }, flag: 'noAilment', desc: '원소 피해 40% 증폭. 상태이상을 걸 수 없음' },
  cheap: { name: '절약', icon: '◇', color: '#9fe1a5', mods: { reduced_cost: 0.45 }, desc: '스킬 비용 45% 감소' },
  fast_proj: { name: '투사체 가속', icon: '↠', color: '#b7e4c7', req: 'projectile', mods: { inc_proj_speed: 0.6, inc_proj: 0.25 }, desc: '투사체 속도 60% 증가, 투사체 피해 25% 증가' },
  splash: { name: '근접 확산', icon: '✺', color: '#d0d0ff', req: 'melee', mods: { more_dmg: -0.15 }, flag: 'splash', desc: '근접 타격이 주위 적에게도 피해 (15% 감폭)' },
  minion: { name: '소환수 강화', icon: '✧', color: '#90e0ef', req: 'minion', mods: { inc_minion: 0.6 }, desc: '소환수 피해 60% 증가' },
  echo: { name: '주문 반복', icon: '⧉', color: '#c77dff', req: 'spell', mods: { more_dmg: -0.12 }, flag: 'repeat', desc: '주문을 한 번 더 시전 (12% 감폭)' },
  empower: { name: '강화', icon: '▲', color: '#ffd23f', mods: { more_dmg: 0.18 }, desc: '피해 18% 증폭 (젬 레벨에 비례)' },
};
const SUPPORT_IDS = Object.keys(SUPPORTS);

function makeGem(id, level = 1, support = false) {
  return { uid: uid(), id, level: clamp(level, 1, CFG.MAX_GEM_LEVEL), xp: 0, support };
}
function gemDef(g) { return g.support ? SUPPORTS[g.id] : GEMS[g.id]; }
function gemXPNeeded(level) { return Math.round(60 * Math.pow(level, 2.2)); }
function gemLevelMult(g) { return 1 + 0.07 * (g.level - 1); }
function supportScale(g) { return 1 + 0.03 * (g.level - 1); }
function supportFits(sup, mainDef) { return !sup.req || mainDef.tags.includes(sup.req); }

function gemTooltipHTML(g, skillCalc) {
  const d = gemDef(g);
  let h = `<div class="tt-name" style="color:${d.color}">${d.icon} ${esc(d.name)} <span class="lv">Lv.${g.level}</span></div>`;
  h += `<div class="tt-sub">${g.support ? '서포트 젬' + (d.req ? ` · ${TAG_KR[d.req] || d.req} 스킬 전용` : '') : (d.type === 'attack' ? '공격' : '주문') + ' 젬 · ' + d.tags.map(t => TAG_KR[t] || t).join(', ')}</div>`;
  h += `<div class="tt-mods">${esc(d.desc)}</div>`;
  if (!g.support) {
    const parts = [];
    if (d.type === 'attack') parts.push(`무기 피해의 ${Math.round(d.eff * (1 + 0.04 * (g.level - 1)) * 100)}%`);
    if (d.base) for (const t in d.base) parts.push(`${DMG[t].name} ${Math.round(d.base[t][0] * gemLevelMult(g))}–${Math.round(d.base[t][1] * gemLevelMult(g))}`);
    if (d.cost) parts.push(`비용 ${Math.round(d.cost * (1 + 0.02 * (g.level - 1)))}`);
    if (d.gain) parts.push(`타격 시 자원 +${d.gain}`);
    if (d.cd) parts.push(`재사용 ${d.cd}초`);
    parts.push(`시전 ${d.time}초`);
    h += `<div class="tt-props">${parts.join(' · ')}</div>`;
    if (skillCalc) {
      const total = DMG_TYPES.map(t => skillCalc.dmg[t]).filter(x => x && x.max > 0);
      h += `<div class="tt-impl">계산된 피해: ${total.map(x => `<span style="color:${DMG[x.type].color}">${Math.round(x.min)}–${Math.round(x.max)}</span>`).join(' + ')}<br>초당 ${(1 / skillCalc.time).toFixed(2)}회 · 치명타 ${pct(skillCalc.critChance)} (×${skillCalc.critMulti.toFixed(2)}) · 예상 DPS <b>${fmt(skillCalc.dps)}</b>${skillCalc.projCount > 1 ? ` · 투사체 ${skillCalc.projCount}` : ''}${skillCalc.chain ? ` · 연쇄 ${skillCalc.chain}` : ''}${skillCalc.pierce ? ` · 관통 ${skillCalc.pierce >= 99 ? '∞' : skillCalc.pierce}` : ''}</div>`;
    }
  }
  h += `<div class="tt-sub">경험치 ${fmt(g.xp)} / ${fmt(gemXPNeeded(g.level))}</div>`;
  return h;
}
const TAG_KR = { attack: '공격', spell: '주문', projectile: '투사체', melee: '근접', aoe: '광역', fire: '화염', cold: '냉기', lightning: '번개', physical: '물리', chaos: '카오스', dot: '지속', minion: '소환', channel: '집중', movement: '이동' };
