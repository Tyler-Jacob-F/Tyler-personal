import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/** One thing to bring or do, and how many may take it. The label is the slot's identity. */
export const signupSlotSchema = z.object({
  label: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(50),
});
export type SignupSlot = z.infer<typeof signupSlotSchema>;

/**
 * A sign-up (docs/DESIGN.md "Domain model"; docs/phases/04-group.md "Three new types"):
 * the Thursday it is for, its slots, and when it closes. Claims are rows in
 * `signup_claim`, keyed by the slot's label, never versions: renaming a slot after people
 * have claimed it orphans those claims, so add a slot rather than rename one. Written by
 * the admin and co-leads; no agent scope writes a signup (`write:signups` waits).
 */
export const signupFrontmatterSchema = frontmatterBaseSchema.extend({
  date: z.iso.date(),
  slots: z
    .array(signupSlotSchema)
    .min(1)
    .max(30)
    .refine((slots) => new Set(slots.map((s) => s.label.toLowerCase())).size === slots.length, {
      message: 'slot labels must be distinct',
    }),
  /** After this, claims are neither taken nor released by members; co-leads may still fix the sheet. */
  closesAt: z.iso.datetime().optional(),
});
export type SignupFrontmatter = z.infer<typeof signupFrontmatterSchema>;

/** Whether the sheet is still open to members at `now`. Open when it has no `closesAt`. */
export function signupOpen(frontmatter: { closesAt?: string }, now: Date): boolean {
  return !frontmatter.closesAt || new Date(frontmatter.closesAt).getTime() > now.getTime();
}
