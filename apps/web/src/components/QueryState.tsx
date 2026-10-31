import { Alert } from '@/components/Alert';
import type { QueryLike } from '@/lib/queries';

/** The one quiet line every screen shows while its queries run. */
export function Loading() {
  return <p className="text-sm text-muted">Loading…</p>;
}

/**
 * The first failure among a screen's queries, as the one error alert; nothing when none
 * failed. Checked before "pending" on purpose: a page with two queries must not show
 * Loading over a failure.
 */
export function QueryError({ queries }: { queries: QueryLike[] }) {
  const failed = queries.find((q) => q.isError);
  return failed ? (
    <Alert tone="danger">{failed.error?.message ?? 'Something went wrong.'}</Alert>
  ) : null;
}
