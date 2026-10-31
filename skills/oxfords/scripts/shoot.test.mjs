// Run: node shoot.test.mjs
// The PNG decoder is always tested. The render check runs on fixtures/ when a browser loads
// (see shoot.mjs for how Playwright is found); without one it prints "skipped: no browser".
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { decodePng } from './lib/png.mjs';
import { openBrowser, resolveInput, shoot, tally } from './shoot.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- PNG: encode with every filter type, decode, compare ----------
function encode(w, h, ch, px) {
  const stride = w * ch, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const f = y % 5; raw[y * (stride + 1)] = f;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0, p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      raw[y * (stride + 1) + 1 + x] = px[y * stride + x] - [0, a, b, (a + b) >> 1, paeth][f];
    }
  }
  const chunk = (kind, body) => { const n = Buffer.alloc(4); n.writeUInt32BE(body.length); return Buffer.concat([n, Buffer.from(kind, 'latin1'), body, Buffer.alloc(4)]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = { 1: 0, 2: 4, 3: 2, 4: 6 }[ch];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const ch of [1, 2, 3, 4]) {
  const w = 9, h = 11, px = Buffer.from(Array.from({ length: w * h * ch }, (_, i) => (i * 97 + ch * 31) % 256));
  const img = decodePng(encode(w, h, ch, px));
  assert.equal(img.width, w); assert.equal(img.height, h);
  for (let i = 0; i < w * h; i++) {
    const want = ch >= 3 ? [px[i * ch], px[i * ch + 1], px[i * ch + 2], ch === 4 ? px[i * ch + 3] : 255]
      : [px[i * ch], px[i * ch], px[i * ch], ch === 2 ? px[i * ch + 1] : 255];
    assert.deepEqual([...img.data.subarray(i * 4, i * 4 + 4)], want, `png ${ch} channels, pixel ${i}`);
  }
}
console.log('ok: png decoder, 4 colour types x 5 filters');

// ---------- CLI usage errors need no browser ----------
const cli = (args, env = {}) => spawnSync(process.execPath, [join(here, 'shoot.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
assert.equal(cli([]).status, 2, 'no input exits 2');
assert.equal(cli(['nope.html']).status, 2, 'missing file exits 2');
assert.equal(cli([join(here, 'fixtures/good.html'), '--schemes', 'sepia']).status, 2, 'bad scheme exits 2');
assert.match(cli(['nope.html', '--schemes', 'both']).stderr, /cannot read nope\.html/, '--schemes both is accepted');
const bare = (await import('playwright').catch(() => null)) || (await import('playwright-core').catch(() => null));
if (!bare) assert.equal(cli([join(here, 'fixtures/good.html')], { OXFORDS_PLAYWRIGHT: '/nonexistent' }).status, 3, 'no browser exits 3');
console.log('ok: usage errors exit 2' + (bare ? '' : ', no browser exits 3'));

// ---------- the render check on the fixtures ----------
const browser = await openBrowser();
if (!browser) { console.log('skipped: no browser'); process.exit(0); }
const out = mkdtempSync(join(tmpdir(), 'oxfords-shots-'));
const t0 = Date.now();
try {
  const [bad, good] = await shoot(browser, ['bad.html', 'good.html'].map(f => resolveInput(join(here, 'fixtures', f))), { out });

  // bad.html: no dark theme, so two renders; every defect found at both widths except
  // sideways scroll, which only a phone width can show.
  assert.deepEqual(bad.findings.map(f => f.rule), ['no-dark-theme']);
  assert.deepEqual(bad.renders.map(r => `${r.width} ${r.scheme}`), ['390 light', '1440 light']);
  for (const r of bad.renders) {
    const has = (rule, test = () => true) => r.findings.some(f => f.rule === rule && test(f));
    const at = `at ${r.width}`;
    assert(has('text-contrast', f => f.text === 'Next invoice' && !/pixels/.test(f.msg)), `low-contrast text ${at}`);
    assert(has('text-contrast', f => /^Plain numbers/.test(f.text) && /measured on pixels/.test(f.msg)), `contrast over gradient, on pixels ${at}`);
    assert(has('clipped-text', f => /^Quarterly usage/.test(f.text)), `clipped heading ${at}`);
    assert(has('overlapping-text', f => /12,480|orders this quarter/.test(f.text + f.msg)), `overlapping text ${at}`);
    assert(has('target-size', f => /^20×20/.test(f.msg) && /tools > button/.test(f.path)), `20px icon button ${at}`);
    assert(has('target-size', f => /^20×20/.test(f.msg) && /div\.chip/.test(f.path)), `20px control clickable from script ${at}`);
    assert(has('no-name', f => /tools > button/.test(f.path)), `unnamed button ${at}`);
    assert(has('focus-invisible', f => f.text === 'Save draft'), `no focus style ${at}`);
    assert(has('focus-invisible', f => /rect\.bar/.test(f.path) && /, 0 pixels differ/.test(f.msg)), `bar with no ring, confirmed on pixels ${at}`);
    assert(has('focus-offscreen', f => f.text === 'Skip to content'), `skip link that never comes on screen ${at}`);
    assert(!r.findings.some(f => /target/.test(f.rule) && /skip/.test(f.path)), `parked skip link is not a target ${at}`);
    assert(has('hidden-content', f => /reveal/.test(f.path)), `hidden at opacity 0 ${at}`);
    assert(has('too-many-hues', f => /^6 /.test(f.msg)), `too many saturated hues ${at}`);
    assert(has('field-border', f => /email/.test(f.path)), `faint field border ${at}`);
    assert.equal(has('sideways-scroll', f => /plans/.test(f.path)), r.width === 390, `sideways scroll only at 390 (${at})`);
    // Nothing else fails: the fixture holds one of each, so extra fails are false positives.
    const fails = r.findings.filter(f => f.level === 'fail');
    const expected = { 'text-contrast': 2, 'clipped-text': 1, 'overlapping-text': 1, 'target-size': 3, 'no-name': 1,
      'focus-invisible': 2, 'focus-offscreen': 1, 'hidden-content': 1, 'sideways-scroll': r.width === 390 ? 1 : 0 };
    for (const [rule, n] of Object.entries(expected))
      assert.equal(fails.filter(f => f.rule === rule).length, n, `${n} × ${rule} ${at}`);
    assert.equal(fails.length, Object.values(expected).reduce((s, n) => s + n, 0), `no unexpected fails ${at}: ${fails.map(f => f.rule)}`);
  }

  // good.html: a real dark theme, so four renders, all measured, and no FAIL anywhere. It also
  // holds three patterns that once tripped the check: truncated cells made focusable (not
  // targets), chart bars whose ring is a sibling drawn by script (seen on pixels, below the
  // fold, so the clip must follow the scroll), and a skip link parked off-screen until focused.
  assert.equal(good.renders.length, 4, 'good.html renders light and dark at both widths');
  assert(!good.findings.some(f => f.rule === 'no-dark-theme'), 'good.html has a dark theme');
  for (const r of good.renders) {
    const at = `${r.width} ${r.scheme}`;
    assert(r.stats.text > 20 && r.stats.tabbed >= 14, `good.html was measured at ${at}`);
    for (const p of ['a.skip', 'span.trunc', 'rect.bar'])
      assert(r.stats.focused.some(f => f.endsWith(p)), `${p} was tabbed to at ${at}`);
    assert(r.stats.pixelChecked >= 4, `chart bars went to the pixel check at ${at}`);
    assert(!r.findings.some(f => /target/.test(f.rule) && /trunc|skip/.test(f.path)), `trunc cells and skip link are not targets at ${at}`);
    const fails = r.findings.filter(f => f.level === 'fail');
    assert.deepEqual(fails, [], `good.html ${at} has no FAIL`);
  }
  // An open modal: only it is measured, and Tab must stay inside it. Phone width, light only.
  const [mGood, mBad] = await shoot(browser, ['modal-good.html', 'modal-bad.html'].map(f => resolveInput(join(here, 'fixtures', f))),
    { out, widths: [390], schemes: ['light'] });
  const g = mGood.renders[0], b = mBad.renders[0];
  assert(g.findings.some(f => f.rule === 'modal-open' && f.path === 'dialog#delete'), 'native modal dialog detected');
  assert.deepEqual(g.findings.filter(f => f.level === 'fail'), [], 'modal-good.html: nothing behind the scrim is measured');
  assert.deepEqual(g.stats.focused, ['dialog#delete > div.actions > button', 'dialog#delete > div.actions > button.danger'], 'walk stays in the dialog');
  assert.deepEqual(b.findings.filter(f => f.level === 'fail').map(f => `${f.rule} ${f.text}`).sort(),
    ['focus-escapes-modal Invoices', 'text-contrast Their invoices stay searchable'], 'modal-bad.html: faint text inside, focus escapes');
  assert(!b.findings.some(f => /Behind the scrim/.test(f.text)), 'text behind the scrim is out of scope');
  assert.deepEqual(b.stats.focused.slice(0, 2), ['div.sheet > button', 'div.sheet > button'], 'walk starts inside the modal');
  console.log('ok: open modal scopes the check, focus escape caught');

  const t = tally([bad, good]);
  console.log(`ok: bad.html finds every defect (${t.fails} fails), good.html is clean (${good.renders.length} renders, ` +
    `${good.renders.reduce((s, r) => s + r.findings.filter(f => f.level === 'warn').length, 0)} warns), ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // The CLI exits 1 on a FAIL and its --json is parseable.
  const run = cli([join(here, 'fixtures/bad.html'), '--widths', '390', '--schemes', 'light', '--out', out, '--json']);
  assert.equal(run.status, 1, `bad.html exits 1 (got ${run.status}: ${run.stderr})`);
  assert(JSON.parse(run.stdout).fails > 0, 'json reports fails');
  console.log('ok: cli exits 1 on FAIL, json parses');
} finally {
  await browser.close();
  rmSync(out, { recursive: true, force: true });
}
