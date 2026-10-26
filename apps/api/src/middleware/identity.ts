import type { Caller } from '@the-keep/shared';
import type { Db } from '../db/client.js';
import { findMemberByEmail } from '../db/repositories.js';
import { type ApiEvent, forbidden, unauthorized } from '../lib/http.js';
import type { Logger } from '../lib/logger.js';

/** Who is calling, in the brief's shape, plus what the screens show about them. */
export interface Identity {
  caller: Caller;
  email: string;
  displayName: string;
}

/**
 * Identity: "who is this". API Gateway has already verified the Cognito JWT, so the
 * email claim is trusted; the member allowlist then says whether that person belongs.
 * Agent tokens arrive by a different route prefix in Phase 2 and converge on the same
 * Identity shape. Nothing here knows about rings.
 */
export function cognitoIdentity(db: Db) {
  return async (event: ApiEvent, log: Logger): Promise<Identity> => {
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const email = typeof claims?.email === 'string' ? claims.email : undefined;
    if (!email) throw unauthorized('no verified email on the request');
    const member = await findMemberByEmail(db, email);
    if (!member) {
      log.warn('email not on the member allowlist', { email });
      throw forbidden('not a member');
    }
    return {
      caller: { kind: 'member', id: member.id, role: member.role },
      email: member.email,
      displayName: member.displayName,
    };
  };
}
