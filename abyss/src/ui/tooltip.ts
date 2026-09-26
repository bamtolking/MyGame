// Item tooltip HTML (Diablo-style), with a stat comparison against what is currently equipped.
import { CLASSES } from '../data/classes';
import { BASE_BY_ID, CAT_NAMES, RARITY_COLOR, RARITY_NAME, UNIQUE_BY_ID, baseForClass, modText } from '../data/items';
import { baseOf, buyPrice, canEquipClass, itemArmor, sellPrice, weaponDamage } from '../sim/items';
import { computeStats, sheetDps } from '../sim/stats';
import type { Game } from '../sim/game';
import type { EquipSlot, Hero, Item } from '../sim/types';
import { esc } from './dom';

export type PriceMode = 'none' | 'sell' | 'buy';

function deltaStats(g: Game, it: Item): { dps: number; armor: number; hp: number; res: number } | null {
  const h = g.hero;
  if (!canEquipClass(it, h.cls)) return null;
  const b = baseOf(it);
  const slot: EquipSlot = b.slot === 'ring' ? (!h.equip.ring1 ? 'ring1' : !h.equip.ring2 ? 'ring2' : 'ring1') : (b.slot as EquipSlot);
  const clone = { ...h, equip: { ...h.equip }, level: Math.max(h.level, it.req) } as Hero;
  const before = computeStats(clone, g.diff);
  clone.equip[slot] = it;
  if (slot === 'weapon' && b.twoHanded && clone.equip.offhand && baseOf(clone.equip.offhand).cat !== 'quiver') clone.equip.offhand = null;
  const after = computeStats(clone, g.diff);
  const avgRes = (s: typeof before) => (s.res.fire + s.res.cold + s.res.light + s.res.poison) / 4;
  return { dps: sheetDps(after) - sheetDps(before), armor: after.armor - before.armor, hp: after.maxHp - before.maxHp, res: avgRes(after) - avgRes(before) };
}

const sign = (v: number, digits = 0) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

export function itemTooltipHtml(g: Game, it: Item, opts: { price?: PriceMode; equipped?: boolean; compare?: boolean } = {}): string {
  const b = BASE_BY_ID[it.base];
  const col = RARITY_COLOR[it.rarity];
  const h = g.hero;
  const lines: string[] = [];
  lines.push(`<div class="tt-name" style="color:${col}">${esc(it.name)}</div>`);
  if (it.rarity === 'rare' || it.rarity === 'unique') lines.push(`<div class="tt-base" style="color:${col}">${esc(b.name)}</div>`);
  lines.push(`<div class="tt-sub">${RARITY_NAME[it.rarity]} ${CAT_NAMES[b.cat]}${b.twoHanded ? ' · 양손' : ''}${b.cls ? ` · ${(Array.isArray(b.cls) ? b.cls : [b.cls]).map((c) => CLASSES[c].name).join('·')} 전용` : ''}</div>`);
  if (it.dmg) {
    const [lo, hi] = weaponDamage(it);
    const boosted = lo !== it.dmg[0] || hi !== it.dmg[1];
    lines.push(`<div class="tt-main">피해: <b style="color:${boosted ? '#8090ff' : '#fff'}">${lo}–${hi}</b> <span class="dim">(초당 공격 ${b.speed?.toFixed(2)})</span></div>`);
  }
  if (it.armor) {
    const a = itemArmor(it);
    lines.push(`<div class="tt-main">방어력: <b style="color:${a !== it.armor ? '#8090ff' : '#fff'}">${a}</b></div>`);
  }
  if (it.block) lines.push(`<div class="tt-main">막기 확률: <b>${it.block}%</b></div>`);
  const reqOk = h.level >= it.req;
  if (it.req > 1) lines.push(`<div class="tt-req" style="color:${reqOk ? '#c8c0b0' : '#ff5050'}">요구 레벨: ${it.req}</div>`);
  if (b.cls && !baseForClass(b, h.cls)) lines.push(`<div class="tt-req" style="color:#ff5050">${(Array.isArray(b.cls) ? b.cls : [b.cls]).map((c) => CLASSES[c].name).join('·')}만 사용할 수 있습니다</div>`);
  const imp = b.implicit?.length ?? 0;
  it.mods.forEach((m, i) => {
    if (m.k === 'ed' || m.k === 'armorPct') { /* shown via blue numbers too, but list for clarity */ }
    lines.push(`<div class="tt-mod${i < imp ? ' imp' : ''}">${esc(modText(m))}</div>`);
  });
  if (it.uniq) lines.push(`<div class="tt-lore">“${esc(UNIQUE_BY_ID[it.uniq].lore)}”</div>`);
  if (opts.compare !== false && !opts.equipped) {
    const d = deltaStats(g, it);
    if (d) {
      const parts: string[] = [];
      const add = (label: string, v: number, digits = 0) => { if (Math.abs(v) >= (digits ? 0.05 : 0.5)) parts.push(`<span style="color:${v > 0 ? '#60e060' : '#ff6060'}">${label} ${sign(v, digits)}</span>`); };
      add('DPS', d.dps, 1); add('방어', d.armor); add('생명', d.hp); add('저항', d.res, 1);
      if (parts.length) lines.push(`<div class="tt-cmp">장착 시: ${parts.join(' · ')}</div>`);
      else lines.push(`<div class="tt-cmp dim">장착 시 변화 없음</div>`);
    }
  }
  if (opts.equipped) lines.push(`<div class="tt-cmp dim">착용 중</div>`);
  if (opts.price === 'sell') lines.push(`<div class="tt-price">판매가: ${sellPrice(it)} 금화</div>`);
  if (opts.price === 'buy') lines.push(`<div class="tt-price" style="color:${h.gold >= buyPrice(it) ? '#ffd24a' : '#ff5050'}">가격: ${buyPrice(it)} 금화</div>`);
  return lines.join('');
}
