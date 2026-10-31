#!/usr/bin/env node
// Oxfords colour engine. Zero dependencies. Turns a palette, or a project's own colours, into a
// full token sheet: neutrals, neutral controls, role fills with states, inks and tints, chart
// series and fixed semantic colours, for light and dark. Every contrast is checked on the hex
// value as written, not on the maths before rounding.
//
//   node palette.mjs list [--mode light|dark]
//   node palette.mjs <Name> [--mode light|dark|both] [--ground G] [--lean] [--ramps] [--json]
//   node palette.mjs --brand "#HEX" [--support "#HEX"] [--pop "#HEX"] [same flags]
//   node palette.mjs --lead "#HEX" [--support "#HEX"] [--pop "#HEX"] [same flags]
//   node palette.mjs contrast <fg> <bg>
//
// Grounds: light white (default) or grey; dark near-black (default) or black.
// oxfords: lightness moves in OKLCH so hue holds; gamut mapping lowers chroma, never hue.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, toOklch, rgbFromOklch, toGamut, toHex, contrast, deltaE, hueFamily, hueDistance, NEUTRAL_C, SATURATED_C } from './lib/colour.mjs';

// ---------- thresholds, each with its reason ----------

export const TEXT_CR = 4.5;       // WCAG AA body text
export const UI_CR = 3;           // WCAG AA large text, icons, borders, focus rings, chart marks
const PAD = 0.02;                 // solve a hair past each line so other checkers' rounding agrees
const MID = { h: 0.05, p: -0.07 }; // hover +0.05 lighter, pressed -0.07 darker: seen, never confused
// When text fails on a state, the offsets slide to the end of their range (hover +0.04 to +0.06,
// pressed -0.06 to -0.08) that favours that text, before the fill itself is moved.
const TOWARD_DARK_TEXT = { h: 0.06, p: -0.06 }, TOWARD_WHITE_TEXT = { h: 0.04, p: -0.08 };
const PALE_L = 0.85;              // above this there is no room to lighten, so both states darken
const PALE_HOVER_DL = -0.04, PALE_PRESS_DL = -0.08; // pale states: still apart from each other
const PRESS_FLOOR = 0.1;          // below this every step reads as black
const DARK_C = 0.9;               // dark mode lowers chroma 10%: full chroma glows on a dark page
// A fill is a block, not a WCAG chart mark, so it needs no 3:1. It must stand off the page and
// --surface-2 by more than the deepest neutral layer does (0.035 on white, 0.09 on near-black),
// or it reads as one more surface. Text on it is --on-R; text and marks on the page are ink and series.
export const VISIBLE_DE = { light: 0.04, dark: 0.1 };
export const ADJUST_DL = 0.1;     // about one ramp step: a shade lighter is still the same colour
const HUE_KEEP = 10;              // ink and series further than this from the role's hue read as another colour
const TINT_L = { light: 0.955, dark: 0.27 }; // one step off the page, clearly that colour
const TINT_C = 0.035;             // quiet: more and the tint competes with the fill
const QUIET_L = 0.85, QUIET_C = 0.1; // pale and soft, or grey: a block colour, not a chart mark
export const SERIES_DE = 0.08;    // chart series must differ this much to be told apart side by side
export const DISTINCT_DE = 0.1;   // the three colours of a palette must differ this much
const STATE_DEG = 20;             // a role this close to a state colour's hue can be read as that state
const MAX_C = 0.17;               // derived colours stop here: past 0.15 to 0.2 colour turns neon
const POP_C = 0.12;               // a derived pop is the spark, so it gets real colour even from a dull brand
const LEAN_C = 0.006;             // --lean: tempers the greys without reading as a tint
const DISABLED_CR = 2.6;          // disabled text is exempt from 4.5 but must stay legible
const ON2_C = 0.06;               // secondary text on a fill: tinted by the fill's hue, never louder than a hint
const ON2_DE = 0.02;              // just noticeable: secondary text closer than this to on-R is on-R
const LINE_T = 0.4;               // a line on a fill sits 40% of the way to on-R-2: seen, never read first
const GREYISH_C = 0.04;           // below this chroma a role reads as a neutral on screen, whatever its hue
const INK_DARK = '#111111', INK_LIGHT = '#FFFFFF'; // text on fills: Oxfords near-black, or white

// OKLCH lightness of each neutral step. Light raised surfaces go darker (white page) or white
// (grey page); dark surfaces step up in lightness as they rise, roughly Sajid's 0 / 5 / 10%.
export const GROUNDS = {
  light: {
    white: { page: 1, surface: 0.985, surface2: 0.965, selected: 0.94, line: 0.92, control: 0.95 },
    grey: { page: 0.97, surface: 1, surface2: 0.945, selected: 0.92, line: 0.9, control: 0.93 },
  },
  dark: {
    'near-black': { page: 0.145, surface: 0.19, surface2: 0.235, selected: 0.27, line: 0.3, control: 0.28 },
    black: { page: 0, surface: 0.17, surface2: 0.215, selected: 0.25, line: 0.28, control: 0.26 },
  },
};
export const DEFAULT_GROUND = { light: 'white', dark: 'near-black' };
// Text is never pure black or white; in dark mode white is kept for the primary action.
const TONE = {
  light: { text: 0.2, text2: 0.4, action: 0.2, actionOff: 0.92, overlay: 0.4, shadow: [0.1, 0.05, 0.1, 0.12] },
  dark: { text: 0.94, text2: 0.76, action: 0.96, actionOff: 0.3, overlay: 0.64, shadow: [0, 0, 0.4, 0.5] },
};

