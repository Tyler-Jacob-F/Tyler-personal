import {
  formatIngredientGroups,
  parseIngredientGroups,
  recipeFormSchema,
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

describe('recipeFormSchema', () => {
  it('treats blank numbers and a blank date as absent', () => {
    const out = recipeFormSchema.parse({
      title: 'Chili',
      servings: '',
      prepMinutes: ' ',
      cookMinutes: '180',
      ingredientsText: 'salt',
      body: '',
      summary: '',
      authoredAt: '',
    });
    expect(out.servings).toBeUndefined();
    expect(out.prepMinutes).toBeUndefined();
    expect(out.cookMinutes).toBe(180);
    expect(out.authoredAt).toBeNull();
  });

  it('rejects a malformed date and a fractional count', () => {
    const base = {
      title: 'x',
      servings: '',
      prepMinutes: '',
      cookMinutes: '',
      ingredientsText: 'salt',
      body: '',
      summary: '',
    };
    expect(recipeFormSchema.safeParse({ ...base, authoredAt: 'last winter' }).success).toBe(false);
    expect(recipeFormSchema.safeParse({ ...base, authoredAt: '2023-11-06' }).success).toBe(true);
    expect(recipeFormSchema.safeParse({ ...base, authoredAt: '', servings: '1.5' }).success).toBe(
      false,
    );
  });
});
