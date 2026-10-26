import type {
  DiffResponse,
  DocumentWithVersion,
  ListVersionsResponse,
  Version,
} from '@the-keep/shared';
import { build as buildDocuments } from '../../src/handlers/documents.js';
import { build } from '../../src/handlers/versions.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

const chili = {
  title: 'Chili',
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 180,
  ingredients: [
    { heading: 'Meats', items: ['2 lb ground chuck'] },
    { heading: 'Liquids', items: ['2 tsp Worcestershire', '1 can Guinness'] },
  ],
};
const chili2 = {
  ...chili,
  cookMinutes: 240,
  ingredients: [
    { heading: 'Meats', items: ['2 lb ground chuck', '1 lb ground lamb'] },
    { heading: 'Liquids', items: ['1 can Guinness'] },
    { heading: 'Beans', items: ['1 can pinto beans'] },
  ],
};
const body1 = '# Chili\n\nBrown the beef.\nAdd the onion.\n';
const body2 = '# Chili\n\nBrown the beef.\nAdd the onion.\nStir in smoked paprika.\n';

let t: TestDb;
let api: ApiHandler;
let docId: string;

beforeEach(async () => {
  t = await testDb();
  api = build(t.db);
  const created = await buildDocuments(t.db)(
    fakeEvent({
      method: 'POST',
      route: '/api/documents',
      body: { type: 'recipe', frontmatter: chili, body: body1 },
    }),
  );
  docId = bodyOf<DocumentWithVersion>(created).document.id;
});
afterEach(() => t.close());

const route = (suffix: string) => `/api/documents/{id}${suffix}`;

async function saveSecond(): Promise<Version> {
  const res = await api(
    fakeEvent({
      method: 'POST',
      route: route('/versions'),
      params: { id: docId },
      body: {
        frontmatter: chili2,
        body: body2,
        summary: 'added smoked paprika',
        authoredAt: '2025-01-31T22:12:15.000Z',
      },
    }),
  );
  expect(res.statusCode).toBe(201);
  return bodyOf<Version>(res);
}

describe('POST /api/documents/{id}/versions', () => {
  it('appends version 2 with a summary, an authored date and the admin as author', async () => {
    const v2 = await saveSecond();
    expect(v2).toMatchObject({
      number: 2,
      summary: 'added smoked paprika',
      body: body2,
      authoredAt: '2025-01-31T22:12:15.000Z',
    });
    expect(v2.author).toMatchObject({ kind: 'member', name: 'Tyler' });
  });

  it('validates frontmatter against the document type', async () => {
    const res = await api(
      fakeEvent({
        method: 'POST',
        route: route('/versions'),
        params: { id: docId },
        body: { frontmatter: { title: '' }, body: '' },
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('404s an unknown document', async () => {
    const res = await api(
      fakeEvent({
        method: 'POST',
        route: route('/versions'),
        params: { id: '00000000-0000-0000-0000-000000000000' },
        body: { frontmatter: chili, body: '' },
      }),
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('GET versions', () => {
  it('lists versions newest first and gets one by number', async () => {
    await saveSecond();
    const list = await api(
      fakeEvent({ method: 'GET', route: route('/versions'), params: { id: docId } }),
    );
    expect(list.statusCode).toBe(200);
    expect(bodyOf<ListVersionsResponse>(list).items.map((v) => v.number)).toEqual([2, 1]);

    const one = await api(
      fakeEvent({
        method: 'GET',
        route: route('/versions/{number}'),
        params: { id: docId, number: '1' },
      }),
    );
    expect(bodyOf<Version>(one).body).toBe(body1);

    const missing = await api(
      fakeEvent({
        method: 'GET',
        route: route('/versions/{number}'),
        params: { id: docId, number: '7' },
      }),
    );
    expect(missing.statusCode).toBe(404);
  });
});

describe('GET /api/documents/{id}/diff', () => {
  it('returns a unified body diff, a key-level frontmatter diff and a per-group ingredient diff', async () => {
    await saveSecond();
    const res = await api(
      fakeEvent({
        method: 'GET',
        route: route('/diff'),
        params: { id: docId },
        query: { from: '1', to: '2' },
      }),
    );
    expect(res.statusCode).toBe(200);
    const diff = bodyOf<DiffResponse>(res);
    expect(diff.from.number).toBe(1);
    expect(diff.to).toMatchObject({ number: 2, summary: 'added smoked paprika' });
    expect(diff.body).toContain('--- chili.md\tv1');
    expect(diff.body).toContain('+++ chili.md\tv2');
    expect(diff.body).toContain('+Stir in smoked paprika.');
    expect(diff.body).not.toContain('-Brown the beef.');
    expect(diff.to.authoredAt).toBe('2025-01-31T22:12:15.000Z');
    expect(diff.frontmatter).toEqual([
      { key: 'cookMinutes', change: 'changed', from: 180, to: 240 },
    ]);
    expect(diff.ingredients).toEqual([
      {
        heading: 'Meats',
        change: 'changed',
        lines: [
          { kind: 'same', text: '2 lb ground chuck' },
          { kind: 'added', text: '1 lb ground lamb' },
        ],
      },
      {
        heading: 'Liquids',
        change: 'changed',
        lines: [
          { kind: 'removed', text: '2 tsp Worcestershire' },
          { kind: 'same', text: '1 can Guinness' },
        ],
      },
      { heading: 'Beans', change: 'added', lines: [{ kind: 'added', text: '1 can pinto beans' }] },
    ]);
  });

  it('diffs a flat (pre-groups) version against a grouped one', async () => {
    const flat = await buildDocuments(t.db)(
      fakeEvent({
        method: 'POST',
        route: '/api/documents',
        body: {
          type: 'recipe',
          frontmatter: { title: 'Old', ingredients: ['salt', 'pepper'] },
          body: '',
        },
      }),
    );
    const id = bodyOf<DocumentWithVersion>(flat).document.id;
    await api(
      fakeEvent({
        method: 'POST',
        route: route('/versions'),
        params: { id },
        body: { frontmatter: { title: 'Old', ingredients: [{ items: ['salt'] }] }, body: '' },
      }),
    );
    const res = await api(
      fakeEvent({
        method: 'GET',
        route: route('/diff'),
        params: { id },
        query: { from: '1', to: '2' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(bodyOf<DiffResponse>(res).ingredients).toEqual([
      {
        heading: null,
        change: 'changed',
        lines: [
          { kind: 'same', text: 'salt' },
          { kind: 'removed', text: 'pepper' },
        ],
      },
    ]);
  });

  it('rejects missing or non-numeric from/to and 404s a missing version', async () => {
    const bad = await api(
      fakeEvent({
        method: 'GET',
        route: route('/diff'),
        params: { id: docId },
        query: { from: 'a' },
      }),
    );
    expect(bad.statusCode).toBe(400);
    const missing = await api(
      fakeEvent({
        method: 'GET',
        route: route('/diff'),
        params: { id: docId },
        query: { from: '1', to: '3' },
      }),
    );
    expect(missing.statusCode).toBe(404);
    expect(bodyOf<{ message: string }>(missing).message).toBe('version 3 not found');
  });
});
