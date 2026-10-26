import type { DocumentWithVersion, ListDocumentsResponse } from '@the-keep/shared';
import { build } from '../../src/handlers/documents.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

const chili = {
  title: 'Chili',
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 180,
  ingredients: ['2 lb ground chuck', '1 onion, diced'],
};
const create = { type: 'recipe', frontmatter: chili, body: '# Chili\n\nBrown the beef.' };

let t: TestDb;
let api: ApiHandler;
beforeEach(async () => {
  t = await testDb();
  api = build(t.db);
});
afterEach(() => t.close());

async function createChili(): Promise<DocumentWithVersion> {
  const res = await api(fakeEvent({ method: 'POST', route: '/api/documents', body: create }));
  expect(res.statusCode).toBe(201);
  return bodyOf<DocumentWithVersion>(res);
}

describe('POST /api/documents', () => {
  it('creates a recipe in the me ring with version 1 authored by the admin', async () => {
    const created = await createChili();
    expect(created.document).toMatchObject({ type: 'recipe', slug: 'chili', ring: 'me', tags: [] });
    expect(created.version).toMatchObject({
      number: 1,
      summary: '',
      authoredAt: null,
      frontmatter: { ...chili, ingredients: [{ heading: null, items: chili.ingredients }] },
    });
    expect(created.version.author).toMatchObject({ kind: 'member', name: 'Tyler' });
    expect(created.version.author.id).toBe(created.document.owner);
  });

  it('stores ingredient groups, optional numbers left out, and an authored date', async () => {
    const res = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/documents',
        body: {
          type: 'recipe',
          frontmatter: {
            title: 'Three-Meat Chili',
            ingredients: [
              { heading: 'Meats (3 lb total)', items: ['1 lb beef', '1 lb lamb', '1 lb pork'] },
              { items: ['1 can Guinness'] },
            ],
          },
          body: 'Simmer 2–3 hr.',
          authoredAt: '2023-11-06',
        },
      }),
    );
    expect(res.statusCode).toBe(201);
    const created = bodyOf<DocumentWithVersion>(res);
    expect(created.version.authoredAt).toBe('2023-11-06T00:00:00.000Z');
    expect(created.version.frontmatter).toEqual({
      title: 'Three-Meat Chili',
      ingredients: [
        { heading: 'Meats (3 lb total)', items: ['1 lb beef', '1 lb lamb', '1 lb pork'] },
        { heading: null, items: ['1 can Guinness'] },
      ],
    });
  });

  it('validates frontmatter against the recipe schema', async () => {
    const res = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/documents',
        body: { ...create, frontmatter: { ...chili, ingredients: [], servings: 'eight' } },
      }),
    );
    expect(res.statusCode).toBe(400);
    const body = bodyOf<{ error: string; issues: Array<{ path: string }> }>(res);
    expect(body.error).toBe('bad_request');
    expect(body.issues.map((i) => i.path).sort()).toEqual(['ingredients.0.items', 'servings']);
  });

  it('rejects an unknown type and a malformed body', async () => {
    const unknown = await api(
      fakeEvent({ method: 'POST', route: '/api/documents', body: { ...create, type: 'essay' } }),
    );
    expect(unknown.statusCode).toBe(400);
    const malformed = await api(
      fakeEvent({ method: 'POST', route: '/api/documents', rawBody: '{not json' }),
    );
    expect(malformed.statusCode).toBe(400);
    expect(bodyOf<{ message: string }>(malformed).message).toMatch(/JSON/);
  });
});

describe('GET /api/documents', () => {
  it('lists recipes newest first with their current version', async () => {
    const a = await createChili();
    const b = await createChili();
    const res = await api(
      fakeEvent({ method: 'GET', route: '/api/documents', query: { type: 'recipe' } }),
    );
    expect(res.statusCode).toBe(200);
    const { items } = bodyOf<ListDocumentsResponse>(res);
    expect(items.map((i) => i.document.id)).toEqual([b.document.id, a.document.id]);
    expect(items[0]!.document.slug).toBe('chili-2');
  });

  it('rejects a bad limit', async () => {
    const res = await api(
      fakeEvent({ method: 'GET', route: '/api/documents', query: { limit: '0' } }),
    );
    expect(res.statusCode).toBe(400);
  });
});

describe('GET and DELETE /api/documents/{id}', () => {
  it('gets a document by id and 404s after a soft delete', async () => {
    const created = await createChili();
    const id = created.document.id;
    const got = await api(
      fakeEvent({ method: 'GET', route: '/api/documents/{id}', params: { id } }),
    );
    expect(got.statusCode).toBe(200);
    expect(bodyOf<DocumentWithVersion>(got).document.id).toBe(id);

    const del = await api(
      fakeEvent({ method: 'DELETE', route: '/api/documents/{id}', params: { id } }),
    );
    expect(del.statusCode).toBe(204);
    const gone = await api(
      fakeEvent({ method: 'GET', route: '/api/documents/{id}', params: { id } }),
    );
    expect(gone.statusCode).toBe(404);
    const again = await api(
      fakeEvent({ method: 'DELETE', route: '/api/documents/{id}', params: { id } }),
    );
    expect(again.statusCode).toBe(404);
  });

  it('400s a non-uuid id', async () => {
    const res = await api(
      fakeEvent({ method: 'GET', route: '/api/documents/{id}', params: { id: 'chili' } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('refuses a caller who is not a member', async () => {
    const res = await api(fakeEvent({ method: 'GET', route: '/api/documents', email: 'x@y.z' }));
    expect(res.statusCode).toBe(403);
  });
});
