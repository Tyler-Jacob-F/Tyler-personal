import type { z } from 'zod';

/** A document's stored frontmatter as its type's shape, or null when it no longer fits. */
export function frontmatterOf<T>(schema: z.ZodType<T>) {
  return (frontmatter: unknown): T | null => {
    const parsed = schema.safeParse(frontmatter);
    return parsed.success ? parsed.data : null;
  };
}

/** The title every type's frontmatter carries, for lists and headings. */
export function titleOf(frontmatter: Record<string, unknown>): string {
  const title = frontmatter.title;
  return typeof title === 'string' && title ? title : 'Untitled';
}
