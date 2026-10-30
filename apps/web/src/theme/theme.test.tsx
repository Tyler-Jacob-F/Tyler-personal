import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ThemeToggle } from '@/components/ThemeToggle';
import { render, screen, userEvent } from '@/test/render';
import { applyTheme, currentTheme, preferredTheme, storedTheme, THEME_KEY } from '@/theme/theme';

function prefers(light: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: light && query.includes('light'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/** The inline script from index.html, run against this document. */
function runInlineScript() {
  const html = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../index.html'),
    'utf8',
  );
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(script, 'the pre-paint script').toBeTruthy();
  new Function('window', 'document', script!)(window, document);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  prefers(false);
});

describe('the theme before paint', () => {
  it('follows the system when nothing is remembered: dark by default, paper when the phone says so', () => {
    runInlineScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    prefers(true);
    runInlineScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('prefers the remembered theme over the system and ignores junk in storage', () => {
    prefers(true);
    window.localStorage.setItem(THEME_KEY, 'dark');
    runInlineScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    window.localStorage.setItem(THEME_KEY, 'sepia');
    runInlineScript();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('says the same thing the module says', () => {
    prefers(true);
    expect(preferredTheme()).toBe('light');
    expect(storedTheme()).toBeNull();
    expect(currentTheme()).toBe('light');
    window.localStorage.setItem(THEME_KEY, 'dark');
    expect(storedTheme()).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });
});

describe('ThemeToggle', () => {
  it('flips the attribute, remembers the choice, and names the theme it would switch to', async () => {
    const user = userEvent.setup();
    runInlineScript();
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Switch to light theme' });
    await user.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('survives storage that throws, keeping the choice for the tab', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(currentTheme()).toBe('light');
    setItem.mockRestore();
  });

  it('keeps the browser chrome the page color when the theme changes', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = 'stale';
    document.head.append(meta);
    document.documentElement.style.setProperty('--bg', 'rgb(1, 2, 3)');
    applyTheme('dark');
    expect(meta.content).toBe('rgb(1, 2, 3)');
    document.documentElement.style.removeProperty('--bg');
  });
});
