import {
  facetLabels,
  facetTag,
  flagTag,
  type RecipeFacet,
  recipeFacetNames,
  recipeFacets,
  recipeFlags,
  recipeTagsOf,
  tagLabel,
  valueLabel,
} from '@the-keep/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useSearch } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { CheckIcon, ChevronDownIcon, SearchIcon } from '@/components/icons';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import { minutes, recipeOf, titleOf } from '@/routes/recipes/format';

/** The URL is the state: `?q=words&tags=course:breakfast,flag:vegetarian`. */
function readTags(params: URLSearchParams): string[] {
  return (params.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * The Recipes list of the contract: search at the top; facet filters as an accordion on
 * the phone (one open) and a rail on the desktop (all expanded), beside the results by
 * flex-wrap; active filters as inverted chips above results; results as a list with
 * hairlines, title in Literata, facets in muted, total time right-aligned, a check for
 * proven.
 */
export function RecipeList() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const field = useRef<HTMLInputElement>(null);
  const q = params.get('q') ?? '';
  const tags = readTags(params);
  const [draft, setDraft] = useState(q);
  const results = useSearch({ type: 'recipe', q, tags });

  // ⌘K and the nav's search button land here asking for the field.
  useEffect(() => {
    if ((location.state as { focusSearch?: boolean } | null)?.focusSearch) field.current?.focus();
  }, [location.state]);

  // Typing is debounced into the URL; the URL is what is searched.
  useEffect(() => {
    if (draft === q) return;
    const handle = setTimeout(() => update({ q: draft }), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  // The sheet's search and ⌘K may change the URL under us.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDraft(q), [q]);

  function update(next: { q?: string; tags?: string[] }) {
    const out = new URLSearchParams();
    const nextQ = (next.q ?? q).trim();
    const nextTags = next.tags ?? tags;
    if (nextQ) out.set('q', nextQ);
    if (nextTags.length) out.set('tags', nextTags.join(','));
    setParams(out, { replace: true });
  }

  const toggleTag = (tag: string) => {
    const facet = tag.split(':')[0] as string;
    const without = tags.filter(
      (t) => t !== tag && (facet === 'flag' || !t.startsWith(`${facet}:`)),
    );
    update({ tags: tags.includes(tag) ? without : [...without, tag] });
  };

  const items = results.data?.items ?? [];
  const filtering = q.trim() !== '' || tags.length > 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="page-title">Recipes</h1>
        {results.data && (
          <p className="text-sm text-muted tabular-nums">
            {filtering ? `${items.length} of ${results.data.total}` : `${results.data.total}`}
          </p>
        )}
      </div>

      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: draft });
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input
          ref={field}
          type="search"
          aria-label="Search recipes"
          placeholder="Search by title, ingredient, or note"
          enterKeyHint="search"
          className="pl-11"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>

      <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
        <Filters selected={tags} onToggle={toggleTag} />

        <section aria-label="Results" className="min-w-0 grow basis-[22rem]">
          {tags.length > 0 && (
            <ul className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {tags.map((tag) => (
                <li key={tag}>
                  <Chip
                    selected
                    onClick={() => toggleTag(tag)}
                    aria-label={`Remove ${tagLabel(tag)}`}
                  >
                    {tagLabel(tag)}
                    <span aria-hidden="true">×</span>
                  </Chip>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={cn(
                    'h-7 rounded-sm px-1 text-[13px] text-muted underline-offset-2 hover:underline',
                    focusRing,
                  )}
                  onClick={() => update({ tags: [] })}
                >
                  Clear
                </button>
              </li>
            </ul>
          )}

          {results.isPending && <p className="text-sm text-muted">Loading…</p>}
          {results.isError && <Alert tone="danger">{results.error.message}</Alert>}
          {results.data && items.length === 0 && (
            <p className="text-sm text-muted">
              {filtering ? 'Nothing matches.' : 'Nothing yet. Chili would be a fine first one.'}
            </p>
          )}
          {items.length > 0 && (
            <ul className="divide-y divide-border border-y border-border">
              {items.map(({ document, version }) => {
                const r = recipeOf(version.frontmatter);
                const { facets } = recipeTagsOf(document.tags);
                const facetLine = recipeFacetNames
                  .filter((f) => facets[f])
                  .map((f) => valueLabel(facets[f]!));
                return (
                  <li key={document.id}>
                    <Link
                      to={`/recipes/${document.id}`}
                      className={cn(
                        'flex min-h-14 items-baseline gap-4 py-3 hover:bg-surface',
                        focusRing,
                      )}
                    >
                      <span className="min-w-0 grow">
                        <span className="block font-serif text-[19px] leading-snug text-text-strong">
                          {titleOf(version.frontmatter)}
                        </span>
                        {facetLine.length > 0 && (
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {facetLine.join(' · ')}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-muted tabular-nums">
                        {r?.proven && (
                          <CheckIcon
                            width="16"
                            height="16"
                            className="text-text-strong"
                            aria-hidden={false}
                            aria-label="Proven"
                            role="img"
                          />
                        )}
                        {r?.totalMinutes !== undefined && minutes(r.totalMinutes)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const groups: Array<{ key: RecipeFacet | 'flag'; label: string; tagsOf: () => string[] }> = [
  ...recipeFacetNames.map((facet) => ({
    key: facet,
    label: facetLabels[facet],
    tagsOf: () => recipeFacets[facet].map((value) => facetTag(facet, value)),
  })),
  { key: 'flag' as const, label: 'Flags', tagsOf: () => recipeFlags.map(flagTag) },
];

/** One facet open at a time on the phone; all expanded as a rail on the desktop. */
function Filters({ selected, onToggle }: { selected: string[]; onToggle(tag: string): void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <nav aria-label="Filters" className="w-full shrink-0 md:w-60">
      <ul className="divide-y divide-border border-y border-border md:divide-y-0 md:border-0">
        {groups.map((group) => {
          const isOpen = open === group.key;
          const chosen = selected.filter((t) => group.tagsOf().includes(t));
          return (
            <li key={group.key} className="md:mb-5">
              <button
                type="button"
                className={cn(
                  'flex h-12 w-full items-center justify-between gap-2 text-left md:hidden',
                  focusRing,
                )}
                aria-expanded={isOpen}
                aria-controls={`filters-${group.key}`}
                onClick={() => setOpen(isOpen ? null : group.key)}
              >
                <span className="font-semibold text-text-strong">{group.label}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {chosen.length ? chosen.map(tagLabel).join(', ') : 'Any'}
                  <ChevronDownIcon
                    width="16"
                    height="16"
                    className={cn('transition-transform', isOpen && 'rotate-180')}
                  />
                </span>
              </button>
              <h2 className="mb-2 hidden items-baseline justify-between md:flex">
                <span className="text-sm font-semibold text-text-strong">{group.label}</span>
                <span className="text-[13px] text-muted">
                  {chosen.length ? chosen.map(tagLabel).join(', ') : 'Any'}
                </span>
              </h2>
              <ul
                id={`filters-${group.key}`}
                className={cn(
                  'flex flex-wrap gap-2 pb-3 md:pb-0',
                  isOpen ? 'flex' : 'hidden md:flex',
                )}
              >
                {group.tagsOf().map((tag) => (
                  <li key={tag}>
                    <Chip selected={selected.includes(tag)} onClick={() => onToggle(tag)}>
                      {tagLabel(tag)}
                    </Chip>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
