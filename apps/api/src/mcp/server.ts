import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  createDocumentRequestSchema,
  createVersionRequestSchema,
  type DocumentWithVersion,
  documentTypes,
  listDocumentsQuerySchema,
  typeGuides,
  type Version,
} from '@the-keep/shared';
import { ZodError, z } from 'zod';
import type { Db } from '../db/client.js';
import { NotFoundError } from '../db/repositories.js';
import { HttpError } from '../lib/http.js';
import type { Logger } from '../lib/logger.js';
import type { Identity } from '../middleware/identity.js';
import {
  createDocumentFor,
  createVersionFor,
  getDocumentFor,
  listDocumentsFor,
} from '../services/documents.js';

export const SERVER_NAME = 'the-keep';
export const SERVER_VERSION = '0.2.0';

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
        `Create a new document of a type (${types}) as its version 1, in the private "me" ring. ` +
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

  return server;
}
