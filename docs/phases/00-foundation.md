# Phase 0 · Foundation

Cites `docs/DESIGN.md`. Read it first.

## Gate

A merge to `main` is live at the real domain. Test: push a change to the static page's
text, watch GitHub Actions deploy, load the domain in a browser, see the new text.

## Decided (Oct 26, 2026)

- **Name:** The Keep. Stack prefix `TheKeep`, Cognito domain prefix `thekeep` when Phase 1
  needs one.
- **Domain:** `tylerfuqua.com`, registered in Route 53, so the hosted zone, certificate
  validation and alias records all live in the site stack.
- **AWS account:** new account `697941679713`, created Oct 2026 (post-July-2025, so
  credits rather than the legacy free tier). Root email is a dedicated alias.
- **Region:** `us-east-1`, so the CloudFront certificate needs no cross-region wiring.
- **Billing guard:** AWS Budgets at $5/month (actual and forecasted) emailing Tyler,
  rather than a CloudWatch `EstimatedCharges` alarm, which would need the "receive billing
  alerts" toggle flipped by hand first.

All of it lives in `infra/lib/config.ts`.

## In scope

- Monorepo skeleton: pnpm workspaces, root `tsconfig` with the strict flags from
  the brief, Prettier, ESLint flat config, Vitest.
- `apps/web`: a Vite + React 19 SPA that renders a single page with Tyler's name. Tailwind
  v4 with the `@theme` block in `index.css` and the neutral ramp. No components
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
- Frontend conventions: `@theme` token block, neutral ramp, strict
  `tsconfig` flags, `cn()` and `@/` alias, fontsource font, S3 double-sync recipe,
  three-job CI shape.

## Deliverables

Each is one PR.

- [x] **Docs.** `CLAUDE.md`, `docs/DESIGN.md`, this directive.
- [x] **Workspace skeleton.** `pnpm-workspace.yaml`, root `package.json` with `test`,
      `lint`, `format:check`, `typecheck` scripts, shared `tsconfig.base.json`, Prettier
      config, ESLint flat config, `.gitignore`, `.nvmrc` pinned to Node 22, `.editorconfig`.
- [x] **Web app.** `apps/web` with Vite, React 19, Tailwind v4 `@theme` block, one page
      with Tyler's name, one RTL smoke test using the custom `render` helper, fontsource
      Source Sans 3.
- [x] **CDK app and account stack.** `infra` with the CDK app, the account stack (GitHub
      OIDC provider and deploy role scoped to this repo and the `main` branch, billing
      alarm at $5 to an SNS topic emailing Tyler), snapshot test. Bootstrap instructions
      in `infra/README.md`; the bootstrap itself is a one-time manual step Tyler runs.
- [x] **Static site stack.** S3 bucket (private, OAC), CloudFront distribution, SPA
      fallback CloudFront Function, ACM certificate in us-east-1, Route 53 record,
      snapshot test. Stack and resource names derive from the chosen site name.
- [x] **PR workflow.** GitHub Actions: install, test, lint, typecheck, `cdk synth`,
      `cdk diff` against the deployed stacks with the diff posted as a PR comment.
- [x] **Deploy workflow.** On merge to `main`: build web, `cdk deploy --all
--require-approval never`, double-sync to S3 (no-cache on root files, immutable on
      `assets/*`), CloudFront invalidation.
- [x] **Gate check.** Change the page text, merge, confirm live at the domain. Record the
      date in this file. **Gate true: Oct 26, 2026.** First deploy failed on the OIDC
      trust (GitHub's subject now carries numeric IDs); fixed, redeployed, confirmed in a
      browser at the apex, `www`, and a deep route.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- Site name, domain, AWS account, region, and the billing email: all answered above.
- The two one-time local actions in `infra/README.md` (CDK bootstrap, first deploy of
  the account stack) and the two GitHub Actions variables they produce.

**Decide and flag in the PR description:**

- Exact pinned versions of CDK, Vite, React, Tailwind, Vitest, ESLint, Prettier.
- Bucket naming, CloudFront price class (use `PriceClass_100`), log retention.
- OIDC role name and the precise `sub` condition on the trust policy.
- Whether `cdk diff` output posts as a sticky comment or a fresh one per push.
- Layout of `infra/` (one `bin/` entry, `lib/` per stack, `test/` snapshots).
