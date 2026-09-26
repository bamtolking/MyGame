/**
 * 운동 라이브러리 · 가슴·등(흉추)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both } from '../../figure/rig';
import { HANDS_BEHIND_HEAD, HOOK, QUAD, SIDE_LYING, SIT, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 ─────────────────────────
/** 오른팔을 90/90으로 벽에 댄 선 자세 (벽은 몸 오른쪽) */
const WALL_ARM = merge(STAND, { shR: { abd: 88, rot: 85, flex: -8 }, elR: 92, shL: { abd: 6 }, elL: 8 });
/** 오른발 반 걸음 앞으로 */
const STEP_R = { hipR: { flex: 14 }, knR: 10, hipL: { flex: -8 } };
/** 의자에 앉아 뒤통수에 깍지 (팔꿈치는 얼굴 앞에서 가볍게 모음) */
const SIT_HANDS_HEAD = merge(SIT, HANDS_BEHIND_HEAD);
/** 왼쪽으로 누워 엉덩이·무릎 90° (오픈북) */
const OB = merge(SIDE_LYING, both({ hip: { flex: 90 }, kn: 90 }));
/** 폼롤러 위에 등 대고 누움 (상체가 롤러 높이만큼 들림) */
const ROLL = merge(HOOK, HANDS_BEHIND_HEAD, { root: { pitch: -72 } });

