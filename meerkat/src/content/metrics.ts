import type { MetricResult } from '../analysis/analyze';
import type { MetricId } from '../analysis/norms';
import { lang, num, type Text } from '../i18n';

export interface MetricInfo {
  name: Text;
  /** 측정 방법 설명 */
  how: Text;
  /** 왜 중요한가 */
  why: Text;
}

export const METRIC_INFO: Record<MetricId, MetricInfo> = {
  headForward: {
    name: { ko: '거북목 (머리 전방 각도)', en: 'Forward head angle' },
    how: { ko: '옆모습에서 어깨 관절과 귀를 잇는 선이 수직선에서 앞으로 기운 각도예요.', en: 'Angle between vertical and the line from shoulder joint to ear, seen from the side.' },
    why: { ko: '머리가 앞으로 나올수록 목과 어깨 근육이 버텨야 하는 무게가 커져요.', en: 'The further your head drifts forward, the more load your neck and shoulders carry.' },
  },
  shoulderForward: {
    name: { ko: '라운드숄더 (어깨 전방 거리)', en: 'Rounded shoulders' },
    how: { ko: '옆모습에서 어깨 관절이 고관절보다 앞으로 나온 거리예요.', en: 'How far the shoulder joint sits in front of the hip joint, seen from the side.' },
    why: { ko: '어깨가 말리면 가슴이 좁아지고 어깨 충돌·등 통증이 생기기 쉬워요.', en: 'Rolled shoulders narrow the chest and raise the risk of shoulder impingement and upper-back pain.' },
  },
  pelvisForward: {
    name: { ko: '골반 앞쏠림', en: 'Pelvis drift' },
    how: { ko: '복사뼈 약간 앞을 지나는 기준 수직선보다 고관절이 앞/뒤로 벗어난 거리예요.', en: 'How far the hip joint sits in front of or behind a plumb line just ahead of the ankle.' },
    why: { ko: '골반이 앞으로 밀리면 허리 아래쪽과 무릎 뒤쪽에 부담이 몰려요.', en: 'A forward pelvis loads the lower back and the back of the knees.' },
  },
  kneeExtension: {
    name: { ko: '무릎 정렬 (옆)', en: 'Knee lock (side)' },
    how: { ko: '옆모습에서 고관절-무릎-발목이 이루는 각도예요. 뒤로 꺾이면 과신전이에요.', en: 'Hip-knee-ankle angle from the side. Bending backwards means hyperextension.' },
    why: { ko: '무릎을 잠그고 서면 관절 뒤쪽 인대와 허리에 부담이 가요.', en: 'Standing with locked knees strains the back of the joint and the lower back.' },
  },
  kyphosis: {
    name: { ko: '등 굽음 지수', en: 'Upper-back curve' },
    how: { ko: 'AI가 찾은 몸 윤곽선에서 목 뒤~등 중간까지의 휘어진 깊이를 길이로 나눈 값(가상 플렉시커브)이에요.', en: 'Depth of the upper-back curve divided by its length along the body outline (a “virtual flexicurve”).' },
    why: { ko: '13~14 이상이면 등이 둥글게 굽은 경향이 있어요. 옷이 헐렁하면 크게 나올 수 있어요.', en: 'Values above ~13–14 suggest a rounded upper back. Loose clothes can inflate it.' },
  },
  lordosis: {
    name: { ko: '허리 곡선 지수', en: 'Lower-back curve' },
    how: { ko: '몸 윤곽선에서 허리가 안쪽으로 휜 깊이를 길이로 나눈 값이에요.', en: 'Depth of the lower-back curve divided by its length along the body outline.' },
    why: { ko: '너무 크면 골반 전방경사(오리궁둥이), 너무 작으면 일자 허리 경향이에요.', en: 'High values suggest an anterior pelvic tilt; very low values a flat back.' },
  },
  headTilt: {
    name: { ko: '머리 기울기', en: 'Head tilt' },
    how: { ko: '정면에서 양쪽 귀(또는 눈)를 잇는 선의 기울기예요.', en: 'Tilt of the line between the ears (or eyes), seen from the front.' },
    why: { ko: '한쪽으로 기울면 목 옆 근육이 비대칭으로 긴장해요.', en: 'A tilted head keeps the side-neck muscles unevenly tense.' },
  },
  shoulderTilt: {
    name: { ko: '어깨 높이 차이', en: 'Shoulder height' },
    how: { ko: '정면에서 양쪽 어깨 관절을 잇는 선의 기울기예요.', en: 'Tilt of the line between the shoulder joints, seen from the front.' },
    why: { ko: '높은 쪽 어깨 위 근육(상부 승모근)이 뭉쳐 있는 경우가 많아요.', en: 'The higher side often has a tight upper trapezius.' },
  },
  pelvicTilt: {
    name: { ko: '골반 높이 차이', en: 'Pelvic height' },
    how: { ko: '정면에서 양쪽 고관절을 잇는 선의 기울기예요.', en: 'Tilt of the line between the hip joints, seen from the front.' },
    why: { ko: '짝다리·다리 꼬기 습관과 관련이 많고 허리 한쪽에 부담을 줘요.', en: 'Often linked to leaning on one leg or crossing legs; loads one side of the low back.' },
  },
  headShift: {
    name: { ko: '머리 좌우 치우침', en: 'Head shift' },
    how: { ko: '어깨 중앙에서 머리 중심이 옆으로 벗어난 정도예요.', en: 'How far the head centre sits off the middle of the shoulders.' },
    why: { ko: '목 옆 근육이 한쪽만 계속 일하게 돼요.', en: 'It makes one side of the neck work all day.' },
  },
  trunkShift: {
    name: { ko: '몸통 좌우 치우침', en: 'Trunk shift' },
    how: { ko: '골반 중앙에서 어깨 중앙이 옆으로 벗어난 정도예요.', en: 'How far the shoulder centre sits off the pelvis centre.' },
    why: { ko: '한쪽 허리·옆구리 근육이 짧아지고 반대쪽이 늘어나요.', en: 'One side of the waist shortens while the other lengthens.' },
  },
  pelvicShift: {
    name: { ko: '체중 쏠림 (짝다리)', en: 'Weight shift' },
    how: { ko: '두 발 가운데에서 골반 중심이 옆으로 벗어난 정도예요.', en: 'How far the pelvis centre sits off the midpoint between your feet.' },
    why: { ko: '한쪽 다리에 체중을 싣는 습관이 있으면 커져요.', en: 'Grows with a habit of standing on one leg.' },
  },
  kneeAlign: {
    name: { ko: '무릎 정렬 (X·O다리)', en: 'Knee alignment (X/O legs)' },
    how: { ko: '정면에서 고관절-무릎-발목이 일직선에서 벗어난 각도예요. +는 안쪽(X), −는 바깥쪽(O)이에요.', en: 'Deviation of hip-knee-ankle from a straight line. + is inward (knock-knee), − is outward (bow-leg).' },
    why: { ko: '무릎 연골·인대에 한쪽으로 부담이 쏠리기 쉬워요.', en: 'It shifts load toward one side of the knee joint.' },
  },
};

