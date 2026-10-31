import type { DocumentWithVersion, ListClaimsResponse, SignupClaim } from '@the-keep/shared';
import { createDevice, createMember, makeColead } from '../../src/db/group.js';
import { build } from '../../src/handlers/claims.js';
import { build as buildDocuments } from '../../src/handlers/documents.js';
import type { ApiHandler } from '../../src/lib/http.js';
import { testDb, type TestDb } from '../helpers/db.js';
import { bodyOf, fakeEvent, type FakeDevice } from '../helpers/event.js';

let t: TestDb;
let api: ApiHandler;
let sheet: DocumentWithVersion;
let recipe: DocumentWithVersion;
let kelly: { id: string };
let oscar: { id: string };
let kellyPhone: FakeDevice;
let oscarPhone: FakeDevice;
let guest: FakeDevice;
let clock: Date;

const thursday = {
  type: 'signup',
  frontmatter: {
    title: 'Thursday, Nov 5',
    date: '2026-11-05',
    slots: [
      { label: 'Dinner', capacity: 1 },
      { label: 'Dessert', capacity: 2 },
    ],
    closesAt: '2026-11-05T17:00:00.000Z',
  },
  body: '',
};

beforeEach(async () => {
  t = await testDb();
  clock = new Date('2026-11-01T12:00:00Z');
  api = build(t.db, { now: () => clock });
  const documents = buildDocuments(t.db);
  kelly = await createMember(t.db, { displayName: 'Kelly Candeto' });
  await makeColead(t.db, kelly.id, 'kelly@example.com');
  oscar = await createMember(t.db, { displayName: 'Oscar' });
  const made = await documents(
    fakeEvent({
      method: 'POST',
      route: '/api/documents',
      body: thursday,
      email: 'kelly@example.com',
    }),
  );
  expect(made.statusCode).toBe(201);
  sheet = bodyOf<DocumentWithVersion>(made);
  recipe = bodyOf<DocumentWithVersion>(
    await documents(
      fakeEvent({
        method: 'POST',
        route: '/api/documents',
        body: { type: 'recipe', frontmatter: { title: 'Chili', ingredients: ['salt'] }, body: '' },
      }),
    ),
  );
  kellyPhone = { deviceId: (await createDevice(t.db, 'k')).id, memberId: kelly.id };
  oscarPhone = { deviceId: (await createDevice(t.db, 'o')).id, memberId: oscar.id };
  guest = { deviceId: (await createDevice(t.db, 'g')).id };
});
afterEach(() => t.close());

const claims =
  (device?: FakeDevice, email?: string) => (method: string, body?: unknown, claimId?: string) =>
    api(
      fakeEvent({
        method,
        route: claimId
          ? `/api/${device ? 'group/' : ''}documents/{id}/claims/{claimId}`
          : `/api/${device ? 'group/' : ''}documents/{id}/claims`,
        params: { id: sheet.document.id, ...(claimId ? { claimId } : {}) },
        body,
        ...(device ? { device } : { email }),
      }),
    );

