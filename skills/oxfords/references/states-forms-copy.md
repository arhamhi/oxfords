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
| Loading | Where data loads: nothing for the first 300ms, then a skeleton shaped like the result (in a static mock, showing the skeleton state is enough). Data already on the page: none |
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
- State colours come from the tokens: hover a step lighter, pressed a step darker, disabled
  grey (`--action-disabled`, `--text-disabled`). Disabled is never shown by opacity alone.
- A disabled control says why, in visible text next to it. In a row of buttons the reason
  takes its own line above the row. A tooltip alone does not reach touch or keyboard users.
- Mark a control that is waiting on the user ("Save" before anything changed) with
  `aria-disabled="true"`, so it stays focusable and its reason is read out. Use the native
  `disabled` attribute only while an action is in flight, with the button's label saying so
  ("Saving…" is the reason).
- Toasts confirm things that can be undone. They never carry an error that needs action.
  When an action did nothing (everything selected was already done), say so plainly.
- Keep the user's place and input through a refresh, an error and a tab switch.

## Destructive actions

- Prefer undo to "Are you sure?".
- When a confirmation is needed, name the object and the consequence. Label the button with
  the action: "Delete project", never "Yes" or "OK".
- Keep destructive actions away from the primary action.
- Destructive buttons use `--danger` with `--on-danger`, even when the brand is red, so a
  delete never looks like the brand's main action.

## Forms

- A persistent label above every field. A placeholder is an example, not a label. The one
  exception is a table or list toolbar: its search field may use a search icon, a placeholder
  that names what is searched ("Search orders") and an accessible name, and its filter menus
  may carry the label inside the control ("Status: All").
- State the format and the rules before the user submits.
- Validate when the user leaves a field, not on every keystroke and not only on submit.
- Reserve the space an error line needs, so a message appearing on blur never moves the button
  the pointer is already on its way to.
- The error sits under its field and says how to fix it, without blame. It is set in
  `--danger-ink` with an icon, and the field's border turns `--danger`.
- Never clear the form on an error.
- A form with unsaved changes offers Discard beside Save, and asks before the page is left
  with changes still in it.
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
- Labels and captions describe the content, never how to operate the screen ("Point at a bar
  to see its value"). A screen that needs instructions has an unclear control: fix the
  control.
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
alignment all have browser defaults. Setting them from the tokens is a small job, and it is
the difference between a page that was built and one that was assembled:

- `::selection` in `--lead-tint` with `--text`
- `caret-color` in `--lead-ink`; `accent-color` in `--action`, so checkboxes and radios stay
  neutral
- `scrollbar-color: var(--line-strong) transparent` (colour the native scrollbar, do not
  rebuild it)
- the focus ring in `--focus`
- link underlines with `text-underline-offset` set
- tabular figures where digits line up
