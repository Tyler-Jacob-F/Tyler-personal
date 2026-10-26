import { type ReactNode, useMemo } from 'react';
import { createApiClient } from '@/api/client';
import { ApiContext } from '@/api/context';
import { useAuth } from '@/auth/useAuth';

/** Binds the typed fetch to the signed-in user's token source. */
export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const api = useMemo(() => createApiClient(getToken), [getToken]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
