// Client-side logic that runs without a browser: synthesized audio (every sample the game can request) and hit reactions.
import { describe, it, expect } from 'vitest';
import { renderKey, hasKey } from '../src/client/audio/render.ts';
import { SFX } from '../src/client/audio/sfx.ts';
import { DRUMS } from '../src/client/audio/kit.ts';
import { SONGS, ZONE_SONG } from '../src/client/audio/music.ts';
import { SR, type Sample } from '../src/client/audio/synth.ts';
import { Anim } from '../src/client/render/anim.ts';
import { hexCol } from '../src/client/render/fx.ts';

function stats(s: Sample) {
  let peak = 0, bad = 0, sum = 0;
  for (const ch of [s.l, s.r]) for (let i = 0; i < ch.length; i++) { const v = ch[i]; if (!Number.isFinite(v)) bad++; else { peak = Math.max(peak, Math.abs(v)); sum += v * v; } }
  return { peak, bad, rms: Math.sqrt(sum / (s.l.length * 2)), sec: s.l.length / SR };
}

describe('synthesized audio', () => {
  it('every sound effect renders finite, audible, unclipped stereo audio', () => {
    const names = Object.keys(SFX); expect(names.length).toBeGreaterThanOrEqual(40);
    for (const k of names) {
      const s = renderKey('sfx:' + k), st = stats(s);
      expect(s.l.length, k).toBe(s.r.length); expect(st.bad, k).toBe(0);
      expect(st.peak, k).toBeGreaterThan(0.05); expect(st.peak, k).toBeLessThanOrEqual(1.0001);
      expect(st.sec, k).toBeGreaterThan(0.02); expect(st.sec, k).toBeLessThan(8);
    }
  });
  it('drum kit, gayageum and geomungo notes cover what the songs play', () => {
    for (const k of Object.keys(DRUMS)) { const st = stats(renderKey('drum:' + k)); expect(st.bad, k).toBe(0); expect(st.peak, k).toBeGreaterThan(0.02); expect(st.peak, k).toBeLessThanOrEqual(1.0001); }
    for (const song of Object.values(SONGS)) {
      for (const [, name] of [...song.perc, ...song.drums, ...song.fill, ...song.extra]) expect(DRUMS[name], `${song.key}: ${name}`).toBeDefined();
      for (const ch of song.prog) { const midi = song.root + 12 * Math.floor(ch / 5) + song.scale[ch % 5]; const st = stats(renderKey('gay:' + (midi + 12))); expect(st.bad).toBe(0); expect(st.peak).toBeGreaterThan(0.02); }
    }
    const geo = stats(renderKey('geo:38')); expect(geo.bad).toBe(0); expect(geo.peak).toBeGreaterThan(0.02);
  });
  it('every zone has a song in a pentatonic mode and the reverb impulse decays', () => {
    for (const z of ZONE_SONG) { const s = SONGS[z]; expect(s, z).toBeDefined(); expect(s.scale).toHaveLength(5); expect(s.bpm).toBeGreaterThan(40); expect(s.bpm).toBeLessThan(160); for (const c of s.prog) expect(c).toBeGreaterThanOrEqual(0); }
    const ir = renderKey('ir:'); const n = ir.l.length; let head = 0, tail = 0;
    for (let i = 0; i < n / 10; i++) head += ir.l[i] ** 2; for (let i = n - Math.floor(n / 10); i < n; i++) tail += ir.l[i] ** 2;
    expect(tail).toBeLessThan(head * 0.01);
    expect(hasKey('sfx:slash') && hasKey('drum:jing') && !hasKey('sfx:nope')).toBe(true);
  });
});

describe('hit reactions', () => {
  it('knock-back springs away from the hit and settles back', () => {
    const a = new Anim(); a.hit('m', 7, 1, 0, 200); let peak = 0;
    for (let i = 0; i < 90; i++) { a.update(1 / 60); peak = Math.max(peak, a.peek('m', 7)!.ox); }
    const r = a.peek('m', 7)!; expect(peak).toBeGreaterThan(4); expect(peak).toBeLessThanOrEqual(22); expect(Math.abs(r.ox)).toBeLessThan(0.5); expect(r.flash).toBe(0); expect(r.squash).toBe(0);
  });
  it('attack poses run wind-up → strike → follow-through, then release', () => {
    const a = new Anim(); a.attack(3, 0.3); const seen: (string | null)[] = [];
    for (let i = 0; i < 24; i++) { const f = Anim.atkFrame(a.peek('p', 3)); if (seen[seen.length - 1] !== f) seen.push(f); a.update(1 / 60); }
    expect(seen).toEqual(['atk0', 'atk1', 'atk2', null]);
  });
  it('reads colours written as hex or css rgb', () => {
    expect(hexCol('#5fb4ff')).toBe(0x5fb4ff); expect(hexCol('#fff')).toBe(0xffffff); expect(hexCol('rgb(160, 200, 255)')).toBe(0xa0c8ff);
  });
});
