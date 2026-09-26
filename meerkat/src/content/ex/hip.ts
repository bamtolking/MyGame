/**
 * 운동 라이브러리 · 고관절·엉덩이
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { HALF_KNEEL, HOOK, SIDE_LYING, SIT, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

/** 두 손을 허리에: 손바닥은 골반 옆 위, 손끝은 앞, 팔꿈치는 옆·뒤로
 *  (공용 HANDS_ON_HIPS 는 옆에서 보면 손이 배 앞에 떠 보여서 이 파일에서 따로 씀) */
const HIPS_HANDS: Pose = both({ sh: { abd: 40, flex: -30, rot: -50 }, el: 120 });

/** 오른손만 허리(골반 위)에 */
const R_HAND_ON_HIP: Pose = { shR: { abd: 40, flex: -30, rot: -50 }, elR: 120 };

/** 서서 고관절 앞 늘리기: 왼발 앞·오른발 뒤꿈치 든 앞뒤 보폭 */
const SPLIT_STANCE = merge(STAND, HIPS_HANDS, { hipL: { flex: 22 }, knL: 4, anL: -18, hipR: { flex: -22 }, knR: 20, anR: 12 });

/** 골반 뒤로 기울이기(꼬리뼈 말기): 골반 −14°, 허리(3°)·등(11°)이 나눠 받쳐 상체는 곧게.
 *  허리 굽힘만으로 되돌리면 골반~허리 선이 그대로라 그림에서 기울기가 보이지 않아요. */
const TUCK: Pose = { root: { pitch: -14 }, lumbar: { flex: 3 }, thorax: { flex: 11 } };

/** 의자 4자: 오른발목을 왼무릎 위에 올린 다리 */
const FIG4_LEG = { hipR: { flex: 108, abd: 3, rot: 100, hab: 37 }, knR: 122, anR: -2 };

