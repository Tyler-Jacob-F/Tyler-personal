import { type Db, getDb } from '../db/client.js';
import { type ApiHandler, createApi, json, noContent } from '../lib/http.js';
import { agentIdentity, cognitoIdentity, groupIdentity } from '../middleware/identity.js';
import { createClaimFor, deleteClaimFor, listClaimsFor } from '../services/claims.js';

export interface ClaimsOptions {
  /** Injected by tests; production uses the clock. */
  now?: () => Date;
}

/**
 * The claim API on three doors: the admin and co-leads through Cognito, devices through
 * the group authorizer, and an agent with `write:signups` through the agents' door for
 * the one-time seed from the Google Sheet. The rules live in services/claims.ts, which
 * the MCP `claim_slot` tool shares.
 */
export function build(db: Db, options: ClaimsOptions = {}): ApiHandler {
  return createApi({
    service: 'claims',
    identify: { member: cognitoIdentity(db), group: groupIdentity(db), agent: agentIdentity(db) },
    routes: {
      'GET /api/documents/{id}/claims': async ({ identity, params }) =>
        json(200, await listClaimsFor(db, identity, params.id)),

      'POST /api/documents/{id}/claims': async ({ identity, params, body, log }) =>
        json(201, await createClaimFor(db, identity, params.id, body, log, options)),

      'DELETE /api/documents/{id}/claims/{claimId}': async ({ identity, params, log }) => {
        await deleteClaimFor(db, identity, params.id, params.claimId, log, options);
        return noContent();
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
