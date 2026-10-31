// Oxfords colour maths. Zero dependencies. One source of truth for every script:
// parsing CSS colours, sRGB <-> OKLab/OKLCH, gamut mapping, WCAG contrast, hue families.
// Colours are plain objects: rgb = { r, g, b, a } with channels 0..1; oklch = { l, c, h, a }.

const clamp01 = x => Math.min(1, Math.max(0, x));
const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// ---------- parsing ----------

const NAMED = { white: '#ffffff', black: '#000000', transparent: '#00000000' };

function num(s, scale = 1) {
  s = s.trim();
  if (s === 'none') return 0;
  if (s.endsWith('%')) return (parseFloat(s) / 100) * scale;
  return parseFloat(s);
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4) };
}

// parse('#ff8a3d'), parse('rgb(255 138 61 / .5)'), parse('hsl(24 100% 62%)'), parse('oklch(72% 0.17 50)')
export function parse(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const v = i => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) : 1 };
  }
  m = /^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/.exec(s);
  if (!m) return null;
  const [body, alphaPart] = m[2].includes('/') ? m[2].split('/') : [m[2], null];
  const parts = body.split(/[\s,]+/).filter(Boolean);
  let alpha = alphaPart != null ? num(alphaPart) : parts.length === 4 ? num(parts.pop()) : 1;
  if (parts.length !== 3) return null;
  let rgb;
  if (m[1].startsWith('rgb')) {
    rgb = Object.fromEntries(['r', 'g', 'b'].map((k, i) =>
      [k, parts[i].endsWith('%') ? num(parts[i]) : num(parts[i]) / 255]));
  } else if (m[1].startsWith('hsl')) {
    rgb = hslToRgb(parseFloat(parts[0]), num(parts[1].endsWith('%') ? parts[1] : parts[1] + '%'),
      num(parts[2].endsWith('%') ? parts[2] : parts[2] + '%'));
  } else {
    const l = parts[0].endsWith('%') ? num(parts[0]) : parseFloat(parts[0]);
    const c = parts[1].endsWith('%') ? num(parts[1], 0.4) : parseFloat(parts[1]);
    rgb = fromOklch({ l, c, h: parseFloat(parts[2]) || 0 });
  }
  if ([rgb.r, rgb.g, rgb.b, alpha].some(Number.isNaN)) return null;
  return { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b), a: clamp01(alpha) };
}

// ---------- conversions ----------

export function toOklab({ r, g, b }) {
  const [R, G, B] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    A: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    B: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

// Returns unclamped channels so callers can test the gamut.
export function fromOklab({ L, A, B }) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  const [r, g, b] = lin.map(v => (v < 0 ? -toGamma(-v) : toGamma(v)));
  return { r, g, b, a: 1 };
}

export function toOklch(rgb) {
  const { L, A, B } = toOklab(rgb);
  const c = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h, a: rgb.a ?? 1 };
}

export function fromOklch({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  return fromOklab({ L: l, A: c * Math.cos(rad), B: c * Math.sin(rad) });
}

export const inGamut = ({ r, g, b }, eps = 1e-4) =>
  [r, g, b].every(v => v >= -eps && v <= 1 + eps);

// Keep lightness and hue, lower chroma until the colour fits in sRGB.
export function toGamut(lch) {
  const l = clamp01(lch.l);
  if (inGamut(fromOklch({ ...lch, l }))) return { ...lch, l };
  let lo = 0, hi = lch.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(fromOklch({ l, c: mid, h: lch.h }))) lo = mid; else hi = mid;
  }
  return { l, c: lo, h: lch.h, a: lch.a ?? 1 };
}

// OKLCH -> in-gamut rgb with clamped channels.
export function rgbFromOklch(lch) {
  const { r, g, b } = fromOklch(toGamut(lch));
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: lch.a ?? 1 };
}

// ---------- formatting ----------

export function toHex({ r, g, b, a = 1 }) {
  const h = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a) : ''}`.toUpperCase();
}

export function oklchCss(lch) {
  const { l, c, h, a = 1 } = lch;
  const L = +(l * 100).toFixed(1), C = +c.toFixed(3), H = +(c < 1e-4 ? 0 : h).toFixed(1);
  return `oklch(${L}% ${C} ${H}${a < 1 ? ` / ${+a.toFixed(3)}` : ''})`;
}

// ---------- contrast ----------

export function luminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map(toLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Paint fg (with its alpha) over an opaque bg.
export function blend(fg, bg) {
  const a = fg.a ?? 1;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

// Porter-Duff "over": paint `top` onto `bottom` when both may be translucent.
export function over(top, bottom) {
  const ta = top.a ?? 1, ba = bottom.a ?? 1;
  const a = ta + ba * (1 - ta);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = k => (top[k] * ta + bottom[k] * ba * (1 - ta)) / a;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a };
}

// WCAG 2 contrast ratio. Accepts rgb objects or CSS strings. A translucent fg is blended onto bg.
export function contrast(fg, bg) {
  const B = typeof bg === 'string' ? parse(bg) : bg;
  let F = typeof fg === 'string' ? parse(fg) : fg;
  if (!F || !B) return NaN;
  if ((F.a ?? 1) < 1) F = blend(F, B);
  const [x, y] = [luminance(F), luminance(B)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ---------- hue families ----------

// Chroma below this reads as a neutral grey; at or above SATURATED it counts as a real hue.
export const NEUTRAL_C = 0.025;
export const SATURATED_C = 0.06;

// OKLCH hue ranges, in degrees. Pink wraps through 0. Indigo is its own family because
// Tailwind's default indigo (#6366F1, h 277) is the most common generated accent.
const FAMILIES = [
  ['pink', 330, 10], ['red', 10, 36], ['orange', 36, 75], ['yellow', 75, 120],
  ['green', 120, 175], ['teal', 175, 225], ['blue', 225, 270], ['indigo', 270, 290], ['purple', 290, 330],
];

export function hueFamily(color) {
  const rgb = typeof color === 'string' ? parse(color) : color;
  if (!rgb) return null;
  const { c, h } = toOklch(rgb);
  if (c < NEUTRAL_C) return 'neutral';
  for (const [name, from, to] of FAMILIES)
    if (from < to ? h >= from && h < to : h >= from || h < to) return name;
  return 'pink';
}

export const isNeutral = color => hueFamily(color) === 'neutral';

// Shortest distance between two hues, 0..180.
export const hueDistance = (h1, h2) => { const d = Math.abs(h1 - h2) % 360; return d > 180 ? 360 - d : d; };

// Perceptual difference in OKLab (deltaE OK). About 0.02 is just noticeable; 0.1 is clearly different.
export function deltaE(x, y) {
  const a = toOklab(typeof x === 'string' ? parse(x) : x), b = toOklab(typeof y === 'string' ? parse(y) : y);
  return Math.hypot(a.L - b.L, a.A - b.A, a.B - b.B);
}
