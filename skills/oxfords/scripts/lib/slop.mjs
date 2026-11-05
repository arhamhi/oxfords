// Oxfords audit: what each tell is, how the rendered page shows it, and how it is scored.
// Zero dependencies. judgeSlop() reads what slop-inpage.mjs collected; score() turns every
// finding (from here, from check.mjs and from the render check) into one number out of 100.

import { parse, toOklch, hueFamily, NEUTRAL_C } from './colour.mjs';

export const CATS = [
  { id: 'type', label: 'Type' },
  { id: 'colour', label: 'Colour' },
  { id: 'layout', label: 'Layout' },
  { id: 'copy', label: 'Copy' },
  { id: 'finish', label: 'Finish' },
];
export const CAT_MAX = 20;

// Every tell the audit can report. title is the symptom, fix is the plain replacement, why is
// the reason in one line. Rules from check.mjs and the render check keep their own ids.
export const TELLS = {
  // Type
  'default-font': ['type', 'A default font nobody chose', 'Use the system font stack, or a face you can give a reason for', 'Inter, Geist, Instrument Serif and the rest are what every generated page reaches for'],
  'mono-costume': ['type', 'Monospace used as a costume', 'Keep monospace for code, figures and measurements; set labels and headings in the text face', 'Monospace on everything reads as "technical" decoration, not information'],
  'italic-heading': ['type', 'Italic words dropped into headings', 'Let the heading stand in one style; emphasise with weight once, if at all', 'An italic word in every headline is the current generated signature'],
  'italic-copy': ['type', 'Too much italic text', 'Set running text upright; keep italic for titles and the odd stressed word', 'Italic everywhere is harder to read and stops meaning anything'],
  'serif-swap': ['type', 'A second typeface dropped into a headline', 'Use one family; emphasis is the same family in another weight', 'A serif word inside a sans headline is a template move'],
  'caps-subtitle': ['type', 'ALL CAPS on text meant to be read', 'Set subtitles and paragraphs in sentence case', 'Capitals for a whole line slow reading and shout'],
  'eyebrow': ['type', 'A small uppercase label above every heading', 'Delete the label, or fold its information into the heading', 'Eyebrows repeat what the heading already says'],
  'tiny-text': ['type', 'Text under 11px', 'Raise it to 12px or more, or cut it', 'Nobody can read it, so it is decoration'],
  // Colour
  'bone-page': ['colour', 'A bone or cream page', 'Make the page white, black or a neutral grey and put the colour on content', 'Cream with an orange accent is the most common generated look right now'],
  'tinted-page': ['colour', 'A tinted page background', 'Make the page neutral; the palette belongs on content', 'A tinted ground leaves the palette nothing to stand out against'],
  'warm-dark-page': ['colour', 'A warm brown dark page', 'Check it was chosen; the default dark page is a neutral near-black', 'Brown-black is a popular generated dark mode'],
  'purple-gradient': ['colour', 'A purple or indigo gradient', 'Use a flat colour from the palette', 'Purple gradients are the oldest AI landing-page tell'],
  'gradient-bg': ['colour', 'A gradient background', 'Use a flat surface; let a real image or the content carry the colour', 'Soft colour gradients behind sections are a generated default'],
  'gradient-text': ['colour', 'Gradient-filled text', 'Set text in one solid colour', 'Gradient text is decoration that hurts contrast'],
  'glow': ['colour', 'A coloured glow', 'Use a two-layer neutral shadow, or none', 'Glows are decoration and smear edges'],
  'one-blue-button': ['colour', 'The only colour is one blue button', 'Put a real palette on the content, keep controls neutral', 'A grey page with one blue button is the unstyled default'],
  'hue-sprawl': ['colour', 'Too many saturated colours', 'Keep to the three palette colours plus the semantic ones', 'A different colour for everything means nothing stands out'],
  'too-many-hues': ['colour', 'Too many saturated colours on screen', 'Keep to the three palette colours plus the semantic ones', 'A different colour for everything means nothing stands out'],
  'alpha-text': ['colour', 'See-through text for hierarchy', 'Use solid grey text tokens', 'Translucent text changes with whatever is behind it'],
  'danger-as-brand': ['colour', 'The brand colour on a destructive action', 'Use the danger colour for delete and remove', 'Destructive actions must never look like the main action'],
  // Layout
  'pill-overuse': ['layout', 'Tags and pills everywhere', 'Keep a pill for one real status; label the rest with plain text', 'A row of rounded tags is filler that looks like information'],
  'divider-overuse': ['layout', 'A divider between everything', 'Separate with space; keep one rule where the content changes', 'Lines everywhere flatten the hierarchy into a spreadsheet'],
  'bordered-boxes': ['layout', 'A bordered container around everything', 'Group with space and alignment; keep a card only for a truly separate object', 'Boxes on every block is the generated grid look'],
  'nested-boxes': ['layout', 'Boxes inside boxes', 'Remove the inner border; one container is enough', 'Border on border is noise with no meaning'],
  'accent-rail': ['layout', 'A coloured bar down the side of an element', 'Use a full-row fill for the selected item, or nothing', 'The side rail is a stock generated accent'],
  'fake-chrome': ['layout', 'Fake window chrome (traffic-light dots)', 'Show the real product, cropped, or nothing', 'A mock window frame is over-detailed decoration'],
  'dense-mock': ['layout', 'Over-detailed mock UI in the first screen', 'Show one real, legible screen or one clear claim', 'Dozens of tiny fake labels read as busy, not capable'],
  'emoji': ['layout', 'Emoji used as icons', 'Use one icon set, matched to the text weight, or plain words', 'Emoji icons are the fastest tell there is'],
  'greeting-header': ['layout', 'A greeting as the page title', 'Title the page by what it holds', 'Good morning, Alex is the generated dashboard opener'],
  'over-detailed-ui': ['layout', 'Over-the-top detailed UI', 'Cut the decorative detail; one strong focal point', 'Detail nobody can read is noise'],
  // Copy
  'period-title': ['copy', 'Headings ending in a full stop', 'Drop the full stop; a title is a name, not a sentence', 'Full-stop headlines ("Built for teams.") are the current template voice'],
  'code-breadcrumb': ['copy', 'Code syntax as decoration', 'Write the label plainly, without // or ~/', 'Fake code breadcrumbs pose as technical without saying anything'],
  'redundant-sub': ['copy', 'A subtitle that repeats the heading', 'Make the subtitle add something the heading does not say, or cut it', 'Saying it twice doubles the reading for no new information'],
  'verbose-copy': ['copy', 'Verbose, redundant text', 'Cut each block to the sentence a colleague would say', 'Long padded copy is the clearest sign nobody edited it'],
  'em-dash': ['copy', 'Em dashes in the copy', 'Use a comma, a full stop or brackets', 'Em dashes everywhere are a known AI writing tell'],
  'buzzword': ['copy', 'Marketing filler words', 'Say what it does in plain words', 'Seamless, unlock, elevate: words that say nothing'],
  'vague-button': ['copy', 'Vague button labels', 'Name the outcome: "Book a call", "Create invoice"', '"Get started" and "Learn more" tell the user nothing'],
  'placeholder-content': ['copy', 'Placeholder names or text', 'Use believable real content', 'Acme and Jane Doe mark an unfinished template'],
  'exclamation': ['copy', 'Exclamation marks in the interface', 'Remove them', 'Interfaces that shout sound fake'],
  // Finish (from the render check and the motion rules)
  'text-contrast': ['finish', 'Text too low in contrast', 'Darken the text or lighten the background to 4.5:1', 'People cannot read it in daylight or with weaker eyes'],
  'clipped-text': ['finish', 'Text cut off', 'Let the box grow, wrap, or truncate with the full value available', 'Clipped words look broken'],
  'overlapping-text': ['finish', 'Text running into other text', 'Fix the spacing or the layout at this width', 'Overlaps look broken'],
  'sideways-scroll': ['finish', 'The page scrolls sideways', 'Find the element wider than the screen and let it wrap', 'Sideways scroll on a phone feels broken'],
  'hidden-overflow': ['finish', 'Content cut off at the screen edge', 'Let the wide element wrap instead of hiding the overflow', 'Hidden overflow hides content'],
  'target-size': ['finish', 'Click targets too small', 'Make controls at least 24px, 44px on touch', 'Small targets cause misclicks'],
  'no-name': ['finish', 'Controls with no name', 'Give every icon-only control an accessible name', 'Screen readers announce "button" and nothing else'],
  'placeholder-label': ['finish', 'Fields labelled only by placeholder', 'Put a visible label above the field', 'The placeholder disappears as soon as someone types'],
  'field-border': ['finish', 'Form fields you cannot see', 'Give fields a border or fill at 3:1', 'People miss fields they cannot see'],
  'focus-invisible': ['finish', 'No visible keyboard focus', 'Add a clear :focus-visible ring', 'Keyboard users lose their place'],
  'focus-ring': ['finish', 'Focus ring too faint', 'Make the ring 3:1 against what is around it', 'Keyboard users lose their place'],
  'focus-offscreen': ['finish', 'Focus lands off screen', 'Hide off-screen items from the tab order', 'Keyboard users tab into nothing'],
  'focus-escapes-modal': ['finish', 'Focus escapes the open modal', 'Trap focus in the modal while it is open', 'Keyboard users end up behind the modal'],
  'hidden-content': ['finish', 'Content hidden until a script reveals it', 'Render content visible by default', 'If the script is slow or fails, the page is blank'],
  'img-no-alt': ['finish', 'Images without alt text', 'Add alt text, or alt="" for decoration', 'Screen readers read the file name'],
  'bounce': ['finish', 'Bouncy motion', 'Ease out with no overshoot', 'Bounce is a toy-like default'],
  'marquee': ['finish', 'A marquee or auto-scrolling strip', 'Show the logos still, or cut them', 'Moving strips pull the eye away from the content'],
  'pulse': ['finish', 'Pulsing elements', 'Keep pulsing only for live data', 'Constant pulsing is noise'],
  'hover-lift': ['finish', 'Cards that lift or grow on hover', 'Change colour or border on hover instead', 'Lifting cards is a stock generated effect'],
  'custom-cursor': ['finish', 'A custom cursor', 'Use the system cursor', 'Custom cursors fight the platform'],
  'render-error': ['finish', 'The page did not render', 'Check the URL loads', 'Nothing could be measured'],
};

