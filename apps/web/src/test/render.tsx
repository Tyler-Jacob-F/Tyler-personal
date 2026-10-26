import { QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '@/api/ApiProvider';
import { AuthContext, type AuthContextValue } from '@/auth/context';
import { createQueryClient } from '@/lib/query';

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Where the MemoryRouter starts. */
  route?: string;
  /** Override parts of the fake auth; `signedIn: false` renders anonymously. */
  auth?: Partial<AuthContextValue> & { signedIn?: boolean };
}

export function fakeAuth(
  overrides: Partial<AuthContextValue> & { signedIn?: boolean } = {},
): AuthContextValue {
  const { signedIn = true, ...rest } = overrides;
  return {
    state: signedIn
      ? { status: 'signedIn', email: 'tyler.fuqua@icloud.com' }
      : { status: 'anonymous' },
    requestCode: async (email) => ({ email, username: email, session: 'session-1' }),
    submitCode: async () => true,
    getToken: async () => (signedIn ? 'test-id-token' : null),
    signOut: () => {},
    ...rest,
  };
}

/**
 * Custom render: QueryClient (no retries), MemoryRouter, a fake auth provider and the API
 * client bound to it. Tests never assemble providers by hand.
 */
export function render(
  ui: ReactElement,
  { route = '/', auth, ...options }: CustomRenderOptions = {},
): RenderResult {
  const queryClient = createQueryClient({ retry: 0 });
  const value = fakeAuth(auth);
  function Providers({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={value}>
        <ApiProvider>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </QueryClientProvider>
        </ApiProvider>
      </AuthContext.Provider>
    );
  }
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
