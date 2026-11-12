import { z } from 'zod';

/**
 * Translations the passage service can serve (docs/phases/04-group.md "Translations").
 * Eight public-domain texts come from bible-api.com by its codes; the ESV from Crossway's
 * own API; the NIV from API.Bible. Each needs a key but the first. A reader picks one on
 * the page (the device remembers); the liturgy's `translation` is what the group's guide
 * opens in before anyone has chosen.
 */
export const translations = [
  'kjv',
  'esv',
  'niv',
  'web',
  'webbe',
  'asv',
  'bbe',
  'darby',
  'dra',
  'ylt',
] as const;
export const translationSchema = z.enum(translations);
export type Translation = z.infer<typeof translationSchema>;

export const DEFAULT_TRANSLATION: Translation = 'kjv';

/** Who serves a translation: the keyless public-domain source, Crossway, or API.Bible. */
export type PassageSource = 'bible-api' | 'esv' | 'api-bible';

export interface TranslationInfo {
  /** The full name, for a select. */
  name: string;
  /** The initials, for a credit line. */
  short: string;
  source: PassageSource;
  /** Whether the source's text of it includes the Apocrypha (Ecclesiasticus, Wisdom, Tobit…). */
  apocrypha: boolean;
}

export const translationInfo: Record<Translation, TranslationInfo> = {
  kjv: { name: 'King James Version', short: 'KJV', source: 'bible-api', apocrypha: false },
  esv: { name: 'English Standard Version', short: 'ESV', source: 'esv', apocrypha: false },
  niv: { name: 'New International Version', short: 'NIV', source: 'api-bible', apocrypha: false },
  web: { name: 'World English Bible', short: 'WEB', source: 'bible-api', apocrypha: false },
  webbe: {
    name: 'World English Bible, British Edition',
    short: 'WEBBE',
    source: 'bible-api',
    apocrypha: false,
  },
  asv: { name: 'American Standard Version', short: 'ASV', source: 'bible-api', apocrypha: false },
  bbe: { name: 'Bible in Basic English', short: 'BBE', source: 'bible-api', apocrypha: false },
  darby: { name: 'Darby Translation', short: 'Darby', source: 'bible-api', apocrypha: false },
  dra: { name: 'Douay-Rheims', short: 'DRA', source: 'bible-api', apocrypha: true },
  ylt: { name: 'Young’s Literal Translation', short: 'YLT', source: 'bible-api', apocrypha: false },
};

export const translationNames: Record<Translation, string> = Object.fromEntries(
  translations.map((code) => [code, translationInfo[code].name]),
) as Record<Translation, string>;

/**
 * Where a reading from the Apocrypha is served when the chosen translation has none: the
 * Douay-Rheims is the one public-domain text on offer that carries it.
 */
export const APOCRYPHA_FALLBACK: Translation = 'dra';

/**
 * The wheel (docs/phases/04-group.md "Translations"): a translation picked from the list
 * by a seed, so every phone that spins on the same Thursday lands on the same one and the
 * leader can read it aloud. Deterministic; nothing clever.
 */
export function rouletteFor(
  seed: string,
  among: readonly Translation[] = translations,
): Translation {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return among[hash % among.length]!;
}