// Rules from check.mjs the audit takes from the page's own copy and stylesheets. The rest are
// code hygiene, or measured better on the rendered page.
// A stylesheet holds rules for every page of a site, so only page-wide colour and the strongest
// tells come from it. Everything structural is measured on what this page renders.
export const FROM_CHECK = new Set(['em-dash', 'buzzword', 'vague-button', 'placeholder-content', 'exclamation',
  'greeting-header', 'emoji', 'img-no-alt', 'bone-page', 'tinted-page', 'warm-dark-page', 'purple-gradient',
  'gradient-text', 'one-blue-button']);

const BANNED_FONTS = ['inter', 'geist', 'roboto', 'open sans', 'lato', 'poppins', 'montserrat', 'manrope', 'dm sans',
  'plus jakarta sans', 'space grotesk', 'outfit', 'instrument serif', 'playfair display', 'fraunces', 'cormorant',
  'lora', 'dm serif display'];
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'you', 'that', 'this', 'from', 'into', 'our', 'are', 'all',
  'every', 'more', 'less', 'than', 'what', 'when', 'will', 'can', 'its', 'it', 'a', 'an', 'to', 'of', 'in', 'on', 'is']);
const content = t => new Set((t.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 2 && !STOP.has(w)));
const isCaps = x => x.tt === 'uppercase' || (/[A-Z]{2}/.test(x.t) && !/[a-z]/.test(x.t) && (x.t.match(/[A-Z]/g) || []).length >= 6);
const mostlyFigures = t => (t.match(/[\d.,%$€£:+-]/g) || []).length >= t.replace(/\s/g, '').length * 0.6;
const firstScreen = (box, page) => box[1] < page.vh;

