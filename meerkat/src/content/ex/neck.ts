/**
 * 운동 라이브러리 · 목
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { HOOK, SIT, merge } from '../../figure/poses';
import type { Pose } from '../../figure/rig';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 조각 ─────────────────────
/** 누워서 턱 당김: 뒤통수는 매트에 닿은 채 끄덕여 턱만 당김 */
const SUP_TUCK: Pose = { neck: { flex: -10 }, head: { flex: 22 } };
/** 오른손으로 오른쪽 엉덩이 옆 의자 모서리를 잡음(팔 쭉 편 채) */
const GRAB_CHAIR_R: Pose = { shR: { flex: -2, abd: 13 }, elR: 6 };
/** 오른손으로 엉덩이 옆, 살짝 뒤쪽 의자 모서리를 잡음 */
const GRAB_CHAIR_BACK_R: Pose = { shR: { flex: -12, abd: 14 }, elR: 6 };
/** 오른쪽 어깨를 귀에서 멀리 끌어내림 */
const SHOULDER_DOWN_R: Pose = { scapR: { elev: -1.5 } };
/** 상부 승모근: 왼손을 머리 위로 넘겨 오른쪽 귀 위에 (머리 바로 / 왼쪽으로 기울인 머리) */
const UT_HAND: Pose = { shL: { flex: -4, abd: 176, rot: 42, hab: -43 }, elL: 68, wrL: 50 };
const UT_HAND_TILT: Pose = { shL: { flex: -23, abd: 144, rot: 51, hab: -42 }, elL: 96, wrL: 30 };
const UT_TILT: Pose = { neck: { side: 26, flex: 4 }, head: { side: 10 } };
/** 견갑거근: 왼쪽으로 45° 돌림 → 코를 왼쪽 겨드랑이로 숙임 → 왼손을 뒤통수에 */
const LEV_TURN: Pose = { neck: { twist: 38 }, head: { twist: 7 } };
const LEV_DOWN: Pose = { neck: { twist: 38, flex: 28, side: 8 }, head: { twist: 7, flex: 12 } };
const LEV_HAND: Pose = { shL: { flex: 136, abd: -15, rot: -35, hab: 44 }, elL: 97, wrL: 34 };
/** 흉쇄유돌근: 왼손 끝을 오른쪽 쇄골 아래에, 오른손을 그 위에 겹침 */
const SCM_HANDS: Pose = {
  shL: { flex: 38, abd: 31, rot: -27, hab: -34 },
  elL: 131,
  wrL: -15,
  shR: { flex: 3, abd: 21, rot: -10, hab: -17 },
  elR: 146,
  wrR: 20,
};
/** 뒤통수 아래 풀기: 양 엄지를 머리뼈 아래에, 팔꿈치는 앞으로 (머리 방향별) */
const SUB_HANDS: Pose = {
  shL: { flex: 144, abd: 3, rot: -14, hab: 19 },
  elL: 125,
  wrL: -50,
  shR: { flex: 144, abd: 3, rot: -15, hab: 18 },
  elR: 125,
  wrR: -50,
};
const SUB_HANDS_TURN_L: Pose = {
  shL: { flex: 160, abd: -10, rot: -28, hab: 30 },
  elL: 120,
  wrL: -50,
  shR: { flex: 131, abd: 13, rot: -4, hab: 5 },
  elR: 128,
  wrR: -50,
};
const SUB_HANDS_TURN_R: Pose = {
  shL: { flex: 131, abd: 11, rot: -6, hab: 4 },
  elL: 128,
  wrL: -50,
  shR: { flex: 160, abd: -10, rot: -28, hab: 30 },
  elR: 120,
  wrR: -50,
};

