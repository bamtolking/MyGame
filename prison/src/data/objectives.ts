// Progression chapters. Each condition is evaluated by sim/objectives.ts against the state.
export type CondId =
  | 'room_valid' | 'staff_count' | 'prisoners' | 'objects_built' | 'days_no_escape' | 'mood_avg_days' | 'released' | 'cells_valid' | 'work_income';
export interface Cond { id: CondId; arg?: string; n: number; text: string }
export interface Chapter { title: string; story: string; reward: number; conds: Cond[]; unlock?: string[] }
export const CHAPTERS: Chapter[] = [
  {
    title: '1장. 기초 공사', story: '빈 부지에 첫 교도소를 세웁니다. 수감자가 오기 전에 밀폐된 대기실과 교도관이 필요합니다.', reward: 2500,
    conds: [
      { id: 'room_valid', arg: 'holding', n: 1, text: '유효한 대기실 1개 (벽으로 밀폐, 변기 1, 벤치 2, 12칸 이상)' },
      { id: 'staff_count', arg: 'guard', n: 1, text: '교도관 1명 이상 고용' },
      { id: 'staff_count', arg: 'workman', n: 2, text: '작업반 2명 이상' },
    ],
  },
  {
    title: '2장. 첫 수감자', story: '수감자를 받고 먹여야 합니다. 주방과 식당이 없으면 배고픔이 분노로 바뀝니다.', reward: 3500,
    conds: [
      { id: 'room_valid', arg: 'kitchen', n: 1, text: '유효한 주방 1개 (조리대, 냉장고)' },
      { id: 'room_valid', arg: 'canteen', n: 1, text: '유효한 식당 1개 (배식대, 식탁 2)' },
      { id: 'staff_count', arg: 'cook', n: 1, text: '요리사 1명 이상' },
      { id: 'prisoners', n: 4, text: '수감자 4명 이상 수용' },
    ],
  },
  {
    title: '3장. 감방동', story: '대기실은 임시일 뿐입니다. 개인 감방, 샤워실, 운동장을 갖춘 정상적인 교도소를 만드세요.', reward: 4500,
    conds: [
      { id: 'cells_valid', n: 8, text: '유효한 감방 8개' },
      { id: 'room_valid', arg: 'shower', n: 1, text: '유효한 샤워실 1개' },
      { id: 'room_valid', arg: 'yard', n: 1, text: '유효한 운동장 1개 (울타리로 밀폐)' },
      { id: 'prisoners', n: 10, text: '수감자 10명 이상' },
    ],
  },
  {
    title: '4장. 질서', story: '탈주 없이 며칠을 버티세요. 보안 보기(🔒)로 외부와 이어진 취약 구역을 확인할 수 있습니다.', reward: 5500,
    conds: [
      { id: 'days_no_escape', n: 3, text: '3일 연속 탈주·사망 없음' },
      { id: 'staff_count', arg: 'guard', n: 4, text: '교도관 4명 이상' },
      { id: 'prisoners', n: 14, text: '수감자 14명 이상' },
    ],
    unlock: ['max'],
  },
  {
    title: '5장. 복지와 노동', story: '만족한 수감자는 사고를 덜 칩니다. 휴게실·의무실·작업장으로 기분과 수입을 함께 올리세요.', reward: 7000,
    conds: [
      { id: 'room_valid', arg: 'common', n: 1, text: '유효한 휴게실 1개' },
      { id: 'room_valid', arg: 'infirmary', n: 1, text: '유효한 의무실 1개' },
      { id: 'staff_count', arg: 'doctor', n: 1, text: '의사 1명 이상' },
      { id: 'room_valid', arg: 'workshop', n: 1, text: '유효한 작업장 1개' },
      { id: 'work_income', n: 1000, text: '노동 수입 누계 $1,000' },
    ],
  },
  {
    title: '6장. 대형 교도소', story: '규모를 키우면서도 평균 기분을 유지해야 합니다. 일과표(📋)를 조정해 보세요.', reward: 9000,
    conds: [
      { id: 'prisoners', n: 30, text: '수감자 30명 이상' },
      { id: 'mood_avg_days', n: 1, text: '평균 기분 55 이상으로 하루 유지' },
      { id: 'released', n: 5, text: '형기 만료 출소 5명' },
    ],
  },
  {
    title: '7장. 명예 교도소장', story: '마지막 시험입니다. 큰 교도소를 일주일간 사고 없이 운영하세요.', reward: 15000,
    conds: [
      { id: 'prisoners', n: 45, text: '수감자 45명 이상' },
      { id: 'days_no_escape', n: 5, text: '5일 연속 탈주·사망 없음' },
      { id: 'cells_valid', n: 40, text: '유효한 감방 40개' },
    ],
  },
];
