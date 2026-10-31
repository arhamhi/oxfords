---
name: oxfords
description: Use when building, changing, redesigning or reviewing any interface a person operates - dashboard, admin panel, table, form, settings, modal, onboarding, mobile app screen, landing page - or choosing its colours, palette or dark theme. Also use when a UI looks AI-generated, cluttered, generic, "vibe coded", over-decorated, unfinished or hard to scan, or when asked to remove AI slop, make a UI clean, plain, polished or professional, fix the UX, or check a build before shipping.
license: MIT
---

# Oxfords

Oxfords, not brogues. An Oxford is the plain shoe. A brogue is the same shoe with decoration
punched into it. This skill makes interfaces that are polished, plain and finished, and
removes the decoration that marks a screen as machine-made.

It does not make a product look striking or give it a brand. It decides what goes on the
screen, where, how visible, how it responds, and what must not be there.

**The test behind every rule:** nobody reads a screen. They arrive with one question and hunt
for the answer. A choice either makes that hunt faster or it is decoration.

**Plain is not generic, and it is not colourless.** Stripping slop and stopping leaves a
white page with grey text and one blue button. That is a default too. Plain is about
structure: every element there for a reason, and finished. Colour is where the product gets
its character. Build on neutrals and put a real palette on top of them.

**Measured, not assumed.** Contrast, clipping, overflow, focus and how much of the screen is
colour are measured by the scripts in this skill. A screen is done when the measurements pass
and you have looked at the screenshots, not when the code looks right.

## How to use

| Job | Do this |
|---|---|
| Build | Work the Build order, read the reference for your surface, fill the Done gate. |
| Redesign | Read `references/redesign.md` first and write the Keep list. Then work the Build order. |
| Review | Read `references/review.md` and do its look pass before running any checker. Report `symptom -> fix -> why`. |
| Fix | Change only what the finding names. Keep existing copy, names and identity. |

Precedence, highest first:

