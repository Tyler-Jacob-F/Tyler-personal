/**
 * A scripture reference as a guide or a lectionary writes it ("Ephesians 1:15–23",
 * "Psalm 95", "Genesis 1:1–2:3", "Jude 3–7", "Ecclesiasticus 44:1–15"), read into its
 * book and the chapter-and-verse spans it names. Sources that take a reference as text
 * (bible-api.com, Crossway) get it back as this module writes it; API.Bible wants its
 * own passage ids, built here from the USFM book codes.
 */

export interface BookInfo {
  /** The USFM 3-letter code API.Bible keys its books by. */
  code: string;
  /** How the reference is written back out. */
  name: string;
  /** Books the Reformation put in the Apocrypha, which most sources leave out. */
  apocrypha: boolean;
  /** Obadiah, Philemon, 2 and 3 John, Jude: "Jude 3–7" counts verses, not chapters. */
  singleChapter?: boolean;
}

interface Point {
  chapter: number;
  verse?: number;
}

export interface Span {
  start: Point;
  /** Absent for one chapter or one verse. */
  end?: Point;
}

export interface ParsedReference {
  book: BookInfo;
  spans: Span[];
}

const book = (
  code: string,
  name: string,
  aliases: string[],
  options: { apocrypha?: boolean; singleChapter?: boolean } = {},
): [BookInfo, string[]] => [
  { code, name, apocrypha: options.apocrypha ?? false, singleChapter: options.singleChapter },
  [name, ...aliases],
];

