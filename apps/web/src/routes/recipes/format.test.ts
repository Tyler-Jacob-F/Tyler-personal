import {
  splitHeadnote,
  splitIngredient,
  versionLine,
  shortDay,
  minutes,
  withoutMethodHeading,
} from '@/routes/recipes/format';
describe('format', () => {
  it('splits amounts from ingredient lines as the render shows them, leaving odd lines whole', () => {
    expect(splitIngredient('1½ lb boneless, skinless chicken thighs')).toEqual({
      amount: '1½ lb',
      item: 'boneless, skinless chicken thighs',
    });
    expect(splitIngredient('8 cloves garlic, sliced thin')).toEqual({
      amount: '8 cloves',
      item: 'garlic, sliced thin',
    });
    expect(splitIngredient('¾ cup heavy cream')).toEqual({ amount: '¾ cup', item: 'heavy cream' });
    expect(splitIngredient('½ lemon, juiced')).toEqual({ amount: '½', item: 'lemon, juiced' });
    expect(splitIngredient('a handful parsley, chopped')).toEqual({
      amount: 'a handful',
      item: 'parsley, chopped',
    });
    expect(splitIngredient('2 × 14.5 oz cans fire-roasted crushed tomatoes')).toEqual({
      amount: '2 × 14.5 oz cans',
      item: 'fire-roasted crushed tomatoes',
    });
    expect(splitIngredient('2½–3 tsp kosher salt, divided')).toEqual({
      amount: '2½–3 tsp',
      item: 'kosher salt, divided',
    });
    expect(splitIngredient('1 (32 oz) carton beef broth')).toEqual({
      amount: '1 (32 oz)',
      item: 'carton beef broth',
    });
    expect(splitIngredient('rice or crusty bread, to serve')).toEqual({
      amount: '',
      item: 'rice or crusty bread, to serve',
    });
    expect(splitIngredient('Shredded cheddar cheese')).toEqual({
      amount: '',
      item: 'Shredded cheddar cheese',
    });
    expect(splitIngredient('5–6 garlic cloves, minced')).toEqual({
      amount: '5–6',
      item: 'garlic cloves, minced',
    });
  });
  it('takes the paragraphs before the first heading as the headnote', () => {
    expect(splitHeadnote('A note.\n\nMore.\n\n## Method\n\n1. Go.')).toEqual({
      headnote: 'A note.\n\nMore.',
      method: '## Method\n\n1. Go.',
    });
    expect(splitHeadnote('## Method\n\n1. Go.')).toEqual({
      headnote: '',
      method: '## Method\n\n1. Go.',
    });
    expect(splitHeadnote('1. Go.')).toEqual({ headnote: '', method: '1. Go.' });
    expect(withoutMethodHeading('## Method\n\n1. Go.')).toBe('1. Go.');
    expect(withoutMethodHeading('## Serve\n\nHot.')).toBe('## Serve\n\nHot.');
  });
  it('writes the version line and short dates', () => {
    expect(
      versionLine({
        number: 4,
        author: { name: 'Tyler' },
        createdAt: '2026-10-26T13:00:00.000Z',
        authoredAt: '2025-11-02T00:00:00.000Z',
      }),
    ).toBe('v4 · Tyler · written Nov 2025 · entered Oct 2026');
    expect(
      versionLine({
        number: 1,
        author: { name: 'claude' },
        createdAt: '2026-10-26T13:00:00.000Z',
        authoredAt: null,
      }),
    ).toBe('v1 · claude · entered Oct 2026');
    expect(shortDay('2026-10-14', new Date('2026-10-30'))).toBe('14 Oct');
    expect(shortDay('2025-10-14', new Date('2026-10-30'))).toBe('14 Oct 2025');
    expect(minutes(25)).toBe('25 min');
    expect(minutes(240)).toBe('4 h');
    expect(minutes(150)).toBe('2 h 30 min');
  });
});
