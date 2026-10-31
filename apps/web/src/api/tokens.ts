import {
  agentTokenSchema,
  type CreateAgentTokenRequest,
  createAgentTokenResponseSchema,
  listAgentTokensResponseSchema,
  type UpdateAgentTokenRequest,
} from '@the-keep/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useApi, useInvalidateAll } from '@/api/context';

export const tokenKeys = {
  all: ['tokens'] as const,
};

export function useTokens() {
  const api = useApi();
  return useQuery({
    queryKey: tokenKeys.all,
    queryFn: () => api('/api/admin/tokens', { schema: listAgentTokensResponseSchema }),
  });
}

/** The response is the only time the secret exists outside the caller's clipboard. */
export function useCreateToken() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateAgentTokenRequest) =>
      api('/api/admin/tokens', { method: 'POST', body, schema: createAgentTokenResponseSchema }),
    onSuccess: invalidate,
  });
}

/** Change a token's scopes in place; every client holding it sees the new set at once. */
export function useUpdateToken() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateAgentTokenRequest & { id: string }) =>
      api(`/api/admin/tokens/${id}`, { method: 'PATCH', body, schema: agentTokenSchema }),
    onSuccess: invalidate,
  });
}

export function useRevokeToken() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/tokens/${id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: invalidate,
  });
}
