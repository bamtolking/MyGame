/**
 * 운동 라이브러리 · 발목·발·균형·손목·전신
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { HANDS_ON_HIPS, STAND, WALL, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 벽 종아리 스트레칭: 왼발 고정, 오른발을 뒤로 (두 발 모두 바닥에 평평) ──
/** 벽 앞에 서서 두 손바닥을 어깨 높이로 벽에 댐 (팔꿈치는 아래로 굽힘) */
const CS_START: Pose = merge(STAND, both({ sh: { flex: 51, abd: 8 }, el: 85, wr: 40 }), { head: { flex: -2 } });
/** 오른발을 한 걸음 뒤로 — 뒤꿈치는 바닥, 몸은 거의 세운 채 팔이 펴짐 */
const CS_STEP: Pose = merge(STAND, { root: { pitch: 5 } }, both({ sh: { flex: 95, abd: 8 }, el: 7, wr: 67 }), {
  hipL: { flex: 28 },
  knL: 17,
  anL: -6,
  hipR: { flex: -12 },
  knR: 0,
  anR: 17,
});
/** 앞무릎을 굽혀 골반을 벽 쪽으로 — 뒷무릎은 편 채 뒤꿈치 고정(발목 24° 굽힘) */
const CS_LEAN: Pose = merge(STAND, { root: { pitch: 14 } }, both({ sh: { flex: 77, abd: 8 }, el: 84, wr: 30 }), {
  neck: { flex: -6 },
  hipL: { flex: 45 },
  knL: 45,
  anL: 14,
  hipR: { flex: -10 },
  knR: 0,
  anR: 24,
});

// ── 까치발 들기: 손끝은 가슴 높이로 벽에 ──
const CR_DOWN: Pose = merge(STAND, both({ sh: { flex: 46, abd: 10 }, el: 57, wr: 73 }));
const CR_UP: Pose = merge(STAND, both({ sh: { flex: 35, abd: 10 }, el: 77, wr: 64, an: -28 }));
const CR_MID: Pose = merge(STAND, both({ sh: { flex: 41, abd: 10 }, el: 66, wr: 69, an: -14 }));

// ── 한 발 서기: 오른발로 서기(왼발 들기) ──
const SLB_SHIFT: Pose = { hipR: { flex: 3, abd: -5 }, knR: 6, anR: 3, hipL: { abd: 5 } };

// ── 손목 스트레칭: 오른팔을 앞으로(몸 가운데 쪽으로 살짝) ──
const WR_ARM: Pose = { shR: { flex: 88, hab: -12 }, elR: 2, thorax: { twist: -4 }, scapL: { prot: 2 } };

