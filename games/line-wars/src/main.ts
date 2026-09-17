import './style.css';
import { App } from './ui/app.ts';

const root = document.getElementById('app')!;
const app = new App(root);
(window as unknown as { lw: App }).lw = app; // for debugging / automated tests

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.includes('localhost') && location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
