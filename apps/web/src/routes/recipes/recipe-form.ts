import {
  facetTag,
  flagTag,
  type IngredientGroup,
  ingredientGroupSchema,
  type RecipeFacet,
  recipeFacetNames,
  recipeFacets,
  type RecipeFlag,
  recipeFlags,
  type RecipeFrontmatter,
  recipeFrontmatterSchema,
  recipeTagsOf,
  recipeTagsSchema,
} from '@the-keep/shared';
import { z } from 'zod';

/**
 * The form's view of the shared recipe schema: numbers arrive as input strings (blank
 * allowed), ingredients as text with a line ending in ":" starting a group, facets as one
 * select each and flags as checkboxes; the output is exactly what the API takes, the
 * frontmatter and the document's tags apart.
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

const optionalDate = (message: string) =>
  z
    .string()
    .trim()
    .refine((d) => d === '' || /^\d{4}-\d{2}-\d{2}$/.test(d), message)
    .transform((d) => (d === '' ? null : d));

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

const facetFields = Object.fromEntries(
  recipeFacetNames.map((facet) => [
    facet,
    z.string().refine((v) => v === '' || (recipeFacets[facet] as readonly string[]).includes(v)),
  ]),
) as Record<RecipeFacet, z.ZodString>;

export const recipeFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(200, 'Keep the title short.'),
    activeMinutes: optionalWholeNumber('Active minutes', 0),
    totalMinutes: optionalWholeNumber('Total minutes', 0),
    serves: optionalWholeNumber('Serves', 1),
    provenance: z.string().trim().max(300, 'Keep provenance to a line.'),
    provenCount: optionalWholeNumber('Times cooked', 1),
    provenLast: optionalDate('Use a date like 2026-02-01.'),
    facets: z.object(facetFields),
    flags: z.array(z.enum(recipeFlags)),
    ingredientsText: z
      .string()
      .transform(parseIngredientGroups)
      .refine((groups) => groups.length > 0, 'List at least one ingredient, one per line.')
      .refine(
        (groups) => z.array(ingredientGroupSchema).max(30).safeParse(groups).success,
        'Keep each ingredient under 200 characters and the list under 30 groups.',
      ),
    body: z.string().max(200_000),
    summary: z.string().trim().max(500, 'Keep the summary to one line.'),
    /** A calendar date, or blank: when the recipe was written, if not today. */
    authoredAt: optionalDate('Use a date like 2025-01-31.'),
  })
  .refine(
    (v) =>
      v.activeMinutes === undefined ||
      v.totalMinutes === undefined ||
      v.activeMinutes <= v.totalMinutes,
    { path: ['activeMinutes'], message: 'Active minutes cannot exceed total minutes.' },
  )
  .refine((v) => v.provenCount !== undefined || v.provenLast === null, {
    path: ['provenCount'],
    message: 'Say how many times it has been cooked.',
  });

export type RecipeFormInput = z.input<typeof recipeFormSchema>;
export type RecipeFormOutput = z.output<typeof recipeFormSchema>;

export function toFrontmatter(values: RecipeFormOutput): RecipeFrontmatter {
  return recipeFrontmatterSchema.parse({
    title: values.title,
    activeMinutes: values.activeMinutes,
    totalMinutes: values.totalMinutes,
    serves: values.serves,
    provenance: values.provenance || undefined,
    proven:
      values.provenCount === undefined
        ? undefined
        : { count: values.provenCount, last: values.provenLast ?? undefined },
    ingredients: values.ingredientsText,
  });
}

/** The document's tags from the form: facets, then flags, then free tags it already had. */
export function toTags(values: RecipeFormOutput, keep: string[] = []): string[] {
  const { free } = recipeTagsOf(keep);
  return recipeTagsSchema.parse([
    ...recipeFacetNames.flatMap((facet) => {
      const value = values.facets[facet];
      return value ? [facetTag(facet, value)] : [];
    }),
    ...values.flags.map(flagTag),
    ...free,
  ]);
}

const emptyFacets = Object.fromEntries(recipeFacetNames.map((f) => [f, ''])) as Record<
  RecipeFacet,
  string
>;

export const emptyRecipe: RecipeFormInput = {
  title: '',
  activeMinutes: '',
  totalMinutes: '',
  serves: '',
  provenance: '',
  provenCount: '',
  provenLast: '',
  facets: emptyFacets,
  flags: [],
  ingredientsText: '',
  body: '',
  summary: '',
  authoredAt: '',
};

const show = (n: number | undefined) => (n === undefined ? '' : String(n));

export function fromVersion(
  frontmatter: Record<string, unknown>,
  body: string,
  tags: string[] = [],
): RecipeFormInput {
  const parsed = recipeFrontmatterSchema.safeParse(frontmatter);
  const { facets, flags } = recipeTagsOf(tags);
  const withTags = {
    facets: { ...emptyFacets, ...facets },
    flags: flags as RecipeFlag[],
  };
  if (!parsed.success) return { ...emptyRecipe, ...withTags, body };
  const r = parsed.data;
  return {
    title: r.title,
    activeMinutes: show(r.activeMinutes),
    totalMinutes: show(r.totalMinutes),
    serves: show(r.serves),
    provenance: r.provenance ?? '',
    provenCount: show(r.proven?.count),
    provenLast: r.proven?.last ?? '',
    ...withTags,
    ingredientsText: formatIngredientGroups(r.ingredients),
    body,
    summary: '',
    authoredAt: '',
  };
}

/** Same set, order aside. */
export function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
}