// Fixed state colours, outside every palette. Each lightness sits mid-band in the range where
// the colour needs no move in either mode or ground: danger 0.505-0.545, warning 0.65-0.845,
// success 0.47-0.51, info 0.48-0.525. Warning takes dark text, so its ink is darker than its fill.
export const SEMANTIC = {
  danger: { l: 0.525, c: 0.2, h: 27 },
  warning: { l: 0.79, c: 0.16, h: 75 },
  success: { l: 0.49, c: 0.14, h: 150 },
  info: { l: 0.5, c: 0.17, h: 250 },
};

// Ramps: fixed lightness per step, shared by every hue and the greys, so 600 is 600 everywhere.
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const STEP_L = [0.97, 0.93, 0.87, 0.79, 0.71, 0.63, 0.55, 0.47, 0.39, 0.31, 0.24];
const STEP_C = [0.25, 0.45, 0.7, 0.9, 1, 1, 1, 0.95, 0.85, 0.7, 0.55]; // chroma tapers at both ends

export const ROLES = ['lead', 'support', 'pop'];

// ---------- data ----------

const here = fileURLToPath(new URL('.', import.meta.url));
export const PALETTES = JSON.parse(readFileSync(here + 'palettes.json', 'utf8')).palettes;
const key = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
export const findPalette = name => PALETTES.find(p => key(p.name) === key(name));

// ---------- colour helpers ----------

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lchOf = hex => toOklch(parse(hex));
const f2 = x => x.toFixed(2);

// The colour as it will be written: OKLCH, gamut mapped, rounded to hex and read back.
function q(want) {
  const w = { ...want, l: clamp(want.l) };
  const hex = toHex(rgbFromOklch(w));
  return { hex, rgb: parse(hex), want: w };
}
const cr = (a, b) => contrast(a.rgb, b.rgb);
const minCr = (c, bgs) => Math.min(...bgs.map(b => cr(c, b)));

// Move lightness in `dir` until ok() holds on the written colour: coarse steps, then halving, so
// the answer is the smallest move that passes. Null when no lightness passes.
function walk(want, dir, ok) {
  const at = l => q({ ...want, l });
  if (ok(at(want.l))) return at(want.l);
  let prev = want.l, l = want.l;
  for (;;) {
    l = clamp(l + dir * 0.01);
    if (ok(at(l))) break;
    if (l === 0 || l === 1) return null;
    prev = l;
  }
  let lo = prev, hi = l;
  for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (ok(at(mid))) hi = mid; else lo = mid; }
  return at(hi);
}

// Hover lighter, pressed darker. Pale fills have no room above, so both darken. A fill already
// at the floor has no room below, so pressed sits between it and hover.
export function states(f, d = MID) {
  if (f.l > PALE_L) return { hover: { ...f, l: f.l + PALE_HOVER_DL }, pressed: { ...f, l: f.l + PALE_PRESS_DL } };
  if (f.l < PRESS_FLOOR + 0.02) return { hover: { ...f, l: f.l + 0.06 }, pressed: { ...f, l: f.l + 0.03 } };
  return { hover: { ...f, l: f.l + d.h }, pressed: { ...f, l: Math.max(f.l + d.p, PRESS_FLOOR) } };
}

const ONS = [q(lchOf(INK_DARK)), q(lchOf(INK_LIGHT))];

// Text for a fill: near-black or white, whichever holds 4.5:1 on fill, hover and pressed. First
// the state offsets slide within their range toward that text; only if that fails does the fill
// move, by the least distance that lets one of them hold.
function withOn(fill, keep = () => true) {
  const worst = (f, on, d) => { const s = states(f, d); return Math.min(...[f, s.hover, s.pressed].map(x => cr(on, q(x)))); };
  const holds = (f, on, d) => worst(f, on, d) >= TEXT_CR + PAD;
  const rank = x => [x.moved, x.dist, -worst(x.fill.want, x.on, x.d)];
  const better = (a, b) => { const [p, r] = [rank(a), rank(b)]; for (let i = 0; i < 3; i++) if (Math.abs(p[i] - r[i]) > 1e-9) return p[i] < r[i]; return false; };
  let best = null;
  for (const on of ONS) {
    const dark = on === ONS[0];
    const slid = dark ? TOWARD_DARK_TEXT : TOWARD_WHITE_TEXT;
    let got = null;
    for (const d of [MID, slid]) if (!got && keep(q(fill)) && holds(fill, on, d)) got = { fill: q(fill), on, d, moved: 0, dist: 0 };
    if (!got) {
      const w = walk(fill, dark ? 1 : -1, c => holds(c.want, on, slid) && keep(c));
      if (w) got = { fill: w, on, d: slid, moved: 1, dist: Math.abs(w.want.l - fill.l) };
    }
    if (got && (!best || better(got, best))) best = got;
  }
  if (!best) throw new Error('no text colour holds on this fill');
  return best;
}

const quiet = b => b.c < NEUTRAL_C || (b.l >= QUIET_L && b.c <= QUIET_C);
// Roles that read as grey on screen. A quiet pop already has its own note, and a palette with no
// hue at all has the no-hue note.
const greyish = base => ROLES.every(r => base[r].c < NEUTRAL_C) ? [] :
  ROLES.filter(r => base[r].c < GREYISH_C && !(r === 'pop' && quiet(base.pop)));
