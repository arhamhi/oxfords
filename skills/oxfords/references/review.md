# Reviewing a screen

Review in two separate passes so the tool's output does not steer your eye.

## Fresh eyes

The builder is the worst reviewer of a build: they see what they meant, not what is there.
When you can start a subagent, give the look pass to a fresh one. Give it only:

- the screenshots
- the brief
- this file

Keep your reasoning out of it. It reports findings; you fix them. When you cannot start a
subagent, do the look pass before reading any checker output, and look at the screenshots
rather than the code.

## Pass 1: look

Render the screen with `node scripts/shoot.mjs <page>`. That gives 390 and 1440 wide, light
and dark, with animations off so nothing is caught half-revealed. Open every image. Then
answer:

1. **Squint.** What lands first? Is it the right thing?
2. **Hunt.** Pick the three questions a user most likely arrives with. How long does each
   take to answer?
3. **Wayfinding.** Where am I, where can I go, what is here, how do I leave?
4. **Edges.** Does everything line up on a small number of edges? Count the distinct left
   edges. More than four or five is mess.
5. **Emphasis.** Is anything important because of its surroundings, or is everything shouting
   at the same volume?
6. **Colour.** Answer each:
   - Is most of the screen neutral?
   - Does each palette colour do one job?
   - Are the controls neutral?
   - Is destructive red, and the brand nowhere near it?
   - In dark mode, does it look designed (layers lighter as they rise, colour calmer), or
     inverted?
7. **Subtract.** Remove each decorative element in your head. Did anything get worse?
8. **Swap.** Would this pass for a competitor's product with the logo changed?
9. **Defend.** Pick five values at random (a size, a gap, a colour). Can you say why each is
   that and not the default?

## Pass 2: measure

```bash
node scripts/check.mjs path/to/source
node scripts/shoot.mjs path/to/page.html
```

`check.mjs` reads the source for mechanical tells. `shoot.mjs` measures the rendered page:

- text contrast, including text over images and gradients
- clipped and overlapping text, and sideways scroll
- focus on every stop, target size, controls with no name
- content still hidden by a script
- the neutral share and the hue families on screen

Neither can see these, so check them by hand:

- Cards inside cards.
- Controls that do nothing.
- The same figures in more than one place.
- A control that makes no sense for the object it sits on.
- Each line of the Done gate in `SKILL.md`.

Tab through the whole screen once. Focus should always be visible and should never get stuck.

## Who struggles here

Read the screen as each of these people. One paragraph each is enough.

| Person | They are failed by |
|---|---|
| First-timer | icons with no labels, jargon, no obvious first step |
| Power user | no keyboard path, no bulk action, no density |
| Keyboard and screen-reader user | missing focus, unnamed buttons, hover-only content |
| Stress tester | long names, empty lists, 10,000 rows, a failed request |
| Distracted phone user | small targets, lost progress, anything that needs two hands |

## Cognitive load

Count the failures. Two or three is worth fixing. Four or more needs a rethink.

- More than four choices at a single decision point.
- More than one primary action on a screen.
- Something the user must remember from a previous screen.
- Two words for one thing.
- A step with no visible progress.
- An error that does not say what to do.
- Information shown before it is needed.
- A control far from the thing it changes.

## Severity

| Level | Meaning | Test |
|---|---|---|
| P0 | A task cannot be completed, or data is lost | Does it block the user? |
| P1 | A task is confusing or error-prone | Would a user contact support? |
| P2 | A missing state or an inconsistency | Would a user notice and hesitate? |
| P3 | Polish | Would only a designer notice? |

Every FAIL from `shoot.mjs` is at least P2. A contrast or focus failure on the main task is
P1.

Fix in that order: broken tasks, then missing states, then flow and responsive problems,
then visual polish.

## Reporting

One line per finding:

```
P1  Orders table  no way to find an order  -> add search above the table  -> users arrive hunting for one order
```

End with what you could not verify: real device feel, fonts on other systems, a screen
reader, real data volumes. When `shoot.mjs` could not run, contrast and layout are on that
list. Do not claim what you did not check.

## When fixing

- Change only what the finding names.
- Keep existing copy, names, navigation labels and identity unless the finding is about them.
- The review is done when all of these hold:
  - both checkers show no FAIL
  - every WARN is fixed or has a reason
  - no P0 or P1 is open
  - one confirming look at fresh screenshots shows nothing new

  Then stop. Polishing has no natural end.
