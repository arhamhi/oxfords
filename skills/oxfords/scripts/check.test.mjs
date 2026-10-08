// Run: node check.test.mjs  (the smallest thing that fails if a rule breaks)
import assert from 'node:assert';
import { check } from './check.mjs';
const ids = s => new Set(check(s).map(f => f.id));
const bad = {
  'default-font': `body{font-family: "Inter", sans-serif}`,
  'emoji': `<h2>🚀 Launch</h2>`,
  'gradient-text': `h1{-webkit-background-clip:text;background-clip: text}`,
  'purple-gradient': `.hero{background:linear-gradient(90deg,#6366f1,#a855f7)}`,
  'accent-rail': `.nav a.active{border-left: 3px solid #17644a}`,
  'bounce': `.b{transition:transform .3s cubic-bezier(0.34, 1.56, 0.64, 1)}`,
  'greeting-header': `<h1>Good evening, Maya</h1>`,
  'tiny-text': `.meta{font-size:10px}`,
  'img-no-alt': `<img src="a.png">`,
  'em-dash': `<p>Fast — and simple</p>`,
  'buzzword': `<p>A seamless way to work</p>`,
  'vague-button': `<button>Get started</button>`,
  'placeholder-content': `<td>Jane Doe</td>`,
  'viewport-100vh': `.app{min-height:100vh}`,
  'eyebrow': `.eyebrow{text-transform:uppercase;letter-spacing:.08em}`,
  'no-focus-style': `button{outline:none}`,
  'no-reduced-motion': `.a{transition: opacity .2s}`,
  'bone-page': `:root{--bg:#FBF1E3}\nbody{margin:0;background:var(--bg)}`,
};
for (const [id, src] of Object.entries(bad)) assert(ids(src).has(id), `expected ${id} on: ${src}`);
const clean = `<!doctype html><style>
body{font-family:system-ui,sans-serif;font-size:14px;background:#FAFAFA}
.nav a[aria-current]{background:#eee}
.b{transition:opacity .15s cubic-bezier(0.16, 1, 0.3, 1)}
button:focus-visible{outline:2px solid #246}
@media (prefers-reduced-motion: reduce){.b{transition:none}}
</style><h1>Orders</h1><img src="a.png" alt="Kitchen pass"><button>Add order</button>`;
assert.deepEqual([...ids(clean)], [], `clean fixture flagged: ${[...ids(clean)]}`);
console.log(`ok: ${Object.keys(bad).length} rules fire, clean fixture passes`);
