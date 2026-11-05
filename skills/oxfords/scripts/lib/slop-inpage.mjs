// Oxfords audit, the half that runs inside the page. Zero dependencies.
// Playwright serialises installSlop() with toString(), so nothing in here may reach module scope.
// It collects raw facts about the rendered page: text and how it is set, headings, bordered
// boxes, divider lines, pills, gradients, small dots. Every threshold lives in slop.mjs.
//
//   await page.evaluate(installSlop); await page.evaluate(() => window.__oxs.collect());

export function installSlop() {
  if (window.__oxs) return;
  const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'math', 'head', 'title', 'select',
    'option', 'textarea', 'iframe', 'canvas', 'video', 'audio', 'picture', 'img']);
  const CODE = 'code,pre,kbd,samp,var,tt';
  const HEAD = 'h1,h2,h3,[role="heading"]';
  const ACT = 'a[href],button,[role="button"],[role="tab"],input,label,summary,select';
  const MONO = /mono|courier|consolas|menlo|monaco|fira code|source code|jetbrains|monospace/i;
  const MAX = 12000;
  const r0 = Math.round;
  const fam = ff => (ff || '').split(',')[0].replace(/["']/g, '').trim();
  const words = t => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const squash = t => (t || '').replace(/\s+/g, ' ').trim();
  function pageBox(el) {
    const r = el.getBoundingClientRect();
    return [r0(r.left + scrollX), r0(r.top + scrollY), r0(r.width), r0(r.height)];
  }
  function alpha(c) {
    if (!c || c === 'transparent') return 0;
    const m = /\/\s*([\d.]+%?)\s*\)$/.exec(c) || /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+%?)\)$/.exec(c);
    if (!m) return 1;
    return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  }
  // Any computed colour as an rgba() string: legacy rgb() is read as is, everything else (oklch,
  // lab, color()) is painted on a 1x1 canvas and read back.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  function rgba(css) {
    if (/^rgba?\(/.test(css)) return css;
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  }
  const stops = img => (img.match(/(?:rgba?|oklch|oklab|lab|lch|hsla?|hwb|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b/gi) || []).slice(0, 12).map(rgba);
  function side(s, k) {
    const w = parseFloat(s[`border${k}Width`]) || 0;
    return w >= 1 && s[`border${k}Style`] !== 'none' && s[`border${k}Style`] !== 'hidden' && alpha(s[`border${k}Color`]) >= 0.15;
  }
  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return squash(t);
  }
  // Short CSS path: up to four levels, stopping at an id. Same shape as inpage.mjs.
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

  function collect() {
    const de = document.documentElement, body = document.body;
    const out = {
      page: { w: de.scrollWidth, h: Math.max(de.scrollHeight, body ? body.scrollHeight : 0), vw: innerWidth, vh: innerHeight },
      fonts: {}, texts: [], heads: [], boxes: [], lines: [], pills: [], grads: [], dots: [], rails: [], copy: [], imgs: [],
    };
    if (!body) return out;
    out.fonts.body = fam(getComputedStyle(body).fontFamily);
    const h1 = document.querySelector('h1');
    if (h1) out.fonts.heading = fam(getComputedStyle(h1).fontFamily);

    for (const el of [de, body]) {
      const s = getComputedStyle(el);
      if (/gradient\(/.test(s.backgroundImage)) out.grads.push({ stops: stops(s.backgroundImage), box: [0, 0, out.page.w, out.page.h], path: el.localName, page: true });
    }

    const bordered = new Set(), pills = new Set(), seenAct = new Set();
    const area = out.page.vw * out.page.vh;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        if (SKIP.has(el.localName)) return NodeFilter.FILTER_REJECT;
        const s = getComputedStyle(el);
        if (s.display === 'none') return NodeFilter.FILTER_REJECT;
        if (+s.opacity < 0.05) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n = 0;
    for (let el = walker.nextNode(); el && n < MAX; el = walker.nextNode(), n++) {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden') continue;
      const b = pageBox(el);
      if (b[2] <= 1 || b[3] <= 1) continue; // nothing, or a screen-reader-only 1px box
      const tag = el.localName;
      const inCode = !!el.closest(CODE), act = !!el.closest(ACT);

      // Text set on this element.
      const t = ownText(el);
      if (t) {
        const ff = fam(s.fontFamily);
        out.texts.push({
          tag, t: t.slice(0, 200), len: t.length, words: words(t), box: b, fam: ff, mono: MONO.test(s.fontFamily),
          code: inCode, act, italic: s.fontStyle !== 'normal', tt: s.textTransform,
          ls: parseFloat(s.letterSpacing) || 0, fs: parseFloat(s.fontSize) || 16, fw: +s.fontWeight || 400,
          inHead: !!el.closest(HEAD), path: path(el),
        });
        if (out.texts.length < 4000) out.copy.push({ tag: /^h[1-6]$/.test(tag) ? tag : act ? 'button' : 'p', t: t.slice(0, 300) });
      }
      // Buttons and links by their full label, for the copy rules.
      if (el.matches('a[href],button,[role="button"]')) {
        const label = squash(el.innerText).slice(0, 80);
        if (label && !seenAct.has(label)) { seenAct.add(label); out.copy.push({ tag: 'button', t: label }); }
      }

      // Headings, and display text set like a heading without the tag.
      const fs = parseFloat(s.fontSize) || 16;
      const isHead = el.matches(HEAD) || (fs >= 32 && t && t.length <= 140 && !el.closest(HEAD));
      if (isHead) {
        const text = squash(el.innerText);
        if (text) {
          const baseFam = fam(s.fontFamily), baseItalic = s.fontStyle !== 'normal';
          let italicKids = 0, famKids = [];
          for (const k of el.querySelectorAll('*')) {
            if (!squash(k.textContent)) continue;
            const ks = getComputedStyle(k);
            if (!baseItalic && ks.fontStyle !== 'normal') italicKids++;
            const kf = fam(ks.fontFamily);
            if (kf && kf !== baseFam && !famKids.includes(kf)) famKids.push(kf);
          }
          out.heads.push({ tag, level: /^h[1-6]$/.test(tag) ? +tag[1] : 2, t: text.slice(0, 200), box: b, fs, fam: baseFam,
            italic: baseItalic, italicKids, famKids, path: path(el) });
        }
      }

      // Bordered boxes: all four sides drawn, big enough to hold content, holding text.
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map(k => side(s, k));
      const formy = /^(?:input|button|a|table|thead|tbody|tr|td|th|hr|fieldset|li)$/.test(tag);
      if (sides.every(Boolean) && b[2] >= 120 && b[3] >= 48 && !formy && squash(el.textContent)) {
        let depth = 0;
        for (let p = el.parentElement; p; p = p.parentElement) if (bordered.has(p)) depth++;
        bordered.add(el);
        out.boxes.push({ box: b, depth, path: path(el) });
      }

      // Side rails: one thick border on the left or right and nothing else.
      const lw = parseFloat(s.borderLeftWidth) || 0, rw = parseFloat(s.borderRightWidth) || 0;
      if (b[3] >= 16 && !sides[0] && !sides[2] && ((lw >= 2 && sides[3] && !sides[1]) || (rw >= 2 && sides[1] && !sides[3])))
        out.rails.push({ box: b, path: path(el), colour: rgba(lw >= 2 ? s.borderLeftColor : s.borderRightColor) });

      // Divider lines: an <hr>, a one-sided rule across a row, or a thin filled strip.
      const inTable = !!el.closest('table');
      if (tag === 'hr') out.lines.push({ box: b, path: path(el), menu: !!el.closest('[role="menu"],[role="listbox"]') });
      else if (!inTable && !formy && b[2] >= 160 && !sides.every(Boolean) &&
        ((sides[0] && !sides[1] && !sides[3]) || (sides[2] && !sides[1] && !sides[3])))
        out.lines.push({ box: b, path: path(el), menu: !!el.closest('[role="menu"],[role="listbox"],nav') });
      else if (!inTable && b[3] <= 2 && b[2] >= 160 && alpha(s.backgroundColor) >= 0.15 && !squash(el.textContent))
        out.lines.push({ box: b, path: path(el), menu: false });

      // Pills: fully rounded ends, short label, a fill or a border.
      const rad = s.borderTopLeftRadius, rv = parseFloat(rad) || 0;
      const round = rad.includes('%') ? rv >= 50 : rv >= b[3] / 2 - 1;
      if (round && b[3] >= 14 && b[3] <= 40 && b[2] > b[3] * 1.3 && b[2] <= 280 &&
        (alpha(s.backgroundColor) >= 0.06 || sides.some(Boolean))) {
        const label = squash(el.innerText);
        let inside = false;
        for (let p = el.parentElement; p && !inside; p = p.parentElement) inside = pills.has(p);
        if (label && label.length <= 32 && words(label) <= 4 && !inside && tag !== 'input') {
          pills.add(el);
          out.pills.push({ box: b, t: label, act: el.matches(ACT) || act, path: path(el) });
        }
      }

      // Gradient backgrounds on anything large.
      if (/gradient\(/.test(s.backgroundImage) && b[2] * b[3] >= 0.15 * area)
        out.grads.push({ stops: stops(s.backgroundImage), box: b, path: path(el) });

      // Small round dots: the raw material of fake window chrome.
      if (b[2] >= 6 && b[2] <= 18 && Math.abs(b[2] - b[3]) <= 1 && rv >= b[2] / 2 - 1 && alpha(s.backgroundColor) >= 0.5)
        out.dots.push({ box: b, bg: rgba(s.backgroundColor) });
    }
    for (const img of document.images) {
      if (!img.getClientRects().length) continue;
      out.imgs.push({ alt: img.hasAttribute('alt') ? img.getAttribute('alt') : null });
      if (out.imgs.length > 300) break;
    }
    return out;
  }

  // Page boxes for the short paths the render check reports, so its findings can be pinned too.
  function locate(paths) {
    return paths.map(p => {
      try { const el = document.querySelector(p); return el ? pageBox(el) : null; } catch { return null; }
    });
  }

  // Every stylesheet the page can read. Cross-origin sheets come back as their href.
  function sheets() {
    const css = [], hrefs = [];
    for (const sh of document.styleSheets) {
      try { css.push([...sh.cssRules].map(r => r.cssText).join('\n')); }
      catch { if (sh.href) hrefs.push(sh.href); }
    }
    return { css, hrefs };
  }

  window.__oxs = { collect, locate, sheets };
}
