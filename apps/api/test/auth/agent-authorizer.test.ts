import { bearerToken, build, presentedToken } from '../../src/auth/agent-authorizer.js';
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

describe('presentedToken', () => {
  it('prefers X-Keep-Token, with or without a Bearer prefix, over Authorization', () => {
    expect(presentedToken({ 'x-keep-token': 'keep_a', authorization: 'Bearer keep_b' })).toEqual({
      secret: 'keep_a',
      via: 'x-keep-token',
      shape: 'x-keep-token: bare value, length 6',
    });
    expect(presentedToken({ 'X-Keep-Token': 'Bearer keep_a' }).secret).toBe('keep_a');
    expect(presentedToken({ authorization: 'Bearer keep_b' })).toEqual({
      secret: 'keep_b',
      via: 'authorization',
      shape: 'authorization: scheme Bearer, credential length 6',
    });
  });

  it('takes a bare token in Authorization and describes what it cannot use, never the value', () => {
    expect(presentedToken({ authorization: 'keep_b' }).secret).toBe('keep_b');
    expect(presentedToken({ authorization: '' })).toEqual({
      secret: undefined,
      via: 'authorization',
      shape: 'authorization: empty',
    });
    const basic = presentedToken({ authorization: 'Basic dXNlcjpwYXNz' });
    expect(basic.secret).toBeUndefined();
    expect(basic.shape).toBe('authorization: scheme Basic, credential length 12');
    expect(presentedToken({ 'x-keep-token': '   ' }).secret).toBeUndefined();
    expect(presentedToken({})).toEqual({ via: null, shape: 'no token header' });
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

  it('accepts the same token in X-Keep-Token, which is how Cowork sends it', async () => {
    const secret = generateAgentSecret();
    const token = await createAgentToken(t.db, {
      name: 'cowork',
      scopes: ['read:documents'],
      secretHash: hashAgentSecret(secret),
    });
    const authorize = build(t.db);
    const forms: Array<Record<string, string>> = [
      { 'x-keep-token': secret },
      { 'x-keep-token': `Bearer ${secret}` },
      // claude.ai writes its own, empty Authorization over the typed one; ours still wins.
      { 'x-keep-token': secret, authorization: '' },
    ];
    for (const headers of forms) {
      const result = await authorize(fakeAuthorizerEvent(undefined, 'POST /mcp', headers));
      expect(result).toMatchObject({ isAuthorized: true, context: { id: token.id } });
    }
    const bare = await authorize(fakeAuthorizerEvent(secret, 'POST /mcp'));
    expect(bare).toMatchObject({ isAuthorized: true });
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
