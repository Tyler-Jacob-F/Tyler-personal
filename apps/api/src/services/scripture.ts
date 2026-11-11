import {
  APOCRYPHA_FALLBACK,
  type Passage,
  passageQuerySchema,
  type Translation,
  translationInfo,
} from '@the-keep/shared';
import { HttpError, parse } from '../lib/http.js';
import { API_BIBLE_ID_ENV, API_BIBLE_IDS, fromApiBible } from './sources/api-bible.js';
import { fromBibleApi } from './sources/bible-api.js';
import { fromEsv } from './sources/esv.js';
import { type KeySource, keysFromSsm } from './sources/keys.js';
import { formatReference, normalizeReference, parseReference } from './sources/reference.js';

export { normalizeReference } from './sources/reference.js';

/**
 * Readings resolved to text (docs/phases/04-group.md "The refresh", "Translations"): a
 * reference as a guide or the brief writes it, in the translation the reader chose, from
 * whichever source serves that translation. A translation that needs a key the
 * deployment lacks answers 503 `translation_unavailable`, and the page says so. A reading
 * from the Apocrypha in a translation that has none is served from the Douay-Rheims
 * instead, and the answer's `translation` says which. A Lambda keeps what it has fetched
 * for its life; a passage never changes, so the response is cacheable for a day too.
 */
export interface PassageOptions {
  /** Injected by tests; production uses the global. */
  fetch?: typeof fetch;
  /** Shared across requests in one Lambda; a test passes its own. */
  cache?: Map<string, Passage>;
  /** bible-api.com's base, for a test. */
  base?: string;
  /** Where the licensed sources' keys come from: SSM unless a test says otherwise. */
  keys?: KeySource;
  /** Crossway's and API.Bible's bases, for a test. */
  bases?: { esv?: string; apiBible?: string };
  env?: NodeJS.ProcessEnv;
}

const defaultCache = new Map<string, Passage>();

export async function resolvePassage(
  query: unknown,
  {
    fetch: doFetch = fetch,
    cache = defaultCache,
    base,
    keys,
    bases = {},
    env = process.env,
  }: PassageOptions = {},
): Promise<Passage> {
  const { ref, translation: asked } = parse(passageQuerySchema, query ?? {}, 'query');
  const parsed = parseReference(ref);
  const reference = parsed ? formatReference(parsed) : normalizeReference(ref);
  const translation: Translation =
    parsed?.book.apocrypha && !translationInfo[asked].apocrypha ? APOCRYPHA_FALLBACK : asked;

  const key = `${translation}:${reference.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const { source } = translationInfo[translation];
  let passage: Passage;
  if (source === 'bible-api') {
    passage = await fromBibleApi(reference, translation, doFetch, base);
  } else if (!parsed) {
    throw new HttpError(404, 'not_found', 'passage not found');
  } else {
    const found = await (keys ?? keysFromSsm(env))();
    if (source === 'esv') {
      if (!found.esv) throw notConfigured('esv');
      passage = await fromEsv(parsed, found.esv, doFetch, bases.esv);
    } else {
      if (!found.apiBible) throw notConfigured(translation);
      const bibleId = env[API_BIBLE_ID_ENV] || API_BIBLE_IDS[translation];
      if (!bibleId) throw notConfigured(translation);
      passage = await fromApiBible(
        parsed,
        translation,
        bibleId,
        found.apiBible,
        doFetch,
        bases.apiBible,
      );
    }
  }
  cache.set(key, passage);
  return passage;
}

function notConfigured(translation: Translation): HttpError {
  return new HttpError(
    503,
    'translation_unavailable',
    `the ${translationInfo[translation].short} is not set up yet`,
  );
}