describe('the sign-up claim API', () => {
  it('lets a member device take a slot for itself, lists it with the name, and release it; a guest only reads', async () => {
    const asOscar = claims(oscarPhone);
    const taken = await asOscar('POST', { slot: 'Dessert' });
    expect(taken.statusCode).toBe(201);
    const claim = bodyOf<SignupClaim>(taken);
    expect(claim).toMatchObject({
      documentId: sheet.document.id,
      slot: 'Dessert',
      memberId: oscar.id,
      memberName: 'Oscar',
      deviceId: oscarPhone.deviceId,
    });

    const seen = await claims(guest)('GET');
    expect(seen.statusCode).toBe(200);
    expect(bodyOf<ListClaimsResponse>(seen).items).toEqual([claim]);
    expect((await claims(guest)('POST', { slot: 'Dessert' })).statusCode).toBe(403);
    expect((await claims(guest)('DELETE', undefined, claim.id)).statusCode).toBe(403);

    // Not another member's claim, and not a slot for another member.
    expect((await claims(kellyPhone)('DELETE', undefined, claim.id)).statusCode).toBe(403);
    expect((await asOscar('POST', { slot: 'Dinner', memberId: kelly.id })).statusCode).toBe(403);

    expect((await asOscar('DELETE', undefined, claim.id)).statusCode).toBe(204);
    expect((await asOscar('DELETE', undefined, claim.id)).statusCode).toBe(404);
    expect(bodyOf<ListClaimsResponse>(await asOscar('GET')).items).toEqual([]);
  });

  it('holds a slot to its capacity, names the slots when one is unknown, and refuses a second claim by the same member', async () => {
    const asKelly = claims(kellyPhone);
    expect((await asKelly('POST', { slot: 'Dinner' })).statusCode).toBe(201);
    const full = await claims(oscarPhone)('POST', { slot: 'Dinner' });
    expect(full.statusCode).toBe(409);
    expect(bodyOf(full)).toMatchObject({ error: 'slot_full' });
    const again = await asKelly('POST', { slot: 'Dinner' });
    expect(again.statusCode).toBe(409);
    expect(bodyOf(again)).toMatchObject({ error: 'conflict' });

    const unknown = await asKelly('POST', { slot: 'Drinks' });
    expect(unknown.statusCode).toBe(400);
    expect(bodyOf<{ issues: Array<{ message: string }> }>(unknown).issues[0]!.message).toBe(
      'one of Dinner, Dessert',
    );
    expect((await asKelly('POST', {})).statusCode).toBe(400);
  });

  it('lets a co-lead and the admin claim and release for anyone, past the close too, with no device on the row', async () => {
    const asKelly = claims(undefined, 'kelly@example.com');
    const asAdmin = claims();
    const ported = await asKelly('POST', { slot: 'Dessert', memberId: oscar.id });
    expect(ported.statusCode).toBe(201);
    expect(bodyOf<SignupClaim>(ported)).toMatchObject({ memberId: oscar.id, deviceId: null });
    expect((await asKelly('POST', { slot: 'Dessert' })).statusCode).toBe(400);
    expect(
      (await asAdmin('POST', { slot: 'Dessert', memberId: '00000000-0000-0000-0000-000000000000' }))
        .statusCode,
    ).toBe(404);

    clock = new Date('2026-11-06T00:00:00Z');
    expect((await claims(oscarPhone)('POST', { slot: 'Dinner' })).statusCode).toBe(409);
    expect(bodyOf(await claims(oscarPhone)('POST', { slot: 'Dinner' }))).toMatchObject({
      error: 'closed',
    });
    const release = await claims(oscarPhone)('DELETE', undefined, bodyOf<SignupClaim>(ported).id);
    expect(release.statusCode).toBe(409);
    expect((await asAdmin('POST', { slot: 'Dinner', memberId: kelly.id })).statusCode).toBe(201);
    expect((await asKelly('DELETE', undefined, bodyOf<SignupClaim>(ported).id)).statusCode).toBe(
      204,
    );
  });

  it('lets an agent with write:signups seed a sheet’s names through the agents’ door, and refuses one without it', async () => {
    const seeder = { id: oscar.id, name: 'claude', scopes: ['read:documents', 'write:signups'] };
    const asSeeder = (method: string, body?: unknown) =>
      api(
        fakeEvent({
          method,
          route: '/api/agent/documents/{id}/claims',
          params: { id: sheet.document.id },
          body,
          agent: seeder,
        }),
      );
    const ported = await asSeeder('POST', { slot: 'Dessert', memberId: oscar.id });
    expect(ported.statusCode).toBe(201);
    expect(bodyOf<SignupClaim>(ported)).toMatchObject({
      memberId: oscar.id,
      memberName: 'Oscar',
      deviceId: null,
    });
    expect((await asSeeder('POST', { slot: 'Dessert' })).statusCode).toBe(400);
    expect(bodyOf<ListClaimsResponse>(await asSeeder('GET')).items).toHaveLength(1);
    // Past the close too: a seed is history.
    clock = new Date('2026-11-06T00:00:00Z');
    expect((await asSeeder('POST', { slot: 'Dinner', memberId: kelly.id })).statusCode).toBe(201);

    const writer = { ...seeder, scopes: ['read:documents', 'write:events'] };
    const refused = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents/{id}/claims',
        params: { id: sheet.document.id },
        body: { slot: 'Drinks', memberId: oscar.id },
        agent: writer,
      }),
    );
    expect(refused.statusCode).toBe(403);
    // No agent releases a claim: the gateway has no such route, and the service refuses it regardless.
    const release = await api(
      fakeEvent({
        method: 'DELETE',
        route: '/api/agent/documents/{id}/claims/{claimId}',
        params: { id: sheet.document.id, claimId: bodyOf<SignupClaim>(ported).id },
        agent: seeder,
      }),
    );
    expect(release.statusCode).toBe(403);
  });

  it('refuses the group role, an agent without the scope, a document that is not a signup, and a claim id from another sheet', async () => {
    await t.db
      .insert((await import('../../src/db/schema.js')).member)
      .values({ email: 'friend@example.com', role: 'group', displayName: 'Friend' });
    expect((await claims(undefined, 'friend@example.com')('GET')).statusCode).toBe(200);
    expect(
      (
        await claims(undefined, 'friend@example.com')('POST', {
          slot: 'Dinner',
          memberId: oscar.id,
        })
      ).statusCode,
    ).toBe(403);
    const agent = await api(
      fakeEvent({
        method: 'POST',
        route: '/api/agent/documents/{id}/claims',
        params: { id: sheet.document.id },
        body: { slot: 'Dinner', memberId: oscar.id },
        agent: { id: oscar.id, name: 'claude', scopes: ['read:documents', 'write:events'] },
      }),
    );
    expect(agent.statusCode).toBe(403);

    const notASheet = await api(
      fakeEvent({
        method: 'GET',
        route: '/api/documents/{id}/claims',
        params: { id: recipe.document.id },
      }),
    );
    expect(notASheet.statusCode).toBe(400);
    const taken = bodyOf<SignupClaim>(await claims(oscarPhone)('POST', { slot: 'Dessert' }));
    const other = await api(
      fakeEvent({
        method: 'DELETE',
        route: '/api/documents/{id}/claims/{claimId}',
        params: { id: recipe.document.id, claimId: taken.id },
      }),
    );
    expect(other.statusCode).toBe(400);
  });
});
