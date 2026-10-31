import {
  type CreateDocumentRequest,
  type CreateVersionRequest,
  diffResponseSchema,
  documentWithVersionSchema,
  listDocumentsResponseSchema,
  listVersionsResponseSchema,
  searchDocumentsResponseSchema,
  versionSchema,
} from '@the-keep/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { ApiFetch } from '@/api/client';
import { useApi, useInvalidateAll } from '@/api/context';

export const documentKeys = {
  all: ['documents'] as const,
  list: (type: string) => [...documentKeys.all, 'list', type] as const,
  search: (type: string, q: string, tags: string[]) =>
    [...documentKeys.all, 'search', type, q, tags.join(',')] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
  versions: (id: string) => [...documentKeys.all, 'versions', id] as const,
  diff: (id: string, from: number, to: number) =>
    [...documentKeys.all, 'diff', id, from, to] as const,
};

export function useDocuments(type: string) {
  const api = useApi();
  return useQuery({
    queryKey: documentKeys.list(type),
    queryFn: () => api('/api/documents', { schema: listDocumentsResponseSchema, query: { type } }),
  });
}

/** Words over title, tags and body plus a tag filter; empty words and no tags is the plain list. */
export function useSearch({ type, q, tags }: { type: string; q: string; tags: string[] }) {
  const api = useApi();
  return useQuery({
    queryKey: documentKeys.search(type, q, tags),
    queryFn: () =>
      api('/api/documents/search', {
        schema: searchDocumentsResponseSchema,
        query: { type, q: q || undefined, tags: tags.length ? tags.join(',') : undefined },
      }),
    placeholderData: (previous) => previous,
  });
}

export function useDocument(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => api(`/api/documents/${id}`, { schema: documentWithVersionSchema }),
  });
}

export function useVersions(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: documentKeys.versions(id),
    queryFn: () => api(`/api/documents/${id}/versions`, { schema: listVersionsResponseSchema }),
  });
}

export function useDiff(id: string, from: number, to: number) {
  const api = useApi();
  return useQuery({
    queryKey: documentKeys.diff(id, from, to),
    queryFn: () =>
      api(`/api/documents/${id}/diff`, { schema: diffResponseSchema, query: { from, to } }),
    enabled: from > 0 && to > 0,
  });
}

/**
 * The writes. Each takes the fetch to write through, so the group's screens, whose fetch
 * is bound to a different credential, use the same hooks (default: the signed-in one).
 */
export function useCreateDocument(api?: ApiFetch) {
  const fallback = useApi();
  const fetch = api ?? fallback;
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateDocumentRequest) =>
      fetch('/api/documents', { method: 'POST', body, schema: documentWithVersionSchema }),
    onSuccess: invalidate,
  });
}

export function useCreateVersion(id: string, api?: ApiFetch) {
  const fallback = useApi();
  const fetch = api ?? fallback;
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateVersionRequest) =>
      fetch(`/api/documents/${id}/versions`, { method: 'POST', body, schema: versionSchema }),
    onSuccess: invalidate,
  });
}

/** Replace the document's tags; no version is written. */
export function useSetTags(id: string) {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (tags: string[]) =>
      api(`/api/documents/${id}/tags`, {
        method: 'PUT',
        body: { tags },
        schema: documentWithVersionSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteDocument(api?: ApiFetch) {
  const fallback = useApi();
  const fetch = api ?? fallback;
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/documents/${id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: invalidate,
  });
}
