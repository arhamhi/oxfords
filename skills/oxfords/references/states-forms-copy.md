# States, forms and copy

Think in states, not screens. The happy path is the smaller half of the work.

## Every state of the main screen

Design these on the core screen before anything else, and make each reachable (a query
parameter is enough) so it can be looked at.

| State | What it shows |
|---|---|
| First run | One sentence on what will appear, and the one action that fills it |
| Cleared by the user | That it is empty on purpose, and how to bring things back |
| No results | The query quoted back, a likely fix, a way to clear the filter |
| Loading | Nothing for the first 300ms, then a skeleton shaped like the result (in a static mock, showing the skeleton state is enough) |
| Partial or stale | What arrived, and how old it is |
| Error | What failed, why if known, how to recover, a retry |
| Offline | A banner, and what still works |
| No permission | Why, and who can grant it |
| Overflow | Long names, huge numbers, thousands of rows |

- Never a lone spinner in the middle of a blank page.
- Loading text names the real operation. Show real progress when you have it. Never fake it.
- Stress the layout with an 80-character name, a seven-digit number, 10,000 rows and labels a
  third longer than English.

## Feedback

- Every action gets a response where the user is already looking. The control changes in
  place, or a toast appears.
- Respond on press, not on release. Complete the action on release.
- Update the interface at once when the server will almost certainly agree, and roll back
  with an explanation if it does not.
- Disable a button while it submits so it cannot fire twice.
- A disabled control says why, in text beside it. A tooltip alone does not reach touch or
  keyboard users.
- Toasts confirm things that can be undone. They never carry an error that needs action.
  When an action did nothing (everything selected was already done), say so plainly.
- Keep the user's place and input through a refresh, an error and a tab switch.

## Destructive actions

- Prefer undo to "Are you sure?".
- When a confirmation is needed, name the object and the consequence. Label the button with
  the action: "Delete project", never "Yes" or "OK".
- Keep destructive actions away from the primary action.

## Forms

- A persistent label above every field. A placeholder is an example, not a label.
- State the format and the rules before the user submits.
- Validate when the user leaves a field, not on every keystroke and not only on submit.
- The error sits under its field and says how to fix it, without blame.
- Never clear the form on an error.
- Use the right input type, so the right keyboard appears and the browser can help.
- Inputs are at least 16px on phones, or the browser zooms on focus.
- Treat required and optional the same way everywhere.
- Ask for a permission at the moment the feature needs it, with one sentence on why.
- Fields must be visible against their background. No white field on a white card.
- Filtering data already on the page is instant. Debounce (about 300ms) only a search that
  calls the server.

## Errors by cause

| Cause | Response |
|---|---|
| Invalid input | Mark the fields |
| Signed out | Send to sign in, then return to the same place |
| Not allowed | Say so, and who can change it |
| Not found | A not-found state with a way onward |
| Too many requests | Say when to try again |
| Server failure | A plain message, a retry, and a route to support |

Never show an internal code as the main message.

## Copy

- Write every string before the layout. Then reread each one and replace anything cute,
  vague or clever with the plain sentence.
- Name things as the user knows them, not as the system stores them.
- One word per concept, everywhere. If it is "project" in one place it is not "workspace" in
  another.
- Buttons are a verb and an object when the outcome is not obvious. Label the outcome.
- Say each thing once. Delete an introduction that repeats its heading.
- Success messages are short. Add a next step only if the user must now do something.
- Link text makes sense out of context.
- Sentence case for labels and headings.
- Navigation items are named for what they contain, not "Home" and "Explore".
- Alt text carries the information in the image. Decorative images have empty alt text.
- Use real, uneven data in examples. It is the cheapest way to look finished.
- Dates, numbers and currency are formatted for the user's locale. Plurals use real rules.

## Accessibility floor

- Text contrast 4.5:1. Large text, icons, input borders and focus rings 3:1. Only disabled
  controls are exempt.
- A visible focus indicator on everything focusable. Tab order follows reading order. No
  traps. Esc closes overlays. Focus moves into a dialog and returns when it closes.
- Real buttons and links. One top-level heading, no skipped levels.
- State is never shown by colour alone.
- Changes that happen without a page load are announced.
- The layout survives 200% zoom and the system's larger text setting.
- Nothing is available only on hover.
- Controls keep a border or outline in high-contrast modes. Do not rely on a background or a
  shadow alone to show where a control is.

## The surfaces nobody themes

Text selection, the text cursor, scrollbars, the focus ring, link underlines and number
alignment all have browser defaults. Setting them from the palette is a small job, and it is
the difference between a page that was built and one that was assembled.
