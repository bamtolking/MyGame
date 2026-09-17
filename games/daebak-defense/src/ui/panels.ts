import type { GameState, Grade, UnitKind, MythicId, Unit } from '../sim/types';
import { h, clear, fmtTime } from './dom';
import { UNITS, UNIT_KINDS, MYTHICS, MYTHIC_IDS, EFFECT_BY_GRADE, GRADE_MULT, SELL_VALUE, SLOW_CAP, ASPD_CAP, TOAD_CAP } from '../data/units';
import { GRADE_NAMES } from '../sim/types';
import { BASE_ODDS, PITY_ODDS } from '../data/summon';
import { UPGRADES, upgradeCost, summonCost, waveReward, SKILL_COOLDOWN } from '../data/economy';
import { RELICS, RELIC_BY_ID } from '../data/relics';
import { ENEMIES, ENEMY_INTRO_ORDER } from '../data/enemies';
import { currentOdds, mergePreview, autoPick, recipeStatus, designateCost, currentSummonCost, sellValue } from '../sim/roster';
import { unitSprite, enemySprite, GRADE_HEX } from '../render/sprites';
import { baseStats, unitLabel } from '../sim/state';
import type { Meta } from '../platform/storage';
import { SLOTS } from '../data/map';

export function spriteImg(u: { kind: UnitKind; grade: number; mythic: MythicId | null }, size = 40): HTMLCanvasElement {
  const src = unitSprite(u.kind, u.grade, u.mythic, 2);
  const cv = document.createElement('canvas'); cv.width = size * 2; cv.height = size * 2; cv.style.width = size + 'px'; cv.style.height = size + 'px';
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height); return cv;
}
export function enemyImg(type: keyof typeof ENEMIES, size = 36): HTMLCanvasElement {
  const src = enemySprite(type, 2); const cv = document.createElement('canvas'); cv.width = size * 2; cv.height = size * 2; cv.style.width = size + 'px'; cv.style.height = size + 'px';
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height); return cv;
}
export const gradeBadge = (g: number) => h('span', { class: `badge g${g}` }, GRADE_NAMES[g]);
const pct = (x: number) => (x * 100).toFixed(x * 100 % 1 ? 1 : 0) + '%';

// ---------- Summon odds ----------
export function summonPanel(s: GameState, act: (a: any) => void): HTMLElement {
  const od = currentOdds(s);
  const box = h('div');
  box.append(h('div', { class: 'card' },
    h('h4', {}, od.pityActive ? '⚡ 불운 보정 발동 중 — 다음 소환 영웅 이상 확정' : '현재 적용 확률'),
    h('table', {}, h('tbody', {}, ...([0, 1, 2, 3] as Grade[]).map(g => h('tr', {}, h('td', {}, gradeBadge(g)), h('td', {}, pct(od.odds[g])), h('td', {}, h('small', {}, `기본 ${pct(BASE_ODDS[g])}`)))))),
    h('div', { class: 'desc', style: 'margin-top:6px' }, `영웅 미만 연속 ${od.pity}/${od.threshold}회. ${od.threshold}회가 되면 다음 소환은 영웅 95% / 전설 5%.`),
    h('div', { class: 'desc' }, `등급 추첨 후 8종 중 종류 균등 추첨. 신화는 소환에서 나오지 않습니다. 비용: ${summonCost(0)} + 2×소환 횟수 (최대 100). 현재 ${currentSummonCost(s)}.`),
  ));
  const dc = designateCost(s);
  const des = h('div', { class: 'card' }, h('h4', {}, `🧩 운명 조각 ${s.shards}개 — 종류 지정 (${dc}개 소모)`),
    h('div', { class: 'desc' }, s.designatedKind ? `다음 소환 종류: ${UNITS[s.designatedKind].name} (등급 확률과 보정은 그대로)` : '일반 등급 소환 시 조각 1개. 5개로 다음 소환의 종류를 지정합니다. 등급 확률·불운 보정은 그대로 적용됩니다.'));
  const grid = h('div', { class: 'chips', style: 'margin-top:8px' });
  for (const k of UNIT_KINDS) {
    const chip = h('button', { class: 'chip', disabled: !!s.designatedKind || s.shards < dc, onclick: () => act({ type: 'designate', kind: k }) }, spriteImg({ kind: k, grade: 0, mythic: null }, 36), h('span', {}, UNITS[k].name));
    grid.append(chip);
  }
  des.append(grid); box.append(des);
  return box;
}

