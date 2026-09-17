// WebSocket 클라이언트: 메시지 타입별 핸들러 등록.
export class Net {
  constructor() { this.ws = null; this.handlers = new Map(); this.connected = false; }
  on(type, fn) { this.handlers.set(type, fn); }
  emit(type, msg) { const fn = this.handlers.get(type); if (fn) fn(msg); }
  connect() {
    if (this.connected) return Promise.resolve();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
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
