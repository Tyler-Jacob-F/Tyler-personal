import type { Passage } from '@the-keep/shared';
import { createDevice } from '../../src/db/group.js';
import { build } from '../../src/handlers/passages.js';
import { ESV_ATTRIBUTION } from '../../src/services/sources/esv.js';
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

function fakeFetch(
  calls: string[],
  answer: (url: string, init?: RequestInit) => Response,
  headers: Array<Record<string, string>> = [],
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(String(input));
    headers.push(Object.fromEntries(new Headers(init?.headers).entries()));
    return answer(String(input), init);
  }) as typeof fetch;
}

/** Crossway's text endpoint: one passage per span, verse numbers in brackets, ids BBBCCCVVV. */
const esvSource = {
  query: 'Ephesians 1:15-17',
  canonical: 'Ephesians 1:15–17',
  parsed: [[49001015, 49001017]],
  passages: [
    '  [15] For this reason, because I have heard of your faith\n  [16] I do not cease to give thanks for you, [17] that the God of our Lord Jesus Christ\n\n',
  ],
};

/** API.Bible: text content with bracketed numbers, the publisher's line, and the fair-use token. */
const apiBibleSource = {
  data: {
    id: 'EPH.1.15-EPH.1.23',
    reference: 'Ephesians 1:15-23',
    content:
      '[15] For this reason, ever since I heard about your faith [16] I have not stopped giving thanks for you',
    copyright:
      '  Holy Bible, New International Version®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®  ',
  },
  meta: { fums: '<script>…</script>', fumsId: 'fums-123' },
};

