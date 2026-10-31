// Oxfords render check: verdicts. Takes the raw facts lib/inpage.mjs collected, plus the decoded
// screenshots, and turns them into findings. Every threshold lives in T below, and every colour
// sum goes through lib/colour.mjs, so the source checker and the render check agree on colour.

import { contrast, blend, over, toOklch, hueFamily, luminance, deltaE, NEUTRAL_C, SATURATED_C } from './colour.mjs';

export const T = {
  text: 4.5, large: 3,         // WCAG 1.4.3; large = 24px, or 18.66px at weight 600 and up
  nonText: 3, ring: 3,         // WCAG 1.4.11: field edges and focus rings
  target: 24, touch: 44,       // WCAG 2.5.8 floor everywhere; 44 is the touch size on phones
  touchWidth: 480,             // widths at or under this are phones
  overlap: 2, clip: 1,         // px of intersection or cut-off before it counts
  hueShare: 0.005, hues: 4,    // a hue family over 0.5% of the page counts; more than 4 warns
  noticeable: 0.02,            // deltaE OK below which a focus colour change is invisible
  focusPixels: 16,             // pixels that must change by `noticeable` when no style changed: a
                               // 1px line 16px long is the smallest indicator anyone sees, and two
                               // renders of the same state differ by none
};

const CLEAR = { r: 0, g: 0, b: 0, a: 0 };
const col = b => ({ r: b[0] / 255, g: b[1] / 255, b: b[2] / 255, a: b[3] / 255 });

// What you see when `top` is painted inside an element: composite it through the element's own
// background and opacity, then each ancestor's, then onto the page canvas.
// chain = [[backgroundBytes, opacity], ...], innermost first.
function through(top, chain, canvas) {
  let c = top;
  for (const [bg, op] of chain) { c = over(c, col(bg)); c.a *= op; }
  return blend(c, canvas);
}
const chainOf = (i, nodes) => { const c = []; for (; i >= 0; i = nodes[i].p) c.push([nodes[i].bg, nodes[i].op]); return c; };

// A background-image (gradient or url) shows under the text before any opaque colour hides it.
const paintsImage = (i, nodes) => {
  for (; i >= 0; i = nodes[i].p) { if (nodes[i].img) return true; if (nodes[i].bg[3] >= 254.5) return false; }
  return false;
};
export const needsPixels = data => data.text.some(t => !t.sr && (t.over || paintsImage(t.id, data.nodes)));

// "4.47" rather than "4.5" when rounding would hide a fail.
const fmt = (r, need) => { const s = r.toFixed(1); return String(+s >= need ? Math.floor(r * 100) / 100 : +s); };
const pct = s => { const v = s * 100; return (v < 0.05 ? '<0.1' : v < 0.95 ? v.toFixed(1) : Math.round(v)) + '%'; };

// Darkest and lightest few percent of the pixels under the text boxes, from a render with the
// text made transparent. The worse of the two is the honest contrast on an image or gradient.
function sample(png, rects) {
  const area = rects.reduce((s, q) => s + q[2] * q[3], 0);
  const step = Math.max(1, Math.round(Math.sqrt(area / 20000)));
  const px = [];
  for (const [x, y, w, h] of rects) {
    const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(png.width, Math.ceil(x + w));
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(png.height, Math.ceil(y + h));
    for (let j = y0; j < y1; j += step) for (let i = x0; i < x1; i += step) {
      const k = (j * png.width + i) * 4, c = { r: png.data[k] / 255, g: png.data[k + 1] / 255, b: png.data[k + 2] / 255, a: 1 };
      px.push([luminance(c), c]);
    }
  }
  if (!px.length) return null;
  px.sort((p, q) => p[0] - q[0]);
  const at = f => px[Math.min(px.length - 1, Math.floor(f * px.length))][1];
  return { dark: at(0.05), light: at(0.95) };
}

