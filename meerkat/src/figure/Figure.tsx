import { useEffect, useRef } from 'preact/hooks';
import { DARK, holdKeyOf, keyTime, LIGHT, prepare, renderAt, type AnimSpec, type Prepared } from './render';

interface Props {
  spec: AnimSpec;
  /** 반대쪽(좌우 반전) 시범 */
  mirror?: boolean;
  playing?: boolean;
  speed?: number;
  /** 외부에서 시간을 지정(초). 지정하면 내부 시계를 쓰지 않음 */
  time?: number;
  height?: number | string;
  class?: string;
  label?: string;
  /** 카메라를 기본 방향에서 더 돌린 각도(도) */
  yaw?: number;
  /** 근육 강조·움직임 경로 표시 */
  overlays?: boolean;
  /** 매 프레임 현재 시각 알림(내부 시계) */
  onTime?: (t: number) => void;
  /** 이 시각으로 이동 (id 가 바뀔 때마다 적용) */
  seek?: { t: number; id: number };
}

function palette() {
  return document.documentElement.dataset.theme === 'dark' ? DARK : LIGHT;
}

/** 운동 시범 애니메이션 캔버스 */
export function Figure({ spec, mirror = false, playing = true, speed = 1, time, height = 260, class: cls, label, yaw = 0, overlays = false, onTime, seek }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ prep: Prepared | null; w: number; h: number; t: number; last: number; seekId: number }>({ prep: null, w: 0, h: 0, t: 0, last: 0, seekId: -1 });
  const live = useRef({ playing, speed, time, overlays, onTime });
  live.current = { playing, speed, time, overlays, onTime };
  if (seek && seek.id !== state.current.seekId) {
    state.current.seekId = seek.id;
    state.current.t = seek.t;
  }

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const st = state.current;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      st.w = cv.width;
      st.h = cv.height;
      st.prep = prepare(spec, st.w, st.h, mirror, yaw);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(cv);
    let raf = 0;
    st.last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - st.last) / 1000);
      st.last = now;
      const lv = live.current;
      if (lv.time === undefined && lv.playing) st.t += dt * lv.speed;
      const t = lv.time ?? st.t;
      lv.onTime?.(t);
      g.clearRect(0, 0, st.w, st.h);
      if (st.prep) renderAt(g, st.prep, t, palette(), { overlays: lv.overlays, now: now / 1000 });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [spec, mirror, yaw]);

  return <canvas ref={ref} class={cls} role="img" aria-label={label} style={{ width: '100%', height, display: 'block' }} />;
}

/** 목록용 정지 썸네일 (dataURL 캐시) */
const thumbCache = new Map<string, string>();
export function thumbnail(key: string, spec: AnimSpec, size = 160, t?: number): string {
  const theme = palette() === DARK ? 'd' : 'l';
  const k = `${key}:${size}:${theme}`;
  const hit = thumbCache.get(k);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const prep = prepare({ ...spec, zoom: (spec.zoom ?? 1) * 1.05 }, size, size);
  // 대표 프레임: 버티는 자세(기본은 두 번째 키)
  const at = t ?? keyTime(spec, holdKeyOf(spec));
  renderAt(g, prep, at, palette());
  const url = cv.toDataURL('image/png');
  thumbCache.set(k, url);
  return url;
}
