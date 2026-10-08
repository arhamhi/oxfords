# Colour

An interface is built from neutrals. White, black and greys do most of the work: the page,
the surfaces, the text, the lines. A palette is the small set of colours that sits on top of
that and gives the product its character.

Both halves matter. Neutrals with no real colour is the bland default: a white page with one
blue button. Colour with no neutrals is a poster, not an interface: everything tinted, nothing
resting.

## The neutral base

This is most of every screen. Use it first.

| Step | Light | Dark |
|---|---|---|
| Page | `#FFFFFF` | `#000000` or `#0A0A0A` |
| Raised surface | `#FAFAFA` or `#F4F4F5` | `#141414` or `#1C1C1E` |
| Line | `#E5E5E5` | `#2A2A2A` |
| Quiet text | `#6B6B6B` | `#A3A3A3` |
| Text | `#111111` | `#F5F5F5` |

- The page is white, black or a grey. Never bone, cream, beige, sand or any warm off-white.
- A bone or cream page with an orange, red or terracotta accent is the single most common
  generated look right now. Do not produce it, whatever palette you chose.
- Greys are neutral. A very slight lean toward the palette's lead colour is fine. A visible
  tint is not.
- Text is near-black on light and near-white on dark. Not a palette colour.
- On a phone, the page is exactly `#FFFFFF` or `#000000`.

## The palette

Each palette is three colours. They are accents on the neutral base, never the base itself.

| Role | Job | Rough share |
|---|---|---|
| Neutrals | page, surfaces, text, lines | 75-85% |
| Lead | the action, the selected state, the key figure or series, one solid block | 10-15% |
| Support | a second solid block, a secondary chart series, a section on a landing page | 5-10% |
| Pop | one small highlight: a badge, a marker, the thing that needs attention | 1-3% |

- All three get used. A screen that only uses the lead colour on one button has not used the
  palette.
- Colour arrives in blocks and marks with clean edges: a filled panel, a sidebar, a chart, a
  chip, a button. It does not arrive as a tint over everything.
- A pale colour in a palette (a cream, a pale blue, a pale yellow) is a block or a highlight
  with dark text on it. It is never the page.
- Text on a colour block is near-black or white, whichever reaches 4.5:1. Check it: white
  fails on most bright reds, oranges, yellows and greens, so those take near-black text.
- A colour too light to read as text on the page is a fill only.
- State colours stay separate from the palette: an error is red with a word and an icon, a
  success is green with a word.
- Product UI sits at the quiet end of those shares. A landing page sits at the loud end, with
  whole sections flooded in the lead or support colour between neutral ones.

## How good colour actually behaves

These come from studying a lot of interfaces that look deliberate. They matter more than
which palette you pick.

- **The controls stay neutral.** Most buttons, inputs, pills and nav are black, white or
  grey. A coloured button appears once on a screen, on the action that matters.
- **Colour lives in content.** The chart, the photo, the illustration, the status that needs
  attention, one flooded panel. Not the chrome around them.
- **One field, one spark.** The largest area of colour is a single hue, usually the darker
  or cooler one. Somewhere inside or beside it sits one small mark of the opposite
  temperature: an ember on teal, a red on deep blue, a gold on black. Roughly nine to one.
- **Two-tone type instead of bold.** Emphasise by setting part of a heading in grey and part
  in black, or by putting one word in the lead colour. It costs no space and reads calmer
  than size or weight.
- **Black and white is a palette.** A screen with no hue at all can be the strongest choice,
  as long as something gives it life: real photography, texture, strong type, real data.
  Flat grey boxes with no hue and no content is the failure, not monochrome.
- **Dark means neutral dark.** Near-black with white controls and grey secondary text. The
  colour comes from the content sitting on it.
- **On a phone, colour can carry meaning.** A sky that changes with the time of day, a bar
  that fills, a figure that turns when a limit is passed. Colour that says something beats
  colour that decorates.

## The palettes

