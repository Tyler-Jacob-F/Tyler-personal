import type { Caller } from '@the-keep/shared';
import { authorize, can } from '../src/middleware/permission.js';
import { diffFrontmatter, diffIngredients } from '../src/lib/diff.js';

const admin: Caller = { kind: 'member', id: 'a', role: 'admin' };
const group: Caller = { kind: 'member', id: 'g', role: 'group' };
const agent: Caller = { kind: 'agent', id: 't', scopes: ['read:documents'] };
const recipe = (ring: 'me' | 'group' | 'public') => ({ ring, type: 'recipe' as const });

describe('permission middleware', () => {
  it('lets the admin do everything in every ring', () => {
    for (const ring of ['me', 'group', 'public'] as const) {
      for (const action of ['read', 'write', 'delete'] as const) {
        expect(can(admin, action, recipe(ring))).toBe(true);
      }
    }
  });

  it('lets a group member read group and public only', () => {
    expect(can(group, 'read', recipe('group'))).toBe(true);
    expect(can(group, 'read', recipe('public'))).toBe(true);
    expect(can(group, 'read', recipe('me'))).toBe(false);
    expect(can(group, 'write', recipe('group'))).toBe(false);
    expect(can(group, 'delete', recipe('public'))).toBe(false);
  });

  it('holds an agent to its scopes and never lets it delete', () => {
    expect(can(agent, 'read', recipe('me'))).toBe(true);
    expect(can(agent, 'read', recipe('public'))).toBe(true);
    expect(can(agent, 'write', recipe('me'))).toBe(false);
    expect(can({ ...agent, scopes: [] }, 'read', recipe('public'))).toBe(false);
    const writer: Caller = { kind: 'agent', id: 't', scopes: ['write:recipes'] };
    expect(can(writer, 'write', recipe('me'))).toBe(true);
    expect(can(writer, 'read', recipe('me'))).toBe(false);
    expect(can(writer, 'delete', recipe('me'))).toBe(false);
  });

  it('matches a write scope to the document type, not to documents in general', () => {
    const briefs: Caller = { kind: 'agent', id: 't', scopes: ['write:briefs'] };
    expect(can(briefs, 'write', recipe('me'))).toBe(false);
  });

  it('authorize throws a 403 HttpError naming the type and ring', () => {
    expect(() => authorize(group, 'write', recipe('me'))).toThrow(
      /cannot write a recipe in the me ring/,
    );
    expect(() => authorize(agent, 'write', recipe('me'))).toThrow(/cannot write/);
    expect(() => authorize(admin, 'write', recipe('me'))).not.toThrow();
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
