// Run: node scripts/palette.test.mjs
// Every contrast promise in the token contract, for every palette, both modes, both grounds of
// each mode, plus awkward brand colours and the CLI's refusals. Checks read the hex as written.
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, toOklch, contrast, deltaE, inGamut, fromOklch, hueDistance, hueFamily } from './lib/colour.mjs';
import { PALETTES, GROUNDS, SEMANTIC, ROLES, STEPS, TEXT_CR, UI_CR, SERIES_DE, DISTINCT_DE, VISIBLE_DE, build, fromColours, ramp, isMud } from './palette.mjs';

let checks = 0;
const ok = (cond, msg) => { assert(cond, msg); checks++; };
const L = hex => toOklch(parse(hex)).l;
const atLeast = (t, fg, bg, min, where) => {
  ok(t[fg] && t[bg], `${where}: missing --${t[fg] ? bg : fg}`);
  const r = contrast(t[fg], t[bg]);
  ok(r >= min, `${where}: --${fg} ${t[fg]} on --${bg} ${t[bg]} is ${r.toFixed(2)}:1, needs ${min}`);
};
const SERIES = [1, 2, 3, 4, 5, 6].map(i => `series-${i}`).concat('series-muted');
const FILLS = [...ROLES, ...Object.keys(SEMANTIC)];

// The whole contract for one sheet.
function contract(s, where) {
  const t = s.tokens, surfaces = ['page', 'surface', 'surface-2'];
  for (const bg of [...surfaces, 'selected']) for (const fg of ['text', 'text-2', 'text-3']) atLeast(t, fg, bg, TEXT_CR, where);
  for (const bg of ['page', 'surface']) { atLeast(t, 'line-strong', bg, UI_CR, where); atLeast(t, 'focus', bg, UI_CR, where); }
  for (const x of ['action', 'action-hover', 'action-pressed']) atLeast(t, 'on-action', x, TEXT_CR, where);
  for (const x of ['control', 'control-hover', 'control-pressed']) atLeast(t, 'text', x, TEXT_CR, where);
  const off = contrast(t['text-disabled'], t.page);
  ok(off >= 2.5 && off < TEXT_CR, `${where}: --text-disabled is ${off.toFixed(2)}:1, should be legible but quieter than text`);
  ok(contrast(t['on-action-disabled'], t['action-disabled']) >= 2.5, `${where}: disabled action label illegible`);
  for (const r of FILLS) {
    // A fill is a block: no 3:1, but it must stand off the page and --surface-2.
    const off = Math.min(deltaE(t[r], t.page), deltaE(t[r], t['surface-2']));
    ok(off >= VISIBLE_DE[s.mode], `${where}: --${r} ${t[r]} stands off the page by deltaE ${off.toFixed(3)}, needs ${VISIBLE_DE[s.mode]}`);
    for (const x of [r, `${r}-hover`, `${r}-pressed`]) { atLeast(t, `on-${r}`, x, TEXT_CR, where); atLeast(t, `on-${r}-2`, x, TEXT_CR, where); }
    // Secondary text carries the fill's hue; the line on the fill is seen but quieter than that text.
    const fc = toOklch(parse(t[r])).c, o2 = toOklch(parse(t[`on-${r}-2`]));
    if (fc >= 0.06 && t[`on-${r}-2`] !== t[`on-${r}`]) ok(o2.c > 0.003, `${where}: --on-${r}-2 ${t[`on-${r}-2`]} is grey, not tinted by the fill`);
    if (t[`on-${r}-2`] === t[`on-${r}`] && ROLES.includes(r)) ok(s.notes.some(n => n.startsWith('no room for quieter text') && n.includes(r)), `${where}: --on-${r}-2 equals --on-${r} without a note`);
    ok(contrast(t[`${r}-line`], t[r]) < contrast(t[`on-${r}-2`], t[r]), `${where}: --${r}-line is not quieter than --on-${r}-2`);
    ok(deltaE(t[`${r}-line`], t[r]) >= 0.05, `${where}: --${r}-line vanishes into --${r}`);
    for (const bg of [...surfaces, `${r}-tint`]) atLeast(t, `${r}-ink`, bg, TEXT_CR, where);
    atLeast(t, 'text', `${r}-tint`, TEXT_CR, where);
    ok(['#111111', '#FFFFFF'].includes(t[`on-${r}`]), `${where}: --on-${r} is ${t[`on-${r}`]}, not near-black or white`);
    // Hover lighter and pressed darker; pale fills darken for both; pressed always below hover.
    const [f, h, p] = [r, `${r}-hover`, `${r}-pressed`].map(n => L(t[n]));
    ok(p < h - 0.01, `${where}: --${r}-pressed is not darker than hover`);
    if (f > 0.86) ok(h < f && p < f, `${where}: pale --${r} should darken on hover and press`);
    else if (f > 0.13) ok(h > f && p < f, `${where}: --${r} hover should lighten and pressed darken`);
  }
  for (const n of SERIES) { ok(n in t, `${where}: missing --${n}`); atLeast(t, n, 'page', UI_CR, where); }
  for (let i = 0; i < SERIES.length; i++) for (let j = i + 1; j < SERIES.length; j++) {
    const d = deltaE(t[SERIES[i]], t[SERIES[j]]);
    ok(d >= SERIES_DE, `${where}: --${SERIES[i]} and --${SERIES[j]} differ by deltaE ${d.toFixed(3)}, needs ${SERIES_DE}`);
  }
  ok(s.fit === 'native' || s.adjustments.length > 0, `${where}: classed ${s.fit} but no adjustment is reported`);
}

