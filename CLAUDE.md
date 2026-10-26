# Command Center

A personal system of record on AWS. The design brief at `docs/DESIGN.md` is the
constitution: its "Decisions made" are constraints, not suggestions. Each phase has a
directive under `docs/phases/` that states the gate, the scope, and the deliverables.
Read the current phase's directive before starting work.

## Layout

pnpm workspaces, TypeScript everywhere, Node 22.

- `apps/web` — React 19 + Vite SPA (Tailwind v4, shadcn/ui on Radix, TanStack Query,
  React Router, react-hook-form + zod).
- `apps/api` — Lambda handlers behind API Gateway (HTTP API).
- `packages/shared` — zod schemas shared by client, server and MCP. The single source of
  truth for every document type.
- `infra` — AWS CDK stacks in TypeScript.

Not every directory exists until the phase that creates it.

## Commands

```sh
pnpm install
pnpm test          # Vitest across workspaces; CDK snapshot tests live in infra
pnpm lint          # ESLint flat config
pnpm format:check  # Prettier
pnpm typecheck
pnpm -C infra cdk synth
pnpm -C infra cdk diff
```

## Rules that hold on every turn

- **Never run `cdk deploy` locally.** Deploys happen from `main` through GitHub Actions
  (OIDC to AWS). Local sessions run `cdk synth` and `cdk diff` only.
- **Never commit secrets, `.env` files, or AWS credentials.** Configuration comes from CDK
  outputs and SSM parameters.
- **Schemas first.** A new document type is a zod schema in `packages/shared`, then a
  migration, then a renderer. Never the reverse.
- **No agent path promotes a document to `public`.** Promotion to a wider ring is a human
  click in the admin UI. Agent tokens carry scopes; none grants promotion, member
  management or token management.
- **Tokens only in styling.** Semantic Tailwind tokens from the `@theme` block in
  `index.css`; no raw palette classes, no inline radius or color.
- **Tests travel with code.** Every Lambda gets a handler test with a fake event; every
  CDK stack gets a snapshot test.
- **Decide and flag.** Make routine calls and note them in the PR description. Ask Tyler
  only when a choice cannot be undone: schema shape, token format, a public URL.
- **Prefer deletion.** If a feature is unused or a phase's gate stops being true, say so.
