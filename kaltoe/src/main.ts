import './style.css';
import { App } from './ui/app';

const root = document.getElementById('app')!;
const app = new App(root);
(window as unknown as { __app: App }).__app = app;

// 설치형 웹앱: http(s)로 배포된 빌드에서만 서비스워커 등록(단일 파일/임베드에서는 건너뜀)
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV && document.querySelector('link[rel="manifest"]')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 무시 */ });
}
