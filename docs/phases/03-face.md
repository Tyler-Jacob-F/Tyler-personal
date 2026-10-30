# Phase 3 · Face

Cites `docs/DESIGN.md` and `docs/DESIGN-VALUES.md`. Read both, then
`docs/phases/02-agents.md`, whose "Decided during implementation" and handoff sections say
what exists. The design contract is decided; this directive says how it lands on a codebase
that already has three phases behind it. Reference renders are in `docs/design/`; match
them.

## Why this phase is here

The brief's roadmap put the group ring third. Tyler's answer to "who is this for" (Oct 30)
was: himself, every morning; everyone else visits. The logged-in app is the product.
Building the group's screens on a nav that cannot take a fifth item, a palette nobody
chose and a recipe list nobody can search would compound debt where it is dearest, so the
flag goes in first. The brief's table was reordered in the same PR as this directive
(Face, Group, Public face, Feeds).

## Gate

Signed in at https://tylerfuqua.com on a phone in the morning: the home is the morning
page in the dark palette, paper when the phone says so, with no flash of the wrong theme;
"Saturday morning breakfast ideas" finds the breakfast recipes by facet and by words; the
nav reaches every place in two taps; every recipe imported in Phase 2 carries its facets;
`grep -rE "#[0-9a-fA-F]{6}" apps/web/src` returns only the theme file. All of it through
CI.

## Decided (Oct 30, 2026)

- **The design contract is `docs/DESIGN-VALUES.md`**, written in a Claude Design session
  from Tyler's answers. Values are not reopened here; a change goes through that file
  first.
- **Token names change to the contract's.** The Phase 0 names were placeholders for
  Tailwind's neutral ramp. The migration is mechanical and lands in one PR:

  | Phase 0–2 token           | Face token         | Note                                          |
  | ------------------------- | ------------------ | --------------------------------------------- |
  | `background`              | `bg`               |                                               |
  | `foreground`              | `text`             | plus `text-strong` for headings               |
  | `muted` (a surface tint)  | `surface`          | hover fills, chips, the Office panel          |
  | `muted-foreground`        | `muted`            | the text color; the name finally means it     |
  | `border`                  | `border`           |                                               |
  | `input`                   | `border-strong`    | focused inputs, table rules                   |
  | `disabled`                | removed            | opacity on the control instead                |
  | `destructive` (+ subtle)  | `wrong`            | the only error color; also removed diff lines |
  | `success` (+ subtle)      | `success`          | kept for added diff lines only                |
  | `highlight` (+ subtle)    | `accent`           | the Stack page's traced request is the accent |
  | `radius-control`, `-card` | `sm` / `md` / `lg` | 2 / 4 / 8px; `full` for avatars               |

  `surface-raised`, `accent-hover`, `accent-active`, `on-accent` are new.

- **Fonts:** Literata (variable, with `opsz`) for long-form, Source Sans 3 for UI, Source
  Code Pro for diffs, all through fontsource as today.
- **Theme:** the `data-theme` attribute Phase 0 wired is the mechanism. Default follows
  `prefers-color-scheme`; the toggle sets `data-theme` and persists it in `localStorage`;
  an inline script before paint applies the stored or preferred theme so nothing flashes.
- **Recipe fields:** `activeMinutes`, `totalMinutes`, `serves`, `provenance`, `proven`
  replace `prepMinutes`, `cookMinutes`, `servings`. The contract names them and the
  database holds no values for the old ones (the chili lineage stored none; the Oct 30
  import kept ranges in the text), so the schema simply changes; the form, the MCP guide
  and the import runbook follow. A schema-shape change, taken from the contract Tyler
  approved.
- **Facets and flags are document tags**, namespaced (`course:main`, `flag:vegetarian`),
  validated against the vocabulary in `packages/shared`; `proven` is frontmatter because it
  is true of a version. Tags were already on the envelope; nothing read them until now.
- **The morning page is built in this phase, not placeholdered.** Its Office slot renders
  the brief's "Office" section (Duet carries the readings) until a lectionary source earns
  a direct feed; the day line comes from the brief too. The page's shape and its "never"
  list are the contract's.
- **No UI library, icon package or CSS framework beyond Tailwind v4.** Icons are inline
  stroke SVG. shadcn-style primitives are written from spec, as before.
- **A fifth MCP tool, `set_tags`** (Tyler, Oct 30): the tagging pass over the Phase 2
  import changes document tags, not versions, and the brief's four tools cannot say that.
  It takes a document id and the full tag set, validates facets against the vocabulary,
  needs the write scope for the document's type, and is logged as agent activity without
  a version (the admin view gains a "tagged" row kind). Agents still cannot touch the
  ring.
- **Renders:** the morning page exists in all four forms (`docs/design/`); the recipe
  page, the recipes list and the nav have specs but no render. Build those from the spec
  and the morning page's idiom; do not wait on a render.

## In scope

- Tokens, fonts and the theme mechanism, with a test that fails on a hex literal outside
  `index.css` and a contrast test over the palette.
- Primitives restyled: Button (outline default, one filled accent variant, icon-only with
  `aria-label`), Input, Textarea, Label, Form, and a new Chip. Touch targets ≥ 44px.
- The nav of the contract: places, search entry, type-aware New, theme toggle, sign-out,
  phone sheet; Admin gated by role (the `me` query's role, which the shell can now afford
  to fetch once).
- Recipe taxonomy: vocabulary schema, tag validation on write, the fields, the form, the
  MCP guide, a tagging pass over the Phase 2 import through the MCP server (a runbook and a
  session, like the import).