// ---------- Merge ----------
export function mergePanel(s: GameState, act: (a: any) => any, sel: Set<number>, rerender: () => void, tab: { g: Grade }, ask: (m: string, ok?: string) => Promise<boolean>): HTMLElement {
  const box = h('div');
  const tabs = h('div', { class: 'tabs' }, ...([0, 1, 2] as Grade[]).map(g => { const n = s.units.filter(u => !u.mythic && u.grade === g).length; return h('button', { class: tab.g === g ? 'on' : '', onclick: () => { tab.g = g; sel.clear(); rerender(); } }, `${GRADE_NAMES[g]} (${n})`); }));
  box.append(tabs);
  const units = s.units.filter(u => !u.mythic && u.grade === tab.g).sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id);
  const byKind: Record<string, Unit[]> = {}; for (const u of units) (byKind[u.kind] ||= []).push(u);
  const quick = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px;margin-bottom:6px' });
  for (const k of UNIT_KINDS) { const n = (byKind[k] || []).filter(u => !u.locked).length; if (n >= 3) quick.append(h('button', { style: 'flex:none;min-height:40px;font-size:12px', onclick: () => { const ids = autoPick(s, tab.g, k); if (ids) { sel.clear(); ids.forEach(i => sel.add(i)); rerender(); } } }, `${UNITS[k].name} ×3 확정 선택`)); }
  if (quick.children.length) box.append(quick);
  const chips = h('div', { class: 'chips' });
  for (const u of units) {
    const chip = h('button', { class: 'chip' + (sel.has(u.id) ? ' sel' : ''), onclick: () => { if (sel.has(u.id)) sel.delete(u.id); else if (sel.size < 3) sel.add(u.id); rerender(); } },
      spriteImg(u, 36), h('span', {}, UNITS[u.kind].name), u.locked ? h('span', { class: 'tag' }, '🔒') : u.fav ? h('span', { class: 'tag' }, '⭐') : null, h('span', { class: 'loc' }, u.loc.t === 'b' ? '대기' : SLOTS[u.loc.slot].name.slice(0, 4)));
    chips.append(chip);
  }
  if (!units.length) chips.append(h('div', { class: 'desc' }, '이 등급의 유닛이 없습니다.'));
  box.append(chips);
  const ids = [...sel];
  const pv = ids.length === 3 ? mergePreview(s, ids) : null;
  let previewText = `선택 ${ids.length}/3`;
  if (pv) previewText = pv.ok ? (pv.confirmed ? `결과: ${GRADE_NAMES[pv.grade!]} ${UNITS[pv.kind!].name} (확정)` : `결과: ${GRADE_NAMES[pv.grade!]} 무작위 종류 (8종 중 1)`) : pv.error!;
  const warn = pv && pv.ok && pv.warnLocked && pv.warnLocked.length ? h('div', { class: 'desc', style: 'color:#ffab40' }, `⚠ 잠금(신화 재료) 유닛 포함: ${pv.warnLocked.join(', ')}`) : null;
  box.append(h('div', { class: 'card' }, h('div', { style: 'font-weight:700' }, previewText), warn,
    h('div', { class: 'desc' }, '같은 등급 3개 → 한 단계 위 1개. 세 종류가 같으면 그 종류로 확정, 섞이면 무작위. 전설은 승급 불가(신화는 조합창). 결과는 전장에 있던 첫 재료 자리에 놓입니다.'),
    h('button', { class: 'primary', disabled: !(pv && pv.ok), onclick: async () => { if (pv && pv.ok && pv.warnLocked!.length && !(await ask(`잠긴 유닛(${pv.warnLocked!.join(', ')})을 소모합니다. 신화 재료일 수 있습니다. 계속할까요?`, '소모하고 합성'))) return; const r = act({ type: 'merge', ids }); if (r.ok) { sel.clear(); } rerender(); } }, '합성 실행')));
  return box;
}

