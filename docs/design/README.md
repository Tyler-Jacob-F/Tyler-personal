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

## Present (Nov 2, 2026): the group, refreshed

From `group.pdf`, Design's second pass at Phase 4 after the first week on real phones
(`group-directive.pdf` is the spec that came with it; `docs/phases/04-group.md` "The
refresh" records what was built from it), rasterized at 150 dpi and stitched the same way.
The Oct 31 renders are replaced: the home is organized around the week's guide now.

- `group-home-dark-phone.png`, `group-home-light-phone.png`, `group-home-dark-desktop.png`,
  `group-home-light-desktop.png`: the home on Thursday afternoon as a member who has
  claimed a name (Taylor) sees it: the meeting under its weekday, the sheet titled
  "Table" with the one accent on the viewer's own "Release", then the whole guide for
  the evening (opening prayer in two voices, Table, the collect before the reading, each
  reading with three verses and "Continue the reading", the reflection and numbered
  questions, the closing prayers), then the directory
- `group-home-guest-dark-phone.png`: the same afternoon for a phone that holds the link
  but no name: "Tap your name first" carries the accent and the slot buttons repeat it
- `group-tonight-dark-phone.png`: the same phone at 7:00 that evening: "Tonight" in one
  line, the guide first with its eyebrow as the page's one accent and who brought what at
  the Table, no sheet
- `claim-dark-phone.png`, `link-dark-phone.png`, `link-dead-dark-phone.png`: as before

The desktop artboards came through the PDF at page width (1275 px), narrower than the
morning page's; the layout is the reference, not the pixel size. The names, numbers,
addresses and the "Leading" row are sample content: the row was left out of the build
(the leaders never change, Tyler, Nov 2).

## The mark

- `keep-mark.svg`: the mark, one path on a 64-unit grid, `fill="currentColor"`. Always
  `text-strong`, never the accent. The nav shows it at 20 px beside the wordmark and the
  favicon is cut from it.
- `keep-mark-16.svg`: the same silhouette with the loophole dropped, for 20 px and below.
- `keep-icon.svg`: the app icon and social tile, the dark mark on a brass ground with the
  8-unit radius. `apps/web/public/` carries the derived favicon and touch icon.

## Not rendered

The History and diff screens, Tokens, Activity, Stack and sign-in have no render; the Face
phase restyles them with the primitives and the idiom above. The group's Guide, Sign-up,
Calendar and Members pages, the edit forms behind the co-leads' controls (the week's
guide, the fixed liturgy, a sheet, a meeting), the link panel and the co-lead sign-in have
none either; the Group phase builds them from the home's idiom.
