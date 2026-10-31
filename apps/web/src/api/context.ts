import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext } from 'react';
import type { ApiFetch } from '@/api/client';

export const ApiContext = createContext<ApiFetch | null>(null);

export function useApi(): ApiFetch {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi needs an ApiProvider above it');
  return api;
}

/**
 * After any write, every read is stale: a recipe's tags show on the list, a claim on the
 * home and the sheet, a member on the directory and the claim screen. At this size one
 * rule beats a map of which keys each mutation touches, which is how two resource files
 * drifted into invalidating only their own (Oct 31).
 */
export function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries(), [queryClient]);
}
