import { type Db, getDb } from '../db/client.js';
import { softDeleteDocument } from '../db/repositories.js';
import { type ApiHandler, createApi, json, noContent } from '../lib/http.js';
import { agentIdentity, cognitoIdentity, groupIdentity } from '../middleware/identity.js';
import {
  createDocumentFor,
  getDocumentFor,
  listDocumentsFor,
  loadDocumentFor,
  searchDocumentsFor,
  setTagsFor,
} from '../services/documents.js';

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'documents',
    // Three doors. The group's door reaches only the read routes in the gateway (infra);
    // the permission middleware refuses a device every write regardless.
    identify: { member: cognitoIdentity(db), agent: agentIdentity(db), group: groupIdentity(db) },
    routes: {
      'GET /api/documents': async ({ identity, query }) =>
        json(200, await listDocumentsFor(db, identity, query)),

      'POST /api/documents': async ({ identity, body, log }) =>
        json(201, await createDocumentFor(db, identity, body, log)),

      // Static before the {id} template; the gateway routes it the same way.
      'GET /api/documents/search': async ({ identity, query }) =>
        json(200, await searchDocumentsFor(db, identity, query)),

      'GET /api/documents/{id}': async ({ identity, params }) =>
        json(200, await getDocumentFor(db, identity, params.id)),

      // The whole tag set, replaced; no version. Both doors, since the tagging pass over
      // the Phase 2 import runs through the MCP server with the same service function.
      'PUT /api/documents/{id}/tags': async ({ identity, params, body, log }) =>
        json(200, await setTagsFor(db, identity, params.id, body, log)),

      // Delete has no agent counterpart: the agent door never exposes it, and the
      // permission middleware refuses it regardless.
      'DELETE /api/documents/{id}': async ({ identity, params, log }) => {
        const { document } = await loadDocumentFor(db, identity, params.id, 'delete');
        await softDeleteDocument(db, document.id);
        log.info('document deleted', { documentId: document.id });
        return noContent();
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
