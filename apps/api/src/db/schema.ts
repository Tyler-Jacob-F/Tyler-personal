/**
 * Drizzle schema matching apps/api/migrations exactly. The migration is the source of
 * truth for the database; this file is the source of truth for the queries. Tests apply
 * the migration to PGlite and run these tables against it, so drift fails a test.
 */
import {
  type AnyPgColumn,
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

/** Maintained by the `document_search_refresh` trigger (migration 0006); never written here. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const member = pgTable('member', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['admin', 'group'] }).notNull(),
  displayName: text('display_name').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

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
    search: tsvector('search'),
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
