import type { FrontmatterChange, IngredientGroupDiff } from '@the-keep/shared';
import { Link, useParams, useSearchParams } from 'react-router';
import { useDiff, useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { DiffView } from '@/components/DiffView';
import { dates, titleOf } from '@/routes/recipes/format';
import { cn } from '@/lib/utils';

function show(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function FrontmatterChanges({ changes }: { changes: FrontmatterChange[] }) {
  if (changes.length === 0) return <p className="text-sm text-muted">No changes to the details.</p>;
  return (
    <dl className="divide-y divide-border border-y border-border text-sm">
      {changes.map((c) => (
        <div key={c.key} className="grid gap-1 py-3 md:grid-cols-[8rem_1fr]">
          <dt className="font-semibold text-text-strong">
            {c.key} <span className="text-xs font-normal text-muted">{c.change}</span>
          </dt>
          <dd className="grid gap-1">
            {c.change !== 'added' && (
              <span className="text-wrong line-through">{show(c.from)}</span>
            )}
            {c.change !== 'removed' && <span className="text-success">{show(c.to)}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const lineStyles = {
  added: 'bg-success/10 text-success',
  removed: 'bg-wrong/10 text-wrong line-through',
  same: '',
} as const;

function IngredientChanges({ groups }: { groups: IngredientGroupDiff[] }) {
  const changed = groups.filter((g) => g.change !== 'same');
  if (changed.length === 0)
    return <p className="text-sm text-muted">No changes to the ingredients.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {changed.map((group, g) => (
        <div key={g} className="rounded-lg border border-border text-sm">
          <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
            <span className="font-serif text-base font-semibold text-text-strong">
              {group.heading ?? 'Ingredients'}
            </span>
            <span className="text-xs text-muted">{group.change}</span>
          </div>
          <ul className="py-1 font-mono text-[13px]">
            {group.lines.map((line, i) => (
              <li key={i} className={cn('px-3 py-0.5', lineStyles[line.kind])}>
                <span className="mr-2 inline-block w-3 text-muted">
                  {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ''}
                </span>
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
  if (recipe.isPending || diff.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;
  if (diff.isError) return <Alert tone="danger">{diff.error.message}</Alert>;

  const d = diff.data;

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">
          v{d.from.number} → v{d.to.number}
        </p>
        <h1 className="mt-1 page-title">
          <Link to={`/recipes/${id}`} className="hover:underline">
            {titleOf(recipe.data.version.frontmatter)}
          </Link>
        </h1>
        <p className="mt-1 text-xs text-muted">
          {d.to.summary || 'no summary'} · {d.to.author.name} · {dates(d.to)} ·{' '}
          <Link to={`/recipes/${id}/history`} className="hover:underline">
            history
          </Link>
        </p>
      </div>

      {d.ingredients && (
        <section className="grid gap-2">
          <h2 className="eyebrow">Ingredients</h2>
          <IngredientChanges groups={d.ingredients} />
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="eyebrow">Details</h2>
        <FrontmatterChanges changes={d.frontmatter} />
      </section>

      <section className="grid gap-2">
        <h2 className="eyebrow">Method</h2>
        <DiffView patch={d.body} />
      </section>
    </div>
  );
}
