import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  createClaimRequestSchema,
  createDocumentRequestSchema,
  createVersionRequestSchema,
  type DocumentWithVersion,
  documentTypes,
  listDocumentsQuerySchema,
  recipeTaxonomyGuide,
  searchDocumentsQuerySchema,
  setTagsRequestSchema,
  typeGuides,
  type Version,
} from '@the-keep/shared';
import { ZodError, z } from 'zod';
import type { Db } from '../db/client.js';
import { NotFoundError } from '../db/repositories.js';
import { HttpError } from '../lib/http.js';
import type { Logger } from '../lib/logger.js';
import type { Identity } from '../middleware/identity.js';
import { createClaimFor, listClaimsFor } from '../services/claims.js';
import {
  createDocumentFor,
  createVersionFor,
  getDocumentFor,
  listDocumentsFor,
  searchDocumentsFor,
  setTagsFor,
} from '../services/documents.js';
import { listMembersFor } from '../services/members.js';

export const SERVER_NAME = 'the-keep';
export const SERVER_VERSION = '0.5.0';

const idField = z
  .uuid()
  .describe('The document id, as list_documents or create_document returned it.');

const instructions = [
  'The Keep is Tyler’s personal system of record: every document (recipes today, briefs and',
  'notes later) is typed, versioned and private by default. Saving never overwrites; it appends',
  'a version with a one-line summary of what changed. Your token carries scopes: read:documents',
  'to list and read, write:<type>s to create documents of a type and add versions to them.',
  'Nothing here can make a document public; that is a human click in the admin UI. Use',
  'list_documents before create_document so an existing recipe gets a version instead of a',
  'duplicate. When importing an older file, pass authoredAt as the date the content was written.',
  'Facets and flags are tags on the document, not frontmatter: set_tags replaces the whole set',
  'without writing a version. The small group’s types (questions, signup, event) start in the',
  'group ring, where every member reads them. With write:signups a token may also make a',
  'sheet and put names on its slots (claim_slot), and with read:members look the names up',
  '(list_members): the one-time seed from the old Google Sheet. Nothing touches a member row.',
].join(' ');

/** A model-sized view of a document: identity and the current version's facts, not its body. */
function summarize({ document, version }: DocumentWithVersion) {
  return {
    id: document.id,
    type: document.type,
    slug: document.slug,
    title: String(version.frontmatter.title ?? ''),
    ring: document.ring,
    tags: document.tags,
    version: version.number,
    summary: version.summary,
    author: version.author.name,
    authoredAt: version.authoredAt,
    createdAt: version.createdAt,
  };
}

function detail({ document, version }: DocumentWithVersion) {
  return {
    ...summarize({ document, version }),
    frontmatter: version.frontmatter,
    body: version.body,
  };
}

function versionView(version: Version) {
  return {
    documentId: version.documentId,
    version: version.number,
    summary: version.summary,
    author: version.author.name,
    authoredAt: version.authoredAt,
    createdAt: version.createdAt,
  };
}

function ok(lead: string | null, value: Record<string, unknown>): CallToolResult {
  const text = JSON.stringify(value, null, 2);
  return {
    content: [{ type: 'text', text: lead ? `${lead}\n${text}` : text }],
    structuredContent: value,
  };
}

/**
 * A refusal the model can act on: validation issues by path, 403 with the scope it lacks,
 * 404. Anything else is a real failure and propagates as a JSON-RPC error.
 */
