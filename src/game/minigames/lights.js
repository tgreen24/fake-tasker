export const WINDOWS = 9;
export const LIGHTS_TO_TURN_OFF = 15;
// A new light comes on a little sooner after each one is switched off.
export const FIRST_LIGHT_MS = 900;
export const lightIntervalMs = (switchedOff) => Math.max(450, FIRST_LIGHT_MS - switchedOff * 30);

export function nextLight(lit, random = Math.random) {
  const dark = Array.from({ length: WINDOWS }, (_, i) => i).filter((i) => !lit.includes(i));
  if (!dark.length) return null;
  return dark[Math.floor(random() * dark.length)];
}
