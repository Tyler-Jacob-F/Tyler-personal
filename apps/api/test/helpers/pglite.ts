import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Field } from '@aws-sdk/client-rds-data';
import type { SqlRunner } from '../../src/lib/data-api.js';
import { readMigrationFiles } from '../../src/lib/migrate.js';

export const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);

/** Content imports (`NNNN_import_*.sql`) are data, not shape; unit tests start without them. */
export const isImportMigration = (name: string) => /^\d{4}_import_/.test(name);

/** A fresh in-memory Postgres with every schema migration applied, imports optional. */
export async function migratedPglite({ includeImports = false } = {}): Promise<PGlite> {
  const pg = new PGlite();
  const files = await readMigrationFiles(migrationsDir);
  for (const file of files) {
    if (includeImports || !isImportMigration(file.name)) await pg.exec(file.sql);
  }
  return pg;
}

/**
 * The migration runner's view of a database, backed by PGlite. Mirrors what the Data API
 * returns closely enough for the runner: rows as Field[][] with stringValue cells.
 */
export function pgliteRunner(pg: PGlite): SqlRunner {
  let inTransaction = false;
  return {
    async execute(sql) {
      const result = await pg.query<Record<string, unknown>>(sql);
      return result.rows.map((row) =>
        Object.values(row).map((value): Field => ({ stringValue: String(value) })),
      );
    },
    async begin() {
      if (inTransaction) throw new Error('nested transaction');
      inTransaction = true;
      await pg.exec('begin');
      return 'tx';
    },
    async commit() {
      inTransaction = false;
      await pg.exec('commit');
    },
    async rollback() {
      inTransaction = false;
      await pg.exec('rollback');
    },
  };
}
