# Landing pages and marketing sites

A landing page is a short story that ends in one action. It is about presentation, not
complexity. Plain here means clear and specific, not empty.

## The one thing code generation does not supply

A generated page says who it is for and then shows nothing from that person's world. No real
photographs, no real product, only feature copy. That is what reads as soulless.

- Show the audience's world: their tools, their setting, the real product in use.
- Put the product on a device in the customer's setting, not as a flat floating screenshot.
- Never build a fake product screenshot out of divs. Use the real interface or a real image.

## Message

- One heading that promises exactly what the product does, in words the customer would use.
- A hero holds at most four text elements: heading, one supporting line, one or two actions.
- A heading that runs to four lines is too large. Reduce the size.
- One label per intent. Not "Contact us", "Get in touch" and "Let's talk" on one page.
- Name buttons for the outcome: "Start a free trial", "See pricing". Not "Get started".
- Cut the copy hard. Most sections need a fraction of the words first written.

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
- No hard break between the hero and the next section.
- Nothing is hidden until a script reveals it. The page is complete at rest.
- See `motion.md` for timing and reduced motion.

## Performance is part of the impression

- Reserve space for images, fonts and embeds so nothing jumps.
- Load only the font weights in use, with a fallback of matching metrics.
- Lazy-load below the fold only.
- Use dynamic viewport units for full-height sections on phones.
