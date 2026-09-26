/**
 * 운동 라이브러리 · 무릎·하체 근력 (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { HANDS_ON_HIPS, SUPINE, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서만 쓰는 자세 ─────────────────────
// 서 있는 다리 각도는 발바닥이 바닥과 평행하도록 맞췄어요(발목 = 골반 기울기 − 고관절 + 무릎).

/** 가슴 앞 팔짱(아래팔이 수평으로 몸 앞을 가로지름) */
const FOLDED_ARMS: Pose = both({ sh: { flex: 25, rot: -80 }, el: 100 });
/** 벽 앉기: 상체는 벽에 세운 채, 발은 제자리. 고관절 h·무릎 k 에 맞춰 발목으로 발바닥을 평평하게 */
const wallSit = (h: number, k: number): Pose => merge(FOLDED_ARMS, { neck: { flex: -4 } }, both({ hip: { flex: h, abd: 4 }, kn: k, an: k - h }));

/** 바로 누워 왼무릎 세움(왼발바닥 평평), 오른다리는 펴서 바닥에 */
const SLR_BASE: Pose = merge(SUPINE, { hipL: { flex: 45 }, knL: 100, anL: -35, hipR: { flex: 0 }, knR: 2, anR: -18 });

/** 밴드 무릎 펴기: 오른무릎 30° 굽힘 / 끝까지 폄 — 왼발은 반 걸음 뒤에서 발끝만 댐 */
const TKE_BENT: Pose = merge(HANDS_ON_HIPS, { root: { pitch: 4 }, hipR: { flex: 18 }, knR: 30, anR: 16, hipL: { flex: -4 }, knL: 36, anL: 12 });
const TKE_STRAIGHT: Pose = merge(HANDS_ON_HIPS, { root: { pitch: 2 }, hipR: { flex: 2 }, knR: 0, anR: 0, hipL: { flex: -6 }, knL: 30, anL: 6 });

/** 계단 오르기(계단 높이 13 ≈ 20cm): 오른발 계단 위 / 앞으로 체중 이동(왼뒤꿈치 듦) / 올라서기(왼발은 계단 뒤에 띄움) */
const STEP_ARMS: Pose = both({ sh: { flex: 10, abd: 8 }, el: 20 });
const STEP_H = 13;
const STEP_ON: Pose = merge(STEP_ARMS, { root: { pitch: 6 }, hipR: { flex: 71 }, knR: 73, anR: 8, hipL: { flex: -5 }, knL: 4, anL: 15 });
const STEP_LEAN: Pose = merge(STEP_ARMS, both({ sh: { flex: 30 } }), { root: { pitch: 26 }, hipR: { flex: 79 }, knR: 71, anR: 18, hipL: { flex: 19 }, knL: 20, anL: -3 });
const STEP_TOP: Pose = merge(STEP_ARMS, { root: { pitch: 3 }, hipR: { flex: 3 }, knR: 0, anR: 0, hipL: { flex: -3 }, knL: 40, anL: 36 });

/** 뒤로 런지(오른다리 앞): 서기 / 왼발 뒤로 내딛기 / 뒷무릎 바닥 가까이 / 밀고 올라오며 왼발 앞으로 */
const RL_STAND: Pose = merge(HANDS_ON_HIPS, { root: { pitch: 1 }, hipR: { flex: 1 }, hipL: { flex: 1 } });
const RL_STEP: Pose = merge(HANDS_ON_HIPS, { root: { pitch: 6 }, hipR: { flex: 49 }, knR: 48, anR: 5, hipL: { flex: -21 }, knL: 40, anL: 31 });
const RL_BOTTOM: Pose = merge(HANDS_ON_HIPS, { root: { pitch: 10 }, hipR: { flex: 90 }, knR: 86, anR: 6, hipL: { flex: 1.5 }, knL: 88.7, anL: 42 });
const RL_UP: Pose = merge(HANDS_ON_HIPS, { root: { pitch: 3 }, hipR: { flex: 7 }, knR: 4, anR: 0, hipL: { flex: 15 }, knL: 55, anL: 33 });

/** 옆으로 런지(정면): 팔은 가슴 앞에 교차, 오른쪽으로 크게 딛고 오른엉덩이를 뒤로 빼며 앉음(왼다리는 쭉) */
const LL_ARMS: Pose = both({ sh: { flex: 45, rot: -60 }, el: 110 }); // 가슴 앞 X자 팔짱
const LL_STAND: Pose = merge(LL_ARMS, both({ hip: { abd: 3 } }));
const LL_WIDE: Pose = merge(LL_ARMS, both({ hip: { abd: 27 } }));
const LL_SIT: Pose = merge(LL_ARMS, {
  root: { pitch: 30 },
  neck: { flex: -15 },
  hipR: { flex: 107.7, hab: 21.2, rot: 7.8 },
  knR: 98.7,
  anR: 18.8,
  hipL: { flex: 33.8, abd: 63.8, rot: 28 },
  knL: 0,
  anL: -17.8,
});

/** 한 다리 데드리프트(오른발로 섬): 팔은 어깨 아래로 늘어뜨림 */
const rdlArms = (pitch: number): Pose => both({ sh: { flex: pitch + 4, abd: 6 }, el: 6 });
const RDL_STAND: Pose = merge(rdlArms(2), { root: { pitch: 2 }, hipR: { flex: 8 }, knR: 10, anR: 4, hipL: { flex: 2 }, knL: 55, anL: 5 });
const RDL_HALF: Pose = merge(rdlArms(42), { root: { pitch: 42 }, neck: { flex: -8 }, hipR: { flex: 54 }, knR: 18, anR: 6, hipL: { flex: 2 }, knL: 10, anL: -5 });
const RDL_BOTTOM: Pose = merge(rdlArms(78), { root: { pitch: 78 }, neck: { flex: -6 }, hipR: { flex: 94 }, knR: 24, anR: 8, hipL: { flex: 4 }, knL: 2, anL: 0 });

/** 수건 햄스트링: 왼다리는 바닥에 펴고, 두 손으로 수건 양끝을 잡아 오른발 쪽으로 팔을 뻗음 */
const TOWEL_BASE: Pose = merge(SUPINE, { hipL: { flex: 0 }, knL: 2, anL: -15 });
const towelArms = (flex: number, el: number): Pose => both({ sh: { flex, abd: 8 }, el });

