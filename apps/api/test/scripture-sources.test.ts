import {
  findBook,
  formatReference,
  normalizeReference,
  parseReference,
  passageIds,
} from '../src/services/sources/reference.js';
import { versesFromMarked } from '../src/services/sources/text.js';

describe('parseReference', () => {
  it('reads book, chapter and verses as a guide or the lectionary writes them', () => {
    expect(parseReference('Ephesians 1:15–23')).toEqual({
      book: expect.objectContaining({ code: 'EPH', name: 'Ephesians', apocrypha: false }),
      spans: [{ start: { chapter: 1, verse: 15 }, end: { chapter: 1, verse: 23 } }],
    });
    expect(parseReference('Psalm 95')!.spans).toEqual([{ start: { chapter: 95 } }]);
    expect(parseReference('Psalms 95')!.book.code).toBe('PSA');
    expect(parseReference('Genesis 1:1–2:3')!.spans).toEqual([
      { start: { chapter: 1, verse: 1 }, end: { chapter: 2, verse: 3 } },
    ]);
    expect(parseReference('Genesis 1-2')!.spans).toEqual([
      { start: { chapter: 1 }, end: { chapter: 2 } },
    ]);
    // Verse letters mark part of a verse; the whole verse is asked for.
    expect(parseReference('Psalm 95:1–7a')!.spans).toEqual([
      { start: { chapter: 95, verse: 1 }, end: { chapter: 95, verse: 7 } },
    ]);
    // Semicolons separate full points; commas share a chapter.
    expect(parseReference('Psalm 119:1–8, 33–40; 120:1')!.spans).toEqual([
      { start: { chapter: 119, verse: 1 }, end: { chapter: 119, verse: 8 } },
      { start: { chapter: 119, verse: 33 }, end: { chapter: 119, verse: 40 } },
      { start: { chapter: 120, verse: 1 } },
    ]);
  });

  it('knows the books by their numbers and short names, and counts verses in a one-chapter book', () => {
    for (const name of ['1 Kings', 'I Kings', 'First Kings', '1Kings', '1 Kgs', '1. Kings']) {
      expect(findBook(name)?.code, name).toBe('1KI');
    }
    expect(findBook('Isaiah')?.code).toBe('ISA');
    expect(findBook('Song of Solomon')?.code).toBe('SNG');
    expect(findBook('Revelation of John')?.code).toBe('REV');
    expect(findBook('Hezekiah')).toBeNull();
    expect(parseReference('Jude 3–7')).toEqual({
      book: expect.objectContaining({ code: 'JUD', singleChapter: true }),
      spans: [{ start: { chapter: 1, verse: 3 }, end: { chapter: 1, verse: 7 } }],
    });
    expect(parseReference('3 John 1:4')!.spans).toEqual([{ start: { chapter: 1, verse: 4 } }]);
  });

  it('names the Apocrypha as the Daily Office does, and gives up on what it cannot read', () => {
    expect(parseReference('Ecclesiasticus 44:1–15')!.book).toMatchObject({
      code: 'SIR',
      apocrypha: true,
    });
    expect(parseReference('Sirach 44:1')!.book.code).toBe('SIR');
    expect(parseReference('Wisdom of Solomon 3:1–9')!.book.code).toBe('WIS');
    expect(parseReference('1 Maccabees 2:49–64')!.book.code).toBe('1MA');
    expect(parseReference('Tobit 12')!.book.apocrypha).toBe(true);
    expect(parseReference('Hezekiah 3:1')).toBeNull();
    expect(parseReference('Psalm 95:1-7-9')).toBeNull();
    expect(parseReference('Psalm')).toEqual({
      book: expect.objectContaining({ code: 'PSA' }),
      spans: [{ start: { chapter: 1 } }],
    });
    expect(parseReference('')).toBeNull();
  });

  it('writes a reference back the standard way and as API.Bible ids', () => {
    const eph = parseReference('Ephesians 1:15–23')!;
    expect(formatReference(eph)).toBe('Ephesians 1:15-23');
    expect(passageIds(eph)).toEqual(['EPH.1.15-EPH.1.23']);
    expect(formatReference(parseReference('Psalms 95')!)).toBe('Psalm 95');
    expect(passageIds(parseReference('Psalm 95')!)).toEqual(['PSA.95']);
    expect(formatReference(parseReference('Genesis 1:1–2:3')!)).toBe('Genesis 1:1-2:3');
    expect(passageIds(parseReference('Genesis 1:1–2:3')!)).toEqual(['GEN.1.1-GEN.2.3']);
    expect(passageIds(parseReference('Genesis 1-2')!)).toEqual(['GEN.1-GEN.2']);
    expect(formatReference(parseReference('Jude 3–7')!)).toBe('Jude 1:3-7');
    expect(passageIds(parseReference('Psalm 119:1–8, 33–40')!)).toEqual([
      'PSA.119.1-PSA.119.8',
      'PSA.119.33-PSA.119.40',
    ]);
    expect(formatReference(parseReference('Psalm 119:1–8, 33–40')!)).toBe(
      'Psalm 119:1-8; 119:33-40',
    );
  });
});

describe('normalizeReference', () => {
  it('turns dashes into hyphens and collapses spaces', () => {
    expect(normalizeReference(' Matthew  5:1—12 ')).toBe('Matthew 5:1-12');
    expect(normalizeReference('Matthew 5 : 1 – 12')).toBe('Matthew 5:1-12');
  });
});

describe('versesFromMarked', () => {
  it('splits bracketed verse numbers into verses and turns the chapter over when the numbers fall back', () => {
    const text =
      '  [31] And God saw every thing that he had made,\n  and, behold, it was very good. [1] Thus the heavens and the earth were finished. [2] And on the seventh day God ended his work.';
    expect(versesFromMarked(text, 1)).toEqual([
      {
        chapter: 1,
        verse: 31,
        text: 'And God saw every thing that he had made, and, behold, it was very good.',
      },
      { chapter: 2, verse: 1, text: 'Thus the heavens and the earth were finished.' },
      { chapter: 2, verse: 2, text: 'And on the seventh day God ended his work.' },
    ]);
    expect(versesFromMarked('A heading the source let through [1] In the beginning', 1)).toEqual([
      { chapter: 1, verse: 1, text: 'In the beginning' },
    ]);
    expect(versesFromMarked('', 3)).toEqual([]);
  });
});
