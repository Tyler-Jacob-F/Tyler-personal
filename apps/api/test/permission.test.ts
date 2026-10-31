import { type Caller, documentTypes } from '@the-keep/shared';
import {
  type Action,
  authorize,
  authorizeClaim,
  authorizeMember,
  can,
  canClaim,
  canKeepLink,
  canMember,
  isGroupType,
  type MemberAction,
  requireAdmin,
  requireLinkKeeper,
} from '../src/middleware/permission.js';
import { diffFrontmatter, diffIngredients } from '../src/lib/diff.js';

const ids = {
  admin: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e40',
  colead: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e41',
  group: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e42',
  kelly: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e43',
  oscar: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e44',
  device: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e45',
  token: '0b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e46',
};

/**
 * The four kinds of caller docs/phases/04-group.md decided, plus the legacy signed-in
 * `group` role and three agents, so every rule below is pinned against every caller.
 */
const callers = {
  admin: { kind: 'member', id: ids.admin, role: 'admin' },
  colead: { kind: 'member', id: ids.colead, role: 'colead' },
  groupRole: { kind: 'member', id: ids.group, role: 'group' },
  member: { kind: 'group', deviceId: ids.device, memberId: ids.kelly, role: 'member' },
  guest: { kind: 'group', deviceId: ids.device, memberId: null, role: 'guest' },
  reader: { kind: 'agent', id: ids.token, scopes: ['read:documents'] },
  recipeWriter: { kind: 'agent', id: ids.token, scopes: ['write:recipes'] },
  scopeless: { kind: 'agent', id: ids.token, scopes: [] },
} satisfies Record<string, Caller>;
type CallerName = keyof typeof callers;

const rings = ['me', 'group', 'public'] as const;
const actions: Action[] = ['read', 'write', 'delete'];

/**
 * The document table: caller × action × ring, for a type of Tyler's (`recipe`, which
 * starts in `me`). The Types deliverable adds the group's own types and the rows that
 * differ for them (a co-lead writes those in the `group` ring and nothing else).
 */
const recipeTable: Record<CallerName, Record<Action, Record<(typeof rings)[number], boolean>>> = {
  admin: {
    read: { me: true, group: true, public: true },
    write: { me: true, group: true, public: true },
    delete: { me: true, group: true, public: true },
  },
  colead: {
    read: { me: false, group: true, public: true },
    write: { me: false, group: false, public: false },
    delete: { me: false, group: false, public: false },
  },
  groupRole: {
    read: { me: false, group: true, public: true },
    write: { me: false, group: false, public: false },
    delete: { me: false, group: false, public: false },
  },
  member: {
    read: { me: false, group: true, public: true },
    write: { me: false, group: false, public: false },
    delete: { me: false, group: false, public: false },
  },
  guest: {
    read: { me: false, group: true, public: true },
    write: { me: false, group: false, public: false },
    delete: { me: false, group: false, public: false },
  },
  reader: {
    read: { me: true, group: true, public: true },
    write: { me: false, group: false, public: false },
    delete: { me: false, group: false, public: false },
  },
  recipeWriter: {
    read: { me: false, group: false, public: false },
    write: { me: true, group: true, public: true },
    delete: { me: false, group: false, public: false },
  },
  scopeless: {
    read: { me: false, group: false, public: false },
    write: { me: false, group: false, public: false },
    delete: { me: false, group: false, public: false },
  },
};

