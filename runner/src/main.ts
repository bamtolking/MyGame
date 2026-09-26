import './style.css';
import './menus.css';
import { App } from './ui/app';
import { registerPwa, iconDataUrl } from './platform/pwa';
const app = new App(document.getElementById('app')!);
(window as any).__app = app;
(window as any).__icon = iconDataUrl;
registerPwa();
