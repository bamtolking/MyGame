/**
 * 운동 라이브러리 · 어깨·견갑 (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, mirrorPose, type Pose } from '../../figure/rig';
import { PRONE, SIDE_LYING, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서 쓰는 자세 ─────────────────────

/** 엎드려 팔을 T자로 벌리고 바닥에 내려놓은 자세 (이마는 수건 위) */
const PRONE_T: Pose = merge(PRONE, both({ sh: { abd: 90, hab: -12, rot: 70 }, el: 2 }), { neck: { flex: 12 } });

/** 엎드려 팔을 W자로(팔꿈치 굽혀 손은 머리 옆) 바닥에 내려놓은 자세 */
const PRONE_W: Pose = merge(PRONE, both({ sh: { abd: 65, hab: -25, rot: 88 }, el: 100 }), { neck: { flex: 12 } });

/** 왼쪽으로 누워 위쪽(오른)팔 팔꿈치 90°, 아래팔은 배 위에 */
const SL_ER: Pose = merge(SIDE_LYING, { shR: { flex: 0, abd: 16, rot: -40 }, elR: 90 });

/** 오른쪽으로 누운 자세(머리는 베개 위), 아래쪽(오른)팔은 어깨 높이에서 몸 앞으로 90°, 팔꿈치 90°로 아래팔이 천장을 향함 */
const SL_RIGHT: Pose = mirrorPose(SIDE_LYING);
const SLEEPER: Pose = merge(SL_RIGHT, { shR: { flex: 0, abd: 90, hab: -90, rot: 0 }, elR: 90 });

/** 벽을 마주 보고 서기 (턱 살짝 당김) */
const FACE_WALL: Pose = merge(STAND, { neck: { flex: -4 }, head: { flex: 6 } });

/** 몸을 앞으로 p° 기울일 때 발바닥이 바닥에 붙어 있도록 발목도 같이 굽힘 */
const lean = (p: number): Pose => merge({ root: { pitch: p } }, both({ an: p }));

/** 벽 푸시업: 팔을 편 채 벽을 짚고 몸을 16° 기울인 자세 (손은 어깨너비보다 조금 넓게, 손끝은 위로) */
const WALL_PUSH_TOP: Pose = merge(FACE_WALL, lean(16), both({ sh: { flex: 102, hab: 12 }, el: 0, wr: 88 }));
/** 벽 푸시업 아래 자세: 손은 같은 자리에 둔 채 팔꿈치를 몸통에서 약 45° 벌려 굽힘 */
const WALL_PUSH_LOW: Pose = merge(FACE_WALL, lean(25), both({ sh: { flex: 75, abd: -4, hab: 16 }, el: 98, wr: 30 }));

/** 팔꿈치 90°로 옆구리에 붙이고 선 자세(오른팔) */
const ER_STAND: Pose = merge(STAND, { shR: { abd: 12, rot: -35 }, elR: 90 });

