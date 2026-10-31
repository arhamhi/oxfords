# Colour

Three kinds of colour, each a role with a token, never a swatch picked by eye. Neutrals (white,
black, greys) do most of the work. A palette of three colours gives the product its character.
Four fixed state colours say what happened. Neutrals alone is the bland default, a white page
with one blue button; colour with no neutrals is a poster. Aim between them.

## Generate the tokens

Every colour comes from the script, which checks each contrast on the hex it writes.

```bash
node scripts/palette.mjs list --mode light               # every palette, its families and fit
node scripts/palette.mjs Tideline --mode both            # light and dark sheets, ready to paste
node scripts/palette.mjs --brand "#FF8A3D" --mode both   # from a client's colour
node scripts/palette.mjs --lead "#2F5D50" --support "#E0A43A" --pop "#F3E9D2"
node scripts/palette.mjs contrast "#CE7D36" "#FFFFFF"
```

`--ground` picks the ground: `white` or `grey` for light, `near-black` or `black` for dark. With
`--mode both`, give one per mode: `--ground white,black`. `--lean` leans the greys slightly
toward the lead. `--ramps` adds steps 50 to 950 per role plus greys; equal steps have equal
lightness. `--json` feeds a build.

Paste the sheet whole and read its header: what moved, why, and what to watch. Components use
tokens, never hex. Needing a colour with no token means the design needs another look.

## Neutrals

| Token | For |
|---|---|
| `--page` | the page |
| `--surface` | one step raised: sidebar, panel, card |
| `--surface-2` | two steps: hover fill, well, code block |
| `--selected` | the full-row fill of the current nav item and selected rows |
| `--line` | hairlines and dividers |
| `--line-strong` | input and control borders |
| `--text` | headings and body |
| `--text-2` | secondary text: descriptions, labels |
| `--text-3` | metadata: dates, counts, hints. Still 4.5:1 on every surface |
| `--text-disabled` | disabled labels only; exempt from 4.5:1 |
| `--focus` | the focus ring |
| `--overlay` | the modal scrim |
| `--shadow-1`, `--shadow-2` | raised and floating; a short dark layer plus a long soft one |

Three text levels, no more. Emphasise by quieting the neighbours: part of a heading in
`--text-2`, or one word in `--lead-ink`. Text is never pure black, and in dark mode never pure
white; white is kept for the primary action. Greys stay neutral: `--lean` is all the tint they take.

## Grounds

Light: `white` (the default) or `grey`, a light grey page with white cards for dense dashboards.
Dark: `near-black` (the default) or `black` for phones and OLED.

Never a bone, cream, beige or sand page; bone with an orange accent is the most common generated
look there is. Use a white or grey ground and put the warm colour in a block.

## The palette

| Role | Job | Share |
|---|---|---|
| Neutrals | page, surfaces, text, lines, controls | 75-85% |
| Lead | one solid block of content: a chart panel, a flooded section, the key figure | 10-15% |
| Support | a second block, the second series, a landing section | 5-10% |
| Pop | one small highlight that is not a state: a "new" marker, the current step, an unread dot. A pale pop marks on a lead or support block, not on the page. A chart's highlight stays in its series colour (see Charts) | a mark, under 3% |

Each role `R` comes as eight tokens:

| Token | For |
|---|---|
| `--R` | the fill: a block, a chip, a bar |
| `--R-hover`, `--R-pressed` | the fill's states, when it is interactive |
| `--on-R` | text and icons on the fill: near-black or white |
| `--on-R-2` | secondary text and axis labels on the fill, tinted by its hue; equals `--on-R` when the header says there is no room |
| `--R-line` | hairlines and gridlines on the fill, quieter than `--on-R-2` |
| `--R-ink` | the role as text, link, icon or thin line on the page |
| `--R-tint` | a quiet fill: a highlighted row, a quiet panel of that colour |

- Each role gets one job. A screen uses the roles its content needs; a settings form may carry
  only the lead, in one small place. A role with no real job stays unused: never invent content
  (a meter, a badge, a figure) to give a colour something to do.
- A fill is a block, not ink. It stays as given unless it would vanish into the page or no text
  can sit on it. Text and links on the page use `--R-ink`, the fill moved in lightness until it
  reads, and charts use `--series-*`. That keeps a pale lead usable on white and a deep one on black.
- A pale role (a cream, a pale blue) is a block with dark text on it, or a mark on a darker block.
- One field, one spark. The lead takes the largest area of colour, whatever its temperature.
  One small mark of the opposite temperature (often the pop or the support) sits in or beside
  it. Roughly nine to one.
- Black and white is a palette when real content gives it life: photography, texture, strong
  type, real data. Flat grey boxes is the failure.
- Product UI sits at the quiet end of the shares. A landing page sits at the loud end, with
  sections flooded in `--lead` or `--support` between neutral ones.

## Controls stay neutral, colour lives in content

| Control | Tokens |
|---|---|
| Primary button | `--action`, `--on-action` and their states; `--action-disabled` |
| Secondary button | `--control` with `--text`, or a `--line-strong` border |
| Input | `--line-strong` border, `--focus` ring |
| Current nav item, selected row | `--selected` across the full row |

Buttons, inputs, tabs, the sidebar and the top bar are neutral. Colour goes on the chart, the
photo, the key figure, one flooded panel. A neutral page whose only colour is one blue button is
not a palette: move the lead into content.

