import {
  type Caller,
  type DocumentType,
  type Ring,
  schemaFor,
  writeScopeFor,
} from '@the-keep/shared';

type MemberCaller = Extract<Caller, { kind: 'member' }>;
import { forbidden } from '../lib/http.js';

export type Action = 'read' | 'write' | 'delete';

/** What permission needs to know about a document: where it sits and what it is. */
export interface Target {
  ring: Ring;
  type: DocumentType;
}

/** The group's own types: the ones that start in the `group` ring. Co-leads write these and no others. */
export function isGroupType(type: DocumentType): boolean {
  return schemaFor(type).defaultRing === 'group';
}

const readsGroupAndPublic = (ring: Ring) => ring === 'group' || ring === 'public';

/**
 * Permission: "what may they see or do". Knows rings, roles and agent scopes; nothing
 * about Cognito, tokens or devices (docs/DESIGN.md "Auth and access rings";
 * docs/phases/04-group.md "Four kinds of caller").
 *
 * - admin: everything.
 * - colead: read `group` and `public`; write and delete the group's own types in the
 *   `group` ring (sign-ups, events, questions), nothing of Tyler's.
 * - group role (a signed-in member who is not a co-lead; none exist today): read `group`
 *   and `public`.
 * - a device, member or guest: read `group` and `public`. Devices never write a document;
 *   what they do is claim a name and take a slot (see canClaim and canMember).
 * - agent: `read:documents` reads any ring; a write needs the scope for the document's
 *   type (`write:recipes` for a recipe); delete is never an agent's to do.
 * Promotion is not an action here on purpose: it is a human click in the admin UI.
 */
export function can(caller: Caller, action: Action, target: Target): boolean {
  if (caller.kind === 'member') {
    if (caller.role === 'admin') return true;
    if (action === 'read') return readsGroupAndPublic(target.ring);
    return caller.role === 'colead' && target.ring === 'group' && isGroupType(target.type);
  }
  if (caller.kind === 'group') return action === 'read' && readsGroupAndPublic(target.ring);
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

/**
 * Taking or releasing a slot on a sign-up for a member: the admin and co-leads for anyone
 * (porting the sheet, fixing a mistake); a device for the member it holds and no one else;
 * never a guest, never an agent (`write:signups` waits until an agent needs it), and only
 * on a signup in the `group` ring.
 */
export function canClaim(caller: Caller, target: Target, memberId: string): boolean {
  if (target.type !== 'signup' || target.ring !== 'group') return false;
  if (caller.kind === 'member') return caller.role === 'admin' || caller.role === 'colead';
  if (caller.kind === 'group') return caller.memberId === memberId;
  return false;
}

export function authorizeClaim(caller: Caller, target: Target, memberId: string): void {
  if (!canClaim(caller, target, memberId)) throw forbidden('cannot claim a slot for this member');
}

export type MemberAction =
  /** The directory and the "Who are you?" list. */
  | 'read'
  | 'add'
  /** Name, phone, address, notes. */
  | 'edit'
  /** A device takes this name. */
  | 'claim'
  /** A lost phone: refuse every device holding this name. */
  | 'clear'
  /** Make a co-lead, which creates a Cognito user. */
  | 'promote';

/**
 * What may be done to a member row (docs/phases/04-group.md "Members are entities"): the
 * admin everything; a co-lead everything but promotion; a device holding a name reads the
 * directory, edits its own row and may claim another name (a shared phone); a guest reads
 * and claims; an agent nothing, ever.
 */
export function canMember(caller: Caller, action: MemberAction, subjectId?: string): boolean {
  if (caller.kind === 'agent') return false;
  if (caller.kind === 'member') {
    if (caller.role === 'admin') return true;
    if (caller.role === 'colead') return action !== 'promote';
    return action === 'read';
  }
  if (action === 'read' || action === 'claim') return true;
  if (action === 'edit') return caller.role === 'member' && caller.memberId === subjectId;
  return false;
}

export function authorizeMember(caller: Caller, action: MemberAction, subjectId?: string): void {
  if (!canMember(caller, action, subjectId)) throw forbidden(`cannot ${action} this member`);
}

/**
 * The group link is minted and rotated by the admin alone (Tyler, Oct 31: a co-lead would
 * never do it), never from a device or an agent. A co-lead's power is over members and the
 * group's documents, not over the key.
 */
export function canKeepLink(caller: Caller): boolean {
  return caller.kind === 'member' && caller.role === 'admin';
}

export function requireLinkKeeper(caller: Caller): asserts caller is MemberCaller {
  if (!canKeepLink(caller)) throw forbidden('admin only');
}

/**
 * Member and token management belong to the admin alone: not to the group role, not to
 * any agent scope (docs/DESIGN.md "Auth and access rings").
 */
export function requireAdmin(caller: Caller): void {
  if (caller.kind !== 'member' || caller.role !== 'admin') throw forbidden('admin only');
}
