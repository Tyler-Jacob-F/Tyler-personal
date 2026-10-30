import {
  agentScopes,
  agentScopeSchema,
  agentTokenNameSchema,
  agentTokenSecretSchema,
  briefFrontmatterSchema,
  callerSchema,
  createAgentTokenRequestSchema,
  createDocumentRequestSchema,
  documentTypes,
  writeScopeByType,
  writeScopeFor,
  createVersionRequestSchema,
  ingredientLines,
  diffQuerySchema,
  documentSchema,
  isDocumentType,
  parseFrontmatter,
  recipeFrontmatterSchema,
  schemaFor,
  slugify,
  typeGuides,
  versionSchema,
} from '../src/index.js';

const ids = { id: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b' };

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

describe('brief frontmatter', () => {
  const brief = {
    date: '2026-10-30',
    sections: [
      { heading: 'Today', body: '- 9:00 standup\n- 14:00 dentist' },
      { heading: 'Waiting on you', body: 'Two emails from the small group.' },
    ],
  };

  it('accepts a dated brief with sections and titles it from the date', () => {
    const parsed = briefFrontmatterSchema.parse(brief);
    expect(parsed.title).toBe('Brief for 2026-10-30');
    expect(parsed.sections).toHaveLength(2);
    expect(briefFrontmatterSchema.parse({ ...brief, title: 'Thursday' }).title).toBe('Thursday');
  });

  it('insists on a calendar date and at least one section with a heading', () => {
    expect(briefFrontmatterSchema.safeParse({ ...brief, date: 'today' }).success).toBe(false);
    expect(
      briefFrontmatterSchema.safeParse({ ...brief, date: '2026-10-30T06:00:00Z' }).success,
    ).toBe(false);
    expect(briefFrontmatterSchema.safeParse({ ...brief, sections: [] }).success).toBe(false);
    expect(
      briefFrontmatterSchema.safeParse({ ...brief, sections: [{ heading: ' ', body: 'x' }] })
        .success,
    ).toBe(false);
  });

  it('is registered with the me ring, the write:briefs scope and a guide', () => {
    expect(schemaFor('brief').defaultRing).toBe('me');
    expect(writeScopeFor('brief')).toBe('write:briefs');
    expect(typeGuides()).toMatch(/brief: frontmatter/);
    expect(parseFrontmatter('brief', brief).title).toBe('Brief for 2026-10-30');
  });
});

describe('registry', () => {
  it('resolves recipe to its schema, default ring and a guide for the model', () => {
    expect(schemaFor('recipe').defaultRing).toBe('me');
    expect(schemaFor('recipe').schema).toBe(recipeFrontmatterSchema);
    expect(schemaFor('recipe').guide).toMatch(/^recipe: /);
    expect(typeGuides()).toContain('ingredients');
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

  it('caps the summary on write but reads any stored length back', () => {
    const long = 'x'.repeat(501);
    expect(
      createVersionRequestSchema.safeParse({ frontmatter: chili, body: '', summary: long }).success,
    ).toBe(false);
    expect(
      createVersionRequestSchema.parse({ frontmatter: chili, body: '', summary: 'x'.repeat(500) })
        .summary,
    ).toHaveLength(500);
    expect(versionSchema.shape.summary.safeParse('y'.repeat(2000)).success).toBe(true);
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

describe('agent scopes and tokens', () => {
  it('knows exactly the five scopes the brief lists', () => {
    expect([...agentScopes]).toEqual([
      'read:documents',
      'write:recipes',
      'write:briefs',
      'write:notes',
      'read:reading',
    ]);
    expect(agentScopeSchema.safeParse('write:documents').success).toBe(false);
  });

  it('maps a write on a type to its scope, for every type the registry knows', () => {
    expect(writeScopeFor('recipe')).toBe('write:recipes');
    for (const type of documentTypes) expect(type in writeScopeByType).toBe(true);
  });

  it('recognizes a secret by its shape', () => {
    const secret = `keep_${'A'.repeat(43)}`;
    expect(agentTokenSecretSchema.parse(secret)).toBe(secret);
    expect(agentTokenSecretSchema.safeParse(`keep_${'A'.repeat(42)}`).success).toBe(false);
    expect(agentTokenSecretSchema.safeParse(`kept_${'A'.repeat(43)}`).success).toBe(false);
    expect(agentTokenSecretSchema.safeParse(`keep_${'A'.repeat(42)}+`).success).toBe(false);
  });

  it('collapses duplicate scopes into the brief order and insists on at least one', () => {
    const parsed = createAgentTokenRequestSchema.parse({
      name: 'cowork',
      scopes: ['write:notes', 'read:documents', 'write:notes', 'write:recipes'],
    });
    expect(parsed.scopes).toEqual(['read:documents', 'write:recipes', 'write:notes']);
    expect(createAgentTokenRequestSchema.safeParse({ name: 'x', scopes: [] }).success).toBe(false);
    expect(
      createAgentTokenRequestSchema.safeParse({ name: 'x', scopes: ['write:documents'] }).success,
    ).toBe(false);
  });

  it('keeps token names short, lowercase and hyphenated', () => {
    for (const name of ['importer', 'brief-writer', 'cowork2']) {
      expect(agentTokenNameSchema.parse(name)).toBe(name);
    }
    for (const name of ['Importer', 'brief writer', '-x', 'x-', 'a--b', '', 'x'.repeat(41)]) {
      expect(agentTokenNameSchema.safeParse(name).success, name).toBe(false);
    }
  });

  it('holds an agent caller to known scopes', () => {
    expect(
      callerSchema.safeParse({ kind: 'agent', id: ids.id, scopes: ['write:documents'] }).success,
    ).toBe(false);
    expect(
      callerSchema.safeParse({ kind: 'agent', id: ids.id, scopes: ['write:recipes'] }).success,
    ).toBe(true);
  });
});
