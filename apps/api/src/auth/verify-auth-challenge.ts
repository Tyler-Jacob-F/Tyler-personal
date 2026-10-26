import type { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';
import { verifyCode } from './code.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('verify-auth-challenge');

export function createHandler(now: () => number) {
  return async (
    event: VerifyAuthChallengeResponseTriggerEvent,
  ): Promise<VerifyAuthChallengeResponseTriggerEvent> => {
    const { salt, hash, expiresAt } = event.request.privateChallengeParameters;
    const answer = event.request.challengeAnswer ?? '';
    const ok =
      !!salt &&
      !!hash &&
      !!expiresAt &&
      verifyCode({ salt, hash, expiresAt: Number(expiresAt) }, answer, now());
    log.info(ok ? 'answer correct' : 'answer rejected', { userName: event.userName });
    event.response = { answerCorrect: ok };
    return event;
  };
}

export const handler = createHandler(Date.now);
