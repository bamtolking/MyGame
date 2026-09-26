import { ArrowDownRight, ArrowUpRight, CircleCheck, Crosshair, Footprints, TriangleAlert, Wind } from 'lucide-preact';
import type { Exercise } from '../content/exercise-types';
import { L, LA, tr } from '../i18n';
import { Notice } from './ui';

/** "실수 → 고치는 법" 문장을 둘로 나눔 */
function splitFix(s: string): [string, string | null] {
  const i = s.indexOf('→');
  if (i < 0) return [s, null];
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

/**
 * 운동 따라 하기 안내 전체: 준비 자세 → 동작 순서 → 호흡 → 느껴야 할 곳 → 쉽게/어렵게 → 코칭 포인트 → 흔한 실수
 * (운동 상세 화면과 플레이어의 '동작 방법' 시트에서 같이 씀)
 */
export function ExerciseGuide({ ex, compact = false, activeStep }: { ex: Exercise; compact?: boolean; activeStep?: number }) {
  const setup = ex.setup ? LA(ex.setup) : [];
  return (
    <div class={`ex-guide${compact ? ' compact' : ''}`}>
      {setup.length > 0 && (
        <section>
          <h3 class="eg-title">
            <Footprints size={17} /> {tr('준비 자세', 'Starting position')}
          </h3>
          <ul class="eg-list">
            {setup.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 class="eg-title">
          <CircleCheck size={17} /> {tr('이렇게 해요', 'How to do it')}
        </h3>
        <ol class="eg-steps">
          {LA(ex.steps).map((s, i) => (
            <li key={i} class={activeStep === i ? 'on' : ''}>
              <span class="n">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
      {(ex.breathing || ex.feel) && (
        <div class="eg-pair">
          {ex.breathing && (
            <section class="eg-card">
              <h3 class="eg-title">
                <Wind size={17} /> {tr('호흡', 'Breathing')}
              </h3>
              <p>{L(ex.breathing)}</p>
            </section>
          )}
          {ex.feel && (
            <section class="eg-card feel">
              <h3 class="eg-title">
                <Crosshair size={17} /> {tr('여기가 느껴지면 정답', 'You should feel it here')}
              </h3>
              <p>{L(ex.feel)}</p>
            </section>
          )}
        </div>
      )}
      {(ex.easier || ex.harder) && (
        <div class="eg-pair">
          {ex.easier && (
            <section class="eg-card easy">
              <h3 class="eg-title">
                <ArrowDownRight size={17} /> {tr('더 쉽게', 'Make it easier')}
              </h3>
              <p>{L(ex.easier)}</p>
            </section>
          )}
          {ex.harder && (
            <section class="eg-card hard">
              <h3 class="eg-title">
                <ArrowUpRight size={17} /> {tr('더 어렵게', 'Make it harder')}
              </h3>
              <p>{L(ex.harder)}</p>
            </section>
          )}
        </div>
      )}
      <section>
        <h3 class="eg-title" style={{ color: 'var(--good)' }}>
          <CircleCheck size={17} /> {tr('코칭 포인트', 'Coaching cues')}
        </h3>
        <div class="eg-cues">
          {LA(ex.cues).map((s, i) => (
            <span key={i} class="eg-cue">
              “{s}”
            </span>
          ))}
        </div>
      </section>
      <section>
        <h3 class="eg-title" style={{ color: 'var(--severe)' }}>
          <TriangleAlert size={17} /> {tr('흔한 실수와 고치는 법', 'Common mistakes & fixes')}
        </h3>
        <ul class="eg-mistakes">
          {LA(ex.mistakes).map((s, i) => {
            const [bad, fix] = splitFix(s);
            return (
              <li key={i}>
                <div class="bad">{bad}</div>
                {fix && <div class="fix">{fix}</div>}
              </li>
            );
          })}
        </ul>
      </section>
      {ex.caution && (
        <Notice kind="warn" style={{ marginTop: 4 }}>
          {L(ex.caution)}
        </Notice>
      )}
    </div>
  );
}
