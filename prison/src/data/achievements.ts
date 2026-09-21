export interface AchievementDef { id: string; name: string; icon: string; desc: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_prisoner', name: '첫 손님', icon: '🚌', desc: '첫 수감자를 받았다.' },
  { id: 'chapter3', name: '감방동 완공', icon: '🏗', desc: '3장을 달성했다.' },
  { id: 'chapter5', name: '복지 교도소', icon: '📺', desc: '5장을 달성했다.' },
  { id: 'chapter7', name: '명예 교도소장', icon: '🎖', desc: '모든 장을 달성했다.' },
  { id: 'prisoners_20', name: '만원사례', icon: '👥', desc: '수감자 20명을 동시에 수용했다.' },
  { id: 'prisoners_50', name: '대형 교도소', icon: '🏢', desc: '수감자 50명을 동시에 수용했다.' },
  { id: 'no_incident_7', name: '모범 교도소', icon: '🕊', desc: '7일 연속 탈주·사망 없음.' },
  { id: 'tunnel_found', name: '땅속의 비밀', icon: '🕳', desc: '수색으로 터널을 발견했다.' },
  { id: 'riot_end', name: '질서 회복', icon: '🛡', desc: '폭동을 진압했다.' },
  { id: 'released_10', name: '새 출발', icon: '🎉', desc: '형기 만료 출소 10명.' },
  { id: 'money_100k', name: '부자 소장', icon: '💰', desc: '자금 $100,000 달성.' },
  { id: 'mood_80', name: '천국 같은 감옥', icon: '😊', desc: '수감자 10명 이상일 때 평균 기분 80 이상.' },
  { id: 'grade_s', name: 'S등급', icon: '⭐', desc: '일일 성적 S등급을 받았다.' },
  { id: 'hard_chapter4', name: '철의 규율', icon: '🔥', desc: '어려움 난이도로 4장을 달성했다.' },
];
