import { z } from 'zod';

/** Visibility rings, narrowest first. See docs/DESIGN.md "Auth and access rings". */
export const rings = ['me', 'group', 'public'] as const;
export const ringSchema = z.enum(rings);
export type Ring = z.infer<typeof ringSchema>;

/** Document types the registry knows. Phase 1 ships `recipe` only; later types append here. */
export const documentTypes = ['recipe'] as const;
export const documentTypeSchema = z.enum(documentTypes);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case only');

export const tagsSchema = z.array(z.string().min(1).max(40)).max(20);

/** Who authored a version: a person from `member` or an agent from `agent_token`. */
export const authorSchema = z.object({
  kind: z.enum(['member', 'agent']),
  id: z.uuid(),
  name: z.string(),
});
export type Author = z.infer<typeof authorSchema>;

/**
 * The document envelope: identity and policy, never content. Content lives in versions.
 * Mirrors the `document` table in apps/api/migrations.
 */
export const documentSchema = z.object({
  id: z.uuid(),
  type: documentTypeSchema,
  slug: slugSchema,
  ring: ringSchema,
  owner: z.uuid(),
  createdAt: z.iso.datetime(),
  currentVersionId: z.uuid().nullable(),
  tags: tagsSchema,
  deletedAt: z.iso.datetime().nullable(),
});
export type Document = z.infer<typeof documentSchema>;

/** Mirrors the `version` table. `frontmatter` is validated by the document type's schema. */
export const versionSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  number: z.number().int().positive(),
  body: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  author: authorSchema,
  createdAt: z.iso.datetime(),
  /** When the content was written, if that differs from when it entered The Keep. */
  authoredAt: z.iso.datetime().nullable(),
  summary: z.string().max(200),
});
export type Version = z.infer<typeof versionSchema>;
