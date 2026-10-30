# The Keep — Design values

Oct 30, 2026 · Tyler, with a long conversation about taste and a shorter one about tokens.
Fills the "Yours to decide" checklist in `docs/DESIGN.md`. These are values, not
implementation; `apps/web/src/index.css` encodes them as tokens in Phase 3.

## Who it is for

Tyler, every morning. Everyone else visits: the small group weekly, family a few times a
year, a recruiter a few times a decade. The logged-in app is the product; the public face is
a veneer on it. That inverts the brief's weighting of Phase 4 (see `docs/phases/03-face.md`).

## References

- **Discipline: Standard Ebooks.** Typography is the product. Cream on charcoal, a strict
  measure, nothing decorative, still generous. If an element would not survive on one of
  their pages, ask why it is on ours.
- **Ownership: A Working Library.** One person's reading log and essay archive, tended for
  years. Warm paper, serif, no chrome. A visitor knows whose house it is at once.
- **Rubric: the 2019 Book of Common Prayer.** One color means _do this_; black means _read
  this_. That is the accent policy in a sentence. Rubrics are rare on a page; so is the
  accent.
- **Anti-reference: Linear and Vercel's dark.** Excellent, and what a 32-year-old engineer
  builds by reflex.

## Mode

Design dark first: it is harder and exposes bad contrast decisions. Ship the system
preference (`prefers-color-scheme`) with a remembered manual toggle. Light is paper, a real
sibling, not an inversion. (Tyler's first instinct was dark as the shipped default; the
kitchen at 6:30 and every visitor on a phone argued otherwise.)

## Palette

Warm comes from cream text and a brass accent, not from caramel backgrounds: the hue shift
on the darks is tiny and the saturation low. Contrast checked Oct 30 (WCAG, body text).

### Dark, designed first

| Token          | Value     | Notes                                | On bg  |
| -------------- | --------- | ------------------------------------ | ------ |
| bg             | `#171310` | warm near-black, not pure            |        |
| surface        | `#221D18` | cards, the Office panel              |        |
| surface-raised | `#2B2520` | popovers, only when something floats |        |
| text           | `#EDE4D8` | cream                                | 14.7:1 |
| text-strong    | `#FAF4EA` | headings, the collect                | 16.9:1 |
| muted          | `#A69A8A` |                                      | 6.7:1  |
| border         | `#3A322A` | hairlines                            |        |
| border-strong  | `#4E443A` | focused inputs, table rules          |        |
| accent         | `#D9A441` | brass                                | 8.2:1  |
| accent-hover   | `#E6B556` | lighten on hover (dark convention)   | 9.8:1  |
| accent-active  | `#C08F32` | darken on press                      | 6.4:1  |
| on-accent      | `#171310` | text on a brass control              | 8.2:1  |

### Light, paper

| Token          | Value     | Notes                                                                                      | On bg  |
| -------------- | --------- | ------------------------------------------------------------------------------------------ | ------ |
| bg             | `#F7F2E9` | warm paper                                                                                 |        |
| surface        | `#FFFDF8` | cards sit slightly whiter                                                                  |        |
| surface-raised | `#FFFFFF` |                                                                                            |        |
| text           | `#221D18` |                                                                                            | 15.0:1 |
| text-strong    | `#171310` |                                                                                            | 16.6:1 |
| muted          | `#6B6156` |                                                                                            | 5.4:1  |
| border         | `#E2D9CC` |                                                                                            |        |
| border-strong  | `#C9BEAE` |                                                                                            |        |
| accent         | `#8A5E18` | brass darkened for paper                                                                   | 5.1:1  |
| accent-hover   | `#A5711F` | **3.8:1: fine on a filled control, too faint as link text; the token PR nudges it darker** |        |
| accent-active  | `#704C12` |                                                                                            | 6.9:1  |
| on-accent      | `#FFFDF8` | text on a brass control                                                                    | 5.6:1  |

### Rules

- The accent is text, a hairline, or one filled control. It never tints a surface: no
  "brass-50" card backgrounds.
- One separate semantic for _something is wrong_, a muted oxblood, used so rarely that
  seeing it means something. Never red.
