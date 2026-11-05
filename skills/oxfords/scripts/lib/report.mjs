// Oxfords audit report: one self-contained HTML file. Screenshots are embedded, colours come
// from palette.mjs, and the page holds itself to the same rules it reports on.

import { readFileSync } from 'node:fs';
import { run as palette } from '../palette.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const LEVEL = { fail: 'Must fix', warn: 'Worth fixing' };

function tokens() {
  // Tideline: teal lead for the bars, everything else neutral or semantic.
  return palette(['Tideline', '--mode', 'both']).out.replace(/\/\*[\s\S]*?\*\//, '');
}

function img(shot) {
  if (!shot) return '';
  const b64 = readFileSync(shot.file).toString('base64');
  return `data:image/jpeg;base64,${b64}`;
}

// Markers for every instance of every tell that has a box on this render. Only the first box of
// each tell carries its number, inside its top-left corner; numbers that would land on each other
// step to the right.
const SHOWN = { desktop: 720, phone: 390 }; // about how wide each screenshot is drawn
function markers(tells, shot, key) {
  const out = [], pins = [], step = 26 * shot.w / SHOWN[key];
  const pct = (v, of) => `${(100 * v / of).toFixed(3)}%`;
  tells.forEach((t, i) => {
    let first = true;
    for (const f of t.items) {
      const b = f.boxes?.[key];
      if (!b || b[2] < 1 || b[3] < 1) continue;
      let pin = '';
      if (first) {
        let x = b[0];
        while (pins.some(([px, py]) => Math.abs(px - x) < step && Math.abs(py - b[1]) < step * 0.9)) x += step;
        pins.push([x, b[1]]);
        pin = `<span class="pin" style="left:${pct(x - b[0], Math.max(b[2], 1))}">${i + 1}</span>`;
      }
      out.push(`<span class="mark ${t.level}" data-tell="${i + 1}" style="left:${pct(b[0], shot.w)};top:${pct(b[1], shot.h)};width:${pct(b[2], shot.w)};height:${pct(b[3], shot.h)}">${pin}</span>`);
      first = false;
    }
  });
  return out.join('');
}

function shotPanel(tells, shots) {
  const views = [['desktop', 'Desktop', shots.desktop], ['phone', 'Phone', shots.phone]].filter(v => v[2]);
  if (!views.length) return '<p class="muted">No screenshot was taken.</p>';
  const tabs = views.length > 1 ? `<div class="seg" role="tablist" aria-label="Screenshot width">${views.map(([k, l], i) =>
    `<button type="button" role="tab" id="tab-${k}" aria-controls="view-${k}" aria-selected="${i === 0}" data-view="${k}">${l} <span class="dim">${views[i][2].width}px</span></button>`).join('')}</div>` : '';
  return `${tabs}${views.map(([k, l, s]) => `
    <figure class="view" id="view-${k}" role="tabpanel" aria-labelledby="tab-${k}" data-view="${k}">
      <div class="frame${k === 'phone' ? ' narrow' : ''}">
        <img src="${img(s)}" width="${s.w}" height="${s.h}" alt="${l} screenshot of the audited page at ${s.width}px">
        ${markers(tells, s, k)}
      </div>
    </figure>`).join('')}`;
}

function tellItem(t, i) {
  const n = t.items.length;
  const quotes = [...new Set(t.items.map(f => f.text).filter(Boolean))].slice(0, 3);
  const pinned = t.items.some(f => f.boxes && Object.values(f.boxes).some(Boolean));
  return `<li class="tell" id="tell-${i + 1}" data-tell="${i + 1}">
    <div class="tell-head">
      <span class="num ${t.level}" aria-hidden="true">${i + 1}</span>
      <div>
        <h3>${esc(t.title)}</h3>
        <p class="meta"><span class="lvl ${t.level}">${LEVEL[t.level]}</span> · ${esc(t.catLabel)} · ${n > 1 ? `${n} places` : '1 place'} · costs ${t.cost}${t.judged ? ' · from the look pass' : ''}</p>
      </div>
    </div>
    <p><span class="k">Fix</span><span>${esc(t.fix)}</span></p>
    <p class="why"><span class="k">Why</span><span>${esc(t.why)}</span></p>
    ${quotes.length ? `<ul class="quotes">${quotes.map(q => `<li>${esc(q.length > 90 ? q.slice(0, 89) + '…' : q)}</li>`).join('')}</ul>` : ''}
    ${pinned ? `<button type="button" class="show" data-show="${i + 1}">Show on screenshot</button>` : ''}
  </li>`;
}

export function renderReport(r) {
  const s = r.score, host = (() => { try { return new URL(r.url).hostname || r.input; } catch { return r.input; } })();
  const catLabel = Object.fromEntries(s.cats.map(c => [c.id, c.label]));
  const tells = s.tells.map(t => ({ ...t, catLabel: catLabel[t.cat] ?? t.cat }));
  const fails = tells.filter(t => t.level === 'fail').length;
  const clean = s.cats.filter(c => !c.tells).map(c => c.label);
  const status = s.total >= 90 ? 'good' : s.total >= 55 ? 'mid' : 'bad';
  const summary = tells.length
    ? `${plural(tells.length, 'tell')} across ${plural(s.cats.filter(c => c.tells).length, 'area')}${fails ? `, ${fails} to fix first` : ''}. The list is ranked by what each one costs.`
    : 'No tells found. Read the look-pass notes before calling it done.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(host)} audit</title>
<style>
${tokens()}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--lead-ink)}
.wrap{max-width:1360px;margin:0 auto;padding:32px 24px 64px}
header.top{display:flex;justify-content:space-between;gap:16px;align-items:baseline;flex-wrap:wrap;color:var(--text-2);font-size:13px}
header.top strong{color:var(--text);font-weight:600}
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:48px;align-items:end;padding:40px 0 32px;border-bottom:1px solid var(--line)}
.score{display:flex;align-items:baseline;gap:8px;font-variant-numeric:tabular-nums}
.score b{font-size:96px;line-height:1;font-weight:700;letter-spacing:-0.03em}
.score span{font-size:20px;color:var(--text-3)}
.band{margin:12px 0 4px;font-size:22px;font-weight:600;display:flex;align-items:center;gap:8px}
.band::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--text-3)}
.band.good::before{background:var(--success)} .band.mid::before{background:var(--warning)} .band.bad::before{background:var(--danger)}
.summary{margin:0;color:var(--text-2);max-width:52ch}
.bars{display:grid;gap:12px;margin:0;padding:0;list-style:none}
.bars li{display:grid;grid-template-columns:72px 1fr 52px;gap:12px;align-items:center;font-size:14px}
.bars .track{height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden}
.bars .fill{display:block;height:100%;background:var(--lead);border-radius:4px}
.bars .val{text-align:right;font-variant-numeric:tabular-nums;color:var(--text-2)}
.body{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:40px;padding-top:32px;align-items:start}
.shots{position:sticky;top:16px}
.seg{display:inline-flex;background:var(--control);border-radius:8px;padding:3px;margin-bottom:12px}
.seg button{font:inherit;font-size:13px;border:0;background:transparent;color:var(--text-2);padding:6px 14px;border-radius:6px;min-height:32px;cursor:pointer;transition:background-color .12s ease-out}
.seg button[aria-selected="true"]{background:var(--page);color:var(--text);box-shadow:var(--shadow-1)}
.seg .dim{color:var(--text-2);font-weight:400}
.view{margin:0}
.js .view[hidden]{display:none}
.frame{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}
.scroller{max-height:calc(100dvh - 96px);overflow:auto;border-radius:8px}
.frame.narrow{max-width:390px;margin:0 auto}
.frame img{display:block;width:100%;height:auto}
.mark{position:absolute;border:1.5px solid var(--warning);border-radius:3px;pointer-events:none;transition:opacity .15s ease-out}
.mark.fail{border-color:var(--danger)}
.mark .pin{position:absolute;left:0;top:0;min-width:20px;height:20px;padding:0 5px;border-radius:0 0 4px 0;font:600 12px/20px system-ui,sans-serif;text-align:center;background:var(--warning);color:var(--on-warning)}
.mark.fail .pin{background:var(--danger);color:var(--on-danger)}
.focus .mark{opacity:.15}
.focus .mark.on{opacity:1}
h2{font-size:17px;margin:0 0 4px}
.sub{margin:0 0 16px;color:var(--text-2);font-size:14px}
ol.tells{list-style:none;margin:0;padding:0;display:grid;gap:0}
.tell{padding:20px 0;border-top:1px solid var(--line)}
.tell:first-child{border-top:0;padding-top:4px}
.tell.on{background:var(--surface);margin:0 -12px;padding-left:12px;padding-right:12px;border-radius:8px}
.tell-head{display:grid;grid-template-columns:28px 1fr;gap:12px;align-items:start}
.num{width:28px;height:28px;border-radius:6px;display:grid;place-items:center;font-weight:600;font-size:13px;background:var(--warning);color:var(--on-warning);font-variant-numeric:tabular-nums}
.num.fail{background:var(--danger);color:var(--on-danger)}
.tell h3{font-size:16px;margin:2px 0 2px;font-weight:600}
.meta{margin:0;font-size:13px;color:var(--text-3)}
.lvl.fail{color:var(--danger-ink);font-weight:600}
.lvl.warn{color:var(--warning-ink);font-weight:600}
.tell>p{margin:10px 0 0 40px;display:grid;grid-template-columns:36px 1fr;gap:0}
.tell .why{color:var(--text-2)}
.k{font-size:13px;line-height:1.75;font-weight:600;color:var(--text-3)}
.quotes{margin:10px 0 0 40px;padding:0;list-style:none;display:grid;gap:4px;font-size:13px;color:var(--text-2)}
.quotes li{padding-left:12px;border-left:1px solid var(--line)}
.show{margin:12px 0 0 40px;font:inherit;font-size:13px;border:1px solid var(--line);background:var(--page);color:var(--text);border-radius:6px;padding:0 12px;min-height:32px;cursor:pointer;transition:background-color .12s ease-out}
.show:hover{background:var(--control-hover)}
button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.foot{margin-top:48px;padding-top:20px;border-top:1px solid var(--line);color:var(--text-2);font-size:13px;display:grid;gap:6px}
.foot p{margin:0;max-width:90ch}
.muted{color:var(--text-3)}
@media (max-width:900px){
  .wrap{padding:24px 16px 48px}
  .hero{grid-template-columns:1fr;gap:28px;padding:28px 0 24px}
  .score b{font-size:72px}
  .body{grid-template-columns:1fr;gap:32px}
  .shots{position:static}
  .scroller{max-height:70dvh}
  .seg button,.show{min-height:44px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <span><strong>Oxfords audit</strong> of <a href="${esc(r.url)}">${esc(host)}</a></span>
    <span>${esc(r.date)}</span>
  </header>

  <section class="hero" aria-labelledby="score-h">
    <div>
      <h1 id="score-h" class="score" aria-label="Score ${s.total} out of 100"><b>${s.total}</b><span>/100</span></h1>
      <p class="band ${status}">${esc(s.band)}</p>
      <p class="summary">${esc(summary)}</p>
    </div>
    <ul class="bars" aria-label="Score by area">
      ${s.cats.map(c => `<li><span>${esc(c.label)}</span><span class="track" role="img" aria-label="${c.score} of ${c.max}"><span class="fill" style="width:${(100 * c.score / c.max).toFixed(1)}%"></span></span><span class="val">${c.score}/${c.max}</span></li>`).join('')}
    </ul>
  </section>

  <div class="body">
    <section class="shots" aria-label="Screenshots with every tell marked">
      <div class="scroller" id="scroller" tabindex="0" aria-label="Screenshot, scrollable">${shotPanel(tells, r.shots)}</div>
    </section>
    <section aria-labelledby="fix-h">
      <h2 id="fix-h">What to fix</h2>
      <p class="sub">${tells.length ? 'Most costly first. Numbers match the boxes on the screenshot' : 'Nothing measured needs fixing'}</p>
      <ol class="tells">${tells.map(tellItem).join('')}</ol>
    </section>
  </div>

  <footer class="foot">
    ${clean.length ? `<p><strong>Clean:</strong> ${esc(clean.join(', '))}</p>` : ''}
    ${r.kept?.length ? `<p><strong>Kept on purpose:</strong> ${r.kept.map(k => `${esc(k.title)} (${esc(k.reason)})`).join('; ')}</p>` : ''}
    <p><strong>Measured:</strong> ${esc(r.measured)}</p>
    <p><strong>Not checked:</strong> ${esc(r.notChecked)}</p>
    <p class="muted">Each area starts at 20. A tell to fix first costs 7, one worth fixing costs 4, and each extra place it shows up costs 1 more, up to 3.</p>
  </footer>
</div>
<script>
(() => {
  document.documentElement.classList.add('js');
  const tabs = [...document.querySelectorAll('.seg [role=tab]')];
  const views = [...document.querySelectorAll('.view')];
  const scroller = document.getElementById('scroller');
  function pick(k) {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === k)));
    views.forEach(v => { v.hidden = v.dataset.view !== k; });
  }
  if (tabs.length) { pick(tabs[0].dataset.view); tabs.forEach(t => t.addEventListener('click', () => pick(t.dataset.view))); }
  function show(n) {
    const view = views.find(v => !v.hidden) || views[0];
    let marks = [...view.querySelectorAll('.mark[data-tell="' + n + '"]')];
    if (!marks.length) {
      const other = views.find(v => v !== view && v.querySelector('.mark[data-tell="' + n + '"]'));
      if (other) { pick(other.dataset.view); marks = [...other.querySelectorAll('.mark[data-tell="' + n + '"]')]; }
    }
    document.querySelectorAll('.mark.on,.tell.on').forEach(e => e.classList.remove('on'));
    document.getElementById('tell-' + n)?.classList.add('on');
    scroller.classList.add('focus');
    marks.forEach(m => m.classList.add('on'));
    if (marks[0]) {
      if (scroller.scrollHeight > scroller.clientHeight + 1) {
        const top = scroller.scrollTop + marks[0].getBoundingClientRect().top - scroller.getBoundingClientRect().top - 48;
        scroller.scrollTo({ top: Math.max(0, top) });
      } else marks[0].scrollIntoView({ block: 'center' });
    }
  }
  document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => show(b.dataset.show)));
})();
</script>
</body>
</html>
`;
}
