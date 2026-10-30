import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteDocument, useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { dates, recipeOf, titleOf } from '@/routes/recipes/format';

export function RecipeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useDocument(id);
  const remove = useDeleteDocument();

  if (recipe.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;

  const { document, version } = recipe.data;
  const r = recipeOf(version.frontmatter);
  const facts: Array<[string, string]> = [];
  if (r?.servings !== undefined) facts.push(['Servings', String(r.servings)]);
  if (r?.prepMinutes !== undefined) facts.push(['Prep', `${r.prepMinutes} min`]);
  if (r?.cookMinutes !== undefined) facts.push(['Cook', `${r.cookMinutes} min`]);

  return (
    <article className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Recipe</p>
          <h1 className="mt-1 page-title">{titleOf(version.frontmatter)}</h1>
          <p className="mt-1 text-xs text-muted">
            v{version.number} · {version.author.name} · {dates(version)}
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

      {facts.length > 0 && (
        <dl className="grid grid-cols-3 gap-4 rounded-lg border border-border p-4 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {r && (
        <section>
          <h2 className="eyebrow">Ingredients</h2>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            {r.ingredients.map((group, g) => (
              <div key={g}>
                {group.heading && <h3 className="text-sm font-semibold">{group.heading}</h3>}
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {group.items.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="eyebrow">Method</h2>
        <div className="mt-2">
          <Markdown>{version.body}</Markdown>
        </div>
      </section>

      <div className="border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-wrong"
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
