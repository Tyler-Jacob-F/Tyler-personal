import type { PGlite } from '@electric-sql/pglite';
import { migrate, readMigrationFiles } from '../src/lib/migrate.js';
import { migrationsDir, pgliteRunner } from './helpers/pglite.js';

async function freshPglite(): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite');
  return new PGlite();
}

describe('migration runner', () => {
  it('applies the real migration files once, in order, and records them', async () => {
    const pg = await freshPglite();
    const runner = pgliteRunner(pg);
    const files = await readMigrationFiles(migrationsDir);
    const names = [
      '0001_spine.sql',
      '0002_admin_member.sql',
      '0003_version_authored_at.sql',
      '0004_import_chili_lineage.sql',
      '0005_tag_change.sql',
    ];
    expect(files.map((f) => f.name)).toEqual(names);

    const first = await migrate(runner, files);
    expect(first).toEqual(names);

    const second = await migrate(runner, files);
    expect(second).toEqual([]);

    const recorded = await pg.query<{ name: string }>(
      'select name from schema_migration order by name',
    );
    expect(recorded.rows.map((r) => r.name)).toEqual(names);

    const tables = await pg.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      'agent_token',
      'attachment',
      'document',
      'member',
      'schema_migration',
      'tag_change',
      'version',
    ]);
    await pg.close();
  });

  it('seeds exactly one admin member', async () => {
    const pg = await freshPglite();
    await migrate(pgliteRunner(pg), await readMigrationFiles(migrationsDir));
    const admins = await pg.query<{ email: string; role: string }>(
      'select email, role from member',
    );
    expect(admins.rows).toEqual([{ email: 'tyler.fuqua@icloud.com', role: 'admin' }]);
    await pg.close();
  });

  it('rolls a failing file back and records nothing for it', async () => {
    const pg = await freshPglite();
    const runner = pgliteRunner(pg);
    const files = [
      { name: '0001_ok.sql', sql: 'create table ok (id int);' },
      { name: '0002_bad.sql', sql: 'create table bad (id int); select * from missing;' },
    ];
    await expect(migrate(runner, files)).rejects.toThrow(/0002_bad.sql failed/);
    const recorded = await pg.query<{ name: string }>('select name from schema_migration');
    expect(recorded.rows.map((r) => r.name)).toEqual(['0001_ok.sql']);
    const bad = await pg.query("select to_regclass('bad') as t");
    expect(bad.rows[0]).toEqual({ t: null });
    await pg.close();
  });
});

describe('0001_spine', () => {
  it('keeps version rows append-only', async () => {
    const pg = await freshPglite();
    await migrate(pgliteRunner(pg), await readMigrationFiles(migrationsDir));
    const member = await pg.query<{ id: string }>('select id from member limit 1');
    const doc = await pg.query<{ id: string }>(
      "insert into document (type, slug, owner) values ('recipe', 'chili', $1) returning id",
      [member.rows[0]!.id],
    );
    const version = await pg.query<{ id: string }>(
      "insert into version (document_id, number, body, frontmatter, author_member_id) values ($1, 1, 'x', '{}', $2) returning id",
      [doc.rows[0]!.id, member.rows[0]!.id],
    );
    const id = version.rows[0]!.id;
    await expect(pg.query("update version set body = 'y' where id = $1", [id])).rejects.toThrow(
      /append-only/,
    );
    await expect(pg.query('delete from version where id = $1', [id])).rejects.toThrow(
      /append-only/,
    );
    await pg.close();
  });

  it('requires exactly one author on a version', async () => {
    const pg = await freshPglite();
    await migrate(pgliteRunner(pg), await readMigrationFiles(migrationsDir));
    const member = await pg.query<{ id: string }>('select id from member limit 1');
    const doc = await pg.query<{ id: string }>(
      "insert into document (type, slug, owner) values ('recipe', 'chili', $1) returning id",
      [member.rows[0]!.id],
    );
    await expect(
      pg.query(
        "insert into version (document_id, number, body, frontmatter) values ($1, 1, 'x', '{}')",
        [doc.rows[0]!.id],
      ),
    ).rejects.toThrow(/check constraint/);
    await pg.close();
  });
});
