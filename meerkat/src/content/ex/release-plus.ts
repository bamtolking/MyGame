/**
 * 운동 라이브러리 · 풀기(마사지볼·폼롤러·손) (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 *
 * 풀기 공통 원칙: 10점 중 4~5 정도의 “아프지만 시원한” 압력, 천천히(1초에 1~3cm) 굴리기,
 * 뻐근한 지점에서 10~15초 멈추기, 뼈·관절·신경이 지나는 자리는 피하기.
 * 굴리는 동작(날개뼈 안쪽·발바닥·허벅지 앞·종아리)은 공·폼롤러가 제자리에 있고 몸이 그 위를 지나가는 모습이 보이도록,
 * 소품을 움직이지 않는 관절(바닥에 고정된 발·손·팔꿈치)에 붙였어요. 가슴·엉덩이 공은 몸에 붙여 두었어요.
 */
import { both, type Pose } from '../../figure/rig';
import { SIT, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서만 쓰는 자세 ─────────────────────

/** 가슴 풀기: 벽을 마주 보고 몸 전체를 10° 기울여 오른쪽 쇄골 아래 공에 기댐. 고개는 오른쪽(공 쪽)으로 돌려 얼굴이 벽에 닿지 않게 */
const PEC_LEAN: Pose = merge(STAND, { root: { pitch: 10 } }, both({ an: 10 }), {
  neck: { flex: 2, twist: -25 },
  head: { flex: 4, twist: -20 },
  // 왼손은 허리 높이 벽을 짚어 압력 조절
  shL: { flex: 10, abd: 8 },
  elL: 60,
  wrL: -57,
});
/** 오른팔: 힘 빼고 늘어뜨림 → 팔꿈치 90° W자(어깨 높이) → 머리 위 Y자 (손바닥은 앞) */
const PEC_ARM_DOWN: Pose = { shR: { flex: 10, abd: 6 }, elR: 10 };
const PEC_ARM_W: Pose = { shR: { flex: 0, abd: 90, rot: 90 }, elR: 90 };
const PEC_ARM_UP: Pose = { shR: { flex: 10, abd: 155, rot: 90 }, elR: 12 };

/** 날개뼈 안쪽 풀기: 벽에 등을 기댐(몸 8° 뒤로), 오른팔은 가슴 앞을 가로질러 왼어깨를 잡고 왼손은 오른 팔꿈치를 받침 */
const UB_BODY: Pose = merge(STAND, { root: { pitch: -8 }, neck: { flex: 10 }, head: { flex: 4 } });
const UB_ARMS: Pose = {
  scapR: { prot: 2.5 },
  shR: { flex: 60.2, abd: 22.6, hab: -40, rot: -33.1 },
  elR: 115.6,
  shL: { flex: -1.2, abd: 44.9, hab: -60.9, rot: -4.4 },
  elL: 97,
  wrL: 21.4,
};
/** 왼손으로 오른 팔꿈치를 왼쪽으로 2~3cm 더 당김(날개뼈가 더 벌어짐) */
const UB_ARMS_PULL: Pose = {
  scapR: { prot: 4 },
  shR: { flex: 59.1, abd: 20.8, hab: -54.3, rot: -30.1 },
  elR: 113.5,
  shL: { flex: -8.5, abd: 46.3, hab: -56.3, rot: -7.8 },
  elL: 103.2,
  wrL: 25.9,
};
/** 무릎을 살짝(20°) / 깊게(55°) 굽힘 — 발은 그대로, 등의 공 닿는 면이 벽과 같은 거리를 유지 */
const UB_KNEES_SOFT: Pose = both({ hip: { flex: 12, abd: 4 }, kn: 20, an: 0 });
const UB_KNEES_BENT: Pose = both({ hip: { flex: 29.7, abd: 4 }, kn: 55, an: 17.3 });

/** 엉덩이 풀기: 바닥에서 공 위에 앉아(오른쪽 엉덩이) 두 손은 엉덩이 뒤 바닥, 왼발은 바닥에, 오른발목은 왼무릎 위(4자) */
const GL_FIG4: Pose = { hipR: { flex: 106.6, abd: -18.4, rot: 90, hab: 31.9 }, knR: 122.6, anR: -25 };
const GL_SIT: Pose = merge(
  { root: { pitch: -25 }, neck: { flex: 18 }, head: { flex: 4 } },
  both({ sh: { flex: -24.1 }, el: 4, wr: -62 }),
  { hipL: { flex: 97.8, abd: 8 }, knL: 92.1, anL: -30.7 },
  GL_FIG4,
);
/** 공 쪽(오른쪽)으로 10° 기울임: 손·왼발은 바닥 그대로, 상체는 세워 머리는 가운데 */
const GL_LEAN: Pose = merge(
  { root: { pitch: -25, roll: -10 }, thorax: { side: 11.3 }, neck: { flex: 18 }, head: { flex: 4 } },
  { shL: { flex: -26.3, abd: 3.6 }, shR: { flex: -23.9, abd: -3.7 }, elL: 4, elR: 4, wrL: -54.3, wrR: -54.3 },
  { hipL: { flex: 92.9, abd: 4.7 }, knL: 88.4, anL: -30.7 },
  GL_FIG4,
);
/** 발목은 왼무릎 위에 둔 채 오른무릎을 바깥으로 약 10cm 떨어뜨림 */
const GL_KNEE_OUT: Pose = merge(GL_LEAN, { hipR: { flex: 84.8, abd: -15.2, rot: 105.7, hab: 29 } });

/** 발바닥: 공이 아치 / 발볼 / 뒤꿈치 앞에 오도록 오른발을 앞뒤로 (공은 바닥에 고정) */
const FOOT_ARCH: Pose = { hipR: { flex: 104.5, abd: 8 }, knR: 92.1, anR: -11.9 };
const FOOT_BALL: Pose = { hipR: { flex: 105.3, abd: 8 }, knR: 104.2, anR: 0.8 };
const FOOT_HEEL: Pose = { hipR: { flex: 101.4, abd: 8 }, knR: 78.9, anR: -22.9 };

/** 아래팔: 책상에 오른쪽 아래팔을 손바닥이 위로 가게 올리고(손목은 책상 끝), 왼손 엄지로 아래팔 안쪽을 누름 */
const FA_BASE: Pose = merge(SIT, { lumbar: { flex: 4 }, thorax: { flex: 6 }, neck: { flex: 6 }, head: { flex: 10 } }, {
  shR: { flex: 54.1, abd: 19.4, hab: -9.4 },
  elR: 43.7,
  shL: { flex: 59.3, abd: 32.2, hab: -23.8, rot: -42.7 },
  elL: 88.1,
  wrL: -30.6,
});

/** 허벅지 앞: 팔꿈치로 받친 엎드린 자세(몸통 수평), 오른허벅지는 롤러 위, 왼다리는 옆으로 굽혀 바닥에 */
const quadPose = (pitch: number, sh: number, el: number, hipR: number, hipL: number): Pose =>
  merge({ root: { pitch }, neck: { flex: -4 }, head: { flex: 8 } }, both({ sh: { flex: sh, abd: 6 }, el }), {
    hipR: { flex: hipR, abd: 2 },
    knR: 5,
    anR: -35,
    hipL: { flex: hipL, abd: 60, rot: 90 },
    knL: 85,
    anL: -65,
  });

/** 종아리: 바닥에 앉아 두 손은 엉덩이 뒤, 오른종아리는 롤러 위, 왼발목은 오른 정강이(발목 위)에 포갬 */
const calfPose = (pitch: number, sh: number, el: number, wr: number, hipR: number, knR: number, hipL: number, habL: number, knL: number): Pose =>
  merge({ root: { pitch }, neck: { flex: -pitch * 0.8 }, head: { flex: 6 } }, both({ sh: { flex: sh, abd: 8 }, el, wr }), {
    hipR: { flex: hipR, abd: 4 },
    knR,
    anR: -20,
    hipL: { flex: hipL, abd: 2, hab: habL },
    knL,
    anL: -25,
  });

export const RELEASE_PLUS: Exercise[] = [
  // ─────────────────────────────────────────────
  {
    id: 'ball-pec-release',
    name: { ko: '마사지볼로 가슴 풀기', en: 'Massage ball pec release' },
    phase: 'release',
    position: 'wall',
    regions: ['chest', 'shoulder'],
    targets: { roundShoulder: 1, kyphosis: 0.4, shoulderPain: 0.4, fhp: 0.3, stiffness: 0.3 },
    equipment: ['ball', 'wall'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 60, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '벽(또는 문틀 모서리)을 마주 보고 서서 발을 골반 너비로 벌리고, 발끝을 벽에서 약 25cm 떨어뜨려요.',
        '오른쪽 쇄골 바로 아래, 어깨 앞 둥근 뼈에서 가슴 쪽으로 손가락 2~3개 들어온 곳에 마사지볼을 대요.',
        '공을 가슴과 벽 사이에 끼우고, 고개는 편하게 오른쪽으로 돌려요.',
        '왼손은 허리 높이의 벽을 짚어 압력을 조절하고, 오른팔은 몸 옆에 힘을 빼고 늘어뜨려요.',
      ],
      en: [
        'Stand facing a wall (or the edge of a door frame), feet hip-width apart, toes about 25 cm from the wall.',
        'Place the massage ball just below your right collarbone, two or three finger-widths in from the bony front of the shoulder toward your chest.',
        'Trap the ball between your chest and the wall, and turn your head comfortably to the right.',
        'Put your left hand on the wall at waist height to control the pressure, and let your right arm hang relaxed.',
      ],
    },
    steps: {
      ko: [
        '몸을 벽 쪽으로 기울여 공에 체중을 실어요. 10점 중 4~5 정도의 “아프지만 시원한” 압력이면 충분해요.',
        '무릎을 살짝 굽혔다 펴고 몸을 좌우로 1~2cm씩 움직여, 공이 500원 동전 크기의 작은 원을 그리며 20초 동안 천천히 굴러가게 해요.',
        '유난히 뻐근한 곳을 찾으면 그 자리에서 멈추고, 숨을 길게 내쉬며 10초 기다려요.',
        '공을 누른 채 오른팔을 옆으로 벌려, 팔꿈치를 90도로 굽힌 W자(손은 귀 높이)를 만들어요. 손바닥은 벽 쪽을 향해요.',
        '3초에 걸쳐 팔을 펴며 아프지 않은 높이(보통 머리 위 Y자)까지 올리고, 3초에 걸쳐 W자를 지나 내려요. 4~5회(약 30초) 반복해요.',
        '벽에서 천천히 떨어져 어깨를 가볍게 두 번 돌린 뒤, 반대쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Lean toward the wall to put your weight into the ball — about 4–5 out of 10, a “hurts-so-good” pressure, is plenty.',
        'Bend and straighten your knees slightly and shift 1–2 cm side to side so the ball rolls in small coin-sized circles for 20 seconds.',
        'When you find a particularly tight spot, stop there and wait 10 seconds with a long exhale.',
        'Keeping the pressure, take your right arm out to the side into a “W” — elbow bent 90°, hand at ear height, palm facing the wall.',
        'Over 3 seconds, straighten the arm up into a “Y” as high as is pain-free (usually overhead), then take 3 seconds to lower back through the W. Repeat 4–5 times (about 30 seconds).',
        'Ease away from the wall, roll your shoulders twice, then do the other side the same way.',
      ],
    },
    breathing: {
      ko: '코로 편하게 들이마시고, 공에 기대거나 팔을 올릴 때 입으로 “후—” 길게 내쉬어요. 내쉴 때마다 가슴과 어깨의 힘을 빼 공이 조금 더 깊이 들어가게 해요.',
      en: 'Breathe in easily through your nose and exhale long through your mouth as you lean in or raise the arm. Let your chest and shoulder soften on each exhale so the ball sinks in a little deeper.',
    },
    feel: {
      ko: '쇄골 아래 가슴 앞쪽이 뻐근하면서 시원하고, 팔을 올릴 때 그 부분이 공 밑에서 늘어나는 느낌이면 정답이에요. 팔이나 손으로 찌릿함·저림이 내려가거나 날카로운 통증이 있으면 공을 가슴 가운데 쪽으로 옮기거나 압력을 줄여요.',
      en: 'An achy-but-good pressure in the front of the chest below the collarbone, with that area lengthening under the ball as the arm rises. If tingling or numbness runs down the arm or into the hand, or you feel sharp pain, move the ball toward the middle of your chest or ease off.',
    },
    easier: {
      ko: '벽에 덜 기대 압력을 줄이거나, 공 대신 손가락 끝으로 같은 자리를 지그시 누르며 팔을 움직여요. 팔 올리기는 어깨 높이까지만 해도 괜찮아요.',
      en: 'Lean less to reduce the pressure, or press the same spot with your fingertips instead of the ball while moving the arm. Raising the arm only to shoulder height is fine.',
    },
    harder: {
      ko: '뻐근한 지점에 머문 채 팔 올리기를 8회로 늘리거나, 풀고 난 뒤 바로 ‘벽 가슴 스트레칭’으로 이어서 늘려요.',
      en: 'Stay on the tight spot and increase the arm sweeps to 8, or go straight into the wall pec stretch afterwards.',
    },
    cues: { ko: ['공에 체중 실어요', '작은 원을 그려요', '팔은 천천히 올려요', '숨 길게 내쉬어요'], en: ['Lean into the ball', 'Small circles', 'Raise the arm slowly', 'Long exhales'] },
    mistakes: {
      ko: [
        '어깨 관절 바로 앞이나 겨드랑이를 누름 → 어깨 앞 둥근 뼈에서 손가락 2~3개 안쪽, 쇄골 아래 가슴 근육 위에 공을 둬요.',
        '너무 세게 기대 숨이 막힘 → 10점 중 4~5 압력으로 줄이고, 왼손으로 벽을 밀어 조절해요.',
        '팔을 빠르게 휘두름 → 3초 올리고 3초 내리며, 아프지 않은 높이까지만 움직여요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 날개뼈를 뒷주머니 쪽으로 내린 채 팔을 올려요.',
      ],
      en: [
        'Pressing right on the shoulder joint or into the armpit → Keep the ball on the chest muscle below the collarbone, two or three finger-widths in from the front of the shoulder.',
        'Leaning so hard you can’t breathe → Drop to 4–5 out of 10 and control it by pushing the wall with your left hand.',
        'Swinging the arm quickly → 3 seconds up, 3 seconds down, only as high as is pain-free.',
        'Shoulder hiking toward the ear → Keep the shoulder blade drawn down toward your back pocket as the arm rises.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 짧아지는 소흉근·대흉근이 어깨를 앞으로 끌어당겨 라운드숄더와 등 굽음을 만들어요. 공으로 누른 채 팔을 움직이면 뭉친 부분이 부드러워져, 이어서 하는 가슴 스트레칭과 날개뼈 운동이 훨씬 잘 돼요.',
      en: 'Pec minor and major shorten with long hours of sitting and pull the shoulders forward into a rounded, hunched posture. Pinning them with a ball while moving the arm softens the tight spots, so the chest stretches and shoulder-blade exercises that follow work much better.',
    },
    muscles: { ko: '소흉근, 대흉근(쇄골·흉골 부분)', en: 'Pectoralis minor, pectoralis major (clavicular and sternal parts)' },
    caution: {
      ko: '가슴에 심장박동기·케모포트 같은 삽입 기기가 있거나 최근 가슴·유방 수술을 받았다면 그 부위는 피하세요. 팔이 저리거나 창백해지면 바로 멈추세요.',
      en: 'Avoid the area if you have an implanted device such as a pacemaker or chemo port, or recent chest or breast surgery. Stop right away if your arm goes numb or pale.',
    },
    avoid: ['shoulderSevere', 'radiating'],
    anim: {
      view: 105,
      props: [
        { kind: 'wall', wall: 'front', dist: 0.2 },
        { kind: 'ball', at: 'chest', off: [-6, -5.5, 8.2] },
      ],
      keys: [merge(PEC_LEAN, PEC_ARM_DOWN), merge(PEC_LEAN, PEC_ARM_W), merge(PEC_LEAN, PEC_ARM_UP)],
      labels: [
        { ko: '공 대고 벽에 기대기', en: 'Lean into the ball' },
        { ko: '팔을 옆으로 W자', en: 'Arm out to a W' },
        { ko: '머리 위로 Y자', en: 'Up overhead to a Y' },
      ],
      durations: [2, 1.4, 3],
      pauses: [1.6, 0.2, 0.8],
      holdKey: 2,
      focus: [{ a: 'chest', b: 'shR', side: 'front', kind: 'stretch', r: 2.8, from: 0.15, to: 0.85 }],
      trace: ['haR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'ball-upper-back-release',
    name: { ko: '마사지볼로 날개뼈 안쪽 풀기', en: 'Ball release between the shoulder blades' },
    phase: 'release',
    position: 'wall',
    regions: ['upperBack', 'shoulder'],
    targets: { upperBackPain: 1, stiffness: 0.5, neckPain: 0.4, kyphosis: 0.3, stress: 0.3 },
    equipment: ['ball', 'wall'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 60, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '벽에 등을 대고 서서 발을 골반 너비로 벌려 벽에서 약 35cm(발 길이 1.5개) 앞에 두고, 무릎을 살짝 굽혀요.',
        '공을 오른쪽 날개뼈 안쪽 가장자리와 척추 사이(척추에서 손가락 2~3개 옆), 날개뼈 가운데 높이에 대고 등으로 눌러 고정해요.',
        '오른팔을 가슴 앞으로 가로질러 오른손으로 왼쪽 어깨를 잡고, 왼손으로 오른 팔꿈치를 받쳐요. 날개뼈가 바깥으로 벌어져 공이 근육에 잘 닿아요.',
      ],
      en: [
        'Stand with your back to a wall, feet hip-width apart about 35 cm (one and a half foot-lengths) in front of it, knees softly bent.',
        'Place the ball between the inner edge of your right shoulder blade and your spine (two or three finger-widths from the spine), at mid-shoulder-blade height, and pin it with your back.',
        'Reach your right arm across your chest to hold your left shoulder, and support the right elbow with your left hand. This slides the shoulder blade outward so the ball reaches the muscle.',
      ],
    },
    steps: {
      ko: [
        '등을 공 쪽으로 기대 10점 중 4~5 정도의 “시원한” 압력을 만들어요.',
        '2초에 걸쳐 무릎을 굽혀 몸을 5~8cm 낮췄다가 2초에 걸쳐 펴요. 몸이 내려가면 공은 날개뼈 위쪽으로, 올라오면 아래쪽으로 굴러가요. 20초 반복해요.',
        '뻐근한 지점을 찾으면 그 자리에 멈추고, 숨을 길게 내쉬며 10~15초 기다려요.',
        '그 자리에서 왼손으로 오른 팔꿈치를 왼쪽으로 2~3cm 더 당겼다 풀기를 3초씩 5회(약 15초) 해요.',
        '공을 떼고 어깨를 가볍게 돌린 뒤, 반대쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Lean back into the ball to create a “good” pressure of about 4–5 out of 10.',
        'Take 2 seconds to bend your knees and lower yourself 5–8 cm, then 2 seconds to straighten. Going down rolls the ball toward the top of the shoulder blade; coming up rolls it lower. Keep going for 20 seconds.',
        'When you find a tight spot, stop there and wait 10–15 seconds with a long exhale.',
        'Staying on that spot, use your left hand to draw your right elbow 2–3 cm further to the left and release — 3 seconds each, 5 times (about 15 seconds).',
        'Step off the ball, roll your shoulders gently, then do the other side the same way.',
      ],
    },
    breathing: {
      ko: '코로 들이마셔 등 뒤 갈비뼈가 공 쪽으로 부풀게 하고, 입으로 길게 내쉬며 등의 힘을 빼 공에 몸을 맡겨요.',
      en: 'Breathe in through your nose so the back of your ribs swells into the ball, then exhale long through your mouth and let your upper back relax onto it.',
    },
    feel: {
      ko: '날개뼈 안쪽 근육이 뻐근하게 눌리며 시원하고, 팔꿈치를 당길 때 그 부분이 넓게 펴지는 느낌이면 정답이에요. 뼈를 누르는 딱딱한 통증, 숨 쉴 때 찌르는 가슴 통증, 팔로 퍼지는 저림이 있으면 공 위치를 바꾸거나 멈춰요.',
      en: 'A satisfying, achy pressure in the muscles along the inner edge of the shoulder blade, which spread wider as you draw the elbow across. If you feel hard pain on bone, a stabbing chest pain when you breathe, or tingling spreading down the arm, reposition the ball or stop.',
    },
    easier: {
      ko: '발을 벽 쪽으로 조금 더 가까이 두어 덜 기대거나, 공을 양말에 넣어 들고 위치를 잡아요. 공이 너무 딱딱하면 테니스공처럼 부드러운 공을 써요.',
      en: 'Move your feet a little closer to the wall so you lean less, or put the ball in a sock so it’s easier to position. If the ball feels too hard, use a softer one such as a tennis ball.',
    },
    harder: {
      ko: '바닥에 누워 무릎을 세우고 공을 같은 자리에 둔 채 체중으로 눌러요. 그 상태로 오른팔을 천장으로 뻗었다가 가슴 위로 가로지르기를 8회 해요.',
      en: 'Lie on your back with your knees bent and the ball in the same spot so your body weight provides the pressure. From there, reach your right arm to the ceiling and across your chest, 8 times.',
    },
    cues: { ko: ['등을 공에 기대요', '무릎으로 위아래', '팔꿈치를 당겨요', '숨 길게 내쉬어요'], en: ['Lean back into the ball', 'Use your knees to roll', 'Draw the elbow across', 'Long exhales'] },
    mistakes: {
      ko: [
        '공을 척추 뼈 위에 둠 → 척추 가운데 튀어나온 뼈에서 손가락 2~3개 옆, 근육 위에 둬요.',
        '허리를 꺾어 등을 뒤로 밀어붙임 → 배꼽을 살짝 당기고 무릎을 굽혀 몸 전체로 기대요.',
        '날개뼈 위쪽 끝을 지나 목까지 굴림 → 날개뼈 위쪽 끝(어깨 높이)까지만 굴리고, 목 뒤는 누르지 않아요.',
        '팔을 교차하지 않고 늘어뜨림 → 팔을 가슴 앞으로 가로질러 날개뼈를 벌려야 공이 근육에 닿아요.',
      ],
      en: [
        'Putting the ball on the spine → Keep it on the muscle two or three finger-widths out from the bony bumps of the spine.',
        'Arching the low back to push into the wall → Draw your navel in slightly and bend your knees so your whole body leans.',
        'Rolling past the top of the shoulder blade into the neck → Roll only up to the top corner of the shoulder blade (shoulder height), never the back of the neck.',
        'Letting the arm hang → Cross the arm over your chest to spread the shoulder blade so the ball reaches the muscle.',
      ],
    },
    why: {
      ko: '구부정하게 오래 앉아 있으면 날개뼈 안쪽 근육(능형근·중간 승모근)이 늘어난 채로 계속 버티느라 뻐근하게 뭉쳐요. 공으로 눌러 풀어 두면 등 통증이 줄고, 이어서 하는 날개뼈 모으기 운동을 더 편하게 할 수 있어요.',
      en: 'Slouching for hours leaves the muscles along the inner shoulder blade (rhomboids and middle trapezius) working in a stretched position, and they knot up. Releasing them with a ball eases upper-back aches and makes the shoulder-blade strengthening that follows more comfortable.',
    },
    muscles: { ko: '능형근, 중간 승모근, 등 윗부분 척추세움근', en: 'Rhomboids, middle trapezius, upper erector spinae' },
    caution: {
      ko: '골다공증이 있거나 등에 날카로운 통증이 있으면 세게 누르지 마세요. 등 통증과 함께 가슴 통증이나 숨참이 있다면 운동하지 말고 의료진과 상의하세요.',
      en: 'Don’t press hard if you have osteoporosis or sharp back pain. If upper-back pain comes with chest pain or shortness of breath, skip the exercise and talk to a medical professional.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 90,
      props: [
        { kind: 'wall', wall: 'back', dist: 4 },
        { kind: 'ball', at: 'heelR', off: [4.6, 72.9, -18.7] },
      ],
      keys: [merge(UB_BODY, UB_ARMS, UB_KNEES_SOFT), merge(UB_BODY, UB_ARMS, UB_KNEES_BENT), merge(UB_BODY, UB_ARMS_PULL, UB_KNEES_BENT)],
      labels: [
        { ko: '공 대고 팔 교차', en: 'Ball in place, arm across' },
        { ko: '무릎 굽혀 굴리기', en: 'Bend the knees to roll' },
        { ko: '멈춰서 팔꿈치 당기기', en: 'Pause, draw the elbow' },
      ],
      durations: [2, 2, 1.2],
      pauses: [0.8, 0.6, 2],
      holdKey: 0,
      focus: [{ a: 'backTop', b: 'shR', side: 'back', kind: 'stretch', r: 2.8, from: 0.05, to: 0.6 }],
      trace: ['shR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'ball-glute-release',
    name: { ko: '마사지볼로 엉덩이 풀기', en: 'Massage ball glute release' },
    phase: 'release',
    position: 'seated',
    regions: ['glute', 'hip'],
    targets: { hipPain: 0.8, lowBackPain: 0.5, stiffness: 0.5, pelvicTilt: 0.3 },
    equipment: ['ball', 'mat'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 60, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에 앉아 두 무릎을 세우고 발바닥을 골반 너비로 바닥에 둬요.',
        '마사지볼을 오른쪽 엉덩이 볼록한 곳의 위쪽 바깥(골반 뼈 옆선 아래, 바지 뒷주머니 위쪽)에 두고 그 위에 앉아요.',
        '두 손은 엉덩이 뒤 20~30cm 바닥을 짚고, 손끝은 옆이나 뒤를 향하게 해 손목 부담을 줄여요.',
        '오른발목 바깥쪽을 왼무릎 바로 위 허벅지에 올려 숫자 4 모양을 만들어요.',
      ],
      en: [
        'Sit on a mat with your knees bent and feet flat, hip-width apart.',
        'Place the ball under the upper, outer part of the fleshy right buttock (below the side of the pelvic bone, above your back pocket) and sit on it.',
        'Put your hands on the floor 20–30 cm behind your hips, fingers pointing out or back to spare your wrists.',
        'Rest the outside of your right ankle on your left thigh just above the knee to make a “4”.',
      ],
    },
    steps: {
      ko: [
        '몸을 오른쪽으로 살짝 기울여 공에 체중을 실어요. 압력은 10점 중 4~5 정도예요.',
        '손과 왼발로 몸을 조금씩 옮겨, 공이 엉덩이 위에서 2~3cm씩 앞뒤·좌우로 천천히 굴러가게 해요. 25초 동안 해요.',
        '뻐근한 지점을 찾으면 멈추고, 숨을 길게 내쉬며 10~15초 기다려요.',
        '그 자리에서 오른무릎을 바깥으로 천천히 떨어뜨렸다 되돌리기를 3초씩 3회 해요.',
        '다리 쪽으로 찌릿함이 느껴지면 공을 바깥 위쪽으로 2~3cm 옮겨요. 끝나면 반대쪽도 해요.',
      ],
      en: [
        'Lean slightly to the right to put your weight into the ball — about 4–5 out of 10.',
        'Using your hands and left foot, shift your body a little at a time so the ball rolls 2–3 cm forward, back and side to side over the buttock. Keep going for 25 seconds.',
        'When you find a tight spot, pause there for 10–15 seconds with long exhales.',
        'Staying on that spot, slowly let your right knee fall outward and bring it back — 3 seconds each way, 3 times.',
        'If you feel any zinging toward the leg, move the ball 2–3 cm up and out. When you’re done, switch sides.',
      ],
    },
    breathing: {
      ko: '코로 들이마시고, 입으로 길게 내쉬며 엉덩이 힘을 빼 공 위로 몸을 가라앉혀요. 뻐근할 때 숨을 참지 마세요.',
      en: 'Breathe in through your nose, then exhale long through your mouth and let your buttock soften and sink onto the ball. Don’t hold your breath when it’s tender.',
    },
    feel: {
      ko: '엉덩이 바깥과 깊은 곳이 뻐근하게 눌리면서 시원하면 정답이에요. 전기가 오듯 찌릿하거나 다리 뒤·발로 저림이 내려가면 좌골신경이 눌린 신호예요. 바로 공을 옮기거나 멈춰요.',
      en: 'An achy, relieving pressure on the outer and deep buttock is right. An electric zing, or tingling running down the back of the leg or into the foot, means the sciatic nerve is being pressed — move the ball or stop immediately.',
    },
    easier: {
      ko: '다리를 꼬지 않고 두 발을 바닥에 둔 채 하거나, 의자에 앉아 엉덩이 밑에 공을 두고 해요. 벽에 기대 서서 엉덩이와 벽 사이에 공을 끼워 해도 좋아요.',
      en: 'Keep both feet on the floor instead of crossing the leg, or sit on a chair with the ball under your buttock. You can also stand and pin the ball between your buttock and a wall.',
    },
    harder: {
      ko: '뻐근한 지점에서 오른무릎을 벌렸다 모으기를 6회로 늘리거나, 풀고 난 뒤 ‘의자 4자 엉덩이 스트레칭’으로 이어서 늘려요.',
      en: 'On a tight spot, increase the knee openings to 6, or follow up with the seated figure-4 stretch.',
    },
    cues: { ko: ['공 쪽으로 기대요', '천천히 굴려요', '찌릿하면 옮겨요', '숨 길게 내쉬어요'], en: ['Lean toward the ball', 'Roll slowly', 'Zinging? Move the ball', 'Long exhales'] },
    mistakes: {
      ko: [
        '엉덩이 아래쪽 가운데(앉을 때 닿는 뼈 근처)를 누름 → 좌골신경이 지나가는 곳이라 피하고, 엉덩이 위쪽 바깥에 공을 둬요.',
        '빠르게 앞뒤로 문지름 → 1초에 1~2cm 정도로 천천히 굴리고, 뻐근한 곳에서는 멈춰요.',
        '손목을 꺾어 체중을 다 실음 → 손끝을 옆이나 뒤로 돌리고, 왼발로도 체중을 나눠 받쳐요.',
        '아플수록 좋다며 오래 누름 → 한 지점은 30초를 넘기지 말고 4~5점 압력을 지켜요.',
      ],
      en: [
        'Pressing the lower middle of the buttock near the sit bone → The sciatic nerve runs there; keep the ball on the upper, outer buttock.',
        'Scrubbing back and forth quickly → Roll slowly, about 1–2 cm per second, and pause on tight spots.',
        'Dumping all your weight onto bent wrists → Turn your fingers out or back and share the load with your left foot.',
        'Staying on a spot longer because “more pain is better” → Keep each spot under 30 seconds at 4–5 out of 10.',
      ],
    },
    why: {
      ko: '오래 앉아 눌려 있던 엉덩이 근육(대둔근·중둔근·이상근)이 뭉치면 골반과 허리가 뻐근하고 엉덩이 통증이 생기기 쉬워요. 4자 자세로 근육을 늘린 채 공으로 누르면 깊은 곳까지 효율적으로 풀 수 있어요.',
      en: 'Glute muscles (gluteus maximus, medius and piriformis) compressed by long sitting tighten up and can leave the hips and low back stiff and the buttock sore. Pressing them with a ball while the figure-4 position puts them on stretch reaches the deeper layers efficiently.',
    },
    muscles: { ko: '대둔근, 중둔근, 이상근 등 심부 외회전근', en: 'Gluteus maximus and medius, piriformis and deep hip rotators' },
    caution: {
      ko: '엉덩이에서 다리로 뻗치는 통증·저림이 있다면 하지 마세요. 누르는 동안 전기가 오는 느낌이 들면 즉시 공을 옮기고, 고관절 수술을 받았다면 담당 의료진과 먼저 상의하세요.',
      en: 'Skip this if you have pain or tingling running from the buttock down the leg. If you feel an electric sensation while pressing, move the ball at once, and check with your care team first if you’ve had hip surgery.',
    },
    avoid: ['radiating', 'wristPain', 'kneeSevere'],
    anim: {
      view: 15,
      elev: 15,
      props: [{ kind: 'mat' }, { kind: 'ball', at: 'sitR', off: [-1.5, -3, -2] }],
      ground: { joints: ['sitR'], y: 5.4 },
      anchor: ['sitL', 'sitR'],
      keys: [GL_SIT, GL_LEAN, GL_KNEE_OUT],
      labels: [
        { ko: '4자로 공 위에 앉기', en: 'Figure-4 on the ball' },
        { ko: '공 쪽으로 기울여 굴리기', en: 'Lean in and roll' },
        { ko: '무릎을 바깥으로 열기', en: 'Let the knee fall out' },
      ],
      durations: [1.8, 2.2, 2.2],
      pauses: [0.8, 1.6, 1],
      holdKey: 1,
      focus: [
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'stretch', r: 4 },
        { a: 'hipR', b: 'shR', side: 'out', kind: 'stretch', r: 3, from: 0, to: 0.28 },
      ],
      trace: ['knR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'ball-foot-roll',
    name: { ko: '발바닥 볼 굴리기', en: 'Massage ball foot roll' },
    phase: 'release',
    position: 'seated',
    regions: ['ankle'],
    targets: { stiffness: 0.6, kneeValgus: 0.4, stress: 0.3 },
    equipment: ['ball'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 45, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽에 앉아 두 발을 골반 너비로 바닥에 두고, 무릎은 90도로 세워요. 신발은 벗어요.',
        '마사지볼을 오른발 앞 바닥에 두고, 발바닥 가운데 오목한 곳(아치)을 공 위에 올려요.',
        '허리를 곧게 세우고 손은 허벅지 위에 편하게 둬요.',
      ],
      en: [
        'Sit toward the front of a chair with your feet hip-width apart and knees at 90°. Take your shoes off.',
        'Put the massage ball on the floor in front of your right foot and rest the hollow in the middle of your sole (the arch) on top of it.',
        'Sit tall with your hands resting on your thighs.',
      ],
    },
    steps: {
      ko: [
        '다리 무게를 실어 10점 중 4~5 정도로 공을 눌러요.',
        '2초에 걸쳐 발을 뒤로 당겨, 공이 아치에서 발가락 뿌리(발볼)까지 굴러가게 해요.',
        '2초에 걸쳐 발을 앞으로 밀어, 공이 뒤꿈치 바로 앞까지 굴러가게 해요.',
        '이렇게 뒤꿈치 앞과 발가락 쪽을 천천히 오가며, 발바닥 안쪽·가운데·바깥쪽 세 줄을 나눠 굴려요.',
        '뻐근한 지점에서는 5~10초 멈춰 지그시 누르고 발가락을 폈다 오므려요. 45초 뒤 반대 발로 바꿔요.',
      ],
      en: [
        'Let the weight of your leg press the foot into the ball — about 4–5 out of 10.',
        'Take 2 seconds to draw your foot back so the ball rolls from the arch to the base of your toes (the ball of the foot).',
        'Take 2 seconds to push your foot forward so the ball rolls to just in front of the heel.',
        'Keep travelling slowly between the heel and the toes, working three lines: inner, middle and outer sole.',
        'On a tender spot, pause for 5–10 seconds with steady pressure while spreading and curling your toes. After 45 seconds, switch feet.',
      ],
    },
    breathing: {
      ko: '편하게 코로 숨 쉬고, 뻐근한 곳에서 멈출 때 입으로 길게 내쉬며 발의 힘을 빼요.',
      en: 'Breathe easily through your nose, and exhale long through your mouth while you pause on a tender spot, letting the foot relax.',
    },
    feel: {
      ko: '발바닥이 뻐근하면서 시원하고, 끝나고 바닥을 디디면 발이 가볍고 넓게 닿는 느낌이면 정답이에요. 뒤꿈치 한가운데를 찌르는 통증이나 저림·화끈거림이 생기면 압력을 줄이거나 멈춰요.',
      en: 'An achy-but-good pressure across the sole, and afterwards the foot feels lighter and spreads more fully on the floor. If you feel stabbing pain in the center of the heel, or numbness or burning, lighten the pressure or stop.',
    },
    easier: {
      ko: '테니스공처럼 부드러운 공이나 물병을 쓰고, 다리 무게만 살짝 실어요.',
      en: 'Use a softer ball such as a tennis ball, or a water bottle, with just a little of the leg’s weight.',
    },
    harder: {
      ko: '일어서서 벽이나 책상을 잡고 체중을 조금 더 실어 굴려요. 이때도 체중 대부분은 반대 발에 두어 균형을 잡아요.',
      en: 'Stand holding a wall or desk and lean a bit more weight onto the ball, still keeping most of your weight on the other foot for balance.',
    },
    cues: { ko: ['뒤꿈치에서 발가락까지', '천천히 굴려요', '뻐근하면 멈춰요', '발가락 폈다 오므려요'], en: ['Heel to toes', 'Roll slowly', 'Pause on tender spots', 'Spread and curl your toes'] },
    mistakes: {
      ko: [
        '뒤꿈치 뼈 한가운데를 세게 누름 → 뒤꿈치는 가볍게, 아치와 발볼 쪽 근육 위주로 굴려요.',
        '빠르게 비비듯 굴림 → 한 번 오가는 데 4초, 천천히 굴려요.',
        '상체를 숙여 체중을 모두 실음 → 허리를 세운 채 다리 무게로만 눌러요.',
        '발목만 까딱여 공이 제자리에 있음 → 무릎과 발 전체를 앞뒤로 움직여요.',
      ],
      en: [
        'Pressing hard on the center of the heel bone → Go lightly on the heel and focus on the arch and ball-of-foot muscles.',
        'Rubbing quickly → Take about 4 seconds for each back-and-forth.',
        'Leaning your body over to load the foot → Stay tall and use only the weight of your leg.',
        'Only flicking the ankle so the ball stays put → Move the whole foot and knee forward and back.',
      ],
    },
    why: {
      ko: '발바닥 근막과 작은 근육들이 굳으면 발이 딱딱하게 디뎌져 발목·무릎 정렬과 균형에 영향을 줘요. 공으로 풀어 두면 발의 감각이 깨어나 서 있는 자세가 더 안정돼요.',
      en: 'A tight plantar fascia and small foot muscles make the foot land stiffly, which affects ankle and knee alignment and balance. Rolling them wakes up the foot’s sensation so you stand more steadily.',
    },
    muscles: { ko: '족저근막, 발바닥 내재근(무지외전근·단지굴근)', en: 'Plantar fascia, intrinsic foot muscles (abductor hallucis, flexor digitorum brevis)' },
    caution: {
      ko: '당뇨 등으로 발 감각이 둔하거나 발에 상처·부기가 있으면 세게 누르지 마세요. 아침 첫발 뒤꿈치 통증이 심하면 부드러운 공으로 가볍게만 해요.',
      en: 'Don’t press hard if your feet have reduced sensation (for example from diabetes) or have wounds or swelling. If your heel is very painful on the first steps in the morning, use a soft ball and light pressure only.',
    },
    anim: {
      view: 90,
      props: [{ kind: 'chair' }, { kind: 'ball', at: 'heelL', off: [-17.2, 2.2, 10.7] }],
      anchor: ['sitL', 'sitR'],
      keys: [merge(SIT, FOOT_ARCH), merge(SIT, FOOT_BALL), merge(SIT, FOOT_HEEL)],
      labels: [
        { ko: '아치를 공 위에', en: 'Arch on the ball' },
        { ko: '발가락 쪽으로 굴리기', en: 'Roll toward the toes' },
        { ko: '뒤꿈치 쪽으로 굴리기', en: 'Roll toward the heel' },
      ],
      durations: [2, 2.6, 2],
      pauses: [1, 0.6, 0.6],
      holdKey: 0,
      focus: [{ a: 'heelR', b: 'toeR', kind: 'stretch', r: 1.8, from: 0.1, to: 0.8 }],
      trace: ['anR'],
      zoom: 1.1,
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'forearm-self-release',
    name: { ko: '손으로 아래팔 풀기', en: 'Forearm self-release' },
    phase: 'release',
    position: 'seated',
    regions: ['wrist'],
    targets: { wristPain: 1, stiffness: 0.4 },
    equipment: [],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 45, perSide: true, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '책상 앞 의자에 바르게 앉아 두 발을 바닥에 두고, 오른쪽 아래팔을 손바닥이 위를 향하게 책상 위에 올려요(책상이 없으면 허벅지 위).',
        '손목이 책상 끝에 오도록 팔을 앞으로 밀어, 손이 책상 끝 너머에서 아래위로 움직일 공간을 만들어요.',
        '왼손 엄지를 오른쪽 팔꿈치 안쪽 주름에서 손가락 3개 아래(아래팔 안쪽 근육이 가장 도톰한 곳)에 대고, 나머지 손가락은 아래팔 뒤쪽을 감싸요.',
      ],
      en: [
        'Sit tall at a desk with both feet on the floor and rest your right forearm on the desk, palm up (or on your thigh if there’s no desk).',
        'Slide the arm forward until the wrist is at the edge of the desk, so the hand can move up and down past the edge.',
        'Place your left thumb three finger-widths below the right elbow crease, on the thickest part of the inner forearm muscles, and wrap your other fingers around the back of the forearm.',
      ],
    },
    steps: {
      ko: [
        '엄지로 근육을 지그시 눌러 10점 중 4~5 정도의 압력을 만들어요.',
        '누른 채로 2초에 걸쳐 주먹을 쥐며 손목을 위로 굽혀요.',
        '2초에 걸쳐 손가락을 쫙 펴며 손목을 아래로 젖혀요. 엄지 밑 근육이 늘어나는 게 느껴져요.',
        '이렇게 3~4번 한 뒤 엄지를 손목 쪽으로 2cm 옮겨 같은 방법으로 해요. 뻐근한 곳은 5초 더 머물러요.',
        '손목 주름 5cm 위까지 내려가면 다시 팔꿈치 쪽부터 시작해 45초를 채우고, 손을 바꿔요.',
      ],
      en: [
        'Press into the muscle with your thumb — about 4–5 out of 10.',
        'Keeping the pressure, take 2 seconds to make a fist and curl the wrist up.',
        'Take 2 seconds to spread your fingers wide and bend the wrist down. You’ll feel the muscle under the thumb lengthen.',
        'Do this 3–4 times, then move the thumb 2 cm toward the wrist and repeat. Stay 5 extra seconds on tender spots.',
        'When you reach 5 cm above the wrist crease, start again near the elbow until 45 seconds are up, then switch hands.',
      ],
    },
    breathing: {
      ko: '편하게 숨 쉬다가, 손가락을 펴며 손목을 젖힐 때 입으로 길게 내쉬어요.',
      en: 'Breathe easily, and exhale long through your mouth each time you open the fingers and bend the wrist down.',
    },
    feel: {
      ko: '아래팔 안쪽 근육이 뻐근하게 눌리고, 손목을 젖힐 때 엄지 밑이 늘어나며 시원하면 정답이에요. 손가락이 저리거나 전기가 오는 느낌이 들면 신경을 누른 것이니 엄지를 옆으로 옮겨요.',
      en: 'An achy pressure in the inner forearm muscles that turns into a relieving stretch under the thumb as the wrist bends back. If your fingers tingle or you feel an electric zing, you’re on a nerve — move the thumb to the side.',
    },
    easier: {
      ko: '엄지 대신 손가락 두세 개로 넓게 누르거나, 손목은 움직이지 않고 누르기만 해요.',
      en: 'Press with two or three fingers for a broader, softer touch, or just press without moving the wrist.',
    },
    harder: {
      ko: '아래팔 밑에 마사지볼을 두고, 반대 손으로 위에서 눌러 팔꿈치에서 손목 쪽으로 천천히 굴려요. 풀고 나서 ‘손목 앞뒤 스트레칭’으로 이어 가요.',
      en: 'Put a massage ball under the forearm and press down with the other hand as you roll slowly from elbow to wrist. Follow with the wrist flexor & extensor stretch.',
    },
    cues: { ko: ['엄지로 지그시', '주먹 쥐고 굽혀요', '쫙 펴고 젖혀요', '2cm씩 옮겨요'], en: ['Press gently with the thumb', 'Fist and curl', 'Spread and bend back', 'Move 2 cm at a time'] },
    mistakes: {
      ko: [
        '팔꿈치 안쪽 뼈 뒤 오목한 곳을 누름 → 찌릿한 “팔꿈치 신경” 자리라 피하고, 근육이 도톰한 곳을 눌러요.',
        '손목 주름 바로 위 가운데를 세게 누름 → 신경과 힘줄이 모인 곳이라 손목 주름 5cm 위에서 멈춰요.',
        '누르는 손에 힘을 과하게 줌 → 4~5점 압력이면 충분해요. 엄지가 아프면 손가락 두세 개로 바꿔요.',
        '손목을 빠르게 흔듦 → 2초 굽히고 2초 젖히며 천천히 움직여요.',
      ],
      en: [
        'Pressing the hollow behind the inner elbow bone → That’s the “funny bone” nerve; stay on the fleshy muscle instead.',
        'Pressing hard just above the middle of the wrist crease → Nerves and tendons crowd there; stop 5 cm above the crease.',
        'Squeezing too hard with the pressing hand → 4–5 out of 10 is enough; switch to two or three fingers if your thumb hurts.',
        'Flapping the wrist quickly → 2 seconds to curl, 2 seconds to bend back.',
      ],
    },
    why: {
      ko: '마우스·키보드·스마트폰을 오래 쓰면 손목과 손가락을 굽히는 아래팔 근육이 짧게 뭉쳐 손목과 팔꿈치 안쪽이 뻐근해져요. 누른 채 손목을 움직이면 뭉친 부분이 풀려 이어서 하는 손목 스트레칭이 잘 돼요.',
      en: 'Hours of mouse, keyboard and phone use leave the forearm muscles that bend the wrist and fingers short and knotted, making the wrist and inner elbow ache. Pressing them while moving the wrist loosens the knots so the wrist stretches that follow work better.',
    },
    muscles: { ko: '손목 굽힘근(요측·척측 수근굴근), 손가락 굽힘근(천지굴근), 원회내근', en: 'Wrist flexors (flexor carpi radialis and ulnaris), finger flexors (flexor digitorum superficialis), pronator teres' },
    caution: {
      ko: '넘어진 뒤 손목이 붓고 아프거나 손가락 저림이 밤에 심해진다면 누르지 말고 의료진과 상의하세요.',
      en: 'If your wrist is swollen and painful after a fall, or finger numbness gets worse at night, don’t press — talk to a medical professional.',
    },
    anim: {
      view: 60,
      props: [{ kind: 'chair' }, { kind: 'table', at: 'elR', key: 0, off: [8, 0, 4.3], size: [40, 0, 18] }],
      anchor: ['sitL', 'sitR'],
      keys: [merge(FA_BASE, { wrR: 0 }), merge(FA_BASE, { wrR: 45 }), merge(FA_BASE, { wrR: -60 })],
      labels: [
        { ko: '엄지로 아래팔 누르기', en: 'Thumb into the forearm' },
        { ko: '주먹 쥐며 손목 굽히기', en: 'Fist, curl the wrist' },
        { ko: '쫙 펴며 손목 젖히기', en: 'Open, bend the wrist back' },
      ],
      durations: [1.6, 2, 1.6],
      pauses: [1, 0.5, 1],
      holdKey: 2,
      focus: [{ a: 'elR', b: 'wrR', side: 'front', kind: 'stretch', r: 2.4 }],
      trace: ['haR'],
      zoom: 1.2,
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'foam-roller-quad',
    name: { ko: '폼롤러로 허벅지 앞 풀기', en: 'Foam roller quad release' },
    phase: 'release',
    position: 'prone',
    regions: ['hip', 'knee'],
    targets: { lordosis: 0.7, kneePain: 0.5, stiffness: 0.4, hipPain: 0.3 },
    equipment: ['foamRoller', 'mat'],
    level: 2,
    dose: { kind: 'time', sets: 1, value: 60, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에 폼롤러를 가로로 놓고, 오른쪽 허벅지 앞쪽 가운데가 롤러에 오게 엎드려요.',
        '팔꿈치를 어깨 바로 아래에 두고 아래팔로 상체를 받쳐요. 시선은 두 손 사이 바닥을 봐요.',
        '왼다리는 무릎을 굽혀 옆으로 벌려 바닥에 두고, 체중을 나눠 받쳐요.',
      ],
      en: [
        'Place a foam roller across the mat and lie face down with the middle of the front of your right thigh on it.',
        'Prop yourself on your forearms with the elbows under your shoulders, eyes on the floor between your hands.',
        'Bend your left knee and let it rest out to the side on the floor to share the load.',
      ],
    },
    steps: {
      ko: [
        '배꼽을 살짝 당기고 엉덩이에 가볍게 힘을 줘, 허리가 처지지 않게 몸을 일자로 만들어요.',
        '아래팔로 바닥을 당기듯 2~3초에 걸쳐 몸을 머리 쪽으로 옮겨, 롤러가 무릎 위 손가락 3개 지점까지 굴러가게 해요(무릎뼈 위는 피해요).',
        '아래팔로 바닥을 밀어 2~3초에 걸쳐 몸을 발 쪽으로 옮겨, 롤러가 사타구니 주름 바로 아래까지 굴러가게 해요.',
        '이렇게 천천히 오가다 뻐근한 지점에서 멈추고, 10~15초 숨을 내쉬며 기다려요.',
        '다리를 안쪽·바깥쪽으로 살짝 돌려 허벅지 앞 안쪽과 바깥쪽도 굴려요. 60초 뒤 반대쪽을 해요.',
      ],
      en: [
        'Draw your navel in slightly and lightly squeeze your glutes so your low back doesn’t sag and your body stays in one line.',
        'Pull with your forearms to slide your body toward your head over 2–3 seconds, so the roller travels to three finger-widths above the knee (stay off the kneecap).',
        'Push with your forearms to slide back toward your feet over 2–3 seconds, so the roller travels to just below the crease of the hip.',
        'Keep rolling slowly; when you hit a tight spot, stop and breathe out for 10–15 seconds.',
        'Turn the leg slightly in and out to reach the inner and outer front of the thigh. After 60 seconds, switch sides.',
      ],
    },
    breathing: {
      ko: '천천히 굴리는 동안 편하게 숨 쉬고, 뻐근한 곳에서 멈출 때 입으로 길게 내쉬며 허벅지 힘을 빼요.',
      en: 'Breathe easily as you roll, and exhale long through your mouth when you pause on a tight spot, letting the thigh relax.',
    },
    feel: {
      ko: '허벅지 앞쪽이 뻐근하게 눌리며 시원하면 정답이에요. 무릎뼈나 골반 뼈가 눌려 아프거나, 허리가 조이는 느낌이 들면 롤러 위치와 자세를 바로잡아요.',
      en: 'A strong, relieving pressure along the front of the thigh. If the kneecap or hip bone hurts, or your low back pinches, adjust the roller position or your posture.',
    },
    easier: {
      ko: '두 허벅지를 함께 롤러에 올려 압력을 나누거나, 롤러 대신 두 손으로 허벅지를 주물러요. ‘서서 허벅지 앞 스트레칭’으로 대신해도 좋아요.',
      en: 'Put both thighs on the roller to share the pressure, or knead the thigh with your hands instead. The standing quad stretch is a good substitute.',
    },
    harder: {
      ko: '뻐근한 지점에서 멈춘 채 오른무릎을 90도까지 천천히 굽혔다 펴기를 5회 해요.',
      en: 'Pause on a tight spot and slowly bend the right knee to 90° and straighten it, 5 times.',
    },
    cues: { ko: ['배에 살짝 힘', '천천히 굴려요', '무릎뼈는 피해요', '멈춰서 숨 내쉬어요'], en: ['Brace your abs lightly', 'Roll slowly', 'Stay off the kneecap', 'Pause and breathe out'] },
    mistakes: {
      ko: [
        '허리가 아래로 처짐 → 배꼽을 당기고 엉덩이에 살짝 힘을 줘 몸을 일자로 유지해요.',
        '무릎뼈나 골반 뼈 위까지 굴림 → 무릎 위 손가락 3개부터 사타구니 주름 아래까지만 굴려요.',
        '빠르게 왔다 갔다 함 → 한 방향에 2~3초, 1초에 2~3cm 정도로 천천히 굴려요.',
        '어깨가 귀 쪽으로 올라가 팔꿈치에 매달림 → 아래팔로 바닥을 밀어 어깨와 귀를 멀리 해요.',
      ],
      en: [
        'Letting the low back sag → Draw your navel in and lightly squeeze your glutes to stay in one line.',
        'Rolling over the kneecap or hip bone → Roll only from three finger-widths above the knee to just below the hip crease.',
        'Rolling back and forth quickly → 2–3 seconds each way, about 2–3 cm per second.',
        'Sinking into the shoulders → Push the floor away with your forearms to keep your shoulders away from your ears.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 짧아지는 허벅지 앞 근육(특히 대퇴직근)은 골반을 앞으로 기울여 허리 곡선을 깊게 하고 무릎 앞쪽을 뻐근하게 만들어요. 폼롤러로 먼저 풀어 두면 고관절 앞 스트레칭이 훨씬 편해져요.',
      en: 'The front-thigh muscles (especially rectus femoris) shorten with sitting, tipping the pelvis forward to deepen the low-back curve and loading the front of the knee. Rolling them first makes hip-flexor stretching much easier.',
    },
    muscles: { ko: '대퇴사두근(대퇴직근·외측광근·내측광근)', en: 'Quadriceps (rectus femoris, vastus lateralis and medialis)' },
    caution: {
      ko: '멍·부기·정맥류가 있거나 최근 다친 부위는 굴리지 마세요. 엎드린 자세에서 허리가 아프면 바로 멈추고 ‘서서 허벅지 앞 스트레칭’으로 바꿔요.',
      en: 'Don’t roll over bruising, swelling, varicose veins or a recent injury. If lying face down hurts your low back, stop and switch to the standing quad stretch.',
    },
    avoid: ['pregnant', 'shoulderSevere', 'lowBackSevere', 'kneeSevere'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }, { kind: 'roller', at: 'elR', off: [5.4, 3.9, -39.3] }],
      anchor: ['elL', 'elR'],
      keys: [quadPose(90.2, 86.7, 90.5, -2.7, 37.2), quadPose(91.1, 67.5, 110.6, -1.8, 34.9), quadPose(92.1, 107.3, 71.8, -4.4, 39.2)],
      labels: [
        { ko: '허벅지를 롤러 위에', en: 'Thigh on the roller' },
        { ko: '무릎 위까지 굴리기', en: 'Roll to above the knee' },
        { ko: '골반 아래까지 굴리기', en: 'Roll to below the hip' },
      ],
      durations: [2.2, 3.4, 2.2],
      pauses: [0.8, 0.8, 0.8],
      holdKey: 0,
      focus: [{ a: 'hipR', b: 'knR', side: 'front', kind: 'stretch', r: 3 }],
      trace: ['shR'],
    },
  },
  // ─────────────────────────────────────────────
  {
    id: 'foam-roller-calf',
    name: { ko: '폼롤러로 종아리 풀기', en: 'Foam roller calf release' },
    phase: 'release',
    position: 'seated',
    regions: ['ankle', 'knee'],
    targets: { stiffness: 0.5, kneeValgus: 0.4, kneeHyperext: 0.4, kneePain: 0.3 },
    equipment: ['foamRoller', 'mat'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 45, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에 앉아 오른다리를 앞으로 펴고, 폼롤러를 오른쪽 종아리 아래(발목 바로 위)에 가로로 놓아요.',
        '왼발목을 오른 정강이 아래쪽(발목 바로 위)에 포개 올려 압력을 더해요. 처음이라 버거우면 왼무릎을 세워 왼발을 롤러 뒤 바닥에 둬요.',
        '두 손은 엉덩이 뒤 30~40cm 바닥을 어깨너비로 짚고, 손끝은 옆이나 뒤를 향하게 해요.',
      ],
      en: [
        'Sit on a mat with your right leg straight out in front and place a foam roller across the mat under your right calf, just above the ankle.',
        'Cross your left ankle over the lower part of your right shin (just above the ankle) to add pressure. If that’s too much at first, bend your left knee and put that foot on the floor behind the roller.',
        'Place your hands shoulder-width apart on the floor 30–40 cm behind your hips, fingers pointing out or back.',
      ],
    },
    steps: {
      ko: [
        '손바닥으로 바닥을 눌러 엉덩이를 바닥에서 5cm쯤 들어요.',
        '팔로 몸을 3초에 걸쳐 앞으로 옮겨, 롤러가 오금(무릎 뒤) 바로 아래까지 굴러가게 해요.',
        '3초에 걸쳐 몸을 뒤로 옮겨 롤러를 발목 바로 위까지 되돌려요.',
        '뻐근한 지점에서는 엉덩이를 내려 10초 쉬며, 발목을 5번 까딱여요.',
        '발끝을 안쪽·바깥쪽으로 살짝 돌려 종아리 안쪽과 바깥쪽도 굴리고, 45초 뒤 다리를 바꿔요.',
      ],
      en: [
        'Press through your palms to lift your hips about 5 cm off the floor.',
        'Use your arms to move your body forward over 3 seconds so the roller travels up to just below the back of the knee.',
        'Move back over 3 seconds to return the roller to just above the ankle.',
        'On a tight spot, lower your hips and rest there for 10 seconds while pumping the ankle up and down 5 times.',
        'Turn your toes slightly in and out to reach the inner and outer calf. After 45 seconds, switch legs.',
      ],
    },
    breathing: {
      ko: '굴리는 동안 편하게 숨 쉬고, 뻐근한 곳에서 멈출 때 입으로 길게 내쉬며 종아리 힘을 빼요.',
      en: 'Breathe easily while rolling, and exhale long through your mouth when you pause, letting the calf go soft.',
    },
    feel: {
      ko: '종아리 근육이 뻐근하게 눌리며 시원하면 정답이에요. 오금이나 정강이뼈가 눌려 아프거나 발로 퍼지는 저림이 있으면 위치를 바꾸거나 멈춰요.',
      en: 'A strong, relieving pressure through the calf muscle. If the back of the knee or the shin bone hurts, or tingling spreads into the foot, reposition or stop.',
    },
    easier: {
      ko: '다리를 포개지 말고 왼발을 롤러 뒤 바닥에 두거나, 두 종아리를 함께 올려 압력을 나눠요. 엉덩이를 바닥에 둔 채 다리만 앞뒤로 움직여도 돼요.',
      en: 'Don’t cross the legs — keep your left foot on the floor behind the roller, or put both calves on the roller to share the pressure. You can also keep your hips down and move just the leg.',
    },
    harder: {
      ko: '뻐근한 지점에서 엉덩이를 든 채 발목 까딱이기를 10번으로 늘리고, 풀고 난 뒤 ‘벽 종아리 스트레칭’으로 이어 가요.',
      en: 'On a tight spot, keep your hips lifted and pump the ankle 10 times, then follow with the wall calf stretch.',
    },
    cues: { ko: ['엉덩이 살짝 들어요', '오금 아래까지 천천히', '뻐근하면 멈춰요', '발목을 까딱까딱'], en: ['Lift your hips slightly', 'Slowly up to the knee', 'Pause on tight spots', 'Pump the ankle'] },
    mistakes: {
      ko: [
        '무릎 뒤 오금까지 굴림 → 혈관과 신경이 지나는 곳이라 오금 바로 아래에서 멈춰요.',
        '손목을 뒤로 꺾어 체중을 다 실음 → 손끝을 옆이나 뒤로 돌리고, 버거우면 왼발을 바닥에 내려 체중을 나눠요.',
        '빠르게 비비듯 굴림 → 한 방향에 3초씩 천천히 굴리고, 뻐근한 곳에서는 멈춰요.',
        '어깨가 으쓱 올라감 → 가슴을 펴고 어깨를 내린 채 팔로 바닥을 밀어요.',
      ],
      en: [
        'Rolling into the back of the knee → Vessels and nerves pass there; stop just below it.',
        'Dumping your weight onto bent-back wrists → Turn your fingers out or back, and if it’s too much put your left foot down to share the load.',
        'Rubbing quickly → Roll 3 seconds each way and pause on tight spots.',
        'Shoulders hunching up → Open your chest, keep your shoulders down and push the floor away.',
      ],
    },
    why: {
      ko: '종아리가 굳으면 발목이 덜 구부러져, 걷거나 앉았다 일어설 때 무릎이 안으로 모이거나 뒤로 꺾이기 쉬워요. 폼롤러로 먼저 풀면 이어서 하는 종아리 스트레칭이 더 깊게 돼요.',
      en: 'Tight calves limit how far the ankle bends, so the knees tend to cave in or lock back when you walk or stand up. Rolling first lets the calf stretch that follows go deeper.',
    },
    muscles: { ko: '비복근, 가자미근', en: 'Gastrocnemius, soleus' },
    caution: {
      ko: '한쪽 종아리만 붓고 뜨겁거나 누르면 아프다면(혈전 가능성) 굴리지 말고 바로 의료진과 상의하세요. 정맥류가 심한 부위도 피해요.',
      en: 'If one calf is swollen, warm and tender (a possible blood clot), don’t roll it — contact a medical professional right away. Also avoid areas with prominent varicose veins.',
    },
    avoid: ['wristPain', 'shoulderSevere'],
    anim: {
      view: 90,
      elev: 10,
      props: [{ kind: 'mat' }, { kind: 'roller', at: 'haR', off: [8, 5.5, 71.1] }],
      anchor: ['haL', 'haR'],
      keys: [
        calfPose(-24.9, -55.9, 25, -75.1, 84.1, 12.2, 103.1, -15.1, 32.3),
        calfPose(-31.4, -42.1, 0, -69.6, 71.6, 11.1, 91.1, -16.7, 31.3),
        calfPose(-39.4, -64.1, 0, -55.7, 65.9, 9.7, 86.2, -17.6, 31.1),
      ],
      labels: [
        { ko: '종아리를 롤러 위에', en: 'Calf on the roller' },
        { ko: '엉덩이 들기', en: 'Lift the hips' },
        { ko: '무릎 쪽으로 굴리기', en: 'Roll toward the knee' },
      ],
      durations: [1.4, 3, 3],
      pauses: [0.8, 0.8, 0.8],
      holdKey: 1,
      focus: [{ a: 'knR', b: 'anR', side: 'back', kind: 'stretch', r: 3 }],
      trace: ['pelvis'],
    },
  },
];
