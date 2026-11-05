#!/usr/bin/env node
// Oxfords audit. Scores a live page or a local file for AI slop out of 100 and writes one
// self-contained HTML report: the score, a bar per area, and the page's own screenshots with
// every tell boxed and numbered, ranked by what it costs.
//
//   node audit.mjs <url|file.html> [--out dir] [--notes notes.json] [--quick] [--json]
//   node audit.mjs --from <dir>/oxfords-audit.json [--notes notes.json] [--json]
//
// --out    where the report, JSON and screenshots go (default ./oxfords-audit)
// --notes  look-pass findings to add to the score (see references/audit.md for the shape)
// --quick  skip the render check (contrast, focus, targets); Finish is then not measured
// --from   rebuild the report from an earlier run, with new notes, without a browser
// --json   print the result as JSON
// Exit 0 done, 2 bad usage, 3 no browser.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { check } from './check.mjs';
import { openBrowser, resolveInput, shoot } from './shoot.mjs';
import { install } from './lib/inpage.mjs';
import { installSlop } from './lib/slop-inpage.mjs';
import { judgeSlop, score, TELLS, FROM_CHECK, CATS } from './lib/slop.mjs';
import { renderReport } from './lib/report.mjs';

const USAGE = `usage: node audit.mjs <url|file.html> [--out dir] [--notes notes.json] [--quick] [--json]
       node audit.mjs --from <dir>/oxfords-audit.json [--notes notes.json] [--json]`;
const NO_BROWSER = `oxfords: no browser, so nothing was rendered. Get one with
  npm i -D playwright && npx playwright install chromium
or set OXFORDS_PLAYWRIGHT to the directory of a playwright or playwright-core package.`;
const CALM = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;
scroll-behavior:auto!important}`;
const VIEWS = [['desktop', 1440, 900], ['phone', 390, 844]];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- one look at the page per width ----------
async function look(browser, input, key, width, height, out, paths) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce', bypassCSP: true, viewport: { width, height } });
  const page = await ctx.newPage();
  try {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto(input.url, { waitUntil: 'load', timeout: 45000 });
    await page.addStyleTag({ content: CALM });
    await page.evaluate(install);
    await page.evaluate(() => window.__oxf.settle());
    await page.evaluate(installSlop);
    const data = await page.evaluate(() => window.__oxs.collect());
    const boxes = paths.length ? await page.evaluate(p => window.__oxs.locate(p), paths) : [];
    const file = join(out, `${key}.jpg`);
    const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 72 });
    writeFileSync(file, buf);
    let css = null;
    if (key === 'desktop') {
      const sh = await page.evaluate(() => window.__oxs.sheets());
      const fetched = [];
      for (const href of sh.hrefs.slice(0, 20)) {
        try {
          const res = await ctx.request.get(href, { timeout: 10000 });
          if (res.ok()) fetched.push((await res.text()).slice(0, 2_000_000));
        } catch { /* skip it */ }
      }
      css = { own: sh.css, fetched, missed: sh.hrefs.length - fetched.length };
    }
    // The real screenshot size: the page may be wider than the viewport.
    const dims = await page.evaluate(() => [document.documentElement.scrollWidth, Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0)]);
    return { data, boxes, css, shot: { file, w: Math.max(width, dims[0]), h: dims[1], width } };
  } finally { await ctx.close(); }
}

// The page's copy and stylesheets as one document, so check.mjs can read them.
function asSource(data, css) {
  const sheet = [...css.own, ...css.fetched.map(s => s.replace(/}/g, '}\n'))].join('\n');
  const copy = data.copy.map(c => `<${c.tag}>${esc(c.t)}</${c.tag}>`);
  const imgs = data.imgs.map(i => (i.alt == null ? '<img src="x">' : `<img src="x" alt="${esc(i.alt).replace(/"/g, '&quot;')}">`));
  return `<style>\n${sheet}\n</style>\n${copy.join('\n')}\n${imgs.join('\n')}\n`;
}

