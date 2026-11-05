# Oxfords (paste into your AGENTS.md)

When building, changing or reviewing any user interface in this project, read
`skills/oxfords/SKILL.md` first and follow it: work its Build order, read the reference file
it names for the surface you are working on, generate every colour with
`node skills/oxfords/scripts/palette.mjs`, and fill its Done gate. Before reporting a screen
done, run `node skills/oxfords/scripts/check.mjs <path>` on the source and
`node skills/oxfords/scripts/shoot.mjs <page>` on the page, and look at the screenshots. To audit a page for AI slop, follow
`skills/oxfords/references/audit.md`: run `node skills/oxfords/scripts/audit.mjs <url or page>`
and hand over the HTML report it writes.

This project's own `DESIGN.md`, design system, tokens and brand rules take priority over Oxfords.
