import type {
  AgentActivityItem,
  AgentScope,
  AgentToken,
  Author,
  Document,
  DocumentWithVersion,
  Ring,
  Version,
} from '@the-keep/shared';
import { slugify } from '@the-keep/shared';
import { and, desc, eq, gte, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from './client.js';
import { agentToken, document, member, tagChange, version } from './schema.js';
import { toIso, toIsoOrNull } from './time.js';

export type MemberRow = typeof member.$inferSelect;

/** Who is writing. Resolved from the caller by the handler, never trusted from a body. */
export type AuthorRef = { kind: 'member'; id: string } | { kind: 'agent'; id: string };

export interface NewDocument {
  type: Document['type'];
  title: string;
  ring: Ring;
  owner: string;
  tags: string[];
  body: string;
  frontmatter: Record<string, unknown>;
  summary: string;
  author: AuthorRef;
  /** ISO timestamp of when the content was written, for imported history. */
  authoredAt?: string | null;
}

export interface NewVersion {
  body: string;
  frontmatter: Record<string, unknown>;
  summary: string;
  author: AuthorRef;
  authoredAt?: string | null;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

// ---------- members ----------

export async function findMemberByEmail(db: Db, email: string): Promise<MemberRow | null> {
  const rows = await db.select().from(member).where(eq(member.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

/** The one admin (docs/phases/01-spine.md), who owns every document an agent creates. */
export async function findAdminMember(db: Db): Promise<MemberRow | null> {
  const rows = await db
    .select()
    .from(member)
    .where(eq(member.role, 'admin'))
    .orderBy(member.createdAt)
    .limit(1);
  return rows[0] ?? null;
}

// ---------- agent tokens ----------

type AgentTokenRow = typeof agentToken.$inferSelect;

function toAgentToken(row: AgentTokenRow): AgentToken {
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes as AgentScope[],
    createdAt: toIso(row.createdAt),
    lastUsedAt: toIsoOrNull(row.lastUsedAt),
    revokedAt: toIsoOrNull(row.revokedAt),
  };
}

export interface NewAgentToken {
  name: string;
  scopes: AgentScope[];
  /** SHA-256 of the secret; the secret itself never reaches the data layer. */
  secretHash: string;
}

export class ConflictError extends Error {
  constructor(what: string) {
    super(`${what} already exists`);
    this.name = 'ConflictError';
  }
}

/** Issue a token. Names are unique for life: a revoked `importer` keeps its name in history. */
export async function createAgentToken(db: Db, input: NewAgentToken): Promise<AgentToken> {
  const taken = await db
    .select({ id: agentToken.id })
    .from(agentToken)
    .where(eq(agentToken.name, input.name))
    .limit(1);
  if (taken.length > 0) throw new ConflictError(`agent token ${input.name}`);
  const [row] = await db
    .insert(agentToken)
    .values({ name: input.name, scopes: input.scopes, secretHash: input.secretHash })
    .returning();
  return toAgentToken(row!);
}

/** Every token ever issued, newest first; revoked ones included so history stays legible. */
export async function listAgentTokens(db: Db): Promise<AgentToken[]> {
  const rows = await db
    .select()
    .from(agentToken)
    .orderBy(desc(agentToken.createdAt), desc(agentToken.id));
  return rows.map(toAgentToken);
}

/** The token for a presented secret's hash, revoked or not. The caller decides what revoked means. */
export async function findAgentTokenByHash(db: Db, secretHash: string): Promise<AgentToken | null> {
  const rows = await db
    .select()
    .from(agentToken)
    .where(eq(agentToken.secretHash, secretHash))
    .limit(1);
  return rows[0] ? toAgentToken(rows[0]) : null;
}

/** Revoke: the only lifecycle event a token has. Idempotent; false if the id is unknown. */
export async function revokeAgentToken(db: Db, id: string): Promise<AgentToken | null> {
  const rows = await db
    .update(agentToken)
    .set({ revokedAt: sql`coalesce(${agentToken.revokedAt}, now())` })
    .where(eq(agentToken.id, id))
    .returning();
  return rows[0] ? toAgentToken(rows[0]) : null;
}

/**
 * Change a token's scopes in place. The name and the secret never change, so every client
 * holding the token keeps working with the new set on its next request (the authorizer
 * caches nothing). A revoked token is not edited: it is history.
 */
export async function updateAgentTokenScopes(
  db: Db,
  id: string,
  scopes: AgentScope[],
): Promise<AgentToken | null> {
  const current = await db.select().from(agentToken).where(eq(agentToken.id, id)).limit(1);
  if (!current[0]) return null;
  if (current[0].revokedAt) throw new ConflictError(`a revoked token's scopes`);
  const rows = await db.update(agentToken).set({ scopes }).where(eq(agentToken.id, id)).returning();
  return toAgentToken(rows[0]!);
}

/** Record a use. Called by the authorizer on every accepted request. */
export async function touchAgentToken(db: Db, id: string): Promise<void> {
  await db
    .update(agentToken)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(agentToken.id, id));
}

export interface AgentActivityOptions {
  days: number;
  limit: number;
  /** Injected by tests; production uses the clock. */
  now?: Date;
}

/**
 * What agents did, newest first, within a window: versions they wrote and tag sets they
 * replaced (two row kinds). Deleted documents stay in the list (an agent's work is history
 * even after a soft delete); the admin view links to the document, which 404s if it is gone.
 *
 * The cutoff is computed here rather than as `now() - make_interval(days => $1)`: the
 * Data API binds a JavaScript number as a bigint, and Postgres has no
 * `make_interval(days => bigint)`, which PGlite's untyped text parameters never showed
 * (found in production, Oct 30).
 */
export async function listAgentActivity(
  db: Db,
  { days, limit, now = new Date() }: AgentActivityOptions,
): Promise<AgentActivityItem[]> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const titleOf = (frontmatter: Record<string, unknown>, slug: string) =>
    typeof frontmatter.title === 'string' ? frontmatter.title : slug;
  const [versions, changes] = await Promise.all([
    db
      .select({
        versionId: version.id,
        documentId: version.documentId,
        documentType: document.type,
        slug: document.slug,
        frontmatter: version.frontmatter,
        number: version.number,
        summary: version.summary,
        tokenId: agentToken.id,
        tokenName: agentToken.name,
        createdAt: version.createdAt,
        authoredAt: version.authoredAt,
      })
      .from(version)
      .innerJoin(agentToken, eq(agentToken.id, version.authorAgentTokenId))
      .innerJoin(document, eq(document.id, version.documentId))
      .where(and(isNotNull(version.authorAgentTokenId), gte(version.createdAt, since)))
      .orderBy(desc(version.createdAt), desc(version.id))
      .limit(limit),
    db
      .select({
        changeId: tagChange.id,
        documentId: tagChange.documentId,
        documentType: document.type,
        slug: document.slug,
        frontmatter: version.frontmatter,
        tags: tagChange.tags,
        previousTags: tagChange.previousTags,
        tokenId: agentToken.id,
        tokenName: agentToken.name,
        createdAt: tagChange.createdAt,
      })
      .from(tagChange)
      .innerJoin(agentToken, eq(agentToken.id, tagChange.authorAgentTokenId))
      .innerJoin(document, eq(document.id, tagChange.documentId))
      .innerJoin(version, eq(version.id, document.currentVersionId))
      .where(and(isNotNull(tagChange.authorAgentTokenId), gte(tagChange.createdAt, since)))
      .orderBy(desc(tagChange.createdAt), desc(tagChange.id))
      .limit(limit),
  ]);
  const items: AgentActivityItem[] = [
    ...versions.map((row): AgentActivityItem => ({
      kind: 'version',
      versionId: row.versionId,
      documentId: row.documentId,
      documentType: row.documentType,
      slug: row.slug,
      title: titleOf(row.frontmatter, row.slug),
      number: row.number,
      summary: row.summary,
      token: { id: row.tokenId, name: row.tokenName },
      createdAt: toIso(row.createdAt),
      authoredAt: toIsoOrNull(row.authoredAt),
    })),
    ...changes.map((row): AgentActivityItem => ({
      kind: 'tagged',
      changeId: row.changeId,
      documentId: row.documentId,
      documentType: row.documentType,
      slug: row.slug,
      title: titleOf(row.frontmatter, row.slug),
      tags: row.tags,
      previousTags: row.previousTags,
      token: { id: row.tokenId, name: row.tokenName },
      createdAt: toIso(row.createdAt),
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

// ---------- shaping ----------

type DocumentRow = typeof document.$inferSelect;
type VersionRow = typeof version.$inferSelect;

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    type: row.type as Document['type'],
    slug: row.slug,
    ring: row.ring,
    owner: row.owner,
    createdAt: toIso(row.createdAt),
    currentVersionId: row.currentVersionId,
    tags: row.tags,
    deletedAt: toIsoOrNull(row.deletedAt),
  };
}

function toVersion(row: VersionRow, memberName: string | null, agentName: string | null): Version {
  const author: Author = row.authorMemberId
    ? { kind: 'member', id: row.authorMemberId, name: memberName ?? 'member' }
    : { kind: 'agent', id: row.authorAgentTokenId!, name: agentName ?? 'agent' };
  return {
    id: row.id,
    documentId: row.documentId,
    number: row.number,
    body: row.body,
    frontmatter: row.frontmatter,
    author,
    createdAt: toIso(row.createdAt),
    authoredAt: toIsoOrNull(row.authoredAt),
    summary: row.summary,
  };
}

const authorMember = alias(member, 'author_member');

function versionWithAuthor(db: Db) {
  return db
    .select({ version, memberName: authorMember.displayName, agentName: agentToken.name })
    .from(version)
    .leftJoin(authorMember, eq(authorMember.id, version.authorMemberId))
    .leftJoin(agentToken, eq(agentToken.id, version.authorAgentTokenId));
}

/** A document with its current version and that version's author, the shape every read wants. */
function documentWithAuthor(db: Db) {
  return db
    .select({ document, version, memberName: authorMember.displayName, agentName: agentToken.name })
    .from(document)
    .innerJoin(version, eq(version.id, document.currentVersionId))
    .leftJoin(authorMember, eq(authorMember.id, version.authorMemberId))
    .leftJoin(agentToken, eq(agentToken.id, version.authorAgentTokenId));
}

type DocumentWithAuthorRow = Awaited<
  ReturnType<ReturnType<typeof documentWithAuthor>['execute']>
>[number];

function toDocumentWithVersion(row: DocumentWithAuthorRow): DocumentWithVersion {
  return {
    document: toDocument(row.document),
    version: toVersion(row.version, row.memberName, row.agentName),
  };
}

/** Live documents, of one type or of all. */
const live = (type?: string) =>
  and(isNull(document.deletedAt), type ? eq(document.type, type) : undefined);

function authorColumns(author: AuthorRef) {
  return author.kind === 'member'
    ? { authorMemberId: author.id, authorAgentTokenId: null }
    : { authorMemberId: null, authorAgentTokenId: author.id };
}

// ---------- documents ----------

/** Kebab-case of the title; `-2`, `-3`... when a live or deleted document already has it. */
async function uniqueSlug(db: Db, type: string, title: string): Promise<string> {
  const base = slugify(title);
  const taken = await db
    .select({ slug: document.slug })
    .from(document)
    .where(
      and(eq(document.type, type), or(eq(document.slug, base), like(document.slug, `${base}-%`))),
    );
  const existing = new Set(taken.map((row) => row.slug));
  if (!existing.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
}

export async function createDocument(db: Db, input: NewDocument): Promise<DocumentWithVersion> {
  const slug = await uniqueSlug(db, input.type, input.title);
  const id = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(document)
      .values({ type: input.type, slug, ring: input.ring, owner: input.owner, tags: input.tags })
      .returning({ id: document.id });
    const [first] = await tx
      .insert(version)
      .values({
        documentId: doc!.id,
        number: 1,
        body: input.body,
        frontmatter: input.frontmatter,
        summary: input.summary,
        authoredAt: input.authoredAt ?? null,
        ...authorColumns(input.author),
      })
      .returning({ id: version.id });
    await tx.update(document).set({ currentVersionId: first!.id }).where(eq(document.id, doc!.id));
    return doc!.id;
  });
  return (await getDocument(db, id))!;
}

export interface ListDocumentsOptions {
  type?: string;
  limit: number;
}

/** Live documents with their current version, newest first. */
export async function listDocuments(
  db: Db,
  { type, limit }: ListDocumentsOptions,
): Promise<DocumentWithVersion[]> {
  const rows = await documentWithAuthor(db)
    .where(live(type))
    .orderBy(desc(document.createdAt), desc(document.id))
    .limit(limit);
  return rows.map(toDocumentWithVersion);
}

export interface SearchDocumentsOptions {
  q: string;
  type?: string;
  /** Every one of these must be on the document. */
  tags: string[];
  limit: number;
}

/**
 * Full text over the trigger-maintained vector plus a tag filter, live documents only.
 * Words use web-search syntax; with words the order is rank (title over tags over body),
 * then newest; without, newest first, so an empty search is the plain list.
 */
export async function searchDocuments(
  db: Db,
  { q, type, tags, limit }: SearchDocumentsOptions,
): Promise<DocumentWithVersion[]> {
  const query = q.trim() ? sql`websearch_to_tsquery('english', ${q.trim()})` : null;
  const rows = await documentWithAuthor(db)
    .where(
      and(
        live(type),
        tags.length > 0 ? sql`${document.tags} @> ${JSON.stringify(tags)}::jsonb` : undefined,
        query ? sql`${document}.search @@ ${query}` : undefined,
      ),
    )
    .orderBy(
      ...(query ? [sql`ts_rank_cd(${document}.search, ${query}) desc`] : []),
      desc(document.createdAt),
      desc(document.id),
    )
    .limit(limit);
  return rows.map(toDocumentWithVersion);
}

/** How many live documents there are, of one type or of all. */
export async function countDocuments(db: Db, type?: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(document)
    .where(live(type));
  return Number(rows[0]?.count ?? 0);
}

/** A live document with its current version, or null (deleted counts as gone). */
export async function getDocument(db: Db, id: string): Promise<DocumentWithVersion | null> {
  const rows = await documentWithAuthor(db)
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .limit(1);
  return rows[0] ? toDocumentWithVersion(rows[0]) : null;
}

/** Soft delete. Versions stay; the document stops listing. Returns false if nothing matched. */
export async function softDeleteDocument(db: Db, id: string): Promise<boolean> {
  const rows = await db
    .update(document)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .returning({ id: document.id });
  return rows.length > 0;
}

/**
 * Replace a document's tag set and record the change with its author. Tags are not
 * versioned (they are true of the document, not of a version), so this is the one write
 * to a document that leaves a trail without a version row.
 */
export async function setDocumentTags(
  db: Db,
  documentId: string,
  tags: string[],
  author: AuthorRef,
): Promise<DocumentWithVersion> {
  const existing = await getDocument(db, documentId);
  if (!existing) throw new NotFoundError('document');
  await db.transaction(async (tx) => {
    await tx.update(document).set({ tags }).where(eq(document.id, documentId));
    await tx.insert(tagChange).values({
      documentId,
      tags,
      previousTags: existing.document.tags,
      ...authorColumns(author),
    });
  });
  return (await getDocument(db, documentId))!;
}

// ---------- versions ----------

export async function createVersion(
  db: Db,
  documentId: string,
  input: NewVersion,
): Promise<Version> {
  const existing = await getDocument(db, documentId);
  if (!existing) throw new NotFoundError('document');
  const id = await db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ max: sql<number>`coalesce(max(${version.number}), 0)` })
      .from(version)
      .where(eq(version.documentId, documentId));
    const number = Number(latest?.max ?? 0) + 1;
    const [inserted] = await tx
      .insert(version)
      .values({
        documentId,
        number,
        body: input.body,
        frontmatter: input.frontmatter,
        summary: input.summary,
        authoredAt: input.authoredAt ?? null,
        ...authorColumns(input.author),
      })
      .returning({ id: version.id });
    await tx
      .update(document)
      .set({ currentVersionId: inserted!.id })
      .where(eq(document.id, documentId));
    return inserted!.id;
  });
  const rows = await versionWithAuthor(db).where(eq(version.id, id)).limit(1);
  return toVersion(rows[0]!.version, rows[0]!.memberName, rows[0]!.agentName);
}

/** Every version of a document, newest first. Empty for an unknown or deleted document. */
export async function listVersions(db: Db, documentId: string): Promise<Version[]> {
  if (!(await getDocument(db, documentId))) return [];
  const rows = await versionWithAuthor(db)
    .where(eq(version.documentId, documentId))
    .orderBy(desc(version.number));
  return rows.map((row) => toVersion(row.version, row.memberName, row.agentName));
}

export async function getVersion(
  db: Db,
  documentId: string,
  number: number,
): Promise<Version | null> {
  if (!(await getDocument(db, documentId))) return null;
  const rows = await versionWithAuthor(db)
    .where(and(eq(version.documentId, documentId), eq(version.number, number)))
    .limit(1);
  const row = rows[0];
  return row ? toVersion(row.version, row.memberName, row.agentName) : null;
}
