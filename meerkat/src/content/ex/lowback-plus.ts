/**
 * 운동 라이브러리 · 허리 (추가 동작)
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { HOOK, PRONE, QUAD, SIT, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서 쓰는 자세 ─────────────────────

/** 엎드려 상체 들기: 손바닥은 가슴 옆 같은 자리에 두고, 허리·등을 젖히는 정도와 팔 굽힘만 바뀜 */
const PRESS = (lum: number, th: number, sh: { flex: number; abd: number }, el: number, wr: number, neck: number): Pose =>
  merge(PRONE, { lumbar: { flex: lum }, thorax: { flex: th }, neck: { flex: neck } }, both({ sh, el, wr }));

/** 무릎 세우고 누워 두 팔을 T자로 */
const HOOK_T: Pose = merge(HOOK, both({ sh: { abd: 80 }, el: 5, hip: { flex: 55, abd: -2 }, kn: 105 }));
/** 무릎을 오른쪽(+1)/왼쪽(−1)으로 내림: 골반만 굴리고 가슴은 바닥에 그대로 */
const KNEE_DROP = (s: 1 | -1): Pose => merge(HOOK_T, { root: { pitch: -90, roll: -50 * s }, lumbar: { twist: 14 * s }, thorax: { twist: 36 * s } });

/** 서서 두 손바닥을 골반 뒤(엉덩이 바로 위)에 */
const HANDS_ON_BACK: Pose = both({ sh: { flex: -49, abd: 52, rot: -81 }, el: 112, wr: -25 });

/** 의자에 발을 넓게 벌려 앉기 */
const SIT_WIDE: Pose = merge(SIT, both({ hip: { flex: 88, abd: 0, hab: 25 }, kn: 88 }));

