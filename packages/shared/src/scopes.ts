import { z } from 'zod';
import type { DocumentType } from './document.js';

/**
 * Agent scopes are verbs on types (docs/DESIGN.md "Auth and access rings"). The list is
 * the brief's, exactly; a token carries a subset and nothing here grants promotion,
 * member management or token management.
 */
export const agentScopes = [
  'read:documents',
  'write:recipes',
  'write:briefs',
  'write:notes',
  'read:reading',
] as const;
export const agentScopeSchema = z.enum(agentScopes);
export type AgentScope = z.infer<typeof agentScopeSchema>;

/**
 * Which scope lets an agent write a document of each type. Total over the registry on
 * purpose: adding a type means deciding whether agents may write it (`null` says no).
 */
export const writeScopeByType: Record<DocumentType, AgentScope | null> = {
  recipe: 'write:recipes',
};

export function writeScopeFor(type: DocumentType): AgentScope | null {
  return writeScopeByType[type];
}
