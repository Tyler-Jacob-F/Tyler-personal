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
  /** Morning Prayer, readings included, as markdown. */
  office: string | null;
  /** At most three, each a paragraph of markdown. */
  items: string[];
  shape: ShapeRow[];
}

export const BRIEF_ITEM_CAP = 3;

const slots: Record<'day' | 'office' | 'brief' | 'shape', string[]> = {
  day: ['day', 'the day'],
  office: ['office', 'the office', 'morning prayer', 'the daily office', 'daily office'],
  brief: ['brief', 'the brief'],
  shape: ['today', "the day's shape", "day's shape", 'shape', 'the shape of the day'],
};

function slotOf(heading: string): keyof typeof slots | null {
  const key = heading.trim().toLowerCase().replace(/[’']/g, "'");
  for (const [slot, names] of Object.entries(slots) as Array<[keyof typeof slots, string[]]>) {
    if (names.includes(key)) return slot;
  }
  return null;
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
  const parts: MorningParts = { day: null, office: null, items: [], shape: [] };
  if (!brief) return parts;
  const overflow: string[] = [];
  for (const section of brief.sections) {
    const slot = slotOf(section.heading);
    const body = section.body.trim();
    if (!body) continue;
    if (slot === 'day') parts.day ??= blocksOf(body)[0] ?? null;
    else if (slot === 'office') parts.office ??= body;
    else if (slot === 'shape') parts.shape.push(...blocksOf(body).map(parseShapeRow));
    else if (slot === 'brief') parts.items.push(...blocksOf(body));
    else overflow.push(...blocksOf(body).slice(0, 1));
  }
  parts.items = [...parts.items, ...overflow].slice(0, BRIEF_ITEM_CAP);
  return parts;
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Saturday" and "31 October 2026" for a calendar date. */
export function dayHeading(date: string): { weekday: string; date: string } {
  const at = new Date(`${date}T00:00:00.000Z`);
  return { weekday: weekdayFormatter.format(at), date: dateFormatter.format(at) };
}
