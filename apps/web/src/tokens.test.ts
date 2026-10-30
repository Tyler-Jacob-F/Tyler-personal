import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.dirname(fileURLToPath(import.meta.url));
const themeFile = path.join(src, 'index.css');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Three, six or eight hex digits after the hash, as CSS reads them. */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

describe('tokens', () => {
  it('keeps every hex literal in the theme file (docs/DESIGN-VALUES.md: semantic tokens only)', () => {
    const offenders = walk(src)
      .filter((file) => /\.(tsx?|css|html)$/.test(file) && file !== themeFile)
      .filter((file) => HEX.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(src, file));
    expect(offenders).toEqual([]);
  });
});

// ---- contrast -------------------------------------------------------------------------

type Palette = Record<string, string>;

/** The custom properties declared inside the first block whose selector matches. */
function palette(css: string, selector: string): Palette {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const block = css.slice(open + 1, close);
  const out: Palette = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    out[match[1]!] = match[2]!.toLowerCase();
  }
  return out;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(themeFile, 'utf8');
const dark = palette(css, ":root,\n[data-theme='dark']");
const light = palette(css, "[data-theme='light']");
const lightFallback = palette(css, ':root:not([data-theme])');

const names = [
  'bg',
  'surface',
  'surface-raised',
  'text',
  'text-strong',
  'muted',
  'border',
  'border-strong',
  'accent',
  'accent-hover',
  'accent-active',
  'on-accent',
  'wrong',
  'success',
];

describe('palette', () => {
  it('declares every token of the contract in both modes, and the no-script fallback is the light palette', () => {
    for (const name of names) {
      expect(dark[name], `dark ${name}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(light[name], `light ${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(lightFallback).toEqual(light);
  });

  it('carries exactly the values of the contract’s token table (docs/DESIGN-VALUES.md)', () => {
    const contract = readFileSync(path.resolve(src, '../../../docs/DESIGN-VALUES.md'), 'utf8');
    const rows = [
      ...contract.matchAll(
        /^\| `([a-z-]+)`\s+\| `(#[0-9a-fA-F]{6})` \| `(#[0-9a-fA-F]{6})`\s+\|$/gm,
      ),
    ];
    expect(rows.length).toBe(13);
    for (const [, name, darkHex, lightHex] of rows) {
      expect(dark[name!], `dark ${name}`).toBe(darkHex!.toLowerCase());
      expect(light[name!], `light ${name}`).toBe(lightHex!.toLowerCase());
    }
  });

  describe.each([
    ['dark', dark],
    ['light', light],
  ])('%s mode', (_mode, p) => {
    const on = (fg: string, bg: string) => contrast(p[fg]!, p[bg]!);

    it('reads at body size: text, muted and accent on bg and on both surfaces', () => {
      for (const surface of ['bg', 'surface', 'surface-raised']) {
        expect(on('text', surface), `text on ${surface}`).toBeGreaterThanOrEqual(7);
        expect(on('text-strong', surface), `text-strong on ${surface}`).toBeGreaterThanOrEqual(7);
        expect(on('muted', surface), `muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(on('accent', surface), `accent on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      // `wrong` is rare and short; the contract fixes it at 4.5:1 on bg, and a shade under on
      // the raised surfaces, where it is never body copy.
      expect(on('wrong', 'bg')).toBeGreaterThanOrEqual(4.5);
      expect(on('wrong', 'surface-raised')).toBeGreaterThanOrEqual(3);
    });

    it('keeps the filled control legible at rest, and at the UI-component ratio while pressed', () => {
      // The contract says it: on paper, accent-hover is below 4.5:1 for small text, so it is
      // used for filled controls only, and text links on paper hover by underline.
      expect(on('on-accent', 'accent')).toBeGreaterThanOrEqual(4.5);
      expect(on('on-accent', 'accent-hover')).toBeGreaterThanOrEqual(3);
      expect(on('on-accent', 'accent-active')).toBeGreaterThanOrEqual(4.5);
    });

    it('draws a hairline and a focus ring that can be seen against the page', () => {
      expect(on('border', 'bg')).toBeGreaterThanOrEqual(1.2);
      expect(on('border-strong', 'bg')).toBeGreaterThanOrEqual(1.6);
    });
  });

  it('matches the contract’s own check: dark text 14.7:1, muted 6.7:1, accent 8.2:1; light muted 5.4:1, accent 5.1:1', () => {
    expect(contrast(dark.text!, dark.bg!)).toBeCloseTo(14.7, 0);
    expect(contrast(dark.muted!, dark.bg!)).toBeCloseTo(6.7, 0);
    expect(contrast(dark.accent!, dark.bg!)).toBeCloseTo(8.2, 0);
    expect(contrast(light.muted!, light.bg!)).toBeCloseTo(5.4, 0);
    expect(contrast(light.accent!, light.bg!)).toBeCloseTo(5.1, 0);
  });
});
