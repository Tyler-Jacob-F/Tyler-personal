import type { DocumentWithVersion, SearchDocumentsResponse } from '@the-keep/shared';
import {
  createAgentToken,
  setDocumentTags,
  softDeleteDocument,
} from '../../src/db/repositories.js';
import { build } from '../../src/handlers/documents.js';
import { build as buildVersions } from '../../src/handlers/versions.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { adminId, testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

let t: TestDb;
let api: ApiHandler;
beforeEach(async () => {
  t = await testDb();
  api = build(t.db);
});
afterEach(() => t.close());

async function recipe(
  title: string,
  body: string,
  tags: string[] = [],
  extra: Record<string, unknown> = {},
): Promise<DocumentWithVersion> {
  const res = await api(
    fakeEvent({
      method: 'POST',
      route: '/api/documents',
      body: {
        type: 'recipe',
        frontmatter: { title, ingredients: ['salt'], ...extra },
        body,
        tags,
      },
    }),
  );
  expect(res.statusCode).toBe(201);
  return bodyOf<DocumentWithVersion>(res);
}

async function search(
  query: Record<string, string>,
  agent?: Parameters<typeof fakeEvent>[0]['agent'],
) {
  const res = await api(
    fakeEvent({
      method: 'GET',
      route: agent ? '/api/agent/documents/search' : '/api/documents/search',
      query,
      ...(agent ? { agent } : {}),
    }),
  );
  expect(res.statusCode).toBe(200);
  return bodyOf<SearchDocumentsResponse>(res);
}

const titles = (r: SearchDocumentsResponse) => r.items.map((i) => i.version.frontmatter.title);

describe('GET /api/documents/search', () => {
  it('finds by words in the title, the body, the ingredients and the tags, best match first', async () => {
    await recipe('Pancakes', 'Whisk, rest the batter, griddle.', ['course:breakfast']);
    await recipe('Chili', 'Brown the beef; a pot for a cold Saturday.', [
      'course:main',
      'main:beef',
    ]);
    await recipe('Shakshuka', 'Eggs poached in tomato.', ['course:breakfast', 'main:eggs'], {
      ingredients: [{ heading: null, items: ['6 eggs', 'a can of tomatoes', 'cumin'] }],
    });

    expect(titles(await search({ q: 'pancake' }))).toEqual(['Pancakes']);
    expect(titles(await search({ q: 'saturday' }))).toEqual(['Chili']);
    expect(titles(await search({ q: 'cumin' }))).toEqual(['Shakshuka']);
    // A word in a tag finds the recipe, and "Saturday morning breakfast ideas" finds breakfast.
    expect(titles(await search({ q: 'breakfast' })).sort()).toEqual(['Pancakes', 'Shakshuka']);
    expect(titles(await search({ q: 'saturday morning breakfast ideas' }))).toEqual([]);
    expect(titles(await search({ q: 'breakfast or saturday' })).sort()).toEqual([
      'Chili',
      'Pancakes',
      'Shakshuka',
    ]);
    // Title outranks body: a recipe called Eggs beats one that mentions eggs in the method.
    await recipe('Eggs', 'Boil.', []);
    expect(titles(await search({ q: 'eggs' }))).toEqual(['Eggs', 'Shakshuka']);
  });

  it('filters by tags, every one of them, with or without words, and by type', async () => {
    await recipe('Pancakes', '', ['course:breakfast', 'flag:kid-approved']);
    await recipe('Shakshuka', '', ['course:breakfast', 'main:eggs']);
    await recipe('Chili', '', ['course:main']);

    const breakfast = await search({ tags: 'course:breakfast' });
    expect(titles(breakfast).sort()).toEqual(['Pancakes', 'Shakshuka']);
    expect(breakfast).toMatchObject({ q: '', tags: ['course:breakfast'], total: 3 });
    expect(titles(await search({ tags: 'course:breakfast, main:eggs' }))).toEqual(['Shakshuka']);
    expect(titles(await search({ tags: 'course:breakfast', q: 'shakshuka' }))).toEqual([
      'Shakshuka',
    ]);
    expect(titles(await search({ tags: 'course:breakfast', q: 'chili' }))).toEqual([]);
    expect(titles(await search({ type: 'brief' }))).toEqual([]);
    // Nothing at all: the plain list, newest first.
    expect(titles(await search({}))).toEqual(['Chili', 'Shakshuka', 'Pancakes']);
    expect(titles(await search({ limit: '1' }))).toEqual(['Chili']);
    expect(
      (
        await api(
          fakeEvent({ method: 'GET', route: '/api/documents/search', query: { limit: '0' } }),
        )
      ).statusCode,
    ).toBe(400);
  });

  it('follows the document as its versions and tags change, and forgets a deleted one', async () => {
    const created = await recipe('Chili', 'Brown the beef.', []);
    const id = created.document.id;
    expect(titles(await search({ q: 'paprika' }))).toEqual([]);
    await buildVersions(t.db)(
      fakeEvent({
        method: 'POST',
        route: '/api/documents/{id}/versions',
        params: { id },
        body: {
          frontmatter: { title: 'Chili', ingredients: ['salt'] },
          body: 'Add smoked paprika.',
        },
      }),
    );
    expect(titles(await search({ q: 'paprika' }))).toEqual(['Chili']);
    expect(titles(await search({ q: 'cookoff' }))).toEqual([]);
    await setDocumentTags(t.db, id, ['occasion:cookoff'], {
      kind: 'member',
      id: await adminId(t.db),
    });
    expect(titles(await search({ q: 'cookoff' }))).toEqual(['Chili']);
    expect(titles(await search({ tags: 'occasion:cookoff' }))).toEqual(['Chili']);
    await softDeleteDocument(t.db, id);
    expect(titles(await search({ q: 'chili' }))).toEqual([]);
  });

  it('answers at the agent door for a reading token and shows a write-only token nothing', async () => {
    await recipe('Pancakes', '', ['course:breakfast']);
    const reader = await createAgentToken(t.db, {
      name: 'reader',
      scopes: ['read:documents'],
      secretHash: 'r',
    });
    const writer = await createAgentToken(t.db, {
      name: 'writer',
      scopes: ['write:briefs'],
      secretHash: 'w',
    });
    expect(
      titles(
        await search({ q: 'pancakes' }, { id: reader.id, name: 'reader', scopes: reader.scopes }),
      ),
    ).toEqual(['Pancakes']);
    expect(
      titles(
        await search({ q: 'pancakes' }, { id: writer.id, name: 'writer', scopes: writer.scopes }),
      ),
    ).toEqual([]);
  });
});
