import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { CreateAuthChallengeTriggerEvent } from 'aws-lambda';
import {
  CHALLENGE_NAME,
  CODE_TTL_SECONDS,
  decodeMetadata,
  encodeMetadata,
  generateCode,
  type IssuedCode,
  issueCode,
} from './code.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('create-auth-challenge');

export interface CreateChallengeDeps {
  sendCode(to: string, code: string): Promise<void>;
  now(): number;
  generate(): string;
  ttlSeconds: number;
}

/** Plain text, no links: the brief's code email. Sender name and wording are flagged. */
export function codeEmail(code: string, ttlSeconds: number) {
  const minutes = Math.round(ttlSeconds / 60);
  return {
    subject: `${code} is your sign-in code for The Keep`,
    text: [
      `Your sign-in code is ${code}.`,
      '',
      `It expires in ${minutes} minutes and works once. Type it into the screen that asked for it.`,
      '',
      'If you did not ask to sign in, ignore this email; nobody can use the code without it.',
      '',
      'The Keep · tylerfuqua.com',
    ].join('\n'),
  };
}

export function sesSender(client: SESv2Client, from: string, ttlSeconds: number) {
  return async (to: string, code: string): Promise<void> => {
    const { subject, text } = codeEmail(code, ttlSeconds);
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: text, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  };
}

/**
 * Generate a six-digit code, email it, and keep only its salted hash. A wrong answer
 * reuses the unexpired code from the previous round instead of sending another email.
 */
export function createHandler(deps: CreateChallengeDeps) {
  return async (
    event: CreateAuthChallengeTriggerEvent,
  ): Promise<CreateAuthChallengeTriggerEvent> => {
    const email = event.request.userAttributes.email;
    if (!email) throw new Error('user has no email attribute');
    const now = deps.now();

    const previous = event.request.session
      .filter((s) => s.challengeName === CHALLENGE_NAME)
      .map((s) => decodeMetadata(s.challengeMetadata))
      .filter((m): m is IssuedCode => m !== null && m.expiresAt > now)
      .at(-1);

    let issued: IssuedCode;
    if (previous) {
      issued = previous;
      log.info('reusing unexpired code', { userName: event.userName });
    } else {
      const code = deps.generate();
      issued = issueCode(code, now, deps.ttlSeconds);
      await deps.sendCode(email, code);
      log.info('code sent', { userName: event.userName });
    }

    event.response = {
      publicChallengeParameters: { email },
      privateChallengeParameters: {
        salt: issued.salt,
        hash: issued.hash,
        expiresAt: String(issued.expiresAt),
      },
      challengeMetadata: encodeMetadata(issued),
    };
    return event;
  };
}

const ttlSeconds = Number(process.env.CODE_TTL_SECONDS ?? CODE_TTL_SECONDS);

export const handler = createHandler({
  sendCode: sesSender(
    new SESv2Client({}),
    process.env.EMAIL_FROM ?? 'The Keep <keep@localhost>',
    ttlSeconds,
  ),
  now: Date.now,
  generate: generateCode,
  ttlSeconds,
});
