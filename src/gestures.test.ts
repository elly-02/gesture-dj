import { describe, it, expect } from 'vitest';
import { isOpenPalm, createHoldDetector, type Point } from './gestures';

function fakeHand(fingersUp: boolean): Point[] {
  const lm: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[17] = { x: 0.6, y: 0.6 };
  lm[3] = { x: 0.45, y: 0.55 };
  lm[4] = { x: 0.4, y: 0.5 };
  [8, 12, 16, 20].forEach((i) => (lm[i] = { x: 0.5, y: fingersUp ? 0.3 : 0.6 }));
  return lm;
}

describe('isOpenPalm', () => {
  it('detects an open palm', () => expect(isOpenPalm(fakeHand(true))).toBe(true));
  it('rejects a fist', () => expect(isOpenPalm(fakeHand(false))).toBe(false));
  it('rejects incomplete landmarks', () => expect(isOpenPalm([])).toBe(false));
});

describe('createHoldDetector', () => {
  it('fires only after the hold time', () => {
    const hold = createHoldDetector(500, 1500);
    expect(hold(true, 0)).toBe(false);
    expect(hold(true, 400)).toBe(false);
    expect(hold(true, 500)).toBe(true);
  });

  it('does not re-fire while the palm stays up', () => {
    const hold = createHoldDetector(500, 1500);
    hold(true, 0);
    hold(true, 500);
    expect(hold(true, 3000)).toBe(false);
  });

  it('fires again after release and cooldown', () => {
    const hold = createHoldDetector(500, 1500);
    hold(true, 0);
    hold(true, 500);
    hold(false, 2100);
    hold(true, 2200);
    expect(hold(true, 2700)).toBe(true);
  });
});