#!/usr/bin/env node
// Oxfords render check. Opens each page in a real browser at phone and desktop widths, light and
// dark, saves a full-page PNG of each, and measures what the source checker cannot see: contrast
// of the painted colours, clipped and overlapping text, sideways scroll, target sizes, accessible
// names, keyboard focus, content still hidden by script, and how much of the page is colour.
//
//   node shoot.mjs <file.html|url> [more...] [--out dir] [--widths 390,1440] [--schemes light,dark]
//                  [--json] [--quiet]
//
// --out  where PNGs go (default ./oxfords-shots next to the first input)
// --json machine output    --quiet failures only
// Playwright is optional. It is looked up as `playwright`, then `playwright-core`, then the
// package directory in OXFORDS_PLAYWRIGHT. Exit 0 clean, 1 any FAIL, 2 bad usage, 3 no browser.

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { decodePng } from './lib/png.mjs';
import { install } from './lib/inpage.mjs';
import { judge, needsPixels, sameLook, focusChanged, offScreen, pixelChange } from './lib/judge.mjs';

// Animations and transitions jump to their end so nothing is caught half-revealed.
const CALM = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;
scroll-behavior:auto!important}`;
// The same page with every glyph transparent: what is behind the text, for pixel sampling.
const BARE = `*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;
text-shadow:none!important;text-decoration-color:transparent!important}`;
const NO_BROWSER = `oxfords: no browser, so nothing was rendered. Get one with
  npm i -D playwright && npx playwright install chromium
