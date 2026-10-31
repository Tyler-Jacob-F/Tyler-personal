import { z } from 'zod';
import type { DocumentType } from './document.js';

/**
 * Agent scopes are verbs on types (docs/DESIGN.md "Auth and access rings"). The list is
 * the brief's plus the four the Group phase added (docs/phases/04-group.md): `write:events`
 * and `write:questions` for the `claude` token to keep the calendar and post the questions;
 * `write:signups` (a sheet and the names on its slots) and `read:members` (the directory,
 * so a name can be matched to a row) for the one-time seed from the Google Sheet, removed
 * from the token once it is done. A token carries a subset and nothing here grants
 * promotion, member management or token management.
 */
export const agentScopes = [
  'read:documents',
  'write:recipes',
  'write:briefs',
  'write:notes',
  'read:reading',
  'write:events',
  'write:questions',
  'write:signups',
  'read:members',
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
  signup: 'write:signups',
  event: 'write:events',
};

export function writeScopeFor(type: DocumentType): AgentScope | null {
  return writeScopeByType[type];
}
