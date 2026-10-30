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

export const createAgentTokenRequestSchema = z.object({
  name: agentTokenNameSchema,
  /** At least one scope; duplicates collapse and the order is the brief's. */
  scopes: z
    .array(agentScopeSchema)
    .min(1)
    .max(agentScopes.length)
    .transform((scopes) => agentScopes.filter((scope) => scopes.includes(scope))),
});
export type CreateAgentTokenRequest = z.input<typeof createAgentTokenRequestSchema>;

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
