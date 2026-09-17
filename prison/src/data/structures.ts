// Structural tiles built by workmen.
export type StructType = 'wall' | 'fence' | 'door' | 'jaildoor';
export interface StructDef { id: StructType; name: string; cost: number; buildTime: number; blocks: boolean; desc: string }
export const STRUCTS: StructDef[] = [
  { id: 'wall', name: '벽', cost: 12, buildTime: 2.5, blocks: true, desc: '누구도 통과 못 함. 드래그하면 테두리만 그립니다.' },
  { id: 'fence', name: '울타리', cost: 4, buildTime: 1.2, blocks: true, desc: '싼 야외 경계. 벽과 같이 막습니다.' },
  { id: 'door', name: '일반 문', cost: 50, buildTime: 3, blocks: false, desc: '누구나 통과. 탈주자도 통과하므로 외벽엔 쓰지 마세요.' },
  { id: 'jaildoor', name: '감옥문', cost: 160, buildTime: 4, blocks: false, desc: '직원과 질서 있는 이동만 통과. 탈주·폭동 수감자는 못 넘음.' },
];
export const STRUCT_INDEX: Record<StructType, number> = { wall: 1, fence: 2, door: 3, jaildoor: 4 };
export const STRUCT_BY_INDEX: (StructDef | null)[] = [null, ...STRUCTS];
export const DEMOLISH_TIME = 1.0;
export const DEMOLISH_REFUND = 0.5;
