# Phase 1 · Spine

Cites `docs/DESIGN.md`. Read it first, then `docs/phases/00-foundation.md` for what exists.

## Gate

Signed in as the admin at https://tylerfuqua.com, create a recipe called "Chili", save a
second version with a one-line summary, and view a diff between the two. All of it in
production, through CI, with the `version` rows visible in the database and the admin
recorded as author.

## Decided (Oct 26, 2026)

- **Database: Aurora Serverless v2 (PostgreSQL), min capacity 0 ACU** so it pauses when
  idle. The brief's "RDS db.t4g.micro to start" would cost most of the $20 budget on a
  credits-era account; Aurora at zero ACU costs cents while nobody is using it.
- **Access through the RDS Data API, not a VPC driver.** Lambdas stay outside the VPC
  (no NAT gateway, no ENI cold starts), authenticate with IAM, and the database secret
  never reaches a function's environment. Migrations run from CI through the same API.
  This is a judgment call the brief did not make; it is reversible (a `pg` driver is a
  one-file swap in the data layer) and flagged here so no session relitigates it.
- **Sign-in is a one-time code by email, not a social provider.** Tyler's admin
  identity is an iCloud address; Sign in with Apple needs a $99/year developer
  membership, which fails the budget principle. The brief's own fallback (Cognito custom
  auth flow with a code sent through SES) becomes the primary path, and it is the path
  Phase 3 members without Google will use anyway. Google federation moves to Phase 3.
- **Admin is exactly one allowlisted email**, `tyler.fuqua@icloud.com`, pre-created in
  the user pool by CDK and present in the `member` table with role `admin`. No sign-up
  path exists; an unknown address gets no code.
- **SES stays in the sandbox for this phase.** The sending domain `tylerfuqua.com` and
  the admin address are verified identities, which is all sandbox mode needs to deliver
  to the admin. Production access is requested in Phase 3 when real members arrive.

## In scope

- `packages/shared`: zod schemas for `recipe` frontmatter, the document envelope, and
  the API request/response shapes. The single source of truth from this phase on.
- `infra`: a `TheKeepData` stack (Aurora Serverless v2 cluster, Data API on, Secrets
  Manager secret, min 0 / max 2 ACU) and a `TheKeepApi` stack (HTTP API with a Cognito
  JWT authorizer, Lambda handlers, Cognito user pool with the custom-auth triggers, SES
  domain identity with DKIM records in Route 53). CloudFront gains an `/api/*` behavior
  pointing at the HTTP API.
- Migrations: SQL files in `apps/api/migrations`, applied from the deploy workflow through
  the Data API. Tables: `document`, `version`, `attachment`, `member`, `agent_token`,
  shaped exactly as the brief's domain model. `agent_token` is created but unused.
- Documents API, admin-only for now: list, create, get, create version, list versions,
  get version, diff between two versions. Soft delete. Frontmatter validated server-side
  against the shared schema for the document's type.
- Identity and permission as two separate middlewares producing the brief's `caller`
  object; the permission middleware only knows rings and roles, nothing about Cognito.
- `apps/web`: sign-in (email, then code), recipe list, new recipe, edit (saves a new
  version with summary), version history, unified diff view. React Router, TanStack Query, react-hook-form +
  zod, the shadcn primitives the screens need and no more.
- Tests: handler tests with fake API Gateway events; data-layer tests against PGlite;
  web tests with MSW; CDK snapshots for both new stacks.
- Structured JSON logging in every Lambda and one CloudWatch dashboard (errors,
  duration, Aurora ACU).

## Out of scope

- Any ring other than `me`. No `group`, no `public`, no promotion, no share tokens.
- Agent tokens being issued, verified, or used. The table exists; nothing reads it.
- The Lambda authorizer, the `/api/agent/*` prefix, the MCP server.
- Document types other than `recipe`. The schema registry is built to take more; none
  are added.
- Attachment upload (presigned URLs) and recipe photos. The `attachment` table is
  created; no endpoint writes to it.
- Members other than the admin, the member allowlist UI.
- Google (or any social) federation, the managed-login hosted page, SES production
  access. All Phase 3.
- Public read path, CloudFront caching of API responses, SEO, the resume page.
- Design values: primary color, long-form typeface, radius, dark palette. The UI uses the
  neutral ramp and whatever shadcn ships. Dark mode plumbing exists; no palette.
