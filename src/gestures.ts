export type Point = { x: number; y: number; z?: number };

const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

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