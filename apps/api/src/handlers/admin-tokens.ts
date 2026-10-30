import {
  createAgentTokenRequestSchema,
  type CreateAgentTokenResponse,
  type ListAgentTokensResponse,
} from '@the-keep/shared';
import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import { createAgentToken, listAgentTokens, revokeAgentToken } from '../db/repositories.js';
import { type ApiHandler, createApi, json, noContent, notFound, parse } from '../lib/http.js';
import { generateAgentSecret, hashAgentSecret } from '../lib/token.js';
import { cognitoIdentity } from '../middleware/identity.js';
import { requireAdmin } from '../middleware/permission.js';

const idSchema = z.uuid();

/**
 * Token management is the admin's alone (docs/DESIGN.md "Auth and access rings"). These
 * routes sit under the Cognito authorizer, so no agent token can even present itself here;
 * the role check is the second lock on the same door.
 */
export function build(db: Db): ApiHandler {
  return createApi({
    service: 'admin-tokens',
    identify: cognitoIdentity(db),
    routes: {
      'GET /api/admin/tokens': async ({ identity }) => {
        requireAdmin(identity.caller);
        const body: ListAgentTokensResponse = { items: await listAgentTokens(db) };
        return json(200, body);
      },

      'POST /api/admin/tokens': async ({ identity, body, log }) => {
        requireAdmin(identity.caller);
        const input = parse(createAgentTokenRequestSchema, body, 'token');
        const secret = generateAgentSecret();
        const token = await createAgentToken(db, {
          name: input.name,
          scopes: input.scopes,
          secretHash: hashAgentSecret(secret),
        });
        log.info('agent token created', {
          tokenId: token.id,
          name: token.name,
          scopes: token.scopes,
        });
        const response: CreateAgentTokenResponse = { token, secret };
        return json(201, response);
      },

      'DELETE /api/admin/tokens/{id}': async ({ identity, params, log }) => {
        requireAdmin(identity.caller);
        const id = parse(idSchema, params.id, 'id');
        const revoked = await revokeAgentToken(db, id);
        if (!revoked) throw notFound('token');
        log.info('agent token revoked', { tokenId: id, name: revoked.name });
        return noContent();
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