- Structured ingredient diffs. Unified text diff of body plus a key-by-key frontmatter
  diff; revisit after five versions of chili, as the brief says.
- Search, tags UI, pagination beyond a simple limit.
- Backups beyond Aurora's default automated snapshots, point-in-time restore drills,
  multi-region anything.
- Observability beyond logs and the one dashboard. No tracing, no alarms other than
  billing.

## Decisions from the brief this phase touches

- Backend: TypeScript on Node 22, Lambda behind API Gateway HTTP API.
- Database: PostgreSQL; versioned documents are relational. (Instance type amended above.)
- Object storage: S3 keys referenced from Postgres; no blobs in the database.
- Auth (people): Cognito user pool; allowlist table decides roles. (Google federation
  deferred to Phase 3; the brief's email-code fallback is built now because the admin
  needs it.)
- Monorepo: `apps/api` and `packages/shared` are created in this phase.
- Domain model: `document`, `version` (append-only), `attachment`, `member`,
  `agent_token`, exactly as specified. Promotion is a document-level change.
- Auth and access rings: identity and permission are separate middlewares; the `caller`
  object shape `{ kind, id, role?, scopes? }`.
- Guardrails: schema in `packages/shared` first, then migration, then renderer. Every
  Lambda has a handler test; every stack a snapshot test. No `cdk deploy` locally.

## Deliverables

Each is one PR, in this order; later ones depend on earlier ones.

- [x] **Shared package.** `packages/shared` with the document envelope, `recipe`
      frontmatter schema, a `schemaFor(type)` registry, and API DTOs. Vitest tests for the
      schemas. Consumed by nothing yet.
- [x] **Data stack.** `TheKeepData`: Aurora Serverless v2 cluster (PostgreSQL 16, min 0,
      max 2 ACU, Data API enabled, deletion protection on), Secrets Manager secret, SSM
      parameters for the cluster ARN and secret ARN. Snapshot test. Deploy role gains
      `rds-data:*` on the cluster and `secretsmanager:GetSecretValue` on the secret.
- [x] **Migrations.** `apps/api/migrations/0001_spine.sql` creating the five tables with
      their constraints (append-only `version` via a trigger that rejects UPDATE/DELETE),
      a tiny runner that applies pending files through the Data API and records them in
      `schema_migration`, and a deploy-workflow step that runs it after `cdk deploy`.
- [x] **Data layer.** Drizzle schema matching the migration, repository functions for
      documents and versions, tests on PGlite. The Data API driver in production, PGlite
      in tests, same queries.
- [x] **Auth stack.** Cognito user pool (email as username, no self sign-up, custom auth
      flow enabled), the admin user created by CDK, an app client allowing only
      `CUSTOM_AUTH` and refresh, and three trigger Lambdas: define challenge, create
      challenge (generate a six-digit code, send it through SES, keep the hash in private
      challenge parameters), verify challenge. Handler tests with fake trigger events.
      Snapshot test.
- [x] **Email identity.** SES domain identity for `tylerfuqua.com` with DKIM CNAMEs and
      a MAIL FROM subdomain in Route 53 via CDK; the admin address verified as a sandbox
      recipient (Tyler clicks the verification link once). A plain-text code email with
      no links.
- [x] **API stack and handlers.** HTTP API with JWT authorizer, `/api/*` routes, one
      Lambda per resource (`documents`, `versions`, `me`), identity + permission
      middlewares, structured logger. Handler tests with fake events. CloudFront `/api/*`
      behavior with caching disabled and the authorization header forwarded.
- [x] **Diff endpoint.** `GET /api/documents/:id/diff?from=&to=` returning a unified diff
      of `body` and a key-level diff of `frontmatter`, computed server-side with the
      `diff` package. Tests.
- [x] **Web: auth and shell.** Sign-in screen (email, then code) driving Cognito's
      `InitiateAuth` / `RespondToAuthChallenge` with the `CUSTOM_AUTH` flow through
      `@aws-sdk/client-cognito-identity-provider`, tokens held in memory with refresh,
      a protected route wrapper, the top-nav AppShell, the typed fetch client, and the
      `me` query. The custom test `render` grows the QueryClient, router and a fake auth
      provider.
- [x] **Web: recipes.** List, create, edit-as-new-version with a summary field, history,
      diff view. Forms from the shared schema via `zodResolver`. MSW tests for each
      screen.
- [x] **Dashboard and logs.** CloudWatch dashboard with Lambda errors and duration, API
      4xx/5xx, Aurora ACU utilization. Log retention set on every function.
