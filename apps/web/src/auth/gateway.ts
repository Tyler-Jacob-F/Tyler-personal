import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '@/config';

export interface Tokens {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds when the id token stops being accepted. */
  expiresAt: number;
}

/** An open sign-in: Cognito's opaque session plus the username it resolved the email to. */
export interface Challenge {
  email: string;
  username: string;
  session: string;
}

export type SubmitResult =
  { kind: 'tokens'; tokens: Tokens } | { kind: 'retry'; challenge: Challenge };

export class AuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * The three calls the sign-in screen and token refresh need. The real one talks to
 * Cognito's CUSTOM_AUTH flow; tests hand the provider a fake.
 */
export interface AuthGateway {
  requestCode(email: string): Promise<Challenge>;
  submitCode(challenge: Challenge, code: string): Promise<SubmitResult>;
  refresh(refreshToken: string): Promise<Tokens>;
  /** Invalidate a refresh token at Cognito, so sign-out means sign-out. */
  revoke(refreshToken: string): Promise<void>;
}

function tokensFrom(
  result: {
    IdToken?: string;
    AccessToken?: string;
    RefreshToken?: string;
    ExpiresIn?: number;
  },
  previousRefresh: string | null,
): Tokens {
  if (!result.IdToken || !result.AccessToken)
    throw new AuthError('no_tokens', 'Cognito returned no tokens');
  return {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken ?? previousRefresh,
    expiresAt: Date.now() + (result.ExpiresIn ?? 3600) * 1000,
  };
}

function translate(error: unknown): never {
  const { name, message } = (error ?? {}) as { name?: string; message?: string };
  if (name === 'NotAuthorizedException') {
    throw new AuthError('not_authorized', 'That did not work. Ask for a new code and try again.');
  }
  if (name === 'UserNotFoundException') {
    throw new AuthError('not_authorized', 'That did not work.');
  }
  if (name === 'TooManyRequestsException' || name === 'LimitExceededException') {
    throw new AuthError('rate_limited', 'Too many tries. Wait a minute and try again.');
  }
  throw new AuthError(name ?? 'unknown', message ?? 'Something went wrong.');
}

export function cognitoGateway(
  client = new CognitoIdentityProviderClient({ region: config.region }),
  clientId = config.clientId,
): AuthGateway {
  return {
    async requestCode(email) {
      const out = await client
        .send(
          new InitiateAuthCommand({
            AuthFlow: 'CUSTOM_AUTH',
            ClientId: clientId,
            AuthParameters: { USERNAME: email },
          }),
        )
        .catch(translate);
      if (out.ChallengeName !== 'CUSTOM_CHALLENGE' || !out.Session) {
        throw new AuthError(
          'unexpected_challenge',
          `Unexpected challenge ${out.ChallengeName ?? 'none'}`,
        );
      }
      return { email, username: out.ChallengeParameters?.USERNAME ?? email, session: out.Session };
    },

    async submitCode(challenge, code) {
      const out = await client
        .send(
          new RespondToAuthChallengeCommand({
            ClientId: clientId,
            ChallengeName: 'CUSTOM_CHALLENGE',
            Session: challenge.session,
            ChallengeResponses: { USERNAME: challenge.username, ANSWER: code.trim() },
          }),
        )
        .catch(translate);
      if (out.AuthenticationResult) {
        return { kind: 'tokens', tokens: tokensFrom(out.AuthenticationResult, null) };
      }
      if (out.ChallengeName === 'CUSTOM_CHALLENGE' && out.Session) {
        return { kind: 'retry', challenge: { ...challenge, session: out.Session } };
      }
      throw new AuthError(
        'unexpected_challenge',
        `Unexpected challenge ${out.ChallengeName ?? 'none'}`,
      );
    },

    async refresh(refreshToken) {
      const out = await client
        .send(
          new InitiateAuthCommand({
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: clientId,
            AuthParameters: { REFRESH_TOKEN: refreshToken },
          }),
        )
        .catch(translate);
      if (!out.AuthenticationResult) throw new AuthError('no_tokens', 'Refresh returned no tokens');
      return tokensFrom(out.AuthenticationResult, refreshToken);
    },

    async revoke(refreshToken) {
      await client
        .send(new RevokeTokenCommand({ ClientId: clientId, Token: refreshToken }))
        .catch(translate);
    },
  };
}
