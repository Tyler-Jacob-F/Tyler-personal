import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { encodable } from '@/lib/pdf';
import { methodBlocks, recipePdf } from '@/routes/recipes/recipe-pdf';
import { version1, version2 } from '@/test/fixtures';

/** Every string the PDF sets, in order: the content streams inflated and their hex strings decoded. */
function textOf(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString('latin1');
  const out: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const hex of content.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
      const piece = Buffer.from(hex[1]!, 'hex').toString('latin1');
      // Eyebrows are set letter by letter; join a run of capitals back into its word.
      const last = out.at(-1);
      if (/^[A-Z]$/.test(piece) && last !== undefined && /^[A-Z]+$/.test(last))
        out[out.length - 1] += piece;
      else out.push(piece);
    }
  }
  return out;
}

describe('recipePdf', () => {
  it('sets the recipe on one Letter page: title, headnote, provenance, facts, grouped ingredients in two columns, the method with hanging numbers, the version line', async () => {
    const bytes = await recipePdf({
      ...version2,
      body: 'A pot for a *cold* Saturday.\n\n# Chili\n\n## Day one\n\n1. Brown the beef in ⅓ cup oil.\n2. Stir in **smoked paprika**.\n\n- Rest overnight.\n\nServe with cornbread.\n',
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Chili');
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual([612, 792]);
    expect(textOf(bytes)).toEqual([
      'Chili',
      'A pot for a cold Saturday.',
      'Provenance \xb7 Steve\x92s card, 2014',
      'Active 20 min \xb7 Total 3 h \xb7 Serves 8',
      'INGREDIENTS',
      'Meats',
      '2 lb',
      'ground chuck',
      '1',
      'onion, diced',
      '1 tsp',
      'smoked paprika',
      'METHOD',
      'Day one',
      '1',
      'Brown the beef in 1/3 cup oil.',
      '2',
      'Stir in smoked paprika.',
      '\x95',
      'Rest overnight.',
      'Serve with cornbread.',
      'v2 \xb7 Tyler \xb7 written Jan 2025 \xb7 entered Oct 2026',
    ]);
  });

  it('runs a long recipe over pages, with a title and page count at the foot of each', async () => {
    const steps = Array.from(
      { length: 60 },
      (_, i) =>
        `${i + 1}. Step ${i + 1}, which takes a while and wraps onto a second line when it is long enough to.`,
    );
    const bytes = await recipePdf({ ...version1, body: `# Method\n\n${steps.join('\n')}\n` });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    const text = textOf(bytes);
    expect(text).toContain(`Chili \xb7 1 of ${doc.getPageCount()}`);
    expect(text).toContain(`Chili \xb7 ${doc.getPageCount()} of ${doc.getPageCount()}`);
    expect(text.some((line) => line.startsWith('Step 60, which takes a while'))).toBe(true);
    // A short recipe has no footer.
    expect(textOf(await recipePdf(version1))).not.toContain('Chili \xb7 1 of 1');
  });

  it('keeps the standard fonts to what they can set', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont('Times-Roman');
    expect(encodable('⅓ cup – ½ tsp • 2 × 14 oz 😀', font)).toBe('1/3 cup – ½ tsp • 2 × 14 oz ');
  });
});

describe('methodBlocks', () => {
  it('reads headings, numbered steps with continuations, bullets and paragraphs, stripping inline marks', () => {
    expect(
      methodBlocks(
        '## Day one\n\n1. Brown the **beef**.\n   Drain it.\n2) Rest.\n\n- Chill\n\nServe with [bread](x).\nWarm.\n',
      ),
    ).toEqual([
      { kind: 'heading', text: 'Day one' },
      { kind: 'step', number: '1', text: 'Brown the beef. Drain it.' },
      { kind: 'step', number: '2', text: 'Rest.' },
      { kind: 'bullet', text: 'Chill' },
      { kind: 'paragraph', text: 'Serve with bread. Warm.' },
    ]);
    expect(methodBlocks('')).toEqual([]);
  });
});
