import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/**
 * The weekly questions (docs/phases/04-group.md "Three new types"): `weekOf` is the
 * Thursday the questions are for, as a calendar date; the body is the questions in
 * markdown. Shown as "this week's" the way the morning page shows today's brief; old
 * ones kept. Written by a co-lead or by the `claude` token with `write:questions`.
 */
export const questionsFrontmatterSchema = frontmatterBaseSchema
  .partial({ title: true })
  .extend({ weekOf: z.iso.date() })
  .transform((q) => ({ ...q, title: q.title ?? `Questions for ${q.weekOf}` }));
export type QuestionsFrontmatter = z.infer<typeof questionsFrontmatterSchema>;

/** Days after its `weekOf` a questions document still counts as this week's. */
export const QUESTIONS_WINDOW_DAYS = 6;

/**
 * "This week's" questions: the newest document whose `weekOf` is no more than six days
 * ahead of today, so next week's can be posted early without taking the screen until
 * the week turns, and last week's stays up until the next is posted. Null when none
 * qualifies. Dates compare as calendar strings in the viewer's day.
 */
export function currentQuestions<T extends { weekOf: string }>(
  items: T[],
  today: string,
): T | null {
  const horizon = addDays(today, QUESTIONS_WINDOW_DAYS);
  const eligible = items.filter((q) => q.weekOf <= horizon);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, q) => (q.weekOf > best.weekOf ? q : best));
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
