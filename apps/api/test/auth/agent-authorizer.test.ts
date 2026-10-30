import { bearerToken, build } from '../../src/auth/agent-authorizer.js';
import {
  createAgentToken,
  findAgentTokenByHash,
  revokeAgentToken,
} from '../../src/db/repositories.js';
import { generateAgentSecret, hashAgentSecret } from '../../src/lib/token.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { fakeAuthorizerEvent } from '../helpers/event.js';

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

describe('bearerToken', () => {
  it('reads the token out of a Bearer header and nothing else', () => {
    expect(bearerToken('Bearer keep_abc')).toBe('keep_abc');
    expect(bearerToken('bearer keep_abc')).toBe('keep_abc');
    expect(bearerToken(' Bearer   keep_abc ')).toBe('keep_abc');
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeUndefined();
    expect(bearerToken('keep_abc')).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});

describe('agent authorizer', () => {
  it('accepts a live token, returns its id, name and scopes, and records the use', async () => {
    const secret = generateAgentSecret();
    const token = await createAgentToken(t.db, {
      name: 'importer',
      scopes: ['read:documents', 'write:recipes'],
      secretHash: hashAgentSecret(secret),
    });
    const result = await build(t.db)(fakeAuthorizerEvent(`Bearer ${secret}`));
    expect(result).toEqual({
      isAuthorized: true,
      context: {
        id: token.id,
        name: 'importer',
        scopes: JSON.stringify(['read:documents', 'write:recipes']),
      },
    });
    const used = await findAgentTokenByHash(t.db, hashAgentSecret(secret));
    expect(used?.lastUsedAt).toMatch(/^\d{4}-/);
  });

  it('refuses a revoked token, an unknown one, a malformed one and a missing header', async () => {
    const secret = generateAgentSecret();
    const token = await createAgentToken(t.db, {
      name: 'old',
      scopes: ['read:documents'],
      secretHash: hashAgentSecret(secret),
    });
    await revokeAgentToken(t.db, token.id);
    const authorize = build(t.db);
    for (const header of [
      `Bearer ${secret}`,
      `Bearer ${generateAgentSecret()}`,
      'Bearer not-a-token',
      `Bearer ${secret.slice(0, -1)}`,
      `Token ${secret}`,
      undefined,
    ]) {
      const result = await authorize(fakeAuthorizerEvent(header));
      expect(result, header ?? '(none)').toEqual({ isAuthorized: false });
      expect(result).not.toHaveProperty('context');
    }
    expect((await findAgentTokenByHash(t.db, hashAgentSecret(secret)))?.lastUsedAt).toBeNull();
  });
});
