import { Link } from 'react-router';
import { useAgentActivity } from '@/api/activity';
import { Alert } from '@/components/Alert';
import { typeLabels } from '@/routes/home/home';
import { dates } from '@/routes/recipes/format';

const DAYS = 30;

function pathFor(item: { documentType: string; documentId: string }): string {
  return item.documentType === 'brief'
    ? `/briefs/${item.documentId}`
    : `/recipes/${item.documentId}`;
}

/**
 * What the agents wrote, apart from anything a person saved: every version authored by a
 * token in the last thirty days, newest first, with the token's name.
 */
export function ActivityPage() {
  const activity = useAgentActivity(DAYS);

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="mt-1 page-title">Agent activity</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Every version an agent token wrote in the last {DAYS} days, newest first. What people
          saved is not here; the home screen&apos;s recent list has both.{' '}
          <Link to="/admin/tokens" className="underline underline-offset-2">
            Tokens
          </Link>
        </p>
      </div>

      {activity.isPending && <p className="text-sm text-muted">Loading…</p>}
      {activity.isError && <Alert tone="danger">{activity.error.message}</Alert>}
      {activity.data && activity.data.items.length === 0 && (
        <p className="text-sm text-muted">
          Nothing yet. The first import or the first morning brief will show up here.
        </p>
      )}
      {activity.data && activity.data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {activity.data.items.map((item) => (
            <li key={item.versionId} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="flex items-baseline gap-2">
                  <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
                    {item.token.name}
                  </span>
                  <span className="eyebrow">
                    {typeLabels[item.documentType] ?? item.documentType}
                  </span>
                  <Link to={pathFor(item)} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  <span className="text-xs text-muted">v{item.number}</span>
                </span>
                <span className="text-xs text-muted">{dates(item)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{item.summary || 'no summary'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
