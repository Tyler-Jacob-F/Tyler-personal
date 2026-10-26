import { createContext, useContext } from 'react';
import type { ApiFetch } from '@/api/client';

export const ApiContext = createContext<ApiFetch | null>(null);

export function useApi(): ApiFetch {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi needs an ApiProvider above it');
  return api;
}
