import {
  createAgentToken,
  findAgentTokenByHash,
  listAgentTokens,
  revokeAgentToken,
  touchAgentToken,
} from '../src/db/repositories.js';
import { hashAgentSecret } from '../src/lib/token.js';
import { testDb, type TestDb } from './helpers/db.js';

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

const secret = 'keep_' + 'a'.repeat(43);

describe('agent tokens', () => {
  it('creates a token with its scopes and finds it by hash, without the hash leaking out', async () => {
    const created = await createAgentToken(t.db, {
      name: 'importer',
      scopes: ['read:documents', 'write:recipes'],
      secretHash: hashAgentSecret(secret),
    });
    expect(created).toMatchObject({
      name: 'importer',
      scopes: ['read:documents', 'write:recipes'],
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(created).not.toHaveProperty('secretHash');
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    expect(await findAgentTokenByHash(t.db, hashAgentSecret(secret))).toEqual(created);
    expect(await findAgentTokenByHash(t.db, hashAgentSecret('keep_other'))).toBeNull();
  });

  it('refuses a second token with the same name, even after the first is revoked', async () => {
    const first = await createAgentToken(t.db, {
      name: 'cowork',
      scopes: ['read:documents'],
      secretHash: hashAgentSecret(secret),
    });
    await revokeAgentToken(t.db, first.id);
    await expect(
      createAgentToken(t.db, {
        name: 'cowork',
        scopes: ['read:documents'],
        secretHash: hashAgentSecret('keep_b'),
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('lists every token newest first, revoked ones included', async () => {
    const a = await createAgentToken(t.db, {
      name: 'a',
      scopes: ['read:documents'],
      secretHash: 'h1',
    });
    const b = await createAgentToken(t.db, {
      name: 'b',
      scopes: ['write:briefs'],
      secretHash: 'h2',
    });
    await revokeAgentToken(t.db, a.id);
    const items = await listAgentTokens(t.db);
    expect(items.map((i) => i.name)).toEqual(['b', 'a']);
    expect(items[1]!.revokedAt).not.toBeNull();
    expect(items[0]!.id).toBe(b.id);
  });

  it('revokes once: a second revoke keeps the first timestamp; an unknown id is null', async () => {
    const created = await createAgentToken(t.db, {
      name: 'x',
      scopes: ['read:documents'],
      secretHash: 'h',
    });
    const revoked = await revokeAgentToken(t.db, created.id);
    expect(revoked?.revokedAt).not.toBeNull();
    const again = await revokeAgentToken(t.db, created.id);
    expect(again?.revokedAt).toBe(revoked?.revokedAt);
    expect(await revokeAgentToken(t.db, '00000000-0000-0000-0000-000000000000')).toBeNull();
    // Still findable by hash, so the authorizer can say "revoked" rather than "unknown".
    expect((await findAgentTokenByHash(t.db, 'h'))?.revokedAt).toBe(revoked?.revokedAt);
  });

  it('touches last_used_at', async () => {
    const created = await createAgentToken(t.db, {
      name: 'x',
      scopes: ['read:documents'],
      secretHash: 'h',
    });
    await touchAgentToken(t.db, created.id);
    const found = await findAgentTokenByHash(t.db, 'h');
    expect(found?.lastUsedAt).toMatch(/^\d{4}-/);
  });
});
