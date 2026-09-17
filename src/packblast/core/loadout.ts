// 인접 판정과 지원 효과 → 전투에서 쓸 최종 장비 구성. 항상 현재 배치 전체에서 새로 계산한다(누적 없음).
import { EQUIPMENT, type EquipId, type Grade, type SupportType, type WeaponType, type HeatSpec, supportEffectText } from '../data/equipment';
import { BALANCE } from '../data/balance';
import { itemCells, cellIndex, type Item, type BagGrid } from './bag';

export interface Link {
  supportUid: string; supportId: EquipId; grade: Grade; type: SupportType;
  applied: boolean; reason?: string; text: string;
}

export interface WeaponConfig {
  uid: string; id: EquipId; grade: Grade; type: WeaponType;
  damage: number; interval: number; baseInterval: number; range: number;
  heat?: { max: number; perShot: number; coolRate: number; baseCoolRate: number; resumeAt: number };
  ammoEvery?: number;      // 원본 공격 N회마다 추가 탄 1회
  lensMul?: number;        // 연쇄 피해 배율
  arc: number; slashes: number; pellets: number; spread: number; width: number; pierce: number;
  radius: number; fragments: number; drones: number; projectileSpeed: number; flightTime: number; maxProjectiles: number;
  links: Link[];
}

export interface SupportInfo { uid: string; id: EquipId; grade: Grade; type: SupportType; linkedTo: string[]; blockedFrom: { uid: string; reason: string }[] }

export interface Loadout {
  weapons: WeaponConfig[];
  supports: SupportInfo[];
  shield: number;
  heal: number;
  shieldUids: string[];
  medkitUids: string[];
  /** uid → 인접 uid 목록 (가방 안 장비만) */
  adjacency: Record<string, string[]>;
}

/** 실제 점유 칸이 상하좌우로 한 변을 공유하는 장비 쌍. 같은 쌍은 한 번만. */
export function computeAdjacency(items: readonly Item[], size = BALANCE.bagSize): Record<string, string[]> {
  const occ = new Map<number, string>();
  const bag = items.filter(i => i.loc === 'bag');
  for (const it of bag) for (const [x, y] of itemCells(it)) occ.set(cellIndex(x, y, size), it.uid);
  const adj: Record<string, string[]> = {};
  for (const it of bag) adj[it.uid] = [];
  for (const it of bag) {
    for (const [x, y] of itemCells(it)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const o = occ.get(cellIndex(nx, ny, size));
        if (o && o !== it.uid && !adj[it.uid].includes(o)) adj[it.uid].push(o);
      }
    }
  }
  return adj;
}

export function areAdjacent(items: readonly Item[], a: string, b: string): boolean {
  const adj = computeAdjacency(items);
  return !!adj[a]?.includes(b);
}

const g = <T>(arr: readonly [T, T, T] | undefined, grade: Grade, def: T): T => (arr ? arr[grade - 1] : def);