export const ramp = (b, k = 1) => STEP_L.map((l, i) => toGamut({ l, c: b.c * k * STEP_C[i], h: b.h }));
const nearestStep = b => STEPS[STEP_L.reduce((bi, l, i) => (Math.abs(l - b.l) < Math.abs(STEP_L[bi] - b.l) ? i : bi), 0)];

// ---------- the parts of a sheet ----------

function neutrals(mode, ground, leanHue) {
  const G = GROUNDS[mode][ground], T = TONE[mode];
  const gw = l => (leanHue == null || l <= 0.001 || l >= 0.999 ? { l, c: 0, h: 0 } : { l, c: LEAN_C, h: leanHue });
  const g = l => q(gw(l));
  const away = mode === 'light' ? -1 : 1;
  const N = { gw, away, page: g(G.page), surface: g(G.surface), surface2: g(G.surface2), selected: g(G.selected),
    line: g(G.line), text: g(T.text), text2: g(T.text2) };
  const surfaces = [N.page, N.surface, N.surface2, N.selected];
  N.lineStrong = walk(gw(G.line), away, c => minCr(c, [N.page, N.surface]) >= UI_CR + PAD);
  N.text3 = walk(gw(G.selected), away, c => minCr(c, surfaces) >= TEXT_CR + PAD);
  N.textDisabled = walk(gw(G.page), away, c => cr(c, N.page) >= DISABLED_CR);
  const action = withOn(gw(T.action));
  const as = states(action.fill.want, action.d);
  N.action = action.fill; N.actionHover = q(as.hover); N.actionPressed = q(as.pressed); N.onAction = action.on;
  N.actionOff = g(T.actionOff);
  N.onActionOff = walk(gw(T.actionOff), mode === 'light' ? -1 : 1, c => cr(c, N.actionOff) >= DISABLED_CR);
  N.control = g(G.control);
  const cs = states(N.control.want);
  N.controlHover = q(cs.hover); N.controlPressed = q(cs.pressed);
  const tone = leanHue == null ? '#000000' : q(gw(0.2)).hex;
  const a = x => tone + Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase();
  const [s1, s2, s3, s4] = T.shadow;
  N.overlay = a(T.overlay);
  N.shadow1 = s1 ? `0 1px 2px ${a(s1)}, 0 4px 12px ${a(s2)}` : 'none';
  N.shadow2 = mode === 'light' ? `0 2px 4px ${a(s3)}, 0 12px 32px ${a(s4)}` : `0 2px 4px ${a(s3)}, 0 16px 40px ${a(s4)}`;
  return N;
}

// One role (or semantic colour): fill, states, text on it, ink for the page, tint.
function role(base, mode, N) {
  let f = mode === 'dark' ? { ...base, c: base.c * DARK_C } : { ...base };
  const start = q(f).hex;
  const visible = c => Math.min(deltaE(c.rgb, N.page.rgb), deltaE(c.rgb, N.surface2.rgb)) >= VISIBLE_DE[mode];
  if (!visible(q(f))) f = walk(f, N.away, visible).want;
  const lifted = q(f).hex, lift = lifted === start ? 0 : f.l - base.l;
  const { fill, on, d } = withOn(f, visible);
  const s = states(fill.want, d);
  const tint = q({ l: TINT_L[mode], c: Math.min(base.c * 0.4, TINT_C), h: base.h });
  const bgs = [N.page, N.surface, N.surface2, tint];
  const ink = minCr(fill, bgs) >= TEXT_CR + PAD ? fill : walk(fill.want, N.away, c => minCr(c, bgs) >= TEXT_CR + PAD);
  // Secondary text on the fill: the fill's hue, walked from the fill toward on-R until it holds
  // 4.5:1 on fill, hover and pressed. Lines sit part of the way there, quieter than that text.
  const states3 = [fill, q(s.hover), q(s.pressed)];
  const toward = on.hex === INK_LIGHT ? 1 : -1;
  let on2 = walk({ l: fill.want.l, c: Math.min(fill.want.c * 0.5, ON2_C), h: fill.want.h }, toward,
    c => minCr(c, states3) >= TEXT_CR + PAD);
  const flat = !on2 || deltaE(on2.rgb, on.rgb) < ON2_DE || cr(on2, fill) >= cr(on, fill); // no room: on-R itself
  if (flat) on2 = { ...on, want: toOklch(on.rgb) };
  const line = q({ l: fill.want.l + LINE_T * (on2.want.l - fill.want.l), c: Math.min(fill.want.c * 0.5, ON2_C), h: fill.want.h });
  // A move that leaves the hex unchanged is rounding, not a move.
  const nudge = fill.hex === lifted ? 0 : fill.want.l - f.l;
  return { base, fill, hover: states3[1], pressed: states3[2], on, on2, flat, line, ink, tint, lift, nudge, dl: lift + nudge };
}

