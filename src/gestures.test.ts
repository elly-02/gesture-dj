import { describe, it, expect } from 'vitest';
import {
  isOpenPalm,
  createHoldDetector,
  createSwipeDetector,
  heightToVolume,
  smoothStep,
  toScreenX,
  createVolumeSlider,
  type Point,
  type Zone,
} from './gestures';

function blankHand(): Point[] {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
}

function palmHand(fingersUp: boolean): Point[] {
  const lm = blankHand();
  lm[17] = { x: 0.6, y: 0.6 };
  lm[3] = { x: 0.45, y: 0.55 };
  lm[4] = { x: 0.4, y: 0.5 };
  [8, 12, 16, 20].forEach((i) => (lm[i] = { x: 0.5, y: fingersUp ? 0.3 : 0.6 }));
  return lm;
}

const ZONE: Zone = { xMin: 0.82, xMax: 0.97, yMin: 0.15, yMax: 0.85 };

describe('isOpenPalm', () => {
  it('detects an open palm', () => expect(isOpenPalm(palmHand(true))).toBe(true));
  it('rejects a fist', () => expect(isOpenPalm(palmHand(false))).toBe(false));
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

describe('createSwipeDetector', () => {
  it('maps decreasing x to a right swipe (mirrored video)', () => {
    const swipe = createSwipeDetector();
    swipe(0.7, 0);
    swipe(0.55, 100);
    expect(swipe(0.35, 200)).toBe('right');
  });

  it('maps increasing x to a left swipe', () => {
    const swipe = createSwipeDetector();
    swipe(0.3, 0);
    expect(swipe(0.65, 200)).toBe('left');
  });

  it('ignores slow movement outside the time window', () => {
    const swipe = createSwipeDetector();
    swipe(0.6, 0);
    swipe(0.5, 300);
    expect(swipe(0.4, 600)).toBeNull();
  });

  it('respects the cooldown', () => {
    const swipe = createSwipeDetector();
    swipe(0.7, 0);
    swipe(0.35, 200);
    swipe(0.35, 300);
    expect(swipe(0.7, 400)).toBeNull();
  });

  it('resets when the hand is lost', () => {
    const swipe = createSwipeDetector();
    swipe(0.7, 0);
    swipe(null, 50);
    expect(swipe(0.35, 100)).toBeNull();
  });
});

describe('heightToVolume', () => {
  it('maps top to 100% and bottom to 0%', () => {
    expect(heightToVolume(0.2)).toBeCloseTo(1);
    expect(heightToVolume(0.8)).toBeCloseTo(0);
    expect(heightToVolume(0.5)).toBeCloseTo(0.5);
  });

  it('clamps outside the range', () => {
    expect(heightToVolume(0)).toBe(1);
    expect(heightToVolume(1)).toBe(0);
  });
});

describe('smoothStep', () => {
  it('moves part of the way toward the target', () => {
    expect(smoothStep(0, 1, 0.3)).toBeCloseTo(0.3);
  });
});

describe('toScreenX', () => {
  it('mirrors raw camera x to screen x', () => {
    expect(toScreenX(0.1)).toBeCloseTo(0.9);
  });
});

describe('createVolumeSlider', () => {
  it('stays idle without a hand', () => {
    expect(createVolumeSlider(ZONE)(null, 0).state).toBe('idle');
  });

  it('ignores a fingertip outside the zone', () => {
    expect(createVolumeSlider(ZONE)({ x: 0.5, y: 0.5 }, 0).state).toBe('idle');
  });

  it('hovers first, then grabs after the dwell time', () => {
    const slider = createVolumeSlider(ZONE, 300);
    expect(slider({ x: 0.1, y: 0.5 }, 0)).toEqual({ state: 'hovering', volume: null });
    const grabbed = slider({ x: 0.1, y: 0.5 }, 300);
    expect(grabbed.state).toBe('grabbed');
    expect(grabbed.volume).toBeCloseTo(0.5);
  });

  it('keeps the grab inside the margin, but not before grabbing', () => {
    const slider = createVolumeSlider(ZONE, 300, 0.05);
    slider({ x: 0.1, y: 0.5 }, 0);
    slider({ x: 0.1, y: 0.5 }, 300);
    expect(slider({ x: 0.2, y: 0.5 }, 350).state).toBe('grabbed');
    expect(createVolumeSlider(ZONE)({ x: 0.2, y: 0.5 }, 0).state).toBe('idle');
  });

  it('releases when the hand is lost', () => {
    const slider = createVolumeSlider(ZONE, 300);
    slider({ x: 0.1, y: 0.5 }, 0);
    slider({ x: 0.1, y: 0.5 }, 300);
    expect(slider(null, 350).state).toBe('idle');
  });
});