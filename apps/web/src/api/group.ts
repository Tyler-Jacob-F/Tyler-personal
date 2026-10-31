import {
  type CreateClaimRequest,
  type CreateMemberRequest,
  documentWithVersionSchema,
  groupLinkStatusSchema,
  listClaimsResponseSchema,
  listDocumentsResponseSchema,
  listMembersResponseSchema,
  type MakeColeadRequest,
  memberSchema,
  meResponseSchema,
  type RotateGroupLinkRequest,
  rotateGroupLinkResponseSchema,
  signupClaimSchema,
  type UpdateMemberRequest,
} from '@the-keep/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { ApiFetch } from '@/api/client';
import { useInvalidateAll } from '@/api/context';
import { useGroup } from '@/group/context';

/**
 * The group slice's own resources (members, claims, the link), each read through the
 * viewer's door: `/api/...` with the Cognito token for the admin and co-leads,
 * `/api/group/...` with the device token for everyone else. Documents go through the
 * shared hooks in api/documents.ts with the group's fetch. Keys carry the prefix so a
 * signed-in tab and a device tab never share a cache entry.
 */
export const groupKeys = {
  all: ['group'] as const,
  me: () => [...groupKeys.all, 'me'] as const,
  documents: (prefix: string, type: string) =>
    [...groupKeys.all, prefix, 'documents', type] as const,
  document: (prefix: string, id: string) => [...groupKeys.all, prefix, 'document', id] as const,
  claims: (prefix: string, id: string) => [...groupKeys.all, prefix, 'claims', id] as const,
  members: (prefix: string) => [...groupKeys.all, prefix, 'members'] as const,
  link: () => [...groupKeys.all, 'link'] as const,
};

/** `GET /api/group/me` with a device token: which member the device holds, if any. */
export function fetchGroupMe(api: ApiFetch) {
  return api('/api/group/me', { schema: meResponseSchema });
}

export function useGroupDocuments(type: 'questions' | 'signup' | 'event') {
  const { api, prefix } = useGroup();
  return useQuery({
    queryKey: groupKeys.documents(prefix, type),
    queryFn: () =>
      api(`${prefix}/documents`, {
        schema: listDocumentsResponseSchema,
        query: { type, limit: 100 },
      }),
  });
}

export function useGroupDocument(id: string) {
  const { api, prefix } = useGroup();
  return useQuery({
    queryKey: groupKeys.document(prefix, id),
    queryFn: () => api(`${prefix}/documents/${id}`, { schema: documentWithVersionSchema }),
  });
}

export function useClaims(id: string | null) {
  const { api, prefix } = useGroup();
  return useQuery({
    queryKey: groupKeys.claims(prefix, id ?? ''),
    queryFn: () => api(`${prefix}/documents/${id}/claims`, { schema: listClaimsResponseSchema }),
    enabled: id !== null,
  });
}

export function useMembers() {
  const { api, prefix } = useGroup();
  return useQuery({
    queryKey: groupKeys.members(prefix),
    queryFn: () => api(`${prefix}/members`, { schema: listMembersResponseSchema }),
  });
}

/** Take a slot: for the device's own member, or, from a co-lead, for the member named. */
export function useTakeSlot(id: string) {
  const { api, prefix } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateClaimRequest) =>
      api(`${prefix}/documents/${id}/claims`, { method: 'POST', body, schema: signupClaimSchema }),
    onSuccess: invalidate,
  });
}

export function useReleaseSlot(id: string) {
  const { api, prefix } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (claimId: string) =>
      api(`${prefix}/documents/${id}/claims/${claimId}`, {
        method: 'DELETE',
        schema: z.undefined(),
      }),
    onSuccess: invalidate,
  });
}

/** "Who are you?": the device takes a name; `confirm` when the name is already on another device. */
export function useClaimName() {
  const { api } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) =>
      api(`/api/group/members/${id}/claim`, {
        method: 'POST',
        body: { confirm },
        schema: memberSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateMember() {
  const { api, prefix } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateMemberRequest & { id: string }) =>
      api(`${prefix}/members/${id}`, { method: 'PATCH', body, schema: memberSchema }),
    onSuccess: invalidate,
  });
}

export function useAddMember() {
  const { api, prefix } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateMemberRequest) =>
      api(`${prefix}/members`, { method: 'POST', body, schema: memberSchema }),
    onSuccess: invalidate,
  });
}

export function useClearDevices() {
  const { api, prefix } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      api(`${prefix}/members/${id}/devices`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: invalidate,
  });
}

export function useMakeColead() {
  const { api, prefix } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...body }: MakeColeadRequest & { id: string }) =>
      api(`${prefix}/members/${id}/colead`, { method: 'POST', body, schema: memberSchema }),
    onSuccess: invalidate,
  });
}

export function useGroupLink() {
  const { api } = useGroup();
  return useQuery({
    queryKey: groupKeys.link(),
    queryFn: () => api('/api/admin/group-link', { schema: groupLinkStatusSchema }),
  });
}

export function useRotateLink() {
  const { api } = useGroup();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: RotateGroupLinkRequest) =>
      api('/api/admin/group-link', { method: 'POST', body, schema: rotateGroupLinkResponseSchema }),
    onSuccess: invalidate,
  });
}
