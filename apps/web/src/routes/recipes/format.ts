import { recipeFrontmatterSchema } from '@the-keep/shared';

export function titleOf(frontmatter: Record<string, unknown>): string {
  const title = frontmatter.title;
  return typeof title === 'string' && title ? title : 'Untitled';
}

export function recipeOf(frontmatter: Record<string, unknown>) {
  const parsed = recipeFrontmatterSchema.safeParse(frontmatter);
  return parsed.success ? parsed.data : null;
}

const formatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function when(iso: string): string {
  return formatter.format(new Date(iso));
}
