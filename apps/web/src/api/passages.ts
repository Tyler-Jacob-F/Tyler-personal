import { type Passage, passageSchema, type Translation } from '@the-keep/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { type ApiFetch, ApiRequestError } from '@/api/client';

/**
 * A reading as text, through whichever door the viewer holds: `/api/passages` for a
 * signed-in member (the morning page, the admin's group pages), `/api/group/passages` for
 * a device. A passage never changes, so it is kept for the session and never retried: a
 * 404 is a reference the sources do not know, a 503 a translation not set up yet, and
 * the page says so either way.
 */
export const passageKeys = {
  all: ['passage'] as const,
  one: (prefix: string, translation: Translation, ref: string) =>
    [...passageKeys.all, prefix, translation, ref] as const,
};

export function usePassageThrough(
  api: ApiFetch,
  prefix: '/api' | '/api/group',
  ref: string,
  translation: Translation,
): UseQueryResult<Passage> {
  return useQuery({
    queryKey: passageKeys.one(prefix, translation, ref),
    queryFn: () =>
      api(`${prefix}/passages`, { schema: passageSchema, query: { ref, translation } }),
    staleTime: Infinity,
    retry: false,
  });
}

/** What the page says when a reading could not be fetched: not set up yet, or not known. */
export function passageProblem(error: unknown, reference: string): string {
  if (error instanceof ApiRequestError && error.code === 'translation_unavailable') {
    return `${error.message.charAt(0).toUpperCase()}${error.message.slice(1)}.`;
  }
  return `${reference} could not be found; read it from a Bible.`;
}