export const ANKLE: Exercise[] = [
  {
    id: 'calf-stretch',
    name: { ko: '벽 종아리 스트레칭', en: 'Wall calf stretch' },
    phase: 'stretch',
    position: 'wall',
    regions: ['ankle', 'knee'],
    targets: { kneeHyperext: 0.4, kneeValgus: 0.3, stiffness: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '벽을 마주 보고 발끝이 벽에서 20cm쯤 떨어지게 서요. 발은 골반 너비, 발끝은 벽을 향해 11자로 둬요.',
        '두 손바닥을 어깨 높이·어깨 너비로 벽에 대요. 팔꿈치는 편하게 굽혀 아래를 향하게 해요.',
        '배꼽을 살짝 당겨 허리가 꺾이지 않게 하고, 시선은 벽의 눈높이 한 점에 둬요.',
      ],
      en: [
        'Face a wall with your toes about 20 cm from it, feet hip-width and pointing straight at the wall.',
        'Place both palms on the wall at shoulder height and shoulder width, elbows relaxed and pointing down.',
        'Draw your belly button in slightly so your low back doesn’t arch, and look at a point on the wall at eye level.',
      ],
    },
    steps: {
      ko: [
        '오른발을 뒤로 크게 한 걸음(약 50cm) 빼요. 오른발 끝도 벽을 향하게 11자로 두고 뒤꿈치를 바닥에 꾹 붙여요.',
        '오른무릎은 쭉 편 채, 왼무릎을 천천히 굽히며 골반을 벽 쪽으로 5~10cm 보내요. 팔꿈치도 따라 굽혀요.',
        '오른쪽 종아리(무릎 뒤~아킬레스건)가 기분 좋게 당기는 지점에서 멈추고 30초 버텨요.',
        '버티는 동안 머리~골반~오른발 뒤꿈치가 비스듬한 한 줄이 되게 유지해요.',
        '왼무릎을 펴며 천천히 돌아와 발을 모으고, 이번엔 왼발을 뒤로 빼서 30초 해요.',
      ],
      en: [
        'Take a big step back with your right foot (about 50 cm). Point those toes at the wall too and press the heel firmly into the floor.',
        'Keeping the right knee straight, slowly bend your left knee and move your hips 5–10 cm toward the wall, letting your elbows bend.',
        'Stop where you feel a comfortable pull in the right calf (back of the knee down to the Achilles) and hold for 30 seconds.',
        'While holding, keep your head, hips and right heel in one long diagonal line.',
        'Straighten the left knee to come back, bring your feet together, then step the left foot back and hold for 30 seconds.',
      ],
    },
    breathing: {
      ko: '자세를 잡고 코로 들이마신 뒤, 입으로 길게 “후—” 내쉬며 골반을 1~2cm 더 벽 쪽으로 보내요. 버티는 동안은 편하게 숨 쉬고 숨을 참지 마세요.',
      en: 'Once you’re set, breathe in through your nose, then exhale long through your mouth and ease your hips 1–2 cm closer to the wall. Breathe easily during the hold — no breath-holding.',
    },
    feel: {
      ko: '뒤로 뺀 다리의 종아리 한가운데(알통)부터 아킬레스건 위까지 길게 당기면 정답이에요. 발목 앞이 끼이거나, 아킬레스건이 찌릿하게 아프거나, 발이 저리면 걸음 폭을 줄이고 그래도 계속되면 멈춰요.',
      en: 'A long pull from the middle of the back-leg calf down to just above the Achilles is right. If the front of the ankle pinches, the Achilles feels sharp or your foot tingles, shorten your step — and stop if it continues.',
    },
    easier: {
      ko: '걸음 폭을 반으로 줄이고 앞무릎도 조금만 굽혀요. 서 있기 힘들면 바닥이나 의자에 앉아 다리를 펴고, 발바닥 앞쪽에 수건을 걸어 몸 쪽으로 당겨요.',
      en: 'Halve your step and bend the front knee only a little. If standing is hard, sit with the leg straight, loop a towel around the ball of your foot and pull it toward you.',
    },
    harder: {
      ko: '45초까지 늘려요. 2세트째는 같은 자세에서 뒷무릎만 살짝(5~10cm) 굽혀 종아리 아래쪽(가자미근)을 늘리는 버전으로 바꿔도 좋아요. 계단 끝에 앞꿈치만 올리고 뒤꿈치를 천천히 떨어뜨리는 방법도 있어요.',
      en: 'Build up to 45 seconds. For the second set, bend the back knee slightly (5–10 cm) in the same stance to target the lower calf (soleus). You can also stand with the balls of your feet on a step edge and slowly drop your heels.',
    },
    cues: { ko: ['뒤꿈치는 바닥에 꾹', '뒷무릎은 쭉 펴요', '발끝은 벽을 향해', '골반을 벽 쪽으로'], en: ['Heel down', 'Back knee straight', 'Toes to the wall', 'Hips toward the wall'] },
    mistakes: {
      ko: [
        '뒤꿈치가 바닥에서 뜸 → 걸음 폭을 줄여 뒤꿈치가 바닥에 붙어 있는 거리에서 해요.',
        '뒷발 끝이 바깥으로 돌아감 → 발끝을 벽 쪽으로 돌려 11자로 맞춰요. 바깥으로 돌면 당김이 빠져요.',
        '뒷무릎이 굽음 → 무릎 뒤를 쭉 펴야 종아리 위쪽(비복근)까지 늘어나요.',
        '엉덩이가 뒤로 빠지고 상체만 숙임 → 배에 살짝 힘을 주고 몸을 한 줄로 유지한 채 골반을 벽 쪽으로 보내요.',
      ],
      en: [
        'Heel lifting off the floor → Shorten your step until the heel stays down.',
        'Back toes turning out → Turn them to point at the wall; turned-out toes let the stretch slip away.',
        'Back knee bending → Keep the back of the knee long and straight to reach the upper calf (gastrocnemius).',
        'Hips sticking back while only the chest leans in → Brace lightly, keep your body in one line and move your hips toward the wall.',
      ],
    },
    why: {
      ko: '종아리가 뻣뻣해 발목이 발등 쪽으로 잘 굽혀지지 않으면, 걷거나 쪼그려 앉을 때 무릎이 안쪽으로 무너지고 서 있을 때는 무릎이 뒤로 꺾이기 쉬워요. 발목 움직임을 되찾아 무릎 정렬을 아래에서부터 도와요.',
      en: 'Stiff calves limit how far your ankle bends, so the knees tend to cave in when you walk or squat and lock back when you stand. Restoring ankle range supports knee alignment from the ground up.',
    },
    muscles: { ko: '비복근(종아리 위쪽), 가자미근(종아리 아래쪽), 아킬레스건', en: 'Gastrocnemius (upper calf), soleus (lower calf), Achilles tendon' },
    caution: {
      ko: '아킬레스건이 날카롭게 아프면 범위를 줄이세요. 종아리가 붓고 뜨거우면서 아프다면 스트레칭하지 말고 의료진과 상담하세요.',
      en: 'Ease off if the Achilles feels sharp. If your calf is swollen, warm and painful, skip the stretch and check with a healthcare professional.',
    },
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'front', dist: 1 }],
      anchor: ['heelL', 'toeL'],
      keys: [CS_START, CS_STEP, CS_LEAN],
      labels: [
        { ko: '벽 짚고 서기', en: 'Hands on the wall' },
        { ko: '한 발 뒤로 크게', en: 'Step one foot back' },
        { ko: '앞무릎 굽혀 30초', en: 'Bend front knee, 30 s' },
      ],
      durations: [1.4, 1.4, 1.6],
      pauses: [0.6, 0.6, 3],
      holdKey: 2,
      focus: [{ a: 'knR', b: 'heelR', side: 'back', kind: 'stretch', from: 0.05, to: 0.9, r: 2.8 }],
      trace: ['anR'],
    },
  },
  {
    id: 'calf-raise',
    name: { ko: '까치발 들기', en: 'Calf raise' },
    phase: 'integrate',
    position: 'standing',
    regions: ['ankle', 'knee'],
    targets: { kneeHyperext: 0.3, kneeValgus: 0.3, stiffness: 0.2 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 15, tempo: 2.5, holdSec: 1, rest: 20 },
    desk: true,
    setup: {
      ko: [
        '벽을 마주 보고 발끝이 벽에서 25cm쯤 떨어지게 서요. 발은 골반 너비, 발끝은 정면을 향해 11자로 둬요.',
        '두 손끝을 가슴 높이로 벽에 가볍게 대요. 균형만 잡는 용도라 손으로 밀지 않아요.',
        '무릎은 펴되 뒤로 잠그지 않고, 체중은 발바닥 세 점(엄지 뿌리·새끼 뿌리·뒤꿈치)에 고르게 실어요.',
      ],
      en: [
        'Face a wall with your toes about 25 cm from it, feet hip-width and pointing straight ahead.',
        'Rest your fingertips lightly on the wall at chest height — they’re only there for balance, so don’t push.',
        'Keep your knees straight but not locked, with your weight spread over three points: big-toe ball, little-toe ball and heel.',
      ],
    },
    steps: {
      ko: [
        '엄지발가락 뿌리로 바닥을 누르며 1초에 걸쳐 뒤꿈치를 최대한 높이 들어요.',
        '맨 위에서 1초 버텨요. 체중은 엄지와 둘째 발가락 사이에 모아요.',
        '1~2초에 걸쳐 천천히 뒤꿈치를 내려요. 올라갈 때보다 느리게요.',
        '뒤꿈치가 바닥에 살짝 닿으면 쉬지 말고 바로 다음 회를 시작해요.',
        '15회를 채우고 20초 쉰 뒤 한 세트 더 해요.',
      ],
      en: [
        'Press through the balls of your big toes and take 1 second to rise as high as you can.',
        'Hold at the top for 1 second, weight centred between the big and second toes.',
        'Take 1–2 seconds to lower your heels — slower than on the way up.',
        'As your heels lightly touch the floor, go straight into the next rep.',
        'Complete 15 reps, rest 20 seconds, then do one more set.',
      ],
    },
    breathing: {
      ko: '올라가면서 입으로 “후—” 내쉬고, 내려오면서 코로 들이마셔요. 숨을 참지 말고 일정한 리듬을 유지해요.',
      en: 'Exhale through your mouth as you rise and breathe in through your nose as you lower. Keep a steady rhythm without holding your breath.',
    },
    feel: {
      ko: '종아리 뒤(특히 위쪽 알통)가 뻐근하게 일하고, 체중이 발바닥 앞쪽에 실리면 정답이에요. 종아리에 쥐가 나려 하거나 아킬레스건·발바닥이 찌릿하게 아프면 멈추고 쉬어요.',
      en: 'A working burn in the backs of your calves (especially the upper bulge) with your weight over the balls of your feet is right. If a calf starts to cramp or your Achilles or sole feels sharp, stop and rest.',
    },
    easier: {
      ko: '벽이나 의자 등받이를 두 손으로 조금 더 잡고, 높이를 절반만 들어요. 서 있기 힘들면 의자에 앉아 뒤꿈치를 들었다 내리는 ‘앉아서 까치발’로 해요.',
      en: 'Hold the wall or a chair back a little more firmly and rise only halfway. If standing is tough, sit on a chair and do seated heel raises.',
    },
    harder: {
      ko: '내리는 시간을 3초로 늘리거나 20회까지 늘려요. 그다음엔 계단 끝에 앞꿈치만 올려 뒤꿈치를 계단 아래까지 내렸다 올리거나, 벽을 잡고 한 발 까치발로 넘어가요.',
      en: 'Slow the lowering to 3 seconds or build to 20 reps. Next, stand with the balls of your feet on a step edge and lower your heels below the step, or progress to single-leg calf raises holding the wall.',
    },
    cues: { ko: ['엄지발가락 쪽으로', '최대한 높이', '맨 위에서 1초', '천천히 내려요'], en: ['Onto the big toes', 'All the way up', 'Pause at the top', 'Lower slowly'] },
    mistakes: {
      ko: [
        '발목이 바깥으로 꺾이며 새끼발가락 쪽으로 올라감 → 엄지발가락 뿌리로 바닥을 누르고, 뒤꿈치가 안쪽으로 기울지 않게 곧게 들어요.',
        '반동으로 빠르게 튕김 → 맨 위에서 1초 멈추고, 내려올 때는 올라갈 때보다 천천히 해요.',
        '엉덩이를 뒤로 빼거나 상체를 숙이며 올라감 → 정수리를 천장으로 뻗은 채 엘리베이터처럼 몸 전체가 곧게 올라가요.',
        '손으로 벽을 밀어 몸을 들어 올림 → 손끝은 가볍게 대기만 하고 힘은 종아리로만 써요.',
      ],
      en: [
        'Ankles rolling out onto the little toes → Press through the big-toe balls and lift the heels straight up without tipping them inward.',
        'Bouncing fast → Pause for 1 second at the top and lower more slowly than you rise.',
        'Sticking the hips back or leaning forward → Reach the crown up and rise straight like an elevator.',
        'Pushing off the wall with your hands → Keep the fingertips light and let your calves do the work.',
      ],
    },
    why: {
      ko: '종아리와 발목 주변 근육을 길러 서고 걸을 때 하체 정렬을 바닥에서부터 받쳐 줘요. 걷기·계단에서 몸을 밀어 주는 힘이 좋아지고, 오래 앉아 있다가 하면 종아리 근육이 펌프처럼 움직여 다리가 한결 가벼워져요.',
      en: 'Strengthens the calf and ankle muscles that hold your leg alignment up from the ground, improves push-off for walking and stairs, and after long sitting the calf “pump” helps your legs feel lighter.',
    },
    muscles: { ko: '비복근·가자미근(종아리), 후경골근·비골근(발목 안정)', en: 'Gastrocnemius & soleus (calves), tibialis posterior & peroneals (ankle stability)' },
    caution: { ko: '아킬레스건이나 발바닥이 날카롭게 아프면 높이를 줄이거나 쉬세요.', en: 'If your Achilles or sole feels sharp, rise less or rest.' },
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'front', dist: 1 }],
      anchor: ['toeL', 'toeR'],
      keys: [CR_DOWN, CR_UP, CR_MID],
      labels: [
        { ko: '벽에 손끝 대고 서기', en: 'Fingertips on the wall' },
        { ko: '뒤꿈치 높이, 1초', en: 'Heels high, hold 1 s' },
        { ko: '천천히 내리기', en: 'Lower slowly' },
      ],
      durations: [0.9, 0.7, 0.6],
      pauses: [0.3, 1, 0],
      focus: [
        { a: 'knR', b: 'anR', side: 'back', kind: 'work', from: 0.08, to: 0.7, r: 2.8 },
        { a: 'knL', b: 'anL', side: 'back', kind: 'work', from: 0.08, to: 0.7, r: 2.8 },
      ],
      trace: ['heelR'],
    },
    coach: {
      view: 'side',
      metric: 'heelRaise',
      mode: 'reps',
      rest: 0.012,
      peak: 0.03,
      dir: 1,
      hint: { ko: '옆에서 발까지 보이게 휴대폰을 세워 주세요', en: 'Place the phone beside you so your feet are visible' },
      more: { ko: '뒤꿈치를 더 높이', en: 'Heels higher' },
      good: { ko: '좋아요!', en: 'Good!' },
    },
  },
  {
    id: 'single-leg-balance',
    name: { ko: '한 발 서기', en: 'Single-leg balance' },
    phase: 'integrate',
    position: 'standing',
    regions: ['hip', 'ankle', 'core'],
    targets: { lateralShift: 0.6, pelvicTilt: 0.6, kneeValgus: 0.5 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '벽이나 튼튼한 의자 옆 30cm 안쪽에 서서, 흔들리면 바로 손을 댈 수 있게 해요.',
        '발은 골반 너비, 발끝은 정면. 양손은 골반 위(허리)에 얹어 골반 높이를 손으로 느껴요.',
        '정수리를 위로 길게 뻗고, 시선은 2~3m 앞 눈높이의 한 점에 고정해요.',
      ],
      en: [
        'Stand within 30 cm of a wall or sturdy chair so you can touch it the moment you wobble.',
        'Feet hip-width, toes forward. Rest your hands on your hips so you can feel whether your pelvis stays level.',
        'Grow tall through the crown and fix your gaze on a point 2–3 m ahead at eye level.',
      ],
    },
    steps: {
      ko: [
        '체중을 천천히 오른발로 옮겨요. 오른발 엄지 뿌리·새끼 뿌리·뒤꿈치 세 점으로 바닥을 고르게 눌러요.',
        '왼무릎을 앞으로 들어 왼발을 바닥에서 10~15cm 띄워요.',
        '양쪽 골반 높이를 수평으로 유지하고, 오른무릎은 살짝 굽혀 둘째 발가락 방향을 향하게 해요.',
        '그대로 30초 버텨요. 흔들리면 왼발 끝으로 바닥을 잠깐 톡 짚었다가 다시 들어요.',
        '천천히 발을 내려놓고, 반대로 왼발로 서서 30초 해요.',
      ],
      en: [
        'Slowly shift your weight onto your right foot, pressing evenly through the big-toe ball, little-toe ball and heel.',
        'Lift your left knee forward so the left foot comes 10–15 cm off the floor.',
        'Keep both sides of your pelvis level, with the right knee softly bent and pointing over the second toe.',
        'Hold for 30 seconds. If you wobble, tap the left toes down briefly, then lift again.',
        'Lower the foot slowly, then stand on the left leg for 30 seconds.',
      ],
    },
    breathing: {
      ko: '코로 편하게 들이마시고 입으로 길게 내쉬어요. 내쉴 때 배꼽을 살짝 당겨 몸통을 단단하게 하면 덜 흔들려요. 숨을 참으면 몸이 굳어 오히려 더 흔들려요.',
      en: 'Breathe in through your nose and out long through your mouth. Drawing the belly button in slightly on each exhale steadies your trunk; holding your breath makes you stiffer and wobblier.',
    },
    feel: {
      ko: '서 있는 쪽 엉덩이 옆(중둔근)이 단단해지고, 발바닥과 발목 주변이 쉴 새 없이 미세하게 조절하는 느낌이면 정답이에요. 조금 흔들리는 건 균형 근육이 일하는 증거예요. 어지럽거나 발목·무릎이 아프면 멈춰요.',
      en: 'The side of your standing hip (glute med) firms up and your foot and ankle make constant tiny adjustments — that’s right. A little wobble means the balance muscles are working. Stop if you feel dizzy or your ankle or knee hurts.',
    },
    easier: {
      ko: '벽이나 의자 등받이를 손가락 두 개로 가볍게 짚고 해요. 그래도 어려우면 들 발의 발끝을 바닥에 댄 채 체중만 90% 옮겨 버티거나, 10초씩 3번으로 나눠요.',
      en: 'Lightly touch a wall or chair back with two fingers. Still hard? Keep the lifted foot’s toes on the floor with 90% of your weight on the standing leg, or split the hold into three 10-second bouts.',
    },
    harder: {
      ko: '60초까지 늘려요. 그다음엔 고개를 좌우로 천천히 돌리거나, 접은 수건·쿠션 위에 서거나, 벽 옆에서 눈을 감고 해 보세요. 서 있는 다리로 살짝 앉았다 일어나는 미니 스쿼트 5회도 좋아요.',
      en: 'Build up to 60 seconds. Then slowly turn your head side to side, stand on a folded towel or cushion, or close your eyes next to a wall. Five shallow single-leg mini squats are another step up.',
    },
    cues: { ko: ['골반은 수평', '발바닥 세 점 누르기', '무릎은 살짝 굽혀', '시선은 한 곳에'], en: ['Level pelvis', 'Press three points', 'Soft knee', 'Fix your gaze'] },
    mistakes: {
      ko: [
        '들린 쪽 골반이 아래로 처짐 → 서 있는 쪽 엉덩이 옆에 힘을 주고, 허리에 얹은 두 손이 수평이 되게 맞춰요.',
        '몸통이 서 있는 다리 쪽으로 크게 기울어짐 → 정수리를 천장으로 뻗어 어깨를 수평으로 두고, 골반만 발 위로 옮겨요.',
        '서 있는 무릎을 뒤로 잠그거나 안쪽으로 무너뜨림 → 무릎을 5~10도 살짝 굽혀 둘째 발가락 방향으로 향하게 해요.',
        '발가락으로 바닥을 움켜쥐거나 발목이 바깥으로 꺾임 → 발가락은 편하게 펴고, 발바닥 세 점에 체중을 고르게 실어요.',
      ],
      en: [
        'Lifted-side hip dropping → Switch on the side of the standing hip and keep the hands on your hips level.',
        'Trunk leaning hard over the standing leg → Reach the crown up, keep your shoulders level and move only your pelvis over the foot.',
        'Standing knee locking back or caving in → Bend it 5–10° and keep it pointing over the second toe.',
        'Toes clawing or the ankle rolling out → Relax the toes and spread your weight over the three points of the foot.',
      ],
    },
    why: {
      ko: '한쪽 다리로 몸을 버티는 힘(엉덩이 옆·발목의 안정성)을 길러, 짝다리 습관과 골반·몸통이 한쪽으로 치우치는 자세를 바로잡도록 도와요. 걸을 때 우리는 매 걸음 잠깐씩 한 발로 서기 때문이에요.',
      en: 'Builds single-leg stability at the hip and ankle, helping correct the habit of sinking into one hip and a pelvis or trunk that drifts to one side — every step you take is a brief single-leg stance.',
    },
    muscles: { ko: '중둔근(엉덩이 옆), 발목 안정근(비골근·후경골근), 코어', en: 'Gluteus medius (side hip), ankle stabilisers (peroneals, tibialis posterior), core' },
    caution: {
      ko: '균형이 불안하거나 최근 넘어진 적이 있다면 반드시 벽이나 의자를 잡고 하세요. 눈 감기는 벽 옆에서만 해요.',
      en: 'If your balance is shaky or you’ve fallen recently, always hold a wall or chair. Only try it eyes-closed next to a wall.',
    },
    avoid: ['balance'],
    anim: {
      view: 0,
      anchor: ['heelR', 'toeR'],
      keys: [
        merge(STAND, HANDS_ON_HIPS),
        merge(STAND, HANDS_ON_HIPS, SLB_SHIFT),
        merge(STAND, HANDS_ON_HIPS, SLB_SHIFT, { hipL: { flex: 45, abd: 2 }, knL: 72, anL: 8 }),
      ],
      labels: [
        { ko: '골반 너비로 서기', en: 'Stand hip-width' },
        { ko: '한 발로 체중 옮기기', en: 'Shift onto one foot' },
        { ko: '반대 발 들고 30초', en: 'Lift other foot, 30 s' },
      ],
      durations: [1.2, 1.2, 1.4],
      pauses: [0.5, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'out', kind: 'work', from: -0.32, to: 0.12, r: 3 },
        { a: 'knR', b: 'anR', side: 'out', kind: 'work', from: 0.15, to: 0.85, r: 2 },
      ],
      trace: ['anL'],
    },
    coach: {
      view: 'front',
      metric: 'footLift',
      mode: 'hold',
      target: 0.04,
      dir: 1,
      hint: { ko: '정면에서 발끝까지 보이게 휴대폰을 세워 주세요', en: 'Prop the phone in front so your feet are visible' },
      more: { ko: '발을 들어 주세요', en: 'Lift your foot' },
      good: { ko: '좋아요, 균형 유지!', en: 'Nice balance!' },
    },
  },
  {
    id: 'wrist-stretch',
    name: { ko: '손목 앞뒤 스트레칭', en: 'Wrist flexor & extensor stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['wrist'],
    targets: { wristPain: 1, stiffness: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 20, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '바르게 서거나 의자에 앉아, 어깨를 한 번 으쓱했다가 툭 내려요.',
        '오른팔을 어깨 높이로 앞으로 쭉 뻗어요. 팔꿈치는 펴고 손바닥은 바닥을 향해요.',
        '팔을 몸 가운데 쪽으로 살짝 모아 왼손이 편하게 닿게 해요.',
      ],
      en: [
        'Stand or sit tall; shrug your shoulders once and let them drop.',
        'Reach your right arm straight out in front at shoulder height, elbow straight, palm facing the floor.',
        'Bring the arm slightly toward your midline so your left hand can reach it comfortably.',
      ],
    },
    steps: {
      ko: [
        '[손바닥 쪽] 오른 손목을 위로 젖혀 손바닥이 정면을 보게 해요(“멈춰” 손 모양).',
        '왼손으로 오른손 손가락을 손바닥 쪽에서 감싸 몸 쪽으로 부드럽게 당겨요. 버티는 시간의 앞 절반(약 10초) 동안 유지해요.',
        '[손등 쪽] 손목을 풀었다가 이번엔 아래로 꺾어 손가락이 바닥을 향하게 해요.',
        '왼손으로 오른손 손등을 감싸 몸 쪽으로 부드럽게 눌러, 나머지 절반(약 10초) 동안 유지해요.',
        '손을 가볍게 털고, 왼팔도 같은 순서로 해요.',
      ],
      en: [
        '[Palm side] Bend your right wrist back so the palm faces forward, like a “stop” sign.',
        'Wrap your left hand around the right fingers from the palm side and gently draw them toward you. Hold for the first half of the time (about 10 seconds).',
        '[Back of hand] Release, then bend the wrist down so the fingers point to the floor.',
        'Cup the back of your right hand with your left and gently press it toward you for the second half (about 10 seconds).',
        'Shake the hand out loosely, then repeat the same sequence with the left arm.',
      ],
    },
    breathing: {
      ko: '당기기 전에 코로 들이마시고, 입으로 내쉬면서 손을 몸 쪽으로 1~2cm 더 가져와요. 버티는 동안은 편하게 숨 쉬어요.',
      en: 'Breathe in before you pull, then exhale and draw the hand 1–2 cm closer. Breathe easily while you hold.',
    },
    feel: {
      ko: '손바닥 쪽은 아래팔 안쪽이, 손등 쪽은 아래팔 바깥쪽이 팔꿈치 근처까지 은은하게 당기면 정답이에요. 손가락이 저리거나 찌릿하면 팔꿈치를 살짝 굽히고 당기는 힘을 줄여요. 그래도 계속되면 멈춰요.',
      en: 'A gentle pull along the inner forearm (palm side), then along the outer forearm (back of hand), up toward the elbow. If your fingers tingle or zing, soften the elbow and pull less; stop if it continues.',
    },
    easier: {
      ko: '팔꿈치를 살짝 굽힌 채 해요. 또는 가슴 앞에서 두 손바닥을 맞대고(기도 자세) 손을 천천히 내려 손바닥 쪽을, 손등을 맞대고 손끝이 아래를 향한 채 팔꿈치를 들어 손등 쪽을 늘려요.',
      en: 'Keep the elbow slightly bent. Or press your palms together in front of your chest (prayer position) and slowly lower the hands for the palm side; press the backs of the hands together, fingers down, and lift the elbows for the back of the hand.',
    },
    harder: {
      ko: '버티는 시간을 30초로 늘려요. 손등 쪽은 주먹을 가볍게 쥔 채 손목을 꺾으면 더 늘어나요. 손목 통증이 없다면 책상에 손바닥을 짚고(손가락이 몸 쪽) 체중을 살짝 뒤로 실어 손바닥 쪽을 늘려도 좋아요.',
      en: 'Build up to 30-second holds. For the back of the hand, make a loose fist before bending the wrist for a deeper stretch. If your wrists are pain-free, place your palms on a desk with fingers pointing toward you and ease your weight back to stretch the palm side.',
    },
    cues: { ko: ['팔꿈치는 쭉', '어깨는 툭 내려요', '부드럽게 당겨요', '저리면 약하게'], en: ['Elbow straight', 'Drop your shoulders', 'Gentle pull', 'Ease off if it tingles'] },
    mistakes: {
      ko: [
        '손목을 세게 꺾음 → 은은하게 당기는 정도(10점 중 3~4)까지만, 내쉴 때마다 1~2cm씩 더해요.',
        '팔꿈치가 굽음 → 팔꿈치를 쭉 펴야 팔꿈치 근처에서 시작하는 근육까지 늘어나요.',
        '어깨가 올라가고 팔이 몸 쪽으로 딸려 옴 → 어깨를 귀에서 멀리 내리고, 팔은 어깨 높이에 고정한 채 손만 움직여요.',
        '손가락 끝만 잡아당김 → 손가락 뿌리(손바닥)까지 감싸 손목에서 꺾이게 해요.',
      ],
      en: [
        'Cranking the wrist → Stop at a gentle 3–4 out of 10 pull and add 1–2 cm on each exhale.',
        'Bending the elbow → Keep it straight so the muscles that start near the elbow get stretched too.',
        'Shoulder hiking and the arm drifting in → Drop the shoulder away from your ear and keep the arm at shoulder height; move only the hand.',
        'Pulling only the fingertips → Wrap the whole hand up to the knuckles so the bend comes from the wrist.',
      ],
    },
    why: {
      ko: '마우스·키보드·스마트폰을 오래 쓰면 손목을 굽히고 펴는 아래팔 근육이 짧게 굳어요. 두 방향을 모두 늘려 손목 앞뒤의 긴장을 풀고, 손목과 팔꿈치 바깥쪽에 쌓이는 부담을 줄여요.',
      en: 'Long hours on a mouse, keyboard or phone leave the forearm muscles that bend and straighten the wrist short and tense. Stretching both directions eases tension around the wrist and reduces the load that builds up at the wrist and outer elbow.',
    },
    muscles: { ko: '손목 굽힘근(아래팔 안쪽), 손목 폄근(아래팔 바깥쪽)', en: 'Wrist flexors (inner forearm), wrist extensors (outer forearm)' },
    caution: {
      ko: '손목을 최근 다쳤거나 손가락 저림이 계속되면 아주 약하게만 하고, 저림이 심해지면 멈추세요.',
      en: 'If you’ve recently hurt your wrist or have ongoing finger tingling, keep it very gentle and stop if the tingling gets worse.',
    },
    anim: {
      view: 70,
      keys: [
        merge(STAND, WR_ARM),
        merge(STAND, WR_ARM, { wrR: 72, shL: { flex: 82, abd: -32, rot: -60, hab: -13 }, elL: 25, wrL: 4 }),
        merge(STAND, WR_ARM, { wrR: -72, shL: { flex: 56, abd: -45, rot: -64, hab: 6 }, elL: 31, wrL: 3 }),
      ],
      labels: [
        { ko: '팔을 앞으로 쭉', en: 'Reach one arm forward' },
        { ko: '손바닥 쪽 당기기', en: 'Palm side: pull back' },
        { ko: '손등 쪽 누르기', en: 'Back of hand: press in' },
      ],
      durations: [1.2, 1.4, 1.2],
      pauses: [0.5, 5.5, 3],
      holdKey: 2,
      focus: [{ a: 'elR', b: 'wrR', kind: 'stretch', from: 0.1, to: 0.95, r: 2.2 }],
      trace: ['haR'],
      zoom: 1.05,
    },
  },
  {
    id: 'wall-posture-reset',
    name: { ko: '벽 자세 리셋', en: 'Wall posture reset' },
    phase: 'integrate',
    position: 'wall',
    regions: ['fullBody', 'neck', 'upperBack'],
    targets: { fhp: 0.8, roundShoulder: 0.7, swayback: 0.5, kyphosis: 0.5, lordosis: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'hold', sets: 3, value: 30, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '벽에 등을 대고 서서 뒤꿈치를 벽에서 5~10cm(손가락 서너 개) 떼요. 발은 골반 너비, 발끝은 정면.',
        '무릎은 펴되 뒤로 잠그지 않고, 체중은 발 한가운데(복사뼈 바로 앞)에 실어요.',
        '팔은 몸 옆에 편하게 내리고 손바닥이 허벅지를 향하게 해요. 시선은 정면 눈높이에 둬요.',
      ],
      en: [
        'Stand with your back to a wall, heels 5–10 cm (three or four fingers) away from it, feet hip-width, toes forward.',
        'Keep your knees straight but not locked, weight over the middle of your feet (just in front of the ankle bones).',
        'Let your arms hang relaxed with palms facing your thighs, eyes level.',
      ],
    },
    steps: {
      ko: [
        '엉덩이와 두 날개뼈를 벽에 붙여요. 어깨는 귀에서 멀리 내리고 날개뼈를 살짝 뒤로 모아요.',
        '허리 뒤에 손을 넣어 봐요. 손바닥 하나가 겨우 들어가면 정답이에요. 더 넓으면 아랫배를 살짝 당겨 갈비뼈를 내려요.',
        '시선은 정면 그대로, 턱을 수평으로 뒤로 당겨 뒤통수를 벽에 대요. 정수리는 천장 쪽으로 길게 뻗어요.',
        '이 자세로 코로 천천히 숨 쉬며 30초 버텨요.',
        '끝나면 자세 그대로 벽에서 한 걸음 나와 5초간 서서 이 느낌을 기억해요.',
      ],
      en: [
        'Bring your glutes and both shoulder blades to the wall. Let your shoulders slide down away from your ears and draw the blades slightly back.',
        'Slide a hand behind your low back: one flat hand should just fit. If there’s more room, draw your lower belly in slightly and let your ribs drop.',
        'Keeping your eyes level, glide your chin straight back until the back of your head touches the wall. Reach the crown toward the ceiling.',
        'Hold for 30 seconds, breathing slowly through your nose.',
        'Then step one pace away from the wall keeping this shape, and stand for 5 seconds to memorise the feeling.',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시며 옆구리와 등이 벽 쪽으로 부풀게 하고, 입으로 6초 내쉬며 갈비뼈가 아래로 내려가게 해요. 30초 동안 3번이면 충분해요.',
      en: 'Breathe in through your nose for 4 seconds, letting your sides and back widen into the wall, then out through your mouth for 6 seconds as your ribs settle down. Three breaths fill the 30 seconds.',
    },
    feel: {
      ko: '날개뼈 사이와 목 앞 깊은 곳이 은은하게 일하고, 가슴 앞이 살짝 열리며 키가 커지는 느낌이면 정답이에요. 허리가 꺾여 뻐근하거나, 뒤통수를 대려다 턱이 들리며 목 뒤가 조이면 너무 무리한 거예요.',
      en: 'A gentle effort between the shoulder blades and deep in the front of the neck, with the chest opening and a feeling of growing taller. An aching, arched low back — or a pinched back of the neck from lifting the chin — means you’re forcing it.',
    },
    easier: {
      ko: '턱을 들지 않고는 뒤통수가 벽에 안 닿으면 억지로 붙이지 말고 접은 수건(2~5cm)을 뒤통수 뒤에 대요. 오래 서 있기 힘들면 의자에 앉아 등받이에 엉덩이와 등을 붙이고 같은 정렬을 만들어요.',
      en: 'If the back of your head can’t reach the wall without lifting your chin, don’t force it — put a folded towel (2–5 cm) behind your head. If standing is tiring, sit with your hips and back against a chair back and build the same alignment.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘려요. 그다음엔 이 자세를 유지한 채 두 팔을 벽을 따라 W자에서 Y자로 천천히 올렸다 내리는 ‘벽 천사’를 5회 더해요.',
      en: 'Build up to 45 seconds. Then, holding this alignment, slide your arms up the wall from a W to a Y and back for 5 reps (wall angels).',
    },
    cues: { ko: ['엉덩이·날개뼈 벽에', '턱 당겨 뒤통수', '정수리는 위로', '이 느낌을 기억해요'], en: ['Glutes and blades back', 'Chin back, head to wall', 'Crown up', 'Remember this feeling'] },
    mistakes: {
      ko: [
        '뒤통수를 대려고 턱이 들림 → 시선은 정면에 두고 턱을 뒤로 당긴 만큼만 머리를 보내요. 안 닿으면 수건을 대요.',
        '허리를 과하게 젖혀 허리 뒤 공간이 커짐 → 아랫배를 살짝 당겨 갈비뼈를 내리고, 손바닥 하나 들어갈 공간만 남겨요.',
        '어깨를 으쓱 올리거나 가슴을 과하게 내밈 → 어깨를 귀에서 멀리 내리고, 갈비뼈는 내린 채 날개뼈만 살짝 모아요.',
        '무릎을 뒤로 잠그고 골반을 앞으로 내밈 → 무릎을 살짝 풀고, 체중을 발 한가운데에 실어요.',
      ],
      en: [
        'Chin lifting to reach the wall → Keep your eyes level and bring the head back only as far as the chin tuck allows; use a towel if needed.',
        'Over-arching the low back → Draw the lower belly in, let the ribs drop and leave just a hand’s space.',
        'Shrugging or puffing the chest out → Drop the shoulders away from your ears, keep the ribs down and only lightly draw the blades back.',
        'Locking the knees and pushing the hips forward → Soften the knees and keep your weight over the middle of your feet.',
      ],
    },
    why: {
      ko: '근육을 풀고 늘리기만 하면 몸은 금방 예전 자세로 돌아가요. 벽을 기준 삼아 머리·등·골반을 한 줄로 쌓는 감각을 익혀, 거북목과 굽은 등·어깨를 바른 정렬로 “저장”하는 마무리 동작이에요.',
      en: 'Release and stretching alone fade fast. Using the wall as a guide to stack your head, upper back and pelvis teaches your body the aligned position — a finisher that “saves” better posture for a forward head, rounded shoulders and a slumped upper back.',
    },
    muscles: { ko: '심부 목굽힘근, 중·하부 승모근, 복부 코어(자세 유지 근육)', en: 'Deep neck flexors, middle & lower trapezius, deep core (postural muscles)' },
    caution: { ko: '뒤통수를 벽에 댈 때 어지럽거나 팔이 저리면 바로 멈추세요.', en: 'Stop right away if you feel dizzy or your arms tingle as you bring your head to the wall.' },
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'back', dist: 0 }],
      keys: [
        merge(STAND, { neck: { flex: 16 }, head: { flex: -12 }, thorax: { flex: 12 }, lumbar: { flex: -4 } }, both({ scap: { prot: 3 } })),
        merge(STAND, { neck: { flex: 12 }, head: { flex: -8 } }, both({ scap: { prot: -1 } })),
        merge(WALL, { neck: { flex: -6 }, head: { flex: 6 } }, both({ scap: { prot: -2 } })),
      ],
      labels: [
        { ko: '평소 자세로 서기', en: 'Your usual posture' },
        { ko: '엉덩이·날개뼈 벽에', en: 'Glutes & blades to wall' },
        { ko: '턱 당겨 뒤통수 대기', en: 'Chin back, head to wall' },
      ],
      durations: [1.6, 1.4, 1.8],
      pauses: [0.8, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'neckTop', side: 'front', kind: 'work', r: 2.2 },
        { a: 'backTop', b: 'backMid', kind: 'work', r: 2.6 },
      ],
      trace: ['nose'],
    },
  },
];
