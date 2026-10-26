import type { DefineAuthChallengeTriggerEvent } from 'aws-lambda';
import { CHALLENGE_NAME, MAX_ATTEMPTS } from './code.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('define-auth-challenge');

/**
 * Drives the custom flow: issue a code challenge, issue tokens once it is answered,
 * fail after MAX_ATTEMPTS wrong answers or for an address the pool does not know.
 * An unknown address never reaches CreateAuthChallenge, so it never gets an email.
 */
export async function handler(
  event: DefineAuthChallengeTriggerEvent,
): Promise<DefineAuthChallengeTriggerEvent> {
  const { session, userNotFound } = event.request;
  const response = {
    challengeName: undefined as string | undefined,
    failAuthentication: false,
    issueTokens: false,
  };

  const custom = session.filter((s) => s.challengeName === CHALLENGE_NAME);
  const last = session.at(-1);

  if (userNotFound) {
    response.failAuthentication = true;
    log.info('unknown user', { userName: event.userName });
  } else if (last?.challengeName === CHALLENGE_NAME && last.challengeResult) {
    response.issueTokens = true;
    log.info('code accepted', { userName: event.userName, attempts: custom.length });
  } else if (custom.length >= MAX_ATTEMPTS) {
    response.failAuthentication = true;
    log.info('too many attempts', { userName: event.userName, attempts: custom.length });
  } else {
    response.challengeName = CHALLENGE_NAME;
  }

  event.response = response;
  return event;
}
