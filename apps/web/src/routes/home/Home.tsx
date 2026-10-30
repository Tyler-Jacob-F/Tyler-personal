import { Link } from 'react-router';
import { useDocuments, useRecentDocuments } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { todayIso } from '@/routes/briefs/brief';
import { BriefView } from '@/routes/briefs/BriefView';
import { pathFor, pickBrief, typeLabels } from '@/routes/home/home';
import { titleOf, when } from '@/routes/recipes/format';

/** The logged-in home: today's brief, then what changed recently, then a way to add. */
export function Home() {
  const briefs = useDocuments('brief');
  const recent = useRecentDocuments(10);
  const picked = briefs.data ? pickBrief(briefs.data.items, todayIso()) : null;

  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-label="Today's brief">
        {briefs.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {briefs.isError && <Alert tone="danger">{briefs.error.message}</Alert>}
        {briefs.data && !picked && (
          <div className="rounded-card border border-dashed border-border p-5 text-sm text-muted-foreground">
            No brief yet. The brief writer posts one each morning once its scheduled task is set up
            (docs/runbooks/morning-brief.md).
          </div>
        )}
        {picked && (
          <BriefView
            item={picked.item}
            kicker={picked.isToday ? "Today's brief" : 'Latest brief · none for today yet'}
          />
        )}
      </section>

      <section className="grid gap-3" aria-label="Recent documents">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Recent
          </h2>
          <Link to="/recipes/new" className="text-sm underline underline-offset-2">
            New recipe
          </Link>
        </div>
        {recent.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {recent.isError && <Alert tone="danger">{recent.error.message}</Alert>}
        {recent.data && recent.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Chili would be a fine first one.
          </p>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <ul className="divide-y divide-border rounded-card border border-border">
            {recent.data.items.map((item) => (
              <li key={item.document.id}>
                <Link to={pathFor(item)} className="block px-4 py-3 hover:bg-muted">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">
                      <span className="mr-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {typeLabels[item.document.type] ?? item.document.type}
                      </span>
                      {titleOf(item.version.frontmatter)}
                    </span>
                    <span className="text-xs text-muted-foreground">v{item.version.number}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.version.author.name} · {item.version.summary || 'no summary'} ·{' '}
                    {when(item.version.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
