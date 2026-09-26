/**
 * 운동 라이브러리 · 무릎·하체 근력
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { SIT, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 조각 ─────────────────────
// 발이 바닥에 평평하려면 발목 an ≈ (root pitch) − (고관절 flex) + (무릎 굽힘) 이에요.

/** 팔짱: 아래팔을 가슴 가운데에서 X자로 겹치고, 오른손은 왼 위팔·왼손은 오른 위팔 위에
 *  (공용 ARMS_CROSSED 는 팔이 교차하지 않고 두 주먹이 얼굴 앞에 떠 보여서 이 파일에서 따로 씀) */
const X_ARMS: Pose = { shR: { flex: 58, abd: 12, rot: -72, hab: -12 }, elR: 112, wrR: -10, shL: { flex: 54, abd: 16, rot: -72, hab: -12 }, elL: 106, wrL: 0 };

/** 두 손을 허리에: 손목은 골반뼈 위(허리 아래 옆), 손끝은 골반 앞, 팔꿈치는 옆·뒤로
 *  (공용 HANDS_ON_HIPS 는 옆에서 보면 아래팔이 배 앞으로 튀어나와 보여서 이 파일에서 따로 씀) */
const HIPS_HANDS: Pose = both({ sh: { flex: -28, abd: 38, rot: -48 }, el: 102, wr: -10 });

/** 스쿼트 다리: 깊어질수록 수평 벌림(hab)으로 무릎을 발끝 방향(바깥)으로 보냄 → 발 위치는 그대로 */
const squatLegs = (flex: number, abd: number, hab: number, kn: number, an: number): Pose => both({ hip: { flex, abd, hab }, kn, an });
const SQUAT_TOP: Pose = merge(STAND, squatLegs(0, 5, 0, 2, 2));
const SQUAT_MID: Pose = merge(
  STAND,
  { root: { pitch: 14 }, lumbar: { flex: 2 }, thorax: { flex: 2 }, neck: { flex: -6 } },
  squatLegs(50, 4, 6, 54, 17),
  both({ sh: { flex: 70, abd: 4 }, el: 8 }),
);
const SQUAT_LOW: Pose = merge(
  STAND,
  { root: { pitch: 30 }, lumbar: { flex: 4 }, thorax: { flex: 4 }, neck: { flex: -14 }, head: { flex: -4 } },
  squatLegs(114, 2, 12, 118, 33),
  both({ sh: { flex: 118, abd: 4 }, el: 4 }),
);

/** 의자 앉았다 일어서기: 발뒤꿈치 고정(무릎보다 주먹 하나 뒤) */
const STS_SIT: Pose = merge(SIT, X_ARMS, both({ hip: { flex: 88, abd: 6 }, kn: 100, an: 12 }));
const STS_LEAN: Pose = merge(
  SIT,
  X_ARMS,
  { root: { pitch: 26 }, lumbar: { flex: 4 }, thorax: { flex: 6 }, neck: { flex: -16 }, head: { flex: -4 } },
  both({ hip: { flex: 114, abd: 6 }, kn: 100, an: 12 }),
);
const STS_STAND: Pose = merge(STAND, X_ARMS, both({ hip: { flex: 0, abd: 3 }, kn: 2, an: 2 }));
const STS_LOWER: Pose = merge(
  STAND,
  X_ARMS,
  { root: { pitch: 30 }, lumbar: { flex: 4 }, thorax: { flex: 4 }, neck: { flex: -14 } },
  both({ hip: { flex: 80, abd: 5 }, kn: 68, an: 18 }),
);

/** 스플릿 스쿼트: 오른발 앞(일하는 다리) · 왼발 뒤꿈치 들기. 두 발끝 위치가 모든 키에서 같도록 맞춤 */
const splitLegs = (hr: number, kr: number, ar: number, hl: number, kl: number, al: number): Pose =>
  merge(STAND, HIPS_HANDS, { hipR: { flex: hr, abd: 3 }, knR: kr, anR: ar, hipL: { flex: hl, abd: 3 }, knL: kl, anL: al });
const SPLIT_TOP = splitLegs(29, 5, -24, -32, 14, 10);
const SPLIT_MID = splitLegs(46, 39, -7, -21, 39, 16);
const SPLIT_LOW = splitLegs(84, 87, 3, -4, 97, 47);

/** 힙 힌지: 정강이는 거의 수직, 엉덩이만 뒤로 */
const HINGE_TOP: Pose = merge(STAND, HIPS_HANDS, both({ hip: { flex: 4, abd: 2 }, kn: 16, an: 12 }));
const HINGE_MID: Pose = merge(STAND, HIPS_HANDS, { root: { pitch: 28 }, neck: { flex: -8 } }, both({ hip: { flex: 44, abd: 2 }, kn: 18, an: 2 }));
const HINGE_LOW: Pose = merge(STAND, HIPS_HANDS, { root: { pitch: 56 }, neck: { flex: -12 } }, both({ hip: { flex: 80, abd: 2 }, kn: 21, an: -3 }));

/** 의자 햄스트링: 오른다리 쭉 펴 뒤꿈치를 바닥에 (허벅지 각도는 모든 키에서 같게 → 다리를 굽혔다 펴는 동작이 없어 바닥에 파묻히지 않음) */
const HAM_LEG_R: Pose = { hipR: { flex: 61, abd: 6 }, knR: 3.5, anR: 14 };
/** 오른손은 오른 허벅지 위, 왼손은 왼 허벅지 옆 */
const HAM_HAND_R: Pose = { shR: { flex: 0, abd: -5, hab: -5 }, elR: 52 };
/** 걸터앉아 오른다리를 편 준비 자세(발목은 힘 빼고 중립). 발목만 바꾸면 뒤꿈치 점이 앞뒤로 미끄러지고 몸이 떠서,
 *  무릎을 1.5° 더 펴 두 발이 모두 바닥에 닿고 뒤꿈치 자리도 거의 그대로이게 맞춤 */
const HAM_SIT: Pose = merge(SIT, HAM_LEG_R, HAM_HAND_R, { lumbar: { flex: 1 }, knR: 2, anR: 0, anL: 0 });
/** 발끝을 몸 쪽으로 당기고 허리를 길게 세움 */
const HAM_READY: Pose = merge(SIT, HAM_LEG_R, HAM_HAND_R, { lumbar: { flex: -3 }, thorax: { flex: -2 }, anL: 0 });
/** 골반부터 숙여 두 손이 오른 정강이로 미끄러짐 (허벅지 각도는 그대로) */
const HAM_FOLD: Pose = merge(HAM_SIT, HAM_LEG_R, {
  root: { pitch: 22 },
  lumbar: { flex: 6 },
  thorax: { flex: 6 },
  neck: { flex: -12 },
  hipR: { flex: 83, abd: 6 },
  hipL: { flex: 110, abd: 6 },
  anL: 0,
  shR: { flex: 55, abd: -13, hab: 0 },
  elR: 3,
  shL: { flex: 48, abd: -33 },
  elL: 6,
});

