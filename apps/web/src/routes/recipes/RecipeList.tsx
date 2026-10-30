import { useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useDocuments } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { SearchIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { titleOf, when } from '@/routes/recipes/format';

export function RecipeList() {
  const recipes = useDocuments('recipe');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const field = useRef<HTMLInputElement>(null);
  const q = params.get('q') ?? '';

  // ⌘K and the nav's search button land here asking for the field.
  useEffect(() => {
    if ((location.state as { focusSearch?: boolean } | null)?.focusSearch) field.current?.focus();
  }, [location.state]);

  const needle = q.trim().toLowerCase();
  const items = (recipes.data?.items ?? []).filter(
    ({ version }) => !needle || titleOf(version.frontmatter).toLowerCase().includes(needle),
  );

  return (
    <div className="grid gap-6">
      <h1 className="page-title">Recipes</h1>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input
          ref={field}
          type="search"
          aria-label="Search recipes"
          placeholder="Search recipes"
          enterKeyHint="search"
          className="pl-11"
          value={q}
          onChange={(event) =>
            setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })
          }
        />
      </div>

      {recipes.isPending && <p className="text-sm text-muted">Loading…</p>}
      {recipes.isError && <Alert tone="danger">{recipes.error.message}</Alert>}
      {recipes.data && recipes.data.items.length === 0 && (
        <p className="text-sm text-muted">Nothing yet. Chili would be a fine first one.</p>
      )}
      {recipes.data && recipes.data.items.length > 0 && items.length === 0 && (
        <p className="text-sm text-muted">Nothing matches “{q}”.</p>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {items.map(({ document, version }) => (
            <li key={document.id}>
              <Link to={`/recipes/${document.id}`} className="block py-3 hover:bg-surface">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-[19px]">{titleOf(version.frontmatter)}</span>
                  <span className="text-xs text-muted tabular-nums">v{version.number}</span>
                </div>
                <p className="mt-1 text-[13px] text-muted">
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
