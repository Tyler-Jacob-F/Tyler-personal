import { type DiffResponse, diffQuerySchema, type ListVersionsResponse } from '@the-keep/shared';
import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import { getVersion, listVersions } from '../db/repositories.js';
import { diffVersions } from '../lib/diff.js';
import { type ApiHandler, createApi, json, notFound, parse } from '../lib/http.js';
import { agentIdentity, cognitoIdentity } from '../middleware/identity.js';
import { createVersionFor, loadDocumentFor } from '../services/documents.js';

const numberSchema = z.coerce.number().int().positive();

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'versions',
    identify: { member: cognitoIdentity(db), agent: agentIdentity(db) },
    routes: {
      'GET /api/documents/{id}/versions': async ({ identity, params }) => {
        const { document } = await loadDocumentFor(db, identity, params.id, 'read');
        const body: ListVersionsResponse = { items: await listVersions(db, document.id) };
        return json(200, body);
      },

      'POST /api/documents/{id}/versions': async ({ identity, params, body, log }) =>
        json(201, await createVersionFor(db, identity, params.id, body, log)),

      'GET /api/documents/{id}/versions/{number}': async ({ identity, params }) => {
        const number = parse(numberSchema, params.number, 'version number');
        const { document } = await loadDocumentFor(db, identity, params.id, 'read');
        const version = await getVersion(db, document.id, number);
        if (!version) throw notFound('version');
        return json(200, version);
      },

      'GET /api/documents/{id}/diff': async ({ identity, params, query }) => {
        const { from, to } = parse(diffQuerySchema, query, 'query');
        const { document } = await loadDocumentFor(db, identity, params.id, 'read');
        const [a, b] = await Promise.all([
          getVersion(db, document.id, from),
          getVersion(db, document.id, to),
        ]);
        if (!a) throw notFound(`version ${from}`);
        if (!b) throw notFound(`version ${to}`);
        const body: DiffResponse = diffVersions(document.type, document.slug, a, b);
        return json(200, body);
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
