// Oxfords render check, the half that runs inside the page. Zero dependencies.
// Playwright serialises install() with toString(), so nothing in here may reach module scope.
// It collects raw facts only: colours as sRGB bytes, boxes in page pixels, names as strings.
// Every threshold and every verdict lives in judge.mjs, on the Node side.
//
//   await page.evaluate(install); await page.evaluate(() => window.__oxf.collect());

export function install() {
  if (window.__oxf) return;
  const NOT_TEXT = 'script,style,noscript,template,title,head,select,option,optgroup,textarea,svg,math';
  const TARGET = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],summary,[tabindex]';
  const NATIVE = 'a[href],button,input,select,textarea,summary,[role="button"]';
  // Things that activate. Target size (WCAG 2.5.8) is about these, not about a truncated cell
  // made focusable so its full value can show: that stays in the focus walk only.
  const ACTIVATES = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[onclick],' +
    ['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option'].map(r => `[role="${r}"]`).join(',');
  const FOCUSABLE = TARGET + ',[contenteditable=""],[contenteditable="true"],iframe';
  // Hidden on purpose until opened: closed dialogs, menus, popovers, tooltips, [hidden].
  const OVERLAY = 'dialog:not([open]),[popover],[role="menu"],[role="listbox"],[role="tooltip"],' +
    '[role="dialog"],[role="alertdialog"],[hidden],[aria-hidden="true"],[inert]';
  const r1 = v => Math.round(v * 10) / 10;
  const range = document.createRange();

  // ---------- colour: any computed colour -> [r, g, b, a] on a 0-255 scale ----------
  // Computed styles come back as rgb(), oklch(), lab(), color(srgb ...). Legacy rgb() is read
  // exactly; everything else is painted on a 1x1 sRGB canvas and read back.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const memo = new Map();
  function bytes(css) {
    if (!css || css === 'transparent') return [0, 0, 0, 0];
    let v = memo.get(css);
    if (v) return v;
    const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(css);
    if (m) v = [+m[1], +m[2], +m[3], m[4] == null ? 255 : +m[4] * 255];
    else {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
      v = [...cx.getImageData(0, 0, 1, 1).data];
    }
    memo.set(css, v);
    return v;
  }
  // The colour the browser paints under everything: Canvas, for the root's color-scheme.
  function canvasColour() {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;width:0;height:0;background-color:Canvas';
    document.documentElement.appendChild(d);
    const v = bytes(getComputedStyle(d).backgroundColor);
    d.remove();
    return v;
  }

  // ---------- element tables ----------
  const css = new Map();
  const st = el => { let s = css.get(el); if (!s) css.set(el, s = getComputedStyle(el)); return s; };
  // nodes[i] = { bg, op, img, p }: background bytes, opacity, has a background-image, parent index.
  // Node walks p up to -1 to composite a colour through every ancestor.
  const ids = new Map(), nodes = [];
  function node(el) {
    if (!el || el.nodeType !== 1) return -1;
    let i = ids.get(el);
    if (i !== undefined) return i;
    const p = node(el.parentElement), s = st(el);
    i = nodes.length; ids.set(el, i);
    nodes.push({ bg: bytes(s.backgroundColor), op: +s.opacity, img: s.backgroundImage !== 'none' ? 1 : 0, p });
    return i;
  }

  // Short CSS path: up to four levels, stopping at an id.
  function path(el) {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
      if (n === document.body || n === document.documentElement) break;
      let s = n.localName;
      if (n.id && /^[a-z][\w-]*$/i.test(n.id)) { parts.unshift(`${s}#${n.id}`); break; }
      const c = [...n.classList].find(k => /^[a-z][\w-]{0,24}$/i.test(k) && !/\d{3,}/.test(k));
      if (c) s += '.' + c;
      parts.unshift(s);
    }
    return parts.join(' > ') || el.localName;
  }

  // Visually hidden for screen readers: clip, clip-path inset(50%), or a 1px clipped box.
  function srOnly(el) {
    for (let n = el, k = 0; n && k < 3; n = n.parentElement, k++) {
      const s = st(n);
      if (/inset\(\s*(50|100)%/.test(s.clipPath)) return true;
      if (s.position !== 'absolute' && s.position !== 'fixed') continue;
      if (s.clip && s.clip !== 'auto') return true;
      const r = n.getBoundingClientRect();
      if ((r.width <= 1 || r.height <= 1) && s.overflow !== 'visible') return true;
    }
    return false;
  }

  // The outermost element that makes el invisible, or null.
  function hiderOf(el) {
    let h = null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) if (+st(n).opacity < 0.01) h = n;
    if (h) return { el: h, why: 'opacity 0' };
    if (st(el).visibility === 'visible') return null;
    let n = el;
    while (n.parentElement && st(n.parentElement).visibility !== 'visible') n = n.parentElement;
    return { el: n, why: 'visibility hidden' };
  }

  // Nearest ancestor-or-self that clips text on each axis (overflow hidden or clip). A scroll
  // container on the way stops the search: text inside it can still be reached.
  function clipOf(el) {
    const out = {};
    for (let n = el; n && (out.x === undefined || out.y === undefined); n = n.parentElement) {
      const s = st(n), root = n === document.documentElement || n === document.body;
      for (const [ax, o] of [['x', s.overflowX], ['y', s.overflowY]]) {
        if (out[ax] !== undefined || o === 'visible') continue;
        if (o !== 'hidden' && o !== 'clip') { out[ax] = null; continue; }
        let b;
        if (root) b = [0, 0, innerWidth, innerHeight];
        else {
          const r = n.getBoundingClientRect(), L = r.left + n.clientLeft + scrollX, T = r.top + n.clientTop + scrollY;
          b = [L, T, L + n.clientWidth, T + n.clientHeight].map(r1);
        }
        const clamp = s.webkitLineClamp && s.webkitLineClamp !== 'none';
        out[ax] = { b, e: s.textOverflow === 'ellipsis' ? 1 : 0, c: clamp ? 1 : 0, path: n === el ? '' : path(n) };
      }
    }
    return [out.x || null, out.y || null];
  }

  // ---------- accessible names (a plain subset of accname) ----------
  function subtreeText(el) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { s += n.data; continue; }
      if (n.nodeType !== 1 || n.getAttribute('aria-hidden') === 'true' || st(n).display === 'none') continue;
      if (n.localName === 'img') s += ' ' + (n.getAttribute('alt') || '');
      else if (n.localName === 'svg') s += ' ' + (n.getAttribute('aria-label') || n.querySelector('title')?.textContent || '');
      else s += ' ' + (n.getAttribute('aria-label') || subtreeText(n));
    }
    return s.replace(/\s+/g, ' ').trim();
  }
  function nameOf(el) {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map(i => document.getElementById(i)?.textContent || '').join(' ').trim();
      if (t) return [t, 'labelledby'];
    }
    const al = el.getAttribute('aria-label')?.trim();
    if (al) return [al, 'aria-label'];
    const tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && /^(submit|reset)$/.test(type)) return [el.value || type, 'value'];
    if (tag === 'input' && type === 'button' && el.value) return [el.value, 'value'];
    if (tag === 'input' && type === 'image' && el.alt) return [el.alt, 'alt'];
    if (/^(input|select|textarea)$/.test(tag)) {
      const l = [...(el.labels || [])].map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim();
      if (l) return [l, 'label'];
    } else {
      const t = subtreeText(el);
      if (t) return [t, 'text'];
    }
    const ti = el.getAttribute('title')?.trim();
    if (ti) return [ti, 'title'];
    const ph = el.getAttribute('placeholder')?.trim();
    if (ph && /^(input|textarea)$/.test(tag)) return [ph, 'placeholder'];
    return ['', ''];
  }

  // A link inside running text: inline, and its block holds at least two words that are not
  // themselves links or buttons. Those are exempt from target size (WCAG 2.5.8 inline case).
  const running = new Map();
  function inRunningText(a) {
    if (a.localName !== 'a' || st(a).display !== 'inline') return false;
    let b = a.parentElement;
    while (b && st(b).display.startsWith('inline')) b = b.parentElement;
    if (!b) return false;
    if (running.has(b)) return running.get(b);
    let other = '';
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    while (w.nextNode() && other.length < 300) {
      const c = w.currentNode.parentElement.closest(TARGET);
      if (!c || !b.contains(c)) other += ' ' + w.currentNode.data;
    }
    const yes = /\p{L}{2,}\P{L}+\p{L}{2,}/u.test(other);
    running.set(b, yes);
    return yes;
  }

  // The layer text moves with: its nearest fixed ancestor or real scroll container, else the page.
  // Text in one layer can scroll out from under text in another, so the judge treats those apart.
  function layerOf(el) {
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const s = st(n);
      if (s.position === 'fixed') return node(n);
      if ((/auto|scroll/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) ||
        (/auto|scroll/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1)) return node(n);
    }
    return -1;
  }
  const opacityOf = el => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +st(n).opacity; return o; };
  // Rendered at all: not display none, not inside a content-visibility: hidden subtree such as a
  // closed <details>, whose content Chrome still lays out and so still has boxes.
  const shown = el => {
    while (el && st(el).display === 'contents') el = el.parentElement;
    return !el || !el.checkVisibility || el.checkVisibility();
  };
  const box = (r, X, Y) => [r.left + X, r.top + Y, r.right + X, r.bottom + Y].map(r1);

  // An open modal: a <dialog> shown with showModal(), or a visible [aria-modal="true"]. While one
  // is open, everything outside it is inert behind a scrim, so only the modal is measured.
  function activeModal() {
    try { const d = document.querySelector('dialog:modal'); if (d) return d; } catch { /* no :modal */ }
    for (const el of document.querySelectorAll('[aria-modal="true"]'))
      if (el.getClientRects().length && shown(el) && st(el).visibility === 'visible' && opacityOf(el) >= 0.01) return el;
    return null;
  }

  // ---------- collect: one pass over the settled page, scrolled to the top ----------
  function collect() {
    css.clear(); ids.clear(); nodes.length = 0; running.clear();
    const X = scrollX, Y = scrollY, out = { iw: innerWidth, ih: innerHeight, canvas: canvasColour() };
    const modal = activeModal(), inScope = el => !modal || modal.contains(el);
    out.modal = modal ? path(modal) : '';

    // Media that text might sit on. Overlap means the background must be read from pixels.
    const media = [...document.querySelectorAll('img,video,canvas,svg,iframe,object,embed')]
      .filter(m => !m.parentElement?.closest('svg'))
      .map(m => [m, box(m.getBoundingClientRect(), X, Y)])
      .filter(([, b]) => b[2] - b[0] > 1 && b[3] - b[1] > 1).slice(0, 400);
    const hits = (q, b) => Math.min(q[0] + q[2], b[2]) - Math.max(q[0], b[0]) > 1 &&
      Math.min(q[1] + q[3], b[3]) - Math.max(q[1], b[1]) > 1;
    const overMedia = (el, rects) => media.some(([m, b]) => !el.contains(m) && !m.contains(el) && rects.some(q => hits(q, b)));

    // Regions an aria-expanded="false" control says are closed.
    const closed = [];
    for (const c of document.querySelectorAll('[aria-expanded="false"][aria-controls]'))
      for (const i of c.getAttribute('aria-controls').split(/\s+/)) { const t = document.getElementById(i); if (t) closed.push(t); }
    const onPurpose = h => h.closest(OVERLAY) || closed.some(c => c.contains(h)) ||
      [h, h.parentElement, h.parentElement?.parentElement].some(n => n && /^(absolute|fixed)$/.test(st(n).position));

    // Text-bearing elements: any element with a direct, non-blank text node.
    const owners = new Map();
    const tw = document.createTreeWalker(modal || document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    while (tw.nextNode() && owners.size < 4000) {
      const t = tw.currentNode, el = t.parentElement;
      if (!/\S/.test(t.data) || !el || el.closest(NOT_TEXT)) continue;
      if (!owners.has(el) && !shown(el)) continue;
      (owners.get(el) || owners.set(el, []).get(el)).push(t);
    }
    out.text = []; const hidden = new Map();
    for (const [el, tn] of owners) {
      const rects = [];
      for (const t of tn) {
        range.selectNodeContents(t);
        for (const q of range.getClientRects())
          if (q.width >= 1 && q.height >= 1 && rects.length < 40) rects.push([q.left + X, q.top + Y, q.width, q.height].map(r1));
      }
      if (!rects.length) continue;
      const words = tn.map(t => t.data).join(' ').replace(/\s+/g, ' ').trim();
      const h = hiderOf(el);
      if (h) {
        if (!onPurpose(h.el)) {
          const g = hidden.get(h.el) || hidden.set(h.el, { path: path(h.el), why: h.why, text: words.slice(0, 50), n: 0 }).get(h.el);
          g.n++;
        }
        continue;
      }
      const s = st(el), [clipX, clipY] = clipOf(el);
      out.text.push({
        id: node(el), path: path(el), text: words.slice(0, 50), rects,
        fg: bytes(s.webkitTextFillColor || s.color), size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10) || 400,
        sr: srOnly(el) ? 1 : 0, dis: el.closest('[disabled],[aria-disabled="true"]') ? 1 : 0,
        clipText: /text/.test(s.backgroundClip + s.webkitBackgroundClip) ? 1 : 0,
        over: overMedia(el, rects) ? 1 : 0, ell: s.textOverflow === 'ellipsis' ? 1 : 0, clipX, clipY, layer: layerOf(el),
      });
    }
    out.hidden = [...hidden.values()].slice(0, 30);

    // Form fields: their typed value is text too, and their border is the non-text contrast case.
    out.fields = [];
    for (const el of document.querySelectorAll('input,select,textarea')) {
      const type = (el.type || '').toLowerCase(), r = el.getBoundingClientRect(), s = st(el);
      if (!inScope(el) || type === 'hidden' || r.width < 1 || r.height < 1 || s.visibility !== 'visible' || opacityOf(el) < 0.01 || !shown(el)) continue;
      const value = el.localName === 'select' ? el.selectedOptions?.[0]?.textContent?.trim() || '' : el.value || '';
      if (value && !/^(checkbox|radio|range|color|file|image)$/.test(type) && !el.disabled)
        out.text.push({
          id: node(el), path: path(el), text: value.slice(0, 50), ctl: 1, rects: [[r.left + X, r.top + Y, r.width, r.height].map(r1)],
          fg: bytes(s.color), size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10) || 400, sr: 0, dis: 0, clipText: 0, over: 0,
        });
      if (/^(checkbox|radio|range|color|file|submit|reset|button|image)$/.test(type)) continue;
      // Disabled fields are exempt from WCAG 1.4.11, as their text is from 1.4.3.
      if (el.disabled || el.closest('[aria-disabled="true"],fieldset:disabled')) continue;
      // The visible edge may belong to a wrapper that hugs the field (an icon search box, a
      // :focus-within frame): within 16px above and below, within 48px at the sides.
      const sides = n => ['Top', 'Right', 'Bottom', 'Left'].map(k => [parseFloat(st(n)[`border${k}Width`]) || 0, bytes(st(n)[`border${k}Color`])]);
      const wraps = [];
      for (let n = el.parentElement, k = 0; n && n !== document.body && k < 2; n = n.parentElement, k++) {
        const q = n.getBoundingClientRect();
        if (r.top - q.top > 16 || q.bottom - r.bottom > 16 || r.left - q.left > 48 || q.right - r.right > 48) break;
        wraps.push({ id: node(n), sides: sides(n) });
      }
      out.fields.push({ id: node(el), path: path(el), sides: sides(el), wraps });
    }

    // Accessible names for everything focusable or interactive; sizes only for what activates.
    out.targets = []; out.names = [];
    const index = new Map();
    const clickable = [...(document.body || document.documentElement).getElementsByTagName('*')].slice(0, 8000)
      .filter(el => typeof el.onclick === 'function' && !el.matches(TARGET)); // onclick set from script
    for (const el of [...document.querySelectorAll(TARGET), ...clickable]) {
      if (index.size >= 800) break;
      const byScript = !el.matches(TARGET);
      if (!inScope(el) || (!byScript && !el.matches(NATIVE) && el.tabIndex < 0)) continue;
      if (!el.getClientRects().length || !shown(el) || el.closest('[aria-hidden="true"],[inert]')) continue;
      const [name, via] = nameOf(el);
      const kind = el.localName === 'a' ? 'link' : el.getAttribute('role') || el.localName;
      if (!byScript) out.names.push({ path: path(el), kind, name: name.slice(0, 40), via });
      const s = st(el);
      if (!byScript && !el.matches(ACTIVATES) && typeof el.onclick !== 'function') continue;
      if (el.matches(':disabled') || el.closest('[aria-disabled="true"]') || s.visibility !== 'visible' ||
        opacityOf(el) < 0.01 || srOnly(el)) continue;
      let b = box(el.getBoundingClientRect(), X, Y);
      if (/^(checkbox|radio)$/.test(el.type)) // a label is part of the click area
        for (const l of el.labels || []) { const q = box(l.getBoundingClientRect(), X, Y); b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])]; }
      if (b[2] - b[0] < 1 || b[3] - b[1] < 1) continue;
      // Parked off-screen at load (a skip link) is not a target until focus brings it in; the
      // focus walk checks that it does.
      if (b[3] <= 0 || b[2] <= 0 || b[0] >= innerWidth) continue;
      index.set(el, out.targets.length);
      out.targets.push({ path: path(el), kind, name: name.slice(0, 40), box: b, inline: inRunningText(el) ? 1 : 0, up: -1 });
    }
    for (const [el, i] of index) { const a = el.parentElement?.closest(TARGET); if (index.has(a)) out.targets[i].up = index.get(a); }

    // Sideways scroll: who sticks out past the right edge, outside any scroll container.
    const de = document.documentElement, iw = innerWidth;
    out.wide = { sw: de.scrollWidth, rootClips: [de, document.body].some(n => n && /hidden|clip/.test(st(n).overflowX)) ? 1 : 0, offenders: [] };
    const inScroller = el => { for (let n = el.parentElement; n && n !== document.body && n !== de; n = n.parentElement) if (st(n).overflowX !== 'visible') return true; return false; };
    if (out.wide.sw > iw || out.wide.rootClips) {
      const all = (document.body || de).getElementsByTagName('*');
      for (let i = 0; i < all.length && i < 8000; i++) {
        const el = all[i], r = el.getBoundingClientRect();
        if (r.right + X <= iw + 1 || r.width < 1 || st(el).position === 'fixed' || inScroller(el)) continue;
        const p = el.parentElement, pr = p && p.getBoundingClientRect();
        if (p && p !== document.body && pr.right + X > iw + 1 && r.right <= pr.right + 1) continue; // blame the parent
        out.wide.offenders.push({ path: path(el), right: r1(r.right + X), w: r1(r.width) });
      }
      out.wide.offenders.sort((a, b) => b.right - a.right || b.w - a.w).splice(5);
    }
    out.nodes = nodes;
    return out;
  }

  // ---------- page look, for "is there a dark theme" ----------
  function theme() {
    const b = document.body || document.documentElement;
    return { canvas: canvasColour(), html: bytes(getComputedStyle(document.documentElement).backgroundColor),
      body: bytes(getComputedStyle(b).backgroundColor), text: bytes(getComputedStyle(b).color) };
  }

  // ---------- settle: fonts loaded, animations at their end, scroll-reveal given its chance ----------
  async function settle() {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const frame = () => Promise.race([new Promise(r => requestAnimationFrame(() => r())), wait(50)]);
    const finish = () => { for (const a of document.getAnimations?.() || []) try { a.finish(); } catch { /* infinite */ } };
    await Promise.race([document.fonts.ready, wait(5000)]);
    finish();
    const se = document.scrollingElement || document.documentElement;
    for (let y = 0, i = 0; i < 80 && y < se.scrollHeight; i++, y += innerHeight * 0.8) { scrollTo(0, y); await frame(); await frame(); }
    scrollTo(0, se.scrollHeight); await frame(); await frame();
    scrollTo(0, 0); await wait(500); await frame();
    finish();
    await Promise.race([document.fonts.ready, wait(5000)]);
  }

  // ---------- focus: snapshot every focusable unfocused, then read each one as Tab lands ----------
  // The look of a control can change on itself, its parent or grandparent (:focus-within), its
  // next sibling (input + span), or its label. All of those are watched.
  const watchOf = el => [...new Set([el, el.parentElement, el.parentElement?.parentElement, el.nextElementSibling,
    ...(el.labels || [])])].filter(n => n && n !== document.body && n !== document.documentElement);
  function shadows(v) {
    if (!v || v === 'none') return [];
    return v.split(/,(?![^(]*\))/).map(p => {
      const m = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|#[0-9a-f]{3,8}\b/i.exec(p);
      return { c: m ? bytes(m[0]) : [0, 0, 0, 255], n: (p.replace(m ? m[0] : '', '').match(/-?[\d.]+px/g) || []).map(parseFloat), inset: /\binset\b/.test(p) ? 1 : 0 };
    });
  }
  function look(n) {
    const s = getComputedStyle(n);
    const pseudo = p => { const q = getComputedStyle(n, p); return q.content === 'none' ? '' :
      [q.content, q.backgroundColor, q.boxShadow, q.borderColor, q.outlineStyle, q.outlineColor, q.opacity, q.transform, q.width, q.height, q.color].join('|'); };
    return {
      ol: [s.outlineStyle, parseFloat(s.outlineWidth) || 0, bytes(s.outlineColor), parseFloat(s.outlineOffset) || 0],
      sh: s.boxShadow, rings: shadows(s.boxShadow), bg: bytes(s.backgroundColor), bi: s.backgroundImage, fg: bytes(s.color),
      bc: ['Top', 'Right', 'Bottom', 'Left'].map(k => bytes(s[`border${k}Color`])),
      bw: ['Top', 'Right', 'Bottom', 'Left'].map(k => parseFloat(s[`border${k}Width`]) || 0),
      td: s.textDecorationLine, tdc: bytes(s.textDecorationColor), op: +s.opacity, tf: s.transform,
      svg: n instanceof SVGElement ? [s.fill, s.stroke, s.strokeWidth].join('|') : '', // SVG shows focus with paint
      at: n instanceof HTMLElement ? [n.offsetLeft, n.offsetTop, n.offsetWidth, n.offsetHeight] : [],
      ps: pseudo('::before') + '/' + pseudo('::after'),
    };
  }
  let before = new Map(), seen = new Set(), trap = null;
  // With a modal open, the walk starts inside it: focus the modal itself, then blur it, which
  // leaves the place Tab starts from at the top of the modal with nothing focused.
  function focusSetup() {
    document.activeElement?.blur?.();
    scrollTo(0, 0);
    before = new Map(); seen = new Set(); trap = activeModal();
    if (trap) {
      if (!trap.hasAttribute('tabindex')) trap.setAttribute('tabindex', '-1');
      trap.focus({ preventScroll: true });
      trap.blur();
    }
    for (const el of document.querySelectorAll(FOCUSABLE)) {
      if (before.size >= 1000) break;
      const w = watchOf(el);
      before.set(el, { w, looks: w.map(look) });
    }
    return { modal: trap ? path(trap) : '' };
  }
  function focusProbe() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    if (!a || a === document.body || a === document.documentElement) return { end: 1 };
    if (trap && !trap.contains(a)) return { escaped: 1, path: path(a), name: nameOf(a)[0].slice(0, 40), modal: path(trap) };
    if (seen.has(a)) return { end: 1 };
    seen.add(a);
    last = a;
    const b = before.get(a), w = b ? b.w : watchOf(a), r = a.getBoundingClientRect();
    // [background, opacity] from an element up to the root, read fresh (focus may change them).
    const chain = el => { const c = []; for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n); c.push([bytes(s.backgroundColor), +s.opacity]); } return c; };
    return { path: path(a), name: nameOf(a)[0].slice(0, 40), before: b ? b.looks : null, now: w.map(look),
      own: w.map(chain), outside: w.map(n => chain(n.parentElement)),
      box: [r.left, r.top, r.right, r.bottom].map(r1), vw: innerWidth, vh: innerHeight }; // box in the viewport
  }
  // For the pixel check: take focus off the last element, then give it back so the next Tab
  // carries on from the same place.
  let last = null;
  const focusBlur = () => { last?.blur(); };
  const focusRestore = () => { last?.focus({ preventScroll: true }); };

  window.__oxf = { collect, theme, settle, focusSetup, focusProbe, focusBlur, focusRestore };
}
