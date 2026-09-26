// Validated player commands (inventory, talismans, shops, travel, chat). Never trust the client.
import type { GearSlot, TalKind } from '../shared/types.ts';
import { CLASSES, isClassId, classUnlocked } from '../shared/data/classes.ts';
import { TAL_SLOTS, TAL_MAX_LV, NAME_MAX } from '../shared/constants.ts';
import { enhanceCost, MAX_PLUS, sellValue, slotsUnlocked, talBuyCost, TAL_SHARD_COST, GEAR_SLOTS } from '../shared/data/items.ts';
import { TAL_KINDS, TALS } from '../shared/data/talismans.ts';
import { EMOTES } from '../shared/protocol.ts';
import type { World } from './world.ts';
import type { Player } from './entities.ts';
import { giveGold, giveTal, questEvent, questCheckState, unlockProgress } from './progress.ts';
import { useUlt } from './combat.ts';
import { BotBrain } from './bots.ts';

export type ActResult = string | null; // error message or null
const inTown = (p: Player) => p.zone === 0;

export function doAction(w: World, p: Player, msg: any): ActResult {
  const pr = p.prof;
  switch (msg.t) {
    case 'ult': return useUlt(w, p) ? null : '';
    case 'cls': {
      const c = msg.cls; if (!isClassId(c)) return '없는 직업입니다'; if (c === pr.cls) return null;
      if (!classUnlocked(c, unlockProgress(pr))) return `아직 잠긴 직업입니다 — ${CLASSES[c].unlock.text}`;
      if (!inTown(p)) return '전직은 마을에서만 할 수 있습니다';
      if (p.down) return '쓰러진 상태에서는 전직할 수 없습니다';
      if (w.time - p.clsT < 3) return '잠시 후 다시 전직할 수 있습니다';
      const tried = pr.tried ?? (pr.tried = [pr.cls]);
      p.clsT = w.time; pr.cls = c; p.ultT = 0; p.ultTick = 0; p.atkT = 0.6; p.invVer++; w.recompute(p);
      w.emit({ k: 'cls', p: p.id, c }, p.x, p.y);
      w.toast(p, `전직 완료: ${CLASSES[c].name}`, CLASSES[c].color);
      if (!tried.includes(c)) { tried.push(c); giveTal(w, p, CLASSES[c].startTal); }
      return null;
    }
    case 'equip': {
      const i = pr.inv.findIndex(x => x.uid === msg.uid); if (i < 0) return '없는 장비입니다';
      const it = pr.inv[i]; const old = pr.equip[it.slot]; pr.inv.splice(i, 1); pr.equip[it.slot] = it; if (old) pr.inv.push(old);
      p.invVer++; w.recompute(p); questCheckState(w, p); return null;
    }
    case 'unequip': {
      const s = msg.slot as GearSlot; if (!GEAR_SLOTS.includes(s)) return '잘못된 부위'; const it = pr.equip[s]; if (!it) return null;
      if (pr.inv.length >= 30) return '가방이 가득 찼습니다';
      pr.equip[s] = null; pr.inv.push(it); p.invVer++; w.recompute(p); return null;
    }
    case 'sell': {
      if (!Array.isArray(msg.uids) || msg.uids.length > 40) return '잘못된 요청';
      let g = 0, n = 0; const set = new Set<number>(msg.uids.filter((x: unknown) => typeof x === 'number'));
      pr.inv = pr.inv.filter(it => { if (set.has(it.uid)) { g += sellValue(it); n++; return false; } return true; });
      if (!n) return null; giveGold(p, g); p.invVer++; w.toast(p, `${n}개 판매 · 금화 +${g}`, '#ffd54a'); return null;
    }
    case 'enhance': {
      if (!inTown(p)) return '강화는 마을 대장간에서만 할 수 있습니다';
      const it = GEAR_SLOTS.map(s => pr.equip[s]).find(x => x?.uid === msg.uid) ?? pr.inv.find(x => x.uid === msg.uid);
      if (!it) return '없는 장비입니다'; if (it.plus >= MAX_PLUS) return '최대 강화입니다';
      const c = enhanceCost(it); if (pr.gold < c) return '금화가 부족합니다';
      pr.gold -= c; it.plus++; p.invVer++; w.recompute(p); questCheckState(w, p);
      w.emitTo(p, { k: 'toast', text: `강화 성공! +${it.plus}`, c: '#ffd54a' }); return null;
    }
    case 'talslot': {
      const s = msg.slot | 0; if (s < 0 || s >= TAL_SLOTS) return '잘못된 칸';
      if (s >= slotsUnlocked(pr.level)) return `레벨 ${[1, 3, 7, 12][s]}에 열리는 칸입니다`;
      if (msg.uid == null) { pr.slots[s] = null; }
      else {
        const t = pr.tals.find(x => x.uid === msg.uid); if (!t) return '없는 부적입니다';
        for (let i = 0; i < TAL_SLOTS; i++) { const o = pr.slots[i] == null ? null : pr.tals.find(x => x.uid === pr.slots[i]); if (i !== s && o && (o.uid === t.uid || o.kind === t.kind)) pr.slots[i] = null; }
        pr.slots[s] = t.uid; p.cds[s] = 1;
      }
      p.talVer++; w.recompute(p); questCheckState(w, p); return null;
    }
    case 'merge': {
      const t = pr.tals.find(x => x.uid === msg.uid); if (!t) return '없는 부적입니다'; if (t.lv >= TAL_MAX_LV) return '최대 단계입니다';
      const same = pr.tals.filter(x => x.kind === t.kind && x.lv === t.lv);
      if (same.length < 3) return '같은 부적(같은 단계) 3장이 필요합니다';
      // keep the equipped copy (if any) as the one that levels up
      same.sort((a, b) => (pr.slots.includes(b.uid) ? 1 : 0) - (pr.slots.includes(a.uid) ? 1 : 0));
      const [keep, a, b] = same; pr.tals = pr.tals.filter(x => x !== a && x !== b);
      for (let i = 0; i < TAL_SLOTS; i++) if (pr.slots[i] === a.uid || pr.slots[i] === b.uid) pr.slots[i] = null;
      keep.lv++; pr.stats.merges++; p.talVer++; w.recompute(p);
      w.emitTo(p, { k: 'toast', text: `합성 성공! ${TALS[keep.kind].name} Lv${keep.lv}`, c: TALS[keep.kind].color });
      questEvent(w, p, 'merge', 0); return null;
    }
    case 'sellTal': {
      const i = pr.tals.findIndex(x => x.uid === msg.uid); if (i < 0) return '없는 부적입니다';
      if (pr.slots.includes(pr.tals[i].uid)) return '장착 중인 부적은 팔 수 없습니다';
      const t = pr.tals.splice(i, 1)[0]; giveGold(p, 60 * 3 ** (t.lv - 1)); p.talVer++; return null;
    }
    case 'buytal': {
      if (!inTown(p)) return '부적은 마을 부적상에서만 살 수 있습니다';
      if (pr.tals.length >= 40) return '부적함이 가득 찼습니다';
      let kind: TalKind;
      if (msg.kind != null) { if (!TAL_KINDS.includes(msg.kind)) return '없는 부적'; if (pr.shards < TAL_SHARD_COST) return '달빛 조각이 부족합니다'; pr.shards -= TAL_SHARD_COST; kind = msg.kind; }
      else { const c = talBuyCost(pr.level); if (pr.gold < c) return '금화가 부족합니다'; pr.gold -= c; kind = w.rng.pick(TAL_KINDS); }
      pr.tals.push({ uid: pr.nextUid++, kind, lv: 1 }); p.talVer++;
      w.emitTo(p, { k: 'toast', text: `부적 구매: ${TALS[kind].name}`, c: TALS[kind].color }); return null;
    }
    case 'respawn': { if (!p.down) return null; if (p.downT > 13.5) return '잠시 후 귀환할 수 있습니다'; w.respawn(p); return null; }
    case 'tp': {
      const s = w.map.shrines[msg.shrine | 0]; if (!s) return '없는 신당';
      if (!pr.shrines.includes(s.id) && !(s.id === 4 && w.wb.state !== 'idle')) return '아직 발견하지 못한 신당입니다';
      if (p.down) return '쓰러진 상태에서는 이동할 수 없습니다';
      if (p.tpT > 0) return `${Math.ceil(p.tpT)}초 후 다시 이동할 수 있습니다`;
      if (w.time - p.lastHurtT < 3) return '전투 중에는 이동할 수 없습니다 (3초)';
      w.teleport(p, s.x, s.y + 40); p.tpT = 8; return null;
    }
    case 'emote': { const e = msg.e | 0; if (e < 0 || e >= EMOTES.length) return null; if (w.time - p.chatT < 0.8) return null; p.chatT = w.time; w.emit({ k: 'emote', p: p.id, e }, p.x, p.y); return null; }
    case 'chat': {
      if (typeof msg.text !== 'string') return null; if (w.time - p.chatT < 1) return '채팅이 너무 빠릅니다';
      const text = cleanText(msg.text, 60); if (!text) return null; p.chatT = w.time;
      w.broadcast.push({ t: 'chat', id: p.id, name: pr.name, text }); return null;
    }
    case 'auto': {
      if (p.bot) return null; const on = !!msg.on; if (on === p.auto) return null;
      p.auto = on; p.inputs.length = 0; p.lastSeq = 0;
      if (on) { const b = new BotBrain('quester', p.id); b.gear = 'light'; w.brains.set(p.id, b); w.toast(p, '자동 사냥 ON — 이야기를 따라 사냥합니다. 조이스틱을 움직이면 해제', '#9fd7ff'); }
      else w.brains.delete(p.id);
      return null;
    }
    case 'autosell': { const r = msg.r | 0; if (r < -1 || r > 2) return null; pr.opts = { ...(pr.opts ?? { autoSell: -1 }), autoSell: r }; p.questVer++; return null; }
  }
  return null;
}

const BAD = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '존나', 'fuck', 'shit', 'bitch', '니애미', '느금'];
export function cleanText(s: string, max: number): string {
  let t = s.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  for (const b of BAD) t = t.split(b).join('♡'.repeat(Math.min(3, b.length)));
  return t;
}
export function cleanName(s: unknown): string {
  const t = cleanText(typeof s === 'string' ? s : '', NAME_MAX).replace(/[^\p{L}\p{N}_\- ]/gu, '').trim();
  return t.includes('♡') || t.length < 1 ? '' : t;
}
