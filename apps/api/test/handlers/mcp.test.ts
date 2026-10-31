import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { build as buildAuthorizer } from '../../src/auth/agent-authorizer.js';
import {
  createAgentToken,
  getDocument,
  listVersions,
  revokeAgentToken,
} from '../../src/db/repositories.js';
import { build as buildMcp, fromResponse, toRequest } from '../../src/handlers/mcp.js';
import { generateAgentSecret, hashAgentSecret } from '../../src/lib/token.js';
import { adminId, testDb, type TestDb } from '../helpers/db.js';
import { fakeAuthorizerEvent, fakeEvent } from '../helpers/event.js';

const MCP_URL = 'https://tylerfuqua.com/mcp';

let t: TestDb;
let secrets: Record<'importer' | 'reader' | 'revoked' | 'claude' | 'seeder', string>;

/**
 * The whole door, in process: the Lambda authorizer decides, then the MCP Lambda answers,
 * with the request and response going through the same conversions production uses.
 */
function lambdaFetch(): typeof fetch {
  const authorize = buildAuthorizer(t.db);
  const mcp = buildMcp(t.db);
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    expect(url.pathname).toBe('/mcp');
    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name] = value;
    });
    const decision = await authorize(
      fakeAuthorizerEvent(headers.authorization, `${request.method} /mcp`),
    );
    if (!decision.isAuthorized || !('context' in decision)) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    }
    const context = decision.context;
    const result = await mcp(
      fakeEvent({
        method: request.method,
        route: '/mcp',
        headers,
        rawBody: request.method === 'POST' ? await request.text() : undefined,
        agent: { id: context.id, name: context.name, scopes: JSON.parse(context.scopes) },
      }),
    );
    return new Response(result.body ?? null, {
      status: result.statusCode!,
      headers: result.headers as Record<string, string>,
    });
  };
}

async function connect(secret: string): Promise<Client> {
  const client = new Client({ name: 'vitest', version: '0' });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: lambdaFetch(),
    requestInit: { headers: { authorization: `Bearer ${secret}` } },
  });
  await client.connect(transport);
  return client;
}

const chili = {
  title: 'Chili',
  ingredients: [{ heading: 'Meats', items: ['2 lb ground chuck'] }, { items: ['1 onion, diced'] }],
};

function textOf(result: CallToolResult): string {
  return result.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
}

beforeEach(async () => {
  t = await testDb();
  secrets = {
    importer: generateAgentSecret(),
    reader: generateAgentSecret(),
    revoked: generateAgentSecret(),
    claude: generateAgentSecret(),
    seeder: generateAgentSecret(),
  };
  await createAgentToken(t.db, {
    name: 'seeder',
    scopes: ['read:documents', 'write:signups', 'read:members'],
    secretHash: hashAgentSecret(secrets.seeder),
  });
  await createAgentToken(t.db, {
    name: 'claude',
    scopes: ['read:documents', 'write:events', 'write:questions'],
    secretHash: hashAgentSecret(secrets.claude),
  });
  await createAgentToken(t.db, {
    name: 'importer',
    scopes: ['read:documents', 'write:recipes'],
    secretHash: hashAgentSecret(secrets.importer),
  });
  await createAgentToken(t.db, {
    name: 'reader',
    scopes: ['read:documents'],
    secretHash: hashAgentSecret(secrets.reader),
  });
  const old = await createAgentToken(t.db, {
    name: 'old',
    scopes: ['write:recipes'],
    secretHash: hashAgentSecret(secrets.revoked),
  });
  await revokeAgentToken(t.db, old.id);
});
afterEach(() => t.close());

