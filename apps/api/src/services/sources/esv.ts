import type { Passage } from '@the-keep/shared';
import { HttpError, notFound } from '../../lib/http.js';
import { formatReference, type ParsedReference } from './reference.js';
import { versesFromMarked } from './text.js';

/**
 * Crossway's ESV API (https://api.esv.org/, docs/runbooks/scripture-keys.md): the text
 * endpoint with everything but the words and their verse numbers turned off. Free for a
 * non-commercial site with a key; 60 requests a minute, 5,000 a day, 500 verses a query;
 * the page shows "ESV" and links esv.org, which is the attribution below. The terms also
 * cap what may be stored locally at 500 verses, which is why passages are kept only in
 * Lambda memory and never in the database.
 */
export const ESV_BASE = 'https://api.esv.org/v3/passage/text/';

export const ESV_ATTRIBUTION = {
  text: 'English Standard Version (ESV), © Crossway',
  url: 'https://www.esv.org',
};

interface EsvResponse {
  canonical?: string;
  /** One [start, end] per span, as verse ids BBBCCCVVV. */
  parsed?: Array<[number, number]>;
  passages?: string[];
}

const OPTIONS: Record<string, string> = {
  'include-headings': 'false',
  'include-footnotes': 'false',
  'include-verse-numbers': 'true',
  'include-first-verse-numbers': 'true',
  'include-short-copyright': 'false',
  'include-copyright': 'false',
  'include-passage-references': 'false',
  'include-passage-horizontal-lines': 'false',
  'include-heading-horizontal-lines': 'false',
  'include-selahs': 'false',
  'indent-poetry': 'false',
  'indent-paragraphs': '0',
  'indent-declares': '0',
  'indent-psalm-doxology': '0',
  'line-length': '0',
};

export async function fromEsv(
  parsed: ParsedReference,
  key: string,
  doFetch: typeof fetch,
  base = ESV_BASE,
): Promise<Passage> {
  const reference = formatReference(parsed);
  const params = new URLSearchParams({ q: reference, ...OPTIONS });
  const response = await doFetch(`${base}?${params}`, {
    headers: { authorization: `Token ${key}` },
  });
  if (response.status === 401 || response.status === 403)
    throw new HttpError(503, 'translation_unavailable', 'the ESV key was refused');
  if (!response.ok) throw new HttpError(502, 'bad_gateway', 'the passage source did not answer');
  const data = (await response.json()) as EsvResponse;
  const texts = (data.passages ?? []).filter((p) => p.trim());
  if (texts.length === 0) throw notFound('passage');

  const verses = texts.flatMap((text, index) => {
    const start = data.parsed?.[index]?.[0];
    const chapter = start
      ? Math.floor(start / 1000) % 1000
      : (parsed.spans[index]?.start.chapter ?? 1);
    return versesFromMarked(text, chapter);
  });
  if (verses.length === 0) throw notFound('passage');
  return {
    reference: data.canonical ?? reference,
    translation: 'esv',
    verses,
    attribution: ESV_ATTRIBUTION,
  };
}
