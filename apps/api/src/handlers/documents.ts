import {
  createDocumentRequestSchema,
  type ListDocumentsResponse,
  listDocumentsQuerySchema,
  parseFrontmatter,
  schemaFor,
} from '@the-keep/shared';
import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import {
  createDocument,
  getDocument,
  listDocuments,
  softDeleteDocument,
} from '../db/repositories.js';
import { type ApiHandler, createApi, json, noContent, notFound, parse } from '../lib/http.js';
import { agentIdentity, cognitoIdentity } from '../middleware/identity.js';
import { authorize } from '../middleware/permission.js';

const idSchema = z.uuid();

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'documents',
    identify: { member: cognitoIdentity(db), agent: agentIdentity(db) },
    routes: {
      'GET /api/documents': async ({ identity, query }) => {
        const { type, limit } = parse(listDocumentsQuerySchema, query, 'query');
        const items = await listDocuments(db, { type, limit });
        const visible = items.filter((item) =>
          authorizeQuietly(identity.caller, 'read', item.document),
        );
        const body: ListDocumentsResponse = { items: visible };
        return json(200, body);
      },

      'POST /api/documents': async ({ identity, body, log }) => {
        const input = parse(createDocumentRequestSchema, body, 'document');
        const frontmatter = parse(schemaFor(input.type).schema, input.frontmatter, 'frontmatter');
        const ring = schemaFor(input.type).defaultRing;
        authorize(identity.caller, 'write', { ring, type: input.type });
        const created = await createDocument(db, {
          type: input.type,
          title: frontmatter.title,
          ring,
          owner: identity.owner,
          tags: input.tags,
          body: input.body,
          frontmatter,
          summary: input.summary,
          author: { kind: identity.caller.kind, id: identity.caller.id },
          authoredAt: input.authoredAt ?? null,
        });
        log.info('document created', {
          documentId: created.document.id,
          type: input.type,
          slug: created.document.slug,
        });
        return json(201, created);
      },

      'GET /api/documents/{id}': async ({ identity, params }) => {
        const id = parse(idSchema, params.id, 'id');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document);
        // Stored frontmatter is already validated; re-parse so a later schema change surfaces here.
        parseFrontmatter(found.document.type, found.version.frontmatter);
        return json(200, found);
      },

      'DELETE /api/documents/{id}': async ({ identity, params, log }) => {
        const id = parse(idSchema, params.id, 'id');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'delete', found.document);
        await softDeleteDocument(db, id);
        log.info('document deleted', { documentId: id });
        return noContent();
      },
    },
  });
}

function authorizeQuietly(...args: Parameters<typeof authorize>): boolean {
  try {
    authorize(...args);
    return true;
  } catch {
    return false;
  }
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
