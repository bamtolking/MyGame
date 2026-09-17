// 시트/패널 DOM 조각들 (조합, 강화, 팀, 도움말, 결과, 유닛 정보)
import type { GameState, Unit } from '../sim/types.ts';
import { ELEMENT_DEFS, MYTHICS, MYTHIC_IDS, GRADE_NAMES, GRADE_HEX, ELEMENTS, unitName, effectText, isMythic, type MythicId, type Grade, type Kind } from '../data/units.ts';
import { SUMMON_ODDS, SUMMON_LV_COST, MAX_SUMMON_LV, MAX_ATK_LV, ATK_PER_LV, atkUpgradeCost, SUMMON_COST, ROUND_TIME, TOTAL_ROUNDS, BOSS_TIME, MIN_SEND_GOLD, roundIncome } from '../data/economy.ts';
import { MONSTER_CAP } from '../data/board.ts';
import { recipeStatus, canMerge, sellValue } from '../sim/roster.ts';
import { statsOf } from '../sim/state.ts';
import { unitImg } from '../render/sprites.ts';
import type { PlayerInfo, ResultRow } from '../net/protocol.ts';
import { h, fmtNum } from './dom.ts';

export function spriteEl(kind: Kind, grade: Grade, px = 44): HTMLElement {
  const c = unitImg(kind, grade, px); const el = h('span', { class: 'spr' }); el.style.width = px + 'px'; el.style.height = px + 'px';
  const img = document.createElement('img'); img.src = c.toDataURL(); img.width = px; img.height = px; img.alt = ''; el.append(img); return el;
}
export function gradeBadge(g: Grade): HTMLElement { const b = h('span', { class: 'badge' }, GRADE_NAMES[g]); b.style.background = GRADE_HEX[g]; return b; }
export function elChip(el: keyof typeof ELEMENT_DEFS, have: boolean): HTMLElement { const c = h('span', { class: 'chip' + (have ? ' have' : ' miss') }, `${ELEMENT_DEFS[el].name} 현자`); c.style.borderColor = ELEMENT_DEFS[el].hex; if (have) c.style.background = ELEMENT_DEFS[el].hex + '33'; return c; }

export function unitInfo(s: GameState, u: Unit, on: { merge: () => void; mergeRandom: () => void; move: () => void; sell: () => void; close: () => void }, moveMode: boolean): HTMLElement {
  const st = statsOf(s, u); const cm = canMerge(s, u);
  const same = s.units.filter(o => o.kind === u.kind && o.grade === u.grade).length;
  const box = h('div', { class: 'unitinfo' },
    h('div', { class: 'row' }, spriteEl(u.kind, u.grade, 48),
      h('div', { class: 'col grow' }, h('div', { class: 'row' }, h('b', {}, unitName(u.kind, u.grade)), gradeBadge(u.grade)),
        h('div', { class: 'dim small' }, `공격 ${fmtNum(st.dmg)} · ${st.period}초 · 사거리 ${st.range} · DPS ${fmtNum(st.dps)}`),
        h('div', { class: 'small' }, effectText(u.kind, u.grade)),
        h('div', { class: 'dim small' }, `처치 ${u.kills} · 누적 피해 ${fmtNum(u.dmg)}`)),
      h('button', { class: 'icon', onclick: on.close, 'aria-label': '닫기' }, '✕')),
    h('div', { class: 'row btns' },
      !isMythic(u.kind) && u.grade < 3 ? h('button', { class: 'btn' + (cm.confirmed ? ' primary' : ''), onclick: on.merge, ...(cm.confirmed ? {} : { disabled: true }) }, `합성 ${Math.min(3, same)}/3 → ${GRADE_NAMES[u.grade + 1]}`) : null,
      !isMythic(u.kind) && u.grade < 3 ? h('button', { class: 'btn', onclick: on.mergeRandom, ...(cm.random ? {} : { disabled: true }), title: '같은 등급 아무거나 3개 → 다음 등급 무작위 속성' }, '무작위 합성') : null,
      u.grade === 3 ? h('span', { class: 'dim small' }, '전설은 조합(신화)으로 승급') : null,
      h('button', { class: 'btn' + (moveMode ? ' active' : ''), onclick: on.move }, moveMode ? '이동할 자리 탭' : '이동'),
      h('button', { class: 'btn danger', onclick: on.sell }, `판매 +${sellValue(u)}`)));
  return box;
}

