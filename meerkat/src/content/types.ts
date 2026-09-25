import type { AnimalId } from '../analysis/report';
import type { Text } from '../i18n';
import { josa } from './metrics';

export interface AnimalType {
  id: AnimalId;
  short: Text;
  /** 유형 이름 (공유 카드 제목) */
  name: Text;
  emoji: string;
  color: string;
  soft: string;
  /** 한 줄 요약 */
  tagline: Text;
  /** 어떤 모습인지 */
  looks: Text;
  /** 흔한 원인 */
  causes: Text[];
  /** 생길 수 있는 불편 */
  symptoms: Text[];
  /** 짧아지고 뭉치기 쉬운 근육 */
  tight: Text[];
  /** 약해지기 쉬운 근육 */
  weak: Text[];
  /** 전문가 한마디 */
  proTip: Text;
  /** 전문 용어 */
  clinical: Text;
}

export const ANIMALS: Record<AnimalId, AnimalType> = {
  turtle: {
    id: 'turtle',
    short: { ko: '거북', en: 'Turtle' },
    name: { ko: '모니터 속으로 빨려 드는 거북이형', en: 'The Screen-Sucked Turtle' },
    emoji: '🐢',
    color: '#4f9e4c',
    soft: '#eaf6e4',
    tagline: { ko: '머리가 어깨보다 앞으로 쭉 나와 있어요', en: 'Your head sits well in front of your shoulders' },
    looks: {
      ko: '옆에서 보면 귀가 어깨선보다 앞에 있고, 턱이 들리면서 뒷목이 눌려 있는 자세예요. 흔히 말하는 거북목·일자목이 여기에 해당해요.',
      en: 'From the side your ear sits in front of your shoulder, your chin pokes forward and the back of your neck gets compressed — classic "tech neck".',
    },
    causes: [
      { ko: '하루 대부분을 모니터·스마트폰을 보며 보냄', en: 'Long hours looking at screens and phones' },
      { ko: '낮은 모니터, 노트북 위주 작업', en: 'Low monitor or laptop-only work' },
      { ko: '피곤할 때 턱을 앞으로 내미는 습관', en: 'Poking the chin forward when tired' },
    ],
    symptoms: [
      { ko: '뒷목·어깨 뻐근함, 담 결림', en: 'Stiff neck and shoulders' },
      { ko: '긴장성 두통, 눈 피로', en: 'Tension headaches and eye strain' },
      { ko: '팔 저림(심해질 경우)', en: 'Tingling arms (in more severe cases)' },
    ],
    tight: [
      { ko: '후두하근(뒤통수 아래)', en: 'Suboccipitals' },
      { ko: '흉쇄유돌근', en: 'Sternocleidomastoid (SCM)' },
      { ko: '상부 승모근 · 견갑거근', en: 'Upper trapezius & levator scapulae' },
    ],
    weak: [
      { ko: '심부 목굽힘근(턱을 당기는 근육)', en: 'Deep neck flexors' },
      { ko: '중·하부 승모근', en: 'Middle & lower trapezius' },
    ],
    proTip: {
      ko: '고개를 15°만 숙여도 목이 받는 부담은 약 12kg, 60°면 약 27kg까지 커져요(Hansraj, 2014). 턱 당기기를 하루 여러 번 “짧게 자주” 하는 게 핵심이에요.',
      en: 'Tilting your head just 15° loads your neck with ~12 kg; at 60° it is ~27 kg (Hansraj, 2014). Short, frequent chin tucks through the day are the key.',
    },
    clinical: { ko: '전방 머리 자세 (Forward Head Posture)', en: 'Forward Head Posture' },
  },
  shrimp: {
    id: 'shrimp',
    short: { ko: '새우', en: 'Shrimp' },
    name: { ko: '책상 앞에 웅크린 새우형', en: 'The Desk-Curled Shrimp' },
    emoji: '🦐',
    color: '#ff7a59',
    soft: '#fff0ea',
    tagline: { ko: '어깨가 말리고 등이 둥글게 굽어 있어요', en: 'Rounded shoulders and a curved upper back' },
    looks: {
      ko: '어깨가 앞으로 말려 가슴이 좁아 보이고, 등 윗부분이 둥글게 솟은 자세예요. 라운드숄더·굽은 등(새우등)이 여기에 해당해요.',
      en: 'Shoulders roll forward, the chest looks narrow and the upper back rounds out — rounded shoulders and a "hunchback".',
    },
    causes: [
      { ko: '구부정하게 앉아 키보드·마우스 사용', en: 'Slouching over the keyboard and mouse' },
      { ko: '가슴 운동 위주, 등 운동 부족', en: 'Lots of chest training, little back work' },
      { ko: '무거운 가방, 웅크리는 습관', en: 'Heavy bags and a habit of hunching' },
    ],
    symptoms: [
      { ko: '등 사이·날개뼈 주변 뻐근함', en: 'Aching between the shoulder blades' },
      { ko: '어깨 앞쪽 통증, 팔 올릴 때 걸림', en: 'Front-of-shoulder pain when raising the arm' },
      { ko: '얕은 호흡, 쉽게 피곤함', en: 'Shallow breathing and fatigue' },
    ],
    tight: [
      { ko: '대흉근 · 소흉근(가슴)', en: 'Pectoralis major & minor' },
      { ko: '광배근 · 상부 승모근', en: 'Lats & upper trapezius' },
    ],
    weak: [
      { ko: '중·하부 승모근, 능형근', en: 'Middle/lower trapezius & rhomboids' },
      { ko: '흉추 신전근, 전거근', en: 'Thoracic extensors & serratus anterior' },
    ],
    proTip: {
      ko: '가슴만 늘리면 금방 돌아가요. 가슴 스트레칭 → 등 펴기 → 날개뼈 모으는 근육 깨우기 순서로 해야 자세가 유지돼요.',
      en: 'Stretching the chest alone won’t hold. Stretch the chest → extend the upper back → wake up the shoulder-blade muscles, in that order.',
    },
    clinical: { ko: '상부 교차 증후군 경향 · 흉추 후만 증가', en: 'Upper-crossed pattern · increased thoracic kyphosis' },
  },
  duck: {
    id: 'duck',
    short: { ko: '오리', en: 'Duck' },
    name: { ko: '엉덩이 쏙 오리형', en: 'The Sway-Hip Duck' },
    emoji: '🦆',
    color: '#f0a800',
    soft: '#fff7dc',
    tagline: { ko: '골반·허리·무릎 정렬이 흐트러져 있어요', en: 'Pelvis, lower back and knees are out of line' },
    looks: {
      ko: '허리가 깊게 휘며 엉덩이가 뒤로 빠지거나(오리궁둥이), 골반이 앞으로 밀리고 무릎이 뒤로 꺾이는 자세예요. 아랫배가 나와 보이기도 해요.',
      en: 'The lower back arches deeply and the hips stick out ("duck butt"), or the pelvis drifts forward with locked-back knees. The belly may look pushed out.',
    },
    causes: [
      { ko: '오래 앉아 있어 고관절 앞쪽이 짧아짐', en: 'Long sitting shortens the front of the hips' },
      { ko: '복근·엉덩이 근육 사용 부족', en: 'Underused abs and glutes' },
      { ko: '무릎을 잠그고 서는 습관, 하이힐', en: 'Standing with locked knees, high heels' },
    ],
    symptoms: [
      { ko: '허리 뻐근함, 오래 서 있으면 요통', en: 'Low-back ache when standing long' },
      { ko: '고관절 앞쪽 당김', en: 'Tight front of the hips' },
      { ko: '무릎 뒤쪽 불편감', en: 'Discomfort behind the knees' },
    ],
    tight: [
      { ko: '장요근 · 대퇴직근(고관절 앞)', en: 'Hip flexors (iliopsoas, rectus femoris)' },
      { ko: '허리 기립근', en: 'Lumbar erectors' },
    ],
    weak: [
      { ko: '복부 심부근(복횡근)', en: 'Deep abdominals' },
      { ko: '대둔근 · 햄스트링', en: 'Glutes & hamstrings' },
    ],
    proTip: {
      ko: '허리를 억지로 펴기보다, 골반을 살짝 말아 넣는 감각(꼬리뼈 내리기)과 엉덩이 힘을 먼저 익히는 게 빠른 길이에요.',
      en: 'Rather than forcing the back flat, learn to gently tuck the pelvis (drop the tailbone) and switch on your glutes first.',
    },
    clinical: { ko: '하부 교차 증후군 경향 · 골반 전방경사/스웨이백', en: 'Lower-crossed pattern · anterior pelvic tilt / sway-back' },
  },
  flamingo: {
    id: 'flamingo',
    short: { ko: '플라밍고', en: 'Flamingo' },
    name: { ko: '짝다리 플라밍고형', en: 'The One-Leg Flamingo' },
    emoji: '🦩',
    color: '#ff5a8c',
    soft: '#ffeaf1',
    tagline: { ko: '몸의 좌우 균형이 한쪽으로 기울어 있어요', en: 'Your body leans to one side' },
    looks: {
      ko: '정면에서 보면 한쪽 어깨나 골반이 더 높고, 몸통이 한쪽으로 치우쳐 있어요. 치마가 자꾸 돌아가거나 한쪽 신발만 닳는다면 이 유형일 수 있어요.',
      en: 'From the front one shoulder or hip sits higher and the trunk drifts sideways. Skirts that keep rotating or one worn-out shoe are typical clues.',
    },
    causes: [
      { ko: '짝다리로 서기, 다리 꼬고 앉기', en: 'Standing on one leg, crossing legs' },
      { ko: '한쪽으로만 메는 가방', en: 'Carrying bags on one side' },
      { ko: '한쪽으로 턱 괴기, 옆으로 누워 폰 보기', en: 'Leaning on one elbow, side-lying phone use' },
    ],
    symptoms: [
      { ko: '한쪽만 뭉치는 어깨·허리', en: 'One-sided shoulder or back tightness' },
      { ko: '골반·고관절 불편감', en: 'Pelvis or hip discomfort' },
      { ko: '한쪽 무릎·발목 부담', en: 'Extra load on one knee or ankle' },
    ],
    tight: [
      { ko: '높은 쪽 상부 승모근 · 요방형근', en: 'Upper trap & quadratus lumborum on the high side' },
      { ko: '한쪽 고관절 내전근', en: 'Hip adductors on one side' },
    ],
    weak: [
      { ko: '반대쪽 중둔근(골반 옆 근육)', en: 'Gluteus medius on the opposite side' },
      { ko: '몸통 옆 안정근', en: 'Lateral core stabilisers' },
    ],
    proTip: {
      ko: '좌우 차이는 “습관”에서 와요. 운동은 양쪽 다 하되 뭉친 쪽을 한 세트 더, 그리고 짝다리·다리 꼬기를 먼저 끊어 보세요.',
      en: 'Asymmetry comes from habits. Train both sides, add one extra set on the tight side, and drop the leg-crossing habit first.',
    },
    clinical: { ko: '전두면 비대칭 (어깨·골반 경사, 측방 이동)', en: 'Frontal-plane asymmetry (shoulder/pelvic obliquity, lateral shift)' },
  },
  meerkat: {
    id: 'meerkat',
    short: { ko: '미어캣', en: 'Meerkat' },
    name: { ko: '꼿꼿한 미어캣형', en: 'The Upright Meerkat' },
    emoji: '🌟',
    color: '#d9a15f',
    soft: '#fbf1e2',
    tagline: { ko: '머리부터 발끝까지 균형이 좋아요!', en: 'Well balanced from head to toe!' },
    looks: {
      ko: '귀·어깨·골반·무릎·발목이 거의 한 줄로 서 있고 좌우 균형도 좋아요. 지금 자세를 유지하는 것이 목표예요.',
      en: 'Ear, shoulder, hip, knee and ankle line up nicely and your left/right balance is good. The goal is to keep it that way.',
    },
    causes: [
      { ko: '규칙적인 움직임과 좋은 생활 습관', en: 'Regular movement and good habits' },
    ],
    symptoms: [
      { ko: '특별한 문제 없음 — 오래 앉는 날엔 방심 금지!', en: 'Nothing notable — but stay alert on long sitting days!' },
    ],
    tight: [],
    weak: [],
    proTip: {
      ko: '좋은 자세는 “가만히 있는 자세”가 아니라 “자주 바뀌는 자세”예요. 50분마다 1분 리셋만 지켜도 충분해요.',
      en: 'The best posture is your next posture. A one-minute reset every 50 minutes is enough to keep it.',
    },
    clinical: { ko: '이상적 정렬에 가까움', en: 'Close to ideal alignment' },
  },
};

