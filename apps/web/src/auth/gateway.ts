import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '@/config';

/**
 * Which app client a sign-in runs through: `web` for Tyler (thirty days between sign-ins),
 * `group` for the co-leads (a year). A refresh token must go back to the client that
 * issued it, so the choice travels with the challenge and the tokens.
 */
export type AuthClient = 'web' | 'group';

export interface Tokens {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds when the id token stops being accepted. */
  expiresAt: number;
  client?: AuthClient;
}

/** An open sign-in: Cognito's opaque session plus the username it resolved the email to. */
export interface Challenge {
  email: string;
  username: string;
  session: string;
  client?: AuthClient;
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
  requestCode(email: string, client?: AuthClient): Promise<Challenge>;
  submitCode(challenge: Challenge, code: string): Promise<SubmitResult>;
  refresh(refreshToken: string, client?: AuthClient): Promise<Tokens>;
  /** Invalidate a refresh token at Cognito, so sign-out means sign-out. */
  revoke(refreshToken: string, client?: AuthClient): Promise<void>;
}

function tokensFrom(
  result: {
    IdToken?: string;
    AccessToken?: string;
    RefreshToken?: string;
    ExpiresIn?: number;
  },
  previousRefresh: string | null,
  client: AuthClient,
): Tokens {
  if (!result.IdToken || !result.AccessToken)
    throw new AuthError('no_tokens', 'Cognito returned no tokens');
  return {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken ?? previousRefresh,
    expiresAt: Date.now() + (result.ExpiresIn ?? 3600) * 1000,
    client,
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
  clientIds: Record<AuthClient, string> = { web: config.clientId, group: config.groupClientId },
): AuthGateway {
  return {
    async requestCode(email, which = 'web') {
      const out = await client
        .send(
          new InitiateAuthCommand({
            AuthFlow: 'CUSTOM_AUTH',
            ClientId: clientIds[which],
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
      return {
        email,
        username: out.ChallengeParameters?.USERNAME ?? email,
        session: out.Session,
        client: which,
      };
    },

    async submitCode(challenge, code) {
      const which = challenge.client ?? 'web';
      const out = await client
        .send(
          new RespondToAuthChallengeCommand({
            ClientId: clientIds[which],
            ChallengeName: 'CUSTOM_CHALLENGE',
            Session: challenge.session,
            ChallengeResponses: { USERNAME: challenge.username, ANSWER: code.trim() },
          }),
        )
        .catch(translate);
      if (out.AuthenticationResult) {
        return { kind: 'tokens', tokens: tokensFrom(out.AuthenticationResult, null, which) };
      }
      if (out.ChallengeName === 'CUSTOM_CHALLENGE' && out.Session) {
        return { kind: 'retry', challenge: { ...challenge, session: out.Session } };
      }
      throw new AuthError(
        'unexpected_challenge',
        `Unexpected challenge ${out.ChallengeName ?? 'none'}`,
      );
    },

    async refresh(refreshToken, which = 'web') {
      const out = await client
        .send(
          new InitiateAuthCommand({
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: clientIds[which],
            AuthParameters: { REFRESH_TOKEN: refreshToken },
          }),
        )
        .catch(translate);
      if (!out.AuthenticationResult) throw new AuthError('no_tokens', 'Refresh returned no tokens');
      return tokensFrom(out.AuthenticationResult, refreshToken, which);
    },

    async revoke(refreshToken, which = 'web') {
      await client
        .send(new RevokeTokenCommand({ ClientId: clientIds[which], Token: refreshToken }))
        .catch(translate);
    },
  };
}
