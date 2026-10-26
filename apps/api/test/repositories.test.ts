import {
  createDocument,
  createVersion,
  findMemberByEmail,
  getDocument,
  getVersion,
  listDocuments,
  listVersions,
  type NewDocument,
  softDeleteDocument,
} from '../src/db/repositories.js';
import { toIso } from '../src/db/time.js';
import { adminId, testDb, type TestDb } from './helpers/db.js';

const chili = {
  title: 'Chili',
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 180,
  ingredients: ['2 lb ground chuck', '1 onion'],
};

let t: TestDb;
let owner: string;

function newDoc(overrides: Partial<NewDocument> = {}): NewDocument {
  return {
    type: 'recipe',
    title: 'Chili',
    ring: 'me',
    owner,
    tags: ['weeknight'],
    body: '# Chili\n\nBrown the beef.',
    frontmatter: chili,
    summary: '',
    author: { kind: 'member', id: owner },
    ...overrides,
  };
}

beforeEach(async () => {
  t = await testDb();
  owner = await adminId(t.db);
});

afterEach(() => t.close());

describe('members', () => {
  it('finds the seeded admin by email, case-insensitively', async () => {
    const found = await findMemberByEmail(t.db, 'Tyler.Fuqua@icloud.com');
    expect(found?.role).toBe('admin');
    expect(await findMemberByEmail(t.db, 'nobody@example.com')).toBeNull();
  });
});

describe('documents', () => {
  it('creates a document with version 1 and records the author', async () => {
    const created = await createDocument(t.db, newDoc());
    expect(created.document.slug).toBe('chili');
    expect(created.document.ring).toBe('me');
    expect(created.document.tags).toEqual(['weeknight']);
    expect(created.document.currentVersionId).toBe(created.version.id);
    expect(created.version.number).toBe(1);
    expect(created.version.frontmatter).toEqual(chili);
    expect(created.version.author).toEqual({ kind: 'member', id: owner, name: 'Tyler' });
    expect(created.version.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(created.version.authoredAt).toBeNull();
  });

  it('keeps an authored date distinct from the audit timestamp', async () => {
    const created = await createDocument(t.db, newDoc({ authoredAt: '2014-03-03T00:00:00.000Z' }));
    expect(created.version.authoredAt).toBe('2014-03-03T00:00:00.000Z');
    expect(created.version.createdAt).not.toBe(created.version.authoredAt);
  });

  it('suffixes the slug on collision', async () => {
    await createDocument(t.db, newDoc());
    const second = await createDocument(t.db, newDoc());
    const third = await createDocument(t.db, newDoc({ title: 'chili!' }));
    expect(second.document.slug).toBe('chili-2');
    expect(third.document.slug).toBe('chili-3');
  });

  it('lists live documents newest first with their current version', async () => {
    const a = await createDocument(t.db, newDoc({ title: 'A' }));
    const b = await createDocument(t.db, newDoc({ title: 'B' }));
    const items = await listDocuments(t.db, { limit: 10 });
    expect(items.map((i) => i.document.id)).toEqual([b.document.id, a.document.id]);
    expect(items[0]!.version.number).toBe(1);
    expect(await listDocuments(t.db, { type: 'essay', limit: 10 })).toEqual([]);
    expect(await listDocuments(t.db, { type: 'recipe', limit: 1 })).toHaveLength(1);
  });

  it('soft deletes: gone from get and list, versions untouched', async () => {
    const created = await createDocument(t.db, newDoc());
    expect(await softDeleteDocument(t.db, created.document.id)).toBe(true);
    expect(await softDeleteDocument(t.db, created.document.id)).toBe(false);
    expect(await getDocument(t.db, created.document.id)).toBeNull();
    expect(await listDocuments(t.db, { limit: 10 })).toEqual([]);
    const rows = await t.pg.query('select count(*)::int as n from version');
    expect(rows.rows[0]).toEqual({ n: 1 });
  });

  it('returns null for an unknown id', async () => {
    expect(await getDocument(t.db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});

describe('versions', () => {
  it('appends a version, bumps the number and moves the current pointer', async () => {
    const created = await createDocument(t.db, newDoc());
    const v2 = await createVersion(t.db, created.document.id, {
      body: '# Chili\n\nBrown the beef. Add smoked paprika.',
      frontmatter: { ...chili, ingredients: [...chili.ingredients, '1 tsp smoked paprika'] },
      summary: 'added smoked paprika',
      author: { kind: 'member', id: owner },
    });
    expect(v2.number).toBe(2);
    expect(v2.summary).toBe('added smoked paprika');
    const current = await getDocument(t.db, created.document.id);
    expect(current?.document.currentVersionId).toBe(v2.id);
    expect(current?.version.number).toBe(2);
    expect(current?.document.slug).toBe('chili');
  });

  it('lists and gets versions, newest first', async () => {
    const created = await createDocument(t.db, newDoc());
    await createVersion(t.db, created.document.id, {
      body: 'v2',
      frontmatter: chili,
      summary: 'second',
      author: { kind: 'member', id: owner },
    });
    const all = await listVersions(t.db, created.document.id);
    expect(all.map((v) => v.number)).toEqual([2, 1]);
    const first = await getVersion(t.db, created.document.id, 1);
    expect(first?.body).toBe('# Chili\n\nBrown the beef.');
    expect(await getVersion(t.db, created.document.id, 9)).toBeNull();
  });

  it('refuses a version on an unknown or deleted document', async () => {
    const input = {
      body: '',
      frontmatter: chili,
      summary: '',
      author: { kind: 'member' as const, id: owner },
    };
    await expect(
      createVersion(t.db, '00000000-0000-0000-0000-000000000000', input),
    ).rejects.toThrow(/not found/);
    const created = await createDocument(t.db, newDoc());
    await softDeleteDocument(t.db, created.document.id);
    await expect(createVersion(t.db, created.document.id, input)).rejects.toThrow(/not found/);
    expect(await listVersions(t.db, created.document.id)).toEqual([]);
  });
});

describe('toIso', () => {
  it('normalizes PGlite and Data API timestamp text to ISO 8601', () => {
    expect(toIso('2026-10-26 12:00:00.123456+00')).toBe('2026-10-26T12:00:00.123Z');
    expect(toIso('2026-10-26 12:00:00.5')).toBe('2026-10-26T12:00:00.500Z');
    expect(toIso('2026-10-26 12:00:00')).toBe('2026-10-26T12:00:00.000Z');
    expect(toIso('2026-10-26 07:00:00-05')).toBe('2026-10-26T12:00:00.000Z');
    expect(toIso(new Date('2026-10-26T12:00:00.000Z'))).toBe('2026-10-26T12:00:00.000Z');
  });
});
