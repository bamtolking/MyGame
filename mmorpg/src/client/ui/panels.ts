// Bottom-sheet panels. Each builder returns fresh DOM from the latest `me` state.
import type { Item, GearSlot, TalKind, Tal, ClassId } from '../../shared/types.ts';
import { itemName, computeStats, RARITY_NAMES, RARITY_COLORS, SLOT_NAMES, STAT_NAMES, baseStat, enhanceCost, MAX_PLUS, sellValue, tierOf, GEAR_SLOTS, talBuyCost, TAL_SHARD_COST, slotsUnlocked } from '../../shared/data/items.ts';
import { TALS, TAL_KINDS, talDesc } from '../../shared/data/talismans.ts';
import { MAIN_QUESTS, BOUNTY_N } from '../../shared/data/quests.ts';
import { ZONES } from '../../shared/data/zones.ts';
import { CLASSES, CLASS_IDS, classUnlocked, type ClassDef } from '../../shared/data/classes.ts';
import { MONSTERS } from '../../shared/data/monsters.ts';
import { TAL_SLOT_LEVELS, TILE, TAL_MAX_LV } from '../../shared/constants.ts';
import { EMOTES } from '../../shared/protocol.ts';
import { fmtNum } from '../../shared/math.ts';
import { h, type Child } from './dom.ts';
import { appSize } from './orient.ts';
import { itemIcon, talIcon, classIcon, npcIcon, monIcon } from '../render/art/icons.ts';
import type { AppApi } from './app.ts';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
function statLine(k: string, v: number): string { return k === 'leech' || k === 'crit' || k === 'dr' || k === 'critDmg' || k.endsWith('Pct') || k === 'aspd' || k === 'move' || k === 'cdr' ? `+${pct(v)}` : `+${v}`; }
function baseLabel(it: Item): string { const b = baseStat(it.slot, it.ilvl, it.rarity, it.plus); return it.slot === 'weapon' ? `공격력 +${b}` : it.slot === 'armor' ? `체력 +${b}` : `치명타 +${b}%`; }
export function powerWith(a: AppApi, it: Item | null, slot: GearSlot): number {
  const me = a.me(); return computeStats({ cls: me.cls, level: me.level, tals: me.tals, slots: me.slots, equip: { ...me.equip, [slot]: it } }).power;
}
function itemCard(a: AppApi, it: Item, onTap?: () => void, badge?: string): HTMLElement {
  const me = a.me();
  return h('button', { class: `item r${it.rarity}`, onclick: onTap },
    h('img', { src: itemIcon(it.slot, me.cls, tierOf(it.ilvl), it.rarity), alt: '' }),
    it.plus ? h('span', { class: 'plus' }, `+${it.plus}`) : null,
    badge ? h('span', { class: 'up' }, badge) : null,
    h('span', { class: 'ilvl' }, `${it.ilvl}`));
}