export const HIP: Exercise[] = [
  {
    id: 'glute-bridge',
    name: { ko: '글루트 브릿지', en: 'Glute bridge' },
    phase: 'activate',
    position: 'supine',
    regions: ['glute', 'core', 'lowBack'],
    targets: { lordosis: 0.8, swayback: 0.6, lowBackPain: 0.6, kneeValgus: 0.4, kneeHyperext: 0.3, hipPain: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 3, holdSec: 2, rest: 20 },
    setup: {
      ko: [
        '매트에 바로 누워 무릎을 90도 정도로 세우고, 발은 골반 너비로 벌려 발끝이 정면을 향하게 해요.',
        '발뒤꿈치는 누운 채 손을 뻗었을 때 손끝이 스칠 만큼 엉덩이 가까이(엉덩이에서 약 한 뼘) 둬요.',
        '팔은 몸 옆 바닥에 45도로 벌려 손바닥을 대고, 턱을 살짝 당겨 뒤통수를 바닥에 편하게 둬요.',
      ],
      en: [
        'Lie on your back with knees bent to about 90°, feet hip-width apart and toes pointing straight ahead.',
        'Bring your heels close enough that your fingertips brush them when you reach down — about a hand-span from your buttocks.',
        'Rest your arms on the floor at about 45° from your sides, palms down, with a slight chin tuck so the back of your head rests easily.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 배꼽을 살짝 당겨 배에 힘을 주고, 꼬리뼈를 말아 허리를 바닥 쪽으로 가볍게 눌러요.',
        '발뒤꿈치로 바닥을 밀며 꼬리뼈부터 1초에 걸쳐 엉덩이를 들어 올려요.',
        '어깨-골반-무릎이 일직선이 되는 높이에서 멈추고, 엉덩이를 꽉 조여 2초 버텨요.',
        '등 위쪽부터 척추를 한 마디씩 내려놓듯 2초에 걸쳐 천천히 내려와요.',
        '엉덩이가 바닥에 닿으면 힘을 한 번 풀고, 12회 반복해요.',
      ],
      en: [
        'Exhale, draw your belly button in gently and tuck your tailbone so your low back presses lightly toward the floor.',
        'Push through your heels and peel your hips up, tailbone first, over about 1 second.',
        'Stop when your shoulders, hips and knees form a straight line, and squeeze your glutes hard for 2 seconds.',
        'Take 2 seconds to lower, setting your spine down one segment at a time from the upper back.',
        'Let your hips touch down and relax for a moment, then repeat for 12 reps.',
      ],
    },
    breathing: {
      ko: '들어 올릴 때 입으로 “후—” 내쉬고, 위에서 2초 버티는 동안은 짧게 코로 숨 쉬어요. 내려오면서 코로 들이마셔요.',
      en: 'Exhale through your mouth as you lift, breathe lightly through your nose during the 2-second hold, and inhale as you lower.',
    },
    feel: {
      ko: '엉덩이 아래쪽 가운데가 단단하게 조이고 허벅지 뒤가 살짝 거드는 느낌이면 정답이에요. 허리가 뻐근하면 너무 높이 든 거고, 허벅지 뒤에 쥐가 나면 발을 엉덩이 쪽으로 5cm 당기세요. 허리가 찌릿하거나 다리가 저리면 멈춰요.',
      en: 'You should feel the middle-lower glutes tighten firmly, with the hamstrings helping a little. If your low back aches you’re lifting too high; if your hamstrings cramp, move your feet 5 cm closer. Stop if you feel a sharp twinge in your back or tingling down a leg.',
    },
    easier: {
      ko: '엉덩이를 5~10cm만 들어 올리는 작은 범위로 하거나, 들지 않고 누운 채 엉덩이만 5초씩 조였다 풀기(10회)부터 시작해요.',
      en: 'Lift your hips only 5–10 cm, or start with lying glute squeezes: tighten your glutes for 5 seconds without lifting, 10 times.',
    },
    harder: {
      ko: '위에서 버티는 시간을 5초로 늘리거나, 무릎 바로 위에 미니 밴드를 두르고 무릎을 바깥으로 밀며 해요. 익숙해지면 한쪽 무릎을 펴서 든 채 한 다리 브릿지로 넘어가요.',
      en: 'Hold the top for 5 seconds, or loop a mini band just above your knees and press out against it. When that’s easy, progress to a single-leg bridge with one knee straightened.',
    },
    cues: { ko: ['뒤꿈치로 밀어요', '엉덩이 꽉 조여요', '갈비뼈는 내려요', '천천히 내려와요'], en: ['Push through your heels', 'Squeeze your glutes', 'Keep your ribs down', 'Lower slowly'] },
    mistakes: {
      ko: [
        '허리를 과하게 젖혀 높이 올라감 → 갈비뼈를 아래로 내리고, 어깨-골반-무릎이 일직선인 높이에서 멈춰요.',
        '무릎이 안쪽으로 모임 → 무릎이 두 번째 발가락 방향을 향하도록 무릎을 살짝 바깥으로 밀어요.',
        '허벅지 뒤에 쥐가 남 → 발을 엉덩이 쪽으로 5cm 당기고, 발끝이 아닌 뒤꿈치로 밀어요.',
        '목과 어깨로 바닥을 밀어 올라감 → 턱을 살짝 당기고, 힘은 발뒤꿈치와 엉덩이에서만 써요.',
      ],
      en: [
        'Over-arching to get higher → Keep your ribs down and stop when shoulders, hips and knees are in one line.',
        'Knees caving in → Press your knees slightly outward so they track over your second toes.',
        'Hamstrings cramping → Move your feet 5 cm closer and push through your heels, not your toes.',
        'Pushing up with your neck and shoulders → Keep a slight chin tuck and drive only from your heels and glutes.',
      ],
    },
    why: {
      ko: '오래 앉아 잠든 대둔근을 깨워 골반을 뒤에서 바로 잡아 주고, 허리 대신 엉덩이로 몸을 펴는 법을 익혀요. 오리형(골반 앞쏠림) 교정의 핵심이에요.',
      en: 'Wakes up glutes switched off by sitting so they can hold the pelvis level from behind, and teaches you to extend with your hips instead of your low back — the core of the Duck fix.',
    },
    muscles: { ko: '대둔근, 햄스트링, 복부(골반 고정)', en: 'Gluteus maximus, hamstrings, abdominals (pelvic control)' },
    caution: { ko: '허리에 날카로운 통증이 생기거나 다리가 저리면 멈추고, 들어 올리는 높이를 줄여 다시 해 보세요.', en: 'Stop if you feel sharp low-back pain or leg tingling, then try again with a smaller lift.' },
    anim: {
      view: 90,
      elev: 10,
      props: [{ kind: 'mat' }],
      anchor: ['heelL', 'heelR'],
      level: { a: ['backTop'], b: ['heelL', 'heelR'] },
      keys: [
        merge(HOOK, both({ sh: { flex: 0, abd: 8 }, el: 0 })),
        merge(HOOK, { root: { pitch: -104 }, lumbar: { flex: 6 } }, both({ hip: { flex: 22 }, kn: 104, an: 9, sh: { flex: -12, abd: 8 }, el: 0 })),
        merge(HOOK, { root: { pitch: -114 } }, both({ hip: { flex: -2 }, kn: 102, an: 8, sh: { flex: -24, abd: 8 }, el: 0 })),
      ],
      labels: [
        { ko: '무릎 세우고 눕기', en: 'Lie with knees bent' },
        { ko: '꼬리뼈부터 말아 올리기', en: 'Peel up, tailbone first' },
        { ko: '일직선에서 2초 조이기', en: 'Straight line, squeeze 2 s' },
      ],
      durations: [0.6, 0.6, 1.9],
      pauses: [0.4, 0.1, 2],
      holdKey: 2,
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'hipR', b: 'knR', side: 'back', kind: 'work', r: 2.2, from: 0.25, to: 0.85 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.2 },
      ],
      trace: ['pelvis'],
    },
    coach: {
      view: 'side',
      metric: 'hipAngle',
      mode: 'reps',
      rest: 140,
      peak: 162,
      dir: 1,
      hint: { ko: '옆에서 온몸이 보이도록 휴대폰을 바닥 높이에 두세요', en: 'Place the phone at floor level beside you so your whole body is visible' },
      more: { ko: '엉덩이를 조금 더 높이', en: 'Hips a little higher' },
      good: { ko: '좋아요, 꽉 조여요', en: 'Great, squeeze' },
    },
  },
  {
    id: 'clamshell',
    name: { ko: '클램쉘', en: 'Clamshell' },
    phase: 'activate',
    position: 'sideLying',
    regions: ['glute', 'hip'],
    targets: { kneeValgus: 1, pelvicTilt: 0.6, hipPain: 0.5, lateralShift: 0.4 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 15, tempo: 2.5, holdSec: 1, perSide: true, rest: 15 },
    setup: {
      ko: [
        '왼쪽으로 옆으로 누워 머리를 왼팔(또는 접은 수건) 위에 얹고, 머리-어깨-골반이 한 줄이 되게 해요.',
        '엉덩이를 45도, 무릎을 90도로 굽혀 두 무릎과 두 발뒤꿈치를 포개요. 발뒤꿈치는 엉덩이와 일직선이에요.',
        '오른쪽 골반이 왼쪽 골반 바로 위에 수직으로 쌓이게 하고, 오른손은 가슴 앞 바닥을 가볍게 짚어요.',
      ],
      en: [
        'Lie on your left side with your head on your left arm (or a folded towel), head, shoulders and pelvis in one line.',
        'Bend your hips to 45° and knees to 90°, stacking your knees and heels. Your heels line up with your buttocks.',
        'Stack your right hip directly over your left, and rest your right hand lightly on the floor in front of your chest.',
      ],
    },
    steps: {
      ko: [
        '배꼽을 살짝 당겨 몸통을 고정해요.',
        '두 발뒤꿈치를 붙인 채, 숨을 내쉬며 1초에 걸쳐 오른쪽 무릎을 천장 쪽으로 조개처럼 벌려요.',
        '골반이 뒤로 넘어가기 직전(보통 무릎 사이 20cm 정도)에서 멈추고, 엉덩이 옆을 조여 1초 버텨요.',
        '1~2초에 걸쳐 무릎을 천천히 닫되, 아래 무릎에 툭 떨어뜨리지 말고 살짝 닿을 때까지만 내려요.',
        '15회 반복한 뒤 오른쪽으로 돌아누워 반대쪽도 해요.',
      ],
      en: [
        'Draw your belly button in slightly to steady your trunk.',
        'Keeping your heels together, exhale and open your right knee toward the ceiling like a clamshell over about 1 second.',
        'Stop just before your pelvis starts to roll back (usually about 20 cm between the knees) and hold for 1 second, squeezing the side of your hip.',
        'Close slowly over 1–2 seconds, lowering until the knees just touch — don’t let it drop.',
        'Do 15 reps, then roll onto your right side and repeat.',
      ],
    },
    breathing: {
      ko: '무릎을 벌리며 내쉬고, 닫으며 들이마셔요. 숨을 참고 몸통에 힘을 몰아주지 마세요.',
      en: 'Exhale as the knee opens and inhale as it closes. Don’t hold your breath or brace your whole trunk.',
    },
    feel: {
      ko: '위쪽 엉덩이 옆과 뒤쪽(바지 뒷주머니 바깥쪽)이 뻐근하게 타는 느낌이면 정답이에요. 허리나 허벅지 앞이 먼저 힘들면 골반이 뒤로 넘어간 거예요. 엉덩이가 찌릿하거나 다리가 저리면 멈춰요.',
      en: 'A burning, working feeling on the side and back of the top hip (outside your back pocket) is right. If your low back or front of the thigh tires first, your pelvis has rolled back. Stop if you feel a sharp twinge or tingling down the leg.',
    },
    easier: {
      ko: '벌리는 범위를 절반(무릎 사이 10cm)으로 줄이거나, 등을 벽에 붙이고 누워 골반이 뒤로 넘어가지 않게 해요.',
      en: 'Open only half as far (about 10 cm), or lie with your back against a wall so your pelvis can’t roll back.',
    },
    harder: {
      ko: '무릎 바로 위에 미니 밴드를 두르고 하거나, 맨 위에서 3초 버텨요. 익숙해지면 ‘옆으로 누워 다리 들기’로 넘어가요.',
      en: 'Loop a mini band just above your knees or hold the top for 3 seconds. When that’s easy, progress to the side-lying leg raise.',
    },
    cues: { ko: ['발뒤꿈치는 붙이고', '골반은 그대로', '엉덩이 옆을 조여요', '천천히 닫아요'], en: ['Heels stay together', 'Pelvis stays still', 'Squeeze the side of your hip', 'Close slowly'] },
    mistakes: {
      ko: [
        '무릎을 벌릴 때 골반과 몸통이 뒤로 넘어감 → 골반을 수직으로 쌓고, 넘어가기 직전까지만 벌려요.',
        '발뒤꿈치가 떨어짐 → 두 발뒤꿈치를 붙인 채 무릎만 열어요.',
        '빠르게 튕기듯 반복 → 1초 열고, 1초 버티고, 1~2초에 닫는 속도를 지켜요.',
        '허리가 젖혀지며 배가 풀림 → 배꼽을 살짝 당기고 갈비뼈를 골반 쪽으로 내려요.',
      ],
      en: [
        'Pelvis and trunk rolling back as the knee opens → Keep your hips stacked and open only until just before they roll.',
        'Heels coming apart → Keep your heels glued together and move only the knee.',
        'Bouncing through fast reps → Open for 1 second, hold 1, close over 1–2 seconds.',
        'Low back arching and belly relaxing → Draw your belly button in slightly and keep your ribs down toward your pelvis.',
      ],
    },
    why: {
      ko: '무릎이 안쪽으로 무너지지 않게 허벅지를 바깥에서 잡아 주는 중둔근과 고관절 외회전근을 깨워요. X다리 경향, 계단·스쿼트할 때 무릎 통증, 걸을 때 골반 흔들림에 좋아요.',
      en: 'Wakes up the gluteus medius and hip external rotators that stop the knee caving in — great for knock-knee alignment, knee pain on stairs or squats, and a pelvis that sways when you walk.',
    },
    muscles: { ko: '중둔근(뒤쪽), 고관절 외회전근, 대둔근 위쪽', en: 'Gluteus medius (posterior fibers), hip external rotators, upper gluteus maximus' },
    caution: { ko: '바닥에 닿은 엉덩이 옆이 눌려 아프면 두꺼운 매트나 쿠션을 깔아요. 찌릿한 통증이 있으면 멈추세요.', en: 'If the bottom hip aches from pressure, use a thicker mat or cushion. Stop if you feel sharp pain.' },
    anim: {
      view: 45,
      elev: 28,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [SIDE_LYING, merge(SIDE_LYING, { hipR: { flex: 31, abd: 37, rot: 48 } })],
      labels: [
        { ko: '무릎·뒤꿈치 포개기', en: 'Knees and heels stacked' },
        { ko: '위 무릎 열고 1초', en: 'Open top knee, hold 1 s' },
      ],
      durations: [1.1, 1.3],
      pauses: [0.3, 1],
      focus: [
        { a: 'hipR', b: 'shR', side: 'out', kind: 'work', r: 3, from: 0, to: 0.3 },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 3.4 },
      ],
      trace: ['knR'],
    },
  },
  {
    id: 'side-lying-abduction',
    name: { ko: '옆으로 누워 다리 들기', en: 'Side-lying leg raise' },
    phase: 'activate',
    position: 'sideLying',
    regions: ['glute', 'hip'],
    targets: { pelvicTilt: 0.8, lateralShift: 0.6, kneeValgus: 0.6, hipPain: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 3, holdSec: 1, perSide: true, rest: 15 },
    setup: {
      ko: [
        '왼쪽으로 누워 머리를 왼팔 위에 얹고, 아래(왼쪽) 다리는 엉덩이 45도·무릎 90도로 굽혀 받침을 만들어요.',
        '위(오른쪽) 다리는 무릎을 쭉 펴서 몸통과 일직선이 되게, 또는 몸통보다 살짝 뒤에 둬요.',
        '오른손은 가슴 앞 바닥을 짚고, 위쪽 골반을 살짝 앞으로 기울여 발끝이 정면(또는 살짝 아래)을 향하게 해요.',
      ],
      en: [
        'Lie on your left side with your head on your left arm; bend the bottom (left) leg to 45° at the hip and 90° at the knee for a stable base.',
        'Straighten the top (right) leg so it’s in line with your trunk, or slightly behind it.',
        'Place your right hand on the floor in front of your chest, tip the top hip slightly forward and point your toes forward (or slightly down).',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 뒤꿈치로 먼 벽을 밀어내듯 오른다리를 길게 뻗어요.',
        '숨을 내쉬며, 길게 뻗은 그대로 1~2초에 걸쳐 다리를 30~40도(발이 약 40cm 올라가는 높이)까지 들어 올려요. 뒤꿈치가 발끝보다 먼저 올라가요.',
        '맨 위에서 1초 버티며 엉덩이 옆이 조이는 것을 느껴요.',
        '1~2초에 걸쳐 천천히 내리되, 아래 다리에 닿기 직전(주먹 하나 높이)에서 다시 들어요.',
        '12회 반복한 뒤 반대쪽으로 돌아누워 해요.',
      ],
      en: [
        'Inhale and reach your right leg long, as if pushing a far wall away with your heel.',
        'Exhale and, keeping that length, lift the leg to 30–40° (the foot rises about 40 cm) over 1–2 seconds, heel leading the toes.',
        'Hold 1 second at the top and feel the side of your hip squeeze.',
        'Lower slowly over 1–2 seconds, stopping a fist’s height above the bottom leg before lifting again.',
        'Do 12 reps, then roll over and repeat on the other side.',
      ],
    },
    breathing: {
      ko: '들어 올리며 내쉬고, 내리며 들이마셔요. 버티는 1초 동안 숨을 참지 마세요.',
      en: 'Exhale as you lift and inhale as you lower. Don’t hold your breath during the 1-second pause.',
    },
    feel: {
      ko: '위쪽 골반 옆, 엉덩이 바깥 윗부분이 타는 듯 뻐근하면 정답이에요. 허벅지 앞이나 사타구니가 먼저 힘들면 다리가 앞으로 나왔거나 발끝이 천장을 본 거예요. 허리가 조이거나 엉덩이가 찌릿하면 멈춰요.',
      en: 'A burning feeling on the side of the top hip, just below the pelvis rim, is right. If the front of your thigh or groin works first, your leg has drifted forward or your toes turned up. Stop if your low back pinches or your hip feels a sharp twinge.',
    },
    easier: {
      ko: '들어 올리는 높이를 20도(발이 약 20cm)로 줄이거나, 위 다리 무릎을 살짝 굽혀서 해요. 그래도 버거우면 ‘클램쉘’부터 연습해요.',
      en: 'Lift only to about 20° (the foot rises about 20 cm) or keep a slight bend in the top knee. If it’s still too hard, start with clamshells.',
    },
    harder: {
      ko: '맨 위에서 3초 버티거나, 발목에 0.5~1kg 모래주머니나 밴드를 달아요. 맨 위에서 작은 원 5번 그리기를 더해도 좋아요.',
      en: 'Hold the top for 3 seconds, or add a 0.5–1 kg ankle weight or band. You can also add 5 small circles at the top.',
    },
    cues: { ko: ['뒤꿈치로 길게', '발끝은 정면', '골반은 살짝 앞으로', '천천히 내려요'], en: ['Reach long through the heel', 'Toes point forward', 'Hip tipped slightly forward', 'Lower slowly'] },
    mistakes: {
      ko: [
        '발끝이 천장을 향함 → 발끝을 정면이나 살짝 아래로 돌려, 뒤꿈치가 먼저 올라가게 해요.',
        '다리가 몸 앞쪽으로 나옴 → 다리를 몸통과 일직선이나 살짝 뒤에 두고 들어요.',
        '허리를 옆으로 꺾어 끌어올림 → 허리 옆을 길게 두고, 골반이 갈비뼈 쪽으로 올라가기 전 높이까지만 들어요.',
        '몸통이 뒤로 넘어감 → 오른손으로 가슴 앞 바닥을 짚고 골반을 수직(살짝 앞)으로 유지해요.',
      ],
      en: [
        'Toes turning up to the ceiling → Turn your toes forward or slightly down so the heel leads.',
        'Leg drifting in front of your body → Keep it in line with your trunk or slightly behind.',
        'Hitching up with your waist → Keep your waist long and lift only until the pelvis starts to hike toward your ribs.',
        'Trunk rolling back → Press your right hand into the floor in front of you and keep the hips stacked, tipped slightly forward.',
      ],
    },
    why: {
      ko: '걸을 때 골반이 한쪽으로 처지지 않게 잡아 주는 중둔근·소둔근을 강화해요. 짝다리 습관, 골반 높이 차이, 무릎이 안으로 모이는 경향을 줄이는 데 좋아요.',
      en: 'Strengthens the gluteus medius and minimus that keep your pelvis from dropping as you walk — helpful for a hip-hitch habit, uneven pelvis height and knees that drift inward.',
    },
    muscles: { ko: '중둔근, 소둔근, 대퇴근막장근(보조)', en: 'Gluteus medius and minimus, tensor fasciae latae (assisting)' },
    caution: { ko: '바닥에 닿은 엉덩이 옆이 눌려 아프면 두꺼운 매트를 깔고, 허리가 아프면 들어 올리는 높이를 줄이세요.', en: 'Use a thicker mat if the bottom hip aches from pressure, and lift lower if your back complains.' },
    anim: {
      view: 0,
      elev: 18,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [merge(SIDE_LYING, { hipR: { flex: -4 }, knR: 2, anR: 0 }), merge(SIDE_LYING, { hipR: { flex: -8, abd: 36 }, knR: 2, anR: 0 })],
      labels: [
        { ko: '위 다리 길게 뻗기', en: 'Reach the top leg long' },
        { ko: '뒤꿈치부터 들어 1초', en: 'Heel leads up, hold 1 s' },
      ],
      durations: [1.4, 1.5],
      pauses: [0.3, 1],
      focus: [
        { a: 'hipR', b: 'shR', side: 'out', kind: 'work', r: 3, from: 0, to: 0.3 },
        { a: 'hipR', b: 'knR', side: 'out', kind: 'work', r: 2.2, from: 0, to: 0.35 },
      ],
      trace: ['heelR'],
    },
  },
  {
    id: 'standing-abduction',
    name: { ko: '서서 다리 옆으로 들기', en: 'Standing hip abduction' },
    phase: 'activate',
    position: 'standing',
    regions: ['glute', 'hip'],
    targets: { pelvicTilt: 0.6, kneeValgus: 0.6, lateralShift: 0.5 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 2.5, holdSec: 1, perSide: true, rest: 15 },
    desk: true,
    setup: {
      ko: [
        '책상이나 의자 등받이 옆에 서서 왼손으로 가볍게 잡아요. 균형만 잡고 기대지는 않아요.',
        '발은 골반 너비, 발끝은 정면으로 두고, 왼쪽(디딤발) 무릎은 살짝 풀어요.',
        '오른손은 오른쪽 골반 위에 얹어 골반이 올라가지 않는지 확인해요. 정수리는 천장으로 길게 뻗어요.',
      ],
      en: [
        'Stand beside a desk or chair back and hold it lightly with your left hand — for balance only, not to lean on.',
        'Feet hip-width apart, toes forward, with a soft bend in the left (standing) knee.',
        'Rest your right hand on your right hip to check that it doesn’t hike up, and lengthen the crown of your head toward the ceiling.',
      ],
    },
    steps: {
      ko: [
        '오른발끝을 정면으로 둔 채, 숨을 내쉬며 1초에 걸쳐 오른다리를 옆으로 들어요.',
        '다리가 25~30도(발이 옆으로 약 40cm) 벌어지면 멈춰요. 몸통이 반대쪽으로 기울기 시작하기 전까지만이에요.',
        '엉덩이 옆을 조인 채 1초 버텨요.',
        '1~2초에 걸쳐 천천히 내리고, 발끝을 바닥에 가볍게 톡 대자마자 다시 들어요.',
        '12회 반복한 뒤 방향을 바꿔 왼다리도 해요.',
      ],
      en: [
        'Keeping your right toes pointing forward, exhale and lift your right leg out to the side over about 1 second.',
        'Stop when the leg is 25–30° out (foot about 40 cm to the side) — before your trunk starts to lean the other way.',
        'Hold 1 second, squeezing the side of your hip.',
        'Lower slowly over 1–2 seconds, tap your toes lightly on the floor and lift again.',
        'Do 12 reps, then turn around and work the left leg.',
      ],
    },
    breathing: {
      ko: '들어 올리며 내쉬고, 내리며 들이마셔요.',
      en: 'Exhale as you lift and inhale as you lower.',
    },
    feel: {
      ko: '들어 올린 쪽 엉덩이 옆(골반 바로 아래 바깥쪽)이 뻐근하고, 디딤발 쪽 엉덩이 옆도 버티느라 함께 힘이 들어가면 정답이에요. 허리 옆이 조이면 몸통이 기운 거예요. 찌릿한 통증이 있으면 멈춰요.',
      en: 'You should feel the side of the lifting hip (just below the pelvis rim) working, and the standing-side hip working to hold you steady. If your waist pinches, you’re leaning. Stop if you feel a sharp twinge.',
    },
    easier: {
      ko: '벌리는 범위를 절반(발이 옆으로 20cm)으로 줄이거나 두 손으로 책상을 잡고 해요. 서 있기 버거우면 ‘클램쉘’로 대신해요.',
      en: 'Move through half the range (foot about 20 cm out) or hold the desk with both hands. If standing is hard, do clamshells instead.',
    },
    harder: {
      ko: '발목에 미니 밴드를 두르고 하거나, 맨 위에서 3초 버텨요. 균형이 좋다면 손을 떼고 해 보세요.',
      en: 'Loop a mini band around your ankles or hold the top for 3 seconds. If your balance is good, try it hands-free.',
    },
    cues: { ko: ['몸통은 곧게', '발끝은 정면', '골반은 수평으로', '천천히 내려요'], en: ['Stay tall', 'Toes forward', 'Keep your hips level', 'Lower slowly'] },
    mistakes: {
      ko: [
        '상체가 반대쪽으로 기울어짐 → 정수리를 천장으로 뻗고, 몸통이 기울기 전 높이까지만 들어요.',
        '발끝이 바깥으로 돌아감 → 발끝과 무릎을 정면에 두어야 엉덩이 옆으로 들 수 있어요.',
        '들어 올리는 쪽 골반이 함께 올라감 → 오른손으로 골반을 살짝 눌러 수평인지 확인하며 들어요.',
        '책상에 기대 체중을 실음 → 손은 균형만 잡고, 디딤발 엉덩이로 버텨요.',
      ],
      en: [
        'Leaning the trunk away → Reach your crown to the ceiling and lift only as high as you can without leaning.',
        'Toes turning out → Keep toes and knee facing forward so the side of the hip does the lifting.',
        'Hip hiking up with the leg → Press lightly on your hip with your right hand and keep it level.',
        'Leaning your weight on the desk → Use your hand for balance only and hold yourself up with the standing hip.',
      ],
    },
    why: {
      ko: '서서 하는 중둔근 운동이라 들어 올리는 쪽과 버티는 디딤발 쪽을 함께 써요. 골반 좌우 균형과 무릎 정렬을 잡고, 사무실에서도 할 수 있어요.',
      en: 'A standing glute-med exercise that trains both the lifting side and the standing side at once — building pelvic balance and knee alignment, and doable at the office.',
    },
    muscles: { ko: '중둔근·소둔근(들어 올리는 쪽), 디딤발 중둔근(안정)', en: 'Gluteus medius and minimus (lifting side), standing-side gluteus medius (stability)' },
    caution: { ko: '균형이 불안하면 두 손으로 잡고, 엉덩이나 허리에 찌릿한 통증이 있으면 멈추세요.', en: 'Hold on with both hands if you feel unsteady, and stop if you feel a sharp twinge in your hip or back.' },
    avoid: ['balance'],
    anim: {
      view: 0,
      props: [{ kind: 'table', at: 'haL', key: 0, off: [14, 0, 0], size: [30, 0, 34] }],
      keys: [
        merge(STAND, { shL: { abd: 40 }, elL: 20, knL: 4 }, R_HAND_ON_HIP),
        merge(STAND, { shL: { abd: 40 }, elL: 20, knL: 4 }, R_HAND_ON_HIP, { hipR: { abd: 30 }, knR: 2 }),
      ],
      labels: [
        { ko: '책상 잡고 바르게 서기', en: 'Stand tall, hold the desk' },
        { ko: '다리 옆으로 들어 1초', en: 'Lift to the side, hold 1 s' },
      ],
      durations: [1.1, 1.3],
      pauses: [0.3, 1],
      focus: [
        { a: 'hipR', b: 'elR', side: 'out', kind: 'work', r: 3.2, from: 0, to: 0.3 },
        { a: 'hipL', b: 'elL', side: 'out', kind: 'work', r: 2.4, from: 0, to: 0.26 },
      ],
      trace: ['anR'],
    },
    coach: {
      view: 'front',
      metric: 'hipAbduction',
      mode: 'reps',
      rest: 9,
      peak: 20,
      dir: 1,
      hint: { ko: '정면에서 온몸이 보이게 휴대폰을 세워 주세요', en: 'Prop the phone in front so your whole body is visible' },
      more: { ko: '조금 더 옆으로', en: 'A little higher' },
      good: { ko: '좋아요!', en: 'Nice!' },
    },
  },
  {
    id: 'half-kneel-hip-flexor',
    name: { ko: '하프 닐링 고관절 앞 스트레칭', en: 'Half-kneeling hip flexor stretch' },
    phase: 'stretch',
    position: 'kneeling',
    regions: ['hip', 'lowBack'],
    targets: { lordosis: 1, swayback: 0.5, lowBackPain: 0.5, kneeHyperext: 0.2 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    setup: {
      ko: [
        '매트(또는 접은 수건) 위에 오른무릎을 대고 왼발은 앞에 디뎌, 두 무릎이 모두 90도가 되게 해요.',
        '오른무릎은 오른쪽 골반 바로 아래, 왼발은 왼쪽 골반 앞에 두어 두 발이 골반 너비의 기찻길 위에 있게 해요.',
        '오른발등은 바닥에 편하게 두고, 두 손은 허리에 얹어 몸통을 곧게 세워요. 시선은 정면이에요.',
      ],
      en: [
        'Kneel on your right knee on a mat (or folded towel) with your left foot in front, both knees at 90°.',
        'Keep the right knee directly under your right hip and the left foot in front of your left hip, as if on hip-width train tracks.',
        'Let the top of your right foot rest on the floor, put your hands on your hips and stand your trunk tall, eyes forward.',
      ],
    },
    steps: {
      ko: [
        '꼬리뼈를 아래로 말아 골반 앞쪽을 위로 세워요(골반 뒤로 기울이기). 이것만으로도 오른쪽 고관절 앞이 당길 수 있어요.',
        '오른쪽 엉덩이를 꽉 조여 골반 위치를 고정하고, 갈비뼈를 살짝 내려요.',
        '골반 모양을 유지한 채 몸 전체를 앞으로 5cm 정도만 옮겨요. 앞무릎은 발목 위에서 살짝 앞으로 나가요.',
        '오른쪽 사타구니~허벅지 앞이 늘어나는 지점에서 30초 버텨요.',
        '처음 자세로 돌아와 긴장을 풀고, 무릎을 바꿔 왼쪽도 해요.',
      ],
      en: [
        'Tuck your tailbone under so the front of your pelvis lifts (a posterior tilt). This alone may start to stretch the front of your right hip.',
        'Squeeze your right glute to lock that pelvic position, and draw your ribs down slightly.',
        'Keeping that pelvis shape, shift your whole body forward only about 5 cm; the front knee moves slightly past the ankle.',
        'Hold for 30 seconds where you feel the right groin and front of the thigh lengthen.',
        'Come back to the start, relax, then switch knees and do the left side.',
      ],
    },
    breathing: {
      ko: '자세를 잡으며 코로 들이마시고, 길게 내쉴 때마다 엉덩이를 조금 더 조여 골반을 1cm씩 앞으로 보내요. 버티는 동안 숨을 참지 마세요.',
      en: 'Inhale through your nose as you set up; each long exhale, squeeze the glute a little more and let your pelvis ease 1 cm forward. Keep breathing throughout the hold.',
    },
    feel: {
      ko: '뒤쪽(오른쪽) 사타구니와 허벅지 앞 위쪽이 은은하게 늘어나면 정답이에요. 허리가 당기거나 조이면 허리가 젖혀진 거예요. 무릎 앞이 눌려 아프거나 사타구니가 찌릿하면 멈춰요.',
      en: 'A gentle stretch in the right groin and upper front thigh is right. If your low back pulls or pinches, you’re arching. Stop if the kneecap hurts from pressure or the groin feels sharp or electric.',
    },
    easier: {
      ko: '무릎 아래 수건을 두 겹으로 접어 받치거나 한 손으로 의자를 잡고 해요. 앞으로 옮기지 말고 골반만 말아도 충분해요. 무릎을 꿇기 어려우면 ‘서서 고관절 앞 늘리기’로 대신해요.',
      en: 'Pad the knee with a double-folded towel or hold a chair with one hand. Just tucking the pelvis without shifting forward is enough. If kneeling is hard, do the standing hip flexor stretch instead.',
    },
    harder: {
      ko: '늘린 상태에서 오른팔을 머리 위로 뻗고 몸통을 왼쪽으로 살짝 기울여 옆구리까지 늘려요. 버티는 시간은 45초까지 늘려도 좋아요.',
      en: 'While holding, reach your right arm overhead and lean slightly to the left to stretch along the side of your trunk. You can build the hold up to 45 seconds.',
    },
    cues: { ko: ['꼬리뼈를 아래로', '뒤쪽 엉덩이 꽉', '갈비뼈는 내려요', '내쉬며 조금 앞으로'], en: ['Tailbone down', 'Squeeze the back glute', 'Ribs down', 'Exhale and ease forward'] },
    mistakes: {
      ko: [
        '허리를 젖혀 늘리는 척함 → 갈비뼈를 내리고 꼬리뼈를 말아, 허리가 아닌 사타구니가 늘어나게 해요.',
        '몸을 너무 멀리 밀어 앞무릎이 발끝을 한참 넘어감 → 5cm 정도만 옮기고, 앞무릎은 발목 위~살짝 앞에 둬요.',
        '골반이 앞다리 쪽으로 돌아감 → 허리 앞 튀어나온 두 골반뼈가 정면을 보게 손으로 확인해요.',
        '상체가 앞으로 숙여짐 → 정수리를 위로 뻗어 어깨가 골반 바로 위에 오게 해요.',
      ],
      en: [
        'Arching the back to fake the stretch → Drop your ribs and tuck your tailbone so the groin stretches, not your low back.',
        'Lunging so far that the front knee is well past the toes → Shift only about 5 cm, keeping the front knee over or just past the ankle.',
        'Pelvis rotating toward the front leg → Use your hands to check that both front hip bones face straight ahead.',
        'Trunk tipping forward → Reach your crown up so your shoulders stay stacked over your pelvis.',
      ],
    },
    why: {
      ko: '오래 앉아 짧아진 장요근·대퇴직근이 골반을 앞으로 당겨 허리를 휘게 만들어요. 골반을 세운 채 늘려야 허리 대신 고관절 앞이 늘어나요. 오리형(골반 앞쏠림)·허리 통증 관리의 필수 스트레칭이에요.',
      en: 'Hip flexors shortened by sitting pull the pelvis forward and arch the low back. Tucking the pelvis first makes the stretch land in the hip instead of the spine — a must-do for anterior tilt and back pain.',
    },
    muscles: { ko: '장요근, 대퇴직근 (늘리는 쪽 대둔근·복부는 골반 고정)', en: 'Iliopsoas, rectus femoris (glute and abs on the stretched side hold the pelvis)' },
    caution: { ko: '무릎이 아프면 수건을 접어 받치거나 ‘서서 고관절 앞 늘리기’로 대신하세요. 사타구니가 찌릿하면 멈추세요.', en: 'If the knee hurts, pad it with a folded towel or do the standing version instead. Stop if the groin feels sharp or electric.' },
    avoid: ['kneePain', 'kneeSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'mat' }],
      anchor: ['knR'],
      // 뒷무릎·발등은 매트에, 앞발은 그 자리에 둔 채 골반만 말았다가(키 1) 앞으로 옮김(키 2)
      keys: [
        merge(HALF_KNEEL, HIPS_HANDS, { hipL: { flex: 93 }, knL: 93, knR: 81 }),
        merge(HALF_KNEEL, HIPS_HANDS, TUCK, { hipL: { flex: 79 }, knL: 95, anL: 2, hipR: { flex: -24 }, knR: 79 }),
        merge(HALF_KNEEL, HIPS_HANDS, TUCK, { hipL: { flex: 80 }, knL: 104, anL: 10, hipR: { flex: -32 }, knR: 71 }),
      ],
      labels: [
        { ko: '한쪽 무릎 꿇고 서기', en: 'Tall half-kneel' },
        { ko: '꼬리뼈 말고 엉덩이 조이기', en: 'Tuck tailbone, squeeze glute' },
        { ko: '골반 앞으로, 30초', en: 'Shift forward, hold 30 s' },
      ],
      durations: [1.2, 1.4, 1.8],
      pauses: [0.6, 0.8, 3],
      holdKey: 2,
      focus: [
        { a: 'waist', b: 'hipR', side: 'front', kind: 'stretch', r: 3.4, from: 0.3, to: 1 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'stretch', r: 2.6, from: 0.1, to: 0.65 },
        { a: 'hipR', b: 'backMid', side: 'back', kind: 'work', r: 3.4, from: 0.1, to: 0.5 },
      ],
      trace: ['pelvis'],
    },
  },
  {
    id: 'standing-hip-flexor',
    name: { ko: '서서 고관절 앞 늘리기', en: 'Standing hip flexor stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['hip'],
    targets: { lordosis: 0.8, swayback: 0.4, lowBackPain: 0.4 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '왼발을 앞으로 크게 한 걸음(발 길이 두 개 반, 약 60~70cm) 내딛고, 두 발은 골반 너비의 기찻길 위에 둬요.',
        '오른발 뒤꿈치를 들어 발볼로 서고, 두 발끝과 골반은 모두 정면을 향하게 해요.',
        '두 손은 허리에 얹고 몸통을 곧게 세워요. 균형이 불안하면 한 손으로 벽이나 책상을 잡아요.',
      ],
      en: [
        'Take a big step forward with your left foot (about two and a half foot-lengths, 60–70 cm), feet on hip-width train tracks.',
        'Lift your right heel so you stand on the ball of the foot, with both toes and your pelvis facing straight ahead.',
        'Put your hands on your hips and stand tall. If you feel unsteady, hold a wall or desk with one hand.',
      ],
    },
    steps: {
      ko: [
        '꼬리뼈를 아래로 말아 골반 앞쪽을 위로 세우고, 오른쪽 엉덩이를 꽉 조여요.',
        '상체를 곧게 세운 채 앞무릎을 천천히 굽히며 골반을 앞·아래로 5cm 정도 보내요.',
        '뒷무릎은 살짝 굽혀도 괜찮아요. 오른쪽 사타구니~허벅지 앞이 당기는 지점에서 멈춰요.',
        '그대로 30초 버티며, 내쉴 때마다 엉덩이를 조금 더 조여요.',
        '앞무릎을 펴며 처음 자세로 돌아오고, 다리를 바꿔 반대쪽도 해요.',
      ],
      en: [
        'Tuck your tailbone under so the front of your pelvis lifts, and squeeze your right glute.',
        'Keeping your trunk tall, slowly bend the front knee and let your pelvis travel forward and down about 5 cm.',
        'A slight bend in the back knee is fine. Stop where you feel the right groin and front of the thigh pull.',
        'Hold for 30 seconds, squeezing the glute a little more with each exhale.',
        'Straighten the front knee to return, then switch legs.',
      ],
    },
    breathing: {
      ko: '버티는 동안 코로 천천히 들이마시고, 입으로 길게 내쉴 때마다 엉덩이를 조금 더 조여 골반을 앞으로 보내요.',
      en: 'Breathe in slowly through your nose while holding; on each long exhale, squeeze the glute a bit more and let the pelvis ease forward.',
    },
    feel: {
      ko: '뒷다리(오른쪽) 사타구니와 허벅지 앞 위쪽이 늘어나면 정답이에요. 허리가 조이면 상체가 뒤로 젖혀진 거예요. 사타구니가 찌릿하거나 무릎이 아프면 멈춰요.',
      en: 'A stretch in the right groin and upper front thigh is right. If your low back pinches, you’re leaning back. Stop if the groin feels sharp or your knee hurts.',
    },
    easier: {
      ko: '보폭을 줄이고 앞무릎을 조금만 굽혀요. 한 손으로 벽이나 책상을 잡으면 골반 모양에 집중하기 쉬워요.',
      en: 'Shorten your stride and bend the front knee only a little. Holding a wall or desk makes it easier to focus on the pelvis.',
    },
    harder: {
      ko: '늘린 채 오른팔을 머리 위로 뻗어 왼쪽으로 살짝 기울여요. 바닥에 무릎을 댈 수 있다면 ‘하프 닐링 고관절 앞 스트레칭’으로 넘어가요.',
      en: 'While holding, reach your right arm overhead and lean slightly left. If you can kneel comfortably, progress to the half-kneeling hip flexor stretch.',
    },
    cues: { ko: ['꼬리뼈를 아래로', '뒤쪽 엉덩이 꽉', '상체는 곧게', '골반만 앞으로'], en: ['Tailbone down', 'Squeeze the back glute', 'Trunk tall', 'Move only the pelvis forward'] },
    mistakes: {
      ko: [
        '허리를 뒤로 젖혀 당기는 척함 → 갈비뼈를 내리고 꼬리뼈를 말아, 허리 대신 사타구니가 늘어나게 해요.',
        '골반이 앞다리 쪽으로 돌아감 → 두 골반뼈와 뒷발끝이 모두 정면을 보게 맞춰요.',
        '상체가 앞으로 숙여짐 → 어깨를 골반 바로 위에 두고 정수리를 위로 뻗어요.',
        '두 발을 한 줄로 놓아 흔들림 → 두 발을 골반 너비로 벌려 기찻길처럼 서요.',
      ],
      en: [
        'Arching the back to fake the stretch → Drop your ribs and tuck your tailbone so the groin stretches, not the low back.',
        'Pelvis rotating toward the front leg → Keep both hip bones and the back toes facing straight ahead.',
        'Trunk tipping forward → Keep your shoulders stacked over your pelvis and reach your crown up.',
        'Feet on one line, so you wobble → Set your feet hip-width apart, like standing on train tracks.',
      ],
    },
    why: {
      ko: '무릎을 꿇기 어려운 사무실에서도 할 수 있는 고관절 굴곡근 스트레칭이에요. 앉아 있는 동안 짧아진 장요근을 늘려 골반 앞쏠림과 허리 부담을 줄여요.',
      en: 'A hip-flexor stretch you can do at the office without kneeling. It lengthens the iliopsoas shortened by sitting, easing anterior pelvic tilt and low-back load.',
    },
    muscles: { ko: '장요근, 대퇴직근 (늘리는 쪽 대둔근은 골반 고정)', en: 'Iliopsoas, rectus femoris (glute on the stretched side holds the pelvis)' },
    caution: { ko: '사타구니 앞이 찌릿하거나 허리가 아프면 보폭을 줄이고, 균형이 불안하면 벽을 잡으세요.', en: 'If the front of the groin feels sharp or your back hurts, shorten your stride; hold a wall if you feel unsteady.' },
    anim: {
      view: 90,
      anchor: ['toeR'],
      // 두 발은 그 자리에 둔 채 골반만 말았다가(키 1) 앞무릎을 굽혀 골반을 앞·아래로(키 2)
      keys: [
        SPLIT_STANCE,
        merge(SPLIT_STANCE, TUCK, { hipL: { flex: 8 }, hipR: { flex: -36 } }),
        merge(SPLIT_STANCE, TUCK, { hipL: { flex: 26 }, knL: 47, anL: 7, hipR: { flex: -41 }, knR: 21, anR: 19 }),
      ],
      labels: [
        { ko: '앞뒤로 크게 벌려 서기', en: 'Split stance, stand tall' },
        { ko: '꼬리뼈 말고 엉덩이 조이기', en: 'Tuck tailbone, squeeze glute' },
        { ko: '앞무릎 굽혀 30초', en: 'Bend front knee, hold 30 s' },
      ],
      durations: [1.2, 1.4, 1.6],
      pauses: [0.6, 0.8, 3],
      holdKey: 2,
      focus: [
        { a: 'waist', b: 'hipR', side: 'front', kind: 'stretch', r: 3.4, from: 0.3, to: 1 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'stretch', r: 2.6, from: 0.1, to: 0.65 },
        { a: 'hipR', b: 'backMid', side: 'back', kind: 'work', r: 3.4, from: 0.1, to: 0.5 },
      ],
      trace: ['pelvis'],
    },
  },
  {
    id: 'figure4-stretch',
    name: { ko: '의자 4자 엉덩이 스트레칭', en: 'Seated figure-4 stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['glute', 'hip', 'lowBack'],
    targets: { hipPain: 0.8, lowBackPain: 0.6, pelvicTilt: 0.4, stiffness: 0.4 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 절반에 앉아 두 발을 골반 너비로 바닥에 두고, 무릎은 90도로 세워요.',
        '골반을 세워 두 좌골(엉덩이 아래 뼈)에 체중을 고르게 싣고, 허리를 곧게 펴요.',
        '오른발목 바깥쪽을 왼무릎 바로 위 허벅지에 올려 숫자 4 모양을 만들고, 발끝을 몸 쪽으로 당겨 발목을 세워요.',
        '오른손은 오른무릎 안쪽에, 왼손은 오른발목 위에 가볍게 얹어요.',
      ],
      en: [
        'Sit on the front half of the chair, feet flat and hip-width apart, knees at 90°.',
        'Sit up on both sit bones with your weight even and your back tall.',
        'Rest the outside of your right ankle on your left thigh just above the knee to make a “4”, and pull your toes back toward you so the ankle stays firm.',
        'Rest your right hand on the inside of your right knee and your left hand on your right ankle.',
      ],
    },
    steps: {
      ko: [
        '정수리를 위로 길게 뻗어 허리를 곧게 세워요.',
        '숨을 내쉬며 등을 편 채, 사타구니에서 접듯이 3초에 걸쳐 가슴을 앞으로 숙여요.',
        '오른쪽 엉덩이 깊은 곳이 당기기 시작하면 멈춰요. 보통 가슴이 10cm 안팎만 앞으로 가도 충분해요.',
        '그대로 30초 버티며, 내쉴 때마다 1~2cm씩 더 숙여요.',
        '천천히 상체를 세우고 다리를 내린 뒤, 반대쪽도 해요.',
      ],
      en: [
        'Reach the crown of your head up to lengthen your back.',
        'Exhale and, keeping your back flat, fold from your hips to bring your chest forward over 3 seconds.',
        'Stop when you feel a pull deep in the right buttock — usually after only about 10 cm of forward travel.',
        'Hold for 30 seconds, easing 1–2 cm further forward on each exhale.',
        'Slowly sit up, lower the leg, and switch sides.',
      ],
    },
    breathing: {
      ko: '숙이며 내쉬고, 버티는 동안 코로 들이마실 땐 등을 길게, 입으로 내쉴 땐 조금 더 숙여요.',
      en: 'Exhale as you fold; while holding, lengthen your back as you inhale through your nose and ease a little deeper as you exhale.',
    },
    feel: {
      ko: '오른쪽 엉덩이 바깥과 깊은 곳(바지 뒷주머니 부근)이 늘어나면 정답이에요. 무릎 안쪽이 아프거나, 엉덩이에서 다리 뒤로 찌릿하게 저린 느낌이 내려가면 바로 멈춰요.',
      en: 'A stretch on the outside and deep in the right buttock (around your back pocket) is right. Stop at once if the inside of the knee hurts or you feel tingling running from the buttock down the back of the leg.',
    },
    easier: {
      ko: '발목을 무릎이 아닌 정강이 중간쯤에 올려 각도를 줄이거나, 숙이지 않고 곧게 앉은 채 버텨요.',
      en: 'Rest the ankle on your mid-shin instead of the knee to reduce the angle, or simply sit tall without folding forward.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘리거나, 바닥에 누워 4자 모양을 만든 뒤 왼허벅지를 가슴 쪽으로 당기는 ‘누워서 4자 스트레칭’으로 넘어가요.',
      en: 'Build the hold to 45 seconds, or progress to the lying figure-4: make the same “4” on your back and pull the left thigh toward your chest.',
    },
    cues: { ko: ['등은 곧게', '가슴을 앞으로', '발끝은 몸 쪽으로', '내쉬며 조금 더'], en: ['Keep your back long', 'Chest forward', 'Toes pulled back', 'Exhale, ease deeper'] },
    mistakes: {
      ko: [
        '등을 둥글게 말아 숙임 → 가슴을 앞으로 내밀듯 사타구니에서 접어요. 숙이는 양보다 등 모양이 먼저예요.',
        '손으로 무릎을 억지로 누름 → 손은 얹기만 하고, 상체 기울기로 강도를 조절해요.',
        '발목이 꺾여 발이 늘어짐 → 발끝을 몸 쪽으로 당겨 발목을 세워, 발목과 무릎을 보호해요.',
        '앉은 골반이 한쪽으로 틀어짐 → 두 좌골을 의자에 고르게 붙인 채 숙여요.',
      ],
      en: [
        'Rounding the back to fold → Lead with your chest and hinge from the hips; back shape comes before depth.',
        'Forcing the knee down with your hand → Just rest the hand there and control the intensity with how far you lean.',
        'Letting the ankle sag → Pull your toes back to keep the ankle firm and protect both ankle and knee.',
        'Pelvis twisting on the seat → Keep both sit bones evenly on the chair as you fold.',
      ],
    },
    why: {
      ko: '오래 앉으면 굳는 엉덩이 깊은 근육(이상근 등 외회전근)과 대둔근을 늘려 골반·허리 긴장과 엉덩이 뻐근함을 줄여요. 의자만 있으면 사무실에서도 할 수 있어요.',
      en: 'Stretches the deep hip rotators such as the piriformis, plus the gluteus maximus, which stiffen with sitting — easing pelvic and low-back tension and buttock tightness. All you need is a chair.',
    },
    muscles: { ko: '이상근 등 심부 외회전근, 대둔근', en: 'Piriformis and deep external rotators, gluteus maximus' },
    caution: { ko: '엉덩이에서 다리로 저림이 내려가거나 무릎 안쪽이 아프면 바로 멈추세요. 고관절 수술을 받았다면 먼저 담당 의료진과 상의하세요.', en: 'Stop at once if tingling runs down the leg or the inside of the knee hurts. If you’ve had hip surgery, check with your care team first.' },
    avoid: ['kneeSevere', 'radiating'],
    anim: {
      view: 14,
      props: [{ kind: 'chair' }],
      anchor: ['sitL', 'sitR'],
      keys: [
        SIT,
        merge(SIT, { hipR: { flex: 146, abd: 0, rot: 68, hab: 56 }, knR: 104, anR: 0, shR: { flex: 31, abd: 84, rot: -27, hab: 0 }, elR: 103, shL: { flex: 54, abd: 6, rot: -39, hab: -20 }, elL: 35 }),
        merge(SIT, FIG4_LEG, { shR: { flex: 18, abd: 59, hab: 6, rot: -35 }, elR: 93, shL: { flex: 33, abd: 35, hab: 0, rot: -45 }, elL: 77 }),
        merge(SIT, {
          root: { pitch: 18 },
          thorax: { flex: 4 },
          neck: { flex: -8 },
          head: { flex: -4 },
          hipL: { flex: 110, abd: 10 },
          knL: 95,
          anL: 5,
          hipR: { flex: 123, abd: 5, rot: 120, hab: 50 },
          knR: 122,
          anR: -5,
          shR: { flex: -2, abd: 76, hab: 3, rot: -28 },
          elR: 123,
          shL: { flex: 29, abd: 52, hab: -5, rot: -31 },
          elL: 111,
        }),
      ],
      labels: [
        { ko: '의자에 바르게 앉기', en: 'Sit tall' },
        { ko: '다리 들어 올리기', en: 'Lift the leg' },
        { ko: '발목을 반대 무릎 위에', en: 'Ankle on the other knee' },
        { ko: '가슴 숙여 30초', en: 'Fold forward, hold 30 s' },
      ],
      durations: [1, 0.9, 2, 1.4],
      pauses: [0.5, 0.2, 0.6, 3],
      holdKey: 3,
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'stretch', r: 4 },
        { a: 'hipR', b: 'shR', side: 'out', kind: 'stretch', r: 3, from: 0, to: 0.28 },
      ],
      trace: ['anR'],
    },
  },
  {
    id: 'butterfly',
    name: { ko: '나비 자세 (허벅지 안쪽)', en: 'Butterfly stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['hip'],
    targets: { kneeValgus: 0.6, hipPain: 0.4, pelvicTilt: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, rest: 5 },
    setup: {
      ko: [
        '매트에 앉아 무릎을 세우고 두 발바닥을 마주 붙여요. 발뒤꿈치는 사타구니에서 약 한 뼘 반(25~30cm) 앞이에요.',
        '두 손으로 발목이나 발등을 감싸 잡고, 좌골로 바닥을 눌러 허리를 곧게 세워요.',
        '허리가 둥글게 말리면 엉덩이 아래에 접은 수건을 깔아요. 어깨는 내리고 시선은 정면이에요.',
      ],
      en: [
        'Sit on a mat with knees bent and the soles of your feet pressed together, heels about one and a half hand-spans (25–30 cm) from your groin.',
        'Hold your ankles or the tops of your feet and press your sit bones into the floor to sit tall.',
        'If your low back rounds, sit on a folded towel. Keep your shoulders down and eyes forward.',
      ],
    },
    steps: {
      ko: [
        '발바닥을 붙인 채 두 무릎을 옆으로 천천히 떨어뜨려요. 무릎은 중력에 맡기고 힘을 빼요.',
        '정수리를 천장으로 길게 뻗어 허리를 세우고 숨을 들이마셔요.',
        '숨을 내쉬며 등을 편 채 사타구니에서 접듯 3초에 걸쳐 가슴을 발 쪽으로 10~20cm 숙여요.',
        '허벅지 안쪽이 당기는 지점에서 30초 버텨요. 내쉴 때마다 무릎이 1~2cm씩 저절로 내려가게 둬요.',
        '천천히 상체를 세우고, 두 손으로 무릎 바깥을 받쳐 모은 뒤 다리를 펴요.',
      ],
      en: [
        'Keeping the soles together, slowly let both knees fall out to the sides. Let gravity do it and relax your legs.',
        'Reach the crown of your head toward the ceiling to sit tall, and inhale.',
        'Exhale and, keeping your back flat, fold from your hips to bring your chest 10–20 cm toward your feet over 3 seconds.',
        'Hold for 30 seconds where the inner thighs pull, letting the knees sink 1–2 cm on each exhale.',
        'Slowly sit up, support the outside of your knees with your hands to bring them together, and straighten your legs.',
      ],
    },
    breathing: {
      ko: '숙이며 내쉬고, 버티는 동안 들이마실 땐 등을 길게, 내쉴 땐 허벅지 안쪽 힘을 빼요.',
      en: 'Exhale as you fold; while holding, lengthen your spine as you inhale and let your inner thighs soften as you exhale.',
    },
    feel: {
      ko: '양쪽 허벅지 안쪽(사타구니 부근~무릎 쪽 절반)이 당기면 정답이에요. 무릎 안쪽 관절이 아프거나 사타구니가 찌릿하면 발을 몸에서 더 멀리 두고 강도를 낮춰요.',
      en: 'A pull along both inner thighs, from the groin toward the knees, is right. If the inside of the knee joint aches or the groin feels sharp, move your feet farther away and ease off.',
    },
    easier: {
      ko: '발을 몸에서 두 뼘 정도로 멀리 두거나, 등을 벽에 기대고 앉아 숙이지 않고 버텨요. 무릎 아래에 쿠션을 받쳐도 좋아요.',
      en: 'Move your feet about two hand-spans away, or sit with your back against a wall and hold without folding. Cushions under your knees help too.',
    },
    harder: {
      ko: '발뒤꿈치를 사타구니 쪽으로 더 당기고, 들이마실 때 무릎을 3초 살짝 모으듯 힘을 줬다가 내쉬며 풀어 조금 더 깊이 들어가요(3~4번).',
      en: 'Bring your heels closer to your groin, and try contract-relax: as you inhale, gently press your knees up against gravity for 3 seconds, then exhale, relax and sink a little deeper (3–4 rounds).',
    },
    cues: { ko: ['허리는 곧게', '가슴을 발 쪽으로', '무릎 힘을 빼요', '내쉬며 조금 더'], en: ['Tall spine', 'Chest toward your feet', 'Let your knees relax', 'Exhale, ease deeper'] },
    mistakes: {
      ko: [
        '손이나 팔꿈치로 무릎을 억지로 누름 → 무릎은 중력에 맡기고, 숨을 내쉬며 스스로 내려가게 둬요.',
        '등을 둥글게 말아 머리만 숙임 → 가슴을 발 쪽으로 보내듯 사타구니에서 접어요. 수건 위에 앉으면 쉬워요.',
        '발을 너무 몸 가까이 당겨 무릎·사타구니가 아픔 → 발을 한 뼘 더 멀리 두고 시작해요.',
        '무릎을 위아래로 튕김 → 튕기지 말고 30초 동안 가만히 버텨요.',
      ],
      en: [
        'Pushing the knees down with your hands or elbows → Let gravity lower them as you breathe out.',
        'Rounding the back and dropping just the head → Hinge from the hips, leading with your chest; sitting on a towel helps.',
        'Pulling the feet in so close that knees or groin hurt → Start with your feet a hand-span farther away.',
        'Bouncing the knees → No bouncing; hold still for the full 30 seconds.',
      ],
    },
    why: {
      ko: '짧아진 내전근(허벅지 안쪽)은 무릎을 안쪽으로 끌어 X다리 경향을 키우고 고관절 움직임을 막아요. 앉은 채 편하게 내전근을 늘리고 고관절을 열어 줘요.',
      en: 'Tight adductors pull the knees inward, feeding knock-knee alignment and limiting hip movement. This seated stretch lengthens them and opens the hips comfortably.',
    },
    muscles: { ko: '고관절 내전근(장내전근·단내전근·박근), 치골근', en: 'Hip adductors (adductor longus and brevis, gracilis), pectineus' },
    caution: { ko: '무릎 안쪽이나 사타구니가 찌릿하면 발을 멀리 두고 강도를 낮추세요.', en: 'If the inner knee or groin feels sharp, move your feet farther away and ease off.' },
    avoid: ['kneeSevere'],
    anim: {
      view: 20,
      elev: 26,
      props: [{ kind: 'mat' }],
      anchor: ['sitL', 'sitR'],
      keys: [
        merge({ root: { pitch: -4 } }, both({ hip: { flex: 136, abd: 4, rot: 47, hab: 34 }, kn: 123, an: -21, sh: { flex: 41, abd: -27, hab: 12 }, el: 1 })),
        merge({ root: { pitch: -2 } }, both({ hip: { flex: 101, abd: 17, rot: 94, hab: 61 }, kn: 124, an: -25, sh: { flex: 42, abd: -27, hab: 11 }, el: 1 })),
        // 등을 편 채 골반부터 앞으로 접기(허리·등 굽힘 없이), 다리·손 위치는 그대로
        merge(
          { root: { pitch: 20 }, lumbar: { flex: 0 }, thorax: { flex: 2 }, neck: { flex: -6 } },
          both({ hip: { flex: 112, abd: 4, rot: 101, hab: 64 }, kn: 124, an: -26, sh: { flex: 24, abd: -33, rot: 8, hab: -4 }, el: 65 }),
        ),
      ],
      labels: [
        { ko: '발바닥 붙이고 앉기', en: 'Soles together' },
        { ko: '무릎 옆으로 떨어뜨리기', en: 'Let the knees fall open' },
        { ko: '가슴 숙여 30초', en: 'Fold forward, hold 30 s' },
      ],
      durations: [1.4, 1.6, 1.6],
      pauses: [0.5, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'in', kind: 'stretch', r: 2.8, from: 0.05, to: 0.8 },
        { a: 'hipL', b: 'knL', side: 'in', kind: 'stretch', r: 2.8, from: 0.05, to: 0.8 },
      ],
      trace: ['knR'],
    },
  },
];