export const T = {
  monoShare: 0.15, italicShare: 0.1, pills: 5, boxes: 6, nested: 2, lines: 8, linesPerScreen: 3,
  denseText: 30, denseSize: 12, eyebrows: 2, italicHeads: 2, overlap: 0.6,
};

// Findings from one render of the page. Each: { rule, level, text, path, box }.
export function judgeSlop(d) {
  const out = [], add = (level, rule, text = '', path = '', box = null) => out.push({ level, rule, text, path, box });
  const page = d.page;

  // Fonts the page actually set.
  const seen = new Set();
  for (const [where, f] of [['body', d.fonts.body], ['headings', d.fonts.heading]]) {
    if (f && BANNED_FONTS.includes(f.toLowerCase()) && !seen.has(f)) { seen.add(f); add('fail', 'default-font', `${f} on ${where}`); }
  }

  // Text too small to read, as rendered.
  for (const x of d.texts.filter(x => x.fs < 11 && x.t.trim()).slice(0, 12)) add('fail', 'tiny-text', `${x.fs}px: ${x.t.slice(0, 40)}`, x.path, x.box);

  // A coloured bar down one side of an element.
  for (const r of d.rails) {
    const c = parse(r.colour);
    if (c && (c.a ?? 1) > 0.3 && toOklch(c).c >= NEUTRAL_C) add('fail', 'accent-rail', '', r.path, r.box);
  }

  // Monospace as costume: share of readable characters set in mono outside code and figures.
  const prose = d.texts.filter(x => !x.code && !mostlyFigures(x.t));
  const chars = prose.reduce((s, x) => s + x.len, 0);
  const mono = prose.filter(x => x.mono), monoChars = mono.reduce((s, x) => s + x.len, 0);
  if (chars > 200 && monoChars / chars >= T.monoShare)
    for (const x of mono.slice(0, 6)) add('warn', 'mono-costume', x.t.slice(0, 60), x.path, x.box);

  // Italics: in headings, and across running text.
  const italicHeads = d.heads.filter(h => h.italicKids > 0);
  if (italicHeads.length >= T.italicHeads) for (const h of italicHeads) add('warn', 'italic-heading', h.t, h.path, h.box);
  const body = prose.filter(x => !x.inHead && x.fs < 28), bodyChars = body.reduce((s, x) => s + x.len, 0);
  const ital = body.filter(x => x.italic), italChars = ital.reduce((s, x) => s + x.len, 0);
  if (bodyChars > 400 && italChars / bodyChars >= T.italicShare)
    for (const x of ital.slice(0, 4)) add('warn', 'italic-copy', x.t.slice(0, 60), x.path, x.box);
  for (const h of d.heads) if (h.famKids.length) add('warn', 'serif-swap', `${h.fam} with ${h.famKids.join(', ')}: "${h.t.slice(0, 50)}"`, h.path, h.box);

  // Capitals: whole subtitles in caps, and eyebrows sitting on headings.
  const brows = [];
  for (const x of prose) {
    if (!isCaps(x) || x.act) continue;
    if (x.words >= 4 && !x.inHead) add('warn', 'caps-subtitle', x.t, x.path, x.box);
    else if (x.words <= 5 && x.ls >= 0.04 * x.fs && x.fs <= 16) {
      const above = d.heads.some(h => h.box[1] - (x.box[1] + x.box[3]) >= -2 && h.box[1] - (x.box[1] + x.box[3]) <= 64 &&
        h.box[0] < x.box[0] + x.box[2] && x.box[0] < h.box[0] + h.box[2]);
      if (above) brows.push(x);
    }
  }
  if (brows.length >= T.eyebrows) for (const x of brows) add('warn', 'eyebrow', x.t, x.path, x.box);

  // Full stops at the end of titles.
  for (const h of d.heads) {
    const t = h.t.trim(), w = t.split(/\s+/).length;
    if (h.level <= 3 && /[^.\s]\.$/.test(t) && w >= 2 && w <= 16) add('warn', 'period-title', t, h.path, h.box);
  }

  // Code syntax as decoration.
  for (const x of prose) if (x.words <= 8 && /^(?:\/\/\s?\S|\/\*\s?\S|~\/\S|<\/>|>_|\$\s+[a-z])/.test(x.t)) add('warn', 'code-breadcrumb', x.t, x.path, x.box);

  // Pills that are labels, not controls.
  const tags = d.pills.filter(p => !p.act);
  if (tags.length >= T.pills) for (const p of tags) add('warn', 'pill-overuse', p.t, p.path, p.box);

  // Divider lines: many, and dense.
  const lines = d.lines.filter(l => !l.menu), screens = Math.max(1, page.h / page.vh);
  if (lines.length >= T.lines && lines.length / screens >= T.linesPerScreen)
    for (const l of lines) add('warn', 'divider-overuse', '', l.path, l.box);

  // Bordered boxes, and boxes inside boxes.
  if (d.boxes.length >= T.boxes) for (const b of d.boxes.filter(b => !b.depth)) add('warn', 'bordered-boxes', '', b.path, b.box);
  const nested = d.boxes.filter(b => b.depth > 0);
  if (nested.length >= T.nested) for (const b of nested) add('warn', 'nested-boxes', '', b.path, b.box);

  // Gradients behind large areas, judged by the colours in them.
  for (const g of d.grads) {
    const stops = g.stops.map(parse).filter(Boolean);
    const coloured = stops.filter(c => (c.a ?? 1) > 0.05 && toOklch(c).c >= NEUTRAL_C);
    if (!coloured.length) continue;
    const purple = coloured.some(c => ['indigo', 'purple'].includes(hueFamily(c)));
    add(purple ? 'fail' : 'warn', purple ? 'purple-gradient' : 'gradient-bg', g.page ? 'page background' : g.path, g.path, g.page ? null : g.box);
  }

  // Fake window chrome: three dots in a row, red then amber then green.
  const dots = d.dots.map(x => ({ ...x, fam: (() => { const c = parse(x.bg); return c ? hueFamily(c) : 'neutral'; })() }))
    .sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  for (let i = 0; i + 2 < dots.length; i++) {
    const [a, b, c] = dots.slice(i, i + 3);
    const row = Math.abs(a.box[1] - b.box[1]) <= 2 && Math.abs(b.box[1] - c.box[1]) <= 2;
    const close = b.box[0] - (a.box[0] + a.box[2]) <= 14 && c.box[0] - (b.box[0] + b.box[2]) <= 14 && b.box[0] > a.box[0];
    if (row && close && a.fam === 'red' && ['orange', 'yellow'].includes(b.fam) && c.fam === 'green') {
      add('warn', 'fake-chrome', 'traffic-light dots', '', [a.box[0] - 4, a.box[1] - 4, c.box[0] + c.box[2] - a.box[0] + 8, a.box[3] + 8]);
      i += 2;
    }
  }

  // Over-detailed mock UI: a crowd of tiny labels in the first screen.
  const tiny = d.texts.filter(x => x.fs <= T.denseSize && firstScreen(x.box, page) && x.box[1] > 80 && !x.act);
  if (tiny.length >= T.denseText) {
    const xs = tiny.map(x => x.box), l = Math.min(...xs.map(b => b[0])), t = Math.min(...xs.map(b => b[1]));
    const r = Math.max(...xs.map(b => b[0] + b[2])), btm = Math.max(...xs.map(b => b[1] + b[3]));
    add('warn', 'dense-mock', `${tiny.length} labels at ${T.denseSize}px or smaller`, '', [l, t, r - l, btm - t]);
  }

  // A subtitle that says the heading again.
  for (const h of d.heads.filter(h => h.level <= 2)) {
    const hw = content(h.t);
    if (hw.size < 3) continue;
    const next = d.texts.find(x => !x.inHead && x.box[1] >= h.box[1] + h.box[3] - 2 && x.box[1] - (h.box[1] + h.box[3]) <= 80 &&
      x.box[0] < h.box[0] + h.box[2] && h.box[0] < x.box[0] + x.box[2] && x.words >= 4);
    if (!next) continue;
    const shared = [...hw].filter(w => content(next.t).has(w)).length;
    if (shared / hw.size >= T.overlap) add('warn', 'redundant-sub', `"${h.t.slice(0, 40)}" / "${next.t.slice(0, 50)}"`, next.path, next.box);
  }

  return out;
}

