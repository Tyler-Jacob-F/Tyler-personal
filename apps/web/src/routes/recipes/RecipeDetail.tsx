import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteDocument, useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { recipeOf, titleOf, when } from '@/routes/recipes/format';

export function RecipeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useDocument(id);
  const remove = useDeleteDocument();

  if (recipe.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;

  const { document, version } = recipe.data;
  const r = recipeOf(version.frontmatter);

  return (
    <article className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Recipe
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {titleOf(version.frontmatter)}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            v{version.number} · {version.author.name} · {when(version.createdAt)}
            {version.summary ? ` · ${version.summary}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/recipes/${document.id}/history`}>History</Link>
          </Button>
          <Button asChild size="sm">
            <Link to={`/recipes/${document.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      {r && (
        <dl className="grid grid-cols-3 gap-4 rounded-card border border-border p-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Servings</dt>
            <dd className="font-medium">{r.servings}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prep</dt>
            <dd className="font-medium">{r.prepMinutes} min</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cook</dt>
            <dd className="font-medium">{r.cookMinutes} min</dd>
          </div>
        </dl>
      )}

      {r && (
        <section>
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Ingredients
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {r.ingredients.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Method
        </h2>
        <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">{version.body}</pre>
      </section>

      <div className="border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={remove.isPending}
          onClick={async () => {
            if (!window.confirm('Delete this recipe? Its versions stay in the database.')) return;
            await remove.mutateAsync(document.id);
            navigate('/recipes');
          }}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}
