// Run: node check.test.mjs  (the smallest thing that fails if a rule breaks)
import assert from 'node:assert';
import { check } from './check.mjs';
const ids = s => new Set(check(s).map(f => f.id));
const find = (s, id) => check(s).find(f => f.id === id);

// Every rule fires on its fixture.
const bad = [
  ['default-font', `body{font-family: "Inter", sans-serif}`],
  ['default-font', `:root{--font: "Inter", system-ui, sans-serif}`],
  ['emoji', `<h2>🚀 Launch</h2>`],
  ['gradient-text', `h1{-webkit-background-clip:text;background-clip: text}`],
  ['purple-gradient', `.hero{background:linear-gradient(90deg,#6366f1,#a855f7)}`],
  ['purple-gradient', `.hero{background:linear-gradient(90deg, oklch(55% 0.2 285), #3b82f6)}`],
  ['purple-gradient', `:root{--brand:#7a5cff}\n.hero{background-image:radial-gradient(circle, var(--brand), transparent 70%)}`],
  ['accent-rail', `.nav a.active{border-left: 3px solid #17644a}`],
  ['accent-rail', `:root{--lead:#075431}\n.nav a.active{border-left:3px solid var(--lead)}`],
  ['bounce', `.b{transition:transform .3s cubic-bezier(0.34, 1.56, 0.64, 1)}`],
  ['greeting-header', `<h1>Good evening, Maya</h1>`],
  ['tiny-text', `.meta{font-size:10px}`],
  ['img-no-alt', `<img src="a.png">`],
  ['em-dash', `<p>Fast — and simple</p>`],
  ['buzzword', `<p>A seamless way to work</p>`],
  ['vague-button', `<button>Get started</button>`],
  ['placeholder-content', `<td>Jane Doe</td>`],
  ['glow', `.card{box-shadow:0 0 40px rgba(99,102,241,.5)}`],
  ['viewport-100vh', `.app{min-height:100vh}`],
  ['eyebrow', `.eyebrow{text-transform:uppercase;letter-spacing:.08em}`],
  ['no-focus-style', `button{outline:none}`],
  ['no-reduced-motion', `.a{transition: opacity .2s}`],
  ['bone-page', `:root{--bg:#FBF1E3}\nbody{margin:0;background:var(--bg)}`],
  ['bone-page', `:root{--page:oklch(96% 0.02 85)}\nbody{background:var(--page)}`],
  ['bone-page', `:root{--cream:#FBF1E3;--paper:var(--cream);--page:var(--paper)}\nbody{background:var(--page)}`],
  ['bone-page', `html{background:#f5f1e8 url(grain.png) repeat}`],
  ['bone-page', `body{background-color:hsl(40 60% 95%)}`],
  ['bone-page', `<html><body class="bg-[#FBF1E3] text-stone-900"><h1>Ledger</h1></body></html>`],
  ['tinted-page', `body{background:oklch(96% 0.03 250)}`],
  ['tinted-page', `:root{--page:#fff}\n@media (prefers-color-scheme: dark){:root{--page:#0f172a}}\nbody{background:var(--page)}`],
  ['warm-dark-page', `:root{--page:#fff}\n[data-theme="dark"]{--page:#2b2118}\nbody{background:var(--page)}`],
  ['raw-colour', `.a{color:#111}.b{color:#222}.c{background:#f63434}.d{border-color:rgb(0 128 0)}\n.e{fill:hsl(200 50% 40%)}.f{color:oklch(60% .1 30)}.g{background:#fafafa}`],
  ['hue-sprawl', `:root{--a:#E14543;--b:#FF8A3D;--c:#28B467;--d:#028397;--e:#224D95}`],
  ['alpha-text', `.meta{color:rgba(17,17,17,.6)}`],
  ['alpha-text', `:root{--text-2:rgb(0 0 0 / 60%)}\np{color:var(--text-2)}`],
  ['alpha-text', `.card-caption{opacity:.7}`],
  ['alpha-text', `<p class="text-white/70">Paid in full</p>`],
  ['one-blue-button', `:root{--page:#fff;--text:#111;--accent:#2563EB}\nbody{background:var(--page);color:var(--text)}\n.btn{background:var(--accent);color:#fff}\na{color:var(--accent)}`],
  ['danger-as-brand', `:root{--lead:#075431;--danger:#C92A2A}\n.btn-delete{background:var(--lead);color:var(--lead-ink)}`],
  ['danger-as-brand', `[data-action="remove"]:hover{background:var(--support-hover);color:var(--on-support)}`],
  ['one-blue-button', `:root{--page:#fff;--lead:#2360E8;--support:#1E40AF;--pop:#DBEAFE;--info:#006DBD;--danger:#CC2827;--focus:#2360E8;--series-1:#2360E8}\nbody{background:var(--page)}\n:focus-visible{outline:2px solid var(--focus)}\n.btn.primary{background:var(--lead)}\na{color:var(--lead)}`],
];
for (const [id, src] of bad) assert(ids(src).has(id), `expected ${id} on: ${src}`);

