export type Point = { x: number; y: number; z?: number };
export type SwipeDirection = 'left' | 'right';
export type Zone = { xMin: number; xMax: number; yMin: number; yMax: number };
export type SliderState = 'idle' | 'hovering' | 'grabbed';

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

/** Landmark x is raw camera space; the video is shown mirrored. */
export const toScreenX = (rawX: number) => 1 - rawX;

export function isOpenPalm(lm: Point[]): boolean {
  if (lm.length < 21) return false;
  const fingersUp = TIPS.every((tip, i) => lm[tip].y < lm[PIPS[i]].y);
  const thumbOut = Math.abs(lm[4].x - lm[17].x) > Math.abs(lm[3].x - lm[17].x);
  return fingersUp && thumbOut;
}

export function createHoldDetector(holdMs = 500, cooldownMs = 1500) {
  let since: number | null = null;
  let lastFired = -Infinity;
  let armed = true;

  return (active: boolean, now: number): boolean => {
    if (!active) {
      since = null;
      armed = true;
      return false;
    }
    if (!armed) return false;
    if (since === null) since = now;
    if (now - since >= holdMs && now - lastFired >= cooldownMs) {
      lastFired = now;
      armed = false;
      return true;
    }
    return false;
  };
}

/**
 * Moving your hand to YOUR right makes raw x DECREASE (mirrored video),
 * so dx < 0 = 'right'.
 */
export function createSwipeDetector(minDistance = 0.3, windowMs = 400, cooldownMs = 1000) {
  let history: { t: number; x: number }[] = [];
  let lastFired = -Infinity;

  return (x: number | null, now: number): SwipeDirection | null => {
    if (x === null) {
      history = [];
      return null;
    }
    history.push({ t: now, x });
    history = history.filter((p) => now - p.t <= windowMs);
    if (now - lastFired < cooldownMs) return null;

    const dx = x - history[0].x;
    if (Math.abs(dx) >= minDistance) {
      lastFired = now;
      history = [];
      return dx < 0 ? 'right' : 'left';
    }
    return null;
  };
}

export function heightToVolume(y: number, top = 0.2, bottom = 0.8): number {
  const v = (bottom - y) / (bottom - top);
  return Math.min(1, Math.max(0, v));
}

export function smoothStep(current: number, target: number, alpha = 0.3): number {
  return current + alpha * (target - current);
}

export function inZone(x: number, y: number, z: Zone, margin = 0): boolean {
  return (
    x >= z.xMin - margin &&
    x <= z.xMax + margin &&
    y >= z.yMin - margin &&
    y <= z.yMax + margin
  );
}

export function createVolumeSlider(zone: Zone, dwellMs = 300, margin = 0.05) {
  let state: SliderState = 'idle';
  let since = 0;

  return (tip: Point | null, now: number): { state: SliderState; volume: number | null } => {
    if (!tip) {
      state = 'idle';
      return { state, volume: null };
    }
    const inside = inZone(toScreenX(tip.x), tip.y, zone, state === 'grabbed' ? margin : 0);
    if (!inside) {
      state = 'idle';
      return { state, volume: null };
    }
    if (state === 'idle') {
      state = 'hovering';
      since = now;
    }
    if (state === 'hovering' && now - since >= dwellMs) state = 'grabbed';

    const volume = state === 'grabbed' ? heightToVolume(tip.y, zone.yMin, zone.yMax) : null;
    return { state, volume };
  };
}