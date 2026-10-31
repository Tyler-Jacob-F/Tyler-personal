import {
  createClaimRequestSchema,
  type ListClaimsResponse,
  type SignupClaim,
  signupFrontmatterSchema,
  signupOpen,
} from '@the-keep/shared';
import type { Db } from '../db/client.js';
import { createClaim, deleteClaim, getClaim, getMember, listClaims } from '../db/group.js';
import { badRequest, forbidden, HttpError, notFound, parse, parseId } from '../lib/http.js';
import type { Logger } from '../lib/logger.js';
import type { Identity } from '../middleware/identity.js';
import { authorizeClaim } from '../middleware/permission.js';
import { loadDocumentFor } from './documents.js';

/**
 * Sign-up claims (docs/phases/04-group.md "Types"): rows, not versions. The REST routes
 * and the MCP tools both come here. A device claims for the member it holds; the admin,
 * co-leads and an agent with `write:signups` claim for anyone, which is how a sheet is
 * ported. Capacity counts rows; a full slot is a 409 `slot_full`; after `closesAt` a
 * member can neither take nor release, while everyone else still fixes the sheet.
 */
async function signupFor(db: Db, identity: Identity, rawId: unknown) {
  const found = await loadDocumentFor(db, identity, rawId, 'read');
  if (found.document.type !== 'signup') throw badRequest('not a signup');
  return {
    id: found.document.id,
    target: found.document,
    frontmatter: signupFrontmatterSchema.parse(found.version.frontmatter),
  };
}

export async function listClaimsFor(
  db: Db,
  identity: Identity,
  rawId: unknown,
): Promise<ListClaimsResponse> {
  const { id } = await signupFor(db, identity, rawId);
  return { items: await listClaims(db, id) };
}

export interface ClaimOptions {
  /** Injected by tests; production uses the clock. */
  now?: () => Date;
}

export async function createClaimFor(
  db: Db,
  identity: Identity,
  rawId: unknown,
  body: unknown,
  log: Logger,
  { now = () => new Date() }: ClaimOptions = {},
): Promise<SignupClaim> {
  const { id, target, frontmatter } = await signupFor(db, identity, rawId);
  const input = parse(createClaimRequestSchema, body, 'claim');
  const { caller } = identity;
  // A device claims for itself; everyone else names the member.
  if (caller.kind === 'group' && !caller.memberId)
    throw forbidden('claim a name before taking a slot');
  const memberId = caller.kind === 'group' ? caller.memberId! : input.memberId;
  if (!memberId) throw badRequest('memberId is required when claiming on someone’s behalf');
  if (caller.kind === 'group' && input.memberId && input.memberId !== memberId)
    throw forbidden('a device claims only for the member it holds');
  authorizeClaim(caller, target, memberId);
  if (caller.kind === 'group' && !signupOpen(frontmatter, now()))
    throw new HttpError(409, 'closed', 'this sign-up has closed');
  const slot = frontmatter.slots.find((s) => s.label === input.slot);
  if (!slot)
    throw badRequest(`no slot "${input.slot}"`, [
      { path: 'slot', message: `one of ${frontmatter.slots.map((s) => s.label).join(', ')}` },
    ]);
  if (!(await getMember(db, memberId))) throw notFound('member');
  const taken = (await listClaims(db, id)).filter((c) => c.slot === slot.label);
  if (taken.some((c) => c.memberId === memberId))
    throw new HttpError(409, 'conflict', `already on "${slot.label}"`);
  if (taken.length >= slot.capacity)
    throw new HttpError(409, 'slot_full', `"${slot.label}" is full (${slot.capacity})`);
  const claim = await createClaim(db, {
    documentId: id,
    slot: slot.label,
    memberId,
    deviceId: caller.kind === 'group' ? caller.deviceId : null,
  });
  log.info('slot claimed', { documentId: id, slot: slot.label, memberId, claimId: claim.id });
  return claim;
}

export async function deleteClaimFor(
  db: Db,
  identity: Identity,
  rawId: unknown,
  rawClaimId: unknown,
  log: Logger,
  { now = () => new Date() }: ClaimOptions = {},
): Promise<void> {
  const { id, target, frontmatter } = await signupFor(db, identity, rawId);
  // The seed puts names on; taking one off is a person's call, as deleting a document is.
  if (identity.caller.kind === 'agent') throw forbidden('no agent releases a claim');
  const claimId = parseId(rawClaimId, 'claim id');
  const claim = await getClaim(db, claimId);
  if (!claim || claim.documentId !== id) throw notFound('claim');
  authorizeClaim(identity.caller, target, claim.memberId);
  if (identity.caller.kind === 'group' && !signupOpen(frontmatter, now()))
    throw new HttpError(409, 'closed', 'this sign-up has closed');
  await deleteClaim(db, claimId);
  log.info('slot released', { documentId: id, slot: claim.slot, memberId: claim.memberId });
}