export const NECK: Exercise[] = [
  {
    id: 'chin-tuck',
    name: { ko: '턱 당기기', en: 'Chin tuck' },
    phase: 'activate',
    position: 'seated',
    regions: ['neck'],
    targets: { fhp: 1, neckPain: 0.7, headache: 0.5 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 2, holdSec: 5, rest: 15 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 앉아 두 발을 골반 너비로 벌려 바닥에 평평하게 둬요.',
        '골반을 세워 허리를 곧게 펴고, 어깨는 한 번 으쓱했다가 툭 떨어뜨려 힘을 빼요.',
        '시선은 정면 눈높이의 한 점에 두고, 턱 밑이 바닥과 평행하게 해요.',
      ],
      en: [
        'Sit on the front third of the chair, feet flat and hip-width apart.',
        'Stack your pelvis upright so your low back is tall; shrug once and let your shoulders drop.',
        'Fix your eyes on a point at eye level so the underside of your chin is parallel to the floor.',
      ],
    },
    steps: {
      ko: [
        '시선은 그대로 둔 채, 머리 전체를 수평으로 뒤로 천천히 밀어요. 턱이 목 쪽으로 따라 들어오며 “이중턱”이 생겨요.',
        '뒤통수가 위로 길어지는 느낌이 드는 지점(1~2cm)까지 밀고 멈춰요.',
        '그 자리에서 5초 버텨요.',
        '2초에 걸쳐 천천히 처음 자리로 돌아와요.',
        '10회 반복해요. 매 회 시선과 어깨 높이는 그대로예요.',
      ],
      en: [
        'Keeping your eyes level, slowly glide your whole head straight back. Your chin follows in and you make a “double chin”.',
        'Stop when the back of your head feels long and lifted — about 1–2 cm of movement.',
        'Hold there for 5 seconds.',
        'Take 2 seconds to return slowly to the start.',
        'Repeat 10 times, keeping your gaze and shoulder height unchanged.',
      ],
    },
    breathing: { ko: '머리를 뒤로 밀면서 입으로 “후—” 내쉬고, 버티는 5초 동안은 코로 편하게 숨 쉬어요. 숨을 참지 마세요.', en: 'Exhale through your mouth as you glide back, then breathe easily through your nose during the 5-second hold. Don’t hold your breath.' },
    feel: { ko: '목 앞쪽 깊은 곳이 은은하게 조이고, 뒷목과 머리 뒤쪽이 위로 길게 늘어나는 느낌이면 정답이에요. 목 앞 표면(굵은 근육)이 불룩 튀어나오면 너무 세게 한 거예요.', en: 'A gentle tightening deep in the front of your neck and a long, lifted feeling at the back of your neck. If the big cords at the front of your neck pop out, you’re pushing too hard.' },
    easier: { ko: '벽에 등과 뒤통수를 대고 서서, 뒤통수로 벽을 살짝 누르듯이 해 보세요. 움직임이 작아도 괜찮아요.', en: 'Stand with your back and head against a wall and gently press the back of your head into it. A tiny movement is fine.' },
    harder: { ko: '버티는 시간을 10초로 늘리거나, ‘누워서 턱 당겨 머리 들기’로 넘어가세요.', en: 'Increase the hold to 10 seconds, or progress to the supine chin-tuck head lift.' },
    cues: { ko: ['뒤통수를 뒤로 쭉', '시선은 정면 그대로', '어깨는 툭 내려요', '5초 버텨요'], en: ['Slide your head back', 'Eyes stay level', 'Let your shoulders drop', 'Hold for five'] },
    mistakes: {
      ko: [
        '고개를 아래로 끄덕임 → 턱을 가슴으로 숙이지 말고, 시선을 정면에 둔 채 머리를 수평으로 뒤로 밀어요.',
        '어깨가 함께 올라감 → 시작 전에 어깨를 으쓱했다가 툭 떨어뜨리고, 목만 움직여요.',
        '허리가 구부정해짐 → 골반을 세워 앉고 정수리를 천장으로 길게 뻗은 상태에서 해요.',
        '숨을 참음 → 밀 때 내쉬고, 버티는 동안 코로 숨 쉬어요.',
      ],
      en: [
        'Nodding the head down → Don’t drop your chin to your chest; keep your eyes level and glide straight back.',
        'Shoulders creeping up → Shrug and drop them before you start, then move only your neck.',
        'Slumping the low back → Sit on your sit bones and reach the crown of your head toward the ceiling.',
        'Holding your breath → Exhale as you glide, breathe through your nose while holding.',
      ],
    },
    why: { ko: '약해진 심부 목굽힘근을 깨워 앞으로 나온 머리를 어깨 위로 되돌리는, 거북목 교정의 가장 기본 운동이에요.', en: 'Wakes up the weak deep neck flexors to bring your head back over your shoulders — the foundation of fixing tech neck.' },
    muscles: { ko: '심부 목굽힘근(두장근·경장근)', en: 'Deep neck flexors (longus capitis/colli)' },
    caution: { ko: '어지럽거나 팔이 저리면 바로 멈추세요.', en: 'Stop if you feel dizzy or your arms tingle.' },
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      keys: [merge(SIT, { neck: { flex: 12 }, head: { flex: -10 } }), merge(SIT, { neck: { flex: -8 }, head: { flex: 10 } })],
      labels: [
        { ko: '바르게 앉아 정면 보기', en: 'Sit tall, eyes level' },
        { ko: '머리를 뒤로 밀어 5초', en: 'Glide back, hold 5 s' },
      ],
      durations: [1.1, 1.1],
      pauses: [0.8, 2.4],
      focus: [
        { a: 'chest', b: 'neckTop', side: 'front', kind: 'work', r: 2.2 },
        { a: 'neckTop', b: 'head', side: 'back', kind: 'stretch', r: 2, from: 0, to: 0.7 },
      ],
      trace: ['nose'],
      zoom: 1.25,
    },
  },
  {
    id: 'supine-chin-lift',
    name: { ko: '누워서 턱 당겨 머리 들기', en: 'Supine chin-tuck head lift' },
    phase: 'activate',
    position: 'supine',
    regions: ['neck'],
    targets: { fhp: 0.9, neckPain: 0.5, headache: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 8, holdSec: 5, rest: 20 },
    setup: {
      ko: [
        '매트에 바로 누워 무릎을 90도 정도로 세우고, 두 발은 골반 너비로 바닥에 평평하게 둬요.',
        '팔은 몸 옆 20~30cm에 손바닥이 바닥을 향하게 편하게 놓아요.',
        '뒤통수를 매트에 대고 천장을 봐요. 턱이 천장 쪽으로 들려 있으면 접은 수건(2~3cm)을 머리 밑에 깔아요.',
      ],
      en: [
        'Lie on your back on a mat, knees bent to about 90°, feet flat and hip-width apart.',
        'Rest your arms 20–30 cm from your sides, palms down.',
        'Keep the back of your head on the mat and look at the ceiling. If your chin points up, slide a folded towel (2–3 cm) under your head.',
      ],
    },
    steps: {
      ko: [
        '뒤통수를 매트에 댄 채, “네” 하고 끄덕이듯 2초에 걸쳐 턱을 목 쪽으로 당겨요. 뒤통수가 매트 위로 살짝 미끄러져 올라가요.',
        '당긴 턱 각도 그대로, 머리를 매트에서 1~2cm(손가락 한 마디)만 들어 올려요.',
        '그 높이에서 5초 버텨요. 턱과 목 사이에 달걀 하나를 끼웠다고 생각하고, 떨어뜨리지도 깨뜨리지도 않을 만큼만 살짝 물고 있어요.',
        '2초에 걸쳐 머리를 먼저 내려놓은 뒤, 턱 당김을 풀어요.',
        '3초 쉬고 8회 반복해요.',
      ],
      en: [
        'With your head on the mat, nod your chin in toward your throat over 2 seconds, like saying “yes”. The back of your head slides slightly up the mat.',
        'Keeping that chin angle, lift your head just 1–2 cm (a finger’s width) off the mat.',
        'Hold for 5 seconds. Imagine an egg between your chin and throat — hold it just enough not to drop it, but not so hard you’d crack it.',
        'Take 2 seconds to lower your head first, then release the tuck.',
        'Rest 3 seconds and repeat 8 times.',
      ],
    },
    breathing: {
      ko: '턱을 당기고 머리를 들 때 입으로 “후—” 내쉬고, 버티는 5초 동안은 코로 가늘게 숨 쉬어요. 숨을 참으면 목 겉근육이 먼저 굳어요.',
      en: 'Exhale through your mouth as you tuck and lift, then breathe gently through your nose during the 5-second hold. Holding your breath lets the surface neck muscles take over.',
    },
    feel: {
      ko: '목 앞쪽 깊은 곳이 뻐근하게 일하고 살짝 떨릴 수 있어요 — 정상이에요. 목 옆의 굵은 근육이 불룩 튀어나오거나 턱이 들리면 높이를 낮추고, 두통·어지럼·팔 저림이 생기면 멈춰요.',
      en: 'A deep working ache in the front of your neck, maybe a slight shake — that’s normal. If the thick cords on the sides of your neck bulge or your chin pokes up, lift less; stop if you get a headache, dizziness or arm tingling.',
    },
    easier: {
      ko: '머리를 들지 말고 매트 위에서 턱만 당겨 5초 버텨요. 그래도 버거우면 앉아서 하는 ‘턱 당기기’로 바꿔요.',
      en: 'Skip the lift: just tuck your chin on the mat and hold for 5 seconds. If that’s still hard, switch to seated chin tucks.',
    },
    harder: {
      ko: '버티는 시간을 10초로 늘려 10회까지 해 보세요(목 앞 깊은 근육 지구력의 좋은 목표예요). 그다음엔 3세트로 늘려요.',
      en: 'Build up to 10-second holds × 10 reps — a good endurance goal for the deep neck flexors — then add a third set.',
    },
    cues: { ko: ['턱 먼저 당겨요', '1~2cm만 들어요', '달걀이 안 깨지게', '천천히 내려요'], en: ['Tuck first', 'Lift just 1–2 cm', 'Don’t crush the egg', 'Lower slowly'] },
    mistakes: {
      ko: [
        '턱이 들리며 머리만 번쩍 듦 → 먼저 턱을 당기고, 그 각도를 지킬 수 있는 만큼만 들어 올려요.',
        '너무 높이 듦 → 1~2cm면 충분해요. 머리 밑으로 종이 한 장이 빠져나갈 정도만 들어요.',
        '어깨가 들리거나 목 옆 근육이 튀어나옴 → 높이를 낮추고 어깨를 매트에 무겁게 내려놓아요.',
        '숨을 참음 → 들 때 내쉬고, 버티는 동안 코로 가늘게 숨 쉬어요.',
      ],
      en: [
        'Chin poking up as the head lifts → Tuck first, then lift only as far as you can keep that angle.',
        'Lifting too high → 1–2 cm is plenty — just enough to slide a sheet of paper under your head.',
        'Shoulders lifting or neck cords bulging → Lift less and let your shoulders sink heavily into the mat.',
        'Holding your breath → Exhale as you lift, breathe softly through your nose while holding.',
      ],
    },
    why: {
      ko: '앉아서 하는 턱 당기기의 다음 단계예요. 머리 무게를 이기며 버티게 해 목 앞 깊은 근육의 지구력을 키우면, 바른 머리 위치를 하루 종일 더 오래 유지할 수 있어요.',
      en: 'The next step after seated chin tucks. Holding against the weight of your head builds deep neck flexor endurance, so you can keep a good head position for longer through the day.',
    },
    muscles: { ko: '심부 목굽힘근(두장근·경장근) 지구력', en: 'Deep neck flexors (longus capitis/colli) — endurance' },
    caution: {
      ko: '목에 날카로운 통증, 어지럼, 팔 저림이 생기면 멈추고 앉아서 하는 턱 당기기로 대신하세요.',
      en: 'If you feel sharp neck pain, dizziness or arm tingling, stop and do seated chin tucks instead.',
    },
    avoid: ['neckSevere'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [
        merge(HOOK, { neck: { flex: -4 }, head: { flex: 2 } }),
        merge(HOOK, SUP_TUCK),
        merge(HOOK, { neck: { flex: -2 }, head: { flex: 22 } }),
        merge(HOOK, SUP_TUCK),
      ],
      labels: [
        { ko: '무릎 세우고 눕기', en: 'Lie with knees bent' },
        { ko: '끄덕이듯 턱 당기기', en: 'Nod the chin in' },
        { ko: '1~2cm 들어 5초', en: 'Lift 1–2 cm, hold 5 s' },
        { ko: '내려놓고 턱 풀기', en: 'Lower, then release' },
      ],
      durations: [0.9, 0.8, 1.0, 0.8],
      pauses: [0.3, 0.3, 3.8, 0.3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'neckTop', side: 'front', kind: 'work', r: 2.2 },
      ],
      trace: ['nose'],
      zoom: 1.15,
    },
  },
  {
    id: 'upper-trap-stretch',
    name: { ko: '상부 승모근 스트레칭', en: 'Upper trapezius stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['neck', 'shoulder'],
    targets: { neckPain: 0.9, shoulderTilt: 0.8, fhp: 0.4, headache: 0.6, stiffness: 0.5, headTilt: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 앉아 두 발을 골반 너비로 벌리고, 무릎은 90도로 둬요.',
        '골반을 세워 양쪽 엉덩이에 체중을 똑같이 싣고, 가슴은 정면을 향해요.',
        '오른손으로 오른쪽 엉덩이 옆 의자 모서리를 잡아요. 팔은 쭉 편 채로요.',
      ],
      en: [
        'Sit on the front third of the chair, feet hip-width apart, knees at 90°.',
        'Stack your pelvis upright with your weight even on both sit bones and your chest facing forward.',
        'Hold the edge of the seat beside your right hip with your right hand, arm straight.',
      ],
    },
    steps: {
      ko: [
        '오른쪽 어깨를 귀에서 멀어지게 1~2cm 끌어내려, 의자를 잡은 팔이 살짝 당겨지게 해요.',
        '왼손을 머리 위로 넘겨 손바닥을 오른쪽 귀 바로 위에 가볍게 얹어요.',
        '3초에 걸쳐 왼쪽 귀를 왼쪽 어깨 쪽으로 천천히 기울여요. 코는 정면, 턱은 살짝 당긴 채로요.',
        '오른쪽 목 옆~어깨 위가 당기는 지점에서 멈추고, 손은 당기지 말고 무게만 얹은 채 30초 버텨요.',
        '손을 먼저 내리고 3초에 걸쳐 머리를 가운데로 세운 뒤, 반대쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Draw your right shoulder 1–2 cm down, away from your ear, so your straight arm feels a light pull on the chair.',
        'Reach your left hand over your head and rest the palm just above your right ear.',
        'Over 3 seconds, tilt your left ear toward your left shoulder — nose facing forward, chin slightly tucked.',
        'Stop where the side of your neck and top of your right shoulder pull. Let the hand rest without pulling and hold 30 seconds.',
        'Lower the hand first, take 3 seconds to bring your head back to center, then do the other side the same way.',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시고 입으로 6초 길게 내쉬어요. 내쉴 때마다 오른쪽 어깨가 조금 더 내려가고 머리가 몇 mm 더 기울도록 맡겨요(30초에 세 번쯤).',
      en: 'Breathe in through your nose for 4 seconds and out through your mouth for 6. On each exhale let the right shoulder sink and the head tilt a few millimetres more (about three breaths per 30 seconds).',
    },
    feel: {
      ko: '오른쪽 귀 뒤에서 어깨 끝으로 이어지는 목 옆·어깨 위가 시원하게 늘어나면 정답이에요. 팔이나 손가락으로 찌릿하게 내려가는 느낌, 저림, 날카로운 통증이 있으면 기울기를 줄이거나 멈춰요.',
      en: 'A comfortable stretch along the side of your neck and top of your shoulder, from behind your right ear to the shoulder tip. If tingling or numbness runs into your arm or fingers, or you feel sharp pain, tilt less or stop.',
    },
    easier: {
      ko: '손을 머리에 얹지 말고 기울이기만 해요. 의자를 잡기 어렵다면 오른손을 오른쪽 허벅지 밑에 깔고 앉아 어깨를 내려도 돼요.',
      en: 'Tilt without putting your hand on your head. If holding the chair is awkward, sit on your right hand to keep that shoulder down.',
    },
    harder: {
      ko: '기울인 상태에서 턱을 오른쪽 어깨 쪽으로 10~15° 살짝 돌리고 조금 더 당기면 승모근 윗부분이 더 늘어나요. 버티는 시간은 45초까지 늘려요.',
      en: 'While tilted, turn your chin 10–15° toward your right shoulder and tuck a little more to reach the upper fibres. Build the hold up to 45 seconds.',
    },
    cues: {
      ko: ['어깨는 아래로 툭', '내쉬며 조금 더', '코는 정면 그대로', '당기지 말고 무게만'],
      en: ['Shoulder stays down', 'Exhale, sink a bit more', 'Nose faces forward', 'No pulling, just weight'],
    },
    mistakes: {
      ko: [
        '늘리는 쪽 어깨가 따라 올라감 → 의자 모서리를 잡은 팔을 쭉 펴고, 그쪽 어깨를 귀에서 멀리 끌어내린 채 해요.',
        '손으로 머리를 세게 잡아당김 → 손은 무게만 얹고, 깊이는 숨을 내쉴 때 조금씩 더해요.',
        '몸통이 함께 옆으로 기울어짐 → 양쪽 엉덩이에 체중을 똑같이 싣고, 가슴은 정면에 둔 채 목만 기울여요.',
        '고개가 돌아가거나 앞으로 숙여짐 → 코는 정면을 향하게 두고, 귀를 어깨 쪽으로 옆으로만 옮겨요.',
      ],
      en: [
        'The stretched shoulder rising → Keep the arm straight on the chair edge and draw that shoulder away from your ear.',
        'Yanking the head with the hand → Let the hand rest as weight only; go deeper a little at a time as you exhale.',
        'Leaning the whole trunk sideways → Keep your weight even on both sit bones and your chest facing forward; only the neck tilts.',
        'Head turning or dropping forward → Keep your nose facing forward and move your ear straight sideways toward the shoulder.',
      ],
    },
    why: {
      ko: '어깨를 으쓱한 채 오래 앉아 있으면 상부 승모근이 짧고 딱딱해져 목·어깨 결림과 긴장성 두통으로 이어져요. 이 근육을 늘려 결림을 줄이고 어깨 높이를 맞추는 데 도움을 줘요. 어깨가 올라간 쪽을 한 세트 더 해 주세요.',
      en: 'Sitting for hours with shrugged shoulders leaves the upper trapezius short and tight, feeding neck/shoulder stiffness and tension headaches. Lengthening it eases that tightness and helps level your shoulders. Add an extra set on the higher shoulder.',
    },
    muscles: { ko: '상부 승모근(함께: 견갑거근·사각근)', en: 'Upper trapezius (also levator scapulae, scalenes)' },
    caution: {
      ko: '팔로 저림이 내려가거나 어지러우면 멈추세요. 머리를 튕기듯 반동을 주지 마세요.',
      en: 'Stop if tingling runs down your arm or you feel dizzy. Never bounce your head.',
    },
    avoid: ['neckSevere', 'radiating'],
    anim: {
      view: 0,
      props: [{ kind: 'chair' }],
      keys: [
        SIT,
        merge(SIT, GRAB_CHAIR_R, UT_HAND),
        merge(SIT, GRAB_CHAIR_R, SHOULDER_DOWN_R, UT_TILT, UT_HAND_TILT),
      ],
      labels: [
        { ko: '바르게 앉기', en: 'Sit tall' },
        { ko: '의자 잡고 손 얹기', en: 'Anchor arm, hand on head' },
        { ko: '반대로 기울여 30초', en: 'Tilt away, hold 30 s' },
      ],
      durations: [1.4, 1.8, 1.6],
      pauses: [0.5, 0.6, 3],
      holdKey: 2,
      focus: [{ a: 'neckTop', b: 'shR', kind: 'stretch', from: 0.3, to: 0.92, r: 2.8 }],
      trace: ['headTop'],
      zoom: 1.2,
    },
    coach: {
      view: 'front',
      metric: 'headTilt',
      mode: 'hold',
      target: 16,
      dir: 1,
      hint: { ko: '정면에서 상체가 보이게 휴대폰을 세워 주세요', en: 'Prop your phone facing you so your upper body is visible' },
      more: { ko: '머리를 조금 더 기울여요', en: 'Tilt a little more' },
      good: { ko: '좋아요, 그대로 호흡', en: 'Good, breathe here' },
    },
  },
  {
    id: 'levator-stretch',
    name: { ko: '견갑거근 스트레칭', en: 'Levator scapulae stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['neck', 'shoulder'],
    targets: { neckPain: 0.8, fhp: 0.4, shoulderTilt: 0.5, stiffness: 0.5, headache: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 앉아 두 발을 골반 너비로 벌리고, 무릎은 90도로 둬요.',
        '오른손으로 오른쪽 엉덩이 옆, 살짝 뒤쪽의 의자 모서리를 잡고 팔을 쭉 펴요.',
        '골반을 세워 허리를 곧게 펴고, 시선은 정면에 둬요.',
      ],
      en: [
        'Sit on the front third of the chair, feet hip-width apart, knees at 90°.',
        'Hold the seat edge beside and slightly behind your right hip, arm straight.',
        'Sit tall on your sit bones and look straight ahead.',
      ],
    },
    steps: {
      ko: [
        '오른쪽 어깨를 귀에서 멀어지게 1~2cm 끌어내려요.',
        '2초에 걸쳐 고개를 왼쪽으로 45° 돌려요. 코가 정면과 왼쪽 어깨의 중간을 향해요.',
        '돌린 방향 그대로 3초에 걸쳐 턱을 숙여, 코를 왼쪽 겨드랑이 쪽으로 가져가요.',
        '왼손을 뒤통수 위쪽에 얹어 손의 무게만 더해요. 당기지는 않아요.',
        '오른쪽 목 뒤~날개뼈 윗부분이 당기는 지점에서 30초 버텨요.',
        '손을 먼저 내리고, 턱 들기 → 정면 보기 순서로 천천히 돌아온 뒤 반대쪽도 해요.',
      ],
      en: [
        'Draw your right shoulder 1–2 cm down, away from your ear.',
        'Over 2 seconds, turn your head 45° to the left — nose halfway between straight ahead and your left shoulder.',
        'Keeping that direction, drop your chin over 3 seconds, bringing your nose toward your left armpit.',
        'Rest your left hand on the upper back of your head and let only its weight add. Don’t pull.',
        'Hold 30 seconds where the back of your right neck and the top of your shoulder blade pull.',
        'Lower the hand first, then lift your chin and turn back to center slowly; switch sides.',
      ],
    },
    breathing: {
      ko: '고개를 숙일 때 입으로 길게 내쉬고, 버티는 동안 코로 4초 들이마시고 6초 내쉬어요. 내쉴 때마다 오른쪽 어깨를 조금 더 내려놓아요.',
      en: 'Exhale slowly as you drop your chin, then breathe in for 4 and out for 6 during the hold. Let your right shoulder sink a little more on each exhale.',
    },
    feel: {
      ko: '오른쪽 목 뒤에서 날개뼈 안쪽 윗모서리까지 대각선으로 당기면 정답이에요(상부 승모근 스트레칭보다 뒤쪽·안쪽). 팔로 찌릿함이나 저림이 내려가거나 머리가 핑 돌면 멈춰요.',
      en: 'A diagonal pull from the back of your right neck to the upper inner corner of your shoulder blade — further back and more inward than the upper-trap stretch. Stop if tingling or numbness runs down your arm or you feel light-headed.',
    },
    easier: {
      ko: '손을 얹지 말고 고개만 돌려 숙여요. 숙이는 범위를 절반만 해도 충분해요. 의자를 잡기 어려우면 오른손을 허벅지 밑에 깔고 앉아요.',
      en: 'Skip the hand and just turn and drop your head, even halfway. If holding the chair is awkward, sit on your right hand instead.',
    },
    harder: {
      ko: '오른쪽 팔꿈치를 머리 높이로 들어 벽이나 문틀에 대고 하면 날개뼈가 위로 돌면서 더 깊게 늘어나요. 버티는 시간은 45초까지 늘려요.',
      en: 'Raise your right elbow to head height and rest it on a wall or door frame — the shoulder blade rotates up and the stretch deepens. Build the hold up to 45 seconds.',
    },
    cues: {
      ko: ['어깨는 아래로', '내쉬며 조금 더', '코는 반대 겨드랑이로', '손은 무게만 얹어요'],
      en: ['Shoulder stays down', 'Exhale, sink a bit more', 'Nose to the opposite armpit', 'Hand is just weight'],
    },
    mistakes: {
      ko: [
        '고개만 숙이고 돌리지 않음 → 먼저 45° 돌린 다음, 그 방향 그대로 코를 겨드랑이 쪽으로 숙여요.',
        '늘리는 쪽 어깨가 올라감 → 의자 모서리를 잡은 팔을 쭉 펴고, 어깨를 귀에서 멀리 내려요.',
        '손으로 머리를 눌러 당김 → 손은 무게만 얹고, 깊이는 내쉴 때 조금씩 더해요.',
        '등이 둥글게 말림 → 골반을 세우고 가슴을 편 채, 목만 숙여요.',
      ],
      en: [
        'Nodding without turning → Turn 45° first, then drop your nose toward the armpit in that direction.',
        'The stretched shoulder hiking up → Keep the arm straight on the seat edge and draw the shoulder away from your ear.',
        'Pushing the head down with the hand → Let the hand rest as weight only and deepen a little on each exhale.',
        'Rounding the upper back → Keep your pelvis upright and chest open; only the neck bends.',
      ],
    },
    why: {
      ko: '날개뼈를 목 쪽으로 끌어올리는 견갑거근은 고개를 숙이고 휴대폰을 보는 자세에서 가장 먼저 뭉쳐요. 목 뒤~날개뼈 윗부분의 “담 결린” 느낌을 풀고, 고개를 돌릴 때의 뻣뻣함을 줄여 줘요.',
      en: 'The levator scapulae, which lifts the shoulder blade toward the neck, is one of the first muscles to tighten with head-down phone posture. Stretching it eases that “knot” between the neck and shoulder blade and makes turning your head feel freer.',
    },
    muscles: { ko: '견갑거근', en: 'Levator scapulae' },
    caution: {
      ko: '팔로 저림이 내려가거나 어지러우면 멈추세요. 목에 날카로운 통증이 있으면 숙이는 범위를 줄이세요.',
      en: 'Stop if tingling runs down your arm or you feel dizzy. If your neck hurts sharply, drop your head less.',
    },
    avoid: ['neckSevere', 'radiating'],
    anim: {
      view: 35,
      props: [{ kind: 'chair' }],
      keys: [
        SIT,
        merge(SIT, GRAB_CHAIR_BACK_R, LEV_TURN),
        merge(SIT, GRAB_CHAIR_BACK_R, SHOULDER_DOWN_R, LEV_DOWN),
        merge(SIT, GRAB_CHAIR_BACK_R, SHOULDER_DOWN_R, LEV_DOWN, LEV_HAND),
      ],
      labels: [
        { ko: '바르게 앉기', en: 'Sit tall' },
        { ko: '반대쪽으로 45° 돌리기', en: 'Turn 45° away' },
        { ko: '코를 겨드랑이로', en: 'Nose to armpit' },
        { ko: '손 얹고 30초', en: 'Hand on head, 30 s' },
      ],
      durations: [1.2, 1.3, 1.3, 1.6],
      pauses: [0.4, 0.4, 0.5, 3],
      holdKey: 3,
      focus: [{ a: 'neckTop', b: 'shR', side: 'back', kind: 'stretch', from: 0, to: 0.55, r: 2.6 }],
      trace: ['nose'],
      zoom: 1.2,
    },
  },
  {
    id: 'scm-stretch',
    name: { ko: '목 앞 근육(흉쇄유돌근) 스트레칭', en: 'Front-of-neck (SCM) stretch' },
    phase: 'stretch',
    position: 'seated',
    regions: ['neck'],
    targets: { fhp: 0.7, headTilt: 0.5, neckPain: 0.4, headache: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 20, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽에 앉아 두 발을 골반 너비로 바닥에 두고, 골반을 세워 허리를 곧게 펴요.',
        '왼손 손끝을 오른쪽 쇄골 바로 아래(가슴 윗부분)에 대고, 오른손을 그 위에 겹쳐 얹어요.',
        '어깨는 힘을 빼 내리고 시선은 정면에 둬요. 입술은 다물고 이 사이는 살짝 띄워요.',
      ],
      en: [
        'Sit toward the front of the chair, feet hip-width on the floor, pelvis upright and back tall.',
        'Place your left fingertips just below your right collarbone (top of the chest) and lay your right hand over them.',
        'Relax your shoulders down and look straight ahead, lips closed and teeth slightly apart.',
      ],
    },
    steps: {
      ko: [
        '겹친 손으로 오른쪽 쇄골 아래 피부를 아래로 살짝 끌어내려 고정해요.',
        '3초에 걸쳐 왼쪽 귀를 왼쪽 어깨 쪽으로 20~30° 기울여요.',
        '기울인 채로 얼굴을 오른쪽으로 10~20°만 돌려요.',
        '턱을 천장 쪽으로 10~15° 살짝 들어, 오른쪽 귀 뒤에서 쇄골까지 목 앞 옆선이 늘어나는 지점에서 멈춰요.',
        '20초 버틴 뒤 턱 내리기 → 얼굴 정면 → 머리 세우기 순서로 천천히 돌아와, 반대쪽도 해요.',
      ],
      en: [
        'With your stacked hands, gently draw the skin below your right collarbone downward and hold it there.',
        'Over 3 seconds, tilt your left ear toward your left shoulder about 20–30°.',
        'Keeping the tilt, turn your face just 10–20° to the right.',
        'Lift your chin 10–15° toward the ceiling and stop when the front-side of your neck stretches from behind your right ear to the collarbone.',
        'Hold 20 seconds, then come back slowly in reverse — chin down, face forward, head upright — and switch sides.',
      ],
    },
    breathing: {
      ko: '자세를 잡는 동안 코로 들이마시고, 턱을 들 때 입으로 길게 내쉬어요. 버티는 20초 동안 3번쯤 천천히 숨 쉬며, 내쉴 때마다 쇄골을 아래로 조금 더 눌러요.',
      en: 'Breathe in through your nose as you set up and exhale slowly as you lift your chin. Take about three slow breaths during the 20-second hold, drawing the collarbone down a little more on each exhale.',
    },
    feel: {
      ko: '오른쪽 귀 뒤에서 쇄골 쪽으로 이어지는 목 앞 옆선이 은은하게 당기면 정답이에요. 목 뒤가 눌리거나 찌릿함, 어지럼, 눈앞이 흐려짐, 팔 저림이 있으면 바로 턱을 내리고 멈춰요.',
      en: 'A gentle pull along the front-side of your neck, from behind your right ear down to the collarbone. If the back of your neck pinches, or you feel tingling, dizziness, blurred vision or arm numbness, lower your chin and stop right away.',
    },
    easier: {
      ko: '턱을 들지 말고 기울이기와 얼굴 돌리기만 해도 충분해요. 목을 젖히는 게 불편하면 ‘상부 승모근 스트레칭’으로 대신해요.',
      en: 'Skip the chin lift — the tilt and turn alone are enough. If looking up is uncomfortable, do the upper trapezius stretch instead.',
    },
    harder: {
      ko: '버티는 시간을 30초로 늘리고, 내쉴 때마다 쇄골을 조금 더 아래로 끌어내려요. 턱을 더 높이 드는 것보다 쇄골을 단단히 고정하는 쪽이 안전하고 효과적이에요.',
      en: 'Extend the hold to 30 seconds and draw the collarbone down a little more on each exhale. Anchoring the collarbone more firmly is safer and more effective than lifting the chin higher.',
    },
    cues: {
      ko: ['쇄골은 아래로 고정', '턱은 살짝만 들어요', '내쉬며 조금 더', '어깨 힘 빼요'],
      en: ['Anchor the collarbone', 'Chin up just a little', 'Exhale and ease in', 'Relax your shoulders'],
    },
    mistakes: {
      ko: [
        '고개를 뒤로 크게 젖힘 → 턱은 10~15°만 들고, 목 뒤가 눌리면 조금 내려요.',
        '쇄골이 고정되지 않아 가슴이 따라 올라감 → 겹친 손으로 쇄골 아래 피부를 아래로 끌어내린 채 버텨요.',
        '얼굴을 기울이는 쪽으로 돌림 → 얼굴은 늘리는 쪽(쇄골을 누르는 쪽)으로 살짝 돌려요.',
        '이를 악물거나 입을 벌림 → 입술은 다물고 이 사이만 살짝 띄워 턱 힘을 빼요.',
      ],
      en: [
        'Throwing the head far back → Lift the chin only 10–15°; if the back of your neck pinches, lower it a bit.',
        'Chest rising because the collarbone isn’t anchored → Keep drawing the skin below the collarbone down with your stacked hands.',
        'Turning the face toward the tilt → Turn it slightly toward the side you’re stretching (the collarbone you’re holding).',
        'Clenching or opening the jaw → Close your lips, keep your teeth slightly apart and let the jaw relax.',
      ],
    },
    why: {
      ko: '머리가 앞으로 나오면 귀 뒤에서 쇄골로 이어지는 흉쇄유돌근이 짧아져 머리를 계속 앞으로 끌어당겨요. 짧게, 부드럽게 늘려 머리를 어깨 위로 되돌리기 쉽게 해 줘요.',
      en: 'With forward head posture the SCM — running from behind the ear to the collarbone — shortens and keeps pulling the head forward. A brief, gentle stretch makes it easier to bring your head back over your shoulders.',
    },
    muscles: { ko: '흉쇄유돌근, 사각근', en: 'Sternocleidomastoid, scalenes' },
    caution: {
      ko: '어지럼증, 눈앞이 흐려짐, 팔 저림이 생기면 즉시 멈추세요. 목을 뒤로 젖히는 동작이 불편한 분은 턱 들기를 생략하세요.',
      en: 'Stop immediately if you feel dizzy, your vision blurs or your arm tingles. Skip the chin lift if tilting your head back is uncomfortable.',
    },
    avoid: ['dizzy', 'neckSevere', 'radiating'],
    anim: {
      view: 30,
      props: [{ kind: 'chair' }],
      keys: [
        SIT,
        merge(SIT, SCM_HANDS),
        merge(SIT, SCM_HANDS, { neck: { side: 24 }, head: { side: 6 } }),
        merge(SIT, SCM_HANDS, { neck: { side: 24, flex: -8 }, head: { side: 6, flex: -10, twist: -16 } }),
      ],
      labels: [
        { ko: '바르게 앉기', en: 'Sit tall' },
        { ko: '쇄골 아래 누르기', en: 'Pin the collarbone' },
        { ko: '반대로 기울이기', en: 'Tilt away' },
        { ko: '돌려서 턱 들기 20초', en: 'Turn toward, chin up, 20 s' },
      ],
      durations: [1.1, 1.2, 1.2, 1.6],
      pauses: [0.4, 0.4, 0.4, 2.6],
      holdKey: 3,
      focus: [{ a: 'head', b: 'shR', side: 'front', kind: 'stretch', from: 0.32, to: 0.64, r: 2.2 }],
      trace: ['nose'],
      zoom: 1.25,
    },
  },
  {
    id: 'suboccipital-release',
    name: { ko: '뒤통수 아래 풀기', en: 'Suboccipital release' },
    phase: 'release',
    position: 'seated',
    regions: ['neck'],
    targets: { headache: 0.9, fhp: 0.6, neckPain: 0.6, stress: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 60 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽에 앉아 두 발을 골반 너비로 바닥에 두고, 허리를 곧게 세워요.',
        '뒤통수 가운데 튀어나온 뼈에서 손가락을 아래로 내리면, 머리뼈 끝선 바로 아래 말랑하게 움푹한 곳이 가운데에서 양옆 2~3cm에 하나씩 있어요.',
        '양손 엄지를 그 두 곳에 대고 나머지 손가락은 머리 옆을 가볍게 감싸요. 팔꿈치는 앞을 향하고 어깨는 내려요.',
      ],
      en: [
        'Sit toward the front of the chair, feet hip-width on the floor, back tall.',
        'Slide your fingers down from the bump at the back of your skull: just under the bony edge there’s a soft hollow 2–3 cm either side of the midline.',
        'Put both thumbs in those hollows and wrap your other fingers lightly around the sides of your head. Elbows point forward, shoulders down.',
      ],
    },
    steps: {
      ko: [
        '엄지로 머리뼈 쪽(눈 방향, 위로)을 지그시 밀어 올려요. 10점 중 4~5 정도의 “시원한” 압력이에요.',
        '그 압력 그대로 동전 크기의 작은 원을 그리며 15초 문질러요.',
        '엄지는 그대로 둔 채, “네” 하듯 턱을 1~2cm 아래로 끄덕였다 돌아오기를 한 번에 2초씩 5번(약 10초) 해요.',
        '이어서 “아니요” 하듯 고개를 왼쪽·오른쪽으로 20°씩만 천천히 번갈아 5번씩 돌려요(약 15초).',
        '엄지를 바깥쪽으로 1cm 옮겨, 남은 약 20초 동안 같은 압력으로 작은 원을 그려요(총 60초).',
      ],
      en: [
        'Press your thumbs gently up toward the skull (toward your eyes) — about 4–5 out of 10, a “good” pressure.',
        'Keeping that pressure, massage in small coin-sized circles for 15 seconds.',
        'With the thumbs still in place, nod your chin down 1–2 cm like saying “yes” and come back — 2 seconds per nod, 5 times (about 10 seconds).',
        'Then, like saying “no”, slowly turn your head just 20° left and right, 5 times each way (about 15 seconds).',
        'Move your thumbs 1 cm outward and circle with the same pressure for the remaining ~20 seconds (60 seconds total).',
      ],
    },
    breathing: {
      ko: '코로 편하게 들이마시고, 누르거나 끄덕일 때 입으로 “후—” 길게 내쉬어요. 내쉴 때마다 어깨와 턱의 힘이 빠지게 해요.',
      en: 'Breathe in easily through your nose and exhale long through your mouth as you press or nod. Let your shoulders and jaw soften on every exhale.',
    },
    feel: {
      ko: '뒤통수 아래가 뻐근하면서 시원하고, 끄덕일 때 머리뼈 아래가 늘어나는 느낌이면 정답이에요. 찌릿함이 머리 위나 얼굴로 퍼지거나 어지럼·메스꺼움이 생기면 압력을 줄이거나 멈춰요.',
      en: 'An achy-but-good release under the base of your skull, with a lengthening there as you nod. If zinging spreads into your scalp or face, or you feel dizzy or nauseous, ease off or stop.',
    },
    easier: {
      ko: '엄지 대신 손가락 끝으로 가볍게 누르거나, 누르기만 하고 끄덕이기·돌리기는 빼요. 팔이 힘들면 팔꿈치를 책상에 올리고 해요.',
      en: 'Use your fingertips instead of your thumbs with lighter pressure, or just press without the nods and turns. If your arms tire, rest your elbows on a desk.',
    },
    harder: {
      ko: '바로 누워 뒤통수 아래에 마사지볼 두 개(또는 양말에 넣은 테니스공 두 개)를 대고, 머리 무게로 1~2분 누르며 작게 끄덕여요.',
      en: 'Lie on your back with two massage balls (or two tennis balls in a sock) under the base of your skull and let your head’s weight press for 1–2 minutes while making tiny nods.',
    },
    cues: {
      ko: ['엄지로 작은 원을 그려요', '이제 작게 끄덕끄덕', '어깨 힘 빼요', '숨은 길게 내쉬어요'],
      en: ['Small circles with your thumbs', 'Now tiny nods', 'Relax your shoulders', 'Long, slow exhales'],
    },
    mistakes: {
      ko: [
        '너무 세게 눌러 아픔 → 10점 중 4~5, “시원한” 정도까지만 눌러요.',
        '목을 크게 움직임 → 끄덕이기는 1~2cm, 돌리기는 20° 안에서 아주 작게 해요.',
        '어깨가 귀 쪽으로 올라감 → 팔꿈치를 앞으로 모으고 어깨를 툭 떨어뜨린 뒤 해요.',
        '턱을 앞으로 내민 채 누름 → 시선은 정면, 턱은 살짝 당긴 상태에서 눌러요.',
      ],
      en: [
        'Pressing so hard it hurts → Stay at 4–5 out of 10, a relieving pressure.',
        'Big neck movements → Keep nods to 1–2 cm and turns within 20°.',
        'Shoulders creeping up to the ears → Bring your elbows forward and drop your shoulders first.',
        'Pressing with the chin poked forward → Keep your eyes level and the chin slightly tucked.',
      ],
    },
    why: {
      ko: '화면을 보느라 턱이 들리면 뒤통수 아래 작은 근육(후두하근)이 짧게 뭉쳐 두통과 눈 피로를 만들어요. 압박과 작은 끄덕임으로 이곳을 풀어 두면 이어서 하는 턱 당기기도 훨씬 잘 돼요.',
      en: 'Poking your chin forward to look at screens shortens the small suboccipital muscles, a common source of headaches and eye strain. Pressure plus tiny nods loosens them, so the chin tucks that follow work much better.',
    },
    muscles: { ko: '후두하근(두직근·두사근)', en: 'Suboccipitals (rectus and obliquus capitis)' },
    caution: {
      ko: '두통이 갑자기 심해지거나 어지럼·메스꺼움·시야 변화가 생기면 멈추세요.',
      en: 'Stop if a headache suddenly worsens or you feel dizzy, nauseous or notice vision changes.',
    },
    anim: {
      view: 100,
      props: [{ kind: 'chair' }],
      keys: [
        merge(SIT, SUB_HANDS, { neck: { flex: -2 } }),
        merge(SIT, SUB_HANDS, { neck: { flex: -6 }, head: { flex: 16 } }),
        merge(SIT, SUB_HANDS_TURN_L, { neck: { flex: -2, twist: 6 }, head: { twist: 16 } }),
        merge(SIT, SUB_HANDS_TURN_R, { neck: { flex: -2, twist: -6 }, head: { twist: -16 } }),
      ],
      labels: [
        { ko: '엄지로 머리뼈 아래 원', en: 'Thumbs under skull, circle' },
        { ko: '턱을 작게 끄덕', en: 'Tiny nod' },
        { ko: '왼쪽으로 20°', en: 'Turn 20° left' },
        { ko: '오른쪽으로 20°', en: 'Turn 20° right' },
      ],
      durations: [1, 1, 1.6, 1],
      pauses: [2, 0.6, 0.4, 0.4],
      holdKey: 0,
      focus: [{ a: 'neckTop', b: 'head', side: 'back', kind: 'stretch', r: 2, from: 0, to: 0.7 }],
      zoom: 1.25,
    },
  },
];
