import { listAgentActivityResponseSchema } from '@the-keep/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/api/context';

export const activityKeys = {
  all: ['activity'] as const,
  agents: (days: number, limit: number) => [...activityKeys.all, 'agents', days, limit] as const,
};

/** Versions written by agent tokens in the last `days`, newest first. */
export function useAgentActivity(days = 30, limit = 100) {
  const api = useApi();
  return useQuery({
    queryKey: activityKeys.agents(days, limit),
    queryFn: () =>
      api('/api/admin/activity', {
        schema: listAgentActivityResponseSchema,
        query: { days, limit },
      }),
  });
}
