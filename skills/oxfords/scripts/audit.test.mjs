// Run: node audit.test.mjs
// Scoring, notes and the rendered-page judge are always tested. The full audit runs on
// fixtures/ when a browser loads (see shoot.mjs for how Playwright is found).
import assert from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, build, parseNotes } from './audit.mjs';
import { check } from './check.mjs';
import { openBrowser, resolveInput } from './shoot.mjs';
import { judgeSlop, score, band } from './lib/slop.mjs';
import { renderReport } from './lib/report.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- scoring ----------
assert.equal(score([]).total, 100);
assert.equal(band(100), 'Reads as designed'); assert.equal(band(80), 'A few tells');
assert.equal(band(60), 'Generated in places'); assert.equal(band(40), 'Reads as generated'); assert.equal(band(10), 'Template');
{
  const s = score([
    { rule: 'default-font', level: 'fail', text: 'Inter' },
    ...Array.from({ length: 6 }, (_, i) => ({ rule: 'period-title', level: 'warn', text: `Title ${i}.` })),
    { rule: 'colour-share', level: 'info', text: '' },
  ]);
  const type = s.cats.find(c => c.id === 'type'), copy = s.cats.find(c => c.id === 'copy');
  assert.equal(type.score, 13, 'one fail costs 7');
  assert.equal(copy.score, 13, 'a warn costs 4, extra places cost 1 each up to 3');
  assert.equal(s.total, 86);
  assert.equal(s.tells.length, 2, 'info findings cost nothing');
  assert.equal(score(Array.from({ length: 9 }, () => ({ rule: 'tiny-text', level: 'fail' }))).cats[0].score, 10);
}

// ---------- notes ----------
{
  const notes = parseNotes([
    { rule: 'verbose-copy', text: 'Hero paragraph is 80 words' },
    { cat: 'layout', title: 'Logo wall of nine fake brands', fix: 'Show real customers or none', level: 'fail' },
    { rule: 'purple-gradient', keep: 'the brand colour since 2014' },
  ]);
  const raw = { findings: [{ rule: 'purple-gradient', level: 'fail', text: '', path: '', boxes: {} }, { rule: 'em-dash', level: 'warn', text: '—', path: '', boxes: {} }] };
  const r = build(raw, notes);
  assert(!r.score.tells.some(t => t.rule === 'purple-gradient'), 'a kept tell costs nothing');
  assert.equal(r.kept[0].count, 1);
  assert(r.score.tells.some(t => t.rule === 'verbose-copy' && t.judged));
  assert(r.score.tells.some(t => t.title === 'Logo wall of nine fake brands' && t.level === 'fail'));
  assert.throws(() => parseNotes([{ title: 'no category' }]), /known rule, or cat/);
  assert.throws(() => parseNotes([{ keep: 'why' }]), /keep needs the rule/);
  assert.throws(() => parseNotes({}), /JSON array/);
}

