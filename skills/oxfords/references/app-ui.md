# App UI: dashboards, tables, settings

Product UI is scanned and operated, not read. It is denser than a marketing page, follows its
grid more strictly, and has less room for expression. Calm is the goal.

## Shell

- Choose the shell from the work. A product with many destinations gets a sidebar. A product
  with four screens gets a top bar. A single working surface (an editor, a canvas, an inbox)
  gets neither by default.
- When there is a sidebar, it is the spine: workspace or account switcher at the top, one
  icon and a short title per link, links grouped by relevance, settings and help at the
  bottom. It takes roughly a sixth of the width.
- Show where the user is with a full-row fill behind the active link. Not a coloured bar on
  its edge.
- About five items in the main group. Settings and help sit apart at the bottom and do not
  count toward the five.
- A link to a page that does not exist yet is fine in a prototype. A button that does
  nothing when pressed is not.
- The top of the page holds that page's title and its actions. One primary action.
- As links multiply, nest them. Tabs add views to a page without growing the sidebar.
- Toasts, an onboarding checklist and feature announcements share one slot, usually bottom
  right. Design that slot once.

## What goes in the main area

- Position declares priority. Sort every module into high, medium or low and place the high
  ones top-left. Day-to-day work outranks reference material.
- The work owns the screen. If the product is about orders, the orders are the largest block.
- Merge modules that describe the same thing. Delete any module you cannot explain in one
  sentence.
- Every control must make sense for the real object it sits on. Check each button against
  what a person can actually do with that thing.
- Outer edges and gutters align across columns. Row boundaries between columns do not have to.

## Key figures

- At most four, in one ruled strip, not four cards.
- Each carries a comparison (change against the last period, or a target). A bare number with
  an icon says nothing.
- A small trend chart is allowed only when it is drawn from real data and shows something the
  number does not.
- Show them once, on the page where they matter. Never repeat them down the sidebar or on
  every page.
- The figures strip sits above the work and stays small. The work is still the largest block.

## Tables and lists

- Build the table from the shape of the data. Fixed sets become chips. A chip is quiet by
  default: plain text with a small mark, or a neutral outline. Only a state that needs
  attention gets a tint. A person is a name,
  with a photo only if it is a real one. Urgent items carry a mark that others do not.
- Text left, numbers right with tabular figures, the identifying column in the strongest
  weight, secondary columns quieter.
- Separate rows with space first. When rows must be tight, use a very pale alternating fill
  or a single hairline. Never lines and fills and borders together.
- Truncate long text with an ellipsis and make the full value available on hover and focus.
  When a row has a right-aligned value, the text ends before it.
- One visible action per row. The rest go in a menu, or appear on hover with the same
  actions reachable by keyboard and on touch.
- Rows are selectable by a checkbox (it can replace the row's avatar or icon on hover, or
  simply always be there). Selecting reveals a bulk action in the toolbar that is already
  there. The bulk action does not count against one action per row.
- Add search, filter or sort. Put filters, tabs and the selected item in the URL so a view
  can be shared and Back works.
- Show time relative when recent ("12 min ago"), absolute when old, and the absolute value on
  hover.
- Row height: 28-32px compact, 36-44px comfortable. Dense where people compare, roomy where
  they decide.
- Paginate or virtualise long lists. Prefer "Load more" to infinite scroll so the footer
  stays reachable.
- In a horizontal scroller or a clipped list, cut the last item at the edge so it reads as
  scrollable.

## Charts

- Start with a plain line for a trend or plain bars for comparison. No novelty chart types.
- Always: values on the axis, grid lines, labels, and a control for the range or metric.
- Bars sit on the baseline with flat tops. Lines are straight segments at full strength.
- On hover or focus, show the value and dim the others. The same value must be reachable
  without a pointer.
- Card anatomy: title or headline figure top-left, control top-right, plot below. The
  headline figures double as the legend.
- Add a chart only when it shows a pattern the numbers do not. A headline figure may be the
  last point of a chart. What to avoid is the same series shown twice.
- Colour comes from the data. Encode with lightness, shape or a label as well, never hue
  alone. Once the charts carry the accent, the primary button goes neutral.

## Overlays

- Inline editing first, when the change is small.
- Popover for light context the user can click away from.
- Modal for a complex task that relates to the page behind it. Two columns of fields, advanced
  options collapsed, one action button. Follow it with a toast, because the page was hidden.
- New page for anything large or permanent, with a back link or breadcrumb.
- Overlays must not be clipped by a scrolling or hidden-overflow parent. Use the dialog
  element, the popover API or a portal.

## Onboarding

- Do not land a new user on a fully loaded screen with a list of bullets in a modal.
- Start with one pointer at the most important action. Then a second, or a short checklist in
  the corner. Everything skippable, nothing shown twice.

## The hidden layer

A finished product has as much interface hidden as visible: tooltips, hover actions, copy
buttons on cells, row menus, column menus, sort and filter builders, comment markers. List
them before you build and size rows and gaps with them in mind. A new feature often needs a
place in this layer, not a new page.

## At phone width

This is for a web app opened on a phone. For a native app, read `mobile.md`.

- Keep the product's own type scale: 14-16px body. Inputs are 16px.
- A sidebar becomes a bottom bar of up to five destinations. Everything else, including
  settings and help, moves into a "More" item or the account menu. Nothing becomes
  unreachable.
- A table becomes a list of stacked rows: the identifying value and the amount on the first
  line, secondary values beneath, the row's action full width or behind a tap.
- Drop columns before you shrink text.
- A modal becomes a bottom sheet.
- Targets are 44px. Hover-revealed actions are always visible or in a menu.

## Colour in product UI

- The page is white, black or grey, and so are the table, the text and the lines. See
  `palettes.md` for the neutral steps.
- Choose a palette and place it on top. The lead colour goes on the primary action, the
  selected item and the chart's main series.
- Give the palette at least one solid block so it is more than a button: the sidebar, the
  top bar, or one panel in the lead or support colour.
- The support colour takes a second series or a secondary block. The pop marks the one thing
  that needs attention.
- Quiet chips, secondary text and dividers are neutral greys.

## Dashboard type and density

- One family. A fixed scale in small steps, for example 24 / 20 / 16 / 14 / 12.
- Body at 13-14px, metadata no smaller than 11-12px.
- Do not apply reading line-lengths to data. Tables can be wide.
- No display font on labels, buttons or data.
