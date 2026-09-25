import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { lang } from '../i18n';
import { settings } from '../state/store';
import { isNative } from './platform';

let voices: SpeechSynthesisVoice[] = [];
const hasWebSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

function loadVoices() {
  if (!hasWebSpeech) return;
  voices = window.speechSynthesis.getVoices();
}
if (hasWebSpeech) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

function pickVoice(code: string): SpeechSynthesisVoice | undefined {
  const pref = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(code.slice(0, 2)));
  // 자연스러운 음성 우선 (Google/Siri/Yuna/Samantha 등)
  return (
    pref.find((v) => /google|yuna|siri|premium|enhanced|natural/i.test(v.name)) ??
    pref.find((v) => v.lang.toLowerCase().replace('_', '-') === code.toLowerCase()) ??
    pref[0]
  );
}

export function voiceAvailable(): boolean {
  return isNative() || hasWebSpeech;
}

/** 음성 안내. interrupt=true 면 이전 안내를 끊고 바로 말합니다. */
export async function speak(text: string, opts: { interrupt?: boolean; force?: boolean } = {}): Promise<void> {
  if (!text || (!settings.value.voice && !opts.force)) return;
  const code = lang.value === 'ko' ? 'ko-KR' : 'en-US';
  const rate = settings.value.voiceRate;
  if (isNative()) {
    try {
      if (opts.interrupt) await TextToSpeech.stop();
      await TextToSpeech.speak({ text, lang: code, rate, pitch: 1.0, volume: 1.0, category: 'playback' });
    } catch (e) {
      console.warn('[voice] native tts failed', e);
    }
    return;
  }
  if (!hasWebSpeech) return;
  const synth = window.speechSynthesis;
  if (opts.interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  const v = pickVoice(code);
  if (v) u.voice = v;
  u.rate = rate * (lang.value === 'ko' ? 1.05 : 1);
  u.pitch = 1.05;
  synth.speak(u);
}

export function stopSpeaking() {
  if (isNative()) {
    TextToSpeech.stop().catch(() => undefined);
  } else if (hasWebSpeech) {
    window.speechSynthesis.cancel();
  }
}

/** iOS 사파리: 첫 터치 때 음성 엔진을 깨워 둡니다. */
export function unlockSpeech() {
  if (!hasWebSpeech || isNative()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}

/** 숫자 읽기: 한국어는 고유어 수사(하나, 둘…)로 */
export function countWord(n: number): string {
  if (lang.value !== 'ko') return String(n);
  const words = ['영', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열하나', '열둘', '열셋', '열넷', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스물'];
  return words[n] ?? String(n);
}