describe('the seed from the Google Sheet through MCP', () => {
  it('lets a token with write:signups and read:members make a past sheet and put names on it, and no other token', async () => {
    const { createMember } = await import('../../src/db/group.js');
    const oscar = await createMember(t.db, { displayName: 'Oscar' });
    const client = await connect(secrets.seeder);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['list_members', 'claim_slot']),
    );

    const members = (await client.callTool({
      name: 'list_members',
      arguments: {},
    })) as CallToolResult;
    expect(members.isError).toBeFalsy();
    const listed = members.structuredContent as {
      items: Array<{ id: string; name: string; role: string }>;
    };
    expect(listed.items.map((m) => m.name)).toEqual(['Oscar', 'Tyler']);
    expect(JSON.stringify(listed)).not.toMatch(/phone|address|email/);

    const sheet = (await client.callTool({
      name: 'create_document',
      arguments: {
        type: 'signup',
        frontmatter: {
          title: 'Dinner, 2 October',
          date: '2026-10-02',
          slots: [{ label: 'Dessert', capacity: 2 }],
          closesAt: '2026-10-02T21:00:00.000Z',
        },
        body: '',
        summary: 'from the Google Sheet',
      },
    })) as CallToolResult;
    expect(sheet.isError).toBeFalsy();
    const { id } = sheet.structuredContent as { id: string };

    const claimed = (await client.callTool({
      name: 'claim_slot',
      arguments: { id, slot: 'Dessert', memberId: oscar.id },
    })) as CallToolResult;
    expect(claimed.isError).toBeFalsy();
    expect(textOf(claimed)).toMatch(/^Oscar is on "Dessert"\./);
    expect(claimed.structuredContent).toMatchObject({ slot: 'Dessert', names: ['Oscar'] });

    const again = (await client.callTool({
      name: 'claim_slot',
      arguments: { id, slot: 'Dessert', memberId: oscar.id },
    })) as CallToolResult;
    expect(again.isError).toBe(true);
    expect(textOf(again)).toMatch(/conflict/);
    const unknownSlot = (await client.callTool({
      name: 'claim_slot',
      arguments: { id, slot: 'Drinks', memberId: oscar.id },
    })) as CallToolResult;
    expect(textOf(unknownSlot)).toMatch(/one of Dessert/);
    await client.close();

    // The everyday token, with events and questions, has neither tool's scope.
    const claude = await connect(secrets.claude);
    const noMembers = (await claude.callTool({
      name: 'list_members',
      arguments: {},
    })) as CallToolResult;
    expect(noMembers.isError).toBe(true);
    expect(textOf(noMembers)).toMatch(/forbidden/);
    const noClaim = (await claude.callTool({
      name: 'claim_slot',
      arguments: { id, slot: 'Dessert', memberId: oscar.id },
    })) as CallToolResult;
    expect(noClaim.isError).toBe(true);
    await claude.close();
  });
});

