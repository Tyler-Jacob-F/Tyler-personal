import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';
import { agentTokenSecretSchema } from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { findAgentTokenByHash, touchAgentToken } from '../db/repositories.js';
import { createLogger } from '../lib/logger.js';
import { hashAgentSecret } from '../lib/token.js';

/**
 * What the authorizer hands the route Lambda. API Gateway only carries scalars in the
 * context, so `scopes` is a JSON-encoded array; the identity middleware decodes it.
 */
export interface AgentAuthorizerContext {
  id: string;
  name: string;
  scopes: string;
}

export type AgentAuthorizerResult =
  | APIGatewaySimpleAuthorizerResult
  | APIGatewaySimpleAuthorizerWithContextResult<AgentAuthorizerContext>;

export type AgentAuthorizer = (
  event: APIGatewayRequestAuthorizerEventV2,
) => Promise<AgentAuthorizerResult>;

const deny: APIGatewaySimpleAuthorizerResult = { isAuthorized: false };

/** `Authorization: Bearer keep_…` → `keep_…`; anything else is nothing. */
export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '');
  return match?.[1];
}

/**
 * The agents' door (docs/DESIGN.md "Auth and access rings"): the Lambda authorizer on
 * `/api/agent/*` and `/mcp`. Hash the presented secret, look it up, refuse a revoked or
 * unknown token, record the use, and pass `{ id, name, scopes }` on as context. It never
 * sees a document and knows nothing about rings; that is the permission middleware's job.
 */
export function build(db: Db): AgentAuthorizer {
  return async (event) => {
    const log = createLogger('agent-authorizer', {
      requestId: event.requestContext?.requestId,
      route: event.routeKey,
    });
    const secret = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!secret) {
      log.info('refused', { reason: 'no bearer token' });
      return deny;
    }
    if (!agentTokenSecretSchema.safeParse(secret).success) {
      log.info('refused', { reason: 'not an agent token' });
      return deny;
    }
    const token = await findAgentTokenByHash(db, hashAgentSecret(secret));
    if (!token) {
      log.info('refused', { reason: 'unknown token' });
      return deny;
    }
    if (token.revokedAt) {
      log.warn('refused', { reason: 'revoked token', tokenId: token.id, name: token.name });
      return deny;
    }
    await touchAgentToken(db, token.id);
    log.info('accepted', { tokenId: token.id, name: token.name, scopes: token.scopes });
    return {
      isAuthorized: true,
      context: { id: token.id, name: token.name, scopes: JSON.stringify(token.scopes) },
    };
  };
}

let instance: AgentAuthorizer | undefined;
export const handler: AgentAuthorizer = (event) => (instance ??= build(getDb()))(event);
