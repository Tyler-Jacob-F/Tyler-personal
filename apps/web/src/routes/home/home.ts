import type { DocumentWithVersion } from '@the-keep/shared';
import { briefOf } from '@/routes/briefs/brief';

/**
 * Which brief is "today's": the newest one dated today in the viewer's zone. Failing that,
 * the newest brief at all, labelled as the latest rather than today's.
 */
export function pickBrief(
  items: DocumentWithVersion[],
  today: string,
): { item: DocumentWithVersion; isToday: boolean } | null {
  const dated = items
    .map((item) => ({ item, brief: briefOf(item.version.frontmatter) }))
    .filter((entry) => entry.brief !== null);
  const todays = dated.find((entry) => entry.brief!.date === today);
  if (todays) return { item: todays.item, isToday: true };
  const latest = dated.sort((a, b) => b.brief!.date.localeCompare(a.brief!.date))[0];
  return latest ? { item: latest.item, isToday: false } : null;
}
