import { useCallback, useSyncExternalStore } from 'react';

/**
 * Dark or paper (docs/DESIGN-VALUES.md "Mode"). The default follows the system; the toggle
 * sets `data-theme` on <html> and remembers the choice. The inline script in index.html
 * applies the same rule before paint, so nothing flashes; this module takes over once the
 * app is running. Storage is guarded the way the refresh token's is: absent or throwing
 * storage means the choice lasts for the tab.
 */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'keep.theme';

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';

export function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/** What the system asks for. Dark unless the browser says light, as in index.html. */
export function preferredTheme(): Theme {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/** The theme in force: the attribute the inline script set, else the rule it follows. */
export function currentTheme(): Theme {
  const attribute = document.documentElement.getAttribute('data-theme');
  return isTheme(attribute) ? attribute : (storedTheme() ?? preferredTheme());
}

const listeners = new Set<() => void>();

/** Set the attribute, remember the choice, keep the phone's status bar the page's color. */
export function applyTheme(theme: Theme, { persist = true } = {}): void {
  document.documentElement.setAttribute('data-theme', theme);
  if (persist) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The choice lasts for the tab.
    }
  }
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) {
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = bg;
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The theme and a toggle, for the nav. */
export function useTheme(): { theme: Theme; toggle(): void } {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'dark' as Theme);
  const toggle = useCallback(() => applyTheme(theme === 'dark' ? 'light' : 'dark'), [theme]);
  return { theme, toggle };
}