// Chart series: lead, support, pop unless it is quiet, then steps along the lead and support
// ramps that differ most from what is picked, then a neutral. The muted grey is reserved first,
// closest to the page. Every one is 3:1 on page and surface and SERIES_DE from every other.
const SERIES_C = SATURATED_C;     // a chart step needs a real hue to be told apart from a grey
// Steps try mid tones first, then widen; near-black or near-white steps read as text.
const SERIES_BANDS = [[0.35, 0.85], [0.25, 0.92], [0, 1]];
const taper = l => { // ramp chroma taper at any lightness, interpolated between steps
  const i = STEP_L.findIndex(x => x <= l);
  if (i <= 0) return STEP_C[i === 0 ? 0 : STEP_C.length - 1];
  const t = (l - STEP_L[i]) / (STEP_L[i - 1] - STEP_L[i]);
  return STEP_C[i] + t * (STEP_C[i - 1] - STEP_C[i]);
};
function series(base, mode, N, pack = false) {
  const bgs = [N.page, N.surface], k = mode === 'dark' ? DARK_C : 1;
  const legible = c => minCr(c, bgs) >= UI_CR + PAD;
  const picked = [], taken = [];
  const apart = c => taken.every(p => deltaE(p.rgb, c.rgb) >= SERIES_DE);
  const gap = c => Math.min(...taken.map(p => deltaE(p.rgb, c.rgb)));
  const add = c => { if (c) { picked.push(c); taken.push(c); } return c; };
  const place = w => walk(w, N.away, x => legible(x) && apart(x));
  // Each role's own series: its colour moved away from the page, like an ink, until 3:1.
  const marks = {};
  for (const r of ROLES) if (r !== 'pop' || !quiet(base.pop)) marks[r] = add(place({ ...base[r], c: base[r].c * k }));
  const muted = place(N.gw(N.page.want.l));
  taken.push(muted);
  const along = (b, [lo, hi]) => {
    const c = b.c < NEUTRAL_C ? 0 : Math.max(b.c * k, SERIES_C), out = [];
    for (let l = lo; l <= hi + 1e-9; l += 0.01) out.push(q(c ? { l, c: c * taper(l), h: b.h } : N.gw(l)));
    return out;
  };
  // spread: the step that differs most from those picked. pack: the step nearest the page that
  // still differs enough, used only when spreading cannot fit six.
  const by = pack ? (x, y) => cr(x, N.page) - cr(y, N.page) : (x, y) => gap(y) - gap(x);
  const best = pool => pool.filter(c => legible(c) && apart(c)).sort(by)[0];
  for (const band of SERIES_BANDS) {
    for (let turn = 0; picked.length < 5 && turn < 6; turn++) add(best(along(turn % 2 ? base.support : base.lead, band)));
    if (picked.length < 6) add(best(along({ c: 0 }, band)));
    while (picked.length < 6 && add(best([base.lead, base.support, { c: 0 }].flatMap(b => along(b, band)))));
    if (picked.length === 6) break;
  }
  return { list: picked, muted, marks };
}

// Last resort when there is no hue to separate by: seven greys evenly spaced across the legible
// band, muted nearest the page, then the greys nearest the lead and the support, then the rest.
function greyScale(base, mode, N) {
  const legible = c => minCr(c, [N.page, N.surface]) >= UI_CR + PAD;
  const edge = walk(N.gw(N.page.want.l), N.away, legible).want.l, far = mode === 'light' ? 0 : 1;
  const cols = Array.from({ length: 7 }, (_, i) => q(N.gw(edge + ((far - edge) * i) / 6)));
  const [muted, ...rest] = cols, list = [];
  for (const r of ['lead', 'support']) {
    const near = rest.filter(c => !list.includes(c)).sort((x, y) => Math.abs(x.want.l - base[r].l) - Math.abs(y.want.l - base[r].l))[0];
    list.push(near);
  }
  return { list: [...list, ...rest.filter(c => !list.includes(c))], muted, marks: {}, scale: true };
}

// ---------- a whole sheet ----------

