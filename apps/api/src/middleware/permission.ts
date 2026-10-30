import { type Caller, type DocumentType, type Ring, writeScopeFor } from '@the-keep/shared';
import { forbidden } from '../lib/http.js';

export type Action = 'read' | 'write' | 'delete';

/** What permission needs to know about a document: where it sits and what it is. */
export interface Target {
  ring: Ring;
  type: DocumentType;
}

/**
 * Permission: "what may they see or do". Knows rings, roles and agent scopes; nothing
 * about Cognito or tokens (docs/DESIGN.md "Auth and access rings").
 *
 * - admin: everything.
 * - group: read `group` and `public`.
 * - agent: `read:documents` reads any ring; a write needs the scope for the document's
 *   type (`write:recipes` for a recipe); delete is never an agent's to do.
 * Promotion is not an action here on purpose: it is a human click in the admin UI.
 */
export function can(caller: Caller, action: Action, target: Target): boolean {
  if (caller.kind === 'member') {
    if (caller.role === 'admin') return true;
    return action === 'read' && (target.ring === 'group' || target.ring === 'public');
  }
  if (action === 'read') return caller.scopes.includes('read:documents');
  if (action === 'write') {
    const scope = writeScopeFor(target.type);
    return scope !== null && caller.scopes.includes(scope);
  }
  return false;
}

/** Throw a 403 unless the caller may take this action on this document. */
export function authorize(caller: Caller, action: Action, target: Target): void {
  if (!can(caller, action, target))
    throw forbidden(`cannot ${action} a ${target.type} in the ${target.ring} ring`);
}