/** 서서 허벅지 앞: 벽을 마주 보고 왼손을 어깨 높이로 벽에 */
const WALL_HAND_L: Pose = { shL: { flex: 82, abd: 4 }, elL: 12 };
const QUAD_STAND: Pose = merge(STAND, WALL_HAND_L, both({ kn: 5, an: 5 }));
/** 오른손으로 오른 발등을 잡음 (허벅지는 수직) */
const QUAD_HOLD: Pose = merge(STAND, WALL_HAND_L, { knL: 5, anL: 5, hipR: { flex: 2, abd: 1 }, knR: 146, anR: -32, shR: { flex: -35, abd: -7 }, elR: 18 });
/** 꼬리뼈 말기: 골반을 10° 뒤로 기울이고(허리 4°·등 6°가 나눠 받쳐 상체는 곧게) 오른무릎을 약 5cm 뒤로.
 *  허리 굽힘만으로 되돌리면 골반~허리 선이 그대로라 그림에서 기울기가 보이지 않아요.
 *  몸통이 살짝 뒤로 가는 만큼 왼 어깨를 내밀어(prot) 벽 짚은 손은 제자리, 오른손은 발등을 그대로 잡음 */
const QUAD_TUCK: Pose = merge(STAND, WALL_HAND_L, {
  root: { pitch: -10 },
  lumbar: { flex: 4 },
  thorax: { flex: 6 },
  hipL: { flex: -10 },
  knL: 5,
  anL: 5,
  scapL: { prot: 1.3 },
  hipR: { flex: -15, abd: 1 },
  knR: 140,
  anR: -32,
  shR: { flex: -36, abd: -7 },
  elR: 16,
});