export const LEGS_PLUS: Exercise[] = [
  // ─────────────────────────────────────────────
  {
    id: 'wall-sit',
    name: { ko: '벽에 기대 앉기', en: 'Wall sit' },
    phase: 'integrate',
    position: 'wall',
    regions: ['knee', 'glute'],
    targets: { kneeValgus: 0.5, kneeHyperext: 0.5, lateralShift: 0.3, lordosis: 0.3 },
    equipment: ['wall'],
    level: 2,
    dose: { kind: 'hold', sets: 3, value: 30, rest: 30 },
    desk: true,
    setup: {
      ko: [
        '벽에 등을 대고 서서 두 발을 골반 너비로 벌리고, 벽에서 한 걸음 반(약 45~60cm) 앞에 둬요. 발끝은 정면을 향해요.',
        '엉덩이·등·뒤통수를 벽에 붙이고, 배꼽을 살짝 당겨 허리와 벽 사이에 손바닥 한 장 두께만 남게 해요.',
        '두 팔은 가슴 앞에서 가볍게 팔짱을 껴요(손으로 허벅지를 짚지 않아요).',
      ],
      en: [
        'Stand with your back to a wall, feet hip-width apart and about 45–60 cm (a step and a half) out from it, toes pointing forward.',
        'Press your buttocks, back and head to the wall and draw your belly in slightly so only a flat hand fits behind your low back.',
        'Fold your arms loosely across your chest (no pushing on your thighs).',
      ],
    },
    steps: {
      ko: [
        '등을 벽에 붙인 채 3초에 걸쳐 천천히 미끄러져 내려가요.',
        '무릎이 90도(허벅지가 바닥과 평행)가 되는 높이에서 멈춰요. 무릎이 불편하거나 버거우면 60~70도(더 높은 자리)에서 멈춰도 돼요.',
        '무릎은 발목 바로 위에서 둘째 발가락 방향을 향하고, 체중은 발뒤꿈치와 발바닥 전체에 고르게 실어요.',
        '그 자세로 30초 버텨요. 버티는 동안 등과 뒤통수는 벽에서 떨어지지 않아요.',
        '벽을 따라 천천히 밀고 올라와 30초 쉬고, 모두 3세트 해요.',
      ],
      en: [
        'Keeping your back on the wall, slide down slowly over 3 seconds.',
        'Stop when your knees reach 90° (thighs parallel to the floor). If your knees complain or it’s too hard, stop higher, at 60–70°.',
        'Keep your knees right over your ankles, pointing toward your second toes, with weight spread over your heels and whole feet.',
        'Hold for 30 seconds without letting your back or head leave the wall.',
        'Slowly push back up the wall, rest 30 seconds, and do 3 sets in total.',
      ],
    },
    breathing: {
      ko: '내려갈 때 코로 들이마시고, 버티는 동안에는 “후—” 하고 길게 내쉬기를 반복해요. 힘들수록 숨을 참기 쉬우니 숫자를 소리 내어 세어요.',
      en: 'Inhale through your nose as you slide down, then keep breathing out long and slow through the hold. Counting out loud stops you holding your breath.',
    },
    feel: {
      ko: '허벅지 앞쪽이 뜨겁게 타는 느낌과 함께 엉덩이에도 힘이 들어가면 정답이에요. 무릎뼈 주변이 찌르듯 아프면 바로 올라와서 더 높은 자세로 바꾸세요.',
      en: 'A strong burn in the front of your thighs with some work in your glutes. Sharp pain around the kneecap means come up straight away and try a higher position.',
    },
    easier: {
      ko: '무릎을 45~60도만 굽혀 높게 앉거나, 버티는 시간을 15~20초로 줄여요. 그래도 무릎이 불편하면 ‘의자 앉았다 일어서기’로 대신하세요.',
      en: 'Sit higher with only 45–60° of knee bend, or cut the hold to 15–20 seconds. If your knees still object, do sit-to-stands instead.',
    },
    harder: {
      ko: '버티는 시간을 45초까지 늘리거나, 무릎 사이에 쿠션을 끼우고 살짝 조이며 버텨요. 익숙해지면 ‘스플릿 스쿼트’로 넘어가세요.',
      en: 'Build the hold to 45 seconds, or squeeze a cushion gently between your knees while you hold. Then progress to split squats.',
    },
    cues: { ko: ['등은 벽에 착', '무릎은 발목 위', '뒤꿈치로 버텨요', '숨은 길게 후—'], en: ['Back flat on the wall', 'Knees over ankles', 'Push through your heels', 'Long breath out'] },
    mistakes: {
      ko: [
        '무릎이 발끝보다 앞으로 나감 → 발을 벽에서 5~10cm 더 멀리 옮겨 무릎이 발목 바로 위에 오게 해요.',
        '무릎이 안쪽으로 모임 → 무릎이 둘째 발가락을 향하도록 살짝 바깥으로 밀어요.',
        '허리가 벽에서 뜨며 젖혀짐 → 배꼽을 당기고 허리를 벽 쪽으로 가볍게 눌러요.',
        '손으로 허벅지를 짚고 버팀 → 팔짱을 끼고 다리 힘만으로 버텨요.',
      ],
      en: [
        'Knees drifting past the toes → Walk your feet 5–10 cm further from the wall so your knees sit right over your ankles.',
        'Knees caving in → Press them gently out so they point toward your second toes.',
        'Low back peeling off and arching → Draw your belly in and lightly press your low back toward the wall.',
        'Leaning on your thighs with your hands → Fold your arms and let your legs do the work.',
      ],
    },
    why: {
      ko: '관절을 움직이지 않고 버티는 등척성 운동이라 자세를 쉽게 통제하면서 허벅지 앞 근육의 지구력을 길러요. 무릎을 발목 위에 두는 정렬 연습도 돼서 무릎이 안으로 모이거나 뒤로 꺾여 서는 습관을 잡는 데 좋아요.',
      en: 'A static (isometric) hold that builds quad endurance in an easy-to-control position, while teaching you to stack your knees over your ankles instead of letting them cave in or lock back.',
    },
    muscles: { ko: '대퇴사두근, 대둔근, 복부(허리 받침)', en: 'Quadriceps, gluteus maximus, abdominals (low-back support)' },
    caution: {
      ko: '무릎 앞쪽에 날카로운 통증이 생기면 더 높이 앉거나 멈추세요. 혈압이 높다면 숨을 절대 참지 말고 버티는 시간을 짧게 해요.',
      en: 'If you get sharp pain at the front of the knee, sit higher or stop. If you have high blood pressure, never hold your breath and keep the holds short.',
    },
    avoid: ['kneePain', 'kneeSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'wall', wall: 'back', dist: 0 }],
      keys: [wallSit(35, 10), wallSit(58, 49), wallSit(90, 90)],
      labels: [
        { ko: '벽에 등 대고 서기', en: 'Back on the wall' },
        { ko: '벽 타고 내려가기', en: 'Slide down' },
        { ko: '무릎 90도 버티기', en: 'Hold at 90°' },
      ],
      durations: [1.6, 1.4, 2.4],
      pauses: [0.6, 0.2, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
      ],
      trace: ['pelvis'],
    },
    coach: {
      view: 'side',
      metric: 'kneeAngle',
      mode: 'hold',
      target: 115,
      dir: -1,
      hint: { ko: '옆에서 벽과 온몸이 보이게 2~3m 떨어진 곳에 휴대폰을 세워 주세요', en: 'Place the phone 2–3 m to your side so you and the wall are fully visible' },
      more: { ko: '조금 더 내려가요', en: 'Slide a little lower' },
      good: { ko: '좋아요, 그대로 버텨요', en: 'Great, hold it there' },
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'straight-leg-raise',
    name: { ko: '누워서 다리 곧게 들기', en: 'Straight leg raise' },
    phase: 'activate',
    position: 'supine',
    regions: ['knee', 'hip'],
    targets: { kneePain: 0.7, kneeFlexed: 0.5 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 5, holdSec: 2, perSide: true, rest: 20 },
    setup: {
      ko: [
        '매트에 바로 누워 왼무릎을 세우고 왼발바닥을 바닥에 평평하게 둬요. 오른다리는 쭉 펴서 바닥에 내려놔요.',
        '두 팔은 몸 옆에 손바닥이 바닥을 향하게 두고, 허리와 바닥 사이는 손가락 끝이 겨우 들어갈 정도로 자연스럽게 둬요.',
        '오른발끝을 몸 쪽으로 당겨 발끝이 천장을 향하게 해요.',
      ],
      en: [
        'Lie on your back on a mat with your left knee bent and left foot flat. Stretch your right leg out straight on the floor.',
        'Rest your arms by your sides, palms down, keeping a natural small gap under your low back — just enough for your fingertips.',
        'Pull your right toes toward you so they point at the ceiling.',
      ],
    },
    steps: {
      ko: [
        '오른쪽 허벅지 앞에 힘을 꽉 줘 무릎 뒤를 바닥 쪽으로 눌러요. 무릎뼈가 살짝 위로 끌려 올라가요.',
        '허벅지 힘을 유지한 채 2초에 걸쳐 오른다리를 곧게 들어 올려요.',
        '오른무릎이 왼무릎 높이에 올 때까지(두 허벅지가 나란하게, 약 45도) 들고 2초 멈춰요.',
        '3초에 걸쳐 천천히 내려 뒤꿈치가 바닥에 살짝 닿으면 잠깐 힘을 풀어요.',
        '10회 반복한 뒤 다리를 바꿔 왼다리를 들어요.',
      ],
      en: [
        'Tighten the front of your right thigh hard, pressing the back of the knee toward the floor — the kneecap glides up slightly.',
        'Keeping the thigh tight, lift the straight right leg over 2 seconds.',
        'Lift until your right knee is level with your left knee (thighs parallel, about 45°) and pause for 2 seconds.',
        'Lower slowly over 3 seconds; when the heel lightly touches down, relax for a moment.',
        'Do 10 reps, then switch and lift the left leg.',
      ],
    },
    breathing: {
      ko: '다리를 들어 올릴 때 입으로 “후—” 내쉬고, 천천히 내릴 때 코로 들이마셔요.',
      en: 'Exhale through your mouth as you lift, inhale through your nose as you slowly lower.',
    },
    feel: {
      ko: '오른쪽 허벅지 앞, 특히 무릎 바로 위 안쪽이 단단해지고 골반 앞쪽이 살짝 힘들면 정답이에요. 허리가 뜨거나 뻐근하면 들어 올리는 높이를 낮추세요.',
      en: 'The front of your right thigh — especially just above the inner knee — feels firm, with some effort at the front of the hip. If your low back lifts or aches, don’t lift as high.',
    },
    easier: {
      ko: '들어 올리는 높이를 20~30cm로 줄이거나, 다리는 들지 말고 허벅지만 5초 조였다 푸는 ‘허벅지 힘주기’부터 연습해요.',
      en: 'Lift only 20–30 cm, or start with quad sets — tighten the thigh for 5 seconds and relax without lifting the leg.',
    },
    harder: {
      ko: '위에서 5초 버티거나 발목에 0.5~1kg 모래주머니를 차요. 익숙해지면 ‘밴드로 무릎 끝까지 펴기’나 ‘계단 오르기’로 넘어가세요.',
      en: 'Hold 5 seconds at the top or add a 0.5–1 kg ankle weight. Then progress to band terminal knee extensions or step-ups.',
    },
    cues: { ko: ['허벅지 꽉 조여요', '무릎은 쭉 편 채로', '무릎 높이까지', '3초 천천히 내려요'], en: ['Squeeze your thigh', 'Keep the knee straight', 'Up to knee height', 'Lower for three'] },
    mistakes: {
      ko: [
        '들면서 무릎이 굽음 → 들기 전에 허벅지를 먼저 조여 무릎을 완전히 편 뒤에 들어요.',
        '허리가 뜨면서 젖혀짐 → 배꼽을 살짝 당겨 허리를 바닥 쪽에 두고, 높이를 낮춰요.',
        '반동으로 휙 들고 툭 떨어뜨림 → 2초 들고, 2초 멈추고, 3초 내려요.',
        '다리가 바깥으로 돌아감 → 무릎뼈와 발끝이 천장을 향하게 유지해요.',
      ],
      en: [
        'Knee bending as you lift → Tighten the thigh and fully straighten the knee before the leg leaves the floor.',
        'Low back arching off the mat → Draw your belly in slightly, keep your back down and lift lower.',
        'Swinging up and dropping down → 2 seconds up, 2-second pause, 3 seconds down.',
        'Leg rolling outward → Keep your kneecap and toes pointing at the ceiling.',
      ],
    },
    why: {
      ko: '무릎을 구부리지 않고 허벅지 앞 근육, 특히 무릎을 끝까지 펴 주는 안쪽 부분을 깨워요. 무릎이 끝까지 펴지지 않거나 무릎이 불편해 스쿼트가 어려운 분이 부담 없이 시작하기 좋아요.',
      en: 'Wakes up the quads — especially the part that finishes straightening the knee — without bending the knee, so it’s a comfortable starting point if your knees don’t fully straighten or squats bother them.',
    },
    muscles: { ko: '대퇴사두근(대퇴직근·내측광근), 장요근, 복부(골반 고정)', en: 'Quadriceps (rectus femoris, vastus medialis), iliopsoas, abdominals (pelvic control)' },
    caution: { ko: '허리에 통증이 생기면 높이를 낮추고, 그래도 아프면 멈추세요.', en: 'If your low back hurts, lift lower; stop if it still hurts.' },
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [SLR_BASE, merge(SLR_BASE, { knR: 0, anR: 4 }), merge(SLR_BASE, { hipR: { flex: 45 }, knR: 0, anR: 4 })],
      labels: [
        { ko: '왼무릎 세우고 눕기', en: 'Left knee bent' },
        { ko: '허벅지 조이기', en: 'Tighten the thigh' },
        { ko: '무릎 높이까지 들기', en: 'Lift to knee height' },
      ],
      durations: [1, 2, 3],
      pauses: [0.5, 0.5, 2],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
        { a: 'waist', b: 'hipR', side: 'front', kind: 'work', r: 2.4 },
      ],
      trace: ['heelR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'terminal-knee-extension',
    name: { ko: '밴드로 무릎 끝까지 펴기', en: 'Band terminal knee extension' },
    phase: 'activate',
    position: 'standing',
    regions: ['knee'],
    targets: { kneeFlexed: 0.7, kneePain: 0.5, kneeValgus: 0.3 },
    equipment: ['band'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 3, holdSec: 2, perSide: true, rest: 20 },
    setup: {
      ko: [
        '밴드를 무릎 높이쯤의 튼튼한 기둥이나 무거운 가구 다리에 묶고, 고리를 오른무릎 바로 뒤(오금)에 걸어요.',
        '고정점을 마주 보고 뒤로 물러나 밴드가 팽팽해지게 서요. 오른발은 바닥에 평평하게, 왼발은 반 걸음 뒤에서 발끝만 가볍게 대요.',
        '밴드에 끌려 오른무릎이 20~30도 굽은 상태에서 시작해요. 손은 허리에 두고 상체는 곧게 세워요.',
      ],
      en: [
        'Tie a band to a sturdy post or heavy furniture leg at about knee height and loop it behind your right knee.',
        'Face the anchor and step back until the band is taut. Right foot flat; left foot half a step back with only the toes touching.',
        'Let the band draw your right knee into a 20–30° bend to start. Hands on hips, torso tall.',
      ],
    },
    steps: {
      ko: [
        '오른발바닥 전체로 바닥을 누른 채, 무릎 뒤로 밴드를 밀어내며 1초에 걸쳐 무릎을 끝까지 펴요.',
        '무릎이 곧게 펴지면 허벅지 앞(특히 무릎 위 안쪽)을 꽉 조여 2초 버텨요. 무릎이 뒤로 꺾일 만큼 밀지는 않아요.',
        '2초에 걸쳐 밴드에 버티듯 천천히 다시 20~30도 굽혀요.',
        '발뒤꿈치는 계속 바닥에 붙이고, 골반과 상체는 앞뒤로 흔들리지 않게 해요.',
        '12회 반복한 뒤 밴드를 왼무릎에 옮겨 걸고 해요.',
      ],
      en: [
        'With the whole right foot pressing down, push the band back with the back of your knee and straighten fully over 1 second.',
        'Once straight, squeeze the front of the thigh (especially just above the inner knee) for 2 seconds — straight, not snapped back past straight.',
        'Take 2 seconds to bend back to 20–30°, resisting the band.',
        'Keep your heel down and your pelvis and trunk still — no rocking.',
        'Do 12 reps, then move the band to the left knee.',
      ],
    },
    breathing: {
      ko: '무릎을 펴며 조일 때 내쉬고, 천천히 굽힐 때 들이마셔요.',
      en: 'Exhale as you straighten and squeeze, inhale as you slowly bend.',
    },
    feel: {
      ko: '무릎 바로 위 안쪽의 볼록한 근육(내측광근)이 단단하게 뭉치면 정답이에요. 무릎 뒤가 끼이듯 아프거나 무릎이 뒤로 꺾이는 느낌이 들면 밴드 강도를 낮추세요.',
      en: 'The teardrop-shaped muscle just above the inner knee (vastus medialis) firms up. If the back of the knee pinches or the knee feels like it’s bending backward, use a lighter band.',
    },
    easier: {
      ko: '가벼운 밴드를 쓰거나 고정점에 반 걸음 가까이 서서 장력을 줄여요. 밴드가 없으면 ‘누워서 다리 곧게 들기’로 대신해요.',
      en: 'Use a lighter band or stand half a step closer to the anchor. No band? Do straight leg raises instead.',
    },
    harder: {
      ko: '더 강한 밴드를 쓰거나, 끝에서 5초 버티거나, 왼발을 바닥에서 살짝 들고 한 다리로 서서 해요.',
      en: 'Use a stronger band, hold 5 seconds at the end, or lift your left foot and do it standing on one leg.',
    },
    cues: { ko: ['무릎을 뒤로 쭉', '허벅지 꽉 2초', '뒤꿈치는 바닥에', '천천히 굽혀요'], en: ['Press the knee back straight', 'Squeeze for two', 'Heel stays down', 'Bend slowly'] },
    mistakes: {
      ko: [
        '엉덩이를 뒤로 빼서 무릎을 폄 → 골반은 제자리에 두고 무릎만 뒤로 밀어 펴요.',
        '무릎을 뒤로 꺾이게 잠금 → 곧게 펴진 지점에서 멈추고 허벅지 조이기로 버텨요.',
        '발뒤꿈치가 들림 → 발바닥 전체, 특히 뒤꿈치로 바닥을 누른 채 해요.',
        '밴드에 끌려 툭 굽혀짐 → 2초에 걸쳐 버티듯 천천히 굽혀요.',
      ],
      en: [
        'Sticking the hips back to straighten → Keep the pelvis still and move only the knee back.',
        'Snapping the knee back into a lock → Stop at straight and hold with a thigh squeeze instead.',
        'Heel lifting → Keep the whole foot, especially the heel, pressed down.',
        'Letting the band yank the knee forward → Resist it and bend slowly over 2 seconds.',
      ],
    },
    why: {
      ko: '무릎을 마지막 몇 도까지 완전히 펴 주는 힘을 길러요. 오래 앉아 무릎이 살짝 굽은 채 서는 습관이 있거나, 걷거나 계단을 내려갈 때 무릎이 불안한 분께 좋아요.',
      en: 'Trains the last few degrees of knee straightening — great if you tend to stand with slightly bent knees after long sitting, or your knee feels unsteady walking or going downstairs.',
    },
    muscles: { ko: '대퇴사두근(특히 내측광근), 대둔근', en: 'Quadriceps (especially vastus medialis), gluteus maximus' },
    caution: {
      ko: '무릎 뒤가 붓거나 저리면 멈추세요. 무릎이 뒤로 꺾이는 체형이라면 “끝까지”가 아니라 “곧게”까지만 펴요.',
      en: 'Stop if the back of the knee swells or tingles. If your knees tend to hyperextend, straighten only to straight — never past it.',
    },
    avoid: ['kneeSevere'],
    anim: {
      view: 90,
      anchor: ['heelR', 'toeR'],
      props: [{ kind: 'band', at: 'knR', off: [0, 0, 40], key: 0 }],
      keys: [TKE_BENT, TKE_STRAIGHT],
      labels: [
        { ko: '무릎 살짝 굽히기', en: 'Knee softly bent' },
        { ko: '끝까지 펴고 2초', en: 'Straighten, hold 2 s' },
      ],
      durations: [1, 2],
      pauses: [0.5, 2],
      focus: [{ a: 'hipR', b: 'knR', side: 'front', kind: 'work', from: 0.3, to: 0.92 }],
      trace: ['knR'],
      zoom: 1.1,
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'step-up',
    name: { ko: '계단 오르기', en: 'Step-up' },
    phase: 'integrate',
    position: 'standing',
    regions: ['glute', 'knee', 'hip'],
    targets: { kneeValgus: 0.7, pelvicTilt: 0.5, lateralShift: 0.4, kneePain: 0.3 },
    equipment: [],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 5, perSide: true, rest: 30 },
    setup: {
      ko: [
        '계단이나 튼튼한 받침(높이 15~20cm, 발 전체가 올라갈 만큼 깊은 것) 앞에 서요. 처음엔 난간이나 벽을 한 손으로 잡아도 돼요.',
        '오른발바닥 전체를 계단 위에 올려요. 발뒤꿈치가 계단 밖으로 나가지 않게 해요.',
        '오른무릎은 둘째 발가락 방향, 골반은 수평, 상체는 곧게 세우고 왼발은 바닥에 둬요.',
      ],
      en: [
        'Stand facing a stair or sturdy box (15–20 cm high, deep enough for your whole foot). Hold a rail or wall with one hand at first if you like.',
        'Place your whole right foot on the step — heel fully on, not hanging off.',
        'Point your right knee toward your second toe, keep your pelvis level and torso tall, left foot on the floor.',
      ],
    },
    steps: {
      ko: [
        '상체를 살짝 앞으로 숙여 코가 오른무릎 위에 오도록 체중을 앞발로 옮겨요.',
        '오른발뒤꿈치로 계단을 밀며 2초에 걸쳐 올라서요. 뒷발로 바닥을 차고 올라가지 않아요.',
        '위에서 오른쪽 엉덩이와 무릎을 완전히 펴 바르게 서고, 왼발은 계단 뒤에 살짝 띄워 둬요.',
        '오른다리로 버티며 3초에 걸쳐 무릎을 굽혀 왼발을 바닥에 살며시 내려놔요.',
        '10회 반복한 뒤 발을 바꿔 왼발을 계단에 올리고 해요.',
      ],
      en: [
        'Lean slightly forward so your nose is over your right knee, shifting weight onto the front foot.',
        'Drive through your right heel and stand up over 2 seconds — don’t push off the floor with the back foot.',
        'At the top, fully straighten your right hip and knee and stand tall, left foot hovering just behind the step.',
        'Control it with the right leg as you bend the knee over 3 seconds and set your left foot softly back on the floor.',
        'Do 10 reps, then switch and put the left foot on the step.',
      ],
    },
    breathing: { ko: '올라설 때 내쉬고, 천천히 내려올 때 들이마셔요.', en: 'Exhale as you step up, inhale as you lower slowly.' },
    feel: {
      ko: '계단 위 다리의 엉덩이와 허벅지 앞이 함께 힘들면 정답이에요. 무릎 앞쪽이 찌르듯 아프면 더 낮은 계단(10cm)으로 바꾸세요.',
      en: 'The glute and the front of the thigh on the step leg both work. Sharp pain at the front of the knee means switch to a lower step (10 cm).',
    },
    easier: {
      ko: '10cm 정도의 낮은 계단을 쓰고 난간을 잡아요. 그래도 버거우면 ‘의자 앉았다 일어서기’로 다리 힘부터 길러요.',
      en: 'Use a low 10 cm step and hold the rail. Still too hard? Build leg strength with sit-to-stands first.',
    },
    harder: {
      ko: '계단 높이를 무릎 높이 가까이(30~40cm) 올리거나, 내려오는 시간을 5초로 늘리거나, 양손에 물병을 들어요.',
      en: 'Raise the step toward knee height (30–40 cm), take 5 seconds to lower, or hold a water bottle in each hand.',
    },
    cues: { ko: ['발바닥 전체 올려요', '뒤꿈치로 밀어요', '무릎은 발끝 방향', '3초 천천히 내려요'], en: ['Whole foot on the step', 'Drive through the heel', 'Knee over the toes', 'Lower for three'] },
    mistakes: {
      ko: [
        '뒷발로 바닥을 차고 올라감 → 뒷발은 발끝만 대고, 앞발 뒤꿈치로 밀어 올라가요.',
        '올라설 때 무릎이 안쪽으로 모임 → 무릎이 둘째 발가락을 향하게 하고, 계단 높이를 낮춰요.',
        '위에서 골반이 한쪽으로 처지거나 틀어짐 → 양쪽 골반뼈에 손을 얹고 수평을 확인하며 해요.',
        '내려올 때 털썩 떨어짐 → 앞다리로 버티며 3초를 세고 내려와요.',
      ],
      en: [
        'Pushing off with the back foot → Keep only the back toes touching and drive up through the front heel.',
        'Knee caving in as you rise → Aim the knee at your second toe and use a lower step.',
        'Hip dropping or twisting at the top → Rest your hands on your hip bones and keep them level.',
        'Dropping down on the way back → Control it with the front leg and count 3 seconds down.',
      ],
    },
    why: {
      ko: '한 다리로 몸을 들어 올리고 천천히 내려놓으며 엉덩이·허벅지 힘과 무릎 정렬을 함께 길러요. 계단 오르내리기가 편해지고, 좌우 다리 힘 차이와 한쪽으로 처지는 골반을 바로잡는 데 좋아요.',
      en: 'Lifting and lowering your body on one leg builds glute and thigh strength and knee control together — making stairs easier and evening out side-to-side strength and a dropping hip.',
    },
    muscles: { ko: '대둔근, 대퇴사두근, 중둔근(골반 수평), 종아리', en: 'Gluteus maximus, quadriceps, gluteus medius (level pelvis), calves' },
    caution: {
      ko: '미끄럽지 않은 튼튼한 계단을 쓰고, 균형이 불안하면 반드시 난간을 잡으세요.',
      en: 'Use a sturdy, non-slip step, and always hold a rail if your balance feels shaky.',
    },
    avoid: ['kneeSevere', 'balance'],
    anim: {
      view: 90,
      anchor: ['heelR', 'toeR'],
      ground: { joints: ['heelR', 'toeR'], y: STEP_H },
      props: [{ kind: 'step', at: 'heelR', key: 0, off: [0, 0, 9], size: [30, 0, 20] }],
      keys: [STEP_ON, STEP_LEAN, STEP_TOP],
      labels: [
        { ko: '오른발 계단에 올리기', en: 'Right foot on the step' },
        { ko: '체중을 앞발로', en: 'Weight onto the front foot' },
        { ko: '뒤꿈치로 밀어 서기', en: 'Drive up, stand tall' },
      ],
      durations: [1, 1.8, 3],
      pauses: [0.5, 0.2, 0.8],
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
      ],
      trace: ['pelvis'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'reverse-lunge',
    name: { ko: '뒤로 런지', en: 'Reverse lunge' },
    phase: 'integrate',
    position: 'standing',
    regions: ['glute', 'knee', 'hip'],
    targets: { kneeValgus: 0.6, pelvicTilt: 0.5, lateralShift: 0.4, lordosis: 0.3 },
    equipment: [],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, perSide: true, rest: 30 },
    setup: {
      ko: [
        '두 발을 골반 너비로 벌리고 바르게 서서 두 손을 허리에 얹어요.',
        '체중을 오른발 가운데(뒤꿈치와 엄지발가락 뿌리 사이)에 조금 더 싣고, 배꼽을 살짝 당겨 몸통을 단단히 해요.',
        '시선은 3~4m 앞 바닥에 두고 가슴을 펴요.',
      ],
      en: [
        'Stand tall with feet hip-width apart and hands on your hips.',
        'Shift a little more weight onto the middle of your right foot (between heel and big-toe base) and draw your belly in to brace.',
        'Look at the floor 3–4 m ahead and keep your chest open.',
      ],
    },
    steps: {
      ko: [
        '왼발을 뒤로 크게 한 걸음(약 60~80cm) 빼며 발끝으로 가볍게 딛어요.',
        '상체를 곧게 세운 채 2초에 걸쳐 두 무릎을 굽혀, 뒷무릎이 바닥에서 5cm쯤 뜬 곳까지 수직으로 내려가요.',
        '가장 낮은 곳에서 앞무릎은 90도로 발목 바로 위에서 둘째 발가락을 향하고, 체중은 대부분 앞발에 있어요.',
        '앞발 뒤꿈치로 바닥을 밀어 일어서며 왼발을 앞으로 가져와 처음 자리에 모아요.',
        '8회 반복한 뒤 다리를 바꿔 오른발을 뒤로 빼요.',
      ],
      en: [
        'Take a big step back with your left foot (about 60–80 cm), landing lightly on the ball of the foot.',
        'Staying tall, bend both knees over 2 seconds and lower straight down until the back knee hovers about 5 cm off the floor.',
        'At the bottom, the front knee is at 90°, right over the ankle and pointing toward the second toe, with most of your weight on the front foot.',
        'Push through the front heel to stand and bring the left foot forward to meet the right.',
        'Do 8 reps, then switch and step back with the right foot.',
      ],
    },
    breathing: { ko: '뒤로 딛고 내려갈 때 들이마시고, 앞발로 밀고 올라올 때 내쉬어요.', en: 'Inhale as you step back and lower, exhale as you drive back up.' },
    feel: {
      ko: '앞다리 엉덩이와 허벅지 앞이 주로 힘들고, 뒷다리 골반 앞쪽은 살짝 늘어나면 정답이에요. 무릎이 찌르듯 아프면 내려가는 깊이를 절반으로 줄이세요.',
      en: 'Mostly the front-leg glute and thigh work, with a light stretch at the front of the back hip. Sharp knee pain means go only half as deep.',
    },
    easier: {
      ko: '의자 등받이나 벽을 한 손으로 잡고 절반 깊이까지만 내려가요. 그래도 버거우면 ‘계단 오르기’나 ‘의자 앉았다 일어서기’로 다리 힘을 먼저 길러요.',
      en: 'Hold a chair back or wall with one hand and lower only halfway. Still too hard? Build leg strength with step-ups or sit-to-stands first.',
    },
    harder: {
      ko: '양손에 물병이나 덤벨을 들거나, 올라오며 뒷무릎을 골반 높이까지 끌어올려 한 다리로 1초 서요.',
      en: 'Hold a water bottle or dumbbell in each hand, or drive the back knee up to hip height as you rise and balance on one leg for a second.',
    },
    cues: { ko: ['뒤로 크게 한 걸음', '수직으로 내려가요', '앞무릎은 발목 위', '앞발 뒤꿈치로 밀어요'], en: ['Big step back', 'Drop straight down', 'Front knee over the ankle', 'Drive through the front heel'] },
    mistakes: {
      ko: [
        '보폭이 좁아 앞무릎이 발끝보다 한참 나감 → 한 걸음 더 크게 빼서 앞 정강이가 거의 수직이 되게 해요.',
        '앞무릎이 안쪽으로 모임 → 무릎을 둘째 발가락 쪽으로 살짝 바깥으로 밀어요.',
        '상체가 앞으로 쏟아지거나 허리가 젖혀짐 → 배꼽을 당기고 머리부터 골반까지 곧게 세운 채 내려가요.',
        '뒷무릎이 바닥에 쿵 닿음 → 바닥 5cm 위에서 멈추고, 필요하면 무릎 아래에 쿠션을 깔아요.',
      ],
      en: [
        'Stride too short so the front knee shoots past the toes → Step back further so the front shin is nearly vertical.',
        'Front knee caving in → Press it gently out toward your second toe.',
        'Torso tipping forward or back arching → Brace your belly and keep head-to-pelvis tall as you lower.',
        'Back knee slamming the floor → Stop 5 cm above it, and put a cushion under the knee if needed.',
      ],
    },
    why: {
      ko: '뒤로 딛는 런지는 앞으로 딛는 런지보다 무릎 부담이 적고 균형 잡기가 쉬워요. 한 다리씩 엉덩이·허벅지 힘을 길러 좌우 차이와 골반 틀어짐을 바로잡고, 뒷다리 고관절 앞쪽도 늘려 줘요.',
      en: 'Stepping back is easier on the knees and easier to balance than a forward lunge. It builds each leg’s glutes and thighs to even out left–right gaps and pelvic shifts, while opening the front of the back hip.',
    },
    muscles: {
      ko: '대둔근, 대퇴사두근, 중둔근·내전근(무릎·골반 안정), 뒷다리 장요근(늘어남)',
      en: 'Gluteus maximus, quadriceps, gluteus medius and adductors (knee and pelvic control), back-leg iliopsoas (lengthening)',
    },
    caution: {
      ko: '무릎이 아프거나 균형이 불안하면 벽을 잡고 깊이를 줄이세요. 무릎·발목 수술을 받았다면 전문가와 먼저 상의하세요.',
      en: 'If your knee hurts or your balance feels shaky, hold a wall and go shallower. After knee or ankle surgery, check with your clinician first.',
    },
    avoid: ['kneePain', 'kneeSevere', 'balance'],
    anim: {
      view: 90,
      anchor: ['heelR', 'toeR'],
      ground: { joints: ['heelR', 'toeR'], y: 0 },
      keys: [RL_STAND, RL_STEP, RL_BOTTOM, RL_UP],
      labels: [
        { ko: '바르게 서기', en: 'Stand tall' },
        { ko: '왼발 뒤로 크게', en: 'Big step back' },
        { ko: '뒷무릎 내리기', en: 'Lower the back knee' },
        { ko: '앞발로 밀어 서기', en: 'Drive up to stand' },
      ],
      durations: [1.2, 1.4, 1.6, 1],
      pauses: [0.4, 0.1, 0.6, 0.3],
      holdKey: 2,
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
        { a: 'waist', b: 'hipL', side: 'front', kind: 'stretch', r: 2.4 },
      ],
      trace: ['knL'],
    },
    coach: {
      view: 'side',
      metric: 'kneeAngle',
      mode: 'reps',
      rest: 155,
      peak: 110,
      dir: -1,
      hint: { ko: '옆에서 온몸이 보이게 2~3m 떨어진 곳에 휴대폰을 세워 주세요', en: 'Place the phone 2–3 m to your side so your whole body is visible' },
      more: { ko: '조금 더 깊게 내려가요', en: 'Lower a little deeper' },
      good: { ko: '좋아요!', en: 'Good depth!' },
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'lateral-lunge',
    name: { ko: '옆으로 런지', en: 'Lateral lunge' },
    phase: 'integrate',
    position: 'standing',
    regions: ['hip', 'glute', 'knee'],
    targets: { lateralShift: 0.5, kneeValgus: 0.5, pelvicTilt: 0.4, stiffness: 0.3 },
    equipment: [],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, holdSec: 1, perSide: true, rest: 30 },
    setup: {
      ko: [
        '두 발을 골반 너비로 벌리고 발끝은 정면(또는 살짝 바깥)을 향하게 서요.',
        '두 팔은 가슴 앞에서 X자로 교차해 얹고, 배꼽을 살짝 당겨 등을 곧게 펴요.',
      ],
      en: [
        'Stand with feet hip-width apart, toes pointing forward (or slightly out).',
        'Cross your arms over your chest, draw your belly in and lengthen your back.',
      ],
    },
    steps: {
      ko: [
        '오른발을 옆으로 크게(어깨너비의 약 2배) 내딛고, 두 발끝이 모두 앞을 향하게 딛어요.',
        '엉덩이를 뒤로 빼며 2초에 걸쳐 오른무릎을 굽혀 앉아요. 상체는 등을 곧게 편 채 30~40도 앞으로 숙여요.',
        '오른무릎은 오른발 둘째 발가락 방향, 왼다리는 쭉 펴고 왼발바닥 전체를 바닥에 붙여요. 왼쪽 허벅지 안쪽이 당기면 1초 멈춰요.',
        '오른발바닥 전체로 바닥을 밀어 처음 자리로 돌아와 두 발을 모아요.',
        '8회 반복한 뒤 왼쪽으로 내딛어요.',
      ],
      en: [
        'Take a big step out to the right (about twice shoulder width), both feet pointing forward.',
        'Push your hips back and bend the right knee over 2 seconds, leaning your chest forward 30–40° with a flat back.',
        'Right knee points over the right second toe; the left leg stays straight with the whole left foot on the floor. Pause 1 second when the left inner thigh stretches.',
        'Push through the whole right foot to return to the start and bring your feet together.',
        'Do 8 reps, then step to the left.',
      ],
    },
    breathing: { ko: '옆으로 앉을 때 들이마시고, 밀고 돌아올 때 내쉬어요.', en: 'Inhale as you sit into the side, exhale as you push back.' },
    feel: {
      ko: '굽힌 다리의 엉덩이와 허벅지가 힘들고, 편 다리의 허벅지 안쪽이 시원하게 늘어나면 정답이에요. 무릎 안쪽이 찌르거나 사타구니가 날카롭게 아프면 보폭과 깊이를 줄이세요.',
      en: 'The bent leg’s glute and thigh work while the straight leg’s inner thigh stretches. Sharp pain inside the knee or in the groin means take a narrower, shallower lunge.',
    },
    easier: {
      ko: '보폭을 줄이고 절반 깊이까지만 앉아요. 앞에 의자를 두고 등받이를 두 손으로 잡아도 돼요.',
      en: 'Take a narrower step and sit only halfway down. You can hold the back of a chair in front of you with both hands.',
    },
    harder: {
      ko: '가슴 앞에 물병이나 덤벨을 안고 하거나, 가장 깊은 자세에서 3초 버텨요.',
      en: 'Hug a water bottle or dumbbell at your chest, or pause 3 seconds at the bottom.',
    },
    cues: { ko: ['옆으로 크게 딛어요', '엉덩이는 뒤로', '무릎은 발끝 방향', '반대 다리는 쭉'], en: ['Big step to the side', 'Hips back', 'Knee over the toes', 'Other leg long'] },
    mistakes: {
      ko: [
        '무릎만 앞으로 나가고 엉덩이는 그대로 → 의자에 앉듯 엉덩이를 먼저 뒤로 빼요.',
        '굽힌 무릎이 안쪽으로 모임 → 무릎을 둘째 발가락 쪽으로 살짝 바깥으로 밀어요.',
        '편 다리의 발바닥이 들림 → 보폭을 조금 줄이고 두 발바닥 전체로 바닥을 눌러요.',
        '등이 둥글게 말림 → 가슴을 펴고 꼬리뼈부터 정수리까지 일직선으로 숙여요.',
      ],
      en: [
        'Knee shooting forward while the hips stay put → Push your hips back first, as if sitting into a chair.',
        'Bent knee caving in → Press it gently out toward your second toe.',
        'Straight leg’s foot peeling up → Shorten the step a little and press both whole feet into the floor.',
        'Back rounding → Open your chest and hinge with a straight line from tailbone to crown.',
      ],
    },
    why: {
      ko: '일상에서 거의 쓰지 않는 옆 방향 움직임으로 엉덩이 힘과 허벅지 안쪽 유연성을 함께 길러요. 체중이 한쪽으로 치우치거나 골반이 기울어진 자세, 무릎이 안쪽으로 모이는 습관을 바로잡는 데 좋아요.',
      en: 'Trains the side-to-side movement we rarely use, building glute strength and inner-thigh flexibility together — helpful for weight shifted to one side, a tilted pelvis and knees that cave in.',
    },
    muscles: { ko: '대둔근, 중둔근, 대퇴사두근(굽힌 다리), 내전근(편 다리, 늘어남)', en: 'Gluteus maximus and medius, quadriceps (bent leg), adductors (straight leg, lengthening)' },
    caution: {
      ko: '사타구니나 무릎 안쪽에 통증이 있으면 보폭과 깊이를 줄이고, 계속 아프면 멈추세요.',
      en: 'With groin or inner-knee pain, take a narrower, shallower lunge; stop if it keeps hurting.',
    },
    avoid: ['kneePain', 'kneeSevere'],
    anim: {
      view: 0,
      anchor: ['heelL', 'toeL'],
      level: { a: ['heelL', 'toeL'], b: ['heelR', 'toeR'], axis: 'roll' },
      keys: [LL_STAND, LL_WIDE, LL_SIT],
      labels: [
        { ko: '발 모으고 서기', en: 'Stand tall' },
        { ko: '오른쪽으로 크게 딛기', en: 'Step wide to the right' },
        { ko: '엉덩이 뒤로 앉기', en: 'Sit back into the hip' },
      ],
      durations: [1.2, 2, 1.8],
      pauses: [0.4, 0.2, 1],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work' },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'hipL', b: 'knL', side: 'in', kind: 'stretch' },
      ],
      trace: ['pelvis'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'single-leg-rdl',
    name: { ko: '한 다리 데드리프트', en: 'Single-leg Romanian deadlift' },
    phase: 'integrate',
    position: 'standing',
    regions: ['glute', 'hip', 'core'],
    targets: { pelvicTilt: 0.6, lateralShift: 0.5, kneeHyperext: 0.4, swayback: 0.4, lowBackPain: 0.3 },
    equipment: [],
    level: 3,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, holdSec: 1, perSide: true, rest: 30 },
    setup: {
      ko: [
        '두 발을 골반 너비로 서서 체중을 오른발 가운데로 옮기고, 오른무릎을 10~15도 살짝 굽혀요.',
        '왼발을 바닥에서 살짝 들어 오른발 약간 뒤에 띄워요. 처음엔 벽이나 의자 등받이 옆에 서서 손끝을 댈 수 있게 해요.',
        '두 팔은 허벅지 앞에 자연스럽게 늘어뜨리고, 배꼽을 살짝 당겨 머리부터 골반까지 일직선을 만들어요.',
      ],
      en: [
        'Stand with feet hip-width apart, shift your weight to the middle of your right foot and soften the right knee 10–15°.',
        'Lift your left foot just off the floor slightly behind you. At first, stand beside a wall or chair back so your fingertips can touch it.',
        'Let your arms hang in front of your thighs and draw your belly in so your head, back and pelvis form one line.',
      ],
    },
    steps: {
      ko: [
        '엉덩이를 뒤로 빼며 2초에 걸쳐 상체를 숙이고, 동시에 왼다리를 뒤로 길게 뻗어요.',
        '머리-등-골반-왼발뒤꿈치가 한 줄이 된 채 몸이 바닥과 거의 평행해질 때까지(또는 오른쪽 허벅지 뒤가 당길 때까지) 내려가요.',
        '양쪽 골반 높이를 같게 두고 왼발끝은 바닥을 향해요. 두 손은 어깨 바로 아래로 늘어뜨려요.',
        '1초 멈춘 뒤 오른쪽 엉덩이를 조이며 2초에 걸쳐 일어서요.',
        '8회 반복한 뒤 왼다리로 서서 해요.',
      ],
      en: [
        'Push your hips back and tip your torso forward over 2 seconds as your left leg reaches long behind you.',
        'Keeping head, back, pelvis and left heel in one line, lower until your body is nearly parallel to the floor (or until the back of your right thigh pulls).',
        'Keep both hips level with your left toes pointing at the floor; let your hands hang straight under your shoulders.',
        'Pause 1 second, then squeeze your right glute and rise over 2 seconds.',
        'Do 8 reps, then stand on the left leg.',
      ],
    },
    breathing: { ko: '숙일 때 코로 들이마시고, 엉덩이를 조이며 일어설 때 입으로 내쉬어요.', en: 'Inhale through your nose as you hinge, exhale through your mouth as you squeeze up.' },
    feel: {
      ko: '서 있는 다리의 허벅지 뒤가 길게 당기고 엉덩이에 힘이 들어가면 정답이에요. 허리가 뻐근하면 등이 말린 거니 숙이는 깊이를 줄이세요.',
      en: 'A long pull through the back of the standing thigh and work in its glute. If your low back aches, your back is rounding — don’t go as low.',
    },
    easier: {
      ko: '벽이나 의자에 손끝을 대고 하거나, 왼발끝을 바닥에 가볍게 댄 채(킥스탠드 자세) 숙여요. ‘힙 힌지’로 동작을 먼저 익혀도 좋아요.',
      en: 'Touch a wall or chair with your fingertips, or keep the back toes lightly on the floor (kickstand stance). You can also learn the pattern with the hip hinge first.',
    },
    harder: {
      ko: '들어 올린 다리 쪽 손에 물병이나 덤벨을 들거나, 내려가는 시간을 3초로 늘려요.',
      en: 'Hold a water bottle or dumbbell in the hand on the lifted-leg side, or take 3 seconds to lower.',
    },
    cues: { ko: ['엉덩이를 뒤로', '뒷다리는 길게', '골반은 수평', '엉덩이 조이며 일어서요'], en: ['Hips back', 'Reach the back leg long', 'Keep hips level', 'Squeeze up'] },
    mistakes: {
      ko: [
        '등이 둥글게 말림 → 가슴을 펴고 시선은 발 앞 1m 바닥에 둔 채, 당기는 지점까지만 숙여요.',
        '들어 올린 다리 쪽 골반이 천장으로 열림 → 왼발끝을 바닥으로 향하게 하고 양쪽 골반뼈를 바닥과 평행하게 둬요.',
        '서 있는 무릎을 쭉 잠그거나 너무 굽힘 → 10~20도로 살짝 굽힌 채 고정하고 엉덩이만 접어요.',
        '빠르게 휘청이며 내려감 → 2초에 걸쳐 내려가고, 흔들리면 손끝으로 벽을 짚어요.',
      ],
      en: [
        'Rounding the back → Open your chest, look at the floor 1 m ahead and only go as far as the pull allows.',
        'Lifted-leg hip opening toward the ceiling → Point your left toes at the floor and keep both hip bones parallel to it.',
        'Locking or over-bending the standing knee → Keep a fixed 10–20° soft bend and fold only at the hip.',
        'Rushing and wobbling → Take 2 seconds down and touch a wall if you sway.',
      ],
    },
    why: {
      ko: '한 다리로 균형을 잡으며 엉덩이와 햄스트링을 함께 길러요. 허리 대신 고관절로 숙이는 패턴을 익히고, 좌우 힘 차이와 골반 기울기, 무릎을 뒤로 잠그고 서는 습관을 바로잡는 데 좋아요.',
      en: 'Builds the glutes and hamstrings while you balance on one leg. It grooves bending from the hip instead of the spine and helps even out side-to-side strength, pelvic tilt and the habit of locking the knees.',
    },
    muscles: {
      ko: '대둔근, 햄스트링, 중둔근(골반 수평), 척추기립근·복부(몸통 고정), 발목 안정근',
      en: 'Gluteus maximus, hamstrings, gluteus medius (level pelvis), spinal erectors and abdominals (trunk control), ankle stabilisers',
    },
    caution: {
      ko: '허리가 아프거나 다리가 저리면 멈추고 ‘힙 힌지’로 돌아가세요. 균형이 불안하면 반드시 벽을 짚으세요.',
      en: 'Stop and go back to the hip hinge if your low back hurts or your leg tingles. Always touch a wall if your balance is unsteady.',
    },
    avoid: ['balance', 'lowBackSevere'],
    anim: {
      view: 90,
      anchor: ['heelR', 'toeR'],
      keys: [RDL_STAND, RDL_HALF, RDL_BOTTOM],
      labels: [
        { ko: '오른발로 서기', en: 'Stand on the right leg' },
        { ko: '엉덩이 뒤로 접기', en: 'Hinge at the hip' },
        { ko: '몸과 다리 일직선', en: 'Body and leg in line' },
      ],
      durations: [1.1, 1, 2],
      pauses: [0.5, 0.1, 1],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'back', kind: 'stretch' },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
      ],
      trace: ['heelL'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'supine-hamstring-towel',
    name: { ko: '누워서 수건으로 햄스트링 늘리기', en: 'Supine hamstring stretch with towel' },
    phase: 'stretch',
    position: 'supine',
    regions: ['hip', 'knee'],
    targets: { kneeFlexed: 0.7, flatBack: 0.6, lowBackPain: 0.5, swayback: 0.3, stiffness: 0.3 },
    equipment: ['towel', 'mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에 바로 누워 두 다리를 펴고, 긴 수건(또는 밴드) 가운데를 오른발 앞꿈치(발볼)에 걸어요.',
        '수건 양끝을 두 손으로 하나씩 잡고, 뒤통수와 어깨는 바닥에 편하게 내려놔요.',
        '왼다리는 바닥에 쭉 편 채 무릎 뒤를 바닥 쪽으로 가볍게 눌러요(허리가 불편하면 왼무릎을 세워도 돼요).',
      ],
      en: [
        'Lie on your back with both legs straight and hook the middle of a long towel (or band) around the ball of your right foot.',
        'Hold one end of the towel in each hand and let your head and shoulders rest on the floor.',
        'Keep your left leg straight on the floor, lightly pressing the back of the knee down (bend the left knee if your low back is uncomfortable).',
      ],
    },
    steps: {
      ko: [
        '수건을 발에 건 채 오른무릎을 가슴 쪽으로 굽혀 허벅지를 수직에 가깝게 세워요.',
        '수건을 잡은 채 2초에 걸쳐 오른무릎을 펴며 다리를 천장 쪽으로 뻗어요.',
        '무릎을 편 채 수건을 살살 당겨, 허벅지 뒤가 기분 좋게 당기는 곳(10점 중 5~6점, 통증 없이)에서 멈춰요.',
        '그 자리에서 30초 버티며, 숨을 내쉴 때마다 1~2cm씩만 더 당겨요.',
        '무릎을 굽혀 천천히 내려놓고, 2세트 한 뒤 다리를 바꿔요.',
      ],
      en: [
        'With the towel on the foot, bend your right knee toward your chest so the thigh is nearly vertical.',
        'Holding the towel, straighten the right knee over 2 seconds and reach the leg toward the ceiling.',
        'With the knee straight, gently pull the towel until you feel a comfortable stretch behind the thigh (about 5–6 out of 10, no pain).',
        'Hold for 30 seconds, easing 1–2 cm further only on each exhale.',
        'Bend the knee and lower slowly. Do 2 sets, then switch legs.',
      ],
    },
    breathing: {
      ko: '자리를 잡은 뒤 코로 4초 들이마시고 입으로 6초 길게 내쉬어요. 내쉴 때 허벅지 뒤 힘을 빼며 조금 더 늘려요.',
      en: 'Once in position, breathe in through your nose for 4 seconds and out through your mouth for 6. Relax the back of the thigh and ease a little further as you exhale.',
    },
    feel: {
      ko: '오른쪽 허벅지 뒤 가운데가 넓게 늘어나면 정답이에요. 무릎 뒤나 종아리 아래로 찌릿하거나 저린 느낌(신경 당김)이 들면 발목 힘을 빼고 다리를 조금 내리세요.',
      en: 'A broad stretch through the middle of the back of your right thigh. Tingling or zinging behind the knee or down the calf (nerve tension) means relax your ankle and lower the leg a little.',
    },
    easier: {
      ko: '무릎을 10~20도 살짝 굽힌 채 늘리거나 왼무릎을 세우고 해요. 수건 대신 문틀에 다리를 기대도 돼요.',
      en: 'Keep the knee slightly bent (10–20°), or bend the left knee. You can also rest the leg against a door frame instead of using a towel.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘리거나, 발뒤꿈치로 수건을 5초 지그시 밀었다가(허벅지 뒤에 힘주기) 힘을 빼며 조금 더 당기기를 3번 반복해요.',
      en: 'Build the hold to 45 seconds, or press your heel into the towel for 5 seconds (tensing the hamstring), then relax and ease a little further — repeat 3 times.',
    },
    cues: { ko: ['무릎은 쭉 펴요', '골반은 바닥에', '내쉬며 조금 더', '당기면 멈춰요'], en: ['Keep the knee straight', 'Pelvis stays down', 'Ease further as you exhale', 'Stop at the pull'] },
    mistakes: {
      ko: [
        '수건을 세게 당기다 무릎이 굽음 → 무릎을 편 채 갈 수 있는 높이까지만 들어요.',
        '엉덩이가 들리고 허리가 말림 → 다리를 조금 내려 골반과 허리를 바닥에 붙여요.',
        '어깨와 목에 힘이 들어가 머리가 들림 → 수건을 더 길게 잡고 뒤통수를 바닥에 내려놔요.',
        '반동을 주며 튕김 → 한 자리에서 30초 동안 천천히 버텨요.',
      ],
      en: [
        'Pulling so hard the knee bends → Only raise the leg as high as you can with the knee straight.',
        'Hips lifting and low back curling → Lower the leg a little so your pelvis and back stay on the floor.',
        'Tensing the shoulders and lifting the head → Hold the towel further down its length and rest your head.',
        'Bouncing → Settle into one spot and hold steadily for 30 seconds.',
      ],
    },
    why: {
      ko: '누워서 하면 허리가 바닥에 받쳐져 등이 말리지 않은 채 햄스트링만 정확히 늘릴 수 있어요. 짧아진 햄스트링이 골반을 뒤로 당겨 허리가 일자가 되거나, 무릎이 굽은 채 서는 습관을 푸는 데 좋아요.',
      en: 'Lying down supports your spine, so you can stretch just the hamstrings without rounding your back. Loosening them eases a pelvis pulled into a flat-back posture and the habit of standing with bent knees.',
    },
    muscles: { ko: '햄스트링(대퇴이두근·반건양근·반막양근), 비복근', en: 'Hamstrings (biceps femoris, semitendinosus, semimembranosus), gastrocnemius' },
    caution: {
      ko: '다리 뒤로 저린 느낌이 내려가거나 허리 통증이 심해지면 멈추세요.',
      en: 'Stop if tingling runs down your leg or your low-back pain gets worse.',
    },
    avoid: ['radiating'],
    anim: {
      view: 90,
      elev: 14,
      anchor: ['pelvis'],
      props: [
        { kind: 'mat' },
        { kind: 'towel', at: 'haR', to: 'toeR' },
        { kind: 'towel', at: 'haL', to: 'toeR' },
      ],
      keys: [
        merge(TOWEL_BASE, towelArms(36, 30), { hipR: { flex: 90 }, knR: 88, anR: 0 }),
        merge(TOWEL_BASE, towelArms(50, 20), { hipR: { flex: 62 }, knR: 4, anR: 2 }),
        merge(TOWEL_BASE, towelArms(60, 22), { hipR: { flex: 76 }, knR: 2, anR: 6 }),
      ],
      labels: [
        { ko: '수건 걸고 무릎 굽히기', en: 'Towel on foot, knee bent' },
        { ko: '무릎 펴며 올리기', en: 'Straighten the leg' },
        { ko: '허벅지 뒤 늘리기', en: 'Hold the stretch' },
      ],
      durations: [2, 1.6, 2],
      pauses: [0.6, 0.4, 3],
      holdKey: 2,
      focus: [
        { a: 'hipR', b: 'knR', side: 'back', kind: 'stretch' },
        { a: 'knR', b: 'anR', side: 'back', kind: 'stretch', r: 2.4, from: 0.1, to: 0.55 },
      ],
      trace: ['heelR'],
    },
  },
];