function refusal(error: unknown): CallToolResult {
  let text: string;
  if (error instanceof HttpError) {
    const issues = (error.issues ?? []).map((i) => `  ${i.path || '(root)'}: ${i.message}`);
    text = [`${error.code}: ${error.message}`, ...issues].join('\n');
  } else if (error instanceof ZodError) {
    text = [
      'bad_request: invalid input',
      ...error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`),
    ].join('\n');
  } else if (error instanceof NotFoundError) {
    text = `not_found: ${error.message}`;
  } else {
    throw error;
  }
  return { isError: true, content: [{ type: 'text', text }] };
}

async function attempt(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    return refusal(error);
  }
}

/**
 * One MCP server per request (the Lambda is stateless), holding the caller's identity so
 * every tool runs the same service functions the REST routes run, as that agent.
 */
export function createKeepServer(db: Db, identity: Identity, log: Logger): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions });
  const types = documentTypes.join(', ');

  server.registerTool(
    'list_documents',
    {
      title: 'List documents',
      description:
        `List the documents your token may read, newest first, each with its id, type, slug, ` +
        `title, ring, tags and current version number, summary, author and dates. Filter by ` +
        `type (${types}) and cap the count with limit (1 to 100, default 50). Call this before ` +
        `creating anything so an existing document gets a new version rather than a duplicate. ` +
        `Needs read:documents.`,
      inputSchema: listDocumentsQuerySchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    (args) =>
      attempt(async () => {
        const { items } = await listDocumentsFor(db, identity, args);
        return ok(null, { count: items.length, items: items.map(summarize) });
      }),
  );

  server.registerTool(
    'search_documents',
    {
      title: 'Search documents',
      description:
        `Find documents by words and by tags. q is matched against titles, tags, ingredients ` +
        `and bodies (web-search syntax: "exact phrase", -not, or); tags is a list the document ` +
        `must carry, every one of them, such as ["course:breakfast"]; type (${types}) narrows ` +
        `further; limit caps the count (default 50). With words the best match comes first; ` +
        `without, newest first. "Saturday morning breakfast ideas" is tags ["course:breakfast"] ` +
        `with q "morning" or nothing. Returns the same summaries list_documents does. Needs ` +
        `read:documents.`,
      inputSchema: searchDocumentsQuerySchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    (args) =>
      attempt(async () => {
        const { items, total, q, tags } = await searchDocumentsFor(db, identity, args);
        return ok(null, { q, tags, count: items.length, total, items: items.map(summarize) });
      }),
  );

  server.registerTool(
    'get_document',
    {
      title: 'Get a document',
      description:
        'Read one document by id: its current version in full, frontmatter and markdown body ' +
        'included, plus the facts list_documents shows. Needs read:documents.',
      inputSchema: z.object({ id: idField }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    ({ id }) => attempt(async () => ok(null, detail(await getDocumentFor(db, identity, id)))),
  );

  server.registerTool(
    'create_document',
    {
      title: 'Create a document',
      description:
        `Create a new document of a type (${types}) as its version 1, in the type's default ring ` +
        `("me" for Tyler's own types, "group" for the small group's). ` +
        `frontmatter must fit the type's schema; body is markdown; summary is one line for the ` +
        `history ("imported from the 2014 card"); tags are optional short strings; authoredAt is ` +
        `the date the content was written (YYYY-MM-DD) when that is earlier than today, as when ` +
        `importing an old file, and should be left out otherwise. Returns the document with its ` +
        `id, which create_version takes. Needs write:<type>s, for example write:recipes.\n` +
        typeGuides(),
      inputSchema: createDocumentRequestSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    (args) =>
      attempt(async () => {
        const created = await createDocumentFor(db, identity, args, log);
        const view = detail(created);
        return ok(`Created ${view.type} "${view.title}" as ${view.id}, version 1.`, view);
      }),
  );

  server.registerTool(
    'create_version',
    {
      title: 'Save a new version',
      description:
        'Append a version to an existing document: the complete new frontmatter and body (not a ' +
        'diff), a one-line summary of what changed, and authoredAt when the content was written ' +
        'earlier than today. Nothing is overwritten; the previous versions stay and the ' +
        'document’s current version moves to this one. Use it for a re-export of the same ' +
        'recipe only if the content actually differs. Needs write:<type>s for the document’s ' +
        'type.\n' +
        typeGuides(),
      inputSchema: createVersionRequestSchema.extend({ id: idField }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ id, ...body }) =>
      attempt(async () => {
        const version = await createVersionFor(db, identity, id, body, log);
        return ok(`Saved version ${version.number} of ${id}.`, versionView(version));
      }),
  );

  server.registerTool(
    'set_tags',
    {
      title: 'Set a document’s tags',
      description:
        'Replace the whole tag set on a document, by id. Tags are facts about the document ' +
        'rather than about a version, so this writes no version: the change is recorded with ' +
        'your token’s name and shows in the admin’s activity view as "tagged". Pass every tag ' +
        'the document should have, since what you send replaces what is there; read the ' +
        'document first to keep tags you are not changing. Tags are validated against the ' +
        'type’s vocabulary and an unknown value is refused with the list of what is allowed. ' +
        'Nothing here changes the ring. Needs write:<type>s for the document’s type.\n' +
        recipeTaxonomyGuide(),
      inputSchema: setTagsRequestSchema.extend({ id: idField }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ id, tags }) =>
      attempt(async () => {
        const updated = await setTagsFor(db, identity, id, { tags }, log);
        const view = summarize(updated);
        return ok(`Tagged ${view.type} "${view.title}": ${view.tags.join(' ') || '(none)'}.`, view);
      }),
  );

  server.registerTool(
    'list_members',
    {
      title: 'List the group’s members',
      description:
        'The small group’s directory: each member’s id, name, role (admin, colead, group), and ' +
        'whether a phone has claimed the row. Use it to match a name from the old sign-up sheet ' +
        'to a member id before claim_slot; when a name matches no row, or two, stop and ask ' +
        'rather than guess. Needs read:members.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    () =>
      attempt(async () => {
        const { items } = await listMembersFor(db, identity);
        return ok(null, {
          count: items.length,
          items: items.map((m) => ({
            id: m.id,
            name: m.displayName,
            role: m.role,
            claimed: m.claimedAt !== null,
          })),
        });
      }),
  );

  server.registerTool(
    'claim_slot',
    {
      title: 'Put a name on a sign-up slot',
      description:
        'Record that a member has a slot on a signup document: id is the signup’s document id, ' +
        'slot is the slot’s label exactly as the sheet’s frontmatter has it, memberId is the ' +
        'member from list_members. One claim per member per slot; a full slot is refused ' +
        '(slot_full). This is how the old Google Sheet is ported: make the week’s signup with ' +
        'create_document (type signup, the Thursday’s date, the slots as they were, a closesAt in ' +
        'the past), then one claim_slot per name on it. Returns the slot’s claims after. Needs ' +
        'write:signups.',
      inputSchema: createClaimRequestSchema.extend({ id: idField, memberId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ id, ...body }) =>
      attempt(async () => {
        const claim = await createClaimFor(db, identity, id, body, log);
        const { items } = await listClaimsFor(db, identity, id);
        return ok(`${claim.memberName} is on "${claim.slot}".`, {
          claim,
          slot: claim.slot,
          names: items.filter((c) => c.slot === claim.slot).map((c) => c.memberName),
        });
      }),
  );

  return server;
}
