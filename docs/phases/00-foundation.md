# Phase 0 · Foundation

Cites `docs/DESIGN.md`. Read it first.

## Gate

A merge to `main` is live at the real domain. Test: push a change to the static page's
text, watch GitHub Actions deploy, load the domain in a browser, see the new text.

## Blocked on Tyler

Two choices the brief reserves for Tyler must be made before the first CDK stack is
named. Nothing in this phase is pushed to AWS until they are filled in under "Yours to
decide" in `docs/DESIGN.md`.

- **Name and domain.** Stack names, the S3 bucket names and the Cognito domain prefix all
  derive from the name. The domain decides whether Route 53 hosts the zone or an existing
  registrar points at CloudFront.
- **AWS account.** New or existing, and whether it predates July 15, 2025 (legacy free
  tier). This decides the RDS choice in Phase 1, and the account ID goes into the OIDC
  trust policy here.

Until then, everything local in the checklist below can proceed.

## In scope

- Monorepo skeleton: pnpm workspaces, root `tsconfig` with the strict flags carried from
  the portal, Prettier, ESLint flat config, Vitest.
- `apps/web`: a Vite + React 19 SPA that renders a single page with Tyler's name. Tailwind
  v4 with the `@theme` block in `index.css` and the carried neutral ramp. No components
  beyond what the page needs.
- `infra`: CDK app with one stack for static hosting (S3 bucket, CloudFront distribution,
  SPA fallback via CloudFront Function, ACM certificate, DNS record) and one for account
  plumbing (GitHub OIDC role, billing alarm at $5). Snapshot test per stack.
- GitHub Actions: a PR workflow (test, lint, typecheck, `cdk diff` posted to the PR) and a
  `main` workflow (build web, `cdk deploy`, S3 double-sync with the carried cache rules,
  CloudFront invalidation). OIDC federation; no long-lived keys.
- `CLAUDE.md` and `docs/DESIGN.md` committed (done in the first PR of this phase).

## Out of scope

- Postgres, RDS, VPC, or any database decision beyond noting the account's free-tier
  status.
- Cognito, Google IdP, members, allowlists, or any login.
- Documents, versions, the shared zod package, or any API route. `apps/api` and
  `packages/shared` are not created in this phase.
- Agent tokens, the MCP server, the Lambda authorizer.
- Design values (primary color, typefaces, radius scale, dark palette). The page uses the
  neutral ramp only; identity lands in Phase 4.
- shadcn/ui components, forms, TanStack Query, React Router. A single static page needs
  none of them; install them when Phase 1 needs them.
- The CloudWatch dashboard and structured logging; there are no Lambdas yet.
- Hardcover, calendar, Daily Office, Ishar, or any feed.
- The SES email fallback for members without Google.
- Storybook, feature flags, Auth0, LaunchDarkly, or anything in the brief's "Leave
  behind" column.
- Anything that adds a monthly cost beyond Route 53's hosted zone and the domain itself.

## Decisions from the brief this phase touches

Do not relitigate these. See "Decisions made" in `docs/DESIGN.md`.

- Frontend: TypeScript, React 19, Vite, Tailwind v4.
- Static hosting: S3 + CloudFront, SPA fallback via CloudFront Function.
- Infrastructure as code: AWS CDK in TypeScript, in the same repo, `cdk diff` on every PR.
- CI/CD: GitHub Actions, OIDC federation to AWS, deploy on merge to `main`.
- Monorepo: pnpm workspaces `apps/web`, `apps/api`, `packages/shared`, `infra`.
- Formatting: Prettier + ESLint flat config from day one.
- Testing: Vitest for web, CDK snapshot tests for infra.
- Budget is a feature: billing alarm at $5 before any application code.
- Conventions carried from the config portal: `@theme` token block, neutral ramp, strict
  `tsconfig` flags, `cn()` and `@/` alias, fontsource font, S3 double-sync recipe,
  three-job CI shape.

## Deliverables

Each is one PR.

- [ ] **Docs.** `CLAUDE.md`, `docs/DESIGN.md`, this directive.
- [ ] **Workspace skeleton.** `pnpm-workspace.yaml`, root `package.json` with `test`,
      `lint`, `format:check`, `typecheck` scripts, shared `tsconfig.base.json`, Prettier
      config, ESLint flat config, `.gitignore`, `.nvmrc` pinned to Node 22, `.editorconfig`.
- [ ] **Web app.** `apps/web` with Vite, React 19, Tailwind v4 `@theme` block, one page
      with Tyler's name, one RTL smoke test using the custom `render` helper, fontsource
      Source Sans 3.
- [ ] **CDK app and account stack.** `infra` with the CDK app, the account stack (GitHub
      OIDC provider and deploy role scoped to this repo and the `main` branch, billing
      alarm at $5 to an SNS topic emailing Tyler), snapshot test. Bootstrap instructions
      in `infra/README.md`; the bootstrap itself is a one-time manual step Tyler runs.
- [ ] **Static site stack.** S3 bucket (private, OAC), CloudFront distribution, SPA
      fallback CloudFront Function, ACM certificate in us-east-1, Route 53 record,
      snapshot test. Stack and resource names derive from the chosen site name.
- [ ] **PR workflow.** GitHub Actions: install, test, lint, typecheck, `cdk synth`,
      `cdk diff` against the deployed stacks with the diff posted as a PR comment.
- [ ] **Deploy workflow.** On merge to `main`: build web, `cdk deploy --all
      --require-approval never`, double-sync to S3 (no-cache on root files, immutable on
      `assets/*`), CloudFront invalidation.
- [ ] **Gate check.** Change the page text, merge, confirm live at the domain. Record the
      date in this file.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- Site name and domain (above).
- AWS account and region. Recommendation: `us-east-1` so the ACM certificate for
  CloudFront needs no cross-region wiring.
- The email address for the billing alarm.
- Whether the domain's DNS moves to Route 53 or stays at the current registrar.

**Decide and flag in the PR description:**

- Exact pinned versions of CDK, Vite, React, Tailwind, Vitest, ESLint, Prettier.
- Bucket naming, CloudFront price class (use `PriceClass_100`), log retention.
- OIDC role name and the precise `sub` condition on the trust policy.
- Whether `cdk diff` output posts as a sticky comment or a fresh one per push.
- Layout of `infra/` (one `bin/` entry, `lib/` per stack, `test/` snapshots).
