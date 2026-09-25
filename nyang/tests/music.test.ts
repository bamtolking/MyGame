import { describe, it, expect } from 'vitest';
import { SONG, noteToMidi, parseBar } from '../src/platform/music';

// F장조 + 곡에 쓰인 차용음(E♭, C#, F#)만 멜로디에 나와야 한다
const ALLOWED = new Set([5, 7, 9, 10, 0, 2, 4, 3, 1, 6]);

describe('background music score', () => {
  it('parses note names and holds', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('Bb4')).toBe(70);
    expect(parseBar('C5 . A4 C5 E5 - D5 C5')).toEqual([[0, 72, 1], [2, 69, 1], [3, 72, 1], [4, 76, 2], [6, 74, 1], [7, 72, 1]]);
  });

  it('has 16 bars of chords and melody, every bar 8 steps long', () => {
    expect(SONG.chords.length).toBe(16);
    expect(SONG.melody.length).toBe(16);
    for (const bar of SONG.melody) {
      const end = Math.max(...bar.map(([p, , len]) => p + len));
      expect(end).toBeLessThanOrEqual(8);
      for (const [, m] of bar) {
        expect(ALLOWED.has(((m % 12) + 12) % 12)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(64);
        expect(m).toBeLessThanOrEqual(84);
      }
    }
  });

  it('melody notes on strong beats belong to the chord of that half-bar (or are its tensions)', () => {
    let clashes = 0;
    SONG.melody.forEach((bar, i) => {
      for (const [p, m] of bar) {
        if (p % 2) continue;
        const chords = SONG.chords[i];
        const c = chords.length > 1 && p >= 4 ? chords[1] : chords[0];
        const pcs = new Set([c.root % 12, (c.root + c.fifth) % 12, ...c.voicing.map(v => v % 12)]);
        if (!pcs.has(m % 12)) clashes++;
      }
    });
    // 경과음 몇 개는 괜찮다
    expect(clashes).toBeLessThanOrEqual(6);
  });
});
