import type { DocumentWithVersion, ListDocumentsResponse } from '@the-keep/shared';
import { build } from '../../src/handlers/documents.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

const chili = {
  title: 'Chili',
  serves: 8,
  activeMinutes: 20,
  totalMinutes: 180,
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
        body: { ...create, frontmatter: { ...chili, ingredients: [], serves: 'eight' } },
      }),
    );
    expect(res.statusCode).toBe(400);
    const body = bodyOf<{ error: string; issues: Array<{ path: string }> }>(res);
    expect(body.error).toBe('bad_request');
    expect(body.issues.map((i) => i.path).sort()).toEqual(['ingredients.0.items', 'serves']);
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

describe('PUT /api/documents/{id}/tags', () => {
  it('replaces the tag set, normalized to the vocabulary order, without writing a version', async () => {
    const created = await createChili();
    const id = created.document.id;
    const res = await api(
      fakeEvent({
        method: 'PUT',
        route: '/api/documents/{id}/tags',
        params: { id },
        body: { tags: ['flag:vegetarian', 'camping', 'main:beans-legumes', 'course:main'] },
      }),
    );
    expect(res.statusCode).toBe(200);
    const updated = bodyOf<DocumentWithVersion>(res);
    expect(updated.document.tags).toEqual([
      'course:main',
      'main:beans-legumes',
      'flag:vegetarian',
      'camping',
    ]);
    expect(updated.version.number).toBe(1);
    expect(updated.document.ring).toBe('me');

    const again = await api(
      fakeEvent({
        method: 'PUT',
        route: '/api/documents/{id}/tags',
        params: { id },
        body: { tags: [] },
      }),
    );
    expect(bodyOf<DocumentWithVersion>(again).document.tags).toEqual([]);
  });

  it('refuses a value outside the vocabulary, naming what is allowed, and two values for one facet', async () => {
    const { document } = await createChili();
    const put = (tags: string[]) =>
      api(
        fakeEvent({
          method: 'PUT',
          route: '/api/documents/{id}/tags',
          params: { id: document.id },
          body: { tags },
        }),
      );
    const unknown = await put(['course:brunch']);
    expect(unknown.statusCode).toBe(400);
    const body = bodyOf<{ issues: Array<{ path: string; message: string }> }>(unknown);
    expect(body.issues[0]).toMatchObject({ path: '0' });
    expect(body.issues[0]!.message).toMatch(/not a value of course; one of breakfast, main/);
    expect((await put(['cuisine:thai'])).statusCode).toBe(400);
    expect((await put(['season:fall', 'season:winter'])).statusCode).toBe(400);
    expect((await put(['flag:proven'])).statusCode).toBe(400);
    const missing = await put([]);
    expect(missing.statusCode).toBe(200);
    expect(
      (
        await api(
          fakeEvent({
            method: 'PUT',
            route: '/api/documents/{id}/tags',
            params: { id: '00000000-0000-0000-0000-000000000000' },
            body: { tags: [] },
          }),
        )
      ).statusCode,
    ).toBe(404);
  });

  it('validates tags on create as well, per type', async () => {
    const bad = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/documents',
        body: { ...create, tags: ['course:brunch'] },
      }),
    );
    expect(bad.statusCode).toBe(400);
    expect(bodyOf<{ message: string }>(bad).message).toBe('invalid tags');
    const good = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/documents',
        body: { ...create, tags: ['flag:kid-approved', 'course:main'] },
      }),
    );
    expect(bodyOf<DocumentWithVersion>(good).document.tags).toEqual([
      'course:main',
      'flag:kid-approved',
    ]);
  });
});

describe('the group door', () => {
  it('lets a device read group and public documents, never me, and never write', async () => {
    const { createDevice } = await import('../../src/db/group.js');
    const { document } = await import('../../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const device = await createDevice(t.db, 'd1');
    const mine = await createChili();
    const shared = bodyOf<DocumentWithVersion>(
      await api(
        fakeEvent({
          method: 'POST',
          route: '/api/documents',
          body: { ...create, frontmatter: { ...chili, title: 'Group chili' } },
        }),
      ),
    );
    await t.db.update(document).set({ ring: 'group' }).where(eq(document.id, shared.document.id));

    const asDevice = (method: string, route: string, params = {}, body?: unknown) =>
      api(fakeEvent({ method, route, params, body, device: { deviceId: device.id } }));

    const list = await asDevice('GET', '/api/group/documents');
    expect(list.statusCode).toBe(200);
    expect(bodyOf<ListDocumentsResponse>(list).items.map((i) => i.document.id)).toEqual([
      shared.document.id,
    ]);
    expect(
      (await asDevice('GET', '/api/group/documents/{id}', { id: shared.document.id })).statusCode,
    ).toBe(200);
    expect(
      (await asDevice('GET', '/api/group/documents/{id}', { id: mine.document.id })).statusCode,
    ).toBe(403);
    const search = await asDevice('GET', '/api/group/documents/search');
    expect(bodyOf<ListDocumentsResponse>(search).items).toHaveLength(1);

    // The gateway exposes no write on this door; the permission middleware refuses one anyway.
    expect((await asDevice('POST', '/api/group/documents', {}, create)).statusCode).toBe(403);
    expect(
      (
        await asDevice(
          'PUT',
          '/api/group/documents/{id}/tags',
          { id: shared.document.id },
          { tags: ['x'] },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await asDevice('DELETE', '/api/group/documents/{id}', { id: shared.document.id }))
        .statusCode,
    ).toBe(403);
    expect(
      (await api(fakeEvent({ method: 'GET', route: '/api/group/documents', device: null })))
        .statusCode,
    ).toBe(401);
  });
});
