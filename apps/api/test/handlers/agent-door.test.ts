import type { DocumentWithVersion, ListDocumentsResponse, Version } from '@the-keep/shared';
import { createAgentToken } from '../../src/db/repositories.js';
import { build as buildDocuments } from '../../src/handlers/documents.js';
import { build as buildMe } from '../../src/handlers/me.js';
import { build as buildVersions } from '../../src/handlers/versions.js';
import { doorOf } from '../../src/lib/http.js';
import { adminId, testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, type FakeAgent, fakeEvent } from '../helpers/event.js';

const chili = { title: 'Chili', ingredients: ['2 lb ground chuck', '1 onion, diced'] };
const create = { type: 'recipe', frontmatter: chili, body: '# Chili\n\nBrown the beef.' };

let t: TestDb;
let importer: FakeAgent;
let reader: FakeAgent;
let briefWriter: FakeAgent;

async function token(name: string, scopes: FakeAgent['scopes']): Promise<FakeAgent> {
  const created = await createAgentToken(t.db, {
    name,
    scopes: scopes as never,
    secretHash: `hash-${name}`,
  });
  return { id: created.id, name, scopes };
}

beforeEach(async () => {
  t = await testDb();
  importer = await token('importer', ['read:documents', 'write:recipes']);
  reader = await token('reader', ['read:documents']);
  briefWriter = await token('brief-writer', ['write:briefs']);
});
afterEach(() => t.close());

describe('doorOf', () => {
  it('maps the agent prefix onto the member route and leaves the rest alone', () => {
    expect(doorOf('POST /api/agent/documents')).toEqual({
      door: 'agent',
      routeKey: 'POST /api/documents',
    });
    expect(doorOf('GET /api/agent/documents/{id}/versions/{number}')).toEqual({
      door: 'agent',
      routeKey: 'GET /api/documents/{id}/versions/{number}',
    });
    expect(doorOf('GET /api/documents')).toEqual({
      door: 'member',
      routeKey: 'GET /api/documents',
    });
    expect(doorOf('GET /api/agentry')).toEqual({ door: 'member', routeKey: 'GET /api/agentry' });
  });
});

