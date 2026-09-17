// WebSocket 클라이언트: 메시지 타입별 핸들러 등록.
export class Net {
  constructor() { this.ws = null; this.handlers = new Map(); this.connected = false; }
  on(type, fn) { this.handlers.set(type, fn); }
  emit(type, msg) { const fn = this.handlers.get(type); if (fn) fn(msg); }
  // base: '' 이면 현재 페이지의 서버, 아니면 'host:port' | 'http(s)://…' | 'ws(s)://…'
  static wsUrl(base) {
    base = (base || '').trim().replace(/\/+$/, '');
    if (!base) {
      if (!/^https?:$/.test(location.protocol)) return null; // 앱(capacitor)이나 file:// 에서는 서버 주소가 필요
      return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    }
    if (/^wss?:\/\//.test(base)) return base.replace(/\/ws$/, '') + '/ws';
    if (/^https?:\/\//.test(base)) return base.replace(/^http/, 'ws') + '/ws';
    return `ws://${base}/ws`;
  }
  connect(base) {
    if (this.connected) return Promise.resolve();
    const url = Net.wsUrl(base);
    if (!url) return Promise.reject(new Error('no-server'));
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url); } catch (err) { reject(err); return; }
      const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('timeout')); }, 8000);
      ws.onopen = () => { clearTimeout(timer); this.ws = ws; this.connected = true; resolve(); };
      ws.onerror = () => { clearTimeout(timer); if (!this.connected) reject(new Error('connect failed')); };
      ws.onclose = () => { const was = this.connected; this.connected = false; this.ws = null; if (was) this.emit('close'); };
      ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg && msg.type) this.emit(msg.type, msg);
      };
    });
  }
  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  close() { if (this.ws) { this.connected = false; const ws = this.ws; this.ws = null; try { ws.close(); } catch {} } }
}
