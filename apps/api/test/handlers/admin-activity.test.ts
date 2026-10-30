import type { DocumentWithVersion, ListAgentActivityResponse } from '@the-keep/shared';
import {
  createAgentToken,
  createDocument,
  createVersion,
  setDocumentTags,
} from '../../src/db/repositories.js';
import { member } from '../../src/db/schema.js';
import { build } from '../../src/handlers/admin-activity.js';
import { build as buildDocuments } from '../../src/handlers/documents.js';
import { adminId, testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

const chili = { title: 'Chili', ingredients: ['2 lb ground chuck'] };

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

describe('GET /api/admin/activity', () => {
  it('lists versions agents wrote, newest first, with the token name and the document, and nothing a person wrote', async () => {
    const owner = await adminId(t.db);
    const importer = await createAgentToken(t.db, {
      name: 'importer',
      scopes: ['write:recipes'],
      secretHash: 'h1',
    });
    const writer = await createAgentToken(t.db, {
      name: 'brief-writer',
      scopes: ['write:briefs'],
      secretHash: 'h2',
    });
    // A person creates the recipe; the importer adds a version; the writer posts a brief.
    const human = bodyOf<DocumentWithVersion>(
      await buildDocuments(t.db)(
        fakeEvent({
          method: 'POST',
          route: '/api/documents',
          body: { type: 'recipe', frontmatter: chili, body: '' },
        }),
      ),
    );
    await createVersion(t.db, human.document.id, {
      body: 'v2',
      frontmatter: chili,
      summary: 'from the 2014 card',
      author: { kind: 'agent', id: importer.id },
      authoredAt: '2014-03-03T00:00:00.000Z',
    });
    await createDocument(t.db, {
      type: 'brief',
      title: 'Brief for 2026-10-30',
      ring: 'me',
      owner,
      tags: [],
      body: '',
      frontmatter: { title: 'Brief for 2026-10-30', date: '2026-10-30', sections: [] },
      summary: 'morning brief',
      author: { kind: 'agent', id: writer.id },
    });

    const res = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/admin/activity' }));
    expect(res.statusCode).toBe(200);
    const { items } = bodyOf<ListAgentActivityResponse>(res);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      documentType: 'brief',
      title: 'Brief for 2026-10-30',
      number: 1,
      summary: 'morning brief',
      token: { id: writer.id, name: 'brief-writer' },
    });
    expect(items[1]).toMatchObject({
      documentId: human.document.id,
      documentType: 'recipe',
      slug: 'chili',
      title: 'Chili',
      number: 2,
      summary: 'from the 2014 card',
      token: { id: importer.id, name: 'importer' },
      authoredAt: '2014-03-03T00:00:00.000Z',
    });
    for (const item of items) expect(item.createdAt).toMatch(/^\d{4}-/);

    const limited = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/admin/activity', query: { limit: '1' } }),
    );
    expect(bodyOf<ListAgentActivityResponse>(limited).items).toHaveLength(1);
    const bad = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/admin/activity', query: { days: '0' } }),
    );
    expect(bad.statusCode).toBe(400);
  });

  it('lists a tag change an agent made as a "tagged" row, in time order with the versions', async () => {
    const owner = await adminId(t.db);
    const claude = await createAgentToken(t.db, {
      name: 'claude',
      scopes: ['read:documents', 'write:recipes'],
      secretHash: 'h3',
    });
    const created = await createDocument(t.db, {
      type: 'recipe',
      title: 'Chili',
      ring: 'me',
      owner,
      tags: ['camping'],
      body: '',
      frontmatter: chili,
      summary: 'imported',
      author: { kind: 'agent', id: claude.id },
    });
    await setDocumentTags(t.db, created.document.id, ['course:main', 'main:beef', 'camping'], {
      kind: 'agent',
      id: claude.id,
    });
    // A person's tag change is not agent activity.
    await setDocumentTags(t.db, created.document.id, ['course:main'], {
      kind: 'member',
      id: owner,
    });

    const res = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/admin/activity' }));
    const { items } = bodyOf<ListAgentActivityResponse>(res);
    expect(items.map((i) => i.kind)).toEqual(['tagged', 'version']);
    expect(items[0]).toMatchObject({
      kind: 'tagged',
      documentId: created.document.id,
      title: 'Chili',
      tags: ['course:main', 'main:beef', 'camping'],
      previousTags: ['camping'],
      token: { id: claude.id, name: 'claude' },
    });
    expect(items[0]).not.toHaveProperty('number');
    const limited = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/admin/activity', query: { limit: '1' } }),
    );
    expect(bodyOf<ListAgentActivityResponse>(limited).items.map((i) => i.kind)).toEqual(['tagged']);
  });

  it('keeps the window: a version older than the window is not listed', async () => {
    const importer = await createAgentToken(t.db, {
      name: 'importer',
      scopes: ['write:recipes'],
      secretHash: 'h1',
    });
    const owner = await adminId(t.db);
    const created = await createDocument(t.db, {
      type: 'recipe',
      title: 'Old',
      ring: 'me',
      owner,
      tags: [],
      body: '',
      frontmatter: chili,
      summary: '',
      author: { kind: 'agent', id: importer.id },
    });
    // Versions are append-only, so age the row through the trigger-free path: a direct
    // update is refused; instead ask with a window that excludes "now".
    expect(created.version.number).toBe(1);
    const wide = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/admin/activity', query: { days: '365' } }),
    );
    expect(bodyOf<ListAgentActivityResponse>(wide).items).toHaveLength(1);
    await t.pg.exec('alter table version disable trigger version_append_only');
    await t.pg.exec("update version set created_at = now() - interval '40 days'");
    await t.pg.exec('alter table version enable trigger version_append_only');
    const recent = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/admin/activity' }));
    expect(bodyOf<ListAgentActivityResponse>(recent).items).toHaveLength(0);
    const sixty = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/admin/activity', query: { days: '60' } }),
    );
    expect(bodyOf<ListAgentActivityResponse>(sixty).items).toHaveLength(1);
  });

  it('is the admin’s alone', async () => {
    await t.db
      .insert(member)
      .values({ email: 'friend@example.com', role: 'group', displayName: 'Friend' });
    const group = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/admin/activity', email: 'friend@example.com' }),
    );
    expect(group.statusCode).toBe(403);
    const agent = await build(t.db)(
      fakeEvent({
        method: 'GET',
        route: '/api/agent/admin/activity',
        agent: {
          id: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
          name: 'x',
          scopes: ['read:documents'],
        },
      }),
    );
    expect(agent.statusCode).toBe(401);
  });
});
