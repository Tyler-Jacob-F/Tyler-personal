import {
  agentScopes,
  agentScopeSchema,
  agentTokenNameSchema,
  agentTokenSecretSchema,
  briefFrontmatterSchema,
  callerSchema,
  createAgentTokenRequestSchema,
  updateAgentTokenRequestSchema,
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
  recipeFacetNames,
  recipeFacets,
  recipeFlags,
  recipeTagsSchema,
  recipeTagsOf,
  recipeTaxonomyGuide,
  parseRecipeTag,
  parseTags,
  facetTag,
  flagTag,
  tagLabel,
  valueLabel,
  setTagsRequestSchema,
  agentActivityItemSchema,
  versionSchema,
  groupLinkTokenSchema,
  deviceTokenSchema,
  createMemberRequestSchema,
  updateMemberRequestSchema,
  makeColeadRequestSchema,
  memberRoles,
  questionsFrontmatterSchema,
  currentQuestions,
  signupFrontmatterSchema,
  signupOpen,
  eventFrontmatterSchema,
} from '../src/index.js';

const ids = { id: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b' };

const chili = {
  title: 'Chili',
  serves: 8,
  activeMinutes: 20,
  totalMinutes: 180,
  provenance: 'Steve\u2019s card, 2014',
  proven: { count: 3, last: '2026-02-01' },
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

  it('rejects a recipe without ingredients or a title, and a zero serves count', () => {
    expect(recipeFrontmatterSchema.safeParse({ ...chili, ingredients: [] }).success).toBe(false);
    expect(
      recipeFrontmatterSchema.safeParse({ ...chili, ingredients: [{ heading: 'x', items: [] }] })
        .success,
    ).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...chili, serves: 0 }).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...chili, title: '' }).success).toBe(false);
  });

  it('lets serves and the minutes be absent: recipes say "simmer 2–3 hr", not "total: 180"', () => {
    const parsed = recipeFrontmatterSchema.parse({
      title: 'Chili',
      ingredients: chili.ingredients,
    });
    expect(parsed.serves).toBeUndefined();
    expect(parsed.totalMinutes).toBeUndefined();
    expect(parsed.proven).toBeUndefined();
    expect(parsed.provenance).toBeUndefined();
  });

  it('no longer knows the Phase 1 names: servings, prepMinutes and cookMinutes are dropped on parse', () => {
    const parsed = recipeFrontmatterSchema.parse({
      title: 'Chili',
      ingredients: chili.ingredients,
      servings: 8,
      prepMinutes: 20,
      cookMinutes: 180,
    });
    expect(parsed).toEqual({ title: 'Chili', ingredients: chili.ingredients });
  });

  it('keeps active minutes within total minutes', () => {
    expect(
      recipeFrontmatterSchema.safeParse({ ...chili, activeMinutes: 200, totalMinutes: 180 })
        .success,
    ).toBe(false);
    expect(
      recipeFrontmatterSchema.safeParse({ ...chili, totalMinutes: undefined, activeMinutes: 200 })
        .success,
    ).toBe(true);
  });

  it('reads proven as a cook count with a last date, lifting a bare true and dropping false', () => {
    expect(recipeFrontmatterSchema.parse({ ...chili, proven: true }).proven).toEqual({ count: 1 });
    expect(recipeFrontmatterSchema.parse({ ...chili, proven: false }).proven).toBeUndefined();
    expect(recipeFrontmatterSchema.parse({ ...chili, proven: null }).proven).toBeUndefined();
    expect(recipeFrontmatterSchema.safeParse({ ...chili, proven: { count: 0 } }).success).toBe(
      false,
    );
    expect(
      recipeFrontmatterSchema.safeParse({ ...chili, proven: { count: 2, last: 'last winter' } })
        .success,
    ).toBe(false);
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

  it('rejects fractional minutes and non-integer serves', () => {
    expect(recipeFrontmatterSchema.safeParse({ ...chili, activeMinutes: 1.5 }).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...chili, serves: '8' }).success).toBe(false);
  });
});

