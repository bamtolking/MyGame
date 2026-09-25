import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';
import { effect } from '@preact/signals';
import { render } from 'preact';
import { App } from './app';
import { lang } from './i18n';
import { isNative } from './lib/platform';
import { unlockAudio } from './lib/sound';
import { unlockSpeech } from './lib/voice';
import { settings } from './state/store';
import { initNative } from './lib/native';

// 테마
const media = window.matchMedia?.('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = settings.value.theme;
  const dark = t === 'dark' || (t === 'system' && media?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
effect(applyTheme);
media?.addEventListener?.('change', applyTheme);
effect(() => {
  document.documentElement.lang = lang.value;
});

// iOS: 첫 터치에서 소리·음성 엔진 활성화
const unlock = () => {
  unlockAudio();
  unlockSpeech();
  window.removeEventListener('pointerdown', unlock);
};
window.addEventListener('pointerdown', unlock);

render(<App />, document.getElementById('app')!);

initNative();

// 오프라인 지원 (웹 배포용, 네이티브 앱에서는 불필요)
if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw]', e));
  });
}
