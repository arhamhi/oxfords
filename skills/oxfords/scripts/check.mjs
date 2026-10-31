#!/usr/bin/env node
// Oxfords slop check. Zero dependencies, no browser: the fast first pass over source files.
// Fails on the unambiguous marks of a generated interface, warns on the judgement ones, and
// notes (info) what is allowed but worth a second look.
//
//   node check.mjs <file-or-dir> [more...] [--json] [--strict] [--quiet]
//
// --strict  warnings also fail      --json  machine output      --quiet  failures only
//
// Two kinds of rule. Line rules are regexes over each line. Colour rules read the CSS (the
// <style> blocks and style="" attributes of a page, or the whole of a stylesheet), follow
// var() chains to the custom properties and judge each colour in OKLCH with lib/colour.mjs.
// oxfords: it reads source, not pixels. The render check (scripts/shoot.mjs) covers contrast,
// clipping, overflow, focus and targets in a real browser. Nested cards and the rest of
// references/review.md stay manual. Put oxfords-ignore on a line to opt it out.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parse, toOklch, toHex, oklchCss, hueFamily, NEUTRAL_C, SATURATED_C } from './lib/colour.mjs';

const EXT = new Set(['.html', '.htm', '.css', '.scss', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.mdx']);
const SKIP = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'out', 'vendor', 'coverage']);

const FONTS = ['Inter', 'Geist', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Montserrat', 'Manrope', 'DM Sans',
  'Plus Jakarta Sans', 'Space Grotesk', 'Outfit', 'Instrument Serif', 'Playfair Display', 'Fraunces',
  'Cormorant', 'Lora', 'DM Serif Display'];
const fontAlt = FONTS.map(f => f.replace(/ /g, '[ +_-]?')).join('|');
// A banned face after one of these is a fallback inside the system stack, not a choice.
const SYSTEM_FONT = /system-ui|-apple-system|BlinkMacSystemFont|ui-sans-serif|ui-serif|ui-monospace|Segoe UI|SF Pro/i;
const BUZZ = ['seamless(?:ly)?', 'effortless(?:ly)?', 'unlock', 'unleash', 'elevate', 'supercharge', 'empower',
  'streamline', 'revolutioni[sz]e', 'reimagine', 'next[- ]gen(?:eration)?', 'world[- ]class', 'cutting[- ]edge',
  'game[- ]chang(?:ing|er)', 'all[- ]in[- ]one', 'at your fingertips', 'level up'];
const PURPLE = '(?:purple|violet|indigo|fuchsia|#(?:6366f1|4f46e5|7c3aed|8b5cf6|a855f7|9333ea|6d28d9|a78bfa|c084fc|818cf8)\\b)';
const ALPHA_TEXT = 'translucent text; use a solid grey token (--text-2, --text-3), because translucent text changes with what is behind it';

// ---------- reading the CSS ----------

const blank = s => s.replace(/[^\n]/g, ' ');
const inside = (i, rs) => rs.some(([s, e]) => i >= s && i < e);
const tagRanges = (text, name) => [...text.matchAll(new RegExp(`(<${name}\\b[^>]*>)([\\s\\S]*?)(?=<\\/${name}\\s*>|$)`, 'gi'))]
  .map(m => [m.index + m[1].length, m.index + m[1].length + m[2].length]);

// Split at top-level occurrences of any of `chars`, ignoring brackets, parens and quotes.
function splitTop(s, chars) {
  const out = [];
  let depth = 0, q = null, from = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q && s[i - 1] !== '\\') q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if ((ch === ')' || ch === ']') && depth) depth--;
    else if (!depth && chars.includes(ch)) { out.push(s.slice(from, i)); from = i + 1; }
  }
  out.push(s.slice(from));
  return out;
}

function declsOf(body, off) {
  const out = [];
  let from = 0;
  for (const seg of splitTop(body, ';')) {
    const k = seg.indexOf(':');
    const name = k > 0 ? seg.slice(0, k).trim() : '';
    if (/^[\w$@-]+$/.test(name)) out.push({
      name, prop: name.startsWith('--') ? name : name.toLowerCase(), value: seg.slice(k + 1).trim(),
      custom: /^(?:--|\$|@)/.test(name), off: off + from + seg.length - seg.trimStart().length,
    });
    from += seg.length + 1;
  }
  return out;
}

