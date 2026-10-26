import type {
  CreateAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerEvent,
  VerifyAuthChallengeResponseTriggerEvent,
} from 'aws-lambda';
import {
  decodeMetadata,
  encodeMetadata,
  generateCode,
  issueCode,
  MAX_ATTEMPTS,
  verifyCode,
} from '../../src/auth/code.js';
import { codeEmail, createHandler as createCreate } from '../../src/auth/create-auth-challenge.js';
import { handler as define } from '../../src/auth/define-auth-challenge.js';
import { createHandler as createVerify } from '../../src/auth/verify-auth-challenge.js';

const base = {
  version: '1',
  region: 'us-east-1',
  userPoolId: 'us-east-1_test',
  userName: 'tyler',
  callerContext: { awsSdkVersion: '3', clientId: 'client' },
};
const email = 'tyler.fuqua@icloud.com';
const T0 = Date.parse('2026-10-26T12:00:00Z');

type SessionEntry = DefineAuthChallengeTriggerEvent['request']['session'][number];
const wrong = (metadata?: string): SessionEntry => ({
  challengeName: 'CUSTOM_CHALLENGE',
  challengeResult: false,
  challengeMetadata: metadata,
});
const right = (): SessionEntry => ({ challengeName: 'CUSTOM_CHALLENGE', challengeResult: true });

function defineEvent(
  session: SessionEntry[],
  userNotFound = false,
): DefineAuthChallengeTriggerEvent {
  return {
    ...base,
    triggerSource: 'DefineAuthChallenge_Authentication',
    request: { userAttributes: { email }, session, userNotFound },
    response: { failAuthentication: false, issueTokens: false },
  };
}

function createEvent(session: SessionEntry[] = []): CreateAuthChallengeTriggerEvent {
  return {
    ...base,
    triggerSource: 'CreateAuthChallenge_Authentication',
    request: { userAttributes: { email }, challengeName: 'CUSTOM_CHALLENGE', session },
    response: {
      publicChallengeParameters: {},
      privateChallengeParameters: {},
      challengeMetadata: '',
    },
  };
}

function verifyEvent(
  privateChallengeParameters: Record<string, string>,
  challengeAnswer: string,
): VerifyAuthChallengeResponseTriggerEvent {
  return {
    ...base,
    triggerSource: 'VerifyAuthChallengeResponse_Authentication',
    request: { userAttributes: { email }, privateChallengeParameters, challengeAnswer },
    response: { answerCorrect: false },
  };
}

describe('define auth challenge', () => {
  it('starts with a custom challenge', async () => {
    const out = await define(defineEvent([]));
    expect(out.response).toEqual({
      challengeName: 'CUSTOM_CHALLENGE',
      failAuthentication: false,
      issueTokens: false,
    });
  });

  it('issues tokens after a correct answer', async () => {
    const out = await define(defineEvent([wrong(), right()]));
    expect(out.response.issueTokens).toBe(true);
    expect(out.response.failAuthentication).toBe(false);
  });

  it('asks again after a wrong answer, then fails at the attempt limit', async () => {
    const again = await define(defineEvent([wrong()]));
    expect(again.response.challengeName).toBe('CUSTOM_CHALLENGE');
    const out = await define(defineEvent(Array.from({ length: MAX_ATTEMPTS }, () => wrong())));
    expect(out.response.failAuthentication).toBe(true);
    expect(out.response.issueTokens).toBe(false);
  });

  it('fails an unknown address without a challenge, so no email is ever sent', async () => {
    const out = await define(defineEvent([], true));
    expect(out.response.failAuthentication).toBe(true);
    expect(out.response.challengeName).toBeUndefined();
  });
});

describe('create auth challenge', () => {
  function deps() {
    const sent: Array<{ to: string; code: string }> = [];
    const handler = createCreate({
      sendCode: async (to, code) => {
        sent.push({ to, code });
      },
      now: () => T0,
      generate: () => '123456',
      ttlSeconds: 600,
    });
    return { handler, sent };
  }

  it('emails a six-digit code and keeps only its salted hash', async () => {
    const { handler, sent } = deps();
    const out = await handler(createEvent());
    expect(sent).toEqual([{ to: email, code: '123456' }]);
    expect(out.response.publicChallengeParameters).toEqual({ email });
    const { salt, hash, expiresAt } = out.response.privateChallengeParameters;
    expect(hash).not.toContain('123456');
    expect(Number(expiresAt)).toBe(T0 + 600_000);
    expect(decodeMetadata(out.response.challengeMetadata)).toEqual({
      salt,
      hash,
      expiresAt: T0 + 600_000,
    });
    expect(JSON.stringify(out.response)).not.toContain('123456');
  });

  it('reuses the unexpired code after a wrong answer instead of emailing again', async () => {
    const { handler, sent } = deps();
    const first = await handler(createEvent());
    const second = await handler(createEvent([wrong(first.response.challengeMetadata)]));
    expect(sent).toHaveLength(1);
    expect(second.response.privateChallengeParameters).toEqual(
      first.response.privateChallengeParameters,
    );
  });

  it('issues a fresh code once the previous one has expired', async () => {
    const { handler, sent } = deps();
    const stale = encodeMetadata(issueCode('000000', T0 - 601_000, 600));
    await handler(createEvent([wrong(stale)]));
    expect(sent).toHaveLength(1);
  });

  it('writes a plain-text email with the code and no links', () => {
    const { subject, text } = codeEmail('123456', 600);
    expect(subject).toContain('123456');
    expect(text).toContain('123456');
    expect(text).toContain('10 minutes');
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toContain('<');
  });

  it('generates six digits, zero-padded', () => {
    for (let i = 0; i < 50; i += 1) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe('verify auth challenge', () => {
  const issued = issueCode('123456', T0, 600);
  const params = { salt: issued.salt, hash: issued.hash, expiresAt: String(issued.expiresAt) };

  it('accepts the right code, with surrounding whitespace, before expiry', async () => {
    const verify = createVerify(() => T0 + 1_000);
    expect((await verify(verifyEvent(params, ' 123456 '))).response.answerCorrect).toBe(true);
  });

  it('rejects a wrong code, an expired code and missing parameters', async () => {
    const verify = createVerify(() => T0 + 1_000);
    expect((await verify(verifyEvent(params, '654321'))).response.answerCorrect).toBe(false);
    expect((await verify(verifyEvent(params, ''))).response.answerCorrect).toBe(false);
    const late = createVerify(() => T0 + 601_000);
    expect((await late(verifyEvent(params, '123456'))).response.answerCorrect).toBe(false);
    expect((await verify(verifyEvent({}, '123456'))).response.answerCorrect).toBe(false);
  });

  it('verifyCode is a pure function of salt, hash and time', () => {
    expect(verifyCode(issued, '123456', T0)).toBe(true);
    expect(verifyCode(issued, '123457', T0)).toBe(false);
    expect(verifyCode(issued, '123456', T0 + 600_001)).toBe(false);
  });
});
