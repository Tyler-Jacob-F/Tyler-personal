import { Link } from 'react-router';
import { useAgentActivity } from '@/api/activity';
import { AdminNav } from '@/components/AdminNav';
import { Loading, QueryError } from '@/components/QueryState';
import { Chip } from '@/components/ui/chip';
import { dates, when } from '@/lib/dates';
import { pathFor, typeLabel } from '@/lib/document-types';
import { tagLabel } from '@the-keep/shared';

const DAYS = 30;

/**
 * What the agents wrote, apart from anything a person saved: every version authored by a
 * token in the last thirty days, newest first, with the token's name.
 */
export function ActivityPage() {
  const activity = useAgentActivity(DAYS);

  return (
    <div className="grid gap-6">
      <AdminNav />
      <div>
        <h1 className="page-title">Agent activity</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Every version an agent token wrote, and every tag set one replaced, in the last {DAYS}{' '}
          days, newest first. What people saved is not here.{' '}
          <Link to="/admin/tokens" className="underline underline-offset-2">
            Tokens
          </Link>
        </p>
      </div>

      <QueryError queries={[activity]} />
      {activity.isPending && <Loading />}
      {activity.data && activity.data.items.length === 0 && (
        <p className="text-sm text-muted">
          Nothing yet. The first import or the first morning brief will show up here.
        </p>
      )}
      {activity.data && activity.data.items.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {activity.data.items.map((item) => (
            <li
              key={item.kind === 'version' ? item.versionId : item.changeId}
              className="py-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="flex items-baseline gap-2">
                  <Chip className="font-mono">{item.token.name}</Chip>
                  <span className="eyebrow">{typeLabel(item.documentType)}</span>
                  <Link
                    to={pathFor(item.documentType, item.documentId)}
                    className="font-medium hover:underline"
                  >
                    {item.title}
                  </Link>
                  <span className="text-xs text-muted tabular-nums">
                    {item.kind === 'version' ? `v${item.number}` : 'tagged'}
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {item.kind === 'version' ? dates(item) : when(item.createdAt)}
                </span>
              </div>
              {item.kind === 'version' ? (
                <p className="mt-1 text-xs text-muted">{item.summary || 'no summary'}</p>
              ) : (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.tags.length === 0 && <span className="text-xs text-muted">no tags</span>}
                  {item.tags.map((tag) => (
                    <Chip key={tag}>{tagLabel(tag)}</Chip>
                  ))}
                  {item.previousTags.filter((tag) => !item.tags.includes(tag)).length > 0 && (
                    <span className="text-xs text-muted">
                      was {item.previousTags.filter((tag) => !item.tags.includes(tag)).join(' ')}
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