- Search: a `tsvector` over title, tags and body on `version`, maintained by trigger or
  generated column, one endpoint, and the Recipes list of the contract with facet filters.
- The morning page of the contract, replacing the Phase 2 home.
- The recipe page of the contract, the History and diff screens restyled to match.
- The Tokens, Activity, Stack and sign-in screens restyled with the primitives; no new
  behavior.
- Accessibility: every interactive element reachable by Tab with a visible focus ring in
  `border-strong`; Lighthouse accessibility ≥ 95 on the home page, checked by hand at the
  gate.

## Out of scope

- The group ring, members, surveys, sign-ups, share tokens, the calendar. Phase 4.
- The public read path, CloudFront caching, the resume, SEO, Writing as a type. Phase 5
  (the nav shows Writing and Group as places; until their phases they lead to a one-line
  "not yet" page).
- A lectionary feed, weather, sunrise or calendar fetched by the site itself. The brief
  carries those lines; a direct source is Phase 6's question.
- Renaming documents, bulk tag editing, a documents list across types beyond the home's
  recent list.
- Any agent path that promotes a ring, manages members or tokens. Never.

## Decisions from the brief this phase touches

- Frontend conventions: the `@theme` block as the single token source; semantic names
  only; dark mode via `@custom-variant dark` on `data-theme`; `--radius-*` tokens; the
  eyebrow recipe (its values change, the rule stands); self-hosted fonts via fontsource.
- Domain model: `document.tags` is where facets live; frontmatter is versioned and holds
  fields; schemas first, then migration, then renderer.
- "Verbs over views": each screen has one obvious action; the nav names places.
- Budget: nothing here adds a resource beyond a column and an index.

## Deliverables

Each is one PR, in this order. Later ones depend on earlier ones.

- [ ] **Tokens and fonts.** The `@theme` block with the contract's names and both palettes
      (dark on `:root` and under `[data-theme="dark"]`, light under `[data-theme="light"]`
      and as the `prefers-color-scheme: light` default), radii, font families; Literata and
      Source Code Pro added through fontsource with `font-display: swap`; a `tabular-nums`
      utility; every component's classes migrated per the table above; the hex-literal
      test and the contrast test. Snapshot of nothing: this is web only. Visual check
      against `docs/design/*-dark-*.png` and `*-light-*.png` by hand.
- [ ] **Theme switching.** The inline script before paint, the toggle component, the
      `localStorage` key (guarded, like the refresh token), MSW/RTL tests for default,
      toggle and persistence.
- [ ] **Primitives.** Button variants, icon buttons, Input, Textarea, Label, Form, Chip,
      focus rings, 44px targets. Tests per primitive.
- [ ] **Nav.** The top bar and the phone sheet of the contract; role-gated Admin; ⌘K
      opens search (the search screen lands two PRs later; until then it focuses the
      Recipes search field); "New" split by type. Tests for both widths and the gating.
- [ ] **Recipe schema.** `packages/shared`: the facet vocabulary, tag validation, the new
      fields, `proven`; the recipe guide for the MCP tools; the form; the server rejecting
      an unknown facet value. Tests. A `docs/runbooks/tag-recipes.md` with the session
      prompt that tags the Phase 2 import through the MCP server (document-level tag
      changes, not versions; add a `set_tags` tool if the directive's four cannot express
      it and flag it).
- [ ] **Search.** Migration `0005_search` (a `tsvector` column on `version` maintained by
      trigger, a GIN index), `GET /api/documents/search?q=&type=&tags=` on the documents
      Lambda and through the agent door and as a fifth MCP tool `search_documents`, the
      Recipes list of the contract with facet filters and inverted active chips. Handler,
      repository (PGlite supports `tsvector`), MSW and MCP tests.
- [ ] **Morning page.** The contract's four parts from the brief's sections, the accent
      exactly once, the "never" list honored, the reading measure. Replaces the Phase 2
      home. MSW tests, including a day with no brief.
- [ ] **Recipe page, history and diff.** The contract's recipe screen; "Changed in vN";
      proven and untested states; history and diff restyled with the two diff hues. MSW
      tests.
- [ ] **Stack, Tokens, Activity, sign-in.** Restyled with the primitives; the Stack page's
      agents lane copy updated for whatever this phase changed. Tests already exist.
- [ ] **Gate check.** On a phone, in the morning. Record the date here.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- A facet or flag value added or renamed after the tagging pass has run (tags are data).
- Anything the renders in `docs/design/` and the contract disagree on: the renders win on
  layout, the contract on values, and Tyler decides a real conflict.

**Decide and flag in the PR description** ("Decided without the brief", as the Design
session put it): spacing, breakpoints, copy, the exact light `accent-hover` for text links
(underline, per the contract), the search ranking, the `localStorage` key, font subsetting,
which SVG paths the icons use.

## Handoff

- Start from `main`; Phase 2's handoff still describes the deploy, the doors and the
  tokens. The Phase 2 import left 20 recipes with no facets; the tagging pass in the
  Recipe schema deliverable is how they get them, and it needs the `cowork` token with
  `write:recipes` (it has it) and a Claude session on Tyler's account.
- Reference renders: the morning page's four are in `docs/design/`; the other screens
  have none and are built from the spec. If Tyler exports more, they go in by the README's
  names and win on layout.
- Only Tyler does: the tagging session (from Cowork or Claude Code, with the runbook's
  prompt), the Lighthouse run at the gate, and the gate itself on his phone.
