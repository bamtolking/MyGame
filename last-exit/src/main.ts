import { App } from './ui/app';
const app = new App(document.getElementById('app')!);
(window as any).__app = app;
