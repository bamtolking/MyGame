import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Net } from '../client/js/net.js';

test('서버 주소 입력을 WebSocket 주소로 변환', () => {
  assert.equal(Net.wsUrl('192.168.0.10:8080'), 'ws://192.168.0.10:8080/ws');
  assert.equal(Net.wsUrl('http://example.com'), 'ws://example.com/ws');
  assert.equal(Net.wsUrl('https://dayhunger.example.app/'), 'wss://dayhunger.example.app/ws');
  assert.equal(Net.wsUrl('wss://x.y/ws'), 'wss://x.y/ws');
  assert.equal(Net.wsUrl('  ws://host:1234  '), 'ws://host:1234/ws');
});
