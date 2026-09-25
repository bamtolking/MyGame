import { useEffect, useRef, useState } from 'preact/hooks';
import { Camera, Check, Images, Lock, RefreshCcw, SwitchCamera, X } from 'lucide-preact';
import { checkFrame, medianFrame, motionBetween, type FrameProblem } from '../analysis/analyze';
import type { View } from '../analysis/norms';
import { Meerkat } from '../components/animals';
import { Notice, Steps, toast, TopBar } from '../components/ui';
import { tr } from '../i18n';
import { haptic } from '../lib/haptics';
import { back, replace } from '../lib/router';
import { sfx } from '../lib/sound';
import { speak, stopSpeaking } from '../lib/voice';
import { CameraError, fileToCanvas, snapshot, startCamera, stopCamera, type Facing } from '../pose/camera';
import { BODY_CONNECTIONS, type PoseFrame } from '../pose/landmarks';
import { detectOnCanvas, finalizeScan, viewOf, type Shot } from '../scan/pipeline';
import { profile } from '../state/store';

type Stage = 'setup' | 'camera' | 'upload' | 'analyzing';

const PROBLEM_TEXT: Record<FrameProblem, () => string> = {
  noPerson: () => tr('화면 안으로 들어와 주세요', 'Step into the frame'),
  lowLight: () => tr('조금 더 밝은 곳에서 촬영해 주세요', 'Find a brighter spot'),
  feetCut: () => tr('발끝까지 보이게 한두 걸음 뒤로 가 주세요', 'Step back so your feet are visible'),
  headCut: () => tr('머리가 잘렸어요. 조금 뒤로 가 주세요', 'Your head is cut off — step back a little'),
  tooClose: () => tr('조금만 뒤로 가 주세요', 'Step back a little'),
  tooFar: () => tr('한 걸음 앞으로 와 주세요', 'Step a little closer'),
  offCenter: () => tr('화면 가운데로 와 주세요', 'Move to the centre'),
  turnFront: () => tr('휴대폰을 정면으로 바라봐 주세요', 'Face the phone'),
  turnSide: () => tr('옆으로 돌아서 옆모습을 보여 주세요', 'Turn sideways to the phone'),
  backTurned: () => tr('뒤돌아 있어요. 휴대폰을 바라봐 주세요', 'You’re facing away — turn toward the phone'),
};