// The middle 0.8em of a text line box, so the ascender and descender room in a line box never
// counts as overlap or clipping. Returns [left, top, right, bottom].
const core = (q, size) => { const mid = q[1] + q[3] / 2, half = Math.min(q[3], size * 0.8) / 2; return [q[0], mid - half, q[0] + q[2], mid + half]; };

// Is the text cut off by an overflow: hidden box, or scrolled out of it entirely (a closed
// accordion, a carousel slide), which is hiding rather than clipping?
function clipState(t) {
  const cores = t.rects.map(q => core(q, t.size));
  let gone = false, cut = null;
  for (const [ax, c] of [['x', t.clipX], ['y', t.clipY]]) {
    if (!c) continue;
    const [lo, hi] = ax === 'x' ? [0, 2] : [1, 3];
    if (!cores.some(q => q[hi] > c.b[lo] + T.clip && q[lo] < c.b[hi] - T.clip)) { gone = true; continue; }
    if (c.e || c.c || t.ell) continue; // ellipsis and line-clamp are truncation on purpose
    const before = Math.max(...cores.map(q => c.b[lo] - q[lo])), after = Math.max(...cores.map(q => q[hi] - c.b[hi]));
    const px = Math.max(before, after), side = ax === 'x' ? (after >= before ? 'right' : 'left') : (after >= before ? 'bottom' : 'top');
    if (px > T.clip && !cut) cut = { side, px, by: c.path };
  }
  return { gone, cut };
}

// ---------- colour share ----------
export function colourShare(png) {
  const counts = new Map(), d = png.data;
  for (let i = 0; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; counts.set(k, (counts.get(k) || 0) + 1); }
  const total = d.length / 4, fam = {}, sat = {};
  let neutral = 0;
  for (const [k, n] of counts) {
    const rgb = { r: (k >> 16) / 255, g: ((k >> 8) & 255) / 255, b: (k & 255) / 255, a: 1 };
    const { c } = toOklch(rgb);
    if (c < NEUTRAL_C) { neutral += n; continue; }
    const f = hueFamily(rgb);
    fam[f] = (fam[f] || 0) + n;
    if (c >= SATURATED_C) sat[f] = (sat[f] || 0) + n;
  }
  const share = o => Object.entries(o).map(([f, n]) => [f, n / total]).sort((a, b) => b[1] - a[1]);
  return { neutral: neutral / total, top: share(fam).slice(0, 4),
    saturated: share(sat).filter(([, s]) => s > T.hueShare).map(([f]) => f) };
}

// ---------- focus ----------
const differs = (p, q) => (p[3] > 2 || q[3] > 2) && (Math.abs(p[3] - q[3]) > 25 || deltaE(col(p), col(q)) >= T.noticeable);
const moved = (x, y, tol) => x.length !== y.length || x.some((v, i) => Math.abs(v - y[i]) > tol);
const outlineOn = x => x.ol[0] !== 'none' && x.ol[1] > 0 && (x.ol[0] === 'auto' || x.ol[2][3] > 25);
const outlineChanged = (b, n) => outlineOn(b) !== outlineOn(n) || (outlineOn(n) && (b.ol[0] !== n.ol[0] ||
  Math.abs(b.ol[1] - n.ol[1]) > 0.5 || Math.abs(b.ol[3] - n.ol[3]) > 0.5 || differs(b.ol[2], n.ol[2])));
const shadowSig = x => x.rings.filter(r => r.c[3] > 25).map(r => `${r.c.map(Math.round)} ${r.n} ${r.inset}`).join(';');

function looksDifferent(b, n) {
  return outlineChanged(b, n) || shadowSig(b) !== shadowSig(n) || differs(b.bg, n.bg) || differs(b.fg, n.fg) ||
    b.bi !== n.bi || moved(b.bw, n.bw, 0.5) || b.bc.some((c, i) => (b.bw[i] > 0 || n.bw[i] > 0) && differs(c, n.bc[i])) ||
    b.td !== n.td || (n.td !== 'none' && differs(b.tdc, n.tdc)) || Math.abs(b.op - n.op) > 0.05 ||
    b.tf !== n.tf || moved(b.at, n.at, 1) || b.ps !== n.ps || b.svg !== n.svg;
}

