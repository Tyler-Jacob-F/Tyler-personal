import type { Passage } from '@the-keep/shared';
import { createDevice } from '../../src/db/group.js';
import { build } from '../../src/handlers/passages.js';
import { normalizeReference } from '../../src/services/scripture.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

/** bible-api.com as it answers: the reference its way, verses with the book's text and newlines. */
const source = {
  reference: 'Ephesians 1:15-17',
  verses: [
    { book_name: 'Ephesians', chapter: 1, verse: 15, text: 'Wherefore I also,\nafter I heard' },
    { book_name: 'Ephesians', chapter: 1, verse: 16, text: 'Cease not to give thanks for you,' },
    {
      book_name: 'Ephesians',
      chapter: 1,
      verse: 17,
      text: 'That the God of our Lord Jesus Christ\n',
    },
  ],
  translation_id: 'kjv',
};

function fakeFetch(calls: string[], answer: () => Response): typeof fetch {
  return (async (input: string | URL | Request) => {
    calls.push(String(input));
    return answer();
  }) as typeof fetch;
}

describe('GET /api/passages', () => {
  it('resolves a reference through the source in the translation asked, tidies the text, and caches it', async () => {
    const calls: string[] = [];
    const api = build(t.db, {
      fetch: fakeFetch(calls, () => Response.json(source)),
      cache: new Map<string, Passage>(),
    });
    const res = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Ephesians 1:15–17', translation: 'kjv' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('private, max-age=86400');
    expect(bodyOf<Passage>(res)).toEqual({
      reference: 'Ephesians 1:15-17',
      translation: 'kjv',
      verses: [
        { chapter: 1, verse: 15, text: 'Wherefore I also, after I heard' },
        { chapter: 1, verse: 16, text: 'Cease not to give thanks for you,' },
        { chapter: 1, verse: 17, text: 'That the God of our Lord Jesus Christ' },
      ],
    });
    // The en dash became a hyphen on the way to the source.
    expect(calls).toEqual(['https://bible-api.com/Ephesians%201%3A15-17?translation=kjv']);

    const again = await api(
      fakeEvent({ method: 'GET', route: '/api/passages', query: { ref: 'ephesians 1:15-17' } }),
    );
    expect(again.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it('defaults to the King James, 404s a reference the source does not know, and 502s an outage', async () => {
    const calls: string[] = [];
    let status = 404;
    const api = build(t.db, {
      fetch: fakeFetch(calls, () =>
        status === 404
          ? Response.json({ error: 'not found' }, { status })
          : new Response('nope', { status }),
      ),
      cache: new Map<string, Passage>(),
    });
    const missing = await api(
      fakeEvent({ method: 'GET', route: '/api/passages', query: { ref: 'Hezekiah 3:1' } }),
    );
    expect(missing.statusCode).toBe(404);
    expect(calls[0]).toContain('translation=kjv');

    status = 503;
    const down = await api(
      fakeEvent({ method: 'GET', route: '/api/passages', query: { ref: 'Psalm 122' } }),
    );
    expect(down.statusCode).toBe(502);
    expect(bodyOf(down)).toMatchObject({ error: 'bad_gateway' });
  });

  it('refuses an unknown translation and an empty reference before asking the source', async () => {
    const calls: string[] = [];
    const api = build(t.db, { fetch: fakeFetch(calls, () => Response.json(source)) });
    const esv = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Psalm 122', translation: 'esv' },
      }),
    );
    expect(esv.statusCode).toBe(400);
    const blank = await api(fakeEvent({ method: 'GET', route: '/api/passages', query: {} }));
    expect(blank.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it('answers a device through the group door and nobody through the agents’', async () => {
    const api = build(t.db, {
      fetch: fakeFetch([], () => Response.json(source)),
      cache: new Map<string, Passage>(),
    });
    const device = await createDevice(t.db, 'd1');
    const viaGroup = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/group/passages',
        query: { ref: 'Psalm 122' },
        device: { deviceId: device.id },
      }),
    );
    expect(viaGroup.statusCode).toBe(200);
    const viaAgent = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/agent/passages',
        query: { ref: 'Psalm 122' },
        agent: { id: device.id, name: 'x', scopes: ['read:documents'] },
      }),
    );
    expect(viaAgent.statusCode).toBe(401);
  });
});

describe('normalizeReference', () => {
  it('turns dashes into hyphens and collapses spaces', () => {
    expect(normalizeReference(' Matthew  5:1—12 ')).toBe('Matthew 5:1-12');
  });
});
