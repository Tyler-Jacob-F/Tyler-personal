import {
  type IngredientGroup,
  ingredientGroupSchema,
  type RecipeFrontmatter,
  recipeFrontmatterSchema,
} from '@the-keep/shared';
import { z } from 'zod';

/**
 * The form's view of the shared recipe schema: numbers arrive as input strings (blank
 * allowed), ingredients as text with a line ending in ":" starting a group; the output is
 * exactly what the API takes.
 */
const optionalWholeNumber = (label: string, min: number) =>
  z
    .string()
    .trim()
    .refine(
      (text) => text === '' || Number.isInteger(Number(text)),
      `${label} must be a whole number.`,
    )
    .refine((text) => text === '' || Number(text) >= min, `${label} must be at least ${min}.`)
    .transform((text) => (text === '' ? undefined : Number(text)));

/** "Meats (3 lb total):" starts a group; lines before any heading form an unnamed group. */
export function parseIngredientGroups(text: string): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  let current: IngredientGroup | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.endsWith(':') && line.length > 1) {
      current = { heading: line.slice(0, -1).trim(), items: [] };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = { heading: null, items: [] };
      groups.push(current);
    }
    current.items.push(line);
  }
  return groups.filter((group) => group.items.length > 0);
}

export function formatIngredientGroups(groups: IngredientGroup[]): string {
  return groups
    .map((group) => [...(group.heading ? [`${group.heading}:`] : []), ...group.items].join('\n'))
    .join('\n');
}

export const recipeFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').pipe(recipeFrontmatterSchema.shape.title),
  servings: optionalWholeNumber('Servings', 1),
  prepMinutes: optionalWholeNumber('Prep minutes', 0),
  cookMinutes: optionalWholeNumber('Cook minutes', 0),
  ingredientsText: z
    .string()
    .transform(parseIngredientGroups)
    .refine((groups) => groups.length > 0, 'List at least one ingredient, one per line.')
    .refine(
      (groups) => z.array(ingredientGroupSchema).max(30).safeParse(groups).success,
      'Keep each ingredient under 200 characters and the list under 30 groups.',
    ),
  body: z.string().max(200_000),
  summary: z.string().trim().max(200, 'Keep the summary to one line.'),
  /** A calendar date, or blank: when the recipe was written, if not today. */
  authoredAt: z
    .string()
    .trim()
    .refine((d) => d === '' || /^\d{4}-\d{2}-\d{2}$/.test(d), 'Use a date like 2025-01-31.')
    .transform((d) => (d === '' ? null : d)),
});

export type RecipeFormInput = z.input<typeof recipeFormSchema>;
export type RecipeFormOutput = z.output<typeof recipeFormSchema>;

export function toFrontmatter(values: RecipeFormOutput): RecipeFrontmatter {
  return recipeFrontmatterSchema.parse({
    title: values.title,
    servings: values.servings,
    prepMinutes: values.prepMinutes,
    cookMinutes: values.cookMinutes,
    ingredients: values.ingredientsText,
  });
}

export const emptyRecipe: RecipeFormInput = {
  title: '',
  servings: '',
  prepMinutes: '',
  cookMinutes: '',
  ingredientsText: '',
  body: '',
  summary: '',
  authoredAt: '',
};

const show = (n: number | undefined) => (n === undefined ? '' : String(n));

export function fromVersion(frontmatter: Record<string, unknown>, body: string): RecipeFormInput {
  const parsed = recipeFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) return { ...emptyRecipe, body };
  const r = parsed.data;
  return {
    title: r.title,
    servings: show(r.servings),
    prepMinutes: show(r.prepMinutes),
    cookMinutes: show(r.cookMinutes),
    ingredientsText: formatIngredientGroups(r.ingredients),
    body,
    summary: '',
    authoredAt: '',
  };
}