const BOOKS: Array<[BookInfo, string[]]> = [
  book('GEN', 'Genesis', ['Gen', 'Ge', 'Gn']),
  book('EXO', 'Exodus', ['Exod', 'Ex', 'Exo']),
  book('LEV', 'Leviticus', ['Lev', 'Le', 'Lv']),
  book('NUM', 'Numbers', ['Num', 'Nu', 'Nm', 'Nb']),
  book('DEU', 'Deuteronomy', ['Deut', 'Dt', 'De']),
  book('JOS', 'Joshua', ['Josh', 'Jos', 'Jsh']),
  book('JDG', 'Judges', ['Judg', 'Jdg', 'Jg', 'Jdgs']),
  book('RUT', 'Ruth', ['Rth', 'Ru']),
  book('1SA', '1 Samuel', ['1 Sam', '1 Sm', '1 Sa']),
  book('2SA', '2 Samuel', ['2 Sam', '2 Sm', '2 Sa']),
  book('1KI', '1 Kings', ['1 Kgs', '1 Ki', '1 Kin']),
  book('2KI', '2 Kings', ['2 Kgs', '2 Ki', '2 Kin']),
  book('1CH', '1 Chronicles', ['1 Chron', '1 Chr', '1 Ch']),
  book('2CH', '2 Chronicles', ['2 Chron', '2 Chr', '2 Ch']),
  book('EZR', 'Ezra', ['Ezr']),
  book('NEH', 'Nehemiah', ['Neh', 'Ne']),
  book('EST', 'Esther', ['Esth', 'Est', 'Es']),
  book('JOB', 'Job', ['Jb']),
  book('PSA', 'Psalm', ['Psalms', 'Ps', 'Pss', 'Psa', 'Psm', 'Pslm']),
  book('PRO', 'Proverbs', ['Prov', 'Pr', 'Prv', 'Pro']),
  book('ECC', 'Ecclesiastes', ['Eccles', 'Eccl', 'Ec', 'Qoheleth']),
  book('SNG', 'Song of Songs', [
    'Song of Solomon',
    'Song',
    'Canticles',
    'Canticle of Canticles',
    'SOS',
    'So',
  ]),
  book('ISA', 'Isaiah', ['Isa', 'Is']),
  book('JER', 'Jeremiah', ['Jer', 'Je', 'Jr']),
  book('LAM', 'Lamentations', ['Lam', 'La']),
  book('EZK', 'Ezekiel', ['Ezek', 'Eze', 'Ezk']),
  book('DAN', 'Daniel', ['Dan', 'Da', 'Dn']),
  book('HOS', 'Hosea', ['Hos', 'Ho']),
  book('JOL', 'Joel', ['Joe', 'Jl']),
  book('AMO', 'Amos', ['Am']),
  book('OBA', 'Obadiah', ['Obad', 'Ob'], { singleChapter: true }),
  book('JON', 'Jonah', ['Jon', 'Jnh']),
  book('MIC', 'Micah', ['Mic', 'Mc']),
  book('NAM', 'Nahum', ['Nah', 'Na']),
  book('HAB', 'Habakkuk', ['Hab', 'Hb']),
  book('ZEP', 'Zephaniah', ['Zeph', 'Zep', 'Zp']),
  book('HAG', 'Haggai', ['Hag', 'Hg']),
  book('ZEC', 'Zechariah', ['Zech', 'Zec', 'Zc']),
  book('MAL', 'Malachi', ['Mal', 'Ml']),
  book('MAT', 'Matthew', ['Matt', 'Mt']),
  book('MRK', 'Mark', ['Mk', 'Mr', 'Mrk']),
  book('LUK', 'Luke', ['Lk', 'Luk']),
  book('JHN', 'John', ['Jn', 'Jhn']),
  book('ACT', 'Acts', ['Acts of the Apostles', 'Ac']),
  book('ROM', 'Romans', ['Rom', 'Ro', 'Rm']),
  book('1CO', '1 Corinthians', ['1 Cor', '1 Co']),
  book('2CO', '2 Corinthians', ['2 Cor', '2 Co']),
  book('GAL', 'Galatians', ['Gal', 'Ga']),
  book('EPH', 'Ephesians', ['Eph', 'Ephes']),
  book('PHP', 'Philippians', ['Phil', 'Php', 'Pp']),
  book('COL', 'Colossians', ['Col']),
  book('1TH', '1 Thessalonians', ['1 Thess', '1 Thes', '1 Th']),
  book('2TH', '2 Thessalonians', ['2 Thess', '2 Thes', '2 Th']),
  book('1TI', '1 Timothy', ['1 Tim', '1 Ti']),
  book('2TI', '2 Timothy', ['2 Tim', '2 Ti']),
  book('TIT', 'Titus', ['Tit']),
  book('PHM', 'Philemon', ['Philem', 'Phm', 'Pm'], { singleChapter: true }),
  book('HEB', 'Hebrews', ['Heb']),
  book('JAS', 'James', ['Jas', 'Jm']),
  book('1PE', '1 Peter', ['1 Pet', '1 Pe', '1 Pt']),
  book('2PE', '2 Peter', ['2 Pet', '2 Pe', '2 Pt']),
  book('1JN', '1 John', ['1 Jn', '1 Jhn']),
  book('2JN', '2 John', ['2 Jn', '2 Jhn'], { singleChapter: true }),
  book('3JN', '3 John', ['3 Jn', '3 Jhn'], { singleChapter: true }),
  book('JUD', 'Jude', ['Jud', 'Jd'], { singleChapter: true }),
  book('REV', 'Revelation', ['Revelation of John', 'Rev', 'Re', 'The Revelation']),
  // The Apocrypha, as the Daily Office lectionary names them.
  book('TOB', 'Tobit', ['Tob', 'Tb'], { apocrypha: true }),
  book('JDT', 'Judith', ['Jdt', 'Jth'], { apocrypha: true }),
  book('ESG', 'Additions to Esther', ['Add Esth', 'Rest of Esther', 'Esther (Greek)'], {
    apocrypha: true,
  }),
  book('WIS', 'Wisdom', ['Wisdom of Solomon', 'Wis', 'Ws'], { apocrypha: true }),
  book('SIR', 'Ecclesiasticus', ['Sirach', 'Ecclus', 'Sir', 'Ben Sira', 'Wisdom of Sirach'], {
    apocrypha: true,
  }),
  book('BAR', 'Baruch', ['Bar'], { apocrypha: true }),
  book('LJE', 'Letter of Jeremiah', ['Epistle of Jeremiah', 'Ep Jer'], {
    apocrypha: true,
    singleChapter: true,
  }),
  book(
    'S3Y',
    'Song of the Three',
    ['Song of the Three Young Men', 'Song of the Three Children', 'Song of Thr', 'S3Y'],
    { apocrypha: true, singleChapter: true },
  ),
  book('SUS', 'Susanna', ['Sus'], { apocrypha: true, singleChapter: true }),
  book('BEL', 'Bel and the Dragon', ['Bel'], { apocrypha: true, singleChapter: true }),
  book('1MA', '1 Maccabees', ['1 Macc', '1 Mac', '1 Ma'], { apocrypha: true }),
  book('2MA', '2 Maccabees', ['2 Macc', '2 Mac', '2 Ma'], { apocrypha: true }),
  book('MAN', 'Prayer of Manasseh', ['Pr Man', 'Pr of Man', 'Manasseh'], {
    apocrypha: true,
    singleChapter: true,
  }),
  book('1ES', '1 Esdras', ['1 Esd', '1 Es'], { apocrypha: true }),
  book('2ES', '2 Esdras', ['2 Esd', '2 Es'], { apocrypha: true }),
];

const ORDINALS: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  first: '1',
  second: '2',
  third: '3',
  '1st': '1',
  '2nd': '2',
  '3rd': '3',
};

