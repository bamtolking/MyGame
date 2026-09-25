import { useEffect, useRef, useState } from 'preact/hooks';
import { Smartphone } from 'lucide-preact';
import type { CoachSpec } from '../content/exercise-types';
import { L, tr } from '../i18n';
import { startCamera, stopCamera } from '../pose/camera';
import { BODY_CONNECTIONS } from '../pose/landmarks';
import { Coach, type CoachState } from './tracker';

interface Props {
  spec: CoachSpec;
  /** 세트가 바뀔 때마다 바꿔 주면 횟수가 초기화됨 */
  resetKey: string;
  running: boolean;
  onState: (s: CoachState) => void;
}

/** 카메라로 동작을 보고 횟수·자세를 판정 */
export function CoachCam({ spec, resetKey, running, onState }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coach = useRef(new Coach(spec));
  const live = useRef({ running, onState });
  live.current = { running, onState };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    coach.current = new Coach(spec);
  }, [resetKey, spec]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    let raf = 0;
    const video = videoRef.current!;
    const cv = canvasRef.current!;
    const g = cv.getContext('2d')!;
    (async () => {
      try {
        stream = await startCamera(video, 'user');
        const { videoTracker } = await import('../pose/engine');
        const tracker = await videoTracker({ model: 'lite' });
        if (!alive) return;
        setStatus('ready');
        const tick = () => {
          if (!alive) return;
          const now = performance.now();
          const f = tracker.detect(video, now);
          if (live.current.running) live.current.onState(coach.current.update(f, now / 1000));
          // 뼈대 그리기 (거울 모드)
          const rect = cv.getBoundingClientRect();
          if (cv.width !== Math.round(rect.width)) {
            cv.width = Math.round(rect.width);
            cv.height = Math.round(rect.height);
          }
          g.clearRect(0, 0, cv.width, cv.height);
          if (f && video.videoWidth) {
            const vw = video.videoWidth, vh = video.videoHeight;
            const s = Math.max(cv.width / vw, cv.height / vh);
            const ox = (cv.width - vw * s) / 2, oy = (cv.height - vh * s) / 2;
            g.strokeStyle = 'rgba(18,183,106,0.95)';
            g.lineWidth = 4;
            g.lineCap = 'round';
            for (const [a, b] of BODY_CONNECTIONS) {
              const pa = f.pts[a], pb = f.pts[b];
              if (pa.v < 0.4 || pb.v < 0.4) continue;
              g.beginPath();
              g.moveTo(ox + (vw - pa.x) * s, oy + pa.y * s);
              g.lineTo(ox + (vw - pb.x) * s, oy + pb.y * s);
              g.stroke();
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        console.warn('[coach]', e);
        if (alive) setStatus('error');
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stopCamera(stream);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#111', borderRadius: 20, overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {status !== 'ready' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}>
          {status === 'loading' ? tr('AI 코치 준비 중…', 'Starting AI coach…') : tr('카메라를 쓸 수 없어요. 애니메이션을 보며 따라 해 주세요.', 'Camera unavailable — follow the animation instead.')}
        </div>
      )}
      {status === 'ready' && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, fontSize: 12.5, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 10, padding: '6px 10px' }}>
          <Smartphone size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {L(spec.hint)}
        </div>
      )}
    </div>
  );
}
