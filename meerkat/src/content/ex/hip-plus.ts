/**
 * 운동 라이브러리 · 고관절·엉덩이 (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, mirrorPose, type Pose } from '../../figure/rig';
import { HANDS_ON_HIPS, HOOK, QUAD, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서만 쓰는 자세 ─────────────────────

/** 바닥에 앉아 두 손을 엉덩이 뒤 바닥에 짚고 살짝 기댄 상체 */
const SIT_HANDS_BACK: Pose = merge({ root: { pitch: -10 } }, both({ sh: { flex: -34, abd: 7 }, el: 2, wr: -42 }), { neck: { flex: 6 } });

/**
 * 90/90 (무릎을 오른쪽으로 눕힘): 발뒤꿈치는 제자리, 골반이 오른무릎 쪽으로 약 30° 따라 돌아요.
 * 오른다리 앞(바깥돌림, 정강이가 몸 앞을 가로지름) · 왼다리 옆(안쪽돌림, 정강이가 뒤·옆으로)
 */
const P9090_R: Pose = merge(SIT_HANDS_BACK, {
  root: { pitch: -10, yaw: -30 },
  lumbar: { twist: 15 },
  thorax: { twist: 10 },
  neck: { flex: 6, twist: -15 },
  hipR: { flex: 80, hab: 56, rot: 74 },
  knR: 111,
  anR: 15,
  hipL: { flex: 76, hab: -11, rot: -79 },
  knL: 120,
  anL: 15,
  shR: { flex: -31, abd: 7 },
  shL: { flex: -36, abd: 6 },
});
/** 90/90 전환 중간: 발은 넓게 둔 채 두 무릎을 세움 */
const P9090_MID: Pose = merge(SIT_HANDS_BACK, both({ hip: { flex: 130, hab: 17, rot: -8 }, kn: 106, an: -32 }));
/** 90/90: 왼다리 앞, 오른다리 옆 */
const P9090_L: Pose = mirrorPose(P9090_R);

/** 무릎 세워 누운 자세(발바닥 평평, 팔은 몸 옆 45°) */
const HOOK_FLAT: Pose = merge(HOOK, both({ hip: { flex: 49 }, kn: 107, an: -33, sh: { flex: -7, abd: 45 }, el: 2 }));

/** 브리지 최고점(두 발): 어깨-골반-무릎 일직선, 뒤통수·어깨·발바닥은 바닥에 */
const BRIDGE_UP: Pose = merge(HOOK_FLAT, { root: { pitch: -112 }, neck: { flex: 28 } }, both({ hip: { flex: 0 }, kn: 85, an: -26, sh: { flex: -22, abd: 49 }, el: 2 }));

/** 선 자세에서 왼손으로 옆 벽 짚기, 오른손은 허리 */
const STAND_WALL: Pose = merge(STAND, { shL: { abd: 80, flex: 6 }, elL: 12, wrL: -40, shR: HANDS_ON_HIPS.shR, elR: HANDS_ON_HIPS.elR, knL: 4 });