export const THORACIC: Exercise[] = [
  {
    id: 'chest-opener',
    name: { ko: '앉아서 가슴 열기', en: 'Seated chest opener' },
    phase: 'stretch',
    position: 'seated',
    regions: ['chest', 'shoulder'],
    targets: { roundShoulder: 0.8, kyphosis: 0.5, fhp: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 3, value: 20, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 걸터앉아, 등받이와 등 사이에 두 주먹 이상 공간을 둬요.',
        '두 발은 골반 너비로 벌려 바닥에 평평하게 두고, 무릎은 90°로 세워요.',
        '좌골(엉덩이 아래 뼈)로 앉아 허리를 곧게 세우고, 정수리는 천장으로, 시선은 정면 눈높이에 둬요.',
      ],
      en: [
        'Perch on the front third of the chair, leaving at least two fists of space between your back and the backrest.',
        'Place your feet flat and hip-width apart, knees bent to 90°.',
        'Sit up on your sit bones with a tall low back, crown reaching up and eyes level.',
      ],
    },
    steps: {
      ko: [
        '두 팔을 등 뒤로 보내 엉덩이 바로 뒤에서 깍지를 껴요. 깍지가 어려우면 수건 양 끝을 잡아요.',
        '어깨를 한 번 으쓱했다가 뒤·아래로 내리며 날개뼈를 등 가운데로 모아요.',
        '2초에 걸쳐 팔꿈치를 쭉 펴면서, 깍지 낀 손을 엉덩이에서 뒤로 한 뼘(15~20cm) 멀어지게 뻗어요.',
        '가슴뼈를 앞·위로 내밀어 쇄골을 양옆으로 넓히고, 턱은 살짝 당겨 귀가 어깨 위에 오게 해요.',
        '이 자세로 20초 버틴 뒤 2초에 걸쳐 손을 풀어요. 5초 쉬고 모두 3세트 해요.',
      ],
      en: [
        'Reach both arms behind you and interlace your fingers just behind your hips. If you can’t clasp, hold both ends of a towel.',
        'Shrug once, then draw your shoulders back and down, squeezing your shoulder blades toward your spine.',
        'Over 2 seconds, straighten your elbows and reach your clasped hands back, a hand-span (15–20 cm) away from your hips.',
        'Lift your breastbone forward and up so your collarbones widen, and keep your chin gently tucked so your ears stay over your shoulders.',
        'Hold for 20 seconds, then release over 2 seconds. Rest 5 seconds; 3 sets in total.',
      ],
    },
    breathing: {
      ko: '가슴을 열 때 코로 들이마셔 갈비뼈를 앞·옆으로 부풀리고, 버티는 동안 입으로 길게 내쉴 때마다 손을 1cm씩 더 뒤로 보내요. 숨을 참지 마세요.',
      en: 'Breathe in through your nose as you open, letting your ribs expand forward and sideways. During the hold, each long exhale lets you reach the hands 1 cm further back. Don’t hold your breath.',
    },
    feel: {
      ko: '가슴 앞쪽과 어깨 앞이 넓게 늘어나고, 날개뼈 사이가 은은하게 조이면 정답이에요. 어깨 앞이 찌릿하게 찝히거나 팔·손이 저리면 손을 몸 쪽으로 가져와 범위를 줄이고, 그래도 계속되면 멈춰요.',
      en: 'A broad stretch across the front of your chest and shoulders, with a gentle squeeze between your shoulder blades. If the front of the shoulder pinches or your arm or hand tingles, bring your hands closer to your body; stop if it continues.',
    },
    easier: {
      ko: '깍지 대신 수건 양 끝을 어깨 너비보다 넓게 잡거나, 손등을 허리에 대고 팔꿈치만 뒤로 모아요. 버티는 시간은 10~15초로 줄여도 돼요.',
      en: 'Hold a towel wider than shoulder-width instead of clasping, or rest the backs of your hands on your low back and just draw your elbows back. You can shorten the hold to 10–15 seconds.',
    },
    harder: {
      ko: '버티는 시간을 30초로 늘리거나, 한쪽씩 더 깊게 늘리는 ‘벽 가슴 스트레칭’으로 넘어가세요.',
      en: 'Build the hold up to 30 seconds, or progress to the wall pec stretch to work each side more deeply.',
    },
    cues: { ko: ['날개뼈를 뒤로 모아요', '가슴뼈를 앞으로', '턱은 살짝 당겨요', '내쉬며 손을 멀리'], en: ['Squeeze the shoulder blades', 'Breastbone forward', 'Chin gently in', 'Exhale, reach the hands away'] },
    mistakes: {
      ko: [
        '허리만 뒤로 꺾여 갈비뼈가 들림 → 배꼽을 살짝 당겨 갈비뼈를 내리고, 가슴 윗부분(쇄골 아래)만 앞으로 열어요.',
        '어깨가 귀 쪽으로 올라가거나 앞으로 말림 → 팔을 펴기 전에 어깨를 뒤·아래로 먼저 내려 두어요.',
        '고개가 앞으로 빠지거나 턱이 들림 → 턱을 살짝 당겨 귀를 어깨 위에 두고 시선은 정면에 둬요.',
        '손을 억지로 높이 들어 어깨 앞이 찝힘 → 손은 엉덩이 높이에서 뒤로 멀리 보내는 정도면 충분해요.',
      ],
      en: [
        'Arching the low back so the ribs flare → Draw your navel in slightly to lower the ribs and open only the upper chest, below the collarbones.',
        'Shoulders hiking up or rolling forward → Set your shoulders back and down before you straighten your arms.',
        'Head poking forward or chin lifting → Tuck your chin slightly so your ears stay over your shoulders, eyes level.',
        'Forcing the hands up high until the shoulder pinches → Reaching the hands back at hip height is plenty.',
      ],
    },
    why: {
      ko: '오래 앉아 어깨가 말리면 대흉근·소흉근과 어깨 앞 근육이 짧아져요. 이 동작은 그 근육을 늘리는 동시에 날개뼈를 모으는 등 근육(능형근·중하부 승모근)을 써서, 어깨를 뒤에 두는 감각을 함께 익혀요.',
      en: 'Long hours of sitting shorten the pecs and the front of the shoulders. This stretches them while your mid-back muscles (rhomboids, middle and lower traps) draw the shoulder blades back, so you also learn how it feels to keep your shoulders back.',
    },
    muscles: { ko: '늘어남: 대흉근, 소흉근, 삼각근 앞쪽, 이두근 · 힘씀: 능형근, 중·하부 승모근', en: 'Stretch: pecs major & minor, front deltoids, biceps · Work: rhomboids, middle & lower traps' },
    caution: {
      ko: '어깨 앞이 찌릿하거나 팔·손이 저리면 바로 멈추세요. 어깨가 빠진 적이 있다면 범위를 작게 하세요.',
      en: 'Stop right away if the front of the shoulder zings or your arm or hand tingles. If you have ever dislocated a shoulder, keep the range small.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      keys: [
        SIT,
        merge(SIT, both({ sh: { flex: -31, abd: 36, rot: -98 }, el: 94, scap: { prot: -1.5 } })),
        merge(SIT, both({ sh: { flex: -48, abd: -23 }, el: 4, scap: { prot: -3 } }), { thorax: { flex: -10 }, neck: { flex: 6 }, head: { flex: -2 } }),
      ],
      labels: [
        { ko: '의자 앞쪽에 바르게', en: 'Sit tall, front of chair' },
        { ko: '등 뒤로 깍지 끼기', en: 'Clasp hands behind' },
        { ko: '팔 펴고 가슴 열어 20초', en: 'Straighten arms, open chest' },
      ],
      durations: [1.4, 1.6, 1.6],
      pauses: [0.6, 0.5, 3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'shR', side: 'front', kind: 'stretch' },
        { a: 'shR', b: 'elR', side: 'front', kind: 'stretch', r: 2.4, from: 0.05, to: 0.6 },
        { a: 'backTop', b: 'backMid', kind: 'work', r: 2.8, from: 0, to: 0.9 },
      ],
      trace: ['haR'],
      zoom: 1.15,
    },
  },
  {
    id: 'wall-pec-stretch',
    name: { ko: '벽 가슴 스트레칭', en: 'Wall pec stretch' },
    phase: 'stretch',
    position: 'wall',
    regions: ['chest', 'shoulder'],
    targets: { roundShoulder: 1, kyphosis: 0.5, fhp: 0.3, shoulderPain: 0.3 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    setup: {
      ko: [
        '벽 모서리나 문틀 옆에 서서 벽이 몸 오른쪽에 오게 하고, 두 발은 골반 너비로 벌려요.',
        '오른팔을 옆으로 들어 팔꿈치를 어깨 높이에 맞추고 90°로 굽혀, 팔꿈치부터 손바닥까지 아래팔 전체를 벽에 붙여요.',
        '팔꿈치는 몸통 옆선과 일직선(어깨보다 앞으로 나가지 않게)에 두고, 배에 가볍게 힘을 줘요.',
      ],
      en: [
        'Stand beside a wall corner or doorframe with the wall on your right, feet hip-width apart.',
        'Lift your right arm out to the side, elbow at shoulder height and bent 90°, and press your whole forearm, elbow to palm, flat on the wall.',
        'Keep the elbow in line with your trunk (not ahead of the shoulder) and lightly brace your stomach.',
      ],
    },
    steps: {
      ko: [
        '오른발을 반 걸음(약 30cm) 앞으로 내디뎌 체중을 앞발로 조금 옮겨요.',
        '아래팔은 벽에 붙인 채, 3초에 걸쳐 가슴과 배꼽을 왼쪽(벽 반대쪽)으로 20~30° 천천히 돌려요.',
        '오른쪽 가슴 앞과 어깨 앞이 당기기 시작하는 지점에서 멈추고 30초 버텨요.',
        '버티는 동안 날개뼈를 뒤·아래로 살짝 당겨 어깨가 앞으로 튀어나오지 않게 해요.',
        '천천히 몸을 벽 쪽으로 되돌리고 팔을 내려요. 왼쪽도 같은 방법으로, 한쪽씩 2세트 해요.',
      ],
      en: [
        'Step your right foot about half a step (30 cm) forward and shift a little weight onto it.',
        'Keeping the forearm on the wall, slowly turn your chest and navel to the left, away from the wall, 20–30° over 3 seconds.',
        'Stop where the front of your right chest and shoulder begin to pull, and hold for 30 seconds.',
        'While holding, draw the shoulder blade gently back and down so the shoulder doesn’t poke forward.',
        'Turn slowly back toward the wall and lower the arm. Repeat on the left; 2 sets per side.',
      ],
    },
    breathing: {
      ko: '몸을 돌릴 때 입으로 길게 내쉬고, 버티는 동안 코로 들이마셔 가슴을 부풀려요. 내쉴 때마다 몸을 1~2cm씩 더 돌려요.',
      en: 'Exhale slowly as you turn, then breathe in through your nose to expand your chest during the hold. With each exhale, turn another 1–2 cm.',
    },
    feel: {
      ko: '오른쪽 가슴 앞~겨드랑이 앞쪽과 어깨 앞이 넓게 당기면 정답이에요. 어깨 관절 앞이 날카롭게 찝히거나 팔·손끝이 저리면 팔꿈치를 어깨보다 낮추고 덜 돌려요.',
      en: 'A broad pull across the front of your right chest, the front of the armpit and the front of the shoulder. If the shoulder joint pinches sharply or your arm or fingertips tingle, lower the elbow below shoulder height and turn less.',
    },
    easier: {
      ko: '팔꿈치를 어깨보다 낮게(팔을 45° 정도만 들어) 대거나 몸을 덜 돌려요. 그래도 불편하면 ‘앉아서 가슴 열기’로 대신해요.',
      en: 'Place the elbow lower than the shoulder (arm raised only about 45°) or turn less. If it’s still uncomfortable, do the seated chest opener instead.',
    },
    harder: {
      ko: '팔꿈치를 어깨보다 한 뼘 높게 대면 가슴 아래쪽 근섬유까지 늘어나요. 버티는 시간을 45초로 늘려도 좋아요.',
      en: 'Place the elbow a hand-span above shoulder height to reach the lower chest fibres, or build the hold up to 45 seconds.',
    },
    cues: { ko: ['아래팔은 벽에 붙여요', '가슴을 반대로 돌려요', '어깨는 뒤·아래로', '내쉬며 조금 더'], en: ['Forearm stays on the wall', 'Turn your chest away', 'Shoulder back and down', 'Exhale, a little more'] },
    mistakes: {
      ko: [
        '어깨가 앞으로 튀어나오며 늘어남 → 날개뼈를 뒤로 모은 상태를 지키고, 몸통을 돌리는 만큼만 늘려요.',
        '팔을 너무 높이 올려 어깨 앞이 찝힘 → 팔꿈치를 어깨 높이 이하에서 시작해요.',
        '허리를 젖히거나 골반만 돌림 → 갈비뼈를 내리고 배에 살짝 힘을 준 채 가슴부터 돌려요.',
        '고개가 앞으로 빠짐 → 턱을 살짝 당겨 귀를 어깨 위에 둬요.',
      ],
      en: [
        'Shoulder poking forward as you stretch → Keep the shoulder blade drawn back and let the stretch come only from turning your trunk.',
        'Arm set too high so the shoulder pinches → Start with the elbow at or below shoulder height.',
        'Arching the low back or just swivelling the hips → Keep your ribs down and stomach lightly braced, and turn from the chest.',
        'Head drifting forward → Tuck your chin slightly so your ears stay over your shoulders.',
      ],
    },
    why: {
      ko: '대흉근·소흉근이 짧아지면 어깨를 앞·안쪽으로 끌어당겨 라운드숄더와 등 굽음을 만들어요. 팔을 벽에 고정하고 몸통을 돌리면 한쪽씩 깊고 안전하게 늘릴 수 있는, 가장 효과적인 가슴 스트레칭이에요.',
      en: 'Tight pecs pull the shoulders forward and in, driving rounded shoulders and a hunched upper back. Anchoring the arm and turning the trunk away stretches each side deeply and safely — the most effective pec stretch.',
    },
    muscles: { ko: '대흉근, 소흉근, 삼각근 앞쪽', en: 'Pectoralis major & minor, front deltoid' },
    caution: {
      ko: '어깨 앞이 찌릿하거나 팔이 저리면 팔 높이를 낮추고, 계속되면 멈추세요. 어깨가 빠진 적이 있다면 팔꿈치를 어깨보다 낮게 두세요.',
      en: 'If the front of the shoulder pinches or your arm tingles, lower the arm; stop if it continues. If you have ever dislocated a shoulder, keep the elbow below shoulder height.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: -50,
      elev: 30,
      props: [{ kind: 'wall', wall: 'right', dist: 1 }],
      keys: [
        WALL_ARM,
        merge(WALL_ARM, STEP_R),
        merge(WALL_ARM, STEP_R, { shR: { abd: 87, rot: 85, flex: -8, hab: 41 }, thorax: { twist: 20 }, lumbar: { twist: 8 }, scapR: { prot: -1.5 } }),
      ],
      labels: [
        { ko: '팔꿈치 어깨 높이로 벽에', en: 'Forearm on wall, 90/90' },
        { ko: '오른발 반 걸음 앞으로', en: 'Step right foot forward' },
        { ko: '가슴 왼쪽으로 돌려 30초', en: 'Turn chest away, hold 30 s' },
      ],
      durations: [1.2, 1.8, 1.6],
      pauses: [0.6, 0.4, 3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'shR', side: 'front', kind: 'stretch' },
        { a: 'shR', b: 'elR', side: 'front', kind: 'stretch', r: 2.4, from: 0.05, to: 0.55 },
      ],
    },
  },
  {
    id: 'chair-tspine-extension',
    name: { ko: '의자 등받이 등 펴기', en: 'Chair thoracic extension' },
    phase: 'mobility',
    position: 'seated',
    regions: ['upperBack'],
    targets: { kyphosis: 1, roundShoulder: 0.6, fhp: 0.4, upperBackPain: 0.7, stiffness: 0.4 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, holdSec: 2, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '엉덩이를 등받이 쪽으로 깊숙이 넣어 앉아요. 등받이 윗모서리가 날개뼈 아래쪽(가슴 뒤 중간 높이)에 오는 의자가 가장 좋아요.',
        '두 발은 골반 너비로 바닥에 평평하게, 무릎은 90°로 둬요.',
        '양손 깍지를 껴 뒤통수를 받치고, 팔꿈치는 얼굴 앞에서 가볍게 모아요.',
        '배꼽을 살짝 당겨 갈비뼈 아래쪽이 앞으로 들리지 않게 준비해요.',
      ],
      en: [
        'Sit with your hips all the way back. A chair whose backrest top meets your mid-back, just below the shoulder blades, works best.',
        'Place your feet flat and hip-width apart, knees at 90°.',
        'Interlace your fingers behind your head to support it, elbows gently together in front of your face.',
        'Draw your navel in slightly so your lower ribs don’t flare forward.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 정수리를 천장 쪽으로 1~2cm 길게 늘여요.',
        '내쉬며 2초에 걸쳐 등받이 모서리를 받침점 삼아 가슴을 천장 쪽으로 들어 올리듯 뒤로 젖혀요.',
        '시선은 천장과 벽이 만나는 선까지만 따라가고, 머리 무게는 손에 맡겨요. 끝에서 2초 멈춰요.',
        '들이마시며 2초에 걸쳐 배에 힘을 주고 처음 자세로 돌아와요.',
        '8회 반복해요. 엉덩이는 의자에, 허리는 움직이지 않게 해요.',
      ],
      en: [
        'Inhale and lengthen the crown of your head 1–2 cm toward the ceiling.',
        'Exhale and, over 2 seconds, arch your chest up and back over the top of the backrest as if lifting it toward the ceiling.',
        'Let your eyes travel only as far as where the ceiling meets the wall, with your head resting in your hands. Pause 2 seconds at the end.',
        'Inhale and use your abs to return to the start over 2 seconds.',
        'Repeat 8 times, keeping your hips on the seat and your low back still.',
      ],
    },
    breathing: {
      ko: '들이쉬며 길어지고, 내쉬며 젖히고, 끝에서 2초 머문 뒤 들이쉬며 돌아와요. 숨을 참지 마세요.',
      en: 'Inhale to lengthen, exhale to arch back, pause 2 seconds, then inhale as you return. Don’t hold your breath.',
    },
    feel: {
      ko: '날개뼈 사이~등 한가운데가 뒤로 펴지며 뻐근하게 늘어나고, 가슴 앞이 열리는 느낌이면 정답이에요. 허리가 조이거나 목 뒤가 눌리면 범위를 줄이고, 등에 날카로운 통증이나 팔 저림이 있으면 멈춰요.',
      en: 'The area between and below your shoulder blades opens up and back while the front of your chest widens. If your low back pinches or the back of your neck feels compressed, reduce the range; stop for sharp back pain or arm tingling.',
    },
    easier: {
      ko: '팔을 가슴 앞에 X자로 모아 팔 무게를 줄이고, 범위를 절반만 해요. 등받이 모서리가 딱딱하면 수건을 접어 대요.',
      en: 'Cross your arms over your chest to take the arm weight away and use half the range. Pad a hard backrest edge with a folded towel.',
    },
    harder: {
      ko: '끝 자세에서 팔꿈치를 양옆으로 벌려 3초 버티며 가슴을 더 열거나, ‘폼롤러 등 펴기’로 넘어가요.',
      en: 'At the end position, open your elbows wide and hold for 3 seconds to open the chest further, or progress to the foam roller thoracic extension.',
    },
    cues: { ko: ['정수리 먼저 길게', '가슴을 천장으로', '머리는 손에 맡겨요', '갈비뼈는 내려요'], en: ['Grow tall first', 'Chest to the ceiling', 'Rest your head in your hands', 'Keep the ribs down'] },
    mistakes: {
      ko: [
        '허리를 꺾어 배가 앞으로 나옴 → 배꼽을 당기고 엉덩이를 의자에 붙여, 움직임이 등 윗부분에서만 일어나게 해요.',
        '목만 뒤로 젖힘 → 머리 무게를 손에 맡기고, 시선은 천장 모서리까지만 보내요.',
        '팔꿈치가 활짝 벌어지며 팔로 당김 → 팔꿈치는 얼굴 앞에서 가볍게 모은 채 가슴만 들어요.',
        '빠르게 튕기듯 반복 → 2초 젖히고, 2초 멈추고, 2초 돌아오는 속도를 지켜요.',
      ],
      en: [
        'Arching the low back so the belly pushes forward → Draw your navel in and keep your hips on the seat so the movement happens only in the upper back.',
        'Only tipping the head back → Rest your head in your hands and look no further than the ceiling line.',
        'Flaring the elbows and pulling with the arms → Keep the elbows gently together and lift with your chest.',
        'Bouncing quickly → Keep the rhythm: 2 seconds back, 2 seconds pause, 2 seconds up.',
      ],
    },
    why: {
      ko: '등이 둥글게 굳으면(흉추 후만) 머리와 어깨가 따라서 앞으로 나와요. 등받이를 받침점 삼아 흉추 마디를 뒤로 펴 주면 목과 어깨가 제자리를 찾기 쉬워지는, 사무실에서 가장 효율 좋은 동작이에요.',
      en: 'When the upper spine stiffens into a rounded shape, the head and shoulders follow it forward. Extending the thoracic segments over the chair back lets your neck and shoulders settle back into place — the best bang-for-buck desk move.',
    },
    muscles: { ko: '흉추 신전근, 흉추 관절 가동성 · 늘어남: 복직근 윗부분, 대흉근', en: 'Thoracic extensors & joint mobility · Stretch: upper abdominals, pecs' },
    anim: {
      view: 90,
      props: [{ kind: 'chair' }],
      keys: [
        merge(SIT_HANDS_HEAD, { thorax: { flex: 2 }, lumbar: { flex: 0 } }),
        merge(SIT_HANDS_HEAD, { thorax: { flex: -24 }, lumbar: { flex: -2 }, neck: { flex: -6 } }),
      ],
      labels: [
        { ko: '깍지 끼고 길게 앉기', en: 'Hands behind head, sit tall' },
        { ko: '내쉬며 가슴을 천장으로', en: 'Exhale, arch chest up' },
      ],
      durations: [2, 2],
      pauses: [0.4, 2],
      focus: [
        { a: 'backMid', b: 'backTop', kind: 'work', r: 2.8, from: 0, to: 1 },
        { a: 'chest', b: 'waist', side: 'front', kind: 'stretch', from: 0.1, to: 0.75 },
      ],
      trace: ['elR'],
      zoom: 1.15,
    },
  },
  {
    id: 'open-book',
    name: { ko: '오픈북 (등 돌리기)', en: 'Open book' },
    phase: 'mobility',
    position: 'sideLying',
    regions: ['upperBack', 'chest'],
    targets: { kyphosis: 0.8, upperBackPain: 0.8, roundShoulder: 0.6, stiffness: 0.5 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 5, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에 왼쪽으로 누워 머리 밑에 접은 수건이나 낮은 베개를 받쳐 목을 일직선으로 해요.',
        '엉덩이와 무릎을 각각 90°로 굽혀 두 무릎을 포개요. 무릎이 몸 앞쪽에 와요.',
        '두 팔을 어깨 높이에서 앞으로 곧게 뻗어 손바닥을 포개요.',
      ],
      en: [
        'Lie on your left side on a mat with a folded towel or low pillow under your head so your neck is in line.',
        'Bend your hips and knees to 90° and stack your knees in front of you.',
        'Reach both arms straight forward at shoulder height and stack your palms.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 위쪽(오른)팔을 손끝부터 천장 쪽으로 반원을 그리듯 들어 올려요. 시선은 손끝을 따라가요.',
        '팔이 천장을 지나면 가슴을 오른쪽 뒤로 열어 손등을 뒤쪽 바닥으로 가져가요. 무릎은 포갠 채 그대로예요.',
        '편하게 닿는 지점에서 1초 멈추고 숨을 끝까지 내쉬어요. 손이 바닥에 닿지 않아도 괜찮아요.',
        '들이마시며 같은 길로 팔을 되돌려 처음 손 위에 포개요.',
        '2초 열고, 1초 멈추고, 2초 돌아오는 속도로 8회 반복한 뒤 반대로 누워 왼쪽도 해요.',
      ],
      en: [
        'Exhale and lift your top (right) arm fingertips-first toward the ceiling in a half circle, eyes following your hand.',
        'As the arm passes the ceiling, open your chest back to the right and bring the back of your hand toward the floor behind you. Keep your knees stacked.',
        'Pause 1 second where it feels easy and finish your exhale. It’s fine if your hand doesn’t reach the floor.',
        'Inhale and bring the arm back along the same path to rest on the other hand.',
        'Take about 2 seconds to open, 1 to pause and 2 to return; do 8 reps, then lie on your other side.',
      ],
    },
    breathing: {
      ko: '열 때 길게 내쉬고, 열린 자리에서 남은 숨을 마저 내쉬며 가슴을 풀어 주고, 돌아올 때 들이마셔요.',
      en: 'Exhale long as you open, finish the breath out at the open position to let the chest soften, and inhale as you return.',
    },
    feel: {
      ko: '가슴 앞과 날개뼈 사이가 비틀리며 시원하게 늘어나면 정답이에요. 허리가 비틀리며 아프거나, 어깨 앞이 찝히거나, 팔이 저리면 범위를 줄여요.',
      en: 'A pleasant twisting stretch across the front of the chest and between the shoulder blades. If your low back twists painfully, the front of the shoulder pinches or your arm tingles, make the range smaller.',
    },
    easier: {
      ko: '위쪽 팔꿈치를 굽혀 손을 가슴 위에 얹고 팔꿈치만 뒤로 열어요. 두 무릎 사이에 쿠션을 끼우면 골반이 덜 흔들려요.',
      en: 'Bend the top elbow, rest the hand on your chest and open just the elbow back. A cushion between the knees keeps the pelvis steadier.',
    },
    harder: {
      ko: '열린 자리에서 3~5초 머물며 호흡을 두 번 하거나, 위쪽 무릎 밑에 폼롤러를 받쳐 골반을 고정하고 가슴만 더 돌려요.',
      en: 'Stay 3–5 seconds at the open position for two breaths, or rest the top knee on a foam roller to lock the pelvis and turn only the chest.',
    },
    cues: { ko: ['무릎은 포갠 채', '시선은 손을 따라', '내쉬며 활짝 열어요', '천천히 돌아와요'], en: ['Knees stay stacked', 'Eyes follow the hand', 'Exhale and open wide', 'Return slowly'] },
    mistakes: {
      ko: [
        '무릎이 벌어지며 골반이 같이 넘어감 → 두 무릎을 포개 바닥 쪽으로 눌러 두고, 가슴이 돌아가는 만큼만 열어요.',
        '팔만 억지로 뒤로 넘겨 어깨 앞이 찝힘 → 팔은 가슴을 따라가는 것뿐이에요. 가슴뼈를 천장 쪽으로 돌리는 데 집중해요.',
        '머리가 떨어지거나 목이 꺾임 → 머리 밑에 수건을 받치고, 머리는 가슴과 함께 굴리듯 돌려요.',
        '숨을 참고 빠르게 반복 → 한 번에 5초, 내쉬며 열고 들이쉬며 닫아요.',
      ],
      en: [
        'Knees splitting and the pelvis rolling back → Keep the knees stacked and pressed down, and open only as far as your chest turns.',
        'Forcing just the arm back until the shoulder pinches → The arm simply follows the chest; focus on turning your breastbone toward the ceiling.',
        'Head dropping or the neck kinking → Support your head on a towel and roll it along with your chest.',
        'Holding your breath and rushing → About 5 seconds per rep: exhale to open, inhale to close.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 흉추의 회전이 먼저 줄어들고, 그만큼 허리와 목이 대신 돌아가며 뻐근해져요. 골반을 고정하고 가슴만 돌리는 오픈북은 흉추 회전을 되살리고 가슴 앞도 함께 열어 호흡을 깊게 해요.',
      en: 'Sitting stiffens thoracic rotation first, so your low back and neck end up twisting for it. With the pelvis locked, the open book restores upper-back rotation and opens the chest, deepening your breath.',
    },
    muscles: { ko: '흉추 회전 가동성 · 늘어남: 대흉근, 소흉근, 삼각근 앞쪽', en: 'Thoracic rotation mobility · Stretch: pecs major & minor, front deltoid' },
    anim: {
      view: 60,
      elev: 50,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [
        merge(OB, { shL: { flex: 88 }, elL: 0, shR: { flex: 88, hab: -30 }, elR: 0, scapR: { prot: 2 }, neck: { side: -6 } }),
        merge(OB, { shL: { flex: 88 }, elL: 0, shR: { flex: 88, hab: 90 }, elR: 4, thorax: { twist: -18 }, neck: { twist: -25, side: -6 } }),
        merge(OB, { shL: { flex: 88 }, elL: 0, shR: { flex: 88, hab: 125 }, elR: 6, thorax: { twist: -55 }, lumbar: { twist: -8 }, neck: { twist: -40, side: -6 } }),
      ],
      labels: [
        { ko: '옆으로 누워 손 포개기', en: 'Side-lying, palms stacked' },
        { ko: '팔을 천장으로', en: 'Arm up to the ceiling' },
        { ko: '가슴 열어 뒤로', en: 'Open the chest back' },
      ],
      durations: [1.8, 1.4, 2],
      pauses: [0.3, 0.1, 1],
      focus: [
        { a: 'chest', b: 'shR', side: 'front', kind: 'stretch' },
        { a: 'shR', b: 'elR', side: 'front', kind: 'stretch', r: 2.4, from: 0.05, to: 0.55 },
      ],
      trace: ['haR'],
    },
  },
  {
    id: 'thread-needle',
    name: { ko: '스레드 더 니들', en: 'Thread the needle' },
    phase: 'mobility',
    position: 'quadruped',
    regions: ['upperBack', 'shoulder'],
    targets: { upperBackPain: 0.7, kyphosis: 0.6, stiffness: 0.5, roundShoulder: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 6, tempo: 5, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에서 네발 자세를 만들어요. 손목은 어깨 바로 아래, 무릎은 골반 바로 아래, 발등은 바닥에 둬요.',
        '손가락을 넓게 펴 손바닥 전체로 바닥을 누르고, 머리부터 꼬리뼈까지 등을 평평하게 해요.',
        '시선은 두 손 사이 바닥에 두고, 배꼽을 살짝 당겨 허리가 처지지 않게 해요.',
      ],
      en: [
        'Come onto all fours on a mat: wrists under shoulders, knees under hips, tops of the feet on the floor.',
        'Spread your fingers and press through the whole palm; keep your back flat from head to tailbone.',
        'Look at the floor between your hands and draw your navel in slightly so your low back doesn’t sag.',
      ],
    },
    steps: {
      ko: [
        '체중을 왼손으로 살짝 옮기고, 들이마시며 오른팔을 천장으로 뻗어 가슴을 오른쪽으로 열어요. 시선은 오른손 끝을 따라가요.',
        '내쉬며 오른팔을 내려 왼손과 왼무릎 사이로 손등이 바닥을 스치듯 왼쪽 끝까지 밀어 넣어요.',
        '오른쪽 어깨 뒤쪽과 오른쪽 관자놀이를 바닥 가까이 내려 날개뼈 사이를 비틀어 늘려요. 엉덩이는 무릎 위에 그대로예요.',
        '그 자리에서 1초 머물며 숨을 끝까지 내쉬고, 오른손을 처음 자리로 가져와요.',
        '한 번에 약 5초씩 6회 반복한 뒤 왼쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Shift a little weight onto your left hand, then inhale and reach your right arm to the ceiling, opening your chest to the right. Eyes follow your right hand.',
        'Exhale and sweep the right arm down and through the gap between your left hand and left knee, back of the hand gliding along the floor as far left as it goes.',
        'Let the back of your right shoulder and your right temple sink toward the floor to twist and stretch between the shoulder blades. Keep your hips over your knees.',
        'Stay 1 second while you finish the exhale, then bring your right hand back to its starting spot.',
        'Take about 5 seconds per rep; do 6 reps, then switch to the left side.',
      ],
    },
    breathing: {
      ko: '팔을 천장으로 열 때 들이마시고, 아래로 꿰어 넣을 때 길게 내쉬어요.',
      en: 'Inhale as you open the arm to the ceiling; exhale long as you thread it under.',
    },
    feel: {
      ko: '날개뼈 사이와 오른쪽 어깨 뒤쪽이 비틀리며 늘어나면 정답이에요. 받치는 왼팔과 어깨에는 버티는 힘이 느껴져요. 손목·무릎 통증, 어깨 찝힘, 팔 저림이 있으면 멈춰요.',
      en: 'A twisting stretch between the shoulder blades and across the back of the right shoulder, while the supporting left arm and shoulder work to hold you. Stop for wrist or knee pain, a shoulder pinch or arm tingling.',
    },
    easier: {
      ko: '손목이 불편하면 주먹을 쥐거나 받치는 팔을 아래팔로 대고, 무릎이 아프면 무릎 밑에 수건을 접어 대요. 범위는 절반만 해도 돼요.',
      en: 'If your wrist complains, make a fist or lean on the forearm; pad sore knees with a folded towel. Half the range is fine.',
    },
    harder: {
      ko: '꿰어 넣은 자리에서 20~30초 머물며 호흡하거나, 받치는 손을 머리 위쪽으로 한 뼘 멀리 짚어 어깨 뒤를 더 늘려요.',
      en: 'Stay 20–30 seconds in the threaded position and breathe, or walk the supporting hand a hand-span further forward to stretch the back of the shoulder more.',
    },
    cues: { ko: ['엉덩이는 무릎 위에', '시선은 손끝을 따라', '내쉬며 깊숙이', '어깨를 바닥 쪽으로'], en: ['Hips over knees', 'Eyes follow your hand', 'Exhale and thread deep', 'Shoulder toward the floor'] },
    mistakes: {
      ko: [
        '엉덩이가 옆으로 빠지거나 뒤꿈치 쪽으로 앉음 → 엉덩이를 무릎 바로 위에 둔 채 가슴만 돌려요.',
        '허리로 비틀어 움직임 → 배꼽을 살짝 당겨 허리를 고정하고, 날개뼈 사이가 돌아가는 데 집중해요.',
        '받치는 팔이 무너지며 어깨가 귀로 올라감 → 왼손으로 바닥을 밀어 어깨를 귀에서 멀게 유지해요.',
        '머리 무게로 목을 눌러 꺾음 → 관자놀이는 바닥에 살짝 닿거나 뜬 정도로 두고, 목은 가슴을 따라 돌려요.',
      ],
      en: [
        'Hips drifting sideways or sitting back toward the heels → Keep your hips right over your knees and turn only the chest.',
        'Twisting from the low back → Draw your navel in to keep the low back still and focus on turning between the shoulder blades.',
        'Supporting arm collapsing so the shoulder hikes to the ear → Push the floor away with your left hand to keep the shoulder away from the ear.',
        'Letting the head’s weight crank the neck → Let the temple just touch or hover above the floor; the neck simply follows the chest.',
      ],
    },
    why: {
      ko: '네발 자세로 허리를 고정한 채 흉추만 회전시키면서, 날개뼈 사이에 뭉친 능형근과 어깨 뒤쪽을 함께 늘려요. 등 윗부분의 뻐근함과 굳은 회전을 동시에 풀어 줘요.',
      en: 'All fours locks the low back so only the upper spine rotates, while the rhomboids and the back of the shoulder get a stretch — easing upper-back tightness and restoring rotation together.',
    },
    muscles: { ko: '흉추 회전 가동성 · 늘어남: 능형근, 중부 승모근, 삼각근 뒤쪽 · 힘씀: 받치는 쪽 어깨 안정근', en: 'Thoracic rotation mobility · Stretch: rhomboids, middle traps, rear deltoid · Work: supporting shoulder stabilisers' },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      view: -40,
      elev: 25,
      props: [{ kind: 'mat' }],
      anchor: ['knL', 'knR'],
      keys: [
        QUAD,
        merge(QUAD, { root: { pitch: 72 }, thorax: { twist: -40 }, lumbar: { twist: -5 }, neck: { twist: -30 } }, both({ hip: { flex: 72 } }), {
          scapL: { prot: -2 },
          shL: { flex: 55, abd: 1, hab: 47 },
          elL: 34,
          shR: { flex: -45, abd: 114 },
          elR: 5,
          wrR: 0,
        }),
        merge(QUAD, { root: { pitch: 115 }, thorax: { twist: 48 }, lumbar: { twist: 10 }, neck: { twist: 20 } }, both({ hip: { flex: 114 } }), {
          shL: { flex: 76, abd: -6, hab: -43 },
          elL: 67,
          shR: { flex: 77, abd: 1, hab: -15 },
          elR: 8,
          wrR: 0,
        }),
      ],
      labels: [
        { ko: '네발 자세', en: 'All fours' },
        { ko: '오른팔 천장으로 열기', en: 'Open right arm up' },
        { ko: '왼팔 아래로 꿰어 넣기', en: 'Thread under left arm' },
      ],
      durations: [1.4, 2, 1.4],
      pauses: [0.3, 0.3, 1],
      focus: [
        { a: 'backTop', b: 'shR', side: 'back', kind: 'stretch' },
        { a: 'shR', b: 'elR', side: 'back', kind: 'stretch', r: 2.4, from: 0.05, to: 0.55 },
      ],
      trace: ['haR'],
    },
  },
  {
    id: 'foam-roller-tspine',
    name: { ko: '폼롤러 등 펴기', en: 'Foam roller thoracic extension' },
    phase: 'mobility',
    position: 'supine',
    regions: ['upperBack'],
    targets: { kyphosis: 1, roundShoulder: 0.6, upperBackPain: 0.7, fhp: 0.3 },
    equipment: ['foamRoller', 'mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, holdSec: 2, rest: 15 },
    setup: {
      ko: [
        '폼롤러를 매트 위에 가로로 놓고, 날개뼈 아래쪽 끝(브래지어 끈 높이)이 롤러에 오게 등을 대고 누워요.',
        '무릎을 세워 발은 골반 너비로 바닥에 두고, 엉덩이는 바닥에 붙여요.',
        '양손 깍지를 껴 뒤통수를 받치고 팔꿈치를 얼굴 앞에서 가볍게 모아 목 힘을 빼요.',
      ],
      en: [
        'Place a foam roller across the mat and lie back so it sits under the bottom tips of your shoulder blades (bra-strap height).',
        'Bend your knees with feet flat and hip-width apart, hips on the floor.',
        'Interlace your fingers behind your head and bring the elbows gently together so your neck can relax.',
      ],
    },
    steps: {
      ko: [
        '들이마시며 배꼽을 살짝 당겨 갈비뼈 아래쪽이 들리지 않게 준비해요.',
        '내쉬며 2초에 걸쳐 롤러를 받침점 삼아 머리와 등 윗부분을 바닥 쪽으로 천천히 젖혀요. 엉덩이는 바닥에 그대로예요.',
        '머리를 손에 맡긴 채 편한 끝 지점에서 2초 멈춰요.',
        '들이마시며 2초에 걸쳐 배에 힘을 주고 처음 자리로 돌아와요.',
        '4회 하면 엉덩이를 살짝 들고 발로 밀어 롤러를 3~4cm 위(어깨 쪽)로 옮긴 뒤 4회 더, 총 8회 해요.',
      ],
      en: [
        'Inhale and draw your navel in slightly so your lower ribs don’t flare.',
        'Exhale and, over 2 seconds, slowly arch your head and upper back down toward the floor over the roller. Hips stay down.',
        'With your head resting in your hands, pause 2 seconds at a comfortable end point.',
        'Inhale and use your abs to return to the start over 2 seconds.',
        'After 4 reps, lift your hips slightly and push with your feet to move the roller 3–4 cm up toward your shoulders, then do 4 more (8 in total).',
      ],
    },
    breathing: {
      ko: '내쉬며 젖히고, 끝에서 편하게 한 번 숨 쉬고, 들이쉬며 돌아와요. 숨을 참지 마세요.',
      en: 'Exhale as you arch back, breathe easily at the end, and inhale as you come back up. Don’t hold your breath.',
    },
    feel: {
      ko: '롤러가 닿은 등 마디가 뒤로 펴지며 시원하게 눌리고, 가슴 앞과 배 윗부분이 살짝 늘어나면 정답이에요. 허리가 꺾이며 조이거나, 날카로운 통증·팔 저림이 있으면 멈춰요.',
      en: 'The segments over the roller open back with a satisfying pressure, and the front of your chest and upper abs lengthen a little. Stop if your low back pinches, or you feel sharp pain or arm tingling.',
    },
    easier: {
      ko: '폼롤러 대신 지름 10cm 정도로 둘둘 만 수건을 쓰거나 범위를 절반만 해요. ‘의자 등받이 등 펴기’로 대신해도 좋아요.',
      en: 'Use a towel rolled to about 10 cm instead of the roller, or use half the range. The chair thoracic extension is a good substitute.',
    },
    harder: {
      ko: '끝 자세에서 두 팔을 머리 위로 뻗어 3초 버티거나(가슴·광배근까지 늘어나요), 끝에서 호흡 3번 동안 머물러요.',
      en: 'At the end position reach both arms overhead for 3 seconds (adds a chest and lat stretch), or stay there for three breaths.',
    },
    cues: { ko: ['엉덩이는 바닥에', '머리는 손에 맡겨요', '내쉬며 젖혀요', '갈비뼈는 내려요'], en: ['Hips stay down', 'Rest your head in your hands', 'Exhale and arch back', 'Keep the ribs down'] },
    mistakes: {
      ko: [
        '허리 아래(갈비뼈 밑)에 롤러를 두고 젖힘 → 롤러는 날개뼈 아래~어깨 높이 사이, 등 윗부분에만 두어요.',
        '엉덩이가 들리며 허리가 꺾임 → 엉덩이를 바닥에 무겁게 두고 배꼽을 살짝 당겨요.',
        '목을 뒤로 떨어뜨림 → 깍지 낀 손으로 머리를 받치고 팔꿈치를 모아요.',
        '빠르게 튕기듯 반복 → 2초 내려가고, 2초 멈추고, 2초 올라와요.',
      ],
      en: [
        'Arching over the roller below the ribs → Keep the roller between the bottom of the shoulder blades and shoulder height, on the upper back only.',
        'Hips lifting so the low back arches → Keep your hips heavy on the floor and your navel gently drawn in.',
        'Letting the head drop back → Support your head in your interlaced hands and keep the elbows together.',
        'Bouncing quickly → 2 seconds down, 2 seconds pause, 2 seconds up.',
      ],
    },
    why: {
      ko: '스마트폰·책상 자세로 굳은 흉추 마디를 하나씩 뒤로 펴 주면 등 굽음과 라운드숄더, 거북목 자세가 함께 좋아져요. 롤러가 받침점이 되어 원하는 마디만 골라 움직일 수 있어요.',
      en: 'Extending the thoracic segments stiffened by phone and desk posture, one at a time, helps a rounded upper back, rounded shoulders and forward head together. The roller acts as a fulcrum so you can target each level.',
    },
    muscles: { ko: '흉추 신전 가동성 · 늘어남: 복직근 윗부분, 대흉근 · 힘씀: 복부(갈비뼈 고정)', en: 'Thoracic extension mobility · Stretch: upper abdominals, pecs · Work: abs (keeping the ribs down)' },
    caution: {
      ko: '골다공증이 있거나 등에 날카로운 통증이 있으면 생략하세요. 허리 아래에서는 절대 하지 마세요.',
      en: 'Skip if you have osteoporosis or sharp back pain. Never roll under the low back.',
    },
    avoid: ['pregnant'],
    anim: {
      view: 90,
      elev: 10,
      props: [{ kind: 'mat' }, { kind: 'roller', at: 'backTop', off: [0, -7, 1] }],
      anchor: ['pelvis'],
      keys: [
        merge(ROLL, { thorax: { flex: 8 }, neck: { flex: 8 } }),
        merge(ROLL, { thorax: { flex: -26 }, neck: { flex: 2 } }),
      ],
      labels: [
        { ko: '롤러에 눕고 머리 받치기', en: 'On the roller, head in hands' },
        { ko: '내쉬며 등 윗부분 젖히기', en: 'Exhale, arch over the roller' },
      ],
      durations: [1.8, 1.8],
      pauses: [0.3, 1.8],
      focus: [
        { a: 'chest', b: 'waist', side: 'front', kind: 'stretch', from: 0.1, to: 0.75 },
        { a: 'waist', b: 'pelvis', side: 'front', kind: 'work', r: 2.6 },
      ],
      trace: ['head'],
    },
  },
  {
    id: 'seated-twist',
    name: { ko: '앉아서 척추 비틀기', en: 'Seated spinal twist' },
    phase: 'mobility',
    position: 'seated',
    regions: ['upperBack', 'lowBack'],
    targets: { stiffness: 0.7, upperBackPain: 0.5, lowBackPain: 0.3, kyphosis: 0.3 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 15, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '의자 가운데에 앉아 두 발을 골반 너비로 바닥에 평평하게 두고, 두 무릎을 가지런히 모아 앞을 보게 해요.',
        '좌골로 앉아 허리를 곧게 세우고, 정수리를 천장으로 길게 뻗어요.',
        '어깨는 한 번 으쓱했다가 툭 떨어뜨려 힘을 빼요.',
      ],
      en: [
        'Sit in the middle of the chair with your feet flat and hip-width apart, knees level and pointing forward.',
        'Sit up on your sit bones with a tall low back and reach your crown toward the ceiling.',
        'Shrug once and let your shoulders drop.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 정수리를 위로 1~2cm 더 길게 늘여요.',
        '내쉬며 왼손을 오른무릎 바깥쪽에 얹고, 가슴을 오른쪽으로 돌리기 시작해요.',
        '오른손을 뒤로 보내 의자 등받이(또는 오른쪽 좌석 뒤 모서리)를 잡고, 3초에 걸쳐 명치부터 가슴·어깨·머리 순서로 오른쪽으로 돌려요.',
        '골반과 무릎은 정면에 둔 채 15초 버텨요. 들이쉴 때 키를 늘이고, 내쉴 때 1~2cm 더 돌려요.',
        '천천히 정면으로 돌아와 왼쪽도 같은 방법으로 해요. 한쪽씩 2세트예요.',
      ],
      en: [
        'Inhale and lengthen your crown another 1–2 cm upward.',
        'Exhale, place your left hand on the outside of your right knee and begin turning your chest to the right.',
        'Reach your right hand back to hold the chair back (or the back corner of the seat) and, over 3 seconds, turn right in order: upper abdomen, chest, shoulders, then head.',
        'Keep your pelvis and knees facing forward and hold for 15 seconds. Grow tall as you inhale; turn 1–2 cm further as you exhale.',
        'Return slowly to the centre and repeat to the left; 2 sets per side.',
      ],
    },
    breathing: {
      ko: '들이쉬며 키를 늘이고, 내쉬며 돌려요. 버티는 동안에도 이 리듬을 반복하고, 숨을 참지 마세요.',
      en: 'Inhale to grow tall, exhale to turn. Keep this rhythm through the hold and don’t hold your breath.',
    },
    feel: {
      ko: '등 가운데와 옆구리, 날개뼈 주변이 비틀리며 시원하게 늘어나면 정답이에요. 허리가 찌릿하거나 다리가 저리면 범위를 줄이고, 계속되면 멈춰요.',
      en: 'A pleasant twisting stretch through your mid-back, the sides of your waist and around the shoulder blades. If your low back zings or your leg tingles, turn less; stop if it continues.',
    },
    easier: {
      ko: '손으로 당기지 말고 팔짱을 낀 채 돌 수 있는 만큼만 돌려요. 버티는 시간은 10초로 줄여도 돼요.',
      en: 'Cross your arms over your chest and turn only as far as you can without pulling. You can shorten the hold to 10 seconds.',
    },
    harder: {
      ko: '버티는 시간을 30초로 늘리거나, 누워서 하는 ‘오픈북’으로 흉추 회전을 더 넓혀요.',
      en: 'Build the hold up to 30 seconds, or move on to the open book to expand thoracic rotation further.',
    },
    cues: { ko: ['위로 길게, 그리고 돌려요', '골반·무릎은 정면', '내쉬며 조금 더', '어깨는 내려요'], en: ['Grow tall, then turn', 'Pelvis and knees forward', 'Exhale, a little more', 'Shoulders down'] },
    mistakes: {
      ko: [
        '등을 둥글게 만 채 비틂 → 먼저 좌골로 세워 앉아 정수리를 길게 뻗은 뒤 돌려요.',
        '목만 돌림 → 명치와 가슴부터 돌리고, 머리는 마지막에 가슴을 따라가요.',
        '한쪽 무릎이 앞으로 밀리며 골반이 따라 돎 → 두 무릎을 가지런히 두고, 골반은 정면에 고정해요.',
        '손으로 세게 당겨 억지로 비틂 → 손은 받침일 뿐이에요. 내쉴 때 몸통 힘으로 조금씩 더 돌려요.',
      ],
      en: [
        'Twisting while slumped → Sit up on your sit bones and lengthen through the crown before you turn.',
        'Turning only the neck → Start the turn from the upper abdomen and chest; the head follows last.',
        'One knee sliding forward so the pelvis turns too → Keep the knees level and the pelvis facing forward.',
        'Yanking with the hands to force the twist → The hands only steady you; turn a little further with your trunk on each exhale.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 척추의 회전이 굳어 등·허리가 뻐근해져요. 골반을 고정하고 등 윗부분부터 돌리면 흉추 회전을 되찾으면서 허리에는 부담을 덜 줘요.',
      en: 'Long sitting stiffens spinal rotation and leaves your back achy. Locking the pelvis and turning from the upper back restores thoracic rotation while sparing the low back.',
    },
    muscles: { ko: '흉추 회전 가동성 · 늘어남: 척추 회전근, 복사근, 광배근', en: 'Thoracic rotation mobility · Stretch: spinal rotators, obliques, lats' },
    anim: {
      view: 0,
      elev: 10,
      props: [{ kind: 'chair' }],
      keys: [
        SIT,
        merge(SIT, { thorax: { twist: -10 }, lumbar: { twist: -3 }, neck: { twist: -5 }, shL: { flex: 38, abd: -22, hab: -12 }, elL: 19 }),
        merge(SIT, { thorax: { twist: -34 }, lumbar: { twist: -10 }, neck: { twist: -18 }, shL: { flex: 14, abd: -16, hab: 11 }, elL: 53, shR: { flex: -46, abd: 29, hab: 4 }, elR: 81 }),
      ],
      labels: [
        { ko: '바르게 앉기', en: 'Sit tall' },
        { ko: '왼손을 오른무릎에', en: 'Left hand to right knee' },
        { ko: '오른쪽으로 돌려 15초', en: 'Turn right, hold 15 s' },
      ],
      durations: [1.2, 1.8, 1.6],
      pauses: [0.5, 0.4, 2.6],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'hipL', side: 'front', kind: 'stretch', r: 2.8, from: 0.15, to: 0.85 },
      ],
      trace: ['haL'],
    },
  },
  {
    id: 'chair-lat-stretch',
    name: { ko: '의자 잡고 등·겨드랑이 늘리기', en: 'Chair lat stretch' },
    phase: 'stretch',
    position: 'standing',
    regions: ['upperBack', 'shoulder'],
    targets: { kyphosis: 0.6, roundShoulder: 0.5, lordosis: 0.3, upperBackPain: 0.4 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '허리 높이의 튼튼한 의자 등받이나 책상 모서리를 마주 보고, 약 한 걸음 반(70~90cm) 뒤에 서요. 바퀴 달린 의자는 쓰지 마세요.',
        '두 발은 골반 너비로 나란히 두고, 무릎은 살짝 풀어요.',
        '배꼽을 살짝 당겨 허리를 평평하게 준비해요.',
      ],
      en: [
        'Face a sturdy waist-high chair back or the edge of a desk and stand about a step and a half (70–90 cm) away. Don’t use a chair on wheels.',
        'Set your feet parallel and hip-width apart with soft knees.',
        'Draw your navel in slightly to keep your low back flat.',
      ],
    },
    steps: {
      ko: [
        '무릎을 살짝 굽히고 골반부터 인사하듯 숙여, 두 손을 어깨 너비로 등받이 위에 얹어요. 팔꿈치는 쭉 펴요.',
        '엉덩이를 뒤로 10~15cm 더 밀어 상체가 바닥과 거의 평행이 되게 해요. 팔과 몸통이 일직선이 돼요.',
        '가슴을 바닥 쪽으로 지그시 내려 겨드랑이 아래~옆구리가 늘어나게 해요. 귀는 두 팔 사이에 둬요.',
        '30초 버티며, 숨을 내쉴 때마다 가슴을 1~2cm 더 내려요.',
        '무릎을 조금 더 굽히고 손으로 등받이를 밀며 천천히 상체를 세워 돌아와요. 2세트 해요.',
      ],
      en: [
        'Soften your knees and hinge from the hips as if bowing, placing both hands shoulder-width apart on the chair back. Keep your elbows straight.',
        'Push your hips back another 10–15 cm until your trunk is nearly parallel to the floor, arms and trunk in one line.',
        'Let your chest sink gently toward the floor so the area from your armpits down your sides lengthens. Keep your ears between your arms.',
        'Hold for 30 seconds, sinking the chest another 1–2 cm with each exhale.',
        'Bend your knees a little more and press into the chair back to rise slowly. Do 2 sets.',
      ],
    },
    breathing: {
      ko: '숙일 때 내쉬고, 버티는 동안 옆구리와 등 뒤로 숨을 불어넣듯 들이마셔요. 내쉴 때마다 조금 더 내려가요.',
      en: 'Exhale as you hinge, then during the hold breathe in as if filling your sides and back. Sink a little more with each exhale.',
    },
    feel: {
      ko: '겨드랑이 아래부터 옆구리·등 바깥쪽이 길게 늘어나고 날개뼈 주변이 풀리면 정답이에요. 허벅지 뒤가 먼저 당기면 무릎을 더 굽혀요. 어깨 앞 찝힘, 팔 저림, 허리 통증은 멈춤 신호예요.',
      en: 'A long stretch from your armpits down your sides and the outer back, with the shoulder blades loosening. If the backs of your thighs pull first, bend your knees more. Stop for a shoulder pinch, arm tingling or low back pain.',
    },
    easier: {
      ko: '손을 더 높은 곳(책상 위나 벽)에 대고 덜 숙이거나, 무릎을 더 굽혀요. 어깨가 불편하면 팔꿈치를 굽혀 아래팔을 책상에 대요.',
      en: 'Place your hands higher (on a desk or wall) and hinge less, or bend your knees more. If your shoulders complain, bend the elbows and rest your forearms on a desk.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘리거나, 엉덩이를 왼쪽으로 살짝 밀어 오른쪽 옆구리를 더 늘린 뒤 반대로도 해요. 손바닥이 위를 보게 뒤집어 대면 광배근이 더 늘어나요.',
      en: 'Build the hold to 45 seconds, or shift your hips slightly left to bias the right side, then switch. Turning your palms up adds more lat stretch.',
    },
    cues: { ko: ['엉덩이는 뒤로', '가슴은 바닥으로', '귀는 팔 사이에', '무릎은 살짝 굽혀요'], en: ['Hips back', 'Chest toward the floor', 'Ears between your arms', 'Keep the knees soft'] },
    mistakes: {
      ko: [
        '허리가 아래로 푹 꺼지며 꺾임 → 배꼽을 살짝 당겨 허리를 평평하게 두고, 가슴(날개뼈 사이)만 내려요.',
        '고개를 떨어뜨리거나 들어 올림 → 귀를 두 팔 사이에 두고 시선은 바닥을 봐요.',
        '무릎을 쭉 펴서 허벅지 뒤만 당김 → 무릎을 살짝 굽히고 엉덩이를 뒤로 빼면 등·겨드랑이에 집중돼요.',
        '팔꿈치가 굽음 → 팔을 쭉 펴고, 손은 등받이에 가볍게 얹기만 해요.',
      ],
      en: [
        'Letting the low back sag and arch → Draw your navel in to keep the low back flat and let only the chest (between the shoulder blades) sink.',
        'Dropping or lifting the head → Keep your ears between your arms and look at the floor.',
        'Locking the knees so only the hamstrings pull → Soften the knees and push the hips back to move the stretch into your back and armpits.',
        'Bending the elbows → Keep the arms straight and just rest your hands on the chair back.',
      ],
    },
    why: {
      ko: '광배근은 골반·허리에서 팔까지 이어져 있어 짧아지면 어깨를 안으로 말고 허리를 휘게 만들어요. 늘려 주면 등 굽음이 풀리고, 팔을 머리 위로 들 때 걸리는 느낌도 줄어요.',
      en: 'The lats run from the pelvis and low back to the arm, so when they’re tight they roll the shoulders in and arch the low back. Stretching them eases a rounded upper back and frees overhead reaching.',
    },
    muscles: { ko: '늘어남: 광배근, 대원근, 삼두근 긴 갈래 · 흉추 신전 가동성', en: 'Stretch: latissimus dorsi, teres major, long head of triceps · Thoracic extension mobility' },
    caution: {
      ko: '의자가 밀리지 않게 벽에 붙여 두세요. 어깨 앞이 찌릿하거나 팔이 저리면 손을 더 높은 곳에 대세요.',
      en: 'Brace the chair against a wall so it can’t slide. If the front of the shoulder zings or your arm tingles, place your hands higher.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 90,
      props: [{ kind: 'table', at: 'haR', key: 2, off: [11, 0, 14], size: [40, 0, 30] }],
      keys: [
        STAND,
        merge(both({ sh: { flex: 138 }, el: 10, hip: { flex: 70 }, kn: 14, an: 4 }), { root: { pitch: 60 }, neck: { flex: -10 } }),
        merge(both({ sh: { flex: 168 }, el: 4, hip: { flex: 100 }, kn: 22, an: 4 }), { root: { pitch: 82 }, thorax: { flex: -8 }, neck: { flex: -4 } }),
      ],
      labels: [
        { ko: '의자 마주 보고 서기', en: 'Stand facing the chair' },
        { ko: '숙여 두 손 올리기', en: 'Hinge, hands on chair' },
        { ko: '엉덩이 빼고 가슴 내리기', en: 'Hips back, chest down, 30 s' },
      ],
      durations: [1.6, 1.8, 1.8],
      pauses: [0.5, 0.5, 3],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'hipR', side: 'out', kind: 'stretch', from: 0.05, to: 0.7 },
        { a: 'shR', b: 'elR', side: 'back', kind: 'stretch', r: 2.4, from: 0.05, to: 0.6 },
      ],
      trace: ['haR'],
    },
  },
];
