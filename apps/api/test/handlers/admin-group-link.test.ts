import type { GroupLinkStatus, RotateGroupLinkResponse } from '@the-keep/shared';
import { createDevice, createMember, findGroupLinkByHash, makeColead } from '../../src/db/group.js';
import { member } from '../../src/db/schema.js';
import { build, siteOriginFromEnv } from '../../src/handlers/admin-group-link.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { hashSecret } from '../../src/lib/token.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent } from '../helpers/event.js';

let t: TestDb;
let api: ApiHandler;
beforeEach(async () => {
  t = await testDb();
  api = build(t.db, { siteOrigin: 'https://tylerfuqua.com' });
});
afterEach(() => t.close());

const status = (email?: string) =>
  api(fakeEvent({ method: 'GET', route: '/api/admin/group-link', email }));
const rotate = (body?: unknown, email?: string) =>
  api(fakeEvent({ method: 'POST', route: '/api/admin/group-link', body, email }));

describe('the group link', () => {
  it('starts with no link, mints one whose token appears once as the URL, and keeps only the hash', async () => {
    expect(bodyOf<GroupLinkStatus>(await status())).toEqual({ link: null, deviceCount: 0 });

    const res = await rotate();
    expect(res.statusCode).toBe(201);
    const { link, token, url } = bodyOf<RotateGroupLinkResponse>(res);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url).toBe(`https://tylerfuqua.com/g/${token}`);
    expect(link.rotatedAt).toBeNull();
    expect((await findGroupLinkByHash(t.db, hashSecret(token)))?.id).toBe(link.id);

    const after = bodyOf<GroupLinkStatus>(await status());
    expect(after.link?.id).toBe(link.id);
    expect(JSON.stringify(after)).not.toContain(token);
  });

  it('rotates: the old link is marked, the new one is active, devices stay unless asked to go', async () => {
    const first = bodyOf<RotateGroupLinkResponse>(await rotate());
    await createDevice(t.db, 'd1');
    await createDevice(t.db, 'd2');
    expect(bodyOf<GroupLinkStatus>(await status()).deviceCount).toBe(2);

    const second = bodyOf<RotateGroupLinkResponse>(await rotate({}));
    expect(second.link.id).not.toBe(first.link.id);
    expect((await findGroupLinkByHash(t.db, hashSecret(first.token)))?.rotatedAt).toMatch(
      /^\d{4}-/,
    );
    expect(bodyOf<GroupLinkStatus>(await status())).toMatchObject({
      link: { id: second.link.id },
      deviceCount: 2,
    });

    await rotate({ clearDevices: true });
    expect(bodyOf<GroupLinkStatus>(await status()).deviceCount).toBe(0);
    expect((await rotate({ clearDevices: 'yes' })).statusCode).toBe(400);
  });

  it('is the admin’s alone: a co-lead, the group role, a stranger, an agent and a device are refused', async () => {
    const kelly = await createMember(t.db, { displayName: 'Kelly' });
    await makeColead(t.db, kelly.id, 'kelly@example.com');
    expect((await rotate(undefined, 'kelly@example.com')).statusCode).toBe(403);
    expect((await status('kelly@example.com')).statusCode).toBe(403);

    await t.db
      .insert(member)
      .values({ email: 'friend@example.com', role: 'group', displayName: 'Friend' });
    expect((await rotate(undefined, 'friend@example.com')).statusCode).toBe(403);
    expect((await status('nobody@example.com')).statusCode).toBe(403);
    const agent = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/admin/group-link',
        agent: { id: kelly.id, name: 'claude', scopes: ['read:documents'] },
      }),
    );
    expect(agent.statusCode).toBe(401);
    const device = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/group/admin/group-link',
        device: { deviceId: kelly.id },
      }),
    );
    expect(device.statusCode).toBe(401);
  });

  it('reads the site origin from the environment and refuses to run without it', () => {
    expect(siteOriginFromEnv({ SITE_ORIGIN: 'https://tylerfuqua.com/' })).toBe(
      'https://tylerfuqua.com',
    );
    expect(() => siteOriginFromEnv({})).toThrow(/SITE_ORIGIN/);
  });
});
