import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/**
 * Recipe frontmatter. Ingredients are plain lines ("2 lb ground chuck") on purpose:
 * the structured ingredient diff is deferred until five versions of chili say otherwise
 * (docs/DESIGN.md "Open questions").
 */
export const recipeFrontmatterSchema = frontmatterBaseSchema.extend({
  servings: z.number().int().positive().max(200),
  prepMinutes: z.number().int().nonnegative().max(10_000),
  cookMinutes: z.number().int().nonnegative().max(10_000),
  ingredients: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
});
export type RecipeFrontmatter = z.infer<typeof recipeFrontmatterSchema>;