export function build(pal, { mode = 'light', ground, lean = false, ramps = false } = {}) {
  ground ??= DEFAULT_GROUND[mode];
  if (!GROUNDS[mode]?.[ground]) throw new Error(`no ${ground} ground in ${mode} mode`);
  const base = Object.fromEntries(ROLES.map(r => [r, lchOf(pal[r])]));
  const leanHue = lean && base.lead.c >= NEUTRAL_C ? base.lead.h : null;
  const N = neutrals(mode, ground, leanHue);
  const R = Object.fromEntries(ROLES.map(r => [r, role(base[r], mode, N)]));
  const S = Object.fromEntries(Object.entries(SEMANTIC).map(([n, b]) => [n, role(b, mode, N)]));
  let ser = series(base, mode, N);
  if (ser.list.length < 6) ser = series(base, mode, N, true);
  if (ser.list.length < 6) ser = greyScale(base, mode, N);
  const focus = minCr(R.lead.ink, [N.page, N.surface]) >= UI_CR ? R.lead.ink : N.text;

  const t = {
    page: N.page.hex, surface: N.surface.hex, 'surface-2': N.surface2.hex, selected: N.selected.hex,
    line: N.line.hex, 'line-strong': N.lineStrong.hex, focus: focus.hex, overlay: N.overlay,
    text: N.text.hex, 'text-2': N.text2.hex, 'text-3': N.text3.hex, 'text-disabled': N.textDisabled.hex,
    'shadow-1': N.shadow1, 'shadow-2': N.shadow2,
    action: N.action.hex, 'action-hover': N.actionHover.hex, 'action-pressed': N.actionPressed.hex, 'on-action': N.onAction.hex,
    'action-disabled': N.actionOff.hex, 'on-action-disabled': N.onActionOff.hex,
    control: N.control.hex, 'control-hover': N.controlHover.hex, 'control-pressed': N.controlPressed.hex,
  };
  for (const [n, x] of [...Object.entries(R), ...Object.entries(S)])
    Object.assign(t, { [n]: x.fill.hex, [`${n}-hover`]: x.hover.hex, [`${n}-pressed`]: x.pressed.hex,
      [`on-${n}`]: x.on.hex, [`on-${n}-2`]: x.on2.hex, [`${n}-line`]: x.line.hex, [`${n}-ink`]: x.ink.hex, [`${n}-tint`]: x.tint.hex });
  ser.list.forEach((c, i) => { t[`series-${i + 1}`] = c.hex; });
  t['series-muted'] = ser.muted.hex;
  let rampNote = null;
  if (ramps) {
    const k = mode === 'dark' ? DARK_C : 1;
    STEP_L.forEach((l, i) => { t[`grey-${STEPS[i]}`] = q(N.gw(l)).hex; });
    for (const r of ROLES) ramp(base[r], k).forEach((w, i) => { t[`${r}-${STEPS[i]}`] = q(w).hex; });
    rampNote = `ramps: ${ROLES.map(r => `${r} sits nearest ${nearestStep(base[r])}`).join(', ')}`;
  }

  // What moved, why, and what to watch.
  // notes belong to this mode; general holds what is true of the palette in any mode.
  const adjustments = [], notes = [], warnings = [], general = [...(pal.notes ?? [])];
  const moved = x => Math.abs(x) > 1e-6;
  // A role keeps its hue when its ink and its chart series still carry chroma at that hue.
  const lost = ROLES.filter(r => base[r].c >= SATURATED_C && [R[r].ink, ser.marks[r]].some(x => {
    if (!x) return false;
    const o = toOklch(x.rgb);
    return o.c < NEUTRAL_C || hueDistance(o.h, base[r].h) > HUE_KEEP;
  }));
  const worst = Math.max(...ROLES.map(r => Math.abs(R[r].dl)));
  const fit = lost.length || worst > ADJUST_DL + 1e-9 ? 'poor' : moved(worst) ? 'adjusted' : 'native';
  for (const r of lost) warnings.push(`${r}: its ink or chart series loses the hue here. Choose a palette that fits ${mode} mode.`);
  for (const r of ROLES) {
    const x = R[r], via = x.base.l + x.lift;
    if (moved(x.lift)) adjustments.push(`${r}: L ${f2(x.base.l)} to ${f2(via)} so it stands off the page and --surface-2 as a block`);
    if (moved(x.nudge)) adjustments.push(`${r}: L ${f2(via)} to ${f2(x.fill.want.l)} so ${x.on.hex === INK_LIGHT ? 'white' : 'near-black'} text holds on fill, hover and pressed`);
    if (Math.abs(x.dl) > ADJUST_DL + 1e-9) warnings.push(`${r} moved ${f2(Math.abs(x.dl))} in lightness and reads as a different colour. Choose a palette that fits ${mode} mode.`);
  }
  const faint = ROLES.filter(r => R[r].ink.hex !== R[r].fill.hex);
  const flat = ROLES.filter(r => R[r].flat);
  if (flat.length) notes.push(`no room for quieter text on ${flat.join(', ')}: ${flat.map(r => `--on-${r}-2`).join(', ')} equals --on-${flat.length > 1 ? 'R' : flat[0]}, so set secondary text smaller instead.`);
  if (faint.length) notes.push(`too ${mode === 'light' ? 'light' : 'dark'} for text on this page: ${faint.join(', ')}. Text, links and icons use ${faint.map(r => `--${r}-ink`).join(', ')}.`);
  const popOnLead = cr(R.pop.fill, R.lead.fill);
  if (popOnLead < UI_CR) notes.push(`pop on the lead block is ${popOnLead.toFixed(1)}:1, under 3: a pop mark on --lead gets an --on-lead edge, or sits beside the block.`);
  if (ser.scale) notes.push('chart series are an even grey scale: there is no hue to tell them apart, so label every series directly.');
  if (quiet(base.pop)) general.push('pop is a tint or a grey: a block with dark text, or a mark on a lead or support block, never a mark on the page. The chart series skip it.');
  if (ROLES.every(r => base[r].c < NEUTRAL_C)) general.push('no hue: chart series differ only in lightness, so label every series directly.');
  else for (const r of greyish(base)) {
    const tone = base[r].l < 0.45 ? 'dark' : base[r].l > 0.75 ? 'light' : 'mid';
    const colour = ROLES.filter(x => base[x].c >= GREYISH_C);
    general.push(`${r} is nearly grey (chroma ${base[r].c.toFixed(3)}): it reads as a ${tone} neutral, so the colour on screen comes from ${colour.join(' and ') || 'nothing else'}.`);
  }
  for (const r of ROLES) for (const [s, b] of Object.entries(SEMANTIC))
    if (base[r].c >= SATURATED_C && hueDistance(base[r].h, b.h) <= STATE_DEG)
      general.push(`${r} sits near ${s}: ${s === 'danger' ? 'errors and destructive actions' : `${s} states`} use --${s}, never --${r}. Keep --${r} off controls; pair every state with a word and an icon.`);
  if (rampNote) general.push(rampNote);
  return { name: pal.name, character: pal.character, source: Object.fromEntries(ROLES.map(r => [r, pal[r].toUpperCase()])),
    mode, ground, lean: leanHue != null, fit, adjustments, warnings, notes, general, tokens: t, R, S, N };
}

