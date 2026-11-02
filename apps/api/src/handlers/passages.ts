import { type Db, getDb } from '../db/client.js';
import { type ApiHandler, createApi, json } from '../lib/http.js';
import { cognitoIdentity, groupIdentity } from '../middleware/identity.js';
import { type PassageOptions, resolvePassage } from '../services/scripture.js';

/**
 * `GET /api/passages?ref=…&translation=…`: a reading as text, for the guide's "Scripture"
 * sections. Scripture is nobody's document, so there is no ring to check: anyone through
 * the people's or the group's door reads it. A passage never changes, so the browser may
 * keep it a day.
 */
export function build(db: Db, options: PassageOptions = {}): ApiHandler {
  return createApi({
    service: 'passages',
    identify: { member: cognitoIdentity(db), group: groupIdentity(db) },
    routes: {
      'GET /api/passages': async ({ query }) => {
        const result = json(200, await resolvePassage(query, options));
        return {
          ...result,
          headers: { ...result.headers, 'cache-control': 'private, max-age=86400' },
        };
      },
    },
  });
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