/** 복합 유형 이름: 거북새우형 등 */
export function typeName(primary: AnimalId, secondary?: AnimalId): Text {
  if (!secondary) return ANIMALS[primary].name;
  const a = ANIMALS[primary], b = ANIMALS[secondary];
  return {
    ko: `${a.short.ko}${b.short.ko}형`,
    en: `${a.short.en}-${b.short.en}`,
  };
}

export function typeTitle(primary: AnimalId, secondary?: AnimalId): Text {
  if (!secondary) return ANIMALS[primary].name;
  const a = ANIMALS[primary], b = ANIMALS[secondary];
  const special: Record<string, Text> = {
    'turtle+shrimp': { ko: '거북목 + 굽은 등이 함께 온 거북새우형', en: 'Turtle-Shrimp: tech neck plus rounded back' },
    'shrimp+turtle': { ko: '굽은 등 + 거북목이 함께 온 새우거북형', en: 'Shrimp-Turtle: rounded back plus tech neck' },
    'shrimp+duck': { ko: '등은 굽고 허리는 휜 새우오리형', en: 'Shrimp-Duck: rounded back, arched low back' },
    'duck+shrimp': { ko: '허리는 휘고 등은 굽은 오리새우형', en: 'Duck-Shrimp: arched low back, rounded upper back' },
  };
  return special[`${primary}+${secondary}`] ?? {
    ko: `${a.short.ko}에 ${josa(b.short.ko, '이', '가')} 섞인 ${a.short.ko}${b.short.ko}형`,
    en: `${a.short.en} with a touch of ${b.short.en}`,
  };
}