/** Both keys, as SSM would hand them over. */
const keys = async () => ({ esv: 'esv-key', apiBible: 'api-bible-key' });
const noKeys = async () => ({});

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

  it('refuses an unknown translation and an empty reference before asking any source', async () => {
    const calls: string[] = [];
    const api = build(t.db, { fetch: fakeFetch(calls, () => Response.json(source)), keys });
    const msg = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Psalm 122', translation: 'msg' },
      }),
    );
    expect(msg.statusCode).toBe(400);
    const blank = await api(fakeEvent({ method: 'GET', route: '/api/passages', query: {} }));
    expect(blank.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it('serves the ESV from Crossway with its key, verse numbers read out of the text, and credits it', async () => {
    const calls: string[] = [];
    const headers: Array<Record<string, string>> = [];
    const api = build(t.db, {
      fetch: fakeFetch(calls, () => Response.json(esvSource), headers),
      cache: new Map<string, Passage>(),
      keys,
    });
    const res = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Ephesians 1:15–17', translation: 'esv' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(bodyOf<Passage>(res)).toEqual({
      reference: 'Ephesians 1:15–17',
      translation: 'esv',
      verses: [
        { chapter: 1, verse: 15, text: 'For this reason, because I have heard of your faith' },
        { chapter: 1, verse: 16, text: 'I do not cease to give thanks for you,' },
        { chapter: 1, verse: 17, text: 'that the God of our Lord Jesus Christ' },
      ],
      attribution: ESV_ATTRIBUTION,
    });
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!);
    expect(url.origin + url.pathname).toBe('https://api.esv.org/v3/passage/text/');
    expect(url.searchParams.get('q')).toBe('Ephesians 1:15-17');
    expect(url.searchParams.get('include-headings')).toBe('false');
    expect(url.searchParams.get('include-verse-numbers')).toBe('true');
    expect(headers[0]).toEqual({ authorization: 'Token esv-key' });
  });

  it('serves the NIV from API.Bible by passage id, with the publisher’s line and the fair-use token', async () => {
    const calls: string[] = [];
    const headers: Array<Record<string, string>> = [];
    const api = build(t.db, {
      fetch: fakeFetch(calls, () => Response.json(apiBibleSource), headers),
      cache: new Map<string, Passage>(),
      keys,
      env: {},
    });
    const res = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Ephesians 1:15–23', translation: 'niv' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(bodyOf<Passage>(res)).toEqual({
      reference: 'Ephesians 1:15-23',
      translation: 'niv',
      verses: [
        {
          chapter: 1,
          verse: 15,
          text: 'For this reason, ever since I heard about your faith',
        },
        { chapter: 1, verse: 16, text: 'I have not stopped giving thanks for you' },
      ],
      attribution: {
        text: 'Holy Bible, New International Version®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®',
      },
      fums: 'fums-123',
    });
    expect(calls).toEqual([
      'https://api.scripture.api.bible/v1/bibles/78a9f6124f344018-01/passages/EPH.1.15-EPH.1.23?content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false&use-org-id=false',
    ]);
    expect(headers[0]).toEqual({ 'api-key': 'api-bible-key' });
  });

  it('takes the NIV’s id from the environment when one is set', async () => {
    const calls: string[] = [];
    const api = build(t.db, {
      fetch: fakeFetch(calls, () => Response.json(apiBibleSource)),
      cache: new Map<string, Passage>(),
      keys,
      env: { API_BIBLE_NIV_ID: 'another-id' },
    });
    await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Psalm 95', translation: 'niv' },
      }),
    );
    expect(calls[0]).toContain('/bibles/another-id/passages/PSA.95?');
  });

  it('says a licensed translation is not set up when its key is missing or refused, and asks no source', async () => {
    const calls: string[] = [];
    const api = build(t.db, {
      fetch: fakeFetch(calls, () => Response.json(esvSource)),
      cache: new Map<string, Passage>(),
      keys: noKeys,
    });
    const esv = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Psalm 95', translation: 'esv' },
      }),
    );
    expect(esv.statusCode).toBe(503);
    expect(bodyOf(esv)).toMatchObject({
      error: 'translation_unavailable',
      message: 'the ESV is not set up yet',
    });
    const niv = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Psalm 95', translation: 'niv' },
      }),
    );
    expect(niv.statusCode).toBe(503);
    expect(bodyOf(niv)).toMatchObject({ message: 'the NIV is not set up yet' });
    expect(calls).toEqual([]);

    const refused = build(t.db, {
      fetch: fakeFetch(calls, () => new Response('forbidden', { status: 403 })),
      cache: new Map<string, Passage>(),
      keys,
    });
    const bad = await refused(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Psalm 95', translation: 'esv' },
      }),
    );
    expect(bad.statusCode).toBe(503);
    expect(bodyOf(bad)).toMatchObject({ error: 'translation_unavailable' });
  });

  it('serves a reading from the Apocrypha out of the Douay-Rheims when the translation asked has none', async () => {
    const calls: string[] = [];
    const sirach = {
      reference: 'Sirach 44:1-2',
      verses: [
        { chapter: 44, verse: 1, text: 'Let us now praise men of renown.' },
        { chapter: 44, verse: 2, text: 'The Lord hath wrought great glory.' },
      ],
    };
    const api = build(t.db, {
      fetch: fakeFetch(calls, () => Response.json(sirach)),
      cache: new Map<string, Passage>(),
      keys,
    });
    for (const translation of ['esv', 'niv', 'kjv']) {
      const res = await api(
        fakeEvent({
          method: 'GET',
          route: '/api/passages',
          query: { ref: 'Ecclesiasticus 44:1–2', translation },
        }),
      );
      expect(res.statusCode, translation).toBe(200);
      expect(bodyOf<Passage>(res).translation).toBe('dra');
    }
    // One fetch: the three asks share the Douay-Rheims entry in the cache.
    expect(calls).toEqual(['https://bible-api.com/Ecclesiasticus%2044%3A1-2?translation=dra']);
    // The Douay-Rheims itself has it, so no detour.
    const direct = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/passages',
        query: { ref: 'Wisdom 3:1', translation: 'dra' },
      }),
    );
    expect(direct.statusCode).toBe(200);
    expect(calls[1]).toContain('Wisdom%203%3A1?translation=dra');
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