// ---------- Mythic ----------
export function mythicPanel(s: GameState, act: (a: any) => any, rerender: () => void): HTMLElement {
  const box = h('div');
  const onField = s.units.filter(u => u.mythic && u.loc.t === 'f').length;
  box.append(h('div', { class: 'desc', style: 'margin:4px 0 6px' }, `공방 핵 🔮 ${s.cores}개 (보스 처치마다 +1). 전장 신화 ${onField}/2, 같은 신화 중복 불가. 만들면 재료 3개와 핵 1개를 소모합니다.`));
  for (const id of MYTHIC_IDS) {
    const m = MYTHICS[id]; const st = recipeStatus(s, id);
    const ing = h('div', { class: 'ing' }, ...st.have.map(hv => h('span', { class: hv.unitId != null ? 'ok' : 'no' }, `${hv.unitId != null ? '✓' : '✗'} ${GRADE_NAMES[hv.grade]} ${UNITS[hv.kind].name}`)), h('span', { class: s.cores >= 1 ? 'ok' : 'no' }, `${s.cores >= 1 ? '✓' : '✗'} 공방 핵`));
    const card = h('div', { class: 'card' + (st.canCraft ? ' pick' : '') },
      h('div', { class: 'row' }, spriteImg({ kind: m.recipe[0].kind, grade: 4, mythic: id }, 44), h('div', { style: 'flex:4' }, h('h4', {}, `${m.name} `, h('span', { class: 'badge g4' }, m.role)), h('div', { class: 'desc' }, m.desc))),
      h('div', { class: 'desc', style: 'margin-top:4px' }, `공격 ${m.atk} / 주기 ${m.cd}s / 사거리 ${m.range}`),
      ing,
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: !st.canCraft, onclick: () => { act({ type: 'craft', id }); rerender(); } }, st.canCraft ? '조합하기' : st.reason),
        h('button', { class: 'ghost', style: 'flex:0.7', disabled: st.have.every(hv => hv.unitId == null), onclick: () => { const r = act({ type: 'reserve', id }); rerender(); } }, '재료 잠금')),
    );
    box.append(card);
  }
  return box;
}

// ---------- Upgrades ----------
export function upgradePanel(s: GameState, act: (a: any) => any, rerender: () => void): HTMLElement {
  const box = h('div');
  for (const d of UPGRADES) {
    const lv = s.upgrades[d.id]; const cost = upgradeCost(d, lv); const max = lv >= d.max;
    box.append(h('div', { class: 'card' }, h('h4', {}, `${d.name} `, h('small', {}, `${lv}/${d.max}`)), h('div', { class: 'desc' }, d.desc), h('div', { class: 'desc' }, `비용: ${d.base} + ${d.step}×단계 → 현재 ${max ? '-' : cost}. 효과 합계: ${d.id === 'life' ? `+${lv * d.per} 생명` : `+${Math.round(lv * d.per * 100)}%`}`),
      h('button', { class: 'primary', disabled: max || s.gold < cost, onclick: () => { act({ type: 'upgrade', id: d.id }); rerender(); } }, max ? '최대' : `구매 (${cost} 골드)`)));
  }
  box.append(h('div', { class: 'card' }, h('h4', {}, '경제 표'), h('table', {}, h('tbody', {},
    h('tr', {}, h('td', {}, '소환 비용'), h('td', {}, '30 + 2×소환 수 (최대 100)')),
    h('tr', {}, h('td', {}, '웨이브 보상'), h('td', {}, `30 + 4×웨이브 (W${s.wave}: ${waveReward(s.wave)})`)),
    h('tr', {}, h('td', {}, '조기 시작'), h('td', {}, '남은 대기 초 × 2 골드')),
    h('tr', {}, h('td', {}, '처치 보상'), h('td', {}, '기본 2 / 장갑·재생·분열·보호막 4 / 시전자 5 / 정예 12 / 보스 90~400')),
    h('tr', {}, h('td', {}, '황금 두꺼비'), h('td', {}, `웨이브당 4/10/22/45, 합산 상한 ${TOAD_CAP}`)),
    h('tr', {}, h('td', {}, '판매'), h('td', {}, `${SELL_VALUE.join('/')} (일반/희귀/영웅/전설)`)),
    h('tr', {}, h('td', {}, '공격 속도 버프 상한'), h('td', {}, `+${ASPD_CAP * 100}% (정비사+시간술사 합산)`)),
    h('tr', {}, h('td', {}, '감속 상한'), h('td', {}, `${SLOW_CAP * 100}% (보스는 절반, 보호막 중 절반)`)),
  ))));
  return box;
}