function Setup({ onCamera, onUpload }: { onCamera: () => void; onUpload: () => void }) {
  const [h, setH] = useState<string>(profile.value.heightCm ? String(profile.value.heightCm) : '');
  const saveHeight = (v: string) => {
    setH(v);
    const n = +v;
    if (n >= 120 && n <= 220) profile.value = { ...profile.value, heightCm: n };
  };
  const tips = [
    ['👕', tr('몸에 붙는 옷', 'Fitted clothes'), tr('레깅스·반팔이면 더 정확해요', 'Leggings & a tee work best')],
    ['📱', tr('허리 높이에 세우기', 'Phone at waist height'), tr('벽·책장에 기대 세우고 2~3m 뒤로', 'Lean it on a wall or shelf, step back 2–3 m')],
    ['💇', tr('머리는 묶기', 'Tie your hair'), tr('목·등 라인이 보여야 해요', 'So your neck and back line are visible')],
    ['🧍', tr('평소처럼 편하게 서기', 'Stand naturally'), tr('일부러 곧게 서면 결과가 달라져요', 'Don’t “pose” — stand as you usually do')],
  ];
  return (
    <div class="screen">
      <TopBar title={tr('AI 체형 스캔', 'AI posture scan')} close />
      <div class="center" style={{ marginTop: 4 }}>
        <div class="bob" style={{ display: 'inline-block' }}>
          <Meerkat size={120} />
        </div>
        <h1 class="h1" style={{ marginTop: 6 }}>
          {tr('정면 한 장, 옆모습 한 장', 'One front, one side photo')}
        </h1>
        <p class="body" style={{ marginTop: 6 }}>
          {tr('음성 안내에 맞춰 서 있기만 하면 자동으로 찍혀요', 'Just follow the voice — photos are taken automatically')}
        </p>
      </div>
      <div class="card" style={{ marginTop: 20 }}>
        <div class="stack">
          {tips.map(([e, t, s]) => (
            <div class="row" key={t} style={{ gap: 12 }}>
              <span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{e}</span>
              <div class="grow">
                <div class="h3">{t}</div>
                <div class="caption">{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div class="field" style={{ marginTop: 16 }}>
        <label for="h">{tr('키 (cm 단위 측정용, 선택)', 'Height (for cm values, optional)')}</label>
        <div class="input-unit">
          <input id="h" class="input" type="number" inputMode="numeric" placeholder="168" value={h} onInput={(e) => saveHeight((e.target as HTMLInputElement).value)} />
          <span>cm</span>
        </div>
      </div>
      <div class="row caption" style={{ justifyContent: 'center', marginTop: 16 }}>
        <Lock size={14} /> {tr('사진은 기기 안에서만 분석되고 어디에도 전송되지 않아요', 'Photos are analysed on-device and never uploaded')}
      </div>
      <div class="bottom-cta">
        <button class="btn primary block" onClick={onCamera}>
          <Camera size={20} /> {tr('카메라로 촬영 (음성 안내)', 'Use camera (voice guided)')}
        </button>
        <button class="btn secondary block" onClick={onUpload}>
          <Images size={20} /> {tr('앨범에서 사진 불러오기', 'Choose photos')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 카메라 촬영
// ─────────────────────────────────────────────

function CameraCapture({ onDone, onUpload }: { onDone: (s: { front?: Shot; side?: Shot }) => void; onUpload: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facing, setFacing] = useState<Facing>('user');
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<{ text: string; ok: boolean }>({ text: tr('카메라를 켜는 중…', 'Starting camera…'), ok: false });
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const shots = useRef<{ front?: Shot; side?: Shot }>({});
  const stepRef = useRef(0);
  stepRef.current = step;
  const busy = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    let raf = 0;
    const video = videoRef.current!;
    const cv = canvasRef.current!;
    const g = cv.getContext('2d')!;
    let goodSince: number | null = null;
    let cdStart: number | null = null;
    let lastSpoken = '';
    let lastSpokeAt = 0;
    let lastSaid = -1;
    let prev: PoseFrame | null = null;
    const recent: PoseFrame[] = [];

    const say = (text: string, force = false) => {
      const now = performance.now();
      if (!force && (text === lastSpoken ? now - lastSpokeAt < 6000 : now - lastSpokeAt < 2200)) return;
      lastSpoken = text;
      lastSpokeAt = now;
      speak(text, { interrupt: true });
    };

    const draw = (f: PoseFrame | null, ok: boolean, mirror: boolean) => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(rect.width * dpr)) {
        cv.width = Math.round(rect.width * dpr);
        cv.height = Math.round(rect.height * dpr);
      }
      g.clearRect(0, 0, cv.width, cv.height);
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw) return;
      const s = Math.min(cv.width / vw, cv.height / vh);
      const ox = (cv.width - vw * s) / 2, oy = (cv.height - vh * s) / 2;
      const X = (x: number) => ox + (mirror ? vw - x : x) * s;
      const Y = (y: number) => oy + y * s;
      // 가이드 틀
      g.setLineDash([10 * dpr, 8 * dpr]);
      g.lineWidth = 2.5 * dpr;
      g.strokeStyle = ok ? 'rgba(18,183,106,0.9)' : 'rgba(255,255,255,0.55)';
      const gx0 = X(mirror ? vw * 0.8 : vw * 0.2), gx1 = X(mirror ? vw * 0.2 : vw * 0.8);
      g.beginPath();
      g.roundRect(Math.min(gx0, gx1), Y(vh * 0.05), Math.abs(gx1 - gx0), vh * 0.92 * s, 24 * dpr);
      g.stroke();
      g.setLineDash([]);
      if (!f) return;
      g.lineCap = 'round';
      g.lineWidth = 5 * dpr;
      g.strokeStyle = ok ? '#12b76a' : '#ffffff';
      for (const [a, b] of BODY_CONNECTIONS) {
        const pa = f.pts[a], pb = f.pts[b];
        if (pa.v < 0.3 || pb.v < 0.3) continue;
        g.beginPath();
        g.moveTo(X(pa.x), Y(pa.y));
        g.lineTo(X(pb.x), Y(pb.y));
        g.stroke();
      }
      g.fillStyle = ok ? '#12b76a' : '#ff6b2c';
      for (const i of [0, 7, 8, 11, 12, 23, 24, 25, 26, 27, 28]) {
        const p = f.pts[i];
        if (p.v < 0.3) continue;
        g.beginPath();
        g.arc(X(p.x), Y(p.y), 5 * dpr, 0, Math.PI * 2);
        g.fill();
      }
    };

    const capture = async (manual = false) => {
      if (busy.current) return;
      busy.current = true;
      const want: View = stepRef.current === 0 ? 'front' : 'side';
      sfx.shutter();
      haptic.medium();
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      const canvas = snapshot(video, 1280);
      const k = canvas.width / video.videoWidth;
      let frame = await detectOnCanvas(canvas).catch(() => null);
      if (!frame || viewOf(frame) !== want) {
        const m = medianFrame(recent.slice(-10));
        if (m) frame = { w: canvas.width, h: canvas.height, pts: m.pts.map((p) => ({ ...p, x: p.x * k, y: p.y * k, z: p.z * k })) };
      }
      if (!frame || (manual && viewOf(frame) === 'none')) {
        toast(tr('사람을 찾지 못했어요. 다시 시도해 주세요', 'No person found — try again'));
        busy.current = false;
        return;
      }
      shots.current[want] = { canvas, frame };
      recent.length = 0;
      goodSince = null;
      cdStart = null;
      setCount(null);
      if (want === 'front') {
        setStep(1);
        say(tr('좋아요! 이제 옆으로 돌아서 옆모습을 보여 주세요. 팔은 편하게 내려 주세요', 'Great! Now turn sideways, arms relaxed'), true);
        setTimeout(() => (busy.current = false), 1800);
      } else {
        say(tr('촬영 완료! 분석을 시작할게요', 'All done! Analysing now'), true);
        alive = false;
        onDone(shots.current);
      }
    };
    (window as any).__meerkatCapture = () => capture(true);

    const loop = async () => {
      const { videoTracker } = await import('../pose/engine');
      let tracker: Awaited<ReturnType<typeof videoTracker>>;
      try {
        tracker = await videoTracker({ model: 'lite' });
      } catch (e) {
        console.error(e);
        setError(tr('AI 모델을 불러오지 못했어요. 사진 불러오기를 이용해 주세요.', 'Couldn’t load the AI model. Please use photo upload.'));
        return;
      }
      if (!alive) return;
      setLoading(false);
      say(tr('휴대폰에서 두세 걸음 떨어져 정면을 보고 서 주세요', 'Stand two or three steps back, facing the phone'), true);
      const tick = () => {
        if (!alive) return;
        const now = performance.now();
        const want: View = stepRef.current === 0 ? 'front' : 'side';
        const f = busy.current ? null : tracker.detect(video, now);
        const mirror = facing === 'user';
        if (!busy.current) {
          const check = checkFrame(f, want);
          let ok = check.ok;
          if (ok && f && prev && motionBetween(prev, f) > 1.6) ok = false;
          prev = f;
          if (!ok) {
            goodSince = null;
            if (cdStart !== null) {
              cdStart = null;
              setCount(null);
            }
            const text = check.ok ? tr('움직이지 말고 그대로 멈춰 주세요', 'Hold still') : PROBLEM_TEXT[check.problems[0]]();
            setStatus({ text, ok: false });
            say(text);
          } else if (f) {
            recent.push(f);
            if (recent.length > 20) recent.shift();
            if (goodSince === null) goodSince = now;
            if (cdStart === null && now - goodSince > 700) {
              cdStart = now;
              lastSaid = -1;
              setStatus({ text: tr('좋아요! 그대로 멈춰 주세요', 'Perfect! Hold still'), ok: true });
              say(tr('좋아요, 그대로', 'Perfect, hold still'), true);
            }
            if (cdStart !== null) {
              const left = 3 - Math.floor((now - cdStart) / 1000);
              if (left !== lastSaid && left > 0) {
                lastSaid = left;
                setCount(left);
                sfx.tick();
              }
              if (now - cdStart >= 3000) capture();
            }
          }
          draw(f, ok, mirror);
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    (async () => {
      try {
        stream = await startCamera(video, facing);
        if (!alive) return stopCamera(stream);
        loop();
      } catch (e) {
        const kind = e instanceof CameraError ? e.kind : 'unknown';
        setError(
          kind === 'denied'
            ? tr('카메라 권한이 필요해요. 설정에서 카메라 접근을 허용하거나, 사진 불러오기를 이용해 주세요.', 'Camera permission is needed. Allow camera access in settings, or choose photos instead.')
            : kind === 'insecure'
              ? tr('보안 연결(https)에서만 카메라를 쓸 수 있어요. 사진 불러오기를 이용해 주세요.', 'The camera needs a secure (https) connection. Please choose photos instead.')
              : tr('카메라를 찾지 못했어요. 사진 불러오기를 이용해 주세요.', 'No camera found. Please choose photos instead.'),
        );
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stopCamera(stream);
      stopSpeaking();
      delete (window as any).__meerkatCapture;
    };
  }, [facing]);

  const viewName = step === 0 ? tr('정면', 'Front') : tr('옆모습', 'Side');
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <div class="row between" style={{ padding: 'calc(var(--safe-top) + 8px) 12px 8px' }}>
        <button class="icon-btn" style={{ color: '#fff' }} aria-label={tr('닫기', 'Close')} onClick={() => back('/scan')}>
          <X size={26} />
        </button>
        <div class="center" style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            {step + 1}/2 · {viewName}
          </div>
          <div style={{ width: 120, margin: '6px auto 0' }}>
            <Steps total={2} current={step} />
          </div>
        </div>
        <button class="icon-btn" style={{ color: '#fff' }} aria-label={tr('카메라 전환', 'Flip camera')} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          <SwitchCamera size={24} />
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.8 }} />}
        {count !== null && (
          <div class="pop-in" key={count} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 140, fontWeight: 900, textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}>
            {count}
          </div>
        )}
        {loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.55)' }}>
            <div class="center">
              <div class="spin" style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.25)', borderTopColor: '#ff6b2c', borderRadius: '50%', margin: '0 auto' }} />
              <div style={{ marginTop: 14, fontWeight: 700 }}>{tr('AI 준비 중…', 'Preparing AI…')}</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>{tr('처음 한 번은 몇 초 걸려요', 'The first time takes a few seconds')}</div>
            </div>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(0,0,0,0.8)' }}>
            <div class="center">
              <p style={{ fontSize: 16, lineHeight: 1.6 }}>{error}</p>
              <button class="btn primary" style={{ marginTop: 16 }} onClick={onUpload}>
                <Images size={20} /> {tr('사진 불러오기', 'Choose photos')}
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 20px calc(var(--safe-bottom) + 16px)' }}>
        <div class="row" style={{ justifyContent: 'center', gap: 8, fontSize: 19, fontWeight: 800, minHeight: 56, textAlign: 'center' }} aria-live="polite">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: status.ok ? '#12b76a' : '#ff6b2c', flex: 'none' }} />
          {status.text}
        </div>
        <div class="row between" style={{ marginTop: 10 }}>
          <button class="btn sm" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }} onClick={onUpload}>
            <Images size={16} /> {tr('사진으로', 'Photos')}
          </button>
          <button
            aria-label={tr('직접 촬영', 'Take photo now')}
            onClick={() => (window as any).__meerkatCapture?.()}
            style={{ width: 68, height: 68, borderRadius: 34, border: '5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.2)' }}
          />
          <div style={{ width: 96, fontSize: 12, opacity: 0.7, textAlign: 'right' }}>{tr('친구가 찍어 줄 땐 버튼을 눌러요', 'Friend shooting? Tap the button')}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 사진 불러오기