- [ ] **Gate check.** Chili, twice, diffed, in production. Record the date here.

## Decided during implementation (Oct 26, 2026)

Routine calls made while building, recorded here so no later session relitigates them.
Each is reversible unless marked.

- **Aurora:** PostgreSQL 16.9, max 2 ACU, five-minute auto-pause, 7-day backups,
  `postgresql` log export kept a month, storage encrypted. Isolated subnets only, no NAT.
  The deploy role's Data API and secret grants are attached from `TheKeepData`, so the
  account stack needs no local redeploy. Availability zones are pinned to `us-east-1a/b`
  and the AZ list is cached in `infra/cdk.context.json` so synth needs no account lookup.
- **Array columns are jsonb** (`document.tags`, `agent_token.scopes`): the RDS Data API
  cannot bind PostgreSQL array parameters. Not reversible without a migration.
- **`document (type, slug)` is unique across live and deleted rows**; a reused title gets
  `-2`, `-3`. Not reversible without a migration.
- **Timestamps** leave the data layer as ISO 8601 with millisecond precision whatever the
  driver returns.
- **Drizzle** for the data layer, Data API driver in production and PGlite in tests, with
  the migration SQL hand-written and the Drizzle schema checked against it by the tests.
- **The admin `member` row is seeded by migration `0002`**; the same address is in
  `infra/lib/config.ts` for the Cognito user.
- **Cognito:** Lite feature plan, email as username, no recovery, no hosted UI, the web
  client allows `CUSTOM_AUTH` and refresh only. Access and id tokens live one hour, the
  refresh token thirty days. The id token is the API bearer because it carries the
  verified `email` claim the identity middleware needs.
- **Code email:** sender `The Keep <keep@tylerfuqua.com>`, subject
  "`<code> is your sign-in code for The Keep`", plain text, no links. A wrong answer
  reuses the unexpired code rather than sending another email. Ten minutes, three
  attempts, as flagged below.
- **Lambdas:** Node 22 on arm64, 512 MB (256 MB for the triggers), 10 s timeout (30 s for
  the API handlers so the first request after a pause can wait for the cluster), ESM
  bundles with the SDK included, source maps on, log retention one month.
- **Routes and codes:** `POST` returns 201 with the created record, `DELETE` 204,
  validation 400 with field issues, unknown member 403, missing document 404. The diff
  route lives on the versions Lambda.
- **Diff rendering:** the server's unified diff is colored line by line on the client; no
  diff library ships to the browser. Markdown bodies render as preformatted text until
  a renderer earns its place.
- **Tokens are held in memory only**, as specified; a page reload asks for a new code.
  Persisting the refresh token is a Phase 3 question when real members arrive.
- **Tags live on the document envelope**, not the recipe frontmatter, following the
  domain model over the type table.

## Before the first deploy

Merging this phase to `main` is the confirmation the directive asks for before the first
`TheKeepData` deploy: the cluster (deletion protection on, retained on stack delete) and
the Cognito pool (retained) are created by that merge.

After the deploy: SES emails `tyler.fuqua@icloud.com` one verification link; click it
before trying to sign in. If the first `InitiateAuth` refuses the admin user because it
sits in `FORCE_CHANGE_PASSWORD` status after `AdminCreateUser`, the one-time fix is
`aws cognito-idp admin-set-user-password --permanent` with any throwaway password; no
password flow is enabled on the client, so it can never be used to sign in.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- Confirmation before the first `TheKeepData` deploy, since the cluster is the first
  resource with a meaningful hourly cost and a deletion-protection flag.
- One click from Tyler: the SES verification email for `tyler.fuqua@icloud.com` that
  arrives after the email-identity PR deploys.
- The code's lifetime and attempt limit if they should differ from the defaults flagged
  in the auth PR (10 minutes, 3 attempts).
- Table or column renames after the first migration ships. Migrations are append-only
  from then on.

**Decide and flag in the PR description:**

- Exact Aurora engine version, max ACU, backup retention, log exports.
- Drizzle vs. hand-written SQL for the data layer (Drizzle is the default above).
- Cognito token lifetimes, the app client's auth flows, the code email's sender name
  and wording.
- Lambda memory, timeout, bundling options, log retention days.
- Route shapes and status codes within the brief's `/api/documents` family.
- Slug generation rule (kebab-case of the title, suffixed on collision).
- Diff rendering library on the client.
