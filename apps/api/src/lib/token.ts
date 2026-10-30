import { createHash, randomBytes } from 'node:crypto';
import { AGENT_TOKEN_PREFIX, AGENT_TOKEN_SECRET_BYTES } from '@the-keep/shared';

/** A fresh secret: `keep_` then 32 random bytes as base64url. Shown once; never stored. */
export function generateAgentSecret(): string {
  return AGENT_TOKEN_PREFIX + randomBytes(AGENT_TOKEN_SECRET_BYTES).toString('base64url');
}

/**
 * What the database keeps. Unsalted SHA-256 is enough: the secret carries 256 bits of
 * entropy, so there is no dictionary to rainbow and the hash doubles as a lookup key.
 */
export function hashAgentSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}
