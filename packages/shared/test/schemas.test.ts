import {
  createDocumentRequestSchema,
  ingredientLines,
  diffQuerySchema,
  documentSchema,
  isDocumentType,
  parseFrontmatter,
  recipeFrontmatterSchema,
  schemaFor,
  slugify,
  versionSchema,
} from '../src/index.js';

const chili = {
  title: 'Chili',
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 180,
  ingredients: [
    { heading: 'Meats', items: ['2 lb ground chuck'] },
    { heading: null, items: ['1 onion, diced', '2 tbsp chili powder'] },
  ],
};

describe('recipe frontmatter', () => {
  it('accepts a complete recipe and trims strings', () => {
    const parsed = recipeFrontmatterSchema.parse({ ...chili, title: '  Chili ' });
    expect(parsed.title).toBe('Chili');
    expect(parsed.ingredients).toHaveLength(2);
  });

  it('rejects a recipe without ingredients or a title, and a zero serving count', () => {
    expect(recipeFrontmatterSchema.safeParse({ ...chili, ingredients: [] }).success).toBe(false);
    expect(
      recipeFrontmatterSchema.safeParse({ ...chili, ingredients: [{ heading: 'x', items: [] }] })
        .success,
    ).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...chili, servings: 0 }).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...chili, title: '' }).success).toBe(false);
  });

  it('lets servings and times be absent: recipes say "simmer 2–3 hr", not "cook: 180"', () => {
    const parsed = recipeFrontmatterSchema.parse({
      title: 'Chili',
      ingredients: chili.ingredients,
    });
    expect(parsed.servings).toBeUndefined();
    expect(parsed.cookMinutes).toBeUndefined();
  });

  it('lifts the flat ingredient list older versions stored into one unnamed group', () => {
    const parsed = recipeFrontmatterSchema.parse({
      ...chili,
      ingredients: ['2 lb beef', '1 onion'],
    });
    expect(parsed.ingredients).toEqual([{ heading: null, items: ['2 lb beef', '1 onion'] }]);
    expect(ingredientLines(parsed.ingredients)).toEqual(['2 lb beef', '1 onion']);
  });

  it('defaults a missing heading to null', () => {
    const parsed = recipeFrontmatterSchema.parse({ ...chili, ingredients: [{ items: ['salt'] }] });
    expect(parsed.ingredients[0]!.heading).toBeNull();
  });

  it('rejects fractional minutes and non-integer servings', () => {
    expect(recipeFrontmatterSchema.safeParse({ ...chili, prepMinutes: 1.5 }).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...chili, servings: '8' }).success).toBe(false);
  });
});

describe('registry', () => {
  it('resolves recipe to its schema and default ring', () => {
    expect(schemaFor('recipe').defaultRing).toBe('me');
    expect(schemaFor('recipe').schema).toBe(recipeFrontmatterSchema);
    expect(isDocumentType('recipe')).toBe(true);
  });

  it('throws on an unknown type', () => {
    expect(() => schemaFor('essay')).toThrow();
    expect(isDocumentType('essay')).toBe(false);
  });

  it('parses frontmatter for a type', () => {
    expect(parseFrontmatter('recipe', chili)).toEqual(chili);
    expect(() => parseFrontmatter('recipe', { title: 'x' })).toThrow();
  });
});

describe('document envelope', () => {
  const doc = {
    id: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
    type: 'recipe',
    slug: 'chili',
    ring: 'me',
    owner: '1b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
    createdAt: '2026-10-26T12:00:00.000Z',
    currentVersionId: null,
    tags: [],
    deletedAt: null,
  };

  it('accepts a fresh document', () => {
    expect(documentSchema.parse(doc)).toEqual(doc);
  });

  it('rejects an unknown ring and a non-kebab slug', () => {
    expect(documentSchema.safeParse({ ...doc, ring: 'everyone' }).success).toBe(false);
    expect(documentSchema.safeParse({ ...doc, slug: 'Chili Con Carne' }).success).toBe(false);
  });

  it('requires an author on every version', () => {
    const version = {
      id: doc.id,
      documentId: doc.id,
      number: 1,
      body: '# Chili',
      frontmatter: chili,
      author: { kind: 'member', id: doc.owner, name: 'Tyler' },
      createdAt: doc.createdAt,
      authoredAt: null,
      summary: '',
    };
    expect(versionSchema.parse(version)).toEqual(version);
    expect(versionSchema.safeParse({ ...version, author: undefined }).success).toBe(false);
    expect(versionSchema.safeParse({ ...version, number: 0 }).success).toBe(false);
  });
});

describe('API DTOs', () => {
  it('defaults summary and tags on create', () => {
    const parsed = createDocumentRequestSchema.parse({
      type: 'recipe',
      frontmatter: chili,
      body: '',
    });
    expect(parsed.summary).toBe('');
    expect(parsed.tags).toEqual([]);
  });

  it('accepts authoredAt as a date or a timestamp, or not at all', () => {
    const base = { type: 'recipe', frontmatter: chili, body: '' };
    expect(createDocumentRequestSchema.parse(base).authoredAt).toBeUndefined();
    expect(
      createDocumentRequestSchema.parse({ ...base, authoredAt: '2023-11-06' }).authoredAt,
    ).toBe('2023-11-06T00:00:00.000Z');
    expect(
      createDocumentRequestSchema.parse({ ...base, authoredAt: '2025-01-31T22:12:15.000Z' })
        .authoredAt,
    ).toBe('2025-01-31T22:12:15.000Z');
    expect(
      createDocumentRequestSchema.safeParse({ ...base, authoredAt: 'last winter' }).success,
    ).toBe(false);
  });

  it('coerces diff query numbers from strings', () => {
    expect(diffQuerySchema.parse({ from: '1', to: '2' })).toEqual({ from: 1, to: 2 });
    expect(diffQuerySchema.safeParse({ from: '0', to: '2' }).success).toBe(false);
  });
});

describe('slugify', () => {
  it('kebab-cases a title', () => {
    expect(slugify('Chili')).toBe('chili');
    expect(slugify("Grandma's Chili (Texas style)!")).toBe('grandma-s-chili-texas-style');
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
  });

  it('never returns an empty slug', () => {
    expect(slugify('***')).toBe('untitled');
  });
});