describe('/api/agent/documents', () => {
  it('lets a token with write:recipes create a recipe, authored by the token and owned by the admin', async () => {
    const res = await buildDocuments(t.db)(
      fakeEvent({ method: 'POST', route: '/api/agent/documents', body: create, agent: importer }),
    );
    expect(res.statusCode).toBe(201);
    const created = bodyOf<DocumentWithVersion>(res);
    expect(created.document.ring).toBe('me');
    expect(created.document.owner).toBe(await adminId(t.db));
    expect(created.version.author).toEqual({ kind: 'agent', id: importer.id, name: 'importer' });
  });

  it('reads back through the same door, and a version an agent saves names the token', async () => {
    const documents = buildDocuments(t.db);
    const versions = buildVersions(t.db);
    const created = bodyOf<DocumentWithVersion>(
      await documents(
        fakeEvent({ method: 'POST', route: '/api/agent/documents', body: create, agent: importer }),
      ),
    );
    const id = created.document.id;

    const list = await documents(
      fakeEvent({ method: 'GET', route: '/api/agent/documents', agent: reader }),
    );
    expect(list.statusCode).toBe(200);
    expect(bodyOf<ListDocumentsResponse>(list).items.map((i) => i.document.id)).toEqual([id]);

    const got = await documents(
      fakeEvent({
        method: 'GET',
        route: '/api/agent/documents/{id}',
        params: { id },
        agent: reader,
      }),
    );
    expect(got.statusCode).toBe(200);

    const saved = await versions(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents/{id}/versions',
        params: { id },
        body: {
          frontmatter: chili,
          body: 'v2',
          summary: 'from the importer',
          authoredAt: '2023-11-06',
        },
        agent: importer,
      }),
    );
    expect(saved.statusCode).toBe(201);
    const v2 = bodyOf<Version>(saved);
    expect(v2.number).toBe(2);
    expect(v2.author.name).toBe('importer');
    expect(v2.authoredAt).toBe('2023-11-06T00:00:00.000Z');

    const diff = await versions(
      fakeEvent({
        method: 'GET',
        route: '/api/agent/documents/{id}/diff',
        params: { id },
        query: { from: '1', to: '2' },
        agent: reader,
      }),
    );
    expect(diff.statusCode).toBe(200);
  });

  it('holds each token to its scopes', async () => {
    const documents = buildDocuments(t.db);
    const created = bodyOf<DocumentWithVersion>(
      await documents(fakeEvent({ method: 'POST', route: '/api/documents', body: create })),
    );
    const id = created.document.id;

    const readOnlyWrite = await documents(
      fakeEvent({ method: 'POST', route: '/api/agent/documents', body: create, agent: reader }),
    );
    expect(readOnlyWrite.statusCode).toBe(403);
    expect(bodyOf<{ message: string }>(readOnlyWrite).message).toMatch(/cannot write a recipe/);

    const wrongType = await documents(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents',
        body: create,
        agent: briefWriter,
      }),
    );
    expect(wrongType.statusCode).toBe(403);

    // A write-only token sees an empty list and gets 403 on a direct read.
    const list = await documents(
      fakeEvent({ method: 'GET', route: '/api/agent/documents', agent: briefWriter }),
    );
    expect(bodyOf<ListDocumentsResponse>(list).items).toEqual([]);
    const got = await documents(
      fakeEvent({
        method: 'GET',
        route: '/api/agent/documents/{id}',
        params: { id },
        agent: briefWriter,
      }),
    );
    expect(got.statusCode).toBe(403);

    // No agent deletes, whatever it carries. The route is not even wired in the stack.
    const del = await documents(
      fakeEvent({
        method: 'DELETE',
        route: '/api/agent/documents/{id}',
        params: { id },
        agent: importer,
      }),
    );
    expect(del.statusCode).toBe(403);
  });

  it('lets a writing token set tags through its door, and holds a reader to reading', async () => {
    const documents = buildDocuments(t.db);
    const created = bodyOf<DocumentWithVersion>(
      await documents(fakeEvent({ method: 'POST', route: '/api/documents', body: create })),
    );
    const id = created.document.id;
    const tagged = await documents(
      fakeEvent({
        method: 'PUT',
        route: '/api/agent/documents/{id}/tags',
        params: { id },
        body: { tags: ['course:main', 'main:beef', 'effort:project', 'occasion:cookoff'] },
        agent: importer,
      }),
    );
    expect(tagged.statusCode).toBe(200);
    expect(bodyOf<DocumentWithVersion>(tagged).document.tags).toEqual([
      'course:main',
      'main:beef',
      'effort:project',
      'occasion:cookoff',
    ]);
    const refused = await documents(
      fakeEvent({
        method: 'PUT',
        route: '/api/agent/documents/{id}/tags',
        params: { id },
        body: { tags: [] },
        agent: reader,
      }),
    );
    expect(refused.statusCode).toBe(403);
    // Still version 1: tagging writes no version.
    expect(bodyOf<DocumentWithVersion>(tagged).version.number).toBe(1);
  });

  it('lets write:briefs post a brief and nothing else, titled from its date', async () => {
    const documents = buildDocuments(t.db);
    const res = await documents(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents',
        body: {
          type: 'brief',
          frontmatter: {
            date: '2026-10-30',
            sections: [{ heading: 'Today', body: '- 9:00 standup' }],
          },
          body: 'A quiet Thursday.',
          summary: 'morning brief',
        },
        agent: briefWriter,
      }),
    );
    expect(res.statusCode).toBe(201);
    const created = bodyOf<DocumentWithVersion>(res);
    expect(created.document).toMatchObject({
      type: 'brief',
      ring: 'me',
      slug: 'brief-for-2026-10-30',
    });
    expect(created.version.frontmatter.title).toBe('Brief for 2026-10-30');
    expect(created.version.author.name).toBe('brief-writer');
    const recipe = await documents(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents',
        body: create,
        agent: briefWriter,
      }),
    );
    expect(recipe.statusCode).toBe(403);
    const importerBrief = await documents(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents',
        body: {
          type: 'brief',
          frontmatter: { date: '2026-10-30', sections: [{ heading: 'x', body: '' }] },
          body: '',
        },
        agent: importer,
      }),
    );
    expect(importerBrief.statusCode).toBe(403);
  });

  it('refuses a request at the agent door without authorizer context, and closes doors a handler lacks', async () => {
    const noContext = await buildDocuments(t.db)(
      fakeEvent({ method: 'GET', route: '/api/agent/documents', agent: null }),
    );
    expect(noContext.statusCode).toBe(401);
    // A JWT-authenticated request addressed to the agent prefix is not an agent.
    const wrongDoor = await buildDocuments(t.db)(
      fakeEvent({ method: 'GET', route: '/api/agent/documents' }),
    );
    expect(wrongDoor.statusCode).toBe(401);
    // `me` has no agent door at all.
    const me = await buildMe(t.db)(
      fakeEvent({ method: 'GET', route: '/api/agent/me', agent: importer }),
    );
    expect(me.statusCode).toBe(401);
    expect(bodyOf<{ message: string }>(me).message).toMatch(/no agent door/);
  });
});
