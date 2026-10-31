import type { EnterGroupResponse } from '@the-keep/shared';
import { build as buildAuthorizer } from '../../src/auth/group-authorizer.js';
import { rotateGroupLink } from '../../src/db/group.js';
import { build } from '../../src/handlers/group-enter.js';
import { generateGroupLinkToken, hashSecret } from '../../src/lib/token.js';
import { adminId, testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeAuthorizerEvent, fakeEvent } from '../helpers/event.js';

let t: TestDb;
beforeEach(async () => {
  t = await testDb();
});
afterEach(() => t.close());

const enter = (body: unknown) =>
  build(t.db)(fakeEvent({ method: 'POST', route: '/api/group/enter', body, email: null }));

describe('POST /api/group/enter', () => {
  it('turns the live link into a device token the group authorizer then accepts as a guest', async () => {
    const token = generateGroupLinkToken();
    await rotateGroupLink(t.db, {
      secretHash: hashSecret(token),
      createdBy: await adminId(t.db),
      clearDevices: false,
    });
    const res = await enter({ token });
    expect(res.statusCode).toBe(201);
    const { deviceToken, device } = bodyOf<EnterGroupResponse>(res);
    expect(deviceToken).toMatch(/^keepd_[A-Za-z0-9_-]{43}$/);
    expect(device).toMatchObject({ memberId: null, clearedAt: null });
    const raw = await t.pg.query<{ secret_hash: string }>('select secret_hash from device');
    expect(raw.rows).toEqual([{ secret_hash: hashSecret(deviceToken) }]);

    const decision = await buildAuthorizer(t.db)(
      fakeAuthorizerEvent(`Bearer ${deviceToken}`, 'GET /api/group/me'),
    );
    expect(decision).toEqual({
      isAuthorized: true,
      context: { deviceId: device.id, role: 'guest' },
    });

    // Every opening is its own device: two phones with the same link are two rows.
    const again = await enter({ token });
    expect(bodyOf<EnterGroupResponse>(again).device.id).not.toBe(device.id);
  });

  it('answers 404, the same 404, for an unknown link and a rotated one; 400 for a malformed body', async () => {
    const admin = await adminId(t.db);
    const old = generateGroupLinkToken();
    await rotateGroupLink(t.db, {
      secretHash: hashSecret(old),
      createdBy: admin,
      clearDevices: false,
    });
    await rotateGroupLink(t.db, {
      secretHash: hashSecret(generateGroupLinkToken()),
      createdBy: admin,
      clearDevices: false,
    });
    const rotated = await enter({ token: old });
    const unknown = await enter({ token: generateGroupLinkToken() });
    expect(rotated.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(bodyOf(rotated)).toEqual(bodyOf(unknown));

    expect((await enter({ token: 'keep_short' })).statusCode).toBe(400);
    expect((await enter(undefined)).statusCode).toBe(400);
    expect(await t.pg.query('select count(*)::int as n from device')).toMatchObject({
      rows: [{ n: 0 }],
    });
  });
});