// ---------- Unit info ----------
export function unitInfo(s: GameState, u: Unit): HTMLElement {
  const st = baseStats(s, u); const d = u.mythic ? null : UNITS[u.kind];
  const dps = u.mythic === 'chrono' || u.mythic === 'colossus' ? st.atk / st.cd : st.atk / st.cd;
  const g = u.grade;
  const rows: [string, string][] = [
    ['공격', `${st.atk.toFixed(0)} / ${st.cd}s (≈${dps.toFixed(0)} DPS)`], ['사거리', `${st.range}`],
  ];
  if (d) {
    const prio = { first: '가장 앞선 적', strong: '체력 높은 적', fast: '감속 안 된 빠른 적', cluster: '뭉친 적', armored: '방어력 높은 적' }[d.priority];
    rows.push(['우선 타깃', prio]);
    if (d.splash) rows.push(['폭발 반경', `${st.splash}`]);
    if (d.chain) rows.push(['연결 수', `${st.chain} (+전도)`]);
    if (d.slow) rows.push(['감속', `${pct(st.slow)} 1.6초`]);
    if (d.corroDps) rows.push(['부식', `${st.corroDps}/초·중첩, 방어 -10%`]);
    if (d.pull) rows.push(['끌기', `${st.pull} (재적용 2초)`]);
    if (d.aura) rows.push(['버프', `공속 +${pct(st.aura)} 범위 ${st.auraRange}`]);
    if (d.income) rows.push(['수입', `웨이브당 +${st.income}`]);
  } else rows.push(['특성', MYTHICS[u.mythic!].role]);
  const same = s.units.filter(x => !x.mythic && x.kind === u.kind && x.grade === u.grade && x.id !== u.id).length;
  if (!u.mythic && g < 3) rows.push(['합성', same >= 2 ? `같은 종류 ${same}개 → 확정 가능` : `같은 종류 ${same}개 (2개 더 필요)`]);
  return h('div', { class: 'stats' }, ...rows.map(([k, v]) => h('span', {}, h('small', {}, k + ' '), v)));
}

// ---------- Relic choice ----------
export function relicPanel(s: GameState, act: (a: any) => any): HTMLElement {
  const box = h('div');
  box.append(h('div', { class: 'desc', style: 'margin-bottom:6px' }, '보스 처치 보상: 유물 1개를 선택하세요. 선택 중에는 전투가 멈춥니다.'));
  for (const id of s.relicOffer || []) { const r = RELIC_BY_ID[id]; box.append(h('div', { class: 'card pick' }, h('h4', {}, `${r.icon} ${r.name}`), h('div', { class: 'desc' }, r.desc), h('button', { class: 'primary', onclick: () => act({ type: 'relic', id }) }, '선택'))); }
  return box;
}

