import { ArrowLeftRight, ChevronRight, ScanLine } from 'lucide-preact';
import { Animal, Meerkat } from '../components/animals';
import { scoreColor, TopBar } from '../components/ui';
import { METRIC_INFO } from '../content/metrics';
import { typeName } from '../content/types';
import { L, tr } from '../i18n';
import { nav } from '../lib/router';
import { scans } from '../state/store';

export function ScanHub() {
  const list = [...scans.value].reverse();
  return (
    <div class="screen with-tabbar">
      <TopBar plain title={tr('AI 체형 스캔', 'AI posture scan')} />
      <div class="card" style={{ textAlign: 'center', paddingTop: 26 }}>
        <div class="bob" style={{ display: 'inline-block' }}>
          <Meerkat size={130} />
        </div>
        <h1 class="h1" style={{ marginTop: 8 }}>
          {tr('내 자세, 몇 점일까?', 'How does your posture score?')}
        </h1>
        <p class="body" style={{ marginTop: 6 }}>
          {tr('정면·옆모습 사진 두 장으로 12가지 자세 지표를 AI가 측정해요', 'AI measures 12 posture markers from a front and a side photo')}
        </p>
        <button class="btn primary block" style={{ marginTop: 18 }} onClick={() => nav('/scan/capture')}>
          <ScanLine size={20} /> {list.length ? tr('다시 스캔하기', 'Scan again') : tr('스캔 시작', 'Start scan')}
        </button>
      </div>

      {list.length > 0 && (
        <>
          <div class="section-title">
            <h2 class="h2">{tr('스캔 기록', 'Scan history')}</h2>
            {list.length >= 2 && (
              <button class="link-btn row" style={{ gap: 4 }} onClick={() => nav('/scan/compare')}>
                <ArrowLeftRight size={15} /> {tr('전후 비교', 'Compare')}
              </button>
            )}
          </div>
          <div class="card-list">
            {list.map((s) => (
              <button key={s.id} class="list-item" onClick={() => nav(`/scan/result/${s.id}`)}>
                <span class="thumb" style={{ background: 'var(--surface-2)' }}>
                  <Animal id={s.report.type.primary} size={44} />
                </span>
                <div class="grow">
                  <div class="h3">{L(typeName(s.report.type.primary, s.report.type.secondary))}</div>
                  <div class="caption">
                    {new Date(s.at).toLocaleDateString(tr('ko-KR', 'en-US'), { month: 'short', day: 'numeric', weekday: 'short' })}
                    {s.label ? ` · ${s.label}` : ''}
                    {s.report.postureAge !== null ? tr(` · 자세 나이 ${s.report.postureAge}세`, ` · posture age ${s.report.postureAge}`) : ''}
                  </div>
                </div>
                <span class="num" style={{ fontWeight: 800, fontSize: 20, color: scoreColor(s.report.score) }}>
                  {s.report.score}
                </span>
                <ChevronRight size={18} class="chev" />
              </button>
            ))}
          </div>
        </>
      )}

      <div class="section-title">
        <h2 class="h2">{tr('이런 걸 측정해요', 'What we measure')}</h2>
      </div>
      <div class="card">
        <div class="h3" style={{ marginBottom: 8 }}>
          {tr('옆모습', 'Side view')}
        </div>
        <div class="chips">
          {(['headForward', 'shoulderForward', 'kyphosis', 'lordosis', 'pelvisForward', 'kneeExtension'] as const).map((id) => (
            <span key={id} class="badge">
              {L(METRIC_INFO[id].name)}
            </span>
          ))}
        </div>
        <div class="h3" style={{ margin: '16px 0 8px' }}>
          {tr('정면', 'Front view')}
        </div>
        <div class="chips">
          {(['headTilt', 'shoulderTilt', 'pelvicTilt', 'trunkShift', 'pelvicShift', 'kneeAlign'] as const).map((id) => (
            <span key={id} class="badge">
              {L(METRIC_INFO[id].name)}
            </span>
          ))}
        </div>
        <p class="caption" style={{ marginTop: 14 }}>
          {tr('물리치료 자세 평가의 기준인 “Kendall 수직선”과 관절 각도를 AI로 재현했어요. 매주 같은 옷·같은 장소에서 찍으면 변화를 가장 정확하게 볼 수 있어요.', 'We recreate the physio-standard Kendall plumb-line assessment with AI. Scan weekly in the same clothes and spot for the most accurate comparison.')}
        </p>
      </div>
    </div>
  );
}
