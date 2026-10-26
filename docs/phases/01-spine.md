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

- [ ] **Shared package.** `packages/shared` with the document envelope, `recipe`
      frontmatter schema, a `schemaFor(type)` registry, and API DTOs. Vitest tests for the
      schemas. Consumed by nothing yet.
- [ ] **Data stack.** `TheKeepData`: Aurora Serverless v2 cluster (PostgreSQL 16, min 0,
      max 2 ACU, Data API enabled, deletion protection on), Secrets Manager secret, SSM
      parameters for the cluster ARN and secret ARN. Snapshot test. Deploy role gains
      `rds-data:*` on the cluster and `secretsmanager:GetSecretValue` on the secret.
- [ ] **Migrations.** `apps/api/migrations/0001_spine.sql` creating the five tables with
      their constraints (append-only `version` via a trigger that rejects UPDATE/DELETE),
      a tiny runner that applies pending files through the Data API and records them in
      `schema_migration`, and a deploy-workflow step that runs it after `cdk deploy`.
- [ ] **Data layer.** Drizzle schema matching the migration, repository functions for
      documents and versions, tests on PGlite. The Data API driver in production, PGlite
      in tests, same queries.
- [ ] **Auth stack.** Cognito user pool (email as username, no self sign-up, custom auth
      flow enabled), the admin user created by CDK, an app client allowing only
      `CUSTOM_AUTH` and refresh, and three trigger Lambdas: define challenge, create
      challenge (generate a six-digit code, send it through SES, keep the hash in private
      challenge parameters), verify challenge. Handler tests with fake trigger events.
      Snapshot test.
- [ ] **Email identity.** SES domain identity for `tylerfuqua.com` with DKIM CNAMEs and
      a MAIL FROM subdomain in Route 53 via CDK; the admin address verified as a sandbox
      recipient (Tyler clicks the verification link once). A plain-text code email with
      no links.
- [ ] **API stack and handlers.** HTTP API with JWT authorizer, `/api/*` routes, one
      Lambda per resource (`documents`, `versions`, `me`), identity + permission
      middlewares, structured logger. Handler tests with fake events. CloudFront `/api/*`
      behavior with caching disabled and the authorization header forwarded.
- [ ] **Diff endpoint.** `GET /api/documents/:id/diff?from=&to=` returning a unified diff
      of `body` and a key-level diff of `frontmatter`, computed server-side with the
      `diff` package. Tests.
- [ ] **Web: auth and shell.** Sign-in screen (email, then code) driving Cognito's
      `InitiateAuth` / `RespondToAuthChallenge` with the `CUSTOM_AUTH` flow through
      `@aws-sdk/client-cognito-identity-provider`, tokens held in memory with refresh,
      a protected route wrapper, the top-nav AppShell, the typed fetch client, and the
      `me` query. The custom test `render` grows the QueryClient, router and a fake auth
      provider.
- [ ] **Web: recipes.** List, create, edit-as-new-version with a summary field, history,
      diff view. Forms from the shared schema via `zodResolver`. MSW tests for each
      screen.
- [ ] **Dashboard and logs.** CloudWatch dashboard with Lambda errors and duration, API
      4xx/5xx, Aurora ACU utilization. Log retention set on every function.
- [ ] **Gate check.** Chili, twice, diffed, in production. Record the date here.

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
