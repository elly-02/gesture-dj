export type Point = { x: number; y: number; z?: number };
export type SwipeDirection = 'left' | 'right';

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

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
 * Landmark x is in raw camera space, but the video is shown mirrored.
 * Moving your hand to YOUR right makes x DECREASE, so dx < 0 = 'right'.
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

export function pinchRatio(lm: Point[]): number {
  const handSize = dist(lm[0], lm[9]);
  if (handSize === 0) return Infinity;
  return dist(lm[4], lm[8]) / handSize;
}

function otherFingersUp(lm: Point[]): boolean {
  return [12, 16, 20].every((tip, i) => lm[tip].y < lm[[10, 14, 18][i]].y);
}

export function createPinchDetector(enter = 0.3, exit = 0.45) {
  let pinched = false;

  return (lm: Point[] | null): boolean => {
    if (!lm || lm.length < 21 || !otherFingersUp(lm)) {
      pinched = false;
      return false;
    }
    const r = pinchRatio(lm);
    pinched = pinched ? r < exit : r < enter;
    return pinched;
  };
}

export function heightToVolume(y: number, top = 0.2, bottom = 0.8): number {
  const v = (bottom - y) / (bottom - top);
  return Math.min(1, Math.max(0, v));
}

export function smoothStep(current: number, target: number, alpha = 0.3): number {
  return current + alpha * (target - current);
}