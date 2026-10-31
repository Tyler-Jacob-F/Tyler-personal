import {
  createDocumentRequestSchema,
  createVersionRequestSchema,
  type DocumentWithVersion,
  type ListDocumentsResponse,
  listDocumentsQuerySchema,
  type SearchDocumentsResponse,
  searchDocumentsQuerySchema,
  parseFrontmatter,
  schemaFor,
  setTagsRequestSchema,
  type Version,
} from '@the-keep/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import {
  countDocuments,
  createDocument,
  createVersion,
  getDocument,
  listDocuments,
  searchDocuments,
  setDocumentTags,
} from '../db/repositories.js';
import { notFound, parse } from '../lib/http.js';
import type { Logger } from '../lib/logger.js';
import { type Identity, writerOf } from '../middleware/identity.js';
import { authorize, can } from '../middleware/permission.js';

const idSchema = z.uuid();

/**
 * The one validation path for documents: the REST routes and the MCP tools both call
 * these with the caller's identity and raw input (docs/phases/02-agents.md "One MCP
 * endpoint, same API"). Everything here throws HttpError on refusal, so each caller turns
 * it into its own kind of error response.
 */
export async function listDocumentsFor(
  db: Db,
  identity: Identity,
  query: unknown,
): Promise<ListDocumentsResponse> {
  const { type, limit } = parse(listDocumentsQuerySchema, query ?? {}, 'query');
  const items = await listDocuments(db, { type, limit });
  return { items: items.filter((item) => can(identity.caller, 'read', item.document)) };
}

export async function searchDocumentsFor(
  db: Db,
  identity: Identity,
  query: unknown,
): Promise<SearchDocumentsResponse> {
  const { q, type, tags, limit } = parse(searchDocumentsQuerySchema, query ?? {}, 'query');
  const [items, total] = await Promise.all([
    searchDocuments(db, { q, type, tags, limit }),
    countDocuments(db, type),
  ]);
  return {
    items: items.filter((item) => can(identity.caller, 'read', item.document)),
    total,
    q,
    tags,
  };
}

export async function createDocumentFor(
  db: Db,
  identity: Identity,
  body: unknown,
  log: Logger,
): Promise<DocumentWithVersion> {
  const input = parse(createDocumentRequestSchema, body, 'document');
  const frontmatter = parse(schemaFor(input.type).schema, input.frontmatter, 'frontmatter');
  const tags = parse(schemaFor(input.type).tags, input.tags, 'tags');
  const ring = schemaFor(input.type).defaultRing;
  authorize(identity.caller, 'write', { ring, type: input.type });
  const { owner, author } = writerOf(identity);
  const created = await createDocument(db, {
    type: input.type,
    title: frontmatter.title,
    ring,
    owner,
    tags,
    body: input.body,
    frontmatter,
    summary: input.summary,
    author,
    authoredAt: input.authoredAt ?? null,
  });
  log.info('document created', {
    documentId: created.document.id,
    type: input.type,
    slug: created.document.slug,
  });
  return created;
}

export async function getDocumentFor(
  db: Db,
  identity: Identity,
  rawId: unknown,
): Promise<DocumentWithVersion> {
  const id = parse(idSchema, rawId, 'id');
  const found = await getDocument(db, id);
  if (!found) throw notFound('document');
  authorize(identity.caller, 'read', found.document);
  // Stored frontmatter is already validated; re-parse so a later schema change surfaces here.
  parseFrontmatter(found.document.type, found.version.frontmatter);
  return found;
}

export async function createVersionFor(
  db: Db,
  identity: Identity,
  rawId: unknown,
  body: unknown,
  log: Logger,
): Promise<Version> {
  const id = parse(idSchema, rawId, 'id');
  const found = await getDocument(db, id);
  if (!found) throw notFound('document');
  authorize(identity.caller, 'write', found.document);
  const input = parse(createVersionRequestSchema, body, 'version');
  const frontmatter = parse(
    schemaFor(found.document.type).schema,
    input.frontmatter,
    'frontmatter',
  );
  const version = await createVersion(db, id, {
    body: input.body,
    frontmatter,
    summary: input.summary,
    author: writerOf(identity).author,
    authoredAt: input.authoredAt ?? null,
  });
  log.info('version created', { documentId: id, number: version.number });
  return version;
}

/**
 * Replace a document's tags: the full set, validated against the type's vocabulary (a
 * recipe's facets and flags), needing the write scope for the type, logged as a tag change
 * rather than a version. The ring is untouched: tags say what a thing is, never who sees it.
 */
export async function setTagsFor(
  db: Db,
  identity: Identity,
  rawId: unknown,
  body: unknown,
  log: Logger,
): Promise<DocumentWithVersion> {
  const id = parse(idSchema, rawId, 'id');
  const found = await getDocument(db, id);
  if (!found) throw notFound('document');
  authorize(identity.caller, 'write', found.document);
  const input = parse(setTagsRequestSchema, body, 'tags');
  const tags = parse(schemaFor(found.document.type).tags, input.tags, 'tags');
  const updated = await setDocumentTags(db, id, tags, writerOf(identity).author);
  log.info('tags set', { documentId: id, tags });
  return updated;
}