describe('recipe taxonomy', () => {
  it('names the facets and flags of the contract', () => {
    expect(recipeFacetNames).toEqual([
      'course',
      'main',
      'effort',
      'technique',
      'season',
      'occasion',
    ]);
    expect(recipeFacets.course).toHaveLength(9);
    expect(recipeFacets.main).toHaveLength(11);
    expect(recipeFacets.main).toContain('turkey');
    expect(recipeTagsSchema.parse(['main:turkey'])).toEqual(['main:turkey']);
    expect(recipeFacets.technique).toContain('ferment-preserve');
    expect([...recipeFlags]).toEqual(['kid-approved', 'vegetarian', 'gluten-free']);
    expect(valueLabel('soup-stew')).toBe('Soup & stew');
    expect(valueLabel('slow-cooker')).toBe('Slow cooker');
    expect(valueLabel('any')).toBe('Any');
    expect(tagLabel('course:main')).toBe('Main');
    expect(tagLabel('flag:gluten-free')).toBe('Gluten-free');
    expect(tagLabel('camping')).toBe('camping');
  });

  it('accepts facets, flags and free tags, collapsing duplicates into the contract order', () => {
    expect(
      recipeTagsSchema.parse([
        'camping',
        'flag:vegetarian',
        'course:breakfast',
        'main:eggs',
        'course:breakfast',
        'effort:weeknight',
      ]),
    ).toEqual(['course:breakfast', 'main:eggs', 'effort:weeknight', 'flag:vegetarian', 'camping']);
    expect(parseTags('recipe', [])).toEqual([]);
    expect(parseTags('brief', ['anything:goes'])).toEqual(['anything:goes']);
  });

  it('refuses an unknown facet value, an unknown namespace, and two values for one facet', () => {
    const bad = recipeTagsSchema.safeParse(['course:brunch']);
    expect(bad.success).toBe(false);
    expect(bad.error!.issues[0]!.message).toMatch(/not a value of course; one of breakfast/);
    const unknown = recipeTagsSchema.safeParse(['cuisine:thai']);
    expect(unknown.success).toBe(false);
    expect(unknown.error!.issues[0]!.message).toMatch(/unknown namespace/);
    const two = recipeTagsSchema.safeParse(['course:main', 'course:side']);
    expect(two.success).toBe(false);
    expect(two.error!.issues[0]!.message).toMatch(/one value per facet/);
    expect(recipeTagsSchema.safeParse(['flag:proven']).success).toBe(false);
  });

  it('reads a document’s tags back by facet, for screens', () => {
    expect(
      recipeTagsOf(['course:main', 'main:beef', 'flag:kid-approved', 'camping', 'bogus:x']),
    ).toEqual({
      facets: { course: 'main', main: 'beef' },
      flags: ['kid-approved'],
      free: ['camping'],
    });
    expect(parseRecipeTag('season:winter')).toEqual({
      kind: 'facet',
      facet: 'season',
      value: 'winter',
    });
    expect(facetTag('course', 'main')).toBe('course:main');
    expect(flagTag('vegetarian')).toBe('flag:vegetarian');
  });

  it('is in the recipe guide the tools show a model', () => {
    expect(schemaFor('recipe').guide).toContain('course:');
    expect(schemaFor('recipe').guide).toContain('activeMinutes');
    expect(schemaFor('recipe').guide).toContain('proven');
    expect(schemaFor('recipe').guide).not.toContain('servings');
    expect(recipeTaxonomyGuide()).toContain('flag:<name>');
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

  it('takes a full tag set on set_tags and knows both activity row kinds', () => {
    expect(setTagsRequestSchema.parse({ tags: ['course:main'] })).toEqual({
      tags: ['course:main'],
    });
    expect(setTagsRequestSchema.safeParse({}).success).toBe(false);
    const base = {
      documentId: ids.id,
      documentType: 'recipe',
      slug: 'chili',
      title: 'Chili',
      token: { id: ids.id, name: 'claude' },
      createdAt: '2026-10-30T12:00:00.000Z',
    };
    expect(
      agentActivityItemSchema.safeParse({
        ...base,
        kind: 'tagged',
        changeId: ids.id,
        tags: ['course:main'],
        previousTags: [],
      }).success,
    ).toBe(true);
    expect(
      agentActivityItemSchema.safeParse({
        ...base,
        kind: 'version',
        versionId: ids.id,
        number: 2,
        summary: '',
        authoredAt: null,
      }).success,
    ).toBe(true);
    expect(agentActivityItemSchema.safeParse({ ...base, kind: 'renamed' }).success).toBe(false);
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
  it('knows exactly the brief’s five scopes plus the Group phase’s two', () => {
    expect([...agentScopes]).toEqual([
      'read:documents',
      'write:recipes',
      'write:briefs',
      'write:notes',
      'read:reading',
      'write:events',
      'write:questions',
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

  it('edits take the same scope set rules as creation', () => {
    expect(
      updateAgentTokenRequestSchema.parse({ scopes: ['write:notes', 'read:documents'] }),
    ).toEqual({
      scopes: ['read:documents', 'write:notes'],
    });
    expect(updateAgentTokenRequestSchema.safeParse({ scopes: [] }).success).toBe(false);
    expect(
      updateAgentTokenRequestSchema.safeParse({ name: 'x', scopes: ['read:documents'] }).data,
    ).toEqual({
      scopes: ['read:documents'],
    });
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

describe('members, the link and devices', () => {
  it('shapes the link token as 43 bare base64url characters and the device token with its prefix', () => {
    const token = 'A'.repeat(43);
    expect(groupLinkTokenSchema.safeParse(token).success).toBe(true);
    expect(groupLinkTokenSchema.safeParse(`keep_${token}`).success).toBe(false);
    expect(deviceTokenSchema.safeParse(`keepd_${token}`).success).toBe(true);
    expect(deviceTokenSchema.safeParse(`keep_${token}`).success).toBe(false);
    expect(deviceTokenSchema.safeParse(token).success).toBe(false);
  });

  it('asks a new member for a name and nothing else, and lowercases a co-lead email', () => {
    expect(createMemberRequestSchema.parse({ displayName: ' Oscar ' })).toEqual({
      displayName: 'Oscar',
    });
    expect(createMemberRequestSchema.safeParse({ displayName: '' }).success).toBe(false);
    expect(updateMemberRequestSchema.parse({ phone: null, notes: '  ' })).toEqual({
      phone: null,
      notes: '',
    });
    expect(makeColeadRequestSchema.parse({ email: ' Kelly@Example.com ' })).toEqual({
      email: 'kelly@example.com',
    });
  });

  it('admits the colead role on a member caller', () => {
    expect(callerSchema.safeParse({ kind: 'member', id: ids.id, role: 'colead' }).success).toBe(
      true,
    );
    expect(memberRoles).toEqual(['admin', 'colead', 'group']);
  });
});

describe('the group’s types', () => {
  it('questions: weekOf is a date, the title defaults, and "this week" is the newest within six days ahead', () => {
    const q = questionsFrontmatterSchema.parse({ weekOf: '2026-11-05' });
    expect(q.title).toBe('Questions for 2026-11-05');
    expect(questionsFrontmatterSchema.safeParse({ weekOf: 'Thursday' }).success).toBe(false);
    const weeks = [{ weekOf: '2026-10-29' }, { weekOf: '2026-11-05' }, { weekOf: '2026-11-12' }];
    expect(currentQuestions(weeks, '2026-10-31')?.weekOf).toBe('2026-11-05');
    expect(currentQuestions(weeks, '2026-11-05')?.weekOf).toBe('2026-11-05');
    expect(currentQuestions(weeks, '2026-11-06')?.weekOf).toBe('2026-11-12');
    expect(currentQuestions(weeks.slice(0, 1), '2026-11-20')?.weekOf).toBe('2026-10-29');
    expect(currentQuestions(weeks.slice(2), '2026-10-31')).toBeNull();
    expect(currentQuestions([], '2026-10-31')).toBeNull();
  });

  it('signup: slots with distinct labels and a capacity, an optional close, and knows when it is open', () => {
    const sheet = {
      title: 'Thursday, Nov 5',
      date: '2026-11-05',
      slots: [
        { label: 'Dinner', capacity: 1 },
        { label: 'Dessert', capacity: 2 },
      ],
      closesAt: '2026-11-05T17:00:00.000Z',
    };
    expect(signupFrontmatterSchema.parse(sheet)).toEqual(sheet);
    expect(
      signupFrontmatterSchema.safeParse({
        ...sheet,
        slots: [...sheet.slots, { label: 'dinner', capacity: 1 }],
      }).success,
    ).toBe(false);
    expect(signupFrontmatterSchema.safeParse({ ...sheet, slots: [] }).success).toBe(false);
    expect(
      signupFrontmatterSchema.safeParse({ ...sheet, slots: [{ label: 'Dinner', capacity: 0 }] })
        .success,
    ).toBe(false);
    expect(signupOpen(sheet, new Date('2026-11-05T16:59:00Z'))).toBe(true);
    expect(signupOpen(sheet, new Date('2026-11-05T17:00:00Z'))).toBe(false);
    expect(signupOpen({ ...sheet, closesAt: undefined }, new Date('2030-01-01T00:00:00Z'))).toBe(
      true,
    );
  });

  it('event: a date, an HH:MM time, a place and a line of notes', () => {
    const meeting = { title: 'Small group', date: '2026-11-05', time: '18:30', place: 'Tyler’s' };
    expect(eventFrontmatterSchema.parse(meeting)).toEqual(meeting);
    expect(eventFrontmatterSchema.safeParse({ ...meeting, time: '6:30 pm' }).success).toBe(false);
    expect(eventFrontmatterSchema.safeParse({ ...meeting, time: '24:00' }).success).toBe(false);
    expect(
      eventFrontmatterSchema.parse({ title: 'Retreat', date: '2026-11-07' }).time,
    ).toBeUndefined();
  });

  it('registers the three in the group ring with guides, and scopes events and questions but never signups', () => {
    expect(documentTypes).toEqual(['recipe', 'brief', 'questions', 'signup', 'event']);
    for (const type of ['questions', 'signup', 'event'] as const) {
      expect(schemaFor(type).defaultRing).toBe('group');
      expect(schemaFor(type).guide).toMatch(new RegExp(`^${type}:`));
    }
    expect(typeGuides()).toContain('renaming a slot');
    expect(agentScopes).toContain('write:events');
    expect(agentScopes).toContain('write:questions');
    expect(agentScopes).not.toContain('write:signups');
    expect(writeScopeFor('event')).toBe('write:events');
    expect(writeScopeFor('questions')).toBe('write:questions');
    expect(writeScopeFor('signup')).toBeNull();
    expect(parseFrontmatter('event', { title: 'x', date: '2026-11-05' })).toEqual({
      title: 'x',
      date: '2026-11-05',
    });
  });
});
