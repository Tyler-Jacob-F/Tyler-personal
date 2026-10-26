import { z } from 'zod';
import {
  authorSchema,
  documentSchema,
  documentTypeSchema,
  tagsSchema,
  versionSchema,
} from './document.js';

/** The brief's normalized caller: `{ kind, id, role?, scopes? }`. */
export const callerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('member'), id: z.uuid(), role: z.enum(['admin', 'group']) }),
  z.object({ kind: z.literal('agent'), id: z.uuid(), scopes: z.array(z.string()) }),
]);
export type Caller = z.infer<typeof callerSchema>;

export const meResponseSchema = z.object({
  caller: callerSchema,
  email: z.email(),
  displayName: z.string(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** A document together with its current version, which is what every screen wants. */
export const documentWithVersionSchema = z.object({
  document: documentSchema,
  version: versionSchema,
});
export type DocumentWithVersion = z.infer<typeof documentWithVersionSchema>;

export const listDocumentsQuerySchema = z.object({
  type: documentTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

export const listDocumentsResponseSchema = z.object({
  items: z.array(documentWithVersionSchema),
});
export type ListDocumentsResponse = z.infer<typeof listDocumentsResponseSchema>;

/** Frontmatter is validated a second time against the type's own schema, server-side. */
/** Accepts a date only, or a full timestamp; stored as the start of that day in UTC when a date. */
export const authoredAtSchema = z
  .union([z.iso.datetime(), z.iso.date().transform((d) => `${d}T00:00:00.000Z`)])
  .nullable()
  .optional();

export const createDocumentRequestSchema = z.object({
  type: documentTypeSchema,
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string().max(200_000),
  summary: z.string().trim().max(200).default(''),
  tags: tagsSchema.default([]),
  authoredAt: authoredAtSchema,
});
export type CreateDocumentRequest = z.infer<typeof createDocumentRequestSchema>;

export const createVersionRequestSchema = z.object({
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string().max(200_000),
  summary: z.string().trim().max(200).default(''),
  authoredAt: authoredAtSchema,
});
export type CreateVersionRequest = z.infer<typeof createVersionRequestSchema>;

export const listVersionsResponseSchema = z.object({
  items: z.array(versionSchema),
});
export type ListVersionsResponse = z.infer<typeof listVersionsResponseSchema>;

export const diffQuerySchema = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
});
export type DiffQuery = z.infer<typeof diffQuerySchema>;

export const frontmatterChangeSchema = z.object({
  key: z.string(),
  change: z.enum(['added', 'removed', 'changed']),
  from: z.unknown().optional(),
  to: z.unknown().optional(),
});
export type FrontmatterChange = z.infer<typeof frontmatterChangeSchema>;

const versionRefSchema = z.object({
  number: z.number().int().positive(),
  summary: z.string(),
  author: authorSchema,
  createdAt: z.iso.datetime(),
  authoredAt: z.iso.datetime().nullable(),
});

/** One ingredient line in a group diff. */
export const ingredientLineChangeSchema = z.object({
  kind: z.enum(['added', 'removed', 'same']),
  text: z.string(),
});

/** A group of ingredients diffed line by line; groups match on heading. */
export const ingredientGroupDiffSchema = z.object({
  heading: z.string().nullable(),
  change: z.enum(['added', 'removed', 'changed', 'same']),
  lines: z.array(ingredientLineChangeSchema),
});
export type IngredientGroupDiff = z.infer<typeof ingredientGroupDiffSchema>;

export const diffResponseSchema = z.object({
  from: versionRefSchema,
  to: versionRefSchema,
  /** Unified diff of `body`, as the `diff` package's createPatch emits it. */
  body: z.string(),
  /** Key-level changes to frontmatter, `ingredients` excluded. */
  frontmatter: z.array(frontmatterChangeSchema),
  /** Present when the type has ingredient groups: a line diff per group. */
  ingredients: z.array(ingredientGroupDiffSchema).optional(),
});
export type DiffResponse = z.infer<typeof diffResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