export const LEGS: Exercise[] = [
  {
    id: 'squat',
    name: { ko: '맨몸 스쿼트', en: 'Bodyweight squat' },
    phase: 'integrate',
    position: 'standing',
    regions: ['glute', 'knee', 'hip'],
    targets: { kneeValgus: 0.7, kneeHyperext: 0.4, lordosis: 0.3, hipPain: 0.2 },
    equipment: [],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, rest: 30 },
    setup: {
      ko: [
        '발을 어깨너비로 벌리고, 발끝은 바깥으로 10~15도 살짝 돌려요.',
        '체중은 발바닥 세 점(엄지발가락 뿌리·새끼발가락 뿌리·뒤꿈치)에 고르게 싣고, 팔은 몸 옆에 편하게 내려요.',
        '갈비뼈를 살짝 내려 배에 가볍게 힘을 주고, 시선은 2~3m 앞 정면에 둬요.',
      ],
      en: [
        'Stand with your feet shoulder-width apart and your toes turned out slightly (10–15°).',
        'Spread your weight evenly over three points of each foot — big-toe base, little-toe base and heel — with your arms relaxed at your sides.',
        'Draw your ribs down to lightly brace your belly, and look straight ahead at a point 2–3 m away.',
      ],
    },
    steps: {
      ko: [
        '코로 숨을 들이마시고 배에 힘을 준 채, 엉덩이를 뒤로 빼면서 무릎을 함께 굽히기 시작해요.',
        '2초에 걸쳐 내려가며 두 팔을 앞으로 뻗어 균형을 잡아요. 무릎은 두 번째 발가락 방향으로 밀어요.',
        '허벅지가 바닥과 거의 평행해지거나 허리가 둥글게 말리기 직전까지 내려가 0.5초 멈춰요.',
        '입으로 내쉬며 발바닥 전체로 바닥을 밀어 2초에 걸쳐 일어나고, 팔은 다시 내려요.',
        '맨 위에서 엉덩이를 가볍게 조여 골반을 세우되 무릎은 뒤로 잠그지 않아요. 10회 반복해요.',
      ],
      en: [
        'Breathe in through your nose, brace your belly, and start by pushing your hips back as your knees bend.',
        'Lower over 2 seconds, reaching both arms forward for balance and pushing your knees toward your second toes.',
        'Go down until your thighs are about parallel to the floor — or just before your low back starts to round — and pause for half a second.',
        'Breathe out and push the floor away with your whole foot to stand up over 2 seconds, lowering your arms.',
        'At the top, lightly squeeze your glutes to stack your pelvis without locking your knees back. Repeat 10 times.',
      ],
    },
    breathing: {
      ko: '내려가기 전에 코로 들이마시고, 배에 힘을 준 채 내려가요. 일어날 때 입으로 “후—” 내쉬어요. 숨을 참고 버티지 마세요.',
      en: 'Breathe in through your nose before you go down and keep your belly braced on the way down. Breathe out (“whoo”) as you stand. Don’t hold your breath.',
    },
    feel: {
      ko: '엉덩이와 허벅지 앞이 뻐근하게 일하고, 발바닥 전체로 바닥을 누르는 느낌이면 정답이에요. 무릎 앞이나 안쪽이 날카롭게 아프거나 허리가 조이면 범위를 줄이고, 계속되면 멈춰요.',
      en: 'Your glutes and the fronts of your thighs should work hard while your whole foot presses into the floor. If you feel sharp pain at the front or inside of the knee, or your low back pinches, shorten the range — and stop if it continues.',
    },
    easier: {
      ko: '의자를 엉덩이 뒤에 두고, 엉덩이가 살짝 닿으면 바로 일어나는 “의자 터치 스쿼트”로 해요. 그래도 힘들면 깊이를 절반으로 줄이거나 ‘의자 앉았다 일어서기’로 바꿔요.',
      en: 'Put a chair behind you and stand back up as soon as your buttocks lightly touch it (a box squat). If that’s still hard, go half as deep or switch to sit-to-stands.',
    },
    harder: {
      ko: '내려가는 시간을 4초로 늘리고 맨 아래에서 2초 버텨요. 익숙해지면 물병이나 가방을 가슴 앞에 안고(고블릿 스쿼트) 하거나 ‘스플릿 스쿼트’로 넘어가요.',
      en: 'Slow the descent to 4 seconds and hold 2 seconds at the bottom. Then hug a water bottle or bag to your chest (goblet squat), or progress to split squats.',
    },
    cues: { ko: ['엉덩이를 뒤로', '무릎은 발끝 방향', '가슴은 앞을 봐요', '발바닥 전체로 밀어요'], en: ['Hips back', 'Knees follow your toes', 'Chest faces forward', 'Push through the whole foot'] },
    mistakes: {
      ko: [
        '무릎이 안쪽으로 모임 → 무릎을 두 번째 발가락 방향으로 살짝 벌려 밀고, 엄지발가락 뿌리는 바닥에 붙여 둬요.',
        '뒤꿈치가 들림 → 체중을 발 가운데~뒤꿈치에 두고 엉덩이를 더 뒤로 빼요. 발목이 뻣뻣하면 발 간격을 조금 넓혀요.',
        '맨 아래에서 허리가 둥글게 말림 → 말리기 직전까지만 내려가고, 가슴이 앞을 보도록 유지해요.',
        '무릎부터 굽혀 몸이 앞으로 쏠림 → 엉덩이를 뒤로 빼는 것으로 시작해 엉덩이와 무릎을 함께 굽혀요.',
      ],
      en: [
        'Knees caving in → Push your knees out toward your second toes while keeping the big-toe base on the floor.',
        'Heels lifting → Keep your weight over mid-foot to heel and sit your hips further back. If your ankles are stiff, widen your stance a little.',
        'Low back rounding at the bottom → Stop just before it rounds and keep your chest facing forward.',
        'Bending the knees first and tipping forward → Start by sending your hips back, then bend hips and knees together.',
      ],
    },
    why: {
      ko: '교정한 정렬을 실제 움직임에서 쓰도록 연결하는 통합 운동이에요. 엉덩이 힘으로 무릎을 발끝 방향에 두는 연습이라, 무릎이 안으로 모이거나 뒤로 잠기는 습관을 함께 바로잡아요.',
      en: 'An integration move that carries your new alignment into real movement. Using your glutes to keep your knees in line with your toes helps retrain knees that cave in or lock back.',
    },
    muscles: { ko: '대둔근, 대퇴사두근, 내전근, 햄스트링(보조), 복부·허리 코어', en: 'Glutes, quadriceps, adductors, hamstrings (assist), abdominal and back core' },
    caution: { ko: '무릎이나 허리가 아프면 범위를 줄이거나 ‘의자 앉았다 일어서기’로 대신하세요.', en: 'If your knees or back hurt, shorten the range or do sit-to-stands instead.' },
    avoid: ['kneeSevere', 'kneePain'],
    anim: {
      view: 90,
      keys: [SQUAT_TOP, SQUAT_MID, SQUAT_LOW],
      labels: [
        { ko: '발 어깨너비로 서기', en: 'Feet shoulder-width' },
        { ko: '엉덩이 뒤로 빼며 앉기', en: 'Hips back, sit down' },
        { ko: '허벅지 수평까지', en: 'Thighs to parallel' },
      ],
      durations: [1, 1, 1.8],
      pauses: [0.3, 0, 0.5],
      focus: [
        { a: 'waist', b: 'sitR', side: 'back', kind: 'work', r: 3.6, from: 0.45, to: 1.05 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
      ],
      trace: ['pelvis'],
    },
    coach: {
      view: 'side',
      metric: 'kneeAngle',
      mode: 'reps',
      rest: 160,
      peak: 115,
      dir: -1,
      hint: { ko: '옆에서 온몸이 보이게 2~3m 떨어진 곳에 휴대폰을 세워 주세요', en: 'Place the phone 2–3 m to your side so your whole body is visible' },
      more: { ko: '조금 더 깊게', en: 'A little deeper' },
      good: { ko: '좋아요!', en: 'Good depth!' },
    },
  },
  {
    id: 'sit-to-stand',
    name: { ko: '의자 앉았다 일어서기', en: 'Sit-to-stand' },
    phase: 'integrate',
    position: 'standing',
    regions: ['glute', 'knee'],
    targets: { kneeValgus: 0.5, kneePain: 0.3, hipPain: 0.3, lowBackPain: 0.2 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, rest: 30 },
    desk: true,
    setup: {
      ko: [
        '바퀴 없는 튼튼한 의자를 벽에 붙여 두고, 의자 앞쪽 절반에 걸터앉아요.',
        '발은 골반 너비로 벌려 바닥에 평평하게 두고, 발뒤꿈치를 무릎보다 주먹 하나만큼 뒤로 당겨요.',
        '두 팔은 가슴 앞에서 X자로 모으고, 골반을 세워 허리를 곧게 펴요.',
      ],
      en: [
        'Put a sturdy chair without wheels against a wall and sit on the front half of the seat.',
        'Place your feet flat, hip-width apart, with your heels pulled back about a fist’s width behind your knees.',
        'Cross your arms over your chest and sit up tall on your sit bones.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 허리를 편 채 골반부터 앞으로 숙여, 코가 발끝 위에 오게 해요.',
        '체중이 발바닥으로 옮겨 오면 입으로 내쉬며 발바닥 전체로 바닥을 밀어 2초에 걸쳐 일어나요.',
        '다 서면 엉덩이를 가볍게 조여 골반을 세워요. 무릎은 뒤로 잠그지 않아요.',
        '엉덩이를 뒤로 빼며 상체를 숙이고, 2초에 걸쳐 천천히 앉아요. 털썩 앉지 않아요.',
        '엉덩이가 의자에 닿으면 허리를 다시 세우고, 10회 반복해요.',
      ],
      en: [
        'Breathe in and, keeping your back long, hinge forward from the hips until your nose is over your toes.',
        'Once your weight shifts onto your feet, breathe out and push through your whole foot to stand up over 2 seconds.',
        'At the top, lightly squeeze your glutes to stack your pelvis, without locking your knees.',
        'Push your hips back, lean your chest forward and take 2 seconds to sit down slowly — no plopping.',
        'When your buttocks touch the seat, sit tall again. Repeat 10 times.',
      ],
    },
    breathing: {
      ko: '앉은 채 숙이면서 코로 들이마시고, 일어서는 동안 입으로 “후—” 내쉬어요. 앉을 때 다시 들이마셔요.',
      en: 'Breathe in through your nose as you lean forward, breathe out (“whoo”) as you stand, and breathe in again as you sit down.',
    },
    feel: {
      ko: '엉덩이와 허벅지 앞이 힘쓰고, 두 발바닥에 체중이 고르게 실리면 정답이에요. 무릎 앞이 욱신거리면 의자를 높이고, 날카로운 통증이 있으면 멈춰요.',
      en: 'Your glutes and the fronts of your thighs should do the work, with weight spread evenly over both feet. If the front of your knee aches, use a higher seat; stop if the pain is sharp.',
    },
    easier: {
      ko: '방석을 1~2개 올려 의자를 높이거나, 손으로 허벅지를 가볍게 짚고 일어나요. 횟수를 5회로 줄여도 괜찮아요.',
      en: 'Raise the seat with 1–2 cushions or push lightly on your thighs with your hands. It’s fine to cut it to 5 reps.',
    },
    harder: {
      ko: '앉는 시간을 4초로 늘리고, 엉덩이가 의자에 닿기만 하고 바로 일어나요. 더 낮은 의자를 쓰거나, 익숙해지면 ‘맨몸 스쿼트’로 넘어가요.',
      en: 'Take 4 seconds to sit and stand back up the moment you touch the seat. Use a lower chair, or progress to bodyweight squats.',
    },
    cues: { ko: ['코는 발끝 위로', '발바닥으로 밀어요', '위에서 엉덩이 조여요', '천천히 앉아요'], en: ['Nose over toes', 'Push through your feet', 'Squeeze at the top', 'Sit down slowly'] },
    mistakes: {
      ko: [
        '손으로 허벅지나 의자를 짚고 일어남 → 팔은 가슴에 모으고, 코가 발끝 위에 올 때까지 먼저 숙인 뒤 일어나요.',
        '무릎이 안으로 모임 → 무릎을 두 번째 발가락 방향으로 살짝 벌려 밀어요.',
        '털썩 주저앉음 → 엉덩이를 뒤로 빼며 “하나, 둘” 세면서 천천히 앉아요.',
        '상체를 세운 채 반동으로 일어남 → 몸을 흔들지 말고, 체중을 발 위로 옮긴 뒤 다리 힘으로 일어나요.',
      ],
      en: [
        'Pushing up with your hands → Keep your arms crossed and lean until your nose is over your toes before you stand.',
        'Knees caving in → Press your knees out toward your second toes.',
        'Plopping down → Push your hips back and count “one, two” as you lower.',
        'Rocking up with an upright trunk → Don’t swing; shift your weight over your feet first, then stand with your legs.',
      ],
    },
    why: {
      ko: '일상에서 가장 많이 하는 동작으로 엉덩이·허벅지 힘과 무릎 정렬을 함께 훈련해요. 의자 높이까지만 무릎을 굽히니 무릎이 불편한 분께 스쿼트 대신 추천해요.',
      en: 'Trains glute and thigh strength plus knee alignment in the move you do most every day. The chair limits how far your knees bend, making it a knee-friendly squat alternative.',
    },
    muscles: { ko: '대둔근, 대퇴사두근, 햄스트링(보조), 복부 코어', en: 'Glutes, quadriceps, hamstrings (assist), abdominal core' },
    caution: {
      ko: '어지럽거나 균형이 불안하면 의자를 벽에 붙이고 옆에 잡을 곳을 두세요. 무릎에 날카로운 통증이 있으면 멈추세요.',
      en: 'If you feel dizzy or unsteady, keep the chair against a wall with something to hold nearby. Stop if you feel sharp knee pain.',
    },
    avoid: ['kneeSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      anchor: ['heelL', 'heelR'],
      keys: [STS_SIT, STS_LEAN, STS_STAND, STS_LOWER],
      labels: [
        { ko: '의자 앞쪽에 앉기', en: 'Sit near the front edge' },
        { ko: '코를 발끝 위로', en: 'Nose over toes' },
        { ko: '밀고 일어나 엉덩이 조이기', en: 'Stand, squeeze glutes' },
        { ko: '엉덩이 뒤로 천천히 앉기', en: 'Hips back, sit slowly' },
      ],
      durations: [0.8, 1.2, 1, 1.4],
      pauses: [0.3, 0.1, 0.4, 0],
      focus: [
        { a: 'waist', b: 'sitR', side: 'back', kind: 'work', r: 3.6, from: 0.45, to: 1.05 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
      ],
      trace: ['pelvis'],
    },
    coach: {
      view: 'side',
      metric: 'kneeAngle',
      mode: 'reps',
      rest: 160,
      peak: 110,
      dir: -1,
      hint: { ko: '옆에서 의자와 온몸이 보이게 휴대폰을 세워 주세요', en: 'Place the phone beside you so you and the chair are visible' },
      more: { ko: '끝까지 앉았다 일어나요', en: 'Sit all the way down' },
      good: { ko: '좋아요!', en: 'Nice!' },
    },
  },
  {
    id: 'split-squat',
    name: { ko: '스플릿 스쿼트', en: 'Split squat' },
    phase: 'integrate',
    position: 'standing',
    regions: ['glute', 'knee', 'hip'],
    targets: { kneeValgus: 0.6, pelvicTilt: 0.5, lateralShift: 0.4 },
    equipment: [],
    level: 3,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, perSide: true, rest: 30 },
    setup: {
      ko: [
        '발을 골반 너비로 벌리고 서서, 오른발을 앞으로 크게 한 걸음(약 60~80cm) 내딛어요.',
        '두 발은 일직선이 아니라 기찻길처럼 좌우로 골반 너비를 유지하고, 두 발끝은 정면을 향해요.',
        '왼발 뒤꿈치를 들어 발가락 뿌리로 서고, 손은 허리에 얹어 골반이 정면·수평인지 확인해요.',
      ],
      en: [
        'Stand with your feet hip-width apart, then take a big step forward with your right foot (about 60–80 cm).',
        'Keep your feet hip-width apart side to side, like train tracks rather than a tightrope, with both toes pointing forward.',
        'Lift your left heel so you stand on the ball of the back foot, and rest your hands on your hips to check that your pelvis faces forward and stays level.',
      ],
    },
    steps: {
      ko: [
        '상체를 곧게 세운 채 숨을 들이마시며, 뒷무릎을 바닥 쪽으로 2초에 걸쳐 수직으로 내려요.',
        '뒷무릎이 바닥에 닿기 직전(바닥 위 5~10cm, 손바닥 폭 정도)에 오면 멈춰요. 앞무릎은 약 90도, 두 번째 발가락 방향이에요.',
        '잠깐(0.5초) 멈춘 뒤, 숨을 내쉬며 앞발 뒤꿈치와 발바닥 전체로 밀어 2초에 걸쳐 올라와요.',
        '맨 위에서도 발 위치는 그대로 두고, 앞무릎을 완전히 잠그지 않은 채 다음 회를 이어요.',
        '8회를 마치면 왼발을 앞에 두고 8회 해요.',
      ],
      en: [
        'Keeping your torso tall, breathe in and lower your back knee straight down toward the floor over 2 seconds.',
        'Stop just before the back knee touches the floor (5–10 cm above it, about a hand’s width). The front knee is at about 90° and points toward your second toe.',
        'Pause briefly (half a second), then breathe out and push through the front heel and whole foot to rise over 2 seconds.',
        'Keep your feet where they are at the top and don’t fully lock the front knee before the next rep.',
        'After 8 reps, put your left foot in front and do 8 more.',
      ],
    },
    breathing: {
      ko: '내려가면서 코로 들이마시고, 앞발로 밀어 올라오며 입으로 내쉬어요.',
      en: 'Breathe in through your nose on the way down and breathe out as you push back up.',
    },
    feel: {
      ko: '앞다리의 엉덩이와 허벅지 앞이 뻐근하게 일하고, 뒷다리 허벅지 앞~골반 앞은 살짝 늘어나는 느낌이면 정답이에요. 앞무릎 앞쪽이나 안쪽이 날카롭게 아프면 깊이를 줄이고, 계속되면 멈춰요.',
      en: 'The glute and front of the thigh on your front leg should burn, with a mild stretch at the front of the back hip and thigh. If you feel sharp pain at the front or inside of the front knee, go shallower, and stop if it continues.',
    },
    easier: {
      ko: '의자 등받이나 벽을 한 손으로 잡고 하거나, 깊이를 절반(뒷무릎이 바닥에서 30cm 위)까지만 내려가요. 그래도 힘들면 ‘의자 앉았다 일어서기’로 바꿔요.',
      en: 'Hold a chair back or wall with one hand, or lower only halfway (back knee about 30 cm above the floor). If it’s still too hard, switch to sit-to-stands.',
    },
    harder: {
      ko: '내려가는 시간을 4초로 늘리고 맨 아래에서 2초 버텨요. 양손에 물병을 들거나, 뒷발을 의자 위에 올리는 불가리안 스플릿 스쿼트로 넘어가요.',
      en: 'Take 4 seconds to lower and hold 2 seconds at the bottom. Hold a water bottle in each hand, or progress to a Bulgarian split squat with the back foot on a chair.',
    },
    cues: { ko: ['수직으로 내려가요', '앞무릎은 발끝 방향', '골반은 수평', '앞발로 밀어요'], en: ['Straight down', 'Front knee follows your toes', 'Keep your hips level', 'Drive through the front foot'] },
    mistakes: {
      ko: [
        '앞무릎이 안쪽으로 모임 → 무릎을 두 번째 발가락 방향으로 보내고, 엄지발가락 뿌리를 바닥에 붙여 둬요.',
        '상체가 앞으로 쏠리거나 허리를 젖힘 → 정수리를 천장으로 뻗고 갈비뼈를 내려, 몸통을 세운 채 수직으로 내려가요.',
        '두 발이 일직선에 있어 흔들림 → 발을 좌우로 골반 너비만큼 벌린 기찻길 자세로 다시 서요.',
        '보폭이 좁아 앞발 뒤꿈치가 들림 → 반 걸음 더 벌려, 맨 아래에서 앞 정강이가 거의 수직이 되게 해요.',
      ],
      en: [
        'Front knee caving in → Send the knee toward your second toe and keep the big-toe base on the floor.',
        'Leaning forward or arching your back → Reach your crown up, draw your ribs down and lower straight down with a tall torso.',
        'Wobbling because your feet are in one line → Reset with your feet hip-width apart, like train tracks.',
        'Front heel lifting because the stance is too short → Step half a step longer so the front shin is nearly vertical at the bottom.',
      ],
    },
    why: {
      ko: '한쪽 다리로 체중을 버티며 좌우 근력 차이를 줄이고, 골반이 한쪽으로 기울거나 몸이 옆으로 쏠리는 습관을 엉덩이 힘으로 잡아 주는 고급 통합 운동이에요.',
      en: 'An advanced integration move: loading one leg at a time evens out left–right strength and uses your glutes to control a pelvis that tilts or a body that shifts to one side.',
    },
    muscles: { ko: '앞다리 대둔근·대퇴사두근, 중둔근(골반 수평 유지), 내전근, 복부 코어', en: 'Front-leg glutes and quadriceps, gluteus medius (keeps the pelvis level), adductors, abdominal core' },
    caution: { ko: '균형이 불안하면 벽이나 의자를 잡고 하세요. 무릎에 날카로운 통증이 있으면 멈추세요.', en: 'Hold a wall or chair if your balance is unsteady. Stop if you feel sharp knee pain.' },
    avoid: ['kneeSevere', 'kneePain', 'balance'],
    anim: {
      view: 90,
      anchor: ['toeR', 'toeL'],
      keys: [SPLIT_TOP, SPLIT_MID, SPLIT_LOW],
      labels: [
        { ko: '오른발 앞, 뒤꿈치 들기', en: 'Right foot forward, back heel up' },
        { ko: '몸통 세운 채 수직으로', en: 'Straight down, torso tall' },
        { ko: '뒷무릎 바닥 5~10cm 위', en: 'Back knee 5–10 cm off the floor' },
      ],
      durations: [0.9, 0.9, 1.8],
      pauses: [0.3, 0, 0.5],
      focus: [
        { a: 'waist', b: 'sitR', side: 'back', kind: 'work', r: 3.6, from: 0.45, to: 1.05 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
      ],
      trace: ['knL'],
    },
  },
  {
    id: 'hip-hinge',
    name: { ko: '힙 힌지 (인사 동작)', en: 'Hip hinge' },
    phase: 'integrate',
    position: 'standing',
    regions: ['hip', 'lowBack', 'glute'],
    targets: { lowBackPain: 0.5, swayback: 0.4, kneeHyperext: 0.5, flatBack: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, rest: 20 },
    setup: {
      ko: [
        '발은 골반 너비, 발끝은 정면으로 두고 무릎을 살짝(약 15도) 풀어요.',
        '양손은 허리 아래 골반 양옆에 얹어요.',
        '갈비뼈를 살짝 내려 배에 가볍게 힘을 주고, 정수리부터 꼬리뼈까지 곧게 펴요. 시선은 정면이에요.',
      ],
      en: [
        'Stand with your feet hip-width apart, toes forward, knees softly bent (about 15°).',
        'Rest your hands on the sides of your pelvis, just below your waist.',
        'Draw your ribs down to lightly brace, and lengthen from the crown of your head to your tailbone. Look straight ahead.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며, 뒤에 있는 벽을 엉덩이로 밀듯 엉덩이를 뒤로 쭉 빼기 시작해요.',
        '등은 곧게 편 채 상체가 따라 숙여지도록 2초에 걸쳐 인사하듯 내려가요. 무릎은 처음처럼 살짝 굽힌 채, 정강이는 거의 수직으로 세워 둬요.',
        '허벅지 뒤가 팽팽하게 당기면(보통 상체가 바닥과 30~45도) 멈춰요. 목은 등과 일직선, 시선은 1~2m 앞 바닥이에요.',
        '숨을 내쉬며 발뒤꿈치로 바닥을 누르고 엉덩이를 앞으로 밀어 2초에 걸쳐 일어나요.',
        '맨 위에서 엉덩이를 조이되 허리를 뒤로 젖히지 않아요. 10회 반복해요.',
      ],
      en: [
        'Breathe in and start pushing your hips straight back, as if bumping a wall behind you.',
        'Keep your back flat and let your torso tip forward like a bow over 2 seconds. Keep the soft knee bend and your shins close to vertical.',
        'Stop when the backs of your thighs feel tight — usually when your torso is 30–45° above the floor. Keep your neck in line with your back, eyes on the floor 1–2 m ahead.',
        'Breathe out, press your heels down and drive your hips forward to stand up over 2 seconds.',
        'Squeeze your glutes at the top without leaning back. Repeat 10 times.',
      ],
    },
    breathing: {
      ko: '숙이면서 코로 들이마셔 배를 단단하게 유지하고, 엉덩이를 밀어 일어나며 입으로 내쉬어요.',
      en: 'Breathe in through your nose as you hinge to keep your trunk firm, and breathe out as you drive your hips forward to stand.',
    },
    feel: {
      ko: '허벅지 뒤가 팽팽하게 늘어나고, 일어날 때 엉덩이에 힘이 들어가면 정답이에요. 허리가 뻐근하거나 조이면 허리로 숙인 거예요. 다리 뒤로 저린 느낌이 내려가면 멈춰요.',
      en: 'You should feel the backs of your thighs tighten as you bow and your glutes work as you stand. If your low back aches or pinches, you’re bending from the spine. Stop if you feel tingling down the leg.',
    },
    easier: {
      ko: '엉덩이 뒤 10~15cm 거리에 벽을 두고, 엉덩이로 벽을 톡 치고 돌아오는 “벽 힙 힌지”로 해요. 숙이는 범위를 작게 해도 괜찮아요.',
      en: 'Stand 10–15 cm in front of a wall and tap it with your buttocks before returning (a wall hip hinge). A smaller range is fine.',
    },
    harder: {
      ko: '막대나 빗자루를 등에 세로로 대고 뒤통수·등·꼬리뼈 세 점이 떨어지지 않게 해요. 익숙해지면 물병이나 가방을 들고 하거나, 균형이 괜찮다면 한 다리로 서서 해요.',
      en: 'Hold a stick or broom along your spine and keep it touching your head, upper back and tailbone. Then add a water bottle or bag, or try it on one leg if your balance is good.',
    },
    cues: { ko: ['엉덩이를 뒤로', '등은 곧게', '정강이는 수직으로', '엉덩이 조이며 일어나요'], en: ['Hips back', 'Flat back', 'Shins vertical', 'Squeeze to stand'] },
    mistakes: {
      ko: [
        '허리부터 둥글게 숙임 → 가슴을 편 채, 엉덩이가 뒤로 가는 만큼만 상체를 숙여요.',
        '무릎을 너무 많이 굽혀 스쿼트가 됨 → 무릎 각도는 처음 그대로 두고, 엉덩이만 뒤로 보내요.',
        '일어나서 허리를 뒤로 젖힘 → 맨 위에서는 엉덩이만 조이고 갈비뼈는 내려 둬요.',
        '고개를 들어 앞을 봄 → 목은 등과 일직선, 시선은 1~2m 앞 바닥에 둬요.',
      ],
      en: [
        'Rounding from the low back → Keep your chest open and tip forward only as far as your hips travel back.',
        'Bending the knees too much (it turns into a squat) → Keep the starting knee bend and send only your hips back.',
        'Leaning back at the top → Just squeeze your glutes and keep your ribs down.',
        'Craning your head up → Keep your neck in line with your back and look at the floor 1–2 m ahead.',
      ],
    },
    why: {
      ko: '물건을 들거나 몸을 숙일 때 허리 대신 고관절을 접어 쓰는 패턴을 익혀요. 엉덩이와 햄스트링을 쓰는 법을 배우면 무릎을 뒤로 잠그고 서거나 골반을 앞으로 내밀고 서는 습관(스웨이백)도 줄어들어요.',
      en: 'Teaches you to bend from the hips instead of the spine when you lift or lean forward. Learning to use your glutes and hamstrings also helps break the habit of locking your knees or pushing your hips forward (sway-back).',
    },
    muscles: { ko: '햄스트링, 대둔근, 척추세움근(등을 곧게 유지), 복부 코어', en: 'Hamstrings, glutes, erector spinae (keep the back flat), abdominal core' },
    caution: { ko: '허리 통증이 심해지거나 다리로 저린 느낌이 내려가면 멈추세요.', en: 'Stop if your back pain gets worse or you feel tingling down the leg.' },
    avoid: ['lowBackSevere', 'radiating'],
    anim: {
      view: 90,
      keys: [HINGE_TOP, HINGE_MID, HINGE_LOW],
      labels: [
        { ko: '무릎 살짝 풀고 서기', en: 'Stand, soft knees' },
        { ko: '엉덩이를 뒤로 쭉', en: 'Push your hips back' },
        { ko: '허벅지 뒤 당길 때까지', en: 'Until the hamstrings pull' },
      ],
      durations: [1, 1, 1.8],
      pauses: [0.3, 0, 0.5],
      focus: [
        { a: 'hipR', b: 'knR', side: 'back', kind: 'stretch' },
        { a: 'waist', b: 'sitR', side: 'back', kind: 'work', r: 3.6, from: 0.45, to: 1.05 },
      ],
      trace: ['pelvis'],
    },
  },
  {
    id: 'seated-hamstring',
    name: { ko: '의자 햄스트링 스트레칭', en: 'Seated hamstring stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['hip', 'knee'],
    targets: { kneeFlexed: 0.8, flatBack: 0.6, lowBackPain: 0.4, swayback: 0.3 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '바퀴 없는 튼튼한 의자 앞쪽 끝에 엉덩이 절반만 걸치고 앉아, 왼발은 무릎 90도로 바닥에 둬요.',
        '오른다리를 앞으로 쭉 뻗어 뒤꿈치를 바닥에 대요. 무릎은 펴되 뒤로 꽉 잠그지 않아요.',
        '손은 허벅지 위에 가볍게 얹고, 골반을 세워 허리를 곧게 펴요.',
      ],
      en: [
        'Sit on the front edge of a sturdy chair without wheels, with only half your buttocks on the seat, left foot flat and the knee at 90°.',
        'Stretch your right leg out in front with the heel on the floor. Straighten the knee without jamming it back.',
        'Rest your hands lightly on your thighs and sit up tall on your sit bones.',
      ],
    },
    steps: {
      ko: [
        '오른발끝을 몸 쪽으로 당겨 천장을 향해 세우고, 정수리를 천장으로 길게 뻗어 허리를 세운 채 숨을 들이마셔요.',
        '숨을 내쉬며 배꼽을 오른 허벅지 쪽으로 보내듯 골반부터 3초에 걸쳐 앞으로 숙여요. 두 손은 오른다리를 따라 정강이 쪽으로 미끄러져요.',
        '오른쪽 허벅지 뒤가 당기기 시작하면(아프지 않게, 10점 중 5~6점) 멈추고 30초 버텨요.',
        '버티는 동안 숨을 내쉴 때마다 1~2cm씩만 조금 더 숙여요.',
        '천천히 상체를 세우고 다리를 바꿔요. 양쪽 2세트씩 해요.',
      ],
      en: [
        'Pull your right toes back toward you so they point at the ceiling, lengthen the crown of your head upward and breathe in with your back tall.',
        'Breathe out and hinge forward from the hips over 3 seconds, as if bringing your belly button toward your right thigh. Let both hands slide down the right leg toward the shin.',
        'Stop when the back of your right thigh starts to pull (painless, about 5–6 out of 10) and hold for 30 seconds.',
        'With each exhale during the hold, ease forward only another 1–2 cm.',
        'Slowly sit up and switch legs. Do 2 sets on each side.',
      ],
    },
    breathing: {
      ko: '숙일 때 입으로 길게 내쉬고, 버티는 동안 코로 4초 들이마시고 입으로 6초 내쉬어요. 내쉴 때마다 힘을 조금 더 빼요.',
      en: 'Exhale slowly as you hinge, then during the hold breathe in through your nose for 4 seconds and out through your mouth for 6. Relax a little more with each exhale.',
    },
    feel: {
      ko: '오른쪽 허벅지 뒤 가운데~무릎 위쪽이 은은하게 당기면 정답이에요. 무릎 뒤 오금이 찌릿하거나 종아리·발로 저린 느낌이 내려가면 신경이 당기는 신호이니 발끝을 내리고 덜 숙여요.',
      en: 'A gentle pull through the middle of the back of your right thigh, above the knee, is right. A zing behind the knee or tingling into the calf or foot means a nerve is being tugged — point your toes and ease back.',
    },
    easier: {
      ko: '발끝을 세우지 말고 편하게 두거나, 오른무릎을 10~20도 살짝 굽혀요. 숙이는 범위를 줄이고 손은 허벅지 위에 둬도 돼요.',
      en: 'Let your toes relax instead of pulling them up, or bend the right knee 10–20°. Hinge less and keep your hands on your thigh.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘리거나, 발뒤꿈치를 5~10cm 높이 받침(두꺼운 책)에 올려요. 발끝을 몸 쪽으로 더 당기면 종아리까지 함께 늘어나요.',
      en: 'Hold for 45 seconds, or rest your heel on a 5–10 cm block (a thick book). Pulling your toes back further adds a calf stretch.',
    },
    cues: { ko: ['골반부터 숙여요', '등은 길게', '발끝은 천장으로', '내쉬며 조금 더'], en: ['Hinge from the hips', 'Long back', 'Toes to the ceiling', 'Exhale, ease forward'] },
    mistakes: {
      ko: [
        '등을 둥글게 말아 숙임 → 가슴을 앞으로 내밀고, 배꼽이 허벅지로 가듯 골반에서 접어요.',
        '오른무릎을 굽힘 → 뒤꿈치를 앞으로 밀어내듯 무릎 뒤를 길게 펴요(꽉 잠그지는 않아요).',
        '반동을 주며 튕김 → 멈춘 자리에서 가만히 버티고, 내쉴 때만 조금씩 더 가요.',
        '너무 세게 당김 → 10점 중 5~6점, 말을 할 수 있을 정도로만 늘려요.',
      ],
      en: [
        'Rounding your back → Lift your chest and fold at the hips, as if your belly button is heading for your thigh.',
        'Bending the right knee → Reach the heel away to lengthen the back of the knee (without jamming it).',
        'Bouncing → Stay still where you stop and only ease further on each exhale.',
        'Pulling too hard → Stretch to about 5–6 out of 10, where you could still talk.',
      ],
    },
    why: {
      ko: '짧아진 햄스트링은 골반을 뒤로 당겨 허리를 일자로 만들고, 무릎을 끝까지 펴지 못하게 해 무릎이 굽은 자세와 요통을 부를 수 있어요. 의자에서 허리를 편 채 늘려 사무실에서도 안전하게 할 수 있어요.',
      en: 'Tight hamstrings tug the pelvis backward, flattening the low back, and keep the knees from fully straightening — feeding a bent-knee stance and back pain. Doing it seated with a long back makes it a safe office stretch.',
    },
    muscles: { ko: '햄스트링(대퇴이두근·반건양근·반막양근), 비복근(발끝을 세울 때)', en: 'Hamstrings (biceps femoris, semitendinosus, semimembranosus), gastrocnemius (with toes pulled up)' },
    caution: { ko: '다리 뒤로 저린 느낌(신경 당김)이 나면 발끝을 내리고 강도를 줄이세요.', en: 'If you feel tingling down the leg (nerve tension), point your toes and ease off.' },
    avoid: ['radiating'],
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      anchor: ['heelL', 'toeL'],
      keys: [HAM_SIT, HAM_READY, HAM_FOLD],
      labels: [
        { ko: '오른다리 펴고 걸터앉기', en: 'Sit on the edge, right leg out' },
        { ko: '발끝 세우고 허리 길게', en: 'Toes up, sit tall' },
        { ko: '골반부터 숙여 30초', en: 'Hinge forward, hold 30 s' },
      ],
      durations: [1, 1.8, 1.6],
      pauses: [0.5, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'back', kind: 'stretch' },
        { a: 'knR', b: 'anR', side: 'back', kind: 'stretch', r: 2.2, from: 0.1, to: 0.55 },
      ],
      trace: ['head'],
    },
  },
  {
    id: 'quad-stretch',
    name: { ko: '서서 허벅지 앞 스트레칭', en: 'Standing quad stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['hip', 'knee'],
    targets: { lordosis: 0.6, kneeHyperext: 0.3, swayback: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    setup: {
      ko: [
        '벽을 마주 보고 팔 길이(약 50~60cm)만큼 떨어져 서서, 왼손을 어깨 높이로 벽에 대요.',
        '발은 골반 너비로 두고, 왼쪽 디딤 무릎은 살짝 풀어요.',
        '배꼽을 살짝 당겨 갈비뼈를 내리고, 정수리를 천장으로 길게 뻗어요.',
      ],
      en: [
        'Face a wall about an arm’s length away (50–60 cm) and place your left hand on it at shoulder height.',
        'Stand with your feet hip-width apart and a soft bend in your left (standing) knee.',
        'Draw your belly button in slightly so your ribs drop, and lengthen the crown of your head toward the ceiling.',
      ],
    },
    steps: {
      ko: [
        '오른무릎을 굽혀 발뒤꿈치를 엉덩이 쪽으로 들어 올리고, 오른손으로 발등(어려우면 발목)을 잡아요.',
        '두 무릎을 나란히 모으고, 오른무릎이 바닥을 똑바로 향하게 해요.',
        '꼬리뼈를 아래로 말아 엉덩이를 조이면서 오른무릎을 5cm쯤 뒤로 보내요.',
        '오른쪽 허벅지 앞이 당기면 그 자리에서 30초 버텨요. 발뒤꿈치를 엉덩이에 억지로 붙이지 않아요.',
        '천천히 발을 내려놓고 다리를 바꿔요. 양쪽 2세트씩 해요.',
      ],
      en: [
        'Bend your right knee to bring the heel toward your buttock and hold the top of the foot (or the ankle) with your right hand.',
        'Line your knees up side by side, with the right knee pointing straight down at the floor.',
        'Tuck your tailbone under and squeeze your glutes as you ease the right knee back about 5 cm.',
        'When the front of your right thigh stretches, hold there for 30 seconds. Don’t force the heel onto your buttock.',
        'Slowly lower the foot and switch legs. Do 2 sets on each side.',
      ],
    },
    breathing: {
      ko: '버티는 동안 코로 4초 들이마시고 입으로 6초 길게 내쉬어요. 내쉴 때마다 꼬리뼈를 조금 더 말아요.',
      en: 'During the hold, breathe in through your nose for 4 seconds and out through your mouth for 6. Tuck your tailbone a little more on each exhale.',
    },
    feel: {
      ko: '오른쪽 허벅지 앞 가운데부터 골반 앞(허벅지가 시작되는 곳)까지 당기면 정답이에요. 무릎이 조이거나 아프면 발을 엉덩이에서 조금 떨어뜨리고, 허리가 조이면 허리를 젖힌 거예요.',
      en: 'You should feel the stretch from the middle of the front of your right thigh up to the front of the hip. If your knee feels squeezed or sore, let the foot move away from your buttock; if your low back pinches, you’re arching.',
    },
    easier: {
      ko: '발이 손에 닿지 않거나 무릎이 불편하면 수건을 발목에 걸어 당겨요. 균형이 불안하면 왼쪽 옆으로 누워 같은 방법으로 해요.',
      en: 'If you can’t reach your foot or your knee is uncomfortable, loop a towel around the ankle and pull on it. If your balance is shaky, lie on your left side and do the same stretch.',
    },
    harder: {
      ko: '꼬리뼈를 더 말고 엉덩이를 더 조여 무릎을 조금 더 뒤로 보내거나, 버티는 시간을 45초로 늘려요. 익숙해지면 ‘하프 닐링 고관절 앞 스트레칭’으로 넘어가요.',
      en: 'Tuck your tailbone further and squeeze harder to take the knee a little further back, or hold for 45 seconds. Then progress to the half-kneeling hip flexor stretch.',
    },
    cues: { ko: ['무릎은 바닥으로', '두 무릎 나란히', '꼬리뼈를 말아요', '갈비뼈를 내려요'], en: ['Knee points down', 'Knees side by side', 'Tuck your tailbone', 'Ribs down'] },
    mistakes: {
      ko: [
        '허리를 젖혀 배가 앞으로 나옴 → 배꼽을 당기고 꼬리뼈를 아래로 말아 골반을 세워요.',
        '무릎이 옆으로 벌어지거나 앞으로 들림 → 두 무릎을 나란히 모으고 오른무릎이 바닥을 향하게 해요.',
        '발뒤꿈치를 엉덩이에 억지로 붙임 → 무릎이 조이면 발을 엉덩이에서 손바닥 폭(약 10cm)만큼 떼고, 꼬리뼈 말기로 늘려요.',
        '상체가 앞으로 숙여짐 → 정수리를 천장으로 세우고, 벽 짚은 손으로는 균형만 잡아요.',
      ],
      en: [
        'Arching your back so your belly pushes forward → Draw your belly in and tuck your tailbone under.',
        'Knee drifting out to the side or forward → Keep your knees side by side with the right knee pointing down.',
        'Forcing the heel onto your buttock → If the knee feels squeezed, let the foot move about 10 cm (a hand’s width) away and use the tailbone tuck instead.',
        'Leaning your torso forward → Stand tall and use the wall hand for balance only.',
      ],
    },
    why: {
      ko: '골반 앞에서 허벅지로 이어지는 대퇴직근을 늘려, 골반이 앞으로 기울고 허리가 과하게 젖혀지는 자세를 줄여요. 꼬리뼈를 말면 고관절 앞까지 함께 늘어나요.',
      en: 'Lengthens the rectus femoris, which runs from the front of the pelvis down the thigh and pulls the pelvis into anterior tilt and an over-arched back. Tucking the tailbone carries the stretch into the front of the hip.',
    },
    muscles: { ko: '대퇴사두근(특히 대퇴직근), 장요근(꼬리뼈를 말 때), 대둔근(골반 세우기)', en: 'Quadriceps (especially rectus femoris), iliopsoas (with the tailbone tuck), glutes (to tuck the pelvis)' },
    caution: { ko: '무릎이 아프면 수건을 발목에 걸어 당기고, 균형이 불안하면 옆으로 누워서 하세요.', en: 'If your knee hurts, loop a towel around the ankle instead; if you feel unsteady, do it lying on your side.' },
    avoid: ['kneeSevere', 'kneePain', 'balance'],
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'front', dist: 0.5 }],
      anchor: ['heelL', 'toeL'],
      keys: [QUAD_STAND, QUAD_HOLD, QUAD_TUCK],
      labels: [
        { ko: '벽 짚고 바르게 서기', en: 'Stand tall, hand on wall' },
        { ko: '오른발등 잡기', en: 'Hold your right foot' },
        { ko: '꼬리뼈 말고 30초', en: 'Tuck tailbone, hold 30 s' },
      ],
      durations: [1.4, 1.2, 1.4],
      pauses: [0.4, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'front', kind: 'stretch' },
        { a: 'waist', b: 'hipR', side: 'front', kind: 'stretch', r: 2.4 },
        { a: 'waist', b: 'sitR', side: 'back', kind: 'work', r: 3.2, from: 0.45, to: 1.05 },
      ],
      trace: ['anR'],
    },
  },
];
