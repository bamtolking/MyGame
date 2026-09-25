import './ui/font.css';
import './ui/style.css';
import { App } from './ui/app';

const app = new App(document.getElementById('app')!);
(window as any).__nyang = app;

// 설치형 웹앱: 정적 배포(https)에서만 서비스 워커 등록. 단일 파일/미리보기에서는 건너뛴다.
if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window as any).__NYANG_SINGLEFILE__) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
