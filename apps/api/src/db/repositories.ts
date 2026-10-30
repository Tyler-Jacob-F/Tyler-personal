import type {
  AgentScope,
  AgentToken,
  Author,
  Document,
  DocumentWithVersion,
  Ring,
  Version,
} from '@the-keep/shared';
import { slugify } from '@the-keep/shared';
import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from './client.js';
import { agentToken, document, member, version } from './schema.js';
import { toIso } from './time.js';

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

// ---------- agent tokens ----------

type AgentTokenRow = typeof agentToken.$inferSelect;

function toAgentToken(row: AgentTokenRow): AgentToken {
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes as AgentScope[],
    createdAt: toIso(row.createdAt),
    lastUsedAt: row.lastUsedAt ? toIso(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? toIso(row.revokedAt) : null,
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

/** Record a use. Called by the authorizer on every accepted request. */
export async function touchAgentToken(db: Db, id: string): Promise<void> {
  await db
    .update(agentToken)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(agentToken.id, id));
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
    deletedAt: row.deletedAt ? toIso(row.deletedAt) : null,
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
    authoredAt: row.authoredAt ? toIso(row.authoredAt) : null,
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
  const rows = await db
    .select({ document, version, memberName: authorMember.displayName, agentName: agentToken.name })
    .from(document)
    .innerJoin(version, eq(version.id, document.currentVersionId))
    .leftJoin(authorMember, eq(authorMember.id, version.authorMemberId))
    .leftJoin(agentToken, eq(agentToken.id, version.authorAgentTokenId))
    .where(and(isNull(document.deletedAt), type ? eq(document.type, type) : undefined))
    .orderBy(desc(document.createdAt), desc(document.id))
    .limit(limit);
  return rows.map((row) => ({
    document: toDocument(row.document),
    version: toVersion(row.version, row.memberName, row.agentName),
  }));
}

/** A live document with its current version, or null (deleted counts as gone). */
export async function getDocument(db: Db, id: string): Promise<DocumentWithVersion | null> {
  const rows = await db
    .select({ document, version, memberName: authorMember.displayName, agentName: agentToken.name })
    .from(document)
    .innerJoin(version, eq(version.id, document.currentVersionId))
    .leftJoin(authorMember, eq(authorMember.id, version.authorMemberId))
    .leftJoin(agentToken, eq(agentToken.id, version.authorAgentTokenId))
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    document: toDocument(row.document),
    version: toVersion(row.version, row.memberName, row.agentName),
  };
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
