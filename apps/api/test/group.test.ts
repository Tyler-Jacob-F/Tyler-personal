import {
  claimMember,
  clearMemberDevices,
  countLiveDevices,
  createClaim,
  createDevice,
  createMember,
  deleteClaim,
  findActiveGroupLink,
  findDeviceByHash,
  findGroupLinkByHash,
  getClaim,
  getMember,
  listClaims,
  listMemberDevices,
  listMembers,
  makeColead,
  rotateGroupLink,
  touchDevice,
  updateMember,
} from '../src/db/group.js';
import { createDocument, findMemberByEmail } from '../src/db/repositories.js';
import { adminId, testDb, type TestDb } from './helpers/db.js';

let t: TestDb;
let admin: string;

beforeEach(async () => {
  t = await testDb();
  admin = await adminId(t.db);
});
afterEach(() => t.close());

describe('members', () => {
  it('creates a member with a name alone, lists by name, and reads the admin with null email fields', async () => {
    await createMember(t.db, { displayName: 'Oscar' });
    await createMember(t.db, { displayName: 'Kelly Candeto', phone: '804-555-0100', notes: '' });
    const members = await listMembers(t.db);
    expect(members.map((m) => m.displayName)).toEqual(['Kelly Candeto', 'Oscar', 'Tyler']);
    const kelly = members[0]!;
    expect(kelly).toMatchObject({
      role: 'group',
      email: null,
      phone: '804-555-0100',
      address: null,
      notes: null,
      claimedAt: null,
      deviceCount: 0,
    });
    expect(members[2]).toMatchObject({ role: 'admin', email: 'tyler.fuqua@icloud.com' });
  });

  it('updates the fields given, clears with null or empty, and leaves the rest', async () => {
    const oscar = await createMember(t.db, { displayName: 'Oscar', phone: '1', notes: 'n' });
    const updated = await updateMember(t.db, oscar.id, {
      displayName: 'Oscar Reyes',
      phone: null,
      address: '  12 Elm St ',
    });
    expect(updated).toMatchObject({
      displayName: 'Oscar Reyes',
      phone: null,
      address: '  12 Elm St ',
      notes: 'n',
    });
    expect(await updateMember(t.db, oscar.id, { notes: '' })).toMatchObject({ notes: null });
    await expect(
      updateMember(t.db, '00000000-0000-0000-0000-000000000000', { notes: 'x' }),
    ).rejects.toThrow(/member not found/);
  });

  it('makes a member a co-lead with the email the code goes to, lowercased and unique', async () => {
    const kelly = await createMember(t.db, { displayName: 'Kelly' });
    const colead = await makeColead(t.db, kelly.id, 'Kelly@Example.com');
    expect(colead).toMatchObject({ role: 'colead', email: 'kelly@example.com' });
    expect((await findMemberByEmail(t.db, 'KELLY@example.com'))?.id).toBe(kelly.id);
    // Idempotent for the same member; a conflict for another member with that address.
    await expect(makeColead(t.db, kelly.id, 'kelly@example.com')).resolves.toMatchObject({
      role: 'colead',
    });
    const cam = await createMember(t.db, { displayName: 'Cam' });
    await expect(makeColead(t.db, cam.id, 'kelly@example.com')).rejects.toThrow(/already exists/);
    await expect(makeColead(t.db, admin, 'x@example.com')).rejects.toThrow(/admin/);
  });
});

describe('the group link', () => {
  it('mints, finds by hash, rotates to a new one and refuses the old', async () => {
    expect(await findActiveGroupLink(t.db)).toBeNull();
    const first = await rotateGroupLink(t.db, {
      secretHash: 'h1',
      createdBy: admin,
      clearDevices: false,
    });
    expect(first.rotatedAt).toBeNull();
    expect((await findActiveGroupLink(t.db))?.id).toBe(first.id);

    const second = await rotateGroupLink(t.db, {
      secretHash: 'h2',
      createdBy: admin,
      clearDevices: false,
    });
    expect((await findActiveGroupLink(t.db))?.id).toBe(second.id);
    const old = await findGroupLinkByHash(t.db, 'h1');
    expect(old?.rotatedAt).toMatch(/^\d{4}-/);
    expect((await findGroupLinkByHash(t.db, 'h2'))?.rotatedAt).toBeNull();
    expect(await findGroupLinkByHash(t.db, 'nope')).toBeNull();
  });

  it('can drop every device when rotating after a leak', async () => {
    await rotateGroupLink(t.db, { secretHash: 'h1', createdBy: admin, clearDevices: false });
    await createDevice(t.db, 'd1');
    await createDevice(t.db, 'd2');
    expect(await countLiveDevices(t.db)).toBe(2);
    await rotateGroupLink(t.db, { secretHash: 'h2', createdBy: admin, clearDevices: false });
    expect(await countLiveDevices(t.db)).toBe(2);
    await rotateGroupLink(t.db, { secretHash: 'h3', createdBy: admin, clearDevices: true });
    expect(await countLiveDevices(t.db)).toBe(0);
    expect((await findDeviceByHash(t.db, 'd1'))?.clearedAt).toMatch(/^\d{4}-/);
  });
});