// ---------- the rendered-page judge, on collected facts ----------
{
  const page = { w: 1440, h: 2700, vw: 1440, vh: 900 };
  const t = (o) => ({ tag: 'p', t: 'Plain sentence about invoices', len: 28, words: 4, box: [0, 1000, 400, 20], fam: 'system-ui', mono: false,
    code: false, act: false, italic: false, tt: 'none', ls: 0, fs: 16, fw: 400, inHead: false, path: 'p', ...o });
  const head = (o) => ({ tag: 'h2', level: 2, t: 'Invoices', box: [0, 500, 600, 40], fs: 32, fam: 'system-ui', italic: false, italicKids: 0, famKids: [], path: 'h2', ...o });
  const base = { page, fonts: { body: 'system-ui' }, texts: [t({})], heads: [head({})], boxes: [], lines: [], pills: [], grads: [], dots: [], rails: [], copy: [], imgs: [] };
  const rules = d => new Set(judgeSlop({ ...base, ...d }).map(f => f.rule));
  assert.deepEqual([...rules({})], [], 'a plain page is clean');
  assert(rules({ fonts: { body: 'Inter' } }).has('default-font'));
  assert(rules({ heads: [head({ t: 'Built for teams.' })] }).has('period-title'));
  assert(!rules({ heads: [head({ t: 'Loading...' }), head({ t: 'Why now?' })] }).has('period-title'));
  assert(rules({ heads: [head({ italicKids: 1 }), head({ italicKids: 2, t: 'Ship' })] }).has('italic-heading'));
  assert(!rules({ heads: [head({ italicKids: 1 })] }).has('italic-heading'), 'one italic accent is a choice');
  assert(rules({ texts: [t({ t: 'THE FINANCE TOOL FOR SMALL STUDIOS', tt: 'none', words: 6 })] }).has('caps-subtitle'));
  assert(rules({ texts: [t({ t: '// features', words: 1 })] }).has('code-breadcrumb'));
  assert(!rules({ texts: [t({ t: '// features', words: 1, code: true })] }).has('code-breadcrumb'));
  assert(rules({ texts: [t({ t: 'Our process and our team', mono: true, len: 400 })] }).has('mono-costume'));
  assert(!rules({ texts: [t({ t: '$48,200.00', mono: true, len: 400 }), t({})] }).has('mono-costume'), 'figures in mono are fine');
  const pills = n => Array.from({ length: n }, (_, i) => ({ box: [i * 80, 300, 70, 24], t: `Tag ${i}`, act: false, path: 'span.pill' }));
  assert(rules({ pills: pills(5) }).has('pill-overuse'));
  assert(!rules({ pills: pills(4) }).has('pill-overuse'));
  assert(!rules({ pills: pills(8).map(p => ({ ...p, act: true })) }).has('pill-overuse'), 'pill-shaped buttons are controls');
  const lines = n => Array.from({ length: n }, (_, i) => ({ box: [0, 100 + i * 40, 600, 1], path: 'div.row', menu: false }));
  assert(rules({ lines: lines(9) }).has('divider-overuse'));
  assert(!rules({ lines: lines(5) }).has('divider-overuse'));
  assert(rules({ grads: [{ stops: ['rgba(14,165,233,1)', 'rgba(34,197,94,1)'], box: [0, 0, 1440, 600], path: 'section' }] }).has('gradient-bg'));
  assert(rules({ grads: [{ stops: ['rgba(99,102,241,1)', 'rgba(168,85,247,1)'], box: [0, 0, 1440, 600], path: 'section' }] }).has('purple-gradient'));
  assert(!rules({ grads: [{ stops: ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'], box: [0, 0, 1440, 600], path: 'figure' }] }).size, 'a neutral scrim is fine');
  const dot = (x, bg) => ({ box: [x, 40, 12, 12], bg });
  assert(rules({ dots: [dot(20, 'rgba(255,95,87,1)'), dot(38, 'rgba(254,188,46,1)'), dot(56, 'rgba(40,200,64,1)')] }).has('fake-chrome'));
  assert(rules({ rails: [{ box: [0, 0, 300, 40], path: 'a.active', colour: 'rgba(37,99,235,1)' }] }).has('accent-rail'));
  assert(!rules({ rails: [{ box: [0, 0, 300, 40], path: 'blockquote', colour: 'rgba(180,180,180,1)' }] }).has('accent-rail'));
  assert(rules({ texts: [t({ fs: 10, t: 'tiny' })] }).has('tiny-text'));
  assert(rules({ heads: [head({ t: 'Invoices that send themselves' })], texts: [t({ t: 'Your invoices send themselves on time', box: [0, 550, 500, 20], words: 6 })] }).has('redundant-sub'));
}

// ---------- the full audit, when a browser is available ----------
const browser = await openBrowser();
if (!browser) console.log('skipped: no browser (scoring, notes and the judge passed)');
else {
  const out = mkdtempSync(join(tmpdir(), 'oxfords-audit-'));
  try {
    const t0 = Date.now();
    const slop = build(await audit(browser, resolveInput(join(here, 'fixtures/slop.html')), { out: join(out, 'slop'), quick: true }), []);
    const found = new Set(slop.score.tells.map(t => t.rule));
    const want = ['default-font', 'bone-page', 'period-title', 'pill-overuse', 'divider-overuse', 'bordered-boxes', 'nested-boxes',
      'mono-costume', 'eyebrow', 'italic-heading', 'gradient-bg', 'code-breadcrumb', 'caps-subtitle', 'fake-chrome', 'dense-mock',
      'em-dash', 'vague-button', 'tiny-text'];
    for (const r of want) assert(found.has(r), `slop.html: expected ${r}, got ${[...found].join(', ')}`);
    assert(slop.score.total < 40, `slop.html scored ${slop.score.total}`);
    assert(slop.findings.some(f => f.boxes.desktop) && slop.findings.some(f => f.boxes.phone), 'findings are pinned at both widths');

    const good = build(await audit(browser, resolveInput(join(here, 'fixtures/good.html')), { out: join(out, 'good'), quick: false }), []);
    assert.equal(good.score.total, 100, `good.html: ${good.score.tells.map(t => t.rule).join(', ')}`);

    // The report holds itself to the same rules, and loads nothing from outside.
    const html = renderReport(slop);
    // Quotes from the audited page are its copy, not the report's.
    const own = html.replace(/<ul class="quotes">[\s\S]*?<\/ul>/g, m => m.replace(/[^\n]/g, ' '));
    const self = check(own).filter(f => f.level !== 'info' && f.id !== 'raw-colour');
    assert.deepEqual(self.map(f => `${f.id}:${f.line}`), [], 'the report fails its own check');
    assert(!/(?:src|href)="https?:/.test(html.replace(/<a href="[^"]*"/g, '')), 'the report loads an outside file');
    assert(/<title>[^<]+ audit<\/title>/.test(html));
    console.log(`ok: slop.html ${slop.score.total}/100 with all ${want.length} tells, good.html 100/100, report passes its own check, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally { await browser.close(); rmSync(out, { recursive: true, force: true }); }
}
console.log('ok: scoring, notes and the rendered-page judge');