// Grounds and neutral structure.
function grounds(s, where) {
  const t = s.tokens, [pg, sf, s2] = ['page', 'surface', 'surface-2'].map(n => L(t[n]));
  if (s.mode === 'light') {
    ok(s.ground === 'white' ? t.page === '#FFFFFF' && sf < pg && s2 < sf : t.surface === '#FFFFFF' && Math.abs(pg - 0.97) < 0.005 && s2 < pg,
      `${where}: light surfaces out of order`);
    ok(L(t.text) > 0.1, `${where}: light text is pure black`);
    ok(/,/.test(t['shadow-1']) && /,/.test(t['shadow-2']), `${where}: shadows need a short and a long layer`);
  } else {
    ok(s.ground === 'black' ? t.page === '#000000' : Math.abs(pg - 0.145) < 0.005, `${where}: dark page`);
    ok(pg < sf && sf < s2 && s2 < L(t.selected), `${where}: dark surfaces should step up in lightness`);
    ok(Math.abs(L(t.text) - 0.94) < 0.01, `${where}: dark text should sit near L 0.94, not pure white`);
    ok(t['shadow-1'] === 'none' && /,/.test(t['shadow-2']), `${where}: dark depth comes from surfaces`);
  }
}

// Dark is derived, not inverted: same hue, no more chroma, and the light fill is the palette's own.
function derived(pal, light, dark, where) {
  for (const r of ROLES) {
    const b = toOklch(parse(pal[r])), d = toOklch(parse(dark.tokens[r]));
    if (b.c >= 0.03) ok(hueDistance(b.h, d.h) <= 4, `${where}: dark --${r} hue moved ${hueDistance(b.h, d.h).toFixed(1)} degrees`);
    ok(d.c <= b.c + 0.005, `${where}: dark --${r} gained chroma`);
    ok(light.tokens[r] === pal[r].toUpperCase() || light.adjustments.some(a => a.startsWith(`${r}:`)),
      `${where}: light --${r} changed without a reported adjustment`);
  }
}

// ---------- palette data ----------

