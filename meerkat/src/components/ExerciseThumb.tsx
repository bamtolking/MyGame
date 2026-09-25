import { useEffect, useState } from 'preact/hooks';
import type { Exercise } from '../content/exercises';
import { thumbnail } from '../figure/Figure';
import { L } from '../i18n';
import { nav } from '../lib/router';

/** 운동 대표 자세 썸네일 (한 번 그린 뒤 캐시) */
export function ExerciseThumb({ ex, size = 64, onClick, still = false }: { ex: Exercise; size?: number; onClick?: () => void; still?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // 첫 렌더를 막지 않도록 다음 프레임에 그림
    const id = requestAnimationFrame(() => {
      if (alive) setSrc(thumbnail(ex.id, ex.anim, Math.round(size * Math.min(3, window.devicePixelRatio || 1))));
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [ex.id, size]);
  const style = { width: size, height: size, borderRadius: size * 0.28, background: 'var(--surface-2)', flex: 'none' };
  const img = src ? <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} /> : null;
  if (still) {
    return (
      <span class="thumb" style={style} aria-hidden="true">
        {img}
      </span>
    );
  }
  return (
    <button class="thumb" style={style} onClick={onClick ?? (() => nav(`/exercise/${ex.id}`))} aria-label={L(ex.name)}>
      {img}
    </button>
  );
}
