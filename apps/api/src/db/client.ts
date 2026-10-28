import { drizzle } from 'drizzle-orm/aws-data-api/pg';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { createDataApiClient, dataApiTargetFromEnv, LAMBDA_RESUME_RETRY } from '../lib/data-api.js';
import * as schema from './schema.js';

/**
 * The database handle every repository function takes. Production hands it a Data API
 * driver; tests hand it PGlite. Same queries, same schema.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | undefined;

/** One Drizzle instance per Lambda container, built from the environment the stack sets. */
export function getDb(): Db {
  cached ??= drizzle(createDataApiClient({}, LAMBDA_RESUME_RETRY), {
    ...dataApiTargetFromEnv(),
    schema,
  });
  return cached;
}
