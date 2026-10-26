import type { FrontmatterChange } from '@the-keep/shared';
import { Link, useParams, useSearchParams } from 'react-router';
import { useDiff, useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { DiffView } from '@/components/DiffView';
import { titleOf, when } from '@/routes/recipes/format';

function show(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function FrontmatterChanges({ changes }: { changes: FrontmatterChange[] }) {
  if (changes.length === 0)
    return <p className="text-sm text-muted-foreground">No changes to the details.</p>;
  return (
    <dl className="divide-y divide-border rounded-card border border-border text-sm">
      {changes.map((c) => (
        <div key={c.key} className="grid gap-1 px-4 py-3 md:grid-cols-[8rem_1fr]">
          <dt className="font-medium">
            {c.key} <span className="text-xs font-normal text-muted-foreground">{c.change}</span>
          </dt>
          <dd className="grid gap-1">
            {c.change !== 'added' && (
              <span className="text-destructive line-through">{show(c.from)}</span>
            )}
            {c.change !== 'removed' && <span className="text-success">{show(c.to)}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RecipeDiff() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const from = Number(params.get('from') ?? 0);
  const to = Number(params.get('to') ?? 0);
  const recipe = useDocument(id);
  const diff = useDiff(id, from, to);

  if (!(from > 0 && to > 0)) return <Alert tone="danger">Pick two versions to compare.</Alert>;
  if (recipe.isPending || diff.isPending)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;
  if (diff.isError) return <Alert tone="danger">{diff.error.message}</Alert>;

  const d = diff.data;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          v{d.from.number} → v{d.to.number}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          <Link to={`/recipes/${id}`} className="hover:underline">
            {titleOf(recipe.data.version.frontmatter)}
          </Link>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {d.to.summary || 'no summary'} · {d.to.author.name} · {when(d.to.createdAt)} ·{' '}
          <Link to={`/recipes/${id}/history`} className="hover:underline">
            history
          </Link>
        </p>
      </div>

      <section className="grid gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Details
        </h2>
        <FrontmatterChanges changes={d.frontmatter} />
      </section>

      <section className="grid gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Method
        </h2>
        <DiffView patch={d.body} />
      </section>
    </div>
  );
}
