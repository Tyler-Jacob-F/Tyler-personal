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

/**
 * Recipe frontmatter. Servings and times are optional: Tyler's recipes say "simmer
 * 2–3 hr", not "cook: 180", and an invented number is worse than none.
 */
export const recipeFrontmatterSchema = frontmatterBaseSchema.extend({
  servings: z.number().int().positive().max(200).optional(),
  prepMinutes: z.number().int().nonnegative().max(10_000).optional(),
  cookMinutes: z.number().int().nonnegative().max(10_000).optional(),
  ingredients: ingredientsSchema,
});
export type RecipeFrontmatter = z.infer<typeof recipeFrontmatterSchema>;

/** Every ingredient line, groups flattened, for search and quick display. */
export function ingredientLines(groups: IngredientGroup[]): string[] {
  return groups.flatMap((group) => group.items);
}