The only coloured controls:

- On a landing page, the one main call to action may take `--lead` with `--on-lead`, unless the
  sheet says the lead sits near a state hue. Then it is `--action`.
- In a native app, `--lead-ink` is the system tint (see "On a phone").

Everything else, checkboxes and radios included (`accent-color: var(--action)`), stays neutral.
A selected chip or tab uses `--selected`.

## States

Every state is a token: hover lighter, pressed darker, pale fills darker for both, disabled
quiet with the reason in text beside it. Never make a state with opacity or a filter.

## State colours

`--danger`, `--warning`, `--success` and `--info` are fixed and sit outside every palette, each
with the same eight tokens as a role.

- Destructive actions and errors are always `--danger`, even when red is not in the palette, and
  never the brand's own red.
- When a role sits near a state hue (a red lead, a green support), the sheet says so. Keep that
  role off controls and away from anything that could read as a state.
- Pair every state with a word, and an icon where it helps scanning. Colour alone is never the
  signal.
- Tint the one row or chip that needs attention, not a pill on every status.

## Dark mode

Dark is designed, not inverted. The script derives it:

- surfaces step up in lightness as they rise, so depth needs no shadow and `--shadow-1` is none
- borders are brighter than in light mode
- each fill keeps its hue and loses about 10% chroma. A deep fill stays deep: it lifts only if it
  would blend into the page or `--surface-2`
- pale colours stay pale and become strong marks with dark text on them
- inks and chart series lift until they read, so a wine fill gets a rose ink

`list` grades each palette per mode:

| Fit | Meaning |
|---|---|
| native | nothing moved |
| adjusted | a fill moved up to 0.1 in OKLCH lightness, about one ramp step |
| poor | a fill moved further, or its ink or series lost the hue; choose another for that mode |

Deep and pale palettes both travel. A fill that is the page colour, like Mono's near-black lead
in dark, is poor.

## Charts

`--series-1` to `--series-6` come in a fixed order: lead, support, pop unless it is a tint or a
grey, then steps of the lead and support, then a neutral. `--series-muted` is the grey for
"previous period" or "other". Each is 3:1 on the page and clearly different from the rest.

A single-series chart may sit on a `--lead` panel, drawn in `--on-lead`. A chart with two or
more series sits on `--page` or `--surface`. Use the series in order. Up to three series,
colour can carry it; beyond three, label lines and bars directly and never rely on hue alone.

To single out one bar or point (today, the selected period), change its weight, not its hue.
On the page the marked bar keeps its series colour and the rest move to `--series-muted`. On
a `--lead` panel the marked bar is solid `--on-lead` and the rest are `--on-lead` outlines.
Name it in a label. A new hue for one bar reads as a second series.

## Choosing a palette

1. Decide light or dark first, by who uses it and where.
2. Run `list` in that mode: it prints all 26 palettes with their character, hue families and
   fit. Shortlist three to five by character. Skip poor. The character line is a mood and the
   kinds of product it has suited, a hint rather than a rule.
3. Strike category clichés (blue for finance, green for money, sage for wellness). Strike any
   hue family used nearby: other screens or products made in the same set, and the palette in
   a sibling project's `DESIGN.md`. Two blues count as one family.
4. Write one line on why: "Tideline on white, because it is a weather tool and the teal carries
   the data."
5. Only for a genuine tie (two palettes you cannot separate with a written reason): count the
   letters in the product's name and count along the shortlist in `list` order, starting at
   one and wrapping round. Where you stop is the palette.

Blue is the hardest lead: a navy block on white reads as somebody else's product. To swap two
roles, pass the palette's colours from `scripts/palettes.json` as `--lead`, `--support`, `--pop`.

## A client's or project's own colours

A project's own colours always win, in the same roles on the same neutral base. `--brand "#HEX"`
makes the client's colour the lead, unchanged in light mode unless no text colour can hold on
it. If it fails as text, `--lead-ink` is its darker version. A missing support takes the first
rotation (analogous 30 degrees, then split complement, then complement) that is clear of the
state hues, apart from the lead, and not a dark yellow, orange or olive, which read as brown. A
brand that is itself brown keeps that choice. A missing pop starts at the complement. The header
lists what moved, every alternative and why each was rejected; `--support` and `--pop` override.

## On a phone

- Ground `white` or `black`. Black saves power on OLED and makes colour look richer.
- Raised surfaces are neutral or glass, never tinted. In a native app the navigation layer is
  Liquid Glass; see `mobile.md`. A web page on a phone follows `app-ui.md`.
- In a native app, `--lead-ink` is the system tint: iOS colours links, toolbar icons and
  selected controls with it. Filled buttons stay neutral (`--action` or glass).
- The palette shows up as progress or the key figure, the selected state, one or two small marks.
  Colour that means something (a bar that fills, a figure that turns) beats colour that decorates.

## Check before calling it done

- Squint: most of the screen is neutral, with colour in a few clear places.
- The sheet came from the script; every warning in its header has an answer.
- Each role on screen does one job, and none was given invented content. No raw hex in components.
- Text on the page is a `--text` level or an `--R-ink`, never a fill.
- Destructive actions are `--danger`; every state has a word, never colour alone.
- The dark sheet was generated, then looked at.
- If it could be called "bone and orange" or "white and blue", start the colour again.
