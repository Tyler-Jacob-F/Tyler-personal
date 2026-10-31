# The Keep — Design

tylerfuqua.com · a personal system of record, opened every morning; occasional visitors
(family, small group, recruiters).

**These values are decided. Implement them; do not reopen them. Changes go through this
file first.** Decided Oct 30, 2026 in a conversation about taste and a Claude Design
session; the reference renders live in `docs/design/`. This file fills the "Yours to
decide" checklist in `docs/DESIGN.md`; `apps/web/src/index.css` encodes it as tokens in
Phase 3 (`docs/phases/03-face.md`).

## Who it is for

Tyler, every morning. Everyone else visits: the small group weekly, family a few times a
year, a recruiter a few times a decade. The logged-in app is the product; the public face is
a veneer on it.

## References

- **Discipline:** Standard Ebooks. Typography is the product; cream on charcoal; nothing
  decorative.
- **Ownership:** A Working Library. A personal record tended for years, obviously one
  person's.
- **Rubric:** the 2019 Book of Common Prayer. One color means _do this_; black means _read
  this_.
- **Anti-reference:** Linear / Vercel dark.

## Mode

Dark is designed first. Ship `prefers-color-scheme` with a manual toggle, persisted. Light
is paper, not an inversion.

## Tokens

Semantic tokens only. No raw hexes in components.

| token            | dark      | light (paper) |
| ---------------- | --------- | ------------- |
| `bg`             | `#171310` | `#F7F2E9`     |
| `surface`        | `#221D18` | `#FFFDF8`     |
| `surface-raised` | `#2B2520` | `#FFFFFF`     |
| `text`           | `#EDE4D8` | `#221D18`     |
| `text-strong`    | `#FAF4EA` | `#171310`     |
| `muted`          | `#A69A8A` | `#6B6156`     |
| `border`         | `#3A322A` | `#E2D9CC`     |
| `border-strong`  | `#4E443A` | `#C9BEAE`     |
| `accent`         | `#D9A441` | `#8A5E18`     |
| `accent-hover`   | `#E6B556` | `#A5711F`     |
| `accent-active`  | `#C08F32` | `#704C12`     |
| `on-accent`      | `#171310` | `#FFFDF8`     |
| `wrong`          | `#C2655C` | `#7A2E28`     |

Contrast at body size, checked Oct 30: dark `text` 14.7:1, `muted` 6.7:1, `accent` 8.2:1
on `bg`; light `muted` 5.4:1, `accent` 5.1:1 on `bg`.

The diff screens keep their two hues for added and removed lines (`success`, `wrong`),
and only there.

### Accent rules

- The accent is text, a hairline, or one filled control. Never a tinted surface, never a
  border on a card, never three accented things in one container.
- On the morning page the accent appears exactly once.
- On paper, `accent-hover` is below 4.5:1 for small text: use it for filled controls only.
  Text links on paper hover by underline, not by color.
- `wrong` is the only error color. Rare enough that seeing it means something.

## Type

- **Long-form** (recipes, essays, briefs, the Office): Literata, variable,
  `font-optical-sizing: auto`. Body 18px / 1.6. Measure ≤ 65ch (`max-width: 42rem` on a
  reading column). Italic for headnotes and asides.
- **UI:** Source Sans 3, 14–15px. `font-variant-numeric: tabular-nums` on every time,
  date and quantity.
- **Mono:** Source Code Pro, in diffs only.
- **Eyebrows and section labels:** Source Sans 3, 12px, 600, uppercase,
  `letter-spacing: 0.14em`, `muted`.
- **Page titles:** Literata 30–36px, weight 500, `text-strong`, `letter-spacing: -0.01em`.

All three faces self-hosted as woff2 through fontsource with `font-display: swap`;
tabular figures available as a utility.

## Radius

- `sm` 2px: tags, chips, inline code
- `md` 4px: inputs, buttons
- `lg` 8px: cards, dialogs
- `full`: avatars only, never buttons
- Nested: inner radius = outer radius − padding.

## Components

shadcn-style primitives (Button, Input, Textarea, Label, Form) restyled to the tokens
above. Touch targets ≥ 44px. Real `<button>`, `<a href>`, `<input>` + `<label>`;
`aria-label` on icon-only buttons. Icons are inline stroke SVG, 1.75px, `currentColor`; no
icon font, no emoji. No UI library, icon package or CSS framework beyond Tailwind v4.

