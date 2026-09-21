// Random daily events with choices. Effects are applied in sim/events.ts.
export interface EventChoiceDef { label: string; hint: string }
export interface EventDef { id: string; title: string; icon: string; text: string; choices: EventChoiceDef[] }
export const EVENTS: EventDef[] = [
  { id: 'inspection', title: '정부 검열', icon: '📋', text: '법무부 검열관이 예고 없이 방문했습니다. 수감자 위생과 시설 상태를 점검하겠다고 합니다.', choices: [
    { label: '검열 받기', hint: '평균 위생 50 이하면 벌금 $600·평판 -3, 아니면 보조금 $500·평판 +3' },
    { label: '접대비 $400', hint: '검열을 형식적으로 끝냅니다. 30% 확률로 적발되어 벌금 $1,500·평판 -8' }] },
  { id: 'celebrity', title: '유명 수감자 이송', icon: '📰', text: '악명 높은 조직 두목의 이송 요청이 왔습니다. 정부는 특별 보조금을 약속하지만, 그는 다른 수감자들을 선동합니다.', choices: [
    { label: '수락 (+$2,500)', hint: '최고 보안·리더·폭력 성향 수감자 1명 도착' },
    { label: '거절', hint: '변화 없음' }] },
  { id: 'donation', title: '독지가의 후원', icon: '💝', text: '교도소 운영 평판을 들은 독지가가 후원금을 보내왔습니다.', choices: [{ label: '감사히 받기 (+$1,500)', hint: '' }] },
  { id: 'strike', title: '교도관 급여 인상 요구', icon: '✊', text: '교도관들이 위험 수당을 요구합니다. 거절하면 일부가 사직하겠다고 합니다.', choices: [
    { label: '수락', hint: '앞으로 모든 급여 +15%' },
    { label: '거절', hint: '교도관 2명 사직, 나머지 교도관 사기 저하(수감자 불안 +10)' }] },
  { id: 'storm', title: '폭우', icon: '🌧', text: '하루 종일 폭우가 쏟아집니다. 운동장이 진흙탕이 되었습니다.', choices: [
    { label: '운동장 폐쇄', hint: '오늘 운동장 사용 불가(운동 시간은 자유 시간으로), 위생 유지' },
    { label: '그대로 운영', hint: '수감자 위생 +15, 여가 -10(빗속 놀이), 부상 위험 소폭' }] },
  { id: 'foodpoison', title: '식중독', icon: '🤢', text: '값싼 식재료에서 문제가 생겼습니다. 여러 수감자가 복통을 호소합니다.', choices: [
    { label: '의무실 치료', hint: '수감자 20%가 경미한 부상(의무실 필요), 식사 재고 폐기' },
    { label: '방치', hint: '수감자 전원 기분 저하(배고픔 +30, 불안 +15), 평판 -2' }] },
  { id: 'contraband', title: '밀반입 제보', icon: '🔦', text: '한 수감자가 밀반입품과 땅 파는 소리에 대해 제보했습니다.', choices: [
    { label: '즉시 전체 수색', hint: '지금 감방 수색(대기 시간 무시)' },
    { label: '무시', hint: '수감자 2명 분노 +30' }] },
  { id: 'parole', title: '가석방 심사', icon: '⚖', text: '가석방 심사 위원회가 모범 수감자 2명의 조기 석방을 제안합니다.', choices: [
    { label: '승인', hint: '기분 좋은 수감자 2명 즉시 출소(+$300씩, 평판 +2)' },
    { label: '거절', hint: '변화 없음' }] },
  { id: 'journalist', title: '기자 방문', icon: '📷', text: '언론사가 교도소 내부 취재를 요청했습니다.', choices: [
    { label: '취재 허용', hint: '평균 기분 60 이상이면 평판 +5, 아니면 평판 -4' },
    { label: '거절', hint: '변화 없음' }] },
  { id: 'blackout', title: '정전', icon: '🔌', text: '변전소 사고로 밤새 전기가 끊깁니다. 어둠 속에서 감시가 어렵습니다.', choices: [
    { label: '비상 발전기 가동 ($800)', hint: '영향 없음' },
    { label: '버티기', hint: '오늘 밤 터널 굴착 속도 3배, 수감자 불안 +10' }] },
];
export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map(e => [e.id, e]));
