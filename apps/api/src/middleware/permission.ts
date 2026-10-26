import type { Caller, Ring } from '@the-keep/shared';
import { forbidden } from '../lib/http.js';

export type Action = 'read' | 'write' | 'delete';

/**
 * Permission: "what may they see or do". Knows rings, roles and agent scopes; nothing
 * about Cognito or tokens (docs/DESIGN.md "Auth and access rings").
 *
 * - admin: everything.
 * - group: read `group` and `public`.
 * - agent: only the scopes on the token, and never past `me`'s owner-level rights.
 * Promotion is not an action here on purpose: it is a human click in the admin UI.
 */
export function can(caller: Caller, action: Action, ring: Ring): boolean {
  if (caller.kind === 'member') {
    if (caller.role === 'admin') return true;
    return action === 'read' && (ring === 'group' || ring === 'public');
  }
  if (action === 'delete') return false;
  const scope = action === 'read' ? 'read:documents' : 'write:documents';
  return caller.scopes.includes(scope);
}

/** Throw a 403 unless the caller may take this action on a document in this ring. */
export function authorize(caller: Caller, action: Action, ring: Ring): void {
  if (!can(caller, action, ring))
    throw forbidden(`cannot ${action} a document in the ${ring} ring`);
}
