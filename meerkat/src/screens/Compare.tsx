import { useState } from 'preact/hooks';
import { ArrowRight } from 'lucide-preact';
import type { MetricId } from '../analysis/norms';
import { Animal } from '../components/animals';
import { scoreColor, TopBar } from '../components/ui';
import { ScanPhoto } from '../components/ScanPhoto';
import { METRIC_INFO, metricValue } from '../content/metrics';
import { typeName } from '../content/types';
import { L, tr } from '../i18n';
import { scans } from '../state/store';

const ORDER: MetricId[] = ['headForward', 'shoulderForward', 'kyphosis', 'lordosis', 'pelvisForward', 'kneeExtension', 'headTilt', 'shoulderTilt', 'pelvicTilt', 'trunkShift', 'pelvicShift', 'kneeAlign'];

export function Compare() {
  const list = scans.value;
  const [ai, setAi] = useState(0);
  const [bi, setBi] = useState(Math.max(0, list.length - 1));
  const [view, setView] = useState<'front' | 'side'>('side');
  if (list.length < 2) {
    return (
      <div class="screen">
        <TopBar title={tr('전후 비교', 'Before & after')} fallback="/scan" />
        <p class="body">{tr('스캔이 두 번 이상 있어야 비교할 수 있어요.', 'You need at least two scans to compare.')}</p>
      </div>
    );
  }
  const A = list[ai], B = list[bi];
  const dScore = B.report.score - A.report.score;
  const days = Math.max(0, Math.round((B.at - A.at) / 864e5));
  const date = (t: number) => new Date(t).toLocaleDateString(tr('ko-KR', 'en-US'), { month: 'short', day: 'numeric' });
  const select = (value: number, set: (n: number) => void) => (
    <select class="input" style={{ height: 44, fontSize: 15 }} value={value} onChange={(e) => set(+(e.target as HTMLSelectElement).value)}>
      {list.map((s, i) => (
        <option key={s.id} value={i}>
          {date(s.at)} · {s.report.score}
          {tr('점', '')}
        </option>
      ))}
    </select>
  );
  return (
    <div class="screen">
      <TopBar title={tr('전후 비교', 'Before & after')} fallback="/scan" />
      <div class="row" style={{ gap: 8 }}>
        <div class="grow">{select(ai, setAi)}</div>
        <ArrowRight size={18} />
        <div class="grow">{select(bi, setBi)}</div>
      </div>
      <div class="card" style={{ marginTop: 14 }}>
        <div class="row" style={{ justifyContent: 'space-around' }}>
          <div class="center">
            <Animal id={A.report.type.primary} size={84} />
            <div class="caption">{L(typeName(A.report.type.primary, A.report.type.secondary))}</div>
            <div class="num" style={{ fontSize: 28, fontWeight: 900, color: scoreColor(A.report.score) }}>
              {A.report.score}
            </div>
          </div>
          <ArrowRight size={26} color="var(--text-3)" />
          <div class="center">
            <Animal id={B.report.type.primary} size={84} />
            <div class="caption">{L(typeName(B.report.type.primary, B.report.type.secondary))}</div>
            <div class="num" style={{ fontSize: 28, fontWeight: 900, color: scoreColor(B.report.score) }}>
              {B.report.score}
            </div>
          </div>
        </div>
        <div class="center" style={{ marginTop: 10 }}>
          <span class={`badge ${dScore >= 0 ? 'lv0' : 'lv3'}`} style={{ fontSize: 14, height: 30 }}>
            {tr(`${days}일 동안 ${dScore >= 0 ? '+' : ''}${dScore}점`, `${dScore >= 0 ? '+' : ''}${dScore} pts in ${days} days`)}
            {A.report.postureAge !== null && B.report.postureAge !== null && tr(` · 자세 나이 ${B.report.postureAge - A.report.postureAge >= 0 ? '+' : ''}${B.report.postureAge - A.report.postureAge}세`, ` · posture age ${B.report.postureAge - A.report.postureAge >= 0 ? '+' : ''}${B.report.postureAge - A.report.postureAge}`)}
          </span>
        </div>
      </div>
      <div class="seg" style={{ margin: '16px 0 12px' }}>
        <button class={view === 'side' ? 'on' : ''} onClick={() => setView('side')}>
          {tr('옆모습', 'Side')}
        </button>
        <button class={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>
          {tr('정면', 'Front')}
        </button>
      </div>
      <div class="grid-2">
        {[A, B].map((s, i) => (
          <div key={s.id}>
            <div class="caption center" style={{ marginBottom: 6 }}>
              {i === 0 ? tr('전', 'Before') : tr('후', 'After')} · {date(s.at)}
            </div>
            {s[view] ? <ScanPhoto scan={s} view={view} maxHeight={320} /> : <div class="card flat caption center">{tr('사진 없음', 'No photo')}</div>}
          </div>
        ))}
      </div>
      <div class="section-title">
        <h2 class="h2">{tr('항목별 변화', 'Changes by marker')}</h2>
      </div>
      <div class="card-list">
        {ORDER.map((id) => {
          const a = A.report.metrics[id], b = B.report.metrics[id];
          if (!a || !b) return null;
          const better = b.badness < a.badness - 0.02, worse = b.badness > a.badness + 0.02;
          return (
            <div key={id} class="list-item" style={{ minHeight: 52 }}>
              <div class="grow h3" style={{ fontWeight: 600, fontSize: 15 }}>
                {L(METRIC_INFO[id].name)}
              </div>
              <span class="num caption">{metricValue(a)}</span>
              <ArrowRight size={14} color="var(--text-3)" />
              <span class="num" style={{ fontWeight: 800, color: better ? 'var(--good)' : worse ? 'var(--severe)' : 'var(--text)' }}>
                {metricValue(b)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
