import { Link, useParams } from 'react-router';
import { useDocument, useVersions } from '@/api/documents';
import { Loading, QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { dates } from '@/lib/dates';
import { titleOf } from '@/lib/frontmatter';

export function RecipeHistory() {
  const { id = '' } = useParams();
  const recipe = useDocument(id);
  const versions = useVersions(id);

  if (recipe.isError || versions.isError) return <QueryError queries={[recipe, versions]} />;
  if (recipe.isPending || versions.isPending) return <Loading />;

  const items = versions.data.items;
  const latest = items[0]?.number ?? 1;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="mt-1 page-title">
            <Link to={`/recipes/${id}`} className="hover:underline">
              {titleOf(recipe.data.version.frontmatter)}
            </Link>
          </h1>
        </div>
        {items.length > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/recipes/${id}/diff?from=${latest - 1}&to=${latest}`}>
              Compare latest two
            </Link>
          </Button>
        )}
      </div>

      <ol className="divide-y divide-border border-y border-border">
        {items.map((version) => (
          <li key={version.id} className="grid gap-1 py-4 text-[15px]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-semibold text-text-strong tabular-nums">v{version.number}</span>
              <span className="text-[13px] text-muted">
                {version.author.name} · {dates(version)}
              </span>
            </div>
            <p className="reading max-w-none text-[17px]">{version.summary || 'no summary'}</p>
            {version.number > 1 && (
              <Link
                to={`/recipes/${id}/diff?from=${version.number - 1}&to=${version.number}`}
                className="w-fit text-sm text-muted underline decoration-border-strong underline-offset-[3px] hover:text-text"
              >
                Diff from v{version.number - 1}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