export function craftPanel(s: GameState, onCraft: (id: MythicId) => void): HTMLElement {
  const box = h('div', {}, h('p', { class: 'dim small' }, '전설(현자) 3종을 모으면 신화 유닛으로 조합합니다. 전설은 같은 속성 영웅 3개 합성으로 만듭니다.'));
  for (const id of MYTHIC_IDS) {
    const m = MYTHICS[id]; const st = recipeStatus(s, id);
    box.append(h('div', { class: 'card row' }, spriteEl(id, 4, 52),
      h('div', { class: 'col grow' }, h('div', { class: 'row' }, h('b', {}, m.name), gradeBadge(4)), h('div', { class: 'small' }, m.desc),
        h('div', { class: 'small dim' }, `공격 ${m.dmg} · ${m.period}초 · 사거리 ${m.range}`),
        h('div', { class: 'row wrap' }, ...st.have.map(x => elChip(x.el, x.unitId != null)))),
      h('button', { class: 'btn' + (st.canCraft ? ' primary' : ''), ...(st.canCraft ? {} : { disabled: true }), onclick: () => onCraft(id) }, st.canCraft ? '조합' : st.reason)));
  }
  return box;
}

export function upgradePanel(s: GameState, on: { summon: () => void; atk: () => void }): HTMLElement {
  const lv = s.summonLv; const odds = SUMMON_ODDS[lv - 1]; const next = lv < MAX_SUMMON_LV ? SUMMON_ODDS[lv] : null;
  const cost = lv < MAX_SUMMON_LV ? SUMMON_LV_COST[lv - 1] : 0;
  const oddsRow = (o: number[]) => h('div', { class: 'row wrap odds' }, ...o.map((p, g) => { const c = h('span', { class: 'chip' }, `${GRADE_NAMES[g]} ${(p * 100).toFixed(p * 100 < 10 ? 1 : 0)}%`); c.style.borderColor = GRADE_HEX[g]; return c; }));
  const atkCost = s.atkLv < MAX_ATK_LV ? atkUpgradeCost(s.atkLv) : 0;
  return h('div', {},
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, `소환 레벨 ${lv} / ${MAX_SUMMON_LV}`), h('span', { class: 'grow' }), next ? h('button', { class: 'btn primary', ...(s.gold >= cost ? {} : { disabled: true }), onclick: on.summon }, `업그레이드 ${cost}G`) : h('span', { class: 'badge' }, '최대')),
      h('div', { class: 'small dim' }, '현재 확률'), oddsRow(odds), next ? h('div', { class: 'small dim' }, '다음 레벨') : null, next ? oddsRow(next) : null),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, `공격력 강화 ${s.atkLv} / ${MAX_ATK_LV}`), h('span', { class: 'grow' }), s.atkLv < MAX_ATK_LV ? h('button', { class: 'btn primary', ...(s.gold >= atkCost ? {} : { disabled: true }), onclick: on.atk }, `강화 ${atkCost}G`) : h('span', { class: 'badge' }, '최대')),
      h('div', { class: 'small dim' }, `모든 유닛 공격력 +${Math.round(ATK_PER_LV * 100)}% / 단계 (현재 +${Math.round(s.atkLv * ATK_PER_LV * 100)}%)`)),
    h('div', { class: 'card small dim' }, `소환 ${SUMMON_COST}G 고정 · 라운드 보상 ${roundIncome(1)}~${roundIncome(TOTAL_ROUNDS)}G · 처치 골드는 라운드가 오를수록 증가`));
}

