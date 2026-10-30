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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApi } from '@/api/context';

export const documentKeys = {
  all: ['documents'] as const,
  list: (type: string) => [...documentKeys.all, 'list', type] as const,
  recent: (limit: number) => [...documentKeys.all, 'recent', limit] as const,
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

/** The newest documents of every type, for the home screen. */
export function useRecentDocuments(limit: number) {
  const api = useApi();
  return useQuery({
    queryKey: documentKeys.recent(limit),
    queryFn: () => api('/api/documents', { schema: listDocumentsResponseSchema, query: { limit } }),
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

export function useCreateDocument() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDocumentRequest) =>
      api('/api/documents', { method: 'POST', body, schema: documentWithVersionSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useCreateVersion(id: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVersionRequest) =>
      api(`/api/documents/${id}/versions`, { method: 'POST', body, schema: versionSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

/** Replace the document's tags; no version is written. */
export function useSetTags(id: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tags: string[]) =>
      api(`/api/documents/${id}/tags`, {
        method: 'PUT',
        body: { tags },
        schema: documentWithVersionSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDeleteDocument() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/documents/${id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}
