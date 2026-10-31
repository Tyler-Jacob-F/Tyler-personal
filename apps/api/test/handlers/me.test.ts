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

describe('GET /api/group/me', () => {
  it('answers a device with the member it holds, or as a guest', async () => {
    const { createDevice, claimMember, createMember } = await import('../../src/db/group.js');
    const device = await createDevice(t.db, 'd1');
    const guest = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/group/me', device: { deviceId: device.id } }),
    );
    expect(guest.statusCode).toBe(200);
    expect(bodyOf(guest)).toEqual({
      caller: { kind: 'group', deviceId: device.id, memberId: null, role: 'guest' },
      email: null,
      displayName: 'Guest',
    });

    const kelly = await createMember(t.db, { displayName: 'Kelly Candeto' });
    await claimMember(t.db, device.id, kelly.id);
    const member = await build(t.db)(
      fakeEvent({
        method: 'GET',
        route: '/api/group/me',
        device: { deviceId: device.id, memberId: kelly.id },
      }),
    );
    expect(bodyOf(member)).toEqual({
      caller: { kind: 'group', deviceId: device.id, memberId: kelly.id, role: 'member' },
      email: null,
      displayName: 'Kelly Candeto',
    });

    // A claim on a row that has since gone falls back to guest rather than failing.
    const gone = await build(t.db)(
      fakeEvent({
        method: 'GET',
        route: '/api/group/me',
        device: { deviceId: device.id, memberId: '00000000-0000-0000-0000-000000000000' },
      }),
    );
    expect(bodyOf(gone)).toMatchObject({ caller: { role: 'guest' }, displayName: 'Guest' });

    const none = await build(t.db)(
      fakeEvent({ method: 'GET', route: '/api/group/me', device: null }),
    );
    expect(none.statusCode).toBe(401);
  });
});