export function teamPanel(s: GameState, you: string, players: PlayerInfo[], on: { send: (pid: string, amount: number) => void; emote: (text: string) => void }): HTMLElement {
  const box = h('div', {});
  const emotes = ['도와줘! 🆘', '골드 좀… 🙏', '나이스! 👍', '보스 온다 ⚠️', 'ㅋㅋㅋ 😂', '버텨! 💪'];
  box.append(h('div', { class: 'row wrap' }, ...emotes.map(e => h('button', { class: 'btn small', onclick: () => on.emote(e) }, e))));
  for (const p of players) {
    const sm = p.summary; const me = p.pid === you;
    const status = sm ? (sm.phase === 'eliminated' ? `탈락 (R${p.eliminatedRound || sm.round})` : `R${sm.round} · 몬스터 ${sm.monsters}/${MONSTER_CAP} · 💰${sm.gold} · 처치 ${sm.kills}`) : (p.connected ? '준비 중' : '연결 끊김');
    box.append(h('div', { class: 'card col' },
      h('div', {}, h('b', {}, (p.host ? '👑 ' : '') + p.name + (me ? ' (나)' : '') + (p.connected ? '' : ' 📴')), h('div', { class: 'small dim' }, status)),
      !me && sm && sm.phase !== 'eliminated' ? h('div', { class: 'row wrap', style: 'margin-top:4px' }, h('span', { class: 'small dim' }, '골드 보내기'), ...[50, 100, 200].map(a => h('button', { class: 'btn small', ...(s.gold >= a ? {} : { disabled: true }), onclick: () => on.send(p.pid, a) }, `${a}G`))) : null));
  }
  box.append(h('p', { class: 'small dim' }, `골드는 최소 ${MIN_SEND_GOLD}G부터 보낼 수 있고 수수료는 없습니다.`));
  return box;
}

export function helpPanel(): HTMLElement {
  return h('div', { class: 'help' },
    h('h3', {}, '규칙'),
    h('ul', {},
      h('li', {}, `몬스터는 판 바깥 길을 계속 돕니다. 살아 있는 몬스터가 ${MONSTER_CAP}마리가 되면 탈락.`),
      h('li', {}, `${ROUND_TIME}초마다 다음 라운드가 시작되고 몬스터가 추가로 나옵니다 (총 ${TOTAL_ROUNDS}라운드).`),
      h('li', {}, `10·20·30·40 라운드 보스는 ${BOSS_TIME}초 안에 처치해야 합니다. 마지막 보스를 잡으면 승리.`),
      h('li', {}, `소환 ${SUMMON_COST}G: 5속성 × 등급(일반·희귀·영웅·전설) 무작위. 자리는 24칸.`)),
    h('h3', {}, '합성·조합'),
    h('ul', {},
      h('li', {}, '같은 속성·같은 등급 3개 → 다음 등급 같은 속성 (확정). "자동 합성" 버튼으로 한 번에.'),
      h('li', {}, '같은 등급 아무거나 3개 → 다음 등급 무작위 속성 (자리를 비울 때).'),
      h('li', {}, '전설(현자) 3종 조합 → 신화 4종. 조합 시트에서 재료 확인.')),
    h('h3', {}, '속성'),
    h('ul', {}, ...ELEMENTS.map(e => h('li', {}, h('b', {}, ELEMENT_DEFS[e].name), ` — ${ELEMENT_DEFS[e].desc}`))),
    h('h3', {}, '조작'),
    h('ul', {},
      h('li', {}, '유닛 탭 → 정보/합성/판매. "이동" 후 자리 탭, 또는 드래그. 유닛이 있는 자리로 옮기면 교환.'),
      h('li', {}, '길에 가까운 자리(모서리)가 사거리 효율이 좋습니다. 사거리가 긴 유닛은 안쪽에.')),
    h('h3', {}, '같이 하기'),
    h('ul', {},
      h('li', {}, '방 만들기 → 코드를 친구에게 → 친구는 "코드로 참가". 최대 4명, 각자 자기 판을 지키고 라운드 시계는 공유.'),
      h('li', {}, '팀 시트에서 골드를 보내고 이모티콘을 보낼 수 있습니다. 상단 이름을 탭하면 친구 판을 관전.'),
      h('li', {}, '기본은 P2P(서버 없음) 연결입니다. 방장은 게임 화면을 켜 둬야 하며, 연결이 안 되면 같은 Wi-Fi나 다른 네트워크에서 다시 시도하세요.')));
}

export function resultTable(rows: ResultRow[], you: string): HTMLElement {
  const t = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, '#'), h('th', {}, '이름'), h('th', {}, '라운드'), h('th', {}, '처치'), h('th', {}, '피해'), h('th', {}, '신화')));
  rows.forEach((r, i) => t.append(h('tr', { class: r.pid === you ? 'me' : '' }, h('td', {}, String(i + 1)), h('td', {}, r.name + (r.alive ? ' 🏆' : '')), h('td', {}, r.alive ? `${r.round} 생존` : `${r.round} 탈락`), h('td', {}, String(r.kills)), h('td', {}, fmtNum(r.damage)), h('td', {}, String(r.mythics)))));
  return t;
}
