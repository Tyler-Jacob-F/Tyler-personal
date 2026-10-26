-- 0004_import_chili_lineage: a one-time content import, the exception that proves the
-- rule. Content normally enters through the API (validated, authored by the caller); this
-- file exists because the lineage predates the API and Phase 2's agent tokens are not
-- here yet. The frontmatter below is validated against the shared schema by a test.
-- Idempotent: documents key on (type, slug), versions on (document_id, number).

insert into document (type, slug, owner)
select 'recipe', 'steves-famous-chili', id from member where email = 'tyler.fuqua@icloud.com'
on conflict (type, slug) do nothing;

-- steves-famous-chili v1: Steve's Famous Chili
insert into version (document_id, number, body, frontmatter, author_member_id, authored_at, summary)
select d.id, 1, $x$1999 Ewa Beach Chili Cookoff award-winning chili. My grandfather's recipe, passed to my dad, and the one he made for us all through my childhood. Recorded March 3, 2014; the starting point for *Tyler's Signature Chili*.

## Method

Cook beef, garlic, onion and green pepper in a heavy skillet over medium-high heat, stirring frequently to break up the meat. Cook until the onion is soft and the meat has lost its pink color. Add the remaining ingredients except the beans. Bring to a boil, reduce heat, and simmer uncovered for three hours. If necessary, add more water. Add the beans during the last thirty minutes of cooking.

**Beanless chili.** Follow the basic recipe. Omit the beans, use 4 lb lean ground beef and ¾ tsp salt.

Serve with corn chips, shredded cheddar, and sour cream.$x$, $x${"title": "Steve's Famous Chili", "ingredients": [{"heading": null, "items": ["3 lb lean ground beef", "2 cloves garlic", "2 medium onions", "1 medium green pepper", "½ cup Gebhardt chili pepper", "1 Tbsp New Mexico chili pepper", "1 Tbsp pasilla (mild) chili pepper", "1 Tbsp cider vinegar", "1 Tbsp cumin", "½ tsp salt", "2 cups water", "1 tsp oregano", "1 tsp black pepper", "½ tsp Tabasco pepper sauce", "4 cups crushed tomato", "2 cups red kidney beans, with liquid", "½ tsp cayenne pepper"]}]}$x$::jsonb, m.id, '2014-03-03T00:00:00Z', $x$as printed from the family recipe manager, March 2014$x$
from document d, member m
where d.type = 'recipe' and d.slug = 'steves-famous-chili' and m.email = 'tyler.fuqua@icloud.com'
on conflict (document_id, number) do nothing;

insert into document (type, slug, owner)
select 'recipe', 'tylers-chili', id from member where email = 'tyler.fuqua@icloud.com'
on conflict (type, slug) do nothing;

-- tylers-chili v1: Tyler's Chili
insert into version (document_id, number, body, frontmatter, author_member_id, authored_at, summary)
select d.id, 1, $x$Three-Meat Chili with Guinness and Brown Sugar. Written November 2023, descended from *Steve's Famous Chili*: the Gebhardt, pasilla and New Mexico powders are his, as are the four cups of tomatoes and the kidney beans with their liquid.

