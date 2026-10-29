import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext, type AuthContextValue, type AuthState } from '@/auth/context';
import { type AuthGateway, type Challenge, type Tokens } from '@/auth/gateway';
import { remembered } from '@/auth/storage';

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
 * The id and access tokens live in memory. The refresh token is remembered in the browser
 * so a reload restores the session silently (decided Oct 29, 2026, after a week of typing
 * codes); sign-out revokes it at Cognito and forgets it. The refresh token renews the id
 * token in the background while the tab stays open.
 */
export function AuthProvider({ gateway, children }: { gateway: AuthGateway; children: ReactNode }) {
  const tokens = useRef<Tokens | null>(null);
  const refreshing = useRef<Promise<Tokens> | null>(null);
  const initial = remembered.load();
  const [state, setState] = useState<AuthState>(
    initial ? { status: 'restoring' } : { status: 'anonymous' },
  );
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(
    initial?.email ?? remembered.email(),
  );

  const signOut = useCallback(() => {
    const token = tokens.current?.refreshToken;
    tokens.current = null;
    remembered.forgetToken();
    setState({ status: 'anonymous' });
    if (token) void gateway.revoke(token).catch(() => {});
  }, [gateway]);

  // Restore a remembered session once, on mount.
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    gateway
      .refresh(initial.refreshToken)
      .then((next) => {
        if (cancelled) return;
        tokens.current = next;
        if (next.refreshToken)
          remembered.save({ refreshToken: next.refreshToken, email: initial.email });
        setState({ status: 'signedIn', email: emailFromIdToken(next.idToken) || initial.email });
      })
      .catch(() => {
        if (cancelled) return;
        remembered.forgetToken();
        setState({ status: 'anonymous' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestCode = useCallback((email: string) => gateway.requestCode(email.trim()), [gateway]);

  const submitCode = useCallback(
    async (challenge: Challenge, code: string) => {
      const result = await gateway.submitCode(challenge, code);
      if (result.kind === 'retry') return false;
      tokens.current = result.tokens;
      const email = emailFromIdToken(result.tokens.idToken) || challenge.email;
      if (result.tokens.refreshToken) {
        remembered.save({ refreshToken: result.tokens.refreshToken, email });
      }
      setRememberedEmail(email);
      setState({ status: 'signedIn', email });
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
      if (next.refreshToken && next.refreshToken !== current.refreshToken) {
        remembered.save({ refreshToken: next.refreshToken, email: emailFromIdToken(next.idToken) });
      }
      return next.idToken;
    } catch {
      signOut();
      return null;
    } finally {
      refreshing.current = null;
    }
  }, [gateway, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, rememberedEmail, requestCode, submitCode, getToken, signOut }),
    [state, rememberedEmail, requestCode, submitCode, getToken, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
