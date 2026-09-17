import { App } from './ui/app.ts';
const app = new App(document.getElementById('app')!);
(window as unknown as { __app: App }).__app = app;