1. **Preparation (night before).** In a medium bowl, combine 6 Tbsp of the chili powder (reserving 2 Tbsp for later), the chipotle or New Mexico chili powder, the paprika or pasilla chili powder, salt, cayenne, cumin, and ½ tsp each of black pepper and oregano. Mix well. Add the ground meat to the spice mixture, ensuring the spices are thoroughly integrated into the meat. Cover and refrigerate overnight.
2. **Render the fat.** Place the marinated meat in a cold pot and turn the heat to medium. Cook until browned, breaking up the meat as it cooks. Once browned, remove the meat from the pot, leaving behind the rendered fat and fond.
3. **Sauté the vegetables.** Add the diced Vidalia onion and bell peppers to the pot. Sauté until they start to soften. Stir in the minced garlic and continue until fragrant.
4. **Deglaze with Guinness.** Return the browned meat to the pot. Add the Guinness and scrape the bottom of the pot to release the fond. Let the liquid reduce by about half.
5. **Add the remaining ingredients.** Add the crushed tomatoes, the remaining 2 Tbsp of chili powder (or Gebhardt), the remaining ½ tsp oregano, 1 cup of water, and the jalapeño. Bring to a boil.
6. **Simmer.** Reduce the heat to low and simmer for at least 3 hours, adding water if needed to keep the desired consistency.
7. **Final touches.** In the last hour, add the kidney beans, the black and pinto beans, and the brown sugar. Stir well and adjust seasoning.$x$, $x${"title": "Tyler's Chili", "ingredients": [{"heading": null, "items": ["1 lb each of lean ground beef and ground lamb", "2 cloves garlic, minced", "1 large Vidalia onion, diced", "1 medium green bell pepper, diced", "1 medium red bell pepper, diced", "½ cup chili powder, divided (or use ½ cup Gebhardt chili powder)", "1 Tbsp chipotle chili powder (or use 1 Tbsp New Mexico chili powder)", "1 Tbsp paprika (or use 1 Tbsp pasilla chili powder)", "1 Tbsp cumin", "1 Tbsp unsweetened cocoa powder", "½ tsp salt", "1 tsp black pepper, divided", "1 tsp oregano, divided", "2 Tbsp brown sugar", "2 cups water", "1 cup Guinness", "1 jalapeño, seeded and diced", "4 cups crushed tomatoes", "1 can red kidney beans, with liquid", "1 can black beans", "1 can pinto beans"]}]}$x$::jsonb, m.id, '2023-11-06T00:00:00Z', $x$first written version, descended from Steve's$x$
from document d, member m
where d.type = 'recipe' and d.slug = 'tylers-chili' and m.email = 'tyler.fuqua@icloud.com'
on conflict (document_id, number) do nothing;

-- tylers-chili v2: Tyler's Chili
insert into version (document_id, number, body, frontmatter, author_member_id, authored_at, summary)
select d.id, 2, $x$1. **Marinate the meats (night before, if possible).** Combine the spice blend: in a bowl, mix all the chili powders, 1½ tsp kosher salt, ½ Tbsp oregano, ½ tsp black pepper, the cumin and the coriander; reserve 1 Tbsp of this mixture for later. Add the ground bison (or beef), lamb and pork and mix thoroughly. Cover and refrigerate overnight, or at least 1 hour.
2. **Roast the poblano.** Char over a gas range or under a broiler until the skin blisters. Steam in a covered bowl about 10 minutes. Peel, seed and dice; set aside.
3. **Sauté the vegetables.** Heat a large pot or Dutch oven over medium. Add 1 tsp salt to the diced onion, bell peppers and carrot as they go in. Sauté until softened and starting to caramelize, 8–10 minutes. Add the jalapeño, if using, for 1–2 minutes more.
4. **Brown the meats.** Increase the heat to medium-high. Add the marinated meats, breaking them up well, and cook until browned. Drain excess fat, leaving 1–2 Tbsp in the pot if desired.
5. **Combine with the poblano.** Stir in the roasted poblano and cook 1 minute more.
6. **Build the flavor base.** Push the mixture to the pot's edges, making a well in the center. Add 2 Tbsp tomato paste and cook 2 minutes, stirring, to caramelize. Sprinkle in the reserved 1 Tbsp of spice mixture, ½ Tbsp oregano, ½ tsp black pepper and about ½ tsp salt. Stir thoroughly.
7. **Deglaze and add liquids.** Pour in the Guinness and 2 tsp Worcestershire, scraping up the browned bits. Simmer and reduce slightly, 3–5 minutes.
8. **Add tomatoes and broth.** Stir in 4 cups crushed tomatoes. Add beef broth, about 4 cups, to reach a stew-like consistency; for a thicker chili start with 3 cups and add as needed.
9. **Simmer.** Bring to a gentle boil, reduce to low, partially cover and simmer 2–3 hours, stirring occasionally. Taste midway and add salt if needed, perhaps another ½ tsp.
10. **Final seasoning and chocolate.** Stir in the lime juice and brown sugar, starting with 1 Tbsp. Add 1 oz dark chocolate and stir until melted. Taste and adjust salt, sweetness and acidity; more lime for more tang.
11. **Add the beans.** In the last 30 minutes, stir in the drained beans and simmer to warm through.
12. **Final adjustments.** Taste for salt one last time. If too thick, thin with broth or water; if too thin, simmer uncovered to reduce.
13. **Serve and garnish.** Ladle into bowls. Offer shredded cheese, sour cream, cilantro, avocado and lime wedges, with corn chips or cornbread.

## Notes and suggestions

**Smokiness boost.** Increase the smoked paprika slightly. Add a second roasted poblano, or use smoked salt for some of the salt. A dash of liquid smoke or a spoonful of chipotle in adobo also deepens the smoke.

