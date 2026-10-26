import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { type IngredientGroup, recipeFrontmatterSchema } from '@the-keep/shared';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db/schema.js';
import { getDocument, listDocuments, listVersions } from '../src/db/repositories.js';
import { build } from '../src/handlers/documents.js';
import { bodyOf, fakeEvent } from './helpers/event.js';
import { migratedPglite, migrationsDir } from './helpers/pglite.js';

const file = path.join(migrationsDir, '0004_import_chili_lineage.sql');

describe('0004_import_chili_lineage', () => {
  it('carries only frontmatter the shared recipe schema accepts', async () => {
    const sql = await readFile(file, 'utf8');
    const blobs = [...sql.matchAll(/\$x\$(\{.*?\})\$x\$::jsonb/gs)].map((m) => JSON.parse(m[1]!));
    expect(blobs).toHaveLength(5);
    for (const blob of blobs) {
      const parsed = recipeFrontmatterSchema.parse(blob);
      expect(parsed.servings).toBeUndefined();
      expect(parsed.ingredients.length).toBeGreaterThan(0);
    }
  });

  it("loads Steve's chili and four dated versions of Tyler's, authored by the admin, idempotently", async () => {
    const pg = await migratedPglite({ includeImports: true });
    const db = drizzle(pg, { schema });

    const docs = await listDocuments(db, { type: 'recipe', limit: 10 });
    expect(docs.map((d) => d.document.slug).sort()).toEqual([
      'steves-famous-chili',
      'tylers-chili',
    ]);

    const tylers = docs.find((d) => d.document.slug === 'tylers-chili')!;
    expect(tylers.version.number).toBe(4);
    expect(tylers.document.currentVersionId).toBe(tylers.version.id);
    expect(tylers.version.author.name).toBe('Tyler');
    expect(tylers.version.frontmatter.title).toBe("Tyler's Signature Chili");

    const versions = await listVersions(db, tylers.document.id);
    expect(versions.map((v) => [v.number, v.authoredAt?.slice(0, 10) ?? null])).toEqual([
      [4, null],
      [3, '2025-11-02'],
      [2, '2025-01-31'],
      [1, '2023-11-06'],
    ]);
    expect(versions[1]!.summary).toMatch(/Clean Smoke/);
    const v4 = recipeFrontmatterSchema.parse(versions[0]!.frontmatter);
    const headings = v4.ingredients.map((g: IngredientGroup) => g.heading);
    expect(headings).toContain('Chile blend (~7 Tbsp total)');
    expect(versions[0]!.body).toContain('Guinness out, Negra Modelo in');

    const steves = docs.find((d) => d.document.slug === 'steves-famous-chili')!;
    expect(steves.version.authoredAt?.slice(0, 10)).toBe('2014-03-03');
    expect((await listVersions(db, steves.document.id)).length).toBe(1);

    // Running the import again changes nothing.
    const sql = await readFile(file, 'utf8');
    await pg.exec(sql);
    expect((await listVersions(db, tylers.document.id)).length).toBe(4);
    expect(await getDocument(db, tylers.document.id)).toMatchObject({ version: { number: 4 } });

    // And the API serves it, re-validating stored frontmatter on the way out.
    const res = await build(db)(
      fakeEvent({
        method: 'GET',
        route: '/api/documents/{id}',
        params: { id: tylers.document.id },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(bodyOf<{ version: { number: number } }>(res).version.number).toBe(4);
    await pg.close();
  });
});
