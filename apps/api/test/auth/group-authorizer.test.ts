import { build, deviceExpired } from '../../src/auth/group-authorizer.js';
import {
  createDevice,
  clearMemberDevices,
  claimMember,
  createMember,
  findDeviceByHash,
} from '../../src/db/group.js';
import { generateDeviceToken, generateAgentSecret, hashSecret } from '../../src/lib/token.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { fakeAuthorizerEvent } from '../helpers/event.js';

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

const ROUTE = 'GET /api/group/documents';

describe('the group authorizer', () => {
  it('accepts a live device as a guest, then as the member it claims, and records the use', async () => {
    const token = generateDeviceToken();
    const device = await createDevice(t.db, hashSecret(token));
    await t.pg.query("update device set last_seen_at = '2026-01-01T00:00:00Z'");
    const authorize = build(t.db);

    const guest = await authorize(fakeAuthorizerEvent(`Bearer ${token}`, ROUTE));
    expect(guest).toEqual({
      isAuthorized: true,
      context: { deviceId: device.id, role: 'guest' },
    });
    expect((await findDeviceByHash(t.db, hashSecret(token)))?.lastSeenAt).not.toBe(
      '2026-01-01T00:00:00.000Z',
    );

    const kelly = await createMember(t.db, { displayName: 'Kelly' });
    await claimMember(t.db, device.id, kelly.id);
    const member = await authorize(fakeAuthorizerEvent(`Bearer ${token}`, ROUTE));
    expect(member).toEqual({
      isAuthorized: true,
      context: { deviceId: device.id, memberId: kelly.id, role: 'member' },
    });
  });

  it('refuses no token, an agent token, an unknown device, a cleared device and a year-old one', async () => {
    const token = generateDeviceToken();
    const device = await createDevice(t.db, hashSecret(token));
    const kelly = await createMember(t.db, { displayName: 'Kelly' });
    await claimMember(t.db, device.id, kelly.id);
    const authorize = build(t.db);
    const deny = { isAuthorized: false };

    expect(await authorize(fakeAuthorizerEvent(undefined, ROUTE))).toEqual(deny);
    expect(await authorize(fakeAuthorizerEvent('Bearer ', ROUTE))).toEqual(deny);
    expect(await authorize(fakeAuthorizerEvent(`Bearer ${generateAgentSecret()}`, ROUTE))).toEqual(
      deny,
    );
    expect(await authorize(fakeAuthorizerEvent(`Bearer ${generateDeviceToken()}`, ROUTE))).toEqual(
      deny,
    );
    // A bare token is not accepted on this door: the web client always sends Bearer.
    expect(await authorize(fakeAuthorizerEvent(token, ROUTE))).toEqual(deny);

    const aged = build(t.db, { now: () => new Date(Date.now() + 366 * 86_400_000) });
    expect(await aged(fakeAuthorizerEvent(`Bearer ${token}`, ROUTE))).toEqual(deny);
    const fresh = build(t.db, { now: () => new Date(Date.now() + 364 * 86_400_000) });
    expect((await fresh(fakeAuthorizerEvent(`Bearer ${token}`, ROUTE))).isAuthorized).toBe(true);

    await clearMemberDevices(t.db, kelly.id);
    expect(await authorize(fakeAuthorizerEvent(`Bearer ${token}`, ROUTE))).toEqual(deny);
  });

  it('counts a device’s year from when it entered', () => {
    const entered = '2026-10-31T00:00:00.000Z';
    expect(deviceExpired(entered, new Date('2027-10-30T00:00:00Z'))).toBe(false);
    expect(deviceExpired(entered, new Date('2027-11-01T00:00:00Z'))).toBe(true);
  });
});
