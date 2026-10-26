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

const dayFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

/** A calendar date for `authoredAt`, which carries no meaningful time of day. */
export function whenDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

/** "written Nov 6, 2023 · entered Oct 26, 2026" when they differ, else the entry time alone. */
export function dates(version: { createdAt: string; authoredAt: string | null }): string {
  return version.authoredAt
    ? `written ${whenDay(version.authoredAt)} · entered ${when(version.createdAt)}`
    : when(version.createdAt);
}
