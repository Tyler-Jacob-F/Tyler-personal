import { build } from '../../src/handlers/me.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

describe('GET /api/me', () => {
  it('returns the admin caller for the allowlisted email', async () => {
    const res = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/me' }));
    expect(res.statusCode).toBe(200);
    expect(bodyOf(res)).toMatchObject({
      caller: { kind: 'member', role: 'admin' },
      email: 'tyler.fuqua@icloud.com',
      displayName: 'Tyler',
    });
  });

  it('refuses an email that is not on the allowlist', async () => {
    const res = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/me', email: 'x@y.z' }));
    expect(res.statusCode).toBe(403);
    expect(bodyOf(res)).toEqual({ error: 'forbidden', message: 'not a member' });
  });

  it('refuses a request with no verified email claim', async () => {
    const res = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/me', email: null }));
    expect(res.statusCode).toBe(401);
  });

  it('404s an unknown route', async () => {
    const res = await build(t.db)(fakeEvent({ method: 'GET', route: '/api/nope' }));
    expect(res.statusCode).toBe(404);
  });
});
