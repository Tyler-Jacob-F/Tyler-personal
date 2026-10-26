import { z } from 'zod';

/**
 * Every document type's frontmatter carries a title; the slug derives from it and the
 * list screens show it. Type schemas extend this.
 */
export const frontmatterBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
export type FrontmatterBase = z.infer<typeof frontmatterBaseSchema>;
