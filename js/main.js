'use strict';
window.addEventListener('DOMContentLoaded', () => { Game.init(); });
// PWA: http(s)로 서비스될 때만 서비스 워커 등록 (오프라인 플레이 / 홈 화면 설치)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
