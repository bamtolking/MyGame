import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { ChevronLeft, X } from 'lucide-preact';
import { back } from '../lib/router';
import { tr } from '../i18n';

// ── 상단 바 ───────────────────────────────

export function TopBar(props: {
  title?: ComponentChildren;
  onBack?: () => void;
  close?: boolean;
  right?: ComponentChildren;
  plain?: boolean;
  fallback?: string;
}) {
  const Icon = props.close ? X : ChevronLeft;
  return (
    <header class={`top-bar${props.plain ? ' plain' : ''}`}>
      {!props.plain && (
        <button class="icon-btn" aria-label={tr('뒤로', 'Back')} onClick={props.onBack ?? (() => back(props.fallback))}>
          <Icon size={26} strokeWidth={2.2} />
        </button>
      )}
      <div class="title">{props.title}</div>
      {props.right && <div class="row" style={{ marginLeft: 'auto' }}>{props.right}</div>}
    </header>
  );
}

// ── 바텀 시트 ──────────────────────────────

export function Sheet(props: { open: boolean; onClose: () => void; children: ComponentChildren; label?: string }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.label} onClick={(e) => e.stopPropagation()}>
        <div class="grip" />
        {props.children}
      </div>
    </div>
  );
}

// ── 토스트 ────────────────────────────────

const toastMsg = signal<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(msg: string, ms = 2200) {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMsg.value = null), ms);
}

export function ToastHost() {
  return toastMsg.value ? (
    <div class="toast" role="status">
      {toastMsg.value}
    </div>
  ) : null;
}

// ── 확인 대화상자 (window.confirm 대신) ─────────────

interface ConfirmReq {
  message: string;
  ok: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}
const confirmReq = signal<ConfirmReq | null>(null);

/** 앱 안에서 뜨는 확인 창. 네이티브·임베드 환경에서도 동작 */
export function ask(message: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    confirmReq.value?.resolve(false);
    confirmReq.value = { message, ok: opts.ok ?? tr('확인', 'OK'), danger: !!opts.danger, resolve };
  });
}

export function ConfirmHost() {
  const r = confirmReq.value;
  const close = (v: boolean) => {
    r?.resolve(v);
    confirmReq.value = null;
  };
  return (
    <Sheet open={!!r} onClose={() => close(false)} label={tr('확인', 'Confirm')}>
      {r && (
        <>
          <p class="h3" style={{ margin: '4px 2px 18px', lineHeight: 1.5 }}>
            {r.message}
          </p>
          <div class="row" style={{ gap: 10 }}>
            <button class="btn secondary grow" onClick={() => close(false)}>
              {tr('취소', 'Cancel')}
            </button>
            <button class="btn primary grow" style={r.danger ? { background: 'var(--severe)' } : undefined} onClick={() => close(true)}>
              {r.ok}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ── 입력 컨트롤 ─────────────────────────────

export function Toggle(props: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      class={`toggle${props.on ? ' on' : ''}`}
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      onClick={() => props.onChange(!props.on)}
    />
  );
}

export function Seg<T extends string | number>(props: { value: T; options: { value: T; label: ComponentChildren }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="tablist">
      {props.options.map((o) => (
        <button key={String(o.value)} role="tab" aria-selected={o.value === props.value} class={o.value === props.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip(props: { on?: boolean; onClick?: () => void; children: ComponentChildren }) {
  return (
    <button class={`chip${props.on ? ' on' : ''}`} aria-pressed={props.on} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function Option(props: { on?: boolean; onClick?: () => void; emoji?: string; children: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <button class={`option${props.on ? ' on' : ''}`} aria-pressed={props.on} onClick={props.onClick}>
      {props.emoji && <span class="emoji">{props.emoji}</span>}
      <span class="grow">
        <span style={{ display: 'block' }}>{props.children}</span>
        {props.sub && <span class="caption" style={{ display: 'block', fontWeight: 500, marginTop: 2 }}>{props.sub}</span>}
      </span>
      <span class="check">
        {props.on && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ── 표시 요소 ──────────────────────────────

export function Progress(props: { value: number; color?: string }) {
  return (
    <div class="progress" role="progressbar" aria-valuenow={Math.round(props.value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(1, props.value)) * 100}%`, background: props.color }} />
    </div>
  );
}

export function Steps(props: { total: number; current: number }) {
  return (
    <div class="steps" aria-label={`${props.current + 1}/${props.total}`}>
      {Array.from({ length: props.total }, (_, i) => (
        <i key={i} class={i <= props.current ? 'on' : ''} />
      ))}
    </div>
  );
}

export const LEVEL_COLORS = ['var(--good)', 'var(--mild)', 'var(--moderate)', 'var(--severe)'];

export function levelLabel(level: number): string {
  return [tr('정상', 'Normal'), tr('경미', 'Mild'), tr('주의', 'Moderate'), tr('심함', 'Severe')][level] ?? '';
}

export function LevelBadge(props: { level: number }) {
  return <span class={`badge lv${props.level}`}>{levelLabel(props.level)}</span>;
}

/** 점수 링 */
export function Ring(props: { value: number; max?: number; size?: number; stroke?: number; color?: string; track?: string; children?: ComponentChildren }) {
  const size = props.size ?? 120;
  const stroke = props.stroke ?? 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, props.value / (props.max ?? 100)));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={props.track ?? 'var(--surface-3)'} stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={props.color ?? 'var(--brand)'}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{props.children}</div>
    </div>
  );
}

export function Notice(props: { kind?: 'warn' | 'danger' | 'info' | 'brand'; icon?: ComponentChildren; children: ComponentChildren; style?: JSX.CSSProperties }) {
  return (
    <div class={`notice ${props.kind ?? ''}`} style={props.style}>
      {props.icon && <span class="ic">{props.icon}</span>}
      <div class="grow">{props.children}</div>
    </div>
  );
}

export function scoreColor(score: number): string {
  if (score >= 85) return 'var(--good)';
  if (score >= 70) return '#7cc242';
  if (score >= 55) return 'var(--mild)';
  if (score >= 40) return 'var(--moderate)';
  return 'var(--severe)';
}
