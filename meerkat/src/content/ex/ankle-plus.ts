/**
 * 운동 라이브러리 · 발목·발·균형·손목 (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { SIT, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서 쓰는 자세 ─────────────────────
// 서 있는 다리는 “발바닥이 바닥에 평평”하도록 발목 = 몸 기울기 − 고관절 굽힘 + 무릎 굽힘 으로 맞췄어요.

/** 벽을 마주 보고 두 손바닥을 벽에 댐(손끝은 위). 몸이 벽에 가까워질수록 팔꿈치를 더 굽혀 손 위치를 지켜요 */
const HANDS_ON_WALL = (flex: number, el: number, wr: number): Pose => both({ sh: { flex, abd: 10 }, el, wr });

/** 가자미근 스트레칭: 오른발을 약 35cm(몸 단위 20) 뒤로 뺀 엇갈린 자세 → 뒤꿈치를 붙인 채 뒷무릎을 굽혀 가라앉음(발목 굽힘 22° → 31° → 36°) */
const SOLEUS_START: Pose = merge({ root: { pitch: 5 } }, { hipL: { flex: 28 }, knL: 29, anL: 6, hipR: { flex: -4.5 }, knR: 13, anR: 22 });
const SOLEUS_BEND: Pose = merge({ root: { pitch: 5 } }, { hipL: { flex: 33.4 }, knL: 40, anL: 12, hipR: { flex: 2 }, knR: 28, anR: 31 });
const SOLEUS_DEEP: Pose = merge({ root: { pitch: 5 } }, { hipL: { flex: 37.3 }, knL: 49, anL: 16.5, hipR: { flex: 5.6 }, knR: 37, anR: 36.5 });

/** 벽에 무릎 대기: 오른발이 앞(벽 쪽), 왼발은 한 걸음 뒤(뒤꿈치 살짝 들림). 무릎을 대면 오른발목 굽힘 약 34° */
const K2W_START: Pose = merge({ root: { pitch: 4 } }, { hipR: { flex: 28 }, knR: 29, anR: 4.5, hipL: { flex: -1 }, knL: 28, anL: 23 });
const K2W_TOUCH: Pose = merge({ root: { pitch: 4 } }, { hipR: { flex: 40.5 }, knR: 70, anR: 33.6, hipL: { flex: 3.4 }, knL: 60, anL: 40.6 });

/** 의자에 앉아 두 손으로 의자 옆 모서리를 잡고, 오른무릎을 반쯤 펴 발을 띄움 */
const SIT_GRIP: Pose = merge(SIT, both({ sh: { flex: -2, abd: 13 }, el: 6 }));
const PUMP_BASE: Pose = merge(SIT_GRIP, { hipR: { flex: 86, abd: 6 }, knR: 45 });

/** 벽에 등을 기대고 발은 벽에서 30cm 앞: 몸통은 곧게 세워 벽에 붙이고, 다리만 비스듬히 */
const WALL_LEAN: Pose = merge(STAND, both({ hip: { flex: 17 }, kn: 2, an: -15, sh: { abd: 6, flex: -4 }, el: 8 }));

/** 한 발 서기: 두 손끝을 가슴 높이로 벽에 대고, 왼무릎을 굽혀 왼발을 뒤로 들어 올림 */
const FINGERTIPS_ON_WALL: Pose = both({ sh: { flex: 62, abd: 10 }, el: 28, wr: 30 });
const SL_STAND: Pose = merge(STAND, FINGERTIPS_ON_WALL, { hipL: { flex: 4 }, knL: 80, anL: -20, knR: 3, anR: 3 });

/** 일자 서기: 두 발을 몸 가운데 한 줄 위에 (오른발이 앞) */
const ARMS_RELAXED: Pose = both({ sh: { abd: 12 }, el: 10 });
const FEET_TOGETHER: Pose = merge(STAND, ARMS_RELAXED, both({ hip: { abd: -2 } }));
const TANDEM: Pose = merge(STAND, ARMS_RELAXED, { hipR: { flex: 8.5, abd: -6.5 }, knR: 3, anR: -5.5, hipL: { flex: -8.5, abd: -6.5 }, knL: 3, anL: 11.5 });

/** 손목 폄근 스트레칭: 오른팔을 앞으로 쭉(몸 가운데 쪽으로 살짝), 왼손은 오른손등 위 */
const EXT_ARM_R: Pose = { shR: { flex: 78, hab: -22 }, elR: 0, thorax: { twist: -6 }, scapL: { prot: 3 } };
const EXT_READY: Pose = merge(STAND, EXT_ARM_R, { wrR: -6, shL: { abd: 8 }, elL: 10 });
const EXT_HAND_ON: Pose = merge(STAND, EXT_ARM_R, { wrR: -6, shL: { flex: 66, abd: 49, hab: -18, rot: -23 }, elL: 51, wrL: -70 });
const EXT_PRESS: Pose = merge(STAND, EXT_ARM_R, { wrR: -78, shL: { flex: 61, abd: 31, hab: -37, rot: 39 }, elL: 30, wrL: -91 });

/** 합장: 가슴 앞에서 손바닥을 맞댐 / 배꼽 높이로 내려 손목을 젖힘 */
const PRAYER_CHEST: Pose = merge(STAND, both({ sh: { flex: 28, abd: 14, hab: -10, rot: -34 }, el: 109, wr: 59 }));
const PRAYER_LOW: Pose = merge(STAND, both({ sh: { flex: 11, abd: 20, hab: -34, rot: -24 }, el: 77, wr: 102 }));