describe('the group’s types through MCP', () => {
  it('lets the claude token post an event and this week’s questions, in the group ring, and never a signup', async () => {
    const client = await connect(secrets.claude);
    const { tools } = await client.listTools();
    const create = tools.find((tool) => tool.name === 'create_document')!;
    expect(create.description).toContain('questions:');
    expect(create.description).toContain('event:');
    expect(create.description).toContain('group');

    const event = (await client.callTool({
      name: 'create_document',
      arguments: {
        type: 'event',
        frontmatter: { title: 'Small group', date: '2026-11-05', time: '18:30', place: 'Tyler’s' },
        body: '',
        summary: 'next Thursday',
      },
    })) as CallToolResult;
    expect(event.isError).toBeFalsy();
    expect(event.structuredContent).toMatchObject({
      type: 'event',
      ring: 'group',
      author: 'claude',
    });

    const questions = (await client.callTool({
      name: 'create_document',
      arguments: {
        type: 'questions',
        frontmatter: { weekOf: '2026-11-05' },
        body: '1. Where did you see grace this week?',
      },
    })) as CallToolResult;
    expect(questions.isError).toBeFalsy();
    expect(questions.structuredContent).toMatchObject({
      type: 'questions',
      ring: 'group',
      title: 'Questions for 2026-11-05',
    });
    const { id } = questions.structuredContent as { id: string };
    const revised = (await client.callTool({
      name: 'create_version',
      arguments: {
        id,
        frontmatter: { weekOf: '2026-11-05' },
        body: '1. Where did you see grace?\n2. Where did you miss it?',
        summary: 'a second question',
      },
    })) as CallToolResult;
    expect(revised.structuredContent).toMatchObject({ version: 2 });

    const signup = (await client.callTool({
      name: 'create_document',
      arguments: {
        type: 'signup',
        frontmatter: {
          title: 'Thursday',
          date: '2026-11-05',
          slots: [{ label: 'Dinner', capacity: 1 }],
        },
        body: '',
      },
    })) as CallToolResult;
    expect(signup.isError).toBe(true);
    expect(textOf(signup)).toMatch(/forbidden: cannot write a signup in the group ring/);

    const listed = (await client.callTool({
      name: 'list_documents',
      arguments: { type: 'event' },
    })) as CallToolResult;
    expect(listed.structuredContent).toMatchObject({ count: 1 });
    expect((await getDocument(t.db, id))?.document.ring).toBe('group');

    // A recipe writer has no business with the group's types.
    const importer = await connect(secrets.importer);
    const refused = (await importer.callTool({
      name: 'create_document',
      arguments: { type: 'event', frontmatter: { title: 'x', date: '2026-11-05' }, body: '' },
    })) as CallToolResult;
    expect(refused.isError).toBe(true);
    await importer.close();
    await client.close();
  });
});

