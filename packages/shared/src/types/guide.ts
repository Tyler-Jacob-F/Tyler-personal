import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/**
 * One line of a responsive prayer: who says it. The page sets a leader's line in `text`
 * and the people's in bold `text-strong` (docs/phases/04-group.md "The refresh").
 */
export const voiceSchema = z.enum(['leader', 'people']);
export type Voice = z.infer<typeof voiceSchema>;

export const voiceLineSchema = z.object({
  voice: voiceSchema,
  text: z.string().trim().min(1).max(2000),
});
export type VoiceLine = z.infer<typeof voiceLineSchema>;

/** A scripture reference as the printed guide writes it: "Ephesians 1:15–23", "Psalm 122". */
export const referenceSchema = z.string().trim().min(1).max(80);

/**
 * The week's guide (docs/phases/04-group.md "The refresh"): what changes from week to
 * week in Redeemer's printed guide, and nothing that repeats. `weekOf` is the Thursday it
 * is for and picks "this week's"; `series` and `week` make the eyebrow ("Sanctuary · Week
 * four"); `opening` and `closing` are the responsive prayers and collects in order;
 * `readings` are references the page resolves to text; `reflection` is the one sentence
 * over the numbered `questions`; `source` is the credit line. The fixed liturgy that
 * repeats every week (the collect before the reading, the songbook line, the Lord's
 * Prayer, the final collect) lives on the `liturgy` document and is never re-entered.
 * Written by a co-lead or by the `claude` token with `write:guides`.
 */
export const guideFrontmatterSchema = frontmatterBaseSchema.extend({
  weekOf: z.iso.date(),
  series: z.string().trim().min(1).max(80).optional(),
  week: z.number().int().min(1).max(99).optional(),
  opening: z.array(voiceLineSchema).max(20).default([]),
  readings: z.array(referenceSchema).max(8).default([]),
  reflection: z.string().trim().min(1).max(500).optional(),
  questions: z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
  closing: z.array(voiceLineSchema).max(30).default([]),
  source: z.string().trim().min(1).max(200).optional(),
});
export type GuideFrontmatter = z.infer<typeof guideFrontmatterSchema>;
export type GuideInput = z.input<typeof guideFrontmatterSchema>;

/** Days after its `weekOf` a guide still counts as this week's. */
export const WEEK_WINDOW_DAYS = 6;

/**
 * "This week's": the newest document whose `weekOf` is no more than six days ahead of
 * today, so next week's can be posted early without taking the screen until the week
 * turns, and last week's stays up until the next is posted. Null when none qualifies.
 * Dates compare as calendar strings in the group's own day.
 */
export function currentWeek<T extends { weekOf: string }>(items: T[], today: string): T | null {
  const horizon = addDays(today, WEEK_WINDOW_DAYS);
  const eligible = items.filter((q) => q.weekOf <= horizon);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, q) => (q.weekOf > best.weekOf ? q : best));
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
