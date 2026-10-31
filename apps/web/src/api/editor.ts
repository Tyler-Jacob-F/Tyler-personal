import type { CreateDocumentRequest, CreateVersionRequest, DocumentType } from '@the-keep/shared';
import { useQuery } from '@tanstack/react-query';
import type { ApiFetch } from '@/api/client';
import { useApi } from '@/api/context';
import {
  documentKeys,
  useCreateDocument,
  useCreateVersion,
  useDeleteDocument,
} from '@/api/documents';
import { documentWithVersionSchema } from '@the-keep/shared';

export interface DocumentEditor {
  /** The document being edited; undefined while loading or when creating. */
  existing: ReturnType<typeof useExisting>;
  creating: boolean;
  /** Create the document, or append a version to it. Resolves to the document's id. */
  save(input: {
    frontmatter: Record<string, unknown>;
    body: string;
    summary?: string;
    tags?: string[];
    authoredAt?: string | null;
  }): Promise<string>;
  remove(): Promise<void>;
  error: Error | null;
  pending: boolean;
}

function useExisting(id: string | undefined, api: ApiFetch) {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ''),
    queryFn: () => api(`/api/documents/${id}`, { schema: documentWithVersionSchema }),
    enabled: id !== undefined,
  });
}

/**
 * One editor for every document type: with an id it loads the document and saves a new
 * version; without one it creates. The forms decide the frontmatter; this decides the
 * verbs. The fetch defaults to the signed-in one; the group passes its own.
 */
export function useDocumentEditor(
  type: DocumentType,
  id: string | undefined,
  api?: ApiFetch,
): DocumentEditor {
  const fallback = useApi();
  const fetch = api ?? fallback;
  const existing = useExisting(id, fetch);
  const create = useCreateDocument(fetch);
  const version = useCreateVersion(id ?? '', fetch);
  const remove = useDeleteDocument(fetch);
  return {
    existing,
    creating: id === undefined,
    async save({ frontmatter, body, summary = '', tags = [], authoredAt = null }) {
      if (id === undefined) {
        const request: CreateDocumentRequest = {
          type,
          frontmatter,
          body,
          summary,
          tags,
          authoredAt,
        };
        const created = await create.mutateAsync(request);
        return created.document.id;
      }
      const request: CreateVersionRequest = { frontmatter, body, summary, authoredAt };
      await version.mutateAsync(request);
      return id;
    },
    async remove() {
      if (id !== undefined) await remove.mutateAsync(id);
    },
    error: create.error ?? version.error ?? remove.error,
    pending: create.isPending || version.isPending || remove.isPending,
  };
}
