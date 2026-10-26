import { QueryClient } from '@tanstack/react-query';

/** The brief's defaults: 30s staleTime, one retry. Tests pass retry 0. */
export function createQueryClient(overrides: { retry?: number } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: overrides.retry ?? 1 },
      mutations: { retry: 0 },
    },
  });
}