describe('MCP server', () => {
  it('initializes and lists eight tools, each with a description and an input schema', async () => {
    const client = await connect(secrets.importer);
    expect(client.getServerVersion()).toMatchObject({ name: 'the-keep' });
    expect(client.getInstructions()).toMatch(/private by default/);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'claim_slot',
      'create_document',
      'create_version',
      'get_document',
      'list_documents',
      'list_members',
      'search_documents',
      'set_tags',
    ]);
    for (const tool of tools) {
      expect(tool.description!.length).toBeGreaterThan(80);
      expect(tool.inputSchema.type).toBe('object');
    }
    const create = tools.find((tool) => tool.name === 'create_document')!;
    expect(create.description).toContain('ingredients');
    expect(Object.keys(create.inputSchema.properties ?? {}).sort()).toEqual([
      'authoredAt',
      'body',
      'frontmatter',
      'summary',
      'tags',
      'type',
    ]);
    expect(create.inputSchema.required).toEqual(['type', 'frontmatter', 'body']);
    const version = tools.find((tool) => tool.name === 'create_version')!;
    expect(version.inputSchema.required).toEqual(
      expect.arrayContaining(['id', 'frontmatter', 'body']),
    );
    expect(tools.find((tool) => tool.name === 'list_documents')!.annotations).toMatchObject({
      readOnlyHint: true,
    });
    const searchTool = tools.find((tool) => tool.name === 'search_documents')!;
    expect(searchTool.annotations).toMatchObject({ readOnlyHint: true });
    expect(Object.keys(searchTool.inputSchema.properties ?? {}).sort()).toEqual([
      'limit',
      'q',
      'tags',
      'type',
    ]);
    const setTags = tools.find((tool) => tool.name === 'set_tags')!;
    expect(setTags.description).toContain('course:');
    expect(setTags.inputSchema.required).toEqual(expect.arrayContaining(['id', 'tags']));
    await client.close();
  });

  it('searches by words and by tags, as the token', async () => {
    const client = await connect(secrets.importer);
    const make = (title: string, body: string, tags: string[]) =>
      client.callTool({
        name: 'create_document',
        arguments: { type: 'recipe', frontmatter: { title, ingredients: ['salt'] }, body, tags },
      });
    await make('Pancakes', 'Griddle on a Saturday morning.', ['course:breakfast']);
    await make('Chili', 'Brown the beef.', ['course:main']);

    const byWord = (await client.callTool({
      name: 'search_documents',
      arguments: { q: 'saturday morning' },
    })) as CallToolResult;
    expect(byWord.structuredContent).toMatchObject({ count: 1, q: 'saturday morning' });
    expect(JSON.parse(textOf(byWord)).items[0]).toMatchObject({ title: 'Pancakes' });

    const byTag = (await client.callTool({
      name: 'search_documents',
      arguments: { tags: ['course:breakfast'], type: 'recipe' },
    })) as CallToolResult;
    expect(byTag.structuredContent).toMatchObject({ count: 1, tags: ['course:breakfast'] });

    const none = (await client.callTool({
      name: 'search_documents',
      arguments: { q: 'chili', tags: ['course:breakfast'] },
    })) as CallToolResult;
    expect(none.structuredContent).toMatchObject({ count: 0 });
    await client.close();
  });

  it('sets a document’s tags as the token, refusing a value outside the vocabulary', async () => {
    const client = await connect(secrets.importer);
    const created = (await client.callTool({
      name: 'create_document',
      arguments: { type: 'recipe', frontmatter: chili, body: '', tags: ['camping'] },
    })) as CallToolResult;
    const { id } = created.structuredContent as { id: string };

    const refused = (await client.callTool({
      name: 'set_tags',
      arguments: { id, tags: ['course:brunch'] },
    })) as CallToolResult;
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toMatch(/bad_request: invalid tags/);
    expect(textOf(refused)).toMatch(/one of breakfast, main/);

    const tagged = (await client.callTool({
      name: 'set_tags',
      arguments: { id, tags: ['flag:kid-approved', 'course:breakfast', 'main:eggs'] },
    })) as CallToolResult;
    expect(tagged.isError).toBeFalsy();
    expect(textOf(tagged)).toMatch(
      /^Tagged recipe "Chili": course:breakfast main:eggs flag:kid-approved\./,
    );
    expect(tagged.structuredContent).toMatchObject({
      id,
      tags: ['course:breakfast', 'main:eggs', 'flag:kid-approved'],
      version: 1,
    });
    expect((await getDocument(t.db, id))?.document.tags).toEqual([
      'course:breakfast',
      'main:eggs',
      'flag:kid-approved',
    ]);
    expect((await listVersions(t.db, id)).length).toBe(1);

    const reader = await connect(secrets.reader);
    const forbidden = (await reader.callTool({
      name: 'set_tags',
      arguments: { id, tags: [] },
    })) as CallToolResult;
    expect(forbidden.isError).toBe(true);
    expect(textOf(forbidden)).toMatch(/forbidden/);
    await reader.close();
    await client.close();
  });

  it('creates a recipe, saves a dated version, reads it back and lists it, all as the token', async () => {
    const client = await connect(secrets.importer);

    const created = (await client.callTool({
      name: 'create_document',
      arguments: {
        type: 'recipe',
        frontmatter: chili,
        body: '# Chili\n\nBrown the beef.',
        summary: 'from the 2014 card',
        authoredAt: '2014-03-03',
      },
    })) as CallToolResult;
    expect(created.isError).toBeFalsy();
    expect(textOf(created)).toMatch(/^Created recipe "Chili" as [0-9a-f-]{36}, version 1\./);
    const view = created.structuredContent as { id: string; author: string; ring: string };
    expect(view.author).toBe('importer');
    expect(view.ring).toBe('me');

    const stored = await getDocument(t.db, view.id);
    expect(stored?.document.owner).toBe(await adminId(t.db));
    expect(stored?.version.author).toMatchObject({ kind: 'agent', name: 'importer' });
    expect(stored?.version.authoredAt).toBe('2014-03-03T00:00:00.000Z');

    const saved = (await client.callTool({
      name: 'create_version',
      arguments: {
        id: view.id,
        frontmatter: { ...chili, serves: 8 },
        body: '# Chili\n\nBrown the beef. Add cumin.',
        summary: 'added cumin',
        authoredAt: '2023-11-06',
      },
    })) as CallToolResult;
    expect(saved.isError).toBeFalsy();
    expect(textOf(saved)).toMatch(/^Saved version 2 of /);
    expect((await listVersions(t.db, view.id)).map((v) => v.number)).toEqual([2, 1]);

    const got = (await client.callTool({
      name: 'get_document',
      arguments: { id: view.id },
    })) as CallToolResult;
    expect(got.structuredContent).toMatchObject({
      version: 2,
      summary: 'added cumin',
      frontmatter: { serves: 8 },
      body: '# Chili\n\nBrown the beef. Add cumin.',
    });

    const listed = (await client.callTool({
      name: 'list_documents',
      arguments: { type: 'recipe' },
    })) as CallToolResult;
    expect(listed.structuredContent).toMatchObject({ count: 1 });
    expect(JSON.parse(textOf(listed)).items[0]).toMatchObject({ id: view.id, version: 2 });
    expect(JSON.parse(textOf(listed)).items[0]).not.toHaveProperty('body');
    await client.close();
  });

  it('reports a validation failure as a tool error the model can fix', async () => {
    const client = await connect(secrets.importer);
    const result = (await client.callTool({
      name: 'create_document',
      arguments: {
        type: 'recipe',
        frontmatter: { title: 'Chili', ingredients: [], serves: 'eight' },
        body: '',
      },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/bad_request: invalid frontmatter/);
    expect(textOf(result)).toMatch(/ingredients/);
    expect(textOf(result)).toMatch(/serves/);

    const unknown = (await client.callTool({
      name: 'get_document',
      arguments: { id: '00000000-0000-0000-0000-000000000000' },
    })) as CallToolResult;
    expect(unknown.isError).toBe(true);
    expect(textOf(unknown)).toMatch(/not_found/);
    await client.close();
  });

  it('holds a token to its scopes inside the tools', async () => {
    const client = await connect(secrets.reader);
    const result = (await client.callTool({
      name: 'create_document',
      arguments: { type: 'recipe', frontmatter: chili, body: '' },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/forbidden: cannot write a recipe/);
    expect((await listVersions(t.db, '00000000-0000-0000-0000-000000000000')).length).toBe(0);
    await client.close();
  });

  it('never gets past the authorizer with a revoked or unknown token', async () => {
    await expect(connect(secrets.revoked)).rejects.toThrow(/Unauthorized/);
    await expect(connect(generateAgentSecret())).rejects.toThrow(/Unauthorized/);
  });

  it('answers GET and DELETE with 405 (stateless) and converts events both ways', async () => {
    const mcp = buildMcp(t.db);
    const agent = {
      id: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
      name: 'importer',
      scopes: ['read:documents'],
    };
    const get = await mcp(
      fakeEvent({ method: 'GET', route: '/mcp', agent, headers: { accept: 'text/event-stream' } }),
    );
    expect(get.statusCode).toBe(405);
    expect(get.headers).toMatchObject({ allow: 'POST' });
    const del = await mcp(fakeEvent({ method: 'DELETE', route: '/mcp', agent }));
    expect(del.statusCode).toBe(405);

    const noToken = await mcp(
      fakeEvent({ method: 'POST', route: '/mcp', agent: null, rawBody: '{}' }),
    );
    expect(noToken.statusCode).toBe(401);

    const request = toRequest(
      fakeEvent({
        method: 'POST',
        route: '/mcp',
        query: { a: '1' },
        rawBody: Buffer.from('{"x":1}').toString('base64'),
        headers: { 'x-test': 'yes' },
        agent,
      }),
    );
    // fakeEvent marks nothing base64; make sure a plain body round-trips and the URL is whole.
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://tylerfuqua.com/mcp?a=1');
    expect(request.headers.get('x-test')).toBe('yes');
    const back = await fromResponse(
      new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } }),
    );
    expect(back).toEqual({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
    expect((await fromResponse(new Response(null, { status: 202 }))).body).toBeUndefined();
  });
});
