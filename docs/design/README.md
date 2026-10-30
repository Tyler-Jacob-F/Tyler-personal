# Reference renders

PNGs from the Claude Design canvas, one per screen per mode per width, named
`<screen>-<mode>-<width>.png`: `morning`, `recipe`, `recipes`, `nav-collapsed`, `nav-open`;
`dark` or `light`; `phone` or `desktop`. `docs/DESIGN-VALUES.md` says what each must show.
The Face phase matches them; a later change to a screen starts with a new render here.

## Present (Oct 30, 2026)

- `morning-dark-phone.png`, `morning-light-phone.png` (1170 px wide, the full page)
- `morning-dark-desktop.png`, `morning-light-desktop.png` (2560 px wide, the full page)

Stitched from the canvas's PDF export, whose pages sliced each artboard; the page margins
were trimmed at the joins. The content is sample content (a Saturday in October, All
Hallows' Eve); the layout, type, spacing and the one accented element are the reference.

## Not yet rendered

The recipe page, the recipes list with facets and search, and the nav collapsed and open
have specs in `docs/DESIGN-VALUES.md` but no render. The Face phase builds them from the
spec and the morning page's idiom; a render added here later wins on layout.