// Contrast of each outline or ring that focus drew, against what sits behind it. An outline
// with style auto is the browser's own two-tone ring, which is visible on anything.
function ringRatios(b, n, own, outside, canvas) {
  const out = [], bgOut = through(CLEAR, outside, canvas), bgIn = through(CLEAR, own, canvas);
  if (outlineOn(n) && outlineChanged(b, n))
    out.push(n.ol[0] === 'auto' ? Infinity : contrast(col(n.ol[2]), n.ol[3] < 0 ? bgIn : bgOut));
  if (shadowSig(b) !== shadowSig(n))
    for (const r of n.rings) {
      const [x = 0, y = 0, , spread = 0] = r.n;
      if (r.c[3] > 25 && Math.abs(x) <= 1 && Math.abs(y) <= 1 && spread >= 1) out.push(contrast(col(r.c), r.inset ? bgIn : bgOut));
    }
  return out;
}

// Did any watched element's computed look change? The cheap test, run during the Tab walk.
export const focusChanged = f => !!f.before && f.now.some((n, i) => looksDifferent(f.before[i], n));
// A focused element that is still outside the viewport, like a skip link that never moves in.
export const offScreen = ({ box: [l, t, r, b], vw, vh }) => r - l >= 1 && b - t >= 1 && (r <= 0 || b <= 0 || l >= vw || t >= vh);

// Pixels that differ noticeably between two same-size clips (focused and blurred).
export function pixelChange(a, b) {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2]) continue;
    const p = { r: a.data[i] / 255, g: a.data[i + 1] / 255, b: a.data[i + 2] / 255, a: 1 };
    const q = { r: b.data[i] / 255, g: b.data[i + 1] / 255, b: b.data[i + 2] / 255, a: 1 };
    if (deltaE(p, q) >= T.noticeable) n++;
  }
  return n;
}