| Name | Lead | Support | Pop | Character |
|---|---|---|---|---|
| Orchard | `#E14543` | `#665244` | `#FEEEC3` | warm, food, print |
| Breeze | `#4F404C` | `#B6CCDD` | `#F9E7C9` | calm, soft, editorial |
| Poppy | `#075431` | `#F63434` | `#FCF4D2` | fresh, market, confident |
| Olive Bar | `#3C3F8C` | `#76202D` | `#F8DFC1` | rich, grown-up, hospitality |
| Citron | `#6162A3` | `#D1D127` | `#FCF4D2` | playful, creative tools |
| Kite | `#DE2C1D` | `#BCD8F1` | `#F7EB49` | loud, optimistic, consumer |
| Lemonade | `#2A3F73` | `#D82D32` | `#FEEFA7` | bold, summer, retail |
| Blueprint | `#224D95` | `#D93D7F` | `#EDEBDE` | technical with a spark |
| Signal | `#001B8C` | `#FFF002` | `#F5F5F5` | stark, graphic, events |
| Lagoon | `#028397` | `#DC6665` | `#F6F9F8` | clean, health, travel |
| Rosewood | `#715445` | `#DE5276` | `#D8DBD8` | soft, beauty, lifestyle |
| Meadow | `#F64830` | `#B9B965` | `#D5E3FC` | light, outdoors, friendly |
| Regatta | `#0F6FDC` | `#FEFD15` | `#9BB9C1` | sporty, energetic |
| Saddle | `#FF5305` | `#4A2A1C` | `#B4A49A` | earthy, craft, western |
| Harbour | `#4EA3CB` | `#CA391A` | `#00232E` | deep, maritime, serious |
| Greenhouse | `#7EA288` | `#FA0201` | `#482E22` | plants, cafe, wood |
| Orchid | `#D8B54C` | `#8B2E47` | `#3A0E14` | luxurious, evening |
| Nightshift | `#7778DE` | `#F44631` | `#342E35` | modern, media, tools |
| Arcade | `#28B467` | `#FE1C66` | `#3E283D` | loud, games, nightlife |
| Tideline | `#326E6E` | `#CE7D36` | `#C5CFCB` | teal world, one ember; weather, travel, data |
| Conservatory | `#293D25` | `#4A91BF` | `#A97F62` | deep green, sky, clay; calm, premium, slow |
| Fresco | `#4288C3` | `#925B38` | `#D9DAD4` | sky blue and sienna; humane, legal, learning |
| Regent | `#067BCE` | `#033263` | `#DE2C1D` | bright blue, navy, one red; bold, family, play |
| Cellar | `#983219` | `#3E3428` | `#C1BB97` | rust on near-black; bars, food, evening |
| Aurora | `#74A897` | `#244030` | `#D3EDE0` | soft greens on black; science, wellness, AI |
| Mono | `#111111` | `#6B6B6B` | `#FFFFFF` | no hue at all; needs photography, texture or strong data to carry it |

The lead, support and pop given here are defaults. Swap two of them if it suits the product,
then keep them fixed.

## How to choose

1. Read the product. Who uses it, where, in what mood?
2. Shortlist every palette that fits, usually three to five. Do not take the first one that
   comes to mind: that is how one palette ends up on everything.
3. Do not pick by category cliche (blue for finance, green for money, sage for wellness).
4. Break the tie without taste. Count the letters in the product's name. Put your shortlist
   in the order it appears in the table and count along it, wrapping round, with the first
   palette as one. Where you stop is the palette.
5. If you can see what the last project used, never repeat it.
6. Decide light or dark by who uses it and where. Then write one line:
   "Lemonade on white, because it is a retail tool and the navy carries the actions."

## On a phone

- The page is pure white or pure black. Pure black saves power on OLED screens and makes
  colour look richer.
- Raised surfaces are a neutral one step off the page, or glass. Not a tinted panel.
- The palette shows up as the action, the progress or key figure, the selected state, and
  one or two small filled marks.
- The navigation layer is Liquid Glass. See `mobile.md`.

## Check before you call it done

- Squint. Is most of the screen neutral, with colour in a few clear places?
- Is the page white, black or grey?
- Are all three palette colours on the screen, each doing one job?
- Could this be described as "bone and orange" or "white and blue"? If yes, start the colour
  again.

## Using your own

A project's own colours always win. Give them the same roles on the same neutral base.