// ---------- scoring ----------
const BASE = { fail: 7, warn: 4, info: 0 };

// Group findings by rule into ranked tells, and score each category out of CAT_MAX.
// A tell costs its base by level, plus one per extra instance up to three.
export function score(findings) {
  const by = new Map();
  for (const f of findings) {
    const meta = TELLS[f.rule] ?? (f.cat ? [f.cat, f.title ?? f.rule, f.fix ?? '', f.why ?? ''] : null);
    if (!meta || f.level === 'info') continue;
    const key = f.rule;
    let g = by.get(key);
    if (!g) by.set(key, g = { rule: key, cat: meta[0], title: f.title ?? meta[1], fix: f.fix ?? meta[2], why: f.why ?? meta[3], level: f.level, items: [], judged: !!f.judged });
    if (f.level === 'fail') g.level = 'fail';
    g.items.push(f);
  }
  const tells = [...by.values()].map(g => ({ ...g, cost: BASE[g.level] + Math.min(g.items.length - 1, 3) }))
    .sort((a, b) => b.cost - a.cost || a.cat.localeCompare(b.cat));
  const cats = CATS.map(c => {
    const ts = tells.filter(t => t.cat === c.id);
    return { ...c, score: Math.max(0, CAT_MAX - ts.reduce((s, t) => s + t.cost, 0)), max: CAT_MAX, tells: ts.length };
  });
  const total = cats.reduce((s, c) => s + c.score, 0);
  return { total, band: band(total), cats, tells };
}

export function band(n) {
  if (n >= 90) return 'Reads as designed';
  if (n >= 75) return 'A few tells';
  if (n >= 55) return 'Generated in places';
  if (n >= 35) return 'Reads as generated';
  return 'Template';
}
