import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import type { AuthGateway, Tokens } from '@/auth/gateway';
import { useAuth } from '@/auth/useAuth';

function jwt(payload: Record<string, unknown>): string {
  return `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.s`;
}

function tokens(expiresInMs: number, id = 'id-1'): Tokens {
  return {
    idToken: jwt({ email: 'tyler.fuqua@icloud.com', t: id }),
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: Date.now() + expiresInMs,
  };
}

function gatewayWith(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    requestCode: async (email) => ({ email, username: 'u', session: 's' }),
    submitCode: async () => ({ kind: 'tokens', tokens: tokens(3_600_000) }),
    refresh: async () => tokens(3_600_000, 'id-2'),
    ...overrides,
  };
}

function hook(gateway: AuthGateway) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider gateway={gateway}>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

describe('AuthProvider', () => {
  it('starts anonymous, signs in after a correct code, and hands out the id token', async () => {
    const { result } = hook(gatewayWith());
    expect(result.current.state.status).toBe('anonymous');
    expect(await result.current.getToken()).toBeNull();
    const challenge = await result.current.requestCode('tyler.fuqua@icloud.com');
    let ok = false;
    await act(async () => {
      ok = await result.current.submitCode(challenge, '123456');
    });
    expect(ok).toBe(true);
    expect(result.current.state).toEqual({ status: 'signedIn', email: 'tyler.fuqua@icloud.com' });
    expect(await result.current.getToken()).toBe(tokens(0).idToken);
  });

  it('reports a wrong code without changing state', async () => {
    const gateway = gatewayWith({
      submitCode: async (challenge) => ({
        kind: 'retry',
        challenge: { ...challenge, session: 's2' },
      }),
    });
    const { result } = hook(gateway);
    let ok = true;
    await act(async () => {
      ok = await result.current.submitCode({ email: 'e', username: 'u', session: 's' }, '000000');
    });
    expect(ok).toBe(false);
    expect(result.current.state.status).toBe('anonymous');
  });

  it('refreshes a token that is about to expire, once, and signs out when refresh fails', async () => {
    const refresh = vi.fn(async () => tokens(3_600_000, 'id-2'));
    const gateway = gatewayWith({
      submitCode: async () => ({ kind: 'tokens', tokens: tokens(30_000) }),
      refresh,
    });
    const { result } = hook(gateway);
    await act(async () => {
      await result.current.submitCode({ email: 'e', username: 'u', session: 's' }, '1');
    });
    const [a, b] = await Promise.all([result.current.getToken(), result.current.getToken()]);
    expect(a).toBe(tokens(0, 'id-2').idToken);
    expect(b).toBe(a);
    expect(refresh).toHaveBeenCalledTimes(1);

    const failing = gatewayWith({
      submitCode: async () => ({ kind: 'tokens', tokens: tokens(30_000) }),
      refresh: async () => {
        throw new Error('expired');
      },
    });
    const second = hook(failing);
    await act(async () => {
      await second.result.current.submitCode({ email: 'e', username: 'u', session: 's' }, '1');
    });
    let token: string | null = 'x';
    await act(async () => {
      token = await second.result.current.getToken();
    });
    expect(token).toBeNull();
    expect(second.result.current.state.status).toBe('anonymous');
  });

  it('signs out', async () => {
    const { result } = hook(gatewayWith());
    await act(async () => {
      await result.current.submitCode({ email: 'e', username: 'u', session: 's' }, '1');
    });
    act(() => result.current.signOut());
    expect(result.current.state.status).toBe('anonymous');
    expect(await result.current.getToken()).toBeNull();
  });
});
