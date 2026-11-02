import { type RecipeFrontmatter, recipeFrontmatterSchema, type Version } from '@the-keep/shared';
import { frontmatterOf, titleOf } from '@/lib/frontmatter';
import { plainText } from '@/lib/share';

export const recipeOf = frontmatterOf(recipeFrontmatterSchema);

/** "40 min", "2 h", "2 h 30 min", in tabular figures where it is shown. */
export function minutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The facts line under the title: Active, Total and Serves, in that order, only the ones the version has. */
export function recipeFacts(r: RecipeFrontmatter | null): Array<[string, string]> {
  const facts: Array<[string, string]> = [];
  if (r?.activeMinutes !== undefined) facts.push(['Active', minutes(r.activeMinutes)]);
  if (r?.totalMinutes !== undefined) facts.push(['Total', minutes(r.totalMinutes)]);
  if (r?.serves !== undefined) facts.push(['Serves', String(r.serves)]);
  return facts;
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

/** A body whose method opens by repeating the recipe's title would say it twice in a message. */
function withoutTitleHeading(method: string, title: string): string {
  const lines = method.split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first < 0) return method;
  const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(lines[first]!);
  if (!heading || heading[1]!.trim().toLowerCase() !== title.trim().toLowerCase()) return method;
  return lines.slice(first + 1).join('\n');
}

/**
 * The recipe as plain text, the way it reads in a text message or a mail body: title,
 * headnote, provenance, the facts line, ingredient groups as dashed lists, the method with
 * its markdown marks removed. Facets stay behind; they are the site's, not the recipe's.
 */
export function recipeText(version: Version): string {
  const title = titleOf(version.frontmatter);
  const r = recipeOf(version.frontmatter);
  const { headnote, method } = splitHeadnote(version.body);
  const parts: string[] = [title];
  if (headnote) parts.push(plainText(headnote));
  if (r?.provenance) parts.push(`Provenance · ${r.provenance}`);
  const facts = recipeFacts(r);
  if (facts.length > 0) parts.push(facts.map(([label, value]) => `${label} ${value}`).join(' · '));
  if (r) {
    const groups = r.ingredients.map((group) =>
      [group.heading, ...group.items.map((line) => `- ${line}`)].filter(Boolean).join('\n'),
    );
    parts.push(['INGREDIENTS', ...groups].join('\n\n'));
  }
  const steps = plainText(withoutTitleHeading(withoutMethodHeading(method), title));
  if (steps) parts.push(`METHOD\n\n${steps}`);
  return `${parts.join('\n\n')}\n`;
}
