import type { Caller } from '@the-keep/shared';
import { authorize, can } from '../src/middleware/permission.js';
import { diffFrontmatter } from '../src/lib/diff.js';

const admin: Caller = { kind: 'member', id: 'a', role: 'admin' };
const group: Caller = { kind: 'member', id: 'g', role: 'group' };
const agent: Caller = { kind: 'agent', id: 't', scopes: ['read:documents'] };

describe('permission middleware', () => {
  it('lets the admin do everything in every ring', () => {
    for (const ring of ['me', 'group', 'public'] as const) {
      for (const action of ['read', 'write', 'delete'] as const) {
        expect(can(admin, action, ring)).toBe(true);
      }
    }
  });

  it('lets a group member read group and public only', () => {
    expect(can(group, 'read', 'group')).toBe(true);
    expect(can(group, 'read', 'public')).toBe(true);
    expect(can(group, 'read', 'me')).toBe(false);
    expect(can(group, 'write', 'group')).toBe(false);
    expect(can(group, 'delete', 'public')).toBe(false);
  });

  it('holds an agent to its scopes and never lets it delete', () => {
    expect(can(agent, 'read', 'me')).toBe(true);
    expect(can(agent, 'write', 'me')).toBe(false);
    expect(can({ ...agent, scopes: ['write:documents'] }, 'write', 'me')).toBe(true);
    expect(can({ ...agent, scopes: ['write:documents'] }, 'delete', 'me')).toBe(false);
  });

  it('authorize throws a 403 HttpError', () => {
    expect(() => authorize(group, 'write', 'me')).toThrow(/cannot write/);
    expect(() => authorize(admin, 'write', 'me')).not.toThrow();
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
