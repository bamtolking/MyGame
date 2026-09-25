import { useState } from 'preact/hooks';
import { AlertTriangle, HeartPulse, ShieldCheck } from 'lucide-preact';
import { Notice, Option, TopBar } from '../components/ui';
import { L, tr } from '../i18n';
import { nav, replace, route } from '../lib/router';
import { CAUTIONS, RED_FLAGS } from '../routine/generator';
import { profile } from '../state/store';

export function Safety() {
  const next = route.value.query.next ?? '/';
  const [flags, setFlags] = useState<string[]>(profile.value.redFlags);
  const [agree, setAgree] = useState(!!profile.value.safetyCheckedAt);
  const [result, setResult] = useState<'emergency' | 'caution' | null>(null);
  const toggle = (id: string) => setFlags(flags.includes(id) ? flags.filter((x) => x !== id) : [...flags, id]);

  const save = () => {
    profile.value = { ...profile.value, redFlags: flags, safetyCheckedAt: Date.now() };
    const emergency = flags.some((f) => RED_FLAGS.find((r) => r.id === f)?.emergency);
    const red = flags.some((f) => RED_FLAGS.some((r) => r.id === f));
    if (emergency) setResult('emergency');
    else if (red) setResult('caution');
    else replace(next);
  };

  if (result === 'emergency') {
    return (
      <div class="screen">
        <TopBar title={tr('안전 체크 결과', 'Safety check')} close onBack={() => replace('/')} />
        <div class="center" style={{ marginTop: 24 }}>
          <AlertTriangle size={56} color="var(--severe)" />
          <h1 class="h1" style={{ marginTop: 14 }}>
            {tr('지금은 운동보다\n진료가 먼저예요', 'Please see a doctor\nbefore exercising')
              .split('\n')
              .map((l, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {l}
                </span>
              ))}
          </h1>
        </div>
        <Notice kind="danger" style={{ marginTop: 20 }}>
          {tr(
            '체크하신 증상은 신경이나 혈관, 내부 장기와 관련된 응급 신호일 수 있어요. 운동을 멈추고 가능한 한 빨리 병원(응급실)을 방문하거나 119에 연락해 주세요.',
            'The symptoms you checked can signal an emergency involving nerves, blood vessels or internal organs. Stop exercising and seek urgent medical care or call emergency services.',
          )}
        </Notice>
        <div class="bottom-cta">
          <a class="btn primary block" href="tel:119" style={{ textDecoration: 'none' }}>
            {tr('119 전화하기', 'Call emergency services')}
          </a>
          <button class="btn ghost block" onClick={() => replace('/')}>
            {tr('홈으로', 'Home')}
          </button>
        </div>
      </div>
    );
  }

  if (result === 'caution') {
    return (
      <div class="screen">
        <TopBar title={tr('안전 체크 결과', 'Safety check')} close onBack={() => replace('/')} />
        <div class="center" style={{ marginTop: 24 }}>
          <AlertTriangle size={52} color="var(--mild)" />
          <h1 class="h1" style={{ marginTop: 14 }}>
            {tr('전문가 상담을 권해요', 'We recommend seeing a professional')}
          </h1>
        </div>
        <Notice kind="warn" style={{ marginTop: 20 }}>
          {tr(
            '체크한 항목은 정확한 진단이 필요한 신호일 수 있어요. 진료를 받기 전까지는 호흡과 가벼운 스트레칭 위주의 부드러운 루틴만 드릴게요. 통증이 늘면 바로 멈추세요.',
            'What you checked may need a proper diagnosis. Until you’ve been assessed, we’ll only suggest gentle breathing and light stretching. Stop if pain increases.',
          )}
        </Notice>
        <div class="bottom-cta">
          <button class="btn primary block" onClick={() => replace(next)}>
            {tr('부드러운 루틴으로 계속', 'Continue with a gentle routine')}
          </button>
          <button class="btn ghost block" onClick={() => replace('/')}>
            {tr('홈으로', 'Home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="screen">
      <TopBar title={tr('운동 전 안전 체크', 'Pre-exercise safety check')} />
      <div class="row" style={{ gap: 12, marginTop: 4 }}>
        <ShieldCheck size={36} color="var(--good)" />
        <p class="body" style={{ margin: 0 }}>
          {tr('물리치료사가 운동 처방 전에 꼭 확인하는 항목이에요. 해당하는 것이 있으면 체크해 주세요.', 'These are the checks a physio does before prescribing exercise. Tick anything that applies.')}
        </p>
      </div>
      <h2 class="h3" style={{ margin: '22px 0 10px' }}>
        {tr('최근 이런 증상이 있나요?', 'Any of these recently?')}
      </h2>
      <div class="stack sm">
        {RED_FLAGS.map((r) => (
          <Option key={r.id} on={flags.includes(r.id)} onClick={() => toggle(r.id)}>
            <span style={{ fontWeight: 500, fontSize: 15 }}>{L(r.text)}</span>
          </Option>
        ))}
      </div>
      <h2 class="h3" style={{ margin: '22px 0 10px' }}>
        {tr('해당하면 동작을 조절해 드려요', 'We’ll adapt your moves if…')}
      </h2>
      <div class="stack sm">
        {CAUTIONS.map((c) => (
          <Option key={c.id} on={flags.includes(c.id)} onClick={() => toggle(c.id)}>
            <span style={{ fontWeight: 500, fontSize: 15 }}>{L(c.text)}</span>
          </Option>
        ))}
      </div>
      <button class="card tap row" style={{ width: '100%', marginTop: 16, textAlign: 'left', gap: 12 }} onClick={() => nav('/pain')}>
        <span class="thumb" style={{ background: 'var(--severe-soft)', color: 'var(--severe)', width: 44, height: 44 }}>
          <HeartPulse size={22} />
        </span>
        <div class="grow">
          <div class="h3">{tr('아픈 곳이 있다면 통증 체크도 해 주세요', 'In pain? Add it to your pain check')}</div>
          <div class="caption">{tr('부위·강도에 맞춰 무리한 동작을 빼 드려요', 'We’ll leave out moves that could aggravate it')}</div>
        </div>
      </button>
      <div style={{ marginTop: 18 }}>
        <Option on={agree} onClick={() => setAgree(!agree)}>
          <span style={{ fontWeight: 500, fontSize: 14.5 }}>
            {tr('이 앱은 의료 진단·치료를 대신하지 않으며, 통증이 생기면 운동을 멈추겠다는 것을 이해했어요.', 'I understand this app doesn’t replace medical diagnosis or treatment, and I’ll stop if I feel pain.')}
          </span>
        </Option>
      </div>
      <div class="bottom-cta">
        <button class="btn primary block" disabled={!agree} onClick={save}>
          {flags.length ? tr('확인했어요', 'Confirm') : tr('해당 없음, 계속하기', 'None apply — continue')}
        </button>
      </div>
    </div>
  );
}
