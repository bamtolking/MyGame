// Panel and modal builders (inventory, character, skills, shops, stash, waypoint, menu, death, victory).
import { CLASSES, MAX_SKILL_RANK, SKILLS, xpToNext } from '../data/classes';
import { BASE_BY_ID } from '../data/items';
import { ELDER_LINES, NPC_INFO, TIPS } from '../data/npcs';
import { DIFFICULTIES, LAST_FLOOR, MAX_POTIONS, PRICES, ZONES, floorName, zoneOfFloor } from '../data/zones';
import { baseOf, buyPrice, canEquipClass } from '../sim/items';
import { sheetDps, skillRank } from '../sim/stats';
import type { EquipSlot, Item } from '../sim/types';
import { itemIconUrl, skillIconUrl } from '../render/icons';
import { fmt, fmtTime, h } from './dom';
import type { App, SelWhere } from './app';

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: '무기', offhand: '보조', head: '투구', chest: '갑옷', gloves: '장갑', boots: '신발', belt: '허리띠', amulet: '목걸이', ring1: '반지', ring2: '반지' };

function cell(app: App, it: Item | null, where: SelWhere, idx: number | EquipSlot, label?: string): HTMLElement {
  const g = app.g!;
  const sel = app.sel && app.sel.where === where && app.sel.idx === idx;
  const unusable = it && (!canEquipClass(it, g.hero.cls) || it.req > g.hero.level);
  const el = h('div', { class: `cell${it ? ' r-' + it.rarity : ' empty'}${sel ? ' sel' : ''}${unusable ? ' unusable' : ''}`, title: '' },
    it ? h('img', { src: itemIconUrl(it), draggable: 'false', alt: it.name }) : label ? h('span', { class: 'slotlabel' }, label) : null);
  if (it) {
    el.addEventListener('click', (e) => { e.stopPropagation(); app.select(where, idx); });
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); app.quick(where, idx); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); app.quick(where, idx); });
    el.addEventListener('mouseenter', () => { if (!app.touchMode) app.showTip(it, el, where); });
    el.addEventListener('mouseleave', () => app.hideTip());
  }
  return el;
}

function header(app: App, title: string, sub?: string): HTMLElement {
  return h('div', { class: 'phead' }, h('div', { class: 'ptitle' }, title, sub ? h('small', {}, sub) : null), h('button', { class: 'x', onclick: () => app.closePanels(), 'aria-label': '닫기' }, '✕'));
}

export function invPanel(app: App): HTMLElement {
  const g = app.g!, hero = g.hero;
  const doll = h('div', { class: 'doll' });
  const order: (EquipSlot | null)[] = ['weapon', 'head', 'offhand', 'gloves', 'chest', 'amulet', 'ring1', 'belt', 'ring2', null, 'boots', null];
  for (const s of order) {
    if (!s) { doll.appendChild(h('div', { class: 'cell spacer' })); continue; }
    doll.appendChild(cell(app, hero.equip[s], 'equip', s, SLOT_LABEL[s]));
  }
  const grid = h('div', { class: 'grid inv' });
  hero.inv.forEach((it, i) => grid.appendChild(cell(app, it, 'inv', i)));
  return h('div', { class: 'panel' },
    header(app, '가방', '더블클릭·우클릭: 장착/판매'),
    h('div', { class: 'dollwrap' }, doll),
    grid,
    h('div', { class: 'pfoot' },
      h('span', { class: 'gold' }, `💰 ${fmt(hero.gold)}`),
      h('span', { class: 'dim' }, `물약 ${hero.potHp}/${hero.potMp} · 두루마리 ${hero.scrolls}`),
      h('button', { class: 'small', onclick: () => { g.sortInv(); app.refresh(true); } }, '정렬')),
    app.selBox());
}

