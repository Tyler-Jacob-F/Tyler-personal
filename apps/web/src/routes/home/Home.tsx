import { useDocuments } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { briefDay, briefOf, todayIso } from '@/routes/briefs/brief';
import { pickBrief } from '@/routes/home/home';
import { Morning } from '@/routes/home/Morning';

/** The logged-in home is the morning page, from today's brief; the latest one if today's is not in yet. */
export function Home() {
  const briefs = useDocuments('brief');
  const today = todayIso();
  if (briefs.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (briefs.isError) return <Alert tone="danger">{briefs.error.message}</Alert>;
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
