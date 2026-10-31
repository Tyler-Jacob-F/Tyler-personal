import { z } from 'zod';

/**
 * Who a member is to the site (docs/phases/04-group.md "Decided"): `admin` is Tyler;
 * `colead` is a verified sign-in that runs the group's documents and members; `group` is
 * everyone else, who holds the link and claims a name from a device and never signs in.
 */
export const memberRoles = ['admin', 'colead', 'group'] as const;
export const memberRoleSchema = z.enum(memberRoles);
export type MemberRole = z.infer<typeof memberRoleSchema>;

const line = (max: number) => z.string().trim().max(max);
/** Optional member fields: absent or empty clears them. */
const optionalLine = (max: number) => line(max).nullable().optional();

/** Mirrors the `member` table (migration 0007). Everything here is visible to the whole group. */
export const memberSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  role: memberRoleSchema,
  /** Null for a member who never signs in. */
  email: z.email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  /** When a device first claimed this row; null until someone taps the name. */
  claimedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** Devices currently holding this name (cleared ones excluded). */
  deviceCount: z.number().int().nonnegative(),
});
export type Member = z.infer<typeof memberSchema>;

/** The fields a member edits on their own row, and a co-lead on any: the name and what they choose to add. */
export const memberFieldsSchema = z.object({
  displayName: line(80).min(1),
  phone: optionalLine(40),
  address: optionalLine(200),
  notes: optionalLine(500),
});
export type MemberFields = z.infer<typeof memberFieldsSchema>;

/** `POST /api/members` (admin and co-leads): a name is enough; the rest the member adds. */
export const createMemberRequestSchema = memberFieldsSchema.partial({
  phone: true,
  address: true,
  notes: true,
});
export type CreateMemberRequest = z.input<typeof createMemberRequestSchema>;

/** `PATCH /api/members/{id}`: any subset of the fields. */
export const updateMemberRequestSchema = memberFieldsSchema.partial();
export type UpdateMemberRequest = z.input<typeof updateMemberRequestSchema>;

/** `POST /api/members/{id}/colead` (admin only): the address the sign-in code goes to. */
export const makeColeadRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
export type MakeColeadRequest = z.input<typeof makeColeadRequestSchema>;

export const listMembersResponseSchema = z.object({ items: z.array(memberSchema) });
export type ListMembersResponse = z.infer<typeof listMembersResponseSchema>;

// ---------- the link and devices ----------

/**
 * The group link's token: 32 random bytes as base64url, bare, since the path `/g/` is its
 * prefix. Shown once when minted, stored as its SHA-256.
 */
export const GROUP_LINK_PATH = '/g/';
export const groupLinkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'not a group link');

/**
 * What a device holds after opening the link: `keepd_` then 32 random bytes as base64url,
 * presented as a bearer on `/api/group/*` and stored as its SHA-256. Good for a year.
 */
export const DEVICE_TOKEN_PREFIX = 'keepd_';
export const deviceTokenSchema = z
  .string()
  .regex(/^keepd_[A-Za-z0-9_-]{43}$/, 'not a device token');
export const DEVICE_LIFETIME_DAYS = 365;

/** Mirrors the `group_link` table, the hash left out. */
export const groupLinkSchema = z.object({
  id: z.uuid(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
  rotatedAt: z.iso.datetime().nullable(),
});
export type GroupLink = z.infer<typeof groupLinkSchema>;

/** `GET /api/admin/group-link`: the active link's facts and how many devices hold it; never the token. */
export const groupLinkStatusSchema = z.object({
  link: groupLinkSchema.nullable(),
  /** Devices that opened any link and are not cleared. */
  deviceCount: z.number().int().nonnegative(),
});
export type GroupLinkStatus = z.infer<typeof groupLinkStatusSchema>;

/** `POST /api/admin/group-link`: mint (or rotate) and, after a leak, drop every device too. */
export const rotateGroupLinkRequestSchema = z.object({ clearDevices: z.boolean().default(false) });
export type RotateGroupLinkRequest = z.input<typeof rotateGroupLinkRequestSchema>;

/** The one response that carries the token, as the URL to paste into the group thread. */
export const rotateGroupLinkResponseSchema = z.object({
  link: groupLinkSchema,
  token: groupLinkTokenSchema,
  url: z.url(),
});
export type RotateGroupLinkResponse = z.infer<typeof rotateGroupLinkResponseSchema>;

/** Mirrors the `device` table, the hash left out. */
export const deviceSchema = z.object({
  id: z.uuid(),
  memberId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  clearedAt: z.iso.datetime().nullable(),
});
export type Device = z.infer<typeof deviceSchema>;

/** `POST /api/group/enter`: the link's token, in the body so it stays out of access logs. */
export const enterGroupRequestSchema = z.object({ token: groupLinkTokenSchema });
export type EnterGroupRequest = z.input<typeof enterGroupRequestSchema>;

/** The one response that carries a device token. */
export const enterGroupResponseSchema = z.object({
  deviceToken: deviceTokenSchema,
  device: deviceSchema,
});
export type EnterGroupResponse = z.infer<typeof enterGroupResponseSchema>;

/**
 * `POST /api/group/members/{id}/claim`: a device takes a name. A name already on another
 * device needs `confirm: true` ("already on another device, tap if it is you").
 */
export const claimMemberRequestSchema = z.object({ confirm: z.boolean().default(false) });
export type ClaimMemberRequest = z.input<typeof claimMemberRequestSchema>;

// ---------- sign-up claims ----------

/** Mirrors the `signup_claim` table, with the member's name for the sheet. */
export const signupClaimSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  slot: z.string(),
  memberId: z.uuid(),
  memberName: z.string(),
  /** Null when a co-lead or the admin claimed on the member's behalf. */
  deviceId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});
export type SignupClaim = z.infer<typeof signupClaimSchema>;

/**
 * `POST /api/group/documents/{id}/claims`: a device claims for the member it holds;
 * `memberId` is for the admin and co-leads, who may claim on anyone's behalf.
 */
export const createClaimRequestSchema = z.object({
  slot: z.string().trim().min(1).max(80),
  memberId: z.uuid().optional(),
});
export type CreateClaimRequest = z.input<typeof createClaimRequestSchema>;

export const listClaimsResponseSchema = z.object({ items: z.array(signupClaimSchema) });
export type ListClaimsResponse = z.infer<typeof listClaimsResponseSchema>;
