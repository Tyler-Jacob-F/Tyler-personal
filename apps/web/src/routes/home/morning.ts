import type { BriefFrontmatter } from '@the-keep/shared';

/**
 * The morning page's four parts, read out of the brief's sections by heading
 * (docs/DESIGN-VALUES.md "The morning page"; the brief guide in packages/shared names the
 * headings). Anything the writer adds under another heading folds into the brief, which
 * is capped at three items: the page is read, not scanned.
 */
export interface ShapeRow {
  /** "9:00", "Thu", "Dinner", or empty. */
  label: string;
  /** Inline markdown. */
  text: string;
}

export interface MorningParts {
  /** One line: liturgical day and season, sunrise, weather. */
  day: string | null;
  /** The office, readings included, as markdown. */
  office: string | null;
  /** The eyebrow over it: which office this is. Follows the content, since the brief is
   * updated through the day; Morning Prayer when nothing says otherwise. */
  officeTitle: string;
  /** At most three, each a paragraph of markdown. */
  items: string[];
  shape: ShapeRow[];
}

export const BRIEF_ITEM_CAP = 3;

const slots: Record<'day' | 'office' | 'brief' | 'shape', string[]> = {
  day: ['day', 'the day'],
  office: ['office', 'the office', 'the daily office', 'daily office'],
  brief: ['brief', 'the brief'],
  shape: ['today', "the day's shape", "day's shape", 'shape', 'the shape of the day'],
};

export const DEFAULT_OFFICE = 'Morning Prayer';

/** The offices of the 2019 BCP and their family forms, as a writer would name them. */
const OFFICE_NAME =
  /^(?:(?:morning|midday|noonday|evening|night) prayer|compline|family prayer(?: (?:in the morning|at midday|in the early evening|at the close of day))?|(?:morning|midday|early evening|close of day) devotions?)$/i;

function titleCase(name: string): string {
  return name
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bOf\b/g, 'of')
    .replace(/\bIn\b/g, 'in')
    .replace(/\bAt\b/g, 'at')
    .replace(/\bThe\b/g, 'the');
}

/**
 * Which slot a section heading names. "Office", "Office · Evening Prayer" and a bare
 * office name all land in the office slot; the office's name, when given, becomes the
 * eyebrow.
 */
function slotOf(heading: string): { slot: keyof typeof slots; office?: string } | null {
  const key = heading.trim().toLowerCase().replace(/[’']/g, "'");
  for (const [slot, names] of Object.entries(slots) as Array<[keyof typeof slots, string[]]>) {
    if (names.includes(key)) return { slot };
  }
  const qualified = /^(?:the )?(?:daily )?office\s*[·:–-]\s*(.+)$/i.exec(heading.trim());
  if (qualified) return { slot: 'office', office: titleCase(qualified[1]!.trim()) };
  if (OFFICE_NAME.test(key)) return { slot: 'office', office: titleCase(key) };
  return null;
}

/** An office body that opens with its own name as a heading: lift the name out. */
function liftOfficeName(body: string): { office: string | null; body: string } {
  const match = /^\s*#{1,6}\s*([^\n]+?)\s*\n+/.exec(body);
  if (match && OFFICE_NAME.test(match[1]!.trim())) {
    return { office: titleCase(match[1]!.trim().toLowerCase()), body: body.slice(match[0].length) };
  }
  return { office: null, body };
}

/** Markdown blocks: paragraphs split on blank lines, list items split one per line. */
export function blocksOf(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split('\n').map((l) => l.trim());
      const listy = lines.every((l) => /^([-*+]|\d+[.)])\s+/.test(l));
      return listy ? lines.map((l) => l.replace(/^([-*+]|\d+[.)])\s+/, '')) : [lines.join(' ')];
    })
    .map((b) => b.trim())
    .filter(Boolean);
}

const TIME = /^(\d{1,2}(?::\d{2})?\s?(?:[ap]\.?m\.?)?)\s+(?:[·–-]\s+)?(.+)$/i;

/** "9:00 · Pancakes" or "9:00 Pancakes" or "Thu · Small group" or "Dinner · Chili". */
export function parseShapeRow(line: string): ShapeRow {
  const dot = line.indexOf(' · ');
  if (dot > 0 && dot <= 12)
    return { label: line.slice(0, dot).trim(), text: line.slice(dot + 3).trim() };
  const timed = TIME.exec(line);
  if (timed) return { label: timed[1]!.trim(), text: timed[2]!.trim() };
  return { label: '', text: line.trim() };
}

export function morningParts(brief: BriefFrontmatter | null): MorningParts {
  const parts: MorningParts = {
    day: null,
    office: null,
    officeTitle: DEFAULT_OFFICE,
    items: [],
    shape: [],
  };
  if (!brief) return parts;
  const overflow: string[] = [];
  for (const section of brief.sections) {
    const found = slotOf(section.heading);
    const slot = found?.slot ?? null;
    const body = section.body.trim();
    if (!body) continue;
    if (slot === 'day') parts.day ??= blocksOf(body)[0] ?? null;
    else if (slot === 'office') {
      if (parts.office !== null) continue;
      const lifted = liftOfficeName(body);
      parts.office = lifted.body.trim() || body;
      parts.officeTitle = found?.office ?? lifted.office ?? DEFAULT_OFFICE;
    } else if (slot === 'shape') parts.shape.push(...blocksOf(body).map(parseShapeRow));
    else if (slot === 'brief') parts.items.push(...blocksOf(body));
    else overflow.push(...blocksOf(body).slice(0, 1));
  }
  parts.items = [...parts.items, ...overflow].slice(0, BRIEF_ITEM_CAP);
  return parts;
}