**More heat.** Keep the jalapeño seeds and membranes, or add an extra jalapeño or serrano. Use chipotles in adobo or extra chipotle powder. Serve diced fresh peppers or chili flakes on the side so guests can set their own heat.

**Salt in stages.** Marinating the meats: about 1½ tsp. Sautéing the vegetables: about 1 tsp. After the liquids: about ½ tsp or to taste. Final check: a pinch more if needed.

**Sweetener.** Brown sugar is ideal for its mild molasses note. Maple syrup, about 1 Tbsp, works if you are out, but it is subtler and lacks the molasses edge.

**Meat substitutions.** Replace bison with 90/10 ground beef: more accessible and cheaper, though you lose bison's lean, distinct flavor. Omit lamb if you don't want the subtle gaminess, and replace it with more beef or bison.$x$, $x${"title": "Tyler's Chili", "ingredients": [{"heading": "Meats (3 lb total)", "items": ["1 lb ground bison (substitute 90/10 ground beef if bison is unavailable or to reduce cost)", "1 lb ground lamb (substituting more beef/bison removes the subtle gaminess)", "1 lb ground pork"]}, {"heading": "Vegetables and aromatics", "items": ["1 roasted poblano pepper, peeled, seeded, and diced", "1 red bell pepper, diced", "1 green bell pepper, diced", "1 jalapeño, seeded and diced (optional, for heat)", "1 carrot, finely diced", "1 large sweet onion (Vidalia), diced"]}, {"heading": "Spice blend (approximately ½ cup total)", "items": ["2 Tbsp dark chili powder", "2 Tbsp light chili powder", "2 Tbsp New Mexico red pepper powder", "1 Tbsp ancho chili powder", "1 Tbsp chipotle chili powder", "1 Tbsp smoked sweet paprika", "1½ Tbsp ground cumin", "1 Tbsp dried oregano, divided", "1 tsp ground coriander", "1 tsp smoked black peppercorns, freshly ground, divided"]}, {"heading": "Salt (added in stages)", "items": ["2½–3 tsp kosher salt, divided"]}, {"heading": "Other ingredients", "items": ["2 Tbsp tomato paste", "2½–3 cups Guinness (one 14.9 oz can, minus a small pour)", "4 cups crushed tomatoes (fire-roasted preferred)", "1 (32 oz) carton beef broth (about 4 cups)", "2 tsp Worcestershire sauce", "1–2 Tbsp brown sugar (or 1 Tbsp maple syrup; the molasses in brown sugar is ideal for depth)", "1 oz (28 g) dark chocolate (70% cocoa)", "2 Tbsp lime juice", "3 cans beans, drained (dark red kidney, black, pinto)"]}, {"heading": "Optional garnishes", "items": ["Shredded cheddar cheese", "Sour cream or Greek yogurt", "Chopped fresh cilantro or parsley", "Sliced avocado", "Lime wedges", "Corn chips or cornbread on the side"]}]}$x$::jsonb, m.id, '2025-01-31T00:00:00Z', $x$three real meats (bison, lamb, pork), roasted poblano, carrot, half-cup spice blend, Worcestershire, dark chocolate, broth instead of water; dropped garlic and cocoa$x$
from document d, member m
where d.type = 'recipe' and d.slug = 'tylers-chili' and m.email = 'tyler.fuqua@icloud.com'
on conflict (document_id, number) do nothing;

-- tylers-chili v3: Tyler's Signature Chili
insert into version (document_id, number, body, frontmatter, author_member_id, authored_at, summary)
select d.id, 3, $x$Attached at the end of the original is the chili that began this journey: a recipe my grandfather passed to my dad, and the one he made for us all through my childhood. In The Keep it lives as its own recipe, *Steve's Famous Chili*.

I took that base and began tinkering, infusing it with my own personality and preferences until it became this version: balanced, smoky, rich, and a little indulgent (not unlike me).

This chili was one of the first ways I learned to cook: to see how patience and small choices pay off, and how each element interacts to become something greater than itself.

For me, this is a form of love: a warm, hearty dish built on memory and intention, carried forward one careful step at a time.

## Current iteration notes

This version aimed to simplify and "clean up" the previous one. Last year's leaned a little… muddy? Too many competing voices in the symphony.

