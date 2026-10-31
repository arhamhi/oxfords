// Run: node scripts/lib/colour.test.mjs
import assert from 'node:assert';
import { blend, over, parse, toOklch, rgbFromOklch, toHex, contrast, hueFamily, inGamut, fromOklch, toGamut, oklchCss, deltaE } from './colour.mjs';

const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// Parsing: every syntax lands on the same orange.
const forms = ['#ff8a3d', '#FF8A3D', 'rgb(255, 138, 61)', 'rgb(255 138 61)', 'rgba(255,138,61,1)', 'hsl(23.8 100% 62%)', 'hsla(23.8, 100%, 62%, 1)'];
for (const f of forms) assert.equal(toHex(parse(f)), '#FF8A3D', f);
assert.equal(parse('#fff').r, 1);
assert.equal(parse('#0000').a, 0);
near(parse('rgb(0 0 0 / 50%)').a, 0.5, 1e-9, 'slash alpha');
assert.equal(parse('white').g, 1);
assert.equal(parse('nonsense'), null);
assert.equal(parse('rgb(1,2)'), null);

// OKLCH reference values (Ottosson): sRGB red = oklch(0.628 0.2577 29.23).
const red = toOklch(parse('#ff0000'));
near(red.l, 0.6280, 0.001, 'red L'); near(red.c, 0.2577, 0.001, 'red C'); near(red.h, 29.23, 0.1, 'red H');
near(toOklch(parse('#ffffff')).l, 1, 1e-4, 'white L');
near(toOklch(parse('#000000')).l, 0, 1e-4, 'black L');
assert.equal(toOklch(parse('#808080')).c < 1e-4, true, 'grey has no chroma');

// Round trip through OKLCH for a spread of colours.
for (const hex of ['#FF8A3D', '#326E6E', '#001B8C', '#FEEEC3', '#111111', '#7EA288']) {
  assert.equal(toHex(rgbFromOklch(toOklch(parse(hex)))), hex, `round trip ${hex}`);
  assert.equal(toHex(parse(oklchCss(toOklch(parse(hex))))), hex, `css round trip ${hex}`);
}

// Gamut mapping keeps L and H and lowers C.
const wild = { l: 0.7, c: 0.4, h: 145 };
assert.equal(inGamut(fromOklch(wild)), false);
const mapped = toGamut(wild);
assert.equal(inGamut(fromOklch(mapped)), true);
near(mapped.l, 0.7, 1e-9, 'gamut keeps L'); assert(mapped.c < 0.4 && mapped.c > 0.1, 'gamut lowers C');

// WCAG contrast reference values.
near(contrast('#000', '#fff'), 21, 1e-9, 'black on white');
near(contrast('#777777', '#ffffff'), 4.48, 0.01, '#777 on white');
near(contrast('#767676', '#ffffff'), 4.54, 0.01, '#767676 on white');
near(contrast('rgba(0,0,0,0.5)', '#ffffff'), contrast('#808080', '#ffffff'), 0.05, 'alpha is blended');

// Hue families.
const fam = { '#E14543': 'red', '#FF8A3D': 'orange', '#F7EB49': 'yellow', '#28B467': 'green',
  '#028397': 'teal', '#224D95': 'blue', '#7778DE': 'indigo', '#6366F1': 'indigo', '#7C3AED': 'purple', '#C2410C': 'orange', '#8B2E47': 'pink', '#D93D7F': 'pink',
  '#6B6B6B': 'neutral', '#FAFAFA': 'neutral', '#9333EA': 'purple' };
for (const [hex, f] of Object.entries(fam)) assert.equal(hueFamily(hex), f, `${hex} family`);

// over(): translucent on translucent, then onto white, equals blending the stack directly.
const half = { r: 0, g: 0, b: 0, a: 0.5 }, quarterRed = { r: 1, g: 0, b: 0, a: 0.25 };
const stacked = blend(over(half, quarterRed), parse('#fff'));
const direct = blend(half, blend(quarterRed, parse('#fff')));
for (const k of ['r', 'g', 'b']) near(stacked[k], direct[k], 1e-9, `over ${k}`);
assert.equal(over({ r: 0, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 0, a: 0 }).a, 0, 'clear over clear');

near(deltaE('#ffffff', '#ffffff'), 0, 1e-9, 'deltaE same');
assert(deltaE('#ff0000', '#00ff00') > 0.3, 'deltaE far');

console.log('ok: colour maths');
