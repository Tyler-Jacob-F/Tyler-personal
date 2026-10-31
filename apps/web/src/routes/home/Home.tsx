import { useDocuments } from '@/api/documents';
import { Loading, QueryError } from '@/components/QueryState';
import { briefDay, todayIso } from '@/lib/dates';
import { briefOf } from '@/routes/briefs/brief';
import { pickBrief } from '@/routes/home/home';
import { Morning } from '@/routes/home/Morning';

/** The logged-in home is the morning page, from today's brief; the latest one if today's is not in yet. */
export function Home() {
  const briefs = useDocuments('brief');
  const today = todayIso();
  if (briefs.isError) return <QueryError queries={[briefs]} />;
  if (briefs.isPending) return <Loading />;
  const picked = pickBrief(briefs.data.items, today);
  const brief = picked ? briefOf(picked.item.version.frontmatter) : null;
  return (
    <Morning
      date={today}
      brief={brief}
      version={picked?.item.version}
      note={
        picked && !picked.isToday && brief
          ? `Today’s brief is not in yet; this is ${briefDay(brief.date)}’s.`
          : null
      }
    />
  );
}
