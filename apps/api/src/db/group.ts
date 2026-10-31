/**
 * The group's own tables (migration 0007): members as entities, the link, devices and
 * sign-up claims. Documents stay in repositories.ts; this file never touches a version.
 */
import type { Device, GroupLink, Member, MemberRole, SignupClaim } from '@the-keep/shared';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { ConflictError, NotFoundError } from './repositories.js';
import { device, groupLink, member, signupClaim } from './schema.js';
import { toIso } from './time.js';

type MemberRow = typeof member.$inferSelect;
type GroupLinkRow = typeof groupLink.$inferSelect;
type DeviceRow = typeof device.$inferSelect;

const optional = (value: string | null | undefined) => (value ? value : null);

function toMember(row: MemberRow, deviceCount: number): Member {
  return {
    id: row.id,
    displayName: row.displayName,
    role: row.role,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    claimedAt: row.claimedAt ? toIso(row.claimedAt) : null,
    createdAt: toIso(row.createdAt),
    deviceCount,
  };
}

function toGroupLink(row: GroupLinkRow): GroupLink {
  return {
    id: row.id,
    createdBy: row.createdBy,
    createdAt: toIso(row.createdAt),
    rotatedAt: row.rotatedAt ? toIso(row.rotatedAt) : null,
  };
}

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    memberId: row.memberId,
    createdAt: toIso(row.createdAt),
    lastSeenAt: toIso(row.lastSeenAt),
    clearedAt: row.clearedAt ? toIso(row.clearedAt) : null,
  };
}

// ---------- members ----------

/** The fields a member or co-lead may set. `undefined` leaves a field; `null` or '' clears it. */
export interface MemberFieldsInput {
  displayName?: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

const liveDevices = (db: Db) =>
  db
    .select({ memberId: device.memberId, n: count() })
    .from(device)
    .where(isNull(device.clearedAt))
    .groupBy(device.memberId);

/** Everyone, the admin included, by name: the directory and the "Who are you?" list. */
export async function listMembers(db: Db): Promise<Member[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(member).orderBy(member.displayName, member.createdAt),
    liveDevices(db),
  ]);
  const byMember = new Map(counts.map((c) => [c.memberId, Number(c.n)]));
  return rows.map((row) => toMember(row, byMember.get(row.id) ?? 0));
}

export async function getMember(db: Db, id: string): Promise<Member | null> {
  const rows = await db.select().from(member).where(eq(member.id, id)).limit(1);
  if (!rows[0]) return null;
  const n = await db
    .select({ n: count() })
    .from(device)
    .where(and(eq(device.memberId, id), isNull(device.clearedAt)));
  return toMember(rows[0], Number(n[0]?.n ?? 0));
}

/** A new member of the group, with no email: they will claim the row from a device. */
export async function createMember(
  db: Db,
  input: MemberFieldsInput & { displayName: string },
  role: MemberRole = 'group',
): Promise<Member> {
  const [row] = await db
    .insert(member)
    .values({
      displayName: input.displayName,
      role,
      phone: optional(input.phone),
      address: optional(input.address),
      notes: optional(input.notes),
    })
    .returning();
  return toMember(row!, 0);
}

export async function updateMember(db: Db, id: string, input: MemberFieldsInput): Promise<Member> {
  const changes: Partial<typeof member.$inferInsert> = {};
  if (input.displayName !== undefined) changes.displayName = input.displayName;
  if (input.phone !== undefined) changes.phone = optional(input.phone);
  if (input.address !== undefined) changes.address = optional(input.address);
  if (input.notes !== undefined) changes.notes = optional(input.notes);
  if (Object.keys(changes).length > 0) {
    const rows = await db.update(member).set(changes).where(eq(member.id, id)).returning();
    if (!rows[0]) throw new NotFoundError('member');
  }
  const found = await getMember(db, id);
  if (!found) throw new NotFoundError('member');
  return found;
}

/**
 * Make a member a co-lead: give the row the email the sign-in code goes to and the role.
 * The Cognito user is the handler's job (it needs AWS); this is the record. The admin's
 * row is never changed here.
 */
export async function makeColead(db: Db, id: string, email: string): Promise<Member> {
  const normalized = email.toLowerCase();
  const current = await db.select().from(member).where(eq(member.id, id)).limit(1);
  if (!current[0]) throw new NotFoundError('member');
  if (current[0].role === 'admin') throw new ConflictError('the admin as a co-lead');
  const taken = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.email, normalized))
    .limit(1);
  if (taken[0] && taken[0].id !== id) throw new ConflictError(`a member with ${normalized}`);
  await db.update(member).set({ email: normalized, role: 'colead' }).where(eq(member.id, id));
  return (await getMember(db, id))!;
}

// ---------- the link ----------

export async function findActiveGroupLink(db: Db): Promise<GroupLink | null> {
  const rows = await db.select().from(groupLink).where(isNull(groupLink.rotatedAt)).limit(1);
  return rows[0] ? toGroupLink(rows[0]) : null;
}

/** The link for a presented token's hash, rotated or not; the caller reads `rotatedAt`. */
export async function findGroupLinkByHash(db: Db, secretHash: string): Promise<GroupLink | null> {
  const rows = await db
    .select()
    .from(groupLink)
    .where(eq(groupLink.secretHash, secretHash))
    .limit(1);
  return rows[0] ? toGroupLink(rows[0]) : null;
}

export interface RotateGroupLinkInput {
  /** SHA-256 of the new token; the token itself never reaches the data layer. */
  secretHash: string;
  createdBy: string;
  /** After a leak: every device re-enters through the new link. */
  clearDevices: boolean;
}