- The diff colors (added, removed) are the one place a second and third hue may appear,
  and only on diff screens.

## Type

- **Long-form** (recipes, essays, briefs, the Office): **Literata**, variable, optical size
  axis on, body 18px / 1.6, measure capped at 65ch, italic for headnotes and asides. Drawn
  for screen reading, sturdy at 400 on dark, one of the best free italics.
- **UI:** **Source Sans 3** stays, 14–15px, because it is not Inter: humanist, slightly
  warm, good tabular figures. Tabular figures for times, dates and quantities; no mono in a
  kitchen.
- **Mono** (diffs only): Source Code Pro, to stay in family.
- Both long-form and UI faces self-hosted through fontsource, as today.

## Radius

A keep is square. Small radii read as print and architecture; large ones as consumer
software.

- `radius-sm` 2px: tags, chips, inline code
- `radius-md` 4px: inputs, buttons
- `radius-lg` 8px: cards, dialogs
- `radius-full`: avatars only, never buttons
- Nested: inner radius = outer radius − padding, so a 4px button inside an 8px card with
  4px padding looks concentric rather than wobbly.

## Recipe taxonomy

The test for a facet: would you filter on it at 4pm deciding dinner, or on Wednesday
deciding what to bring Thursday? Facets are controlled vocabularies and live on the
document as namespaced tags (`course:main`), since they do not change from version to
version. Flags are tags too. Fields live in frontmatter and are versioned.

| Facet           | Values                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| course          | breakfast, main, side, soup & stew, bread, dessert, drink, sauce & condiment, snack                                       |
| main ingredient | chicken, beef, pork, lamb, fish & shellfish, eggs, beans & legumes, pasta & grains, vegetables, fruit                     |
| effort          | weeknight (under 45 min, one pan's attention), weekend (an afternoon), project (multi-day, a starter, a cure), make-ahead |
| technique       | skillet, roast, braise, grill, slow cooker, pressure cooker, bake, no-cook, ferment & preserve                            |
| season          | spring, summer, fall, winter, any                                                                                         |
| occasion        | family table, small group, holiday, guests, cookoff                                                                       |

- **Flags:** kid-approved, vegetarian, gluten-free (the sign-up layer will need these).
- **Fields (frontmatter, versioned):** `activeMinutes`, `totalMinutes` (replacing
  `prepMinutes` / `cookMinutes`: a schema-shape question for Tyler in the Phase 3
  directive), `provenance` (John, Mom, a book: displayed, never filtered), and `proven`,
  whether _this version_ has actually been cooked.
- "Time" fails as a facet (it is a number) and passes as effort.
- Search is full text over titles, tags and bodies, so "Saturday morning breakfast ideas"
  is `course:breakfast` plus words.

## The morning page

Not a dashboard with a prayer widget: a page. One column, a reading measure, read top to
bottom. Order is theology.

1. **The day.** Date, liturgical day and season, sunrise, the weather in one line. The
   header a prayer book has.
2. **The Office**, inline, readings included, no link-out. The only accented element on
   the screen; the layout makes it plain that the rest waits. (Source for the lectionary
   is the brief's open question; until a direct source earns its place, Duet carries the
   readings as a section of the brief.)
3. **The brief.** Three things at most, in Tyler's voice or Claude's. Not a feed.
4. **The day's shape.** Calendar, who is hosting Thursday, what is for dinner (where the
   facets pay off).

**Never:** counts or badges of any kind; an inbox; news; streaks or any gamified
faithfulness; Ishar's error rates or anything operational; the resume or any
recruiter-facing surface; progress bars from Hardcover; red; a greeting by name; more than
one accented element; urgency. If something needs Tyler at 6:30, it is not The Keep's job
to say so.

## Navigation

Places, not verbs: the brief's "verbs over views" is a rule about which features earn
their keep, not about nav labels. A daily tool wants places you return to, named for what
lives there (Home, Recipes, Writing, Group, and an Admin group gated by role), with the
verbs on the pages: one obvious action each, a search box, and a "New" that knows what type
it is looking at.
