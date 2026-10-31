// Run: node keep.test.mjs
import assert from 'node:assert';
import { compare, extract } from './keep.mjs';

const original = `<!doctype html><title>Tablewise · Today</title>
<style>.x{color:red}</style><script>const fake = '<a href="/script-only">x</a>';</script>
<nav><a href="/today" aria-current="page">Today</a><a href="/bookings">Bookings</a>
<a href="/guests"><svg></svg>Guests</a><button aria-label="Settings"></button></nav>
<h1>Good evening, Maya</h1><h2>Covers by hour</h2>
<p>142 covers booked, $3,240 in deposits, next table at 18:30, 92% full.</p>
<form action="/search"><input name="q"><select name="party"></select></form>
<a href="#">dead link</a>`;

const kept = `<!doctype html><title>Today · Tablewise</title>
<nav><a href="/today">Today</a><a href="/bookings">Bookings</a><a href="/guests">Guests</a>
<button aria-label="Settings"></button></nav>
<h1>Today</h1><h2>Covers by hour</h2>
<p>142 covers, $3,240 deposits, next at 18:30, 92% full.</p>
<form action="/search"><input name="q"><select name="party"></select></form>
<a href="/waitlist">Waitlist</a>`;

const e = extract(original);
assert.deepEqual(e.navLabels, ['Today', 'Bookings', 'Guests', 'Settings']);
assert(!e.links.includes('/script-only'), 'script content is ignored');
assert(!e.links.includes('#'), 'a bare # is not a target');
assert(e.numbers.includes('$3,240') && e.numbers.includes('18:30') && e.numbers.includes('92%'));

const ok = compare(original, kept, ['Covers by hour']);
assert.equal(ok.findings.filter(f => f.level === 'fail').length, 0, JSON.stringify(ok.findings));
assert(ok.findings.some(f => f.id === 'title-changed'));
assert(ok.findings.some(f => f.id === 'link-added' && f.items.includes('/waitlist')));

const broken = kept.replace('href="/guests"', 'href="/people"').replace('>Bookings<', '>Reservations<')
  .replace('name="party"', 'name="size"').replace('$3,240', '$3.2k');
const ids = new Set(compare(original, broken, ['Covers by hour', 'Deposits held']).findings.map(f => f.id));
for (const id of ['link-missing', 'nav-label-missing', 'field-missing', 'keep-missing', 'number-missing'])
  assert(ids.has(id), `expected ${id}`);

console.log('ok: keep check finds missing links, labels, fields, Keep lines and numbers');
