import { meResponseSchema } from '@the-keep/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/context';

export const meKeys = {
  all: ['me'] as const,
};

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: meKeys.all,
    queryFn: () => api('/api/me', { schema: meResponseSchema }),
  });
}
