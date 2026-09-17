// Placeable objects (1 tile each). Passable by everyone; "used" by standing on the tile.
export type ObjType = 'bed' | 'toilet' | 'bench' | 'table' | 'serving' | 'cooker' | 'fridge' | 'shower' | 'medbed' | 'tv' | 'bookshelf' | 'workbench' | 'desk' | 'weights';
export interface ObjDef { id: ObjType; name: string; cost: number; buildTime: number; icon: string; desc: string; rooms: string[] }
export const OBJECTS: ObjDef[] = [
  { id: 'bed', name: '침대', cost: 60, buildTime: 4, icon: '🛏', desc: '감방 필수. 수면 회복.', rooms: ['cell', 'holding'] },
  { id: 'toilet', name: '변기', cost: 40, buildTime: 3, icon: '🚽', desc: '감방·대기실 필수.', rooms: ['cell', 'holding', 'solitary'] },
  { id: 'bench', name: '벤치', cost: 30, buildTime: 2, icon: '🪑', desc: '대기실·운동장·휴게실 좌석. 여가 소폭 회복.', rooms: ['holding', 'yard', 'common'] },
  { id: 'table', name: '식탁', cost: 45, buildTime: 3, icon: '🍽', desc: '식당 좌석(2명).', rooms: ['canteen'] },
  { id: 'serving', name: '배식대', cost: 90, buildTime: 4, icon: '🥘', desc: '식당 필수. 식사가 여기서 나갑니다.', rooms: ['canteen'] },
  { id: 'cooker', name: '조리대', cost: 220, buildTime: 6, icon: '🍳', desc: '주방 필수. 요리사 1명당 1대.', rooms: ['kitchen'] },
  { id: 'fridge', name: '냉장고', cost: 160, buildTime: 5, icon: '🧊', desc: '주방 필수. 식재료 보관.', rooms: ['kitchen'] },
  { id: 'shower', name: '샤워기', cost: 55, buildTime: 3, icon: '🚿', desc: '샤워실 필수. 1개당 1명.', rooms: ['shower'] },
  { id: 'medbed', name: '의료침대', cost: 170, buildTime: 5, icon: '🩺', desc: '의무실 필수. 부상자 치료.', rooms: ['infirmary'] },
  { id: 'tv', name: 'TV', cost: 140, buildTime: 3, icon: '📺', desc: '휴게실 필수. 여가 회복.', rooms: ['common'] },
  { id: 'bookshelf', name: '책장', cost: 80, buildTime: 3, icon: '📚', desc: '여가 회복(휴게실).', rooms: ['common'] },
  { id: 'workbench', name: '작업대', cost: 260, buildTime: 7, icon: '🔧', desc: '작업장 필수. 1대당 2명 노동, 시간당 $14/명.', rooms: ['workshop'] },
  { id: 'desk', name: '책상', cost: 110, buildTime: 4, icon: '🖥', desc: '사무실 필수.', rooms: ['office'] },
  { id: 'weights', name: '역기', cost: 70, buildTime: 3, icon: '🏋', desc: '운동장. 운동 회복 가속.', rooms: ['yard'] },
];
export const OBJ_BY_ID: Record<string, ObjDef> = Object.fromEntries(OBJECTS.map(o => [o.id, o]));