1. The project's own `DESIGN.md`, design system, tokens or brand rules.
2. A published design system the product already lives in (Material, Fluent, Carbon,
   Polaris, Primer, Apple's HIG, a shadcn/ui theme): build with its components and tokens.
3. Oxfords, for everything those leave open.

In a redesign, the existing styles are part of what is being redesigned, not a design system
to obey. Keep what the brand owns (its hue, its chosen typeface, its names) and replace its
defaults. `references/redesign.md` draws the line.

| Surface | Read first |
|---|---|
| Dashboard, admin, table, chart, settings (including on a phone browser) | `references/app-ui.md` |
| Native mobile app screen | `references/mobile.md` |
| Landing page, marketing site | `references/landing.md` |
| Redesign of an existing screen | `references/redesign.md` |
| States, forms, errors, UX copy | `references/states-forms-copy.md` |
| Colour: palettes, tokens, states, dark mode, a client's colours | `references/colour.md` (read this for every build) |
| Fonts, icons, the full ban list | `references/slop-floor.md` |
| Motion, gestures, reduced motion | `references/motion.md` |
| Reviewing a finished screen | `references/review.md` |

The scripts live in this skill's `scripts/` folder. They have no dependencies. Commands in
this skill are written relative to the skill folder; from a project, use the full path:
`node <path to skill>/scripts/<name>.mjs`.

| Script | What it does |
|---|---|
| `palette.mjs` | Lists the palettes and generates every colour token for a palette, a mode and a ground. Takes a client's colour with `--brand`. |
| `check.mjs` | Fast pass over source files for the mechanical tells. |
| `shoot.mjs` | Renders the page at 390 and 1440 wide, light and dark. Saves screenshots and measures contrast, clipped and overlapping text, sideways scroll, focus, target size, names and colour share. Uses Playwright when it is installed and exits with code 3 when it is not. |
| `keep.mjs` | Compares a redesign with the original: link targets, navigation labels, form fields, Keep-list lines and numbers. Reports changed headings. |

## Build order

1. **Read.** Write one line before anything else: "Reading this as: [product] for [who],
   used [where and when], so [light / dark / both], [dense / roomy]." Light or dark is
   decided here, by who uses it and where, not by the product's category. A native app is
   both: the system decides. Where the brief
   is open, choose and say so in that line. Ask only when a wrong guess would waste the
   build.
2. **Intent.** Name what the user came to do. Start with the control that does it. For each
   thing you add, ask whether it does anything the plain version did not. Add function only
   as intent grows.
3. **Content first.** Write every label, number and name before laying anything out. Use
   uneven, believable data: real-looking names, odd totals, one long value. Show only what a
   person scans for; detail lives one step in. One surface does one job.
4. **Let the data pick the component.** A fixed set of values is a chip. Numbers in
   columns are right-aligned with tabular figures. Time-based data is a timeline or a roll-up chart, not
   a time-sorted table. Inactive items stay in place, greyed. Do not reach for a table or a
   row of tiles by reflex.
5. **Layout on edges.** Left-align labels, right-align values, centre only what is not meant
   to be read. Every element locks to an edge and creates the edge for the next. Fill empty
   space by moving content onto edges, not by adding content. Use the layout people expect
   (top to bottom, left to right, navigation on top or left) before anything distinctive.
6. **Colour.** Generate it; write no colour values by hand. Pick a palette with
   `palette.mjs list --mode <mode>` as `references/colour.md` describes, or pass the
   project's own colour with `--brand`. Then paste the output of
   `palette.mjs <Name> --mode <mode>` into the stylesheet. Every colour on the page is one of
   those tokens:
   - neutrals cover most of the screen
   - lead, support and pop go on content, each with one job
   - controls stay neutral
   - errors and destructive actions use `--danger`

   Write one line on why the palette fits.
7. **Hierarchy.** Size, position, weight, then colour. Most important goes top-left and
   largest. Group, rank, stack, then delete every label the layout already implies. Emphasis
   is relative: quiet the neighbours instead of colouring the hero. Text has three levels:
   `--text`, `--text-2`, `--text-3`.
8. **Disclosure.** Primary action always visible with a label. Secondary actions in a menu,
   or revealed on hover with a visible equivalent on touch. Rare ones in a popover. Never
   put a primary item behind a click.
9. **Container.** Inline first, if it fits. Then: simple and non-blocking is a popover;
   complex but same page is a modal followed by a confirmation; large or permanent is a new
   page with a way back; on mobile, picking without leaving is a bottom sheet.
10. **The invisible layer.** States, feedback, focus, empty and broken content. This is the
    half that gets skipped. The Done gate lists it.
11. **Check.** Run `check.mjs` on the source, then `shoot.mjs` on the page (add
    `--schemes light` or `--schemes dark` for a single-theme page). Open every screenshot
    yourself: both widths, and both themes if you ship both.
    - Fix every FAIL. A FAIL on something the project owns (its chosen font, its brand colour)
      gets `oxfords-ignore` on that line in the source, with the reason in the report.
    - Fix each WARN, or write one line on why it stays.
    - Compare the colour share with `references/colour.md`: product UI at least 75% neutral,
      a landing page at least 60%. Outside that, fix it or give the reason.
    - Fill the Done gate.

    If `shoot.mjs` exits 3 (no browser), take screenshots another way. Failing that, say
    plainly in the report that contrast and layout were not measured.
12. **Record.** In a real project (not a one-off mock), write or update `DESIGN.md` at the
    project root in ten to twenty lines:
    - the `palette.mjs` command that made the tokens
    - mode and ground
    - type family and scale
    - radius tiers and spacing steps
    - icon set and weight
    - each deliberate exception, with its reason

    The next session reads it first.

## Done gate

Answer every line for the screen you built. "None" needs a reason.

| Slot | Must exist |
|---|---|
| Buttons | default, hover, focus-visible, pressed, disabled with the reason in text beside it, each from the state tokens; loading only where the user waits |
| Inputs | a persistent label above (a table toolbar's search and filters may carry their label inside the control), focus, error below the field that says how to fix it, input kept after an error |
| Every action | a response where the user is looking, within 100ms: the control changes in place, or a toast with undo |
| Destructive actions | `--danger`, never a palette colour; undo where possible, otherwise a confirm that names the object and labels the button with the action |
| Icon-only controls | an accessible name and a tooltip; anything not universally known gets a text label instead |
| Empty | first run (one sentence and the one action that fills it) and no results (quote the query, offer to clear it) |
| Loading and failure | where data loads, a skeleton shaped like the result after about 300ms; error says what failed and how to recover; offline and no-permission handled |
| Messy content | long names truncate with the full value available, 0 / 1 / 10,000 rows work, a missing image is handled |
| Tables | search, filter or sort; numbers right-aligned; one primary action per row; selection reveals a bulk action in the existing toolbar |
| Charts | plain line or bar from the series tokens; a full chart has axis values, grid lines, labels, a value on hover or focus, and a range or metric control when more than one range or metric exists; a small chart may label each bar or point directly instead; more than three series are labelled directly |
| Navigation | current location shown, items named for their contents, grouped, rare items last, about five top-level items |
| Keyboard and contrast | everything reachable by Tab with visible focus, Esc closes overlays; `shoot.mjs` reports no contrast, focus or target FAIL; state never by colour alone |
| Touch | 44px targets, nothing that works only on hover, 16px inputs, safe areas respected |
| Motion | under 250ms for feedback, never blocks input, a reduced-motion version that keeps the feedback |
| Colour | every colour is a token: the project's or its design system's when it has them, else `palette.mjs`; neutrals cover most of the screen; each role on screen does one job, and no content was invented to give a role one; controls neutral; no bone or cream page |
| Themes | the mode chosen in step 1 is the one shipped; when both ship, each was generated with `--mode both`, measured and looked at |
| Consistency | one type family, one palette, one icon set with one weight per text size, one radius per tier, same thing looks and behaves the same everywhere |
| Slop floor | `check.mjs` passes, or every warning has a one-line reason |
| Redesign | `keep.mjs` shows nothing from the Keep list missing, or each change is named with its reason |

## Slop floor

The marks of a generated interface. Remove them and put the plain replacement in their place.
The full list, with replacements, is in `references/slop-floor.md`.

- **Structure:** a coloured bar down the side of the active nav item or a card; a card around
  everything; cards inside cards; a small uppercase label above every heading; numbered
  section labels; a greeting header; a row of icon-and-number tiles; the same figures
  repeated on several pages; controls that do nothing.
- **Type and icons:** a default font nobody chose, such as Inter, Geist, Roboto, Poppins or
  Playfair Display (the full list is in `references/slop-floor.md`); a serif word dropped
  into a sans headline; emoji as icons; icons whose stroke does not match the text beside them; an icon in
  a tinted square above every heading.
- **Colour:** a bone or cream page with an orange or red accent; a neutral page whose only
  colour is one blue button; a whole interface tinted in palette colours with no neutrals;
  purple or indigo gradients; gradient text; glows and blurred colour blobs; a tinted pill on
  every status; the brand colour on a delete button; translucent text for hierarchy; colour
  values written by hand outside the tokens.
- **Motion:** bounce; everything fading up on scroll; pulsing dots; marquees; content hidden
  until a script reveals it.
- **Copy:** seamless, effortless, unlock, elevate, supercharge; "Get started" and "Submit";
  Acme and Jane Doe; round invented numbers; exclamation marks and em dashes.

## Numbers

| Thing | Value |
|---|---|
| Spacing | multiples of 4; unequal by role: 4-12 inside a group, 24-40 between groups; more space above a heading than below it |
| Radius | one per tier (controls, cards); nested inner = outer minus the gap |
| Button padding | horizontal about twice vertical |
| Icon size | the text line height; stroke matched to the text weight |
| Type scale | about six steps, plus at most one hero figure or headline outside the scale. Web app 13-14px body, rarely above 24px. Native app 17pt body, 15 minimum for primary content, 13 for metadata. Marketing 16px body and up. Nothing under 11px |
| Line length and leading | 45-75 characters; body leading about 1.5, display 1.05-1.2 |
| Heading tracking | -2% to -4% on large display type only; body 0 |
| Targets | 44px touch; 24px absolute floor on desktop |
| Feedback timing | press 100-150ms; routine transitions 150-250ms; overlays up to 400ms; exits faster than entrances |
| Easing | ease-out with no overshoot |
| State colour | hover a step lighter, pressed a step darker, disabled grey with its reason in text; all from the tokens |
| Shadows | two layers, a short darker one and a long soft one (`--shadow-1`, `--shadow-2`); if you notice the shadow it is wrong |
| Dark mode depth | each layer up is lighter; borders brighter than in light mode; a shadow only under a floating layer |
| Native app ground | pure black `#000` or pure white `#FFF`; navigation layer in Liquid Glass (native apps only; a web page on a phone follows `app-ui.md`) |
| Figures | tabular figures in columns and tables where digits must line up; proportional figures in prose |
| Contrast | 4.5:1 text, 3:1 large text, icons, input borders and focus rings; measured by `shoot.mjs` |

## Four tests before you call it done

- **Squint.** Blur your eyes. One thing should land first, and it should be the right thing.
- **Subtract.** Remove an element. If nothing got worse, it stays out.
- **Swap.** Put a competitor's logo on it. If it still fits, the content is too generic.
- **Defend.** Point at any value. You should be able to say why it is that and not the default.

## Credits

Oxfords stands on other people's work. See `CREDITS.md` in the repository.
