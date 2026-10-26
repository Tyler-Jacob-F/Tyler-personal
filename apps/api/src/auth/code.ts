import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Defaults flagged in docs/phases/01-spine.md: ten minutes, three attempts. */
export const CODE_TTL_SECONDS = 600;
export const MAX_ATTEMPTS = 3;
export const CHALLENGE_NAME = 'CUSTOM_CHALLENGE';
const METADATA_PREFIX = 'EMAIL_CODE';

export interface IssuedCode {
  salt: string;
  hash: string;
  expiresAt: number;
}

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashCode(salt: string, code: string): string {
  return createHash('sha256').update(`${salt}:${code.trim()}`).digest('hex');
}

export function issueCode(code: string, now: number, ttlSeconds = CODE_TTL_SECONDS): IssuedCode {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: hashCode(salt, code), expiresAt: now + ttlSeconds * 1000 };
}

/**
 * The code survives a wrong answer through `challengeMetadata`, the one field Cognito
 * carries from one challenge round to the next. Only triggers ever see it.
 */
export function encodeMetadata({ salt, hash, expiresAt }: IssuedCode): string {
  return [METADATA_PREFIX, salt, hash, String(expiresAt)].join(':');
}

export function decodeMetadata(metadata: string | undefined): IssuedCode | null {
  if (!metadata) return null;
  const [prefix, salt, hash, expires] = metadata.split(':');
  if (prefix !== METADATA_PREFIX || !salt || !hash || !expires) return null;
  const expiresAt = Number(expires);
  return Number.isFinite(expiresAt) ? { salt, hash, expiresAt } : null;
}

export function verifyCode(issued: IssuedCode, answer: string, now: number): boolean {
  if (now > issued.expiresAt) return false;
  const expected = Buffer.from(issued.hash, 'hex');
  const actual = Buffer.from(hashCode(issued.salt, answer), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
