import type {
  AgentToken,
  CreateAgentTokenResponse,
  ListAgentTokensResponse,
} from '@the-keep/shared';
import { findAgentTokenByHash } from '../../src/db/repositories.js';
import { member } from '../../src/db/schema.js';
import { build } from '../../src/handlers/admin-tokens.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { hashAgentSecret } from '../../src/lib/token.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

let t: TestDb;
let api: ApiHandler;
beforeEach(async () => {
  t = await testDb();
  api = build(t.db);
});
afterEach(() => t.close());

const importer = { name: 'importer', scopes: ['write:recipes', 'read:documents'] };

async function createImporter(): Promise<CreateAgentTokenResponse> {
  const res = await api(fakeEvent({ method: 'POST', route: '/api/admin/tokens', body: importer }));
  expect(res.statusCode).toBe(201);
  return bodyOf<CreateAgentTokenResponse>(res);
}

describe('POST /api/admin/tokens', () => {
  it('issues a token, returns the secret once, and stores only its hash', async () => {
    const { token, secret } = await createImporter();
    expect(secret).toMatch(/^keep_[A-Za-z0-9_-]{43}$/);
    expect(token).toMatchObject({
      name: 'importer',
      scopes: ['read:documents', 'write:recipes'],
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(token).not.toHaveProperty('secretHash');
    const stored = await findAgentTokenByHash(t.db, hashAgentSecret(secret));
    expect(stored?.id).toBe(token.id);
    const raw = await t.pg.query<{ secret_hash: string }>('select secret_hash from agent_token');
    expect(raw.rows[0]!.secret_hash).not.toContain(secret);
  });

  it('refuses a duplicate name with 409 and a bad body with 400', async () => {
    await createImporter();
    const dup = await api(
      fakeEvent({ method: 'POST', route: '/api/admin/tokens', body: importer }),
    );
    expect(dup.statusCode).toBe(409);
    const bad = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/admin/tokens',
        body: { name: 'Importer!', scopes: ['write:documents'] },
      }),
    );
    expect(bad.statusCode).toBe(400);
    const issues = bodyOf<{ issues: Array<{ path: string }> }>(bad).issues.map((i) => i.path);
    expect(issues.sort()).toEqual(['name', 'scopes.0']);
    const none = await api(
      fakeEvent({ method: 'POST', route: '/api/admin/tokens', body: { name: 'x', scopes: [] } }),
    );
    expect(none.statusCode).toBe(400);
  });
});

describe('GET and DELETE /api/admin/tokens', () => {
  it('lists tokens newest first and revokes one in place', async () => {
    const a = await createImporter();
    const b = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/admin/tokens',
        body: { name: 'brief-writer', scopes: ['write:briefs'] },
      }),
    );
    expect(b.statusCode).toBe(201);

    const list = await api(fakeEvent({ method: 'GET', route: '/api/admin/tokens' }));
    expect(list.statusCode).toBe(200);
    const items = bodyOf<ListAgentTokensResponse>(list).items;
    expect(items.map((i) => i.name)).toEqual(['brief-writer', 'importer']);
    for (const item of items) expect(JSON.stringify(item)).not.toMatch(/keep_|secret/);

    const del = await api(
      fakeEvent({ method: 'DELETE', route: '/api/admin/tokens/{id}', params: { id: a.token.id } }),
    );
    expect(del.statusCode).toBe(204);
    const after = bodyOf<ListAgentTokensResponse>(
      await api(fakeEvent({ method: 'GET', route: '/api/admin/tokens' })),
    ).items;
    const revoked = after.find((i: AgentToken) => i.id === a.token.id)!;
    expect(revoked.revokedAt).toMatch(/^\d{4}-/);
    expect(after).toHaveLength(2);
  });

  it('404s an unknown token and 400s a non-uuid', async () => {
    const missing = await api(
      fakeEvent({
        method: 'DELETE',
        route: '/api/admin/tokens/{id}',
        params: { id: '00000000-0000-0000-0000-000000000000' },
      }),
    );
    expect(missing.statusCode).toBe(404);
    const bad = await api(
      fakeEvent({ method: 'DELETE', route: '/api/admin/tokens/{id}', params: { id: 'importer' } }),
    );
    expect(bad.statusCode).toBe(400);
  });
});

describe('who may manage tokens', () => {
  it('refuses a non-member and a group member alike', async () => {
    await t.db
      .insert(member)
      .values({ email: 'friend@example.com', role: 'group', displayName: 'Friend' });
    for (const email of ['friend@example.com', 'nobody@example.com']) {
      for (const [method, route] of [
        ['GET', '/api/admin/tokens'],
        ['POST', '/api/admin/tokens'],
      ] as const) {
        const res = await api(fakeEvent({ method, route, body: importer, email }));
        expect(res.statusCode, `${email} ${method}`).toBe(403);
      }
    }
    expect(await t.pg.query('select count(*)::int as n from agent_token')).toMatchObject({
      rows: [{ n: 0 }],
    });
  });
});
