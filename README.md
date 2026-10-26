# The Keep

A personal system of record on AWS, living at [tylerfuqua.com](https://tylerfuqua.com).

- `docs/DESIGN.md` is the design brief and the constitution for the project.
- `docs/phases/` holds one directive per phase, each with a gate that must be true in production.
- `CLAUDE.md` is the one-page guide every working session reads first.

## Working locally

```sh
pnpm install
pnpm test
pnpm lint
pnpm format:check
pnpm typecheck
```

Deploys happen from `main` through GitHub Actions. See `infra/README.md` for the one-time
account setup.
