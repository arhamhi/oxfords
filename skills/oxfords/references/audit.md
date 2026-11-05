# Auditing a page for AI slop

For "audit my site", "how AI does this look", "score this page", "what makes this look
generated". The answer is a score out of 100, a bar for each of five areas, and a report with the
page's own screenshots, every tell boxed and numbered, ranked by what it costs. The audit
reports; it does not change the page. Fixing is the Fix command, one finding at a time.

`review.md` is the full design review (tasks, wayfinding, states, severity). The audit is
narrower: how much of the page reads as machine-made, and what to change first.

## 1. Measure

```bash
node scripts/audit.mjs <url or file.html> --out oxfords-audit
```

It opens the page in Chromium at 1440 and 390 wide, and:

- runs the render check from `shoot.mjs` for contrast, clipping, overlap, focus, targets and names
- reads the rendered page for the tells in `slop-floor.md`: fonts as rendered, monospace and
  italic share, ALL CAPS lines, eyebrows, full stops on titles, code breadcrumbs, pills, divider
  lines, bordered and nested boxes, gradient backgrounds, side rails, fake window chrome, crowds
  of tiny labels, subtitles that repeat their heading
- runs `check.mjs` over the page's copy and stylesheets for the copy bans and the page colour

It writes `oxfords-audit.html` (the report, one self-contained file), `oxfords-audit.json`
and the screenshots. `--quick` skips the render check; Finish then goes unmeasured, so say so.
Exit code 3 means no browser: say plainly that nothing was rendered, and stop. A score
from reading code alone is not an audit.

Everything is measured on one page in its first state. Other pages, menus, modals and anything
behind a login are not seen. Audit each page that matters separately.

## 2. Look

The script cannot see everything. Open the two screenshots it saved (`desktop.jpg`,
`phone.jpg`), or better, give them to a fresh subagent with this file and nothing else, as
`review.md` describes. Look for what only eyes catch:

| Rule | Look for |
|---|---|
| `over-detailed-ui` | Mock dashboards, floating cards, badges and charts nobody can read; detail that is texture, not information |
| `verbose-copy` | Paragraphs that say the heading again, three sentences where one works, every section with heading, subheading and paragraph saying the same thing |
| `bordered-boxes` | A card around every block, when the script's count does not show it |
| any other | Write it with `cat` (type, colour, layout, copy, finish), `title`, `fix` and `why` |

Also judge each measured tell: is it something the brand owns? A purple gradient that has been
the company's colour for ten years is a choice, not slop. Mark it kept, with the reason.

Write the notes as a JSON array:

```json
[
  { "rule": "verbose-copy", "text": "Hero: 74 words before the first button" },
  { "cat": "layout", "title": "A logo wall of companies that are not customers", "fix": "Show real customers or nothing", "why": "Fake proof is the first thing a buyer doubts", "level": "fail" },
  { "rule": "purple-gradient", "keep": "the brand colour since 2014" }
]
```

`level` is `warn` unless the note says `fail`. Add a note only for what you can point at on the
screenshot. Then rebuild the report without rendering again:

```bash
node scripts/audit.mjs --from oxfords-audit/oxfords-audit.json --notes notes.json
```

## 3. Show

Give the person the report, not a wall of text:

- In Claude, publish `oxfords-audit.html` as an artifact (it is self-contained and passes
  its own checks), or open it in the browser pane.
- Elsewhere, open the file in a browser, or tell the person its path.

Then, in chat, three lines at most: the score and band, the three tells that cost the most,
and what was not checked. Do not repeat the report.

## How the score works

Each area (Type, Colour, Layout, Copy, Finish) starts at 20. A tell marked Must fix costs 7,
one marked Worth fixing costs 4, and each extra place it shows up costs 1 more, up to 3. An
area never goes below 0. Kept tells cost nothing and are listed as kept.

| Score | Band |
|---|---|
| 90-100 | Reads as designed |
| 75-89 | A few tells |
| 55-74 | Generated in places |
| 35-54 | Reads as generated |
| 0-34 | Template |

A high score means the page avoids the known tells and the measured failures. It does not mean
the page is good. Read it with the look pass, and say both.

## After the audit

When the person wants it fixed, switch to Fix: change only what a finding names, most costly
first, keep their copy and identity, then run the audit again and report the new score
against the old one.