// ---------- from a project's own colours ----------

const STATE_FILLS = Object.values(SEMANTIC).map(q);
const stateLike = hex => Math.min(...STATE_FILLS.map(f => deltaE(hex, f.rgb))); // larger is safer
const norm = h => (h + 360) % 360;

// Dark yellows, oranges and olives are the classic derivation trap: they read as brown or khaki.
export const MUD_H = [55, 115];   // OKLCH hues from amber through yellow to olive
export const MUD_L = 0.62;        // below this lightness those hues read as brown or olive, not colour
export const isMud = hex => { const o = lchOf(hex); return o.c >= NEUTRAL_C && o.h >= MUD_H[0] && o.h <= MUD_H[1] && o.l < MUD_L; };
const SUPPORT_ORDER = [['analogous +30', 30], ['analogous -30', -30], ['split +150', 150], ['split -150', -150], ['complementary', 180]];
const POP_ORDER = [['complementary', 180], ['split +150', 150], ['split -150', -150], ['analogous +30', 30], ['analogous -30', -30]];
const stateNear = h => Object.entries(SEMANTIC).find(([, s]) => hueDistance(h, s.h) <= STATE_DEG)?.[0];

// The brand is the lead, unchanged. A missing role takes the first rotation in its order that is
// clear of the state hues, out of the mud zone (unless the brand lives there: its brown is its
// choice) and clearly apart from the colours already chosen. Support tries analogous, then split,
// then complementary; pop starts at the complement. Lightness separates each from the lead, then
// settles where its text needs no nudge in light mode. Rejections are named in the header.
export function fromColours({ lead, support, pop, label = 'Brand' }) {
  const L = lchOf(lead), notes = [], brandMud = isMud(lead);
  const c = Math.min(L.c, MAX_C), grey = L.c < NEUTRAL_C;
  const supL = L.l > 0.55 ? Math.max(0.3, L.l - 0.3) : Math.min(0.88, L.l + 0.35);
  const popL = Math.abs(L.l - 0.62) >= Math.abs(L.l - 0.78) ? 0.62 : 0.78;
  const mk = (l, h, cc = c) => withOn({ l, c: cc, h: norm(h) }).fill.hex;
  const pal = { name: `${label} ${toHex(parse(lead))}`, lead: toHex(parse(lead)), character: 'built from your own colours' };
  const derive = (role, order, l, cc, apart) => {
    const opts = order.map(([n, dh]) => ({ n, h: norm(L.h + dh), hex: mk(l, L.h + dh, cc) }));
    for (const o of opts) {
      const state = cc >= SATURATED_C && stateNear(o.h), close = apart.find(([, hex]) => deltaE(hex, o.hex) < DISTINCT_DE);
      o.why = [state && `sits near ${state}`, !brandMud && isMud(o.hex) && `reads as ${o.h < 85 ? 'brown' : 'olive'} at this lightness`,
        close && `too close to the ${close[0]}`].filter(Boolean).join('; ') || null;
    }
    let pick = opts.find(o => !o.why), how = 'the first rotation clear of the state hues, the mud zone and the other roles';
    if (!pick) { // nothing clears every filter: keep out of the mud and apart, then least like a state colour
      const ok = opts.filter(o => !/brown|olive|too close/.test(o.why));
      pick = (ok.length ? ok : opts).sort((a, b) => stateLike(b.hex) - stateLike(a.hex))[0];
      how = `no rotation cleared every filter, so the one least like a state colour (${pick.why})`;
    }
    const rest = opts.filter(o => o !== pick);
    const rejected = rest.filter(o => o.why).map(o => `${o.n} ${o.hex} (${o.why})`);
    const also = rest.filter(o => !o.why).map(o => `${o.n} ${o.hex}`);
    notes.push(`${role}: ${pick.n} ${pick.hex}, ${how}.${rejected.length ? ` Rejected: ${rejected.join(', ')}.` : ''}${also.length ? ` Also: ${also.join(', ')}.` : ''}`);
    return pick;
  };
  let used = null;
  if (support) pal.support = toHex(parse(support));
  else if (grey) { pal.support = mk(supL, 0, 0); notes.push(`support: grey ${pal.support}, because the brand has no hue.`); }
  else { used = derive('support', SUPPORT_ORDER, supL, c, [['lead', pal.lead]]); pal.support = used.hex; }
  if (pop) pal.pop = toHex(parse(pop));
  else if (grey) {
    const S = lchOf(pal.support).l, far = l => Math.min(Math.abs(l - L.l), Math.abs(l - S));
    pal.pop = mk([0.95, 0.2].sort((a, b) => far(b) - far(a))[0], 0, 0);
    notes.push(`pop: grey ${pal.pop}. Pass --pop "#HEX" to add one colour.`);
  } else {
    const order = POP_ORDER.filter(([n]) => n !== used?.n); // never the support's own rotation
    pal.pop = derive('pop', order, popL, Math.max(c, POP_C), [['lead', pal.lead], ['support', pal.support]]).hex;
  }
  for (const [a, b] of [['lead', 'support'], ['lead', 'pop'], ['support', 'pop']])
    if (deltaE(pal[a], pal[b]) < DISTINCT_DE) notes.push(`${a} and ${b} are close (deltaE ${deltaE(pal[a], pal[b]).toFixed(2)}); they will be hard to tell apart.`);
  pal.notes = notes;
  return pal;
}