// Levels and the detail each finding carries.
assert.equal(find(bad.find(b => b[0] === 'bone-page')[1], 'bone-page').level, 'fail');
assert.equal(find(`:root{--page:#fff}\n[data-theme="dark"]{--page:#2b2118}\nbody{background:var(--page)}`, 'warm-dark-page').level, 'info');
assert.match(find(`:root{--a:#E14543;--b:#FF8A3D;--c:#28B467;--d:#028397;--e:#224D95}`, 'hue-sprawl').text, /5 families: red, orange, green, teal, blue/);
assert.match(find(bad.find(b => b[0] === 'raw-colour')[1], 'raw-colour').text, /^7 distinct: #111, #222, #f63434/);

// Each clean case stays clean of the rule it names: thresholds, and the false positives fixed.
const quiet = [
  ['raw-colour', `.a{color:#111}.b{color:#222}.c{background:#f63434}.d{border-color:rgb(0 128 0)}.e{fill:hsl(200 50% 40%)}.f{color:#fafafa}`],
  ['raw-colour', `.a{color:#111;box-shadow:0 1px 2px rgba(0,0,0,.1),0 8px 24px rgba(17,17,17,.14);background:transparent;border-color:currentColor}\n.b{color:var(--x, #333)}.c{color:inherit}.d{color:#222}.e{color:#333}.f{color:#444}.g{color:#555}`],
  ['raw-colour', `<style>.a{color:#111}</style><svg viewBox="0 0 4 4"><rect fill="#E14543"/><rect fill="#FF8A3D"/><rect fill="#28B467"/><rect fill="#028397"/><rect fill="#224D95"/><rect fill="#7C3AED"/><rect style="fill:#D93D7F"/></svg>`],
  ['hue-sprawl', `:root{--lead:#28B467;--support:#FF8A3D;--pop:#F7EB49;--chart-4:#224D95;--danger:#E14543;--info:#7C3AED;--success:#28B467;--warning:#C2410C;--accent-soft:#fdeee4;--support-soft:oklch(95% 0.04 330);--wash:rgb(124 58 237 / 6%)}`],
  ['bone-page', `body{background:#F4F4F5}`],
  ['bone-page', `body{background:#f6f4ef}`],
  ['bone-page', `body{background:#eff6ff}`],
  ['tinted-page', `body{background:#eff6ff}`],
  ['tinted-page', `:root{--page:#fff}\n@media (prefers-color-scheme: dark){:root{--page:#0a0a0a}}\nbody{background:var(--page)}`],
  ['alpha-text', `.hint{opacity:0;transition:opacity .2s}.hint.on{opacity:1}`],
  ['alpha-text', `label:has(input:disabled),label.disabled{opacity:.5}\n.label:hover{opacity:.8}\n.card.done{opacity:.6}\n.chart{background:rgba(0,0,0,.4)}\nli::marker{color:rgb(0 0 0 / 50%)}`],
  ['alpha-text', `<style>.submit{opacity:.8}.texture{opacity:.4}</style><p class="text-sm/6 text-gray-900">Paid</p>`],
  ['one-blue-button', `:root{--accent:#2563EB}\nbody{background:#fff}\n.btn{background:var(--accent)}\n.chart .bar{fill:var(--accent)}`],
  ['one-blue-button', `body{background:#fff}\nbutton:focus-visible{outline:2px solid #246}`],
  ['danger-as-brand', `:root{--lead:#075431;--danger:#C92A2A}\n.btn-delete{background:var(--danger);color:var(--danger-ink)}\n.delete-dialog p{color:var(--lead)}`],
  ['purple-gradient', `.top{background:linear-gradient(#000,rgba(0,0,0,0))}\n.a{background:linear-gradient(#fff,#eee)}.b{color:purple}`],
  // accent-rail: a 1px rule and a neutral 2px line are dividers, not rails.
  ['accent-rail', `.fig+.fig{padding-left:20px;border-left:1px solid var(--line)}`],
  ['accent-rail', `:root{--line:#E5E5E5}\n.tl{border-left:2px solid var(--line)}`],
  // layout-transition: colour transitions, and a layout word in the next rule on the same line.
  ['layout-transition', `.btn{transition:background-color .12s ease-out,transform .1s ease-out}`],
  ['layout-transition', `.a{transition:border-top-color .2s}`],
  ['layout-transition', `.a{transition:opacity .2s}.b{width:10px;left:0}`],
  // glow: a neutral ambient shadow, and a later rule's margin on the same line.
  ['glow', `.card{box-shadow:0 0 0 1px var(--line),0 0 24px rgba(0,0,0,.08)}`],
  ['glow', `.a{box-shadow:none}.b{margin:0 0 24px}`],
  // tiny-text: font-size:0 is the inline-block whitespace fix, not text.
  ['tiny-text', `.row{font-size:0px}`],
  ['tiny-text', `:root{--text-underline-offset:3px}`],
  // viewport-100vh: a 100vh fallback before 100dvh is deliberate.
  ['viewport-100vh', `.app{min-height:100vh;min-height:100dvh}`],
  // default-font: Roboto inside the system stack is a fallback, not a choice.
  ['default-font', `body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}`],
  ['default-font', `body{font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}`],
  // em-dash and buzzwords in comments or code are not visible copy.
  ['em-dash', `<style>/* Poppy on white — chrome stays neutral */</style><!-- draft — v2 --><p>Orders</p>`],
  ['buzzword', `<script>\nconst unlock = () => audio.resume();\n</script><p>Orders</p>`],
];
for (const [id, src] of quiet) assert(!ids(src).has(id), `did not expect ${id} on: ${src}`);

// The old clean page: neutral, nothing flashy.
const clean = `<!doctype html><style>
body{font-family:system-ui,sans-serif;font-size:14px;background:#FAFAFA}
.nav a[aria-current]{background:#eee}
.b{transition:opacity .15s cubic-bezier(0.16, 1, 0.3, 1)}
button:focus-visible{outline:2px solid #246}
@media (prefers-reduced-motion: reduce){.b{transition:none}}
</style><h1>Orders</h1><img src="a.png" alt="Kitchen pass"><button>Add order</button>`;
assert.deepEqual([...ids(clean)], [], `clean fixture flagged: ${[...ids(clean)]}`);

// A page written the new way: tokens in :root and a dark block, neutral controls, the palette
// on a chart panel, --danger on the delete button, text hierarchy in solid greys.
const tokens = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Orders</title><style>
:root{
  --page:#FFFFFF; --surface:#F5F5F5; --line:#E5E5E5; --text:#111111; --text-2:#555555; --text-3:#767676;
  --lead:oklch(45% 0.11 160); --lead-ink:#FFFFFF; --lead-ink-2:#D3E8DE; --support:#D9480F; --pop:#FFD43B;
  --danger:#C92A2A; --danger-hover:#A61E1E; --danger-ink:#FFFFFF; --warning:#B35C00; --success:#2B8A3E; --info:#1971C2;
  --scrim:rgb(0 0 0 / 45%); --shadow:0 1px 2px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --page:#000000; --surface:#161616; --line:#2A2A2A; --text:#F5F5F5; --text-2:#B3B3B3; --text-3:#8C8C8C;
  --lead:oklch(72% 0.12 160); --lead-ink:#000000; --lead-ink-2:#1F3A2D; --danger:#FF6B6B; --danger-ink:#000000;
}}
[data-theme="dark"]{--page:#0A0A0A; --surface:#161616; --text:#F5F5F5}
*{box-sizing:border-box}
html{color-scheme:light dark}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--page);color:var(--text);min-height:100dvh}
.meta{color:var(--text-2)} .hint{color:var(--text-3);font-size:13px}
.btn{min-height:36px;padding:0 16px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text);transition:background-color .12s ease-out}
.btn:hover{background:var(--line)}
.btn:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.btn-delete{background:var(--danger);color:var(--danger-ink);border-color:var(--danger)}
.btn-delete:hover{background:var(--danger-hover)}
.chart{background:var(--lead);color:var(--lead-ink);border-radius:10px;padding:20px;box-shadow:var(--shadow)}
.chart .legend{color:var(--lead-ink-2)}
.chart .bar{fill:var(--pop)} .chart .late{fill:var(--support)}
.figs{display:grid;grid-template-columns:repeat(4,1fr)} .fig+.fig{border-left:1px solid var(--line)}
dialog::backdrop{background:var(--scrim)}
@media (prefers-reduced-motion: reduce){.btn{transition:none}}
</style></head><body>
<h1>Orders</h1><p class="meta">Updated 4 minutes ago</p>
<section class="chart"><h2>Takings this week</h2><p class="legend">This week against last</p>
<svg viewBox="0 0 100 40" role="img" aria-label="Takings by day"><rect class="bar" x="0" y="10" width="8" height="30" fill="#FFD43B"/></svg></section>
<button class="btn">Add order</button> <button class="btn btn-delete">Delete order 1043</button>
</body></html>`;
assert.deepEqual(check(tokens).map(f => `${f.id}:${f.line}`), [], 'token-model page flagged');

console.log(`ok: ${bad.length} fixtures fire, ${quiet.length} clean cases stay clean, both clean pages pass`);
