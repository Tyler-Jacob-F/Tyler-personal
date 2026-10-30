import type { AgentToken, DiffResponse, DocumentWithVersion, Version } from '@the-keep/shared';

export const ids = {
  doc: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
  owner: '1b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
  v1: '2b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
  v2: '3b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
};

export const chili = {
  title: 'Chili',
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 180,
  ingredients: [
    { heading: 'Meats', items: ['2 lb ground chuck'] },
    { heading: null, items: ['1 onion, diced'] },
  ],
};
export const chili2 = {
  ...chili,
  ingredients: [
    { heading: 'Meats', items: ['2 lb ground chuck'] },
    { heading: null, items: ['1 onion, diced', '1 tsp smoked paprika'] },
  ],
};

const author = { kind: 'member' as const, id: ids.owner, name: 'Tyler' };

export const version1: Version = {
  id: ids.v1,
  documentId: ids.doc,
  number: 1,
  body: '# Chili\n\nBrown the beef.\n',
  frontmatter: chili,
  author,
  createdAt: '2026-10-26T12:00:00.000Z',
  authoredAt: null,
  summary: '',
};

export const version2: Version = {
  ...version1,
  id: ids.v2,
  number: 2,
  body: '# Chili\n\nBrown the beef.\nStir in smoked paprika.\n',
  frontmatter: chili2,
  createdAt: '2026-10-26T13:00:00.000Z',
  authoredAt: '2025-01-31T00:00:00.000Z',
  summary: 'added smoked paprika',
};

export function recipeDoc(version: Version = version1): DocumentWithVersion {
  return {
    document: {
      id: ids.doc,
      type: 'recipe',
      slug: 'chili',
      ring: 'me',
      owner: ids.owner,
      createdAt: '2026-10-26T12:00:00.000Z',
      currentVersionId: version.id,
      tags: [],
      deletedAt: null,
    },
    version,
  };
}

export const diff12: DiffResponse = {
  from: { number: 1, summary: '', author, createdAt: version1.createdAt, authoredAt: null },
  to: {
    number: 2,
    summary: 'added smoked paprika',
    author,
    createdAt: version2.createdAt,
    authoredAt: version2.authoredAt,
  },
  body: [
    'Index: chili.md',
    '===================================================================',
    '--- chili.md\tv1',
    '+++ chili.md\tv2',
    '@@ -1,3 +1,4 @@',
    ' # Chili',
    ' ',
    ' Brown the beef.',
    '+Stir in smoked paprika.',
    '',
  ].join('\n'),
  frontmatter: [],
  ingredients: [
    { heading: 'Meats', change: 'same', lines: [{ kind: 'same', text: '2 lb ground chuck' }] },
    {
      heading: null,
      change: 'changed',
      lines: [
        { kind: 'same', text: '1 onion, diced' },
        { kind: 'added', text: '1 tsp smoked paprika' },
      ],
    },
  ],
};

export const tokens: Record<'importer' | 'cowork', AgentToken> = {
  importer: {
    id: '4b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
    name: 'importer',
    scopes: ['read:documents', 'write:recipes'],
    createdAt: '2026-10-30T12:00:00.000Z',
    lastUsedAt: '2026-10-30T13:30:00.000Z',
    revokedAt: null,
  },
  cowork: {
    id: '5b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
    name: 'cowork',
    scopes: ['read:documents', 'write:recipes', 'write:notes'],
    createdAt: '2026-10-29T12:00:00.000Z',
    lastUsedAt: null,
    revokedAt: '2026-10-30T09:00:00.000Z',
  },
};

export const briefFrontmatter = {
  title: 'Brief for 2026-10-30',
  date: '2026-10-30',
  sections: [
    { heading: 'Today', body: '- 9:00 standup\n- 14:00 dentist' },
    { heading: 'Waiting on you', body: 'Two emails from the small group.' },
  ],
};

export function briefDoc(
  date = '2026-10-30',
  id = '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
): DocumentWithVersion {
  const version: Version = {
    id: `7${id.slice(1)}`,
    documentId: id,
    number: 1,
    body: 'A quiet Thursday.',
    frontmatter: { ...briefFrontmatter, date, title: `Brief for ${date}` },
    author: { kind: 'agent', id: '8b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b', name: 'brief-writer' },
    createdAt: `${date}T10:10:00.000Z`,
    authoredAt: null,
    summary: 'morning brief',
  };
  return {
    document: {
      id,
      type: 'brief',
      slug: `brief-for-${date}`,
      ring: 'me',
      owner: ids.owner,
      createdAt: version.createdAt,
      currentVersionId: version.id,
      tags: [],
      deletedAt: null,
    },
    version,
  };
}
