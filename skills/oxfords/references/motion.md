# Motion and feel

Motion in a plain interface has one job: to explain what just happened. If an animation does
not show a state change, a relationship or a response, remove it.

## Response comes first

- Acknowledge a press as it starts, within 100ms. A slight dim or a scale to about 0.97.
- Never block input while something animates. The user can always act again.
- Look for delays you added yourself: debounces on buttons, timers before a transition,
  waiting for one animation before starting the next.
- Anything dragged follows the pointer exactly, for the whole gesture.

## Timing

| What | Duration |
|---|---|
| Press and hover feedback | 100-150ms |
| Routine state change | 150-250ms |
| Overlay, sheet, layout shift | 250-400ms |
| Page or screen navigation | up to 500ms |

- Exits are quicker than entrances.
- Above 600ms on a phone feels slow.
- Product UI stays at the fast end. No sequence plays when a product page loads.

## Easing

- Ease out. Fast start, gentle stop.
- No overshoot, no bounce, no elastic. A thing that fades in has no reason to wobble.
- The one exception is something the user throws: a flicked sheet or a dismissed card may
  settle with a small overshoot, because it carries real momentum.
- Never linear, and not the browser's default ease on everything.
- A reversible transition uses the mirror of its opening curve to close.

## Where things come from

- A panel leaves the way it arrived. In from the right means out to the right.
- A menu, popover or sheet grows from the control that opened it.
- A modal dims and pushes the page back. A panel that works alongside the page does not dim it.
- Frames in between should hint at where the motion is going.

## What to animate

- Transform and opacity only. Never width, height, margin, padding, top or left.
- For anything the user can grab, do not use a fixed-length transition. Start from where the
  element actually is and carry its speed, so it can be reversed mid-way.
- Distances are short: 10-20px for a slide.
- A list may stagger once. Sections do not each perform an entrance.
- The page is complete without script. Nothing waits invisible for a reveal.

## Gestures

- A drag commits to a direction after about 10px of movement.
- Whether a swipe completes or returns depends on its speed and direction at release, not
  only on how far it travelled.
- At a limit, the element resists and springs back. It does not stop dead.
- A press can be cancelled by sliding off the control.

## Reduced motion

Reduced motion means gentler, not none. Removing all feedback makes the interface worse for
the people who asked for less movement.

- Replace slides, zooms and parallax with a short cross-fade (about 200ms).
- Keep colour and opacity changes that show state.
- Stop marquees, looping backgrounds and scroll-linked effects completely.
- Honour three settings separately: reduced motion, reduced transparency (make translucent
  surfaces solid) and increased contrast (add a defined border).
- Fade between light and dark themes so the brightness does not jump.

## Translucency

- Blur and glass are for the navigation layer that floats over content. Not for cards, not
  for dashboards, never one translucent surface on another.
- Always provide a solid fallback.
- Text over a translucent surface needs more weight and more contrast than usual.

## Sound and haptics

Only for meaningful moments, on the same frame as the visual change, and never on every tap.
