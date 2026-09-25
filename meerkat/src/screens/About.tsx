import { useEffect } from 'preact/hooks';
import { Duck, Flamingo, LogoMark, Meerkat, Shrimp, Turtle } from '../components/animals';
import { Notice, TopBar } from '../components/ui';
import { BRAND, EXPERT } from '../config';
import { L, tr } from '../i18n';

export function About() {
  useEffect(() => {
    if (location.hash.includes('#privacy')) document.getElementById('privacy')?.scrollIntoView();
  }, []);
  const refs = [
    ['Kendall FP, et al. Muscles: Testing and Function with Posture and Pain (5th ed.)', tr('표준 자세 수직선·자세 유형 분류', 'Plumb-line standard & posture types')],
    ['Janda V. Muscles and motor control in cervicogenic disorders (1994)', tr('상·하부 교차 증후군', 'Upper & lower crossed syndromes')],
    ['Hansraj KK. Surgical Technology International (2014)', tr('고개 숙임 각도에 따른 목 부하', 'Neck load by head flexion angle')],
    ['McGill S. Low Back Disorders (3rd ed.)', tr('허리 안정화 운동(Big 3)', 'Spine-sparing core training (Big 3)')],
    ['NASM. Corrective Exercise Training', tr('풀기→늘리기→깨우기→통합 연속체', 'Inhibit → lengthen → activate → integrate')],
    ['Milne & Lauder (1974); Greendale et al. (2011)', tr('Flexicurve 흉추 후만 지수', 'Flexicurve kyphosis index')],
  ];
  return (
    <div class="screen">
      <TopBar title={tr('미어캣 소개', 'About Meerkat')} fallback="/me" />
      <div class="center" style={{ marginTop: 8 }}>
        <LogoMark size={76} />
        <h1 class="h1" style={{ marginTop: 12 }}>
          {L(BRAND.name)}
        </h1>
        <p class="body" style={{ marginTop: 4 }}>
          {L(BRAND.tagline)}
        </p>
        <div class="row" style={{ justifyContent: 'center', gap: 2, marginTop: 14 }}>
          <Turtle size={54} />
          <Shrimp size={54} />
          <Duck size={54} />
          <Flamingo size={54} />
          <span style={{ fontSize: 22, margin: '0 4px' }}>→</span>
          <Meerkat size={64} />
        </div>
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('설계한 사람', 'Designed by')}</h2>
      </div>
      <div class="card">
        <div class="h2">{L(EXPERT.name)}</div>
        <div class="caption" style={{ marginTop: 2 }}>
          {L(EXPERT.title)}
        </div>
        <p class="body" style={{ marginTop: 10 }}>
          {L(EXPERT.bio)}
        </p>
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('어떻게 분석하나요?', 'How it works')}</h2>
      </div>
      <div class="card stack">
        <p class="body" style={{ margin: 0 }}>
          {tr(
            '구글의 온디바이스 AI(MediaPipe)가 사진에서 관절 33개와 몸의 윤곽을 찾으면, 물리치료 자세 평가 기준으로 각도와 거리를 계산해요. 모든 과정은 휴대폰 안에서만 이뤄져요.',
            'Google’s on-device AI (MediaPipe) finds 33 body landmarks and your outline; we then compute angles and distances using physiotherapy posture-assessment standards. Everything runs on your phone.',
          )}
        </p>
        <div class="h3">{tr('참고한 기준', 'References')}</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {refs.map(([r, d]) => (
            <li key={r}>
              {r} — {d}
            </li>
          ))}
        </ul>
      </div>

      <div class="section-title" id="privacy">
        <h2 class="h2">{tr('개인정보 보호', 'Privacy')}</h2>
      </div>
      <div class="card">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-2)', fontSize: 14.5 }}>
          <li>{tr('사진 분석은 기기 안에서만 이뤄지고 서버로 전송되지 않아요.', 'Photos are analysed on-device and never uploaded.')}</li>
          <li>{tr('사진과 기록은 이 기기의 앱 저장소에만 보관돼요. 회원가입이 없어요.', 'Photos and records are stored only in this app on this device. No account needed.')}</li>
          <li>{tr('공유 카드에는 사진이 들어가지 않아요.', 'Share cards never include your photo.')}</li>
          <li>{tr('마이 > 데이터에서 언제든 백업하거나 모두 삭제할 수 있어요.', 'Back up or delete everything anytime in Me > Data.')}</li>
        </ul>
      </div>

      <Notice kind="warn" style={{ marginTop: 16 }}>
        {tr(
          '미어캣은 건강한 성인의 자세 관리와 운동을 돕는 웰니스 앱이며 의료기기가 아니에요. 질병의 진단·치료를 대신하지 않아요. 통증·저림·힘 빠짐이 계속되거나 심해지면 의료진과 상담하세요.',
          'Meerkat is a wellness app for posture and exercise in healthy adults, not a medical device. It doesn’t diagnose or treat any condition. See a clinician if pain, numbness or weakness persists or worsens.',
        )}
      </Notice>

      <div class="section-title">
        <h2 class="h2">{tr('오픈소스', 'Open source')}</h2>
      </div>
      <div class="card caption" style={{ lineHeight: 1.7 }}>
        MediaPipe Tasks Vision (Apache-2.0) · Preact (MIT) · @preact/signals (MIT) · Lucide (ISC) · Pretendard (SIL OFL 1.1) · Capacitor (MIT)
      </div>
    </div>
  );
}
