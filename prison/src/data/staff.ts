export type StaffType = 'guard' | 'cook' | 'workman' | 'doctor';
export interface StaffDef { id: StaffType; name: string; hireCost: number; wage: number; speed: number; hp: number; attack: number; color: string; desc: string }
export const STAFF: StaffDef[] = [
  { id: 'guard', name: '교도관', hireCost: 300, wage: 90, speed: 2.8, hp: 160, attack: 9, color: '#3f6fd8', desc: '순찰·진압·탈주 추격. 수감자 안전감을 높입니다. 수감자 5명당 1명 권장.' },
  { id: 'cook', name: '요리사', hireCost: 200, wage: 60, speed: 2.3, hp: 90, attack: 3, color: '#f5f5f5', desc: '주방 조리대에서 식사를 만듭니다. 시간당 8인분.' },
  { id: 'workman', name: '작업반', hireCost: 150, wage: 45, speed: 2.5, hp: 100, attack: 4, color: '#f9c74f', desc: '건설·철거를 실제로 수행합니다. 많을수록 빨리 짓습니다.' },
  { id: 'doctor', name: '의사', hireCost: 400, wage: 130, speed: 2.3, hp: 90, attack: 2, color: '#66d9a0', desc: '의무실에서 부상자를 치료합니다.' },
];
export const STAFF_BY_ID: Record<string, StaffDef> = Object.fromEntries(STAFF.map(s => [s.id, s]));
