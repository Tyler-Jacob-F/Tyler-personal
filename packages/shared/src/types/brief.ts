import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/** One section of a brief: a heading and markdown under it. */
export const briefSectionSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  body: z.string().max(20_000),
});
export type BriefSection = z.infer<typeof briefSectionSchema>;

/**
 * The morning brief (docs/DESIGN.md "Domain model"): `date` is the day it is for, as a
 * calendar date; `sections` carry the content. Written by an agent token with
 * `write:briefs`; the logged-in home renders today's. The title defaults from the date so
 * the writer need not invent one, and the version body is an optional lead paragraph.
 */
export const briefFrontmatterSchema = frontmatterBaseSchema
  .partial({ title: true })
  .extend({
    date: z.iso.date(),
    sections: z.array(briefSectionSchema).min(1).max(20),
  })
  .transform((brief) => ({ ...brief, title: brief.title ?? `Brief for ${brief.date}` }));
export type BriefFrontmatter = z.infer<typeof briefFrontmatterSchema>;
