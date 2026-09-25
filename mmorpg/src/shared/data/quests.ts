import type { TalKind, Rarity } from '../types.ts';
import { MON_IDX } from './monsters.ts';

export type QuestKind = 'kill' | 'killZone' | 'level' | 'boss' | 'equipCount' | 'merge' | 'enhance' | 'visit' | 'worldboss' | 'slots';
export interface QuestReward { gold?: number; xp?: number; item?: Rarity; tal?: TalKind | 'start'; shards?: number }
export interface QuestDef { title: string; desc: string; kind: QuestKind; target: number; n: number; reward: QuestReward; zone: number }

export const MAIN_QUESTS: QuestDef[] = [
  { title: '첫 퇴마', desc: '마을 밖 도깨비 숲에서 도깨비불을 퇴치하세요. 이동만 하면 공격은 자동입니다.', kind: 'kill', target: MON_IDX.wisp, n: 8, reward: { gold: 60, xp: 40 }, zone: 1 },
  { title: '숲의 소란', desc: '도깨비 숲의 요괴를 퇴치하세요.', kind: 'killZone', target: 1, n: 40, reward: { item: 1, xp: 60 }, zone: 1 },
  { title: '두 번째 부적', desc: '레벨 3을 달성하면 부적 칸이 하나 더 열립니다.', kind: 'level', target: 3, n: 1, reward: { tal: 'start' }, zone: 1 },
  { title: '부적 장착', desc: '부적 메뉴에서 받은 부적을 빈 칸에 장착하세요.', kind: 'slots', target: 2, n: 1, reward: { tal: 'start', gold: 80 }, zone: 1 },
  { title: '부적 합성', desc: '같은 부적 3장을 합치면 한 단계 강해집니다. 부적 메뉴에서 합성하세요.', kind: 'merge', target: 0, n: 1, reward: { tal: 'thunder' }, zone: 1 },
  { title: '장비 갖추기', desc: '무기·갑옷·노리개를 모두 착용하세요. 요괴가 떨어뜨립니다.', kind: 'equipCount', target: 3, n: 1, reward: { gold: 200, xp: 150 }, zone: 1 },
  { title: '금방망이 대장', desc: '도깨비 숲 깊은 곳의 대장 도깨비를 쓰러뜨리세요. 동료와 함께라면 더 쉽습니다.', kind: 'boss', target: MON_IDX.boss_chief, n: 1, reward: { item: 2, shards: 10 }, zone: 1 },
  { title: '안개 속으로', desc: '동남쪽 물안개 늪에 들어가세요.', kind: 'visit', target: 2, n: 1, reward: { gold: 250 }, zone: 2 },
  { title: '늪의 원혼', desc: '물안개 늪의 요괴를 퇴치하세요.', kind: 'killZone', target: 2, n: 90, reward: { item: 2, xp: 900 }, zone: 2 },
  { title: '핏빛 달', desc: '핏빛 달이 뜨면 달맞이 제단의 불가사리 토벌에 참여하세요.', kind: 'worldboss', target: 0, n: 1, reward: { shards: 30, item: 3 }, zone: 5 },
  { title: '늪의 이무기', desc: '늪 깊은 곳의 이무기를 쓰러뜨리세요.', kind: 'boss', target: MON_IDX.boss_imugi, n: 1, reward: { item: 3, shards: 15 }, zone: 2 },
  { title: '대장간 방문', desc: '마을 대장간에서 장비를 +3까지 강화하세요.', kind: 'enhance', target: 3, n: 1, reward: { gold: 600, tal: 'guard' }, zone: 0 },
  { title: '버려진 절', desc: '북쪽 폐사찰에 들어가세요.', kind: 'visit', target: 3, n: 1, reward: { gold: 500 }, zone: 3 },
  { title: '저승의 문', desc: '폐사찰의 요괴를 퇴치하세요.', kind: 'killZone', target: 3, n: 140, reward: { item: 3, xp: 4000 }, zone: 3 },
  { title: '검은 갓의 사자', desc: '폐사찰의 저승사자를 쓰러뜨리세요.', kind: 'boss', target: MON_IDX.boss_reaper, n: 1, reward: { item: 3, shards: 25 }, zone: 3 },
  { title: '불타는 골짜기', desc: '서북쪽 구미호 골짜기에 들어가세요.', kind: 'visit', target: 4, n: 1, reward: { gold: 1200 }, zone: 4 },
  { title: '여우 사냥', desc: '구미호 골짜기의 요괴를 퇴치하세요.', kind: 'killZone', target: 4, n: 180, reward: { item: 3, xp: 12000 }, zone: 4 },
  { title: '아홉 꼬리', desc: '골짜기 끝의 구미호를 쓰러뜨리세요.', kind: 'boss', target: MON_IDX.boss_gumiho, n: 1, reward: { item: 4, shards: 50 }, zone: 4 },
  { title: '달빛의 퇴마사', desc: '레벨 30을 달성하세요.', kind: 'level', target: 30, n: 1, reward: { item: 4, shards: 100 }, zone: 4 },
];
import { xpNeed } from './xp.ts';
export const BOUNTY_N = 250;
/** Repeatable bounty: ~1-2 minutes of hunting for a chunk of a level and a purse of gold. */
export function bountyReward(zone: number, level: number): { gold: number; xp: number } {
  return { gold: Math.round(120 * zone * (1 + level * 0.12)), xp: Math.round(xpNeed(level) * 0.1) };
}
