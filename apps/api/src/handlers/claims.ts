import {
  createClaimRequestSchema,
  type ListClaimsResponse,
  type SignupClaim,
  signupFrontmatterSchema,
  signupOpen,
} from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { createClaim, deleteClaim, getClaim, getMember, listClaims } from '../db/group.js';
import { getDocument } from '../db/repositories.js';
import {
  type ApiHandler,
  badRequest,
  createApi,
  forbidden,
  HttpError,
  json,
  noContent,
  notFound,
  parse,
  parseId,
} from '../lib/http.js';
import { cognitoIdentity, groupIdentity } from '../middleware/identity.js';
import { authorize, authorizeClaim, type Target } from '../middleware/permission.js';

export interface ClaimsOptions {
  /** Injected by tests; production uses the clock. */
  now?: () => Date;
}

/**
 * Sign-up claims (docs/phases/04-group.md "Types"): rows, not versions. Two doors, the
 * admin and co-leads through Cognito and devices through the group authorizer; no agent
 * door, since no scope claims a slot. A device claims for the member it holds; the admin
 * and co-leads claim for anyone, which is how the current sheet is ported. Capacity counts
 * rows; a full slot is a 409 `slot_full`; after `closesAt` a member can neither take nor
 * release, while co-leads still fix the sheet.
 */
export function build(db: Db, { now = () => new Date() }: ClaimsOptions = {}): ApiHandler {
  async function signupOf(rawId: unknown) {
    const id = parseId(rawId);
    const found = await getDocument(db, id);
    if (!found) throw notFound('document');
    if (found.document.type !== 'signup') throw badRequest('not a signup');
    const target: Target = found.document;
    return { id, target, frontmatter: signupFrontmatterSchema.parse(found.version.frontmatter) };
  }

  return createApi({
    service: 'claims',
    identify: { member: cognitoIdentity(db), group: groupIdentity(db) },
    routes: {
      // Everyone who may read the sign-up sees every claim, with the names on them.
      'GET /api/documents/{id}/claims': async ({ identity, params }) => {
        const { id, target } = await signupOf(params.id);
        authorize(identity.caller, 'read', target);
        const body: ListClaimsResponse = { items: await listClaims(db, id) };
        return json(200, body);
      },

      'POST /api/documents/{id}/claims': async ({ identity, params, body, log }) => {
        const { id, target, frontmatter } = await signupOf(params.id);
        const input = parse(createClaimRequestSchema, body, 'claim');
        const { caller } = identity;
        // A device claims for itself; a signed-in co-lead or the admin names the member.
        const memberId =
          caller.kind === 'group'
            ? (caller.memberId ??
              (() => {
                throw forbidden('claim a name before taking a slot');
              })())
            : input.memberId;
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
        const response: SignupClaim = claim;
        return json(201, response);
      },

      'DELETE /api/documents/{id}/claims/{claimId}': async ({ identity, params, log }) => {
        const { id, target, frontmatter } = await signupOf(params.id);
        const claimId = parseId(params.claimId, 'claim id');
        const claim = await getClaim(db, claimId);
        if (!claim || claim.documentId !== id) throw notFound('claim');
        authorizeClaim(identity.caller, target, claim.memberId);
        if (identity.caller.kind === 'group' && !signupOpen(frontmatter, now()))
          throw new HttpError(409, 'closed', 'this sign-up has closed');
        await deleteClaim(db, claimId);
        log.info('slot released', { documentId: id, slot: claim.slot, memberId: claim.memberId });
        return noContent();
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
