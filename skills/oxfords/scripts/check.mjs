#!/usr/bin/env node
// Oxfords slop check. Zero dependencies. Scans built or source UI files for the mechanical
// marks of a generated interface. Fails on the unambiguous ones, warns on the judgement ones.
//
//   node check.mjs <file-or-dir> [more...] [--json] [--strict] [--quiet]
//
// --strict  warnings also fail      --json  machine output      --quiet  failures only
// oxfords: line-based regex, so it cannot see nested cards, clipped text or contrast.
// Those stay on the manual list in references/review.md.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const EXT = new Set(['.html', '.htm', '.css', '.scss', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.mdx']);
const SKIP = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'out', 'vendor', 'coverage']);

const FONTS = ['Inter', 'Geist', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Montserrat', 'Manrope', 'DM Sans',
  'Plus Jakarta Sans', 'Space Grotesk', 'Outfit', 'Instrument Serif', 'Playfair Display', 'Fraunces',
  'Cormorant', 'Lora', 'DM Serif Display'];
const fontAlt = FONTS.map(f => f.replace(/ /g, '[ +_-]?')).join('|');
const BUZZ = ['seamless(?:ly)?', 'effortless(?:ly)?', 'unlock', 'unleash', 'elevate', 'supercharge', 'empower',
  'streamline', 'revolutioni[sz]e', 'reimagine', 'next[- ]gen(?:eration)?', 'world[- ]class', 'cutting[- ]edge',
  'game[- ]chang(?:ing|er)', 'all[- ]in[- ]one', 'at your fingertips', 'level up'];
const PURPLE = '(?:purple|violet|indigo|fuchsia|#(?:6366f1|4f46e5|7c3aed|8b5cf6|a855f7|9333ea|6d28d9|a78bfa|c084fc|818cf8)\\b)';

