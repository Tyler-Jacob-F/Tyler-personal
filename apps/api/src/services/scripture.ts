import { type Passage, passageQuerySchema } from '@the-keep/shared';
import { HttpError, notFound, parse } from '../lib/http.js';

/**
 * Readings resolved to text (docs/phases/04-group.md "The refresh"): a reference as the
 * printed guide writes it, served from bible-api.com in the translation the liturgy
 * names. The source carries only public-domain texts, which is why the group reads the
 * King James by default. A Lambda keeps what it has fetched for its life; a passage never
 * changes, so the response is cacheable for a day too.
 */

/** "Ephesians 1:15–23" with an en dash, or odd spacing, to what the source reads. */
export function normalizeReference(ref: string): string {
  return ref.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

interface SourceVerse {
  chapter: number;
  verse: number;
  text: string;
}

interface SourceResponse {
  reference?: string;
  verses?: SourceVerse[];
  error?: string;
}

export interface PassageOptions {
  /** Injected by tests; production uses the global. */
  fetch?: typeof fetch;
  /** Shared across requests in one Lambda; a test passes its own. */
  cache?: Map<string, Passage>;
  base?: string;
}

const defaultCache = new Map<string, Passage>();

export async function resolvePassage(
  query: unknown,
  {
    fetch: doFetch = fetch,
    cache = defaultCache,
    base = 'https://bible-api.com/',
  }: PassageOptions = {},
): Promise<Passage> {
  const { ref, translation } = parse(passageQuerySchema, query ?? {}, 'query');
  const reference = normalizeReference(ref);
  const key = `${translation}:${reference.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const response = await doFetch(
    `${base}${encodeURIComponent(reference)}?translation=${translation}`,
  );
  if (response.status === 404) throw notFound('passage');
  if (!response.ok) throw new HttpError(502, 'bad_gateway', 'the passage source did not answer');
  const data = (await response.json()) as SourceResponse;
  if (!data.verses || data.verses.length === 0) throw notFound('passage');

  const passage: Passage = {
    reference: data.reference ?? reference,
    translation,
    verses: data.verses.map((v) => ({
      chapter: v.chapter,
      verse: v.verse,
      text: v.text.replace(/\s+/g, ' ').trim(),
    })),
  };
  cache.set(key, passage);
  return passage;
}
