import { useState } from 'preact/hooks';
import { Camera, LineChart, Lock, Stethoscope } from 'lucide-preact';
import { Duck, Flamingo, Meerkat, Shrimp, Turtle } from '../components/animals';
import { Chip, Option, Steps } from '../components/ui';
import { tr } from '../i18n';
import { replace } from '../lib/router';
import { profile, type Goal, type Profile } from '../state/store';
import { BRAND } from '../config';

function Hero() {
  return (
    <div style={{ position: 'relative', height: 250, margin: '8px 0 4px' }} aria-hidden="true">
      <div style={{ position: 'absolute', left: '50%', top: 20, transform: 'translateX(-50%)' }} class="pop-in">
        <Meerkat size={190} />
      </div>
      <div class="bob" style={{ position: 'absolute', left: '4%', top: 10, animationDelay: '0.2s' }}>
        <Turtle size={78} />
      </div>
      <div class="bob" style={{ position: 'absolute', right: '4%', top: 0, animationDelay: '0.8s' }}>
        <Shrimp size={74} />
      </div>
      <div class="bob" style={{ position: 'absolute', left: '0%', bottom: 6, animationDelay: '1.3s' }}>
        <Duck size={72} />
      </div>
      <div class="bob" style={{ position: 'absolute', right: '0%', bottom: 10, animationDelay: '0.5s' }}>
        <Flamingo size={76} />
      </div>
    </div>
  );
}