// level: fail = unambiguous tell, warn = usually a tell, needs a reason to keep.
const RULES = [
  { id: 'default-font', level: 'fail', msg: 'default font nobody chose; use the system stack or a face with a stated reason',
    re: new RegExp(`(?:font-family\\s*:[^;{}]*?|family=|font-(?:sans|serif|display)\\s*:[^;{}]*?|fontFamily\\s*:[^,}]*?)["'\\s:,=](${fontAlt})(?=["',;&:+\\s)]|$)`, 'i') },
  { id: 'emoji', level: 'fail', msg: 'emoji in the interface; use an icon from the set or plain text',
    re: /[\u{1F000}-\u{1FAFF}\u{2728}\u{2B50}\u{26A1}\u{2705}\u{274C}\u{2764}\u{1F680}]/u },
  { id: 'gradient-text', level: 'fail', msg: 'gradient-filled text',
    re: /background-clip\s*:\s*text|\bbg-clip-text\b/i },
  { id: 'purple-gradient', level: 'fail', msg: 'purple, indigo or violet gradient',
    re: new RegExp(`gradient\\([^;]*${PURPLE}|\\b(?:from|via|to)-(?:purple|violet|indigo|fuchsia)-\\d`, 'i') },
  { id: 'accent-rail', level: 'fail', msg: 'coloured bar on the side of an element; use a full fill or nothing',
    re: /border-(?:left|right|inline-start|inline-end)\s*:\s*(?:[2-9]|1\d)px\s+solid(?!\s+transparent)|\bborder-[lrse]-(?:2|4|8)\b|box-shadow\s*:\s*inset\s+-?[2-9]px\s+0\s+0/i },
  { id: 'bounce', level: 'fail', msg: 'bounce or elastic easing; ease out with no overshoot',
    re: /cubic-bezier\(\s*[\d.]+\s*,\s*(?:-\d*\.?\d+|1\.\d*[1-9]\d*|[2-9])|cubic-bezier\([^)]*,\s*(?:1\.\d*[1-9]\d*|[2-9](?:\.\d+)?)\s*\)|\banimate-bounce\b|@keyframes\s+\w*(?:bounce|elastic|wobble|jiggle)/i },
  { id: 'greeting-header', level: 'fail', msg: 'greeting as a heading; name the page',
    re: /good (?:morning|afternoon|evening)\s*,|welcome back\s*,/i },
  { id: 'tiny-text', level: 'fail', msg: 'text under 11px',
    re: /font-size\s*:\s*(?:[0-9]|10)(?:\.\d+)?px\b|\btext-\[(?:[0-9]|10)px\]/i },
  { id: 'img-no-alt', level: 'fail', msg: 'image without an alt attribute',
    re: /<img\b(?![^>]*\balt\s*=)[^>]*>/i },
  { id: 'marquee', level: 'fail', msg: 'marquee or auto-scrolling strip',
    re: /<marquee\b|@keyframes\s+\w*marquee|\banimate-marquee\b/i },

  { id: 'em-dash', level: 'warn', msg: 'em dash in visible copy', re: /—/ },
  { id: 'buzzword', level: 'warn', msg: 'marketing filler; say what it does',
    re: new RegExp(`(?<![\\w-])(?:${BUZZ.join('|')})(?![\\w-])`, 'i') },
  { id: 'vague-button', level: 'warn', msg: 'vague button label; name the outcome',
    re: />\s*(?:get started|learn more|submit|click here)\s*</i },
  { id: 'placeholder-content', level: 'warn', msg: 'placeholder name or text; use believable content',
    re: /\b(?:lorem ipsum|acme(?: corp| inc)?|john doe|jane doe)\b|placehold\.co|picsum\.photos|pravatar|via\.placeholder/i },
  { id: 'glow', level: 'warn', msg: 'zero-offset shadow reads as a glow',
    re: /box-shadow\s*:[^;]*\b0\s+0\s+(?:[2-9]\d|\d{3,})px/i },
  { id: 'pulse', level: 'warn', msg: 'pulsing element; keep only for live data',
    re: /\banimate-(?:pulse|ping)\b|@keyframes\s+\w*(?:pulse|ping)\b/i },
  { id: 'layout-transition', level: 'warn', msg: 'animating layout properties; use transform and opacity',
    re: /transition(?:-property)?\s*:[^;]*\b(?:all|width|height|margin|padding|top|left)\b/i },
  { id: 'hover-lift', level: 'warn', msg: 'element moves or scales on hover',
    re: /:hover[^{]*\{[^}]*transform\s*:\s*(?:translate|scale)|\bhover:(?:scale|-translate-y)-/i },
  { id: 'viewport-100vh', level: 'warn', msg: '100vh jumps on phones; use dvh or svh',
    re: /:\s*100vh\b|\bh-screen\b/i },
  { id: 'eyebrow', level: 'warn', msg: 'uppercase letter-spaced label; drop it unless it carries information',
    re: /\buppercase\b[^"'`]*\btracking-(?:wide|wider|widest)\b|\btracking-(?:wide|wider|widest)\b[^"'`]*\buppercase\b/i },
  { id: 'exclamation', level: 'warn', msg: 'exclamation mark in interface copy',
    re: />[^<>{}]*[A-Za-z]!\s*</ },
  { id: 'custom-cursor', level: 'warn', msg: 'custom cursor', re: /cursor\s*:\s*url\(/i },
];

const COPY_ONLY = new Set(['exclamation', 'vague-button', 'em-dash']);

// Rules that need the whole file, not one line.
const FILE_RULES = [
  { id: 'eyebrow', level: 'warn', msg: 'uppercase letter-spaced label; drop it unless it carries information',
    test: s => [...s.matchAll(/\{[^{}]*\}/g)].filter(m => /text-transform\s*:\s*uppercase/i.test(m[0]) && /letter-spacing\s*:\s*0?\.(?:0[5-9]|[1-9])/i.test(m[0])).length },
  { id: 'no-focus-style', level: 'fail', msg: 'outline removed and no :focus-visible style anywhere in the file',
    test: s => /outline\s*:\s*(?:none|0)\b/i.test(s) && !/:focus-visible|focus-visible:|:focus-within/i.test(s) ? 1 : 0 },
  { id: 'no-reduced-motion', level: 'warn', msg: 'has animation but no prefers-reduced-motion rule',
    test: s => /@keyframes|animation\s*:|transition\s*:/i.test(s) && !/prefers-reduced-motion|motion-reduce:|motion-safe:/i.test(s) ? 1 : 0 },
  { id: 'many-sizes', level: 'warn', msg: 'more than eight distinct font sizes; keep to a scale',
    test: s => { const z = new Set([...s.matchAll(/font-size\s*:\s*([\d.]+(?:px|rem|em))/gi)].map(m => m[1].toLowerCase())); return z.size > 8 ? z.size : 0; } },
  { id: 'many-fonts', level: 'warn', msg: 'more than two font families declared',
    test: s => { const f = new Set([...s.matchAll(/font-family\s*:\s*["']?([^,;"'}]+)/gi)].map(m => m[1].trim().toLowerCase()).filter(n => !/^(inherit|var\(|system-ui|-apple-system|ui-|sans-serif|serif|monospace)/.test(n))); return f.size > 2 ? f.size : 0; } },
];

function walk(p, out = []) {
  let st; try { st = statSync(p); } catch { console.error(`oxfords: cannot read ${p}`); process.exitCode = 2; return out; }
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!SKIP.has(n) && !n.startsWith('.')) walk(join(p, n), out); }
  else if (EXT.has(extname(p).toLowerCase())) out.push(p);
  return out;
}

export function check(text) {
  const found = [];
  const lines = text.split('\n');
  let inScript = false;
  lines.forEach((line, i) => {
    if (line.length > 4000 || /oxfords-ignore/.test(line)) return; // minified or opted out
    const wasScript = inScript;
    if (/<script\b/i.test(line)) inScript = true;
    if (/<\/script>/i.test(line)) inScript = false;
    for (const r of RULES) {
      if (wasScript && inScript && COPY_ONLY.has(r.id)) continue; // code, not interface text
      const m = r.re.exec(line);
      if (m) found.push({ id: r.id, level: r.level, msg: r.msg, line: i + 1, text: m[0].trim().slice(0, 80) });
    }
  });
  for (const r of FILE_RULES) {
    const n = r.test(text);
    if (n) found.push({ id: r.id, level: r.level, msg: r.msg, line: 0, text: n > 1 ? `${n} found` : '' });
  }
  return found;
}

function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const paths = args.filter(a => !a.startsWith('--'));
  if (!paths.length || flags.has('--help')) {
    console.log('usage: node check.mjs <file-or-dir> [more...] [--json] [--strict] [--quiet]');
    process.exit(paths.length ? 0 : 2);
  }
  const files = paths.flatMap(p => walk(p));
  const report = files.map(f => ({ file: f, findings: check(readFileSync(f, 'utf8')) }));
  const all = report.flatMap(r => r.findings);
  const fails = all.filter(f => f.level === 'fail').length;
  const warns = all.length - fails;

  if (flags.has('--json')) console.log(JSON.stringify({ files: files.length, fails, warns, report }, null, 2));
  else {
    for (const r of report) {
      const shown = r.findings.filter(f => !flags.has('--quiet') || f.level === 'fail');
      if (!shown.length) continue;
      console.log(`\n${r.file}`);
      // Collapse repeats of one rule so a long file stays readable.
      const by = new Map();
      for (const f of shown) (by.get(f.id) ?? by.set(f.id, []).get(f.id)).push(f);
      for (const [id, fs] of by) {
        const where = fs.filter(f => f.line).slice(0, 4).map(f => f.line).join(', ');
        const more = fs.length > 4 ? ` +${fs.length - 4} more` : '';
        console.log(`  ${fs[0].level.toUpperCase().padEnd(4)}  ${id.padEnd(20)} ${fs[0].msg}${where ? `  (line ${where}${more})` : ''}`);
        if (fs[0].text && fs[0].line) console.log(`        ${fs[0].text}`);
      }
    }
    console.log(`\n${files.length} file${files.length === 1 ? '' : 's'}, ${fails} fail, ${warns} warn`);
  }
  if (fails || (flags.has('--strict') && warns)) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check.mjs')) main();
