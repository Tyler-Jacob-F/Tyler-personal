import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import { getDocument, softDeleteDocument } from '../db/repositories.js';
import { type ApiHandler, createApi, json, noContent, notFound, parse } from '../lib/http.js';
import { agentIdentity, cognitoIdentity } from '../middleware/identity.js';
import { authorize } from '../middleware/permission.js';
import {
  createDocumentFor,
  getDocumentFor,
  listDocumentsFor,
  setTagsFor,
} from '../services/documents.js';

const idSchema = z.uuid();

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'documents',
    identify: { member: cognitoIdentity(db), agent: agentIdentity(db) },
    routes: {
      'GET /api/documents': async ({ identity, query }) =>
        json(200, await listDocumentsFor(db, identity, query)),

      'POST /api/documents': async ({ identity, body, log }) =>
        json(201, await createDocumentFor(db, identity, body, log)),

      'GET /api/documents/{id}': async ({ identity, params }) =>
        json(200, await getDocumentFor(db, identity, params.id)),

      // The whole tag set, replaced; no version. Both doors, since the tagging pass over
      // the Phase 2 import runs through the MCP server with the same service function.
      'PUT /api/documents/{id}/tags': async ({ identity, params, body, log }) =>
        json(200, await setTagsFor(db, identity, params.id, body, log)),

      // Delete has no agent counterpart: the agent door never exposes it, and the
      // permission middleware refuses it regardless.
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

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
