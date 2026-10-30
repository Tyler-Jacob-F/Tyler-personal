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
phase restyles them with the primitives and the idiom above.
