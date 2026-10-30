import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

const ingredientLineSchema = z.string().trim().min(1).max(200);

/**
 * Ingredients come in groups ("Meats (3 lb total)", "Core spice blend"), because that is
 * how recipes are written. Each line stays free text ("1½ Tbsp toasted cumin"): parsing
 * quantities is deferred until five versions of chili ask for it.
 */
export const ingredientGroupSchema = z.object({
  heading: z.string().trim().min(1).max(120).nullable().default(null),
  items: z.array(ingredientLineSchema).min(1).max(100),
});
export type IngredientGroup = z.infer<typeof ingredientGroupSchema>;

const ingredientGroupsSchema = z.array(ingredientGroupSchema).min(1).max(30);

/**
 * Versions saved before groups existed hold a flat list of lines. Stored frontmatter is
 * re-validated on every read, so the schema lifts that shape into one unnamed group
 * instead of failing it.
 */
const ingredientsSchema = z.preprocess(
  (value) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? [{ heading: null, items: value }]
      : value,
  ingredientGroupsSchema,
);

const minutes = z.number().int().nonnegative().max(10_000);

/**
 * "Proven" is a fact about a version: this one has been cooked (docs/DESIGN-VALUES.md
 * "Recipe taxonomy"). The screen shows a check, the cook count and the last date; absent
 * means untested. A bare `true` from a writer who only knows that much becomes one cook;
 * `false` means untested.
 */
export const provenSchema = z.preprocess(
  (value) =>
    value === true ? { count: 1 } : value === false || value === null ? undefined : value,
  z
    .object({
      count: z.number().int().min(1).max(10_000),
      /** The last day it was cooked, as a calendar date. */
      last: z.iso.date().optional(),
    })
    .optional(),
);
export type Proven = NonNullable<z.infer<typeof provenSchema>>;

/**
 * Recipe frontmatter, with the fields of the contract: active and total minutes, serves,
 * provenance and proven. Every number is optional: Tyler's recipes say "simmer 2–3 hr",
 * not "total: 180", and an invented number is worse than none. Facets and flags are not
 * here; they are tags on the document, validated by recipeTagsSchema.
 */
export const recipeFrontmatterSchema = frontmatterBaseSchema
  .extend({
    /** Hands-on time. */
    activeMinutes: minutes.optional(),
    /** Start to table, the active time included. */
    totalMinutes: minutes.optional(),
    serves: z.number().int().positive().max(200).optional(),
    /** Where it came from: "Steve's card, 2014", "adapted from Kenji". */
    provenance: z.string().trim().min(1).max(300).optional(),
    proven: provenSchema,
    ingredients: ingredientsSchema,
  })
  .refine(
    (recipe) =>
      recipe.activeMinutes === undefined ||
      recipe.totalMinutes === undefined ||
      recipe.activeMinutes <= recipe.totalMinutes,
    { path: ['activeMinutes'], message: 'active minutes cannot exceed total minutes' },
  );
export type RecipeFrontmatter = z.infer<typeof recipeFrontmatterSchema>;

/** Every ingredient line, groups flattened, for search and quick display. */
export function ingredientLines(groups: IngredientGroup[]): string[] {
  return groups.flatMap((group) => group.items);
}
