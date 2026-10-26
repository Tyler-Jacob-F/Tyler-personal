import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { AuthContext, type AuthContextValue, type AuthState } from '@/auth/context';
import { type AuthGateway, type Challenge, type Tokens } from '@/auth/gateway';

const REFRESH_WINDOW_MS = 60_000;

function emailFromIdToken(idToken: string): string {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.email === 'string' ? payload.email : '';
  } catch {
    return '';
  }
}

/**
 * Tokens live in memory only (docs/phases/01-spine.md): a reload means a new code. The
 * refresh token renews the id token in the background while the tab stays open.
 */
export function AuthProvider({ gateway, children }: { gateway: AuthGateway; children: ReactNode }) {
  const tokens = useRef<Tokens | null>(null);
  const refreshing = useRef<Promise<Tokens> | null>(null);
  const [state, setState] = useState<AuthState>({ status: 'anonymous' });

  const signOut = useCallback(() => {
    tokens.current = null;
    setState({ status: 'anonymous' });
  }, []);

  const requestCode = useCallback((email: string) => gateway.requestCode(email.trim()), [gateway]);

  const submitCode = useCallback(
    async (challenge: Challenge, code: string) => {
      const result = await gateway.submitCode(challenge, code);
      if (result.kind === 'retry') return false;
      tokens.current = result.tokens;
      setState({
        status: 'signedIn',
        email: emailFromIdToken(result.tokens.idToken) || challenge.email,
      });
      return true;
    },
    [gateway],
  );

  const getToken = useCallback(async () => {
    const current = tokens.current;
    if (!current) return null;
    if (Date.now() < current.expiresAt - REFRESH_WINDOW_MS) return current.idToken;
    if (!current.refreshToken) {
      signOut();
      return null;
    }
    try {
      refreshing.current ??= gateway.refresh(current.refreshToken);
      const next = await refreshing.current;
      tokens.current = next;
      return next.idToken;
    } catch {
      signOut();
      return null;
    } finally {
      refreshing.current = null;
    }
  }, [gateway, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, requestCode, submitCode, getToken, signOut }),
    [state, requestCode, submitCode, getToken, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
