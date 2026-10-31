/**
 * Drizzle schema matching apps/api/migrations exactly. The migration is the source of
 * truth for the database; this file is the source of truth for the queries. Tests apply
 * the migration to PGlite and run these tables against it, so drift fails a test.
 */
import {
  type AnyPgColumn,
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

/**
 * A person the site knows (migration 0007 reshaped it): the admin and co-leads have an
 * email and sign in; the rest of the group hold the link and claim their row from a device.
 * Everything a member adds (phone, address, notes) is visible to the whole group.
 */
export const member = pgTable('member', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  role: text('role', { enum: ['admin', 'colead', 'group'] }).notNull(),
  displayName: text('display_name').notNull(),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  /** When a device first claimed this row. */
  claimedAt: timestamptz('claimed_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

/** The group link (migration 0007): one active row, the rest rotated. The token is kept as its hash. */
export const groupLink = pgTable(
  'group_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    secretHash: text('secret_hash').notNull().unique(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => member.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    rotatedAt: timestamptz('rotated_at'),
  },
  (t) => [
    uniqueIndex('group_link_active_idx')
      .on(sql`(${t.rotatedAt} is null)`)
      .where(sql`${t.rotatedAt} is null`),
  ],
);

/** A phone that opened the link (migration 0007). Unclaimed until it taps a name; cleared devices stay as history. */
export const device = pgTable(
  'device',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    secretHash: text('secret_hash').notNull().unique(),
    memberId: uuid('member_id').references(() => member.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    clearedAt: timestamptz('cleared_at'),
  },
  (t) => [
    index('device_by_member_idx')
      .on(t.memberId)
      .where(sql`${t.clearedAt} is null`),
  ],
);

/** A member's claim on one slot of a signup, by the slot's label (migration 0007). */
export const signupClaim = pgTable(
  'signup_claim',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => document.id),
    slot: text('slot').notNull(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id),
    /** Null when a co-lead or the admin claimed on the member's behalf. */
    deviceId: uuid('device_id').references(() => device.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('signup_claim_document_id_slot_member_id_key').on(t.documentId, t.slot, t.memberId),
    index('signup_claim_by_document_idx').on(t.documentId, t.slot),
  ],
);

export const agentToken = pgTable('agent_token', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  secretHash: text('secret_hash').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  lastUsedAt: timestamptz('last_used_at'),
  revokedAt: timestamptz('revoked_at'),
});

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    slug: text('slug').notNull(),
    ring: text('ring', { enum: ['me', 'group', 'public'] })
      .notNull()
      .default('me'),
    owner: uuid('owner')
      .notNull()
      .references(() => member.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    currentVersionId: uuid('current_version_id').references((): AnyPgColumn => version.id),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    deletedAt: timestamptz('deleted_at'),
    // `search tsvector` (migration 0006) is deliberately not declared. Drizzle selects every
    // declared column when a query asks for `document`, and the RDS Data API cannot return
    // a tsvector value: every read of a document failed in production the hour it shipped
    // (Oct 30). The trigger maintains the column; searchDocuments names it in raw SQL.
  },
  (t) => [uniqueIndex('document_type_slug_key').on(t.type, t.slug)],
);

export const version = pgTable(
  'version',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => document.id),
    number: integer('number').notNull(),
    body: text('body').notNull(),
    frontmatter: jsonb('frontmatter').$type<Record<string, unknown>>().notNull(),
    authorMemberId: uuid('author_member_id').references(() => member.id),
    authorAgentTokenId: uuid('author_agent_token_id').references(() => agentToken.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    authoredAt: timestamptz('authored_at'),
    summary: text('summary').notNull().default(''),
  },
  (t) => [
    uniqueIndex('version_document_id_number_key').on(t.documentId, t.number),
    index('version_by_document_idx').on(t.documentId, t.number),
  ],
);

export const attachment = pgTable('attachment', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionId: uuid('version_id')
    .notNull()
    .references(() => version.id),
  s3Key: text('s3_key').notNull(),
  contentType: text('content_type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  alt: text('alt').notNull().default(''),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

/** Each replacement of a document's tag set, who did it and when (migration 0005). */
export const tagChange = pgTable(
  'tag_change',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => document.id),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    previousTags: jsonb('previous_tags').$type<string[]>().notNull().default([]),
    authorMemberId: uuid('author_member_id').references(() => member.id),
    authorAgentTokenId: uuid('author_agent_token_id').references(() => agentToken.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('tag_change_by_document_idx').on(t.documentId, t.createdAt)],
);

export const schemaMigration = pgTable('schema_migration', {
  name: text('name').primaryKey(),
  appliedAt: timestamptz('applied_at').notNull().defaultNow(),
});
