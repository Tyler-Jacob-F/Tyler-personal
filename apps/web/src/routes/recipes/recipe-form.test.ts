import {
  emptyRecipe,
  formatIngredientGroups,
  fromVersion,
  parseIngredientGroups,
  recipeFormSchema,
  sameTags,
  toFrontmatter,
  toTags,
} from '@/routes/recipes/recipe-form';

describe('ingredient text', () => {
  it('turns heading lines into groups and round-trips', () => {
    const text = 'Meats (3 lb total):\n1 lb beef\n1 lb lamb\nBeans:\n1 can pinto';
    const groups = parseIngredientGroups(text);
    expect(groups).toEqual([
      { heading: 'Meats (3 lb total)', items: ['1 lb beef', '1 lb lamb'] },
      { heading: 'Beans', items: ['1 can pinto'] },
    ]);
    expect(formatIngredientGroups(groups)).toBe(text);
  });

  it('puts lines before any heading in an unnamed group and drops empty groups', () => {
    expect(parseIngredientGroups('salt\n\nPepper:\n')).toEqual([
      { heading: null, items: ['salt'] },
    ]);
    expect(formatIngredientGroups([{ heading: null, items: ['salt'] }])).toBe('salt');
  });
});

const base = { ...emptyRecipe, title: 'Chili', ingredientsText: 'salt' };

describe('recipeFormSchema', () => {
  it('treats blank numbers and blank dates as absent', () => {
    const out = recipeFormSchema.parse({
      ...base,
      serves: '',
      activeMinutes: ' ',
      totalMinutes: '180',
    });
    expect(out.serves).toBeUndefined();
    expect(out.activeMinutes).toBeUndefined();
    expect(out.totalMinutes).toBe(180);
    expect(out.provenCount).toBeUndefined();
    expect(out.provenLast).toBeNull();
    expect(out.authoredAt).toBeNull();
  });

  it('rejects a malformed date, a fractional count, active over total, and a last-cooked date with no count', () => {
    expect(recipeFormSchema.safeParse({ ...base, authoredAt: 'last winter' }).success).toBe(false);
    expect(recipeFormSchema.safeParse({ ...base, authoredAt: '2023-11-06' }).success).toBe(true);
    expect(recipeFormSchema.safeParse({ ...base, serves: '1.5' }).success).toBe(false);
    const over = recipeFormSchema.safeParse({ ...base, activeMinutes: '200', totalMinutes: '180' });
    expect(over.success).toBe(false);
    expect(over.error!.issues[0]!.path).toEqual(['activeMinutes']);
    const dated = recipeFormSchema.safeParse({ ...base, provenLast: '2026-02-01' });
    expect(dated.success).toBe(false);
    expect(dated.error!.issues[0]!.path).toEqual(['provenCount']);
  });

  it('holds a facet to its vocabulary', () => {
    expect(
      recipeFormSchema.safeParse({ ...base, facets: { ...base.facets, course: 'brunch' } }).success,
    ).toBe(false);
    expect(
      recipeFormSchema.safeParse({ ...base, facets: { ...base.facets, course: 'main' } }).success,
    ).toBe(true);
  });
});

describe('to and from the API shapes', () => {
  it('builds frontmatter with the contract fields and proven as a count with a date', () => {
    const out = recipeFormSchema.parse({
      ...base,
      activeMinutes: '20',
      totalMinutes: '180',
      serves: '8',
      provenance: 'Steve’s card, 2014',
      provenCount: '3',
      provenLast: '2026-02-01',
    });
    expect(toFrontmatter(out)).toEqual({
      title: 'Chili',
      activeMinutes: 20,
      totalMinutes: 180,
      serves: 8,
      provenance: 'Steve’s card, 2014',
      proven: { count: 3, last: '2026-02-01' },
      ingredients: [{ heading: null, items: ['salt'] }],
    });
    expect(toFrontmatter(recipeFormSchema.parse(base))).toEqual({
      title: 'Chili',
      ingredients: [{ heading: null, items: ['salt'] }],
    });
  });

  it('turns facets and flags into namespaced tags, keeping free tags the document already had', () => {
    const out = recipeFormSchema.parse({
      ...base,
      facets: { ...base.facets, main: 'beef', course: 'main' },
      flags: ['kid-approved'],
    });
    expect(toTags(out)).toEqual(['course:main', 'main:beef', 'flag:kid-approved']);
    expect(toTags(out, ['camping', 'course:side', 'flag:vegetarian'])).toEqual([
      'course:main',
      'main:beef',
      'flag:kid-approved',
      'camping',
    ]);
  });

  it('prefills from a version and the document tags, and spots an unchanged set', () => {
    const input = fromVersion(
      {
        title: 'Chili',
        totalMinutes: 180,
        proven: { count: 2 },
        ingredients: [{ heading: 'Meats', items: ['2 lb beef'] }],
      },
      '# Chili',
      ['course:main', 'flag:vegetarian', 'camping'],
    );
    expect(input).toMatchObject({
      title: 'Chili',
      totalMinutes: '180',
      activeMinutes: '',
      provenCount: '2',
      provenLast: '',
      facets: { course: 'main', main: '' },
      flags: ['vegetarian'],
      ingredientsText: 'Meats:\n2 lb beef',
      body: '# Chili',
    });
    expect(sameTags(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameTags(['a'], ['a', 'b'])).toBe(false);
  });
});