// ---------- Result ----------
export function resultPanel(s: GameState, won: boolean, onRetry: () => void, onNew: () => void, onTitle: () => void, titles: string[]): HTMLElement {
  const st = s.stats;
  const dmgRows = Object.entries(st.dmgByUnit).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = Object.values(st.dmgByUnit).reduce((a, b) => a + b, 0) || 1;
  const nameOf = (k: string) => k.startsWith('mythic:') ? MYTHICS[k.slice(7) as MythicId].name : k === 'skill:bomb' ? '긴급 포격' : k === 'skill' ? '스킬' : `${GRADE_NAMES[+k.split('@')[1]]} ${UNITS[k.split('@')[0] as UnitKind].name}`;
  const lifeRows = Object.entries(st.lifeLostBy).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const hints: string[] = [];
  if (!won) {
    const top = lifeRows[0]?.[0];
    if (top === 'fox' || top === 'courier') hints.push('빠른 적에게 뚫렸습니다: 얼음 펭귄을 긴 직선(입구 등불·가판대 A) 근처에 두거나, 냉각 폭탄을 출구 쪽에 아껴두세요.');
    if (top === 'tortoise' || top === 'ogre' || top === 'boss_cart') hints.push('장갑 적에게 뚫렸습니다: 산성 버섯의 부식(방어력 -10%/중첩)을 먼저 걸고, 태엽 사수로 집중하세요. 장갑수레는 취약 자세(빨간 표시) 때 큰 공격을 맞히세요.');
    if (top === 'slime' || top === 'slimelet') hints.push('분열체가 새어 나갔습니다: 폭죽 너구리·번개 토끼 같은 범위 공격을 골목 중심(하단 굽은 구간)에 두세요.');
    if (top === 'troll') hints.push('재생형이 회복하며 통과했습니다: 지속 피해(부식)나 한 구간 집중 배치로 회복 틈을 주지 마세요.');
    if (top === 'ghost') hints.push('보호막 적에게 뚫렸습니다: 보호막은 폭발·연쇄로 빨리 벗기고, 벗긴 뒤 감속이 제대로 걸립니다.');
    if (top === 'boss_flag') hints.push('깃발왕: 호위(주황 테두리)를 먼저 처치하면 8초 약화. 범위 공격을 보스 경로 앞에 두세요.');
    if (top === 'boss_thief') hints.push('시간도둑: 봉인 예고(주황 점선)가 뜨면 그 자리 유닛을 옆 빈 자리로 옮기세요. 재배치는 무료입니다.');
    if (top === 'boss_king') hints.push('수집왕은 통과 시 즉시 패배입니다. 40웨이브 전에 전설·신화 2기와 부식+집중 공격을 준비하세요.');
    if (st.mythicsMade.length === 0 && s.wave >= 12) hints.push('신화를 만들지 못했습니다: 신화 버튼에서 레시피를 확인하고 "재료 잠금"으로 영웅 재료를 지키세요. 운명 조각 5개로 부족한 종류를 지정할 수 있습니다.');
    if (st.merges < st.summons / 5) hints.push('합성이 적었습니다: 같은 등급 3개는 합성 버튼이 초록으로 켜집니다. 자리가 부족하면 섞어서라도 승급하세요.');
    if (!hints.length) hints.push('다음 판에는 배치를 바꿔 보세요: 골목 중심(하단 굽은 구간)은 경로가 여러 번 지나 공격 기회가 가장 많습니다.');
  } else {
    hints.push('다른 조합으로 다시 도전해 보세요: 이번 판에 만들지 않은 신화, 다른 유물 선택, 추가 주문 수락 등.');
  }
  const box = h('div');
  box.append(h('h3', { style: 'margin:0 0 6px;text-align:center;font-size:22px' }, won ? '🏆 보물 창고 수호 성공!' : '💀 금고가 뚫렸습니다'));
  box.append(h('div', { class: 'result-grid' },
    h('div', {}, h('small', {}, '도달 웨이브 '), won ? '40 클리어' : `${s.wave}`), h('div', {}, h('small', {}, '플레이 시간 '), fmtTime(st.playTime)),
    h('div', {}, h('small', {}, '소환/합성 '), `${st.summons}/${st.merges}`), h('div', {}, h('small', {}, '전설 제작 '), `${st.legendMade}`),
    h('div', {}, h('small', {}, '신화 '), st.mythicsMade.map(m => MYTHICS[m as MythicId].name).join(', ') || '-'), h('div', {}, h('small', {}, '유물 '), st.relics.map(r => RELIC_BY_ID[r].name).join(', ') || '-'),
    h('div', {}, h('small', {}, '골드 획득/사용 '), `${Math.round(st.goldEarned)}/${Math.round(st.goldSpent)}`), h('div', {}, h('small', {}, '시드 '), `${s.seed}`),
  ));
  box.append(h('h4', { style: 'margin:10px 0 4px' }, '피해 기여 상위'));
  for (const [k, v] of dmgRows) box.append(h('div', { style: 'font-size:12px;margin:2px 0' }, `${nameOf(k)} — ${Math.round(v).toLocaleString()} (${(v / total * 100).toFixed(0)}%)`, h('div', { class: 'bar' }, h('div', { style: `width:${(v / total * 100).toFixed(0)}%` }))));
  if (lifeRows.length) { box.append(h('h4', { style: 'margin:10px 0 4px' }, '기지 피해를 준 적')); for (const [k, v] of lifeRows) box.append(h('div', { style: 'font-size:12px' }, `${ENEMIES[k as keyof typeof ENEMIES].name} — 생명 ${v}`)); }
  if (titles.length) box.append(h('div', { class: 'card', style: 'border-color:#ffb300' }, h('h4', {}, '🎖 새 칭호'), h('div', { class: 'desc' }, titles.join(', '))));
  box.append(h('div', { class: 'card' }, h('h4', {}, '다음 판 힌트 (이번 기록 기반)'), ...hints.map(t => h('div', { class: 'desc', style: 'margin:3px 0' }, '• ' + t))));
  box.append(h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'primary', onclick: onRetry }, '같은 시드 재도전'), h('button', { onclick: onNew }, '새 시드'), h('button', { class: 'ghost', onclick: onTitle }, '타이틀')));
  return box;
}

