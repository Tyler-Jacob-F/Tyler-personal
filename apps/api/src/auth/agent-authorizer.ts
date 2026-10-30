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

/**
 * A second header name, for a client whose platform rewrites `Authorization`. claude.ai
 * turned out not to allow it in a custom connector (its header names are allowlisted), so
 * Cowork uses `Authorization` with the bare token; the name stays for the next client.
 */
export const TOKEN_HEADER = 'x-keep-token';

export interface PresentedToken {
  secret?: string;
  /** Which header carried it, for the log. */
  via: 'x-keep-token' | 'authorization' | null;
  /** The shape of what arrived, never its value: enough to debug a refusal from a log line. */
  shape: string;
}

/**
 * `Authorization: Bearer keep_…` → `keep_…`; anything else is nothing. The space is
 * optional because claude.ai's connector dialog strips whitespace from header values and
 * sends `Bearerkeep_…` (Oct 30, found from a `shape` of "bare value, length 54").
 */
export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s*(\S+)$/i.exec(header?.trim() ?? '');
  return match?.[1];
}

function describe(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'empty';
  const [scheme, rest] = trimmed.split(/\s+/, 2);
  if (rest === undefined) return `bare value, length ${trimmed.length}`;
  return `scheme ${scheme}, credential length ${trimmed.length - scheme!.length - 1}`;
}

/**
 * Find the token on a request: `X-Keep-Token` first (with or without a `Bearer ` prefix),
 * then `Authorization: Bearer …`, then a bare token in `Authorization`.
 */
export function presentedToken(headers: Record<string, string | undefined> = {}): PresentedToken {
  const lower: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) lower[name.toLowerCase()] = value;
  }
  const custom = lower[TOKEN_HEADER];
  if (custom !== undefined) {
    const secret = bearerToken(custom) ?? custom.trim();
    return {
      secret: secret || undefined,
      via: 'x-keep-token',
      shape: `${TOKEN_HEADER}: ${describe(custom)}`,
    };
  }
  const authorization = lower.authorization;
  if (authorization !== undefined) {
    const bearer = bearerToken(authorization);
    const bare = /^\S+$/.test(authorization.trim()) ? authorization.trim() : undefined;
    return {
      secret: bearer ?? bare,
      via: 'authorization',
      shape: `authorization: ${describe(authorization)}`,
    };
  }
  return { via: null, shape: 'no token header' };
}

/**
 * The agents' door (docs/DESIGN.md "Auth and access rings"): the Lambda authorizer on
 * `/api/agent/*` and `/mcp`, invoked on every request that carries an `Authorization`
 * header (no result cache, so a revoke takes effect at once; without the header the
 * gateway answers 401 by itself). Hash the presented secret, look it up, refuse
 * a revoked or unknown token, record the use, and pass `{ id, name, scopes }` on as
 * context. It never sees a document and knows nothing about rings; that is the permission
 * middleware's job.
 */
export function build(db: Db): AgentAuthorizer {
  return async (event) => {
    const log = createLogger('agent-authorizer', {
      requestId: event.requestContext?.requestId,
      route: event.routeKey,
    });
    const presented = presentedToken(event.headers);
    const { secret, via, shape } = presented;
    if (!secret) {
      log.info('refused', { reason: 'no token', shape });
      return deny;
    }
    if (!agentTokenSecretSchema.safeParse(secret).success) {
      log.info('refused', { reason: 'not an agent token', shape });
      return deny;
    }
    const token = await findAgentTokenByHash(db, hashAgentSecret(secret));
    if (!token) {
      log.info('refused', { reason: 'unknown token', via });
      return deny;
    }
    if (token.revokedAt) {
      log.warn('refused', { reason: 'revoked token', tokenId: token.id, name: token.name });
      return deny;
    }
    await touchAgentToken(db, token.id);
    log.info('accepted', { tokenId: token.id, name: token.name, scopes: token.scopes, via });
    return {
      isAuthorized: true,
      context: { id: token.id, name: token.name, scopes: JSON.stringify(token.scopes) },
    };
  };
}

let instance: AgentAuthorizer | undefined;
export const handler: AgentAuthorizer = (event) => (instance ??= build(getDb()))(event);
