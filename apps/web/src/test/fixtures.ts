import type { DiffResponse, DocumentWithVersion, Version } from '@the-keep/shared';

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
  ingredients: ['2 lb ground chuck', '1 onion, diced'],
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
  summary: '',
};

export const version2: Version = {
  ...version1,
  id: ids.v2,
  number: 2,
  body: '# Chili\n\nBrown the beef.\nStir in smoked paprika.\n',
  frontmatter: { ...chili, ingredients: [...chili.ingredients, '1 tsp smoked paprika'] },
  createdAt: '2026-10-26T13:00:00.000Z',
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
  from: { number: 1, summary: '', author, createdAt: version1.createdAt },
  to: { number: 2, summary: 'added smoked paprika', author, createdAt: version2.createdAt },
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
  frontmatter: [
    {
      key: 'ingredients',
      change: 'changed',
      from: chili.ingredients,
      to: [...chili.ingredients, '1 tsp smoked paprika'],
    },
  ],
};
