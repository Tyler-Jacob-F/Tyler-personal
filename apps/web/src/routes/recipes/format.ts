import { recipeFrontmatterSchema } from '@the-keep/shared';

export function titleOf(frontmatter: Record<string, unknown>): string {
  const title = frontmatter.title;
  return typeof title === 'string' && title ? title : 'Untitled';
}

export function recipeOf(frontmatter: Record<string, unknown>) {
  const parsed = recipeFrontmatterSchema.safeParse(frontmatter);
  return parsed.success ? parsed.data : null;
}

const formatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function when(iso: string): string {
  return formatter.format(new Date(iso));
}

const dayFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

/** A calendar date for `authoredAt`, which carries no meaningful time of day. */
export function whenDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

/** "written Nov 6, 2023 · entered Oct 26, 2026" when they differ, else the entry time alone. */
export function dates(version: { createdAt: string; authoredAt: string | null }): string {
  return version.authoredAt
    ? `written ${whenDay(version.authoredAt)} · entered ${when(version.createdAt)}`
    : when(version.createdAt);
}

/** "40 min", "2 h", "2 h 30 min", in tabular figures where it is shown. */
export function minutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthLocalFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

/** "v4 · Tyler · written Nov 2025 · entered Oct 2026" (docs/DESIGN-VALUES.md "Screens"). */
export function versionLine(version: {
  number: number;
  author: { name: string };
  createdAt: string;
  authoredAt: string | null;
}): string {
  const entered = monthLocalFormatter.format(new Date(version.createdAt));
  const written = version.authoredAt
    ? `written ${monthFormatter.format(new Date(version.authoredAt))} · `
    : '';
  return `v${version.number} · ${version.author.name} · ${written}entered ${entered}`;
}

const dayMonthFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "14 Oct" for a calendar date in the current year, "14 Oct 2025" otherwise. */
export function shortDay(date: string, now = new Date()): string {
  const at = new Date(`${date}T00:00:00.000Z`);
  const text = dayMonthFormatter.format(at);
  return at.getUTCFullYear() === now.getFullYear() ? text : `${text} ${at.getUTCFullYear()}`;
}

const UNITS =
  '(?:lbs?|oz|g|kg|ml|l|cups?|tsp|tbsp|teaspoons?|tablespoons?|cloves?|cans?|bunch(?:es)?|sprigs?|slices?|sticks?|pinch|dash|handful|knob|splash|large|medium|small|whole|heads?|stalks?|ears?|pieces?|pt|qt|gal)\\b\\.?';
const QUANTITY = new RegExp(
  `^((?:\\d+(?:[.,/]\\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞])(?:[\\s–-]*(?:\\d+(?:[.,/]\\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞]))*(?:\\s*×\\s*[\\d.]+\\s*(?:oz|g|ml|lb)?)?(?:\\s*\\(?[\\d.]+\\s*(?:oz|g|ml|lb)\\)?)?\\s*(?:${UNITS})?|a\\s+(?:handful|pinch|few|splash|knob|dash)(?:\\s+of)?)\\s+(.+)$`,
  'i',
);

/**
 * "1½ lb boneless thighs" → amount "1½ lb", item "boneless thighs", for the two-column
 * ingredient list of the recipe render. Lines are free text (the schema keeps amounts in
 * the text on purpose), so this is a reading aid, not data: a line that does not start
 * with a quantity keeps its whole text in the item column.
 */
export function splitIngredient(line: string): { amount: string; item: string } {
  const match = QUANTITY.exec(line.trim());
  if (!match) return { amount: '', item: line.trim() };
  return { amount: match[1]!.trim(), item: match[2]!.trim() };
}

/** The paragraphs before the body's first heading are the headnote; the rest is the method. */
export function splitHeadnote(body: string): { headnote: string; method: string } {
  const lines = body.split('\n');
  const at = lines.findIndex((line) => /^#{1,6}\s/.test(line));
  if (at <= 0) return { headnote: '', method: body };
  const headnote = lines.slice(0, at).join('\n').trim();
  return headnote
    ? { headnote, method: lines.slice(at).join('\n') }
    : { headnote: '', method: body };
}

/** A body that opens with its own "Method" heading would say it twice under the METHOD eyebrow. */
export function withoutMethodHeading(method: string): string {
  return method.replace(/^\s*#{1,6}\s*method\s*\n+/i, '');
}