describe('permission: documents, every caller × action × ring', () => {
  for (const [name, caller] of Object.entries(callers) as Array<[CallerName, Caller]>) {
    it(`holds ${name} to the table for a recipe`, () => {
      for (const action of actions) {
        for (const ring of rings) {
          expect(can(caller, action, { ring, type: 'recipe' }), `${name} ${action} ${ring}`).toBe(
            recipeTable[name][action][ring],
          );
        }
      }
    });
  }

  it('matches a write scope to the document type, not to documents in general', () => {
    const briefs: Caller = { kind: 'agent', id: ids.token, scopes: ['write:briefs'] };
    expect(can(briefs, 'write', { ring: 'me', type: 'recipe' })).toBe(false);
    expect(can(briefs, 'write', { ring: 'me', type: 'brief' })).toBe(true);
  });

  it('knows which types are the group’s own', () => {
    const own = documentTypes.filter(isGroupType);
    expect(own).toEqual(['questions', 'signup', 'event']);
  });

  /**
   * The rows that differ for the group's own types: a co-lead writes and deletes them in
   * the `group` ring and nowhere else; an agent needs the type's scope, and a signup has
   * none; everyone else reads as for a recipe.
   */
  const groupTypes = ['questions', 'signup', 'event'] as const;
  const eventsWriter: Caller = { kind: 'agent', id: ids.token, scopes: ['write:events'] };
  const questionsWriter: Caller = { kind: 'agent', id: ids.token, scopes: ['write:questions'] };

  for (const type of groupTypes) {
    it(`holds every caller to the table for a ${type}`, () => {
      for (const [name, caller] of Object.entries(callers) as Array<[CallerName, Caller]>) {
        for (const action of actions) {
          for (const ring of rings) {
            let expected = recipeTable[name][action][ring];
            if (name === 'colead' && action !== 'read') expected = ring === 'group';
            if (name === 'recipeWriter' && action === 'write') expected = false;
            expect(can(caller, action, { ring, type }), `${name} ${action} ${type} ${ring}`).toBe(
              expected,
            );
          }
        }
      }
      for (const ring of rings) {
        expect(can(eventsWriter, 'write', { ring, type })).toBe(type === 'event');
        expect(can(questionsWriter, 'write', { ring, type })).toBe(type === 'questions');
        expect(can(eventsWriter, 'delete', { ring, type })).toBe(false);
      }
    });
  }

  it('authorize throws a 403 HttpError naming the type and ring', () => {
    expect(() => authorize(callers.groupRole, 'write', { ring: 'me', type: 'recipe' })).toThrow(
      /cannot write a recipe in the me ring/,
    );
    expect(() => authorize(callers.member, 'write', { ring: 'group', type: 'recipe' })).toThrow(
      /cannot write/,
    );
    expect(() => authorize(callers.reader, 'write', { ring: 'me', type: 'recipe' })).toThrow(
      /cannot write/,
    );
    expect(() => authorize(callers.admin, 'write', { ring: 'me', type: 'recipe' })).not.toThrow();
  });
});

describe('permission: claiming a slot', () => {
  const signup = { ring: 'group', type: 'signup' } as const;

  const table: Record<CallerName, { own: boolean; other: boolean }> = {
    admin: { own: true, other: true },
    colead: { own: true, other: true },
    groupRole: { own: false, other: false },
    member: { own: true, other: false },
    guest: { own: false, other: false },
    reader: { own: false, other: false },
    recipeWriter: { own: false, other: false },
    scopeless: { own: false, other: false },
  };

  for (const [name, caller] of Object.entries(callers) as Array<[CallerName, Caller]>) {
    it(`holds ${name} to the table`, () => {
      expect(canClaim(caller, signup, ids.kelly), `${name} for the device's member`).toBe(
        table[name].own,
      );
      expect(canClaim(caller, signup, ids.oscar), `${name} for another member`).toBe(
        table[name].other,
      );
    });
  }

  it('is only ever true on a signup in the group ring', () => {
    expect(canClaim(callers.admin, { ring: 'me', type: 'signup' }, ids.kelly)).toBe(false);
    expect(canClaim(callers.admin, { ring: 'public', type: 'signup' }, ids.kelly)).toBe(false);
    expect(canClaim(callers.admin, { ring: 'group', type: 'event' }, ids.kelly)).toBe(false);
    expect(canClaim(callers.admin, { ring: 'group', type: 'recipe' }, ids.kelly)).toBe(false);
    expect(() => authorizeClaim(callers.guest, signup, ids.kelly)).toThrow(/cannot claim/);
    expect(() => authorizeClaim(callers.member, signup, ids.kelly)).not.toThrow();
  });
});