export function computeLoadout(items: readonly Item[], grid?: BagGrid): Loadout {
  const size = grid?.size ?? BALANCE.bagSize;
  const bag = items.filter(i => i.loc === 'bag');
  const byUid = new Map(bag.map(i => [i.uid, i]));
  const adjacency = computeAdjacency(bag, size);
  const supports: SupportInfo[] = bag.filter(i => EQUIPMENT[i.id].support).map(i => ({ uid: i.uid, id: i.id, grade: i.grade, type: EQUIPMENT[i.id].support!.type, linkedTo: [], blockedFrom: [] }));
  const supByUid = new Map(supports.map(s => [s.uid, s]));
  const weapons: WeaponConfig[] = [];

  for (const it of bag) {
    const def = EQUIPMENT[it.id];
    const w = def.weapon; if (!w) continue;
    const gr = it.grade;
    const links: Link[] = [];
    // 인접한 지원 장비를 종류별로 모아 가장 강한 하나만 적용
    const best = new Map<SupportType, { uid: string; grade: Grade }>();
    const neighbors = [...(adjacency[it.uid] || [])].sort();
    for (const nu of neighbors) {
      const n = byUid.get(nu)!; const sdef = EQUIPMENT[n.id]; const sp = sdef.support; if (!sp) continue;
      if (!def.tags.includes(sp.appliesTo)) {
        links.push({ supportUid: nu, supportId: n.id, grade: n.grade, type: sp.type, applied: false, reason: `태그 불일치 (${sdef.name}는 ${tagName(sp.appliesTo)} 장비에만)`, text: supportEffectText(n.id, n.grade) });
        supByUid.get(nu)!.blockedFrom.push({ uid: it.uid, reason: '태그 불일치' });
        continue;
      }
      const cur = best.get(sp.type);
      if (!cur || n.grade > cur.grade) best.set(sp.type, { uid: nu, grade: n.grade });
    }
    for (const nu of neighbors) {
      const n = byUid.get(nu)!; const sp = EQUIPMENT[n.id].support; if (!sp || !def.tags.includes(sp.appliesTo)) continue;
      const b = best.get(sp.type)!;
      const applied = b.uid === nu;
      links.push({ supportUid: nu, supportId: n.id, grade: n.grade, type: sp.type, applied, reason: applied ? undefined : '같은 종류 지원은 가장 강한 하나만 적용', text: supportEffectText(n.id, n.grade) });
      if (applied) supByUid.get(nu)!.linkedTo.push(it.uid); else supByUid.get(nu)!.blockedFrom.push({ uid: it.uid, reason: '더 강한 같은 종류 지원이 적용됨' });
    }
    const baseInterval = w.interval[gr - 1];
    let interval = baseInterval;
    const bat = best.get('battery'); if (bat) interval = baseInterval * EQUIPMENT.battery.support!.value[bat.grade - 1];
    let heat: WeaponConfig['heat'];
    if (w.heat) {
      const h: HeatSpec = w.heat[gr - 1];
      const cool = best.get('cooler');
      const coolRate = h.coolRate * (cool ? EQUIPMENT.cooler.support!.value[cool.grade - 1] : 1);
      heat = { max: h.max, perShot: h.perShot, coolRate, baseCoolRate: h.coolRate, resumeAt: h.resumeAt };
    }
    const ammo = best.get('ammo');
    const lens = best.get('lens');
    weapons.push({
      uid: it.uid, id: it.id, grade: gr, type: w.type,
      damage: w.damage[gr - 1], interval, baseInterval, range: w.range, heat,
      ammoEvery: ammo ? EQUIPMENT.ammo.support!.value[ammo.grade - 1] : undefined,
      lensMul: lens ? EQUIPMENT.lens.support!.value[lens.grade - 1] : undefined,
      arc: g(w.arc, gr, 0), slashes: g(w.slashes, gr, 1), pellets: g(w.pellets, gr, 0), spread: g(w.spread, gr, 0),
      width: g(w.width, gr, 0), pierce: g(w.pierce, gr, 1), radius: g(w.radius, gr, 0), fragments: g(w.fragments, gr, 0), drones: g(w.drones, gr, 0),
      projectileSpeed: w.projectileSpeed ?? 0, flightTime: w.flightTime ?? 0, maxProjectiles: w.maxProjectiles,
      links,
    });
  }
  // 지원 장비끼리 또는 생존 장비에 붙은 지원: 대상 아님 표기
  for (const s of supports) for (const nu of adjacency[s.uid] || []) { const n = byUid.get(nu)!; if (!EQUIPMENT[n.id].weapon) s.blockedFrom.push({ uid: nu, reason: '지원 대상 아님' }); }

  let shield = 0, heal = 0; const shieldUids: string[] = [], medkitUids: string[] = [];
  for (const it of bag) {
    const d = EQUIPMENT[it.id];
    if (d.shield) { shield += d.shield[it.grade - 1]; shieldUids.push(it.uid); }
    if (d.heal) { heal += d.heal[it.grade - 1]; medkitUids.push(it.uid); }
  }
  weapons.sort((a, b) => (a.uid < b.uid ? -1 : 1));
  return { weapons, supports, shield, heal, shieldUids, medkitUids, adjacency };
}

function tagName(t: string): string { return ({ machine: '기계', ballistic: '탄도', energy: '에너지', overheat: '과열' } as Record<string, string>)[t] || t; }

/** 무기 하나의 계산 가능한 수치를 표시용 문장으로 (검증하지 않은 전투력 수치는 만들지 않는다). */
export function weaponStatLines(w: WeaponConfig): string[] {
  const lines: string[] = [];
  const perSec = (1 / w.interval).toFixed(2);
  lines.push(`공격 간격 ${w.interval.toFixed(2)}초 (${perSec}회/초)${w.interval !== w.baseInterval ? ` · 기본 ${w.baseInterval.toFixed(2)}초` : ''}`);
  lines.push(`피해 ${w.damage}${w.type === 'shotgun' ? ` × 탄환 ${w.pellets}발` : w.type === 'drone' ? ` · 드론 ${w.drones}기` : w.type === 'melee' ? ` · 부채꼴 ${w.arc}°${w.slashes > 1 ? ` · ${w.slashes}연속` : ''}` : w.type === 'laser' ? ` · 관통 ${w.pierce >= 99 ? '무제한' : w.pierce + '체'}` : w.type === 'bomb' ? ` · 반경 ${w.radius}` : ''}`);
  if (w.heat) {
    const perSecHeat = w.heat.perShot / w.interval;
    const net = perSecHeat - w.heat.coolRate;
    const timeToOverheat = net > 0 ? (w.heat.max / net) : Infinity;
    const cooldown = (w.heat.max * (1 - w.heat.resumeAt)) / w.heat.coolRate;
    lines.push(`열: 발사당 +${w.heat.perShot} · 방출 ${w.heat.coolRate.toFixed(0)}/초${w.heat.coolRate !== w.heat.baseCoolRate ? ` (기본 ${w.heat.baseCoolRate})` : ''}`);
    lines.push(net > 0 ? `연속 발사 약 ${timeToOverheat.toFixed(1)}초 후 과열 → ${cooldown.toFixed(1)}초 정지` : '연속 발사해도 과열되지 않음');
  }
  if (w.ammoEvery) lines.push(`탄약상자: ${w.ammoEvery}발마다 추가 탄`);
  if (w.lensMul) lines.push(`공명 렌즈: 적중 시 다른 적 1명에게 ${Math.round(w.lensMul * 100)}% 연쇄`);
  return lines;
}
