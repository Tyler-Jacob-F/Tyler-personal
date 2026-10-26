import { type RecipeFrontmatter, recipeFrontmatterSchema } from '@the-keep/shared';
import { z } from 'zod';

/**
 * The form's view of the shared recipe schema: numbers arrive as input strings and
 * ingredients as one-per-line text; the output is exactly what the API takes.
 */
const wholeNumber = (label: string, min: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((text) => Number.isInteger(Number(text)), `${label} must be a whole number.`)
    .refine((text) => Number(text) >= min, `${label} must be at least ${min}.`)
    .transform((text) => Number(text));

export const recipeFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').pipe(recipeFrontmatterSchema.shape.title),
  servings: wholeNumber('Servings', 1),
  prepMinutes: wholeNumber('Prep minutes', 0),
  cookMinutes: wholeNumber('Cook minutes', 0),
  ingredientsText: z
    .string()
    .transform((text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .refine((lines) => lines.length > 0, 'List at least one ingredient, one per line.')
    .pipe(recipeFrontmatterSchema.shape.ingredients),
  body: z.string().max(200_000),
  summary: z.string().trim().max(200, 'Keep the summary to one line.'),
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
  servings: '4',
  prepMinutes: '0',
  cookMinutes: '0',
  ingredientsText: '',
  body: '',
  summary: '',
};

export function fromVersion(frontmatter: Record<string, unknown>, body: string): RecipeFormInput {
  const parsed = recipeFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) return { ...emptyRecipe, body };
  const r = parsed.data;
  return {
    title: r.title,
    servings: String(r.servings),
    prepMinutes: String(r.prepMinutes),
    cookMinutes: String(r.cookMinutes),
    ingredientsText: r.ingredients.join('\n'),
    body,
    summary: '',
  };
}
