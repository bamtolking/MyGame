// Room (zone) definitions. Index in ZONES is stored in the zone grid (0 = none).
export type ZoneId = 'none' | 'cell' | 'holding' | 'canteen' | 'kitchen' | 'yard' | 'shower' | 'infirmary' | 'common' | 'workshop' | 'solitary' | 'office';
export interface RoomDef {
  id: ZoneId; name: string; color: string; floor: string; outdoor: boolean; minTiles: number;
  /** object type → minimum count */
  needs: Record<string, number>;
  desc: string;
}
export const ROOMS: RoomDef[] = [
  { id: 'none', name: '없음', color: '#000', floor: '', outdoor: true, minTiles: 0, needs: {}, desc: '구역 해제' },
  { id: 'cell', name: '감방', color: '#5c6bc0', floor: '#3b4278', outdoor: false, minTiles: 4, needs: { bed: 1, toilet: 1 }, desc: '수감자 1명의 방. 침대+변기, 4칸 이상, 밀폐 필요.' },
  { id: 'holding', name: '대기실', color: '#8d6e63', floor: '#5d4a44', outdoor: false, minTiles: 12, needs: { toilet: 1, bench: 2 }, desc: '감방이 없는 수감자가 머무는 큰 방. 변기 1, 벤치 2, 12칸 이상.' },
  { id: 'canteen', name: '식당', color: '#ffb74d', floor: '#7a5a2c', outdoor: false, minTiles: 16, needs: { serving: 1, table: 2 }, desc: '식사 장소. 배식대 1, 식탁 2 이상. 식탁 1개당 2명 착석.' },
  { id: 'kitchen', name: '주방', color: '#ef5350', floor: '#6b3a3a', outdoor: false, minTiles: 6, needs: { cooker: 1, fridge: 1 }, desc: '요리사가 식사를 만듭니다. 조리대 1, 냉장고 1.' },
  { id: 'yard', name: '운동장', color: '#66bb6a', floor: '#3f6b3b', outdoor: true, minTiles: 16, needs: {}, desc: '야외 운동·자유 시간. 울타리로 둘러싸면 됩니다. 벤치가 있으면 여가도 회복.' },
  { id: 'shower', name: '샤워실', color: '#4fc3f7', floor: '#2f5f74', outdoor: false, minTiles: 4, needs: { shower: 1 }, desc: '위생 회복. 샤워기 1개당 1명.' },
  { id: 'infirmary', name: '의무실', color: '#f8bbd0', floor: '#7a4c62', outdoor: false, minTiles: 6, needs: { medbed: 1 }, desc: '부상자 치료. 의료침대 필요, 의사가 있으면 빠르게 회복.' },
  { id: 'common', name: '휴게실', color: '#ba68c8', floor: '#5b3d6b', outdoor: false, minTiles: 9, needs: { tv: 1 }, desc: '여가 회복. TV 1, 책장·벤치가 있으면 더 좋음.' },
  { id: 'workshop', name: '작업장', color: '#a1887f', floor: '#5a4a3a', outdoor: false, minTiles: 12, needs: { workbench: 1 }, desc: '노동 시간에 수입 발생. 작업대 1개당 2명.' },
  { id: 'solitary', name: '독방', color: '#455a64', floor: '#2a3238', outdoor: false, minTiles: 1, needs: {}, desc: '징벌용 1칸 방. 제압된 수감자가 갇힙니다.' },
  { id: 'office', name: '사무실', color: '#fff176', floor: '#6b6438', outdoor: false, minTiles: 6, needs: { desk: 1 }, desc: '행정 사무실. 유효하면 매일 보조금 +10%.' },
];
export const ZONE_INDEX: Record<ZoneId, number> = Object.fromEntries(ROOMS.map((r, i) => [r.id, i])) as Record<ZoneId, number>;
export const roomDef = (idx: number): RoomDef => ROOMS[idx] || ROOMS[0];