// ---------------- 가방 ----------------
export function bagPanel(a: AppApi): HTMLElement {
  const me = a.me(); const st = me.stats;
  const eq = h('div', { class: 'equip' }, ...GEAR_SLOTS.map(s => {
    const it = me.equip[s];
    return h('div', { class: 'eqslot' }, h('small', {}, SLOT_NAMES[s]), it ? itemCard(a, it, () => a.openItem(it, true)) : h('div', { class: 'item empty' }, '비어 있음'),
      it ? h('div', { class: 'eqname', style: { color: RARITY_COLORS[it.rarity] } }, itemName(it, me.cls)) : null);
  }));
  const stats = h('div', { class: 'stats' },
    ...[['전투력', fmtNum(st.power)], ['공격력', st.atk], ['체력', st.maxHp], ['치명타', pct(st.crit)], ['치명 피해', pct(st.critDmg)], ['공격 속도', `${st.aspd.toFixed(2)}/초`], ['이동 속도', Math.round(st.move)], ['피해 감소', pct(st.dr)],
      ...(st.cdr ? [['부적 재사용', `-${pct(st.cdr)}`]] : []), ...(st.leech ? [['흡혈', pct(st.leech)]] : []), ...(st.xpPct ? [['경험치', `+${pct(st.xpPct)}`]] : []), ...(st.goldPct ? [['금화', `+${pct(st.goldPct)}`]] : [])]
      .map(([k, v]) => h('div', {}, h('small', {}, k), h('b', {}, String(v)))));
  const cur = st.power;
  const inv = [...me.inv].sort((x, y) => y.rarity - x.rarity || y.ilvl - x.ilvl);
  const grid = h('div', { class: 'grid' }, ...inv.map(it => { const up = powerWith(a, it, it.slot) > cur; return itemCard(a, it, () => a.openItem(it, false), up ? '▲' : undefined); }),
    ...Array.from({ length: Math.max(0, 30 - inv.length) }, () => h('div', { class: 'item empty' })));
  const sellSel = h('select', {}, ...[0, 1, 2].map(r => h('option', { value: String(r) }, `${RARITY_NAMES[r]} 이하`))) as HTMLSelectElement;
  const autoSel = h('select', { onchange: (e: Event) => a.send({ t: 'autosell', r: Number((e.target as HTMLSelectElement).value) }) }, ...[-1, 0, 1, 2].map(r => h('option', { value: String(r), selected: me.autoSell === r }, r < 0 ? '끔' : `${RARITY_NAMES[r]} 이하`)));
  return h('div', {}, eq, stats,
    h('div', { class: 'row between' }, h('b', {}, `가방 ${me.inv.length}/30`), h('span', { class: 'gold' }, `🪙 ${fmtNum(me.gold)}  🌙 ${me.shards}`)),
    grid,
    h('div', { class: 'row' }, sellSel, h('button', { onclick: () => { const r = Number(sellSel.value); const up = (it: Item) => powerWith(a, it, it.slot) > cur; const uids = me.inv.filter(it => it.rarity <= r && !up(it)).map(it => it.uid); if (!uids.length) { a.toast('판매할 장비가 없습니다 (더 좋은 장비는 제외)'); return; } a.confirm(`${uids.length}개를 판매할까요? (더 좋은 장비는 제외)`, () => a.send({ t: 'sell', uids })); } }, '일괄 판매')),
    h('div', { class: 'row' }, h('small', {}, '새로 얻은 장비 자동 판매 (더 좋은 장비는 보관)'), autoSel),
    me.zone === 0 ? h('button', { class: 'wide', onclick: () => a.openSheet('smith') }, '⚒ 대장간에서 강화하기') : h('small', { class: 'hint' }, '강화는 마을 대장간에서 할 수 있습니다'));
}

export function itemModal(a: AppApi, it: Item, equipped: boolean): HTMLElement {
  const me = a.me(); const cur = me.stats.power; const cmp = equipped ? null : powerWith(a, it, it.slot) - cur;
  const other = equipped ? null : me.equip[it.slot];
  return h('div', { class: 'itemdetail' },
    h('div', { class: 'row' }, itemCard(a, it), h('div', {}, h('div', { class: 'iname', style: { color: RARITY_COLORS[it.rarity] } }, itemName(it, me.cls)), h('small', {}, `${RARITY_NAMES[it.rarity]} · ${SLOT_NAMES[it.slot]} · 아이템 레벨 ${it.ilvl}`))),
    h('div', { class: 'lines' }, h('div', { class: 'base' }, baseLabel(it)), ...it.affixes.map(([k, v]) => h('div', {}, `${STAT_NAMES[k]} ${statLine(k, v)}`))),
    cmp != null ? h('div', { class: cmp >= 0 ? 'good' : 'bad' }, `전투력 ${cmp >= 0 ? '+' : ''}${fmtNum(cmp)}${other ? ` (착용 중: ${itemName(other, me.cls)})` : ''}`) : null,
    h('div', { class: 'row' },
      equipped ? h('button', { onclick: () => { a.send({ t: 'unequip', slot: it.slot }); a.closeModal(); } }, '해제') : h('button', { class: 'primary', onclick: () => { a.send({ t: 'equip', uid: it.uid }); a.closeModal(); } }, '장착'),
      !equipped ? h('button', { onclick: () => { a.send({ t: 'sell', uids: [it.uid] }); a.closeModal(); } }, `판매 🪙${fmtNum(sellValue(it))}`) : null,
      me.zone === 0 && it.plus < MAX_PLUS ? h('button', { onclick: () => a.send({ t: 'enhance', uid: it.uid }) }, `강화 🪙${fmtNum(enhanceCost(it))}`) : null));
}