export const ANKLE_PLUS: Exercise[] = [
  // ─────────────────────────────────────────────
  {
    id: 'soleus-stretch',
    name: { ko: '무릎 굽혀 종아리 깊은 곳 늘리기', en: 'Bent-knee soleus stretch' },
    phase: 'stretch',
    position: 'wall',
    regions: ['ankle', 'knee'],
    targets: { kneeHyperext: 0.4, kneeValgus: 0.4, kneePain: 0.3, stiffness: 0.4 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '벽을 마주 보고 서서 왼발 끝을 벽에서 25~30cm 떨어뜨리고, 두 손바닥을 어깨 높이로 벽에 대요.',
        '오른발을 왼발보다 30~40cm(반~한 걸음) 뒤로 빼고, 두 발끝이 모두 벽을 똑바로 향하게 해요.',
        '두 발 사이는 주먹 하나 너비로 벌리고, 오른발 뒤꿈치를 바닥에 꾹 붙여요.',
        '몸통은 곧게 세우고 시선은 벽의 눈높이 한 점에 둬요.',
      ],
      en: [
        'Face a wall with your left toes 25–30 cm from it and place both palms on the wall at shoulder height.',
        'Step your right foot 30–40 cm (half to one step) behind the left, both feet pointing straight at the wall.',
        'Keep the feet a fist-width apart side to side and press your right heel firmly into the floor.',
        'Keep your trunk tall and your eyes on a point on the wall at eye level.',
      ],
    },
    steps: {
      ko: [
        '오른발 뒤꿈치를 바닥에 붙인 채, 뒷무릎(오른무릎)을 2~3초에 걸쳐 앞으로 굽혀요. 의자에 살짝 앉듯 엉덩이를 수직으로 5~10cm 내려요.',
        '오른무릎이 둘째 발가락 방향으로 나가게 하고, 발 안쪽 아치가 무너지지 않게 해요.',
        '아킬레스힘줄 바로 위, 종아리 아래쪽이 당기는 지점에서 멈춰요.',
        '그 자리에서 30초 버티며, 내쉴 때마다 무릎을 1cm씩 더 굽혀요.',
        '천천히 무릎을 펴고 발을 바꿔 왼쪽도 30초 해요.',
      ],
      en: [
        'Keeping your right heel down, take 2–3 seconds to bend the back (right) knee forward, sinking your hips straight down 5–10 cm as if starting to sit.',
        'Guide the right knee toward your second toe and don’t let the inner arch collapse.',
        'Stop where you feel a pull low in the calf, just above the Achilles tendon.',
        'Hold there for 30 seconds, bending the knee about 1 cm more with each exhale.',
        'Slowly straighten up, switch feet and hold the left side for 30 seconds.',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시고 입으로 6초 길게 내쉬어요. 내쉴 때 종아리 힘을 빼며 무릎을 살짝 더 굽혀요. 숨을 참지 마세요.',
      en: 'Breathe in through your nose for 4 seconds and out through your mouth for 6. As you exhale, relax the calf and bend the knee a touch more. Don’t hold your breath.',
    },
    feel: {
      ko: '종아리 아래쪽 깊은 곳(아킬레스힘줄 위 손 한 뼘 구간)이 은은하게 당기면 정답이에요. 무릎 뒤가 당기면 무릎을 더 굽히고, 아킬레스힘줄이나 발뒤꿈치가 찌릿하거나 날카롭게 아프면 범위를 줄이거나 멈춰요.',
      en: 'A gentle pull deep in the lower calf — the hand-span above the Achilles — is right. If you feel it behind the knee, bend the knee more; if the Achilles or heel gets a sharp or zinging pain, ease off or stop.',
    },
    easier: {
      ko: '뒷발을 20cm만 빼서 범위를 줄여요. 서 있기 힘들면 의자에 앉아 발을 무릎보다 뒤로 당겨 정강이가 앞으로 기울게 한 뒤, 뒤꿈치를 바닥에 댄 채 두 손으로 무릎을 지그시 눌러요.',
      en: 'Step back only 20 cm to reduce the range. If standing is hard, sit and slide the foot back until the shin tilts forward, then keep the heel down and press gently on the knee with both hands.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘리거나, 뒷발 앞꿈치 밑에 3~4cm 두께의 책을 깔아 더 깊게 늘려요. 그다음엔 ‘벽에 무릎 대기’로 움직이며 발목을 풀어요.',
      en: 'Build up to 45-second holds, or put a 3–4 cm book under the ball of the back foot for a deeper stretch. Then move on to the knee-to-wall drill to mobilise the ankle.',
    },
    cues: {
      ko: ['뒤꿈치는 바닥에 꾹', '뒷무릎을 앞으로', '엉덩이는 아래로', '내쉬며 조금 더'],
      en: ['Heel stays down', 'Back knee forward', 'Hips sink down', 'Exhale, a bit more'],
    },
    mistakes: {
      ko: [
        '뒤꿈치가 들림 → 뒷발을 5cm 앞으로 당기고, 뒤꿈치로 바닥을 누를 수 있는 만큼만 무릎을 굽혀요.',
        '뒷무릎을 쭉 폄 → 그러면 종아리 윗부분(비복근)만 늘어나요. 무릎을 굽혀야 깊은 가자미근이 늘어나요.',
        '발끝이 바깥으로 돌아가거나 아치가 무너짐 → 두 발끝을 벽 쪽으로 똑바로 두고, 무릎이 둘째 발가락 위로 가게 해요.',
        '엉덩이를 뒤로 빼며 허리를 숙임 → 몸통을 세운 채 엉덩이를 수직으로 내려요.',
      ],
      en: [
        'Heel lifting → Bring the back foot 5 cm closer and bend the knee only as far as the heel can keep pressing down.',
        'Straightening the back knee → That only stretches the upper calf (gastrocnemius); keep the knee bent to reach the deep soleus.',
        'Toes turning out or the arch collapsing → Point both feet straight at the wall and track the knee over the second toe.',
        'Sticking the hips back and bending at the waist → Keep the trunk tall and drop the hips straight down.',
      ],
    },
    why: {
      ko: '가자미근은 무릎을 굽혀야 늘어나는 종아리 깊은 근육이에요. 짧아지면 발목이 덜 굽혀져 쪼그려 앉거나 계단을 내려갈 때 무릎이 안쪽으로 무너지고, 서 있을 때는 정강이를 뒤로 당겨 무릎이 뒤로 꺾이기 쉬워요.',
      en: 'The soleus is the deep calf muscle that only stretches with the knee bent. When it’s short the ankle bends less, so the knees cave in when squatting or going downstairs, and in standing it pulls the shin back so the knees lock backward.',
    },
    muscles: { ko: '가자미근, 아킬레스힘줄', en: 'Soleus, Achilles tendon' },
    caution: {
      ko: '아킬레스힘줄이 붓거나 아침 첫걸음에 발뒤꿈치가 심하게 아프면 세게 늘리지 말고 전문가와 상의하세요.',
      en: 'If your Achilles is swollen or your heel hurts sharply with the first steps in the morning, don’t push the stretch — check with a professional.',
    },
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'front', dist: 0 }],
      anchor: ['heelL', 'toeL'],
      keys: [merge(SOLEUS_START, HANDS_ON_WALL(91, 8, 76)), merge(SOLEUS_BEND, HANDS_ON_WALL(92, 12, 71)), merge(SOLEUS_DEEP, HANDS_ON_WALL(90, 22, 63))],
      labels: [
        { ko: '벽 짚고 오른발 뒤로', en: 'Hands on wall, right foot back' },
        { ko: '뒤꿈치 누르고 무릎 굽히기', en: 'Heel down, bend the knee' },
        { ko: '내쉬며 조금 더, 30초', en: 'Exhale deeper, hold 30 s' },
      ],
      durations: [2, 1.4, 1.8],
      pauses: [0.8, 0.4, 3],
      holdKey: 2,
      focus: [{ a: 'knR', b: 'anR', side: 'back', kind: 'stretch', from: 0.35, to: 0.98, r: 2.8 }],
      trace: ['knR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'knee-to-wall',
    name: { ko: '벽에 무릎 대기(발목 유연성)', en: 'Knee-to-wall ankle mobility' },
    phase: 'mobility',
    position: 'wall',
    regions: ['ankle', 'knee'],
    targets: { kneeValgus: 0.5, stiffness: 0.5, kneePain: 0.3, kneeHyperext: 0.2 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 3, holdSec: 2, perSide: true, rest: 15 },
    desk: true,
    setup: {
      ko: [
        '벽을 마주 보고 서서 오른발 엄지발가락 끝을 벽에서 5~10cm(손가락 3~5개 너비) 떨어뜨려 둬요.',
        '왼발은 한 걸음 뒤에 편하게 두고, 두 손은 가슴 높이로 벽을 가볍게 짚어요.',
        '오른발 끝은 벽을 똑바로 향하게, 뒤꿈치는 바닥에 붙여요.',
      ],
      en: [
        'Face a wall and place your right big toe 5–10 cm (3–5 finger-widths) from it.',
        'Put your left foot a comfortable step behind and rest both hands on the wall at chest height.',
        'Point your right foot straight at the wall with the heel flat on the floor.',
      ],
    },
    steps: {
      ko: [
        '오른발 뒤꿈치를 바닥에 붙인 채, 2초에 걸쳐 오른무릎을 둘째 발가락 방향으로 밀어 벽에 톡 대요.',
        '무릎이 벽에 닿은 자리에서 2초 머물러요. 발목 앞이 접히고 종아리 아래쪽이 늘어나요.',
        '1초에 걸쳐 무릎을 펴며 처음 자세로 돌아와요.',
        '10회 반복해요. 쉽게 닿으면 발을 1cm씩 뒤로 옮겨, 뒤꿈치가 뜨기 직전 거리에서 해요.',
        '발을 바꿔 왼쪽도 해요. 좌우 거리를 비교해 보세요.',
      ],
      en: [
        'Keeping your right heel down, take 2 seconds to drive the right knee forward over the second toe until it taps the wall.',
        'Pause 2 seconds with the knee on the wall — the front of the ankle folds and the lower calf lengthens.',
        'Take 1 second to straighten back to the start.',
        'Repeat 10 times. If the knee touches easily, move the foot back 1 cm at a time and work just short of where the heel lifts.',
        'Switch and do the left side — compare the distance on each side.',
      ],
    },
    breathing: {
      ko: '무릎을 벽으로 밀 때 입으로 “후—” 내쉬고, 돌아오며 코로 들이마셔요.',
      en: 'Exhale through your mouth as you drive the knee to the wall, inhale through your nose as you come back.',
    },
    feel: {
      ko: '발목 앞이 접히는 느낌과 종아리 아래쪽·아킬레스힘줄이 늘어나는 느낌이면 정답이에요. 발목 앞이 딱 막히며 꼬집히듯 아프면 발을 벽에 더 가깝게 두고, 날카로운 통증이 있으면 멈춰요.',
      en: 'A folding feeling at the front of the ankle and a stretch in the lower calf and Achilles. If the front of the ankle feels pinched or blocked, move the foot closer to the wall; stop with any sharp pain.',
    },
    easier: {
      ko: '발을 벽에 2~3cm까지 가깝게 두거나, 벽에 닿지 않아도 되니 뒤꿈치를 붙인 채 무릎을 앞으로 미는 움직임만 해요. 서 있기 불안하면 오른무릎을 굽혀 세우고 왼무릎을 바닥에 댄 자세에서 같은 동작을 해요.',
      en: 'Put the foot just 2–3 cm from the wall, or simply drive the knee forward with the heel down without reaching the wall. If standing feels unsteady, do the same move half-kneeling with the left knee on the floor.',
    },
    harder: {
      ko: '뒤꿈치가 뜨기 직전까지 발을 뒤로 옮겨 거리를 늘려요(목표 10~12cm). 무릎이 벽에 닿은 채 무릎을 좌우로 살짝 흔들어 발목 구석구석을 풀고, 이어서 ‘한 발 까치발 들기’를 해요.',
      en: 'Move the foot back to just before the heel lifts (aim for 10–12 cm). With the knee on the wall, sway it gently side to side to reach every corner of the ankle, then follow with single-leg calf raises.',
    },
    cues: {
      ko: ['뒤꿈치는 바닥에', '무릎은 둘째 발가락으로', '벽에 톡, 2초', '천천히 돌아와요'],
      en: ['Heel stays down', 'Knee over the second toe', 'Tap the wall, two', 'Come back slowly'],
    },
    mistakes: {
      ko: [
        '뒤꿈치가 들림 → 뒤꿈치 밑에 종이 한 장이 깔려 있다고 생각하고 빠지지 않게 해요. 들리면 발을 1cm 앞으로 옮겨요.',
        '무릎이 안쪽으로 무너짐 → 엄지발가락 쪽과 새끼발가락 쪽을 고르게 누르며 무릎이 둘째 발가락 위를 지나게 해요.',
        '엉덩이만 앞으로 밀고 무릎은 그대로 → 골반이 아니라 정강이가 앞으로 기울어지도록 무릎을 밀어요.',
        '빠르게 튕기듯 반복 → 2초 밀고, 2초 머물고, 1초에 돌아와요.',
      ],
      en: [
        'Heel lifting → Imagine a sheet of paper under the heel that mustn’t slip out; if it lifts, move the foot 1 cm closer.',
        'Knee caving inward → Press evenly through the big-toe and little-toe sides and track the knee over the second toe.',
        'Pushing the hips forward instead of the knee → Drive the knee so the shin tilts forward; the pelvis just follows.',
        'Bouncing fast → Two seconds in, pause two, one second back.',
      ],
    },
    why: {
      ko: '발목이 앞으로 충분히 굽혀지지 않으면(발등 굽힘 부족) 쪼그려 앉거나 계단을 내려갈 때 무릎이 안쪽으로 무너지고 몸이 앞으로 숙여져요. 벽까지 거리로 발목 유연성을 재고 좌우 차이도 확인할 수 있어요.',
      en: 'When the ankle can’t bend forward enough (limited dorsiflexion), the knees cave in and the trunk tips forward when you squat or walk downstairs. The distance to the wall also measures your ankle mobility and any left–right difference.',
    },
    muscles: {
      ko: '가자미근·비복근(늘어남), 앞정강근(움직임), 발목 관절',
      en: 'Soleus and gastrocnemius (lengthening), tibialis anterior (moving), ankle joint',
    },
    caution: {
      ko: '발목을 심하게 삔 지 6주가 안 됐거나 발목 앞이 붓고 아프면 먼저 전문가와 상의하세요.',
      en: 'If you badly sprained the ankle within the last 6 weeks, or the front of the ankle is swollen and sore, check with a professional first.',
    },
    avoid: ['kneeSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'front', dist: 0 }],
      anchor: ['heelR', 'toeR'],
      keys: [merge(K2W_START, HANDS_ON_WALL(42, 70, 65)), merge(K2W_TOUCH, HANDS_ON_WALL(38, 111, 27))],
      labels: [
        { ko: '발끝을 벽에서 10cm', en: 'Toes 10 cm from the wall' },
        { ko: '무릎을 벽에 톡, 2초', en: 'Knee taps the wall, 2 s' },
      ],
      durations: [2, 1.1],
      pauses: [0.5, 2],
      focus: [
        { a: 'knR', b: 'anR', side: 'back', kind: 'stretch', from: 0.35, to: 0.98, r: 2.8 },
        { a: 'knR', b: 'anR', side: 'front', kind: 'work', from: 0.15, to: 0.7, r: 2 },
      ],
      trace: ['knR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'ankle-pumps',
    name: { ko: '발목 까딱이기', en: 'Seated ankle pumps' },
    phase: 'mobility',
    position: 'seated',
    regions: ['ankle'],
    targets: { stiffness: 0.7 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 15, tempo: 2, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 앉아 허리를 세우고, 두 손은 엉덩이 옆 의자 모서리를 가볍게 잡아요.',
        '왼발은 바닥에 평평하게 두고, 오른무릎을 반쯤 펴 오른발을 바닥에서 5~10cm 띄워요.',
        '오른 허벅지는 의자에 편하게 얹고, 발끝은 앞쪽 위를 향하게 해요.',
      ],
      en: [
        'Sit on the front third of the chair with your back tall and your hands lightly holding the seat edge beside your hips.',
        'Keep your left foot flat and half-straighten your right knee so the right foot hovers 5–10 cm off the floor.',
        'Let the right thigh rest on the seat with the toes pointing forward and up.',
      ],
    },
    steps: {
      ko: [
        '1초에 걸쳐 발끝을 정강이 쪽으로 최대한 당겨요. 발뒤꿈치가 앞으로 밀려나요.',
        '1초에 걸쳐 발끝을 바닥 쪽으로 멀리 뻗어요. 발레리나처럼 발등이 쭉 펴져요.',
        '당기고 뻗기를 1회로 15회 반복해요. 양끝까지 가되 튕기지 말고 부드럽게 해요.',
        '무릎과 허벅지는 가만히 두고 발목만 움직여요.',
        '오른발을 내려놓고 왼발도 15회 해요.',
      ],
      en: [
        'Take 1 second to pull your toes up toward your shin as far as they go — the heel pushes away.',
        'Take 1 second to point the toes down and away, lengthening the top of the foot like a ballet dancer.',
        'Up and down counts as one; do 15 smooth reps, reaching the end each way without bouncing.',
        'Keep the knee and thigh still — only the ankle moves.',
        'Put the right foot down and do 15 with the left.',
      ],
    },
    breathing: {
      ko: '코로 편하게 숨 쉬며 리듬을 타요. 발끝을 당길 때 들이마시고 뻗을 때 내쉬어도 좋아요.',
      en: 'Breathe easily through your nose and find a rhythm — inhale as you pull the toes up, exhale as you point.',
    },
    feel: {
      ko: '당길 때는 정강이 앞이 일하고 종아리가 늘어나며, 뻗을 때는 종아리가 조이고 발등이 늘어나요. 종아리가 따뜻해지면 잘 되고 있는 거예요. 종아리에 쥐가 나면 잠시 쉬었다가 범위를 줄여 다시 해요.',
      en: 'Pulling up, the front of the shin works and the calf lengthens; pointing, the calf squeezes and the top of the foot stretches. A warm calf means it’s working. If the calf cramps, pause, then continue with a smaller range.',
    },
    easier: {
      ko: '두 발을 바닥에 둔 채 뒤꿈치 들기와 발끝 들기를 번갈아 해요.',
      en: 'Keep both feet on the floor and alternate lifting your heels and lifting your toes.',
    },
    harder: {
      ko: '두 발을 함께 띄워 30~60초 동안 리듬감 있게 하거나, 이어서 발목으로 천천히 원 그리기를 안쪽·바깥쪽으로 5회씩 더해요.',
      en: 'Lift both feet and pump rhythmically for 30–60 seconds, or add 5 slow ankle circles each way afterwards.',
    },
    cues: {
      ko: ['발끝 몸 쪽으로', '멀리 쭉 뻗어요', '무릎은 그대로', '끝까지 부드럽게'],
      en: ['Toes up to you', 'Point long', 'Knee stays still', 'Full, smooth range'],
    },
    mistakes: {
      ko: [
        '다리 전체가 흔들림 → 허벅지를 의자에 붙이고 발목 관절만 접었다 펴요.',
        '작게 까딱이기만 함 → 당길 때도 뻗을 때도 더 이상 안 갈 때까지 가요.',
        '발가락만 오므렸다 폄 → 발가락 힘은 빼고 발 전체를 발목에서 움직여요.',
        '허리가 구부정해짐 → 좌골로 앉아 정수리를 위로 세운 채 해요.',
      ],
      en: [
        'Whole leg swinging → Keep the thigh on the seat and hinge only at the ankle.',
        'Tiny flicks → Go all the way to the end of the range both ways.',
        'Curling only the toes → Relax the toes and move the whole foot from the ankle.',
        'Slumping → Sit on your sit bones with the crown of your head reaching up.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 종아리 근육 펌프가 멈춰 다리가 붓고 발목이 뻣뻣해져요. 발목을 끝까지 굽혔다 펴면 종아리 펌프가 다시 돌고 발목 움직임도 유지돼요.',
      en: 'Long sitting switches off the calf “muscle pump”, so the legs swell and the ankles stiffen. Taking the ankle through its full range restarts the pump and keeps the joint moving.',
    },
    muscles: { ko: '앞정강근, 비복근·가자미근', en: 'Tibialis anterior, gastrocnemius and soleus' },
    caution: {
      ko: '한쪽 종아리가 갑자기 붓고 뜨겁고 아프면 운동하지 말고 바로 의료진에게 연락하세요.',
      en: 'If one calf suddenly becomes swollen, warm and painful, don’t exercise — contact a medical professional right away.',
    },
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      keys: [merge(PUMP_BASE, { anR: -12 }), merge(PUMP_BASE, { anR: 20 }), merge(PUMP_BASE, { anR: -48 })],
      labels: [
        { ko: '오른발 살짝 띄우기', en: 'Lift the right foot' },
        { ko: '발끝을 몸 쪽으로', en: 'Toes up to the shin' },
        { ko: '발끝을 멀리 뻗기', en: 'Point the toes away' },
      ],
      durations: [0.9, 1.1, 0.9],
      pauses: [0.5, 0.4, 0.4],
      focus: [
        { a: 'knR', b: 'anR', side: 'front', kind: 'work', from: 0.1, to: 0.8, r: 2.2 },
        { a: 'knR', b: 'anR', side: 'back', kind: 'work', from: 0.1, to: 0.7, r: 2.8 },
      ],
      trace: ['toeR'],
      zoom: 1.1,
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'tibialis-raise',
    name: { ko: '벽에 기대 발끝 들기', en: 'Wall tibialis raise' },
    phase: 'activate',
    position: 'wall',
    regions: ['ankle', 'knee'],
    targets: { kneeValgus: 0.3, kneePain: 0.3, stiffness: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 4, holdSec: 2, rest: 20 },
    desk: true,
    setup: {
      ko: [
        '벽에 등을 대고 서서, 두 발을 벽에서 30cm(발 길이 하나 반) 앞으로 내딛고 골반 너비로 벌려요.',
        '엉덩이와 날개뼈를 벽에 기대 몸이 비스듬히 기대지게 하고, 무릎은 살짝만 풀어 둬요.',
        '두 팔은 몸 옆에 편하게 내리고, 시선은 정면에 둬요.',
      ],
      en: [
        'Stand with your back to a wall, feet 30 cm (about one and a half foot-lengths) in front of it and hip-width apart.',
        'Lean your buttocks and shoulder blades on the wall so your body is on a slight diagonal, knees just unlocked.',
        'Let your arms hang at your sides and look straight ahead.',
      ],
    },
    steps: {
      ko: [
        '발뒤꿈치를 바닥에 붙인 채, 1초에 걸쳐 두 발끝을 정강이 쪽으로 최대한 들어 올려요.',
        '맨 위에서 2초 버텨요. 정강이 앞 근육이 단단해져요.',
        '3초에 걸쳐 발끝을 천천히 내려요. 바닥에 “탁” 떨어뜨리지 말고 살며시 닿게 해요.',
        '발 앞쪽이 바닥에 닿으면 바로 다음 회를 시작해 12회 반복해요.',
      ],
      en: [
        'Keeping your heels down, take 1 second to lift both forefeet toward your shins as high as they go.',
        'Hold 2 seconds at the top — the muscles on the front of your shins firm up.',
        'Take 3 seconds to lower the toes, touching down softly rather than slapping.',
        'As soon as the forefoot touches, start the next rep; do 12 in total.',
      ],
    },
    breathing: {
      ko: '발끝을 들 때 입으로 “후—” 내쉬고, 천천히 내리며 코로 들이마셔요.',
      en: 'Exhale through your mouth as you lift the toes, inhale through your nose as you lower slowly.',
    },
    feel: {
      ko: '정강이뼈 바로 바깥쪽 근육이 뻐근하게 타는 느낌이면 정답이에요. 정강이뼈 자체가 한 곳이 콕콕 쑤시면 횟수를 줄이고, 발등이 저리면 멈춰요.',
      en: 'A burning ache in the muscle just outside the shinbone is right. If one spot on the bone itself feels sharply sore, do fewer reps; stop if the top of your foot goes numb or tingly.',
    },
    easier: {
      ko: '발을 벽에 더 가깝게(15~20cm) 두어 덜 기울이거나, 의자에 앉아 발끝 들기로 해요.',
      en: 'Move your feet closer to the wall (15–20 cm) so you lean less, or do toe raises seated in a chair.',
    },
    harder: {
      ko: '발을 40~45cm까지 멀리 두어 더 기울이거나, 한 발씩 해요. 내리는 시간을 5초로 늘려도 좋아요.',
      en: 'Move your feet out to 40–45 cm for a steeper lean, or work one foot at a time. You can also slow the lowering to 5 seconds.',
    },
    cues: {
      ko: ['뒤꿈치는 바닥에', '발끝을 정강이로', '위에서 2초', '3초 천천히 내려요'],
      en: ['Heels stay down', 'Toes to shins', 'Hold for two', 'Lower for three'],
    },
    mistakes: {
      ko: [
        '엉덩이가 벽에서 떨어지며 몸이 앞으로 옴 → 엉덩이와 등을 벽에 붙인 채 발목만 움직여요.',
        '발끝을 툭 떨어뜨림 → 내리는 쪽이 운동의 절반이에요. 셋을 세며 브레이크를 걸 듯 내려요.',
        '발가락만 까딱임 → 발가락 힘은 빼고 발 앞쪽 전체를 발목에서 들어 올려요.',
        '무릎을 뒤로 꽉 잠금 → 무릎을 살짝 풀어 둔 채 해요.',
      ],
      en: [
        'Hips coming off the wall → Keep your buttocks and back on the wall and move only at the ankles.',
        'Dropping the toes → The lowering is half the exercise; brake for a slow count of three.',
        'Wiggling only the toes → Relax the toes and lift the whole forefoot from the ankle.',
        'Locking the knees back → Keep them softly unlocked.',
      ],
    },
    why: {
      ko: '앞정강근은 발 아치를 받쳐 주고, 걸을 때 발이 바닥에 “철썩” 떨어지지 않게 브레이크를 걸어요. 약해지면 발이 안쪽으로 무너지며 무릎이 따라 들어가기 쉬워서, 종아리 스트레칭과 짝을 이루면 좋아요.',
      en: 'The tibialis anterior supports the arch and brakes the foot so it doesn’t slap down as you walk. When it’s weak the foot collapses inward and the knee tends to follow — pair it with calf stretches.',
    },
    muscles: { ko: '앞정강근, 긴발가락폄근', en: 'Tibialis anterior, extensor digitorum longus' },
    caution: {
      ko: '정강이뼈의 한 곳을 누르면 심하게 아프거나 걷기만 해도 아프면 운동을 쉬고 전문가와 상의하세요.',
      en: 'If one spot on the shinbone is very tender to touch or hurts even when you walk, rest and check with a professional.',
    },
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'back', dist: 0 }],
      anchor: ['anL', 'anR'],
      keys: [WALL_LEAN, merge(WALL_LEAN, both({ an: 15 }))],
      labels: [
        { ko: '벽에 기대 서기', en: 'Lean back on the wall' },
        { ko: '발끝 들어 2초', en: 'Toes up, hold 2 s' },
      ],
      durations: [1, 3],
      pauses: [0.5, 2],
      focus: [
        { a: 'knR', b: 'anR', side: 'front', kind: 'work', from: 0.1, to: 0.85, r: 2.4 },
        { a: 'knL', b: 'anL', side: 'front', kind: 'work', from: 0.1, to: 0.85, r: 2.4 },
      ],
      trace: ['toeR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'single-leg-calf-raise',
    name: { ko: '한 발 까치발 들기', en: 'Single-leg calf raise' },
    phase: 'integrate',
    position: 'standing',
    regions: ['ankle', 'knee', 'hip'],
    targets: { kneeValgus: 0.4, kneeHyperext: 0.3, lateralShift: 0.3, stiffness: 0.2 },
    equipment: ['wall'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 5, holdSec: 1, perSide: true, rest: 30 },
    setup: {
      ko: [
        '벽을 마주 보고 팔을 앞으로 뻗으면 닿는 거리(약 40cm)에 서서, 두 손끝을 가슴 높이로 벽에 가볍게 대요.',
        '왼무릎을 굽혀 왼발을 뒤로 들고 오른발 하나로 서요. 오른무릎은 펴되 뒤로 꺾지 말고 살짝 풀어 둬요.',
        '오른발 끝은 정면을 향하고, 체중은 엄지발가락 뿌리·새끼발가락 뿌리·뒤꿈치 세 점에 고르게 실어요.',
      ],
      en: [
        'Face a wall about an arm’s length away (≈40 cm) and rest your fingertips on it at chest height.',
        'Bend your left knee to lift the left foot behind you and stand on the right foot, right knee straight but not locked back.',
        'Point the right foot straight ahead and spread your weight over three points: big-toe base, little-toe base and heel.',
      ],
    },
    steps: {
      ko: [
        '2초에 걸쳐 오른발 뒤꿈치를 최대한 높이 들어 앞꿈치(엄지발가락 뿌리)로 올라서요.',
        '맨 위에서 1초 멈춰요. 발목이 바깥으로 꺾이지 않게 엄지발가락 쪽으로 눌러요.',
        '3초에 걸쳐 뒤꿈치를 천천히 내려 바닥에 살짝 닿게 해요.',
        '손끝은 균형만 잡고 벽을 밀지 않아요. 10회 반복해요.',
        '발을 바꿔 왼발로도 10회 해요.',
      ],
      en: [
        'Take 2 seconds to rise as high as you can onto the ball of the right foot, over the big-toe base.',
        'Pause 1 second at the top, pressing through the big-toe side so the ankle doesn’t roll out.',
        'Take 3 seconds to lower the heel until it just touches the floor.',
        'Use your fingertips only for balance, not to push. Repeat 10 times.',
        'Switch and do 10 on the left foot.',
      ],
    },
    breathing: {
      ko: '올라가며 입으로 “후—” 내쉬고, 3초 동안 내려오며 코로 들이마셔요.',
      en: 'Exhale through your mouth as you rise, inhale through your nose during the 3-second lowering.',
    },
    feel: {
      ko: '종아리 전체(위쪽 볼록한 부분과 아래쪽 깊은 곳)가 뻐근하게 타고, 서 있는 쪽 엉덩이 옆도 골반을 잡느라 일해요. 아킬레스힘줄이나 발바닥이 찌르듯 아프면 멈춰요.',
      en: 'The whole calf — the bulge up top and the deep part below — burns, and the side of the standing hip works to keep your pelvis level. Stop if the Achilles or the sole of the foot gets a stabbing pain.',
    },
    easier: {
      ko: '두 발로 하는 ‘까치발 들기’로 하거나, 두 발로 올라가서 한 발로 3초 동안 내려오는 방식으로 해요.',
      en: 'Do the two-foot calf raise, or rise on two feet and lower on one for 3 seconds.',
    },
    harder: {
      ko: '15회 × 3세트까지 늘리거나, 계단 끝에 앞꿈치만 올려 뒤꿈치를 계단 아래까지 내렸다가 올라가요. 한 발로 20~25회를 이어서 할 수 있으면 종아리 지구력이 좋은 편이에요.',
      en: 'Build up to 15 reps × 3 sets, or stand with the ball of the foot on a step edge and lower the heel below the step before rising. Managing 20–25 in a row on one leg is a good calf-endurance mark.',
    },
    cues: {
      ko: ['엄지발가락 쪽으로', '2초 올라가요', '3초 천천히 내려요', '골반은 수평'],
      en: ['Over the big toe', 'Up for two', 'Down for three', 'Pelvis level'],
    },
    mistakes: {
      ko: [
        '발목이 바깥으로 꺾임 → 엄지발가락 뿌리로 바닥을 누르며 올라가요. 뒤꿈치가 새끼발가락 쪽으로 돌아가지 않게 해요.',
        '벽을 밀며 팔로 올라감 → 손끝만 대고, 밀어야 올라가진다면 두 발 버전으로 바꿔요.',
        '골반이 든 발 쪽으로 떨어짐 → 서 있는 쪽 엉덩이에 힘을 줘 골반을 수평으로 잡아요.',
        '빠르게 튕김 → 2초 올라가고, 1초 멈추고, 3초 내려와요.',
      ],
      en: [
        'Ankle rolling out → Press through the big-toe base as you rise so the heel doesn’t swing toward the little-toe side.',
        'Pushing up with your arms → Fingertips only; if you need to push, switch to the two-foot version.',
        'Pelvis dropping toward the lifted leg → Firm up the standing-side hip to keep the pelvis level.',
        'Bouncing → Two up, pause one, three down.',
      ],
    },
    why: {
      ko: '걷기·계단·달리기에서 한 발로 몸을 밀어 올리는 힘과 발목 안정성을 길러요. 발목이 흔들리지 않아야 무릎이 안쪽으로 무너지거나 몸이 옆으로 치우치지 않아요.',
      en: 'Builds the single-leg push-off strength and ankle stability you use for walking, stairs and running. A steady ankle keeps the knee from caving in and the body from shifting sideways.',
    },
    muscles: {
      ko: '비복근, 가자미근, 발목 안정근(긴종아리근·뒤정강근), 중둔근',
      en: 'Gastrocnemius, soleus, ankle stabilisers (peroneus longus, tibialis posterior), gluteus medius',
    },
    caution: {
      ko: '균형이 불안하면 두 손으로 벽이나 의자 등받이를 잡으세요. 아킬레스힘줄이 아프거나 부어 있으면 두 발 버전으로 바꿔요.',
      en: 'If your balance feels shaky, hold a wall or chair back with both hands. If your Achilles is sore or swollen, switch to the two-foot version.',
    },
    avoid: ['balance'],
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'front', dist: 0 }],
      anchor: ['toeR'],
      keys: [SL_STAND, merge(SL_STAND, { anR: -34 }, both({ sh: { flex: 38, abd: 10 }, el: 50, wr: 33 }))],
      labels: [
        { ko: '오른발로 서기', en: 'Stand on the right foot' },
        { ko: '2초 올라가 1초 멈춤', en: 'Rise for 2, pause 1' },
      ],
      durations: [2, 3],
      pauses: [0.5, 1],
      focus: [
        { a: 'knR', b: 'anR', side: 'back', kind: 'work', from: 0.08, to: 0.85, r: 3 },
        { a: 'hipR', b: 'shR', side: 'out', kind: 'work', from: 0, to: 0.28, r: 2.8 },
      ],
      trace: ['heelR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'tandem-balance',
    name: { ko: '일자로 서서 균형 잡기', en: 'Tandem stance balance' },
    phase: 'integrate',
    position: 'standing',
    regions: ['ankle', 'hip', 'core'],
    targets: { lateralShift: 0.5, pelvicTilt: 0.4, kneeValgus: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    setup: {
      ko: [
        '벽 옆에 서서 왼쪽 어깨와 벽 사이를 30cm쯤(팔꿈치를 굽혀 닿을 거리) 둬요. 흔들리면 바로 짚을 수 있어요.',
        '두 발을 모으고 바르게 서서, 3m 앞 눈높이의 한 점을 정해 시선을 고정해요.',
        '두 팔은 몸 옆에 힘을 빼고 내려요.',
      ],
      en: [
        'Stand beside a wall with about 30 cm between your left shoulder and the wall — close enough to touch with a bent elbow if you wobble.',
        'Stand tall with your feet together and fix your gaze on a point at eye level about 3 m ahead.',
        'Let your arms hang relaxed at your sides.',
      ],
    },
    steps: {
      ko: [
        '오른발을 들어 왼발 바로 앞에 내려놓아요. 오른발 뒤꿈치가 왼발 엄지발가락 끝에 닿도록 한 줄로 놓아요.',
        '체중을 두 발에 반씩 싣고, 무릎은 살짝 풀어 둬요.',
        '정수리를 천장으로 길게 뻗고, 정한 점에 시선을 고정한 채 30초 버텨요.',
        '작게 흔들리는 건 발목과 엉덩이로 잡고, 넘어질 것 같으면 바로 벽을 짚어요.',
        '발을 바꿔 왼발을 앞에 두고 30초 해요.',
      ],
      en: [
        'Lift your right foot and set it directly in front of the left, right heel touching the tip of the left big toe, in one line.',
        'Share your weight evenly between both feet and keep your knees soft.',
        'Grow tall through the crown of your head and hold for 30 seconds, eyes fixed on your point.',
        'Catch small wobbles with your ankles and hips; if you’re about to fall, touch the wall right away.',
        'Switch so the left foot is in front and hold for 30 seconds.',
      ],
    },
    breathing: {
      ko: '코로 천천히 들이마시고 입으로 길게 내쉬며 호흡을 고르게 유지해요. 숨을 참으면 몸이 굳어 더 흔들려요.',
      en: 'Breathe slowly in through your nose and long out through your mouth. Holding your breath stiffens you and makes you wobble more.',
    },
    feel: {
      ko: '발바닥과 발목 주변 작은 근육이 쉬지 않고 미세하게 조절하고, 엉덩이 옆과 배가 은은하게 일하면 정답이에요. 어지럽거나 시야가 흔들리면 바로 벽을 짚고 멈춰요.',
      en: 'The small muscles of your feet and ankles make constant tiny corrections, and the sides of your hips and your core work gently. If you feel dizzy or your vision swims, touch the wall and stop.',
    },
    easier: {
      ko: '앞발을 뒷발 옆으로 반 발 비켜 놓거나(반 일자 서기), 손끝을 벽에 댄 채 해요.',
      en: 'Offset the front foot half a foot-width to the side (semi-tandem), or keep your fingertips on the wall.',
    },
    harder: {
      ko: '팔짱을 끼거나, 고개를 천천히 좌우로 돌리거나, 벽 옆에서 눈을 감고 10초씩 버텨요. 그다음엔 발뒤꿈치와 발끝을 이어 붙이며 일자로 걷기를 해요.',
      en: 'Fold your arms, turn your head slowly side to side, or close your eyes for 10 seconds at a time beside the wall. Then progress to heel-to-toe walking along a line.',
    },
    cues: {
      ko: ['뒤꿈치를 발끝에', '시선은 한 점에', '정수리는 위로', '무릎은 살짝 풀어요'],
      en: ['Heel to toe', 'Eyes on one point', 'Crown up', 'Soft knees'],
    },
    mistakes: {
      ko: [
        '두 발 사이가 벌어짐 → 앞발 뒤꿈치와 뒷발 엄지발가락 끝이 닿게, 한 줄 위에 놓아요.',
        '발밑을 내려다봄 → 발 위치를 확인했으면 시선을 앞의 한 점으로 올려요.',
        '팔을 크게 휘저음 → 팔은 몸 옆에 두고 발목과 엉덩이로 균형을 잡아요.',
        '무릎을 꽉 잠그고 숨을 참음 → 무릎을 살짝 풀고 천천히 숨 쉬어요.',
      ],
      en: [
        'Gap between the feet → Touch the front heel to the back big toe, both on one line.',
        'Looking down at your feet → Once they’re placed, lift your eyes to the point ahead.',
        'Windmilling the arms → Keep your arms by your sides and balance from the ankles and hips.',
        'Locking the knees and holding your breath → Unlock the knees slightly and breathe slowly.',
      ],
    },
    why: {
      ko: '두 발이 한 줄에 있어 좌우 흔들림을 발목과 엉덩이 옆 근육이 잡아야 해요. 한쪽으로 치우쳐 서는 버릇을 줄이고 걷기 균형을 길러, 넘어짐 예방 운동으로 널리 쓰여요.',
      en: 'With the feet on one line, your ankles and side-hip muscles must catch every sideways sway. It reduces the habit of leaning to one side and trains walking balance — a widely used fall-prevention drill.',
    },
    muscles: {
      ko: '중둔근, 발목 안정근(긴종아리근·뒤정강근), 발바닥 작은 근육, 코어',
      en: 'Gluteus medius, ankle stabilisers (peroneals, tibialis posterior), small foot muscles, core',
    },
    caution: {
      ko: '최근 넘어진 적이 있거나 어지럼이 있다면 반드시 벽이나 튼튼한 의자 옆에서, 다른 사람이 곁에 있을 때 하세요.',
      en: 'If you’ve fallen recently or get dizzy, always do this next to a wall or sturdy chair with someone nearby.',
    },
    avoid: ['balance'],
    anim: {
      view: 62,
      elev: 18,
      props: [{ kind: 'wall', wall: 'left', dist: 10 }],
      anchor: ['pelvis'],
      keys: [
        FEET_TOGETHER,
        merge(FEET_TOGETHER, { hipR: { flex: 30, abd: -5 }, knR: 45, anR: 0 }),
        TANDEM,
      ],
      labels: [
        { ko: '벽 옆에 바르게 서기', en: 'Stand tall beside a wall' },
        { ko: '오른발을 앞으로', en: 'Bring the right foot forward' },
        { ko: '일자로 서서 30초', en: 'Heel to toe, hold 30 s' },
      ],
      durations: [1.2, 1.2, 1.6],
      pauses: [0.6, 0.3, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'shR', side: 'out', kind: 'work', from: 0, to: 0.28, r: 2.8 },
        { a: 'hipL', b: 'shL', side: 'out', kind: 'work', from: 0, to: 0.28, r: 2.8 },
        { a: 'knR', b: 'anR', side: 'out', kind: 'work', from: 0.3, to: 0.95, r: 2 },
        { a: 'knL', b: 'anL', side: 'out', kind: 'work', from: 0.3, to: 0.95, r: 2 },
      ],
      trace: ['toeR'],
      zoom: 1.15,
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'wrist-extensor-stretch',
    name: { ko: '손목 폄근 스트레칭', en: 'Wrist extensor stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['wrist'],
    targets: { wristPain: 0.9, stiffness: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '바르게 서서(앉아도 좋아요) 오른팔을 어깨보다 조금 낮게 몸 앞 가운데 쪽으로 뻗고, 팔꿈치를 끝까지 펴요.',
        '오른손바닥이 바닥을 향하게 하고 손가락은 가볍게 모아요.',
        '어깨는 귀에서 멀리 내리고, 왼손을 오른손등 위로 가져갈 준비를 해요.',
      ],
      en: [
        'Stand tall (or sit) and reach your right arm forward toward your midline, just below shoulder height, elbow fully straight.',
        'Turn the right palm to face the floor with the fingers loosely together.',
        'Keep your shoulders down away from your ears and bring your left hand up over the back of your right hand.',
      ],
    },
    steps: {
      ko: [
        '왼손바닥을 오른손등(손가락 뿌리 마디 부분)에 얹어요.',
        '오른손끝이 바닥을 향하도록 손목을 아래로 굽히고, 왼손으로 손등을 몸 쪽으로 2~3초에 걸쳐 부드럽게 당겨요.',
        '손등부터 팔꿈치 바깥쪽까지 아래팔 위쪽이 당기면 멈추고 30초 버텨요.',
        '더 늘리고 싶으면 오른손을 가볍게 주먹 쥐고, 손목을 새끼손가락 쪽으로 살짝 틀어요.',
        '천천히 풀고 팔을 바꿔 왼쪽도 30초 해요.',
      ],
      en: [
        'Rest your left palm on the back of your right hand, over the knuckles.',
        'Bend the right wrist down so the fingers point at the floor, and over 2–3 seconds gently draw the back of the hand toward you with your left hand.',
        'Stop when the top of the forearm — from the back of the hand to the outer elbow — pulls, and hold for 30 seconds.',
        'For more stretch, make a loose fist with the right hand and tilt the wrist slightly toward the little-finger side.',
        'Release slowly, switch arms and hold the left side for 30 seconds.',
      ],
    },
    breathing: {
      ko: '내쉴 때 아래팔 힘을 빼며 손을 조금 더 당기고, 버티는 동안 코로 천천히 숨 쉬어요.',
      en: 'As you exhale, relax the forearm and draw the hand in a little more; breathe slowly through your nose while holding.',
    },
    feel: {
      ko: '손등과 아래팔 위쪽(팔꿈치 바깥쪽까지)이 은은하게 당기면 정답이에요. 손가락이 저리거나 찌릿하면 팔을 조금 내리거나 당기는 힘을 줄이고, 팔꿈치 바깥쪽이 날카롭게 아프면 멈춰요.',
      en: 'A gentle pull along the back of the hand and the top of the forearm, up to the outer elbow. If your fingers tingle, lower the arm or pull less; stop with a sharp pain at the outer elbow.',
    },
    easier: {
      ko: '팔꿈치를 살짝 굽힌 채 하거나, 책상 위에 아래팔을 올리고 손만 책상 끝 밖으로 내밀어 손목을 아래로 떨어뜨려요.',
      en: 'Keep the elbow slightly bent, or rest your forearm on a desk with the hand past the edge and let the wrist drop.',
    },
    harder: {
      ko: '주먹을 쥔 채 팔꿈치를 끝까지 펴고 45초까지 버텨요. 팔을 몸 옆으로 내린 채 같은 방법으로 하면 팔꿈치 바깥쪽이 더 늘어나요.',
      en: 'Make a fist, keep the elbow fully straight and hold for up to 45 seconds. Doing it with the arm down by your side stretches the outer elbow even more.',
    },
    cues: {
      ko: ['팔꿈치는 쭉', '손끝은 바닥으로', '부드럽게 당겨요', '어깨는 내려요'],
      en: ['Elbow straight', 'Fingers to the floor', 'Gentle pull', 'Shoulders down'],
    },
    mistakes: {
      ko: [
        '팔꿈치가 굽음 → 팔꿈치를 끝까지 펴야 팔꿈치 바깥쪽까지 늘어나요.',
        '손가락 끝만 당김 → 손가락이 아니라 손등(손바닥뼈 부분)을 눌러 손목을 굽혀요.',
        '어깨가 으쓱 올라감 → 팔을 어깨보다 조금 낮추고 어깨를 귀에서 멀리 내려요.',
        '세게 꺾음 → 70% 정도로 당겨지는 지점에서 멈추고 숨 쉬며 버텨요.',
      ],
      en: [
        'Bending the elbow → Keep it fully straight so the stretch reaches the outer elbow.',
        'Pulling only the fingertips → Press on the back of the hand, not the fingers, to bend the wrist.',
        'Shoulder hiking → Lower the arm slightly and draw the shoulder down.',
        'Cranking hard → Stop at about 70% tension and breathe through the hold.',
      ],
    },
    why: {
      ko: '마우스·키보드·스마트폰을 오래 쓰면 손목을 뒤로 젖혀 버티는 폄근이 계속 긴장해 손등과 팔꿈치 바깥쪽이 뻐근해져요. 이 근육만 따로 늘려 손목과 팔꿈치 부담을 덜어 줘요.',
      en: 'Long mouse, keyboard and phone use keeps the wrist extensors tense as they hold the wrist cocked back, so the back of the hand and the outer elbow ache. Stretching them on their own takes load off the wrist and elbow.',
    },
    muscles: {
      ko: '손목 폄근(짧은·긴노쪽손목폄근, 자쪽손목폄근), 손가락 폄근',
      en: 'Wrist extensors (extensor carpi radialis brevis and longus, extensor carpi ulnaris), finger extensors',
    },
    caution: {
      ko: '손가락 저림이 계속되거나 팔꿈치 바깥쪽 통증이 심하면 무리하지 말고 전문가와 상의하세요.',
      en: 'If finger tingling persists or the outer-elbow pain is strong, don’t push — check with a professional.',
    },
    anim: {
      view: 80,
      elev: 16,
      keys: [EXT_READY, EXT_HAND_ON, EXT_PRESS],
      labels: [
        { ko: '오른팔 쭉, 손바닥 아래', en: 'Right arm long, palm down' },
        { ko: '왼손을 손등 위에', en: 'Left hand on the back' },
        { ko: '손끝 아래로 당겨 30초', en: 'Fingers down, hold 30 s' },
      ],
      durations: [1.2, 1.6, 1.4],
      pauses: [0.5, 0.4, 3],
      holdKey: 2,
      focus: [{ a: 'elR', b: 'wrR', side: 'front', kind: 'stretch', from: 0.05, to: 0.95, r: 2.2 }],
      trace: ['haR'],
      zoom: 1.3,
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'prayer-stretch',
    name: { ko: '합장 손목 스트레칭', en: 'Prayer wrist stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['wrist'],
    targets: { wristPain: 0.8, stiffness: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '바르게 서거나 의자에 앉아, 두 손바닥을 가슴 앞(명치 높이)에서 맞대요. 손끝은 천장을 향해요.',
        '팔꿈치는 양옆으로 편하게 벌려 손보다 조금 낮게 둬요.',
        '어깨는 귀에서 멀리 내리고, 손은 가슴에서 주먹 하나 거리만큼 떨어뜨려요.',
      ],
      en: [
        'Stand or sit tall and press your palms together in front of your chest at breastbone level, fingertips pointing up.',
        'Let your elbows open out to the sides, a little lower than your hands.',
        'Keep your shoulders down away from your ears and your hands a fist-width from your chest.',
      ],
    },
    steps: {
      ko: [
        '손바닥 뿌리(손목 쪽)끼리 꼭 붙인 채, 두 손을 몸 가운데 선을 따라 3초에 걸쳐 천천히 내려요.',
        '손이 내려갈수록 아래팔이 바닥과 수평에 가까워지고 팔꿈치가 옆으로 벌어져요. 손바닥 뿌리가 떨어지기 직전, 대개 배꼽 높이에서 멈춰요.',
        '손목 안쪽과 아래팔 안쪽이 당기는 자리에서 30초 버텨요.',
        '천천히 손을 가슴 높이로 올려 풀고, 손목을 가볍게 털어요.',
        '잠시 쉬고 한 번 더 해요.',
      ],
      en: [
        'Keeping the heels of your palms pressed together, take 3 seconds to slide both hands slowly down your midline.',
        'As the hands lower, the forearms level out and the elbows widen. Stop just before the heels of the palms start to separate — usually around navel height.',
        'Hold for 30 seconds where the insides of your wrists and forearms pull.',
        'Slowly raise the hands back to chest height to release, then gently shake out your wrists.',
        'Rest a moment and do it once more.',
      ],
    },
    breathing: {
      ko: '내쉴 때마다 손을 1cm씩 더 내리고, 버티는 동안 코로 천천히 숨 쉬어요.',
      en: 'Lower the hands about 1 cm with each exhale, breathing slowly through your nose during the hold.',
    },
    feel: {
      ko: '손목 안쪽과 아래팔 안쪽(손바닥 쪽)이 은은하게 당기면 정답이에요. 엄지·검지·중지가 저리거나 찌릿하면 바로 손을 올려 범위를 줄이고, 그래도 계속되면 멈춰요.',
      en: 'A gentle pull across the insides of the wrists and the palm side of the forearms. If your thumb, index or middle finger tingles or goes numb, raise your hands right away to ease off, and stop if it continues.',
    },
    easier: {
      ko: '손을 가슴 높이에 둔 채 손바닥만 맞대고 10~20초 버티거나, 한 손씩 하는 ‘손목 앞뒤 스트레칭’으로 바꿔요.',
      en: 'Keep the hands at chest height with the palms together for 10–20 seconds, or switch to the one-hand wrist flexor & extensor stretch.',
    },
    harder: {
      ko: '손바닥을 붙인 채 배꼽 아래까지 내려 45초 버텨요. 마무리로 손등끼리 맞대고 손끝이 바닥을 향하게 하는 ‘거꾸로 합장’을 하면 손목 폄근까지 늘어나요.',
      en: 'Lower the hands below the navel with the palms still together and hold for 45 seconds. Finish with a reverse prayer — backs of the hands together, fingers pointing down — to stretch the extensors too.',
    },
    cues: {
      ko: ['손바닥 뿌리 꼭', '천천히 내려요', '팔꿈치는 옆으로', '어깨는 내려요'],
      en: ['Heels of palms together', 'Lower slowly', 'Elbows wide', 'Shoulders down'],
    },
    mistakes: {
      ko: [
        '손바닥 뿌리가 떨어짐 → 손바닥 전체가 붙어 있는 높이까지만 내려요.',
        '어깨가 으쓱 올라감 → 어깨를 귀에서 멀리 내리고 팔꿈치를 옆으로 벌리는 데 집중해요.',
        '손이 몸에 붙거나 멀어짐 → 손은 가슴·배에서 주먹 하나 거리를 유지해요.',
        '손가락이 저린데도 버팀 → 저림은 신경이 눌린다는 신호예요. 바로 손을 올려 범위를 줄여요.',
      ],
      en: [
        'Heels of the palms separating → Lower only as far as the whole palm stays together.',
        'Shoulders shrugging → Drop them away from your ears and focus on widening the elbows.',
        'Hands drifting into the body or away from it → Keep them a fist-width from your chest and belly.',
        'Holding through tingling → Tingling means a nerve is being squeezed; raise your hands straight away to ease off.',
      ],
    },
    why: {
      ko: '물건을 쥐고 타이핑하는 동안 손목을 굽히는 근육(굽힘근)은 하루 종일 짧아져 있어요. 두 손을 맞대 손목을 부드럽게 젖히면 두 팔의 아래팔 안쪽이 한 번에 고르게 늘어나요.',
      en: 'The muscles that bend the wrist and grip stay shortened all day as you hold things and type. Pressing the palms together gently extends both wrists at once, evenly stretching the palm side of both forearms.',
    },
    muscles: {
      ko: '손목 굽힘근(노쪽·자쪽손목굽힘근), 손가락 굽힘근, 손바닥 근막',
      en: 'Wrist flexors (flexor carpi radialis and ulnaris), finger flexors, palmar fascia',
    },
    caution: {
      ko: '밤에 손가락이 저려 깨거나 저림이 자주 있다면 이 자세가 증상을 키울 수 있어요. 무리하지 말고 전문가와 상의하세요.',
      en: 'If your fingers often go numb or wake you at night, this position can aggravate it — don’t push, and check with a professional.',
    },
    avoid: ['wristPain'],
    anim: {
      view: 12,
      elev: 10,
      keys: [PRAYER_CHEST, PRAYER_LOW],
      labels: [
        { ko: '가슴 앞에서 합장', en: 'Palms together at the chest' },
        { ko: '배꼽 쪽으로 내려 30초', en: 'Lower to the navel, 30 s' },
      ],
      durations: [3, 2],
      pauses: [0.8, 3],
      focus: [
        { a: 'elR', b: 'wrR', side: 'front', kind: 'stretch', from: 0.1, to: 0.95, r: 2 },
        { a: 'elL', b: 'wrL', side: 'front', kind: 'stretch', from: 0.1, to: 0.95, r: 2 },
      ],
      trace: ['wrR'],
      zoom: 1.2,
    },
  },
];
