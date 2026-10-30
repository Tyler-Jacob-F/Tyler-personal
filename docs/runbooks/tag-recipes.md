# Runbook · tag the recipes

The Phase 2 import left 20 recipes with no facets; the Face gate wants "Saturday morning
breakfast ideas" to find the breakfast recipes by facet and by words
(`docs/phases/03-face.md`). This pass gives every recipe its facets and flags through the
MCP server's `set_tags` tool. It changes document tags, not versions, so nothing in a
recipe's history moves; the Activity screen shows each change as a "tagged" row.

Only Tyler runs this, from Cowork or a Claude Code session on his account, with the
`claude` token (it has `read:documents` and `write:recipes`, which is all `set_tags` needs).

## What a tag is

Facets are controlled vocabularies, one value per facet per recipe, written
`namespace:value` (`docs/DESIGN-VALUES.md` "Recipe taxonomy"):

| facet       | values                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `course`    | breakfast, main, side, soup-stew, bread, dessert, drink, sauce-condiment, snack                 |
| `main`      | chicken, beef, pork, lamb, fish-shellfish, eggs, beans-legumes, pasta-grains, vegetables, fruit |
| `effort`    | weeknight, weekend, project, make-ahead                                                         |
| `technique` | skillet, roast, braise, grill, slow-cooker, pressure-cooker, bake, no-cook, ferment-preserve    |
| `season`    | spring, summer, fall, winter, any                                                               |
| `occasion`  | family-table, small-group, holiday, guests, cookoff                                             |

Flags are `flag:kid-approved`, `flag:vegetarian`, `flag:gluten-free`. `proven` is not a
tag: it is frontmatter, true of a version, and this pass leaves it alone. A tag with no
namespace is a free tag and is kept as it is. The server refuses anything else and names
what it would accept; the `set_tags` tool description carries the same vocabulary.

Adding or renaming a value after this pass has run is a question for Tyler: tags are data.

## The session

In Cowork, or in Claude Code with the `keep` server added (`docs/runbooks/import-recipes.md`
section 2 shows the one-line command), paste:

```text
Tag every recipe in The Keep through the "keep" MCP server. Read the set_tags tool
description for the vocabulary; it is the whole rule.

1. list_documents with type recipe, limit 100. For each recipe, get_document and read the
   title, ingredients and method.
2. For each, choose: course (always), main ingredient (when one ingredient plainly leads),
   effort (weeknight under an hour of mostly hands-off work; weekend for an afternoon;
   project for a day or an overnight step; make-ahead when it keeps or improves), technique
   (the one that defines it), season (any unless the recipe is tied to one), occasion (only
   when the text says so: a cook-off entry, a holiday dish, something for the small group).
   Flags only when the text plainly supports them: kid-approved if the recipe says the kids
   eat it, vegetarian if no meat or fish, gluten-free only if the recipe says so. Leave a
   facet out rather than guess. Keep any free tag the document already has.
3. Show me the plan as a table before changing anything: title, course, main, effort,
   technique, season, occasion, flags.
4. After I say go: set_tags on each document with its full set. If a call is refused, the
   message names the allowed values; fix the call and retry once, then stop and show me.
5. Finish with the same table, from list_documents, so I can see what landed.
```

Review the plan at step 3. The two chili documents (`steves-famous-chili`, `tylers-chili`)
are `course:main`, `main:beef`, `effort:project`, `technique:braise`, `season:fall`,
`occasion:cookoff` for Tyler's and `occasion:family-table` for Steve's; if the plan says
otherwise, the session is guessing.

## Check it worked

- https://tylerfuqua.com/recipes with "breakfast" in the search field, and with the Course
  filter set to Breakfast, both show the breakfast recipes.
- https://tylerfuqua.com/admin/activity lists one "tagged" row per recipe under `claude`.
- No recipe's History has a new version.
- Then tick the Recipe schema deliverable in `docs/phases/03-face.md`.

## When it misbehaves

- **`bad_request: invalid tags` naming a value**: the model used a word outside the
  vocabulary ("brunch"). The message lists what is allowed; the retry should use one.
- **`one value per facet`**: two values for one facet in a single call. Pick one; a recipe
  that is honestly both breakfast and dessert is `course:breakfast` with words in the body.
- **`forbidden: cannot write a recipe`**: the token lacks `write:recipes`. Edit scopes on
  its row on the Tokens screen; the new set applies on the next request.
- **A recipe was missed**: `list_documents` caps at 100 and the archive is 22 documents, so
  this is a skipped row, not a cap. Run `set_tags` for that one by hand.
- **The first call is a 500 or slow**: the database was paused and is waking. Try again.
