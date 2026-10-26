import type { MeResponse } from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { type ApiHandler, createApi, json } from '../lib/http.js';
import { cognitoIdentity } from '../middleware/identity.js';

export function build(db: Db): ApiHandler {
  return createApi({
    service: 'me',
    identify: cognitoIdentity(db),
    routes: {
      'GET /api/me': async ({ identity }) => {
        const body: MeResponse = identity;
        return json(200, body);
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
