#!/usr/bin/env node
// Oxfords keep check. Zero dependencies. Compares a redesign with the page it replaces and
// reports what went missing: link targets, navigation labels, form fields, data values, and
// any line of a Keep list. Regex over HTML, so it reads what the markup says, not what a
// script renders later. Run it on the built HTML when the page is assembled by JavaScript.
//
//   node keep.mjs <original.html> <redesign.html> [--keep keep.txt] [--json]
//
// FAIL  a link target, navigation label, form field name or Keep line is missing
// WARN  a number shown on the original is missing (data the redesign may have dropped)
// INFO  the title or a heading changed; new link targets

import { readFileSync } from 'node:fs';

const strip = s => s
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ');
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&middot;/g, '·').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const text = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attrs = (html, tag, attr) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*(["'])(.*?)\\1`, 'gi'))]
  .map(m => decode(m[2]).trim());

export function extract(raw) {
  const html = strip(raw);
  const navs = [...html.matchAll(/<nav\b[\s\S]*?<\/nav>/gi)].map(m => m[0]);
  const navLabels = navs.flatMap(n => [...n.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => text(m[2]) || (/aria-label\s*=\s*(["'])(.*?)\1/i.exec(m[0]) || [])[2] || '')).filter(Boolean);
  const body = text(html);
  return {
    title: text((/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || ''),
    headings: [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => text(m[2])).filter(Boolean),
    links: [...new Set([...attrs(html, 'a', 'href'), ...attrs(html, 'form', 'action')].filter(h => h && h !== '#'))],
    navLabels: [...new Set(navLabels)],
    fields: [...new Set(['input', 'select', 'textarea'].flatMap(t => attrs(html, t, 'name')))],
    // Numbers people read: times, money, counts. Single digits are too common to mean anything.
    numbers: [...new Set(body.match(/(?:[$£€]\s?)?\d[\d,.:]*\d%?|\d+%/g) || [])],
    body: body.toLowerCase(),
  };
}

export function compare(oldHtml, newHtml, keepLines = []) {
  const a = extract(oldHtml), b = extract(newHtml);
  const findings = [];
  const add = (level, id, msg, items) => items.length && findings.push({ level, id, msg, items });
  const lower = xs => new Set(xs.map(x => x.toLowerCase()));
  const bLinks = new Set(b.links), bNav = lower(b.navLabels), bFields = new Set(b.fields);
  add('fail', 'link-missing', 'link target on the original is gone', a.links.filter(h => !bLinks.has(h)));
  add('fail', 'nav-label-missing', 'navigation label on the original is gone or renamed',
    a.navLabels.filter(l => !bNav.has(l.toLowerCase())));
  add('fail', 'field-missing', 'form field name on the original is gone', a.fields.filter(f => !bFields.has(f)));
  add('fail', 'keep-missing', 'line from the Keep list does not appear on the redesign',
    keepLines.filter(k => !b.body.includes(k.toLowerCase())));
  const bNums = new Set(b.numbers);
  add('warn', 'number-missing', 'number shown on the original is not on the redesign',
    a.numbers.filter(n => !bNums.has(n) && !b.body.includes(n.toLowerCase())));
  if (a.title && a.title !== b.title) add('info', 'title-changed', 'title changed', [`${a.title} -> ${b.title}`]);
  const bHeads = lower(b.headings);
  add('info', 'heading-changed', 'heading on the original is not on the redesign',
    a.headings.filter(h => !bHeads.has(h.toLowerCase())));
  add('info', 'link-added', 'new link target', b.links.filter(h => !a.links.includes(h)));
  return { findings, counts: { links: a.links.length, navLabels: a.navLabels.length, fields: a.fields.length, numbers: a.numbers.length } };
}

function main() {
  const args = process.argv.slice(2);
  const files = args.filter(x => !x.startsWith('--'));
  const keepAt = args.indexOf('--keep');
  const keepFile = keepAt >= 0 ? args[keepAt + 1] : null;
  const paths = files.filter(f => f !== keepFile);
  if (paths.length !== 2 || args.includes('--help')) {
    console.log('usage: node keep.mjs <original.html> <redesign.html> [--keep keep.txt] [--json]');
    process.exit(args.includes('--help') ? 0 : 2);
  }
  let oldHtml, newHtml, keep = [];
  try {
    oldHtml = readFileSync(paths[0], 'utf8');
    newHtml = readFileSync(paths[1], 'utf8');
    if (keepFile) keep = readFileSync(keepFile, 'utf8').split('\n').map(l => l.replace(/^[-*]\s+/, '').trim()).filter(l => l && !l.startsWith('#'));
  } catch (e) { console.error(`oxfords keep: ${e.message}`); process.exit(2); }
  const { findings, counts } = compare(oldHtml, newHtml, keep);
  if (args.includes('--json')) console.log(JSON.stringify({ counts, findings }, null, 2));
  else {
    console.log(`original: ${counts.links} links, ${counts.navLabels} nav labels, ${counts.fields} fields, ${counts.numbers} numbers${keep.length ? `, ${keep.length} Keep lines` : ''}`);
    for (const f of findings) {
      console.log(`  ${f.level.toUpperCase().padEnd(4)}  ${f.id.padEnd(18)} ${f.msg} (${f.items.length})`);
      for (const i of f.items.slice(0, 8)) console.log(`        ${i}`);
      if (f.items.length > 8) console.log(`        +${f.items.length - 8} more`);
    }
    const fails = findings.filter(f => f.level === 'fail').length;
    console.log(fails ? `\n${fails} kind${fails > 1 ? 's' : ''} of thing missing` : '\nnothing from the original is missing');
  }
  if (findings.some(f => f.level === 'fail')) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('keep.mjs')) main();
