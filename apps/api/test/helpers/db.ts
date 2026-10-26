import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Db } from '../../src/db/client.js';
import * as schema from '../../src/db/schema.js';
import { migratedPglite } from './pglite.js';

export interface TestDb {
  db: Db;
  pg: PGlite;
  close(): Promise<void>;
}

/** A migrated in-memory database behind the same Drizzle schema production uses. */
export async function testDb(): Promise<TestDb> {
  const pg = await migratedPglite();
  const db = drizzle(pg, { schema });
  return { db, pg, close: () => pg.close() };
}

/** The seeded admin's member id. */
export async function adminId(db: Db): Promise<string> {
  const rows = await db.select({ id: schema.member.id }).from(schema.member).limit(1);
  return rows[0]!.id;
}
