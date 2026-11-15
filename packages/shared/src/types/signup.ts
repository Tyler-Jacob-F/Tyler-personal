import { z } from 'zod';
import { frontmatterBaseSchema } from './base.js';

/**
 * What a slot asks of the person who takes it. `food` asks what they are bringing and what
 * it contains; `item` asks only what; a slot with no kind takes a name and nothing more
 * (a host, a wrapped book whose title is the surprise).
 */
export const slotKinds = ['food', 'item'] as const;
export const slotKindSchema = z.enum(slotKinds);
export type SlotKind = z.infer<typeof slotKindSchema>;

/**
 * What a dish may contain, said by its cook: the allergies the group has, no more
 * (Tyler, Nov 15, 2026). "Contains", never "free of": a home kitchen can say what went in,
 * and cannot promise what did not. A new allergy is a new entry here; the column is text.
 */
export const allergens = ['gluten', 'dairy', 'nuts', 'soy', 'fish', 'poultry'] as const;
export const allergenSchema = z.enum(allergens);
export type Allergen = z.infer<typeof allergenSchema>;

/** A set of allergens in the list's own order, each once. */
export const containsSchema = z
  .array(allergenSchema)
  .max(allergens.length)
  .transform((given) => allergens.filter((a) => given.includes(a)));

/** One thing to bring or do, and how many may take it. The label is the slot's identity. */
export const signupSlotSchema = z.object({
  label: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(50),
  kind: slotKindSchema.optional(),
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
