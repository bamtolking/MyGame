// 브라우저용 전송 계층: PeerJS(P2P) 호스트/게스트, WebSocket 게스트
import type { Conn } from './protocol.ts';
import { Peer, type DataConnection, type PeerOptions as PeerJsOptions } from 'peerjs';

export const PEER_PREFIX = 'nrd-v1-';

/** "host", "host:port", "host:port/path", "https://host/path" → PeerOptions */
export function parsePeerHost(str: string): PeerOptions | undefined {
  const s = (str || '').trim(); if (!s) return undefined;
  const m = s.match(/^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/[^?#]*)?$/i); if (!m) return undefined;
  const secure = m[1] ? m[1].toLowerCase() === 'https' : true;
  return { host: m[2], port: m[3] ? Number(m[3]) : (secure ? 443 : 80), path: m[4] || '/', secure };
}

export interface PeerOptions { host?: string; port?: number; path?: string; secure?: boolean; key?: string }
export function peerConfig(opts?: PeerOptions): PeerJsOptions {
  const o: PeerJsOptions = { debug: (globalThis as { __peerDebug?: number }).__peerDebug ?? 0 };
  if (opts?.host) { o.host = opts.host; if (opts.port) o.port = opts.port; if (opts.path) o.path = opts.path; if (opts.secure != null) o.secure = opts.secure; if (opts.key) o.key = opts.key; }
  return o;
}


function wrapDataConn(dc: DataConnection): Conn {
  let open = dc.open; let recv: ((m: unknown) => void) | null = null; let closed: (() => void) | null = null; let closedFired = false;
  dc.on('data', (d: unknown) => { let m = d; if (typeof d === 'string') { try { m = JSON.parse(d); } catch { return; } } recv?.(m); });
  dc.on('open', () => { open = true; });
  const onEnd = () => { open = false; if (!closedFired) { closedFired = true; closed?.(); } };
  dc.on('close', onEnd); dc.on('error', onEnd);
  return {
    get open() { return open && dc.open; },
    send(m) { if (dc.open) dc.send(m); },
    onMessage(cb) { recv = cb; },
    onClose(cb) { closed = cb; },
    close() { open = false; try { dc.close(); } catch { /* ignore */ } },
  };
}

/** P2P 호스트: 고정 ID(nrd-v1-코드)로 PeerServer에 등록. 들어오는 연결을 onConn으로 넘김 */
export async function peerHost(code: string, onConn: (c: Conn) => void, opts?: PeerOptions): Promise<{ close: () => void }> {
  const peer = new Peer(PEER_PREFIX + code, peerConfig(opts));
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('P2P 서버 연결 시간 초과')), 15000);
    peer.on('open', () => { clearTimeout(t); res(); });
    peer.on('error', (e: Error & { type?: string }) => { clearTimeout(t); rej(new Error(e.type === 'unavailable-id' ? '같은 코드의 방이 이미 있습니다. 다시 시도하세요.' : `P2P 오류: ${e.type ?? e.message}`)); });
  });
  peer.on('connection', (dc: DataConnection) => {
    const c = wrapDataConn(dc);
    if (dc.open) onConn(c); else dc.on('open', () => onConn(c));
  });
  return { close: () => peer.destroy() };
}

/** P2P 게스트: 코드로 호스트에 연결 */
export async function peerConnect(code: string, opts?: PeerOptions): Promise<Conn> {
  const peer = new Peer(peerConfig(opts));
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('P2P 서버 연결 시간 초과')), 15000);
    peer.on('open', () => { clearTimeout(t); res(); });
    peer.on('error', (e: Error & { type?: string }) => { clearTimeout(t); rej(new Error(`P2P 오류: ${e.type ?? e.message}`)); });
  });
  const dc = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => { rej(new Error('방을 찾지 못했습니다 (코드 확인, 방장이 방을 열어 두었는지 확인)')); peer.destroy(); }, 15000);
    dc.on('open', () => { clearTimeout(t); res(); });
    peer.on('error', (e: Error & { type?: string }) => { clearTimeout(t); peer.destroy(); rej(new Error(e.type === 'peer-unavailable' ? '그 코드의 방이 없습니다' : `연결 오류: ${e.type ?? e.message}`)); });
  });
  const c = wrapDataConn(dc);
  const origClose = c.close; c.close = () => { origClose(); peer.destroy(); };
  dc.on('close', () => peer.destroy());
  return c;
}

/** WebSocket 게스트 (Node 서버용) */
export function wsConnect(url: string): Promise<Conn> {
  return new Promise((res, rej) => {
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch (e) { rej(e); return; }
    let recv: ((m: unknown) => void) | null = null; let closed: (() => void) | null = null; let open = false;
    const t = setTimeout(() => { if (!open) { rej(new Error('서버 연결 시간 초과')); ws.close(); } }, 10000);
    const c: Conn = {
      get open() { return open && ws.readyState === 1; },
      send(m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); },
      onMessage(cb) { recv = cb; }, onClose(cb) { closed = cb; },
      close() { try { ws.close(); } catch { /* ignore */ } },
    };
    ws.onopen = () => { open = true; clearTimeout(t); res(c); };
    ws.onerror = () => { if (!open) { clearTimeout(t); rej(new Error('서버에 연결할 수 없습니다')); } };
    ws.onmessage = ev => { try { recv?.(JSON.parse(String(ev.data))); } catch { /* ignore */ } };
    ws.onclose = () => { open = false; closed?.(); };
  });
}