/** "I Kings", "First Kings", "1st Kings", "1Kings", "1. Kings" all key the same way. */
function keyOf(name: string): string {
  const plain = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const ordinal = /^(?:(i{1,3}|first|second|third|1st|2nd|3rd)\s+|([123])\s*)(?=[a-z])/.exec(plain);
  if (!ordinal) return plain;
  const number = ordinal[1] ? ORDINALS[ordinal[1]]! : ordinal[2]!;
  return `${number} ${plain.slice(ordinal[0].length)}`;
}

const BY_KEY = new Map<string, BookInfo>();
for (const [info, names] of BOOKS) for (const name of names) BY_KEY.set(keyOf(name), info);

export function findBook(name: string): BookInfo | null {
  return BY_KEY.get(keyOf(name)) ?? null;
}

/** "Ephesians 1:15–23" with an en dash, or odd spacing, to plain ASCII. */
export function normalizeReference(ref: string): string {
  return ref
    .replace(/[–—‒−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trailing verse letters ("7a", "17b") mark part of a verse; the whole verse is fetched. */
const POINT = /^(\d+)(?::(\d+)[a-c]?)?$/;
const VERSE_ONLY = /^(\d+)[a-c]?$/;

/**
 * Read a reference. Null when the book is unknown or the numbers do not parse, in which
 * case the caller passes the text to a source that reads references itself.
 */
export function parseReference(ref: string): ParsedReference | null {
  const text = normalizeReference(ref);
  const match = /^((?:[1-3]|i{1,3}|first|second|third)?\s*[a-z][a-z .]*?)\s*(\d.*)?$/i.exec(text);
  if (!match) return null;
  const info = findBook(match[1]!.trim());
  if (!info) return null;
  const rest = (match[2] ?? '').trim();
  if (!rest) return { book: info, spans: [{ start: { chapter: 1 } }] };

  const spans: Span[] = [];
  // "1:15-23; 2:1-3" and "119:1-8, 33-40": semicolons separate full points, commas share a chapter.
  let chapter: number | null = null;
  for (const group of rest.split(';')) {
    chapter = null;
    for (const piece of group.split(',')) {
      const span = parseSpan(piece.trim(), info, chapter);
      if (!span) return null;
      spans.push(span);
      chapter = (span.end ?? span.start).chapter;
    }
  }
  return { book: info, spans };
}

function parseSpan(piece: string, info: BookInfo, chapter: number | null): Span | null {
  const [a, b, extra] = piece.split('-');
  if (!a || extra !== undefined) return null;
  const start = parsePoint(a, info, chapter);
  if (!start) return null;
  if (b === undefined) return { start };
  const end = parsePoint(b, info, start.verse !== undefined ? start.chapter : null);
  if (!end) return null;
  // "3-7" in a single-chapter book, or "1:15-23": the end shares the start's chapter.
  return { start, end };
}

function parsePoint(text: string, info: BookInfo, chapter: number | null): Point | null {
  const whole = POINT.exec(text);
  if (whole) {
    const first = Number(whole[1]);
    if (whole[2] !== undefined) return { chapter: first, verse: Number(whole[2]) };
    if (chapter !== null) return { chapter, verse: first };
    if (info.singleChapter) return { chapter: 1, verse: first };
    return { chapter: first };
  }
  const verse = VERSE_ONLY.exec(text);
  if (verse && chapter !== null) return { chapter, verse: Number(verse[1]) };
  return null;
}

const pointText = (p: Point) =>
  p.verse === undefined ? `${p.chapter}` : `${p.chapter}:${p.verse}`;

/** The reference written the standard way: "Ephesians 1:15-23", "Psalm 95", "Jude 1:3-7". */
export function formatReference({ book: info, spans }: ParsedReference): string {
  const parts = spans.map(({ start, end }) => {
    if (!end) return pointText(start);
    if (end.chapter === start.chapter && end.verse !== undefined && start.verse !== undefined)
      return `${pointText(start)}-${end.verse}`;
    return `${pointText(start)}-${pointText(end)}`;
  });
  return `${info.name} ${parts.join('; ')}`;
}

/** API.Bible's passage ids: "EPH.1.15-EPH.1.23", "PSA.95", "GEN.1.1-GEN.2.3"; one per span. */
export function passageIds({ book: info, spans }: ParsedReference): string[] {
  const id = (p: Point) =>
    p.verse === undefined ? `${info.code}.${p.chapter}` : `${info.code}.${p.chapter}.${p.verse}`;
  return spans.map(({ start, end }) => (end ? `${id(start)}-${id(end)}` : id(start)));
}
