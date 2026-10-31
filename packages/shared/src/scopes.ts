import { z } from 'zod';
import type { DocumentType } from './document.js';

/**
 * Agent scopes are verbs on types (docs/DESIGN.md "Auth and access rings"). The list is
 * the brief's plus the two the Group phase added for the `claude` token to keep the
 * calendar and post the questions (docs/phases/04-group.md); a token carries a subset and
 * nothing here grants promotion, member management, token management or a sign-up.
 */
export const agentScopes = [
  'read:documents',
  'write:recipes',
  'write:briefs',
  'write:notes',
  'read:reading',
  'write:events',
  'write:questions',
] as const;
export const agentScopeSchema = z.enum(agentScopes);
export type AgentScope = z.infer<typeof agentScopeSchema>;

/**
 * Which scope lets an agent write a document of each type. Total over the registry on
 * purpose: adding a type means deciding whether agents may write it (`null` says no).
 */
export const writeScopeByType: Record<DocumentType, AgentScope | null> = {
  recipe: 'write:recipes',
  brief: 'write:briefs',
  questions: 'write:questions',
  // No agent writes a sign-up until one needs to (`write:signups` waits, per the directive).
  signup: null,
  event: 'write:events',
};

export function writeScopeFor(type: DocumentType): AgentScope | null {
  return writeScopeByType[type];
}
