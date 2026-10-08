# Mobile app screens

For native apps. A web app opened in a phone browser follows `app-ui.md`, "At phone width".

A phone is not a small desktop. Space is the scarce thing, so every screen answers one
question: what is the one job here?

## Size and density

- Do not shrink type and spacing to fit desktop density. Body text is 17pt on iOS and never
  below 15 for primary content. Secondary 15, metadata 13, floor 11.
- Where the desktop showed five things, pick one. If something will not fit, remove the least
  important element. Never shrink the text.
- Support the system text size setting. Design at the default, then check the largest size:
  horizontal groups should stack.
- Use one side margin for the whole app (16-20pt) and keep it.

## One screen, one job

- Settings is only settings. An editor is only an editor. The home screen is the exception.
- New content gets a new screen, not a second layout stacked on this one.
- Each section extends in one direction: a vertical stack or a horizontal scroll. Never both.
  This is the rule for converting a desktop dashboard.
- Almost everything is a card, because cards group where white space cannot. Do not put a
  card inside a card: padding stacks on padding. Group with space instead.
- Not everything is a list. An app that is all lists reads as a settings panel.

## Navigation

- A tab bar holds two to five destinations. Destinations, not actions.
- Keep the primary action out of the middle of the tab bar. Put it at the end of the bar as
  its own control at the same height, as the trailing button in the top bar, or inside the
  screen it belongs to. Give it a label or a universally known icon.
- Keep one bottom layout across the app and swap its contents per screen.
- If there are too many destinations for a bar, make the list of destinations the home
  screen and give the bottom to search and the primary action.
- Top-level screens use a large title that collapses on scroll. Detail screens use a small
  inline title. Content scrolls under the bar.
- Never block the system back gesture.

## Actions come and go

- Show actions only when they apply. Opening an item hides the navigation and reveals that
  item's actions.
- When a screen's actions change, put the new ones in the same physical places as the old
  ones (back becomes close, share becomes confirm). Do not move them.
- Destructive actions never sit next to the primary action.
- The add button either opens a short menu or opens an input ready to type.

## Sheets, pushes and covers

- A bottom sheet is for a task the user does without leaving context: a title, a search
  field, the options. Give it resting heights and a grabber.
- A push is for going deeper.
- A full-screen cover is for a mode, such as a camera or a workout.
- When a sheet rises, the screen behind steps back slightly and dims.

## Gestures

- Swipe back to return, with both screens moving together.
- Long press is the phone's right click: lift the item, show its actions next to it, dim the
  rest.
- Swipe actions and pull-down hold secondary actions so rows stay clean.
- Any gesture you depend on must be taught once, and must have a visible alternative.
- Elements under a finger follow it exactly, then settle with the speed they were released
  at. Edges resist instead of stopping dead.

## Platform manners

- Tab bar items are an icon with a label under it. A text-only tab bar reads as a web page.
- In a mock, draw the status bar the way the system does (time, signal, battery glyph) or
  leave the space empty. Never write it out as words.
- A mock needs the main screen and the main flow to work. Other tabs can open a plain
  placeholder that names what will be there.
- Without swipe, give a row's secondary actions a visible route: an edit mode, or a menu.
- One large figure per screen may sit outside the type scale. It is the thing the screen is
  for. It does not need a card around it.

- Use the platform's icon set and system font unless there is a stated reason. A screen that
  looks ported from a web page loses trust.
- Targets are 44pt on iOS and 48dp on Android.
- Respect safe areas at the top and bottom. Leave room so the last item clears a floating bar.
- Settings use the platform's grouped list. No bespoke stack of cards.
- Glass and blur belong to the navigation layer only. Never on content, never glass on glass.
- Haptics mark meaningful moments: a selection snapping, a success, an error. Not every tap.
- Light and dark are both first-class. Dark mode is designed, not inverted.

## Empty states

- Design the first-run screen, not only the full one.
- One centred block that says what will appear and points at the action that fills it. Not an
  empty card for each section.
- No results: acknowledge the search, suggest a correction, give a way out.