export const LOWBACK_PLUS: Exercise[] = [
  {
    id: 'prone-press-up',
    name: { ko: '엎드려 상체 들기', en: 'Prone press-up' },
    phase: 'mobility',
    position: 'prone',
    regions: ['lowBack'],
    targets: { lowBackPain: 0.7, flatBack: 0.6, stiffness: 0.5, kyphosis: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 3, holdSec: 2, rest: 15 },
    setup: {
      ko: [
        '매트에 엎드려 이마를 바닥(또는 접은 수건)에 대고, 두 다리는 골반 너비로 펴서 발등을 바닥에 둬요.',
        '두 손바닥을 어깨 바로 옆, 가슴 윗부분 높이의 바닥에 짚어요. 손끝은 머리 쪽, 팔꿈치는 굽혀 옆구리 가까이 둬요.',
        '엉덩이와 허리에 힘을 완전히 빼고, 골반 앞쪽 뼈가 바닥에 닿아 있는 걸 느껴요.',
      ],
      en: [
        'Lie face down on a mat with your forehead on the floor (or a folded towel), legs straight and hip-width apart, tops of the feet down.',
        'Place your palms on the floor right beside your shoulders, level with your upper chest, fingers pointing forward and elbows bent close to your sides.',
        'Let your buttocks and low back go completely soft, and feel the front of your hip bones resting on the floor.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 손바닥으로 바닥을 밀어, 3초에 걸쳐 머리 → 가슴 순서로 상체를 들어 올려요.',
        '골반 앞쪽은 바닥에 붙인 채 허리는 힘을 빼고 아래로 늘어뜨려요. 미는 건 팔만, 엉덩이는 말랑하게 둬요.',
        '편안한 높이에서 2초 머물러요. 처음 2~3회는 팔꿈치를 반쯤만 펴고, 괜찮으면 매 회 조금씩 더 펴요.',
        '3초에 걸쳐 천천히 내려와 이마를 바닥에 대고 숨을 한 번 쉬어요.',
        '10회 반복해요.',
      ],
      en: [
        'Breathe out and press through your palms to lift your upper body over 3 seconds — head first, then chest.',
        'Keep the front of your pelvis on the floor and let your low back relax and sag. Only your arms push; your buttocks stay soft.',
        'Pause for 2 seconds at a comfortable height. For the first 2–3 reps straighten your elbows only halfway, then a little more each rep if it feels fine.',
        'Lower slowly over 3 seconds, rest your forehead on the floor and take one breath.',
        'Repeat 10 times.',
      ],
    },
    breathing: {
      ko: '밀어 올리며 입으로 길게 내쉬고, 위에서 머무는 2초 동안 허리를 더 늘어뜨리듯 “후—” 한 번 더 내쉬어요. 내려오면서 코로 들이마셔요.',
      en: 'Exhale long through your mouth as you press up, and at the top let out one more “haa” as your low back sags a little further. Breathe in through your nose as you lower.',
    },
    feel: {
      ko: '허리 가운데가 뻐근하게 눌리다가 몇 번 반복하면 편해지고, 배 앞쪽이 부드럽게 늘어나면 정답이에요. 엉덩이나 다리 쪽에 통증·저림이 새로 생기거나 더 아래로 내려가면 바로 멈춰요.',
      en: 'Pressure in the middle of your low back that eases after a few reps, plus a gentle stretch across your belly, is right. Stop at once if pain or tingling appears in your buttock or leg, or spreads further down.',
    },
    easier: {
      ko: '팔을 펴지 말고 팔꿈치와 아래팔을 바닥에 댄 채 상체만 세우는 ‘팔꿈치 받치고 엎드리기’(스핑크스 자세)로 1~2분 머물러요. 그것도 불편하면 그냥 엎드려 2~3분 쉬어요.',
      en: 'Instead of straightening your arms, prop yourself on your forearms (sphinx position) and rest there for 1–2 minutes. If that’s still uncomfortable, just lie face down for 2–3 minutes.',
    },
    harder: {
      ko: '팔꿈치를 끝까지 펴고 위에서 3~5초 머물러요. 오래 앉아 있었던 날엔 ‘서서 허리 뒤로 젖히기’를 1~2시간마다 곁들여요.',
      en: 'Straighten your elbows fully and pause for 3–5 seconds at the top. On long sitting days, add the standing back extension every 1–2 hours.',
    },
    cues: { ko: ['골반은 바닥에', '팔로만 밀어요', '허리 힘 빼요', '천천히 내려요'], en: ['Hips stay down', 'Arms do the work', 'Let your back relax', 'Lower slowly'] },
    mistakes: {
      ko: [
        '골반이 바닥에서 뜸 → 올라가는 높이를 줄여, 골반 앞쪽이 바닥에 닿아 있는 만큼만 밀어요.',
        '엉덩이에 힘을 꽉 줌 → 엉덩이를 말랑하게 두고 팔로만 밀어야 허리가 부드럽게 젖혀져요.',
        '고개를 뒤로 확 젖힘 → 시선은 1m 앞 바닥에 두고, 목은 등과 한 줄로 길게 둬요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 어깨를 귀에서 멀리 끌어내리고 가슴을 앞으로 내밀어요.',
      ],
      en: [
        'Pelvis lifting off the floor → Press up less — only as far as the front of your pelvis stays down.',
        'Squeezing your buttocks → Keep them soft and push with your arms so the low back can arch gently.',
        'Throwing your head back → Look at the floor about 1 m ahead and keep your neck in line with your back.',
        'Shoulders hunching toward your ears → Draw your shoulders away from your ears and let your chest come forward.',
      ],
    },
    why: {
      ko: '오래 앉아 허리를 굽힌 채 지내면 허리를 뒤로 젖히는 움직임이 뻣뻣해져요. 힘을 뺀 채 반복해서 젖혀 주면 허리 움직임이 부드러워지고, 앉은 뒤 뻐근하던 허리가 한결 편해지는 사람이 많아요.',
      en: 'Hours of sitting keep your low back bent and stiffen its ability to extend. Arching it repeatedly while relaxed restores that motion, and many people find the stiffness after sitting eases noticeably.',
    },
    muscles: { ko: '허리 신전 가동성(요추), 복직근·고관절 굴곡근(늘어남), 삼두근(밀기)', en: 'Lumbar extension mobility; rectus abdominis and hip flexors (stretch); triceps (push)' },
    caution: {
      ko: '엉덩이나 다리로 통증·저림이 번지거나 심해지면 바로 멈추세요. 다리 증상이 허리 가운데 쪽으로 모이며 줄어드는 건 괜찮은 신호예요. 허리 수술을 받았거나 척추관 협착증이 있다면 먼저 담당 의료진과 상의하세요.',
      en: 'Stop at once if pain or tingling spreads into your buttock or leg, or gets worse. Leg symptoms that shrink back toward the middle of your back are an OK sign. If you’ve had back surgery or have spinal stenosis, check with your care team first.',
    },
    avoid: ['pregnant', 'lowBackSevere', 'wristPain'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [
        PRESS(0, 0, { flex: -12, abd: 42 }, 140, 48, 6),
        PRESS(-30, -18, { flex: 12, abd: 17 }, 75, 42, 14),
        PRESS(-46, -26, { flex: 30, abd: 11 }, 12, 62, 18),
      ],
      labels: [
        { ko: '엎드려 손은 어깨 옆', en: 'Face down, hands by shoulders' },
        { ko: '팔로 밀어 올리기', en: 'Press up with your arms' },
        { ko: '골반 붙이고 2초', en: 'Hips down, hold 2 s' },
      ],
      durations: [1.6, 1.4, 3],
      pauses: [0.6, 0.1, 2],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'stretch' },
        { a: 'shR', b: 'elR', side: 'back', kind: 'work', r: 2.2 },
      ],
      trace: ['chest'],
    },
  },
  {
    id: 'knee-to-chest',
    name: { ko: '무릎 가슴으로 당기기', en: 'Single knee-to-chest stretch' },
    phase: 'stretch',
    position: 'supine',
    regions: ['lowBack', 'glute', 'hip'],
    targets: { lowBackPain: 0.7, stiffness: 0.6, lordosis: 0.5, hipPain: 0.3, stress: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    setup: {
      ko: [
        '매트에 바로 누워 두 무릎을 세우고, 발은 골반 너비로 바닥에 평평하게 둬요. 발뒤꿈치는 엉덩이에서 약 30cm 앞이에요.',
        '뒤통수를 매트에 대고 턱을 살짝 당겨 뒷목을 길게 해요. 턱이 천장 쪽으로 들리면 접은 수건을 머리 밑에 받쳐요.',
        '어깨와 팔에 힘을 빼고, 허리 밑의 작은 틈은 자연스럽게 둔 채 시작해요.',
      ],
      en: [
        'Lie on your back with both knees bent, feet flat and hip-width apart, heels about 30 cm from your buttocks.',
        'Rest the back of your head on the mat and tuck your chin slightly so your neck is long. If your chin points up, slide a folded towel under your head.',
        'Relax your shoulders and arms and start with the natural small gap under your low back.',
      ],
    },
    steps: {
      ko: [
        '오른무릎을 천천히 들어 올려, 두 손으로 무릎 바로 아래 허벅지 뒤쪽을 깍지 껴 잡아요.',
        '숨을 내쉬며 3초에 걸쳐 무릎을 가슴 쪽으로 부드럽게 당겨요. 팔꿈치를 옆으로 벌리며 당기면 어깨가 편해요.',
        '허리 아래와 오른쪽 엉덩이가 은은하게 늘어나는 곳에서 멈춰 30초 버텨요. 꼬리뼈가 매트에서 살짝 떠도 괜찮아요.',
        '그동안 왼발은 바닥에 그대로, 머리와 어깨는 매트에 무겁게 내려놓아요.',
        '천천히 손을 풀어 발을 바닥에 내려놓고, 왼쪽도 똑같이 해요.',
      ],
      en: [
        'Slowly lift your right knee and interlace your hands behind the thigh just below the knee.',
        'Breathe out and gently draw the knee toward your chest over 3 seconds; letting your elbows open to the sides keeps your shoulders relaxed.',
        'Stop where you feel a gentle stretch in your low back and right buttock and hold for 30 seconds. It’s fine if your tailbone lifts slightly off the mat.',
        'Meanwhile keep your left foot on the floor and let your head and shoulders rest heavy on the mat.',
        'Slowly let go, lower the foot to the floor and repeat on the left.',
      ],
    },
    breathing: {
      ko: '당기며 내쉬고, 버티는 동안엔 배가 허벅지를 부드럽게 밀어내듯 코로 천천히 들이마셔요. 내쉴 때마다 무릎을 1~2cm씩 더 가슴 쪽으로 가져와요.',
      en: 'Exhale as you draw the knee in. While holding, breathe slowly through your nose so your belly swells gently against your thigh, and bring the knee 1–2 cm closer on each exhale.',
    },
    feel: {
      ko: '허리 아래쪽과 오른쪽 엉덩이가 부드럽게 늘어나면 정답이에요. 사타구니 앞이 끼이는 느낌이 들면 무릎을 오른쪽 어깨 방향으로 살짝 비껴 당기고, 다리로 저림이 내려가거나 허리가 찌르듯 아프면 멈춰요.',
      en: 'A gentle stretch across your low back and right buttock is right. If the front of your hip feels pinched, aim the knee slightly toward your right shoulder; stop if tingling runs down the leg or your back hurts sharply.',
    },
    easier: {
      ko: '허벅지 뒤에 수건을 걸어 양 끝을 잡고 당기면 팔과 어깨가 편해요. 무릎을 가슴까지 붙이지 않아도, 허리가 편해지는 만큼만 들어도 충분해요.',
      en: 'Loop a towel behind your thigh and pull on the ends to spare your arms and shoulders. You don’t need to bring the knee all the way in — lift it only as far as feels easy on your back.',
    },
    harder: {
      ko: '두 무릎을 함께 가슴으로 당겨 허리 뒤를 더 넓게 늘리거나, 버티는 시간을 45초로 늘려요.',
      en: 'Draw both knees in together to stretch more of the low back, or build the hold to 45 seconds.',
    },
    cues: { ko: ['무릎 뒤를 잡아요', '내쉬며 당겨요', '머리는 매트에', '허리 힘 빼요'], en: ['Hold behind the knee', 'Exhale and draw in', 'Head stays down', 'Let your back soften'] },
    mistakes: {
      ko: [
        '정강이를 세게 끌어안아 무릎이 아픔 → 무릎 바로 아래 허벅지 뒤를 잡고, 무릎은 편하게 굽힌 채 둬요.',
        '머리와 어깨가 들림 → 뒤통수를 매트에 대요. 손이 닿지 않으면 수건을 이용해요.',
        '반대쪽 다리가 들썩임 → 왼발바닥으로 바닥을 가볍게 눌러 골반을 안정시켜요.',
        '반동을 주며 당김 → 3초에 걸쳐 천천히 당기고 그 자리에서 가만히 버텨요.',
      ],
      en: [
        'Hugging the shin hard so the knee aches → Hold behind the thigh just below the knee and let the knee stay comfortably bent.',
        'Head and shoulders lifting → Keep the back of your head on the mat; use a towel if your hands don’t reach.',
        'The other leg shifting around → Press your left sole lightly into the floor to steady your pelvis.',
        'Bouncing the knee in → Draw it in slowly over 3 seconds, then hold still.',
      ],
    },
    why: {
      ko: '허리가 젖혀진 자세로 오래 서 있거나 지내면 허리 뒤쪽 근육과 엉덩이가 뻣뻣해져요. 무릎을 당겨 골반을 뒤로 살짝 말아 주면 허리 뒤가 부드럽게 늘어나, 아침이나 오래 서 있은 뒤의 허리 뻐근함이 줄어들어요.',
      en: 'Standing or living with an arched low back stiffens the back muscles and glutes. Drawing the knee in gently rolls the pelvis back and lengthens the back of the spine, easing stiffness in the morning or after long standing.',
    },
    muscles: { ko: '척추기립근·다열근(허리 부분), 대둔근', en: 'Lumbar erector spinae and multifidus, gluteus maximus' },
    caution: {
      ko: '다리로 저림이 내려가거나 허리 통증이 심해지면 멈추세요. 고관절 인공관절 수술을 받았다면 무릎을 90° 넘게 당기기 전에 담당 의료진과 상의하세요.',
      en: 'Stop if tingling runs down your leg or your back pain increases. If you’ve had a hip replacement, check with your care team before pulling the knee past 90°.',
    },
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [
        HOOK,
        merge(HOOK, { hipR: { flex: 100, abd: 6 }, knR: 100, anR: 5, shR: { flex: 19, abd: -26, hab: 38 }, elR: 10, wrR: -40, shL: { flex: 34, abd: 3, hab: -43 }, elL: 10, wrL: 6 }),
        merge(HOOK, {
          root: { pitch: -97 },
          lumbar: { flex: 7 },
          hipL: { flex: 48 },
          hipR: { flex: 118, abd: 8 },
          knR: 112,
          anR: 5,
          shR: { flex: 21, abd: -8 },
          elR: 53,
          wrR: -40,
          shL: { flex: 27, abd: -34, hab: 3 },
          elL: 29,
          wrL: -40,
        }),
      ],
      labels: [
        { ko: '무릎 세우고 눕기', en: 'Lie with knees bent' },
        { ko: '오른무릎 뒤 잡기', en: 'Hold behind the right knee' },
        { ko: '가슴으로 당겨 30초', en: 'Draw in, hold 30 s' },
      ],
      durations: [1.4, 2.4, 1.8],
      pauses: [0.5, 0.3, 3],
      holdKey: 2,
      focus: [
        { a: 'backMid', b: 'pelvis', side: 'back', kind: 'stretch' },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'stretch', r: 4 },
      ],
      trace: ['knR'],
    },
  },
  {
    id: 'supine-lumbar-rotation',
    name: { ko: '누워서 허리 비틀기', en: 'Supine lower-trunk rotation' },
    phase: 'mobility',
    position: 'supine',
    regions: ['lowBack', 'core', 'hip'],
    targets: { stiffness: 0.7, lowBackPain: 0.6, stress: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, holdSec: 2, rest: 10 },
    setup: {
      ko: [
        '매트에 바로 누워 무릎을 세우고, 두 무릎과 발을 붙여 발바닥을 바닥에 평평하게 둬요. 발뒤꿈치는 엉덩이에서 약 30cm 앞이에요.',
        '두 팔을 어깨높이로 옆으로 벌려 T자를 만들고, 손바닥은 바닥을 향해요.',
        '뒤통수를 매트에 대고 천장을 봐요. 두 어깨 뒤쪽이 매트에 닿아 있는지 확인해요.',
      ],
      en: [
        'Lie on your back with knees bent, knees and feet together and soles flat, heels about 30 cm from your buttocks.',
        'Stretch your arms out to the sides at shoulder height in a “T”, palms down.',
        'Rest the back of your head on the mat and look at the ceiling. Check that the backs of both shoulders touch the mat.',
      ],
    },
    steps: {
      ko: [
        '두 무릎을 붙인 채, 숨을 내쉬며 3초에 걸쳐 무릎을 오른쪽 바닥 쪽으로 천천히 내려요.',
        '왼쪽 어깨가 매트에서 뜨려 하기 직전에 멈춰요. 무릎이 바닥에 닿지 않아도 괜찮아요(보통 30~60° 정도).',
        '그 자리에서 2초 머물며 허리와 왼쪽 옆구리가 늘어나는 걸 느껴요.',
        '숨을 들이마시며 배에 살짝 힘을 주고, 2초에 걸쳐 무릎을 가운데로 되돌려요.',
        '이번엔 왼쪽으로 똑같이 내려요. 좌우 번갈아 10회(한쪽 5회씩) 해요.',
      ],
      en: [
        'Keeping your knees together, breathe out and slowly lower them toward the floor on your right over 3 seconds.',
        'Stop just before your left shoulder wants to lift off the mat. The knees don’t need to touch the floor — 30–60° is usually plenty.',
        'Pause there for 2 seconds and feel the stretch through your low back and left side.',
        'Breathe in, lightly tighten your belly and bring the knees back to the middle over 2 seconds.',
        'Now lower them to the left the same way. Alternate for 10 reps (5 each side).',
      ],
    },
    breathing: {
      ko: '무릎을 내릴 때 입으로 내쉬고, 가운데로 돌아올 때 코로 들이마셔요. 끝에서 머무는 2초 동안은 편하게 숨 쉬어요.',
      en: 'Breathe out as the knees lower, breathe in through your nose as they come back to the middle, and breathe easily during the 2-second pause.',
    },
    feel: {
      ko: '무릎을 내린 반대쪽 허리·옆구리와 엉덩이 바깥이 부드럽게 늘어나면 정답이에요. 허리가 찌르듯 아프거나 다리로 저림이 내려가면 범위를 줄이거나 멈춰요.',
      en: 'A soft stretch through the low back, side and outer hip opposite your knees is right. If your back hurts sharply or tingling runs down a leg, use a smaller range or stop.',
    },
    easier: {
      ko: '무릎을 좌우로 10~20cm만 흔들듯 작게 움직여요. 발을 골반 너비로 벌리고 하면 허리보다 고관절이 더 많이 움직여 부담이 줄어요.',
      en: 'Make it a small rock, moving the knees just 10–20 cm side to side. Setting your feet hip-width apart shifts more of the motion to the hips and eases the load on your back.',
    },
    harder: {
      ko: '끝에서 5초씩 머물거나, 무릎과 반대쪽으로 고개를 천천히 돌려 등 윗부분까지 늘려요. 익숙해지면 무릎과 고관절을 90°로 든 채 해 보세요(배 힘이 더 필요해요).',
      en: 'Pause for 5 seconds at each end, or slowly turn your head away from your knees to include the upper back. Later, try it with hips and knees lifted to 90° — it needs more core control.',
    },
    cues: { ko: ['무릎은 붙여요', '어깨는 바닥에', '내쉬며 내려요', '배로 되돌려요'], en: ['Knees together', 'Shoulders stay down', 'Exhale as they lower', 'Use your belly to return'] },
    mistakes: {
      ko: [
        '반대쪽 어깨가 들림 → 어깨가 뜨기 직전까지만 내려요. 팔을 바닥에 무겁게 내려놓으면 도움이 돼요.',
        '무릎이 벌어짐 → 두 무릎 사이에 쿠션을 끼웠다고 생각하고 붙인 채 움직여요.',
        '무릎을 툭 떨어뜨림 → 3초에 걸쳐 내리고, 돌아올 땐 배 힘으로 다리를 끌어와요.',
        '다리 무게에 매달려 오래 버팀 → 편한 범위에서 2초만 머물고 가운데로 돌아와요.',
      ],
      en: [
        'Opposite shoulder lifting → Lower only until just before the shoulder wants to lift; letting your arms rest heavy helps.',
        'Knees drifting apart → Imagine a cushion between them and keep them together.',
        'Letting the knees drop → Lower over 3 seconds and use your belly to bring the legs back.',
        'Hanging at the end under the legs’ weight → Pause just 2 seconds within a comfortable range, then return to the middle.',
      ],
    },
    why: {
      ko: '골반을 좌우로 부드럽게 비틀어 굳은 허리 주변 근육과 관절을 풀어 줘요. 누워서 하니 허리에 체중이 실리지 않아, 아침에 뻣뻣하거나 오래 앉아 있던 날에도 부담 없이 할 수 있어요.',
      en: 'Gently twisting the pelvis side to side loosens the stiff muscles and joints around your low back. Lying down means your spine carries no body weight, so it’s an easy option on stiff mornings or after a long day of sitting.',
    },
    muscles: { ko: '복사근, 요방형근, 척추기립근(허리 부분), 중둔근', en: 'Obliques, quadratus lumborum, lumbar erector spinae, gluteus medius' },
    caution: {
      ko: '허리 통증이 심한 날에는 무릎을 10~20cm만 움직이고, 날카로운 통증이나 다리 저림이 생기면 멈추세요.',
      en: 'On bad back days move the knees only 10–20 cm, and stop if you feel sharp pain or leg tingling.',
    },
    anim: {
      view: 35,
      elev: 40,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [HOOK_T, KNEE_DROP(1), KNEE_DROP(-1)],
      labels: [
        { ko: '무릎 세우고 팔은 T자', en: 'Knees bent, arms in a T' },
        { ko: '무릎을 오른쪽으로', en: 'Knees to the right' },
        { ko: '반대쪽 왼쪽으로', en: 'Now to the left' },
      ],
      durations: [3, 4.5, 2],
      pauses: [0.4, 2, 2],
      holdKey: 1,
      focus: [
        { a: 'shL', b: 'hipL', from: 0.4, to: 0.95, kind: 'stretch', r: 2.6 },
        { a: 'shR', b: 'hipR', from: 0.4, to: 0.95, kind: 'stretch', r: 2.6 },
      ],
      trace: ['knR'],
    },
  },
  {
    id: 'quadruped-rock-back',
    name: { ko: '네발에서 뒤로 앉기', en: 'Quadruped rock back' },
    phase: 'mobility',
    position: 'quadruped',
    regions: ['lowBack', 'hip', 'core'],
    targets: { lowBackPain: 0.6, stiffness: 0.5, hipPain: 0.4 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, holdSec: 2, rest: 15 },
    setup: {
      ko: [
        '매트에 네발로 엎드려 손목은 어깨 바로 아래, 무릎은 골반 바로 아래에 둬요. 손가락은 넓게 펴 앞을 향해요.',
        '무릎과 발은 골반 너비로 벌리고, 발등은 바닥에 편하게 내려놓아요.',
        '머리부터 꼬리뼈까지 일직선이 되게 등을 평평하게 하고(등 위에 컵을 올린 느낌), 시선은 두 손 사이 바닥을 봐요.',
        '배꼽을 등 쪽으로 살짝 당겨 배에 힘을 10~20%만 줘요.',
      ],
      en: [
        'Get on all fours on a mat, wrists right under your shoulders and knees right under your hips, fingers spread and pointing forward.',
        'Knees and feet hip-width apart, tops of the feet resting on the floor.',
        'Make your back flat in one line from head to tailbone — as if balancing a cup on it — and look at the floor between your hands.',
        'Draw your belly button gently toward your spine, using just 10–20% effort.',
      ],
    },
    steps: {
      ko: [
        '손은 그 자리에 둔 채, 숨을 내쉬며 3초에 걸쳐 엉덩이를 발뒤꿈치 쪽으로 뒤로 보내요.',
        '등은 평평하게, 허리의 자연스러운 곡선을 그대로 지켜요. 꼬리뼈가 말려 들어가며 허리가 둥글어지기 직전에 멈춰요.',
        '그 자리에서 2초 머물러요. 엉덩이 뒤쪽이 늘어나는 게 느껴져요.',
        '숨을 들이마시며 2초에 걸쳐 처음 네발 자세로 돌아와요. 어깨가 다시 손목 위에 와요.',
        '10회 반복해요. 옆에서 찍은 휴대폰 영상이나 거울로 등이 평평한지 확인하면 좋아요.',
      ],
      en: [
        'Keeping your hands in place, breathe out and send your hips back toward your heels over 3 seconds.',
        'Keep your back flat and hold its natural low-back curve. Stop just before your tailbone tucks under and your low back starts to round.',
        'Pause there for 2 seconds — you’ll feel the back of your hips stretch.',
        'Breathe in and return to all fours over 2 seconds, shoulders back over your wrists.',
        'Repeat 10 times. A mirror or a side-on phone video helps you check that your back stays flat.',
      ],
    },
    breathing: {
      ko: '엉덩이를 뒤로 보내며 입으로 내쉬고, 앞으로 돌아오며 코로 들이마셔요. 배의 가벼운 힘은 숨 쉬는 동안에도 계속 유지해요.',
      en: 'Breathe out as your hips move back and breathe in through your nose as you come forward, keeping the light belly tension the whole time.',
    },
    feel: {
      ko: '엉덩이 뒤쪽과 허벅지 뒤 위쪽이 부드럽게 늘어나고, 배는 가볍게 일하는 느낌이면 정답이에요. 허리가 둥글어지며 당기거나 무릎·손목이 아프면 범위를 줄여요.',
      en: 'A gentle stretch at the back of your hips and top of the hamstrings, with your belly lightly working, is right. If your low back rounds and pulls, or your knees or wrists hurt, shorten the range.',
    },
    easier: {
      ko: '무릎 밑에 접은 담요를 깔고, 손목이 불편하면 주먹을 쥐어 짚거나 아래팔을 바닥에 대고 해요. 절반만 뒤로 가도 충분해요.',
      en: 'Kneel on a folded blanket, and if your wrists complain, make fists or rest on your forearms. Going only halfway back is plenty.',
    },
    harder: {
      ko: '등 위에 막대(빗자루 등)를 올려 뒤통수·등 가운데·꼬리뼈 세 곳이 닿은 채 움직여요. 익숙해지면 ‘버드독’으로 넘어가 코어 조절을 키워요.',
      en: 'Lay a stick (such as a broom handle) along your back so it touches the back of your head, mid-back and tailbone, and keep all three contacts as you move. Then progress to bird dogs for more core control.',
    },
    cues: { ko: ['엉덩이를 뒤로', '등은 평평하게', '말리기 전에 멈춰요', '손은 제자리'], en: ['Hips back', 'Back stays flat', 'Stop before it rounds', 'Hands stay put'] },
    mistakes: {
      ko: [
        '허리가 둥글게 말림 → 범위를 줄여, 꼬리뼈가 말리기 전 지점에서 멈춰요.',
        '고개를 들어 앞을 봄 → 시선은 두 손 사이 바닥, 뒷목은 등과 일직선으로 둬요.',
        '허리가 아래로 푹 꺼짐 → 배꼽을 살짝 당겨 등을 평평하게 유지해요.',
        '손이 같이 뒤로 끌려옴 → 손바닥으로 바닥을 가볍게 누른 채 엉덩이만 움직여요.',
      ],
      en: [
        'Rounding the low back → Shorten the range and stop before your tailbone tucks.',
        'Lifting your head to look ahead → Look at the floor between your hands with your neck in line with your back.',
        'Low back sagging → Draw your belly button in slightly to keep the back flat.',
        'Hands sliding back → Press your palms lightly into the floor and move only your hips.',
      ],
    },
    why: {
      ko: '허리는 가만히 두고 고관절만 굽히는 연습이에요. 앉거나 물건을 들 때 허리 대신 엉덩이를 접는 습관이 생기면 허리 부담이 줄고, 굳은 고관절도 부드러워져요.',
      en: 'Trains you to bend at the hips while your low back stays still. Once folding at the hips instead of the spine becomes a habit when you sit or lift, your low back takes less strain and stiff hips loosen up.',
    },
    muscles: { ko: '대둔근·고관절 뒤쪽(늘어남), 복횡근·다열근(허리 안정)', en: 'Gluteus maximus and back of the hip (stretch); transversus abdominis and multifidus (spinal control)' },
    caution: {
      ko: '무릎을 꿇거나 손목에 체중을 싣기 힘들면 서서 하는 ‘엉덩이 접기(힙 힌지)’로 대신하세요.',
      en: 'If kneeling or leaning on your wrists is uncomfortable, do the standing hip hinge instead.',
    },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['knL', 'knR'],
      keys: [
        QUAD,
        merge(QUAD, { root: { pitch: 79 } }, both({ hip: { flex: 105 }, sh: { flex: 99 }, kn: 116, wr: 66 })),
        merge(QUAD, { root: { pitch: 76 } }, both({ hip: { flex: 124 }, sh: { flex: 111 }, kn: 138, wr: 50 })),
      ],
      labels: [
        { ko: '네발, 등은 평평하게', en: 'All fours, flat back' },
        { ko: '엉덩이를 뒤로', en: 'Send your hips back' },
        { ko: '말리기 전 멈춰 2초', en: 'Stop before it rounds, 2 s' },
      ],
      durations: [1.6, 1.4, 2],
      pauses: [0.5, 0.1, 2],
      holdKey: 2,
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'stretch', r: 4 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.4 },
      ],
      trace: ['pelvis'],
    },
    coach: {
      view: 'side',
      metric: 'hipAngle',
      mode: 'reps',
      rest: 95,
      peak: 72,
      dir: -1,
      hint: { ko: '옆에서 온몸이 보이게 휴대폰을 바닥 높이에 두세요', en: 'Place the phone at floor level beside you so your whole body is visible' },
      more: { ko: '엉덩이를 조금 더 뒤로', en: 'Hips back a little more' },
      good: { ko: '좋아요, 등은 평평하게', en: 'Good — keep your back flat' },
    },
  },
  {
    id: 'standing-back-extension',
    name: { ko: '서서 허리 뒤로 젖히기', en: 'Standing back extension' },
    phase: 'mobility',
    position: 'standing',
    regions: ['lowBack'],
    targets: { lowBackPain: 0.6, stiffness: 0.6, flatBack: 0.5, kyphosis: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 3, holdSec: 2, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '발을 골반 너비로 벌리고 무릎을 살짝 풀어 바르게 서요. 체중은 두 발에 고르게 실어요.',
        '두 손바닥을 골반 뒤쪽, 엉덩이 바로 위에 대고 손가락은 아래를 향하게 해요. 팔꿈치는 뒤로 모아요.',
        '턱을 살짝 당기고 정면을 봐요. 균형이 걱정되면 바로 잡을 수 있는 책상이나 싱크대 앞에 서요.',
      ],
      en: [
        'Stand tall with feet hip-width apart and knees soft, weight even on both feet.',
        'Place your palms on the back of your pelvis just above your buttocks, fingers pointing down, elbows drawn back.',
        'Tuck your chin slightly and look ahead. If balance is a concern, stand in front of a desk or counter you can grab.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 손바닥으로 골반을 앞으로 살짝 밀어, 골반이 발보다 5cm 정도 앞으로 나가게 해요.',
        '동시에 가슴을 위로 들어 올리며 2초에 걸쳐 허리를 뒤로 천천히 젖혀요. 시선은 벽과 천장이 만나는 곳까지만 살짝 올려요.',
        '편안한 만큼만 젖혀 2초 머물러요. 무릎은 편 채로(잠그지는 말고), 엉덩이는 가볍게 조여요.',
        '숨을 들이마시며 2초에 걸쳐 바르게 선 자세로 돌아와요.',
        '8회 반복해요. 오래 앉아 있었다면 1~2시간마다 한 세트씩 하면 좋아요.',
      ],
      en: [
        'Breathe out and use your palms to nudge your pelvis forward, about 5 cm ahead of your feet.',
        'At the same time lift your chest and slowly arch backward over 2 seconds. Raise your gaze only slightly, to where the wall meets the ceiling.',
        'Lean back only as far as is comfortable and pause for 2 seconds, knees straight but not locked, buttocks lightly squeezed.',
        'Breathe in and return to standing tall over 2 seconds.',
        'Repeat 8 times. After long spells of sitting, a set every 1–2 hours works well.',
      ],
    },
    breathing: {
      ko: '젖히며 입으로 길게 내쉬고, 돌아오며 코로 들이마셔요. 젖힌 자세에서 숨을 참지 마세요.',
      en: 'Exhale long through your mouth as you arch back and inhale through your nose as you return. Don’t hold your breath at the back.',
    },
    feel: {
      ko: '허리 가운데가 가볍게 눌리는 느낌과 함께 배·골반 앞쪽이 부드럽게 늘어나면 정답이에요. 엉덩이나 다리로 통증·저림이 내려가거나 어지러우면 바로 멈춰요.',
      en: 'A light pressure in the middle of your low back with a gentle stretch across your belly and the front of your hips is right. Stop at once if pain or tingling runs into your buttock or leg, or you feel dizzy.',
    },
    easier: {
      ko: '범위를 절반으로 줄이고 시선은 정면에 둔 채, 골반만 앞으로 미는 느낌으로 해요. 서서 하기 불편하면 ‘엎드려 상체 들기’를 팔꿈치 받친 자세로 해요.',
      en: 'Halve the range and keep your eyes forward, thinking only of nudging your pelvis ahead. If standing is uncomfortable, do the prone press-up propped on your forearms.',
    },
    harder: {
      ko: '위에서 머무는 시간을 3~5초로 늘리거나, 두 손을 깍지 껴 머리 위로 뻗은 채 가슴을 들어 올려 등 윗부분까지 함께 젖혀요.',
      en: 'Pause for 3–5 seconds, or interlace your hands overhead and lift your chest so the upper back joins in.',
    },
    cues: { ko: ['골반을 앞으로', '가슴을 위로', '시선은 살짝만', '천천히 돌아와요'], en: ['Hips forward', 'Chest up', 'Eyes up only slightly', 'Return slowly'] },
    mistakes: {
      ko: [
        '고개만 뒤로 확 젖힘 → 시선은 살짝만 올리고, 가슴을 들어 올려 허리와 등이 함께 휘게 해요.',
        '무릎을 굽히며 주저앉음 → 무릎은 편 채로 두고 골반을 앞으로 밀어요.',
        '허리 한 곳만 꺾임 → 정수리를 위로 길게 뽑아 올린 뒤 젖혀, 허리 전체가 부드러운 곡선을 그리게 해요.',
        '빠르게 반동을 줌 → 2초에 걸쳐 천천히 젖히고 2초 머물러요.',
      ],
      en: [
        'Throwing only the head back → Lift your gaze slightly and raise your chest so the low and upper back curve together.',
        'Bending the knees and sinking → Keep your knees straight and push your pelvis forward.',
        'Hinging at one spot in the low back → Grow tall through the crown of your head first, then arch so the whole back makes a smooth curve.',
        'Bouncing quickly → Arch slowly over 2 seconds and pause for 2.',
      ],
    },
    why: {
      ko: '앉아 있는 동안 허리는 계속 앞으로 굽어 있어요. 반대 방향으로 부드럽게 젖혀 주면 굳은 허리 움직임이 살아나고 배·고관절 앞쪽이 늘어나, 오래 앉은 뒤의 허리 뻐근함을 덜 수 있어요. 자리에서 바로 할 수 있어요.',
      en: 'Sitting keeps your low back bent forward for hours. Gently arching the other way restores stiff low-back motion and stretches the front of your belly and hips, easing the ache after long sitting — right beside your desk.',
    },
    muscles: { ko: '허리 신전 가동성, 복직근·장요근(늘어남), 대둔근(골반 밀기)', en: 'Lumbar extension mobility; rectus abdominis and iliopsoas (stretch); gluteus maximus (pelvis push)' },
    caution: {
      ko: '엉덩이나 다리로 통증·저림이 번지거나, 고개를 들 때 어지러우면 멈추세요. 척추관 협착증이 있거나 허리를 젖힐 때 다리가 저리다면 이 동작은 건너뛰세요.',
      en: 'Stop if pain or tingling spreads into your buttock or leg, or you feel dizzy looking up. If you have spinal stenosis or leaning back makes your legs tingle, skip this one.',
    },
    avoid: ['lowBackSevere', 'dizzy'],
    anim: {
      view: 90,
      keys: [
        merge(STAND, HANDS_ON_BACK),
        merge(STAND, { root: { pitch: -2 }, lumbar: { flex: -8 }, thorax: { flex: -3 }, neck: { flex: 2 }, head: { flex: 1 } }, both({ hip: { flex: -6 }, an: 4, sh: { flex: -48, abd: 54, rot: -82 }, el: 120, wr: -40 })),
        merge(STAND, { root: { pitch: -4 }, lumbar: { flex: -18 }, thorax: { flex: -8 }, neck: { flex: 6 }, head: { flex: 4 } }, both({ hip: { flex: -10 }, an: 6, sh: { flex: -39, abd: 53, rot: -82 }, el: 129, wr: -40 })),
      ],
      labels: [
        { ko: '손은 골반 뒤에', en: 'Hands on back of pelvis' },
        { ko: '골반을 앞으로 밀기', en: 'Nudge your hips forward' },
        { ko: '가슴 들어 젖히고 2초', en: 'Lift the chest, arch, 2 s' },
      ],
      durations: [1.2, 1.2, 2],
      pauses: [0.6, 0.1, 2],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'stretch' },
        { a: 'waist', b: 'hipR', side: 'front', kind: 'stretch', r: 2.6 },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
      ],
      trace: ['head'],
    },
  },
  {
    id: 'seated-flexion-stretch',
    name: { ko: '의자에 앉아 앞으로 숙이기', en: 'Seated forward-fold stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['lowBack', 'upperBack'],
    targets: { lowBackPain: 0.6, stiffness: 0.6, lordosis: 0.5, stress: 0.4 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '바퀴 없는 튼튼한 의자 앞쪽 절반에 앉아, 두 발을 어깨너비보다 넓게(골반 너비의 약 1.5배) 벌리고 발끝은 살짝 바깥을 향해요.',
        '무릎은 발 바로 위에 90°로 두고, 두 손은 허벅지 위에 올려요.',
        '허리를 곧게 세워 정면을 보고, 발 앞 50cm 정도는 비워 둬요.',
      ],
      en: [
        'Sit on the front half of a sturdy chair without wheels, feet wider than shoulder-width (about 1.5× hip-width), toes turned slightly out.',
        'Keep your knees at 90° right over your feet and rest your hands on your thighs.',
        'Sit tall, look ahead, and clear about 50 cm of space in front of your feet.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 턱을 가슴 쪽으로 떨구고, 머리 → 어깨 → 등 순서로 한 마디씩 동그랗게 말아 내려가요.',
        '두 손은 허벅지 안쪽을 따라 미끄러뜨려 정강이를 지나 바닥 쪽으로 내려요. 가슴은 두 무릎 사이로 들어가요.',
        '더 내려가지 않는 곳에서 팔과 머리를 무겁게 늘어뜨리고 허리 힘을 완전히 빼 30초 머물러요.',
        '배에 살짝 힘을 주고 두 손으로 허벅지를 짚어 받치며, 허리 → 등 → 머리 순서로 5초에 걸쳐 천천히 말아 올라와요.',
        '다 올라오면 바르게 앉아 2~3번 숨 쉬고, 어지럽지 않은지 확인한 뒤 반복해요.',
      ],
      en: [
        'Breathe out, drop your chin toward your chest and roll down one segment at a time — head, then shoulders, then back.',
        'Slide your hands down the inside of your thighs, past your shins and toward the floor, letting your chest sink between your knees.',
        'Where you stop naturally, let your arms and head hang heavy, relax your low back completely and stay for 30 seconds.',
        'Lightly brace your belly, push on your thighs for support and roll up slowly over 5 seconds — low back, then upper back, head last.',
        'Once up, sit tall for 2–3 breaths, check you don’t feel lightheaded, then repeat.',
      ],
    },
    breathing: {
      ko: '말아 내려가며 내쉬고, 머무는 동안엔 등 뒤쪽 갈비뼈가 부풀도록 코로 깊게 들이마셔요. 내쉴 때마다 허리가 조금 더 늘어지게 둬요.',
      en: 'Exhale as you roll down. While hanging, breathe deeply through your nose so the ribs at your back expand, and let your low back sag a little more on each exhale.',
    },
    feel: {
      ko: '허리 아래쪽부터 등 가운데까지 넓게 늘어나고 뒷목이 부드럽게 풀리면 정답이에요. 머리가 띵하거나 어지러우면 머리를 무릎 높이까지만 내리고, 다리로 저림이 내려가면 멈춰요.',
      en: 'A broad stretch from your low back up to your mid-back and a gentle release at the back of your neck is right. If your head feels heavy or dizzy, lower it only to knee height; stop if tingling runs down a leg.',
    },
    easier: {
      ko: '팔꿈치를 무릎 위에 걸쳐 상체 무게를 받친 채 반쯤만 숙여요. 책상 위에 팔을 포개고 이마를 얹어 숙여도 좋아요.',
      en: 'Rest your elbows on your knees to support your upper body and fold only halfway, or fold forward onto your stacked forearms on the desk.',
    },
    harder: {
      ko: '바닥에서 하는 ‘아기 자세’로 넘어가거나, 머무는 동안 한 손씩 반대쪽 발목 쪽으로 뻗어 등 옆까지 늘려요.',
      en: 'Progress to child’s pose on the floor, or while hanging reach one hand at a time toward the opposite ankle to stretch the side of your back.',
    },
    cues: { ko: ['턱부터 떨궈요', '한 마디씩 말아요', '팔과 머리는 툭', '머리는 맨 나중에'], en: ['Drop your chin first', 'Roll down slowly', 'Let arms and head hang', 'Head comes up last'] },
    mistakes: {
      ko: [
        '빠르게 벌떡 일어남 → 손으로 허벅지를 짚고 5초에 걸쳐 말아 올라오며, 머리는 맨 마지막에 들어요.',
        '발을 좁게 붙임 → 발을 넓게 벌려야 가슴이 무릎 사이로 들어가 허리가 편하게 말려요.',
        '손을 바닥에 닿게 하려고 억지로 누름 → 손이 바닥에 닿지 않아도 괜찮아요. 무게에 맡겨 늘어뜨리기만 해요.',
        '어깨와 목에 힘이 들어감 → 팔을 툭 떨어뜨리고, 고개를 “아니요” 하듯 좌우로 살짝 흔들어 목 힘을 빼요.',
      ],
      en: [
        'Popping up quickly → Push on your thighs and roll up over 5 seconds, head last.',
        'Feet close together → Set them wide so your chest can sink between your knees and your low back rounds comfortably.',
        'Forcing your hands to the floor → They don’t need to touch; just let gravity do the work.',
        'Tense shoulders and neck → Let your arms drop and gently shake your head “no” to release your neck.',
      ],
    },
    why: {
      ko: '허리를 젖힌 채 오래 서 있었거나 허리 뒤쪽 근육이 긴장해 뻣뻣할 때, 상체 무게로 허리 뒤를 부드럽게 늘려 줘요. 의자만 있으면 되니 업무 중 잠깐 쉴 때 하기 좋아요.',
      en: 'When you’ve stood with an arched back for a long time or the muscles along your low back feel tense and stiff, the weight of your upper body gently stretches the back of your spine. All you need is a chair, so it’s an easy work break.',
    },
    muscles: { ko: '척추기립근·다열근(허리 부분), 광배근 아래쪽, 요방형근', en: 'Lumbar erector spinae and multifidus, lower latissimus dorsi, quadratus lumborum' },
    caution: {
      ko: '일어날 때 어지러울 수 있으니 천천히 올라오세요. 녹내장이나 조절되지 않는 고혈압이 있다면 머리를 무릎보다 낮게 내리지 마세요. 다리로 저림이 내려가면 멈추세요.',
      en: 'Come up slowly — you may feel lightheaded. If you have glaucoma or uncontrolled high blood pressure, don’t let your head drop below your knees. Stop if tingling runs down a leg.',
    },
    avoid: ['dizzy', 'radiating', 'lowBackSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      anchor: ['sitL', 'sitR'],
      keys: [
        SIT_WIDE,
        merge(SIT_WIDE, { root: { pitch: 8 }, lumbar: { flex: 16 }, thorax: { flex: 34 }, neck: { flex: 34 }, head: { flex: 6 } }, both({ hip: { flex: 97, hab: 25, rot: 3 }, kn: 91, an: 4, sh: { flex: 23, abd: 12 }, el: 82, wr: 24 })),
        merge(SIT_WIDE, { root: { pitch: 24 }, lumbar: { flex: 42 }, thorax: { flex: 60 }, neck: { flex: 25 }, head: { flex: 6 } }, both({ hip: { flex: 115, hab: 29, rot: 11 }, kn: 97, an: 5, sh: { flex: 91, abd: 9, hab: 1 }, el: 111, wr: -30 })),
      ],
      labels: [
        { ko: '발 넓게 벌려 앉기', en: 'Sit with feet wide' },
        { ko: '턱부터 말아 내리기', en: 'Roll down, chin first' },
        { ko: '힘 빼고 30초', en: 'Hang loose, 30 s' },
      ],
      durations: [2.2, 2.2, 5],
      pauses: [0.6, 0.2, 3],
      holdKey: 2,
      focus: [
        { a: 'backMid', b: 'pelvis', side: 'back', kind: 'stretch' },
        { a: 'backTop', b: 'backMid', kind: 'stretch', r: 2.6 },
      ],
      trace: ['head'],
    },
  },
];