// ---------------- 대장간 ----------------
export function smithPanel(a: AppApi): HTMLElement {
  const me = a.me();
  return h('div', {},
    h('div', { class: 'npc' }, h('img', { src: npcIcon('smith') }), h('div', {}, h('b', {}, '대장장이 무쇠'), h('p', {}, '"강화는 실패 없이 한 단계씩 올라가네. 대신 금화가 제법 들지. 최대 +10."'))),
    me.zone !== 0 ? h('p', { class: 'hint' }, '마을에 있어야 강화할 수 있습니다.') : null,
    ...GEAR_SLOTS.map(s => { const it = me.equip[s]; if (!it) return h('div', { class: 'smithrow' }, h('small', {}, `${SLOT_NAMES[s]}: 비어 있음`));
      const c = enhanceCost(it); const next = { ...it, plus: it.plus + 1 };
      return h('div', { class: 'smithrow' }, itemCard(a, it), h('div', { class: 'grow' }, h('div', { style: { color: RARITY_COLORS[it.rarity] } }, itemName(it, me.cls)), h('small', {}, it.plus >= MAX_PLUS ? '최대 강화' : `${baseLabel(it)} → ${baseLabel(next)}`)),
        h('button', { class: 'primary', disabled: me.zone !== 0 || it.plus >= MAX_PLUS || me.gold < c, onclick: () => a.send({ t: 'enhance', uid: it.uid }) }, it.plus >= MAX_PLUS ? 'MAX' : `🪙${fmtNum(c)}`)); }),
    h('div', { class: 'row between' }, h('span', {}, '보유'), h('b', { class: 'gold' }, `🪙 ${fmtNum(me.gold)}`)));
}

// ---------------- 부적 ----------------
export function talPanel(a: AppApi, pickSlot: number | null): HTMLElement {
  const me = a.me(); const open = slotsUnlocked(me.level);
  const byUid = new Map(me.tals.map(t => [t.uid, t]));
  const slots = h('div', { class: 'talslots' }, ...[0, 1, 2, 3].map(i => {
    const t = me.slots[i] != null ? byUid.get(me.slots[i]!) : null; const locked = i >= open;
    return h('button', { class: `talslot ${pickSlot === i ? 'sel' : ''} ${locked ? 'locked' : ''}`, onclick: () => { if (locked) { a.toast(`레벨 ${TAL_SLOT_LEVELS[i]}에 열립니다`); return; } a.openSheet('tal', pickSlot === i ? null : i); } },
      locked ? h('span', {}, `🔒 Lv${TAL_SLOT_LEVELS[i]}`) : t ? [h('img', { src: talIcon(t.kind) }), h('small', {}, `${TALS[t.kind].name.replace(' 부적', '')} Lv${t.lv}`)] : h('span', {}, '+ 비어 있음'));
  }));
  const groups = new Map<TalKind, Tal[]>(); for (const t of me.tals) groups.set(t.kind, [...(groups.get(t.kind) ?? []), t]);
  const list = h('div', { class: 'tallist' }, ...TAL_KINDS.filter(k => groups.has(k)).map(k => {
    const ts = groups.get(k)!.sort((x, y) => y.lv - x.lv); const d = TALS[k];
    const byLv = new Map<number, Tal[]>(); for (const t of ts) byLv.set(t.lv, [...(byLv.get(t.lv) ?? []), t]);
    const mergeLv = [...byLv.entries()].find(([lv, arr]) => arr.length >= 3 && lv < TAL_MAX_LV);
    const equipped = ts.find(t => me.slots.includes(t.uid));
    return h('div', { class: 'talrow' }, h('img', { src: talIcon(k) }),
      h('div', { class: 'grow' }, h('b', { style: { color: d.color } }, d.name), equipped ? h('span', { class: 'chip' }, `장착 Lv${equipped.lv}`) : null,
        h('small', { class: 'block' }, d.brief), h('small', { class: 'block muted' }, [...byLv.entries()].map(([lv, arr]) => `Lv${lv}×${arr.length}`).join('  ')),
        h('small', { class: 'block' }, `최고 Lv${ts[0].lv}: ${talDesc(k, ts[0].lv)}`)),
      h('div', { class: 'col' },
        pickSlot != null ? h('button', { class: 'primary', onclick: () => { a.send({ t: 'talslot', slot: pickSlot, uid: ts[0].uid }); a.openSheet('tal', null); } }, '장착')
          : !equipped ? h('button', { onclick: () => { const free = [0, 1, 2, 3].find(i => i < open && me.slots[i] == null); if (free == null) { a.toast('빈 칸이 없습니다. 위의 칸을 눌러 교체하세요'); return; } a.send({ t: 'talslot', slot: free, uid: ts[0].uid }); } }, '장착') : null,
        mergeLv ? h('button', { class: 'good', onclick: () => a.send({ t: 'merge', uid: mergeLv[1][0].uid }) }, `합성 Lv${mergeLv[0]}→${mergeLv[0] + 1}`) : null,
        ts.some(t => !me.slots.includes(t.uid)) ? h('button', { class: 'ghost small', onclick: () => { const t = [...ts].reverse().find(x => !me.slots.includes(x.uid))!; a.send({ t: 'sellTal', uid: t.uid }); } }, '1장 판매') : null));
  }));
  const shop = h('div', { class: 'shop' }, h('div', { class: 'npc' }, h('img', { src: npcIcon('talshop') }), h('div', {}, h('b', {}, '부적상 청아'), h('p', {}, me.zone === 0 ? '"같은 부적 3장이면 한 단계 위로 합칠 수 있어요."' : '마을에 오시면 부적을 팔아드릴게요.'))),
    h('div', { class: 'row' }, h('button', { class: 'primary', disabled: me.zone !== 0 || me.gold < talBuyCost(me.level), onclick: () => a.send({ t: 'buytal' }) }, `무작위 부적 🪙${fmtNum(talBuyCost(me.level))}`),
      h('button', { disabled: me.zone !== 0 || me.shards < TAL_SHARD_COST, onclick: () => a.openModal(h('div', {}, h('h3', {}, `원하는 부적 고르기 (🌙${TAL_SHARD_COST})`), h('div', { class: 'grid4' }, ...TAL_KINDS.map(k => h('button', { class: 'talpick', onclick: () => { a.send({ t: 'buytal', kind: k }); a.closeModal(); } }, h('img', { src: talIcon(k) }), h('small', {}, TALS[k].name.replace(' 부적', ''))))))) }, `원하는 부적 🌙${TAL_SHARD_COST}`)));
  return h('div', {}, h('p', { class: 'hint' }, pickSlot != null ? `${pickSlot + 1}번 칸에 장착할 부적을 고르세요 (같은 종류는 한 칸만).` : '부적은 자동으로 발동합니다. 칸을 누르면 교체할 수 있어요.'), slots,
    me.tals.length ? list : h('p', { class: 'hint' }, '아직 부적이 없습니다.'), shop);
}

