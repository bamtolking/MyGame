import { MON_IDX } from './monsters.ts';

export interface ZoneDef {
  id: number; name: string; minLv: number; maxLv: number; safe: boolean;
  mobs: number[]; weights: number[]; boss: number; density: number;
  ground: string; ground2: string; mini: string; desc: string;
}
export const ZONES: ZoneDef[] = [
  { id: 0, name: '달빛 마을', minLv: 1, maxLv: 1, safe: true, mobs: [], weights: [], boss: -1, density: 0, ground: '#3a3d4f', ground2: '#454a60', mini: '#c9b98a', desc: '퇴마사들이 모이는 안전한 마을. 대장간·부적상·신당이 있다.' },
  { id: 1, name: '도깨비 숲', minLv: 1, maxLv: 8, safe: false, mobs: [MON_IDX.wisp, MON_IDX.imp, MON_IDX.clubber], weights: [5, 4, 1], boss: MON_IDX.boss_chief, density: 26, ground: '#1f3d2c', ground2: '#28503a', mini: '#3f8f5a', desc: '도깨비불이 떠도는 숲. 초보 퇴마사의 사냥터.' },
  { id: 2, name: '물안개 늪', minLv: 8, maxLv: 14, safe: false, mobs: [MON_IDX.toad, MON_IDX.drowned, MON_IDX.bogwisp], weights: [3, 4, 2], boss: MON_IDX.boss_imugi, density: 30, ground: '#233b3b', ground2: '#2b4a44', mini: '#3f8a86', desc: '안개 낀 늪. 물귀신과 이무기가 산다.' },
  { id: 3, name: '폐사찰', minLv: 14, maxLv: 20, safe: false, mobs: [MON_IDX.egg, MON_IDX.skeleton, MON_IDX.crow], weights: [4, 2, 2], boss: MON_IDX.boss_reaper, density: 32, ground: '#34323f', ground2: '#3f3b4c', mini: '#8c84a8', desc: '버려진 절. 저승의 문이 열려 있다.' },
  { id: 4, name: '구미호 골짜기', minLv: 20, maxLv: 29, safe: false, mobs: [MON_IDX.foxfire, MON_IDX.foxmage, MON_IDX.jangseung], weights: [4, 2, 1], boss: MON_IDX.boss_gumiho, density: 34, ground: '#3d2a24', ground2: '#4c342a', mini: '#c0703f', desc: '단풍이 불타는 골짜기. 구미호의 영역.' },
  { id: 5, name: '달맞이 제단', minLv: 1, maxLv: 30, safe: false, mobs: [], weights: [], boss: -1, density: 0, ground: '#3a2f2f', ground2: '#463838', mini: '#b0473f', desc: '핏빛 달이 뜨면 불가사리가 깨어나는 제단.' },
];
export const TOWN = 0, ALTAR = 5;
