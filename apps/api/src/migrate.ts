/**
 * CLI: apply pending migrations through the RDS Data API. Run from the deploy workflow
 * after `cdk deploy` with DB_CLUSTER_ARN, DB_SECRET_ARN and DB_NAME set.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDataApiClient,
  dataApiRunner,
  dataApiTargetFromEnv,
  MIGRATION_RESUME_RETRY,
} from './lib/data-api.js';
import { migrate, readMigrationFiles } from './lib/migrate.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
const target = dataApiTargetFromEnv();
const runner = dataApiRunner(createDataApiClient({}, MIGRATION_RESUME_RETRY), target);
const files = await readMigrationFiles(dir);
const applied = await migrate(runner, files, { log: (m) => console.log(m) });
console.log(applied.length ? `applied ${applied.length} migration(s)` : 'nothing to apply');
