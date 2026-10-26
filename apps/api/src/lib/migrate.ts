import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SqlRunner } from './data-api.js';
import { splitSqlStatements } from './sql-split.js';

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface MigrateOptions {
  log?: (message: string) => void;
}

const MIGRATION_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

/** Read `NNNN_name.sql` files in order. Anything else in the directory is ignored. */
export async function readMigrationFiles(dir: string): Promise<MigrationFile[]> {
  const names = (await readdir(dir)).filter((name) => MIGRATION_NAME.test(name)).sort();
  return Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(path.join(dir, name), 'utf8') })),
  );
}

/**
 * Apply every migration not yet recorded in `schema_migration`, each in its own
 * transaction, in file order. Idempotent: a second run applies nothing.
 */
export async function migrate(
  runner: SqlRunner,
  files: MigrationFile[],
  { log = () => {} }: MigrateOptions = {},
): Promise<string[]> {
  await runner.execute(
    'create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())',
  );
  const rows = await runner.execute('select name from schema_migration order by name');
  const applied = new Set(rows.map((row) => row[0]?.stringValue));

  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const done: string[] = [];
  for (const file of sorted) {
    if (applied.has(file.name)) {
      log(`skip ${file.name} (applied)`);
      continue;
    }
    const statements = splitSqlStatements(file.sql);
    const transactionId = await runner.begin();
    try {
      for (const statement of statements) await runner.execute(statement, transactionId);
      await runner.execute(
        `insert into schema_migration (name) values ('${file.name.replace(/'/g, "''")}')`,
        transactionId,
      );
      await runner.commit(transactionId);
    } catch (error) {
      await runner.rollback(transactionId).catch(() => {});
      throw new Error(`migration ${file.name} failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
    log(`applied ${file.name} (${statements.length} statements)`);
    done.push(file.name);
  }
  return done;
}
