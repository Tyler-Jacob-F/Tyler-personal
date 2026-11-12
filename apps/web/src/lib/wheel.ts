import { type Translation, translations } from '@the-keep/shared';

/**
 * The wheel's geometry and its jokes (docs/phases/04-group.md "Translations"). Ten wedges,
 * one per translation in the shared list's order, clockwise from the pointer at the top.
 * The wheel turns clockwise; a spin adds whole turns plus whatever brings the chosen wedge
 * under the pointer, a little off centre so no two landings look alike.
 */
export const WEDGES: readonly Translation[] = translations;
export const WEDGE_DEGREES = 360 / WEDGES.length;

/** How long a spin takes, and how long the confetti falls after it. */
export const SPIN_MS = 4200;
export const CONFETTI_MS = 1400;
/** Whole turns before the landing, at least and at most. */
export const MIN_TURNS = 5;
export const MAX_TURNS = 7;
/** How far off the wedge's centre the pointer may land, either way. */
export const JITTER_DEGREES = WEDGE_DEGREES * 0.38;

/** The angle, clockwise from the top, at the middle of a wedge when the wheel is at rest. */
export function wedgeCentre(index: number): number {
  return index * WEDGE_DEGREES + WEDGE_DEGREES / 2;
}

/**
 * The rotation to leave the wheel at so that `target` sits under the pointer, continuing
 * from `current` degrees so the wheel never jumps back: whole turns, then the shortest
 * clockwise way round to the wedge, then the jitter. `random` is injected for tests.
 */
export function landingRotation(
  target: Translation,
  current: number,
  random: () => number = Math.random,
): number {
  const index = WEDGES.indexOf(target);
  const turns = MIN_TURNS + Math.floor(random() * (MAX_TURNS - MIN_TURNS + 1));
  const jitter = (random() * 2 - 1) * JITTER_DEGREES;
  // A clockwise rotation R brings the point at angle a to angle a + R; the wedge's centre
  // reaches the top (0) when a + R ≡ 0, so R ≡ -a. Jitter moves the landing within the wedge.
  const restingMod = (((360 - wedgeCentre(index) + jitter) % 360) + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  const ahead = (restingMod - currentMod + 360) % 360;
  return current + turns * 360 + ahead;
}

/** Which wedge sits under the pointer at a given rotation. */
export function wedgeAt(rotation: number): Translation {
  const mod = ((rotation % 360) + 360) % 360;
  // The point now at the top was at angle -mod before the turn.
  const original = (360 - mod) % 360;
  return WEDGES[Math.floor(original / WEDGE_DEGREES) % WEDGES.length]!;
}

/** The line under the landing: one joke each, in the room's own register. */
export const WHEEL_LINES: Record<Translation, string> = {
  kjv: 'Thee and thou all round.',
  esv: 'The Prayer Book’s own. The wheel has taste tonight.',
  niv: 'The one you grew up on.',
  web: 'Public domain and proud of it.',
  webbe: 'Public domain, with the u in Saviour.',
  asv: 'Nineteen-oh-one called. It would like its Jehovah back.',
  bbe: 'Eight hundred and fifty words, no waiting.',
  darby: 'The Plymouth Brethren send their regards.',
  dra: 'Pray for us.',
  ylt: 'Hold on tight.',
};

/** A wedge's label, short enough to sit on it. */
export const WEDGE_LABELS: Record<Translation, string> = {
  kjv: 'KJV',
  esv: 'ESV',
  niv: 'NIV',
  web: 'WEB',
  webbe: 'WEBBE',
  asv: 'ASV',
  bbe: 'BBE',
  darby: 'Darby',
  dra: 'Douay',
  ylt: 'Young’s',
};

/** An SVG arc path for one wedge of a wheel centred at (c, c) with radius r. */
export function wedgePath(index: number, c: number, r: number): string {
  const start = toRadians(index * WEDGE_DEGREES);
  const end = toRadians((index + 1) * WEDGE_DEGREES);
  const x1 = c + r * Math.sin(start);
  const y1 = c - r * Math.cos(start);
  const x2 = c + r * Math.sin(end);
  const y2 = c - r * Math.cos(end);
  return `M ${c} ${c} L ${f(x1)} ${f(y1)} A ${r} ${r} 0 0 1 ${f(x2)} ${f(y2)} Z`;
}

/** Where a wedge's label sits and how it turns to read outward from the hub. */
export function labelPlacement(index: number, c: number, radius: number) {
  const angle = wedgeCentre(index);
  const rad = toRadians(angle);
  return {
    x: f(c + radius * Math.sin(rad)),
    y: f(c - radius * Math.cos(rad)),
    rotate: angle,
  };
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const f = (n: number) => Math.round(n * 100) / 100;

/** A short buzz when the wheel lands, where the browser offers one (Android; iOS does not). */
export function buzz(): void {
  try {
    navigator.vibrate?.([30, 40, 30]);
  } catch {
    // Not every browser lets a page do this.
  }
}