export function charPanel(app: App): HTMLElement {
  const g = app.g!, hero = g.hero, st = hero.st, c = CLASSES[hero.cls];
  const need = xpToNext(hero.level);
  const attr = (k: 'str' | 'dex' | 'vit' | 'ene', name: string, hint: string) => h('div', { class: 'attr' },
    h('span', { class: 'an' }, name, h('small', {}, hint)),
    h('b', {}, String(st[k]), st[k] !== hero.attrs[k] ? h('small', { class: 'blue' }, ` (${hero.attrs[k]})`) : null),
    hero.freePts > 0 ? h('button', { class: 'plus', onclick: (e: Event) => { g.allocAttr(k, (e as MouseEvent).shiftKey ? 5 : 1); app.refresh(true); }, title: 'Shift+클릭: 5점' }, '+') : h('span', { class: 'plusph' }));
  const res = (label: string, v: number, col: string) => h('div', { class: 'res' }, h('span', { style: `color:${col}` }, label), h('b', { style: v < 0 ? 'color:#ff6060' : v >= 75 ? 'color:#ffd060' : '' }, `${Math.round(v)}%`));
  const row = (label: string, v: string) => h('div', { class: 'srow' }, h('span', {}, label), h('b', {}, v));
  const mainName = { str: '힘', dex: '민첩', vit: '활력', ene: '에너지' }[c.main];
  return h('div', { class: 'panel' },
    header(app, hero.name, `${c.name} · 레벨 ${hero.level} · ${DIFFICULTIES[g.diff].name}`),
    h('div', { class: 'xpline' }, h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.min(100, (hero.xp / need) * 100)}%` })), h('small', {}, `경험치 ${fmt(hero.xp)} / ${fmt(need)}`)),
    h('div', { class: 'attrs' },
      attr('str', '힘', c.main === 'str' ? '피해 +1%/점' : '방어력'),
      attr('dex', '민첩', c.main === 'dex' ? '피해 +1%/점 · 치명타' : '방어력·막기'),
      attr('vit', '활력', `생명력 +${c.hpVit}/점`),
      attr('ene', '에너지', c.main === 'ene' ? `피해 +1%/점 · 마나 +${c.mpEne}` : `마나 +${c.mpEne}/점`),
      h('div', { class: 'pts' + (hero.freePts ? ' glow' : '') }, `남은 능력치: ${hero.freePts}`,
        hero.freePts > 0 ? h('button', { class: 'small', onclick: () => { const aa = c.autoAttr; const order: ('str' | 'dex' | 'vit' | 'ene')[] = []; for (const k of ['str', 'dex', 'vit', 'ene'] as const) for (let i = 0; i < aa[k]; i++) order.push(k); let i = 0; while (hero.freePts > 0) g.allocAttr(order[i++ % order.length]); app.refresh(true); } }, '자동 분배') : null)),
    h('div', { class: 'stats' },
      row('피해', `${Math.round(st.wMin * st.dmgMult)}–${Math.round(st.wMax * st.dmgMult)}`),
      row('초당 피해(DPS)', fmt(sheetDps(st))),
      row('공격 속도', `${st.aps.toFixed(2)}/초`),
      row('치명타', `${st.crit.toFixed(1)}% · ×${st.critMult.toFixed(2)}`),
      row(`${mainName} 보너스`, `+${Math.round(st[c.main])}%`),
      row('생명력', `${Math.round(hero.hp)} / ${st.maxHp}`),
      row('마나', `${Math.round(hero.mp)} / ${st.maxMp}`),
      row('재생 (생명/마나)', `${st.hpRegen.toFixed(1)} / ${st.mpRegen.toFixed(1)}`),
      row('방어력', `${fmt(st.armor)}`),
      st.block > 0 ? row('막기', `${st.block.toFixed(0)}%`) : null,
      st.lifeSteal > 0 ? row('생명력 흡수', `${st.lifeSteal}%`) : null,
      st.skills > 0 ? row('모든 기술', `+${st.skills}`) : null,
      row('이동 속도', `${Math.round((st.moveSpeed / 4.3 - 1) * 100)}%`),
      row('마법 아이템 발견', `${st.mf}%`),
      row('금화 획득', `${st.gf}%`)),
    h('div', { class: 'resgrid' }, res('화염', st.res.fire, '#ff8a3a'), res('냉기', st.res.cold, '#8ad0ff'), res('번개', st.res.light, '#fff27a'), res('독', st.res.poison, '#8aff6a')),
    h('div', { class: 'dim small' }, `처치 ${fmt(hero.kills)} · 사망 ${hero.deaths} · 플레이 ${fmtTime(hero.playTime)}`));
}

export function skillsPanel(app: App): HTMLElement {
  const g = app.g!, hero = g.hero, c = CLASSES[hero.cls];
  const cards = c.skills.map((id, slot) => {
    const d = SKILLS[id];
    const base = hero.skills[id] ?? 0;
    const eff = skillRank(hero, id);
    const canLearn = hero.skillPts > 0 && hero.level >= d.req && base < MAX_SKILL_RANK;
    const locked = hero.level < d.req;
    const cur = eff > 0 ? d.detail(eff) : [];
    const nxt = base < MAX_SKILL_RANK ? d.detail(Math.max(1, eff + (eff > 0 ? 1 : 1 + hero.st.skills))) : [];
    return h('div', { class: 'skill' + (locked ? ' locked' : '') + (hero.rmbSkill === slot ? ' rmb' : '') },
      h('div', { class: 'sicon' }, h('img', { src: skillIconUrl(d.icon), alt: '' }), h('span', { class: 'key' }, String(slot + 1))),
      h('div', { class: 'sbody' },
        h('div', { class: 'sname' }, d.name, h('span', { class: 'rank' }, locked ? `레벨 ${d.req} 필요` : `${base}/${MAX_SKILL_RANK}${eff > base ? ` (+${eff - base})` : ''}`)),
        h('div', { class: 'sdesc' }, d.desc),
        cur.length ? h('div', { class: 'sdet' }, `현재: ${cur.join(' · ')} · 마나 ${d.mana(eff)}`) : null,
        nxt.length && !locked ? h('div', { class: 'sdet next' }, `다음: ${nxt.join(' · ')}`) : null),
      h('div', { class: 'sbtns' },
        h('button', { class: 'plus', disabled: !canLearn, onclick: () => { g.learnSkill(slot); app.refresh(true); } }, '+'),
        !app.touchMode && eff > 0 ? h('button', { class: 'small', title: '마우스 오른쪽 버튼에 지정', onclick: () => { hero.rmbSkill = slot; app.refresh(true); } }, hero.rmbSkill === slot ? '우클릭 ✓' : '우클릭') : null));
  });
  return h('div', { class: 'panel' },
    header(app, '기술', `${c.name} · ${c.title}`),
    h('div', { class: 'pts' + (hero.skillPts ? ' glow' : '') }, `남은 기술 포인트: ${hero.skillPts}`),
    h('div', { class: 'basic dim small' }, `기본 공격: ${SKILLS[c.basic].name} (마나 없음) · 아이템의 "모든 기술 +"는 배운 기술에만 적용됩니다.`),
    ...cards);
}

function npcHeader(app: App, kind: keyof typeof NPC_INFO, lineIdx: number): HTMLElement {
  const n = NPC_INFO[kind];
  return h('div', {}, header(app, n.name, n.role), h('div', { class: 'npcline' }, n.greet.length ? `“${n.greet[lineIdx % n.greet.length]}”` : ''));
}

export function shopPanel(app: App): HTMLElement {
  const g = app.g!;
  const grid = h('div', { class: 'grid shop' });
  g.shop.forEach((it, i) => {
    const el = cell(app, it, 'shop', i);
    el.appendChild(h('span', { class: 'price' + (g.hero.gold < buyPrice(it) ? ' no' : '') }, fmt(buyPrice(it))));
    grid.appendChild(el);
  });
  return h('div', { class: 'panel' }, npcHeader(app, 'smith', app.npcLine), grid,
    h('div', { class: 'dim small' }, '물건을 선택해 구매하세요. 가방의 물건을 더블클릭(또는 선택 후 판매)하면 팝니다. 상점 물건은 던전에 다녀올 때마다 바뀝니다.'),
    app.sel?.where === 'shop' ? app.selBox() : null);
}

export function healerPanel(app: App): HTMLElement {
  const g = app.g!, hero = g.hero;
  const buy = (kind: 'hp' | 'mp' | 'scroll', n: number, label: string, price: number) => h('button', { class: 'buy', onclick: () => { g.buyPotion(kind, n); app.refresh(true); } }, label, h('small', {}, `${price * n} 금화`));
  return h('div', { class: 'panel' }, npcHeader(app, 'healer', app.npcLine),
    h('div', { class: 'npcnote' }, '✚ 생명력과 마나가 모두 회복되었습니다.'),
    h('div', { class: 'shoprow' }, h('span', { class: 'potico hp' }), h('div', { class: 'grow' }, '생명 물약', h('small', {}, `생명력 30% 즉시 + 25% 서서히 회복 · 보유 ${hero.potHp}/${MAX_POTIONS}`)), buy('hp', 1, '×1', PRICES.potHp), buy('hp', 5, '×5', PRICES.potHp)),
    h('div', { class: 'shoprow' }, h('span', { class: 'potico mp' }), h('div', { class: 'grow' }, '마나 물약', h('small', {}, `마나 60% 회복 · 보유 ${hero.potMp}/${MAX_POTIONS}`)), buy('mp', 1, '×1', PRICES.potMp), buy('mp', 5, '×5', PRICES.potMp)),
    h('div', { class: 'shoprow' }, h('span', { class: 'potico scroll' }), h('div', { class: 'grow' }, '귀환 두루마리', h('small', {}, `마을로 통하는 차원문 · 보유 ${hero.scrolls}`)), buy('scroll', 1, '×1', PRICES.scroll)),
    h('div', { class: 'pfoot' }, h('span', { class: 'gold' }, `💰 ${fmt(hero.gold)}`)));
}

export function elderPanel(app: App): HTMLElement {
  const g = app.g!;
  const deepest = Math.max(...g.maxFloor);
  const won = (g.bosses.malegath ?? 0) > 0;
  const line = won ? ELDER_LINES[ELDER_LINES.length - 1] : ELDER_LINES.find((l) => deepest <= l.upTo) ?? ELDER_LINES[ELDER_LINES.length - 2];
  const bosses = [['ordes', '망자의 주교 오르데스', 3], ['gromak', '갈고리 도살꾼 그로막', 6], ['ignira', '용암 여왕 이그니라', 9], ['malegath', '심연의 군주 말레가스', 12]] as const;
  return h('div', { class: 'panel' }, header(app, '장로 오윈', '이야기'),
    h('div', { class: 'lore' }, line.text),
    h('div', { class: 'quests' }, ...bosses.map(([id, name, f]) => h('div', { class: 'quest' + ((g.bosses[id] ?? 0) > 0 ? ' done' : '') }, (g.bosses[id] ?? 0) > 0 ? '✔ ' : '◇ ', name, h('small', {}, ` — ${floorName(f)}`)))),
    h('div', { class: 'tip' }, '💡 ', TIPS[app.npcLine % TIPS.length]));
}

export function gamblerPanel(app: App): HTMLElement {
  const g = app.g!;
  const price = g.gamblePrice();
  const cats: [string, 'weapon' | 'offhand' | 'head' | 'chest' | 'gloves' | 'boots' | 'belt' | 'ring' | 'amulet', string][] = [
    ['무기', 'weapon', CLASSES[g.hero.cls].startGear[0]], ['보조', 'offhand', CLASSES[g.hero.cls].offhandHint], ['투구', 'head', 'helm'], ['갑옷', 'chest', 'chainMail'], ['장갑', 'gloves', 'chainGloves'], ['신발', 'boots', 'steelBoots'], ['허리띠', 'belt', 'leatherBelt'], ['반지', 'ring', 'ring'], ['목걸이', 'amulet', 'amulet']];
  const shown = cats.filter((c) => c[2]);
  return h('div', { class: 'panel' }, npcHeader(app, 'gambler', app.npcLine),
    h('div', { class: 'dim small' }, `무엇이 나올지 모르는 물건을 삽니다. 마법 이상 확정, 희귀·고유 등급이 나올 수도! (개당 ${fmt(price)} 금화)`),
    h('div', { class: 'gamble' }, ...shown.map(([label, slot, base]) => h('button', { class: 'gbtn', disabled: g.hero.gold < price, onclick: () => { const it = g.gamble(slot); if (it) { app.lastGamble = it; app.refresh(true); } } },
      h('img', { src: itemIconUrl({ uid: 0, base, rarity: 'normal', ilvl: 1, req: 1, name: '', mods: [] }), alt: '' }), label))),
    app.lastGamble ? h('div', { class: 'gres' }, h('div', { class: 'tt', html: app.tipHtml(app.lastGamble, 'none') })) : null,
    h('div', { class: 'pfoot' }, h('span', { class: 'gold' }, `💰 ${fmt(g.hero.gold)}`)));
}

export function stashPanel(app: App): HTMLElement {
  const g = app.g!;
  const grid = h('div', { class: 'grid stash' });
  g.stash.forEach((it, i) => grid.appendChild(cell(app, it, 'stash', i)));
  return h('div', { class: 'panel' }, header(app, '보관함', '모든 캐릭터가 함께 쓰는 공용 보관함'), grid,
    h('div', { class: 'dim small' }, '가방의 물건을 더블클릭하면 보관, 보관함의 물건을 더블클릭하면 꺼냅니다.'),
    app.sel?.where === 'stash' ? app.selBox() : null);
}

// ------------------------------------------------------------------ modals
export function waypointModal(app: App): HTMLElement {
  const g = app.g!;
  let diff = app.wpDiff;
  const tabs = h('div', { class: 'tabs' }, ...DIFFICULTIES.map((d, i) => h('button', { class: 'tab' + (i === diff ? ' on' : ''), disabled: i > g.unlockedDiff, style: `color:${d.color}`, onclick: () => { app.wpDiff = i; app.openModal('waypoint'); } }, d.name + (i > g.unlockedDiff ? ' 🔒' : ''))));
  const max = Math.max(1, g.maxFloor[diff]);
  const list = h('div', { class: 'wplist' });
  list.appendChild(h('button', { class: 'wp', onclick: () => { g.travel(0); app.closeModal(); } }, '🏠 ', ZONES[0].name));
  for (let z = 1; z <= 4; z++) {
    const floors: number[] = [];
    for (let f = (z - 1) * 3 + 1; f <= z * 3; f++) if (f <= max) floors.push(f);
    if (!floors.length) continue;
    list.appendChild(h('div', { class: 'wpzone' }, ZONES[z].name));
    for (const f of floors) list.appendChild(h('button', { class: 'wp', onclick: () => { g.travel(f, diff); app.closeModal(); } }, `${((f - 1) % 3) + 1}층`, f % 3 === 0 ? h('small', {}, ' · 보스') : null));
  }
  return h('div', { class: 'modalbox' },
    h('div', { class: 'phead' }, h('div', { class: 'ptitle' }, '순례자의 표석', h('small', {}, '가 본 층으로 즉시 이동합니다')), h('button', { class: 'x', onclick: () => app.closeModal() }, '✕')),
    g.unlockedDiff > 0 ? tabs : null, list,
    h('div', { class: 'dim small' }, `가장 깊이 내려간 곳: ${g.maxFloor[diff] > 0 ? floorName(g.maxFloor[diff]) : '없음'} · 층을 새로 들어갈 때마다 지형과 몬스터가 새로 만들어집니다.`));
}

export function menuModal(app: App): HTMLElement {
  const s = app.settings;
  const slider = (label: string, v: number, on: (x: number) => void) => h('label', { class: 'opt' }, label, h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(v * 100)), oninput: (e: Event) => on(Number((e.target as HTMLInputElement).value) / 100) }));
  const toggle = (label: string, v: boolean, on: (x: boolean) => void) => h('label', { class: 'opt' }, label, h('input', { type: 'checkbox', checked: v, onchange: (e: Event) => on((e.target as HTMLInputElement).checked) }));
  return h('div', { class: 'modalbox menu' },
    h('div', { class: 'phead' }, h('div', { class: 'ptitle' }, '메뉴'), h('button', { class: 'x', onclick: () => app.closeModal() }, '✕')),
    h('button', { class: 'big', onclick: () => app.closeModal() }, '계속하기'),
    h('div', { class: 'opts' },
      slider('배경음', s.bgm, (x) => { s.bgm = x; app.applySettings(); }),
      slider('효과음', s.sfx, (x) => { s.sfx = x; app.applySettings(); }),
      toggle('이펙트 줄이기 (저사양)', s.lowFx, (x) => { s.lowFx = x; app.applySettings(); }),
      toggle('피해 숫자 표시', s.dmgNumbers, (x) => { s.dmgNumbers = x; app.applySettings(); }),
      toggle('화면 흔들림', s.shake, (x) => { s.shake = x; app.applySettings(); }),
      toggle('모든 아이템 이름 표시', s.showLabels, (x) => { s.showLabels = x; app.applySettings(); })),
    h('details', { class: 'help' }, h('summary', {}, '조작법'),
      h('div', { class: 'small', html: `<b>PC</b><br>왼쪽 클릭: 이동 / 공격 / 줍기 / 대화 (누르고 있으면 계속)<br>Shift+클릭: 제자리 공격 · 오른쪽 클릭: 지정 기술<br>1~5: 기술 · Q: 생명 물약 · E: 마나 물약 · T: 귀환 두루마리<br>WASD/방향키: 이동 · Space: 커서 방향 공격<br>I: 가방 · C: 캐릭터 · K: 기술 · Tab/M: 지도 · Alt: 아이템 이름 · Esc: 메뉴<br><br><b>모바일</b><br>왼쪽 아래 드래그: 이동 · 큰 버튼: 공격(자동 조준)<br>작은 버튼: 기술(가까운 적 자동 조준, 이동 방향 우선)<br>화면의 적/아이템/사람을 탭해도 됩니다.` })),
    h('button', { onclick: () => { app.saveNow(); app.toTitle(); } }, '저장하고 타이틀로'),
    h('div', { class: 'dim small' }, app.lastSaveOk ? `저장됨 · ${new Date(app.lastSaveAt).toLocaleTimeString('ko-KR')}` : '⚠ 브라우저 저장소를 쓸 수 없어 이 창을 닫으면 진행이 사라집니다.'));
}

export function deathModal(app: App): HTMLElement {
  return h('div', { class: 'modalbox death' },
    h('h2', {}, '당신은 죽었습니다'),
    h('p', { class: 'dim' }, '마을에서 다시 일어납니다. 가진 금화의 10%를 잃습니다.'),
    h('button', { class: 'big red', onclick: () => { app.g!.respawn(); app.closeModal(); } }, '마을에서 부활'));
}

export function victoryModal(app: App): HTMLElement {
  const g = app.g!;
  const next = g.unlockedDiff > g.diff ? DIFFICULTIES[g.diff + 1] : null;
  return h('div', { class: 'modalbox victory' },
    h('h2', {}, '심연의 군주가 쓰러졌다'),
    h('p', {}, '말레가스의 비명이 심연 끝까지 울려 퍼지고, 잿빛마을 위로 오랜만에 새벽빛이 스며든다.'),
    next ? h('p', { style: `color:${next.color}` }, `새 난이도 해금: ${next.name} — 순례자의 표석에서 선택할 수 있습니다. (저항 -${next.resPenalty}%)`) : h('p', {}, '모든 난이도를 정복했습니다. 전설이 되었습니다!'),
    h('p', { class: 'dim small' }, `레벨 ${g.hero.level} · 처치 ${fmt(g.hero.kills)} · 사망 ${g.hero.deaths} · 플레이 ${fmtTime(g.hero.playTime)}`),
    h('button', { class: 'big', onclick: () => app.closeModal() }, '계속'));
}

export function isShopOpen(app: App): boolean { return app.panelL === 'shop'; }
export { BASE_BY_ID, baseOf, LAST_FLOOR, zoneOfFloor };