// ---------- Codex ----------
export function codexPanel(meta: Meta): HTMLElement {
  const box = h('div');
  const r = meta.records;
  box.append(h('div', { class: 'card' }, h('h4', {}, '기록 (이 기기 로컬 저장, 온라인 순위 아님)'), h('div', { class: 'result-grid' },
    h('div', {}, h('small', {}, '최고 웨이브 '), `${r.bestWave}`), h('div', {}, h('small', {}, '승리/판수 '), `${r.wins}/${r.runs}`),
    h('div', {}, h('small', {}, '최단 클리어 '), r.fastestWin ? fmtTime(r.fastestWin) : '-'), h('div', {}, h('small', {}, '칭호 '), `${meta.titles.length}`))));
  box.append(h('h4', { style: 'margin:8px 0 4px' }, '수비대 도감'));
  for (const k of UNIT_KINDS) {
    const row = h('div', { class: 'codex-grid', style: 'margin-bottom:4px' });
    for (let g = 0; g < 4; g++) { const seen = meta.codex.units.includes(`${k}@${g}`); row.append(h('div', { class: 'codex-cell' + (seen ? '' : ' unk') }, seen ? spriteImg({ kind: k, grade: g, mythic: null }, 36) : '?')); }
    row.append(h('div', { class: 'codex-cell', style: 'font-size:11px' }, UNITS[k].name));
    box.append(row);
  }
  box.append(h('h4', { style: 'margin:8px 0 4px' }, '신화'));
  const my = h('div', { class: 'codex-grid' }); for (const id of MYTHIC_IDS) { const seen = meta.codex.mythics.includes(id); my.append(h('div', { class: 'codex-cell' + (seen ? '' : ' unk') }, seen ? spriteImg({ kind: 'archer', grade: 4, mythic: id }, 36) : '?')); } box.append(my);
  box.append(h('h4', { style: 'margin:8px 0 4px' }, '적'));
  const en = h('div', { class: 'codex-grid' }); for (const t of [...ENEMY_INTRO_ORDER, 'courier', 'boss_flag', 'boss_cart', 'boss_thief', 'boss_king'] as (keyof typeof ENEMIES)[]) { const seen = meta.codex.enemies.includes(t); en.append(h('div', { class: 'codex-cell' + (seen ? '' : ' unk'), title: ENEMIES[t].name }, seen ? enemyImg(t, 36) : '?')); } box.append(en);
  box.append(h('h4', { style: 'margin:8px 0 4px' }, '유물'));
  for (const rl of RELICS) box.append(h('div', { style: 'font-size:12px;margin:2px 0;opacity:' + (meta.codex.relics.includes(rl.id) ? 1 : 0.4) }, `${rl.icon} ${rl.name}: ${meta.codex.relics.includes(rl.id) ? rl.desc : '???'}`));
  box.append(h('h4', { style: 'margin:8px 0 4px' }, '칭호'));
  box.append(h('div', { class: 'desc' }, meta.titles.length ? meta.titles.join(' · ') : '아직 없음 (첫 합성, 첫 신화, 10/20/30/40웨이브 도달, 무피해 보스 등)'));
  if (meta.history.length) { box.append(h('h4', { style: 'margin:8px 0 4px' }, '최근 빌드 기록')); for (const hs of meta.history.slice(-8).reverse()) box.append(h('div', { style: 'font-size:11px;margin:2px 0' }, `${new Date(hs.date).toLocaleDateString()} · ${hs.won ? '승리' : 'W' + hs.wave} · ${fmtTime(hs.time)} · 신화: ${hs.mythics.map(m => MYTHICS[m as MythicId]?.name).join(',') || '-'} · 핵심: ${hs.units.slice(0, 3).join(', ')}`)); }
  return box;
}

// ---------- Enemy guide ----------
export function enemyGuide(): HTMLElement {
  const box = h('div');
  for (const t of [...ENEMY_INTRO_ORDER, 'courier', 'boss_flag', 'boss_cart', 'boss_thief', 'boss_king'] as (keyof typeof ENEMIES)[]) { const d = ENEMIES[t]; box.append(h('div', { class: 'card', style: 'padding:6px 8px' }, h('div', { class: 'row' }, enemyImg(t, 36), h('div', { style: 'flex:5' }, h('b', {}, `${d.name} `, h('small', {}, d.trait)), h('div', { class: 'desc' }, d.hint), h('div', { class: 'desc' }, `체력 ${d.hp}${d.shield ? ` +보호막 ${d.shield}` : ''} · 속도 ${d.speed} · 방어 ${pct(d.armor)} · 통과 시 생명 -${d.exitDmg} · 보상 ${d.reward}`))))); }
  return box;
}