export const SHOULDER_PLUS: Exercise[] = [
  // ───────────────────────── 엎드려 T 들기
  {
    id: 'prone-t-raise',
    name: { ko: '엎드려 T 들기', en: 'Prone T raise' },
    phase: 'activate',
    position: 'prone',
    regions: ['upperBack', 'shoulder'],
    targets: { roundShoulder: 0.9, kyphosis: 0.6, upperBackPain: 0.5, fhp: 0.2 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, holdSec: 3, rest: 20 },
    setup: {
      ko: [
        '매트에 엎드려 이마 밑에 접은 수건(두께 3~4cm)을 받쳐 코가 바닥에 닿지 않게 하고, 턱은 살짝 당겨 뒷목을 길게 해요.',
        '다리는 골반 너비로 곧게 펴고 발등을 바닥에 편하게 내려놓아요.',
        '두 팔을 어깨 높이에서 옆으로 쭉 펴 몸과 90°(알파벳 T)가 되게 하고, 엄지가 천장을 향하도록 손바닥을 앞(머리 쪽)으로 돌려요.',
        '배꼽을 등 쪽으로 살짝 당겨 허리가 꺼지지 않게 해요.',
      ],
      en: [
        'Lie face down on a mat with a folded towel (3–4 cm thick) under your forehead so your nose clears the floor; tuck your chin slightly to lengthen the back of your neck.',
        'Legs straight and hip-width apart, tops of your feet resting on the floor.',
        'Stretch both arms straight out to the sides at shoulder height, 90° to your body (a “T”), and turn your palms forward so your thumbs point to the ceiling.',
        'Draw your belly button gently in so your low back doesn’t sag.',
      ],
    },
    steps: {
      ko: [
        '먼저 날개뼈를 귀에서 멀어지게 1cm 내리고, 등뼈 쪽으로 살짝 모아요.',
        '팔꿈치를 편 채 엄지를 천장으로 향하고, 날개뼈를 더 모으며 두 팔을 2초에 걸쳐 들어 올려요. 팔이 몸통과 수평이 되는 정도(손끝이 바닥에서 5~8cm)면 충분해요.',
        '맨 위에서 3초 버티며 날개뼈 사이가 단단해지는 걸 느껴요.',
        '2초에 걸쳐 천천히 내려 손이 바닥에 살짝 닿으면 힘을 한 번 풀어요.',
        '10회 반복해요. 이마는 계속 수건 위에 두고 팔만 움직여요.',
      ],
      en: [
        'First slide your shoulder blades 1 cm down away from your ears and gently toward your spine.',
        'With elbows straight and thumbs up, squeeze your blades further and lift both arms over 2 seconds — just until they’re level with your body (fingertips 5–8 cm off the floor).',
        'Hold at the top for 3 seconds, feeling the area between your shoulder blades firm up.',
        'Lower slowly over 2 seconds; let your hands touch down lightly and relax for a moment.',
        'Repeat 10 times. Your forehead stays on the towel — only your arms move.',
      ],
    },
    breathing: { ko: '팔을 들어 올리며 입으로 “후—” 내쉬고, 버티는 3초 동안은 코로 짧게 숨 쉬어요. 내려놓으면서 들이마셔요.', en: 'Exhale through your mouth as you lift, take small nose breaths during the 3-second hold, and inhale as you lower.' },
    feel: { ko: '두 날개뼈 사이와 어깨 뒤쪽이 따뜻하게 힘이 들어가면 정답이에요. 어깨 위나 앞이 찝히거나, 손이 저리거나, 허리가 아프면 바로 내려놓으세요.', en: 'Warm, working muscles between your shoulder blades and at the back of your shoulders. If the top or front of your shoulder pinches, your hands tingle or your low back hurts, lower your arms right away.' },
    easier: { ko: '팔꿈치를 90°로 굽혀 팔 길이를 짧게 하거나, 한 팔씩 번갈아 들어요. 그래도 버거우면 팔을 W자로 굽힌 ‘엎드려 W 당기기’부터 해요. 엎드리기 불편하면 서서 하는 ‘날개뼈 모으며 팔 벌리기’로 바꿔요.', en: 'Bend your elbows to 90° to shorten the lever, or lift one arm at a time. Still too hard? Start with the prone W pull, arms bent in a “W”. If lying face down is uncomfortable, switch to the standing scapular squeeze.' },
    harder: { ko: '버티는 시간을 5초로 늘리거나 손에 작은 물병(0.5kg)을 쥐어요. 익숙해지면 ‘엎드려 Y 들기’로 넘어가세요.', en: 'Extend the hold to 5 seconds or hold small water bottles (0.5 kg). Once it’s easy, progress to the prone Y raise.' },
    cues: { ko: ['날개뼈를 가운데로', '엄지는 천장으로', '이마는 수건 위에', '3초 버텨요'], en: ['Blades to the middle', 'Thumbs to the ceiling', 'Forehead stays down', 'Hold for three'] },
    mistakes: {
      ko: [
        '고개와 가슴까지 들어 올림 → 이마를 수건에 붙인 채 팔만 들어요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 날개뼈를 먼저 아래로 내리고, 목을 길게 유지해요.',
        '높이 들려고 허리를 젖힘 → 팔이 몸통과 수평이면 충분해요. 배를 살짝 당기고 두덩뼈를 바닥에 지그시 눌러요.',
        '손바닥이 바닥을 향함(엄지가 아래) → 엄지를 천장으로 돌려야 어깨 앞이 찝히지 않아요.',
      ],
      en: [
        'Lifting the head and chest → Keep your forehead on the towel and lift only your arms.',
        'Shoulders shrugging toward the ears → Set your blades down first and keep your neck long.',
        'Arching the low back to lift higher → Level with your body is plenty; draw your belly in and press your pubic bone gently into the floor.',
        'Palms facing the floor (thumbs down) → Turn your thumbs to the ceiling so the front of the shoulder doesn’t pinch.',
      ],
    },
    why: { ko: '말린 어깨는 날개뼈가 등뼈에서 멀어져 앞으로 벌어져 있어요. 날개뼈를 등 가운데로 모아 주는 중부 승모근과 능형근을 골라 강화해 어깨를 뒤로 되돌리는 힘을 길러요.', en: 'With rounded shoulders the blades drift apart and forward. This isolates the middle trapezius and rhomboids that pull the blades back toward the spine, building the strength to hold your shoulders back.' },
    muscles: { ko: '중부 승모근, 능형근, 후면 삼각근', en: 'Middle trapezius, rhomboids, posterior deltoid' },
    caution: { ko: '팔을 들 때 어깨 앞이 찝히거나 팔로 저림이 내려가면 범위를 줄이고, 계속되면 멈추세요.', en: 'If the front of your shoulder pinches or tingling runs down your arm, reduce the range; stop if it continues.' },
    avoid: ['pregnant', 'shoulderSevere'],
    anim: {
      view: 170,
      elev: 22,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      holdKey: 2,
      keys: [
        PRONE_T,
        merge(PRONE_T, both({ sh: { abd: 90, hab: -16, rot: 70 }, scap: { prot: -2.5, elev: -1 } })),
        merge(PRONE_T, both({ sh: { abd: 90, hab: -1, rot: 70 }, scap: { prot: -3.5, elev: -1 } })),
      ],
      labels: [
        { ko: '엎드려 팔을 T자로', en: 'Face down, arms in a T' },
        { ko: '날개뼈 먼저 모으기', en: 'Set the blades first' },
        { ko: '팔 들어 3초 버티기', en: 'Lift & hold 3 s' },
      ],
      durations: [0.6, 1.8, 1.8],
      pauses: [0.4, 0.2, 3],
      focus: [
        { a: 'backTop', b: 'shR', kind: 'work', r: 2.6 },
        { a: 'backTop', b: 'shL', kind: 'work', r: 2.6 },
        { a: 'shR', b: 'elR', side: 'back', kind: 'work', from: 0, to: 0.35, r: 2.2 },
        { a: 'shL', b: 'elL', side: 'back', kind: 'work', from: 0, to: 0.35, r: 2.2 },
      ],
      trace: ['haR'],
    },
  },

  // ───────────────────────── 엎드려 W 당기기
  {
    id: 'prone-w-raise',
    name: { ko: '엎드려 W 당기기', en: 'Prone W pull' },
    phase: 'activate',
    position: 'prone',
    regions: ['upperBack', 'shoulder'],
    targets: { roundShoulder: 0.9, kyphosis: 0.6, upperBackPain: 0.5, fhp: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, holdSec: 3, rest: 20 },
    setup: {
      ko: [
        '매트에 엎드려 이마 밑에 접은 수건을 받치고, 턱을 살짝 당겨 뒷목을 길게 해요.',
        '팔꿈치를 90~100°로 굽혀 옆구리에서 60° 정도 벌리고, 손은 얼굴 옆 귀 높이에 둬요. 위에서 보면 팔이 알파벳 W 모양이에요.',
        '엄지가 천장을 향하게 주먹을 가볍게 쥐고, 다리는 골반 너비로 편하게 펴요.',
      ],
      en: [
        'Lie face down with a folded towel under your forehead and your chin gently tucked to lengthen your neck.',
        'Bend your elbows to 90–100° and open them about 60° from your sides, hands beside your face at ear level — seen from above, your arms make a “W”.',
        'Make loose fists with thumbs pointing to the ceiling; legs relaxed, hip-width apart.',
      ],
    },
    steps: {
      ko: [
        '날개뼈를 바지 뒷주머니 쪽으로 끌어내린다는 느낌으로 아래·안쪽으로 모아요.',
        '그 힘으로 팔꿈치를 옆구리 쪽으로 손바닥 너비만큼(8~10cm) 당기며, 팔꿈치와 손을 2초에 걸쳐 바닥에서 3~5cm 들어요.',
        'W 모양을 유지한 채 3초 버티며 날개뼈 아래쪽이 단단해지는 걸 느껴요.',
        '2초에 걸쳐 천천히 내려놓고 어깨 힘을 한 번 풀어요.',
        '10회 반복해요. 이마는 수건에, 허리는 편평하게 유지해요.',
      ],
      en: [
        'Draw your shoulder blades down and in, as if sliding them toward your back pockets.',
        'Using that pull, draw your elbows a hand-width (8–10 cm) toward your sides and lift elbows and hands 3–5 cm off the floor over 2 seconds.',
        'Keep the “W” and hold 3 seconds, feeling the lower part of your shoulder blades firm up.',
        'Lower slowly over 2 seconds and let your shoulders relax once.',
        'Repeat 10 times with your forehead on the towel and your low back flat.',
      ],
    },
    breathing: { ko: '팔꿈치를 당겨 들어 올리며 내쉬고, 버티는 동안 코로 편하게 숨 쉬고, 내려놓으며 들이마셔요.', en: 'Exhale as you pull your elbows down and lift, breathe easily through your nose during the hold, and inhale as you lower.' },
    feel: { ko: '날개뼈 아래쪽과 등 가운데(허리 바로 위)가 조여지는 느낌이면 정답이에요. 목이나 어깨 위쪽에 힘이 몰리면 너무 높이 든 거예요. 어깨가 찝히거나 손이 저리면 멈추세요.', en: 'A squeeze at the lower edges of your shoulder blades and mid-back (just above the waist). If your neck or the tops of your shoulders take over, you’re lifting too high. Stop if your shoulder pinches or your hands tingle.' },
    easier: { ko: '팔을 들지 말고 바닥에 둔 채 날개뼈만 아래로 모았다 풀어요. 엎드리기 힘들면 ‘벽 천사’로 바꿔요.', en: 'Keep your arms on the floor and just draw your blades down and together, then release. If lying face down is hard, do wall angels instead.' },
    harder: { ko: '버티는 시간을 5초로 늘리고, 익숙해지면 ‘엎드려 T 들기’, ‘엎드려 Y 들기’ 순서로 넘어가요.', en: 'Extend the hold to 5 seconds, then progress to the prone T raise and prone Y raise.' },
    cues: { ko: ['날개뼈를 뒷주머니로', '팔꿈치를 옆구리로', '살짝만 들어요', '목은 길게'], en: ['Blades to back pockets', 'Elbows toward your sides', 'Just a small lift', 'Long neck'] },
    mistakes: {
      ko: [
        '어깨가 으쓱 올라가며 목이 긴장함 → 날개뼈를 먼저 아래로 끌어내린 뒤에 팔을 들어요.',
        '고개를 들어 앞을 봄 → 이마를 수건에 붙이고 시선은 바닥을 향해요.',
        '허리를 젖혀 가슴까지 들림 → 배를 살짝 당기고, 들어 올리는 높이를 3~5cm로 줄여요.',
        '손만 들리고 팔꿈치는 바닥에 남음 → 팔꿈치와 손이 한 덩어리로 같이 뜨게 해요.',
      ],
      en: [
        'Shrugging so the neck tenses → Pull your blades down first, then lift your arms.',
        'Lifting the head to look forward → Keep your forehead on the towel and eyes on the floor.',
        'Arching the back so the chest lifts → Draw your belly in and keep the lift to 3–5 cm.',
        'Only the hands lift, elbows stay down → Lift elbows and hands together as one piece.',
      ],
    },
    why: { ko: '날개뼈를 아래로 끌어내려 어깨를 뒤·아래로 안정시키는 하부 승모근을 가장 편한 자세로 깨워요. Y·T보다 어깨 부담이 적어 등 근육 운동을 처음 시작하기 좋아요.', en: 'Wakes up the lower trapezius, which pulls the blades down to hold your shoulders back and down, in its easiest position. It’s gentler on the shoulder than Y or T raises, so it’s a great first back exercise.' },
    muscles: { ko: '하부·중부 승모근, 능형근, 극하근', en: 'Lower & middle trapezius, rhomboids, infraspinatus' },
    caution: { ko: '어깨 앞쪽이 찝히면 팔꿈치를 옆구리 쪽으로 조금 더 내려 벌림 각도를 줄이세요.', en: 'If the front of your shoulder pinches, bring your elbows a little closer to your sides.' },
    avoid: ['pregnant', 'shoulderSevere'],
    anim: {
      view: 160,
      elev: 42,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [
        PRONE_W,
        merge(PRONE_W, both({ sh: { abd: 52, hab: -22, rot: 88 }, scap: { prot: -2.5, elev: -2 } })),
      ],
      labels: [
        { ko: '엎드려 팔을 W자로', en: 'Face down, arms in a W' },
        { ko: '팔꿈치 당겨 3초 버티기', en: 'Pull elbows down, hold 3 s' },
      ],
      durations: [2, 2],
      pauses: [0.6, 3],
      focus: [
        { a: 'backMid', b: 'shR', kind: 'work', r: 2.6 },
        { a: 'backMid', b: 'shL', kind: 'work', r: 2.6 },
      ],
      trace: ['elR'],
    },
  },

  // ───────────────────────── 옆으로 누워 팔 바깥으로 돌리기
  {
    id: 'sidelying-external-rotation',
    name: { ko: '옆으로 누워 팔 바깥으로 돌리기', en: 'Side-lying external rotation' },
    phase: 'activate',
    position: 'sideLying',
    regions: ['shoulder'],
    targets: { roundShoulder: 0.7, shoulderPain: 0.5, upperBackPain: 0.2 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 5, holdSec: 2, rest: 20, perSide: true },
    setup: {
      ko: [
        '왼쪽으로 옆으로 누워 왼팔이나 베개로 머리를 받쳐 목이 일자가 되게 하고, 무릎은 45° 굽혀 두 다리를 포개요.',
        '작은 수건을 주먹 크기로 말아 오른쪽 팔꿈치와 옆구리 사이에 끼워요.',
        '오른쪽 팔꿈치를 90°로 굽혀 아래팔을 배 앞에 편하게 내려놓고, 엄지는 머리 쪽을 향하게(손바닥은 배를 향하게) 해요.',
      ],
      en: [
        'Lie on your left side with your head supported on your left arm or a pillow so your neck is level; bend your knees 45° and stack your legs.',
        'Roll a small towel to about the size of a fist and tuck it between your right elbow and your side.',
        'Bend your right elbow to 90° and rest the forearm across your belly, thumb pointing toward your head and palm facing your belly.',
      ],
    },
    steps: {
      ko: [
        '오른쪽 날개뼈를 등 쪽으로 살짝(1cm) 모아 어깨를 안정시켜요.',
        '팔꿈치로 수건을 가볍게 누른 채, 문을 열듯 아래팔을 2초에 걸쳐 천장 쪽으로 돌려 올려요.',
        '몸이 뒤로 넘어가기 직전(보통 아래팔이 수평을 지나 45~60° 더 올라간 지점)에서 멈추고 2초 버텨요.',
        '3초에 걸쳐 천천히 배 앞으로 내려놓아요.',
        '12회 반복한 뒤 반대로 누워 왼팔도 똑같이 해요.',
      ],
      en: [
        'Draw your right shoulder blade slightly (1 cm) back to steady the shoulder.',
        'Keeping the elbow pressed lightly into the towel, rotate your forearm up toward the ceiling over 2 seconds, like opening a door.',
        'Stop just before your body wants to roll back (usually 45–60° past level) and hold for 2 seconds.',
        'Lower it slowly back to your belly over 3 seconds.',
        'Do 12 reps, then turn over and repeat with the left arm.',
      ],
    },
    breathing: { ko: '아래팔을 돌려 올리며 내쉬고, 천천히 내리며 들이마셔요.', en: 'Exhale as you rotate up, inhale as you slowly lower.' },
    feel: { ko: '어깨 뒤쪽, 겨드랑이 뒤와 날개뼈 위가 뻐근하게 힘이 들어가면 정답이에요. 어깨 앞이 찝히거나, 딸깍거리며 아프거나, 손이 저리면 범위를 줄이거나 멈추세요.', en: 'A working burn at the back of the shoulder — behind the armpit and over the shoulder blade. If the front of the shoulder pinches, clicks painfully or your hand tingles, shorten the range or stop.' },
    easier: { ko: '아래팔이 바닥과 평행해지는 높이까지만 돌리고, 버티기는 빼도 괜찮아요. 누운 자세가 불편하면 서서 하는 ‘날개뼈 모으며 팔 벌리기’로 바꿔요.', en: 'Rotate only until your forearm is level with the floor and skip the hold. If lying on your side is uncomfortable, do the standing scapular squeeze instead.' },
    harder: { ko: '0.5~1kg 아령이나 물병을 쥐고 하거나, 15회까지 늘려요. 그다음은 ‘밴드로 팔 바깥으로 돌리기’예요.', en: 'Hold a 0.5–1 kg dumbbell or water bottle, or build up to 15 reps. Next step: the band external rotation.' },
    cues: { ko: ['팔꿈치는 수건 위에', '문 열듯 천천히', '몸은 그대로', '3초 동안 내려요'], en: ['Elbow stays on the towel', 'Open like a door', 'Keep your body still', 'Three seconds down'] },
    mistakes: {
      ko: [
        '팔꿈치가 수건에서 떨어져 위로 들림 → 팔꿈치를 경첩처럼 고정하고 아래팔만 돌려요.',
        '손을 더 높이 올리려고 몸을 뒤로 젖힘 → 어깨와 골반을 위아래로 포갠 채, 몸이 넘어가려 하면 거기서 멈춰요.',
        '손목만 꺾어 손을 들어 올림 → 손목은 아래팔과 일직선으로 두고 아래팔 전체를 돌려요.',
        '툭 떨어뜨리듯 빠르게 내림 → 내려올 때 3초를 세며 버텨요.',
      ],
      en: [
        'Elbow lifting off the towel → Keep the elbow fixed like a hinge and rotate only the forearm.',
        'Rolling back to get the hand higher → Keep shoulders and hips stacked and stop where your body wants to roll.',
        'Bending the wrist to lift the hand → Keep the wrist in line with the forearm and turn the whole forearm.',
        'Dropping the arm quickly → Count 3 seconds on the way down.',
      ],
    },
    why: { ko: '말린 어깨에서는 팔을 바깥으로 돌려 주는 회전근개(극하근·소원근)가 약해져 팔이 안으로 말리기 쉬워요. 옆으로 누우면 팔 무게가 알맞은 저항이 되어 도구 없이도 이 근육을 정확히 깨울 수 있어요.', en: 'With rounded shoulders the rotator cuff muscles that turn the arm outward (infraspinatus, teres minor) weaken and the arm rolls inward. Lying on your side, the arm’s own weight gives just the right resistance to target them without equipment.' },
    muscles: { ko: '극하근·소원근, 후면 삼각근', en: 'Infraspinatus, teres minor, posterior deltoid' },
    caution: { ko: '어깨 수술을 받았거나 어깨가 빠진 적이 있다면 전문가와 범위를 먼저 확인하세요. 아래쪽 어깨가 눌려 아프면 베개를 더 높여요.', en: 'If you’ve had shoulder surgery or a dislocation, check your range with a professional first. If the bottom shoulder feels squashed, use a higher pillow.' },
    avoid: ['shoulderSevere'],
    anim: {
      view: -42,
      elev: 38,
      zoom: 1.1,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [SL_ER, merge(SL_ER, { shR: { flex: 0, abd: 16, rot: 55 }, scapR: { prot: -1.5 } })],
      labels: [
        { ko: '팔꿈치 90°, 손은 배 앞', en: 'Elbow 90°, hand on belly' },
        { ko: '천장 쪽으로 돌려 2초', en: 'Rotate up, hold 2 s' },
      ],
      durations: [2, 3],
      pauses: [0.4, 2],
      focus: [
        { a: 'backTop', b: 'shR', kind: 'work', r: 2.6 },
        { a: 'shR', b: 'elR', side: 'back', kind: 'work', from: 0, to: 0.35, r: 2.2 },
      ],
      trace: ['haR'],
    },
  },

  // ───────────────────────── 옆으로 누워 어깨 뒤 늘리기(슬리퍼 스트레칭)
  {
    id: 'sleeper-stretch',
    name: { ko: '옆으로 누워 어깨 뒤 늘리기(슬리퍼 스트레칭)', en: 'Sleeper stretch' },
    phase: 'stretch',
    position: 'sideLying',
    regions: ['shoulder'],
    targets: { roundShoulder: 0.5, stiffness: 0.6, shoulderPain: 0.4 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 15 },
    setup: {
      ko: [
        '늘리려는 쪽(오른쪽)을 바닥에 대고 옆으로 누워요. 베개로 머리를 받쳐 목이 일자가 되게 하고, 무릎은 45° 굽혀요.',
        '오른팔을 어깨 높이에서 몸 앞으로 곧게 내밀어 몸통과 90°가 되게 하고, 팔꿈치를 90°로 굽혀 아래팔이 천장을 향하게 세워요.',
        '오른쪽 날개뼈가 몸무게에 눌려 바닥에 고정된 느낌이 들게 몸을 아주 살짝 뒤로 기대요.',
      ],
      en: [
        'Lie on the side you want to stretch (right side down). Support your head with a pillow so your neck is level and bend your knees 45°.',
        'Reach your right arm straight out in front at shoulder height, 90° to your body, then bend the elbow to 90° so the forearm points to the ceiling.',
        'Lean back just slightly so your body weight pins your right shoulder blade to the floor.',
      ],
    },
    steps: {
      ko: [
        '왼손으로 오른쪽 손목 바로 위를 가볍게 잡아요.',
        '숨을 내쉬며 오른쪽 아래팔을 3초에 걸쳐 배 앞 바닥 쪽으로 천천히 눌러 내려요.',
        '어깨 뒤쪽이 은근히 당기는 지점(보통 20~40° 내려간 곳)에서 멈춰요. 손이 바닥에 닿을 필요는 없어요.',
        '팔꿈치는 어깨 높이·90° 그대로 두고 30초 버티며 천천히 숨 쉬어요.',
        '천천히 아래팔을 다시 세우고, 2세트 한 뒤 반대로 누워 왼쪽도 해요.',
      ],
      en: [
        'Gently hold your right forearm just above the wrist with your left hand.',
        'As you exhale, slowly press your right forearm down toward the floor in front of your belly over 3 seconds.',
        'Stop where you feel a mild pull at the back of the shoulder (usually 20–40° down). Your hand doesn’t need to touch the floor.',
        'Keep the elbow at shoulder height and bent 90°, and hold for 30 seconds while breathing slowly.',
        'Slowly bring the forearm back upright. Do 2 sets, then lie on the other side for the left shoulder.',
      ],
    },
    breathing: { ko: '누를 때 입으로 길게 내쉬고, 버티는 동안 4초 들이마시고 6초 내쉬어요. 내쉴 때마다 팔이 1~2mm씩 스르르 내려가게 둬요.', en: 'Exhale slowly as you press down, then breathe in for 4 and out for 6 while holding. Let the arm sink a millimetre or two with each exhale.' },
    feel: { ko: '아래쪽 어깨의 뒤쪽 깊은 곳이 은은하게 늘어나면 정답이에요(강도 10 중 3~4). 어깨 앞이나 위가 찝히거나, 날카롭게 아프거나, 손이 저리면 바로 힘을 빼세요.', en: 'A gentle, deep stretch at the back of the bottom shoulder (about 3–4 out of 10). If the front or top of the shoulder pinches, the pain is sharp or your hand tingles, ease off right away.' },
    easier: { ko: '몸통을 뒤로 20~30° 더 기대어 누우면 어깨 앞 찝힘이 줄어요. 누워서 하기 어렵다면 서서 하는 ‘팔 가로질러 당기기’로 바꿔요.', en: 'Roll your trunk back another 20–30° — this eases pinching at the front of the shoulder. If lying on the shoulder is hard, do the standing cross-body stretch instead.' },
    harder: { ko: '더 세게 누르지 말고, 버티는 시간을 45초로 늘리거나 3세트로 해요.', en: 'Don’t press harder — lengthen the hold to 45 seconds or do 3 sets instead.' },
    cues: { ko: ['팔꿈치는 어깨 높이', '살살 바닥 쪽으로', '어깨 앞은 편안하게', '길게 내쉬어요'], en: ['Elbow at shoulder height', 'Ease it toward the floor', 'Front of shoulder relaxed', 'Long exhales'] },
    mistakes: {
      ko: [
        '힘으로 꾹 눌러 버림 → 강도 10 중 3~4의 가벼운 당김이면 충분해요. 손끝 힘만 써요.',
        '몸이 배 쪽으로 굴러 어깨가 앞으로 빠짐 → 몸통을 살짝 뒤로 기대 날개뼈가 몸무게에 눌린 상태를 유지해요.',
        '팔꿈치가 머리 쪽이나 허리 쪽으로 미끄러짐 → 팔꿈치를 어깨 높이, 90°에 고정해요.',
        '어깨 앞 찝힘을 참고 버팀 → 바로 힘을 빼고 몸을 더 뒤로 기대거나 범위를 줄여요.',
      ],
      en: [
        'Forcing the arm down → A light 3–4/10 pull is enough; use just your fingertips.',
        'Rolling toward your belly so the shoulder slides forward → Lean back slightly so your body weight keeps the blade pinned.',
        'Elbow sliding toward your head or waist → Keep the elbow fixed at shoulder height and bent 90°.',
        'Pushing through a pinch at the front → Ease off at once, roll back further or shorten the range.',
      ],
    },
    why: { ko: '어깨 뒤쪽(관절주머니·회전근개)이 뻣뻣해지면 팔을 안으로 돌리는 범위가 줄고, 위팔뼈 머리가 앞으로 밀려 어깨가 더 말려 보이거나 팔을 들 때 찝히기 쉬워요. 뒤쪽을 부드럽게 늘려 어깨가 제자리에서 움직이도록 도와요.', en: 'When the back of the shoulder (capsule and rotator cuff) stiffens, inward rotation is lost and the ball of the joint gets pushed forward — the shoulder looks more rounded and pinches when you lift your arm. Gently lengthening the back helps the joint move where it should.' },
    muscles: { ko: '어깨 뒤쪽 관절주머니, 극하근·소원근, 후면 삼각근', en: 'Posterior shoulder capsule, infraspinatus, teres minor, posterior deltoid' },
    caution: { ko: '어깨 앞쪽이 찝히면 절대 참지 말고 멈추세요. 어깨가 빠진 적이 있거나 수술을 받았다면 전문가와 먼저 상의하세요.', en: 'Never push through pinching at the front of the shoulder — stop. If you’ve had a dislocation or shoulder surgery, check with a professional first.' },
    avoid: ['shoulderSevere'],
    anim: {
      view: 35,
      elev: 18,
      zoom: 1.15,
      props: [{ kind: 'mat' }, { kind: 'step', at: 'head', key: 0, size: [14, 0, 16] }],
      anchor: ['pelvis'],
      keys: [
        merge(SLEEPER, { shL: { flex: 0, abd: 4 }, elL: 12 }),
        merge(SLEEPER, { shL: { flex: 40, abd: 0, hab: -30 }, elL: 110 }),
        merge(SLEEPER, { shR: { rot: -35 }, shL: { flex: 20, abd: 30, hab: -40 }, elL: 105 }),
      ],
      labels: [
        { ko: '팔꿈치 90°, 아래팔 세우기', en: 'Elbow 90°, forearm up' },
        { ko: '다른 손으로 손목 잡기', en: 'Hold the wrist' },
        { ko: '바닥 쪽으로 눌러 30초', en: 'Ease down, hold 30 s' },
      ],
      durations: [1.2, 3, 1.8],
      pauses: [0.6, 0.4, 2.8],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'elR', side: 'back', kind: 'stretch', from: 0, to: 0.35, r: 2.2 },
        { a: 'backTop', b: 'shR', kind: 'stretch', from: 0.3, to: 1, r: 2 },
      ],
      trace: ['haR'],
    },
  },

  // ───────────────────────── 팔 가로질러 당기기
  {
    id: 'cross-body-stretch',
    name: { ko: '팔 가로질러 당기기', en: 'Cross-body shoulder stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['shoulder', 'upperBack'],
    targets: { stiffness: 0.6, roundShoulder: 0.4, shoulderPain: 0.3, upperBackPain: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '발을 골반 너비로 벌리고 무릎을 살짝 풀어 서요(의자에 바르게 앉아도 돼요).',
        '어깨를 한 번 으쓱했다가 툭 떨어뜨리고, 가슴과 골반은 정면을 향해요.',
        '오른팔을 팔꿈치를 편 채 어깨 높이로 앞으로 들어요. 엄지는 위를 향해요.',
      ],
      en: [
        'Stand with feet hip-width apart and knees soft (or sit tall on a chair).',
        'Shrug once and let your shoulders drop; chest and hips face straight ahead.',
        'Lift your right arm straight in front of you to shoulder height, thumb up.',
      ],
    },
    steps: {
      ko: [
        '오른팔을 어깨 높이 그대로 가슴 앞을 가로질러 왼쪽으로 옮겨요.',
        '왼쪽 아래팔을 오른쪽 팔꿈치 바로 위(위팔)에 걸어요. 팔꿈치 관절 자체를 누르지 않아요.',
        '숨을 내쉬며 3초에 걸쳐 오른팔을 가슴 쪽으로 지그시 당겨요.',
        '오른쪽 어깨는 귀에서 멀리 내리고, 몸통이 왼쪽으로 따라 돌지 않게 가슴은 정면을 유지해요.',
        '30초 버티고 천천히 풀어요. 2세트 한 뒤 왼팔도 해요.',
      ],
      en: [
        'Keeping it at shoulder height, carry your right arm across your chest to the left.',
        'Hook your left forearm just above your right elbow (on the upper arm) — not on the elbow joint itself.',
        'As you exhale, gently draw your right arm toward your chest over 3 seconds.',
        'Keep your right shoulder down away from your ear and your chest facing forward — don’t let your trunk twist left.',
        'Hold 30 seconds, release slowly. Do 2 sets, then switch arms.',
      ],
    },
    breathing: { ko: '당길 때 길게 내쉬고, 버티는 동안 천천히 숨 쉬며 내쉴 때마다 팔을 1cm씩 더 가슴 쪽으로 가져와요.', en: 'Exhale long as you pull in; while holding, breathe slowly and bring the arm about 1 cm closer with each exhale.' },
    feel: { ko: '오른쪽 어깨 뒤쪽과 날개뼈 바깥쪽이 늘어나면 정답이에요. 어깨 위(쇄골 끝)나 앞이 찝히거나 손이 저리면 팔 높이를 낮추거나 멈추세요.', en: 'A stretch at the back of your right shoulder and the outer edge of the shoulder blade. If the top of the shoulder (end of the collarbone) or the front pinches, or your hand tingles, lower the arm or stop.' },
    easier: { ko: '팔을 어깨보다 조금 낮게 두고 팔꿈치를 살짝 굽혀서, 당기는 힘을 줄여요. 앉아서 해도 좋아요.', en: 'Keep the arm a little below shoulder height with the elbow slightly bent, and pull more gently. Doing it seated is fine.' },
    harder: { ko: '당기기 전에 오른쪽 날개뼈를 등 쪽으로 살짝 고정하면 어깨 뒤쪽이 더 정확히 늘어나요. 버티기를 45초로 늘리거나 ‘옆으로 누워 어깨 뒤 늘리기’로 넘어가요.', en: 'Set your right shoulder blade slightly back before pulling to target the back of the shoulder more precisely. Lengthen the hold to 45 seconds or progress to the sleeper stretch.' },
    cues: { ko: ['팔은 어깨 높이', '어깨는 귀에서 멀리', '가슴은 정면으로', '내쉬며 조금 더'], en: ['Arm at shoulder height', 'Shoulder away from ear', 'Chest faces forward', 'Exhale, a bit closer'] },
    mistakes: {
      ko: [
        '당기는 쪽 어깨가 귀로 올라감 → 어깨를 먼저 툭 내린 뒤에 당겨요.',
        '팔을 따라 몸통이 왼쪽으로 돌아감 → 골반과 가슴을 정면에 고정하고 팔만 가로질러요.',
        '팔꿈치 관절이나 아래팔을 잡고 당김 → 팔꿈치 바로 위 위팔에 걸어 당겨요.',
        '어깨 위가 찝히는데도 계속함 → 팔을 가슴 높이로 낮추고 당기는 힘을 줄여요.',
      ],
      en: [
        'Shoulder hiking toward the ear → Drop the shoulder first, then pull.',
        'Trunk twisting left with the arm → Keep hips and chest facing forward; only the arm crosses.',
        'Pulling on the elbow joint or forearm → Hook just above the elbow, on the upper arm.',
        'Continuing through a pinch on top of the shoulder → Lower the arm to chest height and pull more gently.',
      ],
    },
    why: { ko: '하루 종일 어깨가 앞으로 말려 있으면 어깨 뒤쪽이 뻣뻣해져 위팔뼈 머리를 앞으로 밀어요. 도구 없이 책상 앞에서 어깨 뒤쪽을 풀어 팔이 편하게 움직이게 해요.', en: 'Rounded shoulders all day stiffen the back of the shoulder, which pushes the ball of the joint forward. This loosens it right at your desk with no equipment, so your arm moves freely.' },
    muscles: { ko: '후면 삼각근, 극하근·소원근, 어깨 뒤쪽 관절주머니', en: 'Posterior deltoid, infraspinatus, teres minor, posterior shoulder capsule' },
    caution: { ko: '어깨 위쪽(쇄골 끝)이 찝히듯 아프면 무리하지 말고 멈추세요.', en: 'If the top of the shoulder (end of the collarbone) hurts with a pinching feeling, stop — don’t force it.' },
    avoid: ['shoulderSevere'],
    anim: {
      view: 28,
      elev: 14,
      zoom: 1.1,
      keys: [
        STAND,
        merge(STAND, { shR: { flex: 90, hab: -30 }, elR: 4, shL: { flex: 60, abd: 40, hab: -50 }, elL: 85 }),
        merge(STAND, { shR: { flex: 90, hab: -52 }, elR: 4, scapR: { prot: 0, elev: -0.5 }, shL: { flex: 50, abd: 10, hab: -50 }, elL: 110 }),
      ],
      labels: [
        { ko: '바르게 서기', en: 'Stand tall' },
        { ko: '가로질러 팔꿈치 위 걸기', en: 'Cross & hook above elbow' },
        { ko: '가슴 쪽으로 당겨 30초', en: 'Draw in, hold 30 s' },
      ],
      durations: [1.4, 2.5, 1.6],
      pauses: [0.5, 0.4, 2.8],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'elR', side: 'back', kind: 'stretch', from: 0, to: 0.45, r: 2.4 },
        { a: 'backTop', b: 'shR', kind: 'stretch', r: 2.4 },
      ],
      trace: ['haR'],
    },
  },

  // ───────────────────────── 벽에 팔 대고 밀어 올리기
  {
    id: 'wall-slide-serratus',
    name: { ko: '벽에 팔 대고 밀어 올리기', en: 'Serratus wall slide' },
    phase: 'activate',
    position: 'wall',
    regions: ['shoulder', 'upperBack'],
    targets: { roundShoulder: 0.7, kyphosis: 0.5, shoulderPain: 0.4, upperBackPain: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 5, holdSec: 2, rest: 20 },
    desk: true,
    setup: {
      ko: [
        '벽을 마주 보고 서서 발끝을 벽에서 15~20cm(주먹 두 개) 떨어뜨리고, 발은 골반 너비로 벌려요.',
        '팔꿈치를 90°로 굽혀 두 아래팔의 새끼손가락 쪽 옆면을 어깨너비로 벽에 대요. 팔꿈치는 가슴 높이, 손바닥은 서로 마주 봐요.',
        '턱을 살짝 당기고, 갈비뼈가 들리지 않게 배에 가볍게 힘을 줘요.',
      ],
      en: [
        'Face the wall with your toes 15–20 cm (two fists) away, feet hip-width apart.',
        'Bend your elbows to 90° and place the pinky-side edges of both forearms on the wall, shoulder-width apart, elbows at chest height and palms facing each other.',
        'Tuck your chin slightly and lightly brace your belly so your ribs don’t flare.',
      ],
    },
    steps: {
      ko: [
        '아래팔로 벽을 힘의 20~30%로 지그시 밀어, 날개뼈가 갈비뼈를 감싸며 양옆으로 살짝 벌어지게 해요.',
        '그 미는 힘을 유지한 채 2~3초에 걸쳐 아래팔을 벽을 따라 위로 미끄러뜨려요. 팔은 점점 벌어져 Y 모양이 돼요.',
        '어깨가 으쓱하거나 허리가 꺾이기 직전(보통 팔꿈치가 이마 높이)까지 올라가 2초 버텨요.',
        '미는 힘은 그대로 두고 2~3초에 걸쳐 처음 자리로 천천히 내려와요.',
        '10회 반복해요.',
      ],
      en: [
        'Press your forearms gently into the wall at 20–30% effort so your shoulder blades wrap around your ribs and spread slightly apart.',
        'Keeping that press, slide your forearms up the wall over 2–3 seconds; your arms gradually widen into a “Y”.',
        'Go up until just before your shoulders shrug or your low back arches (usually elbows at forehead height) and hold 2 seconds.',
        'Keep pressing and slide slowly back down to the start over 2–3 seconds.',
        'Repeat 10 times.',
      ],
    },
    breathing: { ko: '팔을 밀어 올리며 내쉬고, 천천히 내려오며 들이마셔요.', en: 'Exhale as you slide up, inhale as you slowly come down.' },
    feel: { ko: '겨드랑이 아래 옆구리 갈비뼈 쪽과 날개뼈 아래쪽에 힘이 들어가면 정답이에요. 목이나 어깨 위가 먼저 뻐근하면 너무 높이 올라간 거예요. 어깨가 찝히면 범위를 줄이세요.', en: 'Work along the side of your ribs below the armpits and at the lower shoulder blades. If your neck or the tops of your shoulders tire first, you went too high. If the shoulder pinches, shorten the range.' },
    easier: { ko: '팔꿈치가 눈높이에 올 때까지만 올리고, 벽을 미는 힘을 줄여요. ‘벽 푸시업 플러스’로 날개뼈 벌리는 감각을 먼저 익혀도 좋아요.', en: 'Slide only until your elbows reach eye level and press more lightly. You can also learn the blade-spreading feel first with the wall push-up plus.' },
    harder: { ko: '아래팔과 벽 사이에 폼롤러를 대고 굴리며 올리거나, 손목에 고리 밴드를 걸고 양옆으로 벌린 채 해요. 맨 위에서 아래팔을 벽에서 1cm 떼어 2초 버티기를 더해도 좋아요.', en: 'Roll a foam roller up the wall under your forearms, or loop a mini band around your wrists and keep it stretched. You can also add a 1 cm lift-off from the wall at the top for 2 seconds.' },
    cues: { ko: ['팔로 벽을 살짝 밀어요', '어깨는 귀에서 멀리', '갈비뼈는 아래로', '천천히 내려와요'], en: ['Press into the wall', 'Shoulders away from ears', 'Ribs stay down', 'Slowly back down'] },
    mistakes: {
      ko: [
        '팔을 올리며 어깨가 으쓱 올라감 → 어깨가 올라가기 시작하는 곳에서 멈추고, 어깨를 귀에서 멀리 둬요.',
        '허리가 꺾이고 갈비뼈가 앞으로 들림 → 배에 가볍게 힘을 주고 꼬리뼈를 살짝 말아 넣어요.',
        '벽을 밀지 않고 팔만 미끄러뜨림 → 올라갈 때도 내려올 때도 20~30% 힘으로 계속 밀어요.',
        '고개가 벽 쪽으로 쭉 나감 → 턱을 살짝 당기고 시선은 정면 벽에 둬요.',
      ],
      en: [
        'Shrugging as the arms rise → Stop where your shoulders start to lift and keep them away from your ears.',
        'Low back arching and ribs flaring → Lightly brace your belly and tuck your tailbone slightly.',
        'Just sliding without pressing → Keep a 20–30% press into the wall both up and down.',
        'Head poking toward the wall → Tuck your chin slightly and look straight ahead at the wall.',
      ],
    },
    why: { ko: '팔을 들 때 날개뼈를 위로 돌려 주는 전거근이 약하면 날개뼈가 앞으로 기울어 어깨가 말리고 팔을 들 때 찝히기 쉬워요. 벽을 밀며 올리면 전거근과 하부 승모근이 함께 일해 날개뼈가 바르게 움직이는 법을 익혀요.', en: 'When the serratus anterior — which rotates the blade upward as you raise your arm — is weak, the blade tips forward, the shoulders round and lifting can pinch. Pressing into the wall as you slide makes the serratus and lower trapezius work together so the blade learns to move well.' },
    muscles: { ko: '전거근, 하부 승모근', en: 'Serratus anterior, lower trapezius' },
    caution: { ko: '팔을 머리 위로 올릴 때 어깨가 찝히거나 아프면 통증 없는 높이까지만 하세요.', en: 'If raising your arms overhead pinches or hurts, stay below that height.' },
    avoid: ['shoulderSevere'],
    anim: {
      view: 135,
      elev: 10,
      props: [{ kind: 'wall', wall: 'front', dist: 0 }],
      anchor: ['wrL', 'wrR', 'heelL', 'heelR'],
      holdKey: 2,
      keys: [
        merge(FACE_WALL, lean(2), both({ sh: { flex: 76, abd: 8 }, el: 106, wr: -10, scap: { prot: 1 } })),
        merge(FACE_WALL, lean(0.5), both({ sh: { flex: 76, abd: 8 }, el: 106, wr: -10, scap: { prot: 3 } })),
        merge(FACE_WALL, lean(6.5), both({ sh: { flex: 150, abd: -15 }, el: 40, wr: -10, scap: { prot: 3, elev: 1.5 } })),
      ],
      labels: [
        { ko: '아래팔을 벽에 대기', en: 'Forearms on the wall' },
        { ko: '벽을 살짝 밀기', en: 'Press into the wall' },
        { ko: 'Y로 밀어 올려 2초', en: 'Slide up to a Y, 2 s' },
      ],
      durations: [0.8, 2.5, 2.5],
      pauses: [0.5, 0.4, 2],
      focus: [
        { a: 'shR', b: 'hipR', kind: 'work', from: 0.12, to: 0.5, r: 2.6 },
        { a: 'backMid', b: 'shR', kind: 'work', r: 2.4 },
      ],
      trace: ['elR'],
    },
  },

  // ───────────────────────── 벽 푸시업 플러스
  {
    id: 'wall-pushup-plus',
    name: { ko: '벽 푸시업 플러스', en: 'Wall push-up plus' },
    phase: 'activate',
    position: 'wall',
    regions: ['shoulder', 'chest', 'upperBack'],
    targets: { roundShoulder: 0.6, kyphosis: 0.4, shoulderPain: 0.3, upperBackPain: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 5, holdSec: 2, rest: 20 },
    desk: true,
    setup: {
      ko: [
        '벽을 마주 보고 팔을 쭉 뻗으면 손바닥이 벽에 닿는 거리(발끝이 벽에서 약 60cm)에 서요. 발은 골반 너비로 벌려요.',
        '손바닥을 어깨보다 조금 낮은 높이(가슴 윗부분)에 어깨너비보다 조금 넓게 대고, 손가락은 위를 향해요.',
        '발뒤꿈치부터 머리까지 몸을 일직선으로 기울이고, 배와 엉덩이에 가볍게 힘을 줘요.',
      ],
      en: [
        'Face the wall and stand where your palms just touch it with straight arms (toes about 60 cm from the wall), feet hip-width apart.',
        'Place your palms on the wall just below shoulder height (upper-chest level), a little wider than your shoulders, fingers pointing up.',
        'Lean in with your body in one straight line from heels to head, and lightly brace your belly and glutes.',
      ],
    },
    steps: {
      ko: [
        '팔꿈치를 몸통에서 약 45° 벌린 채 굽혀, 2초에 걸쳐 가슴을 벽 쪽으로 가져가요. 날개뼈는 자연스럽게 모여요.',
        '코가 벽에서 주먹 하나(약 10cm) 떨어진 곳에서 멈춰요.',
        '벽을 밀어내며 2초에 걸쳐 팔꿈치를 다 펴요.',
        '‘플러스’: 팔꿈치를 편 채 벽을 한 번 더 밀어 등 윗부분이 살짝 둥글어지고 날개뼈가 양옆으로 2~3cm 벌어지게 하고 2초 버텨요.',
        '가슴이 처지지 않게 날개뼈를 제자리로 풀고, 10회 반복해요.',
      ],
      en: [
        'Bend your elbows, keeping them about 45° from your body, and bring your chest toward the wall over 2 seconds; your blades naturally draw together.',
        'Stop when your nose is about a fist (10 cm) from the wall.',
        'Push the wall away and straighten your elbows fully over 2 seconds.',
        '“Plus”: with elbows straight, push once more so your upper back rounds slightly and your blades spread 2–3 cm apart; hold 2 seconds.',
        'Let the blades settle back without your chest sagging, and repeat 10 times.',
      ],
    },
    breathing: { ko: '벽 쪽으로 내려가며 들이마시고, 밀어내며 ‘플러스’까지 길게 내쉬어요.', en: 'Inhale as you lower toward the wall; exhale all the way through the push and the “plus”.' },
    feel: { ko: '푸시업 때는 가슴과 팔 뒤쪽, ‘플러스’ 때는 겨드랑이 아래 옆구리 갈비뼈 쪽에 힘이 들어가면 정답이에요. 손목이나 어깨가 아프면 멈추세요.', en: 'Chest and backs of the arms work during the push-up; during the “plus” you should feel the side of your ribs just below the armpits. Stop if your wrists or shoulders hurt.' },
    easier: { ko: '벽에 더 가까이 서서 덜 기울이거나, 팔을 편 채 ‘플러스’ 동작만 10회 해요. 손목이 불편하면 주먹을 쥐어 벽을 짚어요.', en: 'Stand closer to the wall so you lean less, or do only the “plus” with straight arms for 10 reps. If your wrists complain, make fists against the wall.' },
    harder: { ko: '발을 벽에서 더 멀리 두거나, 튼튼한 책상·싱크대 모서리를 짚고 해요. 그다음은 바닥에서 무릎 대고 하는 푸시업 플러스예요.', en: 'Step your feet farther from the wall, or use a sturdy desk or kitchen counter. The next step is a knee push-up plus on the floor.' },
    cues: { ko: ['몸은 일직선', '팔꿈치는 45도', '끝에서 한 번 더 밀어요', '등을 살짝 둥글게'], en: ['Body in one line', 'Elbows at 45°', 'Push once more at the end', 'Round your upper back'] },
    mistakes: {
      ko: [
        '엉덩이가 뒤로 빠지거나 허리가 처짐 → 배와 엉덩이에 가볍게 힘을 줘 머리부터 발뒤꿈치까지 일직선을 유지해요.',
        '‘플러스’를 빼먹고 푸시업만 함 → 팔을 다 편 뒤 2~3cm 더 밀어 날개뼈를 벌려요.',
        '‘플러스’ 때 어깨를 으쓱함 → 위가 아니라 벽 쪽 앞으로 밀고, 어깨는 귀에서 멀리 둬요.',
        '팔꿈치를 옆으로 90° 활짝 벌림 → 몸통에서 45° 정도만 벌려 어깨 앞 부담을 줄여요.',
      ],
      en: [
        'Hips sticking out or sagging → Lightly brace belly and glutes to keep one line from head to heels.',
        'Skipping the “plus” → After your arms are straight, push 2–3 cm more to spread your blades.',
        'Shrugging during the “plus” → Push forward into the wall, not up; keep your shoulders away from your ears.',
        'Elbows flared out to 90° → Keep them about 45° from your body to spare the front of the shoulder.',
      ],
    },
    why: { ko: '날개뼈를 갈비뼈에 붙여 안정시키는 전거근은 ‘플러스’ 동작에서 가장 잘 깨어나요. 말린 어깨와 날개뼈가 들뜨는(익상견갑) 경향이 있을 때 어깨를 받쳐 주는 기초 힘을 길러요.', en: 'The serratus anterior, which holds the shoulder blade flat against the ribs, switches on best in the “plus”. It builds the foundation that supports rounded shoulders and blades that tend to lift off the ribs (winging).' },
    muscles: { ko: '전거근, 대흉근, 상완삼두근', en: 'Serratus anterior, pectoralis major, triceps' },
    caution: { ko: '손목에 체중이 실려 아프면 주먹을 쥐거나 벽에 더 가까이 서세요. 어깨가 찝히면 멈추세요.', en: 'If weight on your wrists hurts, use fists or stand closer to the wall. Stop if the shoulder pinches.' },
    avoid: ['wristPain', 'shoulderSevere'],
    anim: {
      view: 90,
      elev: 8,
      props: [{ kind: 'wall', wall: 'front', dist: 0 }],
      anchor: ['wrL', 'wrR', 'heelL', 'heelR'],
      holdKey: 3,
      keys: [
        WALL_PUSH_TOP,
        WALL_PUSH_LOW,
        WALL_PUSH_TOP,
        merge(FACE_WALL, lean(13), both({ sh: { flex: 104, hab: 12 }, el: 0, wr: 88, scap: { prot: 3 } }), { thorax: { flex: 5 } }),
      ],
      labels: [
        { ko: '팔 펴고 벽 짚기', en: 'Hands on the wall' },
        { ko: '가슴을 벽 쪽으로', en: 'Chest toward the wall' },
        { ko: '밀어서 팔 펴기', en: 'Push arms straight' },
        { ko: '한 번 더 밀기 2초', en: 'Push “plus”, hold 2 s' },
      ],
      durations: [2, 2, 0.8, 0.8],
      pauses: [0.3, 0.3, 0.1, 2],
      focus: [
        { a: 'shR', b: 'hipR', kind: 'work', from: 0.12, to: 0.5, r: 2.6 },
        { a: 'chest', b: 'shR', side: 'front', kind: 'work', r: 2.2 },
      ],
      trace: ['shR'],
    },
  },

  // ───────────────────────── 밴드로 팔 바깥으로 돌리기
  {
    id: 'band-external-rotation',
    name: { ko: '밴드로 팔 바깥으로 돌리기', en: 'Band external rotation' },
    phase: 'activate',
    position: 'standing',
    regions: ['shoulder'],
    targets: { roundShoulder: 0.8, shoulderPain: 0.4, kyphosis: 0.3, upperBackPain: 0.3 },
    equipment: ['band'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 5, holdSec: 2, rest: 20, perSide: true },
    setup: {
      ko: [
        '가벼운 밴드를 문고리나 튼튼한 기둥에 팔꿈치 높이로 묶어요. 문고리에 묶었다면 문을 꼭 닫아(가능하면 잠가) 당길 때 문이 열리지 않게 해요.',
        '문을 왼쪽 옆에 두고 서서, 밴드가 살짝 팽팽해지도록 한 걸음 떨어져요. 발은 골반 너비, 무릎은 살짝 풀어요.',
        '오른손으로 밴드를 잡고, 오른쪽 팔꿈치를 90°로 굽혀 옆구리에 붙여요. 팔꿈치와 옆구리 사이에 작게 만 수건을 끼우면 좋아요.',
        '아래팔은 배 앞(문 쪽)에서 시작하고, 손목은 곧게 펴요.',
      ],
      en: [
        'Tie a light band to a door handle or sturdy post at elbow height. If you use a door handle, close the door firmly (lock it if you can) so it can’t swing open as you pull.',
        'Stand with the door on your left, one step away so the band has light tension. Feet hip-width apart, knees soft.',
        'Hold the band in your right hand, bend the right elbow to 90° and tuck it against your side — a small rolled towel between elbow and ribs helps.',
        'Start with the forearm across your belly (toward the door) and keep the wrist straight.',
      ],
    },
    steps: {
      ko: [
        '오른쪽 날개뼈를 뒤·아래로 1cm 살짝 모아 어깨를 안정시켜요.',
        '팔꿈치를 옆구리에 붙인 채, 문을 열듯 아래팔을 2초에 걸쳐 바깥(오른쪽)으로 돌려요.',
        '아래팔이 정면에서 바깥으로 45~60° 돌아간 곳, 또는 팔꿈치가 떨어지기 직전에 멈추고 2초 버텨요.',
        '밴드에 끌려가지 않게 3초에 걸쳐 천천히 배 앞으로 돌아와요.',
        '12회 반복한 뒤 돌아서서 왼팔도 똑같이 해요.',
      ],
      en: [
        'Draw your right shoulder blade 1 cm back and down to steady the shoulder.',
        'Keeping your elbow at your side, rotate your forearm outward (to the right) over 2 seconds, like opening a gate.',
        'Stop when the forearm has turned 45–60° out from straight ahead, or just before the elbow leaves your side, and hold 2 seconds.',
        'Return slowly to your belly over 3 seconds without letting the band pull you.',
        'Do 12 reps, then turn around and repeat with the left arm.',
      ],
    },
    breathing: { ko: '바깥으로 돌리며 내쉬고, 천천히 돌아오며 들이마셔요.', en: 'Exhale as you rotate out, inhale as you slowly return.' },
    feel: { ko: '어깨 뒤쪽(겨드랑이 뒤)과 날개뼈 위쪽에 힘이 들어가면 정답이에요. 어깨 앞이 찝히거나 딸깍거리며 아프면 밴드를 약하게 하거나 범위를 줄이세요.', en: 'Work at the back of the shoulder (behind the armpit) and over the shoulder blade. If the front of the shoulder pinches or clicks painfully, use a lighter band or a smaller range.' },
    easier: { ko: '문에 한 걸음 더 가까이 서서 밴드를 느슨하게 하거나, 도구 없이 ‘옆으로 누워 팔 바깥으로 돌리기’부터 해요. 두 손으로 밴드를 함께 잡고 양팔을 동시에 벌려도 돼요.', en: 'Step closer to the door to slacken the band, or start with the side-lying external rotation. You can also hold the band in both hands and rotate both arms out together.' },
    harder: { ko: '문에서 더 멀리 서거나 한 단계 강한 밴드를 써요. 3세트, 15회까지 늘려요.', en: 'Stand farther from the door or use the next band strength. Build up to 3 sets of 15.' },
    cues: { ko: ['팔꿈치는 옆구리에', '문 열듯 바깥으로', '몸통은 정면으로', '3초 동안 돌아와요'], en: ['Elbow at your side', 'Open like a gate', 'Trunk faces forward', 'Three seconds back'] },
    mistakes: {
      ko: [
        '팔꿈치가 옆구리에서 떨어져 옆으로 벌어짐 → 수건을 끼워 떨어뜨리지 않게 해요.',
        '몸통을 오른쪽으로 비틀어 밴드를 당김 → 골반과 가슴을 정면에 고정하고 아래팔만 돌려요.',
        '손목을 꺾어 당김 → 손목을 아래팔과 일직선으로 곧게 유지해요.',
        '밴드에 끌려 휙 돌아옴 → 돌아올 때 3초를 세며 버텨요.',
      ],
      en: [
        'Elbow drifting away from your side → Keep the towel squeezed so it doesn’t drop.',
        'Twisting your trunk to the right to pull → Keep hips and chest facing forward; only the forearm turns.',
        'Bending the wrist to pull → Keep your wrist straight, in line with the forearm.',
        'Letting the band snap you back → Count 3 seconds on the return.',
      ],
    },
    why: { ko: '말린 어깨에서는 팔을 안으로 돌리는 가슴 근육이 강하고, 바깥으로 돌리는 회전근개는 약해지기 쉬워요. 밴드 저항으로 극하근·소원근을 강화해 어깨 관절의 앞뒤 균형을 맞추는 데 도움이 돼요.', en: 'With rounded shoulders, the chest muscles that turn the arm inward are strong while the cuff muscles that turn it outward get weak. Band resistance strengthens the infraspinatus and teres minor to help rebalance the front and back of the joint.' },
    muscles: { ko: '극하근·소원근, 후면 삼각근', en: 'Infraspinatus, teres minor, posterior deltoid' },
    caution: { ko: '밴드가 풀리거나 끊어지면 얼굴·팔 쪽으로 튕길 수 있어요. 시작 전에 매듭이 단단한지, 밴드에 찢어진 곳이 없는지 확인하세요. 어깨가 아프면 밴드를 바꾸기 전에 범위부터 줄이세요.', en: 'A band that slips or snaps can whip back toward your face or arm — check the knot and look for nicks or tears before you start. If the shoulder hurts, shorten the range before switching bands.' },
    avoid: ['shoulderSevere'],
    anim: {
      view: 45,
      elev: 30,
      props: [{ kind: 'band', at: 'haR', off: [42, 0, 4], key: 0 }],
      holdKey: 2,
      keys: [
        ER_STAND,
        merge(ER_STAND, { scapR: { prot: -1.5, elev: -0.5 } }),
        merge(ER_STAND, { shR: { abd: 12, rot: 55 }, scapR: { prot: -2.5, elev: -0.5 } }),
      ],
      labels: [
        { ko: '밴드 잡고 팔꿈치 90°', en: 'Hold band, elbow 90°' },
        { ko: '날개뼈 살짝 모으기', en: 'Set the shoulder blade' },
        { ko: '바깥으로 돌려 2초', en: 'Rotate out, hold 2 s' },
      ],
      durations: [0.6, 2, 3],
      pauses: [0.4, 0.2, 2],
      focus: [
        { a: 'backTop', b: 'shR', kind: 'work', r: 2.6 },
        { a: 'shR', b: 'elR', side: 'back', kind: 'work', from: 0, to: 0.35, r: 2.2 },
      ],
      trace: ['haR'],
    },
  },
];