export const HIP_PLUS: Exercise[] = [
  // ─────────────────────────────────────────────
  {
    id: 'hip-9090-switch',
    name: { ko: '90/90 고관절 전환', en: '90/90 hip switch' },
    phase: 'mobility',
    position: 'seated',
    regions: ['hip', 'glute'],
    targets: { stiffness: 0.7, hipPain: 0.6, lowBackPain: 0.4, pelvicTilt: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 6, tempo: 5, holdSec: 4, rest: 20 },
    setup: {
      ko: [
        '매트에 앉아 두 무릎을 세우고, 두 발을 어깨너비의 약 1.5배로 넓게 벌려 발뒤꿈치를 바닥에 둬요.',
        '두 손은 엉덩이 뒤 20~30cm 바닥을 짚고, 팔꿈치를 거의 편 채 상체를 약 15도 뒤로 기대요.',
        '발은 그대로 둔 채 두 무릎을 오른쪽 바닥으로 눕혀 시작해요. 오른다리는 앞(정강이가 몸 앞을 가로지름), 왼다리는 옆(정강이가 옆·뒤를 향함)이고 두 무릎은 90도 안팎이에요.',
        '골반과 가슴은 오른무릎 쪽으로 살짝 따라 돌아도 괜찮아요. 가슴은 활짝 펴고 시선은 오른무릎을 봐요.',
      ],
      en: [
        'Sit on the mat with knees bent and feet planted about 1.5× shoulder-width apart, heels on the floor.',
        'Place your hands on the floor 20–30 cm behind your hips and lean back about 15°, elbows nearly straight.',
        'Keeping the feet where they are, lower both knees to the right to start: right leg in front (shin across your body), left leg out to the side (shin pointing out and back), both knees at roughly 90°.',
        'It’s fine for your pelvis and chest to turn slightly toward the right knee. Keep your chest open and look at the right knee.',
      ],
    },
    steps: {
      ko: [
        '가슴을 편 채 숨을 내쉬며 두 무릎을 천천히 들어 올려요. 발뒤꿈치는 바닥에 그대로 붙여 둬요.',
        '두 무릎이 천장을 향하는 가운데 자세를 지나, 2초에 걸쳐 왼쪽 바닥으로 함께 눕혀요.',
        '왼다리가 앞, 오른다리가 옆으로 간 90/90 자세가 되면 2초 멈춰요. 양쪽 엉덩이가 바닥에서 크게 뜨지 않게 해요.',
        '같은 방법으로 무릎을 들어 다시 오른쪽으로 넘어가 2초 멈춰요. 오른쪽 → 왼쪽 → 오른쪽 왕복이 1회예요.',
        '6회 왕복해요. 무릎이 바닥에 닿지 않아도 괜찮으니 편한 범위에서만 움직여요.',
      ],
      en: [
        'Keeping your chest open, exhale and slowly lift both knees. Keep your heels planted.',
        'Pass through the middle with both knees pointing at the ceiling, then take 2 seconds to lower them together to the left.',
        'When you land in 90/90 with the left leg in front and the right leg to the side, pause for 2 seconds. Don’t let either buttock lift far off the floor.',
        'Lift the knees and switch back to the right the same way, pausing 2 seconds. Right → left → right is 1 rep.',
        'Do 6 round trips. The knees don’t need to touch the floor — move only within a comfortable range.',
      ],
    },
    breathing: {
      ko: '무릎을 들어 넘길 때 입으로 길게 내쉬고, 90/90 자세에서 멈춘 2초 동안 코로 들이마셔요.',
      en: 'Exhale slowly as you lift and switch the knees; breathe in through your nose during the 2-second pause in 90/90.',
    },
    feel: {
      ko: '앞다리 쪽 엉덩이 뒤·바깥, 옆으로 간 다리의 고관절 앞·바깥이 부드럽게 늘어나고 고관절이 돌아가는 감각이 들면 정답이에요. 무릎 안쪽이 비틀리듯 아프거나 사타구니가 찌릿하면 범위를 줄이세요.',
      en: 'A gentle stretch at the back/outside of the front hip and the front/outside of the side hip, with a sense of the hip joints turning. If the inside of a knee twists painfully or the groin zings, shorten the range.',
    },
    easier: {
      ko: '두 손을 엉덩이에서 더 멀리 짚어 더 기대고, 발을 더 넓게 벌려요. 무릎을 바닥까지 눕히지 말고 절반 범위만 왔다 갔다 해도 좋아요. 무릎이 불편하면 ‘누워서 엉덩이 깊은 곳 늘리기’로 대신하세요.',
      en: 'Place your hands farther back to lean more and widen your feet. Rock only halfway instead of taking the knees to the floor. If your knees complain, do the supine figure-4 stretch instead.',
    },
    harder: {
      ko: '손을 떼고 두 팔을 앞으로 뻗은 채 상체를 곧게 세우고 해요. 익숙해지면 90/90 자세마다 가슴을 앞 정강이 쪽으로 숙여 5초씩 버텨요.',
      en: 'Take your hands off the floor, reach your arms forward and sit tall. Later, lean your chest over the front shin in each 90/90 and hold 5 seconds.',
    },
    cues: { ko: ['발뒤꿈치는 제자리', '무릎을 함께 넘겨요', '가슴은 활짝', '천천히 2초'], en: ['Heels stay put', 'Switch knees together', 'Chest open', 'Slow, two seconds'] },
    mistakes: {
      ko: [
        '등이 둥글게 말림 → 손을 조금 더 뒤에 짚고 가슴을 앞으로 내밀어 허리를 세워요.',
        '반동으로 무릎을 털썩 떨어뜨림 → 2초에 걸쳐 내려놓고, 바닥에 닿기 전에 멈출 수 있을 만큼만 움직여요.',
        '뒤로 간 무릎이 비틀려 아픔 → 발을 더 넓게 벌리고 범위를 줄여요. 무릎이 아니라 고관절에서 돌린다고 생각해요.',
        '발이 미끄러져 따라감 → 발뒤꿈치를 바닥에 고정한 채 무릎을 좌우로 넘겨요. 발은 뒤꿈치를 축으로 살짝 돌아가도 괜찮아요.',
      ],
      en: [
        'Rounding the back → Place your hands a bit farther back and push your chest forward to sit tall.',
        'Flopping the knees down with momentum → Take 2 seconds to lower and stay able to stop before the floor.',
        'Back knee twisting and aching → Widen your feet and shorten the range; think of turning from the hip, not the knee.',
        'Feet sliding around → Pin your heels to the floor and swing the knees; letting the feet pivot on the heels is fine.',
      ],
    },
    why: {
      ko: '오래 앉으면 굳기 쉬운 고관절의 안쪽·바깥쪽 돌림을 양쪽 번갈아 부드럽게 써서, 골반과 허리가 대신 비틀리는 보상을 줄여 줘요.',
      en: 'Works hip internal and external rotation on both sides — motions that stiffen with sitting — so your pelvis and low back don’t have to twist in their place.',
    },
    muscles: {
      ko: '고관절 외회전근(이상근 등)·내회전근, 중둔근, 대둔근, 내전근',
      en: 'Hip external rotators (piriformis etc.) and internal rotators, gluteus medius and maximus, adductors',
    },
    caution: {
      ko: '무릎 수술 이력이 있거나 무릎 안쪽이 아프면 범위를 절반으로 줄이고, 통증이 계속되면 멈추세요. 고관절 인공관절 수술을 받았다면 전문가와 먼저 상의하세요.',
      en: 'If you’ve had knee surgery or feel pain on the inside of a knee, halve the range and stop if it persists. If you’ve had a hip replacement, check with your clinician first.',
    },
    avoid: ['kneePain', 'kneeSevere'],
    anim: {
      view: 0,
      elev: 42,
      props: [{ kind: 'mat' }],
      anchor: ['sitL', 'sitR'],
      keys: [P9090_R, P9090_MID, P9090_L, P9090_MID],
      labels: [
        { ko: '오른다리 앞 90/90', en: '90/90, right leg front' },
        { ko: '무릎 세워 가운데로', en: 'Knees up through center' },
        { ko: '왼다리 앞 90/90', en: '90/90, left leg front' },
        { ko: '다시 가운데로', en: 'Back through center' },
      ],
      durations: [1.1, 1.1, 1.1, 1.1],
      pauses: [2, 0.2, 2, 0.2],
      holdKey: 0,
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'stretch', r: 3.2 },
        { a: 'pelvis', b: 'hipL', side: 'back', kind: 'stretch', r: 3.2 },
      ],
      trace: ['knR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'supine-piriformis',
    name: { ko: '누워서 엉덩이 깊은 곳 늘리기', en: 'Supine figure-4 stretch' },
    phase: 'stretch',
    position: 'supine',
    regions: ['glute', 'hip', 'lowBack'],
    targets: { hipPain: 0.8, lowBackPain: 0.6, stiffness: 0.5, pelvicTilt: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에 바로 누워 두 무릎을 약 90도로 세우고, 발은 골반 너비로 벌려 발바닥 전체를 바닥에 둬요.',
        '뒤통수와 등 전체를 바닥에 편하게 대고, 허리 아래는 손바닥이 겨우 들어갈 만큼의 자연스러운 곡선을 둬요.',
        '오른발목 바깥쪽을 왼무릎 바로 위 허벅지에 올려 숫자 4 모양을 만들어요. 오른발 발등을 몸 쪽으로 당겨 두면 무릎이 편해요.',
      ],
      en: [
        'Lie on your back with knees bent to about 90°, feet hip-width apart and flat on the floor.',
        'Rest your head and whole back on the mat, keeping a natural low-back curve (just enough space to slide a palm under).',
        'Place the outside of your right ankle on your left thigh just above the knee to make a “4”. Flex your right foot (toes toward you) to protect the knee.',
      ],
    },
    steps: {
      ko: [
        '오른팔은 두 다리 사이 빈 공간으로, 왼팔은 왼허벅지 바깥으로 넣어 왼허벅지 뒤에서 두 손을 깍지 껴요.',
        '숨을 내쉬며 왼발을 바닥에서 떼고, 왼허벅지를 가슴 쪽으로 2~3초에 걸쳐 천천히 당겨요.',
        '오른쪽 엉덩이 깊은 곳이 당기는 지점에서 멈추고 30초 버텨요. 꼬리뼈와 엉덩이는 바닥에 붙여 둬요.',
        '버티는 동안 오른팔꿈치로 오른무릎 안쪽을 가볍게 밀어 내면 늘어나는 느낌이 커져요.',
        '천천히 왼발을 바닥에 내려놓고 다리를 풀어요. 2세트 후 반대쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Thread your right arm through the gap between your legs and your left arm around the outside of your left thigh; clasp your hands behind the left thigh.',
        'Exhale, lift your left foot off the floor and take 2–3 seconds to draw your left thigh toward your chest.',
        'Stop where you feel a stretch deep in the right buttock and hold 30 seconds. Keep your tailbone and hips on the mat.',
        'While holding, gently press your right knee away with your right elbow to deepen the stretch.',
        'Slowly lower the left foot and uncross. After 2 sets, repeat on the other side.',
      ],
    },
    breathing: {
      ko: '당길 때 내쉬고, 버티는 동안 코로 4초 들이마시고 입으로 6초 내쉬어요. 내쉴 때마다 왼허벅지를 1~2cm씩 더 당겨요.',
      en: 'Exhale as you draw in, then breathe in for 4 and out for 6 through the hold. With each exhale, draw the thigh in another 1–2 cm.',
    },
    feel: {
      ko: '오른쪽 엉덩이 깊은 곳과 바깥쪽이 은은하게 당기면 정답이에요. 엉덩이에서 다리 뒤로 저림·찌릿함이 내려가거나 오른무릎 안쪽이 아프면 바로 당기는 힘을 줄이세요.',
      en: 'A gentle pull deep in and around the outside of your right buttock. If tingling or zinging runs down the back of the leg, or the inside of the right knee hurts, ease off right away.',
    },
    easier: {
      ko: '왼발을 바닥에 둔 채 오른무릎만 바깥으로 살짝 밀어도 충분히 늘어나요. 손이 닿지 않으면 수건을 왼허벅지 뒤에 걸어 당기세요.',
      en: 'Keep your left foot on the floor and just press the right knee gently away — that’s often enough. If you can’t reach, loop a towel behind your left thigh and pull on it.',
    },
    harder: {
      ko: '왼허벅지를 가슴에 더 가깝게 당기고 버티는 시간을 45초로 늘려요. 이후 ‘90/90 고관절 전환’으로 움직이는 범위를 넓혀 보세요.',
      en: 'Draw the thigh closer to your chest and extend the hold to 45 seconds. Then build active range with the 90/90 hip switch.',
    },
    cues: { ko: ['꼬리뼈는 바닥에', '허벅지를 가슴 쪽으로', '어깨는 힘을 빼요', '내쉬며 조금 더'], en: ['Tailbone down', 'Thigh toward chest', 'Relax your shoulders', 'Exhale, a bit more'] },
    mistakes: {
      ko: [
        '머리와 어깨가 바닥에서 들림 → 손이 닿지 않으면 수건을 걸어 당기고, 뒤통수는 바닥에 편하게 둬요.',
        '엉덩이가 바닥에서 말려 올라감 → 꼬리뼈가 바닥에 닿아 있는 만큼만 당겨요.',
        '오른발목이 꺾여 무릎이 불편함 → 오른발 발등을 몸 쪽으로 당겨 발목을 고정하고, 발목뼈가 허벅지 바깥으로 살짝 나오게 올려요.',
        '숨을 참고 세게 당김 → 내쉬는 숨에 맞춰 조금씩 당기고, 통증이 아닌 당김에서 멈춰요.',
      ],
      en: [
        'Head and shoulders lifting → Use a towel if you can’t reach, and let the back of your head rest on the floor.',
        'Hips curling off the mat → Pull only as far as your tailbone stays down.',
        'Right ankle sickling and the knee complaining → Flex the right foot and let the ankle bone sit just past the thigh.',
        'Holding your breath and yanking → Draw in a little with each exhale and stop at a stretch, not pain.',
      ],
    },
    why: {
      ko: '오래 앉아 굳은 이상근과 엉덩이 근육을 등·골반을 바닥에 받친 채 늘려, 허리 부담 없이 골반·허리 긴장과 엉덩이 뻐근함을 줄여 줘요.',
      en: 'Stretches the piriformis and glutes that stiffen with sitting while your back and pelvis rest on the floor, easing hip and low-back tension without loading the spine.',
    },
    muscles: { ko: '이상근, 대둔근, 고관절 외회전근', en: 'Piriformis, gluteus maximus, deep hip external rotators' },
    caution: {
      ko: '엉덩이에서 다리로 저림이 내려가면 바로 멈추세요. 고관절 인공관절 수술을 받았다면 이 자세(깊은 굽힘+돌림)는 먼저 전문가와 상의하세요.',
      en: 'Stop if numbness or tingling travels down the leg. If you’ve had a hip replacement, check with your clinician before using this deep flexion-and-rotation position.',
    },
    avoid: ['kneeSevere'],
    anim: {
      view: 60,
      elev: 30,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      zoom: 1.1,
      keys: [
        HOOK_FLAT,
        merge(HOOK_FLAT, { hipR: { flex: 80, hab: 41, rot: 67 }, knR: 124, anR: 5 }),
        merge(HOOK_FLAT, {
          hipR: { flex: 111, hab: 36, rot: 79 },
          knR: 123,
          anR: 5,
          hipL: { flex: 105 },
          knL: 95,
          anL: -10,
          shR: { flex: 14, abd: -6, rot: -44 },
          elR: 71,
          shL: { flex: 11, abd: 28, rot: -37 },
          elL: 88,
        }),
      ],
      labels: [
        { ko: '무릎 세워 눕기', en: 'Lie with knees bent' },
        { ko: '오른발목을 왼무릎에', en: 'Right ankle on left knee' },
        { ko: '왼허벅지 당겨 30초', en: 'Draw thigh in, hold 30 s' },
      ],
      durations: [1.2, 1.6, 1.6],
      pauses: [0.4, 0.6, 3],
      holdKey: 2,
      focus: [{ a: 'pelvis', b: 'hipR', side: 'back', kind: 'stretch', r: 4 }],
      trace: ['knL'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'adductor-rockback',
    name: { ko: '옆으로 다리 뻗고 뒤로 앉기', en: 'Adductor rock-back' },
    phase: 'mobility',
    position: 'quadruped',
    regions: ['hip'],
    targets: { kneeValgus: 0.6, hipPain: 0.5, stiffness: 0.5, pelvicTilt: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 5, holdSec: 2, perSide: true, rest: 15 },
    setup: {
      ko: [
        '네발 자세를 만들어요. 손목은 어깨 바로 아래, 왼무릎은 골반 바로 아래에 두고 손가락을 넓게 펴요.',
        '오른다리를 옆으로 쭉 뻗어 오른발이 왼무릎과 일직선(몸 옆 방향)에 오게 하고, 발바닥 전체를 바닥에 둬요. 발끝은 정면(머리 쪽)을 향해요.',
        '배꼽을 살짝 당겨 등을 평평하게 만들어요. 시선은 두 손 사이 바닥이에요.',
      ],
      en: [
        'Get on all fours: wrists under shoulders, left knee under the hip, fingers spread wide.',
        'Extend your right leg straight out to the side so the foot lines up with your left knee, whole sole on the floor, toes pointing forward (toward your head).',
        'Draw your belly button in slightly to flatten your back. Eyes on the floor between your hands.',
      ],
    },
    steps: {
      ko: [
        '등을 평평하게 유지한 채 숨을 내쉬며 엉덩이를 왼발뒤꿈치 쪽으로 2~3초에 걸쳐 천천히 밀어요.',
        '오른허벅지 안쪽이 당기기 시작하는 지점에서 2초 멈춰요. 허리가 둥글게 말리기 직전까지만 가요.',
        '숨을 들이마시며 2초에 걸쳐 처음 네발 자세로 돌아와요.',
        '10회 반복하며 매 회 1~2cm씩 조금 더 깊이 앉아 봐요.',
        '끝나면 왼다리를 옆으로 뻗고 같은 방법으로 해요.',
      ],
      en: [
        'Keeping your back flat, exhale and take 2–3 seconds to push your hips back toward your left heel.',
        'Pause for 2 seconds where your right inner thigh starts to pull — stop just before your low back rounds.',
        'Inhale and take 2 seconds to return to all fours.',
        'Do 10 reps, sinking 1–2 cm deeper each time.',
        'Then extend the left leg to the side and repeat.',
      ],
    },
    breathing: {
      ko: '엉덩이를 뒤로 보낼 때 입으로 길게 내쉬고, 앞으로 돌아올 때 코로 들이마셔요.',
      en: 'Exhale slowly as your hips move back; inhale through your nose as you come forward.',
    },
    feel: {
      ko: '뻗은 다리의 허벅지 안쪽(사타구니에서 무릎 쪽)이 길게 당기면 정답이에요. 사타구니 앞이 찝히거나 뻗은 무릎 안쪽이 아프면 범위를 줄이세요.',
      en: 'A long pull along the inner thigh of the straight leg, from groin toward knee. If the front of the groin pinches or the inside of the straight knee hurts, shorten the range.',
    },
    easier: {
      ko: '뻗은 다리의 무릎을 살짝 굽히거나 발을 몸 쪽으로 10cm 당겨 놓아요. 손목이 불편하면 주먹을 쥐거나 팔꿈치를 대고, 무릎 밑에는 수건을 접어 받쳐요.',
      en: 'Bend the straight knee slightly or bring the foot 10 cm closer. If your wrists complain, make fists or drop to your forearms, and pad the kneeling knee with a folded towel.',
    },
    harder: {
      ko: '발을 5~10cm 더 멀리 두고 가장 깊은 지점에서 5초씩 버텨요. 버티는 동안 뻗은 발로 바닥을 3초 지그시 눌렀다 힘을 풀면 조금 더 깊이 앉을 수 있어요.',
      en: 'Place the foot 5–10 cm farther out and hold 5 seconds at the deepest point. While holding, press the straight leg’s foot into the floor for 3 seconds, then relax and sink a little deeper.',
    },
    cues: { ko: ['등은 평평하게', '엉덩이를 뒤로', '발바닥은 바닥에', '천천히 돌아와요'], en: ['Keep your back flat', 'Hips back', 'Foot stays flat', 'Come back slowly'] },
    mistakes: {
      ko: [
        '허리가 둥글게 말림 → 등이 평평한 데까지만 뒤로 가고, 배꼽을 살짝 당겨 허리 곡선을 지켜요.',
        '뻗은 발이 들리거나 발끝이 천장을 향함 → 발바닥 전체로 바닥을 누르고 발끝은 정면을 향하게 해요.',
        '몸통이 비틀리며 한쪽으로 쏠림 → 두 손에 체중을 고르게 싣고 골반을 바닥과 평행하게 곧장 뒤로 보내요.',
        '반동으로 튕기듯 앉음 → 2~3초에 걸쳐 천천히 가고 끝에서 2초 멈춰요.',
      ],
      en: [
        'Rounding the low back → Go back only as far as your back stays flat, with your belly button gently drawn in.',
        'Straight-leg foot lifting or toes turning up → Press the whole sole into the floor with toes pointing forward.',
        'Twisting or leaning to one side → Keep weight even on both hands and move the pelvis straight back, level with the floor.',
        'Bouncing back → Take 2–3 seconds and pause 2 seconds at the end.',
      ],
    },
    why: {
      ko: '짧아진 허벅지 안쪽(내전근)은 무릎을 안쪽으로 끌어 X다리 경향을 키우고 골반 움직임을 막아요. 허리를 평평하게 지킨 채 고관절에서만 늘려 줘요.',
      en: 'Tight adductors pull the knees inward (knock-knee tendency) and restrict pelvic motion. This stretches them from the hip while the back stays neutral.',
    },
    muscles: { ko: '고관절 내전근(대내전근·장내전근), 안쪽 햄스트링', en: 'Hip adductors (adductor magnus and longus), medial hamstrings' },
    caution: {
      ko: '사타구니가 날카롭게 찌르듯 아프면 멈추세요. 최근 사타구니를 다쳤다면 통증이 없는 범위에서만 하세요.',
      en: 'Stop if you feel a sharp stab in the groin. If you’ve recently strained your groin, stay strictly within a pain-free range.',
    },
    avoid: ['kneePain', 'wristPain'],
    anim: {
      view: 110,
      elev: 28,
      props: [{ kind: 'mat' }],
      anchor: ['haL', 'haR'],
      keys: [
        merge(QUAD, { hipR: { flex: 87, hab: 59, rot: 2 }, knR: 0, anR: -18 }),
        merge(QUAD, {
          root: { pitch: 75 },
          hipL: { flex: 124 },
          knL: 136,
          shL: { flex: 111 },
          shR: { flex: 111 },
          elL: 0,
          elR: 0,
          wrL: 53,
          wrR: 53,
          hipR: { flex: 108, hab: 62, rot: -5 },
          knR: 0,
          anR: -42,
        }),
      ],
      labels: [
        { ko: '다리 옆으로 뻗기', en: 'Leg out to the side' },
        { ko: '엉덩이 뒤로 2초', en: 'Hips back, hold 2 s' },
      ],
      durations: [2.5, 2],
      pauses: [0.5, 2],
      focus: [{ a: 'hipR', b: 'knR', side: 'in', kind: 'stretch', r: 3 }],
      trace: ['pelvis'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'fire-hydrant',
    name: { ko: '네발에서 다리 옆으로 들기', en: 'Fire hydrant' },
    phase: 'activate',
    position: 'quadruped',
    regions: ['glute', 'hip'],
    targets: { kneeValgus: 0.7, pelvicTilt: 0.6, lateralShift: 0.4, hipPain: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 4, holdSec: 1, perSide: true, rest: 20 },
    setup: {
      ko: [
        '네발 자세를 만들어요. 손목은 어깨 바로 아래, 무릎은 골반 바로 아래에 두고 두 무릎은 주먹 하나 너비로 벌려요.',
        '배꼽을 척추 쪽으로 살짝 당겨 등을 탁자처럼 평평하게 하고, 목은 등과 일직선, 시선은 두 손 사이 바닥이에요.',
        '두 손으로 바닥을 밀어 어깨가 귀 쪽으로 처지지 않게 해요.',
      ],
      en: [
        'Get on all fours: wrists under shoulders, knees under hips and a fist-width apart.',
        'Draw your belly button in slightly so your back is flat as a table; neck in line with your back, eyes on the floor between your hands.',
        'Push the floor away so your shoulders don’t sink toward your ears.',
      ],
    },
    steps: {
      ko: [
        '오른무릎을 90도로 굽힌 모양 그대로, 무릎을 오른쪽 옆으로 2초에 걸쳐 들어 올려요.',
        '무릎이 골반 높이에 가까워질 때까지(보통 45도 정도) 들되, 골반이 왼쪽으로 기울기 직전에서 멈추고 1초 버텨요.',
        '들어 올리는 동안 체중이 왼쪽으로 쏠리지 않게 두 손과 왼무릎에 고르게 실어요.',
        '2초에 걸쳐 천천히 내려 무릎이 바닥에 닿기 직전에 멈춰요.',
        '12회 반복한 뒤 왼다리도 같은 방법으로 해요.',
      ],
      en: [
        'Keeping the right knee bent at 90°, take 2 seconds to lift it out to the side.',
        'Lift until the knee approaches hip height (usually about 45°), stopping just before your pelvis tips; hold 1 second.',
        'Keep your weight evenly on both hands and the left knee — don’t shift to the left.',
        'Take 2 seconds to lower, stopping just before the knee touches the floor.',
        'Do 12 reps, then repeat with the left leg.',
      ],
    },
    breathing: { ko: '무릎을 들어 올릴 때 입으로 내쉬고, 내릴 때 코로 들이마셔요.', en: 'Exhale as you lift the knee; inhale as you lower it.' },
    feel: {
      ko: '들어 올리는 다리의 엉덩이 옆·뒤쪽(골반 바깥)이 뻐근하게 조여 오면 정답이에요. 허리나 옆구리가 먼저 힘들거나 고관절 앞이 찝히면 높이를 줄이세요.',
      en: 'A burning squeeze on the outside/back of the working hip. If your low back or side waist works first, or the front of the hip pinches, lower the height.',
    },
    easier: {
      ko: '높이를 절반으로 줄이거나, 옆으로 누워 하는 ‘클램쉘’로 먼저 연습해요. 손목이 불편하면 팔꿈치를 대고 해요.',
      en: 'Halve the height, or practise the side-lying clamshell first. If your wrists complain, drop onto your forearms.',
    },
    harder: {
      ko: '무릎 바로 위에 미니밴드를 두르거나 가장 높은 지점에서 3초 버텨요. 이후 ‘버드독’으로 균형과 함께 연습해요.',
      en: 'Loop a mini band just above your knees or hold 3 seconds at the top. Then move on to the bird dog for balance.',
    },
    cues: { ko: ['골반은 수평으로', '무릎 90도 유지', '옆으로 천천히', '두 손으로 바닥 밀기'], en: ['Keep the pelvis level', 'Knee stays at 90', 'Lift slowly to the side', 'Push the floor away'] },
    mistakes: {
      ko: [
        '골반이 반대쪽으로 기울며 다리를 들어 올림 → 높이를 줄이고, 등 위에 물컵이 있다고 생각하며 골반을 수평으로 지켜요.',
        '허리가 아래로 처짐 → 배꼽을 척추 쪽으로 살짝 당겨 등을 평평하게 만들어요.',
        '무릎이 펴지거나 발이 먼저 올라감 → 무릎 90도를 그대로 두고 무릎부터 옆으로 들어요.',
        '빠르게 흔들듯 반복 → 2초 올리고 1초 멈춘 뒤 2초 내리는 속도를 지켜요.',
      ],
      en: [
        'Tipping the pelvis to lift higher → Lift lower and imagine a glass of water on your back.',
        'Low back sagging → Draw your belly button in gently to keep the back flat.',
        'Straightening the knee or leading with the foot → Keep the knee at 90° and lead with the knee.',
        'Swinging fast → Stick to 2 seconds up, a 1-second pause, 2 seconds down.',
      ],
    },
    why: {
      ko: '무릎이 안쪽으로 무너지지 않게 잡아 주고 걸을 때 골반을 수평으로 지켜 주는 중둔근·엉덩이 뒤쪽 근육을 깨워요. 등을 평평하게 지키는 몸통 안정성도 함께 길러요.',
      en: 'Wakes up the gluteus medius and posterior hip muscles that stop the knee caving in and keep your pelvis level when you walk, while training your trunk to stay flat and stable.',
    },
    muscles: { ko: '중둔근, 대둔근 윗부분, 고관절 외회전근, 복부(안정화)', en: 'Gluteus medius, upper gluteus maximus, hip external rotators, abdominals (stabilizing)' },
    caution: {
      ko: '고관절 앞이 찝히듯 아프면 높이를 줄이고, 계속되면 멈추세요. 바닥에 댄 무릎이 아프면 수건을 접어 받치세요.',
      en: 'If the front of the hip pinches, lift lower and stop if it continues. Pad the kneeling knee with a folded towel if it hurts.',
    },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      view: 200,
      elev: 18,
      props: [{ kind: 'mat' }],
      anchor: ['haL', 'haR'],
      keys: [QUAD, merge(QUAD, { hipR: { flex: 80, hab: 50 } })],
      labels: [
        { ko: '네발 준비', en: 'All fours' },
        { ko: '무릎 옆으로 들기', en: 'Knee out to the side' },
      ],
      durations: [2, 2],
      pauses: [0.2, 1],
      focus: [
        { a: 'hipR', b: 'knR', side: 'out', kind: 'work', from: 0, to: 0.35, r: 3.4 },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
      ],
      trace: ['knR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'donkey-kick',
    name: { ko: '네발에서 뒤로 차올리기', en: 'Quadruped donkey kick' },
    phase: 'activate',
    position: 'quadruped',
    regions: ['glute', 'core'],
    targets: { swayback: 0.6, lordosis: 0.5, lowBackPain: 0.4, kneeHyperext: 0.3, hipPain: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 4, holdSec: 2, perSide: true, rest: 20 },
    setup: {
      ko: [
        '네발 자세를 만들어요. 손목은 어깨 바로 아래, 무릎은 골반 바로 아래, 두 무릎은 골반 너비예요.',
        '배꼽을 살짝 당기고 갈비뼈를 골반 쪽으로 내려 등을 평평하게 만들어요. 시선은 두 손 사이 바닥이에요.',
        '오른무릎은 90도 그대로 두고, 오른발 발등을 몸 쪽으로 당겨 발바닥이 뒤를 향하게 준비해요.',
      ],
      en: [
        'Get on all fours: wrists under shoulders, knees under hips and hip-width apart.',
        'Draw your belly button in and let your ribs drop toward your pelvis so your back is flat. Eyes on the floor between your hands.',
        'Keep the right knee at 90° and flex the right foot so the sole faces behind you.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 오른발바닥으로 천장을 민다는 느낌으로 2초에 걸쳐 오른다리를 뒤로 들어 올려요.',
        '오른허벅지가 등과 같은 높이(바닥과 평행)가 되면 멈추고, 오른쪽 엉덩이를 꽉 조여 2초 버텨요.',
        '허리가 아래로 꺼지거나 오른쪽 골반이 들리기 직전까지만 들어요.',
        '2초에 걸쳐 천천히 내려 무릎이 바닥에 닿기 직전에 멈춰요.',
        '12회 반복한 뒤 왼다리도 같은 방법으로 해요.',
      ],
      en: [
        'Exhale and, as if pressing your right sole into the ceiling, take 2 seconds to lift the leg back and up.',
        'Stop when your right thigh is level with your back (parallel to the floor), squeeze the right glute and hold 2 seconds.',
        'Lift only until just before your low back sags or your right hip hikes up.',
        'Take 2 seconds to lower, stopping just before the knee touches down.',
        'Do 12 reps, then repeat with the left leg.',
      ],
    },
    breathing: {
      ko: '들어 올릴 때 입으로 내쉬고, 내릴 때 코로 들이마셔요. 버티는 2초 동안 숨을 참지 마세요.',
      en: 'Exhale as you lift, inhale as you lower. Don’t hold your breath during the 2-second squeeze.',
    },
    feel: {
      ko: '들어 올리는 쪽 엉덩이 가운데가 단단하게 조여 오면 정답이에요. 허리 가운데가 조이거나 뻐근하면 허리가 젖혀진 거예요 — 높이를 줄이세요. 햄스트링에 쥐가 나면 무릎 각도를 90도로 다시 맞춰요.',
      en: 'A firm squeeze in the middle of the working glute. If the middle of your low back tightens, you’re arching — lift lower. If your hamstring cramps, reset the knee to 90°.',
    },
    easier: {
      ko: '높이를 절반으로 줄이거나 팔꿈치를 대고 해요. 무릎 꿇기가 불편하면 ‘글루트 브릿지’로 대신하세요.',
      en: 'Halve the height or do it on your forearms. If kneeling is uncomfortable, do the glute bridge instead.',
    },
    harder: {
      ko: '무릎 뒤에 작은 수건을 끼워 떨어뜨리지 않게 하거나, 가장 높은 지점에서 3~5초 버텨요.',
      en: 'Tuck a small towel behind the knee and don’t let it drop, or hold 3–5 seconds at the top.',
    },
    cues: { ko: ['발바닥으로 천장 밀기', '허리는 그대로', '엉덩이 꽉 2초', '천천히 내려요'], en: ['Press the sole up', 'Low back stays still', 'Squeeze for two', 'Lower slowly'] },
    mistakes: {
      ko: [
        '허리를 젖혀 다리를 더 높이 듦 → 허벅지가 등 높이에 오면 멈추고, 배꼽을 당겨 등을 평평하게 지켜요.',
        '골반이 들어 올리는 쪽으로 돌아감 → 두 골반뼈가 바닥을 똑같이 보게 하고 높이를 줄여요.',
        '무릎이 펴지며 발로 차 버림 → 무릎 90도를 그대로 두고 발바닥이 천장을 향해 곧게 올라가게 해요.',
        '반동으로 휘두름 → 2초 올리고 2초 버틴 뒤 2초 내려요.',
      ],
      en: [
        'Arching to lift higher → Stop when your thigh reaches back height and keep your belly drawn in.',
        'Pelvis rotating toward the working side → Keep both hip bones facing the floor evenly and lift lower.',
        'Straightening the knee and kicking out → Keep the knee at 90° so the sole rises straight toward the ceiling.',
        'Swinging with momentum → 2 seconds up, a 2-second squeeze, 2 seconds down.',
      ],
    },
    why: {
      ko: '오래 앉아 잠든 대둔근이 허리 대신 고관절을 펴도록 가르쳐요. 골반을 뒤에서 받쳐 주는 힘이 생겨 골반 앞쏠림과 허리 부담을 줄이는 데 도움이 돼요.',
      en: 'Teaches the gluteus maximus — switched off by sitting — to extend the hip instead of the low back, supporting the pelvis from behind and reducing anterior tilt and back strain.',
    },
    muscles: { ko: '대둔근, 햄스트링(보조), 복부·척추 안정근', en: 'Gluteus maximus, hamstrings (assisting), abdominal and spinal stabilizers' },
    caution: { ko: '허리에 통증이 생기면 높이를 줄이고, 그래도 아프면 멈추세요.', en: 'If your low back hurts, lift lower; stop if it persists.' },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['haL', 'haR'],
      keys: [QUAD, merge(QUAD, { hipR: { flex: -2 }, knR: 90, anR: 0 })],
      labels: [
        { ko: '네발 준비', en: 'All fours' },
        { ko: '발바닥 천장으로 2초', en: 'Sole to ceiling, 2 s' },
      ],
      durations: [2, 2],
      pauses: [0.2, 2],
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.2 },
      ],
      trace: ['heelR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'single-leg-bridge',
    name: { ko: '한 다리 브리지', en: 'Single-leg glute bridge' },
    phase: 'activate',
    position: 'supine',
    regions: ['glute', 'core', 'hip'],
    targets: { pelvicTilt: 0.6, lateralShift: 0.6, swayback: 0.6, lordosis: 0.5, lowBackPain: 0.5, kneeValgus: 0.4 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, holdSec: 2, perSide: true, rest: 25 },
    setup: {
      ko: [
        '매트에 바로 누워 두 무릎을 세우고, 발은 골반 너비로 벌려 발뒤꿈치를 엉덩이에서 약 25~30cm 떨어뜨려요.',
        '두 팔은 몸 옆 바닥에 45도로 벌려 손바닥을 바닥에 대요.',
        '왼다리를 쭉 펴서 들어 올려 왼허벅지가 오른허벅지와 나란하게(무릎 높이가 같게) 둬요. 오른발뒤꿈치로 바닥을 지그시 눌러 준비해요.',
      ],
      en: [
        'Lie on your back with knees bent, feet hip-width apart, heels about 25–30 cm from your buttocks.',
        'Rest your arms on the floor at 45° from your body, palms down.',
        'Straighten your left leg and lift it so both thighs are parallel (knees level). Press your right heel lightly into the floor.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 배꼽을 살짝 당기고, 오른발뒤꿈치로 바닥을 밀어 2초에 걸쳐 엉덩이를 들어 올려요.',
        '어깨-골반-오른무릎이 일직선이 되면 멈추고, 양쪽 골반 높이가 같은지 확인하며 오른쪽 엉덩이를 조여 2초 버텨요.',
        '들어 올린 왼다리는 오른허벅지와 나란한 높이를 계속 유지해요.',
        '2초에 걸쳐 등 위쪽부터 천천히 내려와 엉덩이가 바닥에 살짝 닿으면 다시 시작해요.',
        '8회 반복한 뒤 다리를 바꿔 왼발로 바닥을 밀며 해요.',
      ],
      en: [
        'Exhale, draw your belly in slightly and drive through your right heel, taking 2 seconds to lift your hips.',
        'Stop when shoulders, hips and right knee form a line. Check both sides of the pelvis are level, squeeze the right glute and hold 2 seconds.',
        'Keep the lifted left thigh parallel to the right thigh the whole time.',
        'Take 2 seconds to lower, upper back first; lightly touch the hips down and go again.',
        'Do 8 reps, then switch and push through the left foot.',
      ],
    },
    breathing: {
      ko: '들어 올릴 때 입으로 내쉬고, 위에서 버티는 2초 동안 짧게 숨을 이어 쉬고, 내려오며 코로 들이마셔요.',
      en: 'Exhale as you lift, keep breathing lightly during the 2-second hold, and inhale through your nose as you lower.',
    },
    feel: {
      ko: '바닥을 미는 쪽 엉덩이와 허벅지 뒤쪽 윗부분이 단단하게 조여 오면 정답이에요. 허리가 뻐근하면 너무 높이 든 거고, 햄스트링에 쥐가 나면 발을 엉덩이 쪽으로 5cm 당겨요.',
      en: 'A strong squeeze in the working glute and upper hamstring. A low-back ache means you’re lifting too high; a hamstring cramp means bring the foot 5 cm closer.',
    },
    easier: {
      ko: '들어 올린 다리를 펴지 말고 무릎을 가슴 쪽으로 끌어안은 채 해요(허리가 덜 젖혀져요). 그래도 힘들면 ‘브리지 들고 제자리 걷기’나 두 발 ‘글루트 브릿지’로 먼저 연습해요.',
      en: 'Instead of straightening the free leg, hug that knee toward your chest (this also stops arching). Still too hard? Practise the marching bridge or the two-leg glute bridge first.',
    },
    harder: {
      ko: '위에서 5초 버티거나, 바닥을 미는 발을 5~10cm 높이의 낮은 받침 위에 올려서 해요.',
      en: 'Hold 5 seconds at the top, or place the working foot on a low 5–10 cm step.',
    },
    cues: { ko: ['뒤꿈치로 밀어요', '골반은 수평', '엉덩이 꽉 2초', '천천히 내려요'], en: ['Drive through the heel', 'Keep the pelvis level', 'Squeeze for two', 'Lower slowly'] },
    mistakes: {
      ko: [
        '들어 올린 다리 쪽 골반이 처짐 → 높이를 줄이고, 양쪽 골반뼈에 손을 얹어 수평인지 확인해요.',
        '허리를 젖혀 높이 듦 → 어깨-골반-무릎이 일직선이 되면 멈추고 갈비뼈를 아래로 내려요.',
        '바닥을 미는 무릎이 안쪽으로 모임 → 무릎이 둘째 발가락 방향을 향하게 유지해요.',
        '발끝으로 밀어 허벅지 앞만 힘듦 → 발끝을 살짝 들 듯 뒤꿈치로 바닥을 밀어요.',
      ],
      en: [
        'Hip dropping on the lifted-leg side → Lift lower and rest your hands on your hip bones to check they’re level.',
        'Arching to lift higher → Stop at a straight shoulder–hip–knee line and draw your ribs down.',
        'Working knee caving in → Keep the knee pointing over your second toe.',
        'Pushing through the toes (front thigh burns) → Drive through the heel, as if lifting the toes slightly.',
      ],
    },
    why: {
      ko: '한 다리로 골반을 받치며 대둔근·중둔근을 함께 써서, 걷거나 계단을 오를 때 골반이 한쪽으로 처지거나 돌아가지 않게 하는 힘을 길러요. 좌우 힘 차이도 드러나요.',
      en: 'Loads one side at a time so the glute max and medius learn to hold the pelvis level against rotation — the control you need for walking and stairs — and reveals side-to-side differences.',
    },
    muscles: { ko: '대둔근, 중둔근, 햄스트링, 복부(회전 방지)', en: 'Gluteus maximus and medius, hamstrings, abdominals (anti-rotation)' },
    caution: { ko: '허리나 무릎에 통증이 생기면 두 발 ‘글루트 브릿지’로 돌아가세요.', en: 'If your low back or knee hurts, go back to the two-leg glute bridge.' },
    avoid: ['lowBackSevere'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['heelR'],
      keys: [merge(HOOK_FLAT, { hipL: { flex: 49 }, knL: 0, anL: 0 }), merge(BRIDGE_UP, { hipL: { flex: 0 }, knL: 0, anL: 0 })],
      labels: [
        { ko: '왼다리 펴고 준비', en: 'Left leg straight' },
        { ko: '뒤꿈치로 밀어 2초', en: 'Drive up, hold 2 s' },
      ],
      durations: [2, 2],
      pauses: [0.3, 2],
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'hipR', b: 'knR', side: 'back', kind: 'work', from: 0.1, to: 0.5, r: 2.6 },
      ],
      trace: ['pelvis'],
    },
    coach: {
      view: 'side',
      metric: 'hipAngle',
      mode: 'reps',
      rest: 140,
      peak: 158,
      dir: 1,
      hint: { ko: '바닥을 미는 다리 쪽에서 온몸이 보이게 휴대폰을 바닥 높이에 두세요', en: 'Place the phone at floor level on your working-leg side so your whole body is visible' },
      more: { ko: '엉덩이를 조금 더 높이', en: 'Hips a little higher' },
      good: { ko: '좋아요, 골반 수평!', en: 'Great, pelvis level!' },
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'marching-bridge',
    name: { ko: '브리지 들고 제자리 걷기', en: 'Marching bridge' },
    phase: 'activate',
    position: 'supine',
    regions: ['glute', 'core'],
    targets: { lateralShift: 0.6, pelvicTilt: 0.6, lordosis: 0.5, lowBackPain: 0.5, swayback: 0.5 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 6, tempo: 7, holdSec: 4, rest: 25 },
    setup: {
      ko: [
        '매트에 바로 누워 두 무릎을 세우고, 발은 골반 너비로 벌려 발뒤꿈치를 엉덩이에서 약 25~30cm 떨어뜨려요.',
        '두 팔은 몸 옆 바닥에 45도로 벌려 손바닥으로 바닥을 눌러 몸을 받쳐요.',
        '숨을 내쉬며 엉덩이를 들어 어깨-골반-무릎을 일직선으로 만들어요. 이 높이가 시작 자세예요.',
      ],
      en: [
        'Lie on your back with knees bent, feet hip-width apart, heels about 25–30 cm from your buttocks.',
        'Rest your arms on the floor at 45°, palms pressing down for support.',
        'Exhale and lift your hips until shoulders, hips and knees form a line. This is your start position.',
      ],
    },
    steps: {
      ko: [
        '엉덩이 높이를 그대로 둔 채, 오른발을 바닥에서 5~10cm만 2초에 걸쳐 천천히 들어요(무릎 각도는 그대로).',
        '골반이 오른쪽으로 처지거나 돌아가지 않게 왼발뒤꿈치로 바닥을 밀며 2초 버텨요.',
        '오른발을 소리 없이 내려놓고 두 발로 1초 받쳐요.',
        '이번엔 왼발을 같은 방법으로 들어 2초 버티고 내려요.',
        '오른발·왼발 한 번씩이 1회예요. 6회(한쪽 6번) 한 뒤 엉덩이를 천천히 내려와 쉬어요.',
      ],
      en: [
        'Keeping your hips at the same height, take 2 seconds to lift your right foot just 5–10 cm off the floor (knee angle unchanged).',
        'Drive through your left heel so your pelvis doesn’t drop or rotate to the right, and hold 2 seconds.',
        'Place the right foot down silently and support on both feet for 1 second.',
        'Now lift the left foot the same way, hold 2 seconds and lower.',
        'One right plus one left is 1 rep. Do 6 reps (6 lifts per side), then lower your hips slowly and rest.',
      ],
    },
    breathing: {
      ko: '발을 들 때 입으로 내쉬고, 발을 내려놓을 때 코로 들이마셔요. 브리지를 버티는 동안 숨을 참지 마세요.',
      en: 'Exhale as each foot lifts, inhale as it lowers. Keep breathing throughout the bridge.',
    },
    feel: {
      ko: '바닥을 딛고 있는 쪽 엉덩이와 허벅지 뒤쪽이 단단해지고, 옆구리가 골반을 붙잡는 느낌이면 정답이에요. 허리가 뻐근하면 엉덩이를 조금 낮추세요.',
      en: 'The standing-side glute and hamstring firm up and your sides work to hold the pelvis still. If your low back aches, lower your hips a little.',
    },
    easier: {
      ko: '발을 통째로 들지 말고 뒤꿈치만 1~2cm 들었다 놓거나, 두 발 ‘글루트 브릿지’로 먼저 연습해요.',
      en: 'Lift only the heel 1–2 cm instead of the whole foot, or practise the regular glute bridge first.',
    },
    harder: {
      ko: '무릎을 가슴 쪽으로 끌어 올려 허벅지가 바닥과 수직이 될 때까지 들거나, ‘한 다리 브리지’로 넘어가요.',
      en: 'Draw the knee up until the thigh is vertical, or progress to the single-leg bridge.',
    },
    cues: { ko: ['엉덩이 높이 그대로', '골반은 수평', '발은 살짝만', '뒤꿈치로 밀어요'], en: ['Hips stay high', 'Pelvis level', 'Lift just a little', 'Push through the heel'] },
    mistakes: {
      ko: [
        '발을 들 때 골반이 처지거나 돌아감 → 발을 더 낮게 들고, 딛고 있는 발뒤꿈치로 바닥을 더 세게 밀어요.',
        '엉덩이 높이가 점점 내려감 → 매 회 시작 전에 어깨-골반-무릎 일직선을 다시 맞춰요.',
        '허리를 젖혀 버팀 → 갈비뼈를 골반 쪽으로 내리고 배꼽을 살짝 당겨요.',
        '빠르게 걷듯 발을 바꿈 → 한 발씩 2초 들고 2초 버틴 뒤 내려요.',
      ],
      en: [
        'Pelvis dropping or rotating as the foot lifts → Lift the foot lower and push harder through the standing heel.',
        'Hips sinking over time → Reset the shoulder–hip–knee line before each rep.',
        'Arching to hold the bridge → Draw your ribs down toward your pelvis and your belly in.',
        'Switching feet quickly like jogging → Lift each foot for 2 seconds, hold 2, then lower.',
      ],
    },
    why: {
      ko: '브리지를 버틴 채 한 발씩 떼면 엉덩이와 몸통이 골반의 기울어짐·돌아감을 막아야 해요. 걸을 때 골반이 한쪽으로 처지는 습관과 허리 부담을 줄이는 데 좋아요.',
      en: 'Lifting one foot from a bridge forces the glutes and trunk to stop the pelvis tipping and rotating — great for hips that drop to one side when walking and for sparing the low back.',
    },
    muscles: { ko: '대둔근, 중둔근, 햄스트링, 복사근·복횡근', en: 'Gluteus maximus and medius, hamstrings, obliques and transversus abdominis' },
    caution: {
      ko: '허리나 햄스트링에 쥐나 통증이 생기면 엉덩이를 내리고 쉬었다가, 발을 몸 쪽으로 조금 당겨 다시 해요.',
      en: 'If your back or hamstrings cramp or hurt, lower down, rest and bring your feet a little closer before trying again.',
    },
    avoid: ['lowBackSevere'],
    anim: {
      view: 70,
      elev: 16,
      props: [{ kind: 'mat' }],
      anchor: ['backTop'],
      keys: [
        BRIDGE_UP,
        merge(BRIDGE_UP, { hipR: { flex: 13 }, knR: 88, anR: -16 }),
        BRIDGE_UP,
        merge(BRIDGE_UP, { hipL: { flex: 13 }, knL: 88, anL: -16 }),
      ],
      labels: [
        { ko: '브리지 들고 버티기', en: 'Hold the bridge' },
        { ko: '오른발 살짝 들기', en: 'Lift right foot' },
        { ko: '내려놓고 두 발로', en: 'Both feet down' },
        { ko: '왼발 살짝 들기', en: 'Lift left foot' },
      ],
      durations: [1.5, 1.2, 1.5, 1.2],
      pauses: [1, 2, 1, 2],
      focus: [
        { a: 'pelvis', b: 'hipL', side: 'back', kind: 'work', r: 4 },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.2 },
      ],
      trace: ['heelR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'standing-hip-circle',
    name: { ko: '서서 고관절 크게 돌리기', en: 'Standing hip circles' },
    phase: 'mobility',
    position: 'standing',
    regions: ['hip'],
    targets: { stiffness: 0.7, hipPain: 0.6, lowBackPain: 0.3, pelvicTilt: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 6, perSide: true, rest: 15 },
    desk: true,
    setup: {
      ko: [
        '벽(또는 튼튼한 책상) 옆에 서서 왼손을 어깨 높이로 벽에 가볍게 대요.',
        '두 발은 골반 너비, 발끝은 정면이에요. 왼무릎은 살짝 풀어 두고 체중을 왼발로 옮겨요.',
        '오른손은 허리에 얹고, 배꼽을 살짝 당겨 골반과 가슴이 정면을 향하게 고정해요.',
      ],
      en: [
        'Stand beside a wall (or sturdy desk) and rest your left hand on it at shoulder height.',
        'Feet hip-width apart, toes forward. Soften the left knee and shift your weight onto the left foot.',
        'Put your right hand on your hip and draw your belly in so your pelvis and chest stay facing forward.',
      ],
    },
    steps: {
      ko: [
        '오른무릎을 90도로 굽혀 앞으로 들어 올려요. 허벅지가 바닥과 평행한 높이까지 2초에 걸쳐요.',
        '골반과 몸통은 정면에 고정한 채, 무릎을 오른쪽 옆으로 2초에 걸쳐 최대한 크게 열어요.',
        '무릎을 아래로 돌려 내리며 허벅지를 몸 옆에서 살짝 뒤로 보내요(2초). 발뒤꿈치는 엉덩이 쪽을 향해요.',
        '허벅지를 몸 아래로 모아 처음 자세로 돌아와 발을 내려요.',
        '한 바퀴에 5~6초씩 8회 반복한 뒤 다리를 바꿔요. 골반과 허리가 따라 돌지 않는 범위에서만 크게 그려요.',
      ],
      en: [
        'Bend your right knee to 90° and take 2 seconds to lift it in front of you until the thigh is level with your hip.',
        'Keeping your pelvis and trunk facing forward, take 2 seconds to open the knee out to the right as far as you can.',
        'Rotate the knee down and let the thigh travel slightly behind you at your side (2 seconds), heel pointing toward your buttock.',
        'Bring the thigh back under you to the start and set the foot down.',
        'Take 5–6 seconds per circle for 8 reps, then switch legs. Make the circle as big as you can without your pelvis or low back turning.',
      ],
    },
    breathing: {
      ko: '무릎을 들어 올리고 옆으로 열 때 코로 들이마시고, 아래·뒤로 돌려 내릴 때 입으로 길게 내쉬어요.',
      en: 'Inhale through your nose as you lift and open the knee; exhale slowly as you circle it down and back.',
    },
    feel: {
      ko: '고관절 깊은 곳이 구석구석 돌아가는 느낌과, 엉덩이·사타구니 주변이 번갈아 조였다 풀리는 느낌이면 정답이에요. 고관절 앞이 찝히거나 딸깍하며 아프면 그 구간은 원을 작게 그리세요.',
      en: 'A sense of the hip joint turning through every corner, with the muscles around the buttock and groin taking turns to work and let go. If the front of the hip pinches or clicks painfully, make that part of the circle smaller.',
    },
    easier: {
      ko: '무릎을 허리 높이까지 들지 말고 절반 높이에서 작은 원을 그려요. 균형이 불안하면 두 손으로 벽이나 의자 등받이를 잡아요.',
      en: 'Lift the knee only halfway and draw a smaller circle. If balance is shaky, hold the wall or a chair back with both hands.',
    },
    harder: {
      ko: '같은 원을 반대 방향(뒤→옆→앞)으로도 8회 해요. 익숙해지면 손을 벽에서 떼고 해요.',
      en: 'Add 8 reps in the reverse direction (back → side → front). Once steady, let go of the wall.',
    },
    cues: { ko: ['골반은 정면 고정', '무릎을 앞으로', '옆으로 크게 열고', '천천히 아래로'], en: ['Pelvis faces forward', 'Knee up in front', 'Open wide to the side', 'Slowly down and back'] },
    mistakes: {
      ko: [
        '골반과 몸통이 다리를 따라 돌아감 → 오른손으로 골반을 눌러 고정하고, 원을 골반이 움직이기 직전 크기로 줄여요.',
        '딛고 있는 무릎이 완전히 펴져 잠김 → 왼무릎을 살짝 굽혀 두고 발바닥 세 점(엄지 뿌리·새끼 뿌리·뒤꿈치)으로 서요.',
        '상체가 옆으로 기울어짐 → 정수리를 천장으로 길게 뻗고 어깨 높이를 수평으로 유지해요.',
        '빠르게 휘두름 → 한 바퀴에 5~6초, 모든 구간을 같은 속도로 천천히 그려요.',
      ],
      en: [
        'Pelvis and trunk turning with the leg → Press your right hand on your hip to hold it and shrink the circle to just before the pelvis moves.',
        'Locking the standing knee → Keep the left knee soft and stand on the three points of the foot (big-toe base, little-toe base, heel).',
        'Leaning sideways → Reach the crown of your head up and keep your shoulders level.',
        'Swinging fast → Take 5–6 seconds per circle, moving at an even, slow pace throughout.',
      ],
    },
    why: {
      ko: '고관절의 굽힘·벌림·돌림·폄을 한 바퀴에 천천히 모두 써서, 오래 앉아 굳은 고관절을 매끄럽게 하고 허리가 대신 움직이는 버릇을 줄여 줘요.',
      en: 'Slowly takes the hip through flexion, abduction, rotation and extension in one circle, loosening a hip stiffened by sitting and reducing the habit of moving from the low back instead.',
    },
    muscles: {
      ko: '장요근, 중둔근·소둔근, 고관절 회전근, 대둔근, 서 있는 다리의 중둔근',
      en: 'Iliopsoas, gluteus medius and minimus, hip rotators, gluteus maximus, and the standing-leg glute medius',
    },
    caution: {
      ko: '균형이 흔들리면 두 손으로 지지대를 잡으세요. 고관절 인공관절 수술을 받았다면 전문가와 먼저 상의하세요.',
      en: 'If you feel unsteady, hold the support with both hands. If you’ve had a hip replacement, check with your clinician first.',
    },
    avoid: ['balance'],
    anim: {
      view: 25,
      elev: 30,
      props: [{ kind: 'wall', wall: 'left' }],
      anchor: ['heelL', 'toeL'],
      keys: [
        STAND_WALL,
        merge(STAND_WALL, { hipR: { flex: 90 }, knR: 90 }),
        merge(STAND_WALL, { hipR: { flex: 90, hab: 65 }, knR: 90 }),
        merge(STAND_WALL, { hipR: { flex: -12, abd: 22, rot: -20 }, knR: 90 }),
      ],
      labels: [
        { ko: '벽 짚고 바르게 서기', en: 'Stand tall, hand on wall' },
        { ko: '무릎 앞으로 들기', en: 'Knee up in front' },
        { ko: '옆으로 크게 열기', en: 'Open out to the side' },
        { ko: '아래·뒤로 돌려 내리기', en: 'Circle down and back' },
      ],
      durations: [1.3, 1.3, 1.3, 1.3],
      pauses: [0.4, 0.3, 0.3, 0.3],
      holdKey: 2,
      focus: [
        { a: 'waist', b: 'hipR', side: 'front', kind: 'work', r: 2.6 },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 4 },
      ],
      trace: ['knR'],
    },
  },
];