// Merge findings from both widths into instances with a box per view. The nth instance of a
// rule, path and text at one width is the nth at the other.
function merge(lists) {
  const out = new Map();
  for (const [key, fs] of lists) {
    const nth = new Map();
    for (const f of fs) {
      const base = `${f.rule}|${f.path}|${f.text}`, k = nth.get(base) ?? 0;
      nth.set(base, k + 1);
      const id = `${base}|${k}`;
      let m = out.get(id);
      if (!m) out.set(id, m = { rule: f.rule, level: f.level, text: f.text, path: f.path, boxes: {} });
      if (f.level === 'fail') m.level = 'fail';
      if (f.box && !m.boxes[key]) m.boxes[key] = f.box;
    }
  }
  return [...out.values()];
}

// Look-pass notes: findings only eyes can make, and measured tells the brand owns.
//   { "rule": "verbose-copy", "text": "..." }                     a known tell
//   { "cat": "layout", "title": "...", "fix": "...", "why": "..." } a new one
//   { "rule": "purple-gradient", "keep": "the brand's own colour" } kept on purpose, costs nothing
export function readNotes(file) {
  if (!file) return [];
  let notes;
  try { notes = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`cannot read notes ${file}: ${e.message}`); }
  return parseNotes(notes);
}

export function parseNotes(notes) {
  if (!Array.isArray(notes)) throw new Error('notes must be a JSON array of findings');
  const cats = new Set(CATS.map(c => c.id));
  return notes.map((n, i) => {
    if (n.keep) {
      if (!n.rule) throw new Error(`note ${i + 1}: keep needs the rule it keeps`);
      return { rule: n.rule, keep: String(n.keep) };
    }
    const known = TELLS[n.rule];
    const cat = n.cat ?? known?.[0];
    if (!known && (!cat || !cats.has(cat) || !n.title)) throw new Error(`note ${i + 1}: give a known rule, or cat (${[...cats].join(', ')}) and title`);
    if (n.level && !['fail', 'warn'].includes(n.level)) throw new Error(`note ${i + 1}: level is fail or warn`);
    return { rule: n.rule ?? `look-${i + 1}`, cat, title: n.title, fix: n.fix, why: n.why, level: n.level ?? 'warn',
      text: n.text ?? '', path: n.path ?? '', boxes: {}, judged: true };
  });
}

export function build(raw, notes) {
  const keep = new Map(notes.filter(n => n.keep).map(n => [n.rule, n.keep]));
  const findings = [...raw.findings.filter(f => !keep.has(f.rule)), ...notes.filter(n => !n.keep)];
  const kept = [...keep].map(([rule, reason]) => ({ rule, reason, title: TELLS[rule]?.[1] ?? rule,
    count: raw.findings.filter(f => f.rule === rule).length }));
  return { ...raw, notes, kept, score: score(findings) };
}

function write(result, out) {
  const json = join(out, 'oxfords-audit.json'), html = join(out, 'oxfords-audit.html');
  writeFileSync(json, JSON.stringify(result, null, 2));
  writeFileSync(html, renderReport(result));
  return { json, html };
}

