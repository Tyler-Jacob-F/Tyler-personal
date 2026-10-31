import { recipeFrontmatterSchema } from '@the-keep/shared';
import { frontmatterOf } from '@/lib/frontmatter';

export const recipeOf = frontmatterOf(recipeFrontmatterSchema);

/** "40 min", "2 h", "2 h 30 min", in tabular figures where it is shown. */
export function minutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
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
