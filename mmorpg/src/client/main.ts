import './style.css';
import { App } from './ui/app.ts';
// Canvas text only uses a web font once it is loaded, so request the display fonts up front (no-op offline).
try { for (const f of ['24px "Black Han Sans"', '40px "Nanum Brush Script"', '800 16px "Nanum Myeongjo"']) document.fonts?.load(f).catch(() => {}); } catch { /* fonts API unavailable */ }
new App(document.getElementById('app')!);