function print(result, files) {
  const s = result.score;
  console.log(`\n${result.input}\n  ${s.total}/100  ${s.band}\n`);
  for (const c of s.cats) console.log(`  ${c.label.padEnd(8)} ${String(c.score).padStart(2)}/${c.max}  ${c.tells ? `${c.tells} tell${c.tells === 1 ? '' : 's'}` : 'clean'}`);
  if (s.tells.length) {
    console.log('\n  ranked by cost');
    s.tells.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.level.toUpperCase().padEnd(4)} ${t.title}  (${t.items.length}, -${t.cost})${t.judged ? '  look pass' : ''}`));
  }
  console.log(`\n  report  ${files.html}\n  data    ${files.json}`);
  for (const k of result.kept ?? []) console.log(`  kept    ${k.title}: ${k.reason}`);
  if (!result.notes.length) console.log('  next    do the look pass in references/audit.md, then rebuild with --from and --notes');
}

export async function audit(browser, input, o) {
  mkdirSync(o.out, { recursive: true });
  // 1. The render check: contrast, clipping, focus, targets. Skipped with --quick.
  let renderFindings = [], shootPaths = { desktop: [], phone: [] };
  if (!o.quick) {
    const [entry] = await shoot(browser, [input], { out: join(o.out, 'render-check'), widths: [1440, 390], schemes: ['light', 'dark'] });
    const keyOf = w => (w <= 480 ? 'phone' : 'desktop');
    renderFindings = [...entry.findings.map(f => ({ ...f, key: 'desktop' })),
      ...entry.renders.flatMap(r => r.findings.map(f => ({ ...f, key: keyOf(r.width) })))]
      .filter(f => f.level !== 'info' && TELLS[f.rule]);
    for (const f of renderFindings) if (f.path && !shootPaths[f.key].includes(f.path)) shootPaths[f.key].push(f.path);
  }
  // 2. The slop pass at each width.
  const looks = {};
  for (const [key, w, h] of VIEWS) looks[key] = await look(browser, input, key, w, h, o.out, shootPaths[key]);
  // 3. Pin render-check findings to boxes on the screenshot they came from.
  const pinned = renderFindings.map(f => {
    const i = shootPaths[f.key].indexOf(f.path);
    return { rule: f.rule, level: f.level, text: f.text ? `${f.msg}: ${f.text}` : f.msg, path: f.path, box: i >= 0 ? looks[f.key].boxes[i] : null, key: f.key };
  });
  // 4. check.mjs over the page's own copy and stylesheets.
  const fromCheck = check(asSource(looks.desktop.data, looks.desktop.css))
    .filter(f => FROM_CHECK.has(f.id))
    .map(f => ({ rule: f.id, level: f.level, text: f.text, path: '' }));
  const findings = merge([
    ['desktop', judgeSlop(looks.desktop.data)], ['phone', judgeSlop(looks.phone.data)],
    ['desktop', pinned.filter(f => f.key === 'desktop')], ['phone', pinned.filter(f => f.key === 'phone')],
    ['desktop', fromCheck],
  ]);
  const css = looks.desktop.css;
  return {
    input: input.label, url: input.url, date: new Date().toISOString().slice(0, 10),
    shots: { desktop: looks.desktop.shot, phone: looks.phone.shot },
    findings,
    measured: `rendered in Chromium at 1440 and 390 wide${o.quick ? '' : ', light and dark, with the render check (contrast, clipping, focus, targets, names)'}; ` +
      `the page copy and ${css.own.length + css.fetched.length} stylesheets read${css.missed ? `, ${css.missed} could not be fetched` : ''}`,
    notChecked: [o.quick ? 'contrast, focus and targets (run without --quick)' : null,
      'other pages of the site, states behind clicks or logins, other browsers and real devices, a screen reader'].filter(Boolean).join('; '),
  };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const o = { json: false, quick: false, inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v;
    if (a.startsWith('--') && a.includes('=')) [a, v] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
    if (a === '--json') o.json = true;
    else if (a === '--quick') o.quick = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (['--out', '--notes', '--from'].includes(a)) {
      v ??= argv[++i];
      if (!v) return { error: `${a} needs a value` };
      o[a.slice(2)] = resolve(v);
    } else if (a.startsWith('-')) return { error: `unknown flag ${a}` };
    else o.inputs.push(a);
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { console.log(USAGE); return; }
  if (o.error || (!o.from && o.inputs.length !== 1)) { console.error(o.error ? `oxfords: ${o.error}\n${USAGE}` : USAGE); process.exitCode = 2; return; }
  let notes;
  try { notes = readNotes(o.notes); } catch (e) { console.error(`oxfords: ${e.message}`); process.exitCode = 2; return; }

  let raw, out;
  if (o.from) {
    if (!existsSync(o.from)) { console.error(`oxfords: cannot read ${o.from}`); process.exitCode = 2; return; }
    const prev = JSON.parse(readFileSync(o.from, 'utf8'));
    raw = { ...prev, notes: undefined, score: undefined };
    if (!o.notes) notes = prev.notes ?? [];
    out = dirname(o.from);
  } else {
    const input = resolveInput(o.inputs[0]);
    if (!input) { console.error(`oxfords: cannot read ${o.inputs[0]}`); process.exitCode = 2; return; }
    out = o.out ?? resolve('oxfords-audit');
    const browser = await openBrowser();
    if (!browser) { console.error(NO_BROWSER); process.exitCode = 3; return; }
    try { raw = await audit(browser, input, { ...o, out }); } finally { await browser.close(); }
  }
  const result = build(raw, notes);
  const files = write(result, out);
  if (o.json) console.log(JSON.stringify({ score: result.score.total, band: result.score.band, cats: result.score.cats, tells: result.score.tells.map(t => ({ rule: t.rule, level: t.level, title: t.title, count: t.items.length, cost: t.cost })), ...files }, null, 2));
  else print(result, files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
