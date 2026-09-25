import './ui/font.css';
import './ui/style.css';
import { App } from './ui/app';

const app = new App(document.getElementById('app')!);
(window as any).__nyang = app;

// 설치형 웹앱: 정적 배포(https)에서만 서비스 워커 등록.
// 단일 파일/아티팩트와 네이티브 앱(Capacitor, 파일이 앱 안에 있음)에서는 건너뛴다.
const w = window as any;
if ('serviceWorker' in navigator && location.protocol === 'https:' && !w.__NYANG_SINGLEFILE__ && !w.Capacitor) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
