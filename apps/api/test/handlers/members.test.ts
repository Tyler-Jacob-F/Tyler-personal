import type { ListMembersResponse, Member } from '@the-keep/shared';
import { build as buildAuthorizer } from '../../src/auth/group-authorizer.js';
import { createDevice, createMember, getMember, makeColead } from '../../src/db/group.js';
import { findMemberByEmail } from '../../src/db/repositories.js';
import { member as memberTable } from '../../src/db/schema.js';
import { build, cognitoUserCreator, userPoolIdFromEnv } from '../../src/handlers/members.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { generateDeviceToken, hashSecret } from '../../src/lib/token.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeAuthorizerEvent, fakeEvent, type FakeDevice } from '../helpers/event.js';

let t: TestDb;
let api: ApiHandler;
let created: string[];
let kelly: Member;
let oscar: Member;
let phone: FakeDevice;

beforeEach(async () => {
  t = await testDb();
  created = [];
  api = build(t.db, {
    createUser: async (email) => {
      created.push(email);
    },
  });
  kelly = await createMember(t.db, { displayName: 'Kelly Candeto' });
  await makeColead(t.db, kelly.id, 'kelly@example.com');
  oscar = await createMember(t.db, { displayName: 'Oscar' });
  await t.db
    .insert(memberTable)
    .values({ email: 'friend@example.com', role: 'group', displayName: 'Friend' });
  phone = { deviceId: (await createDevice(t.db, 'd-phone')).id };
});
afterEach(() => t.close());

const asAdmin = (method: string, route: string, params = {}, body?: unknown) =>
  api(fakeEvent({ method, route, params, body }));
const asKelly = (method: string, route: string, params = {}, body?: unknown) =>
  api(fakeEvent({ method, route, params, body, email: 'kelly@example.com' }));
const asDevice = (device: FakeDevice, method: string, route: string, params = {}, body?: unknown) =>
  api(fakeEvent({ method, route: `/api/group${route.slice(4)}`, params, body, device }));

describe('GET /api/members', () => {
  it('lists everyone by name for the admin, a co-lead, a member device and a guest device', async () => {
    for (const call of [
      () => asAdmin('GET', '/api/members'),
      () => asKelly('GET', '/api/members'),
      () => asDevice(phone, 'GET', '/api/members'),
      () => asDevice({ ...phone, memberId: oscar.id }, 'GET', '/api/members'),
      () => api(fakeEvent({ method: 'GET', route: '/api/members', email: 'friend@example.com' })),
    ]) {
      const res = await call();
      expect(res.statusCode).toBe(200);
      const items = bodyOf<ListMembersResponse>(res).items;
      expect(items.map((m) => m.displayName)).toEqual([
        'Friend',
        'Kelly Candeto',
        'Oscar',
        'Tyler',
      ]);
      expect(items[1]).toMatchObject({
        role: 'colead',
        email: 'kelly@example.com',
        deviceCount: 0,
      });
    }
    expect(
      (await asDevice({ deviceId: phone.deviceId }, 'GET', '/api/members/{id}', { id: oscar.id }))
        .statusCode,
    ).toBe(200);
    // An agent reads the directory with read:members alone, and does nothing else to it.
    const seeder = { id: oscar.id, name: 'claude', scopes: ['read:documents', 'read:members'] };
    const agent = await api(
      fakeEvent({ method: 'GET', route: '/api/agent/members', agent: seeder }),
    );
    expect(agent.statusCode).toBe(200);
    expect(bodyOf<ListMembersResponse>(agent).items).toHaveLength(4);
    const without = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/agent/members',
        agent: { ...seeder, scopes: ['read:documents'] },
      }),
    );
    expect(without.statusCode).toBe(403);
    expect(
      (
        await api(
          fakeEvent({
            method: 'POST',
            route: '/api/agent/members',
            body: { displayName: 'X' },
            agent: seeder,
          }),
        )
      ).statusCode,
    ).toBe(403);
  });
});

