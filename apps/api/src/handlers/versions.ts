import { type DiffResponse, diffQuerySchema, type ListVersionsResponse } from '@the-keep/shared';
import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import { getDocument, getVersion, listVersions } from '../db/repositories.js';
import { diffVersions } from '../lib/diff.js';
import { type ApiHandler, createApi, json, notFound, parse } from '../lib/http.js';
import { agentIdentity, cognitoIdentity } from '../middleware/identity.js';
import { authorize } from '../middleware/permission.js';
import { createVersionFor } from '../services/documents.js';

const idSchema = z.uuid();
const numberSchema = z.coerce.number().int().positive();

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'versions',
    identify: { member: cognitoIdentity(db), agent: agentIdentity(db) },
    routes: {
      'GET /api/documents/{id}/versions': async ({ identity, params }) => {
        const id = parse(idSchema, params.id, 'id');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document);
        const body: ListVersionsResponse = { items: await listVersions(db, id) };
        return json(200, body);
      },

      'POST /api/documents/{id}/versions': async ({ identity, params, body, log }) =>
        json(201, await createVersionFor(db, identity, params.id, body, log)),

      'GET /api/documents/{id}/versions/{number}': async ({ identity, params }) => {
        const id = parse(idSchema, params.id, 'id');
        const number = parse(numberSchema, params.number, 'version number');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document);
        const version = await getVersion(db, id, number);
        if (!version) throw notFound('version');
        return json(200, version);
      },

      'GET /api/documents/{id}/diff': async ({ identity, params, query }) => {
        const id = parse(idSchema, params.id, 'id');
        const { from, to } = parse(diffQuerySchema, query, 'query');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document);
        const [a, b] = await Promise.all([getVersion(db, id, from), getVersion(db, id, to)]);
        if (!a) throw notFound(`version ${from}`);
        if (!b) throw notFound(`version ${to}`);
        const body: DiffResponse = diffVersions(found.document.type, found.document.slug, a, b);
        return json(200, body);
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
