import { tagsSchema } from '../document.js';

/**
 * The recipe taxonomy of docs/DESIGN-VALUES.md: facets are controlled vocabularies, one
 * value per facet per recipe, stored on the document as namespaced tags (`course:main`);
 * flags are tags too (`flag:vegetarian`). `proven` is not here: it is true of a version
 * and lives in frontmatter. Values are kebab-case; labels are for screens and the guide.
 */
export const recipeFacets = {
  course: [
    'breakfast',
    'main',
    'side',
    'soup-stew',
    'bread',
    'dessert',
    'drink',
    'sauce-condiment',
    'snack',
  ],
  main: [
    'chicken',
    'beef',
    'pork',
    'lamb',
    'fish-shellfish',
    'eggs',
    'beans-legumes',
    'pasta-grains',
    'vegetables',
    'fruit',
  ],
  effort: ['weeknight', 'weekend', 'project', 'make-ahead'],
  technique: [
    'skillet',
    'roast',
    'braise',
    'grill',
    'slow-cooker',
    'pressure-cooker',
    'bake',
    'no-cook',
    'ferment-preserve',
  ],
  season: ['spring', 'summer', 'fall', 'winter', 'any'],
  occasion: ['family-table', 'small-group', 'holiday', 'guests', 'cookoff'],
} as const satisfies Record<string, readonly string[]>;

export type RecipeFacet = keyof typeof recipeFacets;
export const recipeFacetNames = Object.keys(recipeFacets) as RecipeFacet[];

export const recipeFlags = ['kid-approved', 'vegetarian', 'gluten-free'] as const;
export type RecipeFlag = (typeof recipeFlags)[number];

export const FLAG_NAMESPACE = 'flag';

export const facetLabels: Record<RecipeFacet, string> = {
  course: 'Course',
  main: 'Main ingredient',
  effort: 'Effort',
  technique: 'Technique',
  season: 'Season',
  occasion: 'Occasion',
};

const specialLabels: Record<string, string> = {
  'soup-stew': 'Soup & stew',
  'sauce-condiment': 'Sauce & condiment',
  'fish-shellfish': 'Fish & shellfish',
  'beans-legumes': 'Beans & legumes',
  'pasta-grains': 'Pasta & grains',
  'no-cook': 'No-cook',
  'ferment-preserve': 'Ferment & preserve',
  'kid-approved': 'Kid-approved',
  'gluten-free': 'Gluten-free',
  'make-ahead': 'Make-ahead',
};

/** "soup-stew" → "Soup & stew", "slow-cooker" → "Slow cooker", "any" → "Any". */
export function valueLabel(value: string): string {
  const special = specialLabels[value];
  if (special) return special;
  const words = value.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function facetTag(facet: RecipeFacet, value: string): string {
  return `${facet}:${value}`;
}

export function flagTag(flag: RecipeFlag): string {
  return `${FLAG_NAMESPACE}:${flag}`;
}

export type ParsedTag =
  | { kind: 'facet'; facet: RecipeFacet; value: string }
  | { kind: 'flag'; value: RecipeFlag }
  | { kind: 'free'; value: string };

/** What a tag on a recipe means. Unknown namespaces are not tags of this type. */
export function parseRecipeTag(tag: string): ParsedTag | null {
  const colon = tag.indexOf(':');
  if (colon === -1) return { kind: 'free', value: tag };
  const namespace = tag.slice(0, colon);
  const value = tag.slice(colon + 1);
  if (namespace === FLAG_NAMESPACE) {
    return (recipeFlags as readonly string[]).includes(value)
      ? { kind: 'flag', value: value as RecipeFlag }
      : null;
  }
  if (namespace in recipeFacets) {
    const facet = namespace as RecipeFacet;
    return (recipeFacets[facet] as readonly string[]).includes(value)
      ? { kind: 'facet', facet, value }
      : null;
  }
  return null;
}

/** The label a chip shows for a tag: the value's label for facets and flags, the text for free tags. */
export function tagLabel(tag: string): string {
  const parsed = parseRecipeTag(tag);
  if (!parsed || parsed.kind === 'free') return tag;
  return valueLabel(parsed.value);
}

/** The facet values and flags set on a document, by name, for screens and forms. */
export function recipeTagsOf(tags: string[]): {
  facets: Partial<Record<RecipeFacet, string>>;
  flags: RecipeFlag[];
  free: string[];
} {
  const facets: Partial<Record<RecipeFacet, string>> = {};
  const flags: RecipeFlag[] = [];
  const free: string[] = [];
  for (const tag of tags) {
    const parsed = parseRecipeTag(tag);
    if (!parsed) continue;
    if (parsed.kind === 'facet') facets[parsed.facet] = parsed.value;
    else if (parsed.kind === 'flag') flags.push(parsed.value);
    else free.push(parsed.value);
  }
  return { facets, flags, free };
}

/**
 * Tags on a recipe, validated against the vocabulary: a namespaced tag must name a facet
 * or `flag` and a value in its list; one value per facet; duplicates collapse. Tags with
 * no namespace stay free text, as every document allows. The output is ordered: facets
 * in the contract's order, then flags, then free tags.
 */
export const recipeTagsSchema = tagsSchema.transform((tags, ctx) => {
  const facets = new Map<RecipeFacet, string>();
  const flags = new Set<RecipeFlag>();
  const free = new Set<string>();
  tags.forEach((tag, index) => {
    const parsed = parseRecipeTag(tag);
    if (!parsed) {
      const [namespace] = tag.split(':');
      const known = namespace === FLAG_NAMESPACE || namespace! in recipeFacets;
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: known
          ? `"${tag}" is not a value of ${namespace}; one of ${vocabularyOf(namespace!).join(', ')}`
          : `"${tag}" uses an unknown namespace; facets are ${recipeFacetNames.join(', ')} and flags are flag:<name>`,
      });
      return;
    }
    if (parsed.kind === 'facet') {
      const existing = facets.get(parsed.facet);
      if (existing !== undefined && existing !== parsed.value) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: `one value per facet: ${parsed.facet} already has "${existing}"`,
        });
        return;
      }
      facets.set(parsed.facet, parsed.value);
    } else if (parsed.kind === 'flag') flags.add(parsed.value);
    else free.add(parsed.value);
  });
  return [
    ...recipeFacetNames.flatMap((facet) => {
      const value = facets.get(facet);
      return value === undefined ? [] : [facetTag(facet, value)];
    }),
    ...recipeFlags.filter((flag) => flags.has(flag)).map(flagTag),
    ...free,
  ];
});

function vocabularyOf(namespace: string): readonly string[] {
  return namespace === FLAG_NAMESPACE
    ? recipeFlags
    : (recipeFacets[namespace as RecipeFacet] ?? []);
}

/** The vocabulary in a paragraph a model can follow, for the MCP tool descriptions. */
export function recipeTaxonomyGuide(): string {
  const facets = recipeFacetNames
    .map((facet) => `${facet}: ${recipeFacets[facet].join(', ')}`)
    .join('; ');
  return (
    `Tags on a recipe are facets, one value each, written namespace:value (${facets}), ` +
    `and flags written flag:<name> (${recipeFlags.join(', ')}). Pick only what the recipe ` +
    `plainly is; leave a facet out rather than guess. "Saturday morning breakfast ideas" is ` +
    `course:breakfast plus words.`
  );
}