// ---------- output ----------

function groups(t, ramps) {
  const role = n => [[n, `${n}-hover`, `${n}-pressed`], [`on-${n}`, `on-${n}-2`, `${n}-line`], [`${n}-ink`, `${n}-tint`]];
  const g = [
    ['neutrals', ['page', 'surface', 'surface-2', 'selected'], ['line', 'line-strong', 'focus', 'overlay'],
      ['text', 'text-2', 'text-3', 'text-disabled'], ['shadow-1'], ['shadow-2']],
    ['neutral controls', ['action', 'action-hover', 'action-pressed', 'on-action'], ['action-disabled', 'on-action-disabled'],
      ['control', 'control-hover', 'control-pressed']],
    ['palette', ...ROLES.flatMap(role)],
    ['semantic', ...Object.keys(SEMANTIC).flatMap(role)],
    ['chart', ['series-1', 'series-2', 'series-3', 'series-4'], ['series-5', 'series-6', 'series-muted']],
  ];
  if (ramps) g.push(['ramps', ...['grey', ...ROLES].flatMap(r => [STEPS.slice(0, 6), STEPS.slice(6)].map(s => s.map(n => `${r}-${n}`)))]);
  return g.map(([title, ...lines]) => [title, lines.map(l => l.filter(n => n in t))]);
}

function block(sheet, selector, indent = '') {
  const out = [`${indent}${selector} {`, `${indent}  color-scheme: ${sheet.mode};`];
  for (const [title, lines] of groups(sheet.tokens, Object.keys(sheet.tokens).some(k => k.startsWith('grey-')))) {
    out.push(`${indent}  /* ${title} */`);
    for (const l of lines) if (l.length) out.push(`${indent}  ${l.map(n => `--${n}: ${sheet.tokens[n]};`).join(' ')}`);
  }
  out.push(`${indent}}`);
  return out.join('\n');
}

function header(sheets, cmd) {
  const s = sheets[0], src = s.source;
  const lines = [`Oxfords colour: ${s.name}${s.character ? ` (${s.character})` : ''}`,
    `lead ${src.lead}, support ${src.support}, pop ${src.pop}`];
  for (const x of sheets) {
    lines.push(`${x.mode} on ${x.ground}${x.lean ? ', greys lean to the lead' : ''}: ${x.fit}${x.adjustments.length ? '' : ', nothing moved'}`);
    for (const a of x.adjustments) lines.push(`  ${a}`);
    for (const w of x.warnings) lines.push(`  warning: ${w}`);
    for (const n of x.notes) lines.push(`  ${n}`);
  }
  const general = [...new Set(sheets.flatMap(x => x.general))];
  if (general.length) { lines.push('notes:'); for (const n of general) lines.push(`  ${n}`); }
  lines.push(`regenerate: ${cmd}`);
  return `/* ${lines.join('\n   ')} */`;
}

export function css(sheets, cmd) {
  const out = [header(sheets, cmd)];
  const light = sheets.find(x => x.mode === 'light'), dark = sheets.find(x => x.mode === 'dark');
  if (light) out.push(block(light, ':root'));
  if (dark && light) out.push(`@media (prefers-color-scheme: dark) {\n${block(dark, ':root:not([data-theme="light"])', '  ')}\n}`, block(dark, ':root[data-theme="dark"]'));
  else if (dark) out.push(block(dark, ':root'));
  return out.join('\n\n') + '\n';
}

const plain = x => ({ mode: x.mode, ground: x.ground, fit: x.fit, adjustments: x.adjustments, warnings: x.warnings, notes: x.notes, tokens: x.tokens });

export function list(mode) {
  const modes = mode ? [mode] : ['light', 'dark'];
  const rows = PALETTES.map(p => {
    const sheets = Object.fromEntries(modes.map(m => [m, build(p, { mode: m })]));
    const fam = ROLES.map(r => hueFamily(p[r])).join(' / ');
    const flags = [];
    const any = Object.values(sheets)[0];
    for (const r of ROLES) for (const [s, b] of Object.entries(SEMANTIC))
      if (any.R[r].base.c >= SATURATED_C && hueDistance(any.R[r].base.h, b.h) <= STATE_DEG) flags.push(`${r} near ${s}`);
    for (const r of greyish(Object.fromEntries(ROLES.map(x => [x, any.R[x].base])))) flags.push(`${r} nearly grey`);
    if (sheets.light && contrast(p.lead, sheets.light.tokens.page) < UI_CR) flags.push('lead faint on white');
    return [p.name, fam, ...modes.map(m => sheets[m].fit), p.character, flags.join(', ')];
  });
  const head = ['Palette', 'Lead / support / pop', ...modes.map(m => m[0].toUpperCase() + m.slice(1)), 'Character', 'Notes'];
  const w = head.map((h, i) => (i >= head.length - 2 ? 0 : Math.max(h.length, ...rows.map(r => r[i].length))));
  const fmt = r => r.slice(0, -1).map((c, i) => (w[i] ? c.padEnd(w[i]) : c)).join('  ') + (r.at(-1) ? `\n${' '.repeat(w[0] + 2)}${r.at(-1)}` : '');
  return [fmt(head.slice(0, -1).concat('')), ...rows.map(fmt)].join('\n') +
    `\n\nnative: no change needed. adjusted: a fill moved up to ${ADJUST_DL} in OKLCH lightness. poor: moved further,\nor an ink or chart series lost the hue; pick another for that mode.\n`;
}