- **Buttons:** default is outline (`border-strong`, transparent, `text`); the single
  filled control on a page uses `accent` with `on-accent` text.
- **Chips:** 1px `border`, radius `sm`, 13px `muted`; a selected filter chip inverts to
  `text-strong` on `bg`.

## Nav

A top bar, 56px, not a sidebar. Wordmark "The Keep" in Literata 20/500. Places: Home,
Recipes, Writing, Group, Admin (Tokens, Activity) gated by role. Search reachable from
anywhere (⌘K on desktop; a field at the top of the phone sheet). "New" knows the current
type ("New recipe" on Recipes) with a split caret for other types. Theme toggle. Sign out.
On the phone the bar collapses to wordmark, search, New, and a menu button that opens a
sheet.

Places, not verbs: the brief's "verbs over views" is about which features earn their keep,
not about nav labels.

## Recipe taxonomy

Facets are controlled vocabularies; one value per facet per recipe. They live on the
document as namespaced tags (`course:main`), since they do not change from version to
version; flags are tags too. Fields live in frontmatter and are versioned.

- **Course:** breakfast, main, side, soup & stew, bread, dessert, drink, sauce & condiment,
  snack
- **Main ingredient:** chicken, turkey, beef, pork, lamb, fish & shellfish, eggs,
  beans & legumes, pasta & grains, vegetables, fruit (turkey added Oct 31, 2026, after the
  tagging pass: Tyler cooks it often and the pass had nowhere to put it)
- **Effort:** weeknight, weekend, project, make-ahead
- **Technique:** skillet, roast, braise, grill, slow cooker, pressure cooker, bake,
  no-cook, ferment & preserve
- **Season:** spring, summer, fall, winter, any
- **Occasion:** family table, small group, holiday, guests, cookoff

Flags (boolean): kid-approved, vegetarian, gluten-free, proven. Fields (not facets):
active minutes, total minutes, serves, provenance, version. `proven` is a fact about a
version (this one has been cooked) and lives in frontmatter; the others flags are tags.

Search is full text over titles, tags and bodies, so "Saturday morning breakfast ideas"
is `course:breakfast` plus words.

## The morning page

A page, not a dashboard: one column, reading measure, read top to bottom.

1. **The day:** date, liturgical day and season, sunrise, weather, in one line.
2. **The Office:** Morning Prayer inline, readings included; the only accented element on
   the page.
3. **The brief:** at most three items.
4. **The day's shape:** calendar, who hosts Thursday, dinner.

Never: counts or badges, an inbox, news, streaks, Ishar operational data, the resume,
progress bars, red, a greeting by name, more than one accented element, urgency.

The lectionary source for the Office is the brief's open question. Until a direct source
earns its place, Duet carries the readings as a section of the brief, and the page's Office
slot renders that section.

## Screens

Reference renders live in `docs/design/` as PNGs exported from the design canvas, one per
screen per mode per width (`<screen>-<mode>-<width>.png`, for example
`morning-dark-phone.png`). Match them.

1. **Morning page** (`/`): as above.
2. **Recipe** (`/recipes/:slug`): title; headnote in italic; provenance line; facets as
   quiet chips; active and total minutes in tabular figures; ingredient groups with
   headings; method as numbered markdown; a "Changed in vN" note; version line
   (`v4 · Tyler · written Nov 2025 · entered Oct 2026`) with a History link. "Proven" is a
   check plus the word in `text-strong` beside the times, with cook count and last date in
   `muted`; untested shows "Untested" in italic `muted`, no check.
3. **Recipes list** (`/recipes`): search at top; facet filters that work on a phone
   (accordion, one facet open) and as a rail on desktop (all expanded); active filters as
   inverted chips above results; results as a list with hairlines, not cards: title in
   Literata 19, facets in `muted` 13, total time right-aligned in tabular figures, a small
   check for proven.
4. **Nav:** as above; phone collapsed and open.

One breakpoint. Where possible, use flex-wrap with a minimum basis rather than a media
query (ingredients beside method; filters beside results).
