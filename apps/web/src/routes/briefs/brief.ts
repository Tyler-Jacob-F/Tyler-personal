import { type BriefFrontmatter, briefFrontmatterSchema } from '@the-keep/shared';

export function briefOf(frontmatter: Record<string, unknown>): BriefFrontmatter | null {
  const parsed = briefFrontmatterSchema.safeParse(frontmatter);
  return parsed.success ? parsed.data : null;
}

/** Today as a calendar date in the viewer's own zone, the way a brief is dated. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "Thursday, October 30" for a brief's date. */
export function briefDay(date: string): string {
  return dayFormatter.format(new Date(`${date}T00:00:00.000Z`));
}