- Two poblanos + chipotle = controlled smoke, layered warmth.
- Simplified spice blend = clarity and first-bite definition.
- Three cups broth + double tomatoes = ideal viscosity and color.
- Cut the Worcestershire = cleaner, more balanced flavor. Worcestershire's complexity was unnecessary; most of it breaks down in the long simmer (clove oil, anchovy esters, etc.). Umami now comes from pork, fond, and Guinness. Molasses from Guinness and brown sugar. Brightness from lime. Fermented depth from Guinness itself.

## Method

1. Season and marinate the meats with half the spice blend (except salt). Refrigerate at least 1 hour or overnight.
2. Roast the poblanos: char the skins, peel, seed, dice; set aside.
3. Brown the meats in batches until a deep brown fond forms. Salt lightly; reserve 2 Tbsp rendered fat.
4. Sauté onion, carrot and ½ tsp salt 8–10 min until translucent; add the bell pepper (and jalapeño) for 2 min.
5. Stir in the tomato paste; cook 2 min until dark and fragrant. Return the meats and poblanos.
6. Deglaze with the Guinness; scrape the fond and reduce by half (about 5 min).
7. Add tomatoes, broth, bay leaf and the remaining spices. Simmer gently 2–3 hr, stirring occasionally. Adjust salt midway.
8. Add the beans in the final 30 min. Stir in brown sugar and chocolate off heat; remove the bay leaf, add lime juice.
9. Rest 10 min before serving.

## Optional polish: late spice bloom (for lift and aroma)

**Option 1, simple dry toast.** Toast ½ tsp cumin seeds (and up to ¼ tsp coriander seeds) over medium heat 20–40 sec until fragrant. Crush lightly; stir into the hot chili off heat with 1 tsp reserved fat or neutral oil. Cover 2 min before serving.

**Option 2, tempered oil (show-off style).** Heat 1 tsp oil; add ½ tsp cumin seeds (and/or ¼ tsp coriander seeds). Sizzle 15–25 sec until aromatic. Optionally add a pinch of oregano off heat. Pour the spiced oil over the chili, stir once, cover 1 min.

**Bright variation.** Micro-zest a thumbnail of lime peel over the pot before serving.$x$, $x${"title": "Tyler's Signature Chili", "ingredients": [{"heading": "Meats (3 lb total)", "items": ["1 lb ground bison (or 90/10 beef)", "1 lb ground lamb (or extra bison/beef)", "1 lb ground pork"]}, {"heading": "Vegetables & aromatics", "items": ["2 roasted poblanos, peeled, seeded, diced", "1 red bell pepper, diced", "1 large sweet onion (Vidalia), diced", "1 carrot, finely diced", "1 jalapeño, seeded and diced (optional)"]}, {"heading": "Core spice blend (~6 Tbsp total)", "items": ["2 Tbsp dark chili powder (base body)", "1 Tbsp New Mexico red pepper powder (bright note)", "1 Tbsp chipotle chili powder (smoke & depth)", "1½ Tbsp freshly toasted ground cumin", "1 tsp ground coriander", "1 Tbsp dried oregano (divided)", "2½–3 tsp kosher salt (divided)", "1 tsp fresh-ground black pepper (divided)"]}, {"heading": "Liquids & base", "items": ["2 Tbsp tomato paste", "1 can Guinness (14.9 oz), reduced by half", "2 × 14.5 oz cans fire-roasted crushed tomatoes", "3 cups low-sodium beef broth (+ ¼–½ cup if needed)", "1 Tbsp brown sugar (or maple syrup)", "½ oz dark chocolate (60–70%)", "1 tsp lime juice during cook + 1 tsp at finish", "1 bay leaf"]}, {"heading": "Beans (structure & creaminess)", "items": ["1 can kidney beans, drained & rinsed", "1 can black beans, drained & rinsed", "1 can pinto beans, drained & rinsed"]}]}$x$::jsonb, m.id, '2025-11-02T00:00:00Z', $x$Clean Smoke Edition: second poblano, spice blend cut to ~6 Tbsp (no light chili, ancho or paprika), dropped the green pepper and the Worcestershire, 3 cups broth and two cans of tomatoes, lime in two stages$x$
from document d, member m
where d.type = 'recipe' and d.slug = 'tylers-chili' and m.email = 'tyler.fuqua@icloud.com'
on conflict (document_id, number) do nothing;

-- tylers-chili v4: Tyler's Signature Chili
insert into version (document_id, number, body, frontmatter, author_member_id, authored_at, summary)
select d.id, 4, $x$Attached at the end of the original is the chili that began this journey: a recipe my grandfather passed to my dad, and the one he made for us all through my childhood. In The Keep it lives as its own recipe, *Steve's Famous Chili*.

