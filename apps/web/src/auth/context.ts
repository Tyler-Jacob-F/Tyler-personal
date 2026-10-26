import { createContext } from 'react';
import type { Challenge } from '@/auth/gateway';

export type AuthState = { status: 'anonymous' } | { status: 'signedIn'; email: string };

export interface AuthContextValue {
  state: AuthState;
  /** Step one: ask Cognito to email a code. */
  requestCode(email: string): Promise<Challenge>;
  /** Step two: answer it. Resolves to true when signed in, false when the code was wrong. */
  submitCode(challenge: Challenge, code: string): Promise<boolean>;
  /** A fresh id token for the API, refreshed when within a minute of expiry. */
  getToken(): Promise<string | null>;
  signOut(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