// ---------------- 퀘스트 ----------------
export function questPanel(a: AppApi): HTMLElement {
  const me = a.me(); const q = MAIN_QUESTS[me.quest.main]; const s = me.lstats;
  const rw = (r: typeof q.reward) => [r.gold ? `🪙${r.gold}` : '', r.xp ? `경험치 ${r.xp}` : '', r.item != null ? `${RARITY_NAMES[r.item]} 장비` : '', r.tal ? '부적' : '', r.shards ? `🌙${r.shards}` : ''].filter(Boolean).join(' · ');
  return h('div', {},
    q ? h('div', { class: 'card quest' }, h('small', {}, `이야기 ${me.quest.main + 1}/${MAIN_QUESTS.length} · ${ZONES[q.zone].name}`), h('h3', {}, q.title), h('p', {}, q.desc),
      q.n > 1 ? h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, me.quest.prog / q.n * 100)}%` } }), h('span', {}, `${me.quest.prog} / ${q.n}`)) : null,
      h('small', {}, `보상: ${rw(q.reward)}`)) : h('div', { class: 'card' }, h('h3', {}, '모든 이야기를 마쳤습니다!'), h('p', {}, '현상금과 불가사리 토벌로 더 강해지세요.')),
    h('div', { class: 'card' }, h('small', {}, '반복 현상금'), h('h3', {}, `${ZONES[me.quest.bountyZone]?.name ?? ''} 요괴 ${BOUNTY_N}마리`), h('div', { class: 'bar' }, h('i', { style: { width: `${me.quest.bountyProg / BOUNTY_N * 100}%` } }), h('span', {}, `${me.quest.bountyProg} / ${BOUNTY_N}`)), h('small', {}, `완료 ${me.quest.bountyDone}회 · 사냥하는 지역의 현상금이 자동으로 진행됩니다`)),
    h('div', { class: 'card' }, h('small', {}, '퇴마 기록'), h('div', { class: 'stats' }, ...[['처치', fmtNum(s.kills)], ['보스', s.bosses], ['불가사리', s.worldBoss], ['쓰러짐', s.deaths], ['동료 부활', s.revives], ['합성', s.merges], ['전설 획득', s.legendaries], ['플레이', `${Math.floor(s.playSec / 3600)}시간 ${Math.floor((s.playSec % 3600) / 60)}분`]].map(([k, v]) => h('div', {}, h('small', {}, String(k)), h('b', {}, String(v)))))));
}

// ---------------- 지도 ----------------
export function mapPanel(a: AppApi): HTMLElement {
  // fit the side sheet (see #sheet in style.css): its width and the landscape height
  const g = a.game(); const me = a.me(); const map = g.map; const [aw, ah] = appSize(); const size = Math.round(Math.max(200, Math.min(520, Math.min(460, aw * 0.72) - 32, ah - 76)));
  const cv = h('canvas', { width: size * 2, height: size * 2, style: { width: size + 'px', height: size + 'px' }, class: 'bigmap' }) as HTMLCanvasElement;
  const c = cv.getContext('2d')!; c.scale(2 * size / map.w, 2 * size / map.h); c.imageSmoothingEnabled = true;
  c.drawImage(g.r.terrain.miniMap, 0, 0);
  const k = 1 / TILE; c.textAlign = 'center';
  for (const z of ZONES) { if (z.id === 0) continue; const pts = z.id === 1 ? [map.lairs[0].x / TILE + 14, map.lairs[0].y / TILE + 2] as [number, number] : zoneLabelPos(z.id, map); if (z.id !== 1 && z.id !== 5) pts[1] -= 9; c.font = `bold ${7}px system-ui`; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(z.name, pts[0] + 0.5, pts[1] + 0.5); c.fillStyle = '#fff'; c.fillText(z.name, pts[0], pts[1]); c.font = '5px system-ui'; c.fillStyle = '#ffe08a'; c.fillText(z.id === 5 ? '월드 보스' : `Lv${z.minLv}~${z.maxLv}`, pts[0], pts[1] + 7); }
  for (const l of map.lairs) { c.font = '9px system-ui'; c.fillText('💀', l.x * k, l.y * k + 3); }
  c.fillText('🔥', map.altar.x * k, map.altar.y * k + 3);
  for (const p of g.players.values()) { const r = g.roster.get(p.id); c.fillStyle = p.id === g.myId ? '#fff' : r?.bot ? '#7fb8ff' : '#7dffb0'; c.beginPath(); c.arc(p.x * k, p.y * k, p.id === g.myId ? 2.4 : 1.6, 0, 6.3); c.fill(); }
  const wrap = h('div', { class: 'mapwrap' }, cv);
  for (const s of map.shrines) {
    const known = me.shrines.includes(s.id) || (s.id === 4 && g.wb.state !== 'idle');
    const b = h('button', { class: `shrinebtn ${known ? '' : 'unknown'}`, style: { left: `${s.x * k / map.w * 100}%`, top: `${s.y * k / map.h * 100}%` }, onclick: () => { if (!known) { a.toast('아직 발견하지 못한 신당입니다. 직접 걸어가서 발견하세요'); return; } a.confirm(`${s.name}(으)로 순간이동할까요?`, () => { a.send({ t: 'tp', shrine: s.id }); a.closeSheet(); }); } }, '⛩');
    wrap.append(b);
  }
  return h('div', {}, wrap, h('p', { class: 'hint' }, '⛩ 신당을 누르면 순간이동 (발견한 곳만, 전투 중 불가) · 💀 지역 보스 · 🔥 불가사리 제단'),
    h('div', { class: 'legend' }, ...ZONES.filter(z => z.id >= 1 && z.id <= 4).map(z => h('div', {}, h('i', { style: { background: z.mini } }), `${z.name} Lv${z.minLv}~${z.maxLv}`))));
}
function zoneLabelPos(z: number, map: { w: number; h: number; zones: Uint8Array }): [number, number] {
  let sx = 0, sy = 0, n = 0; for (let y = 0; y < map.h; y += 3) for (let x = 0; x < map.w; x += 3) if (map.zones[y * map.w + x] === z) { sx += x; sy += y; n++; }
  return n ? [sx / n, sy / n] : [0, 0];
}

// ---------------- 접속자 ----------------
export function rosterPanel(a: AppApi): HTMLElement {
  const g = a.game(); const list = [...g.roster.values()].sort((x, y) => Number(x.bot) - Number(y.bot) || y.level - x.level);
  return h('div', {}, h('p', { class: 'hint' }, `${g.serverName} · 채널 ${g.channel} · ${list.filter(r => !r.bot).length}명 접속${list.some(r => r.bot) ? ` + AI 동료 ${list.filter(r => r.bot).length}` : ''}`),
    ...list.map(r => h('div', { class: 'rosterrow' }, h('img', { src: classIcon(r.cls) }), h('div', { class: 'grow' }, h('b', {}, r.name), r.bot ? h('span', { class: 'chip ai' }, 'AI') : null, r.id === g.myId ? h('span', { class: 'chip' }, '나') : null, h('small', { class: 'block' }, `Lv${r.level} ${CLASSES[r.cls].name} · 전투력 ${fmtNum(r.power)}`)),
      h('div', { class: 'tals' }, ...r.tals.map(([k, lv]) => h('img', { src: talIcon(k), title: `${TALS[k].name} Lv${lv}` }))))));
}

// ---------------- 채팅 ----------------
export function chatPanel(a: AppApi): HTMLElement {
  const inp = h('input', { type: 'text', maxlength: 60, placeholder: '메시지 (채널 전체)', enterkeyhint: 'send' }) as HTMLInputElement;
  const send = () => { const t = inp.value.trim(); if (t) { a.send({ t: 'chat', text: t }); inp.value = ''; } a.closeSheet(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  setTimeout(() => inp.focus(), 50);
  return h('div', {}, h('div', { class: 'emotes' }, ...EMOTES.map((e, i) => h('button', { onclick: () => { a.send({ t: 'emote', e: i }); a.closeSheet(); } }, e))),
    h('div', { class: 'row' }, inp, h('button', { class: 'primary', onclick: send }, '보내기')),
    h('div', { class: 'chatlog' }, ...a.chatLines().slice(-30).map(l => h('div', { class: l.sys ? 'sys' : '' }, l.name ? h('b', {}, l.name + ': ') : null, l.text))));
}

// ---------------- 도감 ----------------
export function codexPanel(): HTMLElement {
  return h('div', {}, h('p', { class: 'hint' }, '달빛 고을에 출몰하는 요괴들'), ...ZONES.filter(z => z.id >= 1).map(z => h('div', { class: 'card' }, h('h3', {}, `${z.name} ${z.id <= 4 ? `· Lv${z.minLv}~${z.maxLv}` : ''}`), h('p', {}, z.desc),
    h('div', { class: 'codex' }, ...MONSTERS.map((m, i) => ({ m, i })).filter(({ m }) => m.zone === z.id).map(({ m }) => h('div', { class: 'codexrow' }, h('img', { src: monIcon(m.key) }), h('div', {}, h('b', {}, m.name, m.beh === 'boss' ? ' (보스)' : ''), h('small', { class: 'block' }, m.desc))))))),
    h('div', { class: 'card' }, h('h3', {}, '황금 도깨비'), h('div', { class: 'codexrow' }, h('img', { src: monIcon('goldgob') }), h('small', {}, MONSTERS.find(m => m.key === 'goldgob')!.desc))));
}

// ---------------- 직업 (class cards, detail, 전직소) ----------------
/** Stat bars relative to the other classes (min → 18 %, max → 100 %). */
const CSTATS: [string, (c: ClassDef) => number][] = [['체력', c => c.hp], ['공격', c => c.atk * c.aspd], ['사거리', c => c.range], ['이동', c => c.move]];
function classStats(id: ClassId): HTMLElement {
  return h('div', { class: 'cstats' }, ...CSTATS.map(([label, f]) => {
    const vs = CLASS_IDS.map(k => f(CLASSES[k])); const lo = Math.min(...vs), hi = Math.max(...vs); const p = 0.18 + 0.82 * (f(CLASSES[id]) - lo) / (hi - lo || 1);
    return h('div', { class: 'cstat' }, h('small', {}, label), h('i', {}, h('b', { style: { width: `${Math.round(p * 100)}%` } })));
  }));
}
/** Compact class card (character creation grid). */
export function classCard(id: ClassId, o: { sel: boolean; peek: boolean; locked: boolean; onclick: () => void }): HTMLElement {
  const c = CLASSES[id];
  return h('button', { class: `classcard${o.sel ? ' sel' : ''}${o.peek ? ' peek' : ''}${o.locked ? ' locked' : ''}`, 'data-cls': id, style: { '--c': c.color }, onclick: o.onclick },
    h('span', { class: 'glyph' }, c.glyph), o.locked ? h('span', { class: 'lock' }, '🔒') : null,
    h('img', { src: classIcon(id), alt: '' }), h('b', {}, c.name), h('small', { class: 'role' }, o.locked ? `해금: ${c.unlock.text}` : c.role));
}
/** Full description of one class: portrait, role, description, ultimate and stat bars. */
export function classDetail(id: ClassId, locked: boolean, ...extra: Child[]): HTMLElement {
  const c = CLASSES[id];
  return h('div', { class: `clsdetail${locked ? ' locked' : ''}`, style: { '--c': c.color } },
    h('div', { class: 'cdhead' }, h('div', { class: 'cdicon' }, h('img', { src: classIcon(id, 96), alt: '' })),
      h('div', { class: 'grow' }, h('b', {}, c.name, h('small', {}, c.eng)), h('small', { class: 'role' }, c.role))),
    h('p', { class: 'desc' }, c.desc),
    h('div', { class: 'cdult' }, h('span', { class: 'glyph' }, c.glyph), h('div', {}, h('b', {}, `필살기 · ${c.ultName}`), h('small', {}, c.ultDesc))),
    classStats(id), ...extra);
}
export const lockBox = (id: ClassId): HTMLElement => h('div', { class: 'lockbox' }, h('b', {}, `🔒 해금: ${CLASSES[id].unlock.text}`), h('small', {}, '캐릭터를 키우면 열립니다 — 마을 신당 무당에게서 전직'));

/** Name + 로/으로 (ㄹ-final and open syllables take 로). */
const ro = (w: string) => { const k = (w.charCodeAt(w.length - 1) - 0xac00) % 28; return w + (k === 0 || k === 8 ? '로' : '으로'); };
/** 직업 · 전직소: every class with its state; the selected one can be switched to (in town). */
export function clsPanel(a: AppApi, pick: ClassId | null): HTMLElement {
  const me = a.me(); const prog = { level: me.level, bosses: me.lstats.bosses, worldBoss: me.lstats.worldBoss };
  const open = (id: ClassId) => id === me.cls || classUnlocked(id, prog); const fresh = a.newClasses(); const sel = pick ?? me.cls;
  const list = h('div', { class: 'clslist' }, ...CLASS_IDS.map(id => {
    const c = CLASSES[id]; const ok = open(id); const cur = id === me.cls;
    return h('button', { class: `clsrow${id === sel ? ' sel' : ''}${ok ? '' : ' locked'}`, 'data-cls': id, style: { '--c': c.color }, onclick: () => a.openSheet('cls', id) },
      h('img', { src: classIcon(id), alt: '' }),
      h('span', { class: 'nm' }, h('b', {}, c.name, fresh.has(id) ? h('span', { class: 'newchip' }, 'NEW') : null), h('small', {}, c.role)),
      h('small', { class: `st ${cur ? 'cur' : ok ? 'ok' : 'lock'}` }, cur ? '현재 직업' : ok ? '전직 가능' : `🔒 ${c.unlock.text}`));
  }));
  const ok = open(sel); const cur = sel === me.cls;
  const act = cur ? h('button', { class: 'wide', disabled: true }, '현재 직업입니다')
    : !ok ? lockBox(sel)
    : h('div', { class: 'clsact' }, h('button', { class: 'primary wide cls-go', disabled: me.zone !== 0, onclick: () => a.send({ t: 'cls', cls: sel }) }, `${ro(CLASSES[sel].name)} 전직하기`),
      me.zone !== 0 ? h('small', { class: 'hint block center' }, '마을에서만 전직할 수 있어요') : null);
  return h('div', { class: 'clsgrid' },
    h('div', {}, h('div', { class: 'npc' }, h('img', { src: npcIcon('priest'), alt: '' }), h('div', {}, h('b', {}, '신당 무당 월선'), h('p', {}, '"새 길이 열렸군요. 걸어갈 길을 고르세요."'))),
      h('small', { class: 'hint block' }, `Lv${me.level} · 보스 토벌 ${me.lstats.bosses} · 불가사리 ${me.lstats.worldBoss}`), list),
    h('div', { class: 'clsside' }, classDetail(sel, !ok, act)));
}
