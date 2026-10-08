# The slop floor

A floor, not a style. It lists what marks an interface as generated and what to use instead.
It does not tell you what a brand should look like. A project's own design system overrides
every replacement here; the bans still apply unless the brand truly owns the thing banned.

## Fonts

**Banned as defaults.** These are the faces nobody chose. They arrive because they were the
most common thing in the training data.

Inter, Geist, Roboto, Open Sans, Lato, Poppins, Montserrat, Manrope, DM Sans, Plus Jakarta
Sans, Space Grotesk, Outfit, Instrument Serif, Playfair Display, Fraunces, Cormorant, Lora,
DM Serif Display.

**Use instead.**

| Role | Default | When a named face is justified |
|---|---|---|
| App UI | The system font stack | Hanken Grotesk, Public Sans, Schibsted Grotesk, Albert Sans, Familjen Grotesk |
| Marketing heading | The body family, heavier | Bricolage Grotesque; or a serif such as Literata, Source Serif 4, Gambarino |
| Figures and code | The system monospace | Commit Mono, Martian Mono, Fragment Mono |

All of the named faces are free to use. Check each licence before you bundle a font file.

**Rules.**

- Write the reason before using any named face: "face, because reason". "Clean and modern" is
  not a reason. No reason means the system stack.
- A banned face is allowed when the project already uses it or the brand owns it.
- One family. Two at most, when the second has a job the first cannot do. A third is costume.
- Emphasis inside a heading is the same family in another weight or its italic. Never a word
  in a second typeface.
- Monospace is for code, figures and measurements. Not a costume for "technical".
- No display face on buttons, labels or data.
- Any list of approved fonts becomes the next default. Rotate, and prefer the system stack.
- The system stack is a complete answer, not a fallback. When a page cannot load external
  files, use it and stop.

## Icons

| Where | Use |
|---|---|
| Web, default | Phosphor: several weights, so the stroke can match the text |
| Web, very large set needed | Tabler |
| Web, small solid set | Heroicons |
| iOS and macOS apps | SF Symbols (licensed for Apple platforms only) |
| Android apps | Material Symbols |
| The project already ships a set | That set, restyled to match the type |

**Rules.**

- One family, one weight, across the whole product.
- The icon is as tall as the text line it sits on, and its stroke matches the text weight.
  The stock set at its default stroke beside small text is the most common tell.
- Fewer icons. A label alone is often clearer. An icon beside every row and heading is
  decoration.
- No emoji in the interface. No sparkle beside AI features: name the feature.
- Do not draw icon paths by hand. Use the set. When nothing can be loaded from outside,
  paste the set's own SVG for the few icons you need, or use no icons. Text labels alone are
  a good interface.
- No icon in a tinted rounded square above a heading. Put the icon beside the text, in flow.
- Filled icons mark the selected item; outlines everywhere else. Or all one style. Decide once.
- Every icon-only control has an accessible name.

## Colour

**Banned.**

- Purple, indigo and violet gradients, on anything.
- Gradient-filled text.
- Coloured glows, neon outlines, and large blurred colour shapes behind content.
- A different pastel for every tile or category. More than three or four saturated hues.
- A tinted pill on every status, so that everything is coloured and nothing stands out.
- Grey text on a coloured background, and grey on grey that fails contrast.
- Pure black on pure white. Use an off-black and an off-white.
- Dark mode made by inverting light mode.
- A gradient on a button.
- Cream paper with a terracotta or forest accent as the automatic "tasteful" choice. It is as
  much a default as the purple gradient.

**Use instead.**

- Neutrals carrying a slight tint of the accent, plus one accent, used for action, selection
  and state only. Roughly a tenth of the screen at most.
- At most four state colours (good, attention, critical, neutral), each paired with a word or
  a shape. Saturation follows urgency: only what needs action is strong.
- The same accent on every section and every screen.
- Light or dark chosen by who uses the product and where, not by its category. Follow the
  system setting when you can afford to design both; ship one well before two badly.
- In dark mode, surfaces get lighter as they rise, text is off-white, and the accent is
  less saturated than in light mode.

## Structure

**Banned.**

- A coloured bar down the left edge of the active nav item, a card or an alert.
- A border and a card around everything. Cards inside cards. Border on border.
- A small uppercase, letter-spaced label above headings.
- Numbered section labels where order means nothing.
- A greeting as the page title.
- A row of tiles, each an icon and a number.
- The same figures repeated on several pages or in the sidebar.
- A coloured circle with an initial for the account. Initial circles on every row.
- Decorative status dots on nav items and rows.
- A side panel holding three fields.
- A thin border and a wide soft shadow on the same box. A shadow on every tile.
- Decorative grid lines, dot grids and crosshairs as background texture.
- Buttons, links and cards that do nothing.
- Reinvented standard controls: custom scrollbars, custom cursors, unusual form inputs.

**Use instead.**

- A full-row fill for the selected item.
- Space, alignment and one hairline to separate. A card only when a thing is truly a separate
  object.
- A plain page title that names the page.
- One ruled strip of figures, each with a comparison.
- An account row that opens a menu.

## Motion

**Banned.** Bounce and elastic easing. The same fade-up on every element. Pulsing dots that
are not showing live data. Marquees and auto-scrolling logo strips. Images that scale or tilt
on hover. Cards that lift on hover. Staged page-load sequences in product UI. Content
invisible until a script reveals it. Animating width, height, margin or padding.

**Use instead.** Short ease-out transitions on state changes. See `motion.md`.

## Copy

**Banned words.** seamless, effortless, unlock, unleash, elevate, supercharge, empower,
streamline, revolutionise, reimagine, next-generation, world-class, cutting-edge,
game-changing, all-in-one, at your fingertips, take control, journey, level up.

**Banned habits.**

- "Get started", "Learn more", "Submit", "Click here" as button labels.
- Acme, Jane Doe, John Doe and lorem ipsum.
- Round or too-perfect invented numbers: 10,000+, 99.9%, 4.9/5.
- Exclamation marks in interface text. "Oops".
- Em dashes.
- The two-beat slogan: "Send the invoice. Get paid."
- A short rebuttal ending every section: "Not a tool. A platform."
- Marketing voice in product labels.
- Title Case On Every Label.
- Small print under every button.

**Use instead.** The plain sentence a colleague would say. See `states-forms-copy.md`.

## The overcorrection

Removing all of this and adding nothing produces its own recognisable look: grey, monospace,
empty, with a single rust accent. That is also slop. The fix is not decoration. It is real
content, a clear focal point, and choices you can defend.
