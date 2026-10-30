import { Link } from 'react-router';
import { useDocuments } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { titleOf, when } from '@/routes/recipes/format';

export function RecipeList() {
  const recipes = useDocuments('recipe');

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Recipes</h1>
        <Button asChild>
          <Link to="/recipes/new">New recipe</Link>
        </Button>
      </div>

      {recipes.isPending && <p className="text-sm text-muted">Loading…</p>}
      {recipes.isError && <Alert tone="danger">{recipes.error.message}</Alert>}
      {recipes.data && recipes.data.items.length === 0 && (
        <p className="text-sm text-muted">Nothing yet. Chili would be a fine first one.</p>
      )}
      {recipes.data && recipes.data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {recipes.data.items.map(({ document, version }) => (
            <li key={document.id}>
              <Link to={`/recipes/${document.id}`} className="block px-4 py-3 hover:bg-surface">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{titleOf(version.frontmatter)}</span>
                  <span className="text-xs text-muted">v{version.number}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {version.summary || 'no summary'} · {when(version.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
