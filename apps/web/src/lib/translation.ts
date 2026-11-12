import { type Translation, translations, translationSchema } from '@the-keep/shared';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Which translation the readings open in (docs/phases/04-group.md "Translations"): a
 * choice the device remembers, shared by the group's guide and the morning page, with a
 * fallback the page supplies (the liturgy's translation on the guide; the King James on
 * the morning page) until someone has chosen. Storage is guarded the way the theme's is:
 * absent or throwing storage means the choice lasts for the tab. Decided and flagged: a
 * device, not a member row, remembers it; one phone each and nothing to audit, and a
 * column is the reversible step from here, not the other way round.
 */
export const TRANSLATION_KEY = 'keep.translation';

/** What a tab chose when storage would not keep it. */
let inTab: Translation | null = null;
const listeners = new Set<() => void>();

export function storedTranslation(): Translation | null {
  try {
    const parsed = translationSchema.safeParse(window.localStorage.getItem(TRANSLATION_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return inTab;
  }
}

export function rememberTranslation(translation: Translation | null): void {
  inTab = translation;
  try {
    if (translation === null) window.localStorage.removeItem(TRANSLATION_KEY);
    else window.localStorage.setItem(TRANSLATION_KEY, translation);
  } catch {
    // The choice lasts for the tab.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The reader's translation, the page's fallback until they choose, and the way to choose. */
export function useTranslation(fallback: Translation): [Translation, (next: Translation) => void] {
  const stored = useSyncExternalStore(subscribe, storedTranslation, () => null);
  const choose = useCallback((next: Translation) => rememberTranslation(next), []);
  return [stored ?? fallback, choose];
}

/**
 * The wheel: any translation but the one showing, at random. Nothing is seeded; a wheel
 * that could be predicted from where it started landed the room on the same two
 * translations in turn (Nov 12), which is not a wheel.
 */
export function spinWheel(current: Translation): Translation {
  const others = translations.filter((code) => code !== current);
  return others[Math.floor(Math.random() * others.length)]!;
}