or set OXFORDS_PLAYWRIGHT to the directory of a playwright or playwright-core package.`;
const TABS = 40;
const USAGE = 'usage: node shoot.mjs <file.html|url> [more...] [--out dir] [--widths 390,1440] [--schemes light,dark] [--json] [--quiet]';

// ---------- browser ----------
export async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try { const m = await import(name); const pw = m.chromium ? m : m.default; if (pw?.chromium) return pw; } catch { /* try the next */ }
  }
  const dir = process.env.OXFORDS_PLAYWRIGHT;
  if (dir) try { const pw = createRequire(import.meta.url)(resolve(dir)); if (pw?.chromium) return pw; } catch { /* no luck */ }
  return null;
}

// Returns a launched Chromium, or null when Playwright or its browser is missing.
export async function openBrowser() {
  const pw = await loadPlaywright();
  if (!pw) return null;
  try { return await pw.chromium.launch(); } catch (e) {
    console.error(`oxfords: Playwright loaded but Chromium did not start: ${String(e.message).split('\n')[0]}`);
    return null;
  }
}

// ---------- inputs ----------
const slug = s => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'page';

export function resolveInput(a) {
  if (/^(https?|file):/i.test(a)) {
    let u; try { u = new URL(a); } catch { return null; }
    return { label: a, url: u.href, slug: slug(u.hostname + u.pathname), dir: null };
  }
  const p = resolve(a);
  if (!existsSync(p) || !statSync(p).isFile()) return null;
  return { label: a, url: pathToFileURL(p).href, slug: slug(basename(p, extname(p))), dir: dirname(p) };
}

// ---------- one render ----------
async function open(page, url, width, scheme) {
  await page.setViewportSize({ width, height: width <= 480 ? 844 : 900 });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  if (page.url() === url) await page.reload({ waitUntil: 'load', timeout: 30000 }); // a #hash would not reload
  else await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.addStyleTag({ content: CALM });
  await page.evaluate(install);
}

// No computed style changed on focus, but a script may draw the ring with another element. Shoot
// the element's box plus 8px focused (after 50ms for the script), then blurred, and count the
// pixels that differ. Focus goes back afterwards so the next Tab carries on from here.
async function pixelCheck(page, s) {
  const pad = 8, [l, t, r, b] = s.box;
  const x = Math.max(0, l - pad), y = Math.max(0, t - pad);
  const clip = { x, y, width: Math.min(s.vw, r + pad) - x, height: Math.min(s.vh, b + pad) - y };
  if (clip.width < 1 || clip.height < 1) return null;
  await page.waitForTimeout(50);
  const focused = decodePng(await page.screenshot({ clip }));
  await page.evaluate(() => window.__oxf.focusBlur());
  await page.waitForTimeout(50);
  const blurred = decodePng(await page.screenshot({ clip }));
  await page.evaluate(() => window.__oxf.focusRestore());
  return pixelChange(focused, blurred);
}

// Real Tab presses, so :focus-visible matches the way it does for a keyboard user. The cheap
// style comparison runs first; only the suspects get the pixel check.
async function tabThrough(page) {
  await page.mouse.move(0, 0);
  const { modal } = await page.evaluate(() => window.__oxf.focusSetup());
  const steps = [];
  let retried = false;
  for (let i = 0; i < TABS; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => window.__oxf.focusProbe());
    // Past the last control Chrome sends focus to its own toolbar. With a modal open, one more
    // Tab shows whether focus comes back into the modal or lands on the page behind it.
    if (s.end && modal && !retried) { retried = true; continue; }
    if (s.end) break;
    if (s.escaped) { steps.push(s); break; }
    if (s.before && !focusChanged(s) && !offScreen(s)) s.pixels = await pixelCheck(page, s);
    steps.push(s);
  }
  return steps;
}

async function measure(page, input, width, scheme, out) {
  const png = join(out, `${input.slug}-${width}-${scheme}.png`);
  const buf = await page.screenshot({ fullPage: true });
  writeFileSync(png, buf);
  const shot = decodePng(buf);
  const data = await page.evaluate(() => window.__oxf.collect());
  let bare = null;
  if (needsPixels(data)) {
    const tag = await page.addStyleTag({ content: BARE });
    bare = decodePng(await page.screenshot({ fullPage: true }));
    await tag.evaluate(n => n.remove());
  }
  const focus = await tabThrough(page);
  return { width, scheme, png, ...judge({ data, shot, bare, focus, width }) };
}

async function shootOne(browser, input, o) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce', bypassCSP: true });
  const page = await ctx.newPage();
  const entry = { input: input.label, url: input.url, findings: [], renders: [] };
  let noDark = false;
  try {
    for (const width of o.widths) {
      let first = null;
      for (const scheme of o.schemes) {
        const t0 = Date.now();
        await open(page, input.url, width, scheme);
        const look = await page.evaluate(() => window.__oxf.theme());
        if (first && sameLook(look, first)) { noDark = true; continue; } // a duplicate render
        first ??= look;
        await page.evaluate(() => window.__oxf.settle());
        const r = await measure(page, input, width, scheme, o.out);
        entry.renders.push({ ...r, ms: Date.now() - t0 });
        // The page as the browser built it, scripts included, so keep.mjs can compare what renders.
        if (!entry.rendered) {
          entry.rendered = join(o.out, `${input.slug}.rendered.html`);
          writeFileSync(entry.rendered, await page.content());
        }
      }
    }
  } catch (e) {
    entry.findings.push({ level: 'fail', rule: 'render-error', msg: String(e.message).split('\n')[0], text: '', path: '' });
  } finally { await ctx.close(); }
  if (noDark) entry.findings.unshift({ level: 'info', rule: 'no-dark-theme', text: '', path: '',
    msg: 'dark has the same page background and text colour as light; dark renders skipped' });
  return entry;
}

// Renders every input. o = { out, widths, schemes }. Returns one entry per input.
export async function shoot(browser, inputs, opts = {}) {
  const o = { widths: [390, 1440], schemes: ['light', 'dark'], ...opts };
  o.out ??= join(inputs[0]?.dir ?? process.cwd(), 'oxfords-shots');
  mkdirSync(o.out, { recursive: true });
  const used = new Map();
  for (const i of inputs) { const n = used.get(i.slug) || 0; used.set(i.slug, n + 1); if (n) i.slug += `-${n + 1}`; }
  const report = [];
  for (const input of inputs) report.push(await shootOne(browser, input, o));
  return report;
}

// ---------- output ----------
const line = f => `${f.level.toUpperCase().padEnd(4)}  ${f.rule.padEnd(17)} ${f.msg}` +
  `${f.text ? `  "${f.text.length > 40 ? f.text.slice(0, 39) + '…' : f.text}"` : ''}${f.path ? `  (${f.path})` : ''}`;

// Repeats of one rule collapse after three, so a long page stays readable.
function printGroup(findings, pad) {
  const by = new Map();
  for (const f of findings) (by.get(f.rule) || by.set(f.rule, []).get(f.rule)).push(f);
  for (const fs of by.values()) {
    for (const f of fs.slice(0, 3)) console.log(pad + line(f));
    if (fs.length > 3) console.log(`${pad}      +${fs.length - 3} more ${fs[0].rule}`);
  }
}

export function tally(report) {
  const all = report.flatMap(e => [...e.findings, ...e.renders.flatMap(r => r.findings)]);
  const n = l => all.filter(f => f.level === l).length;
  return { pages: report.length, renders: report.reduce((s, e) => s + e.renders.length, 0), fails: n('fail'), warns: n('warn'), infos: n('info') };
}

function print(report, quiet) {
  const keep = fs => fs.filter(f => !quiet || f.level === 'fail');
  for (const e of report) {
    console.log(`\n${e.input}`);
    printGroup(keep(e.findings), '  ');
    for (const r of e.renders) {
      const fs = keep(r.findings);
      if (quiet && !fs.length) continue;
      console.log(`  ${r.width} × ${r.scheme}${fs.length ? '' : '  clean'}`);
      printGroup(fs, '    ');
    }
    if (!quiet && e.renders.length) { console.log('  shots'); for (const r of e.renders) console.log(`    ${r.png}`); }
  }
  const t = tally(report);
  console.log(`\n${t.pages} page${t.pages === 1 ? '' : 's'}, ${t.renders} render${t.renders === 1 ? '' : 's'}, ` +
    `${t.fails} fail, ${t.warns} warn, ${t.infos} info`);
}

// ---------- CLI ----------
function parseArgs(argv) {
  const o = { widths: [390, 1440], schemes: ['light', 'dark'], json: false, quiet: false, out: undefined, inputs: [] };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v;
    if (a.startsWith('--') && a.includes('=')) [a, v] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
    if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (['--out', '--widths', '--schemes'].includes(a)) {
      v ??= argv[++i];
      if (v == null || v === '') return { error: `${a} needs a value` };
      if (a === '--out') o.out = resolve(v);
      if (a === '--widths') {
        o.widths = v.split(',').map(Number);
        if (o.widths.some(w => !Number.isInteger(w) || w < 200 || w > 4000)) return { error: `bad --widths ${v}` };
      }
      if (a === '--schemes') {
        // "both" is light,dark, the default spelled out.
        o.schemes = [...new Set(v.split(',').flatMap(s => (s.trim() === 'both' ? ['light', 'dark'] : [s.trim()])))];
        if (o.schemes.some(s => s !== 'light' && s !== 'dark')) return { error: `bad --schemes ${v}; use light, dark or both` };
      }
    } else if (a.startsWith('-')) return { error: `unknown flag ${a}` };
    else o.inputs.push(a);
  }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { console.log(USAGE); return; }
  if (o.error || !o.inputs.length) { console.error(o.error ? `oxfords: ${o.error}\n${USAGE}` : USAGE); process.exitCode = 2; return; }
  const inputs = o.inputs.map(a => [a, resolveInput(a)]);
  const missing = inputs.filter(([, r]) => !r).map(([a]) => a);
  if (missing.length) { console.error(`oxfords: cannot read ${missing.join(', ')}`); process.exitCode = 2; return; }
  const browser = await openBrowser();
  if (!browser) { console.error(NO_BROWSER); process.exitCode = 3; return; }
  let report;
  try { report = await shoot(browser, inputs.map(([, r]) => r), o); } finally { await browser.close(); }
  if (o.json) console.log(JSON.stringify({ ...tally(report), report }, null, 2));
  else print(report, o.quiet);
  if (tally(report).fails) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