describe('POST /api/members and PATCH /api/members/{id}', () => {
  it('lets the admin and a co-lead add a member with a name alone, and edit anyone', async () => {
    const added = await asKelly('POST', '/api/members', {}, { displayName: ' Medhin ' });
    expect(added.statusCode).toBe(201);
    expect(bodyOf<Member>(added)).toMatchObject({
      displayName: 'Medhin',
      role: 'group',
      email: null,
    });
    expect((await asAdmin('POST', '/api/members', {}, { displayName: '' })).statusCode).toBe(400);

    const edited = await asKelly(
      'PATCH',
      '/api/members/{id}',
      { id: oscar.id },
      { phone: '804-555-0101', notes: 'texts best' },
    );
    expect(edited.statusCode).toBe(200);
    expect(bodyOf<Member>(edited)).toMatchObject({ phone: '804-555-0101', notes: 'texts best' });
    expect(
      (await asAdmin('PATCH', '/api/members/{id}', { id: oscar.id }, { displayName: 'Oscar R.' }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await asAdmin(
          'PATCH',
          '/api/members/{id}',
          { id: '00000000-0000-0000-0000-000000000000' },
          { notes: 'x' },
        )
      ).statusCode,
    ).toBe(404);
  });

  it('lets a device edit only the row it holds, and a guest or the group role none', async () => {
    const mine = { ...phone, memberId: oscar.id };
    const own = await asDevice(
      mine,
      'PATCH',
      '/api/members/{id}',
      { id: oscar.id },
      { displayName: 'Oscar Reyes', address: '12 Elm' },
    );
    expect(own.statusCode).toBe(200);
    expect(bodyOf<Member>(own)).toMatchObject({ displayName: 'Oscar Reyes', address: '12 Elm' });
    expect(
      (await asDevice(mine, 'PATCH', '/api/members/{id}', { id: kelly.id }, { notes: 'x' }))
        .statusCode,
    ).toBe(403);
    expect(
      (await asDevice(phone, 'PATCH', '/api/members/{id}', { id: oscar.id }, { notes: 'x' }))
        .statusCode,
    ).toBe(403);
    expect(
      (await asDevice(phone, 'POST', '/api/members', {}, { displayName: 'X' })).statusCode,
    ).toBe(403);
    const friend = await api(
      fakeEvent({
        method: 'PATCH',
        route: '/api/members/{id}',
        params: { id: oscar.id },
        body: { notes: 'x' },
        email: 'friend@example.com',
      }),
    );
    expect(friend.statusCode).toBe(403);
    expect((await getMember(t.db, kelly.id))?.notes).toBeNull();
  });
});

describe('POST /api/group/members/{id}/claim', () => {
  it('lets a guest take an unclaimed name, asks once before a second device takes it, and lets a device change its mind', async () => {
    const first = await asDevice(phone, 'POST', '/api/members/{id}/claim', { id: oscar.id });
    expect(first.statusCode).toBe(200);
    expect(bodyOf<Member>(first)).toMatchObject({ id: oscar.id, deviceCount: 1 });
    expect(bodyOf<Member>(first).claimedAt).toMatch(/^\d{4}-/);

    // The same device again is not "another device".
    const again = await asDevice(
      { ...phone, memberId: oscar.id },
      'POST',
      '/api/members/{id}/claim',
      { id: oscar.id },
    );
    expect(again.statusCode).toBe(200);

    const tablet = { deviceId: (await createDevice(t.db, 'd-tablet')).id };
    const asked = await asDevice(tablet, 'POST', '/api/members/{id}/claim', { id: oscar.id });
    expect(asked.statusCode).toBe(409);
    expect(bodyOf(asked)).toMatchObject({
      error: 'already_claimed',
      message: expect.stringContaining('Oscar'),
    });
    const confirmed = await asDevice(
      tablet,
      'POST',
      '/api/members/{id}/claim',
      { id: oscar.id },
      { confirm: true },
    );
    expect(confirmed.statusCode).toBe(200);
    expect(bodyOf<Member>(confirmed).deviceCount).toBe(2);

    // A shared phone: the device may take another name; the old one keeps its other device.
    const moved = await asDevice(
      { ...phone, memberId: oscar.id },
      'POST',
      '/api/members/{id}/claim',
      { id: kelly.id },
    );
    expect(moved.statusCode).toBe(200);
    expect((await getMember(t.db, oscar.id))?.deviceCount).toBe(1);
    expect((await getMember(t.db, kelly.id))?.deviceCount).toBe(1);
  });

  it('is a device’s to do: the admin and a co-lead, signed in, cannot claim; nor an unknown id', async () => {
    expect((await asAdmin('POST', '/api/members/{id}/claim', { id: oscar.id })).statusCode).toBe(
      403,
    );
    expect((await asKelly('POST', '/api/members/{id}/claim', { id: oscar.id })).statusCode).toBe(
      403,
    );
    expect(
      (
        await asDevice(phone, 'POST', '/api/members/{id}/claim', {
          id: '00000000-0000-0000-0000-000000000000',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await asDevice(
          phone,
          'POST',
          '/api/members/{id}/claim',
          { id: oscar.id },
          { confirm: 'yes' },
        )
      ).statusCode,
    ).toBe(400);
  });
});

describe('DELETE /api/members/{id}/devices', () => {
  it('clears every device holding the name so the authorizer refuses them next, and is a co-lead’s to do', async () => {
    const token = generateDeviceToken();
    const lost = await createDevice(t.db, hashSecret(token));
    await asDevice({ deviceId: lost.id }, 'POST', '/api/members/{id}/claim', { id: oscar.id });
    const authorize = buildAuthorizer(t.db);
    expect(
      (await authorize(fakeAuthorizerEvent(`Bearer ${token}`, 'GET /api/group/me'))).isAuthorized,
    ).toBe(true);

    expect(
      (
        await asDevice({ ...phone, memberId: oscar.id }, 'DELETE', '/api/members/{id}/devices', {
          id: oscar.id,
        })
      ).statusCode,
    ).toBe(403);
    const res = await asKelly('DELETE', '/api/members/{id}/devices', { id: oscar.id });
    expect(res.statusCode).toBe(204);
    expect(
      (await authorize(fakeAuthorizerEvent(`Bearer ${token}`, 'GET /api/group/me'))).isAuthorized,
    ).toBe(false);
    expect((await getMember(t.db, oscar.id))?.deviceCount).toBe(0);
    expect(
      (await asAdmin('DELETE', '/api/members/{id}/devices', { id: oscar.id })).statusCode,
    ).toBe(204);
  });
});

describe('POST /api/members/{id}/colead', () => {
  it('is the admin’s alone: the row gets the email and role, then the pool gets the user', async () => {
    const res = await asAdmin(
      'POST',
      '/api/members/{id}/colead',
      { id: oscar.id },
      { email: ' Oscar@Example.com ' },
    );
    expect(res.statusCode).toBe(200);
    expect(bodyOf<Member>(res)).toMatchObject({ role: 'colead', email: 'oscar@example.com' });
    expect(created).toEqual(['oscar@example.com']);
    expect((await findMemberByEmail(t.db, 'oscar@example.com'))?.role).toBe('colead');

    const byKelly = await asKelly(
      'POST',
      '/api/members/{id}/colead',
      { id: oscar.id },
      { email: 'x@example.com' },
    );
    expect(byKelly.statusCode).toBe(403);
    const taken = await asAdmin(
      'POST',
      '/api/members/{id}/colead',
      { id: oscar.id },
      { email: 'kelly@example.com' },
    );
    expect(taken.statusCode).toBe(409);
    const bad = await asAdmin(
      'POST',
      '/api/members/{id}/colead',
      { id: oscar.id },
      { email: 'not-an-email' },
    );
    expect(bad.statusCode).toBe(400);
    expect(created).toEqual(['oscar@example.com']);
  });

  it('builds a Cognito user with a verified email and no welcome mail, and tolerates one that exists', async () => {
    const { UsernameExistsException } = await import('@aws-sdk/client-cognito-identity-provider');
    const sent: unknown[] = [];
    let exists = false;
    const client = {
      send: async (command: { input: unknown }) => {
        sent.push(command.input);
        if (exists) throw new UsernameExistsException({ message: 'exists', $metadata: {} });
        return {};
      },
    };
    const create = cognitoUserCreator(client as never, 'pool-1');
    await create('kelly@example.com');
    expect(sent[0]).toEqual({
      UserPoolId: 'pool-1',
      Username: 'kelly@example.com',
      UserAttributes: [
        { Name: 'email', Value: 'kelly@example.com' },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: 'SUPPRESS',
    });
    exists = true;
    await expect(create('kelly@example.com')).resolves.toBeUndefined();
    expect(userPoolIdFromEnv({ USER_POOL_ID: 'p' })).toBe('p');
    expect(() => userPoolIdFromEnv({})).toThrow(/USER_POOL_ID/);
  });
});