I took that base and began tinkering, infusing it with my own personality and preferences until it became this version: balanced, smoky, rich, and a little indulgent (not unlike me).

This chili was one of the first ways I learned to cook: to see how patience and small choices pay off, and how each element interacts to become something greater than itself.

For me, this is a form of love: a warm, hearty dish built on memory and intention, carried forward one careful step at a time.

## Current iteration notes

Last year turned every voice down to get clarity and lost identity instead. This version keeps the same number of voices and turns them up, and finally gives the lamb a home. It took first at the 2026 small-group cook-off.

- **Chile roughly doubled, voices unchanged:** ancho as the base (the dark note done properly), guajillo for the bright, chipotle for smoke, reduced, since the poblanos and fire-roasted tomatoes already carry it. Ancho is dried poblano, so the pot has the same pepper fresh and dried.
- **Lamb built for, not tolerated:** a birria frame. Garlic (there was none), Mexican oregano, acid at the finish, half the lamb fat poured off. Acid is what makes lamb taste rich instead of gamey; with lamb in the pot it is structural, not optional.
- **Guinness out, Negra Modelo in.** A dry stout gets its color from roasted barley; reduce it and you concentrate bitterness with nothing sweet underneath. A Munich dunkel gets its color from kilned malt; reduce it and you concentrate caramel and body. The reduction is now a feature.
- **Acid moved to the finish and increased.** Lime first, then a little cider vinegar, until the lamb goes from rich to bright; the mid-cook teaspoon is gone (three hours strips it).
- **Marinade dropped.** Dry spices don't penetrate ground meat, and spice-coated meat scorches at fond heat. Meat browns naked; spices bloom in the fat after the tomato paste.
- **Beef chuck in for bison:** cubes hold their shape against the ground meats, and lean bison went grainy over the long simmer. The chuck goes in first and gets the full three hours.
- **Worcestershire stays out,** but its umami is replaced on purpose this time: a Parmesan rind.
- **Chocolate moved from the base to an optional finish,** after the acid, only if the pot asks for it. Mexican oregano, not Mediterranean.
- **Cook-day lessons:** the simmer goes in the oven at 300°F, lid cracked, and holds at 170°F for as long as the day needs; beans, acid, and the cumin bloom all happen in the last 45 minutes, never earlier. Cannellini stood in for pinto when the pantry came up short and was a fine substitute.

## Method

1. **Roast poblanos.** Char the skins, steam, peel until no black remains (leftover char is bitterness), seed, dice. Set aside.
2. **Build the spice bowl.** Toast and grind the cumin; combine with the chile blend, coriander, and half the oregano. It goes in fast, so have it ready.
3. **Brown the meats unseasoned, in batches,** until a deep fond forms; a pinch of salt per batch. Chuck first: dried on a rack 15 minutes, salted as it hits the pan, single uncrowded layer, hard on all sides; if it weeps, pull it and boil the liquid to a glaze. Then lamb: pour off about half its fat. Then pork: keep its fat. Leave about 2 Tbsp fat in the pot; meats aside.
4. **Sauté** onion, carrot and ½ tsp salt 8–10 min until translucent. Add the bell pepper (and the seeded jalapeño) 2 min. Add garlic 1 min.
5. **Paste, then bloom.** Stir in the tomato paste; cook 2 min until dark. Add the spice bowl and stir constantly for 30 seconds on medium, no longer.
6. **Deglaze immediately** with the Negra Modelo; scrape the fond and reduce by half (about 5 min).
7. **First simmer.** Return the chuck and poblanos. Add tomatoes, broth, rind, bay leaf, half the pepper, and the starting salt. Simmer gently, uncovered on the stovetop or at 300°F in the oven with the lid cracked, for 1 hour. Taste on a bean and adjust salt.
8. **Second simmer.** Add the ground lamb and pork. 2 hours more. Fork a chuck piece near the end; it should give. If the day runs long, drop to 170°F, lid on, and hold.
9. **Last 30 min.** Add the beans, the remaining oregano and pepper, and the second jalapeño. Look at the pot: thick with meat showing, the reserve can stays out; thin and brothy, add half of it and mash a cup of beans against the pot wall. If the body still runs loose, whisk the masa into ¼ cup warm broth and stir in. Set the final salt.
10. **Off heat.** Remove the bay leaf and rind. Brown sugar only if it reads bitter. Then acid: lime first, then vinegar a little at a time, until the lamb goes from rich to bright; stop at vivid, before sour. Taste; add the chocolate only if the pot still wants it, stirred until it disappears.
11. **Late spice bloom** (below), then rest 10 minutes; or, better, cool and refrigerate overnight. Reheat gently and re-check salt and acid with a fresh palate.