// ─────────────────────────────────────────────

interface Slot {
  url: string;
  shot: Shot | null;
  state: 'busy' | 'ok' | 'none' | 'wrong';
}

function Upload({ onDone }: { onDone: (s: { front?: Shot; side?: Shot }) => void }) {
  const [slots, setSlots] = useState<{ front?: Slot; side?: Slot }>({});
  const pickRef = useRef<HTMLInputElement>(null);
  const target = useRef<'front' | 'side' | 'auto'>('auto');

  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, 2)) {
      const canvas = await fileToCanvas(file);
      const url = canvas.toDataURL('image/jpeg', 0.7);
      const provisional: 'front' | 'side' = target.current === 'auto' ? (slots.front ? 'side' : 'front') : target.current;
      setSlots((s) => ({ ...s, [provisional]: { url, shot: null, state: 'busy' } }));
      const frame = await detectOnCanvas(canvas).catch(() => null);
      const v = viewOf(frame);
      let slot: 'front' | 'side' = provisional;
      if (target.current === 'auto' && (v === 'front' || v === 'side')) slot = v;
      const state: Slot['state'] = !frame || v === 'none' ? 'none' : v === slot ? 'ok' : 'wrong';
      setSlots((s) => {
        const next = { ...s };
        if (slot !== provisional) delete next[provisional];
        next[slot] = { url, shot: frame ? { canvas, frame } : null, state };
        return next;
      });
    }
    target.current = 'auto';
  };
  const pick = (t: 'front' | 'side' | 'auto') => {
    target.current = t;
    pickRef.current!.value = '';
    pickRef.current!.multiple = t === 'auto';
    pickRef.current!.click();
  };
  const ready = (['front', 'side'] as const).filter((k) => slots[k]?.state === 'ok');
  const label = (k: 'front' | 'side') => (k === 'front' ? tr('정면', 'Front') : tr('옆모습', 'Side'));
  const stateText = (s: Slot) =>
    s.state === 'busy'
      ? tr('분석 중…', 'Checking…')
      : s.state === 'ok'
        ? tr('인식 완료', 'Detected')
        : s.state === 'wrong'
          ? tr('방향이 달라요', 'Wrong angle')
          : tr('사람을 찾지 못했어요', 'No person found');

  return (
    <div class="screen">
      <TopBar title={tr('사진 불러오기', 'Choose photos')} />
      <p class="body" style={{ marginTop: 4 }}>
        {tr('머리부터 발끝까지 나온 정면·옆모습 사진을 골라 주세요. 한 장만 있어도 분석할 수 있어요.', 'Pick a full-body front and side photo. One photo also works.')}
      </p>
      <div class="grid-2" style={{ marginTop: 16 }}>
        {(['front', 'side'] as const).map((k) => {
          const s = slots[k];
          return (
            <button key={k} class="card tap" style={{ padding: 0, overflow: 'hidden', aspectRatio: '3 / 4', position: 'relative' }} onClick={() => pick(k)}>
              {s ? (
                <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-3)' }}>
                  <div class="center">
                    <Images size={30} />
                    <div class="h3" style={{ marginTop: 6, color: 'var(--text-2)' }}>
                      {label(k)}
                    </div>
                    <div class="micro">{tr('탭해서 선택', 'Tap to choose')}</div>
                  </div>
                </div>
              )}
              {s && (
                <span class={`badge ${s.state === 'ok' ? 'lv0' : s.state === 'busy' ? '' : 'lv3'}`} style={{ position: 'absolute', left: 8, top: 8 }}>
                  {s.state === 'ok' && <Check size={13} />} {label(k)} · {stateText(s)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Notice kind="info" style={{ marginTop: 16 }}>
        {tr('셀카(좌우 반전) 사진은 왼쪽·오른쪽이 바뀌어 보일 수 있어요. 가능하면 다른 사람이 찍어 준 사진을 써 주세요.', 'Mirrored selfies can swap left and right. Photos taken by someone else work best.')}
      </Notice>
      <input ref={pickRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handle((e.target as HTMLInputElement).files)} />
      <div class="bottom-cta">
        <button class="btn primary block" disabled={!ready.length} onClick={() => onDone({ front: slots.front?.state === 'ok' ? slots.front.shot! : undefined, side: slots.side?.state === 'ok' ? slots.side.shot! : undefined })}>
          {ready.length === 2 ? tr('분석하기', 'Analyse') : ready.length === 1 ? tr('한 장으로 분석하기', 'Analyse one photo') : tr('사진을 골라 주세요', 'Choose photos')}
        </button>
        <button class="btn ghost block" onClick={() => pick('auto')}>
          <RefreshCcw size={18} /> {tr('두 장 한 번에 고르기', 'Pick both at once')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 분석 중 연출
// ─────────────────────────────────────────────

function Analyzing({ shots }: { shots: { front?: Shot; side?: Shot } }) {
  const [i, setI] = useState(0);
  const lines = [
    tr('관절 33개를 찾고 있어요', 'Finding 33 body landmarks'),
    tr('귀·어깨·골반 정렬을 재는 중', 'Measuring ear–shoulder–hip alignment'),
    tr('등·허리 곡선을 그리는 중', 'Tracing your back curve'),
    tr('나의 체형 동물을 찾는 중', 'Finding your posture animal'),
  ];
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(lines.length - 1, x + 1)), 750);
    return () => clearInterval(t);
  }, []);
  const img = shots.side?.canvas ?? shots.front?.canvas;
  return (
    <div class="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 200, height: 280, borderRadius: 28, overflow: 'hidden', background: '#111', boxShadow: 'var(--shadow-2)' }}>
        {img && <img src={img.toDataURL('image/jpeg', 0.6)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />}
        <div class="scanline" />
      </div>
      <h1 class="h2" style={{ marginTop: 28 }} aria-live="polite">
        {lines[i]}
      </h1>
      <p class="caption" style={{ marginTop: 8 }}>
        {tr('사진은 기기 안에서만 분석돼요', 'Analysed on your device only')}
      </p>
    </div>
  );
}

export function Capture() {
  const [stage, setStage] = useState<Stage>('setup');
  const [shots, setShots] = useState<{ front?: Shot; side?: Shot }>({});
  const run = async (s: { front?: Shot; side?: Shot }) => {
    setShots(s);
    setStage('analyzing');
    const t0 = performance.now();
    try {
      const rec = await finalizeScan(s);
      const wait = Math.max(0, 3000 - (performance.now() - t0));
      setTimeout(() => {
        sfx.done();
        haptic.success();
        replace(`/scan/result/${rec.id}?reveal=1`);
      }, wait);
    } catch (e) {
      console.error(e);
      toast(tr('분석 중 문제가 생겼어요. 다시 시도해 주세요', 'Something went wrong. Please try again'));
      setStage('setup');
    }
  };
  if (stage === 'camera') return <CameraCapture onDone={run} onUpload={() => setStage('upload')} />;
  if (stage === 'upload') return <Upload onDone={run} />;
  if (stage === 'analyzing') return <Analyzing shots={shots} />;
  return <Setup onCamera={() => setStage('camera')} onUpload={() => setStage('upload')} />;
}
