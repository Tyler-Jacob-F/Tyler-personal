import {
  createVersionRequestSchema,
  type DiffResponse,
  diffQuerySchema,
  type ListVersionsResponse,
  schemaFor,
} from '@the-keep/shared';
import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import { createVersion, getDocument, getVersion, listVersions } from '../db/repositories.js';
import { diffVersions } from '../lib/diff.js';
import { type ApiHandler, createApi, json, notFound, parse } from '../lib/http.js';
import { cognitoIdentity } from '../middleware/identity.js';
import { authorize } from '../middleware/permission.js';

const idSchema = z.uuid();
const numberSchema = z.coerce.number().int().positive();

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'versions',
    identify: cognitoIdentity(db),
    routes: {
      'GET /api/documents/{id}/versions': async ({ identity, params }) => {
        const id = parse(idSchema, params.id, 'id');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document.ring);
        const body: ListVersionsResponse = { items: await listVersions(db, id) };
        return json(200, body);
      },

      'POST /api/documents/{id}/versions': async ({ identity, params, body, log }) => {
        const id = parse(idSchema, params.id, 'id');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'write', found.document.ring);
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
          author: { kind: identity.caller.kind, id: identity.caller.id },
          authoredAt: input.authoredAt ?? null,
        });
        log.info('version created', { documentId: id, number: version.number });
        return json(201, version);
      },

      'GET /api/documents/{id}/versions/{number}': async ({ identity, params }) => {
        const id = parse(idSchema, params.id, 'id');
        const number = parse(numberSchema, params.number, 'version number');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document.ring);
        const version = await getVersion(db, id, number);
        if (!version) throw notFound('version');
        return json(200, version);
      },

      'GET /api/documents/{id}/diff': async ({ identity, params, query }) => {
        const id = parse(idSchema, params.id, 'id');
        const { from, to } = parse(diffQuerySchema, query, 'query');
        const found = await getDocument(db, id);
        if (!found) throw notFound('document');
        authorize(identity.caller, 'read', found.document.ring);
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
