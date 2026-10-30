import { Link, useParams } from 'react-router';
import { useDocument, useVersions } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { dates, titleOf } from '@/routes/recipes/format';

export function RecipeHistory() {
  const { id = '' } = useParams();
  const recipe = useDocument(id);
  const versions = useVersions(id);

  if (recipe.isPending || versions.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;
  if (versions.isError) return <Alert tone="danger">{versions.error.message}</Alert>;

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

      <ol className="divide-y divide-border rounded-lg border border-border">
        {items.map((version) => (
          <li
            key={version.id}
            className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium">v{version.number}</span>
              <span className="ml-2 text-muted">{version.summary || 'no summary'}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>
                {version.author.name} · {dates(version)}
              </span>
              {version.number > 1 && (
                <Link
                  to={`/recipes/${id}/diff?from=${version.number - 1}&to=${version.number}`}
                  className="text-text hover:underline"
                >
                  Diff from v{version.number - 1}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