/** Mint the first link or replace the active one. The old link stops working at once. */
export async function rotateGroupLink(db: Db, input: RotateGroupLinkInput): Promise<GroupLink> {
  return db.transaction(async (tx) => {
    await tx
      .update(groupLink)
      .set({ rotatedAt: sql`now()` })
      .where(isNull(groupLink.rotatedAt));
    if (input.clearDevices) {
      await tx
        .update(device)
        .set({ clearedAt: sql`now()` })
        .where(isNull(device.clearedAt));
    }
    const [row] = await tx
      .insert(groupLink)
      .values({ secretHash: input.secretHash, createdBy: input.createdBy })
      .returning();
    return toGroupLink(row!);
  });
}

// ---------- devices ----------

/** A device that just opened the link: unclaimed, seen now. */
export async function createDevice(db: Db, secretHash: string): Promise<Device> {
  const [row] = await db.insert(device).values({ secretHash }).returning();
  return toDevice(row!);
}

/** The device for a presented token's hash, cleared or not; the authorizer reads `clearedAt`. */
export async function findDeviceByHash(db: Db, secretHash: string): Promise<Device | null> {
  const rows = await db.select().from(device).where(eq(device.secretHash, secretHash)).limit(1);
  return rows[0] ? toDevice(rows[0]) : null;
}

/** Record a use. Called by the group authorizer on every accepted request. */
export async function touchDevice(db: Db, id: string): Promise<void> {
  await db
    .update(device)
    .set({ lastSeenAt: sql`now()` })
    .where(eq(device.id, id));
}

/** Devices holding a name right now, newest first. */
export async function listMemberDevices(db: Db, memberId: string): Promise<Device[]> {
  const rows = await db
    .select()
    .from(device)
    .where(and(eq(device.memberId, memberId), isNull(device.clearedAt)))
    .orderBy(desc(device.lastSeenAt));
  return rows.map(toDevice);
}

/** How many live devices hold any link. */
export async function countLiveDevices(db: Db): Promise<number> {
  const rows = await db.select({ n: count() }).from(device).where(isNull(device.clearedAt));
  return Number(rows[0]?.n ?? 0);
}

/**
 * A device takes a name (or changes its mind and takes another). The member's `claimedAt`
 * is set the first time anyone claims the row and never moves.
 */
export async function claimMember(db: Db, deviceId: string, memberId: string): Promise<Device> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(device)
      .set({ memberId })
      .where(and(eq(device.id, deviceId), isNull(device.clearedAt)))
      .returning();
    if (!rows[0]) throw new NotFoundError('device');
    await tx
      .update(member)
      .set({ claimedAt: sql`coalesce(${member.claimedAt}, now())` })
      .where(eq(member.id, memberId));
    return toDevice(rows[0]);
  });
}

/** A lost phone: every device holding this name is refused from now on. Returns how many. */
export async function clearMemberDevices(db: Db, memberId: string): Promise<number> {
  const rows = await db
    .update(device)
    .set({ clearedAt: sql`now()` })
    .where(and(eq(device.memberId, memberId), isNull(device.clearedAt)))
    .returning({ id: device.id });
  return rows.length;
}

// ---------- sign-up claims ----------

function claimRows(db: Db) {
  return db
    .select({ claim: signupClaim, memberName: member.displayName })
    .from(signupClaim)
    .innerJoin(member, eq(member.id, signupClaim.memberId));
}

function toClaim(row: typeof signupClaim.$inferSelect, memberName: string): SignupClaim {
  return {
    id: row.id,
    documentId: row.documentId,
    slot: row.slot,
    memberId: row.memberId,
    memberName,
    deviceId: row.deviceId,
    createdAt: toIso(row.createdAt),
  };
}

/** Every claim on a sign-up, in the order they were made. */
export async function listClaims(db: Db, documentId: string): Promise<SignupClaim[]> {
  const rows = await claimRows(db)
    .where(eq(signupClaim.documentId, documentId))
    .orderBy(signupClaim.createdAt, signupClaim.id);
  return rows.map((row) => toClaim(row.claim, row.memberName));
}

export async function getClaim(db: Db, id: string): Promise<SignupClaim | null> {
  const rows = await claimRows(db).where(eq(signupClaim.id, id)).limit(1);
  return rows[0] ? toClaim(rows[0].claim, rows[0].memberName) : null;
}

export interface NewClaim {
  documentId: string;
  slot: string;
  memberId: string;
  deviceId: string | null;
}

/** Take a slot. One row per member per slot; a second attempt is a 409, not a second row. */
export async function createClaim(db: Db, input: NewClaim): Promise<SignupClaim> {
  const taken = await db
    .select({ id: signupClaim.id })
    .from(signupClaim)
    .where(
      and(
        eq(signupClaim.documentId, input.documentId),
        eq(signupClaim.slot, input.slot),
        eq(signupClaim.memberId, input.memberId),
      ),
    )
    .limit(1);
  if (taken[0]) throw new ConflictError(`a claim on "${input.slot}" by this member`);
  const [row] = await db.insert(signupClaim).values(input).returning({ id: signupClaim.id });
  return (await getClaim(db, row!.id))!;
}

/** Release a slot. Returns false if nothing matched. */
export async function deleteClaim(db: Db, id: string): Promise<boolean> {
  const rows = await db
    .delete(signupClaim)
    .where(eq(signupClaim.id, id))
    .returning({ id: signupClaim.id });
  return rows.length > 0;
}