// ---------- all verdicts for one render ----------
export function judge({ data, shot, bare, focus, width }) {
  const out = [], canvas = col(data.canvas), nodes = data.nodes;
  const add = (level, rule, msg, text = '', path = '') => out.push({ level, rule, msg, text, path });
  let pixelCount = 0;

  // Text: clipping, contrast, and the boxes that go into the overlap sweep.
  const visible = [];
  for (const t of data.text) {
    if (t.sr) continue;
    const { gone, cut } = t.ctl ? {} : clipState(t);
    if (gone) continue;
    if (!t.ctl) visible.push(t);
    if (cut) add('fail', 'clipped-text', `${Math.round(cut.px)}px cut off the ${cut.side} by overflow${cut.by ? ` on ${cut.by}` : ''}`, t.text, t.path);
    if (t.dis || t.clipText) continue; // disabled controls are exempt; gradient text is check.mjs's job
    const chain = chainOf(t.id, nodes), op = chain.reduce((o, c) => o * c[1], 1), fg = col(t.fg);
    const need = t.size >= 24 || (t.size >= 18.66 && t.weight >= 600) ? T.large : T.text;
    let ratio = null, pixels = false;
    if (bare && (t.over || paintsImage(t.id, nodes))) {
      const s = sample(bare, t.rects);
      if (s) { const f = { ...fg, a: fg.a * op }; ratio = Math.min(contrast(f, s.dark), contrast(f, s.light)); pixels = true; pixelCount++; }
    }
    if (ratio == null) ratio = contrast(through(fg, chain, canvas), through(CLEAR, chain, canvas));
    if (ratio < need) add('fail', 'text-contrast', `${fmt(ratio, need)}:1 needs ${need}${pixels ? ', measured on pixels' : ''}`, t.text, t.path);
  }

  // Overlapping text: sweep the line cores top to bottom, compare only boxes that share rows.
  // Each core is first cut to its overflow box, so text that is clipped away cannot overlap.
  const boxes = [];
  for (const t of visible) for (const q of t.rects) {
    const b = core(q, t.size);
    if (t.clipX) { b[0] = Math.max(b[0], t.clipX.b[0]); b[2] = Math.min(b[2], t.clipX.b[2]); }
    if (t.clipY) { b[1] = Math.max(b[1], t.clipY.b[1]); b[3] = Math.min(b[3], t.clipY.b[3]); }
    if (b[2] - b[0] > T.overlap && b[3] - b[1] > T.overlap) boxes.push([...b, t]);
  }
  boxes.sort((a, b) => a[1] - b[1]);
  const pairs = new Set();
  for (let i = 0; i < boxes.length && pairs.size < 50; i++) {
    const A = boxes[i];
    for (let j = i + 1; j < boxes.length && boxes[j][1] < A[3] - T.overlap; j++) {
      const B = boxes[j], key = [A[4].id, B[4].id].sort().join(':');
      if (A[4] === B[4] || pairs.has(key)) continue;
      // A fixed bar or a scroll container over other text: the lower half of the view can be
      // scrolled clear (content under a bottom tab bar). The top half, at scroll 0, cannot.
      if (A[4].layer !== B[4].layer && Math.max(A[1], B[1]) > data.ih / 2) continue;
      const ox = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), oy = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
      if (ox <= T.overlap || oy <= T.overlap) continue;
      pairs.add(key);
      add('fail', 'overlapping-text', `runs into "${B[4].text.slice(0, 30)}" (${B[4].path})`, A[4].text, A[4].path);
    }
  }

  // Form field edges against what is around them. A fill that contrasts is an edge too, and so
  // is the edge of a wrapper that hugs the field. The best of them is what a user sees.
  const edge = (id, sides) => {
    const own = chainOf(id, nodes), outside = through(CLEAR, own.slice(1), canvas);
    const s = sides.filter(([w]) => w >= 0.5).map(([, c]) => contrast(through(col(c), own, canvas), outside));
    return [s.length ? Math.max(...s) : 1, contrast(through(CLEAR, own, canvas), outside)];
  };
  for (const f of data.fields) {
    let [border, fill] = edge(f.id, f.sides);
    for (const w of f.wraps) { const [b, l] = edge(w.id, w.sides); border = Math.max(border, b); fill = Math.max(fill, l); }
    if (Math.max(border, fill) < T.nonText) add('warn', 'field-border', `border ${fmt(border, 3)}:1, fill ${fmt(fill, 3)}:1, needs 3`, '', f.path);
  }

  // Sideways scroll.
  const wd = data.wide, who = wd.offenders.slice(0, 3).map(o => `${o.path} to ${Math.round(o.right)}px`).join(', ');
  if (!wd.rootClips && wd.sw > data.iw) add('fail', 'sideways-scroll', `page is ${wd.sw}px wide in a ${data.iw}px viewport`, '', who);
  else if (wd.rootClips && wd.offenders.length) add('warn', 'hidden-overflow', `overflow-x hidden on the page cuts content past ${data.iw}px`, '', who);

  // Targets. Under 24px fails unless a 24px circle around it touches nothing (the WCAG 2.5.8
  // spacing exception). Inline links in running text are exempt from both sizes.
  const tg = data.targets;
  const dims = t => [t.box[2] - t.box[0], t.box[3] - t.box[1]];
  const small = tg.map(t => !t.inline && dims(t).some(v => v < T.target));
  const centre = t => [(t.box[0] + t.box[2]) / 2, (t.box[1] + t.box[3]) / 2];
  const toBox = ([x, y], b) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
  const nested = (i, j) => { for (let k = tg[i].up; k >= 0; k = tg[k].up) if (k === j) return true; return false; };
  tg.forEach((t, i) => {
    const [w, h] = dims(t), size = `${Math.round(w)}×${Math.round(h)}`, label = t.name || t.kind, c = centre(t);
    if (small[i] && tg.some((u, j) => j !== i && !nested(i, j) && !nested(j, i) &&
      (toBox(c, u.box) < T.target / 2 || (small[j] && Math.hypot(c[0] - centre(u)[0], c[1] - centre(u)[1]) < T.target))))
      return add('fail', 'target-size', `${size} needs 24×24 or more room around it`, label, t.path);
    if (width <= T.touchWidth && !t.inline && (w < T.touch || h < T.touch)) add('warn', 'small-target', `${size} needs 44×44 on touch`, label, t.path);
  });

  // Accessible names.
  for (const n of data.names) {
    if (!n.via) add('fail', 'no-name', `${n.kind} has no accessible name`, '', n.path);
    else if (n.via === 'placeholder') add('warn', 'placeholder-label', `${n.kind} is named only by its placeholder`, n.name, n.path);
  }

  // Keyboard focus, one Tab press at a time.
  // When no computed style changed, shoot.mjs compared pixels around the element (f.pixels): a
  // ring drawn by a separate element, by script, still counts.
  if (data.modal) add('info', 'modal-open', 'a modal is open, so only the modal is measured', '', data.modal);
  for (const f of focus) {
    if (f.escaped) { add('fail', 'focus-escapes-modal', `Tab left the open modal (${f.modal}) for the page behind it`, f.name, f.path); continue; }
    if (offScreen(f)) { add('fail', 'focus-offscreen', 'focused but still outside the screen', f.name, f.path); continue; }
    if (!f.before) continue;
    let changed = false;
    const rings = [];
    f.now.forEach((n, i) => {
      if (!looksDifferent(f.before[i], n)) return;
      changed = true;
      rings.push(...ringRatios(f.before[i], n, f.own[i], f.outside[i], canvas));
    });
    if (!changed && !(f.pixels >= T.focusPixels))
      add('fail', 'focus-invisible', `nothing visible changes on keyboard focus${f.pixels != null ? `, ${f.pixels} pixels differ` : ''}`, f.name, f.path);
    else if (rings.length && Math.max(...rings) < T.ring) add('fail', 'focus-ring', `ring ${fmt(Math.max(...rings), T.ring)}:1 needs 3`, f.name, f.path);
  }

  // Content still invisible after scrolling to the bottom and back and waiting.
  for (const h of data.hidden)
    add('fail', 'hidden-content', `still at ${h.why} after scrolling and 500ms${h.n > 1 ? `, ${h.n} text blocks` : ''}`, h.text, h.path);

  // Colour share, from the pixels.
  const share = colourShare(shot);
  const fams = share.top.map(([f, s]) => `${f} ${pct(s)}`).join(', ') || 'no colour';
  add('info', 'colour-share', `${pct(share.neutral)} neutral; ${fams}; ${share.saturated.length} saturated hue${share.saturated.length === 1 ? '' : 's'} over 0.5%`);
  if (share.saturated.length > T.hues)
    add('warn', 'too-many-hues', `${share.saturated.length} saturated hue families over 0.5% each: ${share.saturated.join(', ')}`);

  const rank = { fail: 0, warn: 1, info: 2 };
  out.sort((a, b) => rank[a.level] - rank[b.level]);
  return { findings: out, stats: { colour: share, text: data.text.length, pixels: pixelCount, targets: tg.length, tabbed: focus.length,
    focused: focus.map(f => f.path), pixelChecked: focus.filter(f => f.pixels != null).length } };
}

// Same page background and text colour in two renders means the page has no dark theme.
export function sameLook(a, b) {
  const page = l => blend(over(col(l.body), col(l.html)), col(l.canvas));
  return deltaE(page(a), page(b)) < 0.005 && deltaE(blend(col(a.text), page(a)), blend(col(b.text), page(b))) < 0.005;
}
