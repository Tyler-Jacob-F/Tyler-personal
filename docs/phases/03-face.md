# Phase 3 · Face

Cites `docs/DESIGN.md` and `docs/DESIGN-VALUES.md`. Read both, then
`docs/phases/02-agents.md`, whose "Decided during implementation" and handoff sections say
what exists. **Draft, Oct 30, 2026:** the gate and scope are set; the deliverables fill in
once the Claude Design session has drawn the four screens.

## Why this phase exists, and a proposed change to the roadmap

The brief's roadmap puts the group ring third and the public face fourth, and allows the
two to swap. Tyler's answer to "who is this for" (Oct 30) was: himself, every morning;
everyone else visits. The logged-in app is the product. Building the group's screens, and
then the public ones, on a nav that cannot take a fifth item, a palette nobody chose and a
recipe list nobody can search would compound debt where it is dearest. So this short phase
plants the flag first, and the roadmap becomes:

| Phase                 | Scope                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Phase 3 · Face        | Design values as tokens, dark and light, nav, taxonomy, search, the morning page              |
| Phase 4 · Group       | What the brief called Phase 3: group ring, members, surveys, sign-ups, share tokens, calendar |
| Phase 5 · Public face | What the brief called Phase 4: public read path, resume, essays and notes feeds               |
| Phase 6 · Feeds       | Hardcover, Ishar, calendar sync, whatever earns its place                                     |

Tyler confirms this table before the first PR; the brief's own table changes in that PR.

## Gate

Signed in at https://tylerfuqua.com on a phone in the morning: the home is the morning
page in the dark palette, light when the phone says so; "Saturday morning breakfast ideas"
finds the breakfast recipes by facet and by words; the nav reaches every place in two taps;
every recipe imported in Phase 2 carries its facets. All of it through CI.

## In scope

- Tokens: the palettes, type scale, radii and fonts of `docs/DESIGN-VALUES.md` in
  `index.css`; `prefers-color-scheme` with a remembered toggle; a linter test that every
  text and accent token clears AA on its backgrounds.
- Typography: Literata for long-form (recipes, briefs, essays to come), Source Sans 3 for
  UI, Source Code Pro for diffs; the measure.
- Navigation: places (Home, Recipes, Writing later, Group later, Admin gated by role), a
  search box, a type-aware "New".
- Taxonomy: the facet vocabulary in `packages/shared` as a schema; facets as namespaced
  tags on the document; flags; the recipe form and the MCP guide updated; a one-time
  tagging pass over the Phase 2 import (by an agent, through the MCP server, as a
  version-free document change).
- Search: a `tsvector` over title, tags and body; one endpoint; the Recipes screen becomes
  a filterable, searchable list.
- The morning page: the day, the Office slot, the brief (three things), the day's shape.
  The Office's lectionary source is decided or deferred here, not blocked on.
- Recipe page restyled on the new values; the diff screens keep their two hues.
- The Stack page keeps up.

## Out of scope

- The group ring, members, surveys, sign-ups, share tokens, the calendar. Phase 4.
- The public read path, CloudFront caching, the resume, SEO. Phase 5.
- Hardcover, Ishar, weather or sunrise feeds beyond a line Duet writes. Phase 6.
- A rename of recipe fields without Tyler's yes (below).
- Any agent path that promotes a ring, manages members or tokens. Never.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- The roadmap table above.
- Replacing `prepMinutes` / `cookMinutes` with `activeMinutes` / `totalMinutes` (a schema
  shape; the import stored no minutes, so the migration is cheap today and dear later).
- The lectionary source for the Office, or the decision to let Duet carry it for now.
- Approval of the Claude Design artboards before tokens are encoded.

**Decide and flag:** token names, the light hover brass (nudged darker than the values
sheet), the facet tag syntax, the search ranking, the toggle's storage, font subsetting.

## Deliverables

To be written from the Design session's four screens: the morning page, the recipe page,
the recipe list with facets and search, the nav, each in dark and light. One PR per
deliverable, as before.
