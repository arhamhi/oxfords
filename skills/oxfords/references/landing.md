# Landing pages and marketing sites

A landing page is a short story that ends in one action. It is about presentation, not
complexity. Plain here means clear and specific, not empty.

## The one thing code generation does not supply

A generated page says who it is for and then shows nothing from that person's world. No real
photographs, no real product, only feature copy. That is what reads as soulless.

- Show the audience's world: their tools, their setting, the real product in use.
- Put the product on a device in the customer's setting, not as a flat floating screenshot.
- Never build a fake product screenshot out of boxes and grey bars. A live, working piece of
  the real interface with believable data is not fake: it is the product. Use that, or a
  real image.
- Before launch, with no customers, leave proof out or state one true thing: who built it,
  what it replaces, what it costs. Invent nothing.

## Message

- One heading that promises exactly what the product does, in words the customer would use.
- A hero holds at most four text elements: heading, one supporting line, one or two actions.
- A heading that runs to four lines is too large. Reduce the size.
- One label per intent. Not "Contact us", "Get in touch" and "Let's talk" on one page.
- Name buttons for the outcome: "Start a free trial", "See pricing". Not "Get started".
- Cut the copy hard. Most sections need a fraction of the words first written.

## Plain is not bare

This is where a plain page most easily turns grey and empty. A landing page may carry more
character than product UI, as long as each choice has a reason.

- The hero states the promise large enough to read in a glance, and shows the product
  beside or below it at a size that matters.
- Every section has one thing the eye lands on. A column left empty beside a heading is a
  layout bug: fill it, or use one column.
- One typeface choice you can defend is allowed here, and encouraged when the system font
  would make the page anonymous.
- Use the full width. A page of narrow text columns separated by large gaps reads as
  unfinished.
- The page itself is white, black or grey. Pick a palette from `palettes.md` and use it at
  full strength on top: one or two whole sections flooded in the lead or support colour,
  with neutral sections between them so the colour has something to stand against.

## Structure

- Work out the flow by studying real sites. Take one section structure from each, change it
  to fit, and keep only the wireframe. Discard every borrowed visual.
- Decide the look separately and apply it afterwards. The same wireframe can carry very
  different identities.
- Left-align by default. Centre only short, standalone statements.
- Vary the section layouts. The same image-left, text-right block six times is a template.
- Social proof goes below the hero, never inside it. Real customers only.
- Features: one image and one line per feature beats a grid of icon, heading and paragraph.
- Pricing: make the price large and the plan name small. Show the real discount. List the
  same features in the same order in every plan, with missing ones marked. Fewer plans.
- Navigation fits on one line.

## What to leave out

- The announcement pill above the heading.
- A small uppercase label above each section title.
- Numbered sections, unless the content is a real sequence.
- The centred hero with two pill buttons over a floating product card.
- The fixed sequence of hero, logo strip, three features, bento grid, testimonials, three
  tiers, FAQ, closing band. Use the sections this product needs.
- A "Most popular" badge on the middle plan.
- Invented customers, round invented numbers, small print under every button.
- Version strings, live clocks, coordinates and other fake technical detail.
- Scroll cues and a "Ready to get started?" band.

## Spacing and type

- Related items sit closer than unrelated ones. Heading and its supporting line are a pair;
  the action sits further away, at least twice that gap.
- Sections are separated generously, roughly 100-160px on desktop and 64-100px on a phone.
- Body text 16px or larger, lines of 45-75 characters.
- Text over an image needs a gradient behind the text only, not an overlay on the whole image.
- Keep the area behind the heading clear.

## Motion

- Motion directs the eye. Decide the focal point of each section first.
- Choose one or two motion ideas and repeat them. They become part of the identity.
- When sections animate on scroll, the hero hands over to the next section. It does not cut.
- Nothing is hidden until a script reveals it. The page is complete at rest.
- See `motion.md` for timing and reduced motion.

## Landing page done gate

| Slot | Must exist |
|---|---|
| Colour | a neutral page; a named palette with a reason; at least one full-colour section; all three colours used |
| Promise | one heading a customer would say, readable in a glance |
| Product | the real thing shown, working or photographed, in the first screen |
| Actions | one label per intent, named for the outcome, same label everywhere |
| Sections | each has a focal point; no empty columns; layouts vary |
| Pricing | price large, plan name small, same rows in the same order, real discount |
| Form | label, hint, error under the field, input kept, all button states |
| Navigation | one line on desktop; on a phone, the key link and the action stay visible |
| Footer | present, with the links a person looks for |
| Links | every link goes somewhere; in a prototype, an on-page anchor is fine |
| Phone | no sideways scroll at 320px, 16px body, 44px targets |

## Performance is part of the impression

- Reserve space for images, fonts and embeds so nothing jumps.
- Load only the font weights in use, with a fallback of matching metrics.
- Lazy-load below the fold only.
- Use dynamic viewport units for full-height sections on phones.
