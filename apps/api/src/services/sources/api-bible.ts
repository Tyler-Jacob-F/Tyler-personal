import type { Passage, Translation } from '@the-keep/shared';
import { HttpError, notFound } from '../../lib/http.js';
import { formatReference, type ParsedReference, passageIds } from './reference.js';
import { tidy, versesFromMarked } from './text.js';

/**
 * API.Bible (https://docs.api.bible/, docs/runbooks/scripture-keys.md): the American
 * Bible Society's catalogue, where the NIV lives under a licence the free Starter plan
 * grants a non-commercial site. A passage is asked for by id ("EPH.1.15-EPH.1.23"), one
 * request per span, as text with bracketed verse numbers. The answer carries the
 * publisher's copyright line, which the page shows under the reading, and a fair-use
 * token the page reports back to them, both of which their terms require.
 */
export const API_BIBLE_BASE = 'https://api.scripture.api.bible/v1/';

/** API.Bible's id for each translation it serves here; the NIV's is checked in the runbook. */
export const API_BIBLE_IDS: Partial<Record<Translation, string>> = {
  niv: '78a9f6124f344018-01',
};

export const API_BIBLE_ID_ENV = 'API_BIBLE_NIV_ID';

interface ApiBibleResponse {
  data?: {
    reference?: string;
    content?: string;
    copyright?: string;
  };
  meta?: { fumsId?: string; fumsToken?: string };
}

const OPTIONS: Record<string, string> = {
  'content-type': 'text',
  'include-notes': 'false',
  'include-titles': 'false',
  'include-chapter-numbers': 'false',
  'include-verse-numbers': 'true',
  'include-verse-spans': 'false',
  'use-org-id': 'false',
};

export async function fromApiBible(
  parsed: ParsedReference,
  translation: Translation,
  bibleId: string,
  key: string,
  doFetch: typeof fetch,
  base = API_BIBLE_BASE,
): Promise<Passage> {
  const params = new URLSearchParams(OPTIONS);
  const answers: ApiBibleResponse[] = [];
  for (const id of passageIds(parsed)) {
    const response = await doFetch(`${base}bibles/${bibleId}/passages/${id}?${params}`, {
      headers: { 'api-key': key },
    });
    if (response.status === 401 || response.status === 403)
      throw new HttpError(503, 'translation_unavailable', 'the API.Bible key was refused');
    if (response.status === 404) throw notFound('passage');
    if (!response.ok) throw new HttpError(502, 'bad_gateway', 'the passage source did not answer');
    answers.push((await response.json()) as ApiBibleResponse);
  }

  const verses = answers.flatMap((answer, index) =>
    versesFromMarked(answer.data?.content ?? '', parsed.spans[index]?.start.chapter ?? 1),
  );
  if (verses.length === 0) throw notFound('passage');
  const copyright = answers.map((a) => tidy(a.data?.copyright ?? '')).find(Boolean);
  const fums = answers.map((a) => a.meta?.fumsId ?? a.meta?.fumsToken).find(Boolean);
  const references = answers.map((a) => a.data?.reference).filter((r): r is string => Boolean(r));
  return {
    reference: references.length > 0 ? references.join('; ') : formatReference(parsed),
    translation,
    verses,
    ...(copyright ? { attribution: { text: copyright } } : {}),
    ...(fums ? { fums } : {}),
  };
}
