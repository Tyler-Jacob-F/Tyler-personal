import { translations } from '@the-keep/shared';
import {
  JITTER_DEGREES,
  labelPlacement,
  landingRotation,
  MAX_TURNS,
  MIN_TURNS,
  WEDGE_DEGREES,
  WEDGE_LABELS,
  WEDGES,
  wedgeAt,
  wedgeCentre,
  wedgePath,
  WHEEL_LINES,
} from '@/lib/wheel';

/** A random that walks a fixed list, so a landing can be checked by hand. */
const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('the wheel', () => {
  it('has a wedge, a label and a line for every translation', () => {
    expect(WEDGES).toEqual(translations);
    expect(WEDGE_DEGREES).toBe(36);
    for (const code of translations) {
      expect(WEDGE_LABELS[code].length).toBeGreaterThan(0);
      expect(WHEEL_LINES[code].length).toBeGreaterThan(0);
    }
  });

  it('lands the chosen wedge under the pointer from any starting rotation, always turning forward', () => {
    const randoms = [sequence([0, 0.5]), sequence([0.99, 0]), sequence([0.5, 0.999]), Math.random];
    for (const target of translations) {
      for (const current of [0, 123, 1800, 2000.5, 5431]) {
        for (const random of randoms) {
          const landing = landingRotation(target, current, random);
          expect(wedgeAt(landing), `${target} from ${current}`).toBe(target);
          expect(landing - current).toBeGreaterThanOrEqual(MIN_TURNS * 360);
          expect(landing - current).toBeLessThan((MAX_TURNS + 1) * 360 + WEDGE_DEGREES);
        }
      }
    }
  });

  it('lands a little off centre, never past the wedge’s edge', () => {
    const centred = landingRotation('kjv', 0, sequence([0, 0.5]));
    expect(centred % 360).toBeCloseTo((360 - wedgeCentre(0)) % 360, 5);
    const high = landingRotation('kjv', 0, sequence([0, 1]));
    expect(Math.abs((((high - centred) % 360) + 360) % 360)).toBeCloseTo(JITTER_DEGREES, 5);
    expect(JITTER_DEGREES).toBeLessThan(WEDGE_DEGREES / 2);
  });

  it('reads which wedge is under the pointer', () => {
    expect(wedgeAt(0)).toBe('kjv');
    expect(wedgeAt(-wedgeCentre(3))).toBe(translations[3]);
    expect(wedgeAt(360 - wedgeCentre(9))).toBe(translations[9]);
    expect(wedgeAt(720 + 360 - wedgeCentre(5))).toBe(translations[5]);
  });

  it('draws wedges and labels with finite numbers', () => {
    for (let i = 0; i < WEDGES.length; i++) {
      const path = wedgePath(i, 100, 97);
      expect(path).toMatch(/^M 100 100 L .+ A 97 97 0 0 1 .+ Z$/);
      expect(path).not.toMatch(/NaN/);
      const { x, y, rotate } = labelPlacement(i, 100, 68);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(rotate).toBe(wedgeCentre(i));
    }
    // The first wedge starts straight up from the hub.
    expect(wedgePath(0, 100, 97).startsWith('M 100 100 L 100 3 ')).toBe(true);
  });
});
