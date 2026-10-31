import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/**
 * A meeting on the group's calendar (docs/phases/04-group.md "Three new types"): the
 * date, a time, a place, a line of notes. Hand-kept; the calendar is the list of upcoming
 * events. Written by a co-lead or by the `claude` token with `write:events`; the body is
 * optional longer markdown.
 */
export const eventFrontmatterSchema = frontmatterBaseSchema.extend({
  date: z.iso.date(),
  /** 24-hour `HH:MM` in the group's own time; absent for an all-day note. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM')
    .optional(),
  place: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().min(1).max(500).optional(),
});
export type EventFrontmatter = z.infer<typeof eventFrontmatterSchema>;
