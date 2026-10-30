import { recipeFacetNames, recipeTagsOf, valueLabel } from '@the-keep/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteDocument, useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { CheckIcon } from '@/components/icons';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import {
  minutes,
  recipeOf,
  shortDay,
  splitHeadnote,
  splitIngredient,
  titleOf,
  versionLine,
  withoutMethodHeading,
} from '@/routes/recipes/format';

/**
 * The recipe screen of docs/DESIGN-VALUES.md and docs/design/recipe-*.png: title, headnote
 * in italic, provenance, facets as quiet chips, the times in tabular figures with Proven
 * or Untested beside them, ingredient groups beside the method by flex-wrap, "Changed in
 * vN", and the version line with History as the page's one accented element.
 */
export function RecipeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useDocument(id);
  const remove = useDeleteDocument();

  if (recipe.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;

  const { document, version } = recipe.data;
  const r = recipeOf(version.frontmatter);
  const { headnote, method } = splitHeadnote(version.body);
  const { facets, flags } = recipeTagsOf(document.tags);
  const chips = [
    ...recipeFacetNames.flatMap((facet) =>
      facets[facet]
        ? [{ tag: `${facet}:${facets[facet]}`, label: valueLabel(facets[facet]!) }]
        : [],
    ),
    ...flags.map((flag) => ({ tag: `flag:${flag}`, label: valueLabel(flag) })),
  ];
  const facts: Array<[string, string]> = [];
  if (r?.activeMinutes !== undefined) facts.push(['Active', minutes(r.activeMinutes)]);
  if (r?.totalMinutes !== undefined) facts.push(['Total', minutes(r.totalMinutes)]);
  if (r?.serves !== undefined) facts.push(['Serves', String(r.serves)]);

  return (
    <article className="grid gap-8">
      <header className="grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <Link
            to="/recipes"
            className={cn(
              'inline-flex h-11 items-center gap-1 rounded-md text-sm text-muted hover:text-text',
              focusRing,
            )}
          >
            <span aria-hidden="true">‹</span> Recipes
          </Link>
          <Button asChild size="sm">
            <Link to={`/recipes/${document.id}/edit`}>Edit</Link>
          </Button>
        </div>
        <div className="reading max-w-[42rem]">
          <h1 className="page-title">{titleOf(version.frontmatter)}</h1>
          {headnote && (
            <Markdown variant="reading" className="mt-4 italic">
              {headnote}
            </Markdown>
          )}
          {r?.provenance && (
            <p className="mt-4 font-sans text-sm text-muted">Provenance · {r.provenance}</p>
          )}
        </div>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Facets">
            {chips.map((chip) => (
              <li key={chip.tag}>
                <Chip asChild>
                  <Link to={`/recipes?tags=${encodeURIComponent(chip.tag)}`}>{chip.label}</Link>
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </header>

      {(facts.length > 0 || r) && (
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y border-border py-3 text-[15px]">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
          {r && (
            <div className="ml-auto flex items-baseline gap-1.5">
              {r.proven ? (
                <>
                  <dt className="flex items-center gap-1.5 font-semibold text-text-strong">
                    <CheckIcon width="16" height="16" />
                    Proven
                  </dt>
                  <dd className="text-muted tabular-nums">
                    · cooked {r.proven.count} {r.proven.count === 1 ? 'time' : 'times'}
                    {r.proven.last ? ` · last ${shortDay(r.proven.last)}` : ''}
                  </dd>
                </>
              ) : (
                <dt className="text-muted italic">Untested</dt>
              )}
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-wrap items-start gap-x-12 gap-y-8">
        {r && (
          <section
            aria-labelledby="ingredients-heading"
            className="min-w-0 grow basis-64 md:grow-0"
          >
            <h2 id="ingredients-heading" className="eyebrow">
              Ingredients
            </h2>
            <div className="mt-4 grid gap-5">
              {r.ingredients.map((group, g) => (
                <div key={g}>
                  {group.heading && (
                    <h3 className="mb-2 font-serif text-[17px] font-semibold text-text-strong">
                      {group.heading}
                    </h3>
                  )}
                  <ul className="grid gap-1.5 text-[15px]">
                    {group.items.map((line, i) => {
                      const { amount, item } = splitIngredient(line);
                      return (
                        <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-3 leading-snug">
                          <span className="text-muted tabular-nums">{amount}</span>
                          <span>{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="method-heading" className="min-w-0 grow basis-[24rem]">
          <h2 id="method-heading" className="eyebrow">
            Method
          </h2>
          <Markdown variant="method" className="mt-4">
            {withoutMethodHeading(method)}
          </Markdown>

          {version.summary && (
            <aside className="mt-8 rounded-lg border border-border bg-surface px-5 py-4">
              <p className="text-sm text-muted">Changed in v{version.number}</p>
              <p className="mt-1 text-[15px] leading-relaxed">{version.summary}</p>
            </aside>
          )}

          <p className="mt-6 text-sm text-muted">
            {versionLine(version)} ·{' '}
            <Link
              to={`/recipes/${document.id}/history`}
              className={cn('rounded-sm text-accent hover:underline', focusRing)}
            >
              History
            </Link>
          </p>
        </section>
      </div>

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