describe('permission: members', () => {
  const memberActions: MemberAction[] = ['read', 'add', 'edit', 'claim', 'clear', 'promote'];
  // [on their own row, on another member's row]
  const table: Record<CallerName, Record<MemberAction, [boolean, boolean]>> = {
    admin: {
      read: [true, true],
      add: [true, true],
      edit: [true, true],
      claim: [true, true],
      clear: [true, true],
      promote: [true, true],
    },
    colead: {
      read: [true, true],
      add: [true, true],
      edit: [true, true],
      claim: [true, true],
      clear: [true, true],
      promote: [false, false],
    },
    groupRole: {
      read: [true, true],
      add: [false, false],
      edit: [false, false],
      claim: [false, false],
      clear: [false, false],
      promote: [false, false],
    },
    member: {
      read: [true, true],
      add: [false, false],
      edit: [true, false],
      claim: [true, true],
      clear: [false, false],
      promote: [false, false],
    },
    guest: {
      read: [true, true],
      add: [false, false],
      edit: [false, false],
      claim: [true, true],
      clear: [false, false],
      promote: [false, false],
    },
    reader: {
      read: [false, false],
      add: [false, false],
      edit: [false, false],
      claim: [false, false],
      clear: [false, false],
      promote: [false, false],
    },
    recipeWriter: {
      read: [false, false],
      add: [false, false],
      edit: [false, false],
      claim: [false, false],
      clear: [false, false],
      promote: [false, false],
    },
    scopeless: {
      read: [false, false],
      add: [false, false],
      edit: [false, false],
      claim: [false, false],
      clear: [false, false],
      promote: [false, false],
    },
  };

  for (const [name, caller] of Object.entries(callers) as Array<[CallerName, Caller]>) {
    it(`holds ${name} to the table`, () => {
      for (const action of memberActions) {
        const [own, other] = table[name][action];
        expect(canMember(caller, action, ids.kelly), `${name} ${action} own row`).toBe(own);
        expect(canMember(caller, action, ids.oscar), `${name} ${action} another row`).toBe(other);
      }
    });
  }

  it('authorizeMember throws a 403 naming the action', () => {
    expect(() => authorizeMember(callers.guest, 'edit', ids.kelly)).toThrow(
      /cannot edit this member/,
    );
    expect(() => authorizeMember(callers.member, 'edit', ids.kelly)).not.toThrow();
  });
});

describe('permission: the link and the admin’s own', () => {
  it('lets the admin alone keep the link: no co-lead, device or agent', () => {
    const keepers: Record<CallerName, boolean> = {
      admin: true,
      colead: false,
      groupRole: false,
      member: false,
      guest: false,
      reader: false,
      recipeWriter: false,
      scopeless: false,
    };
    for (const [name, caller] of Object.entries(callers) as Array<[CallerName, Caller]>) {
      expect(canKeepLink(caller), name).toBe(keepers[name]);
    }
    expect(() => requireLinkKeeper(callers.member)).toThrow(/admin only/);
    expect(() => requireLinkKeeper(callers.colead)).toThrow(/admin only/);
    expect(() => requireLinkKeeper(callers.admin)).not.toThrow();
  });

  it('reserves tokens and promotion for the admin alone', () => {
    for (const [name, caller] of Object.entries(callers) as Array<[CallerName, Caller]>) {
      if (name === 'admin') expect(() => requireAdmin(caller)).not.toThrow();
      else expect(() => requireAdmin(caller), name).toThrow(/admin only/);
    }
  });
});

describe('diffFrontmatter', () => {
  it('reports added, removed and changed keys, ignoring nested key order', () => {
    const from = { a: 1, b: { x: 1, y: 2 }, c: 'gone' };
    const to = { a: 2, b: { y: 2, x: 1 }, d: 'new' };
    expect(diffFrontmatter(from, to)).toEqual([
      { key: 'a', change: 'changed', from: 1, to: 2 },
      { key: 'c', change: 'removed', from: 'gone' },
      { key: 'd', change: 'added', to: 'new' },
    ]);
  });
});

describe('diffIngredients', () => {
  it('lists removed groups first, matches headings case-insensitively, and marks unchanged groups', () => {
    const from = {
      ingredients: [
        { heading: 'Garnish', items: ['cilantro'] },
        { heading: 'Meats', items: ['1 lb beef'] },
        { heading: 'Beans', items: ['1 can pinto'] },
      ],
    };
    const to = {
      ingredients: [
        { heading: 'meats', items: ['1 lb beef'] },
        { heading: 'Beans', items: ['1 can pinto', '1 can black'] },
      ],
    };
    expect(diffIngredients(from, to).map((g) => [g.heading, g.change])).toEqual([
      ['Garnish', 'removed'],
      ['meats', 'same'],
      ['Beans', 'changed'],
    ]);
  });

  it('returns nothing for frontmatter without ingredients', () => {
    expect(diffIngredients({ title: 'x' }, { title: 'y' })).toEqual([]);
  });
});
