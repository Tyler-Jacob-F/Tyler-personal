import type { Passage, Translation } from '@the-keep/shared';
import { HttpError, notFound } from '../../lib/http.js';
import { tidy } from './text.js';

/**
 * bible-api.com: the keyless source of the public-domain texts. It reads a reference
 * itself ("Ephesians 1:15-17") and answers with verses already split, chapter and verse
 * numbered. A 404 is a reference it does not know, which includes any book a translation
 * lacks.
 */
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

export const BIBLE_API_BASE = 'https://bible-api.com/';

export async function fromBibleApi(
  reference: string,
  translation: Translation,
  doFetch: typeof fetch,
  base = BIBLE_API_BASE,
): Promise<Passage> {
  const response = await doFetch(
    `${base}${encodeURIComponent(reference)}?translation=${translation}`,
  );
  if (response.status === 404) throw notFound('passage');
  if (!response.ok) throw new HttpError(502, 'bad_gateway', 'the passage source did not answer');
  const data = (await response.json()) as SourceResponse;
  if (!data.verses || data.verses.length === 0) throw notFound('passage');
  return {
    reference: data.reference ?? reference,
    translation,
    verses: data.verses.map((v) => ({ chapter: v.chapter, verse: v.verse, text: tidy(v.text) })),
  };
}
