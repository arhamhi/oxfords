# Redesigning an existing screen

A redesign starts from something people already use. Their habits are part of the product:
where the links are, what things are called, what the numbers mean. The job is to keep all
of that and fix everything around it.

## 1. Inventory before touching anything

Open the existing screen, render it (`shoot.mjs`) and read its source. Write a Keep list to
`keep.txt` in the working folder before any new layout exists. Each plain line is visible text
exactly as it must appear on the redesign (a label, a figure's name, a price). Lines starting
with `#` are notes `keep.mjs` does not check: put routes, ids, colours and typefaces there.
`keep.mjs` compares link targets and form field names by itself. Cover:

- the product name and the screen's job
- every navigation label, exactly as written, and every link target and route
- form field names and ids, query parameters, anything another system reads
- the data shown: which figures, which columns, which states
- copy that carries meaning: prices, plan names, legal text, error wording people search for
- what the brand owns: logo, brand colour, a typeface the brand chose
- what each colour means: red for down, green for live, the colour of an overdue row

Then write what is broken, as findings from `references/review.md`: missing states, failed
contrast, slop, hierarchy that hides the job. These are what the redesign fixes.

## 2. Decide the scope

| The brief says | Scope |
|---|---|
| Fix it, clean it up, make it professional | **Evolve.** Same structure and identity; fix the floor (states, contrast, hierarchy, slop) |
| Redesign it, improve it, it looks dated | **Rework.** New layout, hierarchy and colour system; identity and the Keep list stay |
| Rebrand, new look, start again | **Rebuild.** Only the Keep list's functional items stay; ask before dropping brand items |

Default to the smaller scope when the brief is unclear, and say which one you chose.

## 3. What counts as identity

- **The brand's hue stays; the page does not.** Carry a brand colour across with
  `palette.mjs --brand <hex>`. That keeps the hue, derives the text-safe version and the
  states, and puts it on the neutral base. A bone or cream page, a tinted sidebar or a
  gradient is a default the last builder took, not identity. Move it to white, grey or black.
- A typeface stays when the brand chose it on purpose. A default nobody chose (see
  `slop-floor.md`) is replaced.
- Names stay. A label people know beats a label that is slightly better.

## 4. Change in this order

Each lever is cheaper than the next and fixes more:

1. Hierarchy and layout: the job is the largest block, top-left first.
2. States and the invisible layer: empty, loading, error, disabled, focus.
3. Colour: regenerate on tokens from `palette.mjs`; destructive actions move to `--danger`.
4. Type: one family, a fixed scale.
5. Spacing and radius: one system.
6. Copy: only where it is wrong, vague or slop. Keep its meaning.

Stop at the lever the scope allows. An Evolve rarely needs lever 1.

## 5. Things that never change silently

Navigation labels, link targets and routes, form field names, the product name, the logo,
prices and plan names, legal copy, the data, and what each colour means. If one of them must
change, name it in the report with the reason. Silence is the failure, not the change.

## 6. Prove it

```bash
node scripts/keep.mjs existing.html index.html --keep keep.txt
```

`keep.mjs` reads HTML as written. When either page builds its content with script, compare the
rendered pages instead: `shoot.mjs` saves each as `<name>.rendered.html` in its output folder.

It fails when a link target, a navigation label, a form field or a Keep line is gone, and
warns when a number on the original no longer appears. Fix each FAIL, or name it in the
report as a deliberate change with its reason. Then run the normal Check (step 11 of
`SKILL.md`) on the new screen, and compare its screenshots with the original's side by side.
