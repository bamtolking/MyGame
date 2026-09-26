// Companions (짝꿍): one slot, one passive each. No combo bonuses (so no pairing is ever forced).
export type CompanionEffect =
  | { kind: 'pickPad'; px: number }                  // pickups are collected this much further out
  | { kind: 'honeyDrop'; every: number }             // drops a 꿀물 한 방울 on a safe run-line cell ahead
  | { kind: 'pitGuard'; count: number };             // the first N pits of a run cost no warmth (bounce still happens)

export type CompanionUnlock = { kind: 'start' } | { kind: 'stage'; id: string } | { kind: 'coins'; cost: number };

export interface CompanionDef {
  id: string; name: string; desc: string;
  effect: CompanionEffect; unlock: CompanionUnlock;
  color: string;
}

export const COMPANIONS: CompanionDef[] = [
  { id: 'firefly', name: '반딧불 반짝이', desc: '별사탕을 더 멀리서도 먹어요 (획득 판정 +60)', effect: { kind: 'pickPad', px: 60 }, unlock: { kind: 'start' }, color: '#fff27a' },
  { id: 'magpie', name: '까치 깍순이', desc: '25초마다 앞길에 꿀물 한 방울(+8)을 떨어뜨려요', effect: { kind: 'honeyDrop', every: 25 }, unlock: { kind: 'stage', id: '1-3' }, color: '#2b2b3a' },
  { id: 'haetae', name: '아기 해태 해돌이', desc: '한 판에 처음 두 번은 구덩이에 빠져도 식지 않아요', effect: { kind: 'pitGuard', count: 2 }, unlock: { kind: 'coins', cost: 3500 }, color: '#f2c14e' },
];
export const COMPANION_BY_ID: Record<string, CompanionDef> = Object.fromEntries(COMPANIONS.map(c => [c.id, c]));