// Rules with their selector, the at-rules or parent rules around them, and their declarations.
function parseCss(css) {
  const rules = [], stack = [];
  let from = 0, depth = 0, q = null;
  const flush = to => { const top = stack.at(-1); if (top) top.decls.push(...declsOf(css.slice(from, to), from)); };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (q) { if ((ch === q && css[i - 1] !== '\\') || ch === '\n') q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { if (depth) depth--; continue; }
    if (depth) continue;
    if (ch === '{') {
      const pre = css.slice(from, i);
      stack.push({ sel: pre.trim(), off: from + pre.length - pre.trimStart().length, decls: [], at: stack.map(s => s.sel) });
      from = i + 1;
    } else if (ch === ';') { flush(i); from = i + 1; }
    else if (ch === '}') { flush(i); const r = stack.pop(); if (r) rules.push(r); from = i + 1; }
  }
  return rules;
}

// Same-length views of the file, so every offset still points at the right line.
// css: only the CSS. code: comments blanked. copy: code with <script> and <style> blanked too.
function views(text) {
  const svgs = [...text.matchAll(/<svg\b[\s\S]*?(?:<\/svg\s*>|$)/gi)].map(m => [m.index, m.index + m[0].length]);
  const scripts = tagRanges(text, 'script');
  const styles = tagRanges(text, 'style').filter(([s]) => !inside(s, svgs) && !inside(s, scripts));
  const markup = styles.length > 0 || /<\/?[a-z][\w.-]*(?:\s[^<>]*)?\/?>/i.test(text);
  const cssRanges = markup ? styles : [[0, text.length]];
  const uncomment = s => s.replace(/\/\*[\s\S]*?\*\//g, blank);
  let css = '', code = text, last = 0;
  for (const [s, e] of cssRanges) {
    css += blank(text.slice(last, s)) + uncomment(text.slice(s, e));
    code = code.slice(0, s) + uncomment(code.slice(s, e)) + code.slice(e);
    last = e;
  }
  css += blank(text.slice(last));
  if (markup) code = code.replace(/<!--[\s\S]*?-->/g, blank);
  let copy = code;
  for (const [s, e] of [...scripts, ...styles]) copy = copy.slice(0, s) + blank(copy.slice(s, e)) + copy.slice(e);
  copy = copy.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank);

  // style="" attributes become rules named after their element. Not inside <svg> artwork.
  const inline = [];
  if (markup) for (const m of copy.matchAll(/<([a-z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    if (inside(m.index, svgs)) continue;
    const tag = m[1].toLowerCase(), attrs = m[2], base = m.index + 1 + m[1].length;
    const cls = /\sclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const classes = (cls?.[1] ?? cls?.[2] ?? '').trim();
    const decls = [];
    const st = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    if (st) { const body = st[1] ?? st[2]; decls.push(...declsOf(body, base + st.index + st[0].length - 1 - body.length)); }
    const bg = /^(?:html|body)$/.test(tag) && /(?:^|\s)bg-\[([^\]\s]+)\]/.exec(classes);
    if (bg) decls.push({ name: 'background-color', prop: 'background-color', value: bg[1].replace(/_/g, ' '), custom: false, off: base + cls.index });
    if (decls.length) inline.push({ sel: tag + (classes ? '.' + classes.split(/\s+/).join('.') : ''), off: m.index, decls, at: [], inline: true });
  }
  return { css, code, copy, inline };
}

// ---------- selectors and tokens ----------

const DARK_Q = /\[data-(?:theme|mode|color-scheme|scheme|appearance)\s*[~|^$*]?=\s*["']?dark["']?\s*\]|\.(?:theme-)?dark(?![\w-])|\.dark-(?:mode|theme)(?![\w-])/gi;
const LIGHT_Q = /\[data-(?:theme|mode|color-scheme|scheme|appearance)\s*[~|^$*]?=\s*["']?light["']?\s*\]|\.(?:theme-)?light(?![\w-])/gi;
const NOT = /:not\((?:[^()]|\([^()]*\))*\)/g;
const has = (re, s) => { re.lastIndex = 0; return re.test(s); };

const inKeyframes = r => r.at.some(a => /^@(?:-\w+-)?keyframes/i.test(a)) || /^@(?:-\w+-)?keyframes/i.test(r.sel);
const isDark = r => r.at.some(a => /prefers-color-scheme\s*:\s*dark/i.test(a)) || has(DARK_Q, r.sel.replace(NOT, ''));
const subject = part => splitTop(part.trim(), ' >+~\t\n').filter(Boolean).pop() ?? '';
const subjects = sel => splitTop(sel, ',').map(subject);
// :root, html, body (with any qualifier), or a bare theme selector such as [data-theme="dark"].
const pageish = sel => /^@theme\b/i.test(sel) || splitTop(sel, ',').some(p => {
  const n = p.replace(NOT, '').replace(DARK_Q, '').replace(LIGHT_Q, '').trim();
  return n ? /^(?:html|body|:root|:host)(?![\w-])[^\s>+~]*$/i.test(n) : has(DARK_Q, p) || has(LIGHT_Q, p);
});

function tokensOf(rules) {
  const light = new Map(), dark = new Map(), any = new Map();
  for (const r of rules) {
    if (inKeyframes(r)) continue;
    const page = pageish(r.sel), dk = isDark(r);
    for (const d of r.decls) if (d.custom) {
      if (!any.has(d.name)) any.set(d.name, d.value);
      if (page) (dk ? dark : light).set(d.name, d.value);
    }
  }
  return { light, dark, any };
}

function mapVars(v, fn) {
  let out = '', i = 0;
  for (;;) {
    const j = v.indexOf('var(', i);
    if (j < 0) return out + v.slice(i);
    let k = j + 4, depth = 1;
    while (k < v.length && depth) { if (v[k] === '(') depth++; else if (v[k] === ')') depth--; k++; }
    const [name, ...fb] = splitTop(v.slice(j + 4, depth ? k : k - 1), ',');
    out += v.slice(i, j) + fn(name.trim(), fb.length ? fb.join(',') : null);
    i = k;
  }
}

// Replace var(--x) (and Sass $x) with its value, at most three lookups deep.
const MAX_HOPS = 3;
function expand(v, tk, theme = 'light', hops = 0, seen = { dark: false }) {
  const look = (name, fb) => {
    if (hops >= MAX_HOPS) return ' ';
    let def;
    if (theme === 'dark' && tk.dark.has(name)) { def = tk.dark.get(name); seen.dark = true; }
    else def = tk.light.get(name) ?? tk.any.get(name) ?? fb;
    return def == null ? ' ' : ` ${expand(def, tk, theme, hops + 1, seen)} `;
  };
  return mapVars(v, look).replace(/\$[\w-]+/g, n => (tk.any.has(n) ? look(n, null) : n));
}

// The value as the light theme sees it, plus the dark theme when a dark token changes it.
function themed(v, tk, dark = false) {
  if (dark) return [{ theme: 'dark', v: expand(v, tk, 'dark') }];
  const seen = { dark: false };
  const d = expand(v, tk, 'dark', 0, seen);
  return seen.dark ? [{ theme: 'light', v: expand(v, tk) }, { theme: 'dark', v: d }] : [{ theme: 'light', v: expand(v, tk) }];
}

// ---------- colours ----------

const COLOUR = /#[0-9a-f]{3,8}(?![\w-])|\b(?:rgba?|hsla?|oklch)\([^()]*\)|(?<![\w-])(?:white|black)(?![\w-])/gi;
const NO_NAMED = /^(?:font|src|content|grid|animation|transition|will-change|counter|list-style|quotes)/;
const SHADOW = /^(?:-webkit-)?(?:box-shadow|text-shadow|filter|backdrop-filter)$/;
const SEMANTIC = /^--(?:danger|warning|warn|success|info|error|critical|positive|negative|ok|good|bad|attention)(?:$|-)/i;

function literals(value, prop = '') {
  const v = value.replace(/url\((?:[^()]|\([^()]*\))*\)/gi, ' ').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ' ');
  const out = [];
  for (const m of v.matchAll(COLOUR)) {
    if (/^[a-z]+$/i.test(m[0]) && NO_NAMED.test(prop)) continue;
    const rgb = parse(m[0]);
    if (rgb) out.push({ raw: m[0], rgb });
  }
  return out;
}

const chroma = rgb => toOklch(rgb).c * (rgb.a ?? 1); // a faint tint carries little of its hue
const neutral = rgb => (rgb.a ?? 1) === 0 || toOklch(rgb).c < NEUTRAL_C;

function gradientBodies(v) {
  const out = [];
  for (const m of v.matchAll(/gradient\(/gi)) {
    let k = m.index + m[0].length, depth = 1;
    while (k < v.length && depth) { if (v[k] === '(') depth++; else if (v[k] === ')') depth--; k++; }
    out.push(v.slice(m.index + m[0].length, k - 1));
  }
  return out;
}

function pageKind(rgb) {
  const { l, c, h } = toOklch(rgb);
  const warm = h >= 40 && h <= 110 && c >= 0.012;
  if (warm && l >= 0.9) return 'bone';
  if (warm && l < 0.5) return 'warm-dark';
  return c > 0.02 ? 'tinted' : null;
}

// Every page background (html, body, :root), light and dark, with what it resolves to.
function pages(ctx) {
  const out = [];
  for (const r of ctx.rules) {
    if (inKeyframes(r) || /^@/.test(r.sel) || !pageish(r.sel)) continue;
    for (const d of r.decls) {
      if (!/^background(?:-color)?$/.test(d.prop) || ctx.ignored(d.line)) continue;
      for (const { theme, v } of themed(d.value, ctx.tk, isDark(r)))
        for (const { raw, rgb } of literals(v, d.prop)) {
          const kind = (rgb.a ?? 1) >= 0.5 && pageKind(rgb);
          if (kind) out.push({ kind, line: d.line, text: `${raw} = ${oklchCss(toOklch(rgb))}${theme === 'dark' ? ', dark theme' : ''}` });
        }
    }
  }
  return out;
}

// Every saturated colour literal, with the declaration it sits in.
function saturated(ctx) {
  const out = [];
  for (const r of ctx.rules) for (const d of r.decls) {
    if (ctx.ignored(d.line)) continue;
    for (const { raw, rgb } of literals(d.value, d.prop)) {
      if (chroma(rgb) < SATURATED_C) continue;
      out.push({ raw, h: toOklch(rgb).h, family: hueFamily(rgb), sem: d.custom && SEMANTIC.test(d.name), rule: r, decl: d });
    }
  }
  return out;
}

// Declarations that use a token, following tokens that point at it.
function usesOf(ctx, name, depth = 0, acc = []) {
  const re = name.startsWith('$') ? new RegExp(`\\${name}(?![\\w-])`) : new RegExp(`var\\(\\s*${name}\\s*[,)]`);
  for (const r of ctx.rules) for (const d of r.decls) {
    if (!re.test(d.value)) continue;
    if (!d.custom) acc.push({ rule: r, decl: d });
    else if (depth < MAX_HOPS && d.name !== name) usesOf(ctx, d.name, depth + 1, acc);
  }
  return acc;
}

function rawColours(ctx) {
  const seen = new Map();
  for (const r of ctx.rules) for (const d of r.decls) {
    if (d.custom || ctx.ignored(d.line)) continue;
    for (const { raw, rgb } of literals(mapVars(d.value, () => ' '), d.prop)) {
      if (rgb.a === 0 || (SHADOW.test(d.prop) && rgb.a < 1 && neutral(rgb))) continue;
      const key = toHex(rgb);
      if (!seen.has(key)) seen.set(key, { raw, line: d.line });
    }
  }
  if (seen.size <= 6) return [];
  const all = [...seen.values()];
  return [{ line: all[0].line, text: `${seen.size} distinct: ${all.slice(0, 5).map(x => x.raw).join(', ')}${all.length > 5 ? ', ...' : ''}` }];
}

function hueSprawl(ctx) {
  const fam = new Map();
  for (const x of ctx.sat) fam.set(x.family, (fam.get(x.family) ?? true) && x.sem);
  const list = [...fam].filter(([, semOnly]) => !semOnly).map(([f]) => f);
  return list.length > 4 ? [{ line: 0, text: `${list.length} families: ${list.join(', ')}` }] : [];
}

const TEXT_TAGS = new Set(['p', 'span', 'small', 'label', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'figcaption', 'caption', 'dt', 'dd', 'legend']);
const TEXT_WORDS = new Set(['text', 'texts', 'label', 'labels', 'meta', 'metadata', 'muted', 'caption', 'captions',
  'hint', 'hints', 'sub', 'subtitle', 'subtext', 'subhead', 'subheading', 'subheader', 'subtle', 'subline',
  'dim', 'faint', 'lede', 'note', 'notes', 'legend', 'desc', 'description']);
const STATE = /:(?:hover|active|focus|focus-visible|focus-within|disabled|checked)(?![\w-])|\[(?:aria-)?disabled|\.(?:is-)?disabled(?![\w-])|::?(?:placeholder|selection|marker|-webkit-input-placeholder)/i;
const textSel = sel => splitTop(sel, ',').some(p => {
  if (STATE.test(p)) return false;
  const s = subject(p), tag = /^[a-z][\w-]*/i.exec(s)?.[0].toLowerCase();
  if (tag && TEXT_TAGS.has(tag)) return true;
  return [...s.matchAll(/\.([\w-]+)/g)].some(m => m[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    .split(/[-_]+/).some(w => TEXT_WORDS.has(w.replace(/\d+$/, ''))));
});

function alphaText(ctx) {
  const out = [];
  for (const r of ctx.rules) {
    if (inKeyframes(r) || !textSel(r.sel)) continue;
    for (const d of r.decls) {
      if (ctx.ignored(d.line)) continue;
      let bad = false;
      if (d.prop === 'color') bad = themed(d.value, ctx.tk).some(({ v }) =>
        /color-mix\([^;]*\btransparent\b/i.test(v) || literals(v).some(x => x.rgb.a > 0 && x.rgb.a < 1));
      else if (d.prop === 'opacity') {
        const v = expand(d.value, ctx.tk).trim(), n = parseFloat(v) / (/^[\d.]+%/.test(v) ? 100 : 1);
        bad = n > 0 && n < 1;
      }
      if (bad) out.push({ line: d.line, text: `${r.sel}{${d.prop}:${d.value}}` });
    }
  }
  return out;
}

function purpleGradients(ctx) {
  const out = [];
  for (const r of ctx.rules) for (const d of r.decls) {
    if (d.custom || /mask/.test(d.prop) || !/gradient\(|var\(|\$/.test(d.value) || ctx.ignored(d.line)) continue;
    const hit = themed(d.value, ctx.tk, isDark(r)).some(({ v }) => gradientBodies(v).some(g => literals(g).some(x =>
      chroma(x.rgb) >= NEUTRAL_C && (hueFamily(x.rgb) === 'indigo' || hueFamily(x.rgb) === 'purple'))));
    if (hit) out.push({ line: d.line, text: `${d.prop}:${d.value}` });
  }
  return out;
}

const BUTTONISH = /^(?:button|a|input|summary)(?![\w-])|\.(?:btn|button|cta|primary|link)(?!\w)|\[type=["']?(?:submit|button)|\[role=["']?(?:button|link)/i;
const CONTROL_CHROME = /:focus|::?selection/i;
const CHROME_PROP = /^(?:outline(?:-color)?|accent-color|caret-color|text-decoration-color)$/;

// Conservative: a page stylesheet, every saturated colour blue, every use on a button, link or focus ring.
function oneBlueButton(ctx) {
  const sat = ctx.sat.filter(x => !x.sem);
  if (!sat.length || !sat.every(x => x.h >= 225 && x.h <= 290)) return [];
  if (!ctx.rules.some(r => !/^@/.test(r.sel) && pageish(r.sel))) return [];
  const uses = sat.flatMap(x => (x.decl.custom ? usesOf(ctx, x.decl.name) : [{ rule: x.rule, decl: x.decl }]));
  const control = u => CHROME_PROP.test(u.decl.prop) ||
    splitTop(u.rule.sel, ',').every(p => CONTROL_CHROME.test(p) || BUTTONISH.test(subject(p)));
  if (!uses.length || !uses.every(control)) return [];
  // A blue focus ring alone is not a blue button: the blue has to fill or colour the control.
  const btn = uses.find(u => !CHROME_PROP.test(u.decl.prop) &&
    splitTop(u.rule.sel, ',').some(p => !CONTROL_CHROME.test(p) && BUTTONISH.test(subject(p))));
  return btn ? [{ line: btn.decl.line, text: `${btn.rule.sel}{${btn.decl.prop}:${btn.decl.value}}` }] : [];
}

const DESTRUCTIVE = /delete|destroy|danger|remove|destructive/i;
// palette.mjs names: --lead, --lead-hover, --lead-pressed, --lead-ink, --lead-tint, --on-lead (and support, pop).
const PALETTE_VAR = /var\(\s*--(?:on-)?(?:lead|support|pop)(?:-(?:hover|pressed|ink|tint))?\s*[,)]/i;

function dangerAsBrand(ctx) {
  const palette = new Set(['--lead', '--support', '--pop'].flatMap(n => literals(expand(`var(${n})`, ctx.tk)).map(x => toHex(x.rgb))));
  const out = [];
  for (const r of ctx.rules) {
    if (!subjects(r.sel).some(s => DESTRUCTIVE.test(s))) continue;
    for (const d of r.decls) {
      if (!/^(?:background(?:-color)?|color)$/.test(d.prop) || ctx.ignored(d.line)) continue;
      if (PALETTE_VAR.test(d.value) || literals(mapVars(d.value, () => ' '), d.prop).some(x => palette.has(toHex(x.rgb))))
        out.push({ line: d.line, text: `${r.sel}{${d.prop}:${d.value}}` });
    }
  }
  return out;
}

// The declaration from a line match to its end, and whether every colour in it is a grey.
const declRest = (line, m) => /^[^;{}"']*/.exec(line.slice(m.index))[0];
const allNeutral = (s, ctx) => { const c = literals(expand(s, ctx.tk)); return c.length > 0 && c.every(x => neutral(x.rgb)); };

// ---------- rules ----------

// level: fail = unambiguous tell, warn = usually a tell, needs a reason to keep, info = allowed, look twice.
// skip(match, line, ctx, index) drops one match; the rule still fires on a later match in the line.
const RULES = [
  { id: 'default-font', level: 'fail', msg: 'default font nobody chose; use the system stack or a face with a stated reason',
    re: new RegExp(`(?:--[\\w-]*font[\\w-]*\\s*:[^;{}]*?|font(?:-family)?\\s*:[^;{}]*?|family=|font-(?:sans|serif|display)\\s*:[^;{}]*?|fontFamily\\s*:[^,}]*?)["'\\s:,=](${fontAlt})(?=["',;&:+\\s)]|$)`, 'i'),
    skip: m => SYSTEM_FONT.test(m[0].slice(0, -m[1].length)) },
  { id: 'emoji', level: 'fail', msg: 'emoji in the interface; use an icon from the set or plain text',
    re: /[\u{1F000}-\u{1FAFF}\u{2728}\u{2B50}\u{26A1}\u{2705}\u{274C}\u{2764}\u{1F680}]/u },
  { id: 'gradient-text', level: 'fail', msg: 'gradient-filled text',
    re: /background-clip\s*:\s*text|\bbg-clip-text\b/i },
  { id: 'purple-gradient', level: 'fail', msg: 'purple, indigo or violet gradient',
    re: new RegExp(`gradient\\([^;{}]*${PURPLE}|\\b(?:from|via|to)-(?:purple|violet|indigo|fuchsia)-\\d`, 'i') },
  { id: 'accent-rail', level: 'fail', msg: 'coloured bar on the side of an element; use a full fill or nothing',
    re: /border-(?:left|right|inline-start|inline-end)\s*:\s*(?:[2-9]|1\d)px\s+solid(?!\s+transparent)|\bborder-[lrse]-(?:2|4|8)\b|box-shadow\s*:\s*inset\s+-?[2-9]px\s+0\s+0/i,
    skip: (m, line, ctx) => allNeutral(declRest(line, m), ctx) },
  { id: 'bounce', level: 'fail', msg: 'bounce or elastic easing; ease out with no overshoot',
    re: /cubic-bezier\(\s*[\d.]+\s*,\s*(?:-\d*\.?\d+|1\.\d*[1-9]\d*|[2-9])|cubic-bezier\([^)]*,\s*(?:1\.\d*[1-9]\d*|[2-9](?:\.\d+)?)\s*\)|\banimate-bounce\b|@keyframes\s+\w*(?:bounce|elastic|wobble|jiggle)/i },
  { id: 'greeting-header', level: 'fail', msg: 'greeting as a heading; name the page',
    re: /good (?:morning|afternoon|evening)\s*,|welcome back\s*,/i },
  { id: 'tiny-text', level: 'fail', msg: 'text under 11px',
    re: /(?:font-size|--(?:font-size|fs)(?:-[\w-]+)?|--text-(?:\d?xs|xxs|tiny|micro|caption))\s*:\s*(?:0\.\d*[1-9]\d*|[1-9](?:\.\d+)?|10(?:\.\d+)?)px\b|\btext-\[(?:[1-9]|10)(?:\.\d+)?px\]/i },
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
    re: /box-shadow\s*:[^;{}]*\b0\s+0\s+(?:[2-9]\d|\d{3,})px/i,
    skip: (m, line, ctx) => allNeutral(declRest(line, m), ctx) },
  { id: 'pulse', level: 'warn', msg: 'pulsing element; keep only for live data',
    re: /\banimate-(?:pulse|ping)\b|@keyframes\s+\w*(?:pulse|ping)\b/i },
  { id: 'layout-transition', level: 'warn', msg: 'animating layout properties; use transform and opacity',
    re: /transition(?:-property)?\s*:[^;{}]*?(?<=[\s:,])(?:all|(?:max-|min-)?(?:width|height)|margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|top|left|right|bottom|inset)(?=[\s,;}!"']|$)/i },
  { id: 'hover-lift', level: 'warn', msg: 'element moves or scales on hover',
    re: /:hover[^{]*\{[^}]*transform\s*:\s*(?:translate|scale)|\bhover:(?:scale|-translate-y)-/i },
  { id: 'viewport-100vh', level: 'warn', msg: '100vh jumps on phones; use dvh or svh',
    re: /:\s*100vh\b|\bh-screen\b/i,
    skip: (m, line, ctx, i) => /\b100[dsl]vh\b|\bh-[dsl]vh\b/.test(ctx.codeLines.slice(i, i + 3).join('\n')) },
  { id: 'eyebrow', level: 'warn', msg: 'uppercase letter-spaced label; drop it unless it carries information',
    re: /\buppercase\b[^"'`]*\btracking-(?:wide|wider|widest)\b|\btracking-(?:wide|wider|widest)\b[^"'`]*\buppercase\b/i },
  { id: 'exclamation', level: 'warn', msg: 'exclamation mark in interface copy',
    re: />[^<>{}]*[A-Za-z]!\s*</ },
  { id: 'custom-cursor', level: 'warn', msg: 'custom cursor', re: /cursor\s*:\s*url\(/i },
  { id: 'alpha-text', level: 'warn', msg: ALPHA_TEXT,
    re: /\btext-(?:white|black|[a-z]+-\d{2,3})\/[1-9]\d?(?![\d%])|<(?:p|span|small|label|li|td|th|h[1-6])\b[^>]*\bclass(?:Name)?\s*=\s*["'][^"']*\bopacity-[1-9]\d?\b/ },
];

// Rules about visible copy. They read the copy view: no <script>, <style> or comments.
const COPY_ONLY = new Set(['exclamation', 'vague-button', 'em-dash', 'buzzword']);

// Rules that need the whole file. test(code, ctx) returns a count, or a list of { line, text }.
const FILE_RULES = [
  { id: 'eyebrow', level: 'warn', msg: 'uppercase letter-spaced label; drop it unless it carries information',
    test: s => [...s.matchAll(/\{[^{}]*\}/g)].filter(m => /text-transform\s*:\s*uppercase/i.test(m[0]) && /letter-spacing\s*:\s*0?\.(?:0[5-9]|[1-9])/i.test(m[0])).length },
  { id: 'no-focus-style', level: 'fail', msg: 'outline removed and no :focus-visible style anywhere in the file',
    test: s => /outline\s*:\s*(?:none|0)\b/i.test(s) && !/:focus-visible|focus-visible:|:focus-within/i.test(s) ? 1 : 0 },
  { id: 'no-reduced-motion', level: 'warn', msg: 'has animation but no prefers-reduced-motion rule',
    test: s => /@keyframes|animation\s*:|transition\s*:/i.test(s) && !/prefers-reduced-motion|motion-reduce:|motion-safe:/i.test(s) ? 1 : 0 },
  { id: 'bone-page', level: 'fail', msg: 'bone or cream page background; the page is white, black or grey',
    test: (s, ctx) => ctx.pages.filter(p => p.kind === 'bone') },
  { id: 'tinted-page', level: 'warn', msg: 'tinted page background; the page is white, black or grey and the palette goes on the content',
    test: (s, ctx) => ctx.pages.filter(p => p.kind === 'tinted') },
  { id: 'warm-dark-page', level: 'info', msg: 'warm brown dark page; allowed, but the default is a neutral near-black, so make sure it was chosen',
    test: (s, ctx) => ctx.pages.filter(p => p.kind === 'warm-dark') },
  { id: 'raw-colour', level: 'warn', msg: 'colour literals outside the tokens; define each colour once as a custom property and use var()',
    test: (s, ctx) => rawColours(ctx) },
  { id: 'hue-sprawl', level: 'warn', msg: 'more than four saturated hue families; keep to the palette plus the semantic colours',
    test: (s, ctx) => hueSprawl(ctx) },
  { id: 'alpha-text', level: 'warn', msg: ALPHA_TEXT, test: (s, ctx) => alphaText(ctx) },
  { id: 'purple-gradient', level: 'fail', msg: 'purple, indigo or violet gradient', test: (s, ctx) => purpleGradients(ctx) },
  { id: 'one-blue-button', level: 'warn', msg: 'the only colour is a blue button; put a palette on the content (see references/colour.md)',
    test: (s, ctx) => oneBlueButton(ctx) },
  { id: 'danger-as-brand', level: 'warn', msg: 'destructive action in a palette colour; use --danger, so it never looks like the main action',
    test: (s, ctx) => dangerAsBrand(ctx) },
  { id: 'many-sizes', level: 'warn', msg: 'more than eight distinct font sizes; keep to a scale',
    test: s => { const z = new Set([...s.matchAll(/font-size\s*:\s*([\d.]+(?:px|rem|em))/gi)].map(m => m[1].toLowerCase())); return z.size > 8 ? z.size : 0; } },
  { id: 'many-fonts', level: 'warn', msg: 'more than two font families declared',
    test: s => { const f = new Set([...s.matchAll(/font-family\s*:\s*["']?([^,;"'}]+)/gi)].map(m => m[1].trim().toLowerCase()).filter(n => !/^(inherit|var\(|system-ui|-apple-system|ui-|sans-serif|serif|monospace)/.test(n))); return f.size > 2 ? f.size : 0; } },
];

function context(text) {
  const v = views(text);
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineOf = off => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo + 1; };
  const rules = [...parseCss(v.css), ...v.inline];
  for (const r of rules) { r.line = lineOf(r.off); for (const d of r.decls) d.line = lineOf(d.off); }
  const lines = text.split('\n');
  const ctx = { ...v, rules, lines, codeLines: v.code.split('\n'), copyLines: v.copy.split('\n'),
    tk: tokensOf(rules), ignored: n => /oxfords-ignore/.test(lines[n - 1] ?? '') };
  ctx.pages = pages(ctx);
  ctx.sat = saturated(ctx);
  return ctx;
}

const globalRe = new Map(RULES.filter(r => r.skip).map(r => [r.id, new RegExp(r.re.source, r.re.flags + 'g')]));
function firstMatch(r, line, ctx, i) {
  if (!r.skip) return r.re.exec(line);
  for (const m of line.matchAll(globalRe.get(r.id))) if (!r.skip(m, line, ctx, i)) return m;
  return null;
}

export function check(text) {
  const ctx = context(text);
  const found = [];
  ctx.lines.forEach((orig, i) => {
    if (orig.length > 4000 || /oxfords-ignore/.test(orig)) return; // minified or opted out
    for (const r of RULES) {
      const m = firstMatch(r, COPY_ONLY.has(r.id) ? ctx.copyLines[i] : ctx.codeLines[i], ctx, i);
      if (m) found.push({ id: r.id, level: r.level, msg: r.msg, line: i + 1, text: m[0].trim().slice(0, 80) });
    }
  });
  for (const r of FILE_RULES) {
    const n = r.test(ctx.code, ctx);
    if (Array.isArray(n)) for (const f of n) found.push({ id: r.id, level: r.level, msg: r.msg, line: f.line, text: f.text.replace(/\s+/g, ' ').trim().slice(0, 80) });
    else if (n) found.push({ id: r.id, level: r.level, msg: r.msg, line: 0, text: n > 1 ? `${n} found` : '' });
  }
  const seen = new Set(); // one finding per rule per line
  return found.filter(f => !f.line || (!seen.has(`${f.id}:${f.line}`) && seen.add(`${f.id}:${f.line}`)));
}

function walk(p, out = []) {
  let st; try { st = statSync(p); } catch { console.error(`oxfords: cannot read ${p}`); process.exitCode = 2; return out; }
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!SKIP.has(n) && !n.startsWith('.')) walk(join(p, n), out); }
  else if (EXT.has(extname(p).toLowerCase())) out.push(p);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const paths = args.filter(a => !a.startsWith('--'));
  if (!paths.length || flags.has('--help')) {
    console.log('usage: node check.mjs <file-or-dir> [more...] [--json] [--strict] [--quiet]');
    process.exit(flags.has('--help') ? 0 : 2);
  }
  const files = paths.flatMap(p => walk(p));
  const report = files.map(f => ({ file: f, findings: check(readFileSync(f, 'utf8')) }));
  const all = report.flatMap(r => r.findings);
  const count = l => all.filter(f => f.level === l).length;
  const [fails, warns, infos] = ['fail', 'warn', 'info'].map(count);

  if (flags.has('--json')) console.log(JSON.stringify({ files: files.length, fails, warns, infos, report }, null, 2));
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
        if (fs[0].text) console.log(`        ${fs[0].text}`);
      }
    }
    console.log(`\n${files.length} file${files.length === 1 ? '' : 's'}, ${fails} fail, ${warns} warn${infos ? `, ${infos} info` : ''}`);
  }
  if (fails || (flags.has('--strict') && warns)) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check.mjs')) main();