// ---------- CLI ----------

const USAGE = `usage:
  node palette.mjs list [--mode light|dark]
  node palette.mjs <Name> [--mode light|dark|both] [--ground white|grey|near-black|black, or light,dark like white,black] [--lean] [--ramps] [--json]
  node palette.mjs --brand "#HEX" [--support "#HEX"] [--pop "#HEX"] [same flags]
  node palette.mjs --lead "#HEX" [--support "#HEX"] [--pop "#HEX"] [same flags]
  node palette.mjs contrast <fg> <bg>`;

class Bad extends Error {}
const VALUED = new Set(['--mode', '--ground', '--brand', '--lead', '--support', '--pop']);
const BOOL = new Set(['--lean', '--ramps', '--json', '--help']);

function readArgs(argv) {
  const o = { _: [], ground: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const [k, inline] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    if (BOOL.has(k)) { o[k.slice(2)] = true; continue; }
    if (!VALUED.has(k)) throw new Bad(`unknown option ${k}`);
    const v = inline ?? argv[++i];
    if (v == null || (v.startsWith('--') && VALUED.has(v.split('=')[0]))) throw new Bad(`${k} needs a value`);
    if (k === '--ground') o.ground.push(...v.split(',').map(s => s.trim()).filter(Boolean));
    else o[k.slice(2)] = v;
  }
  return o;
}

const colourArg = (name, v) => { if (v == null) return v; const p = parse(v); if (!p) throw new Bad(`${name}: cannot read "${v}" as a colour`); return toHex({ ...p, a: 1 }); };

function quote(argv) { return ['node scripts/palette.mjs', ...argv.map(a => (/[\s#"']/.test(a) ? `"${a}"` : a))].join(' '); }

export function run(argv) {
  const o = readArgs(argv);
  if (o.help) return { out: USAGE + '\n' };
  const [cmd, ...rest] = o._;
  if (cmd === 'contrast') {
    if (rest.length !== 2) throw new Bad('contrast takes two colours: contrast <fg> <bg>');
    const [fg, bg] = rest.map((v, i) => { const p = parse(v); if (!p) throw new Bad(`cannot read "${v}" as a colour`); return p; });
    const r = contrast(fg, bg);
    const pass = (n, what) => `${r >= n ? 'pass' : 'fail'}  ${String(n).padEnd(3)} ${what}`;
    return { out: `${r.toFixed(2)}:1  ${toHex(fg)} on ${toHex(bg)}\n${pass(4.5, 'body text')}\n${pass(3, 'large text, icons, borders, focus, chart marks')}\n` };
  }
  if (cmd === 'list') {
    if (rest.length) throw new Bad(`list takes no names (got "${rest.join(' ')}")`);
    if (o.mode && !['light', 'dark'].includes(o.mode)) throw new Bad(`list --mode is light or dark, not "${o.mode}"`);
    return { out: list(o.mode) };
  }
  const mode = o.mode ?? 'light';
  if (!['light', 'dark', 'both'].includes(mode)) throw new Bad(`--mode is light, dark or both, not "${mode}"`);
  const modes = mode === 'both' ? ['light', 'dark'] : [mode];
  const grounds = {};
  for (const g of o.ground) {
    const m = Object.keys(GROUNDS).find(k => GROUNDS[k][g]);
    if (!m) throw new Bad(`unknown ground "${g}"; light takes white or grey, dark takes near-black or black`);
    if (!modes.includes(m)) throw new Bad(`ground ${g} is a ${m} ground, but the mode is ${mode}`);
    grounds[m] = g;
  }
  let pal;
  const own = o.brand ?? o.lead;
  if (o.brand && o.lead) throw new Bad('use --brand or --lead, not both');
  if (own != null) {
    if (cmd) throw new Bad(`give a palette name or --brand, not both (got "${o._.join(' ')}")`);
    pal = fromColours({ lead: colourArg(o.brand ? '--brand' : '--lead', own), support: colourArg('--support', o.support), pop: colourArg('--pop', o.pop), label: o.brand ? 'Brand' : 'Custom' });
  } else {
    if (o.support || o.pop) throw new Bad('--support and --pop need --brand or --lead');
    if (!cmd) throw new Bad('name a palette, or pass --brand "#HEX"; run list to see the palettes');
    pal = findPalette(o._.join(' '));
    if (!pal) throw new Bad(`no palette called "${o._.join(' ')}"; run list to see them`);
  }
  const sheets = modes.map(m => build(pal, { mode: m, ground: grounds[m], lean: !!o.lean, ramps: !!o.ramps }));
  if (o.json) return { out: JSON.stringify({ name: pal.name, character: pal.character, source: sheets[0].source,
    notes: [...new Set(sheets.flatMap(x => x.general))], sheets: sheets.map(plain) }, null, 2) + '\n' };
  return { out: css(sheets, quote(argv)) };
}

function main() {
  try { process.stdout.write(run(process.argv.slice(2)).out); }
  catch (e) {
    if (e instanceof Bad) { console.error(`oxfords: ${e.message}`); process.exit(2); }
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('palette.mjs')) main();