ok(PALETTES.length === 26, `expected 26 palettes, found ${PALETTES.length}`);
ok(new Set(PALETTES.map(p => p.name)).size === 26, 'palette names repeat');
for (const p of PALETTES) {
  for (const r of ROLES) ok(/^#[0-9A-F]{6}$/.test(p[r]) && parse(p[r]), `${p.name}: ${r} ${p[r]} is not a #RRGGBB hex`);
  ok(p.character, `${p.name}: no character`);
  for (const [a, b] of [['lead', 'support'], ['lead', 'pop'], ['support', 'pop']])
    ok(deltaE(p[a], p[b]) >= DISTINCT_DE, `${p.name}: ${a} and ${b} differ by deltaE ${deltaE(p[a], p[b]).toFixed(3)}`);
  if (p.was) for (const [r, h] of Object.entries(p.was)) ok(ROLES.includes(r) && parse(h) && p.why, `${p.name}: was.${r} needs a hex and a why`);
}

// ---------- every palette, every mode and ground ----------

const all = (pal, label) => {
  const sheets = {};
  for (const mode of ['light', 'dark']) for (const ground of Object.keys(GROUNDS[mode])) {
    const where = `${label} ${mode}/${ground}`;
    const s = build(pal, { mode, ground });
    contract(s, where); grounds(s, where);
    sheets[`${mode}/${ground}`] = s;
  }
  derived(pal, sheets['light/white'], sheets['dark/near-black'], label);
  derived(pal, sheets['light/grey'], sheets['dark/black'], label);
  return sheets;
};
const graded = {};
for (const p of PALETTES) graded[p.name] = all(p, p.name);

// The palettes drawn for dark grounds keep their deep fills in dark mode instead of being lifted
// into other colours. Mono is the one poor dark palette: its #111111 lead is the page colour.
for (const name of ['Harbour', 'Greenhouse', 'Orchid', 'Nightshift', 'Arcade', 'Cellar', 'Aurora'])
  for (const g of Object.keys(GROUNDS.dark)) ok(graded[name][`dark/${g}`].fit !== 'poor', `${name} is poor on ${g}`);
ok(graded.Mono['dark/near-black'].fit === 'poor', 'Mono should be poor in dark: its lead is the page colour');
// Near-grey roles are named, in the sheet and in list; a hueless palette gets the no-hue note instead.
ok(graded.Breeze['light/white'].general.some(n => n.startsWith('lead is nearly grey')), 'Breeze lead should be noted as nearly grey');
ok(!graded.Tideline['light/white'].general.some(n => /nearly grey/.test(n)), 'Tideline has no near-grey role');
ok(!graded.Mono['light/white'].general.some(n => /nearly grey/.test(n)), 'Mono takes the no-hue note, not near-grey notes');

// --lean tempers the greys a little and keeps every promise.
for (const name of ['Tideline', 'Orchard', 'Mono']) {
  const p = PALETTES.find(x => x.name === name);
  for (const mode of ['light', 'dark']) {
    const s = build(p, { mode, lean: true });
    contract(s, `${name} ${mode} lean`);
    const c = toOklch(parse(s.tokens['surface-2'])).c;
    ok(name === 'Mono' ? c < 0.002 : c >= 0.002 && c <= 0.01, `${name} ${mode} lean: surface-2 chroma ${c.toFixed(4)}`);
  }
}

// ---------- ramps ----------

for (const p of PALETTES) for (const mode of ['light', 'dark']) {
  const t = build(p, { mode, ramps: true }).tokens;
  for (const r of ['grey', ...ROLES]) {
    const ls = STEPS.map(n => L(t[`${r}-${n}`]));
    ok(ls.every((l, i) => i === 0 || l < ls[i - 1]), `${p.name} ${mode}: --${r} ramp is not monotonic in L`);
    STEPS.forEach((n, i) => ok(Math.abs(ls[i] - L(t[`grey-${n}`])) < 0.01, `${p.name} ${mode}: --${r}-${n} lightness differs from grey-${n}`));
  }
  for (const r of ROLES) for (const w of ramp(toOklch(parse(p[r])))) ok(inGamut(fromOklch(w)), `${p.name}: ${r} ramp step out of gamut`);
}

// ---------- brand colours, including awkward ones ----------

for (const hex of ['#FF8A3D', '#C2410C', '#FFEB3B', '#0A1F44', '#777777', '#00FF00', '#8B5A2B']) {
  const pal = fromColours({ lead: hex });
  // No derived role is a dark yellow, orange or olive, unless the brand itself is one.
  for (const r of ['support', 'pop']) ok(isMud(hex) || !isMud(pal[r]), `brand ${hex}: derived ${r} ${pal[r]} reads as brown or olive`);
  for (const [a, b] of [['lead', 'support'], ['lead', 'pop'], ['support', 'pop']])
    ok(deltaE(pal[a], pal[b]) >= DISTINCT_DE, `brand ${hex}: derived ${a} and ${b} too close`);
  const sheets = all(pal, `brand ${hex}`);
  ok(pal.lead === hex && (sheets['light/white'].tokens.lead === hex || sheets['light/white'].adjustments.some(a => a.startsWith('lead:'))),
    `brand ${hex}: the brand should be the light lead, unchanged unless reported`);
  ok(pal.notes.some(n => n.startsWith('support:')) && pal.notes.some(n => n.startsWith('pop:')), `brand ${hex}: derivation not explained`);
}
ok(isMud('#8B5A2B') && !isMud('#FF8A3D') && !isMud('#FFEB3B'), 'the mud zone is dark warm hues, not bright ones');
const orange = fromColours({ lead: '#FF8A3D' });
ok(['teal', 'blue'].includes(hueFamily(orange.support)), `#FF8A3D should get a teal or blue support, got ${orange.support}`);
ok(orange.notes.some(n => /analogous \+30 #[0-9A-F]{6} \([^)]*reads as brown/.test(n)), '#FF8A3D header should say why the ochre was rejected');
const given = fromColours({ lead: '#FF8A3D', support: '#1D3557', pop: '#E9C46A' });
ok(given.support === '#1D3557' && given.pop === '#E9C46A', 'given support and pop are kept');

// ---------- the CLI ----------

const cli = fileURLToPath(new URL('./palette.mjs', import.meta.url));
const runCli = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
for (const args of [[], ['Nope'], ['--brand', 'nothex'], ['--brand'], ['Tideline', '--mode', 'sepia'], ['Tideline', '--ground', 'cream'],
  ['Tideline', '--ground', 'black'], ['contrast', '#fff'], ['contrast', '#fff', 'bogus'], ['Tideline', '--bogus'],
  ['list', '--mode', 'both'], ['Tideline', '--brand', '#FF8A3D'], ['Tideline', '--support', '#123456']]) {
  const r = runCli(args);
  ok(r.status === 2, `CLI ${JSON.stringify(args)} exited ${r.status}, expected 2`);
  ok(r.stderr.trim().split('\n').length === 1 && r.stdout === '', `CLI ${JSON.stringify(args)} should print one line to stderr`);
}
const good = args => { const r = runCli(args); ok(r.status === 0, `CLI ${JSON.stringify(args)} exited ${r.status}: ${r.stderr}`); return r.stdout; };
ok(/usage/.test(good(['--help'])), '--help prints usage');
ok(/4\.48:1/.test(good(['contrast', '#777777', '#ffffff'])) && /fail\s+4\.5/.test(good(['contrast', '#777777', '#ffffff'])), 'contrast reports ratio and thresholds');
const both = good(['Tideline', '--mode', 'both']);
for (const needle of ['color-scheme: light;', 'color-scheme: dark;', '@media (prefers-color-scheme: dark)', ':root:not([data-theme="light"])', ':root[data-theme="dark"]'])
  ok(both.includes(needle), `--mode both output lacks ${needle}`);
const json = JSON.parse(good(['--brand', '#FF8A3D', '--mode', 'both', '--json']));
ok(json.sheets.length === 2 && json.sheets[0].tokens.lead === '#FF8A3D', '--json carries both sheets with the brand as lead');
const listed = good(['list']);
ok(listed.split('\n').length > 26, 'list prints every palette');
ok(/Breeze[^\n]*\n[^\n]*lead nearly grey/.test(listed), 'list notes Breeze lead as nearly grey');
ok(/--grey-950/.test(good(['Olive Bar', '--ramps'])), 'names with spaces resolve and --ramps prints ramps');

console.log(`ok: ${checks} checks across ${PALETTES.length} palettes, 7 brand colours, both modes and all grounds`);