describe('devices', () => {
  it('enters unclaimed, claims a name once for claimedAt, and may change its mind', async () => {
    const oscar = await createMember(t.db, { displayName: 'Oscar' });
    const medhin = await createMember(t.db, { displayName: 'Medhin' });
    const d = await createDevice(t.db, 'd1');
    expect(d.memberId).toBeNull();
    expect(d.clearedAt).toBeNull();

    const claimed = await claimMember(t.db, d.id, oscar.id);
    expect(claimed.memberId).toBe(oscar.id);
    const after = await getMember(t.db, oscar.id);
    expect(after?.claimedAt).toMatch(/^\d{4}-/);
    expect(after?.deviceCount).toBe(1);

    await t.pg.query("update member set claimed_at = '2026-01-01T00:00:00Z' where id = $1", [
      oscar.id,
    ]);
    const d2 = await createDevice(t.db, 'd2');
    await claimMember(t.db, d2.id, oscar.id);
    expect((await getMember(t.db, oscar.id))?.claimedAt).toBe('2026-01-01T00:00:00.000Z');
    expect((await getMember(t.db, oscar.id))?.deviceCount).toBe(2);

    await claimMember(t.db, d2.id, medhin.id);
    expect((await getMember(t.db, oscar.id))?.deviceCount).toBe(1);
    expect((await listMemberDevices(t.db, medhin.id)).map((x) => x.id)).toEqual([d2.id]);
  });

  it('records a use, clears a member’s devices and refuses a cleared device a claim', async () => {
    const oscar = await createMember(t.db, { displayName: 'Oscar' });
    const d = await createDevice(t.db, 'd1');
    await t.pg.query("update device set last_seen_at = '2026-01-01T00:00:00Z'");
    await touchDevice(t.db, d.id);
    expect((await findDeviceByHash(t.db, 'd1'))?.lastSeenAt).not.toBe('2026-01-01T00:00:00.000Z');

    await claimMember(t.db, d.id, oscar.id);
    await createDevice(t.db, 'd2');
    expect(await clearMemberDevices(t.db, oscar.id)).toBe(1);
    expect(await clearMemberDevices(t.db, oscar.id)).toBe(0);
    expect((await findDeviceByHash(t.db, 'd1'))?.clearedAt).toMatch(/^\d{4}-/);
    expect(await listMemberDevices(t.db, oscar.id)).toEqual([]);
    expect((await getMember(t.db, oscar.id))?.deviceCount).toBe(0);
    await expect(claimMember(t.db, d.id, oscar.id)).rejects.toThrow(/device not found/);
    expect(await countLiveDevices(t.db)).toBe(1);
  });
});

describe('sign-up claims', () => {
  async function signup() {
    const created = await createDocument(t.db, {
      type: 'recipe',
      title: 'Thursday',
      ring: 'group',
      owner: admin,
      tags: [],
      body: '',
      frontmatter: { title: 'Thursday' },
      summary: '',
      author: { kind: 'member', id: admin },
    });
    return created.document.id;
  }

  it('takes a slot with the member’s name, refuses a second row for the same member and slot, and releases', async () => {
    const documentId = await signup();
    const kelly = await createMember(t.db, { displayName: 'Kelly' });
    const d = await createDevice(t.db, 'd1');
    const mine = await createClaim(t.db, {
      documentId,
      slot: 'Dessert',
      memberId: kelly.id,
      deviceId: d.id,
    });
    expect(mine).toMatchObject({ slot: 'Dessert', memberName: 'Kelly', deviceId: d.id });
    await createClaim(t.db, { documentId, slot: 'Dessert', memberId: admin, deviceId: null });
    await createClaim(t.db, { documentId, slot: 'Drinks', memberId: kelly.id, deviceId: d.id });
    await expect(
      createClaim(t.db, { documentId, slot: 'Dessert', memberId: kelly.id, deviceId: null }),
    ).rejects.toThrow(/already exists/);

    const claims = await listClaims(t.db, documentId);
    expect(claims.map((c) => [c.slot, c.memberName])).toEqual([
      ['Dessert', 'Kelly'],
      ['Dessert', 'Tyler'],
      ['Drinks', 'Kelly'],
    ]);
    expect(await getClaim(t.db, mine.id)).toEqual(mine);

    expect(await deleteClaim(t.db, mine.id)).toBe(true);
    expect(await deleteClaim(t.db, mine.id)).toBe(false);
    expect(await getClaim(t.db, mine.id)).toBeNull();
    expect((await listClaims(t.db, documentId)).map((c) => c.memberName)).toEqual([
      'Tyler',
      'Kelly',
    ]);
  });
});
