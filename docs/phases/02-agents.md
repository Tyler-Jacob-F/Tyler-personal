# Phase 2 · Agents

Cites `docs/DESIGN.md`. Read it first, then `docs/phases/01-spine.md`, whose "Decided
during implementation" section says what exists and why.

## Gate

From a Claude Code session holding an agent token with `write:recipes`, import the recipe
archive folder (PDFs and Pages files, the chili lineage included) through the MCP server
at the real domain. Every file becomes a document or a dated version in production, the
token is recorded as author, and the admin UI's agent activity view shows the run.

## Decided (Oct 27, 2026)

- **Bearer tokens are the only door.** Cowork's custom connector dialog offers Request
  headers (confirmed in Tyler's account, Oct 27), Claude Code takes `--header`, and a
  scheduled Claude Code task carries the token as an environment secret. No OAuth
  authorization server; revisit only if a client arrives that cannot send a header.
- **One MCP endpoint, same API.** `https://tylerfuqua.com/mcp`, Streamable HTTP,
  stateless (no server-side sessions, since it runs on Lambda). CloudFront forwards
  `/mcp` to the HTTP API like `/api/*`. The MCP Lambda imports the same handler modules
  the REST routes use and calls them in-process with the agent `caller`, so there is one
  validation path and no second cold start. This honors the brief's "MCP wrapping the
  public API" by sharing code rather than by an HTTP hop; flagged, reversible.
- **Duet arrived Oct 30.** Nothing in this phase is Duet-specific. The "always on"
  producer for the morning brief is a scheduled Claude Code task holding a
  `write:briefs` token; Duet takes over the same token the day it can present a bearer
  header to a custom connector, which is the first thing to check once the MCP server is
  up. If it cannot, that is the one reason to revisit OAuth, in a later phase.
- **The refresh token is remembered in the browser** (decided Oct 29, after a week of
  typing codes): a reload restores the session silently, sign-out revokes the token at
  Cognito and forgets it, and the sign-in form prefills the last email. The id and access
  tokens stay in memory. A stolen unlocked laptop can act as Tyler for up to thirty days
  or until he signs out anywhere, which is the trade he chose.
- **Scopes stay as the brief lists them** (`read:documents`, `write:recipes`,
  `write:briefs`, `write:notes`, `read:reading`). The permission middleware learns to map
  a write to a document type onto its scope; Phase 1's placeholder `write:documents`
  goes away.

## Decided (Oct 30, 2026)

The three items the first draft reserved for Tyler, answered as proposed:

- **Token format:** `keep_` followed by 32 random bytes as base64url (43 characters after
  the prefix), shown once at creation, stored as its SHA-256 hash, never recoverable.
  Fixed from the first token issued.
- **MCP URL:** `https://tylerfuqua.com/mcp`.
- **First tokens:** `importer` with `write:recipes` (and `read:documents`, so it can
  check what exists), `cowork` with `read:documents write:recipes write:notes`, and
  `brief-writer` with `write:briefs`. Each is created in the admin UI, pasted once into
  its home, and never shown again.

## In scope

- `packages/shared`: scope enum, agent token DTOs (create, list, revoke), the `brief`
  frontmatter schema, MCP tool input schemas derived from the existing DTOs.
- Agent tokens: repository (create with hash, find by hash, revoke, touch
  `last_used_at`), admin-only routes `/api/admin/tokens` (list, create, revoke), a Tokens
  screen that shows the secret once. No agent scope can reach these routes.
- Lambda authorizer on `/api/agent/*` and `/mcp`: looks up the hash, refuses revoked
  tokens, returns `{ id, name, scopes }` as context; handlers receive
  `{ kind: 'agent', id, scopes }` and the existing permission middleware does the rest.
- `/api/agent/*` mirrors the documents and versions routes on the same handlers.
- MCP server Lambda: tools `list_documents`, `get_document`, `create_document`,
  `create_version`, each with a zod input schema and a one-paragraph description written
  for a model to read. Tested in-process with the MCP SDK client against PGlite.
- `brief` type: schema (`date`, `sections[]` of `{ heading, body }`), default ring `me`,
  rendered on the logged-in home as "today's brief" above recent documents. Written by
  the scheduled task; the task's prompt and setup are a runbook, not code.
- Agent activity: the admin UI lists recent versions authored by agents, separately
  from human activity, with the token name and time.
- Importer runbook: `docs/runbooks/import-recipes.md`, using `tools/pages-text.py`
  (already in the repo: prints a Pages document's text with no dependencies) and
  `pdftotext` for PDFs, the ordering rule (oldest first, a re-export is not a version,
  the file's own date goes in `authoredAt`), and the one-line Claude Code command that
  adds the MCP server with the token from an environment variable. The gate is running
  it from Tyler's machine, where the folder is.
- Tests travel with code as before; CDK snapshots for the authorizer, the new Lambda and
  the CloudFront behavior.

## Out of scope

- OAuth of any kind for the MCP server: no DCR, no CIMD, no consent screen.
- Google federation, the `group` ring, members, surveys, sign-ups, share tokens, the
  calendar. Phase 3.
- The public read path, CloudFront caching, SEO, the resume, design values. Phase 4.
- Hardcover, Ishar, any feed. Phase 5.
- Token expiry, rotation or scope editing. Revoke and reissue is the whole lifecycle.
- MCP resources, prompts, sampling, or the legacy SSE transport. Tools only.
- Rate limiting beyond API Gateway's defaults.
- Attachments and recipe photos; structured ingredient quantities.
- Any agent path that promotes a ring, manages members or manages tokens. Never.
- Anything Duet-specific.

## Decisions from the brief this phase touches

- Auth (agents): per-agent API tokens with explicit scopes, separate from human sessions.
- Agent surface: MCP server on Lambda wrapping the public API.
- Agent tokens bypass the JWT authorizer on `/api/agent/*` and are verified by a Lambda
  authorizer that returns the scopes as context; both paths converge on the same handlers
  and the same `caller` shape.
- Scopes are verbs on types; checked after identity and before any handler logic.
- Every version an agent writes records the token name as author; the admin UI lists
  agent activity separately from human activity.
- `brief`: `date`, `sections[]`, default ring `me`, written by an agent token.
- Private by default: no agent can make anything public.

## Deliverables

Each is one PR, in this order.

- [x] **Token model.** Scope enum and token DTOs in `packages/shared`; `agent_token`
      repository; `write:documents` replaced by per-type scopes in the permission
      middleware. Tests.
- [x] **Admin tokens.** `/api/admin/tokens` (admin role only) and the Tokens screen:
      name, scopes, create (secret shown once), revoke, last used. Handler and MSW tests.
- [x] **Agent door.** Lambda authorizer, `/api/agent/*` routes, CloudFront unchanged
      (same `/api/*` behavior). Handler tests with fake authorizer events; snapshot.
- [x] **MCP server.** The `mcp` Lambda, four tools, `/mcp` route and CloudFront behavior.
      In-process MCP client tests. Snapshot.
- [x] **Brief type.** Schema, home-screen renderer, `write:briefs` on the scope map,
      the scheduled-task runbook. Tests.
- [x] **Agent activity.** The admin view. MSW test.
- [ ] **Importer runbook and tool.** `docs/runbooks/import-recipes.md`,
      `tools/pages-text.py`, the ordering rule.
- [ ] **Gate check.** Import the archive from a Claude Code session; record the date
      here.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- Nothing is open before the first PR; the three questions above were answered Oct 30.
  Raise anything new that fits the rule: a table or column change after it ships, a
  public URL, a token format change.

**Decide and flag in the PR description:**

- Hash algorithm (SHA-256 unsalted; the token is 256 bits of entropy), authorizer result
  cache TTL, the MCP Lambda's memory and timeout.
- Tool names, descriptions and input shapes; how errors are reported to the model.
- The `brief` sections shape and how "today" is chosen on the home screen.
- Which Claude Code environment holds the brief writer's token and on what schedule.
- The agent activity view's window and ordering.

## Handoff (Oct 30, 2026)

What a fresh session should know that the files alone do not say.

- **State of the world.** Phase 1 is true in production: sign in by emailed code (the
  session now survives reloads), recipes with versions and diffs, the chili lineage
  imported, a Stack page at `/stack` that explains the system. Every stack deploys from
  `main` through GitHub Actions; the first request after the cluster pauses can take up
  to a minute, and the migration runner waits for it.
- **Start here.** Read `CLAUDE.md`, `docs/DESIGN.md`, `docs/phases/01-spine.md` (its
  "Decided during implementation" section is the map of what exists and why), then this
  file. Work on your own branch; one PR per deliverable, in the order above; `cdk diff`
  posts on every PR; merging deploys.
- **Only Tyler does these,** and the directive should ask at the right moment: create
  the three tokens in the admin UI after the Admin tokens PR deploys; add the Cowork
  custom connector (URL `https://tylerfuqua.com/mcp`, Authentication "No sign-in",
  Request header `authorization` with the value `Bearer keep_…`); run the import from
  his machine, where the recipe folder lives; set up the scheduled Claude Code task for
  the brief; and check whether Duet can present a header.
- **Loose ends worth knowing.** `0004_import_chili_lineage` is the one content import by
  migration and is marked the exception; do not add another. The Stack page
  (`apps/web/src/routes/stack`) should gain an agents lane when the MCP Lambda exists.
  The permission middleware's `write:documents` is a placeholder this phase replaces.