const YEARS = Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 10 - i);

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({ ...profile.value });
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  const next = () => setStep(step + 1);
  const finish = (scan: boolean) => {
    profile.value = { ...p, onboarded: true };
    replace(scan ? '/scan/capture' : '/');
  };
  const toggleGoal = (g: Goal) => set({ goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g] });

  if (step === 0) {
    return (
      <div class="screen" style={{ display: 'flex', flexDirection: 'column' }}>
        <Hero />
        <h1 class="display fade-up" style={{ textAlign: 'center', marginTop: 8 }}>
          {tr('거북이에서', 'From turtle')}
          <br />
          <span class="brand-text">{tr('미어캣으로', 'to meerkat')}</span>
        </h1>
        <p class="body center fade-up" style={{ marginTop: 12, animationDelay: '0.1s' }}>
          {tr('사진 두 장이면 AI가 체형을 분석하고,\n물리치료사가 설계한 교정 운동을 매일 처방해요.', 'Two photos, and AI maps your posture.\nThen a physio-designed plan fixes it, day by day.')
            .split('\n')
            .map((l, i) => (
              <span key={i} style={{ display: 'block' }}>
                {l}
              </span>
            ))}
        </p>
        <div class="stack sm fade-up" style={{ marginTop: 24, animationDelay: '0.2s' }}>
          {[
            [Camera, tr('30초 AI 체형 분석', '30-second AI posture scan'), tr('거북목·굽은 등·골반·무릎 정렬 12가지 측정', '12 measurements: neck, back, pelvis, knees')],
            [Stethoscope, tr('물리치료사 설계 맞춤 운동', 'Physio-designed plan'), tr('풀기 → 늘리기 → 깨우기 → 통합, 매일 새 루틴', 'Release → stretch → activate → integrate')],
            [LineChart, tr('변화를 숫자로 확인', 'See your progress'), tr('자세 점수·자세 나이·전후 비교', 'Score, posture age, before & after')],
          ].map(([Icon, t, s]: any, i) => (
            <div class="row" key={i} style={{ gap: 14, padding: '10px 4px' }}>
              <span class="thumb" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                <Icon size={22} />
              </span>
              <div class="grow">
                <div class="h3">{t}</div>
                <div class="caption">{s}</div>
              </div>
            </div>
          ))}
        </div>
        <div class="grow" />
        <div class="row caption" style={{ justifyContent: 'center', marginTop: 18 }}>
          <Lock size={14} /> {tr('사진과 기록은 기기 밖으로 나가지 않아요', 'Photos and data never leave your device')}
        </div>
        <div class="bottom-cta">
          <button class="btn primary block" onClick={next}>
            {tr('시작하기', 'Get started')}
          </button>
        </div>
      </div>
    );
  }

  const header = (title: string, sub?: string) => (
    <div style={{ marginTop: 12, marginBottom: 20 }}>
      <Steps total={4} current={step - 1} />
      <h1 class="h1" style={{ marginTop: 24 }}>
        {title}
      </h1>
      {sub && (
        <p class="body" style={{ marginTop: 8 }}>
          {sub}
        </p>
      )}
    </div>
  );

  if (step === 1) {
    return (
      <div class="screen">
        {header(tr('당신에 대해 조금만\n알려주세요', 'Tell us a little\nabout you').replace('\n', ' '), tr('자세 나이와 cm 단위 측정에 쓰여요. 기기에만 저장돼요.', 'Used for your posture age and cm measurements. Stored only on this device.'))}
        <div class="stack lg">
          <div class="field">
            <label for="nick">{tr('닉네임', 'Nickname')}</label>
            <input id="nick" class="input" maxLength={12} placeholder={tr('예: 바른자세', 'e.g. Sam')} value={p.nickname} onInput={(e) => set({ nickname: (e.target as HTMLInputElement).value })} />
          </div>
          <div class="field">
            <label for="year">{tr('태어난 해', 'Birth year')}</label>
            <select id="year" class="input" value={p.birthYear ?? ''} onChange={(e) => set({ birthYear: +(e.target as HTMLSelectElement).value || null })}>
              <option value="">{tr('선택', 'Select')}</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div class="field">
            <label for="height">{tr('키', 'Height')}</label>
            <div class="input-unit">
              <input
                id="height"
                class="input"
                type="number"
                inputMode="numeric"
                min={120}
                max={220}
                placeholder="168"
                value={p.heightCm ?? ''}
                onInput={(e) => {
                  const v = +(e.target as HTMLInputElement).value;
                  set({ heightCm: v >= 120 && v <= 220 ? v : null });
                }}
              />
              <span>cm</span>
            </div>
          </div>
        </div>
        <div class="bottom-cta">
          <button class="btn primary block" onClick={next}>
            {tr('다음', 'Next')}
          </button>
          <button class="btn ghost block" onClick={next}>
            {tr('건너뛰기', 'Skip')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const jobs: [Profile['job'], string, string][] = [
      ['desk', '💻', tr('사무직 · 재택', 'Desk / remote work')],
      ['student', '📚', tr('학생 · 수험생', 'Student')],
      ['standing', '🧍', tr('서서 일해요', 'On my feet all day')],
      ['active', '🏃', tr('몸을 많이 써요', 'Physically active job')],
      ['other', '🙂', tr('기타', 'Other')],
    ];
    return (
      <div class="screen">
        {header(tr('하루를 어떻게 보내세요?', 'What does your day look like?'))}
        <div class="stack sm">
          {jobs.map(([id, emoji, label]) => (
            <Option key={id} emoji={emoji} on={p.job === id} onClick={() => set({ job: id })}>
              {label}
            </Option>
          ))}
        </div>
        <h2 class="h3" style={{ margin: '24px 0 10px' }}>
          {tr('하루에 앉아 있는 시간', 'Hours sitting per day')}
        </h2>
        <div class="chips">
          {[
            [3, tr('4시간 미만', '< 4 h')],
            [6, tr('4~8시간', '4–8 h')],
            [9, tr('8시간 이상', '8 h +')],
          ].map(([v, l]) => (
            <Chip key={v} on={p.sitHours === v} onClick={() => set({ sitHours: v as number })}>
              {l}
            </Chip>
          ))}
        </div>
        <h2 class="h3" style={{ margin: '20px 0 10px' }}>
          {tr('스마트폰 사용 시간', 'Phone screen time')}
        </h2>
        <div class="chips">
          {[
            [1, tr('2시간 미만', '< 2 h')],
            [3, tr('2~4시간', '2–4 h')],
            [5, tr('4시간 이상', '4 h +')],
          ].map(([v, l]) => (
            <Chip key={v} on={p.phoneHours === v} onClick={() => set({ phoneHours: v as number })}>
              {l}
            </Chip>
          ))}
        </div>
        <h2 class="h3" style={{ margin: '20px 0 10px' }}>
          {tr('운동 습관', 'Exercise habit')}
        </h2>
        <div class="chips">
          {[
            ['none', tr('거의 안 해요', 'Rarely')],
            ['some', tr('가끔 해요', 'Sometimes')],
            ['often', tr('주 3회 이상', '3+ times a week')],
          ].map(([v, l]) => (
            <Chip key={v} on={p.exercise === v} onClick={() => set({ exercise: v as Profile['exercise'] })}>
              {l}
            </Chip>
          ))}
        </div>
        <div class="bottom-cta">
          <button class="btn primary block" onClick={next}>
            {tr('다음', 'Next')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    const goals: [Goal, string, string, string][] = [
      ['neck', '🐢', tr('거북목·일자목 교정', 'Fix tech neck'), tr('뒷목 뻐근함, 두통', 'Stiff neck, headaches')],
      ['shoulder', '🦐', tr('라운드숄더·굽은 등', 'Rounded shoulders & back'), tr('어깨 말림, 등 통증', 'Rolled shoulders, back ache')],
      ['pelvis', '🦆', tr('골반·허리 정렬', 'Pelvis & low-back alignment'), tr('오리궁둥이, 짝다리', 'Arched back, leaning hips')],
      ['pain', '🩹', tr('통증 줄이기', 'Reduce pain'), tr('목·어깨·허리·무릎', 'Neck, shoulder, back, knee')],
      ['desk', '💼', tr('사무실 1분 스트레칭', 'One-minute desk breaks'), tr('일하면서 틈틈이', 'Little resets through the day')],
      ['overall', '✨', tr('전체적인 체형 관리', 'Overall posture'), tr('예쁘고 곧은 자세', 'Tall, confident posture')],
    ];
    return (
      <div class="screen">
        {header(tr('무엇을 바꾸고 싶나요?', 'What do you want to change?'), tr('여러 개 골라도 돼요', 'Pick as many as you like'))}
        <div class="stack sm">
          {goals.map(([id, emoji, label, sub]) => (
            <Option key={id} emoji={emoji} on={p.goals.includes(id)} onClick={() => toggleGoal(id)} sub={sub}>
              {label}
            </Option>
          ))}
        </div>
        <div class="bottom-cta">
          <button class="btn primary block" onClick={next} disabled={!p.goals.length}>
            {tr('다음', 'Next')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginTop: 12 }}>
        <Steps total={4} current={3} />
      </div>
      <div class="grow" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div class="pop-in" style={{ display: 'inline-block' }}>
            <Meerkat size={170} />
          </div>
          <h1 class="h1" style={{ marginTop: 12 }}>
            {tr(`준비 완료${p.nickname ? `, ${p.nickname}님` : ''}!`, `All set${p.nickname ? `, ${p.nickname}` : ''}!`)}
          </h1>
          <p class="body" style={{ marginTop: 10 }}>
            {tr('먼저 30초 AI 체형 스캔으로\n지금 내 자세가 어떤 동물인지 확인해 볼까요?', 'Start with a 30-second AI scan\nand find out which animal your posture is.')
              .split('\n')
              .map((l, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {l}
                </span>
              ))}
          </p>
          <p class="caption" style={{ marginTop: 14 }}>
            {BRAND.expertLine()}
          </p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn primary block" onClick={() => finish(true)}>
          {tr('AI 체형 스캔 시작', 'Start my AI scan')}
        </button>
        <button class="btn ghost block" onClick={() => finish(false)}>
          {tr('먼저 둘러볼게요', 'Look around first')}
        </button>
      </div>
    </div>
  );
}
