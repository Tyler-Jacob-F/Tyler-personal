import { z } from 'zod';
import { agentScopeSchema, agentScopes } from './scopes.js';

/**
 * The secret an agent presents: `keep_` then 32 random bytes as base64url, 43 characters
 * after the prefix. Shown once at creation, stored as its SHA-256 hash, never recoverable
 * (docs/phases/02-agents.md "Decided (Oct 30, 2026)"). Fixed from the first token issued.
 */
export const AGENT_TOKEN_PREFIX = 'keep_';
export const AGENT_TOKEN_SECRET_BYTES = 32;
export const agentTokenSecretSchema = z
  .string()
  .regex(/^keep_[A-Za-z0-9_-]{43}$/, 'not an agent token');

/** Short, lowercase, hyphenated: `importer`, `cowork`, `brief-writer`. It is the author name history shows. */
export const agentTokenNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, digits and single hyphens');

/** Mirrors the `agent_token` table, the hash left out. */
export const agentTokenSchema = z.object({
  id: z.uuid(),
  name: agentTokenNameSchema,
  scopes: z.array(agentScopeSchema),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});
export type AgentToken = z.infer<typeof agentTokenSchema>;

/** At least one scope; duplicates collapse and the order is the brief's. */
export const scopeSetSchema = z
  .array(agentScopeSchema)
  .min(1)
  .max(agentScopes.length)
  .transform((scopes) => agentScopes.filter((scope) => scopes.includes(scope)));

export const createAgentTokenRequestSchema = z.object({
  name: agentTokenNameSchema,
  scopes: scopeSetSchema,
});
export type CreateAgentTokenRequest = z.input<typeof createAgentTokenRequestSchema>;

/** The one edit a token allows: its scope set. The name and the secret never change. */
export const updateAgentTokenRequestSchema = z.object({ scopes: scopeSetSchema });
export type UpdateAgentTokenRequest = z.input<typeof updateAgentTokenRequestSchema>;

/** The one response that ever carries the secret. */
export const createAgentTokenResponseSchema = z.object({
  token: agentTokenSchema,
  secret: agentTokenSecretSchema,
});
export type CreateAgentTokenResponse = z.infer<typeof createAgentTokenResponseSchema>;

export const listAgentTokensResponseSchema = z.object({
  items: z.array(agentTokenSchema),
});
export type ListAgentTokensResponse = z.infer<typeof listAgentTokensResponseSchema>;

const activityDocumentSchema = z.object({
  documentId: z.uuid(),
  documentType: z.string(),
  slug: z.string(),
  title: z.string(),
  token: z.object({ id: z.uuid(), name: z.string() }),
  createdAt: z.iso.datetime(),
});

/** One version an agent wrote, with enough of its document to show and link it. */
export const agentVersionActivitySchema = activityDocumentSchema.extend({
  kind: z.literal('version'),
  versionId: z.uuid(),
  number: z.number().int().positive(),
  summary: z.string(),
  authoredAt: z.iso.datetime().nullable(),
});
export type AgentVersionActivity = z.infer<typeof agentVersionActivitySchema>;

/** A tag set an agent changed (`set_tags`): no version, so it is its own row kind. */
export const agentTaggedActivitySchema = activityDocumentSchema.extend({
  kind: z.literal('tagged'),
  changeId: z.uuid(),
  tags: z.array(z.string()),
  previousTags: z.array(z.string()),
});
export type AgentTaggedActivity = z.infer<typeof agentTaggedActivitySchema>;

export const agentActivityItemSchema = z.discriminatedUnion('kind', [
  agentVersionActivitySchema,
  agentTaggedActivitySchema,
]);
export type AgentActivityItem = z.infer<typeof agentActivityItemSchema>;

export const listAgentActivityQuerySchema = z.object({
  /** How far back to look. */
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAgentActivityQuery = z.infer<typeof listAgentActivityQuerySchema>;

export const listAgentActivityResponseSchema = z.object({
  items: z.array(agentActivityItemSchema),
});
export type ListAgentActivityResponse = z.infer<typeof listAgentActivityResponseSchema>;
