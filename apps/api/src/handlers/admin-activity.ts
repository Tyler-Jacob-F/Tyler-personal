import { type ListAgentActivityResponse, listAgentActivityQuerySchema } from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { listAgentActivity } from '../db/repositories.js';
import { type ApiHandler, createApi, json, parse } from '../lib/http.js';
import { cognitoIdentity } from '../middleware/identity.js';
import { requireAdmin } from '../middleware/permission.js';

/**
 * What the agents have been writing, for the admin alone (docs/DESIGN.md: "the admin UI
 * lists recent agent activity separately from human activity"). Members' door only.
 */
export function build(db: Db): ApiHandler {
  return createApi({
    service: 'admin-activity',
    identify: { member: cognitoIdentity(db) },
    routes: {
      'GET /api/admin/activity': async ({ identity, query }) => {
        requireAdmin(identity.caller);
        const options = parse(listAgentActivityQuerySchema, query, 'query');
        const body: ListAgentActivityResponse = { items: await listAgentActivity(db, options) };
        return json(200, body);
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