const side = (left: boolean) => (lang.value === 'ko' ? (left ? '왼쪽' : '오른쪽') : left ? 'left' : 'right');

/** 측정값을 사람이 읽기 쉬운 문장으로 */
export function describeMetric(m: MetricResult): string {
  const ko = lang.value === 'ko';
  const v = m.value;
  const a = Math.abs(v);
  const cm = m.extra?.cm;
  switch (m.id) {
    case 'headForward':
      if (v <= 0) return ko ? '귀가 어깨 바로 위에 있어요' : 'Your ear sits right above your shoulder';
      return ko ? `귀가 어깨보다 약 ${num(Math.max(0, cm ?? 0), 1)}cm 앞에 있어요 (${num(a, 0)}°)` : `Ear about ${num(Math.max(0, cm ?? 0), 1)} cm in front of the shoulder (${num(a, 0)}°)`;
    case 'shoulderForward':
      return v >= 0
        ? ko ? `어깨가 고관절보다 ${num(a, 1)}cm 앞에 있어요` : `Shoulders ${num(a, 1)} cm in front of the hips`
        : ko ? `상체가 고관절보다 ${num(a, 1)}cm 뒤로 젖혀져 있어요` : `Upper body leans ${num(a, 1)} cm behind the hips`;
    case 'pelvisForward':
      return v >= 0
        ? ko ? `골반이 기준선보다 ${num(a, 1)}cm 앞으로 나와 있어요` : `Pelvis ${num(a, 1)} cm in front of the plumb line`
        : ko ? `골반이 기준선보다 ${num(a, 1)}cm 뒤에 있어요` : `Pelvis ${num(a, 1)} cm behind the plumb line`;
    case 'kneeExtension':
      return v >= 0
        ? ko ? `무릎이 ${num(a, 0)}° 뒤로 꺾여 있어요` : `Knees bend back ${num(a, 0)}°`
        : ko ? `무릎이 ${num(a, 0)}° 굽어 있어요` : `Knees bent ${num(a, 0)}°`;
    case 'kyphosis':
      return ko ? `등 굽음 지수 ${num(v, 1)} (13 이하 권장)` : `Upper-back index ${num(v, 1)} (≤13 is typical)`;
    case 'lordosis':
      return ko ? `허리 곡선 지수 ${num(v, 1)}` : `Lower-back index ${num(v, 1)}`;
    case 'headTilt':
      return a < 0.5 ? (ko ? '머리가 수평이에요' : 'Head is level') : ko ? `머리가 ${side(v > 0)}으로 ${num(a, 1)}° 기울어 있어요` : `Head tilts ${num(a, 1)}° to the ${side(v > 0)}`;
    case 'shoulderTilt':
      return a < 0.5 ? (ko ? '양쪽 어깨 높이가 같아요' : 'Shoulders are level') : ko ? `${side(v > 0)} 어깨가 ${num(cm ?? 0, 1)}cm 낮아요 (${num(a, 1)}°)` : `${side(v > 0)} shoulder ${num(cm ?? 0, 1)} cm lower (${num(a, 1)}°)`;
    case 'pelvicTilt':
      return a < 0.5 ? (ko ? '양쪽 골반 높이가 같아요' : 'Pelvis is level') : ko ? `${side(v > 0)} 골반이 ${num(cm ?? 0, 1)}cm 낮아요 (${num(a, 1)}°)` : `${side(v > 0)} hip ${num(cm ?? 0, 1)} cm lower (${num(a, 1)}°)`;
    case 'headShift':
      return ko ? `머리가 ${side(v > 0)}으로 ${num(cm ?? 0, 1)}cm 치우쳐 있어요` : `Head shifted ${num(cm ?? 0, 1)} cm to the ${side(v > 0)}`;
    case 'trunkShift':
      return ko ? `몸통이 ${side(v > 0)}으로 ${num(cm ?? 0, 1)}cm 치우쳐 있어요` : `Trunk shifted ${num(cm ?? 0, 1)} cm to the ${side(v > 0)}`;
    case 'pelvicShift':
      return ko ? `체중이 ${side(v > 0)} 다리 쪽으로 ${num(cm ?? 0, 1)}cm 쏠려 있어요` : `Weight shifted ${num(cm ?? 0, 1)} cm toward the ${side(v > 0)} leg`;
    case 'kneeAlign': {
      const l = m.extra?.left ?? 0, r = m.extra?.right ?? 0;
      if (m.level === 0) return ko ? `무릎이 곧게 정렬돼 있어요 (왼 ${num(l, 0)}° · 오 ${num(r, 0)}°)` : `Knees line up well (L ${num(l, 0)}° · R ${num(r, 0)}°)`;
      return v > 0
        ? ko ? `무릎이 안쪽으로 모이는 X다리 경향 (왼 ${num(l, 0)}° · 오 ${num(r, 0)}°)` : `Knock-knee tendency (L ${num(l, 0)}° · R ${num(r, 0)}°)`
        : ko ? `무릎이 벌어지는 O다리 경향 (왼 ${num(l, 0)}° · 오 ${num(r, 0)}°)` : `Bow-leg tendency (L ${num(l, 0)}° · R ${num(r, 0)}°)`;
    }
  }
}

/** 숫자 요약 (카드 오른쪽 값) */
export function metricValue(m: MetricResult): string {
  const a = Math.abs(m.value);
  switch (m.id) {
    case 'headForward':
    case 'headTilt':
    case 'shoulderTilt':
    case 'pelvicTilt':
    case 'kneeExtension':
    case 'kneeAlign':
      return `${num(a, 1)}°`;
    case 'shoulderForward':
    case 'pelvisForward':
      return `${num(a, 1)}cm`;
    case 'headShift':
    case 'trunkShift':
    case 'pelvicShift':
      return `${num(m.extra?.cm ?? 0, 1)}cm`;
    case 'kyphosis':
    case 'lordosis':
      return num(m.value, 1);
  }
}

/** 한국어 조사 선택: josa('거북', '이', '가') → '거북이' */
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return word + without;
  return word + ((last - 0xac00) % 28 ? withBatchim : without);
}