## Late spice bloom

Heat 1 tsp oil; add ½ tsp whole cumin seeds (and/or ¼ tsp coriander seeds). Sizzle 15–25 sec until fragrant; a pinch of Mexican oregano off heat. Pour over the chili, stir once, cover 1 min. The seeds stay whole and pop on the bite. Optional: micro-zest a thumbnail of lime peel over the pot.

## Serve

Cotija or sharp cheddar, pickled red onion, cilantro, lime wedges, sliced serrano, tortilla chips. The pot serves everyone; the heat-seekers build their own. When someone asks why it tastes different: there is lamb in it, and it is built like a birria.

## Notes for the next iteration

- Whole dried chiles, three anchos and three guajillos, toasted, soaked, blended with a chipotle in adobo, strained, in place of the powders. That paste is the body and gloss this pot still lacks next to a true Texas red.
- A smoked variant for the Smokey Mountain, untested: chuck roast smoked whole to 155–160°F, ground lamb as a loose slab for its last hour, only the pork browned in the pot, and no chipotle or fire-roasted tomatoes, so there is one smoke. Acid up a notch.$x$, $x${"title": "Tyler's Signature Chili", "ingredients": [{"heading": "Meats (3 lb total)", "items": ["1 lb beef chuck (stew meat is fine), trimmed, in ½-inch pieces", "1 lb ground lamb", "1 lb ground pork"]}, {"heading": "Vegetables & aromatics", "items": ["2 roasted poblanos, peeled thoroughly, seeded, diced", "1 red bell pepper, diced", "1 large sweet onion (Vidalia), diced", "1 carrot, finely diced", "5–6 garlic cloves, minced", "2 jalapeños: one seeded for the sauté, one with ribs for the bean stage (optional)", "1 serrano, sliced thin, for the table"]}, {"heading": "Chile blend (~7 Tbsp total)", "items": ["4 Tbsp ancho chile powder (body, fruit, cocoa)", "2 Tbsp guajillo chile powder, or New Mexico (bright)", "2 tsp chipotle chile powder (smoke)", "½ tsp cayenne (optional, for bite)"]}, {"heading": "Spices", "items": ["1½ Tbsp freshly toasted, ground cumin", "1 tsp ground coriander", "1 Tbsp Mexican oregano (divided)", "1 tsp fresh-ground black pepper (divided)", "1 bay leaf", "Kosher salt: 1 Tbsp Diamond Crystal (2 tsp Morton) to start, a pinch per batch while browning; expect 1–2 tsp more at the midpoint, tasted on a bean"]}, {"heading": "Liquids & base", "items": ["2 Tbsp tomato paste", "1 bottle Negra Modelo (12 oz), reduced by half", "2 × 14.5 oz cans fire-roasted crushed tomatoes", "3 cups low-sodium beef broth (+ ¼–½ cup if needed)", "1 Parmesan rind (2–3 inches)", "1 Tbsp brown sugar, only if the finished pot reads bitter", "Finish: juice of 1–2 limes + 1–2 tsp cider vinegar, to taste", "1 oz dark chocolate (60–70%), optional, at the finish", "2 Tbsp masa harina, in reserve, for body"]}, {"heading": "Beans (structure & creaminess)", "items": ["1 can kidney beans, drained & rinsed", "1 can black beans, drained & rinsed", "1 can pinto beans, drained & rinsed (cannellini stands in well)", "A 4th can of pinto, opened and held in reserve; the pot decides"]}]}$x$::jsonb, m.id, null, $x$Full Volume Edition: chile doubled on an ancho base with guajillo and less chipotle, lamb built for with garlic, Mexican oregano and acid at the finish, Negra Modelo for Guinness, beef chuck for bison, marinade dropped, Parmesan rind for umami, chocolate optional at the end; first at the 2026 small-group cook-off$x$
from document d, member m
where d.type = 'recipe' and d.slug = 'tylers-chili' and m.email = 'tyler.fuqua@icloud.com'
on conflict (document_id, number) do nothing;

update document d
set current_version_id = (select v.id from version v where v.document_id = d.id order by v.number desc limit 1)
where d.type = 'recipe' and d.slug in ('steves-famous-chili', 'tylers-chili');
