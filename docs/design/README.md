# Reference renders

PNGs from the Claude Design canvas, one per screen per mode per width, named
`<screen>-<mode>-<width>.png`: `morning`, `recipe`, `recipes`, `nav-collapsed`, `nav-open`;
`dark` or `light`; `phone` or `desktop`. `docs/DESIGN-VALUES.md` says what each must show.
The Face phase matches them; a later change to a screen starts with a new render here.
The renders win on layout, the contract on values.

## Present (Oct 30, 2026)

- `morning-dark-phone.png`, `morning-light-phone.png` (1170 px wide, the full page)
- `morning-dark-desktop.png`, `morning-light-desktop.png` (2560 px wide, the full page)
- `nav-collapsed-dark-phone.png`, `nav-open-dark-phone.png`, `nav-open-light-phone.png`,
  `nav-dark-desktop.png`, `nav-light-desktop.png` (the desktop pair shows the Admin menu
  open)
- `recipes-dark-phone.png`, `recipes-light-phone.png`, `recipes-dark-desktop.png`,
  `recipes-light-desktop.png` (the list, filtered to Breakfast)
- `recipe-dark-phone.png`, `recipe-light-phone.png`, `recipe-dark-desktop.png`,
  `recipe-light-desktop.png`
- `tokens.png`: the palette, type scale, radii and the accent rule, both modes side by side

## Present (Oct 31, 2026): the group

From `group.pdf`, the Design session for Phase 4 (`docs/phases/04-group.md`), rasterized
at 150 dpi and stitched the same way:

- `group-home-dark-phone.png`, `group-home-light-phone.png`, `group-home-dark-desktop.png`,
  `group-home-light-desktop.png`: the group home as a member who has claimed a name
  (Taylor) sees it: this week's questions, the sign-up with the one accent on the viewer's
  own "Release", the next meeting, the directory with "you" and "Edit your details"
- `group-home-guest-dark-phone.png`: the same page for a phone that holds the link but no
  name: "Tap your name first" carries the accent and the slot buttons repeat it in outline
- `claim-dark-phone.png`: "Who are you?", unclaimed names first, the claimed ones under
  "Already on another device" with a phone count, and the one confirmation
- `link-dark-phone.png`, `link-dead-dark-phone.png`: `/g/<token>` live ("You're in the
  group", Continue) and dead ("This link is no longer the group's")

The desktop artboards came through the PDF at page width (1275 px), narrower than the
morning page's; the layout is the reference, not the pixel size. The names, numbers and
addresses are sample content.

The morning renders were stitched from the canvas's PDF export, whose pages sliced each
artboard; the later four came as PDFs (`nav.pdf`, `recipes.pdf`, `recipe.pdf`,
`tokens.pdf`, kept here as the source) and were rasterized at 150 dpi and stitched the
same way, page margins trimmed at the joins. The content is sample content; the layout,
type, spacing and the one accented element are the reference.

## The mark

- `keep-mark.svg`: the mark, one path on a 64-unit grid, `fill="currentColor"`. Always
  `text-strong`, never the accent. The nav shows it at 20 px beside the wordmark and the
  favicon is cut from it.
- `keep-mark-16.svg`: the same silhouette with the loophole dropped, for 20 px and below.
- `keep-icon.svg`: the app icon and social tile, the dark mark on a brass ground with the
  8-unit radius. `apps/web/public/` carries the derived favicon and touch icon.

## Not rendered

The History and diff screens, Tokens, Activity, Stack and sign-in have no render; the Face
phase restyles them with the primitives and the idiom above. The group's Questions,
Sign-up, Calendar and Members pages, the edit forms behind the co-leads' controls, the
link panel and the co-lead sign-in have none either; the Group phase builds them from the
home's idiom.
